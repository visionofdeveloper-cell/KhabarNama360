/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Google Analytics 4 (GA4) Configuration & SSR Verification Panel
 */

import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Play,
  Power,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { GoogleAnalyticsConfig, GoogleIntegrationsConfig, GoogleTrackingMode } from '../../../types/index.ts';
import { safeFetchJson } from '../../../utils/safeFetch.ts';

interface Props {
  config: GoogleIntegrationsConfig;
  diagnostics?: any;
  onNotify: (ok: boolean, msg: string) => void;
  onUpdated: () => void;
}

const GA4_REGEX = /^G-[A-Z0-9]{6,16}$/;

export const GoogleAnalyticsSettings: React.FC<Props> = ({
  config,
  diagnostics,
  onNotify,
  onUpdated,
}) => {
  const [form, setForm] = useState<GoogleAnalyticsConfig>(config.analytics);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [checkProd, setCheckProd] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    setForm(config.analytics);
  }, [config.analytics]);

  const cleanId = form.measurementId.trim().toUpperCase();
  const idValid = !cleanId || GA4_REGEX.test(cleanId);
  const gtmActive = config.tagManager.enabled && Boolean(config.tagManager.containerId);

  const handleSave = async (e: React.FormEvent, overrideEnabled?: boolean) => {
    e.preventDefault();
    if (cleanId && !GA4_REGEX.test(cleanId)) {
      onNotify(false, 'GA4 Measurement ID must look like G-XXXXXXXXXX (6–16 letters/digits after G-).');
      return;
    }
    setSaving(true);
    try {
      const nextEnabled = overrideEnabled !== undefined ? overrideEnabled : form.enabled;
      const d = await safeFetchJson('/api/admin/seo/google-integrations/ga4', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          measurementId: cleanId,
          enabled: nextEnabled,
        }),
      });
      if (d.success) {
        onNotify(
          true,
          nextEnabled
            ? `Google Analytics 4 saved (${cleanId}) via ${d.storageEngine || 'database'}${d.verifiedReadBack ? ' (verified read-back)' : ''}.`
            : 'Google Analytics 4 disabled and persisted.'
        );
        onUpdated();
      } else {
        onNotify(false, d.error || 'Failed saving Google Analytics 4 configuration.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const d = await safeFetchJson('/api/admin/seo/google-integrations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: 'ga4',
          testPath: '/en',
          checkProductionLive: checkProd,
        }),
      });
      setTestResult(d);
      onNotify(Boolean(d.ok), d.summary || d.error || 'GA4 verification test finished.');
      onUpdated();
    } finally {
      setTesting(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    try {
      const d = await safeFetchJson('/api/admin/seo/google-integrations/ga4', {
        method: 'DELETE',
      });
      setConfirmRemove(false);
      if (d.success) {
        setTestResult(null);
        onNotify(true, 'Google Analytics 4 configuration removed from persistent storage.');
        onUpdated();
      } else {
        onNotify(false, d.error || 'Only Super Admin can remove GA4 configuration.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 text-xs">
      <form onSubmit={handleSave} className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-700" />
              <span>Google Analytics 4 (GA4) Property Settings</span>
            </h3>
            <p className="text-gray-500 mt-0.5">
              Bilingual SPA page views (`en` / `ur`), article engagement, search queries, newsletter signups & Consent Mode v2.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {form.enabled && cleanId && (
              <button
                type="button"
                disabled={saving}
                onClick={e => handleSave(e, false)}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold rounded-lg inline-flex items-center gap-1"
              >
                <Power className="w-3.5 h-3.5" />
                <span>Disable GA4</span>
              </button>
            )}
            <button
              type="button"
              disabled={testing}
              onClick={handleTest}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg inline-flex items-center gap-1 disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{testing ? 'Testing...' : 'Verify Injection'}</span>
            </button>
            <button
              type="submit"
              disabled={saving || !idValid}
              className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save GA4'}</span>
            </button>
          </div>
        </div>

        {/* Measurement ID & Enable Switch */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-bold text-gray-700 mb-1">
              GA4 Measurement ID <span className="text-gray-400 font-normal">(format: G-XXXXXXXXXX)</span>
            </label>
            <input
              type="text"
              value={form.measurementId}
              onChange={e => setForm({ ...form, measurementId: e.target.value.toUpperCase() })}
              placeholder="G-XXXXXXXXXX"
              className={`w-full p-2.5 border rounded-lg font-mono ${
                idValid ? 'border-gray-300' : 'border-rose-400 bg-rose-50'
              }`}
            />
            {!idValid && (
              <p className="text-[11px] text-rose-600 mt-1">
                Expected official GA4 Measurement ID starting with <code>G-</code> (6–16 uppercase alphanumeric chars). Legacy <code>UA-</code> IDs are unsupported.
              </p>
            )}
          </div>

          <label className="flex items-center justify-between p-3.5 bg-gray-50 border border-gray-200 rounded-xl self-end cursor-pointer">
            <div>
              <div className="font-bold text-gray-900">Enable Google Analytics 4 Tracking</div>
              <div className="text-[11px] text-gray-500">Emits single-source page views & public portal events</div>
            </div>
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={e => setForm({ ...form, enabled: e.target.checked })}
              className="w-4 h-4 accent-emerald-700"
            />
          </label>
        </div>

        {/* Single Tracking Mode Enforcement Selector */}
        <div className="space-y-2">
          <label className="block font-bold text-gray-800">
            Tracking Delivery Mode <span className="text-emerald-700 font-normal">(prevents duplicate page_view double counting)</span>
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                id: 'gtm' as GoogleTrackingMode,
                title: 'Via Google Tag Manager (Recommended)',
                desc: 'Injects GTM only + pushes clean SPA dataLayer events. Configure your GA4 Google Tag inside GTM — zero duplicate gtag.js.',
              },
              {
                id: 'direct_gtag' as GoogleTrackingMode,
                title: 'Direct gtag.js Mode',
                desc: 'Injects Google gtag.js with send_page_view:false and fires deduplicated SPA page_view & events directly.',
              },
              {
                id: 'disabled' as GoogleTrackingMode,
                title: 'Disabled',
                desc: 'Stops all GA4 event emissions while keeping saved ID in configuration.',
              },
            ].map(opt => {
              const selected = form.trackingMode === opt.id;
              return (
                <label
                  key={opt.id}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    selected
                      ? 'bg-emerald-50 border-emerald-600 ring-1 ring-emerald-600'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-gray-900">
                    <input
                      type="radio"
                      name="ga4TrackingMode"
                      value={opt.id}
                      checked={selected}
                      onChange={() => setForm({ ...form, trackingMode: opt.id })}
                      className="accent-emerald-700"
                    />
                    <span>{opt.title}</span>
                  </div>
                  <p className="text-[11px] text-gray-600 mt-1.5 leading-relaxed">{opt.desc}</p>
                </label>
              );
            })}
          </div>

          {form.trackingMode === 'gtm' && !gtmActive && form.enabled && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                GTM mode is selected, but Google Tag Manager is currently unconfigured/disabled. Until GTM is enabled with a{' '}
                <code>GTM-...</code> Container ID, public pages automatically fall back to <code>direct_gtag</code> so tracking continues uninterrupted.
              </span>
            </div>
          )}

          {form.trackingMode === 'direct_gtag' && gtmActive && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Duplicate Tracking Guard:</strong> GTM ({config.tagManager.containerId}) is enabled, while GA4 is set to Direct{' '}
                <code>gtag.js</code>. Direct mode omits the GTM container snippet so GA4 never double-fires. If you want GTM to manage tags, switch GA4 mode to{' '}
                <strong>Via Google Tag Manager</strong>.
              </span>
            </div>
          )}
        </div>

        {/* Privacy, Exclusions & Event Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            {
              key: 'excludeAdmin',
              label: 'Exclude /admin & /admin/*',
              desc: 'Never fire analytics on private editorial/admin sessions',
            },
            {
              key: 'excludeStaging',
              label: 'Exclude Localhost & Preview Hosts',
              desc: 'Skip tracking on localhost / *.vercel.app preview URLs',
            },
            {
              key: 'trackEnhancedEvents',
              label: 'Enhanced Editorial Events',
              desc: 'Track article scroll/read, search, language switch, newsletter & outbound clicks',
            },
            {
              key: 'anonymizeIp',
              label: 'Anonymize IP',
              desc: 'Send anonymize_ip parameter for privacy compliance',
            },
            {
              key: 'debugMode',
              label: 'GA4 DebugView Mode',
              desc: 'Adds debug_mode:true for inspecting live events in GA4 DebugView',
            },
          ].map(item => (
            <label
              key={item.key}
              className="flex items-start justify-between gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer"
            >
              <div>
                <div className="font-bold text-gray-800">{item.label}</div>
                <div className="text-[11px] text-gray-500">{item.desc}</div>
              </div>
              <input
                type="checkbox"
                checked={Boolean((form as any)[item.key])}
                onChange={e => setForm({ ...form, [item.key]: e.target.checked })}
                className="mt-0.5 w-4 h-4 accent-emerald-700 shrink-0"
              />
            </label>
          ))}
        </div>

        {/* Verification Options + Remove Control */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
          <label className="inline-flex items-center gap-2 text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={checkProd}
              onChange={e => setCheckProd(e.target.checked)}
              className="accent-emerald-700"
            />
            <span>Also probe live production <code>https://www.360khabarnama.com/en</code> during verification test</span>
          </label>

          {cleanId && (
            <div>
              {!confirmRemove ? (
                <button
                  type="button"
                  onClick={() => setConfirmRemove(true)}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg border border-rose-200 inline-flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove GA4</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 bg-rose-50 border border-rose-300 px-3 py-1.5 rounded-lg">
                  <span className="text-rose-900 font-bold">Confirm remove GA4 ID?</span>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleRemove}
                    className="px-2.5 py-1 bg-rose-600 text-white font-bold rounded"
                  >
                    Yes, Remove
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(false)}
                    className="px-2.5 py-1 bg-white border border-gray-300 text-gray-700 font-bold rounded"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </form>

      {/* Live Verification Output */}
      {testResult && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-black text-gray-900">
              {testResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              )}
              <span>{testResult.summary}</span>
            </div>
            <span className="font-mono text-[11px] text-gray-400">
              {testResult.testedAt ? new Date(testResult.testedAt).toLocaleString() : ''}
            </span>
          </div>
          <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
            {(testResult.checks || []).map((c: any, idx: number) => (
              <div key={idx} className="p-2.5 flex items-center justify-between gap-4">
                <div>
                  <div className="font-bold text-gray-800">{c.name}</div>
                  <div className="text-[11px] text-gray-500">{c.detail}</div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                    c.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  {c.passed ? 'Pass' : 'Fail'}
                </span>
              </div>
            ))}
          </div>
          {testResult.liveRemoteCheck?.attempted && (
            <div
              className={`p-3 rounded-lg border text-[11px] ${
                testResult.liveRemoteCheck.tagFound
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <strong>Live Production Probe:</strong> {testResult.liveRemoteCheck.detail}
            </div>
          )}
        </div>
      )}

      {/* Tracked Event Schema Reference */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
        <div className="font-bold text-slate-900 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-700" />
          <span>Tracked Events Automatically Emitted Across 360Khabarnama</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 font-mono text-[11px] text-slate-700">
          <div>• page_view (en / ur SPA routes)</div>
          <div>• article_view & article_engaged_read</div>
          <div>• language_switch (EN ↔ UR)</div>
          <div>• search (query & results_count)</div>
          <div>• newsletter_signup (footer briefing)</div>
          <div>• outbound_click & share (WhatsApp/Copy)</div>
        </div>
        {diagnostics?.ga4?.lastVerifiedAt && (
          <div className="text-[11px] text-slate-500 pt-1">
            Last verified: {new Date(diagnostics.ga4.lastVerifiedAt).toLocaleString()} • Effective mode:{' '}
            <code>{diagnostics.ga4.effectiveRuntimeMode}</code>
          </div>
        )}
      </div>
    </div>
  );
};
