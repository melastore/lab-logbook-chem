import { NextResponse } from "next/server";
import { logAudit } from "@/lib/logbook";
import { clearSessionCookies, currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const user = await currentUser();
  if (user) {
    await logAudit({ actor: user.username, actorId: user.id, action: "auth.logout" });
  }
  await clearSessionCookies();
  return NextResponse.json({ ok: true });
}
