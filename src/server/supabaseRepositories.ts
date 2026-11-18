/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Unified Supabase PostgreSQL Repositories,
 * Read-After-Write Verification, Editorial Media Upload & Storage Health
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  AdCampaign,
  AdPlacement,
  AdminUser,
  AudienceNotification,
  AuditLog,
  BrokenLinkReport,
  CategoryPageConfig,
  CustomReusableBlock,
  EditorialDraftRecord,
  HomepageLayoutConfig,
  MediaAsset,
  NewsletterSubscriber,
  RedirectRule,
  SaveDiagnosticEntry,
  SearchConsoleConnection,
  SearchConsoleMetrics,
  SeoAuditLogEntry,
  SeoPageConfig,
  SiteSettings,
  WebPushSubscription,
} from '../types/index.ts';
import { DataProvider, SyncJobRun } from './automation/types.ts';
import { getSupabaseAdminClient, isSupabaseConfigured } from './supabaseAdmin.ts';

export interface SupabaseSyncResult<T = any> {
  ok: boolean;
  storageEngine: 'supabase' | 'json_fallback';
  verifiedReadBack: boolean;
  latencyMs: number;
  data?: T;
  code?: string;
  error?: string;
}

const MAX_MEDIA_BYTES = 8 * 1024 * 1024; // 8 MB

export function detectImageFromMagicBytes(buf: Buffer): { mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif'; ext: string } | null {
  if (!buf || buf.length < 12) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: 'png' };
  }
  // WebP: RIFF....WEBP
  if (
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { mime: 'image/webp', ext: 'webp' };
  }
  // AVIF: ....ftypavif or ....ftypavis
  const ftyp = buf.subarray(4, 12).toString('ascii');
  if (ftyp === 'ftypavif' || ftyp === 'ftypavis') {
    return { mime: 'image/avif', ext: 'avif' };
  }

  return null;
}

async function upsertAndVerifyRow(
  table: string,
  row: Record<string, any>,
  primaryKeyCol: string = 'id'
): Promise<SupabaseSyncResult<any>> {
  const started = Date.now();
  const client = getSupabaseAdminClient();
  if (!client) {
    return {
      ok: true,
      storageEngine: 'json_fallback',
      verifiedReadBack: true,
      latencyMs: Date.now() - started,
      data: row,
    };
  }

  try {
    const { data, error } = await client
      .from(table)
      .upsert(row, { onConflict: primaryKeyCol })
      .select('*')
      .single();

    if (error || !data) {
      return {
        ok: false,
        storageEngine: 'supabase',
        verifiedReadBack: false,
        latencyMs: Date.now() - started,
        code: error?.code || 'SUPABASE_UPSERT_FAILED',
        error: `${table} upsert failed: ${error?.message || 'No row returned'}`,
      };
    }

    const pkVal = data[primaryKeyCol] ?? row[primaryKeyCol];
    const verify = await client.from(table).select('*').eq(primaryKeyCol, pkVal).single();
    if (verify.error || !verify.data) {
      return {
        ok: false,
        storageEngine: 'supabase',
        verifiedReadBack: false,
        latencyMs: Date.now() - started,
        code: verify.error?.code || 'SUPABASE_READ_AFTER_WRITE_FAILED',
        error: `${table} saved but read-after-write verification failed: ${verify.error?.message || 'Missing row'}`,
      };
    }

    return {
      ok: true,
      storageEngine: 'supabase',
      verifiedReadBack: true,
      latencyMs: Date.now() - started,
      data: verify.data,
    };
  } catch (err: any) {
    return {
      ok: false,
      storageEngine: 'supabase',
      verifiedReadBack: false,
      latencyMs: Date.now() - started,
      code: 'SUPABASE_EXCEPTION',
      error: err?.message || `Unexpected Supabase error writing to ${table}`,
    };
  }
}

async function deleteRowAndVerify(
  table: string,
  matchCol: string,
  matchVal: string
): Promise<SupabaseSyncResult<null>> {
  const started = Date.now();
  const client = getSupabaseAdminClient();
  if (!client) {
    return {
      ok: true,
      storageEngine: 'json_fallback',
      verifiedReadBack: true,
      latencyMs: Date.now() - started,
    };
  }

  try {
    const { error } = await client.from(table).delete().eq(matchCol, matchVal);
    if (error) {
      return {
        ok: false,
        storageEngine: 'supabase',
        verifiedReadBack: false,
        latencyMs: Date.now() - started,
        code: error.code || 'SUPABASE_DELETE_FAILED',
        error: `${table} delete failed: ${error.message}`,
      };
    }

    const verify = await client.from(table).select(matchCol).eq(matchCol, matchVal).maybeSingle();
    if (verify.data) {
      return {
        ok: false,
        storageEngine: 'supabase',
        verifiedReadBack: false,
        latencyMs: Date.now() - started,
        code: 'SUPABASE_DELETE_VERIFY_FAILED',
        error: `${table} row still exists after delete.`,
      };
    }

    return {
      ok: true,
      storageEngine: 'supabase',
      verifiedReadBack: true,
      latencyMs: Date.now() - started,
    };
  } catch (err: any) {
    return {
      ok: false,
      storageEngine: 'supabase',
      verifiedReadBack: false,
      latencyMs: Date.now() - started,
      code: 'SUPABASE_EXCEPTION',
      error: err?.message || `Unexpected error deleting from ${table}`,
    };
  }
}

export async function syncSiteSettingsToSupabase(settings: SiteSettings, actor: string): Promise<SupabaseSyncResult> {
  return upsertAndVerifyRow('site_settings', {
    id: 'default',
    settings_json: settings,
    updated_by: actor,
    updated_at: new Date().toISOString(),
  });
}

export async function syncCategoryPageToSupabase(page: CategoryPageConfig, actor: string): Promise<SupabaseSyncResult> {
  const catRes = await upsertAndVerifyRow('categories', {
    id: page.id || page.slug,
    slug: page.slug,
    name_en: page.nameEn || page.slug,
    name_ur: page.nameUr || page.nameEn || page.slug,
    description_en: page.descriptionEn || '',
    description_ur: page.descriptionUr || '',
    icon_name: page.iconName || 'Newspaper',
    enabled: page.enabled ?? true,
    sort_order: page.order ?? 0,
    updated_at: new Date().toISOString(),
  });
  if (!catRes.ok) return catRes;

  return upsertAndVerifyRow('category_pages', {
    slug: page.slug,
    config_json: page,
    status: page.status || 'published',
    updated_by: actor,
    updated_at: new Date().toISOString(),
  }, 'slug');
}

export async function deleteCategoryPageFromSupabase(slug: string): Promise<SupabaseSyncResult> {
  const res1 = await deleteRowAndVerify('category_pages', 'slug', slug);
  if (!res1.ok) return res1;
  return deleteRowAndVerify('categories', 'slug', slug);
}

export async function syncHomepageLayoutToSupabase(config: HomepageLayoutConfig, actor: string): Promise<SupabaseSyncResult> {
  return upsertAndVerifyRow('homepage_layouts', {
    id: 'default',
    config_json: config,
    updated_by: actor,
    updated_at: new Date().toISOString(),
  });
}

export async function syncCustomBlockToSupabase(block: CustomReusableBlock): Promise<SupabaseSyncResult> {
  return upsertAndVerifyRow('homepage_custom_blocks', {
    id: block.id,
    title_en: block.titleEn || block.name || '',
    title_ur: block.titleUr || '',
    body_en: block.bodyEn || '',
    body_ur: block.bodyUr || '',
    placement: 'homepage',
    enabled: true,
    config_json: block,
    updated_at: new Date().toISOString(),
  });
}

export async function deleteCustomBlockFromSupabase(id: string): Promise<SupabaseSyncResult> {
  return deleteRowAndVerify('homepage_custom_blocks', 'id', id);
}

export async function syncMediaAssetToSupabase(asset: MediaAsset): Promise<SupabaseSyncResult> {
  return upsertAndVerifyRow('media_assets', {
    id: asset.id,
    filename: asset.filename,
    url: asset.url,
    thumbnail_url: asset.thumbnailUrl || asset.url,
    size_bytes: Number(asset.sizeBytes || 0),
    mime_type: asset.mimeType || 'image/jpeg',
    category: asset.category || 'editorial',
    caption_en: asset.captionEn || '',
    caption_ur: asset.captionUr || '',
    alt_text_en: asset.altTextEn || '',
    alt_text_ur: asset.altTextUr || '',
    credit: asset.credit || '',
    source: asset.source || '',
    license: asset.license || '',
    storage_path: asset.storagePath || '',
    width: asset.width ?? null,
    height: asset.height ?? null,
    uploaded_by: asset.uploadedBy || 'Editor',
    usage_count: Number(asset.usageCount || 0),
    created_at: asset.uploadedAt || new Date().toISOString(),
  });
}

export async function deleteMediaAssetFromSupabase(id: string): Promise<SupabaseSyncResult> {
  return deleteRowAndVerify('media_assets', 'id', id);
}

export async function syncAdminUserToSupabase(user: AdminUser): Promise<SupabaseSyncResult> {
  return upsertAndVerifyRow('admin_users', {
    id: user.id,
    email: user.email.toLowerCase(),
    name_en: user.nameEn || user.email,
    name_ur: user.nameUr || user.nameEn || user.email,
    role: user.role || 'Editor',
    status: user.status || 'active',
    mfa_enabled: Boolean(user.mfaEnabled),
    updated_at: new Date().toISOString(),
  });
}

export async function deleteAdminUserFromSupabase(id: string): Promise<SupabaseSyncResult> {
  return deleteRowAndVerify('admin_users', 'id', id);
}

export async function syncAdPlacementToSupabase(slot: AdPlacement): Promise<SupabaseSyncResult> {
  return upsertAndVerifyRow('ad_placements', {
    id: slot.id,
    slot_id: slot.slotId,
    name: slot.name,
    dimensions: slot.dimensions || 'responsive',
    enabled: Boolean(slot.enabled),
    type: slot.providerType || 'banner',
    impressions: Number(slot.impressions || 0),
    clicks: Number(slot.clicks || 0),
    ad_code_snippet: slot.adCodeSnippet || '',
    updated_at: new Date().toISOString(),
  });
}

export async function syncAdCampaignToSupabase(camp: AdCampaign): Promise<SupabaseSyncResult> {
  return upsertAndVerifyRow('ad_campaigns', {
    id: camp.id,
    campaign_name: camp.campaignName,
    advertiser_name: camp.advertiserName,
    status: camp.status || 'active',
    budget_pkr: Number(camp.budgetPkr || 0),
    impressions: Number(camp.impressions || 0),
    clicks: Number(camp.clicks || 0),
    ctr: Number(camp.ctr || 0),
    start_date: camp.startDate || null,
    end_date: camp.endDate || null,
    target_slots_json: Array.isArray(camp.placementSlotIds) ? camp.placementSlotIds : [],
    banner_image_url: camp.bannerUrl || '',
    destination_url: camp.destinationUrl || '',
    priority: Number(camp.priority ?? 10),
    notes: camp.notes || '',
    updated_at: new Date().toISOString(),
  });
}

export async function deleteAdCampaignFromSupabase(id: string): Promise<SupabaseSyncResult> {
  return deleteRowAndVerify('ad_campaigns', 'id', id);
}

export async function syncSubscriberToSupabase(sub: NewsletterSubscriber): Promise<SupabaseSyncResult> {
  return upsertAndVerifyRow('newsletter_subscribers', {
    id: sub.id,
    email: sub.email.toLowerCase(),
    language: sub.language || 'both',
    frequency: sub.frequency || 'daily',
    status: sub.status || 'active',
    consent_source: sub.consentSource || 'admin',
    consent_timestamp: sub.consentTimestamp || sub.subscribedAt || new Date().toISOString(),
    subscribed_at: sub.subscribedAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export async function deleteSubscriberFromSupabase(id: string): Promise<SupabaseSyncResult> {
  return deleteRowAndVerify('newsletter_subscribers', 'id', id);
}

export async function syncAudienceNotificationToSupabase(notif: AudienceNotification): Promise<SupabaseSyncResult> {
  return upsertAndVerifyRow('audience_notifications', {
    id: notif.id,
    title_en: notif.titleEn || '',
    title_ur: notif.titleUr || '',
    body_en: notif.bodyEn || notif.messageEn || '',
    body_ur: notif.bodyUr || notif.messageUr || '',
    target_language: notif.targetLanguage || 'both',
    target_url: notif.targetUrl || 'https://www.360khabarnama.com',
    category: notif.category || 'general',
    recipients_count: Number(notif.recipientsCount || 0),
    delivered_count: Number(notif.deliveredCount || 0),
    failed_count: Number(notif.failedCount || 0),
    status: notif.status || 'sent',
    error_summary: notif.errorSummary || '',
    scheduled_for: notif.scheduledFor || null,
    sent_at: notif.sentAt || new Date().toISOString(),
  });
}

export async function syncPushSubscriptionToSupabase(sub: WebPushSubscription): Promise<SupabaseSyncResult> {
  return upsertAndVerifyRow('push_subscriptions', {
    id: sub.id,
    endpoint: sub.endpoint,
    keys_json: sub.keys || {},
    topics_json: sub.topics || {},
    language: sub.language || 'both',
    user_agent: sub.userAgent || '',
    status: sub.status || 'active',
    updated_at: new Date().toISOString(),
  });
}

export async function syncSeoPageToSupabase(page: SeoPageConfig): Promise<SupabaseSyncResult> {
  return upsertAndVerifyRow('seo_pages', {
    id: page.id,
    path: page.path,
    title_en: page.titleEn || '',
    title_ur: page.titleUr || '',
    meta_desc_en: page.metaDescEn || '',
    meta_desc_ur: page.metaDescUr || '',
    canonical_url: page.canonicalUrl || '',
    robots_directives: page.robotsDirectives || 'index, follow',
    og_image: page.ogImage || '',
    schema_type: page.schemaType || 'WebPage',
    focus_keyword: page.focusKeyword || '',
    config_json: page,
    updated_at: new Date().toISOString(),
  });
}

export async function syncRedirectRuleToSupabase(rule: RedirectRule): Promise<SupabaseSyncResult> {
  return upsertAndVerifyRow('seo_redirects', {
    id: rule.id,
    source_path: rule.sourcePath,
    target_path: rule.targetPath,
    status_code: Number(rule.statusCode || 301),
    hits: Number(rule.hits || 0),
    active: Boolean(rule.active),
    notes: rule.notes || '',
  });
}

export async function deleteRedirectRuleFromSupabase(id: string): Promise<SupabaseSyncResult> {
  return deleteRowAndVerify('seo_redirects', 'id', id);
}

export async function syncBrokenLinkToSupabase(link: BrokenLinkReport): Promise<SupabaseSyncResult> {
  return upsertAndVerifyRow('broken_links', {
    id: link.id,
    source_url: link.foundOnPage || '/',
    broken_target_url: link.url,
    http_status: Number(link.statusCode || 404),
    detected_at: link.discoveredAt || new Date().toISOString(),
    resolved: Boolean(link.resolved),
  });
}

export async function syncSearchConsoleConfigToSupabase(
  connection: SearchConsoleConnection | Record<string, any>,
  metrics: SearchConsoleMetrics
): Promise<SupabaseSyncResult> {
  return upsertAndVerifyRow('search_console_config', {
    id: 'default',
    config_json: { connection, metrics },
    updated_at: new Date().toISOString(),
  });
}

export async function syncSeoAuditLogToSupabase(entry: SeoAuditLogEntry): Promise<SupabaseSyncResult> {
  return upsertAndVerifyRow('seo_audit_logs', {
    id: entry.id,
    action: entry.action,
    actor: entry.actor,
    target: entry.target,
    summary: entry.details,
    created_at: entry.timestamp || new Date().toISOString(),
  });
}

export async function syncDataProviderToSupabase(provider: DataProvider): Promise<SupabaseSyncResult> {
  return upsertAndVerifyRow('sync_providers', {
    id: provider.id,
    name: provider.name,
    category: provider.category,
    endpoint: provider.endpoint,
    method: provider.method || provider.httpMethod || 'GET',
    status: provider.status || 'active',
    interval_minutes: Number(provider.intervalMinutes || 30),
    daily_quota_limit: Number(provider.dailyQuotaLimit ?? provider.quotaLimitPerDay ?? 1000),
    daily_calls_used: Number(provider.dailyCallsUsed ?? provider.quotaUsedToday ?? 0),
    requires_api_key: Boolean(provider.requiresApiKey),
    has_api_key: Boolean(provider.hasApiKey),
    masked_api_key: provider.maskedApiKey || null,
    auth_header_name: provider.authHeaderName || 'Authorization',
    attribution_required: Boolean(provider.attributionRequired ?? true),
    commercial_rights: Boolean(provider.commercialRights ?? true),
    is_licensed: Boolean(provider.isLicensed ?? true),
    license_type: provider.licenseType || 'public_open',
    attribution: provider.attribution || '',
    last_sync_at: provider.lastSyncAt || null,
    next_sync_at: provider.nextSyncAt || null,
    last_error: provider.lastError || null,
    consecutive_failures: Number(provider.consecutiveFailures || 0),
    total_syncs: Number(provider.totalSyncs || 0),
    successful_syncs: Number(provider.successfulSyncs || 0),
    notes: provider.notes || '',
    updated_at: new Date().toISOString(),
  });
}

export async function deleteDataProviderFromSupabase(id: string): Promise<SupabaseSyncResult> {
  return deleteRowAndVerify('sync_providers', 'id', id);
}

export async function syncAutomationJobRunToSupabase(run: SyncJobRun): Promise<SupabaseSyncResult> {
  return upsertAndVerifyRow('automation_jobs', {
    id: run.id,
    provider_id: run.providerId,
    status: run.status,
    records_updated: Number(run.itemsProcessed || 0),
    error_message: run.errorDetails || null,
    duration_ms: Number(run.durationMs || 0),
    executed_at: run.timestamp || new Date().toISOString(),
  });
}

export async function syncEditorialDraftToSupabase(draft: EditorialDraftRecord): Promise<SupabaseSyncResult> {
  return upsertAndVerifyRow('editorial_drafts', {
    id: draft.id,
    template: draft.template,
    title_en: draft.titleEn || '',
    title_ur: draft.titleUr || '',
    summary_en: draft.summaryEn || '',
    summary_ur: draft.summaryUr || '',
    content_en: draft.contentEn || '',
    content_ur: draft.contentUr || '',
    provider_type: draft.providerType || null,
    model: draft.model || null,
    total_tokens: Number(draft.totalTokens || 0),
    created_by: draft.createdBy || 'Editor',
    created_at: draft.createdAt || new Date().toISOString(),
    updated_at: draft.updatedAt || new Date().toISOString(),
  });
}

export async function recordAuditLogToSupabase(entry: AuditLog): Promise<SupabaseSyncResult> {
  return upsertAndVerifyRow('audit_logs', {
    id: entry.id,
    actor: entry.user,
    action: entry.action,
    details: entry.details,
    ip_address: entry.ipAddress || null,
    created_at: entry.timestamp || new Date().toISOString(),
  });
}

export async function recordSaveDiagnosticToSupabase(entry: SaveDiagnosticEntry): Promise<SupabaseSyncResult> {
  return upsertAndVerifyRow('admin_save_diagnostics', {
    id: entry.id,
    module: entry.module,
    action: entry.action,
    record_id: entry.recordId || null,
    storage_engine: entry.storageEngine,
    success: Boolean(entry.success),
    verified_read_back: Boolean(entry.verifiedReadBack),
    latency_ms: Number(entry.latencyMs || 0),
    actor: entry.actor || null,
    error_message: entry.errorMessage || null,
    created_at: entry.createdAt || new Date().toISOString(),
  });
}

export async function uploadMediaBinaryToStorage(params: {
  filename: string;
  base64Data: string;
  category?: string;
  captionEn?: string;
  captionUr?: string;
  altTextEn?: string;
  altTextUr?: string;
  credit?: string;
  source?: string;
  license?: string;
  width?: number;
  height?: number;
  uploadedBy: string;
}): Promise<{ ok: boolean; asset?: MediaAsset; storageTarget?: 'supabase_storage' | 'local_uploads'; error?: string; code?: string }> {
  const rawB64 = String(params.base64Data || '').replace(/^data:[^;]+;base64,/i, '').trim();
  if (!rawB64) {
    return { ok: false, code: 'EMPTY_FILE', error: 'Empty image upload payload.' };
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(rawB64, 'base64');
  } catch {
    return { ok: false, code: 'INVALID_BASE64', error: 'Could not decode uploaded base64 payload.' };
  }

  if (buffer.length === 0) {
    return { ok: false, code: 'EMPTY_BUFFER', error: 'Uploaded image buffer is empty.' };
  }
  if (buffer.length > MAX_MEDIA_BYTES) {
    return {
      ok: false,
      code: 'FILE_TOO_LARGE',
      error: `Image exceeds 8 MB limit (${(buffer.length / (1024 * 1024)).toFixed(2)} MB).`,
    };
  }

  const detected = detectImageFromMagicBytes(buffer);
  if (!detected) {
    return {
      ok: false,
      code: 'UNSUPPORTED_IMAGE_FORMAT',
      error: 'Only verified JPEG, PNG, WebP, or AVIF image binaries are permitted (SVG/scripts/executables rejected).',
    };
  }

  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const safeSlug = path
    .basename(params.filename || `image.${detected.ext}`, path.extname(params.filename || ''))
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48) || 'editorial';
  const rand = crypto.randomBytes(4).toString('hex');
  const safeName = `${safeSlug}-${Date.now()}-${rand}.${detected.ext}`;
  const storagePath = `editorial/${yyyy}/${mm}/${safeName}`;

  const client = getSupabaseAdminClient();
  if (client) {
    try {
      const { error: uploadErr } = await client.storage
        .from('editorial-media')
        .upload(storagePath, buffer, {
          contentType: detected.mime,
          cacheControl: '31536000',
          upsert: false,
        });

      if (uploadErr) {
        return {
          ok: false,
          code: 'SUPABASE_STORAGE_UPLOAD_FAILED',
          error: `Supabase Storage upload failed ("editorial-media"): ${uploadErr.message}. Run Migration 003/004 if the bucket is not provisioned yet.`,
        };
      }

      const { data: pubData } = client.storage.from('editorial-media').getPublicUrl(storagePath);
      const publicUrl = pubData?.publicUrl;
      if (!publicUrl) {
        return {
          ok: false,
          code: 'SUPABASE_STORAGE_URL_ERROR',
          error: 'Image uploaded to Supabase Storage, but no public URL was returned.',
        };
      }

      const asset: MediaAsset = {
        id: `med-${Date.now()}-${rand}`,
        filename: safeName,
        url: publicUrl,
        thumbnailUrl: publicUrl,
        sizeBytes: buffer.length,
        mimeType: detected.mime,
        category: params.category || 'editorial',
        captionEn: params.captionEn || '',
        captionUr: params.captionUr || '',
        altTextEn: params.altTextEn || params.captionEn || safeSlug,
        altTextUr: params.altTextUr || params.captionUr || '',
        credit: params.credit || '',
        source: params.source || '360Khabarnama Upload',
        license: params.license || 'Editorial Rights Cleared',
        storagePath,
        width: params.width,
        height: params.height,
        uploadedBy: params.uploadedBy,
        uploadedAt: now.toISOString(),
        usageCount: 1,
      };

      const syncRes = await syncMediaAssetToSupabase(asset);
      if (!syncRes.ok) {
        return { ok: false, code: syncRes.code, error: syncRes.error };
      }

      return { ok: true, asset, storageTarget: 'supabase_storage' };
    } catch (err: any) {
      return {
        ok: false,
        code: 'SUPABASE_STORAGE_EXCEPTION',
        error: err?.message || 'Unexpected Supabase Storage upload error.',
      };
    }
  }

  // Local workspace / cPanel uploads fallback when Supabase is not configured
  const localDir = path.resolve(process.cwd(), 'public', 'uploads', 'media', yyyy, mm);
  fs.mkdirSync(localDir, { recursive: true });
  const absPath = path.join(localDir, safeName);
  fs.writeFileSync(absPath, buffer);
  const relUrl = `/uploads/media/${yyyy}/${mm}/${safeName}`;

  const asset: MediaAsset = {
    id: `med-${Date.now()}-${rand}`,
    filename: safeName,
    url: relUrl,
    thumbnailUrl: relUrl,
    sizeBytes: buffer.length,
    mimeType: detected.mime,
    category: params.category || 'editorial',
    captionEn: params.captionEn || '',
    captionUr: params.captionUr || '',
    altTextEn: params.altTextEn || params.captionEn || safeSlug,
    altTextUr: params.altTextUr || params.captionUr || '',
    credit: params.credit || '',
    source: params.source || 'Local Upload',
    license: params.license || 'Editorial',
    storagePath: relUrl,
    width: params.width,
    height: params.height,
    uploadedBy: params.uploadedBy,
    uploadedAt: now.toISOString(),
    usageCount: 1,
  };

  return { ok: true, asset, storageTarget: 'local_uploads' };
}

export async function checkAllSupabaseModulesHealth(): Promise<{
  configured: boolean;
  storageBucket: { ok: boolean; bucket: string; detail: string };
  tables: { table: string; ok: boolean; rowCount: number | null; error?: string }[];
  checkedAt: string;
}> {
  const checkedAt = new Date().toISOString();
  const tablesToCheck = [
    'articles',
    'categories',
    'category_pages',
    'site_settings',
    'admin_users',
    'media_assets',
    'ad_placements',
    'ad_campaigns',
    'newsletter_subscribers',
    'audience_notifications',
    'homepage_layouts',
    'sync_providers',
    'seo_pages',
    'seo_redirects',
    'ai_provider_credentials',
    'admin_save_diagnostics',
  ];

  const client = getSupabaseAdminClient();
  if (!isSupabaseConfigured() || !client) {
    return {
      configured: false,
      storageBucket: {
        ok: false,
        bucket: 'editorial-media',
        detail: 'Supabase not configured in environment (local uploads directory active as fallback).',
      },
      tables: tablesToCheck.map(t => ({ table: t, ok: false, rowCount: null, error: 'Supabase not configured' })),
      checkedAt,
    };
  }

  const tableResults = await Promise.all(
    tablesToCheck.map(async table => {
      try {
        const res = await client.from(table).select('*', { count: 'exact', head: true });
        return {
          table,
          ok: !res.error,
          rowCount: typeof res.count === 'number' ? res.count : 0,
          ...(res.error ? { error: res.error.message } : {}),
        };
      } catch (err: any) {
        return {
          table,
          ok: false,
          rowCount: null,
          error: err?.message || 'Query error',
        };
      }
    })
  );

  let storageOk = false;
  let storageDetail = 'Unknown';
  try {
    const { data, error } = await client.storage.getBucket('editorial-media');
    if (!error && data) {
      storageOk = true;
      storageDetail = `Bucket "editorial-media" online (public=${Boolean(data.public)})`;
    } else {
      storageDetail = error?.message || 'Bucket "editorial-media" not found — run Migration 003.';
    }
  } catch (err: any) {
    storageDetail = err?.message || 'Storage inspection error';
  }

  return {
    configured: true,
    storageBucket: { ok: storageOk, bucket: 'editorial-media', detail: storageDetail },
    tables: tableResults,
    checkedAt,
  };
}
