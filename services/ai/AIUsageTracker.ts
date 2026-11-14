/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — AI Usage Tracker, Token Accounting & Budget Guard
 */

import { db } from '../../src/server/db.ts';
import { AIProviderCredential, AIProviderType, AIUsageLog, AITaskType } from '../../src/types/index.ts';

const MODEL_PRICING_PER_1M: Record<string, { input: number; output: number }> = {
  'gemini-4-hydrogen': { input: 0.15, output: 0.60 },
  'gemini-3.1-flash-lite': { input: 0.075, output: 0.30 },
  'gemini-4-argon': { input: 1.25, output: 5.00 },
  'gemini-4-carbon': { input: 2.50, output: 10.00 },
  'gemini-2.5-flash': { input: 0.15, output: 0.60 },
  'gemini-2.5-flash-lite': { input: 0.075, output: 0.30 },
  'gemini-2.0-flash': { input: 0.10, output: 0.40 },
  'gemini-2.0-flash-lite': { input: 0.075, output: 0.30 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'grok-3-mini': { input: 0.30, output: 0.50 },
  'grok-3-fast': { input: 5.00, output: 15.00 },
  'grok-3': { input: 3.00, output: 15.00 },
};

export class AIUsageTracker {
  public static estimateCostUsd(model: string, promptTokens: number, completionTokens: number): number {
    const rate = MODEL_PRICING_PER_1M[model] || { input: 0.50, output: 1.50 };
    const inputCost = (promptTokens / 1_000_000) * rate.input;
    const outputCost = (completionTokens / 1_000_000) * rate.output;
    return parseFloat((inputCost + outputCost).toFixed(6));
  }

  public static checkBudget(cred: AIProviderCredential): { allowed: boolean; reason?: string } {
    if (!cred.enabled) {
      return { allowed: false, reason: `Credential "${cred.label}" is disabled.` };
    }
    if (cred.dailyTokenLimit > 0 && (cred.dailyTokensUsed || 0) >= cred.dailyTokenLimit) {
      return {
        allowed: false,
        reason: `Daily token limit reached for "${cred.label}" (${cred.dailyTokensUsed.toLocaleString()} / ${cred.dailyTokenLimit.toLocaleString()}).`,
      };
    }
    if (cred.monthlyBudgetUsd > 0 && (cred.monthlySpendUsd || 0) >= cred.monthlyBudgetUsd) {
      return {
        allowed: false,
        reason: `Monthly USD budget reached for "${cred.label}" ($${cred.monthlySpendUsd.toFixed(2)} / $${cred.monthlyBudgetUsd.toFixed(2)}).`,
      };
    }
    return { allowed: true };
  }

  public static record(params: {
    task: AITaskType | string;
    credentialId: string;
    providerType: AIProviderType;
    projectId: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    latencyMs: number;
    status: 'success' | 'error';
    errorMessage?: string;
    actor: string;
  }): AIUsageLog {
    const totalTokens = (params.promptTokens || 0) + (params.completionTokens || 0);
    const estimatedCostUsd =
      params.status === 'success'
        ? this.estimateCostUsd(params.model, params.promptTokens, params.completionTokens)
        : 0;

    const entry: AIUsageLog = {
      id: `aiuse-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      task: params.task,
      credentialId: params.credentialId,
      providerType: params.providerType,
      projectId: params.projectId,
      model: params.model,
      promptTokens: params.promptTokens || 0,
      completionTokens: params.completionTokens || 0,
      totalTokens,
      estimatedCostUsd,
      latencyMs: params.latencyMs,
      status: params.status,
      errorMessage: params.errorMessage,
      actor: params.actor,
    };

    db.recordAiUsage(entry);
    return entry;
  }

  public static getSummary() {
    const logs = db.getAiUsageLogs(500);
    const now = Date.now();
    const dayAgo = now - 24 * 3600 * 1000;
    const recent24h = logs.filter(l => new Date(l.timestamp).getTime() >= dayAgo);

    return {
      totalRequests: logs.length,
      requests24h: recent24h.length,
      tokens24h: recent24h.reduce((s, l) => s + (l.totalTokens || 0), 0),
      totalCostUsd: parseFloat(logs.reduce((s, l) => s + (l.estimatedCostUsd || 0), 0).toFixed(4)),
      errorRatePercent:
        logs.length > 0
          ? parseFloat(((logs.filter(l => l.status === 'error').length / logs.length) * 100).toFixed(1))
          : 0,
      logs: logs.slice(0, 100),
    };
  }
}
