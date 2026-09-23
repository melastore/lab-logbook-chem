import type { LogbookRecord } from "./logbook";
import { STANDARD_KEYS, type FormField } from "./forms";

const STANDARD_GETTERS: Record<string, (r: LogbookRecord) => string> = {
  date: (r) => r.date,
  analyst: (r) => r.analyst,
  sampleId: (r) => r.sampleId,
  measuredValue: (r) => r.measuredValue,
  methodUsed: (r) => r.methodUsed,
  startTime: (r) => r.startTime,
  endTime: (r) => r.endTime,
  remarks: (r) => r.remarks,
};

// Standard keys live on columns, everything else in metadata.
export function recordValue(rec: LogbookRecord, key: string): string {
  if (STANDARD_KEYS.has(key)) return STANDARD_GETTERS[key]?.(rec) ?? "";
  const v = rec.metadata?.[key];
  return v == null || typeof v === "object" ? "" : String(v);
}

export type FieldChange = { key: string; label: string; before: string; after: string };

function labelFor(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

// What differs between two versions of a record. Form fields come first in form
// order, then any other stored value that changed.
export function recordChanges(before: LogbookRecord, after: LogbookRecord, fields: FormField[] = []): FieldChange[] {
  const out: FieldChange[] = [];
  const seen = new Set<string>();
  const check = (key: string, label: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    const a = recordValue(before, key).trim();
    const b = recordValue(after, key).trim();
    if (a !== b) out.push({ key, label, before: a, after: b });
  };
  for (const f of fields) check(f.key, f.label);
  for (const key of STANDARD_KEYS) check(key, labelFor(key));
  const metaKeys = new Set([...Object.keys(before.metadata || {}), ...Object.keys(after.metadata || {})]);
  for (const key of metaKeys) check(key, labelFor(key));
  return out;
}

// Versions of one record, oldest first.
export function versionChain(all: LogbookRecord[], rec: LogbookRecord): LogbookRecord[] {
  const root = rec.amends || rec.id;
  return all.filter((r) => (r.amends || r.id) === root).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// Fields to show for a record: its form's fields, or when the form is gone,
// whatever was stored.
export function displayFields(rec: LogbookRecord, formFields: FormField[] = []): FormField[] {
  const fromForm = formFields.filter((f) => f.key !== "instrumentUsed" || recordValue(rec, f.key));
  if (fromForm.length) return fromForm;
  const std: FormField[] = [
    { key: "date", label: "Date", type: "date" }, { key: "sampleId", label: "Sample ID", type: "text" },
    { key: "methodUsed", label: "Method", type: "text" }, { key: "measuredValue", label: "Measured value", type: "text" },
    { key: "startTime", label: "Start time", type: "time" }, { key: "endTime", label: "End time", type: "time" },
  ];
  const extra: FormField[] = Object.entries(rec.metadata || {})
    .filter(([, v]) => v != null && typeof v !== "object" && String(v).trim())
    .map(([k]) => ({ key: k, label: labelFor(k), type: "text" }));
  const remarks: FormField = { key: "remarks", label: "Remarks", type: "textarea" };
  return [...std.filter((f) => recordValue(rec, f.key)), ...extra, remarks];
}
