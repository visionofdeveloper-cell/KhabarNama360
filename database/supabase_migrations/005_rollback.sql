-- =============================================================================
-- 360Khabarnama — Migration 005 Rollback (Safe / Preserves Data)
-- =============================================================================
DROP VIEW IF EXISTS public.ai_provider_credentials_metadata;
DROP TRIGGER IF EXISTS trg_ai_task_routes_updated_at ON public.ai_task_routes;
DROP POLICY IF EXISTS "ai_providers_super_admin_all" ON public.ai_providers;
DROP POLICY IF EXISTS "ai_task_routes_super_admin_all" ON public.ai_task_routes;
DROP POLICY IF EXISTS "ai_connection_tests_super_admin_read" ON public.ai_connection_tests;
DROP POLICY IF EXISTS "ai_usage_logs_super_admin_read" ON public.ai_usage_logs;
DROP INDEX IF EXISTS idx_ai_creds_provider_enabled;
DROP INDEX IF EXISTS idx_ai_connection_tests_tested_at;
DROP INDEX IF EXISTS idx_ai_usage_logs_created_at;
