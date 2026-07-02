import { describe, it, expect } from "vitest";
import { canCreateRole, canManageRole, weeklyPlanTarget, isManager } from "./authz";

describe("authorization rules", () => {
  describe("isManager", () => {
    it("treats supervisor and admin as managers, analyst not", () => {
      expect(isManager("admin")).toBe(true);
      expect(isManager("supervisor")).toBe(true);
      expect(isManager("analyst")).toBe(false);
    });
  });

  describe("canCreateRole — only admins mint elevated accounts", () => {
    it("lets admins create any role", () => {
      expect(canCreateRole("admin", "analyst")).toBe(true);
      expect(canCreateRole("admin", "supervisor")).toBe(true);
      expect(canCreateRole("admin", "admin")).toBe(true);
    });

    it("lets supervisors create analysts only (blocks privilege escalation)", () => {
      expect(canCreateRole("supervisor", "analyst")).toBe(true);
      expect(canCreateRole("supervisor", "supervisor")).toBe(false);
      expect(canCreateRole("supervisor", "admin")).toBe(false);
    });

    it("never lets analysts create accounts", () => {
      expect(canCreateRole("analyst", "analyst")).toBe(false);
      expect(canCreateRole("analyst", "admin")).toBe(false);
    });
  });

  describe("canManageRole — supervisors can't touch admin accounts", () => {
    it("lets admins manage everyone", () => {
      expect(canManageRole("admin", "admin")).toBe(true);
      expect(canManageRole("admin", "supervisor")).toBe(true);
      expect(canManageRole("admin", "analyst")).toBe(true);
    });

    it("lets supervisors manage analysts only", () => {
      expect(canManageRole("supervisor", "analyst")).toBe(true);
      expect(canManageRole("supervisor", "supervisor")).toBe(false);
      expect(canManageRole("supervisor", "admin")).toBe(false);
    });

    it("never lets analysts manage anyone", () => {
      expect(canManageRole("analyst", "analyst")).toBe(false);
      expect(canManageRole("analyst", "admin")).toBe(false);
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
      expect(weeklyPlanTarget("supervisor", "sup", "bob")).toEqual({ ok: true, target: "bob" });
      expect(weeklyPlanTarget("admin", "root", undefined)).toEqual({ ok: true, target: undefined });
    });
  });
});
