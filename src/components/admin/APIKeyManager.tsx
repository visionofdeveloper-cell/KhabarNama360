/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — AI Provider Keys, Project Isolation & Task Routing Manager
 */

import React, { useEffect, useState } from 'react';
import {
  KeyRound,
  Plus,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  ShieldAlert,
  Sliders,
  Activity,
  Power,
  X,
} from 'lucide-react';
import { AIProviderCredential, AIProviderType, AITaskRouting, AIUsageLog } from '../../types/index.ts';
import { safeFetchJson } from '../../utils/safeFetch.ts';

interface APIKeyManagerProps {
  onNotify?: (msg: string) => void;
}

const GEMINI_FREE_TIER_MODELS = [
  { id: 'gemini-2.5-flash', label: 'gemini-2.5-flash (Free API Key Recommended)' },
  { id: 'gemini-2.5-flash-lite', label: 'gemini-2.5-flash-lite (Free Tier High Quota)' },
  { id: 'gemini-2.0-flash', label: 'gemini-2.0-flash (Free Tier Fast)' },
  { id: 'gemini-2.0-flash-lite', label: 'gemini-2.0-flash-lite (Free Tier Ultra-Light)' },
  { id: 'gemini-1.5-flash', label: 'gemini-1.5-flash (Legacy Free Key)' },
  { id: 'gemini-3.1-flash-lite', label: 'gemini-3.1-flash-lite (Free Preview)' },
];

const GEMINI_PRO_MODELS = [
  { id: 'gemini-4-hydrogen', label: 'gemini-4-hydrogen (Gemini 4 Fast)' },
  { id: 'gemini-4-argon', label: 'gemini-4-argon (Gemini 4 Balanced)' },
  { id: 'gemini-4-carbon', label: 'gemini-4-carbon (Gemini 4 Flagship)' },
];

const MODEL_OPTIONS: Record<string, string[]> = {
  gemini: [...GEMINI_FREE_TIER_MODELS.map(m => m.id), ...GEMINI_PRO_MODELS.map(m => m.id)],
  grok: ['grok-3', 'grok-3-mini', 'grok-3-fast'],
  custom: ['gpt-4o-mini', 'llama-3.3-70b', 'custom-model'],
  custom_data: ['gpt-4o-mini', 'llama-3.3-70b', 'custom-model'],
};

export const APIKeyManager: React.FC<APIKeyManagerProps> = ({ onNotify }) => {
  const [subTab, setSubTab] = useState<'credentials' | 'routing' | 'usage'>('credentials');
  const [credentials, setCredentials] = useState<AIProviderCredential[]>([]);
  const [routes, setRoutes] = useState<AITaskRouting[]>([]);
  const [usageSummary, setUsageSummary] = useState<{
    totalRequests: number;
    requests24h: number;
    tokens24h: number;
    totalCostUsd: number;
    errorRatePercent: number;
    logs: AIUsageLog[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<{ ok: boolean; text: string } | null>(null);

  // Add / Replace Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formProviderType, setFormProviderType] = useState<AIProviderType>('gemini');
  const [formKeyTier, setFormKeyTier] = useState<'free' | 'paid'>('free');
  const [formCustomModelMode, setFormCustomModelMode] = useState(false);
  const [formLabel, setFormLabel] = useState('');
  const [formProjectId, setFormProjectId] = useState('');
  const [formEndpointUrl, setFormEndpointUrl] = useState('');
  const [formModel, setFormModel] = useState('gemini-2.5-flash');
  const [formApiKey, setFormApiKey] = useState('');
  const [formPriority, setFormPriority] = useState(10);
  const [formDailyTokenLimit, setFormDailyTokenLimit] = useState(250000);
  const [formMonthlyBudgetUsd, setFormMonthlyBudgetUsd] = useState(0);
  const [saving, setSaving] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [provRes, routeRes, useRes] = await Promise.all([
        safeFetchJson('/api/admin/ai/providers', { credentials: 'include' }),
        safeFetchJson('/api/admin/ai/routing', { credentials: 'include' }),
        safeFetchJson('/api/admin/ai/usage', { credentials: 'include' }),
      ]);
      if (provRes.success) setCredentials(provRes.providers || []);
      if (routeRes.success) setRoutes(routeRes.routes || []);
      if (useRes.success) setUsageSummary(useRes.usage || null);
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
  }, []);

  const applyTierPreset = (tier: 'free' | 'paid', providerType: AIProviderType = formProviderType) => {
    setFormKeyTier(tier);
    if (tier === 'free') {
      setFormMonthlyBudgetUsd(0);
      setFormDailyTokenLimit(250000);
      if (providerType === 'gemini') {
        if (!formProjectId.trim()) setFormProjectId(`aistudio-free-${Math.floor(100 + Math.random() * 900)}`);
        if (!formLabel.trim()) setFormLabel('Google AI Studio Free Key');
        setFormModel('gemini-2.5-flash');
        setFormCustomModelMode(false);
      }
    } else {
      setFormMonthlyBudgetUsd(25);
      setFormDailyTokenLimit(500000);
      if (providerType === 'gemini') {
        setFormModel('gemini-4-hydrogen');
        setFormCustomModelMode(false);
      }
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormProviderType('gemini');
    setFormKeyTier('free');
    setFormCustomModelMode(false);
    setFormLabel('Google AI Studio Free Key');
    setFormProjectId(`aistudio-free-${Math.floor(100 + Math.random() * 900)}`);
    setFormEndpointUrl('');
    setFormModel('gemini-2.5-flash');
    setFormApiKey('');
    setFormPriority(10);
    setFormDailyTokenLimit(250000);
    setFormMonthlyBudgetUsd(0);
    setModalOpen(true);
  };

  const openEditModal = (cred: AIProviderCredential) => {
    setEditingId(cred.id);
    setFormProviderType(cred.providerType);
    setFormKeyTier(cred.monthlyBudgetUsd === 0 ? 'free' : 'paid');
    const knownModels = MODEL_OPTIONS[cred.providerType] || [];
    setFormCustomModelMode(!knownModels.includes(cred.model));
    setFormLabel(cred.label);
    setFormProjectId(cred.projectId);
    setFormEndpointUrl(cred.endpointUrl || '');
    setFormModel(cred.model);
    setFormApiKey('');
    setFormPriority(cred.priority);
    setFormDailyTokenLimit(cred.dailyTokenLimit);
    setFormMonthlyBudgetUsd(cred.monthlyBudgetUsd);
    setModalOpen(true);
  };

  const handleSaveCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusBanner(null);
    try {
      const d = await safeFetchJson('/api/admin/ai/providers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId || undefined,
          providerType: formProviderType,
          label: formLabel,
          projectId: formProjectId.trim() || (formKeyTier === 'free' ? 'aistudio-free-tier' : 'default-project'),
          endpointUrl: formEndpointUrl || undefined,
          model: formModel,
          apiKey: formApiKey || undefined,
          priority: formPriority,
          dailyTokenLimit: formDailyTokenLimit,
          monthlyBudgetUsd: formMonthlyBudgetUsd,
        }),
      });
      if (d.success) {
        setModalOpen(false);
        setStatusBanner({ ok: true, text: 'AI credential saved securely (AES-256-GCM encrypted at rest).' });
        onNotify?.('AI credential saved.');
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
      const d = await safeFetchJson(`/api/admin/ai/providers/${id}/test`, {
        method: 'POST',
        credentials: 'include',
      });
      setStatusBanner({
        ok: Boolean(d.result?.ok),
        text: d.result?.message || d.error || 'Connection test completed.',
      });
      loadAll();
    } catch (e: any) {
      setStatusBanner({ ok: false, text: e?.message || 'Test request failed.' });
    } finally {
      setTestingId(null);
    }
  };

  const handleToggleEnabled = async (cred: AIProviderCredential) => {
    const d = await safeFetchJson('/api/admin/ai/providers', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: cred.id,
        providerType: cred.providerType,
        label: cred.label,
        projectId: cred.projectId,
        model: cred.model,
        enabled: !cred.enabled,
      }),
    });
    if (d.success) loadAll();
    else if (d.error) setStatusBanner({ ok: false, text: d.error });
  };

  const handleDelete = async (id: string) => {
    const d = await safeFetchJson(`/api/admin/ai/providers/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (d.success) {
      setStatusBanner({ ok: true, text: 'AI API key revoked and removed.' });
      loadAll();
    } else if (d.error) {
      setStatusBanner({ ok: false, text: d.error });
    }
  };

  const handleSaveRoute = async (route: AITaskRouting) => {
    const d = await safeFetchJson('/api/admin/ai/routing', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(route),
    });
    if (d.success) {
      setStatusBanner({ ok: true, text: `Updated routing for "${route.label}".` });
      loadAll();
    } else {
      setStatusBanner({ ok: false, text: d.error || 'Failed updating route.' });
    }
  };

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-emerald-700" />
            <span>AI Provider Keys, Task Routing & Usage Budgets</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Keys are AES-256-GCM encrypted on the server and never exposed unmasked to browser code. Fallback occurs only across distinct Project IDs or providers.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add AI API Key</span>
        </button>
      </div>

      {/* Policy Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-950 flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <strong>Single-Project Quota Isolation Enforced:</strong> Assigning multiple API keys to the same Project ID is tracked explicitly and the router never rotates keys inside the same project to bypass provider rate limits. Use a distinct GCP Project ID or secondary provider (e.g., xAI Grok) for failover.
        </div>
      </div>

      {statusBanner && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
            statusBanner.ok
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusBanner.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{statusBanner.text}</span>
          </div>
          <button onClick={() => setStatusBanner(null)} className="text-gray-500 hover:text-gray-900">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Sub-navigation */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
        {[
          { id: 'credentials', label: `API Credentials (${credentials.length})`, icon: KeyRound },
          { id: 'routing', label: `Task Routing (${routes.length})`, icon: Sliders },
          { id: 'usage', label: 'Usage & Token Ledger', icon: Activity },
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

      {/* CREDENTIALS TAB */}
      {subTab === 'credentials' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-xs text-gray-500">Loading encrypted provider vault...</div>
          ) : credentials.length === 0 ? (
            <div className="p-10 text-center space-y-2 text-xs text-gray-500">
              <p className="font-bold text-gray-800">No AI API keys configured yet.</p>
              <p>Add a Google Gemini key, xAI Grok key, or custom OpenAI-compatible key above to activate News Composer AI and AI Content Studio.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold">
                  <tr>
                    <th className="p-3">Provider & Label</th>
                    <th className="p-3">Project ID</th>
                    <th className="p-3">Masked Key</th>
                    <th className="p-3">Model</th>
                    <th className="p-3">Daily Tokens / Budget</th>
                    <th className="p-3">Test Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {credentials.map(cred => {
                    const isEnv = cred.id.startsWith('env-');
                    return (
                      <tr key={cred.id} className="hover:bg-gray-50">
                        <td className="p-3">
                          <div className="font-bold text-gray-900 flex items-center gap-1.5">
                            <span>{cred.label}</span>
                            {cred.monthlyBudgetUsd === 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-extrabold uppercase">
                                FREE TIER
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-500 uppercase font-mono">{cred.providerType}</div>
                        </td>
                        <td className="p-3 font-mono text-[11px] text-gray-700">{cred.projectId}</td>
                        <td className="p-3 font-mono text-[11px] text-gray-700">{cred.maskedKey}</td>
                        <td className="p-3 font-mono text-[11px] text-emerald-800">{cred.model}</td>
                        <td className="p-3 font-mono tabular-nums text-[11px] text-gray-700">
                          <div>{(cred.dailyTokensUsed || 0).toLocaleString()} / {(cred.dailyTokenLimit || 0).toLocaleString()} tok</div>
                          <div className="text-gray-500">
                            {cred.monthlyBudgetUsd === 0
                              ? 'Free Tier ($0.00 cap)'
                              : `$${(cred.monthlySpendUsd || 0).toFixed(4)} / $${cred.monthlyBudgetUsd}`}
                          </div>
                        </td>
                        <td className="p-3 text-[11px]">
                          <span
                            className={`inline-block px-2 py-0.5 rounded font-semibold ${
                              cred.lastTestStatus === 'connected'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : cred.lastTestStatus === 'error'
                                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {cred.lastTestStatus || 'untested'}
                          </span>
                          {cred.lastTestMessage && (
                            <div className="text-[10px] text-gray-500 max-w-[180px] truncate mt-0.5" title={cred.lastTestMessage}>
                              {cred.lastTestMessage}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleTest(cred.id)}
                            disabled={testingId === cred.id}
                            className="px-2.5 py-1 bg-gray-100 hover:bg-emerald-700 hover:text-white text-gray-800 font-bold rounded text-[11px] inline-flex items-center gap-1"
                          >
                            <RefreshCw className={`w-3 h-3 ${testingId === cred.id ? 'animate-spin' : ''}`} />
                            <span>Test</span>
                          </button>
                          {!isEnv && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleToggleEnabled(cred)}
                                title={cred.enabled ? 'Disable' : 'Enable'}
                                className={`px-2 py-1 rounded text-[11px] font-bold inline-flex items-center gap-1 ${
                                  cred.enabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500'
                                }`}
                              >
                                <Power className="w-3 h-3" />
                                <span>{cred.enabled ? 'Active' : 'Disabled'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditModal(cred)}
                                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded text-[11px]"
                              >
                                Edit/Replace
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

      {/* TASK ROUTING TAB */}
      {subTab === 'routing' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-100 text-xs text-gray-600">
            Configure primary and fallback credentials/models for each editorial and reader task.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 border-b border-gray-200 font-bold text-gray-600">
                <tr>
                  <th className="p-3">Task</th>
                  <th className="p-3">Primary Credential</th>
                  <th className="p-3">Primary Model</th>
                  <th className="p-3">Fallback Credential (Different Project)</th>
                  <th className="p-3">Temp</th>
                  <th className="p-3 text-right">Save</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {routes.map((r, idx) => (
                  <tr key={r.task} className="hover:bg-gray-50">
                    <td className="p-3">
                      <div className="font-bold text-gray-900">{r.label}</div>
                      <div className="font-mono text-[10px] text-gray-500">{r.task}</div>
                    </td>
                    <td className="p-3">
                      <select
                        value={r.primaryCredentialId}
                        onChange={e => {
                          const next = [...routes];
                          next[idx] = { ...r, primaryCredentialId: e.target.value };
                          setRoutes(next);
                        }}
                        className="p-1.5 border border-gray-300 rounded text-xs bg-white max-w-[200px]"
                      >
                        <option value="">-- Auto Select Active --</option>
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
                        list="routing-model-options"
                        value={r.primaryModel}
                        onChange={e => {
                          const next = [...routes];
                          next[idx] = { ...r, primaryModel: e.target.value };
                          setRoutes(next);
                        }}
                        className="p-1.5 border border-gray-300 rounded font-mono text-xs w-44"
                      />
                    </td>
                    <td className="p-3">
                      <select
                        value={r.fallbackCredentialId || ''}
                        onChange={e => {
                          const next = [...routes];
                          next[idx] = { ...r, fallbackCredentialId: e.target.value };
                          setRoutes(next);
                        }}
                        className="p-1.5 border border-gray-300 rounded text-xs bg-white max-w-[200px]"
                      >
                        <option value="">None</option>
                        {credentials.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.label} ({c.projectId})
                          </option>
                        ))}
                      </select>
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
                        className="p-1.5 border border-gray-300 rounded font-mono text-xs w-16"
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
                ))}
              </tbody>
            </table>
          </div>
          <datalist id="routing-model-options">
            {MODEL_OPTIONS.gemini.map(m => <option key={m} value={m} />)}
            {MODEL_OPTIONS.grok.map(m => <option key={m} value={m} />)}
          </datalist>
        </div>
      )}

      {/* USAGE LOGS TAB */}
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
                          {l.errorMessage && <div className="text-[10px] text-rose-600 mt-0.5 max-w-[200px] truncate">{l.errorMessage}</div>}
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

      {/* ADD / EDIT CREDENTIAL MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveCredential}
            className="bg-white border border-gray-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl text-xs"
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-black text-gray-900">
                {editingId ? 'Edit / Replace AI API Key' : 'Add AI Provider API Key'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Provider</label>
                <select
                  value={formProviderType}
                  onChange={e => {
                    const pt = e.target.value as AIProviderType;
                    setFormProviderType(pt);
                    setFormCustomModelMode(false);
                    setFormModel(pt === 'gemini' && formKeyTier === 'free' ? 'gemini-2.5-flash' : MODEL_OPTIONS[pt][0]);
                  }}
                  className="w-full p-2.5 border border-gray-300 rounded-lg bg-white"
                >
                  <option value="gemini">Google Gemini (@google/genai)</option>
                  <option value="grok">xAI Grok API</option>
                  <option value="custom">Custom OpenAI-Compatible Endpoint</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Label</label>
                <input
                  type="text"
                  required
                  value={formLabel}
                  onChange={e => setFormLabel(e.target.value)}
                  placeholder="Google AI Studio Free Key"
                  className="w-full p-2.5 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            {formProviderType === 'gemini' && (
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-emerald-950">Gemini Key Tier</span>
                  <div className="inline-flex rounded-lg bg-white border border-emerald-200 p-0.5">
                    <button
                      type="button"
                      onClick={() => applyTierPreset('free', 'gemini')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                        formKeyTier === 'free' ? 'bg-emerald-700 text-white' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Free API Key
                    </button>
                    <button
                      type="button"
                      onClick={() => applyTierPreset('paid', 'gemini')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                        formKeyTier === 'paid' ? 'bg-emerald-700 text-white' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Paid Billing Project
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-emerald-900 leading-relaxed">
                  {formKeyTier === 'free'
                    ? 'Works with free Google AI Studio keys (aistudio.google.com/apikey). Uses Free-Tier compatible Flash models with $0 spend cap.'
                    : 'Paid GCP billing project mode supports higher RPM/TPM limits and Pro/Gemini-4 models.'}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  GCP / Project ID {formKeyTier === 'free' && <span className="text-[10px] font-normal text-gray-500">(any unique tag)</span>}
                </label>
                <input
                  type="text"
                  required
                  value={formProjectId}
                  onChange={e => setFormProjectId(e.target.value)}
                  placeholder={formKeyTier === 'free' ? 'aistudio-free-01' : 'gen-lang-client-0094029776'}
                  className="w-full p-2.5 border border-gray-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Default Model</label>
                {formProviderType === 'gemini' && !formCustomModelMode ? (
                  <select
                    value={MODEL_OPTIONS.gemini.includes(formModel) ? formModel : '__custom__'}
                    onChange={e => {
                      if (e.target.value === '__custom__') {
                        setFormCustomModelMode(true);
                      } else {
                        setFormModel(e.target.value);
                      }
                    }}
                    className="w-full p-2.5 border border-gray-300 rounded-lg font-mono bg-white"
                  >
                    <optgroup label="Free API Key Compatible Models">
                      {GEMINI_FREE_TIER_MODELS.map(m => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Standard & Gemini 4 Models">
                      {GEMINI_PRO_MODELS.map(m => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </optgroup>
                    <option value="__custom__">+ Enter Custom Model ID...</option>
                  </select>
                ) : (
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      list="ai-model-suggestions"
                      required
                      value={formModel}
                      onChange={e => setFormModel(e.target.value)}
                      placeholder="gemini-2.5-flash"
                      className="w-full p-2.5 border border-gray-300 rounded-lg font-mono"
                    />
                    {formProviderType === 'gemini' && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormCustomModelMode(false);
                          if (!MODEL_OPTIONS.gemini.includes(formModel)) setFormModel('gemini-2.5-flash');
                        }}
                        className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-[11px] font-bold text-gray-700 shrink-0"
                      >
                        List
                      </button>
                    )}
                  </div>
                )}
                <datalist id="ai-model-suggestions">
                  {MODEL_OPTIONS[formProviderType].map(m => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
            </div>

            {formProviderType !== 'gemini' && (
              <div>
                <label className="block font-bold text-gray-700 mb-1">Chat Completions Endpoint URL</label>
                <input
                  type="url"
                  value={formEndpointUrl}
                  onChange={e => setFormEndpointUrl(e.target.value)}
                  placeholder="https://api.x.ai/v1/chat/completions"
                  className="w-full p-2.5 border border-gray-300 rounded-lg font-mono"
                />
              </div>
            )}

            <div>
              <label className="block font-bold text-gray-700 mb-1">
                {editingId ? 'Replace API Key (leave blank to keep existing encrypted key)' : 'API Secret Key'}
              </label>
              <input
                type="password"
                required={!editingId}
                value={formApiKey}
                onChange={e => setFormApiKey(e.target.value)}
                placeholder="AIza... or xai-..."
                className="w-full p-2.5 border border-gray-300 rounded-lg font-mono"
              />
            </div>

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

            <div className="pt-2 border-t border-gray-100 flex justify-end gap-2">
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
          </form>
        </div>
      )}
    </div>
  );
};
