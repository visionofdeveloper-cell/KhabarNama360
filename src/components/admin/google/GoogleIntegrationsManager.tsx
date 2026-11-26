/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Centralized Admin Google Integrations Hub (GA4 + GTM + Search Console)
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Code2,
  RefreshCw,
  Search,
  Server,
  X,
} from 'lucide-react';
import {
  GoogleIntegrationLogEntry,
  GoogleIntegrationsConfig,
  SearchConsoleMetrics,
} from '../../../types/index.ts';
import { safeFetchJson } from '../../../utils/safeFetch.ts';
import { GoogleAnalyticsSettings } from './GoogleAnalyticsSettings.tsx';
import { GoogleTagManagerSettings } from './GoogleTagManagerSettings.tsx';
import { GoogleSearchConsoleSettings } from './GoogleSearchConsoleSettings.tsx';
import { GoogleIntegrationDiagnostics } from './GoogleIntegrationDiagnostics.tsx';

export type GoogleIntegrationSubTab = 'ga4' | 'gtm' | 'gsc' | 'diagnostics';

interface Props {
  initialSubTab?: GoogleIntegrationSubTab;
  onRefreshParent?: () => void;
}

export const GoogleIntegrationsManager: React.FC<Props> = ({
  initialSubTab = 'ga4',
  onRefreshParent,
}) => {
  const [subTab, setSubTab] = useState<GoogleIntegrationSubTab>(initialSubTab);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<GoogleIntegrationsConfig | null>(null);
  const [connection, setConnection] = useState<any>(null);
  const [metrics, setMetrics] = useState<SearchConsoleMetrics | null>(null);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [logs, setLogs] = useState<GoogleIntegrationLogEntry[]>([]);
  const [banner, setBanner] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (initialSubTab) setSubTab(initialSubTab);
  }, [initialSubTab]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const d = await safeFetchJson('/api/admin/seo/google-integrations');
      if (d.success) {
        setConfig(d.config || null);
        setConnection(d.connection || null);
        setMetrics(d.metrics || null);
        setDiagnostics(d.diagnostics || null);
        setLogs(d.logs || []);
      } else {
        setBanner({ ok: false, msg: d.error || 'Could not load Google Integrations state.' });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Listen for Google OAuth 2.0 popup postMessage completion from /api/admin/seo/gsc/oauth-callback
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.type !== '360KN_GSC_OAUTH_RESULT') return;
      setBanner({
        ok: Boolean(data.ok),
        msg: data.message || (data.ok ? 'Google Search Console authorized!' : 'Google OAuth authorization failed.'),
      });
      setSubTab('gsc');
      void loadAll();
      onRefreshParent?.();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [loadAll, onRefreshParent]);

  const handleChildUpdated = () => {
    void loadAll();
    onRefreshParent?.();
  };

  const gaActive = Boolean(config?.analytics?.enabled && config?.analytics?.measurementId);
  const gtmActive = Boolean(config?.tagManager?.enabled && config?.tagManager?.containerId);
  const gscStatus = connection?.diagnosticStatus || 'Disconnected';

  return (
    <div className="space-y-5 text-xs">
      {/* Header & Summary Status Cards */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-gray-900">
              Google Analytics 4, Tag Manager &amp; Search Console
            </h2>
            <p className="text-gray-500">
              Centralized production management for tracking, consent mode, Search Console verification &amp; search performance.
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadAll()}
            className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-lg inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Reload State</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* GA4 Summary Card */}
          <button
            type="button"
            onClick={() => setSubTab('ga4')}
            className={`text-left p-4 rounded-xl border transition-all ${
              subTab === 'ga4'
                ? 'bg-emerald-50/70 border-emerald-600 ring-1 ring-emerald-600'
                : 'bg-gray-50 border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-700 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-700" />
                <span>Google Analytics 4</span>
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  gaActive ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'
                }`}
              >
                {gaActive ? 'Active' : 'Not Configured'}
              </span>
            </div>
            <div className="mt-2 font-mono font-black text-sm text-gray-900">
              {config?.analytics?.measurementId || '—'}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              Mode: <code>{diagnostics?.ga4?.effectiveRuntimeMode || config?.analytics?.trackingMode || 'disabled'}</code>
            </div>
          </button>

          {/* GTM Summary Card */}
          <button
            type="button"
            onClick={() => setSubTab('gtm')}
            className={`text-left p-4 rounded-xl border transition-all ${
              subTab === 'gtm'
                ? 'bg-emerald-50/70 border-emerald-600 ring-1 ring-emerald-600'
                : 'bg-gray-50 border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-700 flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>Google Tag Manager</span>
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  gtmActive ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'
                }`}
              >
                {gtmActive ? 'Active' : 'Not Configured'}
              </span>
            </div>
            <div className="mt-2 font-mono font-black text-sm text-gray-900">
              {config?.tagManager?.containerId || '—'}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              Consent Mode v2: {config?.tagManager?.consentModeEnabled ? 'Enabled' : 'Disabled'}
            </div>
          </button>

          {/* GSC Summary Card */}
          <button
            type="button"
            onClick={() => setSubTab('gsc')}
            className={`text-left p-4 rounded-xl border transition-all ${
              subTab === 'gsc'
                ? 'bg-emerald-50/70 border-emerald-600 ring-1 ring-emerald-600'
                : 'bg-gray-50 border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-700 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-emerald-700" />
                <span>Google Search Console</span>
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  gscStatus === 'Authorized'
                    ? 'bg-emerald-100 text-emerald-800'
                    : gscStatus === 'Disconnected' || gscStatus === 'No Data Yet'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {gscStatus}
              </span>
            </div>
            <div className="mt-2 font-mono font-bold text-xs text-gray-900 truncate">
              {connection?.propertyUrl || config?.searchConsole?.propertyUrl || 'https://www.360khabarnama.com/'}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              {metrics?.connected
                ? `${metrics.clicks.toLocaleString()} clicks • ${metrics.impressions.toLocaleString()} impr`
                : config?.searchConsole?.verificationCode
                ? 'HTML verification meta active'
                : 'Click to configure OAuth / Meta tag'}
            </div>
          </button>
        </div>
      </div>

      {banner && (
        <div
          className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
            banner.ok
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <span className="font-medium">{banner.msg}</span>
          <button type="button" onClick={() => setBanner(null)} className="text-gray-500 hover:text-gray-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Sub-Navigation Pills/Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 pb-1">
        {[
          { id: 'ga4' as GoogleIntegrationSubTab, label: 'Google Analytics 4', icon: Activity },
          { id: 'gtm' as GoogleIntegrationSubTab, label: 'Google Tag Manager', icon: Code2 },
          { id: 'gsc' as GoogleIntegrationSubTab, label: 'Google Search Console', icon: Search },
          { id: 'diagnostics' as GoogleIntegrationSubTab, label: `Diagnostics & Logs (${logs.length})`, icon: Server },
        ].map(item => {
          const Icon = item.icon;
          const active = subTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSubTab(item.id)}
              className={`px-3.5 py-2 rounded-lg font-bold inline-flex items-center gap-1.5 transition-colors ${
                active
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {loading && !config ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-500">
          Loading Google Integrations configuration...
        </div>
      ) : config ? (
        <>
          {subTab === 'ga4' && (
            <GoogleAnalyticsSettings
              config={config}
              diagnostics={diagnostics}
              onNotify={(ok, msg) => setBanner({ ok, msg })}
              onUpdated={handleChildUpdated}
            />
          )}
          {subTab === 'gtm' && (
            <GoogleTagManagerSettings
              config={config}
              diagnostics={diagnostics}
              onNotify={(ok, msg) => setBanner({ ok, msg })}
              onUpdated={handleChildUpdated}
            />
          )}
          {subTab === 'gsc' && (
            <GoogleSearchConsoleSettings
              config={config}
              connection={connection}
              metrics={metrics}
              onNotify={(ok, msg) => setBanner({ ok, msg })}
              onUpdated={handleChildUpdated}
            />
          )}
          {subTab === 'diagnostics' && (
            <GoogleIntegrationDiagnostics
              diagnostics={diagnostics}
              logs={logs}
              loading={loading}
              onRefresh={() => void loadAll()}
            />
          )}
        </>
      ) : null}
    </div>
  );
};
