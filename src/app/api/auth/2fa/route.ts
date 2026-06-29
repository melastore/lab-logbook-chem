import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { isTwoFactorEnabled } from "@/lib/twofactor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  return NextResponse.json({ enabled: await isTwoFactorEnabled(user.username) });
}
