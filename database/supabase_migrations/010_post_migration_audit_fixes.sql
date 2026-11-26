-- =============================================================================
-- 360Khabarnama — Migration 010: Post-Migration Schema Audit & Security Delta
-- =============================================================================
-- Non-destructive incremental repair for databases that already executed 009.
-- Guarantees:
--   * Never drops or truncates tables or modifies existing record IDs
--   * Adds public.ai_provider_models (matching ai_provider_credentials.id type)
--   * Seeds gemini & grok rows in public.ai_providers if absent
--   * Adds missing ai_usage_logs columns (project_id, estimated_cost_usd, correlation_id)
--   * Adds missing description_en / description_ur on public.categories & full article backfill
--   * Enforces explicit REVOKE ALL on server-only private AI & Google tables
--   * Reloads PostgREST schema cache
-- =============================================================================

BEGIN;

-- 1. Seed built-in AI provider registry rows if absent
INSERT INTO public.ai_providers (id, slug, display_name, base_url, auth_scheme, supports_model_discovery, supports_responses_api, enabled)
VALUES
  ('gemini', 'gemini', 'Google Gemini', 'https://generativelanguage.googleapis.com/v1beta', 'x-goog-api-key', TRUE, FALSE, TRUE),
  ('grok', 'grok', 'xAI Grok', 'https://api.x.ai/v1', 'bearer', TRUE, TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- 2. Ensure public.ai_provider_models exists with dynamic FK type matching ai_provider_credentials(id)
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

-- 3. Reconcile missing columns on ai_usage_logs, categories & articles
ALTER TABLE public.ai_usage_logs
  ADD COLUMN IF NOT EXISTS project_id TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0.000000,
  ADD COLUMN IF NOT EXISTS correlation_id TEXT NULL;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS description_en TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS description_ur TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'Newspaper',
  ADD COLUMN IF NOT EXISTS icon_name TEXT DEFAULT 'Newspaper',
  ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#0f6a44',
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS is_breaking BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_trending BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS featured_image TEXT,
  ADD COLUMN IF NOT EXISTS hero_image_meta_json JSONB,
  ADD COLUMN IF NOT EXISTS featured_image_meta_json JSONB,
  ADD COLUMN IF NOT EXISTS social_image_url TEXT,
  ADD COLUMN IF NOT EXISTS use_hero_as_featured BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS homepage_slot TEXT,
  ADD COLUMN IF NOT EXISTS seo_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS versions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS workflow_notes TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS failure_reason TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_by TEXT DEFAULT '';

-- 4. RLS & Strict Privilege Hardening for Server-Only AI & Google Tables
ALTER TABLE public.ai_provider_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_provider_models_deny_browser" ON public.ai_provider_models;
CREATE POLICY "ai_provider_models_deny_browser"
  ON public.ai_provider_models FOR ALL
  TO anon, authenticated
  USING (FALSE) WITH CHECK (FALSE);

REVOKE ALL ON
  public.ai_providers,
  public.ai_provider_credentials,
  public.ai_provider_models,
  public.ai_task_routes,
  public.ai_usage_logs,
  public.ai_connection_tests,
  public.google_integrations_settings,
  public.google_integration_secrets,
  public.google_integration_logs
  FROM PUBLIC, anon, authenticated;

GRANT ALL ON public.ai_provider_models TO service_role;

-- 5. Record migration version
INSERT INTO public.schema_migrations (version, name, description)
VALUES (
  '010_post_migration_audit_fixes',
  '010_post_migration_audit_fixes.sql',
  'Non-destructive delta adding ai_provider_models, ai_providers seeds, ai_usage_logs/categories/articles backfill columns, and REVOKE defense-in-depth.'
)
ON CONFLICT (version) DO UPDATE SET
  applied_at = NOW(),
  description = EXCLUDED.description;

COMMIT;

NOTIFY pgrst, 'reload schema';
