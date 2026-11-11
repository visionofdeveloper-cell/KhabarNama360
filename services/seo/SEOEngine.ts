/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Universal Page-Level SEO Engine, Schema Generator & Quality Gate
 */

import { Article } from '../../src/types/index.ts';

export interface PageMetadata {
  title: string;
  description: string;
  canonicalUrl: string;
  robots: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogType: 'article' | 'website';
  locale: 'en_PK' | 'ur_PK';
  hreflangEn: string;
  hreflangUr: string;
}

export interface SeoFinding {
  id: string;
  severity: 'critical' | 'warning' | 'suggestion';
  code: string;
  message: string;
  field?: string;
}

export interface SeoQualityGateResult {
  passed: boolean; // false if any critical findings exist
  healthScore: number; // 0-100 internal operational score (not a ranking predictor)
  findings: SeoFinding[];
  checkedAt: string;
}

export interface InternalLinkSuggestion {
  sourceArticleId: string;
  targetUrl: string;
  targetTitle: string;
  anchorText: string;
  cluster: string;
  relevanceReason: string;
}

export class SEOEngine {
  private static BASE_URL = process.env.APP_URL || 'https://360khabarnama.com';

  /**
   * Generate bilingual metadata for any article or utility page
   */
  public static generateArticleMetadata(article: Article, lang: 'en' | 'ur'): PageMetadata {
    const title = lang === 'ur'
      ? (article.seo?.metaTitleUr || `${article.titleUr} | 360 خبرنامہ`)
      : (article.seo?.metaTitleEn || `${article.titleEn} | 360Khabarnama`);

    const description = lang === 'ur'
      ? (article.seo?.metaDescriptionUr || article.summaryUr || article.titleUr)
      : (article.seo?.metaDescriptionEn || article.summaryEn || article.titleEn);

    const slug = article.slug || article.id;
    const canonicalUrl = article.seo?.canonicalUrl || `${this.BASE_URL}/${lang}/news/${slug}`;
    const robots = article.seo?.noIndex
      ? 'noindex, nofollow'
      : 'index, follow, max-image-preview:large';

    return {
      title: title.slice(0, 70),
      description: description.slice(0, 160),
      canonicalUrl,
      robots,
      ogTitle: title,
      ogDescription: description,
      ogImage: article.seo?.ogImage || article.heroImage || `${this.BASE_URL}/assets/aistudio/Modern_Green_and_Gold_News_Logo_2e9a99d4.png`,
      ogType: 'article',
      locale: lang === 'ur' ? 'ur_PK' : 'en_PK',
      hreflangEn: `${this.BASE_URL}/en/news/${slug}`,
      hreflangUr: `${this.BASE_URL}/ur/news/${slug}`,
    };
  }

  /**
   * Generate valid NewsArticle JSON-LD matching visible page content
   */
  public static generateNewsArticleSchema(article: Article, lang: 'en' | 'ur'): Record<string, any> {
    const slug = article.slug || article.id;
    const url = `${this.BASE_URL}/${lang}/news/${slug}`;
    return {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': url,
      },
      headline: lang === 'ur' ? article.titleUr : article.titleEn,
      description: lang === 'ur' ? article.summaryUr : article.summaryEn,
      image: article.heroImage ? [article.heroImage] : [],
      datePublished: article.publishedAt,
      dateModified: article.updatedAt || article.publishedAt,
      author: {
        '@type': 'Person',
        name: lang === 'ur' ? (article.author?.nameUr || 'اداریہ 360 خبرنامہ') : (article.author?.nameEn || '360Khabarnama Editorial'),
      },
      publisher: {
        '@type': 'Organization',
        name: '360Khabarnama',
        logo: {
          '@type': 'ImageObject',
          url: `${this.BASE_URL}/assets/aistudio/Modern_Green_and_Gold_News_Logo_2e9a99d4.png`,
        },
      },
      inLanguage: lang === 'ur' ? 'ur-PK' : 'en-PK',
    };
  }

  /**
   * Pre-Publication SEO Quality Gate
   * Classifies findings into Critical (blocks publish), Warning, and Suggestion.
   */
  public static runQualityGate(article: Partial<Article>): SeoQualityGateResult {
    const findings: SeoFinding[] = [];
    let score = 100;

    // Critical Checks
    if (!article.titleEn || article.titleEn.trim().length < 10) {
      findings.push({
        id: 'crit-title-en',
        severity: 'critical',
        code: 'MISSING_TITLE_EN',
        message: 'English headline is missing or too short (minimum 10 characters).',
        field: 'titleEn',
      });
      score -= 25;
    }

    if (!article.titleUr || article.titleUr.trim().length < 10) {
      findings.push({
        id: 'crit-title-ur',
        severity: 'critical',
        code: 'MISSING_TITLE_UR',
        message: 'Urdu headline is missing or too short (minimum 10 characters).',
        field: 'titleUr',
      });
      score -= 25;
    }

    if (article.seo?.noIndex && article.status === 'published') {
      findings.push({
        id: 'crit-noindex',
        severity: 'critical',
        code: 'ACCIDENTAL_NOINDEX',
        message: 'Article is marked as published but has noIndex enabled.',
        field: 'seo.noIndex',
      });
      score -= 20;
    }

    // Warning Checks
    if (!article.summaryEn || article.summaryEn.trim().length < 40) {
      findings.push({
        id: 'warn-desc-en',
        severity: 'warning',
        code: 'WEAK_META_DESC_EN',
        message: 'English summary/meta description is under 40 characters.',
        field: 'summaryEn',
      });
      score -= 10;
    }

    if (!article.summaryUr || article.summaryUr.trim().length < 40) {
      findings.push({
        id: 'warn-desc-ur',
        severity: 'warning',
        code: 'WEAK_META_DESC_UR',
        message: 'Urdu summary/meta description is under 40 characters.',
        field: 'summaryUr',
      });
      score -= 10;
    }

    if (!article.heroImage || !article.heroImage.startsWith('http')) {
      findings.push({
        id: 'warn-hero-img',
        severity: 'warning',
        code: 'MISSING_FEATURED_IMAGE',
        message: 'Featured image URL is missing or invalid (Discover requires high-res >=1200px).',
        field: 'heroImage',
      });
      score -= 10;
    }

    // Suggestion Checks
    if (!article.imageCaptionEn || !article.imageCaptionUr) {
      findings.push({
        id: 'sug-alt',
        severity: 'suggestion',
        code: 'MISSING_IMAGE_CAPTION',
        message: 'Add descriptive bilingual image captions/alt text for accessibility and Image SEO.',
        field: 'imageCaptionEn',
      });
      score -= 5;
    }

    if (!article.tags || article.tags.length < 3) {
      findings.push({
        id: 'sug-tags',
        severity: 'suggestion',
        code: 'FEW_TOPIC_TAGS',
        message: 'Add at least 3 topic tags to map this article into content clusters.',
        field: 'tags',
      });
      score -= 5;
    }

    const hasCritical = findings.some(f => f.severity === 'critical');
    return {
      passed: !hasCritical,
      healthScore: Math.max(0, score),
      findings,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Topic Cluster & Internal Link Suggestions
   */
  public static suggestInternalLinks(article: Article, allArticles: Article[]): InternalLinkSuggestion[] {
    const suggestions: InternalLinkSuggestion[] = [];
    const related = allArticles
      .filter(a => a.id !== article.id && a.status === 'published' && a.category === article.category)
      .slice(0, 3);

    for (const rel of related) {
      suggestions.push({
        sourceArticleId: article.id,
        targetUrl: `/en/news/${rel.slug}`,
        targetTitle: rel.titleEn,
        anchorText: rel.titleEn.split(':')[0].slice(0, 50),
        cluster: article.category,
        relevanceReason: `Same topic cluster (${article.category})`,
      });
    }

    return suggestions;
  }
}
