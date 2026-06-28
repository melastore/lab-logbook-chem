"use client";

import { FormEvent, useEffect, useMemo, useState, useRef, KeyboardEvent } from "react";
import Link from "next/link";
import {
  Activity, Settings, LayoutDashboard, LogOut, ArrowRight,
  CheckCircle2, AlertCircle, Microscope,
  ChevronRight, ChevronDown, Fingerprint, Zap, Droplets, Beaker,
  RefreshCw, FileOutput, Info, PanelLeftClose, PanelLeft, ScrollText
} from "lucide-react";
import { LabLogo } from "@/components/LabLogo";
import type { AppUser, InstrumentTemplate, InstrumentCategory } from "@/lib/logbook";
import {
  INSTRUMENT_TREE, ANALYTICAL_FORMS, SAMPLE_FORMS, INSTRUMENT_INFO_FORM, STANDARD_KEYS, INSTRUMENT_STANDARD_KEYS,
  type InstrumentNode, type FormDef, type FormField,
} from "@/lib/forms";
import { UserAvatar } from "@/components/UserAvatar";
import { UserLogsModal } from "@/components/UserLogsModal";
import { SignaturePad } from "@/components/SignaturePad";
import { ThemeToggle } from "@/components/ThemeToggle";
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

function todayISO() {
  return new Date().toISOString().slice(0, 10);
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
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
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
    }, 3000);
    return () => clearTimeout(timer);
  }, [submitState]);

  // "General" is a synthetic analytical tab that shows instrument info instead
  // of a data-entry form.
  const isGeneral = mode === "analytical" && analyticalFormId === GENERAL_TAB;
  const currentForm: FormDef = mode === "analytical"
    ? (analyticalForms.find((f) => f.id === analyticalFormId) ?? analyticalForms[0])
    : (sampleForms.find((f) => f.id === sampleFormId) ?? sampleForms[0]);

  const showForm = mode === "analytical" ? selectedInstrument !== null : true;
  const canAccessAdmin = user?.role === "admin" || user?.role === "supervisor";

  function resetTransient() {
    setSubmitState("idle");
    setMessage("");
  }

  function switchMode(next: Mode) {
    setMode(next);
    setNavOpen(false);
    resetTransient();
  }

  function toggleGroup(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function pickInstrument(node: InstrumentNode) {
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
    resetTransient();
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

  function pickTemplate(t: InstrumentTemplate) {
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
    resetTransient();
  }

  function pickSampleForm(id: string) {
    setSampleFormId(id);
    setNavOpen(false);
    resetTransient();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setUserMenuOpen(false);
  }

  const missingRequired = rows.some(row => 
    currentForm.fields.some((f) => f.required && !(row[f.key] || "").trim())
  );
  const canSubmit = Boolean(user) && showForm && !missingRequired && Boolean(signatureImage) && rows.length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !canSubmit) return;
    setSubmitState("submitting");
    setMessage("");

    const payloads = rows.map(row => {
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

    const response = await fetch("/api/logbook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloads),
    });

    if (!response.ok) {
      setSubmitState("error");
      setMessage(response.status === 401 ? "Sign in before submitting." : "Submission failed. Please try again.");
      return;
    }

    const result = await response.json();
    setSubmitState("sent");
    setMessage(`Successfully submitted ${result.count} ${result.count === 1 ? "record" : "records"} as ${user.fullName || user.username}. Log entries are sealed in a secure hash chain and cannot be modified or deleted.`);
    setRows([{ date: todayISO(), analyst: user.fullName || user.username }]);
    setSignatureImage("");
  }

  return (
    <main className="app-shell">
      {/* ── Left navigation ── */}
      <aside className={`lab-nav ${navOpen ? "open" : ""} ${collapsed ? "collapsed" : ""}`} aria-label="Primary navigation">
        <div className="lab-nav-brand">
          <LabLogo size={32} />
          <button className="nav-collapse-btn" type="button" onClick={() => setCollapsed(true)} title="Collapse menu" aria-label="Collapse menu">
            <PanelLeftClose size={18} />
          </button>
        </div>

        <nav className="lab-nav-tree">
          {mode === "analytical" ? (
            <>
              <p className="nav-section-label">Instruments</p>
              {templateGroups.length > 0 ? (
                templateGroups.map((group) => {
                  const open = expanded.has(group.name);
                  return (
                    <div key={group.name} className="nav-group">
                      <button type="button" className="nav-group-head" onClick={() => toggleGroup(group.name)}>
                        <span className="nav-group-icon">{categoryIcon(group.name)}</span>
                        <span className="nav-group-name">{group.name}</span>
                        <ChevronDown size={15} className={`nav-caret ${open ? "open" : ""}`} />
                      </button>
                      {open && (
                        <div className="nav-instruments">
                          {group.items.map((tpl) => (
                            <button
                              key={tpl.id}
                              type="button"
                              className={`nav-instrument ${selectedInstrument?.id === tpl.id ? "active" : ""}`}
                              onClick={() => pickTemplate(tpl)}
                            >
                              <ChevronRight size={13} />
                              <span>{tpl.instrumentName}</span>
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
        <header className="entry-topbar">
          <button className="nav-burger" type="button" onClick={() => setNavOpen(true)} aria-label="Open navigation">
            <span /><span /><span />
          </button>
          {collapsed && (
            <button className="nav-reopen" type="button" onClick={() => setCollapsed(false)} title="Open menu" aria-label="Open menu">
              <PanelLeft size={20} />
            </button>
          )}
          <div className="entry-topbar-title">
            <h1>Chemical Metrology Laboratory Logbook</h1>
          </div>
          <div className="entry-topbar-actions" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {user ? (
              <>
              <Link href="/weekly-plan" className="btn btn-outline btn-sm btn-icon-gap" title="Weekly Plan & Report">
                <ScrollText size={16} /> <span className="hidden-mobile">Weekly Plan</span>
              </Link>
              <button
                className="btn btn-outline btn-sm btn-icon-gap"
                type="button"
                onClick={() => setLogsOpen(true)}
                title="View my logbook entries"
              >
                <ScrollText size={16} /> <span>Logs</span>
              </button>
              <div className="user-dropdown-container">
                <button
                  className="user-chip shadow-sm"
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  aria-haspopup="true"
                  aria-expanded={userMenuOpen}
                >
                  <UserAvatar name={user.username} seed={user.avatarSeed} size="sm" clickable={false} />
                  <span className="user-chip-name">{user.username}</span>
                  <ChevronDown size={14} className={`dropdown-caret ${userMenuOpen ? 'open' : ''}`} />
                </button>
                
                {userMenuOpen && (
                  <>
                    <div className="user-menu-scrim" onClick={() => setUserMenuOpen(false)} />
                    <div className="user-menu shadow-lg">
                      <div className="user-menu-info">
                        <strong>{user.fullName}</strong>
                        <span>{user.email}</span>
                        <div className="user-role-badge">{user.role}</div>
                      </div>
                      <div className="user-menu-links">
                        <div className="user-menu-theme-row">
                          <span>Appearance</span>
                          <ThemeToggle variant="minimal" />
                        </div>
                        <Link href="/settings" onClick={() => setUserMenuOpen(false)}>
                          <Settings size={16} />
                          <span>Settings</span>
                        </Link>
                        {canAccessAdmin && (
                          <Link href="/admin" onClick={() => setUserMenuOpen(false)}>
                            <LayoutDashboard size={16} />
                            <span>Admin Panel</span>
                          </Link>
                        )}
                        <button type="button" onClick={logout}>
                          <LogOut size={16} />
                          <span>Sign out</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
              </>
            ) : null}
          </div>
        </header>

        {user && (
          <UserLogsModal
            name={user.username}
            open={logsOpen}
            onClose={() => setLogsOpen(false)}
            headerAvatar={<UserAvatar name={user.username} seed={user.avatarSeed} size="md" clickable={false} />}
          />
        )}

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
                <div className="form-tabs" style={{ justifyContent: "flex-start" }}>
                  <button
                    type="button"
                    className={`form-tab ${isGeneral ? "active" : ""}`}
                    onClick={() => { setAnalyticalFormId(GENERAL_TAB); resetTransient(); }}
                  >
                    General
                  </button>
                  {analyticalForms.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`form-tab ${!isGeneral && analyticalFormId === f.id ? "active" : ""}`}
                      onClick={() => { setAnalyticalFormId(f.id); resetTransient(); }}
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
              <form className="entry-form-panel panel shadow-sm" onSubmit={handleSubmit}>
                <div className="doc-form-header" style={{ padding: '16px 24px', justifyContent: 'flex-start', gap: 12 }}>
                  <h2 className="doc-form-title" style={{ margin: 0 }}>{currentForm.title}</h2>
                  {mode === "analytical" && selectedInstrument && (
                    <span className="doc-form-instrument">
                      {selectedInstrument.name}
                      {selectedInstrument.instrumentId ? ` · ${selectedInstrument.instrumentId}` : ""}
                    </span>
                  )}
                </div>

                 {authReady && !user ? (
                  <div className="auth-preview-overlay-container">
                    <div className="auth-preview-blurred">
                      {formLayout === 'cards' ? (
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
                      
                      <div className="signature-block-modern" style={{ padding: '0 24px', marginTop: 24 }}>
                        <label className="field-label">Signature <span className="req">*</span></label>
                        <SignaturePad value={signatureImage} onChange={setSignatureImage} disabled={true} />
                      </div>

                      <div className="submit-strip-modern shadow-sm" style={{ margin: '16px 24px 24px' }}>
                        <div className="submit-strip-status">
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <Info size={20} />
                            <strong style={{ fontSize: 16 }}>{currentForm.title}</strong>
                          </div>
                          <p style={{ marginLeft: 32 }}>Sign in to enable submission.</p>
                        </div>
                        <button className="btn btn-primary btn-lg btn-icon-gap" type="submit" disabled={true}>
                          <FileOutput size={18} /> <span>Submit</span>
                        </button>
                      </div>
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
                    {formLayout === 'cards' ? (
                      <FormCards
                        fields={currentForm.fields}
                        rows={rows}
                        setRows={setRows}
                      />
                    ) : (
                      <FormSpreadsheet
                        fields={currentForm.fields}
                        rows={rows}
                        setRows={setRows}
                      />
                    )}

                    <div className="signature-block-modern" style={{ padding: '0 24px' }}>
                      <label className="field-label">Signature <span className="req">*</span></label>
                      <SignaturePad value={signatureImage} onChange={setSignatureImage} />
                    </div>

                    <div className="submit-strip-modern shadow-sm" style={{ margin: '16px 24px 24px' }}>
                      <div className="submit-strip-status">
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {submitState === "sent" ? <CheckCircle2 size={22} color="var(--success)" /> :
                           submitState === "error" ? <AlertCircle size={22} color="var(--danger)" /> :
                           <Info size={20} />}
                          <strong style={{
                            fontSize: 16,
                            color: submitState === "sent" ? "var(--success)" : submitState === "error" ? "var(--danger)" : undefined,
                          }}>
                            {submitState === "sent" ? "Successfully submitted" : submitState === "error" ? "Submission error" : currentForm.title}
                          </strong>
                        </div>
                        <p style={{ marginLeft: 32 }}>
                          {message}
                        </p>
                      </div>
                      <button className="btn btn-primary btn-lg btn-icon-gap" type="submit" disabled={!canSubmit || submitState === "submitting"}>
                        {submitState === "submitting" ? <><RefreshCw size={18} className="spin" /> <span>Saving…</span></> :
                         submitState === "sent" ? <><CheckCircle2 size={18} /> <span>Saved</span></> :
                         <><FileOutput size={18} /> <span>Submit</span></>}
                      </button>
                    </div>
                  </>
                )}
              </form>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

/* ── Spreadsheet-style form table ── */

function FormSpreadsheet({
  fields, rows, setRows, disabled
}: {
  fields: FormField[];
  rows: Record<string, string>[];
  setRows: React.Dispatch<React.SetStateAction<Record<string, string>[]>>;
  disabled?: boolean;
}) {
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
          </tr>
        </thead>
        <tbody className="spreadsheet-tbody">
          {rows.map((row, i) => (
            <tr key={i} className="spreadsheet-row">
              <td className="doc-rowno">{i + 1}</td>
              {fields.map((f, fi) => (
                <td key={f.key} className="spreadsheet-cell">
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
            </tr>
          ))}
        </tbody>
      </table>
      {!disabled && (
        <div className="spreadsheet-footer">
          <div className="spreadsheet-tip">
            <kbd>←</kbd> <kbd>→</kbd> to navigate
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Card-style form layout ── */

function FormCards({
  fields, rows, setRows, disabled
}: {
  fields: FormField[];
  rows: Record<string, string>[];
  setRows: React.Dispatch<React.SetStateAction<Record<string, string>[]>>;
  disabled?: boolean;
}) {
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
      {rows.map((row, i) => (
        <div key={i} className={`form-entry-card settings-card ${disabled ? "card-disabled" : ""} shadow-sm`}>
          <div className="form-entry-card-header">
            <div className="form-entry-card-title-group">
              <span className="form-entry-card-num">Entry #{i + 1}</span>
              <h4 className="form-entry-card-title">Analytical Record</h4>
            </div>
            <span className="user-role-badge card-status-badge">Active Draft</span>
          </div>
          <div className="form-entry-card-grid">
            {fields.map((f) => (
              <div key={f.key} className="field-modern" style={{ gridColumn: (f.full || f.type === "textarea") ? '1 / -1' : undefined }}>
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
      ))}
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
