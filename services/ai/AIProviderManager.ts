/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Centralized AI Provider Lifecycle, Validation, Discovery & Health Manager
 */

import { db } from '../../src/server/db.ts';
import { encryptSecret, tryDecryptSecret, maskSecret } from '../../src/server/crypto.ts';
import {
  deleteSupabaseAiCredential,
  getSupabaseAiEnvSuppression,
  inspectSupabaseAiInfrastructure,
  isSupabaseConfigured,
  listSupabaseAiCredentials,
  listSupabaseAiTaskRoutes,
  recordSupabaseAiConnectionTest,
  resetSupabaseAiCredentials,
  runSupabaseAiCrudSelfTest,
  setSupabaseAiEnvSuppression,
  upsertSupabaseAiCredential,
  upsertSupabaseAiTaskRoutes,
} from '../../src/server/supabaseAdmin.ts';
import {
  AIAutoConnectErrorCategory,
  AIAutoConnectResponse,
  AIBillingStatus,
  AIConnectionStatus,
  AIConnectionTestRecord,
  AIDiagnosticError,
  AIFailureSource,
  AIModelInfo,
  AIProviderCredential,
  AIProviderType,
  AITaskRouting,
  AITaskType,
  AIValidationResult,
} from '../../src/types/index.ts';
import {
  checkOutboundConnectivity,
  classifyProviderError,
  generateCorrelationId,
  getDiscoveryTimeoutMs,
  getGenerationTimeoutMs,
  ProviderExecutionError,
  redactSecrets,
} from './AIConnectionValidator.ts';
import {
  AIModelDiscovery,
  isFreeTierGeminiModel,
  selectAutoGeminiModel,
  selectAutoGrokModel,
} from './AIModelDiscovery.ts';
import { GeminiProvider } from './GeminiProvider.ts';
import { GrokProvider } from './GrokProvider.ts';

export const AI_TASK_CATALOG: { task: AITaskType; label: string; defaultModel: string }[] = [
  { task: 'headline_generation', label: 'Headline Suggestions', defaultModel: 'gemini-4-hydrogen' },
  { task: 'translation', label: 'English <-> Urdu Translation', defaultModel: 'gemini-4-hydrogen' },
  { task: 'seo_metadata', label: 'SEO Tags, Slugs & Meta Generation', defaultModel: 'gemini-4-hydrogen' },
  { task: 'article_drafting', label: 'Full Article Drafting', defaultModel: 'gemini-4-hydrogen' },
  { task: 'summarization', label: 'Article & Feed Summarization', defaultModel: 'gemini-4-hydrogen' },
  { task: 'content_rewriting', label: 'Rewrite & Tone Adjustment', defaultModel: 'gemini-4-hydrogen' },
  { task: 'breaking_alerts', label: 'Breaking News & Market Alert Summaries', defaultModel: 'gemini-4-hydrogen' },
  { task: 'public_qa', label: 'Ask Khabarnama Public Q&A', defaultModel: 'gemini-4-hydrogen' },
  { task: 'category_tagging', label: 'Category Classification & Tagging', defaultModel: 'gemini-4-hydrogen' },
  { task: 'fact_check_prep', label: 'Editorial Quality & Fact-Check Prep', defaultModel: 'gemini-4-hydrogen' },
  { task: 'newsletter_social', label: 'Newsletter & Social Media Copy', defaultModel: 'gemini-4-hydrogen' },
];

export interface ValidateProviderInput {
  providerType: AIProviderType;
  apiKey?: string;
  credentialId?: string;
  endpointUrl?: string;
  model?: string;
  runGenerationTest?: boolean;
}

export interface AutoConnectInput {
  apiKey: string;
  providerOverride?: 'gemini' | 'grok';
  preferredModel?: string;
  customEndpointUrl?: string;
  confirmBillableTest?: boolean;
  allowPaidModels?: boolean;
  replaceCredentialId?: string;
}

function mapDiagnosticToAutoCategory(
  diag?: AIDiagnosticError,
  modelsCount: number = 0
): AIAutoConnectErrorCategory {
  if (!diag) {
    return modelsCount === 0 ? 'NO_ACCESSIBLE_MODELS' : 'PROVIDER_UNAVAILABLE';
  }
  switch (diag.category) {
    case 'auth_failed_401':
      return 'INVALID_API_KEY';
    case 'quota_429':
      return 'FREE_TIER_QUOTA_EXCEEDED';
    case 'billing_required':
      return 'BILLING_REQUIRED';
    case 'permission_denied_403':
      return 'PERMISSION_DENIED';
    case 'timeout':
      return 'API_TIMEOUT';
    case 'network_error':
      return 'SERVER_CONNECTIVITY_FAILURE';
    case 'not_found_404':
      return modelsCount === 0 ? 'NO_ACCESSIBLE_MODELS' : 'UNSUPPORTED_MODEL';
    case 'bad_request_400':
      return 'UNSUPPORTED_MODEL';
    case 'server_error_5xx':
    case 'malformed_response':
      return 'PROVIDER_UNAVAILABLE';
    default:
      return 'PROVIDER_UNAVAILABLE';
  }
}

export class AIProviderManager {
  private static lastDbError: { message: string; code?: string; at: string; operation: string } | null = null;
  private static lastSuccessfulSaveAt: string | null = null;
  private static lastSuccessfulDeleteAt: string | null = null;
  private static lastProviderValidationAt: string | null = null;

  private static recordDbFailure(operation: string, message: string, code?: string) {
    this.lastDbError = {
      operation,
      message,
      code,
      at: new Date().toISOString(),
    };
  }

  public static sanitizeCredential(cred: AIProviderCredential, routes?: { task: string; label: string; primaryCredentialId: string; fallbackCredentialId?: string }[]) {
    const assignedTasks = routes
      ? routes
          .filter(r => r.primaryCredentialId === cred.id || r.fallbackCredentialId === cred.id)
          .map(r => r.label)
      : [];

    const copy: any = {
      ...cred,
      encryptedSecret: undefined,
      assignedTasks,
      connectionStatus: cred.enabled
        ? cred.connectionStatus || (cred.lastTestStatus === 'connected' ? 'connected' : cred.lastTestStatus === 'error' ? 'error' : 'untested')
        : 'disabled',
      modelListStatus: cred.modelListStatus || (cred.availableModels && cred.availableModels.length > 0 ? 'ok' : 'untested'),
      generationTestStatus:
        cred.generationTestStatus || (cred.lastTestStatus === 'connected' ? 'ok' : cred.lastTestStatus === 'error' ? 'error' : 'untested'),
    };
    delete copy.encryptedSecret;
    return copy;
  }

  public static resolveRawCredentialDetailed(
    credId: string
  ): { cred: AIProviderCredential; rawKey: string; decryptError?: string } | null {
    const envSuppressed = db.getAiEnvSuppressed();
    if (credId === 'env-gemini-default' && !envSuppressed.gemini && process.env.GEMINI_API_KEY?.trim()) {
      const rawKey = process.env.GEMINI_API_KEY.trim();
      return {
        cred: {
          id: 'env-gemini-default',
          providerType: 'gemini',
          label: 'Server Environment GEMINI_API_KEY',
          projectId: process.env.GOOGLE_CLOUD_PROJECT || 'env-gemini-project',
          model: 'gemini-4-hydrogen',
          encryptedSecret: '',
          maskedKey: maskSecret(rawKey),
          enabled: true,
          priority: 1,
          dailyTokenLimit: 1000000,
          dailyTokensUsed: 0,
          monthlyBudgetUsd: 50,
          monthlySpendUsd: 0,
          connectionStatus: 'untested',
          createdAt: '',
          updatedAt: '',
        },
        rawKey,
      };
    }

    if (credId === 'env-grok-default' && !envSuppressed.grok && process.env.XAI_API_KEY?.trim()) {
      const rawKey = process.env.XAI_API_KEY.trim();
      return {
        cred: {
          id: 'env-grok-default',
          providerType: 'grok',
          label: 'Server Environment XAI_API_KEY',
          projectId: 'env-xai-project',
          endpointUrl: 'https://api.x.ai/v1',
          model: 'grok-3-mini',
          encryptedSecret: '',
          maskedKey: maskSecret(rawKey),
          enabled: true,
          priority: 2,
          dailyTokenLimit: 500000,
          dailyTokensUsed: 0,
          monthlyBudgetUsd: 50,
          monthlySpendUsd: 0,
          connectionStatus: 'untested',
          createdAt: '',
          updatedAt: '',
        },
        rawKey,
      };
    }

    const found = db.getAiProviders().find(p => p.id === credId);
    if (!found) return null;
    const dec = tryDecryptSecret(found.encryptedSecret);
    if (!dec.ok) {
      return { cred: found, rawKey: '', decryptError: dec.error || 'Failed to decrypt stored credential.' };
    }
    return { cred: found, rawKey: dec.value };
  }

  public static resolveRawCredential(credId: string): { cred: AIProviderCredential; rawKey: string } | null {
    const detailed = this.resolveRawCredentialDetailed(credId);
    if (!detailed) return null;
    return { cred: detailed.cred, rawKey: detailed.rawKey };
  }

  /**
   * Validates an API key against the official provider without saving it to the DB.
   * Supports lightweight model-list validation (runGenerationTest = false) or full
   * model-list + live generation verification (runGenerationTest = true).
   */
  public static async validateCandidateKey(
    input: ValidateProviderInput,
    actor: string = 'Super Admin',
    signal?: AbortSignal
  ): Promise<AIValidationResult> {
    let rawKey = (input.apiKey || '').trim();
    let providerType: AIProviderType = input.providerType;
    let endpointUrl = input.endpointUrl?.trim();
    let preferredModel = input.model?.trim();

    let decryptError: string | undefined;

    if (!rawKey && input.credentialId) {
      const resolved = this.resolveRawCredentialDetailed(input.credentialId);
      if (resolved) {
        rawKey = resolved.rawKey;
        decryptError = resolved.decryptError;
        providerType = resolved.cred.providerType;
        endpointUrl = endpointUrl || resolved.cred.endpointUrl;
        preferredModel = preferredModel || resolved.cred.model;
      }
    }

    const runGenerationTest = input.runGenerationTest !== false;

    if (!rawKey) {
      const diag = classifyProviderError({
        providerType,
        httpStatus: decryptError ? 500 : 401,
        providerMessage: decryptError
          ? `Stored credential could not be decrypted (${decryptError}). Replace the key or restore AI_MASTER_KEY.`
          : 'API key input is empty.',
        stage: 'model_list',
      });
      this.lastProviderValidationAt = new Date().toISOString();
      return {
        ok: false,
        authenticated: false,
        generationVerified: false,
        connectionStatus: decryptError ? 'error' : 'auth_failed',
        message: diag.diagnosis,
        latencyMs: 0,
        providerType,
        selectedModel: preferredModel || '',
        availableModels: [],
        diagnostic: diag,
        correlationId: diag.correlationId,
      };
    }

    const result =
      providerType === 'gemini'
        ? await GeminiProvider.testConnection(rawKey, preferredModel, signal, runGenerationTest)
        : await GrokProvider.testConnection(
            rawKey,
            preferredModel,
            endpointUrl || (providerType === 'grok' ? 'https://api.x.ai/v1' : ''),
            signal,
            runGenerationTest,
            providerType
          );

    // Log the validation test cleanly without ever storing the raw key
    const testRecord: AIConnectionTestRecord = {
      id: `aitest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      credentialId: input.credentialId,
      providerType,
      modelTested: result.selectedModel || preferredModel,
      stage: runGenerationTest ? 'generation_test' : 'model_list',
      ok: result.ok,
      connectionStatus: result.connectionStatus,
      modelListOk: result.authenticated,
      generationOk: result.generationVerified,
      modelsDiscoveredCount: result.availableModels.length,
      latencyMs: result.latencyMs,
      sampleOutput: result.sampleOutput ? redactSecrets(result.sampleOutput, rawKey) : undefined,
      diagnostic: result.diagnostic,
      actor,
      timestamp: new Date().toISOString(),
    };
    this.lastProviderValidationAt = testRecord.timestamp;
    db.recordAiConnectionTest(testRecord);
    if (isSupabaseConfigured()) {
      recordSupabaseAiConnectionTest(testRecord).catch(() => {});
    }

    return result;
  }

  public static async addOrUpdateCredential(
    input: {
      id?: string;
      providerType: AIProviderType;
      label: string;
      projectId: string;
      endpointUrl?: string;
      model: string;
      apiKey?: string;
      enabled?: boolean;
      priority?: number;
      dailyTokenLimit?: number;
      monthlyBudgetUsd?: number;
      assignedTasks?: AITaskType[];
      validationResult?: AIValidationResult;
    },
    actor: string
  ): Promise<AIProviderCredential> {
    if (input.id === 'env-gemini-default' || input.id === 'env-grok-default') {
      throw new Error(
        'Server environment fallback credentials cannot be edited directly. Add a database-backed credential or paste a new key in Connect AI API.'
      );
    }

    if (isSupabaseConfigured() && input.id) {
      await this.hydrateFromSupabaseIfConfigured(actor);
    }

    const existing = input.id ? db.getAiProviders().find(p => p.id === input.id) : undefined;
    if (input.id && !existing) {
      throw new Error('AI credential not found.');
    }
    if (!existing && (!input.apiKey || !input.apiKey.trim())) {
      throw new Error('API key is required when adding a new credential.');
    }
    if (!input.label?.trim() || !input.projectId?.trim()) {
      throw new Error('Friendly credential name and Project ID are required.');
    }

    const now = new Date().toISOString();
    const rawKey = input.apiKey?.trim();
    const val = input.validationResult;

    // A green 'connected' status is permitted ONLY after a live generation test passes
    let connectionStatus: AIConnectionStatus = existing?.connectionStatus || 'untested';
    let lastTestStatus: 'connected' | 'error' | 'untested' = existing?.lastTestStatus || 'untested';
    let lastTestMessage = existing?.lastTestMessage;
    let modelListStatus: 'ok' | 'error' | 'untested' = existing?.modelListStatus || 'untested';
    let generationTestStatus: 'ok' | 'error' | 'untested' = existing?.generationTestStatus || 'untested';
    let availableModels: AIModelInfo[] | undefined = existing?.availableModels;

    if (val) {
      availableModels = val.availableModels || existing?.availableModels;
      modelListStatus = val.authenticated ? 'ok' : 'error';
      generationTestStatus = val.generationVerified ? 'ok' : val.authenticated ? 'error' : 'untested';
      connectionStatus = val.connectionStatus;
      lastTestStatus = val.generationVerified ? 'connected' : val.diagnostic ? 'error' : 'untested';
      lastTestMessage = val.message;
    } else if (rawKey) {
      // Newly entered/replaced key without completed live generation test MUST NOT be marked connected
      connectionStatus = 'untested';
      modelListStatus = 'untested';
      generationTestStatus = 'untested';
      lastTestStatus = 'untested';
      lastTestMessage = 'Credential saved; live generation test not yet completed.';
      availableModels = undefined;
    }

    const enabled = input.enabled ?? existing?.enabled ?? true;
    if (!enabled) {
      connectionStatus = 'disabled';
    } else if (existing && !existing.enabled && enabled && connectionStatus === 'disabled') {
      connectionStatus = lastTestStatus === 'connected' ? 'connected' : lastTestStatus === 'error' ? 'error' : 'untested';
    }

    const defaultEndpoint =
      input.providerType === 'grok' ? 'https://api.x.ai/v1' : undefined;

    const record: AIProviderCredential = {
      id: existing?.id || `aik-${input.providerType}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      providerType: input.providerType,
      label: input.label.trim(),
      projectId: input.projectId.trim(),
      endpointUrl:
        input.endpointUrl !== undefined
          ? input.endpointUrl.trim() || defaultEndpoint
          : existing?.endpointUrl || defaultEndpoint,
      model: input.model?.trim() || val?.selectedModel || existing?.model || '',
      encryptedSecret: rawKey ? encryptSecret(rawKey) : existing!.encryptedSecret,
      maskedKey: rawKey ? maskSecret(rawKey) : existing!.maskedKey,
      enabled,
      priority: Number(input.priority ?? existing?.priority ?? 10),
      dailyTokenLimit: Number(input.dailyTokenLimit ?? existing?.dailyTokenLimit ?? 500000),
      dailyTokensUsed: existing?.dailyTokensUsed ?? 0,
      monthlyBudgetUsd: Number(input.monthlyBudgetUsd ?? existing?.monthlyBudgetUsd ?? 25),
      monthlySpendUsd: existing?.monthlySpendUsd ?? 0,
      availableModels,
      connectionStatus,
      billingStatus: existing?.billingStatus,
      billingNote: existing?.billingNote,
      modelListStatus,
      generationTestStatus,
      lastTestedAt: val ? now : rawKey ? null : existing?.lastTestedAt ?? null,
      lastSuccessfulVerificationAt: val?.authenticated ? now : existing?.lastSuccessfulVerificationAt ?? null,
      lastSuccessfulGenerationAt: val?.generationVerified ? now : existing?.lastSuccessfulGenerationAt ?? null,
      lastFailureAt: val && !val.ok ? now : existing?.lastFailureAt ?? null,
      lastTestStatus,
      lastTestMessage,
      lastDiagnostic: val?.diagnostic ?? (rawKey ? null : existing?.lastDiagnostic ?? null),
      lastLatencyMs: val?.latencyMs ?? existing?.lastLatencyMs,
      lastCorrelationId: val?.correlationId ?? existing?.lastCorrelationId,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    let persistedRecord = record;
    if (isSupabaseConfigured()) {
      const sbRes = await upsertSupabaseAiCredential(record);
      if (!sbRes.ok || !sbRes.credential) {
        const msg = sbRes.error || 'Failed persisting AI credential to Supabase PostgreSQL.';
        this.recordDbFailure('upsertSupabaseAiCredential', msg, sbRes.code);
        throw new Error(`Database save failed: ${msg}`);
      }
      persistedRecord = sbRes.credential;
    }

    const saved = db.upsertAiProvider(persistedRecord, actor);
    this.lastSuccessfulSaveAt = now;

    if (Array.isArray(input.assignedTasks)) {
      const assignedSet = new Set<AITaskType>(input.assignedTasks);
      const existingRoutes = db.getAiTaskRoutes();
      const updatedRoutes: AITaskRouting[] = [];
      for (const spec of AI_TASK_CATALOG) {
        const prev = existingRoutes[spec.task];
        if (assignedSet.has(spec.task)) {
          const next: AITaskRouting = {
            task: spec.task,
            label: prev?.label || spec.label,
            primaryCredentialId: saved.id,
            primaryModel: saved.model || prev?.primaryModel || spec.defaultModel,
            fallbackCredentialId:
              prev?.fallbackCredentialId && prev.fallbackCredentialId !== saved.id
                ? prev.fallbackCredentialId
                : '',
            fallbackModel:
              prev?.fallbackCredentialId && prev.fallbackCredentialId !== saved.id
                ? prev.fallbackModel || ''
                : '',
            temperature:
              prev?.temperature ?? (spec.task === 'fact_check_prep' || spec.task === 'translation' ? 0.2 : 0.5),
            maxTokens: prev?.maxTokens ?? (spec.task === 'article_drafting' ? 4096 : 3072),
          };
          db.setAiTaskRoute(spec.task, next, actor);
          updatedRoutes.push(next);
        } else if (prev && prev.primaryCredentialId === saved.id) {
          const next: AITaskRouting = {
            ...prev,
            primaryCredentialId: '',
            primaryModel: '',
          };
          db.setAiTaskRoute(spec.task, next, actor);
          updatedRoutes.push(next);
        }
      }
      if (updatedRoutes.length > 0 && isSupabaseConfigured()) {
        const routeRes = await upsertSupabaseAiTaskRoutes(updatedRoutes);
        if (!routeRes.ok) {
          this.recordDbFailure('upsertSupabaseAiTaskRoutes', routeRes.error || 'Task route sync failed', routeRes.code);
        }
      }
    }

    const finalRoutes = AI_TASK_CATALOG.map(spec => db.getAiTaskRoutes()[spec.task]).filter(Boolean) as AITaskRouting[];
    return this.sanitizeCredential(saved, finalRoutes);
  }

  public static async updateCredentialPartial(
    id: string,
    patch: {
      label?: string;
      projectId?: string;
      endpointUrl?: string;
      model?: string;
      apiKey?: string;
      enabled?: boolean;
      priority?: number;
      dailyTokenLimit?: number;
      monthlyBudgetUsd?: number;
      assignedTasks?: AITaskType[];
      validationResult?: AIValidationResult;
    },
    actor: string
  ): Promise<AIProviderCredential> {
    if (isSupabaseConfigured()) {
      await this.hydrateFromSupabaseIfConfigured(actor);
    }
    const existing = db.getAiProviders().find(p => p.id === id);
    if (!existing) {
      throw new Error('AI credential not found.');
    }

    return this.addOrUpdateCredential(
      {
        id: existing.id,
        providerType: existing.providerType,
        label: patch.label ?? existing.label,
        projectId: patch.projectId ?? existing.projectId,
        endpointUrl: patch.endpointUrl ?? existing.endpointUrl,
        model: patch.model ?? existing.model,
        apiKey: patch.apiKey,
        enabled: patch.enabled ?? existing.enabled,
        priority: patch.priority ?? existing.priority,
        dailyTokenLimit: patch.dailyTokenLimit ?? existing.dailyTokenLimit,
        monthlyBudgetUsd: patch.monthlyBudgetUsd ?? existing.monthlyBudgetUsd,
        assignedTasks: patch.assignedTasks,
        validationResult: patch.validationResult,
      },
      actor
    );
  }

  public static async testSavedCredential(credId: string, actor: string): Promise<AIValidationResult> {
    const resolved = this.resolveRawCredentialDetailed(credId);
    if (!resolved) {
      throw new Error('AI credential not found.');
    }
    const { cred, rawKey, decryptError } = resolved;

    if (!rawKey && decryptError) {
      throw new Error(`Credential decryption failed: ${decryptError}`);
    }

    const result = await this.validateCandidateKey(
      {
        credentialId: cred.id,
        providerType: cred.providerType,
        apiKey: rawKey,
        endpointUrl: cred.endpointUrl,
        model: cred.model,
        runGenerationTest: true,
      },
      actor
    );

    const now = new Date().toISOString();
    if (cred.id !== 'env-gemini-default' && cred.id !== 'env-grok-default') {
      const updatedCred = db.upsertAiProvider(
        {
          ...cred,
          model: cred.model || result.selectedModel,
          availableModels:
            result.availableModels.length > 0 ? result.availableModels : cred.availableModels,
          connectionStatus: cred.enabled ? result.connectionStatus : 'disabled',
          modelListStatus: result.authenticated ? 'ok' : 'error',
          generationTestStatus: result.generationVerified ? 'ok' : result.authenticated ? 'error' : 'untested',
          lastTestedAt: now,
          lastSuccessfulVerificationAt: result.authenticated ? now : cred.lastSuccessfulVerificationAt,
          lastSuccessfulGenerationAt: result.generationVerified ? now : cred.lastSuccessfulGenerationAt,
          lastFailureAt: !result.ok ? now : cred.lastFailureAt,
          lastTestStatus: result.ok ? 'connected' : 'error',
          lastTestMessage: result.message,
          lastDiagnostic: result.diagnostic || null,
          lastLatencyMs: result.latencyMs,
          lastCorrelationId: result.correlationId,
          updatedAt: now,
        },
        actor
      );
      if (isSupabaseConfigured()) {
        const sbRes = await upsertSupabaseAiCredential(updatedCred);
        if (!sbRes.ok) {
          this.recordDbFailure('upsertSupabaseAiCredential', sbRes.error || 'Failed persisting test status', sbRes.code);
        }
      }
    }

    return result;
  }

  public static async discoverModelsForCredential(credId: string, actor: string) {
    const resolved = this.resolveRawCredential(credId);
    if (!resolved) {
      throw new Error('AI credential not found.');
    }
    const { cred, rawKey } = resolved;
    const discovery =
      cred.providerType === 'gemini'
        ? await AIModelDiscovery.discoverGeminiModels(rawKey)
        : await AIModelDiscovery.discoverGrokModels(rawKey, cred.endpointUrl || 'https://api.x.ai/v1');

    if (cred.id !== 'env-gemini-default' && cred.id !== 'env-grok-default') {
      const now = new Date().toISOString();
      db.upsertAiProvider(
        {
          ...cred,
          availableModels: discovery.models,
          modelListStatus: 'ok',
          lastSuccessfulVerificationAt: now,
          rateLimitInfo: discovery.rateLimitInfo || cred.rateLimitInfo,
          updatedAt: now,
        },
        actor
      );
    }

    return discovery;
  }

  public static getCredentialLogs(credId: string) {
    const tests = db.getAiConnectionTests(credId, 50);
    const usage = db.getAiUsageLogs(200).filter(u => u.credentialId === credId).slice(0, 50);
    return { tests, usage };
  }

  /**
   * Lightweight periodic health monitor: checks enabled credentials using /models ONLY
   * (zero paid inference requests) + validates outbound HTTPS connectivity to provider hosts.
   */
  public static async runLightweightHealthCheck(actor: string = 'Health Monitor') {
    const creds = db.getAiProviders().filter(c => c.enabled);
    const connectivity = await checkOutboundConnectivity();
    const checks: any[] = [];

    for (const cred of creds) {
      const dec = tryDecryptSecret(cred.encryptedSecret);
      const rawKey = dec.ok ? dec.value : '';
      const start = Date.now();
      const correlationId = generateCorrelationId('hc');
      try {
        if (!dec.ok) {
          throw new Error(`Credential decryption failed: ${dec.error}`);
        }
        const discovery =
          cred.providerType === 'gemini'
            ? await AIModelDiscovery.discoverGeminiModels(rawKey)
            : await AIModelDiscovery.discoverGrokModels(rawKey, cred.endpointUrl || 'https://api.x.ai/v1');

        const now = new Date().toISOString();
        const prevConnected = cred.generationTestStatus === 'ok' || cred.lastTestStatus === 'connected';
        const nextStatus: AIConnectionStatus = prevConnected ? 'connected' : 'untested';

        db.upsertAiProvider(
          {
            ...cred,
            availableModels: discovery.models,
            modelListStatus: 'ok',
            connectionStatus: nextStatus,
            lastTestedAt: now,
            lastSuccessfulVerificationAt: now,
            lastLatencyMs: discovery.latencyMs,
            lastCorrelationId: discovery.correlationId,
            rateLimitInfo: discovery.rateLimitInfo || cred.rateLimitInfo,
            updatedAt: now,
          },
          actor
        );

        db.recordAiConnectionTest({
          id: `aitest-hc-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          credentialId: cred.id,
          providerType: cred.providerType,
          modelTested: cred.model,
          stage: 'health_check',
          ok: true,
          connectionStatus: nextStatus,
          modelListOk: true,
          generationOk: cred.generationTestStatus === 'ok',
          modelsDiscoveredCount: discovery.models.length,
          latencyMs: discovery.latencyMs,
          actor,
          timestamp: now,
        });

        checks.push({
          credentialId: cred.id,
          label: cred.label,
          providerType: cred.providerType,
          ok: true,
          modelsCount: discovery.models.length,
          latencyMs: discovery.latencyMs,
          status: nextStatus,
        });
      } catch (err: any) {
        const diag =
          err instanceof ProviderExecutionError
            ? err.diagnostic
            : classifyProviderError({
                providerType: cred.providerType,
                err,
                stage: 'model_list',
                correlationId,
                secretToRedact: rawKey,
              });
        const now = new Date().toISOString();

        db.upsertAiProvider(
          {
            ...cred,
            modelListStatus: 'error',
            connectionStatus: diag.connectionStatus,
            lastTestedAt: now,
            lastFailureAt: now,
            lastTestStatus: 'error',
            lastTestMessage: diag.diagnosis,
            lastDiagnostic: diag,
            lastLatencyMs: Date.now() - start,
            lastCorrelationId: diag.correlationId,
            updatedAt: now,
          },
          actor
        );

        db.recordAiConnectionTest({
          id: `aitest-hc-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          credentialId: cred.id,
          providerType: cred.providerType,
          modelTested: cred.model,
          stage: 'health_check',
          ok: false,
          connectionStatus: diag.connectionStatus,
          modelListOk: false,
          generationOk: false,
          modelsDiscoveredCount: 0,
          latencyMs: Date.now() - start,
          diagnostic: diag,
          actor,
          timestamp: now,
        });

        checks.push({
          credentialId: cred.id,
          label: cred.label,
          providerType: cred.providerType,
          ok: false,
          status: diag.connectionStatus,
          diagnosis: diag.diagnosis,
          correlationId: diag.correlationId,
        });
      }
    }

    const summary = {
      checkedAt: new Date().toISOString(),
      connectivity,
      credentialsChecked: checks.length,
      healthyCount: checks.filter(c => c.ok).length,
      failingCount: checks.filter(c => !c.ok).length,
      checks,
    };
    db.setAiHealthStatus(summary);
    return summary;
  }

  public static getEnvManagedVariablesStatus() {
    const suppressed = db.getAiEnvSuppressed();
    const geminiSet = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());
    const grokSet = Boolean(process.env.XAI_API_KEY && process.env.XAI_API_KEY.trim());
    return [
      {
        name: 'GEMINI_API_KEY',
        provider: 'gemini' as const,
        presentInEnv: geminiSet,
        maskedValue: geminiSet ? maskSecret(process.env.GEMINI_API_KEY!.trim()) : null,
        suppressedInRuntime: suppressed.gemini,
        location: '.env file / Namecheap Node.js App Environment Variables / Google AI Studio Secrets',
      },
      {
        name: 'XAI_API_KEY',
        provider: 'grok' as const,
        presentInEnv: grokSet,
        maskedValue: grokSet ? maskSecret(process.env.XAI_API_KEY!.trim()) : null,
        suppressedInRuntime: suppressed.grok,
        location: '.env file / Namecheap Node.js App Environment Variables',
      },
    ];
  }

  public static async getResetPreviewSummary() {
    if (isSupabaseConfigured()) {
      await this.hydrateFromSupabaseIfConfigured();
    }
    const creds = db.getAiProviders();
    const geminiCount = creds.filter(c => c.providerType === 'gemini').length;
    const grokCount = creds.filter(c => c.providerType === 'grok').length;
    const customCount = creds.filter(c => c.providerType !== 'gemini' && c.providerType !== 'grok').length;
    const routesMap = db.getAiTaskRoutes();
    const dependentRoutesCount = AI_TASK_CATALOG.filter(spec => {
      const r = routesMap[spec.task];
      return Boolean(r?.primaryCredentialId || r?.fallbackCredentialId);
    }).length;
    const envManagedVariables = this.getEnvManagedVariablesStatus();
    const activeEnvCount = envManagedVariables.filter(v => v.presentInEnv && !v.suppressedInRuntime).length;

    return {
      geminiCount,
      grokCount,
      customCount,
      totalStoredCount: geminiCount + grokCount,
      activeEnvCount,
      dependentRoutesCount,
      envManagedVariables,
      preserved: [
        'News Articles & Drafts',
        'Categories & Tags',
        'Users & Permissions',
        'Site & SEO Settings',
        'Redacted Usage & Audit History',
        'AI_MASTER_KEY Encryption Key',
      ],
    };
  }

  public static async resetAllCredentials(actor: string = 'Super Admin') {
    let supabaseResult: { ok: boolean; configured: boolean; removedCount: number; error?: string } = {
      ok: true,
      configured: false,
      removedCount: 0,
    };

    if (isSupabaseConfigured()) {
      supabaseResult = await resetSupabaseAiCredentials();
      if (!supabaseResult.ok) {
        const errMsg = supabaseResult.error || 'Failed resetting AI credentials in Supabase.';
        this.recordDbFailure('resetSupabaseAiCredentials', errMsg);
        throw new Error(`Supabase AI reset failed: ${errMsg}`);
      }
    }

    const localResult = db.resetAllAiCredentials(actor);
    this.lastSuccessfulDeleteAt = new Date().toISOString();

    const envManagedVariables = this.getEnvManagedVariablesStatus();
    const activeEnvVars = envManagedVariables.filter(v => v.presentInEnv);

    return {
      ok: true,
      removedLocalCount: localResult.removedCount,
      removedSupabaseCount: supabaseResult.removedCount,
      supabaseConfigured: supabaseResult.configured,
      supabaseSynced: !supabaseResult.configured || supabaseResult.ok,
      supabaseError: supabaseResult.error,
      geminiStatus: 'Not Connected' as const,
      grokStatus: 'Not Connected' as const,
      envManagedVariables,
      message:
        activeEnvVars.length > 0
          ? `All stored Gemini & Grok credentials cleared and reset to Not Connected. Server environment keys (${activeEnvVars.map(v => v.name).join(', ')}) are suppressed from active loading until you connect fresh keys or remove them from ${activeEnvVars[0].location}.`
          : 'All previously stored Gemini and Grok API credentials, cached model lists, and task route bindings have been removed. Both providers are now Not Connected.',
    };
  }

  public static async getDiagnostics() {
    if (isSupabaseConfigured()) {
      await this.hydrateFromSupabaseIfConfigured();
    }
    const [connectivity, supabase] = await Promise.all([
      checkOutboundConnectivity(),
      inspectSupabaseAiInfrastructure(),
    ]);
    const cachedHealth = db.getAiHealthStatus();
    const recentTests = db.getAiConnectionTests(undefined, 25);
    const providers = db.getAiProviders();
    const envManagedVariables = this.getEnvManagedVariablesStatus();
    const latestTest = recentTests[0] || null;
    const latestSuccess = recentTests.find(t => t.ok && t.generationOk) || null;
    const activeCred =
      providers.find(c => c.enabled && c.connectionStatus === 'connected') ||
      providers.find(c => c.enabled) ||
      providers[0] ||
      null;

    return {
      connectivity,
      supabase,
      lastHealthCheck: cachedHealth,
      recentTests,
      envManagedVariables,
      serverEnvironment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        discoveryTimeoutMs: getDiscoveryTimeoutMs(),
        generationTimeoutMs: getGenerationTimeoutMs(),
        supabaseConfigured: isSupabaseConfigured(),
        masterKeyConfigured: Boolean(process.env.AI_MASTER_KEY && process.env.AI_MASTER_KEY.trim()),
      },
      runtimeTelemetry: {
        configSource: isSupabaseConfigured()
          ? 'Supabase PostgreSQL (authoritative) + Local Encrypted Cache'
          : 'Local Encrypted Vault (portal_database.json fallback)',
        storedCredentialCount: providers.length,
        enabledCredentialCount: providers.filter(p => p.enabled).length,
        activeConnectedCount: providers.filter(p => p.enabled && p.connectionStatus === 'connected').length,
        lastDbError: this.lastDbError,
        lastProviderValidation: this.lastProviderValidationAt || latestTest?.timestamp || null,
        lastSuccessfulSave: this.lastSuccessfulSaveAt,
        lastSuccessfulDelete: this.lastSuccessfulDeleteAt,
      },
      summary: {
        provider: activeCred?.providerType || latestTest?.providerType || null,
        authenticationStatus:
          activeCred?.modelListStatus || (latestTest?.modelListOk ? 'ok' : latestTest ? 'error' : 'not_checked'),
        modelDiscoveryStatus:
          activeCred?.modelListStatus ||
          (latestTest?.modelListOk ? `ok (${latestTest.modelsDiscoveredCount} models)` : latestTest ? 'failed' : 'not_run'),
        selectedModel: activeCred?.model || latestTest?.modelTested || null,
        generationTestStatus:
          activeCred?.generationTestStatus || (latestTest?.generationOk ? 'ok' : latestTest ? 'error' : 'not_run'),
        apiResponseTimeMs: activeCred?.lastLatencyMs ?? latestTest?.latencyMs ?? null,
        lastError: activeCred?.lastDiagnostic?.diagnosis || latestTest?.diagnostic?.diagnosis || null,
        errorClassification: activeCred?.lastDiagnostic?.title || latestTest?.diagnostic?.title || null,
        failureSource: (activeCred?.lastDiagnostic?.failureSource ||
          latestTest?.diagnostic?.failureSource ||
          'None') as AIFailureSource,
        lastSuccessfulConnection: activeCred?.lastSuccessfulGenerationAt || latestSuccess?.timestamp || null,
        correlationId: activeCred?.lastCorrelationId || latestTest?.diagnostic?.correlationId || null,
      },
    };
  }

  public static async runCrudSelfTest(actor: string = 'Super Admin') {
    if (isSupabaseConfigured()) {
      const res = await runSupabaseAiCrudSelfTest();
      if (!res.ok && res.error) {
        this.recordDbFailure('runSupabaseAiCrudSelfTest', res.error);
      }
      return { ...res, mode: 'supabase' as const };
    }

    // Local encrypted vault fallback self-test (isolated synthetic ID, enabled: false, cleaned in finally)
    const testId = `__diag_ai_crud_${Date.now()}`;
    const stages: {
      stage: 'INSERT' | 'SELECT' | 'UPDATE' | 'DELETE' | 'VERIFY_DELETED';
      ok: boolean;
      latencyMs: number;
      detail: string;
      error?: string;
    }[] = [];

    try {
      let t0 = Date.now();
      const now = new Date().toISOString();
      const inserted = db.upsertAiProvider(
        {
          id: testId,
          providerType: 'gemini',
          label: 'Diagnostic CRUD Probe (Safe Auto-Deleted)',
          projectId: 'diag-probe-isolated',
          model: 'diag-model',
          encryptedSecret: encryptSecret('diag-nonfunctional-probe-secret'),
          maskedKey: 'diag••••••••test',
          enabled: false,
          priority: 999,
          dailyTokenLimit: 0,
          dailyTokensUsed: 0,
          monthlyBudgetUsd: 0,
          monthlySpendUsd: 0,
          connectionStatus: 'disabled',
          createdAt: now,
          updatedAt: now,
        },
        actor
      );
      stages.push({
        stage: 'INSERT',
        ok: Boolean(inserted?.id === testId),
        latencyMs: Date.now() - t0,
        detail: `Inserted isolated local vault record ${testId}`,
      });

      t0 = Date.now();
      const selected = db.getAiProviders().find(p => p.id === testId);
      if (!selected) throw new Error('Inserted diagnostic record could not be read back.');
      stages.push({
        stage: 'SELECT',
        ok: true,
        latencyMs: Date.now() - t0,
        detail: `Read back "${selected.label}" (enabled=${selected.enabled})`,
      });

      t0 = Date.now();
      const updated = db.upsertAiProvider(
        { ...selected, label: 'Diagnostic CRUD Probe Updated', updatedAt: new Date().toISOString() },
        actor
      );
      if (updated.label !== 'Diagnostic CRUD Probe Updated') throw new Error('Update did not persist.');
      stages.push({
        stage: 'UPDATE',
        ok: true,
        latencyMs: Date.now() - t0,
        detail: `Updated label -> "${updated.label}"`,
      });

      t0 = Date.now();
      const deleted = db.deleteAiProvider(testId, actor);
      if (!deleted) throw new Error('Delete returned false.');
      stages.push({
        stage: 'DELETE',
        ok: true,
        latencyMs: Date.now() - t0,
        detail: `Deleted 1 diagnostic record (${testId})`,
      });

      t0 = Date.now();
      const existsAfter = db.getAiProviders().some(p => p.id === testId);
      if (existsAfter) throw new Error('Diagnostic record still present after delete.');
      stages.push({
        stage: 'VERIFY_DELETED',
        ok: true,
        latencyMs: Date.now() - t0,
        detail: 'Confirmed test record absent from local encrypted store.',
      });

      return {
        ok: true,
        configured: false,
        mode: 'local_fallback' as const,
        projectHost: null,
        testRecordId: testId,
        stages,
      };
    } catch (err: any) {
      return {
        ok: false,
        configured: false,
        mode: 'local_fallback' as const,
        projectHost: null,
        testRecordId: testId,
        stages,
        error: err?.message || 'Local CRUD self-test failed.',
      };
    } finally {
      if (db.getAiProviders().some(p => p.id === testId)) {
        db.deleteAiProvider(testId, actor);
      }
    }
  }

  /**
   * Key format hint ONLY — never trusted without server-side API verification.
   */
  public static detectProviderHint(apiKey: string): 'gemini' | 'grok' | 'unknown' {
    const trimmed = (apiKey || '').trim();
    if (/^AIza[0-9A-Za-z_-]{15,}$/.test(trimmed)) return 'gemini';
    if (/^xai-[0-9A-Za-z_-]{15,}$/.test(trimmed)) return 'grok';
    return 'unknown';
  }

  public static async saveTaskRoutes(
    input: AITaskRouting | AITaskRouting[],
    actor: string = 'Super Admin'
  ): Promise<AITaskRouting[]> {
    const items = Array.isArray(input) ? input : [input];
    if (items.length === 0) {
      throw new Error('At least one task route entry is required.');
    }

    const validCredIds = new Set(db.getAiProviders().map(p => p.id));
    const envSuppressed = db.getAiEnvSuppressed();
    if (!envSuppressed.gemini && process.env.GEMINI_API_KEY?.trim()) validCredIds.add('env-gemini-default');
    if (!envSuppressed.grok && process.env.XAI_API_KEY?.trim()) validCredIds.add('env-grok-default');

    const normalizedList: AITaskRouting[] = [];
    for (const r of items) {
      if (!r?.task) continue;
      const spec = AI_TASK_CATALOG.find(s => s.task === r.task);
      const cleanPrimary =
        r.primaryCredentialId && validCredIds.has(r.primaryCredentialId) ? r.primaryCredentialId : '';
      const cleanFallback =
        r.fallbackCredentialId &&
        r.fallbackCredentialId !== cleanPrimary &&
        validCredIds.has(r.fallbackCredentialId)
          ? r.fallbackCredentialId
          : '';

      const normalized: AITaskRouting = {
        task: r.task,
        label: r.label || spec?.label || r.task,
        primaryCredentialId: cleanPrimary,
        primaryModel: cleanPrimary ? String(r.primaryModel || '').trim() : '',
        fallbackCredentialId: cleanFallback,
        fallbackModel: cleanFallback ? String(r.fallbackModel || '').trim() : '',
        temperature: Math.min(1, Math.max(0, Number(r.temperature ?? 0.4))),
        maxTokens: Math.max(256, Number(r.maxTokens ?? 3072)),
      };
      normalizedList.push(normalized);
    }

    if (normalizedList.length === 0) {
      throw new Error('No valid task route entries provided.');
    }

    if (isSupabaseConfigured()) {
      const sbRes = await upsertSupabaseAiTaskRoutes(normalizedList);
      if (!sbRes.ok) {
        const msg = sbRes.error || 'Failed saving task routes to Supabase.';
        this.recordDbFailure('upsertSupabaseAiTaskRoutes', msg, sbRes.code);
        throw new Error(`Database route save failed: ${msg}`);
      }
    }

    for (const normalized of normalizedList) {
      db.setAiTaskRoute(normalized.task, normalized, actor);
    }
    this.lastSuccessfulSaveAt = new Date().toISOString();

    return AI_TASK_CATALOG.map(spec => {
      const saved = db.getAiTaskRoutes()[spec.task];
      return (
        saved || {
          task: spec.task,
          label: spec.label,
          primaryCredentialId: '',
          primaryModel: '',
          fallbackCredentialId: '',
          fallbackModel: '',
          temperature: spec.task === 'fact_check_prep' || spec.task === 'translation' ? 0.2 : 0.5,
          maxTokens: spec.task === 'article_drafting' ? 4096 : 3072,
        }
      );
    });
  }

  public static async syncRoutesForCredential(
    credentialId: string,
    model: string,
    actor: string
  ): Promise<AITaskRouting[]> {
    const existingRoutes = db.getAiTaskRoutes();
    const updatedRoutes: AITaskRouting[] = AI_TASK_CATALOG.map(spec => {
      const prev = existingRoutes[spec.task];
      const next: AITaskRouting = {
        task: spec.task,
        label: spec.label,
        primaryCredentialId: credentialId,
        primaryModel: model,
        fallbackCredentialId:
          prev?.fallbackCredentialId && prev.fallbackCredentialId !== credentialId
            ? prev.fallbackCredentialId
            : '',
        fallbackModel:
          prev?.fallbackCredentialId && prev.fallbackCredentialId !== credentialId
            ? prev.fallbackModel || ''
            : '',
        temperature:
          prev?.temperature ?? (spec.task === 'fact_check_prep' || spec.task === 'translation' ? 0.2 : 0.5),
        maxTokens: prev?.maxTokens ?? (spec.task === 'article_drafting' ? 4096 : 3072),
      };
      return next;
    });

    if (isSupabaseConfigured()) {
      const sbRes = await upsertSupabaseAiTaskRoutes(updatedRoutes);
      if (!sbRes.ok) {
        this.recordDbFailure('upsertSupabaseAiTaskRoutes', sbRes.error || 'Route sync failed', sbRes.code);
      }
    }
    for (const next of updatedRoutes) {
      db.setAiTaskRoute(next.task, next, actor);
    }
    return updatedRoutes;
  }

  public static async hydrateFromSupabaseIfConfigured(actor: string = 'System'): Promise<void> {
    if (!isSupabaseConfigured()) return;
    try {
      const [credRes, routeRes, flagRes] = await Promise.all([
        listSupabaseAiCredentials(),
        listSupabaseAiTaskRoutes(),
        getSupabaseAiEnvSuppression(),
      ]);

      if (credRes.ok) {
        // Authoritatively replace local active cache so deletions & edits in Supabase always reflect cleanly (even 0 rows!)
        db.replaceAiProvidersFromSupabase(credRes.credentials);
      } else if (credRes.error) {
        this.recordDbFailure('listSupabaseAiCredentials', credRes.error, credRes.code);
      }

      if (flagRes.ok && flagRes.suppressed) {
        db.setAiEnvSuppressed(flagRes.suppressed);
      }

      if (routeRes.ok) {
        if (routeRes.routes.length > 0 || (credRes.ok && credRes.credentials.length === 0)) {
          db.replaceAiTaskRoutesFromSupabase(routeRes.routes);
        }
      }

      // Clean any local route references to deleted credentials
      if (credRes.ok) {
        const validIds = new Set(credRes.credentials.map(c => c.id));
        const localRoutes = db.getAiTaskRoutes();
        for (const taskKey of Object.keys(localRoutes)) {
          const r = localRoutes[taskKey];
          if (!r) continue;
          const badPrimary = r.primaryCredentialId && !r.primaryCredentialId.startsWith('env-') && !validIds.has(r.primaryCredentialId);
          const badFallback = r.fallbackCredentialId && !r.fallbackCredentialId.startsWith('env-') && !validIds.has(r.fallbackCredentialId);
          if (badPrimary || badFallback) {
            db.setAiTaskRoute(
              r.task,
              {
                ...r,
                primaryCredentialId: badPrimary ? '' : r.primaryCredentialId,
                primaryModel: badPrimary ? '' : r.primaryModel,
                fallbackCredentialId: badFallback ? '' : r.fallbackCredentialId,
                fallbackModel: badFallback ? '' : r.fallbackModel,
              },
              actor
            );
          }
        }
      }
    } catch (err: any) {
      this.recordDbFailure('hydrateFromSupabaseIfConfigured', err?.message || 'Hydration failed');
    }
  }

  /**
   * Step 1 (Fast 10-12s): Auto-detect provider, authenticate key, fetch models & choose optimal model.
   * Does NOT execute billable or slow inference so stage progress & Grok confirmations are instantaneous.
   */
  public static async discoverAutoStep(
    input: AutoConnectInput,
    actor: string = 'Super Admin',
    signal?: AbortSignal
  ): Promise<AIAutoConnectResponse & { candidateModels?: string[]; endpointUrl?: string }> {
    const now = new Date().toISOString();
    const rawKey = (input.apiKey || '').trim();
    const correlationId = generateCorrelationId('discover');

    if (!rawKey || rawKey.length < 10) {
      return {
        ok: false,
        authenticated: false,
        generationVerified: false,
        status: 'auth_failed',
        detectedProvider: input.providerOverride || null,
        billingStatus: 'unknown',
        billingNote: 'Not checked — API key input is empty or too short.',
        lastChecked: now,
        availableModels: [],
        errorCategory: 'INVALID_API_KEY',
        errorClassification: 'Invalid Key',
        failureSource: 'Browser-to-backend request',
        message: 'Please paste a valid Google Gemini or xAI Grok API key.',
        suggestedAction: 'Copy the complete API key from Google AI Studio or console.x.ai with no extra spaces.',
        correlationId,
      };
    }

    const hint = this.detectProviderHint(rawKey);
    let targetProvider: 'gemini' | 'grok' | null = input.providerOverride || (hint !== 'unknown' ? hint : null);
    let detectionMethod: AIAutoConnectResponse['detectionMethod'] = input.providerOverride
      ? 'manual_override'
      : hint !== 'unknown'
      ? 'prefix_hint_verified'
      : 'ambiguous';

    let preDiscoveredGemini: Awaited<ReturnType<typeof AIModelDiscovery.discoverGeminiModels>> | null = null;
    let preDiscoveredGrok: Awaited<ReturnType<typeof AIModelDiscovery.discoverGrokModels>> | null = null;

    if (!targetProvider) {
      let geminiDiag: AIDiagnosticError | undefined;
      let grokDiag: AIDiagnosticError | undefined;

      try {
        preDiscoveredGemini = await AIModelDiscovery.discoverGeminiModels(rawKey, signal);
        targetProvider = 'gemini';
        detectionMethod = 'probe_verified';
      } catch (err: any) {
        geminiDiag = err instanceof ProviderExecutionError ? err.diagnostic : undefined;
      }

      if (!targetProvider) {
        try {
          preDiscoveredGrok = await AIModelDiscovery.discoverGrokModels(
            rawKey,
            input.customEndpointUrl || 'https://api.x.ai/v1',
            signal
          );
          targetProvider = 'grok';
          detectionMethod = 'probe_verified';
        } catch (err: any) {
          grokDiag = err instanceof ProviderExecutionError ? err.diagnostic : undefined;
        }
      }

      if (!targetProvider) {
        if (geminiDiag?.category === 'network_error' && grokDiag?.category === 'network_error') {
          return {
            ok: false,
            authenticated: false,
            generationVerified: false,
            status: 'network_error',
            detectedProvider: null,
            detectionMethod: 'ambiguous',
            billingStatus: 'unknown',
            billingNote: 'Could not reach provider endpoints.',
            lastChecked: now,
            availableModels: [],
            errorCategory: 'SERVER_CONNECTIVITY_FAILURE',
            errorClassification: 'Network Error',
            failureSource: 'Namecheap hosting',
            message: 'Server failed to establish outbound HTTPS connections to Google Gemini and xAI Grok.',
            suggestedAction: geminiDiag.suggestedAction,
            correlationId,
          };
        }

        return {
          ok: false,
          authenticated: false,
          generationVerified: false,
          status: 'needs_provider_selection',
          requiresProviderSelection: true,
          detectedProvider: null,
          detectionMethod: 'ambiguous',
          billingStatus: 'unknown',
          billingNote: 'Select a provider so the server can run provider-specific verification.',
          lastChecked: now,
          availableModels: [],
          errorCategory: 'NEEDS_PROVIDER_SELECTION',
          errorClassification: 'Select Provider',
          failureSource: 'Browser-to-backend request',
          message: 'Could not automatically identify this key format. Select Google Gemini or xAI Grok below.',
          suggestedAction: 'Choose Google Gemini or xAI Grok below and click Validate & Connect.',
          correlationId,
        };
      }
    }

    if (targetProvider === 'gemini') {
      let discovery = preDiscoveredGemini;
      if (!discovery) {
        try {
          discovery = await AIModelDiscovery.discoverGeminiModels(rawKey, signal);
        } catch (err: any) {
          const diag =
            err instanceof ProviderExecutionError
              ? err.diagnostic
              : classifyProviderError({
                  providerType: 'gemini',
                  err,
                  stage: 'model_list',
                  correlationId,
                  secretToRedact: rawKey,
                });

          const errorCategory = mapDiagnosticToAutoCategory(diag, 0);
          const testEntry: AIConnectionTestRecord = {
            id: `aitest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            providerType: 'gemini',
            stage: 'model_list',
            ok: false,
            connectionStatus: diag.connectionStatus,
            modelListOk: false,
            generationOk: false,
            modelsDiscoveredCount: 0,
            latencyMs: 0,
            diagnostic: diag,
            actor,
            timestamp: now,
          };
          db.recordAiConnectionTest(testEntry);
          if (isSupabaseConfigured()) recordSupabaseAiConnectionTest(testEntry).catch(() => {});

          return {
            ok: false,
            authenticated: false,
            generationVerified: false,
            status: diag.connectionStatus,
            detectedProvider: 'gemini',
            detectionMethod,
            billingStatus:
              errorCategory === 'FREE_TIER_QUOTA_EXCEEDED'
                ? 'quota_exceeded'
                : errorCategory === 'BILLING_REQUIRED'
                ? 'billing_required'
                : 'unknown',
            billingNote: diag.title,
            lastChecked: now,
            availableModels: [],
            errorCategory,
            errorClassification: diag.title,
            failureSource: diag.failureSource || 'Google API',
            message: diag.diagnosis,
            suggestedAction: diag.suggestedAction,
            correlationId: diag.correlationId,
          };
        }
      }

      if (discovery.models.length === 0) {
        return {
          ok: false,
          authenticated: true,
          generationVerified: false,
          status: 'endpoint_not_found',
          detectedProvider: 'gemini',
          detectionMethod,
          billingStatus: 'unknown',
          billingNote: 'Authenticated, but 0 accessible models returned.',
          lastChecked: now,
          latencyMs: discovery.latencyMs,
          availableModels: [],
          errorCategory: 'NO_ACCESSIBLE_MODELS',
          errorClassification: 'Model Unavailable',
          failureSource: 'Google API',
          message: 'Authenticated with Google Gemini, but no models were returned for this API key.',
          suggestedAction: 'Verify the Generative Language API is enabled in your Google Cloud project.',
          correlationId: discovery.correlationId,
        };
      }

      const selection = selectAutoGeminiModel(discovery.models, Boolean(input.allowPaidModels));
      const explicitModel = input.preferredModel?.trim();

      if (!explicitModel && !selection.selectedModel) {
        if (selection.onlyPaidAvailable) {
          return {
            ok: false,
            authenticated: true,
            generationVerified: false,
            status: 'billing_required',
            detectedProvider: 'gemini',
            detectionMethod,
            billingStatus: 'billing_required',
            billingNote: 'Only paid-tier Gemini models discovered; free-tier auto-connect skipped paid models.',
            lastChecked: now,
            latencyMs: discovery.latencyMs,
            availableModels: discovery.models,
            errorCategory: 'BILLING_REQUIRED',
            errorClassification: 'Billing Required',
            failureSource: 'Google API',
            message: 'No free-tier eligible Gemini text model was found on this key.',
            suggestedAction: 'Use a free-tier Google AI Studio key with Gemini Flash access.',
            correlationId: discovery.correlationId,
          };
        }
        return {
          ok: false,
          authenticated: true,
          generationVerified: false,
          status: 'endpoint_not_found',
          detectedProvider: 'gemini',
          detectionMethod,
          billingStatus: 'unknown',
          billingNote: 'No supported text-generation model available.',
          lastChecked: now,
          latencyMs: discovery.latencyMs,
          availableModels: discovery.models,
          errorCategory: 'NO_ACCESSIBLE_MODELS',
          errorClassification: 'Model Unavailable',
          failureSource: 'Google API',
          message: 'No supported text-generation Gemini models were found for this API key.',
          suggestedAction: 'Verify your Google AI Studio key has access to Gemini text models.',
          correlationId: discovery.correlationId,
        };
      }

      const candidates = explicitModel
        ? [explicitModel]
        : selection.freeTierCandidates.length > 0
        ? selection.freeTierCandidates.slice(0, 2)
        : selection.allCandidates.slice(0, 2);

      return {
        ok: true,
        authenticated: true,
        generationVerified: false,
        status: 'authenticated',
        detectedProvider: 'gemini',
        detectionMethod,
        selectedModel: candidates[0],
        candidateModels: candidates,
        billingStatus: isFreeTierGeminiModel(candidates[0]) ? 'free_tier' : 'unknown',
        billingNote: isFreeTierGeminiModel(candidates[0]) ? 'Free Tier Eligible' : 'Model Selected',
        lastChecked: now,
        latencyMs: discovery.latencyMs,
        availableModels: discovery.models,
        message: `Authenticated with Google Gemini (${discovery.models.length} models found). Selected ${candidates[0]}.`,
        correlationId: discovery.correlationId,
      };
    }

    // ==================== GROK (xAI) DISCOVERY STEP ====================
    const endpointUrl = (input.customEndpointUrl || 'https://api.x.ai/v1').trim();
    let grokDiscovery = preDiscoveredGrok;
    if (!grokDiscovery) {
      try {
        grokDiscovery = await AIModelDiscovery.discoverGrokModels(rawKey, endpointUrl, signal);
      } catch (err: any) {
        const diag =
          err instanceof ProviderExecutionError
            ? err.diagnostic
            : classifyProviderError({
                providerType: 'grok',
                err,
                stage: 'model_list',
                correlationId,
                secretToRedact: rawKey,
              });
        const errorCategory = mapDiagnosticToAutoCategory(diag, 0);
        const testEntry: AIConnectionTestRecord = {
          id: `aitest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          providerType: 'grok',
          stage: 'model_list',
          ok: false,
          connectionStatus: diag.connectionStatus,
          modelListOk: false,
          generationOk: false,
          modelsDiscoveredCount: 0,
          latencyMs: 0,
          diagnostic: diag,
          actor,
          timestamp: now,
        };
        db.recordAiConnectionTest(testEntry);
        if (isSupabaseConfigured()) recordSupabaseAiConnectionTest(testEntry).catch(() => {});

        return {
          ok: false,
          authenticated: false,
          generationVerified: false,
          status: diag.connectionStatus,
          detectedProvider: 'grok',
          detectionMethod,
          billingStatus: errorCategory === 'BILLING_REQUIRED' ? 'billing_required' : 'credits_required',
          billingNote: diag.title,
          lastChecked: now,
          availableModels: [],
          errorCategory,
          errorClassification: diag.title,
          failureSource: diag.failureSource || 'xAI API',
          message: diag.diagnosis,
          suggestedAction: diag.suggestedAction,
          correlationId: diag.correlationId,
        };
      }
    }

    if (grokDiscovery.models.length === 0) {
      return {
        ok: false,
        authenticated: true,
        generationVerified: false,
        status: 'endpoint_not_found',
        detectedProvider: 'grok',
        detectionMethod,
        billingStatus: 'credits_required',
        billingNote: 'Authenticated, but no accessible Grok models returned.',
        lastChecked: now,
        latencyMs: grokDiscovery.latencyMs,
        availableModels: [],
        errorCategory: 'NO_ACCESSIBLE_MODELS',
        errorClassification: 'Model Unavailable',
        failureSource: 'xAI API',
        message: 'Authenticated with xAI, but no compatible text models were returned by /v1/models.',
        suggestedAction: 'Check key ACL scopes and billing credits at console.x.ai.',
        correlationId: grokDiscovery.correlationId,
      };
    }

    const keyMeta = await AIModelDiscovery.inspectGrokApiKeyMetadata(rawKey, endpointUrl, signal);
    if (keyMeta?.keyBlocked) {
      return {
        ok: false,
        authenticated: false,
        generationVerified: false,
        status: 'permission_denied',
        detectedProvider: 'grok',
        detectionMethod,
        billingStatus: 'billing_required',
        billingNote: 'Key or team is blocked/disabled on xAI.',
        lastChecked: now,
        latencyMs: grokDiscovery.latencyMs,
        availableModels: grokDiscovery.models,
        errorCategory: 'PERMISSION_DENIED',
        errorClassification: 'Permission Denied',
        failureSource: 'xAI API',
        message: 'xAI reports this API key or team account is currently blocked or disabled.',
        suggestedAction: 'Review team status and prepaid credits in console.x.ai.',
        correlationId: grokDiscovery.correlationId,
      };
    }

    const chosenGrokModel =
      input.preferredModel?.trim() ||
      selectAutoGrokModel(grokDiscovery.models) ||
      grokDiscovery.recommendedModel ||
      '';

    if (!chosenGrokModel) {
      return {
        ok: false,
        authenticated: true,
        generationVerified: false,
        status: 'endpoint_not_found',
        detectedProvider: 'grok',
        detectionMethod,
        billingStatus: 'credits_required',
        billingNote: 'No supported text generation model found.',
        lastChecked: now,
        latencyMs: grokDiscovery.latencyMs,
        availableModels: grokDiscovery.models,
        errorCategory: 'NO_ACCESSIBLE_MODELS',
        errorClassification: 'Model Unavailable',
        failureSource: 'xAI API',
        message: 'No text-generation Grok model was found for this key.',
        correlationId: grokDiscovery.correlationId,
      };
    }

    // Never assume Grok has a free tier — require explicit admin confirmation before running test inference
    if (!input.confirmBillableTest) {
      return {
        ok: false,
        authenticated: true,
        generationVerified: false,
        status: 'awaiting_confirmation',
        requiresBillableConfirmation: true,
        detectedProvider: 'grok',
        detectionMethod,
        selectedModel: chosenGrokModel,
        endpointUrl,
        billingStatus: 'credits_required',
        billingNote: 'xAI Grok uses prepaid credits / billing (no free tier). Confirmation required before test generation.',
        lastChecked: now,
        latencyMs: grokDiscovery.latencyMs,
        availableModels: grokDiscovery.models,
        errorCategory: 'CONFIRMATION_REQUIRED',
        errorClassification: 'Billing Confirmation Required',
        message: `xAI Grok key authenticated (${grokDiscovery.models.length} models found, selected ${chosenGrokModel}). Confirm to run a small (~10 token) live test and activate Grok.`,
        suggestedAction: 'Click "Confirm & Connect Grok" to run the small verification test.',
        correlationId: grokDiscovery.correlationId,
      };
    }

    return {
      ok: true,
      authenticated: true,
      generationVerified: false,
      status: 'authenticated',
      detectedProvider: 'grok',
      detectionMethod,
      selectedModel: chosenGrokModel,
      candidateModels: [chosenGrokModel],
      endpointUrl,
      billingStatus: 'credits_required',
      billingNote: 'Prepaid Credits / Billing Required by xAI',
      lastChecked: now,
      latencyMs: grokDiscovery.latencyMs,
      availableModels: grokDiscovery.models,
      message: `Authenticated with xAI Grok (${chosenGrokModel}). Ready for generation test.`,
      correlationId: grokDiscovery.correlationId,
    };
  }

  /**
   * Step 2 (45s-60s bounded window): Executes lightweight generation test using verified model,
   * logs failed attempts cleanly, retries at most once on transient timeout/5xx, and saves on pass.
   */
  public static async verifyGenerationAutoStep(
    input: AutoConnectInput & {
      providerType: 'gemini' | 'grok';
      selectedModel: string;
      candidateModels?: string[];
      availableModels?: AIModelInfo[];
      detectionMethod?: AIAutoConnectResponse['detectionMethod'];
    },
    actor: string = 'Super Admin',
    signal?: AbortSignal
  ): Promise<AIAutoConnectResponse> {
    const now = new Date().toISOString();
    const rawKey = (input.apiKey || '').trim();
    const correlationId = generateCorrelationId('gentest');

    if (input.providerType === 'gemini') {
      const candidates =
        Array.isArray(input.candidateModels) && input.candidateModels.length > 0
          ? input.candidateModels
          : [input.selectedModel];
      const availableModels = input.availableModels || [];

      let genRes: Awaited<ReturnType<typeof GeminiProvider.testGeneration>> | null = null;
      let lastGenDiag: AIDiagnosticError | undefined;
      const totalDeadlineMs = Date.now() + Math.min(58000, getGenerationTimeoutMs() + 10000);

      for (const candidateModel of candidates) {
        if (signal?.aborted) break;
        const remainingMs = totalDeadlineMs - Date.now();
        if (remainingMs < 10000) break;

        try {
          genRes = await GeminiProvider.testGeneration(rawKey, candidateModel, signal, {
            timeoutMs: getGenerationTimeoutMs(),
            retryOnTransient: true,
            deadlineMs: totalDeadlineMs,
          });
          break;
        } catch (err: any) {
          const diag =
            err instanceof ProviderExecutionError
              ? err.diagnostic
              : classifyProviderError({
                  providerType: 'gemini',
                  err,
                  model: candidateModel,
                  stage: 'generation_test',
                  authenticated: true,
                  correlationId,
                  secretToRedact: rawKey,
                  timeoutWindowMs: getGenerationTimeoutMs(),
                });
          lastGenDiag = diag;

          // Only switch to next permitted free-tier candidate on 404/400 model issue; never auto-switch to paid or loop on timeout
          if (diag.category !== 'not_found_404' && diag.category !== 'bad_request_400') {
            break;
          }
        }
      }

      if (!genRes) {
        const errorCategory = mapDiagnosticToAutoCategory(lastGenDiag, availableModels.length);
        const billingStatus: AIBillingStatus =
          errorCategory === 'FREE_TIER_QUOTA_EXCEEDED'
            ? 'quota_exceeded'
            : errorCategory === 'BILLING_REQUIRED'
            ? 'billing_required'
            : 'unknown';

        const testEntry: AIConnectionTestRecord = {
          id: `aitest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          providerType: 'gemini',
          modelTested: lastGenDiag?.category === 'not_found_404' ? candidates[candidates.length - 1] : candidates[0],
          stage: 'generation_test',
          ok: false,
          connectionStatus: lastGenDiag?.connectionStatus || 'authenticated_generation_unavailable',
          modelListOk: true,
          generationOk: false,
          modelsDiscoveredCount: availableModels.length,
          latencyMs: Date.now() - new Date(now).getTime(),
          diagnostic: lastGenDiag,
          actor,
          timestamp: now,
        };
        db.recordAiConnectionTest(testEntry);
        if (isSupabaseConfigured()) recordSupabaseAiConnectionTest(testEntry).catch(() => {});

        const isTimeout = lastGenDiag?.category === 'timeout';
        return {
          ok: false,
          authenticated: true,
          generationVerified: false,
          status: lastGenDiag?.connectionStatus || 'authenticated_generation_unavailable',
          detectedProvider: 'gemini',
          detectionMethod: input.detectionMethod || 'prefix_hint_verified',
          selectedModel: candidates[0],
          billingStatus,
          billingNote:
            billingStatus === 'quota_exceeded'
              ? 'Key valid; free-tier quota exceeded (HTTP 429).'
              : billingStatus === 'billing_required'
              ? 'Billing required on this project.'
              : isTimeout
              ? 'Credentials verified — generation timed out'
              : lastGenDiag?.title || 'Generation test failed',
          lastChecked: now,
          latencyMs: testEntry.latencyMs,
          availableModels,
          errorCategory,
          errorClassification: lastGenDiag?.title || (isTimeout ? 'Generation Timeout' : 'Generation Failed'),
          failureSource: lastGenDiag?.failureSource || 'Google API',
          message:
            isTimeout
              ? 'Gemini credentials verified, but the generation test timed out. Your key may be valid.'
              : lastGenDiag?.diagnosis || 'Gemini credentials verified, but generation test failed.',
          suggestedAction: lastGenDiag?.suggestedAction,
          correlationId: lastGenDiag?.correlationId || correlationId,
          canRetryGeneration: true,
        };
      }

      const isFree = isFreeTierGeminiModel(genRes.model);
      const billingStatus: AIBillingStatus = isFree ? 'free_tier' : 'unknown';
      const billingNote = isFree
        ? 'Free Tier Confirmed (No unexpected billing charges)'
        : 'Verified Model Connected';

      const savedCred = await this.persistAutoConnectedCredential({
        providerType: 'gemini',
        rawKey,
        selectedModel: genRes.model,
        availableModels,
        billingStatus,
        billingNote,
        latencyMs: genRes.latencyMs,
        correlationId: genRes.correlationId,
        sampleOutput: genRes.text,
        replaceCredentialId: input.replaceCredentialId,
        now,
        actor,
      });

      return {
        ok: true,
        authenticated: true,
        generationVerified: true,
        status: 'connected',
        detectedProvider: 'gemini',
        detectionMethod: input.detectionMethod || 'prefix_hint_verified',
        selectedModel: genRes.model,
        billingStatus,
        billingNote,
        lastChecked: now,
        latencyMs: genRes.latencyMs,
        availableModels,
        sampleOutput: redactSecrets(genRes.text.slice(0, 100), rawKey),
        message: `Connected to Google Gemini (${genRes.model}) and activated across all bilingual AI tools (${genRes.latencyMs}ms).`,
        correlationId: genRes.correlationId,
        provider: this.sanitizeCredential(savedCred),
      };
    }

    // ==================== GROK GENERATION TEST ====================
    if (!input.confirmBillableTest) {
      return {
        ok: false,
        authenticated: true,
        generationVerified: false,
        status: 'awaiting_confirmation',
        requiresBillableConfirmation: true,
        detectedProvider: 'grok',
        detectionMethod: input.detectionMethod || 'prefix_hint_verified',
        selectedModel: input.selectedModel,
        billingStatus: 'credits_required',
        billingNote: 'xAI Grok requires explicit confirmation before running a test generation.',
        lastChecked: now,
        availableModels: input.availableModels || [],
        errorCategory: 'CONFIRMATION_REQUIRED',
        errorClassification: 'Billing Confirmation Required',
        message: `xAI Grok key authenticated. Confirm to run a minimal (~10 token) live test on ${input.selectedModel}.`,
        suggestedAction: 'Click "Confirm & Connect Grok" to proceed.',
        correlationId,
      };
    }

    const endpointUrl = (input.customEndpointUrl || 'https://api.x.ai/v1').trim();
    const grokValidation = await GrokProvider.testConnection(
      rawKey,
      input.selectedModel,
      endpointUrl,
      signal,
      true,
      'grok'
    );

    const testEntry: AIConnectionTestRecord = {
      id: `aitest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      providerType: 'grok',
      modelTested: grokValidation.selectedModel || input.selectedModel,
      stage: 'generation_test',
      ok: grokValidation.ok,
      connectionStatus: grokValidation.connectionStatus,
      modelListOk: grokValidation.authenticated,
      generationOk: grokValidation.generationVerified,
      modelsDiscoveredCount: grokValidation.availableModels.length,
      latencyMs: grokValidation.latencyMs,
      sampleOutput: grokValidation.sampleOutput ? redactSecrets(grokValidation.sampleOutput, rawKey) : undefined,
      diagnostic: grokValidation.diagnostic,
      actor,
      timestamp: now,
    };
    db.recordAiConnectionTest(testEntry);
    if (isSupabaseConfigured()) recordSupabaseAiConnectionTest(testEntry).catch(() => {});

    if (!grokValidation.ok) {
      const errorCategory = mapDiagnosticToAutoCategory(
        grokValidation.diagnostic,
        grokValidation.availableModels.length
      );
      return {
        ok: false,
        authenticated: grokValidation.authenticated,
        generationVerified: false,
        status: grokValidation.connectionStatus,
        detectedProvider: 'grok',
        detectionMethod: input.detectionMethod || 'prefix_hint_verified',
        selectedModel: input.selectedModel,
        billingStatus: errorCategory === 'BILLING_REQUIRED' ? 'billing_required' : 'credits_required',
        billingNote:
          errorCategory === 'BILLING_REQUIRED'
            ? 'xAI requires prepaid credits or billing enabled before generation.'
            : grokValidation.diagnostic?.title || 'Grok live test failed',
        lastChecked: now,
        latencyMs: grokValidation.latencyMs,
        availableModels: grokValidation.availableModels,
        errorCategory,
        errorClassification: grokValidation.diagnostic?.title || 'Grok Test Failed',
        failureSource: grokValidation.diagnostic?.failureSource || 'xAI API',
        message: grokValidation.message,
        suggestedAction: grokValidation.diagnostic?.suggestedAction,
        correlationId: grokValidation.correlationId,
        canRetryGeneration: true,
      };
    }

    const billingStatus: AIBillingStatus = 'credits_required';
    const billingNote = 'Credits / Billing Active on xAI';
    const savedGrok = await this.persistAutoConnectedCredential({
      providerType: 'grok',
      rawKey,
      selectedModel: grokValidation.selectedModel || input.selectedModel,
      endpointUrl,
      availableModels: grokValidation.availableModels,
      billingStatus,
      billingNote,
      latencyMs: grokValidation.latencyMs,
      correlationId: grokValidation.correlationId,
      sampleOutput: grokValidation.sampleOutput,
      replaceCredentialId: input.replaceCredentialId,
      now,
      actor,
    });

    return {
      ok: true,
      authenticated: true,
      generationVerified: true,
      status: 'connected',
      detectedProvider: 'grok',
      detectionMethod: input.detectionMethod || 'prefix_hint_verified',
      selectedModel: savedGrok.model,
      billingStatus,
      billingNote,
      lastChecked: now,
      latencyMs: grokValidation.latencyMs,
      availableModels: grokValidation.availableModels,
      sampleOutput: grokValidation.sampleOutput
        ? redactSecrets(grokValidation.sampleOutput.slice(0, 100), rawKey)
        : undefined,
      message: `Connected to xAI Grok (${savedGrok.model}) and activated across all editorial & SEO tools (${grokValidation.latencyMs}ms).`,
      correlationId: grokValidation.correlationId,
      provider: this.sanitizeCredential(savedGrok),
    };
  }

  /**
   * One-Click Universal Auto-Detect, Validate, Persist & Activate Flow (runs discovery + generation cleanly).
   */
  public static async connectAutomatically(
    input: AutoConnectInput,
    actor: string = 'Super Admin',
    signal?: AbortSignal
  ): Promise<AIAutoConnectResponse> {
    const discoveryStep = await this.discoverAutoStep(input, actor, signal);
    if (!discoveryStep.ok || !discoveryStep.detectedProvider || !discoveryStep.selectedModel) {
      return discoveryStep;
    }

    return this.verifyGenerationAutoStep(
      {
        ...input,
        providerType: discoveryStep.detectedProvider as 'gemini' | 'grok',
        selectedModel: discoveryStep.selectedModel,
        candidateModels: discoveryStep.candidateModels,
        availableModels: discoveryStep.availableModels,
        detectionMethod: discoveryStep.detectionMethod,
        customEndpointUrl: discoveryStep.endpointUrl || input.customEndpointUrl,
      },
      actor,
      signal
    );
  }

  private static async persistAutoConnectedCredential(params: {
    providerType: 'gemini' | 'grok';
    rawKey: string;
    selectedModel: string;
    endpointUrl?: string;
    availableModels: AIModelInfo[];
    billingStatus: AIBillingStatus;
    billingNote: string;
    latencyMs: number;
    correlationId: string;
    sampleOutput?: string;
    replaceCredentialId?: string;
    now: string;
    actor: string;
  }): Promise<AIProviderCredential> {
    const existingList = db.getAiProviders();
    const masked = maskSecret(params.rawKey);

    let targetExisting = params.replaceCredentialId
      ? existingList.find(c => c.id === params.replaceCredentialId)
      : existingList.find(
          c => c.providerType === params.providerType && c.maskedKey === masked
        );

    const recordId =
      targetExisting?.id ||
      `aik-${params.providerType}-primary-${Date.now().toString(36)}`;

    const cred: AIProviderCredential = {
      id: recordId,
      providerType: params.providerType,
      label:
        targetExisting?.label ||
        (params.providerType === 'gemini' ? 'Google Gemini (Auto-Connected)' : 'xAI Grok (Auto-Connected)'),
      projectId:
        targetExisting?.projectId ||
        `${params.providerType}-auto-${recordId.slice(-4)}`,
      endpointUrl:
        params.endpointUrl ||
        targetExisting?.endpointUrl ||
        (params.providerType === 'grok' ? 'https://api.x.ai/v1' : undefined),
      model: params.selectedModel,
      encryptedSecret: encryptSecret(params.rawKey),
      maskedKey: masked,
      enabled: true,
      priority: 1,
      dailyTokenLimit: targetExisting?.dailyTokenLimit || 500000,
      dailyTokensUsed: targetExisting?.dailyTokensUsed || 0,
      monthlyBudgetUsd: targetExisting?.monthlyBudgetUsd || (params.providerType === 'gemini' ? 0 : 25),
      monthlySpendUsd: targetExisting?.monthlySpendUsd || 0,
      availableModels: params.availableModels,
      connectionStatus: 'connected',
      billingStatus: params.billingStatus,
      billingNote: params.billingNote,
      modelListStatus: 'ok',
      generationTestStatus: 'ok',
      lastTestedAt: params.now,
      lastSuccessfulVerificationAt: params.now,
      lastSuccessfulGenerationAt: params.now,
      lastFailureAt: targetExisting?.lastFailureAt || null,
      lastTestStatus: 'connected',
      lastTestMessage: `Connected via ${params.selectedModel} (${params.billingNote})`,
      lastDiagnostic: null,
      lastLatencyMs: params.latencyMs,
      lastCorrelationId: params.correlationId,
      createdAt: targetExisting?.createdAt || params.now,
      updatedAt: params.now,
    };

    // Demote any older non-replaced credentials' priority so the newly connected key leads routing cleanly
    // without deleting existing keys unless replaced/disconnected.
    for (const prev of existingList) {
      if (prev.id !== cred.id && (prev.priority || 10) <= 1) {
        const demoted = { ...prev, priority: (prev.priority || 1) + 10, updatedAt: params.now };
        db.upsertAiProvider(demoted, params.actor);
        if (isSupabaseConfigured()) upsertSupabaseAiCredential(demoted).catch(() => {});
      }
    }

    if (isSupabaseConfigured()) {
      const sbRes = await upsertSupabaseAiCredential(creditSafeRecord(cred));
      if (!sbRes.ok || !sbRes.credential) {
        const msg = sbRes.error || 'Failed persisting connected credential to Supabase.';
        this.recordDbFailure('upsertSupabaseAiCredential', msg, sbRes.code);
        throw new Error(`Supabase persistence failed: ${msg}`);
      }
      const saved = db.upsertAiProvider(sbRes.credential, params.actor);
      this.lastSuccessfulSaveAt = params.now;

      const testEntry: AIConnectionTestRecord = {
        id: `aitest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        credentialId: saved.id,
        providerType: params.providerType,
        modelTested: params.selectedModel,
        stage: 'generation_test',
        ok: true,
        connectionStatus: 'connected',
        modelListOk: true,
        generationOk: true,
        modelsDiscoveredCount: params.availableModels.length,
        latencyMs: params.latencyMs,
        sampleOutput: params.sampleOutput ? redactSecrets(params.sampleOutput, params.rawKey) : undefined,
        actor: params.actor,
        timestamp: params.now,
      };
      db.recordAiConnectionTest(testEntry);
      recordSupabaseAiConnectionTest(testEntry).catch(() => {});
      await this.syncRoutesForCredential(saved.id, params.selectedModel, params.actor);
      return saved;
    }

    const saved = db.upsertAiProvider(cred, params.actor);
    this.lastSuccessfulSaveAt = params.now;

    const testEntry: AIConnectionTestRecord = {
      id: `aitest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      credentialId: saved.id,
      providerType: params.providerType,
      modelTested: params.selectedModel,
      stage: 'generation_test',
      ok: true,
      connectionStatus: 'connected',
      modelListOk: true,
      generationOk: true,
      modelsDiscoveredCount: params.availableModels.length,
      latencyMs: params.latencyMs,
      sampleOutput: params.sampleOutput ? redactSecrets(params.sampleOutput, params.rawKey) : undefined,
      actor: params.actor,
      timestamp: params.now,
    };
    db.recordAiConnectionTest(testEntry);

    await this.syncRoutesForCredential(saved.id, params.selectedModel, params.actor);
    return saved;
  }

  public static async disconnectCredential(
    credentialId?: string,
    actor: string = 'Super Admin'
  ): Promise<{ ok: boolean; notFound?: boolean; deletedCount?: number; disconnectedId?: string; message: string }> {
    if (isSupabaseConfigured()) {
      await this.hydrateFromSupabaseIfConfigured(actor);
    }

    // Handle server environment fallback key removal via suppression
    if (credentialId === 'env-gemini-default' || credentialId === 'env-grok-default') {
      const providerKey = credentialId === 'env-gemini-default' ? 'gemini' : 'grok';
      db.setAiEnvSuppressed({ [providerKey]: true });
      if (isSupabaseConfigured()) {
        const flagRes = await setSupabaseAiEnvSuppression(db.getAiEnvSuppressed());
        if (!flagRes.ok) {
          this.recordDbFailure('setSupabaseAiEnvSuppression', flagRes.error || 'Failed saving env suppression');
          return {
            ok: false,
            deletedCount: 0,
            message: `Failed suppressing environment variable in Supabase: ${flagRes.error}`,
          };
        }
      }

      const routes = db.getAiTaskRoutes();
      const updatedRoutes: AITaskRouting[] = [];
      for (const spec of AI_TASK_CATALOG) {
        const r = routes[spec.task];
        if (!r) continue;
        if (r.primaryCredentialId === credentialId || r.fallbackCredentialId === credentialId) {
          const nextRoute: AITaskRouting = {
            ...r,
            primaryCredentialId: r.primaryCredentialId === credentialId ? '' : r.primaryCredentialId,
            primaryModel: r.primaryCredentialId === credentialId ? '' : r.primaryModel,
            fallbackCredentialId: r.fallbackCredentialId === credentialId ? '' : r.fallbackCredentialId,
            fallbackModel: r.fallbackCredentialId === credentialId ? '' : r.fallbackModel,
          };
          db.setAiTaskRoute(spec.task, nextRoute, actor);
          updatedRoutes.push(nextRoute);
        }
      }
      if (updatedRoutes.length > 0 && isSupabaseConfigured()) {
        await upsertSupabaseAiTaskRoutes(updatedRoutes).catch(() => {});
      }
      this.lastSuccessfulDeleteAt = new Date().toISOString();
      return {
        ok: true,
        deletedCount: 1,
        disconnectedId: credentialId,
        message: `Suppressed runtime loading of ${
          providerKey === 'gemini' ? 'GEMINI_API_KEY' : 'XAI_API_KEY'
        } environment fallback.`,
      };
    }

    const creds = db.getAiProviders();
    const target = credentialId
      ? creds.find(c => c.id === credentialId)
      : creds.find(c => c.enabled && c.connectionStatus === 'connected') ||
        creds.find(c => c.enabled) ||
        creds[0];

    if (!target) {
      if (credentialId) {
        return {
          ok: false,
          notFound: true,
          deletedCount: 0,
          message: `AI credential "${credentialId}" was not found or already deleted.`,
        };
      }
      return { ok: true, deletedCount: 0, message: 'No active stored AI API key to disconnect.' };
    }

    // Step 1: Clear or rebind dependent task routes FIRST so FK references never block delete
    const remaining = creds.filter(
      c => c.id !== target.id && c.enabled && c.connectionStatus === 'connected'
    );
    const nextFallback = remaining[0];
    const routes = db.getAiTaskRoutes();
    const updatedRoutes: AITaskRouting[] = [];
    for (const spec of AI_TASK_CATALOG) {
      const r = routes[spec.task];
      if (!r) continue;
      if (r.primaryCredentialId === target.id || r.fallbackCredentialId === target.id) {
        const nextRoute: AITaskRouting = {
          ...r,
          primaryCredentialId:
            r.primaryCredentialId === target.id ? nextFallback?.id || '' : r.primaryCredentialId,
          primaryModel:
            r.primaryCredentialId === target.id ? nextFallback?.model || '' : r.primaryModel,
          fallbackCredentialId: r.fallbackCredentialId === target.id ? '' : r.fallbackCredentialId,
          fallbackModel: r.fallbackCredentialId === target.id ? '' : r.fallbackModel,
        };
        updatedRoutes.push(nextRoute);
      }
    }

    if (updatedRoutes.length > 0 && isSupabaseConfigured()) {
      const routeClearRes = await upsertSupabaseAiTaskRoutes(updatedRoutes);
      if (!routeClearRes.ok) {
        this.recordDbFailure(
          'upsertSupabaseAiTaskRoutes',
          routeClearRes.error || 'Failed clearing dependent task routes before delete',
          routeClearRes.code
        );
      }
    }

    // Step 2: Authoritatively delete from Supabase & verify 0 residual rows
    if (isSupabaseConfigured()) {
      const sbDel = await deleteSupabaseAiCredential(target.id);
      if (!sbDel.ok) {
        this.recordDbFailure('deleteSupabaseAiCredential', sbDel.error || 'Delete failed', sbDel.code);
        return {
          ok: false,
          notFound: sbDel.code === 'NOT_FOUND',
          deletedCount: 0,
          message: sbDel.error || 'Failed deleting AI credential from Supabase.',
        };
      }
    }

    // Step 3: Commit local route cleanup & credential removal
    for (const nextRoute of updatedRoutes) {
      db.setAiTaskRoute(nextRoute.task, nextRoute, actor);
    }
    const localRemoved = db.deleteAiProvider(target.id, actor);
    this.lastSuccessfulDeleteAt = new Date().toISOString();

    return {
      ok: true,
      deletedCount: localRemoved ? 1 : 0,
      disconnectedId: target.id,
      message: `Deleted ${
        target.providerType === 'gemini'
          ? 'Google Gemini'
          : target.providerType === 'grok'
          ? 'xAI Grok'
          : 'Custom'
      } credential "${target.label}" (${target.maskedKey}).`,
    };
  }
}

function creditSafeRecord(c: AIProviderCredential): AIProviderCredential {
  return c;
}
