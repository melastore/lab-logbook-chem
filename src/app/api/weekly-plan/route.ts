import { NextResponse } from "next/server";
import { currentUser, passwordChangeGate } from "@/lib/session";
import { weeklyPlanTarget } from "@/lib/authz";
import { getWeeklyPlans, saveWeeklyPlan, deleteWeeklyPlan, type WeeklyPlan } from "@/lib/weekly-plan";

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
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = passwordChangeGate(user);
  if (gate) return gate;

  try {
    const body = (await request.json()) as WeeklyPlan;
    if (!body || !body.weekStartDate || !body.tasks) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Pin the plan to a username the caller is allowed to write.
    const resolved = weeklyPlanTarget(user.role, user.username, body.username || undefined);
    if (!resolved.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    body.username = resolved.target || user.username;

    await saveWeeklyPlan(body, user.username);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = passwordChangeGate(user);
  if (gate) return gate;

  const { searchParams } = new URL(request.url);
  const weekStartDate = searchParams.get("weekStartDate");
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
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
