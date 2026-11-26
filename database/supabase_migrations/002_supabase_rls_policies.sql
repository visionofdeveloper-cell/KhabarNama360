-- =============================================================================
-- 360Khabarnama — Migration 002: Least-Privilege Row Level Security (RLS)
-- Enforces public reads ONLY on published non-deleted content, zero public writes,
-- and complete isolation of drafts, admin profiles, AI secrets, and logs.
-- =============================================================================

-- Helper function: checks whether the current Supabase Auth user is an active admin
-- Security: strictly requires non-null immutable auth_uid = auth.uid() binding (never email-only matching)
CREATE OR REPLACE FUNCTION public.is_active_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE auth_uid IS NOT NULL
        AND auth_uid = auth.uid()
        AND status = 'active'
    ),
    FALSE
  );
$$;

CREATE OR REPLACE FUNCTION public.has_admin_role(allowed_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE auth_uid IS NOT NULL
        AND auth_uid = auth.uid()
        AND status = 'active'
        AND role = ANY(allowed_roles)
    ),
    FALSE
  );
$$;

-- Enable RLS across every table
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_redirects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_provider_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_task_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_connection_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 1. ARTICLES POLICIES (Public reads ONLY published; Admin writes by role)
-- =============================================================================
DROP POLICY IF EXISTS "articles_public_read_published" ON public.articles;
CREATE POLICY "articles_public_read_published"
  ON public.articles FOR SELECT
  TO anon, authenticated
  USING (status = 'published' AND deleted_at IS NULL);

DROP POLICY IF EXISTS "articles_admin_read_all" ON public.articles;
CREATE POLICY "articles_admin_read_all"
  ON public.articles FOR SELECT
  TO authenticated
  USING (public.is_active_admin());

DROP POLICY IF EXISTS "articles_admin_insert" ON public.articles;
CREATE POLICY "articles_admin_insert"
  ON public.articles FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor', 'Editor', 'Content Contributor'])
  );

DROP POLICY IF EXISTS "articles_admin_update" ON public.articles;
CREATE POLICY "articles_admin_update"
  ON public.articles FOR UPDATE
  TO authenticated
  USING (
    public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor', 'Editor', 'SEO Manager', 'Content Contributor'])
  )
  WITH CHECK (
    public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor', 'Editor', 'SEO Manager', 'Content Contributor'])
  );

DROP POLICY IF EXISTS "articles_admin_delete" ON public.articles;
CREATE POLICY "articles_admin_delete"
  ON public.articles FOR DELETE
  TO authenticated
  USING (
    public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor'])
  );

-- =============================================================================
-- 2. CATEGORIES, PAGES, SEO & PUBLIC SETTINGS
-- =============================================================================
DROP POLICY IF EXISTS "categories_public_read" ON public.categories;
CREATE POLICY "categories_public_read"
  ON public.categories FOR SELECT
  TO anon, authenticated
  USING (enabled = TRUE);

DROP POLICY IF EXISTS "categories_admin_manage" ON public.categories;
CREATE POLICY "categories_admin_manage"
  ON public.categories FOR ALL
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor', 'Editor', 'SEO Manager']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor', 'Editor', 'SEO Manager']));

DROP POLICY IF EXISTS "category_pages_public_read" ON public.category_pages;
CREATE POLICY "category_pages_public_read"
  ON public.category_pages FOR SELECT
  TO anon, authenticated
  USING (status = 'published' AND enabled = TRUE);

DROP POLICY IF EXISTS "category_pages_admin_manage" ON public.category_pages;
CREATE POLICY "category_pages_admin_manage"
  ON public.category_pages FOR ALL
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor', 'SEO Manager']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor', 'SEO Manager']));

DROP POLICY IF EXISTS "seo_pages_public_read" ON public.seo_pages;
CREATE POLICY "seo_pages_public_read"
  ON public.seo_pages FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "seo_pages_admin_manage" ON public.seo_pages;
CREATE POLICY "seo_pages_admin_manage"
  ON public.seo_pages FOR ALL
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor', 'SEO Manager']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor', 'SEO Manager']));

DROP POLICY IF EXISTS "media_public_read" ON public.media_assets;
CREATE POLICY "media_public_read"
  ON public.media_assets FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "media_admin_manage" ON public.media_assets;
CREATE POLICY "media_admin_manage"
  ON public.media_assets FOR ALL
  TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

-- =============================================================================
-- 3. PRIVATE ADMIN, AI VAULT & LOG TABLES (Zero Public Access)
-- =============================================================================
DROP POLICY IF EXISTS "site_settings_admin_read" ON public.site_settings;
CREATE POLICY "site_settings_admin_read"
  ON public.site_settings FOR SELECT
  TO authenticated
  USING (public.is_active_admin());

DROP POLICY IF EXISTS "site_settings_super_admin_write" ON public.site_settings;
CREATE POLICY "site_settings_super_admin_write"
  ON public.site_settings FOR ALL
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator']));

DROP POLICY IF EXISTS "admin_users_self_or_super" ON public.admin_users;
CREATE POLICY "admin_users_self_or_super"
  ON public.admin_users FOR SELECT
  TO authenticated
  USING (auth_uid = auth.uid() OR public.has_admin_role(ARRAY['Super Admin', 'Administrator']));

-- AI credentials, usage logs, and system audit tables allow NO direct browser client access.
-- Backend Express routes access them via verified admin middleware + SUPABASE_SECRET_KEY.
DROP POLICY IF EXISTS "ai_credentials_deny_browser" ON public.ai_provider_credentials;
CREATE POLICY "ai_credentials_deny_browser"
  ON public.ai_provider_credentials FOR ALL
  TO anon, authenticated
  USING (FALSE)
  WITH CHECK (FALSE);

DROP POLICY IF EXISTS "audit_logs_admin_read_only" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_read_only"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator']));
