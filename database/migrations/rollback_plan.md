# 360Khabarnama — Database Initialization, Repair & Rollback Plan

**Target Migrations:** Staged Initialization (`Stage A–E`) / `database/supabase_migrations/009_ad_campaigns_and_missing_modules_repair.sql` / `database/migrations/next_verified_repair.sql`  
**Core Rule:** NEVER drop or truncate preserved tables (`public.admin_users`, `public.site_settings`, `public.ai_provider_credentials`, `public.articles`) or delete production records.

---

## 1. Pre-Migration Backup (Required Before Running Stage A–E)

1. **Supabase Point-in-Time / Manual Backup:**  
   Open **Supabase Dashboard → Database → Backups** and create an on-demand snapshot/backup before applying schema initialization.
2. **Export Existing Preserved Tables (`admin_users`, `site_settings`, `ai_provider_credentials`):**
   - Run `database/audit/schema_inventory.sql` and save the JSON/CSV outputs of existing rows:
     ```sql
     SELECT * FROM public.admin_users;
     SELECT * FROM public.site_settings;
     SELECT id, provider_type, label, project_id, model, masked_key, enabled, priority, created_at
     FROM public.ai_provider_credentials;
     ```
3. **Preserve Existing `storage.buckets` (`editorial-media`):**  
   All migrations use `ON CONFLICT (id) DO NOTHING` (or keep `public = TRUE`) so existing files in Supabase Storage remain intact.

---

## 2. Safe Non-Destructive Rollback Steps (Only If Needed)

### A. Roll Back Newly Created Auxiliary Tables (Zero Impact on Preserved Tables)
```sql
-- Run ONLY if rolling back to a pre-repair codebase without touching admin_users,
-- site_settings, ai_provider_credentials, or articles:
DROP TABLE IF EXISTS public.ad_campaigns;
DROP TABLE IF EXISTS public.ad_placements;
DROP TABLE IF EXISTS public.public_submissions;
DROP TABLE IF EXISTS public.category_datasets;
DROP TABLE IF EXISTS public.cron_locks;
DROP TABLE IF EXISTS public.automation_settings;
DROP TABLE IF EXISTS public.admin_sessions;
DROP TABLE IF EXISTS public.admin_auth_credentials;
DROP TABLE IF EXISTS public.deleted_tombstones;
DROP TABLE IF EXISTS public.admin_save_diagnostics;
DELETE FROM public.schema_migrations
WHERE version IN ('009_next_verified_repair', '009_ad_campaigns_and_missing_modules_repair');
NOTIFY pgrst, 'reload schema';
```

### B. Roll Back Authorization Helper Functions Safely (Never Disable RLS Globally)
If an authenticated Supabase Auth admin user cannot write directly via browser JWT because their `admin_users.auth_uid` is still `NULL`, do **not** weaken RLS with email matching and do **not** disable RLS. Instead, link their verified `auth.users.id` once via SQL Editor:
```sql
UPDATE public.admin_users a
SET auth_uid = u.id
FROM auth.users u
WHERE LOWER(a.email) = LOWER(u.email)
  AND u.email_confirmed_at IS NOT NULL
  AND a.auth_uid IS NULL;
```
(Backend Express/Vercel routes use `SUPABASE_SECRET_KEY` / `service_role`, which operates safely behind Express middleware RBAC independently of browser RLS.)

### C. Post-Rollback Verification
Run the read-only inventory query from `database/audit/schema_inventory.sql` (#1 & #8) and confirm `admin_users`, `site_settings`, and `ai_provider_credentials` row counts match the pre-migration snapshot.
