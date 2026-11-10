import { GoogleGenAI } from '@google/genai';
import { db } from '../db.ts';
import { AiContentDraft } from './types.ts';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export async function processDataChangeWithGemini(
  category: 'gold' | 'currency' | 'fuel' | 'weather' | 'cricket',
  triggerReason: string,
  snapshot: Record<string, any>
): Promise<AiContentDraft | null> {
  const settings = db.getAutomationSettings();

  // Guard: Feature toggle & cooldown check
  if (!settings.aiDraftsEnabled || !process.env.GEMINI_API_KEY) {
    return null;
  }

  const now = new Date();
  if (settings.lastGeminiCallAt) {
    const elapsedMinutes = (now.getTime() - new Date(settings.lastGeminiCallAt).getTime()) / (1000 * 60);
    if (elapsedMinutes < settings.geminiCooldownMin) {
      console.log(`[AI Engine] Gemini cooldown active (${elapsedMinutes.toFixed(1)}m < ${settings.geminiCooldownMin}m). Skipping automated draft.`);
      return null;
    }
  }

  try {
    const prompt = `You are the Senior Chief Editor for "Khabarnama360", a premier Pakistani bilingual news publication.
A verified factual data change has occurred in our persistent data gateway:
Category: ${category.toUpperCase()}
Reason: ${triggerReason}
Verified Data Snapshot: ${JSON.stringify(snapshot, null, 2)}

STRICT EDITORIAL RULES:
1. Ground your entire summary exclusively in the provided numeric values. NEVER fabricate, estimate, or alter numbers.
2. Produce:
   - titleEn: Professional, high-CTR English news headline.
   - titleUr: Natural, journalistic Urdu headline (نستعلیق انداز).
   - summaryEn: Concise 2-sentence standfirst for reader cards.
   - summaryUr: Factual Urdu summary.
   - contentEn: 3 short paragraphs explaining the market context, verified prices, and impact on Pakistani consumers.
   - contentUr: 3 formal journalistic paragraphs in authentic Urdu.
   - seoTags: Array of 5 relevant search tags (e.g. ["GoldRatePakistan", "APGJAA", "BusinessNews"]).

Output exclusively valid JSON adhering to the specified keys.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');

    if (!parsed.titleEn || !parsed.titleUr) {
      throw new Error('Gemini output missing required titles');
    }

    const draft: AiContentDraft = {
      id: `draft-${category}-${Date.now()}`,
      category,
      triggerReason,
      titleEn: parsed.titleEn,
      titleUr: parsed.titleUr,
      summaryEn: parsed.summaryEn || '',
      summaryUr: parsed.summaryUr || '',
      contentEn: parsed.contentEn || '',
      contentUr: parsed.contentUr || '',
      sourceDataSnapshot: snapshot,
      status: 'pending_review',
      createdAt: now.toISOString(),
      seoTags: Array.isArray(parsed.seoTags) ? parsed.seoTags : [category, 'PakistanNews', 'VerifiedRates'],
    };

    // Save draft in persistent database
    db.saveAiDraft(draft);

    // Update settings timestamp
    db.updateAutomationSettings({ lastGeminiCallAt: now.toISOString() }, 'AI Automation Engine');

    return draft;
  } catch (error: any) {
    console.error('[AI Engine] Failed to generate automated content draft:', error.message);
    return null;
  }
}
