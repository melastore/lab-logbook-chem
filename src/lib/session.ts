import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser, refreshSession, revokeSession, type AppUser } from "./logbook";
import { sessionCookieName, sessionRefreshCookieName } from "./session-cookie-names";

export { sessionCookieName, sessionRefreshCookieName };

const cookieBase = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

// The access token is a Supabase JWT that expires in ~1h on its own; the cookie
// is given the same life so a stale one is never presented.
const accessMaxAge = 60 * 60;

// Idle timeout. The refresh cookie is rewritten on every silent refresh, so an
// active user stays signed in indefinitely while an abandoned session — a
// browser left open on a shared lab workstation — dies after this long.
const idleMaxAge = 60 * 60 * 12;

// Write both session cookies with a consistent policy. Used by the login route
// and by the silent refresh below.
export async function setSessionCookies(token: string, refreshToken: string) {
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, token, { ...cookieBase, maxAge: accessMaxAge });
  if (refreshToken) {
    cookieStore.set(sessionRefreshCookieName, refreshToken, { ...cookieBase, maxAge: idleMaxAge });
  }
}

// Drop the cookies and tell Supabase to invalidate the refresh token, so a copy
// captured earlier can't be exchanged for a new session after sign-out.
export async function clearSessionCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value || "";
  if (token) await revokeSession(token);
  cookieStore.delete(sessionCookieName);
  cookieStore.delete(sessionRefreshCookieName);
}

export async function currentUser(): Promise<AppUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value || "";

  if (token) {
    const user = await getCurrentUser(token);
    if (user) return user;
  }

  // Access token is missing or expired. Fall back to the refresh token, which
  // also slides the idle window forward.
  const refreshToken = cookieStore.get(sessionRefreshCookieName)?.value || "";
  if (!refreshToken) return null;

  try {
    const refreshed = await refreshSession(refreshToken);
    if (!refreshed) return null;
    // Persist the rotated tokens. Only route handlers may write cookies; if a
    // read-only context ever calls this, the set throws and we still return the
    // user (they just refresh again next request).
    try {
      await setSessionCookies(refreshed.token, refreshed.refreshToken);
    } catch {
      // ignore — cookie write not allowed in this context
    }
    return refreshed.user;
  } catch {
    return null;
  }
}

export function canReview(user: AppUser) {
  return user.role === "supervisor" || user.role === "admin";
}

// Accounts start on the shared initial password with passwordChangeRequired set.
// Until they change it, block every state-changing request so nobody can act
// (submit records, manage users, edit forms) on a known credential. Returns a
// 403 response to short-circuit the route, or null when the user may proceed.
export function passwordChangeGate(user: AppUser): NextResponse | null {
  if (user.passwordChangeRequired) {
    return NextResponse.json(
      { error: "You must change your password before continuing.", passwordChangeRequired: true },
      { status: 403 }
    );
  }
  return null;
}
