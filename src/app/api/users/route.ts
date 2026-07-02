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
  logAudit,
  type UserRole,
} from "@/lib/logbook";
import { canReview, currentUser, passwordChangeGate } from "@/lib/session";
import { canCreateRole, canManageRole } from "@/lib/authz";

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
  const gate = passwordChangeGate(user);
  if (gate) return gate;

  const body = await request.json();
  if (body.action === "provisionAll") {
    // The generated list includes admin accounts, so this is admin-only.
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }
    let created = 0, skipped = 0;
    const provisioned = await listProvisionedUsernames();
    const provisionedSet = new Set(provisioned);
    for (const gen of GENERATED_USERS) {
      if (provisionedSet.has(gen.username)) { skipped++; continue; }
      try { await provisionUser(gen); created++; } catch { skipped++; }
    }
    await logAudit({ actor: user.username, actorId: user.id, action: "user.provision_all", detail: { created, skipped } });
    return NextResponse.json({ created, skipped });
  }

  if (body.action === "create") {
    const fullName = clean(body.fullName);
    const username = clean(body.username);
    const email = clean(body.email);
    const position = clean(body.position);
    const password = typeof body.password === "string" ? body.password : "";
    const role = (["analyst", "supervisor", "admin"].includes(body.role) ? body.role : "analyst") as UserRole;

    // Only admins may mint accounts at or above supervisor level.
    if (!canCreateRole(user.role, role)) {
      return NextResponse.json({ error: "Admin access required to create that role." }, { status: 403 });
    }
    if (!fullName || !username || !email || password.length < 6) {
      return NextResponse.json(
        { error: "Full name, email, username and a password (6+ chars) are required." },
        { status: 400 }
      );
    }
    try {
      await createNewUser({ email, username, fullName, role, position, password });
      await logAudit({ actor: user.username, actorId: user.id, action: "user.create", target: username, detail: { role } });
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

// Supervisors may only manage analyst accounts; touching a supervisor or admin
// account (password resets, renames, archive, delete) requires an admin.
async function canManageTarget(actorRole: UserRole, targetUsername: string) {
  if (actorRole === "admin") return true;
  const profiles = await listProfiles();
  const target = profiles.find((p) => p.username === targetUsername);
  // Unknown target: let the action's own "not found" error surface.
  return !target || canManageRole(actorRole, target.role);
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user || !canReview(user)) {
    return NextResponse.json({ error: "Supervisor access required." }, { status: 403 });
  }
  const gate = passwordChangeGate(user);
  if (gate) return gate;

  const body = await request.json();
  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (!username) return NextResponse.json({ error: "username required." }, { status: 400 });

  if (!(await canManageTarget(user.role, username))) {
    return NextResponse.json({ error: "Admin access required to manage this account." }, { status: 403 });
  }

  if (body.action === "resetPassword") {
    const profiles = await listProfiles();
    const target = profiles.find((p) => p.username === username);
    const gen = GENERATED_USERS.find((u) => u.username === username || u.email === target?.email);
    if (!gen) return NextResponse.json({ error: "User not in generated list." }, { status: 404 });
    try {
      await resetUserPassword(username, gen.initialPassword);
      await logAudit({ actor: user.username, actorId: user.id, action: "user.password_reset", target: username });
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
      await logAudit({ actor: user.username, actorId: user.id, action: `user.${body.action}`, target: username });
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
      await logAudit({
        actor: user.username, actorId: user.id, action: "user.update_credentials", target: username,
        detail: { renamed: !!newUsername, passwordReset: !!newPassword, nameChanged: !!newFullName },
      });
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
  const gate = passwordChangeGate(user);
  if (gate) return gate;

  const body = await request.json();
  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (!username) return NextResponse.json({ error: "username required." }, { status: 400 });
  if (username === user.username) {
    return NextResponse.json({ error: "Cannot delete your own account." }, { status: 400 });
  }
  if (!(await canManageTarget(user.role, username))) {
    return NextResponse.json({ error: "Admin access required to manage this account." }, { status: 403 });
  }

  try {
    await deleteUser(username);
    await logAudit({ actor: user.username, actorId: user.id, action: "user.delete", target: username });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
