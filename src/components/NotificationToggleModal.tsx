import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import {
  PushNotificationClient,
  playAlertChime,
} from '../services/pushNotificationClient.ts';
import { NotificationTopics } from '../types/index.ts';
import {
  Bell,
  BellRing,
  BellOff,
  Flame,
  Activity,
  Sun,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  X,
  Volume2,
  Send,
  Sparkles,
} from 'lucide-react';

interface NotificationToggleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationToggleModal: React.FC<NotificationToggleModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { isUrdu, language, navigateTo } = useLanguage();
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState<boolean>(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  const [topics, setTopics] = useState<NotificationTopics>({
    breakingNews: true,
    cricketScores: true,
    dailyBriefing: true,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setPermission(PushNotificationClient.getPermission());
    setIsSubscribed(PushNotificationClient.isLocallySubscribed());
    setTopics(PushNotificationClient.getSavedTopics());
  }, [isOpen]);

  if (!isOpen) return null;

  const handleMasterToggle = async () => {
    setLoading(true);
    setTestStatus(null);

    if (isSubscribed) {
      const ok = await PushNotificationClient.unsubscribe();
      if (ok) {
        setIsSubscribed(false);
      }
    } else {
      const res = await PushNotificationClient.subscribe(topics, language);
      if (res.success) {
        setIsSubscribed(true);
        setPermission('granted');
        setTestStatus(
          isUrdu
            ? 'آپ کامیابی سے 360 خبرنامہ الرٹس میں رجسٹر ہو چکے ہیں!'
            : 'Successfully subscribed to 360Khabarnama real-time alerts!'
        );
      } else {
        setPermission(PushNotificationClient.getPermission());
        setTestStatus(
          res.error || (isUrdu ? 'براؤزر نے اجازت مسترد کر دی' : 'Permission was denied')
        );
      }
    }
    setLoading(false);
  };

  const handleTopicToggle = async (key: keyof NotificationTopics) => {
    const updated: NotificationTopics = { ...topics, [key]: !topics[key] };
    setTopics(updated);
    if (isSubscribed) {
      await PushNotificationClient.updatePreferences(updated, language);
    }
  };

  const handleTriggerTest = async (type: 'breakingNews' | 'cricketScores') => {
    setTestStatus(isUrdu ? 'الرٹ بھیجا جا رہا ہے...' : 'Dispatching test notification...');
    playAlertChime();
    await PushNotificationClient.triggerTestAlert(type);
    setTestStatus(
      type === 'cricketScores'
        ? (isUrdu ? '🏏 لائیو کرکٹ الرٹ موصول ہو گیا!' : '🏏 Live Cricket Score Alert dispatched!')
        : (isUrdu ? '🚨 بریکنگ نیوز الرٹ موصول ہو گیا!' : '🚨 Breaking News Alert dispatched!')
    );
    setTimeout(() => setTestStatus(null), 5000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-emerald-900/10 overflow-hidden flex flex-col max-h-[90vh]"
        dir={isUrdu ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 p-6 text-white relative">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-5 right-5 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 text-gray-950 flex items-center justify-center font-black shadow-lg shadow-amber-400/20 shrink-0">
              {isSubscribed ? (
                <BellRing className="w-6 h-6 animate-bounce" />
              ) : (
                <Bell className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-extrabold tracking-wider bg-emerald-800 text-emerald-200 px-2 py-0.5 rounded-md">
                  {isUrdu ? 'پش نوٹیفکیشن سروس' : 'Web Push Engine'}
                </span>
                {isSubscribed && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-300 bg-emerald-800/80 px-2 py-0.5 rounded-full border border-emerald-600/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>{isUrdu ? 'فعال' : 'Active'}</span>
                  </span>
                )}
              </div>
              <h2 className="text-xl font-black mt-1">
                {isUrdu
                  ? 'بریکنگ نیوز اور لائیو کرکٹ الرٹس'
                  : 'Breaking News & Cricket Score Alerts'}
              </h2>
            </div>
          </div>
          <p className="text-xs text-emerald-200/80 mt-2 leading-relaxed">
            {isUrdu
              ? 'اہم ترین قومی واقعات، فوری صرافہ ریٹس اور پاکستان کرکٹ ٹیم کی ہر بال و وکٹ کی لائیو اپ ڈیٹس براہِ راست اپنے اسکرین پر حاصل کریں۔'
              : 'Instant desktop & mobile push alerts for breaking Pakistani headlines, PSL wickets, and live match scores.'}
          </p>
        </div>

        {/* Body content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Permission Status Banner */}
          {permission === 'denied' ? (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  {isUrdu ? 'براؤزر نے نوٹیفکیشنز بلاک کر رکھے ہیں' : 'Notifications Blocked in Browser'}
                </p>
                <p className="text-red-700 mt-0.5">
                  {isUrdu
                    ? 'الرٹس حاصل کرنے کے لیے اپنے براؤزر کے ایڈریس بار میں لاک آئیکن پر کلک کر کے نوٹیفکیشن کی اجازت دیں۔'
                    : 'To receive alerts, click the lock icon in your browser URL bar and set Notifications to "Allow".'}
                </p>
              </div>
            </div>
          ) : isSubscribed ? (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">
                  {isUrdu
                    ? 'آپ اس ڈیوائس پر تمام ترجیحی الرٹس وصول کر رہے ہیں۔'
                    : 'You are subscribed to alerts on this device.'}
                </span>
              </div>
              <span className="text-[10px] font-bold text-emerald-800 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                VAPID Ready
              </span>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                {isUrdu
                  ? 'الرٹس آن کرنے کے لیے نیچے دیے گئے بٹن کو آن کریں۔'
                  : 'Toggle alerts on below to receive real-time push notifications.'}
              </span>
            </div>
          )}

          {/* Master Switch Card */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                  isSubscribed
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {isSubscribed ? <BellRing className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  {isUrdu ? 'پش نوٹیفکیشنز سروس' : 'Master Push Notifications'}
                </h3>
                <p className="text-xs text-gray-500">
                  {isSubscribed
                    ? (isUrdu ? 'الرٹس فعال ہیں' : 'Alerts are actively enabled')
                    : (isUrdu ? 'الرٹس غیر فعال ہیں' : 'Alerts are currently paused')}
                </p>
              </div>
            </div>

            {/* Switch Toggle */}
            <button
              onClick={handleMasterToggle}
              disabled={loading || permission === 'denied'}
              className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50 ${
                isSubscribed ? 'bg-emerald-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  isSubscribed ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Granular Topics Preference */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600">
              {isUrdu ? 'الرٹس کے زمرے اور ترجیحات' : 'Notification Categories & Topics'}
            </h4>

            {/* Breaking News Toggle */}
            <div
              onClick={() => handleTopicToggle('breakingNews')}
              className={`cursor-pointer border rounded-2xl p-3.5 flex items-center justify-between transition-all ${
                topics.breakingNews
                  ? 'border-emerald-600 bg-emerald-50/50'
                  : 'border-gray-200 bg-white opacity-60'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900">
                    {isUrdu ? 'بریکنگ نیوز الرٹس' : 'Breaking News Alerts'}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {isUrdu
                      ? 'قومی، سیاسی و بین الاقوامی ہنگامی خبریں'
                      : 'Urgent national and global breaking events'}
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={topics.breakingNews}
                onChange={() => {}}
                className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
              />
            </div>

            {/* Cricket Scores Toggle */}
            <div
              onClick={() => handleTopicToggle('cricketScores')}
              className={`cursor-pointer border rounded-2xl p-3.5 flex items-center justify-between transition-all ${
                topics.cricketScores
                  ? 'border-emerald-600 bg-emerald-50/50'
                  : 'border-gray-200 bg-white opacity-60'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900">
                    {isUrdu ? 'لائیو کرکٹ اسکور اور وکٹ الرٹس' : 'Live Cricket Scores & Wickets'}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {isUrdu
                      ? 'قومی ٹیم کے میچز، پی ایس ایل باؤنڈریز اور فتح کے لمحات'
                      : 'Pakistan matches, PSL live boundaries, wickets & results'}
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={topics.cricketScores}
                onChange={() => {}}
                className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
              />
            </div>

            {/* Daily Morning Briefing Toggle */}
            <div
              onClick={() => handleTopicToggle('dailyBriefing')}
              className={`cursor-pointer border rounded-2xl p-3.5 flex items-center justify-between transition-all ${
                topics.dailyBriefing
                  ? 'border-emerald-600 bg-emerald-50/50'
                  : 'border-gray-200 bg-white opacity-60'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <Sun className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900">
                    {isUrdu ? 'صبح کا معلوماتی خلاصہ' : 'Morning Market & News Briefing'}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {isUrdu
                      ? 'سونے کے تازہ نرخ، کرنسی ایکسچینج اور آج کے امتحانی نتائج'
                      : 'Daily 24K gold rates, USD/PKR, and board result notifications'}
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={!!topics.dailyBriefing}
                onChange={() => {}}
                className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
              />
            </div>
          </div>

          {/* Test Alert Buttons (Instant User Verification) */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-amber-600" />
                <span>{isUrdu ? 'الرٹ ٹیسٹ کریں' : 'Instant Alert Simulation'}</span>
              </span>
              <span className="text-[10px] text-gray-400">
                {isUrdu ? 'براؤزر پش + ان ایپ بینر' : 'Web Push & In-App Chime'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleTriggerTest('breakingNews')}
                className="px-3.5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all hover:scale-[1.01]"
              >
                <Flame className="w-3.5 h-3.5" />
                <span>{isUrdu ? 'بریکنگ نیوز ٹیسٹ' : 'Test Breaking Alert'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleTriggerTest('cricketScores')}
                className="px-3.5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all hover:scale-[1.01]"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>{isUrdu ? 'کرکٹ اسکور ٹیسٹ' : 'Test Cricket Alert'}</span>
              </button>
            </div>

            {testStatus && (
              <div className="text-center p-2 rounded-lg bg-emerald-100 text-emerald-900 text-xs font-medium animate-in fade-in">
                {testStatus}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              {isUrdu
                ? 'کوئی اسپام نہیں، کسی بھی وقت ان سبسکرائب کریں'
                : 'Zero spam. Unsubscribe anytime.'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-xl text-xs transition-colors"
          >
            {isUrdu ? 'بند کریں' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
};
