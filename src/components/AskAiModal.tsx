import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { Sparkles, X, Send, Bot, AlertCircle } from 'lucide-react';
import { safeFetchJson } from '../utils/safeFetch.ts';

interface AskAiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AskAiModal: React.FC<AskAiModalProps> = ({ isOpen, onClose }) => {
  const { isUrdu, language } = useLanguage();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setError(null);
    setAnswer(null);

    try {
      const data = await safeFetchJson('/api/ai/ask-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, language }),
      });
      if (data.success) {
        setAnswer(data.answer);
      } else {
        setError(data.error || 'Could not fetch response.');
      }
    } catch {
      setError('Connection error with portal AI assistant.');
    } finally {
      setLoading(false);
    }
  };

  const sampleQuestions = isUrdu ? [
    'آج سونے کی فی تولہ قیمت کیا ہے؟',
    'پاکستان اسٹاک مارکیٹ کی تازہ صورتحال کیا ہے؟',
    'کراچی میں مغرب کی نماز کا وقت کیا ہے؟',
    'پیٹرول کی فی لیٹر قیمت کیا ہے؟'
  ] : [
    'What is today gold rate per tola in Pakistan?',
    'What is the current PSX KSE-100 status?',
    'What is the prayer time in Lahore today?',
    'What is the latest petrol price per liter?'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-emerald-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-700/60 rounded-xl">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold">
                {isUrdu ? '360 خبرنامہ اے آئی اسسٹنٹ' : '360Khabarnama AI Assistant'}
              </h3>
              <p className="text-xs text-emerald-200">
                {isUrdu ? 'مستند پاکستانی اعداد و شمار اور خبروں سے تصدیق شدہ معلومات' : 'Grounded in verified 360Khabarnama news and rates'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-700/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Quick prompts */}
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
              {isUrdu ? 'فوری سوالات منتخب کریں:' : 'Suggested Questions:'}
            </span>
            <div className="flex flex-wrap gap-2">
              {sampleQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => setQuestion(q)}
                  className="text-xs bg-emerald-50 text-emerald-900 hover:bg-emerald-100 px-3 py-1.5 rounded-full border border-emerald-200 transition-colors text-start"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="relative mt-4">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={isUrdu ? 'اپنا سوال یہاں درج کریں...' : 'Ask about news, rates, prayer times or results...'}
              className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-600 focus:bg-white text-sm"
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="absolute right-2 top-2 p-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 disabled:opacity-50 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-3 p-4 bg-emerald-50 text-emerald-800 rounded-xl text-sm animate-pulse">
              <Bot className="w-5 h-5 animate-spin" />
              <span>{isUrdu ? 'پورٹل ریکارڈز سے تصدیق کی جا رہی ہے...' : 'Verifying against portal databases and live feeds...'}</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-200">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{isUrdu ? 'معذرت، رابطہ نہ ہو سکا' : 'Notice'}</p>
                <p className="text-xs mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Answer */}
          {answer && (
            <div className="p-4 bg-gray-50 border border-emerald-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isUrdu ? 'مستند جواب:' : 'Verified Answer:'}</span>
              </div>
              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap font-urdu">
                {answer}
              </p>
              <div className="text-[11px] text-gray-400 pt-2 border-t border-gray-200">
                {isUrdu ? 'حوالہ: 360 خبرنامہ تصدیق شدہ فیڈ' : 'Source: 360Khabarnama Verified Database'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
