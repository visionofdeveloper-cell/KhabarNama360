-- =============================================================================
-- 360Khabarnama — Migration 007 Non-Destructive Rollback
-- Removes only views/indexes/triggers added in Migration 007.
-- NEVER drops tables or deletes stored AI credentials, articles, or logs.
-- =============================================================================

DROP VIEW IF EXISTS public.ai_provider_credentials_metadata;

DROP TRIGGER IF EXISTS trg_ai_providers_updated_at ON public.ai_providers;
DROP TRIGGER IF EXISTS trg_ai_credentials_updated_at ON public.ai_provider_credentials;
DROP TRIGGER IF EXISTS trg_ai_task_routes_updated_at ON public.ai_task_routes;

DROP INDEX IF EXISTS public.idx_ai_creds_provider_enabled;
DROP INDEX IF EXISTS public.idx_ai_creds_project_id;
DROP INDEX IF EXISTS public.idx_ai_provider_models_cred;
DROP INDEX IF EXISTS public.idx_ai_task_routes_primary_cred;
DROP INDEX IF EXISTS public.idx_ai_connection_tests_tested_at;
DROP INDEX IF EXISTS public.idx_ai_connection_tests_cred_time;
DROP INDEX IF EXISTS public.idx_ai_usage_logs_created_at;

NOTIFY pgrst, 'reload schema';
