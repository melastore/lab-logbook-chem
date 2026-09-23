import { describe, it, expect } from "vitest";
import { canCreateRole, canManageRole, weeklyPlanTarget, isManager } from "./authz";

describe("authorization rules", () => {
  describe("isManager", () => {
    it("treats only admin as a manager", () => {
      expect(isManager("admin")).toBe(true);
      expect(isManager("analyst")).toBe(false);
    });
  });

  describe("canCreateRole / canManageRole — admin only", () => {
    it("lets admins create and manage any role", () => {
      expect(canCreateRole("admin")).toBe(true);
      expect(canCreateRole("admin")).toBe(true);
      expect(canManageRole("admin")).toBe(true);
      expect(canManageRole("admin")).toBe(true);
    });

    it("never lets analysts create or manage accounts", () => {
      expect(canCreateRole("analyst")).toBe(false);
      expect(canCreateRole("analyst")).toBe(false);
      expect(canManageRole("analyst")).toBe(false);
      expect(canManageRole("analyst")).toBe(false);
    });
  });

  describe("weeklyPlanTarget — analysts confined to their own plans", () => {
    it("pins an analyst to their own username", () => {
      expect(weeklyPlanTarget("analyst", "amir", undefined)).toEqual({ ok: true, target: "amir" });
      expect(weeklyPlanTarget("analyst", "amir", "amir")).toEqual({ ok: true, target: "amir" });
    });

    it("rejects an analyst requesting someone else's plans", () => {
      expect(weeklyPlanTarget("analyst", "amir", "bob")).toEqual({ ok: false });
    });

    it("lets managers target any user or all", () => {
      expect(weeklyPlanTarget("admin", "adm", "bob")).toEqual({ ok: true, target: "bob" });
      expect(weeklyPlanTarget("admin", "root", undefined)).toEqual({ ok: true, target: undefined });
    });
  });
});
