import React, { useState, useEffect } from 'react';
import { LanguageProvider, useLanguage } from './context/LanguageContext.tsx';
import { FirebaseProvider } from './context/FirebaseContext.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { PublicLayout } from './components/layout/PublicLayout.tsx';
import { Article, CricketMatch, GoldRate, CurrencyRate, FuelPrice, PSXData, WeatherData } from './types/index.ts';
import { safeFetchJson } from './utils/safeFetch.ts';
import { attachOutboundLinkTracker, trackPageView } from './utils/googleTracking.ts';
import { initWebVitalsReporter } from './utils/webVitals.ts';

// Primary landing view eager-loaded for fast initial paint; secondary routes code-split via React.lazy
import { HomeView } from './views/HomeView.tsx';
import { LEGAL_PAGE_SLUGS } from './data/legalPages.ts';

const ArticleDetailView = React.lazy(() => import('./views/ArticleDetailView.tsx').then(m => ({ default: m.ArticleDetailView })));
const EducationView = React.lazy(() => import('./views/EducationView.tsx').then(m => ({ default: m.EducationView })));
const FinanceView = React.lazy(() => import('./views/FinanceView.tsx').then(m => ({ default: m.FinanceView })));
const WeatherView = React.lazy(() => import('./views/WeatherView.tsx').then(m => ({ default: m.WeatherView })));
const IslamicView = React.lazy(() => import('./views/IslamicView.tsx').then(m => ({ default: m.IslamicView })));
const MobilesView = React.lazy(() => import('./views/MobilesView.tsx').then(m => ({ default: m.MobilesView })));
const CarsView = React.lazy(() => import('./views/CarsView.tsx').then(m => ({ default: m.CarsView })));
const PrizeBondsView = React.lazy(() => import('./views/PrizeBondsView.tsx').then(m => ({ default: m.PrizeBondsView })));
const DictionaryNamesView = React.lazy(() => import('./views/DictionaryNamesView.tsx').then(m => ({ default: m.DictionaryNamesView })));
const PoetryView = React.lazy(() => import('./views/PoetryView.tsx').then(m => ({ default: m.PoetryView })));
const RecipesView = React.lazy(() => import('./views/RecipesView.tsx').then(m => ({ default: m.RecipesView })));
const JobsView = React.lazy(() => import('./views/JobsView.tsx').then(m => ({ default: m.JobsView })));
const ToolsView = React.lazy(() => import('./views/ToolsView.tsx').then(m => ({ default: m.ToolsView })));
const CricketView = React.lazy(() => import('./views/CricketView.tsx').then(m => ({ default: m.CricketView })));
const NewsCategoryView = React.lazy(() => import('./views/NewsCategoryView.tsx').then(m => ({ default: m.NewsCategoryView })));
const SearchView = React.lazy(() => import('./views/SearchView.tsx').then(m => ({ default: m.SearchView })));
const LegalPageView = React.lazy(() => import('./views/LegalPageView.tsx').then(m => ({ default: m.LegalPageView })));

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
  const { currentRoute, articleSlug, isUrdu, language, navigateTo, navigateToArticle } = useLanguage();
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [articleLoading, setArticleLoading] = useState(false);
  const [articleError, setArticleError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [liveSnapshot, setLiveSnapshot] = useState<LivePortalSnapshot | null>(null);

  useEffect(() => {
    if (currentRoute === 'admin') return;
    initWebVitalsReporter();
    return attachOutboundLinkTracker();
  }, [currentRoute]);

  useEffect(() => {
    if (currentRoute === 'admin') return;
    if (currentRoute === 'article' && articleLoading) return;

    const currentPath =
      typeof window !== 'undefined'
        ? window.location.pathname
        : currentRoute === 'home'
        ? `/${language}`
        : `/${language}/${currentRoute}`;

    let resolvedTitle = '360Khabarnama — Pakistan Bilingual News & Utilities';
    if (currentRoute === 'article' && selectedArticle) {
      const headline = isUrdu
        ? selectedArticle.titleUr || selectedArticle.titleEn
        : selectedArticle.titleEn || selectedArticle.titleUr;
      if (headline) resolvedTitle = `${headline} | 360Khabarnama`;
    } else if (currentRoute !== 'home') {
      resolvedTitle = `${currentRoute.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} | 360Khabarnama`;
    }

    if (typeof document !== 'undefined' && currentRoute === 'article' && selectedArticle) {
      document.title = resolvedTitle;
    }

    trackPageView({
      path: currentPath,
      title: typeof document !== 'undefined' ? document.title || resolvedTitle : resolvedTitle,
      language,
      routeType: currentRoute,
      articleSlug: currentRoute === 'article' ? selectedArticle?.slug || articleSlug : null,
      category: currentRoute === 'article' ? selectedArticle?.category : currentRoute,
    });
  }, [currentRoute, articleSlug, articleLoading, selectedArticle?.id, language, isUrdu]);

  // Sync canonical article route (/:lang/news/:slug) when loaded or refreshed directly
  useEffect(() => {
    if (currentRoute !== 'article' || !articleSlug) return;
    if (selectedArticle && (selectedArticle.slug === articleSlug || selectedArticle.id === articleSlug)) {
      return;
    }

    let cancelled = false;
    setArticleLoading(true);
    setArticleError(null);

    void safeFetchJson(`/api/v1/news/${encodeURIComponent(articleSlug)}`).then(res => {
      if (cancelled) return;
      if (res.success && res.article) {
        setSelectedArticle(res.article);
      } else {
        setSelectedArticle(null);
        setArticleError(res.error || 'Article not found');
      }
      setArticleLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [currentRoute, articleSlug]);

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

    // Defer non-critical background polling until after initial LCP render
    let idleHandle: number | null = null;
    let bootTimeout: number | null = null;
    const winAny = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof winAny.requestIdleCallback === 'function') {
      idleHandle = winAny.requestIdleCallback(() => {
        if (!cancelled) void syncLiveFeeds();
      }, { timeout: 2200 });
    } else {
      bootTimeout = window.setTimeout(() => {
        if (!cancelled) void syncLiveFeeds();
      }, 1200);
    }

    const intervalId = window.setInterval(() => {
      void syncLiveFeeds();
    }, BACKGROUND_REFRESH_MS);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void syncLiveFeeds();
      }
    };
    const handleArticlesUpdated = () => {
      void syncLiveFeeds();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('360kn:articles-updated', handleArticlesUpdated);

    return () => {
      cancelled = true;
      if (idleHandle !== null && typeof winAny.cancelIdleCallback === 'function') {
        winAny.cancelIdleCallback(idleHandle);
      }
      if (bootTimeout !== null) {
        window.clearTimeout(bootTimeout);
      }
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('360kn:articles-updated', handleArticlesUpdated);
    };
  }, [currentRoute]);

  const handleSelectArticle = (article: Article) => {
    setSelectedArticle(article);
    setArticleError(null);
    navigateToArticle(article.slug || article.id);
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
    if (currentRoute === 'article') {
      if (articleLoading) {
        return (
          <div className="max-w-4xl mx-auto px-4 py-20 text-center text-gray-500 text-sm animate-pulse">
            {isUrdu ? 'خبر لوڈ کی جا رہی ہے...' : 'Loading story...'}
          </div>
        );
      }
      if (selectedArticle) {
        return (
          <ArticleDetailView
            article={selectedArticle}
            onSelectArticle={handleSelectArticle}
            onBack={() => navigateTo('home')}
          />
        );
      }
      return (
        <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
          <div className="bg-white border border-gray-200 rounded-3xl p-8 space-y-3 shadow-xs">
            <h1 className="text-xl font-black text-gray-900">
              {isUrdu ? 'یہ خبر دستیاب نہیں ہے' : 'Article Not Found'}
            </h1>
            <p className="text-xs text-gray-500">
              {articleError || (isUrdu ? 'مطلوبہ خبر حذف یا منتقل ہو چکی ہے۔' : 'This story may have been moved or is not currently published.')}
            </p>
            <button
              onClick={() => navigateTo('home')}
              className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl"
            >
              {isUrdu ? 'صفحۂ اول پر واپس جائیں' : 'Return to Homepage'}
            </button>
          </div>
        </div>
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
        return <CricketView onSelectArticle={handleSelectArticle} />;
      case 'search':
        return <SearchView initialQuery={searchQuery} onSelectArticle={handleSelectArticle} />;
      default:
        // Dynamic category coverage (builtin news categories OR newly created custom categories from Category Page Manager)
        return <NewsCategoryView categorySlug={currentRoute} onSelectArticle={handleSelectArticle} />;
    }
  };

  return (
    <PublicLayout onSearch={handleSearch}>
      <React.Suspense
        fallback={
          <div className="max-w-7xl mx-auto px-4 py-14 text-center text-xs text-gray-500 animate-pulse">
            {isUrdu ? 'صفحہ لوڈ ہو رہا ہے...' : 'Loading section...'}
          </div>
        }
      >
        {renderPublicView()}
      </React.Suspense>
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
