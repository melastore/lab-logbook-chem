import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { listRecords, type AppUser } from "./logbook";

// listRecords decides who may see which logbook entries. Everything it returns
// carries an analyst's name and their drawn signature, so the scoping is a
// privacy boundary, not a convenience — these tests pin it to the query.

const requestedUrls: string[] = [];

function user(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    email: "analyst07@lab.local",
    username: "analyst07",
    fullName: "Analyst User 07",
    role: "analyst",
    passwordChangeRequired: false,
    avatarSeed: "seed",
    ...overrides,
  };
}

beforeEach(() => {
  requestedUrls.length = 0;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    requestedUrls.push(String(url));
    const body = String(url).includes("/profiles")
      ? JSON.stringify([{ id: "22222222-2222-2222-2222-222222222222", username: "analyst08", role: "analyst" }])
      : "[]";
    return new Response(body, { status: 200 });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function recordQuery() {
  return requestedUrls.find((u) => u.includes("/logbook_records")) ?? "";
}

describe("listRecords scoping", () => {
  it("restricts an analyst to their own submissions", async () => {
    await listRecords(user());
    expect(recordQuery()).toContain(`submitted_by=eq.${user().id}`);
  });

  it("does not restrict a supervisor", async () => {
    await listRecords(user({ role: "supervisor" }));
    expect(recordQuery()).not.toContain("submitted_by=eq.");
  });

  it("does not restrict an admin", async () => {
    await listRecords(user({ role: "admin" }));
    expect(recordQuery()).not.toContain("submitted_by=eq.");
  });

  it("returns nothing when an analyst asks for someone else's records", async () => {
    const records = await listRecords(user(), "analyst08");
    expect(records).toEqual([]);
    // It must not reach the records table at all, so nothing can leak.
    expect(recordQuery()).toBe("");
  });

  it("still serves an analyst their own records when they name themselves", async () => {
    await listRecords(user(), "ANALYST07");
    expect(recordQuery()).toContain(`submitted_by=eq.${user().id}`);
  });

  it("lets a supervisor narrow to one analyst", async () => {
    await listRecords(user({ role: "supervisor", username: "sup01" }), "analyst08");
    expect(recordQuery()).toContain("submitted_by=eq.22222222-2222-2222-2222-222222222222");
  });
});

describe("username lookup", () => {
  it("does not let a LIKE wildcard resolve to another account", async () => {
    // `_` is legal in a username and is also a single-character wildcard in a
    // LIKE pattern, so "analyst0_" must not silently resolve to "analyst08".
    const records = await listRecords(user({ role: "admin" }), "analyst0_");
    expect(records).toEqual([]);
    expect(recordQuery()).toBe("");
  });
});
