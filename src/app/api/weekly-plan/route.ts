import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { getWeeklyPlans, saveWeeklyPlan, deleteWeeklyPlan, type WeeklyPlan } from "@/lib/weekly-plan";

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const filterUser = searchParams.get("username") || undefined;
  
  // Regular users can only see their own plans. Admins can see any.
  if (user.role !== "admin" && user.role !== "supervisor") {
    if (filterUser && filterUser !== user.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  }

  const targetUser = (user.role === "admin" || user.role === "supervisor") 
    ? filterUser 
    : user.username;

  try {
    const plans = await getWeeklyPlans(targetUser);
    return NextResponse.json({ plans });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as WeeklyPlan;
    if (!body || !body.weekStartDate || !body.tasks) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Force the username to match the logged in user, unless admin
    if (user.role !== "admin" && user.role !== "supervisor") {
      body.username = user.username;
    } else if (!body.username) {
      body.username = user.username;
    }

    await saveWeeklyPlan(body, user.username);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const weekStartDate = searchParams.get("weekStartDate");
  const filterUser = searchParams.get("username") || undefined;
  if (!weekStartDate) return NextResponse.json({ error: "weekStartDate is required" }, { status: 400 });

  // Regular users can only delete their own plans; admins/supervisors any.
  const isManager = user.role === "admin" || user.role === "supervisor";
  if (!isManager && filterUser && filterUser !== user.username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const targetUser = isManager && filterUser ? filterUser : user.username;

  try {
    await deleteWeeklyPlan(targetUser, weekStartDate);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
