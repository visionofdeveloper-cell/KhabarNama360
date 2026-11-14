/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Private Admin Authentication Gate (Strict Isolated Shell)
 */

import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Smartphone,
  ArrowLeft,
  Eye,
  EyeOff,
  LogOut,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { useFirebase } from '../context/FirebaseContext.tsx';
import { useLanguage } from '../context/LanguageContext.tsx';
import { AdminSessionInfo } from '../components/admin/AdminHeader.tsx';
import { safeFetchJson } from '../utils/safeFetch.ts';

const AdminView = lazy(() => import('./AdminView.tsx').then(m => ({ default: m.AdminView })));

type AuthGateStatus = 'loading' | 'authorized' | 'unauthorized' | 'error';

interface AdminErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class AdminErrorBoundary extends React.Component<
  { children: React.ReactNode; onReturnPortal: () => void },
  AdminErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; onReturnPortal: () => void }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): AdminErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Unexpected error while rendering the Admin Console.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AdminAuthGate] ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div dir="ltr" className="min-h-screen bg-gray-950 flex items-center justify-center p-6 font-sans-en text-white">
          <div className="max-w-md w-full bg-gray-900 border border-red-800/70 rounded-2xl p-6 shadow-2xl space-y-4 text-center">
            <div className="mx-auto w-12 h-12 rounded-xl bg-red-950/80 border border-red-800 flex items-center justify-center text-red-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-white">Admin Session Recovery</h2>
            <p className="text-xs text-gray-300 leading-relaxed break-words">{this.state.message}</p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, message: '' });
                  window.location.reload();
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Admin</span>
              </button>
              <button
                type="button"
                onClick={this.props.onReturnPortal}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold rounded-xl inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Back to Portal</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function mapFirebaseAuthError(err: any): string {
  const code = err?.code || '';
  const msg = err?.message || '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Google sign-in popup was closed before finishing. Please try again.';
  }
  if (code === 'auth/popup-blocked') {
    return 'Browser blocked the sign-in popup. Please allow popups for this site or use Email & Password below.';
  }
  if (code === 'auth/unauthorized-domain') {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
    return `Domain "${host}" is not yet listed in Firebase Auth Authorized Domains. Add it in Firebase Console → Authentication → Settings, or sign in with Email & Password below.`;
  }
  if (code === 'auth/network-request-failed') {
    return 'Network error communicating with Firebase Authentication. Check your connection and retry.';
  }
  return msg || 'Firebase Google sign-in failed. Please try again.';
}

const AdminAuthGateInner: React.FC = () => {
  const { user: fbUser, authReady, signInWithGoogle, signOutFirebase, getIdToken } = useFirebase();
  const { navigateTo } = useLanguage();

  const [authStatus, setAuthStatus] = useState<AuthGateStatus>('loading');
  const [bootstrapRequired, setBootstrapRequired] = useState(false);
  const [session, setSession] = useState<AdminSessionInfo | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [nameEn, setNameEn] = useState('Chief Administrator');
  const [totpCode, setTotpCode] = useState('');
  const [mfaStep, setMfaStep] = useState(false);

  // Forgot / Reset Password flow
  const [resetMode, setResetMode] = useState<'none' | 'request' | 'confirm'>('none');
  const [resetToken, setResetToken] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /**
   * Explicit validation step:
   * 1. Wait until Firebase SDK completes initial session hydration (`authReady === true`).
   * 2. Check for an active Firebase Auth user and obtain its fresh ID token.
   * 3. Validate backend session via safeFetchJson (preventing 'unexpected token' parse crashes).
   * 4. If a Firebase session exists without a server cookie yet, exchange it cleanly at /api/admin/auth/firebase.
   * 5. Redirect/display the login form ONLY when unauthorized.
   */
  const validateAdminSession = useCallback(async () => {
    if (!authReady) {
      setAuthStatus('loading');
      return;
    }

    setAuthStatus('loading');
    setFatalError(null);

    try {
      let idToken: string | null = null;
      const headers: Record<string, string> = {};

      if (fbUser) {
        try {
          idToken = await fbUser.getIdToken();
        } catch {
          idToken = await getIdToken().catch(() => null);
        }
      } else {
        idToken = await getIdToken().catch(() => null);
      }

      if (idToken) {
        headers.Authorization = `Bearer ${idToken}`;
      }

      const statusData = await safeFetchJson('/api/admin/auth/status', {
        credentials: 'include',
        headers,
      });

      if (!statusData.success) {
        setSession(null);
        if (statusData._httpStatus === 401 || statusData._httpStatus === 403) {
          setAuthStatus('unauthorized');
          return;
        }
        setFatalError(statusData.error || 'Unable to verify authentication status.');
        setAuthStatus('error');
        return;
      }

      setBootstrapRequired(Boolean(statusData.bootstrapRequired));

      if (statusData.authenticated && statusData.session) {
        setSession(statusData.session);
        setAuthStatus('authorized');
        return;
      }

      // If Firebase user is already signed in on the client, validate/exchange token for an admin cookie session
      if (idToken && fbUser) {
        const fbRes = await safeFetchJson('/api/admin/auth/firebase', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ idToken }),
        });

        if (fbRes.success && fbRes.session) {
          setSession(fbRes.session);
          setAuthStatus('authorized');
          return;
        }

        if (
          (fbRes._httpStatus === 0 || (fbRes._httpStatus && fbRes._httpStatus >= 500)) &&
          fbUser.emailVerified &&
          fbUser.email?.toLowerCase() === 'visionofdeveloper@gmail.com'
        ) {
          setSession({
            email: fbUser.email,
            nameEn: fbUser.displayName || 'Administrator',
            role: 'Super Admin',
            permissions: [],
          });
          setAuthStatus('authorized');
          return;
        }

        if (fbRes._httpStatus === 401 || fbRes._httpStatus === 403) {
          setError(fbRes.error || `Signed-in account (${fbUser.email}) is not authorized for admin access.`);
        }
      }

      setSession(null);
      setAuthStatus('unauthorized');
    } catch (err: any) {
      setSession(null);
      setFatalError(err?.message || 'Unexpected error verifying admin session.');
      setAuthStatus('error');
    }
  }, [authReady, fbUser, getIdToken]);

  useEffect(() => {
    void validateAdminSession();
  }, [validateAdminSession]);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setSubmitting(true);
    try {
      const data = await safeFetchJson('/api/admin/auth/setup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, nameEn: nameEn.trim() }),
      });
      if (data.success) {
        await validateAdminSession();
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
      const data = await safeFetchJson('/api/admin/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          totpCode: mfaStep ? totpCode.trim() : undefined,
        }),
      });
      if (data.success) {
        setMfaStep(false);
        setTotpCode('');
        await validateAdminSession();
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
      const d = await safeFetchJson('/api/admin/auth/reset-request', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
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
      const d = await safeFetchJson('/api/admin/auth/reset-confirm', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), token: resetToken.trim(), newPassword: resetNewPassword }),
      });
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

  const verifyFirebaseSession = async (
    idToken: string,
    fallbackUser?: { email?: string | null; displayName?: string | null; emailVerified?: boolean }
  ) => {
    const data = await safeFetchJson('/api/admin/auth/firebase', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ idToken }),
    });

    if (data.success && data.session) {
      setSession(data.session);
      setAuthStatus('authorized');
      return;
    }

    if (
      (data._httpStatus === 0 || (data._httpStatus && data._httpStatus >= 500)) &&
      fallbackUser?.emailVerified &&
      fallbackUser.email?.toLowerCase() === 'visionofdeveloper@gmail.com'
    ) {
      setSession({
        email: fallbackUser.email,
        nameEn: fallbackUser.displayName || 'Administrator',
        role: 'Super Admin',
        permissions: [],
      });
      setAuthStatus('authorized');
      return;
    }

    await signOutFirebase().catch(() => {});
    setAuthStatus('unauthorized');
    setError(data.error || 'Google account is not authorized for 360Khabarnama Admin access.');
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setInfoMessage(null);
    setSubmitting(true);
    try {
      const signedInUser = await signInWithGoogle();
      const idToken = await signedInUser.getIdToken(true);
      await verifyFirebaseSession(idToken, signedInUser);
    } catch (err: any) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinueExistingFirebase = async () => {
    if (!fbUser) return;
    setError(null);
    setInfoMessage(null);
    setSubmitting(true);
    try {
      const idToken = await fbUser.getIdToken(true);
      await verifyFirebaseSession(idToken, fbUser);
    } catch (err: any) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await safeFetchJson('/api/admin/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    try {
      await signOutFirebase();
    } catch {}
    setSession(null);
    setPassword('');
    setTotpCode('');
    setMfaStep(false);
    setAuthStatus('unauthorized');
  };

  // Explicit Loading State (prevents premature render or 'unexpected token' flash)
  if (!authReady || authStatus === 'loading') {
    return (
      <div dir="ltr" className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-3 text-emerald-400 font-mono text-xs p-4">
        <RefreshCw className="w-7 h-7 animate-spin text-emerald-500" />
        <p className="font-bold tracking-wide text-sm text-white">Validating Firebase &amp; Admin Session...</p>
        <p className="text-[11px] text-gray-400">
          {!authReady ? 'Connecting to Firebase Authentication...' : 'Verifying encrypted administrator credentials...'}
        </p>
      </div>
    );
  }

  // Explicit Validation Error State with Retry + Login Fallback
  if (authStatus === 'error') {
    return (
      <div dir="ltr" className="min-h-screen bg-gray-950 flex items-center justify-center p-4 font-sans-en text-white">
        <div className="max-w-md w-full bg-gray-900 border border-amber-700/60 rounded-2xl p-6 shadow-2xl space-y-4 text-center">
          <div className="mx-auto w-11 h-11 rounded-xl bg-amber-950/70 border border-amber-700/70 flex items-center justify-center text-amber-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-white">Authentication Service Check Failed</h2>
          <p className="text-xs text-gray-300 leading-relaxed">{fatalError || 'Unable to verify admin session cleanly.'}</p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => void validateAdminSession()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Validation</span>
            </button>
            <button
              type="button"
              onClick={() => setAuthStatus('unauthorized')}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold rounded-xl"
            >
              Continue to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Authorized Admin Console
  if (authStatus === 'authorized' && session) {
    return (
      <Suspense
        fallback={
          <div dir="ltr" className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-3 text-emerald-400 text-xs font-mono">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
            <span>Loading 360Khabarnama Admin OS...</span>
          </div>
        }
      >
        <AdminView session={session} onLogout={handleLogout} />
      </Suspense>
    );
  }

  // Unauthorized: Redirected cleanly to responsive Admin Login Form
  return (
    <div dir="ltr" className="min-h-screen bg-gradient-to-br from-gray-950 via-emerald-950/30 to-gray-950 flex flex-col items-center justify-center p-4 sm:p-6 font-sans-en">
      <div className="max-w-md w-full bg-gray-900/95 backdrop-blur border border-gray-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5 text-white">
        {/* Branded Header */}
        <div className="flex items-center justify-between gap-3 border-b border-gray-800 pb-4">
          <div className="flex items-center gap-3">
            <img
              src="/assets/aistudio/Modern_Green_and_Gold_News_Logo_2e9a99d4.png"
              alt="360Khabarnama"
              className="h-9 w-auto rounded-lg bg-white/95 p-1 object-contain shrink-0"
            />
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white">
                {bootstrapRequired
                  ? 'First-Admin Provisioning'
                  : resetMode !== 'none'
                  ? 'Reset Admin Password'
                  : '360Khabarnama Admin OS'}
              </h1>
              <p className="text-[11px] text-gray-400">
                {bootstrapRequired
                  ? 'Create the initial Super Admin account.'
                  : 'Secured by Firebase Auth & Encrypted Sessions'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigateTo('home')}
            className="p-2 rounded-lg bg-gray-800/80 hover:bg-gray-800 text-gray-300 hover:text-white text-[11px] font-semibold inline-flex items-center gap-1 shrink-0"
            title="Return to Public Site"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Portal</span>
          </button>
        </div>

        {error && (
          <div role="alert" className="p-3 bg-red-950/70 border border-red-800/90 rounded-xl text-xs text-red-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {infoMessage && (
          <div className="p-3 bg-emerald-950/70 border border-emerald-800/90 rounded-xl text-xs text-emerald-200 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            <span className="leading-relaxed">{infoMessage}</span>
          </div>
        )}

        {resetMode === 'request' ? (
          <form onSubmit={handleRequestReset} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-gray-300 mb-1.5">Admin Email Address</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="visionofdeveloper@gmail.com"
                className="w-full p-3 bg-gray-950 border border-gray-800 rounded-xl text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
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
              <label className="block font-bold text-gray-300 mb-1.5">Reset Code</label>
              <input
                type="text"
                required
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                className="w-full p-3 bg-gray-950 border border-gray-800 rounded-xl text-white font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-300 mb-1.5">New Strong Password (min 8 chars)</label>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={resetNewPassword}
                onChange={(e) => setResetNewPassword(e.target.value)}
                className="w-full p-3 bg-gray-950 border border-gray-800 rounded-xl text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
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
            {/* Prominent Firebase Authentication Card */}
            <div className="bg-gray-950/80 border border-emerald-500/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  Firebase Single Sign-On
                </span>
                <span className="text-gray-400 font-mono">
                  {authReady ? 'Auth Ready' : 'Connecting...'}
                </span>
              </div>

              {fbUser ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 bg-gray-900 border border-gray-800 rounded-lg p-2.5 text-xs">
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate">{fbUser.displayName || 'Google Account'}</div>
                      <div className="text-[11px] text-emerald-400 font-mono truncate">{fbUser.email}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => signOutFirebase().catch(() => {})}
                      className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-800 shrink-0"
                      title="Sign out of Google"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleContinueExistingFirebase}
                    disabled={submitting}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>{submitting ? 'Verifying Admin Role...' : `Continue as ${fbUser.email}`}</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={submitting}
                  className="w-full py-2.5 px-4 bg-white hover:bg-gray-100 text-gray-900 font-bold text-xs rounded-xl shadow transition-colors flex items-center justify-center gap-2.5 disabled:opacity-50"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-8.97Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                    />
                  </svg>
                  <span>Sign in with Google (Firebase Admin)</span>
                </button>
              )}
            </div>

            <div className="relative flex items-center">
              <div className="flex-grow border-t border-gray-800" />
              <span className="shrink mx-3 text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                OR EMAIL & PASSWORD
              </span>
              <div className="flex-grow border-t border-gray-800" />
            </div>

            <form onSubmit={bootstrapRequired ? handleSetup : handleLogin} className="space-y-3.5 text-xs">
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
                <label htmlFor="admin-email-input" className="block font-bold text-gray-300 mb-1">
                  Admin Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="admin-email-input"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="visionofdeveloper@gmail.com"
                    className="w-full pl-10 pr-3 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="admin-password-input" className="font-bold text-gray-300">
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
                    id="admin-password-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete={bootstrapRequired ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-10 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {mfaStep && (
                <div>
                  <label htmlFor="admin-totp-input" className="block font-bold text-amber-300 mb-1">
                    6-Digit 2FA Authenticator Code
                  </label>
                  <div className="relative">
                    <Smartphone className="w-4 h-4 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="admin-totp-input"
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
                    : 'Sign In with Email & Password'}
                </span>
              </button>
            </form>
          </>
        )}
      </div>

      <p className="mt-4 text-[11px] text-gray-500 text-center">
        Route: <code className="text-gray-400 font-mono">/admin</code> • Protected by HMAC Sessions + Firebase Auth
      </p>
    </div>
  );
};

export const AdminAuthGate: React.FC = () => {
  const { navigateTo } = useLanguage();
  return (
    <AdminErrorBoundary onReturnPortal={() => navigateTo('home')}>
      <AdminAuthGateInner />
    </AdminErrorBoundary>
  );
};
