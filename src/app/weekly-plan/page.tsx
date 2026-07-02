"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Plus, Trash2, CheckCircle2, TrendingUp, Clock, FileSpreadsheet, History, X } from "lucide-react";
import type { AppUser } from "@/lib/logbook";
import {
  WEEKLY_HOURS, taskWeight, taskAchWeight,
  type WeeklyTask, type WeeklyPlan,
} from "@/lib/weekly-plan";

function getMonday(d = new Date()) {
  d = new Date(d);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().slice(0, 10);
}

// "25-05-2026 to 29-05-2026" style range (Mon–Fri) for the report title.
function weekRange(weekStart: string) {
  const start = new Date(weekStart + "T00:00:00");
  const end = new Date(start);
  end.setDate(start.getDate() + 4);
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
  return `${fmt(start)} to ${fmt(end)}`;
}

function newTask(date: string, index: number): WeeklyTask {
  return { id: crypto.randomUUID(), date, hours: 0, activity: "", achWeight: 0, achFormula: `=H${13 + index}*0/100`, comment: "" };
}

function achColor(pct: number) {
  return pct >= 90 ? "var(--success)" : pct >= 50 ? "var(--tertiary)" : "var(--primary)";
}

// On-screen columns, in spreadsheet order (B..I), for the Excel-style formula bar.
type ColKey = "date" | "hours" | "activity" | "plan" | "ach" | "comment" | "weight" | "achWeight";

export default function WeeklyPlanPage() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [weekStartDate, setWeekStartDate] = useState<string>(getMonday());
  const [tasks, setTasks] = useState<WeeklyTask[]>([]);
  const [allPlans, setAllPlans] = useState<WeeklyPlan[]>([]);
  // Loading is derived: the week is loading until its data has arrived.
  const [loadedWeek, setLoadedWeek] = useState<string>("");
  const loading = !user || loadedWeek !== `${user.username}:${weekStartDate}`;
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string>("");
  const [showHistory, setShowHistory] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string>("");
  const [deletingWeek, setDeletingWeek] = useState<string>("");
  // Excel-like active cell + in-cell formula editing (for the Ach. Weight cell).
  const [active, setActive] = useState<{ id: string; col: ColKey; editing: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => { if (d.user) setUser(d.user); });
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/weekly-plan?username=${encodeURIComponent(user.username)}`)
      .then((r) => r.json())
      .then((d) => {
        const plans = (d.plans as WeeklyPlan[]) || [];
        setAllPlans(plans);
        const current = plans.find((p) => p.weekStartDate === weekStartDate);
        // Normalize legacy rows to have an achFormula
        const rows = current && current.tasks.length > 0
          ? current.tasks.map((t, i) => {
              if (t.achFormula) return { ...t, achWeight: taskAchWeight(t) };
              const w = taskWeight(t);
              const aw = t.achWeight ?? (w * ((t.executionPercent || 0) / 100));
              const pct = w > 0 ? Math.round((aw / w) * 100) : 0;
              return { ...t, achFormula: `=H${13 + i}*${pct}/100`, achWeight: aw };
            })
          : [newTask(weekStartDate, 0)];
        setTasks(rows);
        setSavedAt(current?.updatedAt || "");
        setLoadedWeek(`${user.username}:${weekStartDate}`);
      })
      .catch(() => setLoadedWeek(`${user.username}:${weekStartDate}`));
  }, [user, weekStartDate]);

  const addTask = () => setTasks((t) => [...t, newTask(weekStartDate, t.length)]);
  const removeTask = (id: string) => setTasks((t) => t.filter((x) => x.id !== id));
  const updateTask = (id: string, field: keyof WeeklyTask, value: string | number) =>
    setTasks((t) => t.map((x) => (x.id === id ? { ...x, [field]: value } : x)));

  const savePlan = async () => {
    if (!user) return;
    setSaving(true);
    const body: WeeklyPlan = { username: user.username, weekStartDate, tasks, updatedAt: new Date().toISOString() };
    const res = await fetch("/api/weekly-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setSavedAt(body.updatedAt);
      setAllPlans((prev) => {
        const rest = prev.filter((p) => p.weekStartDate !== weekStartDate);
        return [...rest, body];
      });
    }
    setSaving(false);
  };

  async function deletePlan(week: string) {
    if (!user) return;
    setDeletingWeek(week);
    const res = await fetch(
      `/api/weekly-plan?weekStartDate=${week}&username=${encodeURIComponent(user.username)}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setAllPlans((prev) => prev.filter((p) => p.weekStartDate !== week));
      // If the open week was deleted, reset it to a fresh sheet.
      if (week === weekStartDate) {
        setTasks([newTask(weekStartDate, 0)]);
        setSavedAt("");
      }
    }
    setDeletingWeek("");
    setConfirmDelete("");
  }

  // Saved weeks (newest first) for the history panel.
  const savedWeeks = [...allPlans]
    .filter((p) => p.tasks.length > 0)
    .sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate));

  // Overall achievement for an arbitrary plan (used by the history list).
  function planAchievement(p: WeeklyPlan) {
    const w = p.tasks.reduce((s, t) => s + taskWeight(t), 0);
    const aw = p.tasks.reduce((s, t) => s + taskAchWeight(t), 0);
    return w > 0 ? (aw / w) * 100 : 0;
  }

  // Export the current week to an .xlsx that reproduces the original government
  // "Weekly Plan & Report" template (may25weeklyPlan.xlsx) row-for-row: the
  // title + side metric block, the merged bilingual header, the top/bottom
  // totals rows and the same live formulas. xlsx is loaded lazily.
  async function exportXlsx() {
    const XLSX = await import("xlsx");
    const range = weekRange(weekStartDate);

    // Column letters B..I match the template (column A stays empty).
    const START = 13;                                   // first data row
    const N = Math.max(13, tasks.length);               // keep ≥13 template rows
    const END = START + N - 1;                           // last data row
    const TOTAL = END + 1;                               // bottom totals row
    const sumH = `SUM($H$${START}:$H$${END})`;

    type Cell = { t: string; v?: string | number; f?: string; z?: string };
    const ws: Record<string, Cell> = {};
    const s = (addr: string, v: string) => { ws[addr] = { t: "s", v }; };          // string
    const f = (addr: string, formula: string, z?: string) => { ws[addr] = { t: "n", f: formula, ...(z ? { z } : {}) }; };
    const n = (addr: string, v: number, z?: string) => { ws[addr] = { t: "n", v, ...(z ? { z } : {}) }; };

    // ── Title block ──
    s("C3", "Name:"); s("D3", user?.fullName || user?.username || "");
    s("B5", `በሳምንቱ ክትትል የሚያስፈልጋቸው ስራዎች  (${range})`);
    s("B6", `እቅድ (የሚሸፍነው ግዜ፡ 1 ሳምንት)  (${range})`);

    // ── Side metric block (per-day government work-hour usage) ──
    f("E6", `SUM(E${START}:E${END})`, "0.0%");
    s("F6", "የመንግስትን የሥራ ሰዓት አጠቃቀም  ክብደት (የ1 ቀን)"); f("H6", "8/40"); f("I6", "H7/H6");
    s("F7", "የመንግስትን የሥራ ሰዓት አጠቃቀም አፈጻጸም (የ1 ቀን)"); f("H7", `SUM(I${START}:I${END})`);
    s("F8", "እቅድ ክብደት (የ 1 ቀን)"); f("H8", "1*C12/5"); f("I8", "H9/H8");
    s("F9", "እቅድ አፈጻጸም (የ 1 ቀን)"); f("H9", `SUM(I${START}:I${END})`);

    // ── Bilingual header rows 10–11 ──
    s("B10", "Date (mm.dd.yy)"); s("C10", "ስራው የሚፈጀው ሰዓት"); s("D10", "ዋና ዋና ተግባራት");
    s("E10", "እቅድ (የሳምንቱ)"); s("F10", "አፈጻጸም (የሳምንቱ)");
    s("G10", "አስተያየት /የተገኘ ውጤት፣ የደረሰ ጉዳት፣ ያጋጠመ ችግር.../"); s("H10", "ክብደት");
    s("H11", "የስራው ክብደት"); s("I11", "የአፈጻጸም ክብደት");

    // ── Top totals row 12 ──
    f("C12", `SUM(C${START}:C${END})`); f("E12", `SUM(E${START}:E${END})`, "0.0%"); f("F12", `SUM(F${START}:F${END})`, "0.0%");

    // ── Data rows (formulas mirror the template; Ach. Weight is the typed value) ──
    tasks.forEach((t, i) => {
      const r = START + i;
      if (t.date) s(`B${r}`, t.date);
      n(`C${r}`, Number(t.hours) || 0);
      if (t.activity) s(`D${r}`, t.activity);
      f(`E${r}`, `IF(H${r}="","",H${r}/${sumH})`, "0.0%");
      f(`F${r}`, `IF(I${r}="","",I${r}/${sumH})`, "0.0%");
      if (t.comment) s(`G${r}`, t.comment);
      f(`H${r}`, `IF(C${r}="","",C${r}/40)`, "0.000");
      
      // Ach. Weight: carry the user's live formula into Excel, remapping any
      // row reference (H13, C13…) to this export row so it stays self-consistent.
      const raw = t.achFormula?.trim();
      if (raw && raw.startsWith("=")) {
        const body = raw.slice(1).replace(/([A-Za-z]+)\$?\d+/g, (_, L) => `${L}${r}`);
        f(`I${r}`, body, "0.000");
      } else {
        n(`I${r}`, Number(taskAchWeight(t).toFixed(3)), "0.000");
      }
    });
    // Empty template rows keep the same plan/weight formulas (resolve to "").
    for (let r = START + tasks.length; r <= END; r++) {
      f(`E${r}`, `IF(H${r}="","",H${r}/${sumH})`, "0.0%");
      f(`F${r}`, `IF(I${r}="","",I${r}/${sumH})`, "0.0%");
      f(`H${r}`, `IF(C${r}="","",C${r}/40)`, "0.000");
    }

    // ── Bottom totals row ──
    f(`E${TOTAL}`, `SUM(E${START}:E${END})`, "0.0%"); f(`F${TOTAL}`, `SUM(F${START}:F${END})`, "0.0%");

    // Merges: fixed header block (0-based, B..I) from the template + dynamic bottom total.
    const meta = ws as Record<string, unknown>;
    meta["!merges"] = [
      { s: { c: 3, r: 1 }, e: { c: 6, r: 1 } }, { s: { c: 1, r: 4 }, e: { c: 8, r: 4 } },
      { s: { c: 1, r: 5 }, e: { c: 3, r: 8 } }, { s: { c: 4, r: 5 }, e: { c: 4, r: 8 } },
      { s: { c: 5, r: 5 }, e: { c: 6, r: 5 } }, { s: { c: 8, r: 5 }, e: { c: 8, r: 6 } },
      { s: { c: 5, r: 6 }, e: { c: 6, r: 6 } }, { s: { c: 5, r: 7 }, e: { c: 6, r: 7 } },
      { s: { c: 8, r: 7 }, e: { c: 8, r: 8 } }, { s: { c: 5, r: 8 }, e: { c: 6, r: 8 } },
      { s: { c: 1, r: 9 }, e: { c: 1, r: 11 } }, { s: { c: 2, r: 9 }, e: { c: 2, r: 10 } },
      { s: { c: 3, r: 9 }, e: { c: 3, r: 11 } }, { s: { c: 4, r: 9 }, e: { c: 4, r: 10 } },
      { s: { c: 5, r: 9 }, e: { c: 5, r: 10 } }, { s: { c: 6, r: 9 }, e: { c: 6, r: 11 } },
      { s: { c: 7, r: 9 }, e: { c: 8, r: 9 } }, { s: { c: 7, r: 10 }, e: { c: 7, r: 11 } },
      { s: { c: 8, r: 10 }, e: { c: 8, r: 11 } }, { s: { c: 3, r: TOTAL - 1 }, e: { c: 5, r: TOTAL - 1 } },
    ];
    meta["!cols"] = [{ wch: 4 }, { wch: 14 }, { wch: 11 }, { wch: 40 }, { wch: 12 }, { wch: 13 }, { wch: 34 }, { wch: 12 }, { wch: 13 }];
    meta["!ref"] = `A1:I${TOTAL}`;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws as Parameters<typeof XLSX.utils.book_append_sheet>[1], "Weekly Report");
    const safe = (user?.username || "report").replace(/[^a-z0-9]/gi, "_");
    XLSX.writeFile(wb, `weekly_report_${safe}_${weekStartDate}.xlsx`);
  }

  // ── Automatic calculations (mirror the Excel formulas) ──
  const totalHours = tasks.reduce((s, t) => s + (Number(t.hours) || 0), 0);
  const totalWeight = totalHours / WEEKLY_HOURS;                       // Σ work weight
  const totalExecWeight = tasks.reduce((s, t) => s + taskAchWeight(t), 0);
  // Overall weekly achievement: hours-weighted average of completion.
  const achievement = totalWeight > 0 ? (totalExecWeight / totalWeight) * 100 : 0;

  const achievementColor = achColor(achievement);

  // Exact Excel top summary metrics
  const h6 = 8 / 40;
  const h7 = totalExecWeight;
  const i6 = h6 > 0 ? h7 / h6 : 0;
  const h8 = totalHours / 5;
  const h9 = totalExecWeight;
  const i8 = h8 > 0 ? h9 / h8 : 0;

  // ── Excel-style cell model ──
  // Each on-screen column maps to a spreadsheet column letter, and the data
  // rows start at Excel row 13 (matching the exported template). The Σ range
  // spans the full ≥13-row block, exactly like the export.
  const dataEnd = 13 + Math.max(13, tasks.length) - 1;
  const sumHRange = `SUM($H$13:$H$${dataEnd})`;

  // formula = what shows in the fx bar; editable = whether the bar/cell edits it.
  function cellInfo(task: WeeklyTask, i: number, col: ColKey): { ref: string; formula: string; editable: boolean } {
    const r = 13 + i;
    switch (col) {
      case "date": return { ref: `B${r}`, formula: task.date || "", editable: true };
      case "hours": return { ref: `C${r}`, formula: task.hours ? String(task.hours) : "", editable: true };
      case "activity": return { ref: `D${r}`, formula: task.activity || "", editable: true };
      case "plan": return { ref: `E${r}`, formula: `=IF(H${r}="","",H${r}/${sumHRange})`, editable: false };
      case "ach": return { ref: `F${r}`, formula: `=IF(I${r}="","",I${r}/${sumHRange})`, editable: false };
      case "comment": return { ref: `G${r}`, formula: task.comment || "", editable: true };
      case "weight": return { ref: `H${r}`, formula: `=IF(C${r}="","",C${r}/40)`, editable: false };
      case "achWeight": return { ref: `I${r}`, formula: task.achFormula || `=H${r}*0/100`, editable: true };
    }
  }

  const activeIndex = active ? tasks.findIndex((t) => t.id === active.id) : -1;
  const activeTask = activeIndex >= 0 ? tasks[activeIndex] : null;
  const activeInfo = activeTask && active ? cellInfo(activeTask, activeIndex, active.col) : null;

  // Route an edit from the formula bar (or in-cell) to the right field.
  function applyCellEdit(value: string) {
    if (!active || !activeInfo?.editable) return;
    switch (active.col) {
      case "date": updateTask(active.id, "date", value); break;
      case "hours": updateTask(active.id, "hours", parseFloat(value) || 0); break;
      case "activity": updateTask(active.id, "activity", value); break;
      case "comment": updateTask(active.id, "comment", value); break;
      case "achWeight": updateTask(active.id, "achFormula", value); break;
    }
  }

  // A clickable derived/value cell: selecting it surfaces its formula in the bar.
  const selectCell = (id: string, col: ColKey, editing = false) => setActive({ id, col, editing });
  const isActive = (id: string, col: ColKey) => active?.id === id && active.col === col;

  return (
    <main className="wp-page">
      <header className="wp-topbar">
        <div className="wp-topbar-left">
          <Link href="/" className="btn btn-outline btn-sm wp-back-btn" title="Back to Entry">
            <ArrowLeft size={16} /> <span>Back</span>
          </Link>
          <div className="wp-title-group">
            <h1 className="wp-title">Weekly Plan &amp; Report</h1>
            <span className="wp-title-sub">{weekRange(weekStartDate)}</span>
          </div>
        </div>
        <div className="wp-topbar-right">
          <label className="wp-week-picker">
            <span>Week of</span>
            <input type="date" className="input-modern" value={weekStartDate}
              onChange={(e) => setWeekStartDate(e.target.value)} />
          </label>
          <div className="wp-topbar-actions">
            <button className="btn btn-outline btn-sm" onClick={() => setShowHistory(true)} disabled={loading}>
              <History size={16} /> <span>History{savedWeeks.length > 0 ? ` (${savedWeeks.length})` : ""}</span>
            </button>
            <button className="btn btn-outline btn-sm" onClick={exportXlsx} disabled={loading || tasks.length === 0} title="Export this week to Excel">
              <FileSpreadsheet size={16} /> <span>Export</span>
            </button>
            <button className="btn btn-primary btn-sm" onClick={savePlan} disabled={saving || loading}>
              <Save size={16} /> <span>{saving ? "Saving…" : "Save Report"}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="wp-body">
        {loading ? (
          <div className="wp-loading">Loading report…</div>
        ) : (
          <div className="wp-sheet">
            {/* Exact Excel summary block */}
            <div className="wp-excel-summary-container">
              <table className="wp-excel-summary shadow-sm">
                <tbody>
                  <tr>
                    <td colSpan={2} className="wp-excel-title">በሳምንቱ ክትትል የሚያስፈልጋቸው ስራዎች  ({weekRange(weekStartDate)})</td>
                    <td colSpan={4} className="wp-excel-saved">{savedAt && <span className="wp-saved-chip"><CheckCircle2 size={14} /> Saved {new Date(savedAt).toLocaleString()}</span>}</td>
                  </tr>
                  <tr>
                    <td colSpan={2} className="wp-excel-title">እቅድ (የሚሸፍነው ግዜ፡ 1 ሳምንት)  ({weekRange(weekStartDate)})</td>
                    <td className="wp-excel-pct">{tasks.length > 0 ? "100.0%" : "0.0%"}</td>
                    <td className="wp-excel-label">የመንግስትን የሥራ ሰዓት አጠቃቀም  ክብደት (የ1 ቀን)</td>
                    <td className="wp-excel-val">{h6.toFixed(3)}</td>
                    <td className="wp-excel-val">{(i6 * 100).toFixed(0)}%</td>
                  </tr>
                  <tr>
                    <td colSpan={3}></td>
                    <td className="wp-excel-label">የመንግስትን የሥራ ሰዓት አጠቃቀም አፈጻጸም (የ1 ቀን)</td>
                    <td className="wp-excel-val">{h7.toFixed(3)}</td>
                    <td className="wp-excel-val"></td>
                  </tr>
                  <tr>
                    <td colSpan={3}></td>
                    <td className="wp-excel-label">እቅድ ክብደት (የ 1 ቀን)</td>
                    <td className="wp-excel-val">{h8.toFixed(1)}</td>
                    <td className="wp-excel-val">{(i8 * 100).toFixed(1)}%</td>
                  </tr>
                  <tr>
                    <td colSpan={3}></td>
                    <td className="wp-excel-label">እቅድ አፈጻጸም (የ 1 ቀን)</td>
                    <td className="wp-excel-val">{h9.toFixed(1)}</td>
                    <td className="wp-excel-val"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Excel-style formula bar (fx) — click any cell to see/edit its formula */}
            <div className="wp-fx-bar">
              <div className="wp-fx-namebox">{activeInfo?.ref || ""}</div>
              <div className="wp-fx-icon"><em>fx</em></div>
              <input
                className="wp-fx-input"
                type="text"
                value={activeInfo ? activeInfo.formula : ""}
                readOnly={!activeInfo?.editable}
                placeholder={activeInfo ? "" : "Select a cell to view its formula"}
                spellCheck={false}
                onChange={(e) => applyCellEdit(e.target.value)}
                title={activeInfo && !activeInfo.editable ? "This is a calculated cell" : "Edit the formula, e.g. =H13*80/100"}
              />
            </div>

            {/* Report table */}
            <div className="spreadsheet-container wp-table-wrap">
              <table className="spreadsheet-table wp-table">
                <thead>
                  <tr>
                    <th className="doc-rowno-head">No.</th>
                    <th style={{ minWidth: 130 }}><span className="wp-th-am">ቀን</span><span className="wp-th-en">Date</span></th>
                    <th style={{ minWidth: 90 }}><span className="wp-th-am">ሰዓት</span><span className="wp-th-en">Hours</span></th>
                    <th style={{ minWidth: 280 }}><span className="wp-th-am">ዋና ዋና ተግባራት</span><span className="wp-th-en">Main Tasks</span></th>
                    <th style={{ minWidth: 90 }}><span className="wp-th-am">እቅድ (የሳምንቱ)</span><span className="wp-th-en">Plan %</span></th>
                    <th style={{ minWidth: 120 }}><span className="wp-th-am">አፈጻጸም (የሳምንቱ)</span><span className="wp-th-en">Achievement %</span></th>
                    <th style={{ minWidth: 220 }}><span className="wp-th-am">አስተያየት</span><span className="wp-th-en">Comment / Issues</span></th>
                    <th style={{ minWidth: 95 }}><span className="wp-th-am">የስራው ክብደት</span><span className="wp-th-en">Weight</span></th>
                    <th style={{ minWidth: 130 }}><span className="wp-th-am">የአፈጻጸም ክብደት</span><span className="wp-th-en">Ach. Weight</span></th>
                    <th style={{ width: 48 }} aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task, i) => {
                    const planPct = totalWeight > 0 ? (taskWeight(task) / totalWeight) * 100 : 0;
                    const weight = taskWeight(task);
                    const achWeight = taskAchWeight(task);
                    // Achievement % = this task's ach weight as a share of total weight
                    // (the column sums to the overall achievement, like the template).
                    const achPct = totalWeight > 0 ? (achWeight / totalWeight) * 100 : 0;
                    const done = weight > 0 && achWeight >= weight - 1e-9;
                    const achEditing = isActive(task.id, "achWeight") && active?.editing;
                    return (
                      <tr key={task.id} className={done ? "wp-row-done" : ""}>
                        <td className="doc-rowno">{i + 1}</td>
                        <td className={`spreadsheet-cell ${isActive(task.id, "date") ? "wp-cell-active" : ""}`}>
                          <input className="spreadsheet-input" type="date" value={task.date}
                            onFocus={() => selectCell(task.id, "date")}
                            onChange={(e) => updateTask(task.id, "date", e.target.value)} />
                        </td>
                        <td className={`spreadsheet-cell ${isActive(task.id, "hours") ? "wp-cell-active" : ""}`}>
                          <input className="spreadsheet-input" type="number" min="0" step="0.5" value={task.hours || ""}
                            onFocus={() => selectCell(task.id, "hours")}
                            onChange={(e) => updateTask(task.id, "hours", parseFloat(e.target.value) || 0)} />
                        </td>
                        <td className={`spreadsheet-cell ${isActive(task.id, "activity") ? "wp-cell-active" : ""}`}>
                          <input className="spreadsheet-input" type="text" placeholder="Task description…" value={task.activity}
                            onFocus={() => selectCell(task.id, "activity")}
                            onChange={(e) => updateTask(task.id, "activity", e.target.value)} />
                        </td>
                        <td className={`spreadsheet-cell wp-calc wp-cell-sel ${isActive(task.id, "plan") ? "wp-cell-active" : ""}`}
                          onClick={() => selectCell(task.id, "plan")}>{planPct.toFixed(1)}%</td>
                        <td className={`spreadsheet-cell wp-calc wp-calc-strong wp-cell-sel ${isActive(task.id, "ach") ? "wp-cell-active" : ""}`}
                          style={{ color: achColor(achPct) }}
                          onClick={() => selectCell(task.id, "ach")}>{achPct.toFixed(1)}%</td>
                        <td className={`spreadsheet-cell ${isActive(task.id, "comment") ? "wp-cell-active" : ""}`}>
                          <input className="spreadsheet-input" type="text" placeholder="Result / problem…" value={task.comment}
                            onFocus={() => selectCell(task.id, "comment")}
                            onChange={(e) => updateTask(task.id, "comment", e.target.value)} />
                        </td>
                        <td className={`spreadsheet-cell wp-calc wp-cell-sel ${isActive(task.id, "weight") ? "wp-cell-active" : ""}`}
                          onClick={() => selectCell(task.id, "weight")}>{weight.toFixed(3)}</td>
                        <td className={`spreadsheet-cell wp-cell-sel ${isActive(task.id, "achWeight") ? "wp-cell-active" : ""}`}
                          onClick={() => !achEditing && selectCell(task.id, "achWeight")}
                          onDoubleClick={() => selectCell(task.id, "achWeight", true)}
                          title="Double-click to edit the formula (e.g. =H13*80/100)">
                          {achEditing ? (
                            <input
                              className="spreadsheet-input wp-ach-formula" type="text" autoFocus
                              value={task.achFormula ?? `=H${13 + i}*0/100`}
                              spellCheck={false}
                              onChange={(e) => updateTask(task.id, "achFormula", e.target.value)}
                              onBlur={() => setActive((a) => (a && a.id === task.id && a.col === "achWeight" ? { ...a, editing: false } : a))}
                              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                            />
                          ) : (
                            <span className="wp-ach-value">{achWeight.toFixed(3)}</span>
                          )}
                        </td>
                        <td className="spreadsheet-cell wp-action-cell">
                          <button type="button" className="wp-remove" onClick={() => removeTask(task.id)} title="Remove row" aria-label="Remove row">
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="wp-total-row">
                    <td className="doc-rowno" />
                    <td className="wp-total-label">Total</td>
                    <td className="wp-calc">{totalHours}</td>
                    <td />
                    <td className="wp-calc">{totalHours > 0 ? "100.0%" : "0%"}</td>
                    <td className="wp-calc" style={{ color: achievementColor }}>{achievement.toFixed(1)}%</td>
                    <td />
                    <td className="wp-calc">{totalWeight.toFixed(3)}</td>
                    <td className="wp-calc wp-calc-strong">{totalExecWeight.toFixed(3)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
              <div className="spreadsheet-footer">
                <button className="btn btn-outline btn-sm" onClick={addTask}><Plus size={16} /> Add Task</button>
                <span className="spreadsheet-tip">Click a cell to see its formula in the <strong>fx</strong> bar · double-click <strong>Ach. Weight</strong> to edit, e.g. <strong>=H13*80/100</strong></span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* History drawer — browse, open or delete saved weeks */}
      {showHistory && (
        <div className="wp-history-overlay" onClick={() => { setShowHistory(false); setConfirmDelete(""); }}>
          <aside className="wp-history-panel" onClick={(e) => e.stopPropagation()}>
            <div className="wp-history-head">
              <div>
                <h3><History size={18} /> Report History</h3>
                <p>{savedWeeks.length} saved week{savedWeeks.length === 1 ? "" : "s"}</p>
              </div>
              <button className="wp-history-close" onClick={() => { setShowHistory(false); setConfirmDelete(""); }} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="wp-history-list">
              {savedWeeks.length === 0 && (
                <div className="wp-history-empty">No saved reports yet. Save a week to see it here.</div>
              )}
              {savedWeeks.map((p) => {
                const ach = planAchievement(p);
                const hours = p.tasks.reduce((s, t) => s + (Number(t.hours) || 0), 0);
                const isOpen = p.weekStartDate === weekStartDate;
                const confirming = confirmDelete === p.weekStartDate;
                return (
                  <div key={p.weekStartDate} className={`wp-history-item ${isOpen ? "current" : ""}`}>
                    <button
                      className="wp-history-main"
                      onClick={() => { setWeekStartDate(p.weekStartDate); setShowHistory(false); setConfirmDelete(""); }}
                    >
                      <div className="wp-history-week">
                        <strong>{weekRange(p.weekStartDate)}</strong>
                        {isOpen && <span className="wp-history-badge">Current</span>}
                      </div>
                      <div className="wp-history-meta">
                        <span><Clock size={13} /> {hours} hrs</span>
                        <span>{p.tasks.length} task{p.tasks.length === 1 ? "" : "s"}</span>
                        <span className="wp-history-ach" style={{ color: achColor(ach) }}>
                          <TrendingUp size={13} /> {ach.toFixed(0)}%
                        </span>
                      </div>
                    </button>

                    {confirming ? (
                      <div className="wp-history-confirm">
                        <span>Delete?</span>
                        <button
                          className="wp-history-confirm-yes"
                          onClick={() => deletePlan(p.weekStartDate)}
                          disabled={deletingWeek === p.weekStartDate}
                        >
                          {deletingWeek === p.weekStartDate ? "…" : "Yes"}
                        </button>
                        <button className="wp-history-confirm-no" onClick={() => setConfirmDelete("")}>No</button>
                      </div>
                    ) : (
                      <button
                        className="wp-history-del"
                        onClick={() => setConfirmDelete(p.weekStartDate)}
                        title="Delete this week's report"
                        aria-label="Delete report"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
