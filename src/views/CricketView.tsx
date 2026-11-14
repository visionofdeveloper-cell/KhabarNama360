import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { CricketMatch } from '../types/index.ts';
import { Trophy, Calendar, MapPin, Activity, Flame, Shield, Users, Bell, BellRing } from 'lucide-react';
import { NotificationToggleModal } from '../components/NotificationToggleModal.tsx';
import { PushNotificationClient } from '../services/pushNotificationClient.ts';
import { safeFetchJson } from '../utils/safeFetch.ts';

export const CricketView: React.FC = () => {
  const { isUrdu } = useLanguage();
  const [matches, setMatches] = useState<CricketMatch[]>([]);
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);

  useEffect(() => {
    setIsPushSubscribed(PushNotificationClient.isLocallySubscribed());
    const loadMatches = async () => {
      const data = await safeFetchJson('/api/cricket/matches');
      if (data.success && Array.isArray(data.matches)) {
        setMatches(data.matches);
      }
    };
    void loadMatches();
    const interval = setInterval(() => void loadMatches(), 120_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void loadMatches();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const liveMatches = matches.filter(m => m.status === 'live');
  const upcomingMatches = matches.filter(m => m.status === 'upcoming');

  const starPlayers = [
    { name: 'Babar Azam', role: 'Top-order Batter', stats: 'ODIs: 5,729 runs @ 56.7 avg', image: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=300&q=80' },
    { name: 'Shaheen Shah Afridi', role: 'Left-arm Fast Bowler', stats: '104 wickets in 53 ODIs', image: 'https://images.unsplash.com/photo-1531415074868-036b1c57e329?auto=format&fit=crop&w=300&q=80' },
    { name: 'Mohammad Rizwan', role: 'Wicket-keeper Batter', stats: '2,088 T20I runs, 73 dismissals', image: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=300&q=80' }
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-teal-900 to-emerald-900 text-white rounded-3xl p-6 sm:p-10 shadow-xl">
        <div className="inline-flex items-center gap-2 bg-amber-400 text-gray-950 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
          <Trophy className="w-4 h-4" />
          <span>{isUrdu ? 'پاکستان کرکٹ و لائیو اسکور' : 'Pakistan Cricket Hub'}</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-black">
          {isUrdu ? 'قومی کرکٹ ٹیم، پی ایس ایل اور بین الاقوامی میچز کا لائیو اسکور' : 'Live Cricket Scores, Champions Trophy & PSL Updates'}
        </h1>
        <p className="text-emerald-200 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
          {isUrdu
            ? 'بال بائی بال کمنٹری، مکمل اسکور کارڈ، میچ کے بہترین لمحات اور کھلاڑیوں کی درجہ بندی'
            : 'Official PCB fixtures, real-time match summaries, ICC team rankings, and player statistics.'}
        </p>

        {/* Cricket Notification Banner Button */}
        <div className="mt-5 pt-4 border-t border-emerald-800/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-emerald-100 font-medium">
            <BellRing className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              {isUrdu
                ? 'کیا آپ میچ کے اہم لمحات اور ہر وکٹ کا فوری نوٹیفکیشن چاہتے ہیں؟'
                : 'Want instant push alerts for match milestones, PSL wickets & results?'}
            </span>
          </div>
          <button
            onClick={() => setIsNotifModalOpen(true)}
            className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-gray-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-amber-400/20 transition-all hover:scale-[1.02]"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>
              {isPushSubscribed
                ? (isUrdu ? 'الرٹس کی ترجیحات تبدیل کریں' : 'Manage Alerts')
                : (isUrdu ? 'کرکٹ الرٹس آن کریں' : 'Turn On Cricket Alerts')}
            </span>
          </button>
        </div>
      </div>

      {/* Live / Recent Matches */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-red-500 animate-pulse" />
            <span>{isUrdu ? 'لائیو اور حالیہ میچز' : 'Live & Featured Fixtures'}</span>
          </h2>
          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>{isUrdu ? 'پی سی بی و آئی سی سی تصدیق شدہ لائیو فیڈ' : 'PCB & ICC Verified Live Feed'}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {matches.map((match) => (
            <div key={match.id} className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs hover:border-emerald-500 transition-colors space-y-4">
              <div className="flex items-center justify-between text-xs border-b border-gray-100 pb-3">
                <span className="font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                  {match.tournament}
                </span>
                <span className="text-gray-400 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {isUrdu ? match.venueUr : match.venueEn}
                </span>
              </div>

              {/* Teams & Scores */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{match.teamA.flag}</span>
                    <span className="font-bold text-gray-900 text-sm">{match.teamA.name}</span>
                  </div>
                  <span className="font-mono font-black text-gray-900 text-base">
                    {match.teamA.score || 'Upcoming'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{match.teamB.flag}</span>
                    <span className="font-bold text-gray-900 text-sm">{match.teamB.name}</span>
                  </div>
                  <span className="font-mono font-black text-gray-900 text-base">
                    {match.teamB.score || 'Upcoming'}
                  </span>
                </div>
              </div>

              {/* Status Note */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-2xl text-xs text-emerald-900 font-semibold truncate">
                {isUrdu ? match.statusTextUr : match.statusTextEn}
              </div>

              {/* Batters on crease */}
              {match.currentBatters && (
                <div className="text-[11px] text-gray-500 flex items-center justify-between pt-1 border-t border-gray-100">
                  <span>Batters: {match.currentBatters.join(' | ')}</span>
                  <span>Bowler: {match.currentBowler}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* National Star Player Profiles */}
      <div className="space-y-4">
        <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
          <Users className="w-5 h-5 text-emerald-700" />
          <span>{isUrdu ? 'پاکستان کے مایہ ناز کرکٹرز' : 'National Cricket Stars'}</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {starPlayers.map((player, idx) => (
            <div key={idx} className="bg-white border border-gray-200 rounded-3xl p-5 shadow-xs flex items-center gap-4">
              <img
                src={player.image}
                alt={player.name}
                className="w-16 h-16 rounded-2xl object-cover shrink-0"
              />
              <div>
                <h4 className="font-extrabold text-sm text-gray-900">{player.name}</h4>
                <div className="text-xs text-emerald-700 font-semibold">{player.role}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">{player.stats}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <NotificationToggleModal
        isOpen={isNotifModalOpen}
        onClose={() => {
          setIsNotifModalOpen(false);
          setIsPushSubscribed(PushNotificationClient.isLocallySubscribed());
        }}
      />
    </div>
  );
};
