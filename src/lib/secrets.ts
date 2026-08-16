import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Authenticated encryption for secrets we have to store but must never expose:
// today that means TOTP seeds. AES-256-GCM, key from APP_ENCRYPTION_KEY (32
// bytes, base64). Ciphertext is self-describing so the format can be revised
// later without guessing what an old row holds.
//
// Rows written before this existed are plain text. decryptSecret passes those
// through untouched, and the next write re-encrypts them, so an existing
// install keeps working while it migrates. scripts/encrypt-totp-secrets.mjs
// does the same sweep in one go.

const PREFIX = "enc:v1:";

function key(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY || "";
  if (!raw) {
    throw new Error(
      "APP_ENCRYPTION_KEY is not configured. Generate one with: openssl rand -base64 32"
    );
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY must decode to exactly 32 bytes (base64 of 32 random bytes).");
  }
  return buf;
}

export function encryptionConfigured(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptSecret(stored: string): string {
  if (!isEncrypted(stored)) return stored; // legacy plaintext row

  const [ivB64, tagB64, dataB64] = stored.slice(PREFIX.length).split(":");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Malformed encrypted value.");

  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
