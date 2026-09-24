"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AppHeader } from "@/components/AppHeader";
import {
  Plus, Trash2, CheckCircle2, Clock, FileSpreadsheet, History, X,
  AlertTriangle, ChevronLeft, ChevronRight, CalendarDays, Sigma, Save,
} from "lucide-react";
import type { AppUser } from "@/lib/logbook";
import {
  WEEKLY_HOURS, taskWeight, taskAchWeight, taskAchPercent, mondayOf, addWeeks, weekLabel, weekRangeDMY,
  planStats, performanceRating, parseISODate, toISODate,
  type WeeklyTask, type WeeklyPlan,
} from "@/lib/weekly-plan";
import { templateSheet, summarySheets, sheetName, fileSafe } from "@/lib/weekly-export";

const AUTOSAVE_MS = 2500;
const QUICK_PCT = [0, 25, 50, 75, 100];

function addDays(iso: string, n: number) {
  const d = parseISODate(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

// Row numbers in the formula don't matter, the export remaps them.
const pctFormula = (pct: number) => `=H13*${pct}/100`;

function newTask(date: string): WeeklyTask {
  return { id: crypto.randomUUID(), date, hours: 0, activity: "", achWeight: 0, achFormula: pctFormula(0), comment: "" };
}

// Formulas the % control wrote itself. Anything else was typed by hand.
function isPlainPct(formula = "") {
  return /^=?\s*H\d*\s*\*\s*\d+(\.\d+)?\s*\/\s*100\s*$/i.test(formula.trim()) || !formula.trim();
}

function achTone(pct: number) {
  return pct >= 90 ? "good" : pct >= 50 ? "fair" : "low";
}

// Empty dates sort last so unscheduled work sits at the bottom.
function byDate(a: WeeklyTask, b: WeeklyTask) {
  return (a.date || "9999").localeCompare(b.date || "9999");
}

const dayName = (iso: string) => parseISODate(iso)?.toLocaleDateString("en-GB", { weekday: "long" }) || "";
const dayShort = (iso: string) => parseISODate(iso)?.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) || "";

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
  const [formulaOpen, setFormulaOpen] = useState<string>("");
  const [focusId, setFocusId] = useState<string>("");

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
        const rows = current && current.tasks.length > 0
          ? current.tasks.map((t) => {
              if (t.achFormula) return { ...t, achWeight: taskAchWeight(t) };
              const pct = Math.round(taskAchPercent(t));
              return { ...t, achFormula: pctFormula(pct), achWeight: taskAchWeight(t) };
            })
          : [newTask(weekStartDate)];
        setTasks(rows);
        setSavedSnapshot(JSON.stringify(rows));
        setSaveError("");
        setSavedAt(current?.updatedAt || "");
        setLoadedWeek(`${user.username}:${weekStartDate}`);
      })
      .catch(() => setLoadedWeek(`${user.username}:${weekStartDate}`));
  }, [user, weekStartDate]);

  // New task goes after the last one on that day, so export rows stay in date order.
  function addTask(date: string) {
    const t = newTask(date);
    setTasks((prev) => {
      const at = prev.findLastIndex((x) => x.date && x.date <= date);
      const next = [...prev];
      next.splice(at + 1, 0, t);
      return next;
    });
    setFocusId(t.id);
  }

  const removeTask = (id: string) => setTasks((t) => t.filter((x) => x.id !== id));

  const updateTask = (id: string, patch: Partial<WeeklyTask>) => {
    setSaveError("");
    setTasks((prev) => {
      const next = prev.map((x) => (x.id === id ? { ...x, ...patch } : x));
      return patch.date !== undefined ? [...next].sort(byDate) : next;
    });
  };

  const setPct = (id: string, pct: number) =>
    updateTask(id, { achFormula: pctFormula(Math.min(Math.max(Math.round(pct), 0), 100)) });

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
    setFormulaOpen("");
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
        const fresh = [newTask(weekStartDate)];
        setTasks(fresh);
        setSavedSnapshot(JSON.stringify(fresh));
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
  const thisWeek = mondayOf();

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

  const stats = planStats(tasks);
  const hasPlan = stats.taskCount > 0 && stats.totalHours > 0;
  const rating = performanceRating(stats.achievement, hasPlan);

  // Same numbers as the top block of the official template (H6..I9).
  const dayWeight = 8 / WEEKLY_HOURS;
  const dayHours = stats.totalHours / 5;
  const official = [
    { am: "የመንግስትን የሥራ ሰዓት አጠቃቀም ክብደት (የ1 ቀን)", value: dayWeight.toFixed(3), pct: `${((stats.totalAchWeight / dayWeight) * 100).toFixed(0)}%` },
    { am: "የመንግስትን የሥራ ሰዓት አጠቃቀም አፈጻጸም (የ1 ቀን)", value: stats.totalAchWeight.toFixed(3), pct: "" },
    { am: "እቅድ ክብደት (የ 1 ቀን)", value: dayHours.toFixed(1), pct: dayHours > 0 ? `${((stats.totalAchWeight / dayHours) * 100).toFixed(1)}%` : "0.0%" },
    { am: "እቅድ አፈጻጸም (የ 1 ቀን)", value: stats.totalAchWeight.toFixed(1), pct: "" },
  ];

  const overAchieved = tasks.filter((t) => taskAchWeight(t) > taskWeight(t) + 1e-9).length;
  const warnings = [
    ...(stats.totalHours > WEEKLY_HOURS ? [`${stats.totalHours} hours planned, more than the ${WEEKLY_HOURS}-hour week.`] : []),
    ...(overAchieved ? [`${overAchieved} task${overAchieved > 1 ? "s are" : " is"} over 100% done. Check the formula.`] : []),
  ];

  // Mon..Fri always show; any other dates in the data get their own group.
  const weekDays = [0, 1, 2, 3, 4].map((n) => addDays(weekStartDate, n));
  const extraDays = [...new Set(tasks.map((t) => t.date).filter((d) => d && !weekDays.includes(d)))].sort();
  const groups = [...weekDays, ...extraDays];
  const unscheduled = tasks.filter((t) => !t.date);
  const today = toISODate(new Date());

  function renderTask(task: WeeklyTask) {
    const w = taskWeight(task);
    const pct = taskAchPercent(task);
    const custom = !isPlainPct(task.achFormula);
    const showFormula = formulaOpen === task.id || custom;
    return (
      <li key={task.id} className={`wk-task ${w > 0 && pct >= 100 - 1e-6 ? "is-done" : ""}`}>
        <div className="wk-task-main">
          <textarea
            className="wk-task-title" rows={1} placeholder="What needs doing?"
            value={task.activity} autoFocus={focusId === task.id}
            onChange={(e) => updateTask(task.id, { activity: e.target.value })}
          />
          <input
            className="wk-task-note" type="text" placeholder="Result or problem (optional)"
            value={task.comment} onChange={(e) => updateTask(task.id, { comment: e.target.value })}
          />
        </div>

        <div className="wk-task-side">
          <label className="wk-hours" title={`Weight ${w.toFixed(3)} of the week`}>
            <Clock size={14} />
            <input type="number" min="0" step="0.5" value={task.hours || ""} placeholder="0" aria-label="Hours"
              onChange={(e) => updateTask(task.id, { hours: parseFloat(e.target.value) || 0 })} />
            <span>h</span>
          </label>

          <select className="wk-day-select" value={task.date} aria-label="Day"
            onChange={(e) => updateTask(task.id, { date: e.target.value })}>
            {weekDays.map((d) => <option key={d} value={d}>{dayName(d).slice(0, 3)} {dayShort(d)}</option>)}
            {task.date && !weekDays.includes(task.date) && <option value={task.date}>{dayShort(task.date)}</option>}
            <option value="">No day</option>
          </select>

          <div className="wk-task-actions">
            <button type="button" className={`wk-icon-btn ${showFormula ? "on" : ""}`} title="Edit as a formula"
              aria-label="Edit as a formula" onClick={() => setFormulaOpen(formulaOpen === task.id ? "" : task.id)}>
              <Sigma size={15} />
            </button>
            <button type="button" className="wk-icon-btn danger" onClick={() => removeTask(task.id)} title="Remove task" aria-label="Remove task">
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        <div className="wk-task-progress">
          <div className="wk-pct-chips" role="group" aria-label="Done">
            {QUICK_PCT.map((p) => (
              <button key={p} type="button" className={Math.round(pct) === p && !custom ? "on" : ""}
                onClick={() => setPct(task.id, p)}>{p}%</button>
            ))}
          </div>
          <div className="wk-bar" data-tone={achTone(pct)}><span style={{ width: `${Math.min(pct, 100)}%` }} /></div>
          <span className="wk-pct-value" data-tone={achTone(pct)}>{pct.toFixed(0)}%</span>
        </div>

        {showFormula && (
          <div className="wk-formula">
            <label>
              <span>Ach. weight</span>
              <input type="text" spellCheck={false} value={task.achFormula ?? ""} placeholder="=H13*80/100"
                onChange={(e) => updateTask(task.id, { achFormula: e.target.value })} />
            </label>
            <small>H is this task&apos;s weight ({w.toFixed(3)}), C its hours. Result: {taskAchWeight(task).toFixed(3)}</small>
          </div>
        )}
      </li>
    );
  }

  return (
    <main className="app-layout wk-page">
      <AppHeader user={user} confirmLeave={okToLeave} />

      <header className="wk-bar-top">
        <div className="wk-heading">
          <h1>Weekly plan</h1>
          <p>{displayName}{displayName && " · "}{weekRangeDMY(weekStartDate)}</p>
        </div>

        <div className="wp-weeknav" role="group" aria-label="Week">
          <button type="button" className="wp-weeknav-btn" onClick={() => goToWeek(addWeeks(weekStartDate, -1))} aria-label="Previous week"><ChevronLeft size={18} /></button>
          <label className="wp-weeknav-label" title="Pick any day to open its week">
            <CalendarDays size={16} />
            <span><small>Week of</small>{weekLabel(weekStartDate)}</span>
            <input type="date" value={weekStartDate} aria-label="Pick a week" onChange={(e) => goToWeek(mondayOf(e.target.value))} />
          </label>
          <button type="button" className="wp-weeknav-btn" onClick={() => goToWeek(addWeeks(weekStartDate, 1))} aria-label="Next week"><ChevronRight size={18} /></button>
        </div>

        <div className="wk-top-actions">
          {weekStartDate !== thisWeek && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => goToWeek(thisWeek)}>This week</button>
          )}
          <span className={`wk-save ${saveError ? "error" : dirty || saving ? "pending" : "ok"}`} role="status">
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
          <button className="btn btn-outline btn-sm" onClick={exportWeek} disabled={loading || !hasPlan} title="Download in the official Excel template">
            <FileSpreadsheet size={15} /> <span>Export</span>
          </button>
        </div>
      </header>

      {loading ? (
        <div className="wk-loading">Loading…</div>
      ) : (
        <div className="wk-layout">
          <aside className="wk-summary">
            <div className="wk-score" data-tone={hasPlan ? achTone(stats.achievement) : "none"}>
              <div className="wk-ring" style={{ ["--p" as string]: Math.min(stats.achievement, 100) }}>
                <strong>{stats.achievement.toFixed(0)}<small>%</small></strong>
              </div>
              <div>
                <span className="wk-label">Achieved</span>
                <b>{rating.label}</b>
              </div>
            </div>

            <dl className="wk-figures">
              <div>
                <dt>Hours</dt>
                <dd className={stats.totalHours > WEEKLY_HOURS ? "over" : ""}>{stats.totalHours}<small> / {WEEKLY_HOURS}</small></dd>
              </div>
              <div>
                <dt>Tasks done</dt>
                <dd>{stats.completed}<small> / {stats.taskCount}</small></dd>
              </div>
              <div>
                <dt>Weight</dt>
                <dd>{stats.totalWeight.toFixed(3)}</dd>
              </div>
              <div>
                <dt>Ach. weight</dt>
                <dd>{stats.totalAchWeight.toFixed(3)}</dd>
              </div>
            </dl>
            <div className="wk-hours-meter" aria-hidden>
              <span style={{ width: `${Math.min((stats.totalHours / WEEKLY_HOURS) * 100, 100)}%` }} />
            </div>

            <details className="wk-official">
              <summary>Template figures</summary>
              <table>
                <tbody>
                  {official.map((r) => (
                    <tr key={r.am}><th>{r.am}</th><td>{r.value}</td><td>{r.pct}</td></tr>
                  ))}
                </tbody>
              </table>
            </details>
          </aside>

          <section className="wk-days">
            {(saveError || warnings.length > 0) && (
              <div className="wk-alerts" role="status">
                {saveError && <p className="error"><AlertTriangle size={15} /> {saveError}</p>}
                {warnings.map((w) => <p key={w}><AlertTriangle size={15} /> {w}</p>)}
              </div>
            )}

            {groups.map((day) => {
              const dayTasks = tasks.filter((t) => t.date === day);
              const hours = dayTasks.reduce((s, t) => s + (Number(t.hours) || 0), 0);
              const outside = !weekDays.includes(day);
              return (
                <div key={day} className={`wk-day ${day === today ? "is-today" : ""} ${outside ? "is-outside" : ""}`}>
                  <div className="wk-day-head">
                    <div className="wk-day-name">
                      <strong>{dayName(day)}</strong>
                      <span>{dayShort(day)}{outside && " · outside this week"}</span>
                    </div>
                    {hours > 0 && <span className="wk-day-hours">{hours} h</span>}
                  </div>
                  {dayTasks.length > 0 && <ul className="wk-tasks">{dayTasks.map(renderTask)}</ul>}
                  <button type="button" className="wk-add" onClick={() => addTask(day)}>
                    <Plus size={15} /> Add task
                  </button>
                </div>
              );
            })}

            {unscheduled.length > 0 && (
              <div className="wk-day is-outside">
                <div className="wk-day-head">
                  <div className="wk-day-name"><strong>No day set</strong></div>
                </div>
                <ul className="wk-tasks">{unscheduled.map(renderTask)}</ul>
              </div>
            )}
          </section>
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
              <div className="wk-history-tools">
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
                        <span className="wp-history-ach" data-tone={achTone(s.achievement)}>
                          {s.achievement.toFixed(0)}% · {performanceRating(s.achievement).label}
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
