import { db } from '../db.ts';
import { SyncJobRun } from './types.ts';
import { syncCurrencyRates } from './providers/currencyProvider.ts';
import { syncWeatherData } from './providers/weatherProvider.ts';
import { syncGoldRates } from './providers/goldProvider.ts';
import { syncFuelPrices } from './providers/fuelProvider.ts';
import { syncCricketData } from './providers/cricketProvider.ts';
import { processDataChangeWithGemini } from './aiContentEngine.ts';

class AutomationScheduler {
  private isRunning: boolean = false;
  private intervalTimer: NodeJS.Timeout | null = null;
  private activeJobs: Set<string> = new Set();

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[Automation] Starting 360Khabarnama Live Data & AI Engine Background Scheduler...');

    // Perform an initial sync pass on startup
    this.runAllSyncs(true).catch(console.error);

    // Run master tick every 60 seconds to evaluate scheduled intervals
    this.intervalTimer = setInterval(() => {
      this.evaluateScheduledJobs().catch(console.error);
    }, 60000);
  }

  public stop() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.isRunning = false;
    console.log('[Automation] Scheduler stopped.');
  }

  private async evaluateScheduledJobs() {
    const settings = db.getAutomationSettings();
    if (!settings.autoSyncEnabled) return;

    const providers = db.getDataProviders();
    const now = Date.now();

    for (const provider of providers) {
      if (provider.status === 'disabled') continue;

      const lastSync = provider.lastSyncAt ? new Date(provider.lastSyncAt).getTime() : 0;
      const intervalMs = (provider.intervalMinutes || 30) * 60 * 1000;

      if (now - lastSync >= intervalMs) {
        this.runSyncForProvider(provider.id, false).catch(console.error);
      }
    }
  }

  public async runSyncForProvider(providerId: string, manual: boolean = false): Promise<SyncJobRun> {
    if (this.activeJobs.has(providerId)) {
      throw new Error(`Sync job for "${providerId}" is already running.`);
    }

    this.activeJobs.add(providerId);
    const startTime = Date.now();
    const provider = db.getDataProvider(providerId);
    const providerName = provider?.name || providerId;
    const category = provider?.category || 'currency';

    let result: {
      success: boolean;
      changesDetected: boolean;
      changeSummaryEn: string;
      changeSummaryUr: string;
      itemsProcessed: number;
      error?: string;
      rates?: any;
      weather?: any;
      prices?: any;
      matches?: any;
    } = {
      success: false,
      changesDetected: false,
      changeSummaryEn: 'Unknown provider',
      changeSummaryUr: 'نامعلوم پرووائیڈر',
      itemsProcessed: 0,
    };

    try {
      switch (providerId) {
        case 'currency-erapi':
          result = await syncCurrencyRates();
          break;
        case 'weather-openmeteo':
          result = await syncWeatherData();
          break;
        case 'gold-bullion':
          result = await syncGoldRates();
          break;
        case 'fuel-ogra':
          result = await syncFuelPrices();
          break;
        case 'cricket-feed':
          result = await syncCricketData();
          break;
        default:
          throw new Error(`Provider adapter not implemented for: ${providerId}`);
      }

      // If meaningful change occurred, optionally trigger Gemini AI content draft
      if (result.success && result.changesDetected) {
        let snapshotData: Record<string, any> = {};
        if (providerId === 'gold-bullion') snapshotData = { goldRates: result.rates };
        else if (providerId === 'currency-erapi') snapshotData = { currencyRates: result.rates };
        else if (providerId === 'fuel-ogra') snapshotData = { fuelPrices: result.prices };
        else if (providerId === 'weather-openmeteo') snapshotData = { weatherSummary: result.changeSummaryEn };

        processDataChangeWithGemini(category as any, result.changeSummaryEn, snapshotData).catch(console.error);
      }
    } catch (err: any) {
      result.success = false;
      result.error = err.message || 'Execution error';
      result.changeSummaryEn = `Failed: ${err.message}`;
      result.changeSummaryUr = 'مطابقت پذیری میں خرابی۔';
    } finally {
      this.activeJobs.delete(providerId);
    }

    const durationMs = Date.now() - startTime;
    const runRecord: SyncJobRun = {
      id: `run-${providerId}-${Date.now()}`,
      providerId,
      providerName,
      category,
      timestamp: new Date().toISOString(),
      status: result.success ? (result.changesDetected ? 'success' : 'success') : 'failed',
      itemsProcessed: result.itemsProcessed,
      changesDetected: result.changesDetected,
      changeSummaryEn: result.changeSummaryEn,
      changeSummaryUr: result.changeSummaryUr,
      durationMs,
      errorDetails: result.error || null,
    };

    db.recordSyncRun(runRecord);
    return runRecord;
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
