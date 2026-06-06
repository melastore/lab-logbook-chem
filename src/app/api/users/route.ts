import { NextResponse } from "next/server";
import {
  GENERATED_USERS,
  listProfiles,
  listProvisionedUsernames,
  provisionUser,
  resetUserPassword,
  deleteUser,
  updateUserCredentials,
  createNewUser,
  setUserArchived,
  type UserRole,
} from "@/lib/logbook";
import { canReview, currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user || !canReview(user)) {
    return NextResponse.json({ error: "Supervisor access required." }, { status: 403 });
  }
  try {
    const [profiles, provisionedUsernames] = await Promise.all([
      listProfiles(),
      listProvisionedUsernames(),
    ]);
    return NextResponse.json({ profiles, provisionedUsernames });
  } catch (e) {
    return NextResponse.json({ profiles: [], provisionedUsernames: [], error: String(e) });
  }
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user || !canReview(user)) {
    return NextResponse.json({ error: "Supervisor access required." }, { status: 403 });
  }

  const body = await request.json();
  if (body.action === "provisionAll") {
    let created = 0, skipped = 0;
    const provisioned = await listProvisionedUsernames();
    const provisionedSet = new Set(provisioned);
    for (const gen of GENERATED_USERS) {
      if (provisionedSet.has(gen.username)) { skipped++; continue; }
      try { await provisionUser(gen); created++; } catch { skipped++; }
    }
    return NextResponse.json({ created, skipped });
  }

  if (body.action === "create") {
    const fullName = clean(body.fullName);
    const username = clean(body.username);
    const email = clean(body.email);
    const position = clean(body.position);
    const password = typeof body.password === "string" ? body.password : "";
    const role = (["analyst", "supervisor", "admin"].includes(body.role) ? body.role : "analyst") as UserRole;

    if (!fullName || !username || !email || password.length < 6) {
      return NextResponse.json(
        { error: "Full name, email, username and a password (6+ chars) are required." },
        { status: 400 }
      );
    }
    try {
      await createNewUser({ email, username, fullName, role, position, password });
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user || !canReview(user)) {
    return NextResponse.json({ error: "Supervisor access required." }, { status: 403 });
  }

  const body = await request.json();
  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (!username) return NextResponse.json({ error: "username required." }, { status: 400 });

  if (body.action === "resetPassword") {
    const profiles = await listProfiles();
    const target = profiles.find((p) => p.username === username);
    const gen = GENERATED_USERS.find((u) => u.username === username || u.email === target?.email);
    if (!gen) return NextResponse.json({ error: "User not in generated list." }, { status: 404 });
    try {
      await resetUserPassword(username, gen.initialPassword);
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  if (body.action === "archive" || body.action === "unarchive") {
    if (username === user.username) {
      return NextResponse.json({ error: "You cannot archive your own account." }, { status: 400 });
    }
    try {
      await setUserArchived(username, body.action === "archive");
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
    }
  }

  if (body.action === "updateCredentials") {
    const newUsername = typeof body.newUsername === "string" && body.newUsername.trim()
      ? body.newUsername.trim() : undefined;
    const newPassword = typeof body.newPassword === "string" && body.newPassword.trim()
      ? body.newPassword.trim() : undefined;
    const newFullName = typeof body.newFullName === "string" && body.newFullName.trim()
      ? body.newFullName.trim() : undefined;
    const newPosition = typeof body.newPosition === "string" ? body.newPosition.trim() : undefined;
    if (!newUsername && !newPassword && !newFullName && newPosition === undefined) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }
    try {
      await updateUserCredentials(username, { newUsername, newPassword, newFullName, newPosition });
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user || !canReview(user)) {
    return NextResponse.json({ error: "Supervisor access required." }, { status: 403 });
  }

  const body = await request.json();
  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (!username) return NextResponse.json({ error: "username required." }, { status: 400 });
  if (username === user.username) {
    return NextResponse.json({ error: "Cannot delete your own account." }, { status: 400 });
  }

  try {
    await deleteUser(username);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
