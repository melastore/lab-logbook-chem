"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { RefreshCw, XCircle, Info, ShieldCheck, ChevronDown, Calendar, Search, X, MessageSquare } from "lucide-react";
import type { LogbookRecord } from "@/lib/logbook";
import { ModalShell } from "./ModalShell";

// recordDate is an occasional alias for the record date.
type LogRecord = LogbookRecord & { recordDate?: string };

const STATUSES = ["All", "Pending", "Approved", "Rejected"] as const;
type StatusFilter = typeof STATUSES[number];

type UserLogsModalProps = {
  name: string;
  open: boolean;
  onClose: () => void;
  headerAvatar?: ReactNode;
};

export function UserLogsModal({ name, open, onClose, headerAvatar }: UserLogsModalProps) {
  const [userLogs, setUserLogs] = useState<LogRecord[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [errorLogs, setErrorLogs] = useState<string | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [query, setQuery] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setExpandedRowId(null);
      setStatusFilter("All");
      setQuery("");
      setLoadingLogs(true);
      setErrorLogs(null);
      try {
        // Scoping happens server-side: this asks for one analyst's entries and
        // the API decides whether the caller may have them. Nothing is filtered
        // here any more — narrowing in the browser meant every analyst's
        // records, signature images included, were sent to every client first.
        const response = await fetch(`/api/logbook?username=${encodeURIComponent(name)}`);
        if (!response.ok) throw new Error("Failed to load records.");
        const data = await response.json();

        if (!cancelled) setUserLogs(data.records || []);
      } catch (err) {
        if (!cancelled) setErrorLogs(err instanceof Error ? err.message : "Failed to load logs.");
      } finally {
        if (!cancelled) setLoadingLogs(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, name, reload]);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { All: userLogs.length, Pending: 0, Approved: 0, Rejected: 0 };
    for (const l of userLogs) c[(l.status || "Pending") as Exclude<StatusFilter, "All">]++;
    return c;
  }, [userLogs]);

  const q = query.trim().toLowerCase();
  const visible = userLogs.filter((l) =>
    (statusFilter === "All" || (l.status || "Pending") === statusFilter) &&
    (!q || [l.instrumentName, l.instrumentId, l.activityType, l.sampleId, l.date, l.methodUsed, l.remarks]
      .some((v) => (v || "").toLowerCase().includes(q))));

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      overlayClassName="avatar-logs-modal-overlay"
      className="avatar-logs-modal"
      labelledBy="user-logs-title"
    >
      <header className="avatar-logs-modal-header">
        <div className="avatar-logs-header-left">
          {headerAvatar}
          <div>
            <h3 id="user-logs-title">{name}&apos;s logs</h3>
            <p>{loadingLogs ? "Loading…" : `${userLogs.length} record${userLogs.length === 1 ? "" : "s"}, newest first`}</p>
          </div>
        </div>
        <button type="button" className="avatar-logs-close-btn" onClick={onClose} aria-label="Close">
          <span aria-hidden="true">&times;</span>
        </button>
      </header>

      <div className="avatar-logs-modal-body">
        {loadingLogs ? (
          <div className="avatar-logs-loading" role="status" aria-live="polite">
            <RefreshCw className="spin" size={24} aria-hidden="true" />
            <p>Retrieving logbook history...</p>
          </div>
        ) : errorLogs ? (
          <div className="avatar-logs-error" role="alert">
            <XCircle size={24} style={{ color: "var(--error)" }} />
            <p>{errorLogs}</p>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setReload((n) => n + 1)}>Try again</button>
          </div>
        ) : userLogs.length === 0 ? (
          <div className="avatar-logs-empty">
            <Info size={24} />
            <p>No logs yet.</p>
          </div>
        ) : (
          <>
          <div className="ul-toolbar">
            <div className="um-search">
              <Search size={16} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search instrument, sample, date…" aria-label="Search logs" />
              {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={14} /></button>}
            </div>
            <div className="um-chips" role="group" aria-label="Status">
              {STATUSES.map((s) => (
                <button key={s} type="button" className={`um-chip ${statusFilter === s ? "active" : ""}`} onClick={() => setStatusFilter(s)}>
                  {s} ({counts[s]})
                </button>
              ))}
            </div>
          </div>
          {visible.length === 0 ? (
            <div className="avatar-logs-empty"><Info size={24} /><p>Nothing matches.</p></div>
          ) : (
          <div className="avatar-logs-list">
            {visible.map((log) => {
              const expanded = expandedRowId === log.id;
              const details = buildRecordDetails(log);
              const status = log.status || "Pending";
              const recordDate = log.date || log.recordDate || "No date";
              const rejection = status === "Rejected"
                ? [...(log.reviews ?? [])].reverse().find((r) => r.decision === "Rejected")?.comment
                : "";

              return (
                <div key={log.id} className={`avatar-log-card ${expanded ? "expanded" : ""}`}>
                  <button
                    type="button"
                    className="avatar-log-card-summary"
                    onClick={() => setExpandedRowId(expanded ? null : log.id)}
                    aria-expanded={expanded}
                  >
                    <span className="avatar-log-summary-main">
                      <span className="avatar-log-summary-top">
                        <span className="log-instrument-badge">{log.instrumentName || "Instrument"}</span>
                        <span className="avatar-log-activity">{log.activityType || "—"}</span>
                        {log.amends && <span className="avatar-log-activity">Correction</span>}
                      </span>
                      <span className="avatar-log-summary-sub">
                        <Calendar size={12} /> {recordDate}
                        {log.sampleId ? ` · ${log.sampleId}` : log.instrumentId ? ` · ID ${log.instrumentId}` : ""}
                      </span>
                      {rejection && (
                        <span className="ul-reject-note"><MessageSquare size={12} /> {rejection}</span>
                      )}
                    </span>
                    <span className={`log-status-badge ${status.toLowerCase()}`}>{status}</span>
                    <ChevronDown size={18} className={`avatar-log-chevron ${expanded ? "rotated" : ""}`} />
                  </button>

                  {expanded && (
                    <div className="avatar-log-details-expanded">
                      <div className="avatar-log-detail-grid">
                        {details.map((d) => (
                          <div
                            key={d.label}
                            className={`avatar-log-detail-item ${d.full ? "full-width" : ""}`}
                          >
                            <span className="detail-label">{d.label}</span>
                            <span className={`detail-value ${d.mono ? "mono" : ""}`}>{d.value}</span>
                          </div>
                        ))}
                      </div>
                      {log.reviews?.length > 0 && (
                        <div className="review-history">
                          <p className="detail-label">Admin review</p>
                          <ol>
                            {log.reviews.map((r) => (
                              <li key={r.id} className={`review-entry ${r.decision.toLowerCase()}`}>
                                <div className="review-entry-head">
                                  <strong>{r.decision === "Comment" ? "Comment" : r.decision}</strong>
                                  <span>{r.reviewerName}</span>
                                  <span className="review-entry-time">{new Date(r.createdAt).toLocaleString()}</span>
                                </div>
                                {r.comment && <p className="review-entry-text">{r.comment}</p>}
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          )}
          </>
        )}
      </div>

      <footer className="avatar-logs-modal-footer">
        <p className="integrity-badge">
          <ShieldCheck size={14} /> ISO/IEC 17025 Compliant Chain State
        </p>
      </footer>
  </ModalShell>
  );
}

type RecordDetail = { label: string; value: string; full?: boolean; mono?: boolean };

// Flattens a record into every populated field — fixed columns first, then all
// dynamic Form Builder fields from metadata, then remarks and integrity info.
// This is what surfaces "all submitted data" in the expanded card.
function buildRecordDetails(log: LogRecord): RecordDetail[] {
  const out: RecordDetail[] = [];
  const push = (label: string, value: unknown, opts: { full?: boolean; mono?: boolean } = {}) => {
    if (value === undefined || value === null) return;
    const s = String(value).trim();
    if (!s) return;
    out.push({ label, value: s, ...opts });
  };

  push("Date", log.date || log.recordDate);
  push("Analyst", log.analyst);
  push("Activity", log.activityType);
  push("Instrument", log.instrumentName);
  push("Instrument ID", log.instrumentId);
  push("Model", log.instrumentModel);
  push("Serial No.", log.serialNumber);
  push("Manufacturer", log.manufacturer);
  push("Laboratory", log.laboratoryName);
  push("Department", log.department);
  push("Location", log.location);
  push("Method", log.methodUsed);
  push("Sample ID", log.sampleId);
  push("Start Time", log.startTime);
  push("End Time", log.endTime);
  push("Measured Value", log.measuredValue, { mono: true });

  // Every dynamic / custom Form Builder field lives in metadata.
  if (log.metadata && typeof log.metadata === "object") {
    for (const [k, v] of Object.entries(log.metadata)) {
      // Instrument extras are copied in as [{label, value}]; show them as pairs.
      if (Array.isArray(v)) {
        for (const item of v) {
          if (item && typeof item === "object" && "label" in item) push(String(item.label), (item as { value?: unknown }).value);
        }
        continue;
      }
      if (v === undefined || v === null || typeof v === "object" || String(v).trim() === "") continue;
      push(formatKey(k), v);
    }
  }

  push("Remarks", log.remarks, { full: true });
  if (log.amends) {
    push("Amendment Reason", log.amendmentReason, { full: true });
    push("Corrected By", log.submitterName);
  }

  // ISO/IEC 17025 integrity trail.
  if (log.chainIndex !== null && log.chainIndex !== undefined) push("Chain Index", `#${log.chainIndex}`);
  push("Record Hash", log.recordHash, { full: true, mono: true });
  if (log.createdAt) push("Submitted", new Date(log.createdAt).toLocaleString());

  return out;
}

function formatKey(key: string): string {
  const result = key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .trim();
  return result.charAt(0).toUpperCase() + result.slice(1);
}
