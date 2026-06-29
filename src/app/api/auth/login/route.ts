import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { loginWithUsername } from "@/lib/logbook";
import { sessionCookieName } from "@/lib/session";
import { getTwoFactor } from "@/lib/twofactor";
import { verifyTotp } from "@/lib/totp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json();
  const username = clean(body.username);
  const password = clean(body.password);
  const twoFactorToken = clean(body.twoFactorToken);

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
  }

  try {
    const session = await loginWithUsername(username, password);

    // Password is valid — enforce the second factor if the account has it on.
    const twoFactor = await getTwoFactor(username);
    if (twoFactor?.enabled) {
      if (!twoFactorToken) {
        // Don't issue a cookie yet; the client re-submits with the code.
        return NextResponse.json({ twoFactorRequired: true });
      }
      if (!verifyTotp(twoFactor.secret, twoFactorToken)) {
        return NextResponse.json(
          { error: "Invalid authentication code.", twoFactorRequired: true },
          { status: 401 }
        );
      }
    }

    const cookieStore = await cookies();
    cookieStore.set(sessionCookieName, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: session.maxAge,
    });

    return NextResponse.json({
      user: session.user,
      passwordChangeRequired: session.user.passwordChangeRequired,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    console.error("[login] failed:", message || e);
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
