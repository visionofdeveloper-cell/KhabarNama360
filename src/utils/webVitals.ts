/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Lightweight Public Core Web Vitals Collector (LCP, INP, CLS, TTFB)
 * Strictly skips /admin routes and transmits non-PII numeric timings only.
 */

export interface CollectedVitalSample {
  name: 'LCP' | 'INP' | 'CLS' | 'TTFB';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  route: string;
}

function getRating(name: CollectedVitalSample['name'], value: number): CollectedVitalSample['rating'] {
  if (name === 'LCP') return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor';
  if (name === 'INP') return value <= 200 ? 'good' : value <= 500 ? 'needs-improvement' : 'poor';
  if (name === 'CLS') return value <= 0.1 ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor';
  return value <= 800 ? 'good' : value <= 1800 ? 'needs-improvement' : 'poor';
}

function sanitizeRoutePath(): string {
  if (typeof window === 'undefined') return '/';
  return (window.location.pathname || '/').slice(0, 120);
}

let initialized = false;

export function initWebVitalsReporter(): void {
  if (initialized || typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') {
    return;
  }
  const initialPath = sanitizeRoutePath();
  if (initialPath === '/admin' || initialPath.startsWith('/admin/')) {
    return;
  }
  initialized = true;

  const latestMetrics: Partial<Record<CollectedVitalSample['name'], CollectedVitalSample>> = {};
  let flushed = false;

  const recordMetric = (name: CollectedVitalSample['name'], rawValue: number) => {
    const route = sanitizeRoutePath();
    if (route === '/admin' || route.startsWith('/admin/')) return;
    if (!Number.isFinite(rawValue) || rawValue < 0) return;
    const value = name === 'CLS' ? Number(rawValue.toFixed(4)) : Math.round(rawValue);
    latestMetrics[name] = {
      name,
      value,
      rating: getRating(name, value),
      route,
    };
  };

  // TTFB from Navigation Timing
  try {
    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (navEntries && navEntries.length > 0) {
      const nav = navEntries[0];
      if (nav.responseStart > 0) {
        recordMetric('TTFB', nav.responseStart - (nav.requestStart || 0));
      }
    }
  } catch {}

  // LCP
  try {
    const lcpObserver = new PerformanceObserver(list => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
      if (last) {
        recordMetric('LCP', last.startTime);
      }
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {}

  // CLS
  let clsTotal = 0;
  try {
    const clsObserver = new PerformanceObserver(list => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & { hadRecentInput?: boolean; value?: number }>) {
        if (!entry.hadRecentInput && typeof entry.value === 'number') {
          clsTotal += entry.value;
        }
      }
      recordMetric('CLS', clsTotal);
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });
  } catch {}

  // INP approximation via max interaction duration
  let maxInp = 0;
  try {
    const inpObserver = new PerformanceObserver(list => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & { duration?: number; interactionId?: number }>) {
        if (entry.interactionId && typeof entry.duration === 'number' && entry.duration > maxInp) {
          maxInp = entry.duration;
          recordMetric('INP', maxInp);
        }
      }
    });
    inpObserver.observe({ type: 'event', buffered: true, durationThreshold: 40 } as PerformanceObserverInit);
  } catch {}

  const flushVitals = () => {
    if (flushed) return;
    const route = sanitizeRoutePath();
    if (route === '/admin' || route.startsWith('/admin/')) return;
    const samples = Object.values(latestMetrics);
    if (samples.length === 0) return;
    flushed = true;

    const payload = JSON.stringify({ samples });
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        if (navigator.sendBeacon('/api/metrics/vitals', blob)) {
          return;
        }
      }
      void fetch('/api/metrics/vitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    } catch {}
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushVitals();
    }
  });
  window.addEventListener('pagehide', flushVitals, { once: true });
}
