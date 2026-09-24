"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { addWeeks, mondayOf, parseISODate, toISODate, weekLabel } from "@/lib/weekly-plan";

const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

// Month grid where a click picks the whole Monday-Friday week.
// `saved` marks weeks that already have a plan.
export function WeekPicker({ value, onChange, saved }: {
  value: string; onChange: (monday: string) => void; saved?: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => (parseISODate(value) || new Date()));
  const box = useRef<HTMLDivElement>(null);
  const thisWeek = mondayOf();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  function toggle() {
    if (!open) setMonth(parseISODate(value) || new Date());
    setOpen(!open);
  }

  function pick(monday: string) {
    setOpen(false);
    onChange(monday);
  }

  const y = month.getFullYear(), m = month.getMonth();
  const first = mondayOf(new Date(y, m, 1));
  const weeks: string[] = [];
  for (let w = first; parseISODate(w)! <= new Date(y, m + 1, 0); w = addWeeks(w, 1)) weeks.push(w);

  return (
    <div className="wkp" ref={box}>
      <div className="wkp-bar">
        <button type="button" className="wkp-step" onClick={() => onChange(addWeeks(value, -1))} aria-label="Previous week"><ChevronLeft size={18} /></button>
        <button type="button" className={`wkp-trigger ${open ? "open" : ""}`} onClick={toggle} aria-expanded={open} aria-haspopup="dialog">
          <CalendarDays size={16} />
          <span>
            <small>{value === thisWeek ? "This week" : value === addWeeks(thisWeek, -1) ? "Last week" : value === addWeeks(thisWeek, 1) ? "Next week" : "Week of"}</small>
            {weekLabel(value)}
          </span>
          <ChevronDown size={15} className="wkp-caret" />
        </button>
        <button type="button" className="wkp-step" onClick={() => onChange(addWeeks(value, 1))} aria-label="Next week"><ChevronRight size={18} /></button>
      </div>

      {open && (
        <div className="wkp-pop" role="dialog" aria-label="Pick a week">
          <div className="wkp-head">
            <button type="button" onClick={() => setMonth(new Date(y, m - 1, 1))} aria-label="Previous month"><ChevronLeft size={16} /></button>
            <strong>{month.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</strong>
            <button type="button" onClick={() => setMonth(new Date(y, m + 1, 1))} aria-label="Next month"><ChevronRight size={16} /></button>
          </div>
          <div className="wkp-days">{DAYS.map((d) => <span key={d}>{d}</span>)}</div>
          {weeks.map((w) => {
            const start = parseISODate(w)!;
            return (
              <button key={w} type="button" onClick={() => pick(w)}
                className={`wkp-week${w === value ? " on" : ""}${w === thisWeek ? " now" : ""}`}>
                {DAYS.map((_, i) => {
                  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
                  const cls = [d.getMonth() !== m && "out", i > 4 && "we", toISODate(d) === toISODate(new Date()) && "today"].filter(Boolean).join(" ");
                  return <span key={i} className={cls}>{d.getDate()}</span>;
                })}
                {saved?.has(w) && <i className="wkp-dot" title="Has a saved plan" />}
              </button>
            );
          })}
          <div className="wkp-foot">
            <span><i className="wkp-dot" /> saved plan</span>
            <button type="button" onClick={() => pick(thisWeek)}>This week</button>
          </div>
        </div>
      )}
    </div>
  );
}
