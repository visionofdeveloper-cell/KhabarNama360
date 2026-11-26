# 360Khabarnama — Database Repair Migration Rollback Plan

**Target Migration:** `database/migrations/next_verified_repair.sql`  
**Principle:** Additive schema columns are safe to leave in place without data loss; rollback scripts must **NEVER drop core tables** (`articles`, `categories`, `admin_users`, `site_settings`, `ai_provider_credentials`) or delete production rows.

---

## Pre-Migration Snapshot Recommendation (Supabase SQL Editor / Dashboard)
Before applying `next_verified_repair.sql`, create an on-demand Supabase backup (Supabase Dashboard -> Database -> Backups) or export schema/table counts via `database/audit/schema_inventory.sql`.

---

## Safe Selective Rollback Steps (If Required)

### 1. Roll Back Only New Auxiliary Tables (Zero Impact on Core Data)
If reverting back to an older backend commit prior to adding tombstones, persistent auth, or datasets:

```sql
-- Only run if reverting application code prior to next_verified_repair.sql
DROP TABLE IF EXISTS public.public_submissions;
DROP TABLE IF EXISTS public.category_datasets;
DROP TABLE IF EXISTS public.cron_locks;
DROP TABLE IF EXISTS public.automation_settings;
DROP TABLE IF EXISTS public.admin_sessions;
DROP TABLE IF EXISTS public.admin_auth_credentials;
DROP TABLE IF EXISTS public.deleted_tombstones;
DELETE FROM public.schema_migrations WHERE version = '009_next_verified_repair';
NOTIFY pgrst, 'reload schema';
```

### 2. Roll Back Only Policy Changes on `category_pages` or `articles` Constraint
Do **not** drop columns containing live values (`icon_name`, `filename`, `alt_text_en`, `path`, `notes`, `mfa_enabled`, `total_syncs`, `records_updated`), because existing data remains valid and harmless to older queries. To revert the expanded `articles` status check constraint:

```sql
-- Verify zero rows use 'review', 'approved', or 'rejected' before running:
SELECT COUNT(*) FROM public.articles WHERE status IN ('review', 'approved', 'rejected');

ALTER TABLE public.articles DROP CONSTRAINT IF EXISTS chk_articles_status;
ALTER TABLE public.articles
  ADD CONSTRAINT articles_status_check
  CHECK (status IN ('draft', 'in_review', 'scheduled', 'published', 'archived', 'failed'));

NOTIFY pgrst, 'reload schema';
```

### 3. Verify Post-Rollback Integrity
Re-run `database/audit/schema_inventory.sql` queries #1, #2, and #8 and run `Admin -> System Diagnostics -> Run Complete Database Audit` to verify read/write health.
