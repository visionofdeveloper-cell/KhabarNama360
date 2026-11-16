/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Server-Side Cloud Firestore Persistence & Diagnostics Client
 *
 * Targets existing Cloud Firestore database:
 *   Project: gen-lang-client-0094029776
 *   Database: ai-studio-360khabarnama-91785bb5-94ed-4005-bd25-9b4d9b8b10ba
 *
 * Authentication Modes:
 *   1. Service Account OAuth2 JWT token (when FIREBASE_SERVICE_ACCOUNT_JSON / BASE64 / GOOGLE_APPLICATION_CREDENTIALS is set)
 *   2. Verified Admin Firebase ID Token (forwarded from authenticated admin request)
 *   3. Public Web API Key (for public queries on status == 'published' & /test/connection)
 */

import {
  firebaseProjectConfig,
  getServiceAccountAccessToken,
  hasServiceAccountConfigured,
} from '../lib/firebase-admin.ts';
import { Article } from '../types/index.ts';
import { recordServerError } from './errorTracker.ts';

const FIRESTORE_ROOT = `https://firestore.googleapis.com/v1/projects/${firebaseProjectConfig.projectId}/databases/${firebaseProjectConfig.firestoreDatabaseId}`;
const DOCS_BASE = `${FIRESTORE_ROOT}/documents`;

export interface FirestoreHealthReport {
  configured: boolean;
  connected: boolean;
  databaseType: 'Cloud Firestore';
  storageMode: 'cloud_firestore' | 'json_cache_fallback';
  projectId: string;
  firestoreDatabaseId: string;
  authMode: 'service_account' | 'admin_id_token' | 'public_api_key';
  serviceAccountConfigured: boolean;
  latencyMs: number;
  testConnectionDocExists: boolean;
  publishedCountInFirestore: number;
  totalCountInFirestore: number | null;
  lastCheckedAt: string;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface FirestoreAuthContext {
  firebaseIdToken?: string;
  uid?: string;
}

function sanitizeFirestoreId(raw: string, fallback = 'item'): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 128);
  return cleaned || `${fallback}-${Date.now()}`;
}

function sanitizeSlug(raw: string, fallback = 'news'): string {
  const cleaned = String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
  return cleaned.length >= 2 ? cleaned : `${fallback}-${Date.now().toString(36)}`.slice(0, 180);
}

export async function resolveFirestoreAuth(bearerToken?: string): Promise<{
  headers: Record<string, string>;
  urlSuffix: string;
  authMode: 'service_account' | 'admin_id_token' | 'public_api_key';
}> {
  const saToken = await getServiceAccountAccessToken().catch(() => null);
  if (saToken) {
    return {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${saToken}`,
      },
      urlSuffix: '',
      authMode: 'service_account',
    };
  }

  if (bearerToken && bearerToken.trim()) {
    return {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bearerToken.trim()}`,
      },
      urlSuffix: `?key=${encodeURIComponent(firebaseProjectConfig.apiKey)}`,
      authMode: 'admin_id_token',
    };
  }

  return {
    headers: {
      'Content-Type': 'application/json',
    },
    urlSuffix: `?key=${encodeURIComponent(firebaseProjectConfig.apiKey)}`,
    authMode: 'public_api_key',
  };
}

function encodeValue(val: any): Record<string, any> | undefined {
  if (val === undefined) return undefined;
  if (val === null) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val
          .map((item) => encodeValue(item))
          .filter((v): v is Record<string, any> => Boolean(v)),
      },
    };
  }
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      const encoded = encodeValue(v);
      if (encoded !== undefined) fields[k] = encoded;
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function decodeValue(val: any): any {
  if (!val || typeof val !== 'object') return undefined;
  if ('stringValue' in val) return String(val.stringValue);
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('timestampValue' in val) return String(val.timestampValue);
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) {
    const arr = Array.isArray(val.arrayValue?.values) ? val.arrayValue.values : [];
    return arr.map((item: any) => decodeValue(item));
  }
  if ('mapValue' in val) {
    const obj: Record<string, any> = {};
    const fields = val.mapValue?.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      obj[k] = decodeValue(v);
    }
    return obj;
  }
  return undefined;
}

export function firestoreDocToArticle(docObj: any): Article | null {
  if (!docObj || !docObj.fields) return null;
  const f = docObj.fields;
  const docNameParts = String(docObj.name || '').split('/');
  const docId = docNameParts[docNameParts.length - 1] || '';

  const get = (key: string, fallback?: any) => {
    const v = decodeValue(f[key]);
    return v === undefined ? fallback : v;
  };

  const id = String(get('id', docId) || docId);
  if (!id) return null;

  const tagsRaw = get('tags', []);
  const tags = Array.isArray(tagsRaw) ? tagsRaw.map((t: any) => String(t)).filter(Boolean) : [];
  const status = String(get('status', 'published')) as Article['status'];
  const createdAt = String(get('createdAt', new Date().toISOString()));
  const updatedAt = String(get('updatedAt', createdAt));
  const publishedAtRaw = get('publishedAt', undefined);

  return {
    id,
    slug: String(get('slug', id)),
    titleEn: String(get('titleEn', '')),
    titleUr: String(get('titleUr', '')),
    summaryEn: String(get('summaryEn', '')),
    summaryUr: String(get('summaryUr', '')),
    contentEn: String(get('contentEn', '')),
    contentUr: String(get('contentUr', '')),
    category: String(get('category', 'pakistan')),
    tags,
    status,
    isBreaking: Boolean(get('isBreaking', false)),
    isFeatured: Boolean(get('isFeatured', false)),
    isTrending: Boolean(get('isTrending', false)),
    heroImage: String(
      get(
        'heroImage',
        'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=1200&q=80'
      )
    ),
    imageCaptionEn: String(get('imageCaptionEn', '')),
    imageCaptionUr: String(get('imageCaptionUr', '')),
    readingTimeMin: Number(get('readingTimeMin', 3)) || 3,
    author: {
      id: String(get('authorUid', 'admin-desk')),
      nameEn: String(get('authorNameEn', '360Khabarnama Editorial')),
      nameUr: String(get('authorNameUr', 'ادارہ 360 خبرنامہ')),
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      role: 'Editor',
    },
    publishedAt: publishedAtRaw ? String(publishedAtRaw) : status === 'published' ? updatedAt : '',
    scheduledAt: get('scheduledAt', undefined) ? String(get('scheduledAt')) : undefined,
    version: Number(get('version', 1)) || 1,
    failureReason: get('failureReason', undefined) ? String(get('failureReason')) : undefined,
    views: Number(get('views', 0)) || 0,
    seo: {
      metaTitleEn: get('metaTitleEn', undefined) ? String(get('metaTitleEn')) : undefined,
      metaTitleUr: get('metaTitleUr', undefined) ? String(get('metaTitleUr')) : undefined,
      metaDescriptionEn: get('metaDescriptionEn', undefined) ? String(get('metaDescriptionEn')) : undefined,
      metaDescriptionUr: get('metaDescriptionUr', undefined) ? String(get('metaDescriptionUr')) : undefined,
      canonicalUrl: get('canonicalUrl', undefined) ? String(get('canonicalUrl')) : undefined,
    },
    createdBy: String(get('authorUid', '')),
    updatedAt,
  };
}

function buildArticleFirestoreFields(
  article: Article,
  opts: {
    authorUid: string;
    preserveCreatedAtTimestamp?: string;
  }
): {
  fields: Record<string, any>;
  fieldTransforms: { fieldPath: string; setToServerValue: 'REQUEST_TIME' }[];
} {
  const safeId = sanitizeFirestoreId(article.id, 'art');
  const safeSlug = sanitizeSlug(article.slug || article.titleEn || safeId, safeId);
  const cleanTags = (Array.isArray(article.tags) ? article.tags : [])
    .map((t) => String(t || '').trim().slice(0, 64))
    .filter(Boolean)
    .slice(0, 20);

  const allowedStatus = ['draft', 'in_review', 'scheduled', 'published', 'archived', 'failed'].includes(
    article.status
  )
    ? article.status
    : 'draft';

  const rawFields: Record<string, any> = {
    id: safeId,
    slug: safeSlug,
    titleEn: (article.titleEn || article.titleUr || 'Untitled Story').trim().slice(0, 300),
    titleUr: (article.titleUr || article.titleEn || 'بغیر عنوان خبر').trim().slice(0, 400),
    summaryEn: (article.summaryEn || '').slice(0, 1200),
    summaryUr: (article.summaryUr || '').slice(0, 1500),
    contentEn: (article.contentEn || '').slice(0, 150000),
    contentUr: (article.contentUr || '').slice(0, 150000),
    category: (article.category || 'pakistan').trim().slice(0, 64) || 'pakistan',
    tags: cleanTags,
    status: allowedStatus,
    isBreaking: Boolean(article.isBreaking),
    isFeatured: Boolean(article.isFeatured),
    isTrending: Boolean(article.isTrending),
    heroImage: (article.heroImage || '').slice(0, 1500),
    imageCaptionEn: (article.imageCaptionEn || '').slice(0, 400),
    imageCaptionUr: (article.imageCaptionUr || '').slice(0, 500),
    readingTimeMin: Math.max(1, Math.round(Number(article.readingTimeMin || 3))),
    authorUid: sanitizeFirestoreId(opts.authorUid, 'admin'),
    authorNameEn: (article.author?.nameEn || '360Khabarnama Editorial').slice(0, 120),
    authorNameUr: (article.author?.nameUr || 'ادارہ 360 خبرنامہ').slice(0, 160),
    version: Math.max(1, Math.round(Number(article.version || 1))),
    views: Math.max(0, Math.round(Number(article.views || 0))),
  };

  if (article.publishedAt) {
    rawFields.publishedAt = String(article.publishedAt).slice(0, 64);
  }
  if (article.scheduledAt || article.scheduledFor) {
    rawFields.scheduledAt = String(article.scheduledAt || article.scheduledFor).slice(0, 64);
  }
  if (article.failureReason) {
    rawFields.failureReason = String(article.failureReason).slice(0, 500);
  }
  if (article.seo?.metaTitleEn) {
    rawFields.metaTitleEn = String(article.seo.metaTitleEn).slice(0, 200);
  }
  if (article.seo?.metaTitleUr) {
    rawFields.metaTitleUr = String(article.seo.metaTitleUr).slice(0, 250);
  }
  if (article.seo?.metaDescriptionEn) {
    rawFields.metaDescriptionEn = String(article.seo.metaDescriptionEn).slice(0, 500);
  }
  if (article.seo?.metaDescriptionUr) {
    rawFields.metaDescriptionUr = String(article.seo.metaDescriptionUr).slice(0, 600);
  }
  if (article.seo?.canonicalUrl) {
    rawFields.canonicalUrl = String(article.seo.canonicalUrl).slice(0, 500);
  }

  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(rawFields)) {
    const encoded = encodeValue(v);
    if (encoded) fields[k] = encoded;
  }

  const fieldTransforms: { fieldPath: string; setToServerValue: 'REQUEST_TIME' }[] = [
    { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
  ];

  if (opts.preserveCreatedAtTimestamp) {
    fields.createdAt = { timestampValue: opts.preserveCreatedAtTimestamp };
  } else {
    fieldTransforms.push({ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' });
  }

  return { fields, fieldTransforms };
}

async function fetchRawFirestoreDoc(
  collectionPath: string,
  docId: string,
  bearerToken?: string
): Promise<{ exists: boolean; doc?: any; status: number; error?: string }> {
  const { headers, urlSuffix } = await resolveFirestoreAuth(bearerToken);
  const url = `${DOCS_BASE}/${collectionPath}/${encodeURIComponent(docId)}${urlSuffix}`;
  const res = await fetch(url, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(10000),
  });
  if (res.status === 404) {
    return { exists: false, status: 404 };
  }
  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { error: { message: text.slice(0, 200) } };
  }
  if (!res.ok) {
    return {
      exists: false,
      status: res.status,
      error: parsed?.error?.message || `Firestore HTTP ${res.status}`,
    };
  }
  return { exists: true, doc: parsed, status: res.status };
}

export async function runFirestoreQuery(
  structuredQuery: Record<string, any>,
  bearerToken?: string
): Promise<{ ok: boolean; docs: any[]; status: number; error?: string }> {
  const { headers, urlSuffix } = await resolveFirestoreAuth(bearerToken);
  const url = `${DOCS_BASE}:runQuery${urlSuffix}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ structuredQuery }),
    signal: AbortSignal.timeout(12000),
  });
  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : [];
  } catch {
    return { ok: false, docs: [], status: res.status, error: `Non-JSON Firestore response: ${text.slice(0, 140)}` };
  }
  if (!res.ok) {
    const errObj = Array.isArray(parsed) ? parsed[0]?.error : parsed?.error;
    return {
      ok: false,
      docs: [],
      status: res.status,
      error: errObj?.message || `Firestore query HTTP ${res.status}`,
    };
  }
  const rows = Array.isArray(parsed) ? parsed : [];
  const docs = rows.map((r: any) => r?.document).filter(Boolean);
  return { ok: true, docs, status: res.status };
}

export async function listFirestoreArticles(
  filters: { status?: string; category?: string; tag?: string; search?: string; limit?: number },
  bearerToken?: string
): Promise<{ ok: boolean; articles: Article[]; authMode: string; error?: string }> {
  const { authMode } = await resolveFirestoreAuth(bearerToken);
  const requestedStatus = filters.status || 'published';

  // If unauthenticated (public_api_key), firestore.rules strictly requires status == 'published' on list
  const effectiveStatus =
    authMode === 'public_api_key' ? 'published' : requestedStatus;

  const whereClauses: any[] = [];
  if (effectiveStatus && effectiveStatus !== 'all') {
    whereClauses.push({
      fieldFilter: {
        field: { fieldPath: 'status' },
        op: 'EQUAL',
        value: { stringValue: effectiveStatus },
      },
    });
  }
  if (filters.category && filters.category !== 'all') {
    whereClauses.push({
      fieldFilter: {
        field: { fieldPath: 'category' },
        op: 'EQUAL',
        value: { stringValue: filters.category.toLowerCase() },
      },
    });
  }

  const structuredQuery: Record<string, any> = {
    from: [{ collectionId: 'articles' }],
    limit: Math.min(Math.max(Number(filters.limit || 200), 1), 300),
  };
  if (whereClauses.length === 1) {
    structuredQuery.where = whereClauses[0];
  } else if (whereClauses.length > 1) {
    structuredQuery.where = {
      compositeFilter: {
        op: 'AND',
        filters: whereClauses,
      },
    };
  }

  const qRes = await runFirestoreQuery(structuredQuery, bearerToken);
  if (!qRes.ok) {
    return { ok: false, articles: [], authMode, error: qRes.error };
  }

  let articles = qRes.docs
    .map((d) => firestoreDocToArticle(d))
    .filter((a): a is Article => Boolean(a));

  if (filters.tag) {
    const tLower = filters.tag.toLowerCase();
    articles = articles.filter((a) => a.tags.some((t) => t.toLowerCase() === tLower));
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    articles = articles.filter(
      (a) =>
        a.titleEn.toLowerCase().includes(q) ||
        a.titleUr.includes(q) ||
        a.summaryEn.toLowerCase().includes(q) ||
        a.summaryUr.includes(q) ||
        a.slug.toLowerCase().includes(q)
    );
  }

  articles.sort((a, b) => {
    const ta = new Date(a.publishedAt || a.updatedAt || 0).getTime();
    const tb = new Date(b.publishedAt || b.updatedAt || 0).getTime();
    return tb - ta;
  });

  return { ok: true, articles, authMode };
}

export async function getFirestoreArticle(
  idOrSlug: string,
  bearerToken?: string
): Promise<{ ok: boolean; article: Article | null; error?: string }> {
  const clean = decodeURIComponent(idOrSlug || '').trim();
  if (!clean) return { ok: true, article: null };

  // 1. Try direct doc lookup when valid Firestore ID
  if (/^[a-zA-Z0-9_-]{1,128}$/.test(clean)) {
    const byId = await fetchRawFirestoreDoc('articles', clean, bearerToken);
    if (byId.exists && byId.doc) {
      const parsed = firestoreDocToArticle(byId.doc);
      if (parsed) return { ok: true, article: parsed };
    }
  }

  // 2. Try slug query (restricted to published if unauthenticated)
  const { authMode } = await resolveFirestoreAuth(bearerToken);
  const filters: any[] = [
    {
      fieldFilter: {
        field: { fieldPath: 'slug' },
        op: 'EQUAL',
        value: { stringValue: clean.toLowerCase() },
      },
    },
  ];
  if (authMode === 'public_api_key') {
    filters.push({
      fieldFilter: {
        field: { fieldPath: 'status' },
        op: 'EQUAL',
        value: { stringValue: 'published' },
      },
    });
  }

  const qRes = await runFirestoreQuery(
    {
      from: [{ collectionId: 'articles' }],
      where: filters.length === 1 ? filters[0] : { compositeFilter: { op: 'AND', filters } },
      limit: 1,
    },
    bearerToken
  );
  if (!qRes.ok) {
    return { ok: false, article: null, error: qRes.error };
  }
  const firstDoc = qRes.docs[0];
  return { ok: true, article: firstDoc ? firestoreDocToArticle(firstDoc) : null };
}

export async function upsertFirestoreArticle(
  article: Article,
  authCtx: FirestoreAuthContext
): Promise<{ ok: boolean; article?: Article; error?: string; code?: string }> {
  const safeId = sanitizeFirestoreId(article.id, 'art');
  const { headers, urlSuffix, authMode } = await resolveFirestoreAuth(authCtx.firebaseIdToken);

  if (authMode === 'public_api_key') {
    return {
      ok: false,
      code: 'FIRESTORE_AUTH_REQUIRED',
      error: 'Authenticated Firebase Admin session or Service Account is required to write to Cloud Firestore.',
    };
  }

  // Check if document already exists so we preserve immutable authorUid & createdAt
  const existingLookup = await fetchRawFirestoreDoc('articles', safeId, authCtx.firebaseIdToken);
  const existingDoc = existingLookup.exists ? existingLookup.doc : null;
  const existingAuthorUid = existingDoc?.fields?.authorUid
    ? String(decodeValue(existingDoc.fields.authorUid) || '')
    : '';
  const existingCreatedAt = existingDoc?.fields?.createdAt?.timestampValue
    ? String(existingDoc.fields.createdAt.timestampValue)
    : undefined;

  const authorUid =
    existingAuthorUid ||
    authCtx.uid ||
    article.createdBy ||
    article.author?.id ||
    'admin-desk';

  const { fields, fieldTransforms } = buildArticleFirestoreFields(article, {
    authorUid,
    preserveCreatedAtTimestamp: existingCreatedAt,
  });

  const docName = `projects/${firebaseProjectConfig.projectId}/databases/${firebaseProjectConfig.firestoreDatabaseId}/documents/articles/${safeId}`;

  const commitUrl = `${DOCS_BASE}:commit${urlSuffix}`;
  const res = await fetch(commitUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      writes: [
        {
          update: {
            name: docName,
            fields,
          },
          updateTransforms: fieldTransforms,
        },
      ],
    }),
    signal: AbortSignal.timeout(12000),
  });

  const rawText = await res.text();
  let parsed: any = null;
  try {
    parsed = rawText ? JSON.parse(rawText) : {};
  } catch {
    parsed = { error: { message: rawText.slice(0, 200) } };
  }

  if (!res.ok) {
    const errMsg = parsed?.error?.message || `Firestore commit HTTP ${res.status}`;
    recordServerError({
      source: 'firestore',
      code: String(parsed?.error?.status || res.status),
      message: `Firestore commit rejected for article ${safeId}: ${errMsg}`,
      statusCode: res.status,
    });
    return {
      ok: false,
      code: String(parsed?.error?.status || 'FIRESTORE_WRITE_FAILED'),
      error: errMsg,
    };
  }

  // Explicit read-after-write verification from Firestore
  const readBack = await getFirestoreArticle(safeId, authCtx.firebaseIdToken);
  if (!readBack.ok || !readBack.article) {
    return {
      ok: false,
      code: 'FIRESTORE_READ_AFTER_WRITE_FAILED',
      error: readBack.error || 'Firestore commit returned 200 but read-after-write verification could not retrieve the document.',
    };
  }

  return { ok: true, article: readBack.article };
}

export async function deleteFirestoreArticle(
  id: string,
  authCtx: FirestoreAuthContext
): Promise<{ ok: boolean; error?: string }> {
  const safeId = sanitizeFirestoreId(id, 'art');
  const { headers, urlSuffix, authMode } = await resolveFirestoreAuth(authCtx.firebaseIdToken);
  if (authMode === 'public_api_key') {
    return {
      ok: false,
      error: 'Authenticated Firebase Admin session or Service Account is required to delete from Cloud Firestore.',
    };
  }

  const url = `${DOCS_BASE}/articles/${encodeURIComponent(safeId)}${urlSuffix}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers,
    signal: AbortSignal.timeout(10000),
  });

  if (res.status === 404) {
    return { ok: true };
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    return { ok: false, error: `Firestore delete failed (HTTP ${res.status}): ${txt.slice(0, 160)}` };
  }
  return { ok: true };
}

export async function ensureTestConnectionDoc(
  authCtx: FirestoreAuthContext
): Promise<{ ok: boolean; error?: string }> {
  const { headers, urlSuffix, authMode } = await resolveFirestoreAuth(authCtx.firebaseIdToken);
  if (authMode === 'public_api_key') {
    return { ok: false, error: 'Authentication required to create /test/connection.' };
  }

  const docName = `projects/${firebaseProjectConfig.projectId}/databases/${firebaseProjectConfig.firestoreDatabaseId}/documents/test/connection`;
  const res = await fetch(`${DOCS_BASE}:commit${urlSuffix}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      writes: [
        {
          update: {
            name: docName,
            fields: {
              status: { stringValue: 'ok' },
            },
          },
        },
      ],
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    return { ok: false, error: `Failed writing /test/connection (HTTP ${res.status}): ${txt.slice(0, 160)}` };
  }
  return { ok: true };
}

export async function seedMissingArticlesToFirestore(
  seedArticles: Article[],
  authCtx: FirestoreAuthContext
): Promise<{
  ok: boolean;
  seededCount: number;
  skippedCount: number;
  failedCount: number;
  errors: string[];
}> {
  const { authMode } = await resolveFirestoreAuth(authCtx.firebaseIdToken);
  if (authMode === 'public_api_key') {
    return {
      ok: false,
      seededCount: 0,
      skippedCount: 0,
      failedCount: seedArticles.length,
      errors: ['Admin Firebase ID token or Service Account required to seed Firestore articles.'],
    };
  }

  // Ensure /test/connection probe document exists cleanly
  await ensureTestConnectionDoc(authCtx).catch(() => {});

  let seededCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  for (const art of seedArticles.filter((a) => !a.deletedAt)) {
    const safeId = sanitizeFirestoreId(art.id, 'art');
    const existsCheck = await fetchRawFirestoreDoc('articles', safeId, authCtx.firebaseIdToken);
    if (existsCheck.exists) {
      skippedCount++;
      continue;
    }

    const writeRes = await upsertFirestoreArticle(
      { ...art, id: safeId },
      authCtx
    );
    if (writeRes.ok) {
      seededCount++;
    } else {
      failedCount++;
      if (errors.length < 5) {
        errors.push(`${safeId}: ${writeRes.error || 'write failed'}`);
      }
    }
  }

  return {
    ok: failedCount === 0,
    seededCount,
    skippedCount,
    failedCount,
    errors,
  };
}

export async function checkFirestoreHealth(bearerToken?: string): Promise<FirestoreHealthReport> {
  const started = Date.now();
  const saConfigured = hasServiceAccountConfigured();
  const { authMode } = await resolveFirestoreAuth(bearerToken);

  try {
    const [testDocRes, pubRes, totalRes] = await Promise.all([
      fetchRawFirestoreDoc('test', 'connection', bearerToken),
      runFirestoreQuery(
        {
          from: [{ collectionId: 'articles' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'status' },
              op: 'EQUAL',
              value: { stringValue: 'published' },
            },
          },
          limit: 300,
        },
        bearerToken
      ),
      authMode !== 'public_api_key'
        ? runFirestoreQuery({ from: [{ collectionId: 'articles' }], limit: 300 }, bearerToken)
        : Promise.resolve(null),
    ]);

    const connected = pubRes.ok || testDocRes.status === 200 || testDocRes.status === 404;
    const errorCode = !pubRes.ok ? `FIRESTORE_HTTP_${pubRes.status}` : null;
    const errorMessage = !pubRes.ok ? pubRes.error || 'Firestore query failed' : null;

    return {
      configured: true,
      connected,
      databaseType: 'Cloud Firestore',
      storageMode: connected ? 'cloud_firestore' : 'json_cache_fallback',
      projectId: firebaseProjectConfig.projectId,
      firestoreDatabaseId: firebaseProjectConfig.firestoreDatabaseId,
      authMode,
      serviceAccountConfigured: saConfigured,
      latencyMs: Date.now() - started,
      testConnectionDocExists: testDocRes.exists,
      publishedCountInFirestore: pubRes.ok ? pubRes.docs.length : 0,
      totalCountInFirestore: totalRes && totalRes.ok ? totalRes.docs.length : null,
      lastCheckedAt: new Date().toISOString(),
      errorCode,
      errorMessage,
    };
  } catch (err: any) {
    return {
      configured: true,
      connected: false,
      databaseType: 'Cloud Firestore',
      storageMode: 'json_cache_fallback',
      projectId: firebaseProjectConfig.projectId,
      firestoreDatabaseId: firebaseProjectConfig.firestoreDatabaseId,
      authMode,
      serviceAccountConfigured: saConfigured,
      latencyMs: Date.now() - started,
      testConnectionDocExists: false,
      publishedCountInFirestore: 0,
      totalCountInFirestore: null,
      lastCheckedAt: new Date().toISOString(),
      errorCode: err?.code || 'FIRESTORE_UNREACHABLE',
      errorMessage: err?.message || 'Unable to reach Cloud Firestore.',
    };
  }
}
