import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { Article, CategoryPageConfig } from '../types/index.ts';
import { ArrowRight } from 'lucide-react';
import { AdBanner } from '../components/AdBanner.tsx';

interface NewsCategoryViewProps {
  categorySlug: string;
  onSelectArticle: (article: Article) => void;
}

export const NewsCategoryView: React.FC<NewsCategoryViewProps> = ({
  categorySlug,
  onSelectArticle,
}) => {
  const { isUrdu, t } = useLanguage();
  const [articles, setArticles] = useState<Article[]>([]);
  const [pageConfig, setPageConfig] = useState<CategoryPageConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/news?category=${encodeURIComponent(categorySlug)}`).then(res => res.json()),
      fetch(`/api/categories/${encodeURIComponent(categorySlug)}/page`).then(res => res.json()),
    ])
      .then(([newsRes, pageRes]) => {
        if (newsRes.success) setArticles(newsRes.articles || []);
        if (pageRes.success && pageRes.category) setPageConfig(pageRes.category);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [categorySlug]);

  const title =
    pageConfig && (isUrdu ? pageConfig.nameUr : pageConfig.nameEn)
      ? isUrdu
        ? pageConfig.nameUr
        : pageConfig.nameEn
      : `${categorySlug} ${isUrdu ? 'کی اہم خبریں' : 'Coverage'}`;

  const subtitle =
    pageConfig && (isUrdu ? pageConfig.descriptionUr : pageConfig.descriptionEn);

  const hasAdBlock = pageConfig?.blocks?.some(b => b.enabled && b.type === 'ad_unit_slot');

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Category Header */}
      <div className="border-b-2 border-emerald-700 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-xs font-black uppercase text-emerald-700 tracking-wider">
            {isUrdu ? 'نیوز کیٹیگری آرکائیو' : 'Category Archive'}
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 capitalize mt-1">{title}</h1>
          {subtitle && <p className="text-xs text-gray-600 mt-1">{subtitle}</p>}
        </div>
        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full font-mono self-start sm:self-auto">
          {articles.length} Stories
        </span>
      </div>

      {hasAdBlock && <AdBanner slot="leaderboard" />}

      {loading ? (
        <div className="py-20 text-center text-gray-400 animate-pulse text-sm">
          {isUrdu ? 'خبریں لوڈ کی جا رہی ہیں...' : 'Loading category articles...'}
        </div>
      ) : articles.length === 0 ? (
        <div className="py-16 text-center text-gray-500 bg-white rounded-3xl border border-gray-200">
          <p className="text-base font-bold">
            {isUrdu
              ? 'اس شعبے میں مزید خبریں جلد شائع کی جائیں گی۔'
              : 'No articles published in this category yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map(art => (
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
                    <span>
                      {art.readingTimeMin} {t('common.minRead')}
                    </span>
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
