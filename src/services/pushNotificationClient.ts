import { NotificationTopics, PushAlertPayload } from '../types/index.ts';

const STORAGE_KEY_SUBSCRIBED = '360kn_push_subscribed';
const STORAGE_KEY_TOPICS = '360kn_push_topics';
const STORAGE_KEY_ENDPOINT = '360kn_push_endpoint';

export type NotificationListener = (payload: PushAlertPayload) => void;
const listeners: Set<NotificationListener> = new Set();

export function onPushAlert(listener: NotificationListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitPushAlert(payload: PushAlertPayload) {
  listeners.forEach((fn) => {
    try {
      fn(payload);
    } catch (e) {
      console.warn('[PushClient] Error in notification listener:', e);
    }
  });
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Gentle pleasant dual-tone chime via Web Audio API (works 100% offline without external assets)
export function playAlertChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // First note (E5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, ctx.currentTime);
    gain1.gain.setValueAtTime(0.12, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.35);

    // Second note (G#5 / harmony)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(830.61, ctx.currentTime + 0.12);
    gain2.gain.setValueAtTime(0.15, ctx.currentTime + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.12);
    osc2.stop(ctx.currentTime + 0.55);
  } catch {
    // AudioContext might be blocked until user gesture, ignore silently
  }
}

export class PushNotificationClient {
  public static isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator
    );
  }

  public static getPermission(): NotificationPermission {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    return Notification.permission;
  }

  public static getSavedTopics(): NotificationTopics {
    if (typeof localStorage === 'undefined') {
      return { breakingNews: true, cricketScores: true, dailyBriefing: true };
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TOPICS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return { breakingNews: true, cricketScores: true, dailyBriefing: true };
  }

  public static isLocallySubscribed(): boolean {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY_SUBSCRIBED) === 'true';
  }

  public static async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) return null;
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      return reg;
    } catch (err) {
      console.warn('[PushClient] Service Worker registration failed:', err);
      return null;
    }
  }

  public static async fetchVapidPublicKey(): Promise<string | null> {
    try {
      const res = await fetch('/api/notifications/vapid-key');
      const data = await res.json();
      if (data.success && data.publicKey) {
        return data.publicKey;
      }
    } catch (err) {
      console.warn('[PushClient] Could not fetch VAPID key:', err);
    }
    return null;
  }

  public static async subscribe(
    topics: NotificationTopics = { breakingNews: true, cricketScores: true, dailyBriefing: true },
    language: 'en' | 'ur' | 'both' = 'both'
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isSupported()) {
      return { success: false, error: 'Push notifications are not supported in this browser' };
    }

    try {
      // 1. Request browser notification permission
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        localStorage.setItem(STORAGE_KEY_SUBSCRIBED, 'false');
        return { success: false, error: 'Notification permission was denied' };
      }

      // 2. Register Service Worker
      const reg = await this.registerServiceWorker();

      // 3. Obtain VAPID public key
      const vapidKey = await this.fetchVapidPublicKey();

      let pushSubscription: PushSubscription | null = null;
      let subscriptionPayload: any = null;

      if (reg && 'pushManager' in reg && vapidKey) {
        try {
          const convertedKey = urlBase64ToUint8Array(vapidKey);
          pushSubscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedKey as unknown as BufferSource,
          });

          const p256dhKey = pushSubscription.getKey('p256dh');
          const authKey = pushSubscription.getKey('auth');

          subscriptionPayload = {
            endpoint: pushSubscription.endpoint,
            keys: {
              p256dh: p256dhKey ? btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dhKey)))) : '',
              auth: authKey ? btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(authKey)))) : '',
            },
            topics,
            language,
            userAgent: navigator.userAgent,
          };
        } catch (subErr) {
          console.warn('[PushClient] PushManager subscribe error, falling back to local client subscription:', subErr);
        }
      }

      // Fallback for environments where PushManager is restricted (e.g. some iFrames)
      if (!subscriptionPayload) {
        subscriptionPayload = {
          endpoint: `client-endpoint-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          keys: { p256dh: 'browser-client', auth: 'browser-client' },
          topics,
          language,
          userAgent: navigator.userAgent,
        };
      }

      // 4. Save to Backend Database
      const res = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscriptionPayload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Server rejected subscription');
      }

      // 5. Update local state
      localStorage.setItem(STORAGE_KEY_SUBSCRIBED, 'true');
      localStorage.setItem(STORAGE_KEY_TOPICS, JSON.stringify(topics));
      localStorage.setItem(STORAGE_KEY_ENDPOINT, subscriptionPayload.endpoint);

      playAlertChime();

      return { success: true };
    } catch (err: any) {
      console.error('[PushClient] Subscribe error:', err);
      return { success: false, error: err.message || 'Subscription failed' };
    }
  }

  public static async unsubscribe(): Promise<boolean> {
    try {
      const endpoint = localStorage.getItem(STORAGE_KEY_ENDPOINT);
      if (endpoint) {
        await fetch('/api/notifications/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        });
      }

      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            await sub.unsubscribe();
          }
        }
      }

      localStorage.setItem(STORAGE_KEY_SUBSCRIBED, 'false');
      return true;
    } catch (err) {
      console.warn('[PushClient] Unsubscribe error:', err);
      localStorage.setItem(STORAGE_KEY_SUBSCRIBED, 'false');
      return false;
    }
  }

  public static async updatePreferences(
    topics: NotificationTopics,
    language: 'en' | 'ur' | 'both' = 'both'
  ): Promise<boolean> {
    localStorage.setItem(STORAGE_KEY_TOPICS, JSON.stringify(topics));
    const endpoint = localStorage.getItem(STORAGE_KEY_ENDPOINT);

    if (endpoint) {
      try {
        await fetch('/api/notifications/preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint, topics, language }),
        });
      } catch (err) {
        console.warn('[PushClient] Preference sync failed:', err);
      }
    }
    return true;
  }

  public static async triggerTestAlert(type: 'breakingNews' | 'cricketScores'): Promise<any> {
    const endpoint = localStorage.getItem(STORAGE_KEY_ENDPOINT);
    playAlertChime();

    // 1. Fire in-app toast event immediately
    const mockPayload: PushAlertPayload =
      type === 'cricketScores'
        ? {
            title: '🏏 CRICKET ALERT: Pakistan 169/1 (26.3 ov)',
            titleUr: '🏏 کرکٹ الرٹ: پاکستان 169/1 (26.3 اوورز) - فتح!',
            body: 'Babar Azam 35*, Saim Ayub 82. Pakistan defeated Australia by 9 wickets at MCG.',
            bodyUr: 'صائم ایوب 82، بابر اعظم 35۔ پاکستان نے آسٹریلیا کو 9 وکٹوں سے شکست دے دی۔',
            url: '/en/cricket/live-scores',
            topic: 'cricketScores',
          }
        : {
            title: '🚨 BREAKING NEWS: PSX Reaches All-Time Record High',
            titleUr: '🚨 بریکنگ نیوز: پاکستان اسٹاک ایکسچینج تاریخی بلندی پر پہنچ گیا',
            body: 'KSE-100 benchmark index crosses key milestone with historic institutional inflows.',
            bodyUr: 'کے ایس ای 100 انڈیکس میں زبردست تیزی، مارکیٹ نے نیا تاریخی سنگِ میل عبور کر لیا۔',
            url: '/en/pakistan',
            topic: 'breakingNews',
          };

    emitPushAlert(mockPayload);

    // 2. Also trigger standard browser notification if permitted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const notif = new Notification(mockPayload.title, {
          body: mockPayload.body,
          icon: '/assets/aistudio/Modern_Green_and_Gold_News_Logo_2e9a99d4.png',
          badge: '/assets/aistudio/fav_8df1a0eb.png',
          tag: `test-${Date.now()}`,
        });
        notif.onclick = () => {
          window.focus();
          window.location.href = mockPayload.url;
        };
      } catch (e) {
        // Notification constructor might be disallowed in some browser sandboxes, fallback is already in toast
      }
    }

    // 3. Notify backend for push broadcast
    try {
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, endpoint }),
      });
      return await res.json();
    } catch {
      return { success: true, localOnly: true };
    }
  }
}
