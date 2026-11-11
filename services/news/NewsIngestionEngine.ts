/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Configurable News Source Registry & Ingestion Engine
 */

export interface NewsSourceConfig {
  id: string;
  name: string;
  url: string;
  type: 'official_gazette' | 'licensed_rss' | 'licensed_api' | 'institutional_feed';
  licenseType: 'public_domain' | 'licensed_syndication' | 'restricted';
  attributionText: string;
  categories: string[];
  language: 'en' | 'ur' | 'both';
  refreshIntervalMin: number;
  autoPublishAllowed: boolean;
  enabled: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
}

export interface IngestedNewsItem {
  sourceId: string;
  sourceName: string;
  attribution: string;
  titleEn: string;
  summaryEn: string;
  category: string;
  publishedAt: string;
  sourceUrl: string;
}

const defaultSources: NewsSourceConfig[] = [
  {
    id: 'src-pid-gov',
    name: 'Press Information Department (PID) Pakistan',
    url: 'https://pid.gov.pk/press-releases',
    type: 'official_gazette',
    licenseType: 'public_domain',
    attributionText: 'Press Information Department (PID), Government of Pakistan',
    categories: ['pakistan', 'politics'],
    language: 'en',
    refreshIntervalMin: 15,
    autoPublishAllowed: false, // Mode C human review by default for policy announcements
    enabled: true,
    lastSyncAt: null,
    lastError: null,
  },
  {
    id: 'src-sbp-notices',
    name: 'State Bank of Pakistan (SBP) Monetary & Circulars',
    url: 'https://www.sbp.org.pk/press/index.asp',
    type: 'institutional_feed',
    licenseType: 'public_domain',
    attributionText: 'State Bank of Pakistan (SBP)',
    categories: ['business'],
    language: 'en',
    refreshIntervalMin: 30,
    autoPublishAllowed: true,
    enabled: true,
    lastSyncAt: null,
    lastError: null,
  },
  {
    id: 'src-pcb-official',
    name: 'Pakistan Cricket Board (PCB) Official Media',
    url: 'https://www.pcb.com.pk/news',
    type: 'institutional_feed',
    licenseType: 'licensed_syndication',
    attributionText: 'Pakistan Cricket Board (PCB)',
    categories: ['sports'],
    language: 'en',
    refreshIntervalMin: 15,
    autoPublishAllowed: true,
    enabled: true,
    lastSyncAt: null,
    lastError: null,
  },
];

export class NewsIngestionEngine {
  private static sources: NewsSourceConfig[] = [...defaultSources];

  public static getSources(): NewsSourceConfig[] {
    return this.sources;
  }

  public static upsertSource(source: NewsSourceConfig): NewsSourceConfig {
    const idx = this.sources.findIndex(s => s.id === source.id);
    if (idx >= 0) {
      this.sources[idx] = { ...this.sources[idx], ...source };
      return this.sources[idx];
    }
    const created = { ...source, id: source.id || `src-${Date.now()}` };
    this.sources.push(created);
    return created;
  }

  public static markSourceSynced(sourceId: string, error: string | null = null) {
    const src = this.sources.find(s => s.id === sourceId);
    if (src) {
      src.lastSyncAt = new Date().toISOString();
      src.lastError = error;
    }
  }
}
