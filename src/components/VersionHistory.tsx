"use client";

import type { LogbookRecord } from "@/lib/logbook";
import type { FormField } from "@/lib/forms";
import { recordChanges } from "@/lib/record-diff";

function when(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

// Every version of a record, newest first, each correction showing exactly
// which values it changed.
export function VersionHistory({ chain, currentId, fields }: {
  chain: LogbookRecord[];
  currentId: string;
  fields: FormField[];
}) {
  if (chain.length < 2) return null;
  const items = chain.map((rec, i) => ({ rec, prev: i > 0 ? chain[i - 1] : null, n: i })).reverse();

  return (
    <ol className="vh">
      {items.map(({ rec, prev, n }) => {
        const changes = prev ? recordChanges(prev, rec, fields) : [];
        const isCurrent = rec.id === currentId;
        return (
          <li key={rec.id} className={isCurrent ? "current" : ""}>
            <div className="vh-head">
              <strong>{n === 0 ? "Original" : `Correction ${n}`}</strong>
              {isCurrent && <span className="vh-tag">Current</span>}
            </div>
            <div className="vh-meta">
              {when(rec.createdAt)}{n > 0 && rec.submitterName ? ` · by ${rec.submitterName}` : n === 0 && rec.analyst ? ` · by ${rec.analyst}` : ""}
            </div>
            {rec.amendmentReason && <p className="vh-reason">“{rec.amendmentReason}”</p>}
            {prev && (changes.length ? (
              <ul className="vh-changes">
                {changes.map((c) => (
                  <li key={c.key}>
                    <span className="vh-label">{c.label}</span>
                    <span className="vh-diff">
                      <del>{c.before || "empty"}</del>
                      <span aria-hidden="true">→</span>
                      <ins>{c.after || "empty"}</ins>
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="vh-none">No values changed.</p>)}
          </li>
        );
      })}
    </ol>
  );
}
