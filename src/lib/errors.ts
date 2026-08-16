import { NextResponse } from "next/server";

// Errors reach clients in two flavours. Anything we raise deliberately with a
// message written for the user is a PublicError and is echoed back verbatim.
// Everything else — PostgREST failures, fetch errors, bugs — is logged on the
// server and replaced with a generic message, so database schema, table names
// and infrastructure details never leave the box.

export class PublicError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PublicError";
    this.status = status;
  }
}

const GENERIC = "Something went wrong. Please try again.";

// Log the real cause with a route tag, hand back a response that is safe to show.
export function errorResponse(context: string, error: unknown, fallbackStatus = 500): NextResponse {
  if (error instanceof PublicError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(`[${context}]`, error);
  return NextResponse.json({ error: GENERIC }, { status: fallbackStatus });
}

// Same triage, but for places that need the string rather than a response.
export function publicMessage(context: string, error: unknown): string {
  if (error instanceof PublicError) return error.message;
  console.error(`[${context}]`, error);
  return GENERIC;
}
