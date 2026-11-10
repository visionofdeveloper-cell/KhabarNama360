import React, { useState } from 'react';
import { LanguageProvider, useLanguage } from './context/LanguageContext.tsx';
import { Header } from './components/Header.tsx';
import { Footer } from './components/Footer.tsx';
import { Article } from './types/index.ts';

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

const AdminAuthGate = React.lazy(() => import('./views/AdminAuthGate.tsx').then(m => ({ default: m.AdminAuthGate })));

function MainPortal() {
  const { currentRoute, navigateTo } = useLanguage();
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSelectArticle = (article: Article) => {
    setSelectedArticle(article);
    navigateTo('article');
  };

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    navigateTo('search');
  };

  const renderCurrentView = () => {
    // If viewing an article
    if (currentRoute === 'article' && selectedArticle) {
      return (
        <ArticleDetailView
          article={selectedArticle}
          onSelectArticle={handleSelectArticle}
          onBack={() => navigateTo('home')}
        />
      );
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
      case 'admin':
        return (
          <React.Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center text-emerald-400 text-xs font-mono">Loading Private Admin...</div>}>
            <AdminAuthGate />
          </React.Suspense>
        );
      // News Category Archives
      case 'pakistan':
      case 'politics':
      case 'technology':
      case 'world':
      case 'entertainment':
      case 'health':
        return <NewsCategoryView categorySlug={currentRoute} onSelectArticle={handleSelectArticle} />;
      default:
        return <HomeView onSelectArticle={handleSelectArticle} onSearch={handleSearch} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900">
      <Header onSearch={handleSearch} />
      <main className="flex-1 w-full animate-in fade-in duration-300">
        {renderCurrentView()}
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <MainPortal />
    </LanguageProvider>
  );
}
