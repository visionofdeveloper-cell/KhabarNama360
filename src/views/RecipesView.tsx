import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.tsx';
import { Recipe } from '../types/index.ts';
import { Utensils, Clock, Users, ChefHat, Check } from 'lucide-react';

export const RecipesView: React.FC = () => {
  const { isUrdu } = useLanguage();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [activeRecipeId, setActiveRecipeId] = useState<string>('rec-biryani');

  useEffect(() => {
    fetch('/api/recipes')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setRecipes(data.recipes);
        }
      })
      .catch(console.error);
  }, []);

  const currentRecipe = recipes.find(r => r.id === activeRecipeId) || recipes[0];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-950 via-emerald-950 to-teal-950 text-white rounded-3xl p-6 sm:p-10 shadow-xl">
        <div className="inline-flex items-center gap-2 bg-amber-400 text-gray-950 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
          <Utensils className="w-4 h-4" />
          <span>{isUrdu ? 'پاکستانی پکوان و روایتی ذائقے' : 'Authentic Pakistani Cuisine'}</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-black">
          {isUrdu ? 'کراچی بریانی، لاہوری کڑاہی، نہاری اور روایتی کھانوں کی آسان ترکیب' : 'Traditional Pakistani Recipes & Culinary Heritage'}
        </h1>
        <p className="text-amber-200 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
          {isUrdu
            ? 'مستند مصالحہ جات، پکانے کا دورانیہ اور باورچی خانے کے راز مرحلہ وار اردو اور انگریزی گائیڈ کے ساتھ'
            : 'Chef-tested cooking methods, authentic garam masala blends, and preparation times.'}
        </p>
      </div>

      {/* Recipe Selector Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {recipes.map((r) => (
          <div
            key={r.id}
            onClick={() => setActiveRecipeId(r.id)}
            className={`cursor-pointer p-4 rounded-3xl border flex items-center gap-4 transition-all ${
              r.id === activeRecipeId
                ? 'bg-emerald-50 border-emerald-500 shadow-md scale-101'
                : 'bg-white border-gray-200 hover:border-emerald-300'
            }`}
          >
            <img
              src={r.image}
              alt={r.titleEn}
              className="w-20 h-20 rounded-2xl object-cover shrink-0"
            />
            <div className="flex-1">
              <span className="text-[10px] font-bold text-emerald-800 uppercase">
                {isUrdu ? r.categoryUr : r.categoryEn}
              </span>
              <h3 className="font-bold text-sm text-gray-900 line-clamp-1 mt-0.5">
                {isUrdu ? r.titleUr : r.titleEn}
              </h3>
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {r.cookTimeMin} mins
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {r.servings} Servings
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Full Recipe Detail Card */}
      {currentRecipe && (
        <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-10 shadow-xs space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-7 space-y-3">
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full uppercase">
                {isUrdu ? currentRecipe.categoryUr : currentRecipe.categoryEn} • {currentRecipe.difficulty}
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900">
                {isUrdu ? currentRecipe.titleUr : currentRecipe.titleEn}
              </h2>
              <div className="flex items-center gap-6 text-xs text-gray-600 pt-2">
                <div className="flex items-center gap-1.5 font-semibold">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  <span>Cook Time: {currentRecipe.cookTimeMin} mins</span>
                </div>
                <div className="flex items-center gap-1.5 font-semibold">
                  <Users className="w-4 h-4 text-emerald-600" />
                  <span>Servings: {currentRecipe.servings} Persons</span>
                </div>
              </div>
            </div>

            <div className="md:col-span-5 aspect-4/3 rounded-3xl overflow-hidden shadow-lg bg-gray-100">
              <img
                src={currentRecipe.image}
                alt={currentRecipe.titleEn}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Ingredients & Steps Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 border-t border-gray-100 pt-8">
            {/* Ingredients (5 Cols) */}
            <div className="lg:col-span-5 bg-amber-50/50 border border-amber-200/60 p-6 rounded-3xl space-y-4">
              <h3 className="font-black text-sm uppercase tracking-wider text-gray-900 flex items-center gap-2">
                <ChefHat className="w-4 h-4 text-amber-600" />
                <span>{isUrdu ? 'ضروری اجزاء (اجزائے ترکیبی)' : 'Required Ingredients'}</span>
              </h3>
              <ul className="space-y-2.5 text-xs text-gray-800 font-urdu">
                {(isUrdu ? currentRecipe.ingredientsUr : currentRecipe.ingredientsEn).map((ing, i) => (
                  <li key={i} className="flex items-start gap-2.5 leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0 mt-2"></span>
                    <span>{ing}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Preparation Steps (7 Cols) */}
            <div className="lg:col-span-7 space-y-4">
              <h3 className="font-black text-sm uppercase tracking-wider text-gray-900">
                {isUrdu ? 'تیاری کا مرحلہ وار طریقہ' : 'Step-by-Step Instructions'}
              </h3>
              <div className="space-y-4">
                {(isUrdu ? currentRecipe.instructionsUr : currentRecipe.instructionsEn).map((step, idx) => (
                  <div key={idx} className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100">
                    <div className="w-7 h-7 rounded-xl bg-emerald-700 text-white font-black text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </div>
                    <p className="text-xs text-gray-800 leading-relaxed font-urdu">
                      {step}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
