# 360Khabarnama — Supabase Schema & Backend Code Mismatch Report

**Audit Date:** 2026-11-24  
**Scope:** Migrations `001`–`008` + `/database/migrations/001`–`002` compared against `src/server/supabaseAdmin.ts`, `src/server/supabaseRepositories.ts`, `src/server/articleService.ts`, `src/server/db.ts`, `src/server/auth.ts`, `server.ts`, `services/*`, and `src/components/admin/SystemDiagnostics.tsx`.

---

## Executive Summary

Cross-layer static and structural inspection uncovered **12 concrete SQL-vs-code schema/constraint mismatches**, **7 persistence gaps (modules previously absent from Supabase or relying solely on JSON/RAM)**, **1 critical deletion-resurrection bug**, and **1 UI response-shape bug**:

- Whenever a column sent by `supabaseRepositories.ts` does not exist in PostgreSQL (`001`/`003`), PostgREST throws **`PGRST204` (`Could not find the '...' column in the schema cache`)** or **`42703` (`column ... does not exist`)**.
- Whenever a `NOT NULL` column declared in `001` is omitted by the repository payload (`category_pages`, `media_assets`, `seo_pages`), PostgreSQL rejects the `UPSERT` with **`23502` (`null value in column "..." violates not-null constraint`)**.
- On serverless cold starts (`Vercel Serverless`), modules without hydration helpers boot from the read-only bundle `data/portal_database.json`, causing saved edits to disappear and deleted seed records to reappear.

---

## Table-by-Table Schema & Payload Mismatch Matrix

| # | Table | Existing SQL Definition | Backend Code (`supabaseRepositories.ts` / `supabaseAdmin.ts` / `types`) | Failure Mode | Repair Action |
|---|-------|-------------------------|--------------------------------------------------------------------------|--------------|---------------|
| 1 | `public.categories` | `001`: `icon TEXT DEFAULT 'Newspaper'`; no `icon_name` column | `supabaseRepositories.ts:264` writes `icon_name: page.iconName`; ignores `icon` | `PGRST204` on category save | Add `icon_name TEXT DEFAULT 'Newspaper'` + backfill from `icon`; write both `icon` and `icon_name` in repository |
| 2 | `public.category_pages` | `001`: `id TEXT PRIMARY KEY`, `name_en TEXT NOT NULL`, `name_ur TEXT NOT NULL`, no `updated_by` | `supabaseRepositories.ts:271-277` sends only `slug, config_json, status, updated_by, updated_at` | `PGRST204` (`updated_by`) + `23502` (`NOT NULL` on `id, name_en, name_ur`) | Add `updated_by TEXT NULL`, set safe defaults on `id/name_en/name_ur`, update repository to include `id, name_en, name_ur, enabled, sort_order, updated_by` |
| 3 | `public.media_assets` | `001`+`003`: `title TEXT NOT NULL`, `alt_en`, `alt_ur`; no `filename`, `alt_text_en`, `alt_text_ur` | `supabaseRepositories.ts:314-335` writes `filename, alt_text_en, alt_text_ur`, omits `title` | `PGRST204` (`filename`, `alt_text_en`, `alt_text_ur`) + `23502` (`title` NOT NULL) | Add `filename`, `alt_text_en`, `alt_text_ur`; set `DEFAULT ''` on `title` + sync `title`, `alt_en`, `alt_ur` in repository |
| 4 | `public.seo_pages` | `001`: `route_path TEXT NOT NULL UNIQUE`, `metadata_json`, `title_en/ur NOT NULL`, `canonical_url NOT NULL`; no `path`, `og_image`, `focus_keyword`, `config_json` | `supabaseRepositories.ts:451-465` writes `path, og_image, focus_keyword, config_json`, omits `route_path` | `PGRST204` (`path`, `og_image`, `focus_keyword`, `config_json`) + `23502` (`route_path` NOT NULL) | Add `path`, `og_image`, `focus_keyword`, `config_json`; make `route_path` nullable/defaulted safely + backfill & write `route_path` + `path` together |
| 5 | `public.seo_redirects` | `001`: `id, source_path, target_path, status_code, hits, active, created_at`; no `notes` or `updated_at` | `supabaseRepositories.ts:469-477` writes `notes` | `PGRST204` (`notes`) on redirect save | Add `notes TEXT DEFAULT ''`, `updated_at TIMESTAMPTZ DEFAULT NOW()` + trigger |
| 6 | `public.sync_providers` | `001`+`003`: lacks `total_syncs`, `successful_syncs` | `supabaseRepositories.ts:721-722` writes `total_syncs`, `successful_syncs` | `PGRST204` when saving/syncing data providers | Add `total_syncs INTEGER NOT NULL DEFAULT 0`, `successful_syncs INTEGER NOT NULL DEFAULT 0` |
| 7 | `public.automation_jobs` | `001`: `trigger_source`, `summary`, `error_message`; no `records_updated` | `supabaseRepositories.ts:733-741` writes `records_updated` | `PGRST204` (`records_updated`) on job telemetry write | Add `records_updated INTEGER NOT NULL DEFAULT 0`; populate `trigger_source` & `summary` |
| 8 | `public.admin_users` | `001`: lacks `mfa_enabled`, `bio_en`, `bio_ur` | `supabaseRepositories.ts:350` writes `mfa_enabled`; `types/index.ts` has `bioEn`/`bioUr`/`avatar` | `PGRST204` (`mfa_enabled`) on user save | Add `mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE`, `bio_en TEXT DEFAULT ''`, `bio_ur TEXT DEFAULT ''` |
| 9 | `public.articles` | `001:66`: `CHECK (status IN ('draft','in_review','scheduled','published','archived','failed'))` | `types/index.ts:75`: `ArticleStatus` includes `'review'` and `'approved'` | `23514` check constraint violation if `'review'` or `'approved'` submitted | Replace `articles_status_check` safely to include `'review'`, `'approved'`, and `'rejected'`; normalize workflow statuses in backend |
| 10 | `public.ai_provider_credentials` | Live DB previously had only `(id bigint, created_at timestamptz)` before `007`; `007` adds full columns + `rate_limit_info_json` | `supabaseAdmin.ts` reads/writes `priority, provider_type, rate_limit_info_json`, all extended columns without mutating `id` or `created_at` | `42703` / `PGRST204` if `007` partially/not applied | Re-include complete non-destructive `ADD COLUMN IF NOT EXISTS` set preserving `bigint` IDs + view `ai_provider_credentials_metadata` + `NOTIFY pgrst, 'reload schema'` |
| 11 | `public.editorial_drafts` | `003`: has `category`, `status` | `supabaseRepositories.ts:744-761` omitted `category`, `status` and had no delete helper | Draft category/status loss & non-persistent deletions | Include `category` and `status` in `syncEditorialDraftToSupabase` + add delete + hydration |
| 12 | `system/storage-health` API vs UI | `supabaseRepositories.ts:950-1031` returns `{ storageBucket, tables }` | `SystemDiagnostics.tsx:608-622` reads `storageHealth.storage` and `storageHealth.modules` | Storage & multi-table audit panel rendered blank | Return BOTH `storage`/`modules` AND `storageBucket`/`tables` from `checkAllSupabaseModulesHealth()` |

---

## Missing Supabase Persistence Tables (Previously JSON / RAM Only)

| Module / Feature | Previous Storage | Production Failure in Serverless | New Supabase Table (`next_verified_repair.sql`) |
|---|---|---|---|
| Deleted records tracking | Implicit filtering of in-memory array (`db.ts`) | Deleted seeded articles, categories, users, campaigns, redirects, providers, media, and blocks reappear on cold start | `public.deleted_tombstones` |
| Admin local passwords, TOTP MFA secrets, lockouts, reset tokens | `portal_database.json` (`adminCredentials`) | Admin password changes, MFA setup/disable, lockouts, and reset tokens lost across cold starts | `public.admin_auth_credentials` (strict `service_role` only) |
| Active & revoked admin sessions | RAM `Map`/`Set` in `auth.ts` | Session listing & explicit session revocation fail across serverless instances | `public.admin_sessions` (strict `service_role` only) |
| Automation global configuration | `portal_database.json` (`automationSettings`) | Auto-publish / interval / rate settings reset on cold start | `public.automation_settings` |
| Distributed cron lock | `/tmp` file (`cronLocks`) | Concurrent Vercel cron invocations race because `/tmp` is per-instance | `public.cron_locks` (strict `service_role` only) |
| Category datasets (Education boards/results, Finance historical rates & notifications, Jobs, Mobiles, Autos, Bonds, Dictionary, Names, Poetry, Recipes, Cricket, Weather) | `portal_database.json` arrays | Admin edits in Category Data / Education / Finance disappear on cold start | `public.category_datasets` |
| Citizen tips, corrections, contact & feedback submissions | RAM `const publicSubmissions = []` (`server.ts:1991`) | Public submissions disappear immediately after lambda recycle | `public.public_submissions` |
| Migration execution ledger | None | No database record confirming which migrations ran | `public.schema_migrations` |

---

## Stage 3 Audit: `001_supabase_core_schema.sql` & `002_supabase_rls_policies.sql` vs Advertising & Feeds Schema

1. **`public.ad_campaigns` and `public.ad_placements` Omission in `001`/`002`:**
   - Both `/database/supabase_migrations/001_supabase_core_schema.sql` and `/database/supabase_migrations/002_supabase_rls_policies.sql` only define core editorial, SEO, AI vault, and sync tables — they **do not** create `public.ad_placements` or `public.ad_campaigns` (those were originally introduced later in `003_complete_admin_modules_schema.sql` and `004_complete_admin_modules_rls.sql`).
   - Additionally, prior `next_verified_repair.sql` created RLS policies on `ad_placements` and `ad_campaigns` without first ensuring `CREATE TABLE IF NOT EXISTS public.ad_placements` and `CREATE TABLE IF NOT EXISTS public.ad_campaigns`, triggering `Could not find the table 'public.ad_campaigns' in the schema cache` whenever a database only had `001`/`002` applied.
   - **Fix Applied:** `database/migrations/next_verified_repair.sql` now idempotently creates `public.ad_placements` and `public.ad_campaigns` (all columns including `spent_pkr`, `updated_by`, `deleted_at`, `chk_ad_campaigns_status`, triggers, and active-slot indexes) **before** applying RLS policies and runs `NOTIFY pgrst, 'reload schema'`.

2. **`public.sync_providers` Extended Columns (`field_mapping_json`, `custom_headers_json`, `is_built_in`):**
   - `001_supabase_core_schema.sql` created `public.sync_providers` with only 10 base columns, while `003` and `ProviderRegistry` require `method`, `daily_quota_limit`, `daily_calls_used`, `requires_api_key`, `has_api_key`, `encrypted_api_key`, `masked_api_key`, `auth_header_name`, `attribution_required`, `commercial_rights`, `is_licensed`, `license_type`, `last_error`, `next_sync_at`, `notes`, `field_mapping_json`, `custom_headers_json`, `is_built_in`, `total_syncs`, and `successful_syncs`.
   - **Fix Applied:** Added idempotent `CREATE TABLE IF NOT EXISTS` + `ADD COLUMN IF NOT EXISTS` statements and composite schedule index in `database/migrations/next_verified_repair.sql`.

3. **`SUPABASE_PUBLISHABLE_KEY` Misleading Diagnostic Text:**
   - `databaseHealth.ts` & `SystemDiagnostics.tsx` previously grouped `SUPABASE_PUBLISHABLE_KEY` into the red error prompt suggesting to apply `001_supabase_core_schema.sql` and `002_supabase_rls_policies.sql` even when server DB tables were intact and the missing item was only an environment variable.
   - **Fix Applied:** Env var guidance (Vercel / Google AI Studio Secrets) is strictly separated from SQL migration remediation (`database/migrations/next_verified_repair.sql`), which is only suggested when actual tables/columns are missing.

