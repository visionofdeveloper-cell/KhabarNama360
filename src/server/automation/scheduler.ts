import { db } from '../db.ts';
import { SyncJobRun } from './types.ts';
import { ProviderRegistry } from '../../../services/automation/ProviderRegistry.ts';
import { JobScheduler } from '../../../services/automation/JobScheduler.ts';

class AutomationScheduler {
  private isRunning: boolean = false;
  private intervalTimer: NodeJS.Timeout | null = null;
  private activeJobs: Set<string> = new Set();

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[Automation] Starting 360Khabarnama Live Data & AI Engine Scheduler...');

    // Lightweight startup sync without blocking boot
    this.runAllSyncs(true).catch(console.error);

    // Master evaluation tick every 5 minutes (aligned with shared hosting cron interval)
    this.intervalTimer = setInterval(() => {
      JobScheduler.runDueJobs('scheduler').catch(console.error);
    }, 5 * 60 * 1000);
  }

  public stop() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.isRunning = false;
  }

  public async runSyncForProvider(providerId: string, manual: boolean = false): Promise<SyncJobRun> {
    if (this.activeJobs.has(providerId)) {
      throw new Error(`Sync job for "${providerId}" is already running.`);
    }
    this.activeJobs.add(providerId);
    try {
      return await ProviderRegistry.executeProviderSync(providerId, manual ? 'manual' : 'scheduler');
    } finally {
      this.activeJobs.delete(providerId);
    }
  }

  public async runAllSyncs(isStartup: boolean = false): Promise<SyncJobRun[]> {
    const providers = db.getDataProviders();
    const runs: SyncJobRun[] = [];
    for (const p of providers) {
      if (p.status === 'disabled') continue;
      try {
        const run = await this.runSyncForProvider(p.id, !isStartup);
        runs.push(run);
      } catch (err) {
        console.warn(`[Automation] Error syncing ${p.id}:`, err);
      }
    }
    return runs;
  }
}

export const scheduler = new AutomationScheduler();
