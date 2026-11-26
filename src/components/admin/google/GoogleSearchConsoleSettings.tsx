/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Google Search Console Connection, Verification, Analytics, Sitemaps & URL Inspection
 *
 * Strictly zero fabricated metrics. Displays authentic Google Search Console API data only.
 */

import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileText,
  Globe,
  Link2,
  Play,
  RefreshCw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { GoogleIntegrationsConfig, SearchConsoleMetrics } from '../../../types/index.ts';
import { safeFetchJson } from '../../../utils/safeFetch.ts';

interface Props {
  config: GoogleIntegrationsConfig;
  connection: any;
  metrics: SearchConsoleMetrics | null;
  onNotify: (ok: boolean, msg: string) => void;
  onUpdated: () => void;
}

export const GoogleSearchConsoleSettings: React.FC<Props> = ({
  config,
  connection,
  metrics,
  onNotify,
  onUpdated,
}) => {
  const [metaCode, setMetaCode] = useState(config.searchConsole.verificationCode || '');
  const [propertyUrl, setPropertyUrl] = useState(
    connection?.propertyUrl || config.searchConsole.propertyUrl || 'https://www.360khabarnama.com/'
  );
  const [scopeMode, setScopeMode] = useState<'webmasters' | 'readonly'>(
    connection?.scopeMode || config.searchConsole.scopeMode || 'webmasters'
  );
  const [clientId, setClientId] = useState(connection?.clientId || '');
  const [clientSecret, setClientSecret] = useState('');
  const [oauthCodeInput, setOauthCodeInput] = useState('');
  const [saJsonInput, setSaJsonInput] = useState('');
  const [showSaForm, setShowSaForm] = useState(connection?.authMode === 'service_account');

  // Analytics query filters
  const [range, setRange] = useState<'7d' | '28d' | '3m' | 'custom'>(metrics?.range || '28d');
  const [startDate, setStartDate] = useState(metrics?.startDate || '');
  const [endDate, setEndDate] = useState(metrics?.endDate || '');
  const [comparePrevious, setComparePrevious] = useState<boolean>(Boolean(metrics?.comparePrevious));

  // Sitemaps & URL Inspection
  const [submittedSitemaps, setSubmittedSitemaps] = useState<any[]>([]);
  const [loadingSitemaps, setLoadingSitemaps] = useState(false);
  const [customSitemapPath, setCustomSitemapPath] = useState('/sitemap-index.xml');
  const [inspectTarget, setInspectTarget] = useState('https://www.360khabarnama.com/en');
  const [inspectionResult, setInspectionResult] = useState<any>(null);

  const [busy, setBusy] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [confirmRemoveMeta, setConfirmRemoveMeta] = useState(false);

  useEffect(() => {
    setMetaCode(config.searchConsole.verificationCode || '');
  }, [config.searchConsole.verificationCode]);

  useEffect(() => {
    if (connection?.clientId) setClientId(connection.clientId);
    if (connection?.propertyUrl) setPropertyUrl(connection.propertyUrl);
    if (connection?.scopeMode) setScopeMode(connection.scopeMode);
  }, [connection]);

  const diagStatus = connection?.diagnosticStatus || metrics?.diagnosticStatus || 'Disconnected';
  const statusBadgeClass =
    diagStatus === 'Authorized'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : diagStatus === 'Disconnected' || diagStatus === 'No Data Yet'
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : 'bg-rose-50 text-rose-800 border-rose-200';

  const currentOriginCallback =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/admin/seo/gsc/oauth-callback`
      : 'https://www.360khabarnama.com/api/admin/seo/gsc/oauth-callback';

  // Section 1: Save HTML verification meta tag
  const handleSaveMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const d = await safeFetchJson('/api/admin/seo/google-integrations/gsc-meta', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationCode: metaCode }),
      });
      if (d.success) {
        onNotify(true, 'Search Console HTML verification meta tag saved and injected into public <head>.');
        onUpdated();
      } else {
        onNotify(false, d.error || 'Failed saving verification meta tag.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleTestMeta = async () => {
    setBusy(true);
    try {
      const d = await safeFetchJson('/api/admin/seo/google-integrations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'gsc_meta', testPath: '/en', checkProductionLive: false }),
      });
      onNotify(Boolean(d.ok), d.summary || d.error || 'Verification meta test finished.');
      onUpdated();
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveMeta = async () => {
    setBusy(true);
    try {
      const d = await safeFetchJson('/api/admin/seo/google-integrations/gsc_meta', { method: 'DELETE' });
      setConfirmRemoveMeta(false);
      if (d.success) {
        onNotify(true, 'Removed HTML verification meta tag.');
        onUpdated();
      } else {
        onNotify(false, d.error || 'Super Admin required to remove verification meta tag.');
      }
    } finally {
      setBusy(false);
    }
  };

  // Section 2: OAuth / Service Account / Property Selection
  const handleSaveOAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const d = await safeFetchJson('/api/admin/seo/gsc/oauth-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          clientSecret: clientSecret.trim() || undefined,
          propertyUrl,
          scopeMode,
        }),
      });
      if (d.success) {
        setClientSecret('');
        onNotify(
          true,
          `OAuth credentials encrypted & saved (${d.storageEngine || 'database'}). Click "Authorize with Google" below.`
        );
        onUpdated();
      } else {
        onNotify(false, d.error || 'Failed saving OAuth credentials.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleStartOAuthPopup = async () => {
    setBusy(true);
    try {
      const d = await safeFetchJson(
        `/api/admin/seo/gsc/oauth-url?redirectUri=${encodeURIComponent(currentOriginCallback)}&scopeMode=${scopeMode}`
      );
      if (!d.success || !d.authUrl) {
        onNotify(false, d.error || 'Save your Google OAuth Client ID and Client Secret first.');
        return;
      }
      const popup = window.open(
        d.authUrl,
        '360kn_gsc_oauth',
        'width=540,height=680,menubar=no,toolbar=no,status=no'
      );
      if (!popup) {
        // Fallback to top-level redirect only if popup is blocked
        window.location.assign(d.authUrl);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleExchangeCode = async () => {
    if (!oauthCodeInput.trim()) return;
    setBusy(true);
    try {
      const d = await safeFetchJson('/api/admin/seo/gsc/oauth-exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: oauthCodeInput.trim(), redirectUri: currentOriginCallback }),
      });
      setOauthCodeInput('');
      onNotify(Boolean(d.success), d.message || d.error || 'Authorization code processed.');
      onUpdated();
    } finally {
      setBusy(false);
    }
  };

  const handleSaveServiceAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const d = await safeFetchJson('/api/admin/seo/gsc/service-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceAccountJson: saJsonInput, propertyUrl, scopeMode }),
      });
      if (d.success) {
        setSaJsonInput('');
        onNotify(true, 'Encrypted Service Account saved. Click "Verify Connection" next.');
        onUpdated();
      } else {
        onNotify(false, d.error || 'Failed saving Service Account.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSelectProperty = async (nextProp: string) => {
    setPropertyUrl(nextProp);
    setBusy(true);
    try {
      const d = await safeFetchJson('/api/admin/seo/gsc/property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyUrl: nextProp }),
      });
      onNotify(Boolean(d.success), d.message || d.error || 'Property updated.');
      onUpdated();
    } finally {
      setBusy(false);
    }
  };

  const handleTestConnection = async () => {
    setBusy(true);
    try {
      const d = await safeFetchJson('/api/admin/seo/gsc/test', { method: 'POST' });
      onNotify(d.status === 'Authorized', `[${d.status || 'Error'}] ${d.message || d.error || 'Check finished.'}`);
      onUpdated();
    } finally {
      setBusy(false);
    }
  };

  const handleSyncMetrics = async (forceRefresh = false) => {
    setBusy(true);
    try {
      const d = await safeFetchJson('/api/admin/seo/gsc/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          range,
          startDate: range === 'custom' ? startDate : undefined,
          endDate: range === 'custom' ? endDate : undefined,
          comparePrevious,
          forceRefresh,
        }),
      });
      onNotify(
        Boolean(d.success && d.metrics?.connected),
        d.metrics?.diagnosticMessage || d.error || 'Search Console sync complete.'
      );
      onUpdated();
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      const d = await safeFetchJson('/api/admin/seo/gsc/disconnect', { method: 'POST' });
      setConfirmDisconnect(false);
      if (d.success) {
        onNotify(true, 'Disconnected Google Search Console and cleared encrypted OAuth tokens.');
        onUpdated();
      } else {
        onNotify(false, d.error || 'Only Super Admin can disconnect Search Console.');
      }
    } finally {
      setBusy(false);
    }
  };

  // Section 4: Sitemaps & URL Inspection
  const handleLoadSitemaps = async () => {
    setLoadingSitemaps(true);
    try {
      const d = await safeFetchJson('/api/admin/seo/gsc/sitemaps');
      if (d.success) {
        setSubmittedSitemaps(d.sitemaps || []);
        onNotify(true, `Loaded ${(d.sitemaps || []).length} sitemap(s) from Google Search Console.`);
      } else {
        onNotify(false, d.error || 'Could not retrieve sitemaps.');
      }
    } finally {
      setLoadingSitemaps(false);
    }
  };

  const handleSubmitSitemap = async (pathOverride?: string) => {
    const targetPath = pathOverride || customSitemapPath;
    setBusy(true);
    try {
      const d = await safeFetchJson('/api/admin/seo/gsc/sitemaps/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sitemapUrl: targetPath }),
      });
      onNotify(Boolean(d.success), d.message || d.error || 'Sitemap submitted.');
      if (d.success) void handleLoadSitemaps();
    } finally {
      setBusy(false);
    }
  };

  const handleInspectUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectTarget.trim()) return;
    setBusy(true);
    setInspectionResult(null);
    try {
      const d = await safeFetchJson('/api/admin/seo/gsc/inspect-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inspectTarget.trim() }),
      });
      if (d.success) {
        setInspectionResult(d);
        onNotify(true, `Inspected ${d.inspectionUrl}`);
      } else {
        onNotify(false, d.error || 'URL inspection failed.');
      }
    } finally {
      setBusy(false);
    }
  };

  const availableProps: string[] = connection?.availableProperties || [];
  const idxStatus = inspectionResult?.inspectionResult?.indexStatusResult;

  return (
    <div className="space-y-5 text-xs">
      {/* Status Header Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-black text-gray-900 flex items-center gap-1.5">
                <Search className="w-4 h-4 text-emerald-700" />
                <span>Google Search Console Status</span>
              </h3>
              <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold border ${statusBadgeClass}`}>
                {diagStatus}
              </span>
              {connection?.authMode && connection.authMode !== 'none' && (
                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-mono text-[10px] uppercase">
                  {connection.authMode === 'oauth2' ? 'OAuth 2.0' : 'Service Account'} • {connection.scopeMode || 'webmasters'}
                </span>
              )}
            </div>
            <p className="text-gray-600 mt-1">
              {connection?.diagnosticMessage ||
                'Connect OAuth 2.0 or Service Account credentials to verify site ownership, submit sitemaps, inspect URLs, and load real search traffic.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleTestConnection}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
              <span>Verify Connection</span>
            </button>
            {connection?.authMode && connection.authMode !== 'none' && !confirmDisconnect && (
              <button
                type="button"
                onClick={() => setConfirmDisconnect(true)}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg border border-rose-200"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>

        {confirmDisconnect && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-rose-900">
              Purge Search Console OAuth tokens & cached metrics from Supabase? (Super Admin only)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={handleDisconnect}
                className="px-3 py-1 bg-rose-600 text-white font-bold rounded-lg"
              >
                Confirm Disconnect
              </button>
              <button
                type="button"
                onClick={() => setConfirmDisconnect(false)}
                className="px-3 py-1 bg-white border border-gray-300 font-bold rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Property selector dropdown when verified properties exist */}
        {availableProps.length > 0 && (
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-bold text-emerald-950">Verified Search Console Property</div>
              <div className="text-[11px] text-emerald-800">
                Detected {availableProps.length} verified propert{availableProps.length === 1 ? 'y' : 'ies'} on this Google account
              </div>
            </div>
            <select
              value={propertyUrl}
              onChange={e => handleSelectProperty(e.target.value)}
              disabled={busy}
              className="p-2 border border-emerald-300 rounded-lg bg-white font-mono text-xs font-bold text-emerald-950 min-w-[260px]"
            >
              {!availableProps.includes(propertyUrl) && (
                <option value={propertyUrl}>{propertyUrl} (Configured)</option>
              )}
              {availableProps.map(prop => (
                <option key={prop} value={prop}>
                  {prop}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Unverified property guidance */}
        {diagStatus === 'Property Not Found' && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-amber-950">
            <div className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Site Verification Required in Google Search Console</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px]">
              <li>
                <strong>Domain Property (Recommended):</strong> Add <code>360khabarnama.com</code> in{' '}
                <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer" className="underline font-bold">
                  Search Console
                </a>{' '}
                and add the provided <code>google-site-verification=...</code> TXT record at your domain registrar DNS.
              </li>
              <li>
                <strong>URL-Prefix Property (Instant via HTML Meta):</strong> Add <code>https://www.360khabarnama.com/</code>{' '}
                and paste the HTML verification tag into Section 1 below.
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* SECTION 1: HTML Verification Meta Tag */}
      <form onSubmit={handleSaveMeta} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="font-black text-gray-900">1. HTML Meta Verification Tag (&lt;meta name="google-site-verification"&gt;)</h4>
            <p className="text-[11px] text-gray-500">
              Paste the verification token or full <code>&lt;meta name="google-site-verification" content="..." /&gt;</code> tag from Search Console.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleTestMeta}
              className="px-3 py-1.5 bg-slate-900 text-white font-bold rounded-lg inline-flex items-center gap-1"
            >
              <Play className="w-3 h-3" />
              <span>Verify Head Meta</span>
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg inline-flex items-center gap-1"
            >
              <Save className="w-3 h-3" />
              <span>Save Token</span>
            </button>
            {config.searchConsole.verificationCode && !confirmRemoveMeta && (
              <button
                type="button"
                onClick={() => setConfirmRemoveMeta(true)}
                className="px-2.5 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 font-bold rounded-lg inline-flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Remove</span>
              </button>
            )}
          </div>
        </div>
        <input
          type="text"
          value={metaCode}
          onChange={e => setMetaCode(e.target.value)}
          placeholder='Paste token or <meta name="google-site-verification" content="..." />'
          className="w-full p-2.5 border border-gray-300 rounded-lg font-mono"
        />
        {confirmRemoveMeta && (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 p-2.5 rounded-lg">
            <span className="font-bold text-rose-900">Remove Google site verification meta tag?</span>
            <button type="button" onClick={handleRemoveMeta} className="px-2.5 py-1 bg-rose-600 text-white font-bold rounded">
              Yes, Remove
            </button>
            <button type="button" onClick={() => setConfirmRemoveMeta(false)} className="px-2.5 py-1 bg-white border rounded">
              Cancel
            </button>
          </div>
        )}
      </form>

      {/* SECTION 2: OAuth 2.0 Web Client + Service Account */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div>
            <h4 className="font-black text-gray-900">2. Search Console API Credentials (OAuth 2.0 &amp; Service Account)</h4>
            <p className="text-[11px] text-gray-500">
              Secrets are encrypted on the server and stored in the protected backend vault — never returned in browser JavaScript.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowSaForm(v => !v)}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 font-bold rounded-lg text-gray-800"
          >
            {showSaForm ? 'Use OAuth 2.0 Client' : 'Switch to Service Account JSON'}
          </button>
        </div>

        {!showSaForm ? (
          <form onSubmit={handleSaveOAuth} className="space-y-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <div className="font-bold text-slate-900">Authorized Redirect URIs (register in Google Cloud Console → OAuth 2.0 Client):</div>
              <div className="font-mono text-[11px] text-emerald-800 break-all">
                • Current Origin: <code>{currentOriginCallback}</code>
              </div>
              <div className="font-mono text-[11px] text-slate-600 break-all">
                • Production: <code>https://www.360khabarnama.com/api/admin/seo/gsc/oauth-callback</code>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Search Console Property URL</label>
                <input
                  type="text"
                  required
                  value={propertyUrl}
                  onChange={e => setPropertyUrl(e.target.value)}
                  placeholder="https://www.360khabarnama.com/ or sc-domain:360khabarnama.com"
                  className="w-full p-2.5 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Permission Scope Mode</label>
                <select
                  value={scopeMode}
                  onChange={e => setScopeMode(e.target.value === 'readonly' ? 'readonly' : 'webmasters')}
                  className="w-full p-2.5 border border-gray-300 rounded-lg bg-white font-semibold"
                >
                  <option value="webmasters">Full Search Console (Analytics + Sitemap Submit + URL Inspect)</option>
                  <option value="readonly">Read-Only (webmasters.readonly — Analytics &amp; Read Only)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Google OAuth Client ID</label>
                <input
                  type="text"
                  required
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  placeholder="1234567890-abcdef.apps.googleusercontent.com"
                  className="w-full p-2.5 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  OAuth Client Secret {connection?.hasClientSecret ? '(Saved & Encrypted — leave blank to keep)' : ''}
                </label>
                <input
                  type="password"
                  value={clientSecret}
                  onChange={e => setClientSecret(e.target.value)}
                  placeholder={connection?.hasClientSecret ? '••••••••••••••••' : 'GOCSPX-...'}
                  className="w-full p-2.5 border border-gray-300 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg inline-flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save OAuth Credentials</span>
              </button>
              <button
                type="button"
                disabled={busy || !clientId.trim()}
                onClick={handleStartOAuthPopup}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-lg inline-flex items-center gap-1.5"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Connect via Google OAuth Popup</span>
              </button>
            </div>

            <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={oauthCodeInput}
                onChange={e => setOauthCodeInput(e.target.value)}
                placeholder="Manual fallback: paste authorization code if popup blocked..."
                className="flex-1 min-w-[220px] p-2 border border-gray-300 rounded-lg font-mono"
              />
              <button
                type="button"
                disabled={!oauthCodeInput.trim() || busy}
                onClick={handleExchangeCode}
                className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 font-bold rounded-lg"
              >
                Exchange Code
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSaveServiceAccount} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Property URL</label>
                <input
                  type="text"
                  required
                  value={propertyUrl}
                  onChange={e => setPropertyUrl(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Scope Mode</label>
                <select
                  value={scopeMode}
                  onChange={e => setScopeMode(e.target.value === 'readonly' ? 'readonly' : 'webmasters')}
                  className="w-full p-2.5 border border-gray-300 rounded-lg bg-white font-semibold"
                >
                  <option value="webmasters">Full Search Console (webmasters)</option>
                  <option value="readonly">Read-Only (webmasters.readonly)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">
                GCP Service Account JSON {connection?.serviceAccountEmail ? `(Saved: ${connection.serviceAccountEmail})` : ''}
              </label>
              <textarea
                rows={4}
                required
                value={saJsonInput}
                onChange={e => setSaJsonInput(e.target.value)}
                placeholder='{"type":"service_account","client_email":"...@...iam.gserviceaccount.com","private_key":"-----BEGIN PRIVATE KEY-----..."}'
                className="w-full p-2.5 border border-gray-300 rounded-lg font-mono text-[11px]"
              />
            </div>
            <button type="submit" disabled={busy} className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg">
              Save Encrypted Service Account
            </button>
          </form>
        )}
      </div>

      {/* SECTION 3: Real Search Analytics Reports (7d / 28d / 3m / custom + period comparison) */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div>
            <h4 className="font-black text-gray-900 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-700" />
              <span>3. Real Search Console Performance Report</span>
            </h4>
            <p className="text-[11px] text-gray-500">
              Live impressions, clicks, CTR, position, top search queries, top articles & country/device breakdown (cached 10m; never simulated).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={range}
              onChange={e => setRange(e.target.value as any)}
              className="p-2 border border-gray-300 rounded-lg bg-white font-bold"
            >
              <option value="7d">Last 7 Days</option>
              <option value="28d">Last 28 Days</option>
              <option value="3m">Last 3 Months</option>
              <option value="custom">Custom Dates</option>
            </select>
            {range === 'custom' && (
              <>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="p-1.5 border border-gray-300 rounded-lg font-mono"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="p-1.5 border border-gray-300 rounded-lg font-mono"
                />
              </>
            )}
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={comparePrevious}
                onChange={e => setComparePrevious(e.target.checked)}
                className="accent-emerald-700"
              />
              <span className="font-semibold">Compare Prev</span>
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => handleSyncMetrics(true)}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-lg inline-flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
              <span>Sync Real Data</span>
            </button>
          </div>
        </div>

        {metrics?.connected ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                <div className="text-[11px] font-bold text-gray-500 uppercase">Total Clicks</div>
                <div className="text-2xl font-black text-emerald-700 font-mono tabular-nums mt-1">
                  {metrics.clicks.toLocaleString()}
                </div>
                {metrics.comparison && (
                  <div className="text-[11px] font-mono text-gray-600 mt-0.5">
                    vs prev: {metrics.comparison.clicksDelta >= 0 ? '+' : ''}
                    {metrics.comparison.clicksDelta.toLocaleString()}
                  </div>
                )}
              </div>
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                <div className="text-[11px] font-bold text-gray-500 uppercase">Impressions</div>
                <div className="text-2xl font-black text-gray-900 font-mono tabular-nums mt-1">
                  {metrics.impressions.toLocaleString()}
                </div>
                {metrics.comparison && (
                  <div className="text-[11px] font-mono text-gray-600 mt-0.5">
                    vs prev: {metrics.comparison.impressionsDelta >= 0 ? '+' : ''}
                    {metrics.comparison.impressionsDelta.toLocaleString()}
                  </div>
                )}
              </div>
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                <div className="text-[11px] font-bold text-gray-500 uppercase">Average CTR</div>
                <div className="text-2xl font-black text-gray-900 font-mono tabular-nums mt-1">{metrics.ctr}%</div>
                {metrics.comparison && (
                  <div className="text-[11px] font-mono text-gray-600 mt-0.5">
                    vs prev: {metrics.comparison.ctrDelta >= 0 ? '+' : ''}
                    {metrics.comparison.ctrDelta}%
                  </div>
                )}
              </div>
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                <div className="text-[11px] font-bold text-gray-500 uppercase">Avg Position</div>
                <div className="text-2xl font-black text-gray-900 font-mono tabular-nums mt-1">
                  {metrics.averagePosition}
                </div>
                {metrics.comparison && (
                  <div className="text-[11px] font-mono text-gray-600 mt-0.5">
                    {metrics.comparison.positionDelta >= 0 ? `↑ Improved ${metrics.comparison.positionDelta}` : `↓ ${metrics.comparison.positionDelta}`}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="p-3 bg-gray-50 border-b border-gray-200 font-black">Top Search Queries</div>
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b text-gray-500 bg-white sticky top-0">
                      <tr>
                        <th className="p-2.5">Query</th>
                        <th className="p-2.5 text-right">Clicks</th>
                        <th className="p-2.5 text-right">Impr</th>
                        <th className="p-2.5 text-right">Pos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-mono tabular-nums">
                      {(metrics.topQueries || []).length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-gray-400 font-sans">
                            No query rows returned for selected period.
                          </td>
                        </tr>
                      ) : (
                        metrics.topQueries.map((q, i) => (
                          <tr key={i}>
                            <td className="p-2.5 font-sans font-semibold text-gray-900">{q.query}</td>
                            <td className="p-2.5 text-right">{q.clicks}</td>
                            <td className="p-2.5 text-right">{q.impressions}</td>
                            <td className="p-2.5 text-right">{q.position}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="p-3 bg-gray-50 border-b border-gray-200 font-black">Top Landing Articles &amp; Pages</div>
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b text-gray-500 bg-white sticky top-0">
                      <tr>
                        <th className="p-2.5">URL</th>
                        <th className="p-2.5 text-right">Clicks</th>
                        <th className="p-2.5 text-right">CTR</th>
                        <th className="p-2.5 text-right">Pos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-mono tabular-nums">
                      {(metrics.topPages || []).length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-gray-400 font-sans">
                            No page rows returned for selected period.
                          </td>
                        </tr>
                      ) : (
                        metrics.topPages.map((p, i) => (
                          <tr key={i}>
                            <td className="p-2.5 text-emerald-800 truncate max-w-[230px]" title={p.path}>
                              {p.path}
                            </td>
                            <td className="p-2.5 text-right">{p.clicks}</td>
                            <td className="p-2.5 text-right">{p.ctr}%</td>
                            <td className="p-2.5 text-right">{p.position ?? '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {((metrics.devices || []).length > 0 || (metrics.countries || []).length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                  <div className="font-bold text-gray-800">Devices Breakdown</div>
                  <div className="space-y-1 font-mono text-[11px]">
                    {metrics.devices.map((d, i) => (
                      <div key={i} className="flex justify-between">
                        <span>{d.device}</span>
                        <span>
                          {d.percent}% ({d.clicks ?? 0} clicks)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                  <div className="font-bold text-gray-800">Top Countries</div>
                  <div className="space-y-1 font-mono text-[11px]">
                    {metrics.countries.slice(0, 6).map((c, i) => (
                      <div key={i} className="flex justify-between">
                        <span>{c.country}</span>
                        <span>
                          {c.percent}% ({c.clicks ?? 0} clicks)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 bg-gray-50 border border-dashed border-gray-300 rounded-xl text-center text-gray-600">
            No Search Console analytics synced yet. Authorize Google OAuth 2.0 or Service Account credentials above, then click{' '}
            <strong>Sync Real Data</strong>. Zero fake metrics are ever generated.
          </div>
        )}
      </div>

      {/* SECTION 4: Sitemaps Submission & URL Inspection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Sitemaps */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-black text-gray-900 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-700" />
              <span>Sitemaps in Search Console</span>
            </h4>
            <button
              type="button"
              disabled={loadingSitemaps || connection?.authMode === 'none'}
              onClick={handleLoadSitemaps}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 font-bold rounded-lg"
            >
              {loadingSitemaps ? 'Loading...' : 'Refresh List'}
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {['/sitemap-index.xml', '/sitemap.xml', '/news-sitemap.xml', '/image-sitemap.xml', '/video-sitemap.xml'].map(
              sm => (
                <button
                  key={sm}
                  type="button"
                  disabled={busy || connection?.authMode === 'none'}
                  onClick={() => handleSubmitSitemap(sm)}
                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg font-mono text-[11px] font-bold disabled:opacity-50"
                >
                  Submit {sm}
                </button>
              )
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={customSitemapPath}
              onChange={e => setCustomSitemapPath(e.target.value)}
              placeholder="/sitemap-index.xml"
              className="flex-1 p-2 border border-gray-300 rounded-lg font-mono"
            />
            <button
              type="button"
              disabled={busy || connection?.authMode === 'none'}
              onClick={() => handleSubmitSitemap()}
              className="px-3.5 py-2 bg-slate-900 text-white font-bold rounded-lg inline-flex items-center gap-1 disabled:opacity-50"
            >
              <Send className="w-3 h-3" />
              <span>Submit</span>
            </button>
          </div>

          {submittedSitemaps.length > 0 && (
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
              {submittedSitemaps.map((s, idx) => (
                <div key={idx} className="p-2.5 flex items-center justify-between gap-2 text-[11px]">
                  <div className="font-mono text-emerald-800 truncate">{s.path}</div>
                  <div className="text-gray-500 shrink-0">
                    {s.lastSubmitted ? new Date(s.lastSubmitted).toLocaleDateString() : '—'} • {s.errors || 0} err
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* URL Inspection */}
        <form onSubmit={handleInspectUrl} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h4 className="font-black text-gray-900 flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-emerald-700" />
            <span>Live URL Inspection API</span>
          </h4>
          <p className="text-[11px] text-gray-500">
            Check Google index status, last crawl time &amp; canonical alignment for any 360Khabarnama URL.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={inspectTarget}
              onChange={e => setInspectTarget(e.target.value)}
              placeholder="https://www.360khabarnama.com/en/news/..."
              className="flex-1 p-2 border border-gray-300 rounded-lg font-mono"
            />
            <button
              type="submit"
              disabled={busy || connection?.authMode === 'none'}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-lg"
            >
              Inspect URL
            </button>
          </div>

          {idxStatus && (
            <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-900">Verdict &amp; Coverage</span>
                <span
                  className={`px-2 py-0.5 rounded font-bold uppercase ${
                    idxStatus.verdict === 'PASS'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {idxStatus.verdict || 'UNKNOWN'}
                </span>
              </div>
              <div className="text-gray-700">State: {idxStatus.coverageState || '—'}</div>
              <div className="text-gray-600 font-mono">
                Google Canonical: {idxStatus.googleCanonical || '—'}
              </div>
              <div className="text-gray-600 font-mono">
                Last Crawl: {idxStatus.lastCrawlTime ? new Date(idxStatus.lastCrawlTime).toLocaleString() : '—'}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
