/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — AI & API Providers Connection Manager, Live Discovery & Routing
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  KeyRound,
  Plus,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Trash2,
  ShieldAlert,
  Sliders,
  Activity,
  Power,
  X,
  Eye,
  EyeOff,
  Server,
  Sparkles,
  FileText,
  Wifi,
  WifiOff,
  Loader2,
} from 'lucide-react';
import {
  AIConnectionStatus,
  AIConnectionTestRecord,
  AIModelInfo,
  AIProviderCredential,
  AIProviderType,
  AITaskRouting,
  AIUsageLog,
  AIValidationResult,
} from '../../types/index.ts';
import { safeFetchJson } from '../../utils/safeFetch.ts';

interface APIKeyManagerProps {
  onNotify?: (msg: string) => void;
  onProvidersChanged?: () => void;
}

type ExtendedCredential = AIProviderCredential & {
  assignedTasks?: string[];
};

function statusBadgeProps(status?: AIConnectionStatus, enabled: boolean = true): {
  label: string;
  classes: string;
} {
  if (!enabled || status === 'disabled') {
    return { label: 'Disabled', classes: 'bg-gray-100 text-gray-600 border-gray-200' };
  }
  switch (status) {
    case 'connected':
      return { label: 'Connected', classes: 'bg-emerald-50 text-emerald-800 border-emerald-300' };
    case 'authenticated_generation_unavailable':
      return {
        label: 'Authenticated — Gen Unavailable',
        classes: 'bg-amber-50 text-amber-900 border-amber-300',
      };
    case 'auth_failed':
      return { label: 'Auth Failed (401)', classes: 'bg-rose-50 text-rose-800 border-rose-300' };
    case 'permission_denied':
      return { label: 'Permission Denied (403)', classes: 'bg-rose-50 text-rose-800 border-rose-300' };
    case 'quota_exhausted':
      return { label: 'Quota Exhausted (429)', classes: 'bg-amber-50 text-amber-900 border-amber-300' };
    case 'billing_required':
      return { label: 'Billing / Credits Required', classes: 'bg-orange-50 text-orange-900 border-orange-300' };
    case 'endpoint_not_found':
      return { label: 'Model/Endpoint 404', classes: 'bg-rose-50 text-rose-800 border-rose-300' };
    case 'timeout':
      return { label: 'Timeout', classes: 'bg-amber-50 text-amber-900 border-amber-300' };
    case 'network_error':
      return { label: 'Network / TLS Error', classes: 'bg-rose-50 text-rose-900 border-rose-300' };
    case 'server_error':
      return { label: 'Provider 5xx Error', classes: 'bg-rose-50 text-rose-800 border-rose-300' };
    case 'malformed_response':
      return { label: 'Malformed Response', classes: 'bg-rose-50 text-rose-800 border-rose-300' };
    case 'error':
      return { label: 'Connection Error', classes: 'bg-rose-50 text-rose-800 border-rose-300' };
    default:
      return { label: 'Untested', classes: 'bg-gray-100 text-gray-700 border-gray-200' };
  }
}

export const APIKeyManager: React.FC<APIKeyManagerProps> = ({ onNotify, onProvidersChanged }) => {
  const [subTab, setSubTab] = useState<'credentials' | 'routing' | 'usage' | 'diagnostics'>('credentials');
  const [credentials, setCredentials] = useState<ExtendedCredential[]>([]);
  const [routes, setRoutes] = useState<AITaskRouting[]>([]);
  const [usageSummary, setUsageSummary] = useState<{
    totalRequests: number;
    requests24h: number;
    tokens24h: number;
    totalCostUsd: number;
    errorRatePercent: number;
    logs: AIUsageLog[];
  } | null>(null);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [healthBusy, setHealthBusy] = useState(false);

  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<{
    ok: boolean;
    text: string;
    suggestion?: string;
    correlationId?: string;
  } | null>(null);

  // Logs drawer state
  const [logsModalCred, setLogsModalCred] = useState<ExtendedCredential | null>(null);
  const [credLogs, setCredLogs] = useState<{ tests: AIConnectionTestRecord[]; usage: AIUsageLog[] }>({
    tests: [],
    usage: [],
  });
  const [logsLoading, setLogsLoading] = useState(false);

  // Add / Replace Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formProviderType, setFormProviderType] = useState<AIProviderType>('gemini');
  const [formLabel, setFormLabel] = useState('');
  const [formProjectId, setFormProjectId] = useState('');
  const [formEndpointUrl, setFormEndpointUrl] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [formPriority, setFormPriority] = useState(10);
  const [formDailyTokenLimit, setFormDailyTokenLimit] = useState(250000);
  const [formMonthlyBudgetUsd, setFormMonthlyBudgetUsd] = useState(0);

  // Live validation state inside modal
  const [validatingStep, setValidatingStep] = useState<'idle' | 'discovering' | 'testing_generation'>('idle');
  const [validationResult, setValidationResult] = useState<AIValidationResult | null>(null);
  const [discoveredModels, setDiscoveredModels] = useState<AIModelInfo[]>([]);
  const [saving, setSaving] = useState(false);
  const debounceTimerRef = useRef<number | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [provRes, routeRes, useRes, diagRes] = await Promise.all([
        safeFetchJson('/api/v1/admin/ai/providers', { credentials: 'include' }),
        safeFetchJson('/api/v1/admin/ai/task-routes', { credentials: 'include' }),
        safeFetchJson('/api/v1/admin/ai/usage', { credentials: 'include' }),
        safeFetchJson('/api/v1/admin/ai/diagnostics', { credentials: 'include' }),
      ]);
      if (provRes.success) setCredentials(provRes.providers || []);
      if (routeRes.success) setRoutes(routeRes.routes || []);
      if (useRes.success) setUsageSummary(useRes.usage || null);
      if (diagRes.success) setDiagnostics(diagRes);
      const firstErr = provRes.error || routeRes.error || useRes.error;
      if (firstErr && !provRes.success) {
        setStatusBanner({ ok: false, text: firstErr });
      }
    } catch (e: any) {
      setStatusBanner({ ok: false, text: e?.message || 'Failed to load AI provider settings.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    return () => {
      if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const runValidation = async (opts: {
    providerType: AIProviderType;
    apiKey: string;
    credentialId?: string | null;
    endpointUrl?: string;
    model?: string;
    runGenerationTest: boolean;
  }) => {
    setValidatingStep(opts.runGenerationTest ? 'testing_generation' : 'discovering');
    try {
      const res = await safeFetchJson('/api/v1/admin/ai/providers/validate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerType: opts.providerType,
          apiKey: opts.apiKey.trim() || undefined,
          credentialId: opts.credentialId || undefined,
          endpointUrl: opts.endpointUrl?.trim() || undefined,
          model: opts.model?.trim() || undefined,
          runGenerationTest: opts.runGenerationTest,
        }),
      });

      const result: AIValidationResult | undefined = res.result;
      if (result) {
        setValidationResult(result);
        if (result.availableModels && result.availableModels.length > 0) {
          setDiscoveredModels(result.availableModels);
          if (!opts.model || !result.availableModels.some(m => m.id === opts.model)) {
            if (result.selectedModel) setFormModel(result.selectedModel);
          }
        }
      } else {
        setValidationResult({
          ok: false,
          authenticated: false,
          generationVerified: false,
          connectionStatus: 'error',
          message: res.error || 'Validation request failed.',
          latencyMs: 0,
          providerType: opts.providerType,
          selectedModel: opts.model || '',
          availableModels: [],
          correlationId: 'client-err',
        });
      }
    } catch (err: any) {
      setValidationResult({
        ok: false,
        authenticated: false,
        generationVerified: false,
        connectionStatus: 'network_error',
        message: err?.message || 'Network error reaching backend validation endpoint.',
        latencyMs: 0,
        providerType: opts.providerType,
        selectedModel: opts.model || '',
        availableModels: [],
        correlationId: 'client-net',
      });
    } finally {
      setValidatingStep('idle');
    }
  };

  // Debounced lightweight validation (/models ONLY) when API key is pasted/edited
  const handleApiKeyInputChange = (val: string) => {
    setFormApiKey(val);
    setValidationResult(null);
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);

    const trimmed = val.trim();
    if (trimmed.length >= 20) {
      debounceTimerRef.current = window.setTimeout(() => {
        runValidation({
          providerType: formProviderType,
          apiKey: trimmed,
          credentialId: editingId,
          endpointUrl: formEndpointUrl,
          model: formModel,
          runGenerationTest: false,
        });
      }, 750);
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormProviderType('gemini');
    setFormLabel(`Google Gemini Key #${credentials.filter(c => c.providerType === 'gemini').length + 1}`);
    setFormProjectId(`gcp-project-${Math.floor(100 + Math.random() * 900)}`);
    setFormEndpointUrl('');
    setFormModel('');
    setFormApiKey('');
    setShowKey(false);
    setFormPriority(10 + credentials.length * 5);
    setFormDailyTokenLimit(250000);
    setFormMonthlyBudgetUsd(0);
    setValidationResult(null);
    setDiscoveredModels([]);
    setValidatingStep('idle');
    setModalOpen(true);
  };

  const openEditModal = (cred: ExtendedCredential) => {
    setEditingId(cred.id);
    setFormProviderType(cred.providerType);
    setFormLabel(cred.label);
    setFormProjectId(cred.projectId);
    setFormEndpointUrl(cred.endpointUrl || (cred.providerType === 'grok' ? 'https://api.x.ai/v1' : ''));
    setFormModel(cred.model);
    setFormApiKey('');
    setShowKey(false);
    setFormPriority(cred.priority);
    setFormDailyTokenLimit(cred.dailyTokenLimit);
    setFormMonthlyBudgetUsd(cred.monthlyBudgetUsd);
    setValidationResult(null);
    setDiscoveredModels(cred.availableModels || []);
    setValidatingStep('idle');
    setModalOpen(true);
  };

  const handleValidateAndConnect = async () => {
    await runValidation({
      providerType: formProviderType,
      apiKey: formApiKey,
      credentialId: editingId,
      endpointUrl: formEndpointUrl,
      model: formModel,
      runGenerationTest: true,
    });
  };

  const handleSaveCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusBanner(null);
    try {
      const d = await safeFetchJson('/api/v1/admin/ai/providers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId || undefined,
          providerType: formProviderType,
          label: formLabel,
          projectId: formProjectId.trim() || `${formProviderType}-project`,
          endpointUrl:
            formEndpointUrl.trim() ||
            (formProviderType === 'grok' ? 'https://api.x.ai/v1' : undefined),
          model: formModel.trim(),
          apiKey: formApiKey.trim() || undefined,
          priority: formPriority,
          dailyTokenLimit: formDailyTokenLimit,
          monthlyBudgetUsd: formMonthlyBudgetUsd,
          validationResult: validationResult || undefined,
        }),
      });
      if (d.success) {
        setModalOpen(false);
        const isVerified = d.provider?.connectionStatus === 'connected';
        setStatusBanner({
          ok: true,
          text: isVerified
            ? `Saved & connected "${d.provider.label}" (${d.provider.model}) — encrypted with AES-256-GCM.`
            : `Saved "${d.provider?.label}" encrypted at rest (${d.provider?.connectionStatus || 'untested'}).`,
        });
        onNotify?.('AI credential saved.');
        onProvidersChanged?.();
        loadAll();
      } else {
        setStatusBanner({ ok: false, text: d.error || 'Failed to save credential.' });
      }
    } catch (err: any) {
      setStatusBanner({ ok: false, text: err?.message || 'Network error saving credential.' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    setStatusBanner(null);
    try {
      const d = await safeFetchJson(`/api/v1/admin/ai/providers/${id}/test`, {
        method: 'POST',
        credentials: 'include',
      });
      const r: AIValidationResult | undefined = d.result;
      setStatusBanner({
        ok: Boolean(r?.ok),
        text: r?.message || d.error || 'Connection test completed.',
        suggestion: r?.diagnostic?.suggestedAction,
        correlationId: r?.correlationId,
      });
      onProvidersChanged?.();
      loadAll();
    } catch (e: any) {
      setStatusBanner({ ok: false, text: e?.message || 'Test request failed.' });
    } finally {
      setTestingId(null);
    }
  };

  const handleToggleEnabled = async (cred: ExtendedCredential) => {
    const d = await safeFetchJson(`/api/v1/admin/ai/providers/${cred.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !cred.enabled }),
    });
    if (d.success) {
      onProvidersChanged?.();
      loadAll();
    } else if (d.error) {
      setStatusBanner({ ok: false, text: d.error });
    }
  };

  const handleDelete = async (id: string) => {
    const d = await safeFetchJson(`/api/v1/admin/ai/providers/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (d.success) {
      setStatusBanner({ ok: true, text: 'AI API key revoked and permanently deleted.' });
      onProvidersChanged?.();
      loadAll();
    } else if (d.error) {
      setStatusBanner({ ok: false, text: d.error });
    }
  };

  const handleOpenLogs = async (cred: ExtendedCredential) => {
    setLogsModalCred(cred);
    setLogsLoading(true);
    try {
      const d = await safeFetchJson(`/api/v1/admin/ai/providers/${cred.id}/logs`, {
        credentials: 'include',
      });
      if (d.success) {
        setCredLogs({ tests: d.tests || [], usage: d.usage || [] });
      }
    } finally {
      setLogsLoading(false);
    }
  };

  const handleSaveRoute = async (route: AITaskRouting) => {
    const d = await safeFetchJson('/api/v1/admin/ai/task-routes', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(route),
    });
    if (d.success) {
      setStatusBanner({ ok: true, text: `Updated task routing for "${route.label}".` });
      loadAll();
    } else {
      setStatusBanner({ ok: false, text: d.error || 'Failed updating route.' });
    }
  };

  const handleRunHealthCheck = async () => {
    setHealthBusy(true);
    setStatusBanner(null);
    try {
      const d = await safeFetchJson('/api/v1/admin/ai/health-check', {
        method: 'POST',
        credentials: 'include',
      });
      if (d.success && d.summary) {
        setStatusBanner({
          ok: d.summary.failingCount === 0,
          text: `Health Check Complete: ${d.summary.healthyCount}/${d.summary.credentialsChecked} credentials healthy. Outbound HTTPS: ${
            d.summary.connectivity?.overallOk ? 'Reachable' : 'Blocked/Error'
          }.`,
        });
        loadAll();
      } else {
        setStatusBanner({ ok: false, text: d.error || 'Health check failed.' });
      }
    } finally {
      setHealthBusy(false);
    }
  };

  const connectedCount = credentials.filter(c => c.enabled && c.connectionStatus === 'connected').length;

  return (
    <div className="space-y-5">
      {/* Header Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-emerald-700" />
            <span>AI & API Providers — Live Verification, Discovery & Task Routing</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Supports unlimited Google Gemini & xAI Grok credentials (AES-256-GCM encrypted server-side). Green &ldquo;Connected&rdquo; status requires a verified live text-generation test.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRunHealthCheck}
            disabled={healthBusy}
            className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-lg inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${healthBusy ? 'animate-spin' : ''}`} />
            <span>Health Check</span>
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Connect Provider Key</span>
          </button>
        </div>
      </div>

      {/* Policy & Quota Isolation Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <strong>Single-Project Quota Isolation & Failover Policy:</strong> Multiple keys under the same Project ID are tracked but never rotated to bypass project rate limits. Failover runs strictly across distinct Project IDs or providers.
          </div>
        </div>
        <div className="text-[11px] font-mono font-bold shrink-0 px-2.5 py-1 rounded bg-white border border-amber-200">
          Verified Active: {connectedCount} / {credentials.length}
        </div>
      </div>

      {statusBanner && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-start justify-between gap-2 ${
            statusBanner.ok
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : 'bg-rose-50 border-rose-200 text-rose-950'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {statusBanner.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            <div className="space-y-1">
              <div className="font-bold">{statusBanner.text}</div>
              {statusBanner.suggestion && <div className="text-[11px] opacity-90">Suggested Action: {statusBanner.suggestion}</div>}
              {statusBanner.correlationId && (
                <div className="text-[10px] font-mono opacity-75">Correlation ID: {statusBanner.correlationId}</div>
              )}
            </div>
          </div>
          <button onClick={() => setStatusBanner(null)} className="text-gray-500 hover:text-gray-900">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Sub-navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-2">
        {[
          { id: 'credentials', label: `API Credentials (${credentials.length})`, icon: KeyRound },
          { id: 'routing', label: `Task Routing & Fallback (${routes.length})`, icon: Sliders },
          { id: 'usage', label: 'Usage & Token Ledger', icon: Activity },
          { id: 'diagnostics', label: 'Hosting & Outbound Diagnostics', icon: Server },
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id as any)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                subTab === t.id ? 'bg-emerald-800 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: CREDENTIALS */}
      {subTab === 'credentials' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-xs text-gray-500">Loading encrypted provider vault...</div>
          ) : credentials.length === 0 ? (
            <div className="p-10 text-center space-y-3 text-xs text-gray-500">
              <p className="font-bold text-gray-800 text-sm">No AI API keys configured yet.</p>
              <p>Connect a Google Gemini key or xAI Grok key to enable News Composer AI, SEO Manager suggestions, AI Newsroom, and Editorial Studio.</p>
              <button
                type="button"
                onClick={openAddModal}
                className="px-4 py-2 bg-emerald-700 text-white font-bold rounded-lg inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Connect First Provider Key</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold">
                  <tr>
                    <th className="p-3">Provider & Credential</th>
                    <th className="p-3">Masked Key</th>
                    <th className="p-3">Connection Status</th>
                    <th className="p-3">Model Discovery & Gen</th>
                    <th className="p-3">Assigned Tasks</th>
                    <th className="p-3">Usage & Last Test</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {credentials.map(cred => {
                    const isEnv = cred.id.startsWith('env-');
                    const badge = statusBadgeProps(cred.connectionStatus, cred.enabled);
                    const modelCount = cred.availableModels?.length || 0;
                    return (
                      <tr key={cred.id} className="hover:bg-gray-50 align-top">
                        <td className="p-3">
                          <div className="font-bold text-gray-900">{cred.label}</div>
                          <div className="text-[11px] text-gray-500 font-mono">
                            {cred.providerType.toUpperCase()} • {cred.projectId} • P{cred.priority}
                          </div>
                        </td>
                        <td className="p-3 font-mono text-[11px] text-gray-700 whitespace-nowrap">
                          {cred.maskedKey}
                        </td>
                        <td className="p-3 space-y-1">
                          <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold ${badge.classes}`}>
                            {badge.label}
                          </span>
                          {cred.lastTestMessage && (
                            <div className="text-[10px] text-gray-600 max-w-[210px] line-clamp-2" title={cred.lastTestMessage}>
                              {cred.lastTestMessage}
                            </div>
                          )}
                          {cred.lastDiagnostic?.suggestedAction && cred.connectionStatus !== 'connected' && (
                            <div className="text-[10px] text-amber-800 max-w-[210px] line-clamp-2" title={cred.lastDiagnostic.suggestedAction}>
                              Fix: {cred.lastDiagnostic.suggestedAction}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-[11px] space-y-1">
                          <div className="font-mono font-bold text-emerald-800">{cred.model || '—'}</div>
                          <div className="flex flex-wrap gap-1 text-[10px]">
                            <span
                              className={`px-1.5 py-0.5 rounded ${
                                cred.modelListStatus === 'ok'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : cred.modelListStatus === 'error'
                                  ? 'bg-rose-50 text-rose-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              Models: {cred.modelListStatus || 'untested'} {modelCount > 0 ? `(${modelCount})` : ''}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded ${
                                cred.generationTestStatus === 'ok'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : cred.generationTestStatus === 'error'
                                  ? 'bg-rose-50 text-rose-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              Gen: {cred.generationTestStatus || 'untested'}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-[10px] text-gray-600 max-w-[160px]">
                          {cred.assignedTasks && cred.assignedTasks.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {cred.assignedTasks.slice(0, 3).map(t => (
                                <span key={t} className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-700">
                                  {t}
                                </span>
                              ))}
                              {cred.assignedTasks.length > 3 && (
                                <span className="text-gray-500">+{cred.assignedTasks.length - 3} more</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">Auto pool</span>
                          )}
                        </td>
                        <td className="p-3 text-[10px] font-mono text-gray-600 space-y-0.5">
                          <div>{(cred.dailyTokensUsed || 0).toLocaleString()} / {(cred.dailyTokenLimit || 0).toLocaleString()} tok</div>
                          <div>${(cred.monthlySpendUsd || 0).toFixed(4)} / ${cred.monthlyBudgetUsd}</div>
                          {cred.lastTestedAt && (
                            <div className="text-gray-400">Tested: {new Date(cred.lastTestedAt).toLocaleTimeString()}</div>
                          )}
                          {cred.lastFailureAt && (
                            <div className="text-rose-600">Last fail: {new Date(cred.lastFailureAt).toLocaleTimeString()}</div>
                          )}
                        </td>
                        <td className="p-3 text-right space-x-1 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleTest(cred.id)}
                            disabled={testingId === cred.id}
                            className="px-2 py-1 bg-gray-100 hover:bg-emerald-700 hover:text-white text-gray-800 font-bold rounded text-[11px] inline-flex items-center gap-1"
                            title="Re-test model list + live text generation"
                          >
                            <RefreshCw className={`w-3 h-3 ${testingId === cred.id ? 'animate-spin' : ''}`} />
                            <span>Re-test</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenLogs(cred)}
                            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded text-[11px] inline-flex items-center gap-1"
                            title="View connection test & usage logs"
                          >
                            <FileText className="w-3 h-3" />
                            <span>Logs</span>
                          </button>
                          {!isEnv && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleToggleEnabled(cred)}
                                className={`px-2 py-1 rounded text-[11px] font-bold inline-flex items-center gap-1 ${
                                  cred.enabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500'
                                }`}
                              >
                                <Power className="w-3 h-3" />
                                <span>{cred.enabled ? 'On' : 'Off'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditModal(cred)}
                                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded text-[11px]"
                              >
                                Replace
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(cred.id)}
                                className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                                title="Revoke & Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TASK ROUTING */}
      {subTab === 'routing' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-100 text-xs text-gray-600">
            Assign any verified Gemini or Grok credential and model to each editorial task, plus an isolated cross-project / cross-provider fallback.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 border-b border-gray-200 font-bold text-gray-600">
                <tr>
                  <th className="p-3">Task</th>
                  <th className="p-3">Primary Credential</th>
                  <th className="p-3">Primary Model</th>
                  <th className="p-3">Fallback Credential</th>
                  <th className="p-3">Fallback Model</th>
                  <th className="p-3">Temp</th>
                  <th className="p-3 text-right">Save</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {routes.map((r, idx) => {
                  const primaryCred = credentials.find(c => c.id === r.primaryCredentialId);
                  const fallbackCred = credentials.find(c => c.id === r.fallbackCredentialId);
                  const primaryModels = (primaryCred?.availableModels || []).filter(m => m.supportsTextGeneration);
                  const fallbackModels = (fallbackCred?.availableModels || []).filter(m => m.supportsTextGeneration);
                  return (
                    <tr key={r.task} className="hover:bg-gray-50">
                      <td className="p-3">
                        <div className="font-bold text-gray-900">{r.label}</div>
                        <div className="font-mono text-[10px] text-gray-500">{r.task}</div>
                      </td>
                      <td className="p-3">
                        <select
                          value={r.primaryCredentialId}
                          onChange={e => {
                            const selected = credentials.find(c => c.id === e.target.value);
                            const next = [...routes];
                            next[idx] = {
                              ...r,
                              primaryCredentialId: e.target.value,
                              primaryModel: selected?.model || r.primaryModel,
                            };
                            setRoutes(next);
                          }}
                          className="p-1.5 border border-gray-300 rounded text-xs bg-white max-w-[190px]"
                        >
                          <option value="">-- Auto Select Connected --</option>
                          {credentials.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.label} ({c.providerType})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          list={`models-primary-${r.task}`}
                          value={r.primaryModel}
                          onChange={e => {
                            const next = [...routes];
                            next[idx] = { ...r, primaryModel: e.target.value };
                            setRoutes(next);
                          }}
                          className="p-1.5 border border-gray-300 rounded font-mono text-xs w-44"
                        />
                        <datalist id={`models-primary-${r.task}`}>
                          {primaryModels.map(m => (
                            <option key={m.id} value={m.id} />
                          ))}
                        </datalist>
                      </td>
                      <td className="p-3">
                        <select
                          value={r.fallbackCredentialId || ''}
                          onChange={e => {
                            const selected = credentials.find(c => c.id === e.target.value);
                            const next = [...routes];
                            next[idx] = {
                              ...r,
                              fallbackCredentialId: e.target.value,
                              fallbackModel: selected?.model || '',
                            };
                            setRoutes(next);
                          }}
                          className="p-1.5 border border-gray-300 rounded text-xs bg-white max-w-[190px]"
                        >
                          <option value="">None</option>
                          {credentials
                            .filter(c => c.id !== r.primaryCredentialId)
                            .map(c => (
                              <option key={c.id} value={c.id}>
                                {c.label} ({c.projectId})
                              </option>
                            ))}
                        </select>
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          list={`models-fallback-${r.task}`}
                          value={r.fallbackModel || ''}
                          onChange={e => {
                            const next = [...routes];
                            next[idx] = { ...r, fallbackModel: e.target.value };
                            setRoutes(next);
                          }}
                          placeholder="Auto"
                          className="p-1.5 border border-gray-300 rounded font-mono text-xs w-36"
                        />
                        <datalist id={`models-fallback-${r.task}`}>
                          {fallbackModels.map(m => (
                            <option key={m.id} value={m.id} />
                          ))}
                        </datalist>
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="1"
                          value={r.temperature}
                          onChange={e => {
                            const next = [...routes];
                            next[idx] = { ...r, temperature: parseFloat(e.target.value) || 0.3 };
                            setRoutes(next);
                          }}
                          className="p-1.5 border border-gray-300 rounded font-mono text-xs w-14"
                        />
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleSaveRoute(routes[idx])}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded text-[11px]"
                        >
                          Save
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: USAGE & LOGS */}
      {subTab === 'usage' && usageSummary && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-[11px] font-bold text-gray-500 uppercase">Requests (24h)</div>
              <div className="text-xl font-black text-gray-900 font-mono tabular-nums mt-1">{usageSummary.requests24h}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-[11px] font-bold text-gray-500 uppercase">Tokens Used (24h)</div>
              <div className="text-xl font-black text-emerald-700 font-mono tabular-nums mt-1">
                {usageSummary.tokens24h.toLocaleString()}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-[11px] font-bold text-gray-500 uppercase">Estimated Spend</div>
              <div className="text-xl font-black text-gray-900 font-mono tabular-nums mt-1">
                ${usageSummary.totalCostUsd.toFixed(4)}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-[11px] font-bold text-gray-500 uppercase">Error Rate</div>
              <div className="text-xl font-black text-rose-600 font-mono tabular-nums mt-1">
                {usageSummary.errorRatePercent}%
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 border-b border-gray-200 font-bold text-gray-600">
                  <tr>
                    <th className="p-3">Time</th>
                    <th className="p-3">Task</th>
                    <th className="p-3">Model / Project</th>
                    <th className="p-3">Tokens</th>
                    <th className="p-3">Cost / Latency</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {usageSummary.logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-gray-500">
                        No AI generation calls logged yet.
                      </td>
                    </tr>
                  ) : (
                    usageSummary.logs.map(l => (
                      <tr key={l.id}>
                        <td className="p-3 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                          {new Date(l.timestamp).toLocaleString()}
                        </td>
                        <td className="p-3 font-semibold text-gray-900">{l.task}</td>
                        <td className="p-3 font-mono text-[11px]">
                          <div>{l.model}</div>
                          <div className="text-gray-400">{l.projectId}</div>
                        </td>
                        <td className="p-3 font-mono tabular-nums text-[11px]">{l.totalTokens.toLocaleString()}</td>
                        <td className="p-3 font-mono tabular-nums text-[11px]">
                          ${l.estimatedCostUsd.toFixed(5)} • {l.latencyMs}ms
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              l.status === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {l.status}
                          </span>
                          {l.errorMessage && (
                            <div className="text-[10px] text-rose-600 mt-0.5 max-w-[240px] truncate" title={l.errorMessage}>
                              {l.errorMessage}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: HOSTING & OUTBOUND DIAGNOSTICS */}
      {subTab === 'diagnostics' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-gray-900">Server Outbound HTTPS Diagnostics (Namecheap & Hosting Firewall Check)</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Verifies DNS resolution and TLS Port 443 connectivity from this Node.js backend to official Google Gemini and xAI endpoints.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRunHealthCheck}
                disabled={healthBusy}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${healthBusy ? 'animate-spin' : ''}`} />
                <span>Re-check Connectivity & Health</span>
              </button>
            </div>

            {diagnostics?.connectivity && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(diagnostics.connectivity.hosts || []).map((h: any) => (
                  <div
                    key={h.host}
                    className={`p-4 rounded-xl border text-xs space-y-2 ${
                      h.httpsReachable ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50 border-rose-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-gray-900 flex items-center gap-1.5">
                        {h.httpsReachable ? (
                          <Wifi className="w-4 h-4 text-emerald-700" />
                        ) : (
                          <WifiOff className="w-4 h-4 text-rose-700" />
                        )}
                        {h.provider}
                      </span>
                      <span className="font-mono text-[11px] font-bold">
                        {h.httpsReachable ? `Reachable (${h.latencyMs}ms)` : 'Unreachable'}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-gray-700">
                      Host: {h.host} {h.resolvedIp ? `(${h.resolvedIp})` : ''}
                    </div>
                    {h.error && <div className="text-rose-800 font-semibold">{h.error}</div>}
                    {h.guidance && <div className="text-amber-900 bg-white/80 p-2 rounded border border-amber-200">{h.guidance}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Connection Tests */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-100 text-xs font-black text-gray-900">
              Recent Validation & Health Check Audit Trail
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 border-b border-gray-200 font-bold text-gray-600">
                  <tr>
                    <th className="p-3">Time</th>
                    <th className="p-3">Provider / Stage</th>
                    <th className="p-3">Model</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Latency</th>
                    <th className="p-3">Details / Correlation ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(diagnostics?.recentTests || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-gray-500">
                        No validation tests recorded yet.
                      </td>
                    </tr>
                  ) : (
                    (diagnostics.recentTests || []).map((t: AIConnectionTestRecord) => (
                      <tr key={t.id}>
                        <td className="p-3 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                          {new Date(t.timestamp).toLocaleString()}
                        </td>
                        <td className="p-3 font-mono text-[11px]">
                          <span className="font-bold uppercase">{t.providerType}</span> • {t.stage}
                        </td>
                        <td className="p-3 font-mono text-[11px]">{t.modelTested || '—'}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                              statusBadgeProps(t.connectionStatus, true).classes
                            }`}
                          >
                            {t.connectionStatus}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[11px]">{t.latencyMs}ms</td>
                        <td className="p-3 text-[11px] text-gray-600">
                          {t.diagnostic ? (
                            <span>
                              [{t.diagnostic.correlationId}] {t.diagnostic.title}
                            </span>
                          ) : (
                            <span className="text-emerald-800">{t.sampleOutput || 'OK'}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ADD / VALIDATE & CONNECT CREDENTIAL MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveCredential}
            className="bg-white border border-gray-200 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl text-xs my-8"
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-700" />
                <span>{editingId ? 'Replace / Re-Verify AI API Key' : 'Connect & Validate AI Provider API Key'}</span>
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Provider</label>
                <select
                  value={formProviderType}
                  disabled={Boolean(editingId)}
                  onChange={e => {
                    const pt = e.target.value as AIProviderType;
                    setFormProviderType(pt);
                    setFormModel('');
                    setDiscoveredModels([]);
                    setValidationResult(null);
                    setFormEndpointUrl(pt === 'grok' ? 'https://api.x.ai/v1' : '');
                  }}
                  className="w-full p-2.5 border border-gray-300 rounded-lg bg-white font-semibold"
                >
                  <option value="gemini">Google Gemini (generativelanguage.googleapis.com)</option>
                  <option value="grok">xAI Grok (api.x.ai/v1)</option>
                  <option value="custom">Custom OpenAI-Compatible Endpoint</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Friendly Credential Name</label>
                <input
                  type="text"
                  required
                  value={formLabel}
                  onChange={e => setFormLabel(e.target.value)}
                  placeholder="e.g. Newsroom Gemini Primary"
                  className="w-full p-2.5 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Project / Account Tag <span className="text-[10px] font-normal text-gray-500">(isolates rate-limit pools)</span>
                </label>
                <input
                  type="text"
                  required
                  value={formProjectId}
                  onChange={e => setFormProjectId(e.target.value)}
                  placeholder={formProviderType === 'gemini' ? 'gcp-project-news-01' : 'xai-team-default'}
                  className="w-full p-2.5 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Model {discoveredModels.length > 0 && <span className="text-emerald-700">({discoveredModels.length} discovered live)</span>}
                </label>
                {discoveredModels.length > 0 ? (
                  <select
                    value={formModel}
                    onChange={e => setFormModel(e.target.value)}
                    className="w-full p-2.5 border border-emerald-400 bg-emerald-50/40 rounded-lg font-mono"
                  >
                    {discoveredModels
                      .filter(m => m.supportsTextGeneration)
                      .map(m => (
                        <option key={m.id} value={m.id}>
                          {m.id} {m.displayName && m.displayName !== m.id ? `— ${m.displayName}` : ''}
                        </option>
                      ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formModel}
                    onChange={e => setFormModel(e.target.value)}
                    placeholder="Auto-selected after key validation"
                    className="w-full p-2.5 border border-gray-300 rounded-lg font-mono"
                  />
                )}
              </div>
            </div>

            {formProviderType !== 'gemini' && (
              <div>
                <label className="block font-bold text-gray-700 mb-1">API Base URL</label>
                <input
                  type="url"
                  value={formEndpointUrl}
                  onChange={e => setFormEndpointUrl(e.target.value)}
                  placeholder={formProviderType === 'grok' ? 'https://api.x.ai/v1' : 'https://api.example.com/v1'}
                  className="w-full p-2.5 border border-gray-300 rounded-lg font-mono"
                />
              </div>
            )}

            {/* API Key Input with Show/Hide + Validate & Connect */}
            <div>
              <label className="block font-bold text-gray-700 mb-1">
                {editingId ? 'API Secret Key (enter new key to replace, or leave blank to test saved key)' : 'API Secret Key'}
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showKey ? 'text' : 'password'}
                    required={!editingId}
                    value={formApiKey}
                    onChange={e => handleApiKeyInputChange(e.target.value)}
                    placeholder={formProviderType === 'gemini' ? 'AIza...' : 'xai-...'}
                    autoComplete="off"
                    className="w-full p-2.5 pr-10 border border-gray-300 rounded-lg font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(s => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800"
                    title={showKey ? 'Hide API Key' : 'Show API Key'}
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  type="button"
                  disabled={validatingStep !== 'idle' || (!formApiKey.trim() && !editingId)}
                  onClick={handleValidateAndConnect}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg inline-flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                >
                  {validatingStep !== 'idle' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  <span>{validatingStep === 'testing_generation' ? 'Testing Live Gen...' : 'Validate & Connect'}</span>
                </button>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                Pasting a key runs a lightweight model-list check automatically. Click <strong>Validate &amp; Connect</strong> to execute a live text generation test before saving.
              </p>
            </div>

            {/* Live Validation Progress / Result Panel */}
            {validatingStep !== 'idle' && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2.5 text-slate-800">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
                <span>
                  {validatingStep === 'discovering'
                    ? 'Authenticating & discovering accessible models from official provider API...'
                    : 'Running live model discovery + test text generation on server...'}
                </span>
              </div>
            )}

            {validationResult && validatingStep === 'idle' && (
              <div
                className={`p-4 rounded-xl border space-y-2 ${
                  validationResult.generationVerified
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : validationResult.authenticated
                    ? 'bg-amber-50 border-amber-300 text-amber-950'
                    : 'bg-rose-50 border-rose-300 text-rose-950'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-black flex items-center gap-1.5">
                    {validationResult.generationVerified ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    ) : validationResult.authenticated ? (
                      <AlertTriangle className="w-4 h-4 text-amber-700" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-700" />
                    )}
                    <span>{statusBadgeProps(validationResult.connectionStatus, true).label}</span>
                  </div>
                  <span className="font-mono text-[10px] opacity-80">
                    {validationResult.latencyMs}ms • {validationResult.correlationId}
                  </span>
                </div>

                <div className="text-xs leading-relaxed">{validationResult.message}</div>

                {validationResult.availableModels.length > 0 && (
                  <div className="text-[11px] bg-white/70 p-2 rounded border border-black/10">
                    <span className="font-bold">Accessible Models ({validationResult.availableModels.length}): </span>
                    <span className="font-mono">
                      {validationResult.availableModels
                        .slice(0, 8)
                        .map(m => m.id)
                        .join(', ')}
                      {validationResult.availableModels.length > 8 ? ` (+${validationResult.availableModels.length - 8} more)` : ''}
                    </span>
                  </div>
                )}

                {validationResult.sampleOutput && (
                  <div className="text-[11px] bg-white/80 p-2 rounded border border-emerald-200 font-mono">
                    <strong>Live Generation Output ({validationResult.selectedModel}):</strong> {validationResult.sampleOutput}
                  </div>
                )}

                {validationResult.diagnostic?.suggestedAction && (
                  <div className="text-[11px] bg-white/80 p-2 rounded border border-black/10">
                    <strong>Suggested Action:</strong> {validationResult.diagnostic.suggestedAction}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Priority</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={formPriority}
                  onChange={e => setFormPriority(parseInt(e.target.value) || 10)}
                  className="w-full p-2 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Daily Token Cap</label>
                <input
                  type="number"
                  min={0}
                  value={formDailyTokenLimit}
                  onChange={e => setFormDailyTokenLimit(parseInt(e.target.value) || 0)}
                  className="w-full p-2 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Monthly USD Cap</label>
                <input
                  type="number"
                  min={0}
                  value={formMonthlyBudgetUsd}
                  onChange={e => setFormMonthlyBudgetUsd(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border border-gray-300 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
              <div className="text-[11px] text-gray-500">
                {!validationResult?.generationVerified && !editingId
                  ? 'Tip: Click "Validate & Connect" first to verify live generation before saving.'
                  : 'Credentials are AES-256-GCM encrypted server-side.'}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Encrypting & Saving...' : 'Save Credential'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* CREDENTIAL LOGS MODAL */}
      {logsModalCred && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-xl text-xs max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-gray-900">
                  Connection & Usage Logs — {logsModalCred.label}
                </h3>
                <p className="text-[11px] text-gray-500 font-mono">
                  {logsModalCred.providerType.toUpperCase()} • {logsModalCred.maskedKey}
                </p>
              </div>
              <button type="button" onClick={() => setLogsModalCred(null)} className="text-gray-400 hover:text-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            {logsLoading ? (
              <div className="p-8 text-center text-gray-500">Loading logs...</div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h4 className="font-black text-gray-800 mb-2">Connection & Health Tests ({credLogs.tests.length})</h4>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-gray-50 border-b border-gray-200 font-bold text-gray-600">
                        <tr>
                          <th className="p-2.5">Time</th>
                          <th className="p-2.5">Stage</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5">Latency</th>
                          <th className="p-2.5">Message</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {credLogs.tests.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-4 text-center text-gray-400">
                              No connection tests recorded for this credential.
                            </td>
                          </tr>
                        ) : (
                          credLogs.tests.map(t => (
                            <tr key={t.id}>
                              <td className="p-2.5 font-mono whitespace-nowrap">{new Date(t.timestamp).toLocaleString()}</td>
                              <td className="p-2.5 font-mono">{t.stage}</td>
                              <td className="p-2.5 font-bold">{t.connectionStatus}</td>
                              <td className="p-2.5 font-mono">{t.latencyMs}ms</td>
                              <td className="p-2.5">{t.diagnostic?.diagnosis || t.sampleOutput || 'OK'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h4 className="font-black text-gray-800 mb-2">Inference Usage ({credLogs.usage.length})</h4>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-gray-50 border-b border-gray-200 font-bold text-gray-600">
                        <tr>
                          <th className="p-2.5">Time</th>
                          <th className="p-2.5">Task</th>
                          <th className="p-2.5">Model</th>
                          <th className="p-2.5">Tokens</th>
                          <th className="p-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {credLogs.usage.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-4 text-center text-gray-400">
                              No inference usage recorded yet.
                            </td>
                          </tr>
                        ) : (
                          credLogs.usage.map(u => (
                            <tr key={u.id}>
                              <td className="p-2.5 font-mono whitespace-nowrap">{new Date(u.timestamp).toLocaleString()}</td>
                              <td className="p-2.5">{u.task}</td>
                              <td className="p-2.5 font-mono">{u.model}</td>
                              <td className="p-2.5 font-mono">{u.totalTokens}</td>
                              <td className="p-2.5 font-bold">{u.status}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
