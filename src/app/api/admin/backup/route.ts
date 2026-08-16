import { NextResponse } from "next/server";
import { logAudit, supabaseRest } from "@/lib/logbook";
import { currentUser } from "@/lib/session";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Keys in app_config whose value is a credential rather than a setting. These
// are listed by name in the export but their values are stripped: a backup file
// travels — onto laptops, into mail, onto shared drives — and it must not be
// enough on its own to impersonate anyone or to bypass a second factor.
function isSecretKey(key: string) {
  return key.startsWith("totp:") || /token|secret|password|key$/i.test(key);
}

type ConfigRow = { key?: string; value?: unknown };

function redactConfig(rows: unknown[]): unknown[] {
  return rows.map((row) => {
    const entry = row as ConfigRow;
    if (typeof entry?.key === "string" && isSecretKey(entry.key)) {
      return { ...entry, value: "[redacted]", redacted: true };
    }
    return entry;
  });
}

// Admin-only: the export contains every profile, all records, and the audit log.
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const fetchTable = async (table: string) => {
      return supabaseRest<unknown[]>(`/${table}?select=*`);
    };

    const [profiles, records, categories, templates, forms, audit, config] = await Promise.all([
      fetchTable("profiles"),
      fetchTable("logbook_records"),
      fetchTable("instrument_categories"),
      fetchTable("instrument_templates"),
      fetchTable("form_definitions"),
      fetchTable("audit_log"),
      fetchTable("app_config"),
    ]);

    const backup = {
      timestamp: new Date().toISOString(),
      version: "1.2",
      note: "Credential values in app_config (two-factor seeds, API tokens) are redacted by design and cannot be restored from this file.",
      data: {
        profiles,
        logbook_records: records,
        instrument_categories: categories,
        instrument_templates: templates,
        form_definitions: forms,
        audit_log: audit,
        app_config: redactConfig(config),
      },
    };

    // Exporting the whole database is a notable act — it belongs in the trail.
    await logAudit({
      actor: user.username, actorId: user.id, action: "admin.backup_export",
      detail: { records: records.length, profiles: profiles.length },
    });

    return new NextResponse(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="lab-logbook-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    return errorResponse("admin/backup", error);
  }
}
