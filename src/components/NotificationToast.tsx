import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { onPushAlert } from '../services/pushNotificationClient.ts';
import { PushAlertPayload } from '../types/index.ts';
import { Flame, Activity, Sun, BellRing, X, ExternalLink } from 'lucide-react';

export const NotificationToast: React.FC = () => {
  const { isUrdu, navigateTo } = useLanguage();
  const [activeAlert, setActiveAlert] = useState<PushAlertPayload | null>(null);

  useEffect(() => {
    const unsubscribe = onPushAlert((payload) => {
      setActiveAlert(payload);
      // Auto-hide after 8 seconds
      const timer = setTimeout(() => {
        setActiveAlert(null);
      }, 8000);
      return () => clearTimeout(timer);
    });
    return () => unsubscribe();
  }, []);

  if (!activeAlert) return null;

  const isCricket = activeAlert.topic === 'cricketScores';
  const isBreaking = activeAlert.topic === 'breakingNews';

  const title = isUrdu ? (activeAlert.titleUr || activeAlert.title) : activeAlert.title;
  const body = isUrdu ? (activeAlert.bodyUr || activeAlert.body) : activeAlert.body;

  const handleAction = () => {
    const url = activeAlert.url || '/';
    setActiveAlert(null);

    // If internal route
    if (url.includes('/cricket')) {
      navigateTo('sports');
    } else if (url.includes('/news') || url.includes('/pakistan')) {
      navigateTo('pakistan');
    } else {
      navigateTo('home');
    }
  };

  return (
    <div
      className="fixed top-16 right-4 sm:right-6 z-50 max-w-sm sm:max-w-md w-full animate-in slide-in-from-top-4 duration-300 shadow-2xl rounded-2xl overflow-hidden border border-emerald-500/30 bg-gray-950 text-white"
      dir={isUrdu ? 'rtl' : 'ltr'}
    >
      <div className="p-4 flex items-start gap-3">
        {/* Icon */}
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isCricket
              ? 'bg-emerald-500 text-gray-950'
              : isBreaking
              ? 'bg-red-600 text-white animate-pulse'
              : 'bg-amber-400 text-gray-950'
          }`}
        >
          {isCricket ? (
            <Activity className="w-5 h-5" />
          ) : isBreaking ? (
            <Flame className="w-5 h-5" />
          ) : (
            <BellRing className="w-5 h-5" />
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                isCricket
                  ? 'bg-emerald-900/80 text-emerald-300'
                  : isBreaking
                  ? 'bg-red-900/80 text-red-300'
                  : 'bg-amber-900/80 text-amber-300'
              }`}
            >
              {isCricket
                ? (isUrdu ? 'کرکٹ الرٹ' : 'Live Cricket')
                : isBreaking
                ? (isUrdu ? 'بریکنگ نیوز' : 'Breaking News')
                : (isUrdu ? '360 خبرنامہ' : 'Daily Alert')}
            </span>
            <span className="text-[10px] text-gray-400">Just now</span>
          </div>

          <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-2 leading-snug">
            {title}
          </h4>
          <p className="text-xs text-gray-300 mt-1 line-clamp-2 leading-relaxed">
            {body}
          </p>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleAction}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5 transition-colors"
            >
              <span>{isCricket ? (isUrdu ? 'اسکور کارڈ دیکھیں' : 'View Scorecard') : (isUrdu ? 'تفصیل پڑھیں' : 'Read Now')}</span>
              <ExternalLink className="w-3 h-3" />
            </button>
            <button
              onClick={() => setActiveAlert(null)}
              className="px-2.5 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
            >
              {isUrdu ? 'نظرانداز کریں' : 'Dismiss'}
            </button>
          </div>
        </div>

        {/* Close */}
        <button
          onClick={() => setActiveAlert(null)}
          aria-label="Close"
          className="text-gray-400 hover:text-white p-1 rounded-md"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-emerald-900 w-full overflow-hidden">
        <div className="h-full bg-amber-400 animate-[progress_8s_linear]" />
      </div>
    </div>
  );
};
