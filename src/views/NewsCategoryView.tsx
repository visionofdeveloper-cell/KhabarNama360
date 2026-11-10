import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { Article } from '../types/index.ts';
import { Clock, Eye, Calendar, ArrowRight, Tag } from 'lucide-react';

interface NewsCategoryViewProps {
  categorySlug: string;
  onSelectArticle: (article: Article) => void;
}

export const NewsCategoryView: React.FC<NewsCategoryViewProps> = ({
  categorySlug,
  onSelectArticle
}) => {
  const { isUrdu, t } = useLanguage();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/news?category=${categorySlug}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setArticles(data.articles);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [categorySlug]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Category Header */}
      <div className="border-b-2 border-emerald-700 pb-4 flex items-center justify-between">
        <div>
          <span className="text-xs font-black uppercase text-emerald-700 tracking-wider">
            {isUrdu ? 'نیوز کیٹیگری آرکائیو' : 'Category Archive'}
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 capitalize mt-1">
            {categorySlug} {isUrdu ? 'کی اہم خبریں' : 'Coverage'}
          </h1>
        </div>
        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full font-mono">
          {articles.length} Stories
        </span>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400 animate-pulse text-sm">
          {isUrdu ? 'خبریں لوڈ کی جا رہی ہیں...' : 'Loading category articles...'}
        </div>
      ) : articles.length === 0 ? (
        <div className="py-16 text-center text-gray-500 bg-white rounded-3xl border border-gray-200">
          <p className="text-base font-bold">
            {isUrdu ? 'اس شعبے میں مزید خبریں جلد شائع کی جائیں گی۔' : 'No articles published in this category yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((art) => (
            <div
              key={art.id}
              onClick={() => onSelectArticle(art)}
              className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-xs hover:shadow-lg transition-all flex flex-col justify-between cursor-pointer group"
            >
              <div>
                <div className="aspect-16/10 overflow-hidden bg-gray-100 relative">
                  <img
                    src={art.heroImage}
                    alt={art.titleEn}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <span className="absolute top-3 left-3 bg-emerald-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">
                    {art.category}
                  </span>
                </div>

                <div className="p-5 space-y-2">
                  <div className="flex items-center gap-3 text-[11px] text-gray-400">
                    <span>{new Date(art.publishedAt).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>{art.readingTimeMin} {t('common.minRead')}</span>
                  </div>

                  <h3 className="font-extrabold text-base text-gray-900 group-hover:text-emerald-700 transition-colors line-clamp-2 leading-snug">
                    {isUrdu ? art.titleUr : art.titleEn}
                  </h3>

                  <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                    {isUrdu ? art.summaryUr : art.summaryEn}
                  </p>
                </div>
              </div>

              <div className="p-5 pt-0 border-t border-gray-100 flex items-center justify-between text-xs text-emerald-700 font-bold">
                <span>{isUrdu ? art.author.nameUr : art.author.nameEn}</span>
                <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  <span>{t('common.readMore')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
