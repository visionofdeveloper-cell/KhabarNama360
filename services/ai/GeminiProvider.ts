/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Google Gemini Provider Adapter (@google/genai)
 */

import { GoogleGenAI } from '@google/genai';

export interface AIExecutionOptions {
  apiKey: string;
  model?: string;
  prompt: string;
  systemInstruction?: string;
  jsonMode?: boolean;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
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

export const GEMINI_SUPPORTED_MODELS = [
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
  'gemini-4-argon',
  'gemini-4-carbon',
  'gemini-2.5-flash',
];

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
    if (!opts.apiKey || !opts.apiKey.trim()) {
      throw new Error('Gemini API key is missing.');
    }

    const start = Date.now();
    const model = (opts.model || 'gemini-4-hydrogen').trim();
    const client = this.createClient(opts.apiKey.trim());

    const config: Record<string, any> = {};
    if (opts.jsonMode) {
      config.responseMimeType = 'application/json';
    }
    if (typeof opts.temperature === 'number') {
      config.temperature = opts.temperature;
    }
    if (opts.jsonMode) {
      // Ensure sufficient output tokens for bilingual Urdu/English JSON + any internal reasoning overhead
      config.maxOutputTokens = Math.max(opts.maxTokens || 4096, 4096);
    } else if (typeof opts.maxTokens === 'number' && opts.maxTokens > 0) {
      config.maxOutputTokens = opts.maxTokens;
    }
    if (opts.systemInstruction) {
      config.systemInstruction = opts.systemInstruction;
    }
    if (opts.signal) {
      config.abortSignal = opts.signal;
    }

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
  }

  public static async testConnection(apiKey: string, model: string = 'gemini-4-hydrogen'): Promise<{
    ok: boolean;
    message: string;
    latencyMs: number;
    modelTested: string;
  }> {
    const start = Date.now();
    try {
      const res = await this.execute({
        apiKey,
        model: model || 'gemini-4-hydrogen',
        prompt: 'Reply with OK.',
        temperature: 0,
        maxTokens: 8,
      });
      if (!res.text) {
        return {
          ok: false,
          message: 'Gemini responded with an empty payload.',
          latencyMs: Date.now() - start,
          modelTested: model,
        };
      }
      return {
        ok: true,
        message: `Connected to ${res.model} (${res.latencyMs}ms)`,
        latencyMs: res.latencyMs,
        modelTested: res.model,
      };
    } catch (err: any) {
      return {
        ok: false,
        message: err?.message || 'Gemini API connection failed.',
        latencyMs: Date.now() - start,
        modelTested: model,
      };
    }
  }
}
