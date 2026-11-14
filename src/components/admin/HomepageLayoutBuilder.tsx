/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Enterprise Homepage Layout Builder (Draft, Publish, Drag/Drop & Rollback)
 */

import React, { useEffect, useState } from 'react';
import {
  Layout,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  CheckCircle2,
  RotateCcw,
  Eye,
  Blocks,
  GripVertical,
  X,
} from 'lucide-react';
import {
  CustomReusableBlock,
  HomepageLayoutConfig,
  HomepageSectionItem,
  HomepageSectionType,
  HomepageVersionSnapshot,
} from '../../types/index.ts';

interface HomepageLayoutBuilderProps {
  categories: { slug: string; nameEn: string }[];
  onRefreshParent?: () => void;
}

const SECTION_PRESETS: { type: HomepageSectionType; label: string; nameEn: string; nameUr: string }[] = [
  { type: 'live_widgets_bar', label: 'Live Cricket / Gold / Weather Strip', nameEn: 'Live Market & Cricket Bar', nameUr: 'لائیو کرکٹ، سونا اور موسم' },
  { type: 'hero_editorial_grid', label: 'Hero Lead Story + Trending Sidebar', nameEn: 'Top Editorial Hero & Trending', nameUr: 'اہم خبریں اور مقبول ترین' },
  { type: 'category_news_grid', label: 'Category News Block', nameEn: 'Category Spotlight', nameUr: 'منتخب کیٹیگری کی خبریں' },
  { type: 'ad_banner', label: 'Advertising Slot Banner', nameEn: 'Sponsored Leaderboard', nameUr: 'اشتہاری بینر' },
  { type: 'islamic_prayer_digest', label: 'Islamic Prayer Times & Hadith Digest', nameEn: 'Daily Islamic Digest', nameUr: 'اوقاتِ نماز اور اسلامی معلومات' },
  { type: 'utilities_grid', label: 'Citizen Calculators & Tools Grid', nameEn: 'Digital Citizen Tools', nameUr: 'آن لائن شہری سہولیات' },
  { type: 'newsletter_box', label: 'Newsletter Subscription Callout', nameEn: 'Morning Briefing Signup', nameUr: 'روزانہ ای میل بلیٹن' },
  { type: 'custom_block', label: 'Custom Reusable Promo / Editorial Block', nameEn: 'Custom Editorial Block', nameUr: 'خصوصی ایڈیٹوریل بلاک' },
];

export const HomepageLayoutBuilder: React.FC<HomepageLayoutBuilderProps> = ({ categories, onRefreshParent }) => {
  const [subTab, setSubTab] = useState<'builder' | 'blocks' | 'versions' | 'preview'>('builder');
  const [draft, setDraft] = useState<HomepageLayoutConfig>({ sections: [] });
  const [versions, setVersions] = useState<HomepageVersionSnapshot[]>([]);
  const [customBlocks, setCustomBlocks] = useState<CustomReusableBlock[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reusable custom block editor state
  const [editingBlock, setEditingBlock] = useState<CustomReusableBlock | null>(null);

  const loadAll = async () => {
    const [hpRes, blkRes] = await Promise.all([
      fetch('/api/admin/homepage/state', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/admin/homepage/custom-blocks', { credentials: 'include' }).then(r => r.json()),
    ]);
    if (hpRes.success) {
      const sections = [...(hpRes.draft?.sections || hpRes.published?.sections || [])].sort(
        (a, b) => a.order - b.order
      );
      setDraft({ ...(hpRes.draft || hpRes.published), sections });
      setVersions(hpRes.versions || []);
      if (sections.length > 0 && !selectedSectionId) setSelectedSectionId(sections[0].id);
    }
    if (blkRes.success) {
      setCustomBlocks(blkRes.blocks || []);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const resequence = (list: HomepageSectionItem[]) =>
    list.map((s, idx) => ({ ...s, order: idx + 1 }));

  const moveSection = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= draft.sections.length) return;
    const copy = [...draft.sections];
    const [item] = copy.splice(index, 1);
    copy.splice(target, 0, item);
    setDraft({ ...draft, sections: resequence(copy) });
  };

  const handleDropOnIndex = (dropIdx: number) => {
    if (dragIndex === null || dragIndex === dropIdx) return;
    const copy = [...draft.sections];
    const [dragged] = copy.splice(dragIndex, 1);
    copy.splice(dropIdx, 0, dragged);
    setDragIndex(null);
    setDraft({ ...draft, sections: resequence(copy) });
  };

  const addSection = (preset: typeof SECTION_PRESETS[number]) => {
    const newSec: HomepageSectionItem = {
      id: `sec-${preset.type}-${Date.now()}`,
      type: preset.type,
      nameEn: preset.nameEn,
      nameUr: preset.nameUr,
      enabled: true,
      order: draft.sections.length + 1,
      mobileOrder: draft.sections.length + 1,
      width: 'contained',
      template: preset.type === 'hero_editorial_grid' ? 'lead-plus-list' : 'grid',
      categorySlug: categories[0]?.slug || 'pakistan',
      articleSource: preset.type === 'hero_editorial_grid' ? 'featured' : 'category',
      itemLimit: 6,
      displayMode: 'current_lang',
      adSlot: preset.type === 'ad_banner' ? 'leaderboard' : undefined,
    };
    setDraft({ ...draft, sections: [...draft.sections, newSec] });
    setSelectedSectionId(newSec.id);
  };

  const updateSelected = (updates: Partial<HomepageSectionItem>) => {
    if (!selectedSectionId) return;
    setDraft({
      ...draft,
      sections: draft.sections.map(s => (s.id === selectedSectionId ? { ...s, ...updates } : s)),
    });
  };

  const deleteSection = (id: string) => {
    const next = resequence(draft.sections.filter(s => s.id !== id));
    setDraft({ ...draft, sections: next });
    if (selectedSectionId === id) setSelectedSectionId(next[0]?.id || null);
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/homepage/draft', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const d = await res.json();
      if (d.success) setBanner('Homepage draft saved (not yet visible to public readers until Published).');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/homepage/publish', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const d = await res.json();
      if (d.success) {
        setBanner('Homepage layout published live across /en and /ur!');
        loadAll();
        onRefreshParent?.();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRollback = async (versionId: string) => {
    const res = await fetch('/api/admin/homepage/rollback', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ versionId }),
    });
    const d = await res.json();
    if (d.success) {
      setBanner(`Rolled back and published homepage snapshot ${versionId}.`);
      loadAll();
    }
  };

  const handleSaveCustomBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBlock) return;
    const res = await fetch('/api/admin/homepage/custom-blocks', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingBlock),
    });
    const d = await res.json();
    if (d.success) {
      setEditingBlock(null);
      setBanner('Custom reusable block saved.');
      loadAll();
    }
  };

  const handleDeleteCustomBlock = async (id: string) => {
    await fetch(`/api/admin/homepage/custom-blocks/${id}`, { method: 'DELETE', credentials: 'include' });
    loadAll();
  };

  const selected = draft.sections.find(s => s.id === selectedSectionId) || null;

  return (
    <div className="space-y-5">
      {/* Top Action Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
            <Layout className="w-4 h-4 text-emerald-700" />
            <span>Homepage Layout & Section Builder</span>
          </h2>
          <p className="text-xs text-gray-500">Drag sections to reorder, configure category feeds, save drafts, preview, and publish with version rollback.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={saving}
            className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-lg inline-flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Draft</span>
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={saving}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Publish Homepage</span>
          </button>
        </div>
      </div>

      {banner && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center justify-between">
          <span>{banner}</span>
          <button onClick={() => setBanner(null)} className="text-emerald-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
        {[
          { id: 'builder', label: `Layout Sections (${draft.sections.length})`, icon: Layout },
          { id: 'blocks', label: `Reusable Custom Blocks (${customBlocks.length})`, icon: Blocks },
          { id: 'preview', label: 'Structural Preview', icon: Eye },
          { id: 'versions', label: `Version Rollback (${versions.length})`, icon: RotateCcw },
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id as any)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${
                subTab === t.id ? 'bg-emerald-800 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: SECTION BUILDER */}
      {subTab === 'builder' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Ordered Section Stack */}
          <div className="lg:col-span-7 space-y-3">
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <span className="text-xs font-black text-gray-900 uppercase tracking-wider">Homepage Vertical Stack</span>
                <span className="text-[11px] text-gray-500">Drag row or use arrows</span>
              </div>

              {draft.sections.map((sec, idx) => (
                <div
                  key={sec.id}
                  draggable
                  onDragStart={() => setDragIndex(idx)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => handleDropOnIndex(idx)}
                  onClick={() => setSelectedSectionId(sec.id)}
                  className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between gap-3 transition-colors ${
                    selectedSectionId === sec.id
                      ? 'border-emerald-600 bg-emerald-50/40'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  } ${!sec.enabled ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <GripVertical className="w-4 h-4 text-gray-400 shrink-0 cursor-grab" />
                    <span className="w-6 h-6 rounded bg-gray-100 text-gray-700 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-gray-900 truncate">{sec.nameEn}</div>
                      <div className="text-[11px] text-gray-500 font-mono">
                        {sec.type} {sec.categorySlug ? `• /${sec.categorySlug}` : ''} {sec.itemLimit ? `• ${sec.itemLimit} items` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => moveSection(idx, -1)}
                      disabled={idx === 0}
                      className="p-1 text-gray-500 hover:text-gray-900 disabled:opacity-30"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSection(idx, 1)}
                      disabled={idx === draft.sections.length - 1}
                      className="p-1 text-gray-500 hover:text-gray-900 disabled:opacity-30"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="checkbox"
                      checked={sec.enabled}
                      onChange={() =>
                        setDraft({
                          ...draft,
                          sections: draft.sections.map(s => (s.id === sec.id ? { ...s, enabled: !s.enabled } : s)),
                        })
                      }
                      title="Enable/Disable section"
                    />
                    <button
                      type="button"
                      onClick={() => deleteSection(sec.id)}
                      className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Section Buttons */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2.5">
              <div className="text-xs font-black text-gray-900">Add Section Module to Homepage</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SECTION_PRESETS.map(p => (
                  <button
                    key={p.type}
                    type="button"
                    onClick={() => addSection(p)}
                    className="p-2.5 text-left border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/40 rounded-lg text-xs flex items-center gap-2"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span className="font-semibold text-gray-800">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Selected Section Inspector */}
          <div className="lg:col-span-5">
            {selected ? (
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3.5 text-xs sticky top-20">
                <div className="border-b border-gray-100 pb-2.5">
                  <div className="text-[10px] font-mono uppercase text-emerald-700 font-bold">{selected.type}</div>
                  <h3 className="text-sm font-black text-gray-900">Configure Section Settings</h3>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Heading (English)</label>
                  <input
                    type="text"
                    value={selected.nameEn}
                    onChange={e => updateSelected({ nameEn: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Heading (Urdu)</label>
                  <input
                    type="text"
                    dir="rtl"
                    value={selected.nameUr}
                    onChange={e => updateSelected({ nameUr: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg font-urdu"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Container Width</label>
                    <select
                      value={selected.width || 'contained'}
                      onChange={e => updateSelected({ width: e.target.value as any })}
                      className="w-full p-2 border border-gray-300 rounded-lg bg-white"
                    >
                      <option value="contained">Contained (max-w-7xl)</option>
                      <option value="full">Full Bleed</option>
                      <option value="2-col">2-Column Split</option>
                      <option value="3-col">3-Column Grid</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Mobile Priority Order</label>
                    <input
                      type="number"
                      min={1}
                      value={selected.mobileOrder ?? selected.order}
                      onChange={e => updateSelected({ mobileOrder: parseInt(e.target.value) || 1 })}
                      className="w-full p-2 border border-gray-300 rounded-lg font-mono"
                    />
                  </div>
                </div>

                {selected.type === 'category_news_grid' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Category Source</label>
                      <select
                        value={selected.categorySlug || 'pakistan'}
                        onChange={e => updateSelected({ categorySlug: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg bg-white"
                      >
                        {categories.map(c => (
                          <option key={c.slug} value={c.slug}>{c.nameEn}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Article Count</label>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={selected.itemLimit || 6}
                        onChange={e => updateSelected({ itemLimit: parseInt(e.target.value) || 6 })}
                        className="w-full p-2 border border-gray-300 rounded-lg font-mono"
                      />
                    </div>
                  </div>
                )}

                {selected.type === 'custom_block' && (
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Attach Reusable Block</label>
                    <select
                      value={selected.customBlockId || ''}
                      onChange={e => updateSelected({ customBlockId: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg bg-white"
                    >
                      <option value="">-- Select Custom Block --</option>
                      {customBlocks.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {selected.type === 'ad_banner' && (
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Ad Placement Slot</label>
                    <input
                      type="text"
                      value={selected.adSlot || 'leaderboard'}
                      onChange={e => updateSelected({ adSlot: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg font-mono"
                    />
                  </div>
                )}

                <label className="flex items-center justify-between p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                  <span className="font-bold text-gray-800">Section Active & Visible</span>
                  <input
                    type="checkbox"
                    checked={selected.enabled}
                    onChange={e => updateSelected({ enabled: e.target.checked })}
                  />
                </label>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-xs text-gray-500">
                Select a homepage section on the left to configure its settings.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: REUSABLE CUSTOM BLOCKS */}
      {subTab === 'blocks' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() =>
                setEditingBlock({
                  id: '',
                  name: '',
                  titleEn: '',
                  titleUr: '',
                  bodyEn: '',
                  bodyUr: '',
                  ctaLabelEn: 'Explore More',
                  ctaLabelUr: 'مزید دیکھیں',
                  ctaUrl: '/en',
                  theme: 'emerald',
                  updatedAt: new Date().toISOString(),
                })
              }
              className="px-4 py-2 bg-emerald-700 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Reusable Block</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customBlocks.map(b => (
              <div key={b.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-black text-gray-900">{b.name}</span>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingBlock(b)} className="text-emerald-700 font-bold">Edit</button>
                    <button onClick={() => handleDeleteCustomBlock(b.id)} className="text-rose-600 font-bold">Delete</button>
                  </div>
                </div>
                <div className="font-bold text-gray-800">{b.titleEn}</div>
                <div className="font-urdu text-gray-700" dir="rtl">{b.titleUr}</div>
                <p className="text-gray-500 line-clamp-2">{b.bodyEn}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: PREVIEW */}
      {subTab === 'preview' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
          <div className="text-xs font-bold text-gray-500 uppercase">Wireframe Preview of Active Sections</div>
          {draft.sections
            .filter(s => s.enabled)
            .map((s, i) => (
              <div key={s.id} className="p-4 rounded-xl border border-dashed border-emerald-400 bg-emerald-50/30 flex items-center justify-between text-xs">
                <div>
                  <span className="font-mono text-emerald-700 font-bold mr-2">#{i + 1}</span>
                  <span className="font-black text-gray-900">{s.nameEn}</span>
                  <span className="mx-2 text-gray-400">|</span>
                  <span className="font-urdu text-gray-800">{s.nameUr}</span>
                </div>
                <span className="font-mono text-[11px] text-gray-500">{s.type}</span>
              </div>
            ))}
        </div>
      )}

      {/* TAB 4: VERSION HISTORY ROLLBACK */}
      {subTab === 'versions' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 border-b border-gray-200 font-bold text-gray-600">
              <tr>
                <th className="p-3">Snapshot ID</th>
                <th className="p-3">Published / Saved At</th>
                <th className="p-3">Actor & Note</th>
                <th className="p-3">Sections</th>
                <th className="p-3 text-right">Rollback</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {versions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-500">Publish homepage updates to create rollback snapshots.</td>
                </tr>
              ) : (
                versions.map(v => (
                  <tr key={v.versionId}>
                    <td className="p-3 font-mono text-[11px]">{v.versionId}</td>
                    <td className="p-3 font-mono text-[11px] text-gray-500">{new Date(v.savedAt).toLocaleString()}</td>
                    <td className="p-3">
                      <span className="font-bold">{v.savedBy}</span> — {v.note}
                    </td>
                    <td className="p-3 font-mono">{v.config.sections?.length || 0}</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleRollback(v.versionId)}
                        className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold rounded text-[11px] inline-flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Restore & Publish</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Custom Block Modal */}
      {editingBlock && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveCustomBlock} className="bg-white border border-gray-200 rounded-2xl max-w-lg w-full p-6 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-black">Save Custom Reusable Block</h3>
              <button type="button" onClick={() => setEditingBlock(null)}><X className="w-4 h-4" /></button>
            </div>
            <input
              type="text"
              required
              placeholder="Internal Name"
              value={editingBlock.name}
              onChange={e => setEditingBlock({ ...editingBlock, name: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-lg"
            />
            <input
              type="text"
              required
              placeholder="Public Title (EN)"
              value={editingBlock.titleEn}
              onChange={e => setEditingBlock({ ...editingBlock, titleEn: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-lg"
            />
            <input
              type="text"
              dir="rtl"
              required
              placeholder="عنوان (اردو)"
              value={editingBlock.titleUr}
              onChange={e => setEditingBlock({ ...editingBlock, titleUr: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-lg font-urdu"
            />
            <textarea
              rows={2}
              placeholder="Body Copy (EN)"
              value={editingBlock.bodyEn}
              onChange={e => setEditingBlock({ ...editingBlock, bodyEn: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-lg"
            />
            <textarea
              rows={2}
              dir="rtl"
              placeholder="اردو تفصیل"
              value={editingBlock.bodyUr}
              onChange={e => setEditingBlock({ ...editingBlock, bodyUr: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-lg font-urdu"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="CTA Label"
                value={editingBlock.ctaLabelEn || ''}
                onChange={e => setEditingBlock({ ...editingBlock, ctaLabelEn: e.target.value })}
                className="p-2 border border-gray-300 rounded-lg"
              />
              <input
                type="text"
                placeholder="CTA URL (/en/education)"
                value={editingBlock.ctaUrl || ''}
                onChange={e => setEditingBlock({ ...editingBlock, ctaUrl: e.target.value })}
                className="p-2 border border-gray-300 rounded-lg font-mono"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingBlock(null)} className="px-4 py-2 bg-gray-100 rounded-lg font-bold">Cancel</button>
              <button type="submit" className="px-5 py-2 bg-emerald-700 text-white rounded-lg font-bold">Save Block</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
