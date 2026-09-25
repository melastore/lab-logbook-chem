import { describe, expect, it } from "vitest";
import { currentVersionIds } from "./logbook";

describe("currentVersionIds", () => {
  it("keeps only the newest correction of each record", () => {
    const ids = currentVersionIds([
      { id: "a", amends: null, createdAt: "2026-01-01T00:00:00Z" },
      { id: "a1", amends: "a", createdAt: "2026-01-02T00:00:00Z" },
      { id: "a2", amends: "a", createdAt: "2026-01-03T00:00:00Z" },
      { id: "b", amends: null, createdAt: "2026-01-01T00:00:00Z" },
    ]);
    expect([...ids].sort()).toEqual(["a2", "b"]);
  });
});
