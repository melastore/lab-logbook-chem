import { NextResponse } from "next/server";
import { listCategories, createCategory, updateCategory, deleteCategory } from "@/lib/logbook";
import { canReview, currentUser, passwordChangeGate } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ categories: [] }, { status: 401 });
  try {
    const categories = await listCategories();
    return NextResponse.json({ categories });
  } catch {
    return NextResponse.json({ categories: [] });
  }
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user || !canReview(user)) {
    return NextResponse.json({ error: "Supervisor access required." }, { status: 403 });
  }
  const gate = passwordChangeGate(user);
  if (gate) return gate;
  try {
    const body = await request.json();
    const name = clean(body.name);
    if (!name) return NextResponse.json({ error: "Category name is required." }, { status: 400 });
    const category = await createCategory({ name, displayOrder: Number(body.displayOrder) || 0 });
    return NextResponse.json({ category }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user || !canReview(user)) {
    return NextResponse.json({ error: "Supervisor access required." }, { status: 403 });
  }
  const gate = passwordChangeGate(user);
  if (gate) return gate;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });
  try {
    const body = await request.json();
    const category = await updateCategory(id, {
      name:         body.name         !== undefined ? clean(body.name)          : undefined,
      displayOrder: body.displayOrder !== undefined ? Number(body.displayOrder) : undefined,
    });
    if (!category) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ category });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user || !canReview(user)) {
    return NextResponse.json({ error: "Supervisor access required." }, { status: 403 });
  }
  const gate = passwordChangeGate(user);
  if (gate) return gate;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });
  try {
    await deleteCategory(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 400 });
  }
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
