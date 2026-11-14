/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Server-Side Firebase Admin SDK Initialization
 */

import fs from 'fs';
import path from 'path';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function loadFirebaseConfig(): { projectId: string; firestoreDatabaseId?: string } {
  const fallback = {
    projectId: process.env.GOOGLE_CLOUD_PROJECT || 'gen-lang-client-0094029776',
    firestoreDatabaseId:
      process.env.FIRESTORE_DATABASE_ID ||
      'ai-studio-360khabarnama-91785bb5-94ed-4005-bd25-9b4d9b8b10ba',
  };

  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return {
        projectId: parsed.projectId || fallback.projectId,
        firestoreDatabaseId: parsed.firestoreDatabaseId || fallback.firestoreDatabaseId,
      };
    }
  } catch (err) {
    console.warn('[FirebaseAdmin] Falling back to environment config:', (err as any)?.message);
  }
  return fallback;
}

const firebaseConfig = loadFirebaseConfig();

const adminApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        projectId: firebaseConfig.projectId,
      });

export const adminAuth = getAuth(adminApp);
export const adminDb = firebaseConfig.firestoreDatabaseId
  ? getFirestore(adminApp, firebaseConfig.firestoreDatabaseId)
  : getFirestore(adminApp);
