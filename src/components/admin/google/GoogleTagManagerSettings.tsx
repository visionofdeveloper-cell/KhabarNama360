/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Google Tag Manager (GTM) Configuration & Head/Noscript Verification Panel
 */

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  ExternalLink,
  Play,
  Power,
  Save,
  Trash2,
} from 'lucide-react';
import { GoogleIntegrationsConfig, GoogleTagManagerConfig } from '../../../types/index.ts';
import { safeFetchJson } from '../../../utils/safeFetch.ts';

interface Props {
  config: GoogleIntegrationsConfig;
  diagnostics?: any;
  onNotify: (ok: boolean, msg: string) => void;
  onUpdated: () => void;
}

const GTM_REGEX = /^GTM-[A-Z0-9]{4,14}$/;

export const GoogleTagManagerSettings: React.FC<Props> = ({
  config,
  diagnostics,
  onNotify,
  onUpdated,
}) => {
  const [form, setForm] = useState<GoogleTagManagerConfig>(config.tagManager);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [checkProd, setCheckProd] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    setForm(config.tagManager);
  }, [config.tagManager]);

  const cleanId = form.containerId.trim().toUpperCase();
  const idValid = !cleanId || GTM_REGEX.test(cleanId);

  const handleSave = async (e: React.FormEvent, overrideEnabled?: boolean) => {
    e.preventDefault();
    if (cleanId && !GTM_REGEX.test(cleanId)) {
      onNotify(false, 'GTM Container ID must match the format GTM-XXXXXXX.');
      return;
    }
    setSaving(true);
    try {
      const nextEnabled = overrideEnabled !== undefined ? overrideEnabled : form.enabled;
      const d = await safeFetchJson('/api/admin/seo/google-integrations/gtm', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          containerId: cleanId,
          enabled: nextEnabled,
        }),
      });
      if (d.success) {
        onNotify(
          true,
          nextEnabled
            ? `Google Tag Manager saved (${cleanId}) via ${d.storageEngine || 'database'}${d.verifiedReadBack ? ' (verified read-back)' : ''}.`
            : 'Google Tag Manager disabled cleanly.'
        );
        onUpdated();
      } else {
        onNotify(false, d.error || 'Failed saving Google Tag Manager configuration.');
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
          target: 'gtm',
          testPath: '/en',
          checkProductionLive: checkProd,
        }),
      });
      setTestResult(d);
      onNotify(Boolean(d.ok), d.summary || d.error || 'GTM verification test finished.');
      onUpdated();
    } finally {
      setTesting(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    try {
      const d = await safeFetchJson('/api/admin/seo/google-integrations/gtm', {
        method: 'DELETE',
      });
      setConfirmRemove(false);
      if (d.success) {
        setTestResult(null);
        onNotify(true, 'Google Tag Manager removed cleanly.');
        onUpdated();
      } else {
        onNotify(false, d.error || 'Only Super Admin can remove Google Tag Manager.');
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
              <Code2 className="w-4 h-4 text-emerald-700" />
              <span>Google Tag Manager (GTM) Container</span>
            </h3>
            <p className="text-gray-500 mt-0.5">
              Injects the official GTM <code>&lt;head&gt;</code> loader and <code>&lt;body&gt;&lt;noscript&gt;</code> iframe on public routes with Consent Mode v2.
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
                <span>Disable GTM</span>
              </button>
            )}
            <button
              type="button"
              disabled={testing}
              onClick={handleTest}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg inline-flex items-center gap-1 disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{testing ? 'Checking...' : 'Test GTM Snippets'}</span>
            </button>
            <button
              type="submit"
              disabled={saving || !idValid}
              className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save GTM'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-bold text-gray-700 mb-1">
              GTM Container ID <span className="text-gray-400 font-normal">(format: GTM-XXXXXXX)</span>
            </label>
            <input
              type="text"
              value={form.containerId}
              onChange={e => setForm({ ...form, containerId: e.target.value.toUpperCase() })}
              placeholder="GTM-XXXXXXX"
              className={`w-full p-2.5 border rounded-lg font-mono ${
                idValid ? 'border-gray-300' : 'border-rose-400 bg-rose-50'
              }`}
            />
            {!idValid && (
              <p className="text-[11px] text-rose-600 mt-1">
                Container ID must begin with <code>GTM-</code> followed by 4–14 uppercase letters/digits.
              </p>
            )}
          </div>

          <label className="flex items-center justify-between p-3.5 bg-gray-50 border border-gray-200 rounded-xl self-end cursor-pointer">
            <div>
              <div className="font-bold text-gray-900">Enable GTM Container Injection</div>
              <div className="text-[11px] text-gray-500">Injects &lt;head&gt; script &amp; &lt;body&gt; &lt;noscript&gt; iframe</div>
            </div>
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={e => setForm({ ...form, enabled: e.target.checked })}
              className="w-4 h-4 accent-emerald-700"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex items-start justify-between gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer">
            <div>
              <div className="font-bold text-gray-800">Exclude /admin &amp; /admin/* Routes</div>
              <div className="text-[11px] text-gray-500">Prevents GTM tags from firing inside Admin OS</div>
            </div>
            <input
              type="checkbox"
              checked={form.excludeAdmin}
              onChange={e => setForm({ ...form, excludeAdmin: e.target.checked })}
              className="mt-0.5 w-4 h-4 accent-emerald-700 shrink-0"
            />
          </label>

          <label className="flex items-start justify-between gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer">
            <div>
              <div className="font-bold text-gray-800">Google Consent Mode v2 (Default + Update)</div>
              <div className="text-[11px] text-gray-500">
                Runs before GTM initializes and updates live when visitors click Accept/Customize in Cookie Banner
              </div>
            </div>
            <input
              type="checkbox"
              checked={form.consentModeEnabled}
              onChange={e => setForm({ ...form, consentModeEnabled: e.target.checked })}
              className="mt-0.5 w-4 h-4 accent-emerald-700 shrink-0"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
          <label className="inline-flex items-center gap-2 text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={checkProd}
              onChange={e => setCheckProd(e.target.checked)}
              className="accent-emerald-700"
            />
            <span>Also check live production <code>https://www.360khabarnama.com/en</code></span>
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
                  <span>Remove GTM</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 bg-rose-50 border border-rose-300 px-3 py-1.5 rounded-lg">
                  <span className="text-rose-900 font-bold">Confirm remove GTM Container?</span>
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

      {/* GTM Workspace Setup Checklist */}
      <div className="bg-slate-900 text-slate-100 rounded-xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-black text-sm text-emerald-400">
            GTM Container Publishing &amp; GA4 Tag Setup Checklist
          </div>
          <a
            href="https://tagmanager.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold inline-flex items-center gap-1 text-[11px]"
          >
            <ExternalLink className="w-3 h-3" />
            <span>Open tagmanager.google.com</span>
          </a>
        </div>
        <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-300 leading-relaxed">
          <li>
            Inside Google Tag Manager, create a <strong>Google Tag</strong> using your GA4 Measurement ID{' '}
            (<code>{config.analytics.measurementId || 'G-XXXXXXXXXX'}</code>) on the <strong>Initialization – All Pages</strong> trigger.
          </li>
          <li>
            Add a <strong>GA4 Event</strong> tag triggered by Custom Event <code>page_view</code> (mapped with{' '}
            <code>page_path</code>, <code>page_title</code>, <code>content_language</code>) for bilingual React SPA navigation.
          </li>
          <li>
            Optionally add triggers for Custom Events: <code>article_view</code>, <code>article_engaged_read</code>,{' '}
            <code>language_switch</code>, <code>search</code>, <code>newsletter_signup</code>, and <code>outbound_click</code>.
          </li>
          <li>
            Click <strong>Submit → Publish</strong> in GTM! Un-published containers return 404 until first version is published.
          </li>
        </ol>
        {diagnostics?.gtm?.publishNote && (
          <div className="text-[11px] text-amber-300 border-t border-slate-800 pt-2">
            {diagnostics.gtm.publishNote}
          </div>
        )}
      </div>
    </div>
  );
};
