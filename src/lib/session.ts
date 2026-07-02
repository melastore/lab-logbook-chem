import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser, refreshSession, type AppUser } from "./logbook";

export const sessionCookieName = "lab_logbook_session";
export const sessionRefreshCookieName = "lab_logbook_refresh";

const cookieBase = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
const sessionMaxAge = 60 * 60 * 24 * 30; // 30 days

// Write both session cookies with a consistent policy. Used by the login route
// and by the silent refresh below.
export async function setSessionCookies(token: string, refreshToken: string) {
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, token, { ...cookieBase, maxAge: sessionMaxAge });
  if (refreshToken) {
    cookieStore.set(sessionRefreshCookieName, refreshToken, { ...cookieBase, maxAge: sessionMaxAge });
  }
}

export async function clearSessionCookies() {
  const cookieStore = await cookies();
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

  // Access token is missing or expired (Supabase JWTs last ~1h). Fall back to
  // the refresh token so a 30-day session survives past that window.
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
