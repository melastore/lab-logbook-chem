// Kept in their own module so the edge middleware can import the names without
// dragging in next/headers and the Node-only Supabase client from session.ts.

export const sessionCookieName = "lab_logbook_session";
export const sessionRefreshCookieName = "lab_logbook_refresh";
