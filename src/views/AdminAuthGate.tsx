/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Private Admin Authentication Gate (Strict Isolated Shell)
 */

import React, { useState, useEffect, Suspense, lazy } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Smartphone,
  ArrowLeft,
} from 'lucide-react';
import { useFirebase } from '../context/FirebaseContext.tsx';
import { AdminSessionInfo } from '../components/admin/AdminHeader.tsx';

const AdminView = lazy(() => import('./AdminView.tsx').then(m => ({ default: m.AdminView })));

export const AdminAuthGate: React.FC = () => {
  const { signInWithGoogle, signOutFirebase } = useFirebase();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [bootstrapRequired, setBootstrapRequired] = useState(false);
  const [session, setSession] = useState<AdminSessionInfo | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nameEn, setNameEn] = useState('Chief Administrator');
  const [totpCode, setTotpCode] = useState('');
  const [mfaStep, setMfaStep] = useState(false);

  // Forgot / Reset Password flow
  const [resetMode, setResetMode] = useState<'none' | 'request' | 'confirm'>('none');
  const [resetToken, setResetToken] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const checkAuthStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/auth/status', { credentials: 'include' });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        setError('Backend authentication endpoint is unavailable on this host. Use Google Sign-In below.');
        return;
      }
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
        credentials: 'include',
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
    setInfoMessage(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, totpCode: mfaStep ? totpCode : undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setMfaStep(false);
        setTotpCode('');
        await checkAuthStatus();
      } else if (data.mfaRequired) {
        setMfaStep(true);
        setError(data.error || 'Enter your 6-digit authenticator verification code.');
      } else {
        setError(data.error || 'Invalid credentials.');
      }
    } catch {
      setError('Network error during login.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/auth/reset-request', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const d = await res.json();
      if (d.success) {
        setInfoMessage(d.message);
        setResetMode('confirm');
      } else {
        setError(d.error || 'Unable to request reset.');
      }
    } catch {
      setError('Network error.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/auth/reset-confirm', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token: resetToken, newPassword: resetNewPassword }),
      });
      const d = await res.json();
      if (d.success) {
        setResetMode('none');
        setResetToken('');
        setResetNewPassword('');
        setInfoMessage('Password updated successfully. You may sign in now.');
      } else {
        setError(d.error || 'Password reset failed.');
      }
    } catch {
      setError('Network error.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const fbUser = await signInWithGoogle();
      const idToken = await fbUser.getIdToken();
      const res = await fetch('/api/admin/auth/firebase', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ idToken }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        if (fbUser.emailVerified && fbUser.email?.toLowerCase() === 'visionofdeveloper@gmail.com') {
          setAuthenticated(true);
          setSession({
            email: fbUser.email,
            nameEn: fbUser.displayName || 'Administrator',
            role: 'Super Admin',
            permissions: [],
          });
          return;
        }
        await signOutFirebase();
        setError('Google account is not authorized for admin access.');
        return;
      }
      const data = await res.json();
      if (data.success) {
        await checkAuthStatus();
      } else {
        await signOutFirebase();
        setError(data.error || 'Google account is not authorized for admin access.');
      }
    } catch (err: any) {
      setError(err?.message || 'Google sign-in failed or was cancelled.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    try {
      await signOutFirebase();
    } catch {}
    setAuthenticated(false);
    setSession(null);
    setPassword('');
    setTotpCode('');
    setMfaStep(false);
  };

  if (loading) {
    return (
      <div dir="ltr" className="min-h-screen bg-gray-950 flex items-center justify-center text-emerald-400 font-mono text-xs">
        Verifying 360Khabarnama Private Admin Session...
      </div>
    );
  }

  if (authenticated && session) {
    return (
      <Suspense
        fallback={
          <div dir="ltr" className="min-h-screen bg-gray-950 flex items-center justify-center text-emerald-400 text-xs font-mono">
            Loading 360Khabarnama Admin OS...
          </div>
        }
      >
        <AdminView session={session} onLogout={handleLogout} />
      </Suspense>
    );
  }

  return (
    <div dir="ltr" className="min-h-screen bg-gray-950 flex items-center justify-center p-4 font-sans-en">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl space-y-6 text-white">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-600/20 border border-emerald-500/30 rounded-xl text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight">
              {bootstrapRequired
                ? 'First-Admin Provisioning'
                : resetMode !== 'none'
                ? 'Reset Admin Password'
                : '360Khabarnama Private Admin'}
            </h1>
            <p className="text-xs text-gray-400">
              {bootstrapRequired
                ? 'Create the initial Super Admin account to secure this portal.'
                : 'Private access only. Public navigation is excluded from this workspace.'}
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {infoMessage && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{infoMessage}</span>
          </div>
        )}

        {resetMode === 'request' ? (
          <form onSubmit={handleRequestReset} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-gray-300 mb-1">Admin Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="visionofdeveloper@gmail.com"
                className="w-full p-3 bg-gray-950 border border-gray-800 rounded-xl text-white"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl"
            >
              {submitting ? 'Generating Code...' : 'Request Reset Code'}
            </button>
            <button
              type="button"
              onClick={() => setResetMode('none')}
              className="w-full py-2 text-gray-400 hover:text-white flex items-center justify-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </button>
          </form>
        ) : resetMode === 'confirm' ? (
          <form onSubmit={handleConfirmReset} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-gray-300 mb-1">Reset Code</label>
              <input
                type="text"
                required
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                className="w-full p-3 bg-gray-950 border border-gray-800 rounded-xl text-white font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-300 mb-1">New Strong Password (min 8 chars)</label>
              <input
                type="password"
                required
                minLength={8}
                value={resetNewPassword}
                onChange={(e) => setResetNewPassword(e.target.value)}
                className="w-full p-3 bg-gray-950 border border-gray-800 rounded-xl text-white"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl"
            >
              Confirm Password Reset
            </button>
            <button
              type="button"
              onClick={() => setResetMode('none')}
              className="w-full py-2 text-gray-400 hover:text-white"
            >
              Cancel
            </button>
          </form>
        ) : (
          <>
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
                    placeholder="admin@360khabarnama.com"
                    className="w-full pl-10 pr-3 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-gray-300">
                    {bootstrapRequired ? 'Set Strong Password (min 8 chars)' : 'Password'}
                  </label>
                  {!bootstrapRequired && (
                    <button
                      type="button"
                      onClick={() => setResetMode('request')}
                      className="text-[11px] text-emerald-400 hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
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

              {mfaStep && (
                <div>
                  <label className="block font-bold text-amber-300 mb-1">6-Digit 2FA Authenticator Code</label>
                  <div className="relative">
                    <Smartphone className="w-4 h-4 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value)}
                      placeholder="123456"
                      className="w-full pl-10 pr-3 py-3 bg-gray-950 border border-amber-500/60 rounded-xl text-white font-mono tracking-widest focus:outline-none"
                    />
                  </div>
                </div>
              )}

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
                    : mfaStep
                    ? 'Verify 2FA & Sign In'
                    : 'Sign In to Admin OS'}
                </span>
              </button>
            </form>

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-gray-800" />
              <span className="shrink mx-3 text-[11px] uppercase tracking-wider text-gray-500 font-bold">OR</span>
              <div className="flex-grow border-t border-gray-800" />
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={submitting}
              className="w-full py-3 bg-white hover:bg-gray-100 text-gray-900 font-bold text-xs rounded-xl shadow transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Sign in with Google (Authorized Admin)</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
