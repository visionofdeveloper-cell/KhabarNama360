/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Serverless-Safe Firebase ID Token Verification
 *
 * Uses Node built-in `crypto` against Google's official Firebase Secure Token
 * X.509 public certificates instead of `firebase-admin` -> `jwks-rsa` -> `jose`
 * (which crashes on Node 20 runtimes due to `require('jose')` ERR_REQUIRE_ESM).
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const SECURE_TOKEN_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

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

function loadFirebaseConfig(): { projectId: string } {
  const fallbackProjectId =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    'gen-lang-client-0094029776';

  const candidates = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    path.resolve('/var/task/firebase-applet-config.json'),
  ];

  for (const configPath of candidates) {
    try {
      if (fs.existsSync(configPath)) {
        const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (parsed?.projectId) {
          return { projectId: parsed.projectId };
        }
      }
    } catch (err) {
      console.warn('[FirebaseAuth] Config read warning:', (err as any)?.message);
    }
  }

  return { projectId: fallbackProjectId };
}

let cachedCerts: Record<string, string> | null = null;
let certsExpiresAt = 0;

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

    const { projectId } = loadFirebaseConfig();
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
      // Key rotation fallback: force refresh once
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
