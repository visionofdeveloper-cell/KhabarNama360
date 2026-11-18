-- =============================================================================
-- 360Khabarnama — Rollback Script for Migrations 003 & 004
-- Drops ONLY objects newly introduced by 003/004; preserves all 001/002 data.
-- =============================================================================

DROP POLICY IF EXISTS "editorial_media_admin_delete" ON storage.objects;
DROP POLICY IF EXISTS "editorial_media_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "editorial_media_admin_upload" ON storage.objects;
DROP POLICY IF EXISTS "editorial_media_public_read" ON storage.objects;

DROP TABLE IF EXISTS public.admin_save_diagnostics CASCADE;
DROP TABLE IF EXISTS public.seo_audit_logs CASCADE;
DROP TABLE IF EXISTS public.search_console_config CASCADE;
DROP TABLE IF EXISTS public.broken_links CASCADE;
DROP TABLE IF EXISTS public.editorial_drafts CASCADE;
DROP TABLE IF EXISTS public.homepage_custom_blocks CASCADE;
DROP TABLE IF EXISTS public.homepage_layouts CASCADE;
DROP TABLE IF EXISTS public.push_subscriptions CASCADE;
DROP TABLE IF EXISTS public.audience_notifications CASCADE;
DROP TABLE IF EXISTS public.newsletter_subscribers CASCADE;
DROP TABLE IF EXISTS public.ad_campaigns CASCADE;
DROP TABLE IF EXISTS public.ad_placements CASCADE;

DROP INDEX IF EXISTS idx_articles_published_feed;

ALTER TABLE public.articles
  DROP COLUMN IF EXISTS homepage_slot,
  DROP COLUMN IF EXISTS use_hero_as_featured,
  DROP COLUMN IF EXISTS social_image_url,
  DROP COLUMN IF EXISTS featured_image_meta_json,
  DROP COLUMN IF EXISTS hero_image_meta_json,
  DROP COLUMN IF EXISTS featured_image;
