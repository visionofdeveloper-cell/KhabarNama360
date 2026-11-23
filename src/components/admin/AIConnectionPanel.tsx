/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Simplified One-Click AI API Connection, Reset & Diagnostics Panel
 */

import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Power,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  AIAutoConnectResponse,
  AIBillingStatus,
  AIConnectionStatus,
  AIFailureSource,
  AIModelInfo,
  AIProviderCredential,
  AIProviderType,
} from '../../types/index.ts';
import { safeFetchJson } from '../../utils/safeFetch.ts';

interface AIConnectionPanelProps {
  onNotify?: (msg: string) => void;
  onProvidersChanged?: () => void;
  onOpenAdvancedVault?: () => void;
  embeddedInAdvancedVault?: boolean;
  advancedContent?: React.ReactNode;
  refreshKey?: number;
}

type LiveProgressStage =
  | 'idle'
  | 'Checking Credentials'
  | 'Fetching Models'
  | 'Authenticated'
  | 'Testing Generation';

interface EnvVarReport {
  name: string;
  provider: 'gemini' | 'grok';
  presentInEnv: boolean;
  maskedValue: string | null;
  suppressedInRuntime: boolean;
  location: string;
}

function formatProviderName(provider?: AIProviderType | string | null): string {
  if (provider === 'gemini') return 'Google Gemini';
  if (provider === 'grok') return 'xAI Grok';
  if (provider === 'custom' || provider === 'custom_data') return 'Custom Provider';
  return 'Not Connected';
}

function formatBillingBadge(billingStatus?: AIBillingStatus, billingNote?: string): {
  label: string;
  classes: string;
} {
  switch (billingStatus) {
    case 'free_tier':
      return {
        label: billingNote || 'Free Tier Confirmed',
        classes: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      };
    case 'credits_required':
      return {
        label: billingNote || 'Prepaid Credits / Billing',
        classes: 'bg-amber-50 text-amber-900 border-amber-200',
      };
    case 'billing_required':
      return {
        label: billingNote || 'Billing Required',
        classes: 'bg-rose-50 text-rose-800 border-rose-200',
      };
    case 'quota_exceeded':
      return {
        label: billingNote || 'Quota Exceeded',
        classes: 'bg-amber-50 text-amber-900 border-amber-200',
      };
    default:
      return {
        label: billingNote || 'Not checked yet',
        classes: 'bg-gray-100 text-gray-700 border-gray-200',
      };
  }
}

function formatStatusBadge(
  status?: AIConnectionStatus | string,
  progressStage: LiveProgressStage = 'idle',
  enabled: boolean = true
): {
  label: string;
  classes: string;
} {
  if (progressStage !== 'idle') {
    return {
      label: progressStage,
      classes: 'bg-sky-50 text-sky-900 border-sky-300',
    };
  }
  if (!enabled || status === 'disconnected' || status === 'disabled' || status === 'untested' || !status) {
    return { label: 'Not Connected', classes: 'bg-gray-100 text-gray-700 border-gray-200' };
  }
  switch (status) {
    case 'connected':
      return { label: 'Connected', classes: 'bg-emerald-50 text-emerald-800 border-emerald-300' };
    case 'authenticated':
      return { label: 'Authenticated', classes: 'bg-sky-50 text-sky-900 border-sky-300' };
    case 'awaiting_confirmation':
      return { label: 'Authenticated', classes: 'bg-amber-50 text-amber-900 border-amber-300' };
    case 'needs_provider_selection':
      return { label: 'Select Provider', classes: 'bg-amber-50 text-amber-900 border-amber-300' };
    case 'timeout':
      return { label: 'Generation Timeout', classes: 'bg-amber-50 text-amber-900 border-amber-300' };
    case 'quota_exhausted':
      return { label: 'Quota Exceeded', classes: 'bg-amber-50 text-amber-900 border-amber-300' };
    case 'billing_required':
      return { label: 'Billing Required', classes: 'bg-orange-50 text-orange-900 border-orange-300' };
    case 'auth_failed':
      return { label: 'Invalid Key', classes: 'bg-rose-50 text-rose-800 border-rose-300' };
    case 'permission_denied':
      return { label: 'Permission Denied', classes: 'bg-rose-50 text-rose-800 border-rose-300' };
    case 'endpoint_not_found':
      return { label: 'Model Unavailable', classes: 'bg-rose-50 text-rose-800 border-rose-300' };
    case 'network_error':
      return { label: 'Network Error', classes: 'bg-rose-50 text-rose-800 border-rose-300' };
    case 'server_error':
    case 'malformed_response':
      return { label: 'Provider Unavailable', classes: 'bg-rose-50 text-rose-800 border-rose-300' };
    case 'authenticated_generation_unavailable':
      return { label: 'Provider Unavailable', classes: 'bg-amber-50 text-amber-900 border-amber-300' };
    default:
      return { label: 'Not Connected', classes: 'bg-gray-100 text-gray-700 border-gray-200' };
  }
}

export const AIConnectionPanel: React.FC<AIConnectionPanelProps> = ({
  onNotify,
  onProvidersChanged,
  embeddedInAdvancedVault = false,
  advancedContent,
  refreshKey = 0,
}) => {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [progressStage, setProgressStage] = useState<LiveProgressStage>('idle');
  const [disconnecting, setDisconnecting] = useState(false);
  const [retesting, setRetesting] = useState(false);
  const [replaceMode, setReplaceMode] = useState(false);

  // Server connection & RBAC state
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState('Super Admin');
  const [activeProvider, setActiveProvider] = useState<AIProviderCredential | null>(null);
  const [totalCredentials, setTotalCredentials] = useState<number>(0);
  const [geminiStatusText, setGeminiStatusText] = useState<string>('Not Connected');
  const [grokStatusText, setGrokStatusText] = useState<string>('Not Connected');
  const [envVars, setEnvVars] = useState<EnvVarReport[]>([]);
  const [serverEnv, setServerEnv] = useState<any>(null);
  const [lastResult, setLastResult] = useState<AIAutoConnectResponse | null>(null);

  // Pending verified context allowing one-click Retry Test without re-pasting the key
  const [pendingRetryContext, setPendingRetryContext] = useState<{
    providerType: 'gemini' | 'grok';
    selectedModel: string;
    candidateModels?: string[];
    availableModels?: AIModelInfo[];
    detectionMethod?: AIAutoConnectResponse['detectionMethod'];
    confirmBillableTest?: boolean;
  } | null>(null);

  // Conditional fallback provider selector (ONLY displayed when detection is ambiguous)
  const [needsProviderChoice, setNeedsProviderChoice] = useState(false);
  const [fallbackProvider, setFallbackProvider] = useState<'gemini' | 'grok' | ''>('');

  // Conditional Grok confirmation card (ONLY shown for Grok before billable test inference)
  const [pendingConfirmation, setPendingConfirmation] = useState<AIAutoConnectResponse | null>(null);

  // Reset All AI Keys explicit Super Admin confirmation UI (no window.confirm)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetPreview, setResetPreview] = useState<{
    geminiCount: number;
    grokCount: number;
    totalStoredCount: number;
    activeEnvCount: number;
    dependentRoutesCount: number;
    preserved?: string[];
  } | null>(null);
  const [loadingResetPreview, setLoadingResetPreview] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetNotice, setResetNotice] = useState<{
    message: string;
    envManagedVariables: EnvVarReport[];
  } | null>(null);

  // Diagnostics panel state
  const [diagReport, setDiagReport] = useState<any>(null);
  const [loadingDiag, setLoadingDiag] = useState(false);
  const [crudTestResult, setCrudTestResult] = useState<any>(null);
  const [crudTestBusy, setCrudTestBusy] = useState(false);

  const loadStatusAndDiagnostics = async (runOutboundProbe: boolean = false) => {
    if (runOutboundProbe) setLoadingDiag(true);
    else setLoadingStatus(true);

    try {
      const statusRes = await safeFetchJson('/api/v1/admin/ai/connection-status', {
        credentials: 'include',
        cache: 'no-store',
      });
      let userIsSuperAdmin = isSuperAdmin;
      if (statusRes?.success) {
        setActiveProvider(statusRes.activeProvider || null);
        setTotalCredentials(Number(statusRes.totalCredentials ?? 0));
        setGeminiStatusText(statusRes.geminiStatus || 'Not Connected');
        setGrokStatusText(statusRes.grokStatus || 'Not Connected');
        setEnvVars(Array.isArray(statusRes.envManagedVariables) ? statusRes.envManagedVariables : []);
        setServerEnv(statusRes.serverEnvironment || null);
        setCurrentUserRole(statusRes.currentUserRole || 'Admin');
        userIsSuperAdmin = Boolean(statusRes.isSuperAdmin);
        setIsSuperAdmin(userIsSuperAdmin);
      }

      if (userIsSuperAdmin) {
        const diagRes = await safeFetchJson('/api/v1/admin/ai/diagnostics', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (diagRes?.success) {
          setDiagReport(diagRes);
        }
      } else {
        setDiagReport(null);
      }
    } catch {
      // Non-fatal UI check
    } finally {
      setLoadingStatus(false);
      setLoadingDiag(false);
    }
  };

  useEffect(() => {
    loadStatusAndDiagnostics(false);
  }, [refreshKey]);

  const handleRunDatabaseCrudTest = async () => {
    if (crudTestBusy) return;
    setCrudTestBusy(true);
    setCrudTestResult(null);
    try {
      const res = await safeFetchJson('/api/v1/admin/ai/diagnostics/crud-test', {
        method: 'POST',
        credentials: 'include',
      });
      setCrudTestResult(res);
      await loadStatusAndDiagnostics(false);
    } catch (err: any) {
      setCrudTestResult({
        ok: false,
        error: err?.message || 'Failed running database CRUD test.',
        stages: [],
      });
    } finally {
      setCrudTestBusy(false);
    }
  };

  const handleToggleResetConfirm = async () => {
    const nextOpen = !resetConfirmOpen;
    setResetConfirmOpen(nextOpen);
    if (nextOpen) {
      setLoadingResetPreview(true);
      try {
        const res = await safeFetchJson('/api/v1/admin/ai/reset-preview', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (res?.success && res.preview) {
          setResetPreview(res.preview);
        }
      } catch {
        // Ignore preview fetch error; fallback notice still explains reset scope
      } finally {
        setLoadingResetPreview(false);
      }
    }
  };

  const runGenerationStep = async (params: {
    apiKey: string;
    providerType: 'gemini' | 'grok';
    selectedModel: string;
    candidateModels?: string[];
    availableModels?: AIModelInfo[];
    detectionMethod?: AIAutoConnectResponse['detectionMethod'];
    confirmBillableTest?: boolean;
  }) => {
    setProgressStage('Testing Generation');
    const genRes = await safeFetchJson('/api/v1/admin/ai/verify-generation-auto', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: params.apiKey,
        providerType: params.providerType,
        selectedModel: params.selectedModel,
        candidateModels: params.candidateModels,
        availableModels: params.availableModels,
        detectionMethod: params.detectionMethod,
        confirmBillableTest: Boolean(params.confirmBillableTest),
        replaceCredentialId: replaceMode && activeProvider ? activeProvider.id : undefined,
      }),
    });

    const result: AIAutoConnectResponse | undefined = genRes?.result;
    if (!result) {
      setLastResult({
        ok: false,
        authenticated: true,
        generationVerified: false,
        status: 'server_error',
        detectedProvider: params.providerType,
        selectedModel: params.selectedModel,
        billingStatus: params.providerType === 'gemini' ? 'free_tier' : 'credits_required',
        billingNote: 'Could not verify generation response.',
        lastChecked: new Date().toISOString(),
        availableModels: params.availableModels || [],
        errorCategory: 'PROVIDER_UNAVAILABLE',
        errorClassification: 'Provider Unavailable',
        failureSource: 'Browser-to-backend request',
        message: genRes?.error || 'Generation test request failed.',
        correlationId: 'client-gen-err',
        canRetryGeneration: true,
      });
      return;
    }

    setLastResult(result);

    if (result.ok && result.provider) {
      setActiveProvider(result.provider);
      setApiKeyInput('');
      setReplaceMode(false);
      setFallbackProvider('');
      setPendingRetryContext(null);
      setPendingConfirmation(null);
      setResetNotice(null);
      onNotify?.(result.message);
      onProvidersChanged?.();
      await loadStatusAndDiagnostics(false);
    } else if (result.canRetryGeneration) {
      setPendingRetryContext(params);
    }
  };

  const executeAutoConnect = async (opts?: {
    providerOverride?: 'gemini' | 'grok';
    confirmBillableTest?: boolean;
  }) => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      setLastResult({
        ok: false,
        status: 'auth_failed',
        billingStatus: 'unknown',
        billingNote: 'Paste a Gemini or Grok API key first.',
        lastChecked: new Date().toISOString(),
        availableModels: [],
        errorCategory: 'INVALID_API_KEY',
        errorClassification: 'Invalid Key',
        message: 'Please paste your Google Gemini or xAI Grok API key.',
        correlationId: 'client-empty',
      });
      return;
    }

    setConnecting(true);
    setPendingConfirmation(null);
    setResetNotice(null);
    setProgressStage('Checking Credentials');

    try {
      const providerOverride = opts?.providerOverride || (fallbackProvider ? fallbackProvider : undefined);

      // Step 1: Fast Credential Authentication + Model Discovery
      const discTimer = window.setTimeout(() => {
        setProgressStage(prev => (prev === 'Checking Credentials' ? 'Fetching Models' : prev));
      }, 650);

      let discRes: any;
      try {
        discRes = await safeFetchJson('/api/v1/admin/ai/discover-auto', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: trimmed,
            providerOverride,
            confirmBillableTest: Boolean(opts?.confirmBillableTest),
            replaceCredentialId: replaceMode && activeProvider ? activeProvider.id : undefined,
          }),
        });
      } finally {
        window.clearTimeout(discTimer);
      }

      const discResult: (AIAutoConnectResponse & { candidateModels?: string[] }) | undefined = discRes?.result;
      if (!discResult) {
        setLastResult({
          ok: false,
          status: 'server_error',
          billingStatus: 'unknown',
          billingNote: 'Could not verify credentials.',
          lastChecked: new Date().toISOString(),
          availableModels: [],
          errorCategory: 'PROVIDER_UNAVAILABLE',
          errorClassification: 'Provider Unavailable',
          failureSource: 'Browser-to-backend request',
          message: discRes?.error || 'Connection request failed.',
          correlationId: 'client-err',
        });
        return;
      }

      if (discResult.requiresProviderSelection) {
        setNeedsProviderChoice(true);
        setLastResult(discResult);
        return;
      }

      if (discResult.requiresBillableConfirmation) {
        setNeedsProviderChoice(false);
        setPendingConfirmation(discResult);
        setLastResult(discResult);
        return;
      }

      if (!discResult.ok || !discResult.detectedProvider || !discResult.selectedModel) {
        setNeedsProviderChoice(false);
        setLastResult(discResult);
        return;
      }

      // Discovery succeeded cleanly! Brief Authenticated milestone, then Step 2 Generation Test
      setNeedsProviderChoice(false);
      setProgressStage('Authenticated');
      const retryParams = {
        apiKey: trimmed,
        providerType: discResult.detectedProvider as 'gemini' | 'grok',
        selectedModel: discResult.selectedModel,
        candidateModels: discResult.candidateModels,
        availableModels: discResult.availableModels,
        detectionMethod: discResult.detectionMethod,
        confirmBillableTest: Boolean(opts?.confirmBillableTest),
      };
      setPendingRetryContext(retryParams);
      setLastResult(discResult);

      await runGenerationStep(retryParams);
    } catch (err: any) {
      setLastResult({
        ok: false,
        status: 'network_error',
        billingStatus: 'unknown',
        billingNote: 'Server connection error.',
        lastChecked: new Date().toISOString(),
        availableModels: [],
        errorCategory: 'SERVER_CONNECTIVITY_FAILURE',
        errorClassification: 'Network Error',
        failureSource: 'Browser-to-backend request',
        message: err?.message || 'Unable to reach server connection endpoint.',
        correlationId: 'client-net',
      });
    } finally {
      setProgressStage('idle');
      setConnecting(false);
      await loadStatusAndDiagnostics(false);
    }
  };

  const handleRetryGenerationOnly = async () => {
    if (pendingRetryContext && apiKeyInput.trim()) {
      setConnecting(true);
      try {
        await runGenerationStep({
          ...pendingRetryContext,
          apiKey: apiKeyInput.trim(),
        });
      } finally {
        setProgressStage('idle');
        setConnecting(false);
        await loadStatusAndDiagnostics(false);
      }
      return;
    }

    if (activeProvider) {
      await handleRetestExisting();
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const targetId = activeProvider?.id;
      const res = await safeFetchJson('/api/v1/admin/ai/disconnect', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId: targetId }),
      });
      if (res?.success && (res._httpStatus || 200) < 400 && res?.receipt?.verifiedAfterMutation !== false) {
        await loadStatusAndDiagnostics(false);
        setReplaceMode(false);
        setApiKeyInput('');
        setNeedsProviderChoice(false);
        setPendingConfirmation(null);
        setPendingRetryContext(null);
        setLastResult({
          ok: true,
          status: 'disconnected',
          billingStatus: 'unknown',
          billingNote: 'Disconnected',
          lastChecked: new Date().toISOString(),
          availableModels: [],
          message: res.message || 'AI API key disconnected.',
          correlationId: res.receipt?.correlationId || 'disconnect',
        });
        onNotify?.('AI API disconnected.');
        await onProvidersChanged?.();
      } else {
        setLastResult({
          ok: false,
          status: 'error',
          billingStatus: 'unknown',
          billingNote: 'Disconnect failed',
          lastChecked: new Date().toISOString(),
          availableModels: [],
          errorClassification: 'Delete Verification Failed',
          message: res?.error || 'Could not verify AI key removal.',
          correlationId: res?.receipt?.correlationId || 'disconnect-err',
        });
        onNotify?.(res?.error || 'Could not disconnect AI credential.');
      }
    } finally {
      setDisconnecting(false);
    }
  };

  const handleResetAllKeys = async () => {
    setResetting(true);
    try {
      const res = await safeFetchJson('/api/v1/admin/ai/reset-all', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmReset: 'RESET_ALL_AI_KEYS' }),
      });
      if (
        res?.success &&
        (res._httpStatus || 200) < 400 &&
        res?.verifiedAfterMutation !== false &&
        res?.receipt?.verifiedAfterMutation !== false
      ) {
        setResetConfirmOpen(false);
        setActiveProvider(null);
        setApiKeyInput('');
        setReplaceMode(false);
        setNeedsProviderChoice(false);
        setPendingConfirmation(null);
        setPendingRetryContext(null);
        setLastResult(null);
        setGeminiStatusText(res.geminiStatus || 'Not Connected');
        setGrokStatusText(res.grokStatus || 'Not Connected');
        setResetNotice({
          message: res.message || 'All previously stored Gemini and Grok API keys removed.',
          envManagedVariables: Array.isArray(res.envManagedVariables) ? res.envManagedVariables : [],
        });
        onNotify?.('All previous Gemini & Grok AI credentials reset. Both providers are Not Connected.');
        await onProvidersChanged?.();
        await loadStatusAndDiagnostics(false);
      } else {
        setLastResult({
          ok: false,
          status: 'permission_denied',
          billingStatus: 'unknown',
          billingNote: 'Reset blocked',
          lastChecked: new Date().toISOString(),
          availableModels: [],
          errorClassification: 'Reset Failed',
          message: res?.error || 'Could not reset AI API credentials.',
          correlationId: res?.receipt?.correlationId || 'reset-err',
        });
      }
    } finally {
      setResetting(false);
    }
  };

  const handleRetestExisting = async () => {
    if (!activeProvider) return;
    setRetesting(true);
    setProgressStage('Testing Generation');
    try {
      const res = await safeFetchJson(
        `/api/v1/admin/ai/providers/${encodeURIComponent(activeProvider.id)}/test`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );
      const r = res?.result;
      if (r) {
        setLastResult({
          ok: Boolean(r.ok),
          authenticated: r.authenticated,
          generationVerified: r.generationVerified,
          status: r.connectionStatus,
          detectedProvider: r.providerType,
          selectedModel: r.selectedModel,
          billingStatus: activeProvider.billingStatus || (r.providerType === 'gemini' ? 'free_tier' : 'credits_required'),
          billingNote: activeProvider.billingNote || (r.providerType === 'gemini' ? 'Free Tier Eligible' : 'Credits / Billing Active'),
          lastChecked: new Date().toISOString(),
          latencyMs: r.latencyMs,
          availableModels: r.availableModels || [],
          sampleOutput: r.sampleOutput,
          errorClassification: r.diagnostic?.title,
          failureSource: r.diagnostic?.failureSource,
          message: r.message,
          suggestedAction: r.diagnostic?.suggestedAction,
          correlationId: r.correlationId || 'retest',
          canRetryGeneration: !r.ok && r.authenticated,
        });
        onProvidersChanged?.();
        await loadStatusAndDiagnostics(false);
      } else {
        setLastResult({
          ok: false,
          authenticated: false,
          generationVerified: false,
          status: 'server_error',
          detectedProvider: activeProvider.providerType,
          selectedModel: activeProvider.model,
          billingStatus: activeProvider.billingStatus || 'unknown',
          billingNote: activeProvider.billingNote || 'Retest failed',
          lastChecked: new Date().toISOString(),
          availableModels: activeProvider.availableModels || [],
          errorClassification: 'Connection Test Error',
          failureSource: 'Browser-to-backend request',
          message: res?.error || 'Failed running connection test on saved credential.',
          correlationId: 'retest-err',
          canRetryGeneration: true,
        });
        await loadStatusAndDiagnostics(false);
      }
    } catch (err: any) {
      setLastResult({
        ok: false,
        authenticated: false,
        generationVerified: false,
        status: 'network_error',
        detectedProvider: activeProvider.providerType,
        selectedModel: activeProvider.model,
        billingStatus: activeProvider.billingStatus || 'unknown',
        billingNote: activeProvider.billingNote || 'Network error',
        lastChecked: new Date().toISOString(),
        availableModels: activeProvider.availableModels || [],
        errorClassification: 'Network Error',
        failureSource: 'Browser-to-backend request',
        message: err?.message || 'Unable to reach provider test endpoint.',
        correlationId: 'retest-net',
        canRetryGeneration: true,
      });
    } finally {
      setProgressStage('idle');
      setRetesting(false);
    }
  };

  const isCurrentlyConnected = Boolean(
    activeProvider && activeProvider.enabled && activeProvider.connectionStatus === 'connected'
  );
  const showKeyInput = !isCurrentlyConnected || replaceMode;

  const displayProvider = lastResult?.detectedProvider ?? activeProvider?.providerType ?? null;
  const displayStatus = lastResult?.status ?? (activeProvider ? activeProvider.connectionStatus : 'disconnected');
  const displayModel = lastResult?.selectedModel || activeProvider?.model || '—';
  const displayBillingStatus =
    lastResult?.billingStatus ??
    activeProvider?.billingStatus ??
    (displayProvider === 'gemini' && displayStatus === 'connected' ? 'free_tier' : 'unknown');
  const displayBillingNote =
    lastResult?.billingNote ||
    activeProvider?.billingNote ||
    (displayProvider === 'gemini' && displayStatus === 'connected'
      ? 'Free Tier Confirmed'
      : displayProvider === 'grok' && displayStatus === 'connected'
      ? 'Prepaid Credits / Billing Active'
      : 'Not checked yet');
  const displayLastChecked = lastResult?.lastChecked || activeProvider?.lastTestedAt || null;

  const statusBadge = formatStatusBadge(displayStatus, progressStage, activeProvider?.enabled ?? true);
  const billingBadge = formatBillingBadge(displayBillingStatus, displayBillingNote);
  const diagSummary = diagReport?.summary || {};
  const outboundHosts = diagReport?.connectivity?.hosts || [];

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        {/* Clean Header + Provider Connection Pills + Super Admin Reset Button */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-700" />
              <span>Connect AI API</span>
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Paste your Google Gemini or xAI Grok API key below. Model selection, validation, encryption, and activation happen automatically.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded border bg-slate-50 text-slate-800 border-slate-200 text-[11px] font-bold">
              Active Credentials: {totalCredentials}
            </span>
            <span
              className={`px-2.5 py-1 rounded border text-[11px] font-bold ${
                geminiStatusText === 'Connected'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-gray-50 text-gray-700 border-gray-200'
              }`}
            >
              Gemini: {geminiStatusText === 'Connected' ? 'Connected' : 'Not Connected'}
            </span>
            <span
              className={`px-2.5 py-1 rounded border text-[11px] font-bold ${
                grokStatusText === 'Connected'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-gray-50 text-gray-700 border-gray-200'
              }`}
            >
              Grok: {grokStatusText === 'Connected' ? 'Connected' : 'Not Connected'}
            </span>
            {isSuperAdmin && (
              <button
                type="button"
                disabled={resetting || connecting}
                onClick={handleToggleResetConfirm}
                className="px-3 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 text-[11px] font-bold rounded-lg inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset All Gemini &amp; Grok Credentials</span>
              </button>
            )}
          </div>
        </div>

        {/* Super Admin Guard Banner (if non-Super Admin) */}
        {!isSuperAdmin && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              Signed in as <strong>{currentUserRole}</strong>. Only a <strong>Super Admin</strong> may connect, replace, reset, or remove AI API keys.
            </span>
          </div>
        )}

        {/* Explicit Super Admin Reset Confirmation Dialog (Inline, No window.confirm) */}
        {resetConfirmOpen && isSuperAdmin && (
          <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl space-y-3 text-xs">
            <div className="font-black text-rose-950 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-700 shrink-0" />
              <span>Confirm Super Admin Action: Reset All Gemini &amp; Grok Credentials</span>
            </div>
            <p className="text-rose-900">
              This will permanently remove all saved <strong>Gemini</strong> and <strong>Grok</strong> API credentials from encrypted storage and Supabase, clear cached model lists and task bindings, suppress old environment fallback keys, and reset both providers to <strong>Not Connected</strong>.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="p-2 bg-white border border-rose-200 rounded-lg">
                <div className="text-[10px] text-rose-700 font-bold uppercase">Gemini Keys</div>
                <div className="font-mono font-black text-rose-950">
                  {loadingResetPreview ? '...' : resetPreview?.geminiCount ?? 0} to remove
                </div>
              </div>
              <div className="p-2 bg-white border border-rose-200 rounded-lg">
                <div className="text-[10px] text-rose-700 font-bold uppercase">Grok Keys</div>
                <div className="font-mono font-black text-rose-950">
                  {loadingResetPreview ? '...' : resetPreview?.grokCount ?? 0} to remove
                </div>
              </div>
              <div className="p-2 bg-white border border-rose-200 rounded-lg">
                <div className="text-[10px] text-rose-700 font-bold uppercase">Task Routes</div>
                <div className="font-mono font-black text-rose-950">
                  {loadingResetPreview ? '...' : resetPreview?.dependentRoutesCount ?? 0} to clear
                </div>
              </div>
              <div className="p-2 bg-white border border-emerald-200 rounded-lg">
                <div className="text-[10px] text-emerald-700 font-bold uppercase">Preserved</div>
                <div className="font-semibold text-emerald-900">Articles, Users, SEO, Logs</div>
              </div>
            </div>
            {envVars.some(v => v.presentInEnv) && (
              <div className="p-2.5 bg-white border border-rose-200 rounded-lg text-[11px] text-rose-900 space-y-1">
                <div className="font-bold">Environment-Managed Variables Detected on Server:</div>
                {envVars
                  .filter(v => v.presentInEnv)
                  .map(v => (
                    <div key={v.name} className="font-mono">
                      • {v.name} ({v.maskedValue}) — Location: {v.location}
                    </div>
                  ))}
                <div className="text-[10px] text-rose-700">
                  Runtime fallback for these env keys will be suppressed automatically until you connect fresh keys or remove them from your server environment.
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={resetting}
                onClick={handleResetAllKeys}
                className="px-4 py-2 bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white font-bold rounded-lg inline-flex items-center gap-1.5"
              >
                {resetting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{resetting ? 'Resetting Keys...' : 'Confirm Permanent Reset'}</span>
              </button>
              <button
                type="button"
                disabled={resetting}
                onClick={() => setResetConfirmOpen(false)}
                className="px-3.5 py-2 bg-white border border-gray-300 text-gray-700 font-bold rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Post-Reset Confirmation Notice */}
        {resetNotice && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 space-y-1.5">
            <div className="font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{resetNotice.message}</span>
            </div>
            {resetNotice.envManagedVariables.some(v => v.presentInEnv) && (
              <div className="pl-6 text-[11px] font-mono text-emerald-900">
                Active server environment variables to clear manually if desired:{' '}
                {resetNotice.envManagedVariables
                  .filter(v => v.presentInEnv)
                  .map(v => `${v.name} [${v.location}]`)
                  .join('; ')}
              </div>
            )}
          </div>
        )}

        {/* Single Universal API Key Input */}
        {showKeyInput ? (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <KeyRound className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  disabled={!isSuperAdmin || connecting}
                  onChange={e => {
                    setApiKeyInput(e.target.value);
                    if (needsProviderChoice) setNeedsProviderChoice(false);
                    if (pendingConfirmation) setPendingConfirmation(null);
                    if (pendingRetryContext) setPendingRetryContext(null);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (isSuperAdmin && !connecting) executeAutoConnect();
                    }
                  }}
                  placeholder="Paste Gemini or Grok API Key"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full pl-9 pr-10 py-2.5 border border-gray-300 rounded-lg font-mono text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 disabled:bg-gray-100"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(s => !s)}
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-700"
                  title={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                type="button"
                disabled={!isSuperAdmin || connecting || !apiKeyInput.trim()}
                onClick={() => executeAutoConnect()}
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg inline-flex items-center justify-center gap-2 shrink-0"
              >
                {connecting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{progressStage !== 'idle' ? `${progressStage}...` : 'Validating...'}</span>
                  </>
                ) : (
                  <span>Validate &amp; Connect</span>
                )}
              </button>
              {replaceMode && (
                <button
                  type="button"
                  onClick={() => {
                    setReplaceMode(false);
                    setApiKeyInput('');
                    setNeedsProviderChoice(false);
                    setPendingConfirmation(null);
                    setPendingRetryContext(null);
                  }}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg shrink-0"
                >
                  Cancel
                </button>
              )}
            </div>

            {/* Fallback Provider Selector — ONLY shown if detection is ambiguous */}
            {needsProviderChoice && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-2.5 text-xs">
                <div className="font-bold text-amber-950 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  <span>Select Provider</span>
                </div>
                <p className="text-amber-900">
                  Could not determine whether this key belongs to Google Gemini or xAI Grok. Choose its provider to verify:
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={connecting}
                    onClick={() => {
                      setFallbackProvider('gemini');
                      executeAutoConnect({ providerOverride: 'gemini' });
                    }}
                    className="px-3.5 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-950 font-bold rounded-lg"
                  >
                    Google Gemini
                  </button>
                  <button
                    type="button"
                    disabled={connecting}
                    onClick={() => {
                      setFallbackProvider('grok');
                      executeAutoConnect({ providerOverride: 'grok' });
                    }}
                    className="px-3.5 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-950 font-bold rounded-lg"
                  >
                    xAI Grok
                  </button>
                </div>
              </div>
            )}

            {/* Explicit Billing Confirmation — ONLY shown for xAI Grok before running a live test */}
            {pendingConfirmation && (
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-2.5 text-xs">
                <div className="font-bold text-amber-950 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  <span>Confirm xAI Grok Test Generation</span>
                </div>
                <p className="text-amber-900">{pendingConfirmation.message}</p>
                <p className="text-[11px] text-amber-800">{pendingConfirmation.billingNote}</p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={connecting}
                    onClick={() =>
                      executeAutoConnect({
                        providerOverride: 'grok',
                        confirmBillableTest: true,
                      })
                    }
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg inline-flex items-center gap-1.5"
                  >
                    {connecting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm &amp; Connect Grok</span>
                  </button>
                  <button
                    type="button"
                    disabled={connecting}
                    onClick={() => setPendingConfirmation(null)}
                    className="px-3.5 py-2 bg-white border border-gray-300 text-gray-700 font-bold rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Post-Connection Simple Action Bar */
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
            <div className="flex items-center gap-2.5 text-emerald-950">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>
                Connected via <strong>{formatProviderName(activeProvider?.providerType)}</strong> ({activeProvider?.model}) • Masked Key:{' '}
                <code className="font-mono">{activeProvider?.maskedKey}</code>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isSuperAdmin && (
                <>
                  <button
                    type="button"
                    disabled={retesting}
                    onClick={handleRetestExisting}
                    className="px-3 py-1.5 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-900 font-bold rounded-lg inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${retesting ? 'animate-spin' : ''}`} />
                    <span>{retesting ? 'Testing...' : 'Retry Test'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReplaceMode(true);
                      setApiKeyInput('');
                    }}
                    className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-800 font-bold rounded-lg"
                  >
                    Replace Key
                  </button>
                  <button
                    type="button"
                    disabled={disconnecting}
                    onClick={handleDisconnect}
                    className="px-3 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-800 font-bold rounded-lg inline-flex items-center gap-1.5"
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>{disconnecting ? 'Disconnecting...' : 'Disconnect'}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Failure / Generation Timeout Banner with One-Click Retry Test (no re-paste required) */}
        {lastResult && !lastResult.requiresProviderSelection && !lastResult.requiresBillableConfirmation && !lastResult.ok && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex flex-wrap items-start justify-between gap-3 ${
              lastResult.status === 'timeout'
                ? 'bg-amber-50 border-amber-300 text-amber-950'
                : 'bg-rose-50 border-rose-200 text-rose-950'
            }`}
          >
            <div className="flex items-start gap-2.5 flex-1 min-w-[240px]">
              {lastResult.status === 'timeout' ? (
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="font-bold">{lastResult.message}</div>
                {lastResult.suggestedAction && (
                  <div className="text-[11px] opacity-90">{lastResult.suggestedAction}</div>
                )}
              </div>
            </div>
            {(lastResult.canRetryGeneration || lastResult.status === 'timeout') &&
              (pendingRetryContext || activeProvider) &&
              isSuperAdmin && (
                <button
                  type="button"
                  disabled={connecting || retesting}
                  onClick={handleRetryGenerationOnly}
                  className="px-3.5 py-2 bg-white border border-amber-400 hover:bg-amber-100 text-amber-950 font-bold rounded-lg inline-flex items-center gap-1.5 shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${connecting || retesting ? 'animate-spin' : ''}`} />
                  <span>Retry Test</span>
                </button>
              )}
          </div>
        )}

        {/* 5 Clean Readout Fields Below Input */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="text-[10px] font-bold uppercase text-gray-500">Provider</div>
            <div className="text-xs font-black text-gray-900 mt-1">
              {loadingStatus ? 'Checking...' : formatProviderName(displayProvider)}
            </div>
          </div>

          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="text-[10px] font-bold uppercase text-gray-500">Status</div>
            <div className="mt-1">
              <span className={`inline-block px-2 py-0.5 rounded border text-[11px] font-bold ${statusBadge.classes}`}>
                {loadingStatus && progressStage === 'idle' ? 'Checking...' : statusBadge.label}
              </span>
            </div>
          </div>

          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="text-[10px] font-bold uppercase text-gray-500">Selected Model</div>
            <div className="text-xs font-mono font-bold text-emerald-800 mt-1 truncate" title={displayModel}>
              {loadingStatus ? '...' : displayModel}
            </div>
          </div>

          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="text-[10px] font-bold uppercase text-gray-500">Tier / Billing Status</div>
            <div className="mt-1">
              <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold ${billingBadge.classes}`}>
                {loadingStatus ? '...' : billingBadge.label}
              </span>
            </div>
          </div>

          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="text-[10px] font-bold uppercase text-gray-500">Last Checked</div>
            <div className="text-[11px] font-mono text-gray-700 mt-1">
              {displayLastChecked ? new Date(displayLastChecked).toLocaleString() : 'Never'}
            </div>
          </div>
        </div>
      </div>

      {/* Task 10: Connection Diagnostics Section */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div>
            <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-700" />
              <span>Connection Diagnostics</span>
            </h3>
            <p className="text-[11px] text-gray-500">
              Real-time server authentication, model discovery, generation latency, timeout budget, and failure attribution.
            </p>
          </div>
          <button
            type="button"
            disabled={loadingDiag}
            onClick={() => loadStatusAndDiagnostics(true)}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-[11px] font-bold rounded-lg inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingDiag ? 'animate-spin' : ''}`} />
            <span>{loadingDiag ? 'Probing Outbound...' : 'Run Outbound Probe'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-[11px]">
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="text-[10px] font-bold uppercase text-gray-500">Provider &amp; Authentication</div>
            <div className="font-bold text-gray-900 mt-1">
              {formatProviderName(lastResult?.detectedProvider ?? diagSummary.provider ?? activeProvider?.providerType)}
            </div>
            <div className="font-mono text-gray-600 mt-0.5">
              Auth: {lastResult?.authenticated ? 'Verified' : diagSummary.authenticationStatus || 'not_checked'}
            </div>
          </div>

          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="text-[10px] font-bold uppercase text-gray-500">Model Discovery &amp; Selected</div>
            <div className="font-mono font-bold text-gray-900 mt-1 truncate">
              {lastResult?.availableModels?.length
                ? `ok (${lastResult.availableModels.length} models)`
                : diagSummary.modelDiscoveryStatus || 'not_run'}
            </div>
            <div className="font-mono text-emerald-800 mt-0.5 truncate">
              Model: {lastResult?.selectedModel || diagSummary.selectedModel || '—'}
            </div>
          </div>

          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="text-[10px] font-bold uppercase text-gray-500">Generation Test &amp; Latency</div>
            <div className="font-mono font-bold text-gray-900 mt-1">
              {lastResult?.generationVerified
                ? 'Passed'
                : lastResult?.status === 'timeout'
                ? 'Timed Out'
                : diagSummary.generationTestStatus || 'not_run'}
            </div>
            <div className="font-mono text-gray-600 mt-0.5">
              Response time:{' '}
              {typeof (lastResult?.latencyMs ?? diagSummary.apiResponseTimeMs) === 'number'
                ? `${lastResult?.latencyMs ?? diagSummary.apiResponseTimeMs}ms`
                : '—'}
            </div>
          </div>

          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="text-[10px] font-bold uppercase text-gray-500">Failure Source &amp; Correlation ID</div>
            <div className="font-bold text-gray-900 mt-1">
              {lastResult?.failureSource || (diagSummary.failureSource as AIFailureSource) || 'None'}
            </div>
            <div className="font-mono text-gray-600 mt-0.5 truncate">
              ID: {lastResult?.correlationId || diagSummary.correlationId || '—'}
            </div>
          </div>

          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg sm:col-span-2">
            <div className="text-[10px] font-bold uppercase text-gray-500">Last Error &amp; Classification</div>
            <div className="font-bold text-gray-900 mt-1">
              {lastResult && !lastResult.ok
                ? lastResult.errorClassification || statusBadge.label
                : diagSummary.errorClassification || 'None'}
            </div>
            <div className="text-gray-600 mt-0.5 break-words">
              {lastResult && !lastResult.ok
                ? lastResult.message
                : diagSummary.lastError || 'No active errors.'}
            </div>
          </div>

          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="text-[10px] font-bold uppercase text-gray-500">Last Successful Connection</div>
            <div className="font-mono text-gray-900 mt-1">
              {diagSummary.lastSuccessfulConnection
                ? new Date(diagSummary.lastSuccessfulConnection).toLocaleString()
                : 'None yet'}
            </div>
          </div>

          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="text-[10px] font-bold uppercase text-gray-500">Actual Backend Runtime</div>
            <div className="font-mono font-bold text-gray-900 mt-1">
              {diagReport?.serverEnvironment?.actualRuntime ||
                (diagReport?.serverEnvironment?.isServerless ? 'Serverless Runtime' : 'Node.js Server')}
            </div>
            <div className="font-mono text-[10px] text-gray-600 mt-0.5">
              {(diagReport?.serverEnvironment?.nodeEnv || serverEnv?.nodeEnv || 'production')} •{' '}
              {(diagReport?.serverEnvironment?.nodeVersion || serverEnv?.nodeVersion || '')} •{' '}
              Timeout: {(diagReport?.serverEnvironment?.generationTimeoutMs || serverEnv?.generationTimeoutMs || 55000)}ms
            </div>
          </div>
        </div>

        {/* Supabase Persistence & Live CRUD Diagnostics (Super Admin Only) */}
        {isSuperAdmin &&
          (() => {
            const sbDiag = diagReport?.supabase || {};
            const svEnv = diagReport?.serverEnvironment || serverEnv || {};
            const cfgDiag = diagReport?.configurationDiagnostic || {};
            const urlConfigured = Boolean(
              crudTestResult?.supabaseUrlConfigured ?? sbDiag.supabaseUrlConfigured ?? svEnv.supabaseUrlConfigured
            );
            const secretConfigured = Boolean(
              crudTestResult?.supabaseSecretConfigured ??
                sbDiag.supabaseSecretConfigured ??
                svEnv.supabaseSecretConfigured
            );
            const connOk = Boolean(
              crudTestResult ? crudTestResult.connectionTestOk : sbDiag.connectionTestOk ?? sbDiag.connected
            );
            const queryOk = Boolean(
              crudTestResult ? crudTestResult.databaseQueryOk : sbDiag.databaseQueryOk ?? sbDiag.connected
            );
            const tableOk = Boolean(
              crudTestResult ? crudTestResult.credentialTableAccessible : sbDiag.credentialTableAccessible
            );
            const runtimeShort =
              crudTestResult?.currentRuntime ||
              cfgDiag.currentRuntime ||
              svEnv.currentRuntime ||
              (svEnv.isServerless ? 'Vercel' : svEnv.isGoogleAiStudio ? 'Google AI Studio' : 'Other');
            const deployEnv =
              crudTestResult?.deploymentEnvironment ||
              cfgDiag.deploymentEnvironment ||
              svEnv.deploymentEnvironment ||
              (svEnv.nodeEnv === 'production' ? 'Production' : 'Development');
            const buildVer =
              crudTestResult?.applicationBuildVersion ||
              cfgDiag.applicationBuildVersion ||
              diagReport?.buildVersion ||
              '—';
            const stageStatus = (name: string) => {
              const found = Array.isArray(crudTestResult?.stages)
                ? crudTestResult.stages.find((s: any) => s.stage === name)
                : null;
              if (!found) return null;
              return found.ok ? 'Pass' : 'Fail';
            };
            const lastDbErr =
              crudTestResult?.lastDatabaseError ||
              crudTestResult?.error ||
              cfgDiag.lastDatabaseError ||
              diagReport?.runtimeTelemetry?.lastDbError?.message ||
              sbDiag.error ||
              null;

            return (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-black text-gray-900">
                      Database Persistence &amp; Supabase Diagnostics (Super Admin Only)
                    </div>
                    <div className="text-[11px] text-gray-500">
                      Verifies server runtime secrets, Supabase connectivity, database query health, and isolated non-secret INSERT/SELECT/UPDATE/DELETE persistence on <code className="font-mono">ai_provider_credentials</code>.
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={crudTestBusy}
                    onClick={handleRunDatabaseCrudTest}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-[11px] font-bold rounded-lg inline-flex items-center gap-1.5"
                  >
                    {crudTestBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    <span>{crudTestBusy ? 'Testing DB CRUD...' : 'Run Database CRUD Test'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-[11px]">
                  <div className="p-2.5 bg-white border border-gray-200 rounded-lg space-y-0.5">
                    <div className="text-[10px] font-bold uppercase text-gray-500">Server Secrets</div>
                    <div className="font-mono">
                      SUPABASE_URL:{' '}
                      <strong className={urlConfigured ? 'text-emerald-700' : 'text-rose-700'}>
                        {urlConfigured ? 'Yes' : 'No'}
                      </strong>
                    </div>
                    <div className="font-mono">
                      SUPABASE_SECRET_KEY:{' '}
                      <strong className={secretConfigured ? 'text-emerald-700' : 'text-rose-700'}>
                        {secretConfigured ? 'Yes' : 'No'}
                      </strong>
                    </div>
                    <div className="font-mono text-[10px] text-gray-500 truncate" title={sbDiag.projectHost || ''}>
                      {sbDiag.projectRef ? `Ref: ${sbDiag.projectRef}` : sbDiag.projectHost || 'Host not set'}
                    </div>
                  </div>

                  <div className="p-2.5 bg-white border border-gray-200 rounded-lg space-y-0.5">
                    <div className="text-[10px] font-bold uppercase text-gray-500">Connection &amp; Query</div>
                    <div className="font-mono">
                      Supabase connection:{' '}
                      <strong className={connOk ? 'text-emerald-700' : 'text-rose-700'}>
                        {connOk ? 'Pass' : 'Fail'}
                      </strong>
                    </div>
                    <div className="font-mono">
                      Database query:{' '}
                      <strong className={queryOk ? 'text-emerald-700' : 'text-rose-700'}>
                        {queryOk ? 'Pass' : 'Fail'}
                      </strong>
                    </div>
                  </div>

                  <div className="p-2.5 bg-white border border-gray-200 rounded-lg space-y-0.5">
                    <div className="text-[10px] font-bold uppercase text-gray-500">AI Credential Table</div>
                    <div className={`font-mono font-black ${tableOk ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {tableOk ? 'Accessible' : 'Inaccessible'}
                    </div>
                    <div className="font-mono text-[10px] text-gray-500 truncate">
                      ai_provider_credentials
                    </div>
                  </div>

                  <div className="p-2.5 bg-white border border-gray-200 rounded-lg space-y-0.5">
                    <div className="text-[10px] font-bold uppercase text-gray-500">Runtime &amp; Deploy</div>
                    <div className="font-mono text-gray-900">
                      Runtime: <strong>{runtimeShort}</strong>
                    </div>
                    <div className="font-mono text-gray-700">
                      Env: <strong>{deployEnv}</strong>
                    </div>
                    <div className="font-mono text-[10px] text-gray-500 truncate">
                      Build: {buildVer}
                    </div>
                  </div>

                  <div className="p-2.5 bg-white border border-gray-200 rounded-lg">
                    <div className="text-[10px] font-bold uppercase text-gray-500">CRUD Stages</div>
                    <div className="font-mono text-[10px] text-gray-800 mt-0.5 space-y-0.5">
                      <div>INSERT: <strong>{stageStatus('INSERT') || 'Run test'}</strong></div>
                      <div>SELECT: <strong>{stageStatus('SELECT') || 'Run test'}</strong></div>
                      <div>UPDATE: <strong>{stageStatus('UPDATE') || 'Run test'}</strong></div>
                      <div>DELETE: <strong>{stageStatus('DELETE') || 'Run test'}</strong></div>
                    </div>
                  </div>
                </div>

                {(sbDiag.migrationRequired || crudTestResult?.migrationRequired) && !tableOk && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-[11px] text-amber-950 space-y-1">
                    <div className="font-black">Action Required in Supabase SQL Editor:</div>
                    <div>
                      Run{' '}
                      <code className="font-mono bg-white px-1 py-0.5 rounded border border-amber-200">
                        {sbDiag.recommendedMigrationFile ||
                          crudTestResult?.recommendedMigrationFile ||
                          'database/supabase_migrations/007_ai_provider_credentials_repair_and_schema.sql'}
                      </code>{' '}
                      (includes <code className="font-mono">NOTIFY pgrst, &apos;reload schema&apos;;</code>) on project{' '}
                      <strong>{sbDiag.projectRef || sbDiag.projectHost || 'configured'}</strong>, then click{' '}
                      <strong>Run Database CRUD Test</strong>.
                    </div>
                  </div>
                )}

                {lastDbErr && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-900 break-words">
                    <strong>Last database error:</strong> {lastDbErr}
                  </div>
                )}
              </div>
            );
          })()}

        {/* Outbound HTTPS 443 Host Probe Results */}
        {outboundHosts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {outboundHosts.map((h: any) => (
              <div key={h.host} className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-[11px] flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-gray-900">{h.provider}</div>
                  <div className="font-mono text-[10px] text-gray-500 truncate">
                    {h.host} {h.resolvedIp ? `(${h.resolvedIp})` : ''} • {h.latencyMs}ms
                  </div>
                  {h.error && <div className="text-[10px] text-rose-700 mt-0.5">{h.error}</div>}
                </div>
                <span
                  className={`px-2 py-0.5 rounded font-bold text-[10px] shrink-0 ${
                    h.dnsResolved && h.httpsReachable
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {h.dnsResolved && h.httpsReachable ? 'HTTPS OK' : 'Blocked / Error'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legacy Advanced Vault Tabs ONLY when embedded in APIKeyManager */}
      {embeddedInAdvancedVault && advancedContent}
    </div>
  );
};
