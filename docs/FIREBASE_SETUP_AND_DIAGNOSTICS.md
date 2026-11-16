# 360Khabarnama — Firebase Cloud Firestore & Production Diagnostics Guide

This guide documents **360Khabarnama** (`https://www.360khabarnama.com`) persistence on **Google Cloud Firestore**, Firebase Authentication, Gemini AI provider verification, and the Private Admin Diagnostics console.

## 1. Active Firebase Resources (Reused Existing Project)
- **Project ID:** `gen-lang-client-0094029776`
- **Firestore Database ID:** `ai-studio-360khabarnama-91785bb5-94ed-4005-bd25-9b4d9b8b10ba`
- **Configuration File:** `firebase-applet-config.json`
- **Security Rules:** `firestore.rules` (enforces admin-only article writes, public reads restricted to `status == 'published'`, and server timestamp integrity)

## 2. Server-Side Firestore Access & Authentication
1. **Verified Admin Google Sign-In Token Forwarding:** When an authorized administrator (`visionofdeveloper@gmail.com` or seeded `/admins/{uid}` / admin role) signs in via Firebase Authentication in `/admin`, all admin API requests include `Authorization: Bearer <firebaseIdToken>`. The Express backend verifies the ID token cryptographically via Node `crypto` RS256 JWKS verification and forwards the verified token to Firestore `documents:commit` with `REQUEST_TIME` server timestamp transforms so writes pass `firestore.rules` strictly.
2. **Optional Privileged Service Account (Background / Cron Jobs):** Set `FIREBASE_SERVICE_ACCOUNT_JSON` (or `FIREBASE_SERVICE_ACCOUNT_BASE64` / `GOOGLE_APPLICATION_CREDENTIALS`) in server environment variables so scheduled background publishing and cron tasks can commit to Firestore even when no browser admin session is active.

## 3. Environment Variables
- `GEMINI_API_KEY`: Server-side Gemini API key (never exposed to browser code)
- `AI_MASTER_KEY`: 64 hex chars for AES-256-GCM encryption of admin-entered AI credentials
- `ADMIN_SESSION_SECRET`: 64 hex chars for HMAC signing of admin session cookies
- `FIREBASE_SERVICE_ACCOUNT_JSON` *(optional)*: JSON credentials for privileged server-side Firestore commits
- `CRON_SECRET` *(optional)*: Secret token for automated cron webhooks (`/api/cron/run`)

## 4. Admin Diagnostics & Verification Workflow
Open **Admin Console -> Full Enterprise Admin Studio -> System Diagnostics** to run live checks:
- **Firebase Health:** Verifies live Cloud Firestore `:runQuery` read latency, active auth mode, published count, and `/test/connection` probe status.
- **Collections & Rules:** Lists verified collections (`/articles/{articleId}`, `/categories/{categoryId}`, `/siteSettings/{settingId}`, `/admins/{adminId}`, `/test/connection`) and provides **Test Connection Probe** and **Sync Cached Articles to Firestore**.
- **Publishing Pipeline:** Runs a real 5-step end-to-end self-test (`create draft` -> `read-after-write` -> `publish` -> `public slug visibility` -> `cleanup`).
- **Gemini API & Models:** Verifies real model discovery (`GET /v1beta/models`) and minimal live text generation without mock fallbacks.
