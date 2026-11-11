import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { Article } from '../types/index.ts';
import {
  Clock,
  Eye,
  Calendar,
  Share2,
  Bookmark,
  Volume2,
  ChevronRight,
  ArrowLeft,
  Check,
  Tag,
  MessageSquare,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { AdBanner } from '../components/AdBanner.tsx';

interface ArticleDetailViewProps {
  article: Article;
  onSelectArticle: (art: Article) => void;
  onBack: () => void;
}

export const ArticleDetailView: React.FC<ArticleDetailViewProps> = ({
  article,
  onSelectArticle,
  onBack
}) => {
  const { isUrdu, t, navigateTo } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xlarge'>('normal');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentList, setCommentList] = useState<{ name: string; text: string; time: string }[]>([
    {
      name: isUrdu ? 'احمد علی خان' : 'Ahmed Ali Khan',
      text: isUrdu ? 'انتہائی جامع اور بروقت رپورٹنگ، مبارک باد۔' : 'Very comprehensive and well-researched article.',
      time: '2 hours ago'
    }
  ]);

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(`${isUrdu ? article.titleUr : article.titleEn} - 360Khabarnama\n${window.location.href}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleShareFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank');
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setCommentList([
      {
        name: isUrdu ? 'قاری صاحب' : 'Verified Reader',
        text: commentText.trim(),
        time: 'Just now'
      },
      ...commentList
    ]);
    setCommentText('');
  };

  const contentClass = fontSize === 'xlarge'
    ? 'text-xl leading-loose'
    : fontSize === 'large'
    ? 'text-lg leading-relaxed'
    : 'text-base leading-relaxed';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-gray-500">
        <button onClick={onBack} className="hover:text-emerald-700 font-medium">
          {t('nav.home')}
        </button>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="capitalize hover:text-emerald-700 cursor-pointer font-medium">
          {article.category}
        </span>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-gray-400 truncate max-w-xs font-semibold">
          {isUrdu ? article.titleUr : article.titleEn}
        </span>
      </nav>

      {/* Category Badge & Timestamps */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
          {article.category}
        </span>

        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span>{article.readingTimeMin} {t('common.minRead')}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-gray-400" />
            <span>{article.views?.toLocaleString()} {isUrdu ? 'مناظر' : 'views'}</span>
          </span>
        </div>
      </div>

      {/* Main Headline */}
      <h1 className="text-2xl sm:text-4xl font-black text-gray-950 leading-tight">
        {isUrdu ? article.titleUr : article.titleEn}
      </h1>

      {/* Summary / Subheading */}
      <p className="text-base sm:text-lg text-gray-600 font-medium border-l-4 border-emerald-600 pl-4 py-1 italic leading-relaxed">
        {isUrdu ? article.summaryUr : article.summaryEn}
      </p>

      {/* Author Bar & Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-4 border-y border-gray-200">
        <div className="flex items-center gap-3">
          <img
            src={article.author.avatar}
            alt={article.author.nameEn}
            className="w-11 h-11 rounded-full object-cover ring-2 ring-emerald-600/30"
          />
          <div>
            <div className="font-bold text-sm text-gray-900">
              {isUrdu ? article.author.nameUr : article.author.nameEn}
            </div>
            <div className="text-xs text-gray-500">{article.author.role}</div>
          </div>
        </div>

        {/* Font Controls & Audio Reader */}
        <div className="flex items-center gap-2">
          {/* Audio Reader Toggle */}
          <button
            onClick={() => setIsPlayingAudio(!isPlayingAudio)}
            className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              isPlayingAudio
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-300'
            }`}
            title="Listen to article"
          >
            <Volume2 className="w-4 h-4" />
            <span className="hidden sm:inline">
              {isPlayingAudio ? (isUrdu ? 'آواز جاری ہے...' : 'Playing...') : (isUrdu ? 'سنیں' : 'Listen')}
            </span>
          </button>

          {/* Font Resizing */}
          <div className="flex items-center bg-gray-100 rounded-xl p-1 border border-gray-200 text-xs font-bold text-gray-700">
            <button
              onClick={() => setFontSize('normal')}
              className={`px-2 py-1 rounded-lg ${fontSize === 'normal' ? 'bg-white shadow-xs text-emerald-800' : ''}`}
            >
              A
            </button>
            <button
              onClick={() => setFontSize('large')}
              className={`px-2 py-1 rounded-lg ${fontSize === 'large' ? 'bg-white shadow-xs text-emerald-800' : ''}`}
            >
              A+
            </button>
            <button
              onClick={() => setFontSize('xlarge')}
              className={`px-2 py-1 rounded-lg ${fontSize === 'xlarge' ? 'bg-white shadow-xs text-emerald-800' : ''}`}
            >
              A++
            </button>
          </div>

          {/* Share Buttons */}
          <div className="flex items-center gap-1 pl-2">
            <button
              onClick={handleShareWhatsApp}
              className="p-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl transition-colors"
              title="Share on WhatsApp"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleCopyLink}
              className="p-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl transition-colors"
              title="Copy Link"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Bookmark className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Hero Image & Caption */}
      <div className="space-y-2">
        <div className="aspect-16/9 rounded-3xl overflow-hidden bg-gray-100 shadow-md">
          <img
            src={article.heroImage}
            alt={article.titleEn}
            className="w-full h-full object-cover"
          />
        </div>
        <p className="text-xs text-gray-500 italic text-center">
          {isUrdu ? article.imageCaptionUr : article.imageCaptionEn}
        </p>
      </div>

      {/* In-content Advertisement Slot */}
      <AdBanner slot="in-content" />

      {/* Full Body Article Text */}
      <div className={`prose max-w-none text-gray-800 space-y-4 font-urdu ${contentClass}`}>
        {(isUrdu ? article.contentUr : article.contentEn).split('\n\n').map((paragraph, idx) => (
          <p key={idx} className="leading-relaxed">
            {paragraph}
          </p>
        ))}
      </div>

      {/* Editorial Trust & Verified Stamp */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3 text-xs text-emerald-900">
        <ShieldCheck className="w-6 h-6 text-emerald-700 shrink-0" />
        <div>
          <span className="font-bold">
            {isUrdu ? 'مستند صحافتی تصدیق' : 'Editorial Verification & Fact-Checked'}
          </span>
          <p className="text-emerald-800/80 text-[11px] mt-0.5">
            {isUrdu
              ? 'یہ رپورٹ 360 خبرنامہ کے سینئر نامہ نگاروں اور مصدقہ سرکاری و مارکیٹ ذرائع سے جانچ کر شائع کی گئی ہے۔'
              : 'This coverage adheres to the Press Council code of ethics and has been cross-referenced with official records.'}
          </p>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap items-center gap-2 pt-4">
        <span className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
          <Tag className="w-3.5 h-3.5" />
          <span>{isUrdu ? 'ٹیگز:' : 'Tags:'}</span>
        </span>
        {article.tags.map((tag, idx) => (
          <span
            key={idx}
            className="bg-gray-100 hover:bg-emerald-50 hover:text-emerald-800 text-gray-700 text-xs px-3 py-1 rounded-full cursor-pointer transition-colors"
          >
            #{tag}
          </span>
        ))}
      </div>

      {/* Comments Section */}
      <div className="border-t border-gray-200 pt-8 space-y-6">
        <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-emerald-700" />
          <span>{isUrdu ? 'قارئین کے تبصرے' : 'Reader Comments'}</span>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {commentList.length}
          </span>
        </h3>

        <form onSubmit={handleAddComment} className="space-y-3">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={3}
            placeholder={isUrdu ? 'اپنی قیمتی رائے یہاں تحریر کریں...' : 'Leave your constructive comment...'}
            className="w-full p-4 bg-gray-50 border border-gray-300 rounded-2xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-600 focus:bg-white"
          />
          <button
            type="submit"
            disabled={!commentText.trim()}
            className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-colors"
          >
            {isUrdu ? 'تبصرہ ارسال کریں' : 'Post Comment'}
          </button>
        </form>

        <div className="space-y-3 pt-2">
          {commentList.map((c, i) => (
            <div key={i} className="bg-gray-50 border border-gray-100 p-4 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-gray-900">
                <span>{c.name}</span>
                <span className="text-gray-400 font-normal">{c.time}</span>
              </div>
              <p className="text-xs text-gray-700 font-urdu">{c.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
