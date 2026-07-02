import { NextResponse } from "next/server";
import { listForms, createForm, updateForm, deleteForm } from "@/lib/logbook";
import type { FieldType, FormField, FormScope } from "@/lib/forms";
import { canReview, currentUser, passwordChangeGate } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIELD_TYPES: FieldType[] = ["text", "date", "time", "textarea", "number", "select"];

// Any signed-in user can read the forms (the data-entry page needs them);
// only supervisors/admins may change them.
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ forms: [] }, { status: 401 });
  try {
    const forms = await listForms();
    return NextResponse.json({ forms });
  } catch {
    return NextResponse.json({ forms: [] });
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
    const id = slug(body.id) || slug(body.title) || `form-${Date.now()}`;
    const title = clean(body.title);
    const activityType = clean(body.activityType).toUpperCase();
    if (!title || !activityType) {
      return NextResponse.json({ error: "Title and activity type are required." }, { status: 400 });
    }
    const form = await createForm({
      id,
      title,
      activityType,
      scope: scope(body.scope),
      fields: sanitizeFields(body.fields),
      displayOrder: Number(body.displayOrder) || 0,
    });
    return NextResponse.json({ form }, { status: 201 });
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
    const form = await updateForm(id, {
      title:        body.title        !== undefined ? clean(body.title)                    : undefined,
      activityType: body.activityType !== undefined ? clean(body.activityType).toUpperCase() : undefined,
      scope:        body.scope        !== undefined ? scope(body.scope)                    : undefined,
      fields:       body.fields       !== undefined ? sanitizeFields(body.fields)          : undefined,
      displayOrder: body.displayOrder !== undefined ? Number(body.displayOrder)            : undefined,
    });
    if (!form) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ form });
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
    await deleteForm(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function slug(value: unknown) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function scope(value: unknown): FormScope {
  return value === "sample" || value === "instrument" ? value : "analytical";
}

// Drops malformed fields and coerces each into a clean FormField. A field must
// have a key and a label to be kept.
function sanitizeFields(value: unknown): FormField[] {
  if (!Array.isArray(value)) return [];
  const fields: FormField[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const key = slugKey(r.key) || slugKey(r.label);
    const label = clean(r.label);
    if (!key || !label) continue;
    const type = FIELD_TYPES.includes(r.type as FieldType) ? (r.type as FieldType) : "text";
    const field: FormField = { key, label, type };
    if (r.required === true) field.required = true;
    if (clean(r.placeholder)) field.placeholder = clean(r.placeholder);
    if (r.full === true) field.full = true;
    if (type === "select") {
      const options = Array.isArray(r.options)
        ? r.options.map((o) => clean(o)).filter(Boolean)
        : [];
      if (options.length) field.options = options;
    }
    fields.push(field);
  }
  return fields;
}

// Field keys are used directly as object keys / column lookups, so keep them as
// safe camel-ish identifiers.
function slugKey(value: unknown) {
  const s = clean(value).replace(/[^a-zA-Z0-9 _-]/g, "").trim();
  if (!s) return "";
  const parts = s.split(/[\s_-]+/);
  return parts
    .map((p, i) => (i === 0 ? p.charAt(0).toLowerCase() + p.slice(1) : p.charAt(0).toUpperCase() + p.slice(1)))
    .join("");
}
