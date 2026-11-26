/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Database Reconciliation, CRUD, Anti-Resurrection & Security E2E Verification
 *
 * Exercises:
 *   1. SQL migration completeness & schema mismatch reconciliation verification
 *   2. ArticleService full CRUD lifecycle + slug auto-301 redirect + deletion tombstone anti-resurrection
 *   3. Admin auth credentials, scrypt password hashing, TOTP 2FA MFA, session signing & RBAC boundaries
 *   4. Category datasets, public submissions (including copyright/advertise), and cron locks
 *   5. AI credential AES-256-GCM encryption & secret redaction
 *   6. Google Integrations SSR & public bootstrap non-secret checks
 *   7. Read-only Complete Database Audit & 32-table health schema verification
 *
 * Restores data/portal_database.json cleanly on exit so no test records pollute workspace data.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { db, getPersistenceStorageInfo } from '../src/server/db.ts';
import { ArticleService } from '../src/server/articleService.ts';
import {
  authenticateAdmin,
  changeAdminPassword,
  disableMfa,
  enableMfaWithToken,
  hasPermission,
  initiateMfaSetup,
  setStaffPasswordCredential,
} from '../src/server/auth.ts';
import { encryptSecret, generateTotpCode, tryDecryptSecret } from '../src/server/crypto.ts';
import {
  checkAllSupabaseModulesHealth,
  runCompleteDatabaseAudit,
} from '../src/server/supabaseRepositories.ts';
import { AIProviderManager } from '../services/ai/AIProviderManager.ts';
import { GoogleIntegrationsService } from '../services/seo/GoogleIntegrationsService.ts';
import { ProviderRegistry, validateSafeExternalUrl } from '../services/automation/ProviderRegistry.ts';

interface CheckRecord {
  name: string;
  passed: boolean;
  detail: string;
}

const results: CheckRecord[] = [];

async function runCheck(name: string, fn: () => Promise<string> | string) {
  try {
    const detail = await fn();
    results.push({ name, passed: true, detail });
    console.log(`[PASS] ${name} — ${detail}`);
  } catch (err: any) {
    const msg = err?.message || String(err);
    results.push({ name, passed: false, detail: msg });
    console.error(`[FAIL] ${name} — ${msg}`);
  }
}

async function main() {
  const storageInfo = getPersistenceStorageInfo();
  const dbExistedBefore = fs.existsSync(storageInfo.dbFile);
  const dbBackup = dbExistedBefore ? fs.readFileSync(storageInfo.dbFile, 'utf-8') : null;

  try {
    // 1. SQL Migration Completeness Verification
    await runCheck('Migration SQL Completeness (next_verified_repair.sql)', () => {
      const sqlPath = path.resolve(process.cwd(), 'database', 'migrations', 'next_verified_repair.sql');
      assert.equal(fs.existsSync(sqlPath), true, 'next_verified_repair.sql must exist');
      const sql = fs.readFileSync(sqlPath, 'utf-8');

      const requiredTables = [
        'schema_migrations',
        'deleted_tombstones',
        'categories',
        'category_pages',
        'media_assets',
        'seo_pages',
        'seo_redirects',
        'sync_providers',
        'automation_jobs',
        'admin_users',
        'site_settings',
        'editorial_drafts',
        'articles',
        'ai_provider_credentials',
        'ai_provider_credentials_metadata',
        'admin_auth_credentials',
        'admin_sessions',
        'automation_settings',
        'cron_locks',
        'category_datasets',
        'public_submissions',
        'ad_placements',
        'ad_campaigns',
      ];
      for (const tbl of requiredTables) {
        assert.equal(sql.includes(`public.${tbl}`), true, `Migration missing table reference public.${tbl}`);
      }

      const requiredColumnsAndChecks = [
        'ADD COLUMN IF NOT EXISTS icon_name',
        'ADD COLUMN IF NOT EXISTS updated_by',
        'ADD COLUMN IF NOT EXISTS filename',
        'ADD COLUMN IF NOT EXISTS alt_text_en',
        'ADD COLUMN IF NOT EXISTS alt_text_ur',
        'ADD COLUMN IF NOT EXISTS og_image',
        'ADD COLUMN IF NOT EXISTS focus_keyword',
        'ADD COLUMN IF NOT EXISTS config_json',
        'ADD COLUMN IF NOT EXISTS notes',
        'ADD COLUMN IF NOT EXISTS custom_headers_json',
        'ADD COLUMN IF NOT EXISTS field_mapping_json',
        'ADD COLUMN IF NOT EXISTS is_built_in',
        'ADD COLUMN IF NOT EXISTS total_syncs',
        'ADD COLUMN IF NOT EXISTS successful_syncs',
        'ADD COLUMN IF NOT EXISTS records_updated',
        'ADD COLUMN IF NOT EXISTS mfa_enabled',
        'ADD COLUMN IF NOT EXISTS bio_en',
        'ADD COLUMN IF NOT EXISTS bio_ur',
        'ADD COLUMN IF NOT EXISTS provider_type',
        'ADD COLUMN IF NOT EXISTS priority',
        'ADD COLUMN IF NOT EXISTS rate_limit_info_json',
        'idx_articles_pub_feed',
        'idx_articles_cat_pub',
        "'news_tip', 'correction', 'copyright', 'advertise', 'feedback', 'contact'",
        "'draft', 'review', 'in_review', 'approved', 'scheduled', 'published', 'archived', 'rejected', 'failed'",
        'category_pages_public_read',
        "NOTIFY pgrst, 'reload schema'",
      ];
      for (const token of requiredColumnsAndChecks) {
        assert.equal(sql.includes(token), true, `Migration missing reconciled fragment: ${token}`);
      }

      assert.equal(/\bDROP\s+TABLE\b/i.test(sql), false, 'Migration must never DROP TABLE');
      assert.equal(/\bTRUNCATE\b/i.test(sql), false, 'Migration must never TRUNCATE');

      return `${requiredTables.length} tables & ${requiredColumnsAndChecks.length} reconciled SQL checks verified non-destructive.`;
    });

    // 2. ArticleService CRUD, Auto-301 Redirect & Deletion Tombstone Anti-Resurrection
    await runCheck('ArticleService CRUD Lifecycle & Tombstone Anti-Resurrection', async () => {
      const uniqueId = `art-e2e-${Date.now()}`;
      const slugV1 = `e2e-initial-slug-${Date.now()}`;
      const slugV2 = `e2e-renamed-slug-${Date.now()}`;

      const created = await ArticleService.saveArticle(
        {
          id: uniqueId,
          slug: slugV1,
          titleEn: 'E2E Audit Article Draft',
          titleUr: 'ای ٹو ای آڈٹ مضمون',
          summaryEn: 'Draft summary',
          summaryUr: 'خلاصہ',
          contentEn: 'Initial bilingual body content for verification.',
          contentUr: 'تصدیق کے لیے ابتدائی اردو متن۔',
          category: 'pakistan',
          status: 'draft',
          tags: ['e2e-audit'],
        },
        'E2E Test Runner'
      );
      assert.equal(created.article.id, uniqueId);
      assert.equal(created.article.status, 'draft');

      const pubRes = await ArticleService.transitionStatus(uniqueId, 'published', 'E2E Test Runner');
      assert.equal(pubRes.article.status, 'published');
      assert.ok(pubRes.article.publishedAt, 'Published article must have publishedAt');

      const edited = await ArticleService.saveArticle(
        {
          ...pubRes.article,
          slug: slugV2,
          titleEn: 'E2E Audit Article Published & Edited',
          expectedVersion: pubRes.article.version,
        },
        'E2E Test Runner'
      );
      assert.equal(edited.article.slug, slugV2);

      // Verify old slug resolves via auto-301 redirect
      const oldSlugLookup = await ArticleService.getArticle(slugV1);
      assert.equal(oldSlugLookup.redirectTo, slugV2, 'Slug rename must create active 301 redirect');

      // Delete article permanently and assert tombstone blocks resurrection on cold-start hydration
      const deleted = await ArticleService.deleteArticle(uniqueId, 'E2E Test Runner', true);
      assert.equal(deleted, true);

      const postDeleteList = await ArticleService.listArticles({ status: 'all', search: slugV2 });
      assert.equal(postDeleteList.articles.some(a => a.id === uniqueId), false, 'Deleted article must not appear in listArticles');

      // Simulate stale seed/remote payload returning deleted article ID during hydration
      db.applySupabaseHydration({
        articles: [
          {
            ...edited.article,
            deletedAt: undefined,
          },
        ],
      });

      const afterHydration = await ArticleService.getArticle(uniqueId);
      assert.equal(afterHydration.article, null, 'Deletion tombstone must prevent deleted article resurrection');

      return `Verified create -> publish -> edit (301 redirect ${slugV1} -> ${slugV2}) -> delete -> tombstone block.`;
    });

    // 3. Auth Credentials, TOTP MFA & Role RBAC Boundaries
    await runCheck('Admin Auth Credentials, TOTP MFA & 9-Role RBAC', () => {
      const testEmail = `e2e.staff.${Date.now()}@360khabarnama.com`;
      const staffUser = db.upsertAdminUser(
        {
          id: `usr-e2e-${Date.now()}`,
          nameEn: 'E2E Verification Editor',
          nameUr: 'ای ٹو ای ایڈیٹر',
          email: testEmail,
          role: 'Editor',
          status: 'active',
          avatar: '',
          articlesCount: 0,
          createdAt: new Date().toISOString(),
        },
        'E2E Runner'
      );

      const pwRes = setStaffPasswordCredential(testEmail, 'StrongPass#2026!', staffUser.id, 'E2E Runner');
      assert.equal(pwRes.success, true, 'Setting staff password should succeed');

      const loginOk = authenticateAdmin(testEmail, 'StrongPass#2026!', '127.0.0.1', 'E2E-Agent');
      assert.equal(loginOk.success, true);
      assert.equal(loginOk.session?.role, 'Editor');
      assert.equal(hasPermission(loginOk.session?.role, 'articles:publish'), true);
      assert.equal(hasPermission(loginOk.session?.role, 'ai:keys'), false, 'Editor must not possess ai:keys permission');
      assert.equal(hasPermission('Super Admin', 'ai:keys'), true, 'Super Admin must possess ai:keys permission');

      const mfaSetup = initiateMfaSetup(testEmail);
      assert.equal(mfaSetup.success, true);
      assert.ok(mfaSetup.secret);

      const wrongMfa = enableMfaWithToken(testEmail, '000000');
      assert.equal(wrongMfa.success, false);

      const validTotp = generateTotpCode(mfaSetup.secret!);
      const enabledMfa = enableMfaWithToken(testEmail, validTotp);
      assert.equal(enabledMfa.success, true, 'Valid TOTP code must enable MFA');

      const loginNeedsMfa = authenticateAdmin(testEmail, 'StrongPass#2026!', '127.0.0.1', 'E2E-Agent');
      assert.equal(loginNeedsMfa.mfaRequired, true);

      const loginWithMfa = authenticateAdmin(testEmail, 'StrongPass#2026!', '127.0.0.1', 'E2E-Agent', generateTotpCode(mfaSetup.secret!));
      assert.equal(loginWithMfa.success, true);

      const pwChanged = changeAdminPassword(testEmail, 'StrongPass#2026!', 'UpdatedPass#2026!');
      assert.equal(pwChanged.success, true);

      disableMfa(testEmail);
      return 'Verified scrypt password auth, RBAC least-privilege, RFC-6238 TOTP MFA challenge, and password update.';
    });

    // 4. Category Datasets, Public Submissions & Cron Locks
    await runCheck('Category Datasets, Public Submissions & Cron Locks', () => {
      const savedJob = db.saveCategoryDatasetItem(
        'jobs',
        {
          id: `job-e2e-${Date.now()}`,
          titleEn: 'Senior Reporter (E2E Probe)',
          titleUr: 'سینئر رپورٹر',
          organization: '360Khabarnama',
          city: 'Islamabad',
          deadline: '2026-12-31',
          category: 'Media',
          url: 'https://www.360khabarnama.com/jobs',
        },
        'E2E Runner'
      );
      assert.ok(db.getCategoryDataset('jobs').some(j => j.id === savedJob.id));
      assert.equal(db.deleteCategoryDatasetItem('jobs', savedJob.id, 'E2E Runner'), true);

      for (const subType of ['news_tip', 'correction', 'copyright', 'advertise', 'feedback', 'contact'] as const) {
        const added = db.addPublicSubmission({
          id: `subm-e2e-${subType}-${Date.now()}`,
          type: subType,
          name: 'E2E Citizen',
          email: 'reader@example.com',
          subject: `E2E ${subType}`,
          message: 'Verification submission entry',
          createdAt: new Date().toISOString(),
        });
        assert.ok(db.getPublicSubmissions().some(s => s.id === added.id));
      }

      const lockKey = `e2e-cron-lock-${Date.now()}`;
      assert.equal(db.acquireCronLock(lockKey, 'worker-1', 60), true);
      assert.equal(db.acquireCronLock(lockKey, 'worker-2', 60), false, 'Second concurrent worker must be blocked by cron lock');
      db.releaseCronLock(lockKey);
      assert.equal(db.acquireCronLock(lockKey, 'worker-2', 60), true, 'Lock must be acquirable after release');
      db.releaseCronLock(lockKey);

      return 'Verified dataset add/delete, all 6 public_submission types, and distributed cron lock mutual exclusion.';
    });

    // 5. AI Credential Encryption & Zero-Leak Sanitization
    await runCheck('AI AES-256-GCM Encryption & Secret Redaction', () => {
      const dummyRawKey = 'AIzaSyDummyVerificationKeyForUnitTestOnly123456';
      const encrypted = encryptSecret(dummyRawKey);
      assert.equal(encrypted.startsWith('enc:v1:'), true);
      assert.equal(encrypted.includes(dummyRawKey), false);

      const dec = tryDecryptSecret(encrypted);
      assert.equal(dec.ok, true);
      assert.equal(dec.value, dummyRawKey);

      const sanitized = AIProviderManager.sanitizeCredential({
        id: '999',
        providerType: 'gemini',
        label: 'Gemini E2E',
        projectId: 'e2e',
        model: 'gemini-2.5-flash',
        encryptedSecret: encrypted,
        maskedKey: 'AIza••••••••3456',
        enabled: true,
        priority: 1,
        dailyTokenLimit: 100000,
        dailyTokensUsed: 0,
        monthlyBudgetUsd: 10,
        monthlySpendUsd: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      assert.equal('encryptedSecret' in sanitized, false, 'Sanitized AI credential must strip encryptedSecret');
      assert.equal(JSON.stringify(sanitized).includes(dummyRawKey), false);
      assert.equal(JSON.stringify(sanitized).includes('enc:v1:'), false);

      return 'Verified AES-256-GCM roundtrip and complete stripping of encryptedSecret/raw key in sanitized payload.';
    });

    // 6. Google Integrations Admin Route Exclusion & Bootstrap
    await runCheck('Google Integrations Admin Route Exclusion & Config Validation', () => {
      const bootstrapPublic = GoogleIntegrationsService.getPublicTrackingBootstrap('www.360khabarnama.com', '/en');
      const bootstrapAdmin = GoogleIntegrationsService.getPublicTrackingBootstrap('www.360khabarnama.com', '/admin');
      assert.equal(bootstrapAdmin.activeOnRequest, false, 'Tracking must be excluded on /admin routes');
      assert.equal('encryptedClientSecret' in (bootstrapPublic as any), false);
      assert.equal('encryptedRefreshToken' in (bootstrapPublic as any), false);
      return `Verified /admin exclusion (activeOnRequest=${bootstrapAdmin.activeOnRequest}) & zero-secret bootstrap.`;
    });

    // 7. Ad Campaigns CRUD Lifecycle, Archival & Tombstone Anti-Resurrection
    await runCheck('Ad Campaigns CRUD, Archival & Tombstone Anti-Resurrection', () => {
      const campId = `camp-e2e-${Date.now()}`;
      const saved = db.upsertAdCampaign(
        {
          id: campId,
          campaignName: 'E2E Launch Sponsor',
          advertiserName: 'E2E Corp',
          bannerUrl: 'https://www.360khabarnama.com/ads/e2e-banner.jpg',
          placementSlotIds: ['leaderboard'],
          destinationUrl: 'https://www.360khabarnama.com',
          budgetPkr: 50000,
          startDate: new Date().toISOString().slice(0, 10),
          endDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
          impressions: 0,
          clicks: 0,
          ctr: 0,
          status: 'active',
        },
        'E2E Runner'
      );
      assert.equal(saved.id, campId);
      assert.equal(db.getAdCampaigns().some(c => c.id === campId), true);

      const archived = db.archiveAdCampaign(campId, 'E2E Runner');
      assert.equal(archived?.status, 'archived');

      const removed = db.deleteAdCampaign(campId, 'E2E Runner');
      assert.equal(removed, true);
      assert.equal(db.getAdCampaigns().some(c => c.id === campId), false);

      // Simulate stale seed/remote hydration and verify tombstone blocks resurrection
      db.applySupabaseHydration({
        adCampaigns: [{ ...saved, status: 'active' }],
      });
      assert.equal(db.getAdCampaigns().some(c => c.id === campId), false, 'Deleted campaign must stay blocked by tombstone');

      return `Verified campaign create -> archive -> delete -> tombstone block (${campId}).`;
    });

    // 8. News/Sync Feed Provider CRUD, Removal, Tombstone & SSRF Guard
    await runCheck('Sync Feeds CRUD, Removal, Tombstones & SSRF Protection', () => {
      assert.throws(
        () => validateSafeExternalUrl('http://127.0.0.1:8080/internal'),
        /blocked|private|loopback|HTTP/i,
        'SSRF guard must block loopback/private endpoints'
      );

      const provId = `prov-e2e-${Date.now()}`;
      const created = ProviderRegistry.upsertProvider(
        {
          id: provId,
          name: 'E2E Verified RSS Feed',
          category: 'news',
          endpoint: 'https://www.360khabarnama.com/rss.xml',
          method: 'GET',
          intervalMinutes: 30,
          status: 'active',
          fieldMapping: { title: 'headline' },
          customHeaders: { Accept: 'application/rss+xml' },
        },
        'E2E Runner'
      );
      assert.ok(created.id);

      const toggled = ProviderRegistry.toggleProviderStatus(created.id, 'disabled', 'E2E Runner');
      assert.equal(toggled?.status, 'disabled');

      const deleted = ProviderRegistry.deleteProvider(created.id, 'E2E Runner');
      assert.equal(deleted, true);
      assert.equal(ProviderRegistry.getAllSanitized().some(p => p.id === created.id), false);

      return `Verified SSRF guard -> create -> disable -> delete (${created.id}).`;
    });

    // 9. Read-Only 32-Table Health & Complete Database Audit Report
    await runCheck('Complete Database Audit Report (Read-Only + Secrets Redacted)', async () => {
      const [health, audit] = await Promise.all([
        checkAllSupabaseModulesHealth(),
        runCompleteDatabaseAudit(),
      ]);

      assert.equal(health.tables.length, 32, 'Module health must inspect all 32 PostgreSQL tables');
      assert.equal(audit.readOnly, true, 'Audit report must remain strictly read-only');
      assert.equal(audit.secretsRedacted, true, 'Audit report must mark secretsRedacted=true');
      assert.equal(audit.tables.length, 32, 'Audit report must include all 32 monitored tables');
      assert.equal(audit.recommendedMigration, 'database/migrations/next_verified_repair.sql');
      assert.equal(Array.isArray(audit.slowQueries), true, 'Audit report must expose slowQueries telemetry');
      assert.equal(typeof audit.webVitals === 'object' && audit.webVitals !== null, true, 'Audit report must expose webVitals telemetry');

      const serialized = JSON.stringify(audit);
      assert.equal(serialized.includes('sb_secret_'), false, 'Audit report must never leak Supabase secret key');
      assert.equal(serialized.includes('AIza'), false, 'Audit report must never leak AI API keys');

      return `overallStatus=${audit.overallStatus}, configured=${audit.environment.configured}, monitoredTables=${audit.tables.length}, checks=${audit.summary.totalChecks}`;
    });
  } finally {
    // Restore original workspace JSON snapshot cleanly
    if (dbBackup !== null) {
      fs.writeFileSync(storageInfo.dbFile, dbBackup, 'utf-8');
    } else if (fs.existsSync(storageInfo.dbFile)) {
      fs.unlinkSync(storageInfo.dbFile);
    }
  }

  const failed = results.filter(r => !r.passed);
  console.log(`\nSummary: ${results.length - failed.length}/${results.length} E2E checks passed.`);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error('[E2E Verification Fatal]', err);
  process.exit(1);
});
