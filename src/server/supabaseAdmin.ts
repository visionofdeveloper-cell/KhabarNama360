/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Trusted Server-Side Supabase PostgreSQL Admin Client & Article Repository
 *
 * Supports SUPABASE_URL, SUPABASE_SECRET_KEY (and legacy SUPABASE_SERVICE_ROLE_KEY),
 * and SUPABASE_PUBLISHABLE_KEY (with legacy SUPABASE_ANON_KEY).
 * Never exposes secret credentials to client bundles.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Article } from '../types/index.ts';
import { recordServerError } from './errorTracker.ts';

export interface SupabaseEnvConfig {
  url: string;
  publishableKey: string;
  secretKey: string;
  secretKeyMode: 'sb_secret' | 'legacy_service_role' | 'missing';
  publishableKeyMode: 'sb_publishable' | 'legacy_anon' | 'missing';
  configured: boolean;
  projectHost: string | null;
}

export function resolveSupabaseEnvConfig(): SupabaseEnvConfig {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ''
  ).trim();

  const sbSecret = (process.env.SUPABASE_SECRET_KEY || '').trim();
  const legacyService = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const secretKey = sbSecret || legacyService;
  const secretKeyMode: SupabaseEnvConfig['secretKeyMode'] = sbSecret
    ? 'sb_secret'
    : legacyService
    ? 'legacy_service_role'
    : 'missing';

  const sbPub = (process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();
  const legacyAnon = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  const publishableKey = sbPub || legacyAnon;
  const publishableKeyMode: SupabaseEnvConfig['publishableKeyMode'] = sbPub
    ? 'sb_publishable'
    : legacyAnon
    ? 'legacy_anon'
    : 'missing';

  let projectHost: string | null = null;
  if (url) {
    try {
      projectHost = new URL(url).hostname;
    } catch {
      projectHost = 'invalid-url';
    }
  }

  return {
    url,
    publishableKey,
    secretKey,
    secretKeyMode,
    publishableKeyMode,
    configured: Boolean(url && secretKey && projectHost && projectHost !== 'invalid-url'),
    projectHost,
  };
}

export function isSupabaseConfigured(): boolean {
  return resolveSupabaseEnvConfig().configured;
}

let cachedAdminClient: SupabaseClient | null = null;
let cachedAdminSignature = '';

export function getSupabaseAdminClient(): SupabaseClient | null {
  const cfg = resolveSupabaseEnvConfig();
  if (!cfg.configured) return null;
  const sig = `${cfg.url}:${cfg.secretKey.slice(0, 8)}`;
  if (!cachedAdminClient || cachedAdminSignature !== sig) {
    cachedAdminClient = createClient(cfg.url, cfg.secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    cachedAdminSignature = sig;
  }
  return cachedAdminClient;
}

export function getSupabaseAnonClient(): SupabaseClient | null {
  const cfg = resolveSupabaseEnvConfig();
  if (!cfg.url || !cfg.publishableKey) return null;
  return createClient(cfg.url, cfg.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function mapRowToArticle(row: any): Article {
  const seoObj = typeof row.seo_json === 'object' && row.seo_json ? row.seo_json : {};
  const tagsArr = Array.isArray(row.tags) ? row.tags : [];
  const versionsArr = Array.isArray(row.versions_json) ? row.versions_json : undefined;

  return {
    id: String(row.id),
    slug: String(row.slug),
    titleEn: String(row.title_en || ''),
    titleUr: String(row.title_ur || ''),
    summaryEn: String(row.summary_en || ''),
    summaryUr: String(row.summary_ur || ''),
    contentEn: String(row.content_en || ''),
    contentUr: String(row.content_ur || ''),
    category: String(row.category || 'pakistan'),
    tags: tagsArr.map((t: any) => String(t)),
    status: (row.status || 'draft') as Article['status'],
    isBreaking: Boolean(row.is_breaking),
    isFeatured: Boolean(row.is_featured),
    isTrending: Boolean(row.is_trending),
    heroImage:
      String(row.hero_image || '') ||
      'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=1200&q=80',
    imageCaptionEn: String(row.image_caption_en || ''),
    imageCaptionUr: String(row.image_caption_ur || ''),
    readingTimeMin: Number(row.reading_time_min || 3) || 3,
    author: {
      id: String(row.author_id || 'admin-desk'),
      nameEn: String(row.author_name_en || '360Khabarnama Editorial'),
      nameUr: String(row.author_name_ur || 'ادارہ 360 خبرنامہ'),
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      role: (row.author_role || 'Editor') as any,
    },
    publishedAt: row.published_at ? String(row.published_at) : '',
    scheduledAt: row.scheduled_at ? String(row.scheduled_at) : undefined,
    version: Number(row.version || 1) || 1,
    versions: versionsArr,
    workflowNotes: row.workflow_notes ? String(row.workflow_notes) : undefined,
    failureReason: row.failure_reason ? String(row.failure_reason) : undefined,
    views: Number(row.views || 0) || 0,
    seo: seoObj,
    createdBy: row.created_by ? String(row.created_by) : undefined,
    updatedBy: row.updated_by ? String(row.updated_by) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : new Date().toISOString(),
    deletedAt: row.deleted_at ? String(row.deleted_at) : undefined,
  };
}

function buildArticleRow(article: Article, actor: string) {
  return {
    id: article.id,
    slug: article.slug,
    title_en: article.titleEn || '',
    title_ur: article.titleUr || '',
    summary_en: article.summaryEn || '',
    summary_ur: article.summaryUr || '',
    content_en: article.contentEn || '',
    content_ur: article.contentUr || '',
    category: (article.category || 'pakistan').toLowerCase(),
    tags: Array.isArray(article.tags) ? article.tags : [],
    status: article.status || 'draft',
    is_breaking: Boolean(article.isBreaking),
    is_featured: Boolean(article.isFeatured),
    is_trending: Boolean(article.isTrending),
    hero_image: article.heroImage || '',
    image_caption_en: article.imageCaptionEn || '',
    image_caption_ur: article.imageCaptionUr || '',
    reading_time_min: Math.max(1, Math.round(Number(article.readingTimeMin || 3))),
    author_id: article.author?.id || article.createdBy || 'admin-desk',
    author_name_en: article.author?.nameEn || '360Khabarnama Editorial',
    author_name_ur: article.author?.nameUr || 'ادارہ 360 خبرنامہ',
    author_role: article.author?.role || 'Editor',
    seo_json: article.seo || {},
    versions_json: Array.isArray(article.versions) ? article.versions : [],
    workflow_notes: article.workflowNotes || '',
    failure_reason: article.failureReason || '',
    version: Math.max(1, Math.round(Number(article.version || 1))),
    views: Math.max(0, Math.round(Number(article.views || 0))),
    published_at: article.publishedAt ? article.publishedAt : null,
    scheduled_at: article.scheduledAt || article.scheduledFor || null,
    deleted_at: article.deletedAt || null,
    created_by: article.createdBy || actor,
    updated_by: actor,
    updated_at: new Date().toISOString(),
  };
}

export async function listSupabaseArticles(filters: {
  status?: string;
  category?: string;
  tag?: string;
  search?: string;
  includeDeleted?: boolean;
  limit?: number;
}): Promise<{ ok: boolean; articles: Article[]; error?: string }> {
  const client = getSupabaseAdminClient();
  if (!client) {
    return { ok: false, articles: [], error: 'Supabase secret key/URL not configured.' };
  }

  try {
    let query = client
      .from('articles')
      .select('*')
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false })
      .limit(Math.min(Math.max(Number(filters.limit || 250), 1), 500));

    if (!filters.includeDeleted) {
      query = query.is('deleted_at', null);
    }
    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }
    if (filters.category && filters.category !== 'all') {
      query = query.eq('category', filters.category.toLowerCase());
    }

    const { data, error } = await query;
    if (error) {
      return { ok: false, articles: [], error: `${error.code || 'SUPABASE_QUERY'}: ${error.message}` };
    }

    let articles = (data || []).map(mapRowToArticle);
    if (filters.tag) {
      const tLower = filters.tag.toLowerCase();
      articles = articles.filter((a) => a.tags.some((t) => t.toLowerCase() === tLower));
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      articles = articles.filter(
        (a) =>
          a.titleEn.toLowerCase().includes(q) ||
          a.titleUr.includes(q) ||
          a.summaryEn.toLowerCase().includes(q) ||
          a.summaryUr.includes(q) ||
          a.slug.toLowerCase().includes(q)
      );
    }

    return { ok: true, articles };
  } catch (err: any) {
    return { ok: false, articles: [], error: err?.message || 'Supabase article query error' };
  }
}

export async function getSupabaseArticle(
  idOrSlug: string
): Promise<{ ok: boolean; article: Article | null; error?: string }> {
  const client = getSupabaseAdminClient();
  if (!client) {
    return { ok: false, article: null, error: 'Supabase not configured.' };
  }
  const clean = decodeURIComponent(idOrSlug || '').trim();
  if (!clean) return { ok: true, article: null };

  try {
    const byId = await client.from('articles').select('*').eq('id', clean).maybeSingle();
    if (byId.error) {
      return { ok: false, article: null, error: `${byId.error.code || 'SUPABASE_GET'}: ${byId.error.message}` };
    }
    if (byId.data) {
      return { ok: true, article: mapRowToArticle(byId.data) };
    }

    const bySlug = await client.from('articles').select('*').eq('slug', clean.toLowerCase()).maybeSingle();
    if (bySlug.error) {
      return { ok: false, article: null, error: `${bySlug.error.code || 'SUPABASE_GET'}: ${bySlug.error.message}` };
    }
    return { ok: true, article: bySlug.data ? mapRowToArticle(bySlug.data) : null };
  } catch (err: any) {
    return { ok: false, article: null, error: err?.message || 'Supabase get article error' };
  }
}

export async function upsertSupabaseArticle(
  article: Article,
  actor: string
): Promise<{ ok: boolean; article?: Article; code?: string; error?: string }> {
  const client = getSupabaseAdminClient();
  if (!client) {
    return {
      ok: false,
      code: 'SUPABASE_NOT_CONFIGURED',
      error: 'SUPABASE_URL and SUPABASE_SECRET_KEY are required for Supabase PostgreSQL persistence.',
    };
  }

  try {
    const row = buildArticleRow(article, actor);
    const { data, error } = await client
      .from('articles')
      .upsert(row, { onConflict: 'id' })
      .select('*')
      .single();

    if (error || !data) {
      const msg = error?.message || 'Supabase upsert returned no record.';
      recordServerError({
        source: 'supabase',
        code: error?.code || 'SUPABASE_WRITE_FAILED',
        message: `Supabase upsert failed for ${article.id}: ${msg}`,
      });
      return {
        ok: false,
        code: error?.code || 'SUPABASE_WRITE_FAILED',
        error: msg,
      };
    }

    // Read-after-write verification using actual primary key ID
    const verify = await client.from('articles').select('*').eq('id', data.id).single();
    if (verify.error || !verify.data) {
      return {
        ok: false,
        code: 'SUPABASE_READ_AFTER_WRITE_FAILED',
        error: verify.error?.message || 'Upsert succeeded but read-after-write lookup failed.',
      };
    }

    return { ok: true, article: mapRowToArticle(verify.data) };
  } catch (err: any) {
    return {
      ok: false,
      code: 'SUPABASE_EXCEPTION',
      error: err?.message || 'Unexpected error saving article to Supabase.',
    };
  }
}

export async function deleteSupabaseArticle(
  id: string,
  hardDelete: boolean = false
): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabaseAdminClient();
  if (!client) return { ok: false, error: 'Supabase not configured.' };

  try {
    if (hardDelete) {
      const { error } = await client.from('articles').delete().eq('id', id);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }

    const { error } = await client
      .from('articles')
      .update({ deleted_at: new Date().toISOString(), status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Supabase delete failed' };
  }
}
