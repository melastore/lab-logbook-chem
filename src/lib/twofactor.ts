import { supabaseRest } from "./logbook";

// Per-user TOTP state lives in app_config under `totp:<username>`. The secret is
// only ever read server-side (service-role REST) and is sent to the browser once,
// during enrollment, so the user can scan/enter it. Never returned afterwards.

type TwoFactorRecord = { secret: string; enabled: boolean };

function key(username: string) {
  return `totp:${username}`;
}

export async function getTwoFactor(username: string): Promise<TwoFactorRecord | null> {
  try {
    const rows = await supabaseRest<{ value: string }[]>(
      `/app_config?key=eq.${encodeURIComponent(key(username))}&select=value`
    );
    if (!rows[0]) return null;
    const parsed = JSON.parse(rows[0].value) as TwoFactorRecord;
    return { secret: parsed.secret || "", enabled: !!parsed.enabled };
  } catch {
    return null;
  }
}

export async function isTwoFactorEnabled(username: string): Promise<boolean> {
  const rec = await getTwoFactor(username);
  return !!rec?.enabled;
}

async function save(username: string, rec: TwoFactorRecord, updatedBy: string) {
  await supabaseRest<unknown>("/app_config?on_conflict=key", {
    method: "POST",
    prefer: "return=minimal,resolution=merge-duplicates",
    body: {
      key: key(username),
      value: JSON.stringify(rec),
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

export async function disableTwoFactor(username: string, updatedBy: string) {
  await supabaseRest<unknown>(
    `/app_config?key=eq.${encodeURIComponent(key(username))}`,
    { method: "DELETE", prefer: "return=minimal" }
  );
  void updatedBy;
}
