/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Structured Sync Job Execution Logger
 */

import { db } from '../../src/server/db.ts';
import { SyncJobRun } from '../../src/server/automation/types.ts';

export class SyncLogger {
  public static logRun(run: SyncJobRun): SyncJobRun {
    db.recordSyncRun(run);
    const provider = db.getDataProvider(run.providerId);
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
