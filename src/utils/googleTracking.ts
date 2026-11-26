/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Unified Client-Side Google Analytics 4 & Tag Manager Tracker
 *
 * Strictly enforces:
 * - Single tracking mode (GTM dataLayer OR direct gtag.js — never both)
 * - Zero tracking inside /admin & /admin/*
 * - Google Consent Mode v2 integration with CookieConsent.tsx
 * - Deduplicated SPA route & bilingual page_view tracking (StrictMode-safe)
 */

export type ClientTrackingMode = 'gtm' | 'direct_gtag' | 'disabled';

export interface ClientTrackingConfig {
  ga4Enabled: boolean;
  ga4MeasurementId: string;
  gtmEnabled: boolean;
  gtmContainerId: string;
  trackingMode: ClientTrackingMode;
  anonymizeIp: boolean;
  debugMode: boolean;
  excludeAdmin: boolean;
  excludeStaging: boolean;
  isStagingHost: boolean;
  activeOnRequest: boolean;
  consentBannerEnabled: boolean;
  consentModeEnabled: boolean;
  trackEnhancedEvents: boolean;
}

declare global {
  interface Window {
    __360KN_TRACKING__?: ClientTrackingConfig;
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

const DEFAULT_TRACKING_CONFIG: ClientTrackingConfig = {
  ga4Enabled: false,
  ga4MeasurementId: '',
  gtmEnabled: false,
  gtmContainerId: '',
  trackingMode: 'disabled',
  anonymizeIp: true,
  debugMode: false,
  excludeAdmin: true,
  excludeStaging: false,
  isStagingHost: false,
  activeOnRequest: false,
  consentBannerEnabled: true,
  consentModeEnabled: true,
  trackEnhancedEvents: true,
};

let lastPageViewKey = '';
let lastPageViewTimestamp = 0;
const PAGEVIEW_DEDUPE_WINDOW_MS = 1500;
let outboundListenerAttached = false;

export function isAdminContext(pathname?: string): boolean {
  if (typeof window === 'undefined') return false;
  const host = (window.location.hostname || '').toLowerCase();
  if (host.startsWith('admin.')) return true;
  const p = (pathname ?? window.location.pathname ?? '/').replace(/\/+$/, '') || '/';
  if (p === '/admin' || p.startsWith('/admin/')) return true;
  const hash = window.location.hash || '';
  if (hash === '#/admin' || hash.startsWith('#/admin/')) return true;
  return false;
}

function ensureDataLayerAndGtag(): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag() {
      // Push exact Arguments object required by gtag.js & GTM Consent Mode v2
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
  }
}

export function getTrackingConfig(): ClientTrackingConfig {
  if (typeof window === 'undefined') return DEFAULT_TRACKING_CONFIG;
  const bootstrap = window.__360KN_TRACKING__;
  if (!bootstrap) return DEFAULT_TRACKING_CONFIG;
  return {
    ...DEFAULT_TRACKING_CONFIG,
    ...bootstrap,
  };
}

function isTrackingAllowedNow(cfg: ClientTrackingConfig, pathname?: string): boolean {
  if (typeof window === 'undefined') return false;
  if (cfg.trackingMode === 'disabled' || !cfg.activeOnRequest) return false;
  if (cfg.excludeAdmin && isAdminContext(pathname)) return false;
  if (cfg.excludeStaging && cfg.isStagingHost) return false;
  if (cfg.trackingMode === 'gtm' && !cfg.gtmContainerId) return false;
  if (cfg.trackingMode === 'direct_gtag' && !cfg.ga4MeasurementId) return false;
  return true;
}

export async function refreshTrackingConfig(): Promise<ClientTrackingConfig> {
  if (typeof window === 'undefined') return DEFAULT_TRACKING_CONFIG;
  try {
    const res = await fetch('/api/public/tracking-config', { credentials: 'same-origin' });
    if (!res.ok) return getTrackingConfig();
    const json = await res.json();
    if (json?.success && json?.tracking) {
      window.__360KN_TRACKING__ = {
        ...DEFAULT_TRACKING_CONFIG,
        ...json.tracking,
      };
    }
  } catch {
    // Preserve SSR-bootstrapped config on transient network failure
  }
  return getTrackingConfig();
}

export function updateGoogleConsent(consent: { analytics: boolean; advertising: boolean }): void {
  if (typeof window === 'undefined') return;
  const cfg = getTrackingConfig();
  if (cfg.excludeAdmin && isAdminContext()) return;
  ensureDataLayerAndGtag();
  const analyticsState = consent.analytics ? 'granted' : 'denied';
  const adState = consent.advertising ? 'granted' : 'denied';
  try {
    window.gtag?.('consent', 'update', {
      analytics_storage: analyticsState,
      ad_storage: adState,
      ad_user_data: adState,
      ad_personalization: adState,
    });
    if (cfg.trackingMode === 'gtm') {
      window.dataLayer?.push({
        event: 'consent_preference_updated',
        analytics_storage: analyticsState,
        ad_storage: adState,
      });
    }
  } catch {
    // Non-blocking
  }
}

export interface PageViewPayload {
  path: string;
  title: string;
  language: 'en' | 'ur';
  routeType: string;
  articleSlug?: string | null;
  category?: string;
}

export function trackPageView(payload: PageViewPayload): boolean {
  if (typeof window === 'undefined') return false;
  const cfg = getTrackingConfig();
  if (!isTrackingAllowedNow(cfg, payload.path)) return false;

  const cleanPath = payload.path || window.location.pathname || '/';
  const dedupeKey = `${cleanPath}|${payload.language}|${payload.articleSlug || ''}`;
  const now = Date.now();
  if (dedupeKey === lastPageViewKey && now - lastPageViewTimestamp < PAGEVIEW_DEDUPE_WINDOW_MS) {
    return false;
  }
  lastPageViewKey = dedupeKey;
  lastPageViewTimestamp = now;

  ensureDataLayerAndGtag();

  const eventParams: Record<string, any> = {
    page_path: cleanPath,
    page_location: window.location.href,
    page_title: payload.title || document.title,
    content_language: payload.language,
    page_type: payload.routeType,
  };
  if (payload.articleSlug) eventParams.article_slug = payload.articleSlug;
  if (payload.category) eventParams.article_category = payload.category;

  if (cfg.trackingMode === 'gtm') {
    window.dataLayer!.push({
      event: 'page_view',
      ...eventParams,
    });
    return true;
  }

  if (cfg.trackingMode === 'direct_gtag' && cfg.ga4MeasurementId) {
    window.gtag!('event', 'page_view', {
      ...eventParams,
      send_to: cfg.ga4MeasurementId,
    });
    return true;
  }

  return false;
}

export function trackGoogleEvent(
  eventName: string,
  params: Record<string, any> = {},
  options?: { isEnhanced?: boolean }
): boolean {
  if (typeof window === 'undefined' || !eventName) return false;
  const cfg = getTrackingConfig();
  if (!isTrackingAllowedNow(cfg)) return false;
  if (options?.isEnhanced && !cfg.trackEnhancedEvents) return false;

  ensureDataLayerAndGtag();

  const cleanParams: Record<string, any> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) {
      cleanParams[k] = v;
    }
  }

  if (cfg.trackingMode === 'gtm') {
    window.dataLayer!.push({
      event: eventName,
      ...cleanParams,
    });
    return true;
  }

  if (cfg.trackingMode === 'direct_gtag' && cfg.ga4MeasurementId) {
    window.gtag!('event', eventName, {
      ...cleanParams,
      send_to: cfg.ga4MeasurementId,
    });
    return true;
  }

  return false;
}

export function attachOutboundLinkTracker(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};
  if (outboundListenerAttached) return () => {};

  const handleClick = (ev: MouseEvent) => {
    const cfg = getTrackingConfig();
    if (!isTrackingAllowedNow(cfg) || !cfg.trackEnhancedEvents) return;
    const target = ev.target as HTMLElement | null;
    const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!anchor) return;
    const href = anchor.getAttribute('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    try {
      const url = new URL(anchor.href, window.location.origin);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
      const currentHost = window.location.hostname.replace(/^www\./, '').toLowerCase();
      const destHost = url.hostname.replace(/^www\./, '').toLowerCase();
      if (!destHost || destHost === currentHost) return;
      trackGoogleEvent(
        'outbound_click',
        {
          link_url: url.href,
          link_domain: url.hostname,
          link_text: (anchor.textContent || '').trim().slice(0, 80) || undefined,
          page_path: window.location.pathname,
          content_language: document.documentElement.lang === 'ur' ? 'ur' : 'en',
        },
        { isEnhanced: true }
      );
    } catch {
      // Ignore malformed hrefs
    }
  };

  document.addEventListener('click', handleClick, { passive: true });
  outboundListenerAttached = true;

  return () => {
    document.removeEventListener('click', handleClick);
    outboundListenerAttached = false;
  };
}
