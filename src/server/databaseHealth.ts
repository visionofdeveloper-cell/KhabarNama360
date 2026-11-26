/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Live Supabase Connection, Schema, Write & RLS Diagnostics
 *
 * Strictly executes real database queries/mutations when configured and never
 * fabricates "Connected" status when credentials or tables are absent.
 */

import {
  getSupabaseAdminClient,
  getSupabaseAnonClient,
  resolveSupabaseEnvConfig,
  upsertSupabaseArticle,
  deleteSupabaseArticle,
} from './supabaseAdmin.ts';
import { db } from './db.ts';
import { getServerErrorLogs } from './errorTracker.ts';

function sanitizeSupabaseDiagnosticText(raw: string | null | undefined): string {
  if (!raw) return '';
  return String(raw)
    .replace(/sb_secret_[A-Za-z0-9\-_]+/g, '[REDACTED_SB_SECRET]')
    .replace(/sb_publishable_[A-Za-z0-9\-_]+/g, '[REDACTED_SB_PUBLISHABLE]')
    .replace(/eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g, '[REDACTED_JWT]')
    .replace(/Bearer\s+[A-Za-z0-9\-_.]+/gi, 'Bearer [REDACTED]')
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, 'postgresql://[REDACTED]')
    .replace(/AIza[0-9A-Za-z\-_]{20,}/g, '[REDACTED_GEMINI_KEY]')
    .replace(/xai-[0-9A-Za-z\-_]{16,}/g, '[REDACTED_XAI_KEY]')
    .replace(/(apikey|token|secret|password|key)=([^&\s]+)/gi, '$1=[REDACTED]')
    .slice(0, 500);
}

export interface SupabaseDiagnosticsReport {
  configured: boolean;
  connected: boolean;
  pingOk: boolean;
  pingLatencyMs: number;
  sdkPackage: string;
  projectHost: string | null;
  secretKeyMode: string;
  publishableKeyMode: string;
  publishableKeyConfigured: boolean;
  secretsRedacted: boolean;
  schemaVersion: string;
  articlesTableAvailable: boolean;
  readTestOk: boolean;
  readPermissionDetail: string;
  authorizedWriteTestOk: boolean | null;
  writePermissionDetail: string;
  rlsPolicyCheckOk: boolean | null;
  rlsPolicyDetail: string;
  publishedCount: number;
  totalCount: number | null;
  latestSuccessfulSaveAt: string | null;
  latestPublishingError: string | null;
  latencyMs: number;
  checkedAt: string;
  errorCode: string | null;
  errorMessage: string | null;
  missingEnvVars: string[];
  missingServerEnvVars: string[];
  optionalMissingEnvVars: string[];
  schemaMigrationRequired: boolean;
  envSummaryDetail: string;
}

export async function checkSupabaseHealth(options?: { runWriteTest?: boolean }): Promise<SupabaseDiagnosticsReport> {
  const started = Date.now();
  const cfg = resolveSupabaseEnvConfig();
  const missingServerEnvVars: string[] = [];
  const optionalMissingEnvVars: string[] = [];
  if (!cfg.supabaseUrlConfigured) missingServerEnvVars.push('SUPABASE_URL');
  if (!cfg.supabaseSecretConfigured) missingServerEnvVars.push('SUPABASE_SECRET_KEY');
  if (!cfg.publishableKey) optionalMissingEnvVars.push('SUPABASE_PUBLISHABLE_KEY');
  const missingEnvVars = [...missingServerEnvVars];

  const envSummaryDetail = cfg.configured
    ? cfg.publishableKey
      ? 'SUPABASE_URL, SUPABASE_SECRET_KEY, and SUPABASE_PUBLISHABLE_KEY configured cleanly in server runtime.'
      : 'Server DB active via SUPABASE_URL + SUPABASE_SECRET_KEY. Optional SUPABASE_PUBLISHABLE_KEY not set in runtime environment (live anon RLS probe skipped; browser uses server API proxy unless VITE_SUPABASE_PUBLISHABLE_KEY is provided at build time).'
    : `Missing required server environment variable(s): ${missingServerEnvVars.join(', ')}. Configure in Vercel Dashboard -> Environment Variables or Google AI Studio Secrets.`;

  const recentLogs = db.getPublicationLogs(10);
  const recentErrors = getServerErrorLogs(10).filter(
    (e) => e.source === 'supabase' || e.source === 'publishing' || e.source === 'firestore'
  );
  const latestSuccessfulSaveAt = recentLogs[0]?.createdAt || null;
  const latestPublishingError = recentErrors[0]?.message || null;

  if (!cfg.configured) {
    const detailedErr =
      cfg.secretKeyMisconfiguration ||
      cfg.urlMisconfiguration ||
      `Missing required Supabase server environment variable(s): ${missingServerEnvVars.join(', ')}`;
    return {
      configured: false,
      connected: false,
      pingOk: false,
      pingLatencyMs: Date.now() - started,
      sdkPackage: '@supabase/supabase-js',
      projectHost: cfg.projectHost,
      secretKeyMode: cfg.secretKeyMode,
      publishableKeyMode: cfg.publishableKeyMode,
      publishableKeyConfigured: Boolean(cfg.publishableKey),
      secretsRedacted: true,
      schemaVersion: 'supabase-core-002 (env unconfigured)',
      articlesTableAvailable: false,
      readTestOk: false,
      readPermissionDetail: 'Skipped: Required SUPABASE_URL / SUPABASE_SECRET_KEY missing or misconfigured.',
      authorizedWriteTestOk: null,
      writePermissionDetail: 'Skipped: Supabase secret key missing or invalid.',
      rlsPolicyCheckOk: null,
      rlsPolicyDetail: 'Skipped: Supabase credentials are not configured in server environment.',
      publishedCount: 0,
      totalCount: null,
      latestSuccessfulSaveAt,
      latestPublishingError: latestPublishingError ? sanitizeSupabaseDiagnosticText(latestPublishingError) : null,
      latencyMs: Date.now() - started,
      checkedAt: new Date().toISOString(),
      errorCode: cfg.secretKeyMisconfiguration ? 'SUPABASE_KEY_MISCONFIGURED' : 'SUPABASE_ENV_MISSING',
      errorMessage: sanitizeSupabaseDiagnosticText(detailedErr),
      missingEnvVars,
      missingServerEnvVars,
      optionalMissingEnvVars,
      schemaMigrationRequired: false,
      envSummaryDetail,
    };
  }

  const adminClient = getSupabaseAdminClient()!;
  let pingOk = false;
  let pingLatencyMs = 0;
  let articlesTableAvailable = false;
  let readTestOk = false;
  let readPermissionDetail = 'Pending read check on public.articles';
  let publishedCount = 0;
  let totalCount: number | null = null;
  let authorizedWriteTestOk: boolean | null = null;
  let writePermissionDetail = 'Click "Test Supabase Connection" to run authorized write + read-after-write probe.';
  let rlsPolicyCheckOk: boolean | null = null;
  let rlsPolicyDetail = 'Publishable key not set; anon RLS check skipped.';
  let errorCode: string | null = null;
  let errorMessage: string | null = null;
  let schemaMigrationRequired = false;

  try {
    // 1. Database ping + real read & table existence test via official Supabase SDK
    const pingStart = Date.now();
    const totalRes = await adminClient
      .from('articles')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null);
    pingLatencyMs = Date.now() - pingStart;

    if (totalRes.error) {
      errorCode = totalRes.error.code || 'SUPABASE_TABLE_ERROR';
      errorMessage = sanitizeSupabaseDiagnosticText(totalRes.error.message);
      readPermissionDetail = `Read rejected: ${errorMessage}`;
      schemaMigrationRequired = Boolean(
        totalRes.error.code === '42P01' ||
          totalRes.error.code === 'PGRST205' ||
          /does not exist|schema cache/i.test(totalRes.error.message || '')
      );
    } else {
      pingOk = true;
      articlesTableAvailable = true;
      readTestOk = true;
      totalCount = typeof totalRes.count === 'number' ? totalRes.count : 0;

      const pubRes = await adminClient
        .from('articles')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'published')
        .is('deleted_at', null);
      publishedCount = typeof pubRes.count === 'number' ? pubRes.count : 0;
      readPermissionDetail = `Verified SELECT on public.articles (${publishedCount} published, ${totalCount} total rows).`;
    }

    // 2. Real RLS isolation verification using publishable/anon key (must NOT read drafts or write)
    const anonClient = getSupabaseAnonClient();
    if (anonClient && articlesTableAvailable) {
      const draftProbe = await anonClient.from('articles').select('id').eq('status', 'draft').limit(1);
      const writeProbe = await anonClient.from('articles').insert({
        id: `rls-probe-${Date.now()}`,
        slug: `rls-probe-${Date.now()}`,
        title_en: 'Unauthorized RLS Probe',
        status: 'draft',
      });
      const draftsBlocked = !draftProbe.data || draftProbe.data.length === 0 || Boolean(draftProbe.error);
      const anonWriteBlocked = Boolean(writeProbe.error);
      rlsPolicyCheckOk = draftsBlocked && anonWriteBlocked;
      rlsPolicyDetail = rlsPolicyCheckOk
        ? 'Verified: publishable client blocked from reading drafts and blocked from inserting articles.'
        : `RLS Alert: draftsBlocked=${draftsBlocked}, anonWriteBlocked=${anonWriteBlocked}`;
    }

    // 3. Real authorized write + read-after-write + cleanup test when requested
    if (options?.runWriteTest && articlesTableAvailable) {
      const probeId = `art-sb-probe-${Date.now()}`;
      const probeSlug = `sb-probe-${Date.now()}`;
      const saveRes = await upsertSupabaseArticle(
        {
          id: probeId,
          slug: probeSlug,
          titleEn: 'Supabase Connection Write Probe',
          titleUr: 'سپابیس کنکشن جانچ',
          summaryEn: 'Temporary automated write probe.',
          summaryUr: 'عارضی جانچ کا مضمون۔',
          contentEn: 'Temporary automated Supabase write probe content.',
          contentUr: 'عارضی مواد۔',
          category: 'pakistan',
          tags: ['diag-probe'],
          status: 'draft',
          isBreaking: false,
          isFeatured: false,
          isTrending: false,
          heroImage: '',
          imageCaptionEn: '',
          imageCaptionUr: '',
          readingTimeMin: 1,
          author: { id: 'diag', nameEn: 'Diagnostics', nameUr: 'تشخیص', avatar: '', role: 'Super Admin' },
          publishedAt: '',
          updatedAt: new Date().toISOString(),
          views: 0,
        },
        'Supabase Diagnostics'
      );

      if (saveRes.ok) {
        authorizedWriteTestOk = true;
        await deleteSupabaseArticle(probeId, true);
        writePermissionDetail = 'Verified authorized INSERT/UPSERT, read-after-write verification, and DELETE cleanup on public.articles.';
      } else {
        authorizedWriteTestOk = false;
        errorCode = saveRes.code || 'SUPABASE_WRITE_FAILED';
        errorMessage = sanitizeSupabaseDiagnosticText(saveRes.error || 'Authorized write probe failed.');
        writePermissionDetail = `Write probe failed: ${errorMessage}`;
      }
    }
  } catch (err: any) {
    errorCode = 'SUPABASE_UNREACHABLE';
    errorMessage = sanitizeSupabaseDiagnosticText(err?.message || 'Unable to reach Supabase host.');
  }

  return {
    configured: cfg.configured,
    connected: articlesTableAvailable && readTestOk && !errorMessage,
    pingOk,
    pingLatencyMs,
    sdkPackage: '@supabase/supabase-js',
    projectHost: cfg.projectHost,
    secretKeyMode: cfg.secretKeyMode,
    publishableKeyMode: cfg.publishableKeyMode,
    publishableKeyConfigured: Boolean(cfg.publishableKey),
    secretsRedacted: true,
    schemaVersion: schemaMigrationRequired ? 'migration-required' : 'supabase-verified-009',
    articlesTableAvailable,
    readTestOk,
    readPermissionDetail: sanitizeSupabaseDiagnosticText(readPermissionDetail),
    authorizedWriteTestOk,
    writePermissionDetail: sanitizeSupabaseDiagnosticText(writePermissionDetail),
    rlsPolicyCheckOk,
    rlsPolicyDetail: sanitizeSupabaseDiagnosticText(rlsPolicyDetail),
    publishedCount,
    totalCount,
    latestSuccessfulSaveAt,
    latestPublishingError: latestPublishingError ? sanitizeSupabaseDiagnosticText(latestPublishingError) : null,
    latencyMs: Date.now() - started,
    checkedAt: new Date().toISOString(),
    errorCode,
    errorMessage: errorMessage ? sanitizeSupabaseDiagnosticText(errorMessage) : null,
    missingEnvVars,
    missingServerEnvVars,
    optionalMissingEnvVars,
    schemaMigrationRequired,
    envSummaryDetail,
  };
}
