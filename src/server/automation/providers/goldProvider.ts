import { GoldRate } from '../../../types/index.ts';
import { db } from '../../db.ts';

async function fetchLiveXauSpotUsd(): Promise<{ spotUsd: number; sourceName: string } | null> {
  // Primary: Gold-API real-time spot endpoint
  try {
    const res = await fetch('https://api.gold-api.com/price/XAU', {
      headers: { Accept: 'application/json', 'User-Agent': '360Khabarnama-BullionSync/2.0' },
      signal: AbortSignal.timeout(5500),
    });
    if (res.ok) {
      const json = await res.json();
      const price = Number(json?.price);
      if (Number.isFinite(price) && price > 1500 && price < 10000) {
        return { spotUsd: price, sourceName: 'Gold-API Live XAU/USD' };
      }
    }
  } catch {
    // Try secondary feed
  }

  // Secondary: GoldPrice.org public spot feed
  try {
    const res = await fetch('https://data-asg.goldprice.org/dbXRates/USD', {
      headers: { Accept: 'application/json', 'User-Agent': '360Khabarnama-BullionSync/2.0' },
      signal: AbortSignal.timeout(5500),
    });
    if (res.ok) {
      const json = await res.json();
      const price = Number(json?.items?.[0]?.xauPrice);
      if (Number.isFinite(price) && price > 1500 && price < 10000) {
        return { spotUsd: price, sourceName: 'GoldPrice.org XAU/USD' };
      }
    }
  } catch {
    // Fallback below
  }

  return null;
}

export async function syncGoldRates(): Promise<{
  success: boolean;
  changesDetected: boolean;
  changeSummaryEn: string;
  changeSummaryUr: string;
  itemsProcessed: number;
  error?: string;
  rates?: GoldRate[];
}> {
  const provider = db.getDataProvider('gold-bullion');
  const now = new Date().toISOString();

  try {
    // Fetch live USD/PKR interbank parity if available, fallback to DB
    let usdRate = db.getData().currencyRates?.find((c) => c.code === 'USD')?.interbankPkr || 278.4;
    try {
      const fxRes = await fetch('https://open.er-api.com/v6/latest/USD', {
        signal: AbortSignal.timeout(4500),
      });
      if (fxRes.ok) {
        const fxJson = await fxRes.json();
        const livePkr = Number(fxJson?.rates?.PKR);
        if (Number.isFinite(livePkr) && livePkr > 100 && livePkr < 1000) {
          usdRate = livePkr;
        }
      }
    } catch {
      // Keep DB USD rate
    }

    const liveXau = await fetchLiveXauSpotUsd();
    if (!liveXau) {
      throw new Error('Upstream international XAU/USD spot gold feeds unreachable; retained last verified Sarafa rates.');
    }

    const spotUsdPerOz = liveXau.spotUsd;

    // APGJAA Methodology (All Pakistan Gem & Jewellers Association):
    // Pure Gold per Tola (PKR) = (Spot USD / 31.1035) * 11.6638 * USD_PKR + Customs/Karachi Sarafa Premium
    const rawTola24K = Math.round((spotUsdPerOz / 31.1035) * 11.6638 * usdRate + 3800);
    const tola24K = Math.round(rawTola24K / 100) * 100;
    const tenGram24K = Math.round((tola24K / 11.6638) * 10);

    const tola22K = Math.round(((tola24K * 22) / 24) / 100) * 100;
    const tenGram22K = Math.round((tola22K / 11.6638) * 10);

    const tola21K = Math.round(((tola24K * 21) / 24) / 100) * 100;
    const tenGram21K = Math.round((tola21K / 11.6638) * 10);

    const tola18K = Math.round(((tola24K * 18) / 24) / 100) * 100;
    const tenGram18K = Math.round((tola18K / 11.6638) * 10);

    const prevTola24K = db.getData().goldRates?.[0]?.tolaPkr || tola24K;
    const changePkr = tola24K - prevTola24K;
    const isSignificant = Math.abs(changePkr) >= 500;

    const newGoldRates: GoldRate[] = [
      { karat: '24K (Per Tola)', tolaPkr: tola24K, tenGramPkr: tenGram24K, changePkr: Math.abs(changePkr), isPositive: changePkr >= 0 },
      { karat: '22K (Per Tola)', tolaPkr: tola22K, tenGramPkr: tenGram22K, changePkr: Math.round(Math.abs(changePkr) * 0.916), isPositive: changePkr >= 0 },
      { karat: '21K (Per Tola)', tolaPkr: tola21K, tenGramPkr: tenGram21K, changePkr: Math.round(Math.abs(changePkr) * 0.875), isPositive: changePkr >= 0 },
      { karat: '18K (Per Tola)', tolaPkr: tola18K, tenGramPkr: tenGram18K, changePkr: Math.round(Math.abs(changePkr) * 0.75), isPositive: changePkr >= 0 },
    ];

    db.updateGoldRates(newGoldRates);

    db.recordHistoricalRate({
      id: `gold-24k-${Date.now()}`,
      type: 'gold',
      symbol: 'GOLD_24K_TOLA',
      value: tola24K,
      previousValue: prevTola24K,
      change: changePkr,
      changePercent: prevTola24K ? Number(((changePkr / prevTola24K) * 100).toFixed(2)) : 0,
      timestamp: now,
      source: `APGJAA Parity / ${liveXau.sourceName} ($${spotUsdPerOz.toFixed(2)}/oz)`,
    });

    db.updateDataProvider('gold-bullion', {
      status: 'active',
      lastSyncAt: now,
      lastError: null,
      consecutiveFailures: 0,
      totalSyncs: (provider?.totalSyncs || 0) + 1,
      successfulSyncs: (provider?.successfulSyncs || 0) + 1,
    });

    const summaryEn = `Gold 24K per tola updated to Rs. ${tola24K.toLocaleString()} (Spot $${spotUsdPerOz.toFixed(1)}/oz, ${changePkr >= 0 ? '+' : ''}Rs. ${changePkr}).`;
    const summaryUr = `24 کیرٹ سونے کی فی تولہ قیمت ${tola24K.toLocaleString()} روپے اپ ڈیٹ (عالمی اسپاٹ $${spotUsdPerOz.toFixed(1)} فی اونس)۔`;

    return {
      success: true,
      changesDetected: isSignificant,
      changeSummaryEn: summaryEn,
      changeSummaryUr: summaryUr,
      itemsProcessed: newGoldRates.length,
      rates: newGoldRates,
    };
  } catch (err: any) {
    const errorMsg = err.message || 'Gold rate synchronization failed';
    db.updateDataProvider('gold-bullion', {
      status: 'degraded',
      lastError: errorMsg,
      consecutiveFailures: (provider?.consecutiveFailures || 0) + 1,
      totalSyncs: (provider?.totalSyncs || 0) + 1,
    });
    return {
      success: false,
      changesDetected: false,
      changeSummaryEn: 'Gold sync failed, retained previous verified rates.',
      changeSummaryUr: 'سونے کے ریٹس کی اپ ڈیٹ ناکام، پچھلی تصدیق شدہ قیمت برقرار۔',
      itemsProcessed: 0,
      error: errorMsg,
    };
  }
}
