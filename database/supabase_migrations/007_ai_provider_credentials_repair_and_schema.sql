-- =============================================================================
-- 360Khabarnama — Migration 007: Non-Destructive Repair of Existing
-- public.ai_provider_credentials (Preserving bigint PK & Identity + Existing Rows)
-- + Dependent AI Tables, Least-Privilege RLS & PostgREST Schema Reload
-- =============================================================================
-- GUARANTEES FOR PRODUCTION USE:
--   1. Preserves ALL existing records in public.ai_provider_credentials & all other tables
--   2. Preserves the existing `id` (bigint NOT NULL / identity) primary key & IDs
--   3. NEVER drops, truncates, or recreates existing tables
--   4. Uses ADD COLUMN IF NOT EXISTS with safe non-null defaults
--   5. Supports BOTH bigint identity IDs and legacy text IDs for dependent tables
--   6. Enforces strict Super Admin / service_role RLS with zero browser secret exposure
--   7. Reloads PostgREST schema cache & includes a final structure verification query
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ensure Data API & server roles can resolve public schema & identity sequences
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 1. Core Shared Trigger Function & Support Tables (Idempotent)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kn360_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

CREATE TABLE IF NOT EXISTS public.site_settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
-- 2. AI Providers Catalog Table (public.ai_providers)
-- -----------------------------------------------------------------------------
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

ALTER TABLE public.ai_providers
  ADD COLUMN IF NOT EXISTS supports_model_discovery BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS supports_responses_api BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

INSERT INTO public.ai_providers (id, slug, display_name, base_url, auth_scheme, supports_model_discovery, supports_responses_api, enabled)
VALUES
  ('gemini', 'gemini', 'Google Gemini', 'https://generativelanguage.googleapis.com/v1beta', 'x-goog-api-key', TRUE, FALSE, TRUE),
  ('grok', 'grok', 'xAI Grok', 'https://api.x.ai/v1', 'bearer', TRUE, TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. Non-Destructive Repair of public.ai_provider_credentials
--    - Does NOT drop, recreate, or alter existing `id` (bigint identity PK) or `created_at`
--    - Preserves all existing records and existing IDs untouched
--    - Adds every column required by supabaseAdmin.ts & AIProviderManager.ts
-- -----------------------------------------------------------------------------
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

-- Ensure Primary Key exists on `id` if the table was created without a PK constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.ai_provider_credentials'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE public.ai_provider_credentials
      ADD CONSTRAINT ai_provider_credentials_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Ensure provider_type check constraint exists safely without breaking existing rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.ai_provider_credentials'::regclass
      AND conname = 'chk_ai_provider_credentials_provider_type'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.ai_provider_credentials
      WHERE provider_type NOT IN ('gemini', 'grok', 'custom', 'custom_data')
    ) THEN
      ALTER TABLE public.ai_provider_credentials
        ADD CONSTRAINT chk_ai_provider_credentials_provider_type
        CHECK (provider_type IN ('gemini', 'grok', 'custom', 'custom_data'));
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ai_creds_provider_enabled
  ON public.ai_provider_credentials (provider_type, enabled, priority, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_creds_project_id
  ON public.ai_provider_credentials (provider_type, project_id);

-- -----------------------------------------------------------------------------
-- 4. Dependent Normalized Model Discovery, Task Routing & Telemetry Tables
--    - Dynamically matches ai_provider_credentials(id) type (BIGINT vs TEXT)
-- -----------------------------------------------------------------------------
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
  fallback_model TEXT NOT NULL DEFAULT '',
  temperature NUMERIC(3,2) NOT NULL DEFAULT 0.40,
  max_tokens INTEGER NOT NULL DEFAULT 3072,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ai_task_routes
  ADD COLUMN IF NOT EXISTS label TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS primary_credential_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS primary_model TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS fallback_credential_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS fallback_model TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS temperature NUMERIC(3,2) NOT NULL DEFAULT 0.40,
  ADD COLUMN IF NOT EXISTS max_tokens INTEGER NOT NULL DEFAULT 3072,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_ai_task_routes_primary_cred
  ON public.ai_task_routes (primary_credential_id);

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

ALTER TABLE public.ai_connection_tests
  ADD COLUMN IF NOT EXISTS credential_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS provider_type TEXT NOT NULL DEFAULT 'gemini',
  ADD COLUMN IF NOT EXISTS model_tested TEXT NULL,
  ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'model_list',
  ADD COLUMN IF NOT EXISTS ok BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS connection_status TEXT NOT NULL DEFAULT 'untested',
  ADD COLUMN IF NOT EXISTS latency_ms INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS diagnostic_json JSONB NULL,
  ADD COLUMN IF NOT EXISTS actor TEXT NOT NULL DEFAULT 'Super Admin',
  ADD COLUMN IF NOT EXISTS tested_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_ai_connection_tests_tested_at
  ON public.ai_connection_tests (tested_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_connection_tests_cred_time
  ON public.ai_connection_tests (credential_id, tested_at DESC);

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

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at
  ON public.ai_usage_logs (created_at DESC);

-- -----------------------------------------------------------------------------
-- 5. Automatic updated_at Triggers
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_ai_providers_updated_at ON public.ai_providers;
CREATE TRIGGER trg_ai_providers_updated_at
  BEFORE UPDATE ON public.ai_providers
  FOR EACH ROW EXECUTE FUNCTION public.kn360_set_updated_at();

DROP TRIGGER IF EXISTS trg_ai_credentials_updated_at ON public.ai_provider_credentials;
CREATE TRIGGER trg_ai_credentials_updated_at
  BEFORE UPDATE ON public.ai_provider_credentials
  FOR EACH ROW EXECUTE FUNCTION public.kn360_set_updated_at();

DROP TRIGGER IF EXISTS trg_ai_task_routes_updated_at ON public.ai_task_routes;
CREATE TRIGGER trg_ai_task_routes_updated_at
  BEFORE UPDATE ON public.ai_task_routes
  FOR EACH ROW EXECUTE FUNCTION public.kn360_set_updated_at();

-- -----------------------------------------------------------------------------
-- 6. Safe Redacted Metadata View (Zero Secret Exposure, Server/Super Admin Only)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.ai_provider_credentials_metadata
WITH (security_invoker = true) AS
SELECT
  id,
  provider_type,
  label,
  project_id,
  endpoint_url,
  model,
  masked_key,
  enabled,
  priority,
  daily_token_limit,
  daily_tokens_used,
  monthly_budget_usd,
  monthly_spend_usd,
  connection_status,
  billing_status,
  billing_note,
  model_list_status,
  generation_test_status,
  available_models_json,
  last_tested_at,
  last_successful_verification_at,
  last_successful_generation_at,
  last_failure_at,
  last_test_status,
  last_test_message,
  last_latency_ms,
  last_correlation_id,
  created_at,
  updated_at,
  rate_limit_info_json
FROM public.ai_provider_credentials;

-- -----------------------------------------------------------------------------
-- 7. Least-Privilege Row Level Security (RLS) & Role Grants
--    - Zero access for anon visitors and ordinary authenticated users
--    - Backend routes enforce Super Admin session verification & use service_role
-- -----------------------------------------------------------------------------
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_provider_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_provider_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_task_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_connection_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Raw encrypted credentials & discovered models: zero direct browser access
REVOKE ALL ON public.ai_provider_credentials FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "ai_credentials_deny_browser" ON public.ai_provider_credentials;
CREATE POLICY "ai_credentials_deny_browser"
  ON public.ai_provider_credentials FOR ALL
  TO anon, authenticated
  USING (FALSE)
  WITH CHECK (FALSE);

REVOKE ALL ON public.ai_provider_credentials_metadata FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ai_provider_credentials_metadata TO service_role;

REVOKE ALL ON public.ai_provider_models FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "ai_provider_models_deny_browser" ON public.ai_provider_models;
CREATE POLICY "ai_provider_models_deny_browser"
  ON public.ai_provider_models FOR ALL
  TO anon, authenticated
  USING (FALSE)
  WITH CHECK (FALSE);

-- Provider catalog, task routes, connection tests, usage logs: Super Admin only if using Supabase Auth, zero anon
REVOKE ALL ON public.ai_providers FROM PUBLIC, anon;
REVOKE ALL ON public.ai_task_routes FROM PUBLIC, anon;
REVOKE ALL ON public.ai_connection_tests FROM PUBLIC, anon;
REVOKE ALL ON public.ai_usage_logs FROM PUBLIC, anon;

DROP POLICY IF EXISTS "ai_providers_super_admin_all" ON public.ai_providers;
CREATE POLICY "ai_providers_super_admin_all"
  ON public.ai_providers FOR ALL
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin']));

DROP POLICY IF EXISTS "ai_task_routes_super_admin_all" ON public.ai_task_routes;
CREATE POLICY "ai_task_routes_super_admin_all"
  ON public.ai_task_routes FOR ALL
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin']));

DROP POLICY IF EXISTS "ai_connection_tests_super_admin_read" ON public.ai_connection_tests;
CREATE POLICY "ai_connection_tests_super_admin_read"
  ON public.ai_connection_tests FOR SELECT
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin']));

DROP POLICY IF EXISTS "ai_usage_logs_super_admin_read" ON public.ai_usage_logs;
CREATE POLICY "ai_usage_logs_super_admin_read"
  ON public.ai_usage_logs FOR SELECT
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin']));

-- Explicit privileges for trusted server-side service_role (including identity sequences)
GRANT ALL ON public.ai_providers TO service_role;
GRANT ALL ON public.ai_provider_credentials TO service_role;
GRANT ALL ON public.ai_provider_models TO service_role;
GRANT ALL ON public.ai_task_routes TO service_role;
GRANT ALL ON public.ai_connection_tests TO service_role;
GRANT ALL ON public.ai_usage_logs TO service_role;
GRANT ALL ON public.site_settings TO service_role;
GRANT ALL ON public.admin_users TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- -----------------------------------------------------------------------------
-- 8. Reload Supabase PostgREST Schema Cache Immediately
-- -----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- 9. Post-Migration Verification Query (Inspect Final Table Structure & RLS)
-- -----------------------------------------------------------------------------
SELECT
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default,
  c.is_identity,
  c.identity_generation
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'ai_provider_credentials'
ORDER BY c.ordinal_position;
