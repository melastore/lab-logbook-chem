import { NextResponse } from "next/server";
import { supabaseRest } from "@/lib/logbook";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-only: the export contains every profile, all records, and app_config
// (which holds TOTP secrets and the Telegram bot token).
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
      fetchTable("app_config")
    ]);

    const backup = {
      timestamp: new Date().toISOString(),
      version: "1.1",
      data: {
        profiles,
        logbook_records: records,
        instrument_categories: categories,
        instrument_templates: templates,
        form_definitions: forms,
        audit_log: audit,
        app_config: config
      }
    };

    // Return as a downloadable JSON file
    return new NextResponse(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="lab-logbook-backup-${new Date().toISOString().slice(0, 10)}.json"`
      }
    });

  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
