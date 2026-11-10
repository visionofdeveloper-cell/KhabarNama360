import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { Article } from '../types/index.ts';
import { Search, Sparkles, FileText, Award, BookOpen, Briefcase, ArrowRight } from 'lucide-react';

interface SearchViewProps {
  initialQuery: string;
  onSelectArticle: (article: Article) => void;
}

export const SearchView: React.FC<SearchViewProps> = ({ initialQuery, onSelectArticle }) => {
  const { isUrdu, navigateTo } = useLanguage();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<any[]>([]);
  const [normalizedInfo, setNormalizedInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const performSearch = (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setResults(data.results || []);
          setNormalizedInfo(data.query || null);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      performSearch(initialQuery);
    }
  }, [initialQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query);
  };

  const handleItemClick = (item: any) => {
    if (item.type === 'article') {
      fetch(`/api/news/${item.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            onSelectArticle(data.article);
          }
        });
    } else if (item.type === 'result') {
      navigateTo('education');
    } else if (item.type === 'dictionary') {
      navigateTo('dictionary');
    } else if (item.type === 'job') {
      navigateTo('jobs');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Search Header Form */}
      <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs space-y-4">
        <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
          <Search className="w-5 h-5 text-emerald-700" />
          <span>{isUrdu ? 'جامع پورٹل تلاش (اردو و رومن اردو سپورٹ)' : 'Unified Portal Search'}</span>
        </h1>

        <form onSubmit={handleSearchSubmit} className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isUrdu ? 'تلاش کریں (مثلاً: رول نمبر، سونا، خبریں، نوکری)...' : 'Search news, roll numbers, rates, jobs, dictionary...'}
            className="w-full pl-4 pr-24 py-3 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 focus:bg-white"
          />
          <button
            type="submit"
            className="absolute right-2 top-2 bottom-2 px-5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors"
          >
            {isUrdu ? 'تلاش' : 'Search'}
          </button>
        </form>

        {/* Roman Urdu Query Normalization Callout */}
        {normalizedInfo && normalizedInfo.original !== normalizedInfo.normalized && (
          <div className="flex items-center gap-2 text-xs bg-emerald-50 text-emerald-900 p-2.5 rounded-xl border border-emerald-200">
            <Sparkles className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>
              {isUrdu
                ? `رومن اردو تلاش شناخت کی گئی: "${normalizedInfo.original}" کو پورٹل کی ورڈز سے ہم آہنگ کیا گیا ہے۔`
                : `Roman Urdu query normalized: "${normalizedInfo.original}" matched with "${normalizedInfo.normalized}"`}
            </span>
          </div>
        )}
      </div>

      {/* Results Feed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-gray-500 font-semibold px-1">
          <span>{results.length} {isUrdu ? 'نتائج برآمد ہوئے' : 'records found'}</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-400 text-sm animate-pulse">
            {isUrdu ? 'تلاش کی جا رہی ہے...' : 'Searching database...'}
          </div>
        ) : results.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-gray-200 text-gray-500 text-sm">
            {isUrdu ? 'کوئی نتیجہ دستیاب نہیں۔ براہ کرم مختلف الفاظ سے تلاش کریں۔' : 'No records matched your search query. Try broader keywords.'}
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((item, idx) => (
              <div
                key={idx}
                onClick={() => handleItemClick(item)}
                className="bg-white border border-gray-200 hover:border-emerald-500 p-5 rounded-2xl shadow-xs transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                    item.type === 'article' ? 'bg-emerald-100 text-emerald-800' :
                    item.type === 'result' ? 'bg-amber-100 text-amber-800' :
                    item.type === 'dictionary' ? 'bg-sky-100 text-sky-800' :
                    'bg-purple-100 text-purple-800'
                  }`}>
                    {item.type}
                  </span>
                  {item.category && (
                    <span className="text-[10px] text-gray-400 uppercase font-semibold">
                      • {item.category}
                    </span>
                  )}
                </div>

                <h3 className="font-extrabold text-base text-gray-900 group-hover:text-emerald-700 transition-colors">
                  {isUrdu ? item.titleUr : item.titleEn}
                </h3>

                <p className="text-xs text-gray-600 mt-1 line-clamp-2 font-urdu leading-relaxed">
                  {isUrdu ? item.snippetUr : item.snippetEn}
                </p>

                <div className="mt-3 flex items-center gap-1 text-xs font-bold text-emerald-700">
                  <span>{isUrdu ? 'تفصیل دیکھیں' : 'View details'}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
