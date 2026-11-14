import React, { useState } from 'react';
import {
  ShieldCheck,
  Search,
  Bell,
  LogOut,
  KeyRound,
  Lock,
  Smartphone,
  ExternalLink,
  Menu,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { safeFetchJson } from '../../utils/safeFetch.ts';

export interface AdminSessionInfo {
  email: string;
  nameEn: string;
  role: string;
  permissions: string[];
  mfaEnabled?: boolean;
  expiresAt?: number;
}

interface AdminHeaderProps {
  session: AdminSessionInfo;
  activeModuleLabel: string;
  globalSearch: string;
  onGlobalSearchChange: (val: string) => void;
  notifications: { id: string; title: string; detail: string; time: string }[];
  onToggleMobileNav: () => void;
  onLogout: () => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  session,
  activeModuleLabel,
  globalSearch,
  onGlobalSearchChange,
  notifications,
  onToggleMobileNav,
  onLogout,
}) => {
  const [notifOpen, setNotifOpen] = useState(false);
  const [securityModalOpen, setSecurityModalOpen] = useState(false);

  // Change password states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwStatus, setPwStatus] = useState<{ ok?: boolean; msg: string } | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  // TOTP 2FA states
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaUri, setMfaUri] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaMsg, setMfaMsg] = useState<{ ok?: boolean; msg: string } | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwSaving(true);
    setPwStatus(null);
    try {
      const d = await safeFetchJson('/api/admin/auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (d.success) {
        setPwStatus({ ok: true, msg: 'Password updated securely.' });
        setCurrentPassword('');
        setNewPassword('');
      } else {
        setPwStatus({ ok: false, msg: d.error || 'Failed to update password.' });
      }
    } catch {
      setPwStatus({ ok: false, msg: 'Network error updating password.' });
    } finally {
      setPwSaving(false);
    }
  };

  const handleInitiateMfa = async () => {
    setMfaMsg(null);
    const d = await safeFetchJson('/api/admin/auth/mfa/setup', {
      method: 'POST',
      credentials: 'include',
    });
    if (d.success) {
      setMfaSecret(d.secret);
      setMfaUri(d.otpauthUrl);
    } else {
      setMfaMsg({ ok: false, msg: d.error || 'Unable to initiate 2FA setup.' });
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setMfaMsg(null);
    const d = await safeFetchJson('/api/admin/auth/mfa/verify', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: mfaCode }),
    });
    if (d.success) {
      setMfaMsg({ ok: true, msg: '2FA Authenticator enabled for your account.' });
      setMfaSecret('');
      setMfaUri('');
      setMfaCode('');
    } else {
      setMfaMsg({ ok: false, msg: d.error || 'Invalid 6-digit code.' });
    }
  };

  const handleDisableMfa = async () => {
    const d = await safeFetchJson('/api/admin/auth/mfa/disable', {
      method: 'POST',
      credentials: 'include',
    });
    if (d.success) {
      setMfaMsg({ ok: true, msg: '2FA Authenticator disabled.' });
    } else if (d.error) {
      setMfaMsg({ ok: false, msg: d.error });
    }
  };

  return (
    <>
      <header className="h-14 bg-white border-b border-gray-200 px-4 lg:px-6 flex items-center justify-between gap-3 sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onToggleMobileNav}
            className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            aria-label="Toggle admin sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-gray-900 truncate">{activeModuleLabel}</span>
              <span className="hidden sm:inline-block text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                Private OS
              </span>
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center flex-1 max-w-md mx-4">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => onGlobalSearchChange(e.target.value)}
              placeholder="Search articles, categories, SEO routes..."
              className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 focus:bg-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/en"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 whitespace-nowrap"
          >
            <ExternalLink className="w-3.5 h-3.5 text-emerald-700" />
            <span>Public Site</span>
          </a>

          <div className="relative">
            <button
              type="button"
              onClick={() => setNotifOpen(!notifOpen)}
              className="relative p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              title="System & Audit Activity"
            >
              <Bell className="w-4 h-4" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-700 text-white text-[9px] font-mono font-bold rounded-full flex items-center justify-center">
                  {Math.min(notifications.length, 9)}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-50 space-y-2">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <span className="text-xs font-bold text-gray-900">Recent Admin & System Events</span>
                  <button onClick={() => setNotifOpen(false)} className="text-gray-400 hover:text-gray-700">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                  {notifications.length === 0 ? (
                    <div className="py-6 text-center text-xs text-gray-400">No recent activity alerts.</div>
                  ) : (
                    notifications.slice(0, 8).map((n) => (
                      <div key={n.id} className="py-2 text-xs">
                        <div className="font-semibold text-gray-900">{n.title}</div>
                        <div className="text-gray-500 text-[11px] line-clamp-2">{n.detail}</div>
                        <div className="text-gray-400 text-[10px] font-mono mt-0.5">{n.time}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSecurityModalOpen(true)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-left"
            title="Account & MFA Security"
          >
            <div className="w-6 h-6 rounded-md bg-emerald-800 text-white flex items-center justify-center text-[11px] font-bold">
              {(session.nameEn || session.email || 'A').charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:block leading-tight">
              <div className="text-xs font-bold text-gray-900 max-w-[140px] truncate">{session.email}</div>
              <div className="text-[10px] font-semibold text-emerald-700">{session.role}</div>
            </div>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Account Password & 2FA Security Modal */}
      {securityModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" dir="ltr">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-700" />
                <div>
                  <h3 className="text-sm font-black text-gray-900">Account Security & 2FA</h3>
                  <p className="text-[11px] text-gray-500">
                    {session.email} — Role: <strong>{session.role}</strong>
                  </p>
                </div>
              </div>
              <button onClick={() => setSecurityModalOpen(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-3 text-xs border-b border-gray-100 pb-5">
              <h4 className="font-bold text-gray-900 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-emerald-700" />
                <span>Update Local Admin Password</span>
              </h4>
              {pwStatus && (
                <div
                  className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                    pwStatus.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {pwStatus.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{pwStatus.msg}</span>
                </div>
              )}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Current Password (if already set)</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">New Strong Password (min 8 chars)</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>
              <button
                type="submit"
                disabled={pwSaving}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg disabled:opacity-50"
              >
                {pwSaving ? 'Saving...' : 'Save Password'}
              </button>
            </form>

            <div className="space-y-3 text-xs">
              <h4 className="font-bold text-gray-900 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
                <span>Two-Factor Authentication (TOTP Authenticator App)</span>
              </h4>
              {mfaMsg && (
                <div
                  className={`p-2.5 rounded-lg border ${
                    mfaMsg.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {mfaMsg.msg}
                </div>
              )}
              {!mfaSecret ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleInitiateMfa}
                    className="px-3.5 py-2 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-lg inline-flex items-center gap-1.5"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Generate Authenticator Secret</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDisableMfa}
                    className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg"
                  >
                    Disable 2FA
                  </button>
                </div>
              ) : (
                <form onSubmit={handleVerifyMfa} className="space-y-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
                  <div className="text-[11px] text-gray-700">
                    Add this Base32 key in Google Authenticator / Authy / 1Password:
                  </div>
                  <div className="p-2 bg-white border border-gray-200 rounded font-mono text-xs font-bold select-all">
                    {mfaSecret}
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono break-all">URI: {mfaUri}</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value)}
                      placeholder="6-digit code"
                      className="flex-1 p-2 border border-gray-300 rounded-lg font-mono"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg"
                    >
                      Verify & Enable
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
