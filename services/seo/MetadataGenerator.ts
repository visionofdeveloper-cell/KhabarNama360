/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Server-Side Dynamic Metadata, Hreflang & JSON-LD Generator
 */

import { db } from '../../src/server/db.ts';
import { Article } from '../../src/types/index.ts';
import { SEOEngine } from './SEOEngine.ts';

export interface ResolvedHtmlMetadata {
  title: string;
  description: string;
  canonicalUrl: string;
  robots: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogType: string;
  hreflangEn: string;
  hreflangUr: string;
  hreflangDefault: string;
  lang: 'en' | 'ur';
  dir: 'ltr' | 'rtl';
  jsonLd?: Record<string, any>;
}

const escapeAttr = (val: string) =>
  String(val || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const escapeHtml = (val: string) =>
  String(val || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export class MetadataGenerator {
  public static resolveForPath(requestPath: string, preloadedArticle?: Article | null): ResolvedHtmlMetadata {
    const cleanPath = (requestPath || '/').split('?')[0];
    const data = db.getData();
    const settings = data.siteSettings;
    const baseUrl = (settings.siteUrl || process.env.APP_URL || 'https://www.360khabarnama.com').trim().replace(/\/+$/, '');
    const defaultOgImage = `${baseUrl}/assets/aistudio/Modern_Green_and_Gold_News_Logo_2e9a99d4.png`;

    // Private Admin isolation — always LTR & noindex
    if (cleanPath === '/admin' || cleanPath.startsWith('/admin/')) {
      return {
        title: `Private Admin OS — ${settings.siteNameEn || '360Khabarnama'}`,
        description: 'Authorized private editorial and system administration console for 360Khabarnama.',
        canonicalUrl: `${baseUrl}/admin`,
        robots: 'noindex, nofollow, noarchive',
        ogTitle: '360Khabarnama Private Admin',
        ogDescription: 'Authorized editorial management console.',
        ogImage: defaultOgImage,
        ogType: 'website',
        hreflangEn: `${baseUrl}/admin`,
        hreflangUr: `${baseUrl}/admin`,
        hreflangDefault: `${baseUrl}/admin`,
        lang: 'en',
        dir: 'ltr',
      };
    }

    const isEn = cleanPath === '/en' || cleanPath.startsWith('/en/');
    const lang: 'en' | 'ur' = isEn ? 'en' : 'ur';
    const dir: 'ltr' | 'rtl' = lang === 'ur' ? 'rtl' : 'ltr';
    const stripped = cleanPath.replace(/^\/(en|ur)(\/|$)/, '/').replace(/\/+$/, '') || '/';

    // Article route: /en/news/:slug or /ur/news/:slug
    const newsMatch = stripped.match(/^\/news\/([^/]+)$/);
    if (newsMatch) {
      const slug = decodeURIComponent(newsMatch[1]);
      const article = preloadedArticle || db.getArticleBySlugOrId(slug);
      if (article) {
        const meta = SEOEngine.generateArticleMetadata(article, lang);
        const jsonLd = SEOEngine.generateNewsArticleSchema(article, lang);
        return {
          title: meta.title,
          description: meta.description,
          canonicalUrl: meta.canonicalUrl,
          robots: meta.robots,
          ogTitle: meta.ogTitle,
          ogDescription: meta.ogDescription,
          ogImage: meta.ogImage,
          ogType: meta.ogType,
          hreflangEn: meta.hreflangEn,
          hreflangUr: meta.hreflangUr,
          hreflangDefault: meta.hreflangUr,
          lang,
          dir,
          jsonLd,
        };
      }
    }

    // Matching SEO Page Config
    const seoPages = db.getSeoPages();
    const matchedSeo = seoPages.find(p => p.path === stripped || p.path === cleanPath);
    if (matchedSeo) {
      const title = lang === 'ur' ? matchedSeo.titleUr || matchedSeo.titleEn : matchedSeo.titleEn;
      const desc = lang === 'ur' ? matchedSeo.metaDescUr || matchedSeo.metaDescEn : matchedSeo.metaDescEn;
      const subPath = stripped === '/' ? '' : stripped;
      return {
        title,
        description: desc,
        canonicalUrl: matchedSeo.canonicalUrl || `${baseUrl}/${lang}${subPath}`,
        robots: matchedSeo.robotsDirectives || settings.seoDefaults?.robotsDefault || 'index, follow',
        ogTitle: (lang === 'ur' ? matchedSeo.ogTitleUr : matchedSeo.ogTitleEn) || title,
        ogDescription: (lang === 'ur' ? matchedSeo.ogDescUr : matchedSeo.ogDescEn) || desc,
        ogImage: matchedSeo.ogImage || defaultOgImage,
        ogType: 'website',
        hreflangEn: matchedSeo.hreflangEn || `${baseUrl}/en${subPath}`,
        hreflangUr: matchedSeo.hreflangUr || `${baseUrl}/ur${subPath}`,
        hreflangDefault: `${baseUrl}/ur${subPath}`,
        lang,
        dir,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': matchedSeo.schemaType || 'WebPage',
          name: title,
          description: desc,
          url: `${baseUrl}/${lang}${subPath}`,
          inLanguage: lang === 'ur' ? 'ur-PK' : 'en-PK',
        },
      };
    }

    // Matching Universal Category Page
    const catSlug = stripped.replace(/^\//, '').split('/')[0];
    const catPage = db.getCategoryPages().find(c => c.slug === catSlug);
    if (catPage) {
      const title =
        lang === 'ur'
          ? catPage.seoTitleUr || `${catPage.nameUr} | ${settings.siteNameUr}`
          : catPage.seoTitleEn || `${catPage.nameEn} | ${settings.siteNameEn}`;
      const desc =
        lang === 'ur'
          ? catPage.metaDescUr || catPage.descriptionUr
          : catPage.metaDescEn || catPage.descriptionEn;
      return {
        title,
        description: desc,
        canonicalUrl: catPage.canonicalUrl || `${baseUrl}/${lang}/${catPage.slug}`,
        robots: catPage.robots || settings.seoDefaults?.robotsDefault || 'index, follow',
        ogTitle: title,
        ogDescription: desc,
        ogImage: catPage.ogImage || defaultOgImage,
        ogType: 'website',
        hreflangEn: `${baseUrl}/en/${catPage.slug}`,
        hreflangUr: `${baseUrl}/ur/${catPage.slug}`,
        hreflangDefault: `${baseUrl}/ur/${catPage.slug}`,
        lang,
        dir,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: title,
          description: desc,
          url: `${baseUrl}/${lang}/${catPage.slug}`,
          inLanguage: lang === 'ur' ? 'ur-PK' : 'en-PK',
        },
      };
    }

    // Homepage / Global Default
    const defaultTitle =
      lang === 'ur'
        ? `${settings.siteNameUr || '360 خبرنامہ'} | ${settings.taglineUr || 'تازہ ترین خبریں اور معلومات'}`
        : `${settings.siteNameEn || '360Khabarnama'} | ${settings.taglineEn || 'Pakistan Digital News & Utility Portal'}`;
    const defaultDesc =
      settings.seoDefaults?.defaultMetaDescEn ||
      "Pakistan's premier bilingual English & Urdu news, finance, live cricket, weather, education results, and utilities portal.";
    const subPath = stripped === '/' ? '' : stripped;

    return {
      title: defaultTitle,
      description: defaultDesc,
      canonicalUrl: `${baseUrl}${cleanPath === '/' ? '' : cleanPath}`,
      robots: settings.seoDefaults?.robotsDefault || 'index, follow, max-image-preview:large',
      ogTitle: defaultTitle,
      ogDescription: defaultDesc,
      ogImage: settings.seoDefaults?.defaultOgImage || defaultOgImage,
      ogType: 'website',
      hreflangEn: `${baseUrl}/en${subPath}`,
      hreflangUr: `${baseUrl}/ur${subPath}`,
      hreflangDefault: `${baseUrl}/ur${subPath}`,
      lang,
      dir,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'NewsMediaOrganization',
        name: '360Khabarnama',
        alternateName: '360 خبرنامہ',
        url: baseUrl,
        logo: defaultOgImage,
      },
    };
  }

  public static injectMetadataIntoHtml(html: string, requestPath: string, preloadedArticle?: Article | null): string {
    const meta = this.resolveForPath(requestPath, preloadedArticle);
    let out = html;

    // Update <html ...> lang & dir
    out = out.replace(
      /<html[^>]*>/i,
      `<html lang="${meta.lang}" dir="${meta.dir}">`
    );

    // Replace <title>...</title>
    out = out.replace(
      /<title>[\s\S]*?<\/title>/i,
      `<title>${escapeHtml(meta.title)}</title>`
    );

    // Replace existing meta description if present
    if (/<meta\s+name="description"/i.test(out)) {
      out = out.replace(
        /<meta\s+name="description"[^>]*>/i,
        `<meta name="description" content="${escapeAttr(meta.description)}" />`
      );
    }

    const settings = db.getData().siteSettings;
    const isAdminRoute = meta.canonicalUrl.endsWith('/admin');
    const gaId = (settings.googleAnalyticsId || '').trim();
    const gtmId = (settings.googleTagManagerId || '').trim();
    const bingCode = (settings.bingWebmasterVerification || '').trim();
    const gscCode = (settings.searchConsoleVerification || '').trim();

    const analyticsTags: string[] = [];
    if (gscCode && !out.includes('google-site-verification')) {
      analyticsTags.push(`<meta name="google-site-verification" content="${escapeAttr(gscCode)}" />`);
    }
    if (bingCode && !out.includes('msvalidate.01')) {
      analyticsTags.push(`<meta name="msvalidate.01" content="${escapeAttr(bingCode)}" />`);
    }
    if (!isAdminRoute) {
      if (/^GTM-[A-Z0-9]+$/i.test(gtmId) && !out.includes(gtmId)) {
        analyticsTags.push(
          `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${escapeAttr(gtmId)}');</script>`
        );
      }
      if (/^(G|UA|AW|DC)-[A-Z0-9-]+$/i.test(gaId) && !out.includes(gaId)) {
        const sendPageView = !/^GTM-[A-Z0-9]+$/i.test(gtmId);
        analyticsTags.push(
          `<script async src="https://www.googletagmanager.com/gtag/js?id=${escapeAttr(gaId)}"></script>` +
            `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${escapeAttr(gaId)}',{send_page_view:${sendPageView}});</script>`
        );
      }
    }

    const injectedHeadTags = [
      `<meta name="robots" content="${escapeAttr(meta.robots)}" />`,
      `<link rel="canonical" href="${escapeAttr(meta.canonicalUrl)}" />`,
      `<link rel="alternate" hreflang="en" href="${escapeAttr(meta.hreflangEn)}" />`,
      `<link rel="alternate" hreflang="ur" href="${escapeAttr(meta.hreflangUr)}" />`,
      `<link rel="alternate" hreflang="x-default" href="${escapeAttr(meta.hreflangDefault)}" />`,
      `<meta property="og:title" content="${escapeAttr(meta.ogTitle)}" />`,
      `<meta property="og:description" content="${escapeAttr(meta.ogDescription)}" />`,
      `<meta property="og:type" content="${escapeAttr(meta.ogType)}" />`,
      `<meta property="og:url" content="${escapeAttr(meta.canonicalUrl)}" />`,
      `<meta property="og:image" content="${escapeAttr(meta.ogImage)}" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${escapeAttr(meta.ogTitle)}" />`,
      `<meta name="twitter:description" content="${escapeAttr(meta.ogDescription)}" />`,
      ...analyticsTags,
      meta.jsonLd
        ? `<script type="application/ld+json">${JSON.stringify(meta.jsonLd)}</script>`
        : '',
    ]
      .filter(Boolean)
      .join('\n    ');

    out = out.replace('</head>', `    ${injectedHeadTags}\n  </head>`);
    return out;
  }
}
