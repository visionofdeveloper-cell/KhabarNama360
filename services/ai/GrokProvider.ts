/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — xAI Grok (/v1/models & /v1/responses) + Custom OpenAI-Compatible Provider Adapter
 */

import { AIModelInfo, AIProviderType, AIValidationResult } from '../../src/types/index.ts';
import { AIExecutionOptions, AIExecutionResponse } from './GeminiProvider.ts';
import {
  classifyProviderError,
  fetchWithTimeout,
  generateCorrelationId,
  ProviderExecutionError,
} from './AIConnectionValidator.ts';
import { AIModelDiscovery } from './AIModelDiscovery.ts';

function extractResponsesOutputText(parsed: any): string {
  if (typeof parsed?.output_text === 'string' && parsed.output_text.trim()) {
    return parsed.output_text;
  }
  if (Array.isArray(parsed?.output)) {
    const chunks: string[] = [];
    for (const item of parsed.output) {
      if (item?.type === 'message' && Array.isArray(item.content)) {
        for (const c of item.content) {
          if (typeof c?.text === 'string') {
            chunks.push(c.text);
          }
        }
      } else if (typeof item?.text === 'string') {
        chunks.push(item.text);
      }
    }
    const joined = chunks.join('').trim();
    if (joined) return joined;
  }
  // Fallback if proxy returned chat.completions shape
  if (typeof parsed?.choices?.[0]?.message?.content === 'string') {
    return parsed.choices[0].message.content;
  }
  return '';
}

function resolveGrokEndpoints(endpointUrl?: string, providerType: AIProviderType = 'grok'): {
  baseUrl: string;
  inferenceUrl: string;
  useResponsesApi: boolean;
} {
  const raw = (endpointUrl || 'https://api.x.ai/v1').trim().replace(/\/+$/, '');
  const isCustomChatCompletions =
    providerType === 'custom' ||
    providerType === 'custom_data' ||
    raw.endsWith('/chat/completions');

  if (isCustomChatCompletions && raw.endsWith('/chat/completions')) {
    return {
      baseUrl: raw.replace(/\/chat\/completions$/i, ''),
      inferenceUrl: raw,
      useResponsesApi: false,
    };
  }

  if (raw.endsWith('/responses')) {
    return {
      baseUrl: raw.replace(/\/responses$/i, ''),
      inferenceUrl: raw,
      useResponsesApi: true,
    };
  }

  if (providerType === 'custom' || providerType === 'custom_data') {
    return {
      baseUrl: raw,
      inferenceUrl: `${raw}/chat/completions`,
      useResponsesApi: false,
    };
  }

  const baseUrl = raw || 'https://api.x.ai/v1';
  return {
    baseUrl,
    inferenceUrl: `${baseUrl}/responses`,
    useResponsesApi: true,
  };
}

export class GrokProvider {
  public static async execute(
    opts: AIExecutionOptions & { endpointUrl?: string; providerType?: AIProviderType }
  ): Promise<AIExecutionResponse> {
    const cleanKey = (opts.apiKey || '').trim();
    const providerType: AIProviderType = opts.providerType || 'grok';
    if (!cleanKey) {
      throw new ProviderExecutionError(
        classifyProviderError({
          providerType,
          httpStatus: 401,
          providerMessage: 'Grok / Custom provider API key is missing.',
          stage: 'inference',
        })
      );
    }

    const start = Date.now();
    const model = (opts.model || '').trim();
    if (!model) {
      throw new ProviderExecutionError(
        classifyProviderError({
          providerType,
          httpStatus: 400,
          providerMessage: 'No Grok model selected for this credential.',
          stage: 'inference',
        })
      );
    }

    const { inferenceUrl, useResponsesApi } = resolveGrokEndpoints(opts.endpointUrl, providerType);
    const correlationId = generateCorrelationId(providerType === 'grok' ? 'grok-exec' : 'cust-exec');

    const userContent = opts.jsonMode
      ? `${opts.prompt}\n\nRespond strictly with valid JSON only (no markdown fences).`
      : opts.prompt;

    const inputItems: { role: string; content: string }[] = [];
    if (opts.systemInstruction) {
      inputItems.push({ role: 'system', content: opts.systemInstruction });
    }
    inputItems.push({ role: 'user', content: userContent });

    const body: Record<string, any> = useResponsesApi
      ? {
          model,
          input: inputItems,
          temperature: typeof opts.temperature === 'number' ? opts.temperature : 0.3,
        }
      : {
          model,
          messages: inputItems,
          temperature: typeof opts.temperature === 'number' ? opts.temperature : 0.3,
        };

    if (useResponsesApi) {
      if (opts.jsonMode) {
        body.max_output_tokens = Math.max(opts.maxTokens || 4096, 4096);
        body.text = { format: { type: 'json_object' } };
      } else if (typeof opts.maxTokens === 'number' && opts.maxTokens > 0) {
        body.max_output_tokens = opts.maxTokens;
      }
    } else {
      if (opts.jsonMode) {
        body.max_tokens = Math.max(opts.maxTokens || 4096, 4096);
        body.response_format = { type: 'json_object' };
      } else if (typeof opts.maxTokens === 'number' && opts.maxTokens > 0) {
        body.max_tokens = opts.maxTokens;
      }
    }

    try {
      const response = await fetchWithTimeout(
        inferenceUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cleanKey}`,
          },
          body: JSON.stringify(body),
          signal: opts.signal,
        },
        opts.timeoutMs || 35000
      );

      const rawText = await response.text();
      let parsed: any = {};
      try {
        parsed = rawText ? JSON.parse(rawText) : {};
      } catch {
        throw new ProviderExecutionError(
          classifyProviderError({
            providerType,
            httpStatus: response.status,
            providerMessage: `Provider returned non-JSON HTTP ${response.status}: ${rawText.slice(0, 160)}`,
            model,
            stage: 'inference',
            correlationId,
            secretToRedact: cleanKey,
          })
        );
      }

      if (!response.ok) {
        throw new ProviderExecutionError(
          classifyProviderError({
            providerType,
            httpStatus: response.status,
            providerMessage: parsed?.error?.message || parsed?.error || parsed?.message || `HTTP ${response.status}`,
            providerErrorCode: parsed?.code || parsed?.error?.code,
            model,
            stage: 'inference',
            correlationId,
            secretToRedact: cleanKey,
          })
        );
      }

      const text = useResponsesApi
        ? extractResponsesOutputText(parsed)
        : parsed?.choices?.[0]?.message?.content || '';

      if (!text || !String(text).trim()) {
        throw new ProviderExecutionError(
          classifyProviderError({
            providerType,
            providerMessage: `Empty response payload from ${model}`,
            model,
            stage: 'inference',
            correlationId,
            secretToRedact: cleanKey,
          })
        );
      }

      const finishReason =
        parsed?.status ||
        parsed?.incomplete_details?.reason ||
        parsed?.choices?.[0]?.finish_reason;
      const usage = parsed?.usage || {};
      const promptTokens = usage.input_tokens || usage.prompt_tokens || Math.ceil(opts.prompt.length / 4);
      const completionTokens = usage.output_tokens || usage.completion_tokens || Math.ceil(text.length / 4);
      const totalTokens = usage.total_tokens || promptTokens + completionTokens;

      return {
        text,
        model: parsed?.model || model,
        promptTokens,
        completionTokens,
        totalTokens,
        latencyMs: Date.now() - start,
        finishReason,
      };
    } catch (err: any) {
      if (err instanceof ProviderExecutionError) throw err;
      throw new ProviderExecutionError(
        classifyProviderError({
          providerType,
          err,
          model,
          stage: 'inference',
          correlationId,
          secretToRedact: cleanKey,
        })
      );
    }
  }

  public static async testConnection(
    apiKey: string,
    preferredModel?: string,
    endpointUrl: string = 'https://api.x.ai/v1',
    signal?: AbortSignal,
    runGenerationTest: boolean = true,
    providerType: AIProviderType = 'grok'
  ): Promise<AIValidationResult> {
    const start = Date.now();
    const correlationId = generateCorrelationId('grok-val');
    const { baseUrl } = resolveGrokEndpoints(endpointUrl, providerType);
    let availableModels: AIModelInfo[] = [];
    let selectedModel = (preferredModel || '').trim();

    // Stage 1: Real model list check via GET /v1/models
    try {
      const discovery = await AIModelDiscovery.discoverGrokModels(apiKey, baseUrl, signal);
      availableModels = discovery.models;

      const textModels = availableModels.filter(m => m.supportsTextGeneration);
      if (selectedModel) {
        const found = availableModels.find(m => m.id === selectedModel);
        selectedModel = found ? found.id : selectedModel;
      } else {
        selectedModel = discovery.recommendedModel || textModels[0]?.id || availableModels[0]?.id || '';
      }

      if (!runGenerationTest) {
        return {
          ok: true,
          authenticated: true,
          generationVerified: false,
          connectionStatus: availableModels.length > 0 ? 'untested' : 'error',
          message: `Authenticated with xAI (${availableModels.length} models discovered). Click "Validate & Connect" to verify live /v1/responses generation.`,
          latencyMs: Date.now() - start,
          providerType,
          selectedModel,
          availableModels,
          correlationId: discovery.correlationId,
        };
      }

      if (!selectedModel) {
        const diag = classifyProviderError({
          providerType,
          httpStatus: 404,
          providerMessage: 'No compatible text-generation Grok models were returned by GET /v1/models.',
          stage: 'generation_test',
          authenticated: true,
          correlationId,
        });
        return {
          ok: false,
          authenticated: true,
          generationVerified: false,
          connectionStatus: 'authenticated_generation_unavailable',
          message: diag.diagnosis,
          latencyMs: Date.now() - start,
          providerType,
          selectedModel: '',
          availableModels,
          diagnostic: diag,
          correlationId,
        };
      }
    } catch (err: any) {
      // For custom non-xAI endpoints that don't expose /models, allow direct inference test if user gave an explicit endpoint+model
      const isCustom = providerType === 'custom' || providerType === 'custom_data';
      const status = err instanceof ProviderExecutionError ? err.diagnostic.httpStatus : undefined;
      if (!(isCustom && status === 404 && selectedModel)) {
        const diag =
          err instanceof ProviderExecutionError
            ? err.diagnostic
            : classifyProviderError({
                providerType,
                err,
                stage: 'model_list',
                correlationId,
                secretToRedact: apiKey,
              });
        return {
          ok: false,
          authenticated: false,
          generationVerified: false,
          connectionStatus: diag.connectionStatus,
          message: diag.diagnosis,
          latencyMs: Date.now() - start,
          providerType,
          selectedModel,
          availableModels: [],
          diagnostic: diag,
          correlationId: diag.correlationId,
        };
      }
    }

    // Stage 2: Minimal live generation test via POST /v1/responses
    try {
      const res = await this.execute({
        apiKey,
        model: selectedModel,
        endpointUrl,
        providerType,
        prompt: 'Respond with the exact word: CONNECTED',
        temperature: 0,
        maxTokens: 32,
        signal,
        timeoutMs: 20000,
      });

      return {
        ok: true,
        authenticated: true,
        generationVerified: true,
        connectionStatus: 'connected',
        message: `Connected to xAI (${res.model}) — ${availableModels.length} models discovered, /v1/responses test passed (${res.latencyMs}ms).`,
        latencyMs: Date.now() - start,
        providerType,
        selectedModel: res.model,
        availableModels,
        sampleOutput: res.text.slice(0, 120),
        correlationId,
      };
    } catch (err: any) {
      const baseDiag =
        err instanceof ProviderExecutionError
          ? err.diagnostic
          : classifyProviderError({
              providerType,
              err,
              model: selectedModel,
              stage: 'generation_test',
              authenticated: true,
              correlationId,
              secretToRedact: apiKey,
            });

      // Ensure authenticated flag elevates status to authenticated_generation_unavailable when model list passed
      const diag =
        availableModels.length > 0 && baseDiag.connectionStatus !== 'auth_failed'
          ? {
              ...baseDiag,
              connectionStatus: 'authenticated_generation_unavailable' as const,
              title: baseDiag.title.startsWith('Authenticated')
                ? baseDiag.title
                : `Authenticated — Generation Unavailable (${baseDiag.title})`,
              diagnosis: baseDiag.diagnosis.startsWith('Authenticated')
                ? baseDiag.diagnosis
                : `Authenticated — Generation Unavailable: ${baseDiag.diagnosis}`,
            }
          : baseDiag;

      return {
        ok: false,
        authenticated: availableModels.length > 0,
        generationVerified: false,
        connectionStatus: diag.connectionStatus,
        message: diag.diagnosis,
        latencyMs: Date.now() - start,
        providerType,
        selectedModel,
        availableModels,
        diagnostic: diag,
        correlationId: diag.correlationId,
      };
    }
  }
}
