/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Universal Category Page & Reusable Block Template Engine
 */

import { db } from '../../src/server/db.ts';
import { CategoryBlockType, CategoryPageBlock, CategoryPageConfig } from '../../src/types/index.ts';

const SPECIALIZED_BLOCK_MAP: Record<string, { type: CategoryBlockType; titleEn: string; titleUr: string }> = {
  business: { type: 'live_rates_widget', titleEn: 'Gold, Currency & PSX Markets', titleUr: 'سونا، کرنسی اور اسٹاک ریٹس' },
  weather: { type: 'weather_aqi_widget', titleEn: 'City Weather & Smog AQI', titleUr: 'شہروں کا موسم اور اسموگ' },
  sports: { type: 'cricket_scoreboard_widget', titleEn: 'Live Cricket & PSL Scores', titleUr: 'لائیو کرکٹ اسکور' },
  islamic: { type: 'islamic_prayer_times_widget', titleEn: 'Daily Prayer Times & Hijri Digest', titleUr: 'اوقاتِ نماز اور اسلامی معلومات' },
  education: { type: 'education_board_results_widget', titleEn: 'BISE Boards & Result Lookup', titleUr: 'تعلیمی بورڈز اور رزلٹ سرچ' },
  mobiles: { type: 'mobiles_catalogue', titleEn: 'Mobile Phone Specs & Prices', titleUr: 'موبائل فونز کی قیمتیں' },
  automobiles: { type: 'vehicles_catalogue', titleEn: 'Cars & Bikes Prices Directory', titleUr: 'گاڑیوں اور بائیکس کی قیمتیں' },
  prizebonds: { type: 'prize_bond_draw_lookup', titleEn: 'Prize Bond Draw Search', titleUr: 'پرائز بانڈ قرعہ اندازی' },
  dictionary: { type: 'dictionary_lookup', titleEn: 'Urdu Dictionary & Islamic Names', titleUr: 'اردو لغت اور اسلامی نام' },
  poetry: { type: 'poetry_collection', titleEn: 'Urdu Poetry & Ghazals Archive', titleUr: 'اردو شاعری و غزلیات' },
  recipes: { type: 'recipe_collection', titleEn: 'Pakistani Cuisine Recipes', titleUr: 'پاکستانی لذیذ پکوان' },
  jobs: { type: 'jobs_listings', titleEn: 'Govt & Private Job Openings', titleUr: 'سرکاری و نجی ملازمتیں' },
  tools: { type: 'utility_calculators_grid', titleEn: 'Online Calculators & Utilities', titleUr: 'آن لائن کیلکولیٹرز' },
};

export class PageTemplateEngine {
  public static buildDefaultBlocks(slug: string, nameEn: string, nameUr: string): CategoryPageBlock[] {
    const blocks: CategoryPageBlock[] = [
      {
        id: `${slug}-hero`,
        type: 'category_hero',
        titleEn: `${nameEn} Hub`,
        titleUr: `${nameUr} پورٹل`,
        enabled: true,
        order: 1,
        width: 'full',
      },
    ];

    const specialized = SPECIALIZED_BLOCK_MAP[slug];
    if (specialized) {
      blocks.push({
        id: `${slug}-widget`,
        type: specialized.type,
        titleEn: specialized.titleEn,
        titleUr: specialized.titleUr,
        enabled: true,
        order: 2,
        width: 'full',
      });
    } else {
      blocks.push({
        id: `${slug}-featured`,
        type: 'featured_story',
        titleEn: `Featured ${nameEn} Report`,
        titleUr: `${nameUr} کی خاص رپورٹ`,
        enabled: true,
        order: 2,
        width: 'full',
      });
    }

    blocks.push(
      {
        id: `${slug}-grid`,
        type: 'news_grid',
        titleEn: `Latest ${nameEn} Stories`,
        titleUr: `${nameUr} کی تازہ خبریں`,
        enabled: true,
        order: 3,
        width: 'main',
        itemLimit: 9,
      },
      {
        id: `${slug}-ad`,
        type: 'ad_unit_slot',
        titleEn: 'Category Sponsorship Slot',
        titleUr: 'کیٹیگری اشتہار',
        enabled: true,
        order: 4,
        width: 'full',
        adSlotId: 'home_leaderboard',
      }
    );

    return blocks;
  }

  public static ensureAllCategoriesSeeded(): CategoryPageConfig[] {
    const existing = db.getCategoryPages();
    const categories = db.getData().categories || [];

    const extraSlugs = [
      { slug: 'politics', nameEn: 'Politics & Parliament', nameUr: 'سیاست و حکومت', descEn: 'Federal cabinet, Senate, and National Assembly coverage.', descUr: 'وفاقی کابینہ، سینیٹ اور قومی اسمبلی کی خبریں۔' },
      { slug: 'technology', nameEn: 'Technology & Telecom', nameUr: 'ٹیکنالوجی و ٹیلی کام', descEn: 'Pakistan IT exports, startups, PTA & telecom policy updates.', descUr: 'آئی ٹی ایکسپورٹس، اسٹارٹ اپس اور ٹیلی کام پالیسی۔' },
      { slug: 'world', nameEn: 'World Affairs', nameUr: 'عالمی خبریں', descEn: 'International diplomacy, Middle East & global economy.', descUr: 'بین الاقوامی سیاست، مشرق وسطیٰ اور عالمی معیشت۔' },
      { slug: 'entertainment', nameEn: 'Culture & Showbiz', nameUr: 'ثقافت و شوبز', descEn: 'Pakistani cinema, television dramas, and arts.', descUr: 'پاکستانی سینما، ڈرامے اور فنون لطیفہ۔' },
      { slug: 'health', nameEn: 'Health & Wellness', nameUr: 'صحت و تندرستی', descEn: 'Public health alerts, medical advisories & hospitals.', descUr: 'عوامی صحت، طبی مشورے اور ہسپتال اپ ڈیٹس۔' },
    ];

    const bySlug = new Map<string, CategoryPageConfig>();
    for (const c of existing) {
      bySlug.set(c.slug, c);
    }

    const baseUrl = 'https://360khabarnama.com';

    let changed = false;
    for (const cat of categories) {
      if (!bySlug.has(cat.slug)) {
        const blocks = this.buildDefaultBlocks(cat.slug, cat.nameEn, cat.nameUr);
        const page: CategoryPageConfig = {
          id: cat.id || `cat-${cat.slug}`,
          slug: cat.slug,
          nameEn: cat.nameEn,
          nameUr: cat.nameUr,
          descriptionEn: cat.descriptionEn,
          descriptionUr: cat.descriptionUr,
          iconName: cat.iconName || 'FolderOpen',
          enabled: cat.enabled ?? true,
          order: cat.order ?? bySlug.size + 1,
          showInNav: true,
          showInFooter: true,
          template: SPECIALIZED_BLOCK_MAP[cat.slug] ? 'utility_hybrid' : 'standard_news',
          seoTitleEn: `${cat.nameEn} | 360Khabarnama`,
          seoTitleUr: `${cat.nameUr} | 360 خبرنامہ`,
          metaDescEn: cat.descriptionEn,
          metaDescUr: cat.descriptionUr,
          canonicalUrl: `${baseUrl}/en/${cat.slug}`,
          robots: 'index, follow',
          status: 'published',
          blocks,
          draftBlocks: blocks,
          updatedAt: new Date().toISOString(),
          updatedBy: 'System Seed',
        };
        bySlug.set(cat.slug, page);
        changed = true;
      }
    }

    for (const ex of extraSlugs) {
      if (!bySlug.has(ex.slug)) {
        const blocks = this.buildDefaultBlocks(ex.slug, ex.nameEn, ex.nameUr);
        bySlug.set(ex.slug, {
          id: `cat-${ex.slug}`,
          slug: ex.slug,
          nameEn: ex.nameEn,
          nameUr: ex.nameUr,
          descriptionEn: ex.descEn,
          descriptionUr: ex.descUr,
          iconName: 'Newspaper',
          enabled: true,
          order: bySlug.size + 1,
          showInNav: ex.slug === 'politics',
          showInFooter: true,
          template: 'standard_news',
          seoTitleEn: `${ex.nameEn} | 360Khabarnama`,
          seoTitleUr: `${ex.nameUr} | 360 خبرنامہ`,
          metaDescEn: ex.descEn,
          metaDescUr: ex.descUr,
          canonicalUrl: `${baseUrl}/en/${ex.slug}`,
          robots: 'index, follow',
          status: 'published',
          blocks,
          draftBlocks: blocks,
          updatedAt: new Date().toISOString(),
          updatedBy: 'System Seed',
        });
        changed = true;
      }
    }

    const result = Array.from(bySlug.values()).sort((a, b) => a.order - b.order);
    if (changed) {
      db.setCategoryPages(result);
    }
    return result;
  }

  public static createCategory(
    input: {
      slug: string;
      nameEn: string;
      nameUr: string;
      descriptionEn?: string;
      descriptionUr?: string;
      template?: CategoryPageConfig['template'];
    },
    actor: string
  ): CategoryPageConfig {
    const cleanSlug = (input.slug || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-|-$/g, '');
    if (!cleanSlug || !input.nameEn?.trim() || !input.nameUr?.trim()) {
      throw new Error('Slug, English name, and Urdu name are required.');
    }
    const existing = this.ensureAllCategoriesSeeded();
    if (existing.some(c => c.slug === cleanSlug)) {
      throw new Error(`Category slug "${cleanSlug}" already exists.`);
    }

    const blocks = this.buildDefaultBlocks(cleanSlug, input.nameEn.trim(), input.nameUr.trim());
    const newPage: CategoryPageConfig = {
      id: `cat-${cleanSlug}-${Date.now()}`,
      slug: cleanSlug,
      nameEn: input.nameEn.trim(),
      nameUr: input.nameUr.trim(),
      descriptionEn: input.descriptionEn?.trim() || `${input.nameEn.trim()} news and updates on 360Khabarnama.`,
      descriptionUr: input.descriptionUr?.trim() || `${input.nameUr.trim()} کی تازہ خبریں اور اپ ڈیٹس۔`,
      iconName: 'Layers',
      enabled: true,
      order: existing.length + 1,
      showInNav: true,
      showInFooter: true,
      template: input.template || 'standard_news',
      seoTitleEn: `${input.nameEn.trim()} | 360Khabarnama`,
      seoTitleUr: `${input.nameUr.trim()} | 360 خبرنامہ`,
      metaDescEn: input.descriptionEn?.trim() || `${input.nameEn.trim()} coverage from Pakistan.`,
      metaDescUr: input.descriptionUr?.trim() || `${input.nameUr.trim()} کی خبریں اور معلومات۔`,
      canonicalUrl: `https://360khabarnama.com/en/${cleanSlug}`,
      robots: 'index, follow',
      status: 'draft',
      blocks,
      draftBlocks: blocks,
    };

    return db.upsertCategoryPage(newPage, actor, false);
  }
}
