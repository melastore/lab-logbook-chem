"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AppHeader } from "@/components/AppHeader";
import {
  Save, Plus, Trash2, CheckCircle2, TrendingUp, Clock, FileSpreadsheet, History, X,
  AlertTriangle, ChevronLeft, ChevronRight, CalendarDays,
} from "lucide-react";
import type { AppUser } from "@/lib/logbook";
import {
  WEEKLY_HOURS, taskWeight, taskAchWeight, mondayOf, addWeeks, weekLabel, weekRangeDMY,
  planStats, performanceRating,
  type WeeklyTask, type WeeklyPlan,
} from "@/lib/weekly-plan";
import { templateSheet, summarySheets, sheetName, fileSafe } from "@/lib/weekly-export";

const weekRange = (weekStart: string) => weekRangeDMY(weekStart);
const AUTOSAVE_MS = 2500;

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
  const [weekStartDate, setWeekStartDate] = useState<string>(() => mondayOf());
  const [tasks, setTasks] = useState<WeeklyTask[]>([]);
  const [allPlans, setAllPlans] = useState<WeeklyPlan[]>([]);
  // Loading is derived: the week is loading until its data has arrived.
  const [loadedWeek, setLoadedWeek] = useState<string>("");
  const loading = !user || loadedWeek !== `${user.username}:${weekStartDate}`;
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string>("");
  const [saveError, setSaveError] = useState("");
  // Tasks as last loaded or saved; anything different is unsaved work.
  const [savedSnapshot, setSavedSnapshot] = useState("");
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
        setSavedSnapshot(JSON.stringify(rows));
        setSaveError("");
        setSavedAt(current?.updatedAt || "");
        setLoadedWeek(`${user.username}:${weekStartDate}`);
      })
      .catch(() => setLoadedWeek(`${user.username}:${weekStartDate}`));
  }, [user, weekStartDate]);

  const addTask = () => setTasks((t) => [...t, newTask(weekStartDate, t.length)]);
  const removeTask = (id: string) => setTasks((t) => t.filter((x) => x.id !== id));
  const updateTask = (id: string, field: keyof WeeklyTask, value: string | number) => {
    setSaveError("");
    setTasks((t) => t.map((x) => (x.id === id ? { ...x, [field]: value } : x)));
  };

  const dirty = !loading && JSON.stringify(tasks) !== savedSnapshot;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Switching week or leaving replaces the sheet, so check first.
  function okToLeave() {
    return !dirty || window.confirm("You have unsaved changes to this week. Leave without saving?");
  }

  // Saves exactly what was on screen when the save started; edits made while
  // it is in flight stay dirty and get picked up by the next save.
  const savingRef = useRef(false);
  const savePlan = useCallback(async () => {
    if (!user || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError("");
    const snapshot = JSON.stringify(tasks);
    const week = weekStartDate;
    try {
      const res = await fetch("/api/weekly-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.username, weekStartDate: week, tasks }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.plan) {
        const saved = d.plan as WeeklyPlan;
        setSavedAt(saved.updatedAt);
        setSavedSnapshot(snapshot);
        setAllPlans((prev) => [...prev.filter((p) => p.weekStartDate !== week), saved]);
      } else {
        setSaveError(d.error || "Couldn't save. Your changes are still here — try again.");
      }
    } catch {
      setSaveError("Couldn't save — check your connection. Your changes are still here.");
    }
    savingRef.current = false;
    setSaving(false);
  }, [user, tasks, weekStartDate]);

  // Autosave shortly after typing stops. A failed save waits for the next edit
  // (or a manual save) instead of retrying in a loop.
  useEffect(() => {
    if (!dirty || saving || saveError) return;
    const t = setTimeout(savePlan, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [dirty, saving, saveError, savePlan]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (dirty) savePlan(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, savePlan]);

  function goToWeek(week: string) {
    if (!week || week === weekStartDate || !okToLeave()) return;
    setActive(null);
    setWeekStartDate(week);
  }

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
        const fresh = [newTask(weekStartDate, 0)];
        setTasks(fresh);
        setSavedSnapshot(JSON.stringify(fresh));
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

  const planAchievement = (p: WeeklyPlan) => planStats(p.tasks).achievement;
  const displayName = user?.fullName || user?.username || "";

  const stats = planStats(tasks);
  const hasPlan = stats.taskCount > 0 && stats.totalHours > 0;
  const historyAvg = savedWeeks.length
    ? savedWeeks.reduce((sum, p) => sum + planAchievement(p), 0) / savedWeeks.length : 0;
  const thisWeek = mondayOf();

  // This week in the official template layout.
  async function exportWeek() {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const plan = { username: user?.username || "", weekStartDate, tasks, updatedAt: savedAt };
    XLSX.utils.book_append_sheet(wb, templateSheet(XLSX, plan, displayName), "Weekly Report");
    XLSX.writeFile(wb, `weekly_report_${fileSafe(user?.username || "me")}_${weekStartDate}.xlsx`);
  }

  // Every saved week: a summary, all tasks, then one template sheet per week.
  async function exportHistory() {
    if (savedWeeks.length === 0) return;
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const { summary, detail } = summarySheets(XLSX, savedWeeks, () => displayName);
    const used = new Set<string>();
    XLSX.utils.book_append_sheet(wb, summary, sheetName("Summary", used));
    XLSX.utils.book_append_sheet(wb, detail, sheetName("All tasks", used));
    for (const p of savedWeeks) XLSX.utils.book_append_sheet(wb, templateSheet(XLSX, p, displayName), sheetName(p.weekStartDate, used));
    XLSX.writeFile(wb, `weekly_history_${fileSafe(user?.username || "me")}.xlsx`);
  }

  // ── Automatic calculations (mirror the Excel formulas) ──
  const totalHours = tasks.reduce((s, t) => s + (Number(t.hours) || 0), 0);
  const totalWeight = totalHours / WEEKLY_HOURS;                       // Σ work weight
  const totalExecWeight = tasks.reduce((s, t) => s + taskAchWeight(t), 0);
  // Overall weekly achievement: hours-weighted average of completion.
  const achievement = totalWeight > 0 ? (totalExecWeight / totalWeight) * 100 : 0;

  const achievementColor = achColor(achievement);

  // Soft checks — they warn but never block saving.
  const overAchieved = tasks
    .map((t, i) => ({ i, over: taskAchWeight(t) > taskWeight(t) + 1e-9 }))
    .filter((x) => x.over)
    .map((x) => x.i + 1);
  const warnings = [
    ...(totalHours > WEEKLY_HOURS ? [`Total hours are ${totalHours}, more than the ${WEEKLY_HOURS}-hour week.`] : []),
    ...(overAchieved.length
      ? [`Ach. Weight is higher than the task's Weight on row${overAchieved.length > 1 ? "s" : ""} ${overAchieved.join(", ")}.`]
      : []),
  ];

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
    <main className="app-layout wp-page">
      <AppHeader user={user} confirmLeave={okToLeave} />
      <header className="wp-topbar">
        <div className="wp-topbar-left">
          <div className="wp-title-group">
            <h1 className="wp-title">Weekly Plan</h1>
            <span className="wp-title-sub">{displayName}</span>
          </div>
        </div>
        <div className="wp-topbar-right">
          <div className="wp-weeknav" role="group" aria-label="Week">
            <button type="button" className="wp-weeknav-btn" onClick={() => goToWeek(addWeeks(weekStartDate, -1))} aria-label="Previous week" title="Previous week"><ChevronLeft size={18} /></button>
            <label className="wp-weeknav-label" title="Pick any day — the week starting that Monday opens">
              <CalendarDays size={16} />
              <span><small>Week of</small>{weekLabel(weekStartDate)}</span>
              <input type="date" value={weekStartDate} aria-label="Pick a week"
                onChange={(e) => goToWeek(mondayOf(e.target.value))} />
            </label>
            <button type="button" className="wp-weeknav-btn" onClick={() => goToWeek(addWeeks(weekStartDate, 1))} aria-label="Next week" title="Next week"><ChevronRight size={18} /></button>
            {weekStartDate !== thisWeek && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => goToWeek(thisWeek)}>This week</button>
            )}
          </div>
          <div className="wp-topbar-actions">
            <span className={`wp-save-state ${saveError ? "error" : dirty || saving ? "pending" : "ok"}`} role="status">
              {loading ? "" : saving ? "Saving…" : saveError ? "Not saved" : dirty ? "Unsaved changes" : savedAt ? <><CheckCircle2 size={14} /> Saved {new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</> : "Not saved yet"}
            </span>
            <button className="btn btn-outline btn-sm" onClick={() => setShowHistory(true)} disabled={loading}>
              <History size={16} /> <span>History{savedWeeks.length > 0 ? ` (${savedWeeks.length})` : ""}</span>
            </button>
            <button className="btn btn-outline btn-sm" onClick={exportWeek} disabled={loading || !hasPlan} title="Download this week as the official Excel template">
              <FileSpreadsheet size={16} /> <span>Export</span>
            </button>
            <button className="btn btn-primary btn-sm" onClick={savePlan} disabled={saving || loading || !dirty} title="Save (Ctrl+S)">
              <Save size={16} /> <span>{saving ? "Saving…" : "Save"}</span>
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
                    <td colSpan={4} className="wp-excel-saved" />
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

            {(saveError || warnings.length > 0) && (
              <div className="wp-warnings" role="status">
                {saveError && <p className="wp-warning wp-warning-error"><AlertTriangle size={15} /> {saveError}</p>}
                {warnings.map((w) => <p key={w} className="wp-warning"><AlertTriangle size={15} /> {w}</p>)}
              </div>
            )}

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
                        <td className={`spreadsheet-cell wp-cell-sel ${isActive(task.id, "achWeight") ? "wp-cell-active" : ""} ${achWeight > weight + 1e-9 ? "wp-cell-warn" : ""}`}
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
                    <td className="wp-calc" style={totalHours > WEEKLY_HOURS ? { color: "var(--error)" } : undefined}>{totalHours}</td>
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

            {savedWeeks.length > 0 && (
              <div className="wp-trend">
                <div className="wp-trend-head">
                  <span>Achievement trend</span>
                  <span>Average <strong>{historyAvg.toFixed(0)}%</strong></span>
                </div>
                <div className="wp-trend-bars">
                  {[...savedWeeks].slice(0, 12).reverse().map((p) => {
                    const a = planAchievement(p);
                    return (
                      <button key={p.weekStartDate} type="button" className={`wp-trend-bar ${p.weekStartDate === weekStartDate ? "current" : ""}`}
                        title={`${weekLabel(p.weekStartDate)}: ${a.toFixed(0)}%`}
                        onClick={() => { goToWeek(p.weekStartDate); setShowHistory(false); }}>
                        <span style={{ height: `${Math.max(Math.min(a, 100), 3)}%`, background: achColor(a) }} />
                      </button>
                    );
                  })}
                </div>
                <button className="btn btn-outline btn-sm" type="button" onClick={exportHistory}>
                  <FileSpreadsheet size={15} /> <span>Export all weeks</span>
                </button>
              </div>
            )}

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
                      onClick={() => {
                        if (p.weekStartDate !== weekStartDate && !okToLeave()) return;
                        setActive(null); setWeekStartDate(p.weekStartDate); setShowHistory(false); setConfirmDelete("");
                      }}
                    >
                      <div className="wp-history-week">
                        <strong>{weekLabel(p.weekStartDate)}</strong>
                        {isOpen && <span className="wp-history-badge">Current</span>}
                      </div>
                      <div className="wp-history-meta">
                        <span><Clock size={13} /> {hours} hrs</span>
                        <span>{p.tasks.length} task{p.tasks.length === 1 ? "" : "s"}</span>
                        <span className="wp-history-ach" style={{ color: achColor(ach) }}>
                          <TrendingUp size={13} /> {ach.toFixed(0)}% · {performanceRating(ach).label}
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
