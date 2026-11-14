/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Automated World News & Sports RSS Ingestion Provider
 * Fetches verified international & sports RSS headlines, deduplicates against DB,
 * and updates articles with source attribution (zero fabricated headlines).
 */

import crypto from 'crypto';
import { Article } from '../../../types/index.ts';
import { db } from '../../db.ts';

interface FeedSourceSpec {
  name: string;
  url: string;
  category: 'world' | 'sports';
  attributionEn: string;
  attributionUr: string;
  defaultImage: string;
  tags: string[];
}

const WORLD_NEWS_FEEDS: FeedSourceSpec[] = [
  {
    name: 'BBC World News RSS',
    url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    category: 'world',
    attributionEn: 'BBC News World Service',
    attributionUr: 'بی بی سی ورلڈ سروس',
    defaultImage: 'https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?auto=format&fit=crop&w=1200&q=80',
    tags: ['WorldNews', 'International', 'GlobalAffairs'],
  },
  {
    name: 'Al Jazeera English World RSS',
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
    category: 'world',
    attributionEn: 'Al Jazeera English',
    attributionUr: 'الجزیرہ انٹرنیشنل',
    defaultImage: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
    tags: ['WorldNews', 'Geopolitics', 'Breaking'],
  },
];

const SPORTS_NEWS_FEEDS: FeedSourceSpec[] = [
  {
    name: 'BBC Sport Cricket RSS',
    url: 'https://feeds.bbci.co.uk/sport/cricket/rss.xml',
    category: 'sports',
    attributionEn: 'BBC Sport Cricket',
    attributionUr: 'بی بی سی اسپورٹس کرکٹ',
    defaultImage: 'https://images.unsplash.com/photo-1531415074868-036b1c57e329?auto=format&fit=crop&w=1200&q=80',
    tags: ['Cricket', 'Sports', 'InternationalCricket'],
  },
  {
    name: 'BBC Sport Top Stories RSS',
    url: 'https://feeds.bbci.co.uk/sport/rss.xml',
    category: 'sports',
    attributionEn: 'BBC Sport',
    attributionUr: 'بی بی سی اسپورٹس',
    defaultImage: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=1200&q=80',
    tags: ['Sports', 'Athletics', 'Tournament'],
  },
];

interface ParsedRssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  imageUrl?: string;
}

function stripCdataAndHtml(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTag(block: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const m = block.match(regex);
  return m?.[1] ? stripCdataAndHtml(m[1]) : '';
}

function extractImageFromItem(block: string): string | undefined {
  const mediaMatch =
    block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i) ||
    block.match(/<media:content[^>]+url=["']([^"']+)["']/i) ||
    block.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
  if (mediaMatch?.[1] && mediaMatch[1].startsWith('http')) {
    return mediaMatch[1];
  }
  return undefined;
}

function parseRssXml(xml: string, limit: number = 6): ParsedRssItem[] {
  const items: ParsedRssItem[] = [];
  const itemMatches = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];

  for (const rawItem of itemMatches.slice(0, limit)) {
    const title = extractTag(rawItem, 'title');
    const link = extractTag(rawItem, 'link');
    const description = extractTag(rawItem, 'description') || extractTag(rawItem, 'summary');
    const pubDate = extractTag(rawItem, 'pubDate') || extractTag(rawItem, 'dc:date') || new Date().toISOString();
    const imageUrl = extractImageFromItem(rawItem);

    if (title && title.length >= 12) {
      items.push({ title, link, description, pubDate, imageUrl });
    }
  }
  return items;
}

function slugifyTitle(title: string, category: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 64);
  const shortHash = crypto.createHash('sha1').update(title).digest('hex').slice(0, 6);
  return `${category}-${base || 'update'}-${shortHash}`;
}

async function ingestFeeds(
  providerId: 'world-news-rss' | 'sports-news-rss',
  feeds: FeedSourceSpec[],
  labelEn: string,
  labelUr: string
): Promise<{
  success: boolean;
  changesDetected: boolean;
  changeSummaryEn: string;
  changeSummaryUr: string;
  itemsProcessed: number;
  error?: string;
}> {
  const provider = db.getDataProvider(providerId);
  const now = new Date().toISOString();
  const existingArticles = db.getData().articles || [];
  let addedCount = 0;
  let fetchedItemsTotal = 0;

  for (const feed of feeds) {
    try {
      const res = await fetch(feed.url, {
        headers: {
          Accept: 'application/rss+xml, application/xml, text/xml, */*',
          'User-Agent': '360Khabarnama-NewsBot/2.0',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;

      const xml = await res.text();
      const parsedItems = parseRssXml(xml, 5);
      fetchedItemsTotal += parsedItems.length;

      for (const item of parsedItems) {
        const slug = slugifyTitle(item.title, feed.category);
        const alreadyExists = existingArticles.some(
          a => a.slug === slug || a.titleEn.trim().toLowerCase() === item.title.trim().toLowerCase()
        );
        if (alreadyExists) continue;

        let publishedIso = now;
        const parsedDate = Date.parse(item.pubDate);
        if (!Number.isNaN(parsedDate)) {
          publishedIso = new Date(parsedDate).toISOString();
        }

        const summary =
          item.description && item.description.length > 15
            ? item.description
            : `${item.title}. Reported via ${feed.attributionEn}.`;

        const newArticle: Article = {
          id: `art-auto-${feed.category}-${Date.now()}-${addedCount}`,
          slug,
          titleEn: item.title,
          titleUr: `${feed.category === 'world' ? 'عالمی خبر' : 'کھیل و کرکٹ'}: ${item.title}`,
          summaryEn: summary.slice(0, 260),
          summaryUr: `${summary.slice(0, 220)} (${feed.attributionUr})`,
          contentEn: `${summary}\n\nSource Attribution: ${feed.attributionEn}${item.link ? `\nOriginal Report: ${item.link}` : ''}`,
          contentUr: `${summary}\n\nحوالہ: ${feed.attributionUr}`,
          category: feed.category,
          tags: feed.tags,
          author: {
            id: `auth-wire-${feed.category}`,
            nameEn: `${feed.attributionEn} Wire`,
            nameUr: `${feed.attributionUr} نیوز ڈیسک`,
            avatar: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=200&q=80',
            role: 'Automated Verified Wire',
          },
          publishedAt: publishedIso,
          updatedAt: now,
          views: 0,
          status: 'published',
          heroImage: item.imageUrl || feed.defaultImage,
          imageCaptionEn: `${item.title} (${feed.attributionEn})`,
          imageCaptionUr: feed.attributionUr,
          isBreaking: addedCount === 0,
          isFeatured: false,
          isTrending: addedCount < 2,
          readingTimeMin: 2,
        };

        db.upsertArticle(newArticle, 'Automated News Wire');
        addedCount++;
      }

      if (addedCount > 0) break;
    } catch (err) {
      console.warn(`[NewsFeedProvider:${providerId}] Feed ${feed.name} skipped:`, (err as any)?.message);
    }
  }

  db.updateDataProvider(providerId, {
    status: fetchedItemsTotal > 0 ? 'active' : 'degraded',
    lastSyncAt: now,
    lastError: fetchedItemsTotal > 0 ? null : `Could not reach upstream ${labelEn} RSS feeds.`,
    consecutiveFailures: fetchedItemsTotal > 0 ? 0 : (provider?.consecutiveFailures || 0) + 1,
    totalSyncs: (provider?.totalSyncs || 0) + 1,
    successfulSyncs: fetchedItemsTotal > 0 ? (provider?.successfulSyncs || 0) + 1 : (provider?.successfulSyncs || 0),
  });

  if (fetchedItemsTotal === 0) {
    return {
      success: false,
      changesDetected: false,
      changeSummaryEn: `${labelEn} RSS sync failed; existing published articles retained.`,
      changeSummaryUr: `${labelUr} فیڈ کی اپ ڈیٹ ناکام؛ موجودہ شائع شدہ خبریں برقرار ہیں۔`,
      itemsProcessed: 0,
      error: `Upstream ${labelEn} RSS unavailable`,
    };
  }

  return {
    success: true,
    changesDetected: addedCount > 0,
    changeSummaryEn:
      addedCount > 0
        ? `Ingested ${addedCount} new ${labelEn} stories from verified feeds.`
        : `Checked ${labelEn} feeds (${fetchedItemsTotal} items verified, no unseen stories).`,
    changeSummaryUr:
      addedCount > 0
        ? `تصدیق شدہ فیڈ سے ${addedCount} نئی ${labelUr} خبریں شامل ہو گئیں۔`
        : `${labelUr} فیڈ چیک کر لی گئی (${fetchedItemsTotal} خبریں تصدیق شدہ)۔`,
    itemsProcessed: fetchedItemsTotal,
  };
}

export async function syncWorldNewsFeed() {
  return ingestFeeds('world-news-rss', WORLD_NEWS_FEEDS, 'World News', 'عالمی خبریں');
}

export async function syncSportsNewsFeed() {
  return ingestFeeds('sports-news-rss', SPORTS_NEWS_FEEDS, 'Sports & Cricket News', 'کھیل و کرکٹ');
}
