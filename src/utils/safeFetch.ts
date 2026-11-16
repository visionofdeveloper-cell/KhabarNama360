/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Safe JSON & Firebase-Authorized Fetch Helpers
 * Prevents SyntaxError crashes and attaches verified Firebase ID tokens to /api/* requests.
 */

import { auth } from '../lib/firebase.ts';

export interface SafeJsonResult<T = any> {
  ok: boolean;
  status: number;
  data: T;
  error?: string;
}

export async function getFirebaseAuthHeaders(
  existingHeaders?: HeadersInit
): Promise<Headers> {
  const headers = new Headers(existingHeaders || {});
  if (!headers.has('Authorization')) {
    try {
      const user = auth?.currentUser;
      if (user) {
        const token = await user.getIdToken();
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }
      }
    } catch {
      // Fall back gracefully to session cookies if Firebase client token retrieval fails
    }
  }
  return headers;
}

export async function authorizedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const headers = await getFirebaseAuthHeaders(init.headers);
  return fetch(input, {
    ...init,
    credentials: init.credentials ?? 'include',
    headers,
  });
}

export async function safeParseResponse<T = any>(res: Response): Promise<SafeJsonResult<T>> {
  let rawText = '';
  try {
    rawText = await res.text();
  } catch (err: any) {
    return {
      ok: false,
      status: res.status,
      data: { success: false, error: err?.message || 'Failed reading server response.' } as unknown as T,
      error: err?.message || 'Failed reading server response.',
    };
  }

  if (!rawText || !rawText.trim()) {
    return {
      ok: res.ok,
      status: res.status,
      data: { success: res.ok } as unknown as T,
      error: res.ok ? undefined : `Server returned empty HTTP ${res.status} response.`,
    };
  }

  try {
    const parsed = JSON.parse(rawText) as T;
    return {
      ok: res.ok,
      status: res.status,
      data: parsed,
      error: res.ok ? undefined : (parsed as any)?.error || `HTTP ${res.status}`,
    };
  } catch {
    const snippet = rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
    const msg =
      res.status >= 500
        ? `Server error (HTTP ${res.status}): ${snippet || 'Unexpected server response'}`
        : `Invalid JSON response (HTTP ${res.status}): ${snippet || 'Non-JSON payload'}`;
    return {
      ok: false,
      status: res.status,
      data: { success: false, error: msg } as unknown as T,
      error: msg,
    };
  }
}

export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T & { success?: boolean; error?: string; _httpStatus?: number }> {
  try {
    const isInternalApi =
      (typeof input === 'string' && input.startsWith('/api/')) ||
      (input instanceof URL && input.pathname.startsWith('/api/'));

    const res = isInternalApi ? await authorizedFetch(input, init) : await fetch(input, init);
    const parsed = await safeParseResponse<T>(res);
    if (parsed.data && typeof parsed.data === 'object') {
      return {
        ...(parsed.data as any),
        _httpStatus: parsed.status,
        error: (parsed.data as any).error || parsed.error,
      };
    }
    return {
      success: false,
      error: parsed.error || `HTTP ${parsed.status}`,
      _httpStatus: parsed.status,
    } as any;
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network request failed.',
      _httpStatus: 0,
    } as any;
  }
}
