"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AppHeader } from "@/components/AppHeader";
import { WeekPicker } from "@/components/WeekPicker";
import {
  Trash2, CheckCircle2, Clock, FileSpreadsheet, History, X,
  AlertTriangle, Save,
} from "lucide-react";
import type { AppUser } from "@/lib/logbook";
import {
  WEEKLY_HOURS, taskWeight, taskAchWeight, taskAchPercent, mondayOf, weekLabel, weekRangeDMY,
  planStats, parseISODate, toISODate,
  type WeeklyTask, type WeeklyPlan,
} from "@/lib/weekly-plan";
import { templateSheet, summarySheets, sheetName, fileSafe } from "@/lib/weekly-export";

const AUTOSAVE_MS = 2500;
// Same layout as may25weeklyPlan.xlsx: task rows start at 13, at least 13 of them.
const FIRST_ROW = 13;
const MIN_ROWS = 13;
const COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "I"] as const;
type Col = (typeof COLS)[number];

function addDays(iso: string, n: number) {
  const d = parseISODate(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

function blankTask(row: number, date = ""): WeeklyTask {
  return { id: crypto.randomUUID(), date, hours: 0, activity: "", achWeight: 0, achFormula: `=H${row}*0/100`, comment: "" };
}

const isBlank = (t: WeeklyTask) => !t.date && !t.hours && !t.activity.trim() && !t.comment.trim();

// Excel number formats used by the template.
const pct = (v: number, dp = 0) => `${(v * 100).toFixed(dp)}%`;
const fix = (v: number, dp: number) => v.toFixed(dp);
function mmddyy(iso: string) {
  const d = parseISODate(iso);
  if (!d) return "";
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
}
function excelDate(iso: string) {
  const d = parseISODate(iso);
  return d ? `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}` : "";
}

// Shows the formatted value, and the raw value/formula while focused, like a real cell.
function Cell({ name, raw, display, onInput, onFocus, multiline, className = "" }: {
  name: string; raw: string; display: string; onInput: (v: string) => void; onFocus: () => void;
  multiline?: boolean; className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const props = {
    className: `xl-input ${className}`,
    "data-cell": name,
    value: draft ?? display,
    spellCheck: false,
    onFocus: () => { setDraft(raw); onFocus(); },
    onBlur: () => setDraft(null),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setDraft(e.target.value); onInput(e.target.value); },
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => moveOnKey(e, name),
  };
  return multiline ? <textarea rows={1} {...props} /> : <input type="text" {...props} />;
}

// Enter / arrows move between rows, Shift+Enter goes up, like Excel.
function moveOnKey(e: React.KeyboardEvent<HTMLElement>, name: string) {
  const m = /^([A-Z])(\d+)$/.exec(name);
  if (!m) return;
  let row = Number(m[2]);
  if ((e.key === "Enter" && !e.shiftKey) || e.key === "ArrowDown") row++;
  else if ((e.key === "Enter" && e.shiftKey) || e.key === "ArrowUp") row--;
  else return;
  const next = document.querySelector<HTMLElement>(`[data-cell="${m[1]}${row}"]`);
  if (!next) return;
  e.preventDefault();
  next.focus();
}

export default function WeeklyPlanPage() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [weekStartDate, setWeekStartDate] = useState<string>(() => mondayOf());
  const [tasks, setTasks] = useState<WeeklyTask[]>([]);
  const [allPlans, setAllPlans] = useState<WeeklyPlan[]>([]);
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
  const [active, setActive] = useState<{ col: Col; row: number } | null>(null);

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
        // Old rows only have executionPercent; give them a formula.
        const rows = (current?.tasks || []).map((t, i) => t.achFormula
          ? { ...t, achWeight: taskAchWeight(t) }
          : { ...t, achFormula: `=H${FIRST_ROW + i}*${Math.round(taskAchPercent(t))}/100`, achWeight: taskAchWeight(t) });
        setTasks(rows);
        setSavedSnapshot(JSON.stringify(rows));
        setSaveError("");
        setSavedAt(current?.updatedAt || "");
        setLoadedWeek(`${user.username}:${weekStartDate}`);
      })
      .catch(() => setLoadedWeek(`${user.username}:${weekStartDate}`));
  }, [user, weekStartDate]);

  // Typing into an empty row below the last task fills the rows in between,
  // so the text stays where it was typed. A new row gets the day after the
  // last dated row above it, stopping at Friday.
  function editRow(i: number, patch: Partial<WeeklyTask>) {
    setSaveError("");
    setTasks((prev) => {
      const next = [...prev];
      while (next.length <= i) next.push(blankTask(FIRST_ROW + next.length));
      if (i >= prev.length && patch.date === undefined) {
        const above = parseISODate(next.slice(0, i).findLast((t) => t.date)?.date || "");
        if (above) {
          const d = toISODate(new Date(above.getFullYear(), above.getMonth(), above.getDate() + 1));
          const friday = addDays(weekStartDate, 4);
          next[i] = { ...next[i], date: d > friday ? friday : d };
        } else if (i === 0) {
          next[i] = { ...next[i], date: weekStartDate };
        }
      }
      next[i] = { ...next[i], ...patch };
      // Drop blank rows left at the end, the sheet shows empty rows anyway.
      while (next.length && isBlank(next[next.length - 1]) && next.length - 1 !== i) next.pop();
      return next;
    });
  }

  function setCell(i: number, col: Col, value: string) {
    if (col === "B") editRow(i, { date: value });
    else if (col === "C") editRow(i, { hours: Math.max(parseFloat(value) || 0, 0) });
    else if (col === "D") editRow(i, { activity: value });
    else if (col === "G") editRow(i, { comment: value });
    else if (col === "I") editRow(i, { achFormula: value });
  }

  const removeRow = (i: number) => {
    setActive(null);
    setTasks((t) => t.filter((_, j) => j !== i));
  };

  const dirty = !loading && JSON.stringify(tasks) !== savedSnapshot;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function okToLeave() {
    return !dirty || window.confirm("You have unsaved changes to this week. Leave without saving?");
  }

  // Saves what was on screen when the save started; edits made while it is
  // in flight stay dirty and go out with the next save.
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
        setSaveError(d.error || "Couldn't save. Your changes are still here, try again.");
      }
    } catch {
      setSaveError("Couldn't save, check your connection. Your changes are still here.");
    }
    savingRef.current = false;
    setSaving(false);
  }, [user, tasks, weekStartDate]);

  // A failed save waits for the next edit or a manual save, no retry loop.
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
      if (week === weekStartDate) {
        setTasks([]);
        setSavedSnapshot("[]");
        setSavedAt("");
      }
    }
    setDeletingWeek("");
    setConfirmDelete("");
  }

  const savedWeeks = [...allPlans]
    .filter((p) => p.tasks.length > 0)
    .sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate));

  const displayName = user?.fullName || user?.username || "";
  const hasPlan = planStats(tasks).totalHours > 0;

  async function exportWeek() {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const plan = { username: user?.username || "", weekStartDate, tasks, updatedAt: savedAt };
    XLSX.utils.book_append_sheet(wb, templateSheet(XLSX, plan, displayName), "Weekly Report");
    XLSX.writeFile(wb, `weekly_report_${fileSafe(user?.username || "me")}_${weekStartDate}.xlsx`);
  }

  // Summary, all tasks, then one template sheet per week.
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

  // Sheet values, computed the way the template formulas do.
  const rowCount = Math.max(MIN_ROWS, tasks.length + 1);
  const lastRow = FIRST_ROW + rowCount - 1;
  const totalRow = lastRow + 1;
  const sumRange = `SUM($H$${FIRST_ROW}:$H$${lastRow})`;
  const c12 = tasks.reduce((s, t) => s + (Number(t.hours) || 0), 0);
  const sumH = tasks.reduce((s, t) => s + taskWeight(t), 0);
  const sumI = tasks.reduce((s, t) => s + taskAchWeight(t), 0);
  const sumE = sumH > 0 ? 1 : 0;
  const sumF = sumH > 0 ? sumI / sumH : 0;
  const h6 = 8 / WEEKLY_HOURS;
  const h8 = c12 / 5;
  const range = weekRangeDMY(weekStartDate);

  function rawOf(i: number, col: Col): string {
    const t = tasks[i];
    const r = FIRST_ROW + i;
    switch (col) {
      case "B": return t?.date ? excelDate(t.date) : "";
      case "C": return t?.hours ? String(t.hours) : "";
      case "D": return t?.activity || "";
      case "E": return `=IF(H${r}="","",H${r}/${sumRange})`;
      case "F": return `=IF(I${r}="","",I${r}/SUM($H$${FIRST_ROW}:H$${lastRow}))`;
      case "G": return t?.comment || "";
      case "H": return `=IF(C${r}="","",C${r}/${WEEKLY_HOURS})`;
      case "I": return t?.achFormula || "";
      default: return "";
    }
  }

  const editable = (col: Col) => col === "C" || col === "D" || col === "G" || col === "I";
  const fxRaw = active && active.row >= FIRST_ROW && active.row <= lastRow ? rawOf(active.row - FIRST_ROW, active.col) : "";
  const focus = (col: Col, row: number) => () => setActive({ col, row });
  const sel = (col: Col, row: number) => (active?.col === col && active.row === row ? " xl-sel" : "");

  const overAchieved = tasks.filter((t) => taskAchWeight(t) > taskWeight(t) + 1e-9).length;
  const warnings = [
    ...(c12 > WEEKLY_HOURS ? [`${c12} hours entered, more than the ${WEEKLY_HOURS}-hour week.`] : []),
    ...(overAchieved ? [`Ach. weight is higher than the weight on ${overAchieved} row${overAchieved > 1 ? "s" : ""}.`] : []),
  ];

  const rows = Array.from({ length: rowCount }, (_, i) => i);

  return (
    <main className="app-layout xl-page">
      <AppHeader user={user} confirmLeave={okToLeave} />

      <header className="xl-toolbar">
        <WeekPicker value={weekStartDate} onChange={goToWeek} saved={new Set(savedWeeks.map((p) => p.weekStartDate))} />

        <div className="xl-toolbar-end">
          <span className={`xl-save ${saveError ? "error" : dirty || saving ? "pending" : "ok"}`} role="status">
            {loading ? "" : saving ? "Saving…" : saveError ? "Not saved" : dirty ? "Unsaved"
              : savedAt ? <><CheckCircle2 size={14} /> Saved {new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</> : ""}
          </span>
          {(dirty || saveError) && (
            <button className="btn btn-primary btn-sm" onClick={savePlan} disabled={saving} title="Save (Ctrl+S)">
              <Save size={15} /> <span>Save</span>
            </button>
          )}
          <button className="btn btn-outline btn-sm" onClick={() => setShowHistory(true)} disabled={loading}>
            <History size={15} /> <span>History</span>
          </button>
          <button className="btn btn-outline btn-sm" onClick={exportWeek} disabled={loading || !hasPlan} title="Download as .xlsx">
            <FileSpreadsheet size={15} /> <span>Export</span>
          </button>
        </div>
      </header>

      {loading ? (
        <div className="xl-loading">Loading…</div>
      ) : (
        <div className="xl-wrap">
          {(saveError || warnings.length > 0) && (
            <div className="xl-alerts" role="status">
              {saveError && <p className="error"><AlertTriangle size={14} /> {saveError}</p>}
              {warnings.map((w) => <p key={w}><AlertTriangle size={14} /> {w}</p>)}
            </div>
          )}

          <div className="xl-fx">
            <div className="xl-namebox">{active ? `${active.col}${active.row}` : ""}</div>
            <div className="xl-fx-icon"><em>fx</em></div>
            <input
              className="xl-fx-input" type="text" spellCheck={false}
              value={fxRaw}
              readOnly={!active || !editable(active.col) || active.row < FIRST_ROW || active.row > lastRow}
              onChange={(e) => active && setCell(active.row - FIRST_ROW, active.col, e.target.value)}
            />
          </div>

          <div className="xl-grid">
            <table className="xl-sheet">
              <colgroup>
                <col className="xl-c-hdr" />
                <col style={{ width: 42 }} /><col style={{ width: 81 }} /><col style={{ width: 118 }} />
                <col style={{ width: 363 }} /><col style={{ width: 73 }} /><col style={{ width: 73 }} />
                <col style={{ width: 286 }} /><col style={{ width: 97 }} /><col style={{ width: 92 }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="xl-corner" />
                  {COLS.map((c) => <th key={c} className={active?.col === c ? "on" : ""}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr className="xl-h25"><th>1</th><td /><td /><td /><td /><td /><td /><td /><td /><td /></tr>
                <tr className="xl-h29"><th>2</th><td /><td /><td /><td colSpan={4} /><td /><td /></tr>
                <tr className="xl-h26 xl-big">
                  <th>3</th><td /><td /><td className="b">Name:</td><td className="b">{displayName}</td><td /><td /><td /><td /><td />
                </tr>
                <tr className="xl-h10"><th>4</th><td /><td /><td /><td /><td /><td /><td /><td /><td /></tr>
                <tr className="xl-h34">
                  <th>5</th><td />
                  <td colSpan={8} className="xl-r5">በሳምንቱ ክትትል የሚያስፈልጋቸው ስራዎች  ({range})</td>
                </tr>

                <tr className="xl-sum xl-top">
                  <th>6</th><td className="xl-plain" />
                  <td colSpan={3} rowSpan={4} className="xl-l c m">እቅድ (የሚሸፍነው ግዜ፡ 1 ሳምንት)  ({range})</td>
                  <td rowSpan={4} className="c m">{pct(sumE)}</td>
                  <td colSpan={2} className="l">የመንግስትን የሥራ ሰዓት አጠቃቀም  ክብደት (የ1 ቀን)</td>
                  <td className="c t">{fix(h6, 2)}</td>
                  <td rowSpan={2} className="xl-r c m">{pct(sumI / h6)}</td>
                </tr>
                <tr className="xl-sum">
                  <th>7</th><td className="xl-plain" />
                  <td colSpan={2} className="l">የመንግስትን የሥራ ሰዓት አጠቃቀም አፈጻጸም (የ1 ቀን)</td>
                  <td className="c t">{fix(sumI, 2)}</td>
                </tr>
                <tr className="xl-sum">
                  <th>8</th><td className="xl-plain" />
                  <td colSpan={2} className="l">እቅድ ክብደት (የ 1 ቀን)</td>
                  <td className="c t">{fix(h8, 1)}</td>
                  <td rowSpan={2} className="xl-r c m">{h8 > 0 ? pct(sumI / h8, 1) : ""}</td>
                </tr>
                <tr className="xl-sum">
                  <th>9</th><td className="xl-plain" />
                  <td colSpan={2} className="l">እቅድ አፈጻጸም (የ 1 ቀን)</td>
                  <td className="c t">{fix(sumI, 1)}</td>
                </tr>

                <tr className="xl-head">
                  <th>10</th><td className="xl-plain" />
                  <td rowSpan={3} className="xl-l">Date (mm.dd.yy)</td>
                  <td rowSpan={2}>ስራው የሚፈጀው ሰዓት</td>
                  <td rowSpan={3} className="m">ዋና ዋና ተግባራት</td>
                  <td rowSpan={2}>እቅድ (የሳምንቱ)</td>
                  <td rowSpan={2}>አፈጻጸም (የሳምንቱ)</td>
                  <td rowSpan={3} className="m">አስተያየት /የተገኘ ውጤት፣ የደረሰ ጉዳት፣ ያጋጠመ ችግር.../</td>
                  <td colSpan={2} className="xl-r m">ክብደት</td>
                </tr>
                <tr className="xl-head">
                  <th>11</th><td className="xl-plain" />
                  <td rowSpan={2}>የስራው ክብደት</td>
                  <td rowSpan={2} className="xl-r">የአፈጻጸም ክብደት</td>
                </tr>
                <tr className="xl-head xl-h20">
                  <th>12</th><td className="xl-plain" />
                  <td className="b">{fix(c12, 2)}</td>
                  <td>{pct(sumE)}</td>
                  <td>{pct(sumF)}</td>
                </tr>

                {rows.map((i) => {
                  const r = FIRST_ROW + i;
                  const t = tasks[i];
                  const h = t && t.hours ? taskWeight(t) : null;
                  const iv = h != null ? taskAchWeight(t) : null;
                  const over = h != null && iv != null && iv > h + 1e-9;
                  return (
                    <tr key={r} className="xl-row">
                      <th className={active?.row === r ? "on" : ""}>
                        <span>{r}</span>
                        {t && (
                          <button type="button" className="xl-del" onClick={() => removeRow(i)} title={`Delete row ${r}`} aria-label={`Delete row ${r}`}>
                            <Trash2 size={12} />
                          </button>
                        )}
                      </th>
                      <td className="xl-plain" />
                      <td className={`xl-l c xl-date${sel("B", r)}`}>
                        <span>{t?.date ? mmddyy(t.date) : ""}</span>
                        <input type="date" data-cell={`B${r}`} value={t?.date || ""} aria-label={`B${r}`}
                          onFocus={focus("B", r)} onChange={(e) => setCell(i, "B", e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && moveOnKey(e, `B${r}`)} />
                      </td>
                      <td className={`c${sel("C", r)}`}>
                        <Cell name={`C${r}`} raw={rawOf(i, "C")} display={t?.hours ? fix(t.hours, 2) : ""} className="c"
                          onFocus={focus("C", r)} onInput={(v) => setCell(i, "C", v)} />
                      </td>
                      <td className={sel("D", r)}>
                        <Cell name={`D${r}`} raw={rawOf(i, "D")} display={t?.activity || ""} multiline
                          onFocus={focus("D", r)} onInput={(v) => setCell(i, "D", v)} />
                      </td>
                      <td className={`c b xl-calc${sel("E", r)}`} onClick={focus("E", r)}>{h != null && sumH > 0 ? pct(h / sumH) : ""}</td>
                      <td className={`c b xl-calc${sel("F", r)}`} onClick={focus("F", r)}>{iv != null && sumH > 0 ? pct(iv / sumH) : ""}</td>
                      <td className={sel("G", r)}>
                        <Cell name={`G${r}`} raw={rawOf(i, "G")} display={t?.comment || ""} multiline
                          onFocus={focus("G", r)} onInput={(v) => setCell(i, "G", v)} />
                      </td>
                      <td className={`c xl-calc${sel("H", r)}`} onClick={focus("H", r)}>{h != null ? fix(h, 4) : ""}</td>
                      <td className={`xl-r c${sel("I", r)}${over ? " xl-warn" : ""}`}>
                        <Cell name={`I${r}`} raw={rawOf(i, "I") || `=H${r}*0/100`} display={iv != null ? fix(iv, 4) : ""} className="c"
                          onFocus={focus("I", r)} onInput={(v) => setCell(i, "I", v)} />
                      </td>
                    </tr>
                  );
                })}

                <tr className="xl-total">
                  <th>{totalRow}</th><td className="xl-plain" />
                  <td className="xl-l xl-nofill" />
                  <td className="xl-nofill" />
                  <td />
                  <td className="c b">{pct(sumE)}</td>
                  <td className="c b">{pct(sumF)}</td>
                  <td />
                  <td />
                  <td className="xl-r" />
                </tr>
                <tr className="xl-after"><th>{totalRow + 1}</th><td /><td /><td /><td /><td /><td /><td /><td /><td /></tr>
              </tbody>
            </table>
          </div>
          <p className="xl-tip">Type into any empty row to add a task. In column I, write the achievement as a formula, e.g. <code>=H13*80/100</code>.</p>
        </div>
      )}

      {showHistory && (
        <div className="wp-history-overlay" onClick={() => { setShowHistory(false); setConfirmDelete(""); }}>
          <aside className="wp-history-panel" onClick={(e) => e.stopPropagation()}>
            <div className="wp-history-head">
              <div>
                <h3><History size={18} /> Report history</h3>
                <p>{savedWeeks.length} saved week{savedWeeks.length === 1 ? "" : "s"}</p>
              </div>
              <div className="wp-history-tools">
                {savedWeeks.length > 0 && (
                  <button className="btn btn-outline btn-sm" type="button" onClick={exportHistory} title="Export all weeks">
                    <FileSpreadsheet size={15} /> <span>Export all</span>
                  </button>
                )}
                <button className="wp-history-close" onClick={() => { setShowHistory(false); setConfirmDelete(""); }} aria-label="Close">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="wp-history-list">
              {savedWeeks.length === 0 && (
                <div className="wp-history-empty">No saved weeks yet.</div>
              )}
              {savedWeeks.map((p) => {
                const s = planStats(p.tasks);
                const isOpen = p.weekStartDate === weekStartDate;
                const confirming = confirmDelete === p.weekStartDate;
                return (
                  <div key={p.weekStartDate} className={`wp-history-item ${isOpen ? "current" : ""}`}>
                    <button
                      className="wp-history-main"
                      onClick={() => { goToWeek(p.weekStartDate); setShowHistory(false); setConfirmDelete(""); }}
                    >
                      <div className="wp-history-week">
                        <strong>{weekLabel(p.weekStartDate)}</strong>
                        {isOpen && <span className="wp-history-badge">Open</span>}
                      </div>
                      <div className="wp-history-meta">
                        <span><Clock size={13} /> {s.totalHours} h</span>
                        <span>{s.taskCount} task{s.taskCount === 1 ? "" : "s"}</span>
                        <span className="wp-history-ach">
                          {s.achievement.toFixed(0)}% achieved
                        </span>
                      </div>
                    </button>

                    {confirming ? (
                      <div className="wp-history-confirm">
                        <span>Delete?</span>
                        <button className="wp-history-confirm-yes" onClick={() => deletePlan(p.weekStartDate)} disabled={deletingWeek === p.weekStartDate}>
                          {deletingWeek === p.weekStartDate ? "…" : "Yes"}
                        </button>
                        <button className="wp-history-confirm-no" onClick={() => setConfirmDelete("")}>No</button>
                      </div>
                    ) : (
                      <button className="wp-history-del" onClick={() => setConfirmDelete(p.weekStartDate)} title="Delete this week" aria-label="Delete week">
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
