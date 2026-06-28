import { supabaseRest } from "./logbook";
import type { AppUser } from "./logbook";

export type WeeklyTask = {
  id: string;
  date: string;
  hours: number;
  activity: string;
  executionPercent: number;
  comment: string;
};

export type WeeklyPlan = {
  username: string;
  weekStartDate: string;
  tasks: WeeklyTask[];
  updatedAt: string;
};

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
