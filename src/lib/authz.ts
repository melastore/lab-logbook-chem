import type { UserRole } from "./logbook";

// Pure authorization predicates, shared by the API routes and unit tests so the
// access rules can't silently regress in a refactor. No I/O — callers fetch the
// target's role and pass it in.

export function isManager(role: UserRole): boolean {
  return role === "admin";
}

// Only admins create accounts, of either role.
export function canCreateRole(actorRole: UserRole): boolean {
  return actorRole === "admin";
}

// Only admins manage (reset password / rename / archive / delete) accounts.
export function canManageRole(actorRole: UserRole): boolean {
  return actorRole === "admin";
}

// Resolve which user's weekly plans a request may touch. Managers may target any
// user (or all, when target is undefined); everyone else is pinned to their own
// and is rejected if they ask for someone else's.
export function weeklyPlanTarget(
  role: UserRole,
  username: string,
  requested: string | undefined
): { ok: true; target: string | undefined } | { ok: false } {
  if (isManager(role)) return { ok: true, target: requested };
  if (requested && requested !== username) return { ok: false };
  return { ok: true, target: username };
}
