/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Safe JSON Fetch Helper
 * Prevents SyntaxError crashes when proxies or serverless functions return HTML/plaintext 500 errors.
 */

export interface SafeJsonResult<T = any> {
  ok: boolean;
  status: number;
  data: T;
  error?: string;
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
    const res = await fetch(input, init);
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
