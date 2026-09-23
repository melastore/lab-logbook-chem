import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/errors";
import {
  GENERATED_USERS,
  normalizeRole,
  listProfiles,
  listProvisionedUsernames,
  provisionUser,
  resetUserPassword,
  deleteUser,
  updateUserCredentials,
  createNewUser,
  setUserArchived,
  logAudit,
} from "@/lib/logbook";
import { canReview, currentUser, passwordChangeGate } from "@/lib/session";
import { canCreateRole, canManageRole } from "@/lib/authz";
import { passwordProblem } from "@/lib/password";
import { renameWeeklyPlans } from "@/lib/weekly-plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user || !canReview(user)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  try {
    const [profiles, provisionedUsernames] = await Promise.all([
      listProfiles(),
      listProvisionedUsernames(),
    ]);
    return NextResponse.json({ profiles, provisionedUsernames });
  } catch (e) {
    console.error("[users] list failed:", e);
    return NextResponse.json({ profiles: [], provisionedUsernames: [], error: "Could not load users." });
  }
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user || !canReview(user)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const gate = passwordChangeGate(user);
  if (gate) return gate;

  const body = await request.json();
  if (body.action === "provisionAll") {
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
    const username = clean(body.username).toLowerCase();
    const email = clean(body.email).toLowerCase();
    const position = clean(body.position);
    const password = typeof body.password === "string" ? body.password : "";
    const role = normalizeRole(body.role);

    if (!canCreateRole(user.role)) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }
    if (!fullName || !username || !email) {
      return NextResponse.json(
        { error: "Full name, email and username are required." },
        { status: 400 }
      );
    }
    if (!USERNAME_RE.test(username)) {
      return NextResponse.json({ error: USERNAME_HINT }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    // Same floor as a self-service change — an admin-set password shouldn't be
    // allowed to be weaker than one the user picks.
    const problem = passwordProblem(password, { username });
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    try {
      await createNewUser({ email, username, fullName, role, position, password });
      await logAudit({ actor: user.username, actorId: user.id, action: "user.create", target: username, detail: { role } });
      return NextResponse.json({ ok: true });
    } catch (e) {
      return errorResponse("users", e, 500);
    }
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/i;
const USERNAME_HINT = "Username must be 3-32 characters using letters, numbers, dots, underscores, or hyphens.";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user || !canReview(user)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const gate = passwordChangeGate(user);
  if (gate) return gate;

  const body = await request.json();
  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (!username) return NextResponse.json({ error: "username required." }, { status: 400 });

  if (!canManageRole(user.role)) {
    return NextResponse.json({ error: "Admin access required to manage this account." }, { status: 403 });
  }

  if (body.action === "resetPassword") {
    // Any account, not just the pre-generated ones, can go back to the shared
    // initial password; the user then has to pick a new one on next login.
    try {
      await resetUserPassword(username, process.env.LAB_INITIAL_PASSWORD ?? "");
      await logAudit({ actor: user.username, actorId: user.id, action: "user.password_reset", target: username });
      return NextResponse.json({ ok: true });
    } catch (e) {
      return errorResponse("users", e, 500);
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
      return errorResponse("users", e, 500);
    }
  }

  if (body.action === "updateCredentials") {
    const newUsername = typeof body.newUsername === "string" && body.newUsername.trim()
      ? body.newUsername.trim() : undefined;
    if (newUsername && !USERNAME_RE.test(newUsername)) {
      return NextResponse.json({ error: USERNAME_HINT }, { status: 400 });
    }
    // Passwords are taken as typed (no trimming) so what the admin hands over
    // is exactly what works at the login screen.
    const newPassword = typeof body.newPassword === "string" && body.newPassword.trim()
      ? body.newPassword : undefined;
    if (newPassword) {
      const problem = passwordProblem(newPassword, { username: newUsername || username });
      if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    }
    const newFullName = typeof body.newFullName === "string" && body.newFullName.trim()
      ? body.newFullName.trim() : undefined;
    const newPosition = typeof body.newPosition === "string" ? body.newPosition.trim() : undefined;
    const newRole = body.newRole === undefined ? undefined : normalizeRole(body.newRole);
    if (newRole && username.toLowerCase() === user.username.toLowerCase()) {
      return NextResponse.json({ error: "You cannot change your own role." }, { status: 400 });
    }
    if (!newUsername && !newPassword && !newFullName && newPosition === undefined && !newRole) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }
    try {
      const oldUsername = (await listProfiles()).find((p) => p.username.toLowerCase() === username.toLowerCase())?.username || username;
      await updateUserCredentials(username, { newUsername, newPassword, newFullName, newPosition, newRole });
      if (newUsername) await renameWeeklyPlans(oldUsername, newUsername.toLowerCase());
      await logAudit({
        actor: user.username, actorId: user.id, action: "user.update_credentials", target: username,
        detail: { renamed: !!newUsername, passwordReset: !!newPassword, nameChanged: !!newFullName, role: newRole },
      });
      return NextResponse.json({ ok: true });
    } catch (e) {
      return errorResponse("users", e, 500);
    }
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user || !canReview(user)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const gate = passwordChangeGate(user);
  if (gate) return gate;

  const body = await request.json();
  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (!username) return NextResponse.json({ error: "username required." }, { status: 400 });
  if (username === user.username) {
    return NextResponse.json({ error: "Cannot delete your own account." }, { status: 400 });
  }
  if (!canManageRole(user.role)) {
    return NextResponse.json({ error: "Admin access required to manage this account." }, { status: 403 });
  }

  try {
    await deleteUser(username);
    await logAudit({ actor: user.username, actorId: user.id, action: "user.delete", target: username });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse("users", e, 500);
  }
}
