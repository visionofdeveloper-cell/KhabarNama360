/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Unified Bilingual Metadata & Hreflang Generator
 */

import { Article, Language } from '../../types/index.ts';

export interface UnifiedMetadata {
  title: string;
  description: string;
  canonicalUrl: string;
  robots: string;
  locale: 'en_PK' | 'ur_PK';
  direction: 'ltr' | 'rtl';
  hreflang: {
    en: string;
    ur: string;
    xDefault: string;
  };
  openGraph: {
    title: string;
    description: string;
    url: string;
    type: 'article' | 'website';
    image: string;
    siteName: string;
    locale: 'en_PK' | 'ur_PK';
  };
  twitter: {
    card: 'summary_large_image';
    title: string;
    description: string;
    image: string;
  };
}

export class MetadataGenerator {
  private static BASE_URL = (typeof process !== 'undefined' && process.env?.APP_URL) || 'https://360khabarnama.com';

  public static buildCanonicalUrl(path: string, lang: Language): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const normalized = cleanPath.replace(/^\/(en|ur)(\/|$)/, '/');
    return `${this.BASE_URL}/${lang}${normalized === '/' ? '' : normalized}`;
  }

  public static generateForArticle(article: Article, lang: Language): UnifiedMetadata {
    const slug = article.slug || article.id;
    const isUr = lang === 'ur';

    const title = isUr
      ? (article.seo?.metaTitleUr || `${article.titleUr} | 360 خبرنامہ`)
      : (article.seo?.metaTitleEn || `${article.titleEn} | 360Khabarnama`);

    const description = isUr
      ? (article.seo?.metaDescriptionUr || article.summaryUr || article.titleUr)
      : (article.seo?.metaDescriptionEn || article.summaryEn || article.titleEn);

    const canonicalUrl = article.seo?.canonicalUrl || `${this.BASE_URL}/${lang}/news/${slug}`;
    const robots = article.seo?.noIndex
      ? 'noindex, nofollow'
      : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

    const ogImage = article.seo?.ogImage || article.heroImage || `${this.BASE_URL}/assets/aistudio/Modern_Green_and_Gold_News_Logo_2e9a99d4.png`;

    return {
      title: title.slice(0, 70),
      description: description.slice(0, 160),
      canonicalUrl,
      robots,
      locale: isUr ? 'ur_PK' : 'en_PK',
      direction: isUr ? 'rtl' : 'ltr',
      hreflang: {
        en: `${this.BASE_URL}/en/news/${slug}`,
        ur: `${this.BASE_URL}/ur/news/${slug}`,
        xDefault: `${this.BASE_URL}/en/news/${slug}`,
      },
      openGraph: {
        title: title.slice(0, 70),
        description: description.slice(0, 160),
        url: canonicalUrl,
        type: 'article',
        image: ogImage,
        siteName: isUr ? '360 خبرنامہ' : '360Khabarnama',
        locale: isUr ? 'ur_PK' : 'en_PK',
      },
      twitter: {
        card: 'summary_large_image',
        title: title.slice(0, 70),
        description: description.slice(0, 160),
        image: ogImage,
      },
    };
  }

  public static generateForPage(params: {
    path: string;
    titleEn: string;
    titleUr: string;
    descriptionEn: string;
    descriptionUr: string;
    lang: Language;
    ogImage?: string;
    noIndex?: boolean;
  }): UnifiedMetadata {
    const isUr = params.lang === 'ur';
    const title = isUr ? params.titleUr : params.titleEn;
    const description = isUr ? params.descriptionUr : params.descriptionEn;
    const canonicalUrl = this.buildCanonicalUrl(params.path, params.lang);
    const ogImage = params.ogImage || `${this.BASE_URL}/assets/aistudio/Modern_Green_and_Gold_News_Logo_2e9a99d4.png`;

    return {
      title: title.slice(0, 70),
      description: description.slice(0, 160),
      canonicalUrl,
      robots: params.noIndex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large',
      locale: isUr ? 'ur_PK' : 'en_PK',
      direction: isUr ? 'rtl' : 'ltr',
      hreflang: {
        en: this.buildCanonicalUrl(params.path, 'en'),
        ur: this.buildCanonicalUrl(params.path, 'ur'),
        xDefault: this.buildCanonicalUrl(params.path, 'en'),
      },
      openGraph: {
        title: title.slice(0, 70),
        description: description.slice(0, 160),
        url: canonicalUrl,
        type: 'website',
        image: ogImage,
        siteName: isUr ? '360 خبرنامہ' : '360Khabarnama',
        locale: isUr ? 'ur_PK' : 'en_PK',
      },
      twitter: {
        card: 'summary_large_image',
        title: title.slice(0, 70),
        description: description.slice(0, 160),
        image: ogImage,
      },
    };
  }
}
