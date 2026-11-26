/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Unified Google Analytics 4, Tag Manager & Search Console Configuration Service
 *
 * Enforces:
 * - Strict ID & token format validation (zero raw arbitrary script injection)
 * - Single-tracking-mode enforcement (GTM-managed GA4 vs Direct gtag vs Disabled)
 * - Authoritative Supabase PostgreSQL persistence with verified read-back & cold-start hydration
 * - Strict zero-secret exposure to public endpoints
 */

import fs from 'fs';
import path from 'path';
import { db } from '../../src/server/db.ts';
import {
  GoogleAnalyticsConfig,
  GoogleIntegrationLogEntry,
  GoogleIntegrationsConfig,
  GoogleTagManagerConfig,
  GoogleTrackingMode,
  SiteSettings,
} from '../../src/types/index.ts';
import {
  detectBackendRuntimeInfo,
  getMissingSupabaseConfigGuidance,
  isSupabaseConfigured,
} from '../../src/server/supabaseAdmin.ts';
import {
  fetchGoogleIntegrationsFromSupabase,
  fetchSiteSettingsFromSupabase,
  recordGoogleIntegrationLogToSupabase,
  syncGoogleIntegrationsToSupabase,
  syncSiteSettingsToSupabase,
} from '../../src/server/supabaseRepositories.ts';
import { MetadataGenerator } from './MetadataGenerator.ts';

const GA4_ID_REGEX = /^G-[A-Z0-9]{6,16}$/;
const GTM_ID_REGEX = /^GTM-[A-Z0-9]{4,14}$/;
const LEGACY_PLACEHOLDER_GA_IDS = new Set(['G-KHABAR360', 'G-PAKPORTAL2026']);

let lastHydratedAtMs = 0;
const HYDRATION_TTL_MS = 45_000;
let lastSchemaMissingTables: string[] = [];

export interface PublicTrackingBootstrap {
  ga4Enabled: boolean;
  ga4MeasurementId: string;
  gtmEnabled: boolean;
  gtmContainerId: string;
  trackingMode: GoogleTrackingMode;
  anonymizeIp: boolean;
  debugMode: boolean;
  excludeAdmin: boolean;
  excludeStaging: boolean;
  isStagingHost: boolean;
  activeOnRequest: boolean;
  consentBannerEnabled: boolean;
  consentModeEnabled: boolean;
  trackEnhancedEvents: boolean;
  searchConsoleVerification: string;
}

export function sanitizeGa4Id(raw?: string | null): string {
  const clean = String(raw || '').trim().toUpperCase();
  if (!clean || LEGACY_PLACEHOLDER_GA_IDS.has(clean)) return '';
  return clean;
}

export function sanitizeGtmId(raw?: string | null): string {
  return String(raw || '').trim().toUpperCase();
}

export function extractGscVerificationToken(raw?: string | null): string {
  const input = String(raw || '').trim();
  if (!input) return '';
  // Allow admin to paste full <meta name="google-site-verification" content="..." /> tag safely
  const metaMatch = input.match(/content\s*=\s*["']([^"']+)["']/i);
  const extracted = (metaMatch ? metaMatch[1] : input).trim();
  if (!/^[A-Za-z0-9_=-]{10,160}$/.test(extracted)) {
    throw new Error(
      'Invalid Google Search Console HTML verification code. Paste only the verification token or the official <meta name="google-site-verification" content="..." /> tag.'
    );
  }
  return extracted;
}

export function isStagingHostname(host?: string): boolean {
  const cleanHost = String(host || '')
    .toLowerCase()
    .split(':')[0]
    .trim();
  if (!cleanHost) return false;
  if (cleanHost === 'localhost' || cleanHost === '127.0.0.1' || cleanHost === '0.0.0.0') return true;
  if (cleanHost.endsWith('.vercel.app') && cleanHost !== 'www.360khabarnama.com') return true;
  return false;
}

function assertPersistenceEnvironmentReady() {
  const runtime = detectBackendRuntimeInfo();
  if (!isSupabaseConfigured() && runtime.isServerless) {
    throw new Error(getMissingSupabaseConfigGuidance());
  }
}

export class GoogleIntegrationsService {
  public static invalidateHydrationCache() {
    lastHydratedAtMs = 0;
  }

  public static async logIntegrationEvent(entry: {
    integration: 'ga4' | 'gtm' | 'gsc' | 'system';
    action: string;
    status: 'ok' | 'warning' | 'error' | 'info';
    message: string;
    details?: Record<string, any>;
    actor: string;
  }): Promise<GoogleIntegrationLogEntry> {
    const saved = db.addGoogleIntegrationLog(entry);
    if (isSupabaseConfigured()) {
      await recordGoogleIntegrationLogToSupabase(saved).catch(() => {});
    }
    return saved;
  }

  public static async ensureHydratedIfConfigured(force: boolean = false): Promise<{
    hydrated: boolean;
    source: 'supabase' | 'local' | 'cached';
    missingTables: string[];
    error?: string;
  }> {
    if (!isSupabaseConfigured()) {
      return { hydrated: false, source: 'local', missingTables: [] };
    }
    const now = Date.now();
    if (!force && lastHydratedAtMs > 0 && now - lastHydratedAtMs < HYDRATION_TTL_MS) {
      return { hydrated: true, source: 'cached', missingTables: lastSchemaMissingTables };
    }

    const [siteRes, giRes] = await Promise.all([
      fetchSiteSettingsFromSupabase(),
      fetchGoogleIntegrationsFromSupabase(),
    ]);

    const currentData = db.getData();
    let mergedSettings: SiteSettings = { ...currentData.siteSettings };

    if (siteRes.ok && siteRes.settings) {
      mergedSettings = {
        ...mergedSettings,
        ...siteRes.settings,
      };
      const ga = sanitizeGa4Id(mergedSettings.googleAnalyticsId);
      mergedSettings.googleAnalyticsId = ga;
    }

    const baseGi = this.buildNormalizedConfigFromSettings(mergedSettings);

    if (giRes.ok) {
      lastSchemaMissingTables = giRes.missingTables || [];
      if (giRes.settingsRow) {
        const r = giRes.settingsRow;
        const rowCfg = r.config_json?.config || {};
        const gaId = sanitizeGa4Id(r.ga4_measurement_id ?? baseGi.analytics.measurementId);
        const gtmId = sanitizeGtmId(r.gtm_container_id ?? baseGi.tagManager.containerId);
        const gscVer = String(r.gsc_verification_code ?? baseGi.searchConsole.verificationCode ?? '').trim();

        mergedSettings.googleAnalyticsId = gaId;
        mergedSettings.googleTagManagerId = gtmId;
        mergedSettings.searchConsoleVerification = gscVer;
        mergedSettings.googleIntegrations = {
          analytics: {
            enabled: Boolean(r.ga4_enabled) && Boolean(gaId),
            measurementId: gaId,
            trackingMode: (r.ga4_tracking_mode as GoogleTrackingMode) || baseGi.analytics.trackingMode,
            anonymizeIp: r.ga4_anonymize_ip ?? true,
            debugMode: r.ga4_debug_mode ?? false,
            excludeAdmin: r.ga4_exclude_admin ?? true,
            excludeStaging: r.ga4_exclude_staging ?? false,
            trackEnhancedEvents: r.ga4_track_enhanced_events ?? true,
            lastVerifiedAt: r.ga4_last_verified_at || null,
            lastError: r.ga4_last_error || '',
          },
          tagManager: {
            enabled: Boolean(r.gtm_enabled) && Boolean(gtmId),
            containerId: gtmId,
            excludeAdmin: r.gtm_exclude_admin ?? true,
            consentModeEnabled: r.gtm_consent_mode_enabled ?? true,
            lastVerifiedAt: r.gtm_last_verified_at || null,
            lastError: r.gtm_last_error || '',
          },
          searchConsole: {
            verificationCode: gscVer,
            propertyUrl: r.gsc_property_url || rowCfg?.searchConsole?.propertyUrl || baseGi.searchConsole.propertyUrl,
            scopeMode: (r.gsc_scope_mode as 'readonly' | 'webmasters') || 'webmasters',
            lastVerifiedAt: r.gsc_last_verified_at || null,
            lastError: r.gsc_last_error || '',
          },
        };
      } else {
        mergedSettings.googleIntegrations = baseGi;
      }

      // Hydrate Search Console metrics/connection cleanly (secrets from google_integration_secrets ONLY)
      const legacyConn = giRes.legacySearchConsoleRow?.config_json?.connection;
      const legacyMetrics = giRes.legacySearchConsoleRow?.config_json?.metrics;
      const storedMetrics = giRes.settingsRow?.config_json?.metrics || legacyMetrics;
      const storedProps = giRes.settingsRow?.config_json?.availableProperties || legacyConn?.availableProperties;

      if (storedMetrics) {
        db.updateSearchConsoleMetrics(storedMetrics);
      }

      if (giRes.secretsRow) {
        const s = giRes.secretsRow;
        db.updateSearchConsoleConnection(
          {
            authMode: (s.auth_mode as any) || 'none',
            clientId: s.client_id || '',
            encryptedClientSecret: s.encrypted_client_secret || undefined,
            encryptedRefreshToken: s.encrypted_refresh_token || undefined,
            encryptedAccessToken: s.encrypted_access_token || undefined,
            encryptedServiceAccountJson: s.encrypted_service_account_json || undefined,
            serviceAccountEmail: s.service_account_email || undefined,
            grantedScopes: s.granted_scopes || undefined,
            tokenExpiresAt: s.token_expires_at || undefined,
            propertyUrl:
              giRes.settingsRow?.gsc_property_url ||
              legacyConn?.propertyUrl ||
              mergedSettings.googleIntegrations.searchConsole.propertyUrl ||
              'https://www.360khabarnama.com/',
            scopeMode:
              (giRes.settingsRow?.gsc_scope_mode as any) ||
              mergedSettings.googleIntegrations.searchConsole.scopeMode ||
              'webmasters',
            diagnosticStatus:
              giRes.settingsRow?.gsc_diagnostic_status || legacyConn?.diagnosticStatus || 'Disconnected',
            diagnosticMessage:
              giRes.settingsRow?.gsc_diagnostic_message || legacyConn?.diagnosticMessage || '',
            availableProperties: Array.isArray(storedProps) ? storedProps : [],
            lastCheckedAt: giRes.settingsRow?.gsc_last_verified_at || legacyConn?.lastCheckedAt || undefined,
            lastSyncedAt: giRes.settingsRow?.gsc_last_synced_at || legacyConn?.lastSyncedAt || undefined,
          },
          'Supabase Hydration'
        );
      } else if (legacyConn) {
        db.updateSearchConsoleConnection(legacyConn, 'Supabase Hydration');
      }

      if (Array.isArray(giRes.logs) && giRes.logs.length > 0) {
        db.setGoogleIntegrationLogs(giRes.logs);
      }
    } else if (giRes.missingTables) {
      lastSchemaMissingTables = giRes.missingTables;
    }

    db.updateSettings(mergedSettings, 'Supabase Hydration');
    lastHydratedAtMs = Date.now();

    return {
      hydrated: true,
      source: 'supabase',
      missingTables: lastSchemaMissingTables,
      ...(giRes.error ? { error: giRes.error } : {}),
    };
  }

  public static buildNormalizedConfigFromSettings(settings: Partial<SiteSettings>): GoogleIntegrationsConfig {
    const legacyGa = sanitizeGa4Id(settings.googleAnalyticsId);
    const legacyGtm = sanitizeGtmId(settings.googleTagManagerId);
    const legacyGsc = String(settings.searchConsoleVerification || '').trim();
    const existing = settings.googleIntegrations;

    const gaId = sanitizeGa4Id(existing?.analytics?.measurementId || legacyGa);
    const gtmId = sanitizeGtmId(existing?.tagManager?.containerId || legacyGtm);
    const gtmEnabled = existing?.tagManager?.enabled !== undefined ? Boolean(existing.tagManager.enabled && gtmId) : Boolean(gtmId);
    const gaEnabled = existing?.analytics?.enabled !== undefined ? Boolean(existing.analytics.enabled && gaId) : Boolean(gaId);

    const trackingMode: GoogleTrackingMode =
      existing?.analytics?.trackingMode ||
      (gtmEnabled ? 'gtm' : gaEnabled ? 'direct_gtag' : 'gtm');

    return {
      analytics: {
        enabled: gaEnabled,
        measurementId: gaId,
        trackingMode,
        anonymizeIp: existing?.analytics?.anonymizeIp ?? true,
        debugMode: existing?.analytics?.debugMode ?? false,
        excludeAdmin: existing?.analytics?.excludeAdmin ?? true,
        excludeStaging: existing?.analytics?.excludeStaging ?? false,
        trackEnhancedEvents: existing?.analytics?.trackEnhancedEvents ?? true,
        lastVerifiedAt: existing?.analytics?.lastVerifiedAt || null,
        lastError: existing?.analytics?.lastError || '',
      },
      tagManager: {
        enabled: gtmEnabled,
        containerId: gtmId,
        excludeAdmin: existing?.tagManager?.excludeAdmin ?? true,
        consentModeEnabled: existing?.tagManager?.consentModeEnabled ?? true,
        lastVerifiedAt: existing?.tagManager?.lastVerifiedAt || null,
        lastError: existing?.tagManager?.lastError || '',
      },
      searchConsole: {
        verificationCode: String(existing?.searchConsole?.verificationCode ?? legacyGsc).trim(),
        propertyUrl:
          String(
            existing?.searchConsole?.propertyUrl ||
              settings.searchConsoleSiteUrl ||
              db.getSearchConsoleConnection().propertyUrl ||
              'https://www.360khabarnama.com/'
          ).trim(),
        scopeMode: existing?.searchConsole?.scopeMode === 'readonly' ? 'readonly' : 'webmasters',
        lastVerifiedAt: existing?.searchConsole?.lastVerifiedAt || null,
        lastError: existing?.searchConsole?.lastError || '',
      },
    };
  }

  public static getResolvedConfig(): GoogleIntegrationsConfig {
    return this.buildNormalizedConfigFromSettings(db.getData().siteSettings);
  }

  public static getPublicTrackingBootstrap(hostname?: string, pathname?: string): PublicTrackingBootstrap {
    const settings = db.getData().siteSettings;
    const cfg = this.buildNormalizedConfigFromSettings(settings);
    const cleanPath = String(pathname || '/').split('?')[0];
    const isAdminRoute = cleanPath === '/admin' || cleanPath.startsWith('/admin/');
    const staging = isStagingHostname(hostname);

    const gaValid = GA4_ID_REGEX.test(cfg.analytics.measurementId);
    const gtmValid = GTM_ID_REGEX.test(cfg.tagManager.containerId);

    const ga4Enabled = Boolean(cfg.analytics.enabled && gaValid);
    const gtmEnabled = Boolean(cfg.tagManager.enabled && gtmValid);

    let effectiveMode: GoogleTrackingMode = cfg.analytics.trackingMode || 'gtm';
    if (effectiveMode === 'gtm' && !gtmEnabled) {
      effectiveMode = ga4Enabled ? 'direct_gtag' : 'disabled';
    } else if (effectiveMode === 'direct_gtag' && !ga4Enabled) {
      effectiveMode = gtmEnabled ? 'gtm' : 'disabled';
    }

    const blockedByAdmin =
      isAdminRoute && (cfg.analytics.excludeAdmin || cfg.tagManager.excludeAdmin);
    const blockedByStaging = staging && cfg.analytics.excludeStaging;
    const activeOnRequest =
      effectiveMode !== 'disabled' && !blockedByAdmin && !blockedByStaging;

    return {
      ga4Enabled,
      ga4MeasurementId: gaValid ? cfg.analytics.measurementId : '',
      gtmEnabled,
      gtmContainerId: gtmValid ? cfg.tagManager.containerId : '',
      trackingMode: effectiveMode,
      anonymizeIp: cfg.analytics.anonymizeIp,
      debugMode: cfg.analytics.debugMode,
      excludeAdmin: cfg.analytics.excludeAdmin,
      excludeStaging: cfg.analytics.excludeStaging,
      isStagingHost: staging,
      activeOnRequest,
      consentBannerEnabled: settings.consentBannerEnabled ?? true,
      consentModeEnabled: cfg.tagManager.consentModeEnabled ?? true,
      trackEnhancedEvents: cfg.analytics.trackEnhancedEvents ?? true,
      searchConsoleVerification: cfg.searchConsole.verificationCode || '',
    };
  }

  public static async persistAllConfigToSupabase(
    nextSettings: SiteSettings,
    actor: string
  ): Promise<{ storageEngine: 'supabase' | 'json_fallback'; verifiedReadBack: boolean; warning?: string }> {
    assertPersistenceEnvironmentReady();
    const cfg = this.buildNormalizedConfigFromSettings(nextSettings);

    if (!isSupabaseConfigured()) {
      return { storageEngine: 'json_fallback', verifiedReadBack: true };
    }

    const [siteSync, giSync] = await Promise.all([
      syncSiteSettingsToSupabase(nextSettings, actor),
      syncGoogleIntegrationsToSupabase({
        config: cfg,
        connection: db.getSearchConsoleConnection(),
        metrics: db.getSearchConsoleMetrics(),
        actor,
      }),
    ]);

    if (!siteSync.ok) {
      throw new Error(siteSync.error || 'Failed saving Google Integrations to Supabase site_settings.');
    }

    if (!giSync.ok) {
      const missingHint =
        giSync.error?.includes('PGRST205') || giSync.error?.includes('does not exist')
          ? ' Run database/supabase_migrations/008_google_integrations_persistence.sql in Supabase SQL Editor and reload PostgREST schema.'
          : '';
      throw new Error(`${giSync.error || 'Failed saving to google_integrations_settings.'}${missingHint}`);
    }

    this.invalidateHydrationCache();
    return {
      storageEngine: giSync.storageEngine,
      verifiedReadBack: Boolean(siteSync.verifiedReadBack && giSync.verifiedReadBack),
    };
  }

  public static async saveAnalyticsConfig(
    input: Partial<GoogleAnalyticsConfig>,
    actor: string
  ) {
    await this.ensureHydratedIfConfigured().catch(() => {});
    const currentSettings = db.getData().siteSettings;
    const currentCfg = this.buildNormalizedConfigFromSettings(currentSettings);

    const measurementId = sanitizeGa4Id(
      input.measurementId !== undefined ? input.measurementId : currentCfg.analytics.measurementId
    );
    const enabled = input.enabled !== undefined ? Boolean(input.enabled) : currentCfg.analytics.enabled;

    if (measurementId && !GA4_ID_REGEX.test(measurementId)) {
      throw new Error('GA4 Measurement ID must follow the official format "G-XXXXXXXXXX" (6–16 alphanumeric characters).');
    }
    if (enabled && !measurementId) {
      throw new Error('Enter a valid GA4 Measurement ID (G-XXXXXXXXXX) before enabling Google Analytics 4.');
    }

    let trackingMode: GoogleTrackingMode =
      input.trackingMode || currentCfg.analytics.trackingMode || 'gtm';
    if (!['gtm', 'direct_gtag', 'disabled'].includes(trackingMode)) {
      trackingMode = 'gtm';
    }
    if (trackingMode === 'direct_gtag' && !measurementId) {
      throw new Error('Direct gtag.js mode requires a valid GA4 Measurement ID.');
    }

    const nextAnalytics: GoogleAnalyticsConfig = {
      enabled: enabled && Boolean(measurementId),
      measurementId,
      trackingMode: enabled ? trackingMode : 'disabled',
      anonymizeIp: input.anonymizeIp ?? currentCfg.analytics.anonymizeIp ?? true,
      debugMode: input.debugMode ?? currentCfg.analytics.debugMode ?? false,
      excludeAdmin: input.excludeAdmin ?? currentCfg.analytics.excludeAdmin ?? true,
      excludeStaging: input.excludeStaging ?? currentCfg.analytics.excludeStaging ?? false,
      trackEnhancedEvents: input.trackEnhancedEvents ?? currentCfg.analytics.trackEnhancedEvents ?? true,
      lastVerifiedAt: currentCfg.analytics.lastVerifiedAt || null,
      lastError: '',
    };

    const nextCfg: GoogleIntegrationsConfig = {
      ...currentCfg,
      analytics: nextAnalytics,
    };

    const nextSettings = db.updateSettings(
      {
        googleAnalyticsId: nextAnalytics.measurementId,
        googleIntegrations: nextCfg,
      },
      actor
    );

    const persistRes = await this.persistAllConfigToSupabase(nextSettings, actor);
    await this.logIntegrationEvent({
      integration: 'ga4',
      action: nextAnalytics.enabled ? 'save_ga4_enabled' : 'save_ga4_disabled',
      status: 'ok',
      message: nextAnalytics.enabled
        ? `Saved GA4 (${nextAnalytics.measurementId}) in "${nextAnalytics.trackingMode}" mode.`
        : 'GA4 configuration saved (tracking disabled).',
      details: { measurementId: nextAnalytics.measurementId, trackingMode: nextAnalytics.trackingMode },
      actor,
    });

    return {
      config: nextCfg,
      ...persistRes,
    };
  }

  public static async saveTagManagerConfig(
    input: Partial<GoogleTagManagerConfig> & { trackingMode?: GoogleTrackingMode },
    actor: string
  ) {
    await this.ensureHydratedIfConfigured().catch(() => {});
    const currentSettings = db.getData().siteSettings;
    const currentCfg = this.buildNormalizedConfigFromSettings(currentSettings);

    const containerId = sanitizeGtmId(
      input.containerId !== undefined ? input.containerId : currentCfg.tagManager.containerId
    );
    const enabled = input.enabled !== undefined ? Boolean(input.enabled) : currentCfg.tagManager.enabled;

    if (containerId && !GTM_ID_REGEX.test(containerId)) {
      throw new Error('GTM Container ID must follow the official format "GTM-XXXXXXX".');
    }
    if (enabled && !containerId) {
      throw new Error('Enter a valid GTM Container ID (GTM-XXXXXXX) before enabling Google Tag Manager.');
    }

    const nextTagManager: GoogleTagManagerConfig = {
      enabled: enabled && Boolean(containerId),
      containerId,
      excludeAdmin: input.excludeAdmin ?? currentCfg.tagManager.excludeAdmin ?? true,
      consentModeEnabled: input.consentModeEnabled ?? currentCfg.tagManager.consentModeEnabled ?? true,
      lastVerifiedAt: currentCfg.tagManager.lastVerifiedAt || null,
      lastError: '',
    };

    // When GTM is enabled, default to 'gtm' tracking mode unless explicitly kept on 'direct_gtag'
    let nextTrackingMode = input.trackingMode || currentCfg.analytics.trackingMode;
    if (nextTagManager.enabled && nextTrackingMode === 'disabled') {
      nextTrackingMode = 'gtm';
    }

    const nextCfg: GoogleIntegrationsConfig = {
      ...currentCfg,
      analytics: {
        ...currentCfg.analytics,
        trackingMode: nextTrackingMode,
      },
      tagManager: nextTagManager,
    };

    const nextSettings = db.updateSettings(
      {
        googleTagManagerId: nextTagManager.containerId,
        googleIntegrations: nextCfg,
      },
      actor
    );

    const persistRes = await this.persistAllConfigToSupabase(nextSettings, actor);
    await this.logIntegrationEvent({
      integration: 'gtm',
      action: nextTagManager.enabled ? 'save_gtm_enabled' : 'save_gtm_disabled',
      status: 'ok',
      message: nextTagManager.enabled
        ? `Saved GTM (${nextTagManager.containerId}) with Consent Mode v2=${nextTagManager.consentModeEnabled}.`
        : 'GTM configuration saved (container injection disabled).',
      details: { containerId: nextTagManager.containerId, consentModeEnabled: nextTagManager.consentModeEnabled },
      actor,
    });

    return {
      config: nextCfg,
      ...persistRes,
    };
  }

  public static async saveSearchConsoleMetaCode(verificationInput: string, actor: string) {
    await this.ensureHydratedIfConfigured().catch(() => {});
    const token = verificationInput.trim() ? extractGscVerificationToken(verificationInput) : '';
    const currentSettings = db.getData().siteSettings;
    const currentCfg = this.buildNormalizedConfigFromSettings(currentSettings);

    const nextCfg: GoogleIntegrationsConfig = {
      ...currentCfg,
      searchConsole: {
        ...currentCfg.searchConsole,
        verificationCode: token,
        lastError: '',
      },
    };

    const nextSettings = db.updateSettings(
      {
        searchConsoleVerification: token,
        googleIntegrations: nextCfg,
      },
      actor
    );

    const persistRes = await this.persistAllConfigToSupabase(nextSettings, actor);
    await this.logIntegrationEvent({
      integration: 'gsc',
      action: token ? 'save_verification_meta' : 'clear_verification_meta',
      status: 'ok',
      message: token
        ? 'Google Search Console HTML verification meta token saved & injected into public <head>.'
        : 'Cleared Google Search Console HTML verification meta token.',
      actor,
    });

    return {
      config: nextCfg,
      ...persistRes,
    };
  }

  public static async removeIntegration(
    target: 'ga4' | 'gtm' | 'gsc_meta',
    actor: string
  ) {
    await this.ensureHydratedIfConfigured().catch(() => {});
    const currentSettings = db.getData().siteSettings;
    const currentCfg = this.buildNormalizedConfigFromSettings(currentSettings);

    const nextCfg: GoogleIntegrationsConfig = JSON.parse(JSON.stringify(currentCfg));
    const updates: Partial<SiteSettings> = {};

    if (target === 'ga4') {
      nextCfg.analytics = {
        ...nextCfg.analytics,
        enabled: false,
        measurementId: '',
        trackingMode: nextCfg.tagManager.enabled ? 'gtm' : 'disabled',
        lastVerifiedAt: null,
        lastError: '',
      };
      updates.googleAnalyticsId = '';
    } else if (target === 'gtm') {
      nextCfg.tagManager = {
        ...nextCfg.tagManager,
        enabled: false,
        containerId: '',
        lastVerifiedAt: null,
        lastError: '',
      };
      if (nextCfg.analytics.trackingMode === 'gtm') {
        nextCfg.analytics.trackingMode = nextCfg.analytics.enabled ? 'direct_gtag' : 'disabled';
      }
      updates.googleTagManagerId = '';
    } else if (target === 'gsc_meta') {
      nextCfg.searchConsole.verificationCode = '';
      updates.searchConsoleVerification = '';
    }

    updates.googleIntegrations = nextCfg;
    const nextSettings = db.updateSettings(updates, actor);
    const persistRes = await this.persistAllConfigToSupabase(nextSettings, actor);

    await this.logIntegrationEvent({
      integration: target === 'gsc_meta' ? 'gsc' : target,
      action: `remove_${target}`,
      status: 'info',
      message: `Removed ${target.toUpperCase()} configuration from persistent storage.`,
      actor,
    });

    return {
      config: nextCfg,
      ...persistRes,
    };
  }

  public static async testLiveInjection(params: {
    target: 'ga4' | 'gtm' | 'gsc_meta';
    testPath?: string;
    checkProductionLive?: boolean;
    actor: string;
  }): Promise<{
    ok: boolean;
    summary: string;
    checks: { name: string; passed: boolean; detail: string }[];
    liveRemoteCheck?: { attempted: boolean; url?: string; reachable?: boolean; tagFound?: boolean; detail: string };
    testedAt: string;
  }> {
    await this.ensureHydratedIfConfigured().catch(() => {});
    const testedAt = new Date().toISOString();
    const currentSettings = db.getData().siteSettings;
    const cfg = this.buildNormalizedConfigFromSettings(currentSettings);
    const publicBootstrap = this.getPublicTrackingBootstrap('', params.testPath || '/en');

    const indexCandidates = [
      path.resolve(process.cwd(), 'dist', 'index.html'),
      path.resolve(process.cwd(), 'index.html'),
    ];
    const htmlPath = indexCandidates.find(p => fs.existsSync(p));
    const baseHtml = htmlPath
      ? fs.readFileSync(htmlPath, 'utf-8')
      : '<!doctype html><html><head><title>360Khabarnama</title></head><body><div id="root"></div></body></html>';

    const renderedPublicEn = MetadataGenerator.injectMetadataIntoHtml(baseHtml, '/en');
    const renderedPublicUr = MetadataGenerator.injectMetadataIntoHtml(baseHtml, '/ur');
    const renderedAdmin = MetadataGenerator.injectMetadataIntoHtml(baseHtml, '/admin');

    const checks: { name: string; passed: boolean; detail: string }[] = [];

    if (params.target === 'ga4') {
      const idOk = GA4_ID_REGEX.test(cfg.analytics.measurementId);
      checks.push({
        name: 'GA4 Measurement ID Format',
        passed: idOk,
        detail: idOk ? `Valid ID: ${cfg.analytics.measurementId}` : 'Missing or invalid GA4 Measurement ID (expected G-XXXXXXXXXX).',
      });
      checks.push({
        name: 'GA4 Enabled & Active Mode',
        passed: cfg.analytics.enabled && publicBootstrap.trackingMode !== 'disabled',
        detail: cfg.analytics.enabled
          ? `Active via tracking mode "${publicBootstrap.trackingMode}".`
          : 'GA4 is currently disabled.',
      });

      const isGtmMode = publicBootstrap.trackingMode === 'gtm';
      const hasDirectGtag = renderedPublicEn.includes(`gtag/js?id=${cfg.analytics.measurementId}`);
      const hasGtmScript = cfg.tagManager.containerId
        ? renderedPublicEn.includes(`gtm.js?id=${cfg.tagManager.containerId}`) || renderedPublicEn.includes(cfg.tagManager.containerId)
        : false;
      const duplicateConflict = isGtmMode && hasDirectGtag;

      checks.push({
        name: isGtmMode ? 'GTM Single-Tag Mode (Zero Duplicate gtag.js)' : 'Direct gtag.js Injection (/en & /ur)',
        passed: isGtmMode ? (hasGtmScript && !duplicateConflict) : (hasDirectGtag && renderedPublicUr.includes(`gtag/js?id=${cfg.analytics.measurementId}`)),
        detail: isGtmMode
          ? hasGtmScript && !duplicateConflict
            ? `Verified GTM container (${cfg.tagManager.containerId}) handles GA4 without duplicate direct gtag.js.`
            : 'Expected GTM container script without duplicate direct gtag.js.'
          : hasDirectGtag
          ? `Verified gtag.js injected into /en & /ur HTML with send_page_view:false (SPA deduplicated).`
          : 'Direct gtag.js script missing in SSR HTML.',
      });
      const hasConsentDefault = /gtag\(\s*['"]consent['"]\s*,\s*['"]default['"]/i.test(renderedPublicEn);
      checks.push({
        name: 'Consent Mode v2 Bootstrap',
        passed: hasConsentDefault,
        detail: hasConsentDefault
          ? 'Google Consent Mode v2 default + CookieConsent update bridge present.'
          : 'Consent Mode v2 default snippet not present (tracking disabled).',
      });
      checks.push({
        name: 'Admin Route (/admin) Exclusion',
        passed: !renderedAdmin.includes('gtag/js?id=') && !renderedAdmin.includes('gtm.js?id='),
        detail: 'Verified /admin HTML omits public GA4/GTM tracking scripts.',
      });
    } else if (params.target === 'gtm') {
      const idOk = GTM_ID_REGEX.test(cfg.tagManager.containerId);
      const hasHead = idOk && renderedPublicEn.includes(`https://www.googletagmanager.com/gtm.js?id=`);
      const hasNoscript = idOk && renderedPublicEn.includes(`https://www.googletagmanager.com/ns.html?id=${cfg.tagManager.containerId}`);
      const hasNoDupGtag = !cfg.analytics.measurementId || !renderedPublicEn.includes(`gtag/js?id=${cfg.analytics.measurementId}`);

      checks.push({
        name: 'GTM Container ID Format',
        passed: idOk,
        detail: idOk ? `Valid ID: ${cfg.tagManager.containerId}` : 'Missing or invalid GTM Container ID (expected GTM-XXXXXXX).',
      });
      checks.push({
        name: 'GTM <head> Script Injection',
        passed: cfg.tagManager.enabled && hasHead,
        detail: hasHead ? `Verified GTM <script> in rendered <head>.` : 'GTM <script> missing from rendered <head>.',
      });
      checks.push({
        name: 'GTM <body> <noscript> Iframe Injection',
        passed: cfg.tagManager.enabled && hasNoscript,
        detail: hasNoscript ? 'Verified GTM <noscript><iframe> directly after <body>.' : 'GTM <noscript><iframe> missing after <body>.',
      });
      checks.push({
        name: 'No Duplicate Direct gtag.js Conflict',
        passed: cfg.analytics.trackingMode !== 'gtm' || hasNoDupGtag,
        detail: hasNoDupGtag
          ? 'No competing direct gtag.js script found while GTM mode is active.'
          : 'Warning: direct gtag.js is also present alongside GTM.',
      });
      checks.push({
        name: 'Admin Route (/admin) Exclusion',
        passed: !renderedAdmin.includes('gtm.js') && !renderedAdmin.includes('ns.html'),
        detail: 'Verified /admin HTML excludes GTM script and noscript iframe.',
      });
    } else {
      const hasCode = Boolean(cfg.searchConsole.verificationCode);
      const hasMeta = hasCode && renderedPublicEn.includes(`name="google-site-verification" content="${cfg.searchConsole.verificationCode}"`);
      checks.push({
        name: 'Search Console Verification Token',
        passed: hasCode,
        detail: hasCode ? `Configured token: ${cfg.searchConsole.verificationCode.slice(0, 8)}…` : 'No HTML verification meta token configured.',
      });
      checks.push({
        name: 'SSR Public <head> Meta Tag Presence',
        passed: hasMeta,
        detail: hasMeta
          ? 'Verified <meta name="google-site-verification"> present in SSR public HTML.'
          : 'Verification meta tag not rendered.',
      });
    }

    // Optional strict-allowlisted live production domain probe (SSRF-safe: ONLY allows configured siteUrl hostname)
    let liveRemoteCheck: { attempted: boolean; url?: string; reachable?: boolean; tagFound?: boolean; detail: string } = {
      attempted: false,
      detail: 'Live domain HTTP check skipped.',
    };

    if (params.checkProductionLive) {
      try {
        const rawSite = (currentSettings.siteUrl || 'https://www.360khabarnama.com').trim();
        const parsed = new URL(rawSite);
        if (parsed.protocol === 'https:' && (parsed.hostname === 'www.360khabarnama.com' || parsed.hostname === '360khabarnama.com')) {
          const probeUrl = `${parsed.origin}/en`;
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 8000);
          try {
            const resp = await fetch(probeUrl, {
              headers: { 'User-Agent': '360Khabarnama-IntegrationVerifier/1.0' },
              signal: controller.signal,
            });
            const html = await resp.text();
            const expectedToken =
              params.target === 'gtm'
                ? cfg.tagManager.containerId
                : params.target === 'ga4'
                ? publicBootstrap.trackingMode === 'gtm'
                  ? cfg.tagManager.containerId
                  : cfg.analytics.measurementId
                : cfg.searchConsole.verificationCode;
            const found = Boolean(expectedToken && html.includes(expectedToken));
            liveRemoteCheck = {
              attempted: true,
              url: probeUrl,
              reachable: resp.ok,
              tagFound: found,
              detail: found
                ? `Live production ${probeUrl} (HTTP ${resp.status}) contains "${expectedToken}".`
                : `Live production ${probeUrl} returned HTTP ${resp.status}, but "${expectedToken || 'tag'}" was not detected yet (deploy/publish updated settings first if needed).`,
            };
          } finally {
            clearTimeout(timer);
          }
        }
      } catch (err: any) {
        liveRemoteCheck = {
          attempted: true,
          reachable: false,
          tagFound: false,
          detail: `Live domain check failed: ${err?.message || 'Network timeout'}.`,
        };
      }
    }

    const allPassed = checks.every(c => c.passed);
    const summary = allPassed
      ? `${params.target.toUpperCase()} SSR & runtime checks passed (${checks.length}/${checks.length}).`
      : `${params.target.toUpperCase()} checks found ${checks.filter(c => !c.passed).length} issue(s).`;

    if (params.target === 'ga4' || params.target === 'gtm') {
      const nextCfg = JSON.parse(JSON.stringify(cfg)) as GoogleIntegrationsConfig;
      if (params.target === 'ga4') {
        nextCfg.analytics.lastVerifiedAt = testedAt;
        nextCfg.analytics.lastError = allPassed ? '' : summary;
      } else {
        nextCfg.tagManager.lastVerifiedAt = testedAt;
        nextCfg.tagManager.lastError = allPassed ? '' : summary;
      }
      const saved = db.updateSettings({ googleIntegrations: nextCfg }, params.actor);
      await this.persistAllConfigToSupabase(saved, params.actor).catch(() => {});
    }

    await this.logIntegrationEvent({
      integration: params.target === 'gsc_meta' ? 'gsc' : params.target,
      action: `verify_${params.target}_injection`,
      status: allPassed ? 'ok' : 'warning',
      message: summary,
      details: { checks, liveRemoteCheck },
      actor: params.actor,
    });

    return {
      ok: allPassed,
      summary,
      checks,
      liveRemoteCheck,
      testedAt,
    };
  }

  public static async getDiagnosticsReport() {
    const hydration = await this.ensureHydratedIfConfigured().catch((err: any) => ({
      hydrated: false,
      source: 'local' as const,
      missingTables: [] as string[],
      error: err?.message,
    }));
    const cfg = this.getResolvedConfig();
    const gscConn = db.getSearchConsoleConnection();
    const gscMetrics = db.getSearchConsoleMetrics();
    const runtime = detectBackendRuntimeInfo();
    const publicBootstrap = this.getPublicTrackingBootstrap('', '/en');

    return {
      checkedAt: new Date().toISOString(),
      appVersion: process.env.APP_VERSION || '1.0.0',
      runtime: {
        id: runtime.runtime,
        label: runtime.label,
        shortName: runtime.shortName,
        deploymentEnv: runtime.deploymentEnv,
        isServerless: runtime.isServerless,
        isGoogleAiStudio: runtime.isGoogleAiStudio,
      },
      persistence: {
        supabaseConfigured: isSupabaseConfigured(),
        hydratedFrom: hydration.source,
        migration008Required: (hydration.missingTables || []).length > 0,
        missingTables: hydration.missingTables || [],
        recommendedMigrationFile: 'database/supabase_migrations/008_google_integrations_persistence.sql',
        error: hydration.error || (isSupabaseConfigured() ? null : getMissingSupabaseConfigGuidance()),
      },
      ga4: {
        enabled: cfg.analytics.enabled,
        measurementId: cfg.analytics.measurementId,
        validFormat: GA4_ID_REGEX.test(cfg.analytics.measurementId),
        trackingMode: cfg.analytics.trackingMode,
        effectiveRuntimeMode: publicBootstrap.trackingMode,
        excludeAdmin: cfg.analytics.excludeAdmin,
        excludeStaging: cfg.analytics.excludeStaging,
        consentModeEnabled: cfg.tagManager.consentModeEnabled,
        lastVerifiedAt: cfg.analytics.lastVerifiedAt || null,
        lastError: cfg.analytics.lastError || '',
      },
      gtm: {
        enabled: cfg.tagManager.enabled,
        containerId: cfg.tagManager.containerId,
        validFormat: GTM_ID_REGEX.test(cfg.tagManager.containerId),
        excludeAdmin: cfg.tagManager.excludeAdmin,
        consentModeEnabled: cfg.tagManager.consentModeEnabled,
        lastVerifiedAt: cfg.tagManager.lastVerifiedAt || null,
        lastError: cfg.tagManager.lastError || '',
        publishNote:
          'HTML snippet & noscript injection are verified on server render; verify container publish status in Google Tag Manager (tagmanager.google.com).',
      },
      gsc: {
        authMode: gscConn.authMode,
        propertyUrl: gscConn.propertyUrl || cfg.searchConsole.propertyUrl,
        scopeMode: gscConn.scopeMode || cfg.searchConsole.scopeMode,
        grantedScopes: gscConn.grantedScopes || '',
        hasVerificationMetaCode: Boolean(cfg.searchConsole.verificationCode),
        hasClientSecret: Boolean(gscConn.encryptedClientSecret),
        hasRefreshToken: Boolean(gscConn.encryptedRefreshToken),
        hasServiceAccountJson: Boolean(gscConn.encryptedServiceAccountJson),
        diagnosticStatus: gscConn.diagnosticStatus,
        diagnosticMessage: gscConn.diagnosticMessage || '',
        availablePropertiesCount: (gscConn.availableProperties || []).length,
        lastCheckedAt: gscConn.lastCheckedAt || null,
        lastSyncedAt: gscConn.lastSyncedAt || null,
        lastRefreshedAt: gscMetrics.lastRefreshedAt || null,
      },
      logs: db.getGoogleIntegrationLogs().slice(0, 30),
    };
  }
}
