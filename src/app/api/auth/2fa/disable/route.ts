import { NextResponse } from "next/server";
import { logAudit } from "@/lib/logbook";
import { currentUser } from "@/lib/session";
import { verifyTotp } from "@/lib/totp";
import { getTwoFactor, disableTwoFactor } from "@/lib/twofactor";
import { rateLimit, rateLimitClear } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A 6-digit code is only 10^6 wide — unthrottled, a session that has already
// been hijacked could grind it down and strip the second factor.
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

// Turn 2FA off. Require a current valid code so a hijacked session can't quietly
// strip the second factor.
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const limitKey = `2fa-disable:${user.id}`;
  const limit = rateLimit(limitKey, MAX_ATTEMPTS, WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  const { token } = await request.json().catch(() => ({ token: "" }));
  const rec = await getTwoFactor(user.username);
  if (!rec?.enabled) return NextResponse.json({ enabled: false });

  if (!verifyTotp(rec.secret, String(token || ""))) {
    await logAudit({
      actor: user.username, actorId: user.id,
      action: "auth.2fa_disable.failed", detail: { reason: "bad_code" },
    });
    return NextResponse.json({ error: "Enter a valid code to disable 2FA." }, { status: 400 });
  }
  rateLimitClear(limitKey);

  await disableTwoFactor(user.username, user.username);
  await logAudit({ actor: user.username, actorId: user.id, action: "auth.2fa_disabled" });
  return NextResponse.json({ enabled: false });
}
