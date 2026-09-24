import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/errors";
import { createRecords, createAmendment, currentVersionIds, listRecords, logAudit, type LogbookInput } from "@/lib/logbook";
import { canReview, currentUser, passwordChangeGate } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  // Optional narrowing to one analyst. listRecords decides what the caller is
  // actually allowed to see; this is only the request.
  const username = new URL(request.url).searchParams.get("username") || undefined;

  try {
    const records = await listRecords(user, username);
    return NextResponse.json({ records });
  } catch (e) {
    return errorResponse("logbook", e);
  }
}

export async function POST(request: Request) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }
  const gate = passwordChangeGate(user);
  if (gate) return gate;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  }
  const isBulk = Array.isArray(body);
  const inputs = isBulk ? body : [body];
  if (inputs.length === 0 || inputs.length > 50 || inputs.some((i) => !i || typeof i !== "object")) {
    return NextResponse.json({ error: "Submit between 1 and 50 entries at a time." }, { status: 400 });
  }

  const recordsToCreate: LogbookInput[] = inputs.map((item) => ({
    laboratoryName: clean(item.laboratoryName),
    department: clean(item.department),
    location: clean(item.location),
    instrumentName: clean(item.instrumentName),
    instrumentModel: clean(item.instrumentModel),
    serialNumber: clean(item.serialNumber),
    manufacturer: clean(item.manufacturer),
    installationDate: clean(item.installationDate),
    instrumentId: clean(item.instrumentId),
    date: clean(item.date),
    analyst: clean(item.analyst),
    activityType: clean(item.activityType),
    methodUsed: clean(item.methodUsed),
    sampleId: clean(item.sampleId),
    measuredValue: clean(item.measuredValue),
    startTime: clean(item.startTime),
    endTime: clean(item.endTime),
    metadata: plainObject(item.metadata) as Record<string, string>,
    remarks: clean(item.remarks),
    analystSignature: cleanSignature(item.analystSignature),
  }));

  const bad = recordsToCreate.findIndex((r) => formatProblem(r));
  if (bad >= 0) {
    const where = isBulk ? ` (row ${bad + 1})` : "";
    return NextResponse.json({ error: `${formatProblem(recordsToCreate[bad])}${where}` }, { status: 400 });
  }

  // A single record carrying `amends` is a correction, not a new entry.
  if (!isBulk && typeof body.amends === "string" && body.amends) {
    // Admins can correct anything. Analysts can correct their own record once
    // it has been rejected, so they can act on the reviewer's comment.
    if (!canReview(user)) {
      const mine = await listRecords(user, user.username);
      const target = mine.find((r) => r.id === body.amends);
      const root = target ? target.amends || target.id : "";
      const current = currentVersionIds(mine);
      const latest = mine.find((r) => current.has(r.id) && (r.amends || r.id) === root);
      const original = mine.find((r) => r.id === root);
      if (!latest || !original || original.submittedBy !== user.id || latest.status !== "Rejected") {
        return NextResponse.json({ error: "You can only correct your own records after they are rejected." }, { status: 403 });
      }
      recordsToCreate[0].analyst = latest.analyst;
    }
    const reason = clean(body.amendmentReason);
    if (!reason) {
      return NextResponse.json({ error: "A reason is required to amend a record." }, { status: 400 });
    }
    try {
      const amendment = await createAmendment(body.amends, recordsToCreate[0], reason, user.id);
      await logAudit({
        actor: user.username, actorId: user.id, action: "record.amend",
        target: body.amends, detail: { amendmentId: amendment.id, reason },
      });
      return NextResponse.json({ records: [amendment], count: 1 });
    } catch (e) {
      return errorResponse("logbook", e);
    }
  }

  try {
    const ids = await createRecords(recordsToCreate, user.id);
    await logAudit({
      actor: user.username, actorId: user.id, action: "record.create",
      target: ids.join(","), detail: { count: ids.length },
    });
    return NextResponse.json({ ids, count: ids.length });
  } catch (e) {
    return errorResponse("logbook", e);
  }
}

// The date/time columns reject anything else with an opaque database error.
function formatProblem(r: LogbookInput) {
  if (r.date && !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return "Date must be YYYY-MM-DD.";
  // One day of slack for clients ahead of the server's timezone.
  if (r.date && r.date > new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)) return "Date can't be in the future.";
  for (const t of [r.startTime, r.endTime]) if (t && !/^\d{2}:\d{2}(:\d{2})?$/.test(t)) return "Times must be HH:MM.";
  return null;
}

function plainObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

// No DELETE: records are append-only and the database blocks removal.

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanSignature(value: unknown) {
  const signature = clean(value);
  return signature.length > 300_000 ? signature.slice(0, 300_000) : signature;
}
