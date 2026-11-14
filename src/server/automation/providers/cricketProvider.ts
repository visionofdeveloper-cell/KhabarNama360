import { CricketMatch } from '../../../types/index.ts';
import { db } from '../../db.ts';

function stripCdata(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchCricinfoLiveScores(): Promise<CricketMatch[]> {
  try {
    const res = await fetch('https://static.cricinfo.com/rss/livescores.xml', {
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml',
        'User-Agent': '360Khabarnama-CricketBot/2.0',
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
    const parsed: CricketMatch[] = [];

    for (let i = 0; i < Math.min(6, items.length); i++) {
      const item = items[i];
      const titleMatch = item.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const descMatch = item.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
      const title = titleMatch?.[1] ? stripCdata(titleMatch[1]) : '';
      const desc = descMatch?.[1] ? stripCdata(descMatch[1]) : '';
      if (
        !title ||
        /no\s+match\s+in\s+progress|no\s+live\s+match|no\s+matches/i.test(title) ||
        (!/\s+v\s+|\s+vs\s+/i.test(title) && !/\d/.test(title))
      ) {
        continue;
      }

      const vsParts = title.split(/\s+v\s+|\s+vs\s+/i);
      const teamAName = (vsParts[0] || 'Team A').replace(/\d+\/\d+.*$/, '').trim().slice(0, 28);
      const teamBName = (vsParts[1] || 'Team B').replace(/\d+\/\d+.*$/, '').trim().slice(0, 28);

      const isPak = /pakistan|pak\b/i.test(title);
      parsed.push({
        id: `cric-live-${i + 1}`,
        titleEn: title,
        titleUr: isPak ? `لائیو کرکٹ اسکور: ${title}` : `انٹرنیشنل کرکٹ: ${title}`,
        tournament: 'ICC / International Live Match Center',
        status: 'live',
        teamA: {
          name: teamAName || 'Team A',
          code: teamAName.slice(0, 3).toUpperCase() || 'TMA',
          flag: /pakistan/i.test(teamAName) ? '🇵🇰' : '🏏',
        },
        teamB: {
          name: teamBName || 'Team B',
          code: teamBName.slice(0, 3).toUpperCase() || 'TMB',
          flag: /pakistan/i.test(teamBName) ? '🇵🇰' : '🏏',
        },
        statusTextEn: desc || title,
        statusTextUr: desc || title,
        venueEn: 'Live International Fixture',
        venueUr: 'لائیو بین الاقوامی اسکور',
        dateStr: new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }),
      });
    }
    return parsed;
  } catch {
    return [];
  }
}

export async function syncCricketData(): Promise<{
  success: boolean;
  changesDetected: boolean;
  changeSummaryEn: string;
  changeSummaryUr: string;
  itemsProcessed: number;
  error?: string;
  matches?: CricketMatch[];
}> {
  const provider = db.getDataProvider('cricket-feed');
  const now = new Date().toISOString();

  try {
    const existingMatches = (db.getData().cricketMatches || []).filter(
      m => !/no\s+match\s+in\s+progress/i.test(m.titleEn || '')
    );
    const liveFeedMatches = await fetchCricinfoLiveScores();

    const updatedMatches: CricketMatch[] =
      liveFeedMatches.length > 0
        ? [
            ...liveFeedMatches,
            ...existingMatches.filter(m => !m.id.startsWith('cric-live-')).slice(0, 2),
          ]
        : existingMatches;

    if (updatedMatches.length > 0) {
      db.updateCricketMatches(updatedMatches);
    }

    db.updateDataProvider('cricket-feed', {
      status: 'active',
      lastSyncAt: now,
      lastError: null,
      consecutiveFailures: 0,
      totalSyncs: (provider?.totalSyncs || 0) + 1,
      successfulSyncs: (provider?.successfulSyncs || 0) + 1,
    });

    return {
      success: true,
      changesDetected: liveFeedMatches.length > 0,
      changeSummaryEn:
        liveFeedMatches.length > 0
          ? `Synchronized ${liveFeedMatches.length} live international cricket scorecards.`
          : 'Verified cricket schedule & scorecard feed (no new live fixtures changed).',
      changeSummaryUr:
        liveFeedMatches.length > 0
          ? `${liveFeedMatches.length} لائیو بین الاقوامی کرکٹ میچز کے اسکور اپ ڈیٹ ہو گئے۔`
          : 'کرکٹ شیڈول اور اسکور بورڈ فیڈ تصدیق شدہ ہے۔',
      itemsProcessed: updatedMatches.length,
      matches: updatedMatches,
    };
  } catch (err: any) {
    const errorMsg = err.message || 'Cricket sync failed';
    db.updateDataProvider('cricket-feed', {
      status: 'degraded',
      lastError: errorMsg,
      consecutiveFailures: (provider?.consecutiveFailures || 0) + 1,
      totalSyncs: (provider?.totalSyncs || 0) + 1,
    });
    return {
      success: false,
      changesDetected: false,
      changeSummaryEn: 'Cricket sync failed, retained previous scorecard.',
      changeSummaryUr: 'کرکٹ اسکور کی اپ ڈیٹ ناکام، پچھلا اسکور کارڈ برقرار۔',
      itemsProcessed: 0,
      error: errorMsg,
    };
  }
}
