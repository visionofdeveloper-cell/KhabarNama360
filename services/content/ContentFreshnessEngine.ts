/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Khabarnama360 — Content Freshness & Review Automation Engine
 */

import { Article } from '../../src/types/index.ts';

export interface FreshnessReviewTask {
  articleId: string;
  titleEn: string;
  category: string;
  publishedAt: string;
  ageDays: number;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  recommendedAction: string;
}

export class ContentFreshnessEngine {
  private static TIME_SENSITIVE_KEYWORDS = [
    'petrol', 'diesel', 'ogra', 'gold', 'dollar', 'psx',
    'date sheet', 'exam', 'result', 'admission', 'deadline', 'ramadan', 'eid'
  ];

  public static scanArticlesForFreshness(articles: Article[]): FreshnessReviewTask[] {
    const tasks: FreshnessReviewTask[] = [];
    const now = Date.now();

    for (const art of articles) {
      if (art.status !== 'published') continue;
      const pubTime = new Date(art.updatedAt || art.publishedAt).getTime();
      const ageDays = Math.floor((now - pubTime) / (1000 * 60 * 60 * 24));
      const lowerTitle = (art.titleEn || '').toLowerCase();

      const isTimeSensitive = this.TIME_SENSITIVE_KEYWORDS.some(k => lowerTitle.includes(k));

      if (isTimeSensitive && ageDays >= 14) {
        tasks.push({
          articleId: art.id,
          titleEn: art.titleEn,
          category: art.category,
          publishedAt: art.publishedAt,
          ageDays,
          reason: 'Time-sensitive topic (rates, exam notice, or policy) older than 14 days.',
          priority: 'high',
          recommendedAction: 'Verify current figures against official sources or archive/link to latest update.',
        });
      } else if (ageDays >= 90) {
        tasks.push({
          articleId: art.id,
          titleEn: art.titleEn,
          category: art.category,
          publishedAt: art.publishedAt,
          ageDays,
          reason: 'Evergreen/general article has not been reviewed in 90+ days.',
          priority: 'medium',
          recommendedAction: 'Audit factual accuracy and internal links; preserve original publication date.',
        });
      }
    }

    return tasks;
  }
}
