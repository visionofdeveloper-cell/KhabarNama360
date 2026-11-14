import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { WeatherData } from '../types/index.ts';
import {
  CloudSun,
  Wind,
  Droplets,
  Gauge,
  Sunrise,
  Sunset,
  AlertTriangle,
  Compass,
  MapPin
} from 'lucide-react';
import { safeFetchJson } from '../utils/safeFetch.ts';

export const WeatherView: React.FC = () => {
  const { isUrdu } = useLanguage();
  const [cities, setCities] = useState<WeatherData[]>([]);
  const [activeCityId, setActiveCityId] = useState('karachi');

  useEffect(() => {
    const loadWeather = async () => {
      const data = await safeFetchJson('/api/weather');
      if (data.success && Array.isArray(data.weather)) {
        setCities(data.weather);
      }
    };
    void loadWeather();
    const interval = setInterval(() => void loadWeather(), 180_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void loadWeather();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const currentCity = cities.find(c => c.cityId === activeCityId) || cities[0];

  const getAqiColor = (aqi: number) => {
    if (aqi <= 50) return 'bg-emerald-500 text-white';
    if (aqi <= 100) return 'bg-amber-400 text-gray-900';
    if (aqi <= 150) return 'bg-orange-500 text-white';
    return 'bg-red-600 text-white';
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* City Switcher Pill Bar */}
      <div className="bg-white border border-gray-200 rounded-3xl p-3 shadow-xs overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2 whitespace-nowrap min-w-max">
          {cities.map((city) => {
            const isActive = city.cityId === (currentCity?.cityId || 'karachi');
            return (
              <button
                key={city.cityId}
                onClick={() => setActiveCityId(city.cityId)}
                className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
                  isActive
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>{isUrdu ? city.nameUr : city.nameEn}</span>
                <span className={`text-[11px] font-mono ${isActive ? 'text-amber-300' : 'text-gray-500'}`}>
                  {city.tempC}°C
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {currentCity && (
        <>
          {/* Main Weather Card */}
          <div className="bg-gradient-to-br from-teal-800 via-emerald-800 to-emerald-950 text-white rounded-3xl p-6 sm:p-10 shadow-xl relative overflow-hidden">
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
              {/* City & Temperature */}
              <div className="md:col-span-6 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-300">
                    {isUrdu ? currentCity.provinceUr : currentCity.provinceEn}
                  </span>
                  <span className="bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>{isUrdu ? 'اوپن میٹیو و محکمہ موسمیات لائیو فیڈ' : 'Open-Meteo & PMD Live Observation'}</span>
                  </span>
                </div>
                <h1 className="text-3xl sm:text-5xl font-black">
                  {isUrdu ? currentCity.nameUr : currentCity.nameEn}
                </h1>
                <p className="text-emerald-100 text-sm font-semibold">
                  {isUrdu ? currentCity.conditionUr : currentCity.conditionEn}
                </p>

                <div className="flex items-baseline gap-4 pt-3">
                  <span className="text-6xl sm:text-7xl font-black font-mono">
                    {currentCity.tempC}°
                  </span>
                  <div className="text-xs text-emerald-200 space-y-0.5">
                    <div>High: <span className="font-bold text-white">{currentCity.highC}°C</span></div>
                    <div>Low: <span className="font-bold text-white">{currentCity.lowC}°C</span></div>
                    <div>Feels like: <span className="font-bold text-white">{currentCity.feelsLikeC}°C</span></div>
                  </div>
                </div>
              </div>

              {/* Air Quality & Key Metrics */}
              <div className="md:col-span-6 grid grid-cols-2 gap-3 text-xs">
                {/* AQI Indicator */}
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-200">
                    <Gauge className="w-4 h-4 text-amber-300" />
                    <span className="font-bold">{isUrdu ? 'فضائی معیار (AQI)' : 'Air Quality Index'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black font-mono">{currentCity.aqi}</span>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${getAqiColor(currentCity.aqi)}`}>
                      {isUrdu ? currentCity.aqiStatusUr : currentCity.aqiStatusEn}
                    </span>
                  </div>
                  <div className="text-[10px] text-emerald-200">
                    {currentCity.aqi > 100
                      ? (isUrdu ? 'اسموگ احتیاط: ماسک کا استعمال کریں' : 'Smog Advisory: Wear N95 outdoors')
                      : (isUrdu ? 'ہوا کا معیار معمول کے مطابق' : 'Clean mountain / coastal air')}
                  </div>
                </div>

                {/* Humidity */}
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15 space-y-1">
                  <div className="flex items-center gap-2 text-emerald-200">
                    <Droplets className="w-4 h-4 text-sky-300" />
                    <span className="font-bold">{isUrdu ? 'نمی (Humidity)' : 'Humidity'}</span>
                  </div>
                  <div className="text-2xl font-black font-mono">{currentCity.humidity}%</div>
                  <div className="text-[10px] text-emerald-200">Normal coastal & riverine zone</div>
                </div>

                {/* Wind */}
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15 space-y-1">
                  <div className="flex items-center gap-2 text-emerald-200">
                    <Wind className="w-4 h-4 text-emerald-300" />
                    <span className="font-bold">{isUrdu ? 'ہوا کی رفتار' : 'Wind Speed'}</span>
                  </div>
                  <div className="text-2xl font-black font-mono">{currentCity.windKmh} km/h</div>
                  <div className="text-[10px] text-emerald-200">Moderate breeze</div>
                </div>

                {/* Sun Times */}
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15 space-y-1">
                  <div className="flex items-center gap-2 text-emerald-200">
                    <Sunrise className="w-4 h-4 text-amber-300" />
                    <span className="font-bold">{isUrdu ? 'طلوع و غروب' : 'Sun Timings'}</span>
                  </div>
                  <div className="text-[11px] font-mono text-white mt-1">
                    <div>Rise: {currentCity.sunrise}</div>
                    <div>Set: {currentCity.sunset}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Hourly Forecast */}
          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs space-y-4">
            <h3 className="font-black text-gray-900 text-sm uppercase tracking-wider">
              {isUrdu ? 'آج کے گھنٹہ وار موسمی حالات' : 'Today Hourly Forecast'}
            </h3>
            <div className="grid grid-cols-5 gap-3">
              {currentCity.hourly.map((h, i) => (
                <div key={i} className="text-center p-3 bg-gray-50 rounded-2xl border border-gray-100 space-y-1">
                  <div className="text-xs font-mono text-gray-500 font-semibold">{h.time}</div>
                  <div className="text-lg font-black text-emerald-800 font-mono">{h.tempC}°C</div>
                  <div className="text-[10px] text-gray-600">{h.condition}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 5-Day Extended Forecast */}
          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs space-y-4">
            <h3 className="font-black text-gray-900 text-sm uppercase tracking-wider">
              {isUrdu ? 'آئندہ 5 دنوں کی پیش گوئی' : '5-Day Extended Weather Outlook'}
            </h3>
            <div className="divide-y divide-gray-100">
              {currentCity.daily.map((d, i) => (
                <div key={i} className="py-3 flex items-center justify-between text-xs">
                  <div className="font-bold text-gray-900 w-24">
                    {isUrdu ? d.dayUr : d.dayEn}
                  </div>
                  <div className="text-gray-600 flex-1">
                    {isUrdu ? d.conditionUr : d.conditionEn}
                  </div>
                  <div className="font-mono text-end font-bold space-x-2">
                    <span className="text-gray-900">{d.highC}°</span>
                    <span className="text-gray-400 font-normal">{d.lowC}°</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
