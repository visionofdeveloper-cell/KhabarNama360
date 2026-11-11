/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Google-Compatible JSON-LD Schema Generator
 */

import { Article, Language } from '../../types/index.ts';

export class SchemaGenerator {
  private static BASE_URL = (typeof process !== 'undefined' && process.env?.APP_URL) || 'https://360khabarnama.com';

  public static generateOrganizationSchema(lang: Language = 'en'): Record<string, any> {
    return {
      '@context': 'https://schema.org',
      '@type': 'NewsMediaOrganization',
      name: lang === 'ur' ? '360 خبرنامہ' : '360Khabarnama',
      url: this.BASE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${this.BASE_URL}/assets/aistudio/Modern_Green_and_Gold_News_Logo_2e9a99d4.png`,
      },
      sameAs: [
        'https://www.facebook.com/360Khabarnama',
        'https://twitter.com/360Khabarnama',
      ],
    };
  }

  public static generateWebSiteSchema(lang: Language = 'en'): Record<string, any> {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: lang === 'ur' ? '360 خبرنامہ' : '360Khabarnama',
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
          ? (article.author?.nameUr || 'اداریہ 360 خبرنامہ')
          : (article.author?.nameEn || '360Khabarnama Editorial'),
      },
      publisher: {
        '@type': 'Organization',
        name: '360Khabarnama',
        logo: {
          '@type': 'ImageObject',
          url: `${this.BASE_URL}/assets/aistudio/Modern_Green_and_Gold_News_Logo_2e9a99d4.png`,
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
