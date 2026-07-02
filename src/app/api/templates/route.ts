import { NextResponse } from "next/server";
import { listTemplates, createTemplate, updateTemplate, deleteTemplate } from "@/lib/logbook";
import { canReview, currentUser } from "@/lib/session";

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
    return NextResponse.json({ error: "Supervisor access required." }, { status: 403 });
  }
  try {
    const body = await request.json();
    const template = await createTemplate({
      categoryId:       clean(body.categoryId),
      instrumentName:   clean(body.instrumentName),
      instrumentModel:  clean(body.instrumentModel),
      serialNumber:     clean(body.serialNumber),
      manufacturer:     clean(body.manufacturer) || "Thermo Scientific",
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
      metadata:         body.metadata || {},
      infoFormId:       clean(body.infoFormId),
    });
    return NextResponse.json({ template }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user || !canReview(user)) {
    return NextResponse.json({ error: "Supervisor access required." }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });
  try {
    const body = await request.json();
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
      metadata:         body.metadata         !== undefined ? body.metadata                : undefined,
      infoFormId:       body.infoFormId       !== undefined ? clean(body.infoFormId)       : undefined,
    });
    if (!template) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ template });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user || !canReview(user)) {
    return NextResponse.json({ error: "Supervisor access required." }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });
  try {
    await deleteTemplate(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
