import React, { useState, useEffect } from 'react';
import { ArrowLeft, Share2, Bookmark, Check } from 'lucide-react';

interface ReadingProgressBarProps {
  targetRef?: React.RefObject<HTMLElement | null>;
  title: string;
  readingTimeMin?: number;
  isUrdu?: boolean;
  onBack?: () => void;
  onShareWhatsApp?: () => void;
}

export const ReadingProgressBar: React.FC<ReadingProgressBarProps> = ({
  targetRef,
  title,
  readingTimeMin = 3,
  isUrdu = false,
  onBack,
  onShareWhatsApp,
}) => {
  const [progress, setProgress] = useState<number>(0);
  const [isHeaderVisible, setIsHeaderVisible] = useState<boolean>(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let ticking = false;

    const calculateProgress = () => {
      let currentProgress = 0;

      if (targetRef && targetRef.current) {
        const el = targetRef.current;
        const rect = el.getBoundingClientRect();
        const elementTop = rect.top + window.scrollY;
        const elementHeight = el.scrollHeight || rect.height;
        const windowHeight = window.innerHeight;
        const scrollPosition = window.scrollY;

        const start = elementTop;
        const end = elementTop + elementHeight - windowHeight;

        if (scrollPosition <= start) {
          currentProgress = 0;
        } else if (scrollPosition >= end) {
          currentProgress = 100;
        } else {
          currentProgress = Math.min(
            100,
            Math.max(0, ((scrollPosition - start) / (end - start)) * 100)
          );
        }
      } else {
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        currentProgress = docHeight > 0 ? (window.scrollY / docHeight) * 100 : 0;
      }

      setProgress(Math.round(currentProgress));
      setIsHeaderVisible(window.scrollY > 280);
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(calculateProgress);
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    calculateProgress();

    return () => window.removeEventListener('scroll', onScroll);
  }, [targetRef]);

  const handleCopy = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Estimate remaining reading time based on progress
  const remainingMinutes = Math.max(
    1,
    Math.ceil(readingTimeMin * ((100 - progress) / 100))
  );

  return (
    <>
      {/* 1. Global Viewport Sticky Top Progress Bar (Always present at the very top edge) */}
      <div
        className="fixed top-0 left-0 right-0 z-50 h-1 bg-gray-200/80 dark:bg-gray-800 backdrop-blur-xs pointer-events-none"
        dir={isUrdu ? 'rtl' : 'ltr'}
      >
        <div
          className="h-full bg-gradient-to-r from-emerald-600 via-teal-500 to-amber-400 transition-[width] duration-150 ease-out relative shadow-[0_0_10px_rgba(16,185,129,0.7)]"
          style={{ width: `${progress}%` }}
        >
          {/* Glowing cursor bead at current reading position */}
          {progress > 0 && progress < 100 && (
            <span
              className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-amber-300 ring-2 ring-emerald-600 shadow-md ${
                isUrdu ? '-left-1' : '-right-1'
              }`}
            />
          )}
        </div>
      </div>

      {/* 2. Scroll-Linked Floating Reading Bar (Reveals smoothly when scrolled past title) */}
      <div
        className={`fixed top-1 left-0 right-0 z-40 transition-all duration-300 ease-in-out ${
          isHeaderVisible
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 -translate-y-3 pointer-events-none'
        }`}
        dir={isUrdu ? 'rtl' : 'ltr'}
      >
        <div className="max-w-4xl mx-auto px-3 sm:px-4">
          <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-gray-200/80 dark:border-gray-800 shadow-lg shadow-black/5 rounded-2xl px-4 py-2.5 flex items-center justify-between gap-3">
            {/* Left: Back button & Truncated Headline */}
            <div className="flex items-center gap-2.5 min-w-0">
              {onBack && (
                <button
                  onClick={onBack}
                  title={isUrdu ? 'واپس جائیں' : 'Go back'}
                  className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors shrink-0"
                >
                  <ArrowLeft className={`w-4 h-4 ${isUrdu ? 'rotate-180' : ''}`} />
                </button>
              )}
              <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate max-w-[220px] sm:max-w-md">
                {title}
              </h3>
            </div>

            {/* Right: Reading Progress Pill & Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Progress & Time Remaining Pill */}
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200 text-xs font-semibold">
                <span className="font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {progress}%
                </span>
                <span className="text-emerald-300 dark:text-emerald-700">•</span>
                <span className="hidden sm:inline text-[11px] text-emerald-800/90 dark:text-emerald-300">
                  {progress >= 100
                    ? isUrdu
                      ? 'مطالعہ مکمل'
                      : 'Completed'
                    : isUrdu
                    ? `تقریباً ${remainingMinutes} منٹ باقی`
                    : `~${remainingMinutes} min left`}
                </span>
              </div>

              {/* Share Actions */}
              {onShareWhatsApp && (
                <button
                  onClick={onShareWhatsApp}
                  title="Share on WhatsApp"
                  className="p-1.5 rounded-xl text-emerald-700 hover:bg-emerald-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={handleCopy}
                title="Copy Link"
                className="p-1.5 rounded-xl text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Bookmark className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
