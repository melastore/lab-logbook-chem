import { supabaseRest } from "./logbook";

// Standard government work week — 8h × 5 days — used to weight each task.
export const WEEKLY_HOURS = 40;

export type WeeklyTask = {
  id: string;
  date: string;
  hours: number;
  activity: string;
  // Achievement weight is what the analyst now types in directly; the
  // achievement % is derived from it. Older saved rows only carried
  // executionPercent, so we keep it for backward-compatible reads.
  achWeight?: number;
  achFormula?: string; // New: stores the exact formula string e.g. "=H13*80/100"
  executionPercent?: number;
  comment: string;
};

export type WeeklyPlan = {
  username: string;
  weekStartDate: string;
  tasks: WeeklyTask[];
  updatedAt: string;
};

// Work weight = share of the 40h week a task takes up.
export function taskWeight(t: WeeklyTask): number {
  return (Number(t.hours) || 0) / WEEKLY_HOURS;
}

// Evaluate an Excel-style arithmetic formula for one row. Cell references to
// this row's columns are resolved to live values (H = work weight, C = hours);
// any other letter reference resolves to 0. Only arithmetic is allowed, so this
// is safe to evaluate. Returns null when the expression can't be computed yet
// (e.g. a half-typed formula), so callers can fall back.
export function evalAchFormula(formula: string, vars: { H: number; C: number }): number | null {
  let expr = formula.trim();
  if (expr.startsWith("=")) expr = expr.slice(1);
  if (!expr) return null;
  // Replace cell refs like H13 / C7 (and bare H / C) with this row's value.
  const substituted = expr.replace(/[A-Za-z]+\$?\d*/g, (tok) => {
    const letter = tok[0].toUpperCase();
    if (letter === "H") return `(${vars.H})`;
    if (letter === "C") return `(${vars.C})`;
    return "(0)";
  });
  if (!/^[0-9.+\-*/()\s]+$/.test(substituted)) return null;
  try {
    const value = Function(`"use strict";return (${substituted})`)() as unknown;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

// Ach. weight is what the analyst fills (as a value or an Excel formula such as
// "=H13*80/100"); fall back to the legacy executionPercent for older plans.
export function taskAchWeight(t: WeeklyTask): number {
  const w = taskWeight(t);
  if (t.achFormula && t.achFormula.trim()) {
    const raw = t.achFormula.trim();
    if (raw.startsWith("=")) {
      const v = evalAchFormula(raw, { H: w, C: Number(t.hours) || 0 });
      if (v != null) return v;
    } else {
      const num = parseFloat(raw);
      if (!isNaN(num)) return num;
    }
  }
  if (t.achWeight != null && Number.isFinite(Number(t.achWeight))) return Number(t.achWeight);
  return w * ((Number(t.executionPercent) || 0) / 100);
}

// Achievement % is fully derived: how much of a task's weight was achieved.
export function taskAchPercent(t: WeeklyTask): number {
  const w = taskWeight(t);
  return w > 0 ? (taskAchWeight(t) / w) * 100 : 0;
}

function buildKey(username: string, weekStartDate: string) {
  return `weekly_plan:${username}:${weekStartDate}`;
}

export async function getWeeklyPlans(username?: string): Promise<WeeklyPlan[]> {
  const prefix = username ? `weekly_plan:${username}:` : `weekly_plan:`;
  const rows = await supabaseRest<{ key: string; value: string; updated_at: string }[]>(
    `/app_config?key=like.${encodeURIComponent(prefix + "%")}&select=key,value,updated_at`
  );

  return rows.map(row => {
    try {
      const parts = row.key.split(":");
      const u = parts[1];
      const w = parts[2];
      const tasks = JSON.parse(row.value) as WeeklyTask[];
      return {
        username: u,
        weekStartDate: w,
        tasks: Array.isArray(tasks) ? tasks : [],
        updatedAt: row.updated_at
      };
    } catch {
      return null;
    }
  }).filter(Boolean) as WeeklyPlan[];
}

export async function saveWeeklyPlan(plan: WeeklyPlan, updatedBy: string): Promise<void> {
  const key = buildKey(plan.username, plan.weekStartDate);
  const value = JSON.stringify(plan.tasks);
  
  await supabaseRest<unknown>("/app_config?on_conflict=key", {
    method: "POST",
    prefer: "return=minimal,resolution=merge-duplicates",
    body: {
      key,
      value,
      updated_by: updatedBy,
      updated_at: new Date().toISOString()
    }
  });
}

export async function deleteWeeklyPlan(username: string, weekStartDate: string): Promise<void> {
  const key = buildKey(username, weekStartDate);
  await supabaseRest<unknown>(`/app_config?key=eq.${encodeURIComponent(key)}`, {
    method: "DELETE",
    prefer: "return=minimal"
  });
}
