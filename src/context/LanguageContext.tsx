import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language } from '../types/index.ts';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  isUrdu: boolean;
  t: (key: string) => string;
  currentRoute: string;
  navigateTo: (route: string) => void;
  selectedArticleId: string | null;
  setSelectedArticleId: (id: string | null) => void;
}

const UI_TRANSLATIONS: Record<string, { en: string; ur: string }> = {
  // Navigation
  'nav.home': { en: 'Home', ur: 'صفحۂ اول' },
  'nav.pakistan': { en: 'Pakistan', ur: 'پاکستان' },
  'nav.politics': { en: 'Politics', ur: 'سیاست' },
  'nav.business': { en: 'Business & Economy', ur: 'معیشت و تجارت' },
  'nav.sports': { en: 'Cricket & Sports', ur: 'کھیل و کرکٹ' },
  'nav.education': { en: 'Education & Results', ur: 'تعلیم و نتائج' },
  'nav.weather': { en: 'Weather', ur: 'موسم' },
  'nav.islamic': { en: 'Islamic Life', ur: 'اسلامی دنیا' },
  'nav.mobiles': { en: 'Mobiles & Tech', ur: 'موبائلز' },
  'nav.automobiles': { en: 'Cars & Bikes', ur: 'گاڑیاں' },
  'nav.prizebonds': { en: 'Prize Bonds', ur: 'پرائز بانڈ' },
  'nav.dictionary': { en: 'Dictionary & Names', ur: 'لغت و نام' },
  'nav.poetry': { en: 'Poetry & Literature', ur: 'شاعری و ادب' },
  'nav.recipes': { en: 'Recipes', ur: 'پکوان' },
  'nav.tools': { en: 'Calculators & Tools', ur: 'آن لائن ٹولز' },
  'nav.jobs': { en: 'Jobs Portal', ur: 'ملازمتیں' },
  'nav.admin': { en: 'Admin Portal', ur: 'ایڈمن پورٹل' },

  // General UI
  'app.name': { en: 'Khabarnama360', ur: 'خبرنامہ 360' },
  'app.tagline': { en: 'Khabarnama360 - The Voice of Pakistan: News, Results, Finance & Everyday Services', ur: 'خبرنامہ 360 - پاکستان کا مستند ڈیجیٹل پورٹل: خبریں، نتائج اور خدمات' },
  'common.breaking': { en: 'BREAKING NEWS', ur: 'تازہ ترین' },
  'common.search': { en: 'Search news, results, rates, dictionary, prize bonds...', ur: 'خبریں، بورڈ نتائج، ریٹس، لغت، پرائز بانڈ تلاش کریں...' },
  'common.searchBtn': { en: 'Search', ur: 'تلاش کریں' },
  'common.readMore': { en: 'Read Full Story', ur: 'مکمل تفصیل پڑھیں' },
  'common.viewAll': { en: 'View All', ur: 'تمام دیکھیں' },
  'common.latestNews': { en: 'Latest News Feed', ur: 'تازہ ترین خبریں' },
  'common.trending': { en: 'Trending Headlines', ur: 'مقبول ترین' },
  'common.mostRead': { en: 'Most Read', ur: 'سب سے زیادہ پڑھی جانے والی' },
  'common.liveCricket': { en: 'Live Cricket', ur: 'لائیو کرکٹ' },
  'common.prayerTimes': { en: 'Prayer Times', ur: 'اوقاتِ نماز' },
  'common.goldRates': { en: 'Gold Rates (PKR)', ur: 'سونے کی قیمت' },
  'common.currency': { en: 'Currencies', ur: 'کرنسی ریٹس' },
  'common.resultsLookup': { en: 'Check Exam Result', ur: 'بورڈ رزلٹ معلوم کریں' },
  'common.share': { en: 'Share', ur: 'شیئر کریں' },
  'common.minRead': { en: 'min read', ur: 'منٹ مطالعہ' },
  'common.back': { en: 'Back', ur: 'واپس' },
  'common.askAi': { en: 'Ask Khabarnama AI', ur: 'خبرنامہ اے آئی سے پوچھیں' },
  'common.advertisement': { en: 'ADVERTISEMENT', ur: 'اشتہار' },
  'common.copyright': { en: '© 2026 Khabarnama360. All rights reserved.', ur: '© 2026 خبرنامہ 360۔ جملہ حقوق محفوظ ہیں۔' }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('pdp_lang');
    if (saved === 'en' || saved === 'ur') return saved;
    return 'ur'; // Default to Urdu for authentic Pakistani portal feel
  });

  const [currentRoute, setCurrentRoute] = useState<string>('home');
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('pdp_lang', lang);
  };

  const isUrdu = language === 'ur';

  // Apply HTML direction and language attributes
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isUrdu ? 'rtl' : 'ltr';
    if (isUrdu) {
      document.body.classList.add('font-urdu');
    } else {
      document.body.classList.remove('font-urdu');
    }
  }, [language, isUrdu]);

  const t = (key: string): string => {
    const item = UI_TRANSLATIONS[key];
    if (!item) return key;
    return isUrdu ? item.ur : item.en;
  };

  const navigateTo = (route: string) => {
    setCurrentRoute(route);
    if (route !== 'article') {
      setSelectedArticleId(null);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        isUrdu,
        t,
        currentRoute,
        navigateTo,
        selectedArticleId,
        setSelectedArticleId,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
