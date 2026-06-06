import { NextResponse } from "next/server";
import { listAuditLog } from "@/lib/logbook";
import { canReview, currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user || !canReview(user)) {
    return NextResponse.json({ error: "Supervisor access required." }, { status: 403 });
  }
  try {
    const entries = await listAuditLog();
    return NextResponse.json({ entries });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
