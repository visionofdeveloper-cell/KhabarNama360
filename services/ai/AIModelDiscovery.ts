/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Live AI Model Discovery Service (Gemini /v1beta/models & xAI /v1/models)
 */

import { AIModelInfo, AIProviderType } from '../../src/types/index.ts';
import {
  classifyProviderError,
  fetchWithTimeout,
  generateCorrelationId,
  ProviderExecutionError,
} from './AIConnectionValidator.ts';

export interface ModelDiscoveryResult {
  ok: boolean;
  providerType: AIProviderType;
  models: AIModelInfo[];
  recommendedModel: string | null;
  latencyMs: number;
  correlationId: string;
  rateLimitInfo?: {
    remainingRequests?: number;
    remainingTokens?: number;
    resetAt?: string;
  };
}

function scoreGeminiModel(id: string): number {
  const lower = id.toLowerCase();
  if (
    lower.includes('embedding') ||
    lower.includes('aqa') ||
    lower.includes('imagen') ||
    lower.includes('veo') ||
    lower.includes('tts') ||
    lower.includes('live') ||
    lower.includes('transcribe') ||
    lower.includes('lyria') ||
    lower.includes('-image') ||
    lower.includes('nano-banana') ||
    lower.includes('computer-use') ||
    lower.includes('robotics') ||
    lower.includes('deep-research') ||
    lower.includes('antigravity')
  ) {
    return -100;
  }
  let score = 10;
  if (lower === 'gemini-3.5-flash-lite') score += 95;
  else if (lower === 'gemini-3.1-flash-lite') score += 92;
  else if (lower === 'gemini-flash-lite-latest') score += 88;
  else if (lower === 'gemini-3.8-flash') score += 85;
  else if (lower === 'gemini-3.7-flash') score += 82;
  else if (lower === 'gemini-3.6-flash') score += 80;
  else if (lower === 'gemini-3.5-flash') score += 78;
  else if (lower === 'gemini-flash-latest') score += 75;
  else if (lower === 'gemini-4-hydrogen') score += 68;
  else if (lower.includes('gemini-4')) score += 64;
  else if (lower.includes('gemini-3') && lower.includes('flash')) score += 60;
  else if (lower.includes('gemini-2.5-flash')) score += 30;
  else if (lower.includes('gemini-2.0-flash')) score += 20;
  else if (lower.includes('flash')) score += 45;
  else if (lower.includes('pro') || lower.includes('argon') || lower.includes('carbon')) score += 40;
  if (lower.includes('preview') || lower.includes('exp')) score -= 10;
  return score;
}

function scoreGrokModel(id: string): number {
  const lower = id.toLowerCase();
  if (lower.includes('image') || lower.includes('vision-only') || lower.includes('embed')) {
    return -100;
  }
  let score = 10;
  if (lower.includes('grok-3-mini')) score += 85;
  else if (lower.includes('grok-4') && lower.includes('fast')) score += 82;
  else if (lower.includes('grok-4')) score += 78;
  else if (lower.includes('grok-3-fast')) score += 75;
  else if (lower.includes('grok-3')) score += 70;
  else if (lower.includes('grok')) score += 50;
  return score;
}

function extractRateLimitHeaders(headers: Headers) {
  const remReq = headers.get('x-ratelimit-remaining-requests');
  const remTok = headers.get('x-ratelimit-remaining-tokens');
  const reset = headers.get('x-ratelimit-reset-requests') || headers.get('retry-after');
  if (!remReq && !remTok && !reset) return undefined;
  return {
    remainingRequests: remReq ? Number(remReq) : undefined,
    remainingTokens: remTok ? Number(remTok) : undefined,
    resetAt: reset || undefined,
  };
}

export class AIModelDiscovery {
  public static async discoverGeminiModels(
    apiKey: string,
    signal?: AbortSignal
  ): Promise<ModelDiscoveryResult> {
    const correlationId = generateCorrelationId('gem-models');
    const start = Date.now();
    const cleanKey = apiKey.trim();

    if (!cleanKey) {
      throw new ProviderExecutionError(
        classifyProviderError({
          providerType: 'gemini',
          httpStatus: 401,
          providerMessage: 'API key is empty.',
          stage: 'model_list',
          correlationId,
        })
      );
    }

    const models: AIModelInfo[] = [];
    let pageToken: string | undefined;
    let pageCount = 0;

    try {
      do {
        const url = new URL('https://generativelanguage.googleapis.com/v1beta/models');
        url.searchParams.set('pageSize', '100');
        if (pageToken) url.searchParams.set('pageToken', pageToken);

        const res = await fetchWithTimeout(
          url.toString(),
          {
            method: 'GET',
            headers: {
              'x-goog-api-key': cleanKey,
              'User-Agent': 'aistudio-build',
            },
            signal,
          },
          15000
        );

        const rawText = await res.text();
        let parsed: any = null;
        try {
          parsed = rawText ? JSON.parse(rawText) : {};
        } catch {
          throw new ProviderExecutionError(
            classifyProviderError({
              providerType: 'gemini',
              httpStatus: res.status,
              providerMessage: `Malformed non-JSON response from /v1beta/models (${rawText.slice(0, 120)})`,
              stage: 'model_list',
              correlationId,
              secretToRedact: cleanKey,
            })
          );
        }

        if (!res.ok) {
          throw new ProviderExecutionError(
            classifyProviderError({
              providerType: 'gemini',
              httpStatus: res.status,
              providerMessage: parsed?.error?.message || parsed?.message || `HTTP ${res.status}`,
              providerErrorCode: parsed?.error?.status,
              stage: 'model_list',
              correlationId,
              secretToRedact: cleanKey,
            })
          );
        }

        const rawList = Array.isArray(parsed?.models) ? parsed.models : [];
        for (const m of rawList) {
          const rawName = String(m.name || '');
          const id = rawName.startsWith('models/') ? rawName.slice('models/'.length) : rawName;
          if (!id) continue;
          const methods: string[] = Array.isArray(m.supportedGenerationMethods)
            ? m.supportedGenerationMethods
            : [];
          const supportsGen = methods.includes('generateContent');
          models.push({
            id,
            displayName: m.displayName || id,
            description: m.description ? String(m.description).slice(0, 180) : undefined,
            supportedMethods: methods,
            supportsTextGeneration: supportsGen && scoreGeminiModel(id) > 0,
            inputTokenLimit: typeof m.inputTokenLimit === 'number' ? m.inputTokenLimit : undefined,
            outputTokenLimit: typeof m.outputTokenLimit === 'number' ? m.outputTokenLimit : undefined,
          });
        }

        pageToken = parsed?.nextPageToken;
        pageCount++;
      } while (pageToken && pageCount < 3);

      const textModels = models
        .filter(m => m.supportsTextGeneration)
        .sort((a, b) => scoreGeminiModel(b.id) - scoreGeminiModel(a.id));

      return {
        ok: true,
        providerType: 'gemini',
        models: [
          ...textModels,
          ...models.filter(m => !m.supportsTextGeneration),
        ],
        recommendedModel: textModels[0]?.id || models.find(m => m.supportedMethods?.includes('generateContent'))?.id || null,
        latencyMs: Date.now() - start,
        correlationId,
      };
    } catch (err: any) {
      if (err instanceof ProviderExecutionError) throw err;
      throw new ProviderExecutionError(
        classifyProviderError({
          providerType: 'gemini',
          err,
          stage: 'model_list',
          correlationId,
          secretToRedact: cleanKey,
        })
      );
    }
  }

  public static async discoverGrokModels(
    apiKey: string,
    baseUrl: string = 'https://api.x.ai/v1',
    signal?: AbortSignal
  ): Promise<ModelDiscoveryResult> {
    const correlationId = generateCorrelationId('grok-models');
    const start = Date.now();
    const cleanKey = apiKey.trim();

    if (!cleanKey) {
      throw new ProviderExecutionError(
        classifyProviderError({
          providerType: 'grok',
          httpStatus: 401,
          providerMessage: 'API key is empty.',
          stage: 'model_list',
          correlationId,
        })
      );
    }

    // Normalize base URL (strip /responses or /chat/completions if passed)
    const normalizedBase = baseUrl
      .trim()
      .replace(/\/+$/, '')
      .replace(/\/(chat\/completions|responses|models)$/i, '') || 'https://api.x.ai/v1';

    const modelsUrl = `${normalizedBase}/models`;

    try {
      const res = await fetchWithTimeout(
        modelsUrl,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${cleanKey}`,
            Accept: 'application/json',
          },
          signal,
        },
        15000
      );

      const rawText = await res.text();
      let parsed: any = null;
      try {
        parsed = rawText ? JSON.parse(rawText) : {};
      } catch {
        throw new ProviderExecutionError(
          classifyProviderError({
            providerType: 'grok',
            httpStatus: res.status,
            providerMessage: `Malformed non-JSON response from ${modelsUrl}: ${rawText.slice(0, 120)}`,
            stage: 'model_list',
            correlationId,
            secretToRedact: cleanKey,
          })
        );
      }

      if (!res.ok) {
        throw new ProviderExecutionError(
          classifyProviderError({
            providerType: 'grok',
            httpStatus: res.status,
            providerMessage: parsed?.error?.message || parsed?.error || parsed?.message || `HTTP ${res.status}`,
            providerErrorCode: parsed?.code || parsed?.error?.code,
            stage: 'model_list',
            correlationId,
            secretToRedact: cleanKey,
          })
        );
      }

      const rawList = Array.isArray(parsed?.data)
        ? parsed.data
        : Array.isArray(parsed?.models)
        ? parsed.models
        : [];

      const models: AIModelInfo[] = rawList
        .map((m: any) => {
          const id = String(m.id || m.name || '').trim();
          if (!id) return null;
          const isText = scoreGrokModel(id) > 0;
          return {
            id,
            displayName: m.display_name || id,
            supportedMethods: isText ? ['responses', 'chat.completions'] : ['specialized'],
            supportsTextGeneration: isText,
          } as AIModelInfo;
        })
        .filter(Boolean) as AIModelInfo[];

      const sortedText = models
        .filter(m => m.supportsTextGeneration)
        .sort((a, b) => scoreGrokModel(b.id) - scoreGrokModel(a.id));

      return {
        ok: true,
        providerType: 'grok',
        models: [
          ...sortedText,
          ...models.filter(m => !m.supportsTextGeneration),
        ],
        recommendedModel: sortedText[0]?.id || models[0]?.id || null,
        latencyMs: Date.now() - start,
        correlationId,
        rateLimitInfo: extractRateLimitHeaders(res.headers),
      };
    } catch (err: any) {
      if (err instanceof ProviderExecutionError) throw err;
      throw new ProviderExecutionError(
        classifyProviderError({
          providerType: 'grok',
          err,
          stage: 'model_list',
          correlationId,
          secretToRedact: cleanKey,
        })
      );
    }
  }
}
