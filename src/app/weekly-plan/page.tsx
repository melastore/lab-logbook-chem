"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Plus, Trash2, CheckCircle2, TrendingUp, Clock, Target, FileSpreadsheet } from "lucide-react";
import type { AppUser } from "@/lib/logbook";
import type { WeeklyTask, WeeklyPlan } from "@/lib/weekly-plan";

// Standard government work week used to weight each task (8h × 5 days).
const WEEKLY_HOURS = 40;

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

function newTask(date: string): WeeklyTask {
  return { id: crypto.randomUUID(), date, hours: 0, activity: "", executionPercent: 0, comment: "" };
}

export default function WeeklyPlanPage() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [weekStartDate, setWeekStartDate] = useState<string>(getMonday());
  const [tasks, setTasks] = useState<WeeklyTask[]>([]);
  const [allPlans, setAllPlans] = useState<WeeklyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string>("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => { if (d.user) setUser(d.user); });
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetch(`/api/weekly-plan?username=${user.username}`)
      .then((r) => r.json())
      .then((d) => {
        const plans = (d.plans as WeeklyPlan[]) || [];
        setAllPlans(plans);
        const current = plans.find((p) => p.weekStartDate === weekStartDate);
        setTasks(current && current.tasks.length > 0 ? current.tasks : [newTask(weekStartDate)]);
        setSavedAt(current?.updatedAt || "");
        setLoading(false);
      });
  }, [user, weekStartDate]);

  const addTask = () => setTasks((t) => [...t, newTask(weekStartDate)]);
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

  // Saved weeks (newest first) for the history dropdown — many will pile up over
  // time, so this stays compact and lets the analyst jump back to any week.
  const savedWeeks = [...allPlans]
    .filter((p) => p.tasks.length > 0)
    .sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate));

  // Export the current week's report to a single-sheet .xlsx that mirrors the
  // printed plan/report layout (xlsx is loaded lazily to keep it out of the bundle).
  async function exportXlsx() {
    const XLSX = await import("xlsx");
    const aoa: (string | number)[][] = [
      ["Name", user?.fullName || user?.username || ""],
      ["Week", weekRange(weekStartDate)],
      [],
      ["No.", "Date", "Hours", "Main Tasks", "Plan %", "Achievement %", "Comment / Issues", "Weight", "Ach. Weight"],
    ];
    tasks.forEach((t, i) => {
      const hours = Number(t.hours) || 0;
      const exec = Number(t.executionPercent) || 0;
      const planPct = totalHours > 0 ? (hours / totalHours) * 100 : 0;
      const weight = hours / WEEKLY_HOURS;
      aoa.push([
        i + 1, t.date || "", hours, t.activity || "",
        Number(planPct.toFixed(1)), exec, t.comment || "",
        Number(weight.toFixed(3)), Number((weight * (exec / 100)).toFixed(3)),
      ]);
    });
    aoa.push([
      "", "Total", totalHours, "", totalHours > 0 ? 100 : 0,
      Number(achievement.toFixed(1)), "", Number(totalWeight.toFixed(3)), Number(totalExecWeight.toFixed(3)),
    ]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 5 }, { wch: 12 }, { wch: 7 }, { wch: 40 }, { wch: 8 }, { wch: 14 }, { wch: 32 }, { wch: 8 }, { wch: 11 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Weekly Report");
    const safe = (user?.username || "report").replace(/[^a-z0-9]/gi, "_");
    XLSX.writeFile(wb, `weekly_report_${safe}_${weekStartDate}.xlsx`);
  }

  // ── Automatic calculations (mirror the Excel formulas) ──
  const totalHours = tasks.reduce((s, t) => s + (Number(t.hours) || 0), 0);
  const totalWeight = totalHours / WEEKLY_HOURS;                       // Σ work weight
  const totalExecWeight = tasks.reduce(
    (s, t) => s + ((Number(t.hours) || 0) / WEEKLY_HOURS) * ((Number(t.executionPercent) || 0) / 100), 0);
  // Overall weekly achievement: hours-weighted average of completion.
  const achievement = totalWeight > 0 ? (totalExecWeight / totalWeight) * 100 : 0;
  const completed = tasks.filter((t) => (Number(t.executionPercent) || 0) >= 100).length;

  const achievementColor =
    achievement >= 90 ? "var(--success)" : achievement >= 50 ? "var(--tertiary)" : "var(--primary)";

  return (
    <main className="wp-page">
      <header className="wp-topbar">
        <div className="wp-topbar-left">
          <Link href="/" className="btn btn-outline btn-sm"><ArrowLeft size={16} /> Back</Link>
          <h1 className="wp-title">Weekly Plan &amp; Report</h1>
        </div>
        <div className="wp-topbar-right">
          {savedWeeks.length > 0 && (
            <label className="wp-week-picker">
              <span>History</span>
              <select className="input-modern" value={savedWeeks.some((p) => p.weekStartDate === weekStartDate) ? weekStartDate : ""}
                onChange={(e) => e.target.value && setWeekStartDate(e.target.value)} style={{ minWidth: 210 }}>
                <option value="">{savedWeeks.length} saved week{savedWeeks.length === 1 ? "" : "s"}…</option>
                {savedWeeks.map((p) => <option key={p.weekStartDate} value={p.weekStartDate}>{weekRange(p.weekStartDate)}</option>)}
              </select>
            </label>
          )}
          <label className="wp-week-picker">
            <span>Week of</span>
            <input type="date" className="input-modern" value={weekStartDate}
              onChange={(e) => setWeekStartDate(e.target.value)} />
          </label>
          <button className="btn btn-outline btn-sm" onClick={exportXlsx} disabled={loading || tasks.length === 0} title="Export this week to Excel">
            <FileSpreadsheet size={16} /> Export
          </button>
          <button className="btn btn-primary btn-sm" onClick={savePlan} disabled={saving || loading}>
            <Save size={16} /> {saving ? "Saving…" : "Save Report"}
          </button>
        </div>
      </header>

      <div className="wp-body">
        {loading ? (
          <div className="wp-loading">Loading report…</div>
        ) : (
          <div className="wp-sheet">
            {/* Report heading */}
            <div className="wp-sheet-head">
              <div className="wp-sheet-meta">
                <div className="wp-meta-row"><span className="wp-meta-label">Name</span><strong>{user?.fullName || user?.username || "—"}</strong></div>
                <h2 className="wp-sheet-heading">በሳምንቱ ክትትል የሚያስፈልጋቸው ስራዎች</h2>
                <p className="wp-sheet-sub">Tasks requiring follow-up this week · {weekRange(weekStartDate)}</p>
              </div>
              {savedAt && <span className="wp-saved-chip"><CheckCircle2 size={14} /> Saved {new Date(savedAt).toLocaleString()}</span>}
            </div>

            {/* Summary cards */}
            <div className="wp-summary">
              <div className="wp-stat">
                <div className="wp-stat-icon"><Clock size={18} /></div>
                <div className="wp-stat-body">
                  <span className="wp-stat-label">Total Hours · ጠቅላላ ሰዓት</span>
                  <strong className="wp-stat-value">{totalHours} <small>hrs</small></strong>
                </div>
              </div>
              <div className="wp-stat">
                <div className="wp-stat-icon"><Target size={18} /></div>
                <div className="wp-stat-body">
                  <span className="wp-stat-label">Plan Coverage · እቅድ</span>
                  <strong className="wp-stat-value">{totalHours > 0 ? "100" : "0"}<small>%</small></strong>
                </div>
              </div>
              <div className="wp-stat wp-stat-accent" style={{ "--accent": achievementColor } as React.CSSProperties}>
                <div className="wp-stat-icon"><TrendingUp size={18} /></div>
                <div className="wp-stat-body">
                  <span className="wp-stat-label">Overall Achievement · አፈጻጸም</span>
                  <strong className="wp-stat-value" style={{ color: achievementColor }}>{achievement.toFixed(1)}<small>%</small></strong>
                  <div className="wp-progress"><span style={{ width: `${Math.min(achievement, 100)}%`, background: achievementColor }} /></div>
                  <span className="wp-stat-note">{completed} of {tasks.length} goals completed</span>
                </div>
              </div>
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
                    <th style={{ minWidth: 90 }}><span className="wp-th-am">እቅድ</span><span className="wp-th-en">Plan %</span></th>
                    <th style={{ minWidth: 170 }}><span className="wp-th-am">አፈጻጸም</span><span className="wp-th-en">Achievement %</span></th>
                    <th style={{ minWidth: 220 }}><span className="wp-th-am">አስተያየት</span><span className="wp-th-en">Comment / Issues</span></th>
                    <th style={{ minWidth: 95 }}><span className="wp-th-am">የስራው ክብደት</span><span className="wp-th-en">Weight</span></th>
                    <th style={{ minWidth: 110 }}><span className="wp-th-am">የአፈጻጸም ክብደት</span><span className="wp-th-en">Ach. Weight</span></th>
                    <th style={{ width: 48 }} aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task, i) => {
                    const hours = Number(task.hours) || 0;
                    const exec = Number(task.executionPercent) || 0;
                    const planPct = totalHours > 0 ? (hours / totalHours) * 100 : 0;
                    const weight = hours / WEEKLY_HOURS;
                    const execWeight = weight * (exec / 100);
                    const done = exec >= 100;
                    return (
                      <tr key={task.id} className={done ? "wp-row-done" : ""}>
                        <td className="doc-rowno">{i + 1}</td>
                        <td className="spreadsheet-cell">
                          <input className="spreadsheet-input" type="date" value={task.date}
                            onChange={(e) => updateTask(task.id, "date", e.target.value)} />
                        </td>
                        <td className="spreadsheet-cell">
                          <input className="spreadsheet-input" type="number" min="0" step="0.5" value={task.hours}
                            onChange={(e) => updateTask(task.id, "hours", parseFloat(e.target.value) || 0)} />
                        </td>
                        <td className="spreadsheet-cell">
                          <input className="spreadsheet-input" type="text" placeholder="Task description…" value={task.activity}
                            onChange={(e) => updateTask(task.id, "activity", e.target.value)} />
                        </td>
                        <td className="spreadsheet-cell wp-calc">{planPct.toFixed(1)}%</td>
                        <td className="spreadsheet-cell">
                          <div className="wp-ach-cell">
                            <input className="spreadsheet-input wp-ach-input" type="number" min="0" max="100" value={task.executionPercent}
                              onChange={(e) => updateTask(task.id, "executionPercent", Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))} />
                            <span className="wp-ach-pct">%</span>
                          </div>
                        </td>
                        <td className="spreadsheet-cell">
                          <input className="spreadsheet-input" type="text" placeholder="Result / problem…" value={task.comment}
                            onChange={(e) => updateTask(task.id, "comment", e.target.value)} />
                        </td>
                        <td className="spreadsheet-cell wp-calc">{weight.toFixed(3)}</td>
                        <td className="spreadsheet-cell wp-calc wp-calc-strong">{execWeight.toFixed(3)}</td>
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
                    <td className="wp-calc wp-calc-strong" style={{ color: achievementColor }}>{totalExecWeight.toFixed(3)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
              <div className="spreadsheet-footer">
                <button className="btn btn-outline btn-sm" onClick={addTask}><Plus size={16} /> Add Task</button>
                <span className="spreadsheet-tip">Plan %, weight &amp; achievement are calculated automatically</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
