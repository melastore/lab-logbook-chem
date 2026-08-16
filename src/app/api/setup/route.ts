import { NextResponse } from "next/server";
import { GENERATED_USERS, provisionUser, listProvisionedUsernames } from "@/lib/logbook";
import { clientIp } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public endpoint — safe because it only acts when ZERO admin profiles exist.
export async function GET() {
  try {
    const provisioned = await listProvisionedUsernames();
    const adminsDone = GENERATED_USERS.filter(
      (u) => u.role === "admin" && provisioned.includes(u.username)
    ).length;
    return NextResponse.json({ ready: adminsDone > 0, adminCount: adminsDone });
  } catch (e) {
    // Unauthenticated endpoint: log the cause, tell the caller nothing.
    console.error("[setup] readiness check failed:", e);
    return NextResponse.json({ ready: false, error: "Setup status is unavailable." });
  }
}

export async function POST(request: Request) {
  // Public endpoint. It self-closes once an admin exists, but throttle it so it
  // cannot be hammered before that happens.
  const limit = rateLimit(`setup:${clientIp(request)}`, 5, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  const admins = GENERATED_USERS.filter((u) => u.role === "admin");
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Try to get already-provisioned list — if it fails, assume none exist yet
  let provisioned: string[] = [];
  try {
    provisioned = await listProvisionedUsernames();
  } catch {
    provisioned = [];
  }

  // Guard: once any admin exists, further provisioning belongs behind login.
  const existingAdmins = admins.filter((a) => provisioned.includes(a.username));
  if (existingAdmins.length > 0) {
    return NextResponse.json(
      { error: "Admin accounts already exist. Log in at /login?redirect=/admin" },
      { status: 409 }
    );
  }

  for (const gen of admins) {
    if (provisioned.includes(gen.username)) {
      skipped++;
      continue;
    }
    try {
      await provisionUser(gen);
      created++;
    } catch (e) {
      console.error(`[setup] could not provision ${gen.username}:`, e);
      errors.push(`${gen.username}: provisioning failed`);
      skipped++;
    }
  }

  if (errors.length > 0 && created === 0 && skipped === 0) {
    return NextResponse.json(
      { error: `Setup failed. ${errors[0]}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ created, skipped, errors });
}
