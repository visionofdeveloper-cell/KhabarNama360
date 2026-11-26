/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Global Portal Settings (9 Validated Tabs + Backup Export)
 */

import React, { useEffect, useRef, useState } from 'react';
import { Sliders, Save, Download, Upload, CheckCircle2, AlertTriangle, KeyRound, Activity, X } from 'lucide-react';
import { SiteSettings } from '../../types/index.ts';
import { safeFetchJson } from '../../utils/safeFetch.ts';
import { AIConnectionPanel } from './AIConnectionPanel.tsx';

type SettingsTab =
  | 'general'
  | 'ai-connection'
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
  onJumpToModule?: (mod: 'ai-keys' | 'seo' | 'automation' | 'diagnostics') => void;
}

export const GlobalSettings: React.FC<GlobalSettingsProps> = ({ settings, onSaved, onJumpToModule }) => {
  const [tab, setTab] = useState<SettingsTab>('general');
  const [form, setForm] = useState<SiteSettings | null>(settings);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const restoreInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (settings) setForm(JSON.parse(JSON.stringify(settings)));
  }, [settings]);

  if (!form) return <div className="p-8 text-center text-xs text-gray-500">Loading settings...</div>;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setBanner(null);
    try {
      const d = await safeFetchJson('/api/settings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (d.success) {
        setBanner({ type: 'success', text: 'All settings saved and synced.' });
        onSaved();
      } else {
        setBanner({ type: 'error', text: d.error || 'Failed to save settings.' });
      }
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Network or server error saving settings.' });
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoring(true);
    setBanner(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const d = await safeFetchJson('/api/admin/backup/restore', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot: parsed }),
      });
      if (d.success) {
        setBanner({
          type: 'success',
          text: `Backup restored cleanly (${(d.restoredSections || []).join(', ')}).`,
        });
        onSaved();
      } else {
        setBanner({ type: 'error', text: d.error || 'Backup restore failed.' });
      }
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Invalid JSON backup file.' });
    } finally {
      setRestoring(false);
      if (restoreInputRef.current) restoreInputRef.current.value = '';
    }
  };

  const TABS: { id: SettingsTab; label: string }[] = [
    { id: 'general', label: 'General & Content' },
    { id: 'ai-connection', label: 'AI API Connection' },
    { id: 'branding', label: 'Branding' },
    { id: 'navigation', label: 'Header & Navigation' },
    { id: 'footer', label: 'Footer' },
    { id: 'seo-defaults', label: 'SEO Defaults' },
    { id: 'integrations', label: 'Integrations & Analytics' },
    { id: 'automation', label: 'Automation' },
    { id: 'security', label: 'Security' },
    { id: 'maintenance', label: 'Maintenance & Backups' },
  ];

  return (
    <form onSubmit={handleSave} className="space-y-5 text-xs">
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-700" />
            <span>Global Site Settings & Configuration</span>
          </h2>
          <p className="text-gray-500">Manage bilingual brand metadata, homepage feed count, integrations, backups, & maintenance state.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onJumpToModule && (
            <button
              type="button"
              onClick={() => onJumpToModule('diagnostics')}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg inline-flex items-center gap-1.5"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Diagnostics</span>
            </button>
          )}
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
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </div>

      {banner && (
        <div
          className={`p-3 rounded-xl flex items-center justify-between border ${
            banner.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <span className="flex items-center gap-2 font-medium">
            {banner.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            )}
            {banner.text}
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

      {tab === 'ai-connection' ? (
        <AIConnectionPanel
          onNotify={msg => setBanner({ type: 'success', text: msg })}
          onProvidersChanged={onSaved}
          onOpenAdvancedVault={onJumpToModule ? () => onJumpToModule('ai-keys') : undefined}
        />
      ) : (
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
              <label className="block font-bold text-gray-700 mb-1">Canonical Production Site URL</label>
              <input
                type="url"
                value={form.siteUrl || 'https://www.360khabarnama.com'}
                onChange={e => setForm({ ...form, siteUrl: e.target.value })}
                placeholder="https://www.360khabarnama.com"
                className="w-full p-2.5 border border-gray-300 rounded-lg font-mono"
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Homepage Latest News Count</label>
                <input
                  type="number"
                  min={5}
                  max={50}
                  value={form.latestNewsCount ?? 15}
                  onChange={e => setForm({ ...form, latestNewsCount: Math.max(5, Math.min(50, parseInt(e.target.value, 10) || 15)) })}
                  className="w-full p-2.5 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Display Date Format</label>
                <select
                  value={form.dateFormat || 'MMM d, yyyy'}
                  onChange={e => setForm({ ...form, dateFormat: e.target.value })}
                  className="w-full p-2.5 border border-gray-300 rounded-lg bg-white font-mono"
                >
                  <option value="MMM d, yyyy">MMM d, yyyy</option>
                  <option value="dd/MM/yyyy">dd/MM/yyyy</option>
                  <option value="yyyy-MM-dd">yyyy-MM-dd</option>
                  <option value="relative">Relative (2h ago)</option>
                </select>
              </div>
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
                onChange={e => setForm({ ...form, navigation: { ...(form.navigation || { showBreakingTicker: true, showTopRatesBar: true, stickyHeader: true, showAskAiButton: true }), showAskAiButton: e.target.checked } })}
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
                  placeholder="ca-pub-xxxxxxxxxxxxxxxx"
                  className="w-full p-2.5 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Google Analytics 4 ID (G-...)</label>
                <input
                  type="text"
                  value={form.googleAnalyticsId || ''}
                  onChange={e => setForm({ ...form, googleAnalyticsId: e.target.value })}
                  placeholder="G-XXXXXXXXXX"
                  className="w-full p-2.5 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Google Tag Manager ID (GTM-...)</label>
                <input
                  type="text"
                  value={form.googleTagManagerId || ''}
                  onChange={e => setForm({ ...form, googleTagManagerId: e.target.value })}
                  placeholder="GTM-XXXXXXX"
                  className="w-full p-2.5 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Bing Webmaster Verification (msvalidate.01)</label>
                <input
                  type="text"
                  value={form.bingWebmasterVerification || ''}
                  onChange={e => setForm({ ...form, bingWebmasterVerification: e.target.value })}
                  placeholder="Bing meta verification token"
                  className="w-full p-2.5 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">IndexNow Verification Key (serves /:key.txt)</label>
                <input
                  type="text"
                  value={form.indexNowKey || ''}
                  onChange={e => setForm({ ...form, indexNowKey: e.target.value })}
                  placeholder="e.g. a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6"
                  className="w-full p-2.5 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <label className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg self-end">
                <span className="font-bold text-gray-800">Consent Banner Active</span>
                <input
                  type="checkbox"
                  checked={form.consentBannerEnabled ?? true}
                  onChange={e => setForm({ ...form, consentBannerEnabled: e.target.checked })}
                />
              </label>
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Custom /ads.txt Override (optional — overrides default AdSense line)</label>
              <textarea
                rows={3}
                value={form.adsTxtCustom || ''}
                onChange={e => setForm({ ...form, adsTxtCustom: e.target.value })}
                placeholder="google.com, pub-xxxxxxxxxxxxxxxx, DIRECT, f08c47fec0942fa0"
                className="w-full p-2.5 border border-gray-300 rounded-lg font-mono"
              />
            </div>

            <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-bold text-gray-900">Centralized Google Integrations &amp; AI Key Vault</div>
                <div className="text-gray-600">
                  Manage GA4 tracking modes, Consent Mode v2, GTM containers, Search Console OAuth/Sitemaps, or AI provider keys from their dedicated hubs.
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setTab('ai-connection')} className="px-3.5 py-2 bg-emerald-700 text-white font-bold rounded-lg inline-flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Connect AI API</span>
                </button>
                {onJumpToModule && (
                  <button type="button" onClick={() => onJumpToModule('seo')} className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg">
                    Open Google Integrations (GA4 / GTM / GSC)
                  </button>
                )}
              </div>
            </div>
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
          <div className="space-y-5">
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

            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-bold text-gray-900">Backups &amp; Non-Secret JSON Restore</div>
                <div className="text-gray-500">Restore site settings, homepage config, categories, ads, SEO rules, or subscribers from an exported snapshot without overwriting credentials.</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={restoreInputRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={handleRestoreBackup}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={restoring}
                  onClick={() => restoreInputRef.current?.click()}
                  className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-lg inline-flex items-center gap-1.5 disabled:opacity-60"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{restoring ? 'Restoring...' : 'Upload & Restore JSON'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      )}
    </form>
  );
};
