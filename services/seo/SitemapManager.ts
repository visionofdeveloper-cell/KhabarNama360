/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Dynamic XML Sitemap & Robots.txt Manager
 */

import { db } from '../../src/server/db.ts';

const escapeXml = (str: string) =>
  String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export class SitemapManager {
  public static getBaseUrl(): string {
    return (process.env.APP_URL || 'https://360khabarnama.com').replace(/\/+$/, '');
  }

  public static buildMainSitemapXml(): string {
    const baseUrl = this.getBaseUrl();
    const config = db.getSitemapConfig();
    const excluded = new Set((config.excludedPaths || []).map(p => p.trim()));
    const articles = db.getData().articles.filter(a => a.status === 'published' && !a.seo?.noIndex);
    const categories = db.getCategoryPages().filter(c => c.enabled && c.status === 'published');

    const staticPaths = ['', '/about', '/contact', '/editorial-policy', '/privacy-policy', '/terms'];
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"${
      config.includeImages ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : ''
    }>\n`;

    const emitBilingualUrl = (subPath: string, priority: string, changefreq: string, lastmod?: string, image?: string) => {
      if (excluded.has(subPath) || excluded.has(`/en${subPath}`) || excluded.has(`/ur${subPath}`)) return;
      for (const lang of ['ur', 'en'] as const) {
        const loc = `${baseUrl}/${lang}${subPath}`;
        xml += `  <url>\n`;
        xml += `    <loc>${escapeXml(loc)}</loc>\n`;
        if (lastmod) xml += `    <lastmod>${escapeXml(lastmod)}</lastmod>\n`;
        xml += `    <changefreq>${changefreq}</changefreq>\n`;
        xml += `    <priority>${priority}</priority>\n`;
        xml += `    <xhtml:link rel="alternate" hreflang="en" href="${escapeXml(`${baseUrl}/en${subPath}`)}" />\n`;
        xml += `    <xhtml:link rel="alternate" hreflang="ur" href="${escapeXml(`${baseUrl}/ur${subPath}`)}" />\n`;
        if (config.includeImages && image && image.startsWith('http')) {
          xml += `    <image:image><image:loc>${escapeXml(image)}</image:loc></image:image>\n`;
        }
        xml += `  </url>\n`;
      }
    };

    // Root + static pages
    for (const sp of staticPaths) {
      emitBilingualUrl(sp, sp === '' ? '1.0' : '0.6', sp === '' ? 'hourly' : config.defaultChangefreq);
    }

    // Categories
    if (config.includeCategories) {
      for (const cat of categories) {
        emitBilingualUrl(`/${cat.slug}`, '0.8', 'hourly');
      }
    }

    // Published Articles
    for (const art of articles) {
      const slug = art.slug || art.id;
      const lastmod = (art.updatedAt || art.publishedAt || new Date().toISOString()).split('T')[0];
      emitBilingualUrl(`/news/${slug}`, '0.9', config.defaultChangefreq || 'daily', lastmod, art.heroImage);
    }

    xml += `</urlset>`;
    return xml;
  }

  public static buildNewsSitemapXml(): string {
    const baseUrl = this.getBaseUrl();
    const cutoff = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const recent = db.getData().articles.filter(
      a => a.status === 'published' && !a.seo?.noIndex && a.publishedAt >= cutoff
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

  public static getRobotsTxt(): string {
    const baseUrl = this.getBaseUrl();
    return db.getRobotsTxt().replace(/https:\/\/360khabarnama\.com/g, baseUrl);
  }
}
