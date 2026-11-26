-- =============================================================================
-- 360Khabarnama — Master Schema Reconciliation, Missing Persistence Tables,
-- Tombstone Anti-Resurrection & Hardened Least-Privilege RLS Repair Migration
-- =============================================================================
-- SAFETY GUARANTEES FOR PRODUCTION EXECUTION:
--   1. Non-destructive, 100% idempotent (safe on fresh or partially migrated DBs)
--   2. NEVER drops, truncates, or recreates any existing table
--   3. Preserves ALL existing articles, users, categories, settings & credentials
--   4. Preserves public.ai_provider_credentials BIGINT PK & existing row IDs
--   5. Backfills legacy columns (`icon` -> `icon_name`, `route_path` <-> `path`, etc.)
--   6. Locks all credential, auth, session, cron-lock & secret tables to service_role
--   7. Ends with NOTIFY pgrst, 'reload schema' + structural verification query
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.kn360_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 1. Migration Tracking Ledger (public.schema_migrations)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  applied_by TEXT NOT NULL DEFAULT CURRENT_USER,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. Deletion Tombstones (Prevents Deleted Seed Records From Reappearing)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deleted_tombstones (
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  deleted_by TEXT NOT NULL DEFAULT 'Admin',
  reason TEXT NOT NULL DEFAULT '',
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_deleted_tombstones_type
  ON public.deleted_tombstones (entity_type, deleted_at DESC);

-- -----------------------------------------------------------------------------
-- 3. Reconcile Existing Core & Admin Module Columns (Fixes PGRST204 / 23502 / 23514)
-- -----------------------------------------------------------------------------

-- 3A. public.categories (`icon` vs `icon_name`)
CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_ur TEXT NOT NULL,
  description_en TEXT DEFAULT '',
  description_ur TEXT DEFAULT '',
  icon TEXT DEFAULT 'Newspaper',
  icon_name TEXT DEFAULT 'Newspaper',
  color TEXT DEFAULT '#0f6a44',
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS description_en TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS description_ur TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'Newspaper',
  ADD COLUMN IF NOT EXISTS icon_name TEXT DEFAULT 'Newspaper',
  ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#0f6a44',
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.categories
SET icon_name = COALESCE(NULLIF(icon_name, ''), NULLIF(icon, ''), 'Newspaper'),
    icon      = COALESCE(NULLIF(icon, ''), NULLIF(icon_name, ''), 'Newspaper')
WHERE icon_name IS DISTINCT FROM COALESCE(NULLIF(icon_name, ''), NULLIF(icon, ''), 'Newspaper')
   OR icon      IS DISTINCT FROM COALESCE(NULLIF(icon, ''), NULLIF(icon_name, ''), 'Newspaper');

-- 3B. public.category_pages (missing `updated_by`; safe defaults on `id/name_en/name_ur`)
CREATE TABLE IF NOT EXISTS public.category_pages (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL DEFAULT '',
  name_ur TEXT NOT NULL DEFAULT '',
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_by TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.category_pages
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.category_pages
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text,
  ALTER COLUMN name_en SET DEFAULT '',
  ALTER COLUMN name_ur SET DEFAULT '';

-- 3C. public.media_assets (`filename`, `alt_text_en`, `alt_text_ur`, safe default on `title`)
CREATE TABLE IF NOT EXISTS public.media_assets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  filename TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  thumbnail_url TEXT NULL,
  size_bytes BIGINT DEFAULT 0,
  mime_type TEXT DEFAULT 'image/jpeg',
  category TEXT DEFAULT 'editorial',
  caption_en TEXT DEFAULT '',
  caption_ur TEXT DEFAULT '',
  alt_en TEXT DEFAULT '',
  alt_ur TEXT DEFAULT '',
  alt_text_en TEXT DEFAULT '',
  alt_text_ur TEXT DEFAULT '',
  credit TEXT DEFAULT '',
  source TEXT DEFAULT '',
  license TEXT DEFAULT '',
  storage_path TEXT NULL,
  width INTEGER NULL,
  height INTEGER NULL,
  uploaded_by TEXT DEFAULT 'Editorial',
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS filename TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS size_bytes BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'editorial',
  ADD COLUMN IF NOT EXISTS caption_en TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS caption_ur TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS alt_en TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS alt_ur TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS alt_text_en TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS alt_text_ur TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS credit TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS license TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS storage_path TEXT NULL,
  ADD COLUMN IF NOT EXISTS width INTEGER NULL,
  ADD COLUMN IF NOT EXISTS height INTEGER NULL,
  ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;

ALTER TABLE public.media_assets
  ALTER COLUMN title SET DEFAULT '';

UPDATE public.media_assets
SET filename    = COALESCE(NULLIF(filename, ''), NULLIF(title, ''), id),
    title       = COALESCE(NULLIF(title, ''), NULLIF(filename, ''), id),
    alt_text_en = COALESCE(NULLIF(alt_text_en, ''), alt_en, ''),
    alt_en      = COALESCE(NULLIF(alt_en, ''), alt_text_en, ''),
    alt_text_ur = COALESCE(NULLIF(alt_text_ur, ''), alt_ur, ''),
    alt_ur      = COALESCE(NULLIF(alt_ur, ''), alt_text_ur, '');

-- 3D. public.seo_pages (`path`, `og_image`, `focus_keyword`, `config_json` & safe `route_path`/`canonical_url`)
CREATE TABLE IF NOT EXISTS public.seo_pages (
  id TEXT PRIMARY KEY,
  route_path TEXT NOT NULL UNIQUE,
  path TEXT NULL UNIQUE,
  title_en TEXT NOT NULL DEFAULT '',
  title_ur TEXT NOT NULL DEFAULT '',
  meta_desc_en TEXT DEFAULT '',
  meta_desc_ur TEXT DEFAULT '',
  canonical_url TEXT NOT NULL DEFAULT '',
  robots_directives TEXT NOT NULL DEFAULT 'index, follow',
  og_image TEXT DEFAULT '',
  schema_type TEXT NOT NULL DEFAULT 'WebPage',
  focus_keyword TEXT DEFAULT '',
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.seo_pages
  ADD COLUMN IF NOT EXISTS path TEXT NULL,
  ADD COLUMN IF NOT EXISTS og_image TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS focus_keyword TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.seo_pages
  ALTER COLUMN title_en SET DEFAULT '',
  ALTER COLUMN title_ur SET DEFAULT '',
  ALTER COLUMN canonical_url SET DEFAULT '';

UPDATE public.seo_pages
SET path = COALESCE(NULLIF(path, ''), route_path),
    route_path = COALESCE(NULLIF(route_path, ''), path)
WHERE path IS NULL OR path = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_seo_pages_path
  ON public.seo_pages (path) WHERE path IS NOT NULL;

-- 3E. public.seo_redirects (`notes`, `updated_at`)
CREATE TABLE IF NOT EXISTS public.seo_redirects (
  id TEXT PRIMARY KEY,
  source_path TEXT NOT NULL UNIQUE,
  target_path TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 301 CHECK (status_code IN (301, 302, 410)),
  hits INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.seo_redirects
  ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 3F. public.sync_providers (full reconciliation incl. field_mapping_json, custom_headers_json & counters)
CREATE TABLE IF NOT EXISTS public.sync_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  interval_minutes INTEGER NOT NULL DEFAULT 30,
  attribution TEXT DEFAULT '',
  last_sync_at TIMESTAMPTZ NULL,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sync_providers
  ADD COLUMN IF NOT EXISTS method TEXT NOT NULL DEFAULT 'GET',
  ADD COLUMN IF NOT EXISTS daily_quota_limit INTEGER NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS daily_calls_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requires_api_key BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_api_key BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS encrypted_api_key TEXT NULL,
  ADD COLUMN IF NOT EXISTS masked_api_key TEXT NULL,
  ADD COLUMN IF NOT EXISTS auth_header_name TEXT DEFAULT 'Authorization',
  ADD COLUMN IF NOT EXISTS attribution_required BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS commercial_rights BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_licensed BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS license_type TEXT DEFAULT 'public_open',
  ADD COLUMN IF NOT EXISTS last_error TEXT NULL,
  ADD COLUMN IF NOT EXISTS next_sync_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS field_mapping_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS custom_headers_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_built_in BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS total_syncs INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS successful_syncs INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_sync_providers_status_next
  ON public.sync_providers (status, next_sync_at);

-- 3G. public.automation_jobs (`records_updated`; preserve historical logs if provider is deleted)
CREATE TABLE IF NOT EXISTS public.automation_jobs (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  status TEXT NOT NULL,
  trigger_source TEXT NOT NULL DEFAULT 'cron',
  duration_ms INTEGER NOT NULL DEFAULT 0,
  summary TEXT DEFAULT '',
  error_message TEXT DEFAULT '',
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.automation_jobs
  ADD COLUMN IF NOT EXISTS records_updated INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_automation_jobs_provider_exec
  ON public.automation_jobs (provider_id, executed_at DESC);

-- 3H. public.admin_users & RLS Role Helpers
CREATE TABLE IF NOT EXISTS public.admin_users (
  id TEXT PRIMARY KEY,
  auth_uid UUID UNIQUE NULL,
  name_en TEXT NOT NULL,
  name_ur TEXT NOT NULL DEFAULT 'اداریہ 360 خبرنامہ',
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'Read-only Analyst',
  permissions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  avatar_url TEXT DEFAULT '',
  articles_count INTEGER NOT NULL DEFAULT 0,
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  bio_en TEXT DEFAULT '',
  bio_ur TEXT DEFAULT '',
  last_login_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bio_en TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS bio_ur TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON public.admin_users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_admin_users_auth_uid ON public.admin_users (auth_uid);

CREATE OR REPLACE FUNCTION public.is_active_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE auth_uid IS NOT NULL
        AND auth_uid = auth.uid()
        AND status = 'active'
    ),
    FALSE
  );
$$;

CREATE OR REPLACE FUNCTION public.has_admin_role(allowed_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE auth_uid IS NOT NULL
        AND auth_uid = auth.uid()
        AND status = 'active'
        AND role = ANY(allowed_roles)
    ),
    FALSE
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_admin_role(TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_admin_role(TEXT[]) TO anon, authenticated, service_role;

-- 3I. public.site_settings (`updated_by`)
CREATE TABLE IF NOT EXISTS public.site_settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL;

-- 3J. public.editorial_drafts (`category`, `status`)
CREATE TABLE IF NOT EXISTS public.editorial_drafts (
  id TEXT PRIMARY KEY,
  template TEXT NOT NULL,
  title_en TEXT NOT NULL DEFAULT '',
  title_ur TEXT NOT NULL DEFAULT '',
  summary_en TEXT NOT NULL DEFAULT '',
  summary_ur TEXT NOT NULL DEFAULT '',
  content_en TEXT NOT NULL DEFAULT '',
  content_ur TEXT NOT NULL DEFAULT '',
  category TEXT DEFAULT 'pakistan',
  provider_type TEXT NULL,
  model TEXT NULL,
  total_tokens INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.editorial_drafts
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'pakistan',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';

-- 3J2. public.ad_placements & public.ad_campaigns (Fixes missing table error when 001/002 were applied without 003)
CREATE TABLE IF NOT EXISTS public.ad_placements (
  id TEXT PRIMARY KEY,
  slot_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT 'header_top',
  dimensions TEXT DEFAULT 'responsive',
  target_devices TEXT NOT NULL DEFAULT 'all',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  type TEXT DEFAULT 'banner',
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  ad_code_snippet TEXT DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ad_placements
  ADD COLUMN IF NOT EXISTS location TEXT NOT NULL DEFAULT 'header_top',
  ADD COLUMN IF NOT EXISTS dimensions TEXT DEFAULT 'responsive',
  ADD COLUMN IF NOT EXISTS target_devices TEXT NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'banner',
  ADD COLUMN IF NOT EXISTS impressions BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicks BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ad_code_snippet TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.ad_campaigns (
  id TEXT PRIMARY KEY,
  campaign_name TEXT NOT NULL,
  advertiser_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft', 'active', 'paused', 'archived', 'completed')),
  budget_pkr NUMERIC(14,2) NOT NULL DEFAULT 0,
  spent_pkr NUMERIC(14,2) NOT NULL DEFAULT 0,
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  ctr NUMERIC(6,2) NOT NULL DEFAULT 0,
  start_date TEXT NULL,
  end_date TEXT NULL,
  target_slots_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  banner_image_url TEXT DEFAULT '',
  destination_url TEXT DEFAULT '',
  priority INTEGER NOT NULL DEFAULT 10,
  notes TEXT DEFAULT '',
  updated_by TEXT NULL,
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ad_campaigns
  ADD COLUMN IF NOT EXISTS advertiser_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS budget_pkr NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spent_pkr NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS impressions BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicks BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ctr NUMERIC(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS start_date TEXT NULL,
  ADD COLUMN IF NOT EXISTS end_date TEXT NULL,
  ADD COLUMN IF NOT EXISTS target_slots_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS banner_image_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS destination_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT c.conname INTO con_name
  FROM pg_constraint c
  WHERE c.conrelid = 'public.ad_campaigns'::regclass
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%paused%';

  IF con_name IS NOT NULL AND con_name <> 'chk_ad_campaigns_status' THEN
    EXECUTE format('ALTER TABLE public.ad_campaigns DROP CONSTRAINT %I', con_name);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ad_campaigns'::regclass
      AND conname = 'chk_ad_campaigns_status'
  ) THEN
    ALTER TABLE public.ad_campaigns
      ADD CONSTRAINT chk_ad_campaigns_status
      CHECK (status IN ('draft', 'active', 'paused', 'archived', 'completed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_active_slots
  ON public.ad_campaigns (status, priority DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_target_slots_gin
  ON public.ad_campaigns USING GIN (target_slots_json);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_updated_at
  ON public.ad_campaigns (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_placements_slot_enabled
  ON public.ad_placements (slot_id, enabled);

-- 3J3. Audience, Homepage Layout, SEO Diagnostics & Save Telemetry Tables (From Migration 003)
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  language TEXT NOT NULL DEFAULT 'both',
  frequency TEXT NOT NULL DEFAULT 'daily',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'unsubscribed', 'bounced')),
  consent_source TEXT DEFAULT 'website',
  consent_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscribers_status
  ON public.newsletter_subscribers (status, subscribed_at DESC);

CREATE TABLE IF NOT EXISTS public.audience_notifications (
  id TEXT PRIMARY KEY,
  title_en TEXT NOT NULL DEFAULT '',
  title_ur TEXT NOT NULL DEFAULT '',
  body_en TEXT NOT NULL DEFAULT '',
  body_ur TEXT NOT NULL DEFAULT '',
  target_language TEXT NOT NULL DEFAULT 'both',
  target_url TEXT DEFAULT 'https://www.360khabarnama.com',
  category TEXT,
  recipients_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'sent',
  error_summary TEXT,
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id TEXT PRIMARY KEY,
  endpoint TEXT UNIQUE NOT NULL,
  keys_json JSONB DEFAULT '{}'::jsonb,
  topics_json JSONB DEFAULT '{}'::jsonb,
  language TEXT NOT NULL DEFAULT 'both',
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.homepage_layouts (
  id TEXT PRIMARY KEY DEFAULT 'default',
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.homepage_custom_blocks (
  id TEXT PRIMARY KEY,
  title_en TEXT NOT NULL DEFAULT '',
  title_ur TEXT NOT NULL DEFAULT '',
  body_en TEXT NOT NULL DEFAULT '',
  body_ur TEXT NOT NULL DEFAULT '',
  placement TEXT NOT NULL DEFAULT 'homepage',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  config_json JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.broken_links (
  id TEXT PRIMARY KEY,
  source_url TEXT NOT NULL,
  broken_target_url TEXT NOT NULL,
  http_status INTEGER DEFAULT 404,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS public.search_console_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.search_console_config
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL;

CREATE TABLE IF NOT EXISTS public.seo_audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  target TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seo_audit_logs_created
  ON public.seo_audit_logs (created_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_save_diagnostics (
  id TEXT PRIMARY KEY,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  record_id TEXT,
  storage_engine TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  verified_read_back BOOLEAN NOT NULL DEFAULT FALSE,
  latency_ms INTEGER DEFAULT 0,
  actor TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_save_diag_created
  ON public.admin_save_diagnostics (created_at DESC);

CREATE TABLE IF NOT EXISTS public.publication_logs (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  action TEXT NOT NULL,
  next_status TEXT NOT NULL,
  storage_engine TEXT NOT NULL,
  actor TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  ip_address TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3J4. Google Integrations Settings, Encrypted Secrets & Logs (From Migration 008)
CREATE TABLE IF NOT EXISTS public.google_integrations_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  ga4_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ga4_measurement_id TEXT NOT NULL DEFAULT '',
  ga4_tracking_mode TEXT NOT NULL DEFAULT 'gtm'
    CHECK (ga4_tracking_mode IN ('gtm', 'direct_gtag', 'disabled')),
  ga4_anonymize_ip BOOLEAN NOT NULL DEFAULT TRUE,
  ga4_debug_mode BOOLEAN NOT NULL DEFAULT FALSE,
  ga4_exclude_admin BOOLEAN NOT NULL DEFAULT TRUE,
  ga4_exclude_staging BOOLEAN NOT NULL DEFAULT FALSE,
  ga4_track_enhanced_events BOOLEAN NOT NULL DEFAULT TRUE,
  ga4_last_verified_at TIMESTAMPTZ NULL,
  ga4_last_error TEXT NOT NULL DEFAULT '',
  gtm_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  gtm_container_id TEXT NOT NULL DEFAULT '',
  gtm_exclude_admin BOOLEAN NOT NULL DEFAULT TRUE,
  gtm_consent_mode_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  gtm_last_verified_at TIMESTAMPTZ NULL,
  gtm_last_error TEXT NOT NULL DEFAULT '',
  gsc_verification_code TEXT NOT NULL DEFAULT '',
  gsc_property_url TEXT NOT NULL DEFAULT 'https://www.360khabarnama.com/',
  gsc_scope_mode TEXT NOT NULL DEFAULT 'webmasters'
    CHECK (gsc_scope_mode IN ('readonly', 'webmasters')),
  gsc_diagnostic_status TEXT NOT NULL DEFAULT 'Disconnected',
  gsc_diagnostic_message TEXT NOT NULL DEFAULT '',
  gsc_last_verified_at TIMESTAMPTZ NULL,
  gsc_last_synced_at TIMESTAMPTZ NULL,
  gsc_last_error TEXT NOT NULL DEFAULT '',
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.google_integration_secrets (
  id TEXT PRIMARY KEY DEFAULT 'gsc_default',
  provider TEXT NOT NULL DEFAULT 'search_console'
    CHECK (provider IN ('search_console', 'ga4', 'gtm')),
  auth_mode TEXT NOT NULL DEFAULT 'none'
    CHECK (auth_mode IN ('none', 'oauth2', 'service_account')),
  client_id TEXT NULL,
  encrypted_client_secret TEXT NULL,
  encrypted_refresh_token TEXT NULL,
  encrypted_access_token TEXT NULL,
  encrypted_service_account_json TEXT NULL,
  service_account_email TEXT NULL,
  granted_scopes TEXT NULL,
  token_expires_at TIMESTAMPTZ NULL,
  updated_by TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.google_integration_logs (
  id TEXT PRIMARY KEY,
  integration TEXT NOT NULL
    CHECK (integration IN ('ga4', 'gtm', 'gsc', 'system')),
  action TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('ok', 'warning', 'error', 'info')),
  message TEXT NOT NULL DEFAULT '',
  details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor TEXT NOT NULL DEFAULT 'System',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_google_integration_logs_created
  ON public.google_integration_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_google_integration_logs_integration
  ON public.google_integration_logs (integration, created_at DESC);

-- 3K. public.articles: Ensure table & Migration 003 editorial media columns + expanded workflow status CHECK
CREATE TABLE IF NOT EXISTS public.articles (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title_en TEXT NOT NULL DEFAULT '',
  title_ur TEXT NOT NULL DEFAULT '',
  summary_en TEXT NOT NULL DEFAULT '',
  summary_ur TEXT NOT NULL DEFAULT '',
  content_en TEXT NOT NULL DEFAULT '',
  content_ur TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'pakistan',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  is_breaking BOOLEAN NOT NULL DEFAULT FALSE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_trending BOOLEAN NOT NULL DEFAULT FALSE,
  hero_image TEXT NOT NULL DEFAULT '',
  image_caption_en TEXT NOT NULL DEFAULT '',
  image_caption_ur TEXT NOT NULL DEFAULT '',
  reading_time_min INTEGER NOT NULL DEFAULT 3,
  author_id TEXT NOT NULL DEFAULT 'admin-desk',
  author_name_en TEXT NOT NULL DEFAULT '360Khabarnama Editorial',
  author_name_ur TEXT NOT NULL DEFAULT 'ادارہ 360 خبرنامہ',
  author_role TEXT NOT NULL DEFAULT 'Editor',
  seo_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  versions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  workflow_notes TEXT DEFAULT '',
  failure_reason TEXT DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  views INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ NULL,
  scheduled_at TIMESTAMPTZ NULL,
  deleted_at TIMESTAMPTZ NULL,
  created_by TEXT DEFAULT '',
  updated_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS featured_image TEXT,
  ADD COLUMN IF NOT EXISTS hero_image_meta_json JSONB,
  ADD COLUMN IF NOT EXISTS featured_image_meta_json JSONB,
  ADD COLUMN IF NOT EXISTS social_image_url TEXT,
  ADD COLUMN IF NOT EXISTS use_hero_as_featured BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS homepage_slot TEXT;
DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT c.conname INTO con_name
  FROM pg_constraint c
  WHERE c.conrelid = 'public.articles'::regclass
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%in_review%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.articles DROP CONSTRAINT %I', con_name);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.articles'::regclass
      AND conname = 'chk_articles_status'
  ) THEN
    ALTER TABLE public.articles
      ADD CONSTRAINT chk_articles_status
      CHECK (status IN ('draft', 'review', 'in_review', 'approved', 'scheduled', 'published', 'archived', 'rejected', 'failed'));
  END IF;
END $$;

-- Performance composite indexes for high-traffic public & admin reads
CREATE INDEX IF NOT EXISTS idx_articles_pub_feed
  ON public.articles (status, published_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_articles_cat_pub
  ON public.articles (category, status, published_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_articles_slug_active
  ON public.articles (slug) WHERE deleted_at IS NULL;

-- 3L. public.ai_provider_credentials (Complete non-destructive backfill matching Migration 007)
CREATE TABLE IF NOT EXISTS public.ai_provider_credentials (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ai_provider_credentials
  ADD COLUMN IF NOT EXISTS provider_type TEXT NOT NULL DEFAULT 'gemini',
  ADD COLUMN IF NOT EXISTS label TEXT NOT NULL DEFAULT 'AI Provider',
  ADD COLUMN IF NOT EXISTS project_id TEXT NOT NULL DEFAULT 'default-project',
  ADD COLUMN IF NOT EXISTS endpoint_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS model TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS encrypted_secret TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS masked_key TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS daily_token_limit INTEGER NOT NULL DEFAULT 500000,
  ADD COLUMN IF NOT EXISTS daily_tokens_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_budget_usd NUMERIC(10,2) NOT NULL DEFAULT 25.00,
  ADD COLUMN IF NOT EXISTS monthly_spend_usd NUMERIC(12,6) NOT NULL DEFAULT 0.000000,
  ADD COLUMN IF NOT EXISTS billing_status TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS billing_note TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS model_list_status TEXT NOT NULL DEFAULT 'untested',
  ADD COLUMN IF NOT EXISTS generation_test_status TEXT NOT NULL DEFAULT 'untested',
  ADD COLUMN IF NOT EXISTS connection_status TEXT NOT NULL DEFAULT 'untested',
  ADD COLUMN IF NOT EXISTS available_models_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_tested_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS last_successful_verification_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS last_successful_generation_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS last_failure_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS last_test_status TEXT NOT NULL DEFAULT 'untested',
  ADD COLUMN IF NOT EXISTS last_test_message TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_latency_ms INTEGER NULL,
  ADD COLUMN IF NOT EXISTS last_correlation_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS last_diagnostic_json JSONB NULL,
  ADD COLUMN IF NOT EXISTS rate_limit_info_json JSONB NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE OR REPLACE VIEW public.ai_provider_credentials_metadata
WITH (security_invoker = true) AS
SELECT
  id, provider_type, label, project_id, endpoint_url, model, masked_key, enabled, priority,
  daily_token_limit, daily_tokens_used, monthly_budget_usd, monthly_spend_usd,
  connection_status, billing_status, billing_note, model_list_status, generation_test_status,
  available_models_json, last_tested_at, last_successful_verification_at,
  last_successful_generation_at, last_failure_at, last_test_status, last_test_message,
  last_latency_ms, last_correlation_id, created_at, updated_at, rate_limit_info_json
FROM public.ai_provider_credentials;

CREATE TABLE IF NOT EXISTS public.ai_providers (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  auth_scheme TEXT NOT NULL,
  supports_model_discovery BOOLEAN NOT NULL DEFAULT TRUE,
  supports_responses_api BOOLEAN NOT NULL DEFAULT FALSE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.ai_providers (id, slug, display_name, base_url, auth_scheme, supports_model_discovery, supports_responses_api, enabled)
VALUES
  ('gemini', 'gemini', 'Google Gemini', 'https://generativelanguage.googleapis.com/v1beta', 'x-goog-api-key', TRUE, FALSE, TRUE),
  ('grok', 'grok', 'xAI Grok', 'https://api.x.ai/v1', 'bearer', TRUE, TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  cred_id_type TEXT;
BEGIN
  SELECT data_type INTO cred_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'ai_provider_credentials'
    AND column_name = 'id';

  IF to_regclass('public.ai_provider_models') IS NULL THEN
    IF cred_id_type IN ('bigint', 'int8') THEN
      EXECUTE $sql$
        CREATE TABLE public.ai_provider_models (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          credential_id BIGINT NOT NULL REFERENCES public.ai_provider_credentials(id) ON DELETE CASCADE,
          provider_type TEXT NOT NULL,
          model_id TEXT NOT NULL,
          display_name TEXT NULL,
          supported_methods_json JSONB NOT NULL DEFAULT '[]'::jsonb,
          supports_text_generation BOOLEAN NOT NULL DEFAULT TRUE,
          input_token_limit INTEGER NULL,
          output_token_limit INTEGER NULL,
          discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT uq_ai_provider_models_cred_model UNIQUE (credential_id, model_id)
        )
      $sql$;
    ELSE
      EXECUTE $sql$
        CREATE TABLE public.ai_provider_models (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          credential_id TEXT NOT NULL REFERENCES public.ai_provider_credentials(id) ON DELETE CASCADE,
          provider_type TEXT NOT NULL,
          model_id TEXT NOT NULL,
          display_name TEXT NULL,
          supported_methods_json JSONB NOT NULL DEFAULT '[]'::jsonb,
          supports_text_generation BOOLEAN NOT NULL DEFAULT TRUE,
          input_token_limit INTEGER NULL,
          output_token_limit INTEGER NULL,
          discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT uq_ai_provider_models_cred_model UNIQUE (credential_id, model_id)
        )
      $sql$;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ai_provider_models_cred
  ON public.ai_provider_models (credential_id);

CREATE TABLE IF NOT EXISTS public.ai_task_routes (
  task TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  primary_credential_id TEXT NULL,
  primary_model TEXT NOT NULL DEFAULT '',
  fallback_credential_id TEXT NULL,
  fallback_model TEXT DEFAULT '',
  temperature NUMERIC(3,2) NOT NULL DEFAULT 0.40,
  max_tokens INTEGER NOT NULL DEFAULT 3072,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  credential_id TEXT NOT NULL DEFAULT '',
  provider_type TEXT NOT NULL DEFAULT 'gemini',
  project_id TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  task TEXT NOT NULL DEFAULT '',
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0.000000,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error')),
  error_message TEXT NULL,
  correlation_id TEXT NULL,
  actor TEXT NOT NULL DEFAULT 'System',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ai_usage_logs
  ADD COLUMN IF NOT EXISTS project_id TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0.000000,
  ADD COLUMN IF NOT EXISTS correlation_id TEXT NULL;

CREATE TABLE IF NOT EXISTS public.ai_connection_tests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  credential_id TEXT NULL,
  provider_type TEXT NOT NULL DEFAULT 'gemini',
  model_tested TEXT NULL,
  stage TEXT NOT NULL DEFAULT 'model_list',
  ok BOOLEAN NOT NULL DEFAULT FALSE,
  connection_status TEXT NOT NULL DEFAULT 'untested',
  latency_ms INTEGER NOT NULL DEFAULT 0,
  diagnostic_json JSONB NULL,
  actor TEXT NOT NULL DEFAULT 'Super Admin',
  tested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 4. New Persistent Tables Replacing Previously Ephemeral JSON / RAM Storage
-- -----------------------------------------------------------------------------

-- 4A. Admin Local Password & TOTP MFA Vault (Backend Service Role Only)
CREATE TABLE IF NOT EXISTS public.admin_auth_credentials (
  email TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  password_hash TEXT NOT NULL DEFAULT '',
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_secret_enc TEXT NULL,
  reset_token_hash TEXT NULL,
  reset_token_expires_at BIGINT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until BIGINT NULL,
  last_login_at TIMESTAMPTZ NULL,
  password_updated_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4B. Persistent Admin Sessions & Revocation Registry (Serverless Safe)
CREATE TABLE IF NOT EXISTS public.admin_sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT 'Administrator',
  role TEXT NOT NULL,
  ip_address TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_at TIMESTAMPTZ NULL,
  expires_at BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires
  ON public.admin_sessions (expires_at, revoked);

-- 4C. Automation Global Settings
CREATE TABLE IF NOT EXISTS public.automation_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4D. Distributed Cron Lock Table (Replaces /tmp ephemeral locks)
CREATE TABLE IF NOT EXISTS public.cron_locks (
  lock_key TEXT PRIMARY KEY,
  locked_by TEXT NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- 4E. Structured Category & Utility Datasets (Education, Finance, Jobs, etc.)
CREATE TABLE IF NOT EXISTS public.category_datasets (
  dataset TEXT PRIMARY KEY,
  items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_by TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4F. Public News Tips, Corrections, Contact & Feedback Submissions
CREATE TABLE IF NOT EXISTS public.public_submissions (
  id TEXT PRIMARY KEY,
  submission_type TEXT NOT NULL
    CHECK (submission_type IN ('news_tip', 'correction', 'copyright', 'advertise', 'feedback', 'contact')),
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  article_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'reviewed', 'resolved', 'archived')),
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_submissions_created
  ON public.public_submissions (created_at DESC);

-- -----------------------------------------------------------------------------
-- 5. Updated-at Triggers for Reconciled & New Tables
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_seo_pages_updated_at ON public.seo_pages;
CREATE TRIGGER trg_seo_pages_updated_at
  BEFORE UPDATE ON public.seo_pages
  FOR EACH ROW EXECUTE FUNCTION public.kn360_set_updated_at();

DROP TRIGGER IF EXISTS trg_seo_redirects_updated_at ON public.seo_redirects;
CREATE TRIGGER trg_seo_redirects_updated_at
  BEFORE UPDATE ON public.seo_redirects
  FOR EACH ROW EXECUTE FUNCTION public.kn360_set_updated_at();

DROP TRIGGER IF EXISTS trg_category_pages_updated_at ON public.category_pages;
CREATE TRIGGER trg_category_pages_updated_at
  BEFORE UPDATE ON public.category_pages
  FOR EACH ROW EXECUTE FUNCTION public.kn360_set_updated_at();

DROP TRIGGER IF EXISTS trg_admin_auth_credentials_updated_at ON public.admin_auth_credentials;
CREATE TRIGGER trg_admin_auth_credentials_updated_at
  BEFORE UPDATE ON public.admin_auth_credentials
  FOR EACH ROW EXECUTE FUNCTION public.kn360_set_updated_at();

DROP TRIGGER IF EXISTS trg_automation_settings_updated_at ON public.automation_settings;
CREATE TRIGGER trg_automation_settings_updated_at
  BEFORE UPDATE ON public.automation_settings
  FOR EACH ROW EXECUTE FUNCTION public.kn360_set_updated_at();

DROP TRIGGER IF EXISTS trg_category_datasets_updated_at ON public.category_datasets;
CREATE TRIGGER trg_category_datasets_updated_at
  BEFORE UPDATE ON public.category_datasets
  FOR EACH ROW EXECUTE FUNCTION public.kn360_set_updated_at();

DROP TRIGGER IF EXISTS trg_public_submissions_updated_at ON public.public_submissions;
CREATE TRIGGER trg_public_submissions_updated_at
  BEFORE UPDATE ON public.public_submissions
  FOR EACH ROW EXECUTE FUNCTION public.kn360_set_updated_at();

DROP TRIGGER IF EXISTS trg_ad_placements_updated_at ON public.ad_placements;
CREATE TRIGGER trg_ad_placements_updated_at
  BEFORE UPDATE ON public.ad_placements
  FOR EACH ROW EXECUTE FUNCTION public.kn360_set_updated_at();

DROP TRIGGER IF EXISTS trg_ad_campaigns_updated_at ON public.ad_campaigns;
CREATE TRIGGER trg_ad_campaigns_updated_at
  BEFORE UPDATE ON public.ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.kn360_set_updated_at();

DROP TRIGGER IF EXISTS trg_sync_providers_updated_at ON public.sync_providers;
CREATE TRIGGER trg_sync_providers_updated_at
  BEFORE UPDATE ON public.sync_providers
  FOR EACH ROW EXECUTE FUNCTION public.kn360_set_updated_at();

DROP TRIGGER IF EXISTS trg_google_integrations_settings_updated_at ON public.google_integrations_settings;
CREATE TRIGGER trg_google_integrations_settings_updated_at
  BEFORE UPDATE ON public.google_integrations_settings
  FOR EACH ROW EXECUTE FUNCTION public.kn360_set_updated_at();

DROP TRIGGER IF EXISTS trg_google_integration_secrets_updated_at ON public.google_integration_secrets;
CREATE TRIGGER trg_google_integration_secrets_updated_at
  BEFORE UPDATE ON public.google_integration_secrets
  FOR EACH ROW EXECUTE FUNCTION public.kn360_set_updated_at();

-- -----------------------------------------------------------------------------
-- 6. Hardened Least-Privilege RLS, Storage Bucket & Role Reconciliation
-- -----------------------------------------------------------------------------
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_redirects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deleted_tombstones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_auth_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cron_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audience_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_custom_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editorial_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broken_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_console_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_save_diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_integrations_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_integration_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_integration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_provider_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_provider_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_task_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_connection_tests ENABLE ROW LEVEL SECURITY;

-- Server-only private tables: ZERO direct browser / PostgREST access for anon or authenticated
REVOKE ALL ON public.admin_auth_credentials FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.admin_sessions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.cron_locks FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.deleted_tombstones FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.public_submissions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.schema_migrations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.google_integration_secrets, public.google_integrations_settings, public.google_integration_logs,
  public.ai_providers, public.ai_provider_credentials, public.ai_provider_models,
  public.ai_task_routes, public.ai_usage_logs, public.ai_connection_tests
  FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "admin_auth_credentials_deny_browser" ON public.admin_auth_credentials;
CREATE POLICY "admin_auth_credentials_deny_browser"
  ON public.admin_auth_credentials FOR ALL
  TO anon, authenticated
  USING (FALSE) WITH CHECK (FALSE);

DROP POLICY IF EXISTS "admin_sessions_deny_browser" ON public.admin_sessions;
CREATE POLICY "admin_sessions_deny_browser"
  ON public.admin_sessions FOR ALL
  TO anon, authenticated
  USING (FALSE) WITH CHECK (FALSE);

DROP POLICY IF EXISTS "cron_locks_deny_browser" ON public.cron_locks;
CREATE POLICY "cron_locks_deny_browser"
  ON public.cron_locks FOR ALL
  TO anon, authenticated
  USING (FALSE) WITH CHECK (FALSE);

DROP POLICY IF EXISTS "deleted_tombstones_deny_browser" ON public.deleted_tombstones;
CREATE POLICY "deleted_tombstones_deny_browser"
  ON public.deleted_tombstones FOR ALL
  TO anon, authenticated
  USING (FALSE) WITH CHECK (FALSE);

DROP POLICY IF EXISTS "public_submissions_deny_browser" ON public.public_submissions;
CREATE POLICY "public_submissions_deny_browser"
  ON public.public_submissions FOR ALL
  TO anon, authenticated
  USING (FALSE) WITH CHECK (FALSE);

DROP POLICY IF EXISTS "schema_migrations_super_admin_read" ON public.schema_migrations;
CREATE POLICY "schema_migrations_super_admin_read"
  ON public.schema_migrations FOR SELECT
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator']));

-- Fix category_pages draft exposure introduced in Migration 004 (`USING (TRUE)` -> published only)
DROP POLICY IF EXISTS "category_pages_public_read" ON public.category_pages;
CREATE POLICY "category_pages_public_read"
  ON public.category_pages FOR SELECT
  TO anon, authenticated
  USING ((status = 'published' AND enabled = TRUE) OR public.is_active_admin());

DROP POLICY IF EXISTS "category_pages_admin_write" ON public.category_pages;
DROP POLICY IF EXISTS "category_pages_admin_manage" ON public.category_pages;
CREATE POLICY "category_pages_admin_manage"
  ON public.category_pages FOR ALL
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor', 'SEO Manager', 'SEO Specialist']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor', 'SEO Manager', 'SEO Specialist']));

-- Reconcile canonical & alias role names on Ads, Audience, SEO, Layout & Automation policies
DROP POLICY IF EXISTS "ad_placements_public_read" ON public.ad_placements;
CREATE POLICY "ad_placements_public_read"
  ON public.ad_placements FOR SELECT
  TO anon, authenticated
  USING (enabled = TRUE OR public.is_active_admin());

DROP POLICY IF EXISTS "ad_placements_admin_all" ON public.ad_placements;
CREATE POLICY "ad_placements_admin_all"
  ON public.ad_placements FOR ALL
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Advertising Manager', 'Ad Manager']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Advertising Manager', 'Ad Manager']));

DROP POLICY IF EXISTS "ad_campaigns_public_read_active" ON public.ad_campaigns;
CREATE POLICY "ad_campaigns_public_read_active"
  ON public.ad_campaigns FOR SELECT
  TO anon, authenticated
  USING ((status = 'active' AND deleted_at IS NULL) OR public.is_active_admin());

DROP POLICY IF EXISTS "ad_campaigns_admin_all" ON public.ad_campaigns;
CREATE POLICY "ad_campaigns_admin_all"
  ON public.ad_campaigns FOR ALL
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Advertising Manager', 'Ad Manager']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Advertising Manager', 'Ad Manager']));

-- Core Articles, Categories, Media, Settings & Admin Users Policies
DROP POLICY IF EXISTS "articles_public_read_published" ON public.articles;
CREATE POLICY "articles_public_read_published"
  ON public.articles FOR SELECT
  TO anon, authenticated
  USING (status = 'published' AND deleted_at IS NULL);

DROP POLICY IF EXISTS "articles_admin_read_all" ON public.articles;
CREATE POLICY "articles_admin_read_all"
  ON public.articles FOR SELECT
  TO authenticated
  USING (public.is_active_admin());

DROP POLICY IF EXISTS "articles_admin_insert" ON public.articles;
CREATE POLICY "articles_admin_insert"
  ON public.articles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor', 'Editor', 'Content Contributor']));

DROP POLICY IF EXISTS "articles_admin_update" ON public.articles;
CREATE POLICY "articles_admin_update"
  ON public.articles FOR UPDATE
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor', 'Editor', 'SEO Manager', 'Content Contributor']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor', 'Editor', 'SEO Manager', 'Content Contributor']));

DROP POLICY IF EXISTS "articles_admin_delete" ON public.articles;
CREATE POLICY "articles_admin_delete"
  ON public.articles FOR DELETE
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor']));

DROP POLICY IF EXISTS "categories_public_read" ON public.categories;
CREATE POLICY "categories_public_read"
  ON public.categories FOR SELECT
  TO anon, authenticated
  USING (enabled = TRUE);

DROP POLICY IF EXISTS "categories_admin_manage" ON public.categories;
CREATE POLICY "categories_admin_manage"
  ON public.categories FOR ALL
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor', 'Editor', 'SEO Manager']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor', 'Editor', 'SEO Manager']));

DROP POLICY IF EXISTS "media_public_read" ON public.media_assets;
CREATE POLICY "media_public_read"
  ON public.media_assets FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "media_admin_manage" ON public.media_assets;
CREATE POLICY "media_admin_manage"
  ON public.media_assets FOR ALL
  TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS "site_settings_admin_read" ON public.site_settings;
CREATE POLICY "site_settings_admin_read"
  ON public.site_settings FOR SELECT
  TO authenticated
  USING (public.is_active_admin());

DROP POLICY IF EXISTS "site_settings_super_admin_write" ON public.site_settings;
CREATE POLICY "site_settings_super_admin_write"
  ON public.site_settings FOR ALL
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator']));

DROP POLICY IF EXISTS "admin_users_self_or_super" ON public.admin_users;
CREATE POLICY "admin_users_self_or_super"
  ON public.admin_users FOR SELECT
  TO authenticated
  USING ((auth_uid IS NOT NULL AND auth_uid = auth.uid()) OR public.has_admin_role(ARRAY['Super Admin', 'Administrator']));

DROP POLICY IF EXISTS "subscribers_public_insert" ON public.newsletter_subscribers;
REVOKE ALL ON public.newsletter_subscribers FROM PUBLIC, anon;
DROP POLICY IF EXISTS "subscribers_admin_all" ON public.newsletter_subscribers;
CREATE POLICY "subscribers_admin_all"
  ON public.newsletter_subscribers FOR ALL
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor', 'Audience Manager']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor', 'Audience Manager']));

DROP POLICY IF EXISTS "audience_notifications_admin_all" ON public.audience_notifications;
CREATE POLICY "audience_notifications_admin_all"
  ON public.audience_notifications FOR ALL
  TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor', 'Editor', 'Audience Manager']));

DROP POLICY IF EXISTS "push_subscriptions_public_upsert" ON public.push_subscriptions;
REVOKE ALL ON public.push_subscriptions FROM PUBLIC, anon;
DROP POLICY IF EXISTS "push_subscriptions_admin_read" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_admin_read"
  ON public.push_subscriptions FOR ALL
  TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS "homepage_layouts_public_read" ON public.homepage_layouts;
CREATE POLICY "homepage_layouts_public_read"
  ON public.homepage_layouts FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "homepage_layouts_admin_all" ON public.homepage_layouts;
CREATE POLICY "homepage_layouts_admin_all"
  ON public.homepage_layouts FOR ALL
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor']));

DROP POLICY IF EXISTS "homepage_custom_blocks_public_read" ON public.homepage_custom_blocks;
CREATE POLICY "homepage_custom_blocks_public_read"
  ON public.homepage_custom_blocks FOR SELECT
  TO anon, authenticated
  USING (enabled = TRUE OR public.is_active_admin());

DROP POLICY IF EXISTS "homepage_custom_blocks_admin_all" ON public.homepage_custom_blocks;
CREATE POLICY "homepage_custom_blocks_admin_all"
  ON public.homepage_custom_blocks FOR ALL
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor']));

DROP POLICY IF EXISTS "editorial_drafts_admin_all" ON public.editorial_drafts;
CREATE POLICY "editorial_drafts_admin_all"
  ON public.editorial_drafts FOR ALL
  TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS "broken_links_admin_all" ON public.broken_links;
CREATE POLICY "broken_links_admin_all"
  ON public.broken_links FOR ALL
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'SEO Manager', 'SEO Specialist', 'Managing Editor']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'SEO Manager', 'SEO Specialist', 'Managing Editor']));

DROP POLICY IF EXISTS "search_console_config_superadmin" ON public.search_console_config;
CREATE POLICY "search_console_config_superadmin"
  ON public.search_console_config FOR ALL
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'SEO Manager', 'SEO Specialist']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'SEO Manager', 'SEO Specialist']));

DROP POLICY IF EXISTS "seo_audit_logs_admin_read" ON public.seo_audit_logs;
CREATE POLICY "seo_audit_logs_admin_read"
  ON public.seo_audit_logs FOR ALL
  TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS "admin_save_diagnostics_admin_all" ON public.admin_save_diagnostics;
CREATE POLICY "admin_save_diagnostics_admin_all"
  ON public.admin_save_diagnostics FOR ALL
  TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS "seo_pages_public_read" ON public.seo_pages;
CREATE POLICY "seo_pages_public_read"
  ON public.seo_pages FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "seo_pages_admin_manage" ON public.seo_pages;
CREATE POLICY "seo_pages_admin_manage"
  ON public.seo_pages FOR ALL
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor', 'SEO Manager', 'SEO Specialist']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor', 'SEO Manager', 'SEO Specialist']));

DROP POLICY IF EXISTS "seo_redirects_public_read" ON public.seo_redirects;
CREATE POLICY "seo_redirects_public_read"
  ON public.seo_redirects FOR SELECT
  TO anon, authenticated
  USING (active = TRUE OR public.is_active_admin());

DROP POLICY IF EXISTS "seo_redirects_admin_manage" ON public.seo_redirects;
CREATE POLICY "seo_redirects_admin_manage"
  ON public.seo_redirects FOR ALL
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor', 'SEO Manager', 'SEO Specialist']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor', 'SEO Manager', 'SEO Specialist']));

DROP POLICY IF EXISTS "sync_providers_admin_all" ON public.sync_providers;
CREATE POLICY "sync_providers_admin_all"
  ON public.sync_providers FOR ALL
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Automation Manager']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Automation Manager']));

DROP POLICY IF EXISTS "automation_jobs_admin_all" ON public.automation_jobs;
CREATE POLICY "automation_jobs_admin_all"
  ON public.automation_jobs FOR ALL
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Automation Manager']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Automation Manager']));

DROP POLICY IF EXISTS "automation_settings_admin_all" ON public.automation_settings;
CREATE POLICY "automation_settings_admin_all"
  ON public.automation_settings FOR ALL
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Automation Manager']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Automation Manager']));

DROP POLICY IF EXISTS "category_datasets_public_read" ON public.category_datasets;
CREATE POLICY "category_datasets_public_read"
  ON public.category_datasets FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "category_datasets_admin_manage" ON public.category_datasets;
CREATE POLICY "category_datasets_admin_manage"
  ON public.category_datasets FOR ALL
  TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS "google_integration_secrets_deny_browser" ON public.google_integration_secrets;
CREATE POLICY "google_integration_secrets_deny_browser"
  ON public.google_integration_secrets FOR ALL
  TO anon, authenticated
  USING (FALSE) WITH CHECK (FALSE);

DROP POLICY IF EXISTS "google_integrations_settings_deny_browser" ON public.google_integrations_settings;
CREATE POLICY "google_integrations_settings_deny_browser"
  ON public.google_integrations_settings FOR ALL
  TO anon, authenticated
  USING (FALSE) WITH CHECK (FALSE);

DROP POLICY IF EXISTS "google_integration_logs_deny_browser" ON public.google_integration_logs;
CREATE POLICY "google_integration_logs_deny_browser"
  ON public.google_integration_logs FOR ALL
  TO anon, authenticated
  USING (FALSE) WITH CHECK (FALSE);

DROP POLICY IF EXISTS "ai_credentials_deny_browser" ON public.ai_provider_credentials;
CREATE POLICY "ai_credentials_deny_browser"
  ON public.ai_provider_credentials FOR ALL
  TO anon, authenticated
  USING (FALSE) WITH CHECK (FALSE);

DROP POLICY IF EXISTS "ai_providers_deny_browser" ON public.ai_providers;
CREATE POLICY "ai_providers_deny_browser"
  ON public.ai_providers FOR ALL
  TO anon, authenticated
  USING (FALSE) WITH CHECK (FALSE);

DROP POLICY IF EXISTS "ai_provider_models_deny_browser" ON public.ai_provider_models;
CREATE POLICY "ai_provider_models_deny_browser"
  ON public.ai_provider_models FOR ALL
  TO anon, authenticated
  USING (FALSE) WITH CHECK (FALSE);

DROP POLICY IF EXISTS "ai_task_routes_deny_browser" ON public.ai_task_routes;
CREATE POLICY "ai_task_routes_deny_browser"
  ON public.ai_task_routes FOR ALL
  TO anon, authenticated
  USING (FALSE) WITH CHECK (FALSE);

DROP POLICY IF EXISTS "ai_usage_logs_deny_browser" ON public.ai_usage_logs;
CREATE POLICY "ai_usage_logs_deny_browser"
  ON public.ai_usage_logs FOR ALL
  TO anon, authenticated
  USING (FALSE) WITH CHECK (FALSE);

DROP POLICY IF EXISTS "ai_connection_tests_deny_browser" ON public.ai_connection_tests;
CREATE POLICY "ai_connection_tests_deny_browser"
  ON public.ai_connection_tests FOR ALL
  TO anon, authenticated
  USING (FALSE) WITH CHECK (FALSE);

DROP POLICY IF EXISTS "publication_logs_admin_read" ON public.publication_logs;
CREATE POLICY "publication_logs_admin_read"
  ON public.publication_logs FOR SELECT
  TO authenticated
  USING (public.is_active_admin());

DROP POLICY IF EXISTS "audit_logs_admin_read_only" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_read_only"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator']));

-- Editorial Media Storage Bucket & Policies (safe, non-failing if already provisioned)
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'editorial-media',
    'editorial-media',
    TRUE,
    8388608,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  )
  ON CONFLICT (id) DO UPDATE SET
    public = TRUE,
    file_size_limit = 8388608,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

  DROP POLICY IF EXISTS "editorial_media_public_read" ON storage.objects;
  CREATE POLICY "editorial_media_public_read"
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'editorial-media');

  DROP POLICY IF EXISTS "editorial_media_admin_upload" ON storage.objects;
  CREATE POLICY "editorial_media_admin_upload"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'editorial-media' AND public.is_active_admin());

  DROP POLICY IF EXISTS "editorial_media_admin_update" ON storage.objects;
  CREATE POLICY "editorial_media_admin_update"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'editorial-media' AND public.is_active_admin());

  DROP POLICY IF EXISTS "editorial_media_admin_delete" ON storage.objects;
  CREATE POLICY "editorial_media_admin_delete"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'editorial-media' AND public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor', 'Editor']));
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping storage.objects/buckets step due to role privileges: %', SQLERRM;
END $$;

-- Explicit browser role grants scoped strictly by RLS policies above
GRANT SELECT ON public.articles, public.categories, public.category_pages, public.seo_pages, public.seo_redirects, public.media_assets, public.ad_placements, public.ad_campaigns, public.homepage_layouts, public.homepage_custom_blocks, public.category_datasets TO anon, authenticated;
GRANT ALL ON public.ad_placements, public.ad_campaigns TO authenticated;

-- Grant full operational rights to trusted backend service_role across every table & sequence
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
REVOKE ALL ON public.ai_provider_credentials_metadata FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ai_provider_credentials_metadata TO service_role;

-- -----------------------------------------------------------------------------
-- 7. Record Repair Migration & Reload PostgREST Schema Cache
-- -----------------------------------------------------------------------------
INSERT INTO public.schema_migrations (version, name, description)
VALUES (
  '009_next_verified_repair',
  'next_verified_repair.sql',
  'Complete schema reconciliation, tombstones, auth/session/cron/datasets/submissions persistence, and hardened RLS.'
)
ON CONFLICT (version) DO UPDATE SET
  applied_at = NOW(),
  description = EXCLUDED.description;

NOTIFY pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- 8. Post-Migration Structural Verification
-- -----------------------------------------------------------------------------
SELECT
  t.table_name,
  c.relrowsecurity AS rls_enabled,
  COUNT(col.column_name) AS column_count
FROM information_schema.tables t
JOIN pg_class c ON c.relname = t.table_name
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.table_schema
JOIN information_schema.columns col ON col.table_schema = t.table_schema AND col.table_name = t.table_name
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
GROUP BY t.table_name, c.relrowsecurity
ORDER BY t.table_name;
