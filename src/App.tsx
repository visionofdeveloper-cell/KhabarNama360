import React, { useState, useEffect } from 'react';
import { LanguageProvider, useLanguage } from './context/LanguageContext.tsx';
import { FirebaseProvider } from './context/FirebaseContext.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { PublicLayout } from './components/layout/PublicLayout.tsx';
import { Article, CricketMatch, GoldRate, CurrencyRate, FuelPrice, PSXData, WeatherData } from './types/index.ts';
import { safeFetchJson } from './utils/safeFetch.ts';

// Views
import { HomeView } from './views/HomeView.tsx';
import { ArticleDetailView } from './views/ArticleDetailView.tsx';
import { EducationView } from './views/EducationView.tsx';
import { FinanceView } from './views/FinanceView.tsx';
import { WeatherView } from './views/WeatherView.tsx';
import { IslamicView } from './views/IslamicView.tsx';
import { MobilesView } from './views/MobilesView.tsx';
import { CarsView } from './views/CarsView.tsx';
import { PrizeBondsView } from './views/PrizeBondsView.tsx';
import { DictionaryNamesView } from './views/DictionaryNamesView.tsx';
import { PoetryView } from './views/PoetryView.tsx';
import { RecipesView } from './views/RecipesView.tsx';
import { JobsView } from './views/JobsView.tsx';
import { ToolsView } from './views/ToolsView.tsx';
import { CricketView } from './views/CricketView.tsx';
import { NewsCategoryView } from './views/NewsCategoryView.tsx';
import { SearchView } from './views/SearchView.tsx';
import { LegalPageView } from './views/LegalPageView.tsx';
import { LEGAL_PAGE_SLUGS } from './data/legalPages.ts';

const AdminAuthGate = React.lazy(() => import('./views/AdminAuthGate.tsx').then(m => ({ default: m.AdminAuthGate })));

export interface LivePortalSnapshot {
  worldNews: Article[];
  sportsNews: Article[];
  cricketMatches: CricketMatch[];
  goldRates: GoldRate[];
  currencyRates: CurrencyRate[];
  fuelPrices: FuelPrice[];
  psx: PSXData | null;
  weather: WeatherData[];
  updatedAt: string;
}

const BACKGROUND_REFRESH_MS = 120_000; // Every 2 minutes

function MainPortal() {
  const { currentRoute, navigateTo } = useLanguage();
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [liveSnapshot, setLiveSnapshot] = useState<LivePortalSnapshot | null>(null);

  // Background Scheduler: Periodically fetches latest World News, Sports, Gold Rates & Weather
  useEffect(() => {
    if (currentRoute === 'admin') return;

    let cancelled = false;
    let inFlight = false;

    const syncLiveFeeds = async () => {
      if (inFlight || cancelled) return;
      inFlight = true;
      try {
        const [worldRes, sportsRes, cricketRes, financeRes, weatherRes] = await Promise.all([
          safeFetchJson('/api/news?category=world&limit=10'),
          safeFetchJson('/api/news?category=sports&limit=10'),
          safeFetchJson('/api/cricket/matches'),
          safeFetchJson('/api/finance/rates'),
          safeFetchJson('/api/weather'),
        ]);

        if (cancelled) return;

        const nextSnapshot: LivePortalSnapshot = {
          worldNews: worldRes.success && Array.isArray(worldRes.articles) ? worldRes.articles : [],
          sportsNews: sportsRes.success && Array.isArray(sportsRes.articles) ? sportsRes.articles : [],
          cricketMatches: cricketRes.success && Array.isArray(cricketRes.matches) ? cricketRes.matches : [],
          goldRates: financeRes.success && Array.isArray(financeRes.goldRates) ? financeRes.goldRates : [],
          currencyRates: financeRes.success && Array.isArray(financeRes.currencyRates) ? financeRes.currencyRates : [],
          fuelPrices: financeRes.success && Array.isArray(financeRes.fuelPrices) ? financeRes.fuelPrices : [],
          psx: financeRes.success && financeRes.psx ? financeRes.psx : null,
          weather: weatherRes.success && Array.isArray(weatherRes.weather) ? weatherRes.weather : [],
          updatedAt: new Date().toISOString(),
        };

        setLiveSnapshot(nextSnapshot);
        if (typeof window !== 'undefined') {
          (window as any).__360knLiveData = nextSnapshot;
          window.dispatchEvent(new CustomEvent('360kn:live-data-updated', { detail: nextSnapshot }));
        }
      } catch (err) {
        console.warn('[BackgroundScheduler] Live sync error:', err);
      } finally {
        inFlight = false;
      }
    };

    void syncLiveFeeds();

    const intervalId = window.setInterval(() => {
      void syncLiveFeeds();
    }, BACKGROUND_REFRESH_MS);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void syncLiveFeeds();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [currentRoute]);

  const handleSelectArticle = (article: Article) => {
    setSelectedArticle(article);
    navigateTo('article');
  };

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    navigateTo('search');
  };

  // Strict Route Separation: Private Admin OS NEVER mounts PublicLayout, public <Header>, or public <Footer>
  if (currentRoute === 'admin') {
    return (
      <React.Suspense
        fallback={
          <div dir="ltr" className="min-h-screen bg-gray-950 flex items-center justify-center text-emerald-400 text-xs font-mono">
            Loading Private Admin...
          </div>
        }
      >
        <AdminAuthGate />
      </React.Suspense>
    );
  }

  const renderPublicView = () => {
    if (currentRoute === 'article' && selectedArticle) {
      return (
        <ArticleDetailView
          article={selectedArticle}
          onSelectArticle={handleSelectArticle}
          onBack={() => navigateTo('home')}
        />
      );
    }

    if (LEGAL_PAGE_SLUGS.has(currentRoute)) {
      return <LegalPageView slug={currentRoute} />;
    }

    switch (currentRoute) {
      case 'home':
        return <HomeView onSelectArticle={handleSelectArticle} onSearch={handleSearch} />;
      case 'education':
        return <EducationView />;
      case 'business':
        return <FinanceView />;
      case 'weather':
        return <WeatherView />;
      case 'islamic':
        return <IslamicView />;
      case 'mobiles':
        return <MobilesView />;
      case 'automobiles':
        return <CarsView />;
      case 'prizebonds':
        return <PrizeBondsView />;
      case 'dictionary':
        return <DictionaryNamesView />;
      case 'poetry':
        return <PoetryView />;
      case 'recipes':
        return <RecipesView />;
      case 'jobs':
        return <JobsView />;
      case 'tools':
        return <ToolsView />;
      case 'sports':
        return <CricketView />;
      case 'search':
        return <SearchView initialQuery={searchQuery} onSelectArticle={handleSelectArticle} />;
      default:
        // Dynamic category coverage (builtin news categories OR newly created custom categories from Category Page Manager)
        return <NewsCategoryView categorySlug={currentRoute} onSelectArticle={handleSelectArticle} />;
    }
  };

  return (
    <PublicLayout onSearch={handleSearch}>
      {renderPublicView()}
    </PublicLayout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <FirebaseProvider>
        <LanguageProvider>
          <MainPortal />
        </LanguageProvider>
      </FirebaseProvider>
    </ErrorBoundary>
  );
}
