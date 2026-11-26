/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Structured Sync Job Execution Logger
 */

import { db } from '../../src/server/db.ts';
import { SyncJobRun } from '../../src/server/automation/types.ts';
import { isSupabaseConfigured } from '../../src/server/supabaseAdmin.ts';
import {
  syncAutomationJobRunToSupabase,
  syncDataProviderToSupabase,
} from '../../src/server/supabaseRepositories.ts';
import { recordServerError } from '../../src/server/errorTracker.ts';

export class SyncLogger {
  public static logRun(run: SyncJobRun): SyncJobRun {
    db.recordSyncRun(run);
    const provider = db.getDataProvider(run.providerId);
    let updatedProvider = provider;
    if (provider) {
      db.updateDataProvider(run.providerId, {
        lastSyncAt: run.timestamp,
        nextSyncAt: new Date(Date.now() + (provider.intervalMinutes || 30) * 60000).toISOString(),
        lastError: run.errorDetails || null,
        totalSyncs: (provider.totalSyncs || 0) + 1,
        successfulSyncs:
          run.status === 'success' ? (provider.successfulSyncs || 0) + 1 : provider.successfulSyncs || 0,
        consecutiveFailures: run.status === 'success' ? 0 : (provider.consecutiveFailures || 0) + 1,
        status:
          run.status === 'failed' && (provider.consecutiveFailures || 0) + 1 >= 5
            ? 'error'
            : provider.status,
      });
      updatedProvider = db.getDataProvider(run.providerId) || provider;
    }

    if (isSupabaseConfigured()) {
      syncAutomationJobRunToSupabase(run).catch(err =>
        recordServerError({ source: 'supabase', code: 'SYNC_RUN_PERSIST_ERR', message: String(err?.message || err) })
      );
      if (updatedProvider) {
        syncDataProviderToSupabase(updatedProvider).catch(err =>
          recordServerError({ source: 'supabase', code: 'SYNC_PROVIDER_PERSIST_ERR', message: String(err?.message || err) })
        );
      }
    }
    return run;
  }

  public static getRecentRuns(limit: number = 50, statusFilter?: 'success' | 'failed' | 'partial') {
    const runs = db.getSyncHistory(limit * 2);
    if (statusFilter) {
      return runs.filter(r => r.status === statusFilter).slice(0, limit);
    }
    return runs.slice(0, limit);
  }
}
