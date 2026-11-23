-- =============================================================================
-- 360Khabarnama — Migration 005: AI & API Providers CRUD, Schema Completeness & RLS
-- Safe, additive, idempotent migration (preserves all existing rows & logs).
-- =============================================================================

-- 1. Ensure public.ai_provider_credentials has all lifecycle, budget, billing & telemetry columns
ALTER TABLE public.ai_provider_credentials
  ADD COLUMN IF NOT EXISTS daily_token_limit INTEGER NOT NULL DEFAULT 500000,
  ADD COLUMN IF NOT EXISTS daily_tokens_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_budget_usd NUMERIC(10,2) NOT NULL DEFAULT 25.00,
  ADD COLUMN IF NOT EXISTS monthly_spend_usd NUMERIC(12,6) NOT NULL DEFAULT 0.000000,
  ADD COLUMN IF NOT EXISTS billing_status TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS billing_note TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS model_list_status TEXT NOT NULL DEFAULT 'untested',
  ADD COLUMN IF NOT EXISTS generation_test_status TEXT NOT NULL DEFAULT 'untested',
  ADD COLUMN IF NOT EXISTS last_successful_verification_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS last_successful_generation_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS last_failure_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS last_latency_ms INTEGER NULL,
  ADD COLUMN IF NOT EXISTS last_correlation_id TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_creds_provider_enabled
  ON public.ai_provider_credentials (provider_type, enabled, priority);

CREATE INDEX IF NOT EXISTS idx_ai_connection_tests_tested_at
  ON public.ai_connection_tests (tested_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at
  ON public.ai_usage_logs (created_at DESC);

-- 2. Ensure updated_at trigger exists for ai_task_routes as well
DROP TRIGGER IF EXISTS trg_ai_task_routes_updated_at ON public.ai_task_routes;
CREATE TRIGGER trg_ai_task_routes_updated_at
  BEFORE UPDATE ON public.ai_task_routes
  FOR EACH ROW EXECUTE FUNCTION public.kn360_set_updated_at();

-- 3. Seed canonical AI provider registry metadata if missing (non-destructive)
INSERT INTO public.ai_providers (id, slug, display_name, base_url, auth_scheme, enabled)
VALUES
  ('gemini', 'gemini', 'Google Gemini', 'https://generativelanguage.googleapis.com/v1beta', 'x-goog-api-key', TRUE),
  ('grok', 'grok', 'xAI Grok', 'https://api.x.ai/v1', 'bearer', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 4. Safe read-only projection without encrypted_secret for server diagnostics/audits
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
  updated_at
FROM public.ai_provider_credentials;

-- 5. Strict Least-Privilege RLS Policies for AI Tables
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_provider_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_task_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_connection_tests ENABLE ROW LEVEL SECURITY;

-- Raw credential table: DENY ALL direct browser access (anon & authenticated) so encrypted_secret never leaks
REVOKE ALL ON public.ai_provider_credentials FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "ai_credentials_deny_browser" ON public.ai_provider_credentials;
CREATE POLICY "ai_credentials_deny_browser"
  ON public.ai_provider_credentials FOR ALL
  TO anon, authenticated
  USING (FALSE)
  WITH CHECK (FALSE);

-- Restrict metadata view strictly to trusted server-side service_role (zero browser/ordinary user access)
REVOKE ALL ON public.ai_provider_credentials_metadata FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ai_provider_credentials_metadata TO service_role;

-- Provider registry catalog: authenticated Super Admin read/manage; zero anon access
REVOKE ALL ON public.ai_providers FROM PUBLIC, anon;
DROP POLICY IF EXISTS "ai_providers_super_admin_all" ON public.ai_providers;
CREATE POLICY "ai_providers_super_admin_all"
  ON public.ai_providers FOR ALL
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin']));

-- Task routing: authenticated Super Admin read/manage; zero anon access
REVOKE ALL ON public.ai_task_routes FROM PUBLIC, anon;
DROP POLICY IF EXISTS "ai_task_routes_super_admin_all" ON public.ai_task_routes;
CREATE POLICY "ai_task_routes_super_admin_all"
  ON public.ai_task_routes FOR ALL
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin']));

-- Connection tests & usage logs: Super Admin read-only from Supabase Auth; zero anon access
REVOKE ALL ON public.ai_connection_tests FROM PUBLIC, anon;
DROP POLICY IF EXISTS "ai_connection_tests_super_admin_read" ON public.ai_connection_tests;
CREATE POLICY "ai_connection_tests_super_admin_read"
  ON public.ai_connection_tests FOR SELECT
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin']));

REVOKE ALL ON public.ai_usage_logs FROM PUBLIC, anon;
DROP POLICY IF EXISTS "ai_usage_logs_super_admin_read" ON public.ai_usage_logs;
CREATE POLICY "ai_usage_logs_super_admin_read"
  ON public.ai_usage_logs FOR SELECT
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin']));

-- Ensure trusted server-side service_role retains full access across AI tables
GRANT ALL ON public.ai_providers TO service_role;
GRANT ALL ON public.ai_provider_credentials TO service_role;
GRANT ALL ON public.ai_task_routes TO service_role;
GRANT ALL ON public.ai_connection_tests TO service_role;
GRANT ALL ON public.ai_usage_logs TO service_role;

NOTIFY pgrst, 'reload schema';
