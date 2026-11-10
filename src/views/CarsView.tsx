import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { Automobile } from '../types/index.ts';
import { Car, Bike, Gauge, Fuel, Cog, CheckCircle2 } from 'lucide-react';

export const CarsView: React.FC = () => {
  const { isUrdu } = useLanguage();
  const [automobiles, setAutomobiles] = useState<Automobile[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'car' | 'bike'>('all');

  useEffect(() => {
    fetch('/api/automotive')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAutomobiles(data.automobiles);
        }
      })
      .catch(console.error);
  }, []);

  const filtered = activeFilter === 'all'
    ? automobiles
    : automobiles.filter(a => a.type === activeFilter);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-teal-950 text-white rounded-3xl p-6 sm:p-10 shadow-xl">
        <div className="inline-flex items-center gap-2 bg-amber-400 text-gray-950 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
          <Car className="w-4 h-4" />
          <span>{isUrdu ? 'آٹو موٹیو و گاڑیاں' : 'Pakistan Automotive Portal'}</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-black">
          {isUrdu ? 'پاکستان میں کاروں اور موٹر سائیکلوں کی قیمتیں اور خصوصیات' : 'New Cars & Bikes Prices & Specifications in Pakistan'}
        </h1>
        <p className="text-emerald-200 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
          {isUrdu
            ? 'ٹویوٹا، ہونڈا، سوزوکی، ہیول اور یاماہا کے ماڈلز، فیول ایوریج، انجن پاور اور موازنہ'
            : 'Explore on-road showroom prices, fuel economy (km/l), engine capacity and trims.'}
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
            activeFilter === 'all'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          {isUrdu ? 'تمام گاڑیاں و بائیکس' : 'All Vehicles'}
        </button>
        <button
          onClick={() => setActiveFilter('car')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeFilter === 'car'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <Car className="w-3.5 h-3.5" />
          <span>{isUrdu ? 'کاریں (Cars)' : 'Cars'}</span>
        </button>
        <button
          onClick={() => setActiveFilter('bike')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeFilter === 'bike'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <Bike className="w-3.5 h-3.5" />
          <span>{isUrdu ? 'موٹر سائیکلز (Bikes)' : 'Bikes'}</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((auto) => (
          <div key={auto.id} className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-xs hover:shadow-lg transition-all flex flex-col justify-between group">
            <div>
              <div className="aspect-16/10 bg-gray-100 overflow-hidden relative">
                <img
                  src={auto.image}
                  alt={auto.model}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <span className="absolute top-3 left-3 bg-gray-900/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-md uppercase backdrop-blur-xs">
                  {auto.brand} • {auto.year}
                </span>
              </div>

              <div className="p-5 space-y-2">
                <h3 className="font-extrabold text-base text-gray-900 group-hover:text-emerald-700 transition-colors">
                  {auto.brand} {auto.model}
                </h3>
                <div className="text-xl font-black text-gray-950 font-mono">
                  Rs. {auto.pricePkr.toLocaleString()}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600 border-t border-gray-100 pt-3">
                  <div className="flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-gray-400" />
                    <span>{auto.engineCc}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Cog className="w-3.5 h-3.5 text-gray-400" />
                    <span className="truncate">{auto.transmission}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Fuel className="w-3.5 h-3.5 text-gray-400" />
                    <span>{auto.mileage}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 pt-0">
              <button className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl transition-colors">
                {isUrdu ? 'مکمل تفصیل و فنانسنگ' : 'View Specs & Installment Plans'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
