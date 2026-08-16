import { describe, expect, it, afterEach } from "vitest";
import { MIN_PASSWORD_LENGTH, passwordProblem } from "./password";

afterEach(() => {
  delete process.env.LAB_INITIAL_PASSWORD;
});

describe("passwordProblem", () => {
  it("accepts a long enough password", () => {
    expect(passwordProblem("correct-horse-battery")).toBeNull();
  });

  it("rejects anything under the minimum length", () => {
    expect(passwordProblem("a".repeat(MIN_PASSWORD_LENGTH - 1))).toMatch(/at least/);
  });

  it("accepts exactly the minimum length", () => {
    expect(passwordProblem("abcdefghij".slice(0, MIN_PASSWORD_LENGTH))).toBeNull();
  });

  it("does not demand symbols, digits or mixed case", () => {
    // NIST SP 800-63B: length is the control, composition rules are not.
    expect(passwordProblem("plainlowercasewords")).toBeNull();
  });

  it("rejects the shared initial password", () => {
    process.env.LAB_INITIAL_PASSWORD = "SharedStart2026!";
    expect(passwordProblem("SharedStart2026!")).toMatch(/different/);
  });

  it("rejects a password containing the username", () => {
    expect(passwordProblem("analyst07-is-here", { username: "analyst07" })).toMatch(/username/);
  });

  it("matches the username case-insensitively", () => {
    expect(passwordProblem("MyANALYST07Password", { username: "analyst07" })).toMatch(/username/);
  });

  it("ignores very short usernames so they don't block everything", () => {
    expect(passwordProblem("abcdefghijklm", { username: "ab" })).toBeNull();
  });

  it("rejects a single repeated character", () => {
    expect(passwordProblem("aaaaaaaaaaaaaa")).toMatch(/repeated/);
  });

  it("rejects an absurdly long password", () => {
    expect(passwordProblem("x".repeat(201))).toMatch(/or fewer/);
  });

  it("treats an empty password as too short", () => {
    expect(passwordProblem("")).toMatch(/at least/);
  });
});
