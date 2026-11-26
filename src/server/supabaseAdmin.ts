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
import {
  AIConnectionTestRecord,
  AIProviderCredential,
  AITaskRouting,
  Article,
} from '../types/index.ts';
import { recordServerError } from './errorTracker.ts';

export interface SupabaseEnvConfig {
  url: string;
  publishableKey: string;
  secretKey: string;
  urlEnvName: string | null;
  secretEnvName: string | null;
  publishableEnvName: string | null;
  supabaseUrlConfigured: boolean;
  supabaseSecretConfigured: boolean;
  secretKeyMode: 'sb_secret' | 'legacy_service_role' | 'misconfigured_anon_or_publishable' | 'missing';
  publishableKeyMode: 'sb_publishable' | 'legacy_anon' | 'missing';
  secretKeyMisconfiguration?: string;
  urlMisconfiguration?: string;
  configured: boolean;
  projectHost: string | null;
  projectRef: string | null;
}

export interface BackendRuntimeInfo {
  runtime:
    | 'vercel_serverless'
    | 'google_ai_studio'
    | 'aws_lambda'
    | 'namecheap_node_production'
    | 'local_dev_preview';
  shortName: 'Vercel' | 'Google AI Studio' | 'Other';
  deploymentEnv: 'Production' | 'Preview' | 'Development';
  label: string;
  isServerless: boolean;
  isGoogleAiStudio: boolean;
  isProduction: boolean;
  region?: string;
  envHint: string;
}

export function detectBackendRuntimeInfo(): BackendRuntimeInfo {
  if (
    process.env.VERCEL ||
    process.env.VERCEL_ENV ||
    process.env.VERCEL_REGION ||
    process.env.NOW_REGION
  ) {
    const isProd = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
    const deploymentEnv: BackendRuntimeInfo['deploymentEnv'] = isProd
      ? 'Production'
      : process.env.VERCEL_ENV === 'preview'
      ? 'Preview'
      : 'Development';
    return {
      runtime: 'vercel_serverless',
      shortName: 'Vercel',
      deploymentEnv,
      label: 'Vercel Serverless Function',
      isServerless: true,
      isGoogleAiStudio: false,
      isProduction: isProd,
      region: process.env.VERCEL_REGION || process.env.NOW_REGION || undefined,
      envHint: 'Vercel Dashboard → Project Settings → Environment Variables (Production Scope) → Redeploy',
    };
  }
  if (
    process.env.K_SERVICE ||
    process.env.K_REVISION ||
    process.env.K_CONFIGURATION ||
    process.env.GOOGLE_RUNTIME
  ) {
    const isProd = process.env.NODE_ENV === 'production';
    const deploymentEnv: BackendRuntimeInfo['deploymentEnv'] = isProd
      ? 'Production'
      : 'Preview';
    return {
      runtime: 'google_ai_studio',
      shortName: 'Google AI Studio',
      deploymentEnv,
      label: 'Google AI Studio (Cloud Run Backend)',
      isServerless: false,
      isGoogleAiStudio: true,
      isProduction: isProd,
      region: process.env.GOOGLE_CLOUD_REGION || undefined,
      envHint: 'Google AI Studio → Settings / Secrets (add SUPABASE_URL & SUPABASE_SECRET_KEY) → Restart / Reload App',
    };
  }
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return {
      runtime: 'aws_lambda',
      shortName: 'Other',
      deploymentEnv: 'Production',
      label: 'AWS Lambda Serverless',
      isServerless: true,
      isGoogleAiStudio: false,
      isProduction: true,
      region: process.env.AWS_REGION || undefined,
      envHint: 'Lambda / Hosting Environment Variables → Redeploy',
    };
  }
  if (process.env.NODE_ENV === 'production') {
    return {
      runtime: 'namecheap_node_production',
      shortName: 'Other',
      deploymentEnv: 'Production',
      label: 'Namecheap Node.js Production',
      isServerless: false,
      isGoogleAiStudio: false,
      isProduction: true,
      envHint: 'cPanel → Setup Node.js App → Environment Variables (or .env at app root) → Restart App',
    };
  }
  return {
    runtime: 'local_dev_preview',
    shortName: 'Other',
    deploymentEnv: 'Development',
    label: 'Development / Preview Node.js Server',
    isServerless: false,
    isGoogleAiStudio: false,
    isProduction: false,
    envHint: 'Environment Secrets / .env file',
  };
}

function cleanEnvValue(raw?: string): string {
  if (!raw) return '';
  let trimmed = String(raw).trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function pickEnvVar(
  preferredNames: string[],
  fallbackPattern?: RegExp
): { value: string; envName: string | null } {
  for (const name of preferredNames) {
    const val = cleanEnvValue(process.env[name]);
    if (val) return { value: val, envName: name };
  }
  if (fallbackPattern) {
    const dynamicNames = Object.keys(process.env)
      .filter(k => fallbackPattern.test(k))
      .sort();
    for (const name of dynamicNames) {
      const val = cleanEnvValue(process.env[name]);
      if (val) return { value: val, envName: name };
    }
  }
  return { value: '', envName: null };
}

function normalizeSupabaseUrl(raw: string): string {
  if (!raw) return '';
  let normalized = raw.replace(/\/+$/, '');
  if (normalized && !/^https?:\/\//i.test(normalized)) {
    const scheme = /^(localhost|127\.0\.0\.1)(:|\/|$)/i.test(normalized) ? 'http://' : 'https://';
    normalized = `${scheme}${normalized}`;
  }
  return normalized;
}

function inspectJwtRoleClaim(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return typeof payload?.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

export function resolveSupabaseEnvConfig(): SupabaseEnvConfig {
  const urlPick = pickEnvVar(
    [
      'SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_URL',
      'VITE_SUPABASE_URL',
      'STORAGE_SUPABASE_URL',
      'STORAGE_NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_PROJECT_URL',
      'VITE_SUPABASE_PROJECT_URL',
    ],
    /^[A-Z0-9_]+_SUPABASE_URL$/
  );
  const url = normalizeSupabaseUrl(urlPick.value);

  const sbSecretPick = pickEnvVar(
    [
      'SUPABASE_SECRET_KEY',
      'STORAGE_SUPABASE_SECRET_KEY',
    ],
    /^[A-Z0-9_]+_SUPABASE_SECRET_KEY$/
  );
  const legacyServicePick = pickEnvVar(
    [
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_SERVICE_KEY',
      'STORAGE_SUPABASE_SERVICE_ROLE_KEY',
    ],
    /^[A-Z0-9_]+_SUPABASE_SERVICE_ROLE_KEY$/
  );

  const secretKey = sbSecretPick.value || legacyServicePick.value;
  const secretEnvName = sbSecretPick.value ? sbSecretPick.envName : legacyServicePick.envName;
  let secretKeyMisconfiguration: string | undefined;
  let secretKeyMode: SupabaseEnvConfig['secretKeyMode'] = sbSecretPick.value
    ? 'sb_secret'
    : legacyServicePick.value
    ? 'legacy_service_role'
    : 'missing';

  if (secretKey) {
    if (secretKey.startsWith('sb_publishable_')) {
      secretKeyMode = 'misconfigured_anon_or_publishable';
      secretKeyMisconfiguration = `${secretEnvName || 'SUPABASE_SECRET_KEY'} holds a publishable key (sb_publishable_*); RLS blocks AI vault reads/writes unless a server secret/service_role key is set.`;
    } else {
      const jwtRole = inspectJwtRoleClaim(secretKey);
      if (jwtRole && jwtRole !== 'service_role') {
        secretKeyMode = 'misconfigured_anon_or_publishable';
        secretKeyMisconfiguration = `${secretEnvName || 'SUPABASE_SECRET_KEY'} JWT has role="${jwtRole}" instead of "service_role"; RLS blocks AI vault operations.`;
      }
    }
  }

  const sbPubPick = pickEnvVar(
    [
      'SUPABASE_PUBLISHABLE_KEY',
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      'VITE_SUPABASE_PUBLISHABLE_KEY',
    ],
    /^[A-Z0-9_]+_SUPABASE_PUBLISHABLE_KEY$/
  );
  const legacyAnonPick = pickEnvVar(
    [
      'SUPABASE_ANON_KEY',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'VITE_SUPABASE_ANON_KEY',
      'STORAGE_SUPABASE_ANON_KEY',
      'STORAGE_NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ],
    /^[A-Z0-9_]+_SUPABASE_ANON_KEY$/
  );
  const publishableKey = sbPubPick.value || legacyAnonPick.value;
  const publishableEnvName = sbPubPick.value ? sbPubPick.envName : legacyAnonPick.envName;
  const publishableKeyMode: SupabaseEnvConfig['publishableKeyMode'] = sbPubPick.value
    ? 'sb_publishable'
    : legacyAnonPick.value
    ? 'legacy_anon'
    : 'missing';

  let projectHost: string | null = null;
  let projectRef: string | null = null;
  let urlMisconfiguration: string | undefined;
  if (url) {
    try {
      const parsed = new URL(url);
      projectHost = parsed.hostname;
      if (!projectHost || !projectHost.includes('.')) {
        projectHost = 'invalid-url';
        urlMisconfiguration = `${urlEnvNameLabel(urlPick.envName)} is not a valid HTTPS Supabase project URL.`;
      } else {
        const refMatch = projectHost.match(/^([a-z0-9-]+)\.supabase\.(co|in|net)$/i);
        if (refMatch) {
          projectRef = refMatch[1];
        }
      }
    } catch {
      projectHost = 'invalid-url';
      urlMisconfiguration = `${urlEnvNameLabel(urlPick.envName)} could not be parsed as a valid URL.`;
    }
  }

  const supabaseUrlConfigured = Boolean(url && projectHost && projectHost !== 'invalid-url');
  const supabaseSecretConfigured = Boolean(secretKey && secretKeyMode !== 'misconfigured_anon_or_publishable');

  return {
    url,
    publishableKey,
    secretKey,
    urlEnvName: urlPick.envName,
    secretEnvName,
    publishableEnvName,
    supabaseUrlConfigured,
    supabaseSecretConfigured,
    secretKeyMode,
    publishableKeyMode,
    secretKeyMisconfiguration,
    urlMisconfiguration,
    configured: supabaseUrlConfigured && supabaseSecretConfigured,
    projectHost,
    projectRef,
  };
}

export const RECOMMENDED_AI_MIGRATION_FILE =
  'database/supabase_migrations/007_ai_provider_credentials_repair_and_schema.sql';

export function classifySupabaseTableError(err?: { code?: string; message?: string } | null):
  | 'missing_or_schema_cache'
  | 'missing_columns_or_schema_cache'
  | 'permission_or_rls'
  | 'connection_or_auth'
  | 'other'
  | null {
  if (!err) return null;
  const code = String(err.code || '').toUpperCase();
  const msg = String(err.message || '');
  if (
    code === 'PGRST205' ||
    code === '42P01' ||
    /could not find the table .* in the schema cache|relation .* does not exist/i.test(msg)
  ) {
    return 'missing_or_schema_cache';
  }
  if (
    code === '42703' ||
    code === 'PGRST204' ||
    /column .* does not exist|could not find the ['"]?[^'"]+['"]? column/i.test(msg)
  ) {
    return 'missing_columns_or_schema_cache';
  }
  if (code === '42501' || /permission denied|row-level security/i.test(msg)) {
    return 'permission_or_rls';
  }
  if (/fetch failed|network|ENOTFOUND|ECONNREFUSED|Invalid API key|JWT|apikey/i.test(msg)) {
    return 'connection_or_auth';
  }
  return 'other';
}

function formatSupabaseAiTableError(err: { code?: string; message?: string } | null | undefined, tableName: string): string {
  const base = err?.message || `Database error accessing public.${tableName}`;
  const kind = classifySupabaseTableError(err);
  if (kind === 'missing_or_schema_cache' || kind === 'missing_columns_or_schema_cache') {
    return `${base} Apply ${RECOMMENDED_AI_MIGRATION_FILE} (non-destructive, includes NOTIFY pgrst, 'reload schema';) in Supabase Dashboard → SQL Editor.`;
  }
  return base;
}

function urlEnvNameLabel(name: string | null): string {
  return name || 'SUPABASE_URL';
}

export function getMissingSupabaseConfigGuidance(): string {
  const cfg = resolveSupabaseEnvConfig();
  const runtime = detectBackendRuntimeInfo();
  const issues: string[] = [];
  if (!cfg.supabaseUrlConfigured) {
    issues.push(cfg.urlMisconfiguration || 'SUPABASE_URL is missing');
  }
  if (!cfg.supabaseSecretConfigured) {
    issues.push(
      cfg.secretKeyMisconfiguration ||
        'SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) is missing'
    );
  }
  if (issues.length === 0) return '';
  return `Persistent database unavailable (${runtime.label}): ${issues.join('; ')}. Configure SUPABASE_URL and SUPABASE_SECRET_KEY in ${runtime.envHint}. Ephemeral /tmp writes are disabled in production.`;
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
    featuredImage: row.featured_image ? String(row.featured_image) : undefined,
    heroImageMeta:
      typeof row.hero_image_meta_json === 'object' && row.hero_image_meta_json
        ? row.hero_image_meta_json
        : undefined,
    featuredImageMeta:
      typeof row.featured_image_meta_json === 'object' && row.featured_image_meta_json
        ? row.featured_image_meta_json
        : undefined,
    socialImageUrl: row.social_image_url ? String(row.social_image_url) : undefined,
    useHeroAsFeatured:
      typeof row.use_hero_as_featured === 'boolean' ? row.use_hero_as_featured : true,
    homepageSlot: row.homepage_slot ? (String(row.homepage_slot) as Article['homepageSlot']) : undefined,
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
    featured_image: article.featuredImage || null,
    hero_image_meta_json: article.heroImageMeta || null,
    featured_image_meta_json: article.featuredImageMeta || null,
    social_image_url: article.socialImageUrl || null,
    use_hero_as_featured: article.useHeroAsFeatured ?? true,
    homepage_slot: article.homepageSlot || null,
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
    let { data, error } = await client
      .from('articles')
      .upsert(row, { onConflict: 'id' })
      .select('*')
      .single();

    // If database still has legacy Migration 001 CHECK constraint rejecting 'review' or 'approved',
    // retry cleanly mapped to 'in_review' / 'scheduled' so saves never fail before repair SQL runs.
    if (error && (error.code === '23514' || /check constraint/i.test(error.message || ''))) {
      const legacyStatusMap: Record<string, string> = {
        review: 'in_review',
        approved: 'scheduled',
        rejected: 'archived',
      };
      const mappedStatus = legacyStatusMap[String(row.status)] || 'draft';
      ({ data, error } = await client
        .from('articles')
        .upsert({ ...row, status: mappedStatus }, { onConflict: 'id' })
        .select('*')
        .single());
    }

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

// -----------------------------------------------------------------------------
// AI Provider Credentials, Task Routes & Connection Tests (Supabase PostgreSQL)
// -----------------------------------------------------------------------------

function mapRowToAiCredential(row: any): AIProviderCredential {
  const diag =
    row.last_diagnostic_json && typeof row.last_diagnostic_json === 'object'
      ? row.last_diagnostic_json
      : null;
  const billingMeta = (diag as any)?._billingMeta;
  const cleanedDiag = diag ? { ...diag } : null;
  if (cleanedDiag && '_billingMeta' in cleanedDiag) {
    delete (cleanedDiag as any)._billingMeta;
  }

  return {
    id: String(row.id),
    providerType: (row.provider_type || 'gemini') as AIProviderCredential['providerType'],
    label: String(row.label || 'AI Provider'),
    projectId: String(row.project_id || 'default-project'),
    endpointUrl: row.endpoint_url ? String(row.endpoint_url) : undefined,
    model: String(row.model || ''),
    encryptedSecret: String(row.encrypted_secret || ''),
    maskedKey: String(row.masked_key || ''),
    enabled: Boolean(row.enabled),
    priority: Number(row.priority ?? 10),
    dailyTokenLimit: Number(row.daily_token_limit ?? 500000),
    dailyTokensUsed: Number(row.daily_tokens_used ?? 0),
    monthlyBudgetUsd: Number(row.monthly_budget_usd ?? 25),
    monthlySpendUsd: Number(row.monthly_spend_usd ?? 0),
    availableModels: Array.isArray(row.available_models_json) ? row.available_models_json : [],
    connectionStatus: (row.connection_status || 'untested') as AIProviderCredential['connectionStatus'],
    billingStatus: row.billing_status || billingMeta?.billingStatus,
    billingNote: row.billing_note || billingMeta?.billingNote,
    modelListStatus:
      row.model_list_status ||
      (Array.isArray(row.available_models_json) && row.available_models_json.length > 0 ? 'ok' : 'untested'),
    generationTestStatus:
      row.generation_test_status ||
      (row.last_test_status === 'connected' ? 'ok' : row.last_test_status === 'error' ? 'error' : 'untested'),
    lastTestedAt: row.last_tested_at ? String(row.last_tested_at) : null,
    lastSuccessfulVerificationAt: row.last_successful_verification_at
      ? String(row.last_successful_verification_at)
      : null,
    lastSuccessfulGenerationAt: row.last_successful_generation_at
      ? String(row.last_successful_generation_at)
      : null,
    lastFailureAt: row.last_failure_at ? String(row.last_failure_at) : null,
    lastTestStatus: (row.last_test_status || 'untested') as AIProviderCredential['lastTestStatus'],
    lastTestMessage: row.last_test_message ? String(row.last_test_message) : undefined,
    lastLatencyMs: typeof row.last_latency_ms === 'number' ? row.last_latency_ms : undefined,
    lastCorrelationId: row.last_correlation_id ? String(row.last_correlation_id) : undefined,
    lastDiagnostic: cleanedDiag && Object.keys(cleanedDiag).length > 0 ? cleanedDiag : null,
    rateLimitInfo:
      row.rate_limit_info_json && typeof row.rate_limit_info_json === 'object'
        ? row.rate_limit_info_json
        : undefined,
    createdAt: row.created_at ? String(row.created_at) : new Date().toISOString(),
    updatedAt: row.updated_at ? String(row.updated_at) : new Date().toISOString(),
  };
}

export async function listSupabaseAiCredentials(): Promise<{
  ok: boolean;
  credentials: AIProviderCredential[];
  error?: string;
  code?: string;
}> {
  const client = getSupabaseAdminClient();
  if (!client) {
    return { ok: false, credentials: [], code: 'SUPABASE_NOT_CONFIGURED', error: 'Supabase not configured.' };
  }
  try {
    const { data, error } = await client
      .from('ai_provider_credentials')
      .select('*')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });
    if (error) {
      return {
        ok: false,
        credentials: [],
        code: error.code || 'SUPABASE_SELECT_ERR',
        error: formatSupabaseAiTableError(error, 'ai_provider_credentials'),
      };
    }
    return { ok: true, credentials: (data || []).map(mapRowToAiCredential) };
  } catch (err: any) {
    return {
      ok: false,
      credentials: [],
      code: 'SUPABASE_EXCEPTION',
      error: err?.message || 'Failed listing Supabase AI credentials',
    };
  }
}

export async function upsertSupabaseAiCredential(
  cred: AIProviderCredential,
  opts?: { isNew?: boolean }
): Promise<{ ok: boolean; credential?: AIProviderCredential; error?: string; code?: string; warning?: string }> {
  const client = getSupabaseAdminClient();
  if (!client) {
    return { ok: false, code: 'SUPABASE_NOT_CONFIGURED', error: 'Supabase not configured.' };
  }
  try {
    const diagPayload =
      cred.lastDiagnostic || cred.billingStatus
        ? {
            ...(cred.lastDiagnostic || {}),
            _billingMeta: {
              billingStatus: cred.billingStatus || 'unknown',
              billingNote: cred.billingNote || '',
            },
          }
        : null;

    // Never mutate primary key `id` or `created_at` on INSERT/UPDATE so bigint identity columns are always preserved.
    const coreFields = {
      provider_type: cred.providerType,
      label: cred.label,
      project_id: cred.projectId,
      endpoint_url: cred.endpointUrl || null,
      model: cred.model || '',
      encrypted_secret: cred.encryptedSecret,
      masked_key: cred.maskedKey,
      enabled: Boolean(cred.enabled),
      priority: Number(cred.priority ?? 10),
      connection_status: cred.connectionStatus || 'untested',
      available_models_json: Array.isArray(cred.availableModels) ? cred.availableModels : [],
      last_tested_at: cred.lastTestedAt || null,
      last_test_status: cred.lastTestStatus || 'untested',
      last_test_message: cred.lastTestMessage || '',
      last_diagnostic_json: diagPayload,
      updated_at: new Date().toISOString(),
    };

    const extendedFields = {
      ...coreFields,
      daily_token_limit: Number(cred.dailyTokenLimit ?? 500000),
      daily_tokens_used: Number(cred.dailyTokensUsed ?? 0),
      monthly_budget_usd: Number(cred.monthlyBudgetUsd ?? 25),
      monthly_spend_usd: Number(cred.monthlySpendUsd ?? 0),
      billing_status: cred.billingStatus || 'unknown',
      billing_note: cred.billingNote || '',
      model_list_status: cred.modelListStatus || 'untested',
      generation_test_status: cred.generationTestStatus || 'untested',
      last_successful_verification_at: cred.lastSuccessfulVerificationAt || null,
      last_successful_generation_at: cred.lastSuccessfulGenerationAt || null,
      last_failure_at: cred.lastFailureAt || null,
      last_latency_ms: typeof cred.lastLatencyMs === 'number' ? Math.round(cred.lastLatencyMs) : null,
      last_correlation_id: cred.lastCorrelationId || null,
      rate_limit_info_json: cred.rateLimitInfo || null,
    };

    const rawId = String(cred.id || '').trim();
    const shouldInsert = Boolean(opts?.isNew) || !rawId || rawId.startsWith('pending-');

    const performWrite = async (payload: Record<string, any>) => {
      if (shouldInsert) {
        return client.from('ai_provider_credentials').insert(payload).select('*').single();
      }
      return client.from('ai_provider_credentials').update(payload).eq('id', rawId).select('*').single();
    };

    let warning: string | undefined;
    let writeRes = await performWrite(extendedFields);

    if (
      writeRes.error &&
      writeRes.error.code !== 'PGRST205' &&
      writeRes.error.code !== '42P01' &&
      (writeRes.error.code === '42703' ||
        writeRes.error.code === 'PGRST204' ||
        /column .* does not exist|could not find the .* column/i.test(writeRes.error.message || ''))
    ) {
      warning = 'Extended AI columns not yet applied on live Supabase; attempting core columns sync.';
      writeRes = await performWrite(coreFields);
    }

    if (writeRes.error || !writeRes.data) {
      const isNotFound = writeRes.error?.code === 'PGRST116' || writeRes.error?.code === '22P02';
      const errMsg =
        isNotFound && !shouldInsert
          ? `AI credential "${rawId}" was not found in Supabase.`
          : formatSupabaseAiTableError(writeRes.error, 'ai_provider_credentials');
      const errCode = isNotFound && !shouldInsert ? 'NOT_FOUND' : writeRes.error?.code || 'SUPABASE_AI_UPSERT_ERR';
      recordServerError({
        source: 'supabase',
        code: errCode,
        message: `Supabase AI credential ${shouldInsert ? 'insert' : 'update'} failed (${rawId || 'new'}): ${errMsg}`,
      });
      return { ok: false, code: errCode, error: errMsg };
    }

    // Read-after-write verification using database-assigned primary key
    const verify = await client
      .from('ai_provider_credentials')
      .select('*')
      .eq('id', writeRes.data.id)
      .single();

    if (verify.error || !verify.data) {
      return {
        ok: false,
        code: verify.error?.code || 'SUPABASE_AI_READBACK_ERR',
        error: verify.error?.message || 'Record persisted but read-after-write lookup failed.',
      };
    }

    return { ok: true, credential: mapRowToAiCredential(verify.data), warning };
  } catch (err: any) {
    return {
      ok: false,
      code: 'SUPABASE_AI_EXCEPTION',
      error: err?.message || 'Supabase AI credential sync error',
    };
  }
}

export async function deleteSupabaseAiCredential(
  id: string
): Promise<{ ok: boolean; deletedCount: number; error?: string; code?: string }> {
  const client = getSupabaseAdminClient();
  if (!client) {
    return { ok: false, deletedCount: 0, code: 'SUPABASE_NOT_CONFIGURED', error: 'Supabase not configured.' };
  }
  try {
    const { data: deletedRows, error } = await client
      .from('ai_provider_credentials')
      .delete()
      .eq('id', id)
      .select('id');

    if (error) {
      if (error.code === '22P02') {
        return {
          ok: false,
          deletedCount: 0,
          code: 'NOT_FOUND',
          error: `Credential "${id}" was not found in Supabase (0 rows deleted).`,
        };
      }
      recordServerError({
        source: 'supabase',
        code: error.code || 'SUPABASE_AI_DELETE_ERR',
        message: `Supabase AI credential delete failed (${id}): ${error.message}`,
      });
      return { ok: false, deletedCount: 0, code: error.code || 'SUPABASE_AI_DELETE_ERR', error: error.message };
    }

    const count = Array.isArray(deletedRows) ? deletedRows.length : 0;
    if (count === 0) {
      return {
        ok: false,
        deletedCount: 0,
        code: 'NOT_FOUND',
        error: `Credential "${id}" was not found in Supabase (0 rows deleted).`,
      };
    }

    // Verify record is genuinely absent after delete
    const verify = await client
      .from('ai_provider_credentials')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (verify.error) {
      return {
        ok: false,
        deletedCount: count,
        code: verify.error.code || 'SUPABASE_VERIFY_DELETE_ERR',
        error: verify.error.message,
      };
    }
    if (verify.data) {
      return {
        ok: false,
        deletedCount: 0,
        code: 'DELETE_NOT_PERSISTED',
        error: `Credential "${id}" still exists in Supabase after delete operation.`,
      };
    }

    return { ok: true, deletedCount: count };
  } catch (err: any) {
    return {
      ok: false,
      deletedCount: 0,
      code: 'SUPABASE_AI_DELETE_EXCEPTION',
      error: err?.message || 'Supabase AI credential delete error',
    };
  }
}

export async function listSupabaseAiTaskRoutes(): Promise<{
  ok: boolean;
  routes: AITaskRouting[];
  error?: string;
}> {
  const client = getSupabaseAdminClient();
  if (!client) return { ok: false, routes: [], error: 'Supabase not configured.' };
  try {
    const { data, error } = await client.from('ai_task_routes').select('*');
    if (error) return { ok: false, routes: [], error: error.message };
    const routes: AITaskRouting[] = (data || []).map((row: any) => ({
      task: row.task,
      label: String(row.label || row.task),
      primaryCredentialId: row.primary_credential_id ? String(row.primary_credential_id) : '',
      primaryModel: String(row.primary_model || ''),
      fallbackCredentialId: row.fallback_credential_id ? String(row.fallback_credential_id) : '',
      fallbackModel: String(row.fallback_model || ''),
      temperature: Number(row.temperature ?? 0.4),
      maxTokens: Number(row.max_tokens ?? 3072),
    }));
    return { ok: true, routes };
  } catch (err: any) {
    return { ok: false, routes: [], error: err?.message || 'Failed reading Supabase task routes' };
  }
}

export async function upsertSupabaseAiTaskRoutes(
  routes: AITaskRouting[]
): Promise<{ ok: boolean; savedCount?: number; error?: string; code?: string }> {
  const client = getSupabaseAdminClient();
  if (!client) {
    return { ok: false, code: 'SUPABASE_NOT_CONFIGURED', error: 'Supabase not configured.' };
  }
  try {
    if (!routes.length) return { ok: true, savedCount: 0 };
    const rows = routes.map(r => ({
      task: r.task,
      label: r.label,
      primary_credential_id: r.primaryCredentialId || null,
      primary_model: r.primaryModel || '',
      fallback_credential_id: r.fallbackCredentialId || null,
      fallback_model: r.fallbackModel || '',
      temperature: Number(r.temperature ?? 0.4),
      max_tokens: Number(r.maxTokens ?? 3072),
      updated_at: new Date().toISOString(),
    }));
    const { data, error } = await client
      .from('ai_task_routes')
      .upsert(rows, { onConflict: 'task' })
      .select('task');
    if (error) {
      recordServerError({
        source: 'supabase',
        code: error.code || 'SUPABASE_AI_ROUTES_ERR',
        message: `Supabase AI task routes upsert failed: ${error.message}`,
      });
      return { ok: false, code: error.code || 'SUPABASE_AI_ROUTES_ERR', error: error.message };
    }
    return { ok: true, savedCount: Array.isArray(data) ? data.length : rows.length };
  } catch (err: any) {
    return { ok: false, code: 'SUPABASE_AI_ROUTES_EXCEPTION', error: err?.message || 'Supabase task routes sync error' };
  }
}

export async function getSupabaseAiEnvSuppression(): Promise<{
  ok: boolean;
  suppressed?: { gemini: boolean; grok: boolean };
  error?: string;
}> {
  const client = getSupabaseAdminClient();
  if (!client) return { ok: false, error: 'Supabase not configured.' };
  try {
    const { data, error } = await client
      .from('site_settings')
      .select('settings_json')
      .eq('id', 'ai_runtime_flags')
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    const s = data?.settings_json || {};
    return {
      ok: true,
      suppressed: {
        gemini: Boolean(s.envSuppressedGemini),
        grok: Boolean(s.envSuppressedGrok),
      },
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed loading AI env flags' };
  }
}

export async function setSupabaseAiEnvSuppression(flags: {
  gemini: boolean;
  grok: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabaseAdminClient();
  if (!client) return { ok: false, error: 'Supabase not configured.' };
  try {
    const { error } = await client.from('site_settings').upsert(
      {
        id: 'ai_runtime_flags',
        settings_json: {
          envSuppressedGemini: Boolean(flags.gemini),
          envSuppressedGrok: Boolean(flags.grok),
          updatedAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed saving AI env flags' };
  }
}

export async function recordSupabaseAiConnectionTest(
  entry: AIConnectionTestRecord
): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabaseAdminClient();
  if (!client) return { ok: false, error: 'Supabase not configured.' };
  try {
    const payload = {
      credential_id: entry.credentialId || null,
      provider_type: entry.providerType,
      model_tested: entry.modelTested || null,
      stage: entry.stage,
      ok: Boolean(entry.ok),
      connection_status: entry.connectionStatus,
      latency_ms: entry.latencyMs,
      diagnostic_json: entry.diagnostic || null,
      actor: entry.actor || 'Super Admin',
      tested_at: entry.timestamp || new Date().toISOString(),
    };
    let { error } = await client.from('ai_connection_tests').insert({
      id: entry.id,
      ...payload,
    });
    if (error && error.code === '22P02') {
      ({ error } = await client.from('ai_connection_tests').insert(payload));
    }
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Supabase connection test log error' };
  }
}

export async function resetSupabaseAiCredentials(): Promise<{
  ok: boolean;
  configured: boolean;
  removedCount: number;
  error?: string;
}> {
  const client = getSupabaseAdminClient();
  if (!client) {
    return { ok: false, configured: false, removedCount: 0, error: 'Supabase not configured.' };
  }
  try {
    const { data: existingRows, error: listErr } = await client
      .from('ai_provider_credentials')
      .select('id, provider_type')
      .in('provider_type', ['gemini', 'grok']);

    if (listErr) {
      return { ok: false, configured: true, removedCount: 0, error: listErr.message };
    }

    const removedCount = Array.isArray(existingRows) ? existingRows.length : 0;

    // Clear task routes referencing credentials first (foreign key safety)
    await client
      .from('ai_task_routes')
      .update({
        primary_credential_id: null,
        primary_model: '',
        fallback_credential_id: null,
        fallback_model: '',
        updated_at: new Date().toISOString(),
      })
      .not('task', 'is', null);

    // Delete stored Gemini and Grok credentials
    const { error: delErr } = await client
      .from('ai_provider_credentials')
      .delete()
      .in('provider_type', ['gemini', 'grok']);

    if (delErr) {
      recordServerError({
        source: 'supabase',
        code: delErr.code || 'SUPABASE_AI_RESET_ERR',
        message: `Supabase AI reset failed: ${delErr.message}`,
      });
      return { ok: false, configured: true, removedCount: 0, error: delErr.message };
    }

    // Confirm 0 Gemini/Grok rows remain active
    const { data: remainingRows } = await client
      .from('ai_provider_credentials')
      .select('id')
      .in('provider_type', ['gemini', 'grok']);

    if (Array.isArray(remainingRows) && remainingRows.length > 0) {
      return {
        ok: false,
        configured: true,
        removedCount: 0,
        error: `${remainingRows.length} Gemini/Grok credential rows remained after reset delete.`,
      };
    }

    // Clear stale validation test caches while preserving ai_usage_logs history
    await client.from('ai_connection_tests').delete().in('provider_type', ['gemini', 'grok']);
    await setSupabaseAiEnvSuppression({ gemini: true, grok: true });

    return { ok: true, configured: true, removedCount };
  } catch (err: any) {
    return {
      ok: false,
      configured: true,
      removedCount: 0,
      error: err?.message || 'Supabase AI reset error',
    };
  }
}

export async function inspectSupabaseAiInfrastructure(): Promise<{
  connected: boolean;
  configured: boolean;
  supabaseUrlConfigured: boolean;
  supabaseSecretConfigured: boolean;
  urlEnvName: string | null;
  secretEnvName: string | null;
  currentRuntime: BackendRuntimeInfo['shortName'];
  deploymentEnvironment: BackendRuntimeInfo['deploymentEnv'];
  actualRuntime: string;
  runtimeId: BackendRuntimeInfo['runtime'];
  isServerless: boolean;
  isGoogleAiStudio: boolean;
  isProduction: boolean;
  connectionTestOk: boolean;
  databaseQueryOk: boolean;
  credentialTableAccessible: boolean;
  credentialTableStatus:
    | 'accessible'
    | 'missing_or_schema_cache'
    | 'missing_columns_or_schema_cache'
    | 'permission_or_rls'
    | 'connection_or_auth'
    | 'unconfigured'
    | 'other';
  migrationRequired: boolean;
  recommendedMigrationFile: string;
  schemaCacheReloadSql: string;
  projectHost: string | null;
  projectRef: string | null;
  secretKeyMode: string;
  tables: { table: string; available: boolean; rowCount: number | null; code?: string; error?: string }[];
  rlsStatus: {
    credentialsAnonBlocked: boolean;
    taskRoutesAnonBlocked: boolean;
    detail: string;
  };
  error?: string;
}> {
  const envCfg = resolveSupabaseEnvConfig();
  const runtimeInfo = detectBackendRuntimeInfo();
  const tablesToCheck = [
    'ai_providers',
    'ai_provider_credentials',
    'ai_provider_models',
    'ai_task_routes',
    'ai_connection_tests',
    'ai_usage_logs',
  ];

  const client = getSupabaseAdminClient();
  if (!envCfg.configured || !client) {
    const guidance = getMissingSupabaseConfigGuidance();
    return {
      connected: false,
      configured: false,
      supabaseUrlConfigured: envCfg.supabaseUrlConfigured,
      supabaseSecretConfigured: envCfg.supabaseSecretConfigured,
      urlEnvName: envCfg.urlEnvName,
      secretEnvName: envCfg.secretEnvName,
      currentRuntime: runtimeInfo.shortName,
      deploymentEnvironment: runtimeInfo.deploymentEnv,
      actualRuntime: runtimeInfo.label,
      runtimeId: runtimeInfo.runtime,
      isServerless: runtimeInfo.isServerless,
      isGoogleAiStudio: runtimeInfo.isGoogleAiStudio,
      isProduction: runtimeInfo.isProduction,
      connectionTestOk: false,
      databaseQueryOk: false,
      credentialTableAccessible: false,
      credentialTableStatus: 'unconfigured',
      migrationRequired: false,
      recommendedMigrationFile: RECOMMENDED_AI_MIGRATION_FILE,
      schemaCacheReloadSql: "NOTIFY pgrst, 'reload schema';",
      projectHost: envCfg.projectHost,
      projectRef: envCfg.projectRef,
      secretKeyMode: envCfg.secretKeyMode,
      tables: tablesToCheck.map(t => ({
        table: t,
        available: false,
        rowCount: null,
        error: envCfg.secretKeyMisconfiguration || envCfg.urlMisconfiguration || 'Supabase not configured',
      })),
      rlsStatus: {
        credentialsAnonBlocked: true,
        taskRoutesAnonBlocked: true,
        detail: guidance,
      },
      error: guidance,
    };
  }

  const tableSelectColumns: Record<string, string> = {
    ai_provider_credentials:
      'id, provider_type, label, project_id, endpoint_url, model, encrypted_secret, masked_key, enabled, priority, daily_token_limit, daily_tokens_used, monthly_budget_usd, monthly_spend_usd, billing_status, billing_note, model_list_status, generation_test_status, connection_status, available_models_json, last_tested_at, last_successful_verification_at, last_successful_generation_at, last_failure_at, last_test_status, last_test_message, last_latency_ms, last_correlation_id, last_diagnostic_json, created_at, updated_at',
    ai_task_routes:
      'task, label, primary_credential_id, primary_model, fallback_credential_id, fallback_model, temperature, max_tokens, updated_at',
  };

  const tables: { table: string; available: boolean; rowCount: number | null; code?: string; error?: string }[] = await Promise.all(
    tablesToCheck.map(async (table): Promise<{ table: string; available: boolean; rowCount: number | null; code?: string; error?: string }> => {
      try {
        const res = await client
          .from(table)
          .select(tableSelectColumns[table] || '*', { count: 'exact' })
          .limit(0);
        return {
          table,
          available: !res.error,
          rowCount: typeof res.count === 'number' ? res.count : 0,
          ...(res.error?.code ? { code: String(res.error.code) } : {}),
          ...(res.error ? { error: res.error.message } : {}),
        };
      } catch (err: any) {
        return {
          table,
          available: false,
          rowCount: null,
          ...(err?.code ? { code: String(err.code) } : {}),
          error: err?.message || 'Query error',
        };
      }
    })
  );

  // Also check a core table (articles / site_settings) so we distinguish "PostgREST reachable, AI schema missing/incomplete" from full DB outage
  let coreQueryOk = tables.some(t => t.available);
  if (!coreQueryOk) {
    try {
      const [artRes, setRes, credIdProbe] = await Promise.all([
        client.from('articles').select('id', { count: 'exact' }).limit(0),
        client.from('site_settings').select('id', { count: 'exact' }).limit(0),
        client.from('ai_provider_credentials').select('id', { count: 'exact' }).limit(0),
      ]);
      coreQueryOk = !artRes.error || !setRes.error || !credIdProbe.error;
    } catch {
      coreQueryOk = false;
    }
  }

  const credTable = tables.find(t => t.table === 'ai_provider_credentials');
  const credentialTableAccessible = Boolean(credTable?.available);
  const credErrKind = credTable?.available
    ? null
    : classifySupabaseTableError({ code: credTable?.code, message: credTable?.error });
  const credentialTableStatus = credentialTableAccessible
    ? 'accessible'
    : credErrKind === 'missing_or_schema_cache'
    ? 'missing_or_schema_cache'
    : credErrKind === 'missing_columns_or_schema_cache'
    ? 'missing_columns_or_schema_cache'
    : credErrKind === 'permission_or_rls'
    ? 'permission_or_rls'
    : credErrKind === 'connection_or_auth'
    ? 'connection_or_auth'
    : 'other';

  const requiredAiTables = ['ai_providers', 'ai_provider_credentials', 'ai_task_routes', 'ai_connection_tests', 'ai_usage_logs'];
  const migrationRequired = requiredAiTables.some(name => {
    const row = tables.find(t => t.table === name);
    const kind = classifySupabaseTableError({ code: row?.code, message: row?.error });
    return !row?.available && (kind === 'missing_or_schema_cache' || kind === 'missing_columns_or_schema_cache');
  });

  const databaseQueryOk = coreQueryOk;
  const firstTableError = credTable?.error || tables.find(t => t.error)?.error;
  const isConnFailure =
    !databaseQueryOk &&
    Boolean(firstTableError && /fetch failed|network|ENOTFOUND|ECONNREFUSED|Invalid API key|JWT/i.test(firstTableError));
  const connectionTestOk =
    databaseQueryOk ||
    credErrKind === 'missing_or_schema_cache' ||
    credErrKind === 'missing_columns_or_schema_cache' ||
    !isConnFailure;

  // Verify anon browser keys are strictly blocked from reading AI secrets, metadata views, or task routes
  let credentialsAnonBlocked = false;
  let taskRoutesAnonBlocked = false;
  let rlsDetail = '';
  const anon = getSupabaseAnonClient();
  if (!credentialTableAccessible) {
    credentialsAnonBlocked = false;
    taskRoutesAnonBlocked = false;
    rlsDetail = migrationRequired
      ? `Pending schema repair/reload: apply ${RECOMMENDED_AI_MIGRATION_FILE} in Supabase SQL Editor.`
      : 'Cannot verify RLS until ai_provider_credentials schema is complete and accessible.';
  } else if (anon) {
    const [anonCredRes, anonMetaRes, anonRouteRes] = await Promise.all([
      anon.from('ai_provider_credentials').select('id').limit(1),
      anon.from('ai_provider_credentials_metadata').select('id').limit(1),
      anon.from('ai_task_routes').select('task').limit(1),
    ]);
    const rawBlocked =
      Boolean(anonCredRes.error) || (Array.isArray(anonCredRes.data) && anonCredRes.data.length === 0);
    const viewBlocked =
      Boolean(anonMetaRes.error) || (Array.isArray(anonMetaRes.data) && anonMetaRes.data.length === 0);
    credentialsAnonBlocked = rawBlocked && viewBlocked;
    taskRoutesAnonBlocked =
      Boolean(anonRouteRes.error) || (Array.isArray(anonRouteRes.data) && anonRouteRes.data.length === 0);
    rlsDetail =
      credentialsAnonBlocked && taskRoutesAnonBlocked
        ? 'RLS verified: unauthenticated anon client blocked from raw AI credentials, metadata view & task routes.'
        : 'Warning: Anon policy returned unexpected rows — run Migration 007 RLS hardening.';
  } else {
    credentialsAnonBlocked = true;
    taskRoutesAnonBlocked = true;
    rlsDetail = 'SUPABASE_PUBLISHABLE_KEY not set; server-side SUPABASE_SECRET_KEY isolation active.';
  }

  const formattedError = envCfg.secretKeyMisconfiguration
    ? envCfg.secretKeyMisconfiguration
    : credTable?.error
    ? formatSupabaseAiTableError({ code: credTable.code, message: credTable.error }, 'ai_provider_credentials')
    : firstTableError;

  return {
    connected: connectionTestOk && databaseQueryOk && credentialTableAccessible,
    configured: true,
    supabaseUrlConfigured: envCfg.supabaseUrlConfigured,
    supabaseSecretConfigured: envCfg.supabaseSecretConfigured,
    urlEnvName: envCfg.urlEnvName,
    secretEnvName: envCfg.secretEnvName,
    currentRuntime: runtimeInfo.shortName,
    deploymentEnvironment: runtimeInfo.deploymentEnv,
    actualRuntime: runtimeInfo.label,
    runtimeId: runtimeInfo.runtime,
    isServerless: runtimeInfo.isServerless,
    isGoogleAiStudio: runtimeInfo.isGoogleAiStudio,
    isProduction: runtimeInfo.isProduction,
    connectionTestOk,
    databaseQueryOk,
    credentialTableAccessible,
    credentialTableStatus,
    migrationRequired,
    recommendedMigrationFile: RECOMMENDED_AI_MIGRATION_FILE,
    schemaCacheReloadSql: "NOTIFY pgrst, 'reload schema';",
    projectHost: envCfg.projectHost,
    projectRef: envCfg.projectRef,
    secretKeyMode: envCfg.secretKeyMode,
    tables,
    rlsStatus: {
      credentialsAnonBlocked,
      taskRoutesAnonBlocked,
      detail: envCfg.secretKeyMisconfiguration ? `${envCfg.secretKeyMisconfiguration} ${rlsDetail}` : rlsDetail,
    },
    ...(formattedError ? { error: formattedError } : {}),
  };
}

export async function findSupabaseAdminUserByEmail(email: string): Promise<{
  id: string;
  email: string;
  nameEn: string;
  role: string;
  status: string;
} | null> {
  const client = getSupabaseAdminClient();
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!client || !cleanEmail) return null;
  try {
    const { data, error } = await client
      .from('admin_users')
      .select('id, email, name_en, role, status')
      .ilike('email', cleanEmail)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: String(data.id),
      email: String(data.email).toLowerCase(),
      nameEn: String(data.name_en || data.email),
      role: String(data.role || 'Read-only Analyst'),
      status: String(data.status || 'active'),
    };
  } catch {
    return null;
  }
}

export async function runSupabaseAiCrudSelfTest(): Promise<{
  ok: boolean;
  configured: boolean;
  supabaseUrlConfigured: boolean;
  supabaseSecretConfigured: boolean;
  currentRuntime: BackendRuntimeInfo['shortName'];
  deploymentEnvironment: BackendRuntimeInfo['deploymentEnv'];
  actualRuntime: string;
  runtimeId: BackendRuntimeInfo['runtime'];
  connectionTestOk: boolean;
  databaseQueryOk: boolean;
  credentialTableAccessible: boolean;
  migrationRequired?: boolean;
  recommendedMigrationFile?: string;
  tableErrorCode?: string;
  projectHost: string | null;
  projectRef: string | null;
  testRecordId: string;
  stages: {
    stage: 'INSERT' | 'SELECT' | 'UPDATE' | 'DELETE' | 'VERIFY_DELETED';
    ok: boolean;
    latencyMs: number;
    detail: string;
    error?: string;
  }[];
  error?: string;
}> {
  const envCfg = resolveSupabaseEnvConfig();
  const runtimeInfo = detectBackendRuntimeInfo();
  let createdRecordId: string | number | null = null;
  const allStagesOrder: ('INSERT' | 'SELECT' | 'UPDATE' | 'DELETE' | 'VERIFY_DELETED')[] = [
    'INSERT',
    'SELECT',
    'UPDATE',
    'DELETE',
    'VERIFY_DELETED',
  ];
  const stages: {
    stage: 'INSERT' | 'SELECT' | 'UPDATE' | 'DELETE' | 'VERIFY_DELETED';
    ok: boolean;
    latencyMs: number;
    detail: string;
    error?: string;
  }[] = [];

  const padRemainingStages = (reason: string) => {
    for (const s of allStagesOrder) {
      if (!stages.some(existing => existing.stage === s)) {
        stages.push({
          stage: s,
          ok: false,
          latencyMs: 0,
          detail: reason,
          error: reason,
        });
      }
    }
  };

  const client = getSupabaseAdminClient();
  if (!envCfg.configured || !client) {
    const guidance = getMissingSupabaseConfigGuidance();
    padRemainingStages(guidance);
    return {
      ok: false,
      configured: false,
      supabaseUrlConfigured: envCfg.supabaseUrlConfigured,
      supabaseSecretConfigured: envCfg.supabaseSecretConfigured,
      currentRuntime: runtimeInfo.shortName,
      deploymentEnvironment: runtimeInfo.deploymentEnv,
      actualRuntime: runtimeInfo.label,
      runtimeId: runtimeInfo.runtime,
      connectionTestOk: false,
      databaseQueryOk: false,
      credentialTableAccessible: false,
      migrationRequired: false,
      recommendedMigrationFile: RECOMMENDED_AI_MIGRATION_FILE,
      projectHost: envCfg.projectHost,
      projectRef: envCfg.projectRef,
      testRecordId: 'unconfigured',
      stages,
      error: guidance,
    };
  }

  let connectionTestOk = false;
  let databaseQueryOk = false;
  let credentialTableAccessible = false;

  try {
    // 0. Connection + Table & Required Column Accessibility Probe
    const probe = await client
      .from('ai_provider_credentials')
      .select(
        'id, provider_type, label, project_id, model, encrypted_secret, masked_key, enabled, priority, connection_status, updated_at, created_at',
        { count: 'exact' }
      )
      .limit(0);
    if (probe.error) {
      const errKind = classifySupabaseTableError(probe.error);
      const msg = formatSupabaseAiTableError(probe.error, 'ai_provider_credentials');
      const isNetworkOrAuth = errKind === 'connection_or_auth';
      connectionTestOk = !isNetworkOrAuth;
      if (!isNetworkOrAuth) {
        const coreProbe = await client.from('articles').select('id', { count: 'exact' }).limit(0);
        databaseQueryOk = !coreProbe.error;
      } else {
        databaseQueryOk = false;
      }
      credentialTableAccessible = false;
      padRemainingStages(msg);
      return {
        ok: false,
        configured: true,
        supabaseUrlConfigured: envCfg.supabaseUrlConfigured,
        supabaseSecretConfigured: envCfg.supabaseSecretConfigured,
        currentRuntime: runtimeInfo.shortName,
        deploymentEnvironment: runtimeInfo.deploymentEnv,
        actualRuntime: runtimeInfo.label,
        runtimeId: runtimeInfo.runtime,
        connectionTestOk,
        databaseQueryOk,
        credentialTableAccessible,
        migrationRequired: errKind === 'missing_or_schema_cache' || errKind === 'missing_columns_or_schema_cache',
        recommendedMigrationFile: RECOMMENDED_AI_MIGRATION_FILE,
        tableErrorCode: probe.error.code || undefined,
        projectHost: envCfg.projectHost,
        projectRef: envCfg.projectRef,
        testRecordId: 'schema-check-failed',
        stages,
        error: msg,
      };
    }
    connectionTestOk = true;
    databaseQueryOk = true;
    credentialTableAccessible = true;

    // 1. INSERT isolated synthetic row omitting `id` so bigint identity (or default PK) generates it safely
    let t0 = Date.now();
    const { data: inserted, error: insErr } = await client
      .from('ai_provider_credentials')
      .insert({
        provider_type: 'gemini',
        label: 'Diagnostic CRUD Probe (Safe Auto-Deleted)',
        project_id: `diag-probe-${Date.now()}`,
        model: 'diag-model',
        encrypted_secret: 'enc:v1:diagnostic:probe:nonfunctional',
        masked_key: 'diag••••••••test',
        enabled: false,
        priority: 999,
        connection_status: 'disabled',
      })
      .select('id, label, enabled, priority')
      .single();

    if (insErr || !inserted || inserted.id === undefined || inserted.id === null) {
      const msg = insErr?.message || 'No record returned from INSERT.';
      stages.push({
        stage: 'INSERT',
        ok: false,
        latencyMs: Date.now() - t0,
        detail: 'Failed inserting isolated test record into ai_provider_credentials.',
        error: msg,
      });
      padRemainingStages('Skipped because INSERT failed.');
      return {
        ok: false,
        configured: true,
        supabaseUrlConfigured: envCfg.supabaseUrlConfigured,
        supabaseSecretConfigured: envCfg.supabaseSecretConfigured,
        currentRuntime: runtimeInfo.shortName,
        deploymentEnvironment: runtimeInfo.deploymentEnv,
        actualRuntime: runtimeInfo.label,
        runtimeId: runtimeInfo.runtime,
        connectionTestOk,
        databaseQueryOk,
        credentialTableAccessible,
        migrationRequired: false,
        recommendedMigrationFile: RECOMMENDED_AI_MIGRATION_FILE,
        projectHost: envCfg.projectHost,
        projectRef: envCfg.projectRef,
        testRecordId: 'insert-failed',
        stages,
        error: msg,
      };
    }
    createdRecordId = inserted.id;
    const createdIdStr = String(inserted.id);
    stages.push({
      stage: 'INSERT',
      ok: true,
      latencyMs: Date.now() - t0,
      detail: `Inserted test record id=${createdIdStr} (priority=${inserted.priority ?? 999})`,
    });

    // 2. SELECT
    t0 = Date.now();
    const { data: selected, error: selErr } = await client
      .from('ai_provider_credentials')
      .select('id, label, enabled, priority')
      .eq('id', createdIdStr)
      .single();
    if (selErr || !selected) {
      const msg = selErr?.message || 'Record not found.';
      stages.push({
        stage: 'SELECT',
        ok: false,
        latencyMs: Date.now() - t0,
        detail: 'Failed reading back test record by ID.',
        error: msg,
      });
      padRemainingStages('Skipped because SELECT failed.');
      return {
        ok: false,
        configured: true,
        supabaseUrlConfigured: envCfg.supabaseUrlConfigured,
        supabaseSecretConfigured: envCfg.supabaseSecretConfigured,
        currentRuntime: runtimeInfo.shortName,
        deploymentEnvironment: runtimeInfo.deploymentEnv,
        actualRuntime: runtimeInfo.label,
        runtimeId: runtimeInfo.runtime,
        connectionTestOk,
        databaseQueryOk,
        credentialTableAccessible,
        migrationRequired: false,
        recommendedMigrationFile: RECOMMENDED_AI_MIGRATION_FILE,
        projectHost: envCfg.projectHost,
        projectRef: envCfg.projectRef,
        testRecordId: createdIdStr,
        stages,
        error: msg,
      };
    }
    stages.push({
      stage: 'SELECT',
      ok: true,
      latencyMs: Date.now() - t0,
      detail: `Read back "${selected.label}" (enabled=${selected.enabled}, priority=${selected.priority})`,
    });

    // 3. UPDATE
    t0 = Date.now();
    const updatedLabel = 'Diagnostic CRUD Probe Updated';
    const { data: updated, error: updErr } = await client
      .from('ai_provider_credentials')
      .update({ label: updatedLabel, priority: 998, updated_at: new Date().toISOString() })
      .eq('id', createdIdStr)
      .select('id, label, priority')
      .single();
    if (updErr || !updated || updated.label !== updatedLabel) {
      const msg = updErr?.message || 'Updated row mismatch or zero rows affected.';
      stages.push({
        stage: 'UPDATE',
        ok: false,
        latencyMs: Date.now() - t0,
        detail: 'Failed updating test record label & priority.',
        error: msg,
      });
      padRemainingStages('Skipped because UPDATE failed.');
      return {
        ok: false,
        configured: true,
        supabaseUrlConfigured: envCfg.supabaseUrlConfigured,
        supabaseSecretConfigured: envCfg.supabaseSecretConfigured,
        currentRuntime: runtimeInfo.shortName,
        deploymentEnvironment: runtimeInfo.deploymentEnv,
        actualRuntime: runtimeInfo.label,
        runtimeId: runtimeInfo.runtime,
        connectionTestOk,
        databaseQueryOk,
        credentialTableAccessible,
        migrationRequired: false,
        recommendedMigrationFile: RECOMMENDED_AI_MIGRATION_FILE,
        projectHost: envCfg.projectHost,
        projectRef: envCfg.projectRef,
        testRecordId: createdIdStr,
        stages,
        error: msg,
      };
    }
    stages.push({
      stage: 'UPDATE',
      ok: true,
      latencyMs: Date.now() - t0,
      detail: `Updated label -> "${updated.label}" (priority=${updated.priority})`,
    });

    // 4. DELETE
    t0 = Date.now();
    const { data: delRows, error: delErr } = await client
      .from('ai_provider_credentials')
      .delete()
      .eq('id', createdIdStr)
      .select('id');
    const delCount = Array.isArray(delRows) ? delRows.length : 0;
    if (delErr || delCount !== 1) {
      const msg = delErr?.message || 'Zero rows deleted.';
      stages.push({
        stage: 'DELETE',
        ok: false,
        latencyMs: Date.now() - t0,
        detail: `Delete affected ${delCount} rows (expected 1).`,
        error: msg,
      });
      padRemainingStages('Skipped because DELETE failed.');
      return {
        ok: false,
        configured: true,
        supabaseUrlConfigured: envCfg.supabaseUrlConfigured,
        supabaseSecretConfigured: envCfg.supabaseSecretConfigured,
        currentRuntime: runtimeInfo.shortName,
        deploymentEnvironment: runtimeInfo.deploymentEnv,
        actualRuntime: runtimeInfo.label,
        runtimeId: runtimeInfo.runtime,
        connectionTestOk,
        databaseQueryOk,
        credentialTableAccessible,
        migrationRequired: false,
        recommendedMigrationFile: RECOMMENDED_AI_MIGRATION_FILE,
        projectHost: envCfg.projectHost,
        projectRef: envCfg.projectRef,
        testRecordId: createdIdStr,
        stages,
        error: msg,
      };
    }
    stages.push({
      stage: 'DELETE',
      ok: true,
      latencyMs: Date.now() - t0,
      detail: `Deleted 1 test record (id=${createdIdStr})`,
    });

    // 5. VERIFY_DELETED
    t0 = Date.now();
    const { data: verifyAfter, error: verifyErr } = await client
      .from('ai_provider_credentials')
      .select('id')
      .eq('id', createdIdStr)
      .maybeSingle();
    if (verifyErr || verifyAfter !== null) {
      const msg = verifyErr?.message || 'Residual test row detected.';
      stages.push({
        stage: 'VERIFY_DELETED',
        ok: false,
        latencyMs: Date.now() - t0,
        detail: 'Record still existed or failed verification query after deletion.',
        error: msg,
      });
      return {
        ok: false,
        configured: true,
        supabaseUrlConfigured: envCfg.supabaseUrlConfigured,
        supabaseSecretConfigured: envCfg.supabaseSecretConfigured,
        currentRuntime: runtimeInfo.shortName,
        deploymentEnvironment: runtimeInfo.deploymentEnv,
        actualRuntime: runtimeInfo.label,
        runtimeId: runtimeInfo.runtime,
        connectionTestOk,
        databaseQueryOk,
        credentialTableAccessible,
        migrationRequired: false,
        recommendedMigrationFile: RECOMMENDED_AI_MIGRATION_FILE,
        projectHost: envCfg.projectHost,
        projectRef: envCfg.projectRef,
        testRecordId: createdIdStr,
        stages,
        error: msg,
      };
    }
    stages.push({
      stage: 'VERIFY_DELETED',
      ok: true,
      latencyMs: Date.now() - t0,
      detail: 'Confirmed test record no longer exists in Supabase.',
    });

    return {
      ok: true,
      configured: true,
      supabaseUrlConfigured: envCfg.supabaseUrlConfigured,
      supabaseSecretConfigured: envCfg.supabaseSecretConfigured,
      currentRuntime: runtimeInfo.shortName,
      deploymentEnvironment: runtimeInfo.deploymentEnv,
      actualRuntime: runtimeInfo.label,
      runtimeId: runtimeInfo.runtime,
      connectionTestOk,
      databaseQueryOk,
      credentialTableAccessible,
      migrationRequired: false,
      recommendedMigrationFile: RECOMMENDED_AI_MIGRATION_FILE,
      projectHost: envCfg.projectHost,
      projectRef: envCfg.projectRef,
      testRecordId: createdIdStr,
      stages,
    };
  } catch (err: any) {
    const msg = err?.message || 'Unexpected error during AI CRUD self-test';
    padRemainingStages(msg);
    return {
      ok: false,
      configured: true,
      supabaseUrlConfigured: envCfg.supabaseUrlConfigured,
      supabaseSecretConfigured: envCfg.supabaseSecretConfigured,
      currentRuntime: runtimeInfo.shortName,
      deploymentEnvironment: runtimeInfo.deploymentEnv,
      actualRuntime: runtimeInfo.label,
      runtimeId: runtimeInfo.runtime,
      connectionTestOk,
      databaseQueryOk,
      credentialTableAccessible,
      migrationRequired: false,
      recommendedMigrationFile: RECOMMENDED_AI_MIGRATION_FILE,
      projectHost: envCfg.projectHost,
      projectRef: envCfg.projectRef,
      testRecordId: createdRecordId !== null ? String(createdRecordId) : 'error',
      stages,
      error: msg,
    };
  } finally {
    // Safety cleanup in case any mid-stage aborted before DELETE
    if (createdRecordId !== null) {
      await client
        .from('ai_provider_credentials')
        .delete()
        .eq('id', String(createdRecordId))
        .then(() => {}, () => {});
    }
  }
}

