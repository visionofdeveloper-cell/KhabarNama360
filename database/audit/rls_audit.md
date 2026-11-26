# 360Khabarnama — Row-Level Security (RLS), Role Grants & Storage Audit

**Audit Date:** 2026-11-24  
**Scope:** Migrations `002`, `004`, `007`, `008`, `server.ts`, `src/server/auth.ts`, `src/components/admin/SystemDiagnostics.tsx`.

---

## Findings & Remediations

### 1. CRITICAL — `category_pages` Public Policy Leaked Draft Pages (`004:147-151`)
- **Defect:** Migration `002:118-120` restricted `category_pages_public_read` to `USING (status = 'published' AND enabled = TRUE)`, but Migration `004:147-151` inadvertently replaced it with `USING (TRUE)`, exposing unpublished `draft` and disabled category page configurations to `anon` clients.
- **Fix (`next_verified_repair.sql`):** Restore `USING ((status = 'published' AND enabled = TRUE) OR public.is_active_admin())`.

### 2. MEDIUM — Role Name Mismatch Between `OFFICIAL_ADMIN_ROLES` & RLS Policies (`004` vs `auth.ts`)
- **Defect:** `src/server/auth.ts` defines canonical roles `'Advertising Manager'`, `'SEO Manager'`, and `'Automation Manager'`, whereas `004` checked legacy aliases `'Ad Manager'`, `'Audience Manager'`, and `'SEO Specialist'`. Any Supabase Auth-backed admin with canonical role names could fail RLS policy checks.
- **Fix (`next_verified_repair.sql`):** Update `has_admin_role(...)` policies across `ad_placements`, `ad_campaigns`, `newsletter_subscribers`, `audience_notifications`, `broken_links`, `category_pages`, `seo_pages`, `seo_redirects`, `sync_providers`, and `automation_jobs` to accept both canonical role names and legacy aliases consistently.

### 3. MEDIUM — Unauthenticated Header Spoofing on Cron Routes (`server.ts:4745`)
- **Defect:** `server.ts` allowed bypassing `CRON_SECRET` validation whenever `!req.headers['x-vercel-cron']` was falsy (`!hasValidSecret && req.headers['x-vercel-cron']` vs authenticated admin), or trusted user-supplied `x-vercel-cron` header when `CRON_SECRET` wasn't checked strictly. Any caller sending or omitting headers inappropriately could trigger cron jobs without authorization.
- **Fix (`server.ts`):** Require EITHER a valid `CRON_SECRET` (`x-cron-secret`, `Authorization: Bearer <CRON_SECRET>`, or configured body/query secret when `CRON_SECRET` is set) OR an authenticated admin session with `'automation:manage'` permission (`resolveOptionalAdminSession`). Never trust `x-vercel-cron` alone without `CRON_SECRET` (Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically when `CRON_SECRET` is configured).

### 4. MEDIUM — Overly Broad OAuth Popup `postMessage` Target Origin (`server.ts:332`)
- **Defect:** The Search Console OAuth callback HTML posted `{ type: 'gsc-oauth-complete', ... }` to `window.opener.postMessage(..., '*')`.
- **Fix (`server.ts`):** Restrict `window.opener.postMessage(payload, window.location.origin)`.

---

## Target Least-Privilege Access Matrix

| Table / View / Bucket | `anon` (Public Browser) | `authenticated` (Supabase Auth) | `service_role` (Trusted Express Backend) |
|---|---|---|---|
| `public.articles` | `SELECT` only (`status = 'published' AND deleted_at IS NULL`) | `SELECT` published + active admins all; role-checked writes | Full CRUD |
| `public.categories` | `SELECT` only (`enabled = TRUE`) | Role-checked writes | Full CRUD |
| `public.category_pages` | `SELECT` only (`status = 'published' AND enabled = TRUE`) | Active admin reads + role-checked writes | Full CRUD |
| `public.seo_pages` / `public.seo_redirects` | `SELECT` (`seo_pages` all; `seo_redirects` active only) | Role-checked writes | Full CRUD |
| `public.media_assets` | `SELECT` public metadata | Active admin writes | Full CRUD |
| `public.ad_placements` / `public.ad_campaigns` | `SELECT` enabled / active only | Ad/Super Admin writes | Full CRUD |
| `public.homepage_layouts` / `homepage_custom_blocks` | `SELECT` public / enabled | Managing Editor / Super Admin writes | Full CRUD |
| `public.newsletter_subscribers` | Denied (`REVOKE` read/update/delete; server API inserts) | Audience/Super Admin | Full CRUD |
| `public.push_subscriptions` | Server API / controlled insert; zero `SELECT` | Active admin read/manage | Full CRUD |
| `public.public_submissions` | Server API handles intake; zero `SELECT` | Denied direct browser access (`USING (FALSE)`) | Full CRUD |
| `public.ai_provider_credentials` & `ai_provider_models` | **DENIED** (`REVOKE ALL`, `USING (FALSE)`) | **DENIED** (`REVOKE ALL`, `USING (FALSE)`) | Full CRUD |
| `public.ai_provider_credentials_metadata` (View) | **DENIED** (`security_invoker = true`) | **DENIED** | `SELECT` (no secret column) |
| `public.google_integration_secrets`, `google_integrations_settings`, `google_integration_logs` | **DENIED** (`USING (FALSE)`) | **DENIED** (`USING (FALSE)`) | Full CRUD |
| `public.admin_auth_credentials`, `admin_sessions`, `cron_locks`, `deleted_tombstones` | **DENIED** (`REVOKE ALL`, `USING (FALSE)`) | **DENIED** (`REVOKE ALL`, `USING (FALSE)`) | Full CRUD |
| `public.audit_logs`, `admin_save_diagnostics`, `ai_usage_logs`, `ai_connection_tests`, `publication_logs` | **DENIED** | Super Admin / active admin read-only where scoped | Full CRUD |
| `storage.objects` (`editorial-media`) | Public `SELECT` on `editorial-media` | Active admin upload/update/delete | Full access |
