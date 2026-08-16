import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/errors";
import { createRecords, createAmendment, listRecords, logAudit, type LogbookInput } from "@/lib/logbook";
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

  const body = await request.json();
  const isBulk = Array.isArray(body);
  const inputs = isBulk ? body : [body];

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
    metadata: item.metadata || {},
    remarks: clean(item.remarks),
    analystSignature: cleanSignature(item.analystSignature),
  }));

  // A single record carrying `amends` is a correction, not a new entry.
  if (!isBulk && typeof body.amends === "string" && body.amends) {
    if (!canReview(user)) {
      return NextResponse.json({ error: "Supervisor access required to amend a record." }, { status: 403 });
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
      return errorResponse("logbook", e, 400);
    }
  }

  const createdRecords = await createRecords(recordsToCreate, user.id);
  await logAudit({
    actor: user.username, actorId: user.id, action: "record.create",
    target: createdRecords.map((r) => r.id).join(","), detail: { count: createdRecords.length },
  });

  return NextResponse.json({
    records: createdRecords,
    count: createdRecords.length
  });
}

// No DELETE: records are append-only and the database blocks removal.

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanSignature(value: unknown) {
  const signature = clean(value);
  return signature.length > 300_000 ? signature.slice(0, 300_000) : signature;
}
