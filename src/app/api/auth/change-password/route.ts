import { NextResponse } from "next/server";
import { changePassword, logAudit, verifyPassword } from "@/lib/logbook";
import { currentUser } from "@/lib/session";
import { errorResponse } from "@/lib/errors";
import { passwordProblem } from "@/lib/password";
import { rateLimit, rateLimitClear } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Low ceiling: this endpoint re-checks the current password, so it is a
// password oracle if left unthrottled.
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword.trim() : "";

  if (!currentPassword) {
    return NextResponse.json({ error: "Enter your current password." }, { status: 400 });
  }

  const problem = passwordProblem(newPassword, { username: user.username });
  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }
  if (newPassword === currentPassword) {
    return NextResponse.json({ error: "The new password must be different." }, { status: 400 });
  }

  const limitKey = `change-password:${user.id}`;
  const limit = rateLimit(limitKey, MAX_ATTEMPTS, WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  // Re-authenticate. Without this, anyone reaching an unlocked workstation — or
  // holding a stolen session cookie — could set a new password and keep the
  // account for good.
  const email = user.email || `${user.username}@lab.local`;
  if (!(await verifyPassword(email, currentPassword))) {
    await logAudit({
      actor: user.username, actorId: user.id,
      action: "auth.password_change.failed", detail: { reason: "bad_current_password" },
    });
    return NextResponse.json({ error: "Your current password is incorrect." }, { status: 401 });
  }
  rateLimitClear(limitKey);

  try {
    await changePassword(user.id, newPassword);
    await logAudit({ actor: user.username, actorId: user.id, action: "auth.password_change" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse("auth/change-password", e);
  }
}
