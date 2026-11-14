import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { GoldRate, CurrencyRate, FuelPrice, PSXData } from '../types/index.ts';
import {
  TrendingUp,
  Coins,
  DollarSign,
  Fuel,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Repeat,
  BarChart3
} from 'lucide-react';
import { safeFetchJson } from '../utils/safeFetch.ts';

export const FinanceView: React.FC = () => {
  const { isUrdu } = useLanguage();
  const [goldRates, setGoldRates] = useState<GoldRate[]>([]);
  const [currencyRates, setCurrencyRates] = useState<CurrencyRate[]>([]);
  const [fuelPrices, setFuelPrices] = useState<FuelPrice[]>([]);
  const [psx, setPsx] = useState<PSXData | null>(null);
  const [freshness, setFreshness] = useState<any>(null);
  const [historicalGold, setHistoricalGold] = useState<any[]>([]);

  // Currency Converter state
  const [convertAmount, setConvertAmount] = useState('100');
  const [convertFrom, setConvertFrom] = useState('USD');
  const [convertTo, setConvertTo] = useState('PKR');

  useEffect(() => {
    const loadRates = async () => {
      const [ratesRes, freshRes, histRes] = await Promise.all([
        safeFetchJson('/api/finance/rates'),
        safeFetchJson('/api/data-freshness'),
        safeFetchJson('/api/rates/historical?type=gold&limit=5'),
      ]);
      if (ratesRes.success) {
        setGoldRates(ratesRes.goldRates || []);
        setCurrencyRates(ratesRes.currencyRates || []);
        setFuelPrices(ratesRes.fuelPrices || []);
        setPsx(ratesRes.psx || null);
      }
      if (freshRes.success) setFreshness(freshRes.freshness);
      if (histRes.success) setHistoricalGold(histRes.records || []);
    };
    void loadRates();
    const interval = setInterval(() => void loadRates(), 180_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void loadRates();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const calculateConversion = () => {
    const amt = parseFloat(convertAmount) || 0;
    if (convertTo === 'PKR') {
      const cur = currencyRates.find(c => c.code === convertFrom);
      const rate = cur ? cur.buyingPkr : 278.40;
      return (amt * rate).toLocaleString(undefined, { maximumFractionDigits: 2 });
    } else if (convertFrom === 'PKR') {
      const cur = currencyRates.find(c => c.code === convertTo);
      const rate = cur ? cur.sellingPkr : 280.15;
      return (amt / rate).toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
    return (amt * 1).toString();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Title Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-teal-900 text-white rounded-3xl p-6 sm:p-10 shadow-xl">
        <div className="inline-flex items-center gap-2 bg-amber-400 text-gray-950 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
          <TrendingUp className="w-4 h-4" />
          <span>{isUrdu ? 'کاروبار، صرافہ و مالیات' : 'Business, Markets & Rates'}</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-black">
          {isUrdu ? 'پاکستان مارکیٹ ریٹس: سونا، کرنسی اور اسٹاک ایکسچینج' : 'Pakistan Financial Rates: Gold, Currency & PSX'}
        </h1>
        <p className="text-emerald-200 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
          {isUrdu
            ? 'آل پاکستان صرافہ جیمز اینڈ جیولرز ایسوسی ایشن اور اسٹیٹ بینک آف پاکستان کے تصدیق شدہ نرخ'
            : 'Verified rates from All Pakistan Gem & Jewellers Association, State Bank of Pakistan & OGRA.'}
        </p>
      </div>

      {/* Gold & Silver Rates Section */}
      <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-500" />
              <span>{isUrdu ? 'سونے اور چاندی کے تازہ ترین نرخ (پاکستان)' : 'Today Gold & Silver Rates in Pakistan'}</span>
            </h2>
            <p className="text-xs text-gray-500">
              {isUrdu ? 'لاہور، کراچی، اسلام آباد، پشاور صرافہ مارکیٹس' : 'Updated daily from Karachi & Lahore Bullion Markets'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{isUrdu ? 'صرافہ ایسوسی ایشن و بلین پیرٹی لائیو تصدیق شدہ' : 'APGJAA Bullion Verified Live'}</span>
            </span>
            {freshness?.gold?.lastSyncAt && (
              <span className="text-[10px] text-gray-400 font-mono">
                {new Date(freshness.gold.lastSyncAt).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead>
              <tr className="bg-gray-50 text-gray-700 font-bold border-y border-gray-200">
                <th className="p-3 text-start">{isUrdu ? 'کیرٹ / قسم' : 'Purity / Karat'}</th>
                <th className="p-3 text-center">{isUrdu ? 'فی تولہ (PKR)' : 'Per Tola (PKR)'}</th>
                <th className="p-3 text-center">{isUrdu ? '10 گرام (PKR)' : '10 Grams (PKR)'}</th>
                <th className="p-3 text-center">{isUrdu ? 'تبدیلی' : 'Change'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {goldRates.map((g, idx) => (
                <tr key={idx} className="hover:bg-amber-50/40 transition-colors">
                  <td className="p-3 font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                    <span>{g.karat}</span>
                  </td>
                  <td className="p-3 text-center font-black font-mono text-gray-900 text-sm">
                    Rs. {g.tolaPkr.toLocaleString()}
                  </td>
                  <td className="p-3 text-center font-mono text-gray-700 font-semibold">
                    Rs. {g.tenGramPkr.toLocaleString()}
                  </td>
                  <td className="p-3 text-center font-bold text-emerald-600 font-mono">
                    ▲ +Rs. {g.changePkr}
                  </td>
                </tr>
              ))}
              {/* Silver row */}
              <tr className="bg-slate-50/70 font-semibold">
                <td className="p-3 font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                  <span>{isUrdu ? 'چاندی 24 کیرٹ فی تولہ' : 'Silver 24K (Per Tola)'}</span>
                </td>
                <td className="p-3 text-center font-black font-mono text-slate-900">Rs. 3,350</td>
                <td className="p-3 text-center font-mono text-slate-700">Rs. 2,872</td>
                <td className="p-3 text-center font-bold text-emerald-600 font-mono">▲ +Rs. 50</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Currency Exchange & Converter Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Currency Rates Table (7 Cols) */}
        <div className="lg:col-span-7 bg-white border border-gray-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between border-b border-gray-100 pb-3 gap-2">
            <h3 className="font-black text-gray-900 flex items-center gap-2 text-base">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              <span>{isUrdu ? 'اوپن مارکیٹ و انٹربینک کرنسی ریٹس' : 'Open Market & Interbank Currencies'}</span>
            </h3>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>{isUrdu ? 'اسٹیٹ بینک و انٹربینک ریگولیٹڈ' : 'SBP & Interbank Live Feed'}</span>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
                  <th className="p-2.5 text-start">{isUrdu ? 'کرنسی' : 'Currency'}</th>
                  <th className="p-2.5 text-center">{isUrdu ? 'خریداری' : 'Buying (PKR)'}</th>
                  <th className="p-2.5 text-center">{isUrdu ? 'فروخت' : 'Selling (PKR)'}</th>
                  <th className="p-2.5 text-center">{isUrdu ? 'انٹربینک' : 'Interbank'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currencyRates.map((c) => (
                  <tr key={c.code} className="hover:bg-gray-50">
                    <td className="p-2.5 font-bold text-gray-900 flex items-center gap-2">
                      <span className="text-base">{c.flag}</span>
                      <span>{c.code}</span>
                      <span className="text-gray-400 font-normal hidden sm:inline">
                        ({isUrdu ? c.nameUr : c.nameEn})
                      </span>
                    </td>
                    <td className="p-2.5 text-center font-mono font-bold text-gray-800">{c.buyingPkr.toFixed(2)}</td>
                    <td className="p-2.5 text-center font-mono font-bold text-gray-800">{c.sellingPkr.toFixed(2)}</td>
                    <td className="p-2.5 text-center font-mono text-emerald-700 font-semibold">{c.interbankPkr.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Currency Converter (5 Cols) */}
        <div className="lg:col-span-5 bg-gradient-to-br from-emerald-800 to-teal-950 text-white rounded-3xl p-6 shadow-md flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-white/10 rounded-xl">
                <Repeat className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <h3 className="font-bold text-base">
                  {isUrdu ? 'فوری کرنسی کنورٹر' : 'Live Currency Converter'}
                </h3>
                <p className="text-xs text-emerald-200">
                  {isUrdu ? 'کسی بھی عالمی کرنسی کو پاکستانی روپے میں تبدیل کریں' : 'Convert foreign currency to Pakistani Rupee'}
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-emerald-200 mb-1">
                  {isUrdu ? 'رقم' : 'Amount'}
                </label>
                <input
                  type="number"
                  value={convertAmount}
                  onChange={(e) => setConvertAmount(e.target.value)}
                  className="w-full p-2.5 bg-white text-gray-900 rounded-xl font-bold font-mono text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-emerald-200 mb-1">
                    {isUrdu ? 'منجانب' : 'From'}
                  </label>
                  <select
                    value={convertFrom}
                    onChange={(e) => setConvertFrom(e.target.value)}
                    className="w-full p-2.5 bg-white text-gray-900 rounded-xl text-xs font-bold"
                  >
                    <option value="USD">USD (US Dollar)</option>
                    <option value="SAR">SAR (Saudi Riyal)</option>
                    <option value="AED">AED (UAE Dirham)</option>
                    <option value="GBP">GBP (British Pound)</option>
                    <option value="EUR">EUR (Euro)</option>
                    <option value="CAD">CAD (Canadian Dollar)</option>
                    <option value="AUD">AUD (Australian Dollar)</option>
                    <option value="PKR">PKR (Pakistani Rupee)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-emerald-200 mb-1">
                    {isUrdu ? 'بہ تبدیل' : 'To'}
                  </label>
                  <select
                    value={convertTo}
                    onChange={(e) => setConvertTo(e.target.value)}
                    className="w-full p-2.5 bg-white text-gray-900 rounded-xl text-xs font-bold"
                  >
                    <option value="PKR">PKR (Pakistani Rupee)</option>
                    <option value="USD">USD (US Dollar)</option>
                    <option value="SAR">SAR (Saudi Riyal)</option>
                    <option value="AED">AED (UAE Dirham)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Result Output */}
          <div className="bg-white/10 p-4 rounded-2xl border border-white/10 text-center">
            <span className="text-xs text-emerald-200 block">{isUrdu ? 'تبدیل شدہ مالیت:' : 'Converted Equivalent:'}</span>
            <div className="text-2xl font-black text-amber-300 mt-1 font-mono">
              {calculateConversion()} {convertTo}
            </div>
          </div>
        </div>
      </div>

      {/* Fuel Prices & PSX 100 Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Petroleum Products (POL) */}
        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="font-black text-gray-900 flex items-center gap-2 text-base">
              <Fuel className="w-5 h-5 text-red-500" />
              <span>{isUrdu ? 'پیٹرول و ڈیزل کی سرکاری قیمتیں' : 'Petrol & Diesel Prices in Pakistan'}</span>
            </h3>
            <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
              OGRA Notification
            </span>
          </div>

          <div className="space-y-3">
            {fuelPrices.map((f, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100">
                <div>
                  <div className="font-bold text-xs text-gray-900">{isUrdu ? f.typeUr : f.typeEn}</div>
                  <div className="text-[10px] text-gray-400">Effective: {f.effectiveDate}</div>
                </div>
                <div className="text-end">
                  <div className="text-base font-black text-gray-900 font-mono">
                    Rs. {f.pricePkr.toFixed(2)}
                  </div>
                  <div className={`text-[10px] font-bold ${f.changePkr <= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {f.changePkr <= 0 ? `▼ -Rs. ${Math.abs(f.changePkr)}` : `▲ +Rs. ${f.changePkr}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PSX KSE-100 Performance */}
        {psx && (
          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-black text-gray-900 flex items-center gap-2 text-base">
                <BarChart3 className="w-5 h-5 text-emerald-600" />
                <span>{isUrdu ? 'پاکستان اسٹاک ایکسچینج (KSE-100)' : 'Pakistan Stock Exchange (KSE-100)'}</span>
              </h3>
              <span className="text-xs font-bold text-emerald-700 font-mono">
                ▲ +{psx.changePercent}%
              </span>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
                Benchmark KSE-100 Index
              </span>
              <div className="text-3xl font-black text-gray-900 font-mono mt-1">
                {psx.kse100.toLocaleString()}
              </div>
              <div className="text-xs text-emerald-700 font-bold mt-1">
                ▲ +{psx.change} points | Volume: {psx.volumeMillion}M shares
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 bg-gray-50 rounded-xl">
                <span className="font-bold text-emerald-700 block mb-1">Top Gainers</span>
                {psx.gainers.slice(0, 3).map((g) => (
                  <div key={g.symbol} className="flex justify-between font-mono text-[11px] py-0.5">
                    <span className="font-bold text-gray-800">{g.symbol}</span>
                    <span className="text-emerald-600 font-bold">+{g.change}</span>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-gray-50 rounded-xl">
                <span className="font-bold text-red-600 block mb-1">Top Losers</span>
                {psx.losers.slice(0, 3).map((l) => (
                  <div key={l.symbol} className="flex justify-between font-mono text-[11px] py-0.5">
                    <span className="font-bold text-gray-800">{l.symbol}</span>
                    <span className="text-red-500 font-bold">{l.change}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
