/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Google Integrations Diagnostics, Persistence & Audit Log Viewer
 */

import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  RefreshCw,
  Server,
  ShieldCheck,
} from 'lucide-react';
import { GoogleIntegrationLogEntry } from '../../../types/index.ts';

interface Props {
  diagnostics: any;
  logs: GoogleIntegrationLogEntry[];
  loading?: boolean;
  onRefresh: () => void;
}

export const GoogleIntegrationDiagnostics: React.FC<Props> = ({
  diagnostics,
  logs,
  loading,
  onRefresh,
}) => {
  if (!diagnostics) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-xs text-gray-500">
        Loading diagnostics...
      </div>
    );
  }

  const persistence = diagnostics.persistence || {};
  const runtime = diagnostics.runtime || {};

  return (
    <div className="space-y-5 text-xs">
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div>
            <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-700" />
              <span>Integration Health, Runtime &amp; Persistence Diagnostics</span>
            </h3>
            <p className="text-gray-500 mt-0.5">
              Live status across GA4, GTM, Search Console, Supabase persistence, and Consent Mode v2 (secrets never shown).
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={onRefresh}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Diagnostics</span>
          </button>
        </div>

        {/* Migration 008 / Persistence Warning if missing tables or Supabase not configured */}
        {(persistence.migration008Required || !persistence.supabaseConfigured) && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 text-amber-950">
            <div className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>
                {!persistence.supabaseConfigured
                  ? 'Supabase PostgreSQL Not Configured in Current Runtime'
                  : 'Supabase Migration 008 Required for Google Integrations'}
              </span>
            </div>
            <div className="text-[11px] leading-relaxed">
              {persistence.error ? (
                <span>{persistence.error}</span>
              ) : (
                <span>
                  Missing tables: <code>{(persistence.missingTables || []).join(', ')}</code>. Run{' '}
                  <code>{persistence.recommendedMigrationFile}</code> in Supabase SQL Editor and reload PostgREST schema.
                </span>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-1.5">
            <div className="font-bold text-gray-600 uppercase text-[10px]">Persistence Engine</div>
            <div className="font-black text-gray-900 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-emerald-700" />
              <span>
                {persistence.supabaseConfigured
                  ? `Supabase PostgreSQL (${persistence.hydratedFrom || 'hydrated'})`
                  : 'Local JSON (Development Preview)'}
              </span>
            </div>
            <div className="text-[11px] text-gray-500">
              Runtime: {runtime.label || runtime.shortName || 'Node.js'} • App v{diagnostics.appVersion || '1.0.0'}
            </div>
          </div>

          <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-1.5">
            <div className="font-bold text-gray-600 uppercase text-[10px]">Consent Mode &amp; Single-Tag Guard</div>
            <div className="font-black text-gray-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>
                {diagnostics.ga4?.consentModeEnabled ? 'Consent Mode v2 Active' : 'Consent Mode Default Off'}
              </span>
            </div>
            <div className="text-[11px] text-gray-500">
              Effective mode: <code>{diagnostics.ga4?.effectiveRuntimeMode}</code> • Admin excluded:{' '}
              {diagnostics.ga4?.excludeAdmin ? 'Yes' : 'No'}
            </div>
          </div>

          <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-1.5">
            <div className="font-bold text-gray-600 uppercase text-[10px]">Search Console Credentials</div>
            <div className="font-black text-gray-900 flex items-center gap-1.5">
              {diagnostics.gsc?.diagnosticStatus === 'Authorized' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              )}
              <span>{diagnostics.gsc?.diagnosticStatus || 'Disconnected'}</span>
            </div>
            <div className="text-[11px] text-gray-500">
              OAuth Secret: {diagnostics.gsc?.hasClientSecret ? 'Encrypted' : 'No'} • Refresh Token:{' '}
              {diagnostics.gsc?.hasRefreshToken ? 'Encrypted' : 'No'} • SA:{' '}
              {diagnostics.gsc?.hasServiceAccountJson ? 'Encrypted' : 'No'}
            </div>
          </div>
        </div>
      </div>

      {/* Integration Logs */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h4 className="font-black text-gray-900">Google Integration Activity &amp; Verification Log</h4>
            <p className="text-[11px] text-gray-500">Recent saves, OAuth exchanges, syncs, verification tests &amp; removals</p>
          </div>
          <span className="font-mono text-[11px] text-gray-500">{logs.length} entries</span>
        </div>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold sticky top-0">
              <tr>
                <th className="p-3">Time</th>
                <th className="p-3">Integration</th>
                <th className="p-3">Action</th>
                <th className="p-3">Status</th>
                <th className="p-3">Message</th>
                <th className="p-3">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-500">
                    No Google integration events logged yet.
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="p-3 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3 font-mono font-bold uppercase text-[11px] text-gray-800">
                      {log.integration}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-gray-700">{log.action}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          log.status === 'ok'
                            ? 'bg-emerald-50 text-emerald-700'
                            : log.status === 'warning'
                            ? 'bg-amber-50 text-amber-800'
                            : log.status === 'error'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="p-3 text-gray-700">{log.message}</td>
                    <td className="p-3 font-mono text-[11px] text-gray-500">{log.actor}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
