/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Comprehensive Real Technical, Bilingual Hreflang & Image SEO Auditor
 */

import { db } from '../../src/server/db.ts';
import { SEOEngine } from './SEOEngine.ts';

export interface TechnicalSeoIssue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'Metadata' | 'Canonical' | 'Hreflang' | 'Image SEO' | 'Schema' | 'Links' | 'Duplicate Slug';
  target: string;
  message: string;
}

export class SEOAuditService {
  public static runFullTechnicalAudit(actor: string = 'SEO Manager') {
    const data = db.getData();
    const articles = data.articles || [];
    const seoPages = data.seoPages || [];
    const categoryPages = db.getCategoryPages();
    const brokenLinks = (data.brokenLinks || []).filter(b => !b.resolved);
    const issues: TechnicalSeoIssue[] = [];

    // 1. Check duplicate slugs across articles
    const slugMap = new Map<string, string[]>();
    for (const art of articles) {
      const slug = (art.slug || '').toLowerCase();
      if (!slug) {
        issues.push({
          id: `slug-missing-${art.id}`,
          severity: 'critical',
          category: 'Duplicate Slug',
          target: art.titleEn,
          message: `Article "${art.titleEn}" has no URL slug assigned.`,
        });
        continue;
      }
      const list = slugMap.get(slug) || [];
      list.push(art.id);
      slugMap.set(slug, list);
    }
    for (const [slug, ids] of slugMap.entries()) {
      if (ids.length > 1) {
        issues.push({
          id: `dup-slug-${slug}`,
          severity: 'critical',
          category: 'Duplicate Slug',
          target: `/news/${slug}`,
          message: `${ids.length} articles share the same slug "${slug}". Make each slug unique.`,
        });
      }
    }

    // 2. Audit every published article (Metadata, Image Alt/Caption, Hreflang/Translation, Schema)
    let passingArticles = 0;
    for (const art of articles.filter(a => a.status === 'published')) {
      const gate = SEOEngine.runQualityGate(art);
      if (gate.passed && gate.findings.length === 0) passingArticles++;
      for (const f of gate.findings) {
        issues.push({
          id: `${art.id}-${f.id}`,
          severity: f.severity === 'suggestion' ? 'info' : f.severity,
          category:
            f.code.includes('IMAGE') ? 'Image SEO' : f.code.includes('NOINDEX') ? 'Canonical' : 'Metadata',
          target: `/en/news/${art.slug}`,
          message: `[${art.titleEn.slice(0, 42)}...] ${f.message}`,
        });
      }
      if (!art.titleUr || !art.contentUr || art.contentUr.trim().length < 20) {
        issues.push({
          id: `hreflang-ur-${art.id}`,
          severity: 'warning',
          category: 'Hreflang',
          target: `/ur/news/${art.slug}`,
          message: `Urdu companion content missing or incomplete for hreflang="ur" pair "${art.titleEn}".`,
        });
      }
      if (!art.seo?.canonicalUrl && !art.slug) {
        issues.push({
          id: `canon-${art.id}`,
          severity: 'warning',
          category: 'Canonical',
          target: art.id,
          message: `Missing canonical slug or explicit canonical URL for "${art.titleEn}".`,
        });
      }
    }

    // 3. Audit SEO Page configurations
    for (const page of seoPages) {
      if (!page.metaDescEn || page.metaDescEn.length < 50) {
        issues.push({
          id: `page-desc-en-${page.id}`,
          severity: 'warning',
          category: 'Metadata',
          target: page.path,
          message: `English meta description on "${page.path}" is shorter than 50 characters.`,
        });
      }
      if (!page.metaDescUr || page.metaDescUr.length < 40) {
        issues.push({
          id: `page-desc-ur-${page.id}`,
          severity: 'warning',
          category: 'Hreflang',
          target: page.path,
          message: `Urdu meta description on "${page.path}" is missing or under 40 characters.`,
        });
      }
      if (!page.canonicalUrl) {
        issues.push({
          id: `page-canon-${page.id}`,
          severity: 'critical',
          category: 'Canonical',
          target: page.path,
          message: `Missing canonical URL on page SEO config "${page.path}".`,
        });
      }
    }

    // 4. Audit Category Pages
    for (const cat of categoryPages.filter(c => c.enabled)) {
      if (!cat.seoTitleEn || !cat.seoTitleUr) {
        issues.push({
          id: `cat-seo-${cat.slug}`,
          severity: 'warning',
          category: 'Hreflang',
          target: `/${cat.slug}`,
          message: `Category "${cat.nameEn}" is missing bilingual SEO title overrides.`,
        });
      }
    }

    // 5. Unresolved 404/Broken Links
    for (const bl of brokenLinks) {
      issues.push({
        id: `broken-${bl.id}`,
        severity: 'critical',
        category: 'Links',
        target: bl.url,
        message: `Unresolved HTTP ${bl.statusCode} error found on ${bl.foundOnPage}.`,
      });
    }

    // 6. Image SEO summary across Media Library
    const mediaAssets = data.mediaAssets || [];
    const missingAltMedia = mediaAssets.filter(m => !m.altTextEn?.trim() || !m.altTextUr?.trim());
    for (const m of missingAltMedia) {
      issues.push({
        id: `img-alt-${m.id}`,
        severity: 'warning',
        category: 'Image SEO',
        target: m.filename,
        message: `Media asset "${m.filename}" is missing bilingual alt text.`,
      });
    }

    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const score = Math.max(0, Math.min(100, 100 - criticalCount * 12 - warningCount * 4));

    db.addSeoAuditLog({
      actor,
      action: 'Full Technical SEO Audit Executed',
      target: `${articles.length} articles, ${seoPages.length} pages, ${categoryPages.length} categories`,
      status: criticalCount > 0 ? 'warning' : 'passed',
      details: `Score ${score}/100 (${criticalCount} critical, ${warningCount} warnings)`,
    });

    return {
      auditedAt: new Date().toISOString(),
      score,
      criticalCount,
      warningCount,
      infoCount: issues.filter(i => i.severity === 'info').length,
      publishedArticlesCount: articles.filter(a => a.status === 'published').length,
      passingArticlesCount: passingArticles,
      mediaTotal: mediaAssets.length,
      mediaWithBilingualAlt: mediaAssets.length - missingAltMedia.length,
      issues,
    };
  }
}
