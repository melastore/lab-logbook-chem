#!/usr/bin/env node
// One-time migration: encrypt any TOTP seed still stored in plain text.
//
// Only needed for installs that had 2FA enrollments before secrets were
// encrypted at rest. New enrollments are encrypted on write, and the app reads
// plaintext rows fine, so this is a cleanup you can run at your convenience —
// it is safe to run more than once and skips rows that are already encrypted.
//
//   node --env-file=.env.local scripts/encrypt-totp-secrets.mjs [--dry-run]

import { createCipheriv, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";
const dryRun = process.argv.includes("--dry-run");

const url = requireEnv("SUPABASE_URL").replace(/\/$/, "");
const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const encryptionKey = Buffer.from(requireEnv("APP_ENCRYPTION_KEY"), "base64");

if (encryptionKey.length !== 32) {
  fail("APP_ENCRYPTION_KEY must decode to exactly 32 bytes (base64 of 32 random bytes).");
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) fail(`${name} is not set. Run with: node --env-file=.env.local ${process.argv[1]}`);
  return value;
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function encrypt(plaintext) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `${PREFIX}${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${data.toString("base64")}`;
}

async function rest(path, init = {}) {
  const response = await fetch(`${url}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

const rows = await rest("/app_config?key=like.totp:*&select=key,value");
console.log(`Found ${rows.length} two-factor record(s).`);

let migrated = 0;
let alreadyDone = 0;

for (const row of rows) {
  let parsed;
  try {
    parsed = JSON.parse(row.value);
  } catch {
    console.warn(`  ! ${row.key}: value is not valid JSON — skipped`);
    continue;
  }

  const secret = parsed.secret || "";
  if (!secret) {
    console.warn(`  ! ${row.key}: no seed stored — skipped`);
    continue;
  }
  if (secret.startsWith(PREFIX)) {
    alreadyDone++;
    continue;
  }

  if (dryRun) {
    console.log(`  → ${row.key}: would encrypt`);
    migrated++;
    continue;
  }

  const value = JSON.stringify({ secret: encrypt(secret), enabled: !!parsed.enabled });
  await rest(`/app_config?key=eq.${encodeURIComponent(row.key)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ value, updated_at: new Date().toISOString() }),
  });
  console.log(`  ✓ ${row.key}: encrypted`);
  migrated++;
}

console.log(
  dryRun
    ? `\nDry run: ${migrated} would be encrypted, ${alreadyDone} already encrypted.`
    : `\nDone: ${migrated} encrypted, ${alreadyDone} already encrypted.`
);
