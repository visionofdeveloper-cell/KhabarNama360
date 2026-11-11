/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Live Data & Automation Manager Component
 */

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../src/context/LanguageContext.tsx';
import { DataProvider, SyncJobRun, AiContentDraft, AutomationSettings } from '../../src/server/automation/types.ts';
import {
  Zap,
  Radio,
  Database,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Settings,
  Sparkles,
  ShieldCheck,
  Activity,
  Calendar,
  Sliders,
  Check,
  X,
  Eye,
  FileText,
  Search,
  Cpu,
  Layers,
  ArrowRight
} from 'lucide-react';

interface AutomationManagerProps {
  userRole?: string;
}

export const AutomationManager: React.FC<AutomationManagerProps> = ({ userRole = 'Super Admin' }) => {
  const { isUrdu } = useLanguage();
  const [activeTab, setActiveTab] = useState<
    'overview' | 'providers' | 'schedules' | 'logs' | 'manual' | 'ai-settings' | 'verification-queue'
  >('overview');

  const [providers, setProviders] = useState<DataProvider[]>([]);
  const [syncHistory, setSyncHistory] = useState<SyncJobRun[]>([]);
  const [aiDrafts, setAiDrafts] = useState<AiContentDraft[]>([]);
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  const loadAllData = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/admin/automation/status').then(r => r.json()),
      fetch('/api/admin/automation/history?limit=50').then(r => r.json()),
      fetch('/api/admin/automation/drafts').then(r => r.json()),
      fetch('/api/admin/automation/settings').then(r => r.json()),
    ])
      .then(([statusRes, historyRes, draftsRes, settingsRes]) => {
        if (statusRes.success) {
          setProviders(statusRes.providers || []);
        }
        if (historyRes.success) {
          setSyncHistory(historyRes.runs || []);
        }
        if (draftsRes.success) {
          setAiDrafts(draftsRes.drafts || []);
        }
        if (settingsRes.success) {
          setSettings(settingsRes.settings || null);
        }
      })
      .catch(err => {
        console.error('Failed to load automation data:', err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAllData();
    const timer = setInterval(loadAllData, 20000);
    return () => clearInterval(timer);
  }, []);

  const handleManualSync = async (providerId: string) => {
    setSyncingId(providerId);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/automation/sync/${providerId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-user': userRole,
        },
      });
      const data = await res.json();
      if (data.success) {
        setFeedback(`✓ ${providerId} synchronized: ${data.run?.changeSummaryEn || 'Updated'}`);
      } else {
        setFeedback(`⚠ ${providerId}: ${data.error || 'Execution notice'}`);
      }
      loadAllData();
    } catch (e: any) {
      setFeedback(`✗ Failed to trigger ${providerId}: ${e.message}`);
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
        headers: { 'x-admin-user': userRole },
      });
      const data = await res.json();
      if (data.success) {
        setFeedback(`✓ Master synchronization completed for ${data.count} providers.`);
      }
      loadAllData();
    } catch (e: any) {
      setFeedback(`✗ Master sync error: ${e.message}`);
    } finally {
      setSyncingId(null);
    }
  };

  const handleApproveDraft = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/automation/drafts/${id}/publish`, {
        method: 'POST',
        headers: { 'x-admin-user': userRole },
      });
      const d = await res.json();
      if (d.success) {
        setFeedback('✓ Article approved & published to public news!');
        loadAllData();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleRejectDraft = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/automation/drafts/${id}/reject`, {
        method: 'POST',
        headers: { 'x-admin-user': userRole },
      });
      const d = await res.json();
      if (d.success) {
        setFeedback('Draft rejected and dismissed.');
        loadAllData();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      const res = await fetch('/api/admin/automation/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-user': userRole,
        },
        body: JSON.stringify(settings),
      });
      const d = await res.json();
      if (d.success) {
        setFeedback('✓ Automation engine settings saved.');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const healthyCount = providers.filter(p => p.status === 'active' && p.consecutiveFailures === 0).length;
  const failedRunsCount = syncHistory.filter(r => r.status === 'failed').length;
  const pendingQueueCount = aiDrafts.filter(d => d.status === 'pending_review').length;

  return (
    <div className="space-y-6">
      {/* Banner & Feedback */}
      {feedback && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-2xl text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{feedback}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-emerald-700 hover:text-emerald-900 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Header Bar with Master Trigger */}
      <div className="bg-gradient-to-r from-gray-950 via-emerald-950 to-gray-900 text-white rounded-3xl p-6 sm:p-8 border border-emerald-900/40 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5" />
              <span>{isUrdu ? 'لائیو ڈیٹا و آٹومیشن کنٹرول' : 'Live Data & Automation Engine'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black">
              {isUrdu ? 'مرکزی خودکار سنکرونائزیشن مینیجر' : 'Central Synchronization & Feeds Manager'}
            </h1>
            <p className="text-xs text-emerald-200/80 max-w-2xl leading-relaxed">
              Autonomous background workers polling State Bank of Pakistan, Open-Meteo, APGJAA Bullion Sarafa, OGRA Petroleum Gazette, and PCB live feeds with strict zero-hallucination policies.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleMasterSync}
              disabled={syncingId === 'ALL'}
              className="px-5 py-3 bg-amber-400 hover:bg-amber-300 text-gray-950 font-black text-xs rounded-2xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncingId === 'ALL' ? 'animate-spin' : ''}`} />
              <span>{syncingId === 'ALL' ? 'Synchronizing All Feeds...' : 'Sync All Feeds Now'}</span>
            </button>
          </div>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-emerald-900/50">
          <div className="bg-gray-900/60 border border-emerald-900/40 rounded-2xl p-3.5">
            <span className="text-[11px] text-gray-400 block font-bold uppercase">Active Adapters</span>
            <span className="text-2xl font-black text-white font-mono">{providers.length}</span>
            <span className="text-[10px] text-emerald-400 block mt-0.5">● 100% Configured</span>
          </div>
          <div className="bg-gray-900/60 border border-emerald-900/40 rounded-2xl p-3.5">
            <span className="text-[11px] text-gray-400 block font-bold uppercase">Healthy Feeds</span>
            <span className="text-2xl font-black text-emerald-400 font-mono">{healthyCount}</span>
            <span className="text-[10px] text-gray-400 block mt-0.5">Zero consecutive failures</span>
          </div>
          <div className="bg-gray-900/60 border border-emerald-900/40 rounded-2xl p-3.5">
            <span className="text-[11px] text-gray-400 block font-bold uppercase">Verification Queue</span>
            <span className="text-2xl font-black text-amber-300 font-mono">{pendingQueueCount}</span>
            <span className="text-[10px] text-amber-200/80 block mt-0.5">Awaiting editorial sign-off</span>
          </div>
          <div className="bg-gray-900/60 border border-emerald-900/40 rounded-2xl p-3.5">
            <span className="text-[11px] text-gray-400 block font-bold uppercase">Failed Runs</span>
            <span className="text-2xl font-black text-rose-400 font-mono">{failedRunsCount}</span>
            <span className="text-[10px] text-gray-400 block mt-0.5">Auto-retried with backoff</span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 overflow-x-auto pb-2 no-scrollbar">
        {[
          { id: 'overview', label: 'Overview', icon: Activity },
          { id: 'providers', label: `API Providers (${providers.length})`, icon: Database },
          { id: 'schedules', label: 'Schedules & Cron', icon: Clock },
          { id: 'logs', label: `Sync Logs (${syncHistory.length})`, icon: FileText },
          { id: 'manual', label: 'Manual Sync Studio', icon: RefreshCw },
          { id: 'ai-settings', label: 'AI Generation Settings', icon: Sparkles },
          { id: 'verification-queue', label: `Verification Queue (${pendingQueueCount})`, icon: ShieldCheck, badge: pendingQueueCount },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                isActive
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.badge && tab.badge > 0 && (
                <span className="bg-amber-400 text-gray-950 text-[10px] px-1.5 py-0.2 rounded-full font-black">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {providers.map(p => (
              <div key={p.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="bg-gray-100 text-gray-700 text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full">
                    {p.category}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    ACTIVE
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">{p.name}</h3>
                  <p className="text-[11px] text-gray-500 line-clamp-1">{p.attribution}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-2.5 text-[11px] font-mono space-y-1">
                  <div className="flex justify-between text-gray-600">
                    <span className="font-sans text-[10px] text-gray-400">INTERVAL:</span>
                    <span>Every {p.intervalMinutes}m</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span className="font-sans text-[10px] text-gray-400">LAST SYNC:</span>
                    <span className="text-gray-900 font-sans">{p.lastSyncAt ? new Date(p.lastSyncAt).toLocaleTimeString() : 'Pending'}</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-100 flex justify-end">
                  <button
                    onClick={() => handleManualSync(p.id)}
                    disabled={syncingId === p.id}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-emerald-700 hover:text-white text-gray-800 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingId === p.id ? 'animate-spin' : ''}`} />
                    <span>Sync</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: API PROVIDERS */}
      {activeTab === 'providers' && (
        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
            <div>
              <h3 className="font-black text-base text-gray-900">Registered Automation Gateways</h3>
              <p className="text-xs text-gray-500">Official endpoints connected with server-side validation</p>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search provider..."
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-300 rounded-xl text-xs w-56"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="bg-gray-50 text-gray-600 font-bold border-y">
                  <th className="p-3 text-start">Provider & Domain</th>
                  <th className="p-3 text-center">Category</th>
                  <th className="p-3 text-start">Endpoint URL</th>
                  <th className="p-3 text-center">Authentication</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-end">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {providers
                  .filter(p => !searchFilter || p.name.toLowerCase().includes(searchFilter.toLowerCase()))
                  .map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="p-3">
                        <div className="font-bold text-gray-900">{p.name}</div>
                        <div className="text-gray-400 text-[10px]">{p.attribution}</div>
                      </td>
                      <td className="p-3 text-center">
                        <span className="bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                          {p.category}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-gray-600 text-[11px] truncate max-w-xs">
                        {p.endpoint}
                      </td>
                      <td className="p-3 text-center text-gray-600">
                        <span className="bg-gray-100 px-2 py-0.5 rounded font-mono text-[10px]">
                          {p.requiresApiKey ? 'Encrypted Bearer' : 'Public Official'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                          {p.status}
                        </span>
                      </td>
                      <td className="p-3 text-end">
                        <button
                          onClick={() => handleManualSync(p.id)}
                          disabled={syncingId === p.id}
                          className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg transition-colors inline-flex items-center gap-1 text-[11px]"
                        >
                          <RefreshCw className={`w-3 h-3 ${syncingId === p.id ? 'animate-spin' : ''}`} />
                          <span>Test</span>
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SCHEDULES */}
      {activeTab === 'schedules' && settings && (
        <form onSubmit={handleSaveSettings} className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs space-y-6">
          <div className="border-b pb-4">
            <h3 className="font-black text-base text-gray-900">Background Polling Schedules & Frequency</h3>
            <p className="text-xs text-gray-500">Configure background sync intervals based on market activity windows</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-gray-900 block text-sm">Autonomous Master Scheduler</span>
                  <span className="text-gray-500 text-[11px]">Allow background jobs to execute periodically</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoSyncEnabled}
                  onChange={e => setSettings({ ...settings, autoSyncEnabled: e.target.checked })}
                  className="w-5 h-5 text-emerald-600 rounded"
                />
              </div>

              <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-gray-900 block text-sm">Auto-Publish Verified Rates</span>
                  <span className="text-gray-500 text-[11px]">Publish market fluctuations directly to public tickers</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoPublishFactualWidgets}
                  onChange={e => setSettings({ ...settings, autoPublishFactualWidgets: e.target.checked })}
                  className="w-5 h-5 text-emerald-600 rounded"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Currency Sync Interval (Minutes)</label>
                <input
                  type="number"
                  min={5}
                  max={720}
                  value={settings.currencySyncIntervalMin}
                  onChange={e => setSettings({ ...settings, currencySyncIntervalMin: parseInt(e.target.value) || 30 })}
                  className="w-full p-2.5 bg-gray-50 border rounded-xl font-mono text-xs"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Gold & Bullion Interval (Minutes)</label>
                <input
                  type="number"
                  min={10}
                  max={720}
                  value={settings.goldSyncIntervalMin}
                  onChange={e => setSettings({ ...settings, goldSyncIntervalMin: parseInt(e.target.value) || 60 })}
                  className="w-full p-2.5 bg-gray-50 border rounded-xl font-mono text-xs"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Weather & Smog (AQI) Interval (Minutes)</label>
                <input
                  type="number"
                  min={15}
                  max={1440}
                  value={settings.weatherSyncIntervalMin}
                  onChange={e => setSettings({ ...settings, weatherSyncIntervalMin: parseInt(e.target.value) || 60 })}
                  className="w-full p-2.5 bg-gray-50 border rounded-xl font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-md transition-colors"
            >
              Save Schedule Settings
            </button>
          </div>
        </form>
      )}

      {/* TAB 4: LOGS */}
      {activeTab === 'logs' && (
        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h3 className="font-black text-base text-gray-900">Execution Telemetry Ledger</h3>
              <p className="text-xs text-gray-500">Audit trail of automated and manual worker runs</p>
            </div>
            <button
              onClick={loadAllData}
              className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="bg-gray-50 text-gray-600 font-bold border-y">
                  <th className="p-3 text-start">Timestamp</th>
                  <th className="p-3 text-start">Provider</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Latency</th>
                  <th className="p-3 text-start">Summary & Changes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono">
                {syncHistory.map(run => (
                  <tr key={run.id} className="hover:bg-gray-50 font-sans">
                    <td className="p-3 text-[11px] text-gray-500 whitespace-nowrap font-mono">
                      {new Date(run.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="p-3 font-bold text-gray-900 whitespace-nowrap">
                      {run.providerName}
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          run.status === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td className="p-3 text-center font-mono text-gray-500 whitespace-nowrap">
                      {run.durationMs}ms
                    </td>
                    <td className="p-3 text-gray-800 text-xs">
                      {run.changeSummaryEn || 'Synchronized without error.'}
                      {run.errorDetails && (
                        <div className="text-rose-600 font-mono text-[10px] mt-0.5">{run.errorDetails}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: MANUAL SYNC */}
      {activeTab === 'manual' && (
        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs space-y-6">
          <div className="border-b pb-4">
            <h3 className="font-black text-base text-gray-900">Manual Provider Execution Studio</h3>
            <p className="text-xs text-gray-500">Trigger immediate synchronization outside of scheduled cron cycles</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {providers.map(p => (
              <div key={p.id} className="border border-gray-200 rounded-2xl p-4 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between text-[10px] text-gray-400 font-bold uppercase mb-1">
                    <span>{p.category}</span>
                    <span>Total Runs: {p.totalSyncs}</span>
                  </div>
                  <h4 className="font-bold text-gray-900 text-xs">{p.name}</h4>
                  <p className="text-[11px] text-gray-500 mt-0.5">{p.attribution}</p>
                </div>
                <button
                  onClick={() => handleManualSync(p.id)}
                  disabled={syncingId === p.id}
                  className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingId === p.id ? 'animate-spin' : ''}`} />
                  <span>{syncingId === p.id ? 'Syncing...' : 'Sync This Adapter'}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: AI GENERATION SETTINGS */}
      {activeTab === 'ai-settings' && settings && (
        <form onSubmit={handleSaveSettings} className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs space-y-6">
          <div className="border-b pb-4">
            <h3 className="font-black text-base text-gray-900">Gemini AI Content Engine Settings</h3>
            <p className="text-xs text-gray-500">Rules for source-grounded journalistic draft generation</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 border rounded-2xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-gray-900 block text-sm">Automated Bilingual Drafts</span>
                  <span className="text-gray-500 text-[11px]">Generate English & Urdu stories upon major market shifts</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.aiDraftsEnabled}
                  onChange={e => setSettings({ ...settings, aiDraftsEnabled: e.target.checked })}
                  className="w-5 h-5 text-emerald-600 rounded"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Gemini AI Model</label>
                <input
                  type="text"
                  disabled
                  value="gemini-3.8-flash (Source-Grounded)"
                  className="w-full p-2.5 bg-gray-100 border rounded-xl font-mono text-xs text-gray-600"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">API Cooldown Window (Minutes)</label>
              <input
                type="number"
                min={5}
                max={180}
                value={settings.geminiCooldownMin}
                onChange={e => setSettings({ ...settings, geminiCooldownMin: parseInt(e.target.value) || 20 })}
                className="w-full p-2.5 bg-gray-50 border rounded-xl font-mono text-xs"
              />
              <p className="text-[11px] text-gray-400 mt-1">Prevents repeated LLM calls when price updates happen in rapid bursts.</p>
            </div>
          </div>

          <div className="pt-4 border-t flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-md transition-colors"
            >
              Update AI Parameters
            </button>
          </div>
        </form>
      )}

      {/* TAB 7: VERIFICATION QUEUE */}
      {activeTab === 'verification-queue' && (
        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="border-b pb-4">
            <h3 className="font-black text-base text-gray-900">Verification & Sanity Review Queue</h3>
            <p className="text-xs text-gray-500">Bilingual drafts and market anomalies flagged for editorial verification</p>
          </div>

          {aiDrafts.length === 0 ? (
            <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-xs text-gray-500">
              No pending drafts or anomalies in the verification queue.
            </div>
          ) : (
            <div className="space-y-4">
              {aiDrafts.map(draft => (
                <div key={draft.id} className="border border-gray-200 rounded-2xl p-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                        {draft.category} • {draft.triggerReason}
                      </span>
                      <h4 className="font-bold text-gray-900 text-sm mt-1">{draft.titleEn}</h4>
                      <h4 className="font-urdu text-gray-800 text-sm" dir="rtl">{draft.titleUr}</h4>
                    </div>

                    <div className="flex items-center gap-2">
                      {draft.status === 'pending_review' ? (
                        <>
                          <button
                            onClick={() => handleApproveDraft(draft.id)}
                            className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve & Publish</span>
                          </button>
                          <button
                            onClick={() => handleRejectDraft(draft.id)}
                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Dismiss</span>
                          </button>
                        </>
                      ) : (
                        <span className="text-xs font-bold uppercase text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                          {draft.status}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <p className="text-gray-700">{draft.summaryEn}</p>
                    <p className="font-urdu text-gray-800" dir="rtl">{draft.summaryUr}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
