import { describe, expect, it } from "vitest";
import { evalAchFormula } from "./weekly-plan";

const vars = { H: 0.2, C: 8 };

describe("evalAchFormula", () => {
  it("resolves row references and applies precedence", () => {
    expect(evalAchFormula("=H13*80/100", vars)).toBeCloseTo(0.16);
    expect(evalAchFormula("=C13/40", vars)).toBeCloseTo(0.2);
    expect(evalAchFormula("=1+2*3", vars)).toBe(7);
    expect(evalAchFormula("=(1+2)*3", vars)).toBe(9);
    expect(evalAchFormula("=-H13+.5", vars)).toBeCloseTo(0.3);
  });

  it("returns null for half-typed or invalid input", () => {
    expect(evalAchFormula("=", vars)).toBeNull();
    expect(evalAchFormula("=H13*", vars)).toBeNull();
    expect(evalAchFormula("=(1+2", vars)).toBeNull();
    expect(evalAchFormula("=1/0", vars)).toBeNull();
    expect(evalAchFormula("=alert(1)", vars)).toBeNull();
  });

  it("does not rely on eval, which the production CSP blocks", () => {
    const original = globalThis.Function;
    globalThis.Function = (() => { throw new EvalError("blocked"); }) as unknown as FunctionConstructor;
    try {
      expect(evalAchFormula("=H13*50/100", vars)).toBeCloseTo(0.1);
    } finally {
      globalThis.Function = original;
    }
  });
});

describe("week keys", () => {
  it("snaps any day to its Monday without UTC drift", async () => {
    const { mondayOf, normalizeWeekKey, addWeeks } = await import("./weekly-plan");
    expect(mondayOf("2026-09-24")).toBe("2026-09-21");
    expect(mondayOf("2026-09-21")).toBe("2026-09-21");
    expect(mondayOf(new Date(2026, 8, 27, 1, 30))).toBe("2026-09-21");
    expect(normalizeWeekKey("2026-09-20")).toBe("2026-09-21"); // legacy Sunday key
    expect(normalizeWeekKey("2026-09-23")).toBe("2026-09-21");
    expect(normalizeWeekKey("bad")).toBe("");
    expect(addWeeks("2026-09-21", -1)).toBe("2026-09-14");
  });

  it("sanitizes stored tasks", async () => {
    const { sanitizeTasks } = await import("./weekly-plan");
    const [t] = sanitizeTasks([{ id: "a", hours: -5, activity: 42, date: "2026-02-30", evil: 1 }]);
    expect(t).toMatchObject({ id: "a", hours: 0, activity: "", date: "" });
    expect(t).not.toHaveProperty("evil");
    expect(sanitizeTasks("nope")).toEqual([]);
  });
});
