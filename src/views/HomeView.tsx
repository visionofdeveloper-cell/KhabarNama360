import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import {
  Article,
  WeatherData,
  GoldRate,
  CurrencyRate,
  CricketMatch,
  PrayerTimeData,
  EducationBoard,
  HomepageSectionItem,
  CustomReusableBlock,
} from '../types/index.ts';
import {
  Clock,
  Eye,
  TrendingUp,
  CloudSun,
  Flame,
  Award,
  Search,
  ChevronRight,
  Sparkles,
  Calculator,
  ArrowRight,
  Newspaper,
} from 'lucide-react';
import { AdBanner } from '../components/AdBanner.tsx';

interface HomeViewProps {
  onSelectArticle: (article: Article) => void;
  onSearch: (q: string) => void;
}

const DEFAULT_HOME_SECTIONS: HomepageSectionItem[] = [
  { id: 'def-1', type: 'live_widgets_bar', nameEn: 'Live Market & Cricket Bar', nameUr: 'لائیو مارکیٹ و کرکٹ', enabled: true, order: 1 },
  { id: 'def-2', type: 'hero_editorial_grid', nameEn: 'Top Editorial Hero & Trending', nameUr: 'اہم خبریں', enabled: true, order: 2 },
  { id: 'def-3', type: 'ad_banner', nameEn: 'Sponsored Leaderboard', nameUr: 'اشتہاری بینر', enabled: true, order: 3, adSlot: 'leaderboard' },
  { id: 'def-4', type: 'islamic_prayer_digest', nameEn: 'Daily Islamic Digest', nameUr: 'اوقاتِ نماز', enabled: true, order: 4 },
  { id: 'def-5', type: 'utilities_grid', nameEn: 'Digital Citizen Tools', nameUr: 'شہری سہولیات', enabled: true, order: 5 },
];

export const HomeView: React.FC<HomeViewProps> = ({ onSelectArticle }) => {
  const { isUrdu, t, navigateTo } = useLanguage();

  const [articles, setArticles] = useState<Article[]>([]);
  const [weatherList, setWeatherList] = useState<WeatherData[]>([]);
  const [goldRates, setGoldRates] = useState<GoldRate[]>([]);
  const [currencyRates, setCurrencyRates] = useState<CurrencyRate[]>([]);
  const [cricketMatches, setCricketMatches] = useState<CricketMatch[]>([]);
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimeData | null>(null);
  const [boards, setBoards] = useState<EducationBoard[]>([]);
  const [layoutSections, setLayoutSections] = useState<HomepageSectionItem[]>(DEFAULT_HOME_SECTIONS);
  const [customBlocks, setCustomBlocks] = useState<CustomReusableBlock[]>([]);

  // Quick Roll Number Checker state
  const [selectedBoard, setSelectedBoard] = useState('BISE_LHR');
  const [quickRoll, setQuickRoll] = useState('');
  const [quickResult, setQuickResult] = useState<any>(null);
  const [quickResultLoading, setQuickResultLoading] = useState(false);
  const [quickResultError, setQuickResultError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/news')
      .then(res => res.json())
      .then(data => {
        if (data.success) setArticles(data.articles || []);
      })
      .catch(console.error);

    fetch('/api/weather')
      .then(res => res.json())
      .then(data => {
        if (data.success) setWeatherList(data.weather || []);
      })
      .catch(console.error);

    fetch('/api/finance/rates')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setGoldRates(data.goldRates || []);
          setCurrencyRates(data.currencyRates || []);
        }
      })
      .catch(console.error);

    fetch('/api/cricket/matches')
      .then(res => res.json())
      .then(data => {
        if (data.success) setCricketMatches(data.matches || []);
      })
      .catch(console.error);

    fetch('/api/islamic/prayer-times?city=karachi')
      .then(res => res.json())
      .then(data => {
        if (data.success) setPrayerTimes(data.prayerTimes);
      })
      .catch(console.error);

    fetch('/api/education/boards')
      .then(res => res.json())
      .then(data => {
        if (data.success) setBoards(data.boards || []);
      })
      .catch(console.error);

    fetch('/api/homepage/config')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.config?.sections) && data.config.sections.length > 0) {
          setLayoutSections(data.config.sections);
        }
      })
      .catch(() => {});

    fetch('/api/homepage/custom-blocks/public')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.blocks)) {
          setCustomBlocks(data.blocks);
        }
      })
      .catch(() => {});
  }, []);

  const handleQuickResultSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickRoll.trim()) return;

    setQuickResultLoading(true);
    setQuickResultError(null);
    setQuickResult(null);

    try {
      const res = await fetch(`/api/education/results/search?board=${selectedBoard}&roll=${quickRoll.trim()}&year=2026`);
      const data = await res.json();
      if (data.success) {
        setQuickResult(data.result);
      } else {
        setQuickResultError(data.error || 'No result found');
      }
    } catch {
      setQuickResultError('Network error checking result.');
    } finally {
      setQuickResultLoading(false);
    }
  };

  const featuredArticle = articles.find(a => a.isFeatured) || articles[0];
  const secondaryArticles = articles.filter(a => a.id !== featuredArticle?.id).slice(0, 4);
  const liveCricket = cricketMatches[0];

  const orderedSections = [...layoutSections]
    .filter(s => s.enabled !== false)
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

  const renderSection = (sec: HomepageSectionItem) => {
    if (sec.type === 'live_widgets_bar') {
      return (
        <div key={sec.id} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {liveCricket && (
            <div
              onClick={() => navigateTo('sports')}
              className="cursor-pointer bg-gradient-to-br from-emerald-800 to-teal-900 text-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
            >
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="flex items-center gap-1.5 font-bold text-amber-300">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                  {liveCricket.status === 'live' ? (isUrdu ? 'لائیو کرکٹ' : 'LIVE MATCH') : liveCricket.tournament}
                </span>
                <span className="text-[11px] text-emerald-200">{liveCricket.venueEn}</span>
              </div>
              <div className="flex items-center justify-between my-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{liveCricket.teamA.flag}</span>
                  <div>
                    <div className="font-bold text-sm">{liveCricket.teamA.name}</div>
                    <div className="text-xs text-emerald-200 font-mono">{liveCricket.teamA.score || 'Yet to bat'}</div>
                  </div>
                </div>
                <div className="text-xs font-bold text-amber-400">VS</div>
                <div className="flex items-center gap-2 text-end">
                  <div>
                    <div className="font-bold text-sm">{liveCricket.teamB.name}</div>
                    <div className="text-xs text-emerald-200 font-mono">{liveCricket.teamB.score || 'Yet to bat'}</div>
                  </div>
                  <span className="text-xl">{liveCricket.teamB.flag}</span>
                </div>
              </div>
              <p className="text-[11px] text-emerald-100 truncate mt-1">
                {isUrdu ? liveCricket.statusTextUr : liveCricket.statusTextEn}
              </p>
            </div>
          )}

          <div
            onClick={() => navigateTo('business')}
            className="cursor-pointer bg-white border border-gray-200 rounded-2xl p-4 shadow-xs hover:border-emerald-500 transition-colors"
          >
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-gray-900 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>{isUrdu ? 'صرافہ و کرنسی ریٹس' : 'Gold & Currency Rates'}</span>
              </span>
              <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">
                PKR Live
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-100">
                <div className="text-[10px] text-amber-800 font-medium">{isUrdu ? 'سونا 24 کیرٹ فی تولہ' : 'Gold 24K (Tola)'}</div>
                <div className="text-base font-extrabold text-gray-900 mt-0.5">
                  Rs. {goldRates[0]?.tolaPkr?.toLocaleString() || '278,500'}
                </div>
                <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">Live Bullion Rate</div>
              </div>
              <div className="bg-sky-50/60 p-2.5 rounded-xl border border-sky-100">
                <div className="text-[10px] text-sky-800 font-medium">{isUrdu ? 'امریکی ڈالر (انٹربینک)' : 'USD / PKR'}</div>
                <div className="text-base font-extrabold text-gray-900 mt-0.5">
                  Rs. {currencyRates[0]?.interbankPkr || '278.10'}
                </div>
                <div className="text-[10px] text-gray-500 font-medium mt-0.5">
                  Buying: {currencyRates[0]?.buyingPkr || '278.40'}
                </div>
              </div>
            </div>
          </div>

          <div
            onClick={() => navigateTo('weather')}
            className="cursor-pointer bg-white border border-gray-200 rounded-2xl p-4 shadow-xs hover:border-emerald-500 transition-colors"
          >
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-gray-900 flex items-center gap-1.5">
                <CloudSun className="w-4 h-4 text-sky-500" />
                <span>{isUrdu ? 'موسمی حالات' : 'Pakistan Weather'}</span>
              </span>
              <span className="text-[10px] text-gray-500">{isUrdu ? 'بڑے شہر' : 'Major Metros'}</span>
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              {weatherList.slice(0, 3).map(w => (
                <div key={w.cityId} className="text-center bg-gray-50 p-2 rounded-xl flex-1 border border-gray-100">
                  <div className="text-[11px] font-bold text-gray-800 truncate">{isUrdu ? w.nameUr : w.nameEn}</div>
                  <div className="text-base font-black text-emerald-700">{w.tempC}°C</div>
                  <div className="text-[10px] text-gray-500 truncate">{w.aqi ? `AQI ${w.aqi}` : w.conditionEn}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (sec.type === 'hero_editorial_grid') {
      return (
        <div key={sec.id} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {featuredArticle && (
            <div
              onClick={() => onSelectArticle(featuredArticle)}
              className="lg:col-span-7 group cursor-pointer bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-xs hover:shadow-lg transition-all flex flex-col justify-between"
            >
              <div className="relative aspect-16/9 overflow-hidden bg-gray-100">
                <img
                  src={featuredArticle.heroImage}
                  alt={featuredArticle.titleEn}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3 left-3 flex gap-2">
                  <span className="bg-emerald-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider shadow-sm">
                    {featuredArticle.category}
                  </span>
                  {featuredArticle.isBreaking && (
                    <span className="bg-red-600 text-white text-[11px] font-bold px-2 py-1 rounded-md uppercase tracking-wider animate-pulse flex items-center gap-1">
                      <Flame className="w-3 h-3" />
                      {isUrdu ? 'اہم پیش رفت' : 'Breaking'}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-6 space-y-3">
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="font-semibold text-emerald-700">
                    {isUrdu ? featuredArticle.author.nameUr : featuredArticle.author.nameEn}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {featuredArticle.readingTimeMin} {t('common.minRead')}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {featuredArticle.views?.toLocaleString()}
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl font-black text-gray-900 group-hover:text-emerald-700 transition-colors leading-snug">
                  {isUrdu ? featuredArticle.titleUr : featuredArticle.titleEn}
                </h2>

                <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                  {isUrdu ? featuredArticle.summaryUr : featuredArticle.summaryEn}
                </p>

                <div className="pt-2 flex items-center gap-1 text-xs font-bold text-emerald-700 group-hover:translate-x-1 transition-transform">
                  <span>{t('common.readMore')}</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          )}

          <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                <h3 className="font-extrabold text-base text-gray-900 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-red-500" />
                  <span>{t('common.trending')}</span>
                </h3>
                <button
                  onClick={() => navigateTo('pakistan')}
                  className="text-xs text-emerald-700 font-semibold hover:underline"
                >
                  {t('common.viewAll')}
                </button>
              </div>

              <div className="divide-y divide-gray-100">
                {secondaryArticles.map((art, idx) => (
                  <div
                    key={art.id}
                    onClick={() => onSelectArticle(art)}
                    className="py-3 first:pt-0 last:pb-0 flex items-start gap-3 group cursor-pointer"
                  >
                    <span className="text-xl font-black text-gray-300 group-hover:text-emerald-600 transition-colors w-5 shrink-0">
                      0{idx + 1}
                    </span>
                    <div className="flex-1">
                      <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">
                        {art.category}
                      </span>
                      <h4 className="text-sm font-bold text-gray-900 group-hover:text-emerald-700 transition-colors line-clamp-2 leading-snug mt-0.5">
                        {isUrdu ? art.titleUr : art.titleEn}
                      </h4>
                      <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        <span>
                          {art.readingTimeMin} {t('common.minRead')}
                        </span>
                      </div>
                    </div>
                    {art.heroImage && (
                      <img src={art.heroImage} alt={art.titleEn} className="w-16 h-16 rounded-xl object-cover shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-teal-800 to-emerald-900 rounded-2xl p-5 text-white shadow-md">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Award className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">
                    {isUrdu ? 'آن لائن امتحانی رزلٹ تلاش کریں' : 'Instant Exam Result Lookup'}
                  </h4>
                  <p className="text-[11px] text-emerald-200">
                    {isUrdu ? 'میٹرک اور انٹر سالانہ بورڈ نتائج' : 'Check BISE Matric & Inter 2026 roll numbers'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleQuickResultSearch} className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={selectedBoard}
                    onChange={e => setSelectedBoard(e.target.value)}
                    className="bg-white/10 border border-white/20 text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-hidden focus:bg-emerald-950"
                  >
                    {boards.map(b => (
                      <option key={b.code} value={b.code} className="text-gray-900">
                        {b.code} ({isUrdu ? b.nameUr : b.nameEn})
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={quickRoll}
                    onChange={e => setQuickRoll(e.target.value)}
                    placeholder="Roll No (e.g. 102456)"
                    className="bg-white text-gray-900 rounded-xl px-3 py-1.5 text-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-2 focus:ring-amber-400 font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={quickResultLoading || !quickRoll.trim()}
                  className="w-full py-2 bg-amber-400 hover:bg-amber-500 text-gray-950 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>
                    {quickResultLoading
                      ? isUrdu
                        ? 'تلاش جاری ہے...'
                        : 'Searching...'
                      : isUrdu
                      ? 'رزلٹ معلوم کریں'
                      : 'Search Result'}
                  </span>
                </button>
              </form>

              {quickResultError && (
                <div className="mt-2.5 p-2 bg-red-950/60 border border-red-500/40 text-red-200 text-xs rounded-xl text-center">
                  {quickResultError}
                </div>
              )}

              {quickResult && (
                <div className="mt-3 p-3 bg-white text-gray-900 rounded-xl space-y-1 shadow-lg text-xs">
                  <div className="flex items-center justify-between border-b pb-1 font-bold">
                    <span>{isUrdu ? quickResult.candidateNameUr : quickResult.candidateNameEn}</span>
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      Grade {quickResult.grade}
                    </span>
                  </div>
                  <div className="text-gray-600 text-[11px]">
                    Roll: {quickResult.rollNumber} | {quickResult.marksObtained} / {quickResult.totalMarks} Marks
                  </div>
                  <button
                    onClick={() => navigateTo('education')}
                    className="w-full text-center text-emerald-700 font-bold hover:underline pt-1 block"
                  >
                    {isUrdu ? 'مکمل تفصیلی مارکس شیٹ دیکھیں →' : 'View Full Marks Sheet →'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (sec.type === 'ad_banner') {
      return <AdBanner key={sec.id} slot={(sec.adSlot as any) || 'leaderboard'} />;
    }

    if (sec.type === 'islamic_prayer_digest' && prayerTimes) {
      return (
        <div key={sec.id} className="bg-emerald-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-5 space-y-2">
              <span className="bg-amber-400 text-gray-950 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {isUrdu ? sec.nameUr : sec.nameEn}
              </span>
              <h3 className="text-2xl font-black">
                {isUrdu ? `${prayerTimes.cityUr} - اوقاتِ نماز` : `${prayerTimes.cityEn} Prayer Times`}
              </h3>
              <p className="text-xs text-emerald-200">
                {prayerTimes.hijriDateEn} • {prayerTimes.hijriDateUr}
              </p>
              <div className="pt-2 text-xs text-amber-200/90 font-urdu leading-relaxed bg-white/5 p-3 rounded-2xl border border-white/10">
                "خَیْرُکُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَہٗ" - صحیح بخاری
                <div className="text-[11px] text-gray-300 mt-0.5">
                  "The best among you are those who learn the Quran and teach it." (Bukhari)
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[
                { nameEn: 'Fajr', nameUr: 'فجر', time: prayerTimes.fajr },
                { nameEn: 'Sunrise', nameUr: 'طلوع', time: prayerTimes.sunrise },
                { nameEn: 'Dhuhr', nameUr: 'ظہر', time: prayerTimes.dhuhr },
                { nameEn: 'Asr', nameUr: 'عصر', time: prayerTimes.asr },
                { nameEn: 'Maghrib', nameUr: 'مغرب', time: prayerTimes.maghrib },
                { nameEn: 'Isha', nameUr: 'عشاء', time: prayerTimes.isha },
              ].map((pt, idx) => (
                <div key={idx} className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl text-center border border-white/10">
                  <div className="text-[11px] text-emerald-300 font-bold">{isUrdu ? pt.nameUr : pt.nameEn}</div>
                  <div className="text-sm font-black text-white mt-1 font-mono">{pt.time}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (sec.type === 'utilities_grid') {
      return (
        <div key={sec.id} className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-emerald-600" />
                <span>{isUrdu ? sec.nameUr : sec.nameEn}</span>
              </h3>
              <p className="text-xs text-gray-500">
                {isUrdu
                  ? 'بجلی کے بل، زکوٰۃ، عمر، گریڈ اور کرنسی کنورٹر'
                  : 'Pakistani disco electricity bill estimator, zakat, age & currency'}
              </p>
            </div>
            <button
              onClick={() => navigateTo('tools')}
              className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
            >
              <span>{t('common.viewAll')}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { id: 'tools', titleEn: 'Electricity Bill', titleUr: 'بجلی بل تخمینہ', icon: '⚡', desc: 'LESCO, K-Electric, FESCO' },
              { id: 'islamic', titleEn: 'Zakat Calculator', titleUr: 'زکوٰۃ کیلکولیٹر', icon: '⚖️', desc: '2.5% on Gold & Cash' },
              { id: 'tools', titleEn: 'Age Calculator', titleUr: 'عمر معلوم کریں', icon: '🎂', desc: 'Exact days & months' },
              { id: 'business', titleEn: 'Currency Convert', titleUr: 'کرنسی کنورٹر', icon: '💱', desc: 'USD, SAR, AED to PKR' },
              { id: 'prizebonds', titleEn: 'Prize Bond Check', titleUr: 'پرائز بانڈ چیکر', icon: '🎟️', desc: 'Instant 6-digit draw' },
              { id: 'dictionary', titleEn: 'Urdu Dictionary', titleUr: 'اردو لغت و معنی', icon: '📖', desc: 'English & Roman Urdu' },
            ].map((tool, idx) => (
              <div
                key={idx}
                onClick={() => navigateTo(tool.id)}
                className="cursor-pointer bg-gray-50 hover:bg-emerald-50 border border-gray-200 hover:border-emerald-300 p-4 rounded-2xl text-center transition-all group"
              >
                <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">{tool.icon}</div>
                <div className="text-xs font-bold text-gray-900 group-hover:text-emerald-800">
                  {isUrdu ? tool.titleUr : tool.titleEn}
                </div>
                <div className="text-[10px] text-gray-500 mt-1 truncate">{tool.desc}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (sec.type === 'category_news_grid') {
      const catSlug = sec.categorySlug || 'pakistan';
      const limit = sec.itemLimit || 6;
      const filtered =
        sec.articleSource === 'featured'
          ? articles.filter(a => a.isFeatured)
          : sec.articleSource === 'trending'
          ? articles.filter(a => a.isTrending)
          : sec.articleSource === 'breaking'
          ? articles.filter(a => a.isBreaking)
          : articles.filter(a => a.category.toLowerCase() === catSlug.toLowerCase());
      const list = (filtered.length > 0 ? filtered : articles).slice(0, limit);
      if (list.length === 0) return null;

      return (
        <div key={sec.id} className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <Newspaper className="w-5 h-5 text-emerald-700" />
              <span>{isUrdu ? sec.nameUr : sec.nameEn}</span>
            </h3>
            <button
              onClick={() => navigateTo(catSlug)}
              className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
            >
              <span>{t('common.viewAll')}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {list.map(art => (
              <div
                key={art.id}
                onClick={() => onSelectArticle(art)}
                className="border border-gray-200 rounded-2xl overflow-hidden cursor-pointer group hover:shadow-md transition-all"
              >
                <div className="aspect-16/10 bg-gray-100 overflow-hidden">
                  <img
                    src={art.heroImage}
                    alt={art.titleEn}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
                <div className="p-4 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase text-emerald-700">{art.category}</span>
                  <h4 className="font-bold text-sm text-gray-900 line-clamp-2 group-hover:text-emerald-700">
                    {isUrdu ? art.titleUr : art.titleEn}
                  </h4>
                  <p className="text-xs text-gray-500 line-clamp-2">{isUrdu ? art.summaryUr : art.summaryEn}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (sec.type === 'custom_block') {
      const blk = customBlocks.find(b => b.id === sec.customBlockId);
      if (!blk && !sec.customHtmlEn && !sec.customHtmlUr) return null;
      return (
        <div
          key={sec.id}
          className="bg-emerald-900 text-white rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-4"
        >
          <div className="space-y-1">
            <h3 className="text-xl font-black">{isUrdu ? blk?.titleUr || sec.nameUr : blk?.titleEn || sec.nameEn}</h3>
            <p className="text-xs text-emerald-100 max-w-2xl">
              {isUrdu ? blk?.bodyUr || sec.customHtmlUr : blk?.bodyEn || sec.customHtmlEn}
            </p>
          </div>
          {blk?.ctaUrl && (
            <button
              onClick={() => navigateTo(blk.ctaUrl!.replace(/^\/+/, '') || 'home')}
              className="px-5 py-2.5 bg-amber-400 text-gray-950 font-black text-xs rounded-xl shrink-0"
            >
              {isUrdu ? blk.ctaLabelUr || 'مزید دیکھیں' : blk.ctaLabelEn || 'Learn More'}
            </button>
          )}
        </div>
      );
    }

    return null;
  };

  return <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">{orderedSections.map(renderSection)}</div>;
};
