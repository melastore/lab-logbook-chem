import { NextResponse } from "next/server";
import { errorResponse, publicMessage } from "@/lib/errors";
import { addReview, logAudit, reviewCounts, type RecordReview, type ReviewDecision } from "@/lib/logbook";
import { canReview, currentUser, passwordChangeGate } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Badge counts: records waiting for review, and the caller's rejected records.
export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }
  try {
    return NextResponse.json(await reviewCounts(user));
  } catch (e) {
    return errorResponse("logbook/review", e);
  }
}

// Approve, reject, or comment on a record. Reviews are append-only: each call
// adds one, and a record's status is its latest approve/reject.
// `recordIds` approves several records at once.
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user || !canReview(user)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const gate = passwordChangeGate(user);
  if (gate) return gate;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid review." }, { status: 400 });
  }
  const decision = body.decision as ReviewDecision;
  const comment = typeof body.comment === "string" ? body.comment : "";

  if (Array.isArray(body.recordIds)) {
    const ids = body.recordIds.filter((id: unknown): id is string => typeof id === "string");
    if (decision !== "Approved") {
      return NextResponse.json({ error: "Only approval can be done in bulk." }, { status: 400 });
    }
    if (ids.length === 0 || ids.length > 100) {
      return NextResponse.json({ error: "Select between 1 and 100 records." }, { status: 400 });
    }
    const reviews: RecordReview[] = [];
    const failed: { recordId: string; error: string }[] = [];
    for (const id of ids) {
      try {
        reviews.push(await addReview(id, decision, comment, user));
      } catch (e) {
        failed.push({ recordId: id, error: publicMessage("logbook/review", e) });
      }
    }
    if (reviews.length) {
      await logAudit({
        actor: user.username, actorId: user.id, action: "record.review.approved",
        target: reviews.map((r) => r.recordId).join(","), detail: { count: reviews.length, bulk: true },
      });
    }
    return NextResponse.json({ reviews, failed });
  }

  const recordId = typeof body.recordId === "string" ? body.recordId : "";
  try {
    const review = await addReview(recordId, decision, comment, user);
    await logAudit({
      actor: user.username, actorId: user.id, action: `record.review.${decision.toLowerCase()}`,
      target: recordId, detail: { reviewId: review.id, comment: review.comment },
    });
    return NextResponse.json({ review });
  } catch (e) {
    return errorResponse("logbook/review", e);
  }
}
