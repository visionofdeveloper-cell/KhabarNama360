import React, { useEffect, useState } from 'react';
import { Header } from '../Header.tsx';
import { Footer } from '../Footer.tsx';
import { CookieConsent } from '../CookieConsent.tsx';
import { NotificationToast } from '../NotificationToast.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { Wrench } from 'lucide-react';

interface PublicLayoutProps {
  onSearch: (q: string) => void;
  children: React.ReactNode;
}

export const PublicLayout: React.FC<PublicLayoutProps> = ({ onSearch, children }) => {
  const { isUrdu } = useLanguage();
  const [maintenance, setMaintenance] = useState<{ enabled: boolean; messageEn: string; messageUr: string } | null>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.settings?.maintenance?.enabled) {
          setMaintenance(d.settings.maintenance);
        }
      })
      .catch(() => {});
  }, []);

  if (maintenance?.enabled) {
    return (
      <div className="min-h-screen bg-emerald-950 text-white flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-gray-900/90 border border-emerald-700/60 rounded-2xl p-8 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center">
            <Wrench className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-black">
            {isUrdu ? 'ویب سائٹ اپ گریڈ کی جا رہی ہے' : 'Scheduled Maintenance in Progress'}
          </h1>
          <p className="text-sm text-emerald-100/90 leading-relaxed">
            {isUrdu ? maintenance.messageUr : maintenance.messageEn}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900">
      <Header onSearch={onSearch} />
      <main className="flex-1 w-full animate-in fade-in duration-300">
        {children}
      </main>
      <Footer />
      <CookieConsent />
      <NotificationToast />
    </div>
  );
};
