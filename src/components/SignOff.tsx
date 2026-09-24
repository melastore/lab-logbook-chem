"use client";

import { CheckCircle2, Circle, FileOutput, RefreshCw, TriangleAlert, Undo2 } from "lucide-react";
import { SignaturePad } from "./SignaturePad";

type Check = { ok: boolean; text: string; bad?: boolean };

// Signature line and submit checklist under a log sheet.
export function SignOff({ analyst, date, checks, attempted, signature, onSignature, entries, submitting, error, disabled, onClearSheet, onUndoClear }: {
  analyst: string;
  date: string;
  checks: Check[];
  attempted: boolean;
  signature: string;
  onSignature: (v: string) => void;
  entries: number;
  submitting: boolean;
  error: string;
  disabled?: boolean;
  onClearSheet?: () => void;
  onUndoClear?: () => void;
}) {
  return (
    <section className="so" aria-label="Sign and submit">
      <div className="so-sign">
        <div className="so-sign-head">
          <span>Analyst signature</span>
          {signature && !disabled && <button type="button" onClick={() => onSignature("")}>Clear</button>}
        </div>
        <SignaturePad value={signature} onChange={onSignature} disabled={disabled} bare />
        <div className="so-sign-line">
          <span><small>Name</small>{analyst || "—"}</span>
          <span><small>Date</small>{date}</span>
        </div>
      </div>

      <div className="so-side">
        <ul className="so-checks">
          {checks.map((c) => (
            <li key={c.text} className={c.ok ? "ok" : attempted || c.bad ? "bad" : ""}>
              {c.ok ? <CheckCircle2 size={16} /> : attempted || c.bad ? <TriangleAlert size={16} /> : <Circle size={16} />}
              {c.text}
            </li>
          ))}
        </ul>
        {error && <p className="so-error" role="alert">{error}</p>}
        <button className="btn btn-primary so-submit" type="submit" disabled={disabled || submitting}>
          {submitting
            ? <><RefreshCw size={17} className="spin" /> Submitting…</>
            : <><FileOutput size={17} /> Submit {entries > 1 ? `${entries} entries` : "entry"}</>}
        </button>
        {!disabled && (
          <p className="so-draft">
            {onUndoClear
              ? <>Sheet cleared. <button type="button" onClick={onUndoClear}><Undo2 size={13} /> Undo</button></>
              : <>Your draft is kept on this device until you submit.{onClearSheet && <> <button type="button" onClick={onClearSheet}>Clear sheet</button></>}</>}
          </p>
        )}
      </div>
    </section>
  );
}
