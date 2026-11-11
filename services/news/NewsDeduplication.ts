/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — News Deduplication & Event Cluster Matcher
 */

import { Article } from '../../src/types/index.ts';

export interface DeduplicationResult {
  isDuplicate: boolean;
  similarityScore: number;
  matchedArticleId?: string;
  matchedTitle?: string;
}

export class NewsDeduplication {
  private static tokenize(text: string): Set<string> {
    return new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3)
    );
  }

  public static checkDuplicate(incomingTitle: string, existingArticles: Article[], threshold = 0.55): DeduplicationResult {
    const incomingTokens = this.tokenize(incomingTitle);
    if (incomingTokens.size === 0) {
      return { isDuplicate: false, similarityScore: 0 };
    }

    let bestScore = 0;
    let bestArticle: Article | undefined;

    for (const art of existingArticles) {
      const existingTokens = this.tokenize(art.titleEn || '');
      if (existingTokens.size === 0) continue;

      let intersection = 0;
      for (const token of incomingTokens) {
        if (existingTokens.has(token)) intersection++;
      }

      const union = incomingTokens.size + existingTokens.size - intersection;
      const jaccard = union > 0 ? intersection / union : 0;

      if (jaccard > bestScore) {
        bestScore = jaccard;
        bestArticle = art;
      }
    }

    return {
      isDuplicate: bestScore >= threshold,
      similarityScore: parseFloat(bestScore.toFixed(2)),
      matchedArticleId: bestArticle?.id,
      matchedTitle: bestArticle?.titleEn,
    };
  }
}
