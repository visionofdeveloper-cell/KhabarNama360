-- =============================================================================
-- 360Khabarnama — Migration 008 Rollback
-- Safely reverses ONLY the new Google Integrations tables created in Migration 008.
-- Preserves site_settings, articles, categories, users, and AI configurations.
-- =============================================================================

DROP TRIGGER IF EXISTS trg_google_integrations_settings_updated_at ON public.google_integrations_settings;
DROP TRIGGER IF EXISTS trg_google_integration_secrets_updated_at ON public.google_integration_secrets;

DROP TABLE IF EXISTS public.google_integration_logs CASCADE;
DROP TABLE IF EXISTS public.google_integration_secrets CASCADE;
DROP TABLE IF EXISTS public.google_integrations_settings CASCADE;

NOTIFY pgrst, 'reload schema';
