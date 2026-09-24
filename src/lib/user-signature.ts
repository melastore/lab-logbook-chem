import { supabaseRest } from "./logbook";

// A user's saved signature lives in app_config under `signature:<user id>`.
// Keyed by id, not username, so it survives a rename. Records never point at
// it: each submission copies the image into the record, so replacing or
// removing the saved one changes nothing already signed.

export type SavedSignature = { image: string; savedAt: string };

const key = (userId: string) => `signature:${userId}`;

export const SIGNATURE_MAX = 150_000;

export function validSignatureImage(value: unknown): value is string {
  return typeof value === "string" && value.length <= SIGNATURE_MAX
    && /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(value);
}

export async function getSavedSignature(userId: string): Promise<SavedSignature | null> {
  const rows = await supabaseRest<{ value: string; updated_at: string }[]>(
    `/app_config?key=eq.${encodeURIComponent(key(userId))}&select=value,updated_at`
  );
  if (!rows[0]) return null;
  try {
    const { image } = JSON.parse(rows[0].value) as { image?: string };
    return validSignatureImage(image) ? { image, savedAt: rows[0].updated_at } : null;
  } catch {
    return null;
  }
}

export async function saveSignature(userId: string, image: string, updatedBy: string): Promise<SavedSignature> {
  const savedAt = new Date().toISOString();
  await supabaseRest<unknown>("/app_config?on_conflict=key", {
    method: "POST",
    prefer: "return=minimal,resolution=merge-duplicates",
    body: { key: key(userId), value: JSON.stringify({ image }), updated_by: updatedBy, updated_at: savedAt },
  });
  return { image, savedAt };
}

export async function removeSignature(userId: string) {
  await supabaseRest<unknown>(`/app_config?key=eq.${encodeURIComponent(key(userId))}`, {
    method: "DELETE",
    prefer: "return=minimal",
  });
}
