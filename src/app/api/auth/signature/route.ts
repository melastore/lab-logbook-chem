import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/errors";
import { logAudit } from "@/lib/logbook";
import { currentUser } from "@/lib/session";
import { getSavedSignature, removeSignature, saveSignature, validSignatureImage } from "@/lib/user-signature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Only ever the caller's own signature: there is no user parameter.

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });
  try {
    return NextResponse.json({ signature: await getSavedSignature(user.id) });
  } catch (e) {
    return errorResponse("signature", e);
  }
}

export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!validSignatureImage(body?.image)) {
    return NextResponse.json({ error: "That signature image can't be saved." }, { status: 400 });
  }
  try {
    const signature = await saveSignature(user.id, body.image, user.username);
    await logAudit({ actor: user.username, actorId: user.id, action: "signature.save", target: user.id });
    return NextResponse.json({ signature });
  } catch (e) {
    return errorResponse("signature", e);
  }
}

export async function DELETE() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });
  try {
    await removeSignature(user.id);
    await logAudit({ actor: user.username, actorId: user.id, action: "signature.remove", target: user.id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse("signature", e);
  }
}
