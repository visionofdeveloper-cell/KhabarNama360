/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Automation Data Provider Registry, Custom Feed Adapter & Endpoint Tester
 */

import { db } from '../../src/server/db.ts';
import { encryptSecret, decryptSecret, maskSecret } from '../../src/server/crypto.ts';
import { DataProvider, ProviderCategory, SyncJobRun } from '../../src/server/automation/types.ts';
import { syncCurrencyRates } from '../../src/server/automation/providers/currencyProvider.ts';
import { syncWeatherData } from '../../src/server/automation/providers/weatherProvider.ts';
import { syncGoldRates } from '../../src/server/automation/providers/goldProvider.ts';
import { syncFuelPrices } from '../../src/server/automation/providers/fuelProvider.ts';
import { syncCricketData } from '../../src/server/automation/providers/cricketProvider.ts';
import { DataValidator } from './DataValidator.ts';
import { SyncLogger } from './SyncLogger.ts';
import { processDataChangeWithGemini } from '../../src/server/automation/aiContentEngine.ts';

export class ProviderRegistry {
  public static getAllSanitized(): DataProvider[] {
    return db.getDataProviders().map(p => ({
      ...p,
      encryptedApiKey: undefined,
    }));
  }

  public static upsertProvider(
    input: Partial<DataProvider> & { plainApiKey?: string },
    actor: string = 'Automation Manager'
  ): DataProvider {
    if (!input.name?.trim() || !input.endpoint?.trim()) {
      throw new Error('Provider name and endpoint URL are required.');
    }

    const existing = input.id ? db.getDataProvider(input.id) : undefined;
    const now = new Date().toISOString();
    const id = existing?.id || `prov-${(input.category || 'custom')}-${Date.now()}`;

    let encryptedApiKey = existing?.encryptedApiKey;
    let maskedApiKey = existing?.maskedApiKey;
    let hasApiKey = existing?.hasApiKey ?? false;

    if (input.plainApiKey && input.plainApiKey.trim()) {
      encryptedApiKey = encryptSecret(input.plainApiKey.trim());
      maskedApiKey = maskSecret(input.plainApiKey.trim());
      hasApiKey = true;
    }

    const record: DataProvider = {
      id,
      name: input.name.trim(),
      category: (input.category || existing?.category || 'news') as ProviderCategory,
      endpoint: input.endpoint.trim(),
      method: input.method || existing?.method || 'GET',
      status: input.status || existing?.status || 'active',
      intervalMinutes: Number(input.intervalMinutes ?? existing?.intervalMinutes ?? 30),
      lastSyncAt: existing?.lastSyncAt || null,
      nextSyncAt: existing?.nextSyncAt || new Date(Date.now() + 30 * 60000).toISOString(),
      lastError: existing?.lastError || null,
      isLicensed: input.isLicensed ?? existing?.isLicensed ?? true,
      licenseType: input.licenseType || existing?.licenseType || 'public_open',
      commercialRights: input.commercialRights ?? existing?.commercialRights ?? true,
      attributionRequired: input.attributionRequired ?? existing?.attributionRequired ?? true,
      attribution: input.attribution || existing?.attribution || input.name.trim(),
      requiresApiKey: input.requiresApiKey ?? existing?.requiresApiKey ?? false,
      hasApiKey,
      encryptedApiKey,
      maskedApiKey,
      authHeaderName: input.authHeaderName || existing?.authHeaderName || 'Authorization',
      dailyQuotaLimit: Number(input.dailyQuotaLimit ?? existing?.dailyQuotaLimit ?? 1000),
      dailyCallsUsed: existing?.dailyCallsUsed ?? 0,
      consecutiveFailures: existing?.consecutiveFailures ?? 0,
      totalSyncs: existing?.totalSyncs ?? 0,
      successfulSyncs: existing?.successfulSyncs ?? 0,
      notes: input.notes ?? existing?.notes,
    };

    const saved = db.upsertDataProvider(record, actor);
    return { ...saved, encryptedApiKey: undefined };
  }

  public static deleteProvider(id: string, actor: string = 'Automation Manager'): boolean {
    return db.deleteDataProvider(id, actor);
  }

  public static async testEndpoint(providerId: string): Promise<{
    ok: boolean;
    httpStatus: number;
    latencyMs: number;
    message: string;
    validationPassed: boolean;
  }> {
    const provider = db.getDataProvider(providerId);
    if (!provider) {
      throw new Error('Provider not found.');
    }

    const start = Date.now();
    const headers: Record<string, string> = {
      Accept: 'application/json, application/xml, text/xml, */*',
      'User-Agent': '360Khabarnama-SyncBot/2.0',
    };
    if (provider.requiresApiKey && provider.encryptedApiKey) {
      const secret = decryptSecret(provider.encryptedApiKey);
      if (secret) {
        const headerName = provider.authHeaderName || 'Authorization';
        headers[headerName] = headerName.toLowerCase() === 'authorization' ? `Bearer ${secret}` : secret;
      }
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(provider.endpoint, {
        method: provider.method || 'GET',
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const latencyMs = Date.now() - start;

      const contentType = res.headers.get('content-type') || '';
      const rawText = await res.text();
      let validationPassed = res.ok && rawText.trim().length > 0;
      let message = `HTTP ${res.status} (${latencyMs}ms)`;

      if (contentType.includes('application/json') || rawText.trim().startsWith('{') || rawText.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(rawText);
          const check = DataValidator.validatePayload(provider.category, parsed);
          validationPassed = res.ok && check.passed;
          if (!check.passed) {
            message = `Validation failed: ${check.errors.join('; ')}`;
          } else {
            message = `Verified JSON payload HTTP ${res.status} (${latencyMs}ms)`;
          }
        } catch {
          validationPassed = false;
          message = `Invalid JSON response (HTTP ${res.status})`;
        }
      }

      return {
        ok: res.ok && validationPassed,
        httpStatus: res.status,
        latencyMs,
        message,
        validationPassed,
      };
    } catch (err: any) {
      return {
        ok: false,
        httpStatus: 0,
        latencyMs: Date.now() - start,
        message: err?.message || 'Network/DNS error reaching endpoint',
        validationPassed: false,
      };
    }
  }

  public static async executeProviderSync(
    providerId: string,
    triggeredBy: 'scheduler' | 'manual' | 'cpanel_cron' = 'manual'
  ): Promise<SyncJobRun> {
    const provider = db.getDataProvider(providerId);
    const providerName = provider?.name || providerId;
    const category = (provider?.category || 'currency') as ProviderCategory;

    if (provider && provider.dailyQuotaLimit && (provider.dailyCallsUsed || 0) >= provider.dailyQuotaLimit) {
      const quotaRun: SyncJobRun = {
        id: `run-${providerId}-${Date.now()}`,
        providerId,
        providerName,
        category,
        timestamp: new Date().toISOString(),
        status: 'failed',
        itemsProcessed: 0,
        changesDetected: false,
        changeSummaryEn: `Daily API quota exceeded (${provider.dailyCallsUsed}/${provider.dailyQuotaLimit})`,
        changeSummaryUr: 'روزانہ کی API حد مکمل ہو چکی ہے۔',
        durationMs: 0,
        validationPassed: false,
        triggeredBy,
        errorDetails: 'Quota exhausted',
      };
      return SyncLogger.logRun(quotaRun);
    }

    const startTime = Date.now();
    let result: any = {
      success: false,
      changesDetected: false,
      changeSummaryEn: '',
      changeSummaryUr: '',
      itemsProcessed: 0,
    };
    let httpStatus = 200;
    let validationPassed = true;

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
        default: {
          if (!provider) {
            throw new Error(`Unknown provider ID: ${providerId}`);
          }
          const headers: Record<string, string> = {
            Accept: 'application/json, application/xml, text/xml, */*',
            'User-Agent': '360Khabarnama-SyncBot/2.0',
          };
          if (provider.requiresApiKey && provider.encryptedApiKey) {
            const secret = decryptSecret(provider.encryptedApiKey);
            if (secret) {
              const hn = provider.authHeaderName || 'Authorization';
              headers[hn] = hn.toLowerCase() === 'authorization' ? `Bearer ${secret}` : secret;
            }
          }
          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 15000);
          const resp = await fetch(provider.endpoint, {
            method: provider.method || 'GET',
            headers,
            signal: controller.signal,
          });
          clearTimeout(t);
          httpStatus = resp.status;
          if (!resp.ok) {
            throw new Error(`Upstream HTTP ${resp.status}`);
          }
          const text = await resp.text();
          let count = 1;
          if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
            const parsed = JSON.parse(text);
            const validation = DataValidator.validatePayload(provider.category, parsed);
            validationPassed = validation.passed;
            if (!validation.passed) {
              throw new Error(validation.errors.join('; '));
            }
            count = Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length || 1;
          }
          result = {
            success: true,
            changesDetected: false,
            itemsProcessed: count,
            changeSummaryEn: `Synced custom feed "${provider.name}" (HTTP ${httpStatus})`,
            changeSummaryUr: `"${provider.name}" فیڈ کامیابی سے سنک ہو گئی۔`,
          };
          break;
        }
      }

      if (provider) {
        db.updateDataProvider(provider.id, {
          dailyCallsUsed: (provider.dailyCallsUsed || 0) + 1,
        });
      }

      if (result.success && result.changesDetected) {
        let snapshotData: Record<string, any> = {};
        if (providerId === 'gold-bullion') snapshotData = { goldRates: result.rates };
        else if (providerId === 'currency-erapi') snapshotData = { currencyRates: result.rates };
        else if (providerId === 'fuel-ogra') snapshotData = { fuelPrices: result.prices };
        else if (providerId === 'weather-openmeteo') snapshotData = { weatherSummary: result.changeSummaryEn };

        if (['gold', 'currency', 'fuel', 'weather', 'cricket'].includes(category)) {
          processDataChangeWithGemini(category as any, result.changeSummaryEn, snapshotData).catch(console.error);
        }
      }
    } catch (err: any) {
      validationPassed = false;
      httpStatus = err?.status || 0;
      result = {
        success: false,
        changesDetected: false,
        itemsProcessed: 0,
        error: err?.message || 'Sync execution error',
        changeSummaryEn: `Failed: ${err?.message || 'Execution error'}`,
        changeSummaryUr: `سنک میں ناکامی: ${err?.message || 'خرابی'}`,
      };
    }

    const runRecord: SyncJobRun = {
      id: `run-${providerId}-${Date.now()}`,
      providerId,
      providerName,
      category,
      timestamp: new Date().toISOString(),
      status: result.success ? 'success' : 'failed',
      itemsProcessed: result.itemsProcessed || 0,
      changesDetected: !!result.changesDetected,
      changeSummaryEn: result.changeSummaryEn || 'Completed',
      changeSummaryUr: result.changeSummaryUr || 'مکمل',
      durationMs: Date.now() - startTime,
      httpStatus,
      validationPassed,
      triggeredBy,
      errorDetails: result.error || null,
    };

    return SyncLogger.logRun(runRecord);
  }
}
