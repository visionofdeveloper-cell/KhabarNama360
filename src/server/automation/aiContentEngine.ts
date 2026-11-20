/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Automated AI Content Engine (Routed via AIProviderRouter)
 */

import { db } from '../db.ts';
import { AiContentDraft } from './types.ts';
import { AIProviderRouter, AIUnavailableError } from '../../../services/ai/AIProviderRouter.ts';

let isDraftGenerationRunning = false;
let enginePausedUntilMs = 0;

export function resetAiContentEngineCooldown(): void {
  enginePausedUntilMs = 0;
}

export async function processDataChangeWithGemini(
  category: 'gold' | 'currency' | 'fuel' | 'weather' | 'cricket',
  triggerReason: string,
  snapshot: Record<string, any>
): Promise<AiContentDraft | null> {
  const settings = db.getAutomationSettings();

  if (!settings.aiDraftsEnabled) {
    return null;
  }

  const nowMs = Date.now();
  if (nowMs < enginePausedUntilMs) {
    return null;
  }

  // Prevent concurrent data-provider syncs from bursting AI quota simultaneously
  if (isDraftGenerationRunning) {
    return null;
  }

  const now = new Date(nowMs);
  if (settings.lastGeminiCallAt) {
    const elapsedMinutes = (nowMs - new Date(settings.lastGeminiCallAt).getTime()) / (1000 * 60);
    if (elapsedMinutes < settings.geminiCooldownMin) {
      return null;
    }
  }

  // Only invoke background AI if at least one credential (DB or server env) is actually available
  const availableCreds = AIProviderRouter.getAllCredentialsSanitized().filter((c: any) => c.enabled);
  if (availableCreds.length === 0) {
    return null;
  }

  isDraftGenerationRunning = true;
  // Record attempt timestamp immediately so failures/timeouts also respect cooldown window
  db.updateAutomationSettings({ lastGeminiCallAt: now.toISOString() }, 'AI Automation Engine');

  try {
    const prompt = `You are the Senior Chief Editor for "360Khabarnama", a premier Pakistani bilingual news publication.
A verified factual data change has occurred in our persistent data gateway:
Category: ${category.toUpperCase()}
Reason: ${triggerReason}
Verified Data Snapshot: ${JSON.stringify(snapshot, null, 2)}

STRICT EDITORIAL RULES:
1. Ground your entire summary exclusively in the provided numeric values. NEVER fabricate, estimate, or alter numbers.
2. Produce valid JSON with exact keys:
   - titleEn: Professional, high-CTR English news headline.
   - titleUr: Natural, journalistic Urdu headline (نستعلیق انداز).
   - summaryEn: Concise 2-sentence standfirst for reader cards.
   - summaryUr: Factual Urdu summary.
   - contentEn: 3 short paragraphs explaining market context, verified prices, and impact on Pakistani consumers.
   - contentUr: 3 formal journalistic paragraphs in authentic Urdu.
   - seoTags: Array of 5 relevant search tags.`;

    const { data: rawParsed } = await AIProviderRouter.executeJsonTask({
      task: 'breaking_alerts',
      prompt,
      systemInstruction:
        'You are a bilingual Urdu/English newsroom editor. Output ONLY a single valid JSON object with keys titleEn, titleUr, summaryEn, summaryUr, contentEn, contentUr, seoTags. Keep total JSON response concise (under 900 words).',
      temperature: 0.2,
      maxTokens: 2048,
      actor: 'Automated Data Engine',
    });

    const parsed = Array.isArray(rawParsed)
      ? rawParsed[0]
      : (rawParsed?.article || rawParsed?.data || rawParsed);

    if (!parsed || (!parsed.titleEn && !parsed.titleUr)) {
      throw new Error('AI output missing required bilingual titles.');
    }

    const draft: AiContentDraft = {
      id: `draft-${category}-${Date.now()}`,
      category,
      triggerReason,
      titleEn: parsed.titleEn || parsed.titleUr || `${category.toUpperCase()} Market Update`,
      titleUr: parsed.titleUr || parsed.titleEn || 'تازہ ترین اپڈیٹ',
      summaryEn: parsed.summaryEn || '',
      summaryUr: parsed.summaryUr || '',
      contentEn: parsed.contentEn || '',
      contentUr: parsed.contentUr || '',
      sourceDataSnapshot: snapshot,
      status: 'pending_review',
      createdAt: now.toISOString(),
      seoTags: Array.isArray(parsed.seoTags) ? parsed.seoTags : [category, 'PakistanNews', 'VerifiedRates'],
    };

    db.saveAiDraft(draft);
    enginePausedUntilMs = 0;
    return draft;
  } catch (error: any) {
    const diag = error instanceof AIUnavailableError ? error.diagnostic : undefined;
    if (diag?.category === 'quota_429') {
      const pauseSec = Math.min(Math.max(diag.retryAfterSeconds || 1800, 60), 24 * 3600);
      enginePausedUntilMs = Date.now() + pauseSec * 1000;
    } else if (
      diag?.category === 'billing_required' ||
      diag?.category === 'auth_failed_401' ||
      diag?.category === 'permission_denied_403' ||
      (error instanceof AIUnavailableError && error.code === 'NO_AI_KEY')
    ) {
      enginePausedUntilMs = Date.now() + 60 * 60 * 1000;
    } else if (diag?.category === 'timeout' || diag?.category === 'server_error_5xx') {
      enginePausedUntilMs = Date.now() + 10 * 60 * 1000;
    }
    console.warn('[AI Engine] Automated draft skipped:', error?.message || String(error));
    return null;
  } finally {
    isDraftGenerationRunning = false;
  }
}
