/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — xAI Grok & Custom OpenAI-Compatible Provider Adapter
 */

import { AIExecutionOptions, AIExecutionResponse } from './GeminiProvider.ts';

export const GROK_SUPPORTED_MODELS = ['grok-3', 'grok-3-mini', 'grok-3-fast'];

export class GrokProvider {
  public static async execute(
    opts: AIExecutionOptions & { endpointUrl?: string }
  ): Promise<AIExecutionResponse> {
    if (!opts.apiKey || !opts.apiKey.trim()) {
      throw new Error('Grok / Custom provider API key is missing.');
    }

    const start = Date.now();
    const model = (opts.model || 'grok-3-mini').trim();
    const endpoint = (opts.endpointUrl || 'https://api.x.ai/v1/chat/completions').trim();

    const messages: { role: string; content: string }[] = [];
    if (opts.systemInstruction) {
      messages.push({ role: 'system', content: opts.systemInstruction });
    }
    messages.push({
      role: 'user',
      content: opts.jsonMode
        ? `${opts.prompt}\n\nRespond strictly with valid JSON only (no markdown fences).`
        : opts.prompt,
    });

    const body: Record<string, any> = {
      model,
      messages,
      temperature: typeof opts.temperature === 'number' ? opts.temperature : 0.3,
    };

    if (opts.jsonMode) {
      body.max_tokens = Math.max(opts.maxTokens || 4096, 4096);
      body.response_format = { type: 'json_object' };
    } else if (typeof opts.maxTokens === 'number' && opts.maxTokens > 0) {
      body.max_tokens = opts.maxTokens;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.apiKey.trim()}`,
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });

    const rawText = await response.text();
    let parsed: any = {};
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error(`Provider returned non-JSON HTTP ${response.status}: ${rawText.slice(0, 180)}`);
    }

    if (!response.ok) {
      const errMsg = parsed?.error?.message || parsed?.message || `HTTP ${response.status}`;
      throw new Error(`Provider API error (${response.status}): ${errMsg}`);
    }

    const text = parsed?.choices?.[0]?.message?.content || '';
    const finishReason = parsed?.choices?.[0]?.finish_reason;
    const usage = parsed?.usage || {};
    const promptTokens = usage.prompt_tokens || Math.ceil(opts.prompt.length / 4);
    const completionTokens = usage.completion_tokens || Math.ceil(text.length / 4);
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
  }

  public static async testConnection(
    apiKey: string,
    model: string = 'grok-3-mini',
    endpointUrl: string = 'https://api.x.ai/v1/chat/completions'
  ): Promise<{ ok: boolean; message: string; latencyMs: number; modelTested: string }> {
    const start = Date.now();
    try {
      const res = await this.execute({
        apiKey,
        model: model || 'grok-3-mini',
        endpointUrl,
        prompt: 'Reply with OK.',
        temperature: 0,
        maxTokens: 8,
      });
      return {
        ok: true,
        message: `Connected to ${res.model} (${res.latencyMs}ms)`,
        latencyMs: res.latencyMs,
        modelTested: res.model,
      };
    } catch (err: any) {
      return {
        ok: false,
        message: err?.message || 'Grok / Custom API connection failed.',
        latencyMs: Date.now() - start,
        modelTested: model,
      };
    }
  }
}
