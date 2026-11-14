/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Enterprise SEO Manager & Real Search Console Diagnostics (13 Tabs)
 */

import React, { useEffect, useState } from 'react';
import {
  Globe,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileCode2,
  Link2,
  Image as ImageIcon,
  Code2,
  Languages,
  Activity,
  RefreshCw,
  Save,
  Plus,
  Trash2,
  ExternalLink,
  ShieldAlert,
  Edit3,
  Power,
  X,
  Sparkles,
} from 'lucide-react';
import {
  Article,
  CategoryPageConfig,
  MediaAsset,
  RedirectRule,
  SearchConsoleMetrics,
  SeoAuditLogEntry,
  SeoPageConfig,
  SitemapSettings,
} from '../../types/index.ts';
import { safeFetchJson } from '../../utils/safeFetch.ts';

type SeoSubTab =
  | 'overview'
  | 'pages'
  | 'news'
  | 'categories'
  | 'technical'
  | 'sitemaps'
  | 'robots'
  | 'redirects'
  | 'internal-links'
  | 'images'
  | 'structured-data'
  | 'hreflang'
  | 'search-console';

interface SEOManagerProps {
  articles: Article[];
  mediaAssets: MediaAsset[];
  categories: CategoryPageConfig[];
  onRefreshParent?: () => void;
  onEditArticle?: (article: Article) => void;
}

export const SEOManager: React.FC<SEOManagerProps> = ({
  articles,
  mediaAssets,
  categories,
  onRefreshParent,
  onEditArticle,
}) => {
  const [tab, setTab] = useState<SeoSubTab>('overview');
  const [seoPages, setSeoPages] = useState<SeoPageConfig[]>([]);
  const [editingPage, setEditingPage] = useState<SeoPageConfig | null>(null);
  const [redirects, setRedirects] = useState<RedirectRule[]>([]);
  const [newRedirect, setNewRedirect] = useState<{ sourcePath: string; targetPath: string; statusCode: 301 | 302 | 410 }>({
    sourcePath: '',
    targetPath: '/',
    statusCode: 301,
  });
  const [robotsTxt, setRobotsTxt] = useState('');
  const [sitemapConfig, setSitemapConfig] = useState<SitemapSettings | null>(null);
  const [auditResult, setAuditResult] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<SeoAuditLogEntry[]>([]);

  // Search Console real connection & diagnostics
  const [gscConn, setGscConn] = useState<any>(null);
  const [gscMetrics, setGscMetrics] = useState<SearchConsoleMetrics | null>(null);
  const [oauthClientId, setOauthClientId] = useState('');
  const [oauthClientSecret, setOauthClientSecret] = useState('');
  const [gscPropertyUrl, setGscPropertyUrl] = useState('https://360khabarnama.com/');
  const [saJsonInput, setSaJsonInput] = useState('');
  const [oauthCodeInput, setOauthCodeInput] = useState('');
  const [gscBusy, setGscBusy] = useState(false);

  // Internal Links & Schema tester
  const [selectedArticleId, setSelectedArticleId] = useState<string>(articles[0]?.id || '');
  const [linkSuggestions, setLinkSuggestions] = useState<any[]>([]);
  const [schemaPreview, setSchemaPreview] = useState<any>(null);
  const [aiSeoBusy, setAiSeoBusy] = useState(false);

  const [banner, setBanner] = useState<{ ok: boolean; msg: string } | null>(null);

  const loadSeoState = async () => {
    try {
      const [pagesRes, redRes, robRes, smRes, scRes, logRes] = await Promise.all([
        safeFetchJson('/api/admin/seo/pages', { credentials: 'include' }),
        safeFetchJson('/api/admin/seo/redirects', { credentials: 'include' }),
        safeFetchJson('/api/admin/seo/robots-txt', { credentials: 'include' }),
        safeFetchJson('/api/admin/seo/sitemap-config', { credentials: 'include' }),
        safeFetchJson('/api/admin/seo/search-console', { credentials: 'include' }),
        safeFetchJson('/api/admin/seo/audit-logs', { credentials: 'include' }),
      ]);
      if (pagesRes.success) setSeoPages(pagesRes.pages || []);
      if (redRes.success) setRedirects(redRes.redirects || []);
      if (robRes.success) setRobotsTxt(robRes.content || '');
      if (smRes.success) setSitemapConfig(smRes.config || null);
      if (scRes.success) {
        setGscMetrics(scRes.metrics || null);
        setGscConn(scRes.connection || null);
        if (scRes.connection?.clientId) setOauthClientId(scRes.connection.clientId);
        if (scRes.connection?.propertyUrl) setGscPropertyUrl(scRes.connection.propertyUrl);
      }
      if (logRes.success) setAuditLogs(logRes.logs || []);
    } catch (e: any) {
      setBanner({ ok: false, msg: e?.message || 'Error loading SEO configuration.' });
    }
  };

  useEffect(() => {
    loadSeoState();
  }, []);

  const handleSaveSeoPage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPage) return;
    const d = await safeFetchJson('/api/admin/seo/pages', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingPage),
    });
    if (d.success) {
      setEditingPage(null);
      setBanner({ ok: true, msg: `Saved SEO metadata for "${d.page.path}".` });
      loadSeoState();
      onRefreshParent?.();
    } else {
      setBanner({ ok: false, msg: d.error || 'Failed to save SEO page.' });
    }
  };

  const handleAiSuggestPageMeta = async () => {
    if (!editingPage) return;
    setAiSeoBusy(true);
    try {
      const d = await safeFetchJson('/api/admin/ai/seo-tags', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editingPage.titleEn || editingPage.path,
          content: `Route: ${editingPage.path}. Focus keyword: ${editingPage.focusKeyword || ''}. Existing summary: ${editingPage.metaDescEn || ''}`,
        }),
      });
      if (d.success && d.seo) {
        setEditingPage(prev =>
          prev
            ? {
                ...prev,
                titleEn: d.seo.metaTitleEn || prev.titleEn,
                metaDescEn: d.seo.metaDescription || prev.metaDescEn,
                focusKeyword: Array.isArray(d.seo.tags) ? d.seo.tags.join(', ') : prev.focusKeyword,
              }
            : prev
        );
        setBanner({
          ok: true,
          msg: `AI generated SEO title & description${d.telemetry ? ` (${d.telemetry.providerType} • ${d.telemetry.model})` : ''}.`,
        });
      } else {
        setBanner({ ok: false, msg: d.error || 'No working AI provider configured. Connect one in Settings → AI & API Providers.' });
      }
    } finally {
      setAiSeoBusy(false);
    }
  };

  const handleAiSuggestInternalLinks = async () => {
    const art = articles.find(a => a.id === selectedArticleId);
    if (!art) return;
    setAiSeoBusy(true);
    try {
      const d = await safeFetchJson('/api/admin/ai/seo-internal-links', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: art.id,
          titleEn: art.titleEn,
          category: art.category,
          contentEn: art.contentEn,
        }),
      });
      if (d.success) {
        setLinkSuggestions(d.suggestions || []);
        setBanner({
          ok: true,
          msg: `AI suggested ${(d.suggestions || []).length} internal links${d.telemetry ? ` via ${d.telemetry.model}` : ''}.`,
        });
      } else {
        setBanner({ ok: false, msg: d.error || 'No working AI provider configured. Connect one in Settings → AI & API Providers.' });
      }
    } finally {
      setAiSeoBusy(false);
    }
  };

  const handleRunTechnicalAudit = async () => {
    const d = await safeFetchJson('/api/admin/seo/audit/run', { method: 'POST', credentials: 'include' });
    if (d.success) {
      setAuditResult(d.audit);
      setBanner({
        ok: d.audit.criticalCount === 0,
        msg: `Technical SEO Audit complete — Score: ${d.audit.score}/100 (${d.audit.criticalCount} critical, ${d.audit.warningCount} warnings).`,
      });
      loadSeoState();
    } else if (d.error) {
      setBanner({ ok: false, msg: d.error });
    }
  };

  const handleSaveRobots = async (e: React.FormEvent) => {
    e.preventDefault();
    const d = await safeFetchJson('/api/admin/seo/robots-txt', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: robotsTxt }),
    });
    if (d.success) setBanner({ ok: true, msg: 'robots.txt updated and published cleanly.' });
    else if (d.error) setBanner({ ok: false, msg: d.error });
  };

  const handleSaveSitemapConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sitemapConfig) return;
    const d = await safeFetchJson('/api/admin/seo/sitemap-config', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sitemapConfig),
    });
    if (d.success) setBanner({ ok: true, msg: 'XML Sitemap configuration saved.' });
    else if (d.error) setBanner({ ok: false, msg: d.error });
  };

  const handleAddRedirect = async (e: React.FormEvent) => {
    e.preventDefault();
    const d = await safeFetchJson('/api/admin/seo/redirects', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRedirect),
    });
    if (d.success) {
      setNewRedirect({ sourcePath: '', targetPath: '/', statusCode: 301 });
      setBanner({ ok: true, msg: 'Redirect rule created.' });
      loadSeoState();
    } else if (d.error) {
      setBanner({ ok: false, msg: d.error });
    }
  };

  const handleToggleRedirect = async (r: RedirectRule) => {
    await safeFetchJson('/api/admin/seo/redirects', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...r, active: !r.active }),
    });
    loadSeoState();
  };

  const handleDeleteRedirect = async (id: string) => {
    await safeFetchJson(`/api/admin/seo/redirects/${id}`, { method: 'DELETE', credentials: 'include' });
    loadSeoState();
  };

  const handleSaveCategorySeo = async (cat: CategoryPageConfig, updates: Partial<CategoryPageConfig>) => {
    const d = await safeFetchJson(`/api/admin/categories/${cat.slug}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...cat, ...updates }),
    });
    if (d.success) {
      setBanner({ ok: true, msg: `Category SEO saved for ${cat.nameEn}.` });
      onRefreshParent?.();
    } else if (d.error) {
      setBanner({ ok: false, msg: d.error });
    }
  };

  // Search Console handlers
  const handleSaveGscOAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setGscBusy(true);
    try {
      const d = await safeFetchJson('/api/admin/seo/gsc/oauth-config', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: oauthClientId, clientSecret: oauthClientSecret, propertyUrl: gscPropertyUrl }),
      });
      setBanner({ ok: Boolean(d.success), msg: d.success ? 'OAuth client saved. Authorize Consent below.' : (d.error || 'Failed saving OAuth config.') });
      loadSeoState();
    } finally {
      setGscBusy(false);
    }
  };

  const handleStartOAuthConsent = async () => {
    const redirectUri = `${window.location.origin}/api/admin/seo/gsc/oauth-callback`;
    const d = await safeFetchJson(`/api/admin/seo/gsc/oauth-url?redirectUri=${encodeURIComponent(redirectUri)}`, {
      credentials: 'include',
    });
    if (d.success && d.authUrl) {
      window.location.assign(d.authUrl);
    } else {
      setBanner({ ok: false, msg: d.error || 'Could not generate OAuth URL.' });
    }
  };

  const handleExchangeOAuthCode = async () => {
    setGscBusy(true);
    try {
      const redirectUri = `${window.location.origin}/api/admin/seo/gsc/oauth-callback`;
      const d = await safeFetchJson('/api/admin/seo/gsc/oauth-exchange', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: oauthCodeInput, redirectUri }),
      });
      setBanner({ ok: Boolean(d.success), msg: d.message || d.error || 'Code processed.' });
      setOauthCodeInput('');
      loadSeoState();
    } finally {
      setGscBusy(false);
    }
  };

  const handleSaveServiceAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setGscBusy(true);
    try {
      const d = await safeFetchJson('/api/admin/seo/gsc/service-account', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceAccountJson: saJsonInput, propertyUrl: gscPropertyUrl }),
      });
      setBanner({ ok: Boolean(d.success), msg: d.success ? 'Service account encrypted & saved. Run Test Connection.' : (d.error || 'Failed saving service account.') });
      setSaJsonInput('');
      loadSeoState();
    } finally {
      setGscBusy(false);
    }
  };

  const handleTestGsc = async () => {
    setGscBusy(true);
    try {
      const d = await safeFetchJson('/api/admin/seo/gsc/test', { method: 'POST', credentials: 'include' });
      setBanner({ ok: d.status === 'Authorized', msg: `[${d.status || 'Error'}] ${d.message || d.error || 'Connection test failed.'}` });
      loadSeoState();
    } finally {
      setGscBusy(false);
    }
  };

  const handleSyncGsc = async () => {
    setGscBusy(true);
    try {
      const d = await safeFetchJson('/api/admin/seo/gsc/sync', { method: 'POST', credentials: 'include' });
      setBanner({
        ok: Boolean(d.success && d.metrics?.connected),
        msg: d.metrics?.diagnosticMessage || d.error || 'Sync attempt finished.',
      });
      loadSeoState();
    } finally {
      setGscBusy(false);
    }
  };

  const handleDisconnectGsc = async () => {
    await safeFetchJson('/api/admin/seo/gsc/disconnect', { method: 'POST', credentials: 'include' });
    setBanner({ ok: true, msg: 'Search Console disconnected cleanly.' });
    loadSeoState();
  };

  const loadLinksForArticle = async (id: string) => {
    setSelectedArticleId(id);
    const d = await safeFetchJson(`/api/admin/seo/internal-links/${id}`, { credentials: 'include' });
    if (d.success) setLinkSuggestions(d.suggestions || []);
    const art = articles.find(a => a.id === id);
    if (art) {
      setSchemaPreview({
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        headline: art.titleEn,
        alternativeHeadline: art.titleUr,
        datePublished: art.publishedAt,
        dateModified: art.updatedAt || art.publishedAt,
        author: { '@type': 'Person', name: art.author?.nameEn },
        publisher: { '@type': 'Organization', name: '360Khabarnama' },
        image: art.heroImage ? [art.heroImage] : [],
      });
    }
  };

  const TABS: { id: SeoSubTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'pages', label: `All Pages SEO (${seoPages.length})` },
    { id: 'news', label: `News SEO (${articles.length})` },
    { id: 'categories', label: `Category SEO (${categories.length})` },
    { id: 'technical', label: 'Technical SEO' },
    { id: 'sitemaps', label: 'Sitemaps' },
    { id: 'robots', label: 'Robots.txt' },
    { id: 'redirects', label: `Redirects (${redirects.length})` },
    { id: 'internal-links', label: 'Internal Links' },
    { id: 'images', label: 'Image SEO' },
    { id: 'structured-data', label: 'Structured Data' },
    { id: 'hreflang', label: 'Bilingual Hreflang' },
    { id: 'search-console', label: 'Search Console' },
  ];

  const diagStatus = gscConn?.diagnosticStatus || gscMetrics?.diagnosticStatus || 'Disconnected';
  const gscStatusColor =
    diagStatus === 'Authorized'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : diagStatus === 'Disconnected' || diagStatus === 'No Data Yet'
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : 'bg-rose-50 text-rose-800 border-rose-200';

  return (
    <div className="space-y-5">
      {banner && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
            banner.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <span>{banner.msg}</span>
          <button onClick={() => setBanner(null)} className="text-gray-500 hover:text-gray-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Horizontal Scrollable Sub-Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-gray-200 no-scrollbar">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
              tab === t.id ? 'bg-emerald-800 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 1. OVERVIEW */}
      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-[11px] font-bold text-gray-500 uppercase">Search Console</div>
              <div className="mt-1">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${gscStatusColor}`}>
                  {diagStatus}
                </span>
              </div>
              <div className="text-[11px] text-gray-500 mt-1.5">
                {gscMetrics?.connected ? `${gscMetrics.clicks.toLocaleString()} clicks (28d)` : 'Connect credentials to sync real data'}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-[11px] font-bold text-gray-500 uppercase">Configured SEO Routes</div>
              <div className="text-2xl font-black text-gray-900 font-mono tabular-nums mt-1">{seoPages.length}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">Active route overrides</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-[11px] font-bold text-gray-500 uppercase">Published News Index</div>
              <div className="text-2xl font-black text-emerald-700 font-mono tabular-nums mt-1">
                {articles.filter(a => a.status === 'published').length}
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">EN + UR bilingual URLs</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-[11px] font-bold text-gray-500 uppercase">Active Redirect Rules</div>
              <div className="text-2xl font-black text-gray-900 font-mono tabular-nums mt-1">
                {redirects.filter(r => r.active).length}
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">301 / 302 / 410 enforced</div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-gray-900">Recent SEO Audit Log</h3>
              <p className="text-xs text-gray-500">Tracked metadata saves, Search Console diagnostics & technical checks</p>
            </div>
            <button
              type="button"
              onClick={handleRunTechnicalAudit}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Run Technical Audit</span>
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 border-b border-gray-200 font-bold text-gray-600">
                <tr>
                  <th className="p-3">Time</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Target</th>
                  <th className="p-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-gray-500">No SEO audit events recorded yet.</td>
                  </tr>
                ) : (
                  auditLogs.slice(0, 15).map(log => (
                    <tr key={log.id}>
                      <td className="p-3 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="p-3 font-bold text-gray-900">{log.action}</td>
                      <td className="p-3 font-mono text-[11px] text-gray-700">{log.target}</td>
                      <td className="p-3 text-gray-600">{log.details}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. ALL PAGES SEO */}
      {tab === 'pages' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-4">
            <div>
              <h3 className="text-sm font-black text-gray-900">Static & Core Route Metadata Overrides</h3>
              <p className="text-xs text-gray-500">Served dynamically in server HTML &lt;head&gt; for direct visits & crawlers</p>
            </div>
            <button
              type="button"
              onClick={() =>
                setEditingPage({
                  id: `seo-${Date.now()}`,
                  path: '/new-route',
                  titleEn: '',
                  titleUr: '',
                  metaDescEn: '',
                  metaDescUr: '',
                  canonicalUrl: 'https://360khabarnama.com/',
                  robotsDirectives: 'index, follow',
                  ogImage: 'https://360khabarnama.com/assets/aistudio/Modern_Green_and_Gold_News_Logo_2e9a99d4.png',
                  schemaType: 'WebPage',
                  focusKeyword: '',
                  lastAuditedAt: new Date().toISOString(),
                })
              }
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Page SEO Rule</span>
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 border-b border-gray-200 font-bold text-gray-600">
                <tr>
                  <th className="p-3">Path</th>
                  <th className="p-3">Title (EN / UR)</th>
                  <th className="p-3">Robots & Schema</th>
                  <th className="p-3 text-right">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {seoPages.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="p-3 font-mono font-bold text-emerald-800">{p.path}</td>
                    <td className="p-3">
                      <div className="font-bold text-gray-900">{p.titleEn}</div>
                      <div className="font-urdu text-gray-600" dir="rtl">{p.titleUr}</div>
                    </td>
                    <td className="p-3 text-[11px] font-mono text-gray-600">
                      <div>{p.robotsDirectives}</div>
                      <div className="text-gray-400">{p.schemaType}</div>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => setEditingPage({ ...p })}
                        className="px-3 py-1 bg-gray-100 hover:bg-emerald-700 hover:text-white rounded font-bold text-gray-800"
                      >
                        Edit Metadata
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. NEWS SEO */}
      {tab === 'news' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-100 text-xs text-gray-600">
            Article-level Google News readiness, custom meta title/description, noIndex check, and hero image compliance.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 border-b border-gray-200 font-bold text-gray-600">
                <tr>
                  <th className="p-3">Headline & Slug</th>
                  <th className="p-3">SEO Meta Status</th>
                  <th className="p-3">Tags</th>
                  <th className="p-3 text-right">Edit Article</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {articles.map(a => {
                  const okMeta = (a.seo?.metaTitleEn || a.titleEn).length >= 15 && (a.seo?.metaDescriptionEn || a.summaryEn).length >= 40;
                  return (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="p-3">
                        <div className="font-bold text-gray-900 line-clamp-1">{a.titleEn}</div>
                        <div className="font-mono text-[11px] text-emerald-700">/en/news/{a.slug}</div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            okMeta ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {okMeta ? 'Ready' : 'Needs Review'}
                        </span>
                      </td>
                      <td className="p-3 text-[11px] text-gray-600 font-mono">{(a.tags || []).length} tags</td>
                      <td className="p-3 text-right">
                        {onEditArticle && (
                          <button
                            type="button"
                            onClick={() => onEditArticle(a)}
                            className="px-3 py-1 bg-gray-100 hover:bg-emerald-700 hover:text-white rounded font-bold text-gray-800 inline-flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Open in Composer</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. CATEGORY SEO */}
      {tab === 'categories' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 border-b border-gray-200 font-bold text-gray-600">
                <tr>
                  <th className="p-3">Category Route</th>
                  <th className="p-3">SEO Title (EN)</th>
                  <th className="p-3">SEO Title (UR)</th>
                  <th className="p-3">Robots</th>
                  <th className="p-3 text-right">Quick Save</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {categories.map(cat => (
                  <tr key={cat.slug}>
                    <td className="p-3 font-mono font-bold text-emerald-800">/{cat.slug}</td>
                    <td className="p-3">
                      <input
                        type="text"
                        defaultValue={cat.seoTitleEn || `${cat.nameEn} | 360Khabarnama`}
                        id={`cat-seo-en-${cat.slug}`}
                        className="w-full p-1.5 border border-gray-300 rounded text-xs"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="text"
                        dir="rtl"
                        defaultValue={cat.seoTitleUr || `${cat.nameUr} | 360 خبرنامہ`}
                        id={`cat-seo-ur-${cat.slug}`}
                        className="w-full p-1.5 border border-gray-300 rounded font-urdu text-xs"
                      />
                    </td>
                    <td className="p-3 font-mono text-[11px]">{cat.robots || 'index, follow'}</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          const enVal = (document.getElementById(`cat-seo-en-${cat.slug}`) as HTMLInputElement)?.value;
                          const urVal = (document.getElementById(`cat-seo-ur-${cat.slug}`) as HTMLInputElement)?.value;
                          handleSaveCategorySeo(cat, { seoTitleEn: enVal, seoTitleUr: urVal });
                        }}
                        className="px-3 py-1 bg-emerald-700 text-white font-bold rounded text-[11px]"
                      >
                        Save
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. TECHNICAL SEO */}
      {tab === 'technical' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-gray-900">Live Technical SEO Inspector</h3>
              <p className="text-xs text-gray-500">Scans duplicate slugs, missing canonicals, broken links, missing hreflang companions & image alt attributes.</p>
            </div>
            <button
              type="button"
              onClick={handleRunTechnicalAudit}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Run Full Technical Scan</span>
            </button>
          </div>

          {auditResult && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="text-[11px] text-gray-500 font-bold">Health Score</div>
                  <div className="text-2xl font-black text-emerald-700 font-mono tabular-nums">{auditResult.score}/100</div>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
                  <div className="text-[11px] text-rose-700 font-bold">Critical Issues</div>
                  <div className="text-2xl font-black text-rose-800 font-mono tabular-nums">{auditResult.criticalCount}</div>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="text-[11px] text-amber-700 font-bold">Warnings</div>
                  <div className="text-2xl font-black text-amber-800 font-mono tabular-nums">{auditResult.warningCount}</div>
                </div>
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="text-[11px] text-gray-500 font-bold">Passing Articles</div>
                  <div className="text-2xl font-black text-gray-900 font-mono tabular-nums">
                    {auditResult.passingArticlesCount}/{auditResult.publishedArticlesCount}
                  </div>
                </div>
              </div>

              <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
                {(auditResult.issues || []).length === 0 ? (
                  <div className="p-6 text-center text-xs text-emerald-700 font-bold">Zero technical issues detected.</div>
                ) : (
                  auditResult.issues.map((iss: any) => (
                    <div key={iss.id} className="p-3 text-xs flex items-start justify-between gap-4">
                      <div>
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase mr-2 ${
                            iss.severity === 'critical'
                              ? 'bg-rose-100 text-rose-800'
                              : iss.severity === 'warning'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {iss.severity}
                        </span>
                        <span className="font-bold text-gray-800 mr-2">[{iss.category}]</span>
                        <span className="text-gray-700">{iss.message}</span>
                      </div>
                      <span className="font-mono text-[11px] text-gray-500 shrink-0">{iss.target}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. SITEMAPS */}
      {tab === 'sitemaps' && sitemapConfig && (
        <form onSubmit={handleSaveSitemapConfig} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
            <div>
              <h3 className="text-sm font-black text-gray-900">XML Sitemap Generator Controls</h3>
              <p className="text-gray-500">Inspect and customize /sitemap.xml and /sitemap-news.xml outputs</p>
            </div>
            <div className="flex gap-2">
              <a
                href="/sitemap.xml"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-lg inline-flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Inspect /sitemap.xml</span>
              </a>
              <a
                href="/sitemap-news.xml"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-lg inline-flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Inspect /sitemap-news.xml</span>
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <span className="font-bold text-gray-800">Include Image Sitemap Tags (&lt;image:image&gt;)</span>
              <input
                type="checkbox"
                checked={sitemapConfig.includeImages}
                onChange={e => setSitemapConfig({ ...sitemapConfig, includeImages: e.target.checked })}
              />
            </label>
            <label className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <span className="font-bold text-gray-800">Include Category Archive Pages</span>
              <input
                type="checkbox"
                checked={sitemapConfig.includeCategories}
                onChange={e => setSitemapConfig({ ...sitemapConfig, includeCategories: e.target.checked })}
              />
            </label>
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">Excluded Paths (one per line)</label>
            <textarea
              rows={3}
              value={(sitemapConfig.excludedPaths || []).join('\n')}
              onChange={e =>
                setSitemapConfig({
                  ...sitemapConfig,
                  excludedPaths: e.target.value.split('\n').map(s => s.trim()).filter(Boolean),
                })
              }
              className="w-full p-2.5 border border-gray-300 rounded-lg font-mono text-xs"
            />
          </div>

          <div className="flex justify-end">
            <button type="submit" className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg">
              Save Sitemap Configuration
            </button>
          </div>
        </form>
      )}

      {/* 7. ROBOTS.TXT */}
      {tab === 'robots' && (
        <form onSubmit={handleSaveRobots} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-gray-900">Editable /robots.txt Directives</h3>
              <p className="text-gray-500">Served dynamically at /robots.txt across all crawlers.</p>
            </div>
            <a
              href="/robots.txt"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 font-bold rounded-lg inline-flex items-center gap-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>View Live /robots.txt</span>
            </a>
          </div>
          <textarea
            rows={12}
            value={robotsTxt}
            onChange={e => setRobotsTxt(e.target.value)}
            className="w-full p-3 bg-gray-950 text-emerald-300 font-mono text-xs rounded-xl border border-gray-800"
          />
          <div className="flex justify-end">
            <button type="submit" className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg inline-flex items-center gap-1.5">
              <Save className="w-3.5 h-3.5" />
              <span>Save robots.txt</span>
            </button>
          </div>
        </form>
      )}

      {/* 8. REDIRECTS */}
      {tab === 'redirects' && (
        <div className="space-y-4">
          <form onSubmit={handleAddRedirect} className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end text-xs">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Source Path</label>
              <input
                type="text"
                required
                value={newRedirect.sourcePath}
                onChange={e => setNewRedirect({ ...newRedirect, sourcePath: e.target.value })}
                placeholder="/old-slug"
                className="w-full p-2 border border-gray-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Target Path</label>
              <input
                type="text"
                required={newRedirect.statusCode !== 410}
                value={newRedirect.targetPath}
                onChange={e => setNewRedirect({ ...newRedirect, targetPath: e.target.value })}
                placeholder="/en/news/new-slug"
                className="w-full p-2 border border-gray-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">HTTP Status</label>
              <select
                value={newRedirect.statusCode}
                onChange={e => setNewRedirect({ ...newRedirect, statusCode: parseInt(e.target.value) as 301 | 302 | 410 })}
                className="w-full p-2 border border-gray-300 rounded-lg bg-white font-mono"
              >
                <option value={301}>301 Permanent</option>
                <option value={302}>302 Temporary</option>
                <option value={410}>410 Gone</option>
              </select>
            </div>
            <button type="submit" className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg">
              Add Redirect
            </button>
          </form>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 border-b border-gray-200 font-bold text-gray-600">
                <tr>
                  <th className="p-3">Source</th>
                  <th className="p-3">Target</th>
                  <th className="p-3">Code</th>
                  <th className="p-3">Hits</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono text-[11px]">
                {redirects.map(r => (
                  <tr key={r.id}>
                    <td className="p-3 font-bold text-gray-900">{r.sourcePath}</td>
                    <td className="p-3 text-emerald-700">{r.targetPath || '—'}</td>
                    <td className="p-3">{r.statusCode}</td>
                    <td className="p-3 tabular-nums">{r.hits || 0}</td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => handleToggleRedirect(r)}
                        className={`px-2 py-0.5 rounded font-sans font-bold ${
                          r.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {r.active ? 'Active' : 'Paused'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRedirect(r.id)}
                        className="text-rose-600 hover:underline font-sans font-bold"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 9. INTERNAL LINKS */}
      {tab === 'internal-links' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div>
              <h3 className="text-sm font-black text-gray-900">Topic Cluster & Internal Link Suggestions</h3>
              <p className="text-gray-500">Inspect contextual link opportunities between published articles.</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedArticleId}
                onChange={e => loadLinksForArticle(e.target.value)}
                className="p-2 border border-gray-300 rounded-lg bg-white max-w-xs"
              >
                {articles.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.titleEn.slice(0, 60)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => loadLinksForArticle(selectedArticleId)}
                className="px-3.5 py-2 bg-emerald-700 text-white font-bold rounded-lg"
              >
                Analyze
              </button>
              <button
                type="button"
                disabled={aiSeoBusy}
                onClick={handleAiSuggestInternalLinks}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg inline-flex items-center gap-1 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>{aiSeoBusy ? 'Thinking...' : 'AI Suggest Links'}</span>
              </button>
            </div>
          </div>

          <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
            {linkSuggestions.length === 0 ? (
              <div className="p-6 text-center text-gray-500">Select an article and click Analyze to view topic-cluster internal links.</div>
            ) : (
              linkSuggestions.map((s, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-gray-900">{s.targetTitle}</div>
                    <div className="text-emerald-700 font-mono text-[11px]">
                      Anchor: "{s.anchorText}" → {s.targetUrl}
                    </div>
                  </div>
                  <span className="text-[11px] text-gray-500">{s.relevanceReason}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 10. IMAGE SEO */}
      {tab === 'images' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-100 text-xs text-gray-600">
            Audit media assets and article featured images for bilingual alt text and OpenGraph readiness.
          </div>
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 border-b border-gray-200 font-bold text-gray-600">
              <tr>
                <th className="p-3">Asset</th>
                <th className="p-3">Alt Text (EN)</th>
                <th className="p-3">Alt Text (UR)</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {mediaAssets.map(m => {
                const ok = Boolean(m.altTextEn?.trim() && m.altTextUr?.trim());
                return (
                  <tr key={m.id}>
                    <td className="p-3 font-mono text-[11px]">{m.filename}</td>
                    <td className="p-3 text-gray-700">{m.altTextEn || <span className="text-rose-600">Missing</span>}</td>
                    <td className="p-3 font-urdu text-gray-700" dir="rtl">{m.altTextUr || <span className="text-rose-600">موجود نہیں</span>}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                        {ok ? 'Complete' : 'Needs Alt'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 11. STRUCTURED DATA */}
      {tab === 'structured-data' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-gray-900">Schema.org JSON-LD Preview & Validator</h3>
              <p className="text-gray-500">Live structured data emitted into HTML &lt;head&gt; for Google News & rich results.</p>
            </div>
            <select
              value={selectedArticleId}
              onChange={e => loadLinksForArticle(e.target.value)}
              className="p-2 border border-gray-300 rounded-lg bg-white max-w-xs"
            >
              {articles.map(a => (
                <option key={a.id} value={a.id}>{a.titleEn.slice(0, 55)}</option>
              ))}
            </select>
          </div>
          <pre className="p-4 bg-gray-950 text-emerald-300 rounded-xl overflow-x-auto font-mono text-[11px]">
            {JSON.stringify(
              schemaPreview || {
                '@context': 'https://schema.org',
                '@type': 'NewsMediaOrganization',
                name: '360Khabarnama',
                url: 'https://360khabarnama.com',
              },
              null,
              2
            )}
          </pre>
        </div>
      )}

      {/* 12. BILINGUAL HREFLANG */}
      {tab === 'hreflang' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-100 text-xs text-gray-600">
            Verifying symmetrical &lt;link rel="alternate" hreflang="en" / "ur" / "x-default"&gt; pairs across articles and routes.
          </div>
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 border-b border-gray-200 font-bold text-gray-600">
              <tr>
                <th className="p-3">English URL</th>
                <th className="p-3">Urdu URL</th>
                <th className="p-3">Symmetry Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono text-[11px]">
              {articles.slice(0, 20).map(a => {
                const ok = Boolean(a.titleEn?.trim() && a.titleUr?.trim() && a.slug);
                return (
                  <tr key={a.id}>
                    <td className="p-3">/en/news/{a.slug}</td>
                    <td className="p-3">/ur/news/{a.slug}</td>
                    <td className="p-3 font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
                        {ok ? 'Paired EN <-> UR' : 'Missing Translation'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 13. GOOGLE SEARCH CONSOLE (REAL DIAGNOSTICS — ZERO FAKE METRICS) */}
      {tab === 'search-console' && (
        <div className="space-y-5">
          {/* Connection Status & Honest Diagnostics */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-gray-900">Google Search Console Connection</h3>
                  <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold border ${gscStatusColor}`}>
                    {diagStatus}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1">{gscConn?.diagnosticMessage || gscMetrics?.diagnosticMessage}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestGsc}
                  disabled={gscBusy}
                  className="px-3.5 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${gscBusy ? 'animate-spin' : ''}`} />
                  <span>Test Connection</span>
                </button>
                <button
                  type="button"
                  onClick={handleSyncGsc}
                  disabled={gscBusy}
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Sync 28d Metrics</span>
                </button>
                {gscConn?.authMode && gscConn.authMode !== 'none' && (
                  <button
                    type="button"
                    onClick={handleDisconnectGsc}
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg border border-rose-200"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </div>

            {gscConn?.availableProperties?.length > 0 && (
              <div className="text-xs bg-gray-50 p-3 rounded-lg border border-gray-200">
                <span className="font-bold text-gray-700">Verified Properties Detected: </span>
                <span className="font-mono text-emerald-800">{gscConn.availableProperties.join(', ')}</span>
              </div>
            )}
          </div>

          {/* Credentials Setup Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
            {/* Option A: OAuth 2.0 */}
            <form onSubmit={handleSaveGscOAuth} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <h4 className="font-black text-gray-900">Method 1: Google OAuth 2.0 Web Client</h4>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Property URL (e.g. sc-domain:360khabarnama.com or https://360khabarnama.com/)</label>
                <input
                  type="text"
                  required
                  value={gscPropertyUrl}
                  onChange={e => setGscPropertyUrl(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">OAuth Client ID</label>
                <input
                  type="text"
                  required
                  value={oauthClientId}
                  onChange={e => setOauthClientId(e.target.value)}
                  placeholder="123456-abc.apps.googleusercontent.com"
                  className="w-full p-2 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">OAuth Client Secret (encrypted on save)</label>
                <input
                  type="password"
                  value={oauthClientSecret}
                  onChange={e => setOauthClientSecret(e.target.value)}
                  placeholder={gscConn?.hasClientSecret ? '•••••••• (saved)' : 'GOCSPX-...'}
                  className="w-full p-2 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button type="submit" disabled={gscBusy} className="px-4 py-2 bg-gray-900 text-white font-bold rounded-lg">
                  Save OAuth Credentials
                </button>
                <button
                  type="button"
                  onClick={handleStartOAuthConsent}
                  className="px-4 py-2 bg-emerald-700 text-white font-bold rounded-lg"
                >
                  Authorize with Google
                </button>
              </div>
              <div className="pt-2 border-t border-gray-100 flex items-center gap-2">
                <input
                  type="text"
                  value={oauthCodeInput}
                  onChange={e => setOauthCodeInput(e.target.value)}
                  placeholder="Or paste OAuth authorization code manually..."
                  className="flex-1 p-2 border border-gray-300 rounded-lg font-mono"
                />
                <button
                  type="button"
                  disabled={!oauthCodeInput.trim() || gscBusy}
                  onClick={handleExchangeOAuthCode}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 font-bold rounded-lg"
                >
                  Exchange Code
                </button>
              </div>
            </form>

            {/* Option B: Service Account JSON */}
            <form onSubmit={handleSaveServiceAccount} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <h4 className="font-black text-gray-900">Method 2: Google Service Account JSON</h4>
              <p className="text-gray-500">
                Upload or paste your GCP Service Account JSON key (with <code>webmasters.readonly</code> access added in Search Console Users &amp; Permissions).
              </p>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Property URL</label>
                <input
                  type="text"
                  required
                  value={gscPropertyUrl}
                  onChange={e => setGscPropertyUrl(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Service Account JSON {gscConn?.serviceAccountEmail ? `(Saved: ${gscConn.serviceAccountEmail})` : ''}
                </label>
                <textarea
                  rows={5}
                  required
                  value={saJsonInput}
                  onChange={e => setSaJsonInput(e.target.value)}
                  placeholder='{"type": "service_account", "client_email": "...", "private_key": "..."}'
                  className="w-full p-2 border border-gray-300 rounded-lg font-mono text-[11px]"
                />
              </div>
              <button type="submit" disabled={gscBusy} className="px-4 py-2 bg-emerald-700 text-white font-bold rounded-lg">
                Save Encrypted Service Account
              </button>
            </form>
          </div>

          {/* Real Search Analytics Metrics — Only displayed when actually synced */}
          {gscMetrics?.connected ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="text-[11px] font-bold text-gray-500 uppercase">Impressions (28d)</div>
                  <div className="text-2xl font-black font-mono tabular-nums mt-1">{gscMetrics.impressions.toLocaleString()}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="text-[11px] font-bold text-gray-500 uppercase">Organic Clicks</div>
                  <div className="text-2xl font-black text-emerald-700 font-mono tabular-nums mt-1">{gscMetrics.clicks.toLocaleString()}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="text-[11px] font-bold text-gray-500 uppercase">Average CTR</div>
                  <div className="text-2xl font-black font-mono tabular-nums mt-1">{gscMetrics.ctr}%</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="text-[11px] font-bold text-gray-500 uppercase">Avg Position</div>
                  <div className="text-2xl font-black font-mono tabular-nums mt-1">{gscMetrics.averagePosition}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="p-3 bg-gray-50 border-b border-gray-200 text-xs font-black">Top Queries</div>
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b text-gray-500">
                        <th className="p-2.5">Query</th>
                        <th className="p-2.5 text-right">Clicks</th>
                        <th className="p-2.5 text-right">Impr</th>
                        <th className="p-2.5 text-right">Pos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-mono tabular-nums">
                      {gscMetrics.topQueries.map((q, i) => (
                        <tr key={i}>
                          <td className="p-2.5 font-sans font-semibold text-gray-900">{q.query}</td>
                          <td className="p-2.5 text-right">{q.clicks}</td>
                          <td className="p-2.5 text-right">{q.impressions}</td>
                          <td className="p-2.5 text-right">{q.position}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="p-3 bg-gray-50 border-b border-gray-200 text-xs font-black">Top Pages</div>
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b text-gray-500">
                        <th className="p-2.5">Page URL</th>
                        <th className="p-2.5 text-right">Clicks</th>
                        <th className="p-2.5 text-right">CTR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-mono tabular-nums">
                      {gscMetrics.topPages.map((p, i) => (
                        <tr key={i}>
                          <td className="p-2.5 text-emerald-800 truncate max-w-[260px]">{p.path}</td>
                          <td className="p-2.5 text-right">{p.clicks}</td>
                          <td className="p-2.5 text-right">{p.ctr}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-8 text-center text-xs text-gray-600">
              No Search Console analytics data loaded. Once connected and authorized via OAuth 2.0 or Service Account above, real search impressions, clicks, queries, and landing pages will appear here.
            </div>
          )}
        </div>
      )}

      {/* EDIT SEO PAGE MODAL */}
      {editingPage && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveSeoPage} className="bg-white border border-gray-200 rounded-2xl max-w-2xl w-full p-6 space-y-4 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-black text-gray-900">Edit Page SEO Metadata ({editingPage.path})</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={aiSeoBusy}
                  onClick={handleAiSuggestPageMeta}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-lg inline-flex items-center gap-1 disabled:opacity-50"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>{aiSeoBusy ? 'Generating...' : 'AI Suggest Title & Meta'}</span>
                </button>
                <button type="button" onClick={() => setEditingPage(null)} className="text-gray-400 hover:text-gray-700">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Route Path</label>
                <input
                  type="text"
                  required
                  value={editingPage.path}
                  onChange={e => setEditingPage({ ...editingPage, path: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Schema.org Type</label>
                <input
                  type="text"
                  value={editingPage.schemaType}
                  onChange={e => setEditingPage({ ...editingPage, schemaType: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Meta Title (English)</label>
                <input
                  type="text"
                  required
                  value={editingPage.titleEn}
                  onChange={e => setEditingPage({ ...editingPage, titleEn: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Meta Title (Urdu)</label>
                <input
                  type="text"
                  dir="rtl"
                  required
                  value={editingPage.titleUr}
                  onChange={e => setEditingPage({ ...editingPage, titleUr: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg font-urdu"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Meta Description (English)</label>
                <textarea
                  rows={3}
                  value={editingPage.metaDescEn}
                  onChange={e => setEditingPage({ ...editingPage, metaDescEn: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Meta Description (Urdu)</label>
                <textarea
                  rows={3}
                  dir="rtl"
                  value={editingPage.metaDescUr}
                  onChange={e => setEditingPage({ ...editingPage, metaDescUr: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg font-urdu"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Canonical URL</label>
                <input
                  type="url"
                  value={editingPage.canonicalUrl}
                  onChange={e => setEditingPage({ ...editingPage, canonicalUrl: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Robots Directives</label>
                <input
                  type="text"
                  value={editingPage.robotsDirectives}
                  onChange={e => setEditingPage({ ...editingPage, robotsDirectives: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-gray-700 mb-1">OpenGraph Image URL</label>
                <input
                  type="url"
                  value={editingPage.ogImage}
                  onChange={e => setEditingPage({ ...editingPage, ogImage: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Focus Keywords</label>
                <input
                  type="text"
                  value={editingPage.focusKeyword}
                  onChange={e => setEditingPage({ ...editingPage, focusKeyword: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button type="button" onClick={() => setEditingPage(null)} className="px-4 py-2 bg-gray-100 rounded-lg font-bold">
                Cancel
              </button>
              <button type="submit" className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold">
                Save Metadata
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
