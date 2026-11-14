/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Universal Category Page Manager & Block Builder
 */

import React, { useEffect, useState } from 'react';
import {
  Layers,
  Plus,
  Edit3,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  CheckCircle2,
  RotateCcw,
  X,
} from 'lucide-react';
import {
  CategoryBlockType,
  CategoryPageBlock,
  CategoryPageConfig,
  CategoryPageVersion,
} from '../../types/index.ts';

const AVAILABLE_BLOCK_TYPES: { type: CategoryBlockType; label: string }[] = [
  { type: 'category_hero', label: 'Category Hero Banner' },
  { type: 'featured_story', label: 'Featured Category Story' },
  { type: 'news_grid', label: 'News Articles Grid' },
  { type: 'news_list', label: 'Compact Headlines List' },
  { type: 'trending_sidebar', label: 'Trending Stories Sidebar' },
  { type: 'live_rates_widget', label: 'Gold, Currency & PSX Rates' },
  { type: 'weather_aqi_widget', label: 'Weather & Air Quality (AQI)' },
  { type: 'cricket_scoreboard_widget', label: 'Cricket Scores & Schedule' },
  { type: 'islamic_prayer_times_widget', label: 'Prayer Times & Hijri Digest' },
  { type: 'education_board_results_widget', label: 'BISE Boards & Results Search' },
  { type: 'mobiles_catalogue', label: 'Mobile Phones Catalogue' },
  { type: 'vehicles_catalogue', label: 'Cars & Bikes Directory' },
  { type: 'prize_bond_draw_lookup', label: 'Prize Bond Draw Lookup' },
  { type: 'dictionary_lookup', label: 'Dictionary & Names Lookup' },
  { type: 'poetry_collection', label: 'Urdu Poetry Collection' },
  { type: 'recipe_collection', label: 'Pakistani Recipes Collection' },
  { type: 'jobs_listings', label: 'Jobs Listings Feed' },
  { type: 'utility_calculators_grid', label: 'Utility Calculators Grid' },
  { type: 'ad_unit_slot', label: 'Advertisement Banner Slot' },
  { type: 'newsletter_signup_box', label: 'Newsletter Subscription Box' },
  { type: 'custom_editorial_banner', label: 'Custom Editorial Callout' },
];

const SLUG_TO_DATASET: Record<string, { dataset: string; label: string }> = {
  education: { dataset: 'boards', label: 'Education Boards' },
  mobiles: { dataset: 'mobiles', label: 'Mobile Devices' },
  automobiles: { dataset: 'automobiles', label: 'Cars & Bikes' },
  prizebonds: { dataset: 'prizeBonds', label: 'Prize Bond Draws' },
  dictionary: { dataset: 'dictionary', label: 'Dictionary Words' },
  poetry: { dataset: 'poems', label: 'Poems / Ghazals' },
  recipes: { dataset: 'recipes', label: 'Recipes' },
  jobs: { dataset: 'jobs', label: 'Job Listings' },
  sports: { dataset: 'cricketMatches', label: 'Cricket Matches' },
  weather: { dataset: 'weather', label: 'Weather Cities' },
};

export const CategoryPageManager: React.FC<{ onRefreshParent?: () => void }> = ({ onRefreshParent }) => {
  const [categories, setCategories] = useState<CategoryPageConfig[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>('pakistan');
  const [editing, setEditing] = useState<CategoryPageConfig | null>(null);
  const [editorTab, setEditorTab] = useState<'overview' | 'blocks' | 'seo' | 'records' | 'versions'>('overview');
  const [versions, setVersions] = useState<CategoryPageVersion[]>([]);
  const [datasetRecords, setDatasetRecords] = useState<any[]>([]);
  const [newJsonRecord, setNewJsonRecord] = useState('{}');
  const [banner, setBanner] = useState<string | null>(null);

  // New Custom Category modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newCat, setNewCat] = useState({ slug: '', nameEn: '', nameUr: '', descriptionEn: '', descriptionUr: '' });

  const loadCategories = async () => {
    const res = await fetch('/api/admin/categories', { credentials: 'include' });
    const d = await res.json();
    if (d.success) {
      setCategories(d.categories || []);
      const match = (d.categories || []).find((c: CategoryPageConfig) => c.slug === selectedSlug) || d.categories?.[0];
      if (match) {
        setEditing(JSON.parse(JSON.stringify(match)));
        setSelectedSlug(match.slug);
      }
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const selectCategory = async (cat: CategoryPageConfig) => {
    setSelectedSlug(cat.slug);
    setEditing(JSON.parse(JSON.stringify(cat)));
    const vRes = await fetch(`/api/admin/categories/${cat.slug}/versions`, { credentials: 'include' }).then(r => r.json());
    if (vRes.success) setVersions(vRes.versions || []);

    const ds = SLUG_TO_DATASET[cat.slug];
    if (ds) {
      const rRes = await fetch(`/api/admin/categories/dataset/${ds.dataset}`, { credentials: 'include' }).then(r => r.json());
      if (rRes.success) setDatasetRecords(rRes.records || []);
    } else {
      setDatasetRecords([]);
    }
  };

  const handleSaveCategory = async (publish: boolean) => {
    if (!editing) return;
    const payload: CategoryPageConfig = {
      ...editing,
      status: publish ? 'published' : 'draft',
      blocks: publish ? editing.draftBlocks || editing.blocks : editing.blocks,
    };
    const res = await fetch(`/api/admin/categories/${editing.slug}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await res.json();
    if (d.success) {
      setBanner(publish ? `Published category "${editing.nameEn}".` : `Saved draft for "${editing.nameEn}".`);
      await loadCategories();
      onRefreshParent?.();
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/categories/create', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCat),
    });
    const d = await res.json();
    if (d.success) {
      setCreateOpen(false);
      setNewCat({ slug: '', nameEn: '', nameUr: '', descriptionEn: '', descriptionUr: '' });
      setBanner(`Created new category /${d.category.slug}`);
      await loadCategories();
      selectCategory(d.category);
      onRefreshParent?.();
    } else {
      setBanner(d.error || 'Could not create category.');
    }
  };

  const handleDeleteCategory = async (slug: string) => {
    const res = await fetch(`/api/admin/categories/${slug}`, { method: 'DELETE', credentials: 'include' });
    const d = await res.json();
    if (d.success) {
      setBanner(`Deleted category /${slug}`);
      loadCategories();
      onRefreshParent?.();
    }
  };

  const moveBlock = (idx: number, dir: -1 | 1) => {
    if (!editing) return;
    const list = [...(editing.draftBlocks || editing.blocks)];
    const target = idx + dir;
    if (target < 0 || target >= list.length) return;
    const [item] = list.splice(idx, 1);
    list.splice(target, 0, item);
    setEditing({
      ...editing,
      draftBlocks: list.map((b, i) => ({ ...b, order: i + 1 })),
    });
  };

  const addBlock = (type: CategoryBlockType, label: string) => {
    if (!editing) return;
    const list = [...(editing.draftBlocks || editing.blocks)];
    const nb: CategoryPageBlock = {
      id: `blk-${type}-${Date.now()}`,
      type,
      titleEn: label,
      titleUr: label,
      enabled: true,
      order: list.length + 1,
      width: 'full',
    };
    setEditing({ ...editing, draftBlocks: [...list, nb] });
  };

  const handleSaveDatasetRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const ds = editing ? SLUG_TO_DATASET[editing.slug] : null;
    if (!ds) return;
    try {
      const parsed = JSON.parse(newJsonRecord);
      const res = await fetch(`/api/admin/categories/dataset/${ds.dataset}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      const d = await res.json();
      if (d.success) {
        setNewJsonRecord('{}');
        setBanner(`Saved record into ${ds.label}.`);
        selectCategory(editing!);
      }
    } catch {
      setBanner('Invalid JSON record syntax.');
    }
  };

  const handleDeleteDatasetRecord = async (id: string) => {
    const ds = editing ? SLUG_TO_DATASET[editing.slug] : null;
    if (!ds) return;
    await fetch(`/api/admin/categories/dataset/${ds.dataset}/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    selectCategory(editing!);
  };

  const blocks = editing ? editing.draftBlocks || editing.blocks : [];

  return (
    <div className="space-y-5 text-xs">
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-700" />
            <span>Universal Category Pages & Section Manager</span>
          </h2>
          <p className="text-gray-500">Manage layout blocks, navigation visibility, bilingual SEO & category datasets across all 19+ portal categories.</p>
        </div>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg inline-flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create Custom Category</span>
        </button>
      </div>

      {banner && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-center justify-between">
          <span>{banner}</span>
          <button onClick={() => setBanner(null)}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Category List Sidebar */}
        <div className="lg:col-span-4 bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-3 bg-gray-50 border-b border-gray-200 font-black text-gray-800">
            All Portal Categories ({categories.length})
          </div>
          <div className="divide-y divide-gray-100 max-h-[650px] overflow-y-auto">
            {categories.map(cat => (
              <div
                key={cat.slug}
                onClick={() => selectCategory(cat)}
                className={`p-3 cursor-pointer flex items-center justify-between gap-2 ${
                  selectedSlug === cat.slug ? 'bg-emerald-50 border-l-4 border-emerald-700' : 'hover:bg-gray-50'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-bold text-gray-900 truncate">{cat.nameEn}</div>
                  <div className="text-[11px] font-mono text-gray-500">/{cat.slug} • {cat.blocks?.length || 0} blocks</div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                    cat.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {cat.enabled ? 'Live' : 'Hidden'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Category Editor Workspace */}
        <div className="lg:col-span-8">
          {editing ? (
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
                <div>
                  <div className="text-[11px] font-mono text-emerald-700 font-bold">/{editing.slug}</div>
                  <h3 className="text-base font-black text-gray-900">{editing.nameEn} — {editing.nameUr}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveCategory(false)}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-lg inline-flex items-center gap-1"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Draft</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveCategory(true)}
                    className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg inline-flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Publish Page</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(editing.slug)}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                    title="Delete category"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Editor sub-tabs */}
              <div className="flex items-center gap-2 border-b border-gray-100 pb-2 overflow-x-auto">
                {[
                  { id: 'overview', label: 'Details & Nav' },
                  { id: 'blocks', label: `Page Blocks (${blocks.length})` },
                  { id: 'seo', label: 'Category SEO' },
                  ...(SLUG_TO_DATASET[editing.slug] ? [{ id: 'records', label: `${SLUG_TO_DATASET[editing.slug].label} Data` }] : []),
                  { id: 'versions', label: `History (${versions.length})` },
                ].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setEditorTab(t.id as any)}
                    className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap ${
                      editorTab === t.id ? 'bg-emerald-800 text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {editorTab === 'overview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Display Name (EN)</label>
                      <input
                        type="text"
                        value={editing.nameEn}
                        onChange={e => setEditing({ ...editing, nameEn: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Display Name (UR)</label>
                      <input
                        type="text"
                        dir="rtl"
                        value={editing.nameUr}
                        onChange={e => setEditing({ ...editing, nameUr: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg font-urdu"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Description (EN)</label>
                      <textarea
                        rows={2}
                        value={editing.descriptionEn}
                        onChange={e => setEditing({ ...editing, descriptionEn: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Description (UR)</label>
                      <textarea
                        rows={2}
                        dir="rtl"
                        value={editing.descriptionUr}
                        onChange={e => setEditing({ ...editing, descriptionUr: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg font-urdu"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <label className="flex items-center justify-between p-2.5 bg-gray-50 border rounded-lg">
                      <span className="font-bold">Enabled</span>
                      <input
                        type="checkbox"
                        checked={editing.enabled}
                        onChange={e => setEditing({ ...editing, enabled: e.target.checked })}
                      />
                    </label>
                    <label className="flex items-center justify-between p-2.5 bg-gray-50 border rounded-lg">
                      <span className="font-bold">Show in Header</span>
                      <input
                        type="checkbox"
                        checked={editing.showInNav}
                        onChange={e => setEditing({ ...editing, showInNav: e.target.checked })}
                      />
                    </label>
                    <label className="flex items-center justify-between p-2.5 bg-gray-50 border rounded-lg">
                      <span className="font-bold">Show in Footer</span>
                      <input
                        type="checkbox"
                        checked={editing.showInFooter}
                        onChange={e => setEditing({ ...editing, showInFooter: e.target.checked })}
                      />
                    </label>
                  </div>
                </div>
              )}

              {editorTab === 'blocks' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    {blocks.map((b, idx) => (
                      <div key={b.id} className="p-3 border border-gray-200 rounded-xl flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={b.titleEn}
                            onChange={e => {
                              const next = [...blocks];
                              next[idx] = { ...b, titleEn: e.target.value };
                              setEditing({ ...editing, draftBlocks: next });
                            }}
                            className="p-1.5 border border-gray-300 rounded font-semibold"
                          />
                          <div className="text-[11px] font-mono text-gray-500 flex items-center">{b.type}</div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button type="button" onClick={() => moveBlock(idx, -1)} className="p-1 text-gray-500 hover:text-gray-900"><ArrowUp className="w-3.5 h-3.5" /></button>
                          <button type="button" onClick={() => moveBlock(idx, 1)} className="p-1 text-gray-500 hover:text-gray-900"><ArrowDown className="w-3.5 h-3.5" /></button>
                          <input
                            type="checkbox"
                            checked={b.enabled}
                            onChange={e => {
                              const next = [...blocks];
                              next[idx] = { ...b, enabled: e.target.checked };
                              setEditing({ ...editing, draftBlocks: next });
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setEditing({ ...editing, draftBlocks: blocks.filter(x => x.id !== b.id) });
                            }}
                            className="p-1 text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1.5">Append New Page Block Module</label>
                    <select
                      onChange={e => {
                        const found = AVAILABLE_BLOCK_TYPES.find(bt => bt.type === e.target.value);
                        if (found) addBlock(found.type, found.label);
                        e.target.value = '';
                      }}
                      className="w-full p-2.5 border border-gray-300 rounded-lg bg-white"
                      defaultValue=""
                    >
                      <option value="" disabled>+ Select block type to append...</option>
                      {AVAILABLE_BLOCK_TYPES.map(bt => (
                        <option key={bt.type} value={bt.type}>{bt.label} ({bt.type})</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {editorTab === 'seo' && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">SEO Title (EN)</label>
                    <input
                      type="text"
                      value={editing.seoTitleEn || ''}
                      onChange={e => setEditing({ ...editing, seoTitleEn: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">SEO Title (UR)</label>
                    <input
                      type="text"
                      dir="rtl"
                      value={editing.seoTitleUr || ''}
                      onChange={e => setEditing({ ...editing, seoTitleUr: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg font-urdu"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Canonical URL</label>
                    <input
                      type="text"
                      value={editing.canonicalUrl || ''}
                      onChange={e => setEditing({ ...editing, canonicalUrl: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg font-mono"
                    />
                  </div>
                </div>
              )}

              {editorTab === 'records' && (
                <div className="space-y-4">
                  <form onSubmit={handleSaveDatasetRecord} className="space-y-2 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                    <div className="font-bold text-gray-800">Add / Update Record (JSON)</div>
                    <textarea
                      rows={3}
                      value={newJsonRecord}
                      onChange={e => setNewJsonRecord(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg font-mono text-[11px]"
                    />
                    <button type="submit" className="px-4 py-1.5 bg-emerald-700 text-white font-bold rounded-lg">
                      Save Record to Dataset
                    </button>
                  </form>

                  <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl max-h-72 overflow-y-auto">
                    {datasetRecords.map((rec, i) => {
                      const recId = rec.id || rec.cityId || `row-${i}`;
                      return (
                        <div key={recId} className="p-2.5 flex items-center justify-between gap-2">
                          <div className="font-mono text-[11px] truncate max-w-lg">
                            <span className="font-bold text-gray-900 mr-2">{rec.nameEn || rec.titleEn || rec.english || rec.code || recId}</span>
                            <span className="text-gray-500">{JSON.stringify(rec).slice(0, 120)}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteDatasetRecord(recId)}
                            className="text-rose-600 font-bold shrink-0"
                          >
                            Delete
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {editorTab === 'versions' && (
                <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl">
                  {versions.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">No historical checkpoints saved yet for /{editing.slug}.</div>
                  ) : (
                    versions.map(v => (
                      <div key={v.versionId} className="p-3 flex items-center justify-between">
                        <div>
                          <div className="font-bold">{v.savedBy} — {v.note}</div>
                          <div className="font-mono text-[11px] text-gray-500">{new Date(v.savedAt).toLocaleString()}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(JSON.parse(JSON.stringify(v.snapshot)));
                            setBanner(`Loaded snapshot ${v.versionId} into editor. Click Publish Page to restore live.`);
                          }}
                          className="px-3 py-1 bg-amber-100 text-amber-950 font-bold rounded-lg inline-flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Load Snapshot</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
              Select a category on the left to manage its layout, SEO, and datasets.
            </div>
          )}
        </div>
      </div>

      {/* Create Custom Category Modal */}
      {createOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateCategory} className="bg-white border border-gray-200 rounded-2xl max-w-md w-full p-6 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-black">Create Custom Category Page</h3>
              <button type="button" onClick={() => setCreateOpen(false)}><X className="w-4 h-4" /></button>
            </div>
            <input
              type="text"
              required
              placeholder="URL Slug (e.g. agriculture)"
              value={newCat.slug}
              onChange={e => setNewCat({ ...newCat, slug: e.target.value })}
              className="w-full p-2.5 border border-gray-300 rounded-lg font-mono"
            />
            <input
              type="text"
              required
              placeholder="Category Name (English)"
              value={newCat.nameEn}
              onChange={e => setNewCat({ ...newCat, nameEn: e.target.value })}
              className="w-full p-2.5 border border-gray-300 rounded-lg"
            />
            <input
              type="text"
              dir="rtl"
              required
              placeholder="کیٹیگری کا نام (اردو)"
              value={newCat.nameUr}
              onChange={e => setNewCat({ ...newCat, nameUr: e.target.value })}
              className="w-full p-2.5 border border-gray-300 rounded-lg font-urdu"
            />
            <textarea
              rows={2}
              placeholder="Short English description"
              value={newCat.descriptionEn}
              onChange={e => setNewCat({ ...newCat, descriptionEn: e.target.value })}
              className="w-full p-2.5 border border-gray-300 rounded-lg"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 bg-gray-100 rounded-lg font-bold">Cancel</button>
              <button type="submit" className="px-5 py-2 bg-emerald-700 text-white rounded-lg font-bold">Create Category</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
