import { describe, it, expect } from "vitest";
import { rateLimit, rateLimitClear } from "./rate-limit";

describe("login rate limiter", () => {
  it("allows up to the limit, then blocks", () => {
    const key = `test-block-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(key, 5, 60_000).allowed).toBe(true);
    }
    const blocked = rateLimit(key, 5, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("clears on success so a good login resets the counter", () => {
    const key = `test-clear-${Math.random()}`;
    rateLimit(key, 3, 60_000);
    rateLimit(key, 3, 60_000);
    rateLimitClear(key);
    // Fresh window again — three more attempts should be allowed.
    expect(rateLimit(key, 3, 60_000).allowed).toBe(true);
    expect(rateLimit(key, 3, 60_000).allowed).toBe(true);
    expect(rateLimit(key, 3, 60_000).allowed).toBe(true);
  });

  it("keeps separate counters per key (per username)", () => {
    const a = `test-a-${Math.random()}`;
    const b = `test-b-${Math.random()}`;
    expect(rateLimit(a, 1, 60_000).allowed).toBe(true);
    expect(rateLimit(a, 1, 60_000).allowed).toBe(false);
    // b is untouched by a's exhaustion.
    expect(rateLimit(b, 1, 60_000).allowed).toBe(true);
  });
});
