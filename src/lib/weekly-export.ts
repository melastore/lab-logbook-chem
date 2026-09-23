import type * as XLSXType from "xlsx";
import {
  WEEKLY_HOURS, taskWeight, taskAchWeight, planStats, performanceRating, weekRangeDMY,
  type WeeklyPlan,
} from "./weekly-plan";

type XLSX = typeof XLSXType;
type Cell = { t: string; v?: string | number; f?: string; z?: string };

// One week as the official "Weekly Plan & Report" template
// (may25weeklyPlan.xlsx), row for row, with the same live formulas.
export function templateSheet(XLSX: XLSX, plan: WeeklyPlan, displayName: string): XLSXType.WorkSheet {
  const range = weekRangeDMY(plan.weekStartDate);
  const tasks = plan.tasks;

  // Column letters B..I match the template (column A stays empty).
  const START = 13;
  const N = Math.max(13, tasks.length);
  const END = START + N - 1;
  const TOTAL = END + 1;
  const sumH = `SUM($H$${START}:$H$${END})`;

  const ws: Record<string, Cell> = {};
  const s = (addr: string, v: string) => { ws[addr] = { t: "s", v }; };
  const f = (addr: string, formula: string, z?: string) => { ws[addr] = { t: "n", f: formula, ...(z ? { z } : {}) }; };
  const n = (addr: string, v: number, z?: string) => { ws[addr] = { t: "n", v, ...(z ? { z } : {}) }; };

  s("C3", "Name:"); s("D3", displayName);
  s("B5", `በሳምንቱ ክትትል የሚያስፈልጋቸው ስራዎች  (${range})`);
  s("B6", `እቅድ (የሚሸፍነው ግዜ፡ 1 ሳምንት)  (${range})`);

  f("E6", `SUM(E${START}:E${END})`, "0.0%");
  s("F6", "የመንግስትን የሥራ ሰዓት አጠቃቀም  ክብደት (የ1 ቀን)"); f("H6", `8/${WEEKLY_HOURS}`); f("I6", "H7/H6");
  s("F7", "የመንግስትን የሥራ ሰዓት አጠቃቀም አፈጻጸም (የ1 ቀን)"); f("H7", `SUM(I${START}:I${END})`);
  s("F8", "እቅድ ክብደት (የ 1 ቀን)"); f("H8", "1*C12/5"); f("I8", "H9/H8");
  s("F9", "እቅድ አፈጻጸም (የ 1 ቀን)"); f("H9", `SUM(I${START}:I${END})`);

  s("B10", "Date (mm.dd.yy)"); s("C10", "ስራው የሚፈጀው ሰዓት"); s("D10", "ዋና ዋና ተግባራት");
  s("E10", "እቅድ (የሳምንቱ)"); s("F10", "አፈጻጸም (የሳምንቱ)");
  s("G10", "አስተያየት /የተገኘ ውጤት፣ የደረሰ ጉዳት፣ ያጋጠመ ችግር.../"); s("H10", "ክብደት");
  s("H11", "የስራው ክብደት"); s("I11", "የአፈጻጸም ክብደት");

  f("C12", `SUM(C${START}:C${END})`); f("E12", `SUM(E${START}:E${END})`, "0.0%"); f("F12", `SUM(F${START}:F${END})`, "0.0%");

  tasks.forEach((t, i) => {
    const r = START + i;
    if (t.date) s(`B${r}`, t.date);
    n(`C${r}`, Number(t.hours) || 0);
    if (t.activity) s(`D${r}`, t.activity);
    f(`E${r}`, `IF(H${r}="","",H${r}/${sumH})`, "0.0%");
    f(`F${r}`, `IF(I${r}="","",I${r}/${sumH})`, "0.0%");
    if (t.comment) s(`G${r}`, t.comment);
    f(`H${r}`, `IF(C${r}="","",C${r}/${WEEKLY_HOURS})`, "0.000");
    // Carry the analyst's formula into Excel, remapping row refs to this row.
    const raw = t.achFormula?.trim();
    if (raw && raw.startsWith("=")) {
      f(`I${r}`, raw.slice(1).replace(/([A-Za-z]+)\$?\d+/g, (_, L) => `${L}${r}`), "0.000");
    } else {
      n(`I${r}`, Number(taskAchWeight(t).toFixed(3)), "0.000");
    }
  });
  for (let r = START + tasks.length; r <= END; r++) {
    f(`E${r}`, `IF(H${r}="","",H${r}/${sumH})`, "0.0%");
    f(`F${r}`, `IF(I${r}="","",I${r}/${sumH})`, "0.0%");
    f(`H${r}`, `IF(C${r}="","",C${r}/${WEEKLY_HOURS})`, "0.000");
  }
  f(`E${TOTAL}`, `SUM(E${START}:E${END})`, "0.0%"); f(`F${TOTAL}`, `SUM(F${START}:F${END})`, "0.0%");

  const meta = ws as Record<string, unknown>;
  meta["!merges"] = [
    { s: { c: 3, r: 1 }, e: { c: 6, r: 1 } }, { s: { c: 1, r: 4 }, e: { c: 8, r: 4 } },
    { s: { c: 1, r: 5 }, e: { c: 3, r: 8 } }, { s: { c: 4, r: 5 }, e: { c: 4, r: 8 } },
    { s: { c: 5, r: 5 }, e: { c: 6, r: 5 } }, { s: { c: 8, r: 5 }, e: { c: 8, r: 6 } },
    { s: { c: 5, r: 6 }, e: { c: 6, r: 6 } }, { s: { c: 5, r: 7 }, e: { c: 6, r: 7 } },
    { s: { c: 8, r: 7 }, e: { c: 8, r: 8 } }, { s: { c: 5, r: 8 }, e: { c: 6, r: 8 } },
    { s: { c: 1, r: 9 }, e: { c: 1, r: 11 } }, { s: { c: 2, r: 9 }, e: { c: 2, r: 10 } },
    { s: { c: 3, r: 9 }, e: { c: 3, r: 11 } }, { s: { c: 4, r: 9 }, e: { c: 4, r: 10 } },
    { s: { c: 5, r: 9 }, e: { c: 5, r: 10 } }, { s: { c: 6, r: 9 }, e: { c: 6, r: 11 } },
    { s: { c: 7, r: 9 }, e: { c: 8, r: 9 } }, { s: { c: 7, r: 10 }, e: { c: 7, r: 11 } },
    { s: { c: 8, r: 10 }, e: { c: 8, r: 11 } }, { s: { c: 3, r: TOTAL - 1 }, e: { c: 5, r: TOTAL - 1 } },
  ];
  meta["!cols"] = [{ wch: 4 }, { wch: 14 }, { wch: 11 }, { wch: 40 }, { wch: 12 }, { wch: 13 }, { wch: 34 }, { wch: 12 }, { wch: 13 }];
  meta["!ref"] = `A1:I${TOTAL}`;
  return ws as XLSXType.WorkSheet;
}

// Summary + every task, for one analyst's history or a whole team.
export function summarySheets(XLSX: XLSX, plans: WeeklyPlan[], nameOf: (username: string) => string) {
  const summary: (string | number)[][] = [
    ["Name", "Username", "Week", "Tasks", "Completed", "Hours", "Achievement %", "Rating", "Last saved"],
  ];
  const detail: (string | number)[][] = [
    ["Name", "Week", "No.", "Date", "Hours", "Main task", "Weight", "Ach. weight", "Achievement %", "Comment / issues"],
  ];
  for (const p of plans) {
    const st = planStats(p.tasks);
    summary.push([
      nameOf(p.username), p.username, weekRangeDMY(p.weekStartDate), st.taskCount, st.completed, st.totalHours,
      Number(st.achievement.toFixed(1)), performanceRating(st.achievement, st.taskCount > 0).label,
      p.updatedAt ? new Date(p.updatedAt).toLocaleString() : "",
    ]);
    p.tasks.forEach((t, i) => {
      const w = taskWeight(t), aw = taskAchWeight(t);
      detail.push([
        nameOf(p.username), weekRangeDMY(p.weekStartDate), i + 1, t.date || "", Number(t.hours) || 0, t.activity || "",
        Number(w.toFixed(3)), Number(aw.toFixed(3)), Number((w > 0 ? (aw / w) * 100 : 0).toFixed(1)), t.comment || "",
      ]);
    });
  }
  const sumWs = XLSX.utils.aoa_to_sheet(summary);
  sumWs["!cols"] = [{ wch: 22 }, { wch: 14 }, { wch: 26 }, { wch: 7 }, { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 18 }, { wch: 22 }];
  sumWs["!autofilter"] = { ref: `A1:I${summary.length}` };
  const detWs = XLSX.utils.aoa_to_sheet(detail);
  detWs["!cols"] = [{ wch: 22 }, { wch: 26 }, { wch: 5 }, { wch: 12 }, { wch: 7 }, { wch: 44 }, { wch: 9 }, { wch: 11 }, { wch: 14 }, { wch: 36 }];
  detWs["!autofilter"] = { ref: `A1:J${detail.length}` };
  return { summary: sumWs, detail: detWs };
}

// Sheet names: max 31 chars, no []:*?/\ and unique within the book.
export function sheetName(base: string, used: Set<string>) {
  const clean = base.replace(/[[\]:*?/\\]/g, "-").slice(0, 31);
  let name = clean, i = 2;
  while (used.has(name)) name = `${clean.slice(0, 27)} (${i++})`;
  used.add(name);
  return name;
}

export const fileSafe = (v: string) => v.replace(/[^a-z0-9-]+/gi, "_");
