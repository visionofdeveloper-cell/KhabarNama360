/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Firebase Auth & Firestore Reader/Admin Context
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleAuthProvider,
  OperationType,
  handleFirestoreError,
  sanitizeFirestoreId,
  clampText,
} from '../lib/firebase.ts';
import { Article, NotificationTopics } from '../types/index.ts';

export interface BookmarkRecord {
  uid: string;
  articleId: string;
  slug: string;
  titleEn: string;
  titleUr?: string;
  category?: string;
}

interface FirebaseContextValue {
  user: User | null;
  authReady: boolean;
  bookmarks: BookmarkRecord[];
  isBookmarked: (articleId: string) => boolean;
  toggleBookmark: (article: Article) => Promise<boolean>;
  syncPushPreferences: (
    topics: NotificationTopics,
    language: 'en' | 'ur' | 'both',
    status: 'active' | 'unsubscribed'
  ) => Promise<void>;
  signInWithGoogle: () => Promise<User>;
  signOutFirebase: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([]);

  const ensureUserProfile = useCallback(async (firebaseUser: User) => {
    if (!firebaseUser.emailVerified) return;

    const uid = sanitizeFirestoreId(firebaseUser.uid, 'usr');
    const publicPath = `users/${uid}`;
    const privatePath = `users/${uid}/private/info`;
    const publicRef = doc(db, 'users', uid);
    const privateRef = doc(db, 'users', uid, 'private', 'info');

    try {
      const snap = await getDocFromServer(publicRef);
      const displayName = clampText(
        firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Reader',
        120
      );
      const photoURL = firebaseUser.photoURL ? clampText(firebaseUser.photoURL, 500) : undefined;

      const publicPayload: Record<string, unknown> = {
        uid,
        displayName,
        preferredLang: typeof document !== 'undefined' && document.documentElement.dir === 'rtl' ? 'ur' : 'en',
        updatedAt: serverTimestamp(),
      };
      if (photoURL) {
        publicPayload.photoURL = photoURL;
      }

      if (!snap.exists()) {
        await setDoc(publicRef, {
          ...publicPayload,
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, publicPath);
    }

    if (firebaseUser.email) {
      try {
        const privSnap = await getDocFromServer(privateRef);
        const email = clampText(firebaseUser.email, 254);
        if (!privSnap.exists()) {
          await setDoc(privateRef, {
            uid,
            email,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, privatePath);
      }
    }
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (firebaseUser && firebaseUser.emailVerified) {
        try {
          await ensureUserProfile(firebaseUser);
        } catch (err) {
          console.warn('[FirebaseContext] Profile sync warning:', err);
        }
      } else {
        setBookmarks([]);
      }
    });

    return () => unsubscribeAuth();
  }, [ensureUserProfile]);

  // Real-time bookmarks listener — strictly guarded by authReady && authenticated user
  useEffect(() => {
    if (!authReady || !user) {
      setBookmarks([]);
      return;
    }

    const uid = sanitizeFirestoreId(user.uid, 'usr');
    const bookmarksPath = `users/${uid}/bookmarks`;
    const bookmarksQuery = query(
      collection(db, 'users', uid, 'bookmarks'),
      where('uid', '==', user.uid)
    );

    const unsubscribeSnap = onSnapshot(
      bookmarksQuery,
      (snapshot) => {
        const next: BookmarkRecord[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            uid: String(data.uid || user.uid),
            articleId: String(data.articleId || d.id),
            slug: String(data.slug || ''),
            titleEn: String(data.titleEn || ''),
            titleUr: data.titleUr ? String(data.titleUr) : undefined,
            category: data.category ? String(data.category) : undefined,
          };
        });
        setBookmarks(next);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, bookmarksPath);
      }
    );

    return () => unsubscribeSnap();
  }, [authReady, user]);

  const signInWithGoogle = useCallback(async (): Promise<User> => {
    const cred = await signInWithPopup(auth, googleAuthProvider);
    if (cred.user && cred.user.emailVerified) {
      await ensureUserProfile(cred.user);
    }
    return cred.user;
  }, [ensureUserProfile]);

  const signOutFirebase = useCallback(async () => {
    await firebaseSignOut(auth);
    setBookmarks([]);
  }, []);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    if (!auth.currentUser) return null;
    return await auth.currentUser.getIdToken();
  }, []);

  const isBookmarked = useCallback(
    (articleId: string) => {
      const safeId = sanitizeFirestoreId(articleId, 'art');
      return bookmarks.some((b) => b.articleId === safeId || b.articleId === articleId);
    },
    [bookmarks]
  );

  const toggleBookmark = useCallback(
    async (article: Article): Promise<boolean> => {
      let activeUser = auth.currentUser;
      if (!activeUser) {
        activeUser = await signInWithGoogle();
      }
      if (!activeUser) return false;

      await ensureUserProfile(activeUser);

      const uid = sanitizeFirestoreId(activeUser.uid, 'usr');
      const safeArticleId = sanitizeFirestoreId(article.id, 'art');
      const bookmarkPath = `users/${uid}/bookmarks/${safeArticleId}`;
      const bookmarkRef = doc(db, 'users', uid, 'bookmarks', safeArticleId);

      const currentlySaved = bookmarks.some(
        (b) => b.articleId === safeArticleId || b.articleId === article.id
      );

      if (currentlySaved) {
        try {
          await deleteDoc(bookmarkRef);
          return false;
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, bookmarkPath);
        }
      } else {
        try {
          await setDoc(bookmarkRef, {
            uid: activeUser.uid,
            articleId: safeArticleId,
            slug: clampText(article.slug || safeArticleId, 180),
            titleEn: clampText(article.titleEn, 300) || 'Article',
            titleUr: clampText(article.titleUr, 400),
            category: clampText(article.category, 64) || 'pakistan',
            createdAt: serverTimestamp(),
          });
          return true;
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, bookmarkPath);
        }
      }
    },
    [bookmarks, ensureUserProfile, signInWithGoogle]
  );

  const syncPushPreferences = useCallback(
    async (
      topics: NotificationTopics,
      language: 'en' | 'ur' | 'both',
      status: 'active' | 'unsubscribed'
    ) => {
      const activeUser = auth.currentUser;
      if (!activeUser || !activeUser.emailVerified) return;

      const uid = sanitizeFirestoreId(activeUser.uid, 'usr');
      const prefPath = `pushPreferences/${uid}`;
      const prefRef = doc(db, 'pushPreferences', uid);

      try {
        const existing = await getDocFromServer(prefRef);
        if (existing.exists()) {
          await setDoc(
            prefRef,
            {
              uid: activeUser.uid,
              breakingNews: Boolean(topics.breakingNews),
              cricketScores: Boolean(topics.cricketScores),
              dailyBriefing: Boolean(topics.dailyBriefing ?? true),
              language,
              status,
              createdAt: existing.data().createdAt,
              updatedAt: serverTimestamp(),
            },
            { merge: false }
          );
        } else {
          await setDoc(prefRef, {
            uid: activeUser.uid,
            breakingNews: Boolean(topics.breakingNews),
            cricketScores: Boolean(topics.cricketScores),
            dailyBriefing: Boolean(topics.dailyBriefing ?? true),
            language,
            status,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, prefPath);
      }
    },
    []
  );

  return (
    <FirebaseContext.Provider
      value={{
        user,
        authReady,
        bookmarks,
        isBookmarked,
        toggleBookmark,
        syncPushPreferences,
        signInWithGoogle,
        signOutFirebase,
        getIdToken,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};

export function useFirebase(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase must be used inside FirebaseProvider');
  }
  return ctx;
}
