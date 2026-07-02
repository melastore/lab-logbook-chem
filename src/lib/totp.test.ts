import { describe, it, expect } from "vitest";
import { generateSecret, verifyTotp } from "./totp";
import { createHmac } from "crypto";

// Reimplement the HOTP step independently so the test isn't just asserting the
// implementation against itself — it derives the expected code from the RFC math.
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Decode(input: string): Buffer {
  let bits = "";
  for (const ch of input.toUpperCase()) {
    const idx = BASE32.indexOf(ch);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
function codeFor(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (code % 1_000_000).toString().padStart(6, "0");
}

describe("TOTP two-factor codes", () => {
  it("generates a 32-char base32 secret", () => {
    const secret = generateSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
  });

  it("accepts the current code and rejects a wrong one", () => {
    const secret = generateSecret();
    const now = Math.floor(Date.now() / 1000 / 30);
    expect(verifyTotp(secret, codeFor(secret, now))).toBe(true);
    expect(verifyTotp(secret, "000000")).toBe(false);
    expect(verifyTotp(secret, "")).toBe(false);
    expect(verifyTotp(secret, "12345")).toBe(false); // too short
  });

  it("tolerates ±1 step of clock drift but not more", () => {
    const secret = generateSecret();
    const now = Math.floor(Date.now() / 1000 / 30);
    expect(verifyTotp(secret, codeFor(secret, now - 1))).toBe(true);
    expect(verifyTotp(secret, codeFor(secret, now + 1))).toBe(true);
    expect(verifyTotp(secret, codeFor(secret, now + 5))).toBe(false);
  });

  it("does not cross-verify between two different secrets", () => {
    const a = generateSecret();
    const b = generateSecret();
    const now = Math.floor(Date.now() / 1000 / 30);
    expect(verifyTotp(b, codeFor(a, now))).toBe(false);
  });
});
