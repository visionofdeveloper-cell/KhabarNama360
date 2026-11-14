/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Private Admin Authentication, Session & RBAC Security Middleware
 */

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { db } from './db.ts';
import { adminAuth } from '../lib/firebase-admin.ts';

const BOOTSTRAPPED_ADMIN_EMAIL = 'visionofdeveloper@gmail.com';

export interface AdminSession {
  sessionId: string;
  userId: string;
  email: string;
  nameEn: string;
  role: string;
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
  mfaSecret?: string;
  failedAttempts: number;
  lockedUntil?: number;
  lastLoginAt?: string;
}

const SESSION_COOKIE_NAME = 'kn360_admin_sid';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET ||
  process.env.SESSION_SECRET ||
  crypto.createHash('sha256').update(`360khabarnama:${process.env.GEMINI_API_KEY || 'kn360-default-secret'}`).digest('hex');

// In-memory session & credential stores (persisted via db or dedicated secure store)
const activeSessions = new Map<string, AdminSession>();
const revokedSessions = new Set<string>();
const adminCredentials = new Map<string, AdminCredentialRecord>();

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
    return parsed;
  } catch {
    return null;
  }
}

// Hash password using Node crypto.scryptSync with random 16-byte salt
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

// Parse cookies from request header without external cookie-parser dependency
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
  return adminCredentials.size === 0;
}

export function provisionFirstAdmin(email: string, password: string, nameEn: string = 'Chief Administrator'): { success: boolean; error?: string } {
  if (!isBootstrapRequired()) {
    return { success: false, error: 'Initial admin account has already been provisioned.' };
  }
  if (!email || !email.includes('@') || password.length < 8) {
    return { success: false, error: 'Valid email and password (minimum 8 characters) are required.' };
  }

  const cleanEmail = email.trim().toLowerCase();
  const userId = `usr-admin-${Date.now()}`;
  const passwordHash = hashPassword(password);

  adminCredentials.set(cleanEmail, {
    userId,
    email: cleanEmail,
    passwordHash,
    mfaEnabled: false,
    failedAttempts: 0,
  });

  // Also ensure user exists in db.adminUsers
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

export function authenticateAdmin(
  email: string,
  password: string,
  ipAddress: string,
  userAgent: string
): { success: boolean; session?: AdminSession; mfaRequired?: boolean; error?: string } {
  const cleanEmail = email.trim().toLowerCase();
  const cred = adminCredentials.get(cleanEmail);

  if (!cred) {
    db.logAudit(cleanEmail || 'Unknown', 'Failed Admin Login', `Attempted login for non-existent/unprovisioned account from IP ${ipAddress}`);
    return { success: false, error: 'Invalid credentials.' };
  }

  // Check throttling / lockout
  if (cred.lockedUntil && Date.now() < cred.lockedUntil) {
    const minsLeft = Math.ceil((cred.lockedUntil - Date.now()) / 60000);
    db.logAudit(cleanEmail, 'Blocked Login (Throttled)', `Account locked for ${minsLeft}m due to repeated failed attempts from ${ipAddress}`);
    return { success: false, error: `Too many failed attempts. Try again in ${minsLeft} minutes.` };
  }

  if (!verifyPassword(password, cred.passwordHash)) {
    cred.failedAttempts += 1;
    if (cred.failedAttempts >= MAX_LOGIN_ATTEMPTS) {
      cred.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
      db.logAudit(cleanEmail, 'Account Locked', `Exceeded ${MAX_LOGIN_ATTEMPTS} failed login attempts from IP ${ipAddress}`);
    } else {
      db.logAudit(cleanEmail, 'Failed Admin Login', `Invalid password attempt (${cred.failedAttempts}/${MAX_LOGIN_ATTEMPTS}) from IP ${ipAddress}`);
    }
    return { success: false, error: 'Invalid credentials.' };
  }

  // Reset failed attempts on success
  cred.failedAttempts = 0;
  cred.lockedUntil = undefined;
  cred.lastLoginAt = new Date().toISOString();

  const staffUser = db.getAdminUsers().find(u => u.email.toLowerCase() === cleanEmail);
  const sessionId = crypto.randomBytes(32).toString('hex');
  const session: AdminSession = {
    sessionId,
    userId: cred.userId,
    email: cleanEmail,
    nameEn: staffUser?.nameEn || 'Administrator',
    role: staffUser?.role || 'Super Admin',
    mfaVerified: !cred.mfaEnabled,
    ipAddress,
    userAgent,
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  };

  activeSessions.set(sessionId, session);
  db.logAudit(cleanEmail, 'Admin Login Success', `Authenticated session ${sessionId.slice(0, 8)}... from IP ${ipAddress}`);

  return { success: true, session, mfaRequired: cred.mfaEnabled };
}

export function getSessionFromRequest(req: Request): AdminSession | null {
  const cookies = parseCookies(req);
  const rawToken = cookies[SESSION_COOKIE_NAME];
  if (!rawToken) return null;

  const signedSession = verifySignedSessionToken(rawToken);
  if (signedSession) {
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
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

export function revokeSession(sessionId: string, actor: string = 'Admin') {
  revokedSessions.add(sessionId);
  const sess = activeSessions.get(sessionId);
  if (sess) {
    activeSessions.delete(sessionId);
    db.logAudit(actor, 'Session Revoked', `Revoked admin session for ${sess.email}`);
    return true;
  }
  return false;
}

export function listActiveSessions(): AdminSession[] {
  const now = Date.now();
  const list: AdminSession[] = [];
  for (const [id, sess] of activeSessions.entries()) {
    if (now > sess.expiresAt) {
      activeSessions.delete(id);
    } else {
      list.push(sess);
    }
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

    const sessionId = crypto.randomBytes(32).toString('hex');
    const session: AdminSession = {
      sessionId,
      userId: decoded.uid,
      email,
      nameEn: staffUser?.nameEn || decoded.name || 'Administrator',
      role: staffUser?.role || 'Super Admin',
      mfaVerified: true,
      ipAddress,
      userAgent,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + SESSION_TTL_MS,
    };

    activeSessions.set(sessionId, session);
    db.logAudit(email, 'Admin Firebase Login Success', `Authenticated Google session ${sessionId.slice(0, 8)}... from IP ${ipAddress}`);

    return { success: true, session };
  } catch (err) {
    console.error('[Auth] Firebase ID token verification failed:', err);
    return { success: false, error: 'Invalid or expired Firebase ID token.' };
  }
}

// Express middleware to protect all /api/admin/* endpoints
export async function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  // Allow auth endpoints without existing session
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
        (req as any).adminSession = {
          sessionId: `fb-${decoded.uid}`,
          userId: decoded.uid,
          email,
          nameEn: staffUser?.nameEn || decoded.name || 'Administrator',
          role: staffUser?.role || 'Super Admin',
          mfaVerified: true,
          ipAddress: req.ip || '127.0.0.1',
          userAgent: req.headers['user-agent'] || 'Unknown',
          createdAt: new Date().toISOString(),
          expiresAt: Date.now() + SESSION_TTL_MS,
        };
        return next();
      }
    } catch {
      // Fall through to 401 below
    }
  }

  return res.status(401).json({
    success: false,
    error: 'Authentication required. Please sign in to 360Khabarnama Admin.',
  });
}
