/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Cloud Firestore Article Persistence & Publishing Pipeline
 *
 * Coordinates Cloud Firestore (/articles) as the permanent source of truth
 * alongside the local JSON cache mirror for low-latency SSR/RSS rendering.
 */

import { Article, PublicationLogEntry } from '../types/index.ts';
import { db } from './db.ts';
import {
  checkFirestoreHealth,
  deleteFirestoreArticle,
  ensureTestConnectionDoc,
  FirestoreAuthContext,
  getFirestoreArticle,
  listFirestoreArticles,
  seedMissingArticlesToFirestore,
  upsertFirestoreArticle,
} from './firestore.ts';
import {
  deleteSupabaseArticle,
  getSupabaseArticle,
  isSupabaseConfigured,
  listSupabaseArticles,
  upsertSupabaseArticle,
} from './supabaseAdmin.ts';
import {
  clearSupabaseDeletionTombstone,
  invalidatePortalHydrationCache,
  recordSaveDiagnosticToSupabase,
  recordSupabaseDeletionTombstone,
  syncRedirectRuleToSupabase,
} from './supabaseRepositories.ts';
import { checkSupabaseHealth } from './databaseHealth.ts';
import { hasServiceAccountConfigured } from '../lib/firebase-admin.ts';
import { recordServerError, getServerErrorLogs } from './errorTracker.ts';

export type ArticleStorageEngine = 'supabase' | 'firestore' | 'json_fallback';

export interface ArticleFilterOptions {
  status?: string;
  category?: string;
  tag?: string;
  search?: string;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

export interface SaveArticleResult {
  article: Article;
  storageEngine: ArticleStorageEngine;
  verifiedReadBack: boolean;
  cacheVersion: number;
  correlationId: string;
  firestoreWarning?: string;
  supabaseWarning?: string;
}

export interface PipelineStepResult {
  step: string;
  ok: boolean;
  durationMs: number;
  detail: string;
}

function mergeArticleLists(remoteList: Article[], localList: Article[], statusFilter?: string): Article[] {
  const map = new Map<string, Article>();

  for (const localArt of localList) {
    if (!localArt.deletedAt) {
      map.set(localArt.id, localArt);
    }
  }

  // Primary remote DB records (Supabase PostgreSQL or Cloud Firestore) take strict precedence over local cache
  for (const remoteArt of remoteList) {
    if (!remoteArt.deletedAt) {
      map.set(remoteArt.id, remoteArt);
    }
  }

  let merged = Array.from(map.values());
  if (statusFilter && statusFilter !== 'all') {
    const nowMs = Date.now();
    merged = merged.filter((a) => {
      if (a.status !== statusFilter) return false;
      if (statusFilter === 'published') {
        const sched = a.scheduledAt || a.scheduledFor;
        if (sched) {
          const schedMs = new Date(sched).getTime();
          if (Number.isFinite(schedMs) && schedMs > nowMs) {
            return false;
          }
        }
      }
      return true;
    });
  }

  merged.sort((a, b) => {
    const ta = new Date(a.publishedAt || a.updatedAt || 0).getTime();
    const tb = new Date(b.publishedAt || b.updatedAt || 0).getTime();
    return tb - ta;
  });

  return merged;
}

export class ArticleService {
  /**
   * Lists articles from Supabase PostgreSQL (when configured) or Cloud Firestore (fallback),
   * merged cleanly with cached articles for low-latency SSR/RSS feeds.
   * Public requests strictly query status == 'published'. Admin requests retrieve all statuses.
   */
  public static async listArticles(
    filters: ArticleFilterOptions = {},
    authCtx: FirestoreAuthContext = {}
  ): Promise<{
    articles: Article[];
    total: number;
    storageEngine: ArticleStorageEngine;
    firestoreCount: number;
    supabaseCount: number;
  }> {
    const statusFilter = filters.status || 'published';
    const localMatches = db.getArticles(
      filters.category,
      filters.tag,
      filters.search,
      statusFilter,
      Boolean(filters.includeDeleted)
    );

    const deletedIds = new Set([
      ...db
        .getArticles(undefined, undefined, undefined, 'all', true)
        .filter((a) => a.deletedAt)
        .map((a) => a.id),
      ...Array.from(db.getDeletedTombstones('articles')),
    ]);

    const filteredLocalMatches = filters.includeDeleted
      ? localMatches
      : localMatches.filter((a) => !deletedIds.has(a.id));

    let combined = filteredLocalMatches;
    let storageEngine: ArticleStorageEngine = 'json_fallback';
    let firestoreCount = 0;
    let supabaseCount = 0;

    if (isSupabaseConfigured()) {
      const sbRes = await listSupabaseArticles({
        status: statusFilter,
        category: filters.category,
        tag: filters.tag,
        search: filters.search,
        includeDeleted: Boolean(filters.includeDeleted),
        limit: 250,
      });

      if (sbRes.ok) {
        storageEngine = 'supabase';
        supabaseCount = sbRes.articles.length;
        const activeSbArticles = filters.includeDeleted
          ? sbRes.articles
          : sbRes.articles.filter((a) => !deletedIds.has(a.id) && !a.deletedAt);
        combined = mergeArticleLists(activeSbArticles, filteredLocalMatches, statusFilter);
      } else if (sbRes.error) {
        recordServerError({
          source: 'supabase',
          code: 'SUPABASE_LIST_WARNING',
          message: `Supabase query fallback: ${sbRes.error}`,
        });
      }
    }

    if (storageEngine !== 'supabase') {
      const fsRes = await listFirestoreArticles(
        {
          status: statusFilter,
          category: filters.category,
          tag: filters.tag,
          search: filters.search,
          limit: 250,
        },
        authCtx.firebaseIdToken
      );

      if (fsRes.ok) {
        storageEngine = 'firestore';
        firestoreCount = fsRes.articles.length;
        const activeFsArticles = fsRes.articles.filter((a) => !deletedIds.has(a.id));
        combined = mergeArticleLists(activeFsArticles, filteredLocalMatches, statusFilter);
      } else if (fsRes.error) {
        recordServerError({
          source: 'firestore',
          code: 'FIRESTORE_LIST_WARNING',
          message: `Firestore query fallback to cache: ${fsRes.error}`,
        });
      }
    }

    const total = combined.length;
    const offset = Math.max(0, Number(filters.offset || 0));
    const limit = filters.limit ? Math.max(1, Math.min(Number(filters.limit), 200)) : combined.length;

    return {
      articles: combined.slice(offset, offset + limit),
      total,
      storageEngine,
      firestoreCount,
      supabaseCount,
    };
  }

  /**
   * Resolves an article by document ID or canonical slug from Supabase (when configured)
   * or Cloud Firestore, checking redirects if not found directly.
   */
  public static async getArticle(
    idOrSlug: string,
    authCtx: FirestoreAuthContext = {}
  ): Promise<{
    article: Article | null;
    redirectTo?: string;
    storageEngine: ArticleStorageEngine;
  }> {
    const clean = decodeURIComponent(idOrSlug || '').trim();
    if (!clean) return { article: null, storageEngine: 'json_fallback' };

    const tombstones = db.getDeletedTombstones('articles');

    if (isSupabaseConfigured()) {
      const sbRes = await getSupabaseArticle(clean);
      if (sbRes.ok && sbRes.article && !sbRes.article.deletedAt && !tombstones.has(sbRes.article.id)) {
        return { article: sbRes.article, storageEngine: 'supabase' };
      }
    }

    const fsRes = await getFirestoreArticle(clean, authCtx.firebaseIdToken);
    if (fsRes.ok && fsRes.article && !fsRes.article.deletedAt && !tombstones.has(fsRes.article.id)) {
      return { article: fsRes.article, storageEngine: 'firestore' };
    }

    const local = db.getArticleBySlugOrId(clean, false);
    if (local && !tombstones.has(local.id) && !local.deletedAt) {
      return {
        article: local,
        storageEngine: isSupabaseConfigured() ? 'supabase' : fsRes.ok ? 'firestore' : 'json_fallback',
      };
    }

    // Check 301 redirect rules on slug change
    const rules = db.getRedirectRules().filter((r) => r.active && r.statusCode === 301);
    const matched = rules.find(
      (r) =>
        r.sourcePath.toLowerCase() === `/en/news/${clean.toLowerCase()}` ||
        r.sourcePath.toLowerCase() === `/ur/news/${clean.toLowerCase()}`
    );
    if (matched?.targetPath) {
      const nextSlug = matched.targetPath.split('/').pop();
      if (nextSlug) {
        return { article: null, redirectTo: nextSlug, storageEngine: isSupabaseConfigured() ? 'supabase' : 'firestore' };
      }
    }

    return { article: null, storageEngine: isSupabaseConfigured() ? 'supabase' : fsRes.ok ? 'firestore' : 'json_fallback' };
  }

  /**
   * Saves or updates a news article permanently in Supabase PostgreSQL (when configured)
   * or Cloud Firestore, verifying read-after-write integrity and invalidating public feed caches.
   * Supports single-language (English-only or Urdu-only) as well as bilingual articles.
   */
  public static async saveArticle(
    input: Partial<Article> & { expectedVersion?: number },
    actor: string = 'Editor',
    authCtx: FirestoreAuthContext = {}
  ): Promise<SaveArticleResult> {
    const correlationId = `pub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const rawTitleEn = (input.titleEn || '').trim();
    const rawTitleUr = (input.titleUr || '').trim();

    if (!rawTitleEn && !rawTitleUr) {
      const err: any = new Error('At least one headline (English or Urdu) is required.');
      err.statusCode = 400;
      err.code = 'MISSING_HEADLINE';
      throw err;
    }

    // Preserve single-language drafts accurately while supplying non-empty fallback strings for bilingual cards
    const normalizedInput: Partial<Article> & { expectedVersion?: number } = {
      ...input,
      titleEn: rawTitleEn || rawTitleUr,
      titleUr: rawTitleUr || rawTitleEn,
      summaryEn: (input.summaryEn || '').trim(),
      summaryUr: (input.summaryUr || '').trim(),
      contentEn: (input.contentEn || input.summaryEn || '').trim(),
      contentUr: (input.contentUr || input.summaryUr || '').trim(),
    };

    const supabaseActive = isSupabaseConfigured();
    const hasFirestoreWriteAuth = Boolean(authCtx.firebaseIdToken || hasServiceAccountConfigured());
    const intendedEngine: ArticleStorageEngine = supabaseActive
      ? 'supabase'
      : hasFirestoreWriteAuth
      ? 'firestore'
      : 'json_fallback';

    // Update local slug/redirect/revision layer first so slug collisions & version conflicts fail cleanly
    const prevRedirectCount = db.getRedirectRules().length;
    const savedLocal = db.upsertArticle(normalizedInput, actor, {
      storageEngine: intendedEngine,
      correlationId,
    });
    const nextRedirects = db.getRedirectRules();
    const newlyCreatedRedirects =
      nextRedirects.length > prevRedirectCount
        ? nextRedirects.slice(0, nextRedirects.length - prevRedirectCount)
        : [];

    let finalArticle = savedLocal;
    let storageEngine: ArticleStorageEngine = 'json_fallback';
    let verifiedReadBack = true;
    let firestoreWarning: string | undefined;

    if (supabaseActive) {
      const t0 = Date.now();
      const sbWrite = await upsertSupabaseArticle(savedLocal, actor);
      if (!sbWrite.ok || !sbWrite.article) {
        const errDiag = db.recordSaveDiagnostic({
          module: 'articles',
          action: input.id ? 'update' : 'create',
          recordId: savedLocal.id,
          storageEngine: 'supabase',
          success: false,
          verifiedReadBack: false,
          latencyMs: Date.now() - t0,
          actor,
          errorMessage: sbWrite.error || 'Supabase write failed',
        });
        recordSaveDiagnosticToSupabase(errDiag).catch(() => {});
        const err: any = new Error(
          `Supabase PostgreSQL save failed [${sbWrite.code || 'WRITE_ERROR'}]: ${sbWrite.error || 'Unable to commit row.'}`
        );
        err.statusCode = 500;
        err.code = sbWrite.code || 'SUPABASE_WRITE_FAILED';
        err.correlationId = correlationId;
        throw err;
      }
      finalArticle = sbWrite.article;
      storageEngine = 'supabase';
      verifiedReadBack = true;
      const okDiag = db.recordSaveDiagnostic({
        module: 'articles',
        action: input.id ? 'update' : 'create',
        recordId: finalArticle.id,
        storageEngine: 'supabase',
        success: true,
        verifiedReadBack: true,
        latencyMs: Date.now() - t0,
        actor,
      });
      recordSaveDiagnosticToSupabase(okDiag).catch(() => {});

      // Best-effort secondary mirror to Firestore only if Firebase admin auth is already active
      if (hasFirestoreWriteAuth) {
        await upsertFirestoreArticle(finalArticle, authCtx).catch(() => {});
      }
    } else if (hasFirestoreWriteAuth) {
      const fsWrite = await upsertFirestoreArticle(savedLocal, authCtx);
      if (!fsWrite.ok || !fsWrite.article) {
        const err: any = new Error(
          `Cloud Firestore save failed [${fsWrite.code || 'WRITE_ERROR'}]: ${fsWrite.error || 'Unable to commit document.'}`
        );
        err.statusCode = 500;
        err.code = fsWrite.code || 'FIRESTORE_WRITE_FAILED';
        err.correlationId = correlationId;
        throw err;
      }
      finalArticle = fsWrite.article;
      storageEngine = 'firestore';
      verifiedReadBack = true;
    } else {
      db.recordSaveDiagnostic({
        module: 'articles',
        action: input.id ? 'update' : 'create',
        recordId: savedLocal.id,
        storageEngine: 'json_fallback',
        success: true,
        verifiedReadBack: true,
        latencyMs: 1,
        actor,
      });
      firestoreWarning =
        'Saved in local workspace persistence only — configure SUPABASE_URL + SUPABASE_SECRET_KEY (or Firebase Admin credentials) for external database sync.';
      recordServerError({
        source: 'publishing',
        code: 'LOCAL_CACHE_ONLY_SAVE',
        message: firestoreWarning,
        correlationId,
      });
    }

    await clearSupabaseDeletionTombstone('articles', finalArticle.id).catch(err => {
      recordServerError({
        source: 'supabase',
        code: 'TOMBSTONE_CLEAR_WARN',
        message: `Failed clearing deletion tombstone for ${finalArticle.id}: ${err?.message || err}`,
      });
    });

    if (newlyCreatedRedirects.length > 0 && supabaseActive) {
      for (const r of newlyCreatedRedirects) {
        await syncRedirectRuleToSupabase(r).catch(err => {
          recordServerError({
            source: 'supabase',
            code: 'REDIRECT_SYNC_WARN',
            message: `Failed syncing auto-301 redirect rule ${r.id}: ${err?.message || err}`,
          });
        });
      }
    }

    invalidatePortalHydrationCache();
    const cacheInfo = db.bumpNewsCacheVersion();

    return {
      article: finalArticle,
      storageEngine,
      verifiedReadBack,
      cacheVersion: cacheInfo.version,
      correlationId,
      ...(firestoreWarning ? { firestoreWarning } : {}),
    };
  }

  public static async transitionStatus(
    id: string,
    nextStatus: Article['status'],
    actor: string = 'Editor',
    opts?: { scheduledAt?: string; notes?: string },
    authCtx: FirestoreAuthContext = {}
  ): Promise<SaveArticleResult> {
    const found = await this.getArticle(id, authCtx);
    if (!found.article) {
      const err: any = new Error(`Article "${id}" not found.`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const existing = found.article;
    const now = new Date().toISOString();
    const publishedAt =
      nextStatus === 'published'
        ? existing.publishedAt || now
        : nextStatus === 'draft'
        ? ''
        : existing.publishedAt;

    return this.saveArticle(
      {
        ...existing,
        status: nextStatus,
        publishedAt,
        scheduledAt: nextStatus === 'scheduled' ? opts?.scheduledAt || existing.scheduledAt : existing.scheduledAt,
        workflowNotes: opts?.notes ?? existing.workflowNotes,
        expectedVersion: existing.version,
      },
      actor,
      authCtx
    );
  }

  public static async deleteArticle(
    id: string,
    actor: string = 'Admin',
    hardDelete: boolean = false,
    authCtx: FirestoreAuthContext = {}
  ): Promise<boolean> {
    const existing = db.getArticleBySlugOrId(id, true) || (await this.getArticle(id, authCtx)).article;

    if (isSupabaseConfigured()) {
      const sbDel = await deleteSupabaseArticle(id, hardDelete);
      if (!sbDel.ok) {
        recordServerError({
          source: 'supabase',
          code: 'SUPABASE_DELETE_ERROR',
          message: sbDel.error || `Failed deleting ${id} from Supabase.`,
        });
        const err: any = new Error(
          `Supabase article delete failed: ${sbDel.error || `Unable to delete ${id} in PostgreSQL.`}`
        );
        err.statusCode = 500;
        err.code = 'SUPABASE_DELETE_FAILED';
        throw err;
      }
    }

    const okLocal = db.deleteArticle(id, actor, hardDelete);
    await recordSupabaseDeletionTombstone('articles', id, actor, hardDelete ? 'hard_delete' : 'soft_delete').catch(err => {
      recordServerError({
        source: 'supabase',
        code: 'TOMBSTONE_SYNC_WARN',
        message: `Failed recording deletion tombstone for ${id}: ${err?.message || err}`,
      });
    });

    if (authCtx.firebaseIdToken || hasServiceAccountConfigured()) {
      if (hardDelete) {
        const fsDel = await deleteFirestoreArticle(id, authCtx);
        if (!fsDel.ok) {
          recordServerError({
            source: 'firestore',
            code: 'FIRESTORE_DELETE_ERROR',
            message: fsDel.error || `Failed deleting ${id} from Firestore.`,
          });
        }
      } else if (existing) {
        await upsertFirestoreArticle(
          { ...existing, status: 'archived', updatedAt: new Date().toISOString() },
          authCtx
        ).catch(() => {});
      }
    }

    invalidatePortalHydrationCache();
    db.bumpNewsCacheVersion();
    db.addPublicationLog({
      articleId: id,
      action: hardDelete ? 'hard_delete' : 'delete',
      nextStatus: hardDelete ? 'deleted' : 'archived',
      actor,
      storageEngine: isSupabaseConfigured()
        ? 'supabase'
        : authCtx.firebaseIdToken || hasServiceAccountConfigured()
        ? 'firestore'
        : 'json_fallback',
      message: `Article ${id} ${hardDelete ? 'permanently removed' : 'archived/soft-deleted'}.`,
    });

    return okLocal;
  }

  /**
   * Automatically promotes due 'scheduled' articles whose scheduledAt <= now to 'published'.
   */
  public static async publishDueScheduledArticles(
    actor: string = 'Scheduler (Auto-Publish)'
  ): Promise<{
    promotedCount: number;
    promotedIds: string[];
  }> {
    const nowMs = Date.now();
    const allScheduled = db.getArticles(undefined, undefined, undefined, 'scheduled', false);
    const due = allScheduled.filter((a) => {
      const target = a.scheduledAt || a.scheduledFor;
      if (!target) return false;
      const tMs = new Date(target).getTime();
      return Number.isFinite(tMs) && tMs <= nowMs;
    });

    const promotedIds: string[] = [];
    for (const art of due) {
      try {
        await this.transitionStatus(art.id, 'published', actor);
        promotedIds.push(art.id);
      } catch (err: any) {
        recordServerError({
          source: 'scheduler',
          code: 'SCHEDULE_PUBLISH_FAILED',
          message: `Auto-publish failed for article ${art.id}: ${err?.message || err}`,
        });
      }
    }

    return { promotedCount: promotedIds.length, promotedIds };
  }

  public static async seedAllPortalArticlesToFirestore(
    authCtx: FirestoreAuthContext
  ): Promise<{
    ok: boolean;
    seededCount: number;
    skippedCount: number;
    failedCount: number;
    errors: string[];
  }> {
    const allLocal = db.getArticles(undefined, undefined, undefined, 'all', false);
    const res = await seedMissingArticlesToFirestore(allLocal, authCtx);
    db.bumpNewsCacheVersion();
    return res;
  }

  public static async getPublishingHealth(authCtx: FirestoreAuthContext = {}): Promise<{
    firestoreHealth: Awaited<ReturnType<typeof checkFirestoreHealth>>;
    supabaseHealth: Awaited<ReturnType<typeof checkSupabaseHealth>>;
    cacheStatus: ReturnType<typeof db.getCacheStatus>;
    articleCountsByStatus: Record<string, number>;
    missingTranslationsCount: number;
    recentPublicationLogs: PublicationLogEntry[];
    recentErrors: ReturnType<typeof getServerErrorLogs>;
  }> {
    const [firestoreHealth, supabaseHealth, mergedRes] = await Promise.all([
      checkFirestoreHealth(authCtx.firebaseIdToken),
      checkSupabaseHealth({ runWriteTest: false }),
      this.listArticles({ status: 'all' }, authCtx),
    ]);
    const allActive = mergedRes.articles;

    const counts: Record<string, number> = {
      all: allActive.length,
      published: 0,
      draft: 0,
      in_review: 0,
      scheduled: 0,
      archived: 0,
      failed: 0,
    };
    let missingTranslations = 0;

    for (const a of allActive) {
      counts[a.status] = (counts[a.status] || 0) + 1;
      if (!a.titleEn?.trim() || !a.titleUr?.trim() || !a.contentEn?.trim() || !a.contentUr?.trim()) {
        missingTranslations++;
      }
    }

    return {
      firestoreHealth,
      supabaseHealth,
      cacheStatus: {
        ...db.getCacheStatus(),
        publishedArticlesCount: counts.published,
        totalActiveArticlesCount: allActive.length,
      },
      articleCountsByStatus: counts,
      missingTranslationsCount: missingTranslations,
      recentPublicationLogs: db.getPublicationLogs(40),
      recentErrors: getServerErrorLogs(40),
    };
  }

  /**
   * Executes a live Database Publishing Pipeline Self-Test:
   * Uses Supabase PostgreSQL when configured, otherwise Cloud Firestore.
   */
  public static async runPublishingPipelineSelfTest(
    actor: string = 'Super Admin',
    authCtx: FirestoreAuthContext = {}
  ): Promise<{
    ok: boolean;
    totalDurationMs: number;
    storageEngine: ArticleStorageEngine;
    steps: PipelineStepResult[];
    error?: string;
    testedAt: string;
  }> {
    const started = Date.now();
    const probeId = `art-diag-probe-${Date.now()}`;
    const probeSlug = `diag-probe-${Date.now()}`;
    const steps: PipelineStepResult[] = [];
    const supabaseActive = isSupabaseConfigured();
    const canWriteFirestore = Boolean(authCtx.firebaseIdToken || hasServiceAccountConfigured());
    const targetEngine: ArticleStorageEngine = supabaseActive
      ? 'supabase'
      : canWriteFirestore
      ? 'firestore'
      : 'json_fallback';

    try {
      if (supabaseActive) {
        const t0 = Date.now();
        const sbHealth = await checkSupabaseHealth({ runWriteTest: false });
        steps.push({
          step: '1. Verify Supabase PostgreSQL Connectivity & Schema',
          ok: sbHealth.connected && sbHealth.articlesTableAvailable,
          durationMs: Date.now() - t0,
          detail: `Host=${sbHealth.projectHost}, tablesReady=${sbHealth.articlesTableAvailable}, rlsOk=${sbHealth.rlsPolicyCheckOk}`,
        });
      } else {
        const t0 = Date.now();
        const health = await checkFirestoreHealth(authCtx.firebaseIdToken);
        if (canWriteFirestore && !health.testConnectionDocExists) {
          await ensureTestConnectionDoc(authCtx);
        }
        steps.push({
          step: '1. Verify Cloud Firestore Connectivity & Auth',
          ok: health.connected && canWriteFirestore,
          durationMs: Date.now() - t0,
          detail: canWriteFirestore
            ? `Project=${health.projectId}, DB=${health.firestoreDatabaseId}, authMode=${health.authMode}`
            : `Connected=${health.connected}, no Supabase keys or Firebase Service Account supplied.`,
        });
      }

      const t1 = Date.now();
      const created = await this.saveArticle(
        {
          id: probeId,
          slug: probeSlug,
          titleEn: 'Diagnostic Pipeline Probe',
          titleUr: 'پبلشنگ تشخیصی جانچ',
          summaryEn: 'Automated temporary persistence self-test article',
          summaryUr: 'خودکار جانچ کا مضمون',
          contentEn: 'Automated bilingual write and read-after-write verification.',
          contentUr: 'انگریزی اور اردو مواد کی مستقل تصدیق۔',
          category: 'pakistan',
          status: 'draft',
          tags: ['diag-test'],
        },
        actor,
        authCtx
      );
      steps.push({
        step: `2. Save Draft to ${supabaseActive ? 'Supabase PostgreSQL' : 'Database'} & Read-After-Write`,
        ok: created.verifiedReadBack && created.storageEngine === targetEngine && created.article.status === 'draft',
        durationMs: Date.now() - t1,
        detail: `ID=${created.article.id}, engine=${created.storageEngine}, EN+UR=${Boolean(created.article.contentEn && created.article.contentUr)}`,
      });

      const t2 = Date.now();
      const published = await this.transitionStatus(probeId, 'published', actor, undefined, authCtx);
      steps.push({
        step: '3. Publish Article & Set Timestamp',
        ok: published.article.status === 'published' && published.storageEngine === targetEngine && Boolean(published.article.publishedAt),
        durationMs: Date.now() - t2,
        detail: `publishedAt=${published.article.publishedAt}, engine=${published.storageEngine}`,
      });

      const t3 = Date.now();
      const listRes = await this.listArticles({ status: 'published', search: probeSlug }, {});
      const visiblePublicly = listRes.articles.some((a) => a.id === probeId);
      const slugLookup = supabaseActive ? await getSupabaseArticle(probeSlug) : await getFirestoreArticle(probeSlug);
      steps.push({
        step: '4. Public Published Query & Slug Visibility',
        ok: visiblePublicly && Boolean(slugLookup.ok && slugLookup.article),
        durationMs: Date.now() - t3,
        detail: `publicListMatch=${visiblePublicly}, slugDocFound=${Boolean(slugLookup.article)}`,
      });

      const t4 = Date.now();
      const archived = await this.transitionStatus(probeId, 'archived', actor, undefined, authCtx);
      const deleted = await this.deleteArticle(probeId, actor, true, authCtx);
      steps.push({
        step: '5. Archive Transition & Probe Cleanup',
        ok: archived.article.status === 'archived' && deleted,
        durationMs: Date.now() - t4,
        detail: deleted ? 'Temporary probe archived and removed cleanly.' : 'Cleanup incomplete.',
      });

      return {
        ok: steps.every((s) => s.ok),
        totalDurationMs: Date.now() - started,
        storageEngine: targetEngine,
        steps,
        testedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      try {
        await this.deleteArticle(probeId, actor, true, authCtx);
      } catch {}
      steps.push({
        step: 'Pipeline Exception',
        ok: false,
        durationMs: Date.now() - started,
        detail: err?.message || 'Unexpected error during publishing self-test.',
      });
      return {
        ok: false,
        totalDurationMs: Date.now() - started,
        storageEngine: targetEngine,
        steps,
        error: err?.message || 'Publishing pipeline self-test failed',
        testedAt: new Date().toISOString(),
      };
    }
  }
}
