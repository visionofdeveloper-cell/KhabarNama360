/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Khabarnama360 — Google-Compatible JSON-LD Schema Generator
 */

import { Article, Language } from '../../types/index.ts';

export class SchemaGenerator {
  private static BASE_URL = (typeof process !== 'undefined' && process.env?.APP_URL) || 'https://khabarnama360.com';

  public static generateOrganizationSchema(lang: Language = 'en'): Record<string, any> {
    return {
      '@context': 'https://schema.org',
      '@type': 'NewsMediaOrganization',
      name: lang === 'ur' ? 'خبرنامہ 360' : 'Khabarnama360',
      url: this.BASE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${this.BASE_URL}/assets/aistudio/logo_eb8cb81a.jpg`,
      },
      sameAs: [
        'https://www.facebook.com/khabarnama360',
        'https://twitter.com/khabarnama360',
      ],
    };
  }

  public static generateWebSiteSchema(lang: Language = 'en'): Record<string, any> {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: lang === 'ur' ? 'خبرنامہ 360' : 'Khabarnama360',
      url: `${this.BASE_URL}/${lang}`,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${this.BASE_URL}/${lang}/search?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    };
  }

  public static generateArticleSchema(
    article: Article,
    lang: Language,
    type: 'NewsArticle' | 'Article' | 'BlogPosting' = 'NewsArticle'
  ): Record<string, any> {
    const isUr = lang === 'ur';
    const slug = article.slug || article.id;
    const url = `${this.BASE_URL}/${lang}/news/${slug}`;

    return {
      '@context': 'https://schema.org',
      '@type': type,
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': url,
      },
      headline: (isUr ? article.titleUr : article.titleEn).slice(0, 110),
      description: isUr ? article.summaryUr : article.summaryEn,
      image: article.heroImage ? [article.heroImage] : [],
      datePublished: article.publishedAt,
      dateModified: article.updatedAt || article.publishedAt,
      author: {
        '@type': 'Person',
        name: isUr
          ? (article.author?.nameUr || 'اداریہ خبرنامہ 360')
          : (article.author?.nameEn || 'Khabarnama360 Editorial'),
      },
      publisher: {
        '@type': 'Organization',
        name: 'Khabarnama360',
        logo: {
          '@type': 'ImageObject',
          url: `${this.BASE_URL}/assets/aistudio/logo_eb8cb81a.jpg`,
        },
      },
      inLanguage: isUr ? 'ur-PK' : 'en-PK',
    };
  }

  public static generateBreadcrumbSchema(items: { name: string; url: string }[]): Record<string, any> {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: item.name,
        item: item.url.startsWith('http') ? item.url : `${this.BASE_URL}${item.url}`,
      })),
    };
  }
}
