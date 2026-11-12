import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import {
  Search,
  Globe,
  Sparkles,
  Newspaper,
  ShieldCheck,
  TrendingUp,
  CloudSun,
  Flame,
  Volume2,
  VolumeX,
  Menu,
  X,
  Bell,
  BellRing
} from 'lucide-react';
import { AskAiModal } from './AskAiModal.tsx';
import { NotificationToggleModal } from './NotificationToggleModal.tsx';
import { PushNotificationClient } from '../services/pushNotificationClient.ts';

interface HeaderProps {
  onSearch: (q: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onSearch }) => {
  const { language, setLanguage, isUrdu, t, currentRoute, navigateTo } = useLanguage();
  const [searchInput, setSearchInput] = useState('');
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [tickerPaused, setTickerPaused] = useState(false);
  const [tickerSound, setTickerSound] = useState(false);

  useEffect(() => {
    setIsPushSubscribed(PushNotificationClient.isLocallySubscribed());
  }, []);

  const breakingHeadlines = isUrdu ? [
    'پاکستان اسٹاک ایکسچینج میں زبردست تیزی، انڈیکس تاریخ کی نئی بلندی پر پہنچ گیا',
    'آئی سی سی چیمپئنز ٹرافی: قومی کرکٹ ٹیم کی تیاریاں عروج پر، فاسٹ بولرز ان فارم',
    'پنجاب اور فیڈرل تعلیمی بورڈز نے سالانہ میٹرک اور انٹرمیڈیٹ امتحانات کی ڈیٹ شیٹ جاری کر دی',
    'وفاقی حکومت کا کم آمدنی والے گھرانوں کے لیے سولر انرجی سبسڈی اسکیم کا بڑا اعلان'
  ] : [
    'PSX Crosses Record Milestone as Economic Confidence Strengthens in Pakistan',
    'National Cricket Team Gearing Up for ICC Champions Trophy: Fast Bowlers in Form',
    'Punjab and Federal Boards Release Date Sheet for Annual Matric and Intermediate Exams',
    'Federal Government Unveils Landmark Solar Energy Subsidy Scheme for Low-Income Households'
  ];

  const [activeHeadlineIdx, setActiveHeadlineIdx] = useState(0);

  useEffect(() => {
    if (tickerPaused) return;
    const interval = setInterval(() => {
      setActiveHeadlineIdx((prev) => (prev + 1) % breakingHeadlines.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [tickerPaused, breakingHeadlines.length]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onSearch(searchInput.trim());
      navigateTo('search');
    }
  };

  const navItems = [
    { id: 'home', label: t('nav.home'), icon: 'Home' },
    { id: 'pakistan', label: t('nav.pakistan'), icon: 'Flag' },
    { id: 'politics', label: t('nav.politics'), icon: 'Building' },
    { id: 'business', label: t('nav.business'), icon: 'TrendingUp' },
    { id: 'sports', label: t('nav.sports'), icon: 'Trophy' },
    { id: 'education', label: t('nav.education'), icon: 'GraduationCap' },
    { id: 'weather', label: t('nav.weather'), icon: 'CloudSun' },
    { id: 'islamic', label: t('nav.islamic'), icon: 'Moon' },
    { id: 'mobiles', label: t('nav.mobiles'), icon: 'Smartphone' },
    { id: 'automobiles', label: t('nav.automobiles'), icon: 'Car' },
    { id: 'prizebonds', label: t('nav.prizebonds'), icon: 'Ticket' },
    { id: 'dictionary', label: t('nav.dictionary'), icon: 'BookOpen' },
    { id: 'poetry', label: t('nav.poetry'), icon: 'Feather' },
    { id: 'recipes', label: t('nav.recipes'), icon: 'Utensils' },
    { id: 'jobs', label: t('nav.jobs'), icon: 'Briefcase' },
    { id: 'tools', label: t('nav.tools'), icon: 'Calculator' },
  ];

  return (
    <>
      <header className="w-full bg-white border-b border-gray-200 sticky top-0 z-40 shadow-xs">
        {/* Top Info Bar */}
        <div className="bg-emerald-900 text-emerald-100 text-xs py-1.5 px-4">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
            {/* Dates & Highlights */}
            <div className="flex items-center gap-4 flex-wrap">
              <span className="font-semibold text-emerald-300">
                {isUrdu ? '21 شوال 1447ھ' : '21 Shawwal 1447 AH'}
              </span>
              <span className="hidden sm:inline text-emerald-400">•</span>
              <span className="hidden sm:inline text-emerald-200">
                {isUrdu ? 'جمعرات، 06 نومبر 2026ء' : 'Thursday, 06 Nov 2026'}
              </span>
              <span className="hidden md:inline text-emerald-400">•</span>
              <div className="hidden md:flex items-center gap-1.5 text-amber-300 font-medium">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>{isUrdu ? 'سونا 24K: 278,500 روپے' : 'Gold 24K: Rs. 278,500/tola'}</span>
              </div>
              <span className="hidden lg:inline text-emerald-400">•</span>
              <div className="hidden lg:flex items-center gap-1.5 text-sky-200">
                <CloudSun className="w-3.5 h-3.5" />
                <span>{isUrdu ? 'کراچی 31°C | لاہور 26°C' : 'Karachi 31°C | Lahore 26°C'}</span>
              </div>
            </div>

            {/* Quick Actions & Language Switch */}
            <div className="flex items-center gap-3">
              {/* Language Switcher */}
              <div className="flex items-center bg-emerald-800/80 rounded-full p-0.5 border border-emerald-700">
                <button
                  onClick={() => setLanguage('ur')}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all ${
                    language === 'ur'
                      ? 'bg-amber-400 text-emerald-950 shadow-xs'
                      : 'text-emerald-200 hover:text-white'
                  }`}
                >
                  اردو
                </button>
                <button
                  onClick={() => setLanguage('en')}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all ${
                    language === 'en'
                      ? 'bg-amber-400 text-emerald-950 shadow-xs'
                      : 'text-emerald-200 hover:text-white'
                  }`}
                >
                  English
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Logo & Search Bar */}
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Logo */}
          <div
            onClick={() => navigateTo('home')}
            className="cursor-pointer flex items-center gap-3 group shrink-0"
          >
            <div className="flex items-center gap-2">
              <img
                src="/assets/aistudio/Modern_Green_and_Gold_News_Logo_2e9a99d4.png"
                alt="360Khabarnama Logo"
                className="h-10 sm:h-12 w-auto max-w-[200px] sm:max-w-[260px] object-contain rounded-lg shadow-xs group-hover:scale-102 transition-transform"
              />
            </div>
            <div className="hidden lg:block border-l border-gray-200 pl-3">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-black text-gray-900 group-hover:text-emerald-700 transition-colors">
                  {isUrdu ? '360 خبرنامہ' : '360Khabarnama'}
                </span>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase">
                  Live
                </span>
              </div>
              <p className="text-[11px] text-gray-500">
                {isUrdu ? 'خبریں، نتائج، کرکٹ، ریٹس اور روزمرہ سہولیات' : 'News, Results, Cricket, Rates & Utilities'}
              </p>
            </div>
          </div>

          {/* Search Box */}
          <form
            onSubmit={handleSearchSubmit}
            className="flex-1 max-w-xl mx-2 hidden md:block"
          >
            <div className="relative">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={isUrdu ? 'تلاش کریں (مثلاً: رول نمبر، سونا، کرکٹ، موسم)...' : 'Search news, roll numbers, gold rates, cricket, weather...'}
                className="w-full pl-4 pr-24 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-600 focus:bg-white transition-all shadow-2xs"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1.5 bottom-1.5 px-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{t('common.searchBtn')}</span>
              </button>
            </div>
          </form>

          {/* Right Controls: Notification Bell, AI Assistant & Mobile Menu Toggle */}
          <div className="flex items-center gap-2">
            {/* Push Notifications Toggle Button */}
            <button
              onClick={() => setIsNotifModalOpen(true)}
              title={isUrdu ? 'بریکنگ نیوز اور کرکٹ الرٹس' : 'Breaking News & Cricket Alerts'}
              aria-label="Notification Settings"
              className={`relative flex items-center justify-center p-2 rounded-xl transition-all border ${
                isPushSubscribed
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 shadow-xs'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
              }`}
            >
              {isPushSubscribed ? (
                <BellRing className="w-4 h-4 text-emerald-700" />
              ) : (
                <Bell className="w-4 h-4 text-gray-600" />
              )}
              {isPushSubscribed ? (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
                </span>
              ) : (
                <span className="absolute -top-1 -right-1 flex h-2 w-2 rounded-full bg-amber-500"></span>
              )}
            </button>

            <button
              onClick={() => setIsAiModalOpen(true)}
              className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm shadow-amber-500/25 transition-all hover:scale-[1.02]"
            >
              <Sparkles className="w-4 h-4 text-amber-100 animate-spin-slow" />
              <span className="hidden sm:inline">{t('common.askAi')}</span>
              <span className="sm:hidden">AI</span>
            </button>

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Search Input */}
        <div className="md:hidden px-4 pb-2.5">
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={isUrdu ? 'خبریں، نتائج یا معلومات تلاش کریں...' : 'Search articles or roll numbers...'}
              className="w-full pl-4 pr-10 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-600"
            />
            <button
              type="submit"
              className="absolute right-2 top-2 p-1 text-emerald-700"
            >
              <Search className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Sticky Mega Navigation Bar */}
        <nav className="bg-emerald-800 text-white border-t border-emerald-700/60 shadow-xs">
          <div className="max-w-7xl mx-auto px-4 overflow-x-auto no-scrollbar">
            <div className="flex items-center whitespace-nowrap min-w-max py-1 gap-1">
              {navItems.map((item) => {
                const isActive = currentRoute === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      navigateTo(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-amber-400 text-emerald-950 font-bold shadow-xs'
                        : 'text-emerald-100 hover:bg-emerald-700/70 hover:text-white'
                    }`}
                  >
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Breaking News Ticker */}
        <div className="bg-emerald-50 border-b border-emerald-200 py-1.5 px-4 text-xs">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
              </span>
              <span className="bg-red-600 text-white font-extrabold px-2 py-0.5 rounded-sm text-[10px] tracking-wider uppercase flex items-center gap-1">
                <Flame className="w-3 h-3" />
                {t('common.breaking')}
              </span>
            </div>

            {/* Sliding Headline */}
            <div
              className="flex-1 overflow-hidden cursor-pointer"
              onMouseEnter={() => setTickerPaused(true)}
              onMouseLeave={() => setTickerPaused(false)}
              onClick={() => navigateTo('home')}
            >
              <p className="font-semibold text-gray-800 hover:text-emerald-700 transition-colors truncate">
                {breakingHeadlines[activeHeadlineIdx]}
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1.5 text-gray-500 shrink-0">
              <button
                onClick={() => setTickerPaused(!tickerPaused)}
                className="text-[10px] font-mono bg-white px-1.5 py-0.5 rounded border border-gray-200 hover:bg-gray-100"
                title={tickerPaused ? 'Play' : 'Pause'}
              >
                {tickerPaused ? '▶' : '⏸'}
              </button>
              <button
                onClick={() => setTickerSound(!tickerSound)}
                className="p-1 hover:text-emerald-700"
                title="Sound alerts"
              >
                {tickerSound ? <Volume2 className="w-3.5 h-3.5 text-emerald-700" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Slide-down Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-gray-300 p-4 shadow-xl">
            <div className="grid grid-cols-2 gap-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    navigateTo(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`p-2.5 rounded-xl text-start text-xs font-semibold flex items-center justify-between border ${
                    currentRoute === item.id
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                      : 'border-gray-100 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Reader AI Modal */}
      <AskAiModal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} />

      {/* Push Notifications & Cricket Alert Modal */}
      <NotificationToggleModal
        isOpen={isNotifModalOpen}
        onClose={() => {
          setIsNotifModalOpen(false);
          setIsPushSubscribed(PushNotificationClient.isLocallySubscribed());
        }}
      />
    </>
  );
};
