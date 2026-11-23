-- =============================================================================
-- 360Khabarnama — Migration 006 Rollback (Safe / Never Drops Tables or Data)
-- =============================================================================
DROP TRIGGER IF EXISTS trg_ai_providers_updated_at ON public.ai_providers;
DROP POLICY IF EXISTS "ai_provider_models_deny_browser" ON public.ai_provider_models;
REVOKE SELECT ON public.ai_provider_credentials_metadata FROM service_role;
DROP INDEX IF EXISTS idx_ai_creds_project_id;
DROP INDEX IF EXISTS idx_ai_provider_models_cred;
DROP INDEX IF EXISTS idx_ai_task_routes_primary_cred;
DROP INDEX IF EXISTS idx_ai_connection_tests_cred_time;
NOTIFY pgrst, 'reload schema';
