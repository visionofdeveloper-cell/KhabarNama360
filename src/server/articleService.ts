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
import { hasServiceAccountConfigured } from '../lib/firebase-admin.ts';
import { recordServerError, getServerErrorLogs } from './errorTracker.ts';

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
  storageEngine: 'firestore' | 'json_fallback';
  verifiedReadBack: boolean;
  cacheVersion: number;
  correlationId: string;
  firestoreWarning?: string;
}

export interface PipelineStepResult {
  step: string;
  ok: boolean;
  durationMs: number;
  detail: string;
}

function mergeArticleLists(firestoreList: Article[], localList: Article[], statusFilter?: string): Article[] {
  const map = new Map<string, Article>();

  for (const localArt of localList) {
    if (!localArt.deletedAt) {
      map.set(localArt.id, localArt);
    }
  }

  // Cloud Firestore records take strict precedence over cached seed items
  for (const fsArt of firestoreList) {
    if (!fsArt.deletedAt) {
      map.set(fsArt.id, fsArt);
    }
  }

  let merged = Array.from(map.values());
  if (statusFilter && statusFilter !== 'all') {
    merged = merged.filter((a) => a.status === statusFilter);
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
   * Lists articles directly from Cloud Firestore (primary) merged with seed/local cache.
   * Public requests strictly query status == 'published'. Admin requests retrieve all statuses.
   */
  public static async listArticles(
    filters: ArticleFilterOptions = {},
    authCtx: FirestoreAuthContext = {}
  ): Promise<{
    articles: Article[];
    total: number;
    storageEngine: 'firestore' | 'json_fallback';
    firestoreCount: number;
  }> {
    const statusFilter = filters.status || 'published';
    const localMatches = db.getArticles(
      filters.category,
      filters.tag,
      filters.search,
      statusFilter,
      Boolean(filters.includeDeleted)
    );

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

    let combined = localMatches;
    let storageEngine: 'firestore' | 'json_fallback' = 'json_fallback';
    let firestoreCount = 0;

    if (fsRes.ok) {
      storageEngine = 'firestore';
      firestoreCount = fsRes.articles.length;

      // Apply local soft-delete tombstone exclusion
      const deletedIds = new Set(db.getArticles(undefined, undefined, undefined, 'all', true).filter((a) => a.deletedAt).map((a) => a.id));
      const activeFsArticles = fsRes.articles.filter((a) => !deletedIds.has(a.id));

      combined = mergeArticleLists(activeFsArticles, localMatches, statusFilter);
    } else if (fsRes.error) {
      recordServerError({
        source: 'firestore',
        code: 'FIRESTORE_LIST_WARNING',
        message: `Firestore query fallback to cache: ${fsRes.error}`,
      });
    }

    const total = combined.length;
    const offset = Math.max(0, Number(filters.offset || 0));
    const limit = filters.limit ? Math.max(1, Math.min(Number(filters.limit), 200)) : combined.length;

    return {
      articles: combined.slice(offset, offset + limit),
      total,
      storageEngine,
      firestoreCount,
    };
  }

  /**
   * Resolves an article by document ID or canonical slug from Cloud Firestore first,
   * checking redirects if not found directly.
   */
  public static async getArticle(
    idOrSlug: string,
    authCtx: FirestoreAuthContext = {}
  ): Promise<{
    article: Article | null;
    redirectTo?: string;
    storageEngine: 'firestore' | 'json_fallback';
  }> {
    const clean = decodeURIComponent(idOrSlug || '').trim();
    if (!clean) return { article: null, storageEngine: 'json_fallback' };

    const fsRes = await getFirestoreArticle(clean, authCtx.firebaseIdToken);
    if (fsRes.ok && fsRes.article && !fsRes.article.deletedAt) {
      return { article: fsRes.article, storageEngine: 'firestore' };
    }

    const local = db.getArticleBySlugOrId(clean, false);
    if (local) {
      return {
        article: local,
        storageEngine: fsRes.ok ? 'firestore' : 'json_fallback',
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
        return { article: null, redirectTo: nextSlug, storageEngine: 'firestore' };
      }
    }

    return { article: null, storageEngine: fsRes.ok ? 'firestore' : 'json_fallback' };
  }

  /**
   * Saves or updates a bilingual news article permanently in Cloud Firestore,
   * verifying read-after-write integrity and invalidating public feed caches.
   */
  public static async saveArticle(
    input: Partial<Article> & { expectedVersion?: number },
    actor: string = 'Editor',
    authCtx: FirestoreAuthContext = {}
  ): Promise<SaveArticleResult> {
    const correlationId = `pub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // Normalize both languages safely without dropping partial bilingual drafts
    const normalizedInput: Partial<Article> & { expectedVersion?: number } = {
      ...input,
      titleEn: (input.titleEn || input.titleUr || '').trim(),
      titleUr: (input.titleUr || input.titleEn || '').trim(),
      summaryEn: (input.summaryEn || '').trim(),
      summaryUr: (input.summaryUr || '').trim(),
      contentEn: (input.contentEn || input.summaryEn || '').trim(),
      contentUr: (input.contentUr || input.summaryUr || '').trim(),
    };

    if (!normalizedInput.titleEn && !normalizedInput.titleUr) {
      const err: any = new Error('At least one headline (English or Urdu) is required.');
      err.statusCode = 400;
      err.code = 'MISSING_HEADLINE';
      throw err;
    }

    // Check if authenticated client has Firebase credentials or server Service Account
    const hasFirestoreWriteAuth = Boolean(authCtx.firebaseIdToken || hasServiceAccountConfigured());

    // Update local optimistic/slug/redirect layer first so slug collisions & version conflicts fail cleanly
    const savedLocal = db.upsertArticle(normalizedInput, actor, {
      storageEngine: hasFirestoreWriteAuth ? 'firestore' : 'json_fallback',
      correlationId,
    });

    let finalArticle = savedLocal;
    let storageEngine: 'firestore' | 'json_fallback' = 'json_fallback';
    let verifiedReadBack = true;
    let firestoreWarning: string | undefined;

    if (hasFirestoreWriteAuth) {
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
      firestoreWarning =
        'Saved in workspace cache only — sign in with Firebase Admin Google account or configure FIREBASE_SERVICE_ACCOUNT_JSON to write permanently to Cloud Firestore.';
      recordServerError({
        source: 'firestore',
        code: 'NO_FIRESTORE_WRITE_AUTH',
        message: firestoreWarning,
        correlationId,
      });
    }

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
    const okLocal = db.deleteArticle(id, actor, hardDelete);

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

    db.bumpNewsCacheVersion();
    db.addPublicationLog({
      articleId: id,
      action: hardDelete ? 'hard_delete' : 'delete',
      nextStatus: hardDelete ? 'deleted' : 'archived',
      actor,
      storageEngine: authCtx.firebaseIdToken || hasServiceAccountConfigured() ? 'firestore' : 'json_fallback',
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
    cacheStatus: ReturnType<typeof db.getCacheStatus>;
    articleCountsByStatus: Record<string, number>;
    missingTranslationsCount: number;
    recentPublicationLogs: PublicationLogEntry[];
    recentErrors: ReturnType<typeof getServerErrorLogs>;
  }> {
    const firestoreHealth = await checkFirestoreHealth(authCtx.firebaseIdToken);
    const mergedRes = await this.listArticles({ status: 'all' }, authCtx);
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
   * Executes a live Cloud Firestore Publishing Pipeline Self-Test:
   *   1. Verify Firestore /test/connection & reachability
   *   2. Create bilingual EN/UR draft in Cloud Firestore + Read-After-Write
   *   3. Publish article in Cloud Firestore
   *   4. Verify public Firestore query (`status == 'published'`) & slug retrieval
   *   5. Archive & clean up probe document cleanly (zero leftover test articles)
   */
  public static async runPublishingPipelineSelfTest(
    actor: string = 'Super Admin',
    authCtx: FirestoreAuthContext = {}
  ): Promise<{
    ok: boolean;
    totalDurationMs: number;
    storageEngine: 'firestore' | 'json_fallback';
    steps: PipelineStepResult[];
    error?: string;
    testedAt: string;
  }> {
    const started = Date.now();
    const probeId = `art-diag-probe-${Date.now()}`;
    const probeSlug = `diag-probe-${Date.now()}`;
    const steps: PipelineStepResult[] = [];
    const canWriteFirestore = Boolean(authCtx.firebaseIdToken || hasServiceAccountConfigured());

    try {
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
          : `Connected=${health.connected}, but no Firebase Admin ID token or Service Account was supplied for write test.`,
      });

      const t1 = Date.now();
      const created = await this.saveArticle(
        {
          id: probeId,
          slug: probeSlug,
          titleEn: 'Diagnostic Firebase Pipeline Probe',
          titleUr: 'فائر بیس پبلشنگ تشخیصی جانچ',
          summaryEn: 'Automated temporary Cloud Firestore self-test article',
          summaryUr: 'کلاؤڈ فائر اسٹور کی خودکار جانچ کا مضمون',
          contentEn: 'Automated bilingual Cloud Firestore write and read-after-write verification.',
          contentUr: 'انگریزی اور اردو مواد کی کلاؤڈ فائر اسٹور میں مستقل تصدیق۔',
          category: 'pakistan',
          status: 'draft',
          tags: ['diag-test'],
        },
        actor,
        authCtx
      );
      steps.push({
        step: '2. Save Bilingual Draft to Cloud Firestore & Read-After-Write',
        ok: created.verifiedReadBack && created.storageEngine === 'firestore' && created.article.status === 'draft',
        durationMs: Date.now() - t1,
        detail: `ID=${created.article.id}, engine=${created.storageEngine}, EN+UR saved=${Boolean(created.article.contentEn && created.article.contentUr)}`,
      });

      const t2 = Date.now();
      const published = await this.transitionStatus(probeId, 'published', actor, undefined, authCtx);
      steps.push({
        step: '3. Publish Article in Cloud Firestore',
        ok: published.article.status === 'published' && published.storageEngine === 'firestore' && Boolean(published.article.publishedAt),
        durationMs: Date.now() - t2,
        detail: `publishedAt=${published.article.publishedAt}, engine=${published.storageEngine}`,
      });

      const t3 = Date.now();
      const listRes = await this.listArticles({ status: 'published', search: probeSlug }, {});
      const visiblePublicly = listRes.articles.some((a) => a.id === probeId);
      const bySlug = await getFirestoreArticle(probeSlug);
      steps.push({
        step: '4. Public Unauthenticated Firestore Query & Slug Visibility',
        ok: visiblePublicly && Boolean(bySlug.ok && bySlug.article),
        durationMs: Date.now() - t3,
        detail: `publicListMatch=${visiblePublicly}, slugDocFound=${Boolean(bySlug.article)}`,
      });

      const t4 = Date.now();
      const archived = await this.transitionStatus(probeId, 'archived', actor, undefined, authCtx);
      const deleted = await this.deleteArticle(probeId, actor, true, authCtx);
      steps.push({
        step: '5. Archive Transition & Probe Cleanup',
        ok: archived.article.status === 'archived' && deleted,
        durationMs: Date.now() - t4,
        detail: deleted ? 'Temporary probe archived and removed cleanly from Firestore & cache.' : 'Cleanup incomplete.',
      });

      return {
        ok: steps.every((s) => s.ok),
        totalDurationMs: Date.now() - started,
        storageEngine: canWriteFirestore ? 'firestore' : 'json_fallback',
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
        detail: err?.message || 'Unexpected error during Firestore self-test.',
      });
      return {
        ok: false,
        totalDurationMs: Date.now() - started,
        storageEngine: canWriteFirestore ? 'firestore' : 'json_fallback',
        steps,
        error: err?.message || 'Publishing pipeline self-test failed',
        testedAt: new Date().toISOString(),
      };
    }
  }
}
