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
