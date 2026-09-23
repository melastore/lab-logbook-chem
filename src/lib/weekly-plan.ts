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
  const value = parseArithmetic(substituted);
  return value != null && Number.isFinite(value) ? value : null;
}

// Small recursive-descent parser for + - * / and parentheses. The production
// CSP has no 'unsafe-eval', so Function()/eval would throw in the browser.
function parseArithmetic(src: string): number | null {
  const s = src.replace(/\s+/g, "");
  let i = 0;

  function expr(): number | null {
    let left = term();
    while (left != null && (s[i] === "+" || s[i] === "-")) {
      const op = s[i++];
      const right = term();
      if (right == null) return null;
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  function term(): number | null {
    let left = factor();
    while (left != null && (s[i] === "*" || s[i] === "/")) {
      const op = s[i++];
      const right = factor();
      if (right == null) return null;
      left = op === "*" ? left * right : left / right;
    }
    return left;
  }

  function factor(): number | null {
    if (s[i] === "+" || s[i] === "-") {
      const op = s[i++];
      const v = factor();
      return v == null ? null : op === "-" ? -v : v;
    }
    if (s[i] === "(") {
      i++;
      const v = expr();
      if (s[i] !== ")") return null;
      i++;
      return v;
    }
    const m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i));
    if (!m) return null;
    i += m[0].length;
    return parseFloat(m[0]);
  }

  const result = expr();
  return i === s.length ? result : null;
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

// ─── Weeks ───────────────────────────────────────────────────────────────────
// Weeks are keyed by their Monday as a local YYYY-MM-DD. Never go through
// toISOString(): east of UTC that turns local midnight into the previous day,
// which is how some plans ended up filed under a Sunday and looked lost.

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseISODate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(value + "T00:00:00");
  return isNaN(d.getTime()) || toISODate(d) !== value ? null : d;
}

export function mondayOf(value: Date | string = new Date()): string {
  const d = typeof value === "string" ? parseISODate(value) : new Date(value);
  if (!d) return "";
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return toISODate(d);
}

export function addWeeks(weekStart: string, n: number): string {
  const d = parseISODate(weekStart);
  if (!d) return weekStart;
  d.setDate(d.getDate() + n * 7);
  return toISODate(d);
}

// Older rows were saved under whatever day was picked, or under the Sunday
// before a Monday because of the UTC bug. A Sunday always meant the week after.
export function normalizeWeekKey(value: string): string {
  const d = parseISODate(value);
  if (!d) return "";
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return mondayOf(d);
}

// "Mon 22 Sep – Fri 26 Sep 2026"
export function weekLabel(weekStart: string): string {
  const start = parseISODate(weekStart);
  if (!start) return weekStart;
  const end = new Date(start);
  end.setDate(start.getDate() + 4);
  const short = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  return `${short(start)} – ${short(end)} ${end.getFullYear()}`;
}

// "22-09-2026 to 26-09-2026", the format the official template uses.
export function weekRangeDMY(weekStart: string, joiner = "to"): string {
  const start = parseISODate(weekStart);
  if (!start) return weekStart;
  const end = new Date(start);
  end.setDate(start.getDate() + 4);
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
  return `${fmt(start)} ${joiner} ${fmt(end)}`;
}

// ─── Performance ─────────────────────────────────────────────────────────────

export type PlanStats = {
  totalHours: number;
  totalWeight: number;
  totalAchWeight: number;
  achievement: number;
  completed: number;
  taskCount: number;
};

export function planStats(tasks: WeeklyTask[]): PlanStats {
  const real = tasks.filter((t) => (Number(t.hours) || 0) > 0 || t.activity.trim());
  const totalHours = real.reduce((s, t) => s + (Number(t.hours) || 0), 0);
  const totalWeight = real.reduce((s, t) => s + taskWeight(t), 0);
  const totalAchWeight = real.reduce((s, t) => s + taskAchWeight(t), 0);
  const completed = real.filter((t) => { const w = taskWeight(t); return w > 0 && taskAchWeight(t) >= w - 1e-9; }).length;
  return {
    totalHours, totalWeight, totalAchWeight, completed, taskCount: real.length,
    achievement: totalWeight > 0 ? (totalAchWeight / totalWeight) * 100 : 0,
  };
}

export type PerformanceRating = { label: string; tone: "excellent" | "good" | "fair" | "low" | "none" };

export function performanceRating(achievement: number, hasPlan = true): PerformanceRating {
  if (!hasPlan) return { label: "No plan yet", tone: "none" };
  if (achievement >= 90) return { label: "Excellent", tone: "excellent" };
  if (achievement >= 75) return { label: "Very good", tone: "good" };
  if (achievement >= 50) return { label: "Satisfactory", tone: "fair" };
  return { label: "Needs improvement", tone: "low" };
}

// ─── Storage ─────────────────────────────────────────────────────────────────

const KEY_PREFIX = "weekly_plan:";

function buildKey(username: string, weekStartDate: string) {
  return `${KEY_PREFIX}${username}:${weekStartDate}`;
}

type PlanRow = { key: string; value: string; updated_at: string };

// PostgREST LIKE treats "_" as a wildcard, so filter to exact usernames here
// too; otherwise "analyst_1" would also pick up "analyst11".
async function planRows(username?: string): Promise<PlanRow[]> {
  const prefix = username ? `${KEY_PREFIX}${username}:` : KEY_PREFIX;
  const rows = await supabaseRest<PlanRow[]>(
    `/app_config?key=like.${encodeURIComponent(prefix + "%")}&select=key,value,updated_at`
  );
  return rows.filter((r) => r.key.startsWith(prefix));
}

function splitKey(key: string) {
  const rest = key.slice(KEY_PREFIX.length);
  const i = rest.lastIndexOf(":");
  return i < 0 ? null : { username: rest.slice(0, i), week: rest.slice(i + 1) };
}

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

// Accept only the fields the sheet uses, with sane bounds.
export function sanitizeTasks(input: unknown): WeeklyTask[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 100).map((raw): WeeklyTask => {
    const t = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const hours = Math.min(Math.max(Number(t.hours) || 0, 0), 168);
    const achWeight = Number(t.achWeight);
    return {
      id: clip(t.id, 64) || crypto.randomUUID(),
      date: parseISODate(clip(t.date, 10)) ? clip(t.date, 10) : "",
      hours,
      activity: clip(t.activity, 1000),
      achFormula: clip(t.achFormula, 200),
      ...(Number.isFinite(achWeight) ? { achWeight } : {}),
      ...(t.executionPercent != null && Number.isFinite(Number(t.executionPercent)) ? { executionPercent: Number(t.executionPercent) } : {}),
      comment: clip(t.comment, 1000),
    };
  });
}

export async function getWeeklyPlans(username?: string): Promise<WeeklyPlan[]> {
  const rows = await planRows(username);
  // Several legacy keys can land on the same week; keep the newest.
  const byWeek = new Map<string, WeeklyPlan>();
  for (const row of rows) {
    const parts = splitKey(row.key);
    const week = parts && normalizeWeekKey(parts.week);
    if (!parts || !week) continue;
    let tasks: WeeklyTask[] = [];
    try { tasks = sanitizeTasks(JSON.parse(row.value)); } catch { continue; }
    const plan = { username: parts.username, weekStartDate: week, tasks, updatedAt: row.updated_at };
    const id = `${parts.username}:${week}`;
    const prev = byWeek.get(id);
    if (!prev || (prev.tasks.length === 0 && tasks.length > 0) || (tasks.length > 0 && plan.updatedAt > prev.updatedAt)) {
      byWeek.set(id, plan);
    }
  }
  return [...byWeek.values()];
}

// Keys of this user's rows that belong to `week`, other than the canonical one.
async function strayKeys(username: string, week: string): Promise<string[]> {
  const canonical = buildKey(username, week);
  return (await planRows(username))
    .map((r) => r.key)
    .filter((k) => k !== canonical && normalizeWeekKey(splitKey(k)?.week || "") === week);
}

async function deleteKey(key: string) {
  await supabaseRest<unknown>(`/app_config?key=eq.${encodeURIComponent(key)}`, {
    method: "DELETE",
    prefer: "return=minimal",
  });
}

export async function saveWeeklyPlan(plan: WeeklyPlan, updatedBy: string): Promise<string> {
  const updatedAt = new Date().toISOString();
  await supabaseRest<unknown>("/app_config?on_conflict=key", {
    method: "POST",
    prefer: "return=minimal,resolution=merge-duplicates",
    body: {
      key: buildKey(plan.username, plan.weekStartDate),
      value: JSON.stringify(plan.tasks),
      updated_by: updatedBy,
      updated_at: updatedAt,
    },
  });
  // The canonical row now holds this week; drop legacy duplicates of it.
  for (const key of await strayKeys(plan.username, plan.weekStartDate)) await deleteKey(key);
  return updatedAt;
}

export async function deleteWeeklyPlan(username: string, weekStartDate: string): Promise<void> {
  await deleteKey(buildKey(username, weekStartDate));
  for (const key of await strayKeys(username, weekStartDate)) await deleteKey(key);
}

// Plans are keyed by username, so carry them over when an account is renamed.
export async function renameWeeklyPlans(oldUsername: string, newUsername: string): Promise<void> {
  if (oldUsername === newUsername) return;
  for (const row of await planRows(oldUsername)) {
    const parts = splitKey(row.key);
    if (!parts) continue;
    await supabaseRest<unknown>(`/app_config?key=eq.${encodeURIComponent(row.key)}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: { key: buildKey(newUsername, parts.week) },
    });
  }
}
