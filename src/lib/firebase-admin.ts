/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Serverless-Safe Firebase Admin Auth & Service Account Access
 *
 * Uses static import of firebase-applet-config.json (per ESM & Cloud Run guidelines)
 * and Node built-in `crypto` for both Firebase ID Token RS256 verification and
 * optional Google Service Account OAuth2 JWT token minting without `jwks-rsa`/`jose`.
 */

import fs from 'fs';
import crypto from 'crypto';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

const SECURE_TOKEN_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export const firebaseProjectConfig = {
  projectId: firebaseConfig.projectId,
  firestoreDatabaseId: firebaseConfig.firestoreDatabaseId,
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  storageBucket: firebaseConfig.storageBucket,
};

export interface DecodedFirebaseToken {
  uid: string;
  sub: string;
  aud: string;
  iss: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  exp: number;
  iat: number;
  auth_time?: number;
  [key: string]: any;
}

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  project_id?: string;
}

let cachedCerts: Record<string, string> | null = null;
let certsExpiresAt = 0;

let cachedServiceToken: string | null = null;
let serviceTokenExpiresAt = 0;

function loadServiceAccountCredentials(): ServiceAccountCredentials | null {
  try {
    const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
    if (rawJson && rawJson.startsWith('{')) {
      const parsed = JSON.parse(rawJson);
      if (parsed?.client_email && parsed?.private_key) return parsed;
    }

    const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim();
    if (b64) {
      const parsed = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
      if (parsed?.client_email && parsed?.private_key) return parsed;
    }

    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
    if (credPath && fs.existsSync(credPath)) {
      const parsed = JSON.parse(fs.readFileSync(credPath, 'utf8'));
      if (parsed?.client_email && parsed?.private_key) return parsed;
    }
  } catch (err: any) {
    console.warn('[FirebaseAdmin] Service account parse warning:', err?.message || err);
  }
  return null;
}

export function hasServiceAccountConfigured(): boolean {
  return Boolean(loadServiceAccountCredentials());
}

/**
 * Mints a short-lived Google Cloud OAuth2 access token from Service Account credentials
 * (when configured via FIREBASE_SERVICE_ACCOUNT_JSON / BASE64 / GOOGLE_APPLICATION_CREDENTIALS).
 */
export async function getServiceAccountAccessToken(): Promise<string | null> {
  const sa = loadServiceAccountCredentials();
  if (!sa) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  if (cachedServiceToken && nowSec < serviceTokenExpiresAt - 60) {
    return cachedServiceToken;
  }

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      sub: sa.client_email,
      aud: OAUTH_TOKEN_URL,
      iat: nowSec,
      exp: nowSec + 3600,
      scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase',
    })
  ).toString('base64url');

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  signer.end();
  const signature = signer.sign(sa.private_key).toString('base64url');
  const assertion = `${header}.${claim}.${signature}`;

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Google OAuth2 service token exchange failed (HTTP ${res.status}): ${errText.slice(0, 160)}`);
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new Error('Google OAuth2 response did not include access_token.');
  }

  cachedServiceToken = data.access_token;
  serviceTokenExpiresAt = nowSec + (data.expires_in || 3600);
  return cachedServiceToken;
}

async function fetchGooglePublicCerts(forceRefresh = false): Promise<Record<string, string>> {
  const now = Date.now();
  if (!forceRefresh && cachedCerts && now < certsExpiresAt) {
    return cachedCerts;
  }

  const res = await fetch(SECURE_TOKEN_CERTS_URL, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Google public certificates (HTTP ${res.status}).`);
  }

  const certs = (await res.json()) as Record<string, string>;
  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const ttlSec = maxAgeMatch ? Math.max(60, parseInt(maxAgeMatch[1], 10)) : 3600;

  cachedCerts = certs;
  certsExpiresAt = now + ttlSec * 1000;
  return certs;
}

function decodeBase64UrlJson<T = any>(segment: string): T {
  const json = Buffer.from(segment, 'base64url').toString('utf8');
  return JSON.parse(json) as T;
}

export const adminAuth = {
  verifyIdToken: async (idToken: string): Promise<DecodedFirebaseToken> => {
    if (!idToken || typeof idToken !== 'string') {
      throw new Error('Firebase ID token must be a non-empty string.');
    }

    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new Error('Decoding Firebase ID token failed. Invalid JWT format.');
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    let header: { alg?: string; kid?: string };
    let payload: DecodedFirebaseToken;

    try {
      header = decodeBase64UrlJson(headerB64);
      payload = decodeBase64UrlJson(payloadB64);
    } catch {
      throw new Error('Decoding Firebase ID token failed. Malformed JWT payload.');
    }

    if (header.alg !== 'RS256' || !header.kid) {
      throw new Error('Firebase ID token has invalid signing algorithm or missing key ID.');
    }

    const projectId = firebaseProjectConfig.projectId;
    const nowSec = Math.floor(Date.now() / 1000);
    const clockSkewSec = 300;

    if (typeof payload.exp !== 'number' || payload.exp <= nowSec - clockSkewSec) {
      throw new Error('Firebase ID token has expired.');
    }
    if (typeof payload.iat !== 'number' || payload.iat > nowSec + clockSkewSec) {
      throw new Error('Firebase ID token issued-at timestamp is invalid.');
    }
    if (typeof payload.auth_time === 'number' && payload.auth_time > nowSec + clockSkewSec) {
      throw new Error('Firebase ID token auth_time is in the future.');
    }
    if (payload.aud !== projectId) {
      throw new Error(`Firebase ID token has incorrect audience "${payload.aud}".`);
    }
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
      throw new Error(`Firebase ID token has incorrect issuer "${payload.iss}".`);
    }
    if (!payload.sub || typeof payload.sub !== 'string') {
      throw new Error('Firebase ID token missing non-empty subject (sub).');
    }

    let certs = await fetchGooglePublicCerts(false);
    let certPem = certs[header.kid];
    if (!certPem) {
      certs = await fetchGooglePublicCerts(true);
      certPem = certs[header.kid];
    }
    if (!certPem) {
      throw new Error(`Firebase ID token signing key "${header.kid}" not found in Google certificates.`);
    }

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();

    const sigBuf = Buffer.from(signatureB64, 'base64url');
    const isValid = verifier.verify(certPem, sigBuf);
    if (!isValid) {
      throw new Error('Firebase ID token signature verification failed.');
    }

    return {
      ...payload,
      uid: payload.sub,
    };
  },
};
