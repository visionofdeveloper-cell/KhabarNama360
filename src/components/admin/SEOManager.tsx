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
import { GoogleIntegrationsManager } from './google/GoogleIntegrationsManager.tsx';

type SeoSubTab =
  | 'overview'
  | 'google-integrations'
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

  // Search Console real summary state (for Overview card)
  const [gscConn, setGscConn] = useState<any>(null);
  const [gscMetrics, setGscMetrics] = useState<SearchConsoleMetrics | null>(null);

  // Internal Links & Schema tester
  const [selectedArticleId, setSelectedArticleId] = useState<string>(articles[0]?.id || '');
  const [linkSuggestions, setLinkSuggestions] = useState<any[]>([]);
  const [schemaPreview, setSchemaPreview] = useState<any>(null);
  const [aiSeoBusy, setAiSeoBusy] = useState(false);
  const [indexNowUrls, setIndexNowUrls] = useState('');
  const [indexNowKeyOverride, setIndexNowKeyOverride] = useState('');
  const [indexNowBusy, setIndexNowBusy] = useState(false);
  const [indexNowResult, setIndexNowResult] = useState<any>(null);

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

  const handleSubmitIndexNow = async () => {
    setIndexNowBusy(true);
    setIndexNowResult(null);
    try {
      const urls = indexNowUrls
        .split(/[\n,]/)
        .map(s => s.trim())
        .filter(Boolean);
      const d = await safeFetchJson('/api/admin/seo/indexnow/submit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: urls.length > 0 ? urls : undefined,
          key: indexNowKeyOverride.trim() || undefined,
        }),
      });
      setIndexNowResult(d);
      setBanner({
        ok: Boolean(d.success),
        msg: d.message || d.error || (d.success ? 'IndexNow ping sent.' : 'IndexNow submission error.'),
      });
    } finally {
      setIndexNowBusy(false);
    }
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
    { id: 'google-integrations', label: 'Google Integrations' },
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

      {/* 1B. CENTRALIZED GOOGLE INTEGRATIONS (GA4 + GTM + SEARCH CONSOLE) */}
      {tab === 'google-integrations' && (
        <GoogleIntegrationsManager
          initialSubTab="ga4"
          onRefreshParent={() => {
            void loadSeoState();
            onRefreshParent?.();
          }}
        />
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

      {/* 6. SITEMAPS & INDEXNOW DISCOVERY */}
      {tab === 'sitemaps' && sitemapConfig && (
        <div className="space-y-4">
          <form onSubmit={handleSaveSitemapConfig} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-sm font-black text-gray-900">XML Sitemaps, RSS Feeds &amp; Discovery Endpoints</h3>
                <p className="text-gray-500">Live public discovery files synchronized with published English &amp; Urdu content</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { path: '/sitemap-index.xml', label: 'Sitemap Index' },
                  { path: '/sitemap.xml', label: 'Main Sitemap' },
                  { path: '/news-sitemap.xml', label: 'News Sitemap' },
                  { path: '/image-sitemap.xml', label: 'Image Sitemap' },
                  { path: '/video-sitemap.xml', label: 'Video Sitemap' },
                  { path: '/en/feed.xml', label: 'RSS (EN)' },
                  { path: '/ur/feed.xml', label: 'RSS (UR)' },
                  { path: '/robots.txt', label: 'robots.txt' },
                  { path: '/ads.txt', label: 'ads.txt' },
                  { path: '/llms.txt', label: 'llms.txt' },
                ].map(item => (
                  <a
                    key={item.path}
                    href={item.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1.5 bg-gray-100 hover:bg-emerald-50 hover:text-emerald-800 text-gray-800 font-bold rounded-lg inline-flex items-center gap-1 font-mono text-[11px]"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>{item.label}</span>
                  </a>
                ))}
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

          {/* IndexNow Submission Panel */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-gray-900">IndexNow Protocol (Bing / Yandex Notification)</h3>
                <p className="text-gray-500">
                  Configure your IndexNow key in Global Settings → Integrations (served automatically at <code>/&lt;key&gt;.txt</code>). Submit updated URLs below (IndexNow notifies engines of updates; it does not guarantee indexing).
                </p>
              </div>
              <button
                type="button"
                disabled={indexNowBusy}
                onClick={handleSubmitIndexNow}
                className="px-4 py-2 bg-slate-900 hover:bg-black disabled:opacity-50 text-white font-bold rounded-lg"
              >
                {indexNowBusy ? 'Submitting...' : 'Submit Latest URLs via IndexNow'}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block font-bold text-gray-700 mb-1">Optional Custom URLs (one per line, blank = latest 10 published)</label>
                <textarea
                  rows={2}
                  value={indexNowUrls}
                  onChange={e => setIndexNowUrls(e.target.value)}
                  placeholder="/en/news/sample-story"
                  className="w-full p-2 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Key Override (optional)</label>
                <input
                  type="text"
                  value={indexNowKeyOverride}
                  onChange={e => setIndexNowKeyOverride(e.target.value)}
                  placeholder="Uses SiteSettings.indexNowKey"
                  className="w-full p-2 border border-gray-300 rounded-lg font-mono"
                />
              </div>
            </div>
            {indexNowResult && (
              <div className={`p-3 rounded-lg border font-mono text-[11px] ${indexNowResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
                Status: {indexNowResult.statusCode || '—'} • {indexNowResult.message}
              </div>
            )}
          </div>
        </div>
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

      {/* 13. GOOGLE SEARCH CONSOLE (DELEGATED TO CENTRALIZED HUB) */}
      {tab === 'search-console' && (
        <GoogleIntegrationsManager
          initialSubTab="gsc"
          onRefreshParent={() => {
            void loadSeoState();
            onRefreshParent?.();
          }}
        />
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
