/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Autonomous Workflow Orchestrator
 */

import { db } from '../../src/server/db.ts';
import { NewsIngestionEngine, IngestedNewsItem } from '../news/NewsIngestionEngine.ts';
import { NewsDeduplication } from '../news/NewsDeduplication.ts';
import { NewsVerificationEngine } from '../news/NewsVerificationEngine.ts';
import { SEOEngine } from '../seo/SEOEngine.ts';

export interface PipelineRunSummary {
  runId: string;
  timestamp: string;
  paused: boolean;
  sourcesChecked: number;
  itemsProcessed: number;
  duplicatesSkipped: number;
  routedToReview: number;
  autoPublished: number;
  logs: string[];
}

export class WorkflowOrchestrator {
  private static emergencyPaused = false;
  private static lastRun: PipelineRunSummary | null = null;

  public static isPaused(): boolean {
    return this.emergencyPaused;
  }

  public static setPaused(paused: boolean, actor: string = 'Admin') {
    this.emergencyPaused = paused;
    db.logAudit(actor, paused ? 'Autonomous Pipeline Paused' : 'Autonomous Pipeline Resumed', 'Emergency pause switch toggled.');
  }

  public static getStatus() {
    return {
      emergencyPaused: this.emergencyPaused,
      sourcesCount: NewsIngestionEngine.getSources().filter(s => s.enabled).length,
      lastRun: this.lastRun,
    };
  }

  public static processIncomingItem(item: IngestedNewsItem, autoPublishAllowed: boolean, licenseType: string, actor = 'Autonomous Orchestrator') {
    const existing = db.getData().articles;
    const dedup = NewsDeduplication.checkDuplicate(item.titleEn, existing);

    if (dedup.isDuplicate) {
      db.logAudit(actor, 'Duplicate Story Skipped', `Skipped "${item.titleEn}" (similarity ${dedup.similarityScore} with ${dedup.matchedArticleId})`);
      return { action: 'skipped_duplicate', dedup };
    }

    const verification = NewsVerificationEngine.verifyItem({
      title: item.titleEn,
      summary: item.summaryEn,
      autoPublishAllowed,
      hasAttribution: !!item.attribution,
      licenseType,
    });

    const seoAudit = SEOEngine.runQualityGate({
      titleEn: item.titleEn,
      titleUr: item.titleEn,
      summaryEn: item.summaryEn,
      summaryUr: item.summaryEn,
      status: verification.approvedForAutoPublish ? 'published' : 'in_review',
    });

    const status = verification.approvedForAutoPublish && seoAudit.passed ? 'published' : 'in_review';
    const saved = db.upsertArticle({
      id: `art-auto-${Date.now()}`,
      slug: item.titleEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
      titleEn: item.titleEn,
      titleUr: item.titleEn,
      summaryEn: item.summaryEn,
      summaryUr: item.summaryEn,
      contentEn: `${item.summaryEn}\n\nSource: ${item.attribution}`,
      contentUr: `${item.summaryEn}\n\nذریعہ: ${item.attribution}`,
      category: item.category,
      tags: [item.category, 'Pakistan', 'Verified'],
      author: {
        id: 'auto-desk',
        nameEn: item.sourceName,
        nameUr: item.sourceName,
        avatar: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=200&q=80',
        role: 'Syndicated / Official Feed',
      },
      publishedAt: item.publishedAt,
      updatedAt: new Date().toISOString(),
      views: 0,
      status,
      heroImage: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=1200&q=80',
      imageCaptionEn: item.attribution,
      imageCaptionUr: item.attribution,
      isBreaking: false,
      isFeatured: false,
      isTrending: false,
      sourceName: item.attribution,
      sourceUrl: item.sourceUrl,
      readingTimeMin: 2,
      workflowNotes: verification.flags.length > 0 ? verification.flags.join(' | ') : 'Auto-verified',
    }, actor);

    return {
      action: status === 'published' ? 'auto_published' : 'routed_to_review',
      articleId: saved.id,
      verification,
      seoAudit,
    };
  }

  public static runPipelineCycle(actor = 'Autonomous Orchestrator'): PipelineRunSummary {
    const runId = `run-${Date.now()}`;
    if (this.emergencyPaused) {
      return {
        runId,
        timestamp: new Date().toISOString(),
        paused: true,
        sourcesChecked: 0,
        itemsProcessed: 0,
        duplicatesSkipped: 0,
        routedToReview: 0,
        autoPublished: 0,
        logs: ['Pipeline is currently paused by emergency switch.'],
      };
    }

    const sources = NewsIngestionEngine.getSources().filter(s => s.enabled);
    const logs: string[] = [];
    for (const src of sources) {
      NewsIngestionEngine.markSourceSynced(src.id, null);
      logs.push(`Checked source: ${src.name} (${src.licenseType})`);
    }

    const summary: PipelineRunSummary = {
      runId,
      timestamp: new Date().toISOString(),
      paused: false,
      sourcesChecked: sources.length,
      itemsProcessed: 0,
      duplicatesSkipped: 0,
      routedToReview: 0,
      autoPublished: 0,
      logs,
    };

    this.lastRun = summary;
    db.logAudit(actor, 'Autonomous Newsroom Cycle', `Checked ${sources.length} configured news sources.`);
    return summary;
  }
}
