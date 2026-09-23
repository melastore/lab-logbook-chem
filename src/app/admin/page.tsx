"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  AreaChart, Area 
} from "recharts";
import { 
  LayoutDashboard, FileText, Activity, Users, Download, RefreshCw,
  Filter, X, Search, ChevronDown, CheckCircle2, XCircle,
  Clock, Microscope, Settings,
  ArrowLeft, FileOutput, Calendar, User, Hash, Info,
  Plus, Trash2, ShieldAlert, Tag, Table as TableIcon, LayoutGrid,
  FileSpreadsheet, Archive, ArchiveRestore, KeyRound, UserCheck,
  ShieldCheck, AlertTriangle, Pencil, History, TrendingUp, ChevronRight, Printer,
  MessageSquare, Eye, EyeOff, ChevronLeft
} from "lucide-react";
import type { AppUser, InstrumentCategory, InstrumentTemplate, LogbookRecord, ProfilePublic, ReviewDecision } from "@/lib/logbook";
import { LOG_TYPES, currentVersionIds } from "@/lib/logbook";
import { 
  ALL_FORMS, STANDARD_KEYS, INSTRUMENT_STANDARD_KEYS,
  type FormDef, type FormField, type FieldType, type FormScope 
} from "@/lib/forms";
import { UserAvatar } from "@/components/UserAvatar";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { ModalShell } from "@/components/ModalShell";
import { AppHeader } from "@/components/AppHeader";
import { parseAnalystSignature, signatureSummary, type AnalystSignaturePayload } from "@/lib/signature";
import { taskWeight, taskAchWeight, toISODate, mondayOf, addWeeks, weekLabel, planStats, performanceRating, type WeeklyPlan } from "@/lib/weekly-plan";
import { templateSheet, summarySheets, sheetName, fileSafe } from "@/lib/weekly-export";

type Tab = "instruments" | "records" | "insights" | "users" | "forms" | "weekly";

const TAB_LABELS: Record<Tab, string> = {
  records: "Records",
  weekly: "Weekly Plans",
  insights: "Overview",
  instruments: "Instruments",
  forms: "Forms",
  users: "Users",
};

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
  const [forms, setForms] = useState<FormDef[]>(ALL_FORMS);
  const [pendingReviews, setPendingReviews] = useState(0);
  // Lets Overview open Records pre-filtered; the key remounts it with that filter.
  const [recordsView, setRecordsView] = useState<{ status: RecordsStatus; key: number }>({ status: "All", key: 0 });
  const openRecords = useCallback((status: RecordsStatus) => {
    setRecordsView((v) => ({ status, key: v.key + 1 }));
    setTab("records");
  }, []);
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

    fetch("/api/logbook/review")
      .then((r) => r.ok ? r.json() : { pending: 0 })
      .then((d) => setPendingReviews(d.pending || 0))
      .catch(() => {});
  }, []);



  const isAdmin = user?.role === "admin";

  // Analysts have no business on the admin/logs dashboard (it lists every
  // analyst's records). Their own logs are on the entry page's "Logs" button.
  // Bounce a signed-in non-admin back home; only admins stay.
  useEffect(() => {
    if (authReady && user && !isAdmin) router.replace("/");
  }, [authReady, user, isAdmin, router]);

  const visibleTabs = useMemo<Tab[]>(() => (
    isAdmin ? ["records", "weekly", "insights", "instruments", "forms", "users"] : []
  ), [isAdmin]);
  const activeTab = tab && visibleTabs.includes(tab) ? tab : visibleTabs[0];

  return (
    <main className="app-layout">
      <AppHeader user={user} />
      <div className="app-page">
      
      {authReady && user && !isAdmin && (
        <div className="notice notice-info">Redirecting to the entry page…</div>
      )}

      {authReady && !user && (
        <div className="notice notice-warning shadow-sm" style={{ borderLeft: '4px solid var(--warning)', borderRadius: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ShieldAlert size={24} className="tone-amber" />
              <span>Sign in with an admin account to access restricted management tools.</span>
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
              <span>{TAB_LABELS[t]}</span>
              {t === "records" && pendingReviews > 0 && (
                <span className="count-badge" title={`${pendingReviews} waiting for review`}>{pendingReviews}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="admin-content-area">
        {activeTab === "insights"    && <InsightsTab onOpenRecords={openRecords} onOpenTab={setTab} />}
        {activeTab === "records"     && <RecordsTab key={recordsView.key} initialStatus={recordsView.status} user={user} isAdmin={isAdmin} forms={forms} onPendingChange={setPendingReviews} />}
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

type RecordsStatus = "All" | "Pending" | "Approved" | "Rejected";

// Shared inline notice for the admin tabs; success messages fade on their own.
function TabNotice({ notice, onClose }: { notice: { type: "success" | "error"; text: string } | null; onClose: () => void }) {
  useEffect(() => {
    if (notice?.type !== "success") return;
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [notice, onClose]);
  if (!notice) return null;
  return (
    <div className={`notice notice-${notice.type} um-notice`} role="status">
      {notice.type === "success" ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
      <span>{notice.text}</span>
      <button className="btn btn-ghost btn-sm" type="button" onClick={onClose} aria-label="Dismiss"><X size={14} /></button>
    </div>
  );
}

function InsightsTab({ onOpenRecords, onOpenTab }: {
  onOpenRecords: (status: RecordsStatus) => void;
  onOpenTab: (tab: Tab) => void;
}) {
  const [records, setRecords] = useState<LogbookRecord[]>([]);
  const [plans, setPlans] = useState<WeeklyPlan[]>([]);
  const [people, setPeople] = useState<ProfilePublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(14);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const get = (url: string): Promise<any> => fetch(url, { cache: "no-store" }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
    Promise.all([get("/api/logbook"), get("/api/weekly-plan"), get("/api/users")]).then(([l, w, u]) => {
      setRecords(l.records || []);
      setPlans(w.plans || []);
      setPeople(u.profiles || []);
      setLoading(false);
    });
  }, []);

  const data = useMemo(() => {
    const current = currentVersionIds(records);
    const live = records.filter((r) => current.has(r.id));
    const today = toISODate(new Date());
    const dayOf = (r: LogbookRecord) => r.date || toISODate(new Date(r.createdAt));

    const range = Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      return toISODate(d);
    });
    const inRange = live.filter((r) => dayOf(r) >= range[0]);
    const perDay = new Map<string, number>();
    inRange.forEach((r) => perDay.set(dayOf(r), (perDay.get(dayOf(r)) || 0) + 1));
    const trend = range.map((date) => ({
      date: new Date(date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      count: perDay.get(date) || 0,
    }));

    const countBy = (list: LogbookRecord[], key: (r: LogbookRecord) => string) => {
      const m = new Map<string, number>();
      list.forEach((r) => { const k = key(r) || "—"; m.set(k, (m.get(k) || 0) + 1); });
      return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    };

    const week = mondayOf();
    const analysts = people.filter((p) => !p.archived && p.role === "analyst");
    const submitted = new Set(plans.filter((p) => p.weekStartDate === week && p.tasks.length > 0).map((p) => p.username));

    return {
      pending: live.filter((r) => r.status === "Pending").length,
      rejected: live.filter((r) => r.status === "Rejected").length,
      today: live.filter((r) => dayOf(r) === today).length,
      inRange: inRange.length,
      perDayAvg: inRange.length / days,
      activeInstruments: new Set(inRange.map((r) => r.instrumentName)).size,
      activeAnalysts: new Set(inRange.map((r) => r.analyst)).size,
      missingPlans: analysts.filter((a) => !submitted.has(a.username)),
      analystCount: analysts.length,
      trend,
      byType: countBy(inRange, (r) => LOG_TYPES.find((t) => t.id === r.activityType)?.label || r.activityType),
      byInstrument: countBy(inRange, (r) => r.instrumentName).slice(0, 8),
      byAnalyst: countBy(inRange, (r) => r.analyst).slice(0, 8),
    };
  }, [records, plans, people, days]);

  if (loading) return (
    <div className="insights-skeleton-grid">
      {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton chart-card-skeleton" />)}
    </div>
  );

  const attention = [
    {
      key: "pending", tone: "amber", icon: <Clock size={20} />, value: data.pending,
      label: "Waiting for review", hint: data.pending ? "Open and approve" : "All caught up",
      onClick: () => onOpenRecords("Pending"),
    },
    {
      key: "rejected", tone: "red", icon: <XCircle size={20} />, value: data.rejected,
      label: "Rejected records", hint: data.rejected ? "Waiting on the analyst to correct" : "None open",
      onClick: () => onOpenRecords("Rejected"),
    },
    {
      key: "plans", tone: "blue", icon: <Calendar size={20} />, value: data.missingPlans.length,
      label: "Weekly plans missing", hint: data.analystCount ? `${data.analystCount - data.missingPlans.length} of ${data.analystCount} analysts submitted` : "No analysts yet",
      onClick: () => onOpenTab("weekly"),
    },
    {
      key: "today", tone: "green", icon: <FileText size={20} />, value: data.today,
      label: "Logs today", hint: "See all records",
      onClick: () => onOpenRecords("All"),
    },
  ];

  const hBar = (rows: { name: string; value: number }[], color: string) => (
    rows.length === 0 ? <p className="ov-empty">No logs in this period.</p> : (
      <ResponsiveContainer width="100%" height={Math.max(rows.length * 34, 120)}>
        <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 24 }}>
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis dataKey="name" type="category" fontSize={12} width={130} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: "var(--surface-3)" }} />
          <Bar dataKey="value" name="Logs" fill={color} radius={[0, 4, 4, 0]} barSize={18} />
        </BarChart>
      </ResponsiveContainer>
    )
  );

  return (
    <div className="ov">
      <section>
        <h2 className="ov-heading">Needs attention</h2>
        <div className="ov-attention">
          {attention.map((a) => (
            <button key={a.key} type="button" className={`ov-card ov-${a.tone} ${a.value ? "has" : ""}`} onClick={a.onClick}>
              <span className="ov-card-icon">{a.icon}</span>
              <span className="ov-card-value">{a.value}</span>
              <span className="ov-card-label">{a.label}</span>
              <span className="ov-card-hint">{a.hint} <ChevronRight size={14} /></span>
            </button>
          ))}
        </div>
        {data.missingPlans.length > 0 && (
          <p className="ov-missing"><strong>No weekly plan yet:</strong> {data.missingPlans.map((p) => p.fullName || p.username).join(", ")}</p>
        )}
      </section>

      <section>
        <div className="ov-section-head">
          <h2 className="ov-heading">Activity</h2>
          <div className="um-chips" role="group" aria-label="Period">
            {[7, 14, 30, 90].map((d) => (
              <button key={d} type="button" className={`um-chip ${days === d ? "active" : ""}`} onClick={() => setDays(d)}>{d} days</button>
            ))}
          </div>
        </div>
        <div className="um-stats">
          <div className="um-stat"><span className="um-stat-icon"><FileText size={18} /></span><span className="um-stat-value">{data.inRange}</span><span className="um-stat-label">Logs</span></div>
          <div className="um-stat"><span className="um-stat-icon"><TrendingUp size={18} /></span><span className="um-stat-value">{data.perDayAvg.toFixed(1)}</span><span className="um-stat-label">Per day</span></div>
          <div className="um-stat"><span className="um-stat-icon"><Microscope size={18} /></span><span className="um-stat-value">{data.activeInstruments}</span><span className="um-stat-label">Instruments used</span></div>
          <div className="um-stat"><span className="um-stat-icon"><Users size={18} /></span><span className="um-stat-value">{data.activeAnalysts}</span><span className="um-stat-label">Active analysts</span></div>
        </div>

        <div className="insights-grid">
          <div className="chart-card ov-wide">
            <div className="chart-header"><h3>Logs per day</h3><p>Last {days} days</p></div>
            <div className="chart-container-inner">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data.trend}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} minTickGap={16} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                  <Tooltip />
                  <Area type="monotone" dataKey="count" name="Logs" stroke="var(--primary)" fillOpacity={1} fill="url(#colorCount)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="chart-card">
            <div className="chart-header"><h3>Most used instruments</h3><p>Logs per instrument</p></div>
            <div className="chart-container-inner">{hBar(data.byInstrument, "var(--secondary)")}</div>
          </div>
          <div className="chart-card">
            <div className="chart-header"><h3>Most active analysts</h3><p>Logs per analyst</p></div>
            <div className="chart-container-inner">{hBar(data.byAnalyst, "var(--primary)")}</div>
          </div>
          <div className="chart-card ov-wide">
            <div className="chart-header"><h3>Log types</h3><p>What kind of work was logged</p></div>
            <div className="chart-container-inner">{hBar(data.byType, "var(--tertiary)")}</div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Tab 1 — Records
   ════════════════════════════════════════════════════════════════════════════ */

function RecordsTab({ user, isAdmin, forms, onPendingChange, initialStatus = "All" }: {
  initialStatus?: RecordsStatus;
  user: AppUser | null;
  isAdmin: boolean;
  forms: FormDef[];
  onPendingChange: (count: number) => void;
}) {
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
  const [reviewTarget, setReviewTarget] = useState<LogbookRecord | null>(null);
  const [statusFilter, setStatusFilter] = useState<RecordsStatus>(initialStatus);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bulkState, setBulkState] = useState<{ busy: boolean; message: string }>({ busy: false, message: "" });
  const [integrity, setIntegrity] = useState<{
    state: "idle" | "checking" | "ok" | "bad" | "error";
    checked?: number;
    firstBad?: string | null;
    reviews?: { ok: boolean; checked: number; firstBad: string | null } | null;
  }>({ state: "idle" });

  const latestActiveIds = useMemo(() => currentVersionIds(records), [records]);

  async function verifyIntegrity() {
    setIntegrity({ state: "checking" });
    try {
      const r = await fetch("/api/logbook/verify");
      const d = await r.json();
      if (!r.ok) { setIntegrity({ state: "error" }); return; }
      const reviewsOk = !d.reviews || d.reviews.ok;
      setIntegrity({ state: d.ok && reviewsOk ? "ok" : "bad", checked: d.checked, firstBad: d.firstBad, reviews: d.reviews });
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

  const scopeMatch = useCallback((rec: LogbookRecord) => scope === "All"
    || (scope === "Sample" ? isSampleRecord(rec) : !isSampleRecord(rec)), [scope]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return records.filter((rec) => {
      const recordDate = rec.date || toISODate(new Date(rec.createdAt));
      const matchScope = scopeMatch(rec);
      const matchAnalyst = analystFilter === "All" || rec.analyst === analystFilter;
      const matchInstrument = instrumentFilter === "All" || rec.instrumentName === instrumentFilter;
      const matchActivity = activityFilter === "All" || rec.activityType === activityFilter;
      const matchDateFrom = !dateFrom || recordDate >= dateFrom;
      const matchDateTo = !dateTo || recordDate <= dateTo;
      const matchStatus = statusFilter === "All" || (rec.status === statusFilter && latestActiveIds.has(rec.id));
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
      return matchScope && matchAnalyst && matchInstrument && matchActivity && matchDateFrom && matchDateTo && matchStatus && matchSearch;
    });
  }, [records, scopeMatch, query, analystFilter, instrumentFilter, activityFilter, dateFrom, dateTo, statusFilter, latestActiveIds]);

  const pendingCount = records.filter((r) => r.status === "Pending" && latestActiveIds.has(r.id)).length;

  useEffect(() => {
    if (!loading) onPendingChange(pendingCount);
  }, [loading, pendingCount, onPendingChange]);

  // Only pending current versions someone else submitted can be bulk approved.
  function canBulkApprove(rec: LogbookRecord) {
    return rec.status === "Pending" && latestActiveIds.has(rec.id) && rec.submittedBy !== user?.id;
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // selections hidden by a filter change are ignored
  const visibleSelected = filtered.filter((r) => selectedIds.has(r.id)).map((r) => r.id);

  async function approveSelected() {
    const ids = visibleSelected;
    if (ids.length === 0) return;
    if (!confirm(`Approve ${ids.length} record${ids.length === 1 ? "" : "s"}?`)) return;
    setBulkState({ busy: true, message: "" });
    try {
      const r = await fetch("/api/logbook/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordIds: ids, decision: "Approved" }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Approval failed.");
      const failed: { error: string }[] = d.failed || [];
      setBulkState({
        busy: false,
        message: failed.length
          ? `Approved ${d.reviews.length}. ${failed.length} not approved: ${failed[0].error}`
          : `Approved ${d.reviews.length} record${d.reviews.length === 1 ? "" : "s"}.`,
      });
      setSelectedIds(new Set());
      await loadRecords();
    } catch (e) {
      setBulkState({ busy: false, message: e instanceof Error ? e.message : "Approval failed." });
    }
  }

  function resetFilters() {
    setQuery(""); setAnalystFilter("All"); setInstrumentFilter("All"); setActivityFilter("All");
    setDateFrom(""); setDateTo(""); setStatusFilter("All");
  }

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

  const activeFilterCount = [analystFilter !== "All", instrumentFilter !== "All", activityFilter !== "All", !!(dateFrom || dateTo)].filter(Boolean).length;
  const showFilters = filtersOpen || activeFilterCount > 0;
  const selectablePending = filtered.filter(canBulkApprove);
  const statusCount = (st: RecordsStatus) => st === "All"
    ? records.filter((r) => scopeMatch(r)).length
    : records.filter((r) => scopeMatch(r) && r.status === st && latestActiveIds.has(r.id)).length;

  function presetDays(n: number | null) {
    if (n === null) { setDateFrom(""); setDateTo(""); return; }
    const d = new Date();
    d.setDate(d.getDate() - (n - 1));
    setDateFrom(toISODate(d));
    setDateTo(toISODate(new Date()));
  }
  const presetActive = (n: number) => {
    const d = new Date(); d.setDate(d.getDate() - (n - 1));
    return dateFrom === toISODate(d) && dateTo === toISODate(new Date());
  };

  return (
    <>
      <div className="rec-top">
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
        <div className="rec-status" role="group" aria-label="Review status">
          {([
            ["Pending", "Needs review", <Clock key="i" size={14} />],
            ["Rejected", "Rejected", <XCircle key="i" size={14} />],
            ["Approved", "Approved", <CheckCircle2 key="i" size={14} />],
            ["All", "Any status", null],
          ] as [RecordsStatus, string, React.ReactNode][]).map(([st, label, icon]) => (
            <button key={st} type="button" className={`rec-status-btn rec-status-${st.toLowerCase()} ${statusFilter === st ? "active" : ""}`} onClick={() => setStatusFilter(st)}>
              {icon}<span>{label}</span><span className="rec-status-count">{statusCount(st)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar-modern">
        <div className="toolbar-top-row">
          <div className="search-box-modern">
            <Search size={18} className="search-icon" />
            <input
              placeholder="Search analyst, instrument, sample ID, method…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && <button className="clear-search" onClick={() => setQuery("")} aria-label="Clear search"><X size={14} /></button>}
          </div>
          <div className="toolbar-actions-modern">
            <button className={`btn btn-sm btn-icon-gap ${showFilters ? "btn-tonal" : "btn-outline"}`} type="button" onClick={() => setFiltersOpen((v) => !v)} aria-expanded={showFilters}>
              <Filter size={15} /> <span>Filters</span>{activeFilterCount > 0 && <span className="count-badge">{activeFilterCount}</span>}
            </button>
            <div className="btn-group shadow-sm">
              <button className={`view-toggle-btn ${viewMode === "table" ? "active" : ""}`} onClick={() => setViewMode("table")} title="Table view" aria-label="Table view">
                <TableIcon size={16} />
              </button>
              <button className={`view-toggle-btn ${viewMode === "cards" ? "active" : ""}`} onClick={() => setViewMode("cards")} title="Card view" aria-label="Card view">
                <LayoutGrid size={16} />
              </button>
            </div>
            <details className="rec-menu">
              <summary className="btn btn-outline btn-sm btn-icon-gap" aria-disabled={filtered.length === 0}>
                <Download size={15} /> <span>Export</span> <ChevronDown size={14} />
              </summary>
              <div className="rec-menu-list" onClick={(e) => (e.currentTarget.parentElement as HTMLDetailsElement).removeAttribute("open")}>
                <button type="button" disabled={filtered.length === 0} onClick={exportXlsx}><FileSpreadsheet size={15} /> Excel (.xlsx)</button>
                <button type="button" disabled={filtered.length === 0} onClick={exportCsv}><FileOutput size={15} /> CSV</button>
                <button type="button" disabled={filtered.length === 0} onClick={() => printRecordSheet(filtered, forms, scope === "All" ? "All records" : scope === "Sample" ? "Sample preparation" : "Instrument")}><Printer size={15} /> Print / PDF</button>
                <span className="rec-menu-note">Exports the {filtered.length} record{filtered.length === 1 ? "" : "s"} shown</span>
              </div>
            </details>
            <button className="btn btn-ghost btn-sm btn-icon-only" onClick={loadRecords} title="Refresh records" aria-label="Refresh records">
              <RefreshCw size={16} className={loading ? "spin" : ""} />
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="filter-shelf shadow-sm">
            <div className="filter-shelf-header">
              <div className="um-chips" role="group" aria-label="Date range">
                {([[1, "Today"], [7, "7 days"], [30, "30 days"]] as [number, string][]).map(([n, label]) => (
                  <button key={n} type="button" className={`um-chip ${presetActive(n) ? "active" : ""}`} onClick={() => presetDays(n)}>{label}</button>
                ))}
                <button type="button" className={`um-chip ${!dateFrom && !dateTo ? "active" : ""}`} onClick={() => presetDays(null)}>Any date</button>
              </div>
              {(activeFilterCount > 0 || query || statusFilter !== "All") && (
                <button className="btn-text-only btn-sm" onClick={resetFilters}>Clear all</button>
              )}
            </div>
            <div className="filter-shelf-grid">
              <div className="filter-item">
                <label>Analyst</label>
                <select value={analystFilter} onChange={(e) => setAnalystFilter(e.target.value)}>
                  <option value="All">All analysts</option>
                  {analysts.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="filter-item">
                <label>Instrument</label>
                <select value={instrumentFilter} onChange={(e) => setInstrumentFilter(e.target.value)}>
                  <option value="All">All instruments</option>
                  {instruments.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div className="filter-item">
                <label>Log type</label>
                <select value={activityFilter} onChange={(e) => setActivityFilter(e.target.value)}>
                  <option value="All">All log types</option>
                  {logTypes.map((t) => (
                    <option key={t} value={t}>{LOG_TYPES.find(lt => lt.id === t)?.label || t}</option>
                  ))}
                </select>
              </div>
              <div className="filter-item">
                <label>From – to</label>
                <div className="filter-date-range">
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="From date" />
                  <span className="filter-date-sep">to</span>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="To date" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="results-count-strip">
        <span className="count-label">Showing <strong>{filtered.length}</strong> of {records.length} records</span>
        {isAdmin && viewMode === "table" && (selectablePending.length > 0 || visibleSelected.length > 0 || bulkState.message) && (
          <span className="bulk-strip">
            {visibleSelected.length > 0 ? (
              <>
                <button className="btn btn-primary btn-sm btn-icon-gap" type="button" onClick={approveSelected} disabled={bulkState.busy}>
                  {bulkState.busy ? <RefreshCw size={15} className="spin" /> : <CheckCircle2 size={15} />} Approve {visibleSelected.length} selected
                </button>
                <button className="btn-text-only btn-sm" type="button" onClick={() => setSelectedIds(new Set())} disabled={bulkState.busy}>Clear</button>
              </>
            ) : selectablePending.length > 0 && (
              <button className="btn btn-outline btn-sm btn-icon-gap" type="button" onClick={() => setSelectedIds(new Set(selectablePending.map((r) => r.id)))}>
                <CheckCircle2 size={15} /> Select all {selectablePending.length} pending
              </button>
            )}
            {bulkState.message && <span className="bulk-message">{bulkState.message}</span>}
          </span>
        )}
        <span className="integrity-strip">
          <button className="btn btn-ghost btn-sm btn-icon-gap" type="button" onClick={verifyIntegrity} disabled={integrity.state === "checking"} title="Recompute the tamper-evidence hash chain">
            <ShieldCheck size={15} /> <span>{integrity.state === "checking" ? "Verifying…" : "Verify integrity"}</span>
          </button>
          {integrity.state === "ok" && (
            <span className="integrity-badge ok">
              <CheckCircle2 size={14} /> Intact · {integrity.checked} records{integrity.reviews ? `, ${integrity.reviews.checked} reviews` : ""} sealed
            </span>
          )}
          {integrity.state === "bad" && (
            <span className="integrity-badge bad">
              <AlertTriangle size={14} />{" "}
              {integrity.firstBad
                ? `Record tampering detected near ${integrity.firstBad.slice(0, 8)}`
                : `Review tampering detected near ${integrity.reviews?.firstBad?.slice(0, 8)}`}
            </span>
          )}
          {integrity.state === "error" && <span className="integrity-badge bad"><AlertTriangle size={14} /> Check failed</span>}
        </span>
      </div>

      {!loading && statusFilter === "Pending" && filtered.length === 0 && (
        <div className="notice notice-success um-notice"><CheckCircle2 size={18} /><span>Nothing is waiting for review{scope !== "All" ? " in this section" : ""}.</span></div>
      )}

      {viewMode === "table" ? (
        <RecordsTable records={filtered} loading={loading} forms={forms} onAmend={isAdmin ? setAmendTarget : undefined} onReview={isAdmin ? setReviewTarget : undefined} latestActiveIds={latestActiveIds}
          selection={isAdmin ? { ids: selectedIds, toggle: toggleSelected, canSelect: canBulkApprove } : undefined} />
      ) : (
      <div className="records-panel-modern">
        {loading && [1, 2, 3].map((i) => <div key={i} className="skeleton record-skeleton" style={{ height: 80, borderRadius: 12 }} />)}
        {!loading && filtered.length === 0 && (
          <div className="empty-state-modern">
            <div className="empty-icon-wrap"><Search size={40} /></div>
            <h3>No records found</h3>
            <p>Adjust your filters or search terms to find what you&apos;re looking for.</p>
            <button className="btn btn-outline btn-sm" onClick={() => { resetFilters(); setScope("All"); }}>Clear search</button>
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
                    {rec.amends && <span className="record-flag correction" title={correctionTitle(rec)}><Pencil size={10} /> Correction</span>}
                    {latestActiveIds.has(rec.id)
                      ? <span className={`log-status-badge ${rec.status.toLowerCase()}`}>{rec.status}</span>
                      : <span className="record-flag superseded" title="A newer correction replaces this version"><History size={10} /> Superseded</span>}
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
                    onClick={(e) => { e.stopPropagation(); setReviewTarget(rec); }}
                    title={rec.reviews.length ? `Review (${rec.reviews.length} so far)` : "Review — approve, reject or comment"}
                  >
                    <MessageSquare size={14} />
                  </button>
                )}
                {isAdmin && latestActiveIds.has(rec.id) && (
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
                      {rec.amends && <span className="v-subtext">Original entry signature · corrected by {rec.submitterName || "admin"}</span>}
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
                {rec.reviews.length > 0 && <ReviewHistory reviews={rec.reviews} />}
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
      {reviewTarget && (
        <ReviewModal
          record={reviewTarget}
          forms={forms}
          isCurrent={latestActiveIds.has(reviewTarget.id)}
          isOwn={!!user && reviewTarget.submittedBy === user.id}
          onCancel={() => setReviewTarget(null)}
          onDone={async () => { setReviewTarget(null); await loadRecords(); }}
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

function escHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Opens a print-ready log sheet in a new window and triggers the browser print
// dialog (which the user can "Save as PDF"). Renders each log-type group as a
// bordered table matching the paper logbook — instrument header, entries, and a
// review/approval sign-off block. Self-contained HTML so it ignores the app's
// screen styling and CSP.
function reviewCell(rec: LogbookRecord) {
  const last = [...rec.reviews].reverse().find((r) => r.decision !== "Comment");
  if (!last) return "Pending";
  const when = new Date(last.createdAt).toLocaleDateString();
  const note = last.comment ? `<div class="muted">${escHtml(last.comment)}</div>` : "";
  return `<strong>${escHtml(last.decision)}</strong><div>${escHtml(last.reviewerName)}, ${escHtml(when)}</div>${note}`;
}

function printRecordSheet(records: LogbookRecord[], forms: FormDef[], scopeLabel: string) {
  if (records.length === 0) return;

  const first = records[0];
  const dates = records.map((r) => r.date).filter(Boolean).sort();
  const range = dates.length ? (dates[0] === dates[dates.length - 1] ? dates[0] : `${dates[0]} — ${dates[dates.length - 1]}`) : "—";
  const instrumentNames = new Set(records.map((r) => r.instrumentName).filter(Boolean));
  const singleInstrument = instrumentNames.size === 1 ? first : null;

  // Group by activity type in form order.
  const groups = new Map<string, LogbookRecord[]>();
  for (const rec of records) {
    const arr = groups.get(rec.activityType);
    if (arr) arr.push(rec); else groups.set(rec.activityType, [rec]);
  }
  const knownOrder = forms.map((f) => f.activityType);
  const orderedTypes = [...groups.keys()].sort((a, b) =>
    (knownOrder.indexOf(a) === -1 ? 999 : knownOrder.indexOf(a)) -
    (knownOrder.indexOf(b) === -1 ? 999 : knownOrder.indexOf(b)));

  const sections = orderedTypes.map((type) => {
    const form = forms.find((f) => f.activityType === type);
    const isSample = form?.scope === "sample";
    const showInstrument = !isSample && !singleInstrument;
    const fields = (form?.fields || []).filter((f) => f.key !== "instrumentUsed");
    const title = form?.title || LOG_TYPES.find((t) => t.id === type)?.label || type;
    const rows = groups.get(type)!;

    const headCells = [
      "<th>No.</th>",
      showInstrument ? "<th>Instrument</th>" : "",
      ...fields.map((f) => `<th>${escHtml(f.label)}</th>`),
      "<th>Analyst</th>",
      "<th>Signature</th>",
      "<th>Review</th>",
    ].join("");

    const bodyRows = rows.map((rec, i) => {
      const sig = parseAnalystSignature(rec.analystSignature);
      const sigCell = sig.image
        ? `<img class="sig" src="${escHtml(sig.image)}" alt="signature" />`
        : escHtml(sig.typed || "—");
      const cells = [
        `<td class="num">${i + 1}</td>`,
        showInstrument ? `<td>${escHtml(rec.instrumentName || "—")}</td>` : "",
        ...fields.map((f) => `<td>${escHtml(fieldValue(rec, f) || "—")}</td>`),
        `<td>${escHtml(rec.analyst || sig.signedBy || "—")}</td>`,
        `<td class="sig-cell">${sigCell}${rec.amends ? `<div class="muted">Corrected by ${escHtml(rec.submitterName || "admin")}: ${escHtml(rec.amendmentReason)}</div>` : ""}</td>`,
        `<td>${reviewCell(rec)}</td>`,
      ].join("");
      return `<tr>${cells}</tr>`;
    }).join("");

    return `<section class="log-section">
      <h2>${escHtml(title)} <span class="count">(${rows.length})</span></h2>
      <table><thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody></table>
    </section>`;
  }).join("");

  const instrumentBlock = singleInstrument ? `
    <div class="instrument-block">
      <div><span>Instrument</span><strong>${escHtml(singleInstrument.instrumentName || "—")}</strong></div>
      <div><span>ID</span><strong>${escHtml(singleInstrument.instrumentId || "—")}</strong></div>
      <div><span>Model</span><strong>${escHtml(singleInstrument.instrumentModel || "—")}</strong></div>
      <div><span>Serial</span><strong>${escHtml(singleInstrument.serialNumber || "—")}</strong></div>
      <div><span>Manufacturer</span><strong>${escHtml(singleInstrument.manufacturer || "—")}</strong></div>
    </div>` : "";

  const html = `<!doctype html><html><head><meta charset="utf-8" />
  <title>Log Sheet — ${escHtml(range)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: "Segoe UI", Arial, sans-serif; color: #111; margin: 24px; font-size: 11px; }
    .sheet-head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 12px; }
    .sheet-head h1 { font-size: 17px; margin: 0 0 3px; }
    .sheet-head .lab { font-size: 13px; font-weight: 700; }
    .sheet-head .muted { color: #555; font-size: 11px; }
    .sheet-head .right { text-align: right; color: #555; }
    .instrument-block { display: flex; flex-wrap: wrap; gap: 8px 28px; padding: 8px 0 14px; border-bottom: 1px solid #ccc; margin-bottom: 14px; }
    .instrument-block span { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; color: #777; }
    .instrument-block strong { font-size: 12px; }
    .log-section { margin-bottom: 20px; }
    .log-section h2 { font-size: 12px; background: #f0f0f0; padding: 6px 8px; border: 1px solid #bbb; border-bottom: none; margin: 0; }
    .log-section h2 .count { color: #777; font-weight: 400; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #bbb; padding: 4px 6px; text-align: left; vertical-align: top; }
    th { background: #f7f7f7; font-size: 10px; text-transform: uppercase; letter-spacing: 0.02em; }
    td.num { text-align: center; color: #777; width: 30px; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; }
    img.sig { height: 26px; max-width: 120px; }
    .sig-cell { min-width: 90px; }
    td .muted { color: #666; font-size: 9px; margin-top: 2px; }
    .signoff { display: flex; gap: 48px; margin-top: 30px; }
    .signoff .line { flex: 1; border-top: 1px solid #111; padding-top: 5px; font-size: 10px; color: #555; }
    .foot { margin-top: 20px; padding-top: 8px; border-top: 1px solid #ccc; color: #888; font-size: 9px; display: flex; justify-content: space-between; }
    @page { size: A4 landscape; margin: 12mm; }
  </style></head>
  <body>
    <div class="sheet-head">
      <div>
        <h1>Instrument Log Sheet</h1>
        <div class="lab">${escHtml(first.laboratoryName || "Laboratory")}</div>
        <div class="muted">${escHtml([first.department, first.location].filter(Boolean).join(" · ") || "")}</div>
      </div>
      <div class="right">
        <div><strong>${escHtml(scopeLabel)}</strong></div>
        <div class="muted">Period: ${escHtml(range)}</div>
        <div class="muted">${records.length} record${records.length === 1 ? "" : "s"}</div>
      </div>
    </div>
    ${instrumentBlock}
    ${sections}
    <div class="signoff">
      <div class="line">Prepared by (name &amp; signature) / Date</div>
      <div class="line">Reviewed by (name &amp; signature) / Date</div>
    </div>
    <div class="foot">
      <span>Generated ${escHtml(new Date().toLocaleString())}</span>
      <span>Records are sealed in a tamper-evident hash chain (ISO/IEC 17025).</span>
    </div>
  </body></html>`;

  const win = window.open("", "_blank", "width=1100,height=800");
  if (!win) {
    alert("Please allow pop-ups to print the log sheet.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  // Give images (signatures) a tick to decode before the print dialog opens.
  win.onload = () => setTimeout(() => win.print(), 250);
}

type Selection = {
  ids: Set<string>;
  toggle: (id: string) => void;
  canSelect: (rec: LogbookRecord) => boolean;
};

function RecordsTable({ records, loading, forms, onAmend, onReview, latestActiveIds, selection }: {
  records: LogbookRecord[];
  loading: boolean;
  forms: FormDef[];
  onAmend?: (rec: LogbookRecord) => void;
  onReview?: (rec: LogbookRecord) => void;
  selection?: Selection;
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
      {activeType && <LogTypeTable activityType={activeType} records={groups.get(activeType)!} form={forms.find((f) => f.activityType === activeType)} onAmend={onAmend} onReview={onReview} latestActiveIds={latestActiveIds} selection={selection} />}
    </div>
  );
}

function LogTypeTable({ activityType, records, form, onAmend, onReview, latestActiveIds, selection }: {
  activityType: string;
  records: LogbookRecord[];
  form: FormDef | undefined;
  onAmend?: (rec: LogbookRecord) => void;
  onReview?: (rec: LogbookRecord) => void;
  selection?: Selection;
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

  const selectable = selection ? threadedRecords.filter(selection.canSelect) : [];

  return (
    <section>
      <div className="table-scroll spreadsheet-container shadow-sm">
        <table className="doc-entry-table spreadsheet-table">
          <thead>
            <tr>
              {selection && (
                <th style={{ width: 32, textAlign: "center" }}>
                  <input
                    type="checkbox"
                    aria-label="Select all pending"
                    checked={selectable.length > 0 && selectable.every((r) => selection.ids.has(r.id))}
                    disabled={selectable.length === 0}
                    onChange={(e) => {
                      for (const r of selectable) {
                        if (selection.ids.has(r.id) !== e.target.checked) selection.toggle(r.id);
                      }
                    }}
                  />
                </th>
              )}
              <th className="doc-rowno-head">No.</th>
              {!isSample && <th style={{ minWidth: 150 }}>Instrument</th>}
              {!isSample && <th style={{ minWidth: 110 }}>ID</th>}
              {fields.map((f) => (
                <th key={f.key} style={{ minWidth: colMinWidth(f) }}>{f.label}</th>
              ))}
              <th style={{ minWidth: 120 }}>Signature</th>
              <th style={{ minWidth: 130, textAlign: "center" }}>Review</th>
              {onAmend && <th style={{ minWidth: 110, textAlign: "center" }}>Amend</th>}
            </tr>
          </thead>
          <tbody>
            {threadedRecords.map((rec, idx) => {
              const signature = parseAnalystSignature(rec.analystSignature);
              return (
                <tr key={rec.id}>
                  {selection && (
                    <td className="doc-cell" style={{ textAlign: "center" }}>
                      {selection.canSelect(rec) && (
                        <input
                          type="checkbox"
                          aria-label="Select for approval"
                          checked={selection.ids.has(rec.id)}
                          onChange={() => selection.toggle(rec.id)}
                        />
                      )}
                    </td>
                  )}
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
                      // Signatures are inline data: URLs held in the record, not
                      // files on disk — there is nothing for next/image to fetch
                      // or optimise.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={signature.image} alt="Analyst signature" className="sig-cell-img" />
                    ) : (
                      <span style={{ color: "var(--muted)", fontSize: 11 }}>{signature.typed || "—"}</span>
                    )}
                    {rec.amends && <div className="sig-corrected-by">Corrected by {rec.submitterName || "admin"}</div>}
                  </td>
                  <td className="doc-cell" style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                      {latestActiveIds.has(rec.id)
                        ? <span className={`log-status-badge ${rec.status.toLowerCase()}`} title={lastReviewTitle(rec)}>{rec.status}</span>
                        : <span className="record-flag superseded" title="A newer correction replaces this version"><History size={10} /> Superseded</span>}
                      {onReview && (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm btn-icon-gap"
                          style={{ fontSize: 11, padding: "2px 6px" }}
                          onClick={() => onReview(rec)}
                          title="Approve, reject or comment"
                        >
                          <MessageSquare size={12} />{rec.reviews.length > 0 && <span>{rec.reviews.length}</span>}
                        </button>
                      )}
                    </div>
                  </td>
                  {onAmend && (
                    <td className="doc-cell" style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                      {!latestActiveIds.has(rec.id) ? (
                        <span className="record-flag superseded" title={correctionTitle(rec)}><History size={10} /> Superseded</span>
                      ) : rec.amends ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                          <span className="record-flag correction" title={correctionTitle(rec)}><Pencil size={10} /> Correction</span>
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
  const [initial] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const f of fields) v[f.key] = fieldValue(record, f);
    return v;
  });
  const [values, setValues] = useState(initial);
  const changed = fields.some((f) => (values[f.key] ?? "") !== (initial[f.key] ?? ""));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!changed) { setError("Change at least one value to issue a correction."); return; }
    if (!reason.trim()) { setError("Please enter a reason for this correction."); return; }
    setSaving(true); setError("");
    try {
      await onSubmit(values, reason.trim());
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Amendment failed.";
      setError(msg);
      setSaving(false);
    }
  }

  return (
    <ModalShell open onClose={onCancel} className="modal shadow-3 modal-w-xl modal-tall" labelledBy="amend-record-title">
      <div className="modal-header">
        <h2 className="modal-title" id="amend-record-title">
          <Pencil size={16} aria-hidden="true" /> Amend record
        </h2>
        <button className="btn btn-ghost btn-sm" type="button" onClick={onCancel} aria-label="Close">✕</button>
      </div>
      <div className="modal-body" style={{ display: "grid", gap: 12 }}>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
          The original record stays locked. This saves a linked correction stamped with your name, the time, and the reason below.
          The correction starts as <strong>Pending</strong> and needs its own review.
        </p>
        {record.status === "Approved" && (
          <div className="notice notice-warning">
            This record is already approved. Saving a correction replaces the approved version, and the correction has to be approved again.
          </div>
        )}
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
        <button className="btn btn-primary btn-icon-gap" type="button" onClick={save} disabled={saving || !changed}>
          {saving ? <><RefreshCw size={16} className="spin" /> Saving…</> : <><CheckCircle2 size={16} /> Save correction</>}
        </button>
      </div>
    </ModalShell>
  );
}

function correctionTitle(rec: LogbookRecord) {
  const by = rec.submitterName ? ` — by ${rec.submitterName}` : "";
  return `${rec.amendmentReason || "Correction"}${by}, ${new Date(rec.createdAt).toLocaleString()}`;
}

function lastReviewTitle(rec: LogbookRecord) {
  const last = [...rec.reviews].reverse().find((r) => r.decision !== "Comment");
  if (!last) return "Not reviewed yet";
  return `${last.decision} by ${last.reviewerName}, ${new Date(last.createdAt).toLocaleString()}${last.comment ? ` — ${last.comment}` : ""}`;
}

function ReviewHistory({ reviews }: { reviews: LogbookRecord["reviews"] }) {
  return (
    <div className="review-history">
      <p className="remarks-label-modern">Review history</p>
      <ol>
        {reviews.map((r) => (
          <li key={r.id} className={`review-entry ${r.decision.toLowerCase()}`}>
            <div className="review-entry-head">
              {r.decision === "Comment"
                ? <span className="review-entry-kind"><MessageSquare size={12} /> Comment</span>
                : <span className={`log-status-badge ${r.decision.toLowerCase()}`}>{r.decision}</span>}
              <strong>{r.reviewerName || "Unknown"}</strong>
              <span className="review-entry-time">{new Date(r.createdAt).toLocaleString()}</span>
              {!r.hashMatches && <span className="integrity-badge bad" title="The record's seal no longer matches what was reviewed"><AlertTriangle size={12} /> Content changed</span>}
            </div>
            {r.comment && <p className="review-entry-text">{r.comment}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}

function ReviewModal({ record, forms, isCurrent, isOwn, onCancel, onDone }: {
  record: LogbookRecord;
  forms: FormDef[];
  isCurrent: boolean;
  isOwn: boolean;
  onCancel: () => void;
  onDone: () => Promise<void>;
}) {
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState<ReviewDecision | null>(null);
  const [error, setError] = useState("");
  const canDecide = isCurrent && !isOwn;
  const logType = LOG_TYPES.find((t) => t.id === record.activityType)?.label || record.activityType;

  async function submit(decision: ReviewDecision) {
    if (decision !== "Approved" && !comment.trim()) {
      setError(decision === "Rejected" ? "Enter a reason for rejecting this record." : "Write a comment first.");
      return;
    }
    setSaving(decision); setError("");
    try {
      const r = await fetch("/api/logbook/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: record.id, decision, comment: comment.trim() }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || "Review failed.");
      }
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed.");
      setSaving(null);
    }
  }

  return (
    <ModalShell open onClose={onCancel} className="modal shadow-3 modal-w-xl" labelledBy="review-record-title">
      <div className="modal-header">
        <h2 className="modal-title" id="review-record-title">
          <MessageSquare size={16} aria-hidden="true" /> Review record
        </h2>
        <button className="btn btn-ghost btn-sm" type="button" onClick={onCancel} aria-label="Close">✕</button>
      </div>
      <div className="modal-body" style={{ display: "grid", gap: 12 }}>
        <div className="review-summary">
          <span><strong>{record.instrumentName || "—"}</strong> · {logType}</span>
          <span>{record.analyst || "—"} · {record.date || record.createdAt.slice(0, 10)}{record.sampleId ? ` · ${record.sampleId}` : ""}</span>
          <span>
            Status: {isCurrent
              ? <span className={`log-status-badge ${record.status.toLowerCase()}`}>{record.status}</span>
              : <span className="record-flag superseded"><History size={10} /> Superseded</span>}
            {record.amends && <span className="record-flag correction" title={correctionTitle(record)} style={{ marginLeft: 6 }}><Pencil size={10} /> Correction</span>}
          </span>
        </div>
        {record.reviews.length > 0
          ? <ReviewHistory reviews={record.reviews} />
          : <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>No reviews yet.</p>}
        {!isCurrent && <div className="notice notice-warning">A newer correction replaces this version. You can comment, but approve or reject the latest version.</div>}
        {isCurrent && isOwn && <div className="notice notice-warning">You submitted this record, so another admin has to approve or reject it.</div>}
        <div className="field-modern">
          <label htmlFor="review-comment">Comment {canDecide && <span style={{ fontWeight: 400, color: "var(--muted)" }}>(required to reject)</span>}</label>
          <textarea id="review-comment" value={comment} rows={3} maxLength={2000} placeholder="Visible to the analyst" onChange={(e) => setComment(e.target.value)} />
        </div>
        {error && <div className="notice notice-warning" role="alert">{error}</div>}
      </div>
      <div className="modal-footer" style={{ justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-icon-gap" type="button" onClick={() => printRecordSheet([record], forms, "Single record")} style={{ marginRight: "auto" }}>
          <Printer size={16} /> Print
        </button>
        <button className="btn btn-outline" type="button" onClick={onCancel} disabled={!!saving}>Cancel</button>
        <button className="btn btn-outline btn-icon-gap" type="button" onClick={() => submit("Comment")} disabled={!!saving}>
          {saving === "Comment" ? <RefreshCw size={16} className="spin" /> : <MessageSquare size={16} />} Comment
        </button>
        {canDecide && (
          <>
            <button className="btn btn-outline btn-danger btn-icon-gap" type="button" onClick={() => submit("Rejected")} disabled={!!saving}>
              {saving === "Rejected" ? <RefreshCw size={16} className="spin" /> : <XCircle size={16} />} Reject
            </button>
            <button className="btn btn-primary btn-icon-gap" type="button" onClick={() => submit("Approved")} disabled={!!saving}>
              {saving === "Approved" ? <RefreshCw size={16} className="spin" /> : <CheckCircle2 size={16} />} Approve
            </button>
          </>
        )}
      </div>
    </ModalShell>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Tab 2 — Instrument Templates
   ════════════════════════════════════════════════════════════════════════════ */

function templateToForm(tpl: InstrumentTemplate): typeof EMPTY_TEMPLATE {
  return {
    categoryId: tpl.categoryId, instrumentName: tpl.instrumentName, instrumentModel: tpl.instrumentModel,
    serialNumber: tpl.serialNumber, manufacturer: tpl.manufacturer, installationDate: tpl.installationDate,
    instrumentId: tpl.instrumentId, laboratoryName: tpl.laboratoryName, department: tpl.department,
    location: tpl.location, desk: tpl.desk, logbookStartDate: tpl.logbookStartDate,
    logbookEndDate: tpl.logbookEndDate, methodUsed: tpl.methodUsed, displayOrder: tpl.displayOrder,
    metadata: structuredClone(tpl.metadata || {}), infoFormId: tpl.infoFormId || "",
  };
}

const EMPTY_TEMPLATE = {
  categoryId: "", instrumentName: "", instrumentModel: "", serialNumber: "",
  manufacturer: "", installationDate: "", instrumentId: "",
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
  const [instrQuery, setInstrQuery] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [loadError, setLoadError] = useState("");
  const clearNotice = useCallback(() => setNotice(null), []);

  // All forms with scope "instrument" can be used as a General Information form.
  const instrumentForms = forms.filter((f) => f.scope === "instrument");
  const defaultInfoForm = forms.find(f => f.id === "instrument") || instrumentForms[0];

  // Category management
  const [catModal, setCatModal] = useState(false);
  const [catNotice, setCatNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const clearCatNotice = useCallback(() => setCatNotice(null), []);
  const [formError, setFormError] = useState("");
  const [formSnapshot, setFormSnapshot] = useState("");
  const [catBusy, setCatBusy]   = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [catNames, setCatNames] = useState<Record<string, string>>({});

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [catR, tplR] = await Promise.all([
        fetch("/api/templates/categories").then((r) => r.json()),
        fetch("/api/templates").then((r) => r.json()),
      ]);
      setCategories(catR.categories || []);
      setTemplates(tplR.templates || []);
      setLoadError("");
    } catch {
      setLoadError("Couldn't load instruments. Check your connection.");
    }
    setLoading(false);
  }

  function openAdd() {
    const next = { ...EMPTY_TEMPLATE, categoryId: (catFilter !== "all" && catFilter) || categories[0]?.id || "", displayOrder: templates.length };
    setForm(next);
    setFormSnapshot(JSON.stringify(next));
    setFormError("");
    setEditing(null); setModal("add");
    setInstrTab("basic");
  }

  function openEdit(tpl: InstrumentTemplate) {
    const next = templateToForm(tpl);
    setForm(next);
    setFormSnapshot(JSON.stringify(next));
    setFormError("");
    setEditing(tpl); setModal("edit");
    setInstrTab("basic");
  }

  // Same setup as an existing instrument; ID and serial are cleared since they must differ.
  function openDuplicate(tpl: InstrumentTemplate) {
    setForm({
      ...templateToForm(tpl),
      instrumentName: `${tpl.instrumentName} (copy)`,
      instrumentId: "", serialNumber: "",
      displayOrder: templates.length,
    });
    setFormSnapshot("");
    setFormError("");
    setEditing(null); setModal("add");
    setInstrTab("basic");
  }

  function closeInstrument() {
    if (JSON.stringify(form) !== formSnapshot && !confirm("Discard your changes to this instrument?")) return;
    setModal(null);
  }

  async function saveTemplate(e?: React.FormEvent) {
    e?.preventDefault();
    if (saving) return;
    const missing = [
      !form.instrumentName.trim() && "Instrument name",
      !form.categoryId && "Category",
      ...infoFields.filter((f) => f.required && !infoValue(f.key).trim()).map((f) => f.label),
    ].filter(Boolean) as string[];
    if (missing.length) {
      setFormError(`Fill in: ${missing.join(", ")}.`);
      if (!form.instrumentName.trim() || !form.categoryId) setInstrTab("basic"); else setInstrTab("content");
      return;
    }
    if (form.logbookStartDate && form.logbookEndDate && form.logbookEndDate < form.logbookStartDate) {
      setFormError("Logbook end date is before the start date.");
      setInstrTab("content");
      return;
    }
    setFormError("");
    setSaving(true);
    // Drop blank extra fields so they don't clutter the record.
    const cleanForm = { ...form, metadata: { ...form.metadata, customFields: customFields.filter((f) => f.label.trim() || f.value.trim()) } };
    try {
      const url = modal === "edit" ? `/api/templates?id=${editing!.id}` : "/api/templates";
      const r = await fetch(url, { method: modal === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(cleanForm) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setNotice({ type: "success", text: `${form.instrumentName.trim()} ${modal === "edit" ? "saved" : "added"}.` }); setModal(null); loadAll(); }
      else setFormError(d.error || "Couldn't save. Check the fields and try again.");
    } catch {
      setFormError("Network error — nothing was saved.");
    }
    setSaving(false);
  }

  async function deleteTemplate(tpl: InstrumentTemplate) {
    if (!confirm(`Delete "${tpl.instrumentName}"? Analysts will no longer be able to pick it. Existing records are kept.`)) return;
    setDeleting(tpl.id);
    try {
      const r = await fetch(`/api/templates?id=${encodeURIComponent(tpl.id)}`, { method: "DELETE" });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setNotice({ type: "success", text: `${tpl.instrumentName} deleted.` }); loadAll(); }
      else setNotice({ type: "error", text: d.error || "Delete failed." });
    } catch {
      setNotice({ type: "error", text: "Network error. Nothing was deleted." });
    }
    setDeleting(null);
  }

  // The list is grouped by category, so moves only happen inside a category.
  function canMove(index: number, dir: -1 | 1) {
    const other = templates[index + dir];
    return !!other && other.categoryId === templates[index].categoryId;
  }

  async function moveInstrument(index: number, dir: -1 | 1) {
    if (!canMove(index, dir)) return;
    const j = index + dir;
    const previous = templates;
    const reordered = [...templates];
    [reordered[index], reordered[j]] = [reordered[j], reordered[index]];

    // Optimistically update the local order so the row swaps instantly without
    // flashing the whole table back to the loading skeleton (which resets scroll).
    const normalised = reordered.map((t, i) => ({ ...t, displayOrder: i }));
    setTemplates(normalised);

    // Persist the new displayOrder in the background; no full reload needed.
    const results = await Promise.all(
      reordered
        .map((t, i) => (t.displayOrder === i ? null : fetch(`/api/templates?id=${encodeURIComponent(t.id)}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayOrder: i }),
        }).then((r) => r.ok, () => false)))
        .filter((p): p is Promise<boolean> => p !== null)
    );
    if (results.some((ok) => !ok)) {
      setTemplates(previous);
      setNotice({ type: "error", text: "Couldn't save the new order." });
      loadAll();
    }
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
    const invalid = !!formError && !!f.required && !value.trim();
    if (f.type === "textarea") {
      return <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder} rows={3} aria-invalid={invalid} />;
    }
    if (f.type === "select") {
      return (
        <select value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid}>
          <option value="">—</option>
          {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    const htmlType = f.type === "date" ? "date" : f.type === "time" ? "time" : f.type === "number" ? "number" : "text";
    return <input type={htmlType} value={value} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder} aria-invalid={invalid} />;
  }

  const infoMissing = infoFields.filter((f) => f.required && !infoValue(f.key).trim()).length;

  const customFields = Array.isArray((form.metadata as Record<string, unknown>)?.customFields)
    ? (form.metadata as Record<string, unknown>).customFields as {id: string, label: string, value: string}[]
    : [];

  function addCustomField() {
    updateValue("customFields", [...customFields, { id: crypto.randomUUID(), label: "", value: "" }]);
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
    setCatNotice(null);
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
    const d = await r.json().catch(() => ({}));
    if (r.ok) { setNewCatName(""); setCatNotice({ type: "success", text: `Added “${name}”.` }); await reloadCats(); }
    else setCatNotice({ type: "error", text: d.error || "Could not add category." });
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
    const d = await r.json().catch(() => ({}));
    // Instrument rows show the category name, so refresh them too.
    if (r.ok) { setCatNotice({ type: "success", text: `Renamed to “${name}”.` }); await Promise.all([reloadCats(), loadAll()]); }
    else setCatNotice({ type: "error", text: d.error || "Rename failed." });
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
    const results = await Promise.all(
      reordered
        .map((c, i) => (c.displayOrder === i ? null : fetch(`/api/templates/categories?id=${encodeURIComponent(c.id)}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayOrder: i }),
        }).then((r) => r.ok, () => false)))
        .filter((p): p is Promise<boolean> => p !== null)
    );
    if (results.some((ok) => !ok)) setCatNotice({ type: "error", text: "Couldn't save the new order." });
    // Instrument list is grouped by category order.
    await Promise.all([reloadCats(), loadAll()]);
    setCatBusy(false);
  }

  async function removeCategory(id: string) {
    const count = templates.filter((t) => t.categoryId === id).length;
    if (count > 0) {
      setCatNotice({ type: "error", text: `This category has ${count} instrument${count === 1 ? "" : "s"}. Move or delete them first.` });
      return;
    }
    if (!confirm(`Delete the category “${categories.find((c) => c.id === id)?.name}”?`)) return;
    setCatBusy(true);
    const r = await fetch(`/api/templates/categories?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { setCatNotice({ type: "success", text: "Category deleted." }); await reloadCats(); }
    else setCatNotice({ type: "error", text: d.error || "Delete failed." });
    setCatBusy(false);
  }

  const q = instrQuery.trim().toLowerCase();
  const filteredTemplates = templates.filter((t) =>
    (catFilter === "all" || t.categoryId === catFilter) &&
    (!q || [t.instrumentName, t.instrumentModel, t.instrumentId, t.serialNumber, t.location, t.manufacturer].some((v) => (v || "").toLowerCase().includes(q))));
  const canReorder = !q && catFilter === "all";

  return (
    <div className="panel-modern">
      <TabNotice notice={notice} onClose={clearNotice} />

      <div className="um-head">
        <div>
          <h2 className="um-title">Instruments</h2>
          <p className="um-sub">The equipment analysts can choose when they log work.</p>
        </div>
        {isAdmin && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn btn-outline btn-sm btn-icon-gap" type="button" onClick={openCategories}>
              <Tag size={16} /> <span>Categories</span>
            </button>
            <button className="btn btn-primary btn-sm btn-icon-gap" type="button" onClick={openAdd} disabled={categories.length === 0} title={categories.length === 0 ? "Add a category first" : undefined}>
              <Plus size={16} /> <span>New instrument</span>
            </button>
          </div>
        )}
      </div>

      <div className="um-toolbar">
        <div className="um-search">
          <Search size={16} />
          <input value={instrQuery} onChange={(e) => setInstrQuery(e.target.value)} placeholder="Search name, model, ID, serial, location…" aria-label="Search instruments" />
          {instrQuery && <button type="button" onClick={() => setInstrQuery("")} aria-label="Clear search"><X size={14} /></button>}
        </div>
        <div className="um-chips" role="group" aria-label="Category">
          <button type="button" className={`um-chip ${catFilter === "all" ? "active" : ""}`} onClick={() => setCatFilter("all")}>All ({templates.length})</button>
          {categories.map((c) => (
            <button key={c.id} type="button" className={`um-chip ${catFilter === c.id ? "active" : ""}`} onClick={() => setCatFilter(c.id)}>
              {c.name} ({templates.filter((t) => t.categoryId === c.id).length})
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: "grid", gap: 10 }}>
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 12 }} />)}
        </div>
      ) : loadError ? (
        <div className="empty-state-modern" style={{ padding: 40 }}>
          <p>{loadError}</p>
          <button className="btn btn-outline btn-sm btn-icon-gap" type="button" onClick={loadAll}><RefreshCw size={14} /> <span>Try again</span></button>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="empty-state-modern" style={{ padding: 40 }}>
          <div className="empty-icon-wrap"><Microscope size={36} /></div>
          <p>{templates.length === 0 ? "No instruments yet. Add the first one with “New instrument”." : "No instruments match your search."}</p>
        </div>
      ) : (
        <div className="um-table-wrap">
          <table className="data-table um-table">
            <thead>
              <tr>
                {isAdmin && canReorder && <th className="um-col-check"><span className="sr-only">Order</span></th>}
                <th>Instrument</th><th>Category</th><th className="um-hide-sm">ID / Serial</th><th className="um-hide-md">Location</th>
                {isAdmin && <th className="um-col-actions"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {filteredTemplates.map((tpl) => {
                const idx = templates.indexOf(tpl);
                return (
                  <tr key={tpl.id}>
                    {isAdmin && canReorder && (
                      <td className="um-col-check">
                        <div className="inst-order">
                          <button type="button" disabled={!canMove(idx, -1)} onClick={() => moveInstrument(idx, -1)} title="Move up" aria-label={`Move ${tpl.instrumentName} up`}><ChevronDown size={13} style={{ transform: "rotate(180deg)" }} /></button>
                          <button type="button" disabled={!canMove(idx, 1)} onClick={() => moveInstrument(idx, 1)} title="Move down" aria-label={`Move ${tpl.instrumentName} down`}><ChevronDown size={13} /></button>
                        </div>
                      </td>
                    )}
                    <td>
                      <div className="um-user-text">
                        <span className="um-user-name">{tpl.instrumentName}</span>
                        <span className="um-user-handle">{[tpl.manufacturer, tpl.instrumentModel].filter(Boolean).join(" · ") || "—"}</span>
                      </div>
                    </td>
                    <td><span className={`cat-badge cat-badge-${tpl.categoryName.toLowerCase().replace(/\s+/g, "-")}`}>{tpl.categoryName}</span></td>
                    <td className="um-hide-sm mono um-muted">{tpl.instrumentId || "—"}{tpl.serialNumber ? <><br />SN {tpl.serialNumber}</> : null}</td>
                    <td className="um-hide-md um-muted">{tpl.location || "—"}</td>
                    {isAdmin && (
                      <td className="um-col-actions">
                        <div className="um-row-actions">
                          <button className="btn btn-outline btn-sm btn-icon-gap" type="button" onClick={() => openEdit(tpl)}><Pencil size={14} /> <span>Edit</span></button>
                          <button className="btn btn-ghost btn-sm btn-icon-only" type="button" onClick={() => openDuplicate(tpl)} title="Duplicate" aria-label={`Duplicate ${tpl.instrumentName}`}><FileOutput size={15} /></button>
                          <button className="btn btn-ghost btn-sm btn-icon-only um-danger" type="button" disabled={deleting === tpl.id} onClick={() => deleteTemplate(tpl)} title="Delete" aria-label={`Delete ${tpl.instrumentName}`}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <ModalShell open onClose={closeInstrument} closeOnOverlayClick={false} className="modal shadow-3 modal-w-2xl modal-tall" labelledBy="instrument-modal-title">
          <form onSubmit={saveTemplate} noValidate style={{ display: "contents" }}>
          <div className="modal-header">
            <h2 className="modal-title" id="instrument-modal-title">{modal === "add" ? "New instrument" : `Edit ${editing?.instrumentName || form.instrumentName}`}</h2>
            <button className="btn btn-ghost btn-sm" type="button" onClick={closeInstrument} aria-label="Close"><X size={16} /></button>
          </div>

          <div className="edit-mode-tabs">
            <button type="button" className={`edit-mode-tab ${instrTab === "basic" ? "active" : ""}`} onClick={() => setInstrTab("basic")}>
              <Settings size={16} /> <span>Details</span>
            </button>
            <button type="button" className={`edit-mode-tab ${instrTab === "content" ? "active" : ""}`} onClick={() => setInstrTab("content")}>
              <FileText size={16} /> <span>General information</span>
              {!!formError && infoMissing > 0 && <AlertTriangle size={14} className="tone-amber" aria-label={`${infoMissing} required missing`} />}
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
                      <select value={form.categoryId} onChange={(e) => updateValue("categoryId", e.target.value)} aria-invalid={!!formError && !form.categoryId}>
                        {!form.categoryId && <option value="">Choose…</option>}
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label className="field-label">Instrument Name <span className="req">*</span></label>
                      <input value={form.instrumentName} onChange={(e) => updateValue("instrumentName", e.target.value)} placeholder="e.g. ICP-MS" autoFocus={modal === "add"}
                        aria-invalid={!!formError && !form.instrumentName.trim()} />
                    </div>
                    <div className="field">
                      <label className="field-label">Instrument ID</label>
                      <input value={form.instrumentId} onChange={(e) => updateValue("instrumentId", e.target.value)} placeholder="e.g. ICP-MS-001" />
                      <span className="um-hint">Must be unique. Printed on every record for this instrument.</span>
                    </div>
                    <div className="field">
                      <label className="field-label">Primary Method Used</label>
                      <input value={form.methodUsed} onChange={(e) => updateValue("methodUsed", e.target.value)} placeholder="Default method for new records" />
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
          <div className="modal-footer inst-foot">
            {formError ? <span className="inst-foot-error" role="alert"><AlertTriangle size={15} /> {formError}</span> : <span />}
            <div className="inst-foot-btns">
              <button className="btn btn-outline" type="button" onClick={closeInstrument}>Cancel</button>
              <button className="btn btn-primary btn-icon-gap" type="submit" disabled={saving}>
                {saving ? "Saving…" : <><CheckCircle2 size={16} /> <span>{modal === "add" ? "Add instrument" : "Save instrument"}</span></>}
              </button>
            </div>
          </div>
          </form>
        </ModalShell>
      )}

      {catModal && (
        <ModalShell open onClose={() => setCatModal(false)} className="modal shadow-3 modal-w-md" labelledBy="categories-modal-title">
          <div className="modal-header">
            <h2 className="modal-title" id="categories-modal-title">Categories</h2>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setCatModal(false)} aria-label="Close"><X size={16} /></button>
          </div>
          <div className="modal-body cat-body">
            <p className="um-hint" style={{ marginTop: 0 }}>Groups shown in the analysts&apos; instrument list. Rename, reorder or add them here.</p>
            <TabNotice notice={catNotice} onClose={clearCatNotice} />

            <form className="cat-add" onSubmit={(e) => { e.preventDefault(); addCategory(); }}>
              <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="New category, e.g. Mass Spectrometry" aria-label="New category name" />
              <button className="btn btn-primary btn-sm btn-icon-gap" type="submit" disabled={!newCatName.trim() || catBusy}>
                <Plus size={15} /> <span>Add</span>
              </button>
            </form>

            {categories.length === 0 ? (
              <div className="empty-state-modern" style={{ padding: 24 }}><p>No categories yet.</p></div>
            ) : (
              <ul className="cat-list">
                {categories.map((c, i) => {
                  const count = templates.filter((t) => t.categoryId === c.id).length;
                  const value = catNames[c.id] ?? c.name;
                  const changed = value.trim() !== c.name && value.trim() !== "";
                  return (
                    <li key={c.id} className={`cat-row ${changed ? "changed" : ""}`}>
                      <div className="inst-order">
                        <button type="button" disabled={i === 0 || catBusy} onClick={() => moveCategory(i, -1)} title="Move up" aria-label={`Move ${c.name} up`}><ChevronDown size={13} style={{ transform: "rotate(180deg)" }} /></button>
                        <button type="button" disabled={i === categories.length - 1 || catBusy} onClick={() => moveCategory(i, 1)} title="Move down" aria-label={`Move ${c.name} down`}><ChevronDown size={13} /></button>
                      </div>
                      <input
                        className="cat-input"
                        value={value}
                        aria-label={`Name of ${c.name}`}
                        onChange={(e) => setCatNames((p) => ({ ...p, [c.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); if (changed) renameCategory(c.id); }
                          if (e.key === "Escape") { e.stopPropagation(); setCatNames((p) => ({ ...p, [c.id]: c.name })); }
                        }}
                      />
                      <span className="cat-count" title={`${count} instrument${count === 1 ? "" : "s"}`}>{count} <Microscope size={13} /></span>
                      {changed ? (
                        <button className="btn btn-primary btn-sm" type="button" disabled={catBusy} onClick={() => renameCategory(c.id)}>Save</button>
                      ) : (
                        <button className="btn btn-ghost btn-sm btn-icon-only um-danger" type="button" disabled={catBusy || count > 0}
                          onClick={() => removeCategory(c.id)} aria-label={`Delete ${c.name}`}
                          title={count > 0 ? "Has instruments — move or delete them first" : "Delete category"}>
                          <Trash2 size={15} />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-primary" type="button" onClick={() => setCatModal(false)}>Done</button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Tab 3 — Users
   ════════════════════════════════════════════════════════════════════════════ */

type UserRoleFilter = "all" | ProfilePublic["role"];
type UserDialog = { mode: "create" } | { mode: "edit"; profile: ProfilePublic };

const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Readable temporary passwords: no 0/O/1/l/I lookalikes.
function generatePassword(length = 14) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function UsersTab({ user, isAdmin }: { user: AppUser | null; isAdmin: boolean }) {
  const [profiles, setProfiles] = useState<ProfilePublic[]>([]);
  const [loading, setLoading]   = useState(true);
  const [subTab, setSubTab]     = useState<"active" | "archive">("active");
  const [query, setQuery]       = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRoleFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy]         = useState(false);
  const [notice, setNotice]     = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [dialog, setDialog]     = useState<UserDialog | null>(null);

  useEffect(() => { loadProfiles(); }, []);

  useEffect(() => {
    if (notice?.type !== "success") return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  async function loadProfiles() {
    setLoading(true);
    try {
      const r = await fetch("/api/users");
      const d = await r.json();
      setProfiles(d.profiles || []);
      if (d.error) setNotice({ type: "error", text: d.error });
    } catch {
      setNotice({ type: "error", text: "Could not load users." });
    }
    setSelected(new Set());
    setLoading(false);
  }

  function changeTab(next: "active" | "archive") {
    if (next === subTab) return;
    setSubTab(next);
    setSelected(new Set());
  }

  const isSelf = (p: ProfilePublic) => p.username === user?.username;

  // Runs one action against each target and reports a single summary.
  async function runAction(
    label: string,
    targets: string[],
    action: (username: string) => Promise<Response>,
    confirmText?: string,
  ) {
    targets = targets.filter((u) => u !== user?.username);
    if (targets.length === 0) return;
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true);
    let ok = 0;
    const errors: string[] = [];
    for (const u of targets) {
      try {
        const r = await action(u);
        if (r.ok) ok++;
        else errors.push(`${u}: ${(await r.json().catch(() => ({}))).error || "failed"}`);
      } catch {
        errors.push(`${u}: network error`);
      }
    }
    setNotice(errors.length
      ? { type: "error", text: `${label} ${ok} of ${targets.length}. ${errors.join("; ")}` }
      : { type: "success", text: `${label} ${ok} account${ok === 1 ? "" : "s"}.` });
    setBusy(false);
    loadProfiles();
  }

  const patch = (body: object) => fetch("/api/users", {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const plural = (n: number) => `${n} account${n === 1 ? "" : "s"}`;

  const archive = (targets: string[]) => runAction("Archived", targets,
    (u) => patch({ username: u, action: "archive" }),
    `Archive ${plural(targets.length)}? They keep their records but can no longer sign in.`);
  const restore = (targets: string[]) => runAction("Restored", targets,
    (u) => patch({ username: u, action: "unarchive" }));
  const resetPw = (targets: string[]) => runAction("Password reset for", targets,
    (u) => patch({ username: u, action: "resetPassword" }),
    `Reset ${plural(targets.length)} to the shared initial password? They must choose a new one at next sign-in.`);
  const remove = (targets: string[]) => runAction("Deleted", targets,
    (u) => fetch("/api/users", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: u }) }),
    `Permanently delete ${plural(targets.length)}? This cannot be undone.`);

  const active   = profiles.filter((p) => !p.archived);
  const archived = profiles.filter((p) => p.archived);
  const inTab    = subTab === "active" ? active : archived;
  const q = query.trim().toLowerCase();
  const visible = inTab
    .filter((p) => roleFilter === "all" || p.role === roleFilter)
    .filter((p) => !q || [p.username, p.fullName, p.email, p.position].some((v) => v.toLowerCase().includes(q)))
    .sort((a, b) => (a.role === b.role ? a.username.localeCompare(b.username) : a.role === "admin" ? -1 : 1));

  const selectable = visible.filter((p) => !isSelf(p));
  const selectedNames = selectable.filter((p) => selected.has(p.username)).map((p) => p.username);
  const allSelected = selectable.length > 0 && selectedNames.length === selectable.length;

  function toggle(username: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username); else next.add(username);
      return next;
    });
  }

  const stats = [
    { label: "Active", value: active.length, icon: <UserCheck size={18} /> },
    { label: "Admins", value: active.filter((p) => p.role === "admin").length, icon: <ShieldCheck size={18} /> },
    { label: "Analysts", value: active.filter((p) => p.role === "analyst").length, icon: <User size={18} /> },
    { label: "Archived", value: archived.length, icon: <Archive size={18} /> },
  ];

  return (
    <div className="panel-modern um">
      <div className="um-head">
        <div>
          <h2 className="um-title">Users</h2>
          <p className="um-sub">Accounts, roles and sign-in access for the lab.</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary btn-sm btn-icon-gap" type="button" onClick={() => setDialog({ mode: "create" })}>
            <Plus size={16} /> <span>New user</span>
          </button>
        )}
      </div>

      {notice && (
        <div className={`notice notice-${notice.type} um-notice`} role="status">
          {notice.type === "success" ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          <span>{notice.text}</span>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setNotice(null)} aria-label="Dismiss"><X size={14} /></button>
        </div>
      )}

      <div className="um-stats">
        {stats.map((s) => (
          <div key={s.label} className="um-stat">
            <span className="um-stat-icon">{s.icon}</span>
            <span className="um-stat-value">{loading ? "–" : s.value}</span>
            <span className="um-stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="um-toolbar">
        <div className="scope-switch" role="tablist">
          <button type="button" role="tab" aria-selected={subTab === "active"} className={`scope-switch-btn ${subTab === "active" ? "active" : ""}`} onClick={() => changeTab("active")}>
            <UserCheck size={16} /> <span>Active</span> <span className="scope-count">{active.length}</span>
          </button>
          <button type="button" role="tab" aria-selected={subTab === "archive"} className={`scope-switch-btn ${subTab === "archive" ? "active" : ""}`} onClick={() => changeTab("archive")}>
            <Archive size={16} /> <span>Archive</span> <span className="scope-count">{archived.length}</span>
          </button>
        </div>
        <div className="um-search">
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, username, email…" aria-label="Search users" />
          {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={14} /></button>}
        </div>
        <div className="um-chips" role="group" aria-label="Filter by role">
          {(["all", "admin", "analyst"] as const).map((r) => (
            <button key={r} type="button" className={`um-chip ${roleFilter === r ? "active" : ""}`} onClick={() => setRoleFilter(r)}>
              {r === "all" ? "All roles" : r === "admin" ? "Admins" : "Analysts"}
            </button>
          ))}
        </div>
      </div>

      {isAdmin && selectedNames.length > 0 && (
        <div className="um-bulk">
          <span><strong>{selectedNames.length}</strong> selected</span>
          <div className="um-bulk-actions">
            {subTab === "active" ? (
              <>
                <button className="btn btn-outline btn-sm btn-icon-gap" type="button" disabled={busy} onClick={() => resetPw(selectedNames)}>
                  <KeyRound size={14} /> <span>Reset password</span>
                </button>
                <button className="btn btn-outline btn-sm btn-icon-gap" type="button" disabled={busy} onClick={() => archive(selectedNames)}>
                  <Archive size={14} /> <span>Archive</span>
                </button>
              </>
            ) : (
              <button className="btn btn-outline btn-sm btn-icon-gap" type="button" disabled={busy} onClick={() => restore(selectedNames)}>
                <ArchiveRestore size={14} /> <span>Restore</span>
              </button>
            )}
            <button className="btn btn-danger btn-sm btn-icon-gap" type="button" disabled={busy} onClick={() => remove(selectedNames)}>
              <Trash2 size={14} /> <span>Delete</span>
            </button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="skeleton" style={{ height: 360, borderRadius: 12 }} />
      ) : visible.length === 0 ? (
        <div className="empty-state-modern" style={{ padding: 40 }}>
          <div className="empty-icon-wrap">{subTab === "archive" ? <Archive size={36} /> : <Users size={36} />}</div>
          <p>{q || roleFilter !== "all" ? "No users match these filters." : subTab === "archive" ? "No archived accounts." : "No active accounts."}</p>
        </div>
      ) : (
        <div className="um-table-wrap">
          <table className="data-table um-table">
            <thead>
              <tr>
                {isAdmin && (
                  <th className="um-col-check">
                    <input type="checkbox" checked={allSelected} disabled={selectable.length === 0} aria-label="Select all"
                      onChange={() => setSelected(allSelected ? new Set() : new Set(selectable.map((p) => p.username)))} />
                  </th>
                )}
                <th>User</th>
                <th>Role</th>
                <th className="um-hide-sm">Position</th>
                <th className="um-hide-md">Email</th>
                {isAdmin && <th className="um-col-actions"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const self = isSelf(p);
                const checked = selected.has(p.username);
                return (
                  <tr key={p.id} className={checked ? "um-row-selected" : undefined}>
                    {isAdmin && (
                      <td className="um-col-check">
                        <input type="checkbox" checked={checked} disabled={self} onChange={() => toggle(p.username)}
                          aria-label={`Select ${p.username}`} title={self ? "You can't select your own account" : undefined} />
                      </td>
                    )}
                    <td>
                      <div className="um-user">
                        <UserAvatar name={p.username} seed={p.id} size="sm" />
                        <div className="um-user-text">
                          <span className="um-user-name">{p.fullName || p.username}{self && <span className="um-you">you</span>}</span>
                          <span className="um-user-handle">@{p.username}</span>
                        </div>
                      </div>
                    </td>
                    <td><span className={`um-role um-role-${p.role}`}>{p.role === "admin" ? <ShieldCheck size={12} /> : <User size={12} />}{p.role}</span></td>
                    <td className="um-hide-sm um-muted">{p.position || "—"}</td>
                    <td className="um-hide-md um-muted mono">{p.email}</td>
                    {isAdmin && (
                      <td className="um-col-actions">
                        {self ? (
                          <Link className="btn btn-ghost btn-sm" href="/settings">Settings</Link>
                        ) : (
                          <div className="um-row-actions">
                            {!p.archived && (
                              <button className="btn btn-ghost btn-sm btn-icon-only" type="button" title="Edit" aria-label={`Edit ${p.username}`} disabled={busy} onClick={() => setDialog({ mode: "edit", profile: p })}>
                                <Pencil size={15} />
                              </button>
                            )}
                            {!p.archived && (
                              <button className="btn btn-ghost btn-sm btn-icon-only" type="button" title="Reset to initial password" aria-label={`Reset password for ${p.username}`} disabled={busy} onClick={() => resetPw([p.username])}>
                                <KeyRound size={15} />
                              </button>
                            )}
                            {p.archived ? (
                              <button className="btn btn-ghost btn-sm btn-icon-only" type="button" title="Restore" aria-label={`Restore ${p.username}`} disabled={busy} onClick={() => restore([p.username])}>
                                <ArchiveRestore size={15} />
                              </button>
                            ) : (
                              <button className="btn btn-ghost btn-sm btn-icon-only" type="button" title="Archive" aria-label={`Archive ${p.username}`} disabled={busy} onClick={() => archive([p.username])}>
                                <Archive size={15} />
                              </button>
                            )}
                            <button className="btn btn-ghost btn-sm btn-icon-only um-danger" type="button" title="Delete" aria-label={`Delete ${p.username}`} disabled={busy} onClick={() => remove([p.username])}>
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {dialog && (
        <UserFormDialog
          dialog={dialog}
          onClose={() => setDialog(null)}
          onSaved={(text) => { setDialog(null); setNotice({ type: "success", text }); loadProfiles(); }}
        />
      )}
    </div>
  );
}

// One dialog for create and edit. Errors stay inside the dialog so the form
// isn't lost behind the overlay when the server rejects something.
function UserFormDialog({ dialog, onClose, onSaved }: {
  dialog: UserDialog;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const editing = dialog.mode === "edit" ? dialog.profile : null;
  const [fullName, setFullName] = useState(editing?.fullName ?? "");
  const [email, setEmail]       = useState(editing?.email ?? "");
  const [username, setUsername] = useState(editing?.username ?? "");
  const [position, setPosition] = useState(editing?.position ?? "");
  const [role, setRole]         = useState<ProfilePublic["role"]>(editing?.role ?? "analyst");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(!editing);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  const cleanUsername = username.trim().toLowerCase();
  const pwTouched = password.length > 0;
  const pwTooShort = pwTouched && password.length < MIN_PASSWORD_LENGTH;
  const pwHasName = pwTouched && cleanUsername.length >= 3 && password.toLowerCase().includes(cleanUsername);
  const usernameBad = username.trim() !== "" && !USERNAME_PATTERN.test(username.trim());
  const emailBad = !editing && email.trim() !== "" && !EMAIL_PATTERN.test(email.trim());

  const missing = !fullName.trim() || !cleanUsername || (!editing && (!email.trim() || !password));
  const invalid = usernameBad || emailBad || pwTooShort || pwHasName;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (missing || invalid || saving) return;
    setError("");

    let body: Record<string, unknown>;
    if (editing) {
      body = { action: "updateCredentials", username: editing.username };
      if (cleanUsername !== editing.username) body.newUsername = cleanUsername;
      if (fullName.trim() !== editing.fullName) body.newFullName = fullName.trim();
      if (position.trim() !== editing.position) body.newPosition = position.trim();
      if (role !== editing.role) body.newRole = role;
      if (password) body.newPassword = password;
      if (Object.keys(body).length === 2) { onClose(); return; }
    } else {
      body = { action: "create", fullName: fullName.trim(), email: email.trim(), username: cleanUsername, position: position.trim(), password, role };
    }

    setSaving(true);
    try {
      const r = await fetch("/api/users", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) onSaved(editing ? `Saved changes to ${cleanUsername}.` : `Created ${cleanUsername}.`);
      else setError(d.error || "Could not save.");
    } catch {
      setError("Network error — nothing was saved.");
    }
    setSaving(false);
  }

  return (
    <ModalShell open onClose={onClose} closeOnOverlayClick={false} className="modal shadow-3 modal-w-md" labelledBy="user-form-title">
      <form onSubmit={submit} noValidate>
        <div className="modal-header">
          <h2 className="modal-title" id="user-form-title">{editing ? `Edit ${editing.username}` : "New user"}</h2>
          <button className="btn btn-ghost btn-sm" type="button" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="modal-body um-form">
          {error && <div className="notice notice-error">{error}</div>}

          <div className="um-form-grid">
            <div className="field">
              <label className="field-label" htmlFor="um-fullname">Full name <span className="req">*</span></label>
              <input id="um-fullname" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" autoComplete="off" />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="um-position">Position</label>
              <input id="um-position" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Senior Analyst" autoComplete="off" />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="um-username">Username <span className="req">*</span></label>
              <input id="um-username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="jdoe" autoComplete="off" autoCapitalize="none" spellCheck={false} aria-invalid={usernameBad} />
              {usernameBad && <span className="um-field-error">3–32 letters, numbers, dots, dashes or underscores.</span>}
            </div>
            <div className="field">
              <label className="field-label" htmlFor="um-email">Email {!editing && <span className="req">*</span>}</label>
              <input id="um-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@lab.local" autoComplete="off" readOnly={!!editing} disabled={!!editing} aria-invalid={emailBad} />
              {emailBad && <span className="um-field-error">Enter a valid email address.</span>}
            </div>
          </div>

          <div className="field">
            <span className="field-label">Role</span>
            <div className="um-role-pick" role="radiogroup" aria-label="Role">
              {(["analyst", "admin"] as const).map((r) => (
                <button key={r} type="button" role="radio" aria-checked={role === r} className={`um-role-option ${role === r ? "active" : ""}`} onClick={() => setRole(r)}>
                  {r === "admin" ? <ShieldCheck size={18} /> : <User size={18} />}
                  <span>
                    <strong>{r === "admin" ? "Admin" : "Analyst"}</strong>
                    <small>{r === "admin" ? "Reviews records, manages users and settings" : "Submits and views their own logs"}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="um-password">
              {editing ? "New password" : "Temporary password"} {editing ? <span className="um-optional">(leave blank to keep)</span> : <span className="req">*</span>}
            </label>
            <div className="um-pw">
              <input
                id="um-password"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                autoComplete="new-password"
                spellCheck={false}
                aria-invalid={pwTooShort || pwHasName}
              />
              <button type="button" className="btn btn-ghost btn-sm btn-icon-only" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide password" : "Show password"} title={showPw ? "Hide" : "Show"}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
              <button type="button" className="btn btn-outline btn-sm btn-icon-gap" onClick={() => { setPassword(generatePassword()); setShowPw(true); }}>
                <RefreshCw size={14} /> <span>Generate</span>
              </button>
            </div>
            {pwTooShort && <span className="um-field-error">{MIN_PASSWORD_LENGTH - password.length} more character{MIN_PASSWORD_LENGTH - password.length === 1 ? "" : "s"} needed.</span>}
            {pwHasName && <span className="um-field-error">Password must not contain the username.</span>}
            <span className="um-hint">The user will be asked to choose their own password at next sign-in.</span>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-icon-gap" type="submit" disabled={saving || missing || invalid}>
            {saving ? "Saving…" : editing ? "Save changes" : <><Plus size={16} /> <span>Create user</span></>}
          </button>
        </div>
      </form>
    </ModalShell>
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

// General Info forms fill instrument columns, so offer those instead.
const INSTRUMENT_PRESET_FIELDS: typeof PRESET_FIELDS = [
  { label: "Manufacturer", key: "manufacturer", type: "text", icon: Settings },
  { label: "Model", key: "instrumentModel", type: "text", icon: Microscope },
  { label: "Serial Number", key: "serialNumber", type: "text", icon: Hash },
  { label: "Installation Date", key: "installationDate", type: "date", icon: Calendar },
  { label: "Laboratory", key: "laboratoryName", type: "text", icon: LayoutGrid },
  { label: "Department", key: "department", type: "text", icon: Users },
  { label: "Location", key: "location", type: "text", icon: Tag },
  { label: "Desk", key: "desk", type: "text", icon: Tag },
  { label: "Logbook Start", key: "logbookStartDate", type: "date", icon: Calendar },
  { label: "Logbook End", key: "logbookEndDate", type: "date", icon: Calendar },
];

// Mirrors the server's slugKey so the key shown is the key that gets saved.
function fieldKeyFrom(label: string) {
  const parts = label.replace(/[^a-zA-Z0-9 _-]/g, "").trim().split(/[\s_-]+/).filter(Boolean);
  return parts.map((p, i) => (i === 0 ? p.charAt(0).toLowerCase() + p.slice(1) : p.charAt(0).toUpperCase() + p.slice(1))).join("");
}

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
  const [draftSnapshot, setDraftSnapshot] = useState("");
  const [draftError, setDraftError] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);
  const clearNotice = useCallback(() => setNotice(null), []);

  function startDraft(d: FormDraft, tab: "settings" | "fields") {
    setDraft(d);
    setDraftSnapshot(JSON.stringify(d));
    setDraftError("");
    setExpanded(null);
    setEditTab(tab);
  }
  function closeDraft() {
    if (draft && JSON.stringify(draft) !== draftSnapshot && !confirm("Discard your changes to this form?")) return;
    setDraft(null);
  }

  // Problems that would make the server silently drop or clash fields.
  const draftProblems = (() => {
    if (!draft) return [] as string[];
    const out: string[] = [];
    // Same normalising the server does, so "Sample wt" and "sampleWt" count as one key.
    const keys = draft.fields.map((f) => fieldKeyFrom(f.key || f.label));
    if (draft.fields.some((f) => !f.label.trim())) out.push("Every field needs a label.");
    const dupes = [...new Set(keys.filter((k, i) => k && keys.indexOf(k) !== i))];
    if (dupes.length) out.push(`Two fields share the key ${dupes.map((d) => `“${d}”`).join(", ")} — rename one.`);
    if (draft.fields.some((f) => f.type === "select" && !(f.options ?? []).some((o) => o.trim()))) out.push("Dropdown fields need at least one option.");
    if (draft.fields.some((f) => f.label.trim() && !fieldKeyFrom(f.key || f.label))) out.push("Field keys need at least one letter or number.");
    return out;
  })();

  // Keep each form's original index (used as its display order) while showing
  // only the forms belonging to the selected scope tab.
  const scopedForms = forms.map((f, i) => ({ f, i })).filter(({ f }) => f.scope === scopeTab);
  const scopeCount = (s: FormScope) => forms.filter((f) => f.scope === s).length;

  async function loadForms() {
    setLoading(true);
    try {
      const r = await fetch("/api/forms");
      if (r.ok) { const d = await r.json(); setForms(d.forms || []); }
    } catch {
      setNotice({ type: "error", text: "Couldn't reload forms. Refresh the page." });
    }
    setLoading(false);
  }

  // Codes must be unique and at most 12 chars.
  function freeCode(base: string) {
    const stem = base.slice(0, 10) || "LOG";
    const used = new Set(forms.map((f) => f.activityType.toUpperCase()));
    for (let n = 2; ; n++) if (!used.has(`${stem}${n}`)) return `${stem}${n}`;
  }

  // Swap with the neighbour in the same scope, then renumber every form so the
  // stored order matches what's on screen.
  async function moveForm(pos: number, dir: -1 | 1) {
    const a = scopedForms[pos], b = scopedForms[pos + dir];
    if (!a || !b || reordering) return;
    const next = [...forms];
    [next[a.i], next[b.i]] = [next[b.i], next[a.i]];
    setForms(next);
    setReordering(true);
    const results = await Promise.all(next.map((f, i) => fetch(`/api/forms?id=${encodeURIComponent(f.id)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayOrder: i }),
    }).then((r) => r.ok, () => false)));
    if (results.some((ok) => !ok)) { setNotice({ type: "error", text: "Couldn't save the new order." }); await loadForms(); }
    setReordering(false);
  }

  function openNew() {
    startDraft({ id: "", title: "", activityType: "", scope: scopeTab, displayOrder: forms.length, fields: [], isNew: true }, "settings");
  }

  function openEdit(form: FormDef, index: number) {
    startDraft({
      id: form.id, title: form.title, activityType: form.activityType,
      scope: form.scope, displayOrder: index,
      fields: form.fields.map((f) => ({ ...f })), isNew: false,
    }, "fields");
  }

  function cloneForm(form: FormDef) {
    startDraft({
      id: "", title: `${form.title} (Copy)`, activityType: freeCode(form.activityType),
      scope: form.scope, displayOrder: forms.length,
      fields: form.fields.map((f) => ({ ...f })), isNew: true,
    }, "settings");
  }

  async function saveDraft() {
    if (!draft || saving) return;
    if (draftProblems.length) { setEditTab("fields"); return; }
    setSaving(true);
    setDraftError("");
    const url = draft.isNew ? "/api/forms" : `/api/forms?id=${encodeURIComponent(draft.id)}`;
    try {
      const r = await fetch(url, {
        method: draft.isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draft.id || undefined,
          title: draft.title,
          activityType: draft.activityType,
          scope: draft.scope,
          displayOrder: draft.displayOrder,
          fields: draft.fields.map((f) => ({ ...f, key: fieldKeyFrom(f.key || f.label), options: f.options?.map((o) => o.trim()).filter(Boolean) })),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setNotice({ type: "success", text: draft.isNew ? `${draft.title} created.` : `${draft.title} saved.` }); setDraft(null); loadForms(); }
      else setDraftError(d.error || "Save failed. Check the fields.");
    } catch {
      setDraftError("Network error. Nothing was saved.");
    }
    setSaving(false);
  }

  async function removeForm(id: string) {
    if (!confirm("Delete this form? Existing records keep their data, but this log type will no longer be available for new entries.")) return;
    setDeleting(id);
    try {
      const r = await fetch(`/api/forms?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setNotice({ type: "success", text: "Form deleted." }); setDraft(null); loadForms(); }
      else if (draft) setDraftError(d.error || "Delete failed.");
      else setNotice({ type: "error", text: d.error || "Delete failed." });
    } catch {
      setNotice({ type: "error", text: "Network error. Nothing was deleted." });
    }
    setDeleting(null);
  }

  // ── Field-level edits operate on the open draft ──────────────────────────────
  function updateField(i: number, patch: Partial<FormField>) {
    setDraft((p) => p && ({ ...p, fields: p.fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)) }));
  }
  // New fields follow their label until someone edits the key by hand. Existing
  // keys are left alone: saved records store their values under them.
  function updateLabel(i: number, label: string, autoKey: boolean) {
    updateField(i, autoKey ? { label, key: fieldKeyFrom(label) } : { label });
  }
  function addField() {
    setDraft((p) => p && ({ ...p, fields: [...p.fields, { key: "", label: "", type: "text" }] }));
    setExpanded(null);
  }
  function duplicateField(i: number) {
    setDraft((p) => {
      if (!p) return p;
      const src = p.fields[i];
      const copy = { ...src, label: `${src.label} copy`, key: fieldKeyFrom(`${src.label} copy`), options: src.options && [...src.options] };
      return { ...p, fields: [...p.fields.slice(0, i + 1), copy, ...p.fields.slice(i + 1)] };
    });
  }
  function addPresetField(preset: typeof PRESET_FIELDS[0]) {
    setDraft((p) => p && ({ ...p, fields: [...p.fields, { key: preset.key, label: preset.label, type: preset.type }] }));
  }
  function removeField(i: number) {
    const f = draft?.fields[i];
    const saved = forms.find((x) => x.id === draft?.id)?.fields.some((x) => x.key === f?.key);
    if (saved && !confirm(`Remove “${f?.label}”? Old records keep the value, but it won't show on this form.`)) return;
    setDraft((p) => p && ({ ...p, fields: p.fields.filter((_, idx) => idx !== i) }));
    setExpanded(null);
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
    setExpanded((e) => (e === i ? i + dir : e === i + dir ? i : e));
  }

  const presets = draft?.scope === "instrument" ? INSTRUMENT_PRESET_FIELDS : PRESET_FIELDS;

  return (
    <div className="panel-modern">
      <TabNotice notice={notice} onClose={clearNotice} />

      <div className="um-head">
        <div>
          <h2 className="um-title">Forms</h2>
          <p className="um-sub">The fields analysts fill in for each kind of log. Changes apply to new entries.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {scopeTab === "instrument" && forms.find(f => f.id === "instrument") && (
            <button className="btn btn-outline btn-sm btn-icon-gap" type="button" onClick={() => openEdit(forms.find(f => f.id === "instrument")!, forms.findIndex(f => f.id === "instrument"))}>
              <ShieldAlert size={16} /> <span>Edit default info form</span>
            </button>
          )}
          <button className="btn btn-primary btn-sm btn-icon-gap" type="button" onClick={openNew}>
            <Plus size={16} /> <span>New form</span>
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
        <div className="um-table-wrap">
          <table className="data-table um-table">
            <thead>
              <tr>
                <th style={{ width: 56 }}><span className="sr-only">Order</span></th>
                <th>Form Title</th>
                <th>Log Type</th>
                <th>Fields</th>
                <th className="um-col-actions"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {scopedForms.length === 0 && (
                <tr><td colSpan={5} className="empty-state">No forms in this group yet. Use “New Form” to add one.</td></tr>
              )}
              {scopedForms.map(({ f, i }, pos) => (
                <tr key={f.id} className={f.id === "instrument" ? "row-highlight" : ""}>
                  <td>
                    <div className="inst-order">
                      <button type="button" disabled={pos === 0 || reordering} onClick={() => moveForm(pos, -1)} title="Move up" aria-label={`Move ${f.title} up`}><ChevronDown size={13} style={{ transform: "rotate(180deg)" }} /></button>
                      <button type="button" disabled={pos === scopedForms.length - 1 || reordering} onClick={() => moveForm(pos, 1)} title="Move down" aria-label={`Move ${f.title} down`}><ChevronDown size={13} /></button>
                    </div>
                  </td>
                  <td style={{ fontWeight: 800, color: 'var(--primary)' }}>
                    {f.title}
                    {f.id === "instrument" && <span className="badge-system-default">SYSTEM DEFAULT</span>}
                  </td>
                  <td className="mono" style={{ fontSize: 13 }}>{f.activityType}</td>
                  <td className="um-muted">{f.fields.length} field{f.fields.length === 1 ? "" : "s"}{f.fields.some((x) => x.required) ? ` · ${f.fields.filter((x) => x.required).length} required` : ""}</td>
                  <td className="um-col-actions">
                    <div className="um-row-actions">
                      <button className="btn btn-outline btn-sm btn-icon-gap" type="button" onClick={() => openEdit(f, i)}><Pencil size={14} /> <span>Edit fields</span></button>
                      <button className="btn btn-ghost btn-sm btn-icon-only" type="button" onClick={() => cloneForm(f)} title="Duplicate" aria-label={`Duplicate ${f.title}`}><FileOutput size={15} /></button>
                      <button className="btn btn-ghost btn-sm btn-icon-only um-danger" type="button" disabled={deleting === f.id || f.id === "instrument"} onClick={() => removeForm(f.id)} title={f.id === "instrument" ? "The default form can't be deleted" : "Delete"} aria-label={`Delete ${f.title}`}>
                        <Trash2 size={15} />
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
        <ModalShell open onClose={closeDraft} closeOnOverlayClick={false} className="modal shadow-3 modal-w-3xl modal-tall modal-tall-xl" labelledBy="form-builder-title">
          <div className="modal-header">
            <h2 className="modal-title" id="form-builder-title">{draft.isNew ? "New form" : `Edit ${draft.title || draft.id}`}</h2>
            <button className="btn btn-ghost btn-sm" type="button" onClick={closeDraft} aria-label="Close">✕</button>
          </div>
          
          <div className="edit-mode-tabs">
            <button className={`edit-mode-tab ${editTab === "settings" ? "active" : ""}`} onClick={() => setEditTab("settings")}>
              <Settings size={16} /> <span>1. Name &amp; type</span>
            </button>
            <button className={`edit-mode-tab ${editTab === "fields" ? "active" : ""}`} onClick={() => setEditTab("fields")}>
              <TableIcon size={16} /> <span>2. Fields</span>{draftProblems.length > 0 && <AlertTriangle size={14} className="tone-amber" />}
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
                    <input value={draft.activityType} maxLength={12}
                      onChange={(e) => setDraft((p) => p && ({ ...p, activityType: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") }))}
                      placeholder="e.g. OP" style={{ textTransform: "uppercase" }} />
                    <span className="um-hint">
                      {!draft.isNew && draft.activityType !== forms.find((f) => f.id === draft.id)?.activityType
                        ? "Records already saved keep the old code and won't show under this form."
                        : "Short unique code stored on each record, e.g. OP, CAL, MAINT."}
                    </span>
                  </div>
                  <div className="field">
                    <label className="field-label">Scope</label>
                    <select value={draft.scope} onChange={(e) => setDraft((p) => p && ({ ...p, scope: e.target.value as FormScope }))}>
                      <option value="analytical">Analytical instrument</option>
                      <option value="sample">Sample preparation</option>
                      <option value="instrument">Instrument metadata</option>
                    </select>
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
                      <p className="sidebar-label">Quick add</p>
                      <div className="fb-presets">
                        {presets.map((preset) => {
                          const used = draft.fields.some((f) => f.key === preset.key);
                          return (
                            <button key={preset.key} type="button" className="fb-preset" disabled={used} onClick={() => addPresetField(preset)} title={used ? "Already on this form" : `Add ${preset.label}`}>
                              <preset.icon size={14} /> <span>{preset.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="field-editor-main">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <h3 style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>Field Designer</h3>
                        <button className="btn btn-primary btn-sm btn-icon-gap" type="button" onClick={addField}><Plus size={14} /> <span>Add field</span></button>
                      </div>
                      {draftProblems.length > 0 && (
                        <div className="wpa-missing" role="alert"><AlertTriangle size={16} /><span>{draftProblems.join(" ")}</span></div>
                      )}

                      <div className="table-scroll-designer">
                        <table className="field-editor-table">
                          <thead>
                            <tr>
                              <th style={{ width: 40 }}></th>
                              <th>Label</th>
                              <th title="Internal name records use to store this value">Key</th>
                              <th style={{ width: 120 }}>Type</th>
                              <th style={{ width: 60, textAlign: 'center' }}>Full</th>
                              <th style={{ width: 60, textAlign: 'center' }}>Req</th>
                              <th style={{ width: 104 }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {draft.fields.length === 0 && (
                              <tr>
                                <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                                  No fields yet. Pick one from Quick add or press “Add field”.
                                </td>
                              </tr>
                            )}
                            {draft.fields.map((f, i) => {
                              const savedKeys = forms.find((x) => x.id === draft.id)?.fields.map((x) => x.key) ?? [];
                              const autoKey = !savedKeys.includes(f.key) && (!f.key || f.key === fieldKeyFrom(f.label));
                              return (<Fragment key={i}>
                              <tr>
                                <td className="field-reorder-btns">
                                  <button type="button" disabled={i === 0} onClick={() => moveField(i, -1)}><ChevronDown size={14} style={{ transform: 'rotate(180deg)' }} /></button>
                                  <button type="button" disabled={i === draft.fields.length - 1} onClick={() => moveField(i, 1)}><ChevronDown size={14} /></button>
                                </td>
                                <td><input className="table-input" value={f.label} onChange={(e) => updateLabel(i, e.target.value, autoKey)} placeholder="e.g. Sample weight" aria-invalid={!f.label.trim()} autoFocus={!f.label && i === draft.fields.length - 1} /></td>
                                <td><input className="table-input mono" value={f.key} onChange={(e) => updateField(i, { key: e.target.value })} onBlur={() => f.key && updateField(i, { key: fieldKeyFrom(f.key) })} placeholder="auto" style={{ fontSize: 12 }} title={savedKeys.includes(f.key) ? "Changing this hides values already saved under the old key" : undefined} /></td>
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
                                  <div className="fb-row-actions">
                                    <button className="btn-table-icon" type="button" onClick={() => setExpanded(expanded === i ? null : i)} title="More settings" aria-label={`More settings for ${f.label || "field"}`} aria-expanded={expanded === i}><Settings size={14} /></button>
                                    <button className="btn-table-icon" type="button" onClick={() => duplicateField(i)} title="Duplicate field" aria-label={`Duplicate ${f.label || "field"}`}><FileOutput size={14} /></button>
                                    <button className="btn-table-danger" type="button" onClick={() => removeField(i)} title="Remove field" aria-label={`Remove ${f.label || "field"}`}><Trash2 size={14} /></button>
                                  </div>
                                </td>
                              </tr>
                              {(f.type === "select" || expanded === i) && (
                                <tr className="fb-options-row">
                                  <td />
                                  <td colSpan={6}>
                                    {f.type === "select" && (
                                      <label className="fb-options">
                                        <span>Options</span>
                                        <input className="table-input" value={(f.options ?? []).join(", ")}
                                          onChange={(e) => updateField(i, { options: e.target.value.split(",").map((o) => o.trimStart()) })}
                                          onBlur={() => updateField(i, { options: (f.options ?? []).map((o) => o.trim()).filter(Boolean) })}
                                          placeholder="Comma separated, e.g. Pass, Fail, Retest" aria-invalid={!(f.options ?? []).some((o) => o.trim())} />
                                      </label>
                                    )}
                                    {expanded === i && (
                                      <label className="fb-options">
                                        <span>Hint</span>
                                        <input className="table-input" value={f.placeholder ?? ""} onChange={(e) => updateField(i, { placeholder: e.target.value })}
                                          placeholder="Grey text shown in the empty box, e.g. mg/L" />
                                      </label>
                                    )}
                                  </td>
                                </tr>
                              )}
                              </Fragment>);
                            })}
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
                                {f.type === "textarea" ? "Long text…" : f.type === "select" ? ((f.options ?? []).filter(Boolean).join(" / ") || "Choose…") : f.placeholder || "—"}
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

          {draftError && <div className="wpa-missing" role="alert" style={{ margin: "0 20px 12px" }}><AlertTriangle size={16} /><span>{draftError}</span></div>}
          <div className="modal-footer" style={{ justifyContent: "space-between" }}>
            <div>
              {editTab === "fields" && (
                <button className="btn btn-ghost btn-sm btn-icon-gap" onClick={() => setEditTab("settings")}>
                  <ArrowLeft size={16} /> <span>Name &amp; type</span>
                </button>
              )}
              {editTab === "settings" && !draft.isNew && (
                <button className="btn btn-danger btn-sm btn-icon-gap" type="button" disabled={deleting === draft.id || draft.id === "instrument"} onClick={() => removeForm(draft.id)}>
                  <Trash2 size={16} /> <span>Delete Form</span>
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-outline btn-sm" type="button" onClick={closeDraft}>Cancel</button>
              {editTab === "settings" && draft.isNew ? (
                <button className="btn btn-primary btn-sm btn-icon-gap" type="button" onClick={() => setEditTab("fields")} disabled={!draft.title.trim() || !draft.activityType.trim()}>
                  <span>Next: fields</span> <ChevronDown size={16} style={{ transform: 'rotate(-90deg)' }} />
                </button>
              ) : (
                <button className="btn btn-primary btn-sm btn-icon-gap" type="button" disabled={saving || !draft.title.trim() || !draft.activityType.trim() || draftProblems.length > 0} onClick={saveDraft} title={draftProblems[0]}>
                  {saving ? "Saving…" : draft.isNew ? <><Plus size={16} /> <span>Create Form</span></> : <><CheckCircle2 size={16} /> <span>Save Changes</span></>}
                </button>
              )}
            </div>
          </div>
        </ModalShell>
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
      {/* Data: URL from the record — see the note on the table cell above. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={signature.image} alt="Analyst signature" className="sig-image-small" />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Tab — Weekly Plans (every analyst's plan vs achievement)
   ════════════════════════════════════════════════════════════════════════════ */

function wpColor(pct: number) {
  return pct >= 90 ? "var(--success)" : pct >= 50 ? "var(--tertiary)" : "var(--primary)";
}

function WeeklyReportsTab() {
  const [plans, setPlans] = useState<WeeklyPlan[]>([]);
  const [people, setPeople] = useState<ProfilePublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [week, setWeek] = useState<string>(() => mondayOf());
  const [allWeeks, setAllWeeks] = useState(false);
  const [who, setWho] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/weekly-plan").then((r) => (r.ok ? r.json() : { plans: [] })).catch(() => ({ plans: [] })),
      fetch("/api/users").then((r) => (r.ok ? r.json() : { profiles: [] })).catch(() => ({ profiles: [] })),
    ]).then(([p, u]) => {
      const list = ((p.plans as WeeklyPlan[]) || []).filter((x) => x.tasks.length > 0);
      setPlans(list);
      setPeople((u.profiles as ProfilePublic[]) || []);
      // Open on the latest week anyone has filled, if this week is still empty.
      const thisWeek = mondayOf();
      if (!list.some((x) => x.weekStartDate === thisWeek) && list.length) {
        setWeek(list.map((x) => x.weekStartDate).sort().reverse()[0]);
      }
    }).finally(() => setLoading(false));
  }, []);

  const nameOf = (username: string) => people.find((p) => p.username === username)?.fullName || username;
  const analysts = people.filter((p) => !p.archived && p.role === "analyst");
  const everyone = [...new Set([...analysts.map((p) => p.username), ...plans.map((p) => p.username)])].sort();

  const rows = plans
    .filter((p) => allWeeks || p.weekStartDate === week)
    .filter((p) => !who || p.username === who)
    .sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate) || nameOf(a.username).localeCompare(nameOf(b.username)));

  const weekPlans = plans.filter((p) => p.weekStartDate === week);
  const missing = analysts.filter((a) => !weekPlans.some((p) => p.username === a.username));
  const avg = rows.length ? rows.reduce((s, p) => s + planStats(p.tasks).achievement, 0) / rows.length : 0;
  const hours = rows.reduce((s, p) => s + planStats(p.tasks).totalHours, 0);

  async function exportRows(list: WeeklyPlan[], tag: string) {
    if (list.length === 0) return;
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const used = new Set<string>();
    if (list.length > 1) {
      const { summary, detail } = summarySheets(XLSX, list, nameOf);
      XLSX.utils.book_append_sheet(wb, summary, sheetName("Summary", used));
      XLSX.utils.book_append_sheet(wb, detail, sheetName("All tasks", used));
    }
    for (const p of list) {
      XLSX.utils.book_append_sheet(wb, templateSheet(XLSX, p, nameOf(p.username)), sheetName(`${p.username} ${p.weekStartDate}`, used));
    }
    XLSX.writeFile(wb, `weekly_plans_${fileSafe(tag)}.xlsx`);
  }

  if (loading) return <div className="skeleton" style={{ height: 360, borderRadius: 12 }} />;

  const exportTag = `${who || "all"}_${allWeeks ? "all-weeks" : week}`;

  return (
    <div className="wp-admin">
      <div className="wp-admin-head">
        <div>
          <h2 className="wp-admin-title">Weekly Plans</h2>
          <p className="wp-admin-sub">What each analyst planned and how much they achieved.</p>
        </div>
        <button className="btn btn-primary btn-sm btn-icon-gap" onClick={() => exportRows(rows, exportTag)} disabled={rows.length === 0}>
          <FileSpreadsheet size={16} /> <span>Export {rows.length > 0 ? `(${rows.length})` : ""}</span>
        </button>
      </div>

      <div className="wpa-toolbar">
        <div className={`wp-weeknav ${allWeeks ? "is-off" : ""}`} role="group" aria-label="Week">
          <button type="button" className="wp-weeknav-btn" disabled={allWeeks} onClick={() => setWeek(addWeeks(week, -1))} aria-label="Previous week"><ChevronLeft size={18} /></button>
          <label className="wp-weeknav-label">
            <Calendar size={16} />
            <span><small>Week of</small>{weekLabel(week)}</span>
            <input type="date" value={week} disabled={allWeeks} aria-label="Pick a week" onChange={(e) => e.target.value && setWeek(mondayOf(e.target.value))} />
          </label>
          <button type="button" className="wp-weeknav-btn" disabled={allWeeks} onClick={() => setWeek(addWeeks(week, 1))} aria-label="Next week"><ChevronRight size={18} /></button>
        </div>
        <label className="wpa-check">
          <input type="checkbox" checked={allWeeks} onChange={(e) => setAllWeeks(e.target.checked)} /> All weeks
        </label>
        <select className="input-modern wpa-select" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Analyst">
          <option value="">Everyone</option>
          {everyone.map((u) => <option key={u} value={u}>{nameOf(u)}{nameOf(u) !== u ? ` (${u})` : ""}</option>)}
        </select>
      </div>

      <div className="um-stats">
        {!allWeeks && !who && (
          <div className="um-stat">
            <span className="um-stat-icon"><UserCheck size={18} /></span>
            <span className="um-stat-value">{analysts.length - missing.length}<small className="wpa-of">/{analysts.length}</small></span>
            <span className="um-stat-label">Submitted</span>
          </div>
        )}
        <div className="um-stat">
          <span className="um-stat-icon"><TrendingUp size={18} /></span>
          <span className="um-stat-value" style={{ color: rows.length ? wpColor(avg) : undefined }}>{rows.length ? `${avg.toFixed(0)}%` : "—"}</span>
          <span className="um-stat-label">Avg achievement</span>
        </div>
        <div className="um-stat">
          <span className="um-stat-icon"><Clock size={18} /></span>
          <span className="um-stat-value">{hours}</span>
          <span className="um-stat-label">Planned hours</span>
        </div>
        <div className="um-stat">
          <span className="um-stat-icon"><FileText size={18} /></span>
          <span className="um-stat-value">{rows.length}</span>
          <span className="um-stat-label">Plans shown</span>
        </div>
      </div>

      {!allWeeks && !who && missing.length > 0 && (
        <div className="wpa-missing">
          <AlertTriangle size={16} />
          <span><strong>No plan yet:</strong> {missing.map((m) => m.fullName || m.username).join(", ")}</span>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="empty-state-modern" style={{ padding: 40 }}>
          <div className="empty-icon-wrap"><Calendar size={36} /></div>
          <p>{allWeeks ? "No weekly plans saved yet." : `No plans for ${weekLabel(week)}.`}</p>
        </div>
      ) : (
        <div className="wp-admin-list">
          {rows.map((plan) => {
            const s = planStats(plan.tasks);
            const rating = performanceRating(s.achievement, s.taskCount > 0);
            const color = wpColor(s.achievement);
            const key = `${plan.username}:${plan.weekStartDate}`;
            const open = expanded === key;
            return (
              <div key={key} className={`wp-admin-card ${open ? "open" : ""}`}>
                <div className="wp-admin-row-wrap">
                  <button type="button" className="wp-admin-row" onClick={() => setExpanded(open ? null : key)} aria-expanded={open}>
                    <ChevronRight size={16} className={`wp-admin-caret ${open ? "open" : ""}`} />
                    <UserAvatar name={plan.username} seed={people.find((p) => p.username === plan.username)?.id} size="sm" />
                    <div className="wp-admin-who">
                      <strong>{nameOf(plan.username)}</strong>
                      <span>{allWeeks ? weekLabel(plan.weekStartDate) : `@${plan.username}`}</span>
                    </div>
                    <div className="wp-admin-meta">
                      <span><Clock size={13} /> {s.totalHours} h</span>
                      <span><CheckCircle2 size={13} /> {s.completed}/{s.taskCount} done</span>
                      <span className={`wpa-rating wpa-rating-${rating.tone}`}>{rating.label}</span>
                    </div>
                    <div className="wp-admin-ach">
                      <div className="wp-progress" style={{ width: 110 }}>
                        <span style={{ width: `${Math.min(s.achievement, 100)}%`, background: color }} />
                      </div>
                      <strong style={{ color }}>{s.achievement.toFixed(1)}%</strong>
                    </div>
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm btn-icon-only" title="Export this plan (official template)" aria-label="Export this plan"
                    onClick={() => exportRows([plan], `${plan.username}_${plan.weekStartDate}`)}>
                    <Download size={15} />
                  </button>
                </div>

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
                          <td className="wp-calc wp-calc-strong">{s.totalAchWeight.toFixed(3)}</td>
                        </tr>
                      </tfoot>
                    </table>
                    {plan.updatedAt && (
                      <p className="wp-admin-updated">Last saved {new Date(plan.updatedAt).toLocaleString()}</p>
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
