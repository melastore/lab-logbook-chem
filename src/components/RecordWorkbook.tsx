"use client";

import { useState, type ReactNode } from "react";
import type { LogbookRecord } from "@/lib/logbook";
import { LOG_TYPES } from "@/lib/logbook";
import type { FormDef } from "@/lib/forms";
import { displayFields, recordValue } from "@/lib/record-diff";
import { parseAnalystSignature } from "@/lib/signature";
import { colName, colWidth, colMaxWidth, fitWidth } from "./SheetCell";
import { labDate } from "./FormExcel";

export type SheetSelection = {
  ids: Set<string>;
  toggle: (id: string) => void;
  canSelect: (rec: LogbookRecord) => boolean;
};

// Submitted records as an Excel workbook: one sheet per log type, with the
// sheet tabs at the bottom. Rows are read-only; clicking one opens it.
export function RecordWorkbook({ records, forms, selectedId, onOpen, isCurrent, selection, showAnalyst, empty }: {
  records: LogbookRecord[];
  forms: FormDef[];
  selectedId?: string | null;
  onOpen: (rec: LogbookRecord) => void;
  isCurrent: (rec: LogbookRecord) => boolean;
  selection?: SheetSelection;
  showAnalyst?: boolean;
  empty?: ReactNode;
}) {
  const [pickedType, setPickedType] = useState<string | null>(null);

  const groups = new Map<string, LogbookRecord[]>();
  for (const rec of records) groups.set(rec.activityType, [...(groups.get(rec.activityType) || []), rec]);
  const order = forms.map((f) => f.activityType);
  const types = [...groups.keys()].sort((a, b) =>
    (order.indexOf(a) === -1 ? 999 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 999 : order.indexOf(b)));
  // Follow the open record onto its sheet.
  const openType = records.find((r) => r.id === selectedId)?.activityType;
  const type = (pickedType && types.includes(pickedType) ? pickedType : null) ?? openType ?? types[0];

  const formOf = (t: string) => forms.find((f) => f.activityType === t && f.scope !== "instrument");
  const titleOf = (t: string) => formOf(t)?.title || LOG_TYPES.find((x) => x.id === t)?.label || t;

  if (!type) return <div className="xl-book">{empty}</div>;

  const rows = groups.get(type)!;
  const form = formOf(type);
  const fields = displayFields(rows[0], form?.fields).filter((f) => f.key !== "instrumentUsed" && (showAnalyst || f.key !== "analyst"));
  const withInstrument = form?.scope !== "sample";
  const pick = selection ? rows.filter(selection.canSelect) : [];

  // Columns after the row header: [select], No., Status, [Instrument, ID], fields, Signed.
  // Status sits up front so it stays in view when the sheet scrolls sideways.
  const lead = (selection ? 1 : 0) + 2 + (withInstrument ? 2 : 0);
  const cols = lead + fields.length + 1;
  const counts = { Pending: 0, Approved: 0, Rejected: 0 };
  for (const r of rows) if (isCurrent(r)) counts[r.status]++;

  return (
    <div className="xl-book">
      <div className="xl-grid xl-grid-book">
        <table className="xl-sheet xl-read">
          <colgroup>
            <col className="xl-c-hdr" />
            {selection && <col style={{ width: 34 }} />}
            <col style={{ width: 44 }} />
            <col style={{ width: 100 }} />
            {withInstrument && <><col style={{ width: 150 }} /><col style={{ width: 110 }} /></>}
            {fields.map((f) => <col key={f.key} style={{ width: fitWidth(rows.map((r) => recordValue(r, f.key)), colWidth(f), colMaxWidth(f)) }} />)}
            <col style={{ width: 120 }} />
          </colgroup>
          <thead>
            <tr><th className="xl-corner" />{Array.from({ length: cols }, (_, c) => <th key={c}>{colName(c)}</th>)}</tr>
          </thead>
          <tbody>
            <tr className="xl-h29">
              <th>1</th>
              <td colSpan={cols} className="xl-form-title">{titleOf(type)}</td>
            </tr>
            <tr className="xl-h10"><th>2</th><td colSpan={cols} /></tr>
            <tr className="xl-head xl-top">
              <th>3</th>
              {selection && (
                <td className="xl-l m">
                  <input type="checkbox" aria-label="Select all pending" disabled={pick.length === 0}
                    checked={pick.length > 0 && pick.every((r) => selection.ids.has(r.id))}
                    onChange={(e) => { for (const r of pick) if (selection.ids.has(r.id) !== e.target.checked) selection.toggle(r.id); }} />
                </td>
              )}
              <td className={`m${selection ? "" : " xl-l"}`}>No.</td>
              <td className="m">Status</td>
              {withInstrument && <><td className="m">Instrument</td><td className="m">ID</td></>}
              {fields.map((f) => <td key={f.key} className="m">{f.label}</td>)}
              <td className="m xl-r">Signed</td>
            </tr>
            {rows.map((rec, i) => {
              const r = 4 + i;
              const sig = parseAnalystSignature(rec.analystSignature);
              const current = isCurrent(rec);
              const open = rec.id === selectedId;
              return (
                <tr key={rec.id} className={`xl-row xl-click${open ? " is-open" : ""}${i === rows.length - 1 ? " xl-bottom" : ""}`}
                  onClick={() => onOpen(rec)} tabIndex={0} aria-selected={open}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(rec); } }}>
                  <th className={open ? "on" : ""}>{r}</th>
                  {selection && (
                    <td className="xl-l c" onClick={(e) => e.stopPropagation()}>
                      {selection.canSelect(rec) && (
                        <input type="checkbox" aria-label="Select for approval" checked={selection.ids.has(rec.id)} onChange={() => selection.toggle(rec.id)} />
                      )}
                    </td>
                  )}
                  <td className={`c xl-no${selection ? "" : " xl-l"}`}>{i + 1}</td>
                  <td className={`c xl-status-cell ${current ? rec.status.toLowerCase() : "old"}`}>
                    {current ? rec.status : "Old version"}{rec.amends && current ? " *" : ""}
                  </td>
                  {withInstrument && <><td className="b">{rec.instrumentName || ""}</td><td>{rec.instrumentId || ""}</td></>}
                  {fields.map((f) => {
                    const v = recordValue(rec, f.key);
                    return (
                      <td key={f.key} className={f.type === "number" || f.type === "time" || f.type === "date" ? "c" : ""} title={v}>
                        {f.type === "date" ? labDate(v) : v}
                      </td>
                    );
                  })}
                  <td className="c xl-r xl-sig">
                    {sig.image
                      // Inline data: URL stored in the record, nothing for next/image to optimise.
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={sig.image} alt={`Signed by ${sig.signedBy || rec.analyst}`} />
                      : sig.typed || ""}
                  </td>
                </tr>
              );
            })}
            <tr className="xl-h20"><th>{4 + rows.length}</th><td colSpan={cols} /></tr>
          </tbody>
        </table>
      </div>

      <div className="xl-tabs" role="tablist" aria-label="Log types">
        {types.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={t === type} className={t === type ? "on" : ""} onClick={() => setPickedType(t)}>
            {titleOf(t)} <span>{groups.get(t)!.length}</span>
          </button>
        ))}
      </div>
      <div className="xl-status xl-status-book">
        <span>Ready</span>
        {rows.some((r) => r.amends) && <span className="xl-status-hint">* corrected record</span>}
        <span className="xl-status-end">
          Count: {rows.length}
          {counts.Pending > 0 && <> · Pending: {counts.Pending}</>}
          {counts.Approved > 0 && <> · Approved: {counts.Approved}</>}
          {counts.Rejected > 0 && <> · Rejected: {counts.Rejected}</>}
        </span>
      </div>
    </div>
  );
}
