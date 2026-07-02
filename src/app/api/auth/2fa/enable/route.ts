import { NextResponse } from "next/server";
import { logAudit } from "@/lib/logbook";
import { currentUser } from "@/lib/session";
import { verifyTotp } from "@/lib/totp";
import { getTwoFactor, enableTwoFactor } from "@/lib/twofactor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Finish enrollment: confirm the user can produce a valid code from the pending
// secret before we actually switch 2FA on for their account.
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { token } = await request.json().catch(() => ({ token: "" }));
  const rec = await getTwoFactor(user.username);
  if (!rec?.secret) {
    return NextResponse.json({ error: "Start setup first." }, { status: 400 });
  }
  if (!verifyTotp(rec.secret, String(token || ""))) {
    return NextResponse.json({ error: "That code didn't match. Try again." }, { status: 400 });
  }

  await enableTwoFactor(user.username, rec.secret, user.username);
  await logAudit({ actor: user.username, actorId: user.id, action: "auth.2fa_enabled" });
  return NextResponse.json({ enabled: true });
}
