import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { db } from './src/server/db.ts';
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
import { AIUsageTracker } from './services/ai/AIUsageTracker.ts';
import { pushNotificationService } from './src/server/pushNotificationService.ts';
import { runDueCronJobs } from './server/jobs/cron-dispatcher.ts';

dotenv.config();

const app = express();
const portArgIdx = process.argv.indexOf('--port');
const cliPort = portArgIdx !== -1 && process.argv[portArgIdx + 1] ? parseInt(process.argv[portArgIdx + 1], 10) : NaN;
// In AI Studio / Cloud Run, NGINX is bound to 8080 and reverse-proxies to 3000.
const envPort = process.env.PORT && process.env.PORT !== '8080' ? parseInt(process.env.PORT, 10) : NaN;
const PORT = !isNaN(cliPort) ? cliPort : (!isNaN(envPort) ? envPort : 3000);
const isProduction = process.env.NODE_ENV === 'production';

// Ensure all universal category pages are seeded at boot
try {
  PageTemplateEngine.ensureAllCategoriesSeeded();
} catch (err) {
  console.error('[Boot] Failed seeding category pages:', err);
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

function getActor(req: Request, fallback: string = 'Admin'): string {
  const session: AdminSession | undefined = (req as any).adminSession;
  return session?.email || (req.headers['x-admin-user'] as string) || fallback;
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
app.get('/api/news', (req, res) => {
  const category = (req.query.category as string) || 'all';
  const tag = req.query.tag as string;
  const search = req.query.search as string;
  let status = (req.query.status as string) || 'published';

  // Only authenticated admins can query non-published articles
  if (status !== 'published') {
    const session = getSessionFromRequest(req);
    if (!session) {
      status = 'published';
    }
  }

  // Trigger background auto-update when World News / Sports News feeds are due (supports Vercel + Node)
  if (category === 'all' || category === 'world') {
    triggerStaleProviders(['world-news-rss']);
  }
  if (category === 'all' || category === 'sports') {
    triggerStaleProviders(['sports-news-rss']);
  }

  const articles = db.getArticles(category, tag, search, status);
  res.json({ success: true, count: articles.length, articles });
});

app.get('/api/news/:idOrSlug', (req, res) => {
  const article = db.getArticleBySlugOrId(req.params.idOrSlug);
  if (!article) {
    return res.status(404).json({ success: false, error: 'Article not found' });
  }
  if (article.status !== 'published' && !getSessionFromRequest(req)) {
    return res.status(404).json({ success: false, error: 'Article not found' });
  }
  db.incrementArticleViews(article.id);
  return res.json({ success: true, article });
});

app.post('/api/news', requireAdminAuth, requirePermission('articles:write'), (req, res) => {
  const session: AdminSession = (req as any).adminSession;
  const article = { ...req.body };
  const actor = getActor(req, session.email);
  if (!article.titleEn || !article.titleUr) {
    return res.status(400).json({ success: false, error: 'Both English and Urdu titles are required' });
  }
  if (article.status === 'published' && !hasPermission(session.role, 'articles:publish')) {
    return res.status(403).json({
      success: false,
      error: `Your role (${session.role}) can save drafts/in_review only and lacks "articles:publish" permission.`,
    });
  }
  const saved = db.upsertArticle(article, actor);
  if (saved.isBreaking && saved.status === 'published') {
    pushNotificationService.alertBreakingNews(saved).catch(console.error);
  }
  return res.json({ success: true, article: saved });
});

app.post('/api/news/:id/workflow', requireAdminAuth, requirePermission('articles:publish'), (req, res) => {
  const { id } = req.params;
  const { status, workflowNotes, scheduledFor, reviewerId } = req.body || {};
  const actor = getActor(req, 'Editor');

  const article = db.getData().articles.find(a => a.id === id);
  if (!article) {
    return res.status(404).json({ success: false, error: 'Article not found' });
  }

  const prevStatus = article.status;
  article.status = status;
  if (workflowNotes !== undefined) article.workflowNotes = workflowNotes;
  if (scheduledFor !== undefined) article.scheduledFor = scheduledFor;
  if (reviewerId !== undefined) article.reviewerId = reviewerId;
  if (status === 'published' && prevStatus !== 'published') {
    article.publishedAt = new Date().toISOString();
  }
  article.updatedAt = new Date().toISOString();

  db.upsertArticle(article, actor);
  if (article.isBreaking && article.status === 'published') {
    pushNotificationService.alertBreakingNews(article).catch(console.error);
  }
  db.logAudit(actor, 'Workflow Status Changed', `Changed article "${article.titleEn}" status from ${prevStatus} to ${status}`);
  return res.json({ success: true, article });
});

app.get('/api/news/:id/versions', requireAdminAuth, requirePermission('articles:read'), (req, res) => {
  const article = db.getData().articles.find(a => a.id === req.params.id);
  if (!article) {
    return res.status(404).json({ success: false, error: 'Article not found' });
  }
  return res.json({ success: true, versions: article.versions || [] });
});

app.post('/api/news/:id/rollback', requireAdminAuth, requirePermission('articles:publish'), (req, res) => {
  const { versionId } = req.body || {};
  const actor = getActor(req, 'Editor');
  if (!versionId) {
    return res.status(400).json({ success: false, error: 'versionId is required' });
  }
  const restored = db.rollbackArticle(req.params.id, versionId, actor);
  if (!restored) {
    return res.status(404).json({ success: false, error: 'Article or Version snapshot not found' });
  }
  return res.json({ success: true, article: restored });
});

app.delete('/api/news/:id', requireAdminAuth, requirePermission('articles:delete'), (req, res) => {
  const actor = getActor(req, 'Admin');
  const success = db.deleteArticle(req.params.id, actor);
  res.json({ success });
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

app.get('/api/cricket/matches', (_req, res) => {
  triggerStaleProviders(['cricket-feed']);
  res.json({ success: true, matches: db.getData().cricketMatches });
});

app.get('/api/islamic/prayer-times', (req, res) => {
  const city = ((req.query.city as string) || 'karachi').toLowerCase();
  const times = db.getData().prayerTimes[city] || db.getData().prayerTimes['karachi'];
  res.json({
    success: true,
    prayerTimes: times,
    availableCities: Object.keys(db.getData().prayerTimes),
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

app.get('/api/jobs', (_req, res) => {
  res.json({ success: true, jobs: db.getData().jobs });
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

app.post('/api/settings', requireAdminAuth, requirePermission('settings:manage'), (req, res) => {
  const newSettings = db.updateSettings(req.body || {}, getActor(req, 'Super Admin'));
  res.json({ success: true, settings: newSettings });
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

app.post('/api/admin/categories/create', requirePermission('categories:manage'), (req, res) => {
  try {
    const category = PageTemplateEngine.createCategory(req.body || {}, getActor(req));
    return res.json({ success: true, category });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message || 'Could not create category.' });
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

app.post('/api/admin/categories/:slug', requirePermission('categories:manage'), (req, res) => {
  const updated = db.upsertCategoryPage({ ...(req.body || {}), slug: req.params.slug }, getActor(req));
  res.json({ success: true, category: updated });
});

app.delete('/api/admin/categories/:slug', requirePermission('categories:manage'), (req, res) => {
  const success = db.deleteCategoryPage(req.params.slug, getActor(req));
  res.json({ success });
});

// Homepage Layout Builder (Public Published + Admin Draft/Publish/Rollback/Custom Blocks)
app.get('/api/homepage/config', (_req, res) => {
  res.json({ success: true, config: db.getHomepageConfig() });
});

app.get('/api/homepage/custom-blocks/public', (_req, res) => {
  res.json({ success: true, blocks: db.getCustomBlocks() });
});

app.post('/api/homepage/config', requireAdminAuth, requirePermission('homepage:manage'), (req, res) => {
  const updated = db.updateHomepageConfig(req.body || {}, getActor(req, 'Super Admin'));
  res.json({ success: true, config: updated });
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

app.post('/api/admin/homepage/publish', requirePermission('homepage:manage'), (req, res) => {
  const config = db.updateHomepageConfig(req.body || {}, getActor(req), 'Published from Homepage Builder');
  res.json({ success: true, config });
});

app.post('/api/admin/homepage/rollback', requirePermission('homepage:manage'), (req, res) => {
  const { versionId } = req.body || {};
  if (!versionId) {
    return res.status(400).json({ success: false, error: 'versionId is required.' });
  }
  const config = db.rollbackHomepageVersion(versionId, getActor(req));
  if (!config) {
    return res.status(404).json({ success: false, error: 'Homepage version snapshot not found.' });
  }
  return res.json({ success: true, config });
});

app.get('/api/admin/homepage/custom-blocks', requirePermission('homepage:manage'), (_req, res) => {
  res.json({ success: true, blocks: db.getCustomBlocks() });
});

app.post('/api/admin/homepage/custom-blocks', requirePermission('homepage:manage'), (req, res) => {
  const block = db.upsertCustomBlock(req.body || {}, getActor(req));
  res.json({ success: true, block });
});

app.delete('/api/admin/homepage/custom-blocks/:id', requirePermission('homepage:manage'), (req, res) => {
  const success = db.deleteCustomBlock(req.params.id, getActor(req));
  res.json({ success });
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

app.get('/api/admin/system/health', requirePermission('health:view'), (_req, res) => {
  res.json({ success: true, health: db.getSystemHealth() });
});

// ================= DYNAMIC SITEMAPS, ROBOTS, FEEDS & ADS.TXT =================
app.get('/sitemap.xml', (_req, res) => {
  res.header('Content-Type', 'application/xml; charset=utf-8');
  res.send(SitemapManager.buildMainSitemapXml());
});

app.get('/sitemap-news.xml', (_req, res) => {
  res.header('Content-Type', 'application/xml; charset=utf-8');
  res.send(SitemapManager.buildNewsSitemapXml());
});

app.get('/robots.txt', (_req, res) => {
  res.header('Content-Type', 'text/plain; charset=utf-8');
  res.send(SitemapManager.getRobotsTxt());
});

// Bilingual RSS 2.0 Feeds
const buildRssFeed = (lang: 'en' | 'ur') => {
  const baseUrl = SitemapManager.getBaseUrl();
  const articles = db.getArticles('all', undefined, undefined, 'published').slice(0, 30);
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

app.get('/en/feed.xml', (_req, res) => {
  res.header('Content-Type', 'application/rss+xml; charset=utf-8');
  res.send(buildRssFeed('en'));
});

app.get('/ur/feed.xml', (_req, res) => {
  res.header('Content-Type', 'application/rss+xml; charset=utf-8');
  res.send(buildRssFeed('ur'));
});

app.get('/ads.txt', (_req, res) => {
  const pubId = process.env.ADSENSE_PUBLISHER_ID;
  res.header('Content-Type', 'text/plain; charset=utf-8');
  if (!pubId || pubId.includes('0000000000000000')) {
    return res.status(404).send('# ads.txt not configured: ADSENSE_PUBLISHER_ID is not set.\n');
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
- [Sitemap](${baseUrl}/sitemap.xml)
- [News Sitemap](${baseUrl}/sitemap-news.xml)
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

app.post('/api/admin/users', requirePermission('users:manage'), (req, res) => {
  const user = db.upsertAdminUser(req.body || {}, getActor(req, 'Super Admin'));
  res.json({ success: true, user });
});

app.delete('/api/admin/users/:id', requirePermission('users:manage'), (req, res) => {
  const success = db.deleteAdminUser(req.params.id, getActor(req, 'Super Admin'));
  res.json({ success });
});

app.get('/api/admin/media', requirePermission('media:manage'), (req, res) => {
  const category = req.query.category as string;
  const search = req.query.search as string;
  const assets = db.getMediaAssets(category, search);
  res.json({ success: true, count: assets.length, assets });
});

app.post('/api/admin/media', requirePermission('media:manage'), (req, res) => {
  const asset = db.addMediaAsset(req.body || {}, getActor(req, 'Editor'));
  res.json({ success: true, asset });
});

app.delete('/api/admin/media/:id', requirePermission('media:manage'), (req, res) => {
  const success = db.deleteMediaAsset(req.params.id, getActor(req, 'Editor'));
  res.json({ success });
});

app.get('/api/admin/ads/placements', requirePermission('ads:manage'), (_req, res) => {
  res.json({ success: true, placements: db.getAdPlacements() });
});

app.post('/api/admin/ads/placements/:id', requirePermission('ads:manage'), (req, res) => {
  const updated = db.updateAdPlacement(req.params.id, req.body || {}, getActor(req, 'Ad Manager'));
  res.json({ success: !!updated, placement: updated });
});

app.get('/api/admin/ads/campaigns', requirePermission('ads:manage'), (_req, res) => {
  res.json({ success: true, campaigns: db.getAdCampaigns() });
});

app.post('/api/admin/ads/campaigns', requirePermission('ads:manage'), (req, res) => {
  const saved = db.upsertAdCampaign(req.body || {}, getActor(req, 'Ad Manager'));
  res.json({ success: true, campaign: saved });
});

app.delete('/api/admin/ads/campaigns/:id', requirePermission('ads:manage'), (req, res) => {
  const success = db.deleteAdCampaign(req.params.id, getActor(req, 'Ad Manager'));
  res.json({ success });
});

app.get('/api/admin/adsense-readiness', requirePermission('ads:manage'), (_req, res) => {
  const pubId = process.env.ADSENSE_PUBLISHER_ID;
  const publisherConfigured = Boolean(pubId && !pubId.includes('0000000000000000'));
  res.json({
    success: true,
    publisherConfigured,
    adsTxtLive: publisherConfigured,
    legalPagesCount: 20,
    consentBannerActive: true,
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

app.post('/api/audience/subscribe', (req, res) => {
  const { email, language, frequency } = req.body || {};
  if (!email || !String(email).includes('@')) {
    return res.status(400).json({ success: false, error: 'A valid email address is required' });
  }
  const added = db.addSubscriber(email, language, frequency);
  return res.json({ success: added, message: added ? 'Subscribed successfully' : 'Email is already subscribed' });
});

app.get('/api/admin/audience/notifications', requirePermission('audience:manage'), (_req, res) => {
  res.json({ success: true, notifications: db.getNotifications() });
});

app.post('/api/admin/audience/notifications', requirePermission('audience:manage'), (req, res) => {
  const sent = db.sendAudienceNotification(req.body || {}, getActor(req, 'Editor'));
  res.json({ success: true, notification: sent });
});

app.post('/api/admin/notifications/broadcast', requirePermission('audience:manage'), async (req, res) => {
  try {
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

app.post('/api/admin/seo/pages', requirePermission('seo:manage'), (req, res) => {
  const page = db.upsertSeoPage(req.body || {}, getActor(req, 'SEO Manager'));
  res.json({ success: true, page });
});

app.post('/api/admin/seo/pages/:id', requirePermission('seo:manage'), (req, res) => {
  const updated = db.updateSeoPage(req.params.id, req.body || {}, getActor(req, 'SEO Manager'));
  res.json({ success: !!updated, page: updated });
});

app.post('/api/admin/seo/audit/run', requirePermission('seo:manage'), (req, res) => {
  const audit = SEOAuditService.runFullTechnicalAudit(getActor(req, 'SEO Manager'));
  res.json({ success: true, audit });
});

app.get('/api/admin/seo/robots-txt', requirePermission('seo:manage'), (_req, res) => {
  res.json({ success: true, content: SitemapManager.getRobotsTxt() });
});

app.post('/api/admin/seo/robots-txt', requirePermission('seo:manage'), (req, res) => {
  const content = db.setRobotsTxt(String(req.body?.content || ''), getActor(req, 'SEO Manager'));
  res.json({ success: true, content });
});

app.get('/api/admin/seo/sitemap-config', requirePermission('seo:manage'), (_req, res) => {
  res.json({ success: true, config: db.getSitemapConfig() });
});

app.post('/api/admin/seo/sitemap-config', requirePermission('seo:manage'), (req, res) => {
  const config = db.updateSitemapConfig(req.body || {}, getActor(req, 'SEO Manager'));
  res.json({ success: true, config });
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

app.post('/api/admin/seo/search-console', requirePermission('seo:manage'), (req, res) => {
  db.updateSearchConsoleMetrics(req.body || {});
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

app.post('/api/admin/seo/redirects', requirePermission('seo:manage'), (req, res) => {
  const saved = db.upsertRedirectRule(req.body || {}, getActor(req, 'SEO Manager'));
  res.json({ success: true, redirect: saved });
});

app.delete('/api/admin/seo/redirects/:id', requirePermission('seo:manage'), (req, res) => {
  const success = db.deleteRedirectRule(req.params.id, getActor(req, 'SEO Manager'));
  res.json({ success });
});

app.get('/api/admin/seo/broken-links', requirePermission('seo:manage'), (_req, res) => {
  res.json({ success: true, brokenLinks: db.getBrokenLinks() });
});

app.post('/api/admin/seo/broken-links/:id/resolve', requirePermission('seo:manage'), (req, res) => {
  db.resolveBrokenLink(req.params.id);
  res.json({ success: true });
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
app.get('/api/admin/ai/providers', requireAnyPermission(['ai:use', 'ai:keys']), (_req, res) => {
  res.json({ success: true, providers: AIProviderRouter.getAllCredentialsSanitized() });
});

app.post('/api/admin/ai/providers', requirePermission('ai:keys'), (req, res) => {
  try {
    const saved = AIProviderRouter.addOrUpdateCredential(req.body || {}, getActor(req, 'Super Admin'));
    return res.json({ success: true, provider: saved });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message || 'Failed saving AI credential.' });
  }
});

app.post('/api/admin/ai/providers/:id/test', requirePermission('ai:keys'), async (req, res) => {
  try {
    const result = await AIProviderRouter.testCredential(req.params.id, getActor(req, 'Super Admin'));
    return res.json({ success: true, result });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message || 'Provider test failed.' });
  }
});

app.delete('/api/admin/ai/providers/:id', requirePermission('ai:keys'), (req, res) => {
  const success = db.deleteAiProvider(req.params.id, getActor(req, 'Super Admin'));
  res.json({ success });
});

app.get('/api/admin/ai/routing', requirePermission('ai:keys'), (_req, res) => {
  res.json({ success: true, routes: AIProviderRouter.getTaskRoutes() });
});

app.post('/api/admin/ai/routing', requirePermission('ai:keys'), (req, res) => {
  const body = req.body || {};
  const actor = getActor(req, 'Super Admin');
  if (Array.isArray(body.routes)) {
    for (const r of body.routes) {
      if (r?.task) db.setAiTaskRoute(r.task, r, actor);
    }
  } else if (body.task) {
    db.setAiTaskRoute(body.task, body, actor);
  } else {
    return res.status(400).json({ success: false, error: 'Task routing payload is required.' });
  }
  return res.json({ success: true, routes: AIProviderRouter.getTaskRoutes() });
});

app.get('/api/admin/ai/usage', requirePermission('ai:keys'), (_req, res) => {
  res.json({ success: true, usage: AIUsageTracker.getSummary() });
});

function handleAiError(res: Response, err: any) {
  if (err instanceof AIUnavailableError) {
    return res.status(err.statusCode).json({ success: false, code: err.code, error: err.message });
  }
  return res.status(500).json({ success: false, error: err?.message || 'AI execution failed' });
}

app.post('/api/admin/ai/suggest-headline', requirePermission('ai:use'), async (req, res) => {
  const { summary, topic, language } = req.body || {};
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

    const { data } = await AIProviderRouter.executeJsonTask<{ headlinesEn: string[]; headlinesUr: string[] }>({
      task: 'headline_generation',
      prompt,
      actor: getActor(req),
    });

    const headlinesEn = Array.isArray(data.headlinesEn) ? data.headlinesEn : [];
    const headlinesUr = Array.isArray(data.headlinesUr) ? data.headlinesUr : [];
    return res.json({
      success: true,
      headlinesEn,
      headlinesUr,
      text: (language === 'ur' ? headlinesUr : headlinesEn).map(h => `- ${h}`).join('\n'),
    });
  } catch (err) {
    return handleAiError(res, err);
  }
});

app.post('/api/admin/ai/translate', requirePermission('ai:use'), async (req, res) => {
  const { title, summary, text, targetLanguage } = req.body || {};
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

    const { data } = await AIProviderRouter.executeJsonTask<{
      translatedTitle?: string;
      translatedSummary?: string;
      translation?: string;
    }>({
      task: 'translation',
      prompt,
      actor: getActor(req),
    });

    return res.json({
      success: true,
      translatedTitle: data.translatedTitle || '',
      translatedSummary: data.translatedSummary || '',
      translation: data.translation || '',
    });
  } catch (err) {
    return handleAiError(res, err);
  }
});

app.post('/api/admin/ai/seo-tags', requirePermission('ai:use'), async (req, res) => {
  const { title, content } = req.body || {};
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

    const { data } = await AIProviderRouter.executeJsonTask({
      task: 'seo_metadata',
      prompt,
      actor: getActor(req),
    });

    return res.json({ success: true, seo: data });
  } catch (err) {
    return handleAiError(res, err);
  }
});

app.post('/api/admin/ai/editorial-studio', requirePermission('ai:use'), async (req, res) => {
  const { template, topic, inputText, category, tone, credentialId } = req.body || {};
  const controller = new AbortController();
  req.on('close', () => controller.abort());

  const taskMap: Record<string, any> = {
    bilingual_article: 'article_drafting',
    urdu_to_english: 'translation',
    english_to_urdu: 'translation',
    headlines_5: 'headline_generation',
    seo_meta: 'seo_metadata',
    summary_bullets: 'summarization',
    breaking_alert: 'breaking_alerts',
    social_captions: 'newsletter_social',
    morning_newsletter: 'newsletter_social',
    fact_check_prep: 'fact_check_prep',
    rewrite_tone: 'content_rewriting',
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

app.post('/api/admin/ai/editorial-drafts', requirePermission('ai:use'), (req, res) => {
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
    createdBy: getActor(req),
    createdAt: b.createdAt || new Date().toISOString(),
    updatedAt: b.updatedAt || new Date().toISOString(),
  });
  res.json({ success: true, draft });
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

app.post('/api/admin/automation/providers', requirePermission('automation:manage'), (req, res) => {
  try {
    const provider = ProviderRegistry.upsertProvider(req.body || {}, getActor(req, 'Automation Manager'));
    return res.json({ success: true, provider });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message || 'Failed saving provider.' });
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

app.delete('/api/admin/automation/providers/:id', requirePermission('automation:manage'), (req, res) => {
  const success = ProviderRegistry.deleteProvider(req.params.id, getActor(req, 'Automation Manager'));
  res.json({ success });
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

// Ensure any unhandled error inside /api/* always returns valid JSON instead of HTML/plaintext
app.use('/api', (err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[API Error]', err);
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
        const rawHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        const transformed = await vite.transformIndexHtml(req.originalUrl, rawHtml);
        const withSeo = MetadataGenerator.injectMetadataIntoHtml(transformed, req.originalUrl);
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
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      const indexFile = path.join(distPath, 'index.html');
      if (!fs.existsSync(indexFile)) {
        return res.status(404).send('Production bundle not built yet.');
      }
      const rawHtml = fs.readFileSync(indexFile, 'utf-8');
      const withSeo = MetadataGenerator.injectMetadataIntoHtml(rawHtml, req.originalUrl);
      if (req.path === '/admin' || req.path.startsWith('/admin/')) {
        res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
      }
      return res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(withSeo);
    });
  }

  try {
    scheduler.start();
  } catch (schedErr) {
    console.error('Error starting automation scheduler:', schedErr);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`360Khabarnama running at http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL && !process.env.VERCEL_ENV) {
  setupVite().catch(err => {
    console.error('Server startup error:', err);
  });
}

export default app;
