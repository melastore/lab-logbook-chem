import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/errors";
import { verifyLogbookChain, logAudit } from "@/lib/logbook";
import { canReview, currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user || !canReview(user)) {
    return NextResponse.json({ error: "Supervisor access required." }, { status: 403 });
  }
  try {
    const result = await verifyLogbookChain();
    await logAudit({
      actor: user.username, actorId: user.id, action: "integrity.verify",
      detail: { ok: result.ok, checked: result.checked },
    });
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse("logbook/verify", e);
  }
}
