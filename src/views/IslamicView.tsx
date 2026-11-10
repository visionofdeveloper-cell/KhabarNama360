import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { PrayerTimeData } from '../types/index.ts';
import {
  Moon,
  Clock,
  Sparkles,
  BookOpen,
  Scale,
  Calendar,
  Compass,
  CheckCircle2,
  MapPin
} from 'lucide-react';

export const IslamicView: React.FC = () => {
  const { isUrdu } = useLanguage();
  const [selectedCity, setSelectedCity] = useState('karachi');
  const [prayerData, setPrayerData] = useState<PrayerTimeData | null>(null);

  // Zakat Calculator State in PKR
  const [cashPkr, setCashPkr] = useState('');
  const [goldTolas, setGoldTolas] = useState('');
  const [silverTolas, setSilverTolas] = useState('');
  const [businessStockPkr, setBusinessStockPkr] = useState('');
  const [debtsPkr, setDebtsPkr] = useState('');

  const GOLD_RATE_TOLA = 278500;
  const SILVER_RATE_TOLA = 3350;
  const SILVER_NISAB_TOLAS = 52.5;
  const NISAB_THRESHOLD_PKR = SILVER_RATE_TOLA * SILVER_NISAB_TOLAS; // Approx Rs. 175,875

  useEffect(() => {
    fetch(`/api/islamic/prayer-times?city=${selectedCity}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setPrayerData(data.prayerTimes);
        }
      })
      .catch(console.error);
  }, [selectedCity]);

  // Compute Zakat
  const totalAssetsPkr =
    (parseFloat(cashPkr) || 0) +
    (parseFloat(goldTolas) || 0) * GOLD_RATE_TOLA +
    (parseFloat(silverTolas) || 0) * SILVER_RATE_TOLA +
    (parseFloat(businessStockPkr) || 0);

  const netWealthPkr = Math.max(0, totalAssetsPkr - (parseFloat(debtsPkr) || 0));
  const isEligibleForZakat = netWealthPkr >= NISAB_THRESHOLD_PKR;
  const zakatPayablePkr = isEligibleForZakat ? netWealthPkr * 0.025 : 0;

  const dailyDuas = [
    {
      titleEn: 'Dua for Guidance & Righteousness',
      titleUr: 'ہدایت اور استقامت کی دعا',
      arabic: 'رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِن لَّدُنكَ رَحْمَةً',
      urdu: 'اے ہمارے رب! ہمارے دلوں کو ٹیڑھا نہ کر بعد اس کے کہ تو نے ہمیں ہدایت دی اور اپنی جناب سے ہم پر رحمت فرما۔',
      reference: 'سورة آل عمران: 8'
    },
    {
      titleEn: 'Dua for Ease in Daily Hardships',
      titleUr: 'مشکلات سے نجات اور آسانی کی دعا',
      arabic: 'اللَّهُمَّ لَا سَهْلَ إِلَّا مَا جَعَلْتَهُ سَهْلًا وَأَنْتَ تَجْعَلُ الْحَزْنَ إِذَا شِئْتَ سَهْلًا',
      urdu: 'اے اللہ! کوئی کام آسان نہیں مگر جس کو تو آسان بنا دے، اور تو جب چاہے غم اور مشکل کو آسانی میں بدل دیتا ہے۔',
      reference: 'صحیح ابن حبان'
    }
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-teal-900 to-emerald-900 text-white rounded-3xl p-6 sm:p-10 shadow-xl relative overflow-hidden">
        <div className="max-w-3xl space-y-3 relative z-10">
          <div className="inline-flex items-center gap-2 bg-amber-400 text-gray-950 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            <Moon className="w-4 h-4" />
            <span>{isUrdu ? 'اسلامی تعلیمات و اوقاتِ نماز' : 'Islamic Life & Resources'}</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black">
            {isUrdu ? 'اوقاتِ نماز، ہجری کلینڈر، دعائیں اور زکوٰۃ گائیڈ' : 'Prayer Times, Hijri Calendar & Zakat Guide'}
          </h1>
          <p className="text-emerald-200 text-xs sm:text-sm leading-relaxed">
            {isUrdu
              ? 'جامعہ علومِ اسلامیہ علامہ بنوری ٹاؤن اور دارالعلوم کراچی کے مصدقہ معیاری اوقات کے مطابق'
              : 'Accurate prayer times calculated using Karachi University of Islamic Sciences convention.'}
          </p>
        </div>
      </div>

      {/* Prayer Times Section */}
      <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-700" />
              <span>{isUrdu ? 'آج کے اوقاتِ نماز' : 'Today Prayer Times in Pakistan'}</span>
            </h2>
            <p className="text-xs text-gray-500">
              {prayerData?.hijriDateEn} • {prayerData?.hijriDateUr}
            </p>
          </div>

          {/* City Selector */}
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-emerald-600"
            >
              <option value="karachi">Karachi (کراچی)</option>
              <option value="lahore">Lahore (لاہور)</option>
              <option value="islamabad">Islamabad (اسلام آباد)</option>
              <option value="peshawar">Peshawar (پشاور)</option>
              <option value="quetta">Quetta (کوئٹہ)</option>
            </select>
          </div>
        </div>

        {/* Prayer Cards Grid */}
        {prayerData && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { nameEn: 'Fajr', nameUr: 'فجر', time: prayerData.fajr, active: false },
              { nameEn: 'Sunrise', nameUr: 'طلوعِ آفتاب', time: prayerData.sunrise, active: false },
              { nameEn: 'Dhuhr', nameUr: 'ظہر', time: prayerData.dhuhr, active: true },
              { nameEn: 'Asr', nameUr: 'عصر', time: prayerData.asr, active: false },
              { nameEn: 'Maghrib', nameUr: 'مغرب', time: prayerData.maghrib, active: false },
              { nameEn: 'Isha', nameUr: 'عشاء', time: prayerData.isha, active: false },
            ].map((p, i) => (
              <div
                key={i}
                className={`p-4 rounded-2xl text-center border transition-all ${
                  p.active
                    ? 'bg-emerald-700 text-white border-emerald-600 shadow-md scale-102'
                    : 'bg-gray-50 border-gray-200 text-gray-800'
                }`}
              >
                <div className={`text-xs font-bold ${p.active ? 'text-amber-300' : 'text-gray-500'}`}>
                  {isUrdu ? p.nameUr : p.nameEn}
                </div>
                <div className="text-lg font-black mt-1 font-mono">{p.time}</div>
                {p.active && (
                  <span className="inline-block mt-1 text-[9px] font-bold bg-amber-400 text-gray-950 px-2 py-0.5 rounded-full uppercase">
                    Current
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Sehri & Iftar Box */}
        {prayerData && (
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2">
              <Moon className="w-4 h-4 text-emerald-800" />
              <span className="font-bold text-emerald-950">
                {isUrdu ? 'سحری اور افطار اوقات (نفلی و رمضانی روزے):' : 'Sehri & Iftar Timings (Fast Timing):'}
              </span>
            </div>
            <div className="flex items-center gap-6 font-mono font-bold text-emerald-900">
              <div>Sehri Ends: <span className="text-emerald-700">{prayerData.sehriEnds}</span></div>
              <div>Iftar: <span className="text-emerald-700">{prayerData.iftar}</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Zakat Calculator in PKR */}
      <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-emerald-700" />
            <h3 className="text-lg font-black text-gray-900">
              {isUrdu ? 'مستند زکوٰۃ کیلکولیٹر (پاکستانی روپے میں)' : 'Zakat Calculator in Pakistani Rupees (PKR)'}
            </h3>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {isUrdu
              ? `چاندی کا نصاب: 52.5 تولہ (تقریباً 175,875 روپے)۔ نصاب سے زائد خالص اثاثوں پر 2.5 فیصد زکوٰۃ واجب الادا ہوتی ہے۔`
              : `Current Silver Nisab (52.5 tolas): Approx Rs. ${NISAB_THRESHOLD_PKR.toLocaleString()}. Zakat rate is 2.5% on net qualifying wealth.`}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              {isUrdu ? 'نقد رقم اور بینک بیلنس (PKR)' : 'Cash in Hand & Bank Accounts (PKR)'}
            </label>
            <input
              type="number"
              value={cashPkr}
              onChange={(e) => setCashPkr(e.target.value)}
              placeholder="0"
              className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl font-mono text-xs font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              {isUrdu ? 'سونا (تولہ میں)' : 'Gold Owned (in Tolas)'}
            </label>
            <input
              type="number"
              value={goldTolas}
              onChange={(e) => setGoldTolas(e.target.value)}
              placeholder="0"
              className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl font-mono text-xs font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              {isUrdu ? 'چاندی (تولہ میں)' : 'Silver Owned (in Tolas)'}
            </label>
            <input
              type="number"
              value={silverTolas}
              onChange={(e) => setSilverTolas(e.target.value)}
              placeholder="0"
              className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl font-mono text-xs font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              {isUrdu ? 'تجارتی مال و اسٹاک کی مالیت (PKR)' : 'Business Stock & Merchandise (PKR)'}
            </label>
            <input
              type="number"
              value={businessStockPkr}
              onChange={(e) => setBusinessStockPkr(e.target.value)}
              placeholder="0"
              className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl font-mono text-xs font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-red-600 mb-1">
              {isUrdu ? 'منہا کیے جانے والے واجب الادا قرضے (PKR)' : 'Immediate Debts & Liabilities (PKR)'}
            </label>
            <input
              type="number"
              value={debtsPkr}
              onChange={(e) => setDebtsPkr(e.target.value)}
              placeholder="0"
              className="w-full p-3 bg-red-50 border border-red-200 rounded-xl font-mono text-xs font-bold text-red-800"
            />
          </div>

          {/* Result Card */}
          <div className="bg-gradient-to-br from-emerald-800 to-teal-900 text-white p-4 rounded-2xl flex flex-col justify-between">
            <span className="text-[11px] text-emerald-200 font-bold uppercase tracking-wider">
              {isUrdu ? 'واجب الادا زکوٰۃ (2.5%)' : 'Net Zakat Payable'}
            </span>
            <div className="text-2xl font-black font-mono text-amber-300 mt-1">
              Rs. {Math.round(zakatPayablePkr).toLocaleString()}
            </div>
            <div className="text-[10px] text-emerald-200 mt-1">
              {isEligibleForZakat
                ? (isUrdu ? '✓ آپ کا مال نصاب سے زیادہ ہے' : '✓ Wealth exceeds silver nisab')
                : (isUrdu ? 'مال نصاب سے کم ہے، زکوٰۃ فرض نہیں' : 'Wealth is below nisab')}
            </div>
          </div>
        </div>
      </div>

      {/* Daily Duas & Hadith */}
      <div className="space-y-4">
        <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-emerald-700" />
          <span>{isUrdu ? 'روزمرہ مسنون دعائیں و ارشاداتِ نبوی ﷺ' : 'Daily Verified Duas & Hadith'}</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dailyDuas.map((d, i) => (
            <div key={i} className="bg-white border border-gray-200 p-6 rounded-3xl shadow-xs space-y-3">
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md">
                {isUrdu ? d.titleUr : d.titleEn}
              </span>
              <p className="text-lg font-bold text-emerald-950 font-urdu leading-loose text-center py-2">
                {d.arabic}
              </p>
              <p className="text-xs text-gray-700 font-urdu leading-relaxed">
                {d.urdu}
              </p>
              <div className="text-[10px] text-gray-400 font-semibold pt-2 border-t">
                {d.reference}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
