import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { PrizeBondDraw } from '../types/index.ts';
import { Ticket, Search, Award, CheckCircle2, AlertCircle, Calendar, MapPin } from 'lucide-react';

export const PrizeBondsView: React.FC = () => {
  const { isUrdu } = useLanguage();
  const [draws, setDraws] = useState<PrizeBondDraw[]>([]);
  const [selectedDenom, setSelectedDenom] = useState<number>(1500);
  const [checkNumber, setCheckNumber] = useState('');
  const [checkResult, setCheckResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/prizebonds/draws')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setDraws(data.draws);
        }
      })
      .catch(console.error);
  }, []);

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkNumber.trim()) return;

    setLoading(true);
    setError(null);
    setCheckResult(null);

    try {
      const res = await fetch(`/api/prizebonds/check?denomination=${selectedDenom}&number=${checkNumber.trim()}`);
      const data = await res.json();
      if (data.success) {
        setCheckResult(data.check);
      } else {
        setError(data.error || 'Could not verify prize bond.');
      }
    } catch {
      setError('Connection error checking prize bond records.');
    } finally {
      setLoading(false);
    }
  };

  const denominations = [
    { value: 100, label: 'Rs. 100' },
    { value: 200, label: 'Rs. 200' },
    { value: 750, label: 'Rs. 750' },
    { value: 1500, label: 'Rs. 1,500' },
    { value: 25000, label: 'Rs. 25,000 Premium' },
    { value: 40000, label: 'Rs. 40,000 Premium' },
  ];

  const currentDraw = draws.find(d => d.denomination === selectedDenom) || draws[0];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-teal-900 to-emerald-900 text-white rounded-3xl p-6 sm:p-10 shadow-xl">
        <div className="inline-flex items-center gap-2 bg-amber-400 text-gray-950 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
          <Ticket className="w-4 h-4" />
          <span>{isUrdu ? 'قومی بچت پرائز بانڈ' : 'National Savings Prize Bonds'}</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-black">
          {isUrdu ? 'پرائز بانڈ قرعہ اندازی نتائج و آن لائن نمبر چیکر 2026' : 'Pakistan Prize Bond Draw Results & Number Checker 2026'}
        </h1>
        <p className="text-emerald-200 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
          {isUrdu
            ? 'اسٹیٹ بینک آف پاکستان اور سینٹرل ڈائریکٹوریٹ آف نیشنل سیونگز کی مصدقہ سرکاری قرعہ اندازی کے نتائج'
            : 'Official draw schedules and instant winning number verification for Rs. 100 to Rs. 40,000.'}
        </p>
      </div>

      {/* Interactive Number Checker Card */}
      <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="border-b border-gray-100 pb-4">
          <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <Search className="w-5 h-5 text-emerald-700" />
            <span>{isUrdu ? 'پرائز بانڈ نمبر چیک کریں (فوری انعام معلوم کریں)' : 'Instant Prize Bond Number Checker'}</span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {isUrdu ? 'پرائز بانڈ کی مالیت منتخب کریں اور 6 ہندسوں کا بانڈ نمبر درج کریں' : 'Select bond denomination and enter your 6-digit number to check against official draws'}
          </p>
        </div>

        {/* Demo Fast Fill */}
        <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs flex flex-wrap items-center gap-2">
          <span className="font-bold text-emerald-900">
            {isUrdu ? 'آزمائشی جیتنے والے نمبرز:' : 'Try Verified Winning Numbers:'}
          </span>
          <button
            onClick={() => { setSelectedDenom(1500); setCheckNumber('741295'); }}
            className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-800 rounded-lg border border-emerald-300 font-semibold"
          >
            Rs. 1,500: #741295 (1st Prize)
          </button>
          <button
            onClick={() => { setSelectedDenom(1500); setCheckNumber('182940'); }}
            className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-800 rounded-lg border border-emerald-300 font-semibold"
          >
            Rs. 1,500: #182940 (2nd Prize)
          </button>
          <button
            onClick={() => { setSelectedDenom(750); setCheckNumber('481920'); }}
            className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-800 rounded-lg border border-emerald-300 font-semibold"
          >
            Rs. 750: #481920 (1st Prize)
          </button>
        </div>

        <form onSubmit={handleCheck} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              {isUrdu ? 'پرائز بانڈ کی مالیت' : 'Denomination'}
            </label>
            <select
              value={selectedDenom}
              onChange={(e) => setSelectedDenom(parseInt(e.target.value))}
              className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-emerald-600"
            >
              {denominations.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              {isUrdu ? '6 ہندسوں کا بانڈ نمبر' : '6-Digit Bond Number'}
            </label>
            <input
              type="text"
              value={checkNumber}
              onChange={(e) => setCheckNumber(e.target.value)}
              placeholder="e.g. 741295"
              maxLength={6}
              className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading || !checkNumber.trim()}
              className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4" />
              <span>{loading ? (isUrdu ? 'تلاش جاری ہے...' : 'Checking...') : (isUrdu ? 'نمبر چیک کریں' : 'Check Number')}</span>
            </button>
          </div>
        </form>

        {/* Verification Result */}
        {checkResult && (
          <div className={`p-6 rounded-3xl border-2 transition-all ${
            checkResult.won
              ? 'bg-amber-50 border-amber-400 text-gray-900'
              : 'bg-gray-50 border-gray-200 text-gray-700'
          }`}>
            {checkResult.won ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-400 text-gray-950 rounded-2xl">
                    <Award className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-extrabold text-amber-800 uppercase tracking-wider">
                      CONGRATULATIONS / مبارکباد
                    </span>
                    <h3 className="text-xl font-black text-gray-950">
                      {checkResult.prizeTier} Winner!
                    </h3>
                  </div>
                </div>
                <div className="text-2xl font-black text-emerald-800 font-mono">
                  {checkResult.prizeAmount}
                </div>
                <p className="text-xs text-gray-600">
                  Bond #{checkNumber} matched official draw held in {checkResult.draw?.cityEn} ({checkResult.draw?.drawDate}).
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-gray-400 shrink-0" />
                <p className="text-xs font-medium">{checkResult.message}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Official Published Draw Archive */}
      {currentDraw && (
        <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full uppercase">
                Official Draw #{currentDraw.drawNumber}
              </span>
              <h3 className="text-xl font-black text-gray-900 mt-1">
                Rs. {currentDraw.denomination.toLocaleString()} Prize Bond Draw Results
              </h3>
              <p className="text-xs text-gray-500 flex items-center gap-3 mt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {currentDraw.drawDate}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {isUrdu ? currentDraw.cityUr : currentDraw.cityEn}
                </span>
              </p>
            </div>
          </div>

          {/* First Prize */}
          <div className="bg-amber-50/70 border border-amber-200 p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wider block">
                {isUrdu ? 'پہلا انعام' : '1st Prize'}
              </span>
              <div className="text-sm font-semibold text-gray-700">{currentDraw.firstPrizePkr}</div>
            </div>
            <div className="text-2xl font-black font-mono text-gray-950 bg-white px-4 py-2 rounded-xl border border-amber-300 shadow-2xs">
              {currentDraw.firstPrizeBond}
            </div>
          </div>

          {/* Second Prize */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-gray-800 uppercase tracking-wider">
                {isUrdu ? 'دوسرا انعام' : '2nd Prize'} ({currentDraw.secondPrizePkr})
              </span>
              <span className="text-gray-400 font-mono">3 Winning Bonds</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {currentDraw.secondPrizeBonds.map((bond, i) => (
                <span key={i} className="px-4 py-2 bg-gray-100 rounded-xl font-mono font-bold text-gray-900 text-sm">
                  {bond}
                </span>
              ))}
            </div>
          </div>

          {/* Third Prize Sample */}
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-gray-800 uppercase tracking-wider">
                {isUrdu ? 'تیسرا انعام (نمونہ فہرست)' : '3rd Prize (Sample List)'} ({currentDraw.thirdPrizePkr})
              </span>
              <span className="text-gray-400">1,696 Winners Total</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
              {currentDraw.thirdPrizeSample.map((num, i) => (
                <div key={i} className="p-2 bg-gray-50 rounded-lg font-mono text-xs text-gray-700">
                  {num}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
