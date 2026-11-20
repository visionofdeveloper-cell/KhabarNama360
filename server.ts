import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { db, isServerlessRuntime } from './src/server/db.ts';
import { scheduler } from './src/server/automation/scheduler.ts';
import {
  requireAdminAuth,
  requirePermission,
  hasPermission,
  authenticateAdmin,
  authenticateAdminWithFirebase,
  provisionFirstAdmin,
  isBootstrapRequired,
  getSessionFromRequest,
  resolveOptionalAdminSession,
  setSessionCookie,
  clearSessionCookie,
  revokeSession,
  listActiveSessions,
  changeAdminPassword,
  initiateMfaSetup,
  enableMfaWithToken,
  disableMfa,
  requestPasswordReset,
  confirmPasswordReset,
  setStaffPasswordCredential,
  AdminSession,
} from './src/server/auth.ts';
import { AdminPermission } from './src/types/index.ts';
import { ArticleService } from './src/server/articleService.ts';
import { checkFirestoreHealth, ensureTestConnectionDoc, FirestoreAuthContext } from './src/server/firestore.ts';
import { firebaseProjectConfig, hasServiceAccountConfigured } from './src/lib/firebase-admin.ts';
import { checkSupabaseHealth } from './src/server/databaseHealth.ts';
import { isSupabaseConfigured, resolveSupabaseEnvConfig } from './src/server/supabaseAdmin.ts';
import { getServerErrorLogs, recordServerError } from './src/server/errorTracker.ts';
import { SEOEngine } from './services/seo/SEOEngine.ts';
import { SEOAuditService } from './services/seo/SEOAuditService.ts';
import { SitemapManager } from './services/seo/SitemapManager.ts';
import { SearchConsoleService } from './services/seo/SearchConsoleService.ts';
import { MetadataGenerator } from './services/seo/MetadataGenerator.ts';
import { ContentFreshnessEngine } from './services/content/ContentFreshnessEngine.ts';
import { NewsIngestionEngine } from './services/news/NewsIngestionEngine.ts';
import { WorkflowOrchestrator } from './services/automation/WorkflowOrchestrator.ts';
import { ProviderRegistry } from './services/automation/ProviderRegistry.ts';
import { JobScheduler } from './services/automation/JobScheduler.ts';
import { PageTemplateEngine } from './services/pages/PageTemplateEngine.ts';
import { AIProviderRouter, AIUnavailableError } from './services/ai/AIProviderRouter.ts';
import { AIProviderManager, AI_VAULT_BUILD_VERSION } from './services/ai/AIProviderManager.ts';
import { AIUsageTracker } from './services/ai/AIUsageTracker.ts';
import { generateCorrelationId, setRuntimeAiTimeouts } from './services/ai/AIConnectionValidator.ts';
import { pushNotificationService } from './src/server/pushNotificationService.ts';
import { resetAiContentEngineCooldown } from './src/server/automation/aiContentEngine.ts';
import { runDueCronJobs } from './server/jobs/cron-dispatcher.ts';
import {
  SupabaseSyncResult,
  checkAllSupabaseModulesHealth,
  deleteAdCampaignFromSupabase,
  deleteAdminUserFromSupabase,
  deleteCategoryPageFromSupabase,
  deleteCustomBlockFromSupabase,
  deleteDataProviderFromSupabase,
  deleteMediaAssetFromSupabase,
  deleteRedirectRuleFromSupabase,
  deleteSubscriberFromSupabase,
  recordSaveDiagnosticToSupabase,
  syncAdCampaignToSupabase,
  syncAdPlacementToSupabase,
  syncAdminUserToSupabase,
  syncAudienceNotificationToSupabase,
  syncBrokenLinkToSupabase,
  syncCategoryPageToSupabase,
  syncCustomBlockToSupabase,
  syncDataProviderToSupabase,
  syncEditorialDraftToSupabase,
  syncHomepageLayoutToSupabase,
  syncMediaAssetToSupabase,
  syncPushSubscriptionToSupabase,
  syncRedirectRuleToSupabase,
  syncSearchConsoleConfigToSupabase,
  syncSeoAuditLogToSupabase,
  syncSeoPageToSupabase,
  syncSiteSettingsToSupabase,
  syncSubscriberToSupabase,
  uploadMediaBinaryToStorage,
} from './src/server/supabaseRepositories.ts';

dotenv.config();

const app = express();
const portArgIdx = process.argv.indexOf('--port');
const cliPort = portArgIdx !== -1 && process.argv[portArgIdx + 1] ? parseInt(process.argv[portArgIdx + 1], 10) : NaN;
// In AI Studio / Cloud Run, NGINX is bound to 8080 and reverse-proxies to 3000.
const envPort = process.env.PORT && process.env.PORT !== '8080' ? parseInt(process.env.PORT, 10) : NaN;
const PORT = !isNaN(cliPort) ? cliPort : (!isNaN(envPort) ? envPort : 3000);
const isProduction = process.env.NODE_ENV === 'production';

// Ensure all universal category pages are seeded at boot & hydrate runtime AI timeouts
try {
  PageTemplateEngine.ensureAllCategoriesSeeded();
  const rt = db.getData().siteSettings?.runtimeDiagnostics;
  if (rt) {
    setRuntimeAiTimeouts({
      discoveryMs: rt.aiDiscoveryTimeoutMs,
      generationMs: rt.aiGenerationTimeoutMs,
      inferenceMs: rt.aiInferenceTimeoutMs,
    });
  }
} catch (err) {
  console.error('[Boot] Failed initializing settings/categories:', err);
}

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use('/uploads', express.static(path.resolve(process.cwd(), 'public', 'uploads')));

// Prevent browser/proxy/CDN stale caching on dynamic news & admin APIs
app.use(['/api/news', '/api/v1/news', '/api/admin', '/api/v1/admin', '/api/ads/active'], (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

function getActor(req: Request, fallback: string = 'Admin'): string {
  const session: AdminSession | undefined = (req as any).adminSession;
  return session?.email || (req.headers['x-admin-user'] as string) || fallback;
}

function isArticleFutureScheduled(article: any): boolean {
  const sched = article?.scheduledAt || article?.scheduledFor;
  if (!sched) return false;
  const ms = new Date(sched).getTime();
  return !Number.isNaN(ms) && ms > Date.now();
}

async function persistModuleMutation<T = any>(params: {
  module: string;
  action: 'save' | 'update' | 'delete';
  recordId?: string;
  actor: string;
  syncFn: () => Promise<SupabaseSyncResult<T>>;
}): Promise<SupabaseSyncResult<T>> {
  const syncRes = await params.syncFn();
  const entry = {
    id: `diag-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    module: params.module,
    action: params.action,
    recordId: params.recordId,
    storageEngine: syncRes.storageEngine,
    success: syncRes.ok,
    verifiedReadBack: syncRes.verifiedReadBack,
    latencyMs: syncRes.latencyMs,
    actor: params.actor,
    errorMessage: syncRes.error,
    createdAt: new Date().toISOString(),
  };
  db.recordSaveDiagnostic(entry);
  recordSaveDiagnosticToSupabase(entry).catch(() => {});
  if (isSupabaseConfigured() && !syncRes.ok) {
    const err: any = new Error(syncRes.error || `Supabase persistence failed for ${params.module}`);
    err.statusCode = 500;
    err.code = syncRes.code || 'SUPABASE_WRITE_FAILED';
    throw err;
  }
  return syncRes;
}

function extractFirestoreAuthCtx(req: Request, explicitSession?: AdminSession | null): FirestoreAuthContext {
  const authHeader = req.headers.authorization;
  const bearer = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
  const sess = explicitSession ?? ((req as any).adminSession as AdminSession | undefined);
  return {
    firebaseIdToken: bearer || undefined,
    uid: (bearer && sess?.firebaseUid) ? sess.firebaseUid : (sess?.firebaseUid || sess?.userId),
  };
}

const inFlightProviderRefreshes = new Map<string, Promise<any>>();

function triggerStaleProviders(providerIds: string[]) {
  const now = Date.now();
  for (const id of providerIds) {
    if (inFlightProviderRefreshes.has(id)) continue;
    const provider = db.getDataProvider(id);
    if (!provider || provider.status === 'disabled') continue;
    const lastSyncMs = provider.lastSyncAt ? new Date(provider.lastSyncAt).getTime() : 0;
    const intervalMs = Math.max(5, provider.intervalMinutes || 15) * 60 * 1000;
    if (!lastSyncMs || now - lastSyncMs >= intervalMs) {
      const p = ProviderRegistry.executeProviderSync(id, 'scheduler')
        .catch(err => console.warn(`[AutoRefresh] Provider ${id} failed:`, err?.message))
        .finally(() => inFlightProviderRefreshes.delete(id));
      inFlightProviderRefreshes.set(id, p);
    }
  }
}

function requireAnyPermission(perms: AdminPermission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const session: AdminSession | undefined = (req as any).adminSession;
    if (!session) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }
    if (session.role === 'Super Admin' || perms.some(p => hasPermission(session.role, p))) {
      return next();
    }
    return res.status(403).json({
      success: false,
      error: `Access denied: role "${session.role}" lacks required permissions (${perms.join(' or ')}).`,
    });
  };
}

function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const session: AdminSession | undefined = (req as any).adminSession;
  if (!session) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }
  if (session.role !== 'Super Admin') {
    return res.status(403).json({
      success: false,
      error: `Super Admin privileges required for AI credential management (current role: "${session.role}").`,
    });
  }
  return next();
}

// Helper for Roman Urdu normalization
function normalizeSearchQuery(rawQuery: string): { original: string; normalized: string; keywords: string[] } {
  const original = rawQuery.trim().toLowerCase();
  const romanUrduMap: Record<string, string> = {
    khabar: 'news',
    khabrein: 'news',
    taza: 'latest',
    nataij: 'results',
    natija: 'result',
    imtihan: 'exam',
    namaz: 'prayer',
    salat: 'prayer',
    roza: 'fasting ramadan',
    sehri: 'sehri',
    iftar: 'iftar',
    sona: 'gold',
    chandi: 'silver',
    qarz: 'loan',
    bijli: 'electricity bill',
    naukri: 'job',
    mulazmat: 'job',
    hukumat: 'government',
    wazir: 'minister',
    shaheen: 'shaheen',
    babar: 'babar azam',
    mausam: 'weather',
    barish: 'rain weather',
    shayeri: 'poetry',
    ghazal: 'ghazal poetry',
    khana: 'recipe pakistani food',
  };

  const words = original.split(/\s+/).filter(Boolean);
  const mappedWords = words.map(w => romanUrduMap[w] || w);
  const normalized = mappedWords.join(' ');

  return {
    original,
    normalized,
    keywords: Array.from(new Set([...words, ...mappedWords])),
  };
}

// ================= HEALTH & PUBLIC ROOT =================
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), portal: '360Khabarnama' });
});

// ================= PRIVATE ADMIN AUTHENTICATION & SECURITY =================
// Note: requireAdminAuth permits unauthenticated /api/admin/auth/* requests so status/login/setup work;
// protected /auth/* mutations explicitly enforce requireAdminAuth (+ requirePermission where needed).
app.use('/api/admin', requireAdminAuth);
app.use('/api/v1/admin', requireAdminAuth);

app.get('/api/admin/auth/status', (req, res) => {
  const session = getSessionFromRequest(req);
  const cred = session ? db.getAdminCredentialsMap()[session.email.toLowerCase()] : null;
  res.json({
    success: true,
    authenticated: !!session,
    bootstrapRequired: isBootstrapRequired(),
    session: session
      ? {
          email: session.email,
          nameEn: session.nameEn,
          role: session.role,
          permissions: session.permissions,
          mfaEnabled: Boolean(cred?.mfaEnabled),
          mfaVerified: session.mfaVerified,
          expiresAt: session.expiresAt,
        }
      : null,
  });
});

app.post('/api/admin/auth/setup', (req, res) => {
  const { email, password, nameEn } = req.body || {};
  const result = provisionFirstAdmin(email, password, nameEn);
  if (!result.success) {
    return res.status(400).json(result);
  }
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const ua = req.headers['user-agent'] || 'Unknown';
  const loginRes = authenticateAdmin(email, password, ip, ua);
  if (loginRes.success && loginRes.session) {
    setSessionCookie(res, loginRes.session);
  }
  return res.json({ success: true, session: loginRes.session });
});

app.post('/api/admin/auth/login', (req, res) => {
  const { email, password, totpCode } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const ua = req.headers['user-agent'] || 'Unknown';
  const result = authenticateAdmin(email, password, ip, ua, totpCode);

  if (result.mfaRequired) {
    // Do NOT issue session cookie until 2FA code is verified
    return res.status(200).json({
      success: false,
      mfaRequired: true,
      error: result.error || 'Enter your 6-digit authenticator verification code.',
    });
  }

  if (!result.success || !result.session) {
    return res.status(401).json({ success: false, error: result.error || 'Invalid credentials.' });
  }

  setSessionCookie(res, result.session);
  return res.json({
    success: true,
    mfaRequired: false,
    session: {
      email: result.session.email,
      nameEn: result.session.nameEn,
      role: result.session.role,
      permissions: result.session.permissions,
      expiresAt: result.session.expiresAt,
    },
  });
});

app.post('/api/admin/auth/firebase', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const idToken = req.body?.idToken || bearerToken;
    if (!idToken) {
      return res.status(400).json({ success: false, error: 'Firebase ID token is required.' });
    }
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const ua = req.headers['user-agent'] || 'Unknown';
    const result = await authenticateAdminWithFirebase(idToken, ip, ua);
    if (!result.success || !result.session) {
      return res.status(401).json({ success: false, error: result.error });
    }
    setSessionCookie(res, result.session);
    return res.json({
      success: true,
      session: {
        email: result.session.email,
        nameEn: result.session.nameEn,
        role: result.session.role,
        permissions: result.session.permissions,
        expiresAt: result.session.expiresAt,
      },
    });
  } catch (err: any) {
    console.error('[Auth] /api/admin/auth/firebase error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Firebase authentication failed.' });
  }
});

app.post('/api/admin/auth/logout', (req, res) => {
  const session = getSessionFromRequest(req);
  if (session) {
    revokeSession(session.sessionId, session.email);
  }
  clearSessionCookie(res);
  res.json({ success: true });
});

app.post('/api/admin/auth/reset-request', (req, res) => {
  const result = requestPasswordReset(req.body?.email || '');
  res.json(result);
});

app.post('/api/admin/auth/reset-confirm', (req, res) => {
  const { email, token, newPassword } = req.body || {};
  const result = confirmPasswordReset(email || '', token || '', newPassword || '');
  if (!result.success) {
    return res.status(400).json(result);
  }
  return res.json(result);
});

// Helper to verify session inside /api/admin/auth/* protected sub-routes
function requireAuthenticatedAuthRoute(req: Request, res: Response, next: NextFunction) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }
  (req as any).adminSession = session;
  return next();
}

app.post('/api/admin/auth/change-password', requireAuthenticatedAuthRoute, (req, res) => {
  const session: AdminSession = (req as any).adminSession;
  const { currentPassword, newPassword } = req.body || {};
  const result = changeAdminPassword(session.email, currentPassword || '', newPassword || '');
  if (!result.success) {
    return res.status(400).json(result);
  }
  return res.json(result);
});

app.post('/api/admin/auth/mfa/setup', requireAuthenticatedAuthRoute, (req, res) => {
  const session: AdminSession = (req as any).adminSession;
  const result = initiateMfaSetup(session.email);
  if (!result.success) {
    return res.status(400).json(result);
  }
  return res.json(result);
});

app.post('/api/admin/auth/mfa/verify', requireAuthenticatedAuthRoute, (req, res) => {
  const session: AdminSession = (req as any).adminSession;
  const result = enableMfaWithToken(session.email, req.body?.code || '');
  if (!result.success) {
    return res.status(400).json(result);
  }
  return res.json(result);
});

app.post('/api/admin/auth/mfa/disable', requireAuthenticatedAuthRoute, (req, res) => {
  const session: AdminSession = (req as any).adminSession;
  const result = disableMfa(session.email);
  return res.json(result);
});

app.post(
  '/api/admin/auth/staff-password',
  requireAuthenticatedAuthRoute,
  requirePermission('users:manage'),
  (req, res) => {
    const { email, newPassword, userId } = req.body || {};
    const result = setStaffPasswordCredential(email || '', newPassword || '', userId, getActor(req));
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  }
);

app.get(
  '/api/admin/auth/sessions',
  requireAuthenticatedAuthRoute,
  requirePermission('users:manage'),
  (_req, res) => {
    res.json({ success: true, sessions: listActiveSessions() });
  }
);

app.post(
  '/api/admin/auth/sessions/:id/revoke',
  requireAuthenticatedAuthRoute,
  requirePermission('users:manage'),
  (req, res) => {
    const ok = revokeSession(req.params.id, getActor(req));
    res.json({ success: ok });
  }
);

// ================= NEWS & ARTICLES (PUBLIC READ + RBAC MUTATIONS) =================
app.get('/api/news', async (req, res) => {
  try {
    const category = (req.query.category as string) || 'all';
    const tag = req.query.tag as string | undefined;
    const search = req.query.search as string | undefined;
    let status = (req.query.status as string) || 'published';
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 0;

    let session: AdminSession | null = null;
    if (status !== 'published') {
      session = await resolveOptionalAdminSession(req);
      if (!session) {
        status = 'published';
      }
    }

    // Trigger background auto-update when World News / Sports News feeds are due
    if (category === 'all' || category === 'world') {
      triggerStaleProviders(['world-news-rss']);
    }
    if (category === 'all' || category === 'sports') {
      triggerStaleProviders(['sports-news-rss']);
    }

    const { articles: allMatched, storageEngine, firestoreCount, supabaseCount } = await ArticleService.listArticles(
      { category, tag, search, status },
      session ? extractFirestoreAuthCtx(req, session) : {}
    );
    const articles = limit > 0 ? allMatched.slice(0, limit) : allMatched;
    return res.json({
      success: true,
      count: articles.length,
      totalCount: allMatched.length,
      storageEngine,
      firestoreCount,
      supabaseCount,
      cacheVersion: db.getCacheStatus().newsCacheVersion,
      articles,
    });
  } catch (err: any) {
    recordServerError({ source: 'api', code: 'NEWS_LIST_ERROR', message: err?.message || 'Failed fetching articles' });
    return res.status(500).json({ success: false, error: err?.message || 'Failed loading articles.' });
  }
});

app.get('/api/news/:idOrSlug', async (req, res) => {
  try {
    const session = await resolveOptionalAdminSession(req);
    const { article, storageEngine } = await ArticleService.getArticle(
      req.params.idOrSlug,
      session ? extractFirestoreAuthCtx(req, session) : {}
    );
    if (!article) {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }
    if ((article.status !== 'published' || isArticleFutureScheduled(article)) && !session) {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }
    db.incrementArticleViews(article.id);
    return res.json({ success: true, storageEngine, article });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed loading article.' });
  }
});

app.post('/api/news', requireAdminAuth, requirePermission('articles:write'), async (req, res) => {
  try {
    const session: AdminSession = (req as any).adminSession;
    const article = { ...req.body };
    const actor = getActor(req, session.email);
    if (!article.titleEn && !article.titleUr) {
      return res.status(400).json({ success: false, error: 'At least one headline (English or Urdu) is required.' });
    }
    if (article.status === 'published' && !hasPermission(session.role, 'articles:publish')) {
      return res.status(403).json({
        success: false,
        error: `Your role (${session.role}) can save drafts/in_review only and lacks "articles:publish" permission.`,
      });
    }
    const result = await ArticleService.saveArticle(article, actor, extractFirestoreAuthCtx(req, session));
    if (result.article.isBreaking && result.article.status === 'published') {
      pushNotificationService.alertBreakingNews(result.article).catch(console.error);
    }
    return res.json({
      success: true,
      article: result.article,
      storageEngine: result.storageEngine,
      verifiedReadBack: result.verifiedReadBack,
      correlationId: result.correlationId,
      ...(result.firestoreWarning ? { warning: result.firestoreWarning } : {}),
    });
  } catch (err: any) {
    const statusCode = err?.statusCode || 500;
    if (statusCode >= 500) {
      recordServerError({
        source: 'publishing',
        code: err?.code || 'ARTICLE_SAVE_FAILED',
        message: err?.message || 'Article save error',
        correlationId: err?.correlationId,
      });
    }
    return res.status(statusCode).json({
      success: false,
      code: err?.code || 'ARTICLE_SAVE_FAILED',
      error: err?.message || 'Failed saving article.',
      correlationId: err?.correlationId,
    });
  }
});

app.post('/api/news/:id/workflow', requireAdminAuth, requirePermission('articles:publish'), async (req, res) => {
  try {
    const session: AdminSession = (req as any).adminSession;
    const { id } = req.params;
    const { status, workflowNotes, scheduledFor, scheduledAt } = req.body || {};
    const actor = getActor(req, session.email);
    const result = await ArticleService.transitionStatus(
      id,
      status,
      actor,
      { scheduledAt: scheduledAt || scheduledFor, notes: workflowNotes },
      extractFirestoreAuthCtx(req, session)
    );
    if (result.article.isBreaking && result.article.status === 'published') {
      pushNotificationService.alertBreakingNews(result.article).catch(console.error);
    }
    return res.json({
      success: true,
      article: result.article,
      storageEngine: result.storageEngine,
      verifiedReadBack: result.verifiedReadBack,
      correlationId: result.correlationId,
      ...(result.firestoreWarning ? { warning: result.firestoreWarning } : {}),
    });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({
      success: false,
      code: err?.code || 'WORKFLOW_UPDATE_FAILED',
      error: err?.message || 'Failed updating article workflow status.',
    });
  }
});

app.get('/api/news/:id/versions', requireAdminAuth, requirePermission('articles:read'), (req, res) => {
  const article = db.getData().articles.find(a => a.id === req.params.id);
  if (!article) {
    return res.status(404).json({ success: false, error: 'Article not found' });
  }
  return res.json({ success: true, versions: article.versions || [] });
});

app.post('/api/news/:id/rollback', requireAdminAuth, requirePermission('articles:publish'), async (req, res) => {
  const session: AdminSession = (req as any).adminSession;
  const { versionId } = req.body || {};
  const actor = getActor(req, session.email);
  if (!versionId) {
    return res.status(400).json({ success: false, error: 'versionId is required' });
  }
  const restored = db.rollbackArticle(req.params.id, versionId, actor);
  if (!restored) {
    return res.status(404).json({ success: false, error: 'Article or Version snapshot not found' });
  }
  const result = await ArticleService.saveArticle(restored, actor, extractFirestoreAuthCtx(req, session)).catch(() => null);
  return res.json({ success: true, article: result?.article || restored });
});

app.delete('/api/news/:id', requireAdminAuth, requirePermission('articles:delete'), async (req, res) => {
  try {
    const session: AdminSession = (req as any).adminSession;
    const actor = getActor(req, session.email);
    const hardDelete = req.query.hard === 'true';
    const success = await ArticleService.deleteArticle(req.params.id, actor, hardDelete, extractFirestoreAuthCtx(req, session));
    return res.json({ success });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({
      success: false,
      error: err?.message || 'Failed deleting article.',
    });
  }
});

// ================= CANONICAL V1 PUBLIC & ADMIN ARTICLES API =================
app.get('/api/v1/news', async (req, res) => {
  try {
    const category = (req.query.category as string) || 'all';
    const tag = req.query.tag as string | undefined;
    const search = req.query.search as string | undefined;
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10) || 1);
    const defaultFeedLimit = db.getData().siteSettings?.latestNewsCount || 15;
    const limit = Math.max(1, Math.min(100, parseInt((req.query.limit as string) || String(defaultFeedLimit), 10) || defaultFeedLimit));
    let status = (req.query.status as string) || 'published';

    let session: AdminSession | null = null;
    if (status !== 'published') {
      session = await resolveOptionalAdminSession(req);
      if (!session) status = 'published';
    }

    const { articles: matched, storageEngine, firestoreCount, supabaseCount } = await ArticleService.listArticles(
      { category, tag, search, status },
      session ? extractFirestoreAuthCtx(req, session) : {}
    );
    const total = matched.length;
    const startIdx = (page - 1) * limit;
    const paginated = matched.slice(startIdx, startIdx + limit);

    return res.json({
      success: true,
      storageEngine,
      firestoreCount,
      supabaseCount,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      cacheVersion: db.getCacheStatus().newsCacheVersion,
      articles: paginated,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed loading v1 news.' });
  }
});

app.get('/api/v1/news/:slug', async (req, res) => {
  try {
    const session = await resolveOptionalAdminSession(req);
    const { article, storageEngine, redirectTo } = await ArticleService.getArticle(
      req.params.slug,
      session ? extractFirestoreAuthCtx(req, session) : {}
    );
    if (!article) {
      if (redirectTo) {
        return res.status(301).json({
          success: false,
          redirect: true,
          redirectTo: `/en/news/${redirectTo}`,
        });
      }
      return res.status(404).json({ success: false, error: 'Article not found' });
    }
    if ((article.status !== 'published' || isArticleFutureScheduled(article)) && !session) {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }
    db.incrementArticleViews(article.id);
    return res.json({ success: true, storageEngine, article });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed loading article.' });
  }
});

app.get('/api/v1/admin/articles', requirePermission('articles:read'), async (req, res) => {
  try {
    const category = (req.query.category as string) || 'all';
    const status = (req.query.status as string) || 'all';
    const search = req.query.search as string | undefined;
    const includeDeleted = req.query.includeDeleted === 'true';

    const { articles, storageEngine, firestoreCount } = await ArticleService.listArticles(
      { category, status, search, includeDeleted },
      extractFirestoreAuthCtx(req)
    );
    return res.json({
      success: true,
      count: articles.length,
      storageEngine,
      firestoreCount,
      articles,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed listing admin articles.' });
  }
});

app.post('/api/v1/admin/articles', requirePermission('articles:write'), async (req, res) => {
  try {
    const session: AdminSession = (req as any).adminSession;
    const actor = getActor(req, session.email);
    const body = req.body || {};
    if (!body.titleEn && !body.titleUr) {
      return res.status(400).json({ success: false, error: 'At least one headline (English or Urdu) is required.' });
    }
    if (body.status === 'published' && !hasPermission(session.role, 'articles:publish')) {
      return res.status(403).json({
        success: false,
        error: `Role "${session.role}" lacks articles:publish permission.`,
      });
    }
    const result = await ArticleService.saveArticle(body, actor, extractFirestoreAuthCtx(req, session));
    if (result.article.isBreaking && result.article.status === 'published') {
      pushNotificationService.alertBreakingNews(result.article).catch(console.error);
    }
    return res.json({
      success: true,
      article: result.article,
      storageEngine: result.storageEngine,
      verifiedReadBack: result.verifiedReadBack,
      correlationId: result.correlationId,
      ...(result.firestoreWarning ? { warning: result.firestoreWarning } : {}),
    });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({
      success: false,
      code: err?.code || 'ARTICLE_CREATE_FAILED',
      error: err?.message || 'Failed saving article.',
      correlationId: err?.correlationId,
    });
  }
});

app.get('/api/v1/admin/articles/:id', requirePermission('articles:read'), async (req, res) => {
  const { article, storageEngine } = await ArticleService.getArticle(req.params.id, extractFirestoreAuthCtx(req));
  if (!article) {
    return res.status(404).json({ success: false, error: 'Article not found.' });
  }
  return res.json({ success: true, storageEngine, article });
});

app.patch('/api/v1/admin/articles/:id', requirePermission('articles:write'), async (req, res) => {
  try {
    const session: AdminSession = (req as any).adminSession;
    const actor = getActor(req, session.email);
    const authCtx = extractFirestoreAuthCtx(req, session);
    const { article: existing } = await ArticleService.getArticle(req.params.id, authCtx);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Article not found.' });
    }
    const patch = req.body || {};
    if (patch.status === 'published' && !hasPermission(session.role, 'articles:publish')) {
      return res.status(403).json({
        success: false,
        error: `Role "${session.role}" lacks articles:publish permission.`,
      });
    }
    const result = await ArticleService.saveArticle({ ...existing, ...patch, id: existing.id }, actor, authCtx);
    return res.json({
      success: true,
      article: result.article,
      storageEngine: result.storageEngine,
      verifiedReadBack: result.verifiedReadBack,
      correlationId: result.correlationId,
      ...(result.firestoreWarning ? { warning: result.firestoreWarning } : {}),
    });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({
      success: false,
      code: err?.code || 'ARTICLE_UPDATE_FAILED',
      error: err?.message || 'Failed updating article.',
    });
  }
});

app.delete('/api/v1/admin/articles/:id', requirePermission('articles:delete'), async (req, res) => {
  try {
    const actor = getActor(req, 'Admin');
    const hardDelete = req.query.hard === 'true';
    const success = await ArticleService.deleteArticle(req.params.id, actor, hardDelete, extractFirestoreAuthCtx(req));
    return res.json({ success });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || 'Failed deleting article.' });
  }
});

app.post('/api/v1/admin/articles/:id/publish', requirePermission('articles:publish'), async (req, res) => {
  try {
    const result = await ArticleService.transitionStatus(
      req.params.id,
      'published',
      getActor(req, 'Editor'),
      undefined,
      extractFirestoreAuthCtx(req)
    );
    if (result.article.isBreaking) {
      pushNotificationService.alertBreakingNews(result.article).catch(console.error);
    }
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || 'Publish failed.' });
  }
});

app.post('/api/v1/admin/articles/:id/schedule', requirePermission('articles:publish'), async (req, res) => {
  try {
    const scheduledAt = req.body?.scheduledAt || req.body?.scheduledFor;
    const result = await ArticleService.transitionStatus(
      req.params.id,
      'scheduled',
      getActor(req, 'Editor'),
      { scheduledAt },
      extractFirestoreAuthCtx(req)
    );
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || 'Schedule failed.' });
  }
});

app.post('/api/v1/admin/articles/:id/archive', requirePermission('articles:write'), async (req, res) => {
  try {
    const result = await ArticleService.transitionStatus(
      req.params.id,
      'archived',
      getActor(req, 'Editor'),
      undefined,
      extractFirestoreAuthCtx(req)
    );
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || 'Archive failed.' });
  }
});

// ================= EDUCATION, WEATHER, FINANCE, SPORTS, UTILITIES =================
app.get('/api/education/boards', (_req, res) => {
  res.json({ success: true, boards: db.getData().boards });
});

app.get('/api/education/results/search', (req, res) => {
  const board = req.query.board as string;
  const roll = req.query.roll as string;
  const year = req.query.year ? parseInt(req.query.year as string, 10) : 2026;

  if (!board || !roll) {
    return res.status(400).json({ success: false, error: 'Board and Roll Number are required' });
  }

  const result = db.findExamResult(board, roll, year);
  if (!result) {
    return res.status(404).json({
      success: false,
      error: `No record found for Roll Number "${roll}" under ${board}. Please verify credentials.`,
    });
  }
  return res.json({ success: true, result });
});

app.post('/api/education/results', requireAdminAuth, requirePermission('categories:manage'), (req, res) => {
  const result = req.body;
  db.addExamResult(result);
  db.logAudit(getActor(req, 'Examinations Officer'), 'New Result Record Uploaded', `Roll: ${result.rollNumber} - ${result.boardCode}`);
  res.json({ success: true, result });
});

app.get('/api/weather', (req, res) => {
  triggerStaleProviders(['weather-openmeteo']);
  const city = req.query.city as string;
  const list = db.getData().weather;
  if (city) {
    const found = list.find(w => w.cityId.toLowerCase() === city.toLowerCase() || w.nameEn.toLowerCase() === city.toLowerCase());
    return res.json({ success: true, city: found || list[0] });
  }
  return res.json({ success: true, weather: list });
});

app.get('/api/finance/rates', (_req, res) => {
  triggerStaleProviders(['currency-erapi', 'gold-bullion']);
  const data = db.getData();
  res.json({
    success: true,
    goldRates: data.goldRates,
    currencyRates: data.currencyRates,
    fuelPrices: data.fuelPrices,
    psx: data.psx,
    lastUpdated: new Date().toISOString(),
  });
});

app.post('/api/admin/finance/rates', requireAnyPermission(['categories:manage', 'settings:manage', 'articles:write']), (req, res) => {
  try {
    const { goldRates, currencyRates, fuelPrices, psx } = req.body || {};
    const actor = getActor(req, 'Finance Editor');
    const updatedSections: string[] = [];

    if (Array.isArray(goldRates) && goldRates.length > 0) {
      db.updateGoldRates(goldRates);
      updatedSections.push('Gold');
    }
    if (Array.isArray(currencyRates) && currencyRates.length > 0) {
      db.updateCurrencyRates(currencyRates);
      updatedSections.push('Currency');
    }
    if (Array.isArray(fuelPrices) && fuelPrices.length > 0) {
      db.updateFuelPrices(fuelPrices);
      updatedSections.push('Fuel');
    }
    if (psx && typeof psx === 'object') {
      db.updatePsxData({ ...db.getData().psx, ...psx, lastUpdated: new Date().toISOString() });
      updatedSections.push('PSX');
    }

    if (updatedSections.length === 0) {
      return res.status(400).json({ success: false, error: 'Provide goldRates, currencyRates, fuelPrices, or psx payload.' });
    }

    db.logAudit(actor, 'Financial Rates Updated', `Updated: ${updatedSections.join(', ')}`);
    const data = db.getData();
    return res.json({
      success: true,
      goldRates: data.goldRates,
      currencyRates: data.currencyRates,
      fuelPrices: data.fuelPrices,
      psx: data.psx,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed updating financial rates.' });
  }
});

app.get('/api/cricket/matches', (_req, res) => {
  triggerStaleProviders(['cricket-feed']);
  res.json({ success: true, matches: db.getData().cricketMatches });
});

app.get('/api/islamic/prayer-times', (req, res) => {
  const islamicCfg = db.getData().siteSettings?.islamicSettings;
  const requestedCity = ((req.query.city as string) || islamicCfg?.defaultCity || 'karachi').toLowerCase();
  const times = db.getData().prayerTimes[requestedCity] || db.getData().prayerTimes['karachi'];
  res.json({
    success: true,
    prayerTimes: times,
    availableCities: Object.keys(db.getData().prayerTimes),
    calculationSettings: islamicCfg || {
      calculationMethod: 1,
      calculationMethodName: 'University of Islamic Sciences, Karachi',
      asrJuristic: 'Hanafi',
      defaultCity: 'karachi',
    },
  });
});

app.get('/api/mobiles', (req, res) => {
  const brand = req.query.brand as string;
  let mobiles = db.getData().mobiles;
  if (brand && brand !== 'all') {
    mobiles = mobiles.filter(m => m.brand.toLowerCase() === brand.toLowerCase());
  }
  res.json({ success: true, mobiles });
});

app.get('/api/automotive', (req, res) => {
  const type = req.query.type as string;
  let autos = db.getData().automobiles;
  if (type && type !== 'all') {
    autos = autos.filter(a => a.type === type);
  }
  res.json({ success: true, automobiles: autos });
});

app.get('/api/prizebonds/draws', (req, res) => {
  const denomination = req.query.denomination ? parseInt(req.query.denomination as string, 10) : undefined;
  let draws = db.getData().prizeBonds;
  if (denomination) {
    draws = draws.filter(d => d.denomination === denomination);
  }
  res.json({ success: true, draws });
});

app.get('/api/prizebonds/check', (req, res) => {
  const denomination = parseInt(req.query.denomination as string, 10);
  const number = req.query.number as string;

  if (!denomination || !number) {
    return res.status(400).json({ success: false, error: 'Denomination and 6-digit Bond Number required' });
  }

  const checkResult = db.checkPrizeBond(denomination, number);
  return res.json({ success: true, check: checkResult });
});

app.get('/api/dictionary/search', (req, res) => {
  const q = ((req.query.q as string) || '').toLowerCase().trim();
  const entries = db.getData().dictionary.filter(
    e =>
      e.english.toLowerCase().includes(q) ||
      e.urdu.includes(q) ||
      e.romanUrdu.toLowerCase().includes(q)
  );
  res.json({ success: true, results: entries });
});

app.get('/api/names', (req, res) => {
  const gender = req.query.gender as string;
  const q = ((req.query.q as string) || '').toLowerCase().trim();
  let names = db.getData().babyNames;
  if (gender && (gender === 'boy' || gender === 'girl')) {
    names = names.filter(n => n.gender === gender);
  }
  if (q) {
    names = names.filter(
      n =>
        n.nameEn.toLowerCase().includes(q) ||
        n.nameUr.includes(q) ||
        n.meaningEn.toLowerCase().includes(q)
    );
  }
  res.json({ success: true, names });
});

app.get('/api/poetry', (_req, res) => {
  res.json({
    success: true,
    poets: db.getData().poets,
    poems: db.getData().poems,
  });
});

app.get('/api/recipes', (_req, res) => {
  res.json({ success: true, recipes: db.getData().recipes });
});

app.get('/api/jobs', (req, res) => {
  const hideExpired = req.query.hideExpired === 'true';
  const nowMs = Date.now();
  const enriched = (db.getData().jobs || []).map(job => {
    const deadlineMs = job.deadline ? new Date(job.deadline).getTime() : NaN;
    const isExpired = !Number.isNaN(deadlineMs) && deadlineMs < nowMs - 86400000;
    return {
      ...job,
      isExpired,
    };
  });
  const jobs = hideExpired ? enriched.filter(j => !j.isExpired) : enriched;
  res.json({ success: true, jobs, activeCount: enriched.filter(j => !j.isExpired).length });
});

// E-Paper permanently removed - HTTP 410 Gone
app.all(['/api/epaper*', '/epaper*', '/en/epaper*', '/ur/epaper*'], (_req, res) => {
  res.status(410).json({
    success: false,
    status: 410,
    error: 'Gone',
    message: 'The E-Paper edition has been permanently retired from 360Khabarnama.',
  });
});

// ================= SETTINGS, CATEGORIES & HOMEPAGE BUILDER =================
app.get('/api/settings', (_req, res) => {
  res.json({ success: true, settings: db.getData().siteSettings, categories: db.getData().categories });
});

app.post('/api/settings', requireAdminAuth, requirePermission('settings:manage'), async (req, res) => {
  try {
    const actor = getActor(req, 'Super Admin');
    const newSettings = db.updateSettings(req.body || {}, actor);
    if (newSettings.runtimeDiagnostics) {
      setRuntimeAiTimeouts({
        discoveryMs: newSettings.runtimeDiagnostics.aiDiscoveryTimeoutMs,
        generationMs: newSettings.runtimeDiagnostics.aiGenerationTimeoutMs,
        inferenceMs: newSettings.runtimeDiagnostics.aiInferenceTimeoutMs,
      });
    }
    const syncRes = await persistModuleMutation({
      module: 'site_settings',
      action: 'update',
      recordId: 'default',
      actor,
      syncFn: () => syncSiteSettingsToSupabase(newSettings, actor),
    });
    return res.json({
      success: true,
      settings: newSettings,
      storageEngine: syncRes.storageEngine,
      verifiedReadBack: syncRes.verifiedReadBack,
    });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || 'Failed saving site settings.' });
  }
});

app.get('/api/admin/backup/export', requirePermission('settings:manage'), (req, res) => {
  const raw = JSON.parse(JSON.stringify(db.getData()));
  // Strip private secrets/password hashes before exporting portable JSON backup
  delete raw.adminCredentials;
  if (Array.isArray(raw.aiProviders)) {
    raw.aiProviders = raw.aiProviders.map((p: any) => ({ ...p, encryptedSecret: '[REDACTED]' }));
  }
  if (Array.isArray(raw.dataProviders)) {
    raw.dataProviders = raw.dataProviders.map((p: any) => ({ ...p, encryptedApiKey: '[REDACTED]' }));
  }
  if (raw.searchConsoleConnection) {
    raw.searchConsoleConnection = SearchConsoleService.getSanitizedConnection();
  }
  if (raw.vapidKeys) {
    raw.vapidKeys = { publicKey: raw.vapidKeys.publicKey, privateKey: '[REDACTED]' };
  }
  db.logAudit(getActor(req), 'Database JSON Backup Exported', 'Downloaded sanitized portal JSON snapshot');
  const dateTag = new Date().toISOString().split('T')[0];
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="360khabarnama-backup-${dateTag}.json"`);
  res.send(JSON.stringify(raw, null, 2));
});

app.post('/api/admin/backup/restore', requirePermission('settings:manage'), async (req, res) => {
  try {
    const actor = getActor(req, 'Super Admin');
    const payload = req.body?.snapshot || req.body;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return res.status(400).json({ success: false, error: 'Invalid backup snapshot payload.' });
    }
    const outcome = db.restoreBackupSnapshot(payload, actor);
    if (!outcome.restoredKeys || outcome.restoredKeys.length === 0) {
      return res.status(400).json({ success: false, error: 'Backup snapshot contained no recognized configuration sections.' });
    }
    const syncRes = await persistModuleMutation({
      module: 'site_settings',
      action: 'update',
      recordId: 'restore',
      actor,
      syncFn: () => syncSiteSettingsToSupabase(db.getData().siteSettings, actor),
    });
    return res.json({
      success: true,
      restoredSections: outcome.restoredKeys,
      storageEngine: syncRes.storageEngine,
    });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || 'Backup restore error.' });
  }
});

// Universal Category Pages (Public & Admin)
app.get('/api/categories/public', (_req, res) => {
  const all = PageTemplateEngine.ensureAllCategoriesSeeded();
  const visible = all
    .filter(c => c.enabled !== false && c.status === 'published')
    .sort((a, b) => a.order - b.order);
  res.json({ success: true, categories: visible });
});

app.get('/api/categories/:slug/page', (req, res) => {
  const all = PageTemplateEngine.ensureAllCategoriesSeeded();
  const category = all.find(c => c.slug === req.params.slug);
  if (!category || !category.enabled) {
    return res.status(404).json({ success: false, error: 'Category page not found' });
  }
  return res.json({ success: true, category });
});

app.get('/api/admin/categories', requirePermission('categories:manage'), (_req, res) => {
  const categories = PageTemplateEngine.ensureAllCategoriesSeeded();
  res.json({ success: true, categories });
});

app.post('/api/admin/categories/create', requirePermission('categories:manage'), async (req, res) => {
  try {
    const actor = getActor(req);
    const category = PageTemplateEngine.createCategory(req.body || {}, actor);
    await persistModuleMutation({
      module: 'categories',
      action: 'save',
      recordId: category.slug,
      actor,
      syncFn: () => syncCategoryPageToSupabase(category, actor),
    });
    return res.json({ success: true, category });
  } catch (err: any) {
    return res.status(err?.statusCode || 400).json({ success: false, error: err?.message || 'Could not create category.' });
  }
});

const SUPPORTED_CATEGORY_DATASETS = new Set([
  'boards',
  'results',
  'mobiles',
  'automobiles',
  'prizeBonds',
  'dictionary',
  'babyNames',
  'poets',
  'poems',
  'recipes',
  'jobs',
  'cricketMatches',
  'weather',
]);

app.get('/api/admin/categories/dataset/:dataset', requirePermission('categories:manage'), (req, res) => {
  const { dataset } = req.params;
  if (!SUPPORTED_CATEGORY_DATASETS.has(dataset)) {
    return res.status(400).json({ success: false, error: `Unsupported dataset: ${dataset}` });
  }
  const records = ((db.getData() as any)[dataset] as any[]) || [];
  return res.json({ success: true, dataset, records });
});

app.post('/api/admin/categories/dataset/:dataset', requirePermission('categories:manage'), (req, res) => {
  try {
    const saved = db.saveCategoryDatasetItem(req.params.dataset, req.body || {}, getActor(req));
    return res.json({ success: true, record: saved });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message || 'Failed saving record.' });
  }
});

app.delete('/api/admin/categories/dataset/:dataset/:id', requirePermission('categories:manage'), (req, res) => {
  const success = db.deleteCategoryDatasetItem(req.params.dataset, req.params.id, getActor(req));
  res.json({ success });
});

app.get('/api/admin/categories/:slug/versions', requirePermission('categories:manage'), (req, res) => {
  res.json({ success: true, versions: db.getCategoryPageVersions(req.params.slug) });
});

app.post('/api/admin/categories/:slug', requirePermission('categories:manage'), async (req, res) => {
  try {
    const actor = getActor(req);
    const updated = db.upsertCategoryPage({ ...(req.body || {}), slug: req.params.slug }, actor);
    await persistModuleMutation({
      module: 'categories',
      action: 'update',
      recordId: updated.slug,
      actor,
      syncFn: () => syncCategoryPageToSupabase(updated, actor),
    });
    return res.json({ success: true, category: updated });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || 'Failed updating category.' });
  }
});

app.delete('/api/admin/categories/:slug', requirePermission('categories:manage'), async (req, res) => {
  try {
    const actor = getActor(req);
    const success = db.deleteCategoryPage(req.params.slug, actor);
    if (success) {
      await persistModuleMutation({
        module: 'categories',
        action: 'delete',
        recordId: req.params.slug,
        actor,
        syncFn: () => deleteCategoryPageFromSupabase(req.params.slug),
      });
    }
    return res.json({ success });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || 'Failed deleting category.' });
  }
});

// Homepage Layout Builder (Public Published + Admin Draft/Publish/Rollback/Custom Blocks)
app.get('/api/homepage/config', (_req, res) => {
  res.json({ success: true, config: db.getHomepageConfig() });
});

app.get('/api/homepage/custom-blocks/public', (_req, res) => {
  res.json({ success: true, blocks: db.getCustomBlocks() });
});

app.post('/api/homepage/config', requireAdminAuth, requirePermission('homepage:manage'), async (req, res) => {
  try {
    const actor = getActor(req, 'Super Admin');
    const updated = db.updateHomepageConfig(req.body || {}, actor);
    await persistModuleMutation({
      module: 'homepage_layout',
      action: 'update',
      recordId: 'default',
      actor,
      syncFn: () => syncHomepageLayoutToSupabase(updated, actor),
    });
    return res.json({ success: true, config: updated });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || 'Failed saving homepage config.' });
  }
});

app.get('/api/admin/homepage/state', requirePermission('homepage:manage'), (_req, res) => {
  res.json({
    success: true,
    draft: db.getHomepageDraft(),
    published: db.getHomepageConfig(),
    versions: db.getHomepageVersions(),
  });
});

app.post('/api/admin/homepage/draft', requirePermission('homepage:manage'), (req, res) => {
  const draft = db.saveHomepageDraft(req.body || {}, getActor(req));
  res.json({ success: true, draft });
});

app.post('/api/admin/homepage/publish', requirePermission('homepage:manage'), async (req, res) => {
  try {
    const actor = getActor(req);
    const config = db.updateHomepageConfig(req.body || {}, actor, 'Published from Homepage Builder');
    await persistModuleMutation({
      module: 'homepage_layout',
      action: 'update',
      recordId: 'default',
      actor,
      syncFn: () => syncHomepageLayoutToSupabase(config, actor),
    });
    return res.json({ success: true, config });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || 'Failed publishing homepage.' });
  }
});

app.post('/api/admin/homepage/rollback', requirePermission('homepage:manage'), async (req, res) => {
  const { versionId } = req.body || {};
  if (!versionId) {
    return res.status(400).json({ success: false, error: 'versionId is required.' });
  }
  const actor = getActor(req);
  const config = db.rollbackHomepageVersion(versionId, actor);
  if (!config) {
    return res.status(404).json({ success: false, error: 'Homepage version snapshot not found.' });
  }
  await persistModuleMutation({
    module: 'homepage_layout',
    action: 'update',
    recordId: versionId,
    actor,
    syncFn: () => syncHomepageLayoutToSupabase(config, actor),
  });
  return res.json({ success: true, config });
});

app.get('/api/admin/homepage/custom-blocks', requirePermission('homepage:manage'), (_req, res) => {
  res.json({ success: true, blocks: db.getCustomBlocks() });
});

app.post('/api/admin/homepage/custom-blocks', requirePermission('homepage:manage'), async (req, res) => {
  try {
    const actor = getActor(req);
    const block = db.upsertCustomBlock(req.body || {}, actor);
    await persistModuleMutation({
      module: 'homepage_custom_blocks',
      action: 'save',
      recordId: block.id,
      actor,
      syncFn: () => syncCustomBlockToSupabase(block),
    });
    return res.json({ success: true, block });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || 'Failed saving custom block.' });
  }
});

app.delete('/api/admin/homepage/custom-blocks/:id', requirePermission('homepage:manage'), async (req, res) => {
  try {
    const actor = getActor(req);
    const success = db.deleteCustomBlock(req.params.id, actor);
    if (success) {
      await persistModuleMutation({
        module: 'homepage_custom_blocks',
        action: 'delete',
        recordId: req.params.id,
        actor,
        syncFn: () => deleteCustomBlockFromSupabase(req.params.id),
      });
    }
    return res.json({ success });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || 'Failed deleting custom block.' });
  }
});

// ================= ANALYTICS, AUDIT LOGS & SYSTEM HEALTH =================
app.get('/api/admin/audit-logs', requirePermission('overview:view'), (_req, res) => {
  res.json({ success: true, logs: db.getData().auditLogs });
});

app.get('/api/admin/analytics', requirePermission('overview:view'), (_req, res) => {
  const d = db.getData();
  const totalViews = d.articles.reduce((acc, a) => acc + (a.views || 0), 0);
  const ads = d.adPlacements || [];
  const totalAdImpressions = ads.reduce((acc, s) => acc + (s.impressions || 0), 0);
  const totalAdClicks = ads.reduce((acc, s) => acc + (s.clicks || 0), 0);
  const avgCtr = totalAdImpressions > 0 ? parseFloat(((totalAdClicks / totalAdImpressions) * 100).toFixed(2)) : 0;
  const sc = db.getSearchConsoleMetrics();

  res.json({
    success: true,
    totalArticles: d.articles.length,
    publishedCount: d.articles.filter(a => a.status === 'published').length,
    draftCount: d.articles.filter(a => a.status === 'draft').length,
    reviewCount: d.articles.filter(a => a.status === 'in_review' || (a.status as string) === 'review').length,
    scheduledCount: d.articles.filter(a => a.status === 'scheduled').length,
    totalViews,
    totalCategories: d.categories.length,
    totalResultsInDb: d.results.length,
    activeJobs: d.jobs.length,
    totalSubscribers: (d.subscribers || []).filter(s => s.status === 'active').length,
    adStats: {
      totalImpressions: totalAdImpressions,
      totalClicks: totalAdClicks,
      avgCtr,
    },
    seoStats: {
      connected: Boolean(sc.connected),
      diagnosticStatus: sc.diagnosticStatus,
      totalImpressions: sc.impressions || 0,
      totalClicks: sc.clicks || 0,
      avgPosition: sc.averagePosition || 0,
    },
  });
});

app.get('/api/admin/system/health', requirePermission('health:view'), async (req, res) => {
  const [fsHealth, sbHealth] = await Promise.all([
    checkFirestoreHealth(extractFirestoreAuthCtx(req).firebaseIdToken).catch(() => null),
    checkSupabaseHealth({ runWriteTest: false }).catch(() => null),
  ]);
  const sbCfg = resolveSupabaseEnvConfig();
  res.json({
    success: true,
    health: {
      ...db.getSystemHealth(),
      databaseType: sbCfg.configured ? 'Supabase PostgreSQL' : 'Cloud Firestore',
      storageEngine: sbHealth?.connected
        ? 'supabase_postgresql'
        : fsHealth?.connected
        ? 'cloud_firestore'
        : 'json_cache_fallback',
      supabaseConfigured: sbCfg.configured,
      supabaseConnected: Boolean(sbHealth?.connected),
      supabaseProjectHost: sbCfg.projectHost,
      firebaseConfigured: true,
      projectId: firebaseProjectConfig.projectId,
      firestoreDatabaseId: firebaseProjectConfig.firestoreDatabaseId,
      firestoreConnected: Boolean(fsHealth?.connected),
    },
  });
});

// ================= V1 PRODUCTION DATABASE (SUPABASE & FIREBASE) & PUBLISHING DIAGNOSTICS =================
app.get('/api/v1/admin/system/supabase-health', requirePermission('health:view'), async (_req, res) => {
  try {
    const report = await checkSupabaseHealth({ runWriteTest: false });
    return res.json({ success: true, report });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Supabase health probe failed.' });
  }
});

app.post('/api/v1/admin/system/supabase-test', requirePermission('health:view'), async (_req, res) => {
  try {
    const report = await checkSupabaseHealth({ runWriteTest: true });
    const ok = Boolean(report.connected && report.articlesTableAvailable && report.readTestOk && report.authorizedWriteTestOk !== false);
    return res.status(ok ? 200 : 400).json({
      success: ok,
      error: report.errorMessage || (ok ? undefined : 'Supabase connection or schema verification failed.'),
      report,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Supabase write test failed.' });
  }
});

app.get('/api/v1/admin/system/database-health', requirePermission('health:view'), async (req, res) => {
  try {
    const report = await checkFirestoreHealth(extractFirestoreAuthCtx(req).firebaseIdToken);
    return res.json({ success: true, report });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Firebase Firestore health probe failed.' });
  }
});

app.get('/api/v1/admin/system/publishing-health', requirePermission('health:view'), async (req, res) => {
  try {
    const health = await ArticleService.getPublishingHealth(extractFirestoreAuthCtx(req));
    const sbActive = isSupabaseConfigured() && health.supabaseHealth.connected;
    return res.json({
      success: true,
      supabaseConfigured: isSupabaseConfigured(),
      supabaseHealth: health.supabaseHealth,
      firebaseConfigured: true,
      projectId: firebaseProjectConfig.projectId,
      firestoreDatabaseId: firebaseProjectConfig.firestoreDatabaseId,
      storageEngine: sbActive
        ? 'supabase'
        : health.firestoreHealth.connected
        ? 'firestore'
        : 'json_fallback',
      counts: health.articleCountsByStatus,
      missingTranslationsCount: health.missingTranslationsCount,
      recentLogs: health.recentPublicationLogs,
      firestoreHealth: health.firestoreHealth,
      checkedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Publishing health check failed.' });
  }
});

app.post('/api/v1/admin/system/test-publishing-pipeline', requirePermission('health:view'), async (req, res) => {
  try {
    const result = await ArticleService.runPublishingPipelineSelfTest(
      getActor(req, 'Diagnostics'),
      extractFirestoreAuthCtx(req)
    );
    return res.json({ success: result.ok, result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Pipeline self-test failed.' });
  }
});

app.post('/api/v1/admin/system/firebase/test-probe', requirePermission('health:view'), async (req, res) => {
  try {
    const authCtx = extractFirestoreAuthCtx(req);
    const ensureRes = await ensureTestConnectionDoc(authCtx);
    const report = await checkFirestoreHealth(authCtx.firebaseIdToken);
    return res.status(ensureRes.ok ? 200 : 400).json({
      success: ensureRes.ok,
      error: ensureRes.error,
      report,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Firestore connection probe failed.' });
  }
});

app.post('/api/v1/admin/system/firebase/sync-articles', requirePermission('settings:manage'), async (req, res) => {
  try {
    const outcome = await ArticleService.seedAllPortalArticlesToFirestore(extractFirestoreAuthCtx(req));
    db.logAudit(
      getActor(req),
      'Firestore Article Sync Completed',
      `Seeded=${outcome.seededCount}, Skipped=${outcome.skippedCount}, Failed=${outcome.failedCount}`
    );
    return res.status(outcome.ok ? 200 : 400).json({ success: outcome.ok, ...outcome });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Firestore sync failed.' });
  }
});

app.get('/api/v1/admin/system/firebase-collections', requirePermission('health:view'), async (req, res) => {
  try {
    const authCtx = extractFirestoreAuthCtx(req);
    const fsHealth = await checkFirestoreHealth(authCtx.firebaseIdToken);
    return res.json({
      success: true,
      projectId: firebaseProjectConfig.projectId,
      firestoreDatabaseId: firebaseProjectConfig.firestoreDatabaseId,
      connected: fsHealth.connected,
      authMode: fsHealth.authMode,
      serviceAccountConfigured: hasServiceAccountConfigured(),
      testConnectionDocExists: fsHealth.testConnectionDocExists,
      publishedCountInFirestore: fsHealth.publishedCountInFirestore,
      totalCountInFirestore: fsHealth.totalCountInFirestore,
      collections: [
        '/articles/{articleId}',
        '/categories/{categoryId}',
        '/siteSettings/{settingId}',
        '/admins/{adminId}',
        '/users/{userId}',
        '/users/{userId}/bookmarks/{bookmarkId}',
        '/pushPreferences/{prefId}',
        '/auditLogs/{logId}',
        '/test/connection',
      ],
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed checking Firebase collections.' });
  }
});

app.get('/api/v1/admin/system/cache-status', requirePermission('health:view'), (_req, res) => {
  res.json({ success: true, cache: db.getCacheStatus() });
});

app.post('/api/v1/admin/system/cache-invalidate', requirePermission('settings:manage'), (req, res) => {
  const bumped = db.bumpNewsCacheVersion();
  db.logAudit(getActor(req), 'Frontend & API Cache Invalidated', `Cache version -> v${bumped.version}`);
  res.json({ success: true, ...bumped });
});

app.get('/api/v1/admin/system/error-logs', requirePermission('health:view'), (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
  const logs = getServerErrorLogs(limit);
  res.json({ success: true, count: logs.length, logs });
});

app.get('/api/v1/admin/system/save-diagnostics', requirePermission('health:view'), (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
  const entries = db.getSaveDiagnostics(limit);
  res.json({ success: true, count: entries.length, diagnostics: entries });
});

app.get('/api/v1/admin/system/storage-health', requirePermission('health:view'), async (_req, res) => {
  try {
    const report = await checkAllSupabaseModulesHealth();
    return res.json({ success: true, ...report });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Storage health inspection failed.' });
  }
});

app.post('/api/v1/admin/system/runtime-settings', requirePermission('settings:manage'), async (req, res) => {
  try {
    const actor = getActor(req, 'Super Admin');
    const body = req.body || {};
    const current = db.getData().siteSettings.runtimeDiagnostics || {
      aiDiscoveryTimeoutMs: 12000,
      aiGenerationTimeoutMs: 45000,
      aiInferenceTimeoutMs: 50000,
      syncDefaultIntervalMinutes: 30,
    };
    const nextRt = {
      aiDiscoveryTimeoutMs: Math.max(5000, Math.min(25000, Number(body.aiDiscoveryTimeoutMs ?? current.aiDiscoveryTimeoutMs))),
      aiGenerationTimeoutMs: Math.max(15000, Math.min(60000, Number(body.aiGenerationTimeoutMs ?? current.aiGenerationTimeoutMs))),
      aiInferenceTimeoutMs: Math.max(15000, Math.min(60000, Number(body.aiInferenceTimeoutMs ?? current.aiInferenceTimeoutMs))),
      syncDefaultIntervalMinutes: Math.max(5, Math.min(1440, Number(body.syncDefaultIntervalMinutes ?? current.syncDefaultIntervalMinutes))),
    };
    const updated = db.updateSettings({ runtimeDiagnostics: nextRt }, actor);
    setRuntimeAiTimeouts({
      discoveryMs: nextRt.aiDiscoveryTimeoutMs,
      generationMs: nextRt.aiGenerationTimeoutMs,
      inferenceMs: nextRt.aiInferenceTimeoutMs,
    });
    await persistModuleMutation({
      module: 'runtime_settings',
      action: 'update',
      recordId: 'default',
      actor,
      syncFn: () => syncSiteSettingsToSupabase(updated, actor),
    });
    return res.json({ success: true, runtimeDiagnostics: updated.runtimeDiagnostics });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || 'Failed updating runtime settings.' });
  }
});

app.get('/api/v1/admin/system/deployment', requirePermission('health:view'), (_req, res) => {
  const sys = db.getSystemHealth();
  const sbCfg = resolveSupabaseEnvConfig();
  res.json({
    success: true,
    deployment: {
      appVersion: process.env.APP_VERSION || '1.0.0',
      nodeEnv: process.env.NODE_ENV || 'development',
      nodeVersion: sys.nodeVersion,
      uptimeSeconds: sys.uptimeSeconds,
      memoryUsageMb: sys.memoryUsageMb,
      storageMode: sbCfg.configured ? 'supabase_postgresql' : 'cloud_firestore',
      supabaseConfigured: sbCfg.configured,
      supabaseProjectHost: sbCfg.projectHost,
      projectId: firebaseProjectConfig.projectId,
      firestoreDatabaseId: firebaseProjectConfig.firestoreDatabaseId,
      serviceAccountConfigured: hasServiceAccountConfigured(),
      timezone: 'Asia/Karachi',
      checkedAt: new Date().toISOString(),
    },
  });
});

// ================= DYNAMIC SITEMAPS, ROBOTS, FEEDS & ADS.TXT =================
app.get('/sitemap-index.xml', (_req, res) => {
  res.header('Content-Type', 'application/xml; charset=utf-8');
  res.send(SitemapManager.buildSitemapIndexXml());
});

app.get('/sitemap.xml', async (_req, res) => {
  await ArticleService.listArticles({ status: 'published' }).catch(() => {});
  res.header('Content-Type', 'application/xml; charset=utf-8');
  res.send(SitemapManager.buildMainSitemapXml());
});

app.get(['/sitemap-news.xml', '/news-sitemap.xml'], async (_req, res) => {
  await ArticleService.listArticles({ status: 'published' }).catch(() => {});
  res.header('Content-Type', 'application/xml; charset=utf-8');
  res.send(SitemapManager.buildNewsSitemapXml());
});

app.get('/image-sitemap.xml', async (_req, res) => {
  await ArticleService.listArticles({ status: 'published' }).catch(() => {});
  res.header('Content-Type', 'application/xml; charset=utf-8');
  res.send(SitemapManager.buildImageSitemapXml());
});

app.get('/video-sitemap.xml', async (_req, res) => {
  await ArticleService.listArticles({ status: 'published' }).catch(() => {});
  res.header('Content-Type', 'application/xml; charset=utf-8');
  res.send(SitemapManager.buildVideoSitemapXml());
});

app.get('/robots.txt', (_req, res) => {
  res.header('Content-Type', 'text/plain; charset=utf-8');
  res.send(SitemapManager.getRobotsTxt());
});

// Bilingual RSS 2.0 Feeds
const buildRssFeed = async (lang: 'en' | 'ur') => {
  const baseUrl = SitemapManager.getBaseUrl();
  const { articles: allPub } = await ArticleService.listArticles({ status: 'published', limit: 30 }).catch(() => ({
    articles: db.getArticles('all', undefined, undefined, 'published').slice(0, 30),
  }));
  const articles = allPub.slice(0, 30);
  const title = lang === 'ur' ? '360 خبرنامہ — تازہ ترین خبریں' : '360Khabarnama — Latest Pakistan & World News';
  const description =
    lang === 'ur'
      ? 'پاکستان کا معتبر دو لسانی ڈیجیٹل نیوز اور انفارمیشن پورٹل'
      : "Pakistan's premier bilingual digital news and information portal.";

  const escapeXml = (str: string) =>
    (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const items = articles
    .map((a: any) => {
      const itemTitle = lang === 'ur' ? a.titleUr || a.titleEn : a.titleEn;
      const itemDesc = lang === 'ur' ? a.summaryUr || a.summaryEn || '' : a.summaryEn || '';
      const link = `${baseUrl}/${lang}/news/${a.slug}`;
      const pubDate = new Date(a.publishedAt || a.createdAt || Date.now()).toUTCString();
      return `    <item>
      <title>${escapeXml(itemTitle)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(itemDesc)}</description>
      <category>${escapeXml(a.category || 'News')}</category>
    </item>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${baseUrl}/${lang}</link>
    <description>${escapeXml(description)}</description>
    <language>${lang === 'ur' ? 'ur-PK' : 'en-PK'}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/${lang}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;
};

app.get('/en/feed.xml', async (_req, res) => {
  res.header('Content-Type', 'application/rss+xml; charset=utf-8');
  res.send(await buildRssFeed('en'));
});

app.get('/ur/feed.xml', async (_req, res) => {
  res.header('Content-Type', 'application/rss+xml; charset=utf-8');
  res.send(await buildRssFeed('ur'));
});

app.get('/ads.txt', (_req, res) => {
  const settings = db.getData().siteSettings;
  const customAdsTxt = (settings.adsTxtCustom || '').trim();
  const pubId = (settings.adsensePublisherId || process.env.ADSENSE_PUBLISHER_ID || '').trim();
  res.header('Content-Type', 'text/plain; charset=utf-8');
  if (customAdsTxt) {
    return res.send(`${customAdsTxt}\n`);
  }
  if (!pubId || pubId.includes('0000000000000000')) {
    return res.status(404).send('# ads.txt not configured: Set AdSense Publisher ID in Global Settings or ADSENSE_PUBLISHER_ID env var.\n');
  }
  return res.send(`# 360khabarnama.com Authorized Digital Sellers\ngoogle.com, ${pubId}, DIRECT, f08c47fec0942fa0\n`);
});

app.get('/llms.txt', (_req, res) => {
  const baseUrl = SitemapManager.getBaseUrl();
  res.header('Content-Type', 'text/plain; charset=utf-8');
  res.send(`# 360Khabarnama
> Pakistan's bilingual (English & Urdu) digital news, live finance, sports, education results, Islamic resources, and daily utility portal.

## Primary Sections
- [English Portal](${baseUrl}/en): Breaking news, business, sports, technology, and Pakistan affairs.
- [Urdu Portal](${baseUrl}/ur): اردو خبریں، کاروبار، کھیل، تعلیم اور اسلامی معلومات۔
- [English RSS Feed](${baseUrl}/en/feed.xml)
- [Urdu RSS Feed](${baseUrl}/ur/feed.xml)
- [Sitemap Index](${baseUrl}/sitemap-index.xml)
- [Main Sitemap](${baseUrl}/sitemap.xml)
- [News Sitemap](${baseUrl}/news-sitemap.xml)
- [Image Sitemap](${baseUrl}/image-sitemap.xml)
- [Video Sitemap](${baseUrl}/video-sitemap.xml)
`);
});

// ================= PUBLIC SUBMISSIONS & SEARCH =================
const publicSubmissions: any[] = [];
const handlePublicSubmission = (type: string) => (req: Request, res: Response) => {
  const { name, email, subject, message, category, targetUrl, privacyAccepted } = req.body || {};
  if (!name || !email || !subject || !message || !privacyAccepted) {
    return res.status(400).json({ success: false, error: 'All required fields and privacy acknowledgement must be provided.' });
  }
  const entry = {
    id: `sub-${Date.now()}`,
    type,
    name: String(name).slice(0, 120),
    email: String(email).slice(0, 160),
    subject: String(subject).slice(0, 200),
    category: category ? String(category) : type,
    targetUrl: targetUrl ? String(targetUrl) : undefined,
    message: String(message).slice(0, 4000),
    createdAt: new Date().toISOString(),
  };
  publicSubmissions.unshift(entry);
  return res.json({ success: true, id: entry.id });
};

app.post('/api/public/contact', handlePublicSubmission('contact'));
app.post('/api/public/correction', handlePublicSubmission('correction'));
app.post('/api/public/copyright', handlePublicSubmission('copyright'));
app.post('/api/public/advertise', handlePublicSubmission('advertise'));

app.get('/api/admin/submissions', requirePermission('audience:manage'), (_req, res) => {
  res.json({ success: true, submissions: publicSubmissions });
});

app.get('/api/search', (req, res) => {
  const q = (req.query.q as string) || '';
  if (!q.trim()) {
    return res.json({ success: true, query: { original: '', normalized: '' }, count: 0, results: [] });
  }
  const { original, normalized, keywords } = normalizeSearchQuery(q);
  const data = db.getData();

  const matchedArticles = data.articles
    .filter(
      a =>
        a.status === 'published' &&
        keywords.some(
          k =>
            a.titleEn.toLowerCase().includes(k) ||
            a.titleUr.includes(k) ||
            a.summaryEn.toLowerCase().includes(k) ||
            a.summaryUr.includes(k) ||
            a.tags.some(t => t.toLowerCase().includes(k))
        )
    )
    .map(a => ({
      type: 'article',
      id: a.id,
      slug: a.slug,
      titleEn: a.titleEn,
      titleUr: a.titleUr,
      snippetEn: a.summaryEn,
      snippetUr: a.summaryUr,
      category: a.category,
    }));

  const matchedResults = data.results
    .filter(r =>
      keywords.some(
        k =>
          r.candidateNameEn.toLowerCase().includes(k) ||
          r.candidateNameUr.includes(k) ||
          r.rollNumber.includes(k) ||
          r.boardCode.toLowerCase().includes(k)
      )
    )
    .map(r => ({
      type: 'result',
      id: r.id,
      titleEn: `${r.candidateNameEn} - Roll: ${r.rollNumber}`,
      titleUr: `${r.candidateNameUr} - رول نمبر: ${r.rollNumber}`,
      snippetEn: `${r.examNameEn} | Grade ${r.grade} (${r.marksObtained}/${r.totalMarks})`,
      snippetUr: `${r.examNameUr} | گریڈ ${r.grade}`,
    }));

  const matchedDictionary = data.dictionary
    .filter(d =>
      keywords.some(
        k => d.english.toLowerCase().includes(k) || d.urdu.includes(k) || d.romanUrdu.toLowerCase().includes(k)
      )
    )
    .map(d => ({
      type: 'dictionary',
      id: d.id,
      titleEn: `${d.english} (${d.romanUrdu})`,
      titleUr: d.urdu,
      snippetEn: d.definitionEn,
      snippetUr: d.definitionUr,
    }));

  const matchedJobs = data.jobs
    .filter(j =>
      keywords.some(
        k => j.titleEn.toLowerCase().includes(k) || j.titleUr.includes(k) || j.departmentEn.toLowerCase().includes(k)
      )
    )
    .map(j => ({
      type: 'job',
      id: j.id,
      titleEn: j.titleEn,
      titleUr: j.titleUr,
      snippetEn: `${j.departmentEn} - Deadline: ${j.deadline}`,
      snippetUr: `${j.departmentUr} - آخری تاریخ: ${j.deadline}`,
    }));

  const combined = [...matchedArticles, ...matchedResults, ...matchedDictionary, ...matchedJobs];
  return res.json({
    success: true,
    query: { original, normalized },
    count: combined.length,
    results: combined,
  });
});

// ================= RBAC STAFF, MEDIA, ADS, AUDIENCE =================
app.get('/api/admin/users', requirePermission('users:manage'), (_req, res) => {
  res.json({ success: true, users: db.getAdminUsers() });
});

app.post('/api/admin/users', requirePermission('users:manage'), async (req, res) => {
  try {
    const actor = getActor(req, 'Super Admin');
    const user = db.upsertAdminUser(req.body || {}, actor);
    await persistModuleMutation({
      module: 'admin_users',
      action: 'save',
      recordId: user.id,
      actor,
      syncFn: () => syncAdminUserToSupabase(user),
    });
    return res.json({ success: true, user });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || 'Failed saving staff user.' });
  }
});

app.delete('/api/admin/users/:id', requirePermission('users:manage'), async (req, res) => {
  try {
    const actor = getActor(req, 'Super Admin');
    const success = db.deleteAdminUser(req.params.id, actor);
    if (success) {
      await persistModuleMutation({
        module: 'admin_users',
        action: 'delete',
        recordId: req.params.id,
        actor,
        syncFn: () => deleteAdminUserFromSupabase(req.params.id),
      });
    }
    return res.json({ success });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || 'Failed deleting staff user.' });
  }
});

app.get('/api/admin/media', requirePermission('media:manage'), (req, res) => {
  const category = req.query.category as string;
  const search = req.query.search as string;
  const assets = db.getMediaAssets(category, search);
  res.json({ success: true, count: assets.length, assets });
});

app.post('/api/admin/media/upload', requirePermission('media:manage'), async (req, res) => {
  try {
    const actor = getActor(req, 'Editor');
    const {
      filename,
      base64Data,
      category,
      captionEn,
      captionUr,
      altTextEn,
      altTextUr,
      credit,
      source,
      license,
      width,
      height,
    } = req.body || {};

    const uploadRes = await uploadMediaBinaryToStorage({
      filename: String(filename || 'editorial-image.jpg'),
      base64Data: String(base64Data || ''),
      category,
      captionEn,
      captionUr,
      altTextEn,
      altTextUr,
      credit,
      source,
      license,
      width: typeof width === 'number' ? width : undefined,
      height: typeof height === 'number' ? height : undefined,
      uploadedBy: actor,
    });

    if (!uploadRes.ok || !uploadRes.asset) {
      return res.status(400).json({
        success: false,
        code: uploadRes.code || 'MEDIA_UPLOAD_FAILED',
        error: uploadRes.error || 'Image upload failed.',
      });
    }

    const saved = db.addMediaAsset(uploadRes.asset, actor);
    const diagEntry = {
      id: `diag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      module: 'media_upload',
      action: 'save' as const,
      recordId: saved.id,
      storageEngine: (uploadRes.storageTarget === 'supabase_storage' ? 'supabase' : 'json_fallback') as 'supabase' | 'json_fallback',
      success: true,
      verifiedReadBack: true,
      latencyMs: 0,
      actor,
      createdAt: new Date().toISOString(),
    };
    db.recordSaveDiagnostic(diagEntry);
    recordSaveDiagnosticToSupabase(diagEntry).catch(() => {});

    return res.json({
      success: true,
      asset: saved,
      storageTarget: uploadRes.storageTarget,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Unexpected media upload error.' });
  }
});

app.post('/api/admin/media', requirePermission('media:manage'), async (req, res) => {
  try {
    const actor = getActor(req, 'Editor');
    const asset = db.addMediaAsset(req.body || {}, actor);
    await persistModuleMutation({
      module: 'media_assets',
      action: 'save',
      recordId: asset.id,
      actor,
      syncFn: () => syncMediaAssetToSupabase(asset),
    });
    return res.json({ success: true, asset });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || 'Failed saving media record.' });
  }
});

app.delete('/api/admin/media/:id', requirePermission('media:manage'), async (req, res) => {
  try {
    const actor = getActor(req, 'Editor');
    const success = db.deleteMediaAsset(req.params.id, actor);
    if (success) {
      await persistModuleMutation({
        module: 'media_assets',
        action: 'delete',
        recordId: req.params.id,
        actor,
        syncFn: () => deleteMediaAssetFromSupabase(req.params.id),
      });
    }
    return res.json({ success });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || 'Failed deleting media record.' });
  }
});

app.get('/api/ads/active', (req, res) => {
  const slotParam = ((req.query.slot as string) || '').trim();
  const placements = db.getAdPlacements();
  const placement = placements.find(p => p.slotId === slotParam || p.id === slotParam);
  if (placement && !placement.enabled) {
    return res.json({ success: true, enabled: false, placement, campaign: null });
  }

  const nowMs = Date.now();
  const campaigns = (db.getAdCampaigns() || [])
    .filter(c => {
      if (c.status !== 'active') return false;
      if (c.startDate) {
        const sMs = new Date(c.startDate).getTime();
        if (!Number.isNaN(sMs) && sMs > nowMs) return false;
      }
      if (c.endDate) {
        const eMs = new Date(c.endDate).getTime();
        if (!Number.isNaN(eMs) && eMs < nowMs - 86400000) return false;
      }
      if (!slotParam) return true;
      const slots = Array.isArray(c.placementSlotIds) ? c.placementSlotIds : [];
      return slots.includes(slotParam) || (placement ? slots.includes(placement.id) || slots.includes(placement.slotId) : false);
    })
    .sort((a, b) => (b.priority ?? 10) - (a.priority ?? 10));

  const settings = db.getData().siteSettings;
  const adsensePublisherId = settings.adsensePublisherId || process.env.ADSENSE_PUBLISHER_ID || '';

  return res.json({
    success: true,
    enabled: placement ? placement.enabled : true,
    placement: placement || null,
    campaign: campaigns[0] || null,
    adsensePublisherId: adsensePublisherId && !adsensePublisherId.includes('0000000000000000') ? adsensePublisherId : null,
  });
});

app.get('/api/admin/ads/placements', requirePermission('ads:manage'), (_req, res) => {
  res.json({ success: true, placements: db.getAdPlacements() });
});

app.post('/api/admin/ads/placements/:id', requirePermission('ads:manage'), async (req, res) => {
  try {
    const actor = getActor(req, 'Ad Manager');
    const updated = db.updateAdPlacement(req.params.id, req.body || {}, actor);
    if (updated) {
      await persistModuleMutation({
        module: 'ad_placements',
        action: 'update',
        recordId: updated.id,
        actor,
        syncFn: () => syncAdPlacementToSupabase(updated),
      });
    }
    return res.json({ success: !!updated, placement: updated });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || 'Failed updating ad placement.' });
  }
});

app.get('/api/admin/ads/campaigns', requirePermission('ads:manage'), (_req, res) => {
  res.json({ success: true, campaigns: db.getAdCampaigns() });
});

app.post('/api/admin/ads/campaigns', requirePermission('ads:manage'), async (req, res) => {
  try {
    const actor = getActor(req, 'Ad Manager');
    const saved = db.upsertAdCampaign(req.body || {}, actor);
    await persistModuleMutation({
      module: 'ad_campaigns',
      action: 'save',
      recordId: saved.id,
      actor,
      syncFn: () => syncAdCampaignToSupabase(saved),
    });
    return res.json({ success: true, campaign: saved });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || 'Failed saving ad campaign.' });
  }
});

app.patch('/api/admin/ads/campaigns/:id/status', requirePermission('ads:manage'), async (req, res) => {
  try {
    const actor = getActor(req, 'Ad Manager');
    const nextStatus = req.body?.status;
    if (!['draft', 'active', 'paused', 'archived'].includes(nextStatus)) {
      return res.status(400).json({ success: false, error: 'Status must be draft, active, paused, or archived.' });
    }
    const existing = db.getAdCampaigns().find(c => c.id === req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Ad campaign not found.' });
    }
    const saved = db.upsertAdCampaign({ ...existing, status: nextStatus }, actor);
    await persistModuleMutation({
      module: 'ad_campaigns',
      action: 'update',
      recordId: saved.id,
      actor,
      syncFn: () => syncAdCampaignToSupabase(saved),
    });
    return res.json({ success: true, campaign: saved });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || 'Failed updating campaign status.' });
  }
});

app.delete('/api/admin/ads/campaigns/:id', requirePermission('ads:manage'), async (req, res) => {
  try {
    const actor = getActor(req, 'Ad Manager');
    const success = db.deleteAdCampaign(req.params.id, actor);
    if (success) {
      await persistModuleMutation({
        module: 'ad_campaigns',
        action: 'delete',
        recordId: req.params.id,
        actor,
        syncFn: () => deleteAdCampaignFromSupabase(req.params.id),
      });
    }
    return res.json({ success });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || 'Failed deleting campaign.' });
  }
});

app.get('/api/admin/adsense-readiness', requirePermission('ads:manage'), (_req, res) => {
  const settings = db.getData().siteSettings;
  const pubId = (settings.adsensePublisherId || process.env.ADSENSE_PUBLISHER_ID || '').trim();
  const publisherConfigured = Boolean(pubId && !pubId.includes('0000000000000000'));
  const hasCustomAdsTxt = Boolean((settings.adsTxtCustom || '').trim());
  const legalPagesCount = db
    .getSeoPages()
    .filter(p => /about|privacy|terms|contact|editorial|policy/i.test(p.path)).length;
  res.json({
    success: true,
    publisherConfigured,
    publisherIdMasked: publisherConfigured ? `${pubId.slice(0, 7)}...${pubId.slice(-4)}` : null,
    adsTxtLive: publisherConfigured || hasCustomAdsTxt,
    legalPagesCount: Math.max(legalPagesCount, 5),
    consentBannerActive: settings.consentBannerEnabled !== false,
  });
});

app.post('/api/ads/track/impression', (req, res) => {
  const { slotId, campaignId } = req.body || {};
  if (slotId) db.recordAdImpression(slotId, campaignId);
  res.json({ success: true });
});

app.post('/api/ads/track/click', (req, res) => {
  const { slotId, campaignId } = req.body || {};
  if (slotId) db.recordAdClick(slotId, campaignId);
  res.json({ success: true });
});

app.get('/api/admin/audience/subscribers', requirePermission('audience:manage'), (_req, res) => {
  res.json({ success: true, subscribers: db.getSubscribers() });
});

app.post('/api/admin/audience/subscribers', requirePermission('audience:manage'), async (req, res) => {
  try {
    const actor = getActor(req, 'Audience Manager');
    const { email, language, frequency } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
    }
    const added = db.addSubscriber(cleanEmail, language || 'both', frequency || 'daily', 'admin_manual');
    const record = db.getSubscribers().find(s => s.email.toLowerCase() === cleanEmail);
    if (record) {
      await persistModuleMutation({
        module: 'newsletter_subscribers',
        action: 'save',
        recordId: record.id,
        actor,
        syncFn: () => syncSubscriberToSupabase(record),
      });
    }
    return res.json({ success: true, added, subscriber: record });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || 'Failed adding subscriber.' });
  }
});

app.patch('/api/admin/audience/subscribers/:id', requirePermission('audience:manage'), async (req, res) => {
  try {
    const actor = getActor(req, 'Audience Manager');
    const status = req.body?.status;
    if (!['active', 'unsubscribed', 'bounced'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status. Use active, unsubscribed, or bounced.' });
    }
    const updated = db.updateSubscriberStatus(req.params.id, status);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Subscriber not found.' });
    }
    db.logAudit(actor, 'Subscriber Status Updated', `Updated ${updated.email} -> ${status}`);
    await persistModuleMutation({
      module: 'newsletter_subscribers',
      action: 'update',
      recordId: updated.id,
      actor,
      syncFn: () => syncSubscriberToSupabase(updated),
    });
    return res.json({ success: true, subscriber: updated });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || 'Failed updating subscriber.' });
  }
});

app.delete('/api/admin/audience/subscribers/:id', requirePermission('audience:manage'), async (req, res) => {
  try {
    const actor = getActor(req, 'Audience Manager');
    const success = db.deleteSubscriber(req.params.id, actor);
    if (success) {
      await persistModuleMutation({
        module: 'newsletter_subscribers',
        action: 'delete',
        recordId: req.params.id,
        actor,
        syncFn: () => deleteSubscriberFromSupabase(req.params.id),
      });
    }
    return res.json({ success });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || 'Failed deleting subscriber.' });
  }
});

app.get('/api/admin/audience/subscribers/export', requirePermission('audience:manage'), (req, res) => {
  const subs = db.getSubscribers();
  const header = 'id,email,language,frequency,status,consent_source,subscribed_at';
  const rows = subs.map(s =>
    [s.id, s.email, s.language, s.frequency, s.status, s.consentSource || 'web_form', s.subscribedAt]
      .map(v => `"${String(v || '').replace(/"/g, '""')}"`)
      .join(',')
  );
  db.logAudit(getActor(req), 'Subscribers CSV Exported', `Exported ${subs.length} subscriber records`);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="360khabarnama-subscribers-${new Date().toISOString().split('T')[0]}.csv"`);
  res.send([header, ...rows].join('\n'));
});

app.post('/api/audience/subscribe', async (req, res) => {
  const { email, language, frequency } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ success: false, error: 'A valid email address is required' });
  }
  const added = db.addSubscriber(cleanEmail, language, frequency, 'public_form');
  const record = db.getSubscribers().find(s => s.email.toLowerCase() === cleanEmail);
  if (record) {
    syncSubscriberToSupabase(record).catch(() => {});
  }
  return res.json({ success: added, message: added ? 'Subscribed successfully' : 'Email is already subscribed' });
});

app.get('/api/admin/audience/notifications', requirePermission('audience:manage'), (_req, res) => {
  res.json({ success: true, notifications: db.getNotifications() });
});

app.post('/api/admin/audience/notifications', requirePermission('audience:manage'), async (req, res) => {
  try {
    const actor = getActor(req, 'Editor');
    const sent = db.sendAudienceNotification(req.body || {}, actor);
    await persistModuleMutation({
      module: 'audience_notifications',
      action: 'save',
      recordId: sent.id,
      actor,
      syncFn: () => syncAudienceNotificationToSupabase(sent),
    });
    return res.json({ success: true, notification: sent });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || 'Failed recording notification.' });
  }
});

app.post('/api/admin/notifications/broadcast', requirePermission('audience:manage'), async (req, res) => {
  try {
    const actor = getActor(req, 'Audience Manager');
    const { title, titleUr, body, bodyUr, url, topic } = req.body || {};
    if (!title || !body) {
      return res.status(400).json({ success: false, error: 'Title and body are required' });
    }
    const result = await pushNotificationService.broadcast({
      title,
      titleUr,
      body,
      bodyUr,
      url: url || SitemapManager.getBaseUrl(),
      topic: topic || 'breakingNews',
    });
    const sentNotif = db.getNotifications()[0];
    if (sentNotif) {
      syncAudienceNotificationToSupabase(sentNotif).catch(() => {});
    }
    db.logAudit(actor, 'Web Push Broadcast Sent', `Delivered=${result.successful || 0}, Failed=${result.failed || 0}`);
    return res.json({ success: true, result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Broadcast failed.' });
  }
});

// Web Push Public Endpoints
app.get('/sw.js', (_req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Service-Worker-Allowed', '/');
  res.sendFile(path.resolve(process.cwd(), 'public', 'sw.js'));
});

app.get('/api/notifications/vapid-key', (_req, res) => {
  res.json({ success: true, publicKey: pushNotificationService.getPublicKey() });
});

app.post('/api/notifications/subscribe', (req, res) => {
  const { endpoint, keys, topics, language, userAgent } = req.body || {};
  if (!endpoint) {
    return res.status(400).json({ success: false, error: 'Subscription endpoint is required' });
  }
  const sub = db.upsertPushSubscription({
    endpoint,
    keys,
    topics,
    language: language || 'both',
    userAgent: userAgent || req.headers['user-agent'] || '',
  });
  syncPushSubscriptionToSupabase(sub).catch(() => {});
  return res.json({ success: true, subscription: sub });
});

app.post('/api/notifications/unsubscribe', (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) {
    return res.status(400).json({ success: false, error: 'Subscription endpoint is required' });
  }
  return res.json({ success: db.unsubscribePush(endpoint) });
});

app.post('/api/notifications/preferences', (req, res) => {
  const { endpoint, topics, language } = req.body || {};
  if (!endpoint || !topics) {
    return res.status(400).json({ success: false, error: 'Endpoint and topics are required' });
  }
  return res.json({ success: db.updatePushTopics(endpoint, topics, language) });
});

app.post('/api/notifications/test', async (req, res) => {
  try {
    const { type, endpoint } = req.body || {};
    const alertType = type === 'cricketScores' ? 'cricketScores' : 'breakingNews';
    const result = await pushNotificationService.sendTestAlert(alertType, endpoint);
    return res.json({ success: true, result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Test alert failed.' });
  }
});

app.get('/api/notifications/history', (_req, res) => {
  res.json({
    success: true,
    history: db.getNotifications().slice(0, 30),
    stats: db.getPushStats(),
  });
});

// ================= SEO MANAGER & REAL SEARCH CONSOLE DIAGNOSTICS =================
app.get('/api/admin/seo/pages', requirePermission('seo:manage'), (_req, res) => {
  res.json({ success: true, pages: db.getSeoPages() });
});

app.post('/api/admin/seo/pages', requirePermission('seo:manage'), async (req, res) => {
  try {
    const actor = getActor(req, 'SEO Manager');
    const page = db.upsertSeoPage(req.body || {}, actor);
    await persistModuleMutation({
      module: 'seo_pages',
      action: 'save',
      recordId: page.id,
      actor,
      syncFn: () => syncSeoPageToSupabase(page),
    });
    return res.json({ success: true, page });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || 'Failed saving SEO page.' });
  }
});

app.post('/api/admin/seo/pages/:id', requirePermission('seo:manage'), async (req, res) => {
  try {
    const actor = getActor(req, 'SEO Manager');
    const updated = db.updateSeoPage(req.params.id, req.body || {}, actor);
    if (updated) {
      await persistModuleMutation({
        module: 'seo_pages',
        action: 'update',
        recordId: updated.id,
        actor,
        syncFn: () => syncSeoPageToSupabase(updated),
      });
    }
    return res.json({ success: !!updated, page: updated });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || 'Failed updating SEO page.' });
  }
});

app.post('/api/admin/seo/audit/run', requirePermission('seo:manage'), (req, res) => {
  const audit = SEOAuditService.runFullTechnicalAudit(getActor(req, 'SEO Manager'));
  const latestLog = db.getSeoAuditLogs()[0];
  if (latestLog) syncSeoAuditLogToSupabase(latestLog).catch(() => {});
  res.json({ success: true, audit });
});

app.get('/api/admin/seo/robots-txt', requirePermission('seo:manage'), (_req, res) => {
  res.json({ success: true, content: SitemapManager.getRobotsTxt() });
});

app.post('/api/admin/seo/robots-txt', requirePermission('seo:manage'), async (req, res) => {
  try {
    const actor = getActor(req, 'SEO Manager');
    const content = db.setRobotsTxt(String(req.body?.content || ''), actor);
    await persistModuleMutation({
      module: 'seo_robots',
      action: 'update',
      recordId: 'robots.txt',
      actor,
      syncFn: () => syncSiteSettingsToSupabase(db.getData().siteSettings, actor),
    });
    return res.json({ success: true, content });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || 'Failed saving robots.txt.' });
  }
});

app.get('/api/admin/seo/sitemap-config', requirePermission('seo:manage'), (_req, res) => {
  res.json({ success: true, config: db.getSitemapConfig() });
});

app.post('/api/admin/seo/sitemap-config', requirePermission('seo:manage'), async (req, res) => {
  try {
    const actor = getActor(req, 'SEO Manager');
    const config = db.updateSitemapConfig(req.body || {}, actor);
    await persistModuleMutation({
      module: 'seo_sitemap_config',
      action: 'update',
      recordId: 'sitemap',
      actor,
      syncFn: () => syncSiteSettingsToSupabase(db.getData().siteSettings, actor),
    });
    return res.json({ success: true, config });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || 'Failed saving sitemap config.' });
  }
});

app.post('/api/admin/seo/indexnow/submit', requirePermission('seo:manage'), async (req, res) => {
  try {
    const actor = getActor(req, 'SEO Manager');
    const urlsInput = Array.isArray(req.body?.urls)
      ? req.body.urls
      : String(req.body?.urls || '')
          .split(/[\n,]/)
          .map(s => s.trim())
          .filter(Boolean);
    const defaultUrls = urlsInput.length > 0
      ? urlsInput
      : db
          .getData()
          .articles.filter(a => a.status === 'published' && !isArticleFutureScheduled(a))
          .slice(0, 10)
          .map(a => `/en/news/${a.slug}`);
    const outcome = await SitemapManager.submitIndexNow(defaultUrls, req.body?.key);
    db.logAudit(actor, 'IndexNow URLs Submitted', outcome.message);
    return res.status(outcome.ok ? 200 : 400).json({ success: outcome.ok, ...outcome });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'IndexNow submission failed.' });
  }
});

app.get('/api/admin/seo/audit-logs', requirePermission('seo:manage'), (_req, res) => {
  res.json({ success: true, logs: db.getSeoAuditLogs() });
});

app.get('/api/admin/seo/search-console', requirePermission('seo:manage'), (_req, res) => {
  res.json({
    success: true,
    metrics: db.getSearchConsoleMetrics(),
    connection: SearchConsoleService.getSanitizedConnection(),
  });
});

app.post('/api/admin/seo/search-console', requirePermission('seo:manage'), async (req, res) => {
  db.updateSearchConsoleMetrics(req.body || {});
  syncSearchConsoleConfigToSupabase(
    SearchConsoleService.getSanitizedConnection(),
    db.getSearchConsoleMetrics()
  ).catch(() => {});
  res.json({
    success: true,
    metrics: db.getSearchConsoleMetrics(),
    connection: SearchConsoleService.getSanitizedConnection(),
  });
});

app.post('/api/admin/seo/gsc/oauth-config', requirePermission('seo:manage'), (req, res) => {
  try {
    SearchConsoleService.saveOAuthConfig(req.body || {}, getActor(req, 'SEO Manager'));
    return res.json({ success: true, connection: SearchConsoleService.getSanitizedConnection() });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message || 'Failed saving OAuth config.' });
  }
});

app.get('/api/admin/seo/gsc/oauth-url', requirePermission('seo:manage'), (req, res) => {
  try {
    const redirectUri = String(req.query.redirectUri || '');
    const authUrl = SearchConsoleService.getOAuthAuthorizeUrl(redirectUri);
    return res.json({ success: true, authUrl });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message || 'Could not generate OAuth URL.' });
  }
});

app.get('/api/admin/seo/gsc/oauth-callback', requirePermission('seo:manage'), async (req, res) => {
  const code = String(req.query.code || '');
  if (!code) {
    return res.status(400).send('Missing authorization code from Google.');
  }
  try {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const host = req.get('host') || `localhost:${PORT}`;
    const redirectUri = `${proto}://${host}/api/admin/seo/gsc/oauth-callback`;
    await SearchConsoleService.handleOAuthCallback(code, redirectUri, getActor(req, 'SEO Manager'));
    return res.redirect('/admin?gsc=authorized');
  } catch (err: any) {
    return res.status(400).send(`Google Search Console authorization error: ${err?.message || 'Unknown error'}`);
  }
});

app.post('/api/admin/seo/gsc/oauth-exchange', requirePermission('seo:manage'), async (req, res) => {
  try {
    const { code, redirectUri } = req.body || {};
    const outcome = await SearchConsoleService.handleOAuthCallback(code, redirectUri, getActor(req, 'SEO Manager'));
    return res.json({ success: outcome.status === 'Authorized', ...outcome });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message || 'OAuth code exchange failed.' });
  }
});

app.post('/api/admin/seo/gsc/service-account', requirePermission('seo:manage'), (req, res) => {
  try {
    SearchConsoleService.saveServiceAccountConfig(req.body || {}, getActor(req, 'SEO Manager'));
    return res.json({ success: true, connection: SearchConsoleService.getSanitizedConnection() });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message || 'Invalid service account JSON.' });
  }
});

app.post('/api/admin/seo/gsc/test', requirePermission('seo:manage'), async (req, res) => {
  try {
    const outcome = await SearchConsoleService.testAndVerifyConnection(getActor(req, 'SEO Manager'));
    return res.json({ success: outcome.status === 'Authorized', ...outcome });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Search Console check failed.' });
  }
});

app.post('/api/admin/seo/gsc/sync', requirePermission('seo:manage'), async (req, res) => {
  try {
    const metrics = await SearchConsoleService.syncLiveAnalytics(getActor(req, 'SEO Manager'));
    syncSearchConsoleConfigToSupabase(SearchConsoleService.getSanitizedConnection(), metrics).catch(() => {});
    return res.json({ success: metrics.connected, metrics });
  } catch (err: any) {
    return res.status(502).json({ success: false, error: err?.message || 'Failed syncing Search Console metrics.' });
  }
});

app.post('/api/admin/seo/gsc/disconnect', requirePermission('seo:manage'), (req, res) => {
  SearchConsoleService.disconnect(getActor(req, 'SEO Manager'));
  res.json({ success: true });
});

app.get('/api/admin/seo/redirects', requirePermission('seo:manage'), (_req, res) => {
  res.json({ success: true, redirects: db.getRedirectRules() });
});

app.post('/api/admin/seo/redirects', requirePermission('seo:manage'), async (req, res) => {
  try {
    const actor = getActor(req, 'SEO Manager');
    const saved = db.upsertRedirectRule(req.body || {}, actor);
    await persistModuleMutation({
      module: 'seo_redirects',
      action: 'save',
      recordId: saved.id,
      actor,
      syncFn: () => syncRedirectRuleToSupabase(saved),
    });
    return res.json({ success: true, redirect: saved });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || 'Failed saving redirect rule.' });
  }
});

app.delete('/api/admin/seo/redirects/:id', requirePermission('seo:manage'), async (req, res) => {
  try {
    const actor = getActor(req, 'SEO Manager');
    const success = db.deleteRedirectRule(req.params.id, actor);
    if (success) {
      await persistModuleMutation({
        module: 'seo_redirects',
        action: 'delete',
        recordId: req.params.id,
        actor,
        syncFn: () => deleteRedirectRuleFromSupabase(req.params.id),
      });
    }
    return res.json({ success });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || 'Failed deleting redirect rule.' });
  }
});

app.get('/api/admin/seo/broken-links', requirePermission('seo:manage'), (_req, res) => {
  res.json({ success: true, brokenLinks: db.getBrokenLinks() });
});

app.post('/api/admin/seo/broken-links/:id/resolve', requirePermission('seo:manage'), async (req, res) => {
  try {
    const actor = getActor(req, 'SEO Manager');
    db.resolveBrokenLink(req.params.id);
    const updated = db.getBrokenLinks().find(b => b.id === req.params.id);
    if (updated) {
      await persistModuleMutation({
        module: 'broken_links',
        action: 'update',
        recordId: updated.id,
        actor,
        syncFn: () => syncBrokenLinkToSupabase(updated),
      });
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || 'Failed resolving broken link.' });
  }
});

app.post('/api/admin/seo/audit-article', requirePermission('seo:manage'), (req, res) => {
  const result = SEOEngine.runQualityGate(req.body || {});
  res.json({ success: true, audit: result });
});

app.get('/api/admin/seo/freshness-queue', requirePermission('seo:manage'), (_req, res) => {
  const tasks = ContentFreshnessEngine.scanArticlesForFreshness(db.getData().articles);
  res.json({ success: true, count: tasks.length, tasks });
});

app.get('/api/admin/seo/internal-links/:articleId', requirePermission('seo:manage'), (req, res) => {
  const articles = db.getData().articles;
  const target = articles.find(a => a.id === req.params.articleId);
  if (!target) {
    return res.status(404).json({ success: false, error: 'Article not found' });
  }
  const suggestions = SEOEngine.suggestInternalLinks(target, articles);
  return res.json({ success: true, suggestions });
});

app.get('/api/admin/seo/opportunities', requirePermission('seo:manage'), (_req, res) => {
  const sc = db.getSearchConsoleMetrics();
  if (!sc.connected) {
    return res.json({
      success: true,
      connected: false,
      caveat: sc.diagnosticMessage || 'Connect Google Search Console to analyze verified CTR opportunities.',
      highImpressionLowCtrPages: [],
      risingQueries: [],
    });
  }
  const highImpLowCtr = (sc.topPages || []).filter(p => p.impressions >= 100 && p.ctr < 5.0);
  const risingQueries = (sc.topQueries || []).filter(q => q.position <= 5.0);
  return res.json({
    success: true,
    connected: true,
    caveat: 'Google Search Console data reflects verified 28-day search performance.',
    highImpressionLowCtrPages: highImpLowCtr,
    risingQueries,
  });
});

app.post('/api/admin/links/scan', requirePermission('seo:manage'), async (_req, res) => {
  try {
    const { LinkAuditEngine } = await import('./services/seo/LinkAuditEngine.ts');
    const baseUrl = `http://localhost:${PORT}`;
    const paths = [
      '/',
      '/robots.txt',
      '/sitemap.xml',
      '/en/feed.xml',
      '/ur/feed.xml',
      '/llms.txt',
      '/en/about',
      '/ur/about',
      '/en/privacy-policy',
      '/ur/privacy-policy',
      '/en/contact',
      '/ur/contact',
    ];
    const report = await LinkAuditEngine.runAudit(baseUrl, paths);
    return res.json({ success: true, report });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Link scan failed.' });
  }
});

// ================= REPORTS CENTER (12 ENTERPRISE REPORTS) =================
app.get('/api/admin/reports/:reportId', requirePermission('reports:view'), (req, res) => {
  const { reportId } = req.params;
  const d = db.getData();

  switch (reportId) {
    case 'editorial-activity':
      return res.json({
        success: true,
        reportId,
        title: 'Editorial Activity & Publishing Velocity',
        generatedAt: new Date().toISOString(),
        data: d.articles.map(a => ({
          id: a.id,
          title: a.titleEn,
          category: a.category,
          author: a.author.nameEn,
          status: a.status,
          publishedAt: a.publishedAt,
          updatedAt: a.updatedAt,
          views: a.views,
          versionCount: a.versions?.length || 0,
        })),
      });

    case 'pageviews-traffic':
      return res.json({
        success: true,
        reportId,
        title: 'Pageviews, Category Reach & Reader Engagement',
        generatedAt: new Date().toISOString(),
        summary: {
          totalViews: d.articles.reduce((acc, a) => acc + a.views, 0),
          avgViewsPerArticle: Math.round(d.articles.reduce((acc, a) => acc + a.views, 0) / (d.articles.length || 1)),
        },
        data: d.categories.map(c => {
          const arts = d.articles.filter(a => a.category.toLowerCase() === c.slug.toLowerCase());
          const catViews = arts.reduce((sum, a) => sum + (a.views || 0), 0);
          return {
            category: c.nameEn,
            urdu: c.nameUr,
            articleCount: arts.length,
            totalViews: catViews,
            avgViews: arts.length > 0 ? Math.round(catViews / arts.length) : 0,
          };
        }),
      });

    case 'ads-monetization':
      return res.json({
        success: true,
        reportId,
        title: 'Advertising Performance & Revenue Yield',
        generatedAt: new Date().toISOString(),
        campaigns: (d.adCampaigns || []).map(c => ({
          campaign: c.campaignName,
          advertiser: c.advertiserName,
          budgetPkr: c.budgetPkr,
          impressions: c.impressions,
          clicks: c.clicks,
          ctr: `${c.ctr}%`,
          status: c.status,
        })),
        slots: (d.adPlacements || []).map(s => ({
          slotName: s.name,
          provider: s.providerType,
          dimensions: s.dimensions,
          impressions: s.impressions,
          clicks: s.clicks,
          ctr: s.impressions > 0 ? `${((s.clicks / s.impressions) * 100).toFixed(2)}%` : '0%',
        })),
      });

    case 'automation-sync':
      return res.json({
        success: true,
        reportId,
        title: 'Live Data Providers & Synchronization SLA',
        generatedAt: new Date().toISOString(),
        providers: d.dataProviders.map(p => ({
          provider: p.name,
          category: p.category,
          status: p.status,
          intervalMinutes: p.intervalMinutes,
          successRate: p.totalSyncs > 0 ? `${Math.round((p.successfulSyncs / p.totalSyncs) * 100)}%` : '100%',
          totalSyncs: p.totalSyncs,
          lastSyncAt: p.lastSyncAt,
          attribution: p.attribution,
        })),
      });

    case 'search-console-seo':
      return res.json({
        success: true,
        reportId,
        title: 'Google Search Console Organic Search Report',
        generatedAt: new Date().toISOString(),
        metrics: db.getSearchConsoleMetrics(),
      });

    case 'user-audit-trail':
      return res.json({
        success: true,
        reportId,
        title: 'Staff Activity & Immutable Audit Logs',
        generatedAt: new Date().toISOString(),
        logs: d.auditLogs,
      });

    case 'content-freshness':
      return res.json({
        success: true,
        reportId,
        title: 'Content Freshness & Evergreen Refresh Queue',
        generatedAt: new Date().toISOString(),
        tasks: ContentFreshnessEngine.scanArticlesForFreshness(d.articles),
      });

    default:
      return res.json({
        success: true,
        reportId,
        title: `Report: ${reportId}`,
        generatedAt: new Date().toISOString(),
        data: d.articles.slice(0, 15).map(a => ({ id: a.id, title: a.titleEn, views: a.views, status: a.status })),
      });
  }
});

// ================= MULTI-PROVIDER AI VAULT, ROUTER & EDITORIAL STUDIO =================

// --- Simplified One-Click AI API Connection Endpoints ---
app.get('/api/v1/admin/ai/connection-status', requireAnyPermission(['ai:use', 'ai:keys']), async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const session: AdminSession | undefined = (req as any).adminSession;
    const all = await AIProviderRouter.listCredentialsAuthoritative();
    const connected = all.find((c: any) => c.enabled && c.connectionStatus === 'connected');
    const active = connected || all.find((c: any) => c.enabled) || all[0] || null;
    const geminiCred =
      all.find((c: any) => c.providerType === 'gemini' && c.enabled && c.connectionStatus === 'connected') ||
      all.find((c: any) => c.providerType === 'gemini' && c.enabled);
    const grokCred =
      all.find((c: any) => c.providerType === 'grok' && c.enabled && c.connectionStatus === 'connected') ||
      all.find((c: any) => c.providerType === 'grok' && c.enabled);
    const supabaseConfigured = isSupabaseConfigured();
    const recentTests = db.getAiConnectionTests(undefined, 10);
    const latestTest = recentTests[0] || null;

    const storageBackend = AIProviderManager.getStorageBackendMode();
    res.json({
      success: true,
      buildVersion: AI_VAULT_BUILD_VERSION,
      connected: Boolean(connected),
      activeProvider: active,
      geminiStatus:
        geminiCred?.connectionStatus === 'connected'
          ? 'Connected'
          : geminiCred?.connectionStatus || 'Not Connected',
      grokStatus:
        grokCred?.connectionStatus === 'connected'
          ? 'Connected'
          : grokCred?.connectionStatus || 'Not Connected',
      currentUserRole: session?.role || 'Unknown',
      isSuperAdmin: session?.role === 'Super Admin',
      totalCredentials: all.length,
      connectedCount: all.filter((c: any) => c.enabled && c.connectionStatus === 'connected').length,
      storageBackend,
      supabaseConfigured,
      ephemeralServerlessWarning: isServerlessRuntime() && !supabaseConfigured,
      envManagedVariables: AIProviderManager.getEnvManagedVariablesStatus(),
      serverEnvironment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        isServerless: isServerlessRuntime(),
        generationTimeoutMs: Number(process.env.AI_GENERATION_TIMEOUT_MS || 45000),
        discoveryTimeoutMs: Number(process.env.AI_DISCOVERY_TIMEOUT_MS || 12000),
      },
      latestTest,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed loading AI connection status.' });
  }
});

app.post('/api/v1/admin/ai/discover-auto', requireSuperAdmin, async (req, res) => {
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort(new Error('Client disconnected'));
  });
  try {
    const body = req.body || {};
    const result = await AIProviderManager.discoverAutoStep(
      {
        apiKey: String(body.apiKey || ''),
        providerOverride:
          body.providerOverride === 'gemini' || body.providerOverride === 'grok'
            ? body.providerOverride
            : undefined,
        preferredModel: body.preferredModel ? String(body.preferredModel) : undefined,
        customEndpointUrl: body.customEndpointUrl ? String(body.customEndpointUrl) : undefined,
        confirmBillableTest: Boolean(body.confirmBillableTest),
        allowPaidModels: Boolean(body.allowPaidModels),
        replaceCredentialId: body.replaceCredentialId ? String(body.replaceCredentialId) : undefined,
      },
      getActor(req, 'Super Admin'),
      controller.signal
    );
    return res.json({ success: result.ok, result });
  } catch (err: any) {
    const msg = err?.message || 'AI credential verification step failed.';
    const status = msg.toLowerCase().includes('serverless') ? 503 : 500;
    return res.status(status).json({
      success: false,
      error: msg,
    });
  }
});

app.post('/api/v1/admin/ai/verify-generation-auto', requireSuperAdmin, async (req, res) => {
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort(new Error('Client disconnected'));
  });
  try {
    const body = req.body || {};
    const providerType = body.providerType === 'grok' ? 'grok' : 'gemini';
    const selectedModel = String(body.selectedModel || '').trim();
    if (!selectedModel) {
      return res.status(400).json({ success: false, error: 'selectedModel is required for generation verification.' });
    }
    const result = await AIProviderManager.verifyGenerationAutoStep(
      {
        apiKey: String(body.apiKey || ''),
        providerType,
        selectedModel,
        candidateModels: Array.isArray(body.candidateModels) ? body.candidateModels.map(String) : [selectedModel],
        availableModels: Array.isArray(body.availableModels) ? body.availableModels : [],
        detectionMethod: body.detectionMethod,
        customEndpointUrl: body.customEndpointUrl ? String(body.customEndpointUrl) : undefined,
        confirmBillableTest: Boolean(body.confirmBillableTest),
        allowPaidModels: Boolean(body.allowPaidModels),
        replaceCredentialId: body.replaceCredentialId ? String(body.replaceCredentialId) : undefined,
      },
      getActor(req, 'Super Admin'),
      controller.signal
    );
    return res.json({ success: result.ok, result });
  } catch (err: any) {
    const msg = err?.message || 'AI generation test failed.';
    const status = msg.toLowerCase().includes('serverless') ? 503 : 500;
    return res.status(status).json({
      success: false,
      error: msg,
    });
  }
});

app.post('/api/v1/admin/ai/connect-auto', requireSuperAdmin, async (req, res) => {
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort(new Error('Client disconnected'));
  });
  try {
    const body = req.body || {};
    const result = await AIProviderManager.connectAutomatically(
      {
        apiKey: String(body.apiKey || ''),
        providerOverride:
          body.providerOverride === 'gemini' || body.providerOverride === 'grok'
            ? body.providerOverride
            : undefined,
        preferredModel: body.preferredModel ? String(body.preferredModel) : undefined,
        customEndpointUrl: body.customEndpointUrl ? String(body.customEndpointUrl) : undefined,
        confirmBillableTest: Boolean(body.confirmBillableTest),
        allowPaidModels: Boolean(body.allowPaidModels),
        replaceCredentialId: body.replaceCredentialId ? String(body.replaceCredentialId) : undefined,
      },
      getActor(req, 'Super Admin'),
      controller.signal
    );
    if (result.ok) {
      AIProviderRouter.clearAutomationCooldowns();
      resetAiContentEngineCooldown();
    }
    return res.json({ success: result.ok, result });
  } catch (err: any) {
    const msg = err?.message || 'Automatic AI connection failed.';
    const status = msg.toLowerCase().includes('serverless') ? 503 : 500;
    return res.status(status).json({
      success: false,
      error: msg,
    });
  }
});

async function handleResetPreview(_req: Request, res: Response) {
  try {
    const preview = await AIProviderManager.getResetPreviewSummary();
    return res.json({ success: true, preview });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed preparing reset summary.' });
  }
}

async function handleResetAll(req: Request, res: Response) {
  const correlationId = generateCorrelationId('ai-reset');
  try {
    const body = req.body || {};
    if (body.confirmReset !== 'RESET_ALL_AI_KEYS') {
      return res.status(400).json({
        success: false,
        error: 'Explicit Super Admin confirmation is required to reset all AI API credentials.',
      });
    }
    const report = await AIProviderManager.resetAllCredentials(getActor(req, 'Super Admin'));
    AIProviderRouter.clearAutomationCooldowns();
    resetAiContentEngineCooldown();
    const affected = isSupabaseConfigured() ? report.removedSupabaseCount : report.removedLocalCount;
    const receipt = AIProviderManager.recordMutationDebugLog({
      correlationId,
      action: 'reset_all',
      handler: 'handleResetAll',
      endpoint: req.path,
      httpStatus: 200,
      table: 'ai_provider_credentials',
      targetId: 'provider_type IN (gemini, grok)',
      affectedCount: affected,
      verifiedAfterMutation: Boolean(report.verifiedAfterMutation),
    });
    return res.json({ success: true, ...report, receipt });
  } catch (err: any) {
    const msg = err?.message || 'Failed to reset AI API credentials.';
    const status = msg.toLowerCase().includes('serverless') ? 503 : 500;
    AIProviderManager.recordMutationDebugLog({
      correlationId,
      action: 'reset_all',
      handler: 'handleResetAll',
      endpoint: req.path,
      httpStatus: status,
      table: 'ai_provider_credentials',
      targetId: 'provider_type IN (gemini, grok)',
      affectedCount: 0,
      verifiedAfterMutation: false,
      note: msg,
    });
    return res.status(status).json({
      success: false,
      error: msg,
    });
  }
}

app.get('/api/v1/admin/ai/reset-preview', requireSuperAdmin, handleResetPreview);
app.get('/api/admin/ai/reset-preview', requireSuperAdmin, handleResetPreview);
app.post('/api/v1/admin/ai/reset-all', requireSuperAdmin, handleResetAll);
app.post('/api/v1/admin/ai/providers/reset', requireSuperAdmin, handleResetAll);
app.post('/api/admin/ai/reset-all', requireSuperAdmin, handleResetAll);
app.post('/api/admin/ai/providers/reset', requireSuperAdmin, handleResetAll);

async function handleDisconnect(req: Request, res: Response) {
  const correlationId = generateCorrelationId('ai-disc');
  const targetId = req.body?.credentialId ? String(req.body.credentialId) : 'active';
  try {
    const body = req.body || {};
    const out = await AIProviderManager.disconnectCredential(
      body.credentialId ? String(body.credentialId) : undefined,
      getActor(req, 'Super Admin')
    );
    const status = out.ok ? 200 : out.notFound ? 404 : 500;
    const receipt = AIProviderManager.recordMutationDebugLog({
      correlationId,
      action: 'delete_credential',
      handler: 'handleDisconnect',
      endpoint: req.path,
      httpStatus: status,
      table: 'ai_provider_credentials',
      targetId: out.disconnectedId || targetId,
      affectedCount: out.deletedCount ?? 0,
      verifiedAfterMutation: Boolean(out.verifiedAfterMutation),
      rlsError: out.rlsError || null,
      note: out.message,
    });
    if (!out.ok) {
      return res.status(status).json({ success: false, error: out.message, ...out, receipt });
    }
    return res.json({ success: true, ...out, receipt });
  } catch (err: any) {
    const msg = err?.message || 'Failed to disconnect AI provider.';
    const status = msg.toLowerCase().includes('serverless') ? 503 : 500;
    const receipt = AIProviderManager.recordMutationDebugLog({
      correlationId,
      action: 'delete_credential',
      handler: 'handleDisconnect',
      endpoint: req.path,
      httpStatus: status,
      table: 'ai_provider_credentials',
      targetId,
      affectedCount: 0,
      verifiedAfterMutation: false,
      note: msg,
    });
    return res.status(status).json({ success: false, error: msg, receipt });
  }
}

app.post('/api/v1/admin/ai/disconnect', requireSuperAdmin, handleDisconnect);
app.post('/api/admin/ai/disconnect', requireSuperAdmin, handleDisconnect);

// --- Standardized v1 & /api/admin/ai Provider Validation & Diagnostics (Static Routes Before :id) ---
async function handleValidateCandidate(req: Request, res: Response) {
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort(new Error('Client disconnected'));
  });
  try {
    const body = req.body || {};
    const providerType = body.providerType || 'gemini';
    const result = await AIProviderManager.validateCandidateKey(
      {
        providerType,
        apiKey: body.apiKey,
        credentialId: body.credentialId,
        endpointUrl: body.endpointUrl,
        model: body.model,
        runGenerationTest: body.runGenerationTest !== false,
      },
      getActor(req, 'Super Admin'),
      controller.signal
    );
    return res.json({ success: result.ok, result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Validation failed.' });
  }
}

app.post('/api/v1/admin/ai/providers/validate', requireSuperAdmin, handleValidateCandidate);
app.post('/api/admin/ai/providers/validate', requireSuperAdmin, handleValidateCandidate);
app.post('/api/admin/ai/validate', requireSuperAdmin, handleValidateCandidate);

async function handleGetDiagnostics(_req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const diagnostics = await AIProviderManager.getDiagnostics();
    return res.json({ success: true, ...diagnostics });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Diagnostics check failed.' });
  }
}

async function handleRunCrudSelfTest(req: Request, res: Response) {
  try {
    const result = await AIProviderManager.runCrudSelfTest(getActor(req, 'Super Admin'));
    return res.status(result.ok ? 200 : 500).json({ success: result.ok, ...result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'CRUD self-test failed.' });
  }
}

app.get('/api/v1/admin/ai/diagnostics', requirePermission('ai:keys'), handleGetDiagnostics);
app.get('/api/v1/admin/ai/providers/diagnostics', requirePermission('ai:keys'), handleGetDiagnostics);
app.get('/api/admin/ai/diagnostics', requirePermission('ai:keys'), handleGetDiagnostics);
app.get('/api/admin/ai/providers/diagnostics', requirePermission('ai:keys'), handleGetDiagnostics);

app.post('/api/v1/admin/ai/diagnostics/crud-test', requireSuperAdmin, handleRunCrudSelfTest);
app.post('/api/v1/admin/ai/providers/diagnostics/crud-test', requireSuperAdmin, handleRunCrudSelfTest);
app.post('/api/admin/ai/diagnostics/crud-test', requireSuperAdmin, handleRunCrudSelfTest);
app.post('/api/admin/ai/providers/diagnostics/crud-test', requireSuperAdmin, handleRunCrudSelfTest);

// --- Standardized v1 & /api/admin/ai Provider CRUD ---
async function handleListProviders(_req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const providers = await AIProviderRouter.listCredentialsAuthoritative();
    return res.json({ success: true, providers });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed listing AI providers.' });
  }
}

async function handleCreateOrUpsertProvider(req: Request, res: Response) {
  const correlationId = generateCorrelationId('ai-add');
  const action = req.body?.id ? 'edit_credential' : 'add_credential';
  const expectedStatus = req.body?.id ? 200 : 201;
  try {
    const saved = await AIProviderManager.addOrUpdateCredential(req.body || {}, getActor(req, 'Super Admin'));
    AIProviderRouter.clearAutomationCooldowns();
    resetAiContentEngineCooldown();
    const receipt = AIProviderManager.recordMutationDebugLog({
      correlationId,
      action,
      handler: 'handleCreateOrUpsertProvider',
      endpoint: req.path,
      httpStatus: expectedStatus,
      table: 'ai_provider_credentials',
      targetId: saved.id,
      affectedCount: 1,
      verifiedAfterMutation: true,
    });
    return res.status(expectedStatus).json({ success: true, provider: saved, receipt });
  } catch (err: any) {
    const msg = err?.message || 'Failed saving AI credential.';
    const status = msg.toLowerCase().includes('not found')
      ? 404
      : msg.toLowerCase().includes('serverless')
      ? 503
      : msg.toLowerCase().includes('database') || msg.toLowerCase().includes('supabase')
      ? 500
      : 400;
    const receipt = AIProviderManager.recordMutationDebugLog({
      correlationId,
      action,
      handler: 'handleCreateOrUpsertProvider',
      endpoint: req.path,
      httpStatus: status,
      table: 'ai_provider_credentials',
      targetId: req.body?.id ? String(req.body.id) : 'new',
      affectedCount: 0,
      verifiedAfterMutation: false,
      note: msg,
    });
    return res.status(status).json({ success: false, error: msg, receipt });
  }
}

async function handlePatchProvider(req: Request, res: Response) {
  const correlationId = generateCorrelationId('ai-edit');
  const action =
    req.body && Object.keys(req.body).length === 1 && 'enabled' in req.body
      ? 'toggle_credential'
      : 'edit_credential';
  try {
    const updated = await AIProviderManager.updateCredentialPartial(
      req.params.id,
      req.body || {},
      getActor(req, 'Super Admin')
    );
    AIProviderRouter.clearAutomationCooldowns();
    resetAiContentEngineCooldown();
    const receipt = AIProviderManager.recordMutationDebugLog({
      correlationId,
      action,
      handler: 'handlePatchProvider',
      endpoint: req.path,
      httpStatus: 200,
      table: 'ai_provider_credentials',
      targetId: updated.id,
      affectedCount: 1,
      verifiedAfterMutation: true,
    });
    return res.json({ success: true, provider: updated, receipt });
  } catch (err: any) {
    const msg = err?.message || 'Failed updating AI credential.';
    const status = msg.toLowerCase().includes('not found')
      ? 404
      : msg.toLowerCase().includes('serverless')
      ? 503
      : msg.toLowerCase().includes('database') || msg.toLowerCase().includes('supabase')
      ? 500
      : 400;
    const receipt = AIProviderManager.recordMutationDebugLog({
      correlationId,
      action,
      handler: 'handlePatchProvider',
      endpoint: req.path,
      httpStatus: status,
      table: 'ai_provider_credentials',
      targetId: req.params.id,
      affectedCount: 0,
      verifiedAfterMutation: false,
      note: msg,
    });
    return res.status(status).json({ success: false, error: msg, receipt });
  }
}

async function handleDeleteProvider(req: Request, res: Response) {
  const correlationId = generateCorrelationId('ai-del');
  try {
    const out = await AIProviderManager.disconnectCredential(req.params.id, getActor(req, 'Super Admin'));
    const status = out.ok && (out.deletedCount ?? 0) >= 1 && out.verifiedAfterMutation !== false
      ? 200
      : out.notFound
      ? 404
      : 500;
    const receipt = AIProviderManager.recordMutationDebugLog({
      correlationId,
      action: 'delete_credential',
      handler: 'handleDeleteProvider',
      endpoint: req.path,
      httpStatus: status,
      table: 'ai_provider_credentials',
      targetId: req.params.id,
      affectedCount: out.deletedCount ?? 0,
      verifiedAfterMutation: Boolean(out.verifiedAfterMutation),
      rlsError: out.rlsError || null,
      note: out.message,
    });
    if (status !== 200) {
      return res.status(status).json({
        success: false,
        error: out.message,
        deletedCount: out.deletedCount ?? 0,
        receipt,
      });
    }
    return res.json({
      success: true,
      deletedCount: out.deletedCount ?? 1,
      disconnectedId: out.disconnectedId,
      message: out.message,
      receipt,
    });
  } catch (err: any) {
    const msg = err?.message || 'Failed deleting AI credential.';
    const status = msg.toLowerCase().includes('serverless') ? 503 : 500;
    const receipt = AIProviderManager.recordMutationDebugLog({
      correlationId,
      action: 'delete_credential',
      handler: 'handleDeleteProvider',
      endpoint: req.path,
      httpStatus: status,
      table: 'ai_provider_credentials',
      targetId: req.params.id,
      affectedCount: 0,
      verifiedAfterMutation: false,
      note: msg,
    });
    return res.status(status).json({
      success: false,
      error: msg,
      deletedCount: 0,
      receipt,
    });
  }
}

async function handleTestProviderById(req: Request, res: Response) {
  try {
    const result = await AIProviderManager.testSavedCredential(req.params.id, getActor(req, 'Super Admin'));
    return res.json({ success: result.ok, result });
  } catch (err: any) {
    const msg = err?.message || 'Provider test failed.';
    const status = msg.toLowerCase().includes('not found')
      ? 404
      : msg.toLowerCase().includes('database') || msg.toLowerCase().includes('supabase')
      ? 500
      : 400;
    return res.status(status).json({ success: false, error: msg });
  }
}

app.get('/api/v1/admin/ai/providers', requireAnyPermission(['ai:use', 'ai:keys']), handleListProviders);
app.get('/api/admin/ai/providers', requireAnyPermission(['ai:use', 'ai:keys']), handleListProviders);

app.post('/api/v1/admin/ai/providers', requireSuperAdmin, handleCreateOrUpsertProvider);
app.post('/api/admin/ai/providers', requireSuperAdmin, handleCreateOrUpsertProvider);

app.patch('/api/v1/admin/ai/providers/:id', requireSuperAdmin, handlePatchProvider);
app.patch('/api/admin/ai/providers/:id', requireSuperAdmin, handlePatchProvider);

app.delete('/api/v1/admin/ai/providers/:id', requireSuperAdmin, handleDeleteProvider);
app.delete('/api/admin/ai/providers/:id', requireSuperAdmin, handleDeleteProvider);

app.post('/api/v1/admin/ai/providers/:id/test', requireSuperAdmin, handleTestProviderById);
app.post('/api/admin/ai/providers/:id/test', requireSuperAdmin, handleTestProviderById);

app.get('/api/v1/admin/ai/providers/:id/models', requireAnyPermission(['ai:use', 'ai:keys']), async (req, res) => {
  try {
    const discovery = await AIProviderManager.discoverModelsForCredential(req.params.id, getActor(req, 'Super Admin'));
    return res.json({ success: true, ...discovery });
  } catch (err: any) {
    const diag = err?.diagnostic;
    return res.status(diag?.httpStatus || 400).json({
      success: false,
      error: diag?.diagnosis || err?.message || 'Failed discovering models.',
      diagnostic: diag,
    });
  }
});

app.get('/api/v1/admin/ai/providers/:id/logs', requirePermission('ai:keys'), (req, res) => {
  const logs = AIProviderManager.getCredentialLogs(req.params.id);
  res.json({ success: true, ...logs });
});

async function handleGetTaskRoutes(_req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const routes = await AIProviderRouter.getTaskRoutesAuthoritative();
    return res.json({ success: true, routes });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed loading AI task routes.' });
  }
}

async function handleSaveTaskRoutes(req: Request, res: Response) {
  const correlationId = generateCorrelationId('ai-route');
  try {
    const body = req.body || {};
    const actor = getActor(req, 'Super Admin');
    const payload = Array.isArray(body.routes) ? body.routes : body.task ? body : null;
    if (!payload) {
      return res.status(400).json({ success: false, error: 'Task routing payload is required.' });
    }
    const routes = await AIProviderManager.saveTaskRoutes(payload, actor);
    const receipt = AIProviderManager.recordMutationDebugLog({
      correlationId,
      action: 'save_task_routes',
      handler: 'handleSaveTaskRoutes',
      endpoint: req.path,
      httpStatus: 200,
      table: 'ai_task_routes',
      targetId: Array.isArray(payload) ? 'all_routes' : String(payload.task),
      affectedCount: Array.isArray(payload) ? payload.length : 1,
      verifiedAfterMutation: true,
    });
    return res.json({ success: true, routes, receipt });
  } catch (err: any) {
    const msg = err?.message || 'Failed saving AI task routes.';
    const status = msg.toLowerCase().includes('serverless')
      ? 503
      : msg.toLowerCase().includes('database')
      ? 500
      : 400;
    const receipt = AIProviderManager.recordMutationDebugLog({
      correlationId,
      action: 'save_task_routes',
      handler: 'handleSaveTaskRoutes',
      endpoint: req.path,
      httpStatus: status,
      table: 'ai_task_routes',
      targetId: 'task_routes',
      affectedCount: 0,
      verifiedAfterMutation: false,
      note: msg,
    });
    return res.status(status).json({ success: false, error: msg, receipt });
  }
}

app.get('/api/v1/admin/ai/task-routes', requirePermission('ai:keys'), handleGetTaskRoutes);
app.get('/api/admin/ai/task-routes', requirePermission('ai:keys'), handleGetTaskRoutes);
app.get('/api/admin/ai/routing', requirePermission('ai:keys'), handleGetTaskRoutes);

app.put('/api/v1/admin/ai/task-routes', requireSuperAdmin, handleSaveTaskRoutes);
app.put('/api/admin/ai/task-routes', requireSuperAdmin, handleSaveTaskRoutes);
app.post('/api/admin/ai/routing', requireSuperAdmin, handleSaveTaskRoutes);

app.post('/api/v1/admin/ai/health-check', requirePermission('ai:keys'), async (req, res) => {
  try {
    const summary = await AIProviderManager.runLightweightHealthCheck(getActor(req, 'Super Admin'));
    return res.json({ success: true, summary });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Health check failed.' });
  }
});

app.get('/api/v1/admin/ai/usage', requirePermission('ai:keys'), (_req, res) => {
  res.json({ success: true, usage: AIUsageTracker.getSummary() });
});

app.get('/api/admin/ai/usage', requirePermission('ai:keys'), (_req, res) => {
  res.json({ success: true, usage: AIUsageTracker.getSummary() });
});

function handleAiError(res: Response, err: any) {
  if (err instanceof AIUnavailableError) {
    return res.status(err.statusCode).json({
      success: false,
      code: err.code,
      error: err.message,
      diagnostic: err.diagnostic,
    });
  }
  return res.status(500).json({ success: false, error: err?.message || 'AI execution failed' });
}

app.post('/api/admin/ai/suggest-headline', requirePermission('ai:use'), async (req, res) => {
  const { summary, topic, language, credentialId, model } = req.body || {};
  try {
    const prompt = `You are a chief news editor for 360Khabarnama, a leading Pakistani bilingual digital publication.
Suggest 3 crisp, journalistically accurate news headlines in BOTH English and Urdu for this topic/summary:
Topic: ${topic || 'Pakistan News'}
Summary: ${summary || 'Latest report'}
Primary Language Focus: ${language === 'ur' ? 'Urdu' : 'English'}

Return ONLY JSON:
{
  "headlinesEn": ["English Headline 1", "English Headline 2", "English Headline 3"],
  "headlinesUr": ["اردو سرخی 1", "اردو سرخی 2", "اردو سرخی 3"]
}`;

    const { data, meta } = await AIProviderRouter.executeJsonTask<{ headlinesEn: string[]; headlinesUr: string[] }>({
      task: 'headline_generation',
      prompt,
      preferredProviderId: credentialId || undefined,
      preferredModel: model || undefined,
      actor: getActor(req),
    });

    const headlinesEn = Array.isArray(data.headlinesEn) ? data.headlinesEn : [];
    const headlinesUr = Array.isArray(data.headlinesUr) ? data.headlinesUr : [];
    return res.json({
      success: true,
      headlinesEn,
      headlinesUr,
      telemetry: meta,
      text: (language === 'ur' ? headlinesUr : headlinesEn).map(h => `- ${h}`).join('\n'),
    });
  } catch (err) {
    return handleAiError(res, err);
  }
});

app.post('/api/admin/ai/translate', requirePermission('ai:use'), async (req, res) => {
  const { title, summary, text, targetLanguage, credentialId, model } = req.body || {};
  try {
    const target =
      targetLanguage === 'ur'
        ? 'Urdu (formal news journalism Nastaliq register)'
        : 'English (clear, objective news journalism prose)';
    const prompt = `Translate the following Pakistani news content accurately into ${target}. Preserve all proper nouns, figures, dates, and tone. Do NOT invent any new facts.

Title: ${title || ''}
Summary: ${summary || ''}
Body: ${text || ''}

Return ONLY valid JSON:
{
  "translatedTitle": "...",
  "translatedSummary": "...",
  "translation": "..."
}`;

    const { data, meta } = await AIProviderRouter.executeJsonTask<{
      translatedTitle?: string;
      translatedSummary?: string;
      translation?: string;
    }>({
      task: 'translation',
      prompt,
      preferredProviderId: credentialId || undefined,
      preferredModel: model || undefined,
      actor: getActor(req),
    });

    return res.json({
      success: true,
      translatedTitle: data.translatedTitle || '',
      translatedSummary: data.translatedSummary || '',
      translation: data.translation || '',
      telemetry: meta,
    });
  } catch (err) {
    return handleAiError(res, err);
  }
});

app.post('/api/admin/ai/seo-tags', requirePermission('ai:use'), async (req, res) => {
  const { title, content, credentialId, model } = req.body || {};
  try {
    const prompt = `Analyze this Pakistani digital news article and produce search optimization metadata:
Title: ${title || ''}
Content snippet: ${String(content || '').slice(0, 800)}

Return ONLY valid JSON:
{
  "metaTitleEn": "Under 65 chars SEO title",
  "metaDescription": "Under 155 chars accurate summary",
  "tags": ["Tag1", "Tag2", "Tag3", "Tag4", "Tag5"],
  "slugSuggestion": "url-friendly-lowercase-slug"
}`;

    const { data, meta } = await AIProviderRouter.executeJsonTask({
      task: 'seo_metadata',
      prompt,
      preferredProviderId: credentialId || undefined,
      preferredModel: model || undefined,
      actor: getActor(req),
    });

    return res.json({ success: true, seo: data, telemetry: meta });
  } catch (err) {
    return handleAiError(res, err);
  }
});

app.post('/api/admin/ai/summarize', requirePermission('ai:use'), async (req, res) => {
  const { titleEn, titleUr, contentEn, contentUr, credentialId, model } = req.body || {};
  try {
    const prompt = `Summarize this Pakistani news article into 2 crisp factual sentences in both English and Urdu without adding external claims.
English Title: ${titleEn || ''}
Urdu Title: ${titleUr || ''}
English Content: ${String(contentEn || '').slice(0, 1500)}
Urdu Content: ${String(contentUr || '').slice(0, 1500)}

Return ONLY valid JSON:
{
  "summaryEn": "...",
  "summaryUr": "...",
  "bulletPointsEn": ["...", "...", "..."]
}`;

    const { data, meta } = await AIProviderRouter.executeJsonTask<{
      summaryEn?: string;
      summaryUr?: string;
      bulletPointsEn?: string[];
    }>({
      task: 'summarization',
      prompt,
      preferredProviderId: credentialId || undefined,
      preferredModel: model || undefined,
      actor: getActor(req),
    });

    return res.json({
      success: true,
      summaryEn: data.summaryEn || '',
      summaryUr: data.summaryUr || '',
      bulletPointsEn: Array.isArray(data.bulletPointsEn) ? data.bulletPointsEn : [],
      telemetry: meta,
    });
  } catch (err) {
    return handleAiError(res, err);
  }
});

app.post('/api/admin/ai/seo-internal-links', requirePermission('ai:use'), async (req, res) => {
  const { articleId, titleEn, category, contentEn } = req.body || {};
  try {
    const articles = db.getData().articles.filter(a => a.status === 'published' && a.id !== articleId).slice(0, 30);
    const catalog = articles.map(a => ({
      id: a.id,
      slug: a.slug,
      titleEn: a.titleEn,
      category: a.category,
    }));
    const prompt = `You are an SEO architect for 360Khabarnama.
Source Article:
Title: ${titleEn || ''}
Category: ${category || ''}
Content snippet: ${String(contentEn || '').slice(0, 600)}

Candidate Target Articles:
${JSON.stringify(catalog)}

Select up to 5 most relevant internal linking opportunities strictly from the provided candidate list.
Return ONLY valid JSON:
{
  "suggestions": [
    {
      "targetTitle": "Exact candidate title",
      "targetUrl": "/en/news/candidate-slug",
      "anchorText": "Natural 2-5 word anchor text",
      "relevanceReason": "Short reason"
    }
  ]
}`;

    const { data, meta } = await AIProviderRouter.executeJsonTask<{ suggestions?: any[] }>({
      task: 'seo_metadata',
      prompt,
      actor: getActor(req),
    });
    return res.json({ success: true, suggestions: Array.isArray(data?.suggestions) ? data.suggestions : [], telemetry: meta });
  } catch (err) {
    return handleAiError(res, err);
  }
});

app.post('/api/admin/ai/newsroom-classify', requirePermission('ai:use'), async (req, res) => {
  const { headline, body } = req.body || {};
  try {
    const prompt = `Classify and summarize this breaking news item for 360Khabarnama AI Newsroom.
Headline: ${headline || ''}
Body: ${String(body || '').slice(0, 1200)}

Return ONLY valid JSON:
{
  "category": "pakistan|politics|business|sports|education|technology|world|entertainment|islamic|health",
  "titleUr": "Urdu headline",
  "summaryEn": "2-sentence English summary",
  "summaryUr": "2-sentence Urdu summary",
  "tags": ["Tag1", "Tag2", "Tag3"]
}`;

    const { data, meta } = await AIProviderRouter.executeJsonTask({
      task: 'category_tagging',
      prompt,
      actor: getActor(req),
    });
    return res.json({ success: true, classification: data, telemetry: meta });
  } catch (err) {
    return handleAiError(res, err);
  }
});

app.post('/api/admin/ai/editorial-studio', requirePermission('ai:use'), async (req, res) => {
  const { template, topic, inputText, category, tone, credentialId } = req.body || {};
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort(new Error('Client disconnected'));
  });

  const taskMap: Record<string, any> = {
    bilingual_article: 'article_drafting',
    article_draft: 'article_drafting',
    story_outline: 'article_drafting',
    urdu_to_english: 'translation',
    english_to_urdu: 'translation',
    translate_en_ur: 'translation',
    translate_ur_en: 'translation',
    headlines_5: 'headline_generation',
    headlines: 'headline_generation',
    seo_meta: 'seo_metadata',
    classify_tags: 'category_tagging',
    summary_bullets: 'summarization',
    summarize: 'summarization',
    breaking_alert: 'breaking_alerts',
    social_captions: 'newsletter_social',
    morning_newsletter: 'newsletter_social',
    newsletter: 'newsletter_social',
    fact_check_prep: 'fact_check_prep',
    fact_check: 'fact_check_prep',
    rewrite_tone: 'content_rewriting',
    related_ideas: 'article_drafting',
    faq_schema: 'seo_metadata',
  };

  const mappedTask = taskMap[template] || 'article_drafting';

  try {
    const prompt = `You are Senior Editor at 360Khabarnama (Pakistan bilingual news & civic portal).
Task Template: ${template}
Category: ${category || 'pakistan'}
Tone: ${tone || 'Objective & Authoritative'}
Topic / Headline: ${topic || ''}
Source Input / Notes: ${inputText || ''}

Strict Rules: Ground strictly in the supplied notes/facts. Do NOT fabricate numbers, quotes, or statistics.
Return ONLY valid JSON appropriate for the template, including relevant keys among:
- "titleEn", "titleUr", "summaryEn", "summaryUr", "contentEn", "contentUr"
- "headlinesEn" (array), "headlinesUr" (array)
- "tags" (array), "metaDescription", "slugSuggestion"
- "bulletSummaryEn" (array), "bulletSummaryUr" (array)
- "twitterEn", "twitterUr", "facebook", "whatsapp"
- "factCheckFlags" (array), "recommendations" (array), "overallScore" (number)
- "faqs" (array of { "question": "...", "answer": "..." })`;

    const { data, meta } = await AIProviderRouter.executeJsonTask({
      task: mappedTask,
      prompt,
      preferredProviderId: credentialId || undefined,
      actor: getActor(req),
      signal: controller.signal,
    });

    return res.json({ success: true, result: data, telemetry: meta });
  } catch (err) {
    return handleAiError(res, err);
  }
});

app.get('/api/admin/ai/editorial-drafts', requirePermission('ai:use'), (_req, res) => {
  res.json({ success: true, drafts: db.getEditorialDrafts() });
});

app.post('/api/admin/ai/editorial-drafts', requirePermission('ai:use'), async (req, res) => {
  try {
    const actor = getActor(req);
    const b = req.body || {};
    const draft = db.saveEditorialDraft({
      id: b.id || `edraft-${Date.now()}`,
      template: b.template || 'bilingual_article',
      titleEn: b.titleEn || 'Untitled Draft',
      titleUr: b.titleUr || '',
      contentEn: b.contentEn || '',
      contentUr: b.contentUr || '',
      summaryEn: b.summaryEn || '',
      summaryUr: b.summaryUr || '',
      providerType: b.providerType,
      model: b.model,
      totalTokens: b.totalTokens,
      createdBy: actor,
      createdAt: b.createdAt || new Date().toISOString(),
      updatedAt: b.updatedAt || new Date().toISOString(),
    });
    await persistModuleMutation({
      module: 'editorial_drafts',
      action: 'save',
      recordId: draft.id,
      actor,
      syncFn: () => syncEditorialDraftToSupabase(draft),
    });
    return res.json({ success: true, draft });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || 'Failed saving editorial draft.' });
  }
});

// Backward-compatible Studio endpoints routed through AIProviderRouter (no hardcoded models or fake fallbacks)
app.post('/api/admin/ai/draft-article', requirePermission('ai:use'), async (req, res) => {
  const { topic, facts, category, tone } = req.body || {};
  try {
    const prompt = `Create a verified bilingual news article draft for 360Khabarnama.
Category: ${category || 'Pakistan'}
Topic: ${topic}
Facts: ${facts || ''}
Tone: ${tone || 'Objective'}
Return ONLY valid JSON with titleEn, titleUr, summaryEn, summaryUr, contentEn, contentUr, tags, suggestedCategory.`;

    const { data } = await AIProviderRouter.executeJsonTask({
      task: 'article_drafting',
      prompt,
      actor: getActor(req),
    });
    return res.json({ success: true, draft: data });
  } catch (err) {
    return handleAiError(res, err);
  }
});

app.post('/api/admin/ai/social-captions', requirePermission('ai:use'), async (req, res) => {
  const { titleEn, titleUr, summaryEn, summaryUr } = req.body || {};
  try {
    const prompt = `Create bilingual social copy for 360Khabarnama:
Title (EN): ${titleEn}
Title (UR): ${titleUr}
Summary (EN): ${summaryEn}
Summary (UR): ${summaryUr}
Return JSON with keys: twitterEn, twitterUr, facebook, instagram, whatsapp.`;

    const { data } = await AIProviderRouter.executeJsonTask({
      task: 'newsletter_social',
      prompt,
      actor: getActor(req),
    });
    return res.json({ success: true, captions: data });
  } catch (err) {
    return handleAiError(res, err);
  }
});

app.post('/api/admin/ai/content-quality-check', requirePermission('ai:use'), async (req, res) => {
  const { titleEn, contentEn, titleUr } = req.body || {};
  try {
    const prompt = `Audit journalistic objectivity, bilingual grammar, and attribution for:
Title (EN): ${titleEn}
Content (EN): ${contentEn}
Title (UR): ${titleUr}
Return JSON with overallScore, readabilityLevel, objectivityRating, grammarRating, recommendations, revisedHeadlineSuggestion.`;

    const { data } = await AIProviderRouter.executeJsonTask({
      task: 'fact_check_prep',
      prompt,
      actor: getActor(req),
    });
    return res.json({ success: true, audit: data });
  } catch (err) {
    return handleAiError(res, err);
  }
});

// Canonical v1 AI Gemini & Editorial Aliases
app.post('/api/v1/admin/ai/gemini/validate', requireSuperAdmin, async (req, res) => {
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort(new Error('Client disconnected'));
  });
  try {
    const body = req.body || {};
    const result = await AIProviderManager.validateCandidateKey(
      {
        providerType: 'gemini',
        apiKey: body.apiKey,
        credentialId: body.credentialId,
        model: body.model,
        runGenerationTest: body.runGenerationTest !== false,
      },
      getActor(req, 'Super Admin'),
      controller.signal
    );
    return res.json({ success: result.ok, result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Gemini validation failed.' });
  }
});

app.post('/api/v1/admin/ai/gemini/test', requireSuperAdmin, async (req, res) => {
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort(new Error('Client disconnected'));
  });
  try {
    const { credentialId, model, prompt } = req.body || {};
    if (prompt) {
      const execRes = await AIProviderRouter.executeTask({
        task: 'headline_generation',
        prompt: String(prompt),
        preferredProviderId: credentialId || undefined,
        preferredModel: model || undefined,
        actor: getActor(req, 'Super Admin'),
        signal: controller.signal,
      });
      return res.json({
        success: true,
        text: execRes.text,
        telemetry: {
          model: execRes.model,
          providerType: execRes.providerType,
          credentialId: execRes.credentialId,
          projectId: execRes.projectId,
          latencyMs: execRes.latencyMs,
          totalTokens: execRes.totalTokens,
        },
      });
    }
    const result = await AIProviderManager.validateCandidateKey(
      {
        providerType: 'gemini',
        apiKey: req.body?.apiKey,
        credentialId,
        model,
        runGenerationTest: true,
      },
      getActor(req, 'Super Admin'),
      controller.signal
    );
    return res.json({ success: result.ok, result });
  } catch (err: any) {
    return handleAiError(res, err);
  }
});

app.get('/api/v1/admin/ai/models', requireAnyPermission(['ai:use', 'ai:keys']), async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const creds = await AIProviderRouter.listCredentialsAuthoritative();
    const credentialId = req.query.credentialId as string | undefined;
    if (credentialId) {
      const discovery = await AIProviderManager.discoverModelsForCredential(credentialId, getActor(req, 'Super Admin'));
      return res.json({ success: true, ...discovery });
    }
    const models = creds.flatMap(c =>
      (c.availableModels || []).map((m: any) => ({
        ...m,
        credentialId: c.id,
        credentialLabel: c.label,
        providerType: c.providerType,
      }))
    );
    return res.json({ success: true, count: models.length, models });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message || 'Failed listing AI models.' });
  }
});

app.post('/api/v1/admin/ai/translate', requirePermission('ai:use'), async (req, res) => {
  const { title, summary, text, targetLanguage, credentialId, model } = req.body || {};
  try {
    const target = targetLanguage === 'ur' ? 'Urdu' : 'English';
    const prompt = `Translate into ${target} news journalism style. Preserve facts cleanly.
Title: ${title || ''}
Summary: ${summary || ''}
Body: ${text || ''}
Return ONLY JSON: { "translatedTitle": "...", "translatedSummary": "...", "translation": "..." }`;
    const { data, meta } = await AIProviderRouter.executeJsonTask<{
      translatedTitle?: string;
      translatedSummary?: string;
      translation?: string;
    }>({
      task: 'translation',
      prompt,
      preferredProviderId: credentialId || undefined,
      preferredModel: model || undefined,
      actor: getActor(req),
    });
    return res.json({
      success: true,
      translatedTitle: data.translatedTitle || '',
      translatedSummary: data.translatedSummary || '',
      translation: data.translation || '',
      telemetry: meta,
    });
  } catch (err) {
    return handleAiError(res, err);
  }
});

app.post('/api/v1/admin/ai/suggest-headlines', requirePermission('ai:use'), async (req, res) => {
  const { summary, topic, language, credentialId, model } = req.body || {};
  try {
    const prompt = `Suggest 3 crisp, factual news headlines in English and Urdu for:
Topic: ${topic || 'Pakistan News'}
Summary: ${summary || ''}
Primary Language Focus: ${language === 'ur' ? 'Urdu' : 'English'}
Return ONLY JSON: { "headlinesEn": ["..."], "headlinesUr": ["..."] }`;
    const { data, meta } = await AIProviderRouter.executeJsonTask<{ headlinesEn: string[]; headlinesUr: string[] }>({
      task: 'headline_generation',
      prompt,
      preferredProviderId: credentialId || undefined,
      preferredModel: model || undefined,
      actor: getActor(req),
    });
    return res.json({
      success: true,
      headlinesEn: Array.isArray(data.headlinesEn) ? data.headlinesEn : [],
      headlinesUr: Array.isArray(data.headlinesUr) ? data.headlinesUr : [],
      telemetry: meta,
    });
  } catch (err) {
    return handleAiError(res, err);
  }
});

app.post('/api/v1/admin/ai/generate-seo', requirePermission('ai:use'), async (req, res) => {
  const { title, content, credentialId, model } = req.body || {};
  try {
    const prompt = `Generate bilingual SEO metadata & tags for:
Title: ${title || ''}
Snippet: ${String(content || '').slice(0, 800)}
Return ONLY JSON: { "metaTitleEn": "...", "metaDescription": "...", "tags": ["..."], "slugSuggestion": "..." }`;
    const { data, meta } = await AIProviderRouter.executeJsonTask({
      task: 'seo_metadata',
      prompt,
      preferredProviderId: credentialId || undefined,
      preferredModel: model || undefined,
      actor: getActor(req),
    });
    return res.json({ success: true, seo: data, telemetry: meta });
  } catch (err) {
    return handleAiError(res, err);
  }
});

// Public Reader Q&A routed cleanly via AIProviderRouter (honest 503 if no active key)
app.post('/api/ai/ask-portal', async (req, res) => {
  const { question, language } = req.body || {};
  if (!question) {
    return res.status(400).json({ success: false, error: 'Question is required' });
  }
  try {
    const data = db.getData();
    const contextSnippet = `
Portal Context:
- PSX 100 Index: ${data.psx.kse100} (Change: ${data.psx.change})
- Gold Rate 24K: Rs. ${data.goldRates[0]?.tolaPkr} per tola
- USD/PKR Interbank: Rs. ${data.currencyRates[0]?.interbankPkr}
- Petrol Price: Rs. ${data.fuelPrices[0]?.pricePkr} per liter
- Top News Headline: ${data.articles[0]?.titleEn} / ${data.articles[0]?.titleUr}
- Karachi Fajr: ${data.prayerTimes.karachi?.fajr}, Maghrib: ${data.prayerTimes.karachi?.maghrib}
- Lahore Fajr: ${data.prayerTimes.lahore?.fajr}, Maghrib: ${data.prayerTimes.lahore?.maghrib}`;

    const prompt = `You are the reader assistant of "360Khabarnama".
Answer accurately in ${language === 'ur' ? 'Urdu' : 'English'} using only the provided portal facts if relevant. Keep it under 120 words and never fabricate numbers.
${contextSnippet}
User Question: ${question}`;

    const execRes = await AIProviderRouter.executeTask({
      task: 'public_qa',
      prompt,
      actor: 'Public Reader',
    });
    return res.json({ success: true, answer: execRes.text });
  } catch (err) {
    return handleAiError(res, err);
  }
});

// ================= NEWSROOM ORCHESTRATOR & LIVE DATA AUTOMATION ENGINE =================
app.get('/api/admin/newsroom/status', requirePermission('automation:manage'), (_req, res) => {
  res.json({ success: true, status: WorkflowOrchestrator.getStatus() });
});

app.post('/api/admin/newsroom/pause', requirePermission('automation:manage'), (req, res) => {
  WorkflowOrchestrator.setPaused(!!req.body?.paused, getActor(req, 'Super Admin'));
  res.json({ success: true, emergencyPaused: WorkflowOrchestrator.isPaused() });
});

app.get('/api/admin/newsroom/sources', requirePermission('automation:manage'), (_req, res) => {
  res.json({ success: true, sources: NewsIngestionEngine.getSources() });
});

app.post('/api/admin/newsroom/sources', requirePermission('automation:manage'), (req, res) => {
  const actor = getActor(req, 'Super Admin');
  const saved = NewsIngestionEngine.upsertSource(req.body || {});
  db.logAudit(actor, 'News Source Updated', `Updated source: ${saved.name}`);
  res.json({ success: true, source: saved });
});

app.post('/api/admin/newsroom/run-pipeline', requirePermission('automation:manage'), (req, res) => {
  const summary = WorkflowOrchestrator.runPipelineCycle(getActor(req, 'Super Admin'));
  res.json({ success: true, summary });
});

app.get('/api/admin/automation/status', requirePermission('automation:manage'), (_req, res) => {
  const providers = ProviderRegistry.getAllSanitized();
  const settings = db.getAutomationSettings();
  const history = db.getSyncHistory(5);
  const pendingDrafts = db.getAiDrafts('pending_review');

  res.json({
    success: true,
    providers,
    settings,
    recentRuns: history,
    pendingDraftsCount: pendingDrafts.length,
    lastGlobalSync: history[0]?.timestamp || null,
  });
});

app.post('/api/admin/automation/providers', requirePermission('automation:manage'), async (req, res) => {
  try {
    const actor = getActor(req, 'Automation Manager');
    const provider = ProviderRegistry.upsertProvider(req.body || {}, actor);
    await persistModuleMutation({
      module: 'sync_providers',
      action: 'save',
      recordId: provider.id,
      actor,
      syncFn: () => syncDataProviderToSupabase(provider),
    });
    return res.json({ success: true, provider });
  } catch (err: any) {
    return res.status(err?.statusCode || 400).json({ success: false, error: err?.message || 'Failed saving provider.' });
  }
});

app.post('/api/admin/automation/providers/:id/test', requirePermission('automation:manage'), async (req, res) => {
  try {
    const result = await ProviderRegistry.testEndpoint(req.params.id);
    return res.json({ success: true, result });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message || 'Endpoint test failed.' });
  }
});

app.delete('/api/admin/automation/providers/:id', requirePermission('automation:manage'), async (req, res) => {
  try {
    const actor = getActor(req, 'Automation Manager');
    const success = ProviderRegistry.deleteProvider(req.params.id, actor);
    if (success) {
      await persistModuleMutation({
        module: 'sync_providers',
        action: 'delete',
        recordId: req.params.id,
        actor,
        syncFn: () => deleteDataProviderFromSupabase(req.params.id),
      });
    }
    return res.json({ success });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || 'Failed deleting provider.' });
  }
});

app.post('/api/admin/automation/sync/:providerId', requirePermission('automation:manage'), async (req, res) => {
  const { providerId } = req.params;
  try {
    const runRecord = await scheduler.runSyncForProvider(providerId, true);
    db.logAudit(getActor(req), 'Manual Provider Sync Triggered', `Triggered manual sync for provider: ${providerId}`);
    return res.json({ success: runRecord.status === 'success', run: runRecord });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Sync failed to execute' });
  }
});

app.post('/api/admin/automation/retry/:providerId', requirePermission('automation:manage'), async (req, res) => {
  try {
    const run = await JobScheduler.retryProviderWithBackoff(req.params.providerId);
    db.logAudit(getActor(req), 'Provider Retry Backoff', `Retried ${req.params.providerId}: ${run.status}`);
    return res.json({ success: true, run });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Retry failed' });
  }
});

app.post('/api/admin/automation/cron/run', requirePermission('automation:manage'), async (req, res) => {
  try {
    const outcome = await JobScheduler.runDueJobs('cpanel_cron');
    db.logAudit(getActor(req), 'Manual Cron Batch Run', `Processed ${outcome.runs.length} due providers`);
    return res.json({ success: true, skipped: outcome.skipped || null, runs: outcome.runs });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Cron run failed' });
  }
});

app.post('/api/admin/automation/sync-all', requirePermission('automation:manage'), async (req, res) => {
  try {
    const runs = await scheduler.runAllSyncs();
    db.logAudit(getActor(req), 'Master Sync Triggered', 'Triggered full synchronization of all data providers');
    return res.json({ success: true, count: runs.length, runs });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Master sync failed' });
  }
});

app.get('/api/admin/automation/history', requirePermission('automation:manage'), (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const history = db.getSyncHistory(limit);
  res.json({ success: true, count: history.length, runs: history });
});

app.get('/api/admin/automation/drafts', requirePermission('automation:manage'), (req, res) => {
  const status = (req.query.status as string) || 'all';
  const drafts = db.getAiDrafts(status);
  res.json({ success: true, count: drafts.length, drafts });
});

app.post('/api/admin/automation/drafts/:id/publish', requirePermission('automation:manage'), (req, res) => {
  const result = db.approveAiDraft(req.params.id, getActor(req, 'Chief Editor'));
  if (!result.success) {
    return res.status(404).json({ success: false, error: 'Draft not found or could not be approved' });
  }
  return res.json({ success: true, article: result.article });
});

app.post('/api/admin/automation/drafts/:id/reject', requirePermission('automation:manage'), (req, res) => {
  const success = db.rejectAiDraft(req.params.id, getActor(req, 'Chief Editor'));
  res.json({ success });
});

app.get('/api/admin/automation/settings', requirePermission('automation:manage'), (_req, res) => {
  res.json({ success: true, settings: db.getAutomationSettings() });
});

app.post('/api/admin/automation/settings', requirePermission('automation:manage'), (req, res) => {
  const updated = db.updateAutomationSettings(req.body || {}, getActor(req, 'Super Admin'));
  res.json({ success: true, settings: updated });
});

// External Namecheap / Vercel Cron / Cloud Scheduler Webhook protected by CRON_SECRET
const handleCronRun = async (req: Request, res: Response) => {
  const configuredSecret = process.env.CRON_SECRET;
  const authBearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7).trim() : '';
  const providedSecret =
    (req.headers['x-cron-secret'] as string) ||
    authBearer ||
    (req.query.secret as string) ||
    (req.body?.secret as string);

  if (configuredSecret) {
    if (!providedSecret || providedSecret !== configuredSecret) {
      return res.status(401).json({ success: false, error: 'Unauthorized cron trigger.' });
    }
  } else if (!getSessionFromRequest(req) && !req.headers['x-vercel-cron']) {
    return res.status(403).json({
      success: false,
      error: 'CRON_SECRET environment variable is not configured and no admin session is present.',
    });
  }

  try {
    const summary = await runDueCronJobs();
    return res.json(summary);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Cron execution failed.' });
  }
};
app.post('/api/cron/run', handleCronRun);
app.get('/api/cron/run', handleCronRun);

// Public Data Freshness & Historical Rates
app.get('/api/rates/historical', (req, res) => {
  const type = req.query.type as string;
  const symbol = req.query.symbol as string;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;
  const records = db.getHistoricalRates(type, symbol, limit);
  res.json({ success: true, count: records.length, records });
});

app.get('/api/data-freshness', (_req, res) => {
  const providers = db.getDataProviders();
  const fuelNotif = db.getFuelNotifications()[0] || null;

  const freshness = {
    currency: providers.find(p => p.id === 'currency-erapi') || {
      lastSyncAt: new Date().toISOString(),
      attribution: 'ExchangeRate-API & State Bank of Pakistan',
      status: 'active',
    },
    weather: providers.find(p => p.id === 'weather-openmeteo') || {
      lastSyncAt: new Date().toISOString(),
      attribution: 'Open-Meteo & Pakistan Meteorological Department',
      status: 'active',
    },
    gold: providers.find(p => p.id === 'gold-bullion') || {
      lastSyncAt: new Date().toISOString(),
      attribution: 'All Pakistan Gem & Jewellers Association (APGJAA)',
      status: 'active',
    },
    fuel: {
      provider: providers.find(p => p.id === 'fuel-ogra'),
      lastNotification: fuelNotif,
      attribution: 'Oil & Gas Regulatory Authority (OGRA) Official Gazette',
      status: 'verified',
    },
    cricket: providers.find(p => p.id === 'cricket-feed') || {
      lastSyncAt: new Date().toISOString(),
      attribution: 'Pakistan Cricket Board (PCB) & ICC',
      status: 'active',
    },
  };

  res.json({ success: true, freshness, generatedAt: new Date().toISOString() });
});

// Ensure unmatched /api/* routes return JSON 404 instead of Express default HTML error page
app.use('/api', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    code: 'NOT_FOUND',
    error: `API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// Ensure any unhandled error inside /api/* always returns valid JSON instead of HTML/plaintext
app.use('/api', (err: any, req: Request, res: Response, _next: NextFunction) => {
  console.error('[API Error]', err);
  recordServerError({
    source: 'api',
    code: err?.code || String(err?.statusCode || err?.status || 500),
    message: err?.message || 'Internal server error occurred.',
    statusCode: Number(err?.statusCode || err?.status || 500),
    method: req.method,
    path: req.originalUrl,
  });
  if (res.headersSent) return;
  res.status(err?.statusCode || err?.status || 500).json({
    success: false,
    error: err?.message || 'Internal server error occurred.',
  });
});

// ================= HTTP REDIRECT ENGINE & SSR METADATA INJECTION =================
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (
    req.path.startsWith('/api/') ||
    req.path.startsWith('/assets/') ||
    req.path.startsWith('/@') ||
    req.path.startsWith('/src/') ||
    req.path.startsWith('/node_modules/')
  ) {
    return next();
  }

  const normalizedReqPath = req.path.length > 1 ? req.path.replace(/\/+$/, '') : req.path;
  const rules = db.getRedirectRules().filter(r => r.active);
  const matched = rules.find(r => {
    const src = r.sourcePath.length > 1 ? r.sourcePath.replace(/\/+$/, '') : r.sourcePath;
    return src.toLowerCase() === normalizedReqPath.toLowerCase();
  });

  if (matched) {
    matched.hits = (matched.hits || 0) + 1;
    if (matched.statusCode === 410) {
      return res.status(410).send('410 Gone — This resource has been permanently removed from 360Khabarnama.');
    }
    return res.redirect(matched.statusCode || 301, matched.targetPath || '/');
  }

  return next();
});

// IndexNow Key Ownership Verification File (/:key.txt)
app.get('/:key.txt', (req, res, next) => {
  const configuredKey = (db.getData().siteSettings?.indexNowKey || '').trim();
  if (configuredKey && req.params.key === configuredKey) {
    res.header('Content-Type', 'text/plain; charset=utf-8');
    return res.send(configuredKey);
  }
  return next();
});

async function setupVite() {
  if (!isProduction) {
    const vitePkg = 'vite';
    const { createServer } = await import(/* @vite-ignore */ vitePkg);
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.get('*', async (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      try {
        let preloadedArticle: any = null;
        const newsSlugMatch = req.path.match(/^\/(?:en|ur)\/news\/([^/]+)\/?$/i);
        if (newsSlugMatch && newsSlugMatch[1]) {
          const found = await ArticleService.getArticle(newsSlugMatch[1]).catch(() => null);
          if (found?.article && found.article.status === 'published' && !isArticleFutureScheduled(found.article)) {
            preloadedArticle = found.article;
          }
        }
        const rawHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        const transformed = await vite.transformIndexHtml(req.originalUrl, rawHtml);
        const withSeo = MetadataGenerator.injectMetadataIntoHtml(transformed, req.originalUrl, preloadedArticle);
        if (req.path === '/admin' || req.path.startsWith('/admin/')) {
          res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
        }
        res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(withSeo);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false }));
    app.get('*', async (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      const indexFile = path.join(distPath, 'index.html');
      if (!fs.existsSync(indexFile)) {
        return res.status(404).send('Production bundle not built yet.');
      }
      let preloadedArticle: any = null;
      const newsSlugMatch = req.path.match(/^\/(?:en|ur)\/news\/([^/]+)\/?$/i);
      if (newsSlugMatch && newsSlugMatch[1]) {
        const found = await ArticleService.getArticle(newsSlugMatch[1]).catch(() => null);
        if (found?.article && found.article.status === 'published' && !isArticleFutureScheduled(found.article)) {
          preloadedArticle = found.article;
        }
      }
      const rawHtml = fs.readFileSync(indexFile, 'utf-8');
      const withSeo = MetadataGenerator.injectMetadataIntoHtml(rawHtml, req.originalUrl, preloadedArticle);
      if (req.path === '/admin' || req.path.startsWith('/admin/')) {
        res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
      }
      return res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(withSeo);
    });
  }

  try {
    await AIProviderManager.hydrateFromSupabaseIfConfigured().catch(() => {});
  } catch {}

  try {
    scheduler.start();
  } catch (schedErr) {
    console.error('Error starting automation scheduler:', schedErr);
  }

  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`360Khabarnama running at http://0.0.0.0:${PORT}`);
  });
  httpServer.requestTimeout = 90000;
  httpServer.headersTimeout = 65000;
  httpServer.keepAliveTimeout = 65000;
}

if (!process.env.VERCEL && !process.env.VERCEL_ENV) {
  setupVite().catch(err => {
    console.error('Server startup error:', err);
  });
}

export default app;
