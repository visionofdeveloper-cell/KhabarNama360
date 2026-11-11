import React, { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { LEGAL_PAGES, LegalPageDef } from '../data/legalPages.ts';
import { SITE_CONFIG } from '../config/site.ts';
import { ChevronRight, CheckCircle2, AlertCircle, Send, ShieldCheck } from 'lucide-react';

interface LegalPageViewProps {
  slug: string;
}

export const LegalPageView: React.FC<LegalPageViewProps> = ({ slug }) => {
  const { isUrdu, language, navigateTo } = useLanguage();
  const page: LegalPageDef | undefined = LEGAL_PAGES.find((p) => p.slug === slug);

  const [formState, setFormState] = useState({
    name: '',
    email: '',
    subject: '',
    category: 'General Enquiry',
    targetUrl: '',
    message: '',
    privacyAccepted: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (!page) return;
    const title = isUrdu ? page.seoTitleUr : page.seoTitleEn;
    const desc = isUrdu ? page.metaDescUr : page.metaDescEn;
    document.title = title;

    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', desc);

    const canonicalUrl = `${SITE_CONFIG.SITE_URL}/${language}/${page.slug}`;
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', canonicalUrl);
  }, [page, isUrdu, language]);

  if (!page) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {isUrdu ? 'صفحہ نہیں ملا' : 'Page Not Found'}
        </h1>
        <button
          onClick={() => navigateTo('home')}
          className="mt-4 px-5 py-2.5 bg-emerald-700 text-white rounded-xl text-sm font-semibold"
        >
          {isUrdu ? 'صفحۂ اول پر جائیں' : 'Return Home'}
        </button>
      </div>
    );
  }

  const handleFormSubmit = async (e: React.FormEvent, endpoint: string) => {
    e.preventDefault();
    if (!formState.privacyAccepted) {
      setSubmitResult({
        ok: false,
        msg: isUrdu ? 'براہ کرم پرائیویسی پالیسی سے اتفاق کریں۔' : 'Please accept the Privacy Policy acknowledgement.',
      });
      return;
    }
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formState, pageSlug: page.slug, language }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSubmitResult({
          ok: true,
          msg: isUrdu
            ? 'آپ کی درخواست کامیابی سے محفوظ کر لی گئی ہے۔'
            : 'Your submission has been securely recorded for review.',
        });
        setFormState({
          name: '',
          email: '',
          subject: '',
          category: 'General Enquiry',
          targetUrl: '',
          message: '',
          privacyAccepted: false,
        });
      } else {
        setSubmitResult({
          ok: false,
          msg: data.error || (isUrdu ? 'درخواست جمع کرانے میں مسئلہ پیش آیا۔' : 'Unable to submit form. Please try again.'),
        });
      }
    } catch {
      setSubmitResult({
        ok: false,
        msg: isUrdu ? 'نیٹ ورک خرابی۔ دوبارہ کوشش کریں۔' : 'Network error. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const title = isUrdu ? page.titleUr : page.titleEn;
  const sections = isUrdu ? page.sectionsUr : page.sectionsEn;
  const showForm = ['contact', 'corrections-policy', 'copyright-policy', 'advertise'].includes(page.slug);
  const endpointMap: Record<string, string> = {
    contact: '/api/public/contact',
    'corrections-policy': '/api/public/correction',
    'copyright-policy': '/api/public/copyright',
    advertise: '/api/public/advertise',
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12" dir={isUrdu ? 'rtl' : 'ltr'}>
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-6">
        <button onClick={() => navigateTo('home')} className="hover:text-emerald-700 font-medium">
          {isUrdu ? 'صفحۂ اول' : 'Home'}
        </button>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="capitalize">{page.category}</span>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-emerald-800 dark:text-emerald-400 font-semibold">{title}</span>
      </nav>

      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 pb-6 mb-8">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1 rounded-full mb-3">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>{isUrdu ? '360 خبرنامہ — باضابطہ پالیسی' : '360Khabarnama Official Policy'}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white">{title}</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          {isUrdu ? `مؤثر تاریخ: ${page.effectiveDate}` : `Effective Date: ${page.effectiveDate}`}
        </p>
      </header>

      {/* Content Sections */}
      <div className="space-y-8">
        {sections.map((sec, idx) => (
          <section key={idx} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-xs">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{sec.heading}</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">{sec.body}</p>
          </section>
        ))}
      </div>

      {/* Interactive HTML Sitemap */}
      {page.slug === 'sitemap' && (
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-400 mb-4">
              {isUrdu ? 'خبریں اور خدمات' : 'News & Services'}
            </h3>
            <ul className="space-y-2 text-sm">
              {[
                { id: 'home', en: 'Home', ur: 'صفحۂ اول' },
                { id: 'pakistan', en: 'Pakistan News', ur: 'پاکستان' },
                { id: 'business', en: 'Business & Finance', ur: 'معیشت و کاروبار' },
                { id: 'sports', en: 'Cricket & Sports', ur: 'کھیل و کرکٹ' },
                { id: 'weather', en: 'Weather Forecast', ur: 'موسم' },
                { id: 'education', en: 'Education & Results', ur: 'تعلیم و نتائج' },
                { id: 'tools', en: 'Online Calculators & Tools', ur: 'آن لائن ٹولز' },
              ].map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => navigateTo(item.id)}
                    className="text-gray-700 dark:text-gray-300 hover:text-emerald-700 hover:underline"
                  >
                    {isUrdu ? item.ur : item.en}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-400 mb-4">
              {isUrdu ? 'قانونی اور ادارتی صفحات' : 'Legal & Editorial Pages'}
            </h3>
            <ul className="space-y-2 text-sm">
              {LEGAL_PAGES.map((lp) => (
                <li key={lp.slug}>
                  <button
                    onClick={() => navigateTo(lp.slug)}
                    className="text-gray-700 dark:text-gray-300 hover:text-emerald-700 hover:underline"
                  >
                    {isUrdu ? lp.titleUr : lp.titleEn}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Interactive Submission Forms */}
      {showForm && (
        <div className="mt-10 bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-6 sm:p-8 shadow-sm">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            {isUrdu ? 'درخواست جمع کروائیں' : 'Submit Request'}
          </h3>
          <form onSubmit={(e) => handleFormSubmit(e, endpointMap[page.slug])} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {isUrdu ? 'نام *' : 'Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={formState.name}
                  onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {isUrdu ? 'ای میل *' : 'Email *'}
                </label>
                <input
                  type="email"
                  required
                  value={formState.email}
                  onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm"
                />
              </div>
            </div>

            {page.slug === 'contact' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {isUrdu ? 'زمرہ' : 'Enquiry Category'}
                </label>
                <select
                  value={formState.category}
                  onChange={(e) => setFormState({ ...formState, category: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm"
                >
                  <option value="General Enquiry">{isUrdu ? 'عمومی استفسار' : 'General Enquiry'}</option>
                  <option value="Editorial Enquiry">{isUrdu ? 'ادارتی رابطہ' : 'Editorial Enquiry'}</option>
                  <option value="News Correction">{isUrdu ? 'خبر کی تصحیح' : 'News Correction'}</option>
                  <option value="Copyright Complaint">{isUrdu ? 'کاپی رائٹ شکایت' : 'Copyright Complaint'}</option>
                  <option value="Advertising Enquiry">{isUrdu ? 'اشتہاری رابطہ' : 'Advertising Enquiry'}</option>
                  <option value="Technical Feedback">{isUrdu ? 'تکنیکی رائے' : 'Technical Feedback'}</option>
                </select>
              </div>
            )}

            {(page.slug === 'corrections-policy' || page.slug === 'copyright-policy') && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {isUrdu ? 'متعلقہ یو آر ایل' : 'Target Article / Page URL'}
                </label>
                <input
                  type="url"
                  placeholder="https://360khabarnama.com/..."
                  value={formState.targetUrl}
                  onChange={(e) => setFormState({ ...formState, targetUrl: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                {isUrdu ? 'موضوع *' : 'Subject *'}
              </label>
              <input
                type="text"
                required
                value={formState.subject}
                onChange={(e) => setFormState({ ...formState, subject: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                {isUrdu ? 'تفصیل / پیغام *' : 'Message / Details *'}
              </label>
              <textarea
                rows={4}
                required
                value={formState.message}
                onChange={(e) => setFormState({ ...formState, message: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm"
              />
            </div>

            <label className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={formState.privacyAccepted}
                onChange={(e) => setFormState({ ...formState, privacyAccepted: e.target.checked })}
                className="mt-0.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>
                {isUrdu
                  ? 'میں 360 خبرنامہ کی رازداری کی پالیسی کے مطابق اپنی معلومات کے محفوظ اندراج سے اتفاق کرتا/کرتی ہوں۔'
                  : 'I acknowledge that my submission will be processed in accordance with the 360Khabarnama Privacy Policy.'}
              </span>
            </label>

            {submitResult && (
              <div
                className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                  submitResult.ok
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {submitResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{submitResult.msg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl text-sm inline-flex items-center gap-2 transition-colors"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? (isUrdu ? 'بھیجا جا رہا ہے...' : 'Submitting...') : (isUrdu ? 'جمع کروائیں' : 'Submit')}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
