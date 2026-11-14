/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Private Admin Authentication, Session & 9-Role RBAC Security Middleware
 */

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { db } from './db.ts';
import { adminAuth } from '../lib/firebase-admin.ts';
import { AdminPermission, UserRole } from '../types/index.ts';
import { encryptSecret, decryptSecret, generateTotpSecret, verifyTotpToken } from './crypto.ts';

const BOOTSTRAPPED_ADMIN_EMAIL = 'visionofdeveloper@gmail.com';

export interface AdminSession {
  sessionId: string;
  userId: string;
  email: string;
  nameEn: string;
  role: UserRole;
  permissions: AdminPermission[];
  mfaVerified: boolean;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  expiresAt: number;
}

export interface AdminCredentialRecord {
  userId: string;
  email: string;
  passwordHash: string; // scrypt: salt:hash
  mfaEnabled: boolean;
  mfaSecretEnc?: string;
  mfaSecret?: string; // backwards compat
  resetTokenHash?: string;
  resetTokenExpiresAt?: number;
  failedAttempts: number;
  lockedUntil?: number;
  lastLoginAt?: string;
  passwordUpdatedAt?: string;
}

const ALL_PERMISSIONS: AdminPermission[] = [
  'overview:view',
  'reports:view',
  'articles:read',
  'articles:write',
  'articles:publish',
  'articles:delete',
  'categories:manage',
  'homepage:manage',
  'media:manage',
  'seo:manage',
  'ads:manage',
  'automation:manage',
  'ai:use',
  'ai:keys',
  'audience:manage',
  'users:manage',
  'settings:manage',
  'health:view',
];

export const OFFICIAL_ADMIN_ROLES: UserRole[] = [
  'Super Admin',
  'Administrator',
  'Managing Editor',
  'Editor',
  'SEO Manager',
  'Automation Manager',
  'Advertising Manager',
  'Content Contributor',
  'Read-only Analyst',
];

export const ROLE_PERMISSIONS: Record<string, AdminPermission[]> = {
  'Super Admin': ALL_PERMISSIONS,
  'Administrator': ALL_PERMISSIONS.filter(p => p !== 'ai:keys' ? true : true),
  'Managing Editor': [
    'overview:view', 'reports:view', 'articles:read', 'articles:write', 'articles:publish', 'articles:delete',
    'categories:manage', 'homepage:manage', 'media:manage', 'seo:manage', 'ai:use', 'audience:manage',
  ],
  'Editor': [
    'overview:view', 'reports:view', 'articles:read', 'articles:write', 'articles:publish',
    'categories:manage', 'media:manage', 'ai:use',
  ],
  'SEO Manager': [
    'overview:view', 'reports:view', 'articles:read', 'seo:manage', 'categories:manage', 'media:manage', 'ai:use',
  ],
  'SEO Specialist': [
    'overview:view', 'reports:view', 'articles:read', 'seo:manage', 'categories:manage', 'media:manage', 'ai:use',
  ],
  'Automation Manager': [
    'overview:view', 'reports:view', 'automation:manage', 'articles:read', 'ai:use', 'health:view',
  ],
  'Advertising Manager': [
    'overview:view', 'reports:view', 'ads:manage', 'media:manage', 'homepage:manage',
  ],
  'Content Contributor': [
    'overview:view', 'articles:read', 'articles:write', 'media:manage', 'ai:use',
  ],
  'Reporter': [
    'overview:view', 'articles:read', 'articles:write', 'media:manage', 'ai:use',
  ],
  'Read-only Analyst': [
    'overview:view', 'reports:view', 'articles:read', 'health:view',
  ],
  'Viewer': [
    'overview:view', 'reports:view', 'articles:read',
  ],
};

export function normalizeRole(role?: string): UserRole {
  if (!role) return 'Read-only Analyst';
  if (role === 'Reporter') return 'Content Contributor';
  if (role === 'SEO Specialist') return 'SEO Manager';
  if (role === 'Viewer') return 'Read-only Analyst';
  return role as UserRole;
}

export function getPermissionsForRole(role?: string): AdminPermission[] {
  if (!role) return ROLE_PERMISSIONS['Read-only Analyst'];
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS[normalizeRole(role)] || ROLE_PERMISSIONS['Read-only Analyst'];
}

export function hasPermission(role: string | undefined, permission: AdminPermission): boolean {
  if (role === 'Super Admin') return true;
  return getPermissionsForRole(role).includes(permission);
}

const SESSION_COOKIE_NAME = 'kn360_admin_sid';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET ||
  process.env.SESSION_SECRET ||
  crypto.createHash('sha256').update(`360khabarnama:${process.env.GEMINI_API_KEY || 'kn360-default-secret'}`).digest('hex');

const activeSessions = new Map<string, AdminSession>();
const revokedSessions = new Set<string>();

function signSessionPayload(session: AdminSession): string {
  const payload = Buffer.from(JSON.stringify(session), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifySignedSessionToken(token: string): AdminSession | null {
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;
  const payload = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  if (!payload || !sig) return null;

  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AdminSession;
    if (!parsed || !parsed.sessionId || Date.now() > parsed.expiresAt || revokedSessions.has(parsed.sessionId)) {
      return null;
    }
    if (!parsed.permissions) {
      parsed.permissions = getPermissionsForRole(parsed.role);
    }
    return parsed;
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export function parseCookies(req: Request): Record<string, string> {
  const list: Record<string, string> = {};
  const rc = req.headers.cookie;
  if (!rc) return list;

  rc.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const key = parts.shift()?.trim();
    if (key) {
      list[key] = decodeURIComponent(parts.join('='));
    }
  });
  return list;
}

export function isBootstrapRequired(): boolean {
  const creds = db.getAdminCredentialsMap();
  return Object.keys(creds).length === 0;
}

export function provisionFirstAdmin(
  email: string,
  password: string,
  nameEn: string = 'Chief Administrator'
): { success: boolean; error?: string } {
  if (!isBootstrapRequired()) {
    return { success: false, error: 'Initial admin account has already been provisioned.' };
  }
  if (!email || !email.includes('@') || password.length < 8) {
    return { success: false, error: 'Valid email and password (minimum 8 characters) are required.' };
  }

  const cleanEmail = email.trim().toLowerCase();
  const userId = `usr-admin-${Date.now()}`;
  const passwordHash = hashPassword(password);

  db.setAdminCredential(cleanEmail, {
    userId,
    email: cleanEmail,
    passwordHash,
    mfaEnabled: false,
    failedAttempts: 0,
    passwordUpdatedAt: new Date().toISOString(),
  });

  const existingUsers = db.getAdminUsers();
  if (!existingUsers.some(u => u.email.toLowerCase() === cleanEmail)) {
    db.upsertAdminUser({
      id: userId,
      nameEn,
      nameUr: 'چیف ایڈمنسٹریٹر',
      email: cleanEmail,
      role: 'Super Admin',
      status: 'active',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      articlesCount: 0,
      createdAt: new Date().toISOString(),
    }, 'System Bootstrap');
  }

  db.logAudit('System Bootstrap', 'First Super Admin Provisioned', `Provisioned initial admin account: ${cleanEmail}`);
  return { success: true };
}

export function setStaffPasswordCredential(
  email: string,
  newPassword: string,
  userId?: string,
  actor: string = 'Super Admin'
): { success: boolean; error?: string } {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail.includes('@') || !newPassword || newPassword.length < 8) {
    return { success: false, error: 'Valid email and password (min 8 chars) required.' };
  }
  const creds = db.getAdminCredentialsMap();
  const existing = creds[cleanEmail];
  db.setAdminCredential(cleanEmail, {
    ...(existing || {}),
    userId: existing?.userId || userId || `usr-${Date.now()}`,
    email: cleanEmail,
    passwordHash: hashPassword(newPassword),
    mfaEnabled: existing?.mfaEnabled || false,
    failedAttempts: 0,
    lockedUntil: undefined,
    passwordUpdatedAt: new Date().toISOString(),
  });
  db.logAudit(actor, 'Staff Password Set', `Updated login credentials for ${cleanEmail}`);
  return { success: true };
}

export function authenticateAdmin(
  email: string,
  password: string,
  ipAddress: string,
  userAgent: string,
  totpCode?: string
): { success: boolean; session?: AdminSession; mfaRequired?: boolean; error?: string } {
  const cleanEmail = email.trim().toLowerCase();
  const creds = db.getAdminCredentialsMap();
  const cred: AdminCredentialRecord | undefined = creds[cleanEmail];

  if (!cred) {
    db.logAudit(cleanEmail || 'Unknown', 'Failed Admin Login', `Attempted login for unprovisioned account from IP ${ipAddress}`);
    return { success: false, error: 'Invalid credentials.' };
  }

  const staffUser = db.getAdminUsers().find(u => u.email.toLowerCase() === cleanEmail);
  if (staffUser && staffUser.status === 'suspended') {
    db.logAudit(cleanEmail, 'Blocked Login (Suspended)', `Suspended account attempted login from IP ${ipAddress}`);
    return { success: false, error: 'This administrator account is currently suspended.' };
  }

  if (cred.lockedUntil && Date.now() < cred.lockedUntil) {
    const minsLeft = Math.ceil((cred.lockedUntil - Date.now()) / 60000);
    db.logAudit(cleanEmail, 'Blocked Login (Throttled)', `Account locked for ${minsLeft}m from IP ${ipAddress}`);
    return { success: false, error: `Too many failed attempts. Try again in ${minsLeft} minutes.` };
  }

  if (!verifyPassword(password, cred.passwordHash)) {
    cred.failedAttempts = (cred.failedAttempts || 0) + 1;
    if (cred.failedAttempts >= MAX_LOGIN_ATTEMPTS) {
      cred.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
      db.logAudit(cleanEmail, 'Account Locked', `Exceeded ${MAX_LOGIN_ATTEMPTS} failed login attempts from IP ${ipAddress}`);
    } else {
      db.logAudit(cleanEmail, 'Failed Admin Login', `Invalid password attempt (${cred.failedAttempts}/${MAX_LOGIN_ATTEMPTS}) from IP ${ipAddress}`);
    }
    db.setAdminCredential(cleanEmail, cred);
    return { success: false, error: 'Invalid credentials.' };
  }

  // Verify TOTP MFA if enabled
  if (cred.mfaEnabled) {
    const secret = cred.mfaSecretEnc ? decryptSecret(cred.mfaSecretEnc) : cred.mfaSecret || '';
    if (!totpCode) {
      return { success: false, mfaRequired: true, error: 'Enter the 6-digit authenticator verification code.' };
    }
    if (!verifyTotpToken(secret, totpCode)) {
      db.logAudit(cleanEmail, 'MFA Verification Failed', `Invalid 2FA code from IP ${ipAddress}`);
      return { success: false, mfaRequired: true, error: 'Invalid authenticator code.' };
    }
  }

  cred.failedAttempts = 0;
  cred.lockedUntil = undefined;
  cred.lastLoginAt = new Date().toISOString();
  db.setAdminCredential(cleanEmail, cred);

  const assignedRole = normalizeRole(staffUser?.role || 'Super Admin');
  const sessionId = crypto.randomBytes(32).toString('hex');
  const session: AdminSession = {
    sessionId,
    userId: cred.userId,
    email: cleanEmail,
    nameEn: staffUser?.nameEn || 'Administrator',
    role: assignedRole,
    permissions: getPermissionsForRole(assignedRole),
    mfaVerified: true,
    ipAddress,
    userAgent,
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  };

  activeSessions.set(sessionId, session);
  db.logAudit(cleanEmail, 'Admin Login Success', `Authenticated session (${assignedRole}) from IP ${ipAddress}`);

  return { success: true, session, mfaRequired: false };
}

export function changeAdminPassword(
  email: string,
  currentPassword: string,
  newPassword: string
): { success: boolean; error?: string } {
  const cleanEmail = email.trim().toLowerCase();
  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: 'New password must be at least 8 characters.' };
  }
  const cred: AdminCredentialRecord | undefined = db.getAdminCredentialsMap()[cleanEmail];
  if (cred) {
    if (!verifyPassword(currentPassword, cred.passwordHash)) {
      return { success: false, error: 'Current password is incorrect.' };
    }
    cred.passwordHash = hashPassword(newPassword);
    cred.passwordUpdatedAt = new Date().toISOString();
    db.setAdminCredential(cleanEmail, cred);
    db.logAudit(cleanEmail, 'Password Changed', 'Administrator updated account password');
    return { success: true };
  }
  // If user signed in via Google SSO originally and sets a local password for the first time
  const staffUser = db.getAdminUsers().find(u => u.email.toLowerCase() === cleanEmail);
  if (!staffUser && cleanEmail !== BOOTSTRAPPED_ADMIN_EMAIL) {
    return { success: false, error: 'Account not found.' };
  }
  db.setAdminCredential(cleanEmail, {
    userId: staffUser?.id || `usr-${Date.now()}`,
    email: cleanEmail,
    passwordHash: hashPassword(newPassword),
    mfaEnabled: false,
    failedAttempts: 0,
    passwordUpdatedAt: new Date().toISOString(),
  });
  db.logAudit(cleanEmail, 'Local Password Set', 'Created local password for admin login');
  return { success: true };
}

export function initiateMfaSetup(email: string): { success: boolean; secret?: string; otpauthUrl?: string; error?: string } {
  const cleanEmail = email.trim().toLowerCase();
  const cred: AdminCredentialRecord | undefined = db.getAdminCredentialsMap()[cleanEmail];
  const staffUser = db.getAdminUsers().find(u => u.email.toLowerCase() === cleanEmail);
  if (!cred && !staffUser && cleanEmail !== BOOTSTRAPPED_ADMIN_EMAIL) {
    return { success: false, error: 'Account not found.' };
  }
  const secret = generateTotpSecret();
  const updated: AdminCredentialRecord = {
    ...(cred || {
      userId: staffUser?.id || `usr-${Date.now()}`,
      email: cleanEmail,
      passwordHash: '',
      mfaEnabled: false,
      failedAttempts: 0,
    }),
    mfaSecretEnc: encryptSecret(secret),
  };
  db.setAdminCredential(cleanEmail, updated);
  const issuer = encodeURIComponent('360Khabarnama Admin');
  const label = encodeURIComponent(cleanEmail);
  const otpauthUrl = `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}`;
  return { success: true, secret, otpauthUrl };
}

export function enableMfaWithToken(email: string, code: string): { success: boolean; error?: string } {
  const cleanEmail = email.trim().toLowerCase();
  const cred: AdminCredentialRecord | undefined = db.getAdminCredentialsMap()[cleanEmail];
  if (!cred?.mfaSecretEnc) {
    return { success: false, error: 'MFA setup has not been initiated yet.' };
  }
  const secret = decryptSecret(cred.mfaSecretEnc);
  if (!verifyTotpToken(secret, code)) {
    return { success: false, error: 'Verification code does not match authenticator.' };
  }
  cred.mfaEnabled = true;
  db.setAdminCredential(cleanEmail, cred);
  db.logAudit(cleanEmail, 'MFA Enabled', 'Enabled Two-Factor TOTP authentication');
  return { success: true };
}

export function disableMfa(email: string): { success: boolean } {
  const cleanEmail = email.trim().toLowerCase();
  const cred: AdminCredentialRecord | undefined = db.getAdminCredentialsMap()[cleanEmail];
  if (cred) {
    cred.mfaEnabled = false;
    delete cred.mfaSecretEnc;
    db.setAdminCredential(cleanEmail, cred);
    db.logAudit(cleanEmail, 'MFA Disabled', 'Disabled Two-Factor TOTP authentication');
  }
  return { success: true };
}

export function requestPasswordReset(email: string): { success: boolean; resetCode?: string; message: string } {
  const cleanEmail = email.trim().toLowerCase();
  const cred: AdminCredentialRecord | undefined = db.getAdminCredentialsMap()[cleanEmail];
  if (!cred) {
    return { success: true, message: 'If the account exists, reset instructions have been logged for verification.' };
  }
  const rawToken = crypto.randomBytes(12).toString('hex');
  cred.resetTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  cred.resetTokenExpiresAt = Date.now() + 30 * 60 * 1000;
  db.setAdminCredential(cleanEmail, cred);
  db.logAudit(cleanEmail, 'Password Reset Requested', 'Issued single-use 30m password reset code (server-side)');
  return {
    success: true,
    message: 'A password reset code has been issued. Contact your Super Admin / server console or complete reset below.',
  };
}

export function confirmPasswordReset(email: string, token: string, newPassword: string): { success: boolean; error?: string } {
  const cleanEmail = email.trim().toLowerCase();
  const cred: AdminCredentialRecord | undefined = db.getAdminCredentialsMap()[cleanEmail];
  if (!cred || !cred.resetTokenHash || !cred.resetTokenExpiresAt || Date.now() > cred.resetTokenExpiresAt) {
    return { success: false, error: 'Reset token is invalid or expired.' };
  }
  const hash = crypto.createHash('sha256').update((token || '').trim()).digest('hex');
  if (hash !== cred.resetTokenHash) {
    return { success: false, error: 'Reset token mismatch.' };
  }
  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: 'New password must be at least 8 characters.' };
  }
  cred.passwordHash = hashPassword(newPassword);
  delete cred.resetTokenHash;
  delete cred.resetTokenExpiresAt;
  cred.failedAttempts = 0;
  cred.lockedUntil = undefined;
  cred.passwordUpdatedAt = new Date().toISOString();
  db.setAdminCredential(cleanEmail, cred);
  db.logAudit(cleanEmail, 'Password Reset Completed', 'Password reset confirmed via single-use token');
  return { success: true };
}

export function getSessionFromRequest(req: Request): AdminSession | null {
  const cookies = parseCookies(req);
  const rawToken = cookies[SESSION_COOKIE_NAME];
  if (!rawToken) return null;

  const signedSession = verifySignedSessionToken(rawToken);
  if (signedSession) {
    // Re-hydrate latest role/permissions from DB staff record
    const staffUser = db.getAdminUsers().find(u => u.email.toLowerCase() === signedSession.email.toLowerCase());
    if (staffUser?.status === 'suspended') return null;
    if (staffUser?.role) {
      signedSession.role = normalizeRole(staffUser.role);
      signedSession.permissions = getPermissionsForRole(signedSession.role);
    }
    return signedSession;
  }

  const session = activeSessions.get(rawToken);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(rawToken);
    return null;
  }
  return session;
}

export function setSessionCookie(res: Response, sessionIdOrObj: string | AdminSession) {
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  const sessionObj = typeof sessionIdOrObj === 'string' ? activeSessions.get(sessionIdOrObj) : sessionIdOrObj;
  const cookieVal = sessionObj ? signSessionPayload(sessionObj) : String(sessionIdOrObj);
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(cookieVal)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${isProd ? '; Secure' : ''}`
  );
}

export function clearSessionCookie(res: Response) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export function revokeSession(sessionId: string, actor: string = 'Admin') {
  revokedSessions.add(sessionId);
  const sess = activeSessions.get(sessionId);
  if (sess) {
    activeSessions.delete(sessionId);
    db.logAudit(actor, 'Session Revoked', `Revoked admin session for ${sess.email}`);
    return true;
  }
  return true;
}

export function listActiveSessions(): AdminSession[] {
  const now = Date.now();
  const list: AdminSession[] = [];
  for (const [id, sess] of activeSessions.entries()) {
    if (now > sess.expiresAt) activeSessions.delete(id);
    else list.push(sess);
  }
  return list;
}

export async function authenticateAdminWithFirebase(
  idToken: string,
  ipAddress: string,
  userAgent: string
): Promise<{ success: boolean; session?: AdminSession; error?: string }> {
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const email = (decoded.email || '').trim().toLowerCase();
    if (!email || !decoded.email_verified) {
      return { success: false, error: 'Verified Google email is required for admin access.' };
    }

    const staffUser = db.getAdminUsers().find((u) => u.email.toLowerCase() === email);
    const isAuthorized = email === BOOTSTRAPPED_ADMIN_EMAIL || (staffUser && staffUser.status === 'active');

    if (!isAuthorized) {
      db.logAudit(email, 'Blocked Firebase Admin Login', `Unauthorized Google sign-in attempt from IP ${ipAddress}`);
      return { success: false, error: 'This Google account is not authorized for 360Khabarnama Admin.' };
    }

    const assignedRole = normalizeRole(staffUser?.role || 'Super Admin');
    const sessionId = crypto.randomBytes(32).toString('hex');
    const session: AdminSession = {
      sessionId,
      userId: decoded.uid,
      email,
      nameEn: staffUser?.nameEn || decoded.name || 'Administrator',
      role: assignedRole,
      permissions: getPermissionsForRole(assignedRole),
      mfaVerified: true,
      ipAddress,
      userAgent,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + SESSION_TTL_MS,
    };

    activeSessions.set(sessionId, session);
    db.logAudit(email, 'Admin Firebase Login Success', `Authenticated Google session (${assignedRole}) from IP ${ipAddress}`);
    return { success: true, session };
  } catch (err) {
    console.error('[Auth] Firebase ID token verification failed:', err);
    return { success: false, error: 'Invalid or expired Firebase ID token.' };
  }
}

export async function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  if (req.path.startsWith('/auth/')) {
    return next();
  }

  const session = getSessionFromRequest(req);
  if (session) {
    (req as any).adminSession = session;
    return next();
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      const email = (decoded.email || '').trim().toLowerCase();
      const staffUser = db.getAdminUsers().find((u) => u.email.toLowerCase() === email);
      if (decoded.email_verified && (email === BOOTSTRAPPED_ADMIN_EMAIL || (staffUser && staffUser.status === 'active'))) {
        const assignedRole = normalizeRole(staffUser?.role || 'Super Admin');
        (req as any).adminSession = {
          sessionId: `fb-${decoded.uid}`,
          userId: decoded.uid,
          email,
          nameEn: staffUser?.nameEn || decoded.name || 'Administrator',
          role: assignedRole,
          permissions: getPermissionsForRole(assignedRole),
          mfaVerified: true,
          ipAddress: req.ip || '127.0.0.1',
          userAgent: req.headers['user-agent'] || 'Unknown',
          createdAt: new Date().toISOString(),
          expiresAt: Date.now() + SESSION_TTL_MS,
        };
        return next();
      }
    } catch {}
  }

  return res.status(401).json({
    success: false,
    error: 'Authentication required. Please sign in to 360Khabarnama Admin.',
  });
}

export function requirePermission(permission: AdminPermission) {
  return (req: Request, res: Response, next: NextFunction) => {
    const session: AdminSession | undefined = (req as any).adminSession;
    if (!session) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }
    if (!hasPermission(session.role, permission)) {
      db.logAudit(session.email, 'Forbidden Action Blocked', `Role "${session.role}" lacks permission "${permission}" for ${req.method} ${req.originalUrl}`);
      return res.status(403).json({
        success: false,
        error: `Access denied: your role (${session.role}) does not have "${permission}" permission.`,
      });
    }
    return next();
  };
}
