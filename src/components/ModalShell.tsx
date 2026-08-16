"use client";

import { useEffect, useRef, type ReactNode } from "react";

// One accessible wrapper for every dialog in the app. Before this, each modal
// was a bare div: no role, closable only by mouse, and focus stayed behind it on
// the page underneath — so a keyboard or screen-reader user could tab straight
// out of an open dialog into content they couldn't see.
//
// It gives each dialog:
//   • role="dialog" + aria-modal, named by its own heading
//   • Escape to close, click-outside to close
//   • focus moved in on open, trapped while open, returned to the trigger after
//   • the page behind locked against scrolling

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

type ModalShellProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** id of the element naming this dialog (usually its <h2>/<h3>). */
  labelledBy?: string;
  /** Accessible name, when there is no visible heading to point at. */
  label?: string;
  overlayClassName?: string;
  className?: string;
  /** Set false for dialogs where a stray click must not discard input. */
  closeOnOverlayClick?: boolean;
};

export function ModalShell({
  open,
  onClose,
  children,
  labelledBy,
  label,
  overlayClassName = "modal-overlay",
  className = "modal",
  closeOnOverlayClick = true,
}: ModalShellProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    returnFocusRef.current = document.activeElement as HTMLElement | null;

    // Focus the first control, or the panel itself when it holds none.
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      // Wrap around instead of escaping into the page behind the dialog.
      if (event.shiftKey && (active === first || !panelRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={overlayClassName}
      onClick={closeOnOverlayClick ? (e) => e.target === e.currentTarget && onClose() : undefined}
    >
      <div
        ref={panelRef}
        className={className}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}
