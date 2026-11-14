/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Google Gemini Provider Adapter (Official v1beta REST + @google/genai SDK)
 */

import { GoogleGenAI } from '@google/genai';
import { AIModelInfo, AIValidationResult } from '../../src/types/index.ts';
import {
  classifyProviderError,
  fetchWithTimeout,
  generateCorrelationId,
  ProviderExecutionError,
} from './AIConnectionValidator.ts';
import { AIModelDiscovery } from './AIModelDiscovery.ts';

export interface AIExecutionOptions {
  apiKey: string;
  model?: string;
  prompt: string;
  systemInstruction?: string;
  jsonMode?: boolean;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface AIExecutionResponse {
  text: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  finishReason?: string;
}

export class GeminiProvider {
  private static createClient(apiKey: string): GoogleGenAI {
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  public static async execute(opts: AIExecutionOptions): Promise<AIExecutionResponse> {
    const cleanKey = (opts.apiKey || '').trim();
    if (!cleanKey) {
      throw new ProviderExecutionError(
        classifyProviderError({
          providerType: 'gemini',
          httpStatus: 401,
          providerMessage: 'Gemini API key is missing.',
          stage: 'inference',
        })
      );
    }

    const start = Date.now();
    const model = (opts.model || '').trim();
    if (!model) {
      throw new ProviderExecutionError(
        classifyProviderError({
          providerType: 'gemini',
          httpStatus: 400,
          providerMessage: 'No Gemini model selected for this credential.',
          stage: 'inference',
        })
      );
    }

    const client = this.createClient(cleanKey);
    const timeoutController = new AbortController();
    const timeoutMs = opts.timeoutMs || 35000;
    const timer = setTimeout(
      () => timeoutController.abort(new Error(`Gemini request timed out after ${timeoutMs}ms`)),
      timeoutMs
    );

    const onCallerAbort = () => timeoutController.abort((opts.signal as any)?.reason || new Error('Aborted'));
    if (opts.signal) {
      if (opts.signal.aborted) {
        clearTimeout(timer);
        throw new Error('Request aborted by caller');
      }
      opts.signal.addEventListener('abort', onCallerAbort, { once: true });
    }

    const config: Record<string, any> = {};
    if (opts.jsonMode) {
      config.responseMimeType = 'application/json';
      config.maxOutputTokens = Math.max(opts.maxTokens || 4096, 4096);
    } else if (typeof opts.maxTokens === 'number' && opts.maxTokens > 0) {
      config.maxOutputTokens = opts.maxTokens;
    }

    // Gemini 4 series models disallow legacy sampling params in strict mode; only pass temperature when needed
    const isGemini4 = model.startsWith('gemini-4-');
    if (!isGemini4 && typeof opts.temperature === 'number') {
      config.temperature = opts.temperature;
    }
    if (opts.systemInstruction) {
      config.systemInstruction = opts.systemInstruction;
    }
    config.abortSignal = timeoutController.signal;

    try {
      const response = await client.models.generateContent({
        model,
        contents: opts.prompt,
        config,
      });

      const firstCandidate = (response as any).candidates?.[0];
      let text = response.text || '';
      if (!text && Array.isArray(firstCandidate?.content?.parts)) {
        text = firstCandidate.content.parts
          .filter((part: any) => !part?.thought && typeof part?.text === 'string')
          .map((part: any) => part.text)
          .join('');
      }

      if (!text.trim()) {
        throw new ProviderExecutionError(
          classifyProviderError({
            providerType: 'gemini',
            providerMessage: `Empty response payload from ${model} (finishReason=${firstCandidate?.finishReason || 'unknown'})`,
            model,
            stage: 'inference',
            secretToRedact: cleanKey,
          })
        );
      }

      const usage = (response as any).usageMetadata || {};
      const promptTokens = usage.promptTokenCount || Math.ceil(opts.prompt.length / 4);
      const completionTokens = usage.candidatesTokenCount || Math.ceil(text.length / 4);
      const totalTokens = usage.totalTokenCount || promptTokens + completionTokens;

      return {
        text,
        model,
        promptTokens,
        completionTokens,
        totalTokens,
        latencyMs: Date.now() - start,
        finishReason: firstCandidate?.finishReason,
      };
    } catch (err: any) {
      if (err instanceof ProviderExecutionError) throw err;
      throw new ProviderExecutionError(
        classifyProviderError({
          providerType: 'gemini',
          err,
          model,
          stage: 'inference',
          secretToRedact: cleanKey,
        })
      );
    } finally {
      clearTimeout(timer);
      if (opts.signal) {
        opts.signal.removeEventListener('abort', onCallerAbort);
      }
    }
  }

  /**
   * Minimal live generateContent test using official v1beta REST endpoint and x-goog-api-key header.
   */
  public static async testGeneration(
    apiKey: string,
    model: string,
    signal?: AbortSignal
  ): Promise<{ text: string; model: string; latencyMs: number; correlationId: string }> {
    const cleanKey = apiKey.trim();
    const correlationId = generateCorrelationId('gem-gen');
    const start = Date.now();
    const cleanModel = model.startsWith('models/') ? model.slice('models/'.length) : model;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:generateContent`;

    try {
      const res = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': cleanKey,
            'User-Agent': 'aistudio-build',
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: 'Respond with the exact word: CONNECTED' }],
              },
            ],
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 128,
            },
          }),
          signal,
        },
        20000
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
            providerMessage: `Malformed non-JSON response from generateContent: ${rawText.slice(0, 120)}`,
            model: cleanModel,
            stage: 'generation_test',
            authenticated: true,
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
            model: cleanModel,
            stage: 'generation_test',
            authenticated: true,
            correlationId,
            secretToRedact: cleanKey,
          })
        );
      }

      const candidate = parsed?.candidates?.[0];
      const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
      const text = parts
        .filter((p: any) => !p?.thought && typeof p?.text === 'string')
        .map((p: any) => p.text)
        .join('')
        .trim();

      if (!text) {
        throw new ProviderExecutionError(
          classifyProviderError({
            providerType: 'gemini',
            providerMessage: `Empty response payload from ${cleanModel} (finishReason=${candidate?.finishReason || 'unknown'})`,
            model: cleanModel,
            stage: 'generation_test',
            authenticated: true,
            correlationId,
            secretToRedact: cleanKey,
          })
        );
      }

      return {
        text,
        model: cleanModel,
        latencyMs: Date.now() - start,
        correlationId,
      };
    } catch (err: any) {
      if (err instanceof ProviderExecutionError) throw err;
      throw new ProviderExecutionError(
        classifyProviderError({
          providerType: 'gemini',
          err,
          model: cleanModel,
          stage: 'generation_test',
          authenticated: true,
          correlationId,
          secretToRedact: cleanKey,
        })
      );
    }
  }

  /**
   * Full validation:
   * 1. GET /v1beta/models (x-goog-api-key header)
   * 2. Select requested model (if accessible) or best discovered generateContent text model
   * 3. Execute minimal live generateContent test
   */
  public static async testConnection(
    apiKey: string,
    preferredModel?: string,
    signal?: AbortSignal,
    runGenerationTest: boolean = true
  ): Promise<AIValidationResult> {
    const start = Date.now();
    const correlationId = generateCorrelationId('gem-val');
    let availableModels: AIModelInfo[] = [];

    // Stage 1: Real model list check
    let selectedModel = (preferredModel || '').trim();
    try {
      const discovery = await AIModelDiscovery.discoverGeminiModels(apiKey, signal);
      availableModels = discovery.models;

      const textModels = availableModels.filter(m => m.supportsTextGeneration);
      const allGenerateCapable = availableModels.filter(m => m.supportedMethods?.includes('generateContent'));

      if (selectedModel) {
        const cleanPref = selectedModel.startsWith('models/') ? selectedModel.slice('models/'.length) : selectedModel;
        const found = availableModels.find(m => m.id === cleanPref);
        if (found) {
          selectedModel = found.id;
        } else if (discovery.recommendedModel) {
          // If requested model isn't in accessible list, still test preferred if explicitly requested or fallback cleanly
          selectedModel = cleanPref;
        }
      } else {
        selectedModel = discovery.recommendedModel || textModels[0]?.id || allGenerateCapable[0]?.id || '';
      }

      if (!runGenerationTest) {
        return {
          ok: true,
          authenticated: true,
          generationVerified: false,
          connectionStatus: availableModels.length > 0 ? 'untested' : 'error',
          message: `Authenticated with Google Gemini (${availableModels.length} models discovered). Click "Validate & Connect" to verify live text generation.`,
          latencyMs: Date.now() - start,
          providerType: 'gemini',
          selectedModel: selectedModel || '',
          availableModels,
          correlationId,
        };
      }

      if (!selectedModel) {
        const diag = classifyProviderError({
          providerType: 'gemini',
          httpStatus: 404,
          providerMessage: 'No models supporting generateContent were returned for this API key.',
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
          providerType: 'gemini',
          selectedModel: '',
          availableModels,
          diagnostic: diag,
          correlationId,
        };
      }
    } catch (err: any) {
      const diag =
        err instanceof ProviderExecutionError
          ? err.diagnostic
          : classifyProviderError({
              providerType: 'gemini',
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
        providerType: 'gemini',
        selectedModel: selectedModel || '',
        availableModels: [],
        diagnostic: diag,
        correlationId: diag.correlationId,
      };
    }

    // Stage 2: Actual live generateContent test
    try {
      const genRes = await this.testGeneration(apiKey, selectedModel, signal);
      return {
        ok: true,
        authenticated: true,
        generationVerified: true,
        connectionStatus: 'connected',
        message: `Connected to Google Gemini (${genRes.model}) — ${availableModels.length} models discovered, live generation verified (${genRes.latencyMs}ms).`,
        latencyMs: Date.now() - start,
        providerType: 'gemini',
        selectedModel: genRes.model,
        availableModels,
        sampleOutput: genRes.text.slice(0, 120),
        correlationId: genRes.correlationId,
      };
    } catch (err: any) {
      const diag =
        err instanceof ProviderExecutionError
          ? err.diagnostic
          : classifyProviderError({
              providerType: 'gemini',
              err,
              model: selectedModel,
              stage: 'generation_test',
              authenticated: true,
              correlationId,
              secretToRedact: apiKey,
            });

      return {
        ok: false,
        authenticated: true,
        generationVerified: false,
        connectionStatus: 'authenticated_generation_unavailable',
        message: diag.diagnosis,
        latencyMs: Date.now() - start,
        providerType: 'gemini',
        selectedModel,
        availableModels,
        diagnostic: diag,
        correlationId: diag.correlationId,
      };
    }
  }
}
