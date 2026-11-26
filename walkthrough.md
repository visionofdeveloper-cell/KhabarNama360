# 360Khabarnama — A-to-Z Supabase Reconciliation, Persistence Hardening & Audit Walkthrough

## 1. Root Causes Identified & Resolved

1. **PostgREST Schema Cache & Column Mismatches (`PGRST204` / `23502` / `23514`)**:
   - Audited backend repository writers against migrations `001`–`008` in `database/audit/schema_mismatch_report.md`.
   - Reconciled mismatches across 12 tables (`categories`, `category_pages`, `media_assets`, `seo_pages`, `seo_redirects`, `sync_providers`, `automation_jobs`, `admin_users`, `site_settings`, `editorial_drafts`, `articles`, and `ai_provider_credentials`) plus `public_submissions.submission_type` (`copyright` and `advertise` added) in `database/migrations/next_verified_repair.sql` (non-destructive, additive, idempotent, preserves all existing `bigint` IDs and production rows).
   - Updated `src/server/supabaseRepositories.ts` and `src/server/supabaseAdmin.ts` with backward-compatible column fallbacks (`upsertWithFallback` + legacy constraint fallback) so writes remain resilient even during rolling deploys.
2. **Cold-Start Ephemeral `/tmp` & Deleted Seed Resurrection**:
   - Introduced `public.deleted_tombstones` + local `deletedTombstones` tracking across delete and upsert paths in `src/server/db.ts`, `src/server/articleService.ts`, and `src/server/supabaseRepositories.ts`.
   - Added `/api` middleware cold-start & 15-second TTL `hydratePortalStateFromSupabase()` sync in `server.ts`, ensuring serverless instances rehydrate authoritative PostgreSQL state (and filter tombstones) instead of reverting to bundled seed data.
3. **Previously Ephemeral / RAM-Only State Replaced with PostgreSQL Tables**:
   - Reconciled `admin_auth_credentials`, `admin_sessions`, `automation_settings`, `cron_locks`, `category_datasets`, `public_submissions`, and `schema_migrations` in both `next_verified_repair.sql` and backend repositories (`src/server/auth.ts`, `services/automation/JobScheduler.ts`, `services/automation/SyncLogger.ts`, `server.ts`).
   - Replaced silent `.catch(() => {})` persistence suppression on critical mutations with awaited error propagation or structured `recordServerError` telemetry.
4. **In-App Complete Database Audit**:
   - Added read-only, secret-redacted `runCompleteDatabaseAudit()` inspecting 32 Supabase tables, critical columns, `schema_migrations`, storage bucket `editorial-media`, and live anon RLS probes.
   - Exposed `GET/POST /api/v1/admin/system/database-audit` (Super Admin only) and added **"Run Complete Database Audit"** UI controls in **Admin -> System Health** and **System Diagnostics -> Database Audit**.

---

# Security Summary

| Finding / Surface | Previous Risk | Fix Implemented |
|---|---|---|
| `public.category_pages` RLS (`004`) | `USING (TRUE)` allowed `anon` clients to read unpublished `draft` category page configs. | Replaced policy with `USING ((status = 'published' AND enabled = TRUE) OR public.is_active_admin())` in `next_verified_repair.sql`. |
| Unauthenticated Cron Trigger (`/api/automation/cron/run`) | Accepted requests bearing spoofed `x-vercel-cron` header without secret verification (`!req.headers['x-vercel-cron']` bypassed Bearer check). | Removed `x-vercel-cron` bypass in `server.ts`; `/api/automation/cron/run` and `/api/cron/automation` now strictly require valid timing-safe `CRON_SECRET` Bearer auth or an authenticated `automation:manage` admin session. |
| OAuth Callback `postMessage` Origin (`server.ts`) | Google Search Console OAuth popup posted status using wildcard `targetOrigin = '*'`. | Restricted HTML callback `postMessage` target origin to `window.location.origin`. |
| Role Name Drift Across RLS Policies | Legacy policies checked `'SEO Specialist'`, `'Ad Manager'`, `'Audience Manager'` while app auth normalized to `'SEO Manager'`, `'Advertising Manager'`, `'Managing Editor'`. | Unified canonical + alias role arrays across all RLS policies in `next_verified_repair.sql`. |
| Private Server Tables & Views | New auth/session/lock/submission/tombstone tables & AI metadata view needed strict browser isolation. | Revoked `PUBLIC`, `anon`, `authenticated` privileges on `admin_auth_credentials`, `admin_sessions`, `cron_locks`, `deleted_tombstones`, `public_submissions`, `schema_migrations`, and `ai_provider_credentials_metadata`; added explicit `USING (FALSE)` deny policies. |
| Secret Redaction in Audit & AI Responses | Risk of exposing `SUPABASE_SECRET_KEY`, `AIza...`, `enc:v1:...` or OAuth secrets in diagnostic endpoints. | `runCompleteDatabaseAudit()` returns only host/ref metadata (`secretsRedacted: true`), never returns secret values or ciphertexts, and is restricted to `Super Admin`. |

## PoC Verification

1. **Automated Backend & Schema Verification (`npx tsx scripts/verify-database-e2e.ts`)**:
   - Passed **7 / 7** checks verifying:
     - `next_verified_repair.sql` includes all 21 reconciled/new tables, all 22 reconciled columns/constraints, `NOTIFY pgrst, 'reload schema'`, and zero destructive `DROP TABLE` / `TRUNCATE` statements.
     - `ArticleService` full create -> publish -> slug rename -> auto-301 redirect -> delete lifecycle + tombstone anti-resurrection blocking stale cold-start re-hydration.
     - `auth.ts` `scrypt` password hashing, RBAC (`Editor` blocked from `ai:keys`), RFC-6238 TOTP MFA rejection on `000000` and approval on valid TOTP token, and password change.
     - `db.saveCategoryDatasetItem` / `deleteCategoryDatasetItem`, all 6 `public_submissions` types (`news_tip`, `correction`, `copyright`, `advertise`, `feedback`, `contact`), and `acquireCronLock` mutual exclusion.
     - AES-256-GCM encryption + `AIProviderManager.sanitizeCredential` complete stripping of `encryptedSecret`.
     - `GoogleIntegrationsService.getPublicTrackingBootstrap` `/admin` exclusion (`activeOnRequest: false`).
     - `runCompleteDatabaseAudit()` & `checkAllSupabaseModulesHealth()` 32-table read-only inspection with zero secret leakage.
2. **Note on Live Production Supabase Verification**:
   - In the sandbox container (`SUPABASE_URL` / `SUPABASE_SECRET_KEY` unset), `runCompleteDatabaseAudit()` accurately reported `configured: false` and `overallStatus: 'FAIL'` for missing connection env vars without fabricating live database output. Running `database/migrations/next_verified_repair.sql` in production Supabase SQL Editor and clicking **"Run Complete Database Audit"** in **Admin -> System Health** executes the live 32-table and 8-probe anon RLS verification directly against production PostgreSQL.
