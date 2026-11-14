import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { Mail, CheckCircle2, Send, Heart, AlertCircle } from 'lucide-react';
import { SiteSettings } from '../types/index.ts';

export const Footer: React.FC = () => {
  const { isUrdu, t, navigateTo, language } = useLanguage();
  const [emailInput, setEmailInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [subFeedback, setSubFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.settings) setSettings(d.settings);
      })
      .catch(() => {});
  }, []);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = emailInput.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setSubFeedback(null);
    try {
      const res = await fetch('/api/audience/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, language }),
      });
      const d = await res.json();
      if (res.ok && d.success) {
        setSubFeedback({
          ok: true,
          text: isUrdu
            ? 'شکریہ! آپ نیوز لیٹر میں رجسٹر ہو چکے ہیں۔'
            : 'Thank you! You are now subscribed to the briefing.',
        });
        setEmailInput('');
      } else {
        setSubFeedback({
          ok: false,
          text: d.error || (isUrdu ? 'رجسٹریشن ممکن نہ ہو سکی۔' : 'Could not complete subscription.'),
        });
      }
    } catch {
      setSubFeedback({
        ok: false,
        text: isUrdu ? 'نیٹ ورک کی خرابی۔ دوبارہ کوشش کریں۔' : 'Network error subscribing. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const showNewsletterBox = settings?.footer?.showNewsletterBox ?? true;
  const copyrightText =
    (isUrdu ? settings?.footer?.copyrightUr : settings?.footer?.copyrightEn) || t('common.copyright');

  return (
    <footer className="bg-gray-950 text-gray-300 border-t-4 border-emerald-600 mt-16 text-sm">
      {/* Newsletter Bar */}
      {showNewsletterBox && (
        <div className="bg-emerald-900/40 border-b border-emerald-800/40 py-8 px-4">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-start">
              <h4 className="text-lg font-bold text-white flex items-center justify-center md:justify-start gap-2">
                <Mail className="w-5 h-5 text-amber-400" />
                <span>{isUrdu ? 'روزانہ کی اہم ترین خبریں ای میل پر حاصل کریں' : 'Subscribe to Pakistan Daily Morning Briefing'}</span>
              </h4>
              <p className="text-xs text-emerald-200/80 mt-1">
                {isUrdu
                  ? 'ملکی سیاست، معیشت، صرافہ مارکیٹ اور امتحانات کے باضابطہ نوٹیفکیشنز'
                  : 'Curated national headlines, gold rates, and board alerts direct to your inbox.'}
              </p>
            </div>

            <div className="w-full md:w-auto max-w-md space-y-2">
              <form onSubmit={handleSubscribe} className="flex gap-2">
                <input
                  type="email"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  required
                  placeholder={isUrdu ? 'اپنا ای میل درج کریں...' : 'Enter your email address...'}
                  className="px-4 py-2.5 bg-gray-900 border border-emerald-700/60 rounded-xl text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-amber-400 flex-1"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-gray-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shrink-0 transition-colors disabled:opacity-60"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submitting ? '...' : isUrdu ? 'شامل ہوں' : 'Subscribe'}</span>
                </button>
              </form>

              {subFeedback && (
                <div
                  className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border ${
                    subFeedback.ok
                      ? 'text-emerald-300 bg-emerald-950/80 border-emerald-500/40'
                      : 'text-rose-200 bg-rose-950/80 border-rose-500/40'
                  }`}
                >
                  {subFeedback.ok ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>{subFeedback.text}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Sitemap & Information Columns */}
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-1 space-y-4">
          <div onClick={() => navigateTo('home')} className="cursor-pointer flex items-center gap-3">
            <img
              src={
                settings?.branding?.logoUrl ||
                '/assets/aistudio/Modern_Green_and_Gold_News_Logo_2e9a99d4.png'
              }
              alt="360Khabarnama Logo"
              className="h-10 w-auto max-w-[200px] object-contain rounded-lg bg-white p-1"
            />
          </div>
          <h3 className="text-base font-black text-white">
            {isUrdu ? settings?.siteNameUr || '360 خبرنامہ' : settings?.siteNameEn || '360Khabarnama'}
          </h3>
          <p className="text-xs text-gray-400 leading-relaxed font-urdu">
            {isUrdu
              ? 'ہر خبر۔ ہر معلومات۔ ایک جگہ۔ — انگریزی اور اردو میں خبریں، مالیاتی ریٹس، کرکٹ، موسم، تعلیمی نتائج اور آن لائن ٹولز۔'
              : 'Your Complete World of News & Information. Bilingual news, live market rates, cricket, weather, education results, and everyday tools.'}
          </p>
        </div>

        {/* Explore */}
        <div>
          <h5 className="text-xs font-bold uppercase tracking-wider mb-3 text-emerald-400">
            {isUrdu ? 'دریافت کریں' : 'Explore'}
          </h5>
          <ul className="space-y-2 text-xs">
            {[
              { id: 'home', en: 'Latest News', ur: 'تازہ ترین خبریں' },
              { id: 'pakistan', en: 'Pakistan News', ur: 'پاکستان' },
              { id: 'politics', en: 'World & Politics', ur: 'سیاست و عالمی خبریں' },
              { id: 'business', en: 'Business', ur: 'کاروبار و معیشت' },
              { id: 'sports', en: 'Cricket', ur: 'کرکٹ' },
              { id: 'weather', en: 'Weather', ur: 'موسم' },
              { id: 'education', en: 'Education', ur: 'تعلیم و نتائج' },
              { id: 'tools', en: 'Tools', ur: 'آن لائن ٹولز' },
            ].map(item => (
              <li key={item.id}>
                <button onClick={() => navigateTo(item.id)} className="hover:text-amber-400 transition-colors text-start">
                  {isUrdu ? item.ur : item.en}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* About */}
        <div>
          <h5 className="text-xs font-bold uppercase tracking-wider mb-3 text-emerald-400">
            {isUrdu ? 'تعارف' : 'About'}
          </h5>
          <ul className="space-y-2 text-xs">
            {[
              { id: 'about', en: 'About Us', ur: 'ہمارے بارے میں' },
              { id: 'team', en: 'Our Team', ur: 'ہماری ٹیم' },
              { id: 'contact', en: 'Contact Us', ur: 'ہم سے رابطہ کریں' },
              { id: 'ownership-funding', en: 'Ownership and Funding', ur: 'ملکیت اور فنڈنگ' },
              { id: 'advertise', en: 'Advertise With Us', ur: 'ہمارے ساتھ اشتہار دیں' },
              { id: 'accessibility', en: 'Accessibility', ur: 'رسائی کا بیان' },
              { id: 'sitemap', en: 'HTML Sitemap', ur: 'ایچ ٹی ایم ایل سائٹ میپ' },
            ].map(item => (
              <li key={item.id}>
                <button onClick={() => navigateTo(item.id)} className="hover:text-amber-400 transition-colors text-start">
                  {isUrdu ? item.ur : item.en}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Legal */}
        <div>
          <h5 className="text-xs font-bold uppercase tracking-wider mb-3 text-emerald-400">
            {isUrdu ? 'قانونی صفحات' : 'Legal'}
          </h5>
          <ul className="space-y-2 text-xs">
            {[
              { id: 'privacy-policy', en: 'Privacy Policy', ur: 'رازداری کی پالیسی' },
              { id: 'terms', en: 'Terms and Conditions', ur: 'شرائط و ضوابط' },
              { id: 'disclaimer', en: 'Disclaimer', ur: 'دستبرداری' },
              { id: 'financial-disclaimer', en: 'Financial Disclaimer', ur: 'مالیاتی دستبرداری' },
              { id: 'health-disclaimer', en: 'Health Disclaimer', ur: 'صحت کی دستبرداری' },
              { id: 'cookie-policy', en: 'Cookie Policy', ur: 'کوکی پالیسی' },
              { id: 'copyright-policy', en: 'Copyright Policy', ur: 'کاپی رائٹ پالیسی' },
              { id: 'advertising-policy', en: 'Advertising Policy', ur: 'اشتہارات کی پالیسی' },
            ].map(item => (
              <li key={item.id}>
                <button onClick={() => navigateTo(item.id)} className="hover:text-amber-400 transition-colors text-start">
                  {isUrdu ? item.ur : item.en}
                </button>
              </li>
            ))}
            <li>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('open-privacy-choices'))}
                className="text-amber-400 hover:text-amber-300 transition-colors text-start font-semibold"
              >
                {isUrdu ? 'پرائیویسی چوائسز' : 'Privacy Choices'}
              </button>
            </li>
          </ul>
        </div>

        {/* Editorial */}
        <div>
          <h5 className="text-xs font-bold uppercase tracking-wider mb-3 text-emerald-400">
            {isUrdu ? 'ادارتی معیارات' : 'Editorial'}
          </h5>
          <ul className="space-y-2 text-xs">
            {[
              { id: 'editorial-policy', en: 'Editorial Policy', ur: 'ادارتی پالیسی' },
              { id: 'corrections-policy', en: 'Corrections Policy', ur: 'تصحیح کی پالیسی' },
              { id: 'fact-checking-policy', en: 'Fact-Checking Policy', ur: 'حقائق کی جانچ' },
              { id: 'ai-content-policy', en: 'AI Content Policy', ur: 'اے آئی مواد کی پالیسی' },
              { id: 'sources-methodology', en: 'Sources and Methodology', ur: 'ذرائع اور طریقہ کار' },
            ].map(item => (
              <li key={item.id}>
                <button onClick={() => navigateTo(item.id)} className="hover:text-amber-400 transition-colors text-start">
                  {isUrdu ? item.ur : item.en}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="bg-black/90 py-4 px-4 text-xs text-gray-500 border-t border-gray-900">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-start">
          <p>{copyrightText}</p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-[11px]">
            <button onClick={() => navigateTo('privacy-policy')} className="hover:text-white">
              {isUrdu ? 'رازداری کی پالیسی' : 'Privacy Policy'}
            </button>
            <span>•</span>
            <button onClick={() => navigateTo('terms')} className="hover:text-white">
              {isUrdu ? 'شرائط و ضوابط' : 'Terms & Conditions'}
            </button>
            <span>•</span>
            <button onClick={() => navigateTo('sitemap')} className="hover:text-white">
              {isUrdu ? 'سائٹ میپ' : 'HTML Sitemap'}
            </button>
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
