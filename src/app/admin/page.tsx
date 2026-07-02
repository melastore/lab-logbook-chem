"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, 
  AreaChart, Area 
} from "recharts";
import { 
  LayoutDashboard, FileText, Activity, Users, Download, RefreshCw,
  Filter, X, Search, ChevronDown, CheckCircle2, XCircle,
  Clock, Microscope, Settings, LogOut,
  ArrowLeft, FileOutput, Calendar, User, Hash, Info,
  Plus, Edit2, Trash2, ShieldAlert, Tag, Table as TableIcon, LayoutGrid,
  FileSpreadsheet, Archive, ArchiveRestore, KeyRound, UserCheck,
  ShieldCheck, AlertTriangle, Pencil, History, TrendingUp, ChevronRight
} from "lucide-react";
import type { AppUser, InstrumentCategory, InstrumentTemplate, LogbookRecord, ProfilePublic } from "@/lib/logbook";
import { LOG_TYPES } from "@/lib/logbook";
import { 
  ALL_FORMS, STANDARD_KEYS, INSTRUMENT_STANDARD_KEYS,
  type FormDef, type FormField, type FieldType, type FormScope 
} from "@/lib/forms";
import { UserAvatar } from "@/components/UserAvatar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LabLogo } from "@/components/LabLogo";
import { parseAnalystSignature, signatureSummary, type AnalystSignaturePayload } from "@/lib/signature";
import { taskWeight, taskAchWeight, type WeeklyPlan } from "@/lib/weekly-plan";

type Tab = "instruments" | "records" | "insights" | "users" | "forms" | "weekly";

function formatRunTime(start: string, end: string) {
  if (!start && !end) return "";
  if (!start || !end) return start || end;
  return `${start}-${end}`;
}

// Sample-preparation activity types (everything else is an analytical instrument log).
const SAMPLE_TYPES = new Set(["PREP", "REAG"]);
function isSampleRecord(rec: LogbookRecord) {
  return SAMPLE_TYPES.has(rec.activityType);
}

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [forms, setForms] = useState<FormDef[]>(ALL_FORMS);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => setUser(d.user))
      .catch(() => {})
      .finally(() => setAuthReady(true));

    fetch("/api/forms")
      .then((r) => r.ok ? r.json() : { forms: [] })
      .then((d) => { if (d.forms?.length) setForms(d.forms); })
      .catch(() => {});
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setAuthMessage("Signed out.");
  }

  const isAdmin = user?.role === "admin" || user?.role === "supervisor";

  // Analysts have no business on the admin/logs dashboard (it lists every
  // analyst's records). Their own logs are on the entry page's "Logs" button.
  // Bounce a signed-in non-admin back home; only admins/supervisors stay.
  useEffect(() => {
    if (authReady && user && !isAdmin) router.replace("/");
  }, [authReady, user, isAdmin, router]);

  const visibleTabs = useMemo<Tab[]>(() => (
    isAdmin ? ["instruments", "records", "weekly", "insights", "users", "forms"] : []
  ), [isAdmin]);
  const activeTab = tab && visibleTabs.includes(tab) ? tab : visibleTabs[0];

  return (
    <main className="app-shell">
      <aside className="app-rail" aria-label="Primary navigation">
        <div className="rail-brand">
            <LabLogo size={32} />
          <span>Lab Admin</span>
        </div>
        <nav className="rail-nav">
          <Link className="rail-link" href="/">
            <Activity size={22} />
            <span>Entry</span>
          </Link>
          {isAdmin && (
            <Link className="rail-link active" href="/admin">
              <LayoutDashboard size={22} />
              <span>Admin</span>
            </Link>
          )}
          {user && (
            <Link className="rail-link" href="/settings">
              <Settings size={22} />
              <span>Settings</span>
            </Link>
          )}
          <ThemeToggle variant="rail" />
          {user && (
            <Link className="rail-avatar" href="/settings" title={user.fullName}>
              <UserAvatar name={user.username} seed={user.avatarSeed} size="sm" />
              <span>{user.username}</span>
            </Link>
          )}
        </nav>
        <div className="rail-foot">
          <span className="rail-caption">Supervisor tools</span>
        </div>
      </aside>

      <div className="app-frame">
      <header className="topbar">
        <div className="brand-heading">
          <LabLogo size={40} />
          <div className="brand-text">
            <p className="eyebrow">Supervisor Dashboard</p>
            <h1>Instrument Logbook Management</h1>
          </div>
        </div>
        <div className="topbar-actions">
          {user ? (
            <>
              <span className="user-chip shadow-sm">
                <UserAvatar name={user.username} seed={user.avatarSeed} size="sm" />
                <span className="user-chip-name">{user.username}</span>
                <span className="user-role-badge">{user.role}</span>
              </span>
              <div className="topbar-nav-btns">
                <ThemeToggle variant="chip" />
                {user.role === "admin" && (
                  <a className="btn btn-outline btn-sm" href="/api/admin/backup" download>
                    <Download size={14} /> Backup
                  </a>
                )}
                <Link className="btn btn-outline btn-sm" href="/settings">
                  <Settings size={14} />
                </Link>
                <button className="btn btn-outline btn-sm" type="button" onClick={logout}>
                  <LogOut size={14} />
                </button>
                <Link className="btn btn-primary btn-sm" href="/">
                  <ArrowLeft size={14} /> Entry
                </Link>
              </div>
            </>
          ) : (
            <div className="topbar-nav-btns">
              <ThemeToggle variant="chip" />
            </div>
          )}
        </div>
      </header>

      {authMessage && <div className="notice notice-info">{authMessage}</div>}
      
      {authReady && user && !isAdmin && (
        <div className="notice notice-info">Redirecting to the entry page…</div>
      )}

      {authReady && !user && (
        <div className="notice notice-warning shadow-sm" style={{ borderLeft: '4px solid var(--warning)', borderRadius: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ShieldAlert size={24} className="tone-amber" />
              <span>Sign in with a supervisor or admin account to access restricted management tools.</span>
            </div>
            <span style={{ display: "flex", gap: 10 }}>
              <Link className="btn btn-primary btn-sm" href="/login?redirect=/admin">Sign in →</Link>
              <Link className="btn btn-outline btn-sm" href="/setup">Run setup →</Link>
            </span>
          </div>
        </div>
      )}

      <div className="admin-tab-container">
        <div className="admin-tabs-modern">
          {visibleTabs.map((t) => (
            <button key={t} className={`admin-tab-btn ${activeTab === t ? "active" : ""}`} type="button" onClick={() => setTab(t)}>
              {t === "instruments" && <Microscope size={16} />}
              {t === "records" && <FileText size={16} />}
              {t === "weekly" && <Calendar size={16} />}
              {t === "insights" && <LayoutDashboard size={16} />}
              {t === "users" && <Users size={16} />}
              {t === "forms" && <FileSpreadsheet size={16} />}
              <span>
                {t === "instruments" ? "Instruments" : t === "records" ? "Log Records" : t === "weekly" ? "Weekly Reports" : t === "insights" ? "Report" : t === "users" ? "Users" : "Forms"}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="admin-content-area">
        {activeTab === "insights"    && <InsightsTab />}
        {activeTab === "records"     && <RecordsTab user={user} isAdmin={isAdmin} forms={forms} />}
        {isAdmin && activeTab === "weekly"      && <WeeklyReportsTab />}
        {isAdmin && activeTab === "instruments" && <InstrumentsTab user={user} isAdmin={isAdmin} forms={forms} />}
        {isAdmin && activeTab === "users"       && <UsersTab user={user} isAdmin={isAdmin} />}
        {isAdmin && activeTab === "forms"       && <FormsTab forms={forms} setForms={setForms} />}
      </div>
      </div>
    </main>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Tab 0 — Insights
   ════════════════════════════════════════════════════════════════════════════ */

function InsightsTab() {
  const [records, setRecords] = useState<LogbookRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/logbook")
      .then(r => r.json())
      .then(d => {
        setRecords(d.records || []);
        setLoading(false);
      });
  }, []);

  const stats = useMemo(() => {
    if (records.length === 0) return null;

    // Record scope distribution
    const scopeData = [
      { name: "Instrument", value: records.filter(r => !isSampleRecord(r)).length, color: "var(--primary)" },
      { name: "Sample Prep", value: records.filter(r => isSampleRecord(r)).length, color: "var(--warning)" },
    ].filter(s => s.value > 0);

    // Activity Type Distribution
    const activityTypeMap: Record<string, number> = {};
    records.forEach(r => {
      const label = LOG_TYPES.find(t => t.id === r.activityType)?.label || r.activityType;
      activityTypeMap[label] = (activityTypeMap[label] || 0) + 1;
    });
    const activityTypeData = Object.entries(activityTypeMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Instrument Usage
    const instMap: Record<string, number> = {};
    records.forEach(r => {
      instMap[r.instrumentName] = (instMap[r.instrumentName] || 0) + 1;
    });
    const instrumentData = Object.entries(instMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // Daily Activity (last 14 days)
    const dateMap: Record<string, number> = {};
    const last14Days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().slice(0, 10);
    }).reverse();

    records.forEach(r => {
      const d = r.date || r.createdAt.slice(0, 10);
      if (last14Days.includes(d)) {
        dateMap[d] = (dateMap[d] || 0) + 1;
      }
    });
    const activityTrendData = last14Days.map(date => ({
      date: new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      count: dateMap[date] || 0
    }));

    return { scopeData, activityTypeData, instrumentData, activityTrendData };
  }, [records]);

  if (loading) return (
    <div className="insights-skeleton-grid">
      <div className="skeleton chart-card-skeleton" />
      <div className="skeleton chart-card-skeleton" />
      <div className="skeleton chart-card-skeleton" />
      <div className="skeleton chart-card-skeleton" />
    </div>
  );

  if (!stats) return <div className="empty-state-modern"><LayoutDashboard size={40} /><p>No data available for analytics yet.</p></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="metrics-row">
        <div className="metric-card shadow-sm">
          <span className="metric-label">Total Records</span>
          <span className="metric-value">{records.length}</span>
        </div>
        <div className="metric-card shadow-sm">
          <span className="metric-label">Avg. Logs / Day</span>
          <span className="metric-value" style={{ color: 'var(--secondary)' }}>
            {(records.length / 14).toFixed(1)}
          </span>
        </div>
        <div className="metric-card shadow-sm">
          <span className="metric-label">Active Instruments</span>
          <span className="metric-value" style={{ color: 'var(--tertiary)' }}>
            {new Set(records.map(r => r.instrumentName)).size}
          </span>
        </div>
        <div className="metric-card shadow-sm">
          <span className="metric-label">Top Instrument</span>
          <span className="metric-value" style={{ fontSize: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {stats.instrumentData[0]?.name || "N/A"}
          </span>
        </div>
      </div>

      <div className="insights-grid">
      <div className="chart-card">
        <div className="chart-header">
          <h3>Record Distribution</h3>
          <p>Analytical vs Sample Preparation</p>
        </div>
        <div className="chart-container-inner">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={stats.scopeData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {stats.scopeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-header">
          <h3>Activity Trend</h3>
          <p>Daily submissions (last 14 days)</p>
        </div>
        <div className="chart-container-inner">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={stats.activityTrendData}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="var(--primary)" fillOpacity={1} fill="url(#colorCount)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-header">
          <h3>Log Types</h3>
          <p>Volume by activity category</p>
        </div>
        <div className="chart-container-inner">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats.activityTypeData} layout="vertical">
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" fontSize={11} width={100} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="value" fill="var(--tertiary)" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-header">
          <h3>Top Instruments</h3>
          <p>Most used equipment</p>
        </div>
        <div className="chart-container-inner">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats.instrumentData}>
              <XAxis dataKey="name" fontSize={10} interval={0} tick={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="value" fill="var(--secondary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Tab 1 — Records
   ════════════════════════════════════════════════════════════════════════════ */

function RecordsTab({ user, isAdmin, forms }: { user: AppUser | null; isAdmin: boolean; forms: FormDef[] }) {
  void user;
  const [records, setRecords] = useState<LogbookRecord[]>([]);
  const [query, setQuery] = useState("");
  const [analystFilter, setAnalystFilter] = useState("All");
  const [instrumentFilter, setInstrumentFilter] = useState("All");
  const [activityFilter, setActivityFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [toggledIds, setToggledIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [scope, setScope] = useState<"All" | "Instrument" | "Sample">("Instrument");
  const [amendTarget, setAmendTarget] = useState<LogbookRecord | null>(null);
  const [integrity, setIntegrity] = useState<{ state: "idle" | "checking" | "ok" | "bad" | "error"; checked?: number; firstBad?: string | null }>({ state: "idle" });

  // ids of records that have been superseded by a later amendment
  const latestActiveIds = useMemo(() => {
    const latestActiveIds = new Set<string>();
    const byRoot = new Map<string, LogbookRecord>();
    for (const rec of records) {
      const rootId = rec.amends || rec.id;
      const existing = byRoot.get(rootId);
      if (!existing || new Date(rec.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
        byRoot.set(rootId, rec);
      }
    }
    for (const rec of byRoot.values()) latestActiveIds.add(rec.id);
    return latestActiveIds;
  }, [records]);

  async function verifyIntegrity() {
    setIntegrity({ state: "checking" });
    try {
      const r = await fetch("/api/logbook/verify");
      const d = await r.json();
      if (!r.ok) { setIntegrity({ state: "error" }); return; }
      setIntegrity({ state: d.ok ? "ok" : "bad", checked: d.checked, firstBad: d.firstBad });
    } catch {
      setIntegrity({ state: "error" });
    }
  }

  function isExpanded(rec: LogbookRecord): boolean {
    return toggledIds.has(rec.id);
  }

  function toggleCard(id: string) {
    setToggledIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  useEffect(() => { loadRecords(); }, []);

  async function loadRecords() {
    setLoading(true);
    const res = await fetch("/api/logbook", { cache: "no-store" });
    if (res.ok) { const d = await res.json(); setRecords(d.records); }
    setLoading(false);
  }

  async function submitAmendment(values: Record<string, string>, reason: string) {
    if (!amendTarget) return;
    const original = amendTarget;
    const metadata = { ...original.metadata };
    const std: Record<string, string> = {};
    for (const [key, val] of Object.entries(values)) {
      if (STANDARD_KEYS.has(key)) std[key] = val;
      else metadata[key] = val;
    }
    const payload = {
      laboratoryName: original.laboratoryName,
      department: original.department,
      location: original.location,
      instrumentName: original.instrumentName,
      instrumentModel: original.instrumentModel,
      serialNumber: original.serialNumber,
      manufacturer: original.manufacturer,
      installationDate: original.installationDate,
      instrumentId: original.instrumentId,
      date: std.date ?? original.date,
      analyst: std.analyst ?? original.analyst,
      activityType: original.activityType,
      methodUsed: std.methodUsed ?? original.methodUsed,
      sampleId: std.sampleId ?? original.sampleId,
      measuredValue: std.measuredValue ?? original.measuredValue,
      startTime: std.startTime ?? original.startTime,
      endTime: std.endTime ?? original.endTime,
      remarks: std.remarks ?? original.remarks,
      metadata,
      analystSignature: original.analystSignature,
      amends: original.amends || original.id,
      amendmentReason: reason,
    };
    const r = await fetch("/api/logbook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.error || "Amendment failed.");
    }
    setAmendTarget(null);
    await loadRecords();
  }

  const analysts = useMemo(() => {
    return Array.from(new Set(records.map((rec) => rec.analyst).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [records]);

  const instruments = useMemo(() => {
    return Array.from(new Set(records.map((rec) => rec.instrumentName).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [records]);

  const logTypes = useMemo(() => {
    return Array.from(new Set(records.map((rec) => rec.activityType).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [records]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return records.filter((rec) => {
      const recordDate = rec.date || rec.createdAt.slice(0, 10);
      const matchScope = scope === "All"
        || (scope === "Sample" ? isSampleRecord(rec) : !isSampleRecord(rec));
      const matchAnalyst = analystFilter === "All" || rec.analyst === analystFilter;
      const matchInstrument = instrumentFilter === "All" || rec.instrumentName === instrumentFilter;
      const matchActivity = activityFilter === "All" || rec.activityType === activityFilter;
      const matchDateFrom = !dateFrom || recordDate >= dateFrom;
      const matchDateTo = !dateTo || recordDate <= dateTo;
      const matchSearch = !search || [
        rec.instrumentName,
        rec.instrumentId,
        rec.analyst,
        rec.sampleId,
        rec.methodUsed,
        rec.activityType,
        LOG_TYPES.find(t => t.id === rec.activityType)?.label || "",
        rec.date,
        rec.createdAt,
        rec.department,
        rec.location,
      ]
        .join(" ").toLowerCase().includes(search);
      return matchScope && matchAnalyst && matchInstrument && matchActivity && matchDateFrom && matchDateTo && matchSearch;
    });
  }, [records, scope, query, analystFilter, instrumentFilter, activityFilter, dateFrom, dateTo]);

  const instrumentCount = records.filter((r) => !isSampleRecord(r)).length;
  const sampleCount = records.filter((r) => isSampleRecord(r)).length;

  // A compact, filesystem-safe tag describing the active filters so each export
  // is self-describing (e.g. logbook-records-Instrument-Jane-2024-01-01_to_…).
  function filterSlug() {
    const parts: string[] = [];
    if (scope !== "All") parts.push(scope);
    if (analystFilter !== "All") parts.push(analystFilter);
    if (instrumentFilter !== "All") parts.push(instrumentFilter);
    if (activityFilter !== "All") parts.push(LOG_TYPES.find((t) => t.id === activityFilter)?.label || activityFilter);
    if (dateFrom || dateTo) parts.push(`${dateFrom || "start"}_to_${dateTo || "end"}`);
    if (query) parts.push(`q-${query}`);
    const slug = parts.join("-").replace(/[^a-z0-9_-]+/gi, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
    return slug ? `-${slug}` : "";
  }

  function exportFileName(ext: string) {
    return `logbook-records${filterSlug()}-${new Date().toISOString().slice(0, 10)}.${ext}`;
  }

  function exportCsv() {
    if (filtered.length === 0) return;
    const columns = [
      "No.", "Date", "Analyst", "Instrument", "Instrument ID", "Log Type", "Sample/QC",
      "Measured Value", "Method", "Start", "End", "Details", "Submitted",
    ];
    const rows = filtered.map((r, i) => {
      const details = Object.entries(r.metadata || {}).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("; ");
      return [
        i + 1, r.date, r.analyst, r.instrumentName, r.instrumentId,
        LOG_TYPES.find(t => t.id === r.activityType)?.label || r.activityType,
        r.sampleId, r.measuredValue, r.methodUsed, r.startTime, r.endTime,
        details, new Date(r.createdAt).toLocaleString(),
      ];
    });
    const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [columns, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = exportFileName("csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  // One worksheet per log type, with that type's own columns (matches the
  // grouped on-screen tables). xlsx is loaded lazily to keep it out of the
  // initial bundle.
  async function exportXlsx() {
    if (filtered.length === 0) return;
    const XLSX = await import("xlsx");
    const groups = new Map<string, LogbookRecord[]>();
    for (const rec of filtered) {
      const arr = groups.get(rec.activityType);
      if (arr) arr.push(rec);
      else groups.set(rec.activityType, [rec]);
    }
    const knownOrder = forms.map((f) => f.activityType);
    const orderedTypes = [...groups.keys()].sort((a, b) => {
      const ia = knownOrder.indexOf(a);
      const ib = knownOrder.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

    const wb = XLSX.utils.book_new();
    const usedNames = new Set<string>();
    for (const type of orderedTypes) {
      const form = forms.find((f) => f.activityType === type);
      const title = form?.title || LOG_TYPES.find((t) => t.id === type)?.label || type;
      const fields = (form?.fields || []).filter((f) => f.key !== "instrumentUsed");
      const header = ["No.", "Instrument", "ID", ...fields.map((f) => f.label), "Signed By", "Submitted"];
      const recs = groups.get(type)!;
      const aoa: (string | number)[][] = [
        header,
        ...recs.map((r, i) => [
          i + 1,
          r.instrumentName,
          r.instrumentId,
          ...fields.map((f) => fieldValue(r, f)),
          signatureSummary(r.analystSignature),
          new Date(r.createdAt).toLocaleString(),
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      // Auto-size every column to its widest cell (clamped) and add a header
      // autofilter so each sheet is filterable out of the box.
      ws["!cols"] = header.map((_, c) => {
        const widest = aoa.reduce((m, row) => Math.max(m, String(row[c] ?? "").length), 0);
        return { wch: Math.min(Math.max(widest + 2, 10), 45) };
      });
      ws["!autofilter"] = {
        ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: aoa.length - 1, c: header.length - 1 } }),
      };
      // Excel sheet names: max 31 chars, no \ / ? * [ ] :, must be unique.
      let name = (title.replace(/[\\/?*[\]:]/g, "").slice(0, 31) || type).trim();
      while (usedNames.has(name.toLowerCase())) name = name.slice(0, 28) + "_" + (usedNames.size + 1);
      usedNames.add(name.toLowerCase());
      XLSX.utils.book_append_sheet(wb, ws, name);
    }
    XLSX.writeFile(wb, exportFileName("xlsx"));
  }

  return (
    <>
      <div className="scope-switch">
        <button type="button" className={`scope-switch-btn ${scope === "Instrument" ? "active" : ""}`} onClick={() => setScope("Instrument")}>
          <Microscope size={16} /> <span>Instrument</span> <span className="scope-count">{instrumentCount}</span>
        </button>
        <button type="button" className={`scope-switch-btn ${scope === "Sample" ? "active" : ""}`} onClick={() => setScope("Sample")}>
          <Activity size={16} /> <span>Sample Preparation</span> <span className="scope-count">{sampleCount}</span>
        </button>
        <button type="button" className={`scope-switch-btn ${scope === "All" ? "active" : ""}`} onClick={() => setScope("All")}>
          <FileText size={16} /> <span>All</span> <span className="scope-count">{records.length}</span>
        </button>
      </div>

      <div className="toolbar-modern">
        <div className="toolbar-top-row">
          <div className="search-box-modern">
            <Search size={18} className="search-icon" />
            <input
              placeholder="Search by analyst, instrument, sample ID, method, log type..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && <button className="clear-search" onClick={() => setQuery("")} aria-label="Clear search"><X size={14} /></button>}
          </div>
          <div className="toolbar-actions-modern">
            <div className="btn-group shadow-sm">
              <button className={`view-toggle-btn ${viewMode === "table" ? "active" : ""}`} onClick={() => setViewMode("table")} title="Table view">
                <TableIcon size={16} />
              </button>
              <button className={`view-toggle-btn ${viewMode === "cards" ? "active" : ""}`} onClick={() => setViewMode("cards")} title="Card view">
                <LayoutGrid size={16} />
              </button>
            </div>
            
            <div className="toolbar-separator" />
            
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-outline btn-sm btn-icon-gap" onClick={exportCsv} disabled={filtered.length === 0} title="Export to CSV">
                <FileOutput size={16} /> <span>CSV</span>
              </button>
              <button className="btn btn-outline btn-sm btn-icon-gap" onClick={exportXlsx} disabled={filtered.length === 0} title="Export to Excel">
                <FileSpreadsheet size={16} /> <span>Excel</span>
              </button>
            </div>

            <button className="btn btn-ghost btn-sm btn-icon-only" onClick={loadRecords} title="Refresh records">
              <RefreshCw size={16} className={loading ? "spin" : ""} />
            </button>
          </div>
        </div>

        <div className="filter-shelf shadow-sm">
          <div className="filter-shelf-header">
            <div className="filter-shelf-label"><Filter size={14} /> <span>Advanced Filtering</span></div>
            {(query || analystFilter !== "All" || instrumentFilter !== "All" || activityFilter !== "All" || dateFrom || dateTo) && (
              <button className="btn-text-only btn-sm" onClick={() => { setQuery(""); setAnalystFilter("All"); setInstrumentFilter("All"); setActivityFilter("All"); setDateFrom(""); setDateTo(""); }}>
                Reset Filters
              </button>
            )}
          </div>
          <div className="filter-shelf-grid">
            <div className="filter-item">
              <label>Analyst</label>
              <select value={analystFilter} onChange={(e) => setAnalystFilter(e.target.value)}>
                <option value="All">All Analysts</option>
                {analysts.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="filter-item">
              <label>Instrument</label>
              <select value={instrumentFilter} onChange={(e) => setInstrumentFilter(e.target.value)}>
                <option value="All">All Instruments</option>
                {instruments.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div className="filter-item">
              <label>Log Type</label>
              <select value={activityFilter} onChange={(e) => setActivityFilter(e.target.value)}>
                <option value="All">All Log Types</option>
                {logTypes.map((t) => (
                  <option key={t} value={t}>{LOG_TYPES.find(lt => lt.id === t)?.label || t}</option>
                ))}
              </select>
            </div>
            <div className="filter-item">
              <label>Date Range</label>
              <div className="filter-date-range">
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} placeholder="From" />
                <span className="filter-date-sep">to</span>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} placeholder="To" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="results-count-strip">
        <span className="count-label">Showing <strong>{filtered.length}</strong> of {records.length} records</span>
        <span className="integrity-strip">
          <button className="btn btn-outline btn-sm btn-icon-gap" type="button" onClick={verifyIntegrity} disabled={integrity.state === "checking"} title="Recompute the tamper-evidence hash chain">
            <ShieldCheck size={15} /> <span>{integrity.state === "checking" ? "Verifying…" : "Verify integrity"}</span>
          </button>
          {integrity.state === "ok" && <span className="integrity-badge ok"><CheckCircle2 size={14} /> Intact · {integrity.checked} records sealed</span>}
          {integrity.state === "bad" && <span className="integrity-badge bad"><AlertTriangle size={14} /> Tampering detected near {integrity.firstBad?.slice(0, 8)}</span>}
          {integrity.state === "error" && <span className="integrity-badge bad"><AlertTriangle size={14} /> Check failed</span>}
        </span>
      </div>

      {viewMode === "table" ? (
        <RecordsTable records={filtered} loading={loading} forms={forms} onAmend={isAdmin ? setAmendTarget : undefined} latestActiveIds={latestActiveIds} />
      ) : (
      <div className="records-panel-modern">
        {loading && [1, 2, 3].map((i) => <div key={i} className="skeleton record-skeleton" style={{ height: 80, borderRadius: 12 }} />)}
        {!loading && filtered.length === 0 && (
          <div className="empty-state-modern">
            <div className="empty-icon-wrap"><Search size={40} /></div>
            <h3>No records found</h3>
            <p>Adjust your filters or search terms to find what you&apos;re looking for.</p>
            <button className="btn btn-outline btn-sm" onClick={() => { setQuery(""); setAnalystFilter("All"); setScope("All"); }}>Clear search</button>
          </div>
        )}
        {filtered.map((rec) => {
          const signature = parseAnalystSignature(rec.analystSignature);
          const runTime = formatRunTime(rec.startTime, rec.endTime);
          const expanded = isExpanded(rec);
          const logTypeLabel = LOG_TYPES.find(t => t.id === rec.activityType)?.label || rec.activityType;

          return (
          <article className={`record-card-modern ${expanded ? "expanded" : ""}`} key={rec.id}>
            <div className="record-card-main" onClick={() => toggleCard(rec.id)}>
              <div className="record-accent" />
              <div className="record-header-left">
                <div className="record-instrument-icon">
                  <Microscope size={18} />
                </div>
                <div className="record-title-group">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0 }}>{rec.instrumentName || "Unnamed instrument"}</h3>
                    <span className={`log-type-tag log-type-${rec.activityType.toLowerCase()}`}>
                      <Tag size={10} /> {logTypeLabel}
                    </span>
                    {rec.amends && <span className="record-flag correction" title={rec.amendmentReason}><Pencil size={10} /> Correction</span>}
                    {!latestActiveIds.has(rec.id) && <span className="record-flag superseded"><History size={10} /> Correction</span>}
                  </div>
                  <div className="record-meta-modern">
                    <span title="Analyst"><User size={12} /> {rec.analyst}</span>
                    <span title="Date"><Calendar size={12} /> {rec.date}</span>
                    <span title="Sample ID"><Hash size={12} /> {rec.sampleId || "N/A"}</span>
                    {runTime && <span title="Run Time"><Clock size={12} /> {runTime}</span>}
                  </div>
                </div>
              </div>
              <div className="record-header-right">
                {isAdmin && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm btn-icon-only"
                    onClick={(e) => { e.stopPropagation(); setAmendTarget(rec); }}
                    title="Amend (issue a correction)"
                  >
                    <Pencil size={14} />
                  </button>
                )}
                <div className={`expand-icon ${expanded ? "rotated" : ""}`}>
                  <ChevronDown size={20} />
                </div>
              </div>
            </div>

            {expanded && (
              <div className="record-expanded-content">
                <div className="record-grid-modern">
                  <div className="grid-section">
                    <h4 className="section-title-mini">Session Details</h4>
                    <div className="data-row">
                      <RecordSummaryItem label="Log Type"  value={logTypeLabel} />
                      <RecordSummaryItem label="Run Time"  value={runTime} />
                    </div>
                    <div className="data-row">
                      <RecordSummaryItem label="Measured"  value={rec.measuredValue} />
                      <RecordSummaryItem label="Method"    value={rec.methodUsed} />
                    </div>
                  </div>
                  
                  <div className="grid-section">
                    <h4 className="section-title-mini">Instrument Info</h4>
                    <div className="data-row">
                      <RecordSummaryItem label="ID"    value={rec.instrumentId} />
                      <RecordSummaryItem label="Model" value={rec.instrumentModel} />
                    </div>
                  </div>
                </div>

                <div className="record-full-meta-shelf">
                  <details className="modern-details">
                    <summary>View Technical Specification & Location</summary>
                    <div className="details-grid-compact">
                      <RecordDetail label="Serial No."    value={rec.serialNumber} />
                      <RecordDetail label="Manufacturer"  value={rec.manufacturer} />
                      <RecordDetail label="Laboratory"    value={rec.laboratoryName} />
                      <RecordDetail label="Department"    value={rec.department} />
                      <RecordDetail label="Location"      value={rec.location} />
                      {Object.entries(rec.metadata || {}).map(([key, val]) => (
                        <RecordDetail key={key} label={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} value={String(val)} />
                      ))}
                    </div>
                  </details>
                </div>

                <div className="record-verification-shelf">
                  <div className="verification-item">
                    <span className="v-label">Analyst Signature</span>
                    <div className="v-content">
                      <SignatureReview signature={signature} />
                      <span className="v-subtext">{signatureSummary(rec.analystSignature)}</span>
                    </div>
                  </div>
                  <div className="verification-item">
                    <span className="v-label">Submission Info</span>
                    <div className="v-content">
                      <span className="v-maintext">{new Date(rec.createdAt).toLocaleString()}</span>
                      <span className="v-subtext">Captured digitally via secure entry</span>
                    </div>
                  </div>
                </div>

                {rec.remarks && (
                  <div className="remarks-shelf-modern">
                    <div className="remarks-icon"><Info size={16} /></div>
                    <div className="remarks-content">
                      <p className="remarks-label-modern">Analyst Remarks</p>
                      <p className="remarks-text-modern">{rec.remarks}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </article>
          );
        })}
      </div>
      )}

      {amendTarget && (
        <AmendModal
          record={amendTarget}
          form={forms.find((f) => f.activityType === amendTarget.activityType)}
          onCancel={() => setAmendTarget(null)}
          onSubmit={submitAmendment}
        />
      )}
    </>
  );
}

// standard keys live on first-class columns; everything else is in metadata
const STANDARD_FIELD_GETTERS: Record<string, (r: LogbookRecord) => string> = {
  date: (r) => r.date,
  analyst: (r) => r.analyst,
  sampleId: (r) => r.sampleId,
  measuredValue: (r) => r.measuredValue,
  methodUsed: (r) => r.methodUsed,
  startTime: (r) => r.startTime,
  endTime: (r) => r.endTime,
  remarks: (r) => r.remarks,
};

function fieldValue(rec: LogbookRecord, field: FormField): string {
  if (STANDARD_KEYS.has(field.key)) {
    const get = STANDARD_FIELD_GETTERS[field.key];
    return get ? get(rec) : "";
  }
  const v = rec.metadata?.[field.key];
  return v == null ? "" : String(v);
}

function colMinWidth(field: FormField): number {
  if (field.type === "textarea") return 220;
  if (field.type === "date") return 110;
  if (field.type === "time") return 90;
  return 130;
}

function RecordsTable({ records, loading, forms, onAmend, latestActiveIds }: {
  records: LogbookRecord[];
  loading: boolean;
  forms: FormDef[];
  onAmend?: (rec: LogbookRecord) => void;
  latestActiveIds: Set<string>;
}) {
  const [selectedType, setSelectedType] = useState<string | null>(null);

  if (loading) return <div className="skeleton" style={{ height: 320, borderRadius: 12 }} />;
  if (records.length === 0) {
    return (
      <div className="empty-state-modern">
        <div className="empty-icon-wrap"><Search size={40} /></div>
        <h3>No records found</h3>
        <p>Adjust your filters or search terms.</p>
      </div>
    );
  }

  // Group by log type, ordered to match the form definitions (so Daily
  // Operation comes first); any unknown activity types are appended at the end.
  const groups = new Map<string, LogbookRecord[]>();
  for (const rec of records) {
    const arr = groups.get(rec.activityType);
    if (arr) arr.push(rec);
    else groups.set(rec.activityType, [rec]);
  }
  const knownOrder = forms.map((f) => f.activityType);
  const orderedTypes = [...groups.keys()].sort((a, b) => {
    const ia = knownOrder.indexOf(a);
    const ib = knownOrder.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  // Default to the first available type (Daily Operation when present).
  const activeType = selectedType && orderedTypes.includes(selectedType) ? selectedType : orderedTypes[0];

  return (
    <div>
      <div className="scope-switch" role="tablist">
        {orderedTypes.map((type) => {
          const label = forms.find((f) => f.activityType === type)?.title
            || LOG_TYPES.find((t) => t.id === type)?.label
            || type;
          return (
            <button
              key={type}
              type="button"
              role="tab"
              aria-selected={activeType === type}
              className={`scope-switch-btn ${activeType === type ? "active" : ""}`}
              onClick={() => setSelectedType(type)}
            >
              <Tag size={14} /> <span>{label}</span>
              <span className="scope-count">{groups.get(type)!.length}</span>
            </button>
          );
        })}
      </div>
      {activeType && <LogTypeTable activityType={activeType} records={groups.get(activeType)!} form={forms.find((f) => f.activityType === activeType)} onAmend={onAmend} latestActiveIds={latestActiveIds} />}
    </div>
  );
}

function LogTypeTable({ activityType, records, form, onAmend, latestActiveIds }: {
  activityType: string;
  records: LogbookRecord[];
  form: FormDef | undefined;
  onAmend?: (rec: LogbookRecord) => void;
  latestActiveIds: Set<string>;
}) {
  void activityType;
  // "instrumentUsed" is dropped — the Instrument column already covers it.
  const fields = (form?.fields || []).filter((f) => f.key !== "instrumentUsed");
  const isSample = form?.scope === "sample";

  // Group amendments with their original records
  const threadedRecords: LogbookRecord[] = [];
  const byAmends = new Map<string, LogbookRecord[]>();
  const roots: LogbookRecord[] = [];

  for (const rec of records) {
    if (rec.amends) {
      const arr = byAmends.get(rec.amends);
      if (arr) arr.push(rec);
      else byAmends.set(rec.amends, [rec]);
    } else {
      roots.push(rec);
    }
  }

  for (const root of roots) {
    threadedRecords.push(root);
    const children = byAmends.get(root.id);
    if (children) {
      // Sort children chronologically (oldest amendment first)
      children.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      threadedRecords.push(...children);
    }
  }

  // Any orphaned amendments (shouldn't happen, but just in case)
  for (const rec of records) {
    if (rec.amends && !roots.some(r => r.id === rec.amends)) {
      threadedRecords.push(rec);
    }
  }

  return (
    <section>
      <div className="table-scroll spreadsheet-container shadow-sm">
        <table className="doc-entry-table spreadsheet-table">
          <thead>
            <tr>
              <th className="doc-rowno-head">No.</th>
              {!isSample && <th style={{ minWidth: 150 }}>Instrument</th>}
              {!isSample && <th style={{ minWidth: 110 }}>ID</th>}
              {fields.map((f) => (
                <th key={f.key} style={{ minWidth: colMinWidth(f) }}>{f.label}</th>
              ))}
              <th style={{ minWidth: 120 }}>Signature</th>
              {onAmend && <th style={{ minWidth: 110, textAlign: "center" }}>Amend</th>}
            </tr>
          </thead>
          <tbody>
            {threadedRecords.map((rec, idx) => {
              const signature = parseAnalystSignature(rec.analystSignature);
              return (
                <tr key={rec.id}>
                  <td className="doc-rowno">{idx + 1}</td>
                  {!isSample && <td className="doc-cell" style={{ fontWeight: 700, color: "var(--primary)" }}>{rec.instrumentName || "—"}</td>}
                  {!isSample && <td className="doc-cell mono" style={{ fontSize: 12 }}>{rec.instrumentId || "—"}</td>}
                  {fields.map((f) => {
                    const val = fieldValue(rec, f);
                    return (
                      <td key={f.key} className="doc-cell" title={val} style={f.type === "textarea" ? { fontSize: 12, color: "var(--muted)" } : undefined}>
                        {val || "—"}
                      </td>
                    );
                  })}
                  <td className="doc-cell">
                    {signature.image ? (
                      <img src={signature.image} alt="Signature" className="sig-cell-img" style={{ height: 24, filter: "var(--theme-sig-filter)" }} />
                    ) : (
                      <span style={{ color: "var(--muted)", fontSize: 11 }}>{signature.typed || "—"}</span>
                    )}
                  </td>
                  {onAmend && (
                    <td className="doc-cell" style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                      {!latestActiveIds.has(rec.id) ? (
                        <span className="record-flag superseded" title={rec.amendmentReason || "Has newer correction"}><History size={10} /> Correction</span>
                      ) : rec.amends ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                          <span className="record-flag correction" title={rec.amendmentReason}><Pencil size={10} /> Correction</span>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            style={{ fontSize: 11, padding: "2px 6px" }}
                            onClick={() => onAmend(rec)}
                            title="Amend this correction"
                          >
                            Amend
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm btn-icon-gap"
                          onClick={() => onAmend(rec)}
                          title="Amend — issue an append-only correction"
                        >
                          <Pencil size={14} /> <span>Amend</span>
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AmendModal({ record, form, onCancel, onSubmit }: {
  record: LogbookRecord;
  form: FormDef | undefined;
  onCancel: () => void;
  onSubmit: (values: Record<string, string>, reason: string) => Promise<void>;
}) {
  const fields = (form?.fields || []).filter((f) => f.key !== "instrumentUsed");
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const f of fields) v[f.key] = fieldValue(record, f);
    return v;
  });
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!reason.trim()) { 
      setError("Please enter a reason for this correction."); 
      alert("Please enter a reason for this correction.");
      return; 
    }
    setSaving(true); setError("");
    try {
      await onSubmit(values, reason.trim());
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Amendment failed.";
      setError(msg);
      alert("Error: " + msg);
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal shadow-3" style={{ maxWidth: 560, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div className="modal-header">
          <p className="modal-title" style={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
            <Pencil size={16} /> Amend record
          </p>
          <button className="btn btn-ghost btn-sm" type="button" onClick={onCancel}>✕</button>
        </div>
        <div className="modal-body" style={{ flex: 1, overflowY: "auto", display: "grid", gap: 12 }}>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
            The original record stays locked. This saves a linked correction stamped with your name, the time, and the reason below.
          </p>
          {fields.map((f) => (
            <div className="field-modern" key={f.key}>
              <label>{f.label}</label>
              {f.type === "textarea" ? (
                <textarea value={values[f.key] ?? ""} rows={2} onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))} />
              ) : (
                <input
                  type={f.type === "date" ? "date" : f.type === "time" ? "time" : "text"}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                />
              )}
            </div>
          ))}
          <div className="field-modern">
            <label>Reason for amendment <span className="req">*</span></label>
            <textarea value={reason} rows={2} placeholder="e.g. corrected transposed measured value" onChange={(e) => setReason(e.target.value)} />
          </div>
          {error && <div className="notice notice-warning">{error}</div>}
        </div>
        <div className="modal-footer" style={{ justifyContent: "flex-end", gap: 10 }}>
          <button className="btn btn-outline" type="button" onClick={onCancel} disabled={saving}>Cancel</button>
          <button className="btn btn-primary btn-icon-gap" type="button" onClick={save} disabled={saving}>
            {saving ? <><RefreshCw size={16} className="spin" /> Saving…</> : <><CheckCircle2 size={16} /> Save correction</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Tab 2 — Instrument Templates
   ════════════════════════════════════════════════════════════════════════════ */

const EMPTY_TEMPLATE = {
  categoryId: "", instrumentName: "", instrumentModel: "", serialNumber: "",
  manufacturer: "Thermo Scientific", installationDate: "", instrumentId: "",
  laboratoryName: "", department: "", location: "", desk: "", 
  logbookStartDate: "", logbookEndDate: "", methodUsed: "", displayOrder: 0,
  metadata: {} as Record<string, unknown>,
  infoFormId: "",
};

function InstrumentsTab({ user, isAdmin, forms }: { user: AppUser | null; isAdmin: boolean; forms: FormDef[] }) {
  void user;
  const [categories, setCategories] = useState<InstrumentCategory[]>([]);
  const [templates, setTemplates] = useState<InstrumentTemplate[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState<null | "add" | "edit">(null);
  const [editing, setEditing]   = useState<InstrumentTemplate | null>(null);
  const [form, setForm]         = useState(EMPTY_TEMPLATE);
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [notice, setNotice]     = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [instrTab, setInstrTab] = useState<"basic" | "content">("basic");

  // All forms with scope "instrument" can be used as a General Information form.
  const instrumentForms = forms.filter((f) => f.scope === "instrument");
  const defaultInfoForm = forms.find(f => f.id === "instrument") || instrumentForms[0];

  // Category management
  const [catModal, setCatModal] = useState(false);
  const [catBusy, setCatBusy]   = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [catNames, setCatNames] = useState<Record<string, string>>({});

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [catR, tplR] = await Promise.all([
      fetch("/api/templates/categories").then((r) => r.json()),
      fetch("/api/templates").then((r) => r.json()),
    ]);
    setCategories(catR.categories || []);
    setTemplates(tplR.templates || []);
    setLoading(false);
  }

  function openAdd() {
    setForm({ ...EMPTY_TEMPLATE, categoryId: categories[0]?.id || "" });
    setEditing(null); setModal("add");
    setInstrTab("basic");
  }

  function openEdit(tpl: InstrumentTemplate) {
    setForm({ 
      categoryId: tpl.categoryId, 
      instrumentName: tpl.instrumentName, 
      instrumentModel: tpl.instrumentModel,
      serialNumber: tpl.serialNumber, 
      manufacturer: tpl.manufacturer, 
      installationDate: tpl.installationDate,
      instrumentId: tpl.instrumentId, 
      laboratoryName: tpl.laboratoryName, 
      department: tpl.department,
      location: tpl.location, 
      desk: tpl.desk,
      logbookStartDate: tpl.logbookStartDate,
      logbookEndDate: tpl.logbookEndDate,
      methodUsed: tpl.methodUsed, 
      displayOrder: tpl.displayOrder,
      metadata: tpl.metadata || {},
      infoFormId: tpl.infoFormId || "",
    });
    setEditing(tpl); setModal("edit");
    setInstrTab("basic");
  }

  async function saveTemplate() {
    setSaving(true);
    const url = modal === "edit" ? `/api/templates?id=${editing!.id}` : "/api/templates";
    const r = await fetch(url, { method: modal === "edit" ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (r.ok) { setNotice({ type: "success", text: modal === "edit" ? "Template updated." : "Template created." }); setModal(null); loadAll(); }
    else       { setNotice({ type: "error", text: "Save failed. Check all fields." }); }
    setSaving(false);
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Delete this instrument template? This cannot be undone.")) return;
    setDeleting(id);
    const r = await fetch(`/api/templates?id=${id}`, { method: "DELETE" });
    if (r.ok) { setNotice({ type: "success", text: "Template deleted." }); loadAll(); }
    setDeleting(null);
  }

  async function moveInstrument(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= templates.length) return;
    const reordered = [...templates];
    [reordered[index], reordered[j]] = [reordered[j], reordered[index]];

    // Optimistically update the local order so the row swaps instantly without
    // flashing the whole table back to the loading skeleton (which resets scroll).
    const normalised = reordered.map((t, i) => ({ ...t, displayOrder: i }));
    setTemplates(normalised);

    // Persist the new displayOrder in the background; no full reload needed.
    await Promise.all(
      reordered
        .map((t, i) => (t.displayOrder === i ? null : fetch(`/api/templates?id=${t.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayOrder: i }),
        })))
        .filter((p): p is Promise<Response> => p !== null)
    );
  }

  function updateValue(key: string, val: unknown) {
    if (INSTRUMENT_STANDARD_KEYS.has(key)) {
      setForm((p) => ({ ...p, [key]: val }));
    } else {
      setForm((p) => ({ ...p, metadata: { ...p.metadata, [key]: val } }));
    }
  }

  const meta = (form.metadata || {}) as Record<string, string>;

  // The General Information layout (which fields, their labels, types and order)
  // is owned by the assigned info form — managed entirely in the Form Builder.
  // The instrument editor only fills VALUES, so the two never drift apart.
  const activeInfoForm = forms.find((f) => f.id === form.infoFormId) || defaultInfoForm;
  // Identity fields live on the Basic Specifications tab; skip them here so they
  // are not rendered twice.
  const SHOWN_IN_BASIC = new Set(["instrumentName", "instrumentId"]);
  const infoFields = (activeInfoForm?.fields ?? []).filter((f) => !SHOWN_IN_BASIC.has(f.key));

  function infoValue(key: string): string {
    if (INSTRUMENT_STANDARD_KEYS.has(key)) {
      const v = (form as Record<string, unknown>)[key];
      return v == null ? "" : String(v);
    }
    return meta[key] ?? "";
  }

  function renderFieldInput(f: FormField) {
    const value = infoValue(f.key);
    const onChange = (v: string) => updateValue(f.key, v);
    if (f.type === "textarea") {
      return <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder} rows={3} />;
    }
    if (f.type === "select") {
      return (
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    const htmlType = f.type === "date" ? "date" : f.type === "time" ? "time" : f.type === "number" ? "number" : "text";
    return <input type={htmlType} value={value} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder} />;
  }

  const customFields = Array.isArray((form.metadata as Record<string, unknown>)?.customFields)
    ? (form.metadata as Record<string, unknown>).customFields as {id: string, label: string, value: string}[]
    : [];

  function addCustomField() {
    updateValue("customFields", [...customFields, { id: Date.now().toString(), label: "New Field", value: "" }]);
  }

  function updateCustomField(index: number, key: "label" | "value", val: string) {
    const next = [...customFields];
    next[index] = { ...next[index], [key]: val };
    updateValue("customFields", next);
  }

  function moveCustomField(index: number, dir: -1 | 1) {
    const next = [...customFields];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    updateValue("customFields", next);
  }

  function removeCustomField(index: number) {
    updateValue("customFields", customFields.filter((_, i) => i !== index));
  }

  // ── Category management ──────────────────────────────────────────────────────
  function openCategories() {
    setCatNames(Object.fromEntries(categories.map((c) => [c.id, c.name])));
    setNewCatName("");
    setCatModal(true);
  }

  async function reloadCats() {
    const catR = await fetch("/api/templates/categories").then((r) => r.json());
    const cats: InstrumentCategory[] = catR.categories || [];
    setCategories(cats);
    setCatNames(Object.fromEntries(cats.map((c) => [c.id, c.name])));
  }

  async function addCategory() {
    const name = newCatName.trim();
    if (!name) return;
    setCatBusy(true);
    const r = await fetch("/api/templates/categories", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, displayOrder: categories.length }),
    });
    const d = await r.json();
    if (r.ok) { setNewCatName(""); await reloadCats(); }
    else setNotice({ type: "error", text: d.error || "Could not add category." });
    setCatBusy(false);
  }

  async function renameCategory(id: string) {
    const name = (catNames[id] || "").trim();
    const current = categories.find((c) => c.id === id);
    if (!name || name === current?.name) return;
    setCatBusy(true);
    const r = await fetch(`/api/templates/categories?id=${encodeURIComponent(id)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const d = await r.json();
    if (r.ok) { setNotice({ type: "success", text: "Category renamed." }); await reloadCats(); }
    else setNotice({ type: "error", text: d.error || "Rename failed." });
    setCatBusy(false);
  }

  // Reorder by rewriting display_order to the new array index (normalises any
  // ties so up/down always moves predictably).
  async function moveCategory(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= categories.length) return;
    const reordered = [...categories];
    [reordered[index], reordered[j]] = [reordered[j], reordered[index]];
    setCatBusy(true);
    await Promise.all(
      reordered
        .map((c, i) => (c.displayOrder === i ? null : fetch(`/api/templates/categories?id=${encodeURIComponent(c.id)}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayOrder: i }),
        })))
        .filter((p): p is Promise<Response> => p !== null)
    );
    await reloadCats();
    setCatBusy(false);
  }

  async function removeCategory(id: string) {
    const count = templates.filter((t) => t.categoryId === id).length;
    if (count > 0) {
      setNotice({ type: "error", text: `Category is used by ${count} instrument${count === 1 ? "" : "s"}. Move or delete them first.` });
      return;
    }
    if (!confirm("Delete this category?")) return;
    setCatBusy(true);
    const r = await fetch(`/api/templates/categories?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const d = await r.json();
    if (r.ok) { setNotice({ type: "success", text: "Category deleted." }); await reloadCats(); }
    else setNotice({ type: "error", text: d.error || "Delete failed." });
    setCatBusy(false);
  }

  return (
    <div className="panel-modern">
      {notice && (
        <div className={`notice notice-${notice.type} shadow-sm`} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {notice.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            <span>{notice.text}</span>
          </div>
          <button style={{ float: "right", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }} onClick={() => setNotice(null)}>✕</button>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800 }}>Laboratory Instruments</h2>
          <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 4 }}>
            Manage the equipment templates available for analyst data entry.
          </p>
        </div>
        {isAdmin && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn btn-outline btn-sm btn-icon-gap" type="button" onClick={openCategories}>
              <Tag size={16} /> <span>Manage Categories</span>
            </button>
            <button className="btn btn-primary btn-sm btn-icon-gap" type="button" onClick={openAdd}>
              <Plus size={16} /> <span>New Instrument</span>
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ display: "grid", gap: 10 }}>
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 12 }} />)}
        </div>
      ) : (
        <div className="table-scroll shadow-sm" style={{ border: '1px solid var(--outline-variant)', borderRadius: 12, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th><th>Instrument</th><th>Model</th><th>Instrument ID</th>
                <th>Serial No.</th><th>Location</th>
                {isAdmin && <th style={{ width: 140 }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {templates.length === 0 && (
                <tr><td colSpan={7} className="empty-state">No instrument templates found.</td></tr>
              )}
              {templates.map((tpl) => (
                <tr key={tpl.id}>
                  <td><span className={`cat-badge cat-badge-${tpl.categoryName.toLowerCase().replace(/\s+/g, "-")}`}>{tpl.categoryName}</span></td>
                  <td style={{ fontWeight: 800, color: 'var(--primary)' }}>{tpl.instrumentName}</td>
                  <td className="mono" style={{ fontSize: 13 }}>{tpl.instrumentModel || "—"}</td>
                  <td className="mono" style={{ fontSize: 13 }}>{tpl.instrumentId || "—"}</td>
                  <td className="mono" style={{ fontSize: 13 }}>{tpl.serialNumber || "—"}</td>
                  <td style={{ fontSize: 13 }}>{tpl.location || "—"}</td>
                  {isAdmin && (
                    <td>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{ display: "flex", flexDirection: "column", marginRight: 4 }}>
                          <button className="btn btn-ghost btn-sm btn-icon-only" type="button" disabled={templates.indexOf(tpl) === 0} onClick={() => moveInstrument(templates.indexOf(tpl), -1)} title="Move up" style={{ height: 16 }}>
                            <ChevronDown size={12} style={{ transform: "rotate(180deg)" }} />
                          </button>
                          <button className="btn btn-ghost btn-sm btn-icon-only" type="button" disabled={templates.indexOf(tpl) === templates.length - 1} onClick={() => moveInstrument(templates.indexOf(tpl), 1)} title="Move down" style={{ height: 16 }}>
                            <ChevronDown size={12} />
                          </button>
                        </div>
                        <button className="btn btn-ghost btn-sm btn-icon-only" type="button" onClick={() => { openEdit(tpl); setInstrTab("content"); }} title="Edit General Info"><FileText size={14} /></button>
                        <button className="btn btn-outline btn-sm" type="button" onClick={() => openEdit(tpl)} title="Edit specifications"><Edit2 size={14} /> <span>Edit</span></button>
                        <button className="btn btn-danger btn-sm" type="button" disabled={deleting === tpl.id} onClick={() => deleteTemplate(tpl.id)} title="Delete">
                          {deleting === tpl.id ? <span>Deleting…</span> : (<><Trash2 size={14} /> <span>Delete</span></>)}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="modal shadow-3" style={{ maxWidth: 1100, width: "100%", height: 'auto', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <p className="modal-title" style={{ fontWeight: 800 }}>{modal === "add" ? "Create New Instrument" : `Edit Instrument: ${form.instrumentName}`}</p>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => setModal(null)}>✕</button>
            </div>

            <div className="edit-mode-tabs">
              <button className={`edit-mode-tab ${instrTab === "basic" ? "active" : ""}`} onClick={() => setInstrTab("basic")}>
                <Settings size={16} /> <span>1. Basic Specifications</span>
              </button>
              <button className={`edit-mode-tab ${instrTab === "content" ? "active" : ""}`} onClick={() => setInstrTab("content")}>
                <FileText size={16} /> <span>2. General Info Content</span>
              </button>
            </div>

            <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>
              {instrTab === "basic" ? (
                <div className="modal-pad">

                  {/* Identity & system settings — these are not part of the editable
                      General Information document; they identify the instrument and
                      control how it behaves in the app. */}
                  <div>
                    <h4 className="info-section-head"><Settings size={14} /> Identity &amp; Settings</h4>
                    <div className="modal-form-grid">
                      <div className="field">
                        <label className="field-label">Category <span className="req">*</span></label>
                        <select value={form.categoryId} onChange={(e) => updateValue("categoryId", e.target.value)}>
                          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className="field">
                        <label className="field-label">Instrument Name <span className="req">*</span></label>
                        <input value={form.instrumentName} onChange={(e) => updateValue("instrumentName", e.target.value)} placeholder="e.g. ICP-MS" />
                      </div>
                      <div className="field">
                        <label className="field-label">Instrument ID</label>
                        <input value={form.instrumentId} onChange={(e) => updateValue("instrumentId", e.target.value)} placeholder="e.g. ICP-MS-001" />
                      </div>
                      <div className="field">
                        <label className="field-label">Primary Method Used</label>
                        <input value={form.methodUsed} onChange={(e) => updateValue("methodUsed", e.target.value)} placeholder="Default method for new records" />
                      </div>
                      <div className="field">
                        <label className="field-label">Display Order</label>
                        <input type="number" value={form.displayOrder} onChange={(e) => updateValue("displayOrder", Number(e.target.value))} />
                      </div>
                    </div>
                  </div>

                  {/* Which General Information form drives this instrument's layout. */}
                  <div>
                    <h4 className="info-section-head"><FileText size={14} /> General Information Form</h4>
                    <div className="modal-form-grid">
                      <div className="field" style={{ gridColumn: '1 / -1' }}>
                        <label className="field-label">Form Layout</label>
                        <select value={form.infoFormId || (defaultInfoForm?.id ?? "")} onChange={(e) => updateValue("infoFormId", e.target.value)}>
                          {instrumentForms.map((f) => (
                            <option key={f.id} value={f.id}>{f.title}{f.id === "instrument" ? " (System Default)" : ""}</option>
                          ))}
                        </select>
                        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                          Choose which form defines the General Information fields. To add, remove, or reorder
                          those fields, open <strong>Form Builder → General Info</strong> — no coding required.
                        </p>
                      </div>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="modal-pad">

                  {/* Form-driven General Information fields. The structure (which
                      fields, labels, types, order) is owned by the assigned info
                      form and edited in Form Builder → General Info. Here the admin
                      only fills in the values. */}
                  <div>
                    <div className="info-section-head">
                      <FileText size={14} /> General Information
                    </div>

                    {infoFields.length === 0 ? (
                      <div style={{ padding: '24px 16px', textAlign: 'center', background: 'var(--surface-2)', border: '1px dashed var(--outline-variant)', borderRadius: 8, color: 'var(--muted)', fontSize: 13 }}>
                        No fields in this form yet.
                      </div>
                    ) : (
                      <div className="modal-form-grid">
                        {infoFields.map((f) => (
                          <div
                            key={f.key}
                            className="field"
                            style={{ margin: 0, gridColumn: (f.full || f.type === "textarea") ? '1 / -1' : undefined }}
                          >
                            <label className="field-label">
                              {f.label}{f.required ? <span className="req"> *</span> : null}
                            </label>
                            {renderFieldInput(f)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Additional custom fields */}
                  <div className="field-group-panel">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
                      <div>
                        <h4 style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>
                          Additional Fields
                        </h4>
                        <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                          Extra attributes for this instrument. These appear on the General Information tab.
                        </p>
                      </div>
                      <button type="button" className="btn btn-outline btn-sm btn-icon-gap" onClick={addCustomField}>
                        <Plus size={14} /> <span>Add Field</span>
                      </button>
                    </div>

                    <div style={{ display: 'grid', gap: 12 }}>
                      {customFields.length === 0 && (
                        <div style={{ padding: '24px 16px', textAlign: 'center', background: 'var(--surface-2)', border: '1px dashed var(--outline-variant)', borderRadius: 8, color: 'var(--muted)', fontSize: 13 }}>
                          No additional fields added yet.
                        </div>
                      )}
                      {customFields.map((f, i) => (
                        <div key={f.id} style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--surface-1)', padding: 8, borderRadius: 8, border: '1px solid var(--outline-variant)' }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <button className="btn btn-ghost btn-sm btn-icon-only" type="button" disabled={i === 0} onClick={() => moveCustomField(i, -1)} title="Move up" style={{ height: 18, width: 20 }}>
                              <ChevronDown size={12} style={{ transform: "rotate(180deg)" }} />
                            </button>
                            <button className="btn btn-ghost btn-sm btn-icon-only" type="button" disabled={i === customFields.length - 1} onClick={() => moveCustomField(i, 1)} title="Move down" style={{ height: 18, width: 20 }}>
                              <ChevronDown size={12} />
                            </button>
                          </div>
                          <div className="field" style={{ flex: 1, margin: 0 }}>
                            <input value={f.label} onChange={(e) => updateCustomField(i, "label", e.target.value)} placeholder="Field Label (e.g. Laser Type)" />
                          </div>
                          <div className="field" style={{ flex: 2, margin: 0 }}>
                            <input value={f.value} onChange={(e) => updateCustomField(i, "value", e.target.value)} placeholder="Value" />
                          </div>
                          <button type="button" className="btn btn-danger btn-sm btn-icon-only" onClick={() => removeCustomField(i)} title="Remove field">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}
            </div>
            <div className="modal-footer" style={{ justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-outline" type="button" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary btn-icon-gap" type="button" disabled={saving || !form.instrumentName || !form.categoryId} onClick={saveTemplate}>
                {saving ? "Saving…" : <><CheckCircle2 size={16} /> <span>{instrTab === "basic" ? "Save Basic Specifications" : "Save General Info"}</span></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {catModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setCatModal(false)}>
          <div className="modal shadow-3" style={{ maxWidth: 520, width: "100%" }}>
            <div className="modal-header">
              <p className="modal-title" style={{ fontWeight: 800 }}>Manage Categories</p>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => setCatModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: "grid", gap: 12 }}>
              {categories.length === 0 && (
                <p style={{ fontSize: 13, color: "var(--muted)" }}>No categories yet. Add the first one below.</p>
              )}
              {categories.map((c, i) => {
                const count = templates.filter((t) => t.categoryId === c.id).length;
                const changed = (catNames[c.id] ?? c.name).trim() !== c.name;
                return (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <button className="btn btn-ghost btn-sm btn-icon-only" type="button" disabled={i === 0 || catBusy} onClick={() => moveCategory(i, -1)} title="Move up" style={{ height: 18 }}>
                        <ChevronDown size={12} style={{ transform: "rotate(180deg)" }} />
                      </button>
                      <button className="btn btn-ghost btn-sm btn-icon-only" type="button" disabled={i === categories.length - 1 || catBusy} onClick={() => moveCategory(i, 1)} title="Move down" style={{ height: 18 }}>
                        <ChevronDown size={12} />
                      </button>
                    </div>
                    <input
                      value={catNames[c.id] ?? c.name}
                      onChange={(e) => setCatNames((p) => ({ ...p, [c.id]: e.target.value }))}
                      style={{ flex: 1 }}
                    />
                    <span className="toolbar-count" title="Instruments in this category">{count}</span>
                    <button className="btn btn-outline btn-sm" type="button" disabled={!changed || catBusy} onClick={() => renameCategory(c.id)}>Save</button>
                    <button className="btn btn-danger btn-sm btn-icon-only" type="button" disabled={catBusy} onClick={() => removeCategory(c.id)} title={count > 0 ? "In use — move instruments first" : "Delete category"}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
              <div style={{ display: "flex", gap: 8, marginTop: 8, paddingTop: 12, borderTop: "1px solid var(--outline-variant)" }}>
                <input
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addCategory(); }}
                  placeholder="New category name…"
                  style={{ flex: 1 }}
                />
                <button className="btn btn-primary btn-sm btn-icon-gap" type="button" disabled={!newCatName.trim() || catBusy} onClick={addCategory}>
                  <Plus size={14} /> <span>Add</span>
                </button>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" type="button" onClick={() => setCatModal(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Tab 3 — Users
   ════════════════════════════════════════════════════════════════════════════ */

function UsersTab({ user, isAdmin }: { user: AppUser | null; isAdmin: boolean }) {
  const [profiles, setProfiles]         = useState<ProfilePublic[]>([]);
  const [loading, setLoading]           = useState(true);
  const [subTab, setSubTab]             = useState<"active" | "archive">("active");
  const [selected, setSelected]         = useState<Set<string>>(new Set());
  const [busy, setBusy]                 = useState(false);
  const [notice, setNotice]             = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Edit modal — operates on a single selected user.
  const [editTarget, setEditTarget]     = useState<ProfilePublic | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPosition, setEditPosition] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editSaving, setEditSaving]     = useState(false);
  const [showEditPw, setShowEditPw]     = useState(false);

  const [createOpen, setCreateOpen]     = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createForm, setCreateForm]     = useState({ fullName: "", email: "", username: "", position: "", password: "", role: "analyst" as ProfilePublic["role"] });

  useEffect(() => { loadProfiles(); }, []);

  // Selection is per-tab; clear it whenever the active/archive tab changes.
  function changeTab(next: "active" | "archive") {
    if (next === subTab) return;
    setSubTab(next);
    setSelected(new Set());
  }

  async function loadProfiles() {
    setLoading(true);
    const r = await fetch("/api/users");
    if (r.ok) { const d = await r.json(); setProfiles(d.profiles || []); }
    setSelected(new Set());
    setLoading(false);
  }


  function openEdit(profile: ProfilePublic) {
    setEditTarget(profile);
    setEditFullName(profile.fullName);
    setEditUsername(profile.username);
    setEditPosition(profile.position);
    setEditPassword("");
    setShowEditPw(false);
  }

  async function saveEdit() {
    if (!editTarget) return;
    const newUsername = editUsername.trim() !== editTarget.username && editUsername.trim() ? editUsername.trim() : undefined;
    const newFullName = editFullName.trim() !== editTarget.fullName && editFullName.trim() ? editFullName.trim() : undefined;
    const newPosition = editPosition.trim() !== editTarget.position ? editPosition.trim() : undefined;
    const newPassword = editPassword.trim() || undefined;
    if (!newUsername && !newPassword && !newFullName && newPosition === undefined) { setEditTarget(null); return; }
    setEditSaving(true);
    const r = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: editTarget.username, action: "updateCredentials", newUsername, newPassword, newFullName, newPosition }),
    });
    const d = await r.json();
    if (r.ok) { setNotice({ type: "success", text: "User details updated." }); setEditTarget(null); loadProfiles(); }
    else       { setNotice({ type: "error", text: d.error || "Update failed." }); }
    setEditSaving(false);
  }

  // ── Bulk actions ──────────────────────────────────────────────────────────
  // All row actions are driven from the selection: the user ticks rows and the
  // toolbar above the table applies an action to every selected account. The
  // current user is never a valid target for archive/reset/delete.
  async function runBulk(
    label: string,
    action: (username: string) => Promise<Response>,
    confirmText?: string,
  ) {
    const targets = selectedProfiles.map((p) => p.username).filter((u) => u !== user?.username);
    if (targets.length === 0) return;
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true);
    let ok = 0, fail = 0;
    for (const u of targets) {
      try { const r = await action(u); if (r.ok) ok++; else fail++; } catch { fail++; }
    }
    setNotice({
      type: fail ? "error" : "success",
      text: fail ? `${label}: ${ok} succeeded, ${fail} failed.` : `${label} ${ok} account${ok === 1 ? "" : "s"}.`,
    });
    setBusy(false);
    loadProfiles();
  }

  const archiveSelected = () => runBulk(
    "Archived",
    (u) => fetch("/api/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: u, action: "archive" }) }),
    `Archive ${selectableCount} selected account${selectableCount === 1 ? "" : "s"}? They keep their records but can no longer sign in.`,
  );
  const restoreSelected = () => runBulk(
    "Restored",
    (u) => fetch("/api/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: u, action: "unarchive" }) }),
  );
  const resetSelected = () => runBulk(
    "Password reset for",
    (u) => fetch("/api/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: u, action: "resetPassword" }) }),
    `Reset the password to the temporary default for ${selectableCount} selected account${selectableCount === 1 ? "" : "s"}?`,
  );
  const deleteSelected = () => runBulk(
    "Deleted",
    (u) => fetch("/api/users", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: u }) }),
    `Permanently remove ${selectableCount} selected account${selectableCount === 1 ? "" : "s"}? This cannot be undone.`,
  );

  async function createUser() {
    setCreateSaving(true);
    const r = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", ...createForm }),
    });
    const d = await r.json();
    if (r.ok) {
      setNotice({ type: "success", text: `Account "${createForm.username}" created.` });
      setCreateOpen(false);
      setCreateForm({ fullName: "", email: "", username: "", position: "", password: "", role: "analyst" });
      loadProfiles();
    } else {
      setNotice({ type: "error", text: d.error || "Could not create the account." });
    }
    setCreateSaving(false);
  }

  const active           = profiles.filter((p) => !p.archived);
  const archivedProfiles = profiles.filter((p) => p.archived);
  const visible          = subTab === "active" ? active : archivedProfiles;

  // Self can never be a bulk target, so it is excluded from selection entirely.
  const selectableInTab  = visible.filter((p) => p.username !== user?.username);
  const selectedProfiles = visible.filter((p) => selected.has(p.username));
  const selectableCount  = selectedProfiles.filter((p) => p.username !== user?.username).length;

  function toggleSelect(username: string) {
    if (username === user?.username) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username); else next.add(username);
      return next;
    });
  }
  function toggleSelectAll() {
    const all = selectableInTab.map((p) => p.username);
    const allSelected = all.length > 0 && all.every((u) => selected.has(u));
    setSelected(allSelected ? new Set() : new Set(all));
  }

  return (
    <div className="panel-modern">
      {notice && (
        <div className={`notice notice-${notice.type} shadow-sm`} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {notice.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            <span>{notice.text}</span>
          </div>
          <button style={{ float: "right", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }} onClick={() => setNotice(null)}>✕</button>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800 }}>User Management</h2>
          <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 4 }}>
            Control laboratory personnel access and system privileges.
          </p>
        </div>
        {isAdmin && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn btn-primary btn-sm btn-icon-gap" type="button" onClick={() => setCreateOpen(true)}>
              <Plus size={16} /> <span>Create User</span>
            </button>
          </div>
        )}
      </div>

      <div className="scope-switch" role="tablist" style={{ marginBottom: 16 }}>
        <button type="button" role="tab" aria-selected={subTab === "active"} className={`scope-switch-btn ${subTab === "active" ? "active" : ""}`} onClick={() => changeTab("active")}>
          <UserCheck size={16} /> <span>Active</span> <span className="scope-count">{active.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={subTab === "archive"} className={`scope-switch-btn ${subTab === "archive" ? "active" : ""}`} onClick={() => changeTab("archive")}>
          <Archive size={16} /> <span>Archive</span> <span className="scope-count">{archivedProfiles.length}</span>
        </button>
      </div>

      {isAdmin && selectableCount > 0 && (
        <div
          className="shadow-sm"
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
            flexWrap: "wrap", marginBottom: 16, padding: "12px 16px", borderRadius: 12,
            border: "1px solid var(--outline-variant)", background: "var(--surface-2)",
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 14 }}>
            <strong style={{ color: "var(--primary)" }}>{selectableCount}</strong> selected
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {subTab === "active" ? (
              <>
                <button className="btn btn-outline btn-sm btn-icon-gap" type="button" disabled={busy || selectableCount !== 1} title={selectableCount !== 1 ? "Select exactly one account to edit" : "Edit"} onClick={() => openEdit(selectedProfiles.find((p) => p.username !== user?.username)!)}>
                  <Edit2 size={14} /> <span>Edit</span>
                </button>
                <button className="btn btn-outline btn-sm btn-icon-gap" type="button" disabled={busy} onClick={resetSelected}>
                  <KeyRound size={14} /> <span>Reset Password</span>
                </button>
                <button className="btn btn-outline btn-sm btn-icon-gap" type="button" disabled={busy} onClick={archiveSelected}>
                  <Archive size={14} /> <span>Archive</span>
                </button>
                <button className="btn btn-danger btn-sm btn-icon-gap" type="button" disabled={busy} onClick={deleteSelected}>
                  <Trash2 size={14} /> <span>Delete</span>
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-outline btn-sm btn-icon-gap" type="button" disabled={busy} onClick={restoreSelected}>
                  <ArchiveRestore size={14} /> <span>Restore</span>
                </button>
                <button className="btn btn-danger btn-sm btn-icon-gap" type="button" disabled={busy} onClick={deleteSelected}>
                  <Trash2 size={14} /> <span>Delete</span>
                </button>
              </>
            )}
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="skeleton" style={{ height: 400, borderRadius: 12 }} />
      ) : (
        <div style={{ display: 'grid', gap: 24 }}>
          <UsersTable
            profiles={visible}
            isAdmin={isAdmin}
            currentUsername={user?.username}
            archivedSection={subTab === "archive"}
            selected={selected}
            onToggle={toggleSelect}
            onToggleAll={toggleSelectAll}
          />

        </div>
      )}

      {editTarget && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setEditTarget(null)}>
          <div className="modal shadow-3" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <p className="modal-title" style={{ fontWeight: 800 }}>Edit User: {editTarget.username}</p>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => setEditTarget(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: "grid", gap: 16 }}>
              <div style={{ padding: "14px", background: "var(--surface-2)", borderRadius: 12, border: "1px solid var(--outline-variant)", fontSize: 14 }}>
                <p style={{ color: "var(--muted)", fontSize: 11, fontWeight: 800, textTransform: "uppercase", marginBottom: 6 }}>Account Email</p>
                <p className="mono" style={{ fontSize: 12 }}>{editTarget.email}</p>
              </div>
              <div className="field">
                <label className="field-label">Full Name</label>
                <input value={editFullName} onChange={(e) => setEditFullName(e.target.value)} placeholder="e.g. Jane Doe" />
              </div>
              <div className="field">
                <label className="field-label">Username</label>
                <input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} placeholder="New login username" />
              </div>
              <div className="field">
                <label className="field-label">Position</label>
                <input value={editPosition} onChange={(e) => setEditPosition(e.target.value)} placeholder="e.g. Senior Analyst" />
              </div>
              <div className="field">
                <label className="field-label">New Password <span style={{ color: "var(--muted)", fontWeight: 400, textTransform: "none" }}>(Optional)</span></label>
                <div style={{ position: "relative" }}>
                  <input type={showEditPw ? "text" : "password"} value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Reset user's password..." style={{ paddingRight: 72 }} />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowEditPw((p) => !p)} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", fontSize: 12 }}>{showEditPw ? "Hide" : "Show"}</button>
                </div>
              </div>
              <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
                Analysts will be required to change their password on next login if it is reset here.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" type="button" onClick={() => setEditTarget(null)}>Cancel</button>
              <button className="btn btn-primary" type="button" disabled={editSaving} onClick={saveEdit}>
                {editSaving ? "Saving…" : "Apply Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {createOpen && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setCreateOpen(false)}>
          <div className="modal shadow-3" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <p className="modal-title" style={{ fontWeight: 800 }}>Create New Account</p>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => setCreateOpen(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: "grid", gap: 16 }}>
              <div className="field">
                <label className="field-label">Full Name <span className="req">*</span></label>
                <input value={createForm.fullName} onChange={(e) => setCreateForm((p) => ({ ...p, fullName: e.target.value }))} placeholder="e.g. Jane Doe" />
              </div>
              <div className="field">
                <label className="field-label">Email <span className="req">*</span></label>
                <input type="email" value={createForm.email} onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))} placeholder="e.g. jane@lab.local" />
              </div>
              <div className="field">
                <label className="field-label">Username <span className="req">*</span></label>
                <input value={createForm.username} onChange={(e) => setCreateForm((p) => ({ ...p, username: e.target.value }))} placeholder="Login username" />
              </div>
              <div className="field">
                <label className="field-label">Position</label>
                <input value={createForm.position} onChange={(e) => setCreateForm((p) => ({ ...p, position: e.target.value }))} placeholder="e.g. Senior Analyst" />
              </div>
              <div className="field">
                <label className="field-label">Temporary Password <span className="req">*</span></label>
                <input type="text" value={createForm.password} onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))} placeholder="Min. 6 characters" />
              </div>
              <div className="field">
                <label className="field-label">Role <span className="req">*</span></label>
                <select value={createForm.role} onChange={(e) => setCreateForm((p) => ({ ...p, role: e.target.value as ProfilePublic["role"] }))}>
                  <option value="analyst">Analyst</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
                The user must change this temporary password on first login.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" type="button" onClick={() => setCreateOpen(false)}>Cancel</button>
              <button
                className="btn btn-primary btn-icon-gap"
                type="button"
                disabled={createSaving || !createForm.fullName || !createForm.email || !createForm.username || createForm.password.length < 6}
                onClick={createUser}
              >
                {createSaving ? "Creating…" : <><Plus size={16} /> <span>Create Account</span></>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UsersTable({
  profiles, isAdmin, currentUsername, archivedSection,
  selected, onToggle, onToggleAll,
}: {
  profiles: ProfilePublic[];
  isAdmin: boolean;
  currentUsername?: string;
  archivedSection: boolean;
  selected: Set<string>;
  onToggle: (username: string) => void;
  onToggleAll: () => void;
}) {
  if (profiles.length === 0) {
    return (
      <div className="empty-state-modern" style={{ padding: 40 }}>
        <div className="empty-icon-wrap">{archivedSection ? <Archive size={36} /> : <Users size={36} />}</div>
        <p>{archivedSection ? "No archived accounts." : "No active accounts."}</p>
      </div>
    );
  }

  const selectable = profiles.filter((p) => p.username !== currentUsername);
  const allSelected = selectable.length > 0 && selectable.every((p) => selected.has(p.username));

  return (
    <div className="table-scroll shadow-sm" style={{ border: '1px solid var(--outline-variant)', borderRadius: 12, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table className="data-table">
        <thead>
          <tr>
            {isAdmin && (
              <th style={{ width: 40 }}>
                <input type="checkbox" checked={allSelected} onChange={onToggleAll} disabled={selectable.length === 0} aria-label="Select all" style={{ cursor: "pointer" }} />
              </th>
            )}
            <th>Username</th><th>Full Name</th><th>Position</th><th>Role</th><th>Email</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => {
            const isSelf = p.username === currentUsername;
            const isChecked = selected.has(p.username);
            return (
              <tr
                key={p.id}
                style={{ background: isChecked ? "rgba(99, 102, 241, 0.10)" : archivedSection ? "var(--surface-2)" : undefined }}
              >
                {isAdmin && (
                  <td>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isSelf}
                      onChange={() => onToggle(p.username)}
                      aria-label={`Select ${p.username}`}
                      title={isSelf ? "You cannot select your own account" : undefined}
                      style={{ cursor: isSelf ? "not-allowed" : "pointer" }}
                    />
                  </td>
                )}
                <td style={{ fontWeight: 800, fontFamily: "var(--font-mono)", color: 'var(--primary)' }}>
                  {p.username}{isSelf && <span className="user-role-badge" style={{ marginLeft: 6 }}>you</span>}
                </td>
                <td style={{ fontWeight: 700 }}>{p.fullName || "—"}</td>
                <td style={{ fontSize: 13, color: "var(--muted)" }}>{p.position || "—"}</td>
                <td>
                  {p.role !== "analyst"
                    ? <span className="user-role-badge">{p.role}</span>
                    : <span style={{ fontSize: 13, color: "var(--muted)" }}>analyst</span>}
                </td>
                <td className="mono" style={{ fontSize: 13, color: "var(--muted)" }}>{p.email}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Tab 4 — Form Builder (full control over the data-entry forms)
   ════════════════════════════════════════════════════════════════════════════ */

const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: "text",     label: "Text" },
  { value: "textarea", label: "Text area" },
  { value: "number",   label: "Number" },
  { value: "date",     label: "Date" },
  { value: "time",     label: "Time" },
  { value: "select",   label: "Dropdown" },
];

const PRESET_FIELDS: { label: string; key: string; type: FieldType; icon: React.ElementType }[] = [
  { label: "Date", key: "date", type: "date", icon: Calendar },
  { label: "Analyst", key: "analyst", type: "text", icon: User },
  { label: "Sample ID", key: "sampleId", type: "text", icon: Tag },
  { label: "Start Time", key: "startTime", type: "time", icon: Clock },
  { label: "End Time", key: "endTime", type: "time", icon: Clock },
  { label: "Measured Value", key: "measuredValue", type: "text", icon: Hash },
  { label: "Remarks", key: "remarks", type: "textarea", icon: Info },
];

type FormDraft = {
  id: string;
  title: string;
  activityType: string;
  scope: FormScope;
  displayOrder: number;
  fields: FormField[];
  isNew: boolean;
};

function FormsTab({ forms, setForms }: { forms: FormDef[]; setForms: (f: FormDef[]) => void }) {
  const [loading, setLoading] = useState(false);
  const [draft, setDraft]     = useState<FormDraft | null>(null);
  const [saving, setSaving]   = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [notice, setNotice]   = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [scopeTab, setScopeTab] = useState<FormScope>("analytical");
  const [editTab, setEditTab] = useState<"settings" | "fields">("settings");

  // Keep each form's original index (used as its display order) while showing
  // only the forms belonging to the selected scope tab.
  const scopedForms = forms.map((f, i) => ({ f, i })).filter(({ f }) => f.scope === scopeTab);
  const scopeCount = (s: FormScope) => forms.filter((f) => f.scope === s).length;

  async function loadForms() {
    setLoading(true);
    const r = await fetch("/api/forms");
    if (r.ok) { const d = await r.json(); setForms(d.forms || []); }
    setLoading(false);
  }

  function openNew() {
    setDraft({ id: "", title: "", activityType: "", scope: scopeTab, displayOrder: forms.length, fields: [], isNew: true });
    setEditTab("settings");
  }

  function openEdit(form: FormDef, index: number) {
    setDraft({
      id: form.id, title: form.title, activityType: form.activityType,
      scope: form.scope, displayOrder: index,
      fields: form.fields.map((f) => ({ ...f })), isNew: false,
    });
    setEditTab("fields");
  }

  function cloneForm(form: FormDef) {
    setDraft({
      id: "", title: `${form.title} (Copy)`, activityType: `${form.activityType}C`,
      scope: form.scope, displayOrder: forms.length,
      fields: form.fields.map((f) => ({ ...f })), isNew: true,
    });
    setEditTab("settings");
    setNotice({ type: "success", text: "Form structure cloned. Adjust settings to save." });
  }

  async function saveDraft() {
    if (!draft) return;
    setSaving(true);
    const url = draft.isNew ? "/api/forms" : `/api/forms?id=${encodeURIComponent(draft.id)}`;
    const r = await fetch(url, {
      method: draft.isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: draft.id || undefined,
        title: draft.title,
        activityType: draft.activityType,
        scope: draft.scope,
        displayOrder: draft.displayOrder,
        fields: draft.fields,
      }),
    });
    const d = await r.json();
    if (r.ok) { setNotice({ type: "success", text: draft.isNew ? "Form created." : "Form updated." }); setDraft(null); loadForms(); }
    else { setNotice({ type: "error", text: d.error || "Save failed. Check the fields." }); }
    setSaving(false);
  }

  async function removeForm(id: string) {
    if (!confirm("Delete this form? Existing records keep their data, but this log type will no longer be available for new entries.")) return;
    setDeleting(id);
    const r = await fetch(`/api/forms?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (r.ok) { setNotice({ type: "success", text: "Form deleted." }); setDraft(null); loadForms(); }
    else { const d = await r.json(); setNotice({ type: "error", text: d.error || "Delete failed." }); }
    setDeleting(null);
  }

  // ── Field-level edits operate on the open draft ──────────────────────────────
  function updateField(i: number, patch: Partial<FormField>) {
    setDraft((p) => p && ({ ...p, fields: p.fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)) }));
  }
  function addField() {
    setDraft((p) => p && ({ ...p, fields: [...p.fields, { key: "", label: "", type: "text" }] }));
  }
  function addPresetField(preset: typeof PRESET_FIELDS[0]) {
    setDraft((p) => p && ({ ...p, fields: [...p.fields, { key: preset.key, label: preset.label, type: preset.type }] }));
  }
  function removeField(i: number) {
    setDraft((p) => p && ({ ...p, fields: p.fields.filter((_, idx) => idx !== i) }));
  }
  function moveField(i: number, dir: -1 | 1) {
    setDraft((p) => {
      if (!p) return p;
      const j = i + dir;
      if (j < 0 || j >= p.fields.length) return p;
      const fields = [...p.fields];
      [fields[i], fields[j]] = [fields[j], fields[i]];
      return { ...p, fields };
    });
  }

  return (
    <div className="panel-modern">
      {notice && (
        <div className={`notice notice-${notice.type} shadow-sm`} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {notice.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            <span>{notice.text}</span>
          </div>
          <button style={{ float: "right", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }} onClick={() => setNotice(null)}>✕</button>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800 }}>Form Builder</h2>
          <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 4 }}>
            Full control over the data-entry forms — add, edit, reorder, or remove fields and whole log types.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {scopeTab === "instrument" && forms.find(f => f.id === "instrument") && (
            <button className="btn btn-outline btn-sm btn-icon-gap" type="button" onClick={() => openEdit(forms.find(f => f.id === "instrument")!, forms.findIndex(f => f.id === "instrument"))}>
              <ShieldAlert size={16} /> <span>Modify Global Info</span>
            </button>
          )}
          <button className="btn btn-primary btn-sm btn-icon-gap" type="button" onClick={openNew}>
            <Plus size={16} /> <span>New Form</span>
          </button>
        </div>
      </div>

      <div className="scope-switch" role="tablist" style={{ marginBottom: 16 }}>
        {([
          ["analytical", "Analytical Logs"],
          ["sample", "Sample Prep"],
          ["instrument", "General Info"],
        ] as [FormScope, string][]).map(([s, label]) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={scopeTab === s}
            className={`scope-switch-btn ${scopeTab === s ? "active" : ""}`}
            onClick={() => setScopeTab(s)}
          >
            <span>{label}</span> <span className="scope-count">{scopeCount(s)}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "grid", gap: 10 }}>
          {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 12 }} />)}
        </div>
      ) : (
        <div className="table-scroll shadow-sm" style={{ border: '1px solid var(--outline-variant)', borderRadius: 12, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 56 }}>#</th>
                <th>Form Title</th>
                <th>Log Type</th>
                <th>Fields</th>
                <th style={{ width: 220 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {scopedForms.length === 0 && (
                <tr><td colSpan={5} className="empty-state">No forms in this group yet. Use “New Form” to add one.</td></tr>
              )}
              {scopedForms.map(({ f, i }, rowIdx) => (
                <tr key={f.id} className={f.id === "instrument" ? "row-highlight" : ""}>
                  <td className="mono" style={{ color: "var(--muted)" }}>{i + 1}</td>
                  <td style={{ fontWeight: 800, color: 'var(--primary)' }}>
                    {f.title}
                    {f.id === "instrument" && <span className="badge-system-default">SYSTEM DEFAULT</span>}
                  </td>
                  <td className="mono" style={{ fontSize: 13 }}>{f.activityType}</td>
                  <td style={{ fontSize: 13 }}>{f.fields.length} fields</td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-outline btn-sm btn-icon-gap" type="button" onClick={() => openEdit(f, i)}><Edit2 size={14} /> <span>Edit</span></button>
                      <button className="btn btn-ghost btn-sm btn-icon-gap" type="button" onClick={() => cloneForm(f)} title="Clone Form"><FileOutput size={14} /> <span>Clone</span></button>
                      <button className="btn btn-danger btn-sm btn-icon-gap" type="button" disabled={deleting === f.id || f.id === "instrument"} onClick={() => removeForm(f.id)} title={f.id === "instrument" ? "System form cannot be deleted" : "Delete form"}>
                        {deleting === f.id ? <span>Deleting…</span> : (<><Trash2 size={14} /> <span>Delete</span></>)}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {draft && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDraft(null)}>
          <div className="modal shadow-3" style={{ maxWidth: 1240, width: "100%", height: 'auto', maxHeight: '94vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <p className="modal-title" style={{ fontWeight: 800 }}>{draft.isNew ? "Create New Form" : `Edit Form: ${draft.title || draft.id}`}</p>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => setDraft(null)}>✕</button>
            </div>
            
            <div className="edit-mode-tabs">
              <button className={`edit-mode-tab ${editTab === "settings" ? "active" : ""}`} onClick={() => setEditTab("settings")}>
                <Settings size={16} /> <span>1. Settings</span>
              </button>
              <button className={`edit-mode-tab ${editTab === "fields" ? "active" : ""}`} onClick={() => setEditTab("fields")}>
                <TableIcon size={16} /> <span>2. Field Designer & Preview</span>
              </button>
            </div>

            <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
              {editTab === "settings" ? (
                <div className="modal-pad">
                  <div className="modal-form-grid">
                    <div className="field">
                      <label className="field-label">Form Title <span className="req">*</span></label>
                      <input value={draft.title} onChange={(e) => setDraft((p) => p && ({ ...p, title: e.target.value }))} placeholder="e.g. Daily Operation Record" />
                    </div>
                    <div className="field">
                      <label className="field-label">Log Type Code <span className="req">*</span></label>
                      <input value={draft.activityType} onChange={(e) => setDraft((p) => p && ({ ...p, activityType: e.target.value.toUpperCase() }))} placeholder="e.g. OP" style={{ textTransform: "uppercase" }} />
                    </div>
                    <div className="field">
                      <label className="field-label">Scope</label>
                      <select value={draft.scope} onChange={(e) => setDraft((p) => p && ({ ...p, scope: e.target.value as FormScope }))}>
                        <option value="analytical">Analytical instrument</option>
                        <option value="sample">Sample preparation</option>
                        <option value="instrument">Instrument metadata</option>
                      </select>
                    </div>
                    <div className="field">
                      <label className="field-label">Display Order</label>
                      <input type="number" value={draft.displayOrder} onChange={(e) => setDraft((p) => p && ({ ...p, displayOrder: Number(e.target.value) || 0 }))} />
                    </div>
                  </div>
                  {draft.id === "instrument" && (
                    <div className="notice notice-info" style={{ marginTop: 24 }}>
                      <Info size={18} />
                      <span>This is the <strong>Global System Form</strong> for General Information. Changes here will affect all instruments that use the default layout.</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="designer-preview-layout">
                  <div className="designer-panel">
                    <div className="field-designer-layout-v2">
                      <div className="field-presets-v2">
                        <p className="sidebar-label">Presets</p>
                        <div className="preset-grid-v2">
                          {PRESET_FIELDS.map((preset) => (
                            <button key={preset.key} type="button" className="btn-preset-v2" onClick={() => addPresetField(preset)} title={`Add ${preset.label} field`}>
                              <preset.icon size={16} />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="field-editor-main">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <h3 style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>Field Designer</h3>
                          <button className="btn btn-primary btn-sm btn-icon-gap" type="button" onClick={addField}><Plus size={14} /> <span>Custom Field</span></button>
                        </div>

                        <div className="table-scroll-designer">
                          <table className="field-editor-table">
                            <thead>
                              <tr>
                                <th style={{ width: 40 }}></th>
                                <th>Label</th>
                                <th>Key</th>
                                <th style={{ width: 120 }}>Type</th>
                                <th style={{ width: 60, textAlign: 'center' }}>Full</th>
                                <th style={{ width: 60, textAlign: 'center' }}>Req</th>
                                <th style={{ width: 40 }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {draft.fields.length === 0 && (
                                <tr>
                                  <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                                    Use presets or “Custom Field” to build structure.
                                  </td>
                                </tr>
                              )}
                              {draft.fields.map((f, i) => (
                                <tr key={i}>
                                  <td className="field-reorder-btns">
                                    <button type="button" disabled={i === 0} onClick={() => moveField(i, -1)}><ChevronDown size={14} style={{ transform: 'rotate(180deg)' }} /></button>
                                    <button type="button" disabled={i === draft.fields.length - 1} onClick={() => moveField(i, 1)}><ChevronDown size={14} /></button>
                                  </td>
                                  <td><input className="table-input" value={f.label} onChange={(e) => updateField(i, { label: e.target.value })} placeholder="Label" /></td>
                                  <td><input className="table-input mono" value={f.key} onChange={(e) => updateField(i, { key: e.target.value })} placeholder="key" style={{ fontSize: 12 }} /></td>
                                  <td>
                                    <select className="table-select" value={f.type} onChange={(e) => updateField(i, { type: e.target.value as FieldType })}>
                                      {FIELD_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <input type="checkbox" checked={f.full === true} onChange={(e) => updateField(i, { full: e.target.checked })} />
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <input type="checkbox" checked={f.required === true} onChange={(e) => updateField(i, { required: e.target.checked })} />
                                  </td>
                                  <td>
                                    <button className="btn-table-danger" type="button" onClick={() => removeField(i)} title="Remove field"><Trash2 size={14} /></button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="preview-panel">
                    <div className="preview-header">
                      <LayoutGrid size={16} /> <span>Live Preview</span>
                    </div>
                    <div className="preview-content">
                      <div className="preview-form-card">
                        <div className="preview-form-header">
                          <p className="preview-eyebrow">{draft.activityType || "TYPE"}</p>
                          <h4 className="preview-title">{draft.title || "Form Title"}</h4>
                        </div>
                        <div className="preview-grid">
                          {draft.fields.length === 0 ? (
                            <p className="preview-empty">Add fields to see the layout here...</p>
                          ) : (
                            draft.fields.map((f, idx) => (
                              <div key={idx} className={`preview-field ${f.full ? "full" : ""}`}>
                                <label className="preview-label">{f.label || "(No Label)"} {f.required && "*"}</label>
                                <div className="preview-input-stub">
                                  {f.type === "textarea" ? "Area text..." : f.type === "select" ? "Select..." : f.placeholder || "—"}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ justifyContent: "space-between" }}>
              <div>
                {editTab === "fields" && (
                  <button className="btn btn-ghost btn-sm btn-icon-gap" onClick={() => setEditTab("settings")}>
                    <ArrowLeft size={16} /> <span>Back to Settings</span>
                  </button>
                )}
                {editTab === "settings" && !draft.isNew && (
                  <button className="btn btn-danger btn-sm btn-icon-gap" type="button" disabled={deleting === draft.id || draft.id === "instrument"} onClick={() => removeForm(draft.id)}>
                    <Trash2 size={16} /> <span>Delete Form</span>
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-outline btn-sm" type="button" onClick={() => setDraft(null)}>Cancel</button>
                {editTab === "settings" ? (
                  <button className="btn btn-primary btn-sm btn-icon-gap" type="button" onClick={() => setEditTab("fields")} disabled={!draft.title.trim() || !draft.activityType.trim()}>
                    <span>Next: Design Fields</span> <ChevronDown size={16} style={{ transform: 'rotate(-90deg)' }} />
                  </button>
                ) : (
                  <button className="btn btn-primary btn-sm btn-icon-gap" type="button" disabled={saving} onClick={saveDraft}>
                    {saving ? "Saving…" : draft.isNew ? <><Plus size={16} /> <span>Create Form</span></> : <><CheckCircle2 size={16} /> <span>Save Changes</span></>}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Shared UI Components
   ════════════════════════════════════════════════════════════════════════════ */

function RecordSummaryItem({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="summary-item-modern">
      <span className="label">{label}</span>
      <span className="value" title={value}>{value || "—"}</span>
    </div>
  );
}

function RecordDetail({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null;
  return (
    <div className="detail-item-compact">
      <span className="k">{label}</span>
      <span className="v">{value}</span>
    </div>
  );
}

function SignatureReview({ signature }: { signature: AnalystSignaturePayload | null }) {
  if (!signature?.image) return <div style={{ fontSize: 12, color: 'var(--muted)' }}>No digital signature captured</div>;
  return (
    <div className="sig-review-wrap">
      <img src={signature.image} alt="Analyst Signature" className="sig-image-small" style={{ filter: 'var(--theme-sig-filter)' }} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Tab — Weekly Reports (read-only view of every analyst's weekly plan/report)
   ════════════════════════════════════════════════════════════════════════════ */

function wpWeekRange(weekStart: string) {
  const start = new Date(weekStart + "T00:00:00");
  if (isNaN(start.getTime())) return weekStart;
  const end = new Date(start);
  end.setDate(start.getDate() + 4);
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
  return `${fmt(start)} → ${fmt(end)}`;
}

function wpStats(plan: WeeklyPlan) {
  const totalHours = plan.tasks.reduce((s, t) => s + (Number(t.hours) || 0), 0);
  const totalWeight = plan.tasks.reduce((s, t) => s + taskWeight(t), 0);
  const totalExec = plan.tasks.reduce((s, t) => s + taskAchWeight(t), 0);
  const achievement = totalWeight > 0 ? (totalExec / totalWeight) * 100 : 0;
  const completed = plan.tasks.filter((t) => { const w = taskWeight(t); return w > 0 && taskAchWeight(t) >= w - 1e-9; }).length;
  return { totalHours, totalWeight, totalExec, achievement, completed, taskCount: plan.tasks.length };
}

function wpColor(pct: number) {
  return pct >= 90 ? "var(--success)" : pct >= 50 ? "var(--tertiary)" : "var(--primary)";
}

function WeeklyReportsTab() {
  const [plans, setPlans] = useState<WeeklyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekFilter, setWeekFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/weekly-plan")
      .then((r) => (r.ok ? r.json() : { plans: [] }))
      .then((d) => setPlans((d.plans as WeeklyPlan[]) || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const weeks = useMemo(
    () => [...new Set(plans.map((p) => p.weekStartDate))].sort().reverse(),
    [plans]
  );

  const rows = useMemo(() => {
    let p = plans.filter((x) => x.tasks.length > 0);
    if (weekFilter) p = p.filter((x) => x.weekStartDate === weekFilter);
    return p.sort(
      (a, b) => b.weekStartDate.localeCompare(a.weekStartDate) || a.username.localeCompare(b.username)
    );
  }, [plans, weekFilter]);

  // Export the visible reports: a summary sheet plus a detail sheet with every
  // task. xlsx is loaded lazily to keep it out of the initial bundle.
  async function exportXlsx() {
    if (rows.length === 0) return;
    const XLSX = await import("xlsx");
    const summary: (string | number)[][] = [
      ["Analyst", "Week", "Tasks", "Completed", "Total Hours", "Achievement %", "Last Updated"],
      ...rows.map((p) => {
        const s = wpStats(p);
        return [
          p.username, wpWeekRange(p.weekStartDate), s.taskCount, s.completed, s.totalHours,
          Number(s.achievement.toFixed(1)), p.updatedAt ? new Date(p.updatedAt).toLocaleString() : "",
        ];
      }),
    ];
    const detail: (string | number)[][] = [
      ["Analyst", "Week", "No.", "Date", "Hours", "Main Task", "Weight", "Ach. Weight", "Achievement %", "Comment / Issues"],
    ];
    for (const p of rows) {
      const tw = p.tasks.reduce((s, t) => s + taskWeight(t), 0);
      p.tasks.forEach((t, i) => {
        const aw = taskAchWeight(t);
        detail.push([
          p.username, wpWeekRange(p.weekStartDate), i + 1, t.date || "", Number(t.hours) || 0,
          t.activity || "", Number(taskWeight(t).toFixed(3)), Number(aw.toFixed(3)),
          Number((tw > 0 ? (aw / tw) * 100 : 0).toFixed(1)), t.comment || "",
        ]);
      });
    }
    const wb = XLSX.utils.book_new();
    const sumWs = XLSX.utils.aoa_to_sheet(summary);
    sumWs["!cols"] = [{ wch: 16 }, { wch: 24 }, { wch: 7 }, { wch: 10 }, { wch: 11 }, { wch: 14 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, sumWs, "Summary");
    const detWs = XLSX.utils.aoa_to_sheet(detail);
    detWs["!cols"] = [{ wch: 16 }, { wch: 24 }, { wch: 5 }, { wch: 12 }, { wch: 7 }, { wch: 40 }, { wch: 9 }, { wch: 11 }, { wch: 14 }, { wch: 32 }];
    XLSX.utils.book_append_sheet(wb, detWs, "Task Detail");
    const tag = weekFilter || "all";
    XLSX.writeFile(wb, `weekly_reports_${tag}.xlsx`);
  }

  if (loading) return <div style={{ textAlign: "center", padding: 48, color: "var(--muted)" }}>Loading weekly reports…</div>;

  return (
    <div className="wp-admin">
      <div className="wp-admin-head">
        <div>
          <h2 className="wp-admin-title">Weekly Reports</h2>
          <p className="wp-admin-sub">Plan-vs-achievement submitted by each analyst</p>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
          <label className="wp-week-picker">
            <span>Week</span>
            <select className="input-modern" value={weekFilter} onChange={(e) => setWeekFilter(e.target.value)} style={{ minWidth: 200 }}>
              <option value="">All weeks</option>
              {weeks.map((w) => <option key={w} value={w}>{wpWeekRange(w)}</option>)}
            </select>
          </label>
          <button className="btn btn-outline btn-sm" onClick={exportXlsx} disabled={rows.length === 0}>
            <FileSpreadsheet size={16} /> Export
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state-modern">No weekly reports submitted yet.</div>
      ) : (
        <div className="wp-admin-list">
          {rows.map((plan) => {
            const s = wpStats(plan);
            const color = wpColor(s.achievement);
            const key = `${plan.username}:${plan.weekStartDate}`;
            const open = expanded === key;
            return (
              <div key={key} className={`wp-admin-card ${open ? "open" : ""}`}>
                <button type="button" className="wp-admin-row" onClick={() => setExpanded(open ? null : key)}>
                  <ChevronRight size={16} className={`wp-admin-caret ${open ? "open" : ""}`} />
                  <div className="wp-admin-who">
                    <strong>{plan.username}</strong>
                    <span>{wpWeekRange(plan.weekStartDate)}</span>
                  </div>
                  <div className="wp-admin-meta">
                    <span><Calendar size={13} /> {s.taskCount} tasks</span>
                    <span><Clock size={13} /> {s.totalHours} hrs</span>
                    <span><CheckCircle2 size={13} /> {s.completed}/{s.taskCount} done</span>
                  </div>
                  <div className="wp-admin-ach">
                    <div className="wp-progress" style={{ width: 110 }}>
                      <span style={{ width: `${Math.min(s.achievement, 100)}%`, background: color }} />
                    </div>
                    <strong style={{ color }}><TrendingUp size={14} /> {s.achievement.toFixed(1)}%</strong>
                  </div>
                </button>

                {open && (
                  <div className="wp-admin-detail">
                    <table className="spreadsheet-table">
                      <thead>
                        <tr>
                          <th className="doc-rowno-head">No.</th>
                          <th style={{ minWidth: 110 }}><span className="wp-th-am">ቀን</span><span className="wp-th-en">Date</span></th>
                          <th style={{ minWidth: 70 }}><span className="wp-th-am">ሰዓት</span><span className="wp-th-en">Hours</span></th>
                          <th style={{ minWidth: 260 }}><span className="wp-th-am">ዋና ዋና ተግባራት</span><span className="wp-th-en">Main Tasks</span></th>
                          <th style={{ minWidth: 80 }}><span className="wp-th-am">እቅድ (የሳምንቱ)</span><span className="wp-th-en">Plan %</span></th>
                          <th style={{ minWidth: 120 }}><span className="wp-th-am">አፈጻጸም (የሳምንቱ)</span><span className="wp-th-en">Achievement %</span></th>
                          <th style={{ minWidth: 220 }}><span className="wp-th-am">አስተያየት</span><span className="wp-th-en">Comment / Issues</span></th>
                          <th style={{ minWidth: 90 }}><span className="wp-th-am">የስራው ክብደት</span><span className="wp-th-en">Weight</span></th>
                          <th style={{ minWidth: 110 }}><span className="wp-th-am">የአፈጻጸም ክብደት</span><span className="wp-th-en">Ach. Weight</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {plan.tasks.map((t, i) => {
                          const weight = taskWeight(t);
                          const achWeight = taskAchWeight(t);
                          const planPct = s.totalWeight > 0 ? (weight / s.totalWeight) * 100 : 0;
                          const achPct = s.totalWeight > 0 ? (achWeight / s.totalWeight) * 100 : 0;
                          const done = weight > 0 && achWeight >= weight - 1e-9;
                          return (
                            <tr key={t.id} className={done ? "wp-row-done" : ""}>
                              <td className="doc-rowno">{i + 1}</td>
                              <td className="spreadsheet-cell" style={{ padding: "8px 12px", fontSize: 13 }}>{t.date || "—"}</td>
                              <td className="spreadsheet-cell wp-calc">{t.hours || 0}</td>
                              <td className="spreadsheet-cell" style={{ padding: "8px 12px", fontSize: 13 }}>{t.activity || "—"}</td>
                              <td className="spreadsheet-cell wp-calc">{planPct.toFixed(1)}%</td>
                              <td className="spreadsheet-cell wp-calc" style={{ color: wpColor(achPct), fontWeight: 800 }}>{achPct.toFixed(1)}%</td>
                              <td className="spreadsheet-cell" style={{ padding: "8px 12px", fontSize: 13, color: "var(--muted)" }}>{t.comment || "—"}</td>
                              <td className="spreadsheet-cell wp-calc">{weight.toFixed(3)}</td>
                              <td className="spreadsheet-cell wp-calc wp-calc-strong">{achWeight.toFixed(3)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="wp-total-row">
                          <td className="doc-rowno" />
                          <td className="wp-total-label"><span className="wp-th-am">ድምር</span><span className="wp-th-en">Total</span></td>
                          <td className="wp-calc">{s.totalHours}</td>
                          <td />
                          <td className="wp-calc">{s.totalHours > 0 ? "100.0%" : "0%"}</td>
                          <td className="wp-calc" style={{ color: wpColor(s.achievement) }}>{s.achievement.toFixed(1)}%</td>
                          <td />
                          <td className="wp-calc">{s.totalWeight.toFixed(3)}</td>
                          <td className="wp-calc wp-calc-strong">{s.totalExec.toFixed(3)}</td>
                        </tr>
                      </tfoot>
                    </table>
                    {plan.updatedAt && (
                      <p className="wp-admin-updated">Last updated {new Date(plan.updatedAt).toLocaleString()}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

