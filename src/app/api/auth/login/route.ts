import { NextResponse } from "next/server";
import { loginWithUsername, logAudit } from "@/lib/logbook";
import { rateLimit, rateLimitClear } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { setSessionCookies } from "@/lib/session";
import { getTwoFactor } from "@/lib/twofactor";
import { verifyTotp } from "@/lib/totp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-account: slows password guessing and, more importantly, makes brute
// forcing a 6-digit TOTP code infeasible.
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

// Per-source, on top of the per-account limit. Without it, one host can spray a
// handful of guesses across every username in the lab and never be throttled.
const MAX_ATTEMPTS_PER_IP = 30;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const username = clean(body.username);
  const password = clean(body.password);
  const twoFactorToken = clean(body.twoFactorToken);

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
  }

  const ipKey = `login-ip:${clientIp(request)}`;
  const ipLimit = rateLimit(ipKey, MAX_ATTEMPTS_PER_IP, WINDOW_MS);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSec) } }
    );
  }

  const limitKey = `login:${username.toLowerCase()}`;
  const limit = rateLimit(limitKey, MAX_ATTEMPTS, WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  try {
    const session = await loginWithUsername(username, password);

    // Password is valid — enforce the second factor if the account has it on.
    // Use the profile's canonical username so a differently-cased login still
    // resolves the account's 2FA record.
    const twoFactor = await getTwoFactor(session.user.username);
    if (twoFactor?.enabled) {
      if (!twoFactorToken) {
        // Don't issue a cookie yet; the client re-submits with the code.
        return NextResponse.json({ twoFactorRequired: true });
      }
      if (!verifyTotp(twoFactor.secret, twoFactorToken)) {
        await logAudit({
          actor: session.user.username, actorId: session.user.id,
          action: "auth.login.failed", detail: { reason: "bad_2fa_code" },
        });
        return NextResponse.json(
          { error: "Invalid authentication code.", twoFactorRequired: true },
          { status: 401 }
        );
      }
    }

    rateLimitClear(limitKey);
    await setSessionCookies(session.token, session.refreshToken);
    await logAudit({
      actor: session.user.username, actorId: session.user.id,
      action: "auth.login", detail: { twoFactor: !!twoFactor?.enabled },
    });

    return NextResponse.json({
      user: session.user,
      passwordChangeRequired: session.user.passwordChangeRequired,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    console.error("[login] failed:", message || e);
    await logAudit({
      actor: username, action: "auth.login.failed",
      detail: { reason: message.toLowerCase().includes("archived") ? "archived" : "bad_credentials" },
    });
    // Archived accounts get a clear message; everything else stays generic.
    if (message.toLowerCase().includes("archived")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
