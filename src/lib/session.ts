import { cookies } from "next/headers";
import { getCurrentUser, type AppUser } from "./logbook";

export const sessionCookieName = "lab_logbook_session";

export async function currentUser(): Promise<AppUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value || "";
  return getCurrentUser(token);
}

export function canReview(user: AppUser) {
  return user.role === "supervisor" || user.role === "admin";
}
