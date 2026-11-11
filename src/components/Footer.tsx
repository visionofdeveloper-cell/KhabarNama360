import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { Mail, CheckCircle2, Phone, MapPin, Send, ShieldCheck, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  const { isUrdu, t, navigateTo } = useLanguage();
  const [emailInput, setEmailInput] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailInput.trim()) {
      setSubscribed(true);
      setEmailInput('');
      setTimeout(() => setSubscribed(false), 4000);
    }
  };

  const categoriesCol1 = [
    { id: 'pakistan', labelEn: 'Pakistan News', labelUr: 'قومی خبریں' },
    { id: 'politics', labelEn: 'Politics & Parliament', labelUr: 'سیاست و حکومت' },
    { id: 'business', labelEn: 'Business & PSX 100', labelUr: 'معیشت و اسٹاک ایکسچینج' },
    { id: 'sports', labelEn: 'Cricket Scores & PSL', labelUr: 'کرکٹ لائیو اسکور' },
    { id: 'education', labelEn: 'BISE Boards & Results', labelUr: 'تعلیمی بورڈز و نتائج' },
  ];

  const categoriesCol2 = [
    { id: 'weather', labelEn: 'Pakistan Weather & AQI', labelUr: 'موسم و اسموگ انڈیکس' },
    { id: 'islamic', labelEn: 'Prayer Times & Hijri Calendar', labelUr: 'اوقاتِ نماز و ہجری کلینڈر' },
    { id: 'mobiles', labelEn: 'Mobile Prices in Pakistan', labelUr: 'موبائل فونز کی قیمتیں' },
    { id: 'automobiles', labelEn: 'Cars & Bikes Directory', labelUr: 'گاڑیاں اور موٹر سائیکلز' },
    { id: 'prizebonds', labelEn: 'Prize Bond Draw Checker', labelUr: 'پرائز بانڈ قرعہ اندازی' },
  ];

  const categoriesCol3 = [
    { id: 'dictionary', labelEn: 'English - Urdu Dictionary', labelUr: 'انگلش ٹو اردو لغت' },
    { id: 'poetry', labelEn: 'Urdu Poetry & Ghazals', labelUr: 'اردو شاعری و غزلیات' },
    { id: 'recipes', labelEn: 'Pakistani Cuisine Recipes', labelUr: 'پاکستانی لذیذ پکوان' },
    { id: 'jobs', labelEn: 'Govt & Private Jobs', labelUr: 'سرکاری و نجی نوکریاں' },
    { id: 'tools', labelEn: 'Electricity & Zakat Calculators', labelUr: 'بجلی بل و زکوٰۃ کیلکولیٹر' },
  ];

  return (
    <footer className="bg-gray-950 text-gray-300 border-t-4 border-emerald-600 mt-16 text-sm">
      {/* Newsletter Bar */}
      <div className="bg-emerald-900/40 border-b border-emerald-800/40 py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-start">
            <h4 className="text-lg font-bold text-white flex items-center justify-center md:justify-start gap-2">
              <Mail className="w-5 h-5 text-amber-400" />
              <span>{isUrdu ? 'روزانہ کی اہم ترین خبریں ای میل پر حاصل کریں' : 'Subscribe to Pakistan Daily Morning Briefing'}</span>
            </h4>
            <p className="text-xs text-emerald-200/80 mt-1">
              {isUrdu ? 'ملکی سیاست، معیشت، صرافہ مارکیٹ اور امتحانات کے باضابطہ نوٹیفکیشنز' : 'Curated national headlines, gold rates, and board alerts direct to your inbox.'}
            </p>
          </div>

          <form onSubmit={handleSubscribe} className="flex w-full md:w-auto max-w-md gap-2">
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              required
              placeholder={isUrdu ? 'اپنا ای میل درج کریں...' : 'Enter your email address...'}
              className="px-4 py-2.5 bg-gray-900 border border-emerald-700/60 rounded-xl text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-amber-400 flex-1"
            />
            <button
              type="submit"
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-gray-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shrink-0 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isUrdu ? 'شامل ہوں' : 'Subscribe'}</span>
            </button>
          </form>

          {subscribed && (
            <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold bg-emerald-950/80 px-3 py-1.5 rounded-lg border border-emerald-500/40">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{isUrdu ? 'شکریہ! آپ نیوز لیٹر میں رجسٹر ہو چکے ہیں۔' : 'Thank you! You are now subscribed.'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Sitemap & Information Columns */}
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
        {/* Brand Overview */}
        <div className="lg:col-span-2 space-y-4">
          <div
            onClick={() => navigateTo('home')}
            className="cursor-pointer flex items-center gap-3"
          >
            <img
              src="/assets/aistudio/Modern_Green_and_Gold_News_Logo_2e9a99d4.png"
              alt="360Khabarnama Logo"
              className="h-10 w-auto max-w-[200px] object-contain rounded-lg bg-white p-1"
            />
            <div>
              <h3 className="text-lg font-black text-white">
                {isUrdu ? '360 خبرنامہ' : '360Khabarnama'}
              </h3>
              <p className="text-xs text-emerald-400 font-semibold">
                {isUrdu ? 'آوازِ پاکستان - صحافت، معلومات اور خدمات' : 'The Voice of Pakistan'}
              </p>
            </div>
          </div>

          <p className="text-xs text-gray-400 leading-relaxed font-urdu">
            {isUrdu
              ? '360 خبرنامہ پاکستان کا سب سے جامع دو لسانی ڈیجیٹل پلیٹ فارم جو معتبر قومی و بین الاقوامی خبریں، تعلیمی بورڈز کے نتائج، لائیو کرکٹ اسکور، صرافہ و کرنسی ریٹس، پرائز بانڈ معلومات اور روزمرہ آن لائن ٹولز پیش کرتا ہے۔'
              : '360Khabarnama is Pakistan’s premier bilingual information network offering verified national news, BISE educational board results, real-time cricket updates, financial indicators, Islamic resources, and digital citizen utilities.'}
          </p>

          <div className="space-y-1.5 text-xs text-gray-400 pt-2 border-t border-gray-800">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{isUrdu ? 'نیوز ہیڈ کوارٹرز: بلیو ایریا، اسلام آباد، پاکستان' : 'News Headquarters: Blue Area, Islamabad, Pakistan'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
              <span dir="ltr">+92 (051) 920-1122</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{isUrdu ? 'ایڈیٹوریل بورڈ: پریس کونسل آف پاکستان ضابطۂ اخلاق کی پابندی' : 'Complies with Press Council of Pakistan Editorial Standards'}</span>
            </div>
          </div>
        </div>

        {/* Categories Col 1 */}
        <div>
          <h5 className="text-xs font-bold text-white uppercase tracking-wider mb-3 text-emerald-400">
            {isUrdu ? 'خبریں و سیاست' : 'News & Politics'}
          </h5>
          <ul className="space-y-2 text-xs">
            {categoriesCol1.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => navigateTo(item.id)}
                  className="hover:text-amber-400 transition-colors text-start"
                >
                  {isUrdu ? item.labelUr : item.labelEn}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Categories Col 2 */}
        <div>
          <h5 className="text-xs font-bold text-white uppercase tracking-wider mb-3 text-emerald-400">
            {isUrdu ? 'معلومات و مارکیٹس' : 'Information & Markets'}
          </h5>
          <ul className="space-y-2 text-xs">
            {categoriesCol2.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => navigateTo(item.id)}
                  className="hover:text-amber-400 transition-colors text-start"
                >
                  {isUrdu ? item.labelUr : item.labelEn}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Categories Col 3 */}
        <div>
          <h5 className="text-xs font-bold text-white uppercase tracking-wider mb-3 text-emerald-400">
            {isUrdu ? 'ادب، پکوان و ٹولز' : 'Culture & Utilities'}
          </h5>
          <ul className="space-y-2 text-xs">
            {categoriesCol3.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => navigateTo(item.id)}
                  className="hover:text-amber-400 transition-colors text-start"
                >
                  {isUrdu ? item.labelUr : item.labelEn}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Bottom Bar & Legal Notice */}
      <div className="bg-black/90 py-4 px-4 text-xs text-gray-500 border-t border-gray-900">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-start">
          <p>{t('common.copyright')}</p>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Privacy Policy</span>
            <span>•</span>
            <span>Terms of Service</span>
            <span>•</span>
            <span>Google News Sitemap</span>
            <span>•</span>
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <span>Made with</span>
              <Heart className="w-3 h-3 text-red-500 fill-red-500" />
              <span>for Pakistan</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
