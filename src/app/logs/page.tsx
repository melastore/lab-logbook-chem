"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle, Calendar, CheckCircle2, Clock,
  Info, Microscope, Pencil, RefreshCw, Search, ShieldCheck, X, XCircle,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import type { AppUser, LogbookRecord } from "@/lib/logbook";
import { currentVersionIds } from "@/lib/logbook";
import { ALL_FORMS, STANDARD_KEYS, type FormDef, type FormField } from "@/lib/forms";
import { parseAnalystSignature } from "@/lib/signature";
import { toISODate } from "@/lib/weekly-plan";
import { displayFields, recordValue, versionChain } from "@/lib/record-diff";
import { VersionHistory } from "@/components/VersionHistory";
import { RecordWorkbook } from "@/components/RecordWorkbook";

const STATUSES = ["All", "Pending", "Approved", "Rejected"] as const;
type StatusFilter = typeof STATUSES[number];

const valueOf = recordValue;

function formFor(forms: FormDef[], rec: LogbookRecord) {
  return forms.find((f) => f.activityType === rec.activityType && f.scope !== "instrument")
    ?? ALL_FORMS.find((f) => f.activityType === rec.activityType);
}

function niceDate(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function MyLogsPage() {
  return <Suspense><MyLogs /></Suspense>;
}

function MyLogs() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get("id");

  const [user, setUser] = useState<AppUser | null>(null);
  const [records, setRecords] = useState<LogbookRecord[]>([]);
  const [forms, setForms] = useState<FormDef[]>(ALL_FORMS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<StatusFilter>("All");
  const [query, setQuery] = useState("");

  const load = useCallback(async (username: string) => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/logbook?username=${encodeURIComponent(username)}`, { cache: "no-store" });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setRecords(d.records || []);
    } catch {
      setError("Couldn't load your logs. Check your connection.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => { if (d.user) { setUser(d.user); load(d.user.username); } else setLoading(false); })
      .catch(() => setLoading(false));
    fetch("/api/forms")
      .then((r) => (r.ok ? r.json() : { forms: [] }))
      .then((d) => { if (d.forms?.length) setForms(d.forms); })
      .catch(() => {});
  }, [load]);

  // One row per record: the latest version, with older versions shown inside.
  const current = useMemo(() => {
    const ids = currentVersionIds(records);
    return records.filter((r) => ids.has(r.id));
  }, [records]);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { All: current.length, Pending: 0, Approved: 0, Rejected: 0 };
    for (const r of current) c[r.status]++;
    return c;
  }, [current]);

  const q = query.trim().toLowerCase();
  const visible = current.filter((r) =>
    (status === "All" || r.status === status) &&
    (!q || [r.instrumentName, r.instrumentId, r.activityType, r.sampleId, r.date, r.methodUsed, r.remarks,
      formFor(forms, r)?.title].some((v) => (v || "").toLowerCase().includes(q))));

  const selected = current.find((r) => r.id === selectedId)
    // an old link may point at a version that has since been corrected
    ?? (selectedId ? current.find((r) => records.some((x) => x.id === selectedId && (x.amends || x.id) === (r.amends || r.id))) : undefined);

  const open = (id: string | null) => router.replace(id ? `/logs?id=${id}` : "/logs", { scroll: false });
  const currentIds = useMemo(() => new Set(current.map((r) => r.id)), [current]);

  return (
    <main className="app-layout">
      <AppHeader user={user} />
      <div className="app-page logs-page">
        <header className="ml-head">
          <div>
            <h1>My logs</h1>
            <p>Everything you submitted, newest first. Rejected records can be corrected here.</p>
          </div>
          {counts.Rejected > 0 && status !== "Rejected" && (
            <button type="button" className="ml-alert" onClick={() => setStatus("Rejected")}>
              <XCircle size={16} /> {counts.Rejected} need{counts.Rejected === 1 ? "s" : ""} your correction
            </button>
          )}
        </header>

        <div className="lw-tools">
          <div className="um-search">
            <Search size={16} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search instrument, sample, date…" aria-label="Search logs" />
            {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={14} /></button>}
          </div>
          <div className="ml-chips" role="group" aria-label="Status">
            {STATUSES.map((s) => (
              <button key={s} type="button" className={`um-chip ${status === s ? "active" : ""}`} onClick={() => setStatus(s)}>
                {s} <span className="ml-chip-count">{counts[s]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={`lw ${selected ? "has-open" : ""}`}>
          <div className="lw-sheet">
            {loading ? (
              <div className="skeleton" style={{ height: 360, borderRadius: 8 }} />
            ) : error ? (
              <div className="ml-empty"><XCircle size={24} /><p>{error}</p>
                {user && <button type="button" className="btn btn-outline btn-sm" onClick={() => load(user.username)}>Try again</button>}</div>
            ) : (
              <RecordWorkbook records={visible} forms={forms} selectedId={selected?.id} onOpen={(r) => open(r.id)}
                isCurrent={(r) => currentIds.has(r.id)}
                empty={<div className="ml-empty"><Info size={24} /><p>{current.length ? "Nothing matches." : "You haven't submitted any logs yet."}</p></div>} />
            )}
          </div>

          {selected && (
            <aside className="lw-panel" aria-live="polite">
              <RecordDetail
                key={selected.id}
                record={selected}
                chain={versionChain(records, selected)}
                form={formFor(forms, selected)}
                user={user}
                onBack={() => open(null)}
                onCorrected={async (newId) => { if (user) await load(user.username); open(newId); }}
              />
            </aside>
          )}
        </div>
      </div>
    </main>
  );
}

function RecordDetail({ record, chain, form, user, onBack, onCorrected }: {
  record: LogbookRecord;
  chain: LogbookRecord[];
  form: FormDef | undefined;
  user: AppUser | null;
  onBack: () => void;
  onCorrected: (newId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const fields = useMemo(() => displayFields(record, form?.fields), [form, record]);
  const signature = parseAnalystSignature(record.analystSignature);
  const lastDecision = [...(record.reviews ?? [])].reverse().find((r) => r.decision !== "Comment");
  const canCorrect = record.status === "Rejected" && !!user && chain[0]?.submittedBy === user.id;

  const instrumentInfo = [
    ["Instrument ID", record.instrumentId], ["Model", record.instrumentModel], ["Serial No.", record.serialNumber],
    ["Manufacturer", record.manufacturer], ["Laboratory", record.laboratoryName], ["Location", record.location],
  ].filter(([, v]) => v);

  return (
    <article className="ml-card">
      <button type="button" className="ml-back lw-close" onClick={onBack}><X size={16} /> Close</button>

      <header className="ml-card-head">
        <span className="ml-card-icon"><Microscope size={22} /></span>
        <div>
          <p className="ml-eyebrow">{form?.title || record.activityType}</p>
          <h2>{record.instrumentName || form?.title || "Log"}</h2>
          <p className="ml-meta">
            <span><Calendar size={13} /> {record.date || "No date"}</span>
            {record.startTime && <span><Clock size={13} /> {record.startTime}{record.endTime ? `–${record.endTime}` : ""}</span>}
            {record.amends && <span><Pencil size={13} /> Correction</span>}
          </p>
        </div>
        <span className={`log-status-badge ${record.status.toLowerCase()}`}>{record.status}</span>
      </header>

      {record.status === "Rejected" && (
        <div className="ml-banner rejected" role="alert">
          <XCircle size={20} />
          <div>
            <strong>Rejected{lastDecision ? ` by ${lastDecision.reviewerName}` : ""}</strong>
            {lastDecision?.comment && <p>“{lastDecision.comment}”</p>}
            {lastDecision && <span className="ml-banner-time">{niceDate(lastDecision.createdAt)}</span>}
          </div>
          {canCorrect && !editing && (
            <button type="button" className="btn btn-primary btn-sm btn-icon-gap" onClick={() => setEditing(true)}>
              <Pencil size={15} /> <span>Correct and resubmit</span>
            </button>
          )}
        </div>
      )}
      {record.status === "Pending" && (
        <div className="ml-banner pending"><Clock size={20} /><div><strong>Waiting for review</strong><p>An admin will approve or reject it.</p></div></div>
      )}
      {record.status === "Approved" && (
        <div className="ml-banner approved"><CheckCircle2 size={20} /><div><strong>Approved{lastDecision ? ` by ${lastDecision.reviewerName}` : ""}</strong>
          {lastDecision && <span className="ml-banner-time">{niceDate(lastDecision.createdAt)}</span>}</div></div>
      )}

      {editing ? (
        <CorrectionForm record={record} fields={fields} onCancel={() => setEditing(false)} onDone={onCorrected} />
      ) : (
        <section className="ml-section">
          <h3>What you submitted</h3>
          {fields.length === 0 ? <p className="ml-muted">No form fields found for this log type.</p> : (
            <dl className="ml-values">
              {fields.map((f) => {
                const v = valueOf(record, f.key);
                return (
                  <div key={f.key} className={f.full || f.type === "textarea" ? "full" : ""}>
                    <dt>{f.label}</dt>
                    <dd className={v ? "" : "empty"}>{v || "—"}</dd>
                  </div>
                );
              })}
            </dl>
          )}
          <div className="ml-signed">
            {signature.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={signature.image} alt="Your signature" />
            )}
            <span>Signed by <strong>{signature.signedBy || record.analyst}</strong>{record.createdAt ? ` · ${niceDate(record.createdAt)}` : ""}</span>
          </div>
        </section>
      )}


      {record.reviews?.length > 0 && (
        <section className="ml-section">
          <h3>Review history</h3>
          <ol className="ml-timeline">
            {record.reviews.map((r) => (
              <li key={r.id} className={r.decision.toLowerCase()}>
                <div><strong>{r.decision}</strong> · {r.reviewerName} <span className="ml-muted">{niceDate(r.createdAt)}</span></div>
                {r.comment && <p>{r.comment}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {instrumentInfo.length > 0 && (
        <details className="ml-more">
          <summary><Microscope size={15} /> Instrument details</summary>
          <dl className="ml-values compact">
            {instrumentInfo.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        </details>
      )}

      {chain.length > 1 && (
        <section className="ml-section">
          <h3>Edit history</h3>
          <VersionHistory chain={chain} currentId={record.id} fields={fields} />
        </section>
      )}

      <details className="ml-more">
        <summary><ShieldCheck size={15} /> Integrity</summary>
        <dl className="ml-values compact">
          {record.chainIndex != null && <div><dt>Chain index</dt><dd>#{record.chainIndex}</dd></div>}
          <div className="full"><dt>Record hash</dt><dd className="mono">{record.recordHash || "—"}</dd></div>
        </dl>
      </details>
    </article>
  );
}

function CorrectionForm({ record, fields, onCancel, onDone }: {
  record: LogbookRecord;
  fields: FormField[];
  onCancel: () => void;
  onDone: (newId: string) => void;
}) {
  const initial = useMemo(() => Object.fromEntries(fields.map((f) => [f.key, valueOf(record, f.key)])), [fields, record]);
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const changed = fields.some((f) => (values[f.key] ?? "") !== (initial[f.key] ?? ""));
  const missing = fields.filter((f) => f.required && !(values[f.key] || "").trim()).map((f) => f.label);
  const future = values.date && values.date > toISODate(new Date());
  const badTime = values.startTime && values.endTime && values.endTime < values.startTime;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!changed) return setError("Change at least one value.");
    if (missing.length) return setError(`Fill in: ${missing.join(", ")}.`);
    if (future) return setError("Date can't be in the future.");
    if (badTime) return setError("End time is before start time.");
    if (!reason.trim()) return setError("Say what you corrected.");
    setSaving(true);
    setError("");
    const metadata: Record<string, string> = { ...record.metadata };
    const std: Record<string, string> = {};
    for (const f of fields) {
      const v = (values[f.key] ?? "").trim();
      if (STANDARD_KEYS.has(f.key)) std[f.key] = v; else metadata[f.key] = v;
    }
    try {
      const r = await fetch("/api/logbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...record,
          date: std.date ?? record.date,
          methodUsed: std.methodUsed ?? record.methodUsed,
          sampleId: std.sampleId ?? record.sampleId,
          measuredValue: std.measuredValue ?? record.measuredValue,
          startTime: std.startTime ?? record.startTime,
          endTime: std.endTime ?? record.endTime,
          remarks: std.remarks ?? record.remarks,
          metadata,
          amends: record.id,
          amendmentReason: reason.trim(),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Couldn't submit the correction.");
      onDone(d.records?.[0]?.id || record.id);
    } catch (err) {
      setError(err instanceof Error && err.message !== "Failed to fetch" ? err.message : "Network error. Nothing was submitted.");
      setSaving(false);
    }
  }

  return (
    <form className="ml-section ml-correct" onSubmit={submit} noValidate>
      <h3>Correct this record</h3>
      <p className="ml-muted">Your original entry is kept in the history. The corrected version goes back to an admin for review.</p>
      <div className="ml-edit-grid">
        {fields.map((f) => {
          const v = values[f.key] ?? "";
          const set = (x: string) => setValues((p) => ({ ...p, [f.key]: x }));
          const locked = f.key === "analyst";
          const edited = v !== (initial[f.key] ?? "");
          return (
            <label key={f.key} className={`field ${f.full || f.type === "textarea" ? "full" : ""} ${edited ? "edited" : ""}`}>
              <span className="field-label">{f.label}{f.required && <span className="req"> *</span>}{edited && <span className="ml-edited">edited</span>}</span>
              {f.type === "textarea" ? <textarea rows={3} value={v} onChange={(e) => set(e.target.value)} placeholder={f.placeholder} />
                : f.type === "select" ? (
                  <select value={v} onChange={(e) => set(e.target.value)}>
                    <option value="">—</option>
                    {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input type={f.type === "date" || f.type === "time" || f.type === "number" ? f.type : "text"} value={v}
                    onChange={(e) => set(e.target.value)} placeholder={f.placeholder} readOnly={locked}
                    max={f.type === "date" ? toISODate(new Date()) : undefined}
                    aria-invalid={!!f.required && !v.trim()} />
                )}
            </label>
          );
        })}
        <label className="field full">
          <span className="field-label">What did you correct? <span className="req">*</span></span>
          <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Added the reagent lot number the reviewer asked for" />
        </label>
      </div>
      {error && <div className="ml-form-error" role="alert"><AlertTriangle size={16} /> {error}</div>}
      <div className="ml-form-actions">
        <button type="button" className="btn btn-outline" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-primary btn-icon-gap" disabled={saving}>
          {saving ? <><RefreshCw size={16} className="spin" /> <span>Submitting…</span></> : <><CheckCircle2 size={16} /> <span>Submit correction</span></>}
        </button>
      </div>
    </form>
  );
}
