import { describe, expect, it, beforeAll } from "vitest";
import { randomBytes } from "crypto";
import { decryptSecret, encryptSecret, encryptionConfigured, isEncrypted } from "./secrets";

beforeAll(() => {
  process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

describe("secrets", () => {
  it("round-trips a value", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it("marks ciphertext as encrypted and leaves plaintext alone", () => {
    expect(isEncrypted(encryptSecret("abc"))).toBe(true);
    expect(isEncrypted("JBSWY3DPEHPK3PXP")).toBe(false);
  });

  it("produces different ciphertext each time for the same input", () => {
    // A fresh IV per write; otherwise identical seeds would be linkable.
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("passes a legacy plaintext seed straight through", () => {
    // Rows written before encryption existed must keep working.
    expect(decryptSecret("JBSWY3DPEHPK3PXP")).toBe("JBSWY3DPEHPK3PXP");
  });

  it("rejects tampered ciphertext instead of returning garbage", () => {
    const encrypted = encryptSecret("JBSWY3DPEHPK3PXP");
    const parts = encrypted.split(":");
    const data = Buffer.from(parts[4], "base64");
    data[0] ^= 0xff;
    parts[4] = data.toString("base64");

    expect(() => decryptSecret(parts.join(":"))).toThrow();
  });

  it("rejects a value encrypted under a different key", () => {
    const encrypted = encryptSecret("JBSWY3DPEHPK3PXP");
    const original = process.env.APP_ENCRYPTION_KEY;
    process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    try {
      expect(() => decryptSecret(encrypted)).toThrow();
    } finally {
      process.env.APP_ENCRYPTION_KEY = original;
    }
  });

  it("refuses a key that is not 32 bytes", () => {
    const original = process.env.APP_ENCRYPTION_KEY;
    process.env.APP_ENCRYPTION_KEY = Buffer.from("too short").toString("base64");
    try {
      expect(encryptionConfigured()).toBe(false);
      expect(() => encryptSecret("x")).toThrow(/32 bytes/);
    } finally {
      process.env.APP_ENCRYPTION_KEY = original;
    }
  });

  it("reports a missing key rather than writing something unprotected", () => {
    const original = process.env.APP_ENCRYPTION_KEY;
    delete process.env.APP_ENCRYPTION_KEY;
    try {
      expect(encryptionConfigured()).toBe(false);
      expect(() => encryptSecret("x")).toThrow(/APP_ENCRYPTION_KEY/);
    } finally {
      process.env.APP_ENCRYPTION_KEY = original;
    }
  });
});
