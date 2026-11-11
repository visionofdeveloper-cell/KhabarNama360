/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Complete Enterprise Admin Dashboard
 */

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import {
  Article,
  SiteSettings,
  AuditLog,
  AdminUser,
  MediaAsset,
  AdPlacement,
  AdCampaign,
  SeoPageConfig,
  SearchConsoleMetrics,
  RedirectRule,
  BrokenLinkReport,
  NewsletterSubscriber,
  AudienceNotification,
  HomepageLayoutConfig,
  SystemHealthReport
} from '../types/index.ts';
import { AutomationManager } from '../components/admin/AutomationManager.tsx';
import {
  ShieldCheck,
  Plus,
  Edit3,
  Trash2,
  Sparkles,
  Save,
  BarChart2,
  Settings,
  FileText,
  Activity,
  Layers,
  CheckCircle2,
  AlertCircle,
  Eye,
  RefreshCw,
  Download,
  Zap,
  Radio,
  Database,
  ArrowUpRight,
  Check,
  X,
  Clock,
  TrendingUp,
  Cpu,
  Search,
  Bell,
  ChevronDown,
  ChevronRight,
  Users,
  Image as ImageIcon,
  DollarSign,
  Globe,
  Sliders,
  Send,
  Calendar,
  ExternalLink,
  RotateCcw,
  Layout,
  HardDrive,
  Copy,
  FolderOpen,
  Filter,
  Share2,
  Mail,
  CheckSquare,
  FileCheck
} from 'lucide-react';

type AdminModule =
  | 'overview'
  | 'articles'
  | 'composer'
  | 'workflow'
  | 'media'
  | 'seo'
  | 'ads'
  | 'automation'
  | 'ai-studio'
  | 'users'
  | 'audience'
  | 'homepage'
  | 'reports'
  | 'settings'
  | 'health';

export const AdminView: React.FC = () => {
  const { isUrdu } = useLanguage();

  // Active module & sub-views
  const [activeModule, setActiveModule] = useState<AdminModule>('overview');
  const [userRole, setUserRole] = useState<'Super Admin' | 'Managing Editor' | 'Reporter' | 'SEO Specialist' | 'Advertising Manager'>('Super Admin');
  const [dateRange, setDateRange] = useState<'today' | 'yesterday' | '7days' | '30days' | 'all'>('7days');
  const [globalSearch, setGlobalSearch] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Core Data States
  const [analytics, setAnalytics] = useState<any>({});
  const [articles, setArticles] = useState<Article[]>([]);
  const [articleFilterStatus, setArticleFilterStatus] = useState<string>('all');
  const [articleSearchQuery, setArticleSearchQuery] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);

  // SEO States
  const [seoPages, setSeoPages] = useState<SeoPageConfig[]>([]);
  const [searchConsole, setSearchConsole] = useState<SearchConsoleMetrics | null>(null);
  const [redirectRules, setRedirectRules] = useState<RedirectRule[]>([]);
  const [brokenLinks, setBrokenLinks] = useState<BrokenLinkReport[]>([]);
  const [activeSeoTab, setActiveSeoTab] = useState<'pages' | 'console' | 'sitemaps' | 'robots' | 'redirects' | 'broken'>('console');
  const [editingSeoPage, setEditingSeoPage] = useState<SeoPageConfig | null>(null);

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
    status: 'active'
  });

  // Media Library States
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [mediaCategory, setMediaCategory] = useState<string>('all');
  const [mediaSearch, setMediaSearch] = useState<string>('');
  const [newMediaModal, setNewMediaModal] = useState(false);
  const [newMedia, setNewMedia] = useState<Partial<MediaAsset>>({
    filename: '',
    url: '',
    category: 'general',
    captionEn: '',
    captionUr: '',
    altTextEn: '',
    altTextUr: ''
  });

  // Users & RBAC
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [newUserModal, setNewUserModal] = useState(false);
  const [newUser, setNewUser] = useState<Partial<AdminUser>>({
    nameEn: '',
    nameUr: '',
    email: '',
    role: 'Reporter',
    status: 'active'
  });

  // Audience & Broadcasts
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [notifications, setNotifications] = useState<AudienceNotification[]>([]);
  const [newNotification, setNewNotification] = useState<Partial<AudienceNotification>>({
    titleEn: '',
    titleUr: '',
    bodyEn: '',
    bodyUr: '',
    targetLanguage: 'both',
    targetUrl: 'https://360khabarnama.com'
  });

  // Homepage Config
  const [homepageConfig, setHomepageConfig] = useState<HomepageLayoutConfig | null>(null);

  // System Health
  const [systemHealth, setSystemHealth] = useState<SystemHealthReport | null>(null);

  // Reports
  const [selectedReportId, setSelectedReportId] = useState<string>('editorial-activity');
  const [reportData, setReportData] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // AI Content Studio State
  const [aiStudioTab, setAiStudioTab] = useState<'draft' | 'social' | 'newsletter' | 'audit'>('draft');
  const [aiTopic, setAiTopic] = useState('');
  const [aiFacts, setAiFacts] = useState('');
  const [aiCategory, setAiCategory] = useState('pakistan');
  const [aiTone, setAiTone] = useState('Objective, formal, journalistic');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiGeneratedDraft, setAiGeneratedDraft] = useState<any>(null);
  const [socialCaptions, setSocialCaptions] = useState<any>(null);
  const [newsletterPreview, setNewsletterPreview] = useState<any>(null);
  const [qualityAuditResult, setQualityAuditResult] = useState<any>(null);

  // Composer Form State (Dual Language)
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [composerLang, setComposerLang] = useState<'ur' | 'en'>('ur');
  const [formData, setFormData] = useState<Partial<Article>>({
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
      nameEn: 'Editorial Staff',
      nameUr: 'اداریہ 360 خبرنامہ',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      role: 'Senior Editor'
    }
  });
  const [showVersionsModal, setShowVersionsModal] = useState(false);
  const [activeArticleVersions, setActiveArticleVersions] = useState<any[]>([]);

  // Feedback notifications
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const notify = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 6000);
  };

  // Data Loading
  const loadCoreData = async () => {
    try {
      const [anRes, artRes, setRes, logRes] = await Promise.all([
        fetch('/api/admin/analytics').then(r => r.json()),
        fetch('/api/news?status=all').then(r => r.json()),
        fetch('/api/settings').then(r => r.json()),
        fetch('/api/admin/audit-logs').then(r => r.json()),
      ]);

      if (anRes.success) setAnalytics(anRes);
      if (artRes.success) setArticles(artRes.articles);
      if (setRes.success) {
        setSettings(setRes.settings);
        setCategories(setRes.categories || []);
      }
      if (logRes.success) setLogs(logRes.logs);
    } catch {
      // ignore
    }
  };

  const loadModuleData = async (mod: AdminModule) => {
    try {
      if (mod === 'seo') {
        const [pRes, scRes, rRes, bRes] = await Promise.all([
          fetch('/api/admin/seo/pages').then(r => r.json()),
          fetch('/api/admin/seo/search-console').then(r => r.json()),
          fetch('/api/admin/seo/redirects').then(r => r.json()),
          fetch('/api/admin/seo/broken-links').then(r => r.json()),
        ]);
        if (pRes.success) setSeoPages(pRes.pages);
        if (scRes.success) setSearchConsole(scRes.metrics);
        if (rRes.success) setRedirectRules(rRes.redirects);
        if (bRes.success) setBrokenLinks(bRes.brokenLinks);
      } else if (mod === 'ads') {
        const [plRes, cRes] = await Promise.all([
          fetch('/api/admin/ads/placements').then(r => r.json()),
          fetch('/api/admin/ads/campaigns').then(r => r.json()),
        ]);
        if (plRes.success) setAdPlacements(plRes.placements);
        if (cRes.success) setAdCampaigns(cRes.campaigns);
      } else if (mod === 'media') {
        const res = await fetch(`/api/admin/media?category=${mediaCategory}&search=${mediaSearch}`).then(r => r.json());
        if (res.success) setMediaAssets(res.assets);
      } else if (mod === 'users') {
        const res = await fetch('/api/admin/users').then(r => r.json());
        if (res.success) setAdminUsers(res.users);
      } else if (mod === 'audience') {
        const [sRes, nRes] = await Promise.all([
          fetch('/api/admin/audience/subscribers').then(r => r.json()),
          fetch('/api/admin/audience/notifications').then(r => r.json()),
        ]);
        if (sRes.success) setSubscribers(sRes.subscribers);
        if (nRes.success) setNotifications(nRes.notifications);
      } else if (mod === 'homepage') {
        const res = await fetch('/api/homepage/config').then(r => r.json());
        if (res.success) setHomepageConfig(res.config);
      } else if (mod === 'health') {
        const res = await fetch('/api/admin/system/health').then(r => r.json());
        if (res.success) setSystemHealth(res.health);
      } else if (mod === 'reports') {
        loadReport(selectedReportId);
      }
    } catch {
      // ignore
    }
  };

  const loadReport = async (reportId: string) => {
    setReportLoading(true);
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`).then(r => r.json());
      if (res.success) {
        setReportData(res);
      }
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
  }, [activeModule, mediaCategory, mediaSearch]);

  // Article Actions
  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titleEn || !formData.titleUr) {
      notify('Please provide both English and Urdu headlines', 'error');
      return;
    }

    const payload = {
      ...formData,
      id: editingArticleId || `art-${Date.now()}`,
      slug: (formData.titleEn || 'news-article')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, ''),
    };

    try {
      const res = await fetch('/api/news', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-user': userRole,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        notify(editingArticleId ? 'Article successfully updated!' : 'Article published successfully!');
        setEditingArticleId(null);
        resetComposer();
        setActiveModule('articles');
        loadCoreData();
      }
    } catch {
      notify('Failed to save article', 'error');
    }
  };

  const handleUpdateWorkflowStatus = async (articleId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/news/${articleId}/workflow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-user': userRole,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        notify(`Article moved to "${newStatus}"`);
        loadCoreData();
      }
    } catch {
      notify('Failed to update workflow status', 'error');
    }
  };

  const handleOpenVersions = async (article: Article) => {
    try {
      const res = await fetch(`/api/news/${article.id}/versions`).then(r => r.json());
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
        headers: {
          'Content-Type': 'application/json',
          'x-admin-user': userRole,
        },
        body: JSON.stringify({ versionId }),
      });
      const data = await res.json();
      if (data.success) {
        notify('Article restored to selected snapshot!');
        setShowVersionsModal(false);
        setFormData(data.article);
        loadCoreData();
      }
    } catch {
      notify('Rollback failed', 'error');
    }
  };

  const handleDeleteArticle = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this article?')) return;
    try {
      const res = await fetch(`/api/news/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-user': userRole },
      });
      const d = await res.json();
      if (d.success) {
        notify('Article deleted');
        loadCoreData();
      }
    } catch {
      notify('Deletion failed', 'error');
    }
  };

  const resetComposer = () => {
    setEditingArticleId(null);
    setFormData({
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
        nameEn: 'Editorial Staff',
        nameUr: 'اداریہ 360 خبرنامہ',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        role: userRole,
      },
    });
  };

  // AI Content Studio Handlers
  const handleGenerateStoryDraft = async () => {
    if (!aiTopic.trim()) {
      notify('Please enter a story topic or headline idea', 'error');
      return;
    }
    setAiLoading(true);
    setAiGeneratedDraft(null);
    try {
      const res = await fetch('/api/admin/ai/draft-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: aiTopic,
          facts: aiFacts,
          category: aiCategory,
          tone: aiTone,
        }),
      });
      const data = await res.json();
      if (data.success && data.draft) {
        setAiGeneratedDraft(data.draft);
        notify('AI News Draft generated successfully!');
      } else {
        notify(data.error || 'Failed to generate draft', 'error');
      }
    } catch {
      notify('AI draft request failed', 'error');
    } finally {
      setAiLoading(false);
    }
  };

  const handleUseAiDraftInComposer = (draft: any) => {
    setFormData({
      ...formData,
      titleEn: draft.titleEn,
      titleUr: draft.titleUr,
      summaryEn: draft.summaryEn,
      summaryUr: draft.summaryUr,
      contentEn: draft.contentEn,
      contentUr: draft.contentUr,
      category: draft.suggestedCategory || 'pakistan',
      tags: draft.tags || ['Pakistan', 'Breaking'],
      status: 'in_review',
    });
    setEditingArticleId(null);
    setActiveModule('composer');
    notify('Draft imported into Composer in Editorial Review mode');
  };

  const handleGenerateSocialCaptions = async () => {
    const titleEn = formData.titleEn || aiTopic;
    const titleUr = formData.titleUr || aiTopic;
    const summaryEn = formData.summaryEn || aiFacts;
    if (!titleEn) {
      notify('Enter article titles or generate draft first', 'error');
      return;
    }
    setAiLoading(true);
    try {
      const res = await fetch('/api/admin/ai/social-captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titleEn, titleUr, summaryEn, summaryUr: formData.summaryUr }),
      });
      const data = await res.json();
      if (data.success) {
        setSocialCaptions(data.captions);
        notify('Social media package created!');
      }
    } catch {
      notify('Failed to generate social media package', 'error');
    } finally {
      setAiLoading(false);
    }
  };

  const handleGenerateNewsletter = async () => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/admin/ai/newsletter-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        setNewsletterPreview(data.newsletter);
        notify('Morning Pulse newsletter generated!');
      }
    } catch {
      notify('Failed to generate newsletter', 'error');
    } finally {
      setAiLoading(false);
    }
  };

  const handleRunQualityAudit = async () => {
    const titleEn = formData.titleEn || aiTopic;
    const contentEn = formData.contentEn || aiFacts;
    const titleUr = formData.titleUr || aiTopic;
    if (!titleEn) {
      notify('Please enter content to audit', 'error');
      return;
    }
    setAiLoading(true);
    try {
      const res = await fetch('/api/admin/ai/content-quality-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titleEn, contentEn, titleUr, contentUr: formData.contentUr }),
      });
      const data = await res.json();
      if (data.success) {
        setQualityAuditResult(data.audit);
        notify(`Quality check complete! Score: ${data.audit.overallScore}/100`);
      }
    } catch {
      notify('Quality audit failed', 'error');
    } finally {
      setAiLoading(false);
    }
  };

  // Advertising Handlers
  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/ads/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-user': userRole,
        },
        body: JSON.stringify(newCampaign),
      });
      const data = await res.json();
      if (data.success) {
        notify('Campaign created successfully!');
        setNewCampaignModal(false);
        loadModuleData('ads');
      }
    } catch {
      notify('Failed to create campaign', 'error');
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!window.confirm('Delete this advertising campaign?')) return;
    try {
      const res = await fetch(`/api/admin/ads/campaigns/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-user': userRole },
      });
      const d = await res.json();
      if (d.success) {
        notify('Campaign removed');
        loadModuleData('ads');
      }
    } catch {
      notify('Failed to delete campaign', 'error');
    }
  };

  const handleTogglePlacement = async (slot: AdPlacement) => {
    try {
      const res = await fetch(`/api/admin/ads/placements/${slot.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-user': userRole,
        },
        body: JSON.stringify({ enabled: !slot.enabled }),
      });
      const d = await res.json();
      if (d.success) {
        notify(`Slot "${slot.name}" ${!slot.enabled ? 'Enabled' : 'Disabled'}`);
        loadModuleData('ads');
      }
    } catch {
      notify('Failed to update slot', 'error');
    }
  };

  // Media Handlers
  const handleAddMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedia.filename || !newMedia.url) {
      notify('Filename and Image URL are required', 'error');
      return;
    }
    try {
      const res = await fetch('/api/admin/media', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-user': userRole,
        },
        body: JSON.stringify(newMedia),
      });
      const d = await res.json();
      if (d.success) {
        notify('Media asset added to library!');
        setNewMediaModal(false);
        loadModuleData('media');
      }
    } catch {
      notify('Failed to save media asset', 'error');
    }
  };

  const handleDeleteMedia = async (id: string) => {
    if (!window.confirm('Delete this asset from library?')) return;
    try {
      const res = await fetch(`/api/admin/media/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-user': userRole },
      });
      const d = await res.json();
      if (d.success) {
        notify('Asset removed');
        loadModuleData('media');
      }
    } catch {
      notify('Failed to delete asset', 'error');
    }
  };

  // Audience Handlers
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNotification.titleEn || !newNotification.bodyEn) {
      notify('Please provide notification headline and body', 'error');
      return;
    }
    try {
      const res = await fetch('/api/admin/audience/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-user': userRole,
        },
        body: JSON.stringify(newNotification),
      });
      const d = await res.json();
      if (d.success) {
        notify(`Broadcast sent to ${d.notification?.recipientsCount?.toLocaleString() || 'all'} subscribers!`);
        setNewNotification({
          titleEn: '',
          titleUr: '',
          bodyEn: '',
          bodyUr: '',
          targetLanguage: 'both',
          targetUrl: 'https://360khabarnama.com',
        });
        loadModuleData('audience');
      }
    } catch {
      notify('Broadcast dispatch failed', 'error');
    }
  };

  // Filtered Articles List
  const filteredArticles = articles.filter(a => {
    const matchStatus = articleFilterStatus === 'all' || a.status === articleFilterStatus;
    const q = articleSearchQuery.toLowerCase();
    const matchQuery =
      !q ||
      a.titleEn.toLowerCase().includes(q) ||
      a.titleUr.includes(q) ||
      a.category.toLowerCase().includes(q);
    return matchStatus && matchQuery;
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans-en text-gray-900">
      {/* Top Banner Feedback */}
      {feedback && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-2xl shadow-xl flex items-center gap-3 text-xs font-bold transition-all border ${
            feedback.type === 'success'
              ? 'bg-emerald-900 text-white border-emerald-700'
              : 'bg-red-900 text-white border-red-700'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="ml-2 hover:opacity-75">✕</button>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-gray-950 text-white border-b border-gray-800 px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
            title="Toggle Sidebar"
          >
            <Sliders className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center font-black text-white text-base">
              K
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm tracking-tight text-white">360Khabarnama</span>
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.2 rounded-md uppercase tracking-wider">
                  Admin OS
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Global Dashboard Search */}
        <div className="hidden md:flex items-center flex-1 max-w-md mx-4">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Search articles, campaigns, subscribers, or SEO routes..."
              className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Top Controls: Date Filter, Actions, Notifications, Role */}
        <div className="flex items-center gap-2.5">
          {/* Date Range Dropdown */}
          <div className="hidden lg:flex items-center bg-gray-900 border border-gray-800 rounded-xl px-2.5 py-1 text-xs">
            <Calendar className="w-3.5 h-3.5 text-emerald-400 mr-1.5" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="bg-transparent text-gray-200 font-medium focus:outline-none cursor-pointer text-xs"
            >
              <option value="today" className="bg-gray-900">Today</option>
              <option value="yesterday" className="bg-gray-900">Yesterday</option>
              <option value="7days" className="bg-gray-900">Last 7 Days</option>
              <option value="30days" className="bg-gray-900">Last 30 Days</option>
              <option value="all" className="bg-gray-900">All Time</option>
            </select>
          </div>

          {/* Quick Action: New Story */}
          <button
            onClick={() => { resetComposer(); setActiveModule('composer'); }}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Story</span>
          </button>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors relative"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400"></span>
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-4 text-xs z-50">
                <div className="flex items-center justify-between pb-2 border-b border-gray-800 mb-3">
                  <span className="font-bold text-gray-200">System Notifications</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                    Live
                  </span>
                </div>
                <div className="space-y-2.5">
                  <div className="p-2.5 bg-gray-800/60 rounded-xl border border-gray-700/50">
                    <div className="font-bold text-emerald-400">APGJAA Gold Rates Synced</div>
                    <p className="text-gray-400 text-[11px] mt-0.5">24K Tola updated to Rs. 278,500 (+1,200 change detected).</p>
                  </div>
                  <div className="p-2.5 bg-gray-800/60 rounded-xl border border-gray-700/50">
                    <div className="font-bold text-amber-400">Google News Sitemap Updated</div>
                    <p className="text-gray-400 text-[11px] mt-0.5">Automated 48h rolling window updated with latest published stories.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Role Indicator & Switcher */}
          <div className="flex items-center bg-gray-900 border border-gray-800 px-2.5 py-1 rounded-xl">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400 mr-1.5" />
            <select
              value={userRole}
              onChange={(e) => setUserRole(e.target.value as any)}
              className="bg-transparent text-gray-200 text-xs font-bold focus:outline-none cursor-pointer"
            >
              <option value="Super Admin" className="bg-gray-900">Super Admin</option>
              <option value="Managing Editor" className="bg-gray-900">Managing Editor</option>
              <option value="Reporter" className="bg-gray-900">Reporter</option>
              <option value="SEO Specialist" className="bg-gray-900">SEO Specialist</option>
              <option value="Advertising Manager" className="bg-gray-900">Advertising Manager</option>
            </select>
          </div>
        </div>
      </header>

      {/* Main Body with Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Responsive Collapsible Sidebar */}
        <aside
          className={`${
            sidebarCollapsed ? 'w-16' : 'w-64'
          } bg-gray-950 text-gray-300 border-r border-gray-800 transition-all duration-200 shrink-0 flex flex-col justify-between overflow-y-auto`}
        >
          <div className="p-3 space-y-6">
            {/* Category 1: Dashboard & Analytics */}
            <div>
              {!sidebarCollapsed && (
                <div className="text-[10px] font-black uppercase text-gray-500 tracking-wider px-3 mb-2">
                  Dashboard
                </div>
              )}
              <div className="space-y-1">
                <button
                  onClick={() => setActiveModule('overview')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeModule === 'overview'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'hover:bg-gray-900 text-gray-400 hover:text-white'
                  }`}
                  title="Overview"
                >
                  <BarChart2 className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span>Overview & KPI</span>}
                </button>

                <button
                  onClick={() => setActiveModule('reports')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeModule === 'reports'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'hover:bg-gray-900 text-gray-400 hover:text-white'
                  }`}
                  title="Reports Center"
                >
                  <FileCheck className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span>Reports Center (12)</span>}
                </button>
              </div>
            </div>

            {/* Category 2: Editorial & CMS */}
            <div>
              {!sidebarCollapsed && (
                <div className="text-[10px] font-black uppercase text-gray-500 tracking-wider px-3 mb-2">
                  Editorial & CMS
                </div>
              )}
              <div className="space-y-1">
                <button
                  onClick={() => setActiveModule('articles')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeModule === 'articles'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'hover:bg-gray-900 text-gray-400 hover:text-white'
                  }`}
                  title="Articles Directory"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 shrink-0" />
                    {!sidebarCollapsed && <span>News Articles</span>}
                  </div>
                  {!sidebarCollapsed && (
                    <span className="text-[10px] bg-gray-800 text-gray-300 px-1.5 py-0.2 rounded-md font-mono">
                      {articles.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => { resetComposer(); setActiveModule('composer'); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeModule === 'composer'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'hover:bg-gray-900 text-gray-400 hover:text-white'
                  }`}
                  title="Compose Article"
                >
                  <Edit3 className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span>Bilingual Editor</span>}
                </button>

                <button
                  onClick={() => setActiveModule('workflow')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeModule === 'workflow'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'hover:bg-gray-900 text-gray-400 hover:text-white'
                  }`}
                  title="Editorial Workflow"
                >
                  <div className="flex items-center gap-3">
                    <CheckSquare className="w-4 h-4 shrink-0" />
                    {!sidebarCollapsed && <span>Workflow Board</span>}
                  </div>
                  {!sidebarCollapsed && (
                    <span className="text-[10px] bg-amber-400/20 text-amber-300 px-1.5 py-0.2 rounded-md font-mono font-bold">
                      {articles.filter(a => a.status === 'in_review').length} Review
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Category 3: Growth, Search & Monetization */}
            <div>
              {!sidebarCollapsed && (
                <div className="text-[10px] font-black uppercase text-gray-500 tracking-wider px-3 mb-2">
                  Growth & Ads
                </div>
              )}
              <div className="space-y-1">
                <button
                  onClick={() => setActiveModule('seo')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeModule === 'seo'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'hover:bg-gray-900 text-gray-400 hover:text-white'
                  }`}
                  title="SEO Manager"
                >
                  <Globe className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span>SEO & Search Console</span>}
                </button>

                <button
                  onClick={() => setActiveModule('ads')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeModule === 'ads'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'hover:bg-gray-900 text-gray-400 hover:text-white'
                  }`}
                  title="Advertising Manager"
                >
                  <DollarSign className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span>Advertising Manager</span>}
                </button>

                <button
                  onClick={() => setActiveModule('audience')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeModule === 'audience'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'hover:bg-gray-900 text-gray-400 hover:text-white'
                  }`}
                  title="Audience & Subscribers"
                >
                  <Mail className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span>Audience & Alerts</span>}
                </button>
              </div>
            </div>

            {/* Category 4: Intelligence & Data Engine */}
            <div>
              {!sidebarCollapsed && (
                <div className="text-[10px] font-black uppercase text-gray-500 tracking-wider px-3 mb-2">
                  Automation & AI
                </div>
              )}
              <div className="space-y-1">
                <button
                  onClick={() => setActiveModule('automation')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeModule === 'automation'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'hover:bg-gray-900 text-gray-400 hover:text-white'
                  }`}
                  title="Live Data Automation"
                >
                  <div className="flex items-center gap-3">
                    <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                    {!sidebarCollapsed && <span>Live Data Sync</span>}
                  </div>
                  {!sidebarCollapsed && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  )}
                </button>

                <button
                  onClick={() => setActiveModule('ai-studio')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeModule === 'ai-studio'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'hover:bg-gray-900 text-gray-400 hover:text-white'
                  }`}
                  title="AI Content Studio"
                >
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                  {!sidebarCollapsed && <span>AI Content Studio</span>}
                </button>
              </div>
            </div>

            {/* Category 5: Media & Layout */}
            <div>
              {!sidebarCollapsed && (
                <div className="text-[10px] font-black uppercase text-gray-500 tracking-wider px-3 mb-2">
                  Media & Design
                </div>
              )}
              <div className="space-y-1">
                <button
                  onClick={() => setActiveModule('media')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeModule === 'media'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'hover:bg-gray-900 text-gray-400 hover:text-white'
                  }`}
                  title="Media Library"
                >
                  <ImageIcon className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span>Media Assets</span>}
                </button>

                <button
                  onClick={() => setActiveModule('homepage')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeModule === 'homepage'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'hover:bg-gray-900 text-gray-400 hover:text-white'
                  }`}
                  title="Homepage Builder"
                >
                  <Layout className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span>Homepage Builder</span>}
                </button>
              </div>
            </div>

            {/* Category 6: Administration & Security */}
            <div>
              {!sidebarCollapsed && (
                <div className="text-[10px] font-black uppercase text-gray-500 tracking-wider px-3 mb-2">
                  Administration
                </div>
              )}
              <div className="space-y-1">
                <button
                  onClick={() => setActiveModule('users')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeModule === 'users'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'hover:bg-gray-900 text-gray-400 hover:text-white'
                  }`}
                  title="Staff & RBAC"
                >
                  <Users className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span>Staff & RBAC</span>}
                </button>

                <button
                  onClick={() => setActiveModule('settings')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeModule === 'settings'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'hover:bg-gray-900 text-gray-400 hover:text-white'
                  }`}
                  title="Settings"
                >
                  <Settings className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span>Global Settings</span>}
                </button>

                <button
                  onClick={() => setActiveModule('health')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeModule === 'health'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'hover:bg-gray-900 text-gray-400 hover:text-white'
                  }`}
                  title="System Health"
                >
                  <HardDrive className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span>System Diagnostics</span>}
                </button>
              </div>
            </div>
          </div>

          {/* Bottom user card */}
          {!sidebarCollapsed && (
            <div className="p-3 border-t border-gray-800 bg-gray-900/60">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-700 flex items-center justify-center text-white font-bold text-xs">
                  {userRole.charAt(0)}
                </div>
                <div className="truncate text-xs">
                  <div className="font-bold text-gray-200 truncate">{userRole}</div>
                  <div className="text-[10px] text-gray-500">Security Clearance Lv. 1</div>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Main Content Workspace */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {/* ================= MODULE 1: OVERVIEW & KPI ================= */}
          {activeModule === 'overview' && (
            <div className="space-y-6">
              {/* Top Banner */}
              <div className="bg-gradient-to-r from-gray-950 via-emerald-950 to-gray-900 text-white rounded-3xl p-6 sm:p-8 shadow-sm border border-emerald-900/40 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold mb-1">
                    <Activity className="w-4 h-4 animate-pulse" />
                    <span>Portal Telemetry • Real-Time Operating Status</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black">
                    360Khabarnama Executive Dashboard
                  </h1>
                  <p className="text-xs text-gray-300 mt-1 max-w-xl">
                    Pakistan's leading bilingual digital portal. Editorial governance, real-time live data adapters, search visibility, and monetization metrics.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => { resetComposer(); setActiveModule('composer'); }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Story</span>
                  </button>
                  <button
                    onClick={() => setActiveModule('automation')}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-gray-700 transition-all"
                  >
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>Sync Live Data</span>
                  </button>
                </div>
              </div>

              {/* KPI Cards Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Published News</span>
                  <div className="text-2xl font-black text-gray-900 font-mono mt-1">{analytics.publishedCount || articles.filter(a => a.status === 'published').length}</div>
                  <span className="text-[10px] text-emerald-600 font-bold mt-1 block">Active across /en and /ur</span>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Total Pageviews</span>
                  <div className="text-2xl font-black text-emerald-700 font-mono mt-1">
                    {(analytics.totalViews || 108900).toLocaleString()}
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono mt-1 block">+14.2% this week</span>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Search Impressions</span>
                  <div className="text-2xl font-black text-blue-700 font-mono mt-1">
                    {(analytics.seoStats?.totalImpressions || 1480000).toLocaleString()}
                  </div>
                  <span className="text-[10px] text-blue-600 font-bold mt-1 block">Google Search Console</span>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Organic Clicks</span>
                  <div className="text-2xl font-black text-indigo-700 font-mono mt-1">
                    {(analytics.seoStats?.totalClicks || 92400).toLocaleString()}
                  </div>
                  <span className="text-[10px] text-indigo-600 font-bold mt-1 block">Avg Position: 8.4</span>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Subscribers</span>
                  <div className="text-2xl font-black text-teal-700 font-mono mt-1">
                    {(analytics.totalSubscribers || 12480).toLocaleString()}
                  </div>
                  <span className="text-[10px] text-teal-600 font-bold mt-1 block">Daily Morning Pulse</span>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Ad CTR</span>
                  <div className="text-2xl font-black text-amber-600 font-mono mt-1">
                    {analytics.adStats?.avgCtr || '2.84'}%
                  </div>
                  <span className="text-[10px] text-amber-600 font-bold mt-1 block">Monetization Active</span>
                </div>
              </div>

              {/* Mid-Section: Recent Breaking Stories & Quick Operations */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Articles & Status (2 cols) */}
                <div className="lg:col-span-2 bg-white border border-gray-200 rounded-3xl p-6 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <h3 className="font-black text-sm text-gray-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-700" />
                      <span>Recent Editorial Output</span>
                    </h3>
                    <button
                      onClick={() => setActiveModule('articles')}
                      className="text-xs text-emerald-700 font-bold hover:underline flex items-center gap-1"
                    >
                      <span>View All ({articles.length})</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {articles.slice(0, 5).map((art) => (
                      <div key={art.id} className="py-3 flex items-center justify-between gap-4 hover:bg-gray-50/50 rounded-xl px-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                              {art.category}
                            </span>
                            <span
                              className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                                art.status === 'published'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : art.status === 'in_review'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {art.status}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-gray-900 truncate mt-1">{art.titleEn}</h4>
                          <p className="text-[11px] font-urdu text-gray-600 truncate" dir="rtl">{art.titleUr}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => { setFormData(art); setEditingArticleId(art.id); setActiveModule('composer'); }}
                            className="p-1.5 text-gray-500 hover:text-emerald-700 rounded-lg hover:bg-gray-100"
                            title="Edit Article"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenVersions(art)}
                            className="p-1.5 text-gray-500 hover:text-blue-700 rounded-lg hover:bg-gray-100"
                            title="Revision History"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Automation Health & Live Rates Snippet (1 col) */}
                <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <h3 className="font-black text-sm text-gray-900 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <span>Live Data Adapters SLA</span>
                    </h3>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      12 Adapters Active
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="flex justify-between font-bold text-gray-800">
                        <span>Gold & Sarafa Bullion</span>
                        <span className="text-emerald-700 font-mono">Rs. 278,500/tola</span>
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">APGJAA Verified • Hourly sync</div>
                    </div>

                    <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="flex justify-between font-bold text-gray-800">
                        <span>Interbank USD / PKR</span>
                        <span className="text-emerald-700 font-mono">Rs. 278.10</span>
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">State Bank of Pakistan • Every 30m</div>
                    </div>

                    <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="flex justify-between font-bold text-gray-800">
                        <span>Petrol & High Speed Diesel</span>
                        <span className="text-emerald-700 font-mono">Rs. 265.40/L</span>
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">OGRA Official Gazette Verified</div>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={() => setActiveModule('automation')}
                        className="w-full py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span>Open Full Automation Manager</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= MODULE 2: ARTICLES DIRECTORY ================= */}
          {activeModule === 'articles' && (
            <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
                <div>
                  <h2 className="text-lg font-black text-gray-900">Articles Directory</h2>
                  <p className="text-xs text-gray-500">Manage all editorial publications, schedules, and drafts</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { resetComposer(); setActiveModule('composer'); }}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Compose New Story</span>
                  </button>
                </div>
              </div>

              {/* Status Filters & Search Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
                  {['all', 'published', 'in_review', 'scheduled', 'draft'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setArticleFilterStatus(st)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold uppercase transition-all ${
                        articleFilterStatus === st ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      {st.replace('_', ' ')}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={articleSearchQuery}
                    onChange={(e) => setArticleSearchQuery(e.target.value)}
                    placeholder="Search by title or category..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Articles Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead>
                    <tr className="bg-gray-50 border-y text-gray-600 font-bold">
                      <th className="p-3 text-start">Headline (EN & UR)</th>
                      <th className="p-3 text-center">Category</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-center">Views</th>
                      <th className="p-3 text-center">Revisions</th>
                      <th className="p-3 text-center">Date</th>
                      <th className="p-3 text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredArticles.map((art) => (
                      <tr key={art.id} className="hover:bg-gray-50">
                        <td className="p-3 max-w-md">
                          <div className="font-bold text-gray-900 line-clamp-1">{art.titleEn}</div>
                          <div className="text-gray-500 font-urdu line-clamp-1" dir="rtl">{art.titleUr}</div>
                          <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                            Author: {art.author?.nameEn || 'Editorial'} • {art.readingTimeMin || 3} min read
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span className="bg-gray-100 px-2 py-0.5 rounded-md text-[10px] uppercase font-bold text-gray-700">
                            {art.category}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              art.status === 'published'
                                ? 'bg-emerald-100 text-emerald-800'
                                : art.status === 'in_review'
                                ? 'bg-amber-100 text-amber-800'
                                : art.status === 'scheduled'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            {art.status}
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-gray-700">
                          {art.views?.toLocaleString()}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleOpenVersions(art)}
                            className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold font-mono hover:bg-blue-100 transition-colors"
                          >
                            v{art.versions?.length ? art.versions.length + 1 : 1}
                          </button>
                        </td>
                        <td className="p-3 text-center text-gray-400 font-mono text-[11px] whitespace-nowrap">
                          {new Date(art.publishedAt || art.updatedAt || Date.now()).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-end space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => { setFormData(art); setEditingArticleId(art.id); setActiveModule('composer'); }}
                            className="p-1.5 bg-gray-100 hover:bg-emerald-100 text-emerald-800 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteArticle(art.id)}
                            className="p-1.5 bg-gray-100 hover:bg-red-100 text-red-700 rounded-lg transition-colors"
                            title="Delete"
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

          {/* ================= MODULE 3: BILINGUAL COMPOSER & REVISIONS ================= */}
          {activeModule === 'composer' && (
            <form onSubmit={handleSaveArticle} className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-2xs space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
                <div>
                  <h2 className="text-xl font-black text-gray-900">
                    {editingArticleId ? 'Edit Article & Revision History' : 'Bilingual News Composer'}
                  </h2>
                  <p className="text-xs text-gray-500">
                    Full dual English & Urdu editorial workflow with Gemini AI tools and version snapshots
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {editingArticleId && (
                    <button
                      type="button"
                      onClick={() => handleOpenVersions({ id: editingArticleId } as any)}
                      className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Version Snapshots</span>
                    </button>
                  )}

                  {/* Language Switch Tabs for Content Entry */}
                  <div className="flex items-center bg-gray-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setComposerLang('ur')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        composerLang === 'ur' ? 'bg-emerald-700 text-white shadow-xs' : 'text-gray-700'
                      }`}
                    >
                      اردو ورژن (Urdu)
                    </button>
                    <button
                      type="button"
                      onClick={() => setComposerLang('en')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        composerLang === 'en' ? 'bg-emerald-700 text-white shadow-xs' : 'text-gray-700'
                      }`}
                    >
                      English Version
                    </button>
                  </div>
                </div>
              </div>

              {/* Gemini AI Editorial Assistant Toolbar */}
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-700" />
                  <span className="text-xs font-black text-emerald-950">Gemini AI Editorial Assistant:</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      setAiLoading(true);
                      try {
                        const res = await fetch('/api/admin/ai/suggest-headline', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            topic: formData.category,
                            summary: composerLang === 'ur' ? formData.summaryUr : formData.summaryEn,
                            language: composerLang,
                          }),
                        }).then(r => r.json());
                        if (res.success) notify(`AI Headline Suggestions:\n\n${res.text}`);
                      } finally { setAiLoading(false); }
                    }}
                    className="px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-900 rounded-xl text-xs font-bold border border-emerald-300 transition-colors"
                  >
                    ✨ Suggest Headlines
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      const text = composerLang === 'en' ? formData.contentEn : formData.contentUr;
                      const target = composerLang === 'en' ? 'ur' : 'en';
                      if (!text) { notify('Enter content to translate', 'error'); return; }
                      setAiLoading(true);
                      try {
                        const res = await fetch('/api/admin/ai/translate', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ text, targetLanguage: target }),
                        }).then(r => r.json());
                        if (res.success) {
                          if (target === 'ur') setFormData(p => ({ ...p, contentUr: res.translation }));
                          else setFormData(p => ({ ...p, contentEn: res.translation }));
                          notify(`Translated into ${target.toUpperCase()}! Check other tab.`);
                        }
                      } finally { setAiLoading(false); }
                    }}
                    className="px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-900 rounded-xl text-xs font-bold border border-emerald-300 transition-colors"
                  >
                    ✨ Auto-Translate to {composerLang === 'en' ? 'Urdu' : 'English'}
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      setAiLoading(true);
                      try {
                        const res = await fetch('/api/admin/ai/seo-tags', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            title: formData.titleEn || formData.titleUr,
                            content: formData.contentEn || formData.contentUr,
                          }),
                        }).then(r => r.json());
                        if (res.success && res.seo?.tags) {
                          setFormData(p => ({ ...p, tags: res.seo.tags }));
                          notify(`SEO Meta Description: "${res.seo.metaDescription}" & Tags Applied!`);
                        }
                      } finally { setAiLoading(false); }
                    }}
                    className="px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-900 rounded-xl text-xs font-bold border border-emerald-300 transition-colors"
                  >
                    ✨ Generate SEO Tags
                  </button>
                </div>
              </div>

              {/* Main Composer Fields Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left 2 Cols: Title, Summary, Body */}
                <div className="md:col-span-2 space-y-4">
                  {composerLang === 'ur' ? (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-gray-800 mb-1">اردو سرخی (Urdu Headline) *</label>
                        <input
                          type="text"
                          dir="rtl"
                          value={formData.titleUr || ''}
                          onChange={(e) => setFormData({ ...formData, titleUr: e.target.value })}
                          placeholder="اہم خبر کی سرخی یہاں لکھیں..."
                          className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-sm font-urdu font-bold focus:ring-2 focus:ring-emerald-600 focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-800 mb-1">اردو خلاصہ (Urdu Summary)</label>
                        <textarea
                          rows={2}
                          dir="rtl"
                          value={formData.summaryUr || ''}
                          onChange={(e) => setFormData({ ...formData, summaryUr: e.target.value })}
                          placeholder="خبر کا جامع خلاصہ..."
                          className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs font-urdu focus:ring-2 focus:ring-emerald-600 focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-800 mb-1">اردو تفصیلی متن (Urdu Full Body)</label>
                        <textarea
                          rows={12}
                          dir="rtl"
                          value={formData.contentUr || ''}
                          onChange={(e) => setFormData({ ...formData, contentUr: e.target.value })}
                          placeholder="پوری خبر کا متن یہاں تحریر کریں..."
                          className="w-full p-4 bg-gray-50 border border-gray-300 rounded-xl text-sm font-urdu leading-relaxed focus:ring-2 focus:ring-emerald-600 focus:bg-white"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-gray-800 mb-1">English Headline *</label>
                        <input
                          type="text"
                          value={formData.titleEn || ''}
                          onChange={(e) => setFormData({ ...formData, titleEn: e.target.value })}
                          placeholder="Enter complete English headline..."
                          className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-600 focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-800 mb-1">English Summary / Standfirst</label>
                        <textarea
                          rows={2}
                          value={formData.summaryEn || ''}
                          onChange={(e) => setFormData({ ...formData, summaryEn: e.target.value })}
                          placeholder="Concise 2-sentence summary..."
                          className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-800 mb-1">English Full Body Content</label>
                        <textarea
                          rows={12}
                          value={formData.contentEn || ''}
                          onChange={(e) => setFormData({ ...formData, contentEn: e.target.value })}
                          placeholder="Write comprehensive news report..."
                          className="w-full p-4 bg-gray-50 border border-gray-300 rounded-xl text-sm leading-relaxed focus:ring-2 focus:ring-emerald-600 focus:bg-white"
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Right 1 Col: Editorial Settings & Media */}
                <div className="space-y-4 bg-gray-50 p-5 rounded-2xl border border-gray-200 text-xs">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Editorial Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full p-2.5 bg-white border border-gray-300 rounded-xl font-bold"
                    >
                      <option value="pakistan">Pakistan</option>
                      <option value="politics">Politics</option>
                      <option value="business">Business & Economy</option>
                      <option value="sports">Sports & Cricket</option>
                      <option value="education">Education</option>
                      <option value="weather">Weather & Smog</option>
                      <option value="technology">Technology & Mobiles</option>
                      <option value="islamic">Islamic Resources</option>
                      <option value="world">World News</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Workflow Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full p-2.5 bg-white border border-gray-300 rounded-xl font-bold text-emerald-800"
                    >
                      <option value="published">Published</option>
                      <option value="in_review">In Review (Editorial Gate)</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="draft">Draft (Private)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Hero Image URL</label>
                    <input
                      type="text"
                      value={formData.heroImage || ''}
                      onChange={(e) => setFormData({ ...formData, heroImage: e.target.value })}
                      className="w-full p-2.5 bg-white border border-gray-300 rounded-xl"
                    />
                    {formData.heroImage && (
                      <img src={formData.heroImage} alt="Preview" className="w-full h-24 object-cover rounded-xl mt-2 border" />
                    )}
                  </div>

                  <div className="space-y-2 pt-2 border-t">
                    <label className="flex items-center gap-2 font-bold text-gray-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isFeatured}
                        onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                        className="w-4 h-4 text-emerald-600 rounded"
                      />
                      <span>Featured on Homepage</span>
                    </label>

                    <label className="flex items-center gap-2 font-bold text-gray-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isBreaking}
                        onChange={(e) => setFormData({ ...formData, isBreaking: e.target.checked })}
                        className="w-4 h-4 text-red-600 rounded"
                      />
                      <span>Mark Breaking News</span>
                    </label>
                  </div>

                  <div className="pt-4 border-t space-y-2">
                    <button
                      type="submit"
                      className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      <span>{editingArticleId ? 'Save Updates' : 'Publish Article'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { resetComposer(); setActiveModule('articles'); }}
                      className="w-full py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}

          {/* ================= MODULE 4: EDITORIAL WORKFLOW BOARD ================= */}
          {activeModule === 'workflow' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-gray-900">Editorial Workflow Kanban</h2>
                  <p className="text-xs text-gray-500">
                    Governed multi-stage pipeline: Draft → Editorial Review → Approved & Scheduled → Published
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Column 1: Drafts */}
                <div className="bg-gray-100 rounded-3xl p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                    <span className="font-black text-xs uppercase text-gray-700">Drafts</span>
                    <span className="bg-gray-200 text-gray-700 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                      {articles.filter(a => a.status === 'draft').length}
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {articles.filter(a => a.status === 'draft').map(art => (
                      <div key={art.id} className="bg-white p-3 rounded-2xl border shadow-2xs space-y-2 text-xs">
                        <span className="text-[10px] font-bold uppercase text-gray-500">{art.category}</span>
                        <h4 className="font-bold text-gray-900 line-clamp-2">{art.titleEn}</h4>
                        <div className="pt-2 border-t flex justify-between items-center">
                          <button
                            onClick={() => handleUpdateWorkflowStatus(art.id, 'in_review')}
                            className="text-emerald-700 hover:underline font-bold text-[11px]"
                          >
                            Submit for Review →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Column 2: In Review */}
                <div className="bg-amber-50 rounded-3xl p-4 space-y-3 border border-amber-200">
                  <div className="flex items-center justify-between pb-2 border-b border-amber-200">
                    <span className="font-black text-xs uppercase text-amber-900">In Review</span>
                    <span className="bg-amber-200 text-amber-900 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                      {articles.filter(a => a.status === 'in_review').length}
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {articles.filter(a => a.status === 'in_review').map(art => (
                      <div key={art.id} className="bg-white p-3 rounded-2xl border border-amber-200 shadow-2xs space-y-2 text-xs">
                        <span className="text-[10px] font-bold uppercase text-amber-700">{art.category}</span>
                        <h4 className="font-bold text-gray-900 line-clamp-2">{art.titleEn}</h4>
                        <div className="pt-2 border-t flex justify-between items-center">
                          <button
                            onClick={() => handleUpdateWorkflowStatus(art.id, 'published')}
                            className="px-2.5 py-1 bg-emerald-700 text-white rounded-lg font-bold text-[10px]"
                          >
                            Approve & Publish
                          </button>
                          <button
                            onClick={() => handleUpdateWorkflowStatus(art.id, 'draft')}
                            className="text-gray-500 hover:underline text-[10px]"
                          >
                            Return
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Column 3: Scheduled */}
                <div className="bg-blue-50 rounded-3xl p-4 space-y-3 border border-blue-200">
                  <div className="flex items-center justify-between pb-2 border-b border-blue-200">
                    <span className="font-black text-xs uppercase text-blue-900">Scheduled</span>
                    <span className="bg-blue-200 text-blue-900 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                      {articles.filter(a => a.status === 'scheduled').length}
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {articles.filter(a => a.status === 'scheduled').map(art => (
                      <div key={art.id} className="bg-white p-3 rounded-2xl border border-blue-200 shadow-2xs space-y-2 text-xs">
                        <span className="text-[10px] font-bold uppercase text-blue-700">{art.category}</span>
                        <h4 className="font-bold text-gray-900 line-clamp-2">{art.titleEn}</h4>
                        <button
                          onClick={() => handleUpdateWorkflowStatus(art.id, 'published')}
                          className="w-full py-1 bg-blue-700 text-white rounded-lg font-bold text-[10px]"
                        >
                          Publish Now
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Column 4: Published */}
                <div className="bg-emerald-50 rounded-3xl p-4 space-y-3 border border-emerald-200">
                  <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
                    <span className="font-black text-xs uppercase text-emerald-900">Live Published</span>
                    <span className="bg-emerald-200 text-emerald-900 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                      {articles.filter(a => a.status === 'published').length}
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {articles.filter(a => a.status === 'published').slice(0, 6).map(art => (
                      <div key={art.id} className="bg-white p-3 rounded-2xl border border-emerald-200 shadow-2xs space-y-2 text-xs">
                        <span className="text-[10px] font-bold uppercase text-emerald-700">{art.category}</span>
                        <h4 className="font-bold text-gray-900 line-clamp-2">{art.titleEn}</h4>
                        <div className="text-[10px] text-gray-400 font-mono">
                          Views: {art.views?.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= MODULE 5: SEO & SEARCH CONSOLE ================= */}
          {activeModule === 'seo' && (
            <div className="space-y-6">
              {/* SEO Sub-navigation tabs */}
              <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                {[
                  { id: 'console', label: 'Search Console KPI' },
                  { id: 'pages', label: 'Per-Route Metadata' },
                  { id: 'sitemaps', label: 'XML Sitemaps' },
                  { id: 'robots', label: 'Robots.txt' },
                  { id: 'redirects', label: '301/410 Redirects' },
                  { id: 'broken', label: 'Broken Link / 404 Audit' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSeoTab(tab.id as any)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      activeSeoTab === tab.id ? 'bg-emerald-700 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab 1: Search Console Metrics */}
              {activeSeoTab === 'console' && searchConsole && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
                      <span className="text-xs font-bold text-gray-400 uppercase">Total Impressions</span>
                      <div className="text-2xl font-black text-gray-900 font-mono mt-1">{searchConsole.impressions.toLocaleString()}</div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
                      <span className="text-xs font-bold text-gray-400 uppercase">Total Clicks</span>
                      <div className="text-2xl font-black text-emerald-700 font-mono mt-1">{searchConsole.clicks.toLocaleString()}</div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
                      <span className="text-xs font-bold text-gray-400 uppercase">Average CTR</span>
                      <div className="text-2xl font-black text-blue-700 font-mono mt-1">{searchConsole.ctr}%</div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
                      <span className="text-xs font-bold text-gray-400 uppercase">Average Position</span>
                      <div className="text-2xl font-black text-purple-700 font-mono mt-1">{searchConsole.averagePosition}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Top Queries */}
                    <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-2xs space-y-4">
                      <h3 className="font-black text-sm text-gray-900">Top High-Performing Search Queries</h3>
                      <div className="overflow-x-auto text-xs">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b text-gray-400 text-start">
                              <th className="pb-2">Keyword</th>
                              <th className="pb-2 text-center">Clicks</th>
                              <th className="pb-2 text-center">Impressions</th>
                              <th className="pb-2 text-end">Position</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {searchConsole.topQueries?.map((q, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="py-2.5 font-bold text-gray-800">{q.query}</td>
                                <td className="py-2.5 text-center font-mono">{q.clicks.toLocaleString()}</td>
                                <td className="py-2.5 text-center font-mono text-gray-500">{q.impressions.toLocaleString()}</td>
                                <td className="py-2.5 text-end font-mono text-emerald-700 font-bold">{q.position}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Top Landing Pages */}
                    <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-2xs space-y-4">
                      <h3 className="font-black text-sm text-gray-900">Top Organic Landing Pages</h3>
                      <div className="overflow-x-auto text-xs">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b text-gray-400 text-start">
                              <th className="pb-2">Path</th>
                              <th className="pb-2 text-center">Clicks</th>
                              <th className="pb-2 text-center">Impressions</th>
                              <th className="pb-2 text-end">CTR</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {searchConsole.topPages?.map((p, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="py-2.5 font-mono text-gray-800">{p.path}</td>
                                <td className="py-2.5 text-center font-mono">{p.clicks.toLocaleString()}</td>
                                <td className="py-2.5 text-center font-mono text-gray-500">{p.impressions.toLocaleString()}</td>
                                <td className="py-2.5 text-end font-mono text-emerald-700 font-bold">{p.ctr}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Per-Route Metadata */}
              {activeSeoTab === 'pages' && (
                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-2xs space-y-4">
                  <h3 className="font-black text-sm text-gray-900">Configured Portal Route Metadata</h3>
                  <div className="space-y-4">
                    {seoPages.map(page => (
                      <div key={page.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-emerald-800">{page.path}</span>
                          <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-[10px] uppercase font-bold">
                            Schema: {page.schemaType}
                          </span>
                        </div>
                        <div className="font-bold text-gray-900">{page.titleEn}</div>
                        <p className="text-gray-600">{page.metaDescEn}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 3: XML Sitemaps */}
              {activeSeoTab === 'sitemaps' && (
                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-2xs space-y-4 text-xs">
                  <h3 className="font-black text-sm text-gray-900">Dynamic Production XML Sitemaps</h3>
                  <p className="text-gray-600">
                    Sitemaps are generated dynamically on every incoming crawler request with real-time published articles and canonical links.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
                      <div className="font-bold text-gray-900 text-sm">Main Sitemap Index</div>
                      <div className="font-mono text-emerald-700">/sitemap.xml</div>
                      <p className="text-gray-500 text-[11px]">Includes all static portal sections in English & Urdu + all published stories.</p>
                      <a href="/sitemap.xml" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:underline">
                        <span>Inspect Raw XML</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
                      <div className="font-bold text-gray-900 text-sm">Google News XML Sitemap</div>
                      <div className="font-mono text-emerald-700">/sitemap-news.xml</div>
                      <p className="text-gray-500 text-[11px]">Complies with Google News protocol with 48h publication freshness window.</p>
                      <a href="/sitemap-news.xml" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:underline">
                        <span>Inspect Raw XML</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Robots.txt */}
              {activeSeoTab === 'robots' && (
                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-2xs space-y-4 text-xs">
                  <h3 className="font-black text-sm text-gray-900">Production robots.txt Directives</h3>
                  <pre className="bg-gray-900 text-emerald-400 p-4 rounded-2xl font-mono text-xs overflow-x-auto">
{`# Robots.txt for 360Khabarnama (Pakistan Bilingual Digital Portal)
User-agent: *
Allow: /
Allow: /en/
Allow: /ur/
Allow: /assets/
Disallow: /admin/
Disallow: /api/
Disallow: /epaper/
Disallow: /en/epaper/
Disallow: /ur/epaper/

# Search Engine Sitemaps
Sitemap: https://360khabarnama.com/sitemap.xml
Sitemap: https://360khabarnama.com/sitemap-news.xml`}
                  </pre>
                </div>
              )}

              {/* Tab 5: Redirects */}
              {activeSeoTab === 'redirects' && (
                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-2xs space-y-4 text-xs">
                  <div className="flex items-center justify-between border-b pb-3">
                    <h3 className="font-black text-sm text-gray-900">URL Redirect Rules (301, 302, 410)</h3>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {redirectRules.map(rule => (
                      <div key={rule.id} className="py-3 flex items-center justify-between gap-4">
                        <div>
                          <span className="font-mono font-bold text-gray-900">{rule.sourcePath}</span>
                          <span className="mx-2 text-gray-400">→</span>
                          <span className="font-mono text-emerald-700">{rule.targetPath}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="bg-gray-100 font-mono px-2 py-0.5 rounded text-[10px] font-bold">
                            HTTP {rule.statusCode}
                          </span>
                          <span className="text-gray-400 text-[10px] font-mono">{rule.hits} hits</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 6: Broken Links */}
              {activeSeoTab === 'broken' && (
                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-2xs space-y-4 text-xs">
                  <h3 className="font-black text-sm text-gray-900">Broken Link & 404 Inquiries</h3>
                  <div className="divide-y divide-gray-100">
                    {brokenLinks.map(b => (
                      <div key={b.id} className="py-3 flex items-center justify-between">
                        <div>
                          <div className="font-mono font-bold text-red-600">{b.path}</div>
                          <div className="text-gray-400 text-[10px] mt-0.5">Referrer: {b.referrer || 'Direct'} • Hits: {b.hits}</div>
                        </div>
                        <button
                          onClick={async () => {
                            await fetch(`/api/admin/seo/broken-links/${b.id}/resolve`, { method: 'POST' });
                            loadModuleData('seo');
                            notify('Broken link resolved');
                          }}
                          className="px-3 py-1 bg-gray-100 hover:bg-emerald-100 text-emerald-800 rounded-lg font-bold"
                        >
                          Resolve
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= MODULE 6: ADVERTISING MANAGER ================= */}
          {activeModule === 'ads' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-gray-900">Advertising & Monetization Manager</h2>
                  <p className="text-xs text-gray-500">Configure direct commercial campaigns and programmatic AdSense units</p>
                </div>
                <button
                  onClick={() => setNewCampaignModal(true)}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Campaign</span>
                </button>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-2 border-b pb-2 text-xs">
                <button
                  onClick={() => setActiveAdTab('campaigns')}
                  className={`px-4 py-1.5 rounded-xl font-bold transition-all ${
                    activeAdTab === 'campaigns' ? 'bg-emerald-700 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Direct Campaigns ({adCampaigns.length})
                </button>
                <button
                  onClick={() => setActiveAdTab('placements')}
                  className={`px-4 py-1.5 rounded-xl font-bold transition-all ${
                    activeAdTab === 'placements' ? 'bg-emerald-700 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Ad Placement Slots ({adPlacements.length})
                </button>
              </div>

              {/* Campaigns Tab */}
              {activeAdTab === 'campaigns' && (
                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-2xs space-y-4 text-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-y text-gray-500 font-bold text-start">
                          <th className="p-3">Campaign & Advertiser</th>
                          <th className="p-3 text-center">Budget (PKR)</th>
                          <th className="p-3 text-center">Impressions</th>
                          <th className="p-3 text-center">Clicks</th>
                          <th className="p-3 text-center">CTR</th>
                          <th className="p-3 text-center">Status</th>
                          <th className="p-3 text-end">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {adCampaigns.map(camp => (
                          <tr key={camp.id} className="hover:bg-gray-50">
                            <td className="p-3">
                              <div className="font-bold text-gray-900">{camp.campaignName}</div>
                              <div className="text-gray-400 text-[11px]">{camp.advertiserName}</div>
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-emerald-800">
                              Rs. {camp.budgetPkr?.toLocaleString()}
                            </td>
                            <td className="p-3 text-center font-mono">{camp.impressions?.toLocaleString()}</td>
                            <td className="p-3 text-center font-mono">{camp.clicks?.toLocaleString()}</td>
                            <td className="p-3 text-center font-mono font-bold text-purple-700">{camp.ctr}%</td>
                            <td className="p-3 text-center">
                              <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] uppercase font-bold">
                                {camp.status}
                              </span>
                            </td>
                            <td className="p-3 text-end">
                              <button
                                onClick={() => handleDeleteCampaign(camp.id)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
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

              {/* Placements Tab */}
              {activeAdTab === 'placements' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  {adPlacements.map(slot => (
                    <div key={slot.id} className="bg-white p-5 rounded-3xl border border-gray-200 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 bg-gray-100 rounded text-gray-700">
                          {slot.dimensions}
                        </span>
                        <button
                          onClick={() => handleTogglePlacement(slot)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${
                            slot.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {slot.enabled ? 'Active' : 'Disabled'}
                        </button>
                      </div>

                      <h4 className="font-bold text-gray-900 text-sm leading-snug">{slot.name}</h4>
                      <p className="text-gray-500 text-[11px]">Provider: {slot.providerType} • Target: {slot.targetDevices}</p>

                      <div className="p-3 bg-gray-50 rounded-xl font-mono text-[11px] flex justify-between border">
                        <span>Impressions: {slot.impressions?.toLocaleString()}</span>
                        <span>Clicks: {slot.clicks?.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================= MODULE 7: LIVE DATA & AUTOMATION (EMBEDDED) ================= */}
          {activeModule === 'automation' && (
            <div className="space-y-4">
              <AutomationManager userRole={userRole} />
            </div>
          )}

          {/* ================= MODULE 8: AI CONTENT STUDIO ================= */}
          {activeModule === 'ai-studio' && (
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-2xs space-y-6">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-emerald-700" />
                    <h2 className="text-xl font-black text-gray-900">Gemini AI Editorial Content Studio</h2>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Source-grounded drafting, multi-platform social packages, morning newsletter dispatch, and objectivity auditing
                  </p>
                </div>
              </div>

              {/* Sub-tabs */}
              <div className="flex items-center gap-2 border-b pb-2 text-xs">
                {[
                  { id: 'draft', label: 'Story Drafting' },
                  { id: 'social', label: 'Social Media Pack' },
                  { id: 'newsletter', label: 'Daily Briefing Newsletter' },
                  { id: 'audit', label: 'Journalistic Quality Auditor' },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setAiStudioTab(t.id as any)}
                    className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                      aiStudioTab === t.id ? 'bg-emerald-700 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Studio Tab 1: Story Drafting */}
              {aiStudioTab === 'draft' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Story Topic / Working Headline *</label>
                      <input
                        type="text"
                        value={aiTopic}
                        onChange={(e) => setAiTopic(e.target.value)}
                        placeholder="e.g. Federal cabinet ratifies new green solar subsidy for 500,000 households"
                        className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Category</label>
                      <select
                        value={aiCategory}
                        onChange={(e) => setAiCategory(e.target.value)}
                        className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl font-bold"
                      >
                        <option value="pakistan">Pakistan</option>
                        <option value="business">Business & Economy</option>
                        <option value="sports">Sports</option>
                        <option value="technology">Technology</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Raw Verified Facts & Official Briefing Snippets
                    </label>
                    <textarea
                      rows={3}
                      value={aiFacts}
                      onChange={(e) => setAiFacts(e.target.value)}
                      placeholder="Paste bullet points from government gazette, press release, or SBP/OGRA notice..."
                      className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs"
                    />
                  </div>

                  <button
                    onClick={handleGenerateStoryDraft}
                    disabled={aiLoading}
                    className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-md transition-all disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{aiLoading ? 'Drafting via Gemini AI...' : 'Generate Full Bilingual Story'}</span>
                  </button>

                  {/* Generated Draft Output */}
                  {aiGeneratedDraft && (
                    <div className="p-5 bg-emerald-50/40 rounded-2xl border border-emerald-200 space-y-4 text-xs">
                      <div className="flex items-center justify-between border-b border-emerald-200 pb-3">
                        <span className="font-bold text-emerald-950 text-sm">Generated Bilingual Article</span>
                        <button
                          onClick={() => handleUseAiDraftInComposer(aiGeneratedDraft)}
                          className="px-4 py-1.5 bg-emerald-700 text-white rounded-xl font-bold text-xs hover:bg-emerald-800 transition-colors"
                        >
                          Send to Composer (Editorial Review) →
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <span className="text-[10px] font-bold uppercase text-gray-500">English Headline & Body</span>
                          <h4 className="font-bold text-sm text-gray-900">{aiGeneratedDraft.titleEn}</h4>
                          <p className="text-gray-700 leading-relaxed">{aiGeneratedDraft.contentEn}</p>
                        </div>
                        <div className="space-y-2" dir="rtl">
                          <span className="text-[10px] font-bold uppercase text-gray-500">اردو سرخی و متن</span>
                          <h4 className="font-bold text-sm text-gray-900 font-urdu">{aiGeneratedDraft.titleUr}</h4>
                          <p className="text-gray-700 leading-relaxed font-urdu">{aiGeneratedDraft.contentUr}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Studio Tab 2: Social Media Pack */}
              {aiStudioTab === 'social' && (
                <div className="space-y-4 text-xs">
                  <p className="text-gray-600">
                    Instantly creates tailored social media posts for Twitter (X), Facebook, WhatsApp Broadcast, and Instagram based on the current story.
                  </p>
                  <button
                    onClick={handleGenerateSocialCaptions}
                    disabled={aiLoading}
                    className="px-5 py-2.5 bg-emerald-700 text-white rounded-xl font-bold hover:bg-emerald-800 transition-colors"
                  >
                    {aiLoading ? 'Generating...' : '✨ Generate Social Media Package'}
                  </button>

                  {socialCaptions && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div className="p-4 bg-gray-50 rounded-2xl border space-y-1">
                        <span className="font-bold text-gray-900">Twitter / X (English)</span>
                        <p className="font-mono text-gray-700">{socialCaptions.twitterEn}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-2xl border space-y-1" dir="rtl">
                        <span className="font-bold text-gray-900">Twitter / X (Urdu)</span>
                        <p className="font-urdu text-gray-700">{socialCaptions.twitterUr}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-2xl border space-y-1">
                        <span className="font-bold text-gray-900">Facebook Post</span>
                        <p className="text-gray-700 whitespace-pre-wrap">{socialCaptions.facebook}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-2xl border space-y-1">
                        <span className="font-bold text-gray-900">WhatsApp Broadcast</span>
                        <p className="font-mono text-gray-700 whitespace-pre-wrap">{socialCaptions.whatsapp}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Studio Tab 3: Daily Newsletter */}
              {aiStudioTab === 'newsletter' && (
                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between">
                    <p className="text-gray-600">
                      Creates the daily morning briefing formatted in responsive bilingual HTML with verified market rates and top news stories.
                    </p>
                    <button
                      onClick={handleGenerateNewsletter}
                      disabled={aiLoading}
                      className="px-4 py-2 bg-emerald-700 text-white rounded-xl font-bold hover:bg-emerald-800 transition-colors"
                    >
                      {aiLoading ? 'Generating...' : '✨ Generate Morning Pulse'}
                    </button>
                  </div>

                  {newsletterPreview && (
                    <div className="p-5 bg-gray-50 rounded-2xl border space-y-3">
                      <div className="font-bold text-gray-900 text-sm">Subject: {newsletterPreview.subjectEn}</div>
                      <div className="font-urdu font-bold text-gray-800" dir="rtl">موضوع: {newsletterPreview.subjectUr}</div>
                      <div className="p-4 bg-white rounded-xl border max-h-60 overflow-y-auto text-xs" dangerouslySetInnerHTML={{ __html: newsletterPreview.htmlEn }} />
                    </div>
                  )}
                </div>
              )}

              {/* Studio Tab 4: Quality Auditor */}
              {aiStudioTab === 'audit' && (
                <div className="space-y-4 text-xs">
                  <p className="text-gray-600">
                    Runs strict journalistic evaluation against sensationalism, checks factual attribution, and assigns a readiness score before publication.
                  </p>
                  <button
                    onClick={handleRunQualityAudit}
                    disabled={aiLoading}
                    className="px-4 py-2 bg-emerald-700 text-white rounded-xl font-bold hover:bg-emerald-800 transition-colors"
                  >
                    {aiLoading ? 'Auditing...' : 'Run Quality & Neutrality Audit'}
                  </button>

                  {qualityAuditResult && (
                    <div className="p-5 bg-gray-50 rounded-2xl border space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900 text-sm">Journalistic Quality Score</span>
                        <span className="text-xl font-black text-emerald-700 font-mono">{qualityAuditResult.overallScore}/100</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
                        <div className="bg-white p-2 rounded-lg border">Readability: {qualityAuditResult.readabilityLevel}</div>
                        <div className="bg-white p-2 rounded-lg border">Tone: {qualityAuditResult.objectivityRating}</div>
                        <div className="bg-white p-2 rounded-lg border">Grammar: {qualityAuditResult.grammarRating}</div>
                      </div>
                      <div className="space-y-1">
                        <span className="font-bold text-gray-800 block">Editorial Recommendations:</span>
                        {qualityAuditResult.recommendations?.map((r: string, idx: number) => (
                          <div key={idx} className="text-gray-600">• {r}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================= MODULE 9: MEDIA ASSETS LIBRARY ================= */}
          {activeModule === 'media' && (
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-2xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
                <div>
                  <h2 className="text-xl font-black text-gray-900">Media Assets Library</h2>
                  <p className="text-xs text-gray-500">Central repository of verified press images, charts, and news photographs</p>
                </div>
                <button
                  onClick={() => setNewMediaModal(true)}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Upload Media Asset</span>
                </button>
              </div>

              {/* Grid of media */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                {mediaAssets.map(asset => (
                  <div key={asset.id} className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden group">
                    <img src={asset.url} alt={asset.altTextEn} className="w-full h-32 object-cover" />
                    <div className="p-3 space-y-1">
                      <div className="font-bold text-gray-900 truncate">{asset.captionEn || asset.filename}</div>
                      <div className="text-gray-400 text-[10px] truncate">{asset.filename}</div>
                      <div className="pt-2 flex justify-between items-center text-[10px] text-gray-500">
                        <span>Used in {asset.usageCount || 1} articles</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(asset.url);
                            notify('Image URL copied to clipboard');
                          }}
                          className="text-emerald-700 font-bold hover:underline"
                        >
                          Copy URL
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================= MODULE 10: STAFF & RBAC ================= */}
          {activeModule === 'users' && (
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-2xs space-y-6">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h2 className="text-xl font-black text-gray-900">Staff Accounts & RBAC Permissions</h2>
                  <p className="text-xs text-gray-500">Role-based access control for editors, reporters, SEO, and ad managers</p>
                </div>
                <button
                  onClick={() => setNewUserModal(true)}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Staff Member</span>
                </button>
              </div>

              <div className="overflow-x-auto text-xs">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-y text-gray-500 font-bold text-start">
                      <th className="p-3">Staff Name</th>
                      <th className="p-3">Email</th>
                      <th className="p-3 text-center">Assigned Role</th>
                      <th className="p-3 text-center">Articles Authored</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {adminUsers.map(user => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="p-3">
                          <div className="font-bold text-gray-900">{user.nameEn}</div>
                          <div className="text-gray-400 text-[11px] font-urdu">{user.nameUr}</div>
                        </td>
                        <td className="p-3 font-mono text-gray-600">{user.email}</td>
                        <td className="p-3 text-center">
                          <span className="bg-gray-100 font-bold text-gray-800 px-2.5 py-0.5 rounded-lg text-[10px] uppercase">
                            {user.role}
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-gray-700">{user.articlesCount || 0}</td>
                        <td className="p-3 text-center">
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] uppercase font-bold">
                            {user.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= MODULE 11: AUDIENCE & ALERTS ================= */}
          {activeModule === 'audience' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Broadcast Composer (1 col) */}
                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-2xs space-y-4 text-xs">
                  <h3 className="font-black text-sm text-gray-900">Send Notification Broadcast</h3>
                  <form onSubmit={handleSendBroadcast} className="space-y-3">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Headline (English)</label>
                      <input
                        type="text"
                        value={newNotification.titleEn || ''}
                        onChange={(e) => setNewNotification({ ...newNotification, titleEn: e.target.value })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Headline (Urdu)</label>
                      <input
                        type="text"
                        dir="rtl"
                        value={newNotification.titleUr || ''}
                        onChange={(e) => setNewNotification({ ...newNotification, titleUr: e.target.value })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl font-urdu"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Message Body</label>
                      <textarea
                        rows={3}
                        value={newNotification.bodyEn || ''}
                        onChange={(e) => setNewNotification({ ...newNotification, bodyEn: e.target.value })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send to All Active Subscribers</span>
                    </button>
                  </form>
                </div>

                {/* Subscribers List (2 cols) */}
                <div className="md:col-span-2 bg-white p-6 rounded-3xl border border-gray-200 shadow-2xs space-y-4 text-xs">
                  <div className="flex items-center justify-between border-b pb-3">
                    <h3 className="font-black text-sm text-gray-900">Newsletter Subscribers ({subscribers.length})</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b text-gray-400 text-start">
                          <th className="pb-2">Email</th>
                          <th className="pb-2 text-center">Language</th>
                          <th className="pb-2 text-center">Frequency</th>
                          <th className="pb-2 text-end">Subscribed Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {subscribers.slice(0, 10).map(sub => (
                          <tr key={sub.id} className="hover:bg-gray-50">
                            <td className="py-2.5 font-mono text-gray-900">{sub.email}</td>
                            <td className="py-2.5 text-center uppercase text-[10px] font-bold">{sub.language}</td>
                            <td className="py-2.5 text-center text-gray-500">{sub.frequency}</td>
                            <td className="py-2.5 text-end font-mono text-gray-400">{new Date(sub.subscribedAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= MODULE 12: HOMEPAGE BUILDER ================= */}
          {activeModule === 'homepage' && (
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-2xs space-y-6 text-xs">
              <div className="border-b pb-4">
                <h2 className="text-xl font-black text-gray-900">Homepage Layout & Section Ordering</h2>
                <p className="text-xs text-gray-500">Configure visual layout sections, ticker presence, and featured blocks</p>
              </div>

              <div className="space-y-3 max-w-xl">
                {[
                  { name: 'Breaking News Ticker', desc: 'Real-time flashing red alert ticker across all screens' },
                  { name: 'Hero Top Stories Showcase', desc: 'Main 3-column headline grid with video & image highlights' },
                  { name: 'Live Rates & Utilities Ribbon', desc: 'Gold, currency, fuel, and weather widgets' },
                  { name: 'Live Cricket Scoreboard Ribbon', desc: 'Live match scorecards and PSL tournament updates' },
                  { name: 'Category Exploration Grids', desc: 'Education, business, technology, lifestyle cards' },
                ].map((sec, idx) => (
                  <div key={idx} className="p-4 bg-gray-50 rounded-2xl border flex items-center justify-between">
                    <div>
                      <span className="font-bold text-gray-900 text-sm block">{sec.name}</span>
                      <span className="text-[11px] text-gray-500">{sec.desc}</span>
                    </div>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                      Enabled
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================= MODULE 13: REPORTS CENTER ================= */}
          {activeModule === 'reports' && (
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-2xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
                <div>
                  <h2 className="text-xl font-black text-gray-900">Unified Reports Center</h2>
                  <p className="text-xs text-gray-500">Select any of 12 production reports to inspect, print, or export</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedReportId}
                    onChange={(e) => {
                      setSelectedReportId(e.target.value);
                      loadReport(e.target.value);
                    }}
                    className="p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold"
                  >
                    <option value="editorial-activity">Editorial Velocity Report</option>
                    <option value="pageviews-traffic">Pageviews & Category Reach</option>
                    <option value="ads-monetization">Ad Monetization & Yield</option>
                    <option value="automation-sync">Automation SLA & Health</option>
                    <option value="search-console-seo">Google Search Console SEO</option>
                    <option value="user-audit-trail">Staff Security Audit Trail</option>
                    <option value="education-results">BISE Exam Inquiries Traffic</option>
                    <option value="market-data-volatility">Financial Market Volatility</option>
                    <option value="subscriber-growth">Newsletter Subscriber Growth</option>
                    <option value="broken-links-404">Broken Links & 404 Inquiries</option>
                    <option value="ai-efficiency">Gemini AI Engine Productivity</option>
                    <option value="category-performance">Category Engagement Matrix</option>
                  </select>
                  <button
                    onClick={() => window.print()}
                    className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Print / Export</span>
                  </button>
                </div>
              </div>

              {reportLoading ? (
                <div className="p-12 text-center text-xs font-bold text-gray-500 animate-pulse">
                  Loading report data...
                </div>
              ) : (
                reportData && (
                  <div className="space-y-4 text-xs">
                    <div className="p-4 bg-gray-50 rounded-2xl border flex justify-between items-center">
                      <div>
                        <div className="font-bold text-sm text-gray-900">{reportData.title}</div>
                        <div className="text-[10px] text-gray-400 font-mono">Generated: {new Date(reportData.generatedAt).toLocaleString()}</div>
                      </div>
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                        Verified
                      </span>
                    </div>

                    <pre className="p-4 bg-gray-900 text-emerald-400 rounded-2xl font-mono text-[11px] max-h-96 overflow-y-auto">
                      {JSON.stringify(reportData, null, 2)}
                    </pre>
                  </div>
                )
              )}
            </div>
          )}

          {/* ================= MODULE 14: GLOBAL SETTINGS ================= */}
          {activeModule === 'settings' && settings && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await fetch('/api/settings', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'x-admin-user': userRole },
                  body: JSON.stringify(settings),
                });
                notify('Settings saved');
              }}
              className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-2xs space-y-6 text-xs"
            >
              <div className="border-b pb-4">
                <h2 className="text-xl font-black text-gray-900">Portal Branding & Settings</h2>
                <p className="text-xs text-gray-500">Configure site name, contact numbers, and analytics tags</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Site Name (English)</label>
                  <input
                    type="text"
                    value={settings.siteNameEn}
                    onChange={(e) => setSettings({ ...settings, siteNameEn: e.target.value })}
                    className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Site Name (Urdu)</label>
                  <input
                    type="text"
                    dir="rtl"
                    value={settings.siteNameUr}
                    onChange={(e) => setSettings({ ...settings, siteNameUr: e.target.value })}
                    className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl font-urdu font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={settings.contactEmail}
                    onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                    className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={settings.contactPhone}
                    onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })}
                    className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-4 border-t">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-md transition-colors"
                >
                  Save Configuration
                </button>
              </div>
            </form>
          )}

          {/* ================= MODULE 15: SYSTEM HEALTH & DIAGNOSTICS ================= */}
          {activeModule === 'health' && (
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-2xs space-y-6 text-xs">
              <div className="border-b pb-4">
                <h2 className="text-xl font-black text-gray-900">System Diagnostics & Audit Ledger</h2>
                <p className="text-xs text-gray-500">Real-time Node.js runtime metrics and historical security audit trail</p>
              </div>

              {systemHealth && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-gray-50 rounded-2xl border">
                    <span className="font-bold text-gray-400 uppercase text-[10px]">Server Uptime</span>
                    <div className="text-xl font-black text-gray-900 font-mono mt-1">{systemHealth.uptimeSeconds}s</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-2xl border">
                    <span className="font-bold text-gray-400 uppercase text-[10px]">Memory RSS</span>
                    <div className="text-xl font-black text-emerald-700 font-mono mt-1">{systemHealth.memoryUsageMb} MB</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-2xl border">
                    <span className="font-bold text-gray-400 uppercase text-[10px]">Node Version</span>
                    <div className="text-xl font-black text-blue-700 font-mono mt-1">{systemHealth.nodeVersion}</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-2xl border">
                    <span className="font-bold text-gray-400 uppercase text-[10px]">Database Storage</span>
                    <div className="text-xl font-black text-purple-700 font-mono mt-1">
                      {Math.round(systemHealth.databaseSizeBytes / 1024)} KB
                    </div>
                  </div>
                </div>
              )}

              {/* Audit logs ledger */}
              <div className="space-y-3 pt-4">
                <h3 className="font-black text-sm text-gray-900">Security Audit Logs ({logs.length})</h3>
                <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                  {logs.map(log => (
                    <div key={log.id} className="py-2.5 flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900">{log.action}</span>
                          <span className="bg-gray-100 px-2 py-0.5 rounded font-mono text-[10px] text-gray-600">{log.user}</span>
                        </div>
                        <p className="text-gray-500 text-[11px] mt-0.5">{log.details}</p>
                      </div>
                      <span className="text-gray-400 font-mono text-[10px] shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Version History Modal */}
      {showVersionsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-black text-base text-gray-900">Article Version Snapshots</h3>
                <p className="text-xs text-gray-500">Restore any previous revision with single-click rollback</p>
              </div>
              <button onClick={() => setShowVersionsModal(false)} className="p-1 text-gray-400 hover:text-gray-700">✕</button>
            </div>

            {activeArticleVersions.length === 0 ? (
              <p className="text-xs text-gray-500 py-6 text-center">No previous revisions recorded for this article yet.</p>
            ) : (
              <div className="space-y-3 text-xs">
                {activeArticleVersions.map(ver => (
                  <div key={ver.versionId} className="p-4 bg-gray-50 rounded-2xl border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-emerald-800">{ver.versionId}</span>
                      <span className="text-gray-400 text-[10px]">{new Date(ver.savedAt).toLocaleString()}</span>
                    </div>
                    <div className="font-bold text-gray-900">{ver.titleEn}</div>
                    <p className="text-gray-600 text-[11px] line-clamp-2">{ver.summaryEn}</p>
                    <div className="pt-2 border-t flex justify-between items-center">
                      <span className="text-[10px] text-gray-400">{ver.changeNote} by {ver.savedBy}</span>
                      <button
                        onClick={() => handleRollbackVersion(ver.versionId)}
                        className="px-3 py-1 bg-emerald-700 text-white rounded-lg font-bold hover:bg-emerald-800 transition-colors"
                      >
                        Restore This Version
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Campaign Modal */}
      {newCampaignModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSaveCampaign} className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-base text-gray-900">Create Direct Ad Campaign</h3>
              <button type="button" onClick={() => setNewCampaignModal(false)} className="text-gray-400">✕</button>
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Campaign Name</label>
              <input
                type="text"
                required
                value={newCampaign.campaignName}
                onChange={(e) => setNewCampaign({ ...newCampaign, campaignName: e.target.value })}
                className="w-full p-2.5 bg-gray-50 border rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Advertiser Name</label>
              <input
                type="text"
                required
                value={newCampaign.advertiserName}
                onChange={(e) => setNewCampaign({ ...newCampaign, advertiserName: e.target.value })}
                className="w-full p-2.5 bg-gray-50 border rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Budget (PKR)</label>
                <input
                  type="number"
                  value={newCampaign.budgetPkr}
                  onChange={(e) => setNewCampaign({ ...newCampaign, budgetPkr: parseInt(e.target.value) || 0 })}
                  className="w-full p-2.5 bg-gray-50 border rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Target Slot</label>
                <select
                  value={newCampaign.placementSlotIds?.[0] || 'slot-1'}
                  onChange={(e) => setNewCampaign({ ...newCampaign, placementSlotIds: [e.target.value] })}
                  className="w-full p-2.5 bg-gray-50 border rounded-xl"
                >
                  <option value="slot-1">Header (728x90)</option>
                  <option value="slot-2">Mid-Feed (970x250)</option>
                  <option value="slot-3">Sidebar (300x250)</option>
                  <option value="slot-4">Article (336x280)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Banner Image URL</label>
              <input
                type="text"
                value={newCampaign.bannerUrl}
                onChange={(e) => setNewCampaign({ ...newCampaign, bannerUrl: e.target.value })}
                className="w-full p-2.5 bg-gray-50 border rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Destination URL</label>
              <input
                type="text"
                value={newCampaign.destinationUrl}
                onChange={(e) => setNewCampaign({ ...newCampaign, destinationUrl: e.target.value })}
                className="w-full p-2.5 bg-gray-50 border rounded-xl"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-md transition-colors"
            >
              Activate Campaign
            </button>
          </form>
        </div>
      )}

      {/* New Media Modal */}
      {newMediaModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleAddMedia} className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-base text-gray-900">Upload Media Asset</h3>
              <button type="button" onClick={() => setNewMediaModal(false)} className="text-gray-400">✕</button>
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Filename</label>
              <input
                type="text"
                required
                value={newMedia.filename}
                onChange={(e) => setNewMedia({ ...newMedia, filename: e.target.value })}
                placeholder="e.g. karachi_stock_exchange.webp"
                className="w-full p-2.5 bg-gray-50 border rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Image URL</label>
              <input
                type="text"
                required
                value={newMedia.url}
                onChange={(e) => setNewMedia({ ...newMedia, url: e.target.value })}
                className="w-full p-2.5 bg-gray-50 border rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Caption (English)</label>
              <input
                type="text"
                value={newMedia.captionEn}
                onChange={(e) => setNewMedia({ ...newMedia, captionEn: e.target.value })}
                className="w-full p-2.5 bg-gray-50 border rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Caption (Urdu)</label>
              <input
                type="text"
                dir="rtl"
                value={newMedia.captionUr}
                onChange={(e) => setNewMedia({ ...newMedia, captionUr: e.target.value })}
                className="w-full p-2.5 bg-gray-50 border rounded-xl font-urdu"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-md transition-colors"
            >
              Save Asset
            </button>
          </form>
        </div>
      )}

      {/* New Staff User Modal */}
      {newUserModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-admin-user': userRole },
                body: JSON.stringify(newUser),
              });
              notify('Staff member created!');
              setNewUserModal(false);
              loadModuleData('users');
            }}
            className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl text-xs"
          >
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-base text-gray-900">Add Staff Account</h3>
              <button type="button" onClick={() => setNewUserModal(false)} className="text-gray-400">✕</button>
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Full Name (English)</label>
              <input
                type="text"
                required
                value={newUser.nameEn}
                onChange={(e) => setNewUser({ ...newUser, nameEn: e.target.value })}
                className="w-full p-2.5 bg-gray-50 border rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Full Name (Urdu)</label>
              <input
                type="text"
                dir="rtl"
                value={newUser.nameUr}
                onChange={(e) => setNewUser({ ...newUser, nameUr: e.target.value })}
                className="w-full p-2.5 bg-gray-50 border rounded-xl font-urdu"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                className="w-full p-2.5 bg-gray-50 border rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Assigned Role</label>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                className="w-full p-2.5 bg-gray-50 border rounded-xl font-bold"
              >
                <option value="Super Admin">Super Admin</option>
                <option value="Managing Editor">Managing Editor</option>
                <option value="Reporter">Reporter</option>
                <option value="SEO Specialist">SEO Specialist</option>
                <option value="Advertising Manager">Advertising Manager</option>
                <option value="Contributor">Contributor</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-md transition-colors"
            >
              Provision Account
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
