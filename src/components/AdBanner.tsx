import React, { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';

interface AdBannerProps {
  slot: 'leaderboard' | 'sidebar' | 'in-content' | string;
  imageUrl?: string;
  targetUrl?: string;
}

interface ActiveAdResponse {
  enabled: boolean;
  placement?: { id: string; slotId: string; name: string; adCodeSnippet?: string } | null;
  campaign?: {
    id: string;
    campaignName: string;
    advertiserName: string;
    bannerUrl?: string;
    destinationUrl?: string;
  } | null;
}

export const AdBanner: React.FC<AdBannerProps> = ({ slot, imageUrl, targetUrl }) => {
  const { isUrdu } = useLanguage();
  const [adData, setAdData] = useState<ActiveAdResponse | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/ads/active?slot=${encodeURIComponent(slot)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!active || !d?.success) return;
        setAdData(d);
        if (d.enabled !== false && (d.campaign?.id || d.placement?.id)) {
          fetch('/api/ads/track/impression', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              slotId: d.placement?.id || slot,
              campaignId: d.campaign?.id,
            }),
          }).catch(() => {});
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [slot]);

  if (adData && adData.enabled === false) {
    return null;
  }

  const trackClick = () => {
    fetch('/api/ads/track/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slotId: adData?.placement?.id || slot,
        campaignId: adData?.campaign?.id,
      }),
    }).catch(() => {});
  };

  const activeCamp = adData?.campaign;
  const resolvedBanner = activeCamp?.bannerUrl || imageUrl;
  const resolvedDest = activeCamp?.destinationUrl || targetUrl || '/en/contact';

  if (slot === 'leaderboard') {
    return (
      <div className="my-6 max-w-7xl mx-auto px-4 ad-banner">
        <div className="bg-gray-100 border border-dashed border-gray-300 rounded-xl p-2 text-center overflow-hidden">
          <div className="text-[10px] tracking-widest text-gray-400 uppercase font-semibold mb-1">
            {isUrdu ? 'اشتہار - تجارتی پیشکش' : 'SPONSORED LEADERBOARD ADVERTISEMENT'}
          </div>
          {activeCamp && resolvedBanner ? (
            <a
              href={resolvedDest}
              target={resolvedDest.startsWith('http') ? '_blank' : undefined}
              rel={resolvedDest.startsWith('http') ? 'noopener noreferrer sponsored' : undefined}
              onClick={trackClick}
              className="block rounded-lg overflow-hidden"
            >
              <img
                src={resolvedBanner}
                alt={activeCamp.campaignName || 'Sponsored Advertisement'}
                width={728}
                height={112}
                loading="lazy"
                decoding="async"
                className="w-full max-h-28 object-cover rounded-lg"
              />
            </a>
          ) : (
            <div className="h-24 sm:h-28 bg-gradient-to-r from-emerald-900 to-teal-900 rounded-lg flex items-center justify-between px-6 text-white overflow-hidden relative shadow-inner">
              <div className="relative z-10 text-start">
                <span className="bg-amber-400 text-gray-950 text-[10px] font-extrabold px-2 py-0.5 rounded-sm uppercase tracking-wider">
                  {activeCamp?.advertiserName || (isUrdu ? 'خصوصی پروموشن' : 'Exclusive Partner')}
                </span>
                <h4 className="text-base sm:text-lg font-black mt-1">
                  {activeCamp?.campaignName ||
                    (isUrdu ? 'پاکستان کے نمبر 1 بینکنگ اور ڈیجیٹل پیمنٹ حل' : 'National Digital Banking & Roshan Digital Accounts')}
                </h4>
                <p className="text-xs text-emerald-200 hidden sm:block">
                  {isUrdu ? 'اوورسیز پاکستانیوں کے لیے پرکشش منافع اور تیز ترین ترسیلاتِ زر' : 'Zero tax on remittances & attractive profit certificates for overseas Pakistanis.'}
                </p>
              </div>
              <div className="relative z-10 shrink-0">
                <a
                  href={resolvedDest}
                  target={resolvedDest.startsWith('http') ? '_blank' : undefined}
                  rel={resolvedDest.startsWith('http') ? 'noopener noreferrer sponsored' : undefined}
                  onClick={trackClick}
                  className="inline-block px-4 py-2 bg-amber-400 hover:bg-amber-500 text-gray-950 font-bold rounded-lg text-xs shadow-md transition-colors"
                >
                  {isUrdu ? 'مزید معلومات' : 'Learn More'}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Sidebar or in-content
  return (
    <div className="my-4 bg-gray-100 border border-dashed border-gray-300 rounded-xl p-2 text-center ad-banner">
      <div className="text-[10px] tracking-widest text-gray-400 uppercase font-semibold mb-1">
        {isUrdu ? 'اشتہار' : 'SPONSORED'}
      </div>
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg p-5 text-white text-center relative overflow-hidden">
        {resolvedBanner ? (
          <a
            href={resolvedDest}
            target={resolvedDest.startsWith('http') ? '_blank' : undefined}
            rel={resolvedDest.startsWith('http') ? 'noopener noreferrer sponsored' : undefined}
            onClick={trackClick}
            className="block"
          >
            <img
              src={resolvedBanner}
              alt={activeCamp?.campaignName || 'Advertisement'}
              width={360}
              height={160}
              loading="lazy"
              decoding="async"
              className="w-full h-40 object-cover rounded-md mb-2"
            />
          </a>
        ) : (
          <div className="space-y-2">
            <span className="text-xs font-bold text-amber-400">
              {activeCamp?.campaignName || (isUrdu ? 'پاکستان رئیل اسٹیٹ سمٹ 2026' : 'Pakistan Real Estate & Housing Expo')}
            </span>
            <p className="text-xs text-slate-300">
              {activeCamp?.advertiserName ||
                (isUrdu ? 'اسلام آباد اور گوادر میں محفوظ سرمایہ کاری' : 'Verified commercial plots & apartments in Islamabad and Gwadar.')}
            </p>
            <a
              href={resolvedDest}
              target={resolvedDest.startsWith('http') ? '_blank' : undefined}
              rel={resolvedDest.startsWith('http') ? 'noopener noreferrer sponsored' : undefined}
              onClick={trackClick}
              className="inline-block mt-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors"
            >
              {isUrdu ? 'بکنگ کروائیں' : 'Book Now'}
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
