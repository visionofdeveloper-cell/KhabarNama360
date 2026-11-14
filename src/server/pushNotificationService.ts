import * as webpushNamespace from 'web-push';
import { db } from './db.ts';
import { PushAlertPayload, WebPushSubscription, Article, CricketMatch } from '../types/index.ts';

const webpush: any = (webpushNamespace as any)?.default || webpushNamespace;

class PushNotificationService {
  private vapidPublicKey: string = '';
  private vapidPrivateKey: string = '';
  private initialized: boolean = false;

  constructor() {
    try {
      this.initVapid();
    } catch (err) {
      console.warn('[WebPush] Deferred VAPID init due to environment constraint:', err);
    }
  }

  private initVapid() {
    if (this.initialized) return;

    // 1. Check environment variables
    const envPublic = process.env.VAPID_PUBLIC_KEY;
    const envPrivate = process.env.VAPID_PRIVATE_KEY;

    if (envPublic && envPrivate) {
      this.vapidPublicKey = envPublic;
      this.vapidPrivateKey = envPrivate;
    } else {
      // 2. Check persistent database
      const savedKeys = db.getVapidKeys();
      if (savedKeys && savedKeys.publicKey && savedKeys.privateKey) {
        this.vapidPublicKey = savedKeys.publicKey;
        this.vapidPrivateKey = savedKeys.privateKey;
      } else if (typeof webpush?.generateVAPIDKeys === 'function') {
        // 3. Generate a stable VAPID keypair and persist in database
        try {
          const generated = webpush.generateVAPIDKeys();
          this.vapidPublicKey = generated.publicKey;
          this.vapidPrivateKey = generated.privateKey;
          db.setVapidKeys(generated);
          console.log('[WebPush] Generated new VAPID keys and stored in persistent database.');
        } catch (err) {
          console.error('[WebPush] Error generating VAPID keys:', err);
        }
      }
    }

    if (this.vapidPublicKey && this.vapidPrivateKey && typeof webpush?.setVapidDetails === 'function') {
      const contactEmail = process.env.VAPID_CONTACT_EMAIL || 'mailto:alerts@360khabarnama.com';
      try {
        webpush.setVapidDetails(contactEmail, this.vapidPublicKey, this.vapidPrivateKey);
        this.initialized = true;
      } catch (err) {
        console.warn('[WebPush] Failed to set VAPID details:', err);
      }
    }
  }

  public getPublicKey(): string {
    if (!this.initialized) {
      this.initVapid();
    }
    return this.vapidPublicKey;
  }

  public async sendPushToSubscription(
    subscription: WebPushSubscription,
    payload: PushAlertPayload
  ): Promise<{ success: boolean; error?: string; expired?: boolean }> {
    if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return { success: false, error: 'Incomplete push subscription credentials' };
    }

    // Determine content based on user language preference
    const isUrduOnly = subscription.language === 'ur';
    const title = isUrduOnly ? (payload.titleUr || payload.title) : payload.title;
    const body = isUrduOnly ? (payload.bodyUr || payload.body) : payload.body;

    const pushData = JSON.stringify({
      title,
      body,
      url: payload.url || 'https://360khabarnama.com',
      topic: payload.topic,
      icon: payload.icon || '/assets/aistudio/Modern_Green_and_Gold_News_Logo_2e9a99d4.png',
      badge: payload.badge || '/assets/aistudio/fav_8df1a0eb.png',
      tag: payload.tag || `360kn-${payload.topic}-${Date.now()}`,
      timestamp: payload.timestamp || new Date().toISOString(),
      actions: [
        {
          action: 'explore',
          title: isUrduOnly ? 'دیکھیں' : 'Read Now',
        },
      ],
    });

    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
          },
        },
        pushData,
        {
          TTL: 60 * 60 * 2, // 2 hours
          urgency: payload.topic === 'breakingNews' ? 'high' : 'normal',
        }
      );
      return { success: true };
    } catch (err: any) {
      // 404 Not Found or 410 Gone indicates expired or invalid subscription
      if (err.statusCode === 404 || err.statusCode === 410) {
        db.unsubscribePush(subscription.endpoint);
        return { success: false, error: 'Subscription expired', expired: true };
      }
      return { success: false, error: err.message || 'Push dispatch failed' };
    }
  }

  public async broadcast(payload: PushAlertPayload): Promise<{
    totalAttempted: number;
    successful: number;
    failed: number;
    expiredRemoved: number;
  }> {
    const allSubs = db.getPushSubscriptions('active');

    // Filter by topic
    const eligibleSubs = allSubs.filter((sub) => {
      if (payload.topic === 'breakingNews') return sub.topics?.breakingNews;
      if (payload.topic === 'cricketScores') return sub.topics?.cricketScores;
      if (payload.topic === 'dailyBriefing') return sub.topics?.dailyBriefing;
      return true;
    });

    let successful = 0;
    let failed = 0;
    let expiredRemoved = 0;

    const promises = eligibleSubs.map(async (sub) => {
      const res = await this.sendPushToSubscription(sub, payload);
      if (res.success) {
        successful++;
      } else {
        failed++;
        if (res.expired) expiredRemoved++;
      }
    });

    await Promise.allSettled(promises);

    // Record into audience notifications audit log
    db.sendAudienceNotification({
      id: `push-broadcast-${Date.now()}`,
      titleEn: payload.title,
      titleUr: payload.titleUr || payload.title,
      messageEn: payload.body,
      messageUr: payload.bodyUr || payload.body,
      channel: 'push',
      category: payload.topic,
      targetUrl: payload.url,
      recipientsCount: eligibleSubs.length,
      status: 'sent',
      sentAt: new Date().toISOString(),
    });

    return {
      totalAttempted: eligibleSubs.length,
      successful,
      failed,
      expiredRemoved,
    };
  }

  // Trigger alert when breaking news is published
  public async alertBreakingNews(article: Article): Promise<void> {
    if (!article.isBreaking) return;
    const baseUrl = process.env.APP_URL || 'https://360khabarnama.com';
    const payload: PushAlertPayload = {
      title: `🚨 BREAKING: ${article.titleEn}`,
      titleUr: `🚨 بریکنگ نیوز: ${article.titleUr || article.titleEn}`,
      body: article.summaryEn || 'Latest breaking developments reported on 360Khabarnama.',
      bodyUr: article.summaryUr || 'تازہ ترین بریکنگ خبر 360 خبرنامہ پر۔',
      url: `${baseUrl}/en/news/${article.slug}`,
      topic: 'breakingNews',
      tag: `breaking-${article.id}`,
    };
    await this.broadcast(payload);
  }

  // Trigger alert when live cricket update occurs
  public async alertCricketUpdate(match: CricketMatch, updateSummary: string, updateSummaryUr?: string): Promise<void> {
    const baseUrl = process.env.APP_URL || 'https://360khabarnama.com';
    const payload: PushAlertPayload = {
      title: `🏏 LIVE CRICKET: ${match.teamA.code} vs ${match.teamB.code}`,
      titleUr: `🏏 لائیو کرکٹ: ${match.teamA.name} بمقابلہ ${match.teamB.name}`,
      body: updateSummary || match.statusTextEn || `${match.teamA.code} ${match.teamA.score || ''} - ${match.teamB.code} ${match.teamB.score || ''}`,
      bodyUr: updateSummaryUr || match.statusTextUr || 'لائیو کرکٹ میچ اپ ڈیٹ',
      url: `${baseUrl}/en/cricket/live-scores`,
      topic: 'cricketScores',
      tag: `cricket-${match.id}`,
    };
    await this.broadcast(payload);
  }

  // Trigger immediate test alert for testing
  public async sendTestAlert(
    type: 'breakingNews' | 'cricketScores',
    endpoint?: string
  ): Promise<{ success: boolean; deliveredTo?: string }> {
    const payload: PushAlertPayload =
      type === 'cricketScores'
        ? {
            title: '🏏 CRICKET ALERT: Pakistan 169/1 (26.3 ov)',
            titleUr: '🏏 کرکٹ الرٹ: پاکستان 169/1 (26.3 اوورز) - فتح!',
            body: 'Babar Azam 35*, Saim Ayub 82. Pakistan defeated Australia by 9 wickets at MCG.',
            bodyUr: 'صائم ایوب 82، بابر اعظم 35۔ پاکستان نے آسٹریلیا کو 9 وکٹوں سے شکست دے دی۔',
            url: '/en/cricket/live-scores',
            topic: 'cricketScores',
            tag: `test-cricket-${Date.now()}`,
          }
        : {
            title: '🚨 BREAKING NEWS: PSX Reaches All-Time Record High',
            titleUr: '🚨 بریکنگ نیوز: پاکستان اسٹاک ایکسچینج تاریخی بلندی پر پہنچ گیا',
            body: 'KSE-100 benchmark index crosses key milestone with historic institutional inflows.',
            bodyUr: 'کے ایس ای 100 انڈیکس میں زبردست تیزی، مارکیٹ نے نیا تاریخی سنگِ میل عبور کر لیا۔',
            url: '/en/pakistan',
            topic: 'breakingNews',
            tag: `test-breaking-${Date.now()}`,
          };

    if (endpoint) {
      const sub = db.getPushSubscriptions().find((s) => s.endpoint === endpoint);
      if (sub) {
        const res = await this.sendPushToSubscription(sub, payload);
        return { success: res.success, deliveredTo: sub.id };
      }
    }

    const broadcastRes = await this.broadcast(payload);
    return { success: broadcastRes.totalAttempted > 0, deliveredTo: `${broadcastRes.successful} subscribers` };
  }
}

export const pushNotificationService = new PushNotificationService();
