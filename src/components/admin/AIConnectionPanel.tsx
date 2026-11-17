/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Simplified One-Click AI API Connection Panel
 */

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Power,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  AIAutoConnectResponse,
  AIBillingStatus,
  AIConnectionStatus,
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
}

function formatProviderName(provider?: AIProviderType | string | null): string {
  if (provider === 'gemini') return 'Google Gemini';
  if (provider === 'grok') return 'xAI Grok';
  if (provider === 'custom' || provider === 'custom_data') return 'Custom Provider';
  return 'Not Detected';
}

function formatBillingBadge(billingStatus?: AIBillingStatus, billingNote?: string): {
  label: string;
  classes: string;
} {
  switch (billingStatus) {
    case 'free_tier':
      return {
        label: billingNote || 'Free Tier Eligible',
        classes: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      };
    case 'credits_required':
      return {
        label: billingNote || 'Prepaid Credits / Billing Active',
        classes: 'bg-amber-50 text-amber-900 border-amber-200',
      };
    case 'billing_required':
      return {
        label: billingNote || 'Billing / Credits Required',
        classes: 'bg-rose-50 text-rose-800 border-rose-200',
      };
    case 'quota_exceeded':
      return {
        label: billingNote || 'Free Tier Quota Exhausted',
        classes: 'bg-amber-50 text-amber-900 border-amber-200',
      };
    default:
      return {
        label: billingNote || 'Verifies on connection',
        classes: 'bg-gray-100 text-gray-700 border-gray-200',
      };
  }
}

function formatStatusBadge(status?: AIConnectionStatus | string, enabled: boolean = true): {
  label: string;
  classes: string;
} {
  if (!enabled || status === 'disconnected' || status === 'disabled') {
    return { label: 'Disconnected', classes: 'bg-gray-100 text-gray-700 border-gray-200' };
  }
  switch (status) {
    case 'connected':
      return { label: 'Connected & Active', classes: 'bg-emerald-50 text-emerald-800 border-emerald-300' };
    case 'awaiting_confirmation':
      return { label: 'Awaiting Billing Confirmation', classes: 'bg-amber-50 text-amber-900 border-amber-300' };
    case 'needs_provider_selection':
      return { label: 'Select Provider', classes: 'bg-amber-50 text-amber-900 border-amber-300' };
    case 'quota_exhausted':
      return { label: 'Free Tier Quota Exhausted', classes: 'bg-amber-50 text-amber-900 border-amber-300' };
    case 'billing_required':
      return { label: 'Billing Required', classes: 'bg-orange-50 text-orange-900 border-orange-300' };
    case 'auth_failed':
      return { label: 'Invalid API Key', classes: 'bg-rose-50 text-rose-800 border-rose-300' };
    case 'permission_denied':
      return { label: 'Permission Denied', classes: 'bg-rose-50 text-rose-800 border-rose-300' };
    case 'timeout':
      return { label: 'API Timeout', classes: 'bg-amber-50 text-amber-900 border-amber-300' };
    case 'network_error':
      return { label: 'Server Connectivity Failure', classes: 'bg-rose-50 text-rose-800 border-rose-300' };
    case 'endpoint_not_found':
      return { label: 'Unsupported Model', classes: 'bg-rose-50 text-rose-800 border-rose-300' };
    case 'server_error':
      return { label: 'Provider Unavailable', classes: 'bg-rose-50 text-rose-800 border-rose-300' };
    case 'authenticated_generation_unavailable':
      return { label: 'Authenticated — Gen Unavailable', classes: 'bg-amber-50 text-amber-900 border-amber-300' };
    default:
      return { label: 'Not Connected', classes: 'bg-gray-100 text-gray-700 border-gray-200' };
  }
}

export const AIConnectionPanel: React.FC<AIConnectionPanelProps> = ({
  onNotify,
  onProvidersChanged,
  onOpenAdvancedVault,
  embeddedInAdvancedVault = false,
  advancedContent,
}) => {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [retesting, setRetesting] = useState(false);
  const [replaceMode, setReplaceMode] = useState(false);

  // Loaded active provider summary from server (masked only)
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [activeProvider, setActiveProvider] = useState<AIProviderCredential | null>(null);
  const [lastResult, setLastResult] = useState<AIAutoConnectResponse | null>(null);

  // Conditional fallback provider selector (ONLY displayed when detection is ambiguous)
  const [needsProviderChoice, setNeedsProviderChoice] = useState(false);
  const [fallbackProvider, setFallbackProvider] = useState<'gemini' | 'grok' | ''>('');

  // Conditional confirmation prompt (ONLY displayed when Grok requires billing confirmation)
  const [pendingConfirmation, setPendingConfirmation] = useState<AIAutoConnectResponse | null>(null);

  // Optional collapsible Advanced Settings (collapsed by default)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advProviderOverride, setAdvProviderOverride] = useState<'' | 'gemini' | 'grok'>('');
  const [advPreferredModel, setAdvPreferredModel] = useState('');
  const [advEndpointUrl, setAdvEndpointUrl] = useState('');
  const [advAllowPaidModels, setAdvAllowPaidModels] = useState(false);

  const loadStatus = async () => {
    setLoadingStatus(true);
    try {
      const d = await safeFetchJson('/api/v1/admin/ai/connection-status', { credentials: 'include' });
      if (d?.success) {
        setActiveProvider(d.activeProvider || null);
      }
    } catch {
      // Non-fatal
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

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
        message: 'Please paste your Google Gemini or xAI Grok API key.',
        correlationId: 'client-empty',
      });
      return;
    }

    setConnecting(true);
    setPendingConfirmation(null);
    try {
      const providerOverride =
        opts?.providerOverride ||
        (fallbackProvider ? fallbackProvider : undefined) ||
        (advProviderOverride ? advProviderOverride : undefined);

      const res = await safeFetchJson('/api/v1/admin/ai/connect-auto', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: trimmed,
          providerOverride,
          preferredModel: advPreferredModel.trim() || undefined,
          customEndpointUrl: advEndpointUrl.trim() || undefined,
          confirmBillableTest: Boolean(opts?.confirmBillableTest),
          allowPaidModels: advAllowPaidModels,
          replaceCredentialId: replaceMode && activeProvider ? activeProvider.id : undefined,
        }),
      });

      const result: AIAutoConnectResponse | undefined = res?.result;
      if (!result) {
        setLastResult({
          ok: false,
          status: 'server_error',
          billingStatus: 'unknown',
          billingNote: 'Could not verify status.',
          lastChecked: new Date().toISOString(),
          availableModels: [],
          errorCategory: 'PROVIDER_UNAVAILABLE',
          message: res?.error || 'Connection request failed.',
          correlationId: 'client-err',
        });
        return;
      }

      setLastResult(result);

      if (result.requiresProviderSelection) {
        setNeedsProviderChoice(true);
        return;
      }

      if (result.requiresBillableConfirmation) {
        setNeedsProviderChoice(false);
        setPendingConfirmation(result);
        return;
      }

      setNeedsProviderChoice(false);
      setPendingConfirmation(null);

      if (result.ok && result.provider) {
        setActiveProvider(result.provider);
        setApiKeyInput('');
        setReplaceMode(false);
        setFallbackProvider('');
        onNotify?.(result.message);
        onProvidersChanged?.();
        await loadStatus();
      }
    } catch (err: any) {
      setLastResult({
        ok: false,
        status: 'network_error',
        billingStatus: 'unknown',
        billingNote: 'Server connection error.',
        lastChecked: new Date().toISOString(),
        availableModels: [],
        errorCategory: 'SERVER_CONNECTIVITY_FAILURE',
        message: err?.message || 'Unable to reach server connection endpoint.',
        correlationId: 'client-net',
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await safeFetchJson('/api/v1/admin/ai/disconnect', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId: activeProvider?.id }),
      });
      if (res?.success) {
        setActiveProvider(null);
        setReplaceMode(false);
        setApiKeyInput('');
        setNeedsProviderChoice(false);
        setPendingConfirmation(null);
        setLastResult({
          ok: true,
          status: 'disconnected',
          billingStatus: 'unknown',
          billingNote: 'Disconnected',
          lastChecked: new Date().toISOString(),
          availableModels: [],
          message: res.message || 'AI API key disconnected.',
          correlationId: 'disconnect',
        });
        onNotify?.('AI API disconnected.');
        onProvidersChanged?.();
        await loadStatus();
      }
    } finally {
      setDisconnecting(false);
    }
  };

  const handleRetestExisting = async () => {
    if (!activeProvider) return;
    setRetesting(true);
    try {
      const res = await safeFetchJson(`/api/v1/admin/ai/providers/${activeProvider.id}/test`, {
        method: 'POST',
        credentials: 'include',
      });
      const r = res?.result;
      if (r) {
        setLastResult({
          ok: Boolean(r.ok),
          status: r.connectionStatus,
          detectedProvider: r.providerType,
          selectedModel: r.selectedModel,
          billingStatus: activeProvider.billingStatus || (r.providerType === 'gemini' ? 'free_tier' : 'credits_required'),
          billingNote: activeProvider.billingNote || (r.providerType === 'gemini' ? 'Free Tier Eligible' : 'Credits / Billing Active'),
          lastChecked: new Date().toISOString(),
          availableModels: r.availableModels || [],
          sampleOutput: r.sampleOutput,
          message: r.message,
          suggestedAction: r.diagnostic?.suggestedAction,
          correlationId: r.correlationId || 'retest',
        });
        onProvidersChanged?.();
        await loadStatus();
      }
    } finally {
      setRetesting(false);
    }
  };

  const isCurrentlyConnected = Boolean(activeProvider && activeProvider.enabled && activeProvider.connectionStatus === 'connected');
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

  const statusBadge = formatStatusBadge(displayStatus, activeProvider?.enabled ?? true);
  const billingBadge = formatBillingBadge(displayBillingStatus, displayBillingNote);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        {/* Clean Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-700" />
              <span>Connect AI API</span>
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Paste a Google Gemini or xAI Grok API key once. 360Khabarnama automatically detects the provider, selects a supported model, verifies live generation, and activates all bilingual AI editorial &amp; SEO tools.
            </p>
          </div>
          {isCurrentlyConnected && !replaceMode && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Active ({activeProvider?.maskedKey})</span>
            </span>
          )}
        </div>

        {/* Single Universal Input (shown before connection or in Replace Key mode) */}
        {showKeyInput ? (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <KeyRound className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={e => {
                    setApiKeyInput(e.target.value);
                    if (needsProviderChoice) setNeedsProviderChoice(false);
                    if (pendingConfirmation) setPendingConfirmation(null);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      executeAutoConnect();
                    }
                  }}
                  placeholder="Paste your Gemini or Grok API key"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full pl-9 pr-10 py-2.5 border border-gray-300 rounded-lg font-mono text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
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
                disabled={connecting || !apiKeyInput.trim()}
                onClick={() => executeAutoConnect()}
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg inline-flex items-center justify-center gap-2 shrink-0"
              >
                {connecting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <span>Connect Automatically</span>
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
                  <span>Provider Detection Ambiguous — Select Provider</span>
                </div>
                <p className="text-amber-900">
                  This key format did not match a standard prefix and automatic probe could not authenticate it yet. Choose its provider to run direct verification:
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
                    Connect as Google Gemini
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
                    Connect as xAI Grok
                  </button>
                </div>
              </div>
            )}

            {/* Explicit Billing Confirmation — ONLY shown for xAI Grok before running a live test */}
            {pendingConfirmation && (
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-2.5 text-xs">
                <div className="font-bold text-amber-950 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  <span>Confirm xAI Grok Live Verification Test</span>
                </div>
                <p className="text-amber-900">
                  {pendingConfirmation.message}
                </p>
                <p className="text-[11px] text-amber-800">
                  {pendingConfirmation.billingNote}
                </p>
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
                Connected via <strong>{formatProviderName(activeProvider?.providerType)}</strong> ({activeProvider?.model}). All bilingual AI tools are active.
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={retesting}
                onClick={handleRetestExisting}
                className="px-3 py-1.5 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-900 font-bold rounded-lg inline-flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${retesting ? 'animate-spin' : ''}`} />
                <span>Re-test</span>
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
            </div>
          </div>
        )}

        {/* Diagnostic Feedback Message (on failure or recent test) */}
        {lastResult && !lastResult.requiresProviderSelection && !lastResult.requiresBillableConfirmation && !lastResult.ok && (
          <div className="p-3.5 rounded-xl border bg-rose-50 border-rose-200 text-rose-950 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold">
                {lastResult.errorCategory ? `${lastResult.errorCategory.replace(/_/g, ' ')}: ` : ''}
                {lastResult.message}
              </div>
              {lastResult.suggestedAction && (
                <div className="text-[11px] text-rose-900">
                  Suggested Fix: {lastResult.suggestedAction}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5 Clean Readout Fields Below Input */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="text-[10px] font-bold uppercase text-gray-500">Detected Provider</div>
            <div className="text-xs font-black text-gray-900 mt-1">
              {loadingStatus ? 'Checking...' : formatProviderName(displayProvider)}
            </div>
          </div>

          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="text-[10px] font-bold uppercase text-gray-500">Connection Status</div>
            <div className="mt-1">
              <span className={`inline-block px-2 py-0.5 rounded border text-[11px] font-bold ${statusBadge.classes}`}>
                {loadingStatus ? 'Checking...' : statusBadge.label}
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
            <div className="text-[10px] font-bold uppercase text-gray-500">Free Tier / Billing Status</div>
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

        {/* Optional Collapsible Advanced Settings */}
        <div className="border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={() => setShowAdvanced(s => !s)}
            className="text-xs font-bold text-gray-600 hover:text-gray-900 inline-flex items-center gap-1.5"
          >
            {showAdvanced ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <span>Advanced Settings (Optional)</span>
          </button>

          {showAdvanced && (
            <div className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Provider Override (Optional)</label>
                  <select
                    value={advProviderOverride}
                    onChange={e => setAdvProviderOverride(e.target.value as '' | 'gemini' | 'grok')}
                    className="w-full p-2 border border-gray-300 rounded-lg bg-white text-xs"
                  >
                    <option value="">Auto-Detect (Recommended)</option>
                    <option value="gemini">Force Google Gemini</option>
                    <option value="grok">Force xAI Grok</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Preferred Model Override (Optional)</label>
                  <input
                    type="text"
                    value={advPreferredModel}
                    onChange={e => setAdvPreferredModel(e.target.value)}
                    placeholder="Auto (e.g. gemini-4-hydrogen)"
                    className="w-full p-2 border border-gray-300 rounded-lg font-mono text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Custom Endpoint URL (Optional)</label>
                  <input
                    type="text"
                    value={advEndpointUrl}
                    onChange={e => setAdvEndpointUrl(e.target.value)}
                    placeholder="Default official provider endpoint"
                    className="w-full p-2 border border-gray-300 rounded-lg font-mono text-xs bg-white"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-gray-700 font-semibold">
                <input
                  type="checkbox"
                  checked={advAllowPaidModels}
                  onChange={e => setAdvAllowPaidModels(e.target.checked)}
                />
                <span>Allow paid-only Gemini Pro/Argon models if no free-tier model is available</span>
              </label>

              {!embeddedInAdvancedVault && onOpenAdvancedVault && (
                <div className="pt-2 border-t border-gray-200 flex items-center justify-between gap-2">
                  <span className="text-gray-500">
                    Need multi-key failover, per-task model overrides, token ledger, or outbound network diagnostics?
                  </span>
                  <button
                    type="button"
                    onClick={onOpenAdvancedVault}
                    className="px-3 py-1.5 bg-gray-900 hover:bg-black text-white font-bold rounded-lg shrink-0"
                  >
                    Open Multi-Key Vault &amp; Task Routing →
                  </button>
                </div>
              )}

              {embeddedInAdvancedVault && advancedContent}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
