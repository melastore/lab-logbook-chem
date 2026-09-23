import { describe, expect, it } from "vitest";
import { currentVersionIds, statusFrom, type RecordReview } from "./logbook";

const review = (decision: RecordReview["decision"]): RecordReview => ({
  id: decision, createdAt: "", recordId: "r", decision, comment: "", reviewerName: "", hashMatches: true,
});

describe("statusFrom", () => {
  it("is Pending with no reviews", () => {
    expect(statusFrom([])).toBe("Pending");
  });

  it("uses the latest decision and ignores comments", () => {
    expect(statusFrom([review("Rejected"), review("Approved"), review("Comment")])).toBe("Approved");
    expect(statusFrom([review("Approved"), review("Rejected")])).toBe("Rejected");
    expect(statusFrom([review("Comment")])).toBe("Pending");
  });
});

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
