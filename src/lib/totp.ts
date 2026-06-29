import { createHmac, randomBytes, timingSafeEqual } from "crypto";

// RFC 6238 TOTP, RFC 4226 HOTP — implemented on node:crypto so we don't pull in
// an auth dependency. Works with Google Authenticator, Authy, 1Password, etc.

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const DIGITS = 6;
const PERIOD = 30; // seconds per code

// Generate a random base32 secret (no padding) — 20 bytes = 160 bits.
export function generateSecret(): string {
  const bytes = randomBytes(20);
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    out += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  return out;
}

function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").replace(/\s/g, "").toUpperCase();
  let bits = "";
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function hotp(secret: string, counter: number): string {
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
  return (code % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

// Verify a user-entered token, tolerating ±1 step for clock drift.
export function verifyTotp(secret: string, token: string, window = 1): boolean {
  const cleaned = (token || "").replace(/\D/g, "");
  if (cleaned.length !== DIGITS) return false;
  const counter = Math.floor(Date.now() / 1000 / PERIOD);
  for (let i = -window; i <= window; i++) {
    const expected = hotp(secret, counter + i);
    const a = Buffer.from(expected);
    const b = Buffer.from(cleaned);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

// otpauth:// URI consumed by authenticator apps (also encoded into the QR code).
export function totpUri(secret: string, account: string, issuer = "Lab Logbook"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(PERIOD),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
