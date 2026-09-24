"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { Trash2 } from "lucide-react";
import type { FormField } from "@/lib/forms";
import { SheetCell, moveOnKey, colName } from "./SheetCell";

type Row = Record<string, string>;

const MIN_ROWS = 10;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// date and analyst are filled in for every new row, so they don't count.
export function isBlankRow(row: Row) {
  return Object.entries(row).every(([k, v]) => k === "date" || k === "analyst" || !(v || "").trim());
}

// "30-Apr-2026", as in the lab book examples.
function labDate(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}-${MONTHS[Number(m[2]) - 1]}-${m[1]}` : iso;
}

function colWidth(f: FormField) {
  if (f.type === "textarea") return 260;
  if (f.type === "date") return 110;
  if (f.type === "time") return 84;
  if (f.type === "number") return 100;
  return 150;
}

// A log form laid out like the printed lab book table, on an Excel sheet.
// Typing into an empty row below the last one adds rows up to it.
export function FormExcel({ title, info, fields, rows, setRows, newRow, maxRows, disabled, showMissing, onRemoveRow }: {
  title: string;
  info: [string, string][];
  fields: FormField[];
  rows: Row[];
  setRows: Dispatch<SetStateAction<Row[]>>;
  newRow: () => Row;
  maxRows: number;
  disabled?: boolean;
  showMissing?: boolean;
  onRemoveRow?: (i: number) => void;
}) {
  const [active, setActive] = useState<{ c: number; r: number } | null>(null);
  const cols = fields.length + 1;
  const headRow = 3 + info.length + 1;
  const firstRow = headRow + 1;
  const dataRows = Math.min(Math.max(MIN_ROWS, rows.length + 1), Math.max(maxRows, rows.length));
  const lastRow = firstRow + dataRows - 1;

  function edit(i: number, key: string, value: string) {
    if (disabled) return;
    setRows((prev) => {
      // Rows skipped over stay empty; a row gets its date and analyst when it is first typed in.
      const next = [...prev];
      while (next.length <= i) next.push({});
      const base = next[i].date || next[i].analyst ? next[i] : { ...newRow(), ...next[i] };
      next[i] = { ...base, [key]: value };
      while (next.length > 1 && next.length - 1 !== i && isBlankRow(next[next.length - 1])) next.pop();
      return next;
    });
  }

  const missing = (f: FormField, i: number) => {
    const row = rows[i];
    return Boolean(showMissing && row && f.required && !(row[f.key] || "").trim() && (i === 0 || !isBlankRow(row)));
  };

  const activeField = active && active.c > 0 ? fields[active.c - 1] : null;
  const activeIndex = active ? active.r - firstRow : -1;
  const fxRaw = activeField && activeIndex >= 0 ? rows[activeIndex]?.[activeField.key] || "" : "";
  const fxEditable = !disabled && activeField && activeIndex >= 0 && ["text", "number", "textarea"].includes(activeField.type);
  const on = (c: number, r: number) => (active?.c === c && active.r === r ? " xl-sel" : "");
  const focus = (c: number, r: number) => () => setActive({ c, r });

  return (
    <div className={`xl-form ${disabled ? "is-disabled" : ""}`}>
      <div className="xl-fx">
        <div className="xl-namebox">{active ? `${colName(active.c)}${active.r}` : ""}</div>
        <div className="xl-fx-icon"><em>fx</em></div>
        <input className="xl-fx-input" type="text" spellCheck={false} value={fxRaw} readOnly={!fxEditable}
          onChange={(e) => activeField && edit(activeIndex, activeField.key, e.target.value)} />
      </div>

      <div className="xl-grid xl-grid-form">
        <table className="xl-sheet">
          <colgroup>
            <col className="xl-c-hdr" />
            <col style={{ width: 44 }} />
            {fields.map((f) => <col key={f.key} style={{ width: colWidth(f) }} />)}
          </colgroup>
          <thead>
            <tr>
              <th className="xl-corner" />
              {Array.from({ length: cols }, (_, c) => <th key={c} className={active?.c === c ? "on" : ""}>{colName(c)}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr className="xl-h20"><th>1</th><td colSpan={cols} /></tr>
            <tr className="xl-h29"><th>2</th><td colSpan={cols} className="xl-form-title">{title}</td></tr>
            {info.map(([label, value], k) => (
              <tr key={label} className="xl-h20">
                <th>{3 + k}</th>
                <td colSpan={cols} className="xl-form-info"><b>{label}:</b> {value}</td>
              </tr>
            ))}
            <tr className="xl-h10"><th>{3 + info.length}</th><td colSpan={cols} /></tr>

            <tr className="xl-head xl-top">
              <th>{headRow}</th>
              <td className="xl-l m">No.</td>
              {fields.map((f, k) => (
                <td key={f.key} className={`m${k === fields.length - 1 ? " xl-r" : ""}`}>
                  {f.label}{f.required && <span className="xl-req">*</span>}
                </td>
              ))}
            </tr>

            {Array.from({ length: dataRows }, (_, i) => {
              const r = firstRow + i;
              const row = rows[i];
              const last = i === dataRows - 1;
              return (
                <tr key={r} className={`xl-row${last ? " xl-bottom" : ""}`}>
                  <th className={active?.r === r ? "on" : ""}>
                    <span>{r}</span>
                    {row && !disabled && rows.length > 1 && (
                      <button type="button" className="xl-del" onClick={() => { setActive(null); onRemoveRow?.(i); }}
                        title={`Delete entry ${i + 1}`} aria-label={`Delete entry ${i + 1}`}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </th>
                  <td className="xl-l c xl-no">{row ? i + 1 : ""}</td>
                  {fields.map((f, k) => {
                    const c = k + 1;
                    const name = `${colName(c)}${r}`;
                    const value = row?.[f.key] || "";
                    const cls = `${k === fields.length - 1 ? "xl-r" : ""}${on(c, r)}${missing(f, i) ? " xl-missing" : ""}`;
                    if (f.type === "date") {
                      return (
                        <td key={f.key} className={`c xl-date ${cls}`}>
                          <span>{value ? labDate(value) : ""}</span>
                          <input type="date" data-cell={name} value={value} aria-label={`${f.label}, row ${i + 1}`} disabled={disabled}
                            onFocus={focus(c, r)} onChange={(e) => edit(i, f.key, e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && moveOnKey(e, name)} />
                        </td>
                      );
                    }
                    if (f.type === "time") {
                      return (
                        <td key={f.key} className={`c ${cls}`}>
                          <input type="time" className={`xl-input c xl-time${value ? "" : " xl-empty"}`} data-cell={name} value={value} disabled={disabled}
                            aria-label={`${f.label}, row ${i + 1}`}
                            onFocus={focus(c, r)} onChange={(e) => edit(i, f.key, e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && moveOnKey(e, name)} />
                        </td>
                      );
                    }
                    if (f.type === "select") {
                      return (
                        <td key={f.key} className={cls}>
                          <select className="xl-input xl-select" data-cell={name} value={value} disabled={disabled}
                            aria-label={`${f.label}, row ${i + 1}`}
                            onFocus={focus(c, r)} onChange={(e) => edit(i, f.key, e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && moveOnKey(e, name)}>
                            <option value="" />
                            {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </td>
                      );
                    }
                    return (
                      <td key={f.key} className={`${f.type === "number" ? "c " : ""}${cls}`}>
                        <SheetCell name={name} raw={value} display={value} disabled={disabled}
                          multiline={f.type === "textarea"} className={f.type === "number" ? "c" : ""}
                          inputMode={f.type === "number" ? "decimal" : "text"}
                          onFocus={focus(c, r)} onInput={(v) => edit(i, f.key, v)} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr className="xl-h20"><th>{lastRow + 1}</th><td colSpan={cols} /></tr>
          </tbody>
        </table>
      </div>
      {!disabled && <p className="xl-tip">Type into any empty row to add an entry. Empty rows are left out when you submit.</p>}
    </div>
  );
}
