-- =============================================================================
-- 360Khabarnama — Migration 003: Complete Admin Modules, Media Metadata,
-- Advertising, Audience & Alerts, Homepage Layout, SEO Diagnostics & Save Health
-- Safe, additive, idempotent migration (preserves all existing production rows).
-- =============================================================================

-- 1. Extend public.articles with distinct Hero/Featured/Social image columns & slot
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS featured_image TEXT,
  ADD COLUMN IF NOT EXISTS hero_image_meta_json JSONB,
  ADD COLUMN IF NOT EXISTS featured_image_meta_json JSONB,
  ADD COLUMN IF NOT EXISTS social_image_url TEXT,
  ADD COLUMN IF NOT EXISTS use_hero_as_featured BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS homepage_slot TEXT;

CREATE INDEX IF NOT EXISTS idx_articles_published_feed
  ON public.articles (published_at DESC)
  WHERE status = 'published' AND deleted_at IS NULL;

-- 2. Extend public.media_assets with full editorial & EXIF metadata
ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS size_bytes BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'editorial',
  ADD COLUMN IF NOT EXISTS caption_en TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS caption_ur TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS width INTEGER,
  ADD COLUMN IF NOT EXISTS height INTEGER,
  ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS license TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- 3. Extend public.sync_providers with custom REST/RSS feed configuration & quotas
ALTER TABLE public.sync_providers
  ADD COLUMN IF NOT EXISTS method TEXT NOT NULL DEFAULT 'GET',
  ADD COLUMN IF NOT EXISTS daily_quota_limit INTEGER DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS daily_calls_used INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requires_api_key BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_api_key BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS encrypted_api_key TEXT,
  ADD COLUMN IF NOT EXISTS masked_api_key TEXT,
  ADD COLUMN IF NOT EXISTS auth_header_name TEXT DEFAULT 'Authorization',
  ADD COLUMN IF NOT EXISTS attribution_required BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS commercial_rights BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_licensed BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS license_type TEXT DEFAULT 'public_open',
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS next_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS field_mapping_json JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS custom_headers_json JSONB DEFAULT '{}'::jsonb;

-- 4. Advertising Placements & Direct Sponsorship Campaigns
CREATE TABLE IF NOT EXISTS public.ad_placements (
  id TEXT PRIMARY KEY,
  slot_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  dimensions TEXT DEFAULT 'responsive',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  type TEXT DEFAULT 'banner',
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  ad_code_snippet TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ad_campaigns (
  id TEXT PRIMARY KEY,
  campaign_name TEXT NOT NULL,
  advertiser_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft', 'active', 'paused', 'archived', 'completed')),
  budget_pkr NUMERIC(14,2) DEFAULT 0,
  spent_pkr NUMERIC(14,2) DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  ctr NUMERIC(6,2) DEFAULT 0,
  start_date TEXT,
  end_date TEXT,
  target_slots_json JSONB DEFAULT '[]'::jsonb,
  banner_image_url TEXT,
  destination_url TEXT,
  priority INTEGER DEFAULT 10,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status ON public.ad_campaigns (status, priority DESC);

-- 5. Audience, Newsletter Subscribers, Broadcasts & Web Push
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

CREATE INDEX IF NOT EXISTS idx_subscribers_status ON public.newsletter_subscribers (status, subscribed_at DESC);

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

-- 6. Homepage Layout & Custom Editorial Blocks
CREATE TABLE IF NOT EXISTS public.homepage_layouts (
  id TEXT PRIMARY KEY DEFAULT 'default',
  config_json JSONB NOT NULL,
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

-- 7. AI Editorial Studio Drafts
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
  provider_type TEXT,
  model TEXT,
  total_tokens INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Broken Links, Search Console Config, & SEO Audit Logs
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
  config_json JSONB NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_seo_audit_logs_created ON public.seo_audit_logs (created_at DESC);

-- 9. Admin Save Diagnostics Telemetry
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

CREATE INDEX IF NOT EXISTS idx_admin_save_diag_created ON public.admin_save_diagnostics (created_at DESC);

-- 10. Editorial Media Storage Bucket (public read, admin write via RLS)
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
