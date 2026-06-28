"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Plus, Trash2, CalendarDays } from "lucide-react";
import type { AppUser } from "@/lib/logbook";
import type { WeeklyTask, WeeklyPlan } from "@/lib/weekly-plan";

function getMonday(d = new Date()) {
  d = new Date(d);
  const day = d.getDay(),
      diff = d.getDate() - day + (day == 0 ? -6: 1);
  return new Date(d.setDate(diff)).toISOString().slice(0, 10);
}

export default function WeeklyPlanPage() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [weekStartDate, setWeekStartDate] = useState<string>(getMonday());
  const [tasks, setTasks] = useState<WeeklyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setUser(d.user);
      });
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetch(`/api/weekly-plan?username=${user.username}`)
      .then((r) => r.json())
      .then((d) => {
        const plans = d.plans as WeeklyPlan[];
        const current = plans.find(p => p.weekStartDate === weekStartDate);
        if (current && current.tasks.length > 0) {
          setTasks(current.tasks);
        } else {
          setTasks([{ id: crypto.randomUUID(), date: weekStartDate, hours: 0, activity: "", executionPercent: 0, comment: "" }]);
        }
        setLoading(false);
      });
  }, [user, weekStartDate]);

  const addTask = () => {
    setTasks([...tasks, { id: crypto.randomUUID(), date: weekStartDate, hours: 0, activity: "", executionPercent: 0, comment: "" }]);
  };

  const removeTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  const updateTask = (id: string, field: keyof WeeklyTask, value: any) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const savePlan = async () => {
    if (!user) return;
    setSaving(true);
    const body: WeeklyPlan = {
      username: user.username,
      weekStartDate,
      tasks,
      updatedAt: new Date().toISOString()
    };
    await fetch("/api/weekly-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    setSaving(false);
  };

  const totalHours = tasks.reduce((sum, t) => sum + (Number(t.hours) || 0), 0);
  const totalWeight = tasks.reduce((sum, t) => sum + ((Number(t.hours) || 0) / 40), 0);
  const totalExecWeight = tasks.reduce((sum, t) => sum + (((Number(t.hours) || 0) / 40) * ((Number(t.executionPercent) || 0) / 100)), 0);
  
  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--background)" }}>
      <header className="topbar" style={{ padding: "16px 24px", borderBottom: "1px solid var(--outline-variant)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/" className="btn btn-outline btn-sm"><ArrowLeft size={16} /> Back</Link>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>Weekly Plan & Report</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <input 
            type="date" 
            className="input-modern" 
            value={weekStartDate} 
            onChange={(e) => setWeekStartDate(e.target.value)}
            style={{ width: 160 }}
          />
          <button className="btn btn-primary btn-sm" onClick={savePlan} disabled={saving || loading}>
            <Save size={16} /> {saving ? "Saving..." : "Save Report"}
          </button>
        </div>
      </header>

      <div style={{ padding: 24, flex: 1, overflowX: "auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}>Loading report...</div>
        ) : (
          <div className="spreadsheet-container shadow-sm">
            <table className="spreadsheet-table">
              <thead>
                <tr>
                  <th style={{ width: 130 }}>Date</th>
                  <th style={{ width: 80 }}>Hours</th>
                  <th style={{ minWidth: 250 }}>Main Tasks</th>
                  <th style={{ width: 80 }}>Plan %</th>
                  <th style={{ width: 100 }}>Execution %</th>
                  <th style={{ minWidth: 200 }}>Comment / Issues</th>
                  <th style={{ width: 80 }}>Weight</th>
                  <th style={{ width: 90 }}>Exec Weight</th>
                  <th style={{ width: 50 }}></th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => {
                  const planPct = totalHours > 0 ? (task.hours / totalHours) * 100 : 0;
                  const weight = task.hours / 40;
                  const execWeight = weight * (task.executionPercent / 100);
                  
                  return (
                    <tr key={task.id}>
                      <td><input type="date" value={task.date} onChange={e => updateTask(task.id, "date", e.target.value)} /></td>
                      <td><input type="number" min="0" step="0.5" value={task.hours} onChange={e => updateTask(task.id, "hours", parseFloat(e.target.value))} /></td>
                      <td><input type="text" placeholder="Task description..." value={task.activity} onChange={e => updateTask(task.id, "activity", e.target.value)} /></td>
                      <td style={{ textAlign: "center", fontWeight: 700, color: "var(--primary)" }}>{planPct.toFixed(0)}%</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <input type="number" min="0" max="100" value={task.executionPercent} onChange={e => updateTask(task.id, "executionPercent", parseFloat(e.target.value))} style={{ width: 60 }} />
                          <span style={{ fontSize: 13, color: "var(--muted)" }}>%</span>
                        </div>
                      </td>
                      <td><input type="text" placeholder="Remarks..." value={task.comment} onChange={e => updateTask(task.id, "comment", e.target.value)} /></td>
                      <td style={{ textAlign: "center", fontSize: 13 }}>{weight.toFixed(4)}</td>
                      <td style={{ textAlign: "center", fontSize: 13, fontWeight: 700 }}>{execWeight.toFixed(4)}</td>
                      <td>
                        <button type="button" onClick={() => removeTask(task.id)} style={{ padding: 6, color: "var(--error)", background: "transparent", border: "none", cursor: "pointer", borderRadius: 6 }}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: "var(--surface-2)", fontWeight: 800 }}>
                  <td style={{ textAlign: "right" }}>Total:</td>
                  <td>{totalHours} hrs</td>
                  <td></td>
                  <td style={{ textAlign: "center" }}>100%</td>
                  <td></td>
                  <td></td>
                  <td style={{ textAlign: "center" }}>{totalWeight.toFixed(4)}</td>
                  <td style={{ textAlign: "center", color: "var(--success)" }}>{totalExecWeight.toFixed(4)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
            <div style={{ padding: 16, borderTop: "1px solid var(--outline-variant)" }}>
              <button className="btn btn-outline btn-sm" onClick={addTask}><Plus size={16} /> Add Row</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
