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
  getDiscoveryTimeoutMs,
  ProviderExecutionError,
  safeReadResponseText,
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

export function isDeprecatedGeminiModel(id: string): boolean {
  const lower = id.toLowerCase();
  return (
    lower.includes('gemini-1.5') ||
    lower.includes('gemini-1.0') ||
    lower.includes('gemini-2.0') ||
    lower === 'gemini-pro' ||
    lower.startsWith('gemini-pro-')
  );
}

export function isPaidOnlyGeminiModel(id: string): boolean {
  const lower = id.toLowerCase();
  return (
    lower.includes('carbon') ||
    lower.includes('argon') ||
    lower.includes('2.5-pro') ||
    lower.includes('3-pro') ||
    lower.includes('3.1-pro') ||
    lower.includes('deep-research') ||
    lower.includes('imagen') ||
    lower.includes('veo') ||
    lower.includes('lyria') ||
    lower.includes('nano-banana') ||
    lower.includes('-image') ||
    lower.includes('pro-preview')
  );
}

export function isFreeTierGeminiModel(id: string): boolean {
  const lower = id.toLowerCase();
  if (isDeprecatedGeminiModel(lower) || isPaidOnlyGeminiModel(lower)) return false;
  return (
    lower === 'gemini-4-hydrogen' ||
    lower.includes('hydrogen') ||
    lower.includes('flash-lite') ||
    lower.includes('2.5-flash') ||
    lower.includes('3-flash') ||
    lower.includes('3.1-flash') ||
    lower.includes('3.5-flash') ||
    lower === 'gemini-flash-latest' ||
    lower.includes('flash')
  );
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
    lower.includes('antigravity') ||
    isDeprecatedGeminiModel(lower)
  ) {
    return -100;
  }
  let score = 10;
  // Prioritize confirmed free-tier general text models highest
  if (lower === 'gemini-4-hydrogen') score += 120;
  else if (lower === 'gemini-3.1-flash-lite') score += 115;
  else if (lower === 'gemini-3.5-flash-lite') score += 110;
  else if (lower === 'gemini-flash-lite-latest') score += 105;
  else if (lower === 'gemini-2.5-flash-lite') score += 102;
  else if (lower === 'gemini-2.5-flash') score += 98;
  else if (lower === 'gemini-flash-latest') score += 95;
  else if (lower.includes('gemini-3') && lower.includes('flash')) score += 90;
  else if (lower.includes('flash')) score += 82;
  // Paid-tier capable text models ranked strictly below free-tier models
  else if (lower === 'gemini-4-argon') score += 42;
  else if (lower === 'gemini-4-carbon') score += 38;
  else if (lower.includes('gemini-4')) score += 36;
  else if (lower.includes('gemini-2.5-pro')) score += 30;
  else if (lower.includes('argon') || lower.includes('carbon') || lower.includes('pro')) score += 25;
  if (lower.includes('preview') || lower.includes('exp')) score -= 8;
  return score;
}

export function selectAutoGeminiModel(
  models: AIModelInfo[],
  allowPaidModels: boolean = false
): {
  selectedModel: string | null;
  freeTierCandidates: string[];
  allCandidates: string[];
  onlyPaidAvailable: boolean;
} {
  const textModels = models
    .filter(m => m.supportsTextGeneration && !isDeprecatedGeminiModel(m.id))
    .sort((a, b) => scoreGeminiModel(b.id) - scoreGeminiModel(a.id));

  const fallbackGen = models
    .filter(
      m =>
        m.supportedMethods?.includes('generateContent') &&
        !isDeprecatedGeminiModel(m.id) &&
        !m.id.toLowerCase().includes('embedding') &&
        !m.id.toLowerCase().includes('imagen') &&
        !m.id.toLowerCase().includes('veo')
    )
    .sort((a, b) => scoreGeminiModel(b.id) - scoreGeminiModel(a.id));

  const orderedPool = textModels.length > 0 ? textModels : fallbackGen;
  const freeTierCandidates = orderedPool.filter(m => isFreeTierGeminiModel(m.id)).map(m => m.id);
  const allCandidates = orderedPool.map(m => m.id);

  if (freeTierCandidates.length > 0) {
    return {
      selectedModel: freeTierCandidates[0],
      freeTierCandidates,
      allCandidates,
      onlyPaidAvailable: false,
    };
  }

  const nonPaidUnknown = orderedPool.filter(m => !isPaidOnlyGeminiModel(m.id)).map(m => m.id);
  if (nonPaidUnknown.length > 0) {
    return {
      selectedModel: nonPaidUnknown[0],
      freeTierCandidates: [],
      allCandidates: nonPaidUnknown,
      onlyPaidAvailable: false,
    };
  }

  if (allowPaidModels && allCandidates.length > 0) {
    return {
      selectedModel: allCandidates[0],
      freeTierCandidates: [],
      allCandidates,
      onlyPaidAvailable: true,
    };
  }

  return {
    selectedModel: null,
    freeTierCandidates: [],
    allCandidates,
    onlyPaidAvailable: allCandidates.length > 0,
  };
}

function scoreGrokModel(id: string): number {
  const lower = id.toLowerCase();
  if (lower.includes('image') || lower.includes('vision-only') || lower.includes('embed') || lower.includes('imagine')) {
    return -100;
  }
  let score = 10;
  if (lower.includes('grok-3-mini')) score += 90;
  else if (lower.includes('grok-4') && lower.includes('fast')) score += 86;
  else if (lower.includes('grok-3-fast')) score += 82;
  else if (lower.includes('grok-3')) score += 75;
  else if (lower.includes('grok-4')) score += 70;
  else if (lower.includes('grok')) score += 50;
  return score;
}

export function selectAutoGrokModel(models: AIModelInfo[]): string | null {
  const sorted = [...models]
    .filter(m => m.supportsTextGeneration)
    .sort((a, b) => scoreGrokModel(b.id) - scoreGrokModel(a.id));
  return sorted[0]?.id || models[0]?.id || null;
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
  /**
   * Best-effort non-billable inspection of xAI API key metadata (/v1/api-key).
   * Returns null silently if the endpoint is unsupported or restricted.
   */
  public static async inspectGrokApiKeyMetadata(
    apiKey: string,
    baseUrl: string = 'https://api.x.ai/v1',
    signal?: AbortSignal
  ): Promise<{ keyBlocked?: boolean; acls?: string[]; teamId?: string; name?: string } | null> {
    const cleanKey = apiKey.trim();
    if (!cleanKey) return null;
    const normalizedBase =
      baseUrl
        .trim()
        .replace(/\/+$/, '')
        .replace(/\/(chat\/completions|responses|models)$/i, '') || 'https://api.x.ai/v1';

    try {
      const res = await fetchWithTimeout(
        `${normalizedBase}/api-key`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${cleanKey}`,
            Accept: 'application/json',
          },
          signal,
        },
        8000
      );
      if (!res.ok) return null;
      const data: any = await res.json().catch(() => null);
      if (!data) return null;
      return {
        keyBlocked: Boolean(data.api_key_blocked || data.team_blocked || data.disabled),
        acls: Array.isArray(data.acls) ? data.acls : undefined,
        teamId: data.team_id ? String(data.team_id) : undefined,
        name: data.name ? String(data.name) : undefined,
      };
    } catch {
      return null;
    }
  }
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
          getDiscoveryTimeoutMs()
        );

        const rawText = await safeReadResponseText(res);
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
      const autoPick = selectAutoGeminiModel(models, false);

      return {
        ok: true,
        providerType: 'gemini',
        models: [
          ...textModels,
          ...models.filter(m => !m.supportsTextGeneration),
        ],
        recommendedModel: autoPick.selectedModel,
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
        getDiscoveryTimeoutMs()
      );

      const rawText = await safeReadResponseText(res);
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
