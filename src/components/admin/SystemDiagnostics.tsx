import React, { useState, useEffect } from 'react';
import {
  Database,
  Play,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Server,
  Globe,
  Cpu,
  Zap,
  Layers,
  Terminal,
  FileCheck2,
  ShieldAlert,
  UploadCloud,
  Gauge,
} from 'lucide-react';
import { safeFetchJson } from '../../utils/safeFetch.ts';
import { formatKarachiDateTime } from '../../utils/dateTime.ts';
import { getSupabaseClient, isBrowserSupabaseConfigured } from '../../lib/supabaseClient.ts';

function sanitizeDiagText(raw: string): string {
  return String(raw || '')
    .replace(/sb_secret_[A-Za-z0-9\-_]+/g, '[REDACTED_SB_SECRET]')
    .replace(/sb_publishable_[A-Za-z0-9\-_]+/g, '[REDACTED_SB_PUBLISHABLE]')
    .replace(/eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g, '[REDACTED_JWT]')
    .replace(/Bearer\s+[A-Za-z0-9\-_.]+/gi, 'Bearer [REDACTED]')
    .replace(/(apikey|token|secret|password|key)=([^&\s]+)/gi, '$1=[REDACTED]');
}

type DiagTab =
  | 'supabase'
  | 'database_audit'
  | 'performance'
  | 'save_diagnostics'
  | 'database'
  | 'publishing'
  | 'persistence'
  | 'public_api'
  | 'gemini'
  | 'cache'
  | 'deployment'
  | 'errors'
  | 'collections';

const DIAG_TABS: { id: DiagTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'supabase', label: 'Supabase Database', icon: Database },
  { id: 'database_audit', label: 'Database Audit', icon: ShieldAlert },
  { id: 'performance', label: 'Performance & Web Vitals', icon: Gauge },
  { id: 'save_diagnostics', label: 'Save Diagnostics', icon: FileCheck2 },
  { id: 'database', label: 'Firebase Health', icon: Server },
  { id: 'publishing', label: 'Publishing Pipeline', icon: Zap },
  { id: 'persistence', label: 'Article Persistence', icon: Layers },
  { id: 'public_api', label: 'Public API', icon: Globe },
  { id: 'gemini', label: 'Gemini API', icon: Cpu },
  { id: 'cache', label: 'Frontend Cache', icon: RefreshCw },
  { id: 'deployment', label: 'Deployment Version', icon: Server },
  { id: 'errors', label: 'Error Logs', icon: Terminal },
  { id: 'collections', label: 'Collections & Rules', icon: FileCheck2 },
];

export const SystemDiagnostics: React.FC<{ initialTab?: DiagTab }> = ({ initialTab }) => {
  const [activeTab, setActiveTab] = useState<DiagTab>(initialTab || 'supabase');
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionBanner, setActionBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [supabaseHealth, setSupabaseHealth] = useState<any>(null);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  const [dbAuditReport, setDbAuditReport] = useState<any>(null);
  const [dbAuditError, setDbAuditError] = useState<string | null>(null);
  const [browserSdkReport, setBrowserSdkReport] = useState<{
    configured: boolean;
    publicReadOk: boolean | null;
    publicReadCount: number | null;
    draftRlsBlocked: boolean | null;
    anonWriteBlocked: boolean | null;
    latencyMs: number | null;
    detail: string;
  } | null>(null);
  const [dbHealth, setDbHealth] = useState<any>(null);
  const [pubHealth, setPubHealth] = useState<any>(null);
  const [pipelineResult, setPipelineResult] = useState<any>(null);
  const [adminArticles, setAdminArticles] = useState<any[]>([]);
  const [publicFeed, setPublicFeed] = useState<any>(null);
  const [geminiDiag, setGeminiDiag] = useState<any>(null);
  const [cacheStatus, setCacheStatus] = useState<any>(null);
  const [deploymentInfo, setDeploymentInfo] = useState<any>(null);
  const [errorLogs, setErrorLogs] = useState<any[]>([]);
  const [collectionsInfo, setCollectionsInfo] = useState<any>(null);
  const [saveDiagnosticsList, setSaveDiagnosticsList] = useState<any[]>([]);
  const [storageHealth, setStorageHealth] = useState<any>(null);
  const [perfReport, setPerfReport] = useState<any>(null);
  const [rtDiscoveryMs, setRtDiscoveryMs] = useState<number>(12000);
  const [rtGenerationMs, setRtGenerationMs] = useState<number>(45000);
  const [rtInferenceMs, setRtInferenceMs] = useState<number>(50000);
  const [rtSyncIntervalMin, setRtSyncIntervalMin] = useState<number>(30);

  const runBrowserSupabaseSdkProbe = async () => {
    if (!isBrowserSupabaseConfigured()) {
      setBrowserSdkReport({
        configured: false,
        publicReadOk: null,
        publicReadCount: null,
        draftRlsBlocked: null,
        anonWriteBlocked: null,
        latencyMs: null,
        detail: 'VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are not set in client bundle; browser SDK probe skipped (server-side SDK handles private operations).',
      });
      return;
    }

    const client = getSupabaseClient();
    if (!client) return;
    const t0 = performance.now();
    try {
      const pubRes = await client
        .from('articles')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'published')
        .is('deleted_at', null);

      const draftRes = await client.from('articles').select('id').eq('status', 'draft').limit(1);
      const writeRes = await client.from('articles').insert({
        id: `client-rls-probe-${Date.now()}`,
        slug: `client-rls-probe-${Date.now()}`,
        title_en: 'Client SDK Write Probe',
        status: 'draft',
      });

      const publicReadOk = !pubRes.error;
      const draftRlsBlocked = Boolean(draftRes.error) || !draftRes.data || draftRes.data.length === 0;
      const anonWriteBlocked = Boolean(writeRes.error);
      setBrowserSdkReport({
        configured: true,
        publicReadOk,
        publicReadCount: typeof pubRes.count === 'number' ? pubRes.count : 0,
        draftRlsBlocked,
        anonWriteBlocked,
        latencyMs: Math.round(performance.now() - t0),
        detail: publicReadOk
          ? `Browser @supabase/supabase-js read verified (${pubRes.count ?? 0} published). RLS: draftsBlocked=${draftRlsBlocked}, anonWriteBlocked=${anonWriteBlocked}.`
          : `Browser SDK read error: ${sanitizeDiagText(pubRes.error?.message || 'Unknown error')}`,
      });
    } catch (err: any) {
      setBrowserSdkReport({
        configured: true,
        publicReadOk: false,
        publicReadCount: null,
        draftRlsBlocked: null,
        anonWriteBlocked: null,
        latencyMs: Math.round(performance.now() - t0),
        detail: sanitizeDiagText(err?.message || 'Browser Supabase SDK probe failed.'),
      });
    }
  };

  const loadTab = async (tab: DiagTab) => {
    setLoading(true);
    try {
      switch (tab) {
        case 'supabase': {
          setSupabaseError(null);
          const [res, storRes, settingsRes] = await Promise.all([
            safeFetchJson('/api/v1/admin/system/supabase-health', { credentials: 'include' }),
            safeFetchJson('/api/v1/admin/system/storage-health', { credentials: 'include' }).catch(() => null),
            safeFetchJson('/api/settings', { credentials: 'include' }).catch(() => null),
            runBrowserSupabaseSdkProbe(),
          ]);
          if (res.success && res.report) {
            setSupabaseHealth(res.report);
          } else {
            setSupabaseError(res.error || 'Unable to retrieve Supabase diagnostics.');
          }
          if (storRes?.success) setStorageHealth(storRes);
          if (settingsRes?.success && settingsRes.settings?.runtimeDiagnostics) {
            const rt = settingsRes.settings.runtimeDiagnostics;
            if (rt.aiDiscoveryTimeoutMs) setRtDiscoveryMs(rt.aiDiscoveryTimeoutMs);
            if (rt.aiGenerationTimeoutMs) setRtGenerationMs(rt.aiGenerationTimeoutMs);
            if (rt.aiInferenceTimeoutMs) setRtInferenceMs(rt.aiInferenceTimeoutMs);
            if (rt.syncDefaultIntervalMinutes) setRtSyncIntervalMin(rt.syncDefaultIntervalMinutes);
          }
          break;
        }
        case 'database_audit': {
          setDbAuditError(null);
          const auditRes = await safeFetchJson('/api/v1/admin/system/database-audit', {
            credentials: 'include',
          });
          if (auditRes.success && auditRes.report) {
            setDbAuditReport(auditRes.report);
          } else {
            setDbAuditError(auditRes.error || 'Super Admin privileges required or database audit unavailable.');
          }
          break;
        }
        case 'performance': {
          const perfRes = await safeFetchJson('/api/v1/admin/system/performance', {
            credentials: 'include',
          });
          if (perfRes.success) {
            setPerfReport(perfRes);
          }
          break;
        }
        case 'save_diagnostics': {
          const [diagRes, storRes] = await Promise.all([
            safeFetchJson('/api/v1/admin/system/save-diagnostics?limit=100', { credentials: 'include' }),
            safeFetchJson('/api/v1/admin/system/storage-health', { credentials: 'include' }).catch(() => null),
          ]);
          if (diagRes.success) setSaveDiagnosticsList(diagRes.diagnostics || []);
          if (storRes?.success) setStorageHealth(storRes);
          break;
        }
        case 'database': {
          const res = await safeFetchJson('/api/v1/admin/system/database-health', { credentials: 'include' });
          if (res.success) setDbHealth(res.report);
          break;
        }
        case 'publishing': {
          const res = await safeFetchJson('/api/v1/admin/system/publishing-health', { credentials: 'include' });
          if (res.success) setPubHealth(res);
          break;
        }
        case 'persistence': {
          const res = await safeFetchJson('/api/v1/admin/articles?status=all', { credentials: 'include' });
          if (res.success) setAdminArticles(res.articles || []);
          break;
        }
        case 'public_api': {
          const t0 = performance.now();
          const res = await safeFetchJson('/api/v1/news?limit=6');
          const latencyMs = Math.round(performance.now() - t0);
          setPublicFeed({ ...res, measuredLatencyMs: latencyMs });
          break;
        }
        case 'gemini': {
          const [diagRes, provRes, statusRes] = await Promise.all([
            safeFetchJson('/api/v1/admin/ai/diagnostics', { credentials: 'include' }),
            safeFetchJson('/api/v1/admin/ai/providers', { credentials: 'include' }),
            safeFetchJson('/api/v1/admin/ai/connection-status', { credentials: 'include' }),
          ]);
          setGeminiDiag({ diagnostics: diagRes, providers: provRes.providers || [], connectionStatus: statusRes });
          break;
        }
        case 'cache': {
          const res = await safeFetchJson('/api/v1/admin/system/cache-status', { credentials: 'include' });
          if (res.success) setCacheStatus(res.cache);
          break;
        }
        case 'deployment': {
          const res = await safeFetchJson('/api/v1/admin/system/deployment', { credentials: 'include' });
          if (res.success) setDeploymentInfo(res.deployment);
          break;
        }
        case 'errors': {
          const res = await safeFetchJson('/api/v1/admin/system/error-logs?limit=100', { credentials: 'include' });
          if (res.success) setErrorLogs(res.logs || []);
          break;
        }
        case 'collections': {
          const res = await safeFetchJson('/api/v1/admin/system/firebase-collections', { credentials: 'include' });
          if (res.success) setCollectionsInfo(res);
          break;
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTab(activeTab);
  }, [activeTab]);

  const handleRunPipelineTest = async () => {
    setActionBusy(true);
    setActionBanner(null);
    try {
      const res = await safeFetchJson('/api/v1/admin/system/test-publishing-pipeline', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.result) setPipelineResult(res.result);
      setActionBanner({
        type: res.success ? 'success' : 'error',
        text: res.success
          ? `Firestore publishing pipeline self-test passed in ${res.result?.totalDurationMs}ms (temporary probe cleaned up).`
          : res.error || 'Publishing pipeline self-test encountered an error.',
      });
      await loadTab('publishing');
    } finally {
      setActionBusy(false);
    }
  };

  const handleTestSupabase = async () => {
    setActionBusy(true);
    setActionBanner(null);
    setSupabaseError(null);
    try {
      const [res] = await Promise.all([
        safeFetchJson('/api/v1/admin/system/supabase-test', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        }),
        runBrowserSupabaseSdkProbe(),
      ]);
      if (res.report) setSupabaseHealth(res.report);
      else if (!res.success) setSupabaseError(res.error || 'Supabase connection test failed.');
      setActionBanner({
        type: res.success ? 'success' : 'error',
        text: res.success
          ? `Supabase PostgreSQL connection, RLS isolation, and authorized write test verified (${res.report?.latencyMs}ms).`
          : res.error || 'Supabase connection or write test failed.',
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleRunCompleteDatabaseAudit = async () => {
    setActionBusy(true);
    setActionBanner(null);
    setDbAuditError(null);
    try {
      const res = await safeFetchJson('/api/v1/admin/system/database-audit', {
        method: 'GET',
        credentials: 'include',
      });
      if (res.success && res.report) {
        setDbAuditReport(res.report);
        setActionBanner({
          type: res.report.overallStatus === 'FAIL' ? 'error' : 'success',
          text: `Complete Database Audit finished (${res.report.overallStatus}): ${res.report.summary?.passed || 0} passed, ${res.report.summary?.warnings || 0} warnings, ${res.report.summary?.failed || 0} failed.`,
        });
      } else {
        const msg = res.error || 'Complete Database Audit failed.';
        setDbAuditError(msg);
        setActionBanner({ type: 'error', text: msg });
      }
    } finally {
      setActionBusy(false);
    }
  };

  const handleSaveRuntimeSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionBusy(true);
    setActionBanner(null);
    try {
      const res = await safeFetchJson('/api/v1/admin/system/runtime-settings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aiDiscoveryTimeoutMs: rtDiscoveryMs,
          aiGenerationTimeoutMs: rtGenerationMs,
          aiInferenceTimeoutMs: rtInferenceMs,
          syncDefaultIntervalMinutes: rtSyncIntervalMin,
        }),
      });
      setActionBanner({
        type: res.success ? 'success' : 'error',
        text: res.success
          ? `Runtime diagnostic timeouts saved (${rtDiscoveryMs}ms discovery / ${rtGenerationMs}ms generation / ${rtInferenceMs}ms inference).`
          : res.error || 'Failed updating runtime settings.',
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleRunFirestoreProbe = async () => {
    setActionBusy(true);
    setActionBanner(null);
    try {
      const res = await safeFetchJson('/api/v1/admin/system/firebase/test-probe', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.report) setDbHealth(res.report);
      setActionBanner({
        type: res.success ? 'success' : 'error',
        text: res.success
          ? 'Cloud Firestore /test/connection probe verified (admin write + server read succeeded).'
          : res.error || 'Firestore probe write failed — check admin sign-in or service account permissions.',
      });
      if (activeTab === 'collections') await loadTab('collections');
      else await loadTab('database');
    } finally {
      setActionBusy(false);
    }
  };

  const handleSyncArticlesToFirestore = async () => {
    setActionBusy(true);
    setActionBanner(null);
    try {
      const res = await safeFetchJson('/api/v1/admin/system/firebase/sync-articles', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      setActionBanner({
        type: res.success ? 'success' : 'error',
        text: res.success
          ? `Firestore article sync completed: ${res.seededCount || 0} synced, ${res.skippedCount || 0} already present.`
          : res.error || 'Could not sync articles to Cloud Firestore.',
      });
      try {
        window.dispatchEvent(new CustomEvent('360kn:articles-updated'));
      } catch {}
      await loadTab(activeTab);
    } finally {
      setActionBusy(false);
    }
  };

  const handleInvalidateCache = async () => {
    setActionBusy(true);
    setActionBanner(null);
    try {
      const res = await safeFetchJson('/api/v1/admin/system/cache-invalidate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.success) {
        setActionBanner({
          type: 'success',
          text: `Public feed cache version incremented to v${res.version}.`,
        });
        try {
          window.dispatchEvent(new CustomEvent('360kn:articles-updated'));
          const bc = new BroadcastChannel('360kn-sync');
          bc.postMessage({ type: 'articles-updated' });
          bc.close();
        } catch {}
        await loadTab('cache');
      } else {
        setActionBanner({ type: 'error', text: res.error || 'Cache invalidation failed.' });
      }
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="space-y-4 text-xs">
      <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-gray-900">System &amp; Database Diagnostics Console</h2>
          <p className="text-gray-500">
            Official Supabase SDK &amp; Cloud Firestore verification: connectivity, RLS policies, articles table permissions, publishing &amp; AI status.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadTab(activeTab)}
          disabled={loading}
          className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-lg inline-flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Current Check</span>
        </button>
      </div>

      {/* Diagnostic Tabs */}
      <div className="flex flex-wrap gap-1.5 bg-white border border-gray-200 rounded-xl p-2">
        {DIAG_TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 rounded-lg font-bold inline-flex items-center gap-1.5 transition-colors ${
                active ? 'bg-emerald-700 text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {actionBanner && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-2 font-semibold ${
            actionBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          {actionBanner.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{actionBanner.text}</span>
        </div>
      )}

      {/* TAB: DATABASE AUDIT (A-TO-Z SUPABASE SCHEMA & RLS) */}
      {activeTab === 'database_audit' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <div>
              <h3 className="font-black text-gray-900 text-sm">Complete A-to-Z Supabase Database &amp; RLS Audit</h3>
              <p className="text-gray-500">
                Read-only verification of all {dbAuditReport?.tables?.length || 31} PostgreSQL tables, reconciled columns, migration ledger, RLS isolation, and secrets redaction.
              </p>
            </div>
            <button
              type="button"
              disabled={actionBusy || loading}
              onClick={handleRunCompleteDatabaseAudit}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-lg inline-flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{actionBusy || loading ? 'Running Audit...' : 'Run Complete Database Audit'}</span>
            </button>
          </div>

          {dbAuditError && (
            <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 font-semibold">
              {dbAuditError}
            </div>
          )}

          {dbAuditReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="p-3 bg-gray-50 border rounded-xl">
                  <div className="text-[10px] font-bold uppercase text-gray-500">Overall Status</div>
                  <div
                    className={`text-lg font-black font-mono mt-1 ${
                      dbAuditReport.overallStatus === 'PASS'
                        ? 'text-emerald-700'
                        : dbAuditReport.overallStatus === 'WARN'
                        ? 'text-amber-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {dbAuditReport.overallStatus}
                  </div>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="text-[10px] font-bold uppercase text-emerald-700">Checks Passed</div>
                  <div className="text-lg font-black font-mono text-emerald-800 mt-1">
                    {dbAuditReport.summary?.passed ?? 0} / {dbAuditReport.summary?.totalChecks ?? 0}
                  </div>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="text-[10px] font-bold uppercase text-amber-700">Warnings</div>
                  <div className="text-lg font-black font-mono text-amber-800 mt-1">
                    {dbAuditReport.summary?.warnings ?? 0}
                  </div>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                  <div className="text-[10px] font-bold uppercase text-rose-700">Failures</div>
                  <div className="text-lg font-black font-mono text-rose-800 mt-1">
                    {dbAuditReport.summary?.failed ?? 0}
                  </div>
                </div>
                <div className="p-3 bg-gray-50 border rounded-xl">
                  <div className="text-[10px] font-bold uppercase text-gray-500">Runtime / Host</div>
                  <div className="font-mono font-bold text-gray-800 truncate mt-1">
                    {dbAuditReport.environment?.projectHost || 'Unconfigured'}
                  </div>
                  <div className="text-[10px] font-mono text-gray-500 truncate">
                    {dbAuditReport.environment?.runtime}
                  </div>
                </div>
              </div>

              {(dbAuditReport.summary?.failed > 0 || dbAuditReport.summary?.warnings > 0) && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <strong>Recommended Repair Migration:</strong> Apply{' '}
                    <code className="font-mono bg-white px-1.5 py-0.5 rounded border">
                      {dbAuditReport.recommendedMigration || 'database/migrations/next_verified_repair.sql'}
                    </code>{' '}
                    in Supabase SQL Editor if any tables, columns, or RLS checks report warnings/failures.
                  </span>
                  <span className="font-mono text-[10px] text-amber-700">
                    Read-Only: Yes • Secrets Redacted: Yes
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-xl p-3 space-y-2">
                  <h4 className="font-black text-gray-800">Infrastructure &amp; Schema Checks</h4>
                  <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                    {(dbAuditReport.checks || []).map((c: any, idx: number) => (
                      <div key={idx} className="py-2 space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-gray-900">
                            [{c.category}] {c.name}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                              c.status === 'pass'
                                ? 'bg-emerald-100 text-emerald-800'
                                : c.status === 'warn'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {c.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-600">{c.detail}</div>
                        {c.remediation && <div className="text-[10px] font-mono text-amber-800">Fix: {c.remediation}</div>}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border rounded-xl p-3 space-y-2">
                  <h4 className="font-black text-gray-800">RLS Isolation Matrix (Anon Probe)</h4>
                  <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                    {(dbAuditReport.rlsChecks || []).map((c: any, idx: number) => (
                      <div key={idx} className="py-2 space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-gray-900">{c.name}</span>
                          <span
                            className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                              c.status === 'pass'
                                ? 'bg-emerald-100 text-emerald-800'
                                : c.status === 'warn'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {c.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-600">{c.detail}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-black text-gray-800 mb-2">
                  Monitored PostgreSQL Tables ({(dbAuditReport.tables || []).length})
                </h4>
                <div className="overflow-x-auto border rounded-xl max-h-80 overflow-y-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b text-[10px] font-bold uppercase text-gray-500 sticky top-0">
                      <tr>
                        <th className="p-2">Table</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">Rows</th>
                        <th className="p-2">Column Alignment / Detail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-mono text-[11px]">
                      {(dbAuditReport.tables || []).map((t: any) => (
                        <tr key={t.table} className="hover:bg-gray-50">
                          <td className="p-2 font-bold text-gray-800">{t.table}</td>
                          <td className="p-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                t.ok && !t.error
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : t.ok && t.error
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {t.ok && !t.error ? 'OK' : t.ok ? 'MISMATCH' : 'MISSING'}
                            </span>
                          </td>
                          <td className="p-2">{t.rowCount ?? '—'}</td>
                          <td className="p-2 text-gray-600">
                            {t.error ? sanitizeDiagText(t.error) : 'Schema aligned'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 0: SUPABASE POSTGRESQL HEALTH */}
      {activeTab === 'supabase' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <div>
              <h3 className="font-black text-gray-900 text-sm">Supabase PostgreSQL SDK, Permissions &amp; RLS Diagnostics</h3>
              <p className="text-gray-500">
                Uses official <code className="font-mono">@supabase/supabase-js</code> SDK to verify host connectivity, <code className="font-mono">articles</code> read/write permissions, and Row-Level Security.
              </p>
            </div>
            <button
              type="button"
              disabled={actionBusy || loading}
              onClick={handleTestSupabase}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-lg inline-flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{actionBusy ? 'Testing Supabase SDK...' : 'Test Supabase Connection'}</span>
            </button>
          </div>

          {supabaseError && !supabaseHealth && (
            <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 font-semibold">
              {supabaseError}
            </div>
          )}

          {!supabaseHealth && loading && (
            <div className="p-6 text-center text-gray-500 font-semibold">
              Running Supabase SDK connectivity and RLS verification...
            </div>
          )}

          {supabaseHealth && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-gray-50 border rounded-xl">
                  <div className="text-[10px] font-bold uppercase text-gray-500">Supabase Connectivity</div>
                  <div className="mt-1 flex items-center gap-1.5 font-black text-sm">
                    {supabaseHealth.connected ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-700">Connected</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-rose-600" />
                        <span className="text-rose-700">{supabaseHealth.configured ? 'Error' : 'Not Configured'}</span>
                      </>
                    )}
                  </div>
                  <div className="text-[10px] font-mono text-gray-500 mt-0.5">
                    Ping: {supabaseHealth.pingOk ? `OK (${supabaseHealth.pingLatencyMs}ms)` : `${supabaseHealth.latencyMs}ms`} • {supabaseHealth.sdkPackage || '@supabase/supabase-js'}
                  </div>
                </div>

                <div className="p-3 bg-gray-50 border rounded-xl">
                  <div className="text-[10px] font-bold uppercase text-gray-500">Project Host / Key Mode</div>
                  <div className="mt-1 font-mono font-bold text-gray-800 truncate">{supabaseHealth.projectHost || 'Unconfigured'}</div>
                  <div className="text-[10px] font-mono text-gray-500 truncate">
                    Secret: {supabaseHealth.secretKeyMode} (Redacted)
                  </div>
                </div>

                <div className="p-3 bg-gray-50 border rounded-xl">
                  <div className="text-[10px] font-bold uppercase text-gray-500">Articles Table Permissions</div>
                  <div className="mt-1 font-mono font-bold text-gray-800">
                    Read: {supabaseHealth.readTestOk ? 'Allowed' : 'Failed/Unverified'}
                  </div>
                  <div className="text-[10px] font-mono text-gray-500">
                    Write: {supabaseHealth.authorizedWriteTestOk === null ? 'Click Test to Verify' : supabaseHealth.authorizedWriteTestOk ? 'Allowed (Verified)' : 'Denied'}
                  </div>
                </div>

                <div className="p-3 bg-gray-50 border rounded-xl">
                  <div className="text-[10px] font-bold uppercase text-gray-500">PostgreSQL Row Counts</div>
                  <div className="mt-1 font-mono font-black text-gray-900">
                    {supabaseHealth.publishedCount ?? 0} published / {supabaseHealth.totalCount ?? '—'} total
                  </div>
                  <div className="text-[10px] font-mono text-gray-500 truncate">
                    Last Save: {supabaseHealth.latestSuccessfulSaveAt ? formatKarachiDateTime(supabaseHealth.latestSuccessfulSaveAt) : '—'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                <div className="p-3 bg-gray-50 border rounded-xl space-y-1.5">
                  <div className="font-bold text-gray-800">Server-Side Permissions &amp; RLS Audit</div>
                  <div className="text-gray-700">
                    <span className="font-semibold">Read Permission:</span> {supabaseHealth.readPermissionDetail || (supabaseHealth.readTestOk ? 'Verified' : 'Pending')}
                  </div>
                  <div className="text-gray-700">
                    <span className="font-semibold">Write Permission:</span> {supabaseHealth.writePermissionDetail || 'Click Test Supabase Connection'}
                  </div>
                  <div className="font-mono text-gray-700 pt-0.5">
                    RLS Policy Status:{' '}
                    <span className={supabaseHealth.rlsPolicyCheckOk ? 'text-emerald-700 font-bold' : 'text-amber-800 font-bold'}>
                      {supabaseHealth.rlsPolicyCheckOk === null ? 'Not Tested' : supabaseHealth.rlsPolicyCheckOk ? 'Isolated (Pass)' : 'Check Required'}
                    </span>
                  </div>
                  <div className="text-gray-600">{supabaseHealth.rlsPolicyDetail}</div>
                </div>

                <div className="p-3 bg-gray-50 border rounded-xl space-y-1.5">
                  <div className="font-bold text-gray-800">Client Browser Supabase SDK Check (Publishable Key)</div>
                  {browserSdkReport ? (
                    <>
                      <div className="font-mono text-gray-700">
                        Browser SDK Configured: <span className="font-bold">{browserSdkReport.configured ? 'Yes' : 'No (Server-Only Mode)'}</span>
                        {browserSdkReport.latencyMs !== null && ` • ${browserSdkReport.latencyMs}ms`}
                      </div>
                      {browserSdkReport.configured && (
                        <div className="font-mono text-gray-700">
                          Public SELECT: {browserSdkReport.publicReadOk ? 'OK' : 'Error'} ({browserSdkReport.publicReadCount ?? 0}) • Drafts Blocked:{' '}
                          {browserSdkReport.draftRlsBlocked ? 'Yes' : 'No'} • Anon Write Blocked: {browserSdkReport.anonWriteBlocked ? 'Yes' : 'No'}
                        </div>
                      )}
                      <div className="text-gray-600">{browserSdkReport.detail}</div>
                    </>
                  ) : (
                    <div className="text-gray-500">Initializing browser SDK probe...</div>
                  )}
                </div>
              </div>

              {(supabaseHealth.errorMessage ||
                (supabaseHealth.missingServerEnvVars || []).length > 0 ||
                (supabaseHealth.optionalMissingEnvVars || []).length > 0 ||
                supabaseHealth.schemaMigrationRequired) && (
                <div
                  className={`p-3.5 rounded-xl border flex items-start gap-2 ${
                    supabaseHealth.connected && (supabaseHealth.missingServerEnvVars || []).length === 0 && !supabaseHealth.schemaMigrationRequired
                      ? 'bg-amber-50 border-amber-300 text-amber-950'
                      : 'bg-rose-50 border-rose-300 text-rose-950'
                  }`}
                >
                  <ShieldAlert
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      supabaseHealth.connected && (supabaseHealth.missingServerEnvVars || []).length === 0 && !supabaseHealth.schemaMigrationRequired
                        ? 'text-amber-700'
                        : 'text-rose-700'
                    }`}
                  />
                  <div className="space-y-1.5 text-xs">
                    <div className="font-bold">
                      Supabase Connection Status [{supabaseHealth.errorCode || (supabaseHealth.connected ? 'NOTICE' : 'ERROR')}]
                    </div>
                    {supabaseHealth.errorMessage && <div>{supabaseHealth.errorMessage}</div>}
                    {supabaseHealth.envSummaryDetail && (
                      <div className="text-[11px] opacity-90">{supabaseHealth.envSummaryDetail}</div>
                    )}
                    {(supabaseHealth.missingServerEnvVars || []).length > 0 && (
                      <div className="font-mono text-[11px] bg-white/70 px-2.5 py-1.5 rounded border border-rose-200">
                        Required Server Env Vars Missing: {supabaseHealth.missingServerEnvVars.join(', ')} — Set them in Vercel Project Settings (Production Scope) or AI Studio Secrets and redeploy.
                      </div>
                    )}
                    {(supabaseHealth.optionalMissingEnvVars || []).length > 0 && (
                      <div className="font-mono text-[11px] bg-white/70 px-2.5 py-1.5 rounded border border-amber-200">
                        Optional / Client Key Notice: {supabaseHealth.optionalMissingEnvVars.join(', ')} not set. Server routes work using SUPABASE_SECRET_KEY; set VITE_SUPABASE_PUBLISHABLE_KEY + SUPABASE_PUBLISHABLE_KEY and rebuild if enabling client-side Supabase SDK.
                      </div>
                    )}
                    {supabaseHealth.schemaMigrationRequired && (
                      <div className="font-mono text-[11px] bg-white/70 px-2.5 py-1.5 rounded border border-rose-200">
                        Schema Migration Required: Run <code>database/migrations/next_verified_repair.sql</code> in Supabase SQL Editor and execute <code>NOTIFY pgrst, &apos;reload schema&apos;;</code>.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {supabaseHealth.latestPublishingError && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 text-[11px]">
                  <span className="font-bold">Latest Publishing Notice:</span> {supabaseHealth.latestPublishingError}
                </div>
              )}

              {/* Storage & Multi-Table Module Health */}
              {storageHealth && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-bold text-gray-900">Supabase Multi-Table &amp; Storage Bucket Audit</div>
                    <span className="font-mono text-[11px] text-gray-600">
                      Bucket: {storageHealth.storage?.bucket || 'editorial-media'} ({storageHealth.storage?.ok ? 'Accessible' : storageHealth.storage?.detail || 'Local Disk Fallback'})
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                    {Object.entries(storageHealth.modules || {}).map(([mod, info]: [string, any]) => (
                      <div key={mod} className="bg-white border border-gray-200 rounded-lg p-2 font-mono text-[10px]">
                        <div className="font-bold text-gray-800 truncate">{mod}</div>
                        <div className={info.ok ? 'text-emerald-700' : 'text-amber-700'}>
                          {info.ok ? `OK (${info.count ?? 0})` : info.error || 'Unverified'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Editable Runtime Timeout & Sync Interval Controls */}
              <form onSubmit={handleSaveRuntimeSettings} className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                <div className="font-bold text-gray-900">Runtime AI Timeouts &amp; Synchronization Defaults</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-1">Discovery Timeout (ms)</label>
                    <input
                      type="number"
                      min={5000}
                      max={25000}
                      value={rtDiscoveryMs}
                      onChange={e => setRtDiscoveryMs(parseInt(e.target.value, 10) || 12000)}
                      className="w-full p-2 bg-white border border-gray-300 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-1">Generation Test Timeout (ms)</label>
                    <input
                      type="number"
                      min={15000}
                      max={60000}
                      value={rtGenerationMs}
                      onChange={e => setRtGenerationMs(parseInt(e.target.value, 10) || 45000)}
                      className="w-full p-2 bg-white border border-gray-300 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-1">AI Inference Timeout (ms)</label>
                    <input
                      type="number"
                      min={15000}
                      max={60000}
                      value={rtInferenceMs}
                      onChange={e => setRtInferenceMs(parseInt(e.target.value, 10) || 50000)}
                      className="w-full p-2 bg-white border border-gray-300 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-1">Default Sync Interval (min)</label>
                    <input
                      type="number"
                      min={5}
                      max={1440}
                      value={rtSyncIntervalMin}
                      onChange={e => setRtSyncIntervalMin(parseInt(e.target.value, 10) || 30)}
                      className="w-full p-2 bg-white border border-gray-300 rounded-lg font-mono"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={actionBusy}
                    className="px-4 py-1.5 bg-gray-900 hover:bg-black text-white font-bold rounded-lg disabled:opacity-50"
                  >
                    Save Runtime Settings
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}

      {/* TAB: SAVE DIAGNOSTICS */}
      {activeTab === 'save_diagnostics' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <div>
              <h3 className="font-black text-gray-900 text-sm">Admin Module Save &amp; Persistence Telemetry</h3>
              <p className="text-gray-500">
                Tracks real backend write operations, read-back verification, storage engine, and latency across all admin modules.
              </p>
            </div>
            <span className="font-mono text-[11px] text-gray-600">
              {saveDiagnosticsList.length} recorded mutations
            </span>
          </div>
          {saveDiagnosticsList.length === 0 ? (
            <div className="p-6 text-center text-gray-500 bg-gray-50 border rounded-xl">
              No save operations recorded in current dataset yet. Modify any article, campaign, setting, or category to inspect live persistence telemetry.
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-xl max-h-96 overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b text-[11px] font-bold text-gray-600">
                  <tr>
                    <th className="p-2.5">Module</th>
                    <th className="p-2.5">Action / Record ID</th>
                    <th className="p-2.5">Engine</th>
                    <th className="p-2.5">Verified</th>
                    <th className="p-2.5">Latency</th>
                    <th className="p-2.5">Time (PKT)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-mono text-[11px]">
                  {saveDiagnosticsList.map(entry => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="p-2.5 font-bold text-gray-900">{entry.module}</td>
                      <td className="p-2.5">
                        <span className="uppercase">{entry.action}</span>
                        {entry.recordId ? ` • ${entry.recordId}` : ''}
                        {entry.errorMessage && (
                          <div className="text-rose-700 font-sans text-[10px] mt-0.5">{sanitizeDiagText(entry.errorMessage)}</div>
                        )}
                      </td>
                      <td className="p-2.5">{entry.storageEngine}</td>
                      <td className="p-2.5">
                        <span
                          className={`px-2 py-0.5 rounded font-bold ${
                            entry.success ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {entry.success ? (entry.verifiedReadBack ? 'VERIFIED' : 'SAVED') : 'FAILED'}
                        </span>
                      </td>
                      <td className="p-2.5">{entry.latencyMs}ms</td>
                      <td className="p-2.5 text-gray-500">{formatKarachiDateTime(entry.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 1: FIREBASE HEALTH */}
      {activeTab === 'database' && dbHealth && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-gray-50 border rounded-xl">
              <div className="text-[10px] font-bold uppercase text-gray-500">Cloud Firestore</div>
              <div className="mt-1 flex items-center gap-1.5 font-black text-sm">
                {dbHealth.connected ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-700">Connected</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span className="text-rose-700">Connection Error</span>
                  </>
                )}
              </div>
              <div className="text-[10px] font-mono text-gray-500 mt-0.5">Latency: {dbHealth.latencyMs}ms</div>
            </div>
            <div className="p-3 bg-gray-50 border rounded-xl">
              <div className="text-[10px] font-bold uppercase text-gray-500">Auth Mode</div>
              <div className="mt-1 font-mono font-black text-gray-900 truncate">{dbHealth.authMode}</div>
              <div className="text-[10px] font-mono text-gray-500">
                Service Acct: {dbHealth.serviceAccountConfigured ? 'Configured' : 'Bearer Token Mode'}
              </div>
            </div>
            <div className="p-3 bg-gray-50 border rounded-xl">
              <div className="text-[10px] font-bold uppercase text-gray-500">Project / Database ID</div>
              <div className="mt-1 font-mono font-bold text-gray-800 truncate">{dbHealth.projectId}</div>
              <div className="text-[10px] font-mono text-gray-500 truncate">{dbHealth.firestoreDatabaseId}</div>
            </div>
            <div className="p-3 bg-gray-50 border rounded-xl">
              <div className="text-[10px] font-bold uppercase text-gray-500">Firestore Articles</div>
              <div className="mt-1 font-mono font-black text-gray-900">
                {dbHealth.publishedCountInFirestore ?? 0} published / {dbHealth.totalCountInFirestore ?? 0} total
              </div>
              <div className="text-[10px] font-mono text-gray-500">
                /test/connection: {dbHealth.testConnectionDocExists ? 'Present' : 'Not Created'}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={actionBusy}
              onClick={handleRunFirestoreProbe}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-lg inline-flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{actionBusy ? 'Probing Firestore...' : 'Test /test/connection Probe'}</span>
            </button>
            <button
              type="button"
              disabled={actionBusy}
              onClick={handleSyncArticlesToFirestore}
              className="px-4 py-2 bg-gray-900 hover:bg-black disabled:opacity-50 text-white font-bold rounded-lg inline-flex items-center gap-1.5"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Sync Portal Articles to Firestore</span>
            </button>
          </div>

          {dbHealth.errorMessage && (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Firestore Notice</div>
                <div>{dbHealth.errorMessage}</div>
              </div>
            </div>
          )}

          {dbHealth.totalCountInFirestore === 0 && dbHealth.connected && (
            <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-xl text-sky-950 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Firestore Collection Empty</div>
                <div>
                  Your Cloud Firestore <code>articles</code> collection currently has 0 documents (local workspace cache stories are still available). Click <strong>Sync Portal Articles to Firestore</strong> above while signed in as Admin to seed them into Firestore permanently.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PUBLISHING PIPELINE */}
      {activeTab === 'publishing' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <div>
              <h3 className="font-black text-gray-900 text-sm">End-to-End Firestore Publishing Verification</h3>
              <p className="text-gray-500">
                Tests real Firestore draft commit -&gt; read-after-write -&gt; publish -&gt; public slug lookup -&gt; cleanup.
              </p>
            </div>
            <button
              type="button"
              disabled={actionBusy}
              onClick={handleRunPipelineTest}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-lg inline-flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{actionBusy ? 'Running Self-Test...' : 'Test Publishing Pipeline'}</span>
            </button>
          </div>

          {pipelineResult && (
            <div className="p-4 bg-gray-950 text-gray-100 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className={pipelineResult.ok ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  Pipeline Result: {pipelineResult.ok ? 'PASS' : 'FAIL'} ({pipelineResult.totalDurationMs}ms)
                </span>
                <span className="text-gray-400">Engine: {pipelineResult.storageEngine}</span>
              </div>
              <div className="divide-y divide-gray-800">
                {(pipelineResult.steps || []).map((s: any, idx: number) => (
                  <div key={idx} className="py-1.5 flex items-center justify-between gap-2 text-[11px] font-mono">
                    <span className="flex items-center gap-1.5">
                      {s.ok ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                      )}
                      <span>{s.step}</span>
                    </span>
                    <span className="text-gray-400 truncate max-w-md">{s.detail} ({s.durationMs}ms)</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pubHealth && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                {Object.entries(pubHealth.counts || {}).map(([k, v]: [string, any]) => (
                  <div key={k} className="p-3 bg-gray-50 border rounded-xl text-center">
                    <div className="text-[10px] font-bold uppercase text-gray-500">{k.replace('_', ' ')}</div>
                    <div className="text-lg font-black text-gray-900 font-mono mt-0.5">{v}</div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-gray-50 border rounded-xl flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="font-bold text-gray-700">
                  Missing Bilingual EN/UR Translations: <span className="font-mono text-gray-900">{pubHealth.missingTranslationsCount ?? 0}</span>
                </span>
                <span className="font-mono text-gray-500">
                  Engine: {pubHealth.storageEngine} • DB: {pubHealth.firestoreDatabaseId}
                </span>
              </div>

              <div>
                <h4 className="font-bold text-gray-800 mb-2">Recent Publication Audit Logs</h4>
                <div className="border rounded-xl divide-y divide-gray-100 max-h-72 overflow-y-auto">
                  {(pubHealth.recentLogs || []).length === 0 ? (
                    <div className="p-4 text-center text-gray-400">No publication events logged yet.</div>
                  ) : (
                    pubHealth.recentLogs.map((log: any) => (
                      <div key={log.id} className="p-2.5 flex flex-wrap items-center justify-between gap-2">
                        <div className="space-x-2">
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold uppercase text-[10px]">
                            {log.action}
                          </span>
                          <span className="font-mono text-gray-700">{log.articleId}</span>
                          <span className="text-gray-600">{log.message}</span>
                        </div>
                        <span className="font-mono text-[10px] text-gray-400">
                          {log.storageEngine} • {formatKarachiDateTime(log.createdAt)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 3: ARTICLE PERSISTENCE */}
      {activeTab === 'persistence' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h3 className="font-black text-gray-900">Persisted Articles Bilingual &amp; Slug Check ({adminArticles.length} active)</h3>
          <div className="overflow-x-auto border rounded-xl">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b text-[11px] font-bold text-gray-600">
                <tr>
                  <th className="p-2.5">ID</th>
                  <th className="p-2.5">Slug</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Version</th>
                  <th className="p-2.5">Bilingual (Head / Body)</th>
                  <th className="p-2.5">Updated (PKT)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono text-[11px]">
                {adminArticles.slice(0, 30).map(a => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="p-2.5">{a.id}</td>
                    <td className="p-2.5 max-w-[200px] truncate">{a.slug}</td>
                    <td className="p-2.5 uppercase font-bold">{a.status}</td>
                    <td className="p-2.5">v{a.version || 1}</td>
                    <td className="p-2.5">
                      EN:{a.titleEn ? '✓' : '✗'}/{a.contentEn ? '✓' : '✗'} • UR:{a.titleUr ? '✓' : '✗'}/{a.contentUr ? '✓' : '✗'}
                    </td>
                    <td className="p-2.5">{formatKarachiDateTime(a.updatedAt || a.publishedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: PUBLIC API */}
      {activeTab === 'public_api' && publicFeed && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-gray-50 border rounded-xl">
              <div className="text-[10px] font-bold uppercase text-gray-500">GET /api/v1/news</div>
              <div className="font-black text-sm text-emerald-700 mt-1">
                {publicFeed.success ? '200 OK' : 'ERROR'} ({publicFeed.measuredLatencyMs}ms)
              </div>
            </div>
            <div className="p-3 bg-gray-50 border rounded-xl">
              <div className="text-[10px] font-bold uppercase text-gray-500">Total Published</div>
              <div className="font-black font-mono text-sm mt-1">{publicFeed.total ?? publicFeed.articles?.length ?? 0}</div>
            </div>
            <div className="p-3 bg-gray-50 border rounded-xl">
              <div className="text-[10px] font-bold uppercase text-gray-500">Firestore / Engine</div>
              <div className="font-mono font-bold text-sm mt-1">
                {publicFeed.storageEngine || '—'} ({publicFeed.firestoreCount ?? 0} FS)
              </div>
            </div>
            <div className="p-3 bg-gray-50 border rounded-xl">
              <div className="text-[10px] font-bold uppercase text-gray-500">Cache Version</div>
              <div className="font-mono font-bold text-sm mt-1">v{publicFeed.cacheVersion || 1}</div>
            </div>
          </div>
          <pre className="p-3 bg-slate-900 text-emerald-300 rounded-xl font-mono text-[11px] max-h-72 overflow-y-auto">
            {JSON.stringify(
              (publicFeed.articles || []).map((a: any) => ({
                id: a.id,
                slug: a.slug,
                category: a.category,
                status: a.status,
                urlEn: `/en/news/${a.slug}`,
                urlUr: `/ur/news/${a.slug}`,
              })),
              null,
              2
            )}
          </pre>
        </div>
      )}

      {/* TAB 5: GEMINI API */}
      {activeTab === 'gemini' && geminiDiag && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-black text-gray-900">Configured AI Providers &amp; Verification Status</h3>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`px-2.5 py-1 rounded font-bold border ${
                  geminiDiag.connectionStatus?.geminiStatus === 'Connected'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-gray-100 text-gray-700 border-gray-200'
                }`}
              >
                Gemini: {geminiDiag.connectionStatus?.geminiStatus || 'Not Connected'}
              </span>
              <span
                className={`px-2.5 py-1 rounded font-bold border ${
                  geminiDiag.connectionStatus?.grokStatus === 'Connected'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-gray-100 text-gray-700 border-gray-200'
                }`}
              >
                Grok: {geminiDiag.connectionStatus?.grokStatus || 'Not Connected'}
              </span>
            </div>
          </div>
          {(geminiDiag.providers || []).length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 font-semibold">
              Gemini: Not Connected · Grok: Not Connected. Open Settings → AI API Connection to paste and verify your API key.
            </div>
          ) : (
            <div className="space-y-2">
              {geminiDiag.providers.map((p: any) => (
                <div key={p.id} className="p-3 bg-gray-50 border rounded-xl flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-gray-900">
                      {p.label} <span className="font-mono text-gray-500">({p.providerType} • {p.model})</span>
                    </div>
                    <div className="text-[11px] font-mono text-gray-500">
                      Key: {p.maskedKey} • Status: {p.connectionStatus} • Models cached: {p.availableModels?.length || 0}
                    </div>
                    {p.lastDiagnostic?.failureSource && (
                      <div className="text-[11px] text-amber-800 mt-0.5">
                        Source: {p.lastDiagnostic.failureSource} — {p.lastDiagnostic.message}
                      </div>
                    )}
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded font-bold uppercase text-[10px] ${
                      p.connectionStatus === 'connected'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {p.connectionStatus}
                  </span>
                </div>
              ))}
            </div>
          )}
          {geminiDiag.diagnostics?.connectivity && (
            <pre className="p-3 bg-slate-900 text-emerald-300 rounded-xl font-mono text-[11px] overflow-x-auto">
              {JSON.stringify(geminiDiag.diagnostics.connectivity, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* TAB 6: FRONTEND CACHE */}
      {activeTab === 'cache' && cacheStatus && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-gray-900">News Cache Version &amp; Public Sync</h3>
              <p className="text-gray-500">
                API responses serve with strict <code className="font-mono">Cache-Control: no-store</code> headers plus versioned invalidation.
              </p>
            </div>
            <button
              type="button"
              disabled={actionBusy}
              onClick={handleInvalidateCache}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg inline-flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${actionBusy ? 'animate-spin' : ''}`} />
              <span>Invalidate Public Cache Now</span>
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-gray-50 border rounded-xl">
              <div className="text-[10px] font-bold uppercase text-gray-500">Cache Version</div>
              <div className="text-xl font-black font-mono mt-1">v{cacheStatus.newsCacheVersion}</div>
            </div>
            <div className="p-3 bg-gray-50 border rounded-xl">
              <div className="text-[10px] font-bold uppercase text-gray-500">Last Invalidated</div>
              <div className="font-mono font-bold mt-1">{formatKarachiDateTime(cacheStatus.lastInvalidatedAt)}</div>
            </div>
            <div className="p-3 bg-gray-50 border rounded-xl">
              <div className="text-[10px] font-bold uppercase text-gray-500">Published Count</div>
              <div className="text-xl font-black font-mono text-emerald-700 mt-1">{cacheStatus.publishedArticlesCount}</div>
            </div>
            <div className="p-3 bg-gray-50 border rounded-xl">
              <div className="text-[10px] font-bold uppercase text-gray-500">Active Records</div>
              <div className="text-xl font-black font-mono mt-1">{cacheStatus.totalActiveArticlesCount}</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: DEPLOYMENT VERSION */}
      {activeTab === 'deployment' && deploymentInfo && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 bg-gray-50 border rounded-xl">
            <div className="text-[10px] font-bold uppercase text-gray-500">App Release</div>
            <div className="text-lg font-black font-mono mt-1">v{deploymentInfo.appVersion}</div>
          </div>
          <div className="p-3 bg-gray-50 border rounded-xl">
            <div className="text-[10px] font-bold uppercase text-gray-500">Environment / Node</div>
            <div className="font-mono font-bold mt-1">{deploymentInfo.nodeEnv} • {deploymentInfo.nodeVersion}</div>
          </div>
          <div className="p-3 bg-gray-50 border rounded-xl">
            <div className="text-[10px] font-bold uppercase text-gray-500">Storage Engine</div>
            <div className="font-mono font-bold mt-1">{deploymentInfo.storageMode}</div>
            <div className="text-[10px] font-mono text-gray-500 truncate">{deploymentInfo.projectId}</div>
          </div>
          <div className="p-3 bg-gray-50 border rounded-xl">
            <div className="text-[10px] font-bold uppercase text-gray-500">Uptime / RSS Memory</div>
            <div className="font-mono font-bold mt-1">{deploymentInfo.uptimeSeconds}s • {deploymentInfo.memoryUsageMb} MB</div>
          </div>
        </div>
      )}

      {/* TAB 8: ERROR LOGS */}
      {activeTab === 'errors' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h3 className="font-black text-gray-900">Structured Server Error Tracker (Secrets Redacted)</h3>
          {errorLogs.length === 0 ? (
            <div className="p-6 text-center text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl font-bold">
              No server, Cloud Firestore, or publishing errors recorded in current runtime session.
            </div>
          ) : (
            <div className="border rounded-xl divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {errorLogs.map(log => (
                <div key={log.id} className="p-3 space-y-1">
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="font-bold text-rose-700">[{log.source.toUpperCase()}:{log.code}]</span>
                    <span className="text-gray-400">{formatKarachiDateTime(log.timestamp)}</span>
                  </div>
                  <div className="text-gray-800">{log.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 9: COLLECTIONS & RULES */}
      {activeTab === 'collections' && collectionsInfo && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-gray-900">Cloud Firestore Collections &amp; Security Rules</h3>
              <p className="text-gray-500">
                Project <code className="font-mono">{collectionsInfo.projectId}</code> • DB <code className="font-mono">{collectionsInfo.firestoreDatabaseId}</code>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={actionBusy}
                onClick={handleRunFirestoreProbe}
                className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-lg inline-flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Verify /test/connection</span>
              </button>
              <button
                type="button"
                disabled={actionBusy}
                onClick={handleSyncArticlesToFirestore}
                className="px-3.5 py-2 bg-gray-900 hover:bg-black disabled:opacity-50 text-white font-bold rounded-lg inline-flex items-center gap-1.5"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Sync Articles to Firestore</span>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 border rounded-xl space-y-1.5">
              <div className="font-bold text-gray-800">Active Firestore Paths (firestore.rules)</div>
              {(collectionsInfo.collections || []).map((c: string) => (
                <div key={c} className="font-mono text-[11px] text-gray-700">• {c}</div>
              ))}
            </div>
            <div className="p-3 bg-gray-50 border rounded-xl space-y-1.5 text-[11px]">
              <div className="font-bold text-gray-800">Live Firestore Security &amp; Sync Status</div>
              <div className="font-mono text-gray-700">Connected: {collectionsInfo.connected ? 'Yes' : 'No'}</div>
              <div className="font-mono text-gray-700">Auth Mode: {collectionsInfo.authMode}</div>
              <div className="font-mono text-gray-700">Service Account Env: {collectionsInfo.serviceAccountConfigured ? 'Configured' : 'Admin ID Token Forwarding'}</div>
              <div className="font-mono text-gray-700">Articles in Firestore: {collectionsInfo.publishedCountInFirestore} published / {collectionsInfo.totalCountInFirestore} total</div>
              <div className="font-mono text-gray-700">Test Probe (/test/connection): {collectionsInfo.testConnectionDocExists ? 'Verified Present' : 'Not Created Yet'}</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: PERFORMANCE, CORE WEB VITALS & SLOW QUERIES */}
      {activeTab === 'performance' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <div>
              <h3 className="font-black text-gray-900 text-sm">Website Performance, Core Web Vitals &amp; Query Telemetry</h3>
              <p className="text-gray-500">
                Real browser Web Vitals collected on public routes, versioned public ETag caching status, and slow PostgreSQL queries (&gt;250ms).
              </p>
            </div>
            {perfReport && (
              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded border border-emerald-200 font-bold">
                  Cache v{perfReport.cache?.newsCacheVersion ?? 1}
                </span>
                <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded border font-bold">
                  Hydration Cache: {perfReport.hydrationCacheTtlMs ? `${Math.round(perfReport.hydrationCacheTtlMs / 1000)}s TTL` : '30s TTL'}
                </span>
              </div>
            )}
          </div>

          {!perfReport && loading && (
            <div className="p-6 text-center text-gray-500">Loading performance telemetry...</div>
          )}

          {perfReport && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(['LCP', 'INP', 'CLS', 'TTFB'] as const).map(metric => {
                  const stats = perfReport.webVitals?.[metric];
                  const rating = stats?.rating || 'no-data';
                  return (
                    <div key={metric} className="p-3.5 bg-gray-50 border rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-gray-500">{metric}</span>
                        <span
                          className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            rating === 'good'
                              ? 'bg-emerald-100 text-emerald-800'
                              : rating === 'needs-improvement'
                              ? 'bg-amber-100 text-amber-800'
                              : rating === 'poor'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {rating}
                        </span>
                      </div>
                      <div className="text-xl font-black font-mono text-gray-900">
                        {stats ? (metric === 'CLS' ? stats.p75 : `${stats.p75}ms`) : '—'}
                      </div>
                      <div className="text-[10px] font-mono text-gray-500">
                        {stats ? `p75 (${stats.count} samples)` : 'Visit public pages to collect'}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="border rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-gray-800">Slow PostgreSQL Queries (&gt;250ms)</h4>
                    <span className="font-mono text-[11px] text-gray-500">
                      {(perfReport.slowQueries || []).length} recorded
                    </span>
                  </div>
                  {(perfReport.slowQueries || []).length === 0 ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 font-semibold">
                      No slow PostgreSQL queries detected in current runtime session.
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto font-mono text-[11px]">
                      {perfReport.slowQueries.map((q: any, idx: number) => (
                        <div key={idx} className="py-2 flex items-center justify-between gap-2">
                          <span className="font-bold text-gray-800">
                            {q.table}.{q.action}
                          </span>
                          <span className="text-amber-700 font-bold">{q.durationMs}ms</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border rounded-xl p-4 space-y-2">
                  <h4 className="font-black text-gray-800">Caching &amp; Optimization Summary</h4>
                  <ul className="space-y-1.5 text-[11px] text-gray-700 list-disc pl-4">
                    <li>
                      <strong>Public GET Cache:</strong> <code>public, max-age=15, stale-while-revalidate=45</code> with versioned <code>ETag</code> (invalidated immediately upon article/ad/feed mutations).
                    </li>
                    <li>
                      <strong>Admin Routes:</strong> Strictly <code>Cache-Control: no-store</code> to prevent stale editorial or campaign reads.
                    </li>
                    <li>
                      <strong>Code Splitting:</strong> Lazy-loaded public sub-views and Admin Studio modules with dedicated vendor chunks.
                    </li>
                    <li>
                      <strong>Composite DB Indexes:</strong> Applied on <code>articles(status, published_at DESC)</code> and <code>(category, status, published_at DESC)</code> in repair migration.
                    </li>
                  </ul>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
