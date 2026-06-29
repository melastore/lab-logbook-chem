import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { verifyTotp } from "@/lib/totp";
import { getTwoFactor, disableTwoFactor } from "@/lib/twofactor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Turn 2FA off. Require a current valid code so a hijacked session can't quietly
// strip the second factor.
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { token } = await request.json().catch(() => ({ token: "" }));
  const rec = await getTwoFactor(user.username);
  if (!rec?.enabled) return NextResponse.json({ enabled: false });

  if (!verifyTotp(rec.secret, String(token || ""))) {
    return NextResponse.json({ error: "Enter a valid code to disable 2FA." }, { status: 400 });
  }

  await disableTwoFactor(user.username, user.username);
  return NextResponse.json({ enabled: false });
}
