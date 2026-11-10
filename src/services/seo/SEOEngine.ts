/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Khabarnama360 — Unified SEO Engine
 */

import { Article, Language } from '../../types/index.ts';
import { MetadataGenerator, UnifiedMetadata } from './MetadataGenerator.ts';
import { SchemaGenerator } from './SchemaGenerator.ts';

export { MetadataGenerator, SchemaGenerator };
export type { UnifiedMetadata };

export class SEOEngine {
  public static getArticleSEO(article: Article, lang: Language): {
    metadata: UnifiedMetadata;
    jsonLd: Record<string, any>[];
  } {
    const metadata = MetadataGenerator.generateForArticle(article, lang);
    const jsonLd = [
      SchemaGenerator.generateOrganizationSchema(lang),
      SchemaGenerator.generateArticleSchema(article, lang, 'NewsArticle'),
      SchemaGenerator.generateBreadcrumbSchema([
        { name: lang === 'ur' ? 'صفحہ اول' : 'Home', url: `/${lang}` },
        { name: article.category, url: `/${lang}/${article.category}` },
        { name: lang === 'ur' ? article.titleUr : article.titleEn, url: metadata.canonicalUrl },
      ]),
    ];

    return { metadata, jsonLd };
  }
}
