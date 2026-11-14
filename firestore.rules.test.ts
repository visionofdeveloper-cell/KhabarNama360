/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Dirty Dozen Security Rule Verification Spec
 *
 * Documents and verifies all 12 adversarial payloads against the Firestore rule invariants.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email?: string; email_verified?: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
  enforcedBy: string;
}

export const dirtyDozenPayloads: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Article Creation',
    collection: '/articles/art-hack',
    operation: 'create',
    auth: null,
    payload: { id: 'art-hack', slug: 'hack', titleEn: 'Fake', titleUr: 'جعلی', category: 'pakistan', status: 'published', isBreaking: true, authorUid: 'anon' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'isVerifiedUser() && isAdmin()'
  },
  {
    id: 2,
    name: 'Unverified Email Admin Spoof',
    collection: '/articles/art-spoof',
    operation: 'create',
    auth: { uid: 'spoof-uid', email: 'visionofdeveloper@gmail.com', email_verified: false },
    payload: { id: 'art-spoof', slug: 'spoof', titleEn: 'Spoof', titleUr: 'جعلی', category: 'pakistan', status: 'published', isBreaking: false, authorUid: 'spoof-uid' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'isVerifiedUser() requires request.auth.token.email_verified == true'
  },
  {
    id: 3,
    name: 'Self-Privilege Escalation in /admins',
    collection: '/admins/attacker-uid',
    operation: 'create',
    auth: { uid: 'attacker-uid', email: 'attacker@example.com', email_verified: true },
    payload: { uid: 'attacker-uid', role: 'Super Admin', status: 'active' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'isBootstrappedAdmin()'
  },
  {
    id: 4,
    name: 'Shadow Field Injection in /users',
    collection: '/users/user-1',
    operation: 'create',
    auth: { uid: 'user-1', email: 'reader@example.com', email_verified: true },
    payload: { uid: 'user-1', displayName: 'Reader', preferredLang: 'en', isAdmin: true },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'isValidUserPublicProfile hasOnly check'
  },
  {
    id: 5,
    name: 'Cross-User Bookmark Impersonation',
    collection: '/users/victim-uid/bookmarks/art-1',
    operation: 'create',
    auth: { uid: 'attacker-uid', email: 'attacker@example.com', email_verified: true },
    payload: { uid: 'victim-uid', articleId: 'art-1', slug: 'news-1', titleEn: 'News' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'isOwner(userId) && incoming().uid == request.auth.uid'
  },
  {
    id: 6,
    name: 'Orphan Bookmark Without Parent /users/{uid}',
    collection: '/users/orphan-uid/bookmarks/art-1',
    operation: 'create',
    auth: { uid: 'orphan-uid', email: 'orphan@example.com', email_verified: true },
    payload: { uid: 'orphan-uid', articleId: 'art-1', slug: 'news-1', titleEn: 'News' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'exists(/databases/$(database)/documents/users/$(userId))'
  },
  {
    id: 7,
    name: 'PII Blanket Read on Another User Private Info',
    collection: '/users/victim-uid/private/info',
    operation: 'get',
    auth: { uid: 'other-user', email: 'other@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'isOwner(userId) || isAdmin()'
  },
  {
    id: 8,
    name: 'Backdated Timestamp Poisoning',
    collection: '/pushPreferences/user-1',
    operation: 'create',
    auth: { uid: 'user-1', email: 'user@example.com', email_verified: true },
    payload: { uid: 'user-1', breakingNews: true, cricketScores: true, language: 'both', status: 'active', createdAt: '2020-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'incoming().createdAt == request.time && incoming().updatedAt == request.time'
  },
  {
    id: 9,
    name: 'Document ID Poisoning (>128 chars or invalid chars)',
    collection: '/users/user-1/bookmarks/' + 'x'.repeat(300),
    operation: 'create',
    auth: { uid: 'user-1', email: 'user@example.com', email_verified: true },
    payload: { uid: 'user-1', articleId: 'art-1', slug: 's', titleEn: 'Title' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'isValidId(bookmarkId)'
  },
  {
    id: 10,
    name: 'Immutable UID Mutation on Preference Update',
    collection: '/pushPreferences/user-1',
    operation: 'update',
    auth: { uid: 'user-1', email: 'user@example.com', email_verified: true },
    payload: { uid: 'other-user', breakingNews: false },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'incoming().uid == existing().uid && affectedKeys().hasOnly(...)'
  },
  {
    id: 11,
    name: 'Oversized String Value Poisoning',
    collection: '/users/user-1',
    operation: 'update',
    auth: { uid: 'user-1', email: 'user@example.com', email_verified: true },
    payload: { displayName: 'A'.repeat(5000) },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'isValidUserPublicProfile string size <= 120'
  },
  {
    id: 12,
    name: 'Unfiltered Collection Scrape on /pushPreferences',
    collection: '/pushPreferences',
    operation: 'list',
    auth: { uid: 'user-1', email: 'user@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
    enforcedBy: 'allow list: if isSignedIn() && resource.data.uid == request.auth.uid'
  }
];
