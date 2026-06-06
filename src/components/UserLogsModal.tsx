"use client";

import { useEffect, useState, type ReactNode } from "react";
import { RefreshCw, XCircle, Info, ShieldCheck, ChevronDown, Calendar } from "lucide-react";
import { parseAnalystSignature } from "@/lib/signature";
import type { LogbookRecord } from "@/lib/logbook";

// Records from /api/logbook map to LogbookRecord; status is attached server-side
// and recordDate is an occasional alias for the record date.
type LogRecord = LogbookRecord & { status?: string; recordDate?: string };

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

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setExpandedRowId(null);
      setLoadingLogs(true);
      setErrorLogs(null);
      try {
        const [rLogbook, rMe] = await Promise.all([
          fetch("/api/logbook"),
          fetch("/api/auth/me"),
        ]);

        if (!rLogbook.ok) throw new Error("Failed to load records.");
        const data = await rLogbook.json();
        const meData = rMe.ok ? await rMe.json() : { user: null };
        const loggedInUser = meData.user;

        const filtered = (data.records || []).filter((rec: LogRecord) => {
          const sig = parseAnalystSignature(rec.analystSignature || "");

          // 1. Match by UUID of the submitter
          if (loggedInUser && rec.submittedBy === loggedInUser.id) return true;

          // 2. Match by username (case-insensitive)
          const targetUsername = name.toLowerCase().trim();
          if (rec.submittedBy?.toLowerCase().trim() === targetUsername) return true;
          if (sig.username?.toLowerCase().trim() === targetUsername) return true;

          // 3. Match by full name or analyst text (case-insensitive)
          const targetFullName = loggedInUser?.fullName?.toLowerCase().trim() || "";
          const recAnalyst = rec.analyst?.toLowerCase().trim() || "";

          if (recAnalyst === targetUsername) return true;
          if (targetFullName && recAnalyst === targetFullName) return true;
          if (targetFullName && sig.signedBy?.toLowerCase().trim() === targetFullName) return true;

          // 4. Heuristic fallback for spacing/spelling (e.g. "John Doe" vs "johndoe")
          const cleanTargetUsername = targetUsername.replace(/[^a-z0-9]/g, "");
          const cleanTargetFullName = targetFullName.replace(/[^a-z0-9]/g, "");
          const cleanRecAnalyst = recAnalyst.replace(/[^a-z0-9]/g, "");

          if (cleanRecAnalyst && cleanRecAnalyst === cleanTargetUsername) return true;
          if (cleanTargetFullName && cleanRecAnalyst && cleanRecAnalyst === cleanTargetFullName) return true;

          return false;
        });

        if (!cancelled) setUserLogs(filtered);
      } catch (err) {
        if (!cancelled) setErrorLogs(err instanceof Error ? err.message : "Failed to load logs.");
      } finally {
        if (!cancelled) setLoadingLogs(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, name]);

  if (!open) return null;

  return (
    <div className="avatar-logs-modal-overlay" onClick={onClose}>
      <div className="avatar-logs-modal" onClick={(e) => e.stopPropagation()}>
        <header className="avatar-logs-modal-header">
          <div className="avatar-logs-header-left">
            {headerAvatar}
            <div>
              <h3>{name}&apos;s Audit Entries</h3>
              <p>Logbook records submitted by this analyst</p>
            </div>
          </div>
          <button className="avatar-logs-close-btn" onClick={onClose}>&times;</button>
        </header>

        <div className="avatar-logs-modal-body">
          {loadingLogs ? (
            <div className="avatar-logs-loading">
              <RefreshCw className="spin" size={24} />
              <p>Retrieving logbook history...</p>
            </div>
          ) : errorLogs ? (
            <div className="avatar-logs-error">
              <XCircle size={24} style={{ color: "var(--error)" }} />
              <p>{errorLogs}</p>
            </div>
          ) : userLogs.length === 0 ? (
            <div className="avatar-logs-empty">
              <Info size={24} />
              <p>No log records registered for this analyst.</p>
              <p className="field-hint">Compliance Note: Submitted log entries are secured under cryptographic chains.</p>
            </div>
          ) : (
            <div className="avatar-logs-list">
              {userLogs.map((log, index) => {
                const expanded = expandedRowId === log.id;
                const details = buildRecordDetails(log);
                const status = log.status || "Approved";
                const recordDate = log.date || log.recordDate || "No date";

                return (
                  <div key={log.id} className={`avatar-log-card ${expanded ? "expanded" : ""}`}>
                    <button
                      type="button"
                      className="avatar-log-card-summary"
                      onClick={() => setExpandedRowId(expanded ? null : log.id)}
                      aria-expanded={expanded}
                    >
                      <span className="avatar-log-index">{index + 1}</span>
                      <span className="avatar-log-summary-main">
                        <span className="avatar-log-summary-top">
                          <span className="log-instrument-badge">{log.instrumentName || "Instrument"}</span>
                          <span className="avatar-log-activity">{log.activityType || "—"}</span>
                        </span>
                        <span className="avatar-log-summary-sub">
                          <Calendar size={12} /> {recordDate}
                          {log.instrumentId ? ` · ID ${log.instrumentId}` : ""}
                        </span>
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
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <footer className="avatar-logs-modal-footer">
          <p className="integrity-badge">
            <ShieldCheck size={14} /> ISO/IEC 17025 Compliant Chain State
          </p>
        </footer>
      </div>
    </div>
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
      if (v === undefined || v === null || String(v).trim() === "") continue;
      push(formatKey(k), v);
    }
  }

  push("Remarks", log.remarks, { full: true });
  if (log.amends) push("Amendment Reason", log.amendmentReason, { full: true });

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
