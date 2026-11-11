import React, { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { Shield, X } from 'lucide-react';

interface ConsentState {
  essential: boolean;
  analytics: boolean;
  advertising: boolean;
  savedAt?: string;
}

const CONSENT_KEY = '360khabarnama_consent';

export const CookieConsent: React.FC = () => {
  const { isUrdu, navigateTo } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [consent, setConsent] = useState<ConsentState>({
    essential: true,
    analytics: false,
    advertising: false,
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CONSENT_KEY);
      if (!raw) {
        setVisible(true);
      } else {
        setConsent(JSON.parse(raw));
      }
    } catch {
      setVisible(true);
    }

    const handleOpen = () => {
      setShowDetails(true);
      setVisible(true);
    };
    window.addEventListener('open-privacy-choices', handleOpen);
    return () => window.removeEventListener('open-privacy-choices', handleOpen);
  }, []);

  const saveConsent = (next: ConsentState) => {
    const payload = { ...next, essential: true, savedAt: new Date().toISOString() };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(payload));
    setConsent(payload);
    setVisible(false);
    setShowDetails(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 bg-gray-950 text-white border border-emerald-700/60 rounded-2xl p-5 shadow-2xl"
      dir={isUrdu ? 'rtl' : 'ltr'}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
          <Shield className="w-4 h-4 shrink-0" />
          <span>{isUrdu ? 'رازداری اور کوکیز کی ترجیحات' : 'Privacy & Cookie Preferences'}</span>
        </div>
        <button
          onClick={() => setVisible(false)}
          aria-label="Close"
          className="text-gray-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs text-gray-300 leading-relaxed mb-3">
        {isUrdu
          ? '360 خبرنامہ زبان کی ترجیحات کے لیے ضروری کوکیز استعمال کرتا ہے۔ آپ تجزیاتی اور اشتہاری کوکیز کے لیے اپنی رضامندی منتخب کر سکتے ہیں۔'
          : '360Khabarnama uses essential storage for language preferences. You may choose whether to allow analytics and advertising cookies.'}{' '}
        <button
          onClick={() => navigateTo('cookie-policy')}
          className="text-amber-400 underline hover:text-amber-300"
        >
          {isUrdu ? 'کوکی پالیسی' : 'Cookie Policy'}
        </button>
      </p>

      {showDetails && (
        <div className="space-y-2 mb-4 bg-gray-900 p-3 rounded-xl border border-gray-800 text-xs">
          <label className="flex items-center justify-between">
            <span>{isUrdu ? 'ضروری کوکیز (ہمیشہ فعال)' : 'Essential Cookies (Always Active)'}</span>
            <input type="checkbox" checked disabled className="accent-emerald-500" />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span>{isUrdu ? 'اینالیٹکس کوکیز' : 'Analytics Cookies'}</span>
            <input
              type="checkbox"
              checked={consent.analytics}
              onChange={(e) => setConsent({ ...consent, analytics: e.target.checked })}
              className="accent-emerald-500"
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span>{isUrdu ? 'اشتہاری کوکیز' : 'Advertising Cookies'}</span>
            <input
              type="checkbox"
              checked={consent.advertising}
              onChange={(e) => setConsent({ ...consent, advertising: e.target.checked })}
              className="accent-emerald-500"
            />
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => saveConsent({ essential: true, analytics: true, advertising: true })}
          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs"
        >
          {isUrdu ? 'سب قبول کریں' : 'Accept All'}
        </button>
        <button
          onClick={() => saveConsent({ essential: true, analytics: false, advertising: false })}
          className="px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold rounded-xl text-xs"
        >
          {isUrdu ? 'صرف ضروری' : 'Essential Only'}
        </button>
        {showDetails ? (
          <button
            onClick={() => saveConsent(consent)}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-gray-950 font-bold rounded-xl text-xs"
          >
            {isUrdu ? 'ترجیحات محفوظ کریں' : 'Save Choices'}
          </button>
        ) : (
          <button
            onClick={() => setShowDetails(true)}
            className="px-3 py-2 text-gray-300 hover:text-white underline text-xs"
          >
            {isUrdu ? 'ترجیحات' : 'Customize'}
          </button>
        )}
      </div>
    </div>
  );
};
