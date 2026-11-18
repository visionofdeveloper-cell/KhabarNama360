-- =============================================================================
-- 360Khabarnama — Migration 004: Complete Least-Privilege RLS & Storage Policies
-- Extends RLS cleanly to every new table created in Migration 003 plus the
-- 'editorial-media' Supabase Storage bucket.
-- =============================================================================

-- Enable RLS on all Migration 003 tables
ALTER TABLE public.ad_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audience_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_custom_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editorial_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broken_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_console_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_save_diagnostics ENABLE ROW LEVEL SECURITY;

-- 1. Ad Placements & Campaigns (Public reads active/enabled only; Ad Manager/Admin writes)
DROP POLICY IF EXISTS "ad_placements_public_read" ON public.ad_placements;
CREATE POLICY "ad_placements_public_read"
  ON public.ad_placements FOR SELECT
  TO anon, authenticated
  USING (enabled = TRUE OR public.is_active_admin());

DROP POLICY IF EXISTS "ad_placements_admin_all" ON public.ad_placements;
CREATE POLICY "ad_placements_admin_all"
  ON public.ad_placements FOR ALL
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Ad Manager']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Ad Manager']));

DROP POLICY IF EXISTS "ad_campaigns_public_read_active" ON public.ad_campaigns;
CREATE POLICY "ad_campaigns_public_read_active"
  ON public.ad_campaigns FOR SELECT
  TO anon, authenticated
  USING (status = 'active' OR public.is_active_admin());

DROP POLICY IF EXISTS "ad_campaigns_admin_all" ON public.ad_campaigns;
CREATE POLICY "ad_campaigns_admin_all"
  ON public.ad_campaigns FOR ALL
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Ad Manager']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Ad Manager']));

-- 2. Newsletter Subscribers & Audience Notifications
-- Public users may submit a subscription row, but CANNOT enumerate or read subscribers
DROP POLICY IF EXISTS "subscribers_public_insert" ON public.newsletter_subscribers;
CREATE POLICY "subscribers_public_insert"
  ON public.newsletter_subscribers FOR INSERT
  TO anon, authenticated
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "subscribers_admin_all" ON public.newsletter_subscribers;
CREATE POLICY "subscribers_admin_all"
  ON public.newsletter_subscribers FOR ALL
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor', 'Audience Manager']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor', 'Audience Manager']));

DROP POLICY IF EXISTS "audience_notifications_admin_all" ON public.audience_notifications;
CREATE POLICY "audience_notifications_admin_all"
  ON public.audience_notifications FOR ALL
  TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor', 'Editor', 'Audience Manager']));

DROP POLICY IF EXISTS "push_subscriptions_public_upsert" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_public_upsert"
  ON public.push_subscriptions FOR INSERT
  TO anon, authenticated
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "push_subscriptions_admin_read" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_admin_read"
  ON public.push_subscriptions FOR ALL
  TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

-- 3. Homepage Layout & Custom Blocks (Public read, Admin write)
DROP POLICY IF EXISTS "homepage_layouts_public_read" ON public.homepage_layouts;
CREATE POLICY "homepage_layouts_public_read"
  ON public.homepage_layouts FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "homepage_layouts_admin_all" ON public.homepage_layouts;
CREATE POLICY "homepage_layouts_admin_all"
  ON public.homepage_layouts FOR ALL
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor']));

DROP POLICY IF EXISTS "homepage_custom_blocks_public_read" ON public.homepage_custom_blocks;
CREATE POLICY "homepage_custom_blocks_public_read"
  ON public.homepage_custom_blocks FOR SELECT
  TO anon, authenticated
  USING (enabled = TRUE OR public.is_active_admin());

DROP POLICY IF EXISTS "homepage_custom_blocks_admin_all" ON public.homepage_custom_blocks;
CREATE POLICY "homepage_custom_blocks_admin_all"
  ON public.homepage_custom_blocks FOR ALL
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor']));

-- 4. Editorial Drafts, Broken Links, Search Console Config, SEO Logs & Save Diagnostics (Admin-only)
DROP POLICY IF EXISTS "editorial_drafts_admin_all" ON public.editorial_drafts;
CREATE POLICY "editorial_drafts_admin_all"
  ON public.editorial_drafts FOR ALL
  TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS "broken_links_admin_all" ON public.broken_links;
CREATE POLICY "broken_links_admin_all"
  ON public.broken_links FOR ALL
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'SEO Specialist', 'Managing Editor']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'SEO Specialist', 'Managing Editor']));

DROP POLICY IF EXISTS "search_console_config_superadmin" ON public.search_console_config;
CREATE POLICY "search_console_config_superadmin"
  ON public.search_console_config FOR ALL
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'SEO Specialist']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'SEO Specialist']));

DROP POLICY IF EXISTS "seo_audit_logs_admin_read" ON public.seo_audit_logs;
CREATE POLICY "seo_audit_logs_admin_read"
  ON public.seo_audit_logs FOR ALL
  TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

DROP POLICY IF EXISTS "admin_save_diagnostics_admin_all" ON public.admin_save_diagnostics;
CREATE POLICY "admin_save_diagnostics_admin_all"
  ON public.admin_save_diagnostics FOR ALL
  TO authenticated
  USING (public.is_active_admin())
  WITH CHECK (public.is_active_admin());

-- 5. Also ensure category_pages and sync_providers/automation_jobs/audit_logs have explicit admin read/write policies if missed
DROP POLICY IF EXISTS "category_pages_public_read" ON public.category_pages;
CREATE POLICY "category_pages_public_read"
  ON public.category_pages FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "category_pages_admin_write" ON public.category_pages;
CREATE POLICY "category_pages_admin_write"
  ON public.category_pages FOR ALL
  TO authenticated
  USING (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor', 'SEO Specialist']))
  WITH CHECK (public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor', 'SEO Specialist']));

-- 6. Supabase Storage Bucket ('editorial-media') RLS Policies
DROP POLICY IF EXISTS "editorial_media_public_read" ON storage.objects;
CREATE POLICY "editorial_media_public_read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'editorial-media');

DROP POLICY IF EXISTS "editorial_media_admin_upload" ON storage.objects;
CREATE POLICY "editorial_media_admin_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'editorial-media' AND public.is_active_admin());

DROP POLICY IF EXISTS "editorial_media_admin_update" ON storage.objects;
CREATE POLICY "editorial_media_admin_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'editorial-media' AND public.is_active_admin());

DROP POLICY IF EXISTS "editorial_media_admin_delete" ON storage.objects;
CREATE POLICY "editorial_media_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'editorial-media' AND public.has_admin_role(ARRAY['Super Admin', 'Administrator', 'Managing Editor', 'Editor']));
