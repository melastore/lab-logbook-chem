"use client";

import { useLayoutEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import type { FormField } from "@/lib/forms";

// Excel-style cell: shows the formatted value, and the raw value/formula while
// focused. `name` is the cell address (e.g. "C14") used for keyboard moves.
// Text cells (multiline) wrap and grow taller, like "wrap text" in Excel.
export function SheetCell({ name, raw, display, onInput, onFocus, multiline, className = "", disabled, placeholder, inputMode }: {
  name: string; raw: string; display: string; onInput: (v: string) => void; onFocus: () => void;
  multiline?: boolean; className?: string; disabled?: boolean; placeholder?: string;
  inputMode?: "decimal" | "text";
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? display;
  const area = useRef<HTMLTextAreaElement>(null);

  // field-sizing: content does this in Chrome only; Firefox and Safari need the height set.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const props = {
    className: `xl-input ${className}`,
    "data-cell": name,
    value,
    spellCheck: false,
    disabled,
    placeholder,
    onFocus: () => { setDraft(raw); onFocus(); },
    onBlur: () => setDraft(null),
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setDraft(e.target.value); onInput(e.target.value); },
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => moveOnKey(e, name),
  };
  return multiline ? <textarea ref={area} rows={1} {...props} /> : <input type="text" inputMode={inputMode} {...props} />;
}

// Enter / arrows move between rows, Shift+Enter goes up, like Excel.
export function moveOnKey(e: KeyboardEvent<HTMLElement>, name: string) {
  const m = /^([A-Z]+)(\d+)$/.exec(name);
  if (!m) return;
  let row = Number(m[2]);
  if ((e.key === "Enter" && !e.shiftKey) || e.key === "ArrowDown") row++;
  else if ((e.key === "Enter" && e.shiftKey) || e.key === "ArrowUp") row--;
  else return;
  const next = document.querySelector<HTMLElement>(`[data-cell="${m[1]}${row}"]`);
  if (!next) return;
  e.preventDefault();
  next.focus();
}

// A, B, ... Z, AA, AB ...
export function colName(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

export function colWidth(f: FormField) {
  if (f.type === "textarea") return 260;
  if (f.type === "date") return 110;
  if (f.type === "time") return 84;
  if (f.type === "number") return 100;
  return 180;
}
