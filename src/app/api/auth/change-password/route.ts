import { NextResponse } from "next/server";
import { changePassword } from "@/lib/logbook";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const body = await request.json();
  const newPassword = typeof body.newPassword === "string" ? body.newPassword.trim() : "";

  if (newPassword.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  try {
    await changePassword(user.id, newPassword);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Password change failed." }, { status: 500 });
  }
}
