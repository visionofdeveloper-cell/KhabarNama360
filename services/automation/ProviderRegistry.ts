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
import { syncWorldNewsFeed, syncSportsNewsFeed } from '../../src/server/automation/providers/newsFeedProvider.ts';
import { DataValidator } from './DataValidator.ts';
import { SyncLogger } from './SyncLogger.ts';
import { processDataChangeWithGemini } from '../../src/server/automation/aiContentEngine.ts';

function isPrivateOrBlockedHostname(hostname: string): boolean {
  const lower = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!lower) return true;
  if (
    lower === 'localhost' ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower.endsWith('.localhost') ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true;
  }
  // IPv4 literal checks (127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, 0/8)
  const ipv4Match = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [a, b] = [Number(ipv4Match[1]), Number(ipv4Match[2])];
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  // RFC4193 Unique Local IPv6 (fc00::/7) or link-local fe80::/10
  if (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:')) {
    return true;
  }
  return false;
}

export function validateSafeExternalUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL((rawUrl || '').trim());
  } catch {
    throw new Error('Invalid endpoint URL format.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http:// and https:// endpoints are allowed.');
  }
  if (isPrivateOrBlockedHostname(parsed.hostname)) {
    throw new Error('SSRF protection: private, loopback, or internal network hostnames are blocked.');
  }
  return parsed;
}

function sanitizeHeaderMap(raw?: Record<string, string>): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  const blocked = new Set(['host', 'content-length', 'connection', 'transfer-encoding', 'upgrade']);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = String(k || '').trim();
    if (!key || blocked.has(key.toLowerCase())) continue;
    out[key] = String(v ?? '').trim();
  }
  return out;
}

function sanitizeFieldMapping(raw?: Record<string, string>): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = String(k || '').trim();
    const val = String(v ?? '').trim();
    if (key && val) out[key] = val;
  }
  return out;
}

export class ProviderRegistry {
  public static getAllSanitized(): DataProvider[] {
    return db.getDataProviders().map(p => ({
      ...p,
      sourceMode: p.sourceMode || (p.isBuiltIn ? 'code_seed' : 'database'),
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
    validateSafeExternalUrl(input.endpoint.trim());

    const existing = input.id ? db.getDataProvider(input.id) : undefined;
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
      nextSyncAt:
        (input.status || existing?.status || 'active') === 'disabled'
          ? null
          : existing?.nextSyncAt || new Date(Date.now() + 30 * 60000).toISOString(),
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
      isBuiltIn: existing?.isBuiltIn ?? false,
      sourceMode: existing?.isBuiltIn ? 'code_seed' : 'database',
      fieldMapping: input.fieldMapping !== undefined ? sanitizeFieldMapping(input.fieldMapping) : existing?.fieldMapping || {},
      customHeaders: input.customHeaders !== undefined ? sanitizeHeaderMap(input.customHeaders) : existing?.customHeaders || {},
      notes: input.notes ?? existing?.notes,
    };

    const saved = db.upsertDataProvider(record, actor);
    return { ...saved, encryptedApiKey: undefined };
  }

  public static toggleProviderStatus(
    id: string,
    status: 'active' | 'disabled',
    actor: string = 'Automation Manager'
  ): DataProvider | null {
    const existing = db.getDataProvider(id);
    if (!existing) return null;
    db.updateDataProvider(id, {
      status,
      nextSyncAt: status === 'disabled' ? null : new Date(Date.now() + (existing.intervalMinutes || 30) * 60000).toISOString(),
    });
    db.logAudit(actor, 'Data Provider Status Changed', `${existing.name} (${id}) -> ${status}`);
    const updated = db.getDataProvider(id);
    return updated ? { ...updated, encryptedApiKey: undefined } : null;
  }

  public static deleteProvider(id: string, actor: string = 'Automation Manager'): boolean {
    const existing = db.getDataProvider(id);
    if (existing) {
      // Stop any automatic schedule cleanly prior to tombstone + removal
      db.updateDataProvider(id, { status: 'disabled', nextSyncAt: null });
    }
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
    validateSafeExternalUrl(provider.endpoint);

    const start = Date.now();
    const headers: Record<string, string> = {
      Accept: 'application/json, application/xml, text/xml, */*',
      'User-Agent': '360Khabarnama-SyncBot/2.0',
      ...sanitizeHeaderMap(provider.customHeaders),
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
        case 'world-news-rss':
          result = await syncWorldNewsFeed();
          break;
        case 'sports-news-rss':
          result = await syncSportsNewsFeed();
          break;
        default: {
          if (!provider) {
            throw new Error(`Unknown provider ID: ${providerId}`);
          }
          validateSafeExternalUrl(provider.endpoint);
          const headers: Record<string, string> = {
            Accept: 'application/json, application/xml, text/xml, */*',
            'User-Agent': '360Khabarnama-SyncBot/2.0',
            ...sanitizeHeaderMap(provider.customHeaders),
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
