"use client";

import { useState } from "react";
import { CheckCircle2, Circle, FileOutput, PenLine, RefreshCw, TriangleAlert, Undo2 } from "lucide-react";
import { SignaturePad } from "./SignaturePad";

type Check = { ok: boolean; text: string; bad?: boolean };

// Signature line and submit checklist under a log sheet. A saved signature is
// never applied on its own: the user clicks to sign with it for each submit.
export function SignOff({
  analyst, date, checks, attempted, signature, onSignature, entries, submitting, error, disabled,
  saved, saveNext, onSaveNext, onRemoveSaved, sent, onClearSheet, onUndoClear,
}: {
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
  saved?: string | null;
  saveNext?: boolean;
  onSaveNext?: (v: boolean) => void;
  onRemoveSaved?: () => void;
  sent?: string;
  onClearSheet?: () => void;
  onUndoClear?: () => void;
}) {
  const [drawNew, setDrawNew] = useState(false);
  const usingSaved = Boolean(saved && signature && signature === saved);
  const offerSaved = Boolean(saved && !signature && !drawNew && !disabled);

  return (
    <section className="so" aria-label="Sign and submit">
      <div className="so-sign">
        <div className="so-sign-head">
          <span>Analyst signature</span>
          {signature && !disabled
            ? <button type="button" onClick={() => onSignature("")}>Clear</button>
            : saved && drawNew && <button type="button" onClick={() => setDrawNew(false)}>Use my saved signature</button>}
        </div>

        {offerSaved ? (
          <div className="so-saved">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={saved!} alt="Your saved signature" />
            <div className="so-saved-actions">
              <button type="button" className="btn btn-primary btn-sm btn-icon-gap" onClick={() => onSignature(saved!)}>
                <PenLine size={15} /> Sign with my saved signature
              </button>
              <button type="button" className="so-link" onClick={() => setDrawNew(true)}>Draw a new one</button>
              {onRemoveSaved && <button type="button" className="so-link muted" onClick={onRemoveSaved}>Remove saved signature</button>}
            </div>
          </div>
        ) : (
          <SignaturePad value={signature} onChange={onSignature} disabled={disabled} bare />
        )}

        <div className="so-sign-line">
          <span><small>Name</small>{analyst || "—"}</span>
          <span><small>Date</small>{date}</span>
          {usingSaved && <span className="so-tag">Saved signature</span>}
        </div>
        {signature && !usingSaved && !disabled && onSaveNext && (
          <label className="so-save">
            <input type="checkbox" checked={!!saveNext} onChange={(e) => onSaveNext(e.target.checked)} />
            {saved ? "Replace my saved signature with this one" : "Save this as my signature for next time"}
          </label>
        )}
      </div>

      <div className="so-side">
        {sent && <p className="so-sent" role="status"><CheckCircle2 size={16} /> {sent}</p>}
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
