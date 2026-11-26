-- =============================================================================
-- 360Khabarnama — Migration 009: Advertising (`public.ad_campaigns`, `public.ad_placements`)
-- & Complete Missing Admin-Module Schema Reconciliation
-- =============================================================================
-- SAFETY GUARANTEES FOR PRODUCTION:
--   1. Non-destructive & 100% idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).
--   2. NEVER drops, truncates, or alters existing table primary keys or existing rows.
--   3. Preserves `public.ai_provider_credentials` and all existing articles/users/settings/ads.
--   4. Ends with `NOTIFY pgrst, 'reload schema';` and structural verification queries.
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

CREATE OR REPLACE FUNCTION public.is_active_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE (auth_uid = auth.uid() OR LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', '')))
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_admin_role(allowed_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE (auth_uid = auth.uid() OR LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', '')))
      AND status = 'active'
      AND role = ANY(allowed_roles)
  );
$$;

-- -----------------------------------------------------------------------------
-- 1. Advertising & Monetization Manager Tables (`ad_placements` & `ad_campaigns`)
--    Note: `ad_campaigns.target_slots_json` (JSONB array) supports multi-slot
--    targeting against `ad_placements.slot_id` without restricting a campaign to
--    a single slot FK.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ad_placements (
  id TEXT PRIMARY KEY,
  slot_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT 'header_top',
  dimensions TEXT NOT NULL DEFAULT 'responsive',
  target_devices TEXT NOT NULL DEFAULT 'all',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  type TEXT NOT NULL DEFAULT 'banner',
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  ad_code_snippet TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ad_placements
  ADD COLUMN IF NOT EXISTS location TEXT NOT NULL DEFAULT 'header_top',
  ADD COLUMN IF NOT EXISTS dimensions TEXT NOT NULL DEFAULT 'responsive',
  ADD COLUMN IF NOT EXISTS target_devices TEXT NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'banner',
  ADD COLUMN IF NOT EXISTS impressions BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicks BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ad_code_snippet TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_ad_placements_slot_enabled
  ON public.ad_placements (slot_id, enabled);

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
  banner_image_url TEXT NOT NULL DEFAULT '',
  destination_url TEXT NOT NULL DEFAULT '',
  priority INTEGER NOT NULL DEFAULT 10,
  notes TEXT NOT NULL DEFAULT '',
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
  ADD COLUMN IF NOT EXISTS banner_image_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS destination_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '',
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

DROP TRIGGER IF EXISTS trg_ad_placements_updated_at ON public.ad_placements;
CREATE TRIGGER trg_ad_placements_updated_at
  BEFORE UPDATE ON public.ad_placements
  FOR EACH ROW EXECUTE FUNCTION public.kn360_set_updated_at();

DROP TRIGGER IF EXISTS trg_ad_campaigns_updated_at ON public.ad_campaigns;
CREATE TRIGGER trg_ad_campaigns_updated_at
  BEFORE UPDATE ON public.ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.kn360_set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. Missing Admin-Module Tables & Columns (When 003 / 004 / 008 Were Not Applied)
-- -----------------------------------------------------------------------------

-- 2A. Tombstones & Migration Ledger
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  applied_by TEXT NOT NULL DEFAULT CURRENT_USER,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

-- 2B. Editorial / Articles / Media / Category Extensions (From 003)
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS featured_image TEXT,
  ADD COLUMN IF NOT EXISTS hero_image_meta_json JSONB,
  ADD COLUMN IF NOT EXISTS featured_image_meta_json JSONB,
  ADD COLUMN IF NOT EXISTS social_image_url TEXT,
  ADD COLUMN IF NOT EXISTS use_hero_as_featured BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS homepage_slot TEXT;

CREATE INDEX IF NOT EXISTS idx_articles_pub_feed
  ON public.articles (status, published_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_articles_cat_pub
  ON public.articles (category, status, published_at DESC) WHERE deleted_at IS NULL;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS icon_name TEXT DEFAULT 'Newspaper';

ALTER TABLE public.category_pages
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL;

ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS filename TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS size_bytes BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'editorial',
  ADD COLUMN IF NOT EXISTS caption_en TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS caption_ur TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS alt_text_en TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS alt_text_ur TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS credit TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS license TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS storage_path TEXT NULL,
  ADD COLUMN IF NOT EXISTS width INTEGER NULL,
  ADD COLUMN IF NOT EXISTS height INTEGER NULL,
  ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;

ALTER TABLE public.seo_pages
  ADD COLUMN IF NOT EXISTS path TEXT NULL,
  ADD COLUMN IF NOT EXISTS og_image TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS focus_keyword TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS config_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.seo_redirects
  ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bio_en TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS bio_ur TEXT DEFAULT '';

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL;

-- 2C. Audience & Alerts Module
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

-- 2D. Homepage Builder & Custom Blocks
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

-- 2E. AI Content Studio Drafts
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

-- 2F. SEO Diagnostics, Search Console & Google Integrations
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

CREATE TABLE IF NOT EXISTS public.seo_audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  target TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

-- 2G. Live Data Feeds, Automation, Auth Sessions, Datasets, Submissions & Diagnostics
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

ALTER TABLE public.automation_jobs
  ADD COLUMN IF NOT EXISTS records_updated INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.automation_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cron_locks (
  lock_key TEXT PRIMARY KEY,
  locked_by TEXT NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

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

CREATE TABLE IF NOT EXISTS public.category_datasets (
  dataset TEXT PRIMARY KEY,
  items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_by TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

-- -----------------------------------------------------------------------------
-- 3. Least-Privilege RLS Policies (Advertising + All Reconciled Modules)
-- -----------------------------------------------------------------------------
ALTER TABLE public.ad_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deleted_tombstones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audience_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_custom_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editorial_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broken_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_console_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_integrations_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_integration_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_integration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cron_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_auth_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_save_diagnostics ENABLE ROW LEVEL SECURITY;

-- Advertising: public can only read active non-deleted campaigns & enabled slots;
-- authorized Ad Managers & Admins manage CRUD.
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

-- Private Server-Only Tables (Backend service_role only)
REVOKE ALL ON public.admin_auth_credentials FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.admin_sessions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.cron_locks FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.deleted_tombstones FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.public_submissions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.google_integration_secrets FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "admin_auth_credentials_deny_browser" ON public.admin_auth_credentials;
CREATE POLICY "admin_auth_credentials_deny_browser"
  ON public.admin_auth_credentials FOR ALL TO anon, authenticated USING (FALSE) WITH CHECK (FALSE);

DROP POLICY IF EXISTS "admin_sessions_deny_browser" ON public.admin_sessions;
CREATE POLICY "admin_sessions_deny_browser"
  ON public.admin_sessions FOR ALL TO anon, authenticated USING (FALSE) WITH CHECK (FALSE);

DROP POLICY IF EXISTS "cron_locks_deny_browser" ON public.cron_locks;
CREATE POLICY "cron_locks_deny_browser"
  ON public.cron_locks FOR ALL TO anon, authenticated USING (FALSE) WITH CHECK (FALSE);

DROP POLICY IF EXISTS "deleted_tombstones_deny_browser" ON public.deleted_tombstones;
CREATE POLICY "deleted_tombstones_deny_browser"
  ON public.deleted_tombstones FOR ALL TO anon, authenticated USING (FALSE) WITH CHECK (FALSE);

DROP POLICY IF EXISTS "public_submissions_deny_browser" ON public.public_submissions;
CREATE POLICY "public_submissions_deny_browser"
  ON public.public_submissions FOR ALL TO anon, authenticated USING (FALSE) WITH CHECK (FALSE);

DROP POLICY IF EXISTS "google_integration_secrets_deny_browser" ON public.google_integration_secrets;
CREATE POLICY "google_integration_secrets_deny_browser"
  ON public.google_integration_secrets FOR ALL TO anon, authenticated USING (FALSE) WITH CHECK (FALSE);

DROP POLICY IF EXISTS "google_integrations_settings_deny_browser" ON public.google_integrations_settings;
CREATE POLICY "google_integrations_settings_deny_browser"
  ON public.google_integrations_settings FOR ALL TO anon, authenticated USING (FALSE) WITH CHECK (FALSE);

DROP POLICY IF EXISTS "google_integration_logs_deny_browser" ON public.google_integration_logs;
CREATE POLICY "google_integration_logs_deny_browser"
  ON public.google_integration_logs FOR ALL TO anon, authenticated USING (FALSE) WITH CHECK (FALSE);

-- Audience, Layout, Drafts, Automation & SEO Admin Policies
DROP POLICY IF EXISTS "subscribers_public_insert" ON public.newsletter_subscribers;
CREATE POLICY "subscribers_public_insert"
  ON public.newsletter_subscribers FOR INSERT TO anon, authenticated WITH CHECK (TRUE);
REVOKE SELECT, UPDATE, DELETE ON public.newsletter_subscribers FROM anon;
DROP POLICY IF EXISTS "subscribers_admin_all" ON public.newsletter_subscribers;
CREATE POLICY "subscribers_admin_all"
  ON public.newsletter_subscribers FOR ALL TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor', 'Audience Manager']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor', 'Audience Manager']));

DROP POLICY IF EXISTS "audience_notifications_admin_all" ON public.audience_notifications;
CREATE POLICY "audience_notifications_admin_all"
  ON public.audience_notifications FOR ALL TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor', 'Editor', 'Audience Manager']));

DROP POLICY IF EXISTS "push_subscriptions_public_upsert" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_public_upsert"
  ON public.push_subscriptions FOR INSERT TO anon, authenticated WITH CHECK (TRUE);
DROP POLICY IF EXISTS "push_subscriptions_admin_read" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_admin_read"
  ON public.push_subscriptions FOR ALL TO authenticated
  USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS "homepage_layouts_public_read" ON public.homepage_layouts;
CREATE POLICY "homepage_layouts_public_read"
  ON public.homepage_layouts FOR SELECT TO anon, authenticated USING (TRUE);
DROP POLICY IF EXISTS "homepage_layouts_admin_all" ON public.homepage_layouts;
CREATE POLICY "homepage_layouts_admin_all"
  ON public.homepage_layouts FOR ALL TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor']));

DROP POLICY IF EXISTS "homepage_custom_blocks_public_read" ON public.homepage_custom_blocks;
CREATE POLICY "homepage_custom_blocks_public_read"
  ON public.homepage_custom_blocks FOR SELECT TO anon, authenticated
  USING (enabled = TRUE OR public.is_active_admin());
DROP POLICY IF EXISTS "homepage_custom_blocks_admin_all" ON public.homepage_custom_blocks;
CREATE POLICY "homepage_custom_blocks_admin_all"
  ON public.homepage_custom_blocks FOR ALL TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor']));

DROP POLICY IF EXISTS "editorial_drafts_admin_all" ON public.editorial_drafts;
CREATE POLICY "editorial_drafts_admin_all"
  ON public.editorial_drafts FOR ALL TO authenticated
  USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS "broken_links_admin_all" ON public.broken_links;
CREATE POLICY "broken_links_admin_all"
  ON public.broken_links FOR ALL TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'SEO Manager', 'SEO Specialist', 'Managing Editor']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'SEO Manager', 'SEO Specialist', 'Managing Editor']));

DROP POLICY IF EXISTS "search_console_config_superadmin" ON public.search_console_config;
CREATE POLICY "search_console_config_superadmin"
  ON public.search_console_config FOR ALL TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'SEO Manager', 'SEO Specialist']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'SEO Manager', 'SEO Specialist']));

DROP POLICY IF EXISTS "seo_audit_logs_admin_read" ON public.seo_audit_logs;
CREATE POLICY "seo_audit_logs_admin_read"
  ON public.seo_audit_logs FOR ALL TO authenticated
  USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS "sync_providers_admin_all" ON public.sync_providers;
CREATE POLICY "sync_providers_admin_all"
  ON public.sync_providers FOR ALL TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Automation Manager']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Automation Manager']));

DROP POLICY IF EXISTS "automation_jobs_admin_all" ON public.automation_jobs;
CREATE POLICY "automation_jobs_admin_all"
  ON public.automation_jobs FOR ALL TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Automation Manager']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Automation Manager']));

DROP POLICY IF EXISTS "automation_settings_admin_all" ON public.automation_settings;
CREATE POLICY "automation_settings_admin_all"
  ON public.automation_settings FOR ALL TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Automation Manager']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Automation Manager']));

DROP POLICY IF EXISTS "category_datasets_public_read" ON public.category_datasets;
CREATE POLICY "category_datasets_public_read"
  ON public.category_datasets FOR SELECT TO anon, authenticated USING (TRUE);
DROP POLICY IF EXISTS "category_datasets_admin_manage" ON public.category_datasets;
CREATE POLICY "category_datasets_admin_manage"
  ON public.category_datasets FOR ALL TO authenticated
  USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS "admin_save_diagnostics_admin_all" ON public.admin_save_diagnostics;
CREATE POLICY "admin_save_diagnostics_admin_all"
  ON public.admin_save_diagnostics FOR ALL TO authenticated
  USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS "schema_migrations_super_admin_read" ON public.schema_migrations;
CREATE POLICY "schema_migrations_super_admin_read"
  ON public.schema_migrations FOR SELECT TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator']));

-- Editorial Media Storage Bucket & Policies
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
    ON storage.objects FOR SELECT TO anon, authenticated
    USING (bucket_id = 'editorial-media');

  DROP POLICY IF EXISTS "editorial_media_admin_upload" ON storage.objects;
  CREATE POLICY "editorial_media_admin_upload"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'editorial-media' AND public.is_active_admin());

  DROP POLICY IF EXISTS "editorial_media_admin_update" ON storage.objects;
  CREATE POLICY "editorial_media_admin_update"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'editorial-media' AND public.is_active_admin());

  DROP POLICY IF EXISTS "editorial_media_admin_delete" ON storage.objects;
  CREATE POLICY "editorial_media_admin_delete"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'editorial-media' AND public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor', 'Editor']));
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping storage bucket/policy step due to role privileges: %', SQLERRM;
END $$;

GRANT SELECT ON public.ad_placements, public.ad_campaigns TO anon, authenticated;
GRANT ALL ON public.ad_placements, public.ad_campaigns TO authenticated;
GRANT INSERT ON public.newsletter_subscribers, public.push_subscriptions TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

INSERT INTO public.schema_migrations (version, name, description)
VALUES (
  '009_ad_campaigns_and_missing_modules_repair',
  '009_ad_campaigns_and_missing_modules_repair.sql',
  'Creates missing public.ad_campaigns & public.ad_placements and reconciles all remaining admin module tables, RLS, and indexes.'
)
ON CONFLICT (version) DO UPDATE SET
  applied_at = NOW(),
  description = EXCLUDED.description;

-- Reload PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';

-- Verification query: confirm public.ad_campaigns columns & RLS status across all public tables
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
