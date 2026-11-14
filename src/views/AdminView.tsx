/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Enterprise Private Admin OS Workspace
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Article,
  SiteSettings,
  AuditLog,
  AdminUser,
  MediaAsset,
  AdPlacement,
  AdCampaign,
  NewsletterSubscriber,
  AudienceNotification,
  SystemHealthReport,
  CategoryPageConfig,
  AIProviderCredential,
  EditorialDraftRecord,
  AdminPermission,
  UserRole,
} from '../types/index.ts';
import { AdminLayout } from '../components/admin/AdminLayout.tsx';
import { AdminModuleId, ADMIN_NAV_ITEMS } from '../components/admin/AdminSidebar.tsx';
import { AdminSessionInfo } from '../components/admin/AdminHeader.tsx';
import { AutomationManager } from '../components/admin/AutomationManager.tsx';
import { APIKeyManager } from '../components/admin/APIKeyManager.tsx';
import { SEOManager } from '../components/admin/SEOManager.tsx';
import { HomepageLayoutBuilder } from '../components/admin/HomepageLayoutBuilder.tsx';
import { GlobalSettings } from '../components/admin/GlobalSettings.tsx';
import { CategoryPageManager } from '../components/admin/CategoryPageManager.tsx';
import {
  Plus,
  Edit3,
  Trash2,
  Sparkles,
  Save,
  FileText,
  Activity,
  CheckCircle2,
  AlertCircle,
  Zap,
  ArrowUpRight,
  X,
  Search,
  Users,
  Send,
  RotateCcw,
  Download,
  KeyRound,
  Square,
  RefreshCw,
} from 'lucide-react';

interface AdminViewProps {
  session: AdminSessionInfo;
  onLogout: () => void;
}

const OFFICIAL_ROLES: UserRole[] = [
  'Super Admin',
  'Administrator',
  'Managing Editor',
  'Editor',
  'SEO Manager',
  'Automation Manager',
  'Advertising Manager',
  'Content Contributor',
  'Read-only Analyst',
];

const STUDIO_TEMPLATES = [
  { id: 'article_draft', label: 'Full Bilingual Article Draft' },
  { id: 'story_outline', label: 'Structured Story Outline' },
  { id: 'translate_en_ur', label: 'Translate English -> Urdu' },
  { id: 'translate_ur_en', label: 'Translate Urdu -> English' },
  { id: 'summarize', label: 'Bilingual Executive Summary' },
  { id: 'headlines', label: 'Headline Variants (EN/UR)' },
  { id: 'seo_meta', label: 'SEO Meta, Focus Keyword & Slug' },
  { id: 'classify_tags', label: 'Category & Tag Classifier' },
  { id: 'rewrite_tone', label: 'Journalistic Rewrite & Polish' },
  { id: 'newsletter', label: 'Morning Briefing Newsletter' },
  { id: 'fact_check', label: 'Fact-Check & Objectivity Audit' },
  { id: 'related_ideas', label: 'Follow-Up & Related Story Ideas' },
];

export const AdminView: React.FC<AdminViewProps> = ({ session, onLogout }) => {
  const hasPermission = (perm: AdminPermission) =>
    session.role === 'Super Admin' || (session.permissions || []).includes(perm);

  const firstAllowedModule =
    ADMIN_NAV_ITEMS.find(item => hasPermission(item.permission))?.id || 'overview';

  const [activeModule, setActiveModule] = useState<AdminModuleId>(firstAllowedModule);
  const [globalSearch, setGlobalSearch] = useState('');

  // Core Data States
  const [analytics, setAnalytics] = useState<any>({});
  const [articles, setArticles] = useState<Article[]>([]);
  const [articleFilterStatus, setArticleFilterStatus] = useState<string>('all');
  const [articleSearchQuery, setArticleSearchQuery] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryPages, setCategoryPages] = useState<CategoryPageConfig[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);

  // Advertising States
  const [adPlacements, setAdPlacements] = useState<AdPlacement[]>([]);
  const [adCampaigns, setAdCampaigns] = useState<AdCampaign[]>([]);
  const [activeAdTab, setActiveAdTab] = useState<'campaigns' | 'placements'>('campaigns');
  const [newCampaignModal, setNewCampaignModal] = useState(false);
  const [newCampaign, setNewCampaign] = useState<Partial<AdCampaign>>({
    campaignName: '',
    advertiserName: '',
    budgetPkr: 250000,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    bannerUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=970&q=80',
    destinationUrl: 'https://',
    placementSlotIds: ['slot-1'],
    status: 'active',
  });

  // Media Library States
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [newMediaModal, setNewMediaModal] = useState(false);
  const [newMedia, setNewMedia] = useState<Partial<MediaAsset>>({
    filename: '',
    url: '',
    category: 'general',
    captionEn: '',
    captionUr: '',
    altTextEn: '',
    altTextUr: '',
  });

  // Users & RBAC
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [newUserModal, setNewUserModal] = useState(false);
  const [newUser, setNewUser] = useState<Partial<AdminUser> & { password?: string }>({
    nameEn: '',
    nameUr: '',
    email: '',
    role: 'Editor',
    status: 'active',
    password: '',
  });
  const [passwordModalUser, setPasswordModalUser] = useState<AdminUser | null>(null);
  const [staffNewPassword, setStaffNewPassword] = useState('');

  // Audience & Broadcasts
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [notificationsList, setNotificationsList] = useState<AudienceNotification[]>([]);
  const [newNotification, setNewNotification] = useState<Partial<AudienceNotification>>({
    titleEn: '',
    titleUr: '',
    bodyEn: '',
    bodyUr: '',
    targetLanguage: 'both',
    targetUrl: 'https://360khabarnama.com',
  });

  // System Health & Reports
  const [systemHealth, setSystemHealth] = useState<SystemHealthReport | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string>('editorial-activity');
  const [reportData, setReportData] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // AI Content Studio States
  const [aiProviders, setAiProviders] = useState<AIProviderCredential[]>([]);
  const [studioTemplate, setStudioTemplate] = useState<string>('article_draft');
  const [studioCredentialId, setStudioCredentialId] = useState<string>('');
  const [studioTopic, setStudioTopic] = useState('');
  const [studioInputText, setStudioInputText] = useState('');
  const [studioCategory, setStudioCategory] = useState('pakistan');
  const [studioTone, setStudioTone] = useState('Objective, formal journalistic');
  const [studioLoading, setStudioLoading] = useState(false);
  const [studioResult, setStudioResult] = useState<any>(null);
  const [studioTelemetry, setStudioTelemetry] = useState<any>(null);
  const [savedDrafts, setSavedDrafts] = useState<EditorialDraftRecord[]>([]);
  const studioAbortRef = useRef<AbortController | null>(null);

  // News Composer States
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [manualSlugEdited, setManualSlugEdited] = useState(false);
  const [composerLang, setComposerLang] = useState<'ur' | 'en'>('ur');
  const [aiBusy, setAiBusy] = useState(false);
  const [headlineChoices, setHeadlineChoices] = useState<{
    headlinesEn?: string[];
    headlinesUr?: string[];
  } | null>(null);
  const [translationPreview, setTranslationPreview] = useState<{
    targetLang: 'en' | 'ur';
    translatedTitle?: string;
    translatedSummary?: string;
    translatedBody: string;
  } | null>(null);
  const [formData, setFormData] = useState<Partial<Article>>({
    slug: '',
    titleEn: '',
    titleUr: '',
    summaryEn: '',
    summaryUr: '',
    contentEn: '',
    contentUr: '',
    category: 'pakistan',
    tags: ['Pakistan', 'News'],
    status: 'published',
    isBreaking: false,
    isFeatured: false,
    isTrending: false,
    readingTimeMin: 3,
    heroImage: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=1200&q=80',
    imageCaptionEn: 'Editorial reporting.',
    imageCaptionUr: 'خصوصی رپورٹنگ۔',
    author: {
      id: 'admin-1',
      nameEn: session.nameEn || 'Editorial Staff',
      nameUr: 'اداریہ 360 خبرنامہ',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      role: session.role || 'Editor',
    },
  });
  const [showVersionsModal, setShowVersionsModal] = useState(false);
  const [activeArticleVersions, setActiveArticleVersions] = useState<any[]>([]);

  // Inline confirm dialog (replaces window.confirm cleanly)
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  // Toast feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const notify = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 6500);
  };

  const slugify = (val: string) =>
    (val || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

  const loadCoreData = async () => {
    try {
      const [anRes, artRes, setRes, logRes, catRes] = await Promise.all([
        fetch('/api/admin/analytics', { credentials: 'include' }).then(r => r.json()),
        fetch('/api/news?status=all', { credentials: 'include' }).then(r => r.json()),
        fetch('/api/settings', { credentials: 'include' }).then(r => r.json()),
        fetch('/api/admin/audit-logs', { credentials: 'include' }).then(r => r.json()),
        fetch('/api/categories/public', { credentials: 'include' }).then(r => r.json()),
      ]);

      if (anRes.success) setAnalytics(anRes);
      if (artRes.success) setArticles(artRes.articles || []);
      if (setRes.success) {
        setSettings(setRes.settings);
        setCategories(setRes.categories || []);
      }
      if (logRes.success) setLogs(logRes.logs || []);
      if (catRes.success) setCategoryPages(catRes.categories || []);
    } catch {
      // ignore initial non-blocking error
    }
  };

  const loadModuleData = async (mod: AdminModuleId) => {
    try {
      if (mod === 'ads') {
        const [plRes, cRes] = await Promise.all([
          fetch('/api/admin/ads/placements', { credentials: 'include' }).then(r => r.json()),
          fetch('/api/admin/ads/campaigns', { credentials: 'include' }).then(r => r.json()),
        ]);
        if (plRes.success) setAdPlacements(plRes.placements || []);
        if (cRes.success) setAdCampaigns(cRes.campaigns || []);
      } else if (mod === 'media' || mod === 'seo') {
        const res = await fetch('/api/admin/media', { credentials: 'include' }).then(r => r.json());
        if (res.success) setMediaAssets(res.assets || []);
      } else if (mod === 'users') {
        const res = await fetch('/api/admin/users', { credentials: 'include' }).then(r => r.json());
        if (res.success) setAdminUsers(res.users || []);
      } else if (mod === 'audience') {
        const [sRes, nRes] = await Promise.all([
          fetch('/api/admin/audience/subscribers', { credentials: 'include' }).then(r => r.json()),
          fetch('/api/admin/audience/notifications', { credentials: 'include' }).then(r => r.json()),
        ]);
        if (sRes.success) setSubscribers(sRes.subscribers || []);
        if (nRes.success) setNotificationsList(nRes.notifications || []);
      } else if (mod === 'ai-studio') {
        const [pRes, dRes] = await Promise.all([
          fetch('/api/admin/ai/providers', { credentials: 'include' }).then(r => r.json()),
          fetch('/api/admin/ai/editorial-drafts', { credentials: 'include' }).then(r => r.json()),
        ]);
        if (pRes.success) setAiProviders(pRes.providers || []);
        if (dRes.success) setSavedDrafts(dRes.drafts || []);
      } else if (mod === 'health') {
        const res = await fetch('/api/admin/system/health', { credentials: 'include' }).then(r => r.json());
        if (res.success) setSystemHealth(res.health);
      } else if (mod === 'reports') {
        loadReport(selectedReportId);
      }
    } catch {
      // handled per tab
    }
  };

  const loadReport = async (reportId: string) => {
    setReportLoading(true);
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, { credentials: 'include' }).then(r => r.json());
      if (res.success) setReportData(res);
      else notify(res.error || 'Could not load report', 'error');
    } catch {
      notify('Failed to load report', 'error');
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    loadCoreData();
  }, []);

  useEffect(() => {
    loadModuleData(activeModule);
  }, [activeModule]);

  // Article Actions
  const resetComposer = () => {
    setEditingArticleId(null);
    setManualSlugEdited(false);
    setFormData({
      slug: '',
      titleEn: '',
      titleUr: '',
      summaryEn: '',
      summaryUr: '',
      contentEn: '',
      contentUr: '',
      category: 'pakistan',
      tags: ['Pakistan', 'News'],
      status: 'published',
      isBreaking: false,
      isFeatured: false,
      isTrending: false,
      readingTimeMin: 3,
      heroImage: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=1200&q=80',
      imageCaptionEn: 'Editorial reporting.',
      imageCaptionUr: 'خصوصی رپورٹنگ۔',
      author: {
        id: 'admin-1',
        nameEn: session.nameEn || 'Editorial Staff',
        nameUr: 'اداریہ 360 خبرنامہ',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        role: session.role || 'Editor',
      },
    });
  };

  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titleEn || !formData.titleUr) {
      notify('Please provide both English and Urdu headlines', 'error');
      return;
    }

    const finalSlug = (formData.slug || '').trim() || slugify(formData.titleEn || 'news-article');
    const payload = {
      ...formData,
      id: editingArticleId || `art-${Date.now()}`,
      slug: finalSlug,
    };

    try {
      const res = await fetch('/api/news', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify(editingArticleId ? 'Article updated successfully!' : 'Article saved successfully!');
        resetComposer();
        setActiveModule('articles');
        loadCoreData();
      } else {
        notify(data.error || 'Failed to save article', 'error');
      }
    } catch {
      notify('Network error saving article', 'error');
    }
  };

  const handleUpdateWorkflowStatus = async (articleId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/news/${articleId}/workflow`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify(`Article moved to "${newStatus}"`);
        loadCoreData();
      } else {
        notify(data.error || 'Workflow update rejected', 'error');
      }
    } catch {
      notify('Failed to update workflow status', 'error');
    }
  };

  const handleOpenVersions = async (article: Article) => {
    try {
      const res = await fetch(`/api/news/${article.id}/versions`, { credentials: 'include' }).then(r => r.json());
      if (res.success) {
        setActiveArticleVersions(res.versions || []);
        setEditingArticleId(article.id);
        setShowVersionsModal(true);
      }
    } catch {
      notify('Could not load version history', 'error');
    }
  };

  const handleRollbackVersion = async (versionId: string) => {
    if (!editingArticleId) return;
    try {
      const res = await fetch(`/api/news/${editingArticleId}/rollback`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify('Article restored to selected snapshot!');
        setShowVersionsModal(false);
        setFormData(data.article);
        loadCoreData();
      } else {
        notify(data.error || 'Rollback failed', 'error');
      }
    } catch {
      notify('Rollback failed', 'error');
    }
  };

  const handleDeleteArticle = (id: string) => {
    setConfirmState({
      title: 'Delete News Article',
      message: 'This article will be permanently removed from the CMS and sitemap.',
      onConfirm: async () => {
        const res = await fetch(`/api/news/${id}`, { method: 'DELETE', credentials: 'include' });
        const d = await res.json();
        if (res.ok && d.success) {
          notify('Article deleted.');
          loadCoreData();
        } else {
          notify(d.error || 'Deletion rejected', 'error');
        }
      },
    });
  };

  // Composer AI Tools
  const handleSuggestHeadlines = async () => {
    setAiBusy(true);
    try {
      const res = await fetch('/api/admin/ai/suggest-headline', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: formData.category,
          summary: (composerLang === 'ur' ? formData.summaryUr : formData.summaryEn) || formData.titleEn || formData.titleUr,
          language: composerLang,
        }),
      });
      const d = await res.json();
      if (res.ok && d.success) {
        setHeadlineChoices({ headlinesEn: d.headlinesEn || [], headlinesUr: d.headlinesUr || [] });
      } else {
        notify(d.error || 'AI provider unavailable. Configure keys in AI Keys & Routing.', 'error');
      }
    } catch {
      notify('Network error contacting AI router.', 'error');
    } finally {
      setAiBusy(false);
    }
  };

  const handleTranslateComposer = async () => {
    const sourceText = composerLang === 'en' ? formData.contentEn : formData.contentUr;
    const sourceTitle = composerLang === 'en' ? formData.titleEn : formData.titleUr;
    const sourceSummary = composerLang === 'en' ? formData.summaryEn : formData.summaryUr;
    const target = composerLang === 'en' ? 'ur' : 'en';

    if (!sourceText && !sourceTitle) {
      notify('Enter headline or article body before translating.', 'error');
      return;
    }
    setAiBusy(true);
    try {
      const res = await fetch('/api/admin/ai/translate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: sourceTitle,
          summary: sourceSummary,
          text: sourceText || sourceTitle,
          targetLanguage: target,
        }),
      });
      const d = await res.json();
      if (res.ok && d.success) {
        setTranslationPreview({
          targetLang: target,
          translatedTitle: d.translatedTitle,
          translatedSummary: d.translatedSummary,
          translatedBody: d.translation || '',
        });
      } else {
        notify(d.error || 'AI translation failed or unconfigured.', 'error');
      }
    } catch {
      notify('Network error during translation.', 'error');
    } finally {
      setAiBusy(false);
    }
  };

  const handleGenerateSeoTags = async () => {
    const title = formData.titleEn || formData.titleUr;
    const content = formData.contentEn || formData.contentUr;
    if (!title && !content) {
      notify('Provide headline or body first to extract SEO metadata.', 'error');
      return;
    }
    setAiBusy(true);
    try {
      const res = await fetch('/api/admin/ai/seo-tags', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });
      const d = await res.json();
      if (res.ok && d.success && d.seo) {
        setFormData(prev => ({
          ...prev,
          tags: Array.isArray(d.seo.tags) ? d.seo.tags : prev.tags,
          slug: !manualSlugEdited && !editingArticleId && d.seo.slugSuggestion ? d.seo.slugSuggestion : prev.slug,
          seo: {
            ...(prev.seo || {}),
            metaTitleEn: d.seo.metaTitleEn || prev.seo?.metaTitleEn,
            metaDescriptionEn: d.seo.metaDescription || prev.seo?.metaDescriptionEn,
            focusKeywords: Array.isArray(d.seo.tags) ? d.seo.tags : prev.seo?.focusKeywords,
          },
        }));
        notify(`Applied ${d.seo.tags?.length || 0} SEO tags & meta description.`);
      } else {
        notify(d.error || 'SEO tag extraction failed.', 'error');
      }
    } catch {
      notify('Failed reaching AI SEO service.', 'error');
    } finally {
      setAiBusy(false);
    }
  };

  // AI Content Studio execution
  const handleRunStudioTask = async () => {
    if (!studioTopic.trim() && !studioInputText.trim()) {
      notify('Enter a topic or source text to run the AI task.', 'error');
      return;
    }
    studioAbortRef.current?.abort();
    const ctrl = new AbortController();
    studioAbortRef.current = ctrl;
    setStudioLoading(true);
    setStudioResult(null);
    setStudioTelemetry(null);

    try {
      const res = await fetch('/api/admin/ai/editorial-studio', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          template: studioTemplate,
          topic: studioTopic,
          inputText: studioInputText,
          category: studioCategory,
          tone: studioTone,
          credentialId: studioCredentialId || undefined,
        }),
      });
      const d = await res.json();
      if (res.ok && d.success) {
        setStudioResult(d.result);
        setStudioTelemetry(d.telemetry || null);
        notify('AI task completed successfully.');
      } else {
        notify(d.error || 'AI provider returned an error.', 'error');
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        notify('AI generation cancelled.', 'error');
      } else {
        notify('Failed running AI studio task.', 'error');
      }
    } finally {
      setStudioLoading(false);
      studioAbortRef.current = null;
    }
  };

  const handleSaveStudioDraft = async () => {
    if (!studioResult) return;
    const payload = {
      template: studioTemplate,
      titleEn: studioResult.titleEn || studioResult.headlinesEn?.[0] || studioTopic || 'Untitled Draft',
      titleUr: studioResult.titleUr || studioResult.headlinesUr?.[0] || '',
      contentEn: studioResult.contentEn || studioResult.bodyEn || JSON.stringify(studioResult, null, 2),
      contentUr: studioResult.contentUr || studioResult.bodyUr || '',
      summaryEn: studioResult.summaryEn || '',
      summaryUr: studioResult.summaryUr || '',
      providerType: studioTelemetry?.providerType,
      model: studioTelemetry?.model,
      totalTokens: studioTelemetry?.totalTokens,
    };
    const res = await fetch('/api/admin/ai/editorial-drafts', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await res.json();
    if (res.ok && d.success) {
      notify('Saved output to Editorial Studio Drafts.');
      loadModuleData('ai-studio');
    } else {
      notify(d.error || 'Could not save draft.', 'error');
    }
  };

  const handleSendStudioToComposer = (resObj: any) => {
    setFormData(prev => ({
      ...prev,
      titleEn: resObj.titleEn || resObj.headlinesEn?.[0] || prev.titleEn || studioTopic,
      titleUr: resObj.titleUr || resObj.headlinesUr?.[0] || prev.titleUr || '',
      summaryEn: resObj.summaryEn || prev.summaryEn || '',
      summaryUr: resObj.summaryUr || prev.summaryUr || '',
      contentEn: resObj.contentEn || resObj.bodyEn || prev.contentEn || '',
      contentUr: resObj.contentUr || resObj.bodyUr || prev.contentUr || '',
      category: studioCategory || prev.category,
      tags: Array.isArray(resObj.tags) ? resObj.tags : prev.tags,
      status: 'in_review',
    }));
    setEditingArticleId(null);
    setActiveModule('composer');
    notify('Transferred AI output to Bilingual News Composer (In Review).');
  };

  // Advertising, Media, Audience, Staff handlers
  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/ads/campaigns', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCampaign),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      notify('Campaign created!');
      setNewCampaignModal(false);
      loadModuleData('ads');
    } else {
      notify(data.error || 'Failed to create campaign', 'error');
    }
  };

  const handleDeleteCampaign = (id: string) => {
    setConfirmState({
      title: 'Delete Advertising Campaign',
      message: 'Remove this direct campaign from active ad rotation?',
      onConfirm: async () => {
        const res = await fetch(`/api/admin/ads/campaigns/${id}`, { method: 'DELETE', credentials: 'include' });
        const d = await res.json();
        if (res.ok && d.success) {
          notify('Campaign removed.');
          loadModuleData('ads');
        }
      },
    });
  };

  const handleTogglePlacement = async (slot: AdPlacement) => {
    const res = await fetch(`/api/admin/ads/placements/${slot.id}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !slot.enabled }),
    });
    const d = await res.json();
    if (res.ok && d.success) {
      notify(`Slot "${slot.name}" ${!slot.enabled ? 'Enabled' : 'Disabled'}`);
      loadModuleData('ads');
    }
  };

  const handleAddMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/media', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMedia),
    });
    const d = await res.json();
    if (res.ok && d.success) {
      notify('Media asset added!');
      setNewMediaModal(false);
      loadModuleData('media');
    } else {
      notify(d.error || 'Failed saving media asset', 'error');
    }
  };

  const handleDeleteMedia = (id: string) => {
    setConfirmState({
      title: 'Delete Media Asset',
      message: 'Remove this asset from the editorial media library?',
      onConfirm: async () => {
        const res = await fetch(`/api/admin/media/${id}`, { method: 'DELETE', credentials: 'include' });
        const d = await res.json();
        if (res.ok && d.success) {
          notify('Asset deleted.');
          loadModuleData('media');
        }
      },
    });
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/audience/notifications', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newNotification),
    });
    const d = await res.json();
    if (res.ok && d.success) {
      notify(`Broadcast sent to ${d.notification?.recipientsCount || 'active'} subscribers.`);
      setNewNotification({
        titleEn: '',
        titleUr: '',
        bodyEn: '',
        bodyUr: '',
        targetLanguage: 'both',
        targetUrl: 'https://360khabarnama.com',
      });
      loadModuleData('audience');
    } else {
      notify(d.error || 'Broadcast dispatch failed', 'error');
    }
  };

  const handleSetStaffPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalUser) return;
    const res = await fetch('/api/admin/auth/staff-password', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: passwordModalUser.email, newPassword: staffNewPassword }),
    });
    const d = await res.json();
    if (res.ok && d.success) {
      notify(`Local credential updated for ${passwordModalUser.email}`);
      setPasswordModalUser(null);
      setStaffNewPassword('');
    } else {
      notify(d.error || 'Failed updating staff password', 'error');
    }
  };

  const searchLower = (globalSearch || articleSearchQuery).toLowerCase();
  const filteredArticles = articles.filter(a => {
    const matchStatus = articleFilterStatus === 'all' || a.status === articleFilterStatus;
    const matchQuery =
      !searchLower ||
      a.titleEn.toLowerCase().includes(searchLower) ||
      a.titleUr.includes(searchLower) ||
      a.category.toLowerCase().includes(searchLower);
    return matchStatus && matchQuery;
  });

  const headerNotifications = logs.slice(0, 8).map(l => ({
    id: l.id,
    title: l.action,
    detail: l.details,
    time: new Date(l.timestamp).toLocaleTimeString(),
  }));

  return (
    <AdminLayout
      session={session}
      activeModule={activeModule}
      onSelectModule={setActiveModule}
      globalSearch={globalSearch}
      onGlobalSearchChange={setGlobalSearch}
      notifications={headerNotifications}
      onLogout={onLogout}
    >
      {/* Floating Feedback Toast */}
      {feedback && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 text-xs font-bold border ${
            feedback.type === 'success'
              ? 'bg-emerald-900 text-white border-emerald-700'
              : 'bg-rose-900 text-white border-rose-700'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-300 shrink-0" />
          )}
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} className="ml-1 opacity-75 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* MODULE 1: OVERVIEW */}
      {activeModule === 'overview' && (
        <div className="space-y-6">
          <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold mb-1">
                <Activity className="w-4 h-4" />
                <span>360Khabarnama Editorial & Infrastructure Console</span>
              </div>
              <h1 className="text-2xl font-black">Welcome back, {session.nameEn}</h1>
              <p className="text-xs text-slate-300 mt-1">
                Role: <strong>{session.role}</strong> • Server-enforced RBAC active • Bilingual public portal isolated cleanly from Admin OS.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {hasPermission('articles:write') && (
                <button
                  type="button"
                  onClick={() => {
                    resetComposer();
                    setActiveModule('composer');
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Story</span>
                </button>
              )}
              {hasPermission('ai:keys') && (
                <button
                  type="button"
                  onClick={() => setActiveModule('ai-keys')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold border border-slate-700 inline-flex items-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>AI Vault</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 text-xs">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <span className="text-[11px] font-bold uppercase text-gray-500">Published Articles</span>
              <div className="text-2xl font-black text-gray-900 font-mono mt-1">
                {analytics.publishedCount ?? articles.filter(a => a.status === 'published').length}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <span className="text-[11px] font-bold uppercase text-gray-500">Total Article Views</span>
              <div className="text-2xl font-black text-emerald-700 font-mono mt-1">
                {(analytics.totalViews || 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <span className="text-[11px] font-bold uppercase text-gray-500">Search Console</span>
              <div className="text-lg font-black text-gray-900 mt-1">
                {analytics.seoStats?.searchConsoleStatus || 'Disconnected'}
              </div>
              <div className="text-[10px] text-gray-500">
                Clicks: {(analytics.seoStats?.totalClicks || 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <span className="text-[11px] font-bold uppercase text-gray-500">Subscribers</span>
              <div className="text-2xl font-black text-teal-700 font-mono mt-1">
                {(analytics.totalSubscribers || 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <span className="text-[11px] font-bold uppercase text-gray-500">Categories Live</span>
              <div className="text-2xl font-black text-gray-900 font-mono mt-1">
                {categoryPages.length || categories.length}
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-black text-sm text-gray-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-700" />
                <span>Recent Editorial Output</span>
              </h3>
              <button
                type="button"
                onClick={() => setActiveModule('articles')}
                className="text-xs font-bold text-emerald-700 hover:underline inline-flex items-center gap-1"
              >
                <span>Open Directory ({articles.length})</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              {articles.slice(0, 6).map(art => (
                <div key={art.id} className="py-2.5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase">
                      <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{art.category}</span>
                      <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded">{art.status}</span>
                    </div>
                    <div className="font-bold text-xs text-gray-900 truncate mt-1">{art.titleEn}</div>
                    <div className="text-[11px] font-urdu text-gray-600 truncate" dir="rtl">
                      {art.titleUr}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(art);
                        setEditingArticleId(art.id);
                        setManualSlugEdited(true);
                        setActiveModule('composer');
                      }}
                      className="p-1.5 text-gray-600 hover:text-emerald-700 rounded-lg hover:bg-gray-100"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenVersions(art)}
                      className="p-1.5 text-gray-600 hover:text-blue-700 rounded-lg hover:bg-gray-100"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODULE 2: ARTICLES DIRECTORY */}
      {activeModule === 'articles' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <div>
              <h2 className="text-base font-black text-gray-900">Articles Directory</h2>
              <p className="text-gray-500">Manage bilingual stories, SEO slugs, and revision checkpoints.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                resetComposer();
                setActiveModule('composer');
              }}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Compose Story</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
              {['all', 'published', 'in_review', 'scheduled', 'draft'].map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setArticleFilterStatus(st)}
                  className={`px-3 py-1 rounded-md font-bold uppercase ${
                    articleFilterStatus === st ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={articleSearchQuery}
                onChange={e => setArticleSearchQuery(e.target.value)}
                placeholder="Filter articles..."
                className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-y text-gray-600 font-bold">
                  <th className="p-3">Headline (EN & UR)</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Views</th>
                  <th className="p-3">Revisions</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredArticles.map(art => (
                  <tr key={art.id} className="hover:bg-gray-50">
                    <td className="p-3 max-w-md">
                      <div className="font-bold text-gray-900 line-clamp-1">{art.titleEn}</div>
                      <div className="font-urdu text-gray-600 line-clamp-1" dir="rtl">
                        {art.titleUr}
                      </div>
                      <div className="text-[10px] font-mono text-gray-400">/{art.slug}</div>
                    </td>
                    <td className="p-3 uppercase text-[10px] font-bold">{art.category}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[10px] font-bold uppercase">
                        {art.status}
                      </span>
                    </td>
                    <td className="p-3 font-mono">{art.views?.toLocaleString()}</td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => handleOpenVersions(art)}
                        className="px-2 py-0.5 bg-blue-50 text-blue-700 font-mono rounded font-bold"
                      >
                        v{(art.versions?.length || 0) + 1}
                      </button>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap space-x-1">
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(art);
                          setEditingArticleId(art.id);
                          setManualSlugEdited(true);
                          setActiveModule('composer');
                        }}
                        className="p-1.5 bg-gray-100 hover:bg-emerald-100 text-emerald-800 rounded"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteArticle(art.id)}
                        className="p-1.5 bg-gray-100 hover:bg-rose-100 text-rose-700 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODULE 3: BILINGUAL COMPOSER */}
      {activeModule === 'composer' && (
        <form onSubmit={handleSaveArticle} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
            <div>
              <h2 className="text-lg font-black text-gray-900">
                {editingArticleId ? 'Edit Article & SEO Slugs' : 'Bilingual News Composer'}
              </h2>
              <p className="text-gray-500">Dual English & Urdu editorial workspace routed via encrypted AI Key Vault.</p>
            </div>
            <div className="flex items-center gap-2">
              {editingArticleId && (
                <button
                  type="button"
                  onClick={() => handleOpenVersions({ id: editingArticleId } as Article)}
                  className="px-3 py-1.5 bg-gray-100 rounded-lg font-bold inline-flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Versions</span>
                </button>
              )}
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setComposerLang('ur')}
                  className={`px-3 py-1 rounded font-bold ${
                    composerLang === 'ur' ? 'bg-emerald-700 text-white' : 'text-gray-700'
                  }`}
                >
                  اردو
                </button>
                <button
                  type="button"
                  onClick={() => setComposerLang('en')}
                  className={`px-3 py-1 rounded font-bold ${
                    composerLang === 'en' ? 'bg-emerald-700 text-white' : 'text-gray-700'
                  }`}
                >
                  English
                </button>
              </div>
            </div>
          </div>

          {/* AI Toolbar */}
          <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <span className="font-black text-emerald-950 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-700" />
              <span>AI Editorial Assistant (Vault-Routed)</span>
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={aiBusy}
                onClick={handleSuggestHeadlines}
                className="px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg font-bold disabled:opacity-50"
              >
                {aiBusy ? 'Working...' : 'Suggest Headlines'}
              </button>
              <button
                type="button"
                disabled={aiBusy}
                onClick={handleTranslateComposer}
                className="px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg font-bold disabled:opacity-50"
              >
                Translate to {composerLang === 'en' ? 'Urdu' : 'English'}
              </button>
              <button
                type="button"
                disabled={aiBusy}
                onClick={handleGenerateSeoTags}
                className="px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg font-bold disabled:opacity-50"
              >
                Generate SEO Tags & Meta
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {composerLang === 'ur' ? (
                <>
                  <div>
                    <label className="block font-bold text-gray-800 mb-1">اردو سرخی (Urdu Headline) *</label>
                    <input
                      type="text"
                      dir="rtl"
                      value={formData.titleUr || ''}
                      onChange={e => setFormData({ ...formData, titleUr: e.target.value })}
                      className="w-full p-2.5 border border-gray-300 rounded-lg font-urdu text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-800 mb-1">اردو خلاصہ (Urdu Summary)</label>
                    <textarea
                      rows={2}
                      dir="rtl"
                      value={formData.summaryUr || ''}
                      onChange={e => setFormData({ ...formData, summaryUr: e.target.value })}
                      className="w-full p-2.5 border border-gray-300 rounded-lg font-urdu"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-800 mb-1">اردو تفصیلی متن (Urdu Body)</label>
                    <textarea
                      rows={11}
                      dir="rtl"
                      value={formData.contentUr || ''}
                      onChange={e => setFormData({ ...formData, contentUr: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-lg font-urdu text-sm leading-relaxed"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block font-bold text-gray-800 mb-1">English Headline *</label>
                    <input
                      type="text"
                      value={formData.titleEn || ''}
                      onChange={e => {
                        const val = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          titleEn: val,
                          slug: !manualSlugEdited && !editingArticleId ? slugify(val) : prev.slug,
                        }));
                      }}
                      className="w-full p-2.5 border border-gray-300 rounded-lg text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-800 mb-1">English Summary</label>
                    <textarea
                      rows={2}
                      value={formData.summaryEn || ''}
                      onChange={e => setFormData({ ...formData, summaryEn: e.target.value })}
                      className="w-full p-2.5 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-800 mb-1">English Body Content</label>
                    <textarea
                      rows={11}
                      value={formData.contentEn || ''}
                      onChange={e => setFormData({ ...formData, contentEn: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-lg text-sm leading-relaxed"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div>
                <label className="block font-bold text-gray-700 mb-1">URL Slug</label>
                <input
                  type="text"
                  value={formData.slug || ''}
                  onChange={e => {
                    setManualSlugEdited(true);
                    setFormData({ ...formData, slug: e.target.value });
                  }}
                  placeholder="auto-generated-from-title"
                  className="w-full p-2 bg-white border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full p-2 bg-white border border-gray-300 rounded-lg font-bold"
                >
                  {(categoryPages.length > 0 ? categoryPages : [
                    { slug: 'pakistan', nameEn: 'Pakistan' },
                    { slug: 'politics', nameEn: 'Politics' },
                    { slug: 'business', nameEn: 'Business & Economy' },
                    { slug: 'sports', nameEn: 'Sports & Cricket' },
                    { slug: 'education', nameEn: 'Education' },
                    { slug: 'weather', nameEn: 'Weather' },
                    { slug: 'technology', nameEn: 'Technology' },
                    { slug: 'islamic', nameEn: 'Islamic' },
                    { slug: 'world', nameEn: 'World' },
                  ]).map((c: any) => (
                    <option key={c.slug} value={c.slug}>
                      {c.nameEn}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Workflow Status</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full p-2 bg-white border border-gray-300 rounded-lg font-bold"
                >
                  <option value="published">Published</option>
                  <option value="in_review">In Review</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  value={(formData.tags || []).join(', ')}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      tags: e.target.value
                        .split(',')
                        .map(s => s.trim())
                        .filter(Boolean),
                    })
                  }
                  className="w-full p-2 bg-white border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Hero Image URL</label>
                <input
                  type="text"
                  value={formData.heroImage || ''}
                  onChange={e => setFormData({ ...formData, heroImage: e.target.value })}
                  className="w-full p-2 bg-white border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <label className="flex items-center gap-2 font-bold">
                <input
                  type="checkbox"
                  checked={Boolean(formData.isFeatured)}
                  onChange={e => setFormData({ ...formData, isFeatured: e.target.checked })}
                />
                <span>Featured on Homepage</span>
              </label>
              <label className="flex items-center gap-2 font-bold">
                <input
                  type="checkbox"
                  checked={Boolean(formData.isBreaking)}
                  onChange={e => setFormData({ ...formData, isBreaking: e.target.checked })}
                />
                <span>Breaking News</span>
              </label>
              <div className="pt-3 border-t space-y-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg inline-flex items-center justify-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingArticleId ? 'Save Changes' : 'Save & Publish'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetComposer();
                    setActiveModule('articles');
                  }}
                  className="w-full py-2 bg-gray-200 text-gray-800 font-bold rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* MODULE 4: WORKFLOW BOARD */}
      {activeModule === 'workflow' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          {[
            { status: 'draft', label: 'Drafts', cls: 'bg-gray-100 border-gray-200' },
            { status: 'in_review', label: 'In Review', cls: 'bg-amber-50 border-amber-200' },
            { status: 'scheduled', label: 'Scheduled', cls: 'bg-blue-50 border-blue-200' },
            { status: 'published', label: 'Published', cls: 'bg-emerald-50 border-emerald-200' },
          ].map(col => {
            const list = articles.filter(a => a.status === col.status);
            return (
              <div key={col.status} className={`rounded-2xl p-4 border space-y-3 ${col.cls}`}>
                <div className="flex items-center justify-between font-black uppercase">
                  <span>{col.label}</span>
                  <span className="font-mono">{list.length}</span>
                </div>
                <div className="space-y-2">
                  {list.slice(0, 8).map(art => (
                    <div key={art.id} className="bg-white p-3 rounded-xl border border-gray-200 space-y-2">
                      <span className="text-[10px] font-bold uppercase text-emerald-700">{art.category}</span>
                      <h4 className="font-bold text-gray-900 line-clamp-2">{art.titleEn}</h4>
                      <div className="flex items-center gap-2 pt-1">
                        {col.status !== 'published' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateWorkflowStatus(art.id, 'published')}
                            className="px-2.5 py-1 bg-emerald-700 text-white font-bold rounded text-[10px]"
                          >
                            Publish
                          </button>
                        )}
                        {col.status === 'draft' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateWorkflowStatus(art.id, 'in_review')}
                            className="text-emerald-700 font-bold text-[10px]"
                          >
                            Submit Review
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DELEGATED ENTERPRISE MODULES */}
      {activeModule === 'categories' && <CategoryPageManager onRefreshParent={loadCoreData} />}
      {activeModule === 'homepage' && (
        <HomepageLayoutBuilder categories={categoryPages.length ? categoryPages : categories} onRefreshParent={loadCoreData} />
      )}
      {activeModule === 'seo' && (
        <SEOManager
          articles={articles}
          mediaAssets={mediaAssets}
          categories={categoryPages}
          onRefreshParent={loadCoreData}
          onEditArticle={art => {
            setFormData(art);
            setEditingArticleId(art.id);
            setManualSlugEdited(true);
            setActiveModule('composer');
          }}
        />
      )}
      {activeModule === 'automation' && (
        <AutomationManager userRole={session.role} onJumpToAiKeys={() => setActiveModule('ai-keys')} />
      )}
      {activeModule === 'ai-keys' && <APIKeyManager onNotify={msg => notify(msg)} />}
      {activeModule === 'settings' && (
        <GlobalSettings
          settings={settings}
          onSaved={loadCoreData}
          onJumpToModule={m => setActiveModule(m)}
        />
      )}

      {/* MODULE: AI CONTENT STUDIO */}
      {activeModule === 'ai-studio' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
          <div className="lg:col-span-8 bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
              <div>
                <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-700" />
                  <span>AI Editorial Content Studio</span>
                </h2>
                <p className="text-gray-500">
                  Routed exclusively through your encrypted AI Key Vault with live usage & cost logging.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModule('ai-keys')}
                className="px-3 py-1.5 bg-slate-900 text-white font-bold rounded-lg inline-flex items-center gap-1"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span>API Keys & Routing</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Editorial Task Template</label>
                <select
                  value={studioTemplate}
                  onChange={e => setStudioTemplate(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg bg-white font-bold"
                >
                  {STUDIO_TEMPLATES.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Provider / Model Override</label>
                <select
                  value={studioCredentialId}
                  onChange={e => setStudioCredentialId(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg bg-white"
                >
                  <option value="">Default Task Router (Recommended)</option>
                  {aiProviders
                    .filter(p => p.enabled)
                    .map(p => (
                      <option key={p.id} value={p.id}>
                        {p.label} ({p.providerType} • {p.model})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block font-bold text-gray-700 mb-1">Topic / Working Headline</label>
                <input
                  type="text"
                  value={studioTopic}
                  onChange={e => setStudioTopic(e.target.value)}
                  placeholder="Enter headline, policy topic, or query..."
                  className="w-full p-2.5 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Tone</label>
                <input
                  type="text"
                  value={studioTone}
                  onChange={e => setStudioTone(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Source Facts / Draft Text (Optional)</label>
              <textarea
                rows={4}
                value={studioInputText}
                onChange={e => setStudioInputText(e.target.value)}
                placeholder="Paste verified facts, press release notes, or article text to translate/summarize/audit..."
                className="w-full p-2.5 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleRunStudioTask}
                disabled={studioLoading}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{studioLoading ? 'Executing...' : 'Generate'}</span>
              </button>
              {studioLoading && (
                <button
                  type="button"
                  onClick={() => studioAbortRef.current?.abort()}
                  className="px-4 py-2 bg-rose-100 text-rose-800 font-bold rounded-lg inline-flex items-center gap-1"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>
              )}
              {studioResult && !studioLoading && (
                <>
                  <button
                    type="button"
                    onClick={handleRunStudioTask}
                    className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 font-bold rounded-lg inline-flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Regenerate</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveStudioDraft}
                    className="px-3.5 py-2 bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold rounded-lg inline-flex items-center gap-1"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Draft</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendStudioToComposer(studioResult)}
                    className="px-3.5 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold rounded-lg"
                  >
                    Send to Composer →
                  </button>
                </>
              )}
            </div>

            {studioTelemetry && (
              <div className="p-2.5 bg-slate-900 text-emerald-300 rounded-lg font-mono text-[11px] flex flex-wrap gap-4">
                <span>Provider: {studioTelemetry.providerType}</span>
                <span>Model: {studioTelemetry.model}</span>
                <span>Tokens: {studioTelemetry.totalTokens}</span>
                <span>Latency: {studioTelemetry.latencyMs}ms</span>
              </div>
            )}

            {studioResult && (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                {studioResult.titleEn && <div className="font-black text-sm">{studioResult.titleEn}</div>}
                {studioResult.titleUr && (
                  <div className="font-urdu font-bold text-sm" dir="rtl">
                    {studioResult.titleUr}
                  </div>
                )}
                <pre className="whitespace-pre-wrap font-sans text-gray-800 text-xs max-h-96 overflow-y-auto bg-white p-3 rounded-lg border">
                  {studioResult.contentEn || JSON.stringify(studioResult, null, 2)}
                </pre>
                {studioResult.contentUr && (
                  <div className="font-urdu text-sm leading-relaxed bg-white p-3 rounded-lg border" dir="rtl">
                    {studioResult.contentUr}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Saved Drafts Drawer */}
          <div className="lg:col-span-4 bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h3 className="font-black text-sm text-gray-900">Saved AI Studio Drafts ({savedDrafts.length})</h3>
            <div className="divide-y divide-gray-100 max-h-[520px] overflow-y-auto">
              {savedDrafts.length === 0 ? (
                <div className="py-6 text-center text-gray-500">No saved drafts yet.</div>
              ) : (
                savedDrafts.map(dr => (
                  <div key={dr.id} className="py-2.5 space-y-1">
                    <div className="font-bold text-gray-900 line-clamp-1">{dr.titleEn}</div>
                    <div className="text-[10px] font-mono text-gray-500">
                      {dr.template} • {dr.model || 'routed'}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSendStudioToComposer(dr)}
                      className="text-emerald-700 font-bold hover:underline text-[11px]"
                    >
                      Load into Composer →
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODULE: ADVERTISING */}
      {activeModule === 'ads' && (
        <div className="space-y-4 text-xs">
          <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-gray-900">Advertising & Monetization Manager</h2>
              <p className="text-gray-500">Direct sponsorship campaigns & slot placements.</p>
            </div>
            <button
              type="button"
              onClick={() => setNewCampaignModal(true)}
              className="px-4 py-2 bg-emerald-700 text-white font-bold rounded-lg inline-flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              <span>Create Campaign</span>
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveAdTab('campaigns')}
              className={`px-4 py-1.5 rounded-lg font-bold ${
                activeAdTab === 'campaigns' ? 'bg-emerald-800 text-white' : 'bg-white border'
              }`}
            >
              Campaigns ({adCampaigns.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveAdTab('placements')}
              className={`px-4 py-1.5 rounded-lg font-bold ${
                activeAdTab === 'placements' ? 'bg-emerald-800 text-white' : 'bg-white border'
              }`}
            >
              Placements ({adPlacements.length})
            </button>
          </div>
          {activeAdTab === 'campaigns' ? (
            <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b font-bold text-gray-600">
                  <tr>
                    <th className="p-3">Campaign</th>
                    <th className="p-3">Budget (PKR)</th>
                    <th className="p-3">Impressions</th>
                    <th className="p-3">Clicks</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {adCampaigns.map(c => (
                    <tr key={c.id}>
                      <td className="p-3">
                        <div className="font-bold">{c.campaignName}</div>
                        <div className="text-gray-500 text-[11px]">{c.advertiserName}</div>
                      </td>
                      <td className="p-3 font-mono">Rs. {c.budgetPkr?.toLocaleString()}</td>
                      <td className="p-3 font-mono">{c.impressions?.toLocaleString()}</td>
                      <td className="p-3 font-mono">{c.clicks?.toLocaleString()}</td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteCampaign(c.id)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {adPlacements.map(slot => (
                <div key={slot.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="font-mono text-[10px] bg-gray-100 px-2 py-0.5 rounded">{slot.dimensions}</span>
                    <button
                      type="button"
                      onClick={() => handleTogglePlacement(slot)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        slot.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {slot.enabled ? 'Active' : 'Disabled'}
                    </button>
                  </div>
                  <div className="font-bold text-sm">{slot.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODULE: MEDIA */}
      {activeModule === 'media' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="text-base font-black text-gray-900">Media Assets Library</h2>
            <button
              type="button"
              onClick={() => setNewMediaModal(true)}
              className="px-4 py-2 bg-emerald-700 text-white font-bold rounded-lg inline-flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              <span>Add Media Asset</span>
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {mediaAssets.map(asset => (
              <div key={asset.id} className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                <img src={asset.url} alt={asset.altTextEn} className="w-full h-32 object-cover" />
                <div className="p-3 space-y-1.5">
                  <div className="font-bold truncate">{asset.captionEn || asset.filename}</div>
                  <div className="flex justify-between items-center pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(asset.url);
                        notify('Image URL copied');
                      }}
                      className="text-emerald-700 font-bold hover:underline"
                    >
                      Copy URL
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteMedia(asset.id)}
                      className="text-rose-600 font-bold"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODULE: STAFF & RBAC */}
      {activeModule === 'users' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-700" />
                <span>Staff Accounts & 9-Role RBAC Governance</span>
              </h2>
              <p className="text-gray-500">All 9 editorial & infrastructure roles enforced on server API routes.</p>
            </div>
            <button
              type="button"
              onClick={() => setNewUserModal(true)}
              className="px-4 py-2 bg-emerald-700 text-white font-bold rounded-lg inline-flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              <span>Add Staff Member</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-y text-gray-600 font-bold">
                <tr>
                  <th className="p-3">Staff Name</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Credentials</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {adminUsers.map(u => (
                  <tr key={u.id}>
                    <td className="p-3 font-bold">{u.nameEn}</td>
                    <td className="p-3 font-mono">{u.email}</td>
                    <td className="p-3">
                      <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-bold uppercase text-[10px]">
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3">{u.status}</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => setPasswordModalUser(u)}
                        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-lg"
                      >
                        Set Password
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODULE: AUDIENCE */}
      {activeModule === 'audience' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h3 className="font-black text-sm">Send Push / Newsletter Broadcast</h3>
            <form onSubmit={handleSendBroadcast} className="space-y-3">
              <input
                type="text"
                required
                placeholder="Headline (EN)"
                value={newNotification.titleEn || ''}
                onChange={e => setNewNotification({ ...newNotification, titleEn: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-lg"
              />
              <input
                type="text"
                dir="rtl"
                placeholder="سرخی (اردو)"
                value={newNotification.titleUr || ''}
                onChange={e => setNewNotification({ ...newNotification, titleUr: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-lg font-urdu"
              />
              <textarea
                rows={3}
                required
                placeholder="Broadcast message body..."
                value={newNotification.bodyEn || ''}
                onChange={e => setNewNotification({ ...newNotification, bodyEn: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-lg"
              />
              <button
                type="submit"
                className="w-full py-2 bg-emerald-700 text-white font-bold rounded-lg inline-flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Broadcast</span>
              </button>
            </form>
          </div>
          <div className="md:col-span-2 bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h3 className="font-black text-sm">
              Newsletter Subscribers ({subscribers.length}) & Sent Alerts ({notificationsList.length})
            </h3>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left">
                <thead className="border-b text-gray-500">
                  <tr>
                    <th className="py-2">Email</th>
                    <th className="py-2">Lang</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {subscribers.map(s => (
                    <tr key={s.id}>
                      <td className="py-2 font-mono">{s.email}</td>
                      <td className="py-2 uppercase">{s.language}</td>
                      <td className="py-2">{s.status}</td>
                      <td className="py-2 font-mono text-gray-500">
                        {new Date(s.subscribedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODULE: REPORTS */}
      {activeModule === 'reports' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <h2 className="text-base font-black text-gray-900">Unified Reports Center</h2>
            <div className="flex items-center gap-2">
              <select
                value={selectedReportId}
                onChange={e => {
                  setSelectedReportId(e.target.value);
                  loadReport(e.target.value);
                }}
                className="p-2 border border-gray-300 rounded-lg bg-white font-bold"
              >
                <option value="editorial-activity">Editorial Velocity</option>
                <option value="pageviews-traffic">Pageviews & Traffic</option>
                <option value="ads-monetization">Ad Monetization</option>
                <option value="automation-sync">Automation SLA</option>
                <option value="search-console-seo">Search Console SEO</option>
                <option value="user-audit-trail">Audit Trail</option>
                <option value="subscriber-growth">Subscriber Growth</option>
                <option value="ai-efficiency">AI Token Usage & Costs</option>
              </select>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-2 bg-gray-100 font-bold rounded-lg inline-flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            </div>
          </div>
          {reportLoading ? (
            <div className="p-8 text-center text-gray-500">Loading report...</div>
          ) : (
            reportData && (
              <pre className="p-4 bg-slate-900 text-emerald-300 rounded-xl font-mono text-[11px] max-h-96 overflow-y-auto">
                {JSON.stringify(reportData, null, 2)}
              </pre>
            )
          )}
        </div>
      )}

      {/* MODULE: SYSTEM HEALTH */}
      {activeModule === 'health' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5 text-xs">
          <h2 className="text-base font-black text-gray-900">System Health & Security Audit Trail</h2>
          {systemHealth && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 border rounded-xl">
                <div className="text-gray-500 uppercase font-bold text-[10px]">Uptime</div>
                <div className="text-xl font-black font-mono">{systemHealth.uptimeSeconds}s</div>
              </div>
              <div className="p-4 bg-gray-50 border rounded-xl">
                <div className="text-gray-500 uppercase font-bold text-[10px]">Memory RSS</div>
                <div className="text-xl font-black font-mono text-emerald-700">{systemHealth.memoryUsageMb} MB</div>
              </div>
              <div className="p-4 bg-gray-50 border rounded-xl">
                <div className="text-gray-500 uppercase font-bold text-[10px]">Node Version</div>
                <div className="text-xl font-black font-mono">{systemHealth.nodeVersion}</div>
              </div>
              <div className="p-4 bg-gray-50 border rounded-xl">
                <div className="text-gray-500 uppercase font-bold text-[10px]">DB Storage</div>
                <div className="text-xl font-black font-mono">
                  {Math.round(systemHealth.databaseSizeBytes / 1024)} KB
                </div>
              </div>
            </div>
          )}
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto border rounded-xl p-3">
            {logs.map(l => (
              <div key={l.id} className="py-2 flex items-center justify-between gap-4">
                <div>
                  <span className="font-bold text-gray-900">{l.action}</span>
                  <span className="mx-2 px-1.5 py-0.5 bg-gray-100 rounded font-mono text-[10px]">{l.user}</span>
                  <span className="text-gray-600">{l.details}</span>
                </div>
                <span className="font-mono text-gray-400 text-[10px] shrink-0">
                  {new Date(l.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* INLINE CONFIRMATION MODAL */}
      {confirmState && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-sm w-full p-6 space-y-4 text-xs shadow-2xl">
            <h3 className="text-sm font-black text-gray-900">{confirmState.title}</h3>
            <p className="text-gray-600">{confirmState.message}</p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmState(null)}
                className="px-4 py-2 bg-gray-100 font-bold rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const fn = confirmState.onConfirm;
                  setConfirmState(null);
                  await fn();
                }}
                className="px-4 py-2 bg-rose-600 text-white font-bold rounded-lg"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADLINE SUGGESTIONS MODAL */}
      {headlineChoices && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-lg w-full p-6 space-y-4 text-xs max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-black">Select AI Headline Suggestion</h3>
              <button type="button" onClick={() => setHeadlineChoices(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            {(headlineChoices.headlinesEn || []).map((h, i) => (
              <button
                key={`en-${i}`}
                type="button"
                onClick={() => {
                  setFormData(p => ({ ...p, titleEn: h }));
                  setHeadlineChoices(null);
                }}
                className="w-full text-left p-2.5 bg-gray-50 hover:bg-emerald-50 border rounded-lg font-bold"
              >
                {h}
              </button>
            ))}
            {(headlineChoices.headlinesUr || []).map((h, i) => (
              <button
                key={`ur-${i}`}
                type="button"
                dir="rtl"
                onClick={() => {
                  setFormData(p => ({ ...p, titleUr: h }));
                  setHeadlineChoices(null);
                }}
                className="w-full text-right p-2.5 bg-gray-50 hover:bg-emerald-50 border rounded-lg font-urdu font-bold"
              >
                {h}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TRANSLATION PREVIEW MODAL */}
      {translationPreview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-lg w-full p-6 space-y-4 text-xs max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-black">
                Translation Preview ({translationPreview.targetLang.toUpperCase()})
              </h3>
              <button type="button" onClick={() => setTranslationPreview(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            {translationPreview.translatedTitle && (
              <div className="p-2.5 bg-gray-50 border rounded-lg font-bold">
                {translationPreview.translatedTitle}
              </div>
            )}
            <div
              dir={translationPreview.targetLang === 'ur' ? 'rtl' : 'ltr'}
              className="p-3 bg-gray-50 border rounded-lg whitespace-pre-wrap leading-relaxed"
            >
              {translationPreview.translatedBody}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTranslationPreview(null)}
                className="px-4 py-2 bg-gray-100 rounded-lg font-bold"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    ...(translationPreview.targetLang === 'ur'
                      ? {
                          titleUr: translationPreview.translatedTitle || prev.titleUr,
                          summaryUr: translationPreview.translatedSummary || prev.summaryUr,
                          contentUr: translationPreview.translatedBody,
                        }
                      : {
                          titleEn: translationPreview.translatedTitle || prev.titleEn,
                          summaryEn: translationPreview.translatedSummary || prev.summaryEn,
                          contentEn: translationPreview.translatedBody,
                        }),
                  }));
                  setTranslationPreview(null);
                  notify('Applied translation to composer.');
                }}
                className="px-4 py-2 bg-emerald-700 text-white rounded-lg font-bold"
              >
                Apply to {translationPreview.targetLang.toUpperCase()} Tab
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VERSION HISTORY MODAL */}
      {showVersionsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 text-xs max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-black text-sm">Article Version Snapshots</h3>
              <button type="button" onClick={() => setShowVersionsModal(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            {activeArticleVersions.length === 0 ? (
              <div className="py-6 text-center text-gray-500">No historical snapshots saved yet.</div>
            ) : (
              activeArticleVersions.map(ver => (
                <div key={ver.versionId} className="p-3 bg-gray-50 border rounded-xl space-y-1.5">
                  <div className="flex justify-between font-mono text-[11px]">
                    <span>{ver.versionId}</span>
                    <span>{new Date(ver.savedAt).toLocaleString()}</span>
                  </div>
                  <div className="font-bold">{ver.titleEn}</div>
                  <button
                    type="button"
                    onClick={() => handleRollbackVersion(ver.versionId)}
                    className="px-3 py-1 bg-emerald-700 text-white font-bold rounded-lg"
                  >
                    Restore Version
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* CAMPAIGN / MEDIA / STAFF MODALS */}
      {newCampaignModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveCampaign} className="bg-white rounded-2xl max-w-md w-full p-6 space-y-3 text-xs">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-black text-sm">New Ad Campaign</h3>
              <button type="button" onClick={() => setNewCampaignModal(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              required
              placeholder="Campaign Name"
              value={newCampaign.campaignName}
              onChange={e => setNewCampaign({ ...newCampaign, campaignName: e.target.value })}
              className="w-full p-2 border rounded-lg"
            />
            <input
              type="text"
              required
              placeholder="Advertiser"
              value={newCampaign.advertiserName}
              onChange={e => setNewCampaign({ ...newCampaign, advertiserName: e.target.value })}
              className="w-full p-2 border rounded-lg"
            />
            <input
              type="number"
              placeholder="Budget PKR"
              value={newCampaign.budgetPkr}
              onChange={e => setNewCampaign({ ...newCampaign, budgetPkr: parseInt(e.target.value) || 0 })}
              className="w-full p-2 border rounded-lg font-mono"
            />
            <button type="submit" className="w-full py-2 bg-emerald-700 text-white font-bold rounded-lg">
              Create Campaign
            </button>
          </form>
        </div>
      )}

      {newMediaModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddMedia} className="bg-white rounded-2xl max-w-md w-full p-6 space-y-3 text-xs">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-black text-sm">Add Media Asset</h3>
              <button type="button" onClick={() => setNewMediaModal(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              required
              placeholder="Filename"
              value={newMedia.filename}
              onChange={e => setNewMedia({ ...newMedia, filename: e.target.value })}
              className="w-full p-2 border rounded-lg"
            />
            <input
              type="text"
              required
              placeholder="Image URL"
              value={newMedia.url}
              onChange={e => setNewMedia({ ...newMedia, url: e.target.value })}
              className="w-full p-2 border rounded-lg font-mono"
            />
            <input
              type="text"
              placeholder="Caption (EN)"
              value={newMedia.captionEn}
              onChange={e => setNewMedia({ ...newMedia, captionEn: e.target.value })}
              className="w-full p-2 border rounded-lg"
            />
            <button type="submit" className="w-full py-2 bg-emerald-700 text-white font-bold rounded-lg">
              Save Asset
            </button>
          </form>
        </div>
      )}

      {newUserModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={async e => {
              e.preventDefault();
              const res = await fetch('/api/admin/users', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser),
              });
              const d = await res.json();
              if (res.ok && d.success) {
                if (newUser.password && newUser.email) {
                  await fetch('/api/admin/auth/staff-password', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: newUser.email, newPassword: newUser.password }),
                  });
                }
                notify('Staff account provisioned!');
                setNewUserModal(false);
                loadModuleData('users');
              } else {
                notify(d.error || 'Could not add user', 'error');
              }
            }}
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-3 text-xs"
          >
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-black text-sm">Add Staff Member</h3>
              <button type="button" onClick={() => setNewUserModal(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              required
              placeholder="Full Name (EN)"
              value={newUser.nameEn}
              onChange={e => setNewUser({ ...newUser, nameEn: e.target.value })}
              className="w-full p-2 border rounded-lg"
            />
            <input
              type="email"
              required
              placeholder="Staff Email"
              value={newUser.email}
              onChange={e => setNewUser({ ...newUser, email: e.target.value })}
              className="w-full p-2 border rounded-lg font-mono"
            />
            <select
              value={newUser.role}
              onChange={e => setNewUser({ ...newUser, role: e.target.value as UserRole })}
              className="w-full p-2 border rounded-lg bg-white font-bold"
            >
              {OFFICIAL_ROLES.map(r => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <input
              type="password"
              minLength={8}
              placeholder="Initial Local Password (optional, min 8 chars)"
              value={newUser.password || ''}
              onChange={e => setNewUser({ ...newUser, password: e.target.value })}
              className="w-full p-2 border rounded-lg"
            />
            <button type="submit" className="w-full py-2 bg-emerald-700 text-white font-bold rounded-lg">
              Provision Staff Account
            </button>
          </form>
        </div>
      )}

      {passwordModalUser && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSetStaffPassword} className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-3 text-xs">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-black text-sm">Set Password for {passwordModalUser.nameEn}</h3>
              <button type="button" onClick={() => setPasswordModalUser(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="font-mono text-gray-500">{passwordModalUser.email}</div>
            <input
              type="password"
              required
              minLength={8}
              placeholder="New password (min 8 characters)"
              value={staffNewPassword}
              onChange={e => setStaffNewPassword(e.target.value)}
              className="w-full p-2.5 border rounded-lg"
            />
            <button type="submit" className="w-full py-2 bg-emerald-700 text-white font-bold rounded-lg">
              Update Local Password
            </button>
          </form>
        </div>
      )}
    </AdminLayout>
  );
};
