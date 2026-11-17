-- =============================================================================
-- 360Khabarnama — Migration 001: Supabase PostgreSQL Core Bilingual Schema
-- Non-destructive, idempotent schema setup (UTF-8 / English + Urdu support)
-- Safe to run against an existing Supabase PostgreSQL project.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. Categories
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_ur TEXT NOT NULL,
  description_en TEXT DEFAULT '',
  description_ur TEXT DEFAULT '',
  icon TEXT DEFAULT 'Newspaper',
  color TEXT DEFAULT '#0f6a44',
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories (slug);

-- -----------------------------------------------------------------------------
-- 2. Admin Users & Permissions
-- -----------------------------------------------------------------------------
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
  last_login_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON public.admin_users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_admin_users_auth_uid ON public.admin_users (auth_uid);

-- -----------------------------------------------------------------------------
-- 3. Articles (Bilingual English + Urdu)
-- -----------------------------------------------------------------------------
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
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_review', 'scheduled', 'published', 'archived', 'failed')),
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT articles_require_headline CHECK (LENGTH(TRIM(title_en)) > 0 OR LENGTH(TRIM(title_ur)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_articles_status_pub ON public.articles (status, published_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_articles_category_status ON public.articles (category, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_articles_slug ON public.articles (slug);
CREATE INDEX IF NOT EXISTS idx_articles_updated_at ON public.articles (updated_at DESC);

-- -----------------------------------------------------------------------------
-- 4. Media Library
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.media_assets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  mime_type TEXT DEFAULT 'image/jpeg',
  alt_en TEXT DEFAULT '',
  alt_ur TEXT DEFAULT '',
  uploaded_by TEXT DEFAULT 'Editorial',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 5. Category Pages, SEO Pages & Redirects
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.category_pages (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_ur TEXT NOT NULL,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.seo_pages (
  id TEXT PRIMARY KEY,
  route_path TEXT NOT NULL UNIQUE,
  title_en TEXT NOT NULL,
  title_ur TEXT NOT NULL,
  meta_desc_en TEXT DEFAULT '',
  meta_desc_ur TEXT DEFAULT '',
  canonical_url TEXT NOT NULL,
  robots_directives TEXT NOT NULL DEFAULT 'index, follow',
  schema_type TEXT NOT NULL DEFAULT 'WebPage',
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.seo_redirects (
  id TEXT PRIMARY KEY,
  source_path TEXT NOT NULL UNIQUE,
  target_path TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 301 CHECK (status_code IN (301, 302, 410)),
  hits INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 6. Global Site Settings
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.site_settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 7. Encrypted AI Provider Vault & Logs (Private Backend Only)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_providers (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  auth_scheme TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_provider_credentials (
  id TEXT PRIMARY KEY,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('gemini', 'grok', 'custom', 'custom_data')),
  label TEXT NOT NULL,
  project_id TEXT NOT NULL,
  endpoint_url TEXT NULL,
  model TEXT NOT NULL,
  encrypted_secret TEXT NOT NULL,
  masked_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  priority INTEGER NOT NULL DEFAULT 10,
  connection_status TEXT NOT NULL DEFAULT 'untested',
  available_models_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_tested_at TIMESTAMPTZ NULL,
  last_test_status TEXT DEFAULT 'untested',
  last_test_message TEXT DEFAULT '',
  last_diagnostic_json JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
  id TEXT PRIMARY KEY,
  credential_id TEXT NOT NULL,
  provider_type TEXT NOT NULL,
  model TEXT NOT NULL,
  task TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error_message TEXT NULL,
  actor TEXT NOT NULL DEFAULT 'System',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_connection_tests (
  id TEXT PRIMARY KEY,
  credential_id TEXT NULL,
  provider_type TEXT NOT NULL,
  model_tested TEXT NULL,
  stage TEXT NOT NULL,
  ok BOOLEAN NOT NULL DEFAULT FALSE,
  connection_status TEXT NOT NULL,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  diagnostic_json JSONB NULL,
  actor TEXT NOT NULL DEFAULT 'Super Admin',
  tested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 8. Publication Logs, Automation Jobs, Sync Providers & Audit Logs
-- -----------------------------------------------------------------------------
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

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  ip_address TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 9. Automatic updated_at Trigger Helper
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kn360_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_articles_updated_at ON public.articles;
CREATE TRIGGER trg_articles_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.kn360_set_updated_at();

DROP TRIGGER IF EXISTS trg_categories_updated_at ON public.categories;
CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.kn360_set_updated_at();

DROP TRIGGER IF EXISTS trg_admin_users_updated_at ON public.admin_users;
CREATE TRIGGER trg_admin_users_updated_at
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW EXECUTE FUNCTION public.kn360_set_updated_at();

DROP TRIGGER IF EXISTS trg_ai_credentials_updated_at ON public.ai_provider_credentials;
CREATE TRIGGER trg_ai_credentials_updated_at
  BEFORE UPDATE ON public.ai_provider_credentials
  FOR EACH ROW EXECUTE FUNCTION public.kn360_set_updated_at();
