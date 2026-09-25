import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/errors";
import { listFormCategories, createFormCategory, updateFormCategory, deleteFormCategory } from "@/lib/logbook";
import { canReview, currentUser, passwordChangeGate } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Anyone signed in reads them (the entry page groups forms by them); admins edit.
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ categories: [] }, { status: 401 });
  try {
    return NextResponse.json({ categories: await listFormCategories() });
  } catch (e) {
    return errorResponse("forms/categories", e);
  }
}

async function admin() {
  const user = await currentUser();
  if (!user || !canReview(user)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  return passwordChangeGate(user);
}

export async function POST(request: Request) {
  const denied = await admin();
  if (denied) return denied;
  try {
    const body = await request.json();
    const name = clean(body.name);
    if (!name) return NextResponse.json({ error: "Category name is required." }, { status: 400 });
    if (name.length > 60) return NextResponse.json({ error: "Keep the name under 60 characters." }, { status: 400 });
    const category = await createFormCategory(name, Number(body.displayOrder) || 0);
    return NextResponse.json({ category }, { status: 201 });
  } catch (e) {
    return errorResponse("forms/categories", e);
  }
}

export async function PATCH(request: Request) {
  const denied = await admin();
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });
  try {
    const body = await request.json();
    const name = body.name !== undefined ? clean(body.name) : undefined;
    if (name !== undefined && !name) return NextResponse.json({ error: "Category name is required." }, { status: 400 });
    const category = await updateFormCategory(id, {
      name,
      displayOrder: body.displayOrder !== undefined ? Number(body.displayOrder) : undefined,
    });
    if (!category) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ category });
  } catch (e) {
    return errorResponse("forms/categories", e);
  }
}

export async function DELETE(request: Request) {
  const denied = await admin();
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });
  try {
    await deleteFormCategory(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse("forms/categories", e);
  }
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
