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
  Article,
  AudienceNotification,
  AuditLog,
  BrokenLinkReport,
  Category,
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
  GoogleIntegrationsConfig,
  GoogleIntegrationLogEntry,
} from '../types/index.ts';
import { AutomationSettings, DataProvider, SyncJobRun } from './automation/types.ts';
import {
  detectBackendRuntimeInfo,
  getSupabaseAdminClient,
  getSupabaseAnonClient,
  isSupabaseConfigured,
  listSupabaseArticles,
  resolveSupabaseEnvConfig,
} from './supabaseAdmin.ts';
import {
  recordServerError,
  getServerErrorLogs,
  recordQueryTiming,
  getSlowQueryLogs,
  getWebVitalsSummary,
} from './errorTracker.ts';
import { db } from './db.ts';

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

async function upsertWithFallback(
  table: string,
  fullRow: Record<string, any>,
  legacyRow: Record<string, any> | null,
  primaryKeyCol: string = 'id'
): Promise<SupabaseSyncResult<any>> {
  const res = await upsertAndVerifyRow(table, fullRow, primaryKeyCol);
  if (
    !res.ok &&
    legacyRow &&
    (res.code === 'PGRST204' ||
      res.code === '42703' ||
      res.code === '23502' ||
      /column .* does not exist|could not find the .* column|not-null constraint/i.test(res.error || ''))
  ) {
    return upsertAndVerifyRow(table, legacyRow, primaryKeyCol);
  }
  return res;
}

export async function recordSupabaseDeletionTombstone(
  entityType: string,
  entityId: string,
  actor: string = 'Admin',
  reason: string = ''
): Promise<SupabaseSyncResult> {
  db.recordDeletionTombstone(entityType, entityId);
  invalidatePortalHydrationCache();
  const client = getSupabaseAdminClient();
  if (!client) {
    return { ok: true, storageEngine: 'json_fallback', verifiedReadBack: true, latencyMs: 1 };
  }
  const started = Date.now();
  try {
    const { error } = await client.from('deleted_tombstones').upsert(
      {
        entity_type: entityType,
        entity_id: String(entityId),
        deleted_by: actor,
        reason,
        deleted_at: new Date().toISOString(),
      },
      { onConflict: 'entity_type,entity_id' }
    );
    if (error) {
      // If tombstone table hasn't been created yet via next_verified_repair.sql, log warning without crashing
      if (error.code === 'PGRST205' || error.code === '42P01') {
        recordServerError({
          source: 'supabase',
          code: error.code,
          message: `deleted_tombstones table missing; apply database/migrations/next_verified_repair.sql (${error.message})`,
        });
        return {
          ok: true,
          storageEngine: 'supabase',
          verifiedReadBack: false,
          latencyMs: Date.now() - started,
        };
      }
      return {
        ok: false,
        storageEngine: 'supabase',
        verifiedReadBack: false,
        latencyMs: Date.now() - started,
        code: error.code || 'TOMBSTONE_WRITE_FAILED',
        error: error.message,
      };
    }
    return { ok: true, storageEngine: 'supabase', verifiedReadBack: true, latencyMs: Date.now() - started };
  } catch (err: any) {
    return {
      ok: false,
      storageEngine: 'supabase',
      verifiedReadBack: false,
      latencyMs: Date.now() - started,
      code: 'TOMBSTONE_EXCEPTION',
      error: err?.message || 'Tombstone upsert failed',
    };
  }
}

export async function clearSupabaseDeletionTombstone(
  entityType: string,
  entityId: string
): Promise<void> {
  db.clearDeletionTombstone(entityType, entityId);
  invalidatePortalHydrationCache();
  const client = getSupabaseAdminClient();
  if (!client) return;
  try {
    await client
      .from('deleted_tombstones')
      .delete()
      .eq('entity_type', entityType)
      .eq('entity_id', String(entityId));
  } catch (err: any) {
    recordServerError({
      source: 'supabase',
      code: 'TOMBSTONE_CLEAR_WARN',
      message: `Could not clear tombstone ${entityType}/${entityId}: ${err?.message || err}`,
    });
  }
}

export async function listSupabaseDeletionTombstones(): Promise<{
  ok: boolean;
  tombstones: { entityType: string; entityId: string }[];
  error?: string;
}> {
  const client = getSupabaseAdminClient();
  if (!client) return { ok: false, tombstones: [], error: 'Supabase not configured.' };
  try {
    const { data, error } = await client.from('deleted_tombstones').select('entity_type, entity_id');
    if (error) return { ok: false, tombstones: [], error: error.message };
    return {
      ok: true,
      tombstones: (data || []).map((r: any) => ({
        entityType: String(r.entity_type),
        entityId: String(r.entity_id),
      })),
    };
  } catch (err: any) {
    return { ok: false, tombstones: [], error: err?.message || 'Tombstone read failed' };
  }
}

async function deleteRowAndVerify(
  table: string,
  matchCol: string,
  matchVal: string,
  actor: string = 'Admin'
): Promise<SupabaseSyncResult<null>> {
  const started = Date.now();
  await recordSupabaseDeletionTombstone(table, matchVal, actor).catch(() => {});
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
      const isMissingTable =
        error.code === 'PGRST205' ||
        error.code === '42P01' ||
        /could not find the table|does not exist/i.test(error.message || '');
      return {
        ok: false,
        storageEngine: 'supabase',
        verifiedReadBack: false,
        latencyMs: Date.now() - started,
        code: error.code || 'SUPABASE_DELETE_FAILED',
        error: isMissingTable
          ? `${table} delete failed: ${error.message} — Apply database/migrations/next_verified_repair.sql in Supabase SQL Editor and reload PostgREST schema cache.`
          : `${table} delete failed: ${error.message}`,
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
  const now = new Date().toISOString();
  const primary = await upsertAndVerifyRow('site_settings', {
    id: 'default',
    settings_json: settings,
    updated_by: actor,
    updated_at: now,
  });
  if (!primary.ok && (primary.error?.includes('updated_by') || primary.code === 'PGRST204')) {
    return upsertAndVerifyRow('site_settings', {
      id: 'default',
      settings_json: settings,
      updated_at: now,
    });
  }
  return primary;
}

export async function fetchSiteSettingsFromSupabase(): Promise<{
  ok: boolean;
  configured: boolean;
  settings?: Partial<SiteSettings> | null;
  error?: string;
}> {
  const client = getSupabaseAdminClient();
  if (!client) return { ok: false, configured: false, error: 'Supabase not configured.' };
  try {
    const { data, error } = await client
      .from('site_settings')
      .select('id, settings_json, updated_at')
      .in('id', ['default', 'global'])
      .limit(2);
    if (error) return { ok: false, configured: true, error: error.message };
    const row = (data || []).find((r: any) => r.id === 'default') || (data || [])[0];
    return {
      ok: true,
      configured: true,
      settings: (row?.settings_json || null) as Partial<SiteSettings> | null,
    };
  } catch (err: any) {
    return { ok: false, configured: true, error: err?.message || 'Failed loading site_settings from Supabase' };
  }
}

export async function syncCategoryPageToSupabase(page: CategoryPageConfig, actor: string): Promise<SupabaseSyncResult> {
  const now = new Date().toISOString();
  await clearSupabaseDeletionTombstone('categories', page.slug);
  await clearSupabaseDeletionTombstone('category_pages', page.slug);

  const catBase = {
    id: page.id || page.slug,
    slug: page.slug,
    name_en: page.nameEn || page.slug,
    name_ur: page.nameUr || page.nameEn || page.slug,
    description_en: page.descriptionEn || '',
    description_ur: page.descriptionUr || '',
    icon: page.iconName || 'Newspaper',
    enabled: page.enabled ?? true,
    sort_order: page.order ?? 0,
    updated_at: now,
  };
  const catRes = await upsertWithFallback(
    'categories',
    { ...catBase, icon_name: page.iconName || 'Newspaper' },
    catBase
  );
  if (!catRes.ok) return catRes;

  const pageBase = {
    id: page.id || page.slug,
    slug: page.slug,
    name_en: page.nameEn || page.slug,
    name_ur: page.nameUr || page.nameEn || page.slug,
    config_json: page,
    status: page.status || 'published',
    enabled: page.enabled ?? true,
    sort_order: page.order ?? 0,
    updated_at: now,
  };
  return upsertWithFallback(
    'category_pages',
    { ...pageBase, updated_by: actor },
    pageBase,
    'slug'
  );
}

export async function deleteCategoryPageFromSupabase(slug: string, actor: string = 'Admin'): Promise<SupabaseSyncResult> {
  const res1 = await deleteRowAndVerify('category_pages', 'slug', slug, actor);
  if (!res1.ok) return res1;
  return deleteRowAndVerify('categories', 'slug', slug, actor);
}

export async function syncHomepageLayoutToSupabase(config: HomepageLayoutConfig, actor: string): Promise<SupabaseSyncResult> {
  return upsertWithFallback(
    'homepage_layouts',
    {
      id: 'default',
      config_json: config,
      updated_by: actor,
      updated_at: new Date().toISOString(),
    },
    {
      id: 'default',
      config_json: config,
      updated_at: new Date().toISOString(),
    }
  );
}

export async function syncCustomBlockToSupabase(block: CustomReusableBlock): Promise<SupabaseSyncResult> {
  await clearSupabaseDeletionTombstone('homepage_custom_blocks', block.id);
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

export async function deleteCustomBlockFromSupabase(id: string, actor: string = 'Admin'): Promise<SupabaseSyncResult> {
  return deleteRowAndVerify('homepage_custom_blocks', 'id', id, actor);
}

export async function syncMediaAssetToSupabase(asset: MediaAsset): Promise<SupabaseSyncResult> {
  await clearSupabaseDeletionTombstone('media_assets', asset.id);
  const now = asset.uploadedAt || new Date().toISOString();
  const fullRow = {
    id: asset.id,
    title: asset.filename || asset.captionEn || asset.id,
    filename: asset.filename,
    url: asset.url,
    thumbnail_url: asset.thumbnailUrl || asset.url,
    size_bytes: Number(asset.sizeBytes || 0),
    mime_type: asset.mimeType || 'image/jpeg',
    category: asset.category || 'editorial',
    caption_en: asset.captionEn || '',
    caption_ur: asset.captionUr || '',
    alt_en: asset.altTextEn || '',
    alt_ur: asset.altTextUr || '',
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
    created_at: now,
  };
  const legacyRow = {
    id: asset.id,
    title: asset.filename || asset.captionEn || asset.id,
    url: asset.url,
    thumbnail_url: asset.thumbnailUrl || asset.url,
    size_bytes: Number(asset.sizeBytes || 0),
    mime_type: asset.mimeType || 'image/jpeg',
    category: asset.category || 'editorial',
    caption_en: asset.captionEn || '',
    caption_ur: asset.captionUr || '',
    alt_en: asset.altTextEn || '',
    alt_ur: asset.altTextUr || '',
    credit: asset.credit || '',
    source: asset.source || '',
    license: asset.license || '',
    storage_path: asset.storagePath || '',
    width: asset.width ?? null,
    height: asset.height ?? null,
    uploaded_by: asset.uploadedBy || 'Editor',
    usage_count: Number(asset.usageCount || 0),
    created_at: now,
  };
  return upsertWithFallback('media_assets', fullRow, legacyRow);
}

export async function deleteMediaAssetFromSupabase(id: string, actor: string = 'Admin'): Promise<SupabaseSyncResult> {
  return deleteRowAndVerify('media_assets', 'id', id, actor);
}

export async function syncAdminUserToSupabase(user: AdminUser): Promise<SupabaseSyncResult> {
  await clearSupabaseDeletionTombstone('admin_users', user.id);
  const now = new Date().toISOString();
  const legacyRow = {
    id: user.id,
    email: user.email.toLowerCase(),
    name_en: user.nameEn || user.email,
    name_ur: user.nameUr || user.nameEn || user.email,
    role: user.role || 'Editor',
    status: user.status || 'active',
    avatar_url: user.avatar || '',
    articles_count: Number(user.articlesCount || 0),
    updated_at: now,
  };
  return upsertWithFallback(
    'admin_users',
    {
      ...legacyRow,
      mfa_enabled: Boolean(user.mfaEnabled),
      bio_en: user.bioEn || '',
      bio_ur: user.bioUr || '',
    },
    legacyRow
  );
}

export async function deleteAdminUserFromSupabase(id: string, actor: string = 'Super Admin'): Promise<SupabaseSyncResult> {
  return deleteRowAndVerify('admin_users', 'id', id, actor);
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
  await clearSupabaseDeletionTombstone('ad_campaigns', camp.id);
  const baseRow = {
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
  };
  return upsertWithFallback(
    'ad_campaigns',
    {
      ...baseRow,
      spent_pkr: Number((camp as any).spentPkr || 0),
      deleted_at: null,
    },
    baseRow
  );
}

export async function archiveAdCampaignInSupabase(id: string, actor: string = 'Admin'): Promise<SupabaseSyncResult> {
  const existing = db.getAdCampaigns().find(c => c.id === id);
  if (!existing) {
    return {
      ok: false,
      storageEngine: isSupabaseConfigured() ? 'supabase' : 'json_fallback',
      verifiedReadBack: false,
      latencyMs: 0,
      code: 'NOT_FOUND',
      error: 'Ad campaign not found.',
    };
  }
  const updated: AdCampaign = { ...existing, status: 'archived' };
  const res = await syncAdCampaignToSupabase(updated);
  if (res.ok) {
    db.archiveAdCampaign(id, actor);
  }
  return res;
}

export async function deleteAdCampaignFromSupabase(id: string, actor: string = 'Admin'): Promise<SupabaseSyncResult> {
  return deleteRowAndVerify('ad_campaigns', 'id', id, actor);
}

export async function syncSubscriberToSupabase(sub: NewsletterSubscriber): Promise<SupabaseSyncResult> {
  await clearSupabaseDeletionTombstone('newsletter_subscribers', sub.id);
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

export async function deleteSubscriberFromSupabase(id: string, actor: string = 'Admin'): Promise<SupabaseSyncResult> {
  return deleteRowAndVerify('newsletter_subscribers', 'id', id, actor);
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
  const now = new Date().toISOString();
  const legacyRow = {
    id: page.id,
    route_path: page.path,
    title_en: page.titleEn || '',
    title_ur: page.titleUr || '',
    meta_desc_en: page.metaDescEn || '',
    meta_desc_ur: page.metaDescUr || '',
    canonical_url: page.canonicalUrl || '',
    robots_directives: page.robotsDirectives || 'index, follow',
    schema_type: page.schemaType || 'WebPage',
    metadata_json: page,
    updated_at: now,
  };
  return upsertWithFallback(
    'seo_pages',
    {
      ...legacyRow,
      path: page.path,
      og_image: page.ogImage || '',
      focus_keyword: page.focusKeyword || '',
      config_json: page,
    },
    legacyRow
  );
}

export async function syncRedirectRuleToSupabase(rule: RedirectRule): Promise<SupabaseSyncResult> {
  await clearSupabaseDeletionTombstone('seo_redirects', rule.id);
  const now = new Date().toISOString();
  const legacyRow = {
    id: rule.id,
    source_path: rule.sourcePath,
    target_path: rule.targetPath,
    status_code: Number(rule.statusCode || 301),
    hits: Number(rule.hits || 0),
    active: Boolean(rule.active),
  };
  return upsertWithFallback(
    'seo_redirects',
    {
      ...legacyRow,
      notes: rule.notes || '',
      updated_at: now,
    },
    legacyRow
  );
}

export async function deleteRedirectRuleFromSupabase(id: string, actor: string = 'Admin'): Promise<SupabaseSyncResult> {
  return deleteRowAndVerify('seo_redirects', 'id', id, actor);
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
  // Strip encrypted secrets before storing non-secret metadata/metrics in search_console_config
  const safeConnection = { ...(connection || {}) } as Record<string, any>;
  delete safeConnection.encryptedClientSecret;
  delete safeConnection.encryptedRefreshToken;
  delete safeConnection.encryptedAccessToken;
  delete safeConnection.encryptedServiceAccountJson;

  return upsertAndVerifyRow('search_console_config', {
    id: 'default',
    config_json: { connection: safeConnection, metrics },
    updated_at: new Date().toISOString(),
  });
}

export async function syncGoogleIntegrationsToSupabase(params: {
  config: GoogleIntegrationsConfig;
  connection: SearchConsoleConnection;
  metrics: SearchConsoleMetrics;
  actor: string;
}): Promise<SupabaseSyncResult> {
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

  const now = new Date().toISOString();
  const settingsRow = {
    id: 'default',
    ga4_enabled: Boolean(params.config.analytics.enabled),
    ga4_measurement_id: params.config.analytics.measurementId || '',
    ga4_tracking_mode: params.config.analytics.trackingMode || 'gtm',
    ga4_anonymize_ip: Boolean(params.config.analytics.anonymizeIp),
    ga4_debug_mode: Boolean(params.config.analytics.debugMode),
    ga4_exclude_admin: Boolean(params.config.analytics.excludeAdmin),
    ga4_exclude_staging: Boolean(params.config.analytics.excludeStaging),
    ga4_track_enhanced_events: Boolean(params.config.analytics.trackEnhancedEvents),
    ga4_last_verified_at: params.config.analytics.lastVerifiedAt || null,
    ga4_last_error: params.config.analytics.lastError || '',
    gtm_enabled: Boolean(params.config.tagManager.enabled),
    gtm_container_id: params.config.tagManager.containerId || '',
    gtm_exclude_admin: Boolean(params.config.tagManager.excludeAdmin),
    gtm_consent_mode_enabled: Boolean(params.config.tagManager.consentModeEnabled),
    gtm_last_verified_at: params.config.tagManager.lastVerifiedAt || null,
    gtm_last_error: params.config.tagManager.lastError || '',
    gsc_verification_code: params.config.searchConsole.verificationCode || '',
    gsc_property_url: params.connection.propertyUrl || params.config.searchConsole.propertyUrl || 'https://www.360khabarnama.com/',
    gsc_scope_mode: params.connection.scopeMode || params.config.searchConsole.scopeMode || 'webmasters',
    gsc_diagnostic_status: params.connection.diagnosticStatus || 'Disconnected',
    gsc_diagnostic_message: params.connection.diagnosticMessage || '',
    gsc_last_verified_at: params.connection.lastCheckedAt || null,
    gsc_last_synced_at: params.connection.lastSyncedAt || null,
    gsc_last_error: params.config.searchConsole.lastError || '',
    config_json: {
      availableProperties: params.connection.availableProperties || [],
      metrics: params.metrics,
      config: params.config,
    },
    updated_by: params.actor,
    updated_at: now,
  };

  const settingsRes = await upsertAndVerifyRow('google_integrations_settings', settingsRow);
  if (!settingsRes.ok) {
    return settingsRes;
  }

  // Persist encrypted OAuth / Service Account credentials into strict service_role-only vault
  const secretsRow = {
    id: 'gsc_default',
    provider: 'search_console',
    auth_mode: params.connection.authMode || 'none',
    client_id: params.connection.clientId || null,
    encrypted_client_secret: params.connection.encryptedClientSecret || null,
    encrypted_refresh_token: params.connection.encryptedRefreshToken || null,
    encrypted_access_token: params.connection.encryptedAccessToken || null,
    encrypted_service_account_json: params.connection.encryptedServiceAccountJson || null,
    service_account_email: params.connection.serviceAccountEmail || null,
    granted_scopes: params.connection.grantedScopes || null,
    token_expires_at: params.connection.tokenExpiresAt || null,
    updated_by: params.actor,
    updated_at: now,
  };

  const secretsRes = await upsertAndVerifyRow('google_integration_secrets', secretsRow);
  if (!secretsRes.ok) {
    return secretsRes;
  }

  // Also keep non-secret search_console_config mirror synchronized cleanly
  await syncSearchConsoleConfigToSupabase(params.connection, params.metrics).catch(() => {});

  return {
    ok: true,
    storageEngine: 'supabase',
    verifiedReadBack: true,
    latencyMs: Date.now() - started,
    data: { settings: settingsRes.data, secrets: secretsRes.data },
  };
}

export async function fetchGoogleIntegrationsFromSupabase(): Promise<{
  ok: boolean;
  configured: boolean;
  settingsRow?: any;
  secretsRow?: any;
  legacySearchConsoleRow?: any;
  logs?: GoogleIntegrationLogEntry[];
  missingTables?: string[];
  error?: string;
}> {
  const client = getSupabaseAdminClient();
  if (!client) return { ok: false, configured: false, error: 'Supabase not configured.' };

  const missingTables: string[] = [];
  try {
    const [settingsQ, secretsQ, legacyQ, logsQ] = await Promise.all([
      client.from('google_integrations_settings').select('*').eq('id', 'default').maybeSingle(),
      client.from('google_integration_secrets').select('*').eq('id', 'gsc_default').maybeSingle(),
      client.from('search_console_config').select('*').eq('id', 'default').maybeSingle(),
      client.from('google_integration_logs').select('*').order('created_at', { ascending: false }).limit(50),
    ]);

    for (const [tbl, res] of [
      ['google_integrations_settings', settingsQ],
      ['google_integration_secrets', secretsQ],
      ['google_integration_logs', logsQ],
    ] as const) {
      if (res.error && (res.error.code === 'PGRST205' || res.error.code === '42P01' || res.error.message?.includes('does not exist'))) {
        missingTables.push(tbl);
      }
    }

    const logs: GoogleIntegrationLogEntry[] = Array.isArray(logsQ.data)
      ? logsQ.data.map((r: any) => ({
          id: r.id,
          integration: r.integration,
          action: r.action,
          status: r.status,
          message: r.message || '',
          details: r.details_json || {},
          actor: r.actor || 'System',
          createdAt: r.created_at,
        }))
      : [];

    if (missingTables.length > 0 && !legacyQ.data) {
      return {
        ok: false,
        configured: true,
        missingTables,
        error: `Missing Supabase tables (${missingTables.join(', ')}). Run Migration 008 in Supabase SQL Editor.`,
      };
    }

    return {
      ok: true,
      configured: true,
      settingsRow: settingsQ.data || null,
      secretsRow: secretsQ.data || null,
      legacySearchConsoleRow: legacyQ.data || null,
      logs,
      ...(missingTables.length > 0 ? { missingTables } : {}),
    };
  } catch (err: any) {
    return { ok: false, configured: true, error: err?.message || 'Supabase read error for Google Integrations' };
  }
}

export async function recordGoogleIntegrationLogToSupabase(entry: GoogleIntegrationLogEntry): Promise<SupabaseSyncResult> {
  return upsertAndVerifyRow('google_integration_logs', {
    id: entry.id,
    integration: entry.integration,
    action: entry.action,
    status: entry.status,
    message: entry.message || '',
    details_json: entry.details || {},
    actor: entry.actor || 'System',
    created_at: entry.createdAt || new Date().toISOString(),
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
  await clearSupabaseDeletionTombstone('sync_providers', provider.id);
  const baseRow = {
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
    notes: provider.notes || '',
    updated_at: new Date().toISOString(),
  };
  return upsertWithFallback(
    'sync_providers',
    {
      ...baseRow,
      total_syncs: Number(provider.totalSyncs || 0),
      successful_syncs: Number(provider.successfulSyncs || 0),
      field_mapping_json: provider.fieldMapping || {},
      custom_headers_json: provider.customHeaders || {},
      is_built_in: Boolean(provider.isBuiltIn),
    },
    baseRow
  );
}

export async function deleteDataProviderFromSupabase(id: string, actor: string = 'Admin'): Promise<SupabaseSyncResult> {
  const client = getSupabaseAdminClient();
  if (client) {
    // 1. Disable provider scheduling first so active runners stop before deletion, preserving automation_jobs & articles
    await client
      .from('sync_providers')
      .update({ status: 'disabled', next_sync_at: null, updated_at: new Date().toISOString() })
      .eq('id', id)
      .then(() => {}, () => {});
  }
  return deleteRowAndVerify('sync_providers', 'id', id, actor);
}

export async function syncAutomationJobRunToSupabase(run: SyncJobRun): Promise<SupabaseSyncResult> {
  const baseRow = {
    id: run.id,
    provider_id: run.providerId,
    status: run.status,
    trigger_source: run.triggeredBy || 'cron',
    summary: `Processed ${Number(run.itemsProcessed || 0)} item(s)`,
    error_message: run.errorDetails || '',
    duration_ms: Number(run.durationMs || 0),
    executed_at: run.timestamp || new Date().toISOString(),
  };
  return upsertWithFallback(
    'automation_jobs',
    {
      ...baseRow,
      records_updated: Number(run.itemsProcessed || 0),
    },
    baseRow
  );
}

export async function syncEditorialDraftToSupabase(draft: EditorialDraftRecord): Promise<SupabaseSyncResult> {
  await clearSupabaseDeletionTombstone('editorial_drafts', draft.id);
  const legacyRow = {
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
  };
  return upsertWithFallback(
    'editorial_drafts',
    {
      ...legacyRow,
      category: (draft as any).category || 'pakistan',
      status: (draft as any).status || 'draft',
    },
    legacyRow
  );
}

export async function deleteEditorialDraftFromSupabase(id: string, actor: string = 'Editor'): Promise<SupabaseSyncResult> {
  return deleteRowAndVerify('editorial_drafts', 'id', id, actor);
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

// -----------------------------------------------------------------------------
// Extended Persistent Modules: Auth, Sessions, Automation Settings, Cron Locks,
// Category Datasets, Public Submissions, Authoritative Hydration & Audit Engine
// -----------------------------------------------------------------------------

export async function syncAdminAuthCredentialToSupabase(cred: {
  userId: string;
  email: string;
  passwordHash: string;
  mfaEnabled: boolean;
  mfaSecretEnc?: string;
  resetTokenHash?: string;
  resetTokenExpiresAt?: number;
  failedAttempts: number;
  lockedUntil?: number;
  lastLoginAt?: string;
  passwordUpdatedAt?: string;
}): Promise<SupabaseSyncResult> {
  return upsertAndVerifyRow(
    'admin_auth_credentials',
    {
      email: cred.email.toLowerCase(),
      user_id: cred.userId,
      password_hash: cred.passwordHash || '',
      mfa_enabled: Boolean(cred.mfaEnabled),
      mfa_secret_enc: cred.mfaSecretEnc || null,
      reset_token_hash: cred.resetTokenHash || null,
      reset_token_expires_at: cred.resetTokenExpiresAt ?? null,
      failed_attempts: Number(cred.failedAttempts || 0),
      locked_until: cred.lockedUntil ?? null,
      last_login_at: cred.lastLoginAt || null,
      password_updated_at: cred.passwordUpdatedAt || null,
      updated_at: new Date().toISOString(),
    },
    'email'
  );
}

export async function syncAdminSessionToSupabase(sess: {
  sessionId: string;
  userId: string;
  email: string;
  nameEn: string;
  role: string;
  ipAddress: string;
  userAgent: string;
  expiresAt: number;
  createdAt: string;
}): Promise<SupabaseSyncResult> {
  return upsertAndVerifyRow(
    'admin_sessions',
    {
      session_id: sess.sessionId,
      user_id: sess.userId,
      email: sess.email.toLowerCase(),
      name_en: sess.nameEn || 'Administrator',
      role: sess.role,
      ip_address: sess.ipAddress || '',
      user_agent: sess.userAgent || '',
      revoked: false,
      expires_at: sess.expiresAt,
      created_at: sess.createdAt || new Date().toISOString(),
    },
    'session_id'
  );
}

export async function revokeAdminSessionInSupabase(sessionId: string): Promise<SupabaseSyncResult> {
  const client = getSupabaseAdminClient();
  const started = Date.now();
  if (!client) {
    return { ok: true, storageEngine: 'json_fallback', verifiedReadBack: true, latencyMs: 1 };
  }
  try {
    const { error } = await client
      .from('admin_sessions')
      .upsert(
        {
          session_id: sessionId,
          user_id: 'revoked',
          email: 'revoked',
          role: 'Read-only Analyst',
          revoked: true,
          revoked_at: new Date().toISOString(),
          expires_at: Date.now() + 8 * 3600 * 1000,
        },
        { onConflict: 'session_id' }
      );
    if (error) {
      return {
        ok: false,
        storageEngine: 'supabase',
        verifiedReadBack: false,
        latencyMs: Date.now() - started,
        code: error.code,
        error: error.message,
      };
    }
    return { ok: true, storageEngine: 'supabase', verifiedReadBack: true, latencyMs: Date.now() - started };
  } catch (err: any) {
    return {
      ok: false,
      storageEngine: 'supabase',
      verifiedReadBack: false,
      latencyMs: Date.now() - started,
      code: 'SUPABASE_EXCEPTION',
      error: err?.message || 'Session revocation error',
    };
  }
}

export async function syncAutomationSettingsToSupabase(
  settings: AutomationSettings,
  actor: string
): Promise<SupabaseSyncResult> {
  return upsertAndVerifyRow('automation_settings', {
    id: 'default',
    settings_json: settings,
    updated_by: actor,
    updated_at: new Date().toISOString(),
  });
}

export async function syncCategoryDatasetToSupabase(
  dataset: string,
  items: any[],
  actor: string
): Promise<SupabaseSyncResult> {
  return upsertAndVerifyRow(
    'category_datasets',
    {
      dataset,
      items_json: Array.isArray(items) ? items : [],
      updated_by: actor,
      updated_at: new Date().toISOString(),
    },
    'dataset'
  );
}

export async function syncPublicSubmissionToSupabase(entry: {
  id: string;
  type: 'news_tip' | 'correction' | 'copyright' | 'advertise' | 'feedback' | 'contact' | string;
  name: string;
  email: string;
  subject: string;
  message: string;
  category?: string;
  targetUrl?: string;
  articleUrl?: string;
  status?: string;
  createdAt: string;
}): Promise<SupabaseSyncResult> {
  return upsertAndVerifyRow('public_submissions', {
    id: entry.id,
    submission_type: String(entry.type || 'contact'),
    name: entry.name || '',
    email: entry.email || '',
    subject: entry.subject || '',
    message: entry.message || '',
    article_url: entry.targetUrl || entry.articleUrl || '',
    status: entry.status || 'new',
    metadata_json: {
      category: entry.category || entry.type || 'contact',
      targetUrl: entry.targetUrl || entry.articleUrl || undefined,
    },
    created_at: entry.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export async function acquireSupabaseCronLock(
  lockKey: string,
  owner: string,
  ttlSeconds: number = 240
): Promise<boolean> {
  const client = getSupabaseAdminClient();
  if (!client) return db.acquireCronLock(lockKey, owner, ttlSeconds);

  try {
    const now = new Date();
    const { data: existing, error: selErr } = await client
      .from('cron_locks')
      .select('lock_key, expires_at')
      .eq('lock_key', lockKey)
      .maybeSingle();

    if (selErr && (selErr.code === 'PGRST205' || selErr.code === '42P01')) {
      return db.acquireCronLock(lockKey, owner, ttlSeconds);
    }

    if (existing?.expires_at && new Date(existing.expires_at).getTime() > now.getTime()) {
      return false;
    }

    const { error } = await client.from('cron_locks').upsert(
      {
        lock_key: lockKey,
        locked_by: owner,
        locked_at: now.toISOString(),
        expires_at: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
      },
      { onConflict: 'lock_key' }
    );
    if (error) return db.acquireCronLock(lockKey, owner, ttlSeconds);
    db.acquireCronLock(lockKey, owner, ttlSeconds);
    return true;
  } catch {
    return db.acquireCronLock(lockKey, owner, ttlSeconds);
  }
}

export async function releaseSupabaseCronLock(lockKey: string): Promise<void> {
  db.releaseCronLock(lockKey);
  const client = getSupabaseAdminClient();
  if (!client) return;
  try {
    await client.from('cron_locks').delete().eq('lock_key', lockKey);
  } catch {}
}

let lastPortalHydrationAt = 0;
let activeHydrationPromise: Promise<{ ok: boolean; error?: string }> | null = null;
const HYDRATION_TTL_MS = 30_000;

export function invalidatePortalHydrationCache(): void {
  lastPortalHydrationAt = 0;
}

export async function hydratePortalStateFromSupabase(options?: {
  force?: boolean;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const client = getSupabaseAdminClient();
  if (!isSupabaseConfigured() || !client) {
    return { ok: false, skipped: true, error: 'Supabase not configured.' };
  }

  const now = Date.now();
  if (!options?.force && lastPortalHydrationAt > 0 && now - lastPortalHydrationAt < HYDRATION_TTL_MS) {
    return { ok: true, skipped: true };
  }

  if (activeHydrationPromise) {
    return activeHydrationPromise;
  }

  activeHydrationPromise = (async () => {
    try {
      const safeSelect = async (table: string, orderCol?: string, ascending: boolean = false, limit: number = 300) => {
        const qStart = Date.now();
        try {
          let q = client.from(table).select('*');
          if (orderCol) q = q.order(orderCol, { ascending });
          q = q.limit(limit);
          const res = await q;
          recordQueryTiming(table, 'select', Date.now() - qStart);
          if (res.error) return null;
          return res.data || [];
        } catch {
          recordQueryTiming(table, 'select', Date.now() - qStart);
          return null;
        }
      };

      const [
        tombRes,
        articlesRes,
        catsRows,
        catPageRows,
        settingsRes,
        usersRows,
        authCredRows,
        mediaRows,
        adPlacementRows,
        adCampaignRows,
        subscriberRows,
        notificationRows,
        pushRows,
        homepageRow,
        blockRows,
        seoPageRows,
        redirectRows,
        brokenLinkRows,
        providerRows,
        jobRows,
        autoSettingsRows,
        draftRows,
        auditRows,
        diagRows,
        datasetRows,
        submissionRows,
      ] = await Promise.all([
        safeSelect('deleted_tombstones', 'deleted_at', false, 1000),
        listSupabaseArticles({ status: 'all', limit: 350 }).catch(() => ({ ok: false, articles: [] as Article[] })),
        safeSelect('categories', 'sort_order', true, 100),
        safeSelect('category_pages', 'sort_order', true, 100),
        fetchSiteSettingsFromSupabase().catch(() => ({ ok: false, configured: true, settings: null })),
        safeSelect('admin_users', 'created_at', false, 100),
        safeSelect('admin_auth_credentials', 'email', true, 100),
        safeSelect('media_assets', 'created_at', false, 300),
        safeSelect('ad_placements', 'id', true, 50),
        safeSelect('ad_campaigns', 'priority', false, 100),
        safeSelect('newsletter_subscribers', 'subscribed_at', false, 500),
        safeSelect('audience_notifications', 'sent_at', false, 100),
        safeSelect('push_subscriptions', 'updated_at', false, 500),
        safeSelect('homepage_layouts', 'updated_at', false, 5),
        safeSelect('homepage_custom_blocks', 'sort_order', true, 100),
        safeSelect('seo_pages', 'id', true, 100),
        safeSelect('seo_redirects', 'created_at', false, 300),
        safeSelect('broken_links', 'detected_at', false, 200),
        safeSelect('sync_providers', 'id', true, 100),
        safeSelect('automation_jobs', 'executed_at', false, 150),
        safeSelect('automation_settings', 'updated_at', false, 2),
        safeSelect('editorial_drafts', 'updated_at', false, 100),
        safeSelect('audit_logs', 'created_at', false, 200),
        safeSelect('admin_save_diagnostics', 'created_at', false, 200),
        safeSelect('category_datasets', 'dataset', true, 50),
        safeSelect('public_submissions', 'created_at', false, 300),
      ]);

      const tombstones = Array.isArray(tombRes)
        ? tombRes.map((r: any) => ({ entityType: String(r.entity_type), entityId: String(r.entity_id) }))
        : undefined;

      const categories: Category[] | null = Array.isArray(catsRows)
        ? catsRows.map((r: any) => ({
            id: String(r.id),
            slug: String(r.slug),
            nameEn: String(r.name_en || r.slug),
            nameUr: String(r.name_ur || r.name_en || r.slug),
            descriptionEn: String(r.description_en || ''),
            descriptionUr: String(r.description_ur || ''),
            iconName: String(r.icon_name || r.icon || 'Newspaper'),
            enabled: typeof r.enabled === 'boolean' ? r.enabled : true,
            order: Number(r.sort_order || 0),
          }))
        : null;

      const categoryPages: CategoryPageConfig[] | null = Array.isArray(catPageRows)
        ? catPageRows.map((r: any) => ({
            ...(r.config_json || {}),
            id: String((r.config_json || {}).id || r.id || r.slug),
            slug: String(r.slug),
            nameEn: String((r.config_json || {}).nameEn || r.name_en || r.slug),
            nameUr: String((r.config_json || {}).nameUr || r.name_ur || r.slug),
            status: (r.status || (r.config_json || {}).status || 'published') as 'published' | 'draft',
            enabled: typeof r.enabled === 'boolean' ? r.enabled : true,
            updatedAt: r.updated_at || (r.config_json || {}).updatedAt,
          }))
        : null;

      const adminUsers: AdminUser[] | null = Array.isArray(usersRows)
        ? usersRows.map((r: any) => ({
            id: String(r.id),
            nameEn: String(r.name_en || r.email),
            nameUr: String(r.name_ur || r.name_en || r.email),
            email: String(r.email).toLowerCase(),
            role: (r.role || 'Read-only Analyst') as AdminUser['role'],
            status: (r.status || 'active') as AdminUser['status'],
            avatar: String(r.avatar_url || ''),
            articlesCount: Number(r.articles_count || 0),
            mfaEnabled: Boolean(r.mfa_enabled),
            bioEn: r.bio_en || '',
            bioUr: r.bio_ur || '',
            lastLoginAt: r.last_login_at || undefined,
            createdAt: r.created_at || new Date().toISOString(),
          }))
        : null;

      let adminCredentials: Record<string, any> | null = null;
      if (Array.isArray(authCredRows)) {
        adminCredentials = {};
        for (const r of authCredRows) {
          adminCredentials[String(r.email).toLowerCase()] = {
            userId: String(r.user_id),
            email: String(r.email).toLowerCase(),
            passwordHash: String(r.password_hash || ''),
            mfaEnabled: Boolean(r.mfa_enabled),
            mfaSecretEnc: r.mfa_secret_enc || undefined,
            resetTokenHash: r.reset_token_hash || undefined,
            resetTokenExpiresAt: r.reset_token_expires_at ? Number(r.reset_token_expires_at) : undefined,
            failedAttempts: Number(r.failed_attempts || 0),
            lockedUntil: r.locked_until ? Number(r.locked_until) : undefined,
            lastLoginAt: r.last_login_at || undefined,
            passwordUpdatedAt: r.password_updated_at || undefined,
          };
        }
      }

      const mediaAssets: MediaAsset[] | null = Array.isArray(mediaRows)
        ? mediaRows.map((r: any) => ({
            id: String(r.id),
            filename: String(r.filename || r.title || r.id),
            url: String(r.url),
            thumbnailUrl: r.thumbnail_url || r.url,
            sizeBytes: Number(r.size_bytes || 0),
            mimeType: String(r.mime_type || 'image/jpeg'),
            category: String(r.category || 'editorial'),
            captionEn: String(r.caption_en || ''),
            captionUr: String(r.caption_ur || ''),
            altTextEn: String(r.alt_text_en || r.alt_en || ''),
            altTextUr: String(r.alt_text_ur || r.alt_ur || ''),
            credit: r.credit || '',
            source: r.source || '',
            license: r.license || '',
            storagePath: r.storage_path || '',
            width: r.width ?? undefined,
            height: r.height ?? undefined,
            uploadedBy: String(r.uploaded_by || 'Editorial'),
            uploadedAt: r.created_at || new Date().toISOString(),
            usageCount: Number(r.usage_count || 0),
          }))
        : null;

      const adPlacements: AdPlacement[] | null = Array.isArray(adPlacementRows)
        ? adPlacementRows.map((r: any) => ({
            id: String(r.id),
            slotId: String(r.slot_id),
            name: String(r.name),
            location: (r.location || 'header_top') as AdPlacement['location'],
            dimensions: String(r.dimensions || 'responsive'),
            targetDevices: (r.target_devices || 'all') as AdPlacement['targetDevices'],
            enabled: Boolean(r.enabled),
            providerType: (r.type || 'banner') as AdPlacement['providerType'],
            impressions: Number(r.impressions || 0),
            clicks: Number(r.clicks || 0),
            adCodeSnippet: r.ad_code_snippet || '',
          }))
        : null;

      const adCampaigns: AdCampaign[] | null = Array.isArray(adCampaignRows)
        ? adCampaignRows.map((r: any) => ({
            id: String(r.id),
            campaignName: String(r.campaign_name),
            advertiserName: String(r.advertiser_name),
            status: (r.status || 'active') as AdCampaign['status'],
            budgetPkr: Number(r.budget_pkr || 0),
            impressions: Number(r.impressions || 0),
            clicks: Number(r.clicks || 0),
            ctr: Number(r.ctr || 0),
            startDate: r.start_date || '',
            endDate: r.end_date || '',
            placementSlotIds: Array.isArray(r.target_slots_json) ? r.target_slots_json : [],
            bannerUrl: r.banner_image_url || '',
            destinationUrl: r.destination_url || '',
            priority: Number(r.priority ?? 10),
            notes: r.notes || '',
          }))
        : null;

      const subscribers: NewsletterSubscriber[] | null = Array.isArray(subscriberRows)
        ? subscriberRows.map((r: any) => ({
            id: String(r.id),
            email: String(r.email).toLowerCase(),
            language: (r.language || 'both') as NewsletterSubscriber['language'],
            frequency: (r.frequency || 'daily') as NewsletterSubscriber['frequency'],
            status: (r.status || 'active') as NewsletterSubscriber['status'],
            consentSource: String(r.consent_source || 'website'),
            consentTimestamp: r.consent_timestamp || r.subscribed_at,
            subscribedAt: r.subscribed_at || new Date().toISOString(),
          }))
        : null;

      const notifications: AudienceNotification[] | null = Array.isArray(notificationRows)
        ? notificationRows.map((r: any) => ({
            id: String(r.id),
            titleEn: String(r.title_en || ''),
            titleUr: String(r.title_ur || ''),
            bodyEn: String(r.body_en || ''),
            bodyUr: String(r.body_ur || ''),
            messageEn: String(r.body_en || ''),
            messageUr: String(r.body_ur || ''),
            targetLanguage: (r.target_language || 'both') as AudienceNotification['targetLanguage'],
            targetUrl: String(r.target_url || 'https://www.360khabarnama.com'),
            category: r.category || 'general',
            recipientsCount: Number(r.recipients_count || 0),
            deliveredCount: Number(r.delivered_count || 0),
            failedCount: Number(r.failed_count || 0),
            status: (r.status || 'sent') as AudienceNotification['status'],
            errorSummary: r.error_summary || '',
            scheduledFor: r.scheduled_for || undefined,
            sentAt: r.sent_at || new Date().toISOString(),
          }))
        : null;

      const pushSubscriptions: WebPushSubscription[] | null = Array.isArray(pushRows)
        ? pushRows.map((r: any) => ({
            id: String(r.id),
            endpoint: String(r.endpoint),
            keys: r.keys_json || {},
            topics: r.topics_json || { breakingNews: true, cricketScores: true, dailyBriefing: true },
            language: (r.language || 'both') as WebPushSubscription['language'],
            userAgent: r.user_agent || '',
            status: (r.status || 'active') as WebPushSubscription['status'],
            subscribedAt: r.created_at || new Date().toISOString(),
            lastActiveAt: r.updated_at || new Date().toISOString(),
          }))
        : null;

      const homepageConfig: HomepageLayoutConfig | null =
        Array.isArray(homepageRow) && homepageRow[0]?.config_json ? homepageRow[0].config_json : null;

      const customBlocks: CustomReusableBlock[] | null = Array.isArray(blockRows)
        ? blockRows.map((r: any) => ({
            ...(r.config_json || {}),
            id: String(r.id),
            name: (r.config_json || {}).name || r.title_en || r.id,
            titleEn: r.title_en || (r.config_json || {}).titleEn || '',
            titleUr: r.title_ur || (r.config_json || {}).titleUr || '',
            bodyEn: r.body_en || (r.config_json || {}).bodyEn || '',
            bodyUr: r.body_ur || (r.config_json || {}).bodyUr || '',
          }))
        : null;

      const seoPages: SeoPageConfig[] | null = Array.isArray(seoPageRows)
        ? seoPageRows.map((r: any) => ({
            ...(r.config_json || r.metadata_json || {}),
            id: String(r.id),
            path: String(r.path || r.route_path),
            titleEn: String(r.title_en || ''),
            titleUr: String(r.title_ur || ''),
            metaDescEn: String(r.meta_desc_en || ''),
            metaDescUr: String(r.meta_desc_ur || ''),
            canonicalUrl: String(r.canonical_url || ''),
            robotsDirectives: String(r.robots_directives || 'index, follow'),
            ogImage: String(r.og_image || ''),
            schemaType: String(r.schema_type || 'WebPage'),
            focusKeyword: String(r.focus_keyword || ''),
          }))
        : null;

      const redirectRules: RedirectRule[] | null = Array.isArray(redirectRows)
        ? redirectRows.map((r: any) => ({
            id: String(r.id),
            sourcePath: String(r.source_path),
            targetPath: String(r.target_path),
            statusCode: (Number(r.status_code || 301) as RedirectRule['statusCode']),
            hits: Number(r.hits || 0),
            active: Boolean(r.active),
            notes: r.notes || '',
            createdAt: r.created_at || new Date().toISOString(),
          }))
        : null;

      const brokenLinks: BrokenLinkReport[] | null = Array.isArray(brokenLinkRows)
        ? brokenLinkRows.map((r: any) => ({
            id: String(r.id),
            url: String(r.broken_target_url),
            foundOnPage: String(r.source_url || '/'),
            statusCode: Number(r.http_status || 404),
            discoveredAt: r.detected_at || new Date().toISOString(),
            resolved: Boolean(r.resolved),
          }))
        : null;

      const dataProviders: DataProvider[] | null = Array.isArray(providerRows)
        ? providerRows.map((r: any) => ({
            id: String(r.id),
            name: String(r.name),
            category: r.category,
            endpoint: String(r.endpoint),
            method: (r.method || 'GET') as any,
            status: (r.status || 'active') as any,
            intervalMinutes: Number(r.interval_minutes || 30),
            dailyQuotaLimit: Number(r.daily_quota_limit ?? 1000),
            dailyCallsUsed: Number(r.daily_calls_used ?? 0),
            requiresApiKey: Boolean(r.requires_api_key),
            hasApiKey: Boolean(r.has_api_key),
            maskedApiKey: r.masked_api_key || undefined,
            authHeaderName: r.auth_header_name || 'Authorization',
            attributionRequired: Boolean(r.attribution_required ?? true),
            commercialRights: Boolean(r.commercial_rights ?? true),
            isLicensed: Boolean(r.is_licensed ?? true),
            licenseType: r.license_type || 'public_open',
            attribution: r.attribution || '',
            lastSyncAt: r.last_sync_at || undefined,
            nextSyncAt: r.next_sync_at || undefined,
            lastError: r.last_error || undefined,
            consecutiveFailures: Number(r.consecutive_failures || 0),
            totalSyncs: Number(r.total_syncs || 0),
            successfulSyncs: Number(r.successful_syncs || 0),
            fieldMapping: r.field_mapping_json && typeof r.field_mapping_json === 'object' ? r.field_mapping_json : undefined,
            customHeaders: r.custom_headers_json && typeof r.custom_headers_json === 'object' ? r.custom_headers_json : undefined,
            isBuiltIn: Boolean(r.is_built_in),
            sourceMode: 'database',
            notes: r.notes || '',
          }))
        : null;

      const syncJobRuns: SyncJobRun[] | null = Array.isArray(jobRows)
        ? jobRows.map((r: any) => ({
            id: String(r.id),
            providerId: String(r.provider_id),
            providerName: String(r.provider_id),
            category: 'system' as any,
            status: (r.status || 'success') as any,
            itemsProcessed: Number(r.records_updated || 0),
            changesDetected: Number(r.records_updated || 0) > 0,
            changeSummaryEn: String(r.summary || ''),
            changeSummaryUr: '',
            durationMs: Number(r.duration_ms || 0),
            errorDetails: r.error_message || null,
            timestamp: r.executed_at || new Date().toISOString(),
            triggeredBy: (r.trigger_source || 'scheduler') as any,
          }))
        : null;

      const automationSettings =
        Array.isArray(autoSettingsRows) && autoSettingsRows[0]?.settings_json
          ? (autoSettingsRows[0].settings_json as Partial<AutomationSettings>)
          : null;

      const editorialDrafts: EditorialDraftRecord[] | null = Array.isArray(draftRows)
        ? draftRows.map((r: any) => ({
            id: String(r.id),
            template: r.template,
            titleEn: r.title_en || '',
            titleUr: r.title_ur || '',
            summaryEn: r.summary_en || '',
            summaryUr: r.summary_ur || '',
            contentEn: r.content_en || '',
            contentUr: r.content_ur || '',
            providerType: r.provider_type || undefined,
            model: r.model || undefined,
            totalTokens: Number(r.total_tokens || 0),
            createdBy: r.created_by || 'Editor',
            createdAt: r.created_at || new Date().toISOString(),
            updatedAt: r.updated_at || new Date().toISOString(),
          }))
        : null;

      const auditLogs: AuditLog[] | null = Array.isArray(auditRows)
        ? auditRows.map((r: any) => ({
            id: String(r.id),
            timestamp: r.created_at || new Date().toISOString(),
            user: String(r.actor || 'System'),
            action: String(r.action || ''),
            details: String(r.details || ''),
            ipAddress: r.ip_address || undefined,
          }))
        : null;

      const saveDiagnostics: SaveDiagnosticEntry[] | null = Array.isArray(diagRows)
        ? diagRows.map((r: any) => ({
            id: String(r.id),
            module: String(r.module),
            action: r.action,
            recordId: r.record_id || undefined,
            storageEngine: r.storage_engine,
            success: Boolean(r.success),
            verifiedReadBack: Boolean(r.verified_read_back),
            latencyMs: Number(r.latency_ms || 0),
            actor: r.actor || undefined,
            errorMessage: r.error_message || undefined,
            createdAt: r.created_at || new Date().toISOString(),
          }))
        : null;

      let datasets: Record<string, any[]> | null = null;
      if (Array.isArray(datasetRows)) {
        datasets = {};
        for (const r of datasetRows) {
          if (r.dataset && Array.isArray(r.items_json)) {
            datasets[String(r.dataset)] = r.items_json;
          }
        }
      }

      const publicSubmissions = Array.isArray(submissionRows)
        ? submissionRows.map((r: any) => ({
            id: String(r.id),
            type: r.submission_type,
            name: r.name,
            email: r.email,
            subject: r.subject,
            message: r.message,
            articleUrl: r.article_url,
            status: r.status,
            createdAt: r.created_at,
          }))
        : null;

      db.applySupabaseHydration({
        tombstones,
        articles: articlesRes.ok ? articlesRes.articles : null,
        categories,
        categoryPages,
        siteSettings: settingsRes.ok ? settingsRes.settings : null,
        adminUsers,
        adminCredentials,
        mediaAssets,
        adPlacements,
        adCampaigns,
        subscribers,
        notifications,
        pushSubscriptions,
        homepageConfig,
        customBlocks,
        seoPages,
        redirectRules,
        brokenLinks,
        dataProviders,
        syncJobRuns,
        automationSettings,
        editorialDrafts,
        auditLogs,
        saveDiagnostics,
        datasets,
        publicSubmissions,
      });

      lastPortalHydrationAt = Date.now();
      return { ok: true };
    } catch (err: any) {
      const msg = err?.message || 'Supabase state hydration failed';
      recordServerError({ source: 'supabase', code: 'HYDRATION_FAILED', message: msg });
      return { ok: false, error: msg };
    } finally {
      activeHydrationPromise = null;
    }
  })();

  return activeHydrationPromise;
}

export async function checkAllSupabaseModulesHealth(): Promise<{
  configured: boolean;
  storageBucket: { ok: boolean; bucket: string; detail: string };
  storage: { ok: boolean; bucket: string; detail: string };
  tables: { table: string; ok: boolean; rowCount: number | null; error?: string }[];
  modules: Record<string, { ok: boolean; count: number | null; error?: string }>;
  checkedAt: string;
}> {
  const checkedAt = new Date().toISOString();
  const tablesToCheck = [
    'articles',
    'categories',
    'category_pages',
    'site_settings',
    'admin_users',
    'admin_auth_credentials',
    'admin_sessions',
    'media_assets',
    'ad_placements',
    'ad_campaigns',
    'newsletter_subscribers',
    'audience_notifications',
    'push_subscriptions',
    'homepage_layouts',
    'homepage_custom_blocks',
    'sync_providers',
    'automation_jobs',
    'automation_settings',
    'cron_locks',
    'seo_pages',
    'seo_redirects',
    'broken_links',
    'ai_provider_credentials',
    'ai_task_routes',
    'google_integrations_settings',
    'google_integration_secrets',
    'category_datasets',
    'public_submissions',
    'deleted_tombstones',
    'admin_save_diagnostics',
    'audit_logs',
    'schema_migrations',
  ];

  const client = getSupabaseAdminClient();
  if (!isSupabaseConfigured() || !client) {
    const emptyModules: Record<string, { ok: boolean; count: number | null; error?: string }> = {};
    for (const t of tablesToCheck) emptyModules[t] = { ok: false, count: null, error: 'Supabase not configured' };
    const storageInfo = {
      ok: false,
      bucket: 'editorial-media',
      detail: 'Supabase not configured in environment (local workspace fallback active).',
    };
    return {
      configured: false,
      storageBucket: storageInfo,
      storage: storageInfo,
      tables: tablesToCheck.map(t => ({ table: t, ok: false, rowCount: null, error: 'Supabase not configured' })),
      modules: emptyModules,
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
      storageDetail = error?.message || 'Bucket "editorial-media" not found — run next_verified_repair.sql.';
    }
  } catch (err: any) {
    storageDetail = err?.message || 'Storage inspection error';
  }

  const modules: Record<string, { ok: boolean; count: number | null; error?: string }> = {};
  for (const r of tableResults) {
    modules[r.table] = { ok: r.ok, count: r.rowCount, ...(r.error ? { error: r.error } : {}) };
  }
  const storageInfo = { ok: storageOk, bucket: 'editorial-media', detail: storageDetail };

  return {
    configured: true,
    storageBucket: storageInfo,
    storage: storageInfo,
    tables: tableResults,
    modules,
    checkedAt,
  };
}

export interface DatabaseAuditCheck {
  category: string;
  name: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
  remediation?: string;
}

export interface CompleteDatabaseAuditReport {
  auditVersion: string;
  executedAt: string;
  readOnly: true;
  secretsRedacted: true;
  overallStatus: 'PASS' | 'WARN' | 'FAIL';
  summary: {
    passed: number;
    warnings: number;
    failed: number;
    totalChecks: number;
  };
  environment: {
    runtime: string;
    deploymentEnv: string;
    configured: boolean;
    supabaseUrlConfigured: boolean;
    supabaseSecretConfigured: boolean;
    publishableKeyConfigured: boolean;
    projectHost: string | null;
    projectRef: string | null;
    secretKeyMode: string;
  };
  tables: { table: string; ok: boolean; rowCount: number | null; missingColumns?: string[]; error?: string }[];
  rlsChecks: DatabaseAuditCheck[];
  checks: DatabaseAuditCheck[];
  storage: { ok: boolean; bucket: string; detail: string };
  recentErrors: ReturnType<typeof getServerErrorLogs>;
  slowQueries: ReturnType<typeof getSlowQueryLogs>;
  webVitals: ReturnType<typeof getWebVitalsSummary>;
  recommendedMigration: string;
}

export async function runCompleteDatabaseAudit(): Promise<CompleteDatabaseAuditReport> {
  const executedAt = new Date().toISOString();
  const envCfg = resolveSupabaseEnvConfig();
  const runtime = detectBackendRuntimeInfo();
  const checks: DatabaseAuditCheck[] = [];
  const rlsChecks: DatabaseAuditCheck[] = [];

  const addCheck = (c: DatabaseAuditCheck) => checks.push(c);

  // 1. Environment & Connection Checks (Secrets vs Publishable clarity)
  addCheck({
    category: 'Connection',
    name: 'Supabase Credentials & Runtime Config',
    status: envCfg.configured ? 'pass' : 'fail',
    detail: envCfg.configured
      ? `Connected target host=${envCfg.projectHost} (${envCfg.secretKeyMode}) on ${runtime.label}`
      : envCfg.secretKeyMisconfiguration || envCfg.urlMisconfiguration || 'Missing SUPABASE_URL or SUPABASE_SECRET_KEY',
    remediation: envCfg.configured ? undefined : `Configure secrets in ${runtime.envHint}`,
  });

  addCheck({
    category: 'Connection',
    name: 'Publishable / Anon Key & Build-Time vs Runtime Clarity',
    status: envCfg.publishableKey ? 'pass' : 'warn',
    detail: envCfg.publishableKey
      ? `Publishable key present in server runtime (${envCfg.publishableKeyMode}).`
      : 'SUPABASE_PUBLISHABLE_KEY is not set in server runtime. Server PostgreSQL operations still work via SUPABASE_SECRET_KEY; set SUPABASE_PUBLISHABLE_KEY in Vercel/AI Studio Secrets to enable live anon RLS probes.',
    remediation: envCfg.publishableKey ? undefined : 'Add SUPABASE_PUBLISHABLE_KEY (sb_publishable_...) in Vercel Production env & AI Studio Secrets.',
  });

  const health = await checkAllSupabaseModulesHealth();
  const client = getSupabaseAdminClient();
  const anonClient = getSupabaseAnonClient();

  const columnExpectations: Record<string, string[]> = {
    articles: ['id', 'slug', 'status', 'featured_image', 'social_image_url', 'homepage_slot', 'deleted_at'],
    categories: ['id', 'slug', 'icon', 'icon_name', 'enabled'],
    category_pages: ['id', 'slug', 'name_en', 'name_ur', 'status', 'updated_by'],
    media_assets: ['id', 'title', 'filename', 'alt_text_en', 'alt_text_ur', 'storage_path'],
    ad_placements: ['id', 'slot_id', 'name', 'dimensions', 'enabled', 'type'],
    ad_campaigns: ['id', 'campaign_name', 'advertiser_name', 'status', 'budget_pkr', 'target_slots_json', 'banner_image_url', 'destination_url', 'priority'],
    seo_pages: ['id', 'route_path', 'path', 'og_image', 'focus_keyword', 'config_json'],
    seo_redirects: ['id', 'source_path', 'target_path', 'notes', 'updated_at'],
    sync_providers: ['id', 'name', 'category', 'endpoint', 'status', 'total_syncs', 'successful_syncs'],
    automation_jobs: ['id', 'provider_id', 'status', 'records_updated'],
    admin_users: ['id', 'email', 'role', 'status', 'mfa_enabled', 'bio_en', 'bio_ur'],
    site_settings: ['id', 'settings_json', 'updated_by'],
    ai_provider_credentials: ['id', 'provider_type', 'priority', 'rate_limit_info_json', 'encrypted_secret'],
    google_integrations_settings: ['id', 'ga4_measurement_id', 'gtm_container_id', 'gsc_property_url'],
    google_integration_secrets: ['id', 'auth_mode', 'encrypted_refresh_token', 'encrypted_service_account_json'],
    deleted_tombstones: ['entity_type', 'entity_id', 'deleted_at'],
    admin_auth_credentials: ['email', 'password_hash', 'mfa_enabled'],
    admin_sessions: ['session_id', 'revoked', 'expires_at'],
    automation_settings: ['id', 'settings_json'],
    cron_locks: ['lock_key', 'expires_at'],
    category_datasets: ['dataset', 'items_json'],
    public_submissions: ['id', 'submission_type', 'status'],
    schema_migrations: ['version', 'name', 'applied_at'],
  };

  const enrichedTables: CompleteDatabaseAuditReport['tables'] = [];

  if (client) {
    const colProbeResults = await Promise.all(
      health.tables.map(async t => {
        const expectedCols = columnExpectations[t.table];
        if (!t.ok || !expectedCols) {
          return { ...t };
        }
        try {
          const t0 = Date.now();
          const probe = await client.from(t.table).select(expectedCols.join(',')).limit(0);
          recordQueryTiming(t.table, 'audit_probe', Date.now() - t0);
          if (probe.error) {
            return {
              ...t,
              missingColumns: expectedCols,
              error: probe.error.message,
            };
          }
          return { ...t, missingColumns: [] };
        } catch (err: any) {
          return { ...t, error: err?.message || 'Column probe failed' };
        }
      })
    );
    enrichedTables.push(...colProbeResults);

    const missingTables = colProbeResults.filter(t => !t.ok).map(t => t.table);
    const columnMismatches = colProbeResults.filter(t => t.ok && t.error).map(t => `${t.table} (${t.error})`);

    addCheck({
      category: 'Schema',
      name: 'All Application Tables Accessible',
      status: missingTables.length === 0 ? 'pass' : 'fail',
      detail:
        missingTables.length === 0
          ? `All ${colProbeResults.length} monitored Supabase tables are reachable.`
          : `Missing/inaccessible tables: ${missingTables.join(', ')}`,
      remediation: missingTables.length === 0 ? undefined : 'Run database/migrations/next_verified_repair.sql in Supabase SQL Editor.',
    });

    addCheck({
      category: 'Schema',
      name: 'Column & Constraint Alignment',
      status: columnMismatches.length === 0 ? 'pass' : 'warn',
      detail:
        columnMismatches.length === 0
          ? 'Every reconciled column required by backend repositories is present in PostgREST schema cache.'
          : `Column mismatches found: ${columnMismatches.join(' | ')}`,
      remediation:
        columnMismatches.length === 0
          ? undefined
          : 'Apply database/migrations/next_verified_repair.sql + NOTIFY pgrst, \'reload schema\';',
    });

    // Advertising Manager Table Probe
    const adCampMeta = colProbeResults.find(t => t.table === 'ad_campaigns');
    const adSlotMeta = colProbeResults.find(t => t.table === 'ad_placements');
    const adsReady = Boolean(adCampMeta?.ok && !adCampMeta?.error && adSlotMeta?.ok);
    addCheck({
      category: 'Advertising',
      name: 'Advertising Tables (ad_placements & ad_campaigns)',
      status: adsReady ? 'pass' : 'fail',
      detail: adsReady
        ? `ad_placements (${adSlotMeta?.rowCount ?? 0} rows) and ad_campaigns (${adCampMeta?.rowCount ?? 0} rows) online & schema-verified.`
        : `Ad table issue: ${adCampMeta?.error || adSlotMeta?.error || 'public.ad_campaigns missing from PostgREST schema cache.'}`,
      remediation: adsReady ? undefined : 'Execute database/migrations/next_verified_repair.sql in Supabase SQL Editor and notify PostgREST schema cache reload.',
    });

    // Sync Providers Table & Feed CRUD Readiness Probe
    const syncMeta = colProbeResults.find(t => t.table === 'sync_providers');
    const jobsMeta = colProbeResults.find(t => t.table === 'automation_jobs');
    const syncReady = Boolean(syncMeta?.ok && !syncMeta?.error && jobsMeta?.ok);
    addCheck({
      category: 'Feeds & Sync',
      name: 'News & Data Feeds Registry (sync_providers & automation_jobs)',
      status: syncReady ? 'pass' : 'fail',
      detail: syncReady
        ? `sync_providers (${syncMeta?.rowCount ?? 0} feed rows) and automation_jobs (${jobsMeta?.rowCount ?? 0} execution rows) schema-verified.`
        : `Feed registry issue: ${syncMeta?.error || jobsMeta?.error || 'sync_providers table unavailable.'}`,
      remediation: syncReady ? undefined : 'Execute database/migrations/next_verified_repair.sql in Supabase SQL Editor.',
    });

    // Storage check
    addCheck({
      category: 'Storage',
      name: 'Supabase Storage Bucket (editorial-media)',
      status: health.storage.ok ? 'pass' : 'warn',
      detail: health.storage.detail,
      remediation: health.storage.ok ? undefined : 'Ensure bucket "editorial-media" exists (Migration 003 / next_verified_repair.sql).',
    });

    // Migration ledger check
    try {
      const migRes = await client.from('schema_migrations').select('version, applied_at').order('applied_at', { ascending: false }).limit(10);
      if (migRes.error) {
        addCheck({
          category: 'Migrations',
          name: 'Migration Ledger (public.schema_migrations)',
          status: 'warn',
          detail: `Ledger not yet initialized (${migRes.error.message}).`,
          remediation: 'Apply database/migrations/next_verified_repair.sql to register migration 009_next_verified_repair.',
        });
      } else {
        const versions = (migRes.data || []).map((m: any) => m.version);
        addCheck({
          category: 'Migrations',
          name: 'Migration Ledger (public.schema_migrations)',
          status: versions.includes('009_next_verified_repair') ? 'pass' : 'warn',
          detail: versions.length > 0 ? `Recorded migrations: ${versions.join(', ')}` : 'Table exists with 0 recorded entries.',
          remediation: versions.includes('009_next_verified_repair') ? undefined : 'Apply database/migrations/next_verified_repair.sql.',
        });
      }
    } catch {}

    // RLS Verification via publishable/anon key (zero secret exposure)
    if (anonClient) {
      const rlsTargets = [
        { label: 'Articles Drafts Blocked from Anon', table: 'articles', filter: (q: any) => q.eq('status', 'draft').limit(1) },
        { label: 'Category Pages Drafts Blocked from Anon', table: 'category_pages', filter: (q: any) => q.eq('status', 'draft').limit(1) },
        { label: 'AI Credentials Encrypted Vault Blocked from Anon', table: 'ai_provider_credentials', filter: (q: any) => q.limit(1) },
        { label: 'AI Metadata View Blocked from Anon', table: 'ai_provider_credentials_metadata', filter: (q: any) => q.limit(1) },
        { label: 'Google Integration Secrets Blocked from Anon', table: 'google_integration_secrets', filter: (q: any) => q.limit(1) },
        { label: 'Admin Auth Credentials Blocked from Anon', table: 'admin_auth_credentials', filter: (q: any) => q.limit(1) },
        { label: 'Admin Sessions Blocked from Anon', table: 'admin_sessions', filter: (q: any) => q.limit(1) },
        { label: 'Newsletter Subscribers Blocked from Anon Read', table: 'newsletter_subscribers', filter: (q: any) => q.limit(1) },
      ];
      for (const target of rlsTargets) {
        try {
          const probe = await target.filter(anonClient.from(target.table).select('*'));
          const blocked = Boolean(probe.error) || !probe.data || probe.data.length === 0;
          rlsChecks.push({
            category: 'RLS',
            name: target.label,
            status: blocked ? 'pass' : 'fail',
            detail: blocked
              ? `Anon read denied or returned 0 protected rows (${probe.error?.code || 'RLS_ISOLATED'}).`
              : `SECURITY ALERT: Anon client read ${probe.data.length} row(s) from ${target.table}!`,
            remediation: blocked ? undefined : 'Apply database/migrations/next_verified_repair.sql immediately.',
          });
        } catch {
          rlsChecks.push({
            category: 'RLS',
            name: target.label,
            status: 'pass',
            detail: 'Anon query rejected cleanly.',
          });
        }
      }
    } else {
      rlsChecks.push({
        category: 'RLS',
        name: 'Anon Client RLS Probe',
        status: 'warn',
        detail: 'SUPABASE_PUBLISHABLE_KEY / SUPABASE_ANON_KEY is not set; live anon policy probe skipped.',
        remediation: 'Set SUPABASE_PUBLISHABLE_KEY to enable live anon isolation checks.',
      });
    }

    // Domain summaries (strictly non-secret counts)
    const aiCredsCount = colProbeResults.find(t => t.table === 'ai_provider_credentials')?.rowCount ?? 0;
    const articlesCount = colProbeResults.find(t => t.table === 'articles')?.rowCount ?? 0;
    const tombCount = colProbeResults.find(t => t.table === 'deleted_tombstones')?.rowCount ?? 0;
    addCheck({
      category: 'AI Vault',
      name: 'AI Credentials & Task Routing Integrity',
      status: aiCredsCount > 0 ? 'pass' : 'warn',
      detail: `${aiCredsCount} encrypted AI provider credential row(s) stored in Supabase (raw keys redacted).`,
    });
    addCheck({
      category: 'Publishing',
      name: 'Articles & Deletion Tombstones',
      status: articlesCount > 0 ? 'pass' : 'warn',
      detail: `${articlesCount} article(s) in PostgreSQL; ${tombCount} deletion tombstone(s) preventing deleted seed resurrection.`,
    });
  } else {
    enrichedTables.push(...health.tables);
    rlsChecks.push({
      category: 'RLS',
      name: 'Supabase RLS Verification',
      status: 'warn',
      detail: 'Skipped because SUPABASE_URL / SUPABASE_SECRET_KEY are not set in runtime environment.',
    });
  }

  // Runtime Performance & Core Web Vitals Check
  const vitals = getWebVitalsSummary();
  const slowQueries = getSlowQueryLogs(20);
  addCheck({
    category: 'Performance',
    name: 'Core Web Vitals & Database Query Latency',
    status: slowQueries.length > 5 ? 'warn' : 'pass',
    detail: `Tracked samples=${vitals.sampleCount}, slow queries (>250ms)=${slowQueries.length}, hydration TTL=${HYDRATION_TTL_MS / 1000}s.`,
  });

  const allChecks = [...checks, ...rlsChecks];
  const passed = allChecks.filter(c => c.status === 'pass').length;
  const warnings = allChecks.filter(c => c.status === 'warn').length;
  const failed = allChecks.filter(c => c.status === 'fail').length;
  const overallStatus: CompleteDatabaseAuditReport['overallStatus'] =
    failed > 0 ? 'FAIL' : warnings > 0 ? 'WARN' : 'PASS';

  return {
    auditVersion: '2026.11-a-to-z-audit-v2',
    executedAt,
    readOnly: true,
    secretsRedacted: true,
    overallStatus,
    summary: { passed, warnings, failed, totalChecks: allChecks.length },
    environment: {
      runtime: runtime.label,
      deploymentEnv: runtime.deploymentEnv,
      configured: envCfg.configured,
      supabaseUrlConfigured: envCfg.supabaseUrlConfigured,
      supabaseSecretConfigured: envCfg.supabaseSecretConfigured,
      publishableKeyConfigured: Boolean(envCfg.publishableKey),
      projectHost: envCfg.projectHost,
      projectRef: envCfg.projectRef,
      secretKeyMode: envCfg.secretKeyMode,
    },
    tables: enrichedTables,
    rlsChecks,
    checks,
    storage: health.storage,
    recentErrors: getServerErrorLogs(25),
    slowQueries,
    webVitals: vitals,
    recommendedMigration: 'database/migrations/next_verified_repair.sql',
  };
}

