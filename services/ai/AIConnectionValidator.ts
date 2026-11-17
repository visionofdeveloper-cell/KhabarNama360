/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — AI Error Classifier, Timeout Wrapper & Outbound Network Diagnostics
 */

import crypto from 'crypto';
import dns from 'dns/promises';
import { AIConnectionStatus, AIDiagnosticError, AIFailureSource, AIProviderType } from '../../src/types/index.ts';

/**
 * Bounded server-side AI timeout budgets (kept under reverse-proxy ~60-90s ceilings).
 */
export function getDiscoveryTimeoutMs(): number {
  const raw = Number(process.env.AI_DISCOVERY_TIMEOUT_MS || 12000);
  if (!Number.isFinite(raw)) return 12000;
  return Math.max(5000, Math.min(25000, Math.round(raw)));
}

export function getGenerationTimeoutMs(): number {
  const raw = Number(process.env.AI_GENERATION_TIMEOUT_MS || 45000);
  if (!Number.isFinite(raw)) return 45000;
  return Math.max(15000, Math.min(60000, Math.round(raw)));
}

export function getInferenceTimeoutMs(): number {
  const raw = Number(process.env.AI_INFERENCE_TIMEOUT_MS || 50000);
  if (!Number.isFinite(raw)) return 50000;
  return Math.max(15000, Math.min(60000, Math.round(raw)));
}

export class ProviderExecutionError extends Error {
  public readonly diagnostic: AIDiagnosticError;

  constructor(diagnostic: AIDiagnosticError) {
    super(diagnostic.diagnosis);
    this.name = 'ProviderExecutionError';
    this.diagnostic = diagnostic;
  }
}

export function generateCorrelationId(prefix: string = 'ai'): string {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
}

export function redactSecrets(input: string, extraSecret?: string): string {
  if (!input) return '';
  let out = String(input);
  if (extraSecret && extraSecret.trim().length >= 6) {
    const escaped = extraSecret.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(escaped, 'g'), '[REDACTED_KEY]');
  }
  out = out
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[REDACTED_GEMINI_KEY]')
    .replace(/xai-[0-9A-Za-z_-]{16,}/g, '[REDACTED_XAI_KEY]')
    .replace(/sk-[0-9A-Za-z_-]{16,}/g, '[REDACTED_API_KEY]')
    .replace(/Bearer\s+[0-9A-Za-z._-]+/gi, 'Bearer [REDACTED]');
  return out;
}

export async function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  if (signal?.aborted) {
    throw (signal as any).reason || new Error('Aborted by caller');
  }
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject((signal as any)?.reason || new Error('Aborted by caller'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = 15000
): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    const timeoutErr = new Error(`Request timed out after ${timeoutMs}ms`);
    timeoutErr.name = 'TimeoutError';
    controller.abort(timeoutErr);
  }, timeoutMs);

  const externalSignal = init.signal;
  const onExternalAbort = () => controller.abort((externalSignal as any)?.reason || new Error('Aborted by caller'));
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      throw (externalSignal as any).reason || new Error('Request aborted by caller');
    }
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (err: any) {
    if (controller.signal.aborted && !externalSignal?.aborted) {
      const reason = (controller.signal as any).reason;
      if (reason instanceof Error) throw reason;
      const e = new Error(`Request timed out after ${timeoutMs}ms`);
      e.name = 'TimeoutError';
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

function defaultProviderSource(providerType: AIProviderType): AIFailureSource {
  if (providerType === 'gemini') return 'Google API';
  if (providerType === 'grok') return 'xAI API';
  return 'Browser-to-backend request';
}

export function classifyProviderError(params: {
  providerType: AIProviderType;
  httpStatus?: number;
  providerMessage?: string;
  providerErrorCode?: string;
  err?: any;
  model?: string;
  stage: 'model_list' | 'generation_test' | 'inference';
  authenticated?: boolean;
  correlationId?: string;
  secretToRedact?: string;
  timeoutWindowMs?: number;
  retried?: boolean;
}): AIDiagnosticError {
  const correlationId = params.correlationId || generateCorrelationId('err');
  const providerLabel =
    params.providerType === 'gemini'
      ? 'Google Gemini'
      : params.providerType === 'grok'
      ? 'xAI Grok'
      : 'Custom AI Provider';
  const apiSource = defaultProviderSource(params.providerType);

  const rawMsg = redactSecrets(
    params.providerMessage || params.err?.message || '',
    params.secretToRedact
  );
  const lower = `${rawMsg} ${params.providerErrorCode || ''}`.toLowerCase();
  const status = params.httpStatus ?? params.err?.status ?? params.err?.statusCode;
  const errCode = String(params.err?.code || params.err?.cause?.code || '').toUpperCase();

  // 1. Timeout detection (must happen cleanly before generic abort/network errors)
  const isTimeoutSignal =
    params.err?.name === 'TimeoutError' ||
    (params.err?.name === 'AbortError' && !lower.includes('caller') && !lower.includes('disconnected')) ||
    lower.includes('timed out') ||
    lower.includes('timeout') ||
    errCode === 'ETIMEDOUT' ||
    errCode === 'UND_ERR_CONNECT_TIMEOUT' ||
    errCode === 'UND_ERR_HEADERS_TIMEOUT';

  if (isTimeoutSignal) {
    const windowMs = params.timeoutWindowMs || getGenerationTimeoutMs();
    const isGeminiAuthGen = params.providerType === 'gemini' && Boolean(params.authenticated) && params.stage === 'generation_test';
    const isGrokAuthGen = params.providerType === 'grok' && Boolean(params.authenticated) && params.stage === 'generation_test';
    return {
      correlationId,
      httpStatus: status || 504,
      category: 'timeout',
      connectionStatus: 'timeout',
      title: params.authenticated ? 'Generation Timeout (Credentials Verified)' : `${providerLabel} Request Timeout`,
      diagnosis: isGeminiAuthGen
        ? 'Gemini credentials verified, but the generation test timed out. Your key may be valid.'
        : isGrokAuthGen
        ? 'xAI Grok credentials verified, but the generation test timed out. Your key may be valid.'
        : params.authenticated
        ? `${providerLabel} credentials verified, but ${params.model || 'the selected model'} did not respond within ${Math.round(windowMs / 1000)}s.`
        : `${providerLabel} did not respond within ${Math.round(windowMs / 1000)}s (${rawMsg || 'timeout'}).`,
      suggestedAction:
        'Click "Retry Test" without re-pasting your key. If timeouts persist, check Outbound Diagnostics for hosting network latency or Google/xAI regional availability.',
      providerMessage: rawMsg || `Timed out after ${windowMs}ms`,
      failureSource: params.stage === 'model_list' ? 'Namecheap hosting' : apiSource,
      timeoutWindowMs: windowMs,
      retried: params.retried,
    };
  }

  // 2. Network / DNS / TLS / Firewall errors
  if (
    ['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'EAI_AGAIN', 'EHOSTUNREACH', 'ENETUNREACH'].includes(errCode) ||
    errCode.startsWith('CERT_') ||
    errCode.startsWith('ERR_TLS') ||
    lower.includes('fetch failed') ||
    lower.includes('enotfound') ||
    lower.includes('econnrefused') ||
    lower.includes('certificate') ||
    lower.includes('socket hang up')
  ) {
    return {
      correlationId,
      httpStatus: status,
      category: 'network_error',
      connectionStatus: params.authenticated ? 'authenticated_generation_unavailable' : 'network_error',
      title: `Outbound Network / TLS Error (${errCode || 'Network'})`,
      diagnosis: `Unable to establish a secure outbound HTTPS connection to ${providerLabel}. This indicates a hosting firewall/DNS/TLS issue, not an invalid API key.`,
      suggestedAction:
        'Run the Outbound Probe in Connection Diagnostics. On Namecheap Shared Hosting, verify outbound HTTPS (port 443) to generativelanguage.googleapis.com and api.x.ai is allowed.',
      providerMessage: rawMsg || errCode || undefined,
      failureSource: 'Namecheap hosting',
    };
  }

  // 3. Malformed response
  if (lower.includes('malformed') || lower.includes('non-json') || lower.includes('unexpected token') || lower.includes('empty response')) {
    return {
      correlationId,
      httpStatus: status,
      category: 'malformed_response',
      connectionStatus: params.authenticated ? 'authenticated_generation_unavailable' : 'malformed_response',
      title: `${providerLabel} Malformed Response`,
      diagnosis: `${providerLabel} returned an unexpected or non-JSON response format${status ? ` (HTTP ${status})` : ''}.`,
      suggestedAction: 'Click Retry Test. If the response looks like an HTML proxy page, inspect hosting outbound proxy settings.',
      providerMessage: rawMsg || undefined,
      failureSource: apiSource,
    };
  }

  // 4. Explicit Billing / Credit exhaustion checks (before generic 403/429)
  const isBillingSignal =
    status === 402 ||
    lower.includes('credit') ||
    lower.includes('billing') ||
    lower.includes('payment') ||
    lower.includes('balance') ||
    lower.includes('spending limit') ||
    lower.includes('insufficient_quota') ||
    lower.includes('prepaid') ||
    lower.includes('free tier is not available') ||
    lower.includes('limit: 0');

  if (isBillingSignal) {
    return {
      correlationId,
      httpStatus: status,
      category: 'billing_required',
      connectionStatus: 'billing_required',
      title: 'Billing Required',
      diagnosis: params.authenticated
        ? `Your ${providerLabel} key authenticated, but generation requires billing or prepaid credits (${rawMsg}).`
        : `${providerLabel} requires billing or prepaid credits for this key (${rawMsg}).`,
      suggestedAction:
        params.providerType === 'grok'
          ? 'Open console.x.ai → Billing & Credits, add prepaid credits or raise your spending limit, then click Retry Test.'
          : 'Enable billing in Google AI Studio / Google Cloud Billing, or use a free-tier eligible AI Studio key.',
      providerMessage: rawMsg || undefined,
      failureSource: apiSource,
    };
  }

  // 5. 401 Authentication Failure
  if (
    status === 401 ||
    lower.includes('invalid authentication') ||
    lower.includes('incorrect api key') ||
    lower.includes('invalid x-api-key') ||
    lower.includes('unauthorized') ||
    lower.includes('api key not valid') ||
    lower.includes('api_key_invalid')
  ) {
    return {
      correlationId,
      httpStatus: status || 401,
      category: 'auth_failed_401',
      connectionStatus: 'auth_failed',
      title: 'Invalid Key',
      diagnosis: `${providerLabel} rejected the API key (${rawMsg || 'Unauthorized / API key invalid'}).`,
      suggestedAction:
        params.providerType === 'gemini'
          ? 'Copy the exact AIza... key from Google AI Studio (aistudio.google.com/apikey) with no extra spaces.'
          : 'Copy a valid xai-... secret key from console.x.ai and verify it has not been revoked.',
      providerMessage: rawMsg || undefined,
      failureSource: apiSource,
    };
  }

  // 6. 403 Permission Denied / Restricted Key / Disabled API
  if (
    status === 403 ||
    lower.includes('permission_denied') ||
    lower.includes('permission denied') ||
    lower.includes('has not been used in project') ||
    lower.includes('is disabled') ||
    lower.includes('ip_address_blocked') ||
    lower.includes('referer')
  ) {
    return {
      correlationId,
      httpStatus: status || 403,
      category: 'permission_denied_403',
      connectionStatus: 'permission_denied',
      title: 'Permission Denied',
      diagnosis: params.authenticated
        ? `Key listed models, but lacks permission for ${params.model || 'this model'} (${rawMsg}).`
        : `${providerLabel} denied access (403): ${rawMsg || 'Restricted key, disabled API, or HTTP referrer restriction.'}`,
      suggestedAction:
        params.providerType === 'gemini'
          ? 'In Google Cloud Console, enable "Generative Language API" and remove HTTP Referrer restrictions for backend server calls.'
          : 'Check xAI key permissions/ACL scopes in console.x.ai.',
      providerMessage: rawMsg || undefined,
      failureSource: apiSource,
    };
  }

  // 7. 404 Model Not Found / Unavailable
  if (status === 404 || lower.includes('not_found') || lower.includes('not found') || lower.includes('does not exist')) {
    return {
      correlationId,
      httpStatus: status || 404,
      category: 'not_found_404',
      connectionStatus: 'endpoint_not_found',
      title: 'Model Unavailable',
      diagnosis: params.authenticated
        ? `Model "${params.model || 'selected'}" is unavailable or returned 404 (${rawMsg}).`
        : `Requested model "${params.model || ''}" was not found (404): ${rawMsg}`,
      suggestedAction: 'Click Retry Test so 360Khabarnama can try the next supported model on your key.',
      providerMessage: rawMsg || undefined,
      failureSource: apiSource,
    };
  }

  // 8. 429 Quota Exhausted / Rate Limit
  if (status === 429 || lower.includes('resource_exhausted') || lower.includes('rate limit') || lower.includes('quota')) {
    return {
      correlationId,
      httpStatus: status || 429,
      category: 'quota_429',
      connectionStatus: 'quota_exhausted',
      title: 'Quota Exceeded',
      diagnosis: params.authenticated
        ? `Key verified, but quota or rate limit is currently exhausted (${rawMsg}).`
        : `${providerLabel} quota exceeded / rate limited (429): ${rawMsg}`,
      suggestedAction: 'Wait a minute for RPM/TPM quota reset, then click Retry Test.',
      providerMessage: rawMsg || undefined,
      failureSource: apiSource,
    };
  }

  // 9. 400 Invalid Request / Unsupported Parameter
  if (status === 400 || lower.includes('invalid_argument') || lower.includes('bad request')) {
    if (lower.includes('api_key_invalid') || lower.includes('api key not valid')) {
      return {
        correlationId,
        httpStatus: 400,
        category: 'auth_failed_401',
        connectionStatus: 'auth_failed',
        title: 'Invalid Key',
        diagnosis: `Google Gemini reported API_KEY_INVALID: ${rawMsg}`,
        suggestedAction: 'Generate a fresh key in Google AI Studio and paste it cleanly without spaces.',
        providerMessage: rawMsg || undefined,
        failureSource: apiSource,
      };
    }

    return {
      correlationId,
      httpStatus: 400,
      category: 'bad_request_400',
      connectionStatus: params.authenticated ? 'authenticated_generation_unavailable' : 'error',
      title: 'Model Unavailable',
      diagnosis: params.authenticated
        ? `Credentials verified, but generation request was rejected by ${params.model || 'model'} (400): ${rawMsg}`
        : `${providerLabel} rejected the request payload (400): ${rawMsg}`,
      suggestedAction: 'Retry so another compatible free-tier text model is selected automatically.',
      providerMessage: rawMsg || undefined,
      failureSource: apiSource,
    };
  }

  // 10. 5xx Provider Server Failure
  if (typeof status === 'number' && status >= 500) {
    return {
      correlationId,
      httpStatus: status,
      category: 'server_error_5xx',
      connectionStatus: 'server_error',
      title: 'Provider Unavailable',
      diagnosis: `${providerLabel} experienced an upstream server error (HTTP ${status}): ${rawMsg}`,
      suggestedAction: 'This is a temporary provider outage. Click Retry Test shortly.',
      providerMessage: rawMsg || undefined,
      failureSource: apiSource,
    };
  }

  // 11. Unknown Error
  return {
    correlationId,
    httpStatus: status,
    category: 'unknown',
    connectionStatus: params.authenticated ? 'authenticated_generation_unavailable' : 'error',
    title: `${providerLabel} Unexpected Error`,
    diagnosis: params.authenticated
      ? `Credentials verified, but test generation failed: ${rawMsg || 'Unexpected error.'}`
      : rawMsg || `Unexpected error communicating with ${providerLabel}.`,
    suggestedAction: `Check Connection Diagnostics (Correlation ID: ${correlationId}) and click Retry Test.`,
    providerMessage: rawMsg || undefined,
    failureSource: apiSource,
  };
}

export interface OutboundHostDiagnostic {
  host: string;
  provider: string;
  dnsResolved: boolean;
  resolvedIp?: string;
  httpsReachable: boolean;
  httpStatus?: number;
  latencyMs: number;
  error?: string;
  guidance?: string;
}

export async function checkOutboundConnectivity(): Promise<{
  checkedAt: string;
  overallOk: boolean;
  hosts: OutboundHostDiagnostic[];
  hostingNote: string;
}> {
  const targets = [
    {
      host: 'generativelanguage.googleapis.com',
      provider: 'Google Gemini API',
      probeUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    },
    {
      host: 'api.x.ai',
      provider: 'xAI Grok API',
      probeUrl: 'https://api.x.ai/v1/models',
    },
  ];

  const hosts: OutboundHostDiagnostic[] = [];

  for (const t of targets) {
    const start = Date.now();
    let dnsResolved = false;
    let resolvedIp: string | undefined;
    try {
      const lookup = await dns.lookup(t.host);
      dnsResolved = true;
      resolvedIp = lookup.address;
    } catch (dnsErr: any) {
      hosts.push({
        host: t.host,
        provider: t.provider,
        dnsResolved: false,
        httpsReachable: false,
        latencyMs: Date.now() - start,
        error: `DNS lookup failed: ${dnsErr?.message || dnsErr?.code || 'unknown'}`,
        guidance: `Confirm DNS resolution for ${t.host} on your hosting server / Namecheap environment.`,
      });
      continue;
    }

    try {
      // Unauthenticated GET intentionally expects 400/401/403 HTTP response proving full TCP+TLS+HTTP reachability
      const res = await fetchWithTimeout(t.probeUrl, { method: 'GET' }, 8000);
      hosts.push({
        host: t.host,
        provider: t.provider,
        dnsResolved,
        resolvedIp,
        httpsReachable: true,
        httpStatus: res.status,
        latencyMs: Date.now() - start,
      });
    } catch (netErr: any) {
      hosts.push({
        host: t.host,
        provider: t.provider,
        dnsResolved,
        resolvedIp,
        httpsReachable: false,
        latencyMs: Date.now() - start,
        error: netErr?.message || 'HTTPS connection failed',
        guidance: `Outbound TCP 443 to ${t.host} (${resolvedIp}) appears blocked or timed out. On Namecheap Shared Hosting, contact support to whitelist outbound HTTPS port 443 to ${t.host}.`,
      });
    }
  }

  const overallOk = hosts.every(h => h.dnsResolved && h.httpsReachable);
  return {
    checkedAt: new Date().toISOString(),
    overallOk,
    hosts,
    hostingNote: overallOk
      ? 'Outbound HTTPS (TLS 443) to Google Gemini and xAI Grok endpoints is reachable from this Node.js server.'
      : 'One or more AI provider endpoints could not be reached over outbound HTTPS (443). This indicates a hosting firewall/DNS issue rather than an invalid API key.',
  };
}
