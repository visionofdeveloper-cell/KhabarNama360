/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Global Portal Settings (9 Validated Tabs + Backup Export)
 */

import React, { useEffect, useState } from 'react';
import { Sliders, Save, Download, CheckCircle2, KeyRound, X } from 'lucide-react';
import { SiteSettings } from '../../types/index.ts';
import { safeFetchJson } from '../../utils/safeFetch.ts';

type SettingsTab =
  | 'general'
  | 'branding'
  | 'navigation'
  | 'footer'
  | 'seo-defaults'
  | 'integrations'
  | 'automation'
  | 'security'
  | 'maintenance';

interface GlobalSettingsProps {
  settings: SiteSettings | null;
  onSaved: () => void;
  onJumpToModule?: (mod: 'ai-keys' | 'seo' | 'automation') => void;
}

export const GlobalSettings: React.FC<GlobalSettingsProps> = ({ settings, onSaved, onJumpToModule }) => {
  const [tab, setTab] = useState<SettingsTab>('general');
  const [form, setForm] = useState<SiteSettings | null>(settings);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    if (settings) setForm(JSON.parse(JSON.stringify(settings)));
  }, [settings]);

  if (!form) return <div className="p-8 text-center text-xs text-gray-500">Loading settings...</div>;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const d = await safeFetchJson('/api/settings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (d.success) {
        setBanner('All settings saved and synced.');
        onSaved();
      } else if (d.error) {
        setBanner(d.error);
      }
    } finally {
      setSaving(false);
    }
  };

  const TABS: { id: SettingsTab; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'branding', label: 'Branding' },
    { id: 'navigation', label: 'Header & Navigation' },
    { id: 'footer', label: 'Footer' },
    { id: 'seo-defaults', label: 'SEO Defaults' },
    { id: 'integrations', label: 'Integrations & AI Keys' },
    { id: 'automation', label: 'Automation' },
    { id: 'security', label: 'Security' },
    { id: 'maintenance', label: 'Site Maintenance' },
  ];

  return (
    <form onSubmit={handleSave} className="space-y-5 text-xs">
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-700" />
            <span>Global Site Settings & Configuration</span>
          </h2>
          <p className="text-gray-500">Manage bilingual brand metadata, header/footer layout, SEO defaults, security & maintenance state.</p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/api/admin/backup/export"
            className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-lg inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export DB Backup</span>
          </a>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg inline-flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </div>

      {banner && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            {banner}
          </span>
          <button type="button" onClick={() => setBanner(null)}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-gray-200 no-scrollbar">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap shrink-0 ${
              tab === t.id ? 'bg-emerald-800 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        {tab === 'general' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Portal Name (English)</label>
              <input
                type="text"
                value={form.siteNameEn}
                onChange={e => setForm({ ...form, siteNameEn: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Portal Name (Urdu)</label>
              <input
                type="text"
                dir="rtl"
                value={form.siteNameUr}
                onChange={e => setForm({ ...form, siteNameUr: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-lg font-urdu"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Tagline (English)</label>
              <input
                type="text"
                value={form.taglineEn}
                onChange={e => setForm({ ...form, taglineEn: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Tagline (Urdu)</label>
              <input
                type="text"
                dir="rtl"
                value={form.taglineUr}
                onChange={e => setForm({ ...form, taglineUr: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-lg font-urdu"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Editorial Contact Email</label>
              <input
                type="email"
                value={form.contactEmail}
                onChange={e => setForm({ ...form, contactEmail: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Default Public Language</label>
              <select
                value={form.defaultLanguage}
                onChange={e => setForm({ ...form, defaultLanguage: e.target.value as 'en' | 'ur' })}
                className="w-full p-2.5 border border-gray-300 rounded-lg bg-white"
              >
                <option value="ur">Urdu (RTL Default)</option>
                <option value="en">English (LTR Default)</option>
              </select>
            </div>
          </div>
        )}

        {tab === 'branding' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Logo URL</label>
              <input
                type="text"
                value={form.branding?.logoUrl || '/assets/aistudio/Modern_Green_and_Gold_News_Logo_2e9a99d4.png'}
                onChange={e => setForm({ ...form, branding: { ...(form.branding || { faviconUrl: '', primaryColor: '#065f46', accentColor: '#f59e0b' }), logoUrl: e.target.value } })}
                className="w-full p-2.5 border border-gray-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Primary Brand Hex</label>
              <input
                type="text"
                value={form.branding?.primaryColor || '#065f46'}
                onChange={e => setForm({ ...form, branding: { ...(form.branding || { logoUrl: '', faviconUrl: '', accentColor: '#f59e0b' }), primaryColor: e.target.value } })}
                className="w-full p-2.5 border border-gray-300 rounded-lg font-mono"
              />
            </div>
          </div>
        )}

        {tab === 'navigation' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <span className="font-bold">Show Breaking News Ticker</span>
              <input
                type="checkbox"
                checked={form.navigation?.showBreakingTicker ?? true}
                onChange={e => setForm({ ...form, navigation: { ...(form.navigation || { showTopRatesBar: true, stickyHeader: true, showAskAiButton: true }), showBreakingTicker: e.target.checked } })}
              />
            </label>
            <label className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <span className="font-bold">Show Top Gold & Weather Utility Bar</span>
              <input
                type="checkbox"
                checked={form.navigation?.showTopRatesBar ?? true}
                onChange={e => setForm({ ...form, navigation: { ...(form.navigation || { showBreakingTicker: true, stickyHeader: true, showAskAiButton: true }), showTopRatesBar: e.target.checked } })}
              />
            </label>
            <label className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <span className="font-bold">Sticky Navigation Bar</span>
              <input
                type="checkbox"
                checked={form.navigation?.stickyHeader ?? true}
                onChange={e => setForm({ ...form, navigation: { ...(form.navigation || { showBreakingTicker: true, showTopRatesBar: true, showAskAiButton: true }), stickyHeader: e.target.checked } })}
              />
            </label>
            <label className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <span className="font-bold">Show Reader Ask AI Modal Trigger</span>
              <input
                type="checkbox"
                checked={form.navigation?.showAskAiButton ?? true}
                onChange={e => setForm({ ...form, navigation: { ...(form.navigation || { showBreakingTicker: true, showTopRatesBar: true, stickyHeader: true }), showAskAiButton: e.target.checked } })}
              />
            </label>
          </div>
        )}

        {tab === 'footer' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Footer Copyright (EN)</label>
              <input
                type="text"
                value={form.footer?.copyrightEn || ''}
                onChange={e => setForm({ ...form, footer: { ...(form.footer || { copyrightUr: '', showNewsletterBox: true, socialLinks: {} }), copyrightEn: e.target.value } })}
                className="w-full p-2.5 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Footer Copyright (UR)</label>
              <input
                type="text"
                dir="rtl"
                value={form.footer?.copyrightUr || ''}
                onChange={e => setForm({ ...form, footer: { ...(form.footer || { copyrightEn: '', showNewsletterBox: true, socialLinks: {} }), copyrightUr: e.target.value } })}
                className="w-full p-2.5 border border-gray-300 rounded-lg font-urdu"
              />
            </div>
          </div>
        )}

        {tab === 'seo-defaults' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Global Title Pattern</label>
              <input
                type="text"
                value={form.seoDefaults?.titlePattern || '{title} | 360Khabarnama'}
                onChange={e => setForm({ ...form, seoDefaults: { ...(form.seoDefaults || { defaultMetaDescEn: '', defaultMetaDescUr: '', robotsDefault: 'index, follow', defaultOgImage: '' }), titlePattern: e.target.value } })}
                className="w-full p-2.5 border border-gray-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Default Robots Directive</label>
              <input
                type="text"
                value={form.seoDefaults?.robotsDefault || 'index, follow'}
                onChange={e => setForm({ ...form, seoDefaults: { ...(form.seoDefaults || { titlePattern: '', defaultMetaDescEn: '', defaultMetaDescUr: '', defaultOgImage: '' }), robotsDefault: e.target.value } })}
                className="w-full p-2.5 border border-gray-300 rounded-lg font-mono"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block font-bold text-gray-700 mb-1">Default Meta Description (EN)</label>
              <textarea
                rows={2}
                value={form.seoDefaults?.defaultMetaDescEn || ''}
                onChange={e => setForm({ ...form, seoDefaults: { ...(form.seoDefaults || { titlePattern: '', defaultMetaDescUr: '', robotsDefault: 'index, follow', defaultOgImage: '' }), defaultMetaDescEn: e.target.value } })}
                className="w-full p-2.5 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
        )}

        {tab === 'integrations' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-gray-700 mb-1">AdSense Publisher ID (ca-pub-...)</label>
                <input
                  type="text"
                  value={form.adsensePublisherId || ''}
                  onChange={e => setForm({ ...form, adsensePublisherId: e.target.value })}
                  className="w-full p-2.5 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Google Analytics Measurement ID (G-...)</label>
                <input
                  type="text"
                  value={form.googleAnalyticsId || ''}
                  onChange={e => setForm({ ...form, googleAnalyticsId: e.target.value })}
                  className="w-full p-2.5 border border-gray-300 rounded-lg font-mono"
                />
              </div>
            </div>

            {onJumpToModule && (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-gray-900">Encrypted AI API Keys & Search Console Credentials</div>
                  <div className="text-gray-500">Manage Gemini/Grok keys, task routing, and Google Search Console OAuth/Service Accounts in their dedicated vaults.</div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => onJumpToModule('ai-keys')} className="px-3.5 py-2 bg-emerald-700 text-white font-bold rounded-lg inline-flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Open AI Keys & Routing</span>
                  </button>
                  <button type="button" onClick={() => onJumpToModule('seo')} className="px-3.5 py-2 bg-gray-900 text-white font-bold rounded-lg">
                    Search Console Setup
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'automation' && (
          <div className="space-y-3">
            <p className="text-gray-600">
              All external API polling, Namecheap cPanel 5-minute cron execution, and feed validation are configured in the Live Data &amp; Cron module.
            </p>
            {onJumpToModule && (
              <button type="button" onClick={() => onJumpToModule('automation')} className="px-4 py-2 bg-emerald-700 text-white font-bold rounded-lg">
                Open Live Data & Cron Controls
              </button>
            )}
          </div>
        )}

        {tab === 'security' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Admin Session TTL (Hours)</label>
              <input
                type="number"
                min={1}
                max={48}
                value={form.security?.sessionTtlHours ?? 8}
                onChange={e => setForm({ ...form, security: { ...(form.security || { enforceMfaForSuperAdmin: false, maxLoginAttempts: 5 }), sessionTtlHours: parseInt(e.target.value) || 8 } })}
                className="w-full p-2.5 border border-gray-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Failed Login Lockout Threshold</label>
              <input
                type="number"
                min={3}
                max={20}
                value={form.security?.maxLoginAttempts ?? 5}
                onChange={e => setForm({ ...form, security: { ...(form.security || { enforceMfaForSuperAdmin: false, sessionTtlHours: 8 }), maxLoginAttempts: parseInt(e.target.value) || 5 } })}
                className="w-full p-2.5 border border-gray-300 rounded-lg font-mono"
              />
            </div>
          </div>
        )}

        {tab === 'maintenance' && (
          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div>
                <div className="font-bold text-amber-950">Enable Public Maintenance Mode</div>
                <div className="text-amber-800">Shows an informative maintenance banner to public readers while /admin stays accessible.</div>
              </div>
              <input
                type="checkbox"
                checked={form.maintenance?.enabled ?? false}
                onChange={e => setForm({ ...form, maintenance: { ...(form.maintenance || { messageEn: 'Portal upgrading.', messageUr: 'پورٹل اپ گریڈ ہو رہا ہے۔' }), enabled: e.target.checked } })}
              />
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Maintenance Notice (EN)</label>
                <textarea
                  rows={2}
                  value={form.maintenance?.messageEn || ''}
                  onChange={e => setForm({ ...form, maintenance: { ...(form.maintenance || { enabled: false, messageUr: '' }), messageEn: e.target.value } })}
                  className="w-full p-2.5 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Maintenance Notice (UR)</label>
                <textarea
                  rows={2}
                  dir="rtl"
                  value={form.maintenance?.messageUr || ''}
                  onChange={e => setForm({ ...form, maintenance: { ...(form.maintenance || { enabled: false, messageEn: '' }), messageUr: e.target.value } })}
                  className="w-full p-2.5 border border-gray-300 rounded-lg font-urdu"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </form>
  );
};
