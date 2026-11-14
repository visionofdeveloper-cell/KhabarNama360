/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Live Data & Automation Manager Component (13 Tabs + Custom Provider Registry)
 */

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../src/context/LanguageContext.tsx';
import {
  DataProvider,
  SyncJobRun,
  AiContentDraft,
  AutomationSettings,
  ProviderCategory,
} from '../../src/server/automation/types.ts';
import {
  Zap,
  Database,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  ShieldCheck,
  Activity,
  Check,
  X,
  FileText,
  Search,
  Plus,
  Trash2,
  Edit3,
  Newspaper,
  TrendingUp,
  CloudSun,
  Trophy,
  Moon,
  GraduationCap,
  ShieldAlert,
  KeyRound,
  Copy,
  Play,
} from 'lucide-react';

type AutomationTabId =
  | 'overview'
  | 'providers'
  | 'news'
  | 'finance'
  | 'weather'
  | 'cricket'
  | 'islamic'
  | 'education'
  | 'schedules'
  | 'manual'
  | 'validation'
  | 'logs'
  | 'ai-settings'
  | 'verification-queue';

interface AutomationManagerProps {
  userRole?: string;
  onJumpToAiKeys?: () => void;
}

const PROVIDER_CATEGORIES: ProviderCategory[] = [
  'news',
  'currency',
  'gold',
  'fuel',
  'psx',
  'weather',
  'cricket',
  'islamic',
  'education',
  'jobs',
  'custom',
];

export const AutomationManager: React.FC<AutomationManagerProps> = ({
  userRole = 'Super Admin',
  onJumpToAiKeys,
}) => {
  const { isUrdu } = useLanguage();
  const [activeTab, setActiveTab] = useState<AutomationTabId>('overview');

  const [providers, setProviders] = useState<DataProvider[]>([]);
  const [syncHistory, setSyncHistory] = useState<SyncJobRun[]>([]);
  const [aiDrafts, setAiDrafts] = useState<AiContentDraft[]>([]);
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  // Add / Edit Provider modal state
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [provName, setProvName] = useState('');
  const [provCategory, setProvCategory] = useState<ProviderCategory>('news');
  const [provEndpoint, setProvEndpoint] = useState('');
  const [provMethod, setProvMethod] = useState<'GET' | 'POST'>('GET');
  const [provInterval, setProvInterval] = useState(30);
  const [provStatus, setProvStatus] = useState<'active' | 'disabled'>('active');
  const [provLicenseType, setProvLicenseType] = useState<
    'public_open' | 'commercial_api' | 'govt_official' | 'rss_attributed' | 'internal'
  >('rss_attributed');
  const [provCommercialRights, setProvCommercialRights] = useState(true);
  const [provAttributionReq, setProvAttributionReq] = useState(true);
  const [provAttribution, setProvAttribution] = useState('');
  const [provRequiresKey, setProvRequiresKey] = useState(false);
  const [provAuthHeader, setProvAuthHeader] = useState('Authorization');
  const [provPlainKey, setProvPlainKey] = useState('');
  const [provDailyQuota, setProvDailyQuota] = useState(1000);
  const [provNotes, setProvNotes] = useState('');
  const [savingProvider, setSavingProvider] = useState(false);

  const loadAllData = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/admin/automation/status', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/admin/automation/history?limit=60', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/admin/automation/drafts', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/admin/automation/settings', { credentials: 'include' }).then(r => r.json()),
    ])
      .then(([statusRes, historyRes, draftsRes, settingsRes]) => {
        if (statusRes.success) setProviders(statusRes.providers || []);
        if (historyRes.success) setSyncHistory(historyRes.runs || []);
        if (draftsRes.success) setAiDrafts(draftsRes.drafts || []);
        if (settingsRes.success) setSettings(settingsRes.settings || null);
      })
      .catch(err => {
        setFeedback({ ok: false, text: err?.message || 'Failed to load automation state.' });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAllData();
    const timer = setInterval(loadAllData, 25000);
    return () => clearInterval(timer);
  }, []);

  const openAddProviderModal = (defaultCat: ProviderCategory = 'news') => {
    setEditingProviderId(null);
    setProvName('');
    setProvCategory(defaultCat);
    setProvEndpoint('');
    setProvMethod('GET');
    setProvInterval(30);
    setProvStatus('active');
    setProvLicenseType('rss_attributed');
    setProvCommercialRights(true);
    setProvAttributionReq(true);
    setProvAttribution('');
    setProvRequiresKey(false);
    setProvAuthHeader('Authorization');
    setProvPlainKey('');
    setProvDailyQuota(1000);
    setProvNotes('');
    setProviderModalOpen(true);
  };

  const openEditProviderModal = (p: DataProvider) => {
    setEditingProviderId(p.id);
    setProvName(p.name);
    setProvCategory(p.category);
    setProvEndpoint(p.endpoint);
    setProvMethod(p.method || p.httpMethod || 'GET');
    setProvInterval(p.intervalMinutes || 30);
    setProvStatus(p.status === 'disabled' ? 'disabled' : 'active');
    setProvLicenseType(p.licenseType || 'public_open');
    setProvCommercialRights(p.commercialRights ?? true);
    setProvAttributionReq(p.attributionRequired ?? true);
    setProvAttribution(p.attribution || '');
    setProvRequiresKey(p.requiresApiKey);
    setProvAuthHeader(p.authHeaderName || 'Authorization');
    setProvPlainKey('');
    setProvDailyQuota(p.dailyQuotaLimit || p.quotaLimitPerDay || 1000);
    setProvNotes(p.notes || '');
    setProviderModalOpen(true);
  };

  const handleSaveProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProvider(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/automation/providers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingProviderId || undefined,
          name: provName,
          category: provCategory,
          endpoint: provEndpoint,
          method: provMethod,
          intervalMinutes: provInterval,
          status: provStatus,
          isLicensed: provCommercialRights,
          licenseType: provLicenseType,
          commercialRights: provCommercialRights,
          attributionRequired: provAttributionReq,
          attribution: provAttribution || provName,
          requiresApiKey: provRequiresKey,
          authHeaderName: provAuthHeader,
          plainApiKey: provPlainKey || undefined,
          dailyQuotaLimit: provDailyQuota,
          notes: provNotes,
        }),
      });
      const d = await res.json();
      if (d.success) {
        setProviderModalOpen(false);
        setFeedback({ ok: true, text: `Saved provider "${d.provider?.name || provName}" cleanly.` });
        loadAllData();
      } else {
        setFeedback({ ok: false, text: d.error || 'Could not save provider.' });
      }
    } catch (err: any) {
      setFeedback({ ok: false, text: err?.message || 'Network error saving provider.' });
    } finally {
      setSavingProvider(false);
    }
  };

  const handleTestProvider = async (providerId: string) => {
    setTestingId(providerId);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/automation/providers/${providerId}/test`, {
        method: 'POST',
        credentials: 'include',
      });
      const d = await res.json();
      if (d.success && d.result) {
        setFeedback({
          ok: Boolean(d.result.ok),
          text: `${providerId}: ${d.result.message} (Validation: ${d.result.validationPassed ? 'PASSED' : 'FAILED'})`,
        });
      } else {
        setFeedback({ ok: false, text: d.error || 'Endpoint test failed.' });
      }
    } catch (err: any) {
      setFeedback({ ok: false, text: err?.message || 'Test request failed.' });
    } finally {
      setTestingId(null);
    }
  };

  const handleDeleteProvider = async (providerId: string) => {
    try {
      const res = await fetch(`/api/admin/automation/providers/${providerId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const d = await res.json();
      if (d.success) {
        setFeedback({ ok: true, text: `Deleted provider ${providerId}.` });
        loadAllData();
      } else {
        setFeedback({ ok: false, text: d.error || 'Failed to delete provider.' });
      }
    } catch (err: any) {
      setFeedback({ ok: false, text: err?.message || 'Failed deleting provider.' });
    }
  };

  const handleManualSync = async (providerId: string) => {
    setSyncingId(providerId);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/automation/sync/${providerId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({
          ok: data.run?.status !== 'failed',
          text: `${providerId}: ${data.run?.changeSummaryEn || 'Synchronized'}`,
        });
      } else {
        setFeedback({ ok: false, text: `${providerId}: ${data.error || 'Execution notice'}` });
      }
      loadAllData();
    } catch (e: any) {
      setFeedback({ ok: false, text: `Failed to trigger ${providerId}: ${e.message}` });
    } finally {
      setSyncingId(null);
    }
  };

  const handleRetryWithBackoff = async (providerId: string) => {
    setRetryingId(providerId);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/automation/retry/${providerId}`, {
        method: 'POST',
        credentials: 'include',
      });
      const d = await res.json();
      if (d.success) {
        setFeedback({
          ok: d.run?.status === 'success',
          text: `Retry finished for ${providerId}: ${d.run?.status} — ${d.run?.changeSummaryEn}`,
        });
        loadAllData();
      } else {
        setFeedback({ ok: false, text: d.error || 'Retry failed.' });
      }
    } catch (e: any) {
      setFeedback({ ok: false, text: e?.message || 'Retry failed.' });
    } finally {
      setRetryingId(null);
    }
  };

  const handleTriggerCronRun = async () => {
    setSyncingId('CRON');
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/automation/cron/run', {
        method: 'POST',
        credentials: 'include',
      });
      const d = await res.json();
      if (d.success) {
        setFeedback({
          ok: true,
          text: d.skipped
            ? `Cron dispatcher skipped: ${d.skipped}`
            : `Cron batch completed (${d.runs?.length || 0} due providers synced).`,
        });
        loadAllData();
      } else {
        setFeedback({ ok: false, text: d.error || 'Cron execution failed.' });
      }
    } catch (e: any) {
      setFeedback({ ok: false, text: e?.message || 'Cron execution failed.' });
    } finally {
      setSyncingId(null);
    }
  };

  const handleMasterSync = async () => {
    setSyncingId('ALL');
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/automation/sync-all', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ ok: true, text: `Master synchronization completed for ${data.count} providers.` });
      } else {
        setFeedback({ ok: false, text: data.error || 'Master sync failed.' });
      }
      loadAllData();
    } catch (e: any) {
      setFeedback({ ok: false, text: `Master sync error: ${e.message}` });
    } finally {
      setSyncingId(null);
    }
  };

  const handleApproveDraft = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/automation/drafts/${id}/publish`, {
        method: 'POST',
        credentials: 'include',
      });
      const d = await res.json();
      if (d.success) {
        setFeedback({ ok: true, text: 'Article approved & published to public news.' });
        loadAllData();
      } else {
        setFeedback({ ok: false, text: d.error || 'Failed to publish draft.' });
      }
    } catch (e: any) {
      setFeedback({ ok: false, text: e?.message || 'Network error approving draft.' });
    }
  };

  const handleRejectDraft = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/automation/drafts/${id}/reject`, {
        method: 'POST',
        credentials: 'include',
      });
      const d = await res.json();
      if (d.success) {
        setFeedback({ ok: true, text: 'Draft rejected and dismissed.' });
        loadAllData();
      } else {
        setFeedback({ ok: false, text: d.error || 'Failed to reject draft.' });
      }
    } catch (e: any) {
      setFeedback({ ok: false, text: e?.message || 'Network error rejecting draft.' });
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      const res = await fetch('/api/admin/automation/settings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const d = await res.json();
      if (d.success) {
        setFeedback({ ok: true, text: 'Automation engine settings saved cleanly.' });
        loadAllData();
      } else {
        setFeedback({ ok: false, text: d.error || 'Failed saving automation settings.' });
      }
    } catch (e: any) {
      setFeedback({ ok: false, text: e?.message || 'Error saving settings.' });
    }
  };

  const healthyCount = providers.filter(p => p.status === 'active' && p.consecutiveFailures === 0).length;
  const failedRunsCount = syncHistory.filter(r => r.status === 'failed').length;
  const pendingQueueCount = aiDrafts.filter(d => d.status === 'pending_review').length;

  const categoryFilterMap: Record<string, ProviderCategory[]> = {
    news: ['news'],
    finance: ['currency', 'gold', 'fuel', 'psx'],
    weather: ['weather'],
    cricket: ['cricket'],
    islamic: ['islamic'],
    education: ['education', 'jobs'],
  };

  const renderCategoryProvidersCard = (title: string, subtitle: string, cats: ProviderCategory[]) => {
    const matched = providers.filter(p => cats.includes(p.category));
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div>
            <h3 className="text-base font-black text-gray-900">{title}</h3>
            <p className="text-xs text-gray-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => openAddProviderModal(cats[0])}
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add {cats[0]} Feed</span>
          </button>
        </div>

        {matched.length === 0 ? (
          <div className="p-8 text-center bg-gray-50 border border-dashed border-gray-200 rounded-xl text-xs text-gray-500">
            No feeds registered for this domain yet. Click "Add Feed" to connect a verified RSS or JSON API endpoint.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matched.map(p => (
              <div key={p.id} className="border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-gray-900">{p.name}</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[10px] font-bold uppercase">
                        {p.category}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-gray-500 truncate max-w-sm mt-0.5">{p.endpoint}</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      p.status === 'active'
                        ? 'bg-emerald-100 text-emerald-800'
                        : p.status === 'error'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {p.status}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 text-[10px] font-semibold">
                  <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                    Every {p.intervalMinutes}m
                  </span>
                  <span className="bg-amber-50 text-amber-900 px-2 py-0.5 rounded">
                    {p.licenseType || 'public_open'} {p.commercialRights ? '• Commercial OK' : '• Attribution Only'}
                  </span>
                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
                    Quota: {p.dailyCallsUsed ?? p.quotaUsedToday ?? 0}/{p.dailyQuotaLimit ?? p.quotaLimitPerDay ?? 1000}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <span className="text-[11px] text-gray-500">
                    Last sync: {p.lastSyncAt ? new Date(p.lastSyncAt).toLocaleString() : 'Never'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleTestProvider(p.id)}
                      disabled={testingId === p.id}
                      className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-lg"
                    >
                      {testingId === p.id ? 'Testing...' : 'Test'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleManualSync(p.id)}
                      disabled={syncingId === p.id}
                      className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${syncingId === p.id ? 'animate-spin' : ''}`} />
                      <span>Sync</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditProviderModal(p)}
                      className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg"
                      title="Edit provider"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const cpanelCronCmd = `/usr/local/bin/node /home/USER/360khabarnama/node_modules/.bin/tsx server/jobs/cron-dispatcher.ts >> /home/USER/logs/cron.log 2>&1`;

  return (
    <div className="space-y-5">
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
            feedback.ok
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : 'bg-rose-50 border-rose-200 text-rose-950'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.ok ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold">{feedback.text}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="text-gray-500 hover:text-gray-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider">
            <Zap className="w-3.5 h-3.5" />
            <span>{isUrdu ? 'لائیو ڈیٹا و آٹومیشن کنٹرول' : 'Automation, Cron Dispatcher & Feeds Engine'}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black">
            {isUrdu ? 'مرکزی خودکار سنکرونائزیشن مینیجر' : 'Central Synchronization & Custom Feeds Manager'}
          </h1>
          <p className="text-xs text-slate-300 max-w-2xl">
            Manage verified market rates, weather, cricket, RSS news sources, Namecheap 5-minute cron locks, schema validation, and AI editorial verification.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => openAddProviderModal('news')}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Add Feed / API</span>
          </button>
          <button
            type="button"
            onClick={handleTriggerCronRun}
            disabled={syncingId === 'CRON'}
            className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{syncingId === 'CRON' ? 'Running Cron...' : 'Run Due Cron Batch'}</span>
          </button>
          <button
            type="button"
            onClick={handleMasterSync}
            disabled={syncingId === 'ALL'}
            className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-gray-950 font-black text-xs rounded-xl inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncingId === 'ALL' ? 'animate-spin' : ''}`} />
            <span>{syncingId === 'ALL' ? 'Syncing All...' : 'Sync All Now'}</span>
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <span className="text-[11px] font-bold uppercase text-gray-500">Registered Providers</span>
          <div className="text-2xl font-black text-gray-900 font-mono mt-1">{providers.length}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <span className="text-[11px] font-bold uppercase text-gray-500">Healthy Feeds</span>
          <div className="text-2xl font-black text-emerald-700 font-mono mt-1">{healthyCount}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <span className="text-[11px] font-bold uppercase text-gray-500">Verification Queue</span>
          <div className="text-2xl font-black text-amber-600 font-mono mt-1">{pendingQueueCount}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <span className="text-[11px] font-bold uppercase text-gray-500">Failed Sync Runs</span>
          <div className="text-2xl font-black text-rose-600 font-mono mt-1">{failedRunsCount}</div>
        </div>
      </div>

      {/* 13-Tab Navigation Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-gray-200 no-scrollbar">
        {[
          { id: 'overview', label: 'Overview', icon: Activity },
          { id: 'providers', label: `All Providers (${providers.length})`, icon: Database },
          { id: 'news', label: 'News Feeds', icon: Newspaper },
          { id: 'finance', label: 'Finance & Fuel', icon: TrendingUp },
          { id: 'weather', label: 'Weather & AQI', icon: CloudSun },
          { id: 'cricket', label: 'Cricket', icon: Trophy },
          { id: 'islamic', label: 'Islamic', icon: Moon },
          { id: 'education', label: 'Education & Jobs', icon: GraduationCap },
          { id: 'schedules', label: 'Schedules & cPanel Cron', icon: Clock },
          { id: 'manual', label: 'Manual Runner', icon: RefreshCw },
          { id: 'validation', label: 'Validation Guard', icon: ShieldAlert },
          { id: 'logs', label: `Sync Logs (${syncHistory.length})`, icon: FileText },
          { id: 'ai-settings', label: 'AI Automation', icon: Sparkles },
          {
            id: 'verification-queue',
            label: `Queue (${pendingQueueCount})`,
            icon: ShieldCheck,
            badge: pendingQueueCount,
          },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as AutomationTabId)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-emerald-800 text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.badge && tab.badge > 0 ? (
                <span className="bg-amber-400 text-gray-950 text-[10px] px-1.5 rounded-full font-black">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {providers.map(p => (
            <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="bg-gray-100 text-gray-800 text-[10px] font-bold uppercase px-2 py-0.5 rounded">
                  {p.category}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                    p.status === 'active'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {p.status}
                </span>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">{p.name}</h3>
                <p className="text-[11px] text-gray-500 truncate">{p.attribution}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2.5 text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Interval:</span>
                  <span className="font-mono">Every {p.intervalMinutes}m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Last Sync:</span>
                  <span>{p.lastSyncAt ? new Date(p.lastSyncAt).toLocaleTimeString() : 'Pending'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Success Rate:</span>
                  <span className="font-mono">
                    {p.successfulSyncs}/{p.totalSyncs}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => handleTestProvider(p.id)}
                  disabled={testingId === p.id}
                  className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-lg"
                >
                  {testingId === p.id ? 'Testing...' : 'Test'}
                </button>
                <button
                  type="button"
                  onClick={() => handleManualSync(p.id)}
                  disabled={syncingId === p.id}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingId === p.id ? 'animate-spin' : ''}`} />
                  <span>Sync</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ALL PROVIDERS */}
      {activeTab === 'providers' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-base text-gray-900">Provider & Custom Feed Registry</h3>
              <p className="text-xs text-gray-500">
                API keys are AES-256-GCM encrypted on the server and masked in admin responses.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search providers..."
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs w-52"
                />
              </div>
              <button
                type="button"
                onClick={() => openAddProviderModal('news')}
                className="px-3 py-1.5 bg-emerald-700 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Feed</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-gray-50 text-gray-600 font-bold border-y">
                  <th className="p-3">Provider & Attribution</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Endpoint</th>
                  <th className="p-3">License & Quota</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {providers
                  .filter(
                    p =>
                      !searchFilter ||
                      p.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
                      p.category.toLowerCase().includes(searchFilter.toLowerCase())
                  )
                  .map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="p-3">
                        <div className="font-bold text-gray-900">{p.name}</div>
                        <div className="text-[10px] text-gray-500">{p.attribution}</div>
                      </td>
                      <td className="p-3">
                        <span className="bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                          {p.category}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-gray-600 truncate max-w-[220px]">
                        {p.endpoint}
                      </td>
                      <td className="p-3 text-[11px]">
                        <div className="font-semibold text-gray-800">{p.licenseType || 'public_open'}</div>
                        <div className="text-[10px] text-gray-500 font-mono">
                          {p.dailyCallsUsed ?? p.quotaUsedToday ?? 0}/{p.dailyQuotaLimit ?? p.quotaLimitPerDay ?? 1000} calls
                          {p.maskedApiKey ? ` • ${p.maskedApiKey}` : ''}
                        </div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            p.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleTestProvider(p.id)}
                            disabled={testingId === p.id}
                            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded font-bold"
                          >
                            {testingId === p.id ? '...' : 'Test'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleManualSync(p.id)}
                            disabled={syncingId === p.id}
                            className="px-2 py-1 bg-emerald-700 text-white rounded font-bold"
                          >
                            Sync
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditProviderModal(p)}
                            className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {!p.isBuiltIn && (
                            <button
                              type="button"
                              onClick={() => handleDeleteProvider(p.id)}
                              className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DOMAIN CATEGORY TABS */}
      {categoryFilterMap[activeTab] &&
        renderCategoryProvidersCard(
          `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Sync Feeds`,
          'Domain-specific feeds with commercial rights and daily quota enforcement.',
          categoryFilterMap[activeTab]
        )}

      {/* SCHEDULES & NAMECHEAP CPANEL CRON */}
      {activeTab === 'schedules' && settings && (
        <div className="space-y-5">
          <div className="bg-slate-900 text-white rounded-xl p-5 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-emerald-300">Namecheap Shared Hosting (cPanel 5-Minute Cron)</h3>
                <p className="text-slate-300 mt-0.5">
                  Configure this CLI dispatcher command every 5 minutes in cPanel. Database locking prevents overlapping runs.
                </p>
              </div>
              <span className="font-mono text-[11px] bg-slate-800 px-2.5 py-1 rounded text-amber-300">
                Last Cron: {settings.lastCronRunAt ? new Date(settings.lastCronRunAt).toLocaleString() : 'Not yet triggered'}
              </span>
            </div>
            <div className="bg-black/60 border border-slate-700 rounded-lg p-3 font-mono text-[11px] text-emerald-200 flex items-center justify-between gap-2">
              <span className="truncate">*/5 * * * * {cpanelCronCmd}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(`*/5 * * * * ${cpanelCronCmd}`);
                  setFeedback({ ok: true, text: 'Copied cPanel cron command to clipboard.' });
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded inline-flex items-center gap-1 shrink-0"
              >
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveSettings} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="p-3.5 bg-gray-50 border rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-gray-900 block">Autonomous Master Scheduler</span>
                  <span className="text-gray-500 text-[11px]">Run due providers automatically</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoSyncEnabled}
                  onChange={e => setSettings({ ...settings, autoSyncEnabled: e.target.checked })}
                />
              </label>

              <label className="p-3.5 bg-gray-50 border rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-gray-900 block">Auto-Publish Verified Market Rates</span>
                  <span className="text-gray-500 text-[11px]">Update live tickers automatically after validation</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoPublishFactualWidgets}
                  onChange={e => setSettings({ ...settings, autoPublishFactualWidgets: e.target.checked })}
                />
              </label>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Max Jobs Per Cron Execution</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={settings.cronBatchLimit ?? 4}
                  onChange={e => setSettings({ ...settings, cronBatchLimit: parseInt(e.target.value) || 4 })}
                  className="w-full p-2.5 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Currency Sync Interval (Min)</label>
                <input
                  type="number"
                  min={5}
                  value={settings.currencySyncIntervalMin}
                  onChange={e => setSettings({ ...settings, currencySyncIntervalMin: parseInt(e.target.value) || 30 })}
                  className="w-full p-2.5 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Gold & Bullion Interval (Min)</label>
                <input
                  type="number"
                  min={10}
                  value={settings.goldSyncIntervalMin}
                  onChange={e => setSettings({ ...settings, goldSyncIntervalMin: parseInt(e.target.value) || 60 })}
                  className="w-full p-2.5 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Weather Interval (Min)</label>
                <input
                  type="number"
                  min={15}
                  value={settings.weatherSyncIntervalMin}
                  onChange={e => setSettings({ ...settings, weatherSyncIntervalMin: parseInt(e.target.value) || 60 })}
                  className="w-full p-2.5 border border-gray-300 rounded-lg font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg"
              >
                Save Schedule Settings
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MANUAL SYNC */}
      {activeTab === 'manual' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {providers.map(p => (
              <div key={p.id} className="border border-gray-200 rounded-xl p-4 flex flex-col justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase text-gray-400">
                    {p.category} • {p.totalSyncs} runs
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm mt-0.5">{p.name}</h4>
                  <p className="text-[11px] text-gray-500 mt-0.5">{p.attribution}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleManualSync(p.id)}
                  disabled={syncingId === p.id}
                  className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg inline-flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingId === p.id ? 'animate-spin' : ''}`} />
                  <span>{syncingId === p.id ? 'Syncing...' : 'Sync Adapter Now'}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VALIDATION GUARD */}
      {activeTab === 'validation' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 text-xs">
          <div>
            <h3 className="font-black text-base text-gray-900">Schema & Sanity Validation Ledger</h3>
            <p className="text-gray-500">
              Every upstream API sync is inspected against range & type checks before updating public rates.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-y text-gray-600 font-bold">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Provider</th>
                  <th className="p-3">HTTP</th>
                  <th className="p-3">Validation</th>
                  <th className="p-3">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {syncHistory.slice(0, 30).map(r => (
                  <tr key={r.id}>
                    <td className="p-3 font-mono text-[11px] text-gray-500">{new Date(r.timestamp).toLocaleString()}</td>
                    <td className="p-3 font-bold">{r.providerName}</td>
                    <td className="p-3 font-mono">{r.httpStatus ?? '—'}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          r.validationPassed !== false && r.status === 'success'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {r.validationPassed !== false && r.status === 'success' ? 'Passed' : 'Flagged'}
                      </span>
                    </td>
                    <td className="p-3 text-gray-700">{r.changeSummaryEn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SYNC LOGS + RETRY WITH BACKOFF */}
      {activeTab === 'logs' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-base text-gray-900">Sync Execution Logs</h3>
            <button
              type="button"
              onClick={loadAllData}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold inline-flex items-center gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-y text-gray-600 font-bold">
                <tr>
                  <th className="p-3">Time</th>
                  <th className="p-3">Provider</th>
                  <th className="p-3">Trigger</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Duration</th>
                  <th className="p-3">Summary & Errors</th>
                  <th className="p-3 text-right">Recovery</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {syncHistory.map(run => (
                  <tr key={run.id}>
                    <td className="p-3 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                      {new Date(run.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="p-3 font-bold text-gray-900">{run.providerName}</td>
                    <td className="p-3 font-mono text-[11px] text-gray-600">{run.triggeredBy || 'manual'}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          run.status === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-gray-500">{run.durationMs}ms</td>
                    <td className="p-3">
                      <div className="text-gray-800">{run.changeSummaryEn}</div>
                      {run.errorDetails && (
                        <div className="text-rose-600 font-mono text-[10px] mt-0.5">{run.errorDetails}</div>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {run.status === 'failed' && (
                        <button
                          type="button"
                          onClick={() => handleRetryWithBackoff(run.providerId)}
                          disabled={retryingId === run.providerId}
                          className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold rounded text-[11px]"
                        >
                          {retryingId === run.providerId ? 'Retrying...' : 'Retry Backoff'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI AUTOMATION SETTINGS */}
      {activeTab === 'ai-settings' && settings && (
        <form onSubmit={handleSaveSettings} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
            <div>
              <h3 className="font-black text-base text-gray-900">Automated AI Briefing Pipeline</h3>
              <p className="text-gray-500">
                Routed automatically via the central AI Provider Router & encrypted API Key Vault (task: breaking_alerts).
              </p>
            </div>
            {onJumpToAiKeys && (
              <button
                type="button"
                onClick={onJumpToAiKeys}
                className="px-3.5 py-2 bg-slate-900 text-white font-bold rounded-lg inline-flex items-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span>Manage AI Keys & Models</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <label className="p-4 bg-gray-50 border rounded-xl flex items-center justify-between">
              <div>
                <span className="font-bold text-gray-900 block">Automated Bilingual Drafts</span>
                <span className="text-gray-500 text-[11px]">
                  Generate source-grounded English & Urdu news drafts upon verified price shifts
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.aiDraftsEnabled}
                onChange={e => setSettings({ ...settings, aiDraftsEnabled: e.target.checked })}
              />
            </label>

            <div>
              <label className="block font-bold text-gray-700 mb-1">API Cooldown Window (Minutes)</label>
              <input
                type="number"
                min={5}
                max={180}
                value={settings.geminiCooldownMin}
                onChange={e => setSettings({ ...settings, geminiCooldownMin: parseInt(e.target.value) || 20 })}
                className="w-full p-2.5 border border-gray-300 rounded-lg font-mono"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Prevents duplicate AI drafting calls during rapid market movements.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg">
              Save AI Automation Rules
            </button>
          </div>
        </form>
      )}

      {/* VERIFICATION QUEUE */}
      {activeTab === 'verification-queue' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="border-b border-gray-100 pb-3">
            <h3 className="font-black text-base text-gray-900">Editorial Verification Queue</h3>
            <p className="text-xs text-gray-500">
              AI-drafted market stories anchored strictly to verified feed snapshots awaiting editorial approval.
            </p>
          </div>

          {aiDrafts.length === 0 ? (
            <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200 text-xs text-gray-500">
              No pending drafts in the verification queue.
            </div>
          ) : (
            <div className="space-y-3">
              {aiDrafts.map(draft => (
                <div key={draft.id} className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                        {draft.category} • {draft.triggerReason}
                      </span>
                      <h4 className="font-bold text-gray-900 text-sm mt-1">{draft.titleEn}</h4>
                      <h4 className="font-urdu text-gray-800 text-sm" dir="rtl">
                        {draft.titleUr}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      {draft.status === 'pending_review' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleApproveDraft(draft.id)}
                            className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg inline-flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve & Publish</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectDraft(draft.id)}
                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-lg inline-flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Dismiss</span>
                          </button>
                        </>
                      ) : (
                        <span className="text-xs font-bold uppercase text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded">
                          {draft.status}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <p className="text-gray-700">{draft.summaryEn}</p>
                    <p className="font-urdu text-gray-800" dir="rtl">
                      {draft.summaryUr}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ADD / EDIT DATA PROVIDER MODAL */}
      {providerModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveProvider}
            className="bg-white border border-gray-200 rounded-2xl max-w-lg w-full p-6 space-y-4 text-xs max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b pb-2.5">
              <h3 className="text-sm font-black text-gray-900">
                {editingProviderId ? 'Edit Automation Feed Provider' : 'Register Custom RSS / REST Feed Provider'}
              </h3>
              <button type="button" onClick={() => setProviderModalOpen(false)}>
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Provider Name</label>
                <input
                  type="text"
                  required
                  value={provName}
                  onChange={e => setProvName(e.target.value)}
                  placeholder="e.g. Dawn / Radio Pakistan RSS"
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Domain Category</label>
                <select
                  value={provCategory}
                  onChange={e => setProvCategory(e.target.value as ProviderCategory)}
                  className="w-full p-2 border border-gray-300 rounded-lg bg-white"
                >
                  {PROVIDER_CATEGORIES.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-3">
                <label className="block font-bold text-gray-700 mb-1">Endpoint URL (HTTPS)</label>
                <input
                  type="url"
                  required
                  value={provEndpoint}
                  onChange={e => setProvEndpoint(e.target.value)}
                  placeholder="https://api.example.com/v1/feed.json"
                  className="w-full p-2 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Method</label>
                <select
                  value={provMethod}
                  onChange={e => setProvMethod(e.target.value as 'GET' | 'POST')}
                  className="w-full p-2 border border-gray-300 rounded-lg bg-white"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Interval (Min)</label>
                <input
                  type="number"
                  min={5}
                  value={provInterval}
                  onChange={e => setProvInterval(parseInt(e.target.value) || 30)}
                  className="w-full p-2 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Daily Quota</label>
                <input
                  type="number"
                  min={10}
                  value={provDailyQuota}
                  onChange={e => setProvDailyQuota(parseInt(e.target.value) || 1000)}
                  className="w-full p-2 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Status</label>
                <select
                  value={provStatus}
                  onChange={e => setProvStatus(e.target.value as 'active' | 'disabled')}
                  className="w-full p-2 border border-gray-300 rounded-lg bg-white"
                >
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-gray-700 mb-1">License Type</label>
                <select
                  value={provLicenseType}
                  onChange={e => setProvLicenseType(e.target.value as any)}
                  className="w-full p-2 border border-gray-300 rounded-lg bg-white"
                >
                  <option value="public_open">Public Open API</option>
                  <option value="govt_official">Official Govt Portal</option>
                  <option value="commercial_api">Commercial License</option>
                  <option value="rss_attributed">Attributed RSS</option>
                  <option value="internal">Internal Endpoint</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Source Attribution Text</label>
                <input
                  type="text"
                  value={provAttribution}
                  onChange={e => setProvAttribution(e.target.value)}
                  placeholder="Source agency or publisher"
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center justify-between p-2.5 bg-gray-50 border rounded-lg">
                <span className="font-bold">Commercial Rights Cleared</span>
                <input
                  type="checkbox"
                  checked={provCommercialRights}
                  onChange={e => setProvCommercialRights(e.target.checked)}
                />
              </label>
              <label className="flex items-center justify-between p-2.5 bg-gray-50 border rounded-lg">
                <span className="font-bold">Requires API Secret</span>
                <input
                  type="checkbox"
                  checked={provRequiresKey}
                  onChange={e => setProvRequiresKey(e.target.checked)}
                />
              </label>
            </div>

            {provRequiresKey && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <div>
                  <label className="block font-bold text-amber-950 mb-1">Auth Header Name</label>
                  <input
                    type="text"
                    value={provAuthHeader}
                    onChange={e => setProvAuthHeader(e.target.value)}
                    className="w-full p-2 border border-amber-300 rounded-lg font-mono bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-amber-950 mb-1">
                    {editingProviderId ? 'Replace Secret (optional)' : 'API Key / Secret'}
                  </label>
                  <input
                    type="password"
                    value={provPlainKey}
                    onChange={e => setProvPlainKey(e.target.value)}
                    placeholder="Encrypted AES-256-GCM at rest"
                    className="w-full p-2 border border-amber-300 rounded-lg font-mono bg-white"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setProviderModalOpen(false)}
                className="px-4 py-2 bg-gray-100 rounded-lg font-bold text-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingProvider}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold"
              >
                {savingProvider ? 'Saving...' : 'Save Provider'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
