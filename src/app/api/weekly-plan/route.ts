import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/errors";
import { currentUser, passwordChangeGate } from "@/lib/session";
import { weeklyPlanTarget } from "@/lib/authz";
import { getWeeklyPlans, saveWeeklyPlan, deleteWeeklyPlan, sanitizeTasks, normalizeWeekKey } from "@/lib/weekly-plan";

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const requested = searchParams.get("username") || undefined;

  // Analysts can only see their own plans; managers can see any.
  const resolved = weeklyPlanTarget(user.role, user.username, requested);
  if (!resolved.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const plans = await getWeeklyPlans(resolved.target);
    return NextResponse.json({ plans });
  } catch (error) {
    return errorResponse("weekly-plan", error, 500);
  }
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = passwordChangeGate(user);
  if (gate) return gate;

  try {
    const body = await request.json();
    const weekStartDate = normalizeWeekKey(typeof body?.weekStartDate === "string" ? body.weekStartDate : "");
    if (!weekStartDate || !Array.isArray(body?.tasks)) {
      return NextResponse.json({ error: "Invalid week or tasks." }, { status: 400 });
    }

    // Pin the plan to a username the caller is allowed to write.
    const requested = typeof body.username === "string" && body.username ? body.username : undefined;
    const resolved = weeklyPlanTarget(user.role, user.username, requested);
    if (!resolved.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const plan = { username: resolved.target || user.username, weekStartDate, tasks: sanitizeTasks(body.tasks), updatedAt: "" };
    plan.updatedAt = await saveWeeklyPlan(plan, user.username);
    return NextResponse.json({ success: true, plan });
  } catch (error) {
    return errorResponse("weekly-plan", error, 500);
  }
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = passwordChangeGate(user);
  if (gate) return gate;

  const { searchParams } = new URL(request.url);
  const weekStartDate = normalizeWeekKey(searchParams.get("weekStartDate") || "");
  const requested = searchParams.get("username") || undefined;
  if (!weekStartDate) return NextResponse.json({ error: "weekStartDate is required" }, { status: 400 });

  // Analysts can only delete their own plans; managers any.
  const resolved = weeklyPlanTarget(user.role, user.username, requested);
  if (!resolved.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const targetUser = resolved.target || user.username;

  try {
    await deleteWeeklyPlan(targetUser, weekStartDate);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse("weekly-plan", error, 500);
  }
}
