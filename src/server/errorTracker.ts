/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Structured Server Error Tracker (Redacts All Credentials)
 */

export interface ServerErrorLogEntry {
  id: string;
  timestamp: string;
  source: 'api' | 'supabase' | 'firestore' | 'publishing' | 'ai' | 'auth' | 'scheduler';
  code: string;
  message: string;
  statusCode?: number;
  method?: string;
  path?: string;
  correlationId?: string;
}

const MAX_LOGS = 200;
const errorRingBuffer: ServerErrorLogEntry[] = [];

function redactSensitiveText(input: string): string {
  return String(input || '')
    .replace(/AIza[0-9A-Za-z\-_]{20,}/g, '[REDACTED_GEMINI_KEY]')
    .replace(/xai-[0-9A-Za-z\-_]{16,}/g, '[REDACTED_XAI_KEY]')
    .replace(/Bearer\s+[0-9A-Za-z\-_.]{16,}/gi, 'Bearer [REDACTED]')
    .replace(/-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]')
    .replace(/(password|secret|token|key)=([^&\s]+)/gi, '$1=[REDACTED]');
}

export function recordServerError(entry: Omit<ServerErrorLogEntry, 'id' | 'timestamp'>): ServerErrorLogEntry {
  const clean: ServerErrorLogEntry = {
    ...entry,
    id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    message: redactSensitiveText(entry.message).slice(0, 600),
  };
  errorRingBuffer.unshift(clean);
  if (errorRingBuffer.length > MAX_LOGS) {
    errorRingBuffer.length = MAX_LOGS;
  }
  return clean;
}

export function getServerErrorLogs(limit: number = 50): ServerErrorLogEntry[] {
  return errorRingBuffer.slice(0, Math.max(1, Math.min(limit, MAX_LOGS)));
}

export interface SlowQueryLogEntry {
  id: string;
  operation: string;
  table: string;
  durationMs: number;
  timestamp: string;
}

const slowQueryBuffer: SlowQueryLogEntry[] = [];
const SLOW_QUERY_THRESHOLD_MS = 350;

export function recordQueryTiming(table: string, operation: string, durationMs: number): void {
  if (!Number.isFinite(durationMs) || durationMs < SLOW_QUERY_THRESHOLD_MS) return;
  slowQueryBuffer.unshift({
    id: `sq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    table,
    operation,
    durationMs: Math.round(durationMs),
    timestamp: new Date().toISOString(),
  });
  if (slowQueryBuffer.length > 100) slowQueryBuffer.length = 100;
}

export function getSlowQueryLogs(limit: number = 25): SlowQueryLogEntry[] {
  return slowQueryBuffer.slice(0, Math.max(1, Math.min(limit, 100)));
}

export interface WebVitalMetricInput {
  name: 'LCP' | 'INP' | 'CLS' | 'TTFB' | 'FCP';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  path: string;
}

interface StoredVitalEntry extends WebVitalMetricInput {
  timestamp: string;
}

const webVitalsBuffer: StoredVitalEntry[] = [];

export function recordWebVitalSample(sample: WebVitalMetricInput): void {
  if (!Number.isFinite(sample.value)) return;
  webVitalsBuffer.unshift({
    ...sample,
    path: String(sample.path || '/').slice(0, 120),
    timestamp: new Date().toISOString(),
  });
  if (webVitalsBuffer.length > 200) webVitalsBuffer.length = 200;
}

export function getWebVitalsSummary(): {
  sampleCount: number;
  metrics: Record<string, { latest: number; p75: number; rating: string; samples: number }>;
  recentSamples: StoredVitalEntry[];
} {
  const byName: Record<string, StoredVitalEntry[]> = {};
  for (const s of webVitalsBuffer) {
    if (!byName[s.name]) byName[s.name] = [];
    byName[s.name].push(s);
  }
  const metrics: Record<string, { latest: number; p75: number; rating: string; samples: number }> = {};
  for (const [name, list] of Object.entries(byName)) {
    const sorted = [...list].map(x => x.value).sort((a, b) => a - b);
    const p75Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75));
    const latest = list[0];
    metrics[name] = {
      latest: Number(latest.value.toFixed(name === 'CLS' ? 3 : 0)),
      p75: Number(sorted[p75Idx].toFixed(name === 'CLS' ? 3 : 0)),
      rating: latest.rating,
      samples: list.length,
    };
  }
  return {
    sampleCount: webVitalsBuffer.length,
    metrics,
    recentSamples: webVitalsBuffer.slice(0, 20),
  };
}

