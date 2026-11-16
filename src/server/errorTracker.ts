/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Structured Server Error Tracker (Redacts All Credentials)
 */

export interface ServerErrorLogEntry {
  id: string;
  timestamp: string;
  source: 'api' | 'firestore' | 'publishing' | 'ai' | 'auth' | 'scheduler';
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
