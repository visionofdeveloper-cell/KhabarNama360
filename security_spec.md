# 360Khabarnama Firestore Security Specification

## 1. Data Invariants
1. **Default Deny**: Every unmatched path under `/databases/{database}/documents` is denied for both reads and writes.
2. **Path ID Hardening**: Single-document operations (`get`, `create`, `update`, `delete`) validate document IDs with `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars). List queries omit `isValidId()` on the queried collection ID.
3. **Strict PII Split**: `/users/{userId}` stores only non-PII display preferences (`displayName`, `photoURL`, `preferredLang`). User email (`email`) is isolated under `/users/{userId}/private/info` and restricted solely to `isOwner(userId)` or `isAdmin()`.
4. **Master Gate & Relational Integrity**: Reader bookmarks at `/users/{userId}/bookmarks/{bookmarkId}` require parent `/users/{userId}` document existence via `exists(...)` and `uid == request.auth.uid == userId`.
5. **Verified Users Only for Writes**: All client writes require `request.auth != null && request.auth.token.email_verified == true`.
6. **Privilege Escalation Prevention**: Admin roles are verified strictly via `exists(/databases/$(database)/documents/admins/$(request.auth.uid))` or verified bootstrapped super-admin email (`visionofdeveloper@gmail.com` with `email_verified == true`). Users can never self-assign admin status in `/users` or `/admins`.
7. **Temporal & Ownership Immutability**: `createdAt` must equal `request.time` on creation and remain immutable on update; `updatedAt` must equal `request.time` on both create and update; `uid`/`authorUid`/`actorUid` remain immutable after creation.
8. **Query Enforcement**: Every `allow list` rule evaluates `resource.data` (e.g., `resource.data.status == 'published'` for `/articles`, or `resource.data.uid == request.auth.uid` for `/pushPreferences`) without `get()`/`exists()` lookups inside `list`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Write to `/articles/art-hack`**: `{ id: "art-hack", ... }` with `request.auth == null` -> `PERMISSION_DENIED`.
2. **Unverified Email Admin Spoof on `/articles/art-1`**: `token.email == "visionofdeveloper@gmail.com"`, `token.email_verified == false` -> `PERMISSION_DENIED`.
3. **Self-Privilege Escalation on `/admins/attacker`**: Authenticated non-admin attempts `create` `{ uid: "attacker", role: "Super Admin", status: "active", createdAt: request.time, updatedAt: request.time }` -> `PERMISSION_DENIED`.
4. **Shadow Field Injection on `/users/{uid}`**: Authenticated owner sends `{ uid, displayName: "Ali", preferredLang: "en", isAdmin: true, createdAt: request.time, updatedAt: request.time }` -> `PERMISSION_DENIED` (blocked by `hasOnly`).
5. **Cross-User Bookmark Creation on `/users/victim/bookmarks/art-1`**: Attacker UID writes bookmark under victim UID or sets `uid: "victim"` -> `PERMISSION_DENIED`.
6. **Orphan Bookmark Without Parent User Profile**: User deletes `/users/{uid}` or omits parent creation and writes `/users/{uid}/bookmarks/art-1` -> `PERMISSION_DENIED` (blocked by Master Gate `exists(/databases/.../users/$(userId))`).
7. **PII Blanket Read on `/users/victim/private/info`**: Non-owner, non-admin authenticated user tries `get` -> `PERMISSION_DENIED`.
8. **Backdated Timestamp Poisoning on `/pushPreferences/{id}`**: Owner supplies `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> `PERMISSION_DENIED`.
9. **ID Poisoning Attack on `/users/{uid}/bookmarks/<2000-char-junk>`**: Document ID exceeds 128 chars or contains `/../` -> `PERMISSION_DENIED` (blocked by `isValidId`).
10. **Immutable Field Mutation on `/pushPreferences/{id}`**: Owner updates `uid` or `createdAt` during preference update -> `PERMISSION_DENIED` (blocked by `affectedKeys().hasOnly(...)` + equality checks).
11. **Oversized String DoS on `/users/{uid}`**: Owner submits `displayName` of 5,000 characters -> `PERMISSION_DENIED` (blocked by `.size() <= 120`).
12. **Unfiltered Scraping Query on `/pushPreferences`**: Signed-in user executes `collection('pushPreferences').get()` without `where('uid', '==', auth.uid)` -> `PERMISSION_DENIED` (blocked by `allow list: if isSignedIn() && resource.data.uid == request.auth.uid`).
