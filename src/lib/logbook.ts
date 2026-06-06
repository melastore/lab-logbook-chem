import { GENERATED_USER_ACCOUNTS, type GeneratedUserAccount } from "./generated-users";
import { ALL_FORMS, type FormDef, type FormField, type FormScope } from "./forms";

export const LOG_TYPES = [
  { id: "OP", label: "Daily Operation", desc: "Routine instrument use and sample runs" },
  { id: "CAL", label: "Quality & Calibration", desc: "QC checks and instrument calibration" },
  { id: "QC", label: "Quality Control", desc: "CRM, duplicates, and spike recoveries" },
  { id: "PREP", label: "Sample Preparation", desc: "Matrix preparation, dilution, and extraction" },
  { id: "MTN", label: "Maintenance & Troubleshoot", desc: "Upkeep, parts, and corrective actions" },
  { id: "BRK", label: "Troubleshooting", desc: "Breakdowns and corrective actions" },
  { id: "REAG", label: "Reagent & Standard", desc: "Preparation of standards or reagents" },
];

export type UserRole = "analyst" | "supervisor" | "admin";

export type AppUser = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: UserRole;
  passwordChangeRequired: boolean;
  avatarSeed: string;
};

export type LogbookRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  submittedBy: string | null;
  laboratoryName: string;
  department: string;
  location: string;
  instrumentName: string;
  instrumentModel: string;
  serialNumber: string;
  manufacturer: string;
  installationDate: string;
  instrumentId: string;
  date: string;
  analyst: string;
  activityType: string;
  methodUsed: string;
  sampleId: string;
  measuredValue: string;
  startTime: string;
  endTime: string;
  metadata: Record<string, string>;
  remarks: string;
  analystSignature: string;
  // ─ ISO/IEC 17025 integrity (set by the database, read-only to the app) ─
  chainIndex: number | null;
  prevHash: string;
  recordHash: string;
  amends: string | null;
  amendmentReason: string;
};

export type LogbookInput = Omit<
  LogbookRecord,
  "id" | "createdAt" | "updatedAt" | "submittedBy"
  | "chainIndex" | "prevHash" | "recordHash" | "amends" | "amendmentReason"
>; // integrity columns are written by the database, not the client

export type InstrumentCategory = {
  id: string;
  name: string;
  displayOrder: number;
};

export type InstrumentTemplate = {
  id: string;
  categoryId: string;
  categoryName: string;
  instrumentName: string;
  instrumentModel: string;
  serialNumber: string;
  manufacturer: string;
  installationDate: string;
  instrumentId: string;
  laboratoryName: string;
  department: string;
  location: string;
  desk: string;
  logbookStartDate: string;
  logbookEndDate: string;
  methodUsed: string;
  displayOrder: number;
  metadata: Record<string, unknown>;
  infoFormId?: string;
};

// ─── Pre-generated Accounts ───────────────────────────────────────────────────

export type GeneratedUser = GeneratedUserAccount & {
  initialPassword: string;
};

// Initial password for all accounts - set via LAB_INITIAL_PASSWORD env var.
// Users must change it on first login.
const _initPw = process.env.LAB_INITIAL_PASSWORD ?? "";

export const GENERATED_USERS: GeneratedUser[] = GENERATED_USER_ACCOUNTS.map((user) => ({
  ...user,
  initialPassword: _initPw,
}));

// ─── Supabase Row Types ───────────────────────────────────────────────────────

type AuthMetadata = Record<string, unknown>;

type SupabaseAuthUser = {
  id: string;
  email?: string;
  user_metadata?: AuthMetadata;
};

type SupabaseAuthResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: SupabaseAuthUser;
};

type SupabaseAdminUser = {
  id: string;
  email?: string;
  user_metadata?: AuthMetadata;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
  role: UserRole;
  position?: string | null;
  password_change_required: boolean;
  archived?: boolean | null;
};

type ProfileUsernameRow = {
  id: string;
  username: string | null;
};

type LogbookRow = {
  id: string;
  created_at: string;
  updated_at: string;
  submitted_by: string | null;
  laboratory_name: string | null;
  department: string | null;
  location: string | null;
  instrument_name: string | null;
  instrument_model: string | null;
  serial_number: string | null;
  manufacturer: string | null;
  installation_date: string | null;
  instrument_id: string | null;
  record_date: string | null;
  analyst: string | null;
  activity_type: string | null;
  method_used: string | null;
  sample_id: string | null;
  measured_value: string | null;
  start_time: string | null;
  end_time: string | null;
  metadata: Record<string, string> | null;
  remarks: string | null;
  analyst_signature: string | null;
  chain_index: number | null;
  prev_hash: string | null;
  record_hash: string | null;
  amends: string | null;
  amendment_reason: string | null;
};

type CategoryRow = {
  id: string;
  name: string;
  display_order: number;
};

type TemplateRow = {
  id: string;
  category_id: string;
  instrument_categories: { name: string; display_order?: number } | null;
  instrument_name: string;
  instrument_model: string;
  serial_number: string;
  manufacturer: string;
  installation_date: string | null;
  instrument_id: string;
  laboratory_name: string;
  department: string;
  location: string;
  desk: string;
  logbook_start_date: string | null;
  logbook_end_date: string | null;
  method_used: string;
  display_order: number;
  metadata: Record<string, unknown> | null;
  info_form_id: string | null;
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function loginWithUsername(username: string, password: string) {
  // PostgREST rejects `username` as a filter param (PGRST125), so fetch all and filter in JS
  const profiles = await supabaseRest<ProfileRow[]>("/profiles?select=*");
  const profile = profiles.find((p) => p.username === username);

  if (!profile) {
    throw new Error("Username not found.");
  }

  // Archived accounts are disabled — block login before hitting the auth server.
  if (profile.archived === true) {
    throw new Error("This account has been archived. Contact an administrator.");
  }

  const email = profile.email || `${username}@lab.local`;
  const result = await supabaseAuth<SupabaseAuthResponse>("/token?grant_type=password", {
    method: "POST",
    body: { email, password },
  });

  return {
    token: result.access_token,
    maxAge: 60 * 60 * 24 * 30, // 30 days
    user: mapProfile(profile, result.user.user_metadata),
  };
}

export async function loginWithPassword(email: string, password: string) {
  const result = await supabaseAuth<SupabaseAuthResponse>("/token?grant_type=password", {
    method: "POST",
    body: { email, password },
  });

  const profile = await getProfile(result.user.id, result.user.user_metadata);
  if (!profile) throw new Error("This user does not have an application profile.");

  return { 
    token: result.access_token, 
    maxAge: 60 * 60 * 24 * 30, // 30 days
    user: profile 
  };
}

export async function getCurrentUser(accessToken: string): Promise<AppUser | null> {
  if (!accessToken) return null;
  try {
    const authUser = await supabaseAuth<SupabaseAuthUser>("/user", { token: accessToken });
    return await getProfile(authUser.id, authUser.user_metadata);
  } catch {
    return null;
  }
}

export async function changePassword(userId: string, newPassword: string) {
  await supabaseAdminPut<unknown>(`/admin/users/${encodeURIComponent(userId)}`, {
    password: newPassword,
  });

  await supabaseRest<unknown>(`/profiles?id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: { password_change_required: false },
  });
}

export async function updateCurrentUserProfile(
  userId: string,
  opts: { username?: string; avatarSeed?: string }
): Promise<AppUser> {
  let metadata: AuthMetadata | undefined;

  if (opts.username) {
    const existing = await supabaseRest<ProfileUsernameRow[]>("/profiles?select=id,username");
    const taken = existing.some((p) =>
      p.id !== userId && p.username?.toLowerCase() === opts.username!.toLowerCase()
    );
    if (taken) throw new Error("Username is already in use.");

    await supabaseRest<unknown>(`/profiles?id=eq.${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: { username: opts.username },
    });
  }

  if (opts.avatarSeed) {
    metadata = await updateUserMetadata(userId, { avatar_seed: opts.avatarSeed });
  }

  if (!metadata) {
    const authUser = await supabaseAdminGet<SupabaseAdminUser>(
      `/admin/users/${encodeURIComponent(userId)}`
    );
    metadata = authUser.user_metadata;
  }

  const updated = await getProfile(userId, metadata);
  if (!updated) throw new Error("Profile not found.");
  return updated;
}

// ─── Logbook Records ──────────────────────────────────────────────────────────

export async function listRecords(_user: AppUser) {
  void _user;
  const rows = await supabaseRest<LogbookRow[]>("/logbook_records?select=*&order=created_at.desc");
  return rows.map(mapRecord);
}

export async function createRecord(input: LogbookInput, submittedBy: string) {
  const records = await createRecords([input], submittedBy);
  return records[0];
}

// Records are append-only; the database blocks UPDATE/DELETE. Corrections go
// through createAmendment, so there is no deleteRecord here.

function recordToRow(
  input: LogbookInput,
  submittedBy: string,
  extra?: { amends?: string; amendmentReason?: string }
) {
  return {
    submitted_by: submittedBy,
    // status / supervisor_comment are not-null with a check constraint.
    status: "Approved",
    supervisor_comment: "",
    laboratory_name: input.laboratoryName,
    department: input.department,
    location: input.location,
    instrument_name: input.instrumentName,
    instrument_model: input.instrumentModel,
    serial_number: input.serialNumber,
    manufacturer: input.manufacturer,
    installation_date: emptyToNull(input.installationDate),
    instrument_id: input.instrumentId,
    record_date: emptyToNull(input.date),
    analyst: input.analyst,
    activity_type: input.activityType,
    method_used: input.methodUsed,
    sample_id: input.sampleId,
    measured_value: input.measuredValue,
    start_time: emptyToNull(input.startTime),
    end_time: emptyToNull(input.endTime),
    metadata: input.metadata || {},
    remarks: input.remarks,
    analyst_signature: input.analystSignature,
    amends: extra?.amends || null,
    amendment_reason: extra?.amendmentReason || "",
  };
}

export async function createRecords(inputs: LogbookInput[], submittedBy: string) {
  const body = inputs.map((input) => recordToRow(input, submittedBy));
  const rows = await supabaseRest<LogbookRow[]>("/logbook_records?select=*", {
    method: "POST",
    prefer: "return=representation",
    body,
  });
  return rows.map(mapRecord);
}

export async function createAmendment(
  originalId: string,
  input: LogbookInput,
  reason: string,
  submittedBy: string
): Promise<LogbookRecord> {
  const original = await supabaseRest<LogbookRow[]>(
    `/logbook_records?id=eq.${encodeURIComponent(originalId)}&select=id`
  );
  if (original.length === 0) throw new Error("Original record not found.");
  if (!reason.trim()) throw new Error("A reason is required for an amendment.");

  const rows = await supabaseRest<LogbookRow[]>("/logbook_records?select=*", {
    method: "POST",
    prefer: "return=representation",
    body: [recordToRow(input, submittedBy, { amends: originalId, amendmentReason: reason.trim() })],
  });
  return mapRecord(rows[0]);
}

export async function verifyLogbookChain(): Promise<{ ok: boolean; checked: number; firstBad: string | null }> {
  const rows = await supabaseRest<{ ok: boolean; checked: number; first_bad: string | null }[]>(
    "/rpc/verify_logbook_chain",
    { method: "POST", body: {} }
  );
  const r = rows[0] || { ok: true, checked: 0, first_bad: null };
  return { ok: r.ok, checked: Number(r.checked) || 0, firstBad: r.first_bad ?? null };
}

// ─── Audit Log (append-only security events) ──────────────────────────────────

export type AuditEntry = {
  id: string;
  at: string;
  actor: string;
  actorId: string | null;
  action: string;
  target: string;
  detail: Record<string, unknown>;
};

type AuditRow = {
  id: string;
  at: string;
  actor: string | null;
  actor_id: string | null;
  action: string;
  target: string | null;
  detail: Record<string, unknown> | null;
};

export async function logAudit(entry: {
  actor: string;
  actorId?: string | null;
  action: string;
  target?: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    await supabaseRest<unknown>("/audit_log", {
      method: "POST",
      prefer: "return=minimal",
      body: {
        actor: entry.actor,
        actor_id: entry.actorId || null,
        action: entry.action,
        target: entry.target || "",
        detail: entry.detail || {},
      },
    });
  } catch {
    // never let auditing break the main operation
  }
}

export async function listAuditLog(limit = 500): Promise<AuditEntry[]> {
  const rows = await supabaseRest<AuditRow[]>(
    `/audit_log?select=*&order=at.desc&limit=${limit}`
  );
  return rows.map((r) => ({
    id: r.id,
    at: r.at,
    actor: r.actor || "",
    actorId: r.actor_id ?? null,
    action: r.action,
    target: r.target || "",
    detail: r.detail || {},
  }));
}

// ─── Instrument Templates ─────────────────────────────────────────────────────

export async function listCategories(): Promise<InstrumentCategory[]> {
  const rows = await supabaseRest<CategoryRow[]>(
    "/instrument_categories?select=*&order=display_order.asc"
  );
  return rows.map((r) => ({ id: r.id, name: r.name, displayOrder: r.display_order }));
}

export async function createCategory(input: { name: string; displayOrder: number }): Promise<InstrumentCategory> {
  const rows = await supabaseRest<CategoryRow[]>("/instrument_categories?select=*", {
    method: "POST",
    prefer: "return=representation",
    body: { name: input.name, display_order: input.displayOrder },
  });
  return { id: rows[0].id, name: rows[0].name, displayOrder: rows[0].display_order };
}

export async function updateCategory(
  id: string,
  input: { name?: string; displayOrder?: number }
): Promise<InstrumentCategory | null> {
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.displayOrder !== undefined) body.display_order = input.displayOrder;
  const rows = await supabaseRest<CategoryRow[]>(
    `/instrument_categories?id=eq.${encodeURIComponent(id)}&select=*`,
    { method: "PATCH", prefer: "return=representation", body }
  );
  return rows[0] ? { id: rows[0].id, name: rows[0].name, displayOrder: rows[0].display_order } : null;
}

// Deletion is blocked while instruments still reference the category, because
// the FK cascades — removing the category would silently delete its instruments.
export async function deleteCategory(id: string): Promise<void> {
  const inUse = await supabaseRest<{ id: string }[]>(
    `/instrument_templates?category_id=eq.${encodeURIComponent(id)}&select=id&limit=1`
  );
  if (inUse.length > 0) {
    throw new Error("Category is in use by one or more instruments. Move or delete those instruments first.");
  }
  await supabaseRest<unknown>(
    `/instrument_categories?id=eq.${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}

export async function listTemplates(): Promise<InstrumentTemplate[]> {
  const rows = await supabaseRest<TemplateRow[]>(
    "/instrument_templates?select=*,instrument_categories(name,display_order)&order=display_order.asc"
  );
  // Group by category order first (stable sort keeps each category's instruments
  // in their own display order). This drives both the admin table and public nav.
  rows.sort((a, b) =>
    (a.instrument_categories?.display_order ?? 0) - (b.instrument_categories?.display_order ?? 0)
  );
  return rows.map(mapTemplate);
}

export async function createTemplate(
  input: Omit<InstrumentTemplate, "id" | "categoryName">
): Promise<InstrumentTemplate> {
  const rows = await supabaseRest<TemplateRow[]>(
    "/instrument_templates?select=*,instrument_categories(name)",
    {
      method: "POST",
      prefer: "return=representation",
      body: templateToRow(input),
    }
  );
  return mapTemplate(rows[0]);
}

export async function updateTemplate(
  id: string,
  input: Partial<Omit<InstrumentTemplate, "id" | "categoryName">>
): Promise<InstrumentTemplate | null> {
  const rows = await supabaseRest<TemplateRow[]>(
    `/instrument_templates?id=eq.${encodeURIComponent(id)}&select=*,instrument_categories(name)`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: templateToRow(input),
    }
  );
  return rows[0] ? mapTemplate(rows[0]) : null;
}

export async function deleteTemplate(id: string) {
  await supabaseRest<unknown>(
    `/instrument_templates?id=eq.${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}

// ─── Form Definitions ─────────────────────────────────────────────────────────

type FormDefinitionRow = {
  id: string;
  title: string;
  activity_type: string;
  scope: FormScope;
  fields: FormField[] | null;
  display_order: number;
};

function mapForm(row: FormDefinitionRow): FormDef {
  return {
    id: row.id,
    title: row.title,
    activityType: row.activity_type,
    scope: row.scope === "sample" ? "sample" : row.scope === "instrument" ? "instrument" : "analytical",
    fields: Array.isArray(row.fields) ? row.fields : [],
  };
}

function formToRow(form: Partial<FormDef> & { displayOrder?: number }) {
  const row: Record<string, unknown> = {};
  if (form.id !== undefined)           row.id            = form.id;
  if (form.title !== undefined)        row.title         = form.title;
  if (form.activityType !== undefined) row.activity_type = form.activityType;
  if (form.scope !== undefined)        row.scope         = form.scope;
  if (form.fields !== undefined)       row.fields        = form.fields;
  if (form.displayOrder !== undefined) row.display_order = form.displayOrder;
  return row;
}

// Returns every form ordered for display. On a fresh database the table is
// empty, so we seed it from the built-in defaults the first time it is read and
// then treat the database as the source of truth.
export async function listForms(): Promise<FormDef[]> {
  let rows = await supabaseRest<FormDefinitionRow[]>(
    "/form_definitions?select=*&order=display_order.asc"
  );
  if (rows.length === 0) {
    await seedDefaultForms(ALL_FORMS, 0);
    rows = await supabaseRest<FormDefinitionRow[]>(
      "/form_definitions?select=*&order=display_order.asc"
    );
  } else {
    // Add any default forms introduced in newer app versions that the database
    // doesn't have yet (e.g. the General Information fields form). Existing rows
    // are never overwritten, so admin edits are preserved.
    const have = new Set(rows.map((r) => r.id));
    const missing = ALL_FORMS.filter((f) => !have.has(f.id));
    if (missing.length > 0) {
      await seedDefaultForms(missing, rows.length);
      rows = await supabaseRest<FormDefinitionRow[]>(
        "/form_definitions?select=*&order=display_order.asc"
      );
    }
  }
  return rows.map(mapForm);
}

async function seedDefaultForms(forms: FormDef[], startOrder: number): Promise<void> {
  const body = forms.map((f, i) => ({
    id: f.id,
    title: f.title,
    activity_type: f.activityType,
    scope: f.scope,
    fields: f.fields,
    display_order: startOrder + i,
  }));
  await supabaseRest<unknown>("/form_definitions?on_conflict=id", {
    method: "POST",
    prefer: "return=minimal,resolution=ignore-duplicates",
    body,
  });
}

export async function createForm(
  input: { id: string; title: string; activityType: string; scope: FormScope; fields: FormField[]; displayOrder: number }
): Promise<FormDef> {
  const rows = await supabaseRest<FormDefinitionRow[]>("/form_definitions?select=*", {
    method: "POST",
    prefer: "return=representation",
    body: formToRow(input),
  });
  return mapForm(rows[0]);
}

export async function updateForm(
  id: string,
  input: Partial<FormDef> & { displayOrder?: number }
): Promise<FormDef | null> {
  const rows = await supabaseRest<FormDefinitionRow[]>(
    `/form_definitions?id=eq.${encodeURIComponent(id)}&select=*`,
    { method: "PATCH", prefer: "return=representation", body: formToRow(input) }
  );
  return rows[0] ? mapForm(rows[0]) : null;
}

export async function deleteForm(id: string): Promise<void> {
  await supabaseRest<unknown>(
    `/form_definitions?id=eq.${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}

// ─── User Management ──────────────────────────────────────────────────────────

export async function listProvisionedUsernames(): Promise<string[]> {
  const rows = await supabaseRest<{ username: string | null }[]>(
    "/profiles?select=username"
  );
  return rows.map((r) => r.username).filter((u): u is string => !!u);
}

export async function provisionUser(gen: GeneratedUser): Promise<void> {
  let userId: string;

  try {
    // Try to create in Supabase Auth
    const authUser = await supabaseAdminPost<SupabaseAdminUser>("/admin/users", {
      email: gen.email,
      password: gen.initialPassword,
      email_confirm: true,
      user_metadata: { full_name: gen.fullName },
    });
    userId = authUser.id;
  } catch {
    // User already exists in Auth — look up their ID by listing users
    const res = await supabaseAdminGet<{ users: SupabaseAdminUser[] }>(
      "/admin/users?per_page=1000&page=1"
    );
    const existing = res.users.find((u) => u.email === gen.email);
    if (!existing) throw new Error(`User ${gen.email} not found in Supabase Auth.`);
    userId = existing.id;
  }

  // Upsert profile — safe to run even if profile already exists
  await supabaseRest<unknown>("/profiles?on_conflict=id", {
    method: "POST",
    prefer: "return=minimal,resolution=merge-duplicates",
    body: {
      id: userId,
      email: gen.email,
      full_name: gen.fullName,
      username: gen.username,
      role: gen.role,
      password_change_required: true,
    },
  });
}

export async function resetUserPassword(username: string, newPassword: string): Promise<void> {
  const profiles = await supabaseRest<ProfileRow[]>("/profiles?select=*");
  const profile = profiles.find((p) => p.username === username);
  if (!profile) throw new Error("User not found.");

  await supabaseAdminPut<unknown>(`/admin/users/${encodeURIComponent(profile.id)}`, {
    password: newPassword,
  });

  await supabaseRest<unknown>(
    `/profiles?id=eq.${encodeURIComponent(profile.id)}`,
    { method: "PATCH", body: { password_change_required: true } }
  );
}

// ─── User Management (extended) ──────────────────────────────────────────────

export type ProfilePublic = {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  position: string;
  archived: boolean;
};

export async function listProfiles(): Promise<ProfilePublic[]> {
  const rows = await supabaseRest<ProfileRow[]>("/profiles?select=*");
  return rows.map((r) => ({
    id: r.id,
    username: r.username || "",
    email: r.email || "",
    fullName: r.full_name || "",
    role: r.role,
    position: r.position || "",
    archived: r.archived === true,
  }));
}

export async function createNewUser(input: {
  email: string;
  username: string;
  fullName: string;
  role: UserRole;
  position?: string;
  password: string;
}): Promise<void> {
  // Reject duplicate usernames up front for a clear error.
  const existing = await supabaseRest<ProfileRow[]>("/profiles?select=id,username");
  if (existing.some((p) => p.username?.toLowerCase() === input.username.toLowerCase())) {
    throw new Error("Username is already in use.");
  }

  let userId: string;
  try {
    const authUser = await supabaseAdminPost<SupabaseAdminUser>("/admin/users", {
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.fullName },
    });
    userId = authUser.id;
  } catch {
    // Account may already exist in Auth — find it so we can attach a profile.
    const res = await supabaseAdminGet<{ users: SupabaseAdminUser[] }>(
      "/admin/users?per_page=1000&page=1"
    );
    const found = res.users.find((u) => u.email === input.email);
    if (!found) throw new Error("Could not create the auth user. Check the email address.");
    userId = found.id;
  }

  await supabaseRest<unknown>("/profiles?on_conflict=id", {
    method: "POST",
    prefer: "return=minimal,resolution=merge-duplicates",
    body: {
      id: userId,
      email: input.email,
      full_name: input.fullName,
      username: input.username,
      role: input.role,
      position: input.position || "",
      password_change_required: true,
      archived: false,
    },
  });
}

export async function setUserArchived(username: string, archived: boolean): Promise<void> {
  const rows = await supabaseRest<ProfileRow[]>("/profiles?select=*");
  const profile = rows.find((p) => p.username === username);
  if (!profile) throw new Error(`User "${username}" not found.`);
  await supabaseRest<unknown>(`/profiles?id=eq.${encodeURIComponent(profile.id)}`, {
    method: "PATCH",
    body: { archived },
  });
}

export async function deleteUser(username: string): Promise<void> {
  const rows = await supabaseRest<ProfileRow[]>("/profiles?select=*");
  const profile = rows.find((p) => p.username === username);
  if (!profile) throw new Error(`User "${username}" not found.`);
  await supabaseAdminDelete(`/admin/users/${encodeURIComponent(profile.id)}`);
}

export async function updateUserCredentials(
  username: string,
  opts: { newUsername?: string; newPassword?: string; newFullName?: string; newPosition?: string }
): Promise<void> {
  const rows = await supabaseRest<ProfileRow[]>("/profiles?select=*");
  const profile = rows.find((p) => p.username === username);
  if (!profile) throw new Error(`User "${username}" not found.`);
  if (opts.newPassword) {
    await supabaseAdminPut<unknown>(`/admin/users/${encodeURIComponent(profile.id)}`, {
      password: opts.newPassword,
    });
  }
  const profilePatch: Record<string, unknown> = {};
  if (opts.newUsername) profilePatch.username = opts.newUsername;
  if (opts.newFullName) profilePatch.full_name = opts.newFullName;
  if (opts.newPosition !== undefined) profilePatch.position = opts.newPosition;
  if (Object.keys(profilePatch).length > 0) {
    // Keep the auth user's metadata in sync so the full name stays consistent.
    if (opts.newFullName) {
      await supabaseAdminPut<unknown>(`/admin/users/${encodeURIComponent(profile.id)}`, {
        user_metadata: { full_name: opts.newFullName },
      });
    }
    await supabaseRest<unknown>(`/profiles?id=eq.${encodeURIComponent(profile.id)}`, {
      method: "PATCH",
      body: profilePatch,
    });
  }
}

// ─── App Config ───────────────────────────────────────────────────────────────

export type TelegramConfig = { botToken: string; chatId: string };

export async function getTelegramConfig(): Promise<TelegramConfig> {
  try {
    const rows = await supabaseRest<{ key: string; value: string }[]>(
      "/app_config?key=in.(telegram_bot_token,telegram_chat_id)&select=key,value"
    );
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return {
      botToken: map.telegram_bot_token || "",
      chatId: map.telegram_chat_id || "",
    };
  } catch {
    return { botToken: "", chatId: "" };
  }
}

export async function setTelegramConfig(
  config: Partial<TelegramConfig>,
  updatedBy: string
): Promise<void> {
  const entries: [string, string][] = [];
  if (config.botToken !== undefined) entries.push(["telegram_bot_token", config.botToken]);
  if (config.chatId !== undefined) entries.push(["telegram_chat_id", config.chatId]);
  for (const [key, value] of entries) {
    await supabaseRest<unknown>("/app_config?on_conflict=key", {
      method: "POST",
      prefer: "return=minimal,resolution=merge-duplicates",
      body: { key, value, updated_by: updatedBy, updated_at: new Date().toISOString() },
    });
  }
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

async function getProfile(userId: string, metadata?: AuthMetadata): Promise<AppUser | null> {
  const rows = await supabaseRest<ProfileRow[]>(
    `/profiles?id=eq.${encodeURIComponent(userId)}&select=*`
  );
  if (!rows[0]) return null;
  // Archiving a user revokes access immediately: treat an archived profile as
  // no session, so any live cookie stops working on the next request.
  if (rows[0].archived === true) return null;
  return mapProfile(rows[0], metadata);
}

function mapProfile(row: ProfileRow, metadata?: AuthMetadata): AppUser {
  return {
    id: row.id,
    email: row.email || "",
    username: row.username || row.email?.split("@")[0] || "user",
    fullName: row.full_name || row.email || "User",
    role: row.role,
    passwordChangeRequired: row.password_change_required ?? false,
    avatarSeed: metadataString(metadata, "avatar_seed") || metadataString(metadata, "avatarSeed") || row.id,
  };
}

function metadataString(metadata: AuthMetadata | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : "";
}

function mapRecord(row: LogbookRow): LogbookRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedBy: row.submitted_by,
    laboratoryName: row.laboratory_name || "",
    department: row.department || "",
    location: row.location || "",
    instrumentName: row.instrument_name || "",
    instrumentModel: row.instrument_model || "",
    serialNumber: row.serial_number || "",
    manufacturer: row.manufacturer || "",
    installationDate: row.installation_date || "",
    instrumentId: row.instrument_id || "",
    date: row.record_date || "",
    analyst: row.analyst || "",
    activityType: row.activity_type || "SMP",
    methodUsed: row.method_used || "",
    sampleId: row.sample_id || "",
    measuredValue: row.measured_value || "",
    startTime: row.start_time || "",
    endTime: row.end_time || "",
    metadata: row.metadata || {},
    remarks: row.remarks || "",
    analystSignature: row.analyst_signature || "",
    chainIndex: row.chain_index ?? null,
    prevHash: row.prev_hash || "",
    recordHash: row.record_hash || "",
    amends: row.amends ?? null,
    amendmentReason: row.amendment_reason || "",
  };
}

function mapTemplate(row: TemplateRow): InstrumentTemplate {
  const cat = row.instrument_categories;
  return {
    id: row.id,
    categoryId: row.category_id,
    categoryName: cat ? cat.name : "",
    instrumentName: row.instrument_name,
    instrumentModel: row.instrument_model,
    serialNumber: row.serial_number,
    manufacturer: row.manufacturer,
    installationDate: row.installation_date || "",
    instrumentId: row.instrument_id,
    laboratoryName: row.laboratory_name,
    department: row.department,
    location: row.location,
    desk: row.desk || "",
    logbookStartDate: row.logbook_start_date || "",
    logbookEndDate: row.logbook_end_date || "",
    methodUsed: row.method_used,
    displayOrder: row.display_order,
    metadata: row.metadata || {},
    infoFormId: row.info_form_id || undefined,
  };
}

function templateToRow(t: Partial<Omit<InstrumentTemplate, "id" | "categoryName">>) {
  const row: Record<string, unknown> = {};
  if (t.categoryId !== undefined)     row.category_id       = t.categoryId;
  if (t.instrumentName !== undefined) row.instrument_name   = t.instrumentName;
  if (t.instrumentModel !== undefined) row.instrument_model = t.instrumentModel;
  if (t.serialNumber !== undefined)   row.serial_number     = t.serialNumber;
  if (t.manufacturer !== undefined)   row.manufacturer      = t.manufacturer;
  if (t.installationDate !== undefined) row.installation_date = emptyToNull(t.installationDate);
  if (t.instrumentId !== undefined)   row.instrument_id     = t.instrumentId;
  if (t.laboratoryName !== undefined) row.laboratory_name   = t.laboratoryName;
  if (t.department !== undefined)     row.department        = t.department;
  if (t.location !== undefined)       row.location          = t.location;
  if (t.desk !== undefined)           row.desk              = t.desk;
  if (t.logbookStartDate !== undefined) row.logbook_start_date = emptyToNull(t.logbookStartDate);
  if (t.logbookEndDate !== undefined)   row.logbook_end_date   = emptyToNull(t.logbookEndDate);
  if (t.methodUsed !== undefined)     row.method_used       = t.methodUsed;
  if (t.displayOrder !== undefined)   row.display_order     = t.displayOrder;
  if (t.metadata !== undefined)       row.metadata          = t.metadata;
  if (t.infoFormId !== undefined)     row.info_form_id      = t.infoFormId || null;
  return row;
}

// ─── Supabase Client ──────────────────────────────────────────────────────────

async function supabaseAuth<T>(
  path: string,
  options: { method?: string; token?: string; body?: Record<string, unknown> } = {}
) {
  const headers: HeadersInit = {
    apikey: requireEnv("SUPABASE_ANON_KEY"),
    "Content-Type": "application/json",
  };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  return supabaseFetch<T>(`/auth/v1${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

async function supabaseAdminGet<T>(path: string) {
  return supabaseFetch<T>(`/auth/v1${path}`, {
    method: "GET",
    headers: {
      apikey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: `Bearer ${requireEnv("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
  });
}

async function supabaseAdminPost<T>(path: string, body: Record<string, unknown>) {
  return supabaseFetch<T>(`/auth/v1${path}`, {
    method: "POST",
    headers: {
      apikey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: `Bearer ${requireEnv("SUPABASE_SERVICE_ROLE_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function supabaseAdminDelete<T>(path: string) {
  return supabaseFetch<T>(`/auth/v1${path}`, {
    method: "DELETE",
    headers: {
      apikey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: `Bearer ${requireEnv("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
  });
}

async function supabaseAdminPut<T>(path: string, body: Record<string, unknown>) {
  return supabaseFetch<T>(`/auth/v1${path}`, {
    method: "PUT",
    headers: {
      apikey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: `Bearer ${requireEnv("SUPABASE_SERVICE_ROLE_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function updateUserMetadata(userId: string, patch: AuthMetadata) {
  const authUser = await supabaseAdminGet<SupabaseAdminUser>(
    `/admin/users/${encodeURIComponent(userId)}`
  );
  const userMetadata = { ...(authUser.user_metadata || {}), ...patch };
  await supabaseAdminPut<unknown>(`/admin/users/${encodeURIComponent(userId)}`, {
    user_metadata: userMetadata,
  });
  return userMetadata;
}

export async function supabaseRest<T>(
  path: string,
  options: { method?: string; body?: unknown; prefer?: string } = {}
) {
  const headers: HeadersInit = {
    apikey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    Authorization: `Bearer ${requireEnv("SUPABASE_SERVICE_ROLE_KEY")}`,
    "Content-Type": "application/json",
  };
  if (options.prefer) headers.Prefer = options.prefer;

  return supabaseFetch<T>(`/rest/v1${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

async function supabaseFetch<T>(path: string, init: RequestInit): Promise<T> {
  const baseUrl = requireEnv("SUPABASE_URL").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}${path}`, init);
  if (!response.ok) throw new Error(await response.text());
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as unknown as T);
}

function emptyToNull(value: string | undefined) {
  return value || null;
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}
