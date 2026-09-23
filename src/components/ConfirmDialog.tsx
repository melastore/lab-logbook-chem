"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { ModalShell } from "./ModalShell";

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

let show: ((p: Pending) => void) | null = null;

// In-app replacement for window.confirm. Needs <ConfirmHost /> mounted once on
// the page; without it this falls back to the browser dialog.
export function askConfirm(opts: ConfirmOptions): Promise<boolean> {
  if (!show) return Promise.resolve(window.confirm([opts.title, opts.message].filter(Boolean).join("\n\n")));
  const open = show;
  return new Promise((resolve) => open({ ...opts, resolve }));
}

export function ConfirmHost() {
  const [current, setCurrent] = useState<Pending | null>(null);

  useEffect(() => {
    show = (p) => setCurrent((prev) => { prev?.resolve(false); return p; });
    return () => { show = null; };
  }, []);

  if (!current) return null;

  const finish = (ok: boolean) => { current.resolve(ok); setCurrent(null); };

  return (
    <ModalShell open onClose={() => finish(false)} overlayClassName="modal-overlay confirm-overlay" className="modal shadow-3 confirm-dialog" labelledBy="confirm-title">
      <div className="confirm-body">
        <span className={`confirm-icon ${current.danger ? "danger" : ""}`} aria-hidden="true">
          {current.danger ? <AlertTriangle size={22} /> : <HelpCircle size={22} />}
        </span>
        <h2 id="confirm-title">{current.title}</h2>
        {current.message && <p>{current.message}</p>}
      </div>
      <div className="confirm-actions">
        <button className="btn btn-outline" type="button" onClick={() => finish(false)}>{current.cancelLabel || "Cancel"}</button>
        <button className={`btn ${current.danger ? "btn-danger" : "btn-primary"}`} type="button" onClick={() => finish(true)}>
          {current.confirmLabel || "Confirm"}
        </button>
      </div>
    </ModalShell>
  );
}
