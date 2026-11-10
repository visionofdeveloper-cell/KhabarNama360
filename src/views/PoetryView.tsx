import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { Poet, Poem } from '../types/index.ts';
import { Feather, BookOpen, Quote, Share2 } from 'lucide-react';

export const PoetryView: React.FC = () => {
  const { isUrdu } = useLanguage();
  const [poets, setPoets] = useState<Poet[]>([]);
  const [poems, setPoems] = useState<Poem[]>([]);
  const [selectedPoetId, setSelectedPoetId] = useState<string>('all');

  useEffect(() => {
    fetch('/api/poetry')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setPoets(data.poets);
          setPoems(data.poems);
        }
      })
      .catch(console.error);
  }, []);

  const filteredPoems = selectedPoetId === 'all'
    ? poems
    : poems.filter(p => p.poetId === selectedPoetId);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 text-white rounded-3xl p-6 sm:p-10 shadow-xl">
        <div className="inline-flex items-center gap-2 bg-amber-400 text-gray-950 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
          <Feather className="w-4 h-4" />
          <span>{isUrdu ? 'اردو ادب و کلاسیکی شاعری' : 'Urdu Poetry & Literature'}</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-black">
          {isUrdu ? 'علامہ اقبال، مرزا غالب اور فیض احمد فیض کی لازوال شاعری' : 'Classical Urdu Ghazals, Nazms & Literary Masterpieces'}
        </h1>
        <p className="text-emerald-200 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
          {isUrdu
            ? 'شعر و سخن، کلامِ خودی، انقلابی نظمیں اور اردو ادب کے مایہ ناز شعراء کا منتخب کلام نستعلیق رسم الخط میں'
            : 'Explore philosophical verses, Ghazals, and poetic translations celebrating human dignity.'}
        </p>
      </div>

      {/* Famous Poets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {poets.map((poet) => (
          <div
            key={poet.id}
            onClick={() => setSelectedPoetId(selectedPoetId === poet.id ? 'all' : poet.id)}
            className={`p-6 rounded-3xl border cursor-pointer transition-all ${
              selectedPoetId === poet.id
                ? 'bg-emerald-900 text-white border-emerald-700 shadow-lg scale-102'
                : 'bg-white border-gray-200 hover:border-emerald-400 text-gray-900 shadow-xs'
            }`}
          >
            <div className="flex items-center gap-4 mb-4">
              <img
                src={poet.image}
                alt={poet.nameEn}
                className="w-14 h-14 rounded-full object-cover ring-2 ring-amber-400/50"
              />
              <div>
                <h3 className="font-black text-base">
                  {isUrdu ? poet.nameUr : poet.nameEn}
                </h3>
                <span className="text-xs text-amber-400 font-mono">{poet.era}</span>
              </div>
            </div>
            <p className="text-xs leading-relaxed opacity-90 line-clamp-3 font-urdu">
              {isUrdu ? poet.bioUr : poet.bioEn}
            </p>
            <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between text-xs font-bold">
              <span>{poet.cityEn}</span>
              <span className="text-amber-400">{poet.poemCount}+ Verses</span>
            </div>
          </div>
        ))}
      </div>

      {/* Poems / Ghazals List */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Quote className="w-5 h-5 text-emerald-700" />
            <span>{isUrdu ? 'منتخب کلام و غزلیات' : 'Selected Ghazals & Couplets'}</span>
          </h2>
          {selectedPoetId !== 'all' && (
            <button
              onClick={() => setSelectedPoetId('all')}
              className="text-xs text-emerald-700 font-bold hover:underline"
            >
              {isUrdu ? 'تمام شعراء دیکھیں' : 'Show All Poets'}
            </button>
          )}
        </div>

        <div className="space-y-6">
          {filteredPoems.map((poem) => (
            <div key={poem.id} className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md uppercase">
                    {poem.category}
                  </span>
                  <h3 className="text-lg font-black text-gray-900 mt-1">
                    {isUrdu ? poem.titleUr : poem.titleEn}
                  </h3>
                </div>
                <div className="text-xs text-gray-500 font-bold">
                  {isUrdu ? poem.poetNameUr : poem.poetNameEn}
                </div>
              </div>

              {/* Urdu Verses in Nastaliq */}
              <div className="bg-emerald-50/50 border border-emerald-100 p-6 rounded-2xl text-center space-y-4">
                {poem.linesUr.map((line, i) => (
                  <p key={i} className="text-lg sm:text-2xl font-black text-emerald-950 font-urdu leading-loose">
                    {line}
                  </p>
                ))}
              </div>

              {/* English Poetic Translation */}
              <div className="text-xs text-gray-600 italic border-l-2 border-amber-400 pl-4 space-y-1">
                <span className="text-[10px] uppercase font-bold text-gray-400 not-italic block">Poetic Translation:</span>
                {poem.linesEn.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
