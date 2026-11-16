# 360Khabarnama — Namecheap Shared Hosting Deployment Guide (Cloud Firestore + Gemini AI)

**Target Production Domain:** `https://www.360khabarnama.com`  
**Database Engine:** Google Cloud Firestore (NO MySQL required)  
**Firebase Project ID:** `gen-lang-client-0094029776`  
**Firestore Database ID:** `ai-studio-360khabarnama-91785bb5-94ed-4005-bd25-9b4d9b8b10ba`

---

## 1. Build Production Artifacts Locally or in CI
Run from repository root:
```bash
npm ci
npm run build:cpanel
```
This produces:
- `dist/` — Vite production client assets & SSR `index.html` template
- `dist-server/server.mjs` — Bundled Node.js Express + SSR server
- `dist-server/cron-dispatcher.mjs` — Bundled Namecheap cPanel 5-minute cron script

---

## 2. Files to Upload to Namecheap cPanel App Directory (e.g. `/home/<user>/khabarnama`)
Upload:
- `dist/`
- `dist-server/`
- `public/`
- `data/` *(keep existing `data/portal_database.json` backup intact)*
- `firebase-applet-config.json`
- `package.json` & `package-lock.json` *(or `bun.lock`)*
- `deploy/namecheap/app.cjs` *(copy as `app.cjs` in app root, or set startup path to `deploy/namecheap/app.cjs`)*
- `deploy/namecheap/.htaccess` *(merge into your `public_html/.htaccess` if using Apache front proxy)*
- `.env` *(created on server from `deploy/namecheap/.env.production.example` — **never commit secrets to Git**)*

Do **NOT** configure any `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, or `DB_PASSWORD` variables.

---

## 3. Configure Namecheap cPanel -> Setup Node.js App
1. **Node.js Version:** `20.x` or `22.x` (LTS)
2. **Application Mode:** `Production`
3. **Application Root:** `/home/<cpanel_user>/khabarnama`
4. **Application URL:** `www.360khabarnama.com`
5. **Application Startup File:** `app.cjs` *(or `deploy/namecheap/app.cjs`)*
6. Click **Run NPM Install** (`npm install --omit=dev`).
7. Set environment variables in cPanel Node.js App UI (or `.env`):
   - `NODE_ENV=production`
   - `SITE_URL=https://www.360khabarnama.com`
   - `APP_URL=https://www.360khabarnama.com`
   - `FIREBASE_SERVICE_ACCOUNT_JSON` (Service Account JSON for `gen-lang-client-0094029776` with Cloud Datastore / Firebase Admin access)
   - `GEMINI_API_KEY`
   - `AI_MASTER_KEY` (64 hex chars)
   - `ADMIN_SESSION_SECRET` (64 hex chars)
   - `CRON_SECRET`
8. Click **Restart** in cPanel Node.js App.

---

## 4. Firebase Console Production Checklist
1. **Authentication -> Settings -> Authorized domains:** Ensure `www.360khabarnama.com` and `360khabarnama.com` are listed so Google Sign-In works in `/admin`.
2. **Firestore Security Rules:** Deploy `firestore.rules` to project `gen-lang-client-0094029776` (database `ai-studio-360khabarnama-91785bb5-94ed-4005-bd25-9b4d9b8b10ba`) before cutover.

---

## 5. Namecheap cPanel Cron Job (Every 5 Minutes)
In **cPanel -> Cron Jobs**, add:
```text
*/5 * * * * cd /home/<cpanel_user>/khabarnama && /home/<cpanel_user>/nodevenv/khabarnama/20/bin/node dist-server/cron-dispatcher.mjs >> /home/<cpanel_user>/logs/cron.log 2>&1
```
*(Or trigger HTTPS cron webhook cleanly: `curl -sS -X POST https://www.360khabarnama.com/api/cron/run -H "x-cron-secret: $CRON_SECRET"`)*

---

## 6. Post-Deploy Production Verification
Run against live production after upload:
1. `GET https://www.360khabarnama.com/api/health` -> `200 OK`
2. `GET https://www.360khabarnama.com/api/v1/news` -> `storageEngine: "firestore"`, `articles.length > 0`
3. Sign in at `https://www.360khabarnama.com/admin` with `visionofdeveloper@gmail.com` -> open **System Diagnostics** -> run **Test Connection Probe**, **Publishing Pipeline Self-Test**, and **Gemini Validation**.
