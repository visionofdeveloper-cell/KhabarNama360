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

export const SystemDiagnostics: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DiagTab>('supabase');
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionBanner, setActionBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [supabaseHealth, setSupabaseHealth] = useState<any>(null);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
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
          const [res] = await Promise.all([
            safeFetchJson('/api/v1/admin/system/supabase-health', { credentials: 'include' }),
            runBrowserSupabaseSdkProbe(),
          ]);
          if (res.success && res.report) {
            setSupabaseHealth(res.report);
          } else {
            setSupabaseError(res.error || 'Unable to retrieve Supabase diagnostics.');
          }
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
          const [diagRes, provRes] = await Promise.all([
            safeFetchJson('/api/v1/admin/ai/diagnostics', { credentials: 'include' }),
            safeFetchJson('/api/v1/admin/ai/providers', { credentials: 'include' }),
          ]);
          setGeminiDiag({ diagnostics: diagRes, providers: provRes.providers || [] });
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

              {(supabaseHealth.errorMessage || (supabaseHealth.missingEnvVars || []).length > 0) && (
                <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-950 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold">Supabase Connection Status [{supabaseHealth.errorCode || 'ERROR'}]</div>
                    <div>{supabaseHealth.errorMessage}</div>
                    {(supabaseHealth.missingEnvVars || []).length > 0 && (
                      <div className="font-mono text-[11px]">
                        Missing Env Vars: {supabaseHealth.missingEnvVars.join(', ')} — Apply <code>/database/supabase_migrations/001_supabase_core_schema.sql</code> and <code>002_supabase_rls_policies.sql</code> in Supabase SQL Editor.
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
            </>
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
          <h3 className="font-black text-gray-900">Configured AI Providers &amp; Verification Status</h3>
          {(geminiDiag.providers || []).length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 font-semibold">
              No AI provider keys configured yet. Open AI Keys &amp; Routing to add and verify your Gemini API key.
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
    </div>
  );
};
