import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/errors";
import { listTemplates, createTemplate, updateTemplate, deleteTemplate } from "@/lib/logbook";
import { canReview, currentUser, passwordChangeGate } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ templates: [] }, { status: 401 });
  try {
    const templates = await listTemplates();
    return NextResponse.json({ templates });
  } catch {
    return NextResponse.json({ templates: [] });
  }
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user || !canReview(user)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const gate = passwordChangeGate(user);
  if (gate) return gate;
  try {
    const body = await request.json();
    const problem = await templateProblem(body);
    if (problem) return NextResponse.json({ error: problem.error }, { status: problem.status });
    const template = await createTemplate({
      categoryId:       clean(body.categoryId),
      instrumentName:   clean(body.instrumentName),
      instrumentModel:  clean(body.instrumentModel),
      serialNumber:     clean(body.serialNumber),
      manufacturer:     clean(body.manufacturer),
      installationDate: clean(body.installationDate),
      instrumentId:     clean(body.instrumentId),
      laboratoryName:   clean(body.laboratoryName),
      department:       clean(body.department),
      location:         clean(body.location),
      desk:             clean(body.desk),
      logbookStartDate: clean(body.logbookStartDate),
      logbookEndDate:   clean(body.logbookEndDate),
      methodUsed:       clean(body.methodUsed),
      displayOrder:     Number(body.displayOrder) || 0,
      metadata:         plainObject(body.metadata),
      infoFormId:       clean(body.infoFormId),
    });
    return NextResponse.json({ template }, { status: 201 });
  } catch (e) {
    return errorResponse("templates", e, 500);
  }
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user || !canReview(user)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const gate = passwordChangeGate(user);
  if (gate) return gate;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });
  try {
    const body = await request.json();
    const problem = await templateProblem(body, id);
    if (problem) return NextResponse.json({ error: problem.error }, { status: problem.status });
    const template = await updateTemplate(id, {
      categoryId:       body.categoryId       !== undefined ? clean(body.categoryId)       : undefined,
      instrumentName:   body.instrumentName   !== undefined ? clean(body.instrumentName)   : undefined,
      instrumentModel:  body.instrumentModel  !== undefined ? clean(body.instrumentModel)  : undefined,
      serialNumber:     body.serialNumber     !== undefined ? clean(body.serialNumber)     : undefined,
      manufacturer:     body.manufacturer     !== undefined ? clean(body.manufacturer)     : undefined,
      installationDate: body.installationDate  !== undefined ? clean(body.installationDate) : undefined,
      instrumentId:     body.instrumentId     !== undefined ? clean(body.instrumentId)     : undefined,
      laboratoryName:   body.laboratoryName   !== undefined ? clean(body.laboratoryName)   : undefined,
      department:       body.department       !== undefined ? clean(body.department)       : undefined,
      location:         body.location         !== undefined ? clean(body.location)         : undefined,
      desk:             body.desk             !== undefined ? clean(body.desk)             : undefined,
      logbookStartDate: body.logbookStartDate !== undefined ? clean(body.logbookStartDate) : undefined,
      logbookEndDate:   body.logbookEndDate   !== undefined ? clean(body.logbookEndDate)   : undefined,
      methodUsed:       body.methodUsed       !== undefined ? clean(body.methodUsed)       : undefined,
      displayOrder:     body.displayOrder     !== undefined ? Number(body.displayOrder)    : undefined,
      metadata:         body.metadata         !== undefined ? plainObject(body.metadata)   : undefined,
      infoFormId:       body.infoFormId       !== undefined ? clean(body.infoFormId)       : undefined,
    });
    if (!template) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ template });
  } catch (e) {
    return errorResponse("templates", e, 500);
  }
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user || !canReview(user)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const gate = passwordChangeGate(user);
  if (gate) return gate;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });
  try {
    await deleteTemplate(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse("templates", e, 500);
  }
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function plainObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

// Name and category are required on create (and can't be blanked on edit);
// instrument IDs must be unique so records point at one instrument.
async function templateProblem(body: Record<string, unknown>, editingId?: string) {
  const creating = !editingId;
  if ((creating || body.instrumentName !== undefined) && !clean(body.instrumentName)) {
    return { status: 400, error: "Instrument name is required." };
  }
  if ((creating || body.categoryId !== undefined) && !clean(body.categoryId)) {
    return { status: 400, error: "Choose a category." };
  }
  const instrumentId = clean(body.instrumentId);
  if (instrumentId) {
    const clash = (await listTemplates()).find(
      (t) => t.id !== editingId && t.instrumentId.trim().toLowerCase() === instrumentId.toLowerCase()
    );
    if (clash) return { status: 409, error: `Instrument ID "${instrumentId}" is already used by ${clash.instrumentName}.` };
  }
  return null;
}
