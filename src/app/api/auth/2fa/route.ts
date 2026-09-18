import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/errors";
import { currentUser } from "@/lib/session";
import { isTwoFactorEnabled } from "@/lib/twofactor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  try {
    return NextResponse.json({ enabled: await isTwoFactorEnabled(user.username) });
  } catch (e) {
    return errorResponse("auth/2fa", e);
  }
}
