/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Khabarnama360 — Private Admin Authentication Gate
 */

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { ShieldCheck, Lock, Mail, KeyRound, AlertCircle, CheckCircle2, LogOut } from 'lucide-react';

const AdminView = lazy(() => import('./AdminView.tsx').then(m => ({ default: m.AdminView })));

export const AdminAuthGate: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [bootstrapRequired, setBootstrapRequired] = useState(false);
  const [session, setSession] = useState<any>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nameEn, setNameEn] = useState('Chief Administrator');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const checkAuthStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/auth/status');
      const data = await res.json();
      if (data.success) {
        setAuthenticated(data.authenticated);
        setBootstrapRequired(data.bootstrapRequired);
        setSession(data.session);
      }
    } catch {
      setError('Unable to reach authentication service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, nameEn }),
      });
      const data = await res.json();
      if (data.success) {
        await checkAuthStatus();
      } else {
        setError(data.error || 'Provisioning failed.');
      }
    } catch {
      setError('Network error during setup.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        await checkAuthStatus();
      } else {
        setError(data.error || 'Invalid credentials.');
      }
    } catch {
      setError('Network error during login.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    setAuthenticated(false);
    setSession(null);
    setPassword('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-emerald-400 font-mono text-xs">
        Verifying Khabarnama360 Admin Session...
      </div>
    );
  }

  if (authenticated) {
    return (
      <div className="relative">
        <div className="bg-gray-900 border-b border-gray-800 px-4 py-1.5 flex items-center justify-between text-[11px] text-gray-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              Authenticated as <strong className="text-white">{session?.email}</strong> ({session?.role})
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-red-400 hover:text-red-300 font-bold"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
        <Suspense
          fallback={
            <div className="min-h-screen bg-gray-950 flex items-center justify-center text-emerald-400 text-xs font-mono">
              Loading Admin OS...
            </div>
          }
        >
          <AdminView />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 font-sans-en">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-3xl p-8 shadow-2xl space-y-6 text-white">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-600/20 border border-emerald-500/30 rounded-2xl text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight">
              {bootstrapRequired ? 'First-Admin Provisioning' : 'Khabarnama360 Private Admin'}
            </h1>
            <p className="text-xs text-gray-400">
              {bootstrapRequired
                ? 'Create the initial Super Admin account to secure this portal.'
                : 'Authorized personnel only. All login activity is audited.'}
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={bootstrapRequired ? handleSetup : handleLogin} className="space-y-4 text-xs">
          {bootstrapRequired && (
            <div>
              <label className="block font-bold text-gray-300 mb-1">Administrator Name</label>
              <input
                type="text"
                required
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                className="w-full p-3 bg-gray-950 border border-gray-800 rounded-xl text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block font-bold text-gray-300 mb-1">Verified Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@khabarnama360.com"
                className="w-full pl-10 pr-3 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-gray-300 mb-1">
              {bootstrapRequired ? 'Set Strong Password (min 8 chars)' : 'Password'}
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-3 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Lock className="w-4 h-4" />
            <span>
              {submitting
                ? 'Authenticating...'
                : bootstrapRequired
                ? 'Provision Super Admin & Sign In'
                : 'Sign In to Admin OS'}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};
