/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Server-Side Firebase Admin SDK Initialization
 */

import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';

function loadFirebaseConfig(): { projectId: string } {
  const fallbackProjectId =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    'gen-lang-client-0094029776';

  const candidates = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    path.resolve('/var/task/firebase-applet-config.json'),
  ];

  for (const configPath of candidates) {
    try {
      if (fs.existsSync(configPath)) {
        const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (parsed?.projectId) {
          return { projectId: parsed.projectId };
        }
      }
    } catch (err) {
      console.warn('[FirebaseAdmin] Config read warning:', (err as any)?.message);
    }
  }

  return { projectId: fallbackProjectId };
}

let cachedAuth: Auth | null = null;

function getFirebaseAdminAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  const firebaseConfig = loadFirebaseConfig();
  const existingApps: App[] = getApps();
  const adminApp =
    existingApps.length > 0
      ? existingApps[0]
      : initializeApp({
          projectId: firebaseConfig.projectId,
        });
  cachedAuth = getAuth(adminApp);
  return cachedAuth;
}

export const adminAuth = {
  verifyIdToken: async (idToken: string) => {
    const auth = getFirebaseAdminAuth();
    return auth.verifyIdToken(idToken);
  },
};
