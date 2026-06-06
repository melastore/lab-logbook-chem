import { NextResponse } from "next/server";
import { updateCurrentUserProfile } from "@/lib/logbook";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const usernamePattern = /^[a-z0-9._-]{3,32}$/i;
const avatarSeedPattern = /^[a-zA-Z0-9:_-]{1,80}$/;

export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }
  return NextResponse.json({ user });
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const body = await request.json();
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const avatarSeed = typeof body.avatarSeed === "string" ? body.avatarSeed.trim() : "";

  if (!username && !avatarSeed) {
    return NextResponse.json({ error: "Provide a username or avatar." }, { status: 400 });
  }

  if (username && !usernamePattern.test(username)) {
    return NextResponse.json({
      error: "Username must be 3-32 characters using letters, numbers, dots, underscores, or hyphens.",
    }, { status: 400 });
  }

  if (avatarSeed && !avatarSeedPattern.test(avatarSeed)) {
    return NextResponse.json({ error: "Invalid avatar seed." }, { status: 400 });
  }

  try {
    const updatedUser = await updateCurrentUserProfile(user.id, {
      username: username ? username.toLowerCase() : undefined,
      avatarSeed: avatarSeed || undefined,
    });
    return NextResponse.json({ user: updatedUser });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Profile update failed." }, { status: 500 });
  }
}
