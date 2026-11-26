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

  public static injectMetadataIntoHtml(
    html: string,
    requestPath: string,
    preloadedArticle?: Article | null,
    requestHost?: string
  ): string {
    const cleanPath = (requestPath || '/').split('?')[0];
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
    const gi = settings.googleIntegrations;
    const isAdminRoute = cleanPath === '/admin' || cleanPath.startsWith('/admin/');
    const bingCode = (settings.bingWebmasterVerification || '').trim();
    const gscCode = (gi?.searchConsole?.verificationCode || settings.searchConsoleVerification || '').trim();

    const rawGa = (gi?.analytics?.measurementId ?? settings.googleAnalyticsId ?? '').trim().toUpperCase();
    const gaId =
      rawGa === 'G-KHABAR360' || rawGa === 'G-PAKPORTAL2026' || !/^G-[A-Z0-9]{6,16}$/.test(rawGa)
        ? ''
        : rawGa;
    const rawGtm = (gi?.tagManager?.containerId ?? settings.googleTagManagerId ?? '').trim().toUpperCase();
    const gtmId = /^GTM-[A-Z0-9]{4,14}$/.test(rawGtm) ? rawGtm : '';

    const gaEnabled = Boolean((gi?.analytics?.enabled ?? Boolean(gaId)) && gaId);
    const gtmEnabled = Boolean((gi?.tagManager?.enabled ?? Boolean(gtmId)) && gtmId);
    const excludeAdmin = gi?.analytics?.excludeAdmin ?? gi?.tagManager?.excludeAdmin ?? true;
    const excludeStaging = Boolean(gi?.analytics?.excludeStaging);
    const consentModeEnabled = gi?.tagManager?.consentModeEnabled ?? true;
    const debugMode = Boolean(gi?.analytics?.debugMode);
    const anonymizeIp = gi?.analytics?.anonymizeIp ?? true;
    const trackEnhancedEvents = gi?.analytics?.trackEnhancedEvents ?? true;

    let trackingMode: 'gtm' | 'direct_gtag' | 'disabled' =
      gi?.analytics?.trackingMode || (gtmEnabled ? 'gtm' : gaEnabled ? 'direct_gtag' : 'disabled');
    if (trackingMode === 'gtm' && !gtmEnabled) {
      trackingMode = gaEnabled ? 'direct_gtag' : 'disabled';
    } else if (trackingMode === 'direct_gtag' && !gaEnabled) {
      trackingMode = gtmEnabled ? 'gtm' : 'disabled';
    }

    const cleanHost = String(requestHost || '').toLowerCase().split(':')[0].trim();
    const isStagingHost =
      Boolean(cleanHost) &&
      (cleanHost === 'localhost' ||
        cleanHost === '127.0.0.1' ||
        cleanHost === '0.0.0.0' ||
        (cleanHost.endsWith('.vercel.app') && cleanHost !== 'www.360khabarnama.com'));

    const shouldInjectTrackers =
      trackingMode !== 'disabled' &&
      !(isAdminRoute && excludeAdmin) &&
      !(isStagingHost && excludeStaging);

    const analyticsTags: string[] = [];
    if (!isAdminRoute && gscCode && !out.includes('google-site-verification')) {
      analyticsTags.push(`<meta name="google-site-verification" content="${escapeAttr(gscCode)}" />`);
    }
    if (!isAdminRoute && bingCode && !out.includes('msvalidate.01')) {
      analyticsTags.push(`<meta name="msvalidate.01" content="${escapeAttr(bingCode)}" />`);
    }

    const safeBootstrapJson = JSON.stringify({
      ga4Enabled: gaEnabled,
      ga4MeasurementId: gaId,
      gtmEnabled,
      gtmContainerId: gtmId,
      trackingMode: shouldInjectTrackers ? trackingMode : 'disabled',
      anonymizeIp,
      debugMode,
      excludeAdmin,
      excludeStaging,
      isStagingHost,
      activeOnRequest: shouldInjectTrackers,
      consentBannerEnabled: settings.consentBannerEnabled ?? true,
      consentModeEnabled,
      trackEnhancedEvents,
    }).replace(/</g, '\\u003c');

    if (!(isAdminRoute && excludeAdmin)) {
      analyticsTags.push(`<script>window.__360KN_TRACKING__=${safeBootstrapJson};</script>`);
    }

    let gtmBodyNoscript = '';

    if (shouldInjectTrackers) {
      // Google Consent Mode v2 Default MUST execute before GTM / gtag.js
      if (consentModeEnabled) {
        analyticsTags.push(
          `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}try{var _c=JSON.parse(localStorage.getItem('360khabarnama_consent')||'null');var _ag=!!(_c&&_c.analytics);var _ad=!!(_c&&_c.advertising);gtag('consent','default',{analytics_storage:_ag?'granted':'denied',ad_storage:_ad?'granted':'denied',ad_user_data:_ad?'granted':'denied',ad_personalization:_ad?'granted':'denied',wait_for_update:500});}catch(_e){gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',wait_for_update:500});}</script>`
        );
      }

      if (trackingMode === 'gtm' && gtmId && !out.includes(`gtm.js?id=${gtmId}`)) {
        // GTM-managed mode: inject GTM <head> + <body> <noscript> ONLY (no duplicate direct gtag.js!)
        analyticsTags.push(
          `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${escapeAttr(gtmId)}');</script>`
        );
        if (!out.includes(`ns.html?id=${gtmId}`)) {
          gtmBodyNoscript = `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${escapeAttr(gtmId)}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`;
        }
      } else if (trackingMode === 'direct_gtag' && gaId && !out.includes(`gtag/js?id=${gaId}`)) {
        // Direct gtag.js mode: send_page_view:false so React SPA tracker emits single deduplicated page_view per view
        analyticsTags.push(
          `<script async src="https://www.googletagmanager.com/gtag/js?id=${escapeAttr(gaId)}"></script>` +
            `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${escapeAttr(gaId)}',{send_page_view:false,anonymize_ip:${anonymizeIp}${debugMode ? ',debug_mode:true' : ''}});</script>`
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
    if (gtmBodyNoscript) {
      out = out.replace(/<body([^>]*)>/i, `<body$1>\n    ${gtmBodyNoscript}`);
    }
    return out;
  }
}
