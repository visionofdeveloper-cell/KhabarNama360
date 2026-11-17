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
  getGenerationTimeoutMs,
  getInferenceTimeoutMs,
  ProviderExecutionError,
  sleepWithAbort,
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
    const timeoutMs = opts.timeoutMs || getInferenceTimeoutMs();
    const timer = setTimeout(
      () => {
        const timeoutErr = new Error(`Gemini request timed out after ${timeoutMs}ms`);
        timeoutErr.name = 'TimeoutError';
        timeoutController.abort(timeoutErr);
      },
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

    const isGemini4 = model.startsWith('gemini-4-');
    const isGemini3 = model.startsWith('gemini-3');
    const isGemini25 = model.startsWith('gemini-2.5');
    if (!isGemini4 && !isGemini3 && typeof opts.temperature === 'number') {
      config.temperature = opts.temperature;
    }
    if (isGemini4 && (!opts.maxTokens || opts.maxTokens <= 4096)) {
      config.thinkingConfig = { thinkingLevel: 'LOW' };
    } else if (isGemini3 && opts.jsonMode && model.includes('flash-lite')) {
      config.thinkingConfig = { thinkingLevel: 'MINIMAL' };
    } else if (isGemini25 && model.includes('flash') && opts.maxTokens && opts.maxTokens <= 1024) {
      config.thinkingConfig = { thinkingBudget: 0 };
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
   * Uses a configurable 45000-60000ms window, tiny prompt ("Reply with OK."), minimal thinking,
   * and at most one bounded jittered retry on transient timeout/5xx within remaining budget.
   */
  public static async testGeneration(
    apiKey: string,
    model: string,
    signal?: AbortSignal,
    options?: { timeoutMs?: number; retryOnTransient?: boolean; deadlineMs?: number }
  ): Promise<{
    text: string;
    model: string;
    latencyMs: number;
    correlationId: string;
    retried: boolean;
    finishReason?: string;
    tokenUsage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  }> {
    const cleanKey = apiKey.trim();
    const correlationId = generateCorrelationId('gem-gen');
    const overallStart = Date.now();
    const cleanModel = model.startsWith('models/') ? model.slice('models/'.length) : model;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:generateContent`;

    const configuredTimeoutMs = options?.timeoutMs
      ? Math.max(15000, Math.min(60000, options.timeoutMs))
      : getGenerationTimeoutMs();
    const deadlineMs = options?.deadlineMs || (overallStart + Math.min(58000, configuredTimeoutMs + 10000));
    const allowRetry = options?.retryOnTransient !== false;

    const isGemini4 = cleanModel.startsWith('gemini-4-');
    const isGemini3 = cleanModel.startsWith('gemini-3');
    const isGemini25 = cleanModel.startsWith('gemini-2.5');
    const generationConfig: Record<string, any> = {
      maxOutputTokens: isGemini25 && cleanModel.includes('pro') ? 256 : 32,
    };
    if (isGemini4) {
      // Gemini 4 supports LOW (MINIMAL returns 400 on gemini-4-*)
      generationConfig.thinkingConfig = { thinkingLevel: 'LOW' };
    } else if (isGemini3) {
      generationConfig.thinkingConfig = {
        thinkingLevel: cleanModel.includes('flash') ? 'MINIMAL' : 'LOW',
      };
    } else if (isGemini25) {
      generationConfig.thinkingConfig = {
        thinkingBudget: cleanModel.includes('pro') ? 128 : 0,
      };
    } else {
      generationConfig.temperature = 0;
    }

    const executeSingleAttempt = async (attemptTimeoutMs: number, retried: boolean) => {
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
                parts: [{ text: 'Reply with OK.' }],
              },
            ],
            generationConfig,
          }),
          signal,
        },
        attemptTimeoutMs
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
            timeoutWindowMs: attemptTimeoutMs,
            retried,
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
            timeoutWindowMs: attemptTimeoutMs,
            retried,
          })
        );
      }

      const candidate = parsed?.candidates?.[0];
      const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
      const nonThoughtText = parts
        .filter((p: any) => !p?.thought && typeof p?.text === 'string')
        .map((p: any) => p.text)
        .join('')
        .trim();
      const anyText = parts
        .filter((p: any) => typeof p?.text === 'string')
        .map((p: any) => p.text)
        .join('')
        .trim();
      const text = nonThoughtText || anyText;

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
            timeoutWindowMs: attemptTimeoutMs,
            retried,
          })
        );
      }

      const usage = parsed?.usageMetadata || {};
      return {
        text,
        model: cleanModel,
        latencyMs: Date.now() - overallStart,
        correlationId,
        retried,
        finishReason: candidate?.finishReason,
        tokenUsage: {
          promptTokens: usage.promptTokenCount,
          completionTokens: usage.candidatesTokenCount,
          totalTokens: usage.totalTokenCount,
        },
      };
    };

    try {
      const remainingFirst = Math.max(15000, Math.min(configuredTimeoutMs, deadlineMs - Date.now()));
      return await executeSingleAttempt(remainingFirst, false);
    } catch (firstErr: any) {
      if (signal?.aborted) {
        throw firstErr;
      }
      const firstDiag =
        firstErr instanceof ProviderExecutionError
          ? firstErr.diagnostic
          : classifyProviderError({
              providerType: 'gemini',
              err: firstErr,
              model: cleanModel,
              stage: 'generation_test',
              authenticated: true,
              correlationId,
              secretToRedact: cleanKey,
              timeoutWindowMs: configuredTimeoutMs,
            });

      const isTransientRetryable =
        firstDiag.category === 'timeout' || firstDiag.category === 'server_error_5xx';
      const remainingBeforeBackoff = deadlineMs - Date.now();

      // Only retry once on transient timeout/5xx if at least 10s remains inside proxy ceiling
      if (allowRetry && isTransientRetryable && remainingBeforeBackoff > 10000) {
        const backoffMs = 600 + Math.floor(Math.random() * 400);
        await sleepWithAbort(backoffMs, signal);
        const remainingSecond = Math.max(8000, Math.min(configuredTimeoutMs, deadlineMs - Date.now()));
        try {
          return await executeSingleAttempt(remainingSecond, true);
        } catch (secondErr: any) {
          if (secondErr instanceof ProviderExecutionError) {
            throw new ProviderExecutionError({ ...secondErr.diagnostic, retried: true });
          }
          throw new ProviderExecutionError(
            classifyProviderError({
              providerType: 'gemini',
              err: secondErr,
              model: cleanModel,
              stage: 'generation_test',
              authenticated: true,
              correlationId,
              secretToRedact: cleanKey,
              timeoutWindowMs: remainingSecond,
              retried: true,
            })
          );
        }
      }

      if (firstErr instanceof ProviderExecutionError) throw firstErr;
      throw new ProviderExecutionError(firstDiag);
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
      const genDiag =
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
              timeoutWindowMs: getGenerationTimeoutMs(),
            });

      const preservedStatus =
        genDiag.connectionStatus === 'timeout' ||
        genDiag.connectionStatus === 'quota_exhausted' ||
        genDiag.connectionStatus === 'billing_required' ||
        genDiag.connectionStatus === 'permission_denied' ||
        genDiag.connectionStatus === 'endpoint_not_found'
          ? genDiag.connectionStatus
          : 'authenticated_generation_unavailable';

      return {
        ok: false,
        authenticated: true,
        generationVerified: false,
        connectionStatus: preservedStatus,
        message: genDiag.diagnosis,
        latencyMs: Date.now() - start,
        providerType: 'gemini',
        selectedModel,
        availableModels,
        diagnostic: { ...genDiag, connectionStatus: preservedStatus },
        correlationId: genDiag.correlationId,
      };
    }
  }
}
