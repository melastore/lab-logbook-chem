"use client";

import { FormEvent, useEffect, useMemo, useState, useRef, KeyboardEvent } from "react";
import Link from "next/link";
import {
  Activity, ArrowRight, X, Search,
  CheckCircle2, Microscope,
  ChevronRight, ChevronDown, Zap, Droplets, Beaker,
  PanelLeftClose, PanelLeft, Plus, Trash2
} from "lucide-react";
import { LabLogo } from "@/components/LabLogo";
import type { AppUser, InstrumentTemplate, InstrumentCategory } from "@/lib/logbook";
import {
  INSTRUMENT_TREE, ANALYTICAL_FORMS, SAMPLE_FORMS, INSTRUMENT_INFO_FORM, STANDARD_KEYS, INSTRUMENT_STANDARD_KEYS,
  type InstrumentNode, type FormDef, type FormField,
} from "@/lib/forms";
import { SignOff } from "@/components/SignOff";
import { FormExcel, isBlankRow, labDate } from "@/components/FormExcel";
import { AppHeader } from "@/components/AppHeader";
import { toISODate } from "@/lib/weekly-plan";
import { encodeAnalystSignature } from "@/lib/signature";
import { useSettings } from "@/lib/settings-context";

type SubmitState = "idle" | "submitting" | "sent" | "error";
type Mode = "analytical" | "sampleprep";

// Sentinel form id for the read-only "General" info tab (not a real data-entry
// form — it shows the selected instrument's general information).
const GENERAL_TAB = "__general__";

const GROUP_ICONS: Record<string, React.ReactNode> = {
  gc: <Activity size={16} />,
  elemental: <Zap size={16} />,
  hplc: <Droplets size={16} />,
};

// Icon for a saved-template category (matched by name, falls back to a flask).
function categoryIcon(name: string): React.ReactNode {
  const key = name.toLowerCase();
  if (key.includes("gas") || key.includes("gc")) return <Activity size={16} />;
  if (key.includes("liquid") || key.includes("hplc") || key.includes("lc")) return <Droplets size={16} />;
  if (key.includes("icp") || key.includes("element") || key.includes("aas")) return <Zap size={16} />;
  return <Beaker size={16} />;
}

// Local date: toISOString() is UTC and gives yesterday's date after midnight
// in Addis (UTC+3) until 03:00.
function todayISO() {
  return toISODate(new Date());
}

// "HH:MM" strings compare correctly as text.
function endBeforeStart(row: Record<string, string>) {
  return Boolean(row.startTime && row.endTime && row.endTime < row.startTime);
}

function futureDate(row: Record<string, string>) {
  return Boolean(row.date && row.date > todayISO());
}

const MAX_ROWS = 50;

type Draft = { rows: Record<string, string>[]; signature: string };
const DRAFTS_KEY = "lab-entry-drafts";

// Storage can be missing or full (private mode); drafts are a convenience.
function readDrafts(): Record<string, Draft> {
  try { return JSON.parse(localStorage.getItem(DRAFTS_KEY) || "{}"); } catch { return {}; }
}
function writeDrafts(drafts: Record<string, Draft>) {
  try { localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts)); } catch { /* ignore */ }
}

export default function AnalystEntryPage() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [mode, setMode] = useState<Mode>("analytical");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedInstrument, setSelectedInstrument] = useState<InstrumentNode | null>(null);
  // Forms are admin-editable and loaded from the server; the static defaults
  // are the initial value / fallback so the page renders before the fetch.
  const [analyticalForms, setAnalyticalForms] = useState<FormDef[]>(ANALYTICAL_FORMS);
  const [sampleForms, setSampleForms] = useState<FormDef[]>(SAMPLE_FORMS);
  const [allForms, setAllForms] = useState<FormDef[]>([]);
  // Default to the built-in General Information form so the General tab is never
  // empty; a DB-defined instrument form (if any) overrides it once loaded.
  const [instrumentForm, setInstrumentForm] = useState<FormDef | null>(INSTRUMENT_INFO_FORM);
  const [analyticalFormId, setAnalyticalFormId] = useState<string>(ANALYTICAL_FORMS[0].id);
  const [sampleFormId, setSampleFormId] = useState<string>(SAMPLE_FORMS[0].id);

  const [rows, setRows] = useState<Record<string, string>[]>([{ date: todayISO() }]);
  const [signatureImage, setSignatureImage] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");
  // Set on a submit attempt with gaps, so empty required cells are only flagged
  // once the user has tried to submit rather than the moment the form opens.
  const [showMissing, setShowMissing] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [templates, setTemplates] = useState<InstrumentTemplate[]>([]);
  const [categories, setCategories] = useState<InstrumentCategory[]>([]);
  const { formLayout } = useSettings();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => {
        if (d.user) {
          setUser(d.user);
          setRows((prev) => prev.map(r => ({ ...r, analyst: r.analyst || d.user.fullName || d.user.username })));
        }
      })
      .catch(() => {})
      .finally(() => setAuthReady(true));


    fetch("/api/templates/categories")
      .then((r) => r.ok ? r.json() : { categories: [] })
      .then((d) => setCategories(d.categories || []))
      .catch(() => {});

    fetch("/api/templates")
      .then((r) => r.ok ? r.json() : { templates: [] })
      .then((d) => {
        const tpls: InstrumentTemplate[] = d.templates || [];
        setTemplates(tpls);
        // Open the first instrument's category group by default.
        const firstCat = tpls[0]?.categoryName;
        if (firstCat) setExpanded((prev) => (prev.size ? prev : new Set([firstCat])));
      })
      .catch(() => {});

    fetch("/api/forms")
      .then((r) => r.ok ? r.json() : { forms: [] })
      .then((d) => {
        const forms: FormDef[] = d.forms || [];
        setAllForms(forms);
        if (forms.length === 0) return; // keep the static fallback
        const analytical = forms.filter((f) => f.scope === "analytical");
        const sample = forms.filter((f) => f.scope === "sample");
        const instrument = forms.find((f) => f.scope === "instrument");
        if (instrument) setInstrumentForm(instrument);
        if (analytical.length) {
          setAnalyticalForms(analytical);
          setAnalyticalFormId((id) => (analytical.some((f) => f.id === id) ? id : analytical[0].id));
        }
        if (sample.length) {
          setSampleForms(sample);
          setSampleFormId((id) => (sample.some((f) => f.id === id) ? id : sample[0].id));
        }
      })
      .catch(() => {});
  }, []);

  // Auto-dismiss the success banner a few seconds after a submission.
  useEffect(() => {
    if (submitState !== "sent") return;
    const timer = setTimeout(() => {
      setSubmitState("idle");
      setMessage("");
    }, 8000);
    return () => clearTimeout(timer);
  }, [submitState]);

  // "General" is a synthetic analytical tab that shows instrument info instead
  // of a data-entry form.
  const isGeneral = mode === "analytical" && analyticalFormId === GENERAL_TAB;
  const currentForm: FormDef = mode === "analytical"
    ? (analyticalForms.find((f) => f.id === analyticalFormId) ?? analyticalForms[0])
    : (sampleForms.find((f) => f.id === sampleFormId) ?? sampleForms[0]);

  const showForm = mode === "analytical" ? selectedInstrument !== null : true;

  // Anything typed beyond the prefilled date/analyst, or a signature.
  const isDirty = Boolean(signatureImage) || rows.some((row) => !isBlankRow(row));

  // Unsubmitted work is kept per user, instrument and form, so switching
  // away and back brings it back instead of asking to discard it.
  const formIdFor = (m: Mode) => (m === "analytical" ? analyticalFormId : sampleFormId);
  const keyFor = (m: Mode, instrumentId: string | undefined, formId: string) =>
    `${user?.username || ""}:${m}:${m === "analytical" ? instrumentId || "" : ""}:${formId}`;
  const entryKey = keyFor(mode, selectedInstrument?.id, formIdFor(mode));

  useEffect(() => {
    if (!user || !showForm) return;
    const drafts = readDrafts();
    if (isDirty) drafts[entryKey] = { rows, signature: signatureImage };
    else delete drafts[entryKey];
    writeDrafts(drafts);
  }, [user, showForm, entryKey, isDirty, rows, signatureImage]);

  const [cleared, setCleared] = useState<Draft | null>(null);
  useEffect(() => {
    if (!cleared) return;
    const t = setTimeout(() => setCleared(null), 8000);
    return () => clearTimeout(t);
  }, [cleared]);

  function clearSheet() {
    setCleared({ rows, signature: signatureImage });
    setRows([newRow()]);
    setSignatureImage("");
    setShowMissing(false);
    resetTransient();
  }

  function undoClear() {
    if (!cleared) return;
    setRows(cleared.rows);
    setSignatureImage(cleared.signature);
    setCleared(null);
  }

  function resetTransient() {
    setSubmitState("idle");
    setMessage("");
  }

  function newRow(): Record<string, string> {
    return { date: todayISO(), ...(user ? { analyst: user.fullName || user.username } : {}) };
  }

  // Each instrument and form has its own sheet, so values typed for one
  // can't be submitted under another.
  function resetEntry(key: string) {
    const draft = readDrafts()[key];
    setRows(draft?.rows?.length ? draft.rows : [newRow()]);
    setSignatureImage(draft?.signature || "");
    setShowMissing(false);
    setCleared(null);
    resetTransient();
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setNavOpen(false);
    resetEntry(keyFor(next, selectedInstrument?.id, formIdFor(next)));
  }

  function toggleGroup(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function pickInstrument(node: InstrumentNode) {
    if (selectedInstrument?.id === node.id) { setNavOpen(false); return; }
    const matched = templates.find(t => t.instrumentId === node.instrumentId);
    if (matched) {
      const t = matched;
      setSelectedInstrument({
        ...node,
        department: t.department || node.department,
        desk: t.desk || node.desk,
        laboratoryName: t.laboratoryName || node.laboratoryName,
        location: t.location || node.location,
        manufacturer: t.manufacturer || node.manufacturer,
        installationDate: t.installationDate || node.installationDate,
        logbookStartDate: t.logbookStartDate || node.logbookStartDate,
        logbookEndDate: t.logbookEndDate || node.logbookEndDate,
        metadata: t.metadata || node.metadata,
        infoFormId: t.infoFormId,
      });
      // Set the specific info form if assigned
      const f = (t.infoFormId && allForms.find(f => f.id === t.infoFormId))
        || allForms.find(f => f.scope === "instrument");
      setInstrumentForm(f || INSTRUMENT_INFO_FORM);
    } else {
      setSelectedInstrument(node);
      const f = allForms.find(f => f.scope === "instrument");
      setInstrumentForm(f || INSTRUMENT_INFO_FORM);
    }
    setAnalyticalFormId(analyticalForms[0].id);
    setNavOpen(false);
    resetEntry(keyFor("analytical", node.id, analyticalForms[0].id));
  }

  // Saved instrument templates grouped by category. The categories table (with
  // its admin-defined order) is the source of truth, so every category added in
  // the admin "Laboratory Instruments" tab appears here in the right order —
  // even before it has any instruments. Templates whose category is missing fall
  // into an "Other" group so nothing is ever hidden.
  const templateGroups = useMemo(() => {
    if (categories.length === 0) {
      const map = new Map<string, InstrumentTemplate[]>();
      for (const t of templates) {
        const arr = map.get(t.categoryName || "Other");
        if (arr) arr.push(t);
        else map.set(t.categoryName || "Other", [t]);
      }
      return [...map.entries()].map(([name, items]) => ({ name, items }));
    }
    const groups = categories.map((c) => ({
      name: c.name,
      items: templates.filter((t) => t.categoryId === c.id),
    }));
    const knownIds = new Set(categories.map((c) => c.id));
    const orphans = templates.filter((t) => !knownIds.has(t.categoryId));
    if (orphans.length) groups.push({ name: "Other", items: orphans });
    return groups;
  }, [templates, categories]);

  const [navQuery, setNavQuery] = useState("");
  const navQ = navQuery.trim().toLowerCase();
  const searching = navQ.length > 0;
  const visibleGroups = templateGroups
    .map((g) => ({
      ...g,
      items: searching
        ? g.items.filter((t) => [t.instrumentName, t.instrumentId, t.instrumentModel, g.name].some((v) => (v || "").toLowerCase().includes(navQ)))
        : g.items,
    }))
    .filter((g) => !searching || g.items.length > 0);

  function pickTemplate(t: InstrumentTemplate) {
    if (selectedInstrument?.id === t.id) { setNavOpen(false); return; }
    setSelectedInstrument({
      id: t.id,
      name: t.instrumentName,
      instrumentId: t.instrumentId,
      model: t.instrumentModel,
      serialNumber: t.serialNumber,
      department: t.department,
      desk: t.desk,
      laboratoryName: t.laboratoryName,
      location: t.location,
      manufacturer: t.manufacturer,
      installationDate: t.installationDate,
      logbookStartDate: t.logbookStartDate,
      logbookEndDate: t.logbookEndDate,
      methodUsed: t.methodUsed,
      metadata: t.metadata,
      infoFormId: t.infoFormId,
    });
    // Set the specific info form if assigned, else the default instrument form,
    // else the built-in fallback so the General tab is never empty.
    const f = (t.infoFormId && allForms.find(f => f.id === t.infoFormId))
      || allForms.find(f => f.scope === "instrument");
    setInstrumentForm(f || INSTRUMENT_INFO_FORM);
    setAnalyticalFormId(analyticalForms[0].id);
    setNavOpen(false);
    resetEntry(keyFor("analytical", t.id, analyticalForms[0].id));
  }

  function pickSampleForm(id: string) {
    if (id === sampleFormId) { setNavOpen(false); return; }
    setSampleFormId(id);
    setNavOpen(false);
    resetEntry(keyFor("sampleprep", undefined, id));
  }

  // Extra rows left empty are dropped; the first row always counts.
  const entryRows = rows.filter((row, i) => i === 0 || !isBlankRow(row));
  const missingCount = entryRows.reduce((n, row) =>
    n + currentForm.fields.filter((f) => f.required && !(row[f.key] || "").trim()).length, 0);
  const badTimeRows = rows.map((row, i) => (endBeforeStart(row) ? i + 1 : 0)).filter(Boolean);
  const futureRows = rows.map((row, i) => (futureDate(row) ? i + 1 : 0)).filter(Boolean);
  const canSubmit = Boolean(user) && showForm && missingCount === 0 && badTimeRows.length === 0 && futureRows.length === 0 && Boolean(signatureImage) && entryRows.length > 0;

  const filledCount = entryRows.filter((row) => !isBlankRow(row)).length;
  const checks = [
    {
      ok: filledCount > 0 && missingCount === 0,
      text: filledCount === 0 ? "Fill in at least one entry"
        : missingCount ? `${missingCount} required cell${missingCount === 1 ? "" : "s"} empty`
        : `${filledCount} ${filledCount === 1 ? "entry" : "entries"}, required cells filled`,
    },
    ...(badTimeRows.length ? [{ ok: false, bad: true, text: `End time is before start time on row ${badTimeRows.join(", ")}` }] : []),
    ...(futureRows.length ? [{ ok: false, bad: true, text: `Date is in the future on row ${futureRows.join(", ")}` }] : []),
    { ok: Boolean(signatureImage), text: signatureImage ? "Signed" : "Sign in the box" },
  ];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !showForm) return;
    if (!canSubmit) {
      setShowMissing(true);
      resetTransient();
      return;
    }
    setSubmitState("submitting");
    setMessage("");

    const payloads = entryRows.map(row => {
      const meta: Record<string, string> = {};
      const std: Record<string, string> = {};
      for (const f of currentForm.fields) {
        const v = (row[f.key] ?? "").trim();
        if (STANDARD_KEYS.has(f.key)) std[f.key] = v;
        else if (v) meta[f.key] = v;
      }

      const instrumentName = selectedInstrument
        ? selectedInstrument.name
        : (row.instrumentUsed || currentForm.title);

      return {
        laboratoryName: selectedInstrument?.laboratoryName ?? "",
        department: selectedInstrument?.department ?? "",
        location: selectedInstrument?.location ?? "",
        instrumentName,
        instrumentModel: selectedInstrument?.model ?? "",
        serialNumber: selectedInstrument?.serialNumber ?? "",
        manufacturer: selectedInstrument?.manufacturer ?? "",
        installationDate: selectedInstrument?.installationDate ?? "",
        instrumentId: selectedInstrument?.instrumentId ?? "",
        methodUsed: std.methodUsed || selectedInstrument?.methodUsed || "",
        date: std.date ?? todayISO(),
        analyst: std.analyst ?? user.fullName ?? user.username,
        activityType: currentForm.activityType,
        sampleId: std.sampleId ?? "",
        measuredValue: std.measuredValue ?? "",
        startTime: std.startTime ?? "",
        endTime: std.endTime ?? "",
        remarks: std.remarks ?? "",
        metadata: { ...selectedInstrument?.metadata, ...meta },
        analystSignature: encodeAnalystSignature({
          typed: "",
          image: signatureImage,
          signedAt: new Date().toISOString(),
          signedBy: user.fullName,
          username: user.username,
        }),
      };
    });

    let response: Response;
    try {
      response = await fetch("/api/logbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloads),
      });
    } catch {
      setSubmitState("error");
      setMessage("Couldn't reach the server — nothing was submitted. Check your connection and try again.");
      return;
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      setSubmitState("error");
      setMessage(response.status === 401 ? "Sign in before submitting." : err.error || "Submission failed. Please try again.");
      return;
    }

    const result = await response.json().catch(() => ({ count: payloads.length }));
    setSubmitState("sent");
    setMessage(`Successfully submitted ${result.count} ${result.count === 1 ? "record" : "records"} as ${user.fullName || user.username}. Log entries are sealed in a secure hash chain and cannot be modified or deleted.`);
    setRows([newRow()]);
    setSignatureImage("");
    setShowMissing(false);
  }

  const sheetInfo: [string, string][] = mode === "analytical" && selectedInstrument
    ? ([
        ["Instrument", [selectedInstrument.name, selectedInstrument.instrumentId, selectedInstrument.model].filter(Boolean).join(" · ")],
        ["Laboratory", [selectedInstrument.laboratoryName, selectedInstrument.location].filter(Boolean).join(" · ")],
      ] as [string, string][]).filter(([, v]) => v)
    : [];
  const excel = formLayout === "excel";

  return (
    <main className="app-layout">
      <AppHeader
        user={user}
      />
      <div className="entry-shell">
      {/* ── Instrument list ── */}
      <aside className={`lab-nav ${navOpen ? "open" : ""} ${collapsed ? "collapsed" : ""}`} aria-label="Instruments">
        <div className="lab-nav-brand">
          <span className="lab-nav-title">{mode === "analytical" ? "Instruments" : "Sample preparation"}</span>
          <button className="lab-nav-close" type="button" onClick={() => setNavOpen(false)} aria-label="Close list"><X size={18} /></button>
          <button className="nav-collapse-btn" type="button" onClick={() => setCollapsed(true)} title="Collapse menu" aria-label="Collapse menu">
            <PanelLeftClose size={18} />
          </button>
        </div>

        <nav className="lab-nav-tree">
          {mode === "analytical" ? (
            <>
              {templates.length > 0 && (
                <div className="nav-search">
                  <Search size={15} aria-hidden="true" />
                  <input value={navQuery} onChange={(e) => setNavQuery(e.target.value)} placeholder="Find instrument…" aria-label="Find instrument" />
                  {navQuery && <button type="button" onClick={() => setNavQuery("")} aria-label="Clear"><X size={14} /></button>}
                </div>
              )}
              {templateGroups.length > 0 ? (
                visibleGroups.length === 0 ? (
                  <p className="nav-empty">No instrument matches “{navQuery}”.</p>
                ) : visibleGroups.map((group) => {
                  // While searching, every matching group is open.
                  const open = searching || expanded.has(group.name);
                  return (
                    <div key={group.name} className="nav-group">
                      <button type="button" className="nav-group-head" onClick={() => toggleGroup(group.name)} aria-expanded={open}>
                        <span className="nav-group-icon">{categoryIcon(group.name)}</span>
                        <span className="nav-group-name">{group.name}</span>
                        <span className="nav-group-count">{group.items.length}</span>
                        <ChevronDown size={15} className={`nav-caret ${open ? "open" : ""}`} />
                      </button>
                      {open && (
                        <div className="nav-instruments">
                          {group.items.length === 0 && <p className="nav-empty">No instruments yet.</p>}
                          {group.items.map((tpl) => (
                            <button
                              key={tpl.id}
                              type="button"
                              className={`nav-instrument ${selectedInstrument?.id === tpl.id ? "active" : ""}`}
                              onClick={() => pickTemplate(tpl)}
                              aria-current={selectedInstrument?.id === tpl.id ? "true" : undefined}
                            >
                              <ChevronRight size={13} />
                              <span className="nav-instrument-text">
                                <span>{tpl.instrumentName}</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                INSTRUMENT_TREE.map((group) => {
                  const open = expanded.has(group.id);
                  return (
                    <div key={group.id} className="nav-group">
                      <button type="button" className="nav-group-head" onClick={() => toggleGroup(group.id)}>
                        <span className="nav-group-icon">{GROUP_ICONS[group.id]}</span>
                        <span className="nav-group-name">{group.name}</span>
                        <ChevronDown size={15} className={`nav-caret ${open ? "open" : ""}`} />
                      </button>
                      {open && (
                        <div className="nav-instruments">
                          {group.children.map((node) => (
                            <button
                              key={node.id}
                              type="button"
                              className={`nav-instrument ${selectedInstrument?.id === node.id ? "active" : ""}`}
                              onClick={() => pickInstrument(node)}
                            >
                              <ChevronRight size={13} />
                              <span>{node.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </>
          ) : (
            <>
              <p className="nav-section-label">Sample Preparation &amp; Reagent</p>
              <div className="nav-instruments" style={{ marginLeft: 4 }}>
                {sampleForms.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`nav-instrument ${sampleFormId === f.id ? "active" : ""}`}
                    onClick={() => pickSampleForm(f.id)}
                  >
                    <ChevronRight size={13} />
                    <span>{f.title}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </nav>

        <div className="lab-nav-foot">
          {/* Sidebar footer simplified */}
        </div>
      </aside>

      {navOpen && <div className="lab-nav-scrim" onClick={() => setNavOpen(false)} />}

      <div className="app-frame entry-frame">
        <div className="entry-topbar">
          <button className="entry-list-btn" type="button" onClick={() => setNavOpen(true)} aria-label="Choose instrument">
            <PanelLeft size={18} /> <span>{mode === "analytical" ? (selectedInstrument?.name || "Choose instrument") : currentForm.title}</span>
          </button>
          {collapsed && (
            <button className="nav-reopen" type="button" onClick={() => setCollapsed(false)} title="Show list" aria-label="Show list">
              <PanelLeft size={20} />
            </button>
          )}
          <div className="entry-topbar-title">
            <h1>Chemical Metrology Laboratory Logbook</h1>
          </div>
        </div>

        <div className="mode-tabs">
          <button type="button" className={`mode-tab ${mode === "analytical" ? "active" : ""}`} onClick={() => switchMode("analytical")}>
            <Microscope size={18} />
            <span>Analytical Instrument</span>
          </button>
          <button type="button" className={`mode-tab ${mode === "sampleprep" ? "active" : ""}`} onClick={() => switchMode("sampleprep")}>
            <Beaker size={18} />
            <span>Sample Preparation</span>
          </button>
        </div>

        <div className="entry-body">
          {!showForm ? (
            <div className="entry-welcome">
              <div className="empty-icon-wrap"><Microscope size={40} /></div>
              <h2>Choose an instrument to begin</h2>
              <p>Expand a group in the left menu and select an instrument.</p>
            </div>
          ) : (
            <>
              {submitState === "sent" && (
                <div
                  role="status"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 18px",
                    borderRadius: 12,
                    marginBottom: 16,
                    background: "color-mix(in srgb, var(--success) 14%, var(--surface))",
                    border: "1px solid var(--success)",
                    color: "var(--success)",
                    fontWeight: 700,
                  }}
                >
                  <CheckCircle2 size={20} />
                  <span>{message}</span>
                </div>
              )}
              {mode === "analytical" && (
                <div className="form-tabs" style={{ justifyContent: "flex-start" }}
                  onClick={(e) => (e.target as HTMLElement).closest("button")?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" })}>
                  <button
                    type="button"
                    className={`form-tab ${isGeneral ? "active" : ""}`}
                    onClick={() => { if (isGeneral) return; setAnalyticalFormId(GENERAL_TAB); resetEntry(keyFor("analytical", selectedInstrument?.id, GENERAL_TAB)); }}
                  >
                    General
                  </button>
                  {analyticalForms.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`form-tab ${!isGeneral && analyticalFormId === f.id ? "active" : ""}`}
                      onClick={() => { if (!isGeneral && analyticalFormId === f.id) return; setAnalyticalFormId(f.id); resetEntry(keyFor("analytical", selectedInstrument?.id, f.id)); }}
                    >
                      {f.title}
                    </button>
                  ))}
                </div>
              )}

              {isGeneral ? (
                <div className="entry-form-panel panel shadow-sm">
                  <div className="doc-form-header" style={{ padding: '16px 24px' }}>
                    <h2 className="doc-form-title">{selectedInstrument?.name} - General Information</h2>
                  </div>
                  <div style={{ padding: '0 24px 24px' }}>
                    <GeneralInfoPanel instrument={selectedInstrument} formDef={instrumentForm} />
                  </div>
                </div>
              ) : (
              <form className="entry-form-panel panel shadow-sm" onSubmit={handleSubmit} noValidate>
                {!excel && <div className="doc-form-header" style={{ padding: '16px 24px', justifyContent: 'flex-start', gap: 12 }}>
                  <h2 className="doc-form-title" style={{ margin: 0 }}>{currentForm.title}</h2>
                  {mode === "analytical" && selectedInstrument && (
                    <span className="doc-form-instrument">
                      {selectedInstrument.name}
                      {selectedInstrument.instrumentId ? ` · ${selectedInstrument.instrumentId}` : ""}
                    </span>
                  )}
                </div>}

                 {authReady && !user ? (
                  <div className="auth-preview-overlay-container">
                    <div className="auth-preview-blurred">
                      {excel ? (
                        <FormExcel title={currentForm.title} info={sheetInfo} fields={currentForm.fields}
                          rows={rows} setRows={setRows} newRow={newRow} maxRows={MAX_ROWS} disabled />
                      ) : formLayout === 'cards' ? (
                        <FormCards
                          fields={currentForm.fields}
                          rows={rows}
                          setRows={setRows}
                          disabled={true}
                        />
                      ) : (
                        <FormSpreadsheet
                          fields={currentForm.fields}
                          rows={rows}
                          setRows={setRows}
                          disabled={true}
                        />
                      )}
                      
                      <SignOff analyst="" date={labDate(todayISO())} checks={[]} attempted={false}
                        signature="" onSignature={() => {}} entries={1} submitting={false} error="" disabled />
                    </div>

                    <div className="auth-lock-overlay">
                      <div className="auth-lock-card shadow-lg">
                        <LabLogo size={60} />
                        <div className="auth-lock-heading">
                          <h3 className="auth-lock-title">Sign in to continue</h3>
                          <p className="auth-lock-desc">
                            Log entries are signed and sealed in a secure hash chain.
                            Sign in to record and submit your work.
                          </p>
                        </div>

                        <Link href="/login" className="btn btn-primary btn-lg btn-icon-gap lock-btn">
                          <span>Sign In</span>
                          <ArrowRight size={18} />
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {excel ? (
                      <FormExcel title={currentForm.title} info={sheetInfo} fields={currentForm.fields}
                        rows={rows} setRows={setRows} newRow={newRow} maxRows={MAX_ROWS} showMissing={showMissing}
                        onRemoveRow={(i) => setRows((prev) => prev.filter((_, idx) => idx !== i))} />
                    ) : formLayout === 'cards' ? (
                      <FormCards
                        fields={currentForm.fields}
                        rows={rows}
                        setRows={setRows}
                        showMissing={showMissing}
                        onAddRow={rows.length < MAX_ROWS ? () => setRows((prev) => [...prev, newRow()]) : undefined}
                        onRemoveRow={(i) => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                      />
                    ) : (
                      <FormSpreadsheet
                        fields={currentForm.fields}
                        rows={rows}
                        setRows={setRows}
                        showMissing={showMissing}
                        onAddRow={rows.length < MAX_ROWS ? () => setRows((prev) => [...prev, newRow()]) : undefined}
                        onRemoveRow={(i) => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                      />
                    )}

                    <SignOff
                      analyst={user?.fullName || user?.username || ""}
                      date={labDate(todayISO())}
                      checks={checks}
                      attempted={showMissing}
                      signature={signatureImage}
                      onSignature={setSignatureImage}
                      entries={Math.max(filledCount, 1)}
                      submitting={submitState === "submitting"}
                      error={submitState === "error" ? message : ""}
                      onClearSheet={isDirty ? clearSheet : undefined}
                      onUndoClear={cleared ? undoClear : undefined}
                    />
                  </>
                )}
              </form>
              )}
            </>
          )}
        </div>
      </div>
      </div>
    </main>
  );
}

/* ── Spreadsheet-style form table ── */

function usesNativeArrows(el: HTMLElement) {
  return el.tagName === "SELECT" || el.tagName === "TEXTAREA" || (el as HTMLInputElement).type === "number";
}

function FormSpreadsheet({
  fields, rows, setRows, disabled, showMissing, onAddRow, onRemoveRow
}: {
  fields: FormField[];
  rows: Record<string, string>[];
  setRows: React.Dispatch<React.SetStateAction<Record<string, string>[]>>;
  disabled?: boolean;
  showMissing?: boolean;
  onAddRow?: () => void;
  onRemoveRow?: (index: number) => void;
}) {
  const isMissing = (f: FormField, row: Record<string, string>) =>
    Boolean(showMissing && f.required && !(row[f.key] || "").trim() && (row === rows[0] || !isBlankRow(row)));
  const tableRef = useRef<HTMLTableElement>(null);

  function updateCell(rowIndex: number, key: string, value: string) {
    if (disabled) return;
    setRows(prev => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], [key]: value };
      return next;
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLElement>, rowIndex: number, fieldIndex: number) {
    if (disabled) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Enter moves to the next row, same column (no row is added).
      if (rowIndex < rows.length - 1) {
        focusCell(rowIndex + 1, fieldIndex);
      }
    } else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && usesNativeArrows(e.currentTarget)) {
      // Dropdowns, text areas and number inputs need Up/Down themselves.
      return;
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (rowIndex < rows.length - 1) focusCell(rowIndex + 1, fieldIndex);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (rowIndex > 0) focusCell(rowIndex - 1, fieldIndex);
    } else if (e.key === "ArrowRight") {
      const input = e.currentTarget as HTMLInputElement;
      if (input.selectionEnd === input.value.length || input.type === "select-one" || input.type === "date" || input.type === "time") {
        if (fieldIndex < fields.length - 1) {
          e.preventDefault();
          focusCell(rowIndex, fieldIndex + 1);
        }
      }
    } else if (e.key === "ArrowLeft") {
      const input = e.currentTarget as HTMLInputElement;
      if (input.selectionStart === 0 || input.type === "select-one" || input.type === "date" || input.type === "time") {
        if (fieldIndex > 0) {
          e.preventDefault();
          focusCell(rowIndex, fieldIndex - 1);
        }
      }
    }
  }

  function focusCell(row: number, col: number) {
    if (disabled) return;
    const table = tableRef.current;
    if (!table) return;
    const cell = table.querySelectorAll('tbody tr')[row]?.querySelectorAll('td')[col + 1]; // +1 for row number
    const input = cell?.querySelector('input, select, textarea') as HTMLElement;
    input?.focus();
  }

  return (
    <div className={`spreadsheet-container ${disabled ? "spreadsheet-disabled" : ""}`}>
      <table className="doc-entry-table spreadsheet-table" ref={tableRef}>
        <thead className="spreadsheet-thead">
          <tr>
            <th className="doc-rowno-head">No.</th>
            {fields.map((f) => {
              const minWidth =
                f.type === "textarea" ? 300 :
                f.type === "date" || f.type === "time" ? 160 :
                f.type === "select" ? 190 : 190;
              return (
                <th key={f.key} style={{ minWidth }}>
                  {f.label}{f.required && <span className="req"> *</span>}
                </th>
              );
            })}
            {!disabled && rows.length > 1 && <th style={{ width: 44 }} aria-label="Remove row" />}
          </tr>
        </thead>
        <tbody className="spreadsheet-tbody">
          {rows.map((row, i) => (
            <tr key={i} className="spreadsheet-row">
              <td className="doc-rowno">{i + 1}</td>
              {fields.map((f, fi) => (
                <td key={f.key} className={`spreadsheet-cell ${isMissing(f, row) ? "cell-missing" : ""}`}>
                  {f.type === "textarea" ? (
                    <textarea
                      className="spreadsheet-input"
                      value={row[f.key] || ""}
                      onChange={(e) => updateCell(i, f.key, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, i, fi)}
                      rows={1}
                      placeholder={f.placeholder}
                      disabled={disabled}
                    />
                  ) : f.type === "select" ? (
                    <select
                      className="spreadsheet-input"
                      value={row[f.key] || ""}
                      onChange={(e) => updateCell(i, f.key, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, i, fi)}
                      disabled={disabled}
                    >
                      <option value="">—</option>
                      {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      className="spreadsheet-input"
                      type={f.type}
                      value={row[f.key] || ""}
                      onChange={(e) => updateCell(i, f.key, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, i, fi)}
                      placeholder={f.placeholder}
                      required={f.required}
                      disabled={disabled}
                    />
                  )}
                </td>
              ))}
              {!disabled && rows.length > 1 && (
                <td className="spreadsheet-cell wp-action-cell">
                  <button type="button" className="wp-remove" onClick={() => onRemoveRow?.(i)}
                    title={`Remove row ${i + 1}`} aria-label={`Remove row ${i + 1}`}>
                    <Trash2 size={15} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {!disabled && (
        <div className="spreadsheet-footer">
          {onAddRow && (
            <button type="button" className="btn btn-outline btn-sm" onClick={onAddRow}>
              <Plus size={16} /> Add row
            </button>
          )}
          <div className="spreadsheet-tip">
            <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> to navigate
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Card-style form layout ── */

function FormCards({
  fields, rows, setRows, disabled, showMissing, onAddRow, onRemoveRow
}: {
  fields: FormField[];
  rows: Record<string, string>[];
  setRows: React.Dispatch<React.SetStateAction<Record<string, string>[]>>;
  disabled?: boolean;
  showMissing?: boolean;
  onAddRow?: () => void;
  onRemoveRow?: (index: number) => void;
}) {
  const isMissing = (f: FormField, row: Record<string, string>) =>
    Boolean(showMissing && f.required && !(row[f.key] || "").trim() && (row === rows[0] || !isBlankRow(row)));
  function updateCell(rowIndex: number, key: string, value: string) {
    if (disabled) return;
    setRows(prev => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], [key]: value };
      return next;
    });
  }

  return (
    <div className="form-cards-container">
      {rows.map((row, i) => {
        const filled = fields.filter((f) => (row[f.key] || "").trim()).length;
        const requiredLeft = fields.filter((f) => f.required && !(row[f.key] || "").trim()).length;
        const pct = fields.length ? Math.round((filled / fields.length) * 100) : 0;
        return (
        <div key={i} className={`form-entry-card ${disabled ? "card-disabled" : ""}`}>
          <div className="form-entry-card-header">
            <div className="form-entry-card-title-group">
              <span className="form-entry-card-num">{rows.length > 1 ? `Entry ${i + 1} of ${rows.length}` : "Entry"}</span>
              <span className="entry-progress-text">{filled} of {fields.length} fields filled</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {requiredLeft === 0 ? (
                <span className="entry-chip entry-chip-ready"><CheckCircle2 size={14} /> Ready to submit</span>
              ) : (
                <span className="entry-chip">{requiredLeft} required field{requiredLeft > 1 ? "s" : ""} left</span>
              )}
              {!disabled && rows.length > 1 && (
                <button type="button" className="wp-remove" onClick={() => onRemoveRow?.(i)}
                  title={`Remove entry ${i + 1}`} aria-label={`Remove entry ${i + 1}`}>
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>
          <div className="entry-progress-track">
            <div className={`entry-progress-fill ${requiredLeft === 0 ? "done" : ""}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="form-entry-card-grid">
            {fields.map((f) => (
              <div key={f.key} className={`field-modern ${isMissing(f, row) ? "field-missing" : ""}`} style={{ gridColumn: (f.full || f.type === "textarea") ? '1 / -1' : undefined }}>
                <label className="field-label-modern">
                  {f.label}{f.required && <span className="req"> *</span>}
                </label>
                {f.type === "textarea" ? (
                  <textarea
                    value={row[f.key] || ""}
                    onChange={(e) => updateCell(i, f.key, e.target.value)}
                    rows={3}
                    placeholder={f.placeholder}
                    disabled={disabled}
                    className="form-input-modern form-textarea-modern"
                  />
                ) : f.type === "select" ? (
                  <select
                    value={row[f.key] || ""}
                    onChange={(e) => updateCell(i, f.key, e.target.value)}
                    disabled={disabled}
                    className="form-input-modern form-select-modern"
                  >
                    <option value="">— Select Option —</option>
                    {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    type={f.type}
                    value={row[f.key] || ""}
                    onChange={(e) => updateCell(i, f.key, e.target.value)}
                    placeholder={f.placeholder}
                    required={f.required}
                    disabled={disabled}
                    className="form-input-modern"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
        );
      })}
      {!disabled && onAddRow && (
        <button type="button" className="btn btn-outline btn-sm" style={{ justifySelf: "start" }} onClick={onAddRow}>
          <Plus size={16} /> Add entry
        </button>
      )}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value?: string }) {
  return (
    <div className="info-item">
      <span className="info-label">{label}:</span>
      <span className="info-value">{value || "—"}</span>
    </div>
  );
}

// Read-only "General" tab: the selected instrument's full information plus the
// responsible-analyst sign-off lines (matches the printed logbook cover sheet).
function GeneralInfoPanel({ instrument, formDef }: { instrument: InstrumentNode | null; formDef: FormDef | null }) {
  if (!instrument) return null;
  
  const customFields = Array.isArray(instrument.metadata?.customFields)
    ? instrument.metadata.customFields as { id: string, label: string, value: string }[]
    : [];

  const fields = formDef?.fields || [];
  
  const analystNs = Array.from(new Set(
    fields.filter(f => f.key.startsWith("respAnalyst"))
          .map(f => f.key.replace("respAnalyst", "").replace("Name", "").replace("Sig", ""))
  )).sort();

  const hasResp = analystNs.length > 0;
  const hasApproval = fields.some(f => ["preparedByName", "preparedBySig", "approvedByName", "approvedBySig"].includes(f.key));

  return (
    <div className="instrument-general-info shadow-inner">
      <h3 className="info-title">I. General Information</h3>
      <div className="info-grid">
        {fields.map((f) => {
          const isSig = f.key.startsWith("respAnalyst") || ["preparedByName", "preparedBySig", "approvedByName", "approvedBySig"].includes(f.key);
          if (isSig) return null;
          
          let raw: unknown;
          if (f.key === "instrumentName") raw = instrument.name;
          else if (f.key === "instrumentModel") raw = instrument.model;
          else {
            raw = INSTRUMENT_STANDARD_KEYS.has(f.key)
              ? (instrument as Record<string, unknown>)[f.key]
              : (instrument.metadata as Record<string, unknown>)?.[f.key];
          }
          const val = raw == null ? undefined : String(raw);
          return <InfoItem key={f.key} label={f.label} value={val} />;
        })}
        {customFields.map((f) => (
          <InfoItem key={f.id} label={f.label} value={f.value} />
        ))}
      </div>

      {hasResp && (
        <>
          <h3 className="info-title" style={{ marginTop: 24 }}>Responsible Analysts</h3>
          <div className="resp-analysts">
            {analystNs.map((n) => {
              const hasName = fields.some(f => f.key === `respAnalyst${n}Name`);
              const hasSig = fields.some(f => f.key === `respAnalyst${n}Sig`);
              if (!hasName && !hasSig) return null;
              
              const nameVal = (instrument.metadata as Record<string, string>)?.[`respAnalyst${n}Name`];
              const sigVal = (instrument.metadata as Record<string, string>)?.[`respAnalyst${n}Sig`];
              return (
                <div className="resp-analyst-row" key={n}>
                  <span className="resp-num">{n}.</span>
                  {hasName && (
                    <span className="resp-field">
                      <span className="resp-field-label">Name</span>
                      {nameVal ? <span className="resp-val">{nameVal}</span> : <span className="resp-line" />}
                    </span>
                  )}
                  {hasSig && (
                    <span className="resp-field">
                      <span className="resp-field-label">Signature</span>
                      {sigVal ? <span className="resp-val">{sigVal}</span> : <span className="resp-line" />}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {hasApproval && (
        <>
          <h3 className="info-title" style={{ marginTop: 24 }}>Approval</h3>
          <div className="resp-analysts" style={{ gridTemplateColumns: "1fr", maxWidth: 600 }}>
            {(fields.some(f => f.key === "preparedByName") || fields.some(f => f.key === "preparedBySig")) && (
              <div className="resp-analyst-row">
                {fields.some(f => f.key === "preparedByName") && (
                  <span className="resp-field">
                    <span className="resp-field-label">Prepared By</span>
                    {(instrument.metadata as Record<string, string>)?.preparedByName ? <span className="resp-val">{(instrument.metadata as Record<string, string>).preparedByName}</span> : <span className="resp-line" />}
                  </span>
                )}
                {fields.some(f => f.key === "preparedBySig") && (
                  <span className="resp-field">
                    <span className="resp-field-label">Signature</span>
                    {(instrument.metadata as Record<string, string>)?.preparedBySig ? <span className="resp-val">{(instrument.metadata as Record<string, string>).preparedBySig}</span> : <span className="resp-line" />}
                  </span>
                )}
              </div>
            )}
            {(fields.some(f => f.key === "approvedByName") || fields.some(f => f.key === "approvedBySig")) && (
              <div className="resp-analyst-row">
                {fields.some(f => f.key === "approvedByName") && (
                  <span className="resp-field">
                    <span className="resp-field-label">Approved By</span>
                    {(instrument.metadata as Record<string, string>)?.approvedByName ? <span className="resp-val">{(instrument.metadata as Record<string, string>).approvedByName}</span> : <span className="resp-line" />}
                  </span>
                )}
                {fields.some(f => f.key === "approvedBySig") && (
                  <span className="resp-field">
                    <span className="resp-field-label">Signature</span>
                    {(instrument.metadata as Record<string, string>)?.approvedBySig ? <span className="resp-val">{(instrument.metadata as Record<string, string>).approvedBySig}</span> : <span className="resp-line" />}
                  </span>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
