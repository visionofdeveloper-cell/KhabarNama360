/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Real Google Search Console Integration, Analytics, Sitemaps & URL Inspection
 *
 * Strictly forbids fabricated impressions/clicks/queries when disconnected or failing.
 * Uses encrypted OAuth 2.0 / Service Account credentials via src/server/crypto.ts
 * stored exclusively in backend Supabase vault (google_integration_secrets) + verified persistence.
 */

import crypto from 'crypto';
import { db } from '../../src/server/db.ts';
import { encryptSecret, decryptSecret } from '../../src/server/crypto.ts';
import {
  SearchConsoleConnection,
  SearchConsoleMetrics,
  SearchConsoleStatus,
} from '../../src/types/index.ts';
import { GoogleIntegrationsService } from './GoogleIntegrationsService.ts';

const SCOPE_READONLY = 'https://www.googleapis.com/auth/webmasters.readonly';
const SCOPE_FULL = 'https://www.googleapis.com/auth/webmasters';

function getOAuthStateSecret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.SESSION_SECRET ||
    crypto
      .createHash('sha256')
      .update(`360khabarnama-gsc-state:${process.env.AI_MASTER_KEY || 'kn360-gsc-state-key'}`)
      .digest('hex')
  );
}

export interface SignedGscStatePayload {
  nonce: string;
  actor: string;
  userId: string;
  redirectUri: string;
  scopeMode: 'readonly' | 'webmasters';
  exp: number;
}

export type SearchAnalyticsRange = '7d' | '28d' | '3m' | 'custom';

interface AnalyticsCacheEntry {
  key: string;
  expiresAt: number;
  metrics: SearchConsoleMetrics;
}

const analyticsCache = new Map<string, AnalyticsCacheEntry>();
const ANALYTICS_CACHE_TTL_MS = 10 * 60 * 1000;

function formatDateIso(d: Date): string {
  return d.toISOString().split('T')[0];
}

function resolveDateRange(opts: {
  range?: SearchAnalyticsRange;
  startDate?: string;
  endDate?: string;
}): { range: SearchAnalyticsRange; startDate: string; endDate: string; daysSpan: number } {
  const range: SearchAnalyticsRange = opts.range || '28d';
  const today = new Date();
  // GSC data typically lags ~2 days, querying through today returns up to latest available
  const end = opts.endDate && /^\d{4}-\d{2}-\d{2}$/.test(opts.endDate) ? new Date(`${opts.endDate}T00:00:00Z`) : today;

  if (range === 'custom' && opts.startDate && /^\d{4}-\d{2}-\d{2}$/.test(opts.startDate)) {
    const start = new Date(`${opts.startDate}T00:00:00Z`);
    if (start > end) {
      throw new Error('Custom startDate must be earlier than or equal to endDate.');
    }
    const daysSpan = Math.max(1, Math.min(540, Math.round((end.getTime() - start.getTime()) / 86400000) + 1));
    return {
      range: 'custom',
      startDate: formatDateIso(start),
      endDate: formatDateIso(end),
      daysSpan,
    };
  }

  const days = range === '7d' ? 7 : range === '3m' ? 90 : 28;
  const start = new Date(end.getTime() - (days - 1) * 86400000);
  return {
    range: range === 'custom' ? '28d' : range,
    startDate: formatDateIso(start),
    endDate: formatDateIso(end),
    daysSpan: days,
  };
}

export class SearchConsoleService {
  public static getScopeString(scopeMode: 'readonly' | 'webmasters' = 'webmasters'): string {
    return scopeMode === 'readonly' ? SCOPE_READONLY : SCOPE_FULL;
  }

  public static createSignedOAuthState(payload: Omit<SignedGscStatePayload, 'nonce' | 'exp'>): string {
    const full: SignedGscStatePayload = {
      ...payload,
      nonce: crypto.randomBytes(12).toString('hex'),
      exp: Date.now() + 15 * 60 * 1000,
    };
    const encoded = Buffer.from(JSON.stringify(full), 'utf8').toString('base64url');
    const sig = crypto.createHmac('sha256', getOAuthStateSecret()).update(encoded).digest('base64url');
    return `${encoded}.${sig}`;
  }

  public static verifySignedOAuthState(stateToken: string): SignedGscStatePayload | null {
    const dot = String(stateToken || '').indexOf('.');
    if (dot <= 0) return null;
    const encoded = stateToken.slice(0, dot);
    const sig = stateToken.slice(dot + 1);
    const expected = crypto.createHmac('sha256', getOAuthStateSecret()).update(encoded).digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    try {
      const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SignedGscStatePayload;
      if (!parsed || !parsed.redirectUri || Date.now() > parsed.exp) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  public static getSanitizedConnection() {
    const conn = db.getSearchConsoleConnection();
    return {
      authMode: conn.authMode,
      propertyUrl: conn.propertyUrl || 'https://www.360khabarnama.com/',
      scopeMode: conn.scopeMode || 'webmasters',
      grantedScopes: conn.grantedScopes || '',
      clientId: conn.clientId || '',
      hasClientSecret: Boolean(conn.encryptedClientSecret),
      hasRefreshToken: Boolean(conn.encryptedRefreshToken),
      hasAccessToken: Boolean(conn.encryptedAccessToken),
      hasServiceAccountJson: Boolean(conn.encryptedServiceAccountJson),
      serviceAccountEmail: conn.serviceAccountEmail || '',
      tokenExpiresAt: conn.tokenExpiresAt || null,
      diagnosticStatus: conn.diagnosticStatus,
      diagnosticMessage: conn.diagnosticMessage || '',
      availableProperties: conn.availableProperties || [],
      lastCheckedAt: conn.lastCheckedAt || null,
      lastSyncedAt: conn.lastSyncedAt || null,
    };
  }

  private static async persistGscToSupabase(actor: string) {
    const currentSettings = db.getData().siteSettings;
    const conn = db.getSearchConsoleConnection();
    const cfg = GoogleIntegrationsService.buildNormalizedConfigFromSettings(currentSettings);
    cfg.searchConsole.propertyUrl = conn.propertyUrl || cfg.searchConsole.propertyUrl;
    cfg.searchConsole.scopeMode = conn.scopeMode || cfg.searchConsole.scopeMode;
    cfg.searchConsole.lastVerifiedAt = conn.lastCheckedAt || cfg.searchConsole.lastVerifiedAt;
    cfg.searchConsole.lastError =
      conn.diagnosticStatus === 'Authorized' || conn.diagnosticStatus === 'Disconnected' || conn.diagnosticStatus === 'No Data Yet'
        ? ''
        : conn.diagnosticMessage || '';

    const updatedSettings = db.updateSettings(
      {
        searchConsoleSiteUrl: cfg.searchConsole.propertyUrl,
        googleIntegrations: cfg,
      },
      actor
    );

    return GoogleIntegrationsService.persistAllConfigToSupabase(updatedSettings, actor);
  }

  public static async saveOAuthConfig(
    input: {
      clientId: string;
      clientSecret?: string;
      propertyUrl: string;
      scopeMode?: 'readonly' | 'webmasters';
    },
    actor: string
  ) {
    await GoogleIntegrationsService.ensureHydratedIfConfigured().catch(() => {});
    const existing = db.getSearchConsoleConnection();
    const cleanClientId = String(input.clientId || '').trim();
    if (!cleanClientId) {
      throw new Error('Google OAuth Client ID is required.');
    }
    if (!cleanClientId.includes('.apps.googleusercontent.com') && cleanClientId.length < 12) {
      throw new Error('Invalid Google OAuth Client ID format.');
    }

    const scopeMode: 'readonly' | 'webmasters' =
      input.scopeMode === 'readonly' ? 'readonly' : 'webmasters';
    const propertyUrl = (input.propertyUrl || existing.propertyUrl || 'https://www.360khabarnama.com/').trim();

    const updated = db.updateSearchConsoleConnection(
      {
        authMode: 'oauth2',
        clientId: cleanClientId,
        propertyUrl,
        scopeMode,
        encryptedClientSecret: input.clientSecret?.trim()
          ? encryptSecret(input.clientSecret.trim())
          : existing.encryptedClientSecret,
        diagnosticStatus: existing.encryptedRefreshToken ? existing.diagnosticStatus : 'Disconnected',
        diagnosticMessage: existing.encryptedRefreshToken
          ? 'OAuth configuration saved & encrypted.'
          : 'OAuth Client saved. Click "Connect Google Search Console" to authorize access.',
      },
      actor
    );

    const persistRes = await this.persistGscToSupabase(actor);
    await GoogleIntegrationsService.logIntegrationEvent({
      integration: 'gsc',
      action: 'save_oauth_client',
      status: 'ok',
      message: `Saved Search Console OAuth 2.0 client (${scopeMode} scope) for ${propertyUrl}.`,
      actor,
    });

    return { connection: updated, ...persistRes };
  }

  public static async selectProperty(propertyUrl: string, actor: string) {
    await GoogleIntegrationsService.ensureHydratedIfConfigured().catch(() => {});
    const clean = String(propertyUrl || '').trim();
    if (!clean || (!clean.startsWith('sc-domain:') && !clean.startsWith('https://') && !clean.startsWith('http://'))) {
      throw new Error('Property must be a verified URL-prefix (e.g. https://www.360khabarnama.com/) or Domain property (sc-domain:360khabarnama.com).');
    }
    db.updateSearchConsoleConnection({ propertyUrl: clean }, actor);
    analyticsCache.clear();
    const check = await this.testAndVerifyConnection(actor);
    return { ...check, propertyUrl: clean };
  }

  public static async saveServiceAccountConfig(
    input: {
      serviceAccountJson: string;
      propertyUrl: string;
      scopeMode?: 'readonly' | 'webmasters';
    },
    actor: string
  ) {
    await GoogleIntegrationsService.ensureHydratedIfConfigured().catch(() => {});
    let parsed: any;
    try {
      parsed = JSON.parse(input.serviceAccountJson);
    } catch {
      throw new Error('Invalid JSON content for Service Account key.');
    }
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error('Service Account JSON must contain "client_email" and "private_key".');
    }

    const scopeMode: 'readonly' | 'webmasters' =
      input.scopeMode === 'readonly' ? 'readonly' : 'webmasters';

    const updated = db.updateSearchConsoleConnection(
      {
        authMode: 'service_account',
        serviceAccountEmail: parsed.client_email,
        encryptedServiceAccountJson: encryptSecret(input.serviceAccountJson),
        propertyUrl: (input.propertyUrl || 'https://www.360khabarnama.com/').trim(),
        scopeMode,
        diagnosticStatus: 'Disconnected',
        diagnosticMessage: `Service account ${parsed.client_email} encrypted and stored. Run "Test Connection" to verify property permissions.`,
      },
      actor
    );

    const persistRes = await this.persistGscToSupabase(actor);
    await GoogleIntegrationsService.logIntegrationEvent({
      integration: 'gsc',
      action: 'save_service_account',
      status: 'ok',
      message: `Saved encrypted Service Account (${parsed.client_email}).`,
      actor,
    });

    return { connection: updated, ...persistRes };
  }

  public static async disconnect(actor: string) {
    await GoogleIntegrationsService.ensureHydratedIfConfigured().catch(() => {});
    analyticsCache.clear();

    db.updateSearchConsoleConnection(
      {
        authMode: 'none',
        propertyUrl: 'https://www.360khabarnama.com/',
        scopeMode: 'webmasters',
        grantedScopes: '',
        clientId: '',
        encryptedClientSecret: undefined,
        encryptedRefreshToken: undefined,
        encryptedAccessToken: undefined,
        encryptedServiceAccountJson: undefined,
        serviceAccountEmail: undefined,
        tokenExpiresAt: undefined,
        availableProperties: [],
        diagnosticStatus: 'Disconnected',
        diagnosticMessage: 'Google Search Console disconnected. Tokens and cached metrics cleared.',
        lastCheckedAt: undefined,
        lastSyncedAt: undefined,
      },
      actor
    );

    db.updateSearchConsoleMetrics({
      connected: false,
      diagnosticStatus: 'Disconnected',
      diagnosticMessage: 'Search Console is disconnected.',
      impressions: 0,
      clicks: 0,
      ctr: 0,
      averagePosition: 0,
      dailySeries: [],
      topQueries: [],
      topPages: [],
      devices: [],
      countries: [],
    });

    const persistRes = await this.persistGscToSupabase(actor);
    await GoogleIntegrationsService.logIntegrationEvent({
      integration: 'gsc',
      action: 'disconnect_gsc',
      status: 'info',
      message: 'Disconnected Google Search Console and purged encrypted OAuth tokens.',
      actor,
    });

    return persistRes;
  }

  public static getOAuthAuthorizeUrl(params: {
    redirectUri: string;
    actor: string;
    userId: string;
    scopeMode?: 'readonly' | 'webmasters';
  }): { authUrl: string; state: string; scope: string } {
    const conn = db.getSearchConsoleConnection();
    if (!conn.clientId) {
      throw new Error('Configure OAuth Client ID and Client Secret before connecting Google Search Console.');
    }
    const scopeMode = params.scopeMode || conn.scopeMode || 'webmasters';
    const scope = this.getScopeString(scopeMode);
    const state = this.createSignedOAuthState({
      actor: params.actor,
      userId: params.userId,
      redirectUri: params.redirectUri,
      scopeMode,
    });

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', conn.clientId);
    url.searchParams.set('redirect_uri', params.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', scope);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('state', state);
    return { authUrl: url.toString(), state, scope };
  }

  public static async handleOAuthCallback(code: string, redirectUri: string, actor: string) {
    await GoogleIntegrationsService.ensureHydratedIfConfigured().catch(() => {});
    const conn = db.getSearchConsoleConnection();
    if (!conn.clientId || !conn.encryptedClientSecret) {
      throw new Error('OAuth Client ID and Client Secret must be saved before exchanging authorization code.');
    }
    const clientSecret = decryptSecret(conn.encryptedClientSecret);
    const body = new URLSearchParams({
      code,
      client_id: conn.clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const tokenJson: any = await resp.json();
    if (!resp.ok || !tokenJson.access_token) {
      const errMsg = tokenJson.error_description || tokenJson.error || 'OAuth token exchange failed.';
      db.updateSearchConsoleConnection(
        {
          diagnosticStatus: 'API Error',
          diagnosticMessage: errMsg,
          lastCheckedAt: new Date().toISOString(),
        },
        actor
      );
      await this.persistGscToSupabase(actor).catch(() => {});
      await GoogleIntegrationsService.logIntegrationEvent({
        integration: 'gsc',
        action: 'oauth_token_exchange_failed',
        status: 'error',
        message: errMsg,
        actor,
      });
      throw new Error(errMsg);
    }

    const expiresAt = new Date(Date.now() + (tokenJson.expires_in || 3500) * 1000).toISOString();
    const grantedScopes = String(tokenJson.scope || this.getScopeString(conn.scopeMode || 'webmasters'));
    db.updateSearchConsoleConnection(
      {
        authMode: 'oauth2',
        encryptedAccessToken: encryptSecret(tokenJson.access_token),
        encryptedRefreshToken: tokenJson.refresh_token
          ? encryptSecret(tokenJson.refresh_token)
          : conn.encryptedRefreshToken,
        grantedScopes,
        tokenExpiresAt: expiresAt,
        diagnosticStatus: 'Authorized',
        diagnosticMessage: 'OAuth 2.0 consent granted. Verifying Search Console properties...',
        lastCheckedAt: new Date().toISOString(),
      },
      actor
    );

    const verified = await this.testAndVerifyConnection(actor);
    return verified;
  }

  private static async acquireAccessToken(conn: SearchConsoleConnection): Promise<string> {
    if (conn.authMode === 'none') {
      throw new Error('NO_CREDENTIALS');
    }

    if (conn.authMode === 'service_account') {
      if (!conn.encryptedServiceAccountJson) {
        throw new Error('Service Account JSON missing.');
      }
      const sa = JSON.parse(decryptSecret(conn.encryptedServiceAccountJson));
      const nowSec = Math.floor(Date.now() / 1000);
      const scope = this.getScopeString(conn.scopeMode || 'webmasters');
      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
      const claim = Buffer.from(
        JSON.stringify({
          iss: sa.client_email,
          scope,
          aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
          iat: nowSec,
          exp: nowSec + 3600,
        })
      ).toString('base64url');
      const unsigned = `${header}.${claim}`;
      const signer = crypto.createSign('RSA-SHA256');
      signer.update(unsigned);
      const signature = signer.sign(sa.private_key, 'base64url');
      const assertion = `${unsigned}.${signature}`;

      const resp = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion,
        }).toString(),
      });
      const json: any = await resp.json();
      if (!resp.ok || !json.access_token) {
        throw new Error(`TOKEN_EXPIRED: ${json.error_description || json.error || 'Service account token rejected'}`);
      }
      return json.access_token;
    }

    if (
      conn.encryptedAccessToken &&
      conn.tokenExpiresAt &&
      new Date(conn.tokenExpiresAt).getTime() - Date.now() > 60000
    ) {
      return decryptSecret(conn.encryptedAccessToken);
    }

    if (!conn.encryptedRefreshToken || !conn.clientId || !conn.encryptedClientSecret) {
      throw new Error('TOKEN_EXPIRED: Refresh token or OAuth secret missing. Re-authorize Google Search Console.');
    }

    const refreshToken = decryptSecret(conn.encryptedRefreshToken);
    const clientSecret = decryptSecret(conn.encryptedClientSecret);
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: conn.clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });
    const json: any = await resp.json();
    if (!resp.ok || !json.access_token) {
      throw new Error(`TOKEN_EXPIRED: ${json.error_description || json.error || 'OAuth refresh failed'}`);
    }

    db.updateSearchConsoleConnection(
      {
        encryptedAccessToken: encryptSecret(json.access_token),
        tokenExpiresAt: new Date(Date.now() + (json.expires_in || 3500) * 1000).toISOString(),
      },
      'Search Console Auto-Refresh'
    );
    await this.persistGscToSupabase('Search Console Auto-Refresh').catch(() => {});
    return json.access_token;
  }

  public static async testAndVerifyConnection(actor: string = 'SEO Manager'): Promise<{
    status: SearchConsoleStatus;
    message: string;
    properties: string[];
    verifiedPropertyMatched?: boolean;
  }> {
    await GoogleIntegrationsService.ensureHydratedIfConfigured().catch(() => {});
    const conn = db.getSearchConsoleConnection();
    const nowIso = new Date().toISOString();

    if (conn.authMode === 'none') {
      const msg = 'No Google Search Console OAuth 2.0 or Service Account credentials configured.';
      db.updateSearchConsoleConnection({ diagnosticStatus: 'Disconnected', diagnosticMessage: msg, lastCheckedAt: nowIso }, actor);
      await this.persistGscToSupabase(actor).catch(() => {});
      return { status: 'Disconnected', message: msg, properties: [], verifiedPropertyMatched: false };
    }

    try {
      const token = await this.acquireAccessToken(conn);
      const sitesResp = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (sitesResp.status === 401) {
        const msg = 'Google access token expired or revoked (HTTP 401). Re-authorize Google Search Console.';
        db.updateSearchConsoleConnection({ diagnosticStatus: 'Token Expired', diagnosticMessage: msg, lastCheckedAt: nowIso }, actor);
        await this.persistGscToSupabase(actor).catch(() => {});
        await GoogleIntegrationsService.logIntegrationEvent({ integration: 'gsc', action: 'verify_connection', status: 'error', message: msg, actor });
        return { status: 'Token Expired', message: msg, properties: [], verifiedPropertyMatched: false };
      }

      if (sitesResp.status === 403) {
        const msg = 'Access Denied (HTTP 403). Ensure your Google account or service email has Full/Restricted user permission in Search Console.';
        db.updateSearchConsoleConnection({ diagnosticStatus: 'Access Denied', diagnosticMessage: msg, lastCheckedAt: nowIso }, actor);
        await this.persistGscToSupabase(actor).catch(() => {});
        await GoogleIntegrationsService.logIntegrationEvent({ integration: 'gsc', action: 'verify_connection', status: 'error', message: msg, actor });
        return { status: 'Access Denied', message: msg, properties: [], verifiedPropertyMatched: false };
      }

      if (!sitesResp.ok) {
        const errText = await sitesResp.text();
        const msg = `Search Console API Error (HTTP ${sitesResp.status}): ${errText.slice(0, 180)}`;
        db.updateSearchConsoleConnection({ diagnosticStatus: 'API Error', diagnosticMessage: msg, lastCheckedAt: nowIso }, actor);
        await this.persistGscToSupabase(actor).catch(() => {});
        await GoogleIntegrationsService.logIntegrationEvent({ integration: 'gsc', action: 'verify_connection', status: 'error', message: msg, actor });
        return { status: 'API Error', message: msg, properties: [], verifiedPropertyMatched: false };
      }

      const sitesData: any = await sitesResp.json();
      const siteEntries: any[] = sitesData.siteEntry || [];
      const properties = siteEntries.map(s => s.siteUrl).filter(Boolean);

      if (properties.length === 0) {
        const msg =
          'Authorized Google account, but 0 verified Search Console properties were returned. Add and verify sc-domain:360khabarnama.com or https://www.360khabarnama.com/ via DNS TXT or HTML verification meta tag.';
        db.updateSearchConsoleConnection(
          {
            diagnosticStatus: 'Property Not Found',
            diagnosticMessage: msg,
            availableProperties: [],
            lastCheckedAt: nowIso,
          },
          actor
        );
        await this.persistGscToSupabase(actor).catch(() => {});
        await GoogleIntegrationsService.logIntegrationEvent({ integration: 'gsc', action: 'verify_connection', status: 'warning', message: msg, actor });
        return { status: 'Property Not Found', message: msg, properties: [], verifiedPropertyMatched: false };
      }

      const preferred =
        conn.propertyUrl && properties.some(p => p.toLowerCase() === conn.propertyUrl.toLowerCase())
          ? conn.propertyUrl
          : properties.find(p => p.includes('360khabarnama.com')) || properties[0];

      const matched = !conn.propertyUrl || properties.some(p => p.toLowerCase() === conn.propertyUrl.toLowerCase());

      if (conn.propertyUrl && !matched) {
        const msg = `Property "${conn.propertyUrl}" is not verified for this account. Available verified properties: ${properties.join(', ')}`;
        db.updateSearchConsoleConnection(
          {
            diagnosticStatus: 'Property Not Found',
            diagnosticMessage: msg,
            availableProperties: properties,
            lastCheckedAt: nowIso,
          },
          actor
        );
        await this.persistGscToSupabase(actor).catch(() => {});
        await GoogleIntegrationsService.logIntegrationEvent({ integration: 'gsc', action: 'verify_connection', status: 'warning', message: msg, actor });
        return { status: 'Property Not Found', message: msg, properties, verifiedPropertyMatched: false };
      }

      const msg = `Verified connection to Search Console property ${preferred}.`;
      db.updateSearchConsoleConnection(
        {
          propertyUrl: preferred,
          availableProperties: properties,
          diagnosticStatus: 'Authorized',
          diagnosticMessage: msg,
          lastCheckedAt: nowIso,
        },
        actor
      );
      await this.persistGscToSupabase(actor);
      await GoogleIntegrationsService.logIntegrationEvent({
        integration: 'gsc',
        action: 'verify_connection',
        status: 'ok',
        message: msg,
        details: { properties },
        actor,
      });
      return { status: 'Authorized', message: msg, properties, verifiedPropertyMatched: true };
    } catch (err: any) {
      const text = err?.message || 'Unknown Search Console error';
      const status: SearchConsoleStatus = text.startsWith('TOKEN_EXPIRED') ? 'Token Expired' : 'API Error';
      db.updateSearchConsoleConnection(
        {
          diagnosticStatus: status,
          diagnosticMessage: text,
          lastCheckedAt: nowIso,
        },
        actor
      );
      await this.persistGscToSupabase(actor).catch(() => {});
      await GoogleIntegrationsService.logIntegrationEvent({
        integration: 'gsc',
        action: 'verify_connection',
        status: 'error',
        message: text,
        actor,
      });
      return { status, message: text, properties: [], verifiedPropertyMatched: false };
    }
  }

  public static async syncLiveAnalytics(
    actor: string = 'SEO Manager',
    options: {
      range?: SearchAnalyticsRange;
      startDate?: string;
      endDate?: string;
      comparePrevious?: boolean;
      forceRefresh?: boolean;
    } = {}
  ): Promise<SearchConsoleMetrics> {
    await GoogleIntegrationsService.ensureHydratedIfConfigured().catch(() => {});
    const { range, startDate, endDate, daysSpan } = resolveDateRange(options);
    const comparePrevious = Boolean(options.comparePrevious);

    const connInitial = db.getSearchConsoleConnection();
    const cacheKey = `${connInitial.propertyUrl}|${startDate}|${endDate}|${comparePrevious}`;
    if (!options.forceRefresh) {
      const hit = analyticsCache.get(cacheKey);
      if (hit && Date.now() < hit.expiresAt && connInitial.diagnosticStatus === 'Authorized') {
        return hit.metrics;
      }
    }

    const check = await this.testAndVerifyConnection(actor);
    if (check.status !== 'Authorized') {
      const updated = {
        connected: false,
        diagnosticStatus: check.status,
        diagnosticMessage: check.message,
        propertyUrl: db.getSearchConsoleConnection().propertyUrl || '',
        range,
        startDate,
        endDate,
        comparePrevious,
        impressions: 0,
        clicks: 0,
        ctr: 0,
        averagePosition: 0,
        dailySeries: [],
        topQueries: [],
        topPages: [],
        devices: [],
        countries: [],
      };
      db.updateSearchConsoleMetrics(updated);
      await this.persistGscToSupabase(actor).catch(() => {});
      return db.getSearchConsoleMetrics();
    }

    const conn = db.getSearchConsoleConnection();
    const token = await this.acquireAccessToken(conn);
    const propertyUrl = conn.propertyUrl;
    const apiBase = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(propertyUrl)}/searchAnalytics/query`;

    const queryDimension = async (
      sDate: string,
      eDate: string,
      dimensions: string[],
      rowLimit: number
    ) => {
      const r = await fetch(apiBase, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: sDate,
          endDate: eDate,
          dimensions,
          rowLimit,
        }),
      });
      if (!r.ok) {
        const bodyText = await r.text();
        throw new Error(`Search Analytics query error (HTTP ${r.status}): ${bodyText.slice(0, 180)}`);
      }
      return (await r.json()) as { rows?: any[] };
    };

    try {
      const requests: Promise<{ rows?: any[] }>[] = [
        queryDimension(startDate, endDate, ['date'], 100),
        queryDimension(startDate, endDate, ['query'], 25),
        queryDimension(startDate, endDate, ['page'], 25),
        queryDimension(startDate, endDate, ['device'], 10),
        queryDimension(startDate, endDate, ['country'], 15),
      ];

      let prevStartDate = '';
      let prevEndDate = '';
      if (comparePrevious) {
        const sObj = new Date(`${startDate}T00:00:00Z`);
        const pEnd = new Date(sObj.getTime() - 86400000);
        const pStart = new Date(pEnd.getTime() - (daysSpan - 1) * 86400000);
        prevStartDate = formatDateIso(pStart);
        prevEndDate = formatDateIso(pEnd);
        requests.push(queryDimension(prevStartDate, prevEndDate, ['date'], 100));
      }

      const [dateRes, queriesRes, pagesRes, devicesRes, countriesRes, prevDateRes] = await Promise.all(requests);

      const dateRows = dateRes.rows || [];
      const queryRows = queriesRes.rows || [];
      const pageRows = pagesRes.rows || [];

      const sumSource = dateRows.length > 0 ? dateRows : pageRows;
      const totalClicks = sumSource.reduce((s, r) => s + (r.clicks || 0), 0);
      const totalImpressions = sumSource.reduce((s, r) => s + (r.impressions || 0), 0);
      const weightedPosSum = sumSource.reduce((s, r) => s + (r.position || 0) * (r.impressions || 0), 0);
      const ctr = totalImpressions > 0 ? parseFloat(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0;
      const averagePosition = totalImpressions > 0 ? parseFloat((weightedPosSum / totalImpressions).toFixed(1)) : 0;

      let comparison: SearchConsoleMetrics['comparison'] = undefined;
      if (comparePrevious && prevDateRes) {
        const pRows = prevDateRes.rows || [];
        const pClicks = pRows.reduce((s, r) => s + (r.clicks || 0), 0);
        const pImpr = pRows.reduce((s, r) => s + (r.impressions || 0), 0);
        const pWPos = pRows.reduce((s, r) => s + (r.position || 0) * (r.impressions || 0), 0);
        const pCtr = pImpr > 0 ? parseFloat(((pClicks / pImpr) * 100).toFixed(2)) : 0;
        const pPos = pImpr > 0 ? parseFloat((pWPos / pImpr).toFixed(1)) : 0;
        comparison = {
          startDate: prevStartDate,
          endDate: prevEndDate,
          clicks: Math.round(pClicks),
          impressions: Math.round(pImpr),
          ctr: pCtr,
          averagePosition: pPos,
          clicksDelta: Math.round(totalClicks - pClicks),
          impressionsDelta: Math.round(totalImpressions - pImpr),
          ctrDelta: parseFloat((ctr - pCtr).toFixed(2)),
          positionDelta: pPos > 0 && averagePosition > 0 ? parseFloat((pPos - averagePosition).toFixed(1)) : 0,
        };
      }

      const status: SearchConsoleStatus =
        queryRows.length === 0 && pageRows.length === 0 && dateRows.length === 0 ? 'No Data Yet' : 'Authorized';
      const msg =
        status === 'No Data Yet'
          ? `Connected to ${propertyUrl}, but Google Search Console reports zero impressions/clicks for ${startDate} to ${endDate}.`
          : `Synchronized live Search Console analytics (${startDate} to ${endDate}).`;

      const deviceRows = devicesRes.rows || [];
      const deviceImprTotal = deviceRows.reduce((s, r) => s + (r.impressions || 0), 0) || 1;
      const countryRows = countriesRes.rows || [];
      const countryImprTotal = countryRows.reduce((s, r) => s + (r.impressions || 0), 0) || 1;

      db.updateSearchConsoleConnection(
        {
          diagnosticStatus: status,
          diagnosticMessage: msg,
          lastSyncedAt: new Date().toISOString(),
        },
        actor
      );

      db.updateSearchConsoleMetrics({
        connected: true,
        diagnosticStatus: status,
        diagnosticMessage: msg,
        propertyUrl,
        range,
        startDate,
        endDate,
        comparePrevious,
        comparison,
        impressions: Math.round(totalImpressions),
        clicks: Math.round(totalClicks),
        ctr,
        averagePosition,
        dailySeries: dateRows.map(r => ({
          date: r.keys?.[0] || '',
          clicks: Math.round(r.clicks || 0),
          impressions: Math.round(r.impressions || 0),
          ctr: parseFloat(((r.ctr || 0) * 100).toFixed(2)),
          position: parseFloat((r.position || 0).toFixed(1)),
        })),
        topQueries: queryRows.map(r => ({
          query: r.keys?.[0] || '',
          clicks: Math.round(r.clicks || 0),
          impressions: Math.round(r.impressions || 0),
          ctr: parseFloat(((r.ctr || 0) * 100).toFixed(2)),
          position: parseFloat((r.position || 0).toFixed(1)),
        })),
        topPages: pageRows.map(r => ({
          path: r.keys?.[0] || '',
          clicks: Math.round(r.clicks || 0),
          impressions: Math.round(r.impressions || 0),
          ctr: parseFloat(((r.ctr || 0) * 100).toFixed(2)),
          position: parseFloat((r.position || 0).toFixed(1)),
        })),
        devices: deviceRows.map(r => ({
          device: r.keys?.[0] || 'OTHER',
          percent: Math.round(((r.impressions || 0) / deviceImprTotal) * 100),
          clicks: Math.round(r.clicks || 0),
          impressions: Math.round(r.impressions || 0),
        })),
        countries: countryRows.map(r => ({
          country: (r.keys?.[0] || 'PAK').toUpperCase(),
          percent: Math.round(((r.impressions || 0) / countryImprTotal) * 100),
          clicks: Math.round(r.clicks || 0),
          impressions: Math.round(r.impressions || 0),
        })),
      });

      const savedMetrics = db.getSearchConsoleMetrics();
      analyticsCache.set(cacheKey, {
        key: cacheKey,
        expiresAt: Date.now() + ANALYTICS_CACHE_TTL_MS,
        metrics: savedMetrics,
      });

      await this.persistGscToSupabase(actor);
      await GoogleIntegrationsService.logIntegrationEvent({
        integration: 'gsc',
        action: 'sync_search_analytics',
        status: status === 'No Data Yet' ? 'warning' : 'ok',
        message: msg,
        details: { range, startDate, endDate, clicks: savedMetrics.clicks, impressions: savedMetrics.impressions },
        actor,
      });

      return savedMetrics;
    } catch (err: any) {
      db.updateSearchConsoleConnection(
        {
          diagnosticStatus: 'API Error',
          diagnosticMessage: err?.message || 'Failed querying Search Analytics',
          lastCheckedAt: new Date().toISOString(),
        },
        actor
      );
      await this.persistGscToSupabase(actor).catch(() => {});
      await GoogleIntegrationsService.logIntegrationEvent({
        integration: 'gsc',
        action: 'sync_search_analytics_failed',
        status: 'error',
        message: err?.message || 'Failed querying Search Analytics',
        actor,
      });
      throw err;
    }
  }

  public static async listSitemaps(): Promise<{ sitemaps: any[]; propertyUrl: string }> {
    await GoogleIntegrationsService.ensureHydratedIfConfigured().catch(() => {});
    const conn = db.getSearchConsoleConnection();
    if (conn.authMode === 'none') {
      throw new Error('Connect Google Search Console before listing submitted sitemaps.');
    }
    const token = await this.acquireAccessToken(conn);
    const propertyUrl = conn.propertyUrl || 'https://www.360khabarnama.com/';
    const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(propertyUrl)}/sitemaps`;
    const resp = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`Failed retrieving sitemaps from Google Search Console (HTTP ${resp.status}): ${txt.slice(0, 180)}`);
    }
    const data: any = await resp.json();
    return {
      propertyUrl,
      sitemaps: Array.isArray(data.sitemap) ? data.sitemap : [],
    };
  }

  public static async submitSitemap(sitemapInput: string, actor: string): Promise<{ ok: boolean; feedpath: string; message: string }> {
    await GoogleIntegrationsService.ensureHydratedIfConfigured().catch(() => {});
    const conn = db.getSearchConsoleConnection();
    if (conn.authMode === 'none') {
      throw new Error('Connect Google Search Console before submitting sitemaps.');
    }

    const baseUrl = (db.getData().siteSettings.siteUrl || 'https://www.360khabarnama.com').trim().replace(/\/+$/, '');
    const cleanInput = String(sitemapInput || '').trim();
    const feedpath = cleanInput.startsWith('/') ? `${baseUrl}${cleanInput}` : cleanInput;

    // Validate host matches configured canonical site domain (SSRF/abuse prevention)
    let parsed: URL;
    try {
      parsed = new URL(feedpath);
    } catch {
      throw new Error('Invalid sitemap URL.');
    }
    const baseHost = new URL(baseUrl).hostname.replace(/^www\./, '');
    const targetHost = parsed.hostname.replace(/^www\./, '');
    if (parsed.protocol !== 'https:' || targetHost !== baseHost || !parsed.pathname.endsWith('.xml')) {
      throw new Error(`Sitemap URL must be an HTTPS XML endpoint under ${baseHost} (e.g., ${baseUrl}/sitemap.xml).`);
    }

    const token = await this.acquireAccessToken(conn);
    const propertyUrl = conn.propertyUrl || `${baseUrl}/`;
    const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(propertyUrl)}/sitemaps/${encodeURIComponent(feedpath)}`;
    const resp = await fetch(endpoint, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (resp.status === 401 || resp.status === 403) {
      const txt = await resp.text();
      const msg =
        txt.includes('insufficient') || conn.scopeMode === 'readonly'
          ? 'Insufficient OAuth scope: your current token uses "webmasters.readonly". Switch Scope Mode to "Full (webmasters)" and re-authorize Google Search Console to submit sitemaps.'
          : `Google rejected sitemap submission (HTTP ${resp.status}): ${txt.slice(0, 180)}`;
      await GoogleIntegrationsService.logIntegrationEvent({ integration: 'gsc', action: 'submit_sitemap_denied', status: 'error', message: msg, actor });
      throw new Error(msg);
    }
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`Sitemap submission error (HTTP ${resp.status}): ${txt.slice(0, 180)}`);
    }

    const msg = `Submitted sitemap "${feedpath}" to Google Search Console property ${propertyUrl}.`;
    await GoogleIntegrationsService.logIntegrationEvent({ integration: 'gsc', action: 'submit_sitemap', status: 'ok', message: msg, actor });
    return { ok: true, feedpath, message: msg };
  }

  public static async inspectUrl(targetInput: string, actor: string): Promise<any> {
    await GoogleIntegrationsService.ensureHydratedIfConfigured().catch(() => {});
    const conn = db.getSearchConsoleConnection();
    if (conn.authMode === 'none') {
      throw new Error('Connect Google Search Console before running URL inspection.');
    }

    const baseUrl = (db.getData().siteSettings.siteUrl || 'https://www.360khabarnama.com').trim().replace(/\/+$/, '');
    const cleanInput = String(targetInput || '').trim();
    const inspectionUrl = cleanInput.startsWith('/') ? `${baseUrl}${cleanInput}` : cleanInput;

    let parsed: URL;
    try {
      parsed = new URL(inspectionUrl);
    } catch {
      throw new Error('Enter a valid URL or path on 360khabarnama.com (e.g. /en/news/...).');
    }
    const baseHost = new URL(baseUrl).hostname.replace(/^www\./, '');
    const targetHost = parsed.hostname.replace(/^www\./, '');
    if (parsed.protocol !== 'https:' || targetHost !== baseHost) {
      throw new Error(`URL Inspection only supports pages on ${baseHost}.`);
    }

    const token = await this.acquireAccessToken(conn);
    const propertyUrl = conn.propertyUrl || `${baseUrl}/`;
    const resp = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inspectionUrl,
        siteUrl: propertyUrl,
        languageCode: 'en-US',
      }),
    });

    const data: any = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const errMsg = data?.error?.message || `URL Inspection API returned HTTP ${resp.status}`;
      await GoogleIntegrationsService.logIntegrationEvent({
        integration: 'gsc',
        action: 'inspect_url_error',
        status: 'error',
        message: errMsg,
        details: { inspectionUrl },
        actor,
      });
      throw new Error(errMsg);
    }

    const indexStatus = data?.inspectionResult?.indexStatusResult || {};
    await GoogleIntegrationsService.logIntegrationEvent({
      integration: 'gsc',
      action: 'inspect_url',
      status: indexStatus.verdict === 'PASS' ? 'ok' : 'info',
      message: `Inspected ${inspectionUrl}: ${indexStatus.coverageState || indexStatus.verdict || 'Checked'}`,
      details: { inspectionUrl, verdict: indexStatus.verdict },
      actor,
    });

    return {
      inspectionUrl,
      propertyUrl,
      inspectionResult: data?.inspectionResult || {},
    };
  }
}
