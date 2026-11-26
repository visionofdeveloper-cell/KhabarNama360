-- =============================================================================
-- 360Khabarnama — Migration 008: Google Analytics 4, Google Tag Manager &
-- Google Search Console Persistent Configuration, Server-Only Encrypted Vault & Logs
-- Safe, additive, idempotent migration (preserves all existing production data).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. Ensure public.site_settings has updated_by (resolves PGRST204 mismatch)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.site_settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL;

-- Ensure public.search_console_config exists cleanly and has updated_by
CREATE TABLE IF NOT EXISTS public.search_console_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.search_console_config
  ADD COLUMN IF NOT EXISTS updated_by TEXT NULL;

-- -----------------------------------------------------------------------------
-- 2. Structured Google Integrations Settings (GA4 + GTM + Search Console Meta)
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 3. Encrypted Google OAuth / Service Account Secret Vault (Backend Service Role Only)
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 4. Google Integrations Verification & Error Logs
-- -----------------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS idx_google_integration_logs_created
  ON public.google_integration_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_google_integration_logs_integration
  ON public.google_integration_logs (integration, created_at DESC);

-- -----------------------------------------------------------------------------
-- 5. Updated-at Triggers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kn360_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_google_integrations_settings_updated_at ON public.google_integrations_settings;
CREATE TRIGGER trg_google_integrations_settings_updated_at
  BEFORE UPDATE ON public.google_integrations_settings
  FOR EACH ROW EXECUTE FUNCTION public.kn360_set_updated_at();

DROP TRIGGER IF EXISTS trg_google_integration_secrets_updated_at ON public.google_integration_secrets;
CREATE TRIGGER trg_google_integration_secrets_updated_at
  BEFORE UPDATE ON public.google_integration_secrets
  FOR EACH ROW EXECUTE FUNCTION public.kn360_set_updated_at();

-- -----------------------------------------------------------------------------
-- 6. Strict Least-Privilege RLS (Secrets & Admin Settings Locked to Backend Service Role)
-- -----------------------------------------------------------------------------
ALTER TABLE public.google_integrations_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_integration_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_integration_logs ENABLE ROW LEVEL SECURITY;

-- Deny all direct browser/anon/authenticated PostgREST access to encrypted OAuth secrets
DROP POLICY IF EXISTS "google_integration_secrets_deny_browser" ON public.google_integration_secrets;
CREATE POLICY "google_integration_secrets_deny_browser"
  ON public.google_integration_secrets FOR ALL
  TO anon, authenticated
  USING (FALSE)
  WITH CHECK (FALSE);

-- Deny direct browser access to full integration settings & diagnostic logs
-- (Public reads sanitized non-secret flags via SSR & /api/public/tracking-config;
--  Super Admin / SEO Manager accesses admin routes verified by backend middleware.)
DROP POLICY IF EXISTS "google_integrations_settings_deny_browser" ON public.google_integrations_settings;
CREATE POLICY "google_integrations_settings_deny_browser"
  ON public.google_integrations_settings FOR ALL
  TO anon, authenticated
  USING (FALSE)
  WITH CHECK (FALSE);

DROP POLICY IF EXISTS "google_integration_logs_deny_browser" ON public.google_integration_logs;
CREATE POLICY "google_integration_logs_deny_browser"
  ON public.google_integration_logs FOR ALL
  TO anon, authenticated
  USING (FALSE)
  WITH CHECK (FALSE);

-- Restrict legacy search_console_config away from anon; allow only Super Admin/Administrator if queried directly
ALTER TABLE public.search_console_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "search_console_config_superadmin" ON public.search_console_config;
CREATE POLICY "search_console_config_superadmin"
  ON public.search_console_config FOR ALL
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator']));

-- Explicit service_role grants
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON public.site_settings TO service_role;
GRANT ALL ON public.search_console_config TO service_role;
GRANT ALL ON public.google_integrations_settings TO service_role;
GRANT ALL ON public.google_integration_secrets TO service_role;
GRANT ALL ON public.google_integration_logs TO service_role;

-- Reload PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';

-- Verification query (execute to inspect provisioned tables & columns)
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'site_settings',
    'search_console_config',
    'google_integrations_settings',
    'google_integration_secrets',
    'google_integration_logs'
  )
ORDER BY table_name, ordinal_position;
