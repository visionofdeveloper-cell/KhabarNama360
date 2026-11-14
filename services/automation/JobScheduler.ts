/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Namecheap Shared Hosting & Bounded Job Scheduler
 */

import { db } from '../../src/server/db.ts';
import { SyncJobRun } from '../../src/server/automation/types.ts';
import { ProviderRegistry } from './ProviderRegistry.ts';

export class JobScheduler {
  public static async runDueJobs(
    triggeredBy: 'scheduler' | 'cpanel_cron' = 'cpanel_cron',
    maxBatch?: number
  ): Promise<{ skipped?: string; runs: SyncJobRun[] }> {
    const settings = db.getAutomationSettings();
    if (!settings.autoSyncEnabled && triggeredBy === 'scheduler') {
      return { skipped: 'Auto-sync disabled in Automation Settings', runs: [] };
    }

    const lockOwner = `${triggeredBy}-${process.pid}`;
    const lockAcquired = db.acquireCronLock('global-sync-dispatcher', lockOwner, 240);
    if (!lockAcquired) {
      return { skipped: 'Active lock already held by another sync worker', runs: [] };
    }

    const runs: SyncJobRun[] = [];
    try {
      const providers = db.getDataProviders().filter(p => p.status === 'active');
      const now = Date.now();
      const batchLimit = maxBatch || settings.cronBatchLimit || 4;

      const dueProviders = providers.filter(p => {
        if (!p.lastSyncAt) return true;
        const elapsedMs = now - new Date(p.lastSyncAt).getTime();
        const intervalMs = Math.max(5, p.intervalMinutes || 30) * 60 * 1000;
        return elapsedMs >= intervalMs;
      });

      for (const provider of dueProviders.slice(0, batchLimit)) {
        const run = await ProviderRegistry.executeProviderSync(provider.id, triggeredBy);
        runs.push(run);
      }

      db.updateAutomationSettings({ lastCronRunAt: new Date().toISOString() }, 'Cron Dispatcher');
    } finally {
      db.releaseCronLock('global-sync-dispatcher');
    }

    return { runs };
  }

  public static async retryProviderWithBackoff(
    providerId: string,
    maxRetries: number = 3
  ): Promise<SyncJobRun> {
    let lastRun!: SyncJobRun;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      lastRun = await ProviderRegistry.executeProviderSync(providerId, 'manual');
      if (lastRun.status === 'success') {
        return lastRun;
      }
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 600 * Math.pow(2, attempt - 1)));
      }
    }
    return lastRun;
  }
}
