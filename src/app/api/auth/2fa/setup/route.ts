import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { generateSecret, totpUri } from "@/lib/totp";
import { isTwoFactorEnabled, setPendingSecret } from "@/lib/twofactor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Begin enrollment: mint a new secret, stash it as pending, and hand back the
// otpauth URI so the client can render a QR code / show the manual key.
export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  // Starting a new enrollment would overwrite the active record with a
  // not-yet-enabled one, silently switching 2FA off. Require disable first.
  if (await isTwoFactorEnabled(user.username)) {
    return NextResponse.json(
      { error: "Two-factor authentication is already enabled. Disable it first." },
      { status: 400 }
    );
  }

  const secret = generateSecret();
  await setPendingSecret(user.username, secret, user.username);

  return NextResponse.json({
    secret,
    uri: totpUri(secret, user.email || user.username),
  });
}
