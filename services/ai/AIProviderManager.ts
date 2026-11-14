/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Centralized AI Provider Lifecycle, Validation, Discovery & Health Manager
 */

import { db } from '../../src/server/db.ts';
import { encryptSecret, decryptSecret, maskSecret } from '../../src/server/crypto.ts';
import {
  AIConnectionStatus,
  AIConnectionTestRecord,
  AIModelInfo,
  AIProviderCredential,
  AIProviderType,
  AIValidationResult,
} from '../../src/types/index.ts';
import {
  checkOutboundConnectivity,
  classifyProviderError,
  generateCorrelationId,
  ProviderExecutionError,
  redactSecrets,
} from './AIConnectionValidator.ts';
import { AIModelDiscovery } from './AIModelDiscovery.ts';
import { GeminiProvider } from './GeminiProvider.ts';
import { GrokProvider } from './GrokProvider.ts';

export interface ValidateProviderInput {
  providerType: AIProviderType;
  apiKey?: string;
  credentialId?: string;
  endpointUrl?: string;
  model?: string;
  runGenerationTest?: boolean;
}

export class AIProviderManager {
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

  public static resolveRawCredential(credId: string): { cred: AIProviderCredential; rawKey: string } | null {
    if (credId === 'env-gemini-default' && process.env.GEMINI_API_KEY) {
      const rawKey = process.env.GEMINI_API_KEY.trim();
      return {
        cred: {
          id: 'env-gemini-default',
          providerType: 'gemini',
          label: 'Server Environment GEMINI_API_KEY',
          projectId: process.env.GOOGLE_CLOUD_PROJECT || 'env-gemini-project',
          model: 'gemini-3.5-flash-lite',
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

    if (credId === 'env-grok-default' && process.env.XAI_API_KEY) {
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
    const rawKey = decryptSecret(found.encryptedSecret);
    return { cred: found, rawKey };
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

    if (!rawKey && input.credentialId) {
      const resolved = this.resolveRawCredential(input.credentialId);
      if (resolved) {
        rawKey = resolved.rawKey;
        providerType = resolved.cred.providerType;
        endpointUrl = endpointUrl || resolved.cred.endpointUrl;
        preferredModel = preferredModel || resolved.cred.model;
      }
    }

    const runGenerationTest = input.runGenerationTest !== false;

    if (!rawKey) {
      const diag = classifyProviderError({
        providerType,
        httpStatus: 401,
        providerMessage: 'API key input is empty.',
        stage: 'model_list',
      });
      return {
        ok: false,
        authenticated: false,
        generationVerified: false,
        connectionStatus: 'auth_failed',
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
    db.recordAiConnectionTest(testRecord);

    return result;
  }

  public static addOrUpdateCredential(
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
      validationResult?: AIValidationResult;
    },
    actor: string
  ): AIProviderCredential {
    const existing = input.id ? db.getAiProviders().find(p => p.id === input.id) : undefined;
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
    }

    const defaultEndpoint =
      input.providerType === 'grok' ? 'https://api.x.ai/v1' : undefined;

    const record: AIProviderCredential = {
      id: existing?.id || `aik-${input.providerType}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      providerType: input.providerType,
      label: input.label.trim(),
      projectId: input.projectId.trim(),
      endpointUrl: input.endpointUrl?.trim() || existing?.endpointUrl || defaultEndpoint,
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

    const saved = db.upsertAiProvider(record, actor);
    return this.sanitizeCredential(saved);
  }

  public static updateCredentialPartial(
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
      validationResult?: AIValidationResult;
    },
    actor: string
  ): AIProviderCredential {
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
        validationResult: patch.validationResult,
      },
      actor
    );
  }

  public static async testSavedCredential(credId: string, actor: string): Promise<AIValidationResult> {
    const resolved = this.resolveRawCredential(credId);
    if (!resolved) {
      throw new Error('AI credential not found.');
    }
    const { cred, rawKey } = resolved;

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
      db.upsertAiProvider(
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
      const rawKey = decryptSecret(cred.encryptedSecret);
      const start = Date.now();
      const correlationId = generateCorrelationId('hc');
      try {
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

  public static async getDiagnostics() {
    const connectivity = await checkOutboundConnectivity();
    const cachedHealth = db.getAiHealthStatus();
    const recentTests = db.getAiConnectionTests(undefined, 25);
    return {
      connectivity,
      lastHealthCheck: cachedHealth,
      recentTests,
    };
  }
}
