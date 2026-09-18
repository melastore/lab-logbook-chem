import { supabaseRest } from "./logbook";
import { decryptSecret, encryptSecret, isEncrypted } from "./secrets";

// Per-user TOTP state lives in app_config under `totp:<username>`. The seed is
// encrypted at rest (AES-256-GCM via secrets.ts) so a database dump, a restored
// snapshot or a stolen backup does not hand over everyone's second factor. It is
// decrypted only here, server-side, and returned to the browser exactly once —
// during enrollment, so the user can scan it.
//
// Records written before encryption existed hold a plaintext seed. Reads accept
// those, and the next write stores them encrypted.

type TwoFactorRecord = { secret: string; enabled: boolean };

function key(username: string) {
  return `totp:${username}`;
}

// Returns null only when the user has no 2FA row. Any other failure throws:
// treating a database or key error as "no 2FA" would let login skip the code.
export async function getTwoFactor(username: string): Promise<TwoFactorRecord | null> {
  const rows = await supabaseRest<{ value: string }[]>(
    `/app_config?key=eq.${encodeURIComponent(key(username))}&select=value`
  );
  if (!rows[0]) return null;
  const parsed = JSON.parse(rows[0].value) as TwoFactorRecord;
  const stored = parsed.secret || "";
  try {
    return { secret: stored ? decryptSecret(stored) : "", enabled: !!parsed.enabled };
  } catch (e) {
    console.error(`[twofactor] could not read the seed for ${username}:`, e instanceof Error ? e.message : e);
    throw e;
  }
}

export async function isTwoFactorEnabled(username: string): Promise<boolean> {
  const rec = await getTwoFactor(username);
  return !!rec?.enabled;
}

async function save(username: string, rec: TwoFactorRecord, updatedBy: string) {
  const secret = isEncrypted(rec.secret) ? rec.secret : encryptSecret(rec.secret);
  await supabaseRest<unknown>("/app_config?on_conflict=key", {
    method: "POST",
    prefer: "return=minimal,resolution=merge-duplicates",
    body: {
      key: key(username),
      value: JSON.stringify({ secret, enabled: rec.enabled }),
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    },
  });
}

// Store a freshly generated secret in the pending (not-yet-enabled) state.
export async function setPendingSecret(username: string, secret: string, updatedBy: string) {
  await save(username, { secret, enabled: false }, updatedBy);
}

export async function enableTwoFactor(username: string, secret: string, updatedBy: string) {
  await save(username, { secret, enabled: true }, updatedBy);
}

// 2FA is keyed by username, so it has to follow the account when it's renamed.
// Any stale row under the new name is dropped first so it can't be inherited.
export async function renameTwoFactor(oldUsername: string, newUsername: string) {
  if (oldUsername === newUsername) return;
  await supabaseRest<unknown>(
    `/app_config?key=eq.${encodeURIComponent(key(newUsername))}`,
    { method: "DELETE", prefer: "return=minimal" }
  );
  await supabaseRest<unknown>(
    `/app_config?key=eq.${encodeURIComponent(key(oldUsername))}`,
    { method: "PATCH", prefer: "return=minimal", body: { key: key(newUsername) } }
  );
}

export async function disableTwoFactor(username: string, updatedBy: string) {
  await supabaseRest<unknown>(
    `/app_config?key=eq.${encodeURIComponent(key(username))}`,
    { method: "DELETE", prefer: "return=minimal" }
  );
  void updatedBy;
}
