import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { DictionaryEntry, BabyName } from '../types/index.ts';
import { BookOpen, Search, Sparkles, Heart, Compass } from 'lucide-react';

export const DictionaryNamesView: React.FC = () => {
  const { isUrdu } = useLanguage();
  const [tab, setTab] = useState<'dictionary' | 'names'>('dictionary');
  const [dictQuery, setDictQuery] = useState('');
  const [dictResults, setDictResults] = useState<DictionaryEntry[]>([]);
  const [namesList, setNamesList] = useState<BabyName[]>([]);
  const [nameGender, setNameGender] = useState<'all' | 'boy' | 'girl'>('all');
  const [nameSearch, setNameSearch] = useState('');

  useEffect(() => {
    fetch('/api/dictionary/search?q=' + encodeURIComponent(dictQuery))
      .then(res => res.json())
      .then(data => {
        if (data.success) setDictResults(data.results);
      })
      .catch(console.error);
  }, [dictQuery]);

  useEffect(() => {
    const url = `/api/names?gender=${nameGender === 'all' ? '' : nameGender}&q=${encodeURIComponent(nameSearch)}`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.success) setNamesList(data.names);
      })
      .catch(console.error);
  }, [nameGender, nameSearch]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-900 to-emerald-950 text-white rounded-3xl p-6 sm:p-10 shadow-xl">
        <div className="inline-flex items-center gap-2 bg-amber-400 text-gray-950 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
          <BookOpen className="w-4 h-4" />
          <span>{isUrdu ? 'اردو لغت و اسلامی نام' : 'Dictionary & Baby Names'}</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-black">
          {isUrdu ? 'انگلش ٹو اردو لغت اور اسلامی و خوبصورت ناموں کا ذخیرہ' : 'English to Urdu Dictionary & Islamic Baby Names'}
        </h1>
        <p className="text-emerald-200 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
          {isUrdu
            ? 'الفاظ کے اردو معانی، تلفظ، رومن اردو اور لڑکوں و لڑکیوں کے مبارک نام ان کے خوبصورت معانی کے ساتھ'
            : 'Explore word definitions, Roman Urdu transliterations, and authentic Islamic names.'}
        </p>
      </div>

      {/* Main Switcher Tabs */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setTab('dictionary')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
            tab === 'dictionary'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>{isUrdu ? 'انگلش ٹو اردو لغت (ڈکشنری)' : 'English ↔ Urdu Dictionary'}</span>
        </button>

        <button
          onClick={() => setTab('names')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
            tab === 'names'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <Heart className="w-4 h-4 text-pink-500" />
          <span>{isUrdu ? 'اسلامی بچوں کے نام (معانی کے ساتھ)' : 'Islamic Baby Names'}</span>
        </button>
      </div>

      {/* Dictionary Section */}
      {tab === 'dictionary' && (
        <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="max-w-xl">
            <label className="block text-xs font-bold text-gray-700 mb-1">
              {isUrdu ? 'لفظ تلاش کریں (انگریزی، اردو یا رومن اردو میں)' : 'Search Word (English, Urdu or Roman Urdu)'}
            </label>
            <div className="relative">
              <input
                type="text"
                value={dictQuery}
                onChange={(e) => setDictQuery(e.target.value)}
                placeholder="e.g. Resilience, Aspiration, Sovereignty..."
                className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 focus:bg-white"
              />
              <Search className="w-4 h-4 text-gray-400 absolute right-3 top-3.5" />
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {dictResults.map((entry) => (
              <div key={entry.id} className="py-4 space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-black text-gray-950 font-serif">
                      {entry.english}
                    </h3>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-md font-mono">
                      {entry.partOfSpeech}
                    </span>
                    <span className="text-xs text-gray-500 italic">
                      ({entry.romanUrdu})
                    </span>
                  </div>
                  <div className="text-xl font-black text-emerald-800 font-urdu">
                    {entry.urdu}
                  </div>
                </div>

                <div className="text-xs text-gray-600 space-y-1">
                  <div><span className="font-bold text-gray-800">English:</span> {entry.definitionEn}</div>
                  <div className="font-urdu"><span className="font-bold text-gray-800">تشریح:</span> {entry.definitionUr}</div>
                  <div className="text-gray-500 italic">Example: "{entry.exampleEn}"</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Baby Names Section */}
      {tab === 'names' && (
        <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {(['all', 'boy', 'girl'] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setNameGender(g)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-colors ${
                    nameGender === g
                      ? 'bg-emerald-700 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {g === 'all' ? (isUrdu ? 'تمام' : 'All') : g === 'boy' ? (isUrdu ? 'لڑکے (Boys)' : 'Boys') : (isUrdu ? 'لڑکیاں (Girls)' : 'Girls')}
                </button>
              ))}
            </div>

            <div className="w-full sm:w-64 relative">
              <input
                type="text"
                value={nameSearch}
                onChange={(e) => setNameSearch(e.target.value)}
                placeholder="Search name (e.g. Ayan, Zainab)..."
                className="w-full pl-3 pr-8 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs"
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-2.5" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {namesList.map((n) => (
              <div key={n.id} className="p-4 bg-gray-50 border border-gray-200 rounded-2xl flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-black text-lg text-gray-900">{n.nameEn}</h4>
                    <span className="text-xs text-gray-400">{n.origin} • Lucky: {n.luckyNumber}</span>
                  </div>
                  <div className="text-2xl font-black text-emerald-800 font-urdu">{n.nameUr}</div>
                </div>

                <div className="text-xs text-gray-700 border-t border-gray-200 pt-2 space-y-1">
                  <div><span className="font-bold">Meaning:</span> {n.meaningEn}</div>
                  <div className="font-urdu"><span className="font-bold">معنی:</span> {n.meaningUr}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
