/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Real Google Search Console Integration & Diagnostics
 *
 * Strictly forbids fabricated impressions/clicks/queries when disconnected or failing.
 * Uses encrypted OAuth 2.0 / Service Account credentials via src/server/crypto.ts.
 */

import crypto from 'crypto';
import { db } from '../../src/server/db.ts';
import { encryptSecret, decryptSecret } from '../../src/server/crypto.ts';
import { SearchConsoleConnection, SearchConsoleMetrics, SearchConsoleStatus } from '../../src/types/index.ts';

const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

export class SearchConsoleService {
  public static getSanitizedConnection() {
    const conn = db.getSearchConsoleConnection();
    return {
      authMode: conn.authMode,
      propertyUrl: conn.propertyUrl,
      clientId: conn.clientId || '',
      hasClientSecret: Boolean(conn.encryptedClientSecret),
      hasRefreshToken: Boolean(conn.encryptedRefreshToken),
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

  public static saveOAuthConfig(
    input: {
      clientId: string;
      clientSecret?: string;
      propertyUrl: string;
    },
    actor: string
  ) {
    const existing = db.getSearchConsoleConnection();
    if (!input.clientId?.trim()) {
      throw new Error('Google OAuth Client ID is required.');
    }

    const updated = db.updateSearchConsoleConnection(
      {
        authMode: 'oauth2',
        clientId: input.clientId.trim(),
        propertyUrl: (input.propertyUrl || existing.propertyUrl || '').trim(),
        encryptedClientSecret: input.clientSecret?.trim()
          ? encryptSecret(input.clientSecret.trim())
          : existing.encryptedClientSecret,
        diagnosticStatus: existing.encryptedRefreshToken ? existing.diagnosticStatus : 'Disconnected',
        diagnosticMessage: existing.encryptedRefreshToken
          ? 'OAuth configuration updated.'
          : 'OAuth Client saved. Complete authorization consent to connect your Search Console property.',
      },
      actor
    );

    return updated;
  }

  public static saveServiceAccountConfig(
    input: {
      serviceAccountJson: string;
      propertyUrl: string;
    },
    actor: string
  ) {
    let parsed: any;
    try {
      parsed = JSON.parse(input.serviceAccountJson);
    } catch {
      throw new Error('Invalid JSON file content for Service Account.');
    }
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error('Service Account JSON must contain "client_email" and "private_key".');
    }

    const updated = db.updateSearchConsoleConnection(
      {
        authMode: 'service_account',
        serviceAccountEmail: parsed.client_email,
        encryptedServiceAccountJson: encryptSecret(input.serviceAccountJson),
        propertyUrl: (input.propertyUrl || '').trim(),
        diagnosticStatus: 'Disconnected',
        diagnosticMessage: `Service account ${parsed.client_email} stored (encrypted). Run "Test Connection" to verify access in Google Search Console.`,
      },
      actor
    );

    return updated;
  }

  public static disconnect(actor: string) {
    db.updateSearchConsoleConnection(
      {
        authMode: 'none',
        propertyUrl: '',
        clientId: '',
        encryptedClientSecret: undefined,
        encryptedRefreshToken: undefined,
        encryptedAccessToken: undefined,
        encryptedServiceAccountJson: undefined,
        serviceAccountEmail: undefined,
        tokenExpiresAt: undefined,
        availableProperties: [],
        diagnosticStatus: 'Disconnected',
        diagnosticMessage: 'Google Search Console disconnected. Metrics cleared.',
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
      topQueries: [],
      topPages: [],
      devices: [],
      countries: [],
    });
  }

  public static getOAuthAuthorizeUrl(redirectUri: string): string {
    const conn = db.getSearchConsoleConnection();
    if (!conn.clientId) {
      throw new Error('Configure OAuth Client ID before initiating Google authorization.');
    }
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', conn.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', GSC_SCOPE);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    return url.toString();
  }

  public static async handleOAuthCallback(code: string, redirectUri: string, actor: string) {
    const conn = db.getSearchConsoleConnection();
    if (!conn.clientId || !conn.encryptedClientSecret) {
      throw new Error('OAuth Client ID and Client Secret must be saved before exchanging code.');
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
      db.updateSearchConsoleConnection(
        {
          diagnosticStatus: 'API Error',
          diagnosticMessage: tokenJson.error_description || tokenJson.error || 'OAuth token exchange failed.',
          lastCheckedAt: new Date().toISOString(),
        },
        actor
      );
      throw new Error(tokenJson.error_description || 'Google OAuth token exchange failed.');
    }

    const expiresAt = new Date(Date.now() + (tokenJson.expires_in || 3500) * 1000).toISOString();
    db.updateSearchConsoleConnection(
      {
        authMode: 'oauth2',
        encryptedAccessToken: encryptSecret(tokenJson.access_token),
        encryptedRefreshToken: tokenJson.refresh_token
          ? encryptSecret(tokenJson.refresh_token)
          : conn.encryptedRefreshToken,
        tokenExpiresAt: expiresAt,
        diagnosticStatus: 'Authorized',
        diagnosticMessage: 'OAuth 2.0 consent granted. Testing property access...',
        lastCheckedAt: new Date().toISOString(),
      },
      actor
    );

    return await this.testAndVerifyConnection(actor);
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
      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
      const claim = Buffer.from(
        JSON.stringify({
          iss: sa.client_email,
          scope: GSC_SCOPE,
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

    // OAuth 2.0 mode
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
    return json.access_token;
  }

  public static async testAndVerifyConnection(actor: string = 'SEO Manager'): Promise<{
    status: SearchConsoleStatus;
    message: string;
    properties: string[];
  }> {
    const conn = db.getSearchConsoleConnection();
    const nowIso = new Date().toISOString();

    if (conn.authMode === 'none') {
      const msg = 'No Google Search Console OAuth 2.0 or Service Account credentials configured.';
      db.updateSearchConsoleConnection({ diagnosticStatus: 'Disconnected', diagnosticMessage: msg, lastCheckedAt: nowIso }, actor);
      return { status: 'Disconnected', message: msg, properties: [] };
    }

    try {
      const token = await this.acquireAccessToken(conn);
      const sitesResp = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (sitesResp.status === 401) {
        const msg = 'Google access token expired or revoked (HTTP 401). Re-authenticate.';
        db.updateSearchConsoleConnection({ diagnosticStatus: 'Token Expired', diagnosticMessage: msg, lastCheckedAt: nowIso }, actor);
        return { status: 'Token Expired', message: msg, properties: [] };
      }

      if (sitesResp.status === 403) {
        const msg = 'Access Denied (HTTP 403). Ensure this account or service email is added as a User in Search Console.';
        db.updateSearchConsoleConnection({ diagnosticStatus: 'Access Denied', diagnosticMessage: msg, lastCheckedAt: nowIso }, actor);
        return { status: 'Access Denied', message: msg, properties: [] };
      }

      if (!sitesResp.ok) {
        const errText = await sitesResp.text();
        const msg = `Search Console API Error (HTTP ${sitesResp.status}): ${errText.slice(0, 180)}`;
        db.updateSearchConsoleConnection({ diagnosticStatus: 'API Error', diagnosticMessage: msg, lastCheckedAt: nowIso }, actor);
        return { status: 'API Error', message: msg, properties: [] };
      }

      const sitesData: any = await sitesResp.json();
      const siteEntries: any[] = sitesData.siteEntry || [];
      const properties = siteEntries.map(s => s.siteUrl).filter(Boolean);

      if (properties.length === 0) {
        const msg = 'Authorized successfully, but 0 Search Console properties were found for this account/service email.';
        db.updateSearchConsoleConnection(
          {
            diagnosticStatus: 'Property Not Found',
            diagnosticMessage: msg,
            availableProperties: [],
            lastCheckedAt: nowIso,
          },
          actor
        );
        return { status: 'Property Not Found', message: msg, properties: [] };
      }

      const targetProp = conn.propertyUrl || properties[0];
      const matched = properties.some(p => p.toLowerCase() === targetProp.toLowerCase());

      if (conn.propertyUrl && !matched) {
        const msg = `Property "${conn.propertyUrl}" not found in verified sites. Available: ${properties.join(', ')}`;
        db.updateSearchConsoleConnection(
          {
            diagnosticStatus: 'Property Not Found',
            diagnosticMessage: msg,
            availableProperties: properties,
            lastCheckedAt: nowIso,
          },
          actor
        );
        return { status: 'Property Not Found', message: msg, properties };
      }

      const msg = `Verified connection to Search Console property ${targetProp}.`;
      db.updateSearchConsoleConnection(
        {
          propertyUrl: targetProp,
          availableProperties: properties,
          diagnosticStatus: 'Authorized',
          diagnosticMessage: msg,
          lastCheckedAt: nowIso,
        },
        actor
      );
      return { status: 'Authorized', message: msg, properties };
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
      return { status, message: text, properties: [] };
    }
  }

  public static async syncLiveAnalytics(actor: string = 'SEO Manager'): Promise<SearchConsoleMetrics> {
    const check = await this.testAndVerifyConnection(actor);
    if (check.status !== 'Authorized') {
      const updated = {
        connected: false,
        diagnosticStatus: check.status,
        diagnosticMessage: check.message,
        propertyUrl: db.getSearchConsoleConnection().propertyUrl || '',
        impressions: 0,
        clicks: 0,
        ctr: 0,
        averagePosition: 0,
        topQueries: [],
        topPages: [],
        devices: [],
        countries: [],
      };
      db.updateSearchConsoleMetrics(updated);
      return db.getSearchConsoleMetrics();
    }

    const conn = db.getSearchConsoleConnection();
    const token = await this.acquireAccessToken(conn);
    const propertyUrl = conn.propertyUrl;
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 28 * 86400000).toISOString().split('T')[0];
    const apiBase = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(propertyUrl)}/searchAnalytics/query`;

    const queryDimension = async (dimensions: string[], rowLimit: number) => {
      const r = await fetch(apiBase, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate,
          endDate,
          dimensions,
          rowLimit,
        }),
      });
      if (!r.ok) {
        const bodyText = await r.text();
        throw new Error(`Search Analytics query error (HTTP ${r.status}): ${bodyText.slice(0, 150)}`);
      }
      return (await r.json()) as { rows?: any[] };
    };

    try {
      const [queriesRes, pagesRes, devicesRes, countriesRes] = await Promise.all([
        queryDimension(['query'], 20),
        queryDimension(['page'], 20),
        queryDimension(['device'], 5),
        queryDimension(['country'], 10),
      ]);

      const queryRows = queriesRes.rows || [];
      const pageRows = pagesRes.rows || [];
      const totalClicks = pageRows.reduce((s, r) => s + (r.clicks || 0), 0);
      const totalImpressions = pageRows.reduce((s, r) => s + (r.impressions || 0), 0);
      const weightedPosSum = pageRows.reduce((s, r) => s + (r.position || 0) * (r.impressions || 0), 0);

      const status: SearchConsoleStatus =
        queryRows.length === 0 && pageRows.length === 0 ? 'No Data Yet' : 'Authorized';
      const msg =
        status === 'No Data Yet'
          ? `Connected to ${propertyUrl}, but Search Console reports no indexed clicks/impressions for ${startDate} to ${endDate}.`
          : `Synchronized 28-day live Search Console analytics (${startDate} to ${endDate}).`;

      const deviceRows = devicesRes.rows || [];
      const deviceClicksTotal = deviceRows.reduce((s, r) => s + (r.impressions || 0), 0) || 1;
      const countryRows = countriesRes.rows || [];
      const countryImpTotal = countryRows.reduce((s, r) => s + (r.impressions || 0), 0) || 1;

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
        impressions: totalImpressions,
        clicks: totalClicks,
        ctr: totalImpressions > 0 ? parseFloat(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0,
        averagePosition: totalImpressions > 0 ? parseFloat((weightedPosSum / totalImpressions).toFixed(1)) : 0,
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
          percent: Math.round(((r.impressions || 0) / deviceClicksTotal) * 100),
          clicks: Math.round(r.clicks || 0),
          impressions: Math.round(r.impressions || 0),
        })),
        countries: countryRows.map(r => ({
          country: (r.keys?.[0] || 'PAK').toUpperCase(),
          percent: Math.round(((r.impressions || 0) / countryImpTotal) * 100),
          clicks: Math.round(r.clicks || 0),
          impressions: Math.round(r.impressions || 0),
        })),
      });

      return db.getSearchConsoleMetrics();
    } catch (err: any) {
      db.updateSearchConsoleConnection(
        {
          diagnosticStatus: 'API Error',
          diagnosticMessage: err?.message || 'Failed querying Search Analytics',
          lastCheckedAt: new Date().toISOString(),
        },
        actor
      );
      throw err;
    }
  }
}
