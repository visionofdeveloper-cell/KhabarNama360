/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — AI Error Classifier, Timeout Wrapper & Outbound Network Diagnostics
 */

import crypto from 'crypto';
import dns from 'dns/promises';
import { AIConnectionStatus, AIDiagnosticError, AIProviderType } from '../../src/types/index.ts';

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

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = 15000
): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`Request timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  const externalSignal = init.signal;
  const onExternalAbort = () => controller.abort((externalSignal as any)?.reason || new Error('Aborted by caller'));
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      throw new Error('Request aborted by caller');
    }
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
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
}): AIDiagnosticError {
  const correlationId = params.correlationId || generateCorrelationId('err');
  const providerLabel =
    params.providerType === 'gemini'
      ? 'Google Gemini'
      : params.providerType === 'grok'
      ? 'xAI Grok'
      : 'Custom AI Provider';

  const rawMsg = redactSecrets(
    params.providerMessage || params.err?.message || '',
    params.secretToRedact
  );
  const lower = `${rawMsg} ${params.providerErrorCode || ''}`.toLowerCase();
  const status = params.httpStatus ?? params.err?.status ?? params.err?.statusCode;
  const errCode = String(params.err?.code || params.err?.cause?.code || '').toUpperCase();

  // 1. Caller Abort vs Timeout
  if (
    params.err?.name === 'AbortError' ||
    params.err?.name === 'TimeoutError' ||
    lower.includes('timed out') ||
    lower.includes('timeout') ||
    errCode === 'ETIMEDOUT' ||
    errCode === 'UND_ERR_CONNECT_TIMEOUT'
  ) {
    return {
      correlationId,
      httpStatus: status,
      category: 'timeout',
      connectionStatus: params.authenticated ? 'authenticated_generation_unavailable' : 'timeout',
      title: `${providerLabel} Request Timeout`,
      diagnosis: params.authenticated
        ? `Authenticated — Generation Unavailable: ${providerLabel} did not respond within the timeout window (${rawMsg || 'timeout'}).`
        : `${providerLabel} did not respond within the configured timeout window.`,
      suggestedAction:
        'Verify server outbound latency or retry with a faster model (e.g., Gemini Flash / Grok Mini). If hosted on Namecheap, confirm shared hosting PHP/Node outbound timeouts allow TLS requests.',
      providerMessage: rawMsg || undefined,
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
      title: `Outbound Network / TLS Connectivity Error (${errCode || 'Network'})`,
      diagnosis: `Unable to establish a secure outbound HTTPS connection to ${providerLabel}. This is a hosting/network/DNS/TLS issue, NOT an invalid API key.`,
      suggestedAction:
        'Run the Outbound Connectivity Diagnostic in this panel. On Namecheap Shared Hosting, open a support ticket requesting outbound TCP port 443 access to generativelanguage.googleapis.com and api.x.ai.',
      providerMessage: rawMsg || errCode || undefined,
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
      suggestedAction: 'Confirm the API endpoint URL and model ID are correct, then re-test.',
      providerMessage: rawMsg || undefined,
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
      connectionStatus: params.authenticated ? 'authenticated_generation_unavailable' : 'billing_required',
      title: params.authenticated
        ? 'Authenticated — Generation Unavailable (Billing / Credits Required)'
        : `${providerLabel} Billing or Credits Required`,
      diagnosis: params.authenticated
        ? `Authenticated — Generation Unavailable: Your ${providerLabel} key authenticated, but inference failed because credits or billing must be enabled (${rawMsg}).`
        : `${providerLabel} rejected generation due to account billing, credit balance, or spending limit restrictions (${rawMsg}).`,
      suggestedAction:
        params.providerType === 'grok'
          ? 'Open console.x.ai → Billing & Credits, add prepaid credits or raise your monthly spending limit, then click Re-test.'
          : 'Enable billing in Google AI Studio / Google Cloud Billing or switch to a free-tier eligible Flash model.',
      providerMessage: rawMsg || undefined,
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
      title: `${providerLabel} Authentication Failed (401)`,
      diagnosis: `${providerLabel} rejected the API key (${rawMsg || 'Unauthorized / API key invalid'}).`,
      suggestedAction:
        params.providerType === 'gemini'
          ? 'Copy the exact AIza... key from Google AI Studio (aistudio.google.com/apikey) with no extra spaces or quotes.'
          : 'Copy a valid xai-... secret key from console.x.ai/team/default/api-keys and verify it has not been revoked.',
      providerMessage: rawMsg || undefined,
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
      connectionStatus: params.authenticated ? 'authenticated_generation_unavailable' : 'permission_denied',
      title: params.authenticated
        ? 'Authenticated — Generation Unavailable (403 Permission Denied)'
        : `${providerLabel} Permission Denied (403)`,
      diagnosis: params.authenticated
        ? `Authenticated — Generation Unavailable: Key listed models, but lacks permission to execute ${params.model || 'this model'} (${rawMsg}).`
        : `${providerLabel} denied access (403): ${rawMsg || 'Restricted API key, disabled Generative Language API, or server IP/referrer restriction.'}`,
      suggestedAction:
        params.providerType === 'gemini'
          ? 'In Google Cloud Console, enable "Generative Language API" and remove HTTP Referrer restrictions (use None or server IP restrictions for backend calls).'
          : 'Check xAI key scopes/permissions in console.x.ai and ensure this model is allowed for your team.',
      providerMessage: rawMsg || undefined,
    };
  }

  // 7. 404 Model Not Found / Incorrect Endpoint
  if (status === 404 || lower.includes('not_found') || lower.includes('not found') || lower.includes('does not exist')) {
    return {
      correlationId,
      httpStatus: status || 404,
      category: 'not_found_404',
      connectionStatus: params.authenticated ? 'authenticated_generation_unavailable' : 'endpoint_not_found',
      title: params.authenticated
        ? 'Authenticated — Generation Unavailable (Model Not Available)'
        : `${providerLabel} Endpoint or Model Not Found (404)`,
      diagnosis: params.authenticated
        ? `Authenticated — Generation Unavailable: Model "${params.model || 'selected'}" returned 404 (${rawMsg}).`
        : `Requested endpoint or model "${params.model || ''}" was not found (404): ${rawMsg}`,
      suggestedAction: 'Select an accessible model from the discovered model list returned by the provider API.',
      providerMessage: rawMsg || undefined,
    };
  }

  // 8. 429 Quota Exhausted / Rate Limit
  if (status === 429 || lower.includes('resource_exhausted') || lower.includes('rate limit') || lower.includes('quota')) {
    return {
      correlationId,
      httpStatus: status || 429,
      category: 'quota_429',
      connectionStatus: params.authenticated ? 'authenticated_generation_unavailable' : 'quota_exhausted',
      title: params.authenticated
        ? 'Authenticated — Generation Unavailable (429 Quota / Rate Limit)'
        : `${providerLabel} Quota Exhausted / Rate Limit (429)`,
      diagnosis: params.authenticated
        ? `Authenticated — Generation Unavailable: Key is valid and listed models, but generation is currently rate-limited or quota-exhausted (${rawMsg}).`
        : `${providerLabel} rate limit or quota exhausted (429): ${rawMsg}`,
      suggestedAction:
        'Wait for the RPM/TPM window to reset, choose a Flash/Mini tier model with higher free quota, or configure a fallback provider from a different project.',
      providerMessage: rawMsg || undefined,
    };
  }

  // 9. 400 Invalid Request / Unsupported Parameter
  if (status === 400 || lower.includes('invalid_argument') || lower.includes('bad request')) {
    // Gemini sometimes returns 400 with API_KEY_INVALID
    if (lower.includes('api_key_invalid') || lower.includes('api key not valid')) {
      return {
        correlationId,
        httpStatus: 400,
        category: 'auth_failed_401',
        connectionStatus: 'auth_failed',
        title: `${providerLabel} API Key Rejected (API_KEY_INVALID)`,
        diagnosis: `Google Gemini reported API_KEY_INVALID: ${rawMsg}`,
        suggestedAction: 'Generate a fresh key in Google AI Studio and paste it cleanly without spaces.',
        providerMessage: rawMsg || undefined,
      };
    }

    return {
      correlationId,
      httpStatus: 400,
      category: 'bad_request_400',
      connectionStatus: params.authenticated ? 'authenticated_generation_unavailable' : 'error',
      title: `${providerLabel} Invalid Request (400)`,
      diagnosis: params.authenticated
        ? `Authenticated — Generation Unavailable: Invalid parameter or model request (${rawMsg}).`
        : `${providerLabel} rejected the request payload (400): ${rawMsg}`,
      suggestedAction: 'Select a compatible text-generation model from the discovered model list and re-test.',
      providerMessage: rawMsg || undefined,
    };
  }

  // 10. 5xx Provider Server Failure
  if (typeof status === 'number' && status >= 500) {
    return {
      correlationId,
      httpStatus: status,
      category: 'server_error_5xx',
      connectionStatus: params.authenticated ? 'authenticated_generation_unavailable' : 'server_error',
      title: `${providerLabel} Server Error (${status})`,
      diagnosis: `${providerLabel} experienced an upstream server failure (HTTP ${status}): ${rawMsg}`,
      suggestedAction: 'This is a temporary provider-side outage. Retry in a few moments or use a configured failover provider.',
      providerMessage: rawMsg || undefined,
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
      ? `Authenticated — Generation Unavailable: ${rawMsg || 'Unexpected error during test generation.'}`
      : rawMsg || `Unexpected error communicating with ${providerLabel}.`,
    suggestedAction: `Check server logs with correlation ID ${correlationId} and re-test connection.`,
    providerMessage: rawMsg || undefined,
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
