/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Dynamic XML Sitemap & Robots.txt Manager
 */

import { db } from '../../src/server/db.ts';
import { Article } from '../../src/types/index.ts';

const escapeXml = (str: string) =>
  String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

function isArticlePubliclyIndexable(article: Article, nowMs: number): boolean {
  if (article.status !== 'published' || article.seo?.noIndex) return false;
  const sched = article.scheduledAt || article.scheduledFor;
  if (sched) {
    const schedMs = new Date(sched).getTime();
    if (!Number.isNaN(schedMs) && schedMs > nowMs) return false;
  }
  return true;
}

export class SitemapManager {
  public static getBaseUrl(): string {
    const configured = db.getData().siteSettings?.siteUrl;
    return (configured || process.env.APP_URL || 'https://www.360khabarnama.com').trim().replace(/\/+$/, '');
  }

  public static buildSitemapIndexXml(): string {
    const baseUrl = this.getBaseUrl();
    const today = new Date().toISOString();
    const sitemaps = [
      `${baseUrl}/sitemap.xml`,
      `${baseUrl}/news-sitemap.xml`,
      `${baseUrl}/image-sitemap.xml`,
      `${baseUrl}/video-sitemap.xml`,
    ];
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    for (const loc of sitemaps) {
      xml += `  <sitemap>\n`;
      xml += `    <loc>${escapeXml(loc)}</loc>\n`;
      xml += `    <lastmod>${escapeXml(today)}</lastmod>\n`;
      xml += `  </sitemap>\n`;
    }
    xml += `</sitemapindex>`;
    return xml;
  }

  public static buildMainSitemapXml(): string {
    const baseUrl = this.getBaseUrl();
    const config = db.getSitemapConfig();
    const nowMs = Date.now();
    const excluded = new Set((config.excludedPaths || []).map(p => p.trim()));
    const articles = db.getData().articles.filter(a => isArticlePubliclyIndexable(a, nowMs));
    const categories = db.getCategoryPages().filter(c => c.enabled && c.status === 'published');

    const staticPaths = ['', '/about', '/contact', '/editorial-policy', '/privacy-policy', '/terms'];
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"${
      config.includeImages ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : ''
    }>\n`;

    const emitBilingualUrl = (subPath: string, priority: string, changefreq: string, lastmod?: string, image?: string) => {
      if (excluded.has(subPath) || excluded.has(`/en${subPath}`) || excluded.has(`/ur${subPath}`)) return;
      const absImage = image && image.startsWith('/') ? `${baseUrl}${image}` : image;
      for (const lang of ['ur', 'en'] as const) {
        const loc = `${baseUrl}/${lang}${subPath}`;
        xml += `  <url>\n`;
        xml += `    <loc>${escapeXml(loc)}</loc>\n`;
        if (lastmod) xml += `    <lastmod>${escapeXml(lastmod)}</lastmod>\n`;
        xml += `    <changefreq>${changefreq}</changefreq>\n`;
        xml += `    <priority>${priority}</priority>\n`;
        xml += `    <xhtml:link rel="alternate" hreflang="en" href="${escapeXml(`${baseUrl}/en${subPath}`)}" />\n`;
        xml += `    <xhtml:link rel="alternate" hreflang="ur" href="${escapeXml(`${baseUrl}/ur${subPath}`)}" />\n`;
        if (config.includeImages && absImage && absImage.startsWith('http')) {
          xml += `    <image:image><image:loc>${escapeXml(absImage)}</image:loc></image:image>\n`;
        }
        xml += `  </url>\n`;
      }
    };

    for (const sp of staticPaths) {
      emitBilingualUrl(sp, sp === '' ? '1.0' : '0.6', sp === '' ? 'hourly' : config.defaultChangefreq);
    }

    if (config.includeCategories) {
      for (const cat of categories) {
        emitBilingualUrl(`/${cat.slug}`, '0.8', 'hourly');
      }
    }

    for (const art of articles) {
      const slug = art.slug || art.id;
      const lastmod = (art.updatedAt || art.publishedAt || new Date().toISOString()).split('T')[0];
      emitBilingualUrl(`/news/${slug}`, '0.9', config.defaultChangefreq || 'daily', lastmod, art.heroImage || art.featuredImage);
    }

    xml += `</urlset>`;
    return xml;
  }

  public static buildNewsSitemapXml(): string {
    const baseUrl = this.getBaseUrl();
    const nowMs = Date.now();
    const cutoff = new Date(nowMs - 48 * 3600 * 1000).toISOString();
    const recent = db.getData().articles.filter(
      a => isArticlePubliclyIndexable(a, nowMs) && a.publishedAt >= cutoff
    );

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n`;

    for (const art of recent) {
      const pubDate = new Date(art.publishedAt).toISOString();
      const slug = art.slug || art.id;

      xml += `  <url>\n`;
      xml += `    <loc>${escapeXml(`${baseUrl}/en/news/${slug}`)}</loc>\n`;
      xml += `    <news:news>\n`;
      xml += `      <news:publication><news:name>360Khabarnama</news:name><news:language>en</news:language></news:publication>\n`;
      xml += `      <news:publication_date>${pubDate}</news:publication_date>\n`;
      xml += `      <news:title><![CDATA[${art.titleEn}]]></news:title>\n`;
      xml += `    </news:news>\n`;
      xml += `  </url>\n`;

      xml += `  <url>\n`;
      xml += `    <loc>${escapeXml(`${baseUrl}/ur/news/${slug}`)}</loc>\n`;
      xml += `    <news:news>\n`;
      xml += `      <news:publication><news:name>360 خبرنامہ</news:name><news:language>ur</news:language></news:publication>\n`;
      xml += `      <news:publication_date>${pubDate}</news:publication_date>\n`;
      xml += `      <news:title><![CDATA[${art.titleUr}]]></news:title>\n`;
      xml += `    </news:news>\n`;
      xml += `  </url>\n`;
    }

    xml += `</urlset>`;
    return xml;
  }

  public static buildImageSitemapXml(): string {
    const baseUrl = this.getBaseUrl();
    const nowMs = Date.now();
    const articles = db.getData().articles.filter(a => isArticlePubliclyIndexable(a, nowMs));

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

    for (const art of articles) {
      const slug = art.slug || art.id;
      const imgs = Array.from(
        new Set(
          [art.heroImage, art.featuredImage, art.socialImageUrl]
            .filter((u): u is string => Boolean(u && u.trim()))
            .map(u => (u.startsWith('/') ? `${baseUrl}${u}` : u))
            .filter(u => u.startsWith('http'))
        )
      );
      if (imgs.length === 0) continue;

      for (const lang of ['en', 'ur'] as const) {
        xml += `  <url>\n`;
        xml += `    <loc>${escapeXml(`${baseUrl}/${lang}/news/${slug}`)}</loc>\n`;
        for (const imgUrl of imgs) {
          const title = lang === 'ur' ? art.titleUr : art.titleEn;
          const caption = lang === 'ur'
            ? (art.heroImageMeta?.captionUr || art.imageCaptionUr || art.summaryUr)
            : (art.heroImageMeta?.captionEn || art.imageCaptionEn || art.summaryEn);
          xml += `    <image:image>\n`;
          xml += `      <image:loc>${escapeXml(imgUrl)}</image:loc>\n`;
          if (title) xml += `      <image:title>${escapeXml(title)}</image:title>\n`;
          if (caption) xml += `      <image:caption>${escapeXml(caption.slice(0, 220))}</image:caption>\n`;
          xml += `    </image:image>\n`;
        }
        xml += `  </url>\n`;
      }
    }

    xml += `</urlset>`;
    return xml;
  }

  public static buildVideoSitemapXml(): string {
    const baseUrl = this.getBaseUrl();
    const nowMs = Date.now();
    const videoArticles = db.getData().articles.filter(
      a => isArticlePubliclyIndexable(a, nowMs) && Boolean(a.videoUrl && a.videoUrl.trim())
    );

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n`;

    for (const art of videoArticles) {
      const slug = art.slug || art.id;
      const thumbRaw = art.featuredImage || art.heroImage || `${baseUrl}/assets/aistudio/Modern_Green_and_Gold_News_Logo_2e9a99d4.png`;
      const thumb = thumbRaw.startsWith('/') ? `${baseUrl}${thumbRaw}` : thumbRaw;
      const videoLoc = art.videoUrl!.startsWith('/') ? `${baseUrl}${art.videoUrl}` : art.videoUrl!;
      const pubDate = new Date(art.publishedAt || Date.now()).toISOString();

      xml += `  <url>\n`;
      xml += `    <loc>${escapeXml(`${baseUrl}/en/news/${slug}`)}</loc>\n`;
      xml += `    <video:video>\n`;
      xml += `      <video:thumbnail_loc>${escapeXml(thumb)}</video:thumbnail_loc>\n`;
      xml += `      <video:title>${escapeXml(art.titleEn)}</video:title>\n`;
      xml += `      <video:description>${escapeXml((art.summaryEn || art.titleEn).slice(0, 500))}</video:description>\n`;
      xml += `      <video:content_loc>${escapeXml(videoLoc)}</video:content_loc>\n`;
      xml += `      <video:publication_date>${escapeXml(pubDate)}</video:publication_date>\n`;
      xml += `    </video:video>\n`;
      xml += `  </url>\n`;
    }

    xml += `</urlset>`;
    return xml;
  }

  public static getRobotsTxt(): string {
    const baseUrl = this.getBaseUrl();
    return db
      .getRobotsTxt()
      .replace(/https:\/\/(?:www\.)?360khabarnama\.com/g, baseUrl);
  }

  public static async submitIndexNow(
    urls: string[],
    overrideKey?: string
  ): Promise<{
    ok: boolean;
    status: number;
    submittedUrls: number;
    message: string;
  }> {
    const baseUrl = this.getBaseUrl();
    const settings = db.getData().siteSettings;
    const key = (overrideKey || settings.indexNowKey || '').trim();
    if (!key) {
      return {
        ok: false,
        status: 400,
        submittedUrls: 0,
        message: 'IndexNow API key is not configured in Global Settings > Integrations.',
      };
    }

    const host = new URL(baseUrl).host;
    const validUrls = urls
      .map(u => u.trim())
      .filter(Boolean)
      .map(u => (u.startsWith('/') ? `${baseUrl}${u}` : u))
      .slice(0, 100);

    if (validUrls.length === 0) {
      return {
        ok: false,
        status: 400,
        submittedUrls: 0,
        message: 'Provide at least one valid URL to submit to IndexNow.',
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const resp = await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          host,
          key,
          keyLocation: `${baseUrl}/${key}.txt`,
          urlList: validUrls,
        }),
        signal: controller.signal,
      });
      const ok = resp.status >= 200 && resp.status < 300;
      return {
        ok,
        status: resp.status,
        submittedUrls: validUrls.length,
        message: ok
          ? `Submitted ${validUrls.length} URL(s) to IndexNow (HTTP ${resp.status}).`
          : `IndexNow returned HTTP ${resp.status}. Verify ${baseUrl}/${key}.txt is reachable publicly.`,
      };
    } catch (err: any) {
      return {
        ok: false,
        status: 502,
        submittedUrls: 0,
        message: err?.message || 'Failed to reach api.indexnow.org',
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
