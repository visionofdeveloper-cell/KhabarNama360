/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Centralized Multi-Provider AI Router & Key Safeguarding
 *
 * Security & Policy Rules:
 * - API keys are encrypted at rest via AES-256-GCM and decrypted only server-side at execution.
 * - NEVER rotates or cycles through multiple keys sharing the same projectId to evade rate limits.
 * - Fallback is allowed only to an explicitly different projectId or providerType.
 * - Throws structured errors when unconfigured or failing — never returns fabricated fallbacks.
 */

import { db } from '../../src/server/db.ts';
import {
  AIConnectionStatus,
  AIDiagnosticError,
  AIProviderCredential,
  AIProviderType,
  AITaskRouting,
  AITaskType,
} from '../../src/types/index.ts';
import { GeminiProvider, AIExecutionResponse } from './GeminiProvider.ts';
import { GrokProvider } from './GrokProvider.ts';
import { AIUsageTracker } from './AIUsageTracker.ts';
import { AIProviderManager } from './AIProviderManager.ts';
import {
  classifyProviderError,
  ProviderExecutionError,
} from './AIConnectionValidator.ts';
import { maskSecret } from '../../src/server/crypto.ts';

export class AIUnavailableError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly diagnostic?: AIDiagnosticError;

  constructor(
    message: string,
    statusCode: number = 503,
    code: string = 'AI_UNAVAILABLE',
    diagnostic?: AIDiagnosticError
  ) {
    super(message);
    this.name = 'AIUnavailableError';
    this.statusCode = statusCode;
    this.code = code;
    this.diagnostic = diagnostic;
  }
}

export const AI_TASK_CATALOG: { task: AITaskType; label: string; defaultModel: string }[] = [
  { task: 'headline_generation', label: 'Headline Suggestions', defaultModel: 'gemini-3.5-flash-lite' },
  { task: 'translation', label: 'English <-> Urdu Translation', defaultModel: 'gemini-3.5-flash' },
  { task: 'seo_metadata', label: 'SEO Tags, Slugs & Meta Generation', defaultModel: 'gemini-3.5-flash-lite' },
  { task: 'article_drafting', label: 'Full Article Drafting', defaultModel: 'gemini-3.5-flash' },
  { task: 'summarization', label: 'Article & Feed Summarization', defaultModel: 'gemini-3.5-flash-lite' },
  { task: 'content_rewriting', label: 'Rewrite & Tone Adjustment', defaultModel: 'gemini-3.5-flash' },
  { task: 'breaking_alerts', label: 'Breaking News & Market Alert Summaries', defaultModel: 'gemini-3.5-flash-lite' },
  { task: 'public_qa', label: 'Ask Khabarnama Public Q&A', defaultModel: 'gemini-3.5-flash-lite' },
  { task: 'category_tagging', label: 'Category Classification & Tagging', defaultModel: 'gemini-3.5-flash-lite' },
  { task: 'fact_check_prep', label: 'Editorial Quality & Fact-Check Prep', defaultModel: 'gemini-3.5-flash' },
  { task: 'newsletter_social', label: 'Newsletter & Social Media Copy', defaultModel: 'gemini-3.5-flash-lite' },
];

export class AIProviderRouter {
  public static getAllCredentialsSanitized() {
    const dbCreds = db.getAiProviders();
    const routes = this.getTaskRoutesRaw(dbCreds);
    const list = dbCreds.map(c => AIProviderManager.sanitizeCredential(c, routes));

    const hasEnvGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());
    const hasEnvGrok = Boolean(process.env.XAI_API_KEY && process.env.XAI_API_KEY.trim());

    if (hasEnvGemini && !dbCreds.some(c => c.id === 'env-gemini-default')) {
      list.unshift(
        AIProviderManager.sanitizeCredential(
          {
            id: 'env-gemini-default',
            providerType: 'gemini',
            label: 'Server Environment GEMINI_API_KEY',
            projectId: process.env.GOOGLE_CLOUD_PROJECT || 'env-gemini-project',
            model: 'gemini-3.5-flash-lite',
            encryptedSecret: '',
            maskedKey: maskSecret(process.env.GEMINI_API_KEY!),
            enabled: true,
            priority: 1,
            dailyTokenLimit: 1000000,
            dailyTokensUsed: 0,
            monthlyBudgetUsd: 50,
            monthlySpendUsd: 0,
            connectionStatus: 'untested',
            modelListStatus: 'untested',
            generationTestStatus: 'untested',
            lastTestedAt: null,
            lastTestStatus: 'untested',
            lastTestMessage: 'Loaded from server environment secret (click Test to verify live models)',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          routes
        )
      );
    }

    if (hasEnvGrok && !dbCreds.some(c => c.id === 'env-grok-default')) {
      list.push(
        AIProviderManager.sanitizeCredential(
          {
            id: 'env-grok-default',
            providerType: 'grok',
            label: 'Server Environment XAI_API_KEY',
            projectId: 'env-xai-project',
            endpointUrl: 'https://api.x.ai/v1',
            model: 'grok-3-mini',
            encryptedSecret: '',
            maskedKey: maskSecret(process.env.XAI_API_KEY!),
            enabled: true,
            priority: 2,
            dailyTokenLimit: 500000,
            dailyTokensUsed: 0,
            monthlyBudgetUsd: 50,
            monthlySpendUsd: 0,
            connectionStatus: 'untested',
            modelListStatus: 'untested',
            generationTestStatus: 'untested',
            lastTestedAt: null,
            lastTestStatus: 'untested',
            lastTestMessage: 'Loaded from server environment secret (click Test to verify live models)',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          routes
        )
      );
    }

    return list;
  }

  private static getTaskRoutesRaw(dbCreds: AIProviderCredential[]): AITaskRouting[] {
    const saved = db.getAiTaskRoutes();
    const defaultCred = dbCreds.find(c => c.enabled);
    const defaultCredId = defaultCred?.id || '';
    const defaultModel = defaultCred?.model || '';

    return AI_TASK_CATALOG.map(spec => {
      const existing = saved[spec.task];
      if (existing) return existing;
      return {
        task: spec.task,
        label: spec.label,
        primaryCredentialId: defaultCredId,
        primaryModel: defaultModel || spec.defaultModel,
        fallbackCredentialId: '',
        fallbackModel: '',
        temperature: spec.task === 'fact_check_prep' || spec.task === 'translation' ? 0.2 : 0.5,
        maxTokens: spec.task === 'article_drafting' ? 4096 : 3072,
      };
    });
  }

  public static addOrUpdateCredential(
    input: Parameters<typeof AIProviderManager.addOrUpdateCredential>[0],
    actor: string
  ): AIProviderCredential {
    return AIProviderManager.addOrUpdateCredential(input, actor);
  }

  public static async testCredential(credId: string, actor: string) {
    return AIProviderManager.testSavedCredential(credId, actor);
  }

  public static getTaskRoutes(): AITaskRouting[] {
    const saved = db.getAiTaskRoutes();
    const creds = this.getAllCredentialsSanitized();
    const defaultCred = creds.find((c: any) => c.enabled && c.connectionStatus === 'connected') || creds.find((c: any) => c.enabled);

    return AI_TASK_CATALOG.map(spec => {
      const existing = saved[spec.task];
      if (existing) return existing;
      return {
        task: spec.task,
        label: spec.label,
        primaryCredentialId: defaultCred?.id || '',
        primaryModel: defaultCred?.model || spec.defaultModel,
        fallbackCredentialId: '',
        fallbackModel: '',
        temperature: spec.task === 'fact_check_prep' || spec.task === 'translation' ? 0.2 : 0.5,
        maxTokens: spec.task === 'article_drafting' ? 4096 : 3072,
      };
    });
  }

  /**
   * Executes an AI task through the configured router & safeguards.
   */
  public static async executeTask(params: {
    task: AITaskType;
    prompt: string;
    systemInstruction?: string;
    jsonMode?: boolean;
    preferredProviderId?: string;
    preferredModel?: string;
    temperature?: number;
    maxTokens?: number;
    actor?: string;
    signal?: AbortSignal;
  }): Promise<AIExecutionResponse & { credentialId: string; providerType: AIProviderType; projectId: string }> {
    const actor = params.actor || 'System';
    const routes = this.getTaskRoutes();
    const route = routes.find(r => r.task === params.task);
    const allSanitized = this.getAllCredentialsSanitized().filter((c: any) => c.enabled);

    if (allSanitized.length === 0) {
      throw new AIUnavailableError(
        'No active AI API provider is configured. Open Admin -> Settings -> AI & API Providers to validate and connect a Gemini or Grok key.',
        503,
        'NO_AI_KEY'
      );
    }

    // Build ordered candidate list respecting projectId isolation (no multi-key bypass on same projectId!)
    const candidateSpecs: { credId: string; modelOverride?: string }[] = [];
    if (params.preferredProviderId) {
      candidateSpecs.push({ credId: params.preferredProviderId, modelOverride: params.preferredModel });
    }
    if (route?.primaryCredentialId) {
      candidateSpecs.push({
        credId: route.primaryCredentialId,
        modelOverride: params.preferredModel || route.primaryModel,
      });
    }
    if (route?.fallbackCredentialId) {
      candidateSpecs.push({
        credId: route.fallbackCredentialId,
        modelOverride: route.fallbackModel,
      });
    }

    // Prefer already verified/connected credentials next, sorted by priority
    const sortedRemaining = [...allSanitized].sort((a: any, b: any) => {
      const aConn = a.connectionStatus === 'connected' ? 0 : 1;
      const bConn = b.connectionStatus === 'connected' ? 0 : 1;
      if (aConn !== bConn) return aConn - bConn;
      return (a.priority || 10) - (b.priority || 10);
    });

    for (const c of sortedRemaining) {
      if (!candidateSpecs.some(x => x.credId === c.id)) {
        candidateSpecs.push({ credId: c.id, modelOverride: params.preferredModel || c.model });
      }
    }

    const attemptedProjectKeys = new Set<string>();
    const errors: string[] = [];
    let lastDiagnostic: AIDiagnosticError | undefined;

    for (const spec of candidateSpecs) {
      const resolved = AIProviderManager.resolveRawCredential(spec.credId);
      if (!resolved || !resolved.cred.enabled) continue;
      const { cred, rawKey } = resolved;

      // Enforce single-project isolation: never rotate keys inside the same provider+projectId
      const projectSignature = `${cred.providerType}:${cred.projectId.toLowerCase()}`;
      if (attemptedProjectKeys.has(projectSignature)) {
        continue;
      }

      const budgetCheck = AIUsageTracker.checkBudget(cred);
      if (!budgetCheck.allowed) {
        errors.push(budgetCheck.reason || 'Budget limit exceeded');
        continue;
      }

      attemptedProjectKeys.add(projectSignature);
      const modelToUse = spec.modelOverride || cred.model;

      const effectiveMaxTokens = params.jsonMode
        ? Math.max(params.maxTokens ?? route?.maxTokens ?? 4096, 4096)
        : (params.maxTokens ?? route?.maxTokens);

      try {
        const execResult =
          cred.providerType === 'gemini'
            ? await GeminiProvider.execute({
                apiKey: rawKey,
                model: modelToUse,
                prompt: params.prompt,
                systemInstruction: params.systemInstruction,
                jsonMode: params.jsonMode,
                temperature: params.temperature ?? route?.temperature,
                maxTokens: effectiveMaxTokens,
                signal: params.signal,
              })
            : await GrokProvider.execute({
                apiKey: rawKey,
                model: modelToUse,
                endpointUrl: cred.endpointUrl,
                providerType: cred.providerType,
                prompt: params.prompt,
                systemInstruction: params.systemInstruction,
                jsonMode: params.jsonMode,
                temperature: params.temperature ?? route?.temperature,
                maxTokens: effectiveMaxTokens,
                signal: params.signal,
              });

        const now = new Date().toISOString();
        if (cred.id !== 'env-gemini-default' && cred.id !== 'env-grok-default') {
          db.upsertAiProvider(
            {
              ...cred,
              connectionStatus: 'connected',
              generationTestStatus: 'ok',
              lastTestStatus: 'connected',
              lastSuccessfulGenerationAt: now,
              lastLatencyMs: execResult.latencyMs,
              updatedAt: now,
            },
            actor
          );
        }

        AIUsageTracker.record({
          task: params.task,
          credentialId: cred.id,
          providerType: cred.providerType,
          projectId: cred.projectId,
          model: execResult.model,
          promptTokens: execResult.promptTokens,
          completionTokens: execResult.completionTokens,
          latencyMs: execResult.latencyMs,
          status: 'success',
          actor,
        });

        return {
          ...execResult,
          credentialId: cred.id,
          providerType: cred.providerType,
          projectId: cred.projectId,
        };
      } catch (err: any) {
        if (params.signal?.aborted) {
          throw new AIUnavailableError('Generation request cancelled by user.', 499, 'ABORTED');
        }

        const diag =
          err instanceof ProviderExecutionError
            ? err.diagnostic
            : classifyProviderError({
                providerType: cred.providerType,
                err,
                model: modelToUse,
                stage: 'inference',
                authenticated: cred.modelListStatus === 'ok',
                secretToRedact: rawKey,
              });

        lastDiagnostic = diag;
        errors.push(`[${cred.label} | ${diag.correlationId}] ${diag.diagnosis}`);

        if (cred.id !== 'env-gemini-default' && cred.id !== 'env-grok-default') {
          const now = new Date().toISOString();
          const nextStatus: AIConnectionStatus =
            cred.modelListStatus === 'ok' && diag.connectionStatus !== 'auth_failed'
              ? 'authenticated_generation_unavailable'
              : diag.connectionStatus;
          db.upsertAiProvider(
            {
              ...cred,
              connectionStatus: nextStatus,
              generationTestStatus: 'error',
              lastFailureAt: now,
              lastTestStatus: 'error',
              lastTestMessage: diag.diagnosis,
              lastDiagnostic: diag,
              lastCorrelationId: diag.correlationId,
              updatedAt: now,
            },
            actor
          );
        }

        AIUsageTracker.record({
          task: params.task,
          credentialId: cred.id,
          providerType: cred.providerType,
          projectId: cred.projectId,
          model: modelToUse,
          promptTokens: 0,
          completionTokens: 0,
          latencyMs: 0,
          status: 'error',
          errorMessage: `[${diag.correlationId}] ${diag.diagnosis}`,
          correlationId: diag.correlationId,
          actor,
        });
      }
    }

    throw new AIUnavailableError(
      errors.length > 0 ? errors.join(' | ') : 'All configured AI providers failed or exceeded quota.',
      lastDiagnostic?.httpStatus && lastDiagnostic.httpStatus >= 400 && lastDiagnostic.httpStatus < 600
        ? lastDiagnostic.httpStatus
        : 502,
      lastDiagnostic?.category?.toUpperCase() || 'AI_PROVIDER_FAILED',
      lastDiagnostic
    );
  }

  private static extractBalancedJson(input: string): string | null {
    const startObj = input.indexOf('{');
    const startArr = input.indexOf('[');
    let start = -1;
    let openChar = '{';
    let closeChar = '}';

    if (startObj !== -1 && (startArr === -1 || startObj < startArr)) {
      start = startObj;
      openChar = '{';
      closeChar = '}';
    } else if (startArr !== -1) {
      start = startArr;
      openChar = '[';
      closeChar = ']';
    }

    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < input.length; i++) {
      const ch = input[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\' && inString) {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (ch === openChar) depth++;
        else if (ch === closeChar) {
          depth--;
          if (depth === 0) {
            return input.slice(start, i + 1);
          }
        }
      }
    }
    return null;
  }

  private static sanitizeControlCharsInStrings(jsonText: string): string {
    let out = '';
    let inString = false;
    let escaped = false;
    for (let i = 0; i < jsonText.length; i++) {
      const ch = jsonText[i];
      if (escaped) {
        out += ch;
        escaped = false;
        continue;
      }
      if (ch === '\\' && inString) {
        out += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        out += ch;
        continue;
      }
      if (inString) {
        if (ch === '\n') {
          out += '\\n';
          continue;
        }
        if (ch === '\r') {
          out += '\\r';
          continue;
        }
        if (ch === '\t') {
          out += '\\t';
          continue;
        }
      }
      out += ch;
    }
    return out;
  }

  public static parseJsonPayload<T = any>(rawText: string): T {
    let clean = (rawText || '').replace(/^\uFEFF/, '').trim();
    if (!clean) {
      throw new Error('Empty response text');
    }

    try {
      return JSON.parse(clean) as T;
    } catch {
      // Continue to fenced / balanced extraction
    }

    const fencedMatch = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fencedMatch && fencedMatch[1]) {
      clean = fencedMatch[1].trim();
      try {
        return JSON.parse(clean) as T;
      } catch {
        // Continue
      }
    }

    const balanced = this.extractBalancedJson(clean) || this.extractBalancedJson(rawText) || clean;
    const candidates = [
      balanced,
      balanced.replace(/,\s*([}\]])/g, '$1'),
      this.sanitizeControlCharsInStrings(balanced),
      this.sanitizeControlCharsInStrings(balanced).replace(/,\s*([}\]])/g, '$1'),
    ];

    for (const candidate of candidates) {
      try {
        return JSON.parse(candidate) as T;
      } catch {
        // Try next normalization
      }
    }

    throw new Error('Unable to parse JSON payload');
  }

  public static async executeJsonTask<T = any>(params: Parameters<typeof AIProviderRouter.executeTask>[0]): Promise<{
    data: T;
    meta: {
      credentialId: string;
      providerType: AIProviderType;
      projectId: string;
      model: string;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      latencyMs: number;
    };
  }> {
    const strictJsonSuffix =
      'Return ONLY a single valid RFC-8599 JSON object (or array if requested) with properly escaped strings and no markdown fences or surrounding commentary.';
    const baseSystem = params.systemInstruction
      ? `${params.systemInstruction}\n${strictJsonSuffix}`
      : strictJsonSuffix;

    let res = await this.executeTask({
      ...params,
      systemInstruction: baseSystem,
      jsonMode: true,
    });

    let parsed: T;
    try {
      parsed = this.parseJsonPayload<T>(res.text);
    } catch {
      if (params.signal?.aborted) {
        throw new AIUnavailableError('Generation request cancelled by user.', 499, 'ABORTED');
      }
      res = await this.executeTask({
        ...params,
        systemInstruction: baseSystem,
        jsonMode: true,
        temperature: 0.1,
        maxTokens: Math.max(params.maxTokens || 4096, 8192),
      });
      try {
        parsed = this.parseJsonPayload<T>(res.text);
      } catch {
        const reason = res.finishReason ? `finishReason=${res.finishReason}` : 'malformed output';
        throw new AIUnavailableError(
          `AI provider returned invalid JSON payload from ${res.model} (${reason}). Please retry.`,
          502,
          'INVALID_AI_JSON'
        );
      }
    }

    return {
      data: parsed,
      meta: {
        credentialId: res.credentialId,
        providerType: res.providerType,
        projectId: res.projectId,
        model: res.model,
        promptTokens: res.promptTokens,
        completionTokens: res.completionTokens,
        totalTokens: res.totalTokens,
        latencyMs: res.latencyMs,
      },
    };
  }
}
