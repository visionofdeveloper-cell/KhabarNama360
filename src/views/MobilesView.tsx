import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { MobilePhone } from '../types/index.ts';
import { Smartphone, Star, Cpu, Battery, Camera, HardDrive, Check, Columns, Search } from 'lucide-react';

export const MobilesView: React.FC = () => {
  const { isUrdu } = useLanguage();
  const [mobiles, setMobiles] = useState<MobilePhone[]>([]);
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [compareA, setCompareA] = useState<string>('mob-1');
  const [compareB, setCompareB] = useState<string>('mob-2');

  useEffect(() => {
    fetch('/api/mobiles')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setMobiles(data.mobiles);
        }
      })
      .catch(console.error);
  }, []);

  const filteredMobiles = selectedBrand === 'all'
    ? mobiles
    : mobiles.filter(m => m.brand.toLowerCase() === selectedBrand.toLowerCase());

  const phoneA = mobiles.find(m => m.id === compareA);
  const phoneB = mobiles.find(m => m.id === compareB);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-900 to-emerald-950 text-white rounded-3xl p-6 sm:p-10 shadow-xl">
        <div className="inline-flex items-center gap-2 bg-amber-400 text-gray-950 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
          <Smartphone className="w-4 h-4" />
          <span>{isUrdu ? 'موبائل فونز اور ٹیکنالوجی' : 'Mobile Prices in Pakistan'}</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-black">
          {isUrdu ? 'پاکستان میں تمام برانڈز کے اسمارٹ فونز کی سرکاری قیمتیں' : 'Official Smartphone Specifications & PKR Prices 2026'}
        </h1>
        <p className="text-emerald-200 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
          {isUrdu
            ? 'سام سنگ، ایپل آئی فون، شیاؤمی، انفینکس، ویوو اور اوپو کے جدید ماڈلز کے مکمل فیچرز اور موازنہ'
            : 'Explore PTA-approved retail prices, camera benchmarks, battery tests, and compare specs.'}
        </p>
      </div>

      {/* Brand Filters */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
        {['all', 'Samsung', 'Apple', 'Xiaomi', 'Infinix'].map((brand) => (
          <button
            key={brand}
            onClick={() => setSelectedBrand(brand)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all capitalize whitespace-nowrap ${
              selectedBrand === brand
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {brand === 'all' ? (isUrdu ? 'تمام برانڈز' : 'All Brands') : brand}
          </button>
        ))}
      </div>

      {/* Mobile Phones Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {filteredMobiles.map((mob) => (
          <div key={mob.id} className="bg-white border border-gray-200 rounded-3xl p-4 shadow-xs hover:shadow-lg transition-all flex flex-col justify-between group">
            <div className="space-y-3">
              <div className="aspect-square bg-gray-50 rounded-2xl overflow-hidden flex items-center justify-center p-4">
                <img
                  src={mob.image}
                  alt={mob.model}
                  className="max-h-full object-contain group-hover:scale-105 transition-transform"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="font-bold text-emerald-700">{mob.brand}</span>
                  <span className="flex items-center gap-1 text-amber-500 font-bold">
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    {mob.rating}
                  </span>
                </div>
                <h3 className="font-extrabold text-sm text-gray-900 mt-1 line-clamp-1">
                  {mob.model}
                </h3>
                <div className="text-base font-black text-gray-900 font-mono mt-1">
                  Rs. {mob.pricePkr.toLocaleString()}
                </div>
              </div>

              {/* Specs Pills */}
              <div className="space-y-1.5 text-[11px] text-gray-600 border-t border-gray-100 pt-3">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span>{mob.ram} RAM / {mob.storage}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Camera className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="truncate">{mob.camera}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Battery className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="truncate">{mob.battery}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setCompareA(mob.id);
                window.scrollTo({ top: 800, behavior: 'smooth' });
              }}
              className="mt-4 w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl transition-colors"
            >
              {isUrdu ? 'موازنہ میں شامل کریں' : 'Add to Comparison'}
            </button>
          </div>
        ))}
      </div>

      {/* Side-by-Side Comparison Module */}
      {phoneA && phoneB && (
        <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <Columns className="w-5 h-5 text-emerald-700" />
              <span>{isUrdu ? 'دو اسمارٹ فونز کا تفصیلی آمنے سامنے موازنہ' : 'Side-by-Side Phone Specification Comparison'}</span>
            </h3>
            <p className="text-xs text-gray-500">
              {isUrdu ? 'قیمت، کیمرہ، ریم، بیٹری اور پروسیسر کی خصوصیات کا موازنہ کریں' : 'Compare key Pakistani specs and prices side-by-side'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Device 1</label>
              <select
                value={compareA}
                onChange={(e) => setCompareA(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold"
              >
                {mobiles.map(m => (
                  <option key={m.id} value={m.id}>{m.brand} {m.model}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Device 2</label>
              <select
                value={compareB}
                onChange={(e) => setCompareB(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold"
              >
                {mobiles.map(m => (
                  <option key={m.id} value={m.id}>{m.brand} {m.model}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="p-3 font-bold text-gray-500 w-1/4">Price in Pakistan</td>
                  <td className="p-3 font-black text-emerald-700 font-mono text-sm w-3/8">Rs. {phoneA.pricePkr.toLocaleString()}</td>
                  <td className="p-3 font-black text-emerald-700 font-mono text-sm w-3/8">Rs. {phoneB.pricePkr.toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-gray-500">RAM / Storage</td>
                  <td className="p-3 text-gray-800 font-medium">{phoneA.ram} / {phoneA.storage}</td>
                  <td className="p-3 text-gray-800 font-medium">{phoneB.ram} / {phoneB.storage}</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-gray-500">Display</td>
                  <td className="p-3 text-gray-800 font-medium">{phoneA.display}</td>
                  <td className="p-3 text-gray-800 font-medium">{phoneB.display}</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-gray-500">Camera</td>
                  <td className="p-3 text-gray-800 font-medium">{phoneA.camera}</td>
                  <td className="p-3 text-gray-800 font-medium">{phoneB.camera}</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-gray-500">Battery & Charging</td>
                  <td className="p-3 text-gray-800 font-medium">{phoneA.battery}</td>
                  <td className="p-3 text-gray-800 font-medium">{phoneB.battery}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
