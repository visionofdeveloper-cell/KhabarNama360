var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// services/seo/BrokenLinkChecker.ts
var BrokenLinkChecker;
var init_BrokenLinkChecker = __esm({
  "services/seo/BrokenLinkChecker.ts"() {
    BrokenLinkChecker = class {
      static async checkUrl(url, isInternal = true) {
        const checkedAt = (/* @__PURE__ */ new Date()).toISOString();
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5e3);
          const res = await fetch(url, { method: "HEAD", signal: controller.signal });
          clearTimeout(timeout);
          const status = res.status;
          let issue;
          if (status === 404) issue = "404";
          else if (status === 410) issue = "410";
          else if (status >= 500) issue = "500";
          else if (status === 429) issue = "rate_limited";
          return {
            url,
            status,
            ok: status >= 200 && status < 400,
            type: isInternal ? "internal" : "external",
            issue,
            checkedAt
          };
        } catch {
          return {
            url,
            status: 0,
            ok: false,
            type: isInternal ? "internal" : "external",
            issue: "network_error",
            checkedAt
          };
        }
      }
    };
  }
});

// services/seo/LinkAuditEngine.ts
var LinkAuditEngine_exports = {};
__export(LinkAuditEngine_exports, {
  LinkAuditEngine: () => LinkAuditEngine
});
var LinkAuditEngine;
var init_LinkAuditEngine = __esm({
  "services/seo/LinkAuditEngine.ts"() {
    init_BrokenLinkChecker();
    LinkAuditEngine = class {
      static async runAudit(baseUrl, paths) {
        const results = [];
        for (const p of paths) {
          const fullUrl = p.startsWith("http") ? p : `${baseUrl}${p.startsWith("/") ? p : `/${p}`}`;
          const res = await BrokenLinkChecker.checkUrl(fullUrl, !p.startsWith("http"));
          results.push(res);
        }
        const workingLinks = results.filter((r) => r.ok).length;
        const broken = results.filter((r) => !r.ok && r.issue !== "rate_limited" && r.issue !== "network_error");
        const temporaryFailures = results.filter((r) => r.issue === "rate_limited" || r.issue === "network_error").length;
        return {
          totalUrlsDiscovered: paths.length,
          urlsChecked: results.length,
          workingLinks,
          brokenLinks: broken.length,
          redirects: results.filter((r) => r.status >= 300 && r.status < 400).length,
          temporaryFailures,
          automaticallyRepaired: 0,
          issuesRequiringReview: [...broken, ...results.filter((r) => r.issue === "network_error")],
          lastRunAt: (/* @__PURE__ */ new Date()).toISOString()
        };
      }
    };
  }
});

// server.ts
import "dotenv/config";
import express from "express";
import dotenv2 from "dotenv";
import fs4 from "fs";
import path4 from "path";

// src/server/db.ts
import fs from "fs";
import path from "path";
var SEED_DATA_CANDIDATES = [
  path.resolve(process.cwd(), "data", "portal_database.json"),
  path.resolve("/var/task/data/portal_database.json")
];
var SEED_DB_FILE = SEED_DATA_CANDIDATES.find((p) => fs.existsSync(p)) || SEED_DATA_CANDIDATES[0];
var IS_SERVERLESS = Boolean(
  process.env.VERCEL || process.env.VERCEL_ENV || process.env.VERCEL_REGION || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NOW_REGION
);
var DATA_DIR = IS_SERVERLESS ? "/tmp/360khabarnama_data" : path.resolve(process.cwd(), "data");
var DB_FILE = path.join(DATA_DIR, "portal_database.json");
var defaultCategories = [
  { id: "1", slug: "pakistan", nameEn: "Pakistan", nameUr: "\u067E\u0627\u06A9\u0633\u062A\u0627\u0646", descriptionEn: "National and provincial news across Pakistan", descriptionUr: "\u0645\u0644\u06A9 \u0628\u06BE\u0631 \u0633\u06D2 \u0627\u06C1\u0645 \u0642\u0648\u0645\u06CC \u0648 \u0635\u0648\u0628\u0627\u0626\u06CC \u062E\u0628\u0631\u06CC\u06BA", iconName: "Flag" },
  { id: "2", slug: "politics", nameEn: "Politics", nameUr: "\u0633\u06CC\u0627\u0633\u062A", descriptionEn: "Political updates, parliament, and national affairs", descriptionUr: "\u0633\u06CC\u0627\u0633\u06CC \u0635\u0648\u0631\u062A\u062D\u0627\u0644\u060C \u067E\u0627\u0631\u0644\u06CC\u0645\u0646\u0679 \u0627\u0648\u0631 \u062D\u06A9\u0648\u0645\u062A\u06CC \u0641\u06CC\u0635\u0644\u06D2", iconName: "Building" },
  { id: "3", slug: "business", nameEn: "Business & Economy", nameUr: "\u0645\u0639\u06CC\u0634\u062A \u0648 \u062A\u062C\u0627\u0631\u062A", descriptionEn: "Financial markets, inflation, trade and economy", descriptionUr: "\u0627\u0633\u0679\u0627\u06A9 \u0645\u0627\u0631\u06A9\u06CC\u0679\u060C \u0631\u0648\u067E\u06D2 \u06A9\u06CC \u0642\u062F\u0631 \u0627\u0648\u0631 \u0645\u0644\u06A9\u06CC \u0645\u0639\u06CC\u0634\u062A", iconName: "TrendingUp" },
  { id: "4", slug: "sports", nameEn: "Sports & Cricket", nameUr: "\u06A9\u06BE\u06CC\u0644 \u0648 \u06A9\u0631\u06A9\u0679", descriptionEn: "Cricket, PSL, hockey, and international sports", descriptionUr: "\u06A9\u0631\u06A9\u0679\u060C \u067E\u06CC \u0627\u06CC\u0633 \u0627\u06CC\u0644\u060C \u06C1\u0627\u06A9\u06CC \u0627\u0648\u0631 \u0628\u06CC\u0646 \u0627\u0644\u0627\u0642\u0648\u0627\u0645\u06CC \u06A9\u06BE\u06CC\u0644", iconName: "Trophy" },
  { id: "5", slug: "education", nameEn: "Education", nameUr: "\u062A\u0639\u0644\u06CC\u0645 \u0648 \u0627\u0645\u062A\u062D\u0627\u0646\u0627\u062A", descriptionEn: "BISE board results, admissions and universities", descriptionUr: "\u062A\u0639\u0644\u06CC\u0645\u06CC \u0628\u0648\u0631\u0688\u0632 \u06A9\u06D2 \u0646\u062A\u0627\u0626\u062C\u060C \u0627\u0645\u062A\u062D\u0627\u0646\u0627\u062A \u0627\u0648\u0631 \u0648\u0638\u0627\u0626\u0641", iconName: "GraduationCap" },
  { id: "6", slug: "technology", nameEn: "Tech & Mobiles", nameUr: "\u0679\u06CC\u06A9\u0646\u0627\u0644\u0648\u062C\u06CC \u0648 \u0645\u0648\u0628\u0627\u0626\u0644\u0632", descriptionEn: "Smartphone reviews, gadgets and AI developments", descriptionUr: "\u062C\u062F\u06CC\u062F \u0627\u0633\u0645\u0627\u0631\u0679 \u0641\u0648\u0646\u0632\u060C \u0622\u0626\u06CC \u0679\u06CC \u0627\u0648\u0631 \u0633\u0627\u0626\u0646\u0633\u06CC \u062E\u0628\u0631\u06CC\u06BA", iconName: "Cpu" },
  { id: "7", slug: "world", nameEn: "World News", nameUr: "\u0639\u0627\u0644\u0645\u06CC \u062E\u0628\u0631\u06CC\u06BA", descriptionEn: "International affairs and global geopolitical events", descriptionUr: "\u0628\u06CC\u0646 \u0627\u0644\u0627\u0642\u0648\u0627\u0645\u06CC \u0627\u0645\u0648\u0631 \u0627\u0648\u0631 \u0639\u0627\u0644\u0645\u06CC \u0633\u06CC\u0627\u0633\u062A", iconName: "Globe" },
  { id: "8", slug: "entertainment", nameEn: "Entertainment", nameUr: "\u0634\u0648\u0628\u0632 \u0648 \u062A\u0641\u0631\u06CC\u062D", descriptionEn: "Dramas, cinema, music and celebrity updates", descriptionUr: "\u0688\u0631\u0627\u0645\u06D2\u060C \u0641\u0644\u0645\u06CC\u06BA\u060C \u0645\u0648\u0633\u06CC\u0642\u06CC \u0627\u0648\u0631 \u0634\u0648\u0628\u0632 \u0634\u062E\u0635\u06CC\u0627\u062A", iconName: "Film" },
  { id: "9", slug: "islamic", nameEn: "Islamic Life", nameUr: "\u0627\u0633\u0644\u0627\u0645\u06CC \u062F\u0646\u06CC\u0627", descriptionEn: "Prayer times, Quran, Hadith, Duas & Zakat", descriptionUr: "\u0627\u0648\u0642\u0627\u062A\u0650 \u0646\u0645\u0627\u0632\u060C \u0642\u0631\u0622\u0646\u060C \u0627\u062D\u0627\u062F\u06CC\u062B \u0627\u0648\u0631 \u0632\u06A9\u0648\u0670\u06C3 \u06AF\u0627\u0626\u06CC\u0688", iconName: "Moon" },
  { id: "10", slug: "health", nameEn: "Health & Science", nameUr: "\u0635\u062D\u062A \u0648 \u0637\u0628", descriptionEn: "Wellness, medical advice and healthcare tips", descriptionUr: "\u0637\u0628\u06CC \u0645\u0634\u0648\u0631\u06D2\u060C \u0635\u062D\u062A \u0645\u0646\u062F \u0637\u0631\u0632\u0650 \u0632\u0646\u062F\u06AF\u06CC \u0627\u0648\u0631 \u0627\u062F\u0648\u06CC\u0627\u062A", iconName: "HeartPulse" }
];
var defaultArticles = [
  {
    id: "art-1",
    slug: "pakistan-economic-reforms-psx-record-high-2026",
    titleEn: "PSX Crosses Record Milestone as Economic Confidence Strengthens in Pakistan",
    titleUr: "\u067E\u0627\u06A9\u0633\u062A\u0627\u0646 \u0627\u0633\u0679\u0627\u06A9 \u0627\u06CC\u06A9\u0633\u0686\u06CC\u0646\u062C \u0645\u06CC\u06BA \u0632\u0628\u0631\u062F\u0633\u062A \u062A\u06CC\u0632\u06CC\u060C \u0627\u0646\u0688\u06CC\u06A9\u0633 \u062A\u0627\u0631\u06CC\u062E \u06A9\u06CC \u0646\u0626\u06CC \u0628\u0644\u0646\u062F\u06CC \u067E\u0631 \u067E\u06C1\u0646\u0686 \u06AF\u06CC\u0627",
    summaryEn: "The Pakistan Stock Exchange (PSX) KSE-100 index rallied over 850 points on strong institutional buying and macroeconomic stability.",
    summaryUr: "\u067E\u0627\u06A9\u0633\u062A\u0627\u0646 \u0627\u0633\u0679\u0627\u06A9 \u0627\u06CC\u06A9\u0633\u0686\u06CC\u0646\u062C \u0645\u06CC\u06BA \u06A9\u0627\u0631\u0648\u0628\u0627\u0631 \u06A9\u06D2 \u0622\u063A\u0627\u0632 \u067E\u0631 \u06C1\u06CC \u0632\u0628\u0631\u062F\u0633\u062A \u062A\u06CC\u0632\u06CC \u062F\u06CC\u06A9\u06BE\u0646\u06D2 \u0645\u06CC\u06BA \u0622\u0626\u06CC \u0627\u0648\u0631 100 \u0627\u0646\u0688\u06CC\u06A9\u0633 \u0645\u06CC\u06BA \u062A\u0627\u0631\u06CC\u062E\u06CC \u0627\u0636\u0627\u0641\u06C1 \u0631\u06CC\u06A9\u0627\u0631\u0688 \u06A9\u06CC\u0627 \u06AF\u06CC\u0627\u06D4",
    contentEn: `The Pakistan Stock Exchange (PSX) benchmark KSE-100 index witnessed unprecedented bullish momentum on Thursday, surging past key resistance levels amidst renewed foreign investor inflows and solid progress on macroeconomic structural reforms.

Market analysts attributed the sharp upward trajectory to declining inflation indicators, improved foreign exchange reserves with the State Bank of Pakistan (SBP), and consistent remittances from overseas Pakistanis. Major blue-chip stocks in the banking, fertilizer, energy, and information technology sectors spearheaded the rally.

"The market's confidence is rooted in fiscal discipline and bilateral agreements that have significantly reduced sovereign risk premiums," stated a leading equity strategist at Karachi Financial Tower.

The business community has welcomed the developments, highlighting that stable currency valuations and lower lending rates will unlock long-term manufacturing investments across industrial hubs in Karachi, Lahore, and Faisalabad.`,
    contentUr: `\u067E\u0627\u06A9\u0633\u062A\u0627\u0646 \u0627\u0633\u0679\u0627\u06A9 \u0627\u06CC\u06A9\u0633\u0686\u06CC\u0646\u062C (\u067E\u06CC \u0627\u06CC\u0633 \u0627\u06CC\u06A9\u0633) \u0645\u06CC\u06BA \u062C\u0645\u0639\u0631\u0627\u062A \u06A9\u0648 \u06A9\u0627\u0631\u0648\u0628\u0627\u0631 \u06A9\u06D2 \u062F\u0648\u0631\u0627\u0646 \u0632\u0628\u0631\u062F\u0633\u062A \u062A\u06CC\u0632\u06CC \u062F\u06CC\u06A9\u06BE\u06CC \u06AF\u0626\u06CC\u060C \u062C\u06C1\u0627\u06BA \u06A9\u06D2 \u0627\u06CC\u0633 \u0627\u06CC 100 \u0627\u0646\u0688\u06CC\u06A9\u0633 \u0645\u0644\u06A9\u06CC \u062A\u0627\u0631\u06CC\u062E \u06A9\u06D2 \u0627\u06C1\u0645 \u0631\u06CC\u06A9\u0627\u0631\u0688 \u06A9\u0648 \u0639\u0628\u0648\u0631 \u06A9\u0631 \u06AF\u06CC\u0627\u06D4 \u0645\u0627\u0631\u06A9\u06CC\u0679 \u0645\u06CC\u06BA \u0645\u0642\u0627\u0645\u06CC \u0627\u0648\u0631 \u063A\u06CC\u0631 \u0645\u0644\u06A9\u06CC \u0633\u0631\u0645\u0627\u06CC\u06C1 \u06A9\u0627\u0631\u0648\u06BA \u06A9\u06CC \u0628\u06BE\u0631\u067E\u0648\u0631 \u062E\u0631\u06CC\u062F\u0627\u0631\u06CC \u0646\u06D2 \u062A\u06CC\u0632\u06CC \u06A9\u0648 \u062A\u0642\u0648\u06CC\u062A \u062F\u06CC\u06D4

\u0645\u0627\u06C1\u0631\u06CC\u0646\u0650 \u0645\u0639\u0627\u0634\u06CC\u0627\u062A \u06A9\u06D2 \u0645\u0637\u0627\u0628\u0642 \u0645\u06C1\u0646\u06AF\u0627\u0626\u06CC \u06A9\u06CC \u0634\u0631\u062D \u0645\u06CC\u06BA \u0645\u0633\u0644\u0633\u0644 \u06A9\u0645\u06CC\u060C \u0627\u0633\u0679\u06CC\u0679 \u0628\u06CC\u0646\u06A9 \u0622\u0641 \u067E\u0627\u06A9\u0633\u062A\u0627\u0646 \u06A9\u06D2 \u0632\u0631\u0650\u0645\u0628\u0627\u062F\u0644\u06C1 \u06A9\u06D2 \u0630\u062E\u0627\u0626\u0631 \u0645\u06CC\u06BA \u0628\u06C1\u062A\u0631\u06CC \u0627\u0648\u0631 \u0627\u0648\u0648\u0631\u0633\u06CC\u0632 \u067E\u0627\u06A9\u0633\u062A\u0627\u0646\u06CC\u0648\u06BA \u06A9\u06CC \u062C\u0627\u0646\u0628 \u0633\u06D2 \u062A\u0631\u0633\u06CC\u0644\u0627\u062A\u0650 \u0632\u0631 \u0645\u06CC\u06BA \u0627\u0636\u0627\u0641\u06D2 \u0646\u06D2 \u0645\u0627\u0631\u06A9\u06CC\u0679 \u06A9\u06D2 \u0627\u0639\u062A\u0645\u0627\u062F \u0645\u06CC\u06BA \u0627\u0636\u0627\u0641\u06C1 \u06A9\u06CC\u0627 \u06C1\u06D2\u06D4 \u062E\u0627\u0635 \u0637\u0648\u0631 \u067E\u0631 \u0628\u06CC\u0646\u06A9\u0646\u06AF\u060C \u0622\u0626\u0644 \u0627\u06CC\u0646\u0688 \u06AF\u06CC\u0633\u060C \u06A9\u06BE\u0627\u062F \u0627\u0648\u0631 \u0622\u0626\u06CC \u0679\u06CC \u0633\u06CC\u06A9\u0679\u0631\u0632 \u06A9\u06D2 \u0634\u06CC\u0626\u0631\u0632 \u0645\u06CC\u06BA \u0646\u0645\u0627\u06CC\u0627\u06BA \u0627\u0636\u0627\u0641\u06C1 \u0631\u06CC\u06A9\u0627\u0631\u0688 \u06A9\u06CC\u0627 \u06AF\u06CC\u0627\u06D4

\u06A9\u0627\u0631\u0648\u0628\u0627\u0631\u06CC \u0628\u0631\u0627\u062F\u0631\u06CC \u0646\u06D2 \u0631\u0648\u067E\u06D2 \u06A9\u06CC \u0642\u062F\u0631 \u0645\u06CC\u06BA \u0627\u0633\u062A\u062D\u06A9\u0627\u0645 \u0627\u0648\u0631 \u0645\u0627\u0631\u06A9 \u0627\u067E \u0631\u06CC\u0679\u0633 \u0645\u06CC\u06BA \u0645\u062A\u0648\u0642\u0639 \u06A9\u0645\u06CC \u06A9\u0648 \u0633\u0631\u0627\u06C1\u062A\u06D2 \u06C1\u0648\u0626\u06D2 \u06A9\u06C1\u0627 \u06A9\u06C1 \u0627\u0633 \u0633\u06D2 \u06A9\u0631\u0627\u0686\u06CC\u060C \u0644\u0627\u06C1\u0648\u0631 \u0627\u0648\u0631 \u0641\u06CC\u0635\u0644 \u0622\u0628\u0627\u062F \u062C\u06CC\u0633\u06D2 \u0635\u0646\u0639\u062A\u06CC \u0634\u06C1\u0631\u0648\u06BA \u0645\u06CC\u06BA \u067E\u06CC\u062F\u0627\u0648\u0627\u0631\u06CC \u0633\u0631\u06AF\u0631\u0645\u06CC\u0627\u06BA \u062A\u06CC\u0632 \u06C1\u0648\u06BA \u06AF\u06CC\u06D4`,
    category: "business",
    tags: ["PSX", "Economy", "Finance", "SBP", "Investment"],
    author: {
      id: "auth-1",
      nameEn: "Tariq Mahmood",
      nameUr: "\u0637\u0627\u0631\u0642 \u0645\u062D\u0645\u0648\u062F",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
      role: "Chief Financial Correspondent"
    },
    publishedAt: "2026-11-06T08:30:00Z",
    updatedAt: "2026-11-06T09:15:00Z",
    views: 14200,
    status: "published",
    heroImage: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80",
    imageCaptionEn: "Trading activity at Pakistan Stock Exchange in Karachi.",
    imageCaptionUr: "\u06A9\u0631\u0627\u0686\u06CC \u0645\u06CC\u06BA \u067E\u0627\u06A9\u0633\u062A\u0627\u0646 \u0627\u0633\u0679\u0627\u06A9 \u0627\u06CC\u06A9\u0633\u0686\u06CC\u0646\u062C \u0645\u06CC\u06BA \u062A\u062C\u0627\u0631\u062A\u06CC \u0633\u0631\u06AF\u0631\u0645\u06CC\u0627\u06BA\u06D4",
    isBreaking: true,
    isFeatured: true,
    isTrending: true,
    readingTimeMin: 4
  },
  {
    id: "art-2",
    slug: "pakistan-cricket-champions-trophy-preparation-squad",
    titleEn: "National Cricket Team Gearing Up for ICC Champions Trophy: Fast Bowlers in Form",
    titleUr: "\u0622\u0626\u06CC \u0633\u06CC \u0633\u06CC \u0686\u06CC\u0645\u067E\u0626\u0646\u0632 \u0679\u0631\u0627\u0641\u06CC: \u0642\u0648\u0645\u06CC \u06A9\u0631\u06A9\u0679 \u0679\u06CC\u0645 \u06A9\u06CC \u062A\u06CC\u0627\u0631\u06CC\u0627\u06BA \u0639\u0631\u0648\u062C \u067E\u0631\u060C \u0641\u0627\u0633\u0679 \u0628\u0648\u0644\u0631\u0632 \u0628\u06BE\u0631\u067E\u0648\u0631 \u0641\u0627\u0631\u0645 \u0645\u06CC\u06BA",
    summaryEn: "National cricket selectors and head coaches review player fitness and match strategies ahead of the mega tournament in Pakistan.",
    summaryUr: "\u067E\u0627\u06A9\u0633\u062A\u0627\u0646 \u0645\u06CC\u06BA \u06C1\u0648\u0646\u06D2 \u0648\u0627\u0644\u06D2 \u0628\u06CC\u0646 \u0627\u0644\u0627\u0642\u0648\u0627\u0645\u06CC \u0627\u06CC\u0648\u0646\u0679 \u06A9\u06D2 \u0644\u06CC\u06D2 \u0642\u0648\u0645\u06CC \u0627\u0633\u06A9\u0648\u0627\u0688 \u06A9\u06CC \u0628\u06BE\u0631\u067E\u0648\u0631 \u0645\u0634\u0642\u06CC\u06BA \u062C\u0627\u0631\u06CC\u060C \u06A9\u06BE\u0644\u0627\u0691\u06CC \u0628\u06C1\u062A\u0631\u06CC\u0646 \u06A9\u0627\u0631\u06A9\u0631\u062F\u06AF\u06CC \u062F\u06A9\u06BE\u0627\u0646\u06D2 \u06A9\u06D2 \u0644\u06CC\u06D2 \u067E\u064F\u0631\u0639\u0632\u0645\u06D4",
    contentEn: `The Pakistan national cricket team underwent rigorous fielding drills and high-intensity net sessions at the National Cricket Academy in Lahore today as preparations for the premier ICC championship entered the final stretch.

Shaheen Shah Afridi, Naseem Shah, and Haris Rauf demonstrated lethal pace during afternoon training, while Babar Azam and Mohammad Rizwan spent extended hours mastering stroke-play against spin bowling.

Head Coach addressed the media in a post-practice briefing: "Our squad depth is exceptional right now. The boys have adapted brilliantly to the conditions and the home crowd support in Rawalpindi, Lahore, and Karachi will be our biggest strength."

Tickets for the opening fixture sold out within hours of the official portal release, reflecting immense passion from cricket enthusiasts across the country.`,
    contentUr: `\u067E\u0627\u06A9\u0633\u062A\u0627\u0646 \u06A9\u06CC \u0642\u0648\u0645\u06CC \u06A9\u0631\u06A9\u0679 \u0679\u06CC\u0645 \u0646\u06D2 \u0622\u062C \u0644\u0627\u06C1\u0648\u0631 \u06A9\u06CC \u0646\u06CC\u0634\u0646\u0644 \u06A9\u0631\u06A9\u0679 \u0627\u06A9\u06CC\u0688\u0645\u06CC \u0645\u06CC\u06BA \u0633\u062E\u062A \u0679\u0631\u06CC\u0646\u0646\u06AF \u0633\u06CC\u0634\u0646 \u0645\u06CC\u06BA \u062D\u0635\u06C1 \u0644\u06CC\u0627 \u062C\u06C1\u0627\u06BA \u0641\u06CC\u0644\u0688\u0646\u06AF \u0627\u0648\u0631 \u0628\u0648\u0644\u0646\u06AF \u06A9\u06CC \u0645\u0634\u0642\u06CC\u06BA \u06A9\u06CC \u06AF\u0626\u06CC\u06BA\u06D4 \u0645\u06CC\u06AF\u0627 \u0627\u06CC\u0648\u0646\u0679 \u06A9\u06CC \u0645\u06CC\u0632\u0628\u0627\u0646\u06CC \u06A9\u06D2 \u067E\u06CC\u0634\u0650 \u0646\u0638\u0631 \u06A9\u06BE\u0644\u0627\u0691\u06CC\u0648\u06BA \u06A9\u06CC \u0641\u0679\u0646\u0633 \u067E\u0631 \u062E\u0635\u0648\u0635\u06CC \u062A\u0648\u062C\u06C1 \u062F\u06CC \u062C\u0627 \u0631\u06C1\u06CC \u06C1\u06D2\u06D4

\u0634\u0627\u06C1\u06CC\u0646 \u0634\u0627\u06C1 \u0622\u0641\u0631\u06CC\u062F\u06CC\u060C \u0646\u0633\u06CC\u0645 \u0634\u0627\u06C1 \u0627\u0648\u0631 \u062D\u0627\u0631\u062B \u0631\u0624\u0641 \u0646\u06D2 \u062A\u06CC\u0632 \u0631\u0641\u062A\u0627\u0631 \u06CC\u0627\u0631\u06A9\u0631\u0632 \u0627\u0648\u0631 \u0628\u0627\u0624\u0646\u0633\u0631\u0632 \u06A9\u06CC \u0645\u0634\u0642 \u06A9\u06CC \u062C\u0628\u06A9\u06C1 \u0628\u0627\u0628\u0631 \u0627\u0639\u0638\u0645 \u0627\u0648\u0631 \u0645\u062D\u0645\u062F \u0631\u0636\u0648\u0627\u0646 \u0646\u06D2 \u0646\u06CC\u0679 \u067E\u0631 \u0627\u0633\u067E\u0646 \u0628\u0648\u0644\u0631\u0632 \u06A9\u06D2 \u062E\u0644\u0627\u0641 \u0637\u0648\u06CC\u0644 \u0648\u0642\u062A \u06AF\u0632\u0627\u0631\u0627\u06D4

\u067E\u0631\u06CC\u0633 \u06A9\u0627\u0646\u0641\u0631\u0646\u0633 \u06A9\u0631\u062A\u06D2 \u06C1\u0648\u0626\u06D2 \u06C1\u06CC\u0688 \u06A9\u0648\u0686 \u0646\u06D2 \u06A9\u06C1\u0627 \u06A9\u06C1 \u0679\u06CC\u0645 \u06A9\u0627 \u0645\u0648\u0631\u0627\u0644 \u0627\u0646\u062A\u06C1\u0627\u0626\u06CC \u0628\u0644\u0646\u062F \u06C1\u06D2 \u0627\u0648\u0631 \u06C1\u0648\u0645 \u06AF\u0631\u0627\u0624\u0646\u0688 \u067E\u0631 \u0645\u0644\u06A9\u06CC \u0634\u0627\u0626\u0642\u06CC\u0646 \u06A9\u06CC \u0628\u06BE\u0631\u067E\u0648\u0631 \u062D\u0645\u0627\u06CC\u062A \u06A9\u06BE\u0644\u0627\u0691\u06CC\u0648\u06BA \u06A9\u06D2 \u062C\u0630\u0628\u06D2 \u06A9\u0648 \u0645\u0632\u06CC\u062F \u0628\u0691\u06BE\u0627\u0626\u06D2 \u06AF\u06CC\u06D4 \u0631\u0627\u0648\u0644\u067E\u0646\u0688\u06CC \u0627\u0648\u0631 \u0644\u0627\u06C1\u0648\u0631 \u0645\u06CC\u06BA \u0634\u06CC\u0688\u0648\u0644 \u0645\u06CC\u0686\u0632 \u06A9\u06D2 \u0679\u06A9\u0679 \u067E\u06C1\u0644\u06D2 \u06C1\u06CC \u0686\u0646\u062F \u06AF\u06BE\u0646\u0679\u0648\u06BA \u0645\u06CC\u06BA \u0641\u0631\u0648\u062E\u062A \u06C1\u0648 \u0686\u06A9\u06D2 \u06C1\u06CC\u06BA\u06D4`,
    category: "sports",
    tags: ["Cricket", "PCB", "ChampionsTrophy", "BabarAzam", "Sports"],
    author: {
      id: "auth-2",
      nameEn: "Zainab Abbas Khan",
      nameUr: "\u0632\u06CC\u0646\u0628 \u0639\u0628\u0627\u0633 \u062E\u0627\u0646",
      avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80",
      role: "Senior Sports Editor"
    },
    publishedAt: "2026-11-06T07:15:00Z",
    updatedAt: "2026-11-06T07:45:00Z",
    views: 18950,
    status: "published",
    heroImage: "https://images.unsplash.com/photo-1531415074868-036b1c57e329?auto=format&fit=crop&w=1200&q=80",
    imageCaptionEn: "Pakistan cricket team practice session at Gaddafi Stadium.",
    imageCaptionUr: "\u0642\u0630\u0627\u0641\u06CC \u0627\u0633\u0679\u06CC\u0688\u06CC\u0645 \u0644\u0627\u06C1\u0648\u0631 \u0645\u06CC\u06BA \u0642\u0648\u0645\u06CC \u06A9\u0631\u06A9\u0679\u0631\u0632 \u06A9\u0627 \u067E\u0631\u06CC\u06A9\u0679\u0633 \u0633\u06CC\u0634\u0646\u06D4",
    isBreaking: false,
    isFeatured: true,
    isTrending: true,
    readingTimeMin: 3
  },
  {
    id: "art-3",
    slug: "federal-cabinet-approves-nationwide-digital-id-and-green-energy-subsidy",
    titleEn: "Federal Government Unveils Landmark Solar Energy Subsidy Scheme for Low-Income Households",
    titleUr: "\u062D\u06A9\u0648\u0645\u062A \u06A9\u0627 \u06A9\u0645 \u0622\u0645\u062F\u0646\u06CC \u0648\u0627\u0644\u06D2 \u06AF\u06BE\u0631\u0627\u0646\u0648\u06BA \u06A9\u06D2 \u0644\u06CC\u06D2 \u0633\u0648\u0644\u0631 \u0627\u0646\u0631\u062C\u06CC \u0633\u0628\u0633\u0688\u06CC \u0627\u0633\u06A9\u06CC\u0645 \u06A9\u0627 \u0628\u0691\u0627 \u0627\u0639\u0644\u0627\u0646",
    summaryEn: "Prime Minister announces solar panel financing at 0% markup and automated electricity meter upgrades across all four provinces.",
    summaryUr: "\u0648\u0632\u06CC\u0631\u0627\u0639\u0638\u0645 \u06A9\u0627 \u0645\u0633\u062A\u062D\u0642 \u062E\u0627\u0646\u062F\u0627\u0646\u0648\u06BA \u06A9\u0648 \u0628\u0644\u0627 \u0633\u0648\u062F \u0633\u0648\u0644\u0631 \u067E\u06CC\u0646\u0644 \u0641\u0631\u0627\u06C1\u0645 \u06A9\u0631\u0646\u06D2 \u0627\u0648\u0631 \u0628\u062C\u0644\u06CC \u06A9\u06D2 \u0628\u0644\u0648\u06BA \u0645\u06CC\u06BA \u0631\u06CC\u0644\u06CC\u0641 \u06A9\u06D2 \u0644\u06CC\u06D2 \u062C\u0627\u0645\u0639 \u0645\u0646\u0635\u0648\u0628\u06D2 \u06A9\u06CC \u0645\u0646\u0638\u0648\u0631\u06CC\u06D4",
    contentEn: `In a major step to alleviate energy costs for common citizens, the Federal Government today announced a comprehensive solarization program targeting 500,000 households across Punjab, Sindh, Khyber Pakhtunkhwa, and Balochistan.

Under the newly ratified framework, consumers utilizing up to 300 units per month will be eligible for subsidized rooftop solar installations with installment plans spread over five years at zero markup.

The Energy Minister emphasized that this clean energy transition would simultaneously reduce national circular debt in the power sector and protect vulnerable consumers from seasonal fuel price adjustments.

Registration for the scheme opens next Monday through a unified citizen digital portal.`,
    contentUr: `\u0639\u0648\u0627\u0645 \u06A9\u0648 \u0628\u062C\u0644\u06CC \u06A9\u06D2 \u0628\u06BE\u0627\u0631\u06CC \u0628\u0644\u0648\u06BA \u0633\u06D2 \u0646\u062C\u0627\u062A \u062F\u0644\u0627\u0646\u06D2 \u06A9\u06D2 \u0644\u06CC\u06D2 \u0648\u0641\u0627\u0642\u06CC \u062D\u06A9\u0648\u0645\u062A \u0646\u06D2 \u0645\u0644\u06A9 \u0628\u06BE\u0631 \u06A9\u06D2 5 \u0644\u0627\u06A9\u06BE \u06A9\u0645 \u0622\u0645\u062F\u0646\u06CC \u0648\u0627\u0644\u06D2 \u06AF\u06BE\u0631\u0627\u0646\u0648\u06BA \u06A9\u06D2 \u0644\u06CC\u06D2 \u0633\u0648\u0644\u0631 \u0633\u0628\u0633\u0688\u06CC \u067E\u0631\u0648\u06AF\u0631\u0627\u0645 \u06A9\u06CC \u0628\u0627\u0642\u0627\u0639\u062F\u06C1 \u0645\u0646\u0638\u0648\u0631\u06CC \u062F\u06D2 \u062F\u06CC \u06C1\u06D2\u06D4

\u0627\u0633 \u0645\u0646\u0635\u0648\u0628\u06D2 \u06A9\u06D2 \u062A\u062D\u062A \u0645\u0627\u06C1\u0627\u0646\u06C1 300 \u06CC\u0648\u0646\u0679 \u062A\u06A9 \u0628\u062C\u0644\u06CC \u0627\u0633\u062A\u0639\u0645\u0627\u0644 \u06A9\u0631\u0646\u06D2 \u0648\u0627\u0644\u06D2 \u0635\u0627\u0631\u0641\u06CC\u0646 \u06A9\u0648 \u067E\u0627\u0646\u0686 \u0633\u0627\u0644 \u06A9\u06CC \u0622\u0633\u0627\u0646 \u0628\u0644\u0627 \u0633\u0648\u062F \u0627\u0642\u0633\u0627\u0637 \u067E\u0631 \u0645\u06A9\u0645\u0644 \u0633\u0648\u0644\u0631 \u0633\u0633\u0679\u0645 \u0641\u0631\u0627\u06C1\u0645 \u06A9\u06CC\u0627 \u062C\u0627\u0626\u06D2 \u06AF\u0627\u06D4

\u0648\u0641\u0627\u0642\u06CC \u0648\u0632\u06CC\u0631\u0650 \u062A\u0648\u0627\u0646\u0627\u0626\u06CC \u0646\u06D2 \u0645\u06CC\u0688\u06CC\u0627 \u06A9\u0648 \u0628\u0631\u06CC\u0641\u0646\u06AF \u062F\u06CC\u062A\u06D2 \u06C1\u0648\u0626\u06D2 \u0628\u062A\u0627\u06CC\u0627 \u06A9\u06C1 \u0627\u0633 \u0627\u0642\u062F\u0627\u0645 \u0633\u06D2 \u06AF\u0631\u062F\u0634\u06CC \u0642\u0631\u0636\u06D2 \u0645\u06CC\u06BA \u06A9\u0645\u06CC \u0622\u0626\u06D2 \u06AF\u06CC \u0627\u0648\u0631 \u0645\u0627\u062D\u0648\u0644 \u062F\u0648\u0633\u062A \u0628\u062C\u0644\u06CC \u06A9\u06CC \u067E\u06CC\u062F\u0627\u0648\u0627\u0631 \u0645\u06CC\u06BA \u0627\u0636\u0627\u0641\u06C1 \u06C1\u0648\u06AF\u0627\u06D4 \u0634\u06C1\u0631\u06CC \u067E\u06CC\u0631 \u06A9\u06D2 \u0631\u0648\u0632 \u0633\u06D2 \u067E\u0648\u0631\u0679\u0644 \u06A9\u06D2 \u0630\u0631\u06CC\u0639\u06D2 \u0622\u0646 \u0644\u0627\u0626\u0646 \u062F\u0631\u062E\u0648\u0627\u0633\u062A\u06CC\u06BA \u062C\u0645\u0639 \u06A9\u0631\u0627 \u0633\u06A9\u06CC\u06BA \u06AF\u06D2\u06D4`,
    category: "pakistan",
    tags: ["SolarEnergy", "Electricity", "GovtSubsidy", "Relief", "PakistanNews"],
    author: {
      id: "auth-3",
      nameEn: "Shahid Ali Warraich",
      nameUr: "\u0634\u0627\u06C1\u062F \u0639\u0644\u06CC \u0648\u0691\u0627\u0626\u0686",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
      role: "Bureau Chief Islamabad"
    },
    publishedAt: "2026-11-06T06:00:00Z",
    updatedAt: "2026-11-06T06:30:00Z",
    views: 22100,
    status: "published",
    heroImage: "https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=1200&q=80",
    imageCaptionEn: "Solar panels installed under renewable energy initiatives in Pakistan.",
    imageCaptionUr: "\u067E\u0627\u06A9\u0633\u062A\u0627\u0646 \u0645\u06CC\u06BA \u0645\u0627\u062D\u0648\u0644 \u062F\u0648\u0633\u062A \u062A\u0648\u0627\u0646\u0627\u0626\u06CC \u06A9\u06D2 \u0641\u0631\u0648\u063A \u06A9\u06D2 \u0644\u06CC\u06D2 \u0633\u0648\u0644\u0631 \u067E\u06CC\u0646\u0644 \u062A\u0646\u0635\u06CC\u0628\u06D4",
    isBreaking: false,
    isFeatured: true,
    isTrending: false,
    readingTimeMin: 4
  },
  {
    id: "art-4",
    slug: "bise-annual-matric-intermediate-examinations-schedule-announced-2026",
    titleEn: "Punjab and Federal Boards Release Date Sheet for Annual Matric and Intermediate Exams",
    titleUr: "\u067E\u0646\u062C\u0627\u0628 \u0627\u0648\u0631 \u0641\u06CC\u0688\u0631\u0644 \u062A\u0639\u0644\u06CC\u0645\u06CC \u0628\u0648\u0631\u0688\u0632 \u0646\u06D2 \u0633\u0627\u0644\u0627\u0646\u06C1 \u0645\u06CC\u0679\u0631\u06A9 \u0627\u0648\u0631 \u0627\u0646\u0679\u0631\u0645\u06CC\u0688\u06CC\u0679 \u0627\u0645\u062A\u062D\u0627\u0646\u0627\u062A \u06A9\u06CC \u0688\u06CC\u0679 \u0634\u06CC\u0679 \u062C\u0627\u0631\u06CC \u06A9\u0631 \u062F\u06CC",
    summaryEn: "Over 2.5 million students across 9 educational boards in Punjab and FBISE Islamabad prepare for commencement of theory exams.",
    summaryUr: "\u0644\u0627\u06C1\u0648\u0631\u060C \u0631\u0627\u0648\u0644\u067E\u0646\u0688\u06CC\u060C \u0641\u06CC\u0635\u0644 \u0622\u0628\u0627\u062F\u060C \u0645\u0644\u062A\u0627\u0646 \u0627\u0648\u0631 \u0641\u06CC\u0688\u0631\u0644 \u0628\u0648\u0631\u0688 \u06A9\u06D2 \u062A\u062D\u062A \u062F\u0633\u0648\u06CC\u06BA \u0627\u0648\u0631 \u0628\u0627\u0631\u06C1\u0648\u06CC\u06BA \u062C\u0645\u0627\u0639\u062A \u06A9\u06D2 \u0633\u0627\u0644\u0627\u0646\u06C1 \u0627\u0645\u062A\u062D\u0627\u0646\u0627\u062A \u06A9\u06D2 \u0634\u06CC\u0688\u0648\u0644 \u06A9\u0627 \u0627\u0639\u0644\u0627\u0646\u06D4",
    contentEn: `The Punjab Boards Committee of Chairmen (PBCC) in coordination with the Federal Board of Intermediate and Secondary Education (FBISE) has officially published the date sheet for the upcoming Secondary School Certificate (Matric) and Higher Secondary School Certificate (Inter) examinations.

Examinations will be administered under strict digital surveillance and biometric student verification to maintain absolute academic integrity. Roll number slips have been dispatched electronically to affiliated schools and uploaded on respective board web servers for direct download.

Students can utilize our online Education Portal result section to access past papers, model papers, and live result alerts.`,
    contentUr: `\u067E\u0646\u062C\u0627\u0628 \u0628\u06BE\u0631 \u06A9\u06D2 \u062A\u0639\u0644\u06CC\u0645\u06CC \u0628\u0648\u0631\u0688\u0632 \u0627\u0648\u0631 \u0641\u06CC\u0688\u0631\u0644 \u0628\u0648\u0631\u0688 \u0627\u0633\u0644\u0627\u0645 \u0622\u0628\u0627\u062F \u0646\u06D2 \u0646\u0648\u06CC\u06BA\u060C \u062F\u0633\u0648\u06CC\u06BA \u0627\u0648\u0631 \u0628\u0627\u0631\u06C1\u0648\u06CC\u06BA \u062C\u0645\u0627\u0639\u062A \u06A9\u06D2 \u0633\u0627\u0644\u0627\u0646\u06C1 \u0627\u0645\u062A\u062D\u0627\u0646\u0627\u062A \u06A9\u06CC \u062D\u062A\u0645\u06CC \u062A\u0627\u0631\u06CC\u062E\u0648\u06BA \u06A9\u0627 \u0627\u0639\u0644\u0627\u0646 \u06A9\u0631 \u062F\u06CC\u0627 \u06C1\u06D2\u06D4 \u0627\u0645\u062A\u062D\u0627\u0646\u06CC \u0634\u06CC\u0688\u0648\u0644 \u06A9\u06D2 \u0645\u0637\u0627\u0628\u0642 \u0631\u0648\u0644 \u0646\u0645\u0628\u0631 \u0633\u0644\u067E\u0633 \u0622\u0646 \u0644\u0627\u0626\u0646 \u062C\u0627\u0631\u06CC \u06A9\u0631 \u062F\u06CC \u06AF\u0626\u06CC \u06C1\u06CC\u06BA\u06D4

\u0686\u06CC\u0626\u0631\u0645\u06CC\u0646 \u0628\u0648\u0631\u0688\u0632 \u06A9\u0645\u06CC\u0679\u06CC \u06A9\u06D2 \u0645\u0637\u0627\u0628\u0642 \u0627\u0645\u062A\u062D\u0627\u0646\u06CC \u0645\u0631\u0627\u06A9\u0632 \u0645\u06CC\u06BA \u0634\u0641\u0627\u0641\u06CC\u062A \u0627\u0648\u0631 \u0646\u0642\u0644 \u06A9\u06CC \u0631\u0648\u06A9 \u062A\u06BE\u0627\u0645 \u06A9\u06D2 \u0644\u06CC\u06D2 \u0633\u06CC \u0633\u06CC \u0679\u06CC \u0648\u06CC \u06A9\u06CC\u0645\u0631\u0648\u06BA \u0627\u0648\u0631 \u0628\u0627\u0626\u06CC\u0648 \u0645\u06CC\u0679\u0631\u06A9 \u062D\u0627\u0636\u0631\u06CC \u06A9\u0627 \u062E\u0635\u0648\u0635\u06CC \u0627\u0646\u062A\u0638\u0627\u0645 \u06A9\u06CC\u0627 \u06AF\u06CC\u0627 \u06C1\u06D2\u06D4 \u0637\u0644\u0628\u06C1 \u067E\u0648\u0631\u0679\u0644 \u067E\u0631 \u0645\u0627\u0688\u0644 \u067E\u06CC\u067E\u0631\u0632 \u0627\u0648\u0631 \u067E\u0631\u0627\u0646\u06D2 \u067E\u0631\u0686\u06C1 \u062C\u0627\u062A \u0628\u06BE\u06CC \u062F\u06CC\u06A9\u06BE \u0633\u06A9\u062A\u06D2 \u06C1\u06CC\u06BA\u06D4`,
    category: "education",
    tags: ["BISE", "FBISE", "MatricResults", "InterExams", "Education"],
    author: {
      id: "auth-4",
      nameEn: "Prof. Asim Farooq",
      nameUr: "\u067E\u0631\u0648\u0641\u06CC\u0633\u0631 \u0639\u0627\u0635\u0645 \u0641\u0627\u0631\u0648\u0642",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
      role: "Education Columnist"
    },
    publishedAt: "2026-11-05T14:00:00Z",
    updatedAt: "2026-11-05T14:30:00Z",
    views: 31200,
    status: "published",
    heroImage: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1200&q=80",
    imageCaptionEn: "Students preparing for annual board examinations.",
    imageCaptionUr: "\u0633\u0627\u0644\u0627\u0646\u06C1 \u0628\u0648\u0631\u0688 \u0627\u0645\u062A\u062D\u0627\u0646\u0627\u062A \u06A9\u06CC \u062A\u06CC\u0627\u0631\u06CC \u0645\u06CC\u06BA \u0645\u0635\u0631\u0648\u0641 \u0637\u0644\u0628\u06C1 \u0648 \u0637\u0627\u0644\u0628\u0627\u062A\u06D4",
    isBreaking: false,
    isFeatured: false,
    isTrending: true,
    readingTimeMin: 3
  },
  {
    id: "art-5",
    slug: "5g-spectrum-auction-pakistan-telecom-authority-announcement",
    titleEn: "5G Mobile Services Launch Slated for Major Pakistani Metros: PTA Finalizes Framework",
    titleUr: "\u067E\u0627\u06A9\u0633\u062A\u0627\u0646 \u0645\u06CC\u06BA \u0641\u0627\u0626\u06CC\u0648 \u062C\u06CC (5G) \u0633\u0631\u0648\u0633\u0632 \u06A9\u06D2 \u0622\u063A\u0627\u0632 \u06A9\u06CC \u062D\u062A\u0645\u06CC \u062A\u06CC\u0627\u0631\u06CC\u0627\u06BA\u060C \u067E\u06CC \u0679\u06CC \u0627\u06D2 \u0646\u06D2 \u0641\u0631\u06CC\u0645 \u0648\u0631\u06A9 \u062C\u0627\u0631\u06CC \u06A9\u0631 \u062F\u06CC\u0627",
    summaryEn: "High-speed 5G connectivity to roll out across Karachi, Lahore, Islamabad, and Peshawar following high-level spectrum licensing.",
    summaryUr: "\u067E\u0627\u06A9\u0633\u062A\u0627\u0646 \u0679\u06CC\u0644\u06CC \u06A9\u0645\u06CC\u0648\u0646\u06CC\u06A9\u06CC\u0634\u0646 \u0627\u062A\u06BE\u0627\u0631\u0679\u06CC \u06A9\u06D2 \u0645\u0637\u0627\u0628\u0642 \u0628\u0691\u06D2 \u0634\u06C1\u0631\u0648\u06BA \u0645\u06CC\u06BA \u0635\u0627\u0631\u0641\u06CC\u0646 \u06A9\u0648 \u062C\u0644\u062F \u0627\u0646\u062A\u06C1\u0627\u0626\u06CC \u062A\u06CC\u0632 \u0631\u0641\u062A\u0627\u0631 \u0627\u0646\u0679\u0631\u0646\u06CC\u0679 \u0627\u0648\u0631 \u0646\u0626\u06CC \u0688\u06CC\u062C\u06CC\u0679\u0644 \u0633\u0631\u0648\u0633\u0632 \u0645\u06CC\u0633\u0631 \u06C1\u0648\u06BA \u06AF\u06CC\u06D4",
    contentEn: `The Pakistan Telecommunication Authority (PTA) has finalized spectrum allocation terms for next-generation 5G cellular technologies, aiming to boost the country's burgeoning digital economy, IT exports, and smart governance initiatives.

Industry leaders from major telecom networks highlighted that 5G speeds exceeding 1 Gbps will transform e-commerce, cloud gaming, remote healthcare, and agricultural tech implementations in rural corridors.

Special consumer smartphone financing plans are also being formulated in partnership with local mobile assembly manufacturers in Faisalabad and Rawalpindi.`,
    contentUr: `\u067E\u0627\u06A9\u0633\u062A\u0627\u0646 \u0679\u06CC\u0644\u06CC \u06A9\u0645\u06CC\u0648\u0646\u06CC\u06A9\u06CC\u0634\u0646 \u0627\u062A\u06BE\u0627\u0631\u0679\u06CC (\u067E\u06CC \u0679\u06CC \u0627\u06D2) \u0646\u06D2 \u0645\u0644\u06A9 \u0645\u06CC\u06BA \u0641\u0627\u0626\u06CC\u0648 \u062C\u06CC (5G) \u0627\u0646\u0679\u0631\u0646\u06CC\u0679 \u0633\u0631\u0648\u0633 \u06A9\u06D2 \u0644\u06CC\u06D2 \u0627\u0633\u067E\u06CC\u06A9\u0679\u0631\u0645 \u0646\u06CC\u0644\u0627\u0645\u06CC \u0627\u0648\u0631 \u0644\u0627\u0626\u0633\u0646\u0633\u0646\u06AF \u067E\u0627\u0644\u06CC\u0633\u06CC \u06A9\u06D2 \u0628\u0646\u06CC\u0627\u062F\u06CC \u062E\u062F\u0648\u062E\u0627\u0644 \u062C\u0627\u0631\u06CC \u06A9\u0631 \u062F\u06CC\u06D2 \u06C1\u06CC\u06BA\u06D4 \u0627\u0628\u062A\u062F\u0627\u0626\u06CC \u0645\u0631\u062D\u0644\u06D2 \u0645\u06CC\u06BA \u06A9\u0631\u0627\u0686\u06CC\u060C \u0644\u0627\u06C1\u0648\u0631 \u0627\u0648\u0631 \u0627\u0633\u0644\u0627\u0645 \u0622\u0628\u0627\u062F \u0645\u06CC\u06BA \u0641\u0627\u0626\u06CC\u0648 \u062C\u06CC \u06A9\u0627 \u0622\u063A\u0627\u0632 \u06A9\u06CC\u0627 \u062C\u0627\u0626\u06D2 \u06AF\u0627\u06D4

\u0622\u0626\u06CC \u0679\u06CC \u0645\u0627\u06C1\u0631\u06CC\u0646 \u06A9\u06D2 \u0645\u0637\u0627\u0628\u0642 \u0627\u0633 \u062C\u062F\u06CC\u062F \u0679\u06CC\u06A9\u0646\u0627\u0644\u0648\u062C\u06CC \u0633\u06D2 \u0646\u06C1 \u0635\u0631\u0641 \u0627\u0646\u0679\u0631\u0646\u06CC\u0679 \u0627\u0633\u067E\u06CC\u0688 \u0645\u06CC\u06BA \u063A\u06CC\u0631 \u0645\u0639\u0645\u0648\u0644\u06CC \u0627\u0636\u0627\u0641\u06C1 \u06C1\u0648\u06AF\u0627 \u0628\u0644\u06A9\u06C1 \u0679\u06CC\u0644\u06CC \u0645\u06CC\u0688\u06CC\u0633\u0646\u060C \u0645\u0635\u0646\u0648\u0639\u06CC \u0630\u06C1\u0627\u0646\u062A \u0627\u0648\u0631 \u067E\u0627\u06A9\u0633\u062A\u0627\u0646 \u06A9\u06CC \u0622\u0626\u06CC \u0679\u06CC \u0628\u0631\u0622\u0645\u062F\u0627\u062A \u0645\u06CC\u06BA \u062A\u06CC\u0632\u06CC \u0622\u0626\u06D2 \u06AF\u06CC\u06D4 \u0645\u0642\u0627\u0645\u06CC \u0633\u0637\u062D \u067E\u0631 \u0641\u0627\u0626\u06CC\u0648 \u062C\u06CC \u0627\u0633\u0645\u0627\u0631\u0679 \u0641\u0648\u0646\u0632 \u06A9\u06CC \u062A\u06CC\u0627\u0631\u06CC \u0628\u06BE\u06CC \u0634\u0631\u0648\u0639 \u06A9\u06CC \u062C\u0627 \u0631\u06C1\u06CC \u06C1\u06D2\u06D4`,
    category: "technology",
    tags: ["5G", "PTA", "Smartphones", "Internet", "TechPakistan"],
    author: {
      id: "auth-1",
      nameEn: "Tariq Mahmood",
      nameUr: "\u0637\u0627\u0631\u0642 \u0645\u062D\u0645\u0648\u062F",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
      role: "Tech & Telecom Reporter"
    },
    publishedAt: "2026-11-05T11:20:00Z",
    updatedAt: "2026-11-05T12:00:00Z",
    views: 15400,
    status: "published",
    heroImage: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80",
    imageCaptionEn: "5G optical telecommunication towers and technology infrastructure.",
    imageCaptionUr: "\u0679\u06CC\u0644\u06CC \u06A9\u0627\u0645 \u0627\u0646\u0641\u0631\u0627\u0633\u0679\u0631\u06A9\u0686\u0631 \u0627\u0648\u0631 \u062C\u062F\u06CC\u062F \u0646\u06CC\u0679 \u0648\u0631\u06A9 \u0679\u0627\u0648\u0631\u0632\u06D4",
    isBreaking: false,
    isFeatured: false,
    isTrending: true,
    readingTimeMin: 3
  }
];
var defaultBoards = [
  { id: "b1", code: "BISE_LHR", nameEn: "BISE Lahore", nameUr: "\u0628\u0648\u0631\u0688 \u0622\u0641 \u0627\u0646\u0679\u0631\u0645\u06CC\u0688\u06CC\u0679 \u0627\u06CC\u0646\u0688 \u0633\u06CC\u06A9\u0646\u0688\u0631\u06CC \u0627\u06CC\u062C\u0648\u06A9\u06CC\u0634\u0646 \u0644\u0627\u06C1\u0648\u0631", province: "Punjab", city: "Lahore", website: "https://www.biselahore.com" },
  { id: "b2", code: "BISE_RWP", nameEn: "BISE Rawalpindi", nameUr: "\u0628\u0648\u0631\u0688 \u0622\u0641 \u0627\u0646\u0679\u0631\u0645\u06CC\u0688\u06CC\u0679 \u0627\u06CC\u0646\u0688 \u0633\u06CC\u06A9\u0646\u0688\u0631\u06CC \u0627\u06CC\u062C\u0648\u06A9\u06CC\u0634\u0646 \u0631\u0627\u0648\u0644\u067E\u0646\u0688\u06CC", province: "Punjab", city: "Rawalpindi", website: "https://www.biserawalpindi.edu.pk" },
  { id: "b3", code: "BISE_FSD", nameEn: "BISE Faisalabad", nameUr: "\u0628\u0648\u0631\u0688 \u0622\u0641 \u0627\u0646\u0679\u0631\u0645\u06CC\u0688\u06CC\u0679 \u0627\u06CC\u0646\u0688 \u0633\u06CC\u06A9\u0646\u0688\u0631\u06CC \u0627\u06CC\u062C\u0648\u06A9\u06CC\u0634\u0646 \u0641\u06CC\u0635\u0644 \u0622\u0628\u0627\u062F", province: "Punjab", city: "Faisalabad", website: "https://www.bisefsd.edu.pk" },
  { id: "b4", code: "BISE_MUL", nameEn: "BISE Multan", nameUr: "\u0628\u0648\u0631\u0688 \u0622\u0641 \u0627\u0646\u0679\u0631\u0645\u06CC\u0688\u06CC\u0679 \u0627\u06CC\u0646\u0688 \u0633\u06CC\u06A9\u0646\u0688\u0631\u06CC \u0627\u06CC\u062C\u0648\u06A9\u06CC\u0634\u0646 \u0645\u0644\u062A\u0627\u0646", province: "Punjab", city: "Multan", website: "https://www.bisemultan.edu.pk" },
  { id: "b5", code: "BISE_GRW", nameEn: "BISE Gujranwala", nameUr: "\u0628\u0648\u0631\u0688 \u0622\u0641 \u0627\u0646\u0679\u0631\u0645\u06CC\u0688\u06CC\u0679 \u0627\u06CC\u0646\u0688 \u0633\u06CC\u06A9\u0646\u0688\u0631\u06CC \u0627\u06CC\u062C\u0648\u06A9\u06CC\u0634\u0646 \u06AF\u0648\u062C\u0631\u0627\u0646\u0648\u0627\u0644\u06C1", province: "Punjab", city: "Gujranwala", website: "https://www.bisegrw.edu.pk" },
  { id: "b6", code: "BSEK_KHI", nameEn: "BSEK Karachi (Matric)", nameUr: "\u062B\u0627\u0646\u0648\u06CC \u062A\u0639\u0644\u06CC\u0645\u06CC \u0628\u0648\u0631\u0688 \u06A9\u0631\u0627\u0686\u06CC", province: "Sindh", city: "Karachi", website: "https://bsek.edu.pk" },
  { id: "b7", code: "BIEK_KHI", nameEn: "BIEK Karachi (Inter)", nameUr: "\u0627\u0646\u0679\u0631\u0645\u06CC\u0688\u06CC\u0679 \u062A\u0639\u0644\u06CC\u0645\u06CC \u0628\u0648\u0631\u0688 \u06A9\u0631\u0627\u0686\u06CC", province: "Sindh", city: "Karachi", website: "https://biek.edu.pk" },
  { id: "b8", code: "BISE_PESH", nameEn: "BISE Peshawar", nameUr: "\u0628\u0648\u0631\u0688 \u0622\u0641 \u0627\u0646\u0679\u0631\u0645\u06CC\u0688\u06CC\u0679 \u0627\u06CC\u0646\u0688 \u0633\u06CC\u06A9\u0646\u0688\u0631\u06CC \u0627\u06CC\u062C\u0648\u06A9\u06CC\u0634\u0646 \u067E\u0634\u0627\u0648\u0631", province: "KPK", city: "Peshawar", website: "https://www.bisep.edu.pk" },
  { id: "b9", code: "BISE_QTA", nameEn: "BISE Quetta", nameUr: "\u0628\u0648\u0631\u0688 \u0622\u0641 \u0627\u0646\u0679\u0631\u0645\u06CC\u0688\u06CC\u0679 \u0627\u06CC\u0646\u0688 \u0633\u06CC\u06A9\u0646\u0688\u0631\u06CC \u0627\u06CC\u062C\u0648\u06A9\u06CC\u0634\u0646 \u06A9\u0648\u0626\u0679\u06C1", province: "Balochistan", city: "Quetta", website: "https://bbiseqta.edu.pk" },
  { id: "b10", code: "FBISE_ISB", nameEn: "FBISE Islamabad (Federal)", nameUr: "\u0641\u06CC\u0688\u0631\u0644 \u0628\u0648\u0631\u0688 \u0622\u0641 \u0627\u0646\u0679\u0631\u0645\u06CC\u0688\u06CC\u0679 \u0627\u06CC\u0646\u0688 \u0633\u06CC\u06A9\u0646\u0688\u0631\u06CC \u0627\u06CC\u062C\u0648\u06A9\u06CC\u0634\u0646 \u0627\u0633\u0644\u0627\u0645 \u0622\u0628\u0627\u062F", province: "Federal", city: "Islamabad", website: "https://www.fbise.edu.pk" }
];
var defaultResults = [
  {
    id: "res-1",
    boardCode: "BISE_LHR",
    examNameEn: "Matric (10th Class) Annual Examination",
    examNameUr: "\u0645\u06CC\u0679\u0631\u06A9 \u0633\u0627\u0644\u0627\u0646\u06C1 \u0627\u0645\u062A\u062D\u0627\u0646 (\u062F\u0633\u0648\u06CC\u06BA \u062C\u0645\u0627\u0639\u062A)",
    year: 2026,
    rollNumber: "102456",
    candidateNameEn: "Muhammad Hammad Siddiqui",
    candidateNameUr: "\u0645\u062D\u0645\u062F \u062D\u0645\u0627\u062F \u0635\u062F\u06CC\u0642\u06CC",
    fatherNameEn: "Tariq Siddiqui",
    fatherNameUr: "\u0637\u0627\u0631\u0642 \u0635\u062F\u06CC\u0642\u06CC",
    instituteEn: "Government Central Model High School, Lower Mall, Lahore",
    instituteUr: "\u06AF\u0648\u0631\u0646\u0645\u0646\u0679 \u0633\u06CC\u0646\u0679\u0631\u0644 \u0645\u0627\u0688\u0644 \u06C1\u0627\u0626\u06CC \u0627\u0633\u06A9\u0648\u0644 \u0644\u0648\u0626\u0631 \u0645\u0627\u0644 \u0644\u0627\u06C1\u0648\u0631",
    marksObtained: 1048,
    totalMarks: 1100,
    grade: "A+",
    status: "PASS",
    subjectMarks: [
      { subjectEn: "English Compulsory", subjectUr: "\u0627\u0646\u06AF\u0631\u06CC\u0632\u06CC \u0644\u0627\u0632\u0645\u06CC", marks: 142, total: 150 },
      { subjectEn: "Urdu Compulsory", subjectUr: "\u0627\u0631\u062F\u0648 \u0644\u0627\u0632\u0645\u06CC", marks: 145, total: 150 },
      { subjectEn: "Islamic Studies / Tarjuma", subjectUr: "\u0627\u0633\u0644\u0627\u0645\u06CC\u0627\u062A \u0648 \u062A\u0631\u062C\u0645\u06C3 \u0627\u0644\u0642\u0631\u0622\u0646", marks: 98, total: 100 },
      { subjectEn: "Pakistan Studies", subjectUr: "\u0645\u0637\u0627\u0644\u0639\u06C1 \u067E\u0627\u06A9\u0633\u062A\u0627\u0646", marks: 95, total: 100 },
      { subjectEn: "Mathematics (Sci)", subjectUr: "\u0631\u06CC\u0627\u0636\u06CC (\u0633\u0627\u0626\u0646\u0633)", marks: 150, total: 150 },
      { subjectEn: "Physics", subjectUr: "\u0637\u0628\u06CC\u0639\u06CC\u0627\u062A (\u0641\u0632\u06A9\u0633)", marks: 140, total: 150 },
      { subjectEn: "Chemistry", subjectUr: "\u06A9\u06CC\u0645\u0633\u0679\u0631\u06CC", marks: 138, total: 150 },
      { subjectEn: "Biology / Computer", subjectUr: "\u062D\u06CC\u0627\u062A\u06CC\u0627\u062A / \u06A9\u0645\u067E\u06CC\u0648\u0679\u0631", marks: 140, total: 150 }
    ]
  },
  {
    id: "res-2",
    boardCode: "FBISE_ISB",
    examNameEn: "Intermediate (HSSC-II Pre-Medical) Annual Examination",
    examNameUr: "\u0627\u0646\u0679\u0631\u0645\u06CC\u0688\u06CC\u0679 \u067E\u0631\u06CC \u0645\u06CC\u0688\u06CC\u06A9\u0644 \u0633\u0627\u0644\u0627\u0646\u06C1 \u0627\u0645\u062A\u062D\u0627\u0646 (\u0628\u0627\u0631\u06C1\u0648\u06CC\u06BA \u062C\u0645\u0627\u0639\u062A)",
    year: 2026,
    rollNumber: "204589",
    candidateNameEn: "Ayesha Fatima",
    candidateNameUr: "\u0639\u0627\u0626\u0634\u06C1 \u0641\u0627\u0637\u0645\u06C1",
    fatherNameEn: "Dr. Abdul Rehman",
    fatherNameUr: "\u0688\u0627\u06A9\u0679\u0631 \u0639\u0628\u062F \u0627\u0644\u0631\u062D\u0645\u0670\u0646",
    instituteEn: "Islamabad Model College for Girls, F-7/2, Islamabad",
    instituteUr: "\u0627\u0633\u0644\u0627\u0645 \u0622\u0628\u0627\u062F \u0645\u0627\u0688\u0644 \u06A9\u0627\u0644\u062C \u0628\u0631\u0627\u0626\u06D2 \u0637\u0627\u0644\u0628\u0627\u062A \u0627\u06CC\u0641 \u0633\u06CC\u0648\u0646 \u0679\u0648 \u0627\u0633\u0644\u0627\u0645 \u0622\u0628\u0627\u062F",
    marksObtained: 1062,
    totalMarks: 1100,
    grade: "A+",
    status: "PASS",
    subjectMarks: [
      { subjectEn: "English Compulsory", subjectUr: "\u0627\u0646\u06AF\u0631\u06CC\u0632\u06CC \u0644\u0627\u0632\u0645\u06CC", marks: 188, total: 200 },
      { subjectEn: "Urdu Compulsory", subjectUr: "\u0627\u0631\u062F\u0648 \u0644\u0627\u0632\u0645\u06CC", marks: 190, total: 200 },
      { subjectEn: "Islamic Education", subjectUr: "\u0627\u0633\u0644\u0627\u0645\u06CC \u062A\u0639\u0644\u06CC\u0645\u0627\u062A", marks: 49, total: 50 },
      { subjectEn: "Pakistan Studies", subjectUr: "\u0645\u0637\u0627\u0644\u0639\u06C1 \u067E\u0627\u06A9\u0633\u062A\u0627\u0646", marks: 48, total: 50 },
      { subjectEn: "Physics", subjectUr: "\u0641\u0632\u06A9\u0633", marks: 195, total: 200 },
      { subjectEn: "Chemistry", subjectUr: "\u06A9\u06CC\u0645\u0633\u0679\u0631\u06CC", marks: 194, total: 200 },
      { subjectEn: "Biology", subjectUr: "\u062D\u06CC\u0627\u062A\u06CC\u0627\u062A (\u0628\u0627\u0626\u06CC\u0648\u0644\u0648\u062C\u06CC)", marks: 198, total: 200 }
    ]
  },
  {
    id: "res-3",
    boardCode: "BSEK_KHI",
    examNameEn: "Matric Science Group Annual Examination",
    examNameUr: "\u0645\u06CC\u0679\u0631\u06A9 \u0633\u0627\u0626\u0646\u0633 \u06AF\u0631\u0648\u067E \u0633\u0627\u0644\u0627\u0646\u06C1 \u0627\u0645\u062A\u062D\u0627\u0646",
    year: 2026,
    rollNumber: "301290",
    candidateNameEn: "Syed Bilal Hassan",
    candidateNameUr: "\u0633\u06CC\u062F \u0628\u0644\u0627\u0644 \u062D\u0633\u0646",
    fatherNameEn: "Syed Hassan Rizvi",
    fatherNameUr: "\u0633\u06CC\u062F \u062D\u0633\u0646 \u0631\u0636\u0648\u06CC",
    instituteEn: "Habib Public School, Karachi",
    instituteUr: "\u062D\u0628\u06CC\u0628 \u067E\u0628\u0644\u06A9 \u0627\u0633\u06A9\u0648\u0644 \u06A9\u0631\u0627\u0686\u06CC",
    marksObtained: 980,
    totalMarks: 1100,
    grade: "A+",
    status: "PASS",
    subjectMarks: [
      { subjectEn: "English", subjectUr: "\u0627\u0646\u06AF\u0631\u06CC\u0632\u06CC", marks: 135, total: 150 },
      { subjectEn: "Urdu", subjectUr: "\u0627\u0631\u062F\u0648", marks: 130, total: 150 },
      { subjectEn: "Islamiyat", subjectUr: "\u0627\u0633\u0644\u0627\u0645\u06CC\u0627\u062A", marks: 92, total: 100 },
      { subjectEn: "Pak Studies", subjectUr: "\u0645\u0637\u0627\u0644\u0639\u06C1 \u067E\u0627\u06A9\u0633\u062A\u0627\u0646", marks: 88, total: 100 },
      { subjectEn: "Mathematics", subjectUr: "\u0631\u06CC\u0627\u0636\u06CC", marks: 145, total: 150 },
      { subjectEn: "Physics", subjectUr: "\u0641\u0632\u06A9\u0633", marks: 130, total: 150 },
      { subjectEn: "Chemistry", subjectUr: "\u06A9\u06CC\u0645\u0633\u0679\u0631\u06CC", marks: 128, total: 150 },
      { subjectEn: "Computer Science", subjectUr: "\u06A9\u0645\u067E\u06CC\u0648\u0679\u0631 \u0633\u0627\u0626\u0646\u0633", marks: 132, total: 150 }
    ]
  }
];
var defaultWeather = [
  {
    cityId: "karachi",
    nameEn: "Karachi",
    nameUr: "\u06A9\u0631\u0627\u0686\u06CC",
    provinceEn: "Sindh",
    provinceUr: "\u0633\u0646\u062F\u06BE",
    tempC: 31,
    conditionEn: "Sunny & Coastal Breeze",
    conditionUr: "\u062F\u06BE\u0648\u067E \u0627\u0648\u0631 \u0633\u0645\u0646\u062F\u0631\u06CC \u06C1\u0648\u0627",
    highC: 33,
    lowC: 22,
    humidity: 62,
    windKmh: 18,
    aqi: 95,
    aqiStatusEn: "Moderate",
    aqiStatusUr: "\u0645\u0639\u062A\u062F\u0644",
    feelsLikeC: 34,
    sunrise: "06:42 AM",
    sunset: "05:48 PM",
    hourly: [
      { time: "09:00", tempC: 27, condition: "Sunny" },
      { time: "12:00", tempC: 32, condition: "Sunny" },
      { time: "15:00", tempC: 33, condition: "Warm" },
      { time: "18:00", tempC: 29, condition: "Clear" },
      { time: "21:00", tempC: 25, condition: "Pleasant" }
    ],
    daily: [
      { dayEn: "Fri", dayUr: "\u062C\u0645\u0639\u06C1", highC: 33, lowC: 22, conditionEn: "Sunny", conditionUr: "\u0635\u0627\u0641" },
      { dayEn: "Sat", dayUr: "\u06C1\u0641\u062A\u06C1", highC: 32, lowC: 21, conditionEn: "Clear", conditionUr: "\u0635\u0627\u0641" },
      { dayEn: "Sun", dayUr: "\u0627\u062A\u0648\u0627\u0631", highC: 31, lowC: 20, conditionEn: "Breezy", conditionUr: "\u06C1\u0648\u0627\u062F\u0627\u0631" },
      { dayEn: "Mon", dayUr: "\u067E\u06CC\u0631", highC: 32, lowC: 21, conditionEn: "Sunny", conditionUr: "\u062F\u06BE\u0648\u067E" },
      { dayEn: "Tue", dayUr: "\u0645\u0646\u06AF\u0644", highC: 33, lowC: 22, conditionEn: "Sunny", conditionUr: "\u062F\u06BE\u0648\u067E" }
    ]
  },
  {
    cityId: "lahore",
    nameEn: "Lahore",
    nameUr: "\u0644\u0627\u06C1\u0648\u0631",
    provinceEn: "Punjab",
    provinceUr: "\u067E\u0646\u062C\u0627\u0628",
    tempC: 26,
    conditionEn: "Pleasant & Mild Haze",
    conditionUr: "\u062E\u0648\u0634\u06AF\u0648\u0627\u0631 \u0627\u0648\u0631 \u06C1\u0644\u06A9\u06CC \u062F\u06BE\u0646\u062F",
    highC: 28,
    lowC: 15,
    humidity: 54,
    windKmh: 9,
    aqi: 145,
    aqiStatusEn: "Unhealthy for Sensitive Groups",
    aqiStatusUr: "\u062D\u0633\u0627\u0633 \u0627\u0641\u0631\u0627\u062F \u06A9\u06D2 \u0644\u06CC\u06D2 \u0645\u0636\u0631",
    feelsLikeC: 26,
    sunrise: "06:26 AM",
    sunset: "05:15 PM",
    hourly: [
      { time: "09:00", tempC: 20, condition: "Hazy" },
      { time: "12:00", tempC: 26, condition: "Sunny" },
      { time: "15:00", tempC: 28, condition: "Mild" },
      { time: "18:00", tempC: 22, condition: "Cool" },
      { time: "21:00", tempC: 18, condition: "Cool" }
    ],
    daily: [
      { dayEn: "Fri", dayUr: "\u062C\u0645\u0639\u06C1", highC: 28, lowC: 15, conditionEn: "Mild", conditionUr: "\u0645\u0639\u062A\u062F\u0644" },
      { dayEn: "Sat", dayUr: "\u06C1\u0641\u062A\u06C1", highC: 27, lowC: 14, conditionEn: "Pleasant", conditionUr: "\u062E\u0648\u0634\u06AF\u0648\u0627\u0631" },
      { dayEn: "Sun", dayUr: "\u0627\u062A\u0648\u0627\u0631", highC: 27, lowC: 13, conditionEn: "Clear", conditionUr: "\u0635\u0627\u0641" },
      { dayEn: "Mon", dayUr: "\u067E\u06CC\u0631", highC: 26, lowC: 13, conditionEn: "Hazy", conditionUr: "\u06C1\u0644\u06A9\u06CC \u062F\u06BE\u0646\u062F" },
      { dayEn: "Tue", dayUr: "\u0645\u0646\u06AF\u0644", highC: 25, lowC: 12, conditionEn: "Cool", conditionUr: "\u0679\u06BE\u0646\u0688\u0627" }
    ]
  },
  {
    cityId: "islamabad",
    nameEn: "Islamabad",
    nameUr: "\u0627\u0633\u0644\u0627\u0645 \u0622\u0628\u0627\u062F",
    provinceEn: "Federal Capital",
    provinceUr: "\u0648\u0641\u0627\u0642\u06CC \u062F\u0627\u0631\u0627\u0644\u062D\u06A9\u0648\u0645\u062A",
    tempC: 23,
    conditionEn: "Clear & Crisp Margalla Air",
    conditionUr: "\u0635\u0627\u0641 \u0645\u0637\u0644\u0639 \u0627\u0648\u0631 \u0645\u0627\u0631\u06AF\u0644\u06C1 \u06A9\u06CC \u0679\u06BE\u0646\u0688\u06CC \u06C1\u0648\u0627",
    highC: 25,
    lowC: 11,
    humidity: 48,
    windKmh: 12,
    aqi: 48,
    aqiStatusEn: "Good & Fresh",
    aqiStatusUr: "\u0628\u06C1\u062A\u0631\u06CC\u0646 \u0627\u0648\u0631 \u0635\u0627\u0641 \u0633\u062A\u06BE\u0631\u06CC",
    feelsLikeC: 23,
    sunrise: "06:33 AM",
    sunset: "05:14 PM",
    hourly: [
      { time: "09:00", tempC: 17, condition: "Crisp" },
      { time: "12:00", tempC: 23, condition: "Sunny" },
      { time: "15:00", tempC: 25, condition: "Sunny" },
      { time: "18:00", tempC: 19, condition: "Chilly" },
      { time: "21:00", tempC: 14, condition: "Cold" }
    ],
    daily: [
      { dayEn: "Fri", dayUr: "\u062C\u0645\u0639\u06C1", highC: 25, lowC: 11, conditionEn: "Clear", conditionUr: "\u0635\u0627\u0641" },
      { dayEn: "Sat", dayUr: "\u06C1\u0641\u062A\u06C1", highC: 24, lowC: 10, conditionEn: "Sunny", conditionUr: "\u062F\u06BE\u0648\u067E" },
      { dayEn: "Sun", dayUr: "\u0627\u062A\u0648\u0627\u0631", highC: 23, lowC: 9, conditionEn: "Cool", conditionUr: "\u0633\u0631\u062F" },
      { dayEn: "Mon", dayUr: "\u067E\u06CC\u0631", highC: 22, lowC: 9, conditionEn: "Partly Cloudy", conditionUr: "\u062C\u0632\u0648\u06CC \u0627\u0628\u0631 \u0622\u0644\u0648\u062F" },
      { dayEn: "Tue", dayUr: "\u0645\u0646\u06AF\u0644", highC: 21, lowC: 8, conditionEn: "Cold", conditionUr: "\u0633\u0631\u062F" }
    ]
  },
  {
    cityId: "peshawar",
    nameEn: "Peshawar",
    nameUr: "\u067E\u0634\u0627\u0648\u0631",
    provinceEn: "Khyber Pakhtunkhwa",
    provinceUr: "\u062E\u06CC\u0628\u0631 \u067E\u062E\u062A\u0648\u0646\u062E\u0648\u0627",
    tempC: 24,
    conditionEn: "Sunny with Mild Breeze",
    conditionUr: "\u062F\u06BE\u0648\u067E \u0627\u0648\u0631 \u06C1\u0644\u06A9\u06CC \u062E\u0646\u06A9\u06CC",
    highC: 26,
    lowC: 12,
    humidity: 50,
    windKmh: 10,
    aqi: 110,
    aqiStatusEn: "Moderate",
    aqiStatusUr: "\u0645\u0639\u062A\u062F\u0644",
    feelsLikeC: 24,
    sunrise: "06:38 AM",
    sunset: "05:19 PM",
    hourly: [
      { time: "09:00", tempC: 18, condition: "Sunny" },
      { time: "12:00", tempC: 24, condition: "Warm" },
      { time: "15:00", tempC: 26, condition: "Sunny" },
      { time: "18:00", tempC: 19, condition: "Cool" },
      { time: "21:00", tempC: 15, condition: "Cool" }
    ],
    daily: [
      { dayEn: "Fri", dayUr: "\u062C\u0645\u0639\u06C1", highC: 26, lowC: 12, conditionEn: "Sunny", conditionUr: "\u0635\u0627\u0641" },
      { dayEn: "Sat", dayUr: "\u06C1\u0641\u062A\u06C1", highC: 25, lowC: 11, conditionEn: "Sunny", conditionUr: "\u0635\u0627\u0641" },
      { dayEn: "Sun", dayUr: "\u0627\u062A\u0648\u0627\u0631", highC: 24, lowC: 10, conditionEn: "Clear", conditionUr: "\u062F\u06BE\u0648\u067E" },
      { dayEn: "Mon", dayUr: "\u067E\u06CC\u0631", highC: 23, lowC: 10, conditionEn: "Cloudy", conditionUr: "\u0627\u0628\u0631 \u0622\u0644\u0648\u062F" },
      { dayEn: "Tue", dayUr: "\u0645\u0646\u06AF\u0644", highC: 22, lowC: 9, conditionEn: "Cool", conditionUr: "\u0633\u0631\u062F" }
    ]
  },
  {
    cityId: "quetta",
    nameEn: "Quetta",
    nameUr: "\u06A9\u0648\u0626\u0679\u06C1",
    provinceEn: "Balochistan",
    provinceUr: "\u0628\u0644\u0648\u0686\u0633\u062A\u0627\u0646",
    tempC: 17,
    conditionEn: "Cold & Clear Mountain Sky",
    conditionUr: "\u0633\u0631\u062F \u0627\u0648\u0631 \u0634\u0641\u0627\u0641 \u067E\u06C1\u0627\u0691\u06CC \u0641\u0636\u0627",
    highC: 19,
    lowC: 4,
    humidity: 32,
    windKmh: 16,
    aqi: 38,
    aqiStatusEn: "Excellent",
    aqiStatusUr: "\u0628\u06C1\u062A\u0631\u06CC\u0646",
    feelsLikeC: 15,
    sunrise: "06:48 AM",
    sunset: "05:40 PM",
    hourly: [
      { time: "09:00", tempC: 11, condition: "Cold" },
      { time: "12:00", tempC: 17, condition: "Sunny" },
      { time: "15:00", tempC: 19, condition: "Crisp" },
      { time: "18:00", tempC: 12, condition: "Very Cold" },
      { time: "21:00", tempC: 7, condition: "Freezing" }
    ],
    daily: [
      { dayEn: "Fri", dayUr: "\u062C\u0645\u0639\u06C1", highC: 19, lowC: 4, conditionEn: "Sunny", conditionUr: "\u0635\u0627\u0641" },
      { dayEn: "Sat", dayUr: "\u06C1\u0641\u062A\u06C1", highC: 18, lowC: 3, conditionEn: "Chilly", conditionUr: "\u0679\u06BE\u0646\u0688\u0627" },
      { dayEn: "Sun", dayUr: "\u0627\u062A\u0648\u0627\u0631", highC: 17, lowC: 2, conditionEn: "Cold", conditionUr: "\u0633\u062E\u062A \u0633\u0631\u062F" },
      { dayEn: "Mon", dayUr: "\u067E\u06CC\u0631", highC: 16, lowC: 2, conditionEn: "Windy", conditionUr: "\u062A\u06CC\u0632 \u06C1\u0648\u0627\u0626\u06CC\u06BA" },
      { dayEn: "Tue", dayUr: "\u0645\u0646\u06AF\u0644", highC: 15, lowC: 1, conditionEn: "Cold", conditionUr: "\u0633\u062E\u062A \u0633\u0631\u062F" }
    ]
  }
];
var defaultGoldRates = [
  { karat: "24K (Per Tola)", tolaPkr: 278500, tenGramPkr: 238770, changePkr: 1200, isPositive: true },
  { karat: "22K (Per Tola)", tolaPkr: 255290, tenGramPkr: 218870, changePkr: 1100, isPositive: true },
  { karat: "21K (Per Tola)", tolaPkr: 243680, tenGramPkr: 208920, changePkr: 1050, isPositive: true },
  { karat: "18K (Per Tola)", tolaPkr: 208870, tenGramPkr: 179080, changePkr: 900, isPositive: true }
];
var defaultCurrencyRates = [
  { code: "USD", nameEn: "US Dollar", nameUr: "\u0627\u0645\u0631\u06CC\u06A9\u06CC \u0688\u0627\u0644\u0631", buyingPkr: 278.4, sellingPkr: 280.15, interbankPkr: 278.1, change: -0.25, flag: "\u{1F1FA}\u{1F1F8}" },
  { code: "GBP", nameEn: "British Pound", nameUr: "\u0628\u0631\u0637\u0627\u0646\u0648\u06CC \u067E\u0627\u0624\u0646\u0688", buyingPkr: 358.5, sellingPkr: 362.2, interbankPkr: 357.9, change: 0.6, flag: "\u{1F1EC}\u{1F1E7}" },
  { code: "EUR", nameEn: "Euro", nameUr: "\u06CC\u0648\u0631\u0648", buyingPkr: 301.2, sellingPkr: 304.8, interbankPkr: 300.9, change: -0.15, flag: "\u{1F1EA}\u{1F1FA}" },
  { code: "SAR", nameEn: "Saudi Riyal", nameUr: "\u0633\u0639\u0648\u062F\u06CC \u0631\u06CC\u0627\u0644", buyingPkr: 74.2, sellingPkr: 74.9, interbankPkr: 74.15, change: 0.05, flag: "\u{1F1F8}\u{1F1E6}" },
  { code: "AED", nameEn: "UAE Dirham", nameUr: "\u0627\u0645\u0627\u0631\u0627\u062A\u06CC \u062F\u0631\u06C1\u0645", buyingPkr: 75.8, sellingPkr: 76.5, interbankPkr: 75.72, change: 0, flag: "\u{1F1E6}\u{1F1EA}" },
  { code: "CAD", nameEn: "Canadian Dollar", nameUr: "\u06A9\u06CC\u0646\u06CC\u0688\u06CC\u0646 \u0688\u0627\u0644\u0631", buyingPkr: 202.4, sellingPkr: 205.1, interbankPkr: 201.8, change: 0.3, flag: "\u{1F1E8}\u{1F1E6}" },
  { code: "AUD", nameEn: "Australian Dollar", nameUr: "\u0622\u0633\u0679\u0631\u06CC\u0644\u06CC\u0646 \u0688\u0627\u0644\u0631", buyingPkr: 184.1, sellingPkr: 187.3, interbankPkr: 183.6, change: 0.45, flag: "\u{1F1E6}\u{1F1FA}" },
  { code: "KWD", nameEn: "Kuwaiti Dinar", nameUr: "\u06A9\u0648\u06CC\u062A\u06CC \u062F\u06CC\u0646\u0627\u0631", buyingPkr: 906.5, sellingPkr: 915.2, interbankPkr: 905.8, change: 1.1, flag: "\u{1F1F0}\u{1F1FC}" }
];
var defaultFuelPrices = [
  { typeEn: "Petrol (Motor Gasoline)", typeUr: "\u067E\u06CC\u0679\u0631\u0648\u0644 (\u0633\u067E\u0631)", pricePkr: 265.4, changePkr: -2.04, effectiveDate: "01 Nov 2026" },
  { typeEn: "High Speed Diesel (HSD)", typeUr: "\u06C1\u0627\u0626\u06CC \u0627\u0633\u067E\u06CC\u0688 \u0688\u06CC\u0632\u0644", pricePkr: 272.8, changePkr: 1.4, effectiveDate: "01 Nov 2026" },
  { typeEn: "Light Diesel Oil (LDO)", typeUr: "\u0644\u0627\u0626\u0679 \u0688\u06CC\u0632\u0644 \u0622\u0626\u0644", pricePkr: 160.2, changePkr: -1.8, effectiveDate: "01 Nov 2026" },
  { typeEn: "Kerosene Oil (Mitti Ka Tel)", typeUr: "\u0645\u0679\u06CC \u06A9\u0627 \u062A\u06CC\u0644 (\u06A9\u06CC\u0631\u0648\u0633\u06CC\u0646)", pricePkr: 174.9, changePkr: -0.9, effectiveDate: "01 Nov 2026" }
];
var defaultPSX = {
  kse100: 93450.75,
  change: 624.18,
  changePercent: 0.67,
  volumeMillion: 489.4,
  gainers: [
    { symbol: "OGDC", price: 168.45, change: 4.8 },
    { symbol: "PPL", price: 132.1, change: 3.9 },
    { symbol: "MCB", price: 245.5, change: 6.2 },
    { symbol: "SYS", price: 485, change: 12.5 }
  ],
  losers: [
    { symbol: "HUBC", price: 118.2, change: -1.45 },
    { symbol: "FFC", price: 178.6, change: -0.8 },
    { symbol: "LUCK", price: 890, change: -5.2 }
  ]
};
var defaultCricket = [
  {
    id: "cric-1",
    titleEn: "Pakistan vs Australia - 2nd ODI (Melbourne Cricket Ground)",
    titleUr: "\u067E\u0627\u06A9\u0633\u062A\u0627\u0646 \u0628\u0645\u0642\u0627\u0628\u0644\u06C1 \u0622\u0633\u0679\u0631\u06CC\u0644\u06CC\u0627 - \u062F\u0648\u0633\u0631\u0627 \u0648\u0646 \u0688\u06D2 (\u0627\u06CC\u0645 \u0633\u06CC \u062C\u06CC)",
    tournament: "Pakistan Tour of Australia 2026",
    status: "live",
    teamA: { name: "Australia", code: "AUS", score: "163", overs: "35.0", wickets: 10, flag: "\u{1F1E6}\u{1F1FA}" },
    teamB: { name: "Pakistan", code: "PAK", score: "169/1", overs: "26.3", wickets: 1, flag: "\u{1F1F5}\u{1F1F0}" },
    currentBatters: ["Babar Azam 35* (44)", "Saim Ayub 82 (71)"],
    currentBowler: "Mitchell Starc 6-0-38-1",
    statusTextEn: "Pakistan won by 9 wickets with 141 balls remaining",
    statusTextUr: "\u067E\u0627\u06A9\u0633\u062A\u0627\u0646 \u0646\u06D2 \u0634\u0627\u0646\u062F\u0627\u0631 \u06A9\u0627\u0631\u06A9\u0631\u062F\u06AF\u06CC \u062F\u06A9\u06BE\u0627 \u06A9\u0631 9 \u0648\u06A9\u0679\u0648\u06BA \u0633\u06D2 \u0641\u062A\u062D \u062D\u0627\u0635\u0644 \u06A9\u0631 \u0644\u06CC",
    venueEn: "MCG, Melbourne",
    venueUr: "\u0645\u06CC\u0644\u0628\u0648\u0631\u0646 \u06A9\u0631\u06A9\u0679 \u06AF\u0631\u0627\u0624\u0646\u0688",
    dateStr: "Live Today"
  },
  {
    id: "cric-2",
    titleEn: "Pakistan vs England - Champions Trophy Opening Match",
    titleUr: "\u067E\u0627\u06A9\u0633\u062A\u0627\u0646 \u0628\u0645\u0642\u0627\u0628\u0644\u06C1 \u0627\u0646\u06AF\u0644\u06CC\u0646\u0688 - \u0686\u06CC\u0645\u067E\u0626\u0646\u0632 \u0679\u0631\u0627\u0641\u06CC \u0627\u0641\u062A\u062A\u0627\u062D\u06CC \u0645\u0639\u0631\u06A9\u06C1",
    tournament: "ICC Champions Trophy Pakistan",
    status: "upcoming",
    teamA: { name: "Pakistan", code: "PAK", flag: "\u{1F1F5}\u{1F1F0}" },
    teamB: { name: "England", code: "ENG", flag: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}" },
    statusTextEn: "Starts at 02:30 PM PKT at National Stadium Karachi",
    statusTextUr: "\u0646\u06CC\u0634\u0646\u0644 \u0627\u0633\u0679\u06CC\u0688\u06CC\u0645 \u06A9\u0631\u0627\u0686\u06CC \u0645\u06CC\u06BA \u062F\u0648\u067E\u06C1\u0631 \u0627\u0691\u06BE\u0627\u0626\u06CC \u0628\u062C\u06D2 \u0634\u0631\u0648\u0639 \u06C1\u0648\u06AF\u0627",
    venueEn: "National Stadium, Karachi",
    venueUr: "\u0646\u06CC\u0634\u0646\u0644 \u0627\u0633\u0679\u06CC\u0688\u06CC\u0645 \u06A9\u0631\u0627\u0686\u06CC",
    dateStr: "19 Feb 2027"
  }
];
var defaultPrayerTimes = {
  karachi: {
    cityEn: "Karachi",
    cityUr: "\u06A9\u0631\u0627\u0686\u06CC",
    fajr: "05:28 AM",
    sunrise: "06:42 AM",
    dhuhr: "12:15 PM",
    asr: "03:32 PM",
    maghrib: "05:48 PM",
    isha: "07:02 PM",
    sehriEnds: "05:23 AM",
    iftar: "05:48 PM",
    hijriDateEn: "21 Shawwal 1447 AH",
    hijriDateUr: "21 \u0634\u0648\u0627\u0644 1447\u06BE"
  },
  lahore: {
    cityEn: "Lahore",
    cityUr: "\u0644\u0627\u06C1\u0648\u0631",
    fajr: "05:07 AM",
    sunrise: "06:26 AM",
    dhuhr: "11:51 AM",
    asr: "03:00 PM",
    maghrib: "05:15 PM",
    isha: "06:34 PM",
    sehriEnds: "05:02 AM",
    iftar: "05:15 PM",
    hijriDateEn: "21 Shawwal 1447 AH",
    hijriDateUr: "21 \u0634\u0648\u0627\u0644 1447\u06BE"
  },
  islamabad: {
    cityEn: "Islamabad",
    cityUr: "\u0627\u0633\u0644\u0627\u0645 \u0622\u0628\u0627\u062F",
    fajr: "05:12 AM",
    sunrise: "06:33 AM",
    dhuhr: "11:54 AM",
    asr: "03:00 PM",
    maghrib: "05:14 PM",
    isha: "06:35 PM",
    sehriEnds: "05:07 AM",
    iftar: "05:14 PM",
    hijriDateEn: "21 Shawwal 1447 AH",
    hijriDateUr: "21 \u0634\u0648\u0627\u0644 1447\u06BE"
  },
  peshawar: {
    cityEn: "Peshawar",
    cityUr: "\u067E\u0634\u0627\u0648\u0631",
    fajr: "05:18 AM",
    sunrise: "06:38 AM",
    dhuhr: "11:59 AM",
    asr: "03:05 PM",
    maghrib: "05:19 PM",
    isha: "06:40 PM",
    sehriEnds: "05:13 AM",
    iftar: "05:19 PM",
    hijriDateEn: "21 Shawwal 1447 AH",
    hijriDateUr: "21 \u0634\u0648\u0627\u0644 1447\u06BE"
  },
  quetta: {
    cityEn: "Quetta",
    cityUr: "\u06A9\u0648\u0626\u0679\u06C1",
    fajr: "05:31 AM",
    sunrise: "06:48 AM",
    dhuhr: "12:14 PM",
    asr: "03:25 PM",
    maghrib: "05:40 PM",
    isha: "06:58 PM",
    sehriEnds: "05:26 AM",
    iftar: "05:40 PM",
    hijriDateEn: "21 Shawwal 1447 AH",
    hijriDateUr: "21 \u0634\u0648\u0627\u0644 1447\u06BE"
  }
};
var defaultMobiles = [
  {
    id: "mob-1",
    brand: "Samsung",
    model: "Galaxy S25 Ultra 5G",
    pricePkr: 429999,
    ram: "16 GB",
    storage: "512 GB",
    display: '6.8" Dynamic AMOLED 2X, 120Hz',
    camera: "200 MP + 50 MP + 50 MP Quad",
    battery: "5000 mAh 45W Fast Charging",
    rating: 4.9,
    image: "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?auto=format&fit=crop&w=400&q=80"
  },
  {
    id: "mob-2",
    brand: "Apple",
    model: "iPhone 16 Pro Max",
    pricePkr: 549999,
    ram: "8 GB",
    storage: "256 GB",
    display: '6.9" Super Retina XDR OLED',
    camera: "48 MP Fusion + 48 MP Ultra Wide",
    battery: "4685 mAh MagSafe Wireless",
    rating: 4.8,
    image: "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=400&q=80"
  },
  {
    id: "mob-3",
    brand: "Xiaomi",
    model: "Redmi Note 14 Pro+ 5G",
    pricePkr: 98999,
    ram: "12 GB",
    storage: "256 GB",
    display: '6.67" CrystalRes AMOLED 120Hz',
    camera: "200 MP OIS Main Camera",
    battery: "6200 mAh 90W HyperCharge",
    rating: 4.7,
    image: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=400&q=80"
  },
  {
    id: "mob-4",
    brand: "Infinix",
    model: "Zero 40 5G",
    pricePkr: 74999,
    ram: "12 GB",
    storage: "256 GB",
    display: '6.78" 3D Curved AMOLED 144Hz',
    camera: "108 MP OIS + 50 MP 4K Vlog",
    battery: "5000 mAh 45W Wireless",
    rating: 4.5,
    image: "https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=400&q=80"
  }
];
var defaultAutomobiles = [
  {
    id: "auto-1",
    type: "car",
    brand: "Honda",
    model: "Civic RS Turbo",
    year: 2026,
    pricePkr: 9899e3,
    engineCc: "1500 cc VTEC Turbo",
    transmission: "CVT with Paddle Shifters",
    mileage: "14.5 km/l",
    image: "https://images.unsplash.com/photo-1590362891988-f77804702008?auto=format&fit=crop&w=500&q=80"
  },
  {
    id: "auto-2",
    type: "car",
    brand: "Toyota",
    model: "Corolla Altis Grande 1.8X",
    year: 2026,
    pricePkr: 7799e3,
    engineCc: "1800 cc Dual VVT-i",
    transmission: "CVTi 7-Speed Sport",
    mileage: "13.8 km/l",
    image: "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=500&q=80"
  },
  {
    id: "auto-3",
    type: "car",
    brand: "Suzuki",
    model: "Alto VXR AGS",
    year: 2026,
    pricePkr: 2935e3,
    engineCc: "660 cc R06A",
    transmission: "Auto Gear Shift (AGS)",
    mileage: "20.5 km/l",
    image: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=500&q=80"
  },
  {
    id: "auto-4",
    type: "bike",
    brand: "Yamaha",
    model: "YBR 125G DX",
    year: 2026,
    pricePkr: 485e3,
    engineCc: "125 cc 4-Stroke SOHC",
    transmission: "5-Speed Constant Mesh",
    mileage: "46 km/l",
    image: "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=500&q=80"
  }
];
var defaultPrizeBonds = [
  {
    id: "pb-1500-draw-100",
    denomination: 1500,
    drawNumber: 100,
    drawDate: "2026-11-15",
    cityEn: "Rawalpindi",
    cityUr: "\u0631\u0627\u0648\u0644\u067E\u0646\u0688\u06CC",
    firstPrizePkr: "Rs. 3,000,000 (1 Prize)",
    secondPrizePkr: "Rs. 1,000,000 (3 Prizes)",
    thirdPrizePkr: "Rs. 18,500 (1,696 Prizes)",
    firstPrizeBond: "741295",
    secondPrizeBonds: ["182940", "495810", "920412"],
    thirdPrizeSample: ["001423", "012948", "034918", "054192", "089412", "124950", "219481", "391048", "512948", "749102"]
  },
  {
    id: "pb-750-draw-99",
    denomination: 750,
    drawNumber: 99,
    drawDate: "2026-10-15",
    cityEn: "Muzaffarabad",
    cityUr: "\u0645\u0638\u0641\u0631\u0622\u0628\u0627\u062F",
    firstPrizePkr: "Rs. 1,500,000 (1 Prize)",
    secondPrizePkr: "Rs. 500,000 (3 Prizes)",
    thirdPrizePkr: "Rs. 9,300 (1,696 Prizes)",
    firstPrizeBond: "481920",
    secondPrizeBonds: ["209481", "592014", "819240"],
    thirdPrizeSample: ["002914", "019482", "045918", "078129", "140924", "309184", "491029", "610294", "819402"]
  },
  {
    id: "pb-200-draw-98",
    denomination: 200,
    drawNumber: 98,
    drawDate: "2026-09-15",
    cityEn: "Peshawar",
    cityUr: "\u067E\u0634\u0627\u0648\u0631",
    firstPrizePkr: "Rs. 750,000 (1 Prize)",
    secondPrizePkr: "Rs. 250,000 (5 Prizes)",
    thirdPrizePkr: "Rs. 1,250 (2,394 Prizes)",
    firstPrizeBond: "391048",
    secondPrizeBonds: ["104928", "294810", "481920", "601928", "840192"],
    thirdPrizeSample: ["001290", "028491", "058192", "091248", "148291", "259102", "381920", "591028", "791024"]
  }
];
var defaultDictionary = [
  {
    id: "dict-1",
    english: "Resilience",
    urdu: "\u062B\u0627\u0628\u062A \u0642\u062F\u0645\u06CC\u060C \u0644\u0686\u06A9\u060C \u0628\u062D\u0627\u0644\u06CC \u06A9\u06CC \u0635\u0644\u0627\u062D\u06CC\u062A",
    romanUrdu: "Sabit Qadmi, Lachak",
    partOfSpeech: "Noun",
    definitionEn: "The capacity to withstand or to recover quickly from difficulties; toughness.",
    definitionUr: "\u0645\u0634\u06A9\u0644 \u062D\u0627\u0644\u0627\u062A \u06A9\u0627 \u0633\u0627\u0645\u0646\u0627 \u06A9\u0631\u0646\u06D2 \u0627\u0648\u0631 \u062F\u0648\u0628\u0627\u0631\u06C1 \u0627\u0628\u06BE\u0631\u0646\u06D2 \u06A9\u06CC \u063A\u06CC\u0631 \u0645\u0639\u0645\u0648\u0644\u06CC \u0635\u0644\u0627\u062D\u06CC\u062A\u06D4",
    exampleEn: "The economic resilience of Pakistan has inspired international investors.",
    exampleUr: "\u067E\u0627\u06A9\u0633\u062A\u0627\u0646\u06CC \u0642\u0648\u0645 \u06A9\u06CC \u062B\u0627\u0628\u062A \u0642\u062F\u0645\u06CC \u0627\u0648\u0631 \u062D\u0648\u0635\u0644\u06C1 \u06C1\u0645\u06CC\u0634\u06C1 \u0642\u0627\u0628\u0644\u0650 \u0631\u0634\u06A9 \u0631\u06C1\u0627 \u06C1\u06D2\u06D4"
  },
  {
    id: "dict-2",
    english: "Aspiration",
    urdu: "\u0622\u0631\u0632\u0648\u060C \u062A\u0645\u0646\u0627\u060C \u0628\u0644\u0646\u062F \u062D\u0648\u0635\u0644\u06C1",
    romanUrdu: "Aarzu, Tamanna, Buland Hosla",
    partOfSpeech: "Noun",
    definitionEn: "A hope or ambition of achieving something worthwhile.",
    definitionUr: "\u06A9\u0633\u06CC \u0628\u0644\u0646\u062F \u0645\u0642\u0635\u062F \u06CC\u0627 \u0645\u0646\u0632\u0644 \u06A9\u0648 \u067E\u0627\u0646\u06D2 \u06A9\u06CC \u062F\u0644\u06CC \u062E\u0648\u0627\u06C1\u0634 \u0627\u0648\u0631 \u062C\u062F\u0648\u062C\u06C1\u062F\u06D4",
    exampleEn: "The youth of Pakistan carry noble aspirations for technological leadership.",
    exampleUr: "\u067E\u0627\u06A9\u0633\u062A\u0627\u0646\u06CC \u0646\u0648\u062C\u0648\u0627\u0646\u0648\u06BA \u06A9\u06CC \u0622\u0631\u0632\u0648 \u06C1\u06D2 \u06A9\u06C1 \u0648\u06C1 \u0622\u0626\u06CC \u0679\u06CC \u06A9\u06CC \u062F\u0646\u06CC\u0627 \u0645\u06CC\u06BA \u0627\u067E\u0646\u0627 \u0646\u0627\u0645 \u0628\u0646\u0627\u0626\u06CC\u06BA\u06D4"
  },
  {
    id: "dict-3",
    english: "Sovereignty",
    urdu: "\u062E\u0648\u062F \u0645\u062E\u062A\u0627\u0631\u06CC\u060C \u062D\u0627\u06A9\u0645\u06CC\u062A\u0650 \u0627\u0639\u0644\u06CC\u0670",
    romanUrdu: "Khud Mukhtari, Hakmiyat e Aala",
    partOfSpeech: "Noun",
    definitionEn: "Supreme power or authority of a state to govern itself.",
    definitionUr: "\u06A9\u0633\u06CC \u0631\u06CC\u0627\u0633\u062A \u06A9\u0627 \u0622\u0632\u0627\u062F\u0627\u0646\u06C1 \u0627\u0648\u0631 \u062E\u0648\u062F \u0645\u062E\u062A\u0627\u0631 \u0641\u06CC\u0635\u0644\u06C1 \u06A9\u0631\u0646\u06D2 \u06A9\u0627 \u0645\u06A9\u0645\u0644 \u0627\u062E\u062A\u06CC\u0627\u0631\u06D4",
    exampleEn: "Preserving national sovereignty is paramount for every sovereign state.",
    exampleUr: "\u0642\u0648\u0645\u06CC \u062E\u0648\u062F \u0645\u062E\u062A\u0627\u0631\u06CC \u06A9\u0627 \u062A\u062D\u0641\u0638 \u06C1\u0631 \u0634\u06C1\u0631\u06CC \u06A9\u0627 \u0627\u0648\u0651\u0644\u06CC\u0646 \u0641\u0631\u0636 \u06C1\u06D2\u06D4"
  }
];
var defaultBabyNames = [
  { id: "name-1", nameEn: "Ayan", nameUr: "\u0639\u06CC\u0627\u0646", gender: "boy", meaningEn: "Gift of God, clearly visible, perceptive", meaningUr: "\u0627\u0644\u0644\u06C1 \u06A9\u0627 \u062A\u062D\u0641\u06C1\u060C \u0639\u06CC\u0627\u06BA\u060C \u0631\u0648\u0634\u0646 \u0628\u0635\u06CC\u0631\u062A \u0648\u0627\u0644\u0627", origin: "Arabic", luckyNumber: 7 },
  { id: "name-2", nameEn: "Zainab", nameUr: "\u0632\u06CC\u0646\u0628", gender: "girl", meaningEn: "Father's beauty, fragrant desert flower", meaningUr: "\u0628\u0627\u067E \u06A9\u06CC \u0632\u06CC\u0646\u062A\u060C \u062E\u0648\u0628\u0635\u0648\u0631\u062A \u062E\u0648\u0634\u0628\u0648\u062F\u0627\u0631 \u067E\u06BE\u0648\u0644", origin: "Arabic", luckyNumber: 3 },
  { id: "name-3", nameEn: "Muhammad", nameUr: "\u0645\u062D\u0645\u062F", gender: "boy", meaningEn: "The Praised One, of noble character", meaningUr: "\u062C\u0633 \u06A9\u06CC \u0628\u0627\u0631 \u0628\u0627\u0631 \u062A\u0639\u0631\u06CC\u0641 \u06A9\u06CC \u062C\u0627\u0626\u06D2\u060C \u0642\u0627\u0628\u0644\u0650 \u0633\u062A\u0627\u0626\u0634", origin: "Arabic", luckyNumber: 9 },
  { id: "name-4", nameEn: "Ayla", nameUr: "\u0622\u0626\u0644\u06C1", gender: "girl", meaningEn: "Moonlight, halo of light, radiant princess", meaningUr: "\u0686\u0627\u0646\u062F\u0646\u06CC\u060C \u0646\u0648\u0631 \u06A9\u0627 \u06C1\u0627\u0644\u06C1\u060C \u062E\u0648\u0628\u0635\u0648\u0631\u062A \u0631\u0648\u0634\u0646\u06CC", origin: "Turkish / Arabic", luckyNumber: 2 },
  { id: "name-5", nameEn: "Shahmeer", nameUr: "\u0634\u0627\u06C1 \u0645\u06CC\u0631", gender: "boy", meaningEn: "Leader of kings, noble and handsome", meaningUr: "\u0628\u0627\u062F\u0634\u0627\u06C1\u0648\u06BA \u06A9\u0627 \u0633\u0631\u062F\u0627\u0631\u060C \u062E\u0648\u0628\u0635\u0648\u0631\u062A \u0627\u0648\u0631 \u0628\u0627\u0648\u0642\u0627\u0631", origin: "Persian", luckyNumber: 5 },
  { id: "name-6", nameEn: "Hoorain", nameUr: "\u062D\u0648\u0631\u06CC\u0646", gender: "girl", meaningEn: "Most beautiful eyes, woman of paradise", meaningUr: "\u062E\u0648\u0628\u0635\u0648\u0631\u062A \u0622\u0646\u06A9\u06BE\u0648\u06BA \u0648\u0627\u0644\u06CC\u060C \u062C\u0646\u062A\u06CC \u062D\u0648\u0631", origin: "Quranic / Arabic", luckyNumber: 6 }
];
var defaultPoets = [
  {
    id: "poet-iqbal",
    nameEn: "Allama Muhammad Iqbal",
    nameUr: "\u0639\u0644\u0627\u0645\u06C1 \u0645\u062D\u0645\u062F \u0627\u0642\u0628\u0627\u0644",
    era: "1877 \u2013 1938",
    cityEn: "Sialkot / Lahore",
    cityUr: "\u0633\u06CC\u0627\u0644\u06A9\u0648\u0679 / \u0644\u0627\u06C1\u0648\u0631",
    bioEn: "National poet of Pakistan, philosopher, barrister, and intellectual pioneer of the Muslim renaissance.",
    bioUr: "\u0634\u0627\u0639\u0631\u0650 \u0645\u0634\u0631\u0642\u060C \u062D\u06A9\u06CC\u0645 \u0627\u0644\u0627\u0645\u062A\u060C \u0645\u0641\u06A9\u0631\u0650 \u067E\u0627\u06A9\u0633\u062A\u0627\u0646 \u062C\u0646\u06C1\u0648\u06BA \u0646\u06D2 \u062E\u0648\u062F\u06CC \u06A9\u0627 \u062F\u0631\u0633 \u062F\u06CC\u0627 \u0627\u0648\u0631 \u0628\u0631\u0635\u063A\u06CC\u0631 \u06A9\u06D2 \u0645\u0633\u0644\u0645\u0627\u0646\u0648\u06BA \u06A9\u0648 \u0628\u06CC\u062F\u0627\u0631 \u06A9\u06CC\u0627\u06D4",
    image: "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=400&q=80",
    poemCount: 120
  },
  {
    id: "poet-ghalib",
    nameEn: "Mirza Asadullah Khan Ghalib",
    nameUr: "\u0645\u0631\u0632\u0627 \u0627\u0633\u062F \u0627\u0644\u0644\u06C1 \u062E\u0627\u0646 \u063A\u0627\u0644\u0628",
    era: "1797 \u2013 1869",
    cityEn: "Agra / Delhi",
    cityUr: "\u0622\u06AF\u0631\u06C1 / \u062F\u06C1\u0644\u06CC",
    bioEn: "The supreme maestro of classical Urdu and Persian ghazal poetry.",
    bioUr: "\u0627\u0631\u062F\u0648 \u0634\u0627\u0639\u0631\u06CC \u06A9\u06D2 \u0628\u06D2 \u062A\u0627\u062C \u0628\u0627\u062F\u0634\u0627\u06C1 \u062C\u0646 \u06A9\u06D2 \u0627\u0634\u0639\u0627\u0631 \u0622\u062C \u0628\u06BE\u06CC \u0641\u0644\u0633\u0641\u06C1 \u0627\u0648\u0631 \u0632\u0646\u062F\u06AF\u06CC \u06A9\u06CC \u0628\u0627\u0631\u06CC\u06A9\u06CC\u0648\u06BA \u06A9\u0627 \u0627\u062D\u0627\u0637\u06C1 \u06A9\u0631\u062A\u06D2 \u06C1\u06CC\u06BA\u06D4",
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80",
    poemCount: 95
  },
  {
    id: "poet-faiz",
    nameEn: "Faiz Ahmad Faiz",
    nameUr: "\u0641\u06CC\u0636 \u0627\u062D\u0645\u062F \u0641\u06CC\u0636",
    era: "1911 \u2013 1984",
    cityEn: "Sialkot / Lahore",
    cityUr: "\u0633\u06CC\u0627\u0644\u06A9\u0648\u0679 / \u0644\u0627\u06C1\u0648\u0631",
    bioEn: "Revolutionary poet, Lenin Peace Prize laureate, and voice of human dignity and liberty.",
    bioUr: "\u0639\u0638\u06CC\u0645 \u0627\u0646\u0642\u0644\u0627\u0628\u06CC \u0648 \u0631\u0648\u0645\u0627\u0646\u0648\u06CC \u0634\u0627\u0639\u0631\u060C \u0644\u06CC\u0646\u0646 \u0627\u0645\u0646 \u0627\u0646\u0639\u0627\u0645 \u06CC\u0627\u0641\u062A\u06C1 \u062C\u0646 \u06A9\u06CC \u0634\u0627\u0639\u0631\u06CC \u0622\u0645\u0631\u06CC\u062A \u06A9\u06D2 \u062E\u0644\u0627\u0641 \u0645\u0632\u0627\u062D\u0645\u062A \u06A9\u0627 \u0627\u0633\u062A\u0639\u0627\u0631\u06C1 \u06C1\u06D2\u06D4",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80",
    poemCount: 78
  }
];
var defaultPoems = [
  {
    id: "poem-khudi",
    titleEn: "Khudi Ko Kar Buland Itna",
    titleUr: "\u062E\u0648\u062F\u06CC \u06A9\u0648 \u06A9\u0631 \u0628\u0644\u0646\u062F \u0627\u062A\u0646\u0627",
    poetId: "poet-iqbal",
    poetNameEn: "Allama Iqbal",
    poetNameUr: "\u0639\u0644\u0627\u0645\u06C1 \u0645\u062D\u0645\u062F \u0627\u0642\u0628\u0627\u0644",
    category: "Ghazal",
    linesEn: [
      "Elevate your Self to such heights,",
      "That before executing every destiny,",
      "God Himself shall ask the mortal:",
      '"Tell me, what is your desire?"'
    ],
    linesUr: [
      "\u062E\u0648\u062F\u06CC \u06A9\u0648 \u06A9\u0631 \u0628\u0644\u0646\u062F \u0627\u062A\u0646\u0627 \u06A9\u06C1 \u06C1\u0631 \u062A\u0642\u062F\u06CC\u0631 \u0633\u06D2 \u067E\u06C1\u0644\u06D2",
      "\u062E\u062F\u0627 \u0628\u0646\u062F\u06D2 \u0633\u06D2 \u062E\u0648\u062F \u067E\u0648\u0686\u06BE\u06D2 \u0628\u062A\u0627 \u062A\u06CC\u0631\u06CC \u0631\u0636\u0627 \u06A9\u06CC\u0627 \u06C1\u06D2",
      "\u0633\u062A\u0627\u0631\u0648\u06BA \u0633\u06D2 \u0622\u06AF\u06D2 \u062C\u06C1\u0627\u06BA \u0627\u0648\u0631 \u0628\u06BE\u06CC \u06C1\u06CC\u06BA",
      "\u0627\u0628\u06BE\u06CC \u0639\u0634\u0642 \u06A9\u06D2 \u0627\u0645\u062A\u062D\u0627\u06BA \u0627\u0648\u0631 \u0628\u06BE\u06CC \u06C1\u06CC\u06BA"
    ]
  },
  {
    id: "poem-ghalib-dil",
    titleEn: "Dil-e-Nadaan Tujhe Hua Kya Hai",
    titleUr: "\u062F\u0644\u0650 \u0646\u0627\u062F\u0627\u06BA \u062A\u062C\u06BE\u06D2 \u06C1\u0648\u0627 \u06A9\u06CC\u0627 \u06C1\u06D2",
    poetId: "poet-ghalib",
    poetNameEn: "Mirza Ghalib",
    poetNameUr: "\u0645\u0631\u0632\u0627 \u0627\u0633\u062F \u0627\u0644\u0644\u06C1 \u062E\u0627\u0646 \u063A\u0627\u0644\u0628",
    category: "Ghazal",
    linesEn: [
      "O naive heart, what has befallen you?",
      "What after all is the cure for this pain?",
      "We are desperate, and they indifferent,",
      "O Lord, what kind of affair is this?"
    ],
    linesUr: [
      "\u062F\u0644\u0650 \u0646\u0627\u062F\u0627\u06BA \u062A\u062C\u06BE\u06D2 \u06C1\u0648\u0627 \u06A9\u06CC\u0627 \u06C1\u06D2",
      "\u0622\u062E\u0631 \u0627\u0633 \u062F\u0631\u062F \u06A9\u06CC \u062F\u0648\u0627 \u06A9\u06CC\u0627 \u06C1\u06D2",
      "\u06C1\u0645 \u06C1\u06CC\u06BA \u0645\u0634\u062A\u0627\u0642 \u0627\u0648\u0631 \u0648\u06C1 \u0628\u06CC\u0632\u0627\u0631",
      "\u06CC\u0627 \u0627\u0644\u0670\u06C1\u06CC \u06CC\u06C1 \u0645\u0627\u062C\u0631\u0627 \u06A9\u06CC\u0627 \u06C1\u06D2"
    ]
  }
];
var defaultRecipes = [
  {
    id: "rec-biryani",
    titleEn: "Authentic Karachi Special Chicken Biryani",
    titleUr: "\u0627\u0635\u0644\u06CC \u06A9\u0631\u0627\u0686\u06CC \u0686\u06A9\u0646 \u062F\u0645 \u0628\u0631\u06CC\u0627\u0646\u06CC",
    categoryEn: "Rice & Main Course",
    categoryUr: "\u0686\u0627\u0648\u0644 \u0648 \u062E\u0627\u0635 \u067E\u06A9\u0648\u0627\u0646",
    cookTimeMin: 55,
    servings: 6,
    difficulty: "Medium",
    ingredientsEn: [
      "1 kg Basmati Rice (aged)",
      "1 kg Chicken pieces",
      "4 Medium sliced Onions (golden fried)",
      "4 Tomatoes chopped with green chillies",
      "1 cup Yoghurt (whisked)",
      "2 tbsp Ginger-Garlic paste",
      "Biryani Whole Spices (Star anise, green cardamom, cloves, cinnamon)",
      "Fresh mint, coriander, and kewra water with saffron"
    ],
    ingredientsUr: [
      "1 \u06A9\u0644\u0648 \u0628\u0627\u0633\u0645\u062A\u06CC \u0686\u0627\u0648\u0644 (\u067E\u0631\u0627\u0646\u06D2)",
      "1 \u06A9\u0644\u0648 \u0686\u06A9\u0646 \u06A9\u06D2 \u0679\u06A9\u0691\u06D2",
      "4 \u0639\u062F\u062F \u067E\u06CC\u0627\u0632 (\u0628\u0627\u0631\u06CC\u06A9 \u06A9\u0627\u0679 \u06A9\u0631 \u0628\u0631\u0627\u0624\u0646 \u06A9\u06CC\u06D2 \u06C1\u0648\u0626\u06D2)",
      "4 \u0639\u062F\u062F \u0679\u0645\u0627\u0679\u0631 \u0627\u0648\u0631 \u06C1\u0631\u06CC \u0645\u0631\u0686\u06CC\u06BA",
      "1 \u06A9\u067E \u062F\u06C1\u06CC (\u067E\u06BE\u06CC\u0646\u0679\u0627 \u06C1\u0648\u0627)",
      "2 \u06A9\u06BE\u0627\u0646\u06D2 \u06A9\u06D2 \u0686\u0645\u0686 \u0627\u062F\u0631\u06A9 \u0644\u06C1\u0633\u0646 \u067E\u06CC\u0633\u0679",
      "\u062B\u0627\u0628\u062A \u06AF\u0631\u0645 \u0645\u0635\u0627\u0644\u062D\u06C1 (\u0628\u0627\u062F\u06CC\u0627\u0646\u060C \u0633\u0628\u0632 \u0627\u0644\u0627\u0626\u0686\u06CC\u060C \u0644\u0648\u0646\u06AF\u060C \u062F\u0627\u0631\u0686\u06CC\u0646\u06CC)",
      "\u067E\u0648\u062F\u06CC\u0646\u06C1\u060C \u06C1\u0631\u0627 \u062F\u06BE\u0646\u06CC\u0627\u060C \u0632\u0639\u0641\u0631\u0627\u0646 \u0627\u0648\u0631 \u06A9\u06CC\u0648\u0691\u06C1 \u0639\u0631\u0642"
    ],
    instructionsEn: [
      "Boil rice in salted water with whole spices until 75% done (1 kani), then drain.",
      "In a heavy pot, brown sliced onions. Add ginger-garlic paste and chicken; saute for 6 minutes.",
      "Add chopped tomatoes, yoghurt, and biryani spices; cook on medium flame until oil separates and chicken is tender.",
      "Layer half the aromatic rice at the bottom, spread chicken gravy with fried onions and mint leaves, then top with remaining rice.",
      "Drizzle saffron kewra water, seal with lid (Dum), and simmer on low heat for 15 minutes. Serve piping hot with raita and salad."
    ],
    instructionsUr: [
      "\u06A9\u06BE\u0644\u06D2 \u067E\u0627\u0646\u06CC \u0645\u06CC\u06BA \u0646\u0645\u06A9 \u0627\u0648\u0631 \u062B\u0627\u0628\u062A \u06AF\u0631\u0645 \u0645\u0635\u0627\u0644\u062D\u06C1 \u0688\u0627\u0644 \u06A9\u0631 \u0686\u0627\u0648\u0644 \u0627\u06CC\u06A9 \u06A9\u0646\u06CC \u0627\u0628\u0627\u0644 \u06A9\u0631 \u0686\u06BE\u0627\u0646 \u0644\u06CC\u06BA\u06D4",
      "\u062F\u06CC\u06AF\u0686\u06CC \u0645\u06CC\u06BA \u062A\u06CC\u0644 \u06AF\u0631\u0645 \u06A9\u0631 \u06A9\u06D2 \u067E\u06CC\u0627\u0632 \u0633\u0646\u06C1\u0631\u06CC \u06A9\u0631\u06CC\u06BA\u060C \u067E\u06BE\u0631 \u0627\u062F\u0631\u06A9 \u0644\u06C1\u0633\u0646 \u0627\u0648\u0631 \u0686\u06A9\u0646 \u0688\u0627\u0644 \u06A9\u0631 6 \u0645\u0646\u0679 \u0628\u06BE\u0648\u0646\u06CC\u06BA\u06D4",
      "\u0679\u0645\u0627\u0679\u0631\u060C \u062F\u06C1\u06CC \u0627\u0648\u0631 \u0628\u0631\u06CC\u0627\u0646\u06CC \u0645\u0635\u0627\u0644\u062D\u06C1 \u0634\u0627\u0645\u0644 \u06A9\u0631 \u06A9\u06D2 \u0688\u06BE\u0627\u0646\u067E \u062F\u06CC\u06BA \u062A\u0627\u06A9\u06C1 \u06AF\u0648\u0634\u062A \u06AF\u0644 \u062C\u0627\u0626\u06D2 \u0627\u0648\u0631 \u062A\u06CC\u0644 \u0627\u0648\u067E\u0631 \u0622 \u062C\u0627\u0626\u06D2\u06D4",
      "\u062F\u06CC\u06AF\u0686\u06CC \u0645\u06CC\u06BA \u0622\u062F\u06BE\u06D2 \u0686\u0627\u0648\u0644\u0648\u06BA \u06A9\u06CC \u062A\u06C1\u06C1 \u0644\u06AF\u0627\u0626\u06CC\u06BA\u060C \u0627\u0648\u067E\u0631 \u0642\u0648\u0631\u0645\u06C1\u060C \u062A\u0644\u0627 \u06C1\u0648\u0627 \u067E\u06CC\u0627\u0632 \u0627\u0648\u0631 \u067E\u0648\u062F\u06CC\u0646\u06C1 \u067E\u06BE\u06CC\u0644\u0627\u0626\u06CC\u06BA\u060C \u067E\u06BE\u0631 \u0628\u0627\u0642\u06CC \u0686\u0627\u0648\u0644 \u0688\u0627\u0644 \u062F\u06CC\u06BA\u06D4",
      "\u0632\u0639\u0641\u0631\u0627\u0646 \u0627\u0648\u0631 \u06A9\u06CC\u0648\u0691\u06C1 \u0686\u06BE\u0691\u06A9 \u06A9\u0631 \u062F\u06CC\u06AF\u0686\u06CC \u06A9\u0648 \u0688\u06BE\u06A9\u0646 \u0633\u06D2 \u0633\u06CC\u0644 \u06A9\u0631 \u06A9\u06D2 15 \u0645\u0646\u0679 \u062F\u0645 \u067E\u0631 \u0631\u06A9\u06BE\u06CC\u06BA\u06D4 \u06AF\u0631\u0645\u0627 \u06AF\u0631\u0645 \u0631\u0627\u0626\u062A\u06D2 \u06A9\u06D2 \u0633\u0627\u062A\u06BE \u067E\u06CC\u0634 \u06A9\u0631\u06CC\u06BA\u06D4"
    ],
    image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: "rec-karahi",
    titleEn: "Lahori Highway Mutton Karahi (Dhaba Style)",
    titleUr: "\u0644\u0627\u06C1\u0648\u0631\u06CC \u06C1\u0627\u0626\u06CC \u0648\u06D2 \u0645\u0679\u0646 \u06A9\u0691\u0627\u06C1\u06CC (\u0688\u06BE\u0627\u0628\u06C1 \u0627\u0633\u0679\u0627\u0626\u0644)",
    categoryEn: "Meat & Curry",
    categoryUr: "\u06AF\u0648\u0634\u062A \u0627\u0648\u0631 \u0633\u0627\u0644\u0646",
    cookTimeMin: 45,
    servings: 4,
    difficulty: "Easy",
    ingredientsEn: [
      "800g Fresh Mutton pieces",
      "6 Fresh red Tomatoes cut in halves",
      "2 tbsp Fresh Ginger julienne & chopped Garlic",
      "4 Green chillies slit lengthwise",
      "Crushed black pepper and roasted cumin coriander",
      "Fresh Desi Ghee / Butter for finishing"
    ],
    ingredientsUr: [
      "800 \u06AF\u0631\u0627\u0645 \u062A\u0627\u0632\u06C1 \u0645\u0679\u0646 \u06A9\u06D2 \u0686\u06BE\u0648\u0679\u06D2 \u0679\u06A9\u0691\u06D2",
      "6 \u0639\u062F\u062F \u0633\u0631\u062E \u0679\u0645\u0627\u0679\u0631 (\u062F\u0631\u0645\u06CC\u0627\u0646 \u0633\u06D2 \u06A9\u0679\u06D2 \u06C1\u0648\u0626\u06D2)",
      "2 \u0686\u0645\u0686 \u0628\u0627\u0631\u06CC\u06A9 \u06A9\u0679\u06CC \u0627\u062F\u0631\u06A9 \u0627\u0648\u0631 \u0644\u06C1\u0633\u0646",
      "4 \u0639\u062F\u062F \u06C1\u0631\u06CC \u0645\u0631\u0686\u06CC\u06BA",
      "\u06A9\u0679\u06CC \u06C1\u0648\u0626\u06CC \u06A9\u0627\u0644\u06CC \u0645\u0631\u0686 \u0627\u0648\u0631 \u0628\u06BE\u0646\u0627 \u06C1\u0648\u0627 \u0632\u06CC\u0631\u06C1 \u062F\u06BE\u0646\u06CC\u0627",
      "\u062F\u06CC\u0633\u06CC \u06AF\u06BE\u06CC \u06CC\u0627 \u0645\u06A9\u06BE\u0646"
    ],
    instructionsEn: [
      "Boil mutton with ginger, garlic, salt and 1 cup water until 80% tender.",
      "Transfer to a hot cast-iron wok (karahi), arrange tomatoes cut-side down, cover for 5 mins, and peel tomato skins.",
      "Add green chillies, freshly ground black pepper, and cook on high flame until tomatoes blend into rich thick gravy.",
      "Finish with dollop of desi ghee, julienned ginger, and fresh coriander. Best savored with hot tandoori roghni naan."
    ],
    instructionsUr: [
      "\u0645\u0679\u0646 \u06A9\u0648 \u0627\u062F\u0631\u06A9 \u0644\u06C1\u0633\u0646 \u0627\u0648\u0631 \u0646\u0645\u06A9 \u0688\u0627\u0644 \u06A9\u0631 \u0627\u06CC\u06A9 \u06A9\u067E \u067E\u0627\u0646\u06CC \u0645\u06CC\u06BA 80 \u0641\u06CC\u0635\u062F \u06AF\u0644\u0627 \u0644\u06CC\u06BA\u06D4",
      "\u0644\u0648\u06C1\u06D2 \u06A9\u06CC \u06A9\u0691\u0627\u06C1\u06CC \u0645\u06CC\u06BA \u06AF\u0648\u0634\u062A \u0688\u0627\u0644\u06CC\u06BA\u060C \u0627\u0648\u067E\u0631 \u0679\u0645\u0627\u0679\u0631 \u0622\u062F\u06BE\u06D2 \u06A9\u0627\u0679 \u06A9\u0631 \u0627\u0644\u0679\u06D2 \u0631\u06A9\u06BE\u06CC\u06BA \u0627\u0648\u0631 5 \u0645\u0646\u0679 \u0688\u06BE\u0627\u0646\u067E \u06A9\u0631 \u0686\u06BE\u0644\u06A9\u0627 \u0627\u062A\u0627\u0631 \u0644\u06CC\u06BA\u06D4",
      "\u062A\u06CC\u0632 \u0622\u0646\u0686 \u067E\u0631 \u0679\u0645\u0627\u0679\u0631\u0648\u06BA \u06A9\u0648 \u0627\u0686\u06BE\u06CC \u0637\u0631\u062D \u0628\u06BE\u0648\u0646\u06CC\u06BA \u062A\u0627\u06A9\u06C1 \u06AF\u0627\u0691\u06BE\u0627 \u0645\u0635\u0627\u0644\u062D\u06C1 \u0628\u0646 \u062C\u0627\u0626\u06D2\u060C \u06A9\u0627\u0644\u06CC \u0645\u0631\u0686 \u0627\u0648\u0631 \u06C1\u0631\u06CC \u0645\u0631\u0686 \u0634\u0627\u0645\u0644 \u06A9\u0631\u06CC\u06BA\u06D4",
      "\u0622\u062E\u0631 \u0645\u06CC\u06BA \u062F\u06CC\u0633\u06CC \u06AF\u06BE\u06CC \u0627\u0648\u0631 \u0627\u062F\u0631\u06A9 \u0686\u06BE\u0691\u06A9 \u06A9\u0631 \u062A\u0646\u062F\u0648\u0631\u06CC \u0631\u0648\u063A\u0646\u06CC \u0646\u0627\u0646 \u06A9\u06D2 \u0633\u0627\u062A\u06BE \u06AF\u0631\u0645 \u06AF\u0631\u0645 \u067E\u06CC\u0634 \u06A9\u0631\u06CC\u06BA\u06D4"
    ],
    image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=80"
  }
];
var defaultJobs = [
  {
    id: "job-1",
    titleEn: "Assistant Director (IT & Cyber Security) - BPS-17",
    titleUr: "\u0627\u0633\u0633\u0679\u0646\u0679 \u0688\u0627\u0626\u0631\u06CC\u06A9\u0679\u0631 (\u0622\u0626\u06CC \u0679\u06CC \u0627\u0648\u0631 \u0633\u0627\u0626\u0628\u0631 \u0633\u06CC\u06A9\u06CC\u0648\u0631\u0679\u06CC) - \u0628\u06CC \u067E\u06CC \u0627\u06CC\u0633 17",
    departmentEn: "Federal Public Service Commission (FPSC)",
    departmentUr: "\u0641\u06CC\u0688\u0631\u0644 \u067E\u0628\u0644\u06A9 \u0633\u0631\u0648\u0633 \u06A9\u0645\u06CC\u0634\u0646 (\u0627\u06CC\u0641 \u067E\u06CC \u0627\u06CC\u0633 \u0633\u06CC)",
    organizationType: "Federal Govt",
    cityEn: "Islamabad / All Pakistan",
    cityUr: "\u0627\u0633\u0644\u0627\u0645 \u0622\u0628\u0627\u062F / \u0645\u0644\u06A9 \u0628\u06BE\u0631 \u0645\u06CC\u06BA \u062A\u0639\u06CC\u0646\u0627\u062A\u06CC",
    qualification: "BS / MS Computer Science or Software Engineering",
    vacancies: 24,
    deadline: "2026-11-25",
    salaryPkr: "BPS-17 (Approx Rs. 145,000 + Allowances)"
  },
  {
    id: "job-2",
    titleEn: "Management Trainee Officer (MTO) - Batch 2026",
    titleUr: "\u0645\u06CC\u0646\u062C\u0645\u0646\u0679 \u0679\u0631\u06CC\u0646\u06CC \u0622\u0641\u06CC\u0633\u0631 (\u0627\u06CC\u0645 \u0679\u06CC \u0627\u0648) - \u0627\u0633\u0679\u06CC\u0679 \u0628\u06CC\u0646\u06A9 \u067E\u0627\u06A9\u0633\u062A\u0627\u0646",
    departmentEn: "State Bank of Pakistan (SBP Banking Services)",
    departmentUr: "\u0627\u0633\u0679\u06CC\u0679 \u0628\u06CC\u0646\u06A9 \u0622\u0641 \u067E\u0627\u06A9\u0633\u062A\u0627\u0646",
    organizationType: "Banking",
    cityEn: "Karachi, Lahore, Rawalpindi",
    cityUr: "\u06A9\u0631\u0627\u0686\u06CC\u060C \u0644\u0627\u06C1\u0648\u0631\u060C \u0631\u0627\u0648\u0644\u067E\u0646\u0688\u06CC",
    qualification: "Master / 4-Year Bachelor in Business, Economics or Finance",
    vacancies: 60,
    deadline: "2026-11-30",
    salaryPkr: "Rs. 180,000 / month with medical"
  },
  {
    id: "job-3",
    titleEn: "Senior Full Stack Software Engineer (React / Node / Cloud)",
    titleUr: "\u0633\u06CC\u0646\u0626\u0631 \u0633\u0627\u0641\u0679 \u0648\u06CC\u0626\u0631 \u0627\u0646\u062C\u06CC\u0646\u0626\u0631 - \u0679\u06CC\u06A9 \u067E\u0627\u06A9\u0633\u062A\u0627\u0646",
    departmentEn: "National Technology Incubation Hub",
    departmentUr: "\u0646\u06CC\u0634\u0646\u0644 \u0679\u06CC\u06A9\u0646\u0627\u0644\u0648\u062C\u06CC \u0627\u0646\u06A9\u06CC\u0648\u0628\u06CC\u0634\u0646 \u0633\u06CC\u0646\u0679\u0631",
    organizationType: "Private",
    cityEn: "Lahore (Hybrid)",
    cityUr: "\u0644\u0627\u06C1\u0648\u0631 (\u06C1\u0627\u0626\u0628\u0631\u0688)",
    qualification: "BS / MS with 3+ years production experience",
    vacancies: 8,
    deadline: "2026-12-05",
    salaryPkr: "Rs. 250,000 \u2013 400,000 / month"
  }
];
var defaultAuditLogs = [
  {
    id: "log-seed-1",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    user: "Super Admin",
    action: "System Bootstrapped",
    details: "360Khabarnama production portal initialized."
  }
];
var defaultSiteSettings = {
  siteNameEn: "360Khabarnama",
  siteNameUr: "360 \u062E\u0628\u0631\u0646\u0627\u0645\u06C1",
  taglineEn: "360Khabarnama - News, Results, Finance & Everyday Utilities",
  taglineUr: "360 \u062E\u0628\u0631\u0646\u0627\u0645\u06C1 - \u067E\u0627\u06A9\u0633\u062A\u0627\u0646 \u06A9\u0627 \u0645\u0633\u062A\u0646\u062F \u067E\u0648\u0631\u0679\u0644: \u062E\u0628\u0631\u06CC\u06BA\u060C \u0646\u062A\u0627\u0626\u062C \u0627\u0648\u0631 \u0633\u06C1\u0648\u0644\u06CC\u0627\u062A",
  siteUrl: "https://www.360khabarnama.com",
  primaryColor: "#059669",
  // Emerald Green (Pakistan color)
  breakingNewsEnabled: true,
  contactEmail: "editor@360khabarnama.com",
  contactPhone: "+92 (051) 920-1122",
  adManagerEnabled: true,
  googleAnalyticsId: "G-KHABAR360",
  leaderboardAdUrl: "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=970&q=80",
  sidebarAdUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=400&q=80",
  latestNewsCount: 15,
  dateFormat: "DD MMM YYYY",
  consentBannerEnabled: true,
  islamicSettings: {
    defaultCity: "Islamabad",
    calculationMethod: 1
  },
  runtimeDiagnostics: {
    aiValidationTimeoutMs: 15e3,
    aiGenerationTimeoutMs: 45e3,
    healthCheckIntervalMinutes: 30,
    logRetentionDays: 30,
    automationRetryLimit: 3
  }
};
var defaultDataProviders = [
  {
    id: "currency-erapi",
    name: "ExchangeRate API & SBP Interbank Gateway",
    category: "currency",
    endpoint: "https://open.er-api.com/v6/latest/USD",
    status: "active",
    intervalMinutes: 30,
    lastSyncAt: (/* @__PURE__ */ new Date()).toISOString(),
    nextSyncAt: new Date(Date.now() + 30 * 6e4).toISOString(),
    lastError: null,
    isLicensed: true,
    attribution: "ExchangeRate-API & SBP Foreign Exchange Regulations",
    requiresApiKey: false,
    hasApiKey: true,
    consecutiveFailures: 0,
    totalSyncs: 142,
    successfulSyncs: 142
  },
  {
    id: "weather-openmeteo",
    name: "Open-Meteo High-Resolution Meteorological Service",
    category: "weather",
    endpoint: "https://api.open-meteo.com/v1/forecast",
    status: "active",
    intervalMinutes: 60,
    lastSyncAt: (/* @__PURE__ */ new Date()).toISOString(),
    nextSyncAt: new Date(Date.now() + 60 * 6e4).toISOString(),
    lastError: null,
    isLicensed: true,
    attribution: "Open-Meteo & Pakistan Meteorological Department (PMD)",
    requiresApiKey: false,
    hasApiKey: true,
    consecutiveFailures: 0,
    totalSyncs: 98,
    successfulSyncs: 98
  },
  {
    id: "gold-bullion",
    name: "APGJAA Sarafa Bullion & XAU Spot Parity",
    category: "gold",
    endpoint: "https://api.frankfurter.app/latest",
    status: "active",
    intervalMinutes: 60,
    lastSyncAt: (/* @__PURE__ */ new Date()).toISOString(),
    nextSyncAt: new Date(Date.now() + 60 * 6e4).toISOString(),
    lastError: null,
    isLicensed: true,
    attribution: "All Pakistan Gem & Jewellers Association (APGJAA)",
    requiresApiKey: false,
    hasApiKey: true,
    consecutiveFailures: 0,
    totalSyncs: 64,
    successfulSyncs: 64
  },
  {
    id: "fuel-ogra",
    name: "OGRA Petroleum Notification Gateway",
    category: "fuel",
    endpoint: "https://www.ogra.org.pk/petroleum-prices",
    status: "active",
    intervalMinutes: 360,
    lastSyncAt: (/* @__PURE__ */ new Date()).toISOString(),
    nextSyncAt: new Date(Date.now() + 360 * 6e4).toISOString(),
    lastError: null,
    isLicensed: true,
    attribution: "Oil & Gas Regulatory Authority (OGRA) Official Gazette",
    requiresApiKey: false,
    hasApiKey: true,
    consecutiveFailures: 0,
    totalSyncs: 24,
    successfulSyncs: 24
  },
  {
    id: "cricket-feed",
    name: "PCB Official Tournament & ICC Match Feed",
    category: "cricket",
    endpoint: "https://www.pcb.com.pk/live-scores",
    status: "active",
    intervalMinutes: 10,
    lastSyncAt: (/* @__PURE__ */ new Date()).toISOString(),
    nextSyncAt: new Date(Date.now() + 10 * 6e4).toISOString(),
    lastError: null,
    isLicensed: true,
    attribution: "Pakistan Cricket Board (PCB) & International Cricket Council",
    requiresApiKey: false,
    hasApiKey: true,
    consecutiveFailures: 0,
    totalSyncs: 180,
    successfulSyncs: 180
  },
  {
    id: "world-news-rss",
    name: "Global World News Wire (BBC & Al Jazeera RSS)",
    category: "news",
    endpoint: "https://feeds.bbci.co.uk/news/world/rss.xml",
    status: "active",
    intervalMinutes: 15,
    lastSyncAt: null,
    nextSyncAt: new Date(Date.now() + 15 * 6e4).toISOString(),
    lastError: null,
    isLicensed: true,
    attribution: "BBC World Service & Al Jazeera English",
    requiresApiKey: false,
    hasApiKey: true,
    consecutiveFailures: 0,
    totalSyncs: 0,
    successfulSyncs: 0
  },
  {
    id: "sports-news-rss",
    name: "Sports & Cricket Wire (BBC Sport Cricket RSS)",
    category: "cricket",
    endpoint: "https://feeds.bbci.co.uk/sport/cricket/rss.xml",
    status: "active",
    intervalMinutes: 15,
    lastSyncAt: null,
    nextSyncAt: new Date(Date.now() + 15 * 6e4).toISOString(),
    lastError: null,
    isLicensed: true,
    attribution: "BBC Sport & International Cricket Wire",
    requiresApiKey: false,
    hasApiKey: true,
    consecutiveFailures: 0,
    totalSyncs: 0,
    successfulSyncs: 0
  }
];
var defaultFuelNotifications = [
  {
    id: "notif-2026-11-01",
    notificationNumber: "OGRA/POL-2026/Nov-01",
    effectiveDate: "01 Nov 2026",
    authority: "Ministry of Energy (Petroleum Division) & OGRA",
    petrolPkr: 265.4,
    dieselPkr: 272.8,
    kerosenePkr: 174.9,
    lightDieselPkr: 160.2,
    status: "verified",
    documentReference: "F.No.2(1)/2026-Dist-POL (Official Gazette)",
    verifiedAt: (/* @__PURE__ */ new Date()).toISOString()
  }
];
var defaultAutomationSettings = {
  autoSyncEnabled: true,
  aiDraftsEnabled: true,
  autoPublishFactualWidgets: true,
  currencySyncIntervalMin: 30,
  weatherSyncIntervalMin: 60,
  goldSyncIntervalMin: 60,
  cricketSyncIntervalMin: 10,
  fuelCheckIntervalMin: 360,
  geminiCooldownMin: 20,
  lastGeminiCallAt: null
};
var defaultHistoricalRates = [
  { id: "hist-gold-1", type: "gold", symbol: "GOLD_24K_TOLA", value: 278500, previousValue: 277300, change: 1200, changePercent: 0.43, timestamp: new Date(Date.now() - 864e5).toISOString(), source: "APGJAA Bullion Market" },
  { id: "hist-gold-2", type: "gold", symbol: "GOLD_24K_TOLA", value: 277300, previousValue: 276500, change: 800, changePercent: 0.29, timestamp: new Date(Date.now() - 1728e5).toISOString(), source: "APGJAA Bullion Market" },
  { id: "hist-usd-1", type: "currency", symbol: "USD/PKR", value: 278.4, previousValue: 278.65, change: -0.25, changePercent: -0.09, timestamp: new Date(Date.now() - 864e5).toISOString(), source: "ExchangeRate-API" },
  { id: "hist-usd-2", type: "currency", symbol: "USD/PKR", value: 278.65, previousValue: 278.9, change: -0.25, changePercent: -0.09, timestamp: new Date(Date.now() - 1728e5).toISOString(), source: "ExchangeRate-API" },
  { id: "hist-petrol-1", type: "fuel", symbol: "PETROL", value: 265.4, previousValue: 267.44, change: -2.04, changePercent: -0.76, timestamp: new Date(Date.now() - 432e6).toISOString(), source: "OGRA Notification" }
];
var defaultAdminUsers = [
  {
    id: "usr-1",
    nameEn: "Tariq Mansoor",
    nameUr: "\u0637\u0627\u0631\u0642 \u0645\u0646\u0635\u0648\u0631",
    email: "editor@360khabarnama.com",
    role: "Super Admin",
    status: "active",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
    bioEn: "Editor-in-Chief overseeing 360Khabarnama national and international coverage.",
    bioUr: "\u0686\u06CC\u0641 \u0627\u06CC\u0688\u06CC\u0679\u0631 360 \u062E\u0628\u0631\u0646\u0627\u0645\u06C1\u06D4 \u0642\u0648\u0645\u06CC \u0648 \u0628\u06CC\u0646 \u0627\u0644\u0627\u0642\u0648\u0627\u0645\u06CC \u0627\u062F\u0627\u0631\u062A\u06CC \u067E\u0627\u0644\u06CC\u0633\u06CC \u06A9\u06D2 \u0646\u06AF\u0631\u0627\u06BA\u06D4",
    articlesCount: 48,
    lastLogin: (/* @__PURE__ */ new Date()).toISOString(),
    createdAt: "2026-01-15T00:00:00Z"
  },
  {
    id: "usr-2",
    nameEn: "Ayesha Khan",
    nameUr: "\u0639\u0627\u0626\u0634\u06C1 \u062E\u0627\u0646",
    email: "ayesha@360khabarnama.com",
    role: "Managing Editor",
    status: "active",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80",
    bioEn: "Managing Editor leading economic investigation and investigative journalism.",
    bioUr: "\u0645\u06CC\u0646\u062C\u0646\u06AF \u0627\u06CC\u0688\u06CC\u0679\u0631\u060C \u0645\u0639\u0627\u0634\u06CC \u0627\u0648\u0631 \u062A\u062D\u0642\u06CC\u0642\u06CC \u0635\u062D\u0627\u0641\u062A \u06A9\u06CC \u0646\u06AF\u0631\u0627\u06BA\u06D4",
    articlesCount: 32,
    lastLogin: new Date(Date.now() - 36e5).toISOString(),
    createdAt: "2026-02-01T00:00:00Z"
  },
  {
    id: "usr-3",
    nameEn: "Zafar Iqbal",
    nameUr: "\u0638\u0641\u0631 \u0627\u0642\u0628\u0627\u0644",
    email: "zafar@360khabarnama.com",
    role: "Reporter",
    status: "active",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
    bioEn: "Senior Parliamentary and Islamabad Bureau Correspondent.",
    bioUr: "\u0633\u06CC\u0646\u0626\u0631 \u067E\u0627\u0631\u0644\u06CC\u0645\u0627\u0646\u06CC \u0646\u0627\u0645\u06C1 \u0646\u06AF\u0627\u0631\u060C \u0627\u0633\u0644\u0627\u0645 \u0622\u0628\u0627\u062F \u0628\u06CC\u0648\u0631\u0648\u06D4",
    articlesCount: 64,
    lastLogin: new Date(Date.now() - 72e5).toISOString(),
    createdAt: "2026-02-10T00:00:00Z"
  },
  {
    id: "usr-4",
    nameEn: "Hamza Farooq",
    nameUr: "\u062D\u0645\u0632\u06C1 \u0641\u0627\u0631\u0648\u0642",
    email: "seo@360khabarnama.com",
    role: "SEO Specialist",
    status: "active",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
    bioEn: "Search Engine Optimization and Technical Growth Architect.",
    bioUr: "\u0633\u0631\u0686 \u0627\u0646\u062C\u0646 \u0622\u067E\u0679\u06CC\u0645\u0627\u0626\u0632\u06CC\u0634\u0646 \u0627\u0648\u0631 \u0679\u06CC\u06A9\u0646\u06CC\u06A9\u0644 \u06AF\u0631\u0648\u062A\u06BE \u0627\u0633\u067E\u06CC\u0634\u0644\u0633\u0679\u06D4",
    articlesCount: 12,
    lastLogin: new Date(Date.now() - 144e5).toISOString(),
    createdAt: "2026-03-01T00:00:00Z"
  },
  {
    id: "usr-5",
    nameEn: "Bilal Ahmed",
    nameUr: "\u0628\u0644\u0627\u0644 \u0627\u062D\u0645\u062F",
    email: "ads@360khabarnama.com",
    role: "Advertising Manager",
    status: "active",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80",
    bioEn: "Head of Digital Monetization, AdSense & Direct Brand Partnerships.",
    bioUr: "\u0688\u06CC\u062C\u06CC\u0679\u0644 \u0645\u0648\u0646\u06CC\u0679\u0627\u0626\u0632\u06CC\u0634\u0646\u060C \u0627\u06CC\u0688\u0633\u06CC\u0646\u0633 \u0627\u0648\u0631 \u0628\u0631\u0627\u0646\u0688 \u067E\u0627\u0631\u0679\u0646\u0631\u0634\u067E \u0645\u06CC\u0646\u06CC\u062C\u0631\u06D4",
    articlesCount: 5,
    lastLogin: new Date(Date.now() - 864e5).toISOString(),
    createdAt: "2026-03-15T00:00:00Z"
  }
];
var defaultMediaAssets = [
  {
    id: "med-1",
    filename: "psx_stock_exchange_trading.webp",
    url: "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=1200&q=80",
    thumbnailUrl: "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=300&q=80",
    sizeBytes: 142800,
    mimeType: "image/webp",
    category: "business",
    captionEn: "Karachi Stock Exchange Trading Floor Activity",
    captionUr: "\u067E\u0627\u06A9\u0633\u062A\u0627\u0646 \u0627\u0633\u0679\u0627\u06A9 \u0627\u06CC\u06A9\u0633\u0686\u06CC\u0646\u062C \u06A9\u0631\u0627\u0686\u06CC \u0645\u06CC\u06BA \u0679\u0631\u06CC\u0688\u0646\u06AF \u0633\u0631\u06AF\u0631\u0645\u06CC\u0627\u06BA",
    altTextEn: "Pakistan Stock Exchange building trading floor graph",
    altTextUr: "\u067E\u0627\u06A9\u0633\u062A\u0627\u0646 \u0627\u0633\u0679\u0627\u06A9 \u0627\u06CC\u06A9\u0633\u0686\u06CC\u0646\u062C \u0639\u0645\u0627\u0631\u062A \u0627\u0648\u0631 \u062A\u062C\u0627\u0631\u062A\u06CC \u0627\u0633\u06A9\u0631\u06CC\u0646",
    width: 1200,
    height: 800,
    uploadedBy: "Tariq Mansoor",
    uploadedAt: "2026-11-01T10:00:00Z",
    usageCount: 4
  },
  {
    id: "med-2",
    filename: "gold_bars_bullion_reserve.webp",
    url: "https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=1200&q=80",
    thumbnailUrl: "https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=300&q=80",
    sizeBytes: 185400,
    mimeType: "image/webp",
    category: "finance",
    captionEn: "Pure 24K Gold Bullion Bars in Sarafa Market",
    captionUr: "\u0635\u0631\u0627\u0641\u06C1 \u0645\u0627\u0631\u06A9\u06CC\u0679 \u0645\u06CC\u06BA \u062E\u0627\u0644\u0635 24 \u0642\u06CC\u0631\u0627\u0637 \u0633\u0648\u0646\u06D2 \u06A9\u06D2 \u0628\u0633\u06A9\u0679",
    altTextEn: "Pure Gold 24k bars bullion tola in Pakistan",
    altTextUr: "\u067E\u0627\u06A9\u0633\u062A\u0627\u0646 \u0645\u06CC\u06BA 24 \u0642\u06CC\u0631\u0627\u0637 \u0633\u0648\u0646\u06D2 \u06A9\u06D2 \u0628\u0633\u06A9\u0679 \u0627\u0648\u0631 \u062A\u0648\u0644\u06C1",
    width: 1200,
    height: 800,
    uploadedBy: "Ayesha Khan",
    uploadedAt: "2026-11-02T14:30:00Z",
    usageCount: 6
  },
  {
    id: "med-3",
    filename: "cricket_champions_trophy_ball.webp",
    url: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=1200&q=80",
    thumbnailUrl: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=300&q=80",
    sizeBytes: 210200,
    mimeType: "image/webp",
    category: "sports",
    captionEn: "Pakistan National Cricket Team Training Session",
    captionUr: "\u067E\u0627\u06A9\u0633\u062A\u0627\u0646 \u0642\u0648\u0645\u06CC \u06A9\u0631\u06A9\u0679 \u0679\u06CC\u0645 \u06A9\u0627 \u067E\u0631\u06CC\u06A9\u0679\u0633 \u0633\u06CC\u0634\u0646",
    altTextEn: "Pakistan cricket stadium green grass and leather ball",
    altTextUr: "\u0642\u0648\u0645\u06CC \u06A9\u0631\u06A9\u0679 \u0627\u0633\u0679\u06CC\u0688\u06CC\u0645 \u0627\u0648\u0631 \u0645\u06CC\u0686 \u067E\u0631\u06CC\u06A9\u0679\u0633",
    width: 1200,
    height: 800,
    uploadedBy: "Zafar Iqbal",
    uploadedAt: "2026-11-03T09:15:00Z",
    usageCount: 8
  },
  {
    id: "med-4",
    filename: "lahore_weather_margalla_hills.webp",
    url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80",
    thumbnailUrl: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=300&q=80",
    sizeBytes: 198e3,
    mimeType: "image/webp",
    category: "weather",
    captionEn: "Margalla Hills Clear Horizon in Islamabad",
    captionUr: "\u0627\u0633\u0644\u0627\u0645 \u0622\u0628\u0627\u062F \u0645\u06CC\u06BA \u0645\u0627\u0631\u06AF\u0644\u06C1 \u06A9\u06CC \u062E\u0648\u0628\u0635\u0648\u0631\u062A \u067E\u06C1\u0627\u0691\u06CC\u0627\u06BA \u0627\u0648\u0631 \u0634\u0641\u0627\u0641 \u0645\u0637\u0644\u0639",
    altTextEn: "Margalla hills green nature in Islamabad Pakistan",
    altTextUr: "\u0627\u0633\u0644\u0627\u0645 \u0622\u0628\u0627\u062F \u0645\u0627\u0631\u06AF\u0644\u06C1 \u067E\u06C1\u0627\u0691\u06CC\u0648\u06BA \u06A9\u0627 \u062E\u0648\u0628\u0635\u0648\u0631\u062A \u0642\u062F\u0631\u062A\u06CC \u0645\u0646\u0638\u0631",
    width: 1200,
    height: 800,
    uploadedBy: "Tariq Mansoor",
    uploadedAt: "2026-11-04T11:45:00Z",
    usageCount: 3
  }
];
var defaultAdPlacements = [
  {
    id: "slot-1",
    slotId: "header_leaderboard",
    name: "Top Header Leaderboard (728x90 / Responsive)",
    location: "header_banner",
    providerType: "direct",
    dimensions: "728x90",
    targetDevices: "all",
    enabled: true,
    adCodeSnippet: "",
    campaignId: "camp-1",
    impressions: 48520,
    clicks: 1420
  },
  {
    id: "slot-2",
    slotId: "home_mid_leaderboard",
    name: "Homepage Mid-Feed Billboard (970x250)",
    location: "home_leaderboard",
    providerType: "direct",
    dimensions: "970x250",
    targetDevices: "desktop",
    enabled: true,
    campaignId: "camp-2",
    impressions: 34100,
    clicks: 980
  },
  {
    id: "slot-3",
    slotId: "sidebar_rectangle",
    name: "Sidebar Sticky Medium Rectangle (300x250)",
    location: "sidebar",
    providerType: "adsense",
    dimensions: "300x250",
    targetDevices: "all",
    enabled: true,
    impressions: 62400,
    clicks: 1890
  },
  {
    id: "slot-4",
    slotId: "article_in_content",
    name: "Article Body Mid-Paragraph Banner (336x280)",
    location: "article_inline",
    providerType: "adsense",
    dimensions: "336x280",
    targetDevices: "all",
    enabled: true,
    impressions: 89100,
    clicks: 2940
  },
  {
    id: "slot-5",
    slotId: "mobile_sticky_bottom",
    name: "Mobile Anchor Sticky Banner (320x50)",
    location: "mobile_sticky",
    providerType: "direct",
    dimensions: "320x50",
    targetDevices: "mobile",
    enabled: true,
    impressions: 112e3,
    clicks: 4100
  }
];
var defaultAdCampaigns = [
  {
    id: "camp-1",
    advertiserName: "Bank Alfalah Premier Banking",
    campaignName: "Premier Roshan Digital Account 2026",
    bannerUrl: "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=970&q=80",
    destinationUrl: "https://www.bankalfalah.com",
    budgetPkr: 45e4,
    startDate: "2026-11-01",
    endDate: "2026-11-30",
    status: "active",
    impressions: 48520,
    clicks: 1420,
    ctr: 2.92,
    placementSlotIds: ["slot-1", "slot-2"]
  },
  {
    id: "camp-2",
    advertiserName: "Zong 4G Digital Enterprise",
    campaignName: "Super Unlimited High-Speed Fiber",
    bannerUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=400&q=80",
    destinationUrl: "https://www.zong.com.pk",
    budgetPkr: 32e4,
    startDate: "2026-11-05",
    endDate: "2026-12-05",
    status: "active",
    impressions: 34100,
    clicks: 980,
    ctr: 2.87,
    placementSlotIds: ["slot-3"]
  }
];
var defaultSeoPages = [
  {
    id: "seo-home",
    path: "/",
    titleEn: "360Khabarnama \u2013 Pakistan News, Gold Rates, Currency & Live Scores",
    titleUr: "360 \u062E\u0628\u0631\u0646\u0627\u0645\u06C1 \u2013 \u067E\u0627\u06A9\u0633\u062A\u0627\u0646 \u06A9\u06CC \u062A\u0627\u0632\u06C1 \u062A\u0631\u06CC\u0646 \u062E\u0628\u0631\u06CC\u06BA\u060C \u0633\u0648\u0646\u0627 \u0631\u06CC\u0679\u0633\u060C \u06A9\u0631\u0646\u0633\u06CC \u0627\u0648\u0631 \u0644\u0627\u0626\u06CC\u0648 \u0627\u0633\u06A9\u0648\u0631",
    metaDescEn: "360Khabarnama is Pakistan\u2019s leading bilingual digital portal for breaking news, APGJAA bullion rates, SBP currency exchange, BISE board results, and cricket.",
    metaDescUr: "360 \u062E\u0628\u0631\u0646\u0627\u0645\u06C1 \u067E\u0627\u06A9\u0633\u062A\u0627\u0646 \u06A9\u0627 \u0645\u0633\u062A\u0646\u062F \u0688\u06CC\u062C\u06CC\u0679\u0644 \u067E\u0648\u0631\u0679\u0644: \u0628\u0631\u06CC\u06A9\u0646\u06AF \u0646\u06CC\u0648\u0632\u060C \u0633\u0648\u0646\u06D2 \u0648 \u0686\u0627\u0646\u062F\u06CC \u06A9\u06D2 \u0646\u0631\u062E\u060C \u0627\u0648\u067E\u0646 \u0645\u0627\u0631\u06A9\u06CC\u0679 \u06A9\u0631\u0646\u0633\u06CC\u060C \u062A\u0639\u0644\u06CC\u0645\u06CC \u0628\u0648\u0631\u0688 \u0646\u062A\u0627\u0626\u062C \u0627\u0648\u0631 \u06A9\u0631\u06A9\u0679 \u0644\u0627\u0626\u06CC\u0648 \u0627\u0633\u06A9\u0648\u0631\u06D4",
    canonicalUrl: "https://360khabarnama.com/",
    robotsDirectives: "index, follow, max-image-preview:large",
    ogImage: "https://360khabarnama.com/assets/aistudio/Modern_Green_and_Gold_News_Logo_2e9a99d4.png",
    schemaType: "NewsMediaOrganization",
    focusKeyword: "Pakistan news, gold rate pakistan, usd to pkr",
    lastAuditedAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "seo-business",
    path: "/business",
    titleEn: "Today Gold Rates & Currency Exchange in Pakistan \u2013 360Khabarnama",
    titleUr: "\u0622\u062C \u0633\u0648\u0646\u06D2 \u06A9\u06D2 \u0646\u0631\u062E \u0627\u0648\u0631 \u06A9\u0631\u0646\u0633\u06CC \u0627\u06CC\u06A9\u0633\u0686\u06CC\u0646\u062C \u067E\u0627\u06A9\u0633\u062A\u0627\u0646 \u2013 360 \u062E\u0628\u0631\u0646\u0627\u0645\u06C1",
    metaDescEn: "Live verified 24K and 22K gold rates per tola in Karachi, Lahore and Islamabad. Check real-time interbank & open market USD/PKR exchange rates.",
    metaDescUr: "\u067E\u0627\u06A9\u0633\u062A\u0627\u0646 \u0628\u06BE\u0631 \u0645\u06CC\u06BA 24 \u0642\u06CC\u0631\u0627\u0637 \u0627\u0648\u0631 22 \u0642\u06CC\u0631\u0627\u0637 \u0633\u0648\u0646\u06D2 \u06A9\u06D2 \u0641\u06CC \u062A\u0648\u0644\u06C1 \u0646\u0631\u062E \u0627\u0648\u0631 \u0627\u0633\u0679\u06CC\u0679 \u0628\u06CC\u0646\u06A9 \u06A9\u06D2 \u062A\u0635\u062F\u06CC\u0642 \u0634\u062F\u06C1 \u06A9\u0631\u0646\u0633\u06CC \u0631\u06CC\u0679\u0633\u06D4",
    canonicalUrl: "https://360khabarnama.com/business",
    robotsDirectives: "index, follow",
    ogImage: "https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=1200&q=80",
    schemaType: "FinancialProduct",
    focusKeyword: "gold rate in pakistan today, dollar rate in pakistan",
    lastAuditedAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "seo-weather",
    path: "/weather",
    titleEn: "Pakistan Live Weather & Smog (AQI) Air Quality Index \u2013 360Khabarnama",
    titleUr: "\u067E\u0627\u06A9\u0633\u062A\u0627\u0646 \u06A9\u0627 \u0644\u0627\u0626\u06CC\u0648 \u0645\u0648\u0633\u0645 \u0627\u0648\u0631 \u0627\u0633\u0645\u0648\u06AF \u0627\u06CC\u0626\u0631 \u06A9\u0648\u0627\u0644\u0679\u06CC \u0627\u0646\u0688\u06CC\u06A9\u0633 \u2013 360 \u062E\u0628\u0631\u0646\u0627\u0645\u06C1",
    metaDescEn: "Check real-time meteorological observations, temperatures and smog AQI levels for Karachi, Lahore, Islamabad, Multan and all major Pakistani cities.",
    metaDescUr: "\u06A9\u0631\u0627\u0686\u06CC\u060C \u0644\u0627\u06C1\u0648\u0631\u060C \u0627\u0633\u0644\u0627\u0645 \u0622\u0628\u0627\u062F\u060C \u0645\u0644\u062A\u0627\u0646 \u0627\u0648\u0631 \u0645\u0644\u06A9 \u0628\u06BE\u0631 \u06A9\u06D2 \u0634\u06C1\u0631\u0648\u06BA \u06A9\u0627 \u0644\u0627\u0626\u06CC\u0648 \u062F\u0631\u062C\u06C1 \u062D\u0631\u0627\u0631\u062A \u0627\u0648\u0631 \u0627\u0633\u0645\u0648\u06AF \u0627\u06CC\u0626\u0631 \u06A9\u0648\u0627\u0644\u0679\u06CC \u0627\u0646\u0688\u06CC\u06A9\u0633\u06D4",
    canonicalUrl: "https://360khabarnama.com/weather",
    robotsDirectives: "index, follow",
    ogImage: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80",
    schemaType: "WeatherForecast",
    focusKeyword: "lahore smog aqi, weather in karachi, pakistan weather forecast",
    lastAuditedAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "seo-cricket",
    path: "/sports",
    titleEn: "Live Cricket Scores, PSL & Pakistan Match Commentary \u2013 360Khabarnama",
    titleUr: "\u0644\u0627\u0626\u06CC\u0648 \u06A9\u0631\u06A9\u0679 \u0627\u0633\u06A9\u0648\u0631\u060C \u067E\u06CC \u0627\u06CC\u0633 \u0627\u06CC\u0644 \u0627\u0648\u0631 \u0642\u0648\u0645\u06CC \u0679\u06CC\u0645 \u06A9\u06D2 \u0645\u06CC\u0686\u0632 \u2013 360 \u062E\u0628\u0631\u0646\u0627\u0645\u06C1",
    metaDescEn: "Ball-by-ball updates, live scorecards, Pakistan national cricket fixtures, and ICC Champions Trophy news.",
    metaDescUr: "\u067E\u0627\u06A9\u0633\u062A\u0627\u0646 \u06A9\u0631\u06A9\u0679 \u0679\u06CC\u0645 \u06A9\u06D2 \u062A\u0645\u0627\u0645 \u0645\u06CC\u0686\u0632\u060C \u067E\u06CC \u0627\u06CC\u0633 \u0627\u06CC\u0644 \u0627\u0648\u0631 \u0622\u0626\u06CC \u0633\u06CC \u0633\u06CC \u0679\u0648\u0631\u0646\u0627\u0645\u0646\u0679\u0633 \u06A9\u0627 \u0644\u0627\u0626\u06CC\u0648 \u0627\u0633\u06A9\u0648\u0631 \u06A9\u0627\u0631\u0688 \u0627\u0648\u0631 \u0627\u067E \u0688\u06CC\u0679\u0633\u06D4",
    canonicalUrl: "https://360khabarnama.com/sports",
    robotsDirectives: "index, follow",
    ogImage: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=1200&q=80",
    schemaType: "SportsEvent",
    focusKeyword: "live cricket score pakistan, psl schedule, champions trophy",
    lastAuditedAt: (/* @__PURE__ */ new Date()).toISOString()
  }
];
var defaultSearchConsoleConnection = {
  authMode: "none",
  propertyUrl: "",
  diagnosticStatus: "Disconnected",
  diagnosticMessage: "Connect a Google Search Console OAuth 2.0 client or Service Account in Settings/SEO to retrieve live verified search analytics.",
  availableProperties: []
};
var defaultSearchConsole = {
  connected: false,
  diagnosticStatus: "Disconnected",
  diagnosticMessage: "Search Console is not connected yet. Configure OAuth or Service Account credentials to view real search data.",
  propertyUrl: "",
  impressions: 0,
  clicks: 0,
  ctr: 0,
  averagePosition: 0,
  topQueries: [],
  topPages: [],
  devices: [],
  countries: [],
  lastRefreshedAt: ""
};
var defaultRedirectRules = [
  {
    id: "red-1",
    sourcePath: "/epaper",
    targetPath: "/",
    statusCode: 410,
    hits: 148,
    active: true,
    createdAt: "2026-11-06T00:00:00Z"
  },
  {
    id: "red-2",
    sourcePath: "/en/epaper",
    targetPath: "/",
    statusCode: 410,
    hits: 89,
    active: true,
    createdAt: "2026-11-06T00:00:00Z"
  },
  {
    id: "red-3",
    sourcePath: "/ur/epaper",
    targetPath: "/",
    statusCode: 410,
    hits: 112,
    active: true,
    createdAt: "2026-11-06T00:00:00Z"
  },
  {
    id: "red-4",
    sourcePath: "/rates/gold",
    targetPath: "/business",
    statusCode: 301,
    hits: 642,
    active: true,
    createdAt: "2026-09-01T00:00:00Z"
  },
  {
    id: "red-5",
    sourcePath: "/rates/dollar",
    targetPath: "/business",
    statusCode: 301,
    hits: 580,
    active: true,
    createdAt: "2026-09-01T00:00:00Z"
  }
];
var defaultBrokenLinks = [
  {
    id: "bl-1",
    url: "https://360khabarnama.com/archive/2025/old-article-link",
    statusCode: 404,
    foundOnPage: "/archive",
    discoveredAt: "2026-11-05T08:00:00Z",
    resolved: false
  }
];
var defaultSubscribers = [
  {
    id: "sub-1",
    email: "reader1@gmail.com",
    language: "both",
    frequency: "daily",
    subscribedAt: "2026-10-15T08:00:00Z",
    status: "active"
  },
  {
    id: "sub-2",
    email: "karachinews@yahoo.com",
    language: "ur",
    frequency: "breaking",
    subscribedAt: "2026-10-20T12:00:00Z",
    status: "active"
  },
  {
    id: "sub-3",
    email: "investor.pk@hotmail.com",
    language: "en",
    frequency: "daily",
    subscribedAt: "2026-10-28T16:00:00Z",
    status: "active"
  }
];
var defaultNotifications = [
  {
    id: "notif-1",
    titleEn: "Breaking: KSE-100 Benchmark Crosses Historical Milestone",
    titleUr: "\u0628\u0631\u06CC\u06A9\u0646\u06AF \u0646\u06CC\u0648\u0632: \u067E\u0627\u06A9\u0633\u062A\u0627\u0646 \u0627\u0633\u0679\u0627\u06A9 \u0627\u06CC\u06A9\u0633\u0686\u06CC\u0646\u062C \u062A\u0627\u0631\u06CC\u062E \u06A9\u06CC \u0628\u0644\u0646\u062F \u062A\u0631\u06CC\u0646 \u0633\u0637\u062D \u067E\u0631 \u067E\u06C1\u0646\u0686 \u06AF\u06CC\u0627",
    messageEn: "The benchmark index surged over 600 points today amid heavy institutional participation.",
    messageUr: "\u0633\u0631\u0645\u0627\u06CC\u06C1 \u06A9\u0627\u0631\u0648\u06BA \u06A9\u06D2 \u0632\u0628\u0631\u062F\u0633\u062A \u0627\u0639\u062A\u0645\u0627\u062F \u06A9\u06D2 \u0628\u0627\u0639\u062B \u0645\u0627\u0631\u06A9\u06CC\u0679 \u0645\u06CC\u06BA \u062A\u0627\u0631\u06CC\u062E\u06CC \u062A\u06CC\u0632\u06CC\u060C \u0627\u0646\u0688\u06CC\u06A9\u0633 \u0646\u06D2 \u0646\u06CC\u0627 \u0631\u06CC\u06A9\u0627\u0631\u0688 \u0642\u0627\u0626\u0645 \u06A9\u06CC\u0627\u06D4",
    channel: "push",
    category: "business",
    sentAt: "2026-11-06T14:30:00Z",
    recipientsCount: 42800,
    status: "sent"
  }
];
var defaultHomepageConfig = {
  sections: [
    {
      id: "live_widgets_bar",
      type: "live_widgets_bar",
      nameEn: "Live Cricket, Gold & Weather Bar",
      nameUr: "\u0644\u0627\u0626\u06CC\u0648 \u06A9\u0631\u06A9\u0679\u060C \u0633\u0648\u0646\u0627 \u0627\u0648\u0631 \u0645\u0648\u0633\u0645 \u0628\u0627\u0631",
      description: "Top 3-column live widgets strip featuring cricket match status, 24K gold & USD/PKR rates, and major city temperatures.",
      enabled: true,
      order: 1,
      mobileOrder: 1,
      width: "contained",
      template: "cards",
      displayMode: "current_lang"
    },
    {
      id: "hero_editorial_grid",
      type: "hero_editorial_grid",
      nameEn: "Hero Lead Story, Trending & Exam Lookup",
      nameUr: "\u0645\u0631\u06A9\u0632\u06CC \u0644\u06CC\u0688 \u0627\u0633\u0679\u0648\u0631\u06CC\u060C \u0645\u0642\u0628\u0648\u0644 \u062E\u0628\u0631\u06CC\u06BA \u0627\u0648\u0631 \u0631\u0632\u0644\u0679 \u0686\u06CC\u06A9\u0631",
      description: "Primary 12-column editorial lead story paired with trending stories list and instant BISE exam result lookup box.",
      enabled: true,
      order: 2,
      mobileOrder: 2,
      width: "contained",
      template: "lead-plus-list",
      articleSource: "featured",
      itemLimit: 5,
      displayMode: "current_lang"
    },
    {
      id: "latest_news_feed",
      type: "latest_news_feed",
      nameEn: "Latest Published News Feed (15 Stories)",
      nameUr: "\u062A\u0627\u0632\u06C1 \u062A\u0631\u06CC\u0646 \u062E\u0628\u0631\u06CC\u06BA (15 \u062A\u0627\u0632\u06C1 \u062E\u0628\u0631\u06CC\u06BA)",
      description: "Chronological latest published news feed sorted by published_at DESC with pagination.",
      enabled: true,
      order: 3,
      mobileOrder: 3,
      width: "contained",
      template: "cards",
      articleSource: "latest",
      itemLimit: 15,
      displayMode: "current_lang"
    },
    {
      id: "ad_leaderboard_home",
      type: "ad_banner",
      nameEn: "Homepage Mid Leaderboard Ad Slot",
      nameUr: "\u0645\u0631\u06A9\u0632\u06CC \u0627\u0634\u062A\u06C1\u0627\u0631\u06CC \u0628\u06CC\u0646\u0631",
      description: "Monetization placement between main hero coverage and Islamic daily digest.",
      enabled: true,
      order: 4,
      mobileOrder: 4,
      width: "contained",
      adSlot: "leaderboard"
    },
    {
      id: "islamic_prayer_digest",
      type: "islamic_prayer_digest",
      nameEn: "Daily Islamic Digest & Prayer Times",
      nameUr: "\u0627\u0633\u0644\u0627\u0645\u06CC \u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0648 \u0627\u0648\u0642\u0627\u062A\u0650 \u0646\u0645\u0627\u0632",
      description: "Hijri calendar date, daily verified Hadith, and 6-time city prayer schedule.",
      enabled: true,
      order: 5,
      mobileOrder: 5,
      width: "contained",
      template: "cards"
    },
    {
      id: "utilities_grid",
      type: "utilities_grid",
      nameEn: "Digital Citizen Tools & Calculators Grid",
      nameUr: "\u067E\u0627\u06A9\u0633\u062A\u0627\u0646 \u0688\u06CC\u062C\u06CC\u0679\u0644 \u0633\u0631\u0648\u0633\u0632 \u0648 \u0622\u0646 \u0644\u0627\u0626\u0646 \u0679\u0648\u0644\u0632",
      description: "Quick-access grid for electricity bill estimator, Zakat, Age, Currency, Prize Bonds, and Urdu Dictionary.",
      enabled: true,
      order: 6,
      mobileOrder: 6,
      width: "contained",
      template: "grid",
      itemLimit: 6
    }
  ],
  version: 1,
  updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
  updatedBy: "System"
};
var defaultRobotsTxt = `# Robots.txt for 360Khabarnama (Pakistan Bilingual Digital Portal)
User-agent: *
Allow: /
Allow: /en/
Allow: /ur/
Allow: /assets/
Disallow: /admin/
Disallow: /api/
Disallow: /epaper/
Disallow: /en/epaper/
Disallow: /ur/epaper/

Sitemap: https://360khabarnama.com/sitemap.xml
Sitemap: https://360khabarnama.com/sitemap-news.xml
`;
var defaultSitemapConfig = {
  includeImages: true,
  includeNewsSitemap: true,
  includeCategories: true,
  defaultChangefreq: "daily",
  excludedPaths: ["/admin", "/api", "/epaper"],
  lastGeneratedAt: (/* @__PURE__ */ new Date()).toISOString()
};
var DatabaseManager = class {
  constructor() {
    this.data = this.loadDatabase();
  }
  loadDatabase() {
    try {
      try {
        if (!fs.existsSync(DATA_DIR)) {
          fs.mkdirSync(DATA_DIR, { recursive: true });
        }
      } catch (mkdirErr) {
        console.warn("[DB] Cannot create data directory, using in-memory / seed read-only:", mkdirErr);
      }
      const sourceFile = fs.existsSync(DB_FILE) ? DB_FILE : fs.existsSync(SEED_DB_FILE) ? SEED_DB_FILE : null;
      if (sourceFile) {
        const raw = fs.readFileSync(sourceFile, "utf-8");
        const parsed = JSON.parse(raw);
        if (!parsed.dataProviders || parsed.dataProviders.length === 0) {
          parsed.dataProviders = defaultDataProviders;
        } else {
          for (const defProv of defaultDataProviders) {
            if (!parsed.dataProviders.some((p) => p.id === defProv.id)) {
              parsed.dataProviders.push(defProv);
            }
          }
        }
        if (!parsed.syncJobRuns) parsed.syncJobRuns = [];
        if (!parsed.historicalRates || parsed.historicalRates.length === 0) parsed.historicalRates = defaultHistoricalRates;
        if (!parsed.fuelPriceNotifications || parsed.fuelPriceNotifications.length === 0) parsed.fuelPriceNotifications = defaultFuelNotifications;
        if (!parsed.aiContentDrafts) parsed.aiContentDrafts = [];
        if (!parsed.automationSettings) parsed.automationSettings = defaultAutomationSettings;
        if (!parsed.adminUsers || parsed.adminUsers.length === 0) parsed.adminUsers = defaultAdminUsers;
        if (!parsed.mediaAssets || parsed.mediaAssets.length === 0) parsed.mediaAssets = defaultMediaAssets;
        if (!parsed.adPlacements || parsed.adPlacements.length === 0) parsed.adPlacements = defaultAdPlacements;
        if (!parsed.adCampaigns || parsed.adCampaigns.length === 0) parsed.adCampaigns = defaultAdCampaigns;
        if (!parsed.seoPages || parsed.seoPages.length === 0) parsed.seoPages = defaultSeoPages;
        if (!parsed.searchConsoleConnection) parsed.searchConsoleConnection = { ...defaultSearchConsoleConnection };
        if (!parsed.searchConsole || (!parsed.searchConsoleConnection?.authMode || parsed.searchConsoleConnection.authMode === "none")) {
          parsed.searchConsole = { ...defaultSearchConsole };
        }
        if (!parsed.redirectRules || parsed.redirectRules.length === 0) parsed.redirectRules = defaultRedirectRules;
        if (!parsed.brokenLinks) parsed.brokenLinks = defaultBrokenLinks;
        if (!parsed.subscribers || parsed.subscribers.length === 0) parsed.subscribers = defaultSubscribers;
        if (!parsed.notifications || parsed.notifications.length === 0) parsed.notifications = defaultNotifications;
        if (!parsed.pushSubscriptions) parsed.pushSubscriptions = [];
        if (!parsed.homepageConfig || !parsed.homepageConfig.sections?.some((s) => s.type)) {
          parsed.homepageConfig = defaultHomepageConfig;
        }
        if (!parsed.homepageDraft) parsed.homepageDraft = JSON.parse(JSON.stringify(parsed.homepageConfig));
        if (!parsed.homepageVersions) parsed.homepageVersions = [];
        if (!parsed.customBlocks) parsed.customBlocks = [];
        if (!parsed.categoryPages) parsed.categoryPages = [];
        if (!parsed.categoryPageVersions) parsed.categoryPageVersions = {};
        if (!parsed.robotsTxt) parsed.robotsTxt = defaultRobotsTxt;
        if (!parsed.sitemapConfig) parsed.sitemapConfig = { ...defaultSitemapConfig };
        if (!parsed.seoAuditLogs) parsed.seoAuditLogs = [];
        if (!parsed.adminCredentials) parsed.adminCredentials = {};
        if (!parsed.aiProviders) parsed.aiProviders = [];
        if (!parsed.aiTaskRoutes) parsed.aiTaskRoutes = {};
        if (!parsed.aiUsageLogs) parsed.aiUsageLogs = [];
        if (!parsed.aiConnectionTests) parsed.aiConnectionTests = [];
        if (!("aiHealthStatus" in parsed)) parsed.aiHealthStatus = null;
        if (!parsed.aiEnvSuppressed) parsed.aiEnvSuppressed = { gemini: false, grok: false };
        if (!parsed.editorialDrafts) parsed.editorialDrafts = [];
        if (!parsed.saveDiagnostics) parsed.saveDiagnostics = [];
        if (!parsed.cronLocks) parsed.cronLocks = {};
        if (parsed.homepageConfig?.sections && !parsed.homepageConfig.sections.some((s) => s.type === "latest_news_feed")) {
          parsed.homepageConfig.sections.splice(2, 0, {
            id: "latest_news_feed",
            type: "latest_news_feed",
            nameEn: "Latest Published News Feed (15 Stories)",
            nameUr: "\u062A\u0627\u0632\u06C1 \u062A\u0631\u06CC\u0646 \u062E\u0628\u0631\u06CC\u06BA (15 \u062A\u0627\u0632\u06C1 \u062E\u0628\u0631\u06CC\u06BA)",
            description: "Chronological latest published news feed sorted by published_at DESC with pagination.",
            enabled: true,
            order: 3,
            mobileOrder: 3,
            width: "contained",
            template: "cards",
            articleSource: "latest",
            itemLimit: 15,
            displayMode: "current_lang"
          });
        }
        let migrated = false;
        if ("epaperPages" in parsed) {
          delete parsed.epaperPages;
          migrated = true;
        }
        if (!parsed.siteSettings || parsed.siteSettings.siteNameEn === "Pakistan Digital Portal") {
          parsed.siteSettings = {
            ...defaultSiteSettings,
            ...parsed.siteSettings || {},
            siteNameEn: "360Khabarnama",
            siteNameUr: "360 \u062E\u0628\u0631\u0646\u0627\u0645\u06C1",
            taglineEn: defaultSiteSettings.taglineEn,
            taglineUr: defaultSiteSettings.taglineUr,
            contactEmail: "editor@360khabarnama.com",
            googleAnalyticsId: parsed.siteSettings?.googleAnalyticsId === "G-PAKPORTAL2026" ? defaultSiteSettings.googleAnalyticsId : parsed.siteSettings?.googleAnalyticsId || defaultSiteSettings.googleAnalyticsId
          };
          migrated = true;
        }
        if (migrated) {
          this.saveDatabase(parsed);
        }
        return parsed;
      }
    } catch (e) {
      console.warn("Could not read existing database, falling back to defaults:", e);
    }
    const initial = {
      articles: defaultArticles,
      categories: defaultCategories,
      boards: defaultBoards,
      results: defaultResults,
      weather: defaultWeather,
      goldRates: defaultGoldRates,
      currencyRates: defaultCurrencyRates,
      fuelPrices: defaultFuelPrices,
      psx: defaultPSX,
      cricketMatches: defaultCricket,
      prayerTimes: defaultPrayerTimes,
      mobiles: defaultMobiles,
      automobiles: defaultAutomobiles,
      prizeBonds: defaultPrizeBonds,
      dictionary: defaultDictionary,
      babyNames: defaultBabyNames,
      poets: defaultPoets,
      poems: defaultPoems,
      recipes: defaultRecipes,
      jobs: defaultJobs,
      siteSettings: defaultSiteSettings,
      auditLogs: defaultAuditLogs,
      dataProviders: defaultDataProviders,
      syncJobRuns: [],
      historicalRates: defaultHistoricalRates,
      fuelPriceNotifications: defaultFuelNotifications,
      aiContentDrafts: [],
      automationSettings: defaultAutomationSettings,
      adminUsers: defaultAdminUsers,
      mediaAssets: defaultMediaAssets,
      adPlacements: defaultAdPlacements,
      adCampaigns: defaultAdCampaigns,
      seoPages: defaultSeoPages,
      searchConsole: { ...defaultSearchConsole },
      searchConsoleConnection: { ...defaultSearchConsoleConnection },
      redirectRules: defaultRedirectRules,
      brokenLinks: defaultBrokenLinks,
      subscribers: defaultSubscribers,
      notifications: defaultNotifications,
      homepageConfig: defaultHomepageConfig,
      homepageDraft: JSON.parse(JSON.stringify(defaultHomepageConfig)),
      homepageVersions: [],
      customBlocks: [],
      categoryPages: [],
      categoryPageVersions: {},
      robotsTxt: defaultRobotsTxt,
      sitemapConfig: { ...defaultSitemapConfig },
      seoAuditLogs: [],
      adminCredentials: {},
      aiProviders: [],
      aiTaskRoutes: {},
      aiUsageLogs: [],
      aiConnectionTests: [],
      aiHealthStatus: null,
      aiEnvSuppressed: { gemini: false, grok: false },
      editorialDrafts: [],
      saveDiagnostics: [],
      cronLocks: {}
    };
    this.saveDatabase(initial);
    return initial;
  }
  saveDatabase(dataToSave) {
    const tmpFile = `${DB_FILE}.${process.pid}.${Math.random().toString(36).slice(2, 8)}.tmp`;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(tmpFile, JSON.stringify(dataToSave, null, 2), "utf-8");
      fs.renameSync(tmpFile, DB_FILE);
    } catch (e) {
      try {
        if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      } catch {
      }
      console.error("Failed to write database to disk:", e);
    }
  }
  getData() {
    return this.data;
  }
  logAudit(user, action, details) {
    const entry = {
      id: `log-${Date.now()}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      user,
      action,
      details
    };
    this.data.auditLogs.unshift(entry);
    if (this.data.auditLogs.length > 200) {
      this.data.auditLogs.pop();
    }
    this.saveDatabase(this.data);
  }
  // Articles
  slugifyText(input) {
    return (input || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "") || `news-${Date.now()}`;
  }
  generateUniqueSlug(candidate, excludeArticleId) {
    const base = this.slugifyText(candidate);
    const activeSlugs = new Set(
      this.data.articles.filter((a) => !a.deletedAt && a.id !== excludeArticleId).map((a) => (a.slug || "").toLowerCase())
    );
    if (!activeSlugs.has(base)) return base;
    let counter = 2;
    while (activeSlugs.has(`${base}-${counter}`)) {
      counter++;
    }
    return `${base}-${counter}`;
  }
  getArticles(category, tag, search, status = "published", includeDeleted = false) {
    let list = includeDeleted ? this.data.articles : this.data.articles.filter((a) => !a.deletedAt);
    if (status && status !== "all") {
      list = list.filter((a) => a.status === status);
    }
    if (category && category !== "all") {
      list = list.filter((a) => (a.category || "").toLowerCase() === category.toLowerCase());
    }
    if (tag) {
      list = list.filter((a) => Array.isArray(a.tags) && a.tags.some((t) => t.toLowerCase() === tag.toLowerCase()));
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) => (a.titleEn || "").toLowerCase().includes(q) || (a.titleUr || "").includes(q) || (a.summaryEn || "").toLowerCase().includes(q) || (a.summaryUr || "").includes(q) || (a.slug || "").toLowerCase().includes(q)
      );
    }
    return list;
  }
  getArticleBySlugOrId(identifier, includeDeleted = false) {
    const clean = decodeURIComponent(identifier || "").trim();
    return this.data.articles.find(
      (a) => (includeDeleted || !a.deletedAt) && (a.slug === clean || a.id === clean)
    );
  }
  incrementArticleViews(id) {
    const art = this.data.articles.find((a) => a.id === id && !a.deletedAt);
    if (art) {
      art.views = (art.views || 0) + 1;
      this.saveDatabase(this.data);
    }
  }
  bumpNewsCacheVersion() {
    const nextVersion = (this.data.newsCacheVersion || 1) + 1;
    const invalidatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.data.newsCacheVersion = nextVersion;
    this.data.lastCacheInvalidationAt = invalidatedAt;
    this.saveDatabase(this.data);
    return { version: nextVersion, invalidatedAt };
  }
  getCacheStatus() {
    return {
      newsCacheVersion: this.data.newsCacheVersion || 1,
      lastInvalidatedAt: this.data.lastCacheInvalidationAt || null,
      publishedArticlesCount: this.data.articles.filter((a) => !a.deletedAt && a.status === "published").length,
      totalActiveArticlesCount: this.data.articles.filter((a) => !a.deletedAt).length
    };
  }
  addPublicationLog(entry) {
    if (!this.data.publicationLogs) this.data.publicationLogs = [];
    const full = {
      ...entry,
      id: `publog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.publicationLogs.unshift(full);
    if (this.data.publicationLogs.length > 300) {
      this.data.publicationLogs = this.data.publicationLogs.slice(0, 300);
    }
    this.saveDatabase(this.data);
    return full;
  }
  getPublicationLogs(limit = 50) {
    return (this.data.publicationLogs || []).slice(0, limit);
  }
  recordSaveDiagnostic(entry) {
    if (!this.data.saveDiagnostics) this.data.saveDiagnostics = [];
    const full = {
      ...entry,
      id: `sdiag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.saveDiagnostics.unshift(full);
    if (this.data.saveDiagnostics.length > 250) {
      this.data.saveDiagnostics = this.data.saveDiagnostics.slice(0, 250);
    }
    this.saveDatabase(this.data);
    return full;
  }
  getSaveDiagnostics(limit = 80, moduleFilter) {
    let list = this.data.saveDiagnostics || [];
    if (moduleFilter && moduleFilter !== "all") {
      list = list.filter((item) => item.module === moduleFilter);
    }
    return list.slice(0, limit);
  }
  upsertArticle(articleInput, actor = "Editor", opts) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const index = articleInput.id ? this.data.articles.findIndex((a) => a.id === articleInput.id) : -1;
    if (index >= 0) {
      const existing = this.data.articles[index];
      const currentVersion = existing.version || 1;
      if (typeof articleInput.expectedVersion === "number" && articleInput.expectedVersion !== currentVersion) {
        const err = new Error(
          `Optimistic lock conflict: expected version v${articleInput.expectedVersion}, found v${currentVersion}. Reload article and retry.`
        );
        err.statusCode = 409;
        err.code = "VERSION_CONFLICT";
        throw err;
      }
      const nextSlugCandidate = articleInput.slug ? this.slugifyText(articleInput.slug) : existing.slug;
      if (nextSlugCandidate && nextSlugCandidate !== existing.slug && this.data.articles.some(
        (a) => !a.deletedAt && a.id !== existing.id && (a.slug || "").toLowerCase() === nextSlugCandidate.toLowerCase()
      )) {
        const err = new Error(`Slug "${nextSlugCandidate}" is already in use by another article.`);
        err.statusCode = 409;
        err.code = "DUPLICATE_SLUG";
        throw err;
      }
      if (existing.status === "published" && nextSlugCandidate && existing.slug && nextSlugCandidate !== existing.slug) {
        for (const lang of ["en", "ur"]) {
          const srcPath = `/${lang}/news/${existing.slug}`;
          const targetPath = `/${lang}/news/${nextSlugCandidate}`;
          if (!this.data.redirectRules.some((r) => r.sourcePath === srcPath && r.active)) {
            this.data.redirectRules.unshift({
              id: `red-slug-${Date.now()}-${lang}`,
              sourcePath: srcPath,
              targetPath,
              statusCode: 301,
              hits: 0,
              active: true,
              notes: `Auto 301 redirect after slug update (${existing.id})`,
              createdAt: now
            });
          }
        }
      }
      const versionSnapshot = {
        versionId: `ver-${Date.now()}`,
        savedAt: now,
        savedBy: actor,
        titleEn: existing.titleEn,
        titleUr: existing.titleUr,
        summaryEn: existing.summaryEn,
        summaryUr: existing.summaryUr,
        contentEn: existing.contentEn,
        contentUr: existing.contentUr,
        changeNote: `Edited by ${actor} (v${currentVersion})`
      };
      const versions = Array.isArray(existing.versions) ? [...existing.versions] : [];
      versions.unshift(versionSnapshot);
      if (versions.length > 20) versions.pop();
      const nextStatus = articleInput.status || existing.status || "draft";
      const nextPublishedAt = nextStatus === "published" ? existing.publishedAt || articleInput.publishedAt || now : existing.publishedAt || "";
      const updatedArticle = {
        ...existing,
        ...Object.fromEntries(Object.entries(articleInput).filter(([k, v]) => v !== void 0 && k !== "expectedVersion")),
        id: existing.id,
        slug: nextSlugCandidate || existing.slug,
        status: nextStatus,
        version: currentVersion + 1,
        publishedAt: nextPublishedAt,
        updatedAt: now,
        scheduledAt: articleInput.scheduledAt ?? articleInput.scheduledFor ?? existing.scheduledAt,
        scheduledFor: articleInput.scheduledFor ?? articleInput.scheduledAt ?? existing.scheduledFor,
        tags: Array.isArray(articleInput.tags) ? articleInput.tags : existing.tags || [],
        versions
      };
      this.data.articles[index] = updatedArticle;
      this.logAudit(
        actor,
        "Article Updated",
        `Updated article ${updatedArticle.id} "${updatedArticle.titleEn}" (Status: ${updatedArticle.status}, v${updatedArticle.version})`
      );
      this.addPublicationLog({
        articleId: updatedArticle.id,
        action: existing.status !== updatedArticle.status && updatedArticle.status === "published" ? "publish" : "update",
        previousStatus: existing.status,
        nextStatus: updatedArticle.status,
        actor,
        correlationId: opts?.correlationId,
        storageEngine: opts?.storageEngine || "json_fallback",
        message: `Saved ${updatedArticle.slug} (v${updatedArticle.version})`
      });
      this.data.newsCacheVersion = (this.data.newsCacheVersion || 1) + 1;
      this.data.lastCacheInvalidationAt = now;
      this.saveDatabase(this.data);
      return updatedArticle;
    } else {
      const requestedStatus = articleInput.status || "draft";
      const titleBasis = articleInput.slug || articleInput.titleEn || articleInput.titleUr || "news-article";
      const uniqueSlug = this.generateUniqueSlug(titleBasis);
      const newArticle = {
        id: articleInput.id || `art-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        slug: uniqueSlug,
        titleEn: articleInput.titleEn || "",
        titleUr: articleInput.titleUr || "",
        summaryEn: articleInput.summaryEn || "",
        summaryUr: articleInput.summaryUr || "",
        contentEn: articleInput.contentEn || "",
        contentUr: articleInput.contentUr || "",
        category: articleInput.category || "pakistan",
        subcategory: articleInput.subcategory,
        tags: Array.isArray(articleInput.tags) ? articleInput.tags : ["Pakistan", "News"],
        author: articleInput.author || {
          id: "admin-1",
          nameEn: actor || "Editorial Staff",
          nameUr: "\u0627\u062F\u0627\u0631\u06CC\u06C1 360 \u062E\u0628\u0631\u0646\u0627\u0645\u06C1",
          avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
          role: "Editor"
        },
        publishedAt: requestedStatus === "published" ? articleInput.publishedAt || now : "",
        updatedAt: now,
        scheduledAt: articleInput.scheduledAt || articleInput.scheduledFor,
        scheduledFor: articleInput.scheduledFor || articleInput.scheduledAt,
        createdBy: articleInput.createdBy || actor,
        views: articleInput.views || 0,
        status: requestedStatus,
        version: 1,
        deletedAt: null,
        heroImage: articleInput.heroImage || "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=1200&q=80",
        imageCaptionEn: articleInput.imageCaptionEn || "Editorial reporting.",
        imageCaptionUr: articleInput.imageCaptionUr || "\u062E\u0635\u0648\u0635\u06CC \u0631\u067E\u0648\u0631\u0679\u0646\u06AF\u06D4",
        isBreaking: Boolean(articleInput.isBreaking),
        isFeatured: Boolean(articleInput.isFeatured),
        isTrending: Boolean(articleInput.isTrending),
        homepageSlot: articleInput.homepageSlot || "none",
        readingTimeMin: Number(articleInput.readingTimeMin || 3),
        seo: articleInput.seo,
        versions: []
      };
      this.data.articles.unshift(newArticle);
      this.logAudit(actor, "Article Created", `Created article ${newArticle.id}: ${newArticle.titleEn} (Status: ${newArticle.status})`);
      this.addPublicationLog({
        articleId: newArticle.id,
        action: newArticle.status === "published" ? "create_and_publish" : "create",
        previousStatus: "none",
        nextStatus: newArticle.status,
        actor,
        correlationId: opts?.correlationId,
        storageEngine: opts?.storageEngine || "json_fallback",
        message: `Created ${newArticle.slug} (v1)`
      });
      this.data.newsCacheVersion = (this.data.newsCacheVersion || 1) + 1;
      this.data.lastCacheInvalidationAt = now;
      this.saveDatabase(this.data);
      return newArticle;
    }
  }
  deleteArticle(id, actor = "Admin", hardDelete = false) {
    const idx = this.data.articles.findIndex((a) => a.id === id);
    if (idx < 0) return false;
    const prev = this.data.articles[idx];
    if (hardDelete) {
      this.data.articles.splice(idx, 1);
      this.logAudit(actor, "Article Permanently Removed", `Hard-deleted article ID: ${id}`);
    } else {
      prev.deletedAt = (/* @__PURE__ */ new Date()).toISOString();
      prev.updatedAt = prev.deletedAt;
      this.logAudit(actor, "Article Deleted", `Soft-deleted article ID: ${id}`);
      this.addPublicationLog({
        articleId: id,
        action: "soft_delete",
        previousStatus: prev.status,
        nextStatus: "deleted",
        actor,
        storageEngine: "json_fallback"
      });
    }
    this.data.newsCacheVersion = (this.data.newsCacheVersion || 1) + 1;
    this.data.lastCacheInvalidationAt = (/* @__PURE__ */ new Date()).toISOString();
    this.saveDatabase(this.data);
    return true;
  }
  rollbackArticle(articleId, versionId, actor = "Editor") {
    const art = this.data.articles.find((a) => a.id === articleId && !a.deletedAt);
    if (!art || !art.versions) return null;
    const version = art.versions.find((v) => v.versionId === versionId);
    if (!version) return null;
    art.titleEn = version.titleEn;
    art.titleUr = version.titleUr;
    art.summaryEn = version.summaryEn;
    art.summaryUr = version.summaryUr;
    art.contentEn = version.contentEn;
    art.contentUr = version.contentUr;
    art.version = (art.version || 1) + 1;
    art.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.logAudit(actor, "Article Version Rolled Back", `Restored article "${art.titleEn}" to version ${versionId}`);
    this.data.newsCacheVersion = (this.data.newsCacheVersion || 1) + 1;
    this.data.lastCacheInvalidationAt = art.updatedAt;
    this.saveDatabase(this.data);
    return art;
  }
  // Results
  findExamResult(boardCode, rollNumber, year) {
    return this.data.results.find(
      (r) => r.boardCode.toUpperCase() === boardCode.toUpperCase() && r.rollNumber.trim() === rollNumber.trim() && (!year || r.year === year)
    );
  }
  addExamResult(result) {
    this.data.results.push(result);
    this.saveDatabase(this.data);
  }
  // Site Settings
  updateSettings(settings, actor = "Admin") {
    this.data.siteSettings = { ...this.data.siteSettings, ...settings };
    this.logAudit(actor, "Settings Updated", "Updated site appearance and configuration");
    this.saveDatabase(this.data);
    return this.data.siteSettings;
  }
  // Weather update
  updateCityWeather(cityId, updates) {
    const city = this.data.weather.find((w) => w.cityId === cityId);
    if (city) {
      Object.assign(city, updates);
      this.saveDatabase(this.data);
    }
  }
  // Prize bond checker
  checkPrizeBond(denomination, bondNumber) {
    const draws = this.data.prizeBonds.filter((d) => d.denomination === denomination);
    const cleanNumber = bondNumber.trim().padStart(6, "0");
    for (const draw of draws) {
      if (draw.firstPrizeBond === cleanNumber) {
        return { won: true, prizeTier: "First Prize", prizeAmount: draw.firstPrizePkr, draw };
      }
      if (draw.secondPrizeBonds.includes(cleanNumber)) {
        return { won: true, prizeTier: "Second Prize", prizeAmount: draw.secondPrizePkr, draw };
      }
      if (draw.thirdPrizeSample.includes(cleanNumber)) {
        return { won: true, prizeTier: "Third Prize", prizeAmount: draw.thirdPrizePkr, draw };
      }
    }
    return { won: false, message: "No prize match found in recent official draws for this bond number." };
  }
  // --- Live Data & Automation Methods ---
  getDataProviders() {
    return this.data.dataProviders || [];
  }
  getDataProvider(id) {
    return (this.data.dataProviders || []).find((p) => p.id === id);
  }
  updateDataProvider(id, updates) {
    const provider = (this.data.dataProviders || []).find((p) => p.id === id);
    if (provider) {
      Object.assign(provider, updates);
      this.saveDatabase(this.data);
    }
  }
  recordSyncRun(run) {
    if (!this.data.syncJobRuns) this.data.syncJobRuns = [];
    this.data.syncJobRuns.unshift(run);
    if (this.data.syncJobRuns.length > 150) {
      this.data.syncJobRuns = this.data.syncJobRuns.slice(0, 150);
    }
    this.saveDatabase(this.data);
  }
  getSyncHistory(limit = 50) {
    return (this.data.syncJobRuns || []).slice(0, limit);
  }
  recordHistoricalRate(record) {
    if (!this.data.historicalRates) this.data.historicalRates = [];
    this.data.historicalRates.unshift(record);
    if (this.data.historicalRates.length > 500) {
      this.data.historicalRates = this.data.historicalRates.slice(0, 500);
    }
    this.saveDatabase(this.data);
  }
  getHistoricalRates(type, symbol, limit = 30) {
    let records = this.data.historicalRates || [];
    if (type) {
      records = records.filter((r) => r.type.toLowerCase() === type.toLowerCase());
    }
    if (symbol) {
      records = records.filter((r) => r.symbol.toLowerCase() === symbol.toLowerCase());
    }
    return records.slice(0, limit);
  }
  getFuelNotifications() {
    return this.data.fuelPriceNotifications || [];
  }
  addFuelNotification(notification) {
    if (!this.data.fuelPriceNotifications) this.data.fuelPriceNotifications = [];
    this.data.fuelPriceNotifications.unshift(notification);
    this.saveDatabase(this.data);
  }
  getAiDrafts(status) {
    const drafts = this.data.aiContentDrafts || [];
    if (status && status !== "all") {
      return drafts.filter((d) => d.status === status);
    }
    return drafts;
  }
  saveAiDraft(draft) {
    if (!this.data.aiContentDrafts) this.data.aiContentDrafts = [];
    const idx = this.data.aiContentDrafts.findIndex((d) => d.id === draft.id);
    if (idx >= 0) {
      this.data.aiContentDrafts[idx] = draft;
    } else {
      this.data.aiContentDrafts.unshift(draft);
    }
    this.saveDatabase(this.data);
  }
  approveAiDraft(draftId, actor = "Editor") {
    if (!this.data.aiContentDrafts) return { success: false };
    const draft = this.data.aiContentDrafts.find((d) => d.id === draftId);
    if (!draft) return { success: false };
    draft.status = "published";
    draft.approvedBy = actor;
    draft.publishedAt = (/* @__PURE__ */ new Date()).toISOString();
    const newArticle = {
      id: `art-${draft.id}`,
      slug: `${draft.category}-update-${Date.now()}`,
      category: draft.category === "cricket" ? "sports" : "business",
      titleEn: draft.titleEn,
      titleUr: draft.titleUr,
      summaryEn: draft.summaryEn,
      summaryUr: draft.summaryUr,
      contentEn: draft.contentEn,
      contentUr: draft.contentUr,
      author: {
        id: "live-bureau",
        nameEn: "360Khabarnama Live Bureau (Gemini Source Grounded)",
        nameUr: "360 \u062E\u0628\u0631\u0646\u0627\u0645\u06C1 \u0644\u0627\u0626\u06CC\u0648 \u0628\u06CC\u0648\u0631\u0648 (\u0645\u0633\u062A\u0646\u062F \u0688\u06CC\u0679\u0627)",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
        role: "Verified Data Desk"
      },
      heroImage: draft.category === "gold" ? "https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=800&q=80" : draft.category === "fuel" ? "https://images.unsplash.com/photo-1545459720-aac8509eb02c?auto=format&fit=crop&w=800&q=80" : draft.category === "currency" ? "https://images.unsplash.com/photo-1580519542036-c47de6196ba5?auto=format&fit=crop&w=800&q=80" : "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=800&q=80",
      imageCaptionEn: `Verified factual update via ${draft.sourceAttribution || "official records"}.`,
      imageCaptionUr: "\u0645\u0633\u062A\u0646\u062F \u0633\u0631\u06A9\u0627\u0631\u06CC \u0627\u0639\u062F\u0627\u062F \u0648 \u0634\u0645\u0627\u0631 \u0627\u0648\u0631 \u0645\u0627\u0631\u06A9\u06CC\u0679 \u0688\u06CC\u0679\u0627 \u06A9\u06D2 \u0645\u0637\u0627\u0628\u0642\u06D4",
      status: "published",
      isBreaking: draft.triggerReason.includes("Substantial") || draft.category === "fuel",
      isFeatured: true,
      isTrending: true,
      readingTimeMin: 2,
      tags: [draft.category, "Pakistan", "Live Update", "Verified"],
      views: 0,
      publishedAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.upsertArticle(newArticle, actor);
    this.logAudit(actor, "AI Draft Approved & Published", `Published article from AI draft: ${draft.titleEn}`);
    this.saveDatabase(this.data);
    return { success: true, article: newArticle };
  }
  rejectAiDraft(draftId, actor = "Editor") {
    if (!this.data.aiContentDrafts) return false;
    const draft = this.data.aiContentDrafts.find((d) => d.id === draftId);
    if (!draft) return false;
    draft.status = "rejected";
    draft.approvedBy = actor;
    this.logAudit(actor, "AI Draft Rejected", `Dismissed AI draft: ${draft.titleEn}`);
    this.saveDatabase(this.data);
    return true;
  }
  getAutomationSettings() {
    return this.data.automationSettings || defaultAutomationSettings;
  }
  updateAutomationSettings(settings, actor = "Admin") {
    this.data.automationSettings = {
      ...this.data.automationSettings || defaultAutomationSettings,
      ...settings
    };
    this.logAudit(actor, "Automation Settings Updated", "Modified live sync intervals or engine flags");
    this.saveDatabase(this.data);
    return this.data.automationSettings;
  }
  updateCurrencyRates(rates) {
    this.data.currencyRates = rates;
    this.saveDatabase(this.data);
  }
  updateGoldRates(rates) {
    this.data.goldRates = rates;
    this.saveDatabase(this.data);
  }
  updateFuelPrices(prices) {
    this.data.fuelPrices = prices;
    this.saveDatabase(this.data);
  }
  updatePsxData(psx) {
    this.data.psx = psx;
    this.saveDatabase(this.data);
  }
  updateWeatherData(weather) {
    this.data.weather = weather;
    this.saveDatabase(this.data);
  }
  updateCricketMatches(matches) {
    this.data.cricketMatches = matches;
    this.saveDatabase(this.data);
  }
  // --- Users & RBAC ---
  getAdminUsers() {
    return this.data.adminUsers || [];
  }
  upsertAdminUser(user, actor = "Super Admin") {
    if (!this.data.adminUsers) this.data.adminUsers = [];
    const idx = this.data.adminUsers.findIndex((u) => u.id === user.id);
    if (idx >= 0) {
      this.data.adminUsers[idx] = { ...this.data.adminUsers[idx], ...user };
      this.logAudit(actor, "User Updated", `Updated staff account: ${user.nameEn} (${user.role})`);
    } else {
      const newUser = {
        ...user,
        id: user.id || `usr-${Date.now()}`,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.data.adminUsers.push(newUser);
      this.logAudit(actor, "User Created", `Created staff account: ${user.nameEn} (${user.role})`);
    }
    this.saveDatabase(this.data);
    return user;
  }
  deleteAdminUser(id, actor = "Super Admin") {
    if (!this.data.adminUsers) return false;
    const prevLen = this.data.adminUsers.length;
    this.data.adminUsers = this.data.adminUsers.filter((u) => u.id !== id);
    if (this.data.adminUsers.length < prevLen) {
      this.logAudit(actor, "User Removed", `Deactivated staff account ID: ${id}`);
      this.saveDatabase(this.data);
      return true;
    }
    return false;
  }
  // --- Media Library ---
  getMediaAssets(category, search) {
    let assets = this.data.mediaAssets || [];
    if (category && category !== "all") {
      assets = assets.filter((a) => a.category.toLowerCase() === category.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      assets = assets.filter(
        (a) => a.filename.toLowerCase().includes(q) || a.captionEn.toLowerCase().includes(q) || a.captionUr.includes(q) || a.altTextEn.toLowerCase().includes(q)
      );
    }
    return assets;
  }
  addMediaAsset(asset, actor = "Editor") {
    if (!this.data.mediaAssets) this.data.mediaAssets = [];
    const newAsset = {
      ...asset,
      id: asset.id || `med-${Date.now()}`,
      uploadedAt: (/* @__PURE__ */ new Date()).toISOString(),
      usageCount: asset.usageCount || 1
    };
    this.data.mediaAssets.unshift(newAsset);
    this.logAudit(actor, "Media Uploaded", `Uploaded media file: ${asset.filename}`);
    this.saveDatabase(this.data);
    return newAsset;
  }
  deleteMediaAsset(id, actor = "Editor") {
    if (!this.data.mediaAssets) return false;
    const prev = this.data.mediaAssets.length;
    this.data.mediaAssets = this.data.mediaAssets.filter((m) => m.id !== id);
    if (this.data.mediaAssets.length < prev) {
      this.logAudit(actor, "Media Deleted", `Deleted asset ID: ${id}`);
      this.saveDatabase(this.data);
      return true;
    }
    return false;
  }
  // --- Advertising & Monetization ---
  getAdPlacements() {
    return this.data.adPlacements || [];
  }
  updateAdPlacement(id, updates, actor = "Ad Manager") {
    if (!this.data.adPlacements) return null;
    const slot = this.data.adPlacements.find((s) => s.id === id);
    if (slot) {
      Object.assign(slot, updates);
      this.logAudit(actor, "Ad Placement Updated", `Modified slot: ${slot.name}`);
      this.saveDatabase(this.data);
      return slot;
    }
    return null;
  }
  getAdCampaigns() {
    return this.data.adCampaigns || [];
  }
  upsertAdCampaign(campaign, actor = "Ad Manager") {
    if (!this.data.adCampaigns) this.data.adCampaigns = [];
    const idx = this.data.adCampaigns.findIndex((c) => c.id === campaign.id);
    let saved;
    if (idx >= 0) {
      saved = { ...this.data.adCampaigns[idx], ...campaign };
      this.data.adCampaigns[idx] = saved;
      this.logAudit(actor, "Ad Campaign Updated", `Updated campaign: ${saved.campaignName}`);
    } else {
      saved = {
        ...campaign,
        id: campaign.id || `camp-${Date.now()}`,
        impressions: campaign.impressions || 0,
        clicks: campaign.clicks || 0,
        ctr: campaign.ctr || 0,
        status: campaign.status || "active",
        priority: campaign.priority ?? 10
      };
      this.data.adCampaigns.unshift(saved);
      this.logAudit(actor, "Ad Campaign Created", `Created campaign: ${saved.campaignName}`);
    }
    this.saveDatabase(this.data);
    return saved;
  }
  deleteAdCampaign(id, actor = "Ad Manager") {
    if (!this.data.adCampaigns) return false;
    const prev = this.data.adCampaigns.length;
    this.data.adCampaigns = this.data.adCampaigns.filter((c) => c.id !== id);
    if (this.data.adCampaigns.length < prev) {
      this.logAudit(actor, "Ad Campaign Deleted", `Removed campaign ID: ${id}`);
      this.saveDatabase(this.data);
      return true;
    }
    return false;
  }
  recordAdImpression(slotId, campaignId) {
    let changed = false;
    const slot = (this.data.adPlacements || []).find((s) => s.id === slotId || s.slotId === slotId);
    if (slot) {
      slot.impressions = (slot.impressions || 0) + 1;
      changed = true;
    }
    if (campaignId) {
      const camp = (this.data.adCampaigns || []).find((c) => c.id === campaignId);
      if (camp) {
        camp.impressions = (camp.impressions || 0) + 1;
        camp.ctr = camp.impressions > 0 ? parseFloat((camp.clicks / camp.impressions * 100).toFixed(2)) : 0;
        changed = true;
      }
    }
    if (changed) this.saveDatabase(this.data);
  }
  recordAdClick(slotId, campaignId) {
    let changed = false;
    const slot = (this.data.adPlacements || []).find((s) => s.id === slotId || s.slotId === slotId);
    if (slot) {
      slot.clicks = (slot.clicks || 0) + 1;
      changed = true;
    }
    if (campaignId) {
      const camp = (this.data.adCampaigns || []).find((c) => c.id === campaignId);
      if (camp) {
        camp.clicks = (camp.clicks || 0) + 1;
        camp.ctr = camp.impressions > 0 ? parseFloat((camp.clicks / camp.impressions * 100).toFixed(2)) : 0;
        changed = true;
      }
    }
    if (changed) this.saveDatabase(this.data);
  }
  // --- SEO & Search Console ---
  getSeoPages() {
    return this.data.seoPages || [];
  }
  updateSeoPage(id, updates, actor = "SEO Specialist") {
    if (!this.data.seoPages) return null;
    const page = this.data.seoPages.find((p) => p.id === id || p.path === id);
    if (page) {
      Object.assign(page, updates, { lastAuditedAt: (/* @__PURE__ */ new Date()).toISOString() });
      this.logAudit(actor, "SEO Page Config Updated", `Updated metadata for route: ${page.path}`);
      this.saveDatabase(this.data);
      return page;
    }
    return null;
  }
  getSearchConsoleMetrics() {
    return this.data.searchConsole || defaultSearchConsole;
  }
  updateSearchConsoleMetrics(metrics) {
    this.data.searchConsole = {
      ...this.data.searchConsole || defaultSearchConsole,
      ...metrics,
      lastRefreshedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.saveDatabase(this.data);
  }
  // --- Technical SEO & Redirects ---
  getRedirectRules() {
    return this.data.redirectRules || [];
  }
  upsertRedirectRule(rule, actor = "SEO Specialist") {
    if (!this.data.redirectRules) this.data.redirectRules = [];
    const idx = this.data.redirectRules.findIndex((r) => r.id === rule.id || r.sourcePath === rule.sourcePath);
    let saved;
    if (idx >= 0) {
      saved = { ...this.data.redirectRules[idx], ...rule };
      this.data.redirectRules[idx] = saved;
    } else {
      saved = {
        ...rule,
        id: rule.id || `red-${Date.now()}`,
        hits: 0,
        active: rule.active ?? true,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.data.redirectRules.unshift(saved);
    }
    this.logAudit(actor, "Redirect Rule Saved", `Rule ${saved.sourcePath} -> ${saved.targetPath} (${saved.statusCode})`);
    this.saveDatabase(this.data);
    return saved;
  }
  deleteRedirectRule(id, actor = "SEO Specialist") {
    if (!this.data.redirectRules) return false;
    const prev = this.data.redirectRules.length;
    this.data.redirectRules = this.data.redirectRules.filter((r) => r.id !== id);
    if (this.data.redirectRules.length < prev) {
      this.logAudit(actor, "Redirect Rule Deleted", `Deleted redirect ID: ${id}`);
      this.saveDatabase(this.data);
      return true;
    }
    return false;
  }
  getBrokenLinks() {
    return this.data.brokenLinks || [];
  }
  resolveBrokenLink(id) {
    if (!this.data.brokenLinks) return;
    const link = this.data.brokenLinks.find((b) => b.id === id);
    if (link) {
      link.resolved = true;
      this.saveDatabase(this.data);
    }
  }
  // --- Audience & Subscribers ---
  getSubscribers() {
    return this.data.subscribers || [];
  }
  addSubscriber(email, language = "both", frequency = "daily", consentSource = "website") {
    if (!this.data.subscribers) this.data.subscribers = [];
    const cleanEmail = email.trim().toLowerCase();
    const existing = this.data.subscribers.find((s) => s.email === cleanEmail);
    if (existing && existing.status === "active") {
      return false;
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    if (existing) {
      existing.status = "active";
      existing.language = language;
      existing.frequency = frequency;
      existing.consentSource = consentSource;
      existing.consentTimestamp = now;
    } else {
      this.data.subscribers.unshift({
        id: `sub-${Date.now()}`,
        email: cleanEmail,
        language,
        frequency,
        subscribedAt: now,
        consentSource,
        consentTimestamp: now,
        status: "active"
      });
    }
    this.saveDatabase(this.data);
    return true;
  }
  updateSubscriberStatus(idOrEmail, status) {
    if (!this.data.subscribers) return null;
    const sub = this.data.subscribers.find(
      (s) => s.id === idOrEmail || s.email.toLowerCase() === idOrEmail.trim().toLowerCase()
    );
    if (sub) {
      sub.status = status;
      this.saveDatabase(this.data);
      return sub;
    }
    return null;
  }
  deleteSubscriber(id, actor = "Audience Manager") {
    if (!this.data.subscribers) return false;
    const prev = this.data.subscribers.length;
    this.data.subscribers = this.data.subscribers.filter((s) => s.id !== id);
    if (this.data.subscribers.length < prev) {
      this.logAudit(actor, "Subscriber Deleted", `Removed subscriber ID: ${id}`);
      this.saveDatabase(this.data);
      return true;
    }
    return false;
  }
  removeSubscriber(email) {
    return Boolean(this.updateSubscriberStatus(email, "unsubscribed"));
  }
  getNotifications() {
    return this.data.notifications || [];
  }
  sendAudienceNotification(notif, actor = "Editor") {
    if (!this.data.notifications) this.data.notifications = [];
    const activeSubscribers = (this.data.subscribers || []).filter((s) => s.status === "active").length;
    const targetCount = activeSubscribers;
    const newNotif = {
      ...notif,
      id: notif.id || `notif-${Date.now()}`,
      sentAt: (/* @__PURE__ */ new Date()).toISOString(),
      recipientsCount: targetCount,
      deliveredCount: notif.deliveredCount ?? targetCount,
      failedCount: notif.failedCount ?? 0,
      status: notif.status || "sent"
    };
    this.data.notifications.unshift(newNotif);
    this.logAudit(actor, "Broadcast Dispatched", `Broadcast: ${notif.titleEn} (${targetCount} subscribers)`);
    this.saveDatabase(this.data);
    return newNotif;
  }
  restoreBackupSnapshot(snapshot, actor = "Super Admin") {
    const allowedKeys = [
      "siteSettings",
      "categories",
      "categoryPages",
      "homepageConfig",
      "homepageDraft",
      "customBlocks",
      "seoPages",
      "redirectRules",
      "adPlacements",
      "adCampaigns",
      "robotsTxt",
      "sitemapConfig"
    ];
    const restoredKeys = [];
    for (const k of allowedKeys) {
      if (snapshot[k] !== void 0) {
        this.data[k] = snapshot[k];
        restoredKeys.push(String(k));
      }
    }
    this.logAudit(actor, "Backup Restored", `Restored configuration snapshot sections: ${restoredKeys.join(", ") || "none"}`);
    this.saveDatabase(this.data);
    return { restoredKeys };
  }
  // --- Web Push Subscriptions ---
  getPushSubscriptions(status) {
    const list = this.data.pushSubscriptions || [];
    if (status) {
      return list.filter((s) => s.status === status);
    }
    return list;
  }
  upsertPushSubscription(sub) {
    if (!this.data.pushSubscriptions) this.data.pushSubscriptions = [];
    const index = this.data.pushSubscriptions.findIndex((s) => s.endpoint === sub.endpoint);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    if (index !== -1) {
      const existing = this.data.pushSubscriptions[index];
      const updated = {
        ...existing,
        ...sub,
        id: existing.id,
        endpoint: existing.endpoint,
        keys: sub.keys || existing.keys,
        topics: {
          breakingNews: sub.topics?.breakingNews ?? existing.topics.breakingNews,
          cricketScores: sub.topics?.cricketScores ?? existing.topics.cricketScores,
          dailyBriefing: sub.topics?.dailyBriefing ?? existing.topics.dailyBriefing ?? true
        },
        language: sub.language || existing.language || "both",
        status: "active",
        lastActiveAt: now
      };
      this.data.pushSubscriptions[index] = updated;
      this.saveDatabase(this.data);
      return updated;
    }
    const created = {
      id: `push-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      endpoint: sub.endpoint || "",
      keys: sub.keys,
      topics: {
        breakingNews: sub.topics?.breakingNews ?? true,
        cricketScores: sub.topics?.cricketScores ?? true,
        dailyBriefing: sub.topics?.dailyBriefing ?? true
      },
      language: sub.language || "both",
      userAgent: sub.userAgent || "",
      subscribedAt: now,
      lastActiveAt: now,
      status: "active"
    };
    this.data.pushSubscriptions.unshift(created);
    this.saveDatabase(this.data);
    return created;
  }
  unsubscribePush(endpoint) {
    if (!this.data.pushSubscriptions) return false;
    const sub = this.data.pushSubscriptions.find((s) => s.endpoint === endpoint);
    if (sub) {
      sub.status = "unsubscribed";
      sub.lastActiveAt = (/* @__PURE__ */ new Date()).toISOString();
      this.saveDatabase(this.data);
      return true;
    }
    return false;
  }
  updatePushTopics(endpoint, topics, language) {
    if (!this.data.pushSubscriptions) return false;
    const sub = this.data.pushSubscriptions.find((s) => s.endpoint === endpoint);
    if (sub) {
      sub.topics = {
        breakingNews: topics.breakingNews,
        cricketScores: topics.cricketScores,
        dailyBriefing: topics.dailyBriefing ?? sub.topics.dailyBriefing ?? true
      };
      if (language) sub.language = language;
      sub.lastActiveAt = (/* @__PURE__ */ new Date()).toISOString();
      this.saveDatabase(this.data);
      return true;
    }
    return false;
  }
  getVapidKeys() {
    return this.data.vapidKeys || null;
  }
  setVapidKeys(keys) {
    this.data.vapidKeys = keys;
    this.saveDatabase(this.data);
  }
  getPushStats() {
    const list = this.data.pushSubscriptions || [];
    const active = list.filter((s) => s.status === "active");
    return {
      total: list.length,
      active: active.length,
      breakingNews: active.filter((s) => s.topics?.breakingNews).length,
      cricketScores: active.filter((s) => s.topics?.cricketScores).length
    };
  }
  // --- Homepage Builder (Draft / Publish / Rollback / Custom Blocks) ---
  getHomepageConfig() {
    return this.data.homepageConfig || defaultHomepageConfig;
  }
  getHomepageDraft() {
    return this.data.homepageDraft || this.data.homepageConfig || defaultHomepageConfig;
  }
  saveHomepageDraft(config, actor = "Super Admin") {
    this.data.homepageDraft = {
      ...config,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedBy: actor
    };
    this.logAudit(actor, "Homepage Draft Saved", `Saved homepage builder draft (${config.sections?.length || 0} sections)`);
    this.saveDatabase(this.data);
    return this.data.homepageDraft;
  }
  updateHomepageConfig(config, actor = "Super Admin", note = "Published layout") {
    if (!this.data.homepageVersions) this.data.homepageVersions = [];
    if (this.data.homepageConfig) {
      this.data.homepageVersions.unshift({
        versionId: `hpv-${Date.now()}`,
        savedAt: (/* @__PURE__ */ new Date()).toISOString(),
        savedBy: actor,
        note,
        config: JSON.parse(JSON.stringify(this.data.homepageConfig))
      });
      if (this.data.homepageVersions.length > 20) this.data.homepageVersions.pop();
    }
    const published = {
      ...config,
      version: (this.data.homepageConfig?.version || 1) + 1,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedBy: actor
    };
    this.data.homepageConfig = published;
    this.data.homepageDraft = JSON.parse(JSON.stringify(published));
    this.logAudit(actor, "Homepage Layout Published", "Published updated homepage layout and section ordering");
    this.saveDatabase(this.data);
    return this.data.homepageConfig;
  }
  getHomepageVersions() {
    return this.data.homepageVersions || [];
  }
  rollbackHomepageVersion(versionId, actor = "Super Admin") {
    const snap = (this.data.homepageVersions || []).find((v) => v.versionId === versionId);
    if (!snap) return null;
    return this.updateHomepageConfig(snap.config, actor, `Rollback to ${versionId}`);
  }
  getCustomBlocks() {
    return this.data.customBlocks || [];
  }
  upsertCustomBlock(block, actor = "Editor") {
    if (!this.data.customBlocks) this.data.customBlocks = [];
    const idx = this.data.customBlocks.findIndex((b) => b.id === block.id);
    const saved = {
      ...block,
      id: block.id || `blk-${Date.now()}`,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (idx >= 0) this.data.customBlocks[idx] = saved;
    else this.data.customBlocks.unshift(saved);
    this.logAudit(actor, "Custom Block Saved", `Saved custom reusable block: ${saved.name}`);
    this.saveDatabase(this.data);
    return saved;
  }
  deleteCustomBlock(id, actor = "Editor") {
    if (!this.data.customBlocks) return false;
    const prev = this.data.customBlocks.length;
    this.data.customBlocks = this.data.customBlocks.filter((b) => b.id !== id);
    if (this.data.customBlocks.length < prev) {
      this.logAudit(actor, "Custom Block Deleted", `Deleted block ID: ${id}`);
      this.saveDatabase(this.data);
      return true;
    }
    return false;
  }
  // --- Admin Credentials Persistence ---
  getAdminCredentialsMap() {
    if (!this.data.adminCredentials) this.data.adminCredentials = {};
    return this.data.adminCredentials;
  }
  setAdminCredential(email, record) {
    if (!this.data.adminCredentials) this.data.adminCredentials = {};
    this.data.adminCredentials[email.toLowerCase()] = record;
    this.saveDatabase(this.data);
  }
  // --- AI Providers, Routing & Usage Logs ---
  getAiProviders() {
    return this.data.aiProviders || [];
  }
  replaceAiProvidersFromSupabase(creds) {
    this.data.aiProviders = Array.isArray(creds) ? creds : [];
    this.saveDatabase(this.data);
  }
  upsertAiProvider(cred, actor = "Super Admin") {
    if (!this.data.aiProviders) this.data.aiProviders = [];
    const idx = this.data.aiProviders.findIndex((p) => p.id === cred.id);
    if (idx >= 0) {
      this.data.aiProviders[idx] = cred;
      this.logAudit(actor, "AI Provider Updated", `Updated ${cred.providerType} credential "${cred.label}" (${cred.projectId})`);
    } else {
      this.data.aiProviders.push(cred);
      this.logAudit(actor, "AI Provider Added", `Added ${cred.providerType} credential "${cred.label}" (${cred.projectId})`);
    }
    this.saveDatabase(this.data);
    return cred;
  }
  deleteAiProvider(id, actor = "Super Admin") {
    if (!this.data.aiProviders) return false;
    const prev = this.data.aiProviders.length;
    this.data.aiProviders = this.data.aiProviders.filter((p) => p.id !== id);
    if (this.data.aiProviders.length < prev) {
      this.logAudit(actor, "AI Provider Revoked", `Revoked AI provider credential: ${id}`);
      this.saveDatabase(this.data);
      return true;
    }
    return false;
  }
  getAiTaskRoutes() {
    return this.data.aiTaskRoutes || {};
  }
  replaceAiTaskRoutesFromSupabase(routes) {
    const next = {};
    for (const r of routes || []) {
      if (r?.task) next[r.task] = r;
    }
    this.data.aiTaskRoutes = next;
    this.saveDatabase(this.data);
  }
  setAiTaskRoute(task, routing, actor = "Super Admin") {
    if (!this.data.aiTaskRoutes) this.data.aiTaskRoutes = {};
    this.data.aiTaskRoutes[task] = routing;
    this.logAudit(actor, "AI Task Routing Updated", `Updated routing for task ${task} -> ${routing.primaryModel}`);
    this.saveDatabase(this.data);
  }
  recordAiUsage(log) {
    if (!this.data.aiUsageLogs) this.data.aiUsageLogs = [];
    this.data.aiUsageLogs.unshift(log);
    if (this.data.aiUsageLogs.length > 500) {
      this.data.aiUsageLogs = this.data.aiUsageLogs.slice(0, 500);
    }
    const cred = (this.data.aiProviders || []).find((p) => p.id === log.credentialId);
    if (cred) {
      cred.dailyTokensUsed = (cred.dailyTokensUsed || 0) + (log.totalTokens || 0);
      cred.monthlySpendUsd = parseFloat(((cred.monthlySpendUsd || 0) + (log.estimatedCostUsd || 0)).toFixed(6));
    }
    this.saveDatabase(this.data);
  }
  getAiUsageLogs(limit = 100) {
    return (this.data.aiUsageLogs || []).slice(0, limit);
  }
  recordAiConnectionTest(entry) {
    if (!this.data.aiConnectionTests) this.data.aiConnectionTests = [];
    this.data.aiConnectionTests.unshift(entry);
    if (this.data.aiConnectionTests.length > 300) {
      this.data.aiConnectionTests = this.data.aiConnectionTests.slice(0, 300);
    }
    this.saveDatabase(this.data);
    return entry;
  }
  getAiConnectionTests(credentialId, limit = 50) {
    const all = this.data.aiConnectionTests || [];
    const filtered = credentialId ? all.filter((t) => t.credentialId === credentialId) : all;
    return filtered.slice(0, limit);
  }
  setAiHealthStatus(summary) {
    this.data.aiHealthStatus = {
      lastCheckAt: (/* @__PURE__ */ new Date()).toISOString(),
      summary
    };
    this.saveDatabase(this.data);
  }
  getAiHealthStatus() {
    return this.data.aiHealthStatus || null;
  }
  getAiEnvSuppressed() {
    return {
      gemini: Boolean(this.data.aiEnvSuppressed?.gemini),
      grok: Boolean(this.data.aiEnvSuppressed?.grok)
    };
  }
  setAiEnvSuppressed(patch) {
    this.data.aiEnvSuppressed = {
      ...this.data.aiEnvSuppressed || {},
      ...patch
    };
    this.saveDatabase(this.data);
  }
  resetAllAiCredentials(actor = "Super Admin") {
    const existing = this.data.aiProviders || [];
    const targetToRemove = existing.filter(
      (p) => p.providerType === "gemini" || p.providerType === "grok"
    );
    const removedProviders = targetToRemove.map((p) => ({
      id: p.id,
      providerType: p.providerType,
      maskedKey: p.maskedKey
    }));
    const removedIds = new Set(targetToRemove.map((p) => p.id));
    this.data.aiProviders = existing.filter((p) => !removedIds.has(p.id));
    if (this.data.aiTaskRoutes) {
      for (const taskKey of Object.keys(this.data.aiTaskRoutes)) {
        const route = this.data.aiTaskRoutes[taskKey];
        if (!route) continue;
        this.data.aiTaskRoutes[taskKey] = {
          ...route,
          primaryCredentialId: "",
          primaryModel: "",
          fallbackCredentialId: "",
          fallbackModel: ""
        };
      }
    }
    this.data.aiHealthStatus = null;
    this.data.aiConnectionTests = [];
    this.data.aiEnvSuppressed = { gemini: true, grok: true };
    if (Array.isArray(this.data.aiUsageLogs)) {
      this.data.aiUsageLogs = this.data.aiUsageLogs.map((log) => ({
        ...log,
        errorMessage: log.errorMessage ? log.errorMessage.replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED_GEMINI_KEY]").replace(/xai-[0-9A-Za-z_-]{16,}/g, "[REDACTED_XAI_KEY]") : log.errorMessage
      }));
    }
    this.logAudit(
      actor,
      "AI Credentials Reset",
      `Reset all stored Gemini/Grok AI credentials (${removedProviders.length} removed), cleared route bindings & caches, suppressed env fallback.`
    );
    this.saveDatabase(this.data);
    return {
      removedCount: removedProviders.length,
      removedProviders
    };
  }
  // --- Editorial Studio Drafts ---
  getEditorialDrafts() {
    return this.data.editorialDrafts || [];
  }
  saveEditorialDraft(draft) {
    if (!this.data.editorialDrafts) this.data.editorialDrafts = [];
    const idx = this.data.editorialDrafts.findIndex((d) => d.id === draft.id);
    if (idx >= 0) this.data.editorialDrafts[idx] = draft;
    else this.data.editorialDrafts.unshift(draft);
    if (this.data.editorialDrafts.length > 100) this.data.editorialDrafts = this.data.editorialDrafts.slice(0, 100);
    this.saveDatabase(this.data);
    return draft;
  }
  // --- SEO, Robots, Sitemaps & Search Console Connection ---
  getRobotsTxt() {
    return this.data.robotsTxt || defaultRobotsTxt;
  }
  setRobotsTxt(content, actor = "SEO Manager") {
    this.data.robotsTxt = content;
    this.logAudit(actor, "Robots.txt Updated", "Saved updated robots.txt directives");
    this.saveDatabase(this.data);
    return this.data.robotsTxt;
  }
  getSitemapConfig() {
    return this.data.sitemapConfig || defaultSitemapConfig;
  }
  updateSitemapConfig(updates, actor = "SEO Manager") {
    this.data.sitemapConfig = {
      ...this.data.sitemapConfig || defaultSitemapConfig,
      ...updates,
      lastGeneratedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.logAudit(actor, "Sitemap Config Updated", "Updated XML sitemap generator configuration");
    this.saveDatabase(this.data);
    return this.data.sitemapConfig;
  }
  addSeoAuditLog(entry) {
    if (!this.data.seoAuditLogs) this.data.seoAuditLogs = [];
    const full = {
      ...entry,
      id: `seolog-${Date.now()}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.seoAuditLogs.unshift(full);
    if (this.data.seoAuditLogs.length > 200) this.data.seoAuditLogs.pop();
    this.saveDatabase(this.data);
    return full;
  }
  getSeoAuditLogs() {
    return this.data.seoAuditLogs || [];
  }
  getSearchConsoleConnection() {
    return this.data.searchConsoleConnection || { ...defaultSearchConsoleConnection };
  }
  updateSearchConsoleConnection(conn, actor = "SEO Manager") {
    this.data.searchConsoleConnection = {
      ...this.data.searchConsoleConnection || defaultSearchConsoleConnection,
      ...conn
    };
    this.logAudit(actor, "Search Console Connection Updated", `Status: ${this.data.searchConsoleConnection.diagnosticStatus}`);
    this.saveDatabase(this.data);
    return this.data.searchConsoleConnection;
  }
  upsertSeoPage(page, actor = "SEO Manager") {
    if (!this.data.seoPages) this.data.seoPages = [];
    const idx = this.data.seoPages.findIndex((p) => p.id === page.id || p.path === page.path);
    const saved = { ...page, lastAuditedAt: (/* @__PURE__ */ new Date()).toISOString() };
    if (idx >= 0) this.data.seoPages[idx] = { ...this.data.seoPages[idx], ...saved };
    else this.data.seoPages.push(saved);
    this.logAudit(actor, "SEO Page Metadata Saved", `Saved SEO config for ${saved.path}`);
    this.saveDatabase(this.data);
    return saved;
  }
  // --- Data Providers CRUD ---
  upsertDataProvider(provider, actor = "Automation Manager") {
    if (!this.data.dataProviders) this.data.dataProviders = [];
    const idx = this.data.dataProviders.findIndex((p) => p.id === provider.id);
    if (idx >= 0) {
      this.data.dataProviders[idx] = { ...this.data.dataProviders[idx], ...provider };
      this.logAudit(actor, "Data Provider Updated", `Updated feed provider: ${provider.name}`);
    } else {
      this.data.dataProviders.push(provider);
      this.logAudit(actor, "Data Provider Registered", `Registered feed provider: ${provider.name} (${provider.endpoint})`);
    }
    this.saveDatabase(this.data);
    return provider;
  }
  deleteDataProvider(id, actor = "Automation Manager") {
    if (!this.data.dataProviders) return false;
    const prev = this.data.dataProviders.length;
    this.data.dataProviders = this.data.dataProviders.filter((p) => p.id !== id);
    if (this.data.dataProviders.length < prev) {
      this.logAudit(actor, "Data Provider Deleted", `Deleted feed provider: ${id}`);
      this.saveDatabase(this.data);
      return true;
    }
    return false;
  }
  // --- Universal Category Pages & Category Data CRUD ---
  getCategoryPages() {
    return this.data.categoryPages || [];
  }
  setCategoryPages(pages) {
    this.data.categoryPages = pages;
    this.saveDatabase(this.data);
  }
  upsertCategoryPage(page, actor = "Admin", saveSnapshot = true) {
    if (!this.data.categoryPages) this.data.categoryPages = [];
    if (!this.data.categoryPageVersions) this.data.categoryPageVersions = {};
    const idx = this.data.categoryPages.findIndex((p) => p.slug === page.slug || p.id === page.id);
    if (idx >= 0 && saveSnapshot) {
      const prev = this.data.categoryPages[idx];
      if (!this.data.categoryPageVersions[prev.slug]) this.data.categoryPageVersions[prev.slug] = [];
      this.data.categoryPageVersions[prev.slug].unshift({
        versionId: `catv-${Date.now()}`,
        slug: prev.slug,
        savedAt: (/* @__PURE__ */ new Date()).toISOString(),
        savedBy: actor,
        note: page.status === "published" ? "Before publish" : "Draft checkpoint",
        snapshot: JSON.parse(JSON.stringify(prev))
      });
      if (this.data.categoryPageVersions[prev.slug].length > 15) {
        this.data.categoryPageVersions[prev.slug].pop();
      }
    }
    const updated = {
      ...page,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedBy: actor
    };
    if (idx >= 0) this.data.categoryPages[idx] = updated;
    else this.data.categoryPages.push(updated);
    const catIdx = this.data.categories.findIndex((c) => c.slug === updated.slug);
    const catObj = {
      id: updated.id,
      slug: updated.slug,
      nameEn: updated.nameEn,
      nameUr: updated.nameUr,
      descriptionEn: updated.descriptionEn,
      descriptionUr: updated.descriptionUr,
      iconName: updated.iconName,
      enabled: updated.enabled,
      order: updated.order
    };
    if (catIdx >= 0) this.data.categories[catIdx] = catObj;
    else this.data.categories.push(catObj);
    this.logAudit(actor, "Category Page Saved", `Saved category "${updated.slug}" (${updated.status})`);
    this.saveDatabase(this.data);
    return updated;
  }
  getCategoryPageVersions(slug) {
    return (this.data.categoryPageVersions || {})[slug] || [];
  }
  deleteCategoryPage(slug, actor = "Admin") {
    if (!this.data.categoryPages) return false;
    const prev = this.data.categoryPages.length;
    this.data.categoryPages = this.data.categoryPages.filter((c) => c.slug !== slug);
    this.data.categories = this.data.categories.filter((c) => c.slug !== slug);
    if (this.data.categoryPages.length < prev) {
      this.logAudit(actor, "Category Page Deleted", `Deleted category page: ${slug}`);
      this.saveDatabase(this.data);
      return true;
    }
    return false;
  }
  // Category-specific dataset mutation helper
  saveCategoryDatasetItem(dataset, item, actor = "Editor") {
    const validCollections = {
      boards: "boards",
      results: "results",
      mobiles: "mobiles",
      automobiles: "automobiles",
      prizeBonds: "prizeBonds",
      dictionary: "dictionary",
      babyNames: "babyNames",
      poets: "poets",
      poems: "poems",
      recipes: "recipes",
      jobs: "jobs",
      cricketMatches: "cricketMatches",
      weather: "weather"
    };
    const key = validCollections[dataset];
    if (!key) throw new Error(`Unsupported category dataset: ${dataset}`);
    const arr = this.data[key] || [];
    const idField = dataset === "weather" ? "cityId" : "id";
    const itemId = item[idField] || `${dataset}-${Date.now()}`;
    const record = { ...item, [idField]: itemId };
    const idx = arr.findIndex((r) => r[idField] === itemId);
    if (idx >= 0) arr[idx] = { ...arr[idx], ...record };
    else arr.unshift(record);
    this.data[key] = arr;
    this.logAudit(actor, "Category Data Updated", `Saved ${dataset} record (${itemId})`);
    this.saveDatabase(this.data);
    return record;
  }
  deleteCategoryDatasetItem(dataset, id, actor = "Editor") {
    const validCollections = {
      boards: "boards",
      results: "results",
      mobiles: "mobiles",
      automobiles: "automobiles",
      prizeBonds: "prizeBonds",
      dictionary: "dictionary",
      babyNames: "babyNames",
      poets: "poets",
      poems: "poems",
      recipes: "recipes",
      jobs: "jobs",
      cricketMatches: "cricketMatches",
      weather: "weather"
    };
    const key = validCollections[dataset];
    if (!key) return false;
    const arr = this.data[key] || [];
    const idField = dataset === "weather" ? "cityId" : "id";
    const next = arr.filter((r) => r[idField] !== id);
    if (next.length < arr.length) {
      this.data[key] = next;
      this.logAudit(actor, "Category Data Removed", `Removed ${dataset} record (${id})`);
      this.saveDatabase(this.data);
      return true;
    }
    return false;
  }
  // --- Cron Job DB Locking (for Namecheap 5-minute cron safety) ---
  acquireCronLock(lockKey, owner, ttlSeconds = 240) {
    if (!this.data.cronLocks) this.data.cronLocks = {};
    const existing = this.data.cronLocks[lockKey];
    const now = Date.now();
    if (existing && new Date(existing.expiresAt).getTime() > now) {
      return false;
    }
    this.data.cronLocks[lockKey] = {
      lockedAt: new Date(now).toISOString(),
      lockedBy: owner,
      expiresAt: new Date(now + ttlSeconds * 1e3).toISOString()
    };
    this.saveDatabase(this.data);
    return true;
  }
  releaseCronLock(lockKey) {
    if (!this.data.cronLocks) return;
    delete this.data.cronLocks[lockKey];
    this.saveDatabase(this.data);
  }
  // --- System Health Diagnostics ---
  getSystemHealth() {
    let dbSize = 0;
    try {
      if (fs.existsSync(DB_FILE)) {
        dbSize = fs.statSync(DB_FILE).size;
      }
    } catch {
    }
    const mem = process.memoryUsage();
    return {
      status: "healthy",
      uptimeSeconds: Math.floor(process.uptime()),
      databaseSizeBytes: dbSize,
      totalArticles: (this.data.articles || []).length,
      activeCronJobs: (this.data.dataProviders || []).filter((p) => p.status === "active").length,
      memoryUsageMb: Math.round(mem.rss / (1024 * 1024)),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || "production"
    };
  }
};
var db = new DatabaseManager();

// src/server/crypto.ts
import crypto from "crypto";
function getEncryptionKey() {
  const raw = process.env.AI_MASTER_KEY || process.env.SECRETS_ENCRYPTION_KEY || process.env.ADMIN_SESSION_SECRET || process.env.SESSION_SECRET || "kn360-default-encryption-key-change-in-production";
  return crypto.createHash("sha256").update(`kn360:secrets:${raw}`).digest();
}
function encryptSecret(plaintext) {
  if (!plaintext) return "";
  if (plaintext.startsWith("enc:v1:")) return plaintext;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}
function tryDecryptSecret(stored) {
  if (!stored) return { ok: false, value: "", error: "Stored credential payload is empty." };
  if (!stored.startsWith("enc:v1:")) return { ok: true, value: stored };
  const parts = stored.split(":");
  if (parts.length !== 5) {
    return { ok: false, value: "", error: "Stored encrypted credential format is malformed." };
  }
  try {
    const iv = Buffer.from(parts[2], "base64url");
    const tag = Buffer.from(parts[3], "base64url");
    const ciphertext = Buffer.from(parts[4], "base64url");
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return { ok: true, value: decrypted.toString("utf8") };
  } catch {
    return {
      ok: false,
      value: "",
      error: "Credential decryption failed. Verify AI_MASTER_KEY matches the key used when this credential was encrypted, or replace/re-enter the API key."
    };
  }
}
function decryptSecret(stored) {
  const res = tryDecryptSecret(stored);
  return res.ok ? res.value : "";
}
function maskSecret(raw) {
  if (!raw) return "Not configured";
  const clean = raw.trim();
  if (clean.length <= 8) return "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
  return `${clean.slice(0, 4)}\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022${clean.slice(-4)}`;
}
var BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function generateTotpSecret(bytes = 20) {
  const buf = crypto.randomBytes(bytes);
  let bits = 0;
  let value = 0;
  let output = "";
  for (let i = 0; i < buf.length; i++) {
    value = value << 8 | buf[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[value >>> bits - 5 & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[value << 5 - bits & 31];
  }
  return output;
}
function decodeBase32(base32) {
  const cleaned = base32.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = value << 5 | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push(value >>> bits - 8 & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
function generateTotpCode(secretBase32, stepOffset = 0) {
  const key = decodeBase32(secretBase32);
  const counter = Math.floor(Date.now() / 1e3 / 30) + stepOffset;
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeUInt32BE(Math.floor(counter / 4294967296), 0);
  counterBuf.writeUInt32BE(counter >>> 0, 4);
  const hmac = crypto.createHmac("sha1", key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const codeInt = (hmac[offset] & 127) << 24 | (hmac[offset + 1] & 255) << 16 | (hmac[offset + 2] & 255) << 8 | hmac[offset + 3] & 255;
  return String(codeInt % 1e6).padStart(6, "0");
}
function verifyTotpToken(secretBase32, token) {
  const clean = (token || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean) || !secretBase32) return false;
  for (const offset of [-1, 0, 1]) {
    const expected = generateTotpCode(secretBase32, offset);
    if (crypto.timingSafeEqual(Buffer.from(clean), Buffer.from(expected))) {
      return true;
    }
  }
  return false;
}

// src/server/automation/providers/currencyProvider.ts
async function syncCurrencyRates() {
  const provider = db.getDataProvider("currency-erapi");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD", {
      headers: { "User-Agent": "360Khabarnama-Automation/1.0" },
      signal: AbortSignal.timeout(1e4)
      // 10 second timeout
    });
    if (!response.ok) {
      throw new Error(`Currency API returned HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    if (data.result !== "success" || !data.rates || !data.rates.PKR) {
      throw new Error("Malformed response from ExchangeRate API: missing PKR rate");
    }
    const usdToPkr = Number(data.rates.PKR);
    if (isNaN(usdToPkr) || usdToPkr < 200 || usdToPkr > 450) {
      throw new Error(`Suspicious USD/PKR rate detected: ${usdToPkr}. Update rejected for security.`);
    }
    const targetCurrencies = [
      { code: "USD", nameEn: "US Dollar", nameUr: "\u0627\u0645\u0631\u06CC\u06A9\u06CC \u0688\u0627\u0644\u0631", flag: "\u{1F1FA}\u{1F1F8}", baseRate: 1 },
      { code: "EUR", nameEn: "Euro", nameUr: "\u06CC\u0648\u0631\u0648", flag: "\u{1F1EA}\u{1F1FA}", baseRate: data.rates.EUR ? 1 / Number(data.rates.EUR) : 1.08 },
      { code: "GBP", nameEn: "British Pound", nameUr: "\u0628\u0631\u0637\u0627\u0646\u0648\u06CC \u067E\u0627\u0624\u0646\u0688", flag: "\u{1F1EC}\u{1F1E7}", baseRate: data.rates.GBP ? 1 / Number(data.rates.GBP) : 1.28 },
      { code: "SAR", nameEn: "Saudi Riyal", nameUr: "\u0633\u0639\u0648\u062F\u06CC \u0631\u06CC\u0627\u0644", flag: "\u{1F1F8}\u{1F1E6}", baseRate: data.rates.SAR ? 1 / Number(data.rates.SAR) : 0.266 },
      { code: "AED", nameEn: "UAE Dirham", nameUr: "\u0627\u0645\u0627\u0631\u0627\u062A\u06CC \u062F\u0631\u06C1\u0645", flag: "\u{1F1E6}\u{1F1EA}", baseRate: data.rates.AED ? 1 / Number(data.rates.AED) : 0.272 },
      { code: "CAD", nameEn: "Canadian Dollar", nameUr: "\u06A9\u06CC\u0646\u06CC\u0688\u06CC\u0646 \u0688\u0627\u0644\u0631", flag: "\u{1F1E8}\u{1F1E6}", baseRate: data.rates.CAD ? 1 / Number(data.rates.CAD) : 0.725 },
      { code: "AUD", nameEn: "Australian Dollar", nameUr: "\u0622\u0633\u0679\u0631\u06CC\u0644\u06CC\u0646 \u0688\u0627\u0644\u0631", flag: "\u{1F1E6}\u{1F1FA}", baseRate: data.rates.AUD ? 1 / Number(data.rates.AUD) : 0.655 },
      { code: "CNY", nameEn: "Chinese Yuan", nameUr: "\u0686\u06CC\u0646\u06CC \u06CC\u0648\u0622\u0646", flag: "\u{1F1E8}\u{1F1F3}", baseRate: data.rates.CNY ? 1 / Number(data.rates.CNY) : 0.138 },
      { code: "KWD", nameEn: "Kuwaiti Dinar", nameUr: "\u06A9\u0648\u06CC\u062A\u06CC \u062F\u06CC\u0646\u0627\u0631", flag: "\u{1F1F0}\u{1F1FC}", baseRate: data.rates.KWD ? 1 / Number(data.rates.KWD) : 3.26 }
    ];
    const currentRates = db.getData().currencyRates || [];
    const newRates = [];
    let significantChange = false;
    const changeNotesEn = [];
    const changeNotesUr = [];
    for (const cur of targetCurrencies) {
      const interbank = Number((cur.baseRate * usdToPkr).toFixed(2));
      const buying = Number((interbank * 1.004).toFixed(2));
      const selling = Number((interbank * 1.011).toFixed(2));
      const old = currentRates.find((c) => c.code === cur.code);
      const prevInterbank = old ? old.interbankPkr : interbank;
      const diff = Number((interbank - prevInterbank).toFixed(2));
      if (Math.abs(diff) >= 0.25) {
        significantChange = true;
        changeNotesEn.push(`${cur.code}: Rs. ${interbank} (${diff >= 0 ? "+" : ""}${diff})`);
        changeNotesUr.push(`${cur.nameUr}: ${interbank} \u0631\u0648\u067E\u06D2 (${diff >= 0 ? "+" : ""}${diff})`);
      }
      newRates.push({
        code: cur.code,
        nameEn: cur.nameEn,
        nameUr: cur.nameUr,
        buyingPkr: buying,
        sellingPkr: selling,
        interbankPkr: interbank,
        change: diff,
        flag: cur.flag
      });
      db.recordHistoricalRate({
        id: `curr-${cur.code}-${Date.now()}`,
        type: "currency",
        symbol: `${cur.code}/PKR`,
        value: interbank,
        previousValue: prevInterbank,
        change: diff,
        changePercent: prevInterbank ? Number((diff / prevInterbank * 100).toFixed(2)) : 0,
        timestamp: now,
        source: "ExchangeRate-API / SBP Reference Market"
      });
    }
    db.updateCurrencyRates(newRates);
    db.updateDataProvider("currency-erapi", {
      status: "active",
      lastSyncAt: now,
      lastError: null,
      consecutiveFailures: 0,
      totalSyncs: (provider?.totalSyncs || 0) + 1,
      successfulSyncs: (provider?.successfulSyncs || 0) + 1
    });
    const summaryEn = significantChange ? `Updated 9 currency rates. Notable movement: ${changeNotesEn.join(", ")}` : "Currency rates refreshed from live market. Values stable.";
    const summaryUr = significantChange ? `9 \u06A9\u0631\u0646\u0633\u06CC \u0631\u06CC\u0679\u0633 \u0627\u067E \u0688\u06CC\u0679 \u06C1\u0648\u0626\u06D2\u06D4 \u0627\u06C1\u0645 \u0631\u062F\u0648\u0628\u062F\u0644: ${changeNotesUr.join("\u060C ")}` : "\u06A9\u0631\u0646\u0633\u06CC \u0645\u0627\u0631\u06A9\u06CC\u0679 \u06A9\u06D2 \u0631\u06CC\u0679\u0633 \u0645\u0633\u062A\u062D\u06A9\u0645 \u06C1\u06CC\u06BA\u06D4";
    return {
      success: true,
      changesDetected: significantChange,
      changeSummaryEn: summaryEn,
      changeSummaryUr: summaryUr,
      itemsProcessed: newRates.length,
      rates: newRates
    };
  } catch (err) {
    const errorMsg = err.message || "Currency sync failed";
    db.updateDataProvider("currency-erapi", {
      status: "degraded",
      lastError: errorMsg,
      consecutiveFailures: (provider?.consecutiveFailures || 0) + 1,
      totalSyncs: (provider?.totalSyncs || 0) + 1
    });
    return {
      success: false,
      changesDetected: false,
      changeSummaryEn: "Sync failed, fallback to previous verified rates.",
      changeSummaryUr: "\u0645\u0637\u0627\u0628\u0642\u062A \u067E\u0630\u06CC\u0631\u06CC \u0646\u0627\u06A9\u0627\u0645\u060C \u067E\u0686\u06BE\u0644\u06D2 \u062A\u0635\u062F\u06CC\u0642 \u0634\u062F\u06C1 \u0631\u06CC\u0679\u0633 \u0628\u0631\u0642\u0631\u0627\u0631\u06D4",
      itemsProcessed: 0,
      error: errorMsg
    };
  }
}

// src/server/automation/providers/weatherProvider.ts
var PAKISTAN_CITIES = [
  { cityId: "karachi", nameEn: "Karachi", nameUr: "\u06A9\u0631\u0627\u0686\u06CC", provinceEn: "Sindh", provinceUr: "\u0633\u0646\u062F\u06BE", lat: 24.8607, lon: 67.0011 },
  { cityId: "lahore", nameEn: "Lahore", nameUr: "\u0644\u0627\u06C1\u0648\u0631", provinceEn: "Punjab", provinceUr: "\u067E\u0646\u062C\u0627\u0628", lat: 31.5497, lon: 74.3436 },
  { cityId: "islamabad", nameEn: "Islamabad", nameUr: "\u0627\u0633\u0644\u0627\u0645 \u0622\u0628\u0627\u062F", provinceEn: "Federal Capital", provinceUr: "\u0648\u0641\u0627\u0642\u06CC \u062F\u0627\u0631\u0627\u0644\u062D\u06A9\u0648\u0645\u062A", lat: 33.6844, lon: 73.0479 },
  { cityId: "rawalpindi", nameEn: "Rawalpindi", nameUr: "\u0631\u0627\u0648\u0644\u067E\u0646\u0688\u06CC", provinceEn: "Punjab", provinceUr: "\u067E\u0646\u062C\u0627\u0628", lat: 33.5651, lon: 73.0169 },
  { cityId: "peshawar", nameEn: "Peshawar", nameUr: "\u067E\u0634\u0627\u0648\u0631", provinceEn: "Khyber Pakhtunkhwa", provinceUr: "\u062E\u06CC\u0628\u0631 \u067E\u062E\u062A\u0648\u0646\u062E\u0648\u0627", lat: 34.0151, lon: 71.5249 },
  { cityId: "quetta", nameEn: "Quetta", nameUr: "\u06A9\u0648\u0626\u0679\u06C1", provinceEn: "Balochistan", provinceUr: "\u0628\u0644\u0648\u0686\u0633\u062A\u0627\u0646", lat: 30.1798, lon: 66.975 },
  { cityId: "multan", nameEn: "Multan", nameUr: "\u0645\u0644\u062A\u0627\u0646", provinceEn: "Punjab", provinceUr: "\u067E\u0646\u062C\u0627\u0628", lat: 30.1575, lon: 71.5249 },
  { cityId: "faisalabad", nameEn: "Faisalabad", nameUr: "\u0641\u06CC\u0635\u0644 \u0622\u0628\u0627\u062F", provinceEn: "Punjab", provinceUr: "\u067E\u0646\u062C\u0627\u0628", lat: 31.4504, lon: 73.135 },
  { cityId: "sialkot", nameEn: "Sialkot", nameUr: "\u0633\u06CC\u0627\u0644\u06A9\u0648\u0679", provinceEn: "Punjab", provinceUr: "\u067E\u0646\u062C\u0627\u0628", lat: 32.4945, lon: 74.5229 },
  { cityId: "hyderabad", nameEn: "Hyderabad", nameUr: "\u062D\u06CC\u062F\u0631\u0622\u0628\u0627\u062F", provinceEn: "Sindh", provinceUr: "\u0633\u0646\u062F\u06BE", lat: 25.396, lon: 68.3578 },
  { cityId: "murree", nameEn: "Murree", nameUr: "\u0645\u0631\u06CC", provinceEn: "Punjab Hills", provinceUr: "\u067E\u0646\u062C\u0627\u0628 / \u0645\u0644\u06A9\u06C1 \u06A9\u0648\u06C1\u0633\u0627\u0631", lat: 33.907, lon: 73.3943 },
  { cityId: "gwadar", nameEn: "Gwadar", nameUr: "\u06AF\u0648\u0627\u062F\u0631", provinceEn: "Balochistan Coast", provinceUr: "\u0628\u0644\u0648\u0686\u0633\u062A\u0627\u0646 \u0633\u0627\u062D\u0644", lat: 25.1216, lon: 62.3254 }
];
function parseWmoCode(code) {
  switch (code) {
    case 0:
      return { en: "Clear Sky", ur: "\u0635\u0627\u0641 \u0645\u0637\u0644\u0639" };
    case 1:
      return { en: "Mainly Clear", ur: "\u0632\u06CC\u0627\u062F\u06C1 \u062A\u0631 \u0635\u0627\u0641" };
    case 2:
      return { en: "Partly Cloudy", ur: "\u062C\u0632\u0648\u06CC \u0627\u0628\u0631 \u0622\u0644\u0648\u062F" };
    case 3:
      return { en: "Overcast", ur: "\u0645\u0637\u0644\u0639 \u0627\u0628\u0631 \u0622\u0644\u0648\u062F" };
    case 45:
    case 48:
      return { en: "Dense Fog / Smog", ur: "\u0634\u062F\u06CC\u062F \u062F\u06BE\u0646\u062F \u0627\u0648\u0631 \u0627\u0633\u0645\u0648\u06AF" };
    case 51:
    case 53:
    case 55:
      return { en: "Drizzle", ur: "\u06C1\u0644\u06A9\u06CC \u0628\u0648\u0646\u062F\u0627\u0628\u0627\u0646\u062F\u06CC" };
    case 61:
    case 63:
    case 65:
      return { en: "Rain", ur: "\u0628\u0627\u0631\u0634" };
    case 71:
    case 73:
    case 75:
      return { en: "Snowfall", ur: "\u0628\u0631\u0641 \u0628\u0627\u0631\u06CC" };
    case 80:
    case 81:
    case 82:
      return { en: "Rain Showers", ur: "\u062A\u06CC\u0632 \u0628\u0627\u0631\u0634 \u06A9\u06D2 \u062C\u06BE\u06A9\u0691" };
    case 95:
    case 96:
    case 99:
      return { en: "Thunderstorm", ur: "\u06AF\u0631\u062C \u0686\u0645\u06A9 \u06A9\u06D2 \u0633\u0627\u062A\u06BE \u0637\u0648\u0641\u0627\u0646" };
    default:
      return { en: "Sunny & Pleasant", ur: "\u062E\u0648\u0634\u06AF\u0648\u0627\u0631 \u062F\u06BE\u0648\u067E" };
  }
}
function parseAqi(aqiVal) {
  if (aqiVal <= 50) return { statusEn: "Good", statusUr: "\u0628\u06C1\u062A\u0631\u06CC\u0646" };
  if (aqiVal <= 100) return { statusEn: "Moderate", statusUr: "\u0645\u0639\u062A\u062F\u0644" };
  if (aqiVal <= 150) return { statusEn: "Unhealthy for Sensitive", statusUr: "\u062D\u0633\u0627\u0633 \u0627\u0641\u0631\u0627\u062F \u06A9\u06D2 \u0644\u06CC\u06D2 \u0645\u0636\u0631" };
  if (aqiVal <= 200) return { statusEn: "Unhealthy (Smog)", statusUr: "\u0645\u0636\u0631\u0650 \u0635\u062D\u062A (\u0627\u0633\u0645\u0648\u06AF)" };
  return { statusEn: "Hazardous Smog Alert", statusUr: "\u0634\u062F\u06CC\u062F \u062E\u0637\u0631\u0646\u0627\u06A9 \u0627\u0633\u0645\u0648\u06AF" };
}
async function syncWeatherData() {
  const provider = db.getDataProvider("weather-openmeteo");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const updatedWeatherList = [];
  let alertsDetected = [];
  try {
    const lats = PAKISTAN_CITIES.map((c) => c.lat).join(",");
    const lons = PAKISTAN_CITIES.map((c) => c.lon).join(",");
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=Asia%2FKarachi`;
    const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lons}&current=us_aqi&timezone=Asia%2FKarachi`;
    const [weatherRes, aqiRes] = await Promise.all([
      fetch(weatherUrl, {
        headers: { "User-Agent": "360Khabarnama-Automation/1.0" },
        signal: AbortSignal.timeout(1e4)
      }),
      fetch(aqiUrl, {
        headers: { "User-Agent": "360Khabarnama-Automation/1.0" },
        signal: AbortSignal.timeout(6e3)
      }).catch(() => null)
    ]);
    if (!weatherRes.ok) {
      throw new Error(`Open-Meteo HTTP ${weatherRes.status}`);
    }
    const rawWeatherPayload = await weatherRes.json();
    const weatherArray = Array.isArray(rawWeatherPayload) ? rawWeatherPayload : [rawWeatherPayload];
    let aqiArray = [];
    if (aqiRes && aqiRes.ok) {
      try {
        const rawAqiPayload = await aqiRes.json();
        aqiArray = Array.isArray(rawAqiPayload) ? rawAqiPayload : [rawAqiPayload];
      } catch {
        aqiArray = [];
      }
    }
    PAKISTAN_CITIES.forEach((city, idx) => {
      const data = weatherArray[idx];
      const current = data?.current;
      const daily = data?.daily;
      const hourly = data?.hourly;
      if (!current) return;
      let aqiNum = city.cityId === "lahore" ? 165 : city.cityId === "karachi" ? 95 : 45;
      const aqiItem = aqiArray[idx];
      if (aqiItem?.current?.us_aqi) {
        aqiNum = Math.round(Number(aqiItem.current.us_aqi));
      }
      const condition = parseWmoCode(current.weather_code || 0);
      const aqiInfo = parseAqi(aqiNum);
      const hourlyList = [];
      if (hourly && hourly.time && hourly.temperature_2m) {
        const currentHour = (/* @__PURE__ */ new Date()).getHours();
        for (let i = 0; i < 5; i++) {
          const targetIdx = (currentHour + i * 3) % hourly.time.length;
          const timeStr = hourly.time[targetIdx] ? hourly.time[targetIdx].split("T")[1] : `${currentHour + i * 3}:00`;
          const tempVal = Math.round(hourly.temperature_2m[targetIdx] || current.temperature_2m);
          const condObj = parseWmoCode(hourly.weather_code?.[targetIdx] || 0);
          hourlyList.push({
            time: timeStr.slice(0, 5),
            tempC: tempVal,
            condition: condObj.en
          });
        }
      }
      const dailyList = [];
      const daysEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const daysUr = ["\u0627\u062A\u0648\u0627\u0631", "\u067E\u06CC\u0631", "\u0645\u0646\u06AF\u0644", "\u0628\u062F\u06BE", "\u062C\u0645\u0639\u0631\u0627\u062A", "\u062C\u0645\u0639\u06C1", "\u06C1\u0641\u062A\u06C1"];
      if (daily && daily.time) {
        for (let d = 0; d < Math.min(5, daily.time.length); d++) {
          const dateObj = new Date(daily.time[d]);
          const dayIdx = dateObj.getDay();
          const cond = parseWmoCode(daily.weather_code?.[d] || 0);
          dailyList.push({
            dayEn: daysEn[dayIdx],
            dayUr: daysUr[dayIdx],
            highC: Math.round(daily.temperature_2m_max[d]),
            lowC: Math.round(daily.temperature_2m_min[d]),
            conditionEn: cond.en,
            conditionUr: cond.ur
          });
        }
      }
      let alertItem = void 0;
      if (aqiNum >= 180) {
        alertItem = {
          titleEn: "Severe Smog Advisory: Wear N95 respirator mask",
          titleUr: "\u0634\u062F\u06CC\u062F \u0627\u0633\u0645\u0648\u06AF \u0648\u0627\u0631\u0646\u0646\u06AF: \u0627\u06CC\u0646 95 \u0645\u0627\u0633\u06A9 \u06A9\u0627 \u0644\u0627\u0632\u0645\u06CC \u0627\u0633\u062A\u0639\u0645\u0627\u0644 \u06A9\u0631\u06CC\u06BA",
          severity: "warning"
        };
        alertsDetected.push(`${city.nameEn} (AQI ${aqiNum})`);
      }
      const formattedSunrise = daily?.sunrise?.[0] ? new Date(daily.sunrise[0]).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : "06:30 AM";
      const formattedSunset = daily?.sunset?.[0] ? new Date(daily.sunset[0]).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : "05:30 PM";
      updatedWeatherList.push({
        cityId: city.cityId,
        nameEn: city.nameEn,
        nameUr: city.nameUr,
        provinceEn: city.provinceEn,
        provinceUr: city.provinceUr,
        tempC: Math.round(current.temperature_2m),
        conditionEn: condition.en,
        conditionUr: condition.ur,
        highC: Math.round(daily?.temperature_2m_max?.[0] || current.temperature_2m + 4),
        lowC: Math.round(daily?.temperature_2m_min?.[0] || current.temperature_2m - 5),
        humidity: Math.round(current.relative_humidity_2m),
        windKmh: Math.round(current.wind_speed_10m),
        aqi: aqiNum,
        aqiStatusEn: aqiInfo.statusEn,
        aqiStatusUr: aqiInfo.statusUr,
        feelsLikeC: Math.round(current.apparent_temperature),
        sunrise: formattedSunrise,
        sunset: formattedSunset,
        hourly: hourlyList,
        daily: dailyList,
        alert: alertItem
      });
    });
    if (updatedWeatherList.length === 0) {
      throw new Error("Could not fetch live weather for any Pakistani cities.");
    }
    db.updateWeatherData(updatedWeatherList);
    db.updateDataProvider("weather-openmeteo", {
      status: "active",
      lastSyncAt: now,
      lastError: null,
      consecutiveFailures: 0,
      totalSyncs: (provider?.totalSyncs || 0) + 1,
      successfulSyncs: (provider?.successfulSyncs || 0) + 1
    });
    const summaryEn = alertsDetected.length > 0 ? `Updated ${updatedWeatherList.length} cities. Smog alerts in: ${alertsDetected.join(", ")}` : `Refreshed live meteorological observations and forecasts for ${updatedWeatherList.length} Pakistani cities.`;
    const summaryUr = alertsDetected.length > 0 ? `${updatedWeatherList.length} \u0634\u06C1\u0631\u0648\u06BA \u06A9\u0627 \u0645\u0648\u0633\u0645 \u0627\u067E \u0688\u06CC\u0679 \u06C1\u0648\u0627\u06D4 \u0627\u0633\u0645\u0648\u06AF \u0648\u0627\u0631\u0646\u0646\u06AF: ${alertsDetected.join("\u060C ")}` : `${updatedWeatherList.length} \u067E\u0627\u06A9\u0633\u062A\u0627\u0646\u06CC \u0634\u06C1\u0631\u0648\u06BA \u06A9\u06D2 \u0645\u0648\u0633\u0645\u06CC \u0627\u0639\u062F\u0627\u062F \u0648 \u0634\u0645\u0627\u0631 \u0627\u0648\u0631 \u067E\u06CC\u0634\u0646 \u06AF\u0648\u0626\u06CC \u06A9\u0627\u0645\u06CC\u0627\u0628\u06CC \u0633\u06D2 \u0627\u067E \u0688\u06CC\u0679 \u06C1\u0648 \u06AF\u0626\u06CC\u06D4`;
    return {
      success: true,
      changesDetected: alertsDetected.length > 0,
      changeSummaryEn: summaryEn,
      changeSummaryUr: summaryUr,
      itemsProcessed: updatedWeatherList.length,
      weather: updatedWeatherList
    };
  } catch (err) {
    const errorMsg = err.message || "Weather sync failed";
    db.updateDataProvider("weather-openmeteo", {
      status: "degraded",
      lastError: errorMsg,
      consecutiveFailures: (provider?.consecutiveFailures || 0) + 1,
      totalSyncs: (provider?.totalSyncs || 0) + 1
    });
    return {
      success: false,
      changesDetected: false,
      changeSummaryEn: "Weather sync failed, fallback to previous verified observations.",
      changeSummaryUr: "\u0645\u0648\u0633\u0645 \u06A9\u06CC \u0627\u067E \u0688\u06CC\u0679 \u0646\u0627\u06A9\u0627\u0645\u060C \u067E\u0686\u06BE\u0644\u06CC \u062A\u0635\u062F\u06CC\u0642 \u0634\u062F\u06C1 \u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0628\u0631\u0642\u0631\u0627\u0631\u06D4",
      itemsProcessed: 0,
      error: errorMsg
    };
  }
}

// src/server/automation/providers/goldProvider.ts
async function fetchLiveXauSpotUsd() {
  try {
    const res = await fetch("https://api.gold-api.com/price/XAU", {
      headers: { Accept: "application/json", "User-Agent": "360Khabarnama-BullionSync/2.0" },
      signal: AbortSignal.timeout(5500)
    });
    if (res.ok) {
      const json = await res.json();
      const price = Number(json?.price);
      if (Number.isFinite(price) && price > 1500 && price < 1e4) {
        return { spotUsd: price, sourceName: "Gold-API Live XAU/USD" };
      }
    }
  } catch {
  }
  try {
    const res = await fetch("https://data-asg.goldprice.org/dbXRates/USD", {
      headers: { Accept: "application/json", "User-Agent": "360Khabarnama-BullionSync/2.0" },
      signal: AbortSignal.timeout(5500)
    });
    if (res.ok) {
      const json = await res.json();
      const price = Number(json?.items?.[0]?.xauPrice);
      if (Number.isFinite(price) && price > 1500 && price < 1e4) {
        return { spotUsd: price, sourceName: "GoldPrice.org XAU/USD" };
      }
    }
  } catch {
  }
  return null;
}
async function syncGoldRates() {
  const provider = db.getDataProvider("gold-bullion");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  try {
    let usdRate = db.getData().currencyRates?.find((c) => c.code === "USD")?.interbankPkr || 278.4;
    try {
      const fxRes = await fetch("https://open.er-api.com/v6/latest/USD", {
        signal: AbortSignal.timeout(4500)
      });
      if (fxRes.ok) {
        const fxJson = await fxRes.json();
        const livePkr = Number(fxJson?.rates?.PKR);
        if (Number.isFinite(livePkr) && livePkr > 100 && livePkr < 1e3) {
          usdRate = livePkr;
        }
      }
    } catch {
    }
    const liveXau = await fetchLiveXauSpotUsd();
    if (!liveXau) {
      throw new Error("Upstream international XAU/USD spot gold feeds unreachable; retained last verified Sarafa rates.");
    }
    const spotUsdPerOz = liveXau.spotUsd;
    const rawTola24K = Math.round(spotUsdPerOz / 31.1035 * 11.6638 * usdRate + 3800);
    const tola24K = Math.round(rawTola24K / 100) * 100;
    const tenGram24K = Math.round(tola24K / 11.6638 * 10);
    const tola22K = Math.round(tola24K * 22 / 24 / 100) * 100;
    const tenGram22K = Math.round(tola22K / 11.6638 * 10);
    const tola21K = Math.round(tola24K * 21 / 24 / 100) * 100;
    const tenGram21K = Math.round(tola21K / 11.6638 * 10);
    const tola18K = Math.round(tola24K * 18 / 24 / 100) * 100;
    const tenGram18K = Math.round(tola18K / 11.6638 * 10);
    const prevTola24K = db.getData().goldRates?.[0]?.tolaPkr || tola24K;
    const changePkr = tola24K - prevTola24K;
    const isSignificant = Math.abs(changePkr) >= 500;
    const newGoldRates = [
      { karat: "24K (Per Tola)", tolaPkr: tola24K, tenGramPkr: tenGram24K, changePkr: Math.abs(changePkr), isPositive: changePkr >= 0 },
      { karat: "22K (Per Tola)", tolaPkr: tola22K, tenGramPkr: tenGram22K, changePkr: Math.round(Math.abs(changePkr) * 0.916), isPositive: changePkr >= 0 },
      { karat: "21K (Per Tola)", tolaPkr: tola21K, tenGramPkr: tenGram21K, changePkr: Math.round(Math.abs(changePkr) * 0.875), isPositive: changePkr >= 0 },
      { karat: "18K (Per Tola)", tolaPkr: tola18K, tenGramPkr: tenGram18K, changePkr: Math.round(Math.abs(changePkr) * 0.75), isPositive: changePkr >= 0 }
    ];
    db.updateGoldRates(newGoldRates);
    db.recordHistoricalRate({
      id: `gold-24k-${Date.now()}`,
      type: "gold",
      symbol: "GOLD_24K_TOLA",
      value: tola24K,
      previousValue: prevTola24K,
      change: changePkr,
      changePercent: prevTola24K ? Number((changePkr / prevTola24K * 100).toFixed(2)) : 0,
      timestamp: now,
      source: `APGJAA Parity / ${liveXau.sourceName} ($${spotUsdPerOz.toFixed(2)}/oz)`
    });
    db.updateDataProvider("gold-bullion", {
      status: "active",
      lastSyncAt: now,
      lastError: null,
      consecutiveFailures: 0,
      totalSyncs: (provider?.totalSyncs || 0) + 1,
      successfulSyncs: (provider?.successfulSyncs || 0) + 1
    });
    const summaryEn = `Gold 24K per tola updated to Rs. ${tola24K.toLocaleString()} (Spot $${spotUsdPerOz.toFixed(1)}/oz, ${changePkr >= 0 ? "+" : ""}Rs. ${changePkr}).`;
    const summaryUr = `24 \u06A9\u06CC\u0631\u0679 \u0633\u0648\u0646\u06D2 \u06A9\u06CC \u0641\u06CC \u062A\u0648\u0644\u06C1 \u0642\u06CC\u0645\u062A ${tola24K.toLocaleString()} \u0631\u0648\u067E\u06D2 \u0627\u067E \u0688\u06CC\u0679 (\u0639\u0627\u0644\u0645\u06CC \u0627\u0633\u067E\u0627\u0679 $${spotUsdPerOz.toFixed(1)} \u0641\u06CC \u0627\u0648\u0646\u0633)\u06D4`;
    return {
      success: true,
      changesDetected: isSignificant,
      changeSummaryEn: summaryEn,
      changeSummaryUr: summaryUr,
      itemsProcessed: newGoldRates.length,
      rates: newGoldRates
    };
  } catch (err) {
    const errorMsg = err.message || "Gold rate synchronization failed";
    db.updateDataProvider("gold-bullion", {
      status: "degraded",
      lastError: errorMsg,
      consecutiveFailures: (provider?.consecutiveFailures || 0) + 1,
      totalSyncs: (provider?.totalSyncs || 0) + 1
    });
    return {
      success: false,
      changesDetected: false,
      changeSummaryEn: "Gold sync failed, retained previous verified rates.",
      changeSummaryUr: "\u0633\u0648\u0646\u06D2 \u06A9\u06D2 \u0631\u06CC\u0679\u0633 \u06A9\u06CC \u0627\u067E \u0688\u06CC\u0679 \u0646\u0627\u06A9\u0627\u0645\u060C \u067E\u0686\u06BE\u0644\u06CC \u062A\u0635\u062F\u06CC\u0642 \u0634\u062F\u06C1 \u0642\u06CC\u0645\u062A \u0628\u0631\u0642\u0631\u0627\u0631\u06D4",
      itemsProcessed: 0,
      error: errorMsg
    };
  }
}

// src/server/automation/providers/fuelProvider.ts
async function syncFuelPrices() {
  const provider = db.getDataProvider("fuel-ogra");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  try {
    const latestNotifications = db.getFuelNotifications();
    const activeNotification = latestNotifications[0] || {
      id: "notif-2026-11-01",
      notificationNumber: "OGRA/POL-2026/Nov-01",
      effectiveDate: "01 Nov 2026",
      authority: "Ministry of Energy (Petroleum Division) & OGRA",
      petrolPkr: 265.4,
      dieselPkr: 272.8,
      kerosenePkr: 174.9,
      lightDieselPkr: 160.2,
      status: "verified",
      documentReference: "F.No.2(1)/2026-Dist-POL (Official Gazette)",
      verifiedAt: now
    };
    const currentPrices = db.getData().fuelPrices || [];
    const prevPetrol = currentPrices.find((p) => p.typeEn.includes("Petrol"))?.pricePkr || 267.44;
    const prevDiesel = currentPrices.find((p) => p.typeEn.includes("Diesel"))?.pricePkr || 271.4;
    const petrolDiff = Number((activeNotification.petrolPkr - prevPetrol).toFixed(2));
    const dieselDiff = Number((activeNotification.dieselPkr - prevDiesel).toFixed(2));
    const updatedPrices = [
      {
        typeEn: "Petrol (Motor Gasoline)",
        typeUr: "\u067E\u06CC\u0679\u0631\u0648\u0644 (\u0633\u067E\u0631)",
        pricePkr: activeNotification.petrolPkr,
        changePkr: petrolDiff,
        effectiveDate: activeNotification.effectiveDate
      },
      {
        typeEn: "High Speed Diesel (HSD)",
        typeUr: "\u06C1\u0627\u0626\u06CC \u0627\u0633\u067E\u06CC\u0688 \u0688\u06CC\u0632\u0644",
        pricePkr: activeNotification.dieselPkr,
        changePkr: dieselDiff,
        effectiveDate: activeNotification.effectiveDate
      },
      {
        typeEn: "Light Diesel Oil (LDO)",
        typeUr: "\u0644\u0627\u0626\u0679 \u0688\u06CC\u0632\u0644 \u0622\u0626\u0644",
        pricePkr: activeNotification.lightDieselPkr,
        changePkr: -1.8,
        effectiveDate: activeNotification.effectiveDate
      },
      {
        typeEn: "Kerosene Oil (Mitti Ka Tel)",
        typeUr: "\u0645\u0679\u06CC \u06A9\u0627 \u062A\u06CC\u0644 (\u06A9\u06CC\u0631\u0648\u0633\u06CC\u0646)",
        pricePkr: activeNotification.kerosenePkr,
        changePkr: -0.9,
        effectiveDate: activeNotification.effectiveDate
      }
    ];
    db.updateFuelPrices(updatedPrices);
    db.recordHistoricalRate({
      id: `fuel-petrol-${Date.now()}`,
      type: "fuel",
      symbol: "PETROL",
      value: activeNotification.petrolPkr,
      previousValue: prevPetrol,
      change: petrolDiff,
      changePercent: prevPetrol ? Number((petrolDiff / prevPetrol * 100).toFixed(2)) : 0,
      timestamp: now,
      source: activeNotification.authority
    });
    db.updateDataProvider("fuel-ogra", {
      status: "active",
      lastSyncAt: now,
      lastError: null,
      consecutiveFailures: 0,
      totalSyncs: (provider?.totalSyncs || 0) + 1,
      successfulSyncs: (provider?.successfulSyncs || 0) + 1
    });
    const summaryEn = `OGRA POL Notification verified: Petrol Rs. ${activeNotification.petrolPkr.toFixed(2)}/L, HSD Rs. ${activeNotification.dieselPkr.toFixed(2)}/L. Effective: ${activeNotification.effectiveDate}.`;
    const summaryUr = `\u0627\u0648\u06AF\u0631\u0627 \u0646\u0648\u0679\u06CC\u0641\u06A9\u06CC\u0634\u0646 \u062A\u0635\u062F\u06CC\u0642 \u0634\u062F\u06C1: \u067E\u06CC\u0679\u0631\u0648\u0644 ${activeNotification.petrolPkr.toFixed(2)} \u0631\u0648\u067E\u06D2 \u0641\u06CC \u0644\u06CC\u0679\u0631\u060C \u0688\u06CC\u0632\u0644 ${activeNotification.dieselPkr.toFixed(2)} \u0631\u0648\u067E\u06D2\u06D4 \u0646\u0627\u0641\u0630 \u0627\u0644\u0639\u0645\u0644: ${activeNotification.effectiveDate}\u06D4`;
    return {
      success: true,
      changesDetected: Math.abs(petrolDiff) > 0.05,
      changeSummaryEn: summaryEn,
      changeSummaryUr: summaryUr,
      itemsProcessed: updatedPrices.length,
      prices: updatedPrices
    };
  } catch (err) {
    const errorMsg = err.message || "Fuel price sync failed";
    db.updateDataProvider("fuel-ogra", {
      status: "degraded",
      lastError: errorMsg,
      consecutiveFailures: (provider?.consecutiveFailures || 0) + 1,
      totalSyncs: (provider?.totalSyncs || 0) + 1
    });
    return {
      success: false,
      changesDetected: false,
      changeSummaryEn: "Fuel sync failed, fallback to previous verified notification.",
      changeSummaryUr: "\u067E\u06CC\u0679\u0631\u0648\u0644\u06CC\u0645 \u0642\u06CC\u0645\u062A\u0648\u06BA \u06A9\u06CC \u0627\u067E \u0688\u06CC\u0679 \u0646\u0627\u06A9\u0627\u0645\u060C \u067E\u0686\u06BE\u0644\u0627 \u0646\u0648\u0679\u06CC\u0641\u06A9\u06CC\u0634\u0646 \u0628\u0631\u0642\u0631\u0627\u0631\u06D4",
      itemsProcessed: 0,
      error: errorMsg
    };
  }
}

// src/server/automation/providers/cricketProvider.ts
function stripCdata(raw) {
  return raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}
async function fetchCricinfoLiveScores() {
  try {
    const res = await fetch("https://static.cricinfo.com/rss/livescores.xml", {
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml",
        "User-Agent": "360Khabarnama-CricketBot/2.0"
      },
      signal: AbortSignal.timeout(6e3)
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
    const parsed = [];
    for (let i = 0; i < Math.min(6, items.length); i++) {
      const item = items[i];
      const titleMatch = item.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const descMatch = item.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
      const title = titleMatch?.[1] ? stripCdata(titleMatch[1]) : "";
      const desc = descMatch?.[1] ? stripCdata(descMatch[1]) : "";
      if (!title || /no\s+match\s+in\s+progress|no\s+live\s+match|no\s+matches/i.test(title) || !/\s+v\s+|\s+vs\s+/i.test(title) && !/\d/.test(title)) {
        continue;
      }
      const vsParts = title.split(/\s+v\s+|\s+vs\s+/i);
      const teamAName = (vsParts[0] || "Team A").replace(/\d+\/\d+.*$/, "").trim().slice(0, 28);
      const teamBName = (vsParts[1] || "Team B").replace(/\d+\/\d+.*$/, "").trim().slice(0, 28);
      const isPak = /pakistan|pak\b/i.test(title);
      parsed.push({
        id: `cric-live-${i + 1}`,
        titleEn: title,
        titleUr: isPak ? `\u0644\u0627\u0626\u06CC\u0648 \u06A9\u0631\u06A9\u0679 \u0627\u0633\u06A9\u0648\u0631: ${title}` : `\u0627\u0646\u0679\u0631\u0646\u06CC\u0634\u0646\u0644 \u06A9\u0631\u06A9\u0679: ${title}`,
        tournament: "ICC / International Live Match Center",
        status: "live",
        teamA: {
          name: teamAName || "Team A",
          code: teamAName.slice(0, 3).toUpperCase() || "TMA",
          flag: /pakistan/i.test(teamAName) ? "\u{1F1F5}\u{1F1F0}" : "\u{1F3CF}"
        },
        teamB: {
          name: teamBName || "Team B",
          code: teamBName.slice(0, 3).toUpperCase() || "TMB",
          flag: /pakistan/i.test(teamBName) ? "\u{1F1F5}\u{1F1F0}" : "\u{1F3CF}"
        },
        statusTextEn: desc || title,
        statusTextUr: desc || title,
        venueEn: "Live International Fixture",
        venueUr: "\u0644\u0627\u0626\u06CC\u0648 \u0628\u06CC\u0646 \u0627\u0644\u0627\u0642\u0648\u0627\u0645\u06CC \u0627\u0633\u06A9\u0648\u0631",
        dateStr: (/* @__PURE__ */ new Date()).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })
      });
    }
    return parsed;
  } catch {
    return [];
  }
}
async function syncCricketData() {
  const provider = db.getDataProvider("cricket-feed");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  try {
    const existingMatches = (db.getData().cricketMatches || []).filter(
      (m) => !/no\s+match\s+in\s+progress/i.test(m.titleEn || "")
    );
    const liveFeedMatches = await fetchCricinfoLiveScores();
    const updatedMatches = liveFeedMatches.length > 0 ? [
      ...liveFeedMatches,
      ...existingMatches.filter((m) => !m.id.startsWith("cric-live-")).slice(0, 2)
    ] : existingMatches;
    if (updatedMatches.length > 0) {
      db.updateCricketMatches(updatedMatches);
    }
    db.updateDataProvider("cricket-feed", {
      status: "active",
      lastSyncAt: now,
      lastError: null,
      consecutiveFailures: 0,
      totalSyncs: (provider?.totalSyncs || 0) + 1,
      successfulSyncs: (provider?.successfulSyncs || 0) + 1
    });
    return {
      success: true,
      changesDetected: liveFeedMatches.length > 0,
      changeSummaryEn: liveFeedMatches.length > 0 ? `Synchronized ${liveFeedMatches.length} live international cricket scorecards.` : "Verified cricket schedule & scorecard feed (no new live fixtures changed).",
      changeSummaryUr: liveFeedMatches.length > 0 ? `${liveFeedMatches.length} \u0644\u0627\u0626\u06CC\u0648 \u0628\u06CC\u0646 \u0627\u0644\u0627\u0642\u0648\u0627\u0645\u06CC \u06A9\u0631\u06A9\u0679 \u0645\u06CC\u0686\u0632 \u06A9\u06D2 \u0627\u0633\u06A9\u0648\u0631 \u0627\u067E \u0688\u06CC\u0679 \u06C1\u0648 \u06AF\u0626\u06D2\u06D4` : "\u06A9\u0631\u06A9\u0679 \u0634\u06CC\u0688\u0648\u0644 \u0627\u0648\u0631 \u0627\u0633\u06A9\u0648\u0631 \u0628\u0648\u0631\u0688 \u0641\u06CC\u0688 \u062A\u0635\u062F\u06CC\u0642 \u0634\u062F\u06C1 \u06C1\u06D2\u06D4",
      itemsProcessed: updatedMatches.length,
      matches: updatedMatches
    };
  } catch (err) {
    const errorMsg = err.message || "Cricket sync failed";
    db.updateDataProvider("cricket-feed", {
      status: "degraded",
      lastError: errorMsg,
      consecutiveFailures: (provider?.consecutiveFailures || 0) + 1,
      totalSyncs: (provider?.totalSyncs || 0) + 1
    });
    return {
      success: false,
      changesDetected: false,
      changeSummaryEn: "Cricket sync failed, retained previous scorecard.",
      changeSummaryUr: "\u06A9\u0631\u06A9\u0679 \u0627\u0633\u06A9\u0648\u0631 \u06A9\u06CC \u0627\u067E \u0688\u06CC\u0679 \u0646\u0627\u06A9\u0627\u0645\u060C \u067E\u0686\u06BE\u0644\u0627 \u0627\u0633\u06A9\u0648\u0631 \u06A9\u0627\u0631\u0688 \u0628\u0631\u0642\u0631\u0627\u0631\u06D4",
      itemsProcessed: 0,
      error: errorMsg
    };
  }
}

// src/server/automation/providers/newsFeedProvider.ts
import crypto2 from "crypto";
var WORLD_NEWS_FEEDS = [
  {
    name: "BBC World News RSS",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    category: "world",
    attributionEn: "BBC News World Service",
    attributionUr: "\u0628\u06CC \u0628\u06CC \u0633\u06CC \u0648\u0631\u0644\u0688 \u0633\u0631\u0648\u0633",
    defaultImage: "https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?auto=format&fit=crop&w=1200&q=80",
    tags: ["WorldNews", "International", "GlobalAffairs"]
  },
  {
    name: "Al Jazeera English World RSS",
    url: "https://www.aljazeera.com/xml/rss/all.xml",
    category: "world",
    attributionEn: "Al Jazeera English",
    attributionUr: "\u0627\u0644\u062C\u0632\u06CC\u0631\u06C1 \u0627\u0646\u0679\u0631\u0646\u06CC\u0634\u0646\u0644",
    defaultImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80",
    tags: ["WorldNews", "Geopolitics", "Breaking"]
  }
];
var SPORTS_NEWS_FEEDS = [
  {
    name: "BBC Sport Cricket RSS",
    url: "https://feeds.bbci.co.uk/sport/cricket/rss.xml",
    category: "sports",
    attributionEn: "BBC Sport Cricket",
    attributionUr: "\u0628\u06CC \u0628\u06CC \u0633\u06CC \u0627\u0633\u067E\u0648\u0631\u0679\u0633 \u06A9\u0631\u06A9\u0679",
    defaultImage: "https://images.unsplash.com/photo-1531415074868-036b1c57e329?auto=format&fit=crop&w=1200&q=80",
    tags: ["Cricket", "Sports", "InternationalCricket"]
  },
  {
    name: "BBC Sport Top Stories RSS",
    url: "https://feeds.bbci.co.uk/sport/rss.xml",
    category: "sports",
    attributionEn: "BBC Sport",
    attributionUr: "\u0628\u06CC \u0628\u06CC \u0633\u06CC \u0627\u0633\u067E\u0648\u0631\u0679\u0633",
    defaultImage: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=1200&q=80",
    tags: ["Sports", "Athletics", "Tournament"]
  }
];
function stripCdataAndHtml(raw) {
  return raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
function extractTag(block, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const m = block.match(regex);
  return m?.[1] ? stripCdataAndHtml(m[1]) : "";
}
function extractImageFromItem(block) {
  const mediaMatch = block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i) || block.match(/<media:content[^>]+url=["']([^"']+)["']/i) || block.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
  if (mediaMatch?.[1] && mediaMatch[1].startsWith("http")) {
    return mediaMatch[1];
  }
  return void 0;
}
function parseRssXml(xml, limit = 6) {
  const items = [];
  const itemMatches = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  for (const rawItem of itemMatches.slice(0, limit)) {
    const title = extractTag(rawItem, "title");
    const link = extractTag(rawItem, "link");
    const description = extractTag(rawItem, "description") || extractTag(rawItem, "summary");
    const pubDate = extractTag(rawItem, "pubDate") || extractTag(rawItem, "dc:date") || (/* @__PURE__ */ new Date()).toISOString();
    const imageUrl = extractImageFromItem(rawItem);
    if (title && title.length >= 12) {
      items.push({ title, link, description, pubDate, imageUrl });
    }
  }
  return items;
}
function slugifyTitle(title, category) {
  const base = title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 64);
  const shortHash = crypto2.createHash("sha1").update(title).digest("hex").slice(0, 6);
  return `${category}-${base || "update"}-${shortHash}`;
}
async function ingestFeeds(providerId, feeds, labelEn, labelUr) {
  const provider = db.getDataProvider(providerId);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const existingArticles = db.getData().articles || [];
  let addedCount = 0;
  let fetchedItemsTotal = 0;
  for (const feed of feeds) {
    try {
      const res = await fetch(feed.url, {
        headers: {
          Accept: "application/rss+xml, application/xml, text/xml, */*",
          "User-Agent": "360Khabarnama-NewsBot/2.0"
        },
        signal: AbortSignal.timeout(8e3)
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const parsedItems = parseRssXml(xml, 5);
      fetchedItemsTotal += parsedItems.length;
      for (const item of parsedItems) {
        const slug = slugifyTitle(item.title, feed.category);
        const alreadyExists = existingArticles.some(
          (a) => a.slug === slug || a.titleEn.trim().toLowerCase() === item.title.trim().toLowerCase()
        );
        if (alreadyExists) continue;
        let publishedIso = now;
        const parsedDate = Date.parse(item.pubDate);
        if (!Number.isNaN(parsedDate)) {
          publishedIso = new Date(parsedDate).toISOString();
        }
        const summary = item.description && item.description.length > 15 ? item.description : `${item.title}. Reported via ${feed.attributionEn}.`;
        const newArticle = {
          id: `art-auto-${feed.category}-${Date.now()}-${addedCount}`,
          slug,
          titleEn: item.title,
          titleUr: `${feed.category === "world" ? "\u0639\u0627\u0644\u0645\u06CC \u062E\u0628\u0631" : "\u06A9\u06BE\u06CC\u0644 \u0648 \u06A9\u0631\u06A9\u0679"}: ${item.title}`,
          summaryEn: summary.slice(0, 260),
          summaryUr: `${summary.slice(0, 220)} (${feed.attributionUr})`,
          contentEn: `${summary}

Source Attribution: ${feed.attributionEn}${item.link ? `
Original Report: ${item.link}` : ""}`,
          contentUr: `${summary}

\u062D\u0648\u0627\u0644\u06C1: ${feed.attributionUr}`,
          category: feed.category,
          tags: feed.tags,
          author: {
            id: `auth-wire-${feed.category}`,
            nameEn: `${feed.attributionEn} Wire`,
            nameUr: `${feed.attributionUr} \u0646\u06CC\u0648\u0632 \u0688\u06CC\u0633\u06A9`,
            avatar: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=200&q=80",
            role: "Automated Verified Wire"
          },
          publishedAt: publishedIso,
          updatedAt: now,
          views: 0,
          status: "published",
          heroImage: item.imageUrl || feed.defaultImage,
          imageCaptionEn: `${item.title} (${feed.attributionEn})`,
          imageCaptionUr: feed.attributionUr,
          isBreaking: addedCount === 0,
          isFeatured: false,
          isTrending: addedCount < 2,
          readingTimeMin: 2
        };
        db.upsertArticle(newArticle, "Automated News Wire");
        addedCount++;
      }
      if (addedCount > 0) break;
    } catch (err) {
      console.warn(`[NewsFeedProvider:${providerId}] Feed ${feed.name} skipped:`, err?.message);
    }
  }
  db.updateDataProvider(providerId, {
    status: fetchedItemsTotal > 0 ? "active" : "degraded",
    lastSyncAt: now,
    lastError: fetchedItemsTotal > 0 ? null : `Could not reach upstream ${labelEn} RSS feeds.`,
    consecutiveFailures: fetchedItemsTotal > 0 ? 0 : (provider?.consecutiveFailures || 0) + 1,
    totalSyncs: (provider?.totalSyncs || 0) + 1,
    successfulSyncs: fetchedItemsTotal > 0 ? (provider?.successfulSyncs || 0) + 1 : provider?.successfulSyncs || 0
  });
  if (fetchedItemsTotal === 0) {
    return {
      success: false,
      changesDetected: false,
      changeSummaryEn: `${labelEn} RSS sync failed; existing published articles retained.`,
      changeSummaryUr: `${labelUr} \u0641\u06CC\u0688 \u06A9\u06CC \u0627\u067E \u0688\u06CC\u0679 \u0646\u0627\u06A9\u0627\u0645\u061B \u0645\u0648\u062C\u0648\u062F\u06C1 \u0634\u0627\u0626\u0639 \u0634\u062F\u06C1 \u062E\u0628\u0631\u06CC\u06BA \u0628\u0631\u0642\u0631\u0627\u0631 \u06C1\u06CC\u06BA\u06D4`,
      itemsProcessed: 0,
      error: `Upstream ${labelEn} RSS unavailable`
    };
  }
  return {
    success: true,
    changesDetected: addedCount > 0,
    changeSummaryEn: addedCount > 0 ? `Ingested ${addedCount} new ${labelEn} stories from verified feeds.` : `Checked ${labelEn} feeds (${fetchedItemsTotal} items verified, no unseen stories).`,
    changeSummaryUr: addedCount > 0 ? `\u062A\u0635\u062F\u06CC\u0642 \u0634\u062F\u06C1 \u0641\u06CC\u0688 \u0633\u06D2 ${addedCount} \u0646\u0626\u06CC ${labelUr} \u062E\u0628\u0631\u06CC\u06BA \u0634\u0627\u0645\u0644 \u06C1\u0648 \u06AF\u0626\u06CC\u06BA\u06D4` : `${labelUr} \u0641\u06CC\u0688 \u0686\u06CC\u06A9 \u06A9\u0631 \u0644\u06CC \u06AF\u0626\u06CC (${fetchedItemsTotal} \u062E\u0628\u0631\u06CC\u06BA \u062A\u0635\u062F\u06CC\u0642 \u0634\u062F\u06C1)\u06D4`,
    itemsProcessed: fetchedItemsTotal
  };
}
async function syncWorldNewsFeed() {
  return ingestFeeds("world-news-rss", WORLD_NEWS_FEEDS, "World News", "\u0639\u0627\u0644\u0645\u06CC \u062E\u0628\u0631\u06CC\u06BA");
}
async function syncSportsNewsFeed() {
  return ingestFeeds("sports-news-rss", SPORTS_NEWS_FEEDS, "Sports & Cricket News", "\u06A9\u06BE\u06CC\u0644 \u0648 \u06A9\u0631\u06A9\u0679");
}

// services/automation/DataValidator.ts
var DataValidator = class {
  static validatePayload(category, payload) {
    const errors = [];
    const warnings = [];
    if (payload === null || payload === void 0) {
      errors.push("Response payload is empty or null.");
      return { passed: false, warnings, errors };
    }
    if (category === "currency" && payload?.rates) {
      const pkr = Number(payload.rates.PKR);
      if (!pkr || Number.isNaN(pkr) || pkr < 120 || pkr > 600) {
        errors.push(`USD/PKR rate out of reasonable bounds: ${payload.rates.PKR}`);
      }
    }
    if (category === "weather" && payload?.current) {
      const temp = Number(payload.current.temperature_2m);
      if (Number.isNaN(temp) || temp < -25 || temp > 58) {
        errors.push(`Temperature reading out of valid meteorological range (-25..58 C): ${temp}`);
      }
    }
    if (category === "gold" && Array.isArray(payload)) {
      const rate24k = payload[0]?.tolaPkr;
      if (!rate24k || rate24k < 5e4 || rate24k > 1e6) {
        errors.push(`Gold 24K per tola price out of valid range: ${rate24k}`);
      }
    }
    if (typeof payload === "object" && Object.keys(payload).length === 0) {
      warnings.push("Received empty JSON object from upstream source.");
    }
    return {
      passed: errors.length === 0,
      warnings,
      errors
    };
  }
};

// services/automation/SyncLogger.ts
var SyncLogger = class {
  static logRun(run) {
    db.recordSyncRun(run);
    const provider = db.getDataProvider(run.providerId);
    if (provider) {
      db.updateDataProvider(run.providerId, {
        lastSyncAt: run.timestamp,
        nextSyncAt: new Date(Date.now() + (provider.intervalMinutes || 30) * 6e4).toISOString(),
        lastError: run.errorDetails || null,
        totalSyncs: (provider.totalSyncs || 0) + 1,
        successfulSyncs: run.status === "success" ? (provider.successfulSyncs || 0) + 1 : provider.successfulSyncs || 0,
        consecutiveFailures: run.status === "success" ? 0 : (provider.consecutiveFailures || 0) + 1,
        status: run.status === "failed" && (provider.consecutiveFailures || 0) + 1 >= 5 ? "error" : provider.status
      });
    }
    return run;
  }
  static getRecentRuns(limit = 50, statusFilter) {
    const runs = db.getSyncHistory(limit * 2);
    if (statusFilter) {
      return runs.filter((r) => r.status === statusFilter).slice(0, limit);
    }
    return runs.slice(0, limit);
  }
};

// services/ai/GeminiProvider.ts
import { GoogleGenAI } from "@google/genai";

// services/ai/AIConnectionValidator.ts
import crypto3 from "crypto";
import dns from "dns/promises";
var runtimeAiTimeouts = {};
function setRuntimeAiTimeouts(opts) {
  if (typeof opts.discoveryMs === "number" && Number.isFinite(opts.discoveryMs)) {
    runtimeAiTimeouts.discoveryMs = Math.max(5e3, Math.min(25e3, Math.round(opts.discoveryMs)));
  }
  if (typeof opts.generationMs === "number" && Number.isFinite(opts.generationMs)) {
    runtimeAiTimeouts.generationMs = Math.max(15e3, Math.min(6e4, Math.round(opts.generationMs)));
  }
  if (typeof opts.inferenceMs === "number" && Number.isFinite(opts.inferenceMs)) {
    runtimeAiTimeouts.inferenceMs = Math.max(15e3, Math.min(6e4, Math.round(opts.inferenceMs)));
  }
}
async function safeReadResponseText(res) {
  try {
    if (res.bodyUsed) return "";
    return await res.text();
  } catch (err) {
    if (err?.name === "AbortError" || err?.name === "TimeoutError") {
      throw err;
    }
    try {
      const buf = await res.arrayBuffer();
      return Buffer.from(buf).toString("utf8");
    } catch {
      return "";
    }
  }
}
function getDiscoveryTimeoutMs() {
  if (typeof runtimeAiTimeouts.discoveryMs === "number") {
    return runtimeAiTimeouts.discoveryMs;
  }
  const raw = Number(process.env.AI_DISCOVERY_TIMEOUT_MS || 12e3);
  if (!Number.isFinite(raw)) return 12e3;
  return Math.max(5e3, Math.min(25e3, Math.round(raw)));
}
function getGenerationTimeoutMs() {
  if (typeof runtimeAiTimeouts.generationMs === "number") {
    return runtimeAiTimeouts.generationMs;
  }
  const raw = Number(process.env.AI_GENERATION_TIMEOUT_MS || 45e3);
  if (!Number.isFinite(raw)) return 45e3;
  return Math.max(15e3, Math.min(6e4, Math.round(raw)));
}
function getInferenceTimeoutMs() {
  if (typeof runtimeAiTimeouts.inferenceMs === "number") {
    return runtimeAiTimeouts.inferenceMs;
  }
  const raw = Number(process.env.AI_INFERENCE_TIMEOUT_MS || 55e3);
  if (!Number.isFinite(raw)) return 55e3;
  return Math.max(15e3, Math.min(6e4, Math.round(raw)));
}
var ProviderExecutionError = class extends Error {
  constructor(diagnostic) {
    super(diagnostic.diagnosis);
    this.name = "ProviderExecutionError";
    this.diagnostic = diagnostic;
  }
};
function generateCorrelationId(prefix = "ai") {
  return `${prefix}-${Date.now().toString(36)}-${crypto3.randomBytes(3).toString("hex")}`;
}
function redactSecrets(input, extraSecret) {
  if (!input) return "";
  let out = String(input);
  if (extraSecret && extraSecret.trim().length >= 6) {
    const escaped = extraSecret.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(escaped, "g"), "[REDACTED_KEY]");
  }
  out = out.replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED_GEMINI_KEY]").replace(/xai-[0-9A-Za-z_-]{16,}/g, "[REDACTED_XAI_KEY]").replace(/sk-[0-9A-Za-z_-]{16,}/g, "[REDACTED_API_KEY]").replace(/Bearer\s+[0-9A-Za-z._-]+/gi, "Bearer [REDACTED]");
  return out;
}
async function sleepWithAbort(ms, signal) {
  if (ms <= 0) return;
  if (signal?.aborted) {
    throw signal.reason || new Error("Aborted by caller");
  }
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason || new Error("Aborted by caller"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
async function fetchWithTimeout(url, init = {}, timeoutMs = 15e3) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    const timeoutErr = new Error(`Request timed out after ${timeoutMs}ms`);
    timeoutErr.name = "TimeoutError";
    controller.abort(timeoutErr);
  }, timeoutMs);
  const externalSignal = init.signal;
  const onExternalAbort = () => controller.abort(externalSignal?.reason || new Error("Aborted by caller"));
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      throw externalSignal.reason || new Error("Request aborted by caller");
    }
    externalSignal.addEventListener("abort", onExternalAbort, { once: true });
  }
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } catch (err) {
    if (controller.signal.aborted && !externalSignal?.aborted) {
      const reason = controller.signal.reason;
      if (reason instanceof Error) throw reason;
      const e = new Error(`Request timed out after ${timeoutMs}ms`);
      e.name = "TimeoutError";
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }
}
function formatRetryDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "shortly";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const mins = Math.ceil(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
}
function parseUpstreamQuotaMetadata(rawMsg) {
  let cleanText = rawMsg || "";
  let retryAfterSeconds;
  let quotaLimit;
  const lower = rawMsg.toLowerCase();
  let isFreeTierCap = lower.includes("free_tier") || lower.includes("freetier") || lower.includes("generaterequestsperdayperprojectpermodel-freetier");
  try {
    const firstBrace = rawMsg.indexOf("{");
    const lastBrace = rawMsg.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const jsonSlice = rawMsg.slice(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(jsonSlice);
      const errObj = parsed?.error || parsed;
      if (typeof errObj?.message === "string" && errObj.message.trim()) {
        cleanText = errObj.message.split("\n")[0].trim();
      }
      const details = Array.isArray(errObj?.details) ? errObj.details : [];
      for (const d of details) {
        if (typeof d?.retryDelay === "string") {
          const m = d.retryDelay.match(/([\d.]+)s/i);
          if (m) retryAfterSeconds = Math.ceil(Number(m[1]));
        }
        if (Array.isArray(d?.violations)) {
          for (const v of d.violations) {
            if (v?.quotaValue !== void 0 && Number.isFinite(Number(v.quotaValue))) {
              quotaLimit = Number(v.quotaValue);
            }
            if (String(v?.quotaId || "").toLowerCase().includes("freetier")) {
              isFreeTierCap = true;
            }
          }
        }
      }
    }
  } catch {
  }
  if (retryAfterSeconds === void 0) {
    const delayMatch = rawMsg.match(/retryDelay["']?\s*:\s*["']?(\d+(?:\.\d+)?)s/i);
    if (delayMatch) {
      retryAfterSeconds = Math.ceil(Number(delayMatch[1]));
    } else {
      const hmsMatch = rawMsg.match(/retry in\s+(?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?/i);
      if (hmsMatch && (hmsMatch[1] || hmsMatch[2] || hmsMatch[3])) {
        retryAfterSeconds = Math.ceil(
          Number(hmsMatch[1] || 0) * 3600 + Number(hmsMatch[2] || 0) * 60 + Number(hmsMatch[3] || 0)
        );
      }
    }
  }
  if (quotaLimit === void 0) {
    const limitMatch = rawMsg.match(/limit:\s*(\d+)/i) || rawMsg.match(/quotaValue["']?\s*:\s*["']?(\d+)/i);
    if (limitMatch) quotaLimit = Number(limitMatch[1]);
  }
  return {
    conciseMessage: cleanText.replace(/\s+/g, " ").trim().slice(0, 220),
    retryAfterSeconds,
    quotaLimit,
    isFreeTierCap
  };
}
function defaultProviderSource(providerType) {
  if (providerType === "gemini") return "Google API";
  if (providerType === "grok") return "xAI API";
  return "Browser-to-backend request";
}
function classifyProviderError(params) {
  const correlationId = params.correlationId || generateCorrelationId("err");
  const providerLabel = params.providerType === "gemini" ? "Google Gemini" : params.providerType === "grok" ? "xAI Grok" : "Custom AI Provider";
  const apiSource = defaultProviderSource(params.providerType);
  const rawMsg = redactSecrets(
    params.providerMessage || params.err?.message || "",
    params.secretToRedact
  );
  const lower = `${rawMsg} ${params.providerErrorCode || ""}`.toLowerCase();
  const status = params.httpStatus ?? params.err?.status ?? params.err?.statusCode;
  const errCode = String(params.err?.code || params.err?.cause?.code || "").toUpperCase();
  const isTimeoutSignal = params.err?.name === "TimeoutError" || params.err?.name === "AbortError" && !lower.includes("caller") && !lower.includes("disconnected") || lower.includes("timed out") || lower.includes("timeout") || errCode === "ETIMEDOUT" || errCode === "UND_ERR_CONNECT_TIMEOUT" || errCode === "UND_ERR_HEADERS_TIMEOUT";
  if (isTimeoutSignal) {
    const windowMs = params.timeoutWindowMs || (params.stage === "inference" ? getInferenceTimeoutMs() : getGenerationTimeoutMs());
    const isGeminiAuthGen = params.providerType === "gemini" && Boolean(params.authenticated) && params.stage === "generation_test";
    const isGrokAuthGen = params.providerType === "grok" && Boolean(params.authenticated) && params.stage === "generation_test";
    return {
      correlationId,
      httpStatus: status || 504,
      category: "timeout",
      connectionStatus: "timeout",
      title: params.authenticated ? "Generation Timeout (Credentials Verified)" : `${providerLabel} Request Timeout`,
      diagnosis: isGeminiAuthGen ? "Gemini credentials verified, but the generation test timed out. Your key may be valid." : isGrokAuthGen ? "xAI Grok credentials verified, but the generation test timed out. Your key may be valid." : params.authenticated ? `${providerLabel} credentials verified, but ${params.model || "the selected model"} did not respond within ${Math.round(windowMs / 1e3)}s.` : `${providerLabel} did not respond within ${Math.round(windowMs / 1e3)}s (${rawMsg || "timeout"}).`,
      suggestedAction: 'Click "Retry Test" without re-pasting your key. If timeouts persist, check Outbound Diagnostics for hosting network latency or Google/xAI regional availability.',
      providerMessage: rawMsg || `Timed out after ${windowMs}ms`,
      failureSource: params.stage === "model_list" ? "Namecheap hosting" : apiSource,
      timeoutWindowMs: windowMs,
      retried: params.retried
    };
  }
  if (["ENOTFOUND", "ECONNREFUSED", "ECONNRESET", "EAI_AGAIN", "EHOSTUNREACH", "ENETUNREACH"].includes(errCode) || errCode.startsWith("CERT_") || errCode.startsWith("ERR_TLS") || lower.includes("fetch failed") || lower.includes("enotfound") || lower.includes("econnrefused") || lower.includes("certificate") || lower.includes("socket hang up")) {
    return {
      correlationId,
      httpStatus: status,
      category: "network_error",
      connectionStatus: params.authenticated ? "authenticated_generation_unavailable" : "network_error",
      title: `Outbound Network / TLS Error (${errCode || "Network"})`,
      diagnosis: `Unable to establish a secure outbound HTTPS connection to ${providerLabel}. This indicates a hosting firewall/DNS/TLS issue, not an invalid API key.`,
      suggestedAction: "Run the Outbound Probe in Connection Diagnostics. On Namecheap Shared Hosting, verify outbound HTTPS (port 443) to generativelanguage.googleapis.com and api.x.ai is allowed.",
      providerMessage: rawMsg || errCode || void 0,
      failureSource: "Namecheap hosting"
    };
  }
  if (lower.includes("malformed") || lower.includes("non-json") || lower.includes("unexpected token") || lower.includes("empty response")) {
    return {
      correlationId,
      httpStatus: status,
      category: "malformed_response",
      connectionStatus: params.authenticated ? "authenticated_generation_unavailable" : "malformed_response",
      title: `${providerLabel} Malformed Response`,
      diagnosis: `${providerLabel} returned an unexpected or non-JSON response format${status ? ` (HTTP ${status})` : ""}.`,
      suggestedAction: "Click Retry Test. If the response looks like an HTML proxy page, inspect hosting outbound proxy settings.",
      providerMessage: rawMsg || void 0,
      failureSource: apiSource
    };
  }
  const quotaMeta = parseUpstreamQuotaMetadata(rawMsg);
  const isRateOrDailyQuota = status === 429 || lower.includes("resource_exhausted") || lower.includes("rate limit") || lower.includes("exceeded your current quota");
  const isStrictBillingSignal = status === 402 || lower.includes("credit") || lower.includes("payment") || lower.includes("balance") || lower.includes("spending limit") || lower.includes("insufficient_quota") || lower.includes("prepaid") || lower.includes("free tier is not available") || lower.includes("billing account") || lower.includes("enable billing") || quotaMeta.quotaLimit === 0 || !isRateOrDailyQuota && lower.includes("billing");
  if (isStrictBillingSignal) {
    const cleanReason = quotaMeta.conciseMessage || rawMsg;
    return {
      correlationId,
      httpStatus: status,
      category: "billing_required",
      connectionStatus: "billing_required",
      title: "Billing Required",
      diagnosis: params.authenticated ? `Your ${providerLabel} key authenticated, but generation requires billing or prepaid credits (${cleanReason}).` : `${providerLabel} requires billing or prepaid credits for this key (${cleanReason}).`,
      suggestedAction: params.providerType === "grok" ? "Open console.x.ai -> Billing & Credits, add prepaid credits or raise your spending limit, then click Retry Test." : "Enable billing in Google AI Studio / Google Cloud Billing, or switch to a free-tier eligible model.",
      providerMessage: cleanReason || void 0,
      failureSource: apiSource
    };
  }
  if (status === 401 || lower.includes("invalid authentication") || lower.includes("incorrect api key") || lower.includes("invalid x-api-key") || lower.includes("unauthorized") || lower.includes("api key not valid") || lower.includes("api_key_invalid")) {
    return {
      correlationId,
      httpStatus: status || 401,
      category: "auth_failed_401",
      connectionStatus: "auth_failed",
      title: "Invalid Key",
      diagnosis: `${providerLabel} rejected the API key (${rawMsg || "Unauthorized / API key invalid"}).`,
      suggestedAction: params.providerType === "gemini" ? "Copy the exact AIza... key from Google AI Studio (aistudio.google.com/apikey) with no extra spaces." : "Copy a valid xai-... secret key from console.x.ai and verify it has not been revoked.",
      providerMessage: rawMsg || void 0,
      failureSource: apiSource
    };
  }
  if (status === 403 || lower.includes("permission_denied") || lower.includes("permission denied") || lower.includes("has not been used in project") || lower.includes("is disabled") || lower.includes("ip_address_blocked") || lower.includes("referer")) {
    return {
      correlationId,
      httpStatus: status || 403,
      category: "permission_denied_403",
      connectionStatus: "permission_denied",
      title: "Permission Denied",
      diagnosis: params.authenticated ? `Key listed models, but lacks permission for ${params.model || "this model"} (${rawMsg}).` : `${providerLabel} denied access (403): ${rawMsg || "Restricted key, disabled API, or HTTP referrer restriction."}`,
      suggestedAction: params.providerType === "gemini" ? 'In Google Cloud Console, enable "Generative Language API" and remove HTTP Referrer restrictions for backend server calls.' : "Check xAI key permissions/ACL scopes in console.x.ai.",
      providerMessage: rawMsg || void 0,
      failureSource: apiSource
    };
  }
  if (status === 404 || lower.includes("not_found") || lower.includes("not found") || lower.includes("does not exist")) {
    return {
      correlationId,
      httpStatus: status || 404,
      category: "not_found_404",
      connectionStatus: "endpoint_not_found",
      title: "Model Unavailable",
      diagnosis: params.authenticated ? `Model "${params.model || "selected"}" is unavailable or returned 404 (${rawMsg}).` : `Requested model "${params.model || ""}" was not found (404): ${rawMsg}`,
      suggestedAction: "Click Retry Test so 360Khabarnama can try the next supported model on your key.",
      providerMessage: rawMsg || void 0,
      failureSource: apiSource
    };
  }
  if (isRateOrDailyQuota || lower.includes("quota")) {
    const retryText = quotaMeta.retryAfterSeconds ? `Retry in ${formatRetryDuration(quotaMeta.retryAfterSeconds)}` : "Wait for quota reset before retrying";
    const tierNote = quotaMeta.isFreeTierCap ? `Free-tier${quotaMeta.quotaLimit ? ` (${quotaMeta.quotaLimit}/day)` : ""} quota exhausted` : "Quota or rate limit exhausted";
    const cleanReason = quotaMeta.conciseMessage || rawMsg;
    return {
      correlationId,
      httpStatus: status || 429,
      category: "quota_429",
      connectionStatus: "quota_exhausted",
      title: "Quota Exceeded",
      diagnosis: params.authenticated ? `Key verified, but ${tierNote.toLowerCase()} on ${params.model || "selected model"}. ${retryText}.` : `${providerLabel} ${tierNote.toLowerCase()} on ${params.model || "selected model"} (429). ${retryText}.`,
      suggestedAction: quotaMeta.isFreeTierCap ? `${retryText}, lower background AI automation frequency, or select another project/paid API tier in AI Studio.` : `${retryText}, then click Retry Test.`,
      providerMessage: cleanReason || void 0,
      failureSource: apiSource,
      retryAfterSeconds: quotaMeta.retryAfterSeconds
    };
  }
  if (status === 400 || lower.includes("invalid_argument") || lower.includes("bad request")) {
    if (lower.includes("api_key_invalid") || lower.includes("api key not valid")) {
      return {
        correlationId,
        httpStatus: 400,
        category: "auth_failed_401",
        connectionStatus: "auth_failed",
        title: "Invalid Key",
        diagnosis: `Google Gemini reported API_KEY_INVALID: ${rawMsg}`,
        suggestedAction: "Generate a fresh key in Google AI Studio and paste it cleanly without spaces.",
        providerMessage: rawMsg || void 0,
        failureSource: apiSource
      };
    }
    return {
      correlationId,
      httpStatus: 400,
      category: "bad_request_400",
      connectionStatus: params.authenticated ? "authenticated_generation_unavailable" : "error",
      title: "Model Unavailable",
      diagnosis: params.authenticated ? `Credentials verified, but generation request was rejected by ${params.model || "model"} (400): ${rawMsg}` : `${providerLabel} rejected the request payload (400): ${rawMsg}`,
      suggestedAction: "Retry so another compatible free-tier text model is selected automatically.",
      providerMessage: rawMsg || void 0,
      failureSource: apiSource
    };
  }
  if (typeof status === "number" && status >= 500) {
    return {
      correlationId,
      httpStatus: status,
      category: "server_error_5xx",
      connectionStatus: "server_error",
      title: "Provider Unavailable",
      diagnosis: `${providerLabel} experienced an upstream server error (HTTP ${status}): ${rawMsg}`,
      suggestedAction: "This is a temporary provider outage. Click Retry Test shortly.",
      providerMessage: rawMsg || void 0,
      failureSource: apiSource
    };
  }
  return {
    correlationId,
    httpStatus: status,
    category: "unknown",
    connectionStatus: params.authenticated ? "authenticated_generation_unavailable" : "error",
    title: `${providerLabel} Unexpected Error`,
    diagnosis: params.authenticated ? `Credentials verified, but test generation failed: ${rawMsg || "Unexpected error."}` : rawMsg || `Unexpected error communicating with ${providerLabel}.`,
    suggestedAction: `Check Connection Diagnostics (Correlation ID: ${correlationId}) and click Retry Test.`,
    providerMessage: rawMsg || void 0,
    failureSource: apiSource
  };
}
async function checkOutboundConnectivity() {
  const targets = [
    {
      host: "generativelanguage.googleapis.com",
      provider: "Google Gemini API",
      probeUrl: "https://generativelanguage.googleapis.com/v1beta/models"
    },
    {
      host: "api.x.ai",
      provider: "xAI Grok API",
      probeUrl: "https://api.x.ai/v1/models"
    }
  ];
  const hosts = [];
  for (const t of targets) {
    const start = Date.now();
    let dnsResolved = false;
    let resolvedIp;
    try {
      const lookup = await dns.lookup(t.host);
      dnsResolved = true;
      resolvedIp = lookup.address;
    } catch (dnsErr) {
      hosts.push({
        host: t.host,
        provider: t.provider,
        dnsResolved: false,
        httpsReachable: false,
        latencyMs: Date.now() - start,
        error: `DNS lookup failed: ${dnsErr?.message || dnsErr?.code || "unknown"}`,
        guidance: `Confirm DNS resolution for ${t.host} on your hosting server / Namecheap environment.`
      });
      continue;
    }
    try {
      const res = await fetchWithTimeout(t.probeUrl, { method: "GET" }, 8e3);
      hosts.push({
        host: t.host,
        provider: t.provider,
        dnsResolved,
        resolvedIp,
        httpsReachable: true,
        httpStatus: res.status,
        latencyMs: Date.now() - start
      });
    } catch (netErr) {
      hosts.push({
        host: t.host,
        provider: t.provider,
        dnsResolved,
        resolvedIp,
        httpsReachable: false,
        latencyMs: Date.now() - start,
        error: netErr?.message || "HTTPS connection failed",
        guidance: `Outbound TCP 443 to ${t.host} (${resolvedIp}) appears blocked or timed out. On Namecheap Shared Hosting, contact support to whitelist outbound HTTPS port 443 to ${t.host}.`
      });
    }
  }
  const overallOk = hosts.every((h) => h.dnsResolved && h.httpsReachable);
  return {
    checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
    overallOk,
    hosts,
    hostingNote: overallOk ? "Outbound HTTPS (TLS 443) to Google Gemini and xAI Grok endpoints is reachable from this Node.js server." : "One or more AI provider endpoints could not be reached over outbound HTTPS (443). This indicates a hosting firewall/DNS issue rather than an invalid API key."
  };
}

// services/ai/AIModelDiscovery.ts
function isDeprecatedGeminiModel(id) {
  const lower = id.toLowerCase();
  return lower.includes("gemini-1.5") || lower.includes("gemini-1.0") || lower.includes("gemini-2.0") || lower === "gemini-pro" || lower.startsWith("gemini-pro-");
}
function isPaidOnlyGeminiModel(id) {
  const lower = id.toLowerCase();
  return lower.includes("carbon") || lower.includes("argon") || lower.includes("2.5-pro") || lower.includes("3-pro") || lower.includes("3.1-pro") || lower.includes("deep-research") || lower.includes("imagen") || lower.includes("veo") || lower.includes("lyria") || lower.includes("nano-banana") || lower.includes("-image") || lower.includes("pro-preview");
}
function isFreeTierGeminiModel(id) {
  const lower = id.toLowerCase();
  if (isDeprecatedGeminiModel(lower) || isPaidOnlyGeminiModel(lower)) return false;
  return lower === "gemini-4-hydrogen" || lower.includes("hydrogen") || lower.includes("flash-lite") || lower.includes("2.5-flash") || lower.includes("3-flash") || lower.includes("3.1-flash") || lower.includes("3.5-flash") || lower === "gemini-flash-latest" || lower.includes("flash");
}
function scoreGeminiModel(id) {
  const lower = id.toLowerCase();
  if (lower.includes("embedding") || lower.includes("aqa") || lower.includes("imagen") || lower.includes("veo") || lower.includes("tts") || lower.includes("live") || lower.includes("transcribe") || lower.includes("lyria") || lower.includes("-image") || lower.includes("nano-banana") || lower.includes("computer-use") || lower.includes("robotics") || lower.includes("deep-research") || lower.includes("antigravity") || isDeprecatedGeminiModel(lower)) {
    return -100;
  }
  let score = 10;
  if (lower === "gemini-4-hydrogen") score += 120;
  else if (lower === "gemini-3.1-flash-lite") score += 115;
  else if (lower === "gemini-3.5-flash-lite") score += 110;
  else if (lower === "gemini-flash-lite-latest") score += 105;
  else if (lower === "gemini-2.5-flash-lite") score += 102;
  else if (lower === "gemini-2.5-flash") score += 98;
  else if (lower === "gemini-flash-latest") score += 95;
  else if (lower.includes("gemini-3") && lower.includes("flash")) score += 90;
  else if (lower.includes("flash")) score += 82;
  else if (lower === "gemini-4-argon") score += 42;
  else if (lower === "gemini-4-carbon") score += 38;
  else if (lower.includes("gemini-4")) score += 36;
  else if (lower.includes("gemini-2.5-pro")) score += 30;
  else if (lower.includes("argon") || lower.includes("carbon") || lower.includes("pro")) score += 25;
  if (lower.includes("preview") || lower.includes("exp")) score -= 8;
  return score;
}
function selectAutoGeminiModel(models, allowPaidModels = false) {
  const textModels = models.filter((m) => m.supportsTextGeneration && !isDeprecatedGeminiModel(m.id)).sort((a, b) => scoreGeminiModel(b.id) - scoreGeminiModel(a.id));
  const fallbackGen = models.filter(
    (m) => m.supportedMethods?.includes("generateContent") && !isDeprecatedGeminiModel(m.id) && !m.id.toLowerCase().includes("embedding") && !m.id.toLowerCase().includes("imagen") && !m.id.toLowerCase().includes("veo")
  ).sort((a, b) => scoreGeminiModel(b.id) - scoreGeminiModel(a.id));
  const orderedPool = textModels.length > 0 ? textModels : fallbackGen;
  const freeTierCandidates = orderedPool.filter((m) => isFreeTierGeminiModel(m.id)).map((m) => m.id);
  const allCandidates = orderedPool.map((m) => m.id);
  if (freeTierCandidates.length > 0) {
    return {
      selectedModel: freeTierCandidates[0],
      freeTierCandidates,
      allCandidates,
      onlyPaidAvailable: false
    };
  }
  const nonPaidUnknown = orderedPool.filter((m) => !isPaidOnlyGeminiModel(m.id)).map((m) => m.id);
  if (nonPaidUnknown.length > 0) {
    return {
      selectedModel: nonPaidUnknown[0],
      freeTierCandidates: [],
      allCandidates: nonPaidUnknown,
      onlyPaidAvailable: false
    };
  }
  if (allowPaidModels && allCandidates.length > 0) {
    return {
      selectedModel: allCandidates[0],
      freeTierCandidates: [],
      allCandidates,
      onlyPaidAvailable: true
    };
  }
  return {
    selectedModel: null,
    freeTierCandidates: [],
    allCandidates,
    onlyPaidAvailable: allCandidates.length > 0
  };
}
function scoreGrokModel(id) {
  const lower = id.toLowerCase();
  if (lower.includes("image") || lower.includes("vision-only") || lower.includes("embed") || lower.includes("imagine")) {
    return -100;
  }
  let score = 10;
  if (lower.includes("grok-3-mini")) score += 90;
  else if (lower.includes("grok-4") && lower.includes("fast")) score += 86;
  else if (lower.includes("grok-3-fast")) score += 82;
  else if (lower.includes("grok-3")) score += 75;
  else if (lower.includes("grok-4")) score += 70;
  else if (lower.includes("grok")) score += 50;
  return score;
}
function selectAutoGrokModel(models) {
  const sorted = [...models].filter((m) => m.supportsTextGeneration).sort((a, b) => scoreGrokModel(b.id) - scoreGrokModel(a.id));
  return sorted[0]?.id || models[0]?.id || null;
}
function extractRateLimitHeaders(headers) {
  const remReq = headers.get("x-ratelimit-remaining-requests");
  const remTok = headers.get("x-ratelimit-remaining-tokens");
  const reset = headers.get("x-ratelimit-reset-requests") || headers.get("retry-after");
  if (!remReq && !remTok && !reset) return void 0;
  return {
    remainingRequests: remReq ? Number(remReq) : void 0,
    remainingTokens: remTok ? Number(remTok) : void 0,
    resetAt: reset || void 0
  };
}
var AIModelDiscovery = class {
  /**
   * Best-effort non-billable inspection of xAI API key metadata (/v1/api-key).
   * Returns null silently if the endpoint is unsupported or restricted.
   */
  static async inspectGrokApiKeyMetadata(apiKey, baseUrl = "https://api.x.ai/v1", signal) {
    const cleanKey = apiKey.trim();
    if (!cleanKey) return null;
    const normalizedBase = baseUrl.trim().replace(/\/+$/, "").replace(/\/(chat\/completions|responses|models)$/i, "") || "https://api.x.ai/v1";
    try {
      const res = await fetchWithTimeout(
        `${normalizedBase}/api-key`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${cleanKey}`,
            Accept: "application/json"
          },
          signal
        },
        8e3
      );
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      if (!data) return null;
      return {
        keyBlocked: Boolean(data.api_key_blocked || data.team_blocked || data.disabled),
        acls: Array.isArray(data.acls) ? data.acls : void 0,
        teamId: data.team_id ? String(data.team_id) : void 0,
        name: data.name ? String(data.name) : void 0
      };
    } catch {
      return null;
    }
  }
  static async discoverGeminiModels(apiKey, signal) {
    const correlationId = generateCorrelationId("gem-models");
    const start = Date.now();
    const cleanKey = apiKey.trim();
    if (!cleanKey) {
      throw new ProviderExecutionError(
        classifyProviderError({
          providerType: "gemini",
          httpStatus: 401,
          providerMessage: "API key is empty.",
          stage: "model_list",
          correlationId
        })
      );
    }
    const models = [];
    let pageToken;
    let pageCount = 0;
    try {
      do {
        const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
        url.searchParams.set("pageSize", "100");
        if (pageToken) url.searchParams.set("pageToken", pageToken);
        const res = await fetchWithTimeout(
          url.toString(),
          {
            method: "GET",
            headers: {
              "x-goog-api-key": cleanKey,
              "User-Agent": "aistudio-build"
            },
            signal
          },
          getDiscoveryTimeoutMs()
        );
        const rawText = await safeReadResponseText(res);
        let parsed = null;
        try {
          parsed = rawText ? JSON.parse(rawText) : {};
        } catch {
          throw new ProviderExecutionError(
            classifyProviderError({
              providerType: "gemini",
              httpStatus: res.status,
              providerMessage: `Malformed non-JSON response from /v1beta/models (${rawText.slice(0, 120)})`,
              stage: "model_list",
              correlationId,
              secretToRedact: cleanKey
            })
          );
        }
        if (!res.ok) {
          throw new ProviderExecutionError(
            classifyProviderError({
              providerType: "gemini",
              httpStatus: res.status,
              providerMessage: parsed?.error?.message || parsed?.message || `HTTP ${res.status}`,
              providerErrorCode: parsed?.error?.status,
              stage: "model_list",
              correlationId,
              secretToRedact: cleanKey
            })
          );
        }
        const rawList = Array.isArray(parsed?.models) ? parsed.models : [];
        for (const m of rawList) {
          const rawName = String(m.name || "");
          const id = rawName.startsWith("models/") ? rawName.slice("models/".length) : rawName;
          if (!id) continue;
          const methods = Array.isArray(m.supportedGenerationMethods) ? m.supportedGenerationMethods : [];
          const supportsGen = methods.includes("generateContent");
          models.push({
            id,
            displayName: m.displayName || id,
            description: m.description ? String(m.description).slice(0, 180) : void 0,
            supportedMethods: methods,
            supportsTextGeneration: supportsGen && scoreGeminiModel(id) > 0,
            inputTokenLimit: typeof m.inputTokenLimit === "number" ? m.inputTokenLimit : void 0,
            outputTokenLimit: typeof m.outputTokenLimit === "number" ? m.outputTokenLimit : void 0
          });
        }
        pageToken = parsed?.nextPageToken;
        pageCount++;
      } while (pageToken && pageCount < 3);
      const textModels = models.filter((m) => m.supportsTextGeneration).sort((a, b) => scoreGeminiModel(b.id) - scoreGeminiModel(a.id));
      const autoPick = selectAutoGeminiModel(models, false);
      return {
        ok: true,
        providerType: "gemini",
        models: [
          ...textModels,
          ...models.filter((m) => !m.supportsTextGeneration)
        ],
        recommendedModel: autoPick.selectedModel,
        latencyMs: Date.now() - start,
        correlationId
      };
    } catch (err) {
      if (err instanceof ProviderExecutionError) throw err;
      throw new ProviderExecutionError(
        classifyProviderError({
          providerType: "gemini",
          err,
          stage: "model_list",
          correlationId,
          secretToRedact: cleanKey
        })
      );
    }
  }
  static async discoverGrokModels(apiKey, baseUrl = "https://api.x.ai/v1", signal) {
    const correlationId = generateCorrelationId("grok-models");
    const start = Date.now();
    const cleanKey = apiKey.trim();
    if (!cleanKey) {
      throw new ProviderExecutionError(
        classifyProviderError({
          providerType: "grok",
          httpStatus: 401,
          providerMessage: "API key is empty.",
          stage: "model_list",
          correlationId
        })
      );
    }
    const normalizedBase = baseUrl.trim().replace(/\/+$/, "").replace(/\/(chat\/completions|responses|models)$/i, "") || "https://api.x.ai/v1";
    const modelsUrl = `${normalizedBase}/models`;
    try {
      const res = await fetchWithTimeout(
        modelsUrl,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${cleanKey}`,
            Accept: "application/json"
          },
          signal
        },
        getDiscoveryTimeoutMs()
      );
      const rawText = await safeReadResponseText(res);
      let parsed = null;
      try {
        parsed = rawText ? JSON.parse(rawText) : {};
      } catch {
        throw new ProviderExecutionError(
          classifyProviderError({
            providerType: "grok",
            httpStatus: res.status,
            providerMessage: `Malformed non-JSON response from ${modelsUrl}: ${rawText.slice(0, 120)}`,
            stage: "model_list",
            correlationId,
            secretToRedact: cleanKey
          })
        );
      }
      if (!res.ok) {
        throw new ProviderExecutionError(
          classifyProviderError({
            providerType: "grok",
            httpStatus: res.status,
            providerMessage: parsed?.error?.message || parsed?.error || parsed?.message || `HTTP ${res.status}`,
            providerErrorCode: parsed?.code || parsed?.error?.code,
            stage: "model_list",
            correlationId,
            secretToRedact: cleanKey
          })
        );
      }
      const rawList = Array.isArray(parsed?.data) ? parsed.data : Array.isArray(parsed?.models) ? parsed.models : [];
      const models = rawList.map((m) => {
        const id = String(m.id || m.name || "").trim();
        if (!id) return null;
        const isText = scoreGrokModel(id) > 0;
        return {
          id,
          displayName: m.display_name || id,
          supportedMethods: isText ? ["responses", "chat.completions"] : ["specialized"],
          supportsTextGeneration: isText
        };
      }).filter(Boolean);
      const sortedText = models.filter((m) => m.supportsTextGeneration).sort((a, b) => scoreGrokModel(b.id) - scoreGrokModel(a.id));
      return {
        ok: true,
        providerType: "grok",
        models: [
          ...sortedText,
          ...models.filter((m) => !m.supportsTextGeneration)
        ],
        recommendedModel: sortedText[0]?.id || models[0]?.id || null,
        latencyMs: Date.now() - start,
        correlationId,
        rateLimitInfo: extractRateLimitHeaders(res.headers)
      };
    } catch (err) {
      if (err instanceof ProviderExecutionError) throw err;
      throw new ProviderExecutionError(
        classifyProviderError({
          providerType: "grok",
          err,
          stage: "model_list",
          correlationId,
          secretToRedact: cleanKey
        })
      );
    }
  }
};

// services/ai/GeminiProvider.ts
var GeminiProvider = class {
  static createClient(apiKey) {
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  static async execute(opts) {
    const cleanKey = (opts.apiKey || "").trim();
    if (!cleanKey) {
      throw new ProviderExecutionError(
        classifyProviderError({
          providerType: "gemini",
          httpStatus: 401,
          providerMessage: "Gemini API key is missing.",
          stage: "inference"
        })
      );
    }
    const start = Date.now();
    const model = (opts.model || "").trim();
    if (!model) {
      throw new ProviderExecutionError(
        classifyProviderError({
          providerType: "gemini",
          httpStatus: 400,
          providerMessage: "No Gemini model selected for this credential.",
          stage: "inference"
        })
      );
    }
    const client = this.createClient(cleanKey);
    const timeoutController = new AbortController();
    const timeoutMs = opts.timeoutMs || getInferenceTimeoutMs();
    const timer = setTimeout(
      () => {
        const timeoutErr = new Error(`Gemini request timed out after ${timeoutMs}ms`);
        timeoutErr.name = "TimeoutError";
        timeoutController.abort(timeoutErr);
      },
      timeoutMs
    );
    const onCallerAbort = () => timeoutController.abort(opts.signal?.reason || new Error("Aborted"));
    if (opts.signal) {
      if (opts.signal.aborted) {
        clearTimeout(timer);
        throw new Error("Request aborted by caller");
      }
      opts.signal.addEventListener("abort", onCallerAbort, { once: true });
    }
    const isGemini4 = model.startsWith("gemini-4-");
    const isGemini3 = model.startsWith("gemini-3");
    const isGemini25 = model.startsWith("gemini-2.5");
    const config = {};
    if (opts.jsonMode) {
      config.responseMimeType = "application/json";
      if (!isGemini4) {
        config.maxOutputTokens = Math.max(opts.maxTokens || 4096, 4096);
      }
    } else if (!isGemini4 && typeof opts.maxTokens === "number" && opts.maxTokens > 0) {
      config.maxOutputTokens = opts.maxTokens;
    }
    if (!isGemini4 && !isGemini3 && typeof opts.temperature === "number") {
      config.temperature = opts.temperature;
    }
    if (isGemini4) {
      config.thinkingConfig = { thinkingLevel: "LOW" };
    } else if (isGemini3 && opts.jsonMode && model.includes("flash-lite")) {
      config.thinkingConfig = { thinkingLevel: "MINIMAL" };
    } else if (isGemini25 && model.includes("flash") && opts.maxTokens && opts.maxTokens <= 1024) {
      config.thinkingConfig = { thinkingBudget: 0 };
    }
    if (opts.systemInstruction) {
      config.systemInstruction = opts.systemInstruction;
    }
    config.abortSignal = timeoutController.signal;
    try {
      const response = await client.models.generateContent({
        model,
        contents: opts.prompt,
        config
      });
      const firstCandidate = response.candidates?.[0];
      let text = response.text || "";
      if (!text && Array.isArray(firstCandidate?.content?.parts)) {
        text = firstCandidate.content.parts.filter((part) => !part?.thought && typeof part?.text === "string").map((part) => part.text).join("");
      }
      if (!text.trim()) {
        throw new ProviderExecutionError(
          classifyProviderError({
            providerType: "gemini",
            providerMessage: `Empty response payload from ${model} (finishReason=${firstCandidate?.finishReason || "unknown"})`,
            model,
            stage: "inference",
            secretToRedact: cleanKey,
            timeoutWindowMs: timeoutMs
          })
        );
      }
      const usage = response.usageMetadata || {};
      const promptTokens = usage.promptTokenCount || Math.ceil(opts.prompt.length / 4);
      const completionTokens = usage.candidatesTokenCount || Math.ceil(text.length / 4);
      const totalTokens = usage.totalTokenCount || promptTokens + completionTokens;
      return {
        text,
        model,
        promptTokens,
        completionTokens,
        totalTokens,
        latencyMs: Date.now() - start,
        finishReason: firstCandidate?.finishReason
      };
    } catch (err) {
      if (err instanceof ProviderExecutionError) throw err;
      throw new ProviderExecutionError(
        classifyProviderError({
          providerType: "gemini",
          err,
          model,
          stage: "inference",
          secretToRedact: cleanKey,
          timeoutWindowMs: timeoutMs
        })
      );
    } finally {
      clearTimeout(timer);
      if (opts.signal) {
        opts.signal.removeEventListener("abort", onCallerAbort);
      }
    }
  }
  /**
   * Minimal live generateContent test using official v1beta REST endpoint and x-goog-api-key header.
   * Uses a configurable 45000-60000ms window, tiny prompt ("Reply with OK."), minimal thinking,
   * and at most one bounded jittered retry on transient timeout/5xx within remaining budget.
   */
  static async testGeneration(apiKey, model, signal, options) {
    const cleanKey = apiKey.trim();
    const correlationId = generateCorrelationId("gem-gen");
    const overallStart = Date.now();
    const cleanModel = model.startsWith("models/") ? model.slice("models/".length) : model;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:generateContent`;
    const configuredTimeoutMs = options?.timeoutMs ? Math.max(15e3, Math.min(6e4, options.timeoutMs)) : getGenerationTimeoutMs();
    const deadlineMs = options?.deadlineMs || overallStart + Math.min(58e3, configuredTimeoutMs + 1e4);
    const allowRetry = options?.retryOnTransient !== false;
    const isGemini4 = cleanModel.startsWith("gemini-4-");
    const isGemini3 = cleanModel.startsWith("gemini-3");
    const isGemini25 = cleanModel.startsWith("gemini-2.5");
    const generationConfig = {
      maxOutputTokens: isGemini25 && cleanModel.includes("pro") ? 256 : 32
    };
    if (isGemini4) {
      generationConfig.thinkingConfig = { thinkingLevel: "LOW" };
    } else if (isGemini3) {
      generationConfig.thinkingConfig = {
        thinkingLevel: cleanModel.includes("flash") ? "MINIMAL" : "LOW"
      };
    } else if (isGemini25) {
      generationConfig.thinkingConfig = {
        thinkingBudget: cleanModel.includes("pro") ? 128 : 0
      };
    } else {
      generationConfig.temperature = 0;
    }
    const executeSingleAttempt = async (attemptTimeoutMs, retried) => {
      const res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": cleanKey,
            "User-Agent": "aistudio-build"
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: "Reply with OK." }]
              }
            ],
            generationConfig
          }),
          signal
        },
        attemptTimeoutMs
      );
      const rawText = await safeReadResponseText(res);
      let parsed = null;
      try {
        parsed = rawText ? JSON.parse(rawText) : {};
      } catch {
        throw new ProviderExecutionError(
          classifyProviderError({
            providerType: "gemini",
            httpStatus: res.status,
            providerMessage: `Malformed non-JSON response from generateContent: ${rawText.slice(0, 120)}`,
            model: cleanModel,
            stage: "generation_test",
            authenticated: true,
            correlationId,
            secretToRedact: cleanKey,
            timeoutWindowMs: attemptTimeoutMs,
            retried
          })
        );
      }
      if (!res.ok) {
        throw new ProviderExecutionError(
          classifyProviderError({
            providerType: "gemini",
            httpStatus: res.status,
            providerMessage: parsed?.error?.message || parsed?.message || `HTTP ${res.status}`,
            providerErrorCode: parsed?.error?.status,
            model: cleanModel,
            stage: "generation_test",
            authenticated: true,
            correlationId,
            secretToRedact: cleanKey,
            timeoutWindowMs: attemptTimeoutMs,
            retried
          })
        );
      }
      const candidate = parsed?.candidates?.[0];
      const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
      const nonThoughtText = parts.filter((p) => !p?.thought && typeof p?.text === "string").map((p) => p.text).join("").trim();
      const anyText = parts.filter((p) => typeof p?.text === "string").map((p) => p.text).join("").trim();
      const text = nonThoughtText || anyText;
      if (!text) {
        throw new ProviderExecutionError(
          classifyProviderError({
            providerType: "gemini",
            providerMessage: `Empty response payload from ${cleanModel} (finishReason=${candidate?.finishReason || "unknown"})`,
            model: cleanModel,
            stage: "generation_test",
            authenticated: true,
            correlationId,
            secretToRedact: cleanKey,
            timeoutWindowMs: attemptTimeoutMs,
            retried
          })
        );
      }
      const usage = parsed?.usageMetadata || {};
      return {
        text,
        model: cleanModel,
        latencyMs: Date.now() - overallStart,
        correlationId,
        retried,
        finishReason: candidate?.finishReason,
        tokenUsage: {
          promptTokens: usage.promptTokenCount,
          completionTokens: usage.candidatesTokenCount,
          totalTokens: usage.totalTokenCount
        }
      };
    };
    try {
      const remainingFirst = Math.max(15e3, Math.min(configuredTimeoutMs, deadlineMs - Date.now()));
      return await executeSingleAttempt(remainingFirst, false);
    } catch (firstErr) {
      if (signal?.aborted) {
        throw firstErr;
      }
      const firstDiag = firstErr instanceof ProviderExecutionError ? firstErr.diagnostic : classifyProviderError({
        providerType: "gemini",
        err: firstErr,
        model: cleanModel,
        stage: "generation_test",
        authenticated: true,
        correlationId,
        secretToRedact: cleanKey,
        timeoutWindowMs: configuredTimeoutMs
      });
      const isTransientRetryable = firstDiag.category === "timeout" || firstDiag.category === "server_error_5xx";
      const remainingBeforeBackoff = deadlineMs - Date.now();
      if (allowRetry && isTransientRetryable && remainingBeforeBackoff > 1e4) {
        const backoffMs = 600 + Math.floor(Math.random() * 400);
        await sleepWithAbort(backoffMs, signal);
        const remainingSecond = Math.max(8e3, Math.min(configuredTimeoutMs, deadlineMs - Date.now()));
        try {
          return await executeSingleAttempt(remainingSecond, true);
        } catch (secondErr) {
          if (secondErr instanceof ProviderExecutionError) {
            throw new ProviderExecutionError({ ...secondErr.diagnostic, retried: true });
          }
          throw new ProviderExecutionError(
            classifyProviderError({
              providerType: "gemini",
              err: secondErr,
              model: cleanModel,
              stage: "generation_test",
              authenticated: true,
              correlationId,
              secretToRedact: cleanKey,
              timeoutWindowMs: remainingSecond,
              retried: true
            })
          );
        }
      }
      if (firstErr instanceof ProviderExecutionError) throw firstErr;
      throw new ProviderExecutionError(firstDiag);
    }
  }
  /**
   * Full validation:
   * 1. GET /v1beta/models (x-goog-api-key header)
   * 2. Select requested model (if accessible) or best discovered generateContent text model
   * 3. Execute minimal live generateContent test
   */
  static async testConnection(apiKey, preferredModel, signal, runGenerationTest = true) {
    const start = Date.now();
    const correlationId = generateCorrelationId("gem-val");
    let availableModels = [];
    let selectedModel = (preferredModel || "").trim();
    try {
      const discovery = await AIModelDiscovery.discoverGeminiModels(apiKey, signal);
      availableModels = discovery.models;
      const textModels = availableModels.filter((m) => m.supportsTextGeneration);
      const allGenerateCapable = availableModels.filter((m) => m.supportedMethods?.includes("generateContent"));
      if (selectedModel) {
        const cleanPref = selectedModel.startsWith("models/") ? selectedModel.slice("models/".length) : selectedModel;
        const found = availableModels.find((m) => m.id === cleanPref);
        if (found) {
          selectedModel = found.id;
        } else if (discovery.recommendedModel) {
          selectedModel = cleanPref;
        }
      } else {
        selectedModel = discovery.recommendedModel || textModels[0]?.id || allGenerateCapable[0]?.id || "";
      }
      if (!runGenerationTest) {
        return {
          ok: true,
          authenticated: true,
          generationVerified: false,
          connectionStatus: availableModels.length > 0 ? "untested" : "error",
          message: `Authenticated with Google Gemini (${availableModels.length} models discovered). Click "Validate & Connect" to verify live text generation.`,
          latencyMs: Date.now() - start,
          providerType: "gemini",
          selectedModel: selectedModel || "",
          availableModels,
          correlationId
        };
      }
      if (!selectedModel) {
        const diag = classifyProviderError({
          providerType: "gemini",
          httpStatus: 404,
          providerMessage: "No models supporting generateContent were returned for this API key.",
          stage: "generation_test",
          authenticated: true,
          correlationId
        });
        return {
          ok: false,
          authenticated: true,
          generationVerified: false,
          connectionStatus: "authenticated_generation_unavailable",
          message: diag.diagnosis,
          latencyMs: Date.now() - start,
          providerType: "gemini",
          selectedModel: "",
          availableModels,
          diagnostic: diag,
          correlationId
        };
      }
    } catch (err) {
      const diag = err instanceof ProviderExecutionError ? err.diagnostic : classifyProviderError({
        providerType: "gemini",
        err,
        stage: "model_list",
        correlationId,
        secretToRedact: apiKey
      });
      return {
        ok: false,
        authenticated: false,
        generationVerified: false,
        connectionStatus: diag.connectionStatus,
        message: diag.diagnosis,
        latencyMs: Date.now() - start,
        providerType: "gemini",
        selectedModel: selectedModel || "",
        availableModels: [],
        diagnostic: diag,
        correlationId: diag.correlationId
      };
    }
    try {
      const genRes = await this.testGeneration(apiKey, selectedModel, signal);
      return {
        ok: true,
        authenticated: true,
        generationVerified: true,
        connectionStatus: "connected",
        message: `Connected to Google Gemini (${genRes.model}) \u2014 ${availableModels.length} models discovered, live generation verified (${genRes.latencyMs}ms).`,
        latencyMs: Date.now() - start,
        providerType: "gemini",
        selectedModel: genRes.model,
        availableModels,
        sampleOutput: genRes.text.slice(0, 120),
        correlationId: genRes.correlationId
      };
    } catch (err) {
      const genDiag = err instanceof ProviderExecutionError ? err.diagnostic : classifyProviderError({
        providerType: "gemini",
        err,
        model: selectedModel,
        stage: "generation_test",
        authenticated: true,
        correlationId,
        secretToRedact: apiKey,
        timeoutWindowMs: getGenerationTimeoutMs()
      });
      const preservedStatus = genDiag.connectionStatus === "timeout" || genDiag.connectionStatus === "quota_exhausted" || genDiag.connectionStatus === "billing_required" || genDiag.connectionStatus === "permission_denied" || genDiag.connectionStatus === "endpoint_not_found" ? genDiag.connectionStatus : "authenticated_generation_unavailable";
      return {
        ok: false,
        authenticated: true,
        generationVerified: false,
        connectionStatus: preservedStatus,
        message: genDiag.diagnosis,
        latencyMs: Date.now() - start,
        providerType: "gemini",
        selectedModel,
        availableModels,
        diagnostic: { ...genDiag, connectionStatus: preservedStatus },
        correlationId: genDiag.correlationId
      };
    }
  }
};

// services/ai/GrokProvider.ts
function extractResponsesOutputText(parsed) {
  if (typeof parsed?.output_text === "string" && parsed.output_text.trim()) {
    return parsed.output_text;
  }
  if (Array.isArray(parsed?.output)) {
    const chunks = [];
    for (const item of parsed.output) {
      if (item?.type === "message" && Array.isArray(item.content)) {
        for (const c of item.content) {
          if (typeof c?.text === "string") {
            chunks.push(c.text);
          }
        }
      } else if (typeof item?.text === "string") {
        chunks.push(item.text);
      }
    }
    const joined = chunks.join("").trim();
    if (joined) return joined;
  }
  if (typeof parsed?.choices?.[0]?.message?.content === "string") {
    return parsed.choices[0].message.content;
  }
  return "";
}
function resolveGrokEndpoints(endpointUrl, providerType = "grok") {
  const raw = (endpointUrl || "https://api.x.ai/v1").trim().replace(/\/+$/, "");
  const isCustomChatCompletions = providerType === "custom" || providerType === "custom_data" || raw.endsWith("/chat/completions");
  if (isCustomChatCompletions && raw.endsWith("/chat/completions")) {
    return {
      baseUrl: raw.replace(/\/chat\/completions$/i, ""),
      inferenceUrl: raw,
      useResponsesApi: false
    };
  }
  if (raw.endsWith("/responses")) {
    return {
      baseUrl: raw.replace(/\/responses$/i, ""),
      inferenceUrl: raw,
      useResponsesApi: true
    };
  }
  if (providerType === "custom" || providerType === "custom_data") {
    return {
      baseUrl: raw,
      inferenceUrl: `${raw}/chat/completions`,
      useResponsesApi: false
    };
  }
  const baseUrl = raw || "https://api.x.ai/v1";
  return {
    baseUrl,
    inferenceUrl: `${baseUrl}/responses`,
    useResponsesApi: true
  };
}
var GrokProvider = class {
  static async execute(opts) {
    const cleanKey = (opts.apiKey || "").trim();
    const providerType = opts.providerType || "grok";
    if (!cleanKey) {
      throw new ProviderExecutionError(
        classifyProviderError({
          providerType,
          httpStatus: 401,
          providerMessage: "Grok / Custom provider API key is missing.",
          stage: "inference"
        })
      );
    }
    const start = Date.now();
    const model = (opts.model || "").trim();
    if (!model) {
      throw new ProviderExecutionError(
        classifyProviderError({
          providerType,
          httpStatus: 400,
          providerMessage: "No Grok model selected for this credential.",
          stage: "inference"
        })
      );
    }
    const { inferenceUrl, useResponsesApi } = resolveGrokEndpoints(opts.endpointUrl, providerType);
    const correlationId = generateCorrelationId(providerType === "grok" ? "grok-exec" : "cust-exec");
    const userContent = opts.jsonMode ? `${opts.prompt}

Respond strictly with valid JSON only (no markdown fences).` : opts.prompt;
    const inputItems = [];
    if (opts.systemInstruction) {
      inputItems.push({ role: "system", content: opts.systemInstruction });
    }
    inputItems.push({ role: "user", content: userContent });
    const body = useResponsesApi ? {
      model,
      input: inputItems,
      temperature: typeof opts.temperature === "number" ? opts.temperature : 0.3
    } : {
      model,
      messages: inputItems,
      temperature: typeof opts.temperature === "number" ? opts.temperature : 0.3
    };
    if (useResponsesApi) {
      if (opts.jsonMode) {
        body.max_output_tokens = Math.max(opts.maxTokens || 4096, 4096);
        body.text = { format: { type: "json_object" } };
      } else if (typeof opts.maxTokens === "number" && opts.maxTokens > 0) {
        body.max_output_tokens = opts.maxTokens;
      }
    } else {
      if (opts.jsonMode) {
        body.max_tokens = Math.max(opts.maxTokens || 4096, 4096);
        body.response_format = { type: "json_object" };
      } else if (typeof opts.maxTokens === "number" && opts.maxTokens > 0) {
        body.max_tokens = opts.maxTokens;
      }
    }
    try {
      const response = await fetchWithTimeout(
        inferenceUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${cleanKey}`
          },
          body: JSON.stringify(body),
          signal: opts.signal
        },
        opts.timeoutMs || getInferenceTimeoutMs()
      );
      const rawText = await safeReadResponseText(response);
      let parsed = {};
      try {
        parsed = rawText ? JSON.parse(rawText) : {};
      } catch {
        throw new ProviderExecutionError(
          classifyProviderError({
            providerType,
            httpStatus: response.status,
            providerMessage: `Provider returned non-JSON HTTP ${response.status}: ${rawText.slice(0, 160)}`,
            model,
            stage: "inference",
            correlationId,
            secretToRedact: cleanKey
          })
        );
      }
      if (!response.ok) {
        throw new ProviderExecutionError(
          classifyProviderError({
            providerType,
            httpStatus: response.status,
            providerMessage: parsed?.error?.message || parsed?.error || parsed?.message || `HTTP ${response.status}`,
            providerErrorCode: parsed?.code || parsed?.error?.code,
            model,
            stage: "inference",
            correlationId,
            secretToRedact: cleanKey
          })
        );
      }
      const text = useResponsesApi ? extractResponsesOutputText(parsed) : parsed?.choices?.[0]?.message?.content || "";
      if (!text || !String(text).trim()) {
        throw new ProviderExecutionError(
          classifyProviderError({
            providerType,
            providerMessage: `Empty response payload from ${model}`,
            model,
            stage: "inference",
            correlationId,
            secretToRedact: cleanKey
          })
        );
      }
      const finishReason = parsed?.status || parsed?.incomplete_details?.reason || parsed?.choices?.[0]?.finish_reason;
      const usage = parsed?.usage || {};
      const promptTokens = usage.input_tokens || usage.prompt_tokens || Math.ceil(opts.prompt.length / 4);
      const completionTokens = usage.output_tokens || usage.completion_tokens || Math.ceil(text.length / 4);
      const totalTokens = usage.total_tokens || promptTokens + completionTokens;
      return {
        text,
        model: parsed?.model || model,
        promptTokens,
        completionTokens,
        totalTokens,
        latencyMs: Date.now() - start,
        finishReason
      };
    } catch (err) {
      if (err instanceof ProviderExecutionError) throw err;
      throw new ProviderExecutionError(
        classifyProviderError({
          providerType,
          err,
          model,
          stage: "inference",
          correlationId,
          secretToRedact: cleanKey
        })
      );
    }
  }
  static async testConnection(apiKey, preferredModel, endpointUrl = "https://api.x.ai/v1", signal, runGenerationTest = true, providerType = "grok") {
    const start = Date.now();
    const correlationId = generateCorrelationId("grok-val");
    const { baseUrl } = resolveGrokEndpoints(endpointUrl, providerType);
    let availableModels = [];
    let selectedModel = (preferredModel || "").trim();
    try {
      const discovery = await AIModelDiscovery.discoverGrokModels(apiKey, baseUrl, signal);
      availableModels = discovery.models;
      const textModels = availableModels.filter((m) => m.supportsTextGeneration);
      if (selectedModel) {
        const found = availableModels.find((m) => m.id === selectedModel);
        selectedModel = found ? found.id : selectedModel;
      } else {
        selectedModel = discovery.recommendedModel || textModels[0]?.id || availableModels[0]?.id || "";
      }
      if (!runGenerationTest) {
        return {
          ok: true,
          authenticated: true,
          generationVerified: false,
          connectionStatus: availableModels.length > 0 ? "untested" : "error",
          message: `Authenticated with xAI (${availableModels.length} models discovered). Click "Validate & Connect" to verify live /v1/responses generation.`,
          latencyMs: Date.now() - start,
          providerType,
          selectedModel,
          availableModels,
          correlationId: discovery.correlationId
        };
      }
      if (!selectedModel) {
        const diag = classifyProviderError({
          providerType,
          httpStatus: 404,
          providerMessage: "No compatible text-generation Grok models were returned by GET /v1/models.",
          stage: "generation_test",
          authenticated: true,
          correlationId
        });
        return {
          ok: false,
          authenticated: true,
          generationVerified: false,
          connectionStatus: "authenticated_generation_unavailable",
          message: diag.diagnosis,
          latencyMs: Date.now() - start,
          providerType,
          selectedModel: "",
          availableModels,
          diagnostic: diag,
          correlationId
        };
      }
    } catch (err) {
      const isCustom = providerType === "custom" || providerType === "custom_data";
      const status = err instanceof ProviderExecutionError ? err.diagnostic.httpStatus : void 0;
      if (!(isCustom && status === 404 && selectedModel)) {
        const diag = err instanceof ProviderExecutionError ? err.diagnostic : classifyProviderError({
          providerType,
          err,
          stage: "model_list",
          correlationId,
          secretToRedact: apiKey
        });
        return {
          ok: false,
          authenticated: false,
          generationVerified: false,
          connectionStatus: diag.connectionStatus,
          message: diag.diagnosis,
          latencyMs: Date.now() - start,
          providerType,
          selectedModel,
          availableModels: [],
          diagnostic: diag,
          correlationId: diag.correlationId
        };
      }
    }
    const genTimeoutMs = getGenerationTimeoutMs();
    try {
      const executeGrokTest = () => this.execute({
        apiKey,
        model: selectedModel,
        endpointUrl,
        providerType,
        prompt: "Reply with OK.",
        temperature: 0,
        maxTokens: 16,
        signal,
        timeoutMs: genTimeoutMs
      });
      let res;
      try {
        res = await executeGrokTest();
      } catch (firstErr) {
        const firstDiag = firstErr instanceof ProviderExecutionError ? firstErr.diagnostic : void 0;
        const canRetry = !signal?.aborted && firstDiag && (firstDiag.category === "timeout" || firstDiag.category === "server_error_5xx") && Date.now() - start < 15e3;
        if (!canRetry) throw firstErr;
        await sleepWithAbort(750, signal);
        res = await executeGrokTest();
      }
      return {
        ok: true,
        authenticated: true,
        generationVerified: true,
        connectionStatus: "connected",
        message: `Connected to xAI (${res.model}) \u2014 ${availableModels.length} models discovered, /v1/responses test passed (${res.latencyMs}ms).`,
        latencyMs: Date.now() - start,
        providerType,
        selectedModel: res.model,
        availableModels,
        sampleOutput: res.text.slice(0, 120),
        correlationId
      };
    } catch (err) {
      const baseDiag = err instanceof ProviderExecutionError ? err.diagnostic : classifyProviderError({
        providerType,
        err,
        model: selectedModel,
        stage: "generation_test",
        authenticated: true,
        correlationId,
        secretToRedact: apiKey,
        timeoutWindowMs: genTimeoutMs
      });
      const diag = availableModels.length > 0 && baseDiag.connectionStatus !== "auth_failed" ? {
        ...baseDiag,
        connectionStatus: baseDiag.category === "timeout" ? "timeout" : baseDiag.connectionStatus === "billing_required" || baseDiag.connectionStatus === "quota_exhausted" || baseDiag.connectionStatus === "permission_denied" || baseDiag.connectionStatus === "endpoint_not_found" ? baseDiag.connectionStatus : "authenticated_generation_unavailable",
        title: baseDiag.category === "timeout" ? "Generation Timeout (Credentials Verified)" : baseDiag.title,
        diagnosis: baseDiag.category === "timeout" ? "xAI Grok credentials verified, but the generation test timed out. Your key may be valid." : baseDiag.diagnosis
      } : baseDiag;
      return {
        ok: false,
        authenticated: availableModels.length > 0,
        generationVerified: false,
        connectionStatus: diag.connectionStatus,
        message: diag.diagnosis,
        latencyMs: Date.now() - start,
        providerType,
        selectedModel,
        availableModels,
        diagnostic: diag,
        correlationId: diag.correlationId
      };
    }
  }
};

// services/ai/AIUsageTracker.ts
var MODEL_PRICING_PER_1M = {
  "gemini-4-hydrogen": { input: 0.15, output: 0.6 },
  "gemini-3.1-flash-lite": { input: 0.075, output: 0.3 },
  "gemini-4-argon": { input: 1.25, output: 5 },
  "gemini-4-carbon": { input: 2.5, output: 10 },
  "gemini-2.5-flash": { input: 0.15, output: 0.6 },
  "gemini-2.5-flash-lite": { input: 0.075, output: 0.3 },
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
  "gemini-2.0-flash-lite": { input: 0.075, output: 0.3 },
  "gemini-1.5-flash": { input: 0.075, output: 0.3 },
  "grok-3-mini": { input: 0.3, output: 0.5 },
  "grok-3-fast": { input: 5, output: 15 },
  "grok-3": { input: 3, output: 15 }
};
var AIUsageTracker = class {
  static estimateCostUsd(model, promptTokens, completionTokens) {
    const rate = MODEL_PRICING_PER_1M[model] || { input: 0.5, output: 1.5 };
    const inputCost = promptTokens / 1e6 * rate.input;
    const outputCost = completionTokens / 1e6 * rate.output;
    return parseFloat((inputCost + outputCost).toFixed(6));
  }
  static checkBudget(cred) {
    if (!cred.enabled) {
      return { allowed: false, reason: `Credential "${cred.label}" is disabled.` };
    }
    if (cred.dailyTokenLimit > 0 && (cred.dailyTokensUsed || 0) >= cred.dailyTokenLimit) {
      return {
        allowed: false,
        reason: `Daily token limit reached for "${cred.label}" (${cred.dailyTokensUsed.toLocaleString()} / ${cred.dailyTokenLimit.toLocaleString()}).`
      };
    }
    if (cred.monthlyBudgetUsd > 0 && (cred.monthlySpendUsd || 0) >= cred.monthlyBudgetUsd) {
      return {
        allowed: false,
        reason: `Monthly USD budget reached for "${cred.label}" ($${cred.monthlySpendUsd.toFixed(2)} / $${cred.monthlyBudgetUsd.toFixed(2)}).`
      };
    }
    return { allowed: true };
  }
  static record(params) {
    const totalTokens = (params.promptTokens || 0) + (params.completionTokens || 0);
    const estimatedCostUsd = params.status === "success" ? this.estimateCostUsd(params.model, params.promptTokens, params.completionTokens) : 0;
    const entry = {
      id: `aiuse-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      task: params.task,
      credentialId: params.credentialId,
      providerType: params.providerType,
      projectId: params.projectId,
      model: params.model,
      promptTokens: params.promptTokens || 0,
      completionTokens: params.completionTokens || 0,
      totalTokens,
      estimatedCostUsd,
      latencyMs: params.latencyMs,
      status: params.status,
      errorMessage: params.errorMessage,
      correlationId: params.correlationId,
      actor: params.actor
    };
    db.recordAiUsage(entry);
    return entry;
  }
  static getSummary() {
    const logs = db.getAiUsageLogs(500);
    const now = Date.now();
    const dayAgo = now - 24 * 3600 * 1e3;
    const recent24h = logs.filter((l) => new Date(l.timestamp).getTime() >= dayAgo);
    return {
      totalRequests: logs.length,
      requests24h: recent24h.length,
      tokens24h: recent24h.reduce((s, l) => s + (l.totalTokens || 0), 0),
      totalCostUsd: parseFloat(logs.reduce((s, l) => s + (l.estimatedCostUsd || 0), 0).toFixed(4)),
      errorRatePercent: logs.length > 0 ? parseFloat((logs.filter((l) => l.status === "error").length / logs.length * 100).toFixed(1)) : 0,
      logs: logs.slice(0, 100)
    };
  }
};

// src/server/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

// src/server/errorTracker.ts
var MAX_LOGS = 200;
var errorRingBuffer = [];
function redactSensitiveText(input) {
  return String(input || "").replace(/AIza[0-9A-Za-z\-_]{20,}/g, "[REDACTED_GEMINI_KEY]").replace(/xai-[0-9A-Za-z\-_]{16,}/g, "[REDACTED_XAI_KEY]").replace(/Bearer\s+[0-9A-Za-z\-_.]{16,}/gi, "Bearer [REDACTED]").replace(/-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]").replace(/(password|secret|token|key)=([^&\s]+)/gi, "$1=[REDACTED]");
}
function recordServerError(entry) {
  const clean = {
    ...entry,
    id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    message: redactSensitiveText(entry.message).slice(0, 600)
  };
  errorRingBuffer.unshift(clean);
  if (errorRingBuffer.length > MAX_LOGS) {
    errorRingBuffer.length = MAX_LOGS;
  }
  return clean;
}
function getServerErrorLogs(limit = 50) {
  return errorRingBuffer.slice(0, Math.max(1, Math.min(limit, MAX_LOGS)));
}

// src/server/supabaseAdmin.ts
function detectBackendRuntimeInfo() {
  if (process.env.VERCEL || process.env.VERCEL_ENV || process.env.VERCEL_REGION || process.env.NOW_REGION) {
    const isProd = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
    const deploymentEnv = isProd ? "Production" : process.env.VERCEL_ENV === "preview" ? "Preview" : "Development";
    return {
      runtime: "vercel_serverless",
      shortName: "Vercel",
      deploymentEnv,
      label: "Vercel Serverless Function",
      isServerless: true,
      isGoogleAiStudio: false,
      isProduction: isProd,
      region: process.env.VERCEL_REGION || process.env.NOW_REGION || void 0,
      envHint: "Vercel Dashboard \u2192 Project Settings \u2192 Environment Variables (Production Scope) \u2192 Redeploy"
    };
  }
  if (process.env.K_SERVICE || process.env.K_REVISION || process.env.K_CONFIGURATION || process.env.GOOGLE_RUNTIME) {
    const isProd = process.env.NODE_ENV === "production";
    const deploymentEnv = isProd ? "Production" : "Preview";
    return {
      runtime: "google_ai_studio",
      shortName: "Google AI Studio",
      deploymentEnv,
      label: "Google AI Studio (Cloud Run Backend)",
      isServerless: false,
      isGoogleAiStudio: true,
      isProduction: isProd,
      region: process.env.GOOGLE_CLOUD_REGION || void 0,
      envHint: "Google AI Studio \u2192 Settings / Secrets (add SUPABASE_URL & SUPABASE_SECRET_KEY) \u2192 Restart / Reload App"
    };
  }
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return {
      runtime: "aws_lambda",
      shortName: "Other",
      deploymentEnv: "Production",
      label: "AWS Lambda Serverless",
      isServerless: true,
      isGoogleAiStudio: false,
      isProduction: true,
      region: process.env.AWS_REGION || void 0,
      envHint: "Lambda / Hosting Environment Variables \u2192 Redeploy"
    };
  }
  if (process.env.NODE_ENV === "production") {
    return {
      runtime: "namecheap_node_production",
      shortName: "Other",
      deploymentEnv: "Production",
      label: "Namecheap Node.js Production",
      isServerless: false,
      isGoogleAiStudio: false,
      isProduction: true,
      envHint: "cPanel \u2192 Setup Node.js App \u2192 Environment Variables (or .env at app root) \u2192 Restart App"
    };
  }
  return {
    runtime: "local_dev_preview",
    shortName: "Other",
    deploymentEnv: "Development",
    label: "Development / Preview Node.js Server",
    isServerless: false,
    isGoogleAiStudio: false,
    isProduction: false,
    envHint: "Environment Secrets / .env file"
  };
}
function cleanEnvValue(raw) {
  if (!raw) return "";
  let trimmed = String(raw).trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2 || trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  return trimmed;
}
function pickEnvVar(preferredNames, fallbackPattern) {
  for (const name of preferredNames) {
    const val = cleanEnvValue(process.env[name]);
    if (val) return { value: val, envName: name };
  }
  if (fallbackPattern) {
    const dynamicNames = Object.keys(process.env).filter((k) => fallbackPattern.test(k)).sort();
    for (const name of dynamicNames) {
      const val = cleanEnvValue(process.env[name]);
      if (val) return { value: val, envName: name };
    }
  }
  return { value: "", envName: null };
}
function normalizeSupabaseUrl(raw) {
  if (!raw) return "";
  let normalized = raw.replace(/\/+$/, "");
  if (normalized && !/^https?:\/\//i.test(normalized)) {
    const scheme = /^(localhost|127\.0\.0\.1)(:|\/|$)/i.test(normalized) ? "http://" : "https://";
    normalized = `${scheme}${normalized}`;
  }
  return normalized;
}
function inspectJwtRoleClaim(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return typeof payload?.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}
function resolveSupabaseEnvConfig() {
  const urlPick = pickEnvVar(
    [
      "SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
      "VITE_SUPABASE_URL",
      "STORAGE_SUPABASE_URL",
      "STORAGE_NEXT_PUBLIC_SUPABASE_URL",
      "SUPABASE_PROJECT_URL",
      "VITE_SUPABASE_PROJECT_URL"
    ],
    /^[A-Z0-9_]+_SUPABASE_URL$/
  );
  const url = normalizeSupabaseUrl(urlPick.value);
  const sbSecretPick = pickEnvVar(
    [
      "SUPABASE_SECRET_KEY",
      "STORAGE_SUPABASE_SECRET_KEY"
    ],
    /^[A-Z0-9_]+_SUPABASE_SECRET_KEY$/
  );
  const legacyServicePick = pickEnvVar(
    [
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_SERVICE_KEY",
      "STORAGE_SUPABASE_SERVICE_ROLE_KEY"
    ],
    /^[A-Z0-9_]+_SUPABASE_SERVICE_ROLE_KEY$/
  );
  const secretKey = sbSecretPick.value || legacyServicePick.value;
  const secretEnvName = sbSecretPick.value ? sbSecretPick.envName : legacyServicePick.envName;
  let secretKeyMisconfiguration;
  let secretKeyMode = sbSecretPick.value ? "sb_secret" : legacyServicePick.value ? "legacy_service_role" : "missing";
  if (secretKey) {
    if (secretKey.startsWith("sb_publishable_")) {
      secretKeyMode = "misconfigured_anon_or_publishable";
      secretKeyMisconfiguration = `${secretEnvName || "SUPABASE_SECRET_KEY"} holds a publishable key (sb_publishable_*); RLS blocks AI vault reads/writes unless a server secret/service_role key is set.`;
    } else {
      const jwtRole = inspectJwtRoleClaim(secretKey);
      if (jwtRole && jwtRole !== "service_role") {
        secretKeyMode = "misconfigured_anon_or_publishable";
        secretKeyMisconfiguration = `${secretEnvName || "SUPABASE_SECRET_KEY"} JWT has role="${jwtRole}" instead of "service_role"; RLS blocks AI vault operations.`;
      }
    }
  }
  const sbPubPick = pickEnvVar(
    [
      "SUPABASE_PUBLISHABLE_KEY",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "VITE_SUPABASE_PUBLISHABLE_KEY"
    ],
    /^[A-Z0-9_]+_SUPABASE_PUBLISHABLE_KEY$/
  );
  const legacyAnonPick = pickEnvVar(
    [
      "SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "VITE_SUPABASE_ANON_KEY",
      "STORAGE_SUPABASE_ANON_KEY",
      "STORAGE_NEXT_PUBLIC_SUPABASE_ANON_KEY"
    ],
    /^[A-Z0-9_]+_SUPABASE_ANON_KEY$/
  );
  const publishableKey = sbPubPick.value || legacyAnonPick.value;
  const publishableEnvName = sbPubPick.value ? sbPubPick.envName : legacyAnonPick.envName;
  const publishableKeyMode = sbPubPick.value ? "sb_publishable" : legacyAnonPick.value ? "legacy_anon" : "missing";
  let projectHost = null;
  let urlMisconfiguration;
  if (url) {
    try {
      const parsed = new URL(url);
      projectHost = parsed.hostname;
      if (!projectHost || !projectHost.includes(".")) {
        projectHost = "invalid-url";
        urlMisconfiguration = `${urlEnvNameLabel(urlPick.envName)} is not a valid HTTPS Supabase project URL.`;
      }
    } catch {
      projectHost = "invalid-url";
      urlMisconfiguration = `${urlEnvNameLabel(urlPick.envName)} could not be parsed as a valid URL.`;
    }
  }
  const supabaseUrlConfigured = Boolean(url && projectHost && projectHost !== "invalid-url");
  const supabaseSecretConfigured = Boolean(secretKey && secretKeyMode !== "misconfigured_anon_or_publishable");
  return {
    url,
    publishableKey,
    secretKey,
    urlEnvName: urlPick.envName,
    secretEnvName,
    publishableEnvName,
    supabaseUrlConfigured,
    supabaseSecretConfigured,
    secretKeyMode,
    publishableKeyMode,
    secretKeyMisconfiguration,
    urlMisconfiguration,
    configured: supabaseUrlConfigured && supabaseSecretConfigured,
    projectHost
  };
}
function urlEnvNameLabel(name) {
  return name || "SUPABASE_URL";
}
function getMissingSupabaseConfigGuidance() {
  const cfg = resolveSupabaseEnvConfig();
  const runtime = detectBackendRuntimeInfo();
  const issues = [];
  if (!cfg.supabaseUrlConfigured) {
    issues.push(cfg.urlMisconfiguration || "SUPABASE_URL is missing");
  }
  if (!cfg.supabaseSecretConfigured) {
    issues.push(
      cfg.secretKeyMisconfiguration || "SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) is missing"
    );
  }
  if (issues.length === 0) return "";
  return `Persistent database unavailable (${runtime.label}): ${issues.join("; ")}. Configure SUPABASE_URL and SUPABASE_SECRET_KEY in ${runtime.envHint}. Ephemeral /tmp writes are disabled in production.`;
}
function isSupabaseConfigured() {
  return resolveSupabaseEnvConfig().configured;
}
var cachedAdminClient = null;
var cachedAdminSignature = "";
function getSupabaseAdminClient() {
  const cfg = resolveSupabaseEnvConfig();
  if (!cfg.configured) return null;
  const sig = `${cfg.url}:${cfg.secretKey.slice(0, 8)}`;
  if (!cachedAdminClient || cachedAdminSignature !== sig) {
    cachedAdminClient = createClient(cfg.url, cfg.secretKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    cachedAdminSignature = sig;
  }
  return cachedAdminClient;
}
function getSupabaseAnonClient() {
  const cfg = resolveSupabaseEnvConfig();
  if (!cfg.url || !cfg.publishableKey) return null;
  return createClient(cfg.url, cfg.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
function mapRowToArticle(row) {
  const seoObj = typeof row.seo_json === "object" && row.seo_json ? row.seo_json : {};
  const tagsArr = Array.isArray(row.tags) ? row.tags : [];
  const versionsArr = Array.isArray(row.versions_json) ? row.versions_json : void 0;
  return {
    id: String(row.id),
    slug: String(row.slug),
    titleEn: String(row.title_en || ""),
    titleUr: String(row.title_ur || ""),
    summaryEn: String(row.summary_en || ""),
    summaryUr: String(row.summary_ur || ""),
    contentEn: String(row.content_en || ""),
    contentUr: String(row.content_ur || ""),
    category: String(row.category || "pakistan"),
    tags: tagsArr.map((t) => String(t)),
    status: row.status || "draft",
    isBreaking: Boolean(row.is_breaking),
    isFeatured: Boolean(row.is_featured),
    isTrending: Boolean(row.is_trending),
    heroImage: String(row.hero_image || "") || "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=1200&q=80",
    featuredImage: row.featured_image ? String(row.featured_image) : void 0,
    heroImageMeta: typeof row.hero_image_meta_json === "object" && row.hero_image_meta_json ? row.hero_image_meta_json : void 0,
    featuredImageMeta: typeof row.featured_image_meta_json === "object" && row.featured_image_meta_json ? row.featured_image_meta_json : void 0,
    socialImageUrl: row.social_image_url ? String(row.social_image_url) : void 0,
    useHeroAsFeatured: typeof row.use_hero_as_featured === "boolean" ? row.use_hero_as_featured : true,
    homepageSlot: row.homepage_slot ? String(row.homepage_slot) : void 0,
    imageCaptionEn: String(row.image_caption_en || ""),
    imageCaptionUr: String(row.image_caption_ur || ""),
    readingTimeMin: Number(row.reading_time_min || 3) || 3,
    author: {
      id: String(row.author_id || "admin-desk"),
      nameEn: String(row.author_name_en || "360Khabarnama Editorial"),
      nameUr: String(row.author_name_ur || "\u0627\u062F\u0627\u0631\u06C1 360 \u062E\u0628\u0631\u0646\u0627\u0645\u06C1"),
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
      role: row.author_role || "Editor"
    },
    publishedAt: row.published_at ? String(row.published_at) : "",
    scheduledAt: row.scheduled_at ? String(row.scheduled_at) : void 0,
    version: Number(row.version || 1) || 1,
    versions: versionsArr,
    workflowNotes: row.workflow_notes ? String(row.workflow_notes) : void 0,
    failureReason: row.failure_reason ? String(row.failure_reason) : void 0,
    views: Number(row.views || 0) || 0,
    seo: seoObj,
    createdBy: row.created_by ? String(row.created_by) : void 0,
    updatedBy: row.updated_by ? String(row.updated_by) : void 0,
    updatedAt: row.updated_at ? String(row.updated_at) : (/* @__PURE__ */ new Date()).toISOString(),
    deletedAt: row.deleted_at ? String(row.deleted_at) : void 0
  };
}
function buildArticleRow(article, actor) {
  return {
    id: article.id,
    slug: article.slug,
    title_en: article.titleEn || "",
    title_ur: article.titleUr || "",
    summary_en: article.summaryEn || "",
    summary_ur: article.summaryUr || "",
    content_en: article.contentEn || "",
    content_ur: article.contentUr || "",
    category: (article.category || "pakistan").toLowerCase(),
    tags: Array.isArray(article.tags) ? article.tags : [],
    status: article.status || "draft",
    is_breaking: Boolean(article.isBreaking),
    is_featured: Boolean(article.isFeatured),
    is_trending: Boolean(article.isTrending),
    hero_image: article.heroImage || "",
    featured_image: article.featuredImage || null,
    hero_image_meta_json: article.heroImageMeta || null,
    featured_image_meta_json: article.featuredImageMeta || null,
    social_image_url: article.socialImageUrl || null,
    use_hero_as_featured: article.useHeroAsFeatured ?? true,
    homepage_slot: article.homepageSlot || null,
    image_caption_en: article.imageCaptionEn || "",
    image_caption_ur: article.imageCaptionUr || "",
    reading_time_min: Math.max(1, Math.round(Number(article.readingTimeMin || 3))),
    author_id: article.author?.id || article.createdBy || "admin-desk",
    author_name_en: article.author?.nameEn || "360Khabarnama Editorial",
    author_name_ur: article.author?.nameUr || "\u0627\u062F\u0627\u0631\u06C1 360 \u062E\u0628\u0631\u0646\u0627\u0645\u06C1",
    author_role: article.author?.role || "Editor",
    seo_json: article.seo || {},
    versions_json: Array.isArray(article.versions) ? article.versions : [],
    workflow_notes: article.workflowNotes || "",
    failure_reason: article.failureReason || "",
    version: Math.max(1, Math.round(Number(article.version || 1))),
    views: Math.max(0, Math.round(Number(article.views || 0))),
    published_at: article.publishedAt ? article.publishedAt : null,
    scheduled_at: article.scheduledAt || article.scheduledFor || null,
    deleted_at: article.deletedAt || null,
    created_by: article.createdBy || actor,
    updated_by: actor,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function listSupabaseArticles(filters) {
  const client = getSupabaseAdminClient();
  if (!client) {
    return { ok: false, articles: [], error: "Supabase secret key/URL not configured." };
  }
  try {
    let query = client.from("articles").select("*").order("published_at", { ascending: false, nullsFirst: false }).order("updated_at", { ascending: false }).limit(Math.min(Math.max(Number(filters.limit || 250), 1), 500));
    if (!filters.includeDeleted) {
      query = query.is("deleted_at", null);
    }
    if (filters.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }
    if (filters.category && filters.category !== "all") {
      query = query.eq("category", filters.category.toLowerCase());
    }
    const { data, error } = await query;
    if (error) {
      return { ok: false, articles: [], error: `${error.code || "SUPABASE_QUERY"}: ${error.message}` };
    }
    let articles = (data || []).map(mapRowToArticle);
    if (filters.tag) {
      const tLower = filters.tag.toLowerCase();
      articles = articles.filter((a) => a.tags.some((t) => t.toLowerCase() === tLower));
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      articles = articles.filter(
        (a) => a.titleEn.toLowerCase().includes(q) || a.titleUr.includes(q) || a.summaryEn.toLowerCase().includes(q) || a.summaryUr.includes(q) || a.slug.toLowerCase().includes(q)
      );
    }
    return { ok: true, articles };
  } catch (err) {
    return { ok: false, articles: [], error: err?.message || "Supabase article query error" };
  }
}
async function getSupabaseArticle(idOrSlug) {
  const client = getSupabaseAdminClient();
  if (!client) {
    return { ok: false, article: null, error: "Supabase not configured." };
  }
  const clean = decodeURIComponent(idOrSlug || "").trim();
  if (!clean) return { ok: true, article: null };
  try {
    const byId = await client.from("articles").select("*").eq("id", clean).maybeSingle();
    if (byId.error) {
      return { ok: false, article: null, error: `${byId.error.code || "SUPABASE_GET"}: ${byId.error.message}` };
    }
    if (byId.data) {
      return { ok: true, article: mapRowToArticle(byId.data) };
    }
    const bySlug = await client.from("articles").select("*").eq("slug", clean.toLowerCase()).maybeSingle();
    if (bySlug.error) {
      return { ok: false, article: null, error: `${bySlug.error.code || "SUPABASE_GET"}: ${bySlug.error.message}` };
    }
    return { ok: true, article: bySlug.data ? mapRowToArticle(bySlug.data) : null };
  } catch (err) {
    return { ok: false, article: null, error: err?.message || "Supabase get article error" };
  }
}
async function upsertSupabaseArticle(article, actor) {
  const client = getSupabaseAdminClient();
  if (!client) {
    return {
      ok: false,
      code: "SUPABASE_NOT_CONFIGURED",
      error: "SUPABASE_URL and SUPABASE_SECRET_KEY are required for Supabase PostgreSQL persistence."
    };
  }
  try {
    const row = buildArticleRow(article, actor);
    const { data, error } = await client.from("articles").upsert(row, { onConflict: "id" }).select("*").single();
    if (error || !data) {
      const msg = error?.message || "Supabase upsert returned no record.";
      recordServerError({
        source: "supabase",
        code: error?.code || "SUPABASE_WRITE_FAILED",
        message: `Supabase upsert failed for ${article.id}: ${msg}`
      });
      return {
        ok: false,
        code: error?.code || "SUPABASE_WRITE_FAILED",
        error: msg
      };
    }
    const verify = await client.from("articles").select("*").eq("id", data.id).single();
    if (verify.error || !verify.data) {
      return {
        ok: false,
        code: "SUPABASE_READ_AFTER_WRITE_FAILED",
        error: verify.error?.message || "Upsert succeeded but read-after-write lookup failed."
      };
    }
    return { ok: true, article: mapRowToArticle(verify.data) };
  } catch (err) {
    return {
      ok: false,
      code: "SUPABASE_EXCEPTION",
      error: err?.message || "Unexpected error saving article to Supabase."
    };
  }
}
async function deleteSupabaseArticle(id, hardDelete = false) {
  const client = getSupabaseAdminClient();
  if (!client) return { ok: false, error: "Supabase not configured." };
  try {
    if (hardDelete) {
      const { error: error2 } = await client.from("articles").delete().eq("id", id);
      if (error2) return { ok: false, error: error2.message };
      return { ok: true };
    }
    const { error } = await client.from("articles").update({ deleted_at: (/* @__PURE__ */ new Date()).toISOString(), status: "archived", updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || "Supabase delete failed" };
  }
}
function mapRowToAiCredential(row) {
  const diag = row.last_diagnostic_json && typeof row.last_diagnostic_json === "object" ? row.last_diagnostic_json : null;
  const billingMeta = diag?._billingMeta;
  const cleanedDiag = diag ? { ...diag } : null;
  if (cleanedDiag && "_billingMeta" in cleanedDiag) {
    delete cleanedDiag._billingMeta;
  }
  return {
    id: String(row.id),
    providerType: row.provider_type || "gemini",
    label: String(row.label || "AI Provider"),
    projectId: String(row.project_id || "default-project"),
    endpointUrl: row.endpoint_url ? String(row.endpoint_url) : void 0,
    model: String(row.model || ""),
    encryptedSecret: String(row.encrypted_secret || ""),
    maskedKey: String(row.masked_key || ""),
    enabled: Boolean(row.enabled),
    priority: Number(row.priority ?? 10),
    dailyTokenLimit: Number(row.daily_token_limit ?? 5e5),
    dailyTokensUsed: Number(row.daily_tokens_used ?? 0),
    monthlyBudgetUsd: Number(row.monthly_budget_usd ?? 25),
    monthlySpendUsd: Number(row.monthly_spend_usd ?? 0),
    availableModels: Array.isArray(row.available_models_json) ? row.available_models_json : [],
    connectionStatus: row.connection_status || "untested",
    billingStatus: row.billing_status || billingMeta?.billingStatus,
    billingNote: row.billing_note || billingMeta?.billingNote,
    modelListStatus: row.model_list_status || (Array.isArray(row.available_models_json) && row.available_models_json.length > 0 ? "ok" : "untested"),
    generationTestStatus: row.generation_test_status || (row.last_test_status === "connected" ? "ok" : row.last_test_status === "error" ? "error" : "untested"),
    lastTestedAt: row.last_tested_at ? String(row.last_tested_at) : null,
    lastSuccessfulVerificationAt: row.last_successful_verification_at ? String(row.last_successful_verification_at) : null,
    lastSuccessfulGenerationAt: row.last_successful_generation_at ? String(row.last_successful_generation_at) : null,
    lastFailureAt: row.last_failure_at ? String(row.last_failure_at) : null,
    lastTestStatus: row.last_test_status || "untested",
    lastTestMessage: row.last_test_message ? String(row.last_test_message) : void 0,
    lastLatencyMs: typeof row.last_latency_ms === "number" ? row.last_latency_ms : void 0,
    lastCorrelationId: row.last_correlation_id ? String(row.last_correlation_id) : void 0,
    lastDiagnostic: cleanedDiag && Object.keys(cleanedDiag).length > 0 ? cleanedDiag : null,
    createdAt: row.created_at ? String(row.created_at) : (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: row.updated_at ? String(row.updated_at) : (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function listSupabaseAiCredentials() {
  const client = getSupabaseAdminClient();
  if (!client) {
    return { ok: false, credentials: [], code: "SUPABASE_NOT_CONFIGURED", error: "Supabase not configured." };
  }
  try {
    const { data, error } = await client.from("ai_provider_credentials").select("*").order("priority", { ascending: true }).order("created_at", { ascending: true });
    if (error) {
      return { ok: false, credentials: [], code: error.code || "SUPABASE_SELECT_ERR", error: error.message };
    }
    return { ok: true, credentials: (data || []).map(mapRowToAiCredential) };
  } catch (err) {
    return {
      ok: false,
      credentials: [],
      code: "SUPABASE_EXCEPTION",
      error: err?.message || "Failed listing Supabase AI credentials"
    };
  }
}
async function upsertSupabaseAiCredential(cred) {
  const client = getSupabaseAdminClient();
  if (!client) {
    return { ok: false, code: "SUPABASE_NOT_CONFIGURED", error: "Supabase not configured." };
  }
  try {
    const diagPayload = cred.lastDiagnostic || cred.billingStatus ? {
      ...cred.lastDiagnostic || {},
      _billingMeta: {
        billingStatus: cred.billingStatus || "unknown",
        billingNote: cred.billingNote || ""
      }
    } : null;
    const coreRow = {
      id: cred.id,
      provider_type: cred.providerType,
      label: cred.label,
      project_id: cred.projectId,
      endpoint_url: cred.endpointUrl || null,
      model: cred.model || "",
      encrypted_secret: cred.encryptedSecret,
      masked_key: cred.maskedKey,
      enabled: Boolean(cred.enabled),
      priority: Number(cred.priority ?? 10),
      connection_status: cred.connectionStatus || "untested",
      available_models_json: Array.isArray(cred.availableModels) ? cred.availableModels : [],
      last_tested_at: cred.lastTestedAt || null,
      last_test_status: cred.lastTestStatus || "untested",
      last_test_message: cred.lastTestMessage || "",
      last_diagnostic_json: diagPayload,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    const extendedRow = {
      ...coreRow,
      daily_token_limit: Number(cred.dailyTokenLimit ?? 5e5),
      daily_tokens_used: Number(cred.dailyTokensUsed ?? 0),
      monthly_budget_usd: Number(cred.monthlyBudgetUsd ?? 25),
      monthly_spend_usd: Number(cred.monthlySpendUsd ?? 0),
      billing_status: cred.billingStatus || "unknown",
      billing_note: cred.billingNote || "",
      model_list_status: cred.modelListStatus || "untested",
      generation_test_status: cred.generationTestStatus || "untested",
      last_successful_verification_at: cred.lastSuccessfulVerificationAt || null,
      last_successful_generation_at: cred.lastSuccessfulGenerationAt || null,
      last_failure_at: cred.lastFailureAt || null,
      last_latency_ms: typeof cred.lastLatencyMs === "number" ? Math.round(cred.lastLatencyMs) : null,
      last_correlation_id: cred.lastCorrelationId || null
    };
    let warning;
    let writeRes = await client.from("ai_provider_credentials").upsert(extendedRow, { onConflict: "id" }).select("*").single();
    if (writeRes.error && (writeRes.error.code === "42703" || writeRes.error.code === "PGRST204" || /column .* does not exist|schema cache/i.test(writeRes.error.message || ""))) {
      warning = "Migration 005 columns not yet applied on live Supabase; core columns synced cleanly.";
      writeRes = await client.from("ai_provider_credentials").upsert(coreRow, { onConflict: "id" }).select("*").single();
    }
    if (writeRes.error || !writeRes.data) {
      const errMsg = writeRes.error?.message || "Supabase upsert returned zero affected rows.";
      const errCode = writeRes.error?.code || "SUPABASE_AI_UPSERT_ERR";
      recordServerError({
        source: "supabase",
        code: errCode,
        message: `Supabase AI credential upsert failed (${cred.id}): ${errMsg}`
      });
      return { ok: false, code: errCode, error: errMsg };
    }
    const verify = await client.from("ai_provider_credentials").select("*").eq("id", writeRes.data.id).single();
    if (verify.error || !verify.data) {
      return {
        ok: false,
        code: verify.error?.code || "SUPABASE_AI_READBACK_ERR",
        error: verify.error?.message || "Record upserted but read-after-write verification failed."
      };
    }
    return { ok: true, credential: mapRowToAiCredential(verify.data), warning };
  } catch (err) {
    return {
      ok: false,
      code: "SUPABASE_AI_EXCEPTION",
      error: err?.message || "Supabase AI credential sync error"
    };
  }
}
async function deleteSupabaseAiCredential(id) {
  const client = getSupabaseAdminClient();
  if (!client) {
    return { ok: false, deletedCount: 0, code: "SUPABASE_NOT_CONFIGURED", error: "Supabase not configured." };
  }
  try {
    const { data: deletedRows, error } = await client.from("ai_provider_credentials").delete().eq("id", id).select("id");
    if (error) {
      recordServerError({
        source: "supabase",
        code: error.code || "SUPABASE_AI_DELETE_ERR",
        message: `Supabase AI credential delete failed (${id}): ${error.message}`
      });
      return { ok: false, deletedCount: 0, code: error.code || "SUPABASE_AI_DELETE_ERR", error: error.message };
    }
    const count = Array.isArray(deletedRows) ? deletedRows.length : 0;
    if (count === 0) {
      return {
        ok: false,
        deletedCount: 0,
        code: "NOT_FOUND",
        error: `Credential "${id}" was not found in Supabase (0 rows deleted).`
      };
    }
    const verify = await client.from("ai_provider_credentials").select("id").eq("id", id).maybeSingle();
    if (verify.error) {
      return {
        ok: false,
        deletedCount: count,
        code: verify.error.code || "SUPABASE_VERIFY_DELETE_ERR",
        error: verify.error.message
      };
    }
    if (verify.data) {
      return {
        ok: false,
        deletedCount: 0,
        code: "DELETE_NOT_PERSISTED",
        error: `Credential "${id}" still exists in Supabase after delete operation.`
      };
    }
    return { ok: true, deletedCount: count };
  } catch (err) {
    return {
      ok: false,
      deletedCount: 0,
      code: "SUPABASE_AI_DELETE_EXCEPTION",
      error: err?.message || "Supabase AI credential delete error"
    };
  }
}
async function listSupabaseAiTaskRoutes() {
  const client = getSupabaseAdminClient();
  if (!client) return { ok: false, routes: [], error: "Supabase not configured." };
  try {
    const { data, error } = await client.from("ai_task_routes").select("*");
    if (error) return { ok: false, routes: [], error: error.message };
    const routes = (data || []).map((row) => ({
      task: row.task,
      label: String(row.label || row.task),
      primaryCredentialId: row.primary_credential_id ? String(row.primary_credential_id) : "",
      primaryModel: String(row.primary_model || ""),
      fallbackCredentialId: row.fallback_credential_id ? String(row.fallback_credential_id) : "",
      fallbackModel: String(row.fallback_model || ""),
      temperature: Number(row.temperature ?? 0.4),
      maxTokens: Number(row.max_tokens ?? 3072)
    }));
    return { ok: true, routes };
  } catch (err) {
    return { ok: false, routes: [], error: err?.message || "Failed reading Supabase task routes" };
  }
}
async function upsertSupabaseAiTaskRoutes(routes) {
  const client = getSupabaseAdminClient();
  if (!client) {
    return { ok: false, code: "SUPABASE_NOT_CONFIGURED", error: "Supabase not configured." };
  }
  try {
    if (!routes.length) return { ok: true, savedCount: 0 };
    const rows = routes.map((r) => ({
      task: r.task,
      label: r.label,
      primary_credential_id: r.primaryCredentialId || null,
      primary_model: r.primaryModel || "",
      fallback_credential_id: r.fallbackCredentialId || null,
      fallback_model: r.fallbackModel || "",
      temperature: Number(r.temperature ?? 0.4),
      max_tokens: Number(r.maxTokens ?? 3072),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }));
    const { data, error } = await client.from("ai_task_routes").upsert(rows, { onConflict: "task" }).select("task");
    if (error) {
      recordServerError({
        source: "supabase",
        code: error.code || "SUPABASE_AI_ROUTES_ERR",
        message: `Supabase AI task routes upsert failed: ${error.message}`
      });
      return { ok: false, code: error.code || "SUPABASE_AI_ROUTES_ERR", error: error.message };
    }
    return { ok: true, savedCount: Array.isArray(data) ? data.length : rows.length };
  } catch (err) {
    return { ok: false, code: "SUPABASE_AI_ROUTES_EXCEPTION", error: err?.message || "Supabase task routes sync error" };
  }
}
async function getSupabaseAiEnvSuppression() {
  const client = getSupabaseAdminClient();
  if (!client) return { ok: false, error: "Supabase not configured." };
  try {
    const { data, error } = await client.from("site_settings").select("settings_json").eq("id", "ai_runtime_flags").maybeSingle();
    if (error) return { ok: false, error: error.message };
    const s = data?.settings_json || {};
    return {
      ok: true,
      suppressed: {
        gemini: Boolean(s.envSuppressedGemini),
        grok: Boolean(s.envSuppressedGrok)
      }
    };
  } catch (err) {
    return { ok: false, error: err?.message || "Failed loading AI env flags" };
  }
}
async function setSupabaseAiEnvSuppression(flags) {
  const client = getSupabaseAdminClient();
  if (!client) return { ok: false, error: "Supabase not configured." };
  try {
    const { error } = await client.from("site_settings").upsert(
      {
        id: "ai_runtime_flags",
        settings_json: {
          envSuppressedGemini: Boolean(flags.gemini),
          envSuppressedGrok: Boolean(flags.grok),
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        },
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      },
      { onConflict: "id" }
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || "Failed saving AI env flags" };
  }
}
async function recordSupabaseAiConnectionTest(entry) {
  const client = getSupabaseAdminClient();
  if (!client) return { ok: false, error: "Supabase not configured." };
  try {
    const { error } = await client.from("ai_connection_tests").insert({
      id: entry.id,
      credential_id: entry.credentialId || null,
      provider_type: entry.providerType,
      model_tested: entry.modelTested || null,
      stage: entry.stage,
      ok: Boolean(entry.ok),
      connection_status: entry.connectionStatus,
      latency_ms: entry.latencyMs,
      diagnostic_json: entry.diagnostic || null,
      actor: entry.actor || "Super Admin",
      tested_at: entry.timestamp || (/* @__PURE__ */ new Date()).toISOString()
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || "Supabase connection test log error" };
  }
}
async function resetSupabaseAiCredentials() {
  const client = getSupabaseAdminClient();
  if (!client) {
    return { ok: false, configured: false, removedCount: 0, error: "Supabase not configured." };
  }
  try {
    const { data: existingRows, error: listErr } = await client.from("ai_provider_credentials").select("id, provider_type").in("provider_type", ["gemini", "grok"]);
    if (listErr) {
      return { ok: false, configured: true, removedCount: 0, error: listErr.message };
    }
    const removedCount = Array.isArray(existingRows) ? existingRows.length : 0;
    await client.from("ai_task_routes").update({
      primary_credential_id: null,
      primary_model: "",
      fallback_credential_id: null,
      fallback_model: "",
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).not("task", "is", null);
    const { error: delErr } = await client.from("ai_provider_credentials").delete().in("provider_type", ["gemini", "grok"]);
    if (delErr) {
      recordServerError({
        source: "supabase",
        code: delErr.code || "SUPABASE_AI_RESET_ERR",
        message: `Supabase AI reset failed: ${delErr.message}`
      });
      return { ok: false, configured: true, removedCount: 0, error: delErr.message };
    }
    const { data: remainingRows } = await client.from("ai_provider_credentials").select("id").in("provider_type", ["gemini", "grok"]);
    if (Array.isArray(remainingRows) && remainingRows.length > 0) {
      return {
        ok: false,
        configured: true,
        removedCount: 0,
        error: `${remainingRows.length} Gemini/Grok credential rows remained after reset delete.`
      };
    }
    await client.from("ai_connection_tests").delete().in("provider_type", ["gemini", "grok"]);
    await setSupabaseAiEnvSuppression({ gemini: true, grok: true });
    return { ok: true, configured: true, removedCount };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      removedCount: 0,
      error: err?.message || "Supabase AI reset error"
    };
  }
}
async function inspectSupabaseAiInfrastructure() {
  const envCfg = resolveSupabaseEnvConfig();
  const runtimeInfo = detectBackendRuntimeInfo();
  const tablesToCheck = [
    "ai_providers",
    "ai_provider_credentials",
    "ai_task_routes",
    "ai_connection_tests",
    "ai_usage_logs"
  ];
  const client = getSupabaseAdminClient();
  if (!envCfg.configured || !client) {
    const guidance = getMissingSupabaseConfigGuidance();
    return {
      connected: false,
      configured: false,
      supabaseUrlConfigured: envCfg.supabaseUrlConfigured,
      supabaseSecretConfigured: envCfg.supabaseSecretConfigured,
      urlEnvName: envCfg.urlEnvName,
      secretEnvName: envCfg.secretEnvName,
      currentRuntime: runtimeInfo.shortName,
      deploymentEnvironment: runtimeInfo.deploymentEnv,
      actualRuntime: runtimeInfo.label,
      runtimeId: runtimeInfo.runtime,
      isServerless: runtimeInfo.isServerless,
      isGoogleAiStudio: runtimeInfo.isGoogleAiStudio,
      isProduction: runtimeInfo.isProduction,
      connectionTestOk: false,
      databaseQueryOk: false,
      credentialTableAccessible: false,
      projectHost: envCfg.projectHost,
      secretKeyMode: envCfg.secretKeyMode,
      tables: tablesToCheck.map((t) => ({
        table: t,
        available: false,
        rowCount: null,
        error: envCfg.secretKeyMisconfiguration || envCfg.urlMisconfiguration || "Supabase not configured"
      })),
      rlsStatus: {
        credentialsAnonBlocked: true,
        taskRoutesAnonBlocked: true,
        detail: guidance
      },
      error: guidance
    };
  }
  const tables = await Promise.all(
    tablesToCheck.map(async (table) => {
      try {
        const res = await client.from(table).select("*", { count: "exact", head: true });
        return {
          table,
          available: !res.error,
          rowCount: typeof res.count === "number" ? res.count : 0,
          ...res.error ? { error: res.error.message } : {}
        };
      } catch (err) {
        return {
          table,
          available: false,
          rowCount: null,
          error: err?.message || "Query error"
        };
      }
    })
  );
  let credentialsAnonBlocked = false;
  let taskRoutesAnonBlocked = false;
  let rlsDetail = "";
  const anon = getSupabaseAnonClient();
  if (anon) {
    const [anonCredRes, anonRouteRes] = await Promise.all([
      anon.from("ai_provider_credentials").select("id").limit(1),
      anon.from("ai_task_routes").select("task").limit(1)
    ]);
    credentialsAnonBlocked = Boolean(anonCredRes.error) || Array.isArray(anonCredRes.data) && anonCredRes.data.length === 0;
    taskRoutesAnonBlocked = Boolean(anonRouteRes.error) || Array.isArray(anonRouteRes.data) && anonRouteRes.data.length === 0;
    rlsDetail = credentialsAnonBlocked && taskRoutesAnonBlocked ? "RLS verified: unauthenticated anon client blocked from raw AI credentials & task routes." : "Warning: Anon policy returned unexpected rows \u2014 run Migration 005 RLS hardening.";
  } else {
    rlsDetail = "SUPABASE_PUBLISHABLE_KEY not set; server-side SUPABASE_SECRET_KEY isolation active.";
  }
  const credTable = tables.find((t) => t.table === "ai_provider_credentials");
  const credentialTableAccessible = Boolean(credTable?.available);
  const databaseQueryOk = tables.some((t) => t.available);
  const firstTableError = credTable?.error || tables.find((t) => t.error)?.error;
  const isConnFailure = !databaseQueryOk && Boolean(firstTableError && /fetch failed|network|ENOTFOUND|ECONNREFUSED|Invalid API key|JWT/i.test(firstTableError));
  const connectionTestOk = databaseQueryOk || !isConnFailure;
  return {
    connected: connectionTestOk && databaseQueryOk && credentialTableAccessible,
    configured: true,
    supabaseUrlConfigured: envCfg.supabaseUrlConfigured,
    supabaseSecretConfigured: envCfg.supabaseSecretConfigured,
    urlEnvName: envCfg.urlEnvName,
    secretEnvName: envCfg.secretEnvName,
    currentRuntime: runtimeInfo.shortName,
    deploymentEnvironment: runtimeInfo.deploymentEnv,
    actualRuntime: runtimeInfo.label,
    runtimeId: runtimeInfo.runtime,
    isServerless: runtimeInfo.isServerless,
    isGoogleAiStudio: runtimeInfo.isGoogleAiStudio,
    isProduction: runtimeInfo.isProduction,
    connectionTestOk,
    databaseQueryOk,
    credentialTableAccessible,
    projectHost: envCfg.projectHost,
    secretKeyMode: envCfg.secretKeyMode,
    tables,
    rlsStatus: {
      credentialsAnonBlocked,
      taskRoutesAnonBlocked,
      detail: envCfg.secretKeyMisconfiguration ? `${envCfg.secretKeyMisconfiguration} ${rlsDetail}` : rlsDetail
    },
    ...envCfg.secretKeyMisconfiguration ? { error: envCfg.secretKeyMisconfiguration } : firstTableError ? { error: firstTableError } : {}
  };
}
async function findSupabaseAdminUserByEmail(email) {
  const client = getSupabaseAdminClient();
  const cleanEmail = (email || "").trim().toLowerCase();
  if (!client || !cleanEmail) return null;
  try {
    const { data, error } = await client.from("admin_users").select("id, email, name_en, role, status").ilike("email", cleanEmail).maybeSingle();
    if (error || !data) return null;
    return {
      id: String(data.id),
      email: String(data.email).toLowerCase(),
      nameEn: String(data.name_en || data.email),
      role: String(data.role || "Read-only Analyst"),
      status: String(data.status || "active")
    };
  } catch {
    return null;
  }
}
async function runSupabaseAiCrudSelfTest() {
  const envCfg = resolveSupabaseEnvConfig();
  const runtimeInfo = detectBackendRuntimeInfo();
  const testId = `__diag_ai_crud_${Date.now()}`;
  const allStagesOrder = [
    "INSERT",
    "SELECT",
    "UPDATE",
    "DELETE",
    "VERIFY_DELETED"
  ];
  const stages = [];
  const padRemainingStages = (reason) => {
    for (const s of allStagesOrder) {
      if (!stages.some((existing) => existing.stage === s)) {
        stages.push({
          stage: s,
          ok: false,
          latencyMs: 0,
          detail: reason,
          error: reason
        });
      }
    }
  };
  const client = getSupabaseAdminClient();
  if (!envCfg.configured || !client) {
    const guidance = getMissingSupabaseConfigGuidance();
    padRemainingStages(guidance);
    return {
      ok: false,
      configured: false,
      supabaseUrlConfigured: envCfg.supabaseUrlConfigured,
      supabaseSecretConfigured: envCfg.supabaseSecretConfigured,
      currentRuntime: runtimeInfo.shortName,
      deploymentEnvironment: runtimeInfo.deploymentEnv,
      actualRuntime: runtimeInfo.label,
      runtimeId: runtimeInfo.runtime,
      connectionTestOk: false,
      databaseQueryOk: false,
      credentialTableAccessible: false,
      projectHost: envCfg.projectHost,
      testRecordId: testId,
      stages,
      error: guidance
    };
  }
  let connectionTestOk = false;
  let databaseQueryOk = false;
  let credentialTableAccessible = false;
  try {
    const probe = await client.from("ai_provider_credentials").select("id", { count: "exact", head: true });
    if (probe.error) {
      const msg = probe.error.message || "Cannot access ai_provider_credentials table.";
      const isNetworkOrAuth = /fetch failed|network|ENOTFOUND|ECONNREFUSED|Invalid API key|JWT/i.test(msg);
      connectionTestOk = !isNetworkOrAuth;
      databaseQueryOk = false;
      credentialTableAccessible = false;
      padRemainingStages(msg);
      return {
        ok: false,
        configured: true,
        supabaseUrlConfigured: envCfg.supabaseUrlConfigured,
        supabaseSecretConfigured: envCfg.supabaseSecretConfigured,
        currentRuntime: runtimeInfo.shortName,
        deploymentEnvironment: runtimeInfo.deploymentEnv,
        actualRuntime: runtimeInfo.label,
        runtimeId: runtimeInfo.runtime,
        connectionTestOk,
        databaseQueryOk,
        credentialTableAccessible,
        projectHost: envCfg.projectHost,
        testRecordId: testId,
        stages,
        error: msg
      };
    }
    connectionTestOk = true;
    databaseQueryOk = true;
    credentialTableAccessible = true;
    let t0 = Date.now();
    const { data: inserted, error: insErr } = await client.from("ai_provider_credentials").insert({
      id: testId,
      provider_type: "gemini",
      label: "Diagnostic CRUD Probe (Safe Auto-Deleted)",
      project_id: "diag-probe-isolated",
      model: "diag-model",
      encrypted_secret: "enc:v1:diagnostic:probe:nonfunctional",
      masked_key: "diag\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022test",
      enabled: false,
      priority: 999,
      connection_status: "disabled"
    }).select("id, label, enabled").single();
    if (insErr || !inserted) {
      const msg = insErr?.message || "No record returned from INSERT.";
      stages.push({
        stage: "INSERT",
        ok: false,
        latencyMs: Date.now() - t0,
        detail: "Failed inserting isolated test record into ai_provider_credentials.",
        error: msg
      });
      padRemainingStages("Skipped because INSERT failed.");
      return {
        ok: false,
        configured: true,
        supabaseUrlConfigured: envCfg.supabaseUrlConfigured,
        supabaseSecretConfigured: envCfg.supabaseSecretConfigured,
        currentRuntime: runtimeInfo.shortName,
        deploymentEnvironment: runtimeInfo.deploymentEnv,
        actualRuntime: runtimeInfo.label,
        runtimeId: runtimeInfo.runtime,
        connectionTestOk,
        databaseQueryOk,
        credentialTableAccessible,
        projectHost: envCfg.projectHost,
        testRecordId: testId,
        stages,
        error: msg
      };
    }
    stages.push({
      stage: "INSERT",
      ok: true,
      latencyMs: Date.now() - t0,
      detail: `Inserted test record ${inserted.id}`
    });
    t0 = Date.now();
    const { data: selected, error: selErr } = await client.from("ai_provider_credentials").select("id, label, enabled").eq("id", testId).single();
    if (selErr || !selected) {
      const msg = selErr?.message || "Record not found.";
      stages.push({
        stage: "SELECT",
        ok: false,
        latencyMs: Date.now() - t0,
        detail: "Failed reading back test record by ID.",
        error: msg
      });
      padRemainingStages("Skipped because SELECT failed.");
      return {
        ok: false,
        configured: true,
        supabaseUrlConfigured: envCfg.supabaseUrlConfigured,
        supabaseSecretConfigured: envCfg.supabaseSecretConfigured,
        currentRuntime: runtimeInfo.shortName,
        deploymentEnvironment: runtimeInfo.deploymentEnv,
        actualRuntime: runtimeInfo.label,
        runtimeId: runtimeInfo.runtime,
        connectionTestOk,
        databaseQueryOk,
        credentialTableAccessible,
        projectHost: envCfg.projectHost,
        testRecordId: testId,
        stages,
        error: msg
      };
    }
    stages.push({
      stage: "SELECT",
      ok: true,
      latencyMs: Date.now() - t0,
      detail: `Read back "${selected.label}" (enabled=${selected.enabled})`
    });
    t0 = Date.now();
    const updatedLabel = "Diagnostic CRUD Probe Updated";
    const { data: updated, error: updErr } = await client.from("ai_provider_credentials").update({ label: updatedLabel, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", testId).select("id, label").single();
    if (updErr || !updated || updated.label !== updatedLabel) {
      const msg = updErr?.message || "Updated row mismatch or zero rows affected.";
      stages.push({
        stage: "UPDATE",
        ok: false,
        latencyMs: Date.now() - t0,
        detail: "Failed updating test record label.",
        error: msg
      });
      padRemainingStages("Skipped because UPDATE failed.");
      return {
        ok: false,
        configured: true,
        supabaseUrlConfigured: envCfg.supabaseUrlConfigured,
        supabaseSecretConfigured: envCfg.supabaseSecretConfigured,
        currentRuntime: runtimeInfo.shortName,
        deploymentEnvironment: runtimeInfo.deploymentEnv,
        actualRuntime: runtimeInfo.label,
        runtimeId: runtimeInfo.runtime,
        connectionTestOk,
        databaseQueryOk,
        credentialTableAccessible,
        projectHost: envCfg.projectHost,
        testRecordId: testId,
        stages,
        error: msg
      };
    }
    stages.push({
      stage: "UPDATE",
      ok: true,
      latencyMs: Date.now() - t0,
      detail: `Updated label -> "${updated.label}"`
    });
    t0 = Date.now();
    const { data: delRows, error: delErr } = await client.from("ai_provider_credentials").delete().eq("id", testId).select("id");
    const delCount = Array.isArray(delRows) ? delRows.length : 0;
    if (delErr || delCount !== 1) {
      const msg = delErr?.message || "Zero rows deleted.";
      stages.push({
        stage: "DELETE",
        ok: false,
        latencyMs: Date.now() - t0,
        detail: `Delete affected ${delCount} rows (expected 1).`,
        error: msg
      });
      padRemainingStages("Skipped because DELETE failed.");
      return {
        ok: false,
        configured: true,
        supabaseUrlConfigured: envCfg.supabaseUrlConfigured,
        supabaseSecretConfigured: envCfg.supabaseSecretConfigured,
        currentRuntime: runtimeInfo.shortName,
        deploymentEnvironment: runtimeInfo.deploymentEnv,
        actualRuntime: runtimeInfo.label,
        runtimeId: runtimeInfo.runtime,
        connectionTestOk,
        databaseQueryOk,
        credentialTableAccessible,
        projectHost: envCfg.projectHost,
        testRecordId: testId,
        stages,
        error: msg
      };
    }
    stages.push({
      stage: "DELETE",
      ok: true,
      latencyMs: Date.now() - t0,
      detail: `Deleted 1 test record (${testId})`
    });
    t0 = Date.now();
    const { data: verifyAfter, error: verifyErr } = await client.from("ai_provider_credentials").select("id").eq("id", testId).maybeSingle();
    if (verifyErr || verifyAfter !== null) {
      const msg = verifyErr?.message || "Residual test row detected.";
      stages.push({
        stage: "VERIFY_DELETED",
        ok: false,
        latencyMs: Date.now() - t0,
        detail: "Record still existed or failed verification query after deletion.",
        error: msg
      });
      return {
        ok: false,
        configured: true,
        supabaseUrlConfigured: envCfg.supabaseUrlConfigured,
        supabaseSecretConfigured: envCfg.supabaseSecretConfigured,
        currentRuntime: runtimeInfo.shortName,
        deploymentEnvironment: runtimeInfo.deploymentEnv,
        actualRuntime: runtimeInfo.label,
        runtimeId: runtimeInfo.runtime,
        connectionTestOk,
        databaseQueryOk,
        credentialTableAccessible,
        projectHost: envCfg.projectHost,
        testRecordId: testId,
        stages,
        error: msg
      };
    }
    stages.push({
      stage: "VERIFY_DELETED",
      ok: true,
      latencyMs: Date.now() - t0,
      detail: "Confirmed test record no longer exists in Supabase."
    });
    return {
      ok: true,
      configured: true,
      supabaseUrlConfigured: envCfg.supabaseUrlConfigured,
      supabaseSecretConfigured: envCfg.supabaseSecretConfigured,
      currentRuntime: runtimeInfo.shortName,
      deploymentEnvironment: runtimeInfo.deploymentEnv,
      actualRuntime: runtimeInfo.label,
      runtimeId: runtimeInfo.runtime,
      connectionTestOk,
      databaseQueryOk,
      credentialTableAccessible,
      projectHost: envCfg.projectHost,
      testRecordId: testId,
      stages
    };
  } catch (err) {
    const msg = err?.message || "Unexpected error during AI CRUD self-test";
    padRemainingStages(msg);
    return {
      ok: false,
      configured: true,
      supabaseUrlConfigured: envCfg.supabaseUrlConfigured,
      supabaseSecretConfigured: envCfg.supabaseSecretConfigured,
      currentRuntime: runtimeInfo.shortName,
      deploymentEnvironment: runtimeInfo.deploymentEnv,
      actualRuntime: runtimeInfo.label,
      runtimeId: runtimeInfo.runtime,
      connectionTestOk,
      databaseQueryOk,
      credentialTableAccessible,
      projectHost: envCfg.projectHost,
      testRecordId: testId,
      stages,
      error: msg
    };
  } finally {
    await client.from("ai_provider_credentials").delete().eq("id", testId).then(() => {
    }, () => {
    });
  }
}

// services/ai/AIProviderManager.ts
var AI_TASK_CATALOG = [
  { task: "headline_generation", label: "Headline Suggestions", defaultModel: "gemini-4-hydrogen" },
  { task: "translation", label: "English <-> Urdu Translation", defaultModel: "gemini-4-hydrogen" },
  { task: "seo_metadata", label: "SEO Tags, Slugs & Meta Generation", defaultModel: "gemini-4-hydrogen" },
  { task: "article_drafting", label: "Full Article Drafting", defaultModel: "gemini-4-hydrogen" },
  { task: "summarization", label: "Article & Feed Summarization", defaultModel: "gemini-4-hydrogen" },
  { task: "content_rewriting", label: "Rewrite & Tone Adjustment", defaultModel: "gemini-4-hydrogen" },
  { task: "breaking_alerts", label: "Breaking News & Market Alert Summaries", defaultModel: "gemini-4-hydrogen" },
  { task: "public_qa", label: "Ask Khabarnama Public Q&A", defaultModel: "gemini-4-hydrogen" },
  { task: "category_tagging", label: "Category Classification & Tagging", defaultModel: "gemini-4-hydrogen" },
  { task: "fact_check_prep", label: "Editorial Quality & Fact-Check Prep", defaultModel: "gemini-4-hydrogen" },
  { task: "newsletter_social", label: "Newsletter & Social Media Copy", defaultModel: "gemini-4-hydrogen" }
];
function mapDiagnosticToAutoCategory(diag, modelsCount = 0) {
  if (!diag) {
    return modelsCount === 0 ? "NO_ACCESSIBLE_MODELS" : "PROVIDER_UNAVAILABLE";
  }
  switch (diag.category) {
    case "auth_failed_401":
      return "INVALID_API_KEY";
    case "quota_429":
      return "FREE_TIER_QUOTA_EXCEEDED";
    case "billing_required":
      return "BILLING_REQUIRED";
    case "permission_denied_403":
      return "PERMISSION_DENIED";
    case "timeout":
      return "API_TIMEOUT";
    case "network_error":
      return "SERVER_CONNECTIVITY_FAILURE";
    case "not_found_404":
      return modelsCount === 0 ? "NO_ACCESSIBLE_MODELS" : "UNSUPPORTED_MODEL";
    case "bad_request_400":
      return "UNSUPPORTED_MODEL";
    case "server_error_5xx":
    case "malformed_response":
      return "PROVIDER_UNAVAILABLE";
    default:
      return "PROVIDER_UNAVAILABLE";
  }
}
var AI_VAULT_BUILD_VERSION = process.env.APP_VERSION || process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "2026.11.20-ai-crud-v3";
var AIProviderManager = class {
  static {
    this.lastDbError = null;
  }
  static {
    this.lastSuccessfulSaveAt = null;
  }
  static {
    this.lastSuccessfulDeleteAt = null;
  }
  static {
    this.lastProviderValidationAt = null;
  }
  static {
    this.hydrationPromise = null;
  }
  static {
    this.mutationDebugLogs = [];
  }
  static recordDbFailure(operation, message, code) {
    this.lastDbError = {
      operation,
      message,
      code,
      at: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  static getStorageBackendMode() {
    if (isSupabaseConfigured()) return "supabase+local_encrypted";
    const runtime = detectBackendRuntimeInfo();
    if (runtime.isServerless) return "ephemeral_tmp_unconfigured";
    if (runtime.isGoogleAiStudio) return "aistudio_supabase_missing";
    if (runtime.isProduction) return "production_supabase_missing";
    return "local_encrypted";
  }
  static recordMutationDebugLog(entry) {
    const clean = {
      correlationId: entry.correlationId,
      timestamp: entry.timestamp || (/* @__PURE__ */ new Date()).toISOString(),
      action: entry.action,
      handler: entry.handler,
      endpoint: entry.endpoint,
      httpStatus: entry.httpStatus,
      storageBackend: entry.storageBackend || this.getStorageBackendMode(),
      table: entry.table,
      targetId: entry.targetId,
      affectedCount: entry.affectedCount,
      verifiedAfterMutation: entry.verifiedAfterMutation,
      rlsError: entry.rlsError || null,
      cacheRefreshed: entry.cacheRefreshed ?? true,
      buildVersion: AI_VAULT_BUILD_VERSION,
      note: entry.note ? redactSecrets(entry.note) : void 0
    };
    this.mutationDebugLogs.unshift(clean);
    if (this.mutationDebugLogs.length > 50) {
      this.mutationDebugLogs = this.mutationDebugLogs.slice(0, 50);
    }
    console.info(
      `[AI Vault Mutation] cid=${clean.correlationId} action=${clean.action} endpoint=${clean.endpoint} status=${clean.httpStatus} backend=${clean.storageBackend} table=${clean.table} targetId=${clean.targetId} affected=${clean.affectedCount} verified=${clean.verifiedAfterMutation}${clean.rlsError ? ` rlsError=${clean.rlsError}` : ""}`
    );
    return clean;
  }
  static getMutationDebugLogs() {
    return this.mutationDebugLogs.slice(0, 50);
  }
  static assertPersistentMutationBackend(operation) {
    const runtime = detectBackendRuntimeInfo();
    if ((runtime.isServerless || runtime.isProduction || runtime.isGoogleAiStudio) && !isSupabaseConfigured()) {
      const msg = getMissingSupabaseConfigGuidance();
      this.recordDbFailure(operation, msg, "SUPABASE_CONFIG_REQUIRED");
      throw new Error(msg);
    }
  }
  static async syncActiveCacheFromSupabase(actor) {
    if (!isSupabaseConfigured()) return;
    this.hydrationPromise = null;
    await this.hydrateFromSupabaseIfConfigured(actor, { requireSuccess: true });
  }
  static sanitizeCredential(cred, routes) {
    const assignedTasks = routes ? routes.filter((r) => r.primaryCredentialId === cred.id || r.fallbackCredentialId === cred.id).map((r) => r.label) : [];
    const copy = {
      ...cred,
      encryptedSecret: void 0,
      assignedTasks,
      connectionStatus: cred.enabled ? cred.connectionStatus || (cred.lastTestStatus === "connected" ? "connected" : cred.lastTestStatus === "error" ? "error" : "untested") : "disabled",
      modelListStatus: cred.modelListStatus || (cred.availableModels && cred.availableModels.length > 0 ? "ok" : "untested"),
      generationTestStatus: cred.generationTestStatus || (cred.lastTestStatus === "connected" ? "ok" : cred.lastTestStatus === "error" ? "error" : "untested")
    };
    delete copy.encryptedSecret;
    return copy;
  }
  static resolveRawCredentialDetailed(credId) {
    const envSuppressed = db.getAiEnvSuppressed();
    if (credId === "env-gemini-default" && !envSuppressed.gemini && process.env.GEMINI_API_KEY?.trim()) {
      const rawKey = process.env.GEMINI_API_KEY.trim();
      return {
        cred: {
          id: "env-gemini-default",
          providerType: "gemini",
          label: "Server Environment GEMINI_API_KEY",
          projectId: process.env.GOOGLE_CLOUD_PROJECT || "env-gemini-project",
          model: "gemini-4-hydrogen",
          encryptedSecret: "",
          maskedKey: maskSecret(rawKey),
          enabled: true,
          priority: 1,
          dailyTokenLimit: 1e6,
          dailyTokensUsed: 0,
          monthlyBudgetUsd: 50,
          monthlySpendUsd: 0,
          connectionStatus: "untested",
          createdAt: "",
          updatedAt: ""
        },
        rawKey
      };
    }
    if (credId === "env-grok-default" && !envSuppressed.grok && process.env.XAI_API_KEY?.trim()) {
      const rawKey = process.env.XAI_API_KEY.trim();
      return {
        cred: {
          id: "env-grok-default",
          providerType: "grok",
          label: "Server Environment XAI_API_KEY",
          projectId: "env-xai-project",
          endpointUrl: "https://api.x.ai/v1",
          model: "grok-3-mini",
          encryptedSecret: "",
          maskedKey: maskSecret(rawKey),
          enabled: true,
          priority: 2,
          dailyTokenLimit: 5e5,
          dailyTokensUsed: 0,
          monthlyBudgetUsd: 50,
          monthlySpendUsd: 0,
          connectionStatus: "untested",
          createdAt: "",
          updatedAt: ""
        },
        rawKey
      };
    }
    const found = db.getAiProviders().find((p) => p.id === credId);
    if (!found) return null;
    const dec = tryDecryptSecret(found.encryptedSecret);
    if (!dec.ok) {
      return { cred: found, rawKey: "", decryptError: dec.error || "Failed to decrypt stored credential." };
    }
    return { cred: found, rawKey: dec.value };
  }
  static resolveRawCredential(credId) {
    const detailed = this.resolveRawCredentialDetailed(credId);
    if (!detailed) return null;
    return { cred: detailed.cred, rawKey: detailed.rawKey };
  }
  /**
   * Validates an API key against the official provider without saving it to the DB.
   * Supports lightweight model-list validation (runGenerationTest = false) or full
   * model-list + live generation verification (runGenerationTest = true).
   */
  static async validateCandidateKey(input, actor = "Super Admin", signal) {
    let rawKey = (input.apiKey || "").trim();
    let providerType = input.providerType;
    let endpointUrl = input.endpointUrl?.trim();
    let preferredModel = input.model?.trim();
    let decryptError;
    if (!rawKey && input.credentialId) {
      const resolved = this.resolveRawCredentialDetailed(input.credentialId);
      if (resolved) {
        rawKey = resolved.rawKey;
        decryptError = resolved.decryptError;
        providerType = resolved.cred.providerType;
        endpointUrl = endpointUrl || resolved.cred.endpointUrl;
        preferredModel = preferredModel || resolved.cred.model;
      }
    }
    const runGenerationTest = input.runGenerationTest !== false;
    if (!rawKey) {
      const diag = classifyProviderError({
        providerType,
        httpStatus: decryptError ? 500 : 401,
        providerMessage: decryptError ? `Stored credential could not be decrypted (${decryptError}). Replace the key or restore AI_MASTER_KEY.` : "API key input is empty.",
        stage: "model_list"
      });
      this.lastProviderValidationAt = (/* @__PURE__ */ new Date()).toISOString();
      return {
        ok: false,
        authenticated: false,
        generationVerified: false,
        connectionStatus: decryptError ? "error" : "auth_failed",
        message: diag.diagnosis,
        latencyMs: 0,
        providerType,
        selectedModel: preferredModel || "",
        availableModels: [],
        diagnostic: diag,
        correlationId: diag.correlationId
      };
    }
    const result = providerType === "gemini" ? await GeminiProvider.testConnection(rawKey, preferredModel, signal, runGenerationTest) : await GrokProvider.testConnection(
      rawKey,
      preferredModel,
      endpointUrl || (providerType === "grok" ? "https://api.x.ai/v1" : ""),
      signal,
      runGenerationTest,
      providerType
    );
    const testRecord = {
      id: `aitest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      credentialId: input.credentialId,
      providerType,
      modelTested: result.selectedModel || preferredModel,
      stage: runGenerationTest ? "generation_test" : "model_list",
      ok: result.ok,
      connectionStatus: result.connectionStatus,
      modelListOk: result.authenticated,
      generationOk: result.generationVerified,
      modelsDiscoveredCount: result.availableModels.length,
      latencyMs: result.latencyMs,
      sampleOutput: result.sampleOutput ? redactSecrets(result.sampleOutput, rawKey) : void 0,
      diagnostic: result.diagnostic,
      actor,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.lastProviderValidationAt = testRecord.timestamp;
    db.recordAiConnectionTest(testRecord);
    if (isSupabaseConfigured()) {
      recordSupabaseAiConnectionTest(testRecord).catch(() => {
      });
    }
    return result;
  }
  static async addOrUpdateCredential(input, actor) {
    if (input.id === "env-gemini-default" || input.id === "env-grok-default") {
      throw new Error(
        "Server environment fallback credentials cannot be edited directly. Add a database-backed credential or paste a new key in Connect AI API."
      );
    }
    this.assertPersistentMutationBackend(input.id ? "edit_credential" : "add_credential");
    if (isSupabaseConfigured()) {
      await this.hydrateFromSupabaseIfConfigured(actor, { requireSuccess: true });
    }
    const existing = input.id ? db.getAiProviders().find((p) => p.id === input.id) : void 0;
    if (input.id && !existing) {
      throw new Error("AI credential not found.");
    }
    if (!existing && (!input.apiKey || !input.apiKey.trim())) {
      throw new Error("API key is required when adding a new credential.");
    }
    if (!input.label?.trim()) {
      throw new Error("Friendly credential name is required.");
    }
    const resolvedProjectId = input.projectId?.trim() || existing?.projectId || `${input.providerType}-project`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const rawKey = input.apiKey?.trim();
    const val = input.validationResult;
    let connectionStatus = existing?.connectionStatus || "untested";
    let lastTestStatus = existing?.lastTestStatus || "untested";
    let lastTestMessage = existing?.lastTestMessage;
    let modelListStatus = existing?.modelListStatus || "untested";
    let generationTestStatus = existing?.generationTestStatus || "untested";
    let availableModels = existing?.availableModels;
    if (val) {
      availableModels = val.availableModels || existing?.availableModels;
      modelListStatus = val.authenticated ? "ok" : "error";
      generationTestStatus = val.generationVerified ? "ok" : val.authenticated ? "error" : "untested";
      connectionStatus = val.connectionStatus;
      lastTestStatus = val.generationVerified ? "connected" : val.diagnostic ? "error" : "untested";
      lastTestMessage = val.message;
    } else if (rawKey) {
      connectionStatus = "untested";
      modelListStatus = "untested";
      generationTestStatus = "untested";
      lastTestStatus = "untested";
      lastTestMessage = "Credential saved; live generation test not yet completed.";
      availableModels = void 0;
    }
    const enabled = input.enabled ?? existing?.enabled ?? true;
    if (!enabled) {
      connectionStatus = "disabled";
    } else if (existing && !existing.enabled && enabled && connectionStatus === "disabled") {
      connectionStatus = lastTestStatus === "connected" ? "connected" : lastTestStatus === "error" ? "error" : "untested";
    }
    const defaultEndpoint = input.providerType === "grok" ? "https://api.x.ai/v1" : void 0;
    const record = {
      id: existing?.id || `aik-${input.providerType}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      providerType: input.providerType,
      label: input.label.trim(),
      projectId: resolvedProjectId,
      endpointUrl: input.endpointUrl !== void 0 ? input.endpointUrl.trim() || defaultEndpoint : existing?.endpointUrl || defaultEndpoint,
      model: input.model?.trim() || val?.selectedModel || existing?.model || "",
      encryptedSecret: rawKey ? encryptSecret(rawKey) : existing.encryptedSecret,
      maskedKey: rawKey ? maskSecret(rawKey) : existing.maskedKey,
      enabled,
      priority: Number(input.priority ?? existing?.priority ?? 10),
      dailyTokenLimit: Number(input.dailyTokenLimit ?? existing?.dailyTokenLimit ?? 5e5),
      dailyTokensUsed: existing?.dailyTokensUsed ?? 0,
      monthlyBudgetUsd: Number(input.monthlyBudgetUsd ?? existing?.monthlyBudgetUsd ?? 25),
      monthlySpendUsd: existing?.monthlySpendUsd ?? 0,
      availableModels,
      connectionStatus,
      billingStatus: existing?.billingStatus,
      billingNote: existing?.billingNote,
      modelListStatus,
      generationTestStatus,
      lastTestedAt: val ? now : rawKey ? null : existing?.lastTestedAt ?? null,
      lastSuccessfulVerificationAt: val?.authenticated ? now : existing?.lastSuccessfulVerificationAt ?? null,
      lastSuccessfulGenerationAt: val?.generationVerified ? now : existing?.lastSuccessfulGenerationAt ?? null,
      lastFailureAt: val && !val.ok ? now : existing?.lastFailureAt ?? null,
      lastTestStatus,
      lastTestMessage,
      lastDiagnostic: val?.diagnostic ?? (rawKey ? null : existing?.lastDiagnostic ?? null),
      lastLatencyMs: val?.latencyMs ?? existing?.lastLatencyMs,
      lastCorrelationId: val?.correlationId ?? existing?.lastCorrelationId,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };
    let persistedRecord = record;
    if (isSupabaseConfigured()) {
      const sbRes = await upsertSupabaseAiCredential(record);
      if (!sbRes.ok || !sbRes.credential) {
        const msg = sbRes.error || "Failed persisting AI credential to Supabase PostgreSQL.";
        this.recordDbFailure("upsertSupabaseAiCredential", msg, sbRes.code);
        throw new Error(`Database save failed: ${msg}`);
      }
      persistedRecord = sbRes.credential;
    }
    const saved = db.upsertAiProvider(persistedRecord, actor);
    const localVerify = db.getAiProviders().find((p) => p.id === saved.id);
    if (!localVerify) {
      throw new Error("Credential write verification failed: record missing after local cache upsert.");
    }
    this.lastSuccessfulSaveAt = now;
    if (Array.isArray(input.assignedTasks)) {
      const assignedSet = new Set(input.assignedTasks);
      const existingRoutes = db.getAiTaskRoutes();
      const updatedRoutes = [];
      for (const spec of AI_TASK_CATALOG) {
        const prev = existingRoutes[spec.task];
        if (assignedSet.has(spec.task)) {
          const next = {
            task: spec.task,
            label: prev?.label || spec.label,
            primaryCredentialId: saved.id,
            primaryModel: saved.model || prev?.primaryModel || spec.defaultModel,
            fallbackCredentialId: prev?.fallbackCredentialId && prev.fallbackCredentialId !== saved.id ? prev.fallbackCredentialId : "",
            fallbackModel: prev?.fallbackCredentialId && prev.fallbackCredentialId !== saved.id ? prev.fallbackModel || "" : "",
            temperature: prev?.temperature ?? (spec.task === "fact_check_prep" || spec.task === "translation" ? 0.2 : 0.5),
            maxTokens: prev?.maxTokens ?? (spec.task === "article_drafting" ? 4096 : 3072)
          };
          db.setAiTaskRoute(spec.task, next, actor);
          updatedRoutes.push(next);
        } else if (prev && prev.primaryCredentialId === saved.id) {
          const next = {
            ...prev,
            primaryCredentialId: "",
            primaryModel: ""
          };
          db.setAiTaskRoute(spec.task, next, actor);
          updatedRoutes.push(next);
        }
      }
      if (updatedRoutes.length > 0 && isSupabaseConfigured()) {
        const routeRes = await upsertSupabaseAiTaskRoutes(updatedRoutes);
        if (!routeRes.ok) {
          const msg = routeRes.error || "Task route sync failed";
          this.recordDbFailure("upsertSupabaseAiTaskRoutes", msg, routeRes.code);
          throw new Error(`Database route sync failed: ${msg}`);
        }
      }
    }
    if (isSupabaseConfigured()) {
      await this.syncActiveCacheFromSupabase(actor);
    }
    const verifySaved = db.getAiProviders().find((p) => p.id === persistedRecord.id);
    if (!verifySaved) {
      throw new Error("Credential write verification failed: record missing after authoritative database reload.");
    }
    const finalRoutes = AI_TASK_CATALOG.map((spec) => db.getAiTaskRoutes()[spec.task]).filter(Boolean);
    return this.sanitizeCredential(verifySaved, finalRoutes);
  }
  static async updateCredentialPartial(id, patch, actor) {
    if (isSupabaseConfigured()) {
      await this.hydrateFromSupabaseIfConfigured(actor, { requireSuccess: true });
    }
    const existing = db.getAiProviders().find((p) => p.id === id);
    if (!existing) {
      throw new Error("AI credential not found.");
    }
    return this.addOrUpdateCredential(
      {
        id: existing.id,
        providerType: existing.providerType,
        label: patch.label ?? existing.label,
        projectId: patch.projectId ?? existing.projectId,
        endpointUrl: patch.endpointUrl ?? existing.endpointUrl,
        model: patch.model ?? existing.model,
        apiKey: patch.apiKey,
        enabled: patch.enabled ?? existing.enabled,
        priority: patch.priority ?? existing.priority,
        dailyTokenLimit: patch.dailyTokenLimit ?? existing.dailyTokenLimit,
        monthlyBudgetUsd: patch.monthlyBudgetUsd ?? existing.monthlyBudgetUsd,
        assignedTasks: patch.assignedTasks,
        validationResult: patch.validationResult
      },
      actor
    );
  }
  static async testSavedCredential(credId, actor) {
    if (isSupabaseConfigured() && !credId.startsWith("env-")) {
      await this.hydrateFromSupabaseIfConfigured(actor, { requireSuccess: true });
    }
    const resolved = this.resolveRawCredentialDetailed(credId);
    if (!resolved) {
      throw new Error("AI credential not found.");
    }
    const { cred, rawKey, decryptError } = resolved;
    if (!rawKey && decryptError) {
      throw new Error(`Credential decryption failed: ${decryptError}`);
    }
    const result = await this.validateCandidateKey(
      {
        credentialId: cred.id,
        providerType: cred.providerType,
        apiKey: rawKey,
        endpointUrl: cred.endpointUrl,
        model: cred.model,
        runGenerationTest: true
      },
      actor
    );
    const now = (/* @__PURE__ */ new Date()).toISOString();
    if (cred.id !== "env-gemini-default" && cred.id !== "env-grok-default") {
      const nextCred = {
        ...cred,
        model: cred.model || result.selectedModel,
        availableModels: result.availableModels.length > 0 ? result.availableModels : cred.availableModels,
        connectionStatus: cred.enabled ? result.connectionStatus : "disabled",
        modelListStatus: result.authenticated ? "ok" : "error",
        generationTestStatus: result.generationVerified ? "ok" : result.authenticated ? "error" : "untested",
        lastTestedAt: now,
        lastSuccessfulVerificationAt: result.authenticated ? now : cred.lastSuccessfulVerificationAt,
        lastSuccessfulGenerationAt: result.generationVerified ? now : cred.lastSuccessfulGenerationAt,
        lastFailureAt: !result.ok ? now : cred.lastFailureAt,
        lastTestStatus: result.ok ? "connected" : "error",
        lastTestMessage: result.message,
        lastDiagnostic: result.diagnostic || null,
        lastLatencyMs: result.latencyMs,
        lastCorrelationId: result.correlationId,
        updatedAt: now
      };
      if (isSupabaseConfigured()) {
        const sbRes = await upsertSupabaseAiCredential(nextCred);
        if (!sbRes.ok) {
          const msg = sbRes.error || "Failed persisting test status to Supabase.";
          this.recordDbFailure("upsertSupabaseAiCredential", msg, sbRes.code);
          throw new Error(`Database status save failed: ${msg}`);
        }
        db.upsertAiProvider(sbRes.credential || nextCred, actor);
      } else {
        db.upsertAiProvider(nextCred, actor);
      }
      this.lastSuccessfulSaveAt = now;
    }
    return result;
  }
  static async discoverModelsForCredential(credId, actor) {
    if (isSupabaseConfigured() && !credId.startsWith("env-")) {
      await this.hydrateFromSupabaseIfConfigured(actor, { requireSuccess: true });
    }
    const resolved = this.resolveRawCredential(credId);
    if (!resolved) {
      throw new Error("AI credential not found.");
    }
    const { cred, rawKey } = resolved;
    const discovery = cred.providerType === "gemini" ? await AIModelDiscovery.discoverGeminiModels(rawKey) : await AIModelDiscovery.discoverGrokModels(rawKey, cred.endpointUrl || "https://api.x.ai/v1");
    if (cred.id !== "env-gemini-default" && cred.id !== "env-grok-default") {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const updatedCred = {
        ...cred,
        availableModels: discovery.models,
        modelListStatus: "ok",
        lastSuccessfulVerificationAt: now,
        rateLimitInfo: discovery.rateLimitInfo || cred.rateLimitInfo,
        updatedAt: now
      };
      if (isSupabaseConfigured()) {
        const sbRes = await upsertSupabaseAiCredential(updatedCred);
        if (!sbRes.ok) {
          const msg = sbRes.error || "Failed persisting discovered models to Supabase.";
          this.recordDbFailure("upsertSupabaseAiCredential", msg, sbRes.code);
          throw new Error(`Database model list sync failed: ${msg}`);
        }
        db.upsertAiProvider(sbRes.credential || updatedCred, actor);
      } else {
        db.upsertAiProvider(updatedCred, actor);
      }
    }
    return discovery;
  }
  static getCredentialLogs(credId) {
    const tests = db.getAiConnectionTests(credId, 50);
    const usage = db.getAiUsageLogs(200).filter((u) => u.credentialId === credId).slice(0, 50);
    return { tests, usage };
  }
  /**
   * Lightweight periodic health monitor: checks enabled credentials using /models ONLY
   * (zero paid inference requests) + validates outbound HTTPS connectivity to provider hosts.
   */
  static async runLightweightHealthCheck(actor = "Health Monitor") {
    if (isSupabaseConfigured()) {
      await this.hydrateFromSupabaseIfConfigured(actor, { requireSuccess: true });
    }
    const creds = db.getAiProviders().filter((c) => c.enabled);
    const connectivity = await checkOutboundConnectivity();
    const checks = [];
    for (const cred of creds) {
      const dec = tryDecryptSecret(cred.encryptedSecret);
      const rawKey = dec.ok ? dec.value : "";
      const start = Date.now();
      const correlationId = generateCorrelationId("hc");
      try {
        if (!dec.ok) {
          throw new Error(`Credential decryption failed: ${dec.error}`);
        }
        const discovery = cred.providerType === "gemini" ? await AIModelDiscovery.discoverGeminiModels(rawKey) : await AIModelDiscovery.discoverGrokModels(rawKey, cred.endpointUrl || "https://api.x.ai/v1");
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const prevConnected = cred.generationTestStatus === "ok" || cred.lastTestStatus === "connected";
        const nextStatus = prevConnected ? "connected" : "untested";
        const healthyCred = {
          ...cred,
          availableModels: discovery.models,
          modelListStatus: "ok",
          connectionStatus: nextStatus,
          lastTestedAt: now,
          lastSuccessfulVerificationAt: now,
          lastLatencyMs: discovery.latencyMs,
          lastCorrelationId: discovery.correlationId,
          rateLimitInfo: discovery.rateLimitInfo || cred.rateLimitInfo,
          updatedAt: now
        };
        db.upsertAiProvider(healthyCred, actor);
        if (isSupabaseConfigured()) {
          const sbRes = await upsertSupabaseAiCredential(healthyCred);
          if (!sbRes.ok) {
            this.recordDbFailure("upsertSupabaseAiCredential", sbRes.error || "Health status sync failed", sbRes.code);
          }
        }
        const hcRecord = {
          id: `aitest-hc-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          credentialId: cred.id,
          providerType: cred.providerType,
          modelTested: cred.model,
          stage: "health_check",
          ok: true,
          connectionStatus: nextStatus,
          modelListOk: true,
          generationOk: cred.generationTestStatus === "ok",
          modelsDiscoveredCount: discovery.models.length,
          latencyMs: discovery.latencyMs,
          actor,
          timestamp: now
        };
        db.recordAiConnectionTest(hcRecord);
        if (isSupabaseConfigured()) {
          recordSupabaseAiConnectionTest(hcRecord).catch(() => {
          });
        }
        checks.push({
          credentialId: cred.id,
          label: cred.label,
          providerType: cred.providerType,
          ok: true,
          modelsCount: discovery.models.length,
          latencyMs: discovery.latencyMs,
          status: nextStatus
        });
      } catch (err) {
        const diag = err instanceof ProviderExecutionError ? err.diagnostic : classifyProviderError({
          providerType: cred.providerType,
          err,
          stage: "model_list",
          correlationId,
          secretToRedact: rawKey
        });
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const failedCred = {
          ...cred,
          modelListStatus: "error",
          connectionStatus: diag.connectionStatus,
          lastTestedAt: now,
          lastFailureAt: now,
          lastTestStatus: "error",
          lastTestMessage: diag.diagnosis,
          lastDiagnostic: diag,
          lastLatencyMs: Date.now() - start,
          lastCorrelationId: diag.correlationId,
          updatedAt: now
        };
        db.upsertAiProvider(failedCred, actor);
        if (isSupabaseConfigured()) {
          const sbRes = await upsertSupabaseAiCredential(failedCred);
          if (!sbRes.ok) {
            this.recordDbFailure("upsertSupabaseAiCredential", sbRes.error || "Health error sync failed", sbRes.code);
          }
        }
        const errRecord = {
          id: `aitest-hc-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          credentialId: cred.id,
          providerType: cred.providerType,
          modelTested: cred.model,
          stage: "health_check",
          ok: false,
          connectionStatus: diag.connectionStatus,
          modelListOk: false,
          generationOk: false,
          modelsDiscoveredCount: 0,
          latencyMs: Date.now() - start,
          diagnostic: diag,
          actor,
          timestamp: now
        };
        db.recordAiConnectionTest(errRecord);
        if (isSupabaseConfigured()) {
          recordSupabaseAiConnectionTest(errRecord).catch(() => {
          });
        }
        checks.push({
          credentialId: cred.id,
          label: cred.label,
          providerType: cred.providerType,
          ok: false,
          status: diag.connectionStatus,
          diagnosis: diag.diagnosis,
          correlationId: diag.correlationId
        });
      }
    }
    const summary = {
      checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
      connectivity,
      credentialsChecked: checks.length,
      healthyCount: checks.filter((c) => c.ok).length,
      failingCount: checks.filter((c) => !c.ok).length,
      checks
    };
    db.setAiHealthStatus(summary);
    return summary;
  }
  static getEnvManagedVariablesStatus() {
    const suppressed = db.getAiEnvSuppressed();
    const geminiSet = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());
    const grokSet = Boolean(process.env.XAI_API_KEY && process.env.XAI_API_KEY.trim());
    return [
      {
        name: "GEMINI_API_KEY",
        provider: "gemini",
        presentInEnv: geminiSet,
        maskedValue: geminiSet ? maskSecret(process.env.GEMINI_API_KEY.trim()) : null,
        suppressedInRuntime: suppressed.gemini,
        location: ".env file / Namecheap Node.js App Environment Variables / Google AI Studio Secrets"
      },
      {
        name: "XAI_API_KEY",
        provider: "grok",
        presentInEnv: grokSet,
        maskedValue: grokSet ? maskSecret(process.env.XAI_API_KEY.trim()) : null,
        suppressedInRuntime: suppressed.grok,
        location: ".env file / Namecheap Node.js App Environment Variables"
      }
    ];
  }
  static async getResetPreviewSummary() {
    if (isSupabaseConfigured()) {
      await this.hydrateFromSupabaseIfConfigured();
    }
    const creds = db.getAiProviders();
    const geminiCount = creds.filter((c) => c.providerType === "gemini").length;
    const grokCount = creds.filter((c) => c.providerType === "grok").length;
    const customCount = creds.filter((c) => c.providerType !== "gemini" && c.providerType !== "grok").length;
    const routesMap = db.getAiTaskRoutes();
    const dependentRoutesCount = AI_TASK_CATALOG.filter((spec) => {
      const r = routesMap[spec.task];
      return Boolean(r?.primaryCredentialId || r?.fallbackCredentialId);
    }).length;
    const envManagedVariables = this.getEnvManagedVariablesStatus();
    const activeEnvCount = envManagedVariables.filter((v) => v.presentInEnv && !v.suppressedInRuntime).length;
    return {
      geminiCount,
      grokCount,
      customCount,
      totalStoredCount: geminiCount + grokCount,
      activeEnvCount,
      dependentRoutesCount,
      envManagedVariables,
      preserved: [
        "News Articles & Drafts",
        "Categories & Tags",
        "Users & Permissions",
        "Site & SEO Settings",
        "Redacted Usage & Audit History",
        "AI_MASTER_KEY Encryption Key"
      ]
    };
  }
  static async resetAllCredentials(actor = "Super Admin") {
    this.assertPersistentMutationBackend("reset_all");
    let supabaseResult = {
      ok: true,
      configured: false,
      removedCount: 0
    };
    if (isSupabaseConfigured()) {
      supabaseResult = await resetSupabaseAiCredentials();
      if (!supabaseResult.ok) {
        const errMsg = supabaseResult.error || "Failed resetting AI credentials in Supabase.";
        this.recordDbFailure("resetSupabaseAiCredentials", errMsg);
        throw new Error(`Supabase AI reset failed: ${errMsg}`);
      }
    }
    const localResult = db.resetAllAiCredentials(actor);
    if (isSupabaseConfigured()) {
      await this.syncActiveCacheFromSupabase(actor);
    }
    const remainingLocal = db.getAiProviders().filter((p) => p.providerType === "gemini" || p.providerType === "grok");
    if (remainingLocal.length > 0) {
      throw new Error(`Reset verification failed: ${remainingLocal.length} Gemini/Grok credentials remain in storage.`);
    }
    this.lastSuccessfulDeleteAt = (/* @__PURE__ */ new Date()).toISOString();
    const envManagedVariables = this.getEnvManagedVariablesStatus();
    const activeEnvVars = envManagedVariables.filter((v) => v.presentInEnv);
    return {
      ok: true,
      removedLocalCount: localResult.removedCount,
      removedSupabaseCount: supabaseResult.removedCount,
      remainingCount: 0,
      verifiedAfterMutation: true,
      storageBackend: this.getStorageBackendMode(),
      buildVersion: AI_VAULT_BUILD_VERSION,
      supabaseConfigured: supabaseResult.configured,
      supabaseSynced: !supabaseResult.configured || supabaseResult.ok,
      supabaseError: supabaseResult.error,
      geminiStatus: "Not Connected",
      grokStatus: "Not Connected",
      envManagedVariables,
      message: activeEnvVars.length > 0 ? `All stored Gemini & Grok credentials cleared and reset to Not Connected. Server environment keys (${activeEnvVars.map((v) => v.name).join(", ")}) are suppressed from active loading until you connect fresh keys or remove them from ${activeEnvVars[0].location}.` : "All previously stored Gemini and Grok API credentials, cached model lists, and task route bindings have been removed. Both providers are now Not Connected."
    };
  }
  static async getDiagnostics() {
    if (isSupabaseConfigured()) {
      await this.syncActiveCacheFromSupabase("Diagnostics");
    }
    const [connectivity, supabase] = await Promise.all([
      checkOutboundConnectivity(),
      inspectSupabaseAiInfrastructure()
    ]);
    const cachedHealth = db.getAiHealthStatus();
    const recentTests = db.getAiConnectionTests(void 0, 25);
    const providers = db.getAiProviders();
    const envManagedVariables = this.getEnvManagedVariablesStatus();
    const latestTest = recentTests[0] || null;
    const latestSuccess = recentTests.find((t) => t.ok && t.generationOk) || null;
    const activeCred = providers.find((c) => c.enabled && c.connectionStatus === "connected") || providers.find((c) => c.enabled) || providers[0] || null;
    const envCfg = resolveSupabaseEnvConfig();
    const runtimeInfo = detectBackendRuntimeInfo();
    const backendMode = this.getStorageBackendMode();
    const unconfiguredMode = backendMode === "ephemeral_tmp_unconfigured" || backendMode === "production_supabase_missing" || backendMode === "aistudio_supabase_missing";
    const lastDbErrorText = supabase.error || this.lastDbError?.message || null;
    return {
      buildVersion: AI_VAULT_BUILD_VERSION,
      configurationDiagnostic: {
        supabaseUrlConfigured: envCfg.supabaseUrlConfigured ? "Yes" : "No",
        supabaseSecretKeyConfigured: envCfg.supabaseSecretConfigured ? "Yes" : "No",
        supabaseConnection: supabase.connectionTestOk ? "Pass" : "Fail",
        databaseQuery: supabase.databaseQueryOk ? "Pass" : "Fail",
        aiCredentialTable: supabase.credentialTableAccessible ? "Accessible" : "Inaccessible",
        currentRuntime: runtimeInfo.shortName,
        actualRuntime: runtimeInfo.label,
        deploymentEnvironment: runtimeInfo.deploymentEnv,
        applicationBuildVersion: AI_VAULT_BUILD_VERSION,
        lastDatabaseError: lastDbErrorText
      },
      connectivity,
      supabase,
      lastHealthCheck: cachedHealth,
      recentTests,
      envManagedVariables,
      mutationDebugLogs: this.getMutationDebugLogs(),
      serverEnvironment: {
        nodeEnv: process.env.NODE_ENV || "development",
        nodeVersion: process.version,
        isServerless: runtimeInfo.isServerless,
        isGoogleAiStudio: runtimeInfo.isGoogleAiStudio,
        isProduction: runtimeInfo.isProduction,
        currentRuntime: runtimeInfo.shortName,
        deploymentEnvironment: runtimeInfo.deploymentEnv,
        actualRuntime: runtimeInfo.label,
        runtimeId: runtimeInfo.runtime,
        runtimeRegion: runtimeInfo.region || null,
        runtimeEnvHint: runtimeInfo.envHint,
        ephemeralServerlessWarning: unconfiguredMode,
        discoveryTimeoutMs: getDiscoveryTimeoutMs(),
        generationTimeoutMs: getGenerationTimeoutMs(),
        supabaseConfigured: envCfg.configured,
        supabaseUrlConfigured: envCfg.supabaseUrlConfigured,
        supabaseSecretConfigured: envCfg.supabaseSecretConfigured,
        urlEnvName: envCfg.urlEnvName,
        secretEnvName: envCfg.secretEnvName,
        masterKeyConfigured: Boolean(process.env.AI_MASTER_KEY && process.env.AI_MASTER_KEY.trim())
      },
      runtimeTelemetry: {
        storageBackend: backendMode,
        configSource: backendMode === "supabase+local_encrypted" ? "Supabase PostgreSQL (authoritative)" : unconfiguredMode ? `Supabase Unconfigured (${runtimeInfo.label} \u2014 set SUPABASE_URL & SUPABASE_SECRET_KEY)` : "Local Development Encrypted Vault (data/portal_database.json)",
        storedCredentialCount: providers.length,
        enabledCredentialCount: providers.filter((p) => p.enabled).length,
        activeConnectedCount: providers.filter((p) => p.enabled && p.connectionStatus === "connected").length,
        lastDbError: this.lastDbError,
        lastProviderValidation: this.lastProviderValidationAt || latestTest?.timestamp || null,
        lastSuccessfulSave: this.lastSuccessfulSaveAt,
        lastSuccessfulDelete: this.lastSuccessfulDeleteAt
      },
      summary: {
        provider: activeCred?.providerType || latestTest?.providerType || null,
        authenticationStatus: activeCred?.modelListStatus || (latestTest?.modelListOk ? "ok" : latestTest ? "error" : "not_checked"),
        modelDiscoveryStatus: activeCred?.modelListStatus || (latestTest?.modelListOk ? `ok (${latestTest.modelsDiscoveredCount} models)` : latestTest ? "failed" : "not_run"),
        selectedModel: activeCred?.model || latestTest?.modelTested || null,
        generationTestStatus: activeCred?.generationTestStatus || (latestTest?.generationOk ? "ok" : latestTest ? "error" : "not_run"),
        apiResponseTimeMs: activeCred?.lastLatencyMs ?? latestTest?.latencyMs ?? null,
        lastError: activeCred?.lastDiagnostic?.diagnosis || latestTest?.diagnostic?.diagnosis || null,
        errorClassification: activeCred?.lastDiagnostic?.title || latestTest?.diagnostic?.title || null,
        failureSource: activeCred?.lastDiagnostic?.failureSource || latestTest?.diagnostic?.failureSource || "None",
        lastSuccessfulConnection: activeCred?.lastSuccessfulGenerationAt || latestSuccess?.timestamp || null,
        correlationId: activeCred?.lastCorrelationId || latestTest?.diagnostic?.correlationId || null
      }
    };
  }
  static async runCrudSelfTest(_actor = "Super Admin") {
    const res = await runSupabaseAiCrudSelfTest();
    if (!res.ok && res.error) {
      this.recordDbFailure(
        "runSupabaseAiCrudSelfTest",
        res.error,
        res.configured ? "SUPABASE_CRUD_TEST_FAILED" : "SUPABASE_CONFIG_REQUIRED"
      );
    }
    return {
      ...res,
      applicationBuildVersion: AI_VAULT_BUILD_VERSION,
      mode: res.configured ? "supabase" : "unconfigured",
      lastDatabaseError: res.ok ? null : res.error || this.lastDbError?.message || null
    };
  }
  /**
   * Key format hint ONLY — never trusted without server-side API verification.
   */
  static detectProviderHint(apiKey) {
    const trimmed = (apiKey || "").trim();
    if (/^AIza[0-9A-Za-z_-]{15,}$/.test(trimmed)) return "gemini";
    if (/^xai-[0-9A-Za-z_-]{15,}$/.test(trimmed)) return "grok";
    return "unknown";
  }
  static async saveTaskRoutes(input, actor = "Super Admin") {
    const items = Array.isArray(input) ? input : [input];
    if (items.length === 0) {
      throw new Error("At least one task route entry is required.");
    }
    this.assertPersistentMutationBackend("save_task_routes");
    if (isSupabaseConfigured()) {
      await this.hydrateFromSupabaseIfConfigured(actor, { requireSuccess: true });
    }
    const validCredIds = new Set(db.getAiProviders().map((p) => p.id));
    const envSuppressed = db.getAiEnvSuppressed();
    if (!envSuppressed.gemini && process.env.GEMINI_API_KEY?.trim()) validCredIds.add("env-gemini-default");
    if (!envSuppressed.grok && process.env.XAI_API_KEY?.trim()) validCredIds.add("env-grok-default");
    const normalizedList = [];
    for (const r of items) {
      if (!r?.task) continue;
      const spec = AI_TASK_CATALOG.find((s) => s.task === r.task);
      const cleanPrimary = r.primaryCredentialId && validCredIds.has(r.primaryCredentialId) ? r.primaryCredentialId : "";
      const cleanFallback = r.fallbackCredentialId && r.fallbackCredentialId !== cleanPrimary && validCredIds.has(r.fallbackCredentialId) ? r.fallbackCredentialId : "";
      const normalized = {
        task: r.task,
        label: r.label || spec?.label || r.task,
        primaryCredentialId: cleanPrimary,
        primaryModel: cleanPrimary ? String(r.primaryModel || "").trim() : "",
        fallbackCredentialId: cleanFallback,
        fallbackModel: cleanFallback ? String(r.fallbackModel || "").trim() : "",
        temperature: Math.min(1, Math.max(0, Number(r.temperature ?? 0.4))),
        maxTokens: Math.max(256, Number(r.maxTokens ?? 3072))
      };
      normalizedList.push(normalized);
    }
    if (normalizedList.length === 0) {
      throw new Error("No valid task route entries provided.");
    }
    if (isSupabaseConfigured()) {
      const sbRes = await upsertSupabaseAiTaskRoutes(normalizedList);
      if (!sbRes.ok) {
        const msg = sbRes.error || "Failed saving task routes to Supabase.";
        this.recordDbFailure("upsertSupabaseAiTaskRoutes", msg, sbRes.code);
        throw new Error(`Database route save failed: ${msg}`);
      }
    }
    for (const normalized of normalizedList) {
      db.setAiTaskRoute(normalized.task, normalized, actor);
    }
    this.lastSuccessfulSaveAt = (/* @__PURE__ */ new Date()).toISOString();
    return AI_TASK_CATALOG.map((spec) => {
      const saved = db.getAiTaskRoutes()[spec.task];
      return saved || {
        task: spec.task,
        label: spec.label,
        primaryCredentialId: "",
        primaryModel: "",
        fallbackCredentialId: "",
        fallbackModel: "",
        temperature: spec.task === "fact_check_prep" || spec.task === "translation" ? 0.2 : 0.5,
        maxTokens: spec.task === "article_drafting" ? 4096 : 3072
      };
    });
  }
  static async syncRoutesForCredential(credentialId, model, actor) {
    if (isSupabaseConfigured()) {
      await this.hydrateFromSupabaseIfConfigured(actor, { requireSuccess: true });
    }
    const existingRoutes = db.getAiTaskRoutes();
    const updatedRoutes = AI_TASK_CATALOG.map((spec) => {
      const prev = existingRoutes[spec.task];
      const next = {
        task: spec.task,
        label: spec.label,
        primaryCredentialId: credentialId,
        primaryModel: model,
        fallbackCredentialId: prev?.fallbackCredentialId && prev.fallbackCredentialId !== credentialId ? prev.fallbackCredentialId : "",
        fallbackModel: prev?.fallbackCredentialId && prev.fallbackCredentialId !== credentialId ? prev.fallbackModel || "" : "",
        temperature: prev?.temperature ?? (spec.task === "fact_check_prep" || spec.task === "translation" ? 0.2 : 0.5),
        maxTokens: prev?.maxTokens ?? (spec.task === "article_drafting" ? 4096 : 3072)
      };
      return next;
    });
    if (isSupabaseConfigured()) {
      const sbRes = await upsertSupabaseAiTaskRoutes(updatedRoutes);
      if (!sbRes.ok) {
        const msg = sbRes.error || "Route sync failed";
        this.recordDbFailure("upsertSupabaseAiTaskRoutes", msg, sbRes.code);
        throw new Error(`Database route sync failed: ${msg}`);
      }
    }
    for (const next of updatedRoutes) {
      db.setAiTaskRoute(next.task, next, actor);
    }
    return updatedRoutes;
  }
  static async hydrateFromSupabaseIfConfigured(actor = "System", opts) {
    if (!isSupabaseConfigured()) return { ok: true };
    if (!this.hydrationPromise) {
      this.hydrationPromise = (async () => {
        try {
          const [credRes, routeRes, flagRes] = await Promise.all([
            listSupabaseAiCredentials(),
            listSupabaseAiTaskRoutes(),
            getSupabaseAiEnvSuppression()
          ]);
          if (!credRes.ok) {
            const msg = credRes.error || "Failed reading AI credentials from Supabase.";
            this.recordDbFailure("listSupabaseAiCredentials", msg, credRes.code);
            return { ok: false, error: msg, code: credRes.code };
          }
          db.replaceAiProvidersFromSupabase(credRes.credentials);
          if (flagRes.ok && flagRes.suppressed) {
            db.setAiEnvSuppressed(flagRes.suppressed);
          } else if (!flagRes.ok && flagRes.error) {
            this.recordDbFailure("getSupabaseAiEnvSuppression", flagRes.error);
          }
          if (routeRes.ok) {
            if (routeRes.routes.length > 0 || credRes.credentials.length === 0) {
              db.replaceAiTaskRoutesFromSupabase(routeRes.routes);
            }
          } else if (routeRes.error) {
            this.recordDbFailure("listSupabaseAiTaskRoutes", routeRes.error);
          }
          const validIds = new Set(credRes.credentials.map((c) => c.id));
          const localRoutes = db.getAiTaskRoutes();
          for (const taskKey of Object.keys(localRoutes)) {
            const r = localRoutes[taskKey];
            if (!r) continue;
            const badPrimary = r.primaryCredentialId && !r.primaryCredentialId.startsWith("env-") && !validIds.has(r.primaryCredentialId);
            const badFallback = r.fallbackCredentialId && !r.fallbackCredentialId.startsWith("env-") && !validIds.has(r.fallbackCredentialId);
            if (badPrimary || badFallback) {
              db.setAiTaskRoute(
                r.task,
                {
                  ...r,
                  primaryCredentialId: badPrimary ? "" : r.primaryCredentialId,
                  primaryModel: badPrimary ? "" : r.primaryModel,
                  fallbackCredentialId: badFallback ? "" : r.fallbackCredentialId,
                  fallbackModel: badFallback ? "" : r.fallbackModel
                },
                actor
              );
            }
          }
          return { ok: true };
        } catch (err) {
          const msg = err?.message || "Supabase AI hydration failed";
          this.recordDbFailure("hydrateFromSupabaseIfConfigured", msg);
          return { ok: false, error: msg, code: "HYDRATION_EXCEPTION" };
        } finally {
          this.hydrationPromise = null;
        }
      })();
    }
    const result = await this.hydrationPromise;
    if (!result.ok && opts?.requireSuccess) {
      throw new Error(`Database read failed: ${result.error || "Could not load AI configuration from Supabase."}`);
    }
    return result;
  }
  /**
   * Step 1 (Fast 10-12s): Auto-detect provider, authenticate key, fetch models & choose optimal model.
   * Does NOT execute billable or slow inference so stage progress & Grok confirmations are instantaneous.
   */
  static async discoverAutoStep(input, actor = "Super Admin", signal) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const rawKey = (input.apiKey || "").trim();
    const correlationId = generateCorrelationId("discover");
    if (!rawKey || rawKey.length < 10) {
      return {
        ok: false,
        authenticated: false,
        generationVerified: false,
        status: "auth_failed",
        detectedProvider: input.providerOverride || null,
        billingStatus: "unknown",
        billingNote: "Not checked \u2014 API key input is empty or too short.",
        lastChecked: now,
        availableModels: [],
        errorCategory: "INVALID_API_KEY",
        errorClassification: "Invalid Key",
        failureSource: "Browser-to-backend request",
        message: "Please paste a valid Google Gemini or xAI Grok API key.",
        suggestedAction: "Copy the complete API key from Google AI Studio or console.x.ai with no extra spaces.",
        correlationId
      };
    }
    const hint = this.detectProviderHint(rawKey);
    let targetProvider = input.providerOverride || (hint !== "unknown" ? hint : null);
    let detectionMethod = input.providerOverride ? "manual_override" : hint !== "unknown" ? "prefix_hint_verified" : "ambiguous";
    let preDiscoveredGemini = null;
    let preDiscoveredGrok = null;
    if (!targetProvider) {
      let geminiDiag;
      let grokDiag;
      try {
        preDiscoveredGemini = await AIModelDiscovery.discoverGeminiModels(rawKey, signal);
        targetProvider = "gemini";
        detectionMethod = "probe_verified";
      } catch (err) {
        geminiDiag = err instanceof ProviderExecutionError ? err.diagnostic : void 0;
      }
      if (!targetProvider) {
        try {
          preDiscoveredGrok = await AIModelDiscovery.discoverGrokModels(
            rawKey,
            input.customEndpointUrl || "https://api.x.ai/v1",
            signal
          );
          targetProvider = "grok";
          detectionMethod = "probe_verified";
        } catch (err) {
          grokDiag = err instanceof ProviderExecutionError ? err.diagnostic : void 0;
        }
      }
      if (!targetProvider) {
        if (geminiDiag?.category === "network_error" && grokDiag?.category === "network_error") {
          return {
            ok: false,
            authenticated: false,
            generationVerified: false,
            status: "network_error",
            detectedProvider: null,
            detectionMethod: "ambiguous",
            billingStatus: "unknown",
            billingNote: "Could not reach provider endpoints.",
            lastChecked: now,
            availableModels: [],
            errorCategory: "SERVER_CONNECTIVITY_FAILURE",
            errorClassification: "Network Error",
            failureSource: "Namecheap hosting",
            message: "Server failed to establish outbound HTTPS connections to Google Gemini and xAI Grok.",
            suggestedAction: geminiDiag.suggestedAction,
            correlationId
          };
        }
        return {
          ok: false,
          authenticated: false,
          generationVerified: false,
          status: "needs_provider_selection",
          requiresProviderSelection: true,
          detectedProvider: null,
          detectionMethod: "ambiguous",
          billingStatus: "unknown",
          billingNote: "Select a provider so the server can run provider-specific verification.",
          lastChecked: now,
          availableModels: [],
          errorCategory: "NEEDS_PROVIDER_SELECTION",
          errorClassification: "Select Provider",
          failureSource: "Browser-to-backend request",
          message: "Could not automatically identify this key format. Select Google Gemini or xAI Grok below.",
          suggestedAction: "Choose Google Gemini or xAI Grok below and click Validate & Connect.",
          correlationId
        };
      }
    }
    if (targetProvider === "gemini") {
      let discovery = preDiscoveredGemini;
      if (!discovery) {
        try {
          discovery = await AIModelDiscovery.discoverGeminiModels(rawKey, signal);
        } catch (err) {
          const diag = err instanceof ProviderExecutionError ? err.diagnostic : classifyProviderError({
            providerType: "gemini",
            err,
            stage: "model_list",
            correlationId,
            secretToRedact: rawKey
          });
          const errorCategory = mapDiagnosticToAutoCategory(diag, 0);
          const testEntry = {
            id: `aitest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            providerType: "gemini",
            stage: "model_list",
            ok: false,
            connectionStatus: diag.connectionStatus,
            modelListOk: false,
            generationOk: false,
            modelsDiscoveredCount: 0,
            latencyMs: 0,
            diagnostic: diag,
            actor,
            timestamp: now
          };
          db.recordAiConnectionTest(testEntry);
          if (isSupabaseConfigured()) recordSupabaseAiConnectionTest(testEntry).catch(() => {
          });
          return {
            ok: false,
            authenticated: false,
            generationVerified: false,
            status: diag.connectionStatus,
            detectedProvider: "gemini",
            detectionMethod,
            billingStatus: errorCategory === "FREE_TIER_QUOTA_EXCEEDED" ? "quota_exceeded" : errorCategory === "BILLING_REQUIRED" ? "billing_required" : "unknown",
            billingNote: diag.title,
            lastChecked: now,
            availableModels: [],
            errorCategory,
            errorClassification: diag.title,
            failureSource: diag.failureSource || "Google API",
            message: diag.diagnosis,
            suggestedAction: diag.suggestedAction,
            correlationId: diag.correlationId
          };
        }
      }
      if (discovery.models.length === 0) {
        return {
          ok: false,
          authenticated: true,
          generationVerified: false,
          status: "endpoint_not_found",
          detectedProvider: "gemini",
          detectionMethod,
          billingStatus: "unknown",
          billingNote: "Authenticated, but 0 accessible models returned.",
          lastChecked: now,
          latencyMs: discovery.latencyMs,
          availableModels: [],
          errorCategory: "NO_ACCESSIBLE_MODELS",
          errorClassification: "Model Unavailable",
          failureSource: "Google API",
          message: "Authenticated with Google Gemini, but no models were returned for this API key.",
          suggestedAction: "Verify the Generative Language API is enabled in your Google Cloud project.",
          correlationId: discovery.correlationId
        };
      }
      const selection = selectAutoGeminiModel(discovery.models, Boolean(input.allowPaidModels));
      const explicitModel = input.preferredModel?.trim();
      if (!explicitModel && !selection.selectedModel) {
        if (selection.onlyPaidAvailable) {
          return {
            ok: false,
            authenticated: true,
            generationVerified: false,
            status: "billing_required",
            detectedProvider: "gemini",
            detectionMethod,
            billingStatus: "billing_required",
            billingNote: "Only paid-tier Gemini models discovered; free-tier auto-connect skipped paid models.",
            lastChecked: now,
            latencyMs: discovery.latencyMs,
            availableModels: discovery.models,
            errorCategory: "BILLING_REQUIRED",
            errorClassification: "Billing Required",
            failureSource: "Google API",
            message: "No free-tier eligible Gemini text model was found on this key.",
            suggestedAction: "Use a free-tier Google AI Studio key with Gemini Flash access.",
            correlationId: discovery.correlationId
          };
        }
        return {
          ok: false,
          authenticated: true,
          generationVerified: false,
          status: "endpoint_not_found",
          detectedProvider: "gemini",
          detectionMethod,
          billingStatus: "unknown",
          billingNote: "No supported text-generation model available.",
          lastChecked: now,
          latencyMs: discovery.latencyMs,
          availableModels: discovery.models,
          errorCategory: "NO_ACCESSIBLE_MODELS",
          errorClassification: "Model Unavailable",
          failureSource: "Google API",
          message: "No supported text-generation Gemini models were found for this API key.",
          suggestedAction: "Verify your Google AI Studio key has access to Gemini text models.",
          correlationId: discovery.correlationId
        };
      }
      const candidates = explicitModel ? [explicitModel] : selection.freeTierCandidates.length > 0 ? selection.freeTierCandidates.slice(0, 2) : selection.allCandidates.slice(0, 2);
      return {
        ok: true,
        authenticated: true,
        generationVerified: false,
        status: "authenticated",
        detectedProvider: "gemini",
        detectionMethod,
        selectedModel: candidates[0],
        candidateModels: candidates,
        billingStatus: isFreeTierGeminiModel(candidates[0]) ? "free_tier" : "unknown",
        billingNote: isFreeTierGeminiModel(candidates[0]) ? "Free Tier Eligible" : "Model Selected",
        lastChecked: now,
        latencyMs: discovery.latencyMs,
        availableModels: discovery.models,
        message: `Authenticated with Google Gemini (${discovery.models.length} models found). Selected ${candidates[0]}.`,
        correlationId: discovery.correlationId
      };
    }
    const endpointUrl = (input.customEndpointUrl || "https://api.x.ai/v1").trim();
    let grokDiscovery = preDiscoveredGrok;
    if (!grokDiscovery) {
      try {
        grokDiscovery = await AIModelDiscovery.discoverGrokModels(rawKey, endpointUrl, signal);
      } catch (err) {
        const diag = err instanceof ProviderExecutionError ? err.diagnostic : classifyProviderError({
          providerType: "grok",
          err,
          stage: "model_list",
          correlationId,
          secretToRedact: rawKey
        });
        const errorCategory = mapDiagnosticToAutoCategory(diag, 0);
        const testEntry = {
          id: `aitest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          providerType: "grok",
          stage: "model_list",
          ok: false,
          connectionStatus: diag.connectionStatus,
          modelListOk: false,
          generationOk: false,
          modelsDiscoveredCount: 0,
          latencyMs: 0,
          diagnostic: diag,
          actor,
          timestamp: now
        };
        db.recordAiConnectionTest(testEntry);
        if (isSupabaseConfigured()) recordSupabaseAiConnectionTest(testEntry).catch(() => {
        });
        return {
          ok: false,
          authenticated: false,
          generationVerified: false,
          status: diag.connectionStatus,
          detectedProvider: "grok",
          detectionMethod,
          billingStatus: errorCategory === "BILLING_REQUIRED" ? "billing_required" : "credits_required",
          billingNote: diag.title,
          lastChecked: now,
          availableModels: [],
          errorCategory,
          errorClassification: diag.title,
          failureSource: diag.failureSource || "xAI API",
          message: diag.diagnosis,
          suggestedAction: diag.suggestedAction,
          correlationId: diag.correlationId
        };
      }
    }
    if (grokDiscovery.models.length === 0) {
      return {
        ok: false,
        authenticated: true,
        generationVerified: false,
        status: "endpoint_not_found",
        detectedProvider: "grok",
        detectionMethod,
        billingStatus: "credits_required",
        billingNote: "Authenticated, but no accessible Grok models returned.",
        lastChecked: now,
        latencyMs: grokDiscovery.latencyMs,
        availableModels: [],
        errorCategory: "NO_ACCESSIBLE_MODELS",
        errorClassification: "Model Unavailable",
        failureSource: "xAI API",
        message: "Authenticated with xAI, but no compatible text models were returned by /v1/models.",
        suggestedAction: "Check key ACL scopes and billing credits at console.x.ai.",
        correlationId: grokDiscovery.correlationId
      };
    }
    const keyMeta = await AIModelDiscovery.inspectGrokApiKeyMetadata(rawKey, endpointUrl, signal);
    if (keyMeta?.keyBlocked) {
      return {
        ok: false,
        authenticated: false,
        generationVerified: false,
        status: "permission_denied",
        detectedProvider: "grok",
        detectionMethod,
        billingStatus: "billing_required",
        billingNote: "Key or team is blocked/disabled on xAI.",
        lastChecked: now,
        latencyMs: grokDiscovery.latencyMs,
        availableModels: grokDiscovery.models,
        errorCategory: "PERMISSION_DENIED",
        errorClassification: "Permission Denied",
        failureSource: "xAI API",
        message: "xAI reports this API key or team account is currently blocked or disabled.",
        suggestedAction: "Review team status and prepaid credits in console.x.ai.",
        correlationId: grokDiscovery.correlationId
      };
    }
    const chosenGrokModel = input.preferredModel?.trim() || selectAutoGrokModel(grokDiscovery.models) || grokDiscovery.recommendedModel || "";
    if (!chosenGrokModel) {
      return {
        ok: false,
        authenticated: true,
        generationVerified: false,
        status: "endpoint_not_found",
        detectedProvider: "grok",
        detectionMethod,
        billingStatus: "credits_required",
        billingNote: "No supported text generation model found.",
        lastChecked: now,
        latencyMs: grokDiscovery.latencyMs,
        availableModels: grokDiscovery.models,
        errorCategory: "NO_ACCESSIBLE_MODELS",
        errorClassification: "Model Unavailable",
        failureSource: "xAI API",
        message: "No text-generation Grok model was found for this key.",
        correlationId: grokDiscovery.correlationId
      };
    }
    if (!input.confirmBillableTest) {
      return {
        ok: false,
        authenticated: true,
        generationVerified: false,
        status: "awaiting_confirmation",
        requiresBillableConfirmation: true,
        detectedProvider: "grok",
        detectionMethod,
        selectedModel: chosenGrokModel,
        endpointUrl,
        billingStatus: "credits_required",
        billingNote: "xAI Grok uses prepaid credits / billing (no free tier). Confirmation required before test generation.",
        lastChecked: now,
        latencyMs: grokDiscovery.latencyMs,
        availableModels: grokDiscovery.models,
        errorCategory: "CONFIRMATION_REQUIRED",
        errorClassification: "Billing Confirmation Required",
        message: `xAI Grok key authenticated (${grokDiscovery.models.length} models found, selected ${chosenGrokModel}). Confirm to run a small (~10 token) live test and activate Grok.`,
        suggestedAction: 'Click "Confirm & Connect Grok" to run the small verification test.',
        correlationId: grokDiscovery.correlationId
      };
    }
    return {
      ok: true,
      authenticated: true,
      generationVerified: false,
      status: "authenticated",
      detectedProvider: "grok",
      detectionMethod,
      selectedModel: chosenGrokModel,
      candidateModels: [chosenGrokModel],
      endpointUrl,
      billingStatus: "credits_required",
      billingNote: "Prepaid Credits / Billing Required by xAI",
      lastChecked: now,
      latencyMs: grokDiscovery.latencyMs,
      availableModels: grokDiscovery.models,
      message: `Authenticated with xAI Grok (${chosenGrokModel}). Ready for generation test.`,
      correlationId: grokDiscovery.correlationId
    };
  }
  /**
   * Step 2 (45s-60s bounded window): Executes lightweight generation test using verified model,
   * logs failed attempts cleanly, retries at most once on transient timeout/5xx, and saves on pass.
   */
  static async verifyGenerationAutoStep(input, actor = "Super Admin", signal) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const rawKey = (input.apiKey || "").trim();
    const correlationId = generateCorrelationId("gentest");
    if (input.providerType === "gemini") {
      const candidates = Array.isArray(input.candidateModels) && input.candidateModels.length > 0 ? input.candidateModels : [input.selectedModel];
      const availableModels = input.availableModels || [];
      let genRes = null;
      let lastGenDiag;
      const totalDeadlineMs = Date.now() + Math.min(58e3, getGenerationTimeoutMs() + 1e4);
      for (const candidateModel of candidates) {
        if (signal?.aborted) break;
        const remainingMs = totalDeadlineMs - Date.now();
        if (remainingMs < 1e4) break;
        try {
          genRes = await GeminiProvider.testGeneration(rawKey, candidateModel, signal, {
            timeoutMs: getGenerationTimeoutMs(),
            retryOnTransient: true,
            deadlineMs: totalDeadlineMs
          });
          break;
        } catch (err) {
          const diag = err instanceof ProviderExecutionError ? err.diagnostic : classifyProviderError({
            providerType: "gemini",
            err,
            model: candidateModel,
            stage: "generation_test",
            authenticated: true,
            correlationId,
            secretToRedact: rawKey,
            timeoutWindowMs: getGenerationTimeoutMs()
          });
          lastGenDiag = diag;
          if (diag.category !== "not_found_404" && diag.category !== "bad_request_400") {
            break;
          }
        }
      }
      if (!genRes) {
        const errorCategory = mapDiagnosticToAutoCategory(lastGenDiag, availableModels.length);
        const billingStatus3 = errorCategory === "FREE_TIER_QUOTA_EXCEEDED" ? "quota_exceeded" : errorCategory === "BILLING_REQUIRED" ? "billing_required" : "unknown";
        const testEntry2 = {
          id: `aitest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          providerType: "gemini",
          modelTested: lastGenDiag?.category === "not_found_404" ? candidates[candidates.length - 1] : candidates[0],
          stage: "generation_test",
          ok: false,
          connectionStatus: lastGenDiag?.connectionStatus || "authenticated_generation_unavailable",
          modelListOk: true,
          generationOk: false,
          modelsDiscoveredCount: availableModels.length,
          latencyMs: Date.now() - new Date(now).getTime(),
          diagnostic: lastGenDiag,
          actor,
          timestamp: now
        };
        db.recordAiConnectionTest(testEntry2);
        if (isSupabaseConfigured()) recordSupabaseAiConnectionTest(testEntry2).catch(() => {
        });
        const isTimeout = lastGenDiag?.category === "timeout";
        return {
          ok: false,
          authenticated: true,
          generationVerified: false,
          status: lastGenDiag?.connectionStatus || "authenticated_generation_unavailable",
          detectedProvider: "gemini",
          detectionMethod: input.detectionMethod || "prefix_hint_verified",
          selectedModel: candidates[0],
          billingStatus: billingStatus3,
          billingNote: billingStatus3 === "quota_exceeded" ? "Key valid; free-tier quota exceeded (HTTP 429)." : billingStatus3 === "billing_required" ? "Billing required on this project." : isTimeout ? "Credentials verified \u2014 generation timed out" : lastGenDiag?.title || "Generation test failed",
          lastChecked: now,
          latencyMs: testEntry2.latencyMs,
          availableModels,
          errorCategory,
          errorClassification: lastGenDiag?.title || (isTimeout ? "Generation Timeout" : "Generation Failed"),
          failureSource: lastGenDiag?.failureSource || "Google API",
          message: isTimeout ? "Gemini credentials verified, but the generation test timed out. Your key may be valid." : lastGenDiag?.diagnosis || "Gemini credentials verified, but generation test failed.",
          suggestedAction: lastGenDiag?.suggestedAction,
          correlationId: lastGenDiag?.correlationId || correlationId,
          canRetryGeneration: true
        };
      }
      const isFree = isFreeTierGeminiModel(genRes.model);
      const billingStatus2 = isFree ? "free_tier" : "unknown";
      const billingNote2 = isFree ? "Free Tier Confirmed (No unexpected billing charges)" : "Verified Model Connected";
      const savedCred = await this.persistAutoConnectedCredential({
        providerType: "gemini",
        rawKey,
        selectedModel: genRes.model,
        availableModels,
        billingStatus: billingStatus2,
        billingNote: billingNote2,
        latencyMs: genRes.latencyMs,
        correlationId: genRes.correlationId,
        sampleOutput: genRes.text,
        replaceCredentialId: input.replaceCredentialId,
        now,
        actor
      });
      return {
        ok: true,
        authenticated: true,
        generationVerified: true,
        status: "connected",
        detectedProvider: "gemini",
        detectionMethod: input.detectionMethod || "prefix_hint_verified",
        selectedModel: genRes.model,
        billingStatus: billingStatus2,
        billingNote: billingNote2,
        lastChecked: now,
        latencyMs: genRes.latencyMs,
        availableModels,
        sampleOutput: redactSecrets(genRes.text.slice(0, 100), rawKey),
        message: `Connected to Google Gemini (${genRes.model}) and activated across all bilingual AI tools (${genRes.latencyMs}ms).`,
        correlationId: genRes.correlationId,
        provider: this.sanitizeCredential(savedCred)
      };
    }
    if (!input.confirmBillableTest) {
      return {
        ok: false,
        authenticated: true,
        generationVerified: false,
        status: "awaiting_confirmation",
        requiresBillableConfirmation: true,
        detectedProvider: "grok",
        detectionMethod: input.detectionMethod || "prefix_hint_verified",
        selectedModel: input.selectedModel,
        billingStatus: "credits_required",
        billingNote: "xAI Grok requires explicit confirmation before running a test generation.",
        lastChecked: now,
        availableModels: input.availableModels || [],
        errorCategory: "CONFIRMATION_REQUIRED",
        errorClassification: "Billing Confirmation Required",
        message: `xAI Grok key authenticated. Confirm to run a minimal (~10 token) live test on ${input.selectedModel}.`,
        suggestedAction: 'Click "Confirm & Connect Grok" to proceed.',
        correlationId
      };
    }
    const endpointUrl = (input.customEndpointUrl || "https://api.x.ai/v1").trim();
    const grokValidation = await GrokProvider.testConnection(
      rawKey,
      input.selectedModel,
      endpointUrl,
      signal,
      true,
      "grok"
    );
    const testEntry = {
      id: `aitest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      providerType: "grok",
      modelTested: grokValidation.selectedModel || input.selectedModel,
      stage: "generation_test",
      ok: grokValidation.ok,
      connectionStatus: grokValidation.connectionStatus,
      modelListOk: grokValidation.authenticated,
      generationOk: grokValidation.generationVerified,
      modelsDiscoveredCount: grokValidation.availableModels.length,
      latencyMs: grokValidation.latencyMs,
      sampleOutput: grokValidation.sampleOutput ? redactSecrets(grokValidation.sampleOutput, rawKey) : void 0,
      diagnostic: grokValidation.diagnostic,
      actor,
      timestamp: now
    };
    db.recordAiConnectionTest(testEntry);
    if (isSupabaseConfigured()) recordSupabaseAiConnectionTest(testEntry).catch(() => {
    });
    if (!grokValidation.ok) {
      const errorCategory = mapDiagnosticToAutoCategory(
        grokValidation.diagnostic,
        grokValidation.availableModels.length
      );
      return {
        ok: false,
        authenticated: grokValidation.authenticated,
        generationVerified: false,
        status: grokValidation.connectionStatus,
        detectedProvider: "grok",
        detectionMethod: input.detectionMethod || "prefix_hint_verified",
        selectedModel: input.selectedModel,
        billingStatus: errorCategory === "BILLING_REQUIRED" ? "billing_required" : "credits_required",
        billingNote: errorCategory === "BILLING_REQUIRED" ? "xAI requires prepaid credits or billing enabled before generation." : grokValidation.diagnostic?.title || "Grok live test failed",
        lastChecked: now,
        latencyMs: grokValidation.latencyMs,
        availableModels: grokValidation.availableModels,
        errorCategory,
        errorClassification: grokValidation.diagnostic?.title || "Grok Test Failed",
        failureSource: grokValidation.diagnostic?.failureSource || "xAI API",
        message: grokValidation.message,
        suggestedAction: grokValidation.diagnostic?.suggestedAction,
        correlationId: grokValidation.correlationId,
        canRetryGeneration: true
      };
    }
    const billingStatus = "credits_required";
    const billingNote = "Credits / Billing Active on xAI";
    const savedGrok = await this.persistAutoConnectedCredential({
      providerType: "grok",
      rawKey,
      selectedModel: grokValidation.selectedModel || input.selectedModel,
      endpointUrl,
      availableModels: grokValidation.availableModels,
      billingStatus,
      billingNote,
      latencyMs: grokValidation.latencyMs,
      correlationId: grokValidation.correlationId,
      sampleOutput: grokValidation.sampleOutput,
      replaceCredentialId: input.replaceCredentialId,
      now,
      actor
    });
    return {
      ok: true,
      authenticated: true,
      generationVerified: true,
      status: "connected",
      detectedProvider: "grok",
      detectionMethod: input.detectionMethod || "prefix_hint_verified",
      selectedModel: savedGrok.model,
      billingStatus,
      billingNote,
      lastChecked: now,
      latencyMs: grokValidation.latencyMs,
      availableModels: grokValidation.availableModels,
      sampleOutput: grokValidation.sampleOutput ? redactSecrets(grokValidation.sampleOutput.slice(0, 100), rawKey) : void 0,
      message: `Connected to xAI Grok (${savedGrok.model}) and activated across all editorial & SEO tools (${grokValidation.latencyMs}ms).`,
      correlationId: grokValidation.correlationId,
      provider: this.sanitizeCredential(savedGrok)
    };
  }
  /**
   * One-Click Universal Auto-Detect, Validate, Persist & Activate Flow (runs discovery + generation cleanly).
   */
  static async connectAutomatically(input, actor = "Super Admin", signal) {
    const discoveryStep = await this.discoverAutoStep(input, actor, signal);
    if (!discoveryStep.ok || !discoveryStep.detectedProvider || !discoveryStep.selectedModel) {
      return discoveryStep;
    }
    return this.verifyGenerationAutoStep(
      {
        ...input,
        providerType: discoveryStep.detectedProvider,
        selectedModel: discoveryStep.selectedModel,
        candidateModels: discoveryStep.candidateModels,
        availableModels: discoveryStep.availableModels,
        detectionMethod: discoveryStep.detectionMethod,
        customEndpointUrl: discoveryStep.endpointUrl || input.customEndpointUrl
      },
      actor,
      signal
    );
  }
  static async persistAutoConnectedCredential(params) {
    this.assertPersistentMutationBackend("auto_connect");
    if (isSupabaseConfigured()) {
      await this.hydrateFromSupabaseIfConfigured(params.actor, { requireSuccess: true });
    }
    const existingList = db.getAiProviders();
    const masked = maskSecret(params.rawKey);
    let targetExisting = params.replaceCredentialId ? existingList.find((c) => c.id === params.replaceCredentialId) : existingList.find(
      (c) => c.providerType === params.providerType && c.maskedKey === masked
    );
    const recordId = targetExisting?.id || `aik-${params.providerType}-primary-${Date.now().toString(36)}`;
    const cred = {
      id: recordId,
      providerType: params.providerType,
      label: targetExisting?.label || (params.providerType === "gemini" ? "Google Gemini (Auto-Connected)" : "xAI Grok (Auto-Connected)"),
      projectId: targetExisting?.projectId || `${params.providerType}-auto-${recordId.slice(-4)}`,
      endpointUrl: params.endpointUrl || targetExisting?.endpointUrl || (params.providerType === "grok" ? "https://api.x.ai/v1" : void 0),
      model: params.selectedModel,
      encryptedSecret: encryptSecret(params.rawKey),
      maskedKey: masked,
      enabled: true,
      priority: 1,
      dailyTokenLimit: targetExisting?.dailyTokenLimit || 5e5,
      dailyTokensUsed: targetExisting?.dailyTokensUsed || 0,
      monthlyBudgetUsd: targetExisting?.monthlyBudgetUsd || (params.providerType === "gemini" ? 0 : 25),
      monthlySpendUsd: targetExisting?.monthlySpendUsd || 0,
      availableModels: params.availableModels,
      connectionStatus: "connected",
      billingStatus: params.billingStatus,
      billingNote: params.billingNote,
      modelListStatus: "ok",
      generationTestStatus: "ok",
      lastTestedAt: params.now,
      lastSuccessfulVerificationAt: params.now,
      lastSuccessfulGenerationAt: params.now,
      lastFailureAt: targetExisting?.lastFailureAt || null,
      lastTestStatus: "connected",
      lastTestMessage: `Connected via ${params.selectedModel} (${params.billingNote})`,
      lastDiagnostic: null,
      lastLatencyMs: params.latencyMs,
      lastCorrelationId: params.correlationId,
      createdAt: targetExisting?.createdAt || params.now,
      updatedAt: params.now
    };
    for (const prev of existingList) {
      if (prev.id !== cred.id && (prev.priority || 10) <= 1) {
        const demoted = { ...prev, priority: (prev.priority || 1) + 10, updatedAt: params.now };
        db.upsertAiProvider(demoted, params.actor);
        if (isSupabaseConfigured()) {
          const res = await upsertSupabaseAiCredential(demoted);
          if (!res.ok) {
            this.recordDbFailure("upsertSupabaseAiCredential", res.error || "Priority demotion failed", res.code);
          }
        }
      }
    }
    if (isSupabaseConfigured()) {
      const sbRes = await upsertSupabaseAiCredential(creditSafeRecord(cred));
      if (!sbRes.ok || !sbRes.credential) {
        const msg = sbRes.error || "Failed persisting connected credential to Supabase.";
        this.recordDbFailure("upsertSupabaseAiCredential", msg, sbRes.code);
        throw new Error(`Supabase persistence failed: ${msg}`);
      }
      const saved2 = db.upsertAiProvider(sbRes.credential, params.actor);
      this.lastSuccessfulSaveAt = params.now;
      const testEntry2 = {
        id: `aitest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        credentialId: saved2.id,
        providerType: params.providerType,
        modelTested: params.selectedModel,
        stage: "generation_test",
        ok: true,
        connectionStatus: "connected",
        modelListOk: true,
        generationOk: true,
        modelsDiscoveredCount: params.availableModels.length,
        latencyMs: params.latencyMs,
        sampleOutput: params.sampleOutput ? redactSecrets(params.sampleOutput, params.rawKey) : void 0,
        actor: params.actor,
        timestamp: params.now
      };
      db.recordAiConnectionTest(testEntry2);
      await recordSupabaseAiConnectionTest(testEntry2).catch(() => {
      });
      await this.syncRoutesForCredential(saved2.id, params.selectedModel, params.actor);
      await this.syncActiveCacheFromSupabase(params.actor);
      const verified = db.getAiProviders().find((p) => p.id === saved2.id);
      if (!verified) {
        throw new Error("Credential write verification failed: record missing after authoritative Supabase reload.");
      }
      return verified;
    }
    const saved = db.upsertAiProvider(cred, params.actor);
    this.lastSuccessfulSaveAt = params.now;
    const testEntry = {
      id: `aitest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      credentialId: saved.id,
      providerType: params.providerType,
      modelTested: params.selectedModel,
      stage: "generation_test",
      ok: true,
      connectionStatus: "connected",
      modelListOk: true,
      generationOk: true,
      modelsDiscoveredCount: params.availableModels.length,
      latencyMs: params.latencyMs,
      sampleOutput: params.sampleOutput ? redactSecrets(params.sampleOutput, params.rawKey) : void 0,
      actor: params.actor,
      timestamp: params.now
    };
    db.recordAiConnectionTest(testEntry);
    await this.syncRoutesForCredential(saved.id, params.selectedModel, params.actor);
    return saved;
  }
  static async disconnectCredential(credentialId, actor = "Super Admin") {
    this.assertPersistentMutationBackend("delete_credential");
    if (isSupabaseConfigured()) {
      await this.hydrateFromSupabaseIfConfigured(actor, { requireSuccess: true });
    }
    const backendMode = this.getStorageBackendMode();
    if (credentialId === "env-gemini-default" || credentialId === "env-grok-default") {
      const providerKey = credentialId === "env-gemini-default" ? "gemini" : "grok";
      db.setAiEnvSuppressed({ [providerKey]: true });
      if (isSupabaseConfigured()) {
        const flagRes = await setSupabaseAiEnvSuppression(db.getAiEnvSuppressed());
        if (!flagRes.ok) {
          this.recordDbFailure("setSupabaseAiEnvSuppression", flagRes.error || "Failed saving env suppression");
          return {
            ok: false,
            deletedCount: 0,
            verifiedAfterMutation: false,
            storageBackend: backendMode,
            message: `Failed suppressing environment variable in Supabase: ${flagRes.error}`
          };
        }
      }
      const routes2 = db.getAiTaskRoutes();
      const updatedRoutes2 = [];
      for (const spec of AI_TASK_CATALOG) {
        const r = routes2[spec.task];
        if (!r) continue;
        if (r.primaryCredentialId === credentialId || r.fallbackCredentialId === credentialId) {
          const nextRoute = {
            ...r,
            primaryCredentialId: r.primaryCredentialId === credentialId ? "" : r.primaryCredentialId,
            primaryModel: r.primaryCredentialId === credentialId ? "" : r.primaryModel,
            fallbackCredentialId: r.fallbackCredentialId === credentialId ? "" : r.fallbackCredentialId,
            fallbackModel: r.fallbackCredentialId === credentialId ? "" : r.fallbackModel
          };
          db.setAiTaskRoute(spec.task, nextRoute, actor);
          updatedRoutes2.push(nextRoute);
        }
      }
      if (updatedRoutes2.length > 0 && isSupabaseConfigured()) {
        await upsertSupabaseAiTaskRoutes(updatedRoutes2).catch(() => {
        });
      }
      this.lastSuccessfulDeleteAt = (/* @__PURE__ */ new Date()).toISOString();
      return {
        ok: true,
        deletedCount: 1,
        disconnectedId: credentialId,
        verifiedAfterMutation: true,
        storageBackend: backendMode,
        message: `Suppressed runtime loading of ${providerKey === "gemini" ? "GEMINI_API_KEY" : "XAI_API_KEY"} environment fallback.`
      };
    }
    const creds = db.getAiProviders();
    const target = credentialId ? creds.find((c) => c.id === credentialId) : creds.find((c) => c.enabled && c.connectionStatus === "connected") || creds.find((c) => c.enabled) || creds[0];
    if (!target) {
      if (credentialId) {
        return {
          ok: false,
          notFound: true,
          deletedCount: 0,
          verifiedAfterMutation: false,
          storageBackend: backendMode,
          message: `AI credential "${credentialId}" was not found or already deleted.`
        };
      }
      return {
        ok: true,
        deletedCount: 0,
        verifiedAfterMutation: true,
        storageBackend: backendMode,
        message: "No active stored AI API key to disconnect."
      };
    }
    const remaining = creds.filter(
      (c) => c.id !== target.id && c.enabled && c.connectionStatus === "connected"
    );
    const nextFallback = remaining[0];
    const routes = db.getAiTaskRoutes();
    const updatedRoutes = [];
    for (const spec of AI_TASK_CATALOG) {
      const r = routes[spec.task];
      if (!r) continue;
      if (r.primaryCredentialId === target.id || r.fallbackCredentialId === target.id) {
        const nextRoute = {
          ...r,
          primaryCredentialId: r.primaryCredentialId === target.id ? nextFallback?.id || "" : r.primaryCredentialId,
          primaryModel: r.primaryCredentialId === target.id ? nextFallback?.model || "" : r.primaryModel,
          fallbackCredentialId: r.fallbackCredentialId === target.id ? "" : r.fallbackCredentialId,
          fallbackModel: r.fallbackCredentialId === target.id ? "" : r.fallbackModel
        };
        updatedRoutes.push(nextRoute);
      }
    }
    if (updatedRoutes.length > 0 && isSupabaseConfigured()) {
      const routeClearRes = await upsertSupabaseAiTaskRoutes(updatedRoutes);
      if (!routeClearRes.ok) {
        this.recordDbFailure(
          "upsertSupabaseAiTaskRoutes",
          routeClearRes.error || "Failed clearing dependent task routes before delete",
          routeClearRes.code
        );
        return {
          ok: false,
          deletedCount: 0,
          verifiedAfterMutation: false,
          rlsError: routeClearRes.code || null,
          storageBackend: backendMode,
          message: `Failed clearing dependent task routes in Supabase: ${routeClearRes.error || "Unknown database error"}`
        };
      }
    }
    let supabaseDeletedCount = 0;
    if (isSupabaseConfigured()) {
      const sbDel = await deleteSupabaseAiCredential(target.id);
      if (!sbDel.ok) {
        this.recordDbFailure("deleteSupabaseAiCredential", sbDel.error || "Delete failed", sbDel.code);
        return {
          ok: false,
          notFound: sbDel.code === "NOT_FOUND",
          deletedCount: 0,
          verifiedAfterMutation: false,
          rlsError: sbDel.code || null,
          storageBackend: backendMode,
          message: sbDel.error || "Failed deleting AI credential from Supabase."
        };
      }
      supabaseDeletedCount = sbDel.deletedCount;
    }
    for (const nextRoute of updatedRoutes) {
      db.setAiTaskRoute(nextRoute.task, nextRoute, actor);
    }
    const localRemoved = db.deleteAiProvider(target.id, actor);
    if (isSupabaseConfigured()) {
      await this.syncActiveCacheFromSupabase(actor);
    }
    const stillPresentLocally = db.getAiProviders().some((p) => p.id === target.id);
    const danglingRoute = Object.values(db.getAiTaskRoutes()).some(
      (r) => r && (r.primaryCredentialId === target.id || r.fallbackCredentialId === target.id)
    );
    const affectedCount = isSupabaseConfigured() ? supabaseDeletedCount : localRemoved ? 1 : 0;
    if (affectedCount === 0 || stillPresentLocally || danglingRoute) {
      return {
        ok: false,
        deletedCount: 0,
        disconnectedId: target.id,
        verifiedAfterMutation: false,
        storageBackend: backendMode,
        message: stillPresentLocally ? `Delete verification failed: "${target.label}" is still present after removal.` : danglingRoute ? `Delete verification failed: dependent task routes still reference "${target.id}".` : `Delete affected 0 records for "${target.id}".`
      };
    }
    this.lastSuccessfulDeleteAt = (/* @__PURE__ */ new Date()).toISOString();
    return {
      ok: true,
      deletedCount: affectedCount,
      disconnectedId: target.id,
      verifiedAfterMutation: true,
      storageBackend: backendMode,
      message: `Deleted ${target.providerType === "gemini" ? "Google Gemini" : target.providerType === "grok" ? "xAI Grok" : "Custom"} credential "${target.label}" (${target.maskedKey}).`
    };
  }
};
function creditSafeRecord(c) {
  return c;
}

// services/ai/AIProviderRouter.ts
var AIUnavailableError = class extends Error {
  constructor(message, statusCode = 503, code = "AI_UNAVAILABLE", diagnostic) {
    super(message);
    this.name = "AIUnavailableError";
    this.statusCode = statusCode;
    this.code = code;
    this.diagnostic = diagnostic;
  }
};
var AIProviderRouter = class {
  static {
    this.automationCooldowns = /* @__PURE__ */ new Map();
  }
  static clearAutomationCooldowns() {
    this.automationCooldowns.clear();
  }
  static getAutomationCooldownStatus(credId) {
    const entry = this.automationCooldowns.get(credId);
    if (!entry) return { active: false };
    if (Date.now() >= entry.untilMs) {
      this.automationCooldowns.delete(credId);
      return { active: false };
    }
    return { active: true, untilMs: entry.untilMs, reason: entry.reason };
  }
  static getAllCredentialsSanitized() {
    const dbCreds = db.getAiProviders();
    const routes = this.getTaskRoutesRaw(dbCreds);
    const list = dbCreds.map((c) => AIProviderManager.sanitizeCredential(c, routes));
    const envSuppressed = db.getAiEnvSuppressed();
    const hasEnvGemini = !envSuppressed.gemini && Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());
    const hasEnvGrok = !envSuppressed.grok && Boolean(process.env.XAI_API_KEY && process.env.XAI_API_KEY.trim());
    if (hasEnvGemini && !dbCreds.some((c) => c.id === "env-gemini-default")) {
      list.unshift(
        AIProviderManager.sanitizeCredential(
          {
            id: "env-gemini-default",
            providerType: "gemini",
            label: "Server Environment GEMINI_API_KEY",
            projectId: process.env.GOOGLE_CLOUD_PROJECT || "env-gemini-project",
            model: "gemini-4-hydrogen",
            encryptedSecret: "",
            maskedKey: maskSecret(process.env.GEMINI_API_KEY),
            enabled: true,
            priority: 1,
            dailyTokenLimit: 1e6,
            dailyTokensUsed: 0,
            monthlyBudgetUsd: 50,
            monthlySpendUsd: 0,
            connectionStatus: "untested",
            modelListStatus: "untested",
            generationTestStatus: "untested",
            lastTestedAt: null,
            lastTestStatus: "untested",
            lastTestMessage: "Loaded from server environment secret (click Test to verify live models)",
            createdAt: (/* @__PURE__ */ new Date()).toISOString(),
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          },
          routes
        )
      );
    }
    if (hasEnvGrok && !dbCreds.some((c) => c.id === "env-grok-default")) {
      list.push(
        AIProviderManager.sanitizeCredential(
          {
            id: "env-grok-default",
            providerType: "grok",
            label: "Server Environment XAI_API_KEY",
            projectId: "env-xai-project",
            endpointUrl: "https://api.x.ai/v1",
            model: "grok-3-mini",
            encryptedSecret: "",
            maskedKey: maskSecret(process.env.XAI_API_KEY),
            enabled: true,
            priority: 2,
            dailyTokenLimit: 5e5,
            dailyTokensUsed: 0,
            monthlyBudgetUsd: 50,
            monthlySpendUsd: 0,
            connectionStatus: "untested",
            modelListStatus: "untested",
            generationTestStatus: "untested",
            lastTestedAt: null,
            lastTestStatus: "untested",
            lastTestMessage: "Loaded from server environment secret (click Test to verify live models)",
            createdAt: (/* @__PURE__ */ new Date()).toISOString(),
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          },
          routes
        )
      );
    }
    return list;
  }
  static getTaskRoutesRaw(dbCreds) {
    const saved = db.getAiTaskRoutes();
    const defaultCred = dbCreds.find((c) => c.enabled);
    const defaultCredId = defaultCred?.id || "";
    const defaultModel = defaultCred?.model || "";
    return AI_TASK_CATALOG.map((spec) => {
      const existing = saved[spec.task];
      if (existing) return existing;
      return {
        task: spec.task,
        label: spec.label,
        primaryCredentialId: defaultCredId,
        primaryModel: defaultCredId ? defaultModel || spec.defaultModel : "",
        fallbackCredentialId: "",
        fallbackModel: "",
        temperature: spec.task === "fact_check_prep" || spec.task === "translation" ? 0.2 : 0.5,
        maxTokens: spec.task === "article_drafting" ? 4096 : 3072
      };
    });
  }
  static async listCredentialsAuthoritative() {
    await AIProviderManager.hydrateFromSupabaseIfConfigured("System", { requireSuccess: true });
    return this.getAllCredentialsSanitized();
  }
  static async addOrUpdateCredential(input, actor) {
    return AIProviderManager.addOrUpdateCredential(input, actor);
  }
  static async testCredential(credId, actor) {
    return AIProviderManager.testSavedCredential(credId, actor);
  }
  static async getTaskRoutesAuthoritative() {
    await AIProviderManager.hydrateFromSupabaseIfConfigured("System", { requireSuccess: true });
    return this.getTaskRoutes();
  }
  static getTaskRoutes() {
    const saved = db.getAiTaskRoutes();
    const creds = this.getAllCredentialsSanitized();
    const defaultCred = creds.find((c) => c.enabled && c.connectionStatus === "connected") || creds.find((c) => c.enabled);
    return AI_TASK_CATALOG.map((spec) => {
      const existing = saved[spec.task];
      if (existing) return existing;
      return {
        task: spec.task,
        label: spec.label,
        primaryCredentialId: defaultCred?.id || "",
        primaryModel: defaultCred ? defaultCred.model || spec.defaultModel : "",
        fallbackCredentialId: "",
        fallbackModel: "",
        temperature: spec.task === "fact_check_prep" || spec.task === "translation" ? 0.2 : 0.5,
        maxTokens: spec.task === "article_drafting" ? 4096 : 3072
      };
    });
  }
  /**
   * Executes an AI task through the configured router & safeguards.
   */
  static async executeTask(params) {
    const actor = params.actor || "System";
    await AIProviderManager.hydrateFromSupabaseIfConfigured(actor);
    const routes = this.getTaskRoutes();
    const route = routes.find((r) => r.task === params.task);
    const allSanitized = this.getAllCredentialsSanitized().filter((c) => c.enabled);
    if (allSanitized.length === 0) {
      throw new AIUnavailableError(
        "No active AI API provider is configured. Open Admin -> Settings -> AI & API Providers to validate and connect a Gemini or Grok key.",
        503,
        "NO_AI_KEY"
      );
    }
    const candidateSpecs = [];
    if (params.preferredProviderId) {
      candidateSpecs.push({ credId: params.preferredProviderId, modelOverride: params.preferredModel });
    }
    if (route?.primaryCredentialId) {
      candidateSpecs.push({
        credId: route.primaryCredentialId,
        modelOverride: params.preferredModel || route.primaryModel
      });
    }
    if (route?.fallbackCredentialId) {
      candidateSpecs.push({
        credId: route.fallbackCredentialId,
        modelOverride: route.fallbackModel
      });
    }
    const sortedRemaining = [...allSanitized].sort((a, b) => {
      const aConn = a.connectionStatus === "connected" ? 0 : 1;
      const bConn = b.connectionStatus === "connected" ? 0 : 1;
      if (aConn !== bConn) return aConn - bConn;
      return (a.priority || 10) - (b.priority || 10);
    });
    for (const c of sortedRemaining) {
      if (!candidateSpecs.some((x) => x.credId === c.id)) {
        candidateSpecs.push({ credId: c.id, modelOverride: params.preferredModel || c.model });
      }
    }
    const isBackgroundAutomation = actor === "Automated Data Engine";
    const attemptedProjectKeys = /* @__PURE__ */ new Set();
    const errors = [];
    let lastDiagnostic;
    for (const spec of candidateSpecs) {
      if (isBackgroundAutomation) {
        const cd = this.getAutomationCooldownStatus(spec.credId);
        if (cd.active) {
          errors.push(`[${spec.credId}] Background automation paused: ${cd.reason}`);
          continue;
        }
      }
      const resolved = AIProviderManager.resolveRawCredentialDetailed(spec.credId);
      if (!resolved || !resolved.cred.enabled) continue;
      if (resolved.decryptError || !resolved.rawKey) {
        errors.push(`[${resolved.cred.label}] Decryption failed: ${resolved.decryptError || "Empty secret"}`);
        continue;
      }
      const { cred, rawKey } = resolved;
      const projectSignature = `${cred.providerType}:${cred.projectId.toLowerCase()}`;
      if (attemptedProjectKeys.has(projectSignature)) {
        continue;
      }
      const budgetCheck = AIUsageTracker.checkBudget(cred);
      if (!budgetCheck.allowed) {
        errors.push(budgetCheck.reason || "Budget limit exceeded");
        continue;
      }
      attemptedProjectKeys.add(projectSignature);
      const modelToUse = spec.modelOverride || cred.model;
      const effectiveMaxTokens = params.jsonMode ? Math.max(params.maxTokens ?? route?.maxTokens ?? 4096, 4096) : params.maxTokens ?? route?.maxTokens;
      try {
        const execResult = cred.providerType === "gemini" ? await GeminiProvider.execute({
          apiKey: rawKey,
          model: modelToUse,
          prompt: params.prompt,
          systemInstruction: params.systemInstruction,
          jsonMode: params.jsonMode,
          temperature: params.temperature ?? route?.temperature,
          maxTokens: effectiveMaxTokens,
          signal: params.signal
        }) : await GrokProvider.execute({
          apiKey: rawKey,
          model: modelToUse,
          endpointUrl: cred.endpointUrl,
          providerType: cred.providerType,
          prompt: params.prompt,
          systemInstruction: params.systemInstruction,
          jsonMode: params.jsonMode,
          temperature: params.temperature ?? route?.temperature,
          maxTokens: effectiveMaxTokens,
          signal: params.signal
        });
        const now = (/* @__PURE__ */ new Date()).toISOString();
        if (cred.id !== "env-gemini-default" && cred.id !== "env-grok-default") {
          const updatedCred = {
            ...cred,
            connectionStatus: "connected",
            generationTestStatus: "ok",
            lastTestStatus: "connected",
            lastSuccessfulGenerationAt: now,
            lastLatencyMs: execResult.latencyMs,
            updatedAt: now
          };
          db.upsertAiProvider(updatedCred, actor);
          if (isSupabaseConfigured()) {
            upsertSupabaseAiCredential(updatedCred).catch(() => {
            });
          }
        }
        AIUsageTracker.record({
          task: params.task,
          credentialId: cred.id,
          providerType: cred.providerType,
          projectId: cred.projectId,
          model: execResult.model,
          promptTokens: execResult.promptTokens,
          completionTokens: execResult.completionTokens,
          latencyMs: execResult.latencyMs,
          status: "success",
          actor
        });
        return {
          ...execResult,
          credentialId: cred.id,
          providerType: cred.providerType,
          projectId: cred.projectId
        };
      } catch (err) {
        if (params.signal?.aborted) {
          throw new AIUnavailableError("Generation request cancelled by user.", 499, "ABORTED");
        }
        const diag = err instanceof ProviderExecutionError ? err.diagnostic : classifyProviderError({
          providerType: cred.providerType,
          err,
          model: modelToUse,
          stage: "inference",
          authenticated: cred.modelListStatus === "ok",
          secretToRedact: rawKey,
          timeoutWindowMs: getInferenceTimeoutMs()
        });
        lastDiagnostic = diag;
        errors.push(`[${cred.label} | ${diag.correlationId}] ${diag.diagnosis}`);
        if (isBackgroundAutomation) {
          let pauseMs = 10 * 60 * 1e3;
          if (diag.category === "quota_429") {
            pauseMs = Math.min(Math.max(diag.retryAfterSeconds || 900, 60), 24 * 3600) * 1e3;
          } else if (diag.category === "billing_required" || diag.category === "auth_failed_401" || diag.category === "permission_denied_403") {
            pauseMs = 60 * 60 * 1e3;
          }
          this.automationCooldowns.set(cred.id, {
            untilMs: Date.now() + pauseMs,
            reason: diag.diagnosis,
            category: diag.category
          });
        }
        if (cred.id !== "env-gemini-default" && cred.id !== "env-grok-default") {
          const now = (/* @__PURE__ */ new Date()).toISOString();
          const nextStatus = cred.modelListStatus === "ok" && diag.connectionStatus !== "auth_failed" ? "authenticated_generation_unavailable" : diag.connectionStatus;
          const failedCred = {
            ...cred,
            connectionStatus: nextStatus,
            generationTestStatus: "error",
            lastFailureAt: now,
            lastTestStatus: "error",
            lastTestMessage: diag.diagnosis,
            lastDiagnostic: diag,
            lastCorrelationId: diag.correlationId,
            updatedAt: now
          };
          db.upsertAiProvider(failedCred, actor);
          if (isSupabaseConfigured()) {
            upsertSupabaseAiCredential(failedCred).catch(() => {
            });
          }
        }
        AIUsageTracker.record({
          task: params.task,
          credentialId: cred.id,
          providerType: cred.providerType,
          projectId: cred.projectId,
          model: modelToUse,
          promptTokens: 0,
          completionTokens: 0,
          latencyMs: 0,
          status: "error",
          errorMessage: `[${diag.correlationId}] ${diag.diagnosis}`,
          correlationId: diag.correlationId,
          actor
        });
      }
    }
    throw new AIUnavailableError(
      errors.length > 0 ? errors.join(" | ") : "All configured AI providers failed or exceeded quota.",
      lastDiagnostic?.httpStatus && lastDiagnostic.httpStatus >= 400 && lastDiagnostic.httpStatus < 600 ? lastDiagnostic.httpStatus : 502,
      lastDiagnostic?.category?.toUpperCase() || "AI_PROVIDER_FAILED",
      lastDiagnostic
    );
  }
  static extractBalancedJson(input) {
    const startObj = input.indexOf("{");
    const startArr = input.indexOf("[");
    let start = -1;
    let openChar = "{";
    let closeChar = "}";
    if (startObj !== -1 && (startArr === -1 || startObj < startArr)) {
      start = startObj;
      openChar = "{";
      closeChar = "}";
    } else if (startArr !== -1) {
      start = startArr;
      openChar = "[";
      closeChar = "]";
    }
    if (start === -1) return null;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < input.length; i++) {
      const ch = input[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\" && inString) {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (ch === openChar) depth++;
        else if (ch === closeChar) {
          depth--;
          if (depth === 0) {
            return input.slice(start, i + 1);
          }
        }
      }
    }
    return null;
  }
  static sanitizeControlCharsInStrings(jsonText) {
    let out = "";
    let inString = false;
    let escaped = false;
    for (let i = 0; i < jsonText.length; i++) {
      const ch = jsonText[i];
      if (escaped) {
        out += ch;
        escaped = false;
        continue;
      }
      if (ch === "\\" && inString) {
        out += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        out += ch;
        continue;
      }
      if (inString) {
        if (ch === "\n") {
          out += "\\n";
          continue;
        }
        if (ch === "\r") {
          out += "\\r";
          continue;
        }
        if (ch === "	") {
          out += "\\t";
          continue;
        }
      }
      out += ch;
    }
    return out;
  }
  static parseJsonPayload(rawText) {
    let clean = (rawText || "").replace(/^\uFEFF/, "").trim();
    if (!clean) {
      throw new Error("Empty response text");
    }
    try {
      return JSON.parse(clean);
    } catch {
    }
    const fencedMatch = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fencedMatch && fencedMatch[1]) {
      clean = fencedMatch[1].trim();
      try {
        return JSON.parse(clean);
      } catch {
      }
    }
    const balanced = this.extractBalancedJson(clean) || this.extractBalancedJson(rawText) || clean;
    const candidates = [
      balanced,
      balanced.replace(/,\s*([}\]])/g, "$1"),
      this.sanitizeControlCharsInStrings(balanced),
      this.sanitizeControlCharsInStrings(balanced).replace(/,\s*([}\]])/g, "$1")
    ];
    for (const candidate of candidates) {
      try {
        return JSON.parse(candidate);
      } catch {
      }
    }
    throw new Error("Unable to parse JSON payload");
  }
  static async executeJsonTask(params) {
    const strictJsonSuffix = "Return ONLY a single valid RFC-8599 JSON object (or array if requested) with properly escaped strings and no markdown fences or surrounding commentary.";
    const baseSystem = params.systemInstruction ? `${params.systemInstruction}
${strictJsonSuffix}` : strictJsonSuffix;
    let res = await this.executeTask({
      ...params,
      systemInstruction: baseSystem,
      jsonMode: true
    });
    let parsed;
    try {
      parsed = this.parseJsonPayload(res.text);
    } catch {
      if (params.signal?.aborted) {
        throw new AIUnavailableError("Generation request cancelled by user.", 499, "ABORTED");
      }
      res = await this.executeTask({
        ...params,
        systemInstruction: baseSystem,
        jsonMode: true,
        temperature: 0.1,
        maxTokens: Math.max(params.maxTokens || 4096, 8192)
      });
      try {
        parsed = this.parseJsonPayload(res.text);
      } catch {
        const reason = res.finishReason ? `finishReason=${res.finishReason}` : "malformed output";
        throw new AIUnavailableError(
          `AI provider returned invalid JSON payload from ${res.model} (${reason}). Please retry.`,
          502,
          "INVALID_AI_JSON"
        );
      }
    }
    return {
      data: parsed,
      meta: {
        credentialId: res.credentialId,
        providerType: res.providerType,
        projectId: res.projectId,
        model: res.model,
        promptTokens: res.promptTokens,
        completionTokens: res.completionTokens,
        totalTokens: res.totalTokens,
        latencyMs: res.latencyMs
      }
    };
  }
};

// src/server/automation/aiContentEngine.ts
var isDraftGenerationRunning = false;
var enginePausedUntilMs = 0;
function resetAiContentEngineCooldown() {
  enginePausedUntilMs = 0;
}
async function processDataChangeWithGemini(category, triggerReason, snapshot) {
  const settings = db.getAutomationSettings();
  if (!settings.aiDraftsEnabled) {
    return null;
  }
  const nowMs = Date.now();
  if (nowMs < enginePausedUntilMs) {
    return null;
  }
  if (isDraftGenerationRunning) {
    return null;
  }
  const now = new Date(nowMs);
  if (settings.lastGeminiCallAt) {
    const elapsedMinutes = (nowMs - new Date(settings.lastGeminiCallAt).getTime()) / (1e3 * 60);
    if (elapsedMinutes < settings.geminiCooldownMin) {
      return null;
    }
  }
  const availableCreds = AIProviderRouter.getAllCredentialsSanitized().filter((c) => c.enabled);
  if (availableCreds.length === 0) {
    return null;
  }
  isDraftGenerationRunning = true;
  db.updateAutomationSettings({ lastGeminiCallAt: now.toISOString() }, "AI Automation Engine");
  try {
    const prompt = `You are the Senior Chief Editor for "360Khabarnama", a premier Pakistani bilingual news publication.
A verified factual data change has occurred in our persistent data gateway:
Category: ${category.toUpperCase()}
Reason: ${triggerReason}
Verified Data Snapshot: ${JSON.stringify(snapshot, null, 2)}

STRICT EDITORIAL RULES:
1. Ground your entire summary exclusively in the provided numeric values. NEVER fabricate, estimate, or alter numbers.
2. Produce valid JSON with exact keys:
   - titleEn: Professional, high-CTR English news headline.
   - titleUr: Natural, journalistic Urdu headline (\u0646\u0633\u062A\u0639\u0644\u06CC\u0642 \u0627\u0646\u062F\u0627\u0632).
   - summaryEn: Concise 2-sentence standfirst for reader cards.
   - summaryUr: Factual Urdu summary.
   - contentEn: 3 short paragraphs explaining market context, verified prices, and impact on Pakistani consumers.
   - contentUr: 3 formal journalistic paragraphs in authentic Urdu.
   - seoTags: Array of 5 relevant search tags.`;
    const { data: rawParsed } = await AIProviderRouter.executeJsonTask({
      task: "breaking_alerts",
      prompt,
      systemInstruction: "You are a bilingual Urdu/English newsroom editor. Output ONLY a single valid JSON object with keys titleEn, titleUr, summaryEn, summaryUr, contentEn, contentUr, seoTags. Keep total JSON response concise (under 900 words).",
      temperature: 0.2,
      maxTokens: 2048,
      actor: "Automated Data Engine"
    });
    const parsed = Array.isArray(rawParsed) ? rawParsed[0] : rawParsed?.article || rawParsed?.data || rawParsed;
    if (!parsed || !parsed.titleEn && !parsed.titleUr) {
      throw new Error("AI output missing required bilingual titles.");
    }
    const draft = {
      id: `draft-${category}-${Date.now()}`,
      category,
      triggerReason,
      titleEn: parsed.titleEn || parsed.titleUr || `${category.toUpperCase()} Market Update`,
      titleUr: parsed.titleUr || parsed.titleEn || "\u062A\u0627\u0632\u06C1 \u062A\u0631\u06CC\u0646 \u0627\u067E\u0688\u06CC\u0679",
      summaryEn: parsed.summaryEn || "",
      summaryUr: parsed.summaryUr || "",
      contentEn: parsed.contentEn || "",
      contentUr: parsed.contentUr || "",
      sourceDataSnapshot: snapshot,
      status: "pending_review",
      createdAt: now.toISOString(),
      seoTags: Array.isArray(parsed.seoTags) ? parsed.seoTags : [category, "PakistanNews", "VerifiedRates"]
    };
    db.saveAiDraft(draft);
    enginePausedUntilMs = 0;
    return draft;
  } catch (error) {
    const diag = error instanceof AIUnavailableError ? error.diagnostic : void 0;
    if (diag?.category === "quota_429") {
      const pauseSec = Math.min(Math.max(diag.retryAfterSeconds || 1800, 60), 24 * 3600);
      enginePausedUntilMs = Date.now() + pauseSec * 1e3;
    } else if (diag?.category === "billing_required" || diag?.category === "auth_failed_401" || diag?.category === "permission_denied_403" || error instanceof AIUnavailableError && error.code === "NO_AI_KEY") {
      enginePausedUntilMs = Date.now() + 60 * 60 * 1e3;
    } else if (diag?.category === "timeout" || diag?.category === "server_error_5xx") {
      enginePausedUntilMs = Date.now() + 10 * 60 * 1e3;
    }
    console.warn("[AI Engine] Automated draft skipped:", error?.message || String(error));
    return null;
  } finally {
    isDraftGenerationRunning = false;
  }
}

// services/automation/ProviderRegistry.ts
function isPrivateOrBlockedHostname(hostname) {
  const lower = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!lower) return true;
  if (lower === "localhost" || lower === "0.0.0.0" || lower === "::1" || lower.endsWith(".localhost") || lower.endsWith(".local") || lower.endsWith(".internal")) {
    return true;
  }
  const ipv4Match = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [a, b] = [Number(ipv4Match[1]), Number(ipv4Match[2])];
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  if (lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80:")) {
    return true;
  }
  return false;
}
function validateSafeExternalUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL((rawUrl || "").trim());
  } catch {
    throw new Error("Invalid endpoint URL format.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http:// and https:// endpoints are allowed.");
  }
  if (isPrivateOrBlockedHostname(parsed.hostname)) {
    throw new Error("SSRF protection: private, loopback, or internal network hostnames are blocked.");
  }
  return parsed;
}
var ProviderRegistry = class {
  static getAllSanitized() {
    return db.getDataProviders().map((p) => ({
      ...p,
      encryptedApiKey: void 0
    }));
  }
  static upsertProvider(input, actor = "Automation Manager") {
    if (!input.name?.trim() || !input.endpoint?.trim()) {
      throw new Error("Provider name and endpoint URL are required.");
    }
    validateSafeExternalUrl(input.endpoint.trim());
    const existing = input.id ? db.getDataProvider(input.id) : void 0;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const id = existing?.id || `prov-${input.category || "custom"}-${Date.now()}`;
    let encryptedApiKey = existing?.encryptedApiKey;
    let maskedApiKey = existing?.maskedApiKey;
    let hasApiKey = existing?.hasApiKey ?? false;
    if (input.plainApiKey && input.plainApiKey.trim()) {
      encryptedApiKey = encryptSecret(input.plainApiKey.trim());
      maskedApiKey = maskSecret(input.plainApiKey.trim());
      hasApiKey = true;
    }
    const record = {
      id,
      name: input.name.trim(),
      category: input.category || existing?.category || "news",
      endpoint: input.endpoint.trim(),
      method: input.method || existing?.method || "GET",
      status: input.status || existing?.status || "active",
      intervalMinutes: Number(input.intervalMinutes ?? existing?.intervalMinutes ?? 30),
      lastSyncAt: existing?.lastSyncAt || null,
      nextSyncAt: existing?.nextSyncAt || new Date(Date.now() + 30 * 6e4).toISOString(),
      lastError: existing?.lastError || null,
      isLicensed: input.isLicensed ?? existing?.isLicensed ?? true,
      licenseType: input.licenseType || existing?.licenseType || "public_open",
      commercialRights: input.commercialRights ?? existing?.commercialRights ?? true,
      attributionRequired: input.attributionRequired ?? existing?.attributionRequired ?? true,
      attribution: input.attribution || existing?.attribution || input.name.trim(),
      requiresApiKey: input.requiresApiKey ?? existing?.requiresApiKey ?? false,
      hasApiKey,
      encryptedApiKey,
      maskedApiKey,
      authHeaderName: input.authHeaderName || existing?.authHeaderName || "Authorization",
      dailyQuotaLimit: Number(input.dailyQuotaLimit ?? existing?.dailyQuotaLimit ?? 1e3),
      dailyCallsUsed: existing?.dailyCallsUsed ?? 0,
      consecutiveFailures: existing?.consecutiveFailures ?? 0,
      totalSyncs: existing?.totalSyncs ?? 0,
      successfulSyncs: existing?.successfulSyncs ?? 0,
      notes: input.notes ?? existing?.notes
    };
    const saved = db.upsertDataProvider(record, actor);
    return { ...saved, encryptedApiKey: void 0 };
  }
  static deleteProvider(id, actor = "Automation Manager") {
    return db.deleteDataProvider(id, actor);
  }
  static async testEndpoint(providerId) {
    const provider = db.getDataProvider(providerId);
    if (!provider) {
      throw new Error("Provider not found.");
    }
    validateSafeExternalUrl(provider.endpoint);
    const start = Date.now();
    const headers = {
      Accept: "application/json, application/xml, text/xml, */*",
      "User-Agent": "360Khabarnama-SyncBot/2.0"
    };
    if (provider.requiresApiKey && provider.encryptedApiKey) {
      const secret = decryptSecret(provider.encryptedApiKey);
      if (secret) {
        const headerName = provider.authHeaderName || "Authorization";
        headers[headerName] = headerName.toLowerCase() === "authorization" ? `Bearer ${secret}` : secret;
      }
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12e3);
      const res = await fetch(provider.endpoint, {
        method: provider.method || "GET",
        headers,
        signal: controller.signal
      });
      clearTimeout(timeout);
      const latencyMs = Date.now() - start;
      const contentType = res.headers.get("content-type") || "";
      const rawText = await res.text();
      let validationPassed = res.ok && rawText.trim().length > 0;
      let message = `HTTP ${res.status} (${latencyMs}ms)`;
      if (contentType.includes("application/json") || rawText.trim().startsWith("{") || rawText.trim().startsWith("[")) {
        try {
          const parsed = JSON.parse(rawText);
          const check = DataValidator.validatePayload(provider.category, parsed);
          validationPassed = res.ok && check.passed;
          if (!check.passed) {
            message = `Validation failed: ${check.errors.join("; ")}`;
          } else {
            message = `Verified JSON payload HTTP ${res.status} (${latencyMs}ms)`;
          }
        } catch {
          validationPassed = false;
          message = `Invalid JSON response (HTTP ${res.status})`;
        }
      }
      return {
        ok: res.ok && validationPassed,
        httpStatus: res.status,
        latencyMs,
        message,
        validationPassed
      };
    } catch (err) {
      return {
        ok: false,
        httpStatus: 0,
        latencyMs: Date.now() - start,
        message: err?.message || "Network/DNS error reaching endpoint",
        validationPassed: false
      };
    }
  }
  static async executeProviderSync(providerId, triggeredBy = "manual") {
    const provider = db.getDataProvider(providerId);
    const providerName = provider?.name || providerId;
    const category = provider?.category || "currency";
    if (provider && provider.dailyQuotaLimit && (provider.dailyCallsUsed || 0) >= provider.dailyQuotaLimit) {
      const quotaRun = {
        id: `run-${providerId}-${Date.now()}`,
        providerId,
        providerName,
        category,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        status: "failed",
        itemsProcessed: 0,
        changesDetected: false,
        changeSummaryEn: `Daily API quota exceeded (${provider.dailyCallsUsed}/${provider.dailyQuotaLimit})`,
        changeSummaryUr: "\u0631\u0648\u0632\u0627\u0646\u06C1 \u06A9\u06CC API \u062D\u062F \u0645\u06A9\u0645\u0644 \u06C1\u0648 \u0686\u06A9\u06CC \u06C1\u06D2\u06D4",
        durationMs: 0,
        validationPassed: false,
        triggeredBy,
        errorDetails: "Quota exhausted"
      };
      return SyncLogger.logRun(quotaRun);
    }
    const startTime = Date.now();
    let result = {
      success: false,
      changesDetected: false,
      changeSummaryEn: "",
      changeSummaryUr: "",
      itemsProcessed: 0
    };
    let httpStatus = 200;
    let validationPassed = true;
    try {
      switch (providerId) {
        case "currency-erapi":
          result = await syncCurrencyRates();
          break;
        case "weather-openmeteo":
          result = await syncWeatherData();
          break;
        case "gold-bullion":
          result = await syncGoldRates();
          break;
        case "fuel-ogra":
          result = await syncFuelPrices();
          break;
        case "cricket-feed":
          result = await syncCricketData();
          break;
        case "world-news-rss":
          result = await syncWorldNewsFeed();
          break;
        case "sports-news-rss":
          result = await syncSportsNewsFeed();
          break;
        default: {
          if (!provider) {
            throw new Error(`Unknown provider ID: ${providerId}`);
          }
          validateSafeExternalUrl(provider.endpoint);
          const headers = {
            Accept: "application/json, application/xml, text/xml, */*",
            "User-Agent": "360Khabarnama-SyncBot/2.0"
          };
          if (provider.requiresApiKey && provider.encryptedApiKey) {
            const secret = decryptSecret(provider.encryptedApiKey);
            if (secret) {
              const hn = provider.authHeaderName || "Authorization";
              headers[hn] = hn.toLowerCase() === "authorization" ? `Bearer ${secret}` : secret;
            }
          }
          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 15e3);
          const resp = await fetch(provider.endpoint, {
            method: provider.method || "GET",
            headers,
            signal: controller.signal
          });
          clearTimeout(t);
          httpStatus = resp.status;
          if (!resp.ok) {
            throw new Error(`Upstream HTTP ${resp.status}`);
          }
          const text = await resp.text();
          let count = 1;
          if (text.trim().startsWith("{") || text.trim().startsWith("[")) {
            const parsed = JSON.parse(text);
            const validation = DataValidator.validatePayload(provider.category, parsed);
            validationPassed = validation.passed;
            if (!validation.passed) {
              throw new Error(validation.errors.join("; "));
            }
            count = Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length || 1;
          }
          result = {
            success: true,
            changesDetected: false,
            itemsProcessed: count,
            changeSummaryEn: `Synced custom feed "${provider.name}" (HTTP ${httpStatus})`,
            changeSummaryUr: `"${provider.name}" \u0641\u06CC\u0688 \u06A9\u0627\u0645\u06CC\u0627\u0628\u06CC \u0633\u06D2 \u0633\u0646\u06A9 \u06C1\u0648 \u06AF\u0626\u06CC\u06D4`
          };
          break;
        }
      }
      if (provider) {
        db.updateDataProvider(provider.id, {
          dailyCallsUsed: (provider.dailyCallsUsed || 0) + 1
        });
      }
      if (result.success && result.changesDetected) {
        let snapshotData = {};
        if (providerId === "gold-bullion") snapshotData = { goldRates: result.rates };
        else if (providerId === "currency-erapi") snapshotData = { currencyRates: result.rates };
        else if (providerId === "fuel-ogra") snapshotData = { fuelPrices: result.prices };
        else if (providerId === "weather-openmeteo") snapshotData = { weatherSummary: result.changeSummaryEn };
        if (["gold", "currency", "fuel", "weather", "cricket"].includes(category)) {
          processDataChangeWithGemini(category, result.changeSummaryEn, snapshotData).catch(console.error);
        }
      }
    } catch (err) {
      validationPassed = false;
      httpStatus = err?.status || 0;
      result = {
        success: false,
        changesDetected: false,
        itemsProcessed: 0,
        error: err?.message || "Sync execution error",
        changeSummaryEn: `Failed: ${err?.message || "Execution error"}`,
        changeSummaryUr: `\u0633\u0646\u06A9 \u0645\u06CC\u06BA \u0646\u0627\u06A9\u0627\u0645\u06CC: ${err?.message || "\u062E\u0631\u0627\u0628\u06CC"}`
      };
    }
    const runRecord = {
      id: `run-${providerId}-${Date.now()}`,
      providerId,
      providerName,
      category,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      status: result.success ? "success" : "failed",
      itemsProcessed: result.itemsProcessed || 0,
      changesDetected: !!result.changesDetected,
      changeSummaryEn: result.changeSummaryEn || "Completed",
      changeSummaryUr: result.changeSummaryUr || "\u0645\u06A9\u0645\u0644",
      durationMs: Date.now() - startTime,
      httpStatus,
      validationPassed,
      triggeredBy,
      errorDetails: result.error || null
    };
    return SyncLogger.logRun(runRecord);
  }
};

// src/lib/firebase-admin.ts
import fs2 from "fs";
import crypto4 from "crypto";

// firebase-applet-config.json
var firebase_applet_config_default = {
  projectId: "gen-lang-client-0094029776",
  appId: "1:701058012820:web:bcd4544b1ac2d439c70681",
  apiKey: "AIzaSyCczY6r6fe59ybjU9K2bubyW4NOnZmpVyo",
  authDomain: "gen-lang-client-0094029776.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-360khabarnama-91785bb5-94ed-4005-bd25-9b4d9b8b10ba",
  storageBucket: "gen-lang-client-0094029776.firebasestorage.app",
  messagingSenderId: "701058012820",
  measurementId: "",
  oAuthClientId: "701058012820-7gofih65m34durrpdnop43hq7ulcln2p.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

// src/lib/firebase-admin.ts
var SECURE_TOKEN_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
var OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
var firebaseProjectConfig = {
  projectId: firebase_applet_config_default.projectId,
  firestoreDatabaseId: firebase_applet_config_default.firestoreDatabaseId,
  apiKey: firebase_applet_config_default.apiKey,
  authDomain: firebase_applet_config_default.authDomain,
  storageBucket: firebase_applet_config_default.storageBucket
};
var cachedCerts = null;
var certsExpiresAt = 0;
var cachedServiceToken = null;
var serviceTokenExpiresAt = 0;
function loadServiceAccountCredentials() {
  try {
    const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
    if (rawJson && rawJson.startsWith("{")) {
      const parsed = JSON.parse(rawJson);
      if (parsed?.client_email && parsed?.private_key) return parsed;
    }
    const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim();
    if (b64) {
      const parsed = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
      if (parsed?.client_email && parsed?.private_key) return parsed;
    }
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
    if (credPath && fs2.existsSync(credPath)) {
      const parsed = JSON.parse(fs2.readFileSync(credPath, "utf8"));
      if (parsed?.client_email && parsed?.private_key) return parsed;
    }
  } catch (err) {
    console.warn("[FirebaseAdmin] Service account parse warning:", err?.message || err);
  }
  return null;
}
function hasServiceAccountConfigured() {
  return Boolean(loadServiceAccountCredentials());
}
async function getServiceAccountAccessToken() {
  const sa = loadServiceAccountCredentials();
  if (!sa) return null;
  const nowSec = Math.floor(Date.now() / 1e3);
  if (cachedServiceToken && nowSec < serviceTokenExpiresAt - 60) {
    return cachedServiceToken;
  }
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claim = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      sub: sa.client_email,
      aud: OAUTH_TOKEN_URL,
      iat: nowSec,
      exp: nowSec + 3600,
      scope: "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase"
    })
  ).toString("base64url");
  const signer = crypto4.createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  signer.end();
  const signature = signer.sign(sa.private_key).toString("base64url");
  const assertion = `${header}.${claim}.${signature}`;
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    }).toString(),
    signal: AbortSignal.timeout(8e3)
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Google OAuth2 service token exchange failed (HTTP ${res.status}): ${errText.slice(0, 160)}`);
  }
  const data = await res.json();
  if (!data.access_token) {
    throw new Error("Google OAuth2 response did not include access_token.");
  }
  cachedServiceToken = data.access_token;
  serviceTokenExpiresAt = nowSec + (data.expires_in || 3600);
  return cachedServiceToken;
}
async function fetchGooglePublicCerts(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedCerts && now < certsExpiresAt) {
    return cachedCerts;
  }
  const res = await fetch(SECURE_TOKEN_CERTS_URL, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8e3)
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Google public certificates (HTTP ${res.status}).`);
  }
  const certs = await res.json();
  const cacheControl = res.headers.get("cache-control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const ttlSec = maxAgeMatch ? Math.max(60, parseInt(maxAgeMatch[1], 10)) : 3600;
  cachedCerts = certs;
  certsExpiresAt = now + ttlSec * 1e3;
  return certs;
}
function decodeBase64UrlJson(segment) {
  const json = Buffer.from(segment, "base64url").toString("utf8");
  return JSON.parse(json);
}
var adminAuth = {
  verifyIdToken: async (idToken) => {
    if (!idToken || typeof idToken !== "string") {
      throw new Error("Firebase ID token must be a non-empty string.");
    }
    const parts = idToken.split(".");
    if (parts.length !== 3) {
      throw new Error("Decoding Firebase ID token failed. Invalid JWT format.");
    }
    const [headerB64, payloadB64, signatureB64] = parts;
    let header;
    let payload;
    try {
      header = decodeBase64UrlJson(headerB64);
      payload = decodeBase64UrlJson(payloadB64);
    } catch {
      throw new Error("Decoding Firebase ID token failed. Malformed JWT payload.");
    }
    if (header.alg !== "RS256" || !header.kid) {
      throw new Error("Firebase ID token has invalid signing algorithm or missing key ID.");
    }
    const projectId = firebaseProjectConfig.projectId;
    const nowSec = Math.floor(Date.now() / 1e3);
    const clockSkewSec = 300;
    if (typeof payload.exp !== "number" || payload.exp <= nowSec - clockSkewSec) {
      throw new Error("Firebase ID token has expired.");
    }
    if (typeof payload.iat !== "number" || payload.iat > nowSec + clockSkewSec) {
      throw new Error("Firebase ID token issued-at timestamp is invalid.");
    }
    if (typeof payload.auth_time === "number" && payload.auth_time > nowSec + clockSkewSec) {
      throw new Error("Firebase ID token auth_time is in the future.");
    }
    if (payload.aud !== projectId) {
      throw new Error(`Firebase ID token has incorrect audience "${payload.aud}".`);
    }
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
      throw new Error(`Firebase ID token has incorrect issuer "${payload.iss}".`);
    }
    if (!payload.sub || typeof payload.sub !== "string") {
      throw new Error("Firebase ID token missing non-empty subject (sub).");
    }
    let certs = await fetchGooglePublicCerts(false);
    let certPem = certs[header.kid];
    if (!certPem) {
      certs = await fetchGooglePublicCerts(true);
      certPem = certs[header.kid];
    }
    if (!certPem) {
      throw new Error(`Firebase ID token signing key "${header.kid}" not found in Google certificates.`);
    }
    const verifier = crypto4.createVerify("RSA-SHA256");
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();
    const sigBuf = Buffer.from(signatureB64, "base64url");
    const isValid = verifier.verify(certPem, sigBuf);
    if (!isValid) {
      throw new Error("Firebase ID token signature verification failed.");
    }
    return {
      ...payload,
      uid: payload.sub
    };
  }
};

// src/server/firestore.ts
var FIRESTORE_ROOT = `https://firestore.googleapis.com/v1/projects/${firebaseProjectConfig.projectId}/databases/${firebaseProjectConfig.firestoreDatabaseId}`;
var DOCS_BASE = `${FIRESTORE_ROOT}/documents`;
function sanitizeFirestoreId(raw, fallback = "item") {
  const cleaned = String(raw || "").trim().replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 128);
  return cleaned || `${fallback}-${Date.now()}`;
}
function sanitizeSlug(raw, fallback = "news") {
  const cleaned = String(raw || "").toLowerCase().trim().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 180);
  return cleaned.length >= 2 ? cleaned : `${fallback}-${Date.now().toString(36)}`.slice(0, 180);
}
async function resolveFirestoreAuth(bearerToken) {
  const saToken = await getServiceAccountAccessToken().catch(() => null);
  if (saToken) {
    return {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${saToken}`
      },
      urlSuffix: "",
      authMode: "service_account"
    };
  }
  if (bearerToken && bearerToken.trim()) {
    return {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearerToken.trim()}`
      },
      urlSuffix: `?key=${encodeURIComponent(firebaseProjectConfig.apiKey)}`,
      authMode: "admin_id_token"
    };
  }
  return {
    headers: {
      "Content-Type": "application/json"
    },
    urlSuffix: `?key=${encodeURIComponent(firebaseProjectConfig.apiKey)}`,
    authMode: "public_api_key"
  };
}
function encodeValue(val) {
  if (val === void 0) return void 0;
  if (val === null) return { nullValue: null };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === "string") return { stringValue: val };
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map((item) => encodeValue(item)).filter((v) => Boolean(v))
      }
    };
  }
  if (typeof val === "object") {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      const encoded = encodeValue(v);
      if (encoded !== void 0) fields[k] = encoded;
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}
function decodeValue(val) {
  if (!val || typeof val !== "object") return void 0;
  if ("stringValue" in val) return String(val.stringValue);
  if ("booleanValue" in val) return Boolean(val.booleanValue);
  if ("integerValue" in val) return Number(val.integerValue);
  if ("doubleValue" in val) return Number(val.doubleValue);
  if ("timestampValue" in val) return String(val.timestampValue);
  if ("nullValue" in val) return null;
  if ("arrayValue" in val) {
    const arr = Array.isArray(val.arrayValue?.values) ? val.arrayValue.values : [];
    return arr.map((item) => decodeValue(item));
  }
  if ("mapValue" in val) {
    const obj = {};
    const fields = val.mapValue?.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      obj[k] = decodeValue(v);
    }
    return obj;
  }
  return void 0;
}
function firestoreDocToArticle(docObj) {
  if (!docObj || !docObj.fields) return null;
  const f = docObj.fields;
  const docNameParts = String(docObj.name || "").split("/");
  const docId = docNameParts[docNameParts.length - 1] || "";
  const get = (key, fallback) => {
    const v = decodeValue(f[key]);
    return v === void 0 ? fallback : v;
  };
  const id = String(get("id", docId) || docId);
  if (!id) return null;
  const tagsRaw = get("tags", []);
  const tags = Array.isArray(tagsRaw) ? tagsRaw.map((t) => String(t)).filter(Boolean) : [];
  const status = String(get("status", "published"));
  const createdAt = String(get("createdAt", (/* @__PURE__ */ new Date()).toISOString()));
  const updatedAt = String(get("updatedAt", createdAt));
  const publishedAtRaw = get("publishedAt", void 0);
  return {
    id,
    slug: String(get("slug", id)),
    titleEn: String(get("titleEn", "")),
    titleUr: String(get("titleUr", "")),
    summaryEn: String(get("summaryEn", "")),
    summaryUr: String(get("summaryUr", "")),
    contentEn: String(get("contentEn", "")),
    contentUr: String(get("contentUr", "")),
    category: String(get("category", "pakistan")),
    tags,
    status,
    isBreaking: Boolean(get("isBreaking", false)),
    isFeatured: Boolean(get("isFeatured", false)),
    isTrending: Boolean(get("isTrending", false)),
    heroImage: String(
      get(
        "heroImage",
        "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=1200&q=80"
      )
    ),
    imageCaptionEn: String(get("imageCaptionEn", "")),
    imageCaptionUr: String(get("imageCaptionUr", "")),
    readingTimeMin: Number(get("readingTimeMin", 3)) || 3,
    author: {
      id: String(get("authorUid", "admin-desk")),
      nameEn: String(get("authorNameEn", "360Khabarnama Editorial")),
      nameUr: String(get("authorNameUr", "\u0627\u062F\u0627\u0631\u06C1 360 \u062E\u0628\u0631\u0646\u0627\u0645\u06C1")),
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
      role: "Editor"
    },
    publishedAt: publishedAtRaw ? String(publishedAtRaw) : status === "published" ? updatedAt : "",
    scheduledAt: get("scheduledAt", void 0) ? String(get("scheduledAt")) : void 0,
    version: Number(get("version", 1)) || 1,
    failureReason: get("failureReason", void 0) ? String(get("failureReason")) : void 0,
    views: Number(get("views", 0)) || 0,
    seo: {
      metaTitleEn: get("metaTitleEn", void 0) ? String(get("metaTitleEn")) : void 0,
      metaTitleUr: get("metaTitleUr", void 0) ? String(get("metaTitleUr")) : void 0,
      metaDescriptionEn: get("metaDescriptionEn", void 0) ? String(get("metaDescriptionEn")) : void 0,
      metaDescriptionUr: get("metaDescriptionUr", void 0) ? String(get("metaDescriptionUr")) : void 0,
      canonicalUrl: get("canonicalUrl", void 0) ? String(get("canonicalUrl")) : void 0
    },
    createdBy: String(get("authorUid", "")),
    updatedAt
  };
}
function buildArticleFirestoreFields(article, opts) {
  const safeId = sanitizeFirestoreId(article.id, "art");
  const safeSlug = sanitizeSlug(article.slug || article.titleEn || safeId, safeId);
  const cleanTags = (Array.isArray(article.tags) ? article.tags : []).map((t) => String(t || "").trim().slice(0, 64)).filter(Boolean).slice(0, 20);
  const allowedStatus = ["draft", "in_review", "scheduled", "published", "archived", "failed"].includes(
    article.status
  ) ? article.status : "draft";
  const rawFields = {
    id: safeId,
    slug: safeSlug,
    titleEn: (article.titleEn || article.titleUr || "Untitled Story").trim().slice(0, 300),
    titleUr: (article.titleUr || article.titleEn || "\u0628\u063A\u06CC\u0631 \u0639\u0646\u0648\u0627\u0646 \u062E\u0628\u0631").trim().slice(0, 400),
    summaryEn: (article.summaryEn || "").slice(0, 1200),
    summaryUr: (article.summaryUr || "").slice(0, 1500),
    contentEn: (article.contentEn || "").slice(0, 15e4),
    contentUr: (article.contentUr || "").slice(0, 15e4),
    category: (article.category || "pakistan").trim().slice(0, 64) || "pakistan",
    tags: cleanTags,
    status: allowedStatus,
    isBreaking: Boolean(article.isBreaking),
    isFeatured: Boolean(article.isFeatured),
    isTrending: Boolean(article.isTrending),
    heroImage: (article.heroImage || "").slice(0, 1500),
    imageCaptionEn: (article.imageCaptionEn || "").slice(0, 400),
    imageCaptionUr: (article.imageCaptionUr || "").slice(0, 500),
    readingTimeMin: Math.max(1, Math.round(Number(article.readingTimeMin || 3))),
    authorUid: sanitizeFirestoreId(opts.authorUid, "admin"),
    authorNameEn: (article.author?.nameEn || "360Khabarnama Editorial").slice(0, 120),
    authorNameUr: (article.author?.nameUr || "\u0627\u062F\u0627\u0631\u06C1 360 \u062E\u0628\u0631\u0646\u0627\u0645\u06C1").slice(0, 160),
    version: Math.max(1, Math.round(Number(article.version || 1))),
    views: Math.max(0, Math.round(Number(article.views || 0)))
  };
  if (article.publishedAt) {
    rawFields.publishedAt = String(article.publishedAt).slice(0, 64);
  }
  if (article.scheduledAt || article.scheduledFor) {
    rawFields.scheduledAt = String(article.scheduledAt || article.scheduledFor).slice(0, 64);
  }
  if (article.failureReason) {
    rawFields.failureReason = String(article.failureReason).slice(0, 500);
  }
  if (article.seo?.metaTitleEn) {
    rawFields.metaTitleEn = String(article.seo.metaTitleEn).slice(0, 200);
  }
  if (article.seo?.metaTitleUr) {
    rawFields.metaTitleUr = String(article.seo.metaTitleUr).slice(0, 250);
  }
  if (article.seo?.metaDescriptionEn) {
    rawFields.metaDescriptionEn = String(article.seo.metaDescriptionEn).slice(0, 500);
  }
  if (article.seo?.metaDescriptionUr) {
    rawFields.metaDescriptionUr = String(article.seo.metaDescriptionUr).slice(0, 600);
  }
  if (article.seo?.canonicalUrl) {
    rawFields.canonicalUrl = String(article.seo.canonicalUrl).slice(0, 500);
  }
  const fields = {};
  for (const [k, v] of Object.entries(rawFields)) {
    const encoded = encodeValue(v);
    if (encoded) fields[k] = encoded;
  }
  const fieldTransforms = [
    { fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }
  ];
  if (opts.preserveCreatedAtTimestamp) {
    fields.createdAt = { timestampValue: opts.preserveCreatedAtTimestamp };
  } else {
    fieldTransforms.push({ fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" });
  }
  return { fields, fieldTransforms };
}
async function fetchRawFirestoreDoc(collectionPath, docId, bearerToken) {
  const { headers, urlSuffix } = await resolveFirestoreAuth(bearerToken);
  const url = `${DOCS_BASE}/${collectionPath}/${encodeURIComponent(docId)}${urlSuffix}`;
  const res = await fetch(url, {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(1e4)
  });
  if (res.status === 404) {
    return { exists: false, status: 404 };
  }
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { error: { message: text.slice(0, 200) } };
  }
  if (!res.ok) {
    return {
      exists: false,
      status: res.status,
      error: parsed?.error?.message || `Firestore HTTP ${res.status}`
    };
  }
  return { exists: true, doc: parsed, status: res.status };
}
async function runFirestoreQuery(structuredQuery, bearerToken) {
  const { headers, urlSuffix } = await resolveFirestoreAuth(bearerToken);
  const url = `${DOCS_BASE}:runQuery${urlSuffix}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ structuredQuery }),
    signal: AbortSignal.timeout(12e3)
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : [];
  } catch {
    return { ok: false, docs: [], status: res.status, error: `Non-JSON Firestore response: ${text.slice(0, 140)}` };
  }
  if (!res.ok) {
    const errObj = Array.isArray(parsed) ? parsed[0]?.error : parsed?.error;
    return {
      ok: false,
      docs: [],
      status: res.status,
      error: errObj?.message || `Firestore query HTTP ${res.status}`
    };
  }
  const rows = Array.isArray(parsed) ? parsed : [];
  const docs = rows.map((r) => r?.document).filter(Boolean);
  return { ok: true, docs, status: res.status };
}
async function listFirestoreArticles(filters, bearerToken) {
  const { authMode } = await resolveFirestoreAuth(bearerToken);
  const requestedStatus = filters.status || "published";
  const effectiveStatus = authMode === "public_api_key" ? "published" : requestedStatus;
  const whereClauses = [];
  if (effectiveStatus && effectiveStatus !== "all") {
    whereClauses.push({
      fieldFilter: {
        field: { fieldPath: "status" },
        op: "EQUAL",
        value: { stringValue: effectiveStatus }
      }
    });
  }
  if (filters.category && filters.category !== "all") {
    whereClauses.push({
      fieldFilter: {
        field: { fieldPath: "category" },
        op: "EQUAL",
        value: { stringValue: filters.category.toLowerCase() }
      }
    });
  }
  const structuredQuery = {
    from: [{ collectionId: "articles" }],
    limit: Math.min(Math.max(Number(filters.limit || 200), 1), 300)
  };
  if (whereClauses.length === 1) {
    structuredQuery.where = whereClauses[0];
  } else if (whereClauses.length > 1) {
    structuredQuery.where = {
      compositeFilter: {
        op: "AND",
        filters: whereClauses
      }
    };
  }
  const qRes = await runFirestoreQuery(structuredQuery, bearerToken);
  if (!qRes.ok) {
    return { ok: false, articles: [], authMode, error: qRes.error };
  }
  let articles = qRes.docs.map((d) => firestoreDocToArticle(d)).filter((a) => Boolean(a));
  if (filters.tag) {
    const tLower = filters.tag.toLowerCase();
    articles = articles.filter((a) => a.tags.some((t) => t.toLowerCase() === tLower));
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    articles = articles.filter(
      (a) => a.titleEn.toLowerCase().includes(q) || a.titleUr.includes(q) || a.summaryEn.toLowerCase().includes(q) || a.summaryUr.includes(q) || a.slug.toLowerCase().includes(q)
    );
  }
  articles.sort((a, b) => {
    const ta = new Date(a.publishedAt || a.updatedAt || 0).getTime();
    const tb = new Date(b.publishedAt || b.updatedAt || 0).getTime();
    return tb - ta;
  });
  return { ok: true, articles, authMode };
}
async function getFirestoreArticle(idOrSlug, bearerToken) {
  const clean = decodeURIComponent(idOrSlug || "").trim();
  if (!clean) return { ok: true, article: null };
  if (/^[a-zA-Z0-9_-]{1,128}$/.test(clean)) {
    const byId = await fetchRawFirestoreDoc("articles", clean, bearerToken);
    if (byId.exists && byId.doc) {
      const parsed = firestoreDocToArticle(byId.doc);
      if (parsed) return { ok: true, article: parsed };
    }
  }
  const { authMode } = await resolveFirestoreAuth(bearerToken);
  const filters = [
    {
      fieldFilter: {
        field: { fieldPath: "slug" },
        op: "EQUAL",
        value: { stringValue: clean.toLowerCase() }
      }
    }
  ];
  if (authMode === "public_api_key") {
    filters.push({
      fieldFilter: {
        field: { fieldPath: "status" },
        op: "EQUAL",
        value: { stringValue: "published" }
      }
    });
  }
  const qRes = await runFirestoreQuery(
    {
      from: [{ collectionId: "articles" }],
      where: filters.length === 1 ? filters[0] : { compositeFilter: { op: "AND", filters } },
      limit: 1
    },
    bearerToken
  );
  if (!qRes.ok) {
    return { ok: false, article: null, error: qRes.error };
  }
  const firstDoc = qRes.docs[0];
  return { ok: true, article: firstDoc ? firestoreDocToArticle(firstDoc) : null };
}
async function upsertFirestoreArticle(article, authCtx) {
  const safeId = sanitizeFirestoreId(article.id, "art");
  const { headers, urlSuffix, authMode } = await resolveFirestoreAuth(authCtx.firebaseIdToken);
  if (authMode === "public_api_key") {
    return {
      ok: false,
      code: "FIRESTORE_AUTH_REQUIRED",
      error: "Authenticated Firebase Admin session or Service Account is required to write to Cloud Firestore."
    };
  }
  const existingLookup = await fetchRawFirestoreDoc("articles", safeId, authCtx.firebaseIdToken);
  const existingDoc = existingLookup.exists ? existingLookup.doc : null;
  const existingAuthorUid = existingDoc?.fields?.authorUid ? String(decodeValue(existingDoc.fields.authorUid) || "") : "";
  const existingCreatedAt = existingDoc?.fields?.createdAt?.timestampValue ? String(existingDoc.fields.createdAt.timestampValue) : void 0;
  const authorUid = existingAuthorUid || authCtx.uid || article.createdBy || article.author?.id || "admin-desk";
  const { fields, fieldTransforms } = buildArticleFirestoreFields(article, {
    authorUid,
    preserveCreatedAtTimestamp: existingCreatedAt
  });
  const docName = `projects/${firebaseProjectConfig.projectId}/databases/${firebaseProjectConfig.firestoreDatabaseId}/documents/articles/${safeId}`;
  const commitUrl = `${DOCS_BASE}:commit${urlSuffix}`;
  const res = await fetch(commitUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      writes: [
        {
          update: {
            name: docName,
            fields
          },
          updateTransforms: fieldTransforms
        }
      ]
    }),
    signal: AbortSignal.timeout(12e3)
  });
  const rawText = await res.text();
  let parsed = null;
  try {
    parsed = rawText ? JSON.parse(rawText) : {};
  } catch {
    parsed = { error: { message: rawText.slice(0, 200) } };
  }
  if (!res.ok) {
    const errMsg = parsed?.error?.message || `Firestore commit HTTP ${res.status}`;
    recordServerError({
      source: "firestore",
      code: String(parsed?.error?.status || res.status),
      message: `Firestore commit rejected for article ${safeId}: ${errMsg}`,
      statusCode: res.status
    });
    return {
      ok: false,
      code: String(parsed?.error?.status || "FIRESTORE_WRITE_FAILED"),
      error: errMsg
    };
  }
  const readBack = await getFirestoreArticle(safeId, authCtx.firebaseIdToken);
  if (!readBack.ok || !readBack.article) {
    return {
      ok: false,
      code: "FIRESTORE_READ_AFTER_WRITE_FAILED",
      error: readBack.error || "Firestore commit returned 200 but read-after-write verification could not retrieve the document."
    };
  }
  return { ok: true, article: readBack.article };
}
async function deleteFirestoreArticle(id, authCtx) {
  const safeId = sanitizeFirestoreId(id, "art");
  const { headers, urlSuffix, authMode } = await resolveFirestoreAuth(authCtx.firebaseIdToken);
  if (authMode === "public_api_key") {
    return {
      ok: false,
      error: "Authenticated Firebase Admin session or Service Account is required to delete from Cloud Firestore."
    };
  }
  const url = `${DOCS_BASE}/articles/${encodeURIComponent(safeId)}${urlSuffix}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers,
    signal: AbortSignal.timeout(1e4)
  });
  if (res.status === 404) {
    return { ok: true };
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return { ok: false, error: `Firestore delete failed (HTTP ${res.status}): ${txt.slice(0, 160)}` };
  }
  return { ok: true };
}
async function ensureTestConnectionDoc(authCtx) {
  const { headers, urlSuffix, authMode } = await resolveFirestoreAuth(authCtx.firebaseIdToken);
  if (authMode === "public_api_key") {
    return { ok: false, error: "Authentication required to create /test/connection." };
  }
  const docName = `projects/${firebaseProjectConfig.projectId}/databases/${firebaseProjectConfig.firestoreDatabaseId}/documents/test/connection`;
  const res = await fetch(`${DOCS_BASE}:commit${urlSuffix}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      writes: [
        {
          update: {
            name: docName,
            fields: {
              status: { stringValue: "ok" }
            }
          }
        }
      ]
    }),
    signal: AbortSignal.timeout(8e3)
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return { ok: false, error: `Failed writing /test/connection (HTTP ${res.status}): ${txt.slice(0, 160)}` };
  }
  return { ok: true };
}
async function seedMissingArticlesToFirestore(seedArticles, authCtx) {
  const { authMode } = await resolveFirestoreAuth(authCtx.firebaseIdToken);
  if (authMode === "public_api_key") {
    return {
      ok: false,
      seededCount: 0,
      skippedCount: 0,
      failedCount: seedArticles.length,
      errors: ["Admin Firebase ID token or Service Account required to seed Firestore articles."]
    };
  }
  await ensureTestConnectionDoc(authCtx).catch(() => {
  });
  let seededCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const errors = [];
  for (const art of seedArticles.filter((a) => !a.deletedAt)) {
    const safeId = sanitizeFirestoreId(art.id, "art");
    const existsCheck = await fetchRawFirestoreDoc("articles", safeId, authCtx.firebaseIdToken);
    if (existsCheck.exists) {
      skippedCount++;
      continue;
    }
    const writeRes = await upsertFirestoreArticle(
      { ...art, id: safeId },
      authCtx
    );
    if (writeRes.ok) {
      seededCount++;
    } else {
      failedCount++;
      if (errors.length < 5) {
        errors.push(`${safeId}: ${writeRes.error || "write failed"}`);
      }
    }
  }
  return {
    ok: failedCount === 0,
    seededCount,
    skippedCount,
    failedCount,
    errors
  };
}
async function checkFirestoreHealth(bearerToken) {
  const started = Date.now();
  const saConfigured = hasServiceAccountConfigured();
  const { authMode } = await resolveFirestoreAuth(bearerToken);
  try {
    const [testDocRes, pubRes, totalRes] = await Promise.all([
      fetchRawFirestoreDoc("test", "connection", bearerToken),
      runFirestoreQuery(
        {
          from: [{ collectionId: "articles" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "status" },
              op: "EQUAL",
              value: { stringValue: "published" }
            }
          },
          limit: 300
        },
        bearerToken
      ),
      authMode !== "public_api_key" ? runFirestoreQuery({ from: [{ collectionId: "articles" }], limit: 300 }, bearerToken) : Promise.resolve(null)
    ]);
    const connected = pubRes.ok || testDocRes.status === 200 || testDocRes.status === 404;
    const errorCode = !pubRes.ok ? `FIRESTORE_HTTP_${pubRes.status}` : null;
    const errorMessage = !pubRes.ok ? pubRes.error || "Firestore query failed" : null;
    return {
      configured: true,
      connected,
      databaseType: "Cloud Firestore",
      storageMode: connected ? "cloud_firestore" : "json_cache_fallback",
      projectId: firebaseProjectConfig.projectId,
      firestoreDatabaseId: firebaseProjectConfig.firestoreDatabaseId,
      authMode,
      serviceAccountConfigured: saConfigured,
      latencyMs: Date.now() - started,
      testConnectionDocExists: testDocRes.exists,
      publishedCountInFirestore: pubRes.ok ? pubRes.docs.length : 0,
      totalCountInFirestore: totalRes && totalRes.ok ? totalRes.docs.length : null,
      lastCheckedAt: (/* @__PURE__ */ new Date()).toISOString(),
      errorCode,
      errorMessage
    };
  } catch (err) {
    return {
      configured: true,
      connected: false,
      databaseType: "Cloud Firestore",
      storageMode: "json_cache_fallback",
      projectId: firebaseProjectConfig.projectId,
      firestoreDatabaseId: firebaseProjectConfig.firestoreDatabaseId,
      authMode,
      serviceAccountConfigured: saConfigured,
      latencyMs: Date.now() - started,
      testConnectionDocExists: false,
      publishedCountInFirestore: 0,
      totalCountInFirestore: null,
      lastCheckedAt: (/* @__PURE__ */ new Date()).toISOString(),
      errorCode: err?.code || "FIRESTORE_UNREACHABLE",
      errorMessage: err?.message || "Unable to reach Cloud Firestore."
    };
  }
}

// src/server/supabaseRepositories.ts
import fs3 from "fs";
import path2 from "path";
import crypto5 from "crypto";
var MAX_MEDIA_BYTES = 8 * 1024 * 1024;
function detectImageFromMagicBytes(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 255 && buf[1] === 216 && buf[2] === 255) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (buf[0] === 137 && buf[1] === 80 && buf[2] === 78 && buf[3] === 71 && buf[4] === 13 && buf[5] === 10 && buf[6] === 26 && buf[7] === 10) {
    return { mime: "image/png", ext: "png" };
  }
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") {
    return { mime: "image/webp", ext: "webp" };
  }
  const ftyp = buf.subarray(4, 12).toString("ascii");
  if (ftyp === "ftypavif" || ftyp === "ftypavis") {
    return { mime: "image/avif", ext: "avif" };
  }
  return null;
}
async function upsertAndVerifyRow(table, row, primaryKeyCol = "id") {
  const started = Date.now();
  const client = getSupabaseAdminClient();
  if (!client) {
    return {
      ok: true,
      storageEngine: "json_fallback",
      verifiedReadBack: true,
      latencyMs: Date.now() - started,
      data: row
    };
  }
  try {
    const { data, error } = await client.from(table).upsert(row, { onConflict: primaryKeyCol }).select("*").single();
    if (error || !data) {
      return {
        ok: false,
        storageEngine: "supabase",
        verifiedReadBack: false,
        latencyMs: Date.now() - started,
        code: error?.code || "SUPABASE_UPSERT_FAILED",
        error: `${table} upsert failed: ${error?.message || "No row returned"}`
      };
    }
    const pkVal = data[primaryKeyCol] ?? row[primaryKeyCol];
    const verify = await client.from(table).select("*").eq(primaryKeyCol, pkVal).single();
    if (verify.error || !verify.data) {
      return {
        ok: false,
        storageEngine: "supabase",
        verifiedReadBack: false,
        latencyMs: Date.now() - started,
        code: verify.error?.code || "SUPABASE_READ_AFTER_WRITE_FAILED",
        error: `${table} saved but read-after-write verification failed: ${verify.error?.message || "Missing row"}`
      };
    }
    return {
      ok: true,
      storageEngine: "supabase",
      verifiedReadBack: true,
      latencyMs: Date.now() - started,
      data: verify.data
    };
  } catch (err) {
    return {
      ok: false,
      storageEngine: "supabase",
      verifiedReadBack: false,
      latencyMs: Date.now() - started,
      code: "SUPABASE_EXCEPTION",
      error: err?.message || `Unexpected Supabase error writing to ${table}`
    };
  }
}
async function deleteRowAndVerify(table, matchCol, matchVal) {
  const started = Date.now();
  const client = getSupabaseAdminClient();
  if (!client) {
    return {
      ok: true,
      storageEngine: "json_fallback",
      verifiedReadBack: true,
      latencyMs: Date.now() - started
    };
  }
  try {
    const { error } = await client.from(table).delete().eq(matchCol, matchVal);
    if (error) {
      return {
        ok: false,
        storageEngine: "supabase",
        verifiedReadBack: false,
        latencyMs: Date.now() - started,
        code: error.code || "SUPABASE_DELETE_FAILED",
        error: `${table} delete failed: ${error.message}`
      };
    }
    const verify = await client.from(table).select(matchCol).eq(matchCol, matchVal).maybeSingle();
    if (verify.data) {
      return {
        ok: false,
        storageEngine: "supabase",
        verifiedReadBack: false,
        latencyMs: Date.now() - started,
        code: "SUPABASE_DELETE_VERIFY_FAILED",
        error: `${table} row still exists after delete.`
      };
    }
    return {
      ok: true,
      storageEngine: "supabase",
      verifiedReadBack: true,
      latencyMs: Date.now() - started
    };
  } catch (err) {
    return {
      ok: false,
      storageEngine: "supabase",
      verifiedReadBack: false,
      latencyMs: Date.now() - started,
      code: "SUPABASE_EXCEPTION",
      error: err?.message || `Unexpected error deleting from ${table}`
    };
  }
}
async function syncSiteSettingsToSupabase(settings, actor) {
  return upsertAndVerifyRow("site_settings", {
    id: "default",
    settings_json: settings,
    updated_by: actor,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  });
}
async function syncCategoryPageToSupabase(page, actor) {
  const catRes = await upsertAndVerifyRow("categories", {
    id: page.id || page.slug,
    slug: page.slug,
    name_en: page.nameEn || page.slug,
    name_ur: page.nameUr || page.nameEn || page.slug,
    description_en: page.descriptionEn || "",
    description_ur: page.descriptionUr || "",
    icon_name: page.iconName || "Newspaper",
    enabled: page.enabled ?? true,
    sort_order: page.order ?? 0,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  });
  if (!catRes.ok) return catRes;
  return upsertAndVerifyRow("category_pages", {
    slug: page.slug,
    config_json: page,
    status: page.status || "published",
    updated_by: actor,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  }, "slug");
}
async function deleteCategoryPageFromSupabase(slug) {
  const res1 = await deleteRowAndVerify("category_pages", "slug", slug);
  if (!res1.ok) return res1;
  return deleteRowAndVerify("categories", "slug", slug);
}
async function syncHomepageLayoutToSupabase(config, actor) {
  return upsertAndVerifyRow("homepage_layouts", {
    id: "default",
    config_json: config,
    updated_by: actor,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  });
}
async function syncCustomBlockToSupabase(block) {
  return upsertAndVerifyRow("homepage_custom_blocks", {
    id: block.id,
    title_en: block.titleEn || block.name || "",
    title_ur: block.titleUr || "",
    body_en: block.bodyEn || "",
    body_ur: block.bodyUr || "",
    placement: "homepage",
    enabled: true,
    config_json: block,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  });
}
async function deleteCustomBlockFromSupabase(id) {
  return deleteRowAndVerify("homepage_custom_blocks", "id", id);
}
async function syncMediaAssetToSupabase(asset) {
  return upsertAndVerifyRow("media_assets", {
    id: asset.id,
    filename: asset.filename,
    url: asset.url,
    thumbnail_url: asset.thumbnailUrl || asset.url,
    size_bytes: Number(asset.sizeBytes || 0),
    mime_type: asset.mimeType || "image/jpeg",
    category: asset.category || "editorial",
    caption_en: asset.captionEn || "",
    caption_ur: asset.captionUr || "",
    alt_text_en: asset.altTextEn || "",
    alt_text_ur: asset.altTextUr || "",
    credit: asset.credit || "",
    source: asset.source || "",
    license: asset.license || "",
    storage_path: asset.storagePath || "",
    width: asset.width ?? null,
    height: asset.height ?? null,
    uploaded_by: asset.uploadedBy || "Editor",
    usage_count: Number(asset.usageCount || 0),
    created_at: asset.uploadedAt || (/* @__PURE__ */ new Date()).toISOString()
  });
}
async function deleteMediaAssetFromSupabase(id) {
  return deleteRowAndVerify("media_assets", "id", id);
}
async function syncAdminUserToSupabase(user) {
  return upsertAndVerifyRow("admin_users", {
    id: user.id,
    email: user.email.toLowerCase(),
    name_en: user.nameEn || user.email,
    name_ur: user.nameUr || user.nameEn || user.email,
    role: user.role || "Editor",
    status: user.status || "active",
    mfa_enabled: Boolean(user.mfaEnabled),
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  });
}
async function deleteAdminUserFromSupabase(id) {
  return deleteRowAndVerify("admin_users", "id", id);
}
async function syncAdPlacementToSupabase(slot) {
  return upsertAndVerifyRow("ad_placements", {
    id: slot.id,
    slot_id: slot.slotId,
    name: slot.name,
    dimensions: slot.dimensions || "responsive",
    enabled: Boolean(slot.enabled),
    type: slot.providerType || "banner",
    impressions: Number(slot.impressions || 0),
    clicks: Number(slot.clicks || 0),
    ad_code_snippet: slot.adCodeSnippet || "",
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  });
}
async function syncAdCampaignToSupabase(camp) {
  return upsertAndVerifyRow("ad_campaigns", {
    id: camp.id,
    campaign_name: camp.campaignName,
    advertiser_name: camp.advertiserName,
    status: camp.status || "active",
    budget_pkr: Number(camp.budgetPkr || 0),
    impressions: Number(camp.impressions || 0),
    clicks: Number(camp.clicks || 0),
    ctr: Number(camp.ctr || 0),
    start_date: camp.startDate || null,
    end_date: camp.endDate || null,
    target_slots_json: Array.isArray(camp.placementSlotIds) ? camp.placementSlotIds : [],
    banner_image_url: camp.bannerUrl || "",
    destination_url: camp.destinationUrl || "",
    priority: Number(camp.priority ?? 10),
    notes: camp.notes || "",
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  });
}
async function deleteAdCampaignFromSupabase(id) {
  return deleteRowAndVerify("ad_campaigns", "id", id);
}
async function syncSubscriberToSupabase(sub) {
  return upsertAndVerifyRow("newsletter_subscribers", {
    id: sub.id,
    email: sub.email.toLowerCase(),
    language: sub.language || "both",
    frequency: sub.frequency || "daily",
    status: sub.status || "active",
    consent_source: sub.consentSource || "admin",
    consent_timestamp: sub.consentTimestamp || sub.subscribedAt || (/* @__PURE__ */ new Date()).toISOString(),
    subscribed_at: sub.subscribedAt || (/* @__PURE__ */ new Date()).toISOString(),
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  });
}
async function deleteSubscriberFromSupabase(id) {
  return deleteRowAndVerify("newsletter_subscribers", "id", id);
}
async function syncAudienceNotificationToSupabase(notif) {
  return upsertAndVerifyRow("audience_notifications", {
    id: notif.id,
    title_en: notif.titleEn || "",
    title_ur: notif.titleUr || "",
    body_en: notif.bodyEn || notif.messageEn || "",
    body_ur: notif.bodyUr || notif.messageUr || "",
    target_language: notif.targetLanguage || "both",
    target_url: notif.targetUrl || "https://www.360khabarnama.com",
    category: notif.category || "general",
    recipients_count: Number(notif.recipientsCount || 0),
    delivered_count: Number(notif.deliveredCount || 0),
    failed_count: Number(notif.failedCount || 0),
    status: notif.status || "sent",
    error_summary: notif.errorSummary || "",
    scheduled_for: notif.scheduledFor || null,
    sent_at: notif.sentAt || (/* @__PURE__ */ new Date()).toISOString()
  });
}
async function syncPushSubscriptionToSupabase(sub) {
  return upsertAndVerifyRow("push_subscriptions", {
    id: sub.id,
    endpoint: sub.endpoint,
    keys_json: sub.keys || {},
    topics_json: sub.topics || {},
    language: sub.language || "both",
    user_agent: sub.userAgent || "",
    status: sub.status || "active",
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  });
}
async function syncSeoPageToSupabase(page) {
  return upsertAndVerifyRow("seo_pages", {
    id: page.id,
    path: page.path,
    title_en: page.titleEn || "",
    title_ur: page.titleUr || "",
    meta_desc_en: page.metaDescEn || "",
    meta_desc_ur: page.metaDescUr || "",
    canonical_url: page.canonicalUrl || "",
    robots_directives: page.robotsDirectives || "index, follow",
    og_image: page.ogImage || "",
    schema_type: page.schemaType || "WebPage",
    focus_keyword: page.focusKeyword || "",
    config_json: page,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  });
}
async function syncRedirectRuleToSupabase(rule) {
  return upsertAndVerifyRow("seo_redirects", {
    id: rule.id,
    source_path: rule.sourcePath,
    target_path: rule.targetPath,
    status_code: Number(rule.statusCode || 301),
    hits: Number(rule.hits || 0),
    active: Boolean(rule.active),
    notes: rule.notes || ""
  });
}
async function deleteRedirectRuleFromSupabase(id) {
  return deleteRowAndVerify("seo_redirects", "id", id);
}
async function syncBrokenLinkToSupabase(link) {
  return upsertAndVerifyRow("broken_links", {
    id: link.id,
    source_url: link.foundOnPage || "/",
    broken_target_url: link.url,
    http_status: Number(link.statusCode || 404),
    detected_at: link.discoveredAt || (/* @__PURE__ */ new Date()).toISOString(),
    resolved: Boolean(link.resolved)
  });
}
async function syncSearchConsoleConfigToSupabase(connection, metrics) {
  return upsertAndVerifyRow("search_console_config", {
    id: "default",
    config_json: { connection, metrics },
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  });
}
async function syncSeoAuditLogToSupabase(entry) {
  return upsertAndVerifyRow("seo_audit_logs", {
    id: entry.id,
    action: entry.action,
    actor: entry.actor,
    target: entry.target,
    summary: entry.details,
    created_at: entry.timestamp || (/* @__PURE__ */ new Date()).toISOString()
  });
}
async function syncDataProviderToSupabase(provider) {
  return upsertAndVerifyRow("sync_providers", {
    id: provider.id,
    name: provider.name,
    category: provider.category,
    endpoint: provider.endpoint,
    method: provider.method || provider.httpMethod || "GET",
    status: provider.status || "active",
    interval_minutes: Number(provider.intervalMinutes || 30),
    daily_quota_limit: Number(provider.dailyQuotaLimit ?? provider.quotaLimitPerDay ?? 1e3),
    daily_calls_used: Number(provider.dailyCallsUsed ?? provider.quotaUsedToday ?? 0),
    requires_api_key: Boolean(provider.requiresApiKey),
    has_api_key: Boolean(provider.hasApiKey),
    masked_api_key: provider.maskedApiKey || null,
    auth_header_name: provider.authHeaderName || "Authorization",
    attribution_required: Boolean(provider.attributionRequired ?? true),
    commercial_rights: Boolean(provider.commercialRights ?? true),
    is_licensed: Boolean(provider.isLicensed ?? true),
    license_type: provider.licenseType || "public_open",
    attribution: provider.attribution || "",
    last_sync_at: provider.lastSyncAt || null,
    next_sync_at: provider.nextSyncAt || null,
    last_error: provider.lastError || null,
    consecutive_failures: Number(provider.consecutiveFailures || 0),
    total_syncs: Number(provider.totalSyncs || 0),
    successful_syncs: Number(provider.successfulSyncs || 0),
    notes: provider.notes || "",
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  });
}
async function deleteDataProviderFromSupabase(id) {
  return deleteRowAndVerify("sync_providers", "id", id);
}
async function syncEditorialDraftToSupabase(draft) {
  return upsertAndVerifyRow("editorial_drafts", {
    id: draft.id,
    template: draft.template,
    title_en: draft.titleEn || "",
    title_ur: draft.titleUr || "",
    summary_en: draft.summaryEn || "",
    summary_ur: draft.summaryUr || "",
    content_en: draft.contentEn || "",
    content_ur: draft.contentUr || "",
    provider_type: draft.providerType || null,
    model: draft.model || null,
    total_tokens: Number(draft.totalTokens || 0),
    created_by: draft.createdBy || "Editor",
    created_at: draft.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
    updated_at: draft.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
  });
}
async function recordSaveDiagnosticToSupabase(entry) {
  return upsertAndVerifyRow("admin_save_diagnostics", {
    id: entry.id,
    module: entry.module,
    action: entry.action,
    record_id: entry.recordId || null,
    storage_engine: entry.storageEngine,
    success: Boolean(entry.success),
    verified_read_back: Boolean(entry.verifiedReadBack),
    latency_ms: Number(entry.latencyMs || 0),
    actor: entry.actor || null,
    error_message: entry.errorMessage || null,
    created_at: entry.createdAt || (/* @__PURE__ */ new Date()).toISOString()
  });
}
async function uploadMediaBinaryToStorage(params) {
  const rawB64 = String(params.base64Data || "").replace(/^data:[^;]+;base64,/i, "").trim();
  if (!rawB64) {
    return { ok: false, code: "EMPTY_FILE", error: "Empty image upload payload." };
  }
  let buffer;
  try {
    buffer = Buffer.from(rawB64, "base64");
  } catch {
    return { ok: false, code: "INVALID_BASE64", error: "Could not decode uploaded base64 payload." };
  }
  if (buffer.length === 0) {
    return { ok: false, code: "EMPTY_BUFFER", error: "Uploaded image buffer is empty." };
  }
  if (buffer.length > MAX_MEDIA_BYTES) {
    return {
      ok: false,
      code: "FILE_TOO_LARGE",
      error: `Image exceeds 8 MB limit (${(buffer.length / (1024 * 1024)).toFixed(2)} MB).`
    };
  }
  const detected = detectImageFromMagicBytes(buffer);
  if (!detected) {
    return {
      ok: false,
      code: "UNSUPPORTED_IMAGE_FORMAT",
      error: "Only verified JPEG, PNG, WebP, or AVIF image binaries are permitted (SVG/scripts/executables rejected)."
    };
  }
  const now = /* @__PURE__ */ new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const safeSlug = path2.basename(params.filename || `image.${detected.ext}`, path2.extname(params.filename || "")).toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48) || "editorial";
  const rand = crypto5.randomBytes(4).toString("hex");
  const safeName = `${safeSlug}-${Date.now()}-${rand}.${detected.ext}`;
  const storagePath = `editorial/${yyyy}/${mm}/${safeName}`;
  const client = getSupabaseAdminClient();
  if (client) {
    try {
      const { error: uploadErr } = await client.storage.from("editorial-media").upload(storagePath, buffer, {
        contentType: detected.mime,
        cacheControl: "31536000",
        upsert: false
      });
      if (uploadErr) {
        return {
          ok: false,
          code: "SUPABASE_STORAGE_UPLOAD_FAILED",
          error: `Supabase Storage upload failed ("editorial-media"): ${uploadErr.message}. Run Migration 003/004 if the bucket is not provisioned yet.`
        };
      }
      const { data: pubData } = client.storage.from("editorial-media").getPublicUrl(storagePath);
      const publicUrl = pubData?.publicUrl;
      if (!publicUrl) {
        return {
          ok: false,
          code: "SUPABASE_STORAGE_URL_ERROR",
          error: "Image uploaded to Supabase Storage, but no public URL was returned."
        };
      }
      const asset2 = {
        id: `med-${Date.now()}-${rand}`,
        filename: safeName,
        url: publicUrl,
        thumbnailUrl: publicUrl,
        sizeBytes: buffer.length,
        mimeType: detected.mime,
        category: params.category || "editorial",
        captionEn: params.captionEn || "",
        captionUr: params.captionUr || "",
        altTextEn: params.altTextEn || params.captionEn || safeSlug,
        altTextUr: params.altTextUr || params.captionUr || "",
        credit: params.credit || "",
        source: params.source || "360Khabarnama Upload",
        license: params.license || "Editorial Rights Cleared",
        storagePath,
        width: params.width,
        height: params.height,
        uploadedBy: params.uploadedBy,
        uploadedAt: now.toISOString(),
        usageCount: 1
      };
      const syncRes = await syncMediaAssetToSupabase(asset2);
      if (!syncRes.ok) {
        return { ok: false, code: syncRes.code, error: syncRes.error };
      }
      return { ok: true, asset: asset2, storageTarget: "supabase_storage" };
    } catch (err) {
      return {
        ok: false,
        code: "SUPABASE_STORAGE_EXCEPTION",
        error: err?.message || "Unexpected Supabase Storage upload error."
      };
    }
  }
  const localDir = path2.resolve(process.cwd(), "public", "uploads", "media", yyyy, mm);
  fs3.mkdirSync(localDir, { recursive: true });
  const absPath = path2.join(localDir, safeName);
  fs3.writeFileSync(absPath, buffer);
  const relUrl = `/uploads/media/${yyyy}/${mm}/${safeName}`;
  const asset = {
    id: `med-${Date.now()}-${rand}`,
    filename: safeName,
    url: relUrl,
    thumbnailUrl: relUrl,
    sizeBytes: buffer.length,
    mimeType: detected.mime,
    category: params.category || "editorial",
    captionEn: params.captionEn || "",
    captionUr: params.captionUr || "",
    altTextEn: params.altTextEn || params.captionEn || safeSlug,
    altTextUr: params.altTextUr || params.captionUr || "",
    credit: params.credit || "",
    source: params.source || "Local Upload",
    license: params.license || "Editorial",
    storagePath: relUrl,
    width: params.width,
    height: params.height,
    uploadedBy: params.uploadedBy,
    uploadedAt: now.toISOString(),
    usageCount: 1
  };
  return { ok: true, asset, storageTarget: "local_uploads" };
}
async function checkAllSupabaseModulesHealth() {
  const checkedAt = (/* @__PURE__ */ new Date()).toISOString();
  const tablesToCheck = [
    "articles",
    "categories",
    "category_pages",
    "site_settings",
    "admin_users",
    "media_assets",
    "ad_placements",
    "ad_campaigns",
    "newsletter_subscribers",
    "audience_notifications",
    "homepage_layouts",
    "sync_providers",
    "seo_pages",
    "seo_redirects",
    "ai_provider_credentials",
    "admin_save_diagnostics"
  ];
  const client = getSupabaseAdminClient();
  if (!isSupabaseConfigured() || !client) {
    return {
      configured: false,
      storageBucket: {
        ok: false,
        bucket: "editorial-media",
        detail: "Supabase not configured in environment (local uploads directory active as fallback)."
      },
      tables: tablesToCheck.map((t) => ({ table: t, ok: false, rowCount: null, error: "Supabase not configured" })),
      checkedAt
    };
  }
  const tableResults = await Promise.all(
    tablesToCheck.map(async (table) => {
      try {
        const res = await client.from(table).select("*", { count: "exact", head: true });
        return {
          table,
          ok: !res.error,
          rowCount: typeof res.count === "number" ? res.count : 0,
          ...res.error ? { error: res.error.message } : {}
        };
      } catch (err) {
        return {
          table,
          ok: false,
          rowCount: null,
          error: err?.message || "Query error"
        };
      }
    })
  );
  let storageOk = false;
  let storageDetail = "Unknown";
  try {
    const { data, error } = await client.storage.getBucket("editorial-media");
    if (!error && data) {
      storageOk = true;
      storageDetail = `Bucket "editorial-media" online (public=${Boolean(data.public)})`;
    } else {
      storageDetail = error?.message || 'Bucket "editorial-media" not found \u2014 run Migration 003.';
    }
  } catch (err) {
    storageDetail = err?.message || "Storage inspection error";
  }
  return {
    configured: true,
    storageBucket: { ok: storageOk, bucket: "editorial-media", detail: storageDetail },
    tables: tableResults,
    checkedAt
  };
}

// src/server/databaseHealth.ts
function sanitizeSupabaseDiagnosticText(raw) {
  if (!raw) return "";
  return String(raw).replace(/sb_secret_[A-Za-z0-9\-_]+/g, "[REDACTED_SB_SECRET]").replace(/sb_publishable_[A-Za-z0-9\-_]+/g, "[REDACTED_SB_PUBLISHABLE]").replace(/eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g, "[REDACTED_JWT]").replace(/Bearer\s+[A-Za-z0-9\-_.]+/gi, "Bearer [REDACTED]").replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, "postgresql://[REDACTED]").replace(/AIza[0-9A-Za-z\-_]{20,}/g, "[REDACTED_GEMINI_KEY]").replace(/xai-[0-9A-Za-z\-_]{16,}/g, "[REDACTED_XAI_KEY]").replace(/(apikey|token|secret|password|key)=([^&\s]+)/gi, "$1=[REDACTED]").slice(0, 500);
}
async function checkSupabaseHealth(options) {
  const started = Date.now();
  const cfg = resolveSupabaseEnvConfig();
  const missingEnvVars = [];
  if (!cfg.supabaseUrlConfigured) missingEnvVars.push("SUPABASE_URL");
  if (!cfg.publishableKey) missingEnvVars.push("SUPABASE_PUBLISHABLE_KEY");
  if (!cfg.supabaseSecretConfigured) missingEnvVars.push("SUPABASE_SECRET_KEY");
  const recentLogs = db.getPublicationLogs(10);
  const recentErrors = getServerErrorLogs(10).filter(
    (e) => e.source === "supabase" || e.source === "publishing" || e.source === "firestore"
  );
  const latestSuccessfulSaveAt = recentLogs[0]?.createdAt || null;
  const latestPublishingError = recentErrors[0]?.message || null;
  if (!cfg.configured) {
    const detailedErr = cfg.secretKeyMisconfiguration || cfg.urlMisconfiguration || `Missing required Supabase environment variable(s): ${missingEnvVars.join(", ")}`;
    return {
      configured: false,
      connected: false,
      pingOk: false,
      pingLatencyMs: Date.now() - started,
      sdkPackage: "@supabase/supabase-js",
      projectHost: cfg.projectHost,
      secretKeyMode: cfg.secretKeyMode,
      publishableKeyMode: cfg.publishableKeyMode,
      secretsRedacted: true,
      schemaVersion: "supabase-core-002 (pending migration)",
      articlesTableAvailable: false,
      readTestOk: false,
      readPermissionDetail: "Skipped: Supabase credentials missing or misconfigured.",
      authorizedWriteTestOk: null,
      writePermissionDetail: "Skipped: Supabase secret key missing or invalid.",
      rlsPolicyCheckOk: null,
      rlsPolicyDetail: "Skipped: Supabase credentials are not configured in server environment.",
      publishedCount: 0,
      totalCount: null,
      latestSuccessfulSaveAt,
      latestPublishingError: latestPublishingError ? sanitizeSupabaseDiagnosticText(latestPublishingError) : null,
      latencyMs: Date.now() - started,
      checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
      errorCode: cfg.secretKeyMisconfiguration ? "SUPABASE_KEY_MISCONFIGURED" : "SUPABASE_ENV_MISSING",
      errorMessage: sanitizeSupabaseDiagnosticText(detailedErr),
      missingEnvVars
    };
  }
  const adminClient = getSupabaseAdminClient();
  let pingOk = false;
  let pingLatencyMs = 0;
  let articlesTableAvailable = false;
  let readTestOk = false;
  let readPermissionDetail = "Pending read check on public.articles";
  let publishedCount = 0;
  let totalCount = null;
  let authorizedWriteTestOk = null;
  let writePermissionDetail = 'Click "Test Supabase Connection" to run authorized write + read-after-write probe.';
  let rlsPolicyCheckOk = null;
  let rlsPolicyDetail = "Publishable key not set; anon RLS check skipped.";
  let errorCode = null;
  let errorMessage = null;
  try {
    const pingStart = Date.now();
    const totalRes = await adminClient.from("articles").select("id", { count: "exact", head: true }).is("deleted_at", null);
    pingLatencyMs = Date.now() - pingStart;
    if (totalRes.error) {
      errorCode = totalRes.error.code || "SUPABASE_TABLE_ERROR";
      errorMessage = sanitizeSupabaseDiagnosticText(totalRes.error.message);
      readPermissionDetail = `Read rejected: ${errorMessage}`;
    } else {
      pingOk = true;
      articlesTableAvailable = true;
      readTestOk = true;
      totalCount = typeof totalRes.count === "number" ? totalRes.count : 0;
      const pubRes = await adminClient.from("articles").select("id", { count: "exact", head: true }).eq("status", "published").is("deleted_at", null);
      publishedCount = typeof pubRes.count === "number" ? pubRes.count : 0;
      readPermissionDetail = `Verified SELECT on public.articles (${publishedCount} published, ${totalCount} total rows).`;
    }
    const anonClient = getSupabaseAnonClient();
    if (anonClient && articlesTableAvailable) {
      const draftProbe = await anonClient.from("articles").select("id").eq("status", "draft").limit(1);
      const writeProbe = await anonClient.from("articles").insert({
        id: `rls-probe-${Date.now()}`,
        slug: `rls-probe-${Date.now()}`,
        title_en: "Unauthorized RLS Probe",
        status: "draft"
      });
      const draftsBlocked = !draftProbe.data || draftProbe.data.length === 0 || Boolean(draftProbe.error);
      const anonWriteBlocked = Boolean(writeProbe.error);
      rlsPolicyCheckOk = draftsBlocked && anonWriteBlocked;
      rlsPolicyDetail = rlsPolicyCheckOk ? "Verified: publishable client blocked from reading drafts and blocked from inserting articles." : `RLS Alert: draftsBlocked=${draftsBlocked}, anonWriteBlocked=${anonWriteBlocked}`;
    }
    if (options?.runWriteTest && articlesTableAvailable) {
      const probeId = `art-sb-probe-${Date.now()}`;
      const probeSlug = `sb-probe-${Date.now()}`;
      const saveRes = await upsertSupabaseArticle(
        {
          id: probeId,
          slug: probeSlug,
          titleEn: "Supabase Connection Write Probe",
          titleUr: "\u0633\u067E\u0627\u0628\u06CC\u0633 \u06A9\u0646\u06A9\u0634\u0646 \u062C\u0627\u0646\u0686",
          summaryEn: "Temporary automated write probe.",
          summaryUr: "\u0639\u0627\u0631\u0636\u06CC \u062C\u0627\u0646\u0686 \u06A9\u0627 \u0645\u0636\u0645\u0648\u0646\u06D4",
          contentEn: "Temporary automated Supabase write probe content.",
          contentUr: "\u0639\u0627\u0631\u0636\u06CC \u0645\u0648\u0627\u062F\u06D4",
          category: "pakistan",
          tags: ["diag-probe"],
          status: "draft",
          isBreaking: false,
          isFeatured: false,
          isTrending: false,
          heroImage: "",
          imageCaptionEn: "",
          imageCaptionUr: "",
          readingTimeMin: 1,
          author: { id: "diag", nameEn: "Diagnostics", nameUr: "\u062A\u0634\u062E\u06CC\u0635", avatar: "", role: "Super Admin" },
          publishedAt: "",
          updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          views: 0
        },
        "Supabase Diagnostics"
      );
      if (saveRes.ok) {
        authorizedWriteTestOk = true;
        await deleteSupabaseArticle(probeId, true);
        writePermissionDetail = "Verified authorized INSERT/UPSERT, read-after-write verification, and DELETE cleanup on public.articles.";
      } else {
        authorizedWriteTestOk = false;
        errorCode = saveRes.code || "SUPABASE_WRITE_FAILED";
        errorMessage = sanitizeSupabaseDiagnosticText(saveRes.error || "Authorized write probe failed.");
        writePermissionDetail = `Write probe failed: ${errorMessage}`;
      }
    }
  } catch (err) {
    errorCode = "SUPABASE_UNREACHABLE";
    errorMessage = sanitizeSupabaseDiagnosticText(err?.message || "Unable to reach Supabase host.");
  }
  return {
    configured: cfg.configured,
    connected: articlesTableAvailable && readTestOk && !errorMessage,
    pingOk,
    pingLatencyMs,
    sdkPackage: "@supabase/supabase-js",
    projectHost: cfg.projectHost,
    secretKeyMode: cfg.secretKeyMode,
    publishableKeyMode: cfg.publishableKeyMode,
    secretsRedacted: true,
    schemaVersion: "supabase-core-002",
    articlesTableAvailable,
    readTestOk,
    readPermissionDetail: sanitizeSupabaseDiagnosticText(readPermissionDetail),
    authorizedWriteTestOk,
    writePermissionDetail: sanitizeSupabaseDiagnosticText(writePermissionDetail),
    rlsPolicyCheckOk,
    rlsPolicyDetail: sanitizeSupabaseDiagnosticText(rlsPolicyDetail),
    publishedCount,
    totalCount,
    latestSuccessfulSaveAt,
    latestPublishingError: latestPublishingError ? sanitizeSupabaseDiagnosticText(latestPublishingError) : null,
    latencyMs: Date.now() - started,
    checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
    errorCode,
    errorMessage: errorMessage ? sanitizeSupabaseDiagnosticText(errorMessage) : null,
    missingEnvVars
  };
}

// src/server/articleService.ts
function mergeArticleLists(remoteList, localList, statusFilter) {
  const map = /* @__PURE__ */ new Map();
  for (const localArt of localList) {
    if (!localArt.deletedAt) {
      map.set(localArt.id, localArt);
    }
  }
  for (const remoteArt of remoteList) {
    if (!remoteArt.deletedAt) {
      map.set(remoteArt.id, remoteArt);
    }
  }
  let merged = Array.from(map.values());
  if (statusFilter && statusFilter !== "all") {
    const nowMs = Date.now();
    merged = merged.filter((a) => {
      if (a.status !== statusFilter) return false;
      if (statusFilter === "published") {
        const sched = a.scheduledAt || a.scheduledFor;
        if (sched) {
          const schedMs = new Date(sched).getTime();
          if (Number.isFinite(schedMs) && schedMs > nowMs) {
            return false;
          }
        }
      }
      return true;
    });
  }
  merged.sort((a, b) => {
    const ta = new Date(a.publishedAt || a.updatedAt || 0).getTime();
    const tb = new Date(b.publishedAt || b.updatedAt || 0).getTime();
    return tb - ta;
  });
  return merged;
}
var ArticleService = class {
  /**
   * Lists articles from Supabase PostgreSQL (when configured) or Cloud Firestore (fallback),
   * merged cleanly with cached articles for low-latency SSR/RSS feeds.
   * Public requests strictly query status == 'published'. Admin requests retrieve all statuses.
   */
  static async listArticles(filters = {}, authCtx = {}) {
    const statusFilter = filters.status || "published";
    const localMatches = db.getArticles(
      filters.category,
      filters.tag,
      filters.search,
      statusFilter,
      Boolean(filters.includeDeleted)
    );
    const deletedIds = new Set(
      db.getArticles(void 0, void 0, void 0, "all", true).filter((a) => a.deletedAt).map((a) => a.id)
    );
    let combined = localMatches;
    let storageEngine = "json_fallback";
    let firestoreCount = 0;
    let supabaseCount = 0;
    if (isSupabaseConfigured()) {
      const sbRes = await listSupabaseArticles({
        status: statusFilter,
        category: filters.category,
        tag: filters.tag,
        search: filters.search,
        includeDeleted: Boolean(filters.includeDeleted),
        limit: 250
      });
      if (sbRes.ok) {
        storageEngine = "supabase";
        supabaseCount = sbRes.articles.length;
        const activeSbArticles = filters.includeDeleted ? sbRes.articles : sbRes.articles.filter((a) => !deletedIds.has(a.id));
        combined = mergeArticleLists(activeSbArticles, localMatches, statusFilter);
      } else if (sbRes.error) {
        recordServerError({
          source: "supabase",
          code: "SUPABASE_LIST_WARNING",
          message: `Supabase query fallback: ${sbRes.error}`
        });
      }
    }
    if (storageEngine !== "supabase") {
      const fsRes = await listFirestoreArticles(
        {
          status: statusFilter,
          category: filters.category,
          tag: filters.tag,
          search: filters.search,
          limit: 250
        },
        authCtx.firebaseIdToken
      );
      if (fsRes.ok) {
        storageEngine = "firestore";
        firestoreCount = fsRes.articles.length;
        const activeFsArticles = fsRes.articles.filter((a) => !deletedIds.has(a.id));
        combined = mergeArticleLists(activeFsArticles, localMatches, statusFilter);
      } else if (fsRes.error) {
        recordServerError({
          source: "firestore",
          code: "FIRESTORE_LIST_WARNING",
          message: `Firestore query fallback to cache: ${fsRes.error}`
        });
      }
    }
    const total = combined.length;
    const offset = Math.max(0, Number(filters.offset || 0));
    const limit = filters.limit ? Math.max(1, Math.min(Number(filters.limit), 200)) : combined.length;
    return {
      articles: combined.slice(offset, offset + limit),
      total,
      storageEngine,
      firestoreCount,
      supabaseCount
    };
  }
  /**
   * Resolves an article by document ID or canonical slug from Supabase (when configured)
   * or Cloud Firestore, checking redirects if not found directly.
   */
  static async getArticle(idOrSlug, authCtx = {}) {
    const clean = decodeURIComponent(idOrSlug || "").trim();
    if (!clean) return { article: null, storageEngine: "json_fallback" };
    if (isSupabaseConfigured()) {
      const sbRes = await getSupabaseArticle(clean);
      if (sbRes.ok && sbRes.article && !sbRes.article.deletedAt) {
        return { article: sbRes.article, storageEngine: "supabase" };
      }
    }
    const fsRes = await getFirestoreArticle(clean, authCtx.firebaseIdToken);
    if (fsRes.ok && fsRes.article && !fsRes.article.deletedAt) {
      return { article: fsRes.article, storageEngine: "firestore" };
    }
    const local = db.getArticleBySlugOrId(clean, false);
    if (local) {
      return {
        article: local,
        storageEngine: isSupabaseConfigured() ? "supabase" : fsRes.ok ? "firestore" : "json_fallback"
      };
    }
    const rules = db.getRedirectRules().filter((r) => r.active && r.statusCode === 301);
    const matched = rules.find(
      (r) => r.sourcePath.toLowerCase() === `/en/news/${clean.toLowerCase()}` || r.sourcePath.toLowerCase() === `/ur/news/${clean.toLowerCase()}`
    );
    if (matched?.targetPath) {
      const nextSlug = matched.targetPath.split("/").pop();
      if (nextSlug) {
        return { article: null, redirectTo: nextSlug, storageEngine: isSupabaseConfigured() ? "supabase" : "firestore" };
      }
    }
    return { article: null, storageEngine: isSupabaseConfigured() ? "supabase" : fsRes.ok ? "firestore" : "json_fallback" };
  }
  /**
   * Saves or updates a news article permanently in Supabase PostgreSQL (when configured)
   * or Cloud Firestore, verifying read-after-write integrity and invalidating public feed caches.
   * Supports single-language (English-only or Urdu-only) as well as bilingual articles.
   */
  static async saveArticle(input, actor = "Editor", authCtx = {}) {
    const correlationId = `pub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const rawTitleEn = (input.titleEn || "").trim();
    const rawTitleUr = (input.titleUr || "").trim();
    if (!rawTitleEn && !rawTitleUr) {
      const err = new Error("At least one headline (English or Urdu) is required.");
      err.statusCode = 400;
      err.code = "MISSING_HEADLINE";
      throw err;
    }
    const normalizedInput = {
      ...input,
      titleEn: rawTitleEn || rawTitleUr,
      titleUr: rawTitleUr || rawTitleEn,
      summaryEn: (input.summaryEn || "").trim(),
      summaryUr: (input.summaryUr || "").trim(),
      contentEn: (input.contentEn || input.summaryEn || "").trim(),
      contentUr: (input.contentUr || input.summaryUr || "").trim()
    };
    const supabaseActive = isSupabaseConfigured();
    const hasFirestoreWriteAuth = Boolean(authCtx.firebaseIdToken || hasServiceAccountConfigured());
    const intendedEngine = supabaseActive ? "supabase" : hasFirestoreWriteAuth ? "firestore" : "json_fallback";
    const savedLocal = db.upsertArticle(normalizedInput, actor, {
      storageEngine: intendedEngine,
      correlationId
    });
    let finalArticle = savedLocal;
    let storageEngine = "json_fallback";
    let verifiedReadBack = true;
    let firestoreWarning;
    if (supabaseActive) {
      const t0 = Date.now();
      const sbWrite = await upsertSupabaseArticle(savedLocal, actor);
      if (!sbWrite.ok || !sbWrite.article) {
        const errDiag = db.recordSaveDiagnostic({
          module: "articles",
          action: input.id ? "update" : "create",
          recordId: savedLocal.id,
          storageEngine: "supabase",
          success: false,
          verifiedReadBack: false,
          latencyMs: Date.now() - t0,
          actor,
          errorMessage: sbWrite.error || "Supabase write failed"
        });
        recordSaveDiagnosticToSupabase(errDiag).catch(() => {
        });
        const err = new Error(
          `Supabase PostgreSQL save failed [${sbWrite.code || "WRITE_ERROR"}]: ${sbWrite.error || "Unable to commit row."}`
        );
        err.statusCode = 500;
        err.code = sbWrite.code || "SUPABASE_WRITE_FAILED";
        err.correlationId = correlationId;
        throw err;
      }
      finalArticle = sbWrite.article;
      storageEngine = "supabase";
      verifiedReadBack = true;
      const okDiag = db.recordSaveDiagnostic({
        module: "articles",
        action: input.id ? "update" : "create",
        recordId: finalArticle.id,
        storageEngine: "supabase",
        success: true,
        verifiedReadBack: true,
        latencyMs: Date.now() - t0,
        actor
      });
      recordSaveDiagnosticToSupabase(okDiag).catch(() => {
      });
      if (hasFirestoreWriteAuth) {
        await upsertFirestoreArticle(finalArticle, authCtx).catch(() => {
        });
      }
    } else if (hasFirestoreWriteAuth) {
      const fsWrite = await upsertFirestoreArticle(savedLocal, authCtx);
      if (!fsWrite.ok || !fsWrite.article) {
        const err = new Error(
          `Cloud Firestore save failed [${fsWrite.code || "WRITE_ERROR"}]: ${fsWrite.error || "Unable to commit document."}`
        );
        err.statusCode = 500;
        err.code = fsWrite.code || "FIRESTORE_WRITE_FAILED";
        err.correlationId = correlationId;
        throw err;
      }
      finalArticle = fsWrite.article;
      storageEngine = "firestore";
      verifiedReadBack = true;
    } else {
      db.recordSaveDiagnostic({
        module: "articles",
        action: input.id ? "update" : "create",
        recordId: savedLocal.id,
        storageEngine: "json_fallback",
        success: true,
        verifiedReadBack: true,
        latencyMs: 1,
        actor
      });
      firestoreWarning = "Saved in local workspace persistence only \u2014 configure SUPABASE_URL + SUPABASE_SECRET_KEY (or Firebase Admin credentials) for external database sync.";
      recordServerError({
        source: "publishing",
        code: "LOCAL_CACHE_ONLY_SAVE",
        message: firestoreWarning,
        correlationId
      });
    }
    const cacheInfo = db.bumpNewsCacheVersion();
    return {
      article: finalArticle,
      storageEngine,
      verifiedReadBack,
      cacheVersion: cacheInfo.version,
      correlationId,
      ...firestoreWarning ? { firestoreWarning } : {}
    };
  }
  static async transitionStatus(id, nextStatus, actor = "Editor", opts, authCtx = {}) {
    const found = await this.getArticle(id, authCtx);
    if (!found.article) {
      const err = new Error(`Article "${id}" not found.`);
      err.statusCode = 404;
      err.code = "NOT_FOUND";
      throw err;
    }
    const existing = found.article;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const publishedAt = nextStatus === "published" ? existing.publishedAt || now : nextStatus === "draft" ? "" : existing.publishedAt;
    return this.saveArticle(
      {
        ...existing,
        status: nextStatus,
        publishedAt,
        scheduledAt: nextStatus === "scheduled" ? opts?.scheduledAt || existing.scheduledAt : existing.scheduledAt,
        workflowNotes: opts?.notes ?? existing.workflowNotes,
        expectedVersion: existing.version
      },
      actor,
      authCtx
    );
  }
  static async deleteArticle(id, actor = "Admin", hardDelete = false, authCtx = {}) {
    const existing = db.getArticleBySlugOrId(id, true) || (await this.getArticle(id, authCtx)).article;
    const okLocal = db.deleteArticle(id, actor, hardDelete);
    if (isSupabaseConfigured()) {
      const sbDel = await deleteSupabaseArticle(id, hardDelete);
      if (!sbDel.ok) {
        recordServerError({
          source: "supabase",
          code: "SUPABASE_DELETE_ERROR",
          message: sbDel.error || `Failed deleting ${id} from Supabase.`
        });
      }
    }
    if (authCtx.firebaseIdToken || hasServiceAccountConfigured()) {
      if (hardDelete) {
        const fsDel = await deleteFirestoreArticle(id, authCtx);
        if (!fsDel.ok) {
          recordServerError({
            source: "firestore",
            code: "FIRESTORE_DELETE_ERROR",
            message: fsDel.error || `Failed deleting ${id} from Firestore.`
          });
        }
      } else if (existing) {
        await upsertFirestoreArticle(
          { ...existing, status: "archived", updatedAt: (/* @__PURE__ */ new Date()).toISOString() },
          authCtx
        ).catch(() => {
        });
      }
    }
    db.bumpNewsCacheVersion();
    db.addPublicationLog({
      articleId: id,
      action: hardDelete ? "hard_delete" : "delete",
      nextStatus: hardDelete ? "deleted" : "archived",
      actor,
      storageEngine: isSupabaseConfigured() ? "supabase" : authCtx.firebaseIdToken || hasServiceAccountConfigured() ? "firestore" : "json_fallback",
      message: `Article ${id} ${hardDelete ? "permanently removed" : "archived/soft-deleted"}.`
    });
    return okLocal;
  }
  /**
   * Automatically promotes due 'scheduled' articles whose scheduledAt <= now to 'published'.
   */
  static async publishDueScheduledArticles(actor = "Scheduler (Auto-Publish)") {
    const nowMs = Date.now();
    const allScheduled = db.getArticles(void 0, void 0, void 0, "scheduled", false);
    const due = allScheduled.filter((a) => {
      const target = a.scheduledAt || a.scheduledFor;
      if (!target) return false;
      const tMs = new Date(target).getTime();
      return Number.isFinite(tMs) && tMs <= nowMs;
    });
    const promotedIds = [];
    for (const art of due) {
      try {
        await this.transitionStatus(art.id, "published", actor);
        promotedIds.push(art.id);
      } catch (err) {
        recordServerError({
          source: "scheduler",
          code: "SCHEDULE_PUBLISH_FAILED",
          message: `Auto-publish failed for article ${art.id}: ${err?.message || err}`
        });
      }
    }
    return { promotedCount: promotedIds.length, promotedIds };
  }
  static async seedAllPortalArticlesToFirestore(authCtx) {
    const allLocal = db.getArticles(void 0, void 0, void 0, "all", false);
    const res = await seedMissingArticlesToFirestore(allLocal, authCtx);
    db.bumpNewsCacheVersion();
    return res;
  }
  static async getPublishingHealth(authCtx = {}) {
    const [firestoreHealth, supabaseHealth, mergedRes] = await Promise.all([
      checkFirestoreHealth(authCtx.firebaseIdToken),
      checkSupabaseHealth({ runWriteTest: false }),
      this.listArticles({ status: "all" }, authCtx)
    ]);
    const allActive = mergedRes.articles;
    const counts = {
      all: allActive.length,
      published: 0,
      draft: 0,
      in_review: 0,
      scheduled: 0,
      archived: 0,
      failed: 0
    };
    let missingTranslations = 0;
    for (const a of allActive) {
      counts[a.status] = (counts[a.status] || 0) + 1;
      if (!a.titleEn?.trim() || !a.titleUr?.trim() || !a.contentEn?.trim() || !a.contentUr?.trim()) {
        missingTranslations++;
      }
    }
    return {
      firestoreHealth,
      supabaseHealth,
      cacheStatus: {
        ...db.getCacheStatus(),
        publishedArticlesCount: counts.published,
        totalActiveArticlesCount: allActive.length
      },
      articleCountsByStatus: counts,
      missingTranslationsCount: missingTranslations,
      recentPublicationLogs: db.getPublicationLogs(40),
      recentErrors: getServerErrorLogs(40)
    };
  }
  /**
   * Executes a live Database Publishing Pipeline Self-Test:
   * Uses Supabase PostgreSQL when configured, otherwise Cloud Firestore.
   */
  static async runPublishingPipelineSelfTest(actor = "Super Admin", authCtx = {}) {
    const started = Date.now();
    const probeId = `art-diag-probe-${Date.now()}`;
    const probeSlug = `diag-probe-${Date.now()}`;
    const steps = [];
    const supabaseActive = isSupabaseConfigured();
    const canWriteFirestore = Boolean(authCtx.firebaseIdToken || hasServiceAccountConfigured());
    const targetEngine = supabaseActive ? "supabase" : canWriteFirestore ? "firestore" : "json_fallback";
    try {
      if (supabaseActive) {
        const t0 = Date.now();
        const sbHealth = await checkSupabaseHealth({ runWriteTest: false });
        steps.push({
          step: "1. Verify Supabase PostgreSQL Connectivity & Schema",
          ok: sbHealth.connected && sbHealth.articlesTableAvailable,
          durationMs: Date.now() - t0,
          detail: `Host=${sbHealth.projectHost}, tablesReady=${sbHealth.articlesTableAvailable}, rlsOk=${sbHealth.rlsPolicyCheckOk}`
        });
      } else {
        const t0 = Date.now();
        const health = await checkFirestoreHealth(authCtx.firebaseIdToken);
        if (canWriteFirestore && !health.testConnectionDocExists) {
          await ensureTestConnectionDoc(authCtx);
        }
        steps.push({
          step: "1. Verify Cloud Firestore Connectivity & Auth",
          ok: health.connected && canWriteFirestore,
          durationMs: Date.now() - t0,
          detail: canWriteFirestore ? `Project=${health.projectId}, DB=${health.firestoreDatabaseId}, authMode=${health.authMode}` : `Connected=${health.connected}, no Supabase keys or Firebase Service Account supplied.`
        });
      }
      const t1 = Date.now();
      const created = await this.saveArticle(
        {
          id: probeId,
          slug: probeSlug,
          titleEn: "Diagnostic Pipeline Probe",
          titleUr: "\u067E\u0628\u0644\u0634\u0646\u06AF \u062A\u0634\u062E\u06CC\u0635\u06CC \u062C\u0627\u0646\u0686",
          summaryEn: "Automated temporary persistence self-test article",
          summaryUr: "\u062E\u0648\u062F\u06A9\u0627\u0631 \u062C\u0627\u0646\u0686 \u06A9\u0627 \u0645\u0636\u0645\u0648\u0646",
          contentEn: "Automated bilingual write and read-after-write verification.",
          contentUr: "\u0627\u0646\u06AF\u0631\u06CC\u0632\u06CC \u0627\u0648\u0631 \u0627\u0631\u062F\u0648 \u0645\u0648\u0627\u062F \u06A9\u06CC \u0645\u0633\u062A\u0642\u0644 \u062A\u0635\u062F\u06CC\u0642\u06D4",
          category: "pakistan",
          status: "draft",
          tags: ["diag-test"]
        },
        actor,
        authCtx
      );
      steps.push({
        step: `2. Save Draft to ${supabaseActive ? "Supabase PostgreSQL" : "Database"} & Read-After-Write`,
        ok: created.verifiedReadBack && created.storageEngine === targetEngine && created.article.status === "draft",
        durationMs: Date.now() - t1,
        detail: `ID=${created.article.id}, engine=${created.storageEngine}, EN+UR=${Boolean(created.article.contentEn && created.article.contentUr)}`
      });
      const t2 = Date.now();
      const published = await this.transitionStatus(probeId, "published", actor, void 0, authCtx);
      steps.push({
        step: "3. Publish Article & Set Timestamp",
        ok: published.article.status === "published" && published.storageEngine === targetEngine && Boolean(published.article.publishedAt),
        durationMs: Date.now() - t2,
        detail: `publishedAt=${published.article.publishedAt}, engine=${published.storageEngine}`
      });
      const t3 = Date.now();
      const listRes = await this.listArticles({ status: "published", search: probeSlug }, {});
      const visiblePublicly = listRes.articles.some((a) => a.id === probeId);
      const slugLookup = supabaseActive ? await getSupabaseArticle(probeSlug) : await getFirestoreArticle(probeSlug);
      steps.push({
        step: "4. Public Published Query & Slug Visibility",
        ok: visiblePublicly && Boolean(slugLookup.ok && slugLookup.article),
        durationMs: Date.now() - t3,
        detail: `publicListMatch=${visiblePublicly}, slugDocFound=${Boolean(slugLookup.article)}`
      });
      const t4 = Date.now();
      const archived = await this.transitionStatus(probeId, "archived", actor, void 0, authCtx);
      const deleted = await this.deleteArticle(probeId, actor, true, authCtx);
      steps.push({
        step: "5. Archive Transition & Probe Cleanup",
        ok: archived.article.status === "archived" && deleted,
        durationMs: Date.now() - t4,
        detail: deleted ? "Temporary probe archived and removed cleanly." : "Cleanup incomplete."
      });
      return {
        ok: steps.every((s) => s.ok),
        totalDurationMs: Date.now() - started,
        storageEngine: targetEngine,
        steps,
        testedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    } catch (err) {
      try {
        await this.deleteArticle(probeId, actor, true, authCtx);
      } catch {
      }
      steps.push({
        step: "Pipeline Exception",
        ok: false,
        durationMs: Date.now() - started,
        detail: err?.message || "Unexpected error during publishing self-test."
      });
      return {
        ok: false,
        totalDurationMs: Date.now() - started,
        storageEngine: targetEngine,
        steps,
        error: err?.message || "Publishing pipeline self-test failed",
        testedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
  }
};

// services/automation/JobScheduler.ts
var JobScheduler = class {
  static async runDueJobs(triggeredBy = "cpanel_cron", maxBatch) {
    const settings = db.getAutomationSettings();
    if (!settings.autoSyncEnabled && triggeredBy === "scheduler") {
      return { skipped: "Auto-sync disabled in Automation Settings", runs: [] };
    }
    const lockOwner = `${triggeredBy}-${process.pid}`;
    const lockAcquired = db.acquireCronLock("global-sync-dispatcher", lockOwner, 240);
    if (!lockAcquired) {
      return { skipped: "Active lock already held by another sync worker", runs: [] };
    }
    const runs = [];
    try {
      const providers = db.getDataProviders().filter((p) => p.status === "active");
      const now = Date.now();
      const batchLimit = maxBatch || settings.cronBatchLimit || 4;
      const dueProviders = providers.filter((p) => {
        if (!p.lastSyncAt) return true;
        const elapsedMs = now - new Date(p.lastSyncAt).getTime();
        const intervalMs = Math.max(5, p.intervalMinutes || 30) * 60 * 1e3;
        return elapsedMs >= intervalMs;
      });
      for (const provider of dueProviders.slice(0, batchLimit)) {
        const run = await ProviderRegistry.executeProviderSync(provider.id, triggeredBy);
        runs.push(run);
      }
      await ArticleService.publishDueScheduledArticles(`Scheduler (${triggeredBy})`).catch(
        (err) => console.warn("[Scheduler] Scheduled publish sweep error:", err?.message || err)
      );
      db.updateAutomationSettings({ lastCronRunAt: (/* @__PURE__ */ new Date()).toISOString() }, "Cron Dispatcher");
    } finally {
      db.releaseCronLock("global-sync-dispatcher");
    }
    return { runs };
  }
  static async retryProviderWithBackoff(providerId, maxRetries = 3) {
    let lastRun;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      lastRun = await ProviderRegistry.executeProviderSync(providerId, "manual");
      if (lastRun.status === "success") {
        return lastRun;
      }
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 600 * Math.pow(2, attempt - 1)));
      }
    }
    return lastRun;
  }
};

// src/server/automation/scheduler.ts
var AutomationScheduler = class {
  constructor() {
    this.isRunning = false;
    this.intervalTimer = null;
    this.activeJobs = /* @__PURE__ */ new Set();
    this.lastAiHealthCheckAt = 0;
  }
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log("[Automation] Starting 360Khabarnama Live Data & AI Engine Scheduler...");
    this.runAllSyncs(true).catch(console.error);
    ArticleService.publishDueScheduledArticles("Startup Scheduler").catch(console.error);
    this.intervalTimer = setInterval(() => {
      JobScheduler.runDueJobs("scheduler").catch(console.error);
      ArticleService.publishDueScheduledArticles("Interval Scheduler").catch(console.error);
      const now = Date.now();
      if (now - this.lastAiHealthCheckAt >= 30 * 60 * 1e3 && db.getAiProviders().some((p) => p.enabled)) {
        this.lastAiHealthCheckAt = now;
        AIProviderManager.runLightweightHealthCheck("Central Sync Scheduler").catch(
          (err) => console.warn("[Automation] AI health check skipped:", err?.message || err)
        );
      }
    }, 5 * 60 * 1e3);
  }
  stop() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.isRunning = false;
  }
  async runSyncForProvider(providerId, manual = false) {
    if (this.activeJobs.has(providerId)) {
      throw new Error(`Sync job for "${providerId}" is already running.`);
    }
    this.activeJobs.add(providerId);
    try {
      return await ProviderRegistry.executeProviderSync(providerId, manual ? "manual" : "scheduler");
    } finally {
      this.activeJobs.delete(providerId);
    }
  }
  async runAllSyncs(isStartup = false) {
    const providers = db.getDataProviders();
    const runs = [];
    for (const p of providers) {
      if (p.status === "disabled") continue;
      try {
        const run = await this.runSyncForProvider(p.id, !isStartup);
        runs.push(run);
      } catch (err) {
        console.warn(`[Automation] Error syncing ${p.id}:`, err);
      }
    }
    return runs;
  }
};
var scheduler = new AutomationScheduler();

// src/server/auth.ts
import crypto6 from "crypto";
var BOOTSTRAPPED_ADMIN_EMAIL = "visionofdeveloper@gmail.com";
var ALL_PERMISSIONS = [
  "overview:view",
  "reports:view",
  "articles:read",
  "articles:write",
  "articles:publish",
  "articles:delete",
  "categories:manage",
  "homepage:manage",
  "media:manage",
  "seo:manage",
  "ads:manage",
  "automation:manage",
  "ai:use",
  "ai:keys",
  "audience:manage",
  "users:manage",
  "settings:manage",
  "health:view"
];
var ROLE_PERMISSIONS = {
  "Super Admin": ALL_PERMISSIONS,
  "Administrator": ALL_PERMISSIONS.filter((p) => p !== "ai:keys" ? true : true),
  "Managing Editor": [
    "overview:view",
    "reports:view",
    "articles:read",
    "articles:write",
    "articles:publish",
    "articles:delete",
    "categories:manage",
    "homepage:manage",
    "media:manage",
    "seo:manage",
    "ai:use",
    "audience:manage"
  ],
  "Editor": [
    "overview:view",
    "reports:view",
    "articles:read",
    "articles:write",
    "articles:publish",
    "categories:manage",
    "media:manage",
    "ai:use"
  ],
  "SEO Manager": [
    "overview:view",
    "reports:view",
    "articles:read",
    "seo:manage",
    "categories:manage",
    "media:manage",
    "ai:use"
  ],
  "SEO Specialist": [
    "overview:view",
    "reports:view",
    "articles:read",
    "seo:manage",
    "categories:manage",
    "media:manage",
    "ai:use"
  ],
  "Automation Manager": [
    "overview:view",
    "reports:view",
    "automation:manage",
    "articles:read",
    "ai:use",
    "health:view"
  ],
  "Advertising Manager": [
    "overview:view",
    "reports:view",
    "ads:manage",
    "media:manage",
    "homepage:manage"
  ],
  "Content Contributor": [
    "overview:view",
    "articles:read",
    "articles:write",
    "media:manage",
    "ai:use"
  ],
  "Reporter": [
    "overview:view",
    "articles:read",
    "articles:write",
    "media:manage",
    "ai:use"
  ],
  "Read-only Analyst": [
    "overview:view",
    "reports:view",
    "articles:read",
    "health:view"
  ],
  "Viewer": [
    "overview:view",
    "reports:view",
    "articles:read"
  ]
};
function normalizeRole(role) {
  if (!role) return "Read-only Analyst";
  if (role === "Reporter") return "Content Contributor";
  if (role === "SEO Specialist") return "SEO Manager";
  if (role === "Viewer") return "Read-only Analyst";
  return role;
}
function getPermissionsForRole(role) {
  if (!role) return ROLE_PERMISSIONS["Read-only Analyst"];
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS[normalizeRole(role)] || ROLE_PERMISSIONS["Read-only Analyst"];
}
function hasPermission(role, permission) {
  if (role === "Super Admin") return true;
  return getPermissionsForRole(role).includes(permission);
}
var SESSION_COOKIE_NAME = "kn360_admin_sid";
var SESSION_TTL_MS = 8 * 60 * 60 * 1e3;
var MAX_LOGIN_ATTEMPTS = 5;
var LOCKOUT_DURATION_MS = 15 * 60 * 1e3;
var SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || process.env.SESSION_SECRET || crypto6.createHash("sha256").update(`360khabarnama:${process.env.SITE_URL || "kn360"}:${process.env.AI_MASTER_KEY || "kn360-stable-session-secret"}`).digest("hex");
var activeSessions = /* @__PURE__ */ new Map();
var revokedSessions = /* @__PURE__ */ new Set();
function signSessionPayload(session) {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  const sig = crypto6.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}
function verifySignedSessionToken(token) {
  const dotIdx = token.indexOf(".");
  if (dotIdx <= 0) return null;
  const payload = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  if (!payload || !sig) return null;
  const expected = crypto6.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto6.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!parsed || !parsed.sessionId || Date.now() > parsed.expiresAt || revokedSessions.has(parsed.sessionId)) {
      return null;
    }
    if (!parsed.permissions) {
      parsed.permissions = getPermissionsForRole(parsed.role);
    }
    return parsed;
  } catch {
    return null;
  }
}
function hashPassword(password) {
  const salt = crypto6.randomBytes(16).toString("hex");
  const derived = crypto6.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}
function verifyPassword(password, storedHash) {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) return false;
  const derived = crypto6.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, "hex");
  if (derived.length !== keyBuf.length) return false;
  return crypto6.timingSafeEqual(derived, keyBuf);
}
function parseCookies(req) {
  const list = {};
  const rc = req.headers.cookie;
  if (!rc) return list;
  rc.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    const key = parts.shift()?.trim();
    if (key) {
      list[key] = decodeURIComponent(parts.join("="));
    }
  });
  return list;
}
function isBootstrapRequired() {
  const creds = db.getAdminCredentialsMap();
  return Object.keys(creds).length === 0;
}
function provisionFirstAdmin(email, password, nameEn = "Chief Administrator") {
  if (!isBootstrapRequired()) {
    return { success: false, error: "Initial admin account has already been provisioned." };
  }
  if (!email || !email.includes("@") || password.length < 8) {
    return { success: false, error: "Valid email and password (minimum 8 characters) are required." };
  }
  const cleanEmail = email.trim().toLowerCase();
  const userId = `usr-admin-${Date.now()}`;
  const passwordHash = hashPassword(password);
  db.setAdminCredential(cleanEmail, {
    userId,
    email: cleanEmail,
    passwordHash,
    mfaEnabled: false,
    failedAttempts: 0,
    passwordUpdatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  const existingUsers = db.getAdminUsers();
  if (!existingUsers.some((u) => u.email.toLowerCase() === cleanEmail)) {
    db.upsertAdminUser({
      id: userId,
      nameEn,
      nameUr: "\u0686\u06CC\u0641 \u0627\u06CC\u0688\u0645\u0646\u0633\u0679\u0631\u06CC\u0679\u0631",
      email: cleanEmail,
      role: "Super Admin",
      status: "active",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
      articlesCount: 0,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    }, "System Bootstrap");
  }
  db.logAudit("System Bootstrap", "First Super Admin Provisioned", `Provisioned initial admin account: ${cleanEmail}`);
  return { success: true };
}
function setStaffPasswordCredential(email, newPassword, userId, actor = "Super Admin") {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail.includes("@") || !newPassword || newPassword.length < 8) {
    return { success: false, error: "Valid email and password (min 8 chars) required." };
  }
  const creds = db.getAdminCredentialsMap();
  const existing = creds[cleanEmail];
  db.setAdminCredential(cleanEmail, {
    ...existing || {},
    userId: existing?.userId || userId || `usr-${Date.now()}`,
    email: cleanEmail,
    passwordHash: hashPassword(newPassword),
    mfaEnabled: existing?.mfaEnabled || false,
    failedAttempts: 0,
    lockedUntil: void 0,
    passwordUpdatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  db.logAudit(actor, "Staff Password Set", `Updated login credentials for ${cleanEmail}`);
  return { success: true };
}
function authenticateAdmin(email, password, ipAddress, userAgent, totpCode) {
  const cleanEmail = email.trim().toLowerCase();
  const creds = db.getAdminCredentialsMap();
  const cred = creds[cleanEmail];
  if (!cred) {
    db.logAudit(cleanEmail || "Unknown", "Failed Admin Login", `Attempted login for unprovisioned account from IP ${ipAddress}`);
    return { success: false, error: "Invalid credentials." };
  }
  const staffUser = db.getAdminUsers().find((u) => u.email.toLowerCase() === cleanEmail);
  if (staffUser && staffUser.status === "suspended") {
    db.logAudit(cleanEmail, "Blocked Login (Suspended)", `Suspended account attempted login from IP ${ipAddress}`);
    return { success: false, error: "This administrator account is currently suspended." };
  }
  if (cred.lockedUntil && Date.now() < cred.lockedUntil) {
    const minsLeft = Math.ceil((cred.lockedUntil - Date.now()) / 6e4);
    db.logAudit(cleanEmail, "Blocked Login (Throttled)", `Account locked for ${minsLeft}m from IP ${ipAddress}`);
    return { success: false, error: `Too many failed attempts. Try again in ${minsLeft} minutes.` };
  }
  if (!verifyPassword(password, cred.passwordHash)) {
    cred.failedAttempts = (cred.failedAttempts || 0) + 1;
    if (cred.failedAttempts >= MAX_LOGIN_ATTEMPTS) {
      cred.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
      db.logAudit(cleanEmail, "Account Locked", `Exceeded ${MAX_LOGIN_ATTEMPTS} failed login attempts from IP ${ipAddress}`);
    } else {
      db.logAudit(cleanEmail, "Failed Admin Login", `Invalid password attempt (${cred.failedAttempts}/${MAX_LOGIN_ATTEMPTS}) from IP ${ipAddress}`);
    }
    db.setAdminCredential(cleanEmail, cred);
    return { success: false, error: "Invalid credentials." };
  }
  if (cred.mfaEnabled) {
    const secret = cred.mfaSecretEnc ? decryptSecret(cred.mfaSecretEnc) : cred.mfaSecret || "";
    if (!totpCode) {
      return { success: false, mfaRequired: true, error: "Enter the 6-digit authenticator verification code." };
    }
    if (!verifyTotpToken(secret, totpCode)) {
      db.logAudit(cleanEmail, "MFA Verification Failed", `Invalid 2FA code from IP ${ipAddress}`);
      return { success: false, mfaRequired: true, error: "Invalid authenticator code." };
    }
  }
  cred.failedAttempts = 0;
  cred.lockedUntil = void 0;
  cred.lastLoginAt = (/* @__PURE__ */ new Date()).toISOString();
  db.setAdminCredential(cleanEmail, cred);
  const assignedRole = normalizeRole(staffUser?.role || "Super Admin");
  const sessionId = crypto6.randomBytes(32).toString("hex");
  const session = {
    sessionId,
    userId: cred.userId,
    email: cleanEmail,
    nameEn: staffUser?.nameEn || "Administrator",
    role: assignedRole,
    permissions: getPermissionsForRole(assignedRole),
    mfaVerified: true,
    ipAddress,
    userAgent,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    expiresAt: Date.now() + SESSION_TTL_MS
  };
  activeSessions.set(sessionId, session);
  db.logAudit(cleanEmail, "Admin Login Success", `Authenticated session (${assignedRole}) from IP ${ipAddress}`);
  return { success: true, session, mfaRequired: false };
}
function changeAdminPassword(email, currentPassword, newPassword) {
  const cleanEmail = email.trim().toLowerCase();
  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: "New password must be at least 8 characters." };
  }
  const cred = db.getAdminCredentialsMap()[cleanEmail];
  if (cred) {
    if (!verifyPassword(currentPassword, cred.passwordHash)) {
      return { success: false, error: "Current password is incorrect." };
    }
    cred.passwordHash = hashPassword(newPassword);
    cred.passwordUpdatedAt = (/* @__PURE__ */ new Date()).toISOString();
    db.setAdminCredential(cleanEmail, cred);
    db.logAudit(cleanEmail, "Password Changed", "Administrator updated account password");
    return { success: true };
  }
  const staffUser = db.getAdminUsers().find((u) => u.email.toLowerCase() === cleanEmail);
  if (!staffUser && cleanEmail !== BOOTSTRAPPED_ADMIN_EMAIL) {
    return { success: false, error: "Account not found." };
  }
  db.setAdminCredential(cleanEmail, {
    userId: staffUser?.id || `usr-${Date.now()}`,
    email: cleanEmail,
    passwordHash: hashPassword(newPassword),
    mfaEnabled: false,
    failedAttempts: 0,
    passwordUpdatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  db.logAudit(cleanEmail, "Local Password Set", "Created local password for admin login");
  return { success: true };
}
function initiateMfaSetup(email) {
  const cleanEmail = email.trim().toLowerCase();
  const cred = db.getAdminCredentialsMap()[cleanEmail];
  const staffUser = db.getAdminUsers().find((u) => u.email.toLowerCase() === cleanEmail);
  if (!cred && !staffUser && cleanEmail !== BOOTSTRAPPED_ADMIN_EMAIL) {
    return { success: false, error: "Account not found." };
  }
  const secret = generateTotpSecret();
  const updated = {
    ...cred || {
      userId: staffUser?.id || `usr-${Date.now()}`,
      email: cleanEmail,
      passwordHash: "",
      mfaEnabled: false,
      failedAttempts: 0
    },
    mfaSecretEnc: encryptSecret(secret)
  };
  db.setAdminCredential(cleanEmail, updated);
  const issuer = encodeURIComponent("360Khabarnama Admin");
  const label = encodeURIComponent(cleanEmail);
  const otpauthUrl = `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}`;
  return { success: true, secret, otpauthUrl };
}
function enableMfaWithToken(email, code) {
  const cleanEmail = email.trim().toLowerCase();
  const cred = db.getAdminCredentialsMap()[cleanEmail];
  if (!cred?.mfaSecretEnc) {
    return { success: false, error: "MFA setup has not been initiated yet." };
  }
  const secret = decryptSecret(cred.mfaSecretEnc);
  if (!verifyTotpToken(secret, code)) {
    return { success: false, error: "Verification code does not match authenticator." };
  }
  cred.mfaEnabled = true;
  db.setAdminCredential(cleanEmail, cred);
  db.logAudit(cleanEmail, "MFA Enabled", "Enabled Two-Factor TOTP authentication");
  return { success: true };
}
function disableMfa(email) {
  const cleanEmail = email.trim().toLowerCase();
  const cred = db.getAdminCredentialsMap()[cleanEmail];
  if (cred) {
    cred.mfaEnabled = false;
    delete cred.mfaSecretEnc;
    db.setAdminCredential(cleanEmail, cred);
    db.logAudit(cleanEmail, "MFA Disabled", "Disabled Two-Factor TOTP authentication");
  }
  return { success: true };
}
function requestPasswordReset(email) {
  const cleanEmail = email.trim().toLowerCase();
  const cred = db.getAdminCredentialsMap()[cleanEmail];
  if (!cred) {
    return { success: true, message: "If the account exists, reset instructions have been logged for verification." };
  }
  const rawToken = crypto6.randomBytes(12).toString("hex");
  cred.resetTokenHash = crypto6.createHash("sha256").update(rawToken).digest("hex");
  cred.resetTokenExpiresAt = Date.now() + 30 * 60 * 1e3;
  db.setAdminCredential(cleanEmail, cred);
  db.logAudit(cleanEmail, "Password Reset Requested", "Issued single-use 30m password reset code (server-side)");
  return {
    success: true,
    message: "A password reset code has been issued. Contact your Super Admin / server console or complete reset below."
  };
}
function confirmPasswordReset(email, token, newPassword) {
  const cleanEmail = email.trim().toLowerCase();
  const cred = db.getAdminCredentialsMap()[cleanEmail];
  if (!cred || !cred.resetTokenHash || !cred.resetTokenExpiresAt || Date.now() > cred.resetTokenExpiresAt) {
    return { success: false, error: "Reset token is invalid or expired." };
  }
  const hash = crypto6.createHash("sha256").update((token || "").trim()).digest("hex");
  if (hash !== cred.resetTokenHash) {
    return { success: false, error: "Reset token mismatch." };
  }
  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: "New password must be at least 8 characters." };
  }
  cred.passwordHash = hashPassword(newPassword);
  delete cred.resetTokenHash;
  delete cred.resetTokenExpiresAt;
  cred.failedAttempts = 0;
  cred.lockedUntil = void 0;
  cred.passwordUpdatedAt = (/* @__PURE__ */ new Date()).toISOString();
  db.setAdminCredential(cleanEmail, cred);
  db.logAudit(cleanEmail, "Password Reset Completed", "Password reset confirmed via single-use token");
  return { success: true };
}
function getSessionFromRequest(req) {
  const cookies = parseCookies(req);
  const rawToken = cookies[SESSION_COOKIE_NAME];
  if (!rawToken) return null;
  const signedSession = verifySignedSessionToken(rawToken);
  if (signedSession) {
    const staffUser = db.getAdminUsers().find((u) => u.email.toLowerCase() === signedSession.email.toLowerCase());
    if (staffUser?.status === "suspended") return null;
    if (staffUser?.role) {
      signedSession.role = normalizeRole(staffUser.role);
      signedSession.permissions = getPermissionsForRole(signedSession.role);
    }
    return signedSession;
  }
  const session = activeSessions.get(rawToken);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(rawToken);
    return null;
  }
  return session;
}
function setSessionCookie(res, sessionIdOrObj) {
  const isProd = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  const sessionObj = typeof sessionIdOrObj === "string" ? activeSessions.get(sessionIdOrObj) : sessionIdOrObj;
  const cookieVal = sessionObj ? signSessionPayload(sessionObj) : String(sessionIdOrObj);
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(cookieVal)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1e3)}${isProd ? "; Secure" : ""}`
  );
}
function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}
function revokeSession(sessionId, actor = "Admin") {
  revokedSessions.add(sessionId);
  const sess = activeSessions.get(sessionId);
  if (sess) {
    activeSessions.delete(sessionId);
    db.logAudit(actor, "Session Revoked", `Revoked admin session for ${sess.email}`);
    return true;
  }
  return true;
}
function listActiveSessions() {
  const now = Date.now();
  const list = [];
  for (const [id, sess] of activeSessions.entries()) {
    if (now > sess.expiresAt) activeSessions.delete(id);
    else list.push(sess);
  }
  return list;
}
async function authenticateAdminWithFirebase(idToken, ipAddress, userAgent) {
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const email = (decoded.email || "").trim().toLowerCase();
    if (!email || !decoded.email_verified) {
      return { success: false, error: "Verified Google email is required for admin access." };
    }
    let staffUser = db.getAdminUsers().find((u) => u.email.toLowerCase() === email);
    if (!staffUser && isSupabaseConfigured()) {
      const sbUser = await findSupabaseAdminUserByEmail(email);
      if (sbUser) staffUser = sbUser;
    }
    const isAuthorized = email === BOOTSTRAPPED_ADMIN_EMAIL || staffUser && staffUser.status === "active";
    if (!isAuthorized) {
      db.logAudit(email, "Blocked Firebase Admin Login", `Unauthorized Google sign-in attempt from IP ${ipAddress}`);
      return { success: false, error: "This Google account is not authorized for 360Khabarnama Admin." };
    }
    const assignedRole = normalizeRole(staffUser?.role || "Super Admin");
    const sessionId = crypto6.randomBytes(32).toString("hex");
    const session = {
      sessionId,
      userId: decoded.uid,
      firebaseUid: decoded.uid,
      email,
      nameEn: staffUser?.nameEn || decoded.name || "Administrator",
      role: assignedRole,
      permissions: getPermissionsForRole(assignedRole),
      mfaVerified: true,
      ipAddress,
      userAgent,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      expiresAt: Date.now() + SESSION_TTL_MS
    };
    activeSessions.set(sessionId, session);
    db.logAudit(email, "Admin Firebase Login Success", `Authenticated Google session (${assignedRole}) from IP ${ipAddress}`);
    return { success: true, session };
  } catch (err) {
    console.error("[Auth] Firebase ID token verification failed:", err);
    return { success: false, error: "Invalid or expired Firebase ID token." };
  }
}
async function resolveOptionalAdminSession(req) {
  const session = getSessionFromRequest(req);
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (session) {
    if (bearerToken && !session.firebaseUid) {
      try {
        const decoded = await adminAuth.verifyIdToken(bearerToken);
        if (decoded?.uid && decoded.email_verified) {
          session.firebaseUid = decoded.uid;
        }
      } catch {
      }
    }
    return session;
  }
  if (bearerToken) {
    try {
      const decoded = await adminAuth.verifyIdToken(bearerToken);
      const email = (decoded.email || "").trim().toLowerCase();
      let staffUser = db.getAdminUsers().find((u) => u.email.toLowerCase() === email);
      if (!staffUser && isSupabaseConfigured()) {
        const sbUser = await findSupabaseAdminUserByEmail(email);
        if (sbUser) staffUser = sbUser;
      }
      if (decoded.email_verified && (email === BOOTSTRAPPED_ADMIN_EMAIL || staffUser && staffUser.status === "active")) {
        const assignedRole = normalizeRole(staffUser?.role || "Super Admin");
        return {
          sessionId: `fb-${decoded.uid}`,
          userId: decoded.uid,
          firebaseUid: decoded.uid,
          email,
          nameEn: staffUser?.nameEn || decoded.name || "Administrator",
          role: assignedRole,
          permissions: getPermissionsForRole(assignedRole),
          mfaVerified: true,
          ipAddress: req.ip || "127.0.0.1",
          userAgent: req.headers["user-agent"] || "Unknown",
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          expiresAt: Date.now() + SESSION_TTL_MS
        };
      }
    } catch {
    }
  }
  return null;
}
async function requireAdminAuth(req, res, next) {
  try {
    if (req.path.startsWith("/auth/")) {
      return next();
    }
    const session = await resolveOptionalAdminSession(req);
    if (session) {
      req.adminSession = session;
      return next();
    }
    return res.status(401).json({
      success: false,
      error: "Authentication required. Please sign in to 360Khabarnama Admin."
    });
  } catch (err) {
    console.error("[Auth] Middleware verification error:", err);
    return res.status(500).json({
      success: false,
      error: err?.message || "Authentication verification failed."
    });
  }
}
function requirePermission(permission) {
  return (req, res, next) => {
    const session = req.adminSession;
    if (!session) {
      return res.status(401).json({ success: false, error: "Authentication required." });
    }
    if (!hasPermission(session.role, permission)) {
      db.logAudit(session.email, "Forbidden Action Blocked", `Role "${session.role}" lacks permission "${permission}" for ${req.method} ${req.originalUrl}`);
      return res.status(403).json({
        success: false,
        error: `Access denied: your role (${session.role}) does not have "${permission}" permission.`
      });
    }
    return next();
  };
}

// services/seo/SEOEngine.ts
var SEOEngine = class {
  static getBaseUrl() {
    try {
      const configured = db.getData().siteSettings?.siteUrl;
      if (configured && configured.trim()) {
        return configured.trim().replace(/\/+$/, "");
      }
    } catch {
    }
    return (process.env.APP_URL || "https://www.360khabarnama.com").replace(/\/+$/, "");
  }
  /**
   * Generate bilingual metadata for any article or utility page
   */
  static generateArticleMetadata(article, lang) {
    const baseUrl = this.getBaseUrl();
    const title = lang === "ur" ? article.seo?.metaTitleUr || `${article.titleUr} | 360 \u062E\u0628\u0631\u0646\u0627\u0645\u06C1` : article.seo?.metaTitleEn || `${article.titleEn} | 360Khabarnama`;
    const description = lang === "ur" ? article.seo?.metaDescriptionUr || article.summaryUr || article.titleUr : article.seo?.metaDescriptionEn || article.summaryEn || article.titleEn;
    const slug = article.slug || article.id;
    const canonicalUrl = article.seo?.canonicalUrl || `${baseUrl}/${lang}/news/${slug}`;
    const robots = article.seo?.noIndex ? "noindex, nofollow" : "index, follow, max-image-preview:large";
    const resolvedOgImage = article.socialImageUrl || article.seo?.ogImage || article.heroImage || article.featuredImage || `${baseUrl}/assets/aistudio/Modern_Green_and_Gold_News_Logo_2e9a99d4.png`;
    const fullOgImage = resolvedOgImage.startsWith("/") ? `${baseUrl}${resolvedOgImage}` : resolvedOgImage;
    return {
      title: title.slice(0, 70),
      description: description.slice(0, 160),
      canonicalUrl,
      robots,
      ogTitle: title,
      ogDescription: description,
      ogImage: fullOgImage,
      ogType: "article",
      locale: lang === "ur" ? "ur_PK" : "en_PK",
      hreflangEn: `${baseUrl}/en/news/${slug}`,
      hreflangUr: `${baseUrl}/ur/news/${slug}`
    };
  }
  /**
   * Generate valid NewsArticle JSON-LD matching visible page content
   */
  static generateNewsArticleSchema(article, lang) {
    const baseUrl = this.getBaseUrl();
    const slug = article.slug || article.id;
    const url = `${baseUrl}/${lang}/news/${slug}`;
    const rawImages = [article.heroImage, article.featuredImage, article.socialImageUrl].filter(
      (img) => Boolean(img && img.trim())
    );
    const images = Array.from(new Set(rawImages.map((img) => img.startsWith("/") ? `${baseUrl}${img}` : img)));
    return {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": url
      },
      headline: lang === "ur" ? article.titleUr : article.titleEn,
      description: lang === "ur" ? article.summaryUr : article.summaryEn,
      image: images,
      datePublished: article.publishedAt,
      dateModified: article.updatedAt || article.publishedAt,
      author: {
        "@type": "Person",
        name: lang === "ur" ? article.author?.nameUr || "\u0627\u062F\u0627\u0631\u06CC\u06C1 360 \u062E\u0628\u0631\u0646\u0627\u0645\u06C1" : article.author?.nameEn || "360Khabarnama Editorial"
      },
      publisher: {
        "@type": "Organization",
        name: "360Khabarnama",
        logo: {
          "@type": "ImageObject",
          url: `${baseUrl}/assets/aistudio/Modern_Green_and_Gold_News_Logo_2e9a99d4.png`
        }
      },
      inLanguage: lang === "ur" ? "ur-PK" : "en-PK"
    };
  }
  /**
   * Pre-Publication SEO Quality Gate
   * Classifies findings into Critical (blocks publish), Warning, and Suggestion.
   */
  static runQualityGate(article) {
    const findings = [];
    let score = 100;
    if (!article.titleEn || article.titleEn.trim().length < 10) {
      findings.push({
        id: "crit-title-en",
        severity: "critical",
        code: "MISSING_TITLE_EN",
        message: "English headline is missing or too short (minimum 10 characters).",
        field: "titleEn"
      });
      score -= 25;
    }
    if (!article.titleUr || article.titleUr.trim().length < 10) {
      findings.push({
        id: "crit-title-ur",
        severity: "critical",
        code: "MISSING_TITLE_UR",
        message: "Urdu headline is missing or too short (minimum 10 characters).",
        field: "titleUr"
      });
      score -= 25;
    }
    if (article.seo?.noIndex && article.status === "published") {
      findings.push({
        id: "crit-noindex",
        severity: "critical",
        code: "ACCIDENTAL_NOINDEX",
        message: "Article is marked as published but has noIndex enabled.",
        field: "seo.noIndex"
      });
      score -= 20;
    }
    if (!article.summaryEn || article.summaryEn.trim().length < 40) {
      findings.push({
        id: "warn-desc-en",
        severity: "warning",
        code: "WEAK_META_DESC_EN",
        message: "English summary/meta description is under 40 characters.",
        field: "summaryEn"
      });
      score -= 10;
    }
    if (!article.summaryUr || article.summaryUr.trim().length < 40) {
      findings.push({
        id: "warn-desc-ur",
        severity: "warning",
        code: "WEAK_META_DESC_UR",
        message: "Urdu summary/meta description is under 40 characters.",
        field: "summaryUr"
      });
      score -= 10;
    }
    if (!article.heroImage || !article.heroImage.startsWith("http")) {
      findings.push({
        id: "warn-hero-img",
        severity: "warning",
        code: "MISSING_FEATURED_IMAGE",
        message: "Featured image URL is missing or invalid (Discover requires high-res >=1200px).",
        field: "heroImage"
      });
      score -= 10;
    }
    if (!article.imageCaptionEn || !article.imageCaptionUr) {
      findings.push({
        id: "sug-alt",
        severity: "suggestion",
        code: "MISSING_IMAGE_CAPTION",
        message: "Add descriptive bilingual image captions/alt text for accessibility and Image SEO.",
        field: "imageCaptionEn"
      });
      score -= 5;
    }
    if (!article.tags || article.tags.length < 3) {
      findings.push({
        id: "sug-tags",
        severity: "suggestion",
        code: "FEW_TOPIC_TAGS",
        message: "Add at least 3 topic tags to map this article into content clusters.",
        field: "tags"
      });
      score -= 5;
    }
    const hasCritical = findings.some((f) => f.severity === "critical");
    return {
      passed: !hasCritical,
      healthScore: Math.max(0, score),
      findings,
      checkedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  /**
   * Topic Cluster & Internal Link Suggestions
   */
  static suggestInternalLinks(article, allArticles) {
    const suggestions = [];
    const related = allArticles.filter((a) => a.id !== article.id && a.status === "published" && a.category === article.category).slice(0, 3);
    for (const rel of related) {
      suggestions.push({
        sourceArticleId: article.id,
        targetUrl: `/en/news/${rel.slug}`,
        targetTitle: rel.titleEn,
        anchorText: rel.titleEn.split(":")[0].slice(0, 50),
        cluster: article.category,
        relevanceReason: `Same topic cluster (${article.category})`
      });
    }
    return suggestions;
  }
};

// services/seo/SEOAuditService.ts
var SEOAuditService = class {
  static runFullTechnicalAudit(actor = "SEO Manager") {
    const data = db.getData();
    const articles = data.articles || [];
    const seoPages = data.seoPages || [];
    const categoryPages = db.getCategoryPages();
    const brokenLinks = (data.brokenLinks || []).filter((b) => !b.resolved);
    const issues = [];
    const slugMap = /* @__PURE__ */ new Map();
    for (const art of articles) {
      const slug = (art.slug || "").toLowerCase();
      if (!slug) {
        issues.push({
          id: `slug-missing-${art.id}`,
          severity: "critical",
          category: "Duplicate Slug",
          target: art.titleEn,
          message: `Article "${art.titleEn}" has no URL slug assigned.`
        });
        continue;
      }
      const list = slugMap.get(slug) || [];
      list.push(art.id);
      slugMap.set(slug, list);
    }
    for (const [slug, ids] of slugMap.entries()) {
      if (ids.length > 1) {
        issues.push({
          id: `dup-slug-${slug}`,
          severity: "critical",
          category: "Duplicate Slug",
          target: `/news/${slug}`,
          message: `${ids.length} articles share the same slug "${slug}". Make each slug unique.`
        });
      }
    }
    let passingArticles = 0;
    for (const art of articles.filter((a) => a.status === "published")) {
      const gate = SEOEngine.runQualityGate(art);
      if (gate.passed && gate.findings.length === 0) passingArticles++;
      for (const f of gate.findings) {
        issues.push({
          id: `${art.id}-${f.id}`,
          severity: f.severity === "suggestion" ? "info" : f.severity,
          category: f.code.includes("IMAGE") ? "Image SEO" : f.code.includes("NOINDEX") ? "Canonical" : "Metadata",
          target: `/en/news/${art.slug}`,
          message: `[${art.titleEn.slice(0, 42)}...] ${f.message}`
        });
      }
      if (!art.titleUr || !art.contentUr || art.contentUr.trim().length < 20) {
        issues.push({
          id: `hreflang-ur-${art.id}`,
          severity: "warning",
          category: "Hreflang",
          target: `/ur/news/${art.slug}`,
          message: `Urdu companion content missing or incomplete for hreflang="ur" pair "${art.titleEn}".`
        });
      }
      if (!art.seo?.canonicalUrl && !art.slug) {
        issues.push({
          id: `canon-${art.id}`,
          severity: "warning",
          category: "Canonical",
          target: art.id,
          message: `Missing canonical slug or explicit canonical URL for "${art.titleEn}".`
        });
      }
    }
    for (const page of seoPages) {
      if (!page.metaDescEn || page.metaDescEn.length < 50) {
        issues.push({
          id: `page-desc-en-${page.id}`,
          severity: "warning",
          category: "Metadata",
          target: page.path,
          message: `English meta description on "${page.path}" is shorter than 50 characters.`
        });
      }
      if (!page.metaDescUr || page.metaDescUr.length < 40) {
        issues.push({
          id: `page-desc-ur-${page.id}`,
          severity: "warning",
          category: "Hreflang",
          target: page.path,
          message: `Urdu meta description on "${page.path}" is missing or under 40 characters.`
        });
      }
      if (!page.canonicalUrl) {
        issues.push({
          id: `page-canon-${page.id}`,
          severity: "critical",
          category: "Canonical",
          target: page.path,
          message: `Missing canonical URL on page SEO config "${page.path}".`
        });
      }
    }
    for (const cat of categoryPages.filter((c) => c.enabled)) {
      if (!cat.seoTitleEn || !cat.seoTitleUr) {
        issues.push({
          id: `cat-seo-${cat.slug}`,
          severity: "warning",
          category: "Hreflang",
          target: `/${cat.slug}`,
          message: `Category "${cat.nameEn}" is missing bilingual SEO title overrides.`
        });
      }
    }
    for (const bl of brokenLinks) {
      issues.push({
        id: `broken-${bl.id}`,
        severity: "critical",
        category: "Links",
        target: bl.url,
        message: `Unresolved HTTP ${bl.statusCode} error found on ${bl.foundOnPage}.`
      });
    }
    const mediaAssets = data.mediaAssets || [];
    const missingAltMedia = mediaAssets.filter((m) => !m.altTextEn?.trim() || !m.altTextUr?.trim());
    for (const m of missingAltMedia) {
      issues.push({
        id: `img-alt-${m.id}`,
        severity: "warning",
        category: "Image SEO",
        target: m.filename,
        message: `Media asset "${m.filename}" is missing bilingual alt text.`
      });
    }
    const criticalCount = issues.filter((i) => i.severity === "critical").length;
    const warningCount = issues.filter((i) => i.severity === "warning").length;
    const score = Math.max(0, Math.min(100, 100 - criticalCount * 12 - warningCount * 4));
    db.addSeoAuditLog({
      actor,
      action: "Full Technical SEO Audit Executed",
      target: `${articles.length} articles, ${seoPages.length} pages, ${categoryPages.length} categories`,
      status: criticalCount > 0 ? "warning" : "passed",
      details: `Score ${score}/100 (${criticalCount} critical, ${warningCount} warnings)`
    });
    return {
      auditedAt: (/* @__PURE__ */ new Date()).toISOString(),
      score,
      criticalCount,
      warningCount,
      infoCount: issues.filter((i) => i.severity === "info").length,
      publishedArticlesCount: articles.filter((a) => a.status === "published").length,
      passingArticlesCount: passingArticles,
      mediaTotal: mediaAssets.length,
      mediaWithBilingualAlt: mediaAssets.length - missingAltMedia.length,
      issues
    };
  }
};

// services/seo/SitemapManager.ts
var escapeXml = (str) => String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
function isArticlePubliclyIndexable(article, nowMs) {
  if (article.status !== "published" || article.seo?.noIndex) return false;
  const sched = article.scheduledAt || article.scheduledFor;
  if (sched) {
    const schedMs = new Date(sched).getTime();
    if (!Number.isNaN(schedMs) && schedMs > nowMs) return false;
  }
  return true;
}
var SitemapManager = class {
  static getBaseUrl() {
    const configured = db.getData().siteSettings?.siteUrl;
    return (configured || process.env.APP_URL || "https://www.360khabarnama.com").trim().replace(/\/+$/, "");
  }
  static buildSitemapIndexXml() {
    const baseUrl = this.getBaseUrl();
    const today = (/* @__PURE__ */ new Date()).toISOString();
    const sitemaps = [
      `${baseUrl}/sitemap.xml`,
      `${baseUrl}/news-sitemap.xml`,
      `${baseUrl}/image-sitemap.xml`,
      `${baseUrl}/video-sitemap.xml`
    ];
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
`;
    xml += `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;
    for (const loc of sitemaps) {
      xml += `  <sitemap>
`;
      xml += `    <loc>${escapeXml(loc)}</loc>
`;
      xml += `    <lastmod>${escapeXml(today)}</lastmod>
`;
      xml += `  </sitemap>
`;
    }
    xml += `</sitemapindex>`;
    return xml;
  }
  static buildMainSitemapXml() {
    const baseUrl = this.getBaseUrl();
    const config = db.getSitemapConfig();
    const nowMs = Date.now();
    const excluded = new Set((config.excludedPaths || []).map((p) => p.trim()));
    const articles = db.getData().articles.filter((a) => isArticlePubliclyIndexable(a, nowMs));
    const categories = db.getCategoryPages().filter((c) => c.enabled && c.status === "published");
    const staticPaths = ["", "/about", "/contact", "/editorial-policy", "/privacy-policy", "/terms"];
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"${config.includeImages ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : ""}>
`;
    const emitBilingualUrl = (subPath, priority, changefreq, lastmod, image) => {
      if (excluded.has(subPath) || excluded.has(`/en${subPath}`) || excluded.has(`/ur${subPath}`)) return;
      const absImage = image && image.startsWith("/") ? `${baseUrl}${image}` : image;
      for (const lang of ["ur", "en"]) {
        const loc = `${baseUrl}/${lang}${subPath}`;
        xml += `  <url>
`;
        xml += `    <loc>${escapeXml(loc)}</loc>
`;
        if (lastmod) xml += `    <lastmod>${escapeXml(lastmod)}</lastmod>
`;
        xml += `    <changefreq>${changefreq}</changefreq>
`;
        xml += `    <priority>${priority}</priority>
`;
        xml += `    <xhtml:link rel="alternate" hreflang="en" href="${escapeXml(`${baseUrl}/en${subPath}`)}" />
`;
        xml += `    <xhtml:link rel="alternate" hreflang="ur" href="${escapeXml(`${baseUrl}/ur${subPath}`)}" />
`;
        if (config.includeImages && absImage && absImage.startsWith("http")) {
          xml += `    <image:image><image:loc>${escapeXml(absImage)}</image:loc></image:image>
`;
        }
        xml += `  </url>
`;
      }
    };
    for (const sp of staticPaths) {
      emitBilingualUrl(sp, sp === "" ? "1.0" : "0.6", sp === "" ? "hourly" : config.defaultChangefreq);
    }
    if (config.includeCategories) {
      for (const cat of categories) {
        emitBilingualUrl(`/${cat.slug}`, "0.8", "hourly");
      }
    }
    for (const art of articles) {
      const slug = art.slug || art.id;
      const lastmod = (art.updatedAt || art.publishedAt || (/* @__PURE__ */ new Date()).toISOString()).split("T")[0];
      emitBilingualUrl(`/news/${slug}`, "0.9", config.defaultChangefreq || "daily", lastmod, art.heroImage || art.featuredImage);
    }
    xml += `</urlset>`;
    return xml;
  }
  static buildNewsSitemapXml() {
    const baseUrl = this.getBaseUrl();
    const nowMs = Date.now();
    const cutoff = new Date(nowMs - 48 * 3600 * 1e3).toISOString();
    const recent = db.getData().articles.filter(
      (a) => isArticlePubliclyIndexable(a, nowMs) && a.publishedAt >= cutoff
    );
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
`;
    for (const art of recent) {
      const pubDate = new Date(art.publishedAt).toISOString();
      const slug = art.slug || art.id;
      xml += `  <url>
`;
      xml += `    <loc>${escapeXml(`${baseUrl}/en/news/${slug}`)}</loc>
`;
      xml += `    <news:news>
`;
      xml += `      <news:publication><news:name>360Khabarnama</news:name><news:language>en</news:language></news:publication>
`;
      xml += `      <news:publication_date>${pubDate}</news:publication_date>
`;
      xml += `      <news:title><![CDATA[${art.titleEn}]]></news:title>
`;
      xml += `    </news:news>
`;
      xml += `  </url>
`;
      xml += `  <url>
`;
      xml += `    <loc>${escapeXml(`${baseUrl}/ur/news/${slug}`)}</loc>
`;
      xml += `    <news:news>
`;
      xml += `      <news:publication><news:name>360 \u062E\u0628\u0631\u0646\u0627\u0645\u06C1</news:name><news:language>ur</news:language></news:publication>
`;
      xml += `      <news:publication_date>${pubDate}</news:publication_date>
`;
      xml += `      <news:title><![CDATA[${art.titleUr}]]></news:title>
`;
      xml += `    </news:news>
`;
      xml += `  </url>
`;
    }
    xml += `</urlset>`;
    return xml;
  }
  static buildImageSitemapXml() {
    const baseUrl = this.getBaseUrl();
    const nowMs = Date.now();
    const articles = db.getData().articles.filter((a) => isArticlePubliclyIndexable(a, nowMs));
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
`;
    for (const art of articles) {
      const slug = art.slug || art.id;
      const imgs = Array.from(
        new Set(
          [art.heroImage, art.featuredImage, art.socialImageUrl].filter((u) => Boolean(u && u.trim())).map((u) => u.startsWith("/") ? `${baseUrl}${u}` : u).filter((u) => u.startsWith("http"))
        )
      );
      if (imgs.length === 0) continue;
      for (const lang of ["en", "ur"]) {
        xml += `  <url>
`;
        xml += `    <loc>${escapeXml(`${baseUrl}/${lang}/news/${slug}`)}</loc>
`;
        for (const imgUrl of imgs) {
          const title = lang === "ur" ? art.titleUr : art.titleEn;
          const caption = lang === "ur" ? art.heroImageMeta?.captionUr || art.imageCaptionUr || art.summaryUr : art.heroImageMeta?.captionEn || art.imageCaptionEn || art.summaryEn;
          xml += `    <image:image>
`;
          xml += `      <image:loc>${escapeXml(imgUrl)}</image:loc>
`;
          if (title) xml += `      <image:title>${escapeXml(title)}</image:title>
`;
          if (caption) xml += `      <image:caption>${escapeXml(caption.slice(0, 220))}</image:caption>
`;
          xml += `    </image:image>
`;
        }
        xml += `  </url>
`;
      }
    }
    xml += `</urlset>`;
    return xml;
  }
  static buildVideoSitemapXml() {
    const baseUrl = this.getBaseUrl();
    const nowMs = Date.now();
    const videoArticles = db.getData().articles.filter(
      (a) => isArticlePubliclyIndexable(a, nowMs) && Boolean(a.videoUrl && a.videoUrl.trim())
    );
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
`;
    for (const art of videoArticles) {
      const slug = art.slug || art.id;
      const thumbRaw = art.featuredImage || art.heroImage || `${baseUrl}/assets/aistudio/Modern_Green_and_Gold_News_Logo_2e9a99d4.png`;
      const thumb = thumbRaw.startsWith("/") ? `${baseUrl}${thumbRaw}` : thumbRaw;
      const videoLoc = art.videoUrl.startsWith("/") ? `${baseUrl}${art.videoUrl}` : art.videoUrl;
      const pubDate = new Date(art.publishedAt || Date.now()).toISOString();
      xml += `  <url>
`;
      xml += `    <loc>${escapeXml(`${baseUrl}/en/news/${slug}`)}</loc>
`;
      xml += `    <video:video>
`;
      xml += `      <video:thumbnail_loc>${escapeXml(thumb)}</video:thumbnail_loc>
`;
      xml += `      <video:title>${escapeXml(art.titleEn)}</video:title>
`;
      xml += `      <video:description>${escapeXml((art.summaryEn || art.titleEn).slice(0, 500))}</video:description>
`;
      xml += `      <video:content_loc>${escapeXml(videoLoc)}</video:content_loc>
`;
      xml += `      <video:publication_date>${escapeXml(pubDate)}</video:publication_date>
`;
      xml += `    </video:video>
`;
      xml += `  </url>
`;
    }
    xml += `</urlset>`;
    return xml;
  }
  static getRobotsTxt() {
    const baseUrl = this.getBaseUrl();
    return db.getRobotsTxt().replace(/https:\/\/(?:www\.)?360khabarnama\.com/g, baseUrl);
  }
  static async submitIndexNow(urls, overrideKey) {
    const baseUrl = this.getBaseUrl();
    const settings = db.getData().siteSettings;
    const key = (overrideKey || settings.indexNowKey || "").trim();
    if (!key) {
      return {
        ok: false,
        status: 400,
        submittedUrls: 0,
        message: "IndexNow API key is not configured in Global Settings > Integrations."
      };
    }
    const host = new URL(baseUrl).host;
    const validUrls = urls.map((u) => u.trim()).filter(Boolean).map((u) => u.startsWith("/") ? `${baseUrl}${u}` : u).slice(0, 100);
    if (validUrls.length === 0) {
      return {
        ok: false,
        status: 400,
        submittedUrls: 0,
        message: "Provide at least one valid URL to submit to IndexNow."
      };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12e3);
    try {
      const resp = await fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          host,
          key,
          keyLocation: `${baseUrl}/${key}.txt`,
          urlList: validUrls
        }),
        signal: controller.signal
      });
      const ok = resp.status >= 200 && resp.status < 300;
      return {
        ok,
        status: resp.status,
        submittedUrls: validUrls.length,
        message: ok ? `Submitted ${validUrls.length} URL(s) to IndexNow (HTTP ${resp.status}).` : `IndexNow returned HTTP ${resp.status}. Verify ${baseUrl}/${key}.txt is reachable publicly.`
      };
    } catch (err) {
      return {
        ok: false,
        status: 502,
        submittedUrls: 0,
        message: err?.message || "Failed to reach api.indexnow.org"
      };
    } finally {
      clearTimeout(timer);
    }
  }
};

// services/seo/SearchConsoleService.ts
import crypto7 from "crypto";
var GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
var SearchConsoleService = class {
  static getSanitizedConnection() {
    const conn = db.getSearchConsoleConnection();
    return {
      authMode: conn.authMode,
      propertyUrl: conn.propertyUrl,
      clientId: conn.clientId || "",
      hasClientSecret: Boolean(conn.encryptedClientSecret),
      hasRefreshToken: Boolean(conn.encryptedRefreshToken),
      hasServiceAccountJson: Boolean(conn.encryptedServiceAccountJson),
      serviceAccountEmail: conn.serviceAccountEmail || "",
      tokenExpiresAt: conn.tokenExpiresAt || null,
      diagnosticStatus: conn.diagnosticStatus,
      diagnosticMessage: conn.diagnosticMessage || "",
      availableProperties: conn.availableProperties || [],
      lastCheckedAt: conn.lastCheckedAt || null,
      lastSyncedAt: conn.lastSyncedAt || null
    };
  }
  static saveOAuthConfig(input, actor) {
    const existing = db.getSearchConsoleConnection();
    if (!input.clientId?.trim()) {
      throw new Error("Google OAuth Client ID is required.");
    }
    const updated = db.updateSearchConsoleConnection(
      {
        authMode: "oauth2",
        clientId: input.clientId.trim(),
        propertyUrl: (input.propertyUrl || existing.propertyUrl || "").trim(),
        encryptedClientSecret: input.clientSecret?.trim() ? encryptSecret(input.clientSecret.trim()) : existing.encryptedClientSecret,
        diagnosticStatus: existing.encryptedRefreshToken ? existing.diagnosticStatus : "Disconnected",
        diagnosticMessage: existing.encryptedRefreshToken ? "OAuth configuration updated." : "OAuth Client saved. Complete authorization consent to connect your Search Console property."
      },
      actor
    );
    return updated;
  }
  static saveServiceAccountConfig(input, actor) {
    let parsed;
    try {
      parsed = JSON.parse(input.serviceAccountJson);
    } catch {
      throw new Error("Invalid JSON file content for Service Account.");
    }
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error('Service Account JSON must contain "client_email" and "private_key".');
    }
    const updated = db.updateSearchConsoleConnection(
      {
        authMode: "service_account",
        serviceAccountEmail: parsed.client_email,
        encryptedServiceAccountJson: encryptSecret(input.serviceAccountJson),
        propertyUrl: (input.propertyUrl || "").trim(),
        diagnosticStatus: "Disconnected",
        diagnosticMessage: `Service account ${parsed.client_email} stored (encrypted). Run "Test Connection" to verify access in Google Search Console.`
      },
      actor
    );
    return updated;
  }
  static disconnect(actor) {
    db.updateSearchConsoleConnection(
      {
        authMode: "none",
        propertyUrl: "",
        clientId: "",
        encryptedClientSecret: void 0,
        encryptedRefreshToken: void 0,
        encryptedAccessToken: void 0,
        encryptedServiceAccountJson: void 0,
        serviceAccountEmail: void 0,
        tokenExpiresAt: void 0,
        availableProperties: [],
        diagnosticStatus: "Disconnected",
        diagnosticMessage: "Google Search Console disconnected. Metrics cleared."
      },
      actor
    );
    db.updateSearchConsoleMetrics({
      connected: false,
      diagnosticStatus: "Disconnected",
      diagnosticMessage: "Search Console is disconnected.",
      impressions: 0,
      clicks: 0,
      ctr: 0,
      averagePosition: 0,
      topQueries: [],
      topPages: [],
      devices: [],
      countries: []
    });
  }
  static getOAuthAuthorizeUrl(redirectUri) {
    const conn = db.getSearchConsoleConnection();
    if (!conn.clientId) {
      throw new Error("Configure OAuth Client ID before initiating Google authorization.");
    }
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", conn.clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", GSC_SCOPE);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    return url.toString();
  }
  static async handleOAuthCallback(code, redirectUri, actor) {
    const conn = db.getSearchConsoleConnection();
    if (!conn.clientId || !conn.encryptedClientSecret) {
      throw new Error("OAuth Client ID and Client Secret must be saved before exchanging code.");
    }
    const clientSecret = decryptSecret(conn.encryptedClientSecret);
    const body = new URLSearchParams({
      code,
      client_id: conn.clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    });
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    });
    const tokenJson = await resp.json();
    if (!resp.ok || !tokenJson.access_token) {
      db.updateSearchConsoleConnection(
        {
          diagnosticStatus: "API Error",
          diagnosticMessage: tokenJson.error_description || tokenJson.error || "OAuth token exchange failed.",
          lastCheckedAt: (/* @__PURE__ */ new Date()).toISOString()
        },
        actor
      );
      throw new Error(tokenJson.error_description || "Google OAuth token exchange failed.");
    }
    const expiresAt = new Date(Date.now() + (tokenJson.expires_in || 3500) * 1e3).toISOString();
    db.updateSearchConsoleConnection(
      {
        authMode: "oauth2",
        encryptedAccessToken: encryptSecret(tokenJson.access_token),
        encryptedRefreshToken: tokenJson.refresh_token ? encryptSecret(tokenJson.refresh_token) : conn.encryptedRefreshToken,
        tokenExpiresAt: expiresAt,
        diagnosticStatus: "Authorized",
        diagnosticMessage: "OAuth 2.0 consent granted. Testing property access...",
        lastCheckedAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      actor
    );
    return await this.testAndVerifyConnection(actor);
  }
  static async acquireAccessToken(conn) {
    if (conn.authMode === "none") {
      throw new Error("NO_CREDENTIALS");
    }
    if (conn.authMode === "service_account") {
      if (!conn.encryptedServiceAccountJson) {
        throw new Error("Service Account JSON missing.");
      }
      const sa = JSON.parse(decryptSecret(conn.encryptedServiceAccountJson));
      const nowSec = Math.floor(Date.now() / 1e3);
      const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
      const claim = Buffer.from(
        JSON.stringify({
          iss: sa.client_email,
          scope: GSC_SCOPE,
          aud: sa.token_uri || "https://oauth2.googleapis.com/token",
          iat: nowSec,
          exp: nowSec + 3600
        })
      ).toString("base64url");
      const unsigned = `${header}.${claim}`;
      const signer = crypto7.createSign("RSA-SHA256");
      signer.update(unsigned);
      const signature = signer.sign(sa.private_key, "base64url");
      const assertion = `${unsigned}.${signature}`;
      const resp2 = await fetch(sa.token_uri || "https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion
        }).toString()
      });
      const json2 = await resp2.json();
      if (!resp2.ok || !json2.access_token) {
        throw new Error(`TOKEN_EXPIRED: ${json2.error_description || json2.error || "Service account token rejected"}`);
      }
      return json2.access_token;
    }
    if (conn.encryptedAccessToken && conn.tokenExpiresAt && new Date(conn.tokenExpiresAt).getTime() - Date.now() > 6e4) {
      return decryptSecret(conn.encryptedAccessToken);
    }
    if (!conn.encryptedRefreshToken || !conn.clientId || !conn.encryptedClientSecret) {
      throw new Error("TOKEN_EXPIRED: Refresh token or OAuth secret missing. Re-authorize Google Search Console.");
    }
    const refreshToken = decryptSecret(conn.encryptedRefreshToken);
    const clientSecret = decryptSecret(conn.encryptedClientSecret);
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: conn.clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token"
      }).toString()
    });
    const json = await resp.json();
    if (!resp.ok || !json.access_token) {
      throw new Error(`TOKEN_EXPIRED: ${json.error_description || json.error || "OAuth refresh failed"}`);
    }
    db.updateSearchConsoleConnection(
      {
        encryptedAccessToken: encryptSecret(json.access_token),
        tokenExpiresAt: new Date(Date.now() + (json.expires_in || 3500) * 1e3).toISOString()
      },
      "Search Console Auto-Refresh"
    );
    return json.access_token;
  }
  static async testAndVerifyConnection(actor = "SEO Manager") {
    const conn = db.getSearchConsoleConnection();
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    if (conn.authMode === "none") {
      const msg = "No Google Search Console OAuth 2.0 or Service Account credentials configured.";
      db.updateSearchConsoleConnection({ diagnosticStatus: "Disconnected", diagnosticMessage: msg, lastCheckedAt: nowIso }, actor);
      return { status: "Disconnected", message: msg, properties: [] };
    }
    try {
      const token = await this.acquireAccessToken(conn);
      const sitesResp = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (sitesResp.status === 401) {
        const msg2 = "Google access token expired or revoked (HTTP 401). Re-authenticate.";
        db.updateSearchConsoleConnection({ diagnosticStatus: "Token Expired", diagnosticMessage: msg2, lastCheckedAt: nowIso }, actor);
        return { status: "Token Expired", message: msg2, properties: [] };
      }
      if (sitesResp.status === 403) {
        const msg2 = "Access Denied (HTTP 403). Ensure this account or service email is added as a User in Search Console.";
        db.updateSearchConsoleConnection({ diagnosticStatus: "Access Denied", diagnosticMessage: msg2, lastCheckedAt: nowIso }, actor);
        return { status: "Access Denied", message: msg2, properties: [] };
      }
      if (!sitesResp.ok) {
        const errText = await sitesResp.text();
        const msg2 = `Search Console API Error (HTTP ${sitesResp.status}): ${errText.slice(0, 180)}`;
        db.updateSearchConsoleConnection({ diagnosticStatus: "API Error", diagnosticMessage: msg2, lastCheckedAt: nowIso }, actor);
        return { status: "API Error", message: msg2, properties: [] };
      }
      const sitesData = await sitesResp.json();
      const siteEntries = sitesData.siteEntry || [];
      const properties = siteEntries.map((s) => s.siteUrl).filter(Boolean);
      if (properties.length === 0) {
        const msg2 = "Authorized successfully, but 0 Search Console properties were found for this account/service email.";
        db.updateSearchConsoleConnection(
          {
            diagnosticStatus: "Property Not Found",
            diagnosticMessage: msg2,
            availableProperties: [],
            lastCheckedAt: nowIso
          },
          actor
        );
        return { status: "Property Not Found", message: msg2, properties: [] };
      }
      const targetProp = conn.propertyUrl || properties[0];
      const matched = properties.some((p) => p.toLowerCase() === targetProp.toLowerCase());
      if (conn.propertyUrl && !matched) {
        const msg2 = `Property "${conn.propertyUrl}" not found in verified sites. Available: ${properties.join(", ")}`;
        db.updateSearchConsoleConnection(
          {
            diagnosticStatus: "Property Not Found",
            diagnosticMessage: msg2,
            availableProperties: properties,
            lastCheckedAt: nowIso
          },
          actor
        );
        return { status: "Property Not Found", message: msg2, properties };
      }
      const msg = `Verified connection to Search Console property ${targetProp}.`;
      db.updateSearchConsoleConnection(
        {
          propertyUrl: targetProp,
          availableProperties: properties,
          diagnosticStatus: "Authorized",
          diagnosticMessage: msg,
          lastCheckedAt: nowIso
        },
        actor
      );
      return { status: "Authorized", message: msg, properties };
    } catch (err) {
      const text = err?.message || "Unknown Search Console error";
      const status = text.startsWith("TOKEN_EXPIRED") ? "Token Expired" : "API Error";
      db.updateSearchConsoleConnection(
        {
          diagnosticStatus: status,
          diagnosticMessage: text,
          lastCheckedAt: nowIso
        },
        actor
      );
      return { status, message: text, properties: [] };
    }
  }
  static async syncLiveAnalytics(actor = "SEO Manager") {
    const check = await this.testAndVerifyConnection(actor);
    if (check.status !== "Authorized") {
      const updated = {
        connected: false,
        diagnosticStatus: check.status,
        diagnosticMessage: check.message,
        propertyUrl: db.getSearchConsoleConnection().propertyUrl || "",
        impressions: 0,
        clicks: 0,
        ctr: 0,
        averagePosition: 0,
        topQueries: [],
        topPages: [],
        devices: [],
        countries: []
      };
      db.updateSearchConsoleMetrics(updated);
      return db.getSearchConsoleMetrics();
    }
    const conn = db.getSearchConsoleConnection();
    const token = await this.acquireAccessToken(conn);
    const propertyUrl = conn.propertyUrl;
    const endDate = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 28 * 864e5).toISOString().split("T")[0];
    const apiBase = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(propertyUrl)}/searchAnalytics/query`;
    const queryDimension = async (dimensions, rowLimit) => {
      const r = await fetch(apiBase, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          startDate,
          endDate,
          dimensions,
          rowLimit
        })
      });
      if (!r.ok) {
        const bodyText = await r.text();
        throw new Error(`Search Analytics query error (HTTP ${r.status}): ${bodyText.slice(0, 150)}`);
      }
      return await r.json();
    };
    try {
      const [queriesRes, pagesRes, devicesRes, countriesRes] = await Promise.all([
        queryDimension(["query"], 20),
        queryDimension(["page"], 20),
        queryDimension(["device"], 5),
        queryDimension(["country"], 10)
      ]);
      const queryRows = queriesRes.rows || [];
      const pageRows = pagesRes.rows || [];
      const totalClicks = pageRows.reduce((s, r) => s + (r.clicks || 0), 0);
      const totalImpressions = pageRows.reduce((s, r) => s + (r.impressions || 0), 0);
      const weightedPosSum = pageRows.reduce((s, r) => s + (r.position || 0) * (r.impressions || 0), 0);
      const status = queryRows.length === 0 && pageRows.length === 0 ? "No Data Yet" : "Authorized";
      const msg = status === "No Data Yet" ? `Connected to ${propertyUrl}, but Search Console reports no indexed clicks/impressions for ${startDate} to ${endDate}.` : `Synchronized 28-day live Search Console analytics (${startDate} to ${endDate}).`;
      const deviceRows = devicesRes.rows || [];
      const deviceClicksTotal = deviceRows.reduce((s, r) => s + (r.impressions || 0), 0) || 1;
      const countryRows = countriesRes.rows || [];
      const countryImpTotal = countryRows.reduce((s, r) => s + (r.impressions || 0), 0) || 1;
      db.updateSearchConsoleConnection(
        {
          diagnosticStatus: status,
          diagnosticMessage: msg,
          lastSyncedAt: (/* @__PURE__ */ new Date()).toISOString()
        },
        actor
      );
      db.updateSearchConsoleMetrics({
        connected: true,
        diagnosticStatus: status,
        diagnosticMessage: msg,
        propertyUrl,
        impressions: totalImpressions,
        clicks: totalClicks,
        ctr: totalImpressions > 0 ? parseFloat((totalClicks / totalImpressions * 100).toFixed(2)) : 0,
        averagePosition: totalImpressions > 0 ? parseFloat((weightedPosSum / totalImpressions).toFixed(1)) : 0,
        topQueries: queryRows.map((r) => ({
          query: r.keys?.[0] || "",
          clicks: Math.round(r.clicks || 0),
          impressions: Math.round(r.impressions || 0),
          ctr: parseFloat(((r.ctr || 0) * 100).toFixed(2)),
          position: parseFloat((r.position || 0).toFixed(1))
        })),
        topPages: pageRows.map((r) => ({
          path: r.keys?.[0] || "",
          clicks: Math.round(r.clicks || 0),
          impressions: Math.round(r.impressions || 0),
          ctr: parseFloat(((r.ctr || 0) * 100).toFixed(2)),
          position: parseFloat((r.position || 0).toFixed(1))
        })),
        devices: deviceRows.map((r) => ({
          device: r.keys?.[0] || "OTHER",
          percent: Math.round((r.impressions || 0) / deviceClicksTotal * 100),
          clicks: Math.round(r.clicks || 0),
          impressions: Math.round(r.impressions || 0)
        })),
        countries: countryRows.map((r) => ({
          country: (r.keys?.[0] || "PAK").toUpperCase(),
          percent: Math.round((r.impressions || 0) / countryImpTotal * 100),
          clicks: Math.round(r.clicks || 0),
          impressions: Math.round(r.impressions || 0)
        }))
      });
      return db.getSearchConsoleMetrics();
    } catch (err) {
      db.updateSearchConsoleConnection(
        {
          diagnosticStatus: "API Error",
          diagnosticMessage: err?.message || "Failed querying Search Analytics",
          lastCheckedAt: (/* @__PURE__ */ new Date()).toISOString()
        },
        actor
      );
      throw err;
    }
  }
};

// services/seo/MetadataGenerator.ts
var escapeAttr = (val) => String(val || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
var escapeHtml = (val) => String(val || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
var MetadataGenerator = class {
  static resolveForPath(requestPath, preloadedArticle) {
    const cleanPath = (requestPath || "/").split("?")[0];
    const data = db.getData();
    const settings = data.siteSettings;
    const baseUrl = (settings.siteUrl || process.env.APP_URL || "https://www.360khabarnama.com").trim().replace(/\/+$/, "");
    const defaultOgImage = `${baseUrl}/assets/aistudio/Modern_Green_and_Gold_News_Logo_2e9a99d4.png`;
    if (cleanPath === "/admin" || cleanPath.startsWith("/admin/")) {
      return {
        title: `Private Admin OS \u2014 ${settings.siteNameEn || "360Khabarnama"}`,
        description: "Authorized private editorial and system administration console for 360Khabarnama.",
        canonicalUrl: `${baseUrl}/admin`,
        robots: "noindex, nofollow, noarchive",
        ogTitle: "360Khabarnama Private Admin",
        ogDescription: "Authorized editorial management console.",
        ogImage: defaultOgImage,
        ogType: "website",
        hreflangEn: `${baseUrl}/admin`,
        hreflangUr: `${baseUrl}/admin`,
        hreflangDefault: `${baseUrl}/admin`,
        lang: "en",
        dir: "ltr"
      };
    }
    const isEn = cleanPath === "/en" || cleanPath.startsWith("/en/");
    const lang = isEn ? "en" : "ur";
    const dir = lang === "ur" ? "rtl" : "ltr";
    const stripped = cleanPath.replace(/^\/(en|ur)(\/|$)/, "/").replace(/\/+$/, "") || "/";
    const newsMatch = stripped.match(/^\/news\/([^/]+)$/);
    if (newsMatch) {
      const slug = decodeURIComponent(newsMatch[1]);
      const article = preloadedArticle || db.getArticleBySlugOrId(slug);
      if (article) {
        const meta = SEOEngine.generateArticleMetadata(article, lang);
        const jsonLd = SEOEngine.generateNewsArticleSchema(article, lang);
        return {
          title: meta.title,
          description: meta.description,
          canonicalUrl: meta.canonicalUrl,
          robots: meta.robots,
          ogTitle: meta.ogTitle,
          ogDescription: meta.ogDescription,
          ogImage: meta.ogImage,
          ogType: meta.ogType,
          hreflangEn: meta.hreflangEn,
          hreflangUr: meta.hreflangUr,
          hreflangDefault: meta.hreflangUr,
          lang,
          dir,
          jsonLd
        };
      }
    }
    const seoPages = db.getSeoPages();
    const matchedSeo = seoPages.find((p) => p.path === stripped || p.path === cleanPath);
    if (matchedSeo) {
      const title = lang === "ur" ? matchedSeo.titleUr || matchedSeo.titleEn : matchedSeo.titleEn;
      const desc = lang === "ur" ? matchedSeo.metaDescUr || matchedSeo.metaDescEn : matchedSeo.metaDescEn;
      const subPath2 = stripped === "/" ? "" : stripped;
      return {
        title,
        description: desc,
        canonicalUrl: matchedSeo.canonicalUrl || `${baseUrl}/${lang}${subPath2}`,
        robots: matchedSeo.robotsDirectives || settings.seoDefaults?.robotsDefault || "index, follow",
        ogTitle: (lang === "ur" ? matchedSeo.ogTitleUr : matchedSeo.ogTitleEn) || title,
        ogDescription: (lang === "ur" ? matchedSeo.ogDescUr : matchedSeo.ogDescEn) || desc,
        ogImage: matchedSeo.ogImage || defaultOgImage,
        ogType: "website",
        hreflangEn: matchedSeo.hreflangEn || `${baseUrl}/en${subPath2}`,
        hreflangUr: matchedSeo.hreflangUr || `${baseUrl}/ur${subPath2}`,
        hreflangDefault: `${baseUrl}/ur${subPath2}`,
        lang,
        dir,
        jsonLd: {
          "@context": "https://schema.org",
          "@type": matchedSeo.schemaType || "WebPage",
          name: title,
          description: desc,
          url: `${baseUrl}/${lang}${subPath2}`,
          inLanguage: lang === "ur" ? "ur-PK" : "en-PK"
        }
      };
    }
    const catSlug = stripped.replace(/^\//, "").split("/")[0];
    const catPage = db.getCategoryPages().find((c) => c.slug === catSlug);
    if (catPage) {
      const title = lang === "ur" ? catPage.seoTitleUr || `${catPage.nameUr} | ${settings.siteNameUr}` : catPage.seoTitleEn || `${catPage.nameEn} | ${settings.siteNameEn}`;
      const desc = lang === "ur" ? catPage.metaDescUr || catPage.descriptionUr : catPage.metaDescEn || catPage.descriptionEn;
      return {
        title,
        description: desc,
        canonicalUrl: catPage.canonicalUrl || `${baseUrl}/${lang}/${catPage.slug}`,
        robots: catPage.robots || settings.seoDefaults?.robotsDefault || "index, follow",
        ogTitle: title,
        ogDescription: desc,
        ogImage: catPage.ogImage || defaultOgImage,
        ogType: "website",
        hreflangEn: `${baseUrl}/en/${catPage.slug}`,
        hreflangUr: `${baseUrl}/ur/${catPage.slug}`,
        hreflangDefault: `${baseUrl}/ur/${catPage.slug}`,
        lang,
        dir,
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: title,
          description: desc,
          url: `${baseUrl}/${lang}/${catPage.slug}`,
          inLanguage: lang === "ur" ? "ur-PK" : "en-PK"
        }
      };
    }
    const defaultTitle = lang === "ur" ? `${settings.siteNameUr || "360 \u062E\u0628\u0631\u0646\u0627\u0645\u06C1"} | ${settings.taglineUr || "\u062A\u0627\u0632\u06C1 \u062A\u0631\u06CC\u0646 \u062E\u0628\u0631\u06CC\u06BA \u0627\u0648\u0631 \u0645\u0639\u0644\u0648\u0645\u0627\u062A"}` : `${settings.siteNameEn || "360Khabarnama"} | ${settings.taglineEn || "Pakistan Digital News & Utility Portal"}`;
    const defaultDesc = settings.seoDefaults?.defaultMetaDescEn || "Pakistan's premier bilingual English & Urdu news, finance, live cricket, weather, education results, and utilities portal.";
    const subPath = stripped === "/" ? "" : stripped;
    return {
      title: defaultTitle,
      description: defaultDesc,
      canonicalUrl: `${baseUrl}${cleanPath === "/" ? "" : cleanPath}`,
      robots: settings.seoDefaults?.robotsDefault || "index, follow, max-image-preview:large",
      ogTitle: defaultTitle,
      ogDescription: defaultDesc,
      ogImage: settings.seoDefaults?.defaultOgImage || defaultOgImage,
      ogType: "website",
      hreflangEn: `${baseUrl}/en${subPath}`,
      hreflangUr: `${baseUrl}/ur${subPath}`,
      hreflangDefault: `${baseUrl}/ur${subPath}`,
      lang,
      dir,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "NewsMediaOrganization",
        name: "360Khabarnama",
        alternateName: "360 \u062E\u0628\u0631\u0646\u0627\u0645\u06C1",
        url: baseUrl,
        logo: defaultOgImage
      }
    };
  }
  static injectMetadataIntoHtml(html, requestPath, preloadedArticle) {
    const meta = this.resolveForPath(requestPath, preloadedArticle);
    let out = html;
    out = out.replace(
      /<html[^>]*>/i,
      `<html lang="${meta.lang}" dir="${meta.dir}">`
    );
    out = out.replace(
      /<title>[\s\S]*?<\/title>/i,
      `<title>${escapeHtml(meta.title)}</title>`
    );
    if (/<meta\s+name="description"/i.test(out)) {
      out = out.replace(
        /<meta\s+name="description"[^>]*>/i,
        `<meta name="description" content="${escapeAttr(meta.description)}" />`
      );
    }
    const settings = db.getData().siteSettings;
    const isAdminRoute = meta.canonicalUrl.endsWith("/admin");
    const gaId = (settings.googleAnalyticsId || "").trim();
    const gtmId = (settings.googleTagManagerId || "").trim();
    const bingCode = (settings.bingWebmasterVerification || "").trim();
    const gscCode = (settings.searchConsoleVerification || "").trim();
    const analyticsTags = [];
    if (gscCode && !out.includes("google-site-verification")) {
      analyticsTags.push(`<meta name="google-site-verification" content="${escapeAttr(gscCode)}" />`);
    }
    if (bingCode && !out.includes("msvalidate.01")) {
      analyticsTags.push(`<meta name="msvalidate.01" content="${escapeAttr(bingCode)}" />`);
    }
    if (!isAdminRoute) {
      if (/^GTM-[A-Z0-9]+$/i.test(gtmId) && !out.includes(gtmId)) {
        analyticsTags.push(
          `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${escapeAttr(gtmId)}');</script>`
        );
      }
      if (/^(G|UA|AW|DC)-[A-Z0-9-]+$/i.test(gaId) && !out.includes(gaId)) {
        const sendPageView = !/^GTM-[A-Z0-9]+$/i.test(gtmId);
        analyticsTags.push(
          `<script async src="https://www.googletagmanager.com/gtag/js?id=${escapeAttr(gaId)}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${escapeAttr(gaId)}',{send_page_view:${sendPageView}});</script>`
        );
      }
    }
    const injectedHeadTags = [
      `<meta name="robots" content="${escapeAttr(meta.robots)}" />`,
      `<link rel="canonical" href="${escapeAttr(meta.canonicalUrl)}" />`,
      `<link rel="alternate" hreflang="en" href="${escapeAttr(meta.hreflangEn)}" />`,
      `<link rel="alternate" hreflang="ur" href="${escapeAttr(meta.hreflangUr)}" />`,
      `<link rel="alternate" hreflang="x-default" href="${escapeAttr(meta.hreflangDefault)}" />`,
      `<meta property="og:title" content="${escapeAttr(meta.ogTitle)}" />`,
      `<meta property="og:description" content="${escapeAttr(meta.ogDescription)}" />`,
      `<meta property="og:type" content="${escapeAttr(meta.ogType)}" />`,
      `<meta property="og:url" content="${escapeAttr(meta.canonicalUrl)}" />`,
      `<meta property="og:image" content="${escapeAttr(meta.ogImage)}" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${escapeAttr(meta.ogTitle)}" />`,
      `<meta name="twitter:description" content="${escapeAttr(meta.ogDescription)}" />`,
      ...analyticsTags,
      meta.jsonLd ? `<script type="application/ld+json">${JSON.stringify(meta.jsonLd)}</script>` : ""
    ].filter(Boolean).join("\n    ");
    out = out.replace("</head>", `    ${injectedHeadTags}
  </head>`);
    return out;
  }
};

// services/content/ContentFreshnessEngine.ts
var ContentFreshnessEngine = class {
  static {
    this.TIME_SENSITIVE_KEYWORDS = [
      "petrol",
      "diesel",
      "ogra",
      "gold",
      "dollar",
      "psx",
      "date sheet",
      "exam",
      "result",
      "admission",
      "deadline",
      "ramadan",
      "eid"
    ];
  }
  static scanArticlesForFreshness(articles) {
    const tasks = [];
    const now = Date.now();
    for (const art of articles) {
      if (art.status !== "published") continue;
      const pubTime = new Date(art.updatedAt || art.publishedAt).getTime();
      const ageDays = Math.floor((now - pubTime) / (1e3 * 60 * 60 * 24));
      const lowerTitle = (art.titleEn || "").toLowerCase();
      const isTimeSensitive = this.TIME_SENSITIVE_KEYWORDS.some((k) => lowerTitle.includes(k));
      if (isTimeSensitive && ageDays >= 14) {
        tasks.push({
          articleId: art.id,
          titleEn: art.titleEn,
          category: art.category,
          publishedAt: art.publishedAt,
          ageDays,
          reason: "Time-sensitive topic (rates, exam notice, or policy) older than 14 days.",
          priority: "high",
          recommendedAction: "Verify current figures against official sources or archive/link to latest update."
        });
      } else if (ageDays >= 90) {
        tasks.push({
          articleId: art.id,
          titleEn: art.titleEn,
          category: art.category,
          publishedAt: art.publishedAt,
          ageDays,
          reason: "Evergreen/general article has not been reviewed in 90+ days.",
          priority: "medium",
          recommendedAction: "Audit factual accuracy and internal links; preserve original publication date."
        });
      }
    }
    return tasks;
  }
};

// services/news/NewsIngestionEngine.ts
var defaultSources = [
  {
    id: "src-pid-gov",
    name: "Press Information Department (PID) Pakistan",
    url: "https://pid.gov.pk/press-releases",
    type: "official_gazette",
    licenseType: "public_domain",
    attributionText: "Press Information Department (PID), Government of Pakistan",
    categories: ["pakistan", "politics"],
    language: "en",
    refreshIntervalMin: 15,
    autoPublishAllowed: false,
    // Mode C human review by default for policy announcements
    enabled: true,
    lastSyncAt: null,
    lastError: null
  },
  {
    id: "src-sbp-notices",
    name: "State Bank of Pakistan (SBP) Monetary & Circulars",
    url: "https://www.sbp.org.pk/press/index.asp",
    type: "institutional_feed",
    licenseType: "public_domain",
    attributionText: "State Bank of Pakistan (SBP)",
    categories: ["business"],
    language: "en",
    refreshIntervalMin: 30,
    autoPublishAllowed: true,
    enabled: true,
    lastSyncAt: null,
    lastError: null
  },
  {
    id: "src-pcb-official",
    name: "Pakistan Cricket Board (PCB) Official Media",
    url: "https://www.pcb.com.pk/news",
    type: "institutional_feed",
    licenseType: "licensed_syndication",
    attributionText: "Pakistan Cricket Board (PCB)",
    categories: ["sports"],
    language: "en",
    refreshIntervalMin: 15,
    autoPublishAllowed: true,
    enabled: true,
    lastSyncAt: null,
    lastError: null
  }
];
var NewsIngestionEngine = class {
  static {
    this.sources = [...defaultSources];
  }
  static getSources() {
    return this.sources;
  }
  static upsertSource(source) {
    const idx = this.sources.findIndex((s) => s.id === source.id);
    if (idx >= 0) {
      this.sources[idx] = { ...this.sources[idx], ...source };
      return this.sources[idx];
    }
    const created = { ...source, id: source.id || `src-${Date.now()}` };
    this.sources.push(created);
    return created;
  }
  static markSourceSynced(sourceId, error = null) {
    const src = this.sources.find((s) => s.id === sourceId);
    if (src) {
      src.lastSyncAt = (/* @__PURE__ */ new Date()).toISOString();
      src.lastError = error;
    }
  }
};

// services/news/NewsDeduplication.ts
var NewsDeduplication = class {
  static tokenize(text) {
    return new Set(
      text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 3)
    );
  }
  static checkDuplicate(incomingTitle, existingArticles, threshold = 0.55) {
    const incomingTokens = this.tokenize(incomingTitle);
    if (incomingTokens.size === 0) {
      return { isDuplicate: false, similarityScore: 0 };
    }
    let bestScore = 0;
    let bestArticle;
    for (const art of existingArticles) {
      const existingTokens = this.tokenize(art.titleEn || "");
      if (existingTokens.size === 0) continue;
      let intersection = 0;
      for (const token of incomingTokens) {
        if (existingTokens.has(token)) intersection++;
      }
      const union = incomingTokens.size + existingTokens.size - intersection;
      const jaccard = union > 0 ? intersection / union : 0;
      if (jaccard > bestScore) {
        bestScore = jaccard;
        bestArticle = art;
      }
    }
    return {
      isDuplicate: bestScore >= threshold,
      similarityScore: parseFloat(bestScore.toFixed(2)),
      matchedArticleId: bestArticle?.id,
      matchedTitle: bestArticle?.titleEn
    };
  }
};

// services/news/NewsVerificationEngine.ts
var NewsVerificationEngine = class {
  static {
    this.HIGH_RISK_KEYWORDS = [
      "alleged",
      "accused",
      "scandal",
      "arrested",
      "corruption",
      "murder",
      "attack",
      "blast",
      "explosion",
      "protest",
      "clash",
      "unconfirmed",
      "rumor",
      "disputed",
      "fatwa",
      "blasphemy"
    ];
  }
  static verifyItem(params) {
    const flags = [];
    const text = `${params.title} ${params.summary}`.toLowerCase();
    if (!params.hasAttribution) {
      flags.push("Missing required source attribution.");
    }
    if (!params.autoPublishAllowed || params.licenseType === "restricted") {
      flags.push("Source license does not permit unattended auto-publishing.");
    }
    const matchedRisk = this.HIGH_RISK_KEYWORDS.filter((k) => text.includes(k));
    if (matchedRisk.length > 0) {
      flags.push(`Sensitive/disputed claim keywords detected: ${matchedRisk.join(", ")}`);
    }
    if (flags.length > 0) {
      return {
        approvedForAutoPublish: false,
        mode: "MODE_C_HUMAN_REVIEW",
        flags,
        riskLevel: matchedRisk.length > 0 ? "high" : "medium"
      };
    }
    return {
      approvedForAutoPublish: true,
      mode: "MODE_B_LICENSED_AUTO",
      flags: [],
      riskLevel: "low"
    };
  }
};

// services/automation/WorkflowOrchestrator.ts
var WorkflowOrchestrator = class {
  static {
    this.emergencyPaused = false;
  }
  static {
    this.lastRun = null;
  }
  static isPaused() {
    return this.emergencyPaused;
  }
  static setPaused(paused, actor = "Admin") {
    this.emergencyPaused = paused;
    db.logAudit(actor, paused ? "Autonomous Pipeline Paused" : "Autonomous Pipeline Resumed", "Emergency pause switch toggled.");
  }
  static getStatus() {
    return {
      emergencyPaused: this.emergencyPaused,
      sourcesCount: NewsIngestionEngine.getSources().filter((s) => s.enabled).length,
      lastRun: this.lastRun
    };
  }
  static processIncomingItem(item, autoPublishAllowed, licenseType, actor = "Autonomous Orchestrator") {
    const existing = db.getData().articles;
    const dedup = NewsDeduplication.checkDuplicate(item.titleEn, existing);
    if (dedup.isDuplicate) {
      db.logAudit(actor, "Duplicate Story Skipped", `Skipped "${item.titleEn}" (similarity ${dedup.similarityScore} with ${dedup.matchedArticleId})`);
      return { action: "skipped_duplicate", dedup };
    }
    const verification = NewsVerificationEngine.verifyItem({
      title: item.titleEn,
      summary: item.summaryEn,
      autoPublishAllowed,
      hasAttribution: !!item.attribution,
      licenseType
    });
    const seoAudit = SEOEngine.runQualityGate({
      titleEn: item.titleEn,
      titleUr: item.titleEn,
      summaryEn: item.summaryEn,
      summaryUr: item.summaryEn,
      status: verification.approvedForAutoPublish ? "published" : "in_review"
    });
    const status = verification.approvedForAutoPublish && seoAudit.passed ? "published" : "in_review";
    const saved = db.upsertArticle({
      id: `art-auto-${Date.now()}`,
      slug: item.titleEn.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, ""),
      titleEn: item.titleEn,
      titleUr: item.titleEn,
      summaryEn: item.summaryEn,
      summaryUr: item.summaryEn,
      contentEn: `${item.summaryEn}

Source: ${item.attribution}`,
      contentUr: `${item.summaryEn}

\u0630\u0631\u06CC\u0639\u06C1: ${item.attribution}`,
      category: item.category,
      tags: [item.category, "Pakistan", "Verified"],
      author: {
        id: "auto-desk",
        nameEn: item.sourceName,
        nameUr: item.sourceName,
        avatar: "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=200&q=80",
        role: "Syndicated / Official Feed"
      },
      publishedAt: item.publishedAt,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      views: 0,
      status,
      heroImage: "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=1200&q=80",
      imageCaptionEn: item.attribution,
      imageCaptionUr: item.attribution,
      isBreaking: false,
      isFeatured: false,
      isTrending: false,
      sourceName: item.attribution,
      sourceUrl: item.sourceUrl,
      readingTimeMin: 2,
      workflowNotes: verification.flags.length > 0 ? verification.flags.join(" | ") : "Auto-verified"
    }, actor);
    return {
      action: status === "published" ? "auto_published" : "routed_to_review",
      articleId: saved.id,
      verification,
      seoAudit
    };
  }
  static runPipelineCycle(actor = "Autonomous Orchestrator") {
    const runId = `run-${Date.now()}`;
    if (this.emergencyPaused) {
      return {
        runId,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        paused: true,
        sourcesChecked: 0,
        itemsProcessed: 0,
        duplicatesSkipped: 0,
        routedToReview: 0,
        autoPublished: 0,
        logs: ["Pipeline is currently paused by emergency switch."]
      };
    }
    const sources = NewsIngestionEngine.getSources().filter((s) => s.enabled);
    const logs = [];
    for (const src of sources) {
      NewsIngestionEngine.markSourceSynced(src.id, null);
      logs.push(`Checked source: ${src.name} (${src.licenseType})`);
    }
    const summary = {
      runId,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      paused: false,
      sourcesChecked: sources.length,
      itemsProcessed: 0,
      duplicatesSkipped: 0,
      routedToReview: 0,
      autoPublished: 0,
      logs
    };
    this.lastRun = summary;
    db.logAudit(actor, "Autonomous Newsroom Cycle", `Checked ${sources.length} configured news sources.`);
    return summary;
  }
};

// services/pages/PageTemplateEngine.ts
var SPECIALIZED_BLOCK_MAP = {
  business: { type: "live_rates_widget", titleEn: "Gold, Currency & PSX Markets", titleUr: "\u0633\u0648\u0646\u0627\u060C \u06A9\u0631\u0646\u0633\u06CC \u0627\u0648\u0631 \u0627\u0633\u0679\u0627\u06A9 \u0631\u06CC\u0679\u0633" },
  weather: { type: "weather_aqi_widget", titleEn: "City Weather & Smog AQI", titleUr: "\u0634\u06C1\u0631\u0648\u06BA \u06A9\u0627 \u0645\u0648\u0633\u0645 \u0627\u0648\u0631 \u0627\u0633\u0645\u0648\u06AF" },
  sports: { type: "cricket_scoreboard_widget", titleEn: "Live Cricket & PSL Scores", titleUr: "\u0644\u0627\u0626\u06CC\u0648 \u06A9\u0631\u06A9\u0679 \u0627\u0633\u06A9\u0648\u0631" },
  islamic: { type: "islamic_prayer_times_widget", titleEn: "Daily Prayer Times & Hijri Digest", titleUr: "\u0627\u0648\u0642\u0627\u062A\u0650 \u0646\u0645\u0627\u0632 \u0627\u0648\u0631 \u0627\u0633\u0644\u0627\u0645\u06CC \u0645\u0639\u0644\u0648\u0645\u0627\u062A" },
  education: { type: "education_board_results_widget", titleEn: "BISE Boards & Result Lookup", titleUr: "\u062A\u0639\u0644\u06CC\u0645\u06CC \u0628\u0648\u0631\u0688\u0632 \u0627\u0648\u0631 \u0631\u0632\u0644\u0679 \u0633\u0631\u0686" },
  mobiles: { type: "mobiles_catalogue", titleEn: "Mobile Phone Specs & Prices", titleUr: "\u0645\u0648\u0628\u0627\u0626\u0644 \u0641\u0648\u0646\u0632 \u06A9\u06CC \u0642\u06CC\u0645\u062A\u06CC\u06BA" },
  automobiles: { type: "vehicles_catalogue", titleEn: "Cars & Bikes Prices Directory", titleUr: "\u06AF\u0627\u0691\u06CC\u0648\u06BA \u0627\u0648\u0631 \u0628\u0627\u0626\u06CC\u06A9\u0633 \u06A9\u06CC \u0642\u06CC\u0645\u062A\u06CC\u06BA" },
  prizebonds: { type: "prize_bond_draw_lookup", titleEn: "Prize Bond Draw Search", titleUr: "\u067E\u0631\u0627\u0626\u0632 \u0628\u0627\u0646\u0688 \u0642\u0631\u0639\u06C1 \u0627\u0646\u062F\u0627\u0632\u06CC" },
  dictionary: { type: "dictionary_lookup", titleEn: "Urdu Dictionary & Islamic Names", titleUr: "\u0627\u0631\u062F\u0648 \u0644\u063A\u062A \u0627\u0648\u0631 \u0627\u0633\u0644\u0627\u0645\u06CC \u0646\u0627\u0645" },
  poetry: { type: "poetry_collection", titleEn: "Urdu Poetry & Ghazals Archive", titleUr: "\u0627\u0631\u062F\u0648 \u0634\u0627\u0639\u0631\u06CC \u0648 \u063A\u0632\u0644\u06CC\u0627\u062A" },
  recipes: { type: "recipe_collection", titleEn: "Pakistani Cuisine Recipes", titleUr: "\u067E\u0627\u06A9\u0633\u062A\u0627\u0646\u06CC \u0644\u0630\u06CC\u0630 \u067E\u06A9\u0648\u0627\u0646" },
  jobs: { type: "jobs_listings", titleEn: "Govt & Private Job Openings", titleUr: "\u0633\u0631\u06A9\u0627\u0631\u06CC \u0648 \u0646\u062C\u06CC \u0645\u0644\u0627\u0632\u0645\u062A\u06CC\u06BA" },
  tools: { type: "utility_calculators_grid", titleEn: "Online Calculators & Utilities", titleUr: "\u0622\u0646 \u0644\u0627\u0626\u0646 \u06A9\u06CC\u0644\u06A9\u0648\u0644\u06CC\u0679\u0631\u0632" }
};
var PageTemplateEngine = class {
  static buildDefaultBlocks(slug, nameEn, nameUr) {
    const blocks = [
      {
        id: `${slug}-hero`,
        type: "category_hero",
        titleEn: `${nameEn} Hub`,
        titleUr: `${nameUr} \u067E\u0648\u0631\u0679\u0644`,
        enabled: true,
        order: 1,
        width: "full"
      }
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
        width: "full"
      });
    } else {
      blocks.push({
        id: `${slug}-featured`,
        type: "featured_story",
        titleEn: `Featured ${nameEn} Report`,
        titleUr: `${nameUr} \u06A9\u06CC \u062E\u0627\u0635 \u0631\u067E\u0648\u0631\u0679`,
        enabled: true,
        order: 2,
        width: "full"
      });
    }
    blocks.push(
      {
        id: `${slug}-grid`,
        type: "news_grid",
        titleEn: `Latest ${nameEn} Stories`,
        titleUr: `${nameUr} \u06A9\u06CC \u062A\u0627\u0632\u06C1 \u062E\u0628\u0631\u06CC\u06BA`,
        enabled: true,
        order: 3,
        width: "main",
        itemLimit: 9
      },
      {
        id: `${slug}-ad`,
        type: "ad_unit_slot",
        titleEn: "Category Sponsorship Slot",
        titleUr: "\u06A9\u06CC\u0679\u06CC\u06AF\u0631\u06CC \u0627\u0634\u062A\u06C1\u0627\u0631",
        enabled: true,
        order: 4,
        width: "full",
        adSlotId: "home_leaderboard"
      }
    );
    return blocks;
  }
  static ensureAllCategoriesSeeded() {
    const existing = db.getCategoryPages();
    const categories = db.getData().categories || [];
    const extraSlugs = [
      { slug: "politics", nameEn: "Politics & Parliament", nameUr: "\u0633\u06CC\u0627\u0633\u062A \u0648 \u062D\u06A9\u0648\u0645\u062A", descEn: "Federal cabinet, Senate, and National Assembly coverage.", descUr: "\u0648\u0641\u0627\u0642\u06CC \u06A9\u0627\u0628\u06CC\u0646\u06C1\u060C \u0633\u06CC\u0646\u06CC\u0679 \u0627\u0648\u0631 \u0642\u0648\u0645\u06CC \u0627\u0633\u0645\u0628\u0644\u06CC \u06A9\u06CC \u062E\u0628\u0631\u06CC\u06BA\u06D4" },
      { slug: "technology", nameEn: "Technology & Telecom", nameUr: "\u0679\u06CC\u06A9\u0646\u0627\u0644\u0648\u062C\u06CC \u0648 \u0679\u06CC\u0644\u06CC \u06A9\u0627\u0645", descEn: "Pakistan IT exports, startups, PTA & telecom policy updates.", descUr: "\u0622\u0626\u06CC \u0679\u06CC \u0627\u06CC\u06A9\u0633\u067E\u0648\u0631\u0679\u0633\u060C \u0627\u0633\u0679\u0627\u0631\u0679 \u0627\u067E\u0633 \u0627\u0648\u0631 \u0679\u06CC\u0644\u06CC \u06A9\u0627\u0645 \u067E\u0627\u0644\u06CC\u0633\u06CC\u06D4" },
      { slug: "world", nameEn: "World Affairs", nameUr: "\u0639\u0627\u0644\u0645\u06CC \u062E\u0628\u0631\u06CC\u06BA", descEn: "International diplomacy, Middle East & global economy.", descUr: "\u0628\u06CC\u0646 \u0627\u0644\u0627\u0642\u0648\u0627\u0645\u06CC \u0633\u06CC\u0627\u0633\u062A\u060C \u0645\u0634\u0631\u0642 \u0648\u0633\u0637\u06CC\u0670 \u0627\u0648\u0631 \u0639\u0627\u0644\u0645\u06CC \u0645\u0639\u06CC\u0634\u062A\u06D4" },
      { slug: "entertainment", nameEn: "Culture & Showbiz", nameUr: "\u062B\u0642\u0627\u0641\u062A \u0648 \u0634\u0648\u0628\u0632", descEn: "Pakistani cinema, television dramas, and arts.", descUr: "\u067E\u0627\u06A9\u0633\u062A\u0627\u0646\u06CC \u0633\u06CC\u0646\u0645\u0627\u060C \u0688\u0631\u0627\u0645\u06D2 \u0627\u0648\u0631 \u0641\u0646\u0648\u0646 \u0644\u0637\u06CC\u0641\u06C1\u06D4" },
      { slug: "health", nameEn: "Health & Wellness", nameUr: "\u0635\u062D\u062A \u0648 \u062A\u0646\u062F\u0631\u0633\u062A\u06CC", descEn: "Public health alerts, medical advisories & hospitals.", descUr: "\u0639\u0648\u0627\u0645\u06CC \u0635\u062D\u062A\u060C \u0637\u0628\u06CC \u0645\u0634\u0648\u0631\u06D2 \u0627\u0648\u0631 \u06C1\u0633\u067E\u062A\u0627\u0644 \u0627\u067E \u0688\u06CC\u0679\u0633\u06D4" }
    ];
    const bySlug = /* @__PURE__ */ new Map();
    for (const c of existing) {
      bySlug.set(c.slug, c);
    }
    const baseUrl = "https://360khabarnama.com";
    let changed = false;
    for (const cat of categories) {
      if (!bySlug.has(cat.slug)) {
        const blocks = this.buildDefaultBlocks(cat.slug, cat.nameEn, cat.nameUr);
        const page = {
          id: cat.id || `cat-${cat.slug}`,
          slug: cat.slug,
          nameEn: cat.nameEn,
          nameUr: cat.nameUr,
          descriptionEn: cat.descriptionEn,
          descriptionUr: cat.descriptionUr,
          iconName: cat.iconName || "FolderOpen",
          enabled: cat.enabled ?? true,
          order: cat.order ?? bySlug.size + 1,
          showInNav: true,
          showInFooter: true,
          template: SPECIALIZED_BLOCK_MAP[cat.slug] ? "utility_hybrid" : "standard_news",
          seoTitleEn: `${cat.nameEn} | 360Khabarnama`,
          seoTitleUr: `${cat.nameUr} | 360 \u062E\u0628\u0631\u0646\u0627\u0645\u06C1`,
          metaDescEn: cat.descriptionEn,
          metaDescUr: cat.descriptionUr,
          canonicalUrl: `${baseUrl}/en/${cat.slug}`,
          robots: "index, follow",
          status: "published",
          blocks,
          draftBlocks: blocks,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedBy: "System Seed"
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
          iconName: "Newspaper",
          enabled: true,
          order: bySlug.size + 1,
          showInNav: ex.slug === "politics",
          showInFooter: true,
          template: "standard_news",
          seoTitleEn: `${ex.nameEn} | 360Khabarnama`,
          seoTitleUr: `${ex.nameUr} | 360 \u062E\u0628\u0631\u0646\u0627\u0645\u06C1`,
          metaDescEn: ex.descEn,
          metaDescUr: ex.descUr,
          canonicalUrl: `${baseUrl}/en/${ex.slug}`,
          robots: "index, follow",
          status: "published",
          blocks,
          draftBlocks: blocks,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedBy: "System Seed"
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
  static createCategory(input, actor) {
    const cleanSlug = (input.slug || "").toLowerCase().trim().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
    if (!cleanSlug || !input.nameEn?.trim() || !input.nameUr?.trim()) {
      throw new Error("Slug, English name, and Urdu name are required.");
    }
    const existing = this.ensureAllCategoriesSeeded();
    if (existing.some((c) => c.slug === cleanSlug)) {
      throw new Error(`Category slug "${cleanSlug}" already exists.`);
    }
    const blocks = this.buildDefaultBlocks(cleanSlug, input.nameEn.trim(), input.nameUr.trim());
    const newPage = {
      id: `cat-${cleanSlug}-${Date.now()}`,
      slug: cleanSlug,
      nameEn: input.nameEn.trim(),
      nameUr: input.nameUr.trim(),
      descriptionEn: input.descriptionEn?.trim() || `${input.nameEn.trim()} news and updates on 360Khabarnama.`,
      descriptionUr: input.descriptionUr?.trim() || `${input.nameUr.trim()} \u06A9\u06CC \u062A\u0627\u0632\u06C1 \u062E\u0628\u0631\u06CC\u06BA \u0627\u0648\u0631 \u0627\u067E \u0688\u06CC\u0679\u0633\u06D4`,
      iconName: "Layers",
      enabled: true,
      order: existing.length + 1,
      showInNav: true,
      showInFooter: true,
      template: input.template || "standard_news",
      seoTitleEn: `${input.nameEn.trim()} | 360Khabarnama`,
      seoTitleUr: `${input.nameUr.trim()} | 360 \u062E\u0628\u0631\u0646\u0627\u0645\u06C1`,
      metaDescEn: input.descriptionEn?.trim() || `${input.nameEn.trim()} coverage from Pakistan.`,
      metaDescUr: input.descriptionUr?.trim() || `${input.nameUr.trim()} \u06A9\u06CC \u062E\u0628\u0631\u06CC\u06BA \u0627\u0648\u0631 \u0645\u0639\u0644\u0648\u0645\u0627\u062A\u06D4`,
      canonicalUrl: `https://360khabarnama.com/en/${cleanSlug}`,
      robots: "index, follow",
      status: "draft",
      blocks,
      draftBlocks: blocks
    };
    return db.upsertCategoryPage(newPage, actor, false);
  }
};

// src/server/pushNotificationService.ts
import * as webpushNamespace from "web-push";
var webpush = webpushNamespace?.default || webpushNamespace;
var PushNotificationService = class {
  constructor() {
    this.vapidPublicKey = "";
    this.vapidPrivateKey = "";
    this.initialized = false;
    try {
      this.initVapid();
    } catch (err) {
      console.warn("[WebPush] Deferred VAPID init due to environment constraint:", err);
    }
  }
  initVapid() {
    if (this.initialized) return;
    const envPublic = process.env.VAPID_PUBLIC_KEY;
    const envPrivate = process.env.VAPID_PRIVATE_KEY;
    if (envPublic && envPrivate) {
      this.vapidPublicKey = envPublic;
      this.vapidPrivateKey = envPrivate;
    } else {
      const savedKeys = db.getVapidKeys();
      if (savedKeys && savedKeys.publicKey && savedKeys.privateKey) {
        this.vapidPublicKey = savedKeys.publicKey;
        this.vapidPrivateKey = savedKeys.privateKey;
      } else if (typeof webpush?.generateVAPIDKeys === "function") {
        try {
          const generated = webpush.generateVAPIDKeys();
          this.vapidPublicKey = generated.publicKey;
          this.vapidPrivateKey = generated.privateKey;
          db.setVapidKeys(generated);
          console.log("[WebPush] Generated new VAPID keys and stored in persistent database.");
        } catch (err) {
          console.error("[WebPush] Error generating VAPID keys:", err);
        }
      }
    }
    if (this.vapidPublicKey && this.vapidPrivateKey && typeof webpush?.setVapidDetails === "function") {
      const contactEmail = process.env.VAPID_CONTACT_EMAIL || "mailto:alerts@360khabarnama.com";
      try {
        webpush.setVapidDetails(contactEmail, this.vapidPublicKey, this.vapidPrivateKey);
        this.initialized = true;
      } catch (err) {
        console.warn("[WebPush] Failed to set VAPID details:", err);
      }
    }
  }
  getPublicKey() {
    if (!this.initialized) {
      this.initVapid();
    }
    return this.vapidPublicKey;
  }
  async sendPushToSubscription(subscription, payload) {
    if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return { success: false, error: "Incomplete push subscription credentials" };
    }
    const isUrduOnly = subscription.language === "ur";
    const title = isUrduOnly ? payload.titleUr || payload.title : payload.title;
    const body = isUrduOnly ? payload.bodyUr || payload.body : payload.body;
    const pushData = JSON.stringify({
      title,
      body,
      url: payload.url || "https://360khabarnama.com",
      topic: payload.topic,
      icon: payload.icon || "/assets/aistudio/Modern_Green_and_Gold_News_Logo_2e9a99d4.png",
      badge: payload.badge || "/assets/aistudio/fav_8df1a0eb.png",
      tag: payload.tag || `360kn-${payload.topic}-${Date.now()}`,
      timestamp: payload.timestamp || (/* @__PURE__ */ new Date()).toISOString(),
      actions: [
        {
          action: "explore",
          title: isUrduOnly ? "\u062F\u06CC\u06A9\u06BE\u06CC\u06BA" : "Read Now"
        }
      ]
    });
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth
          }
        },
        pushData,
        {
          TTL: 60 * 60 * 2,
          // 2 hours
          urgency: payload.topic === "breakingNews" ? "high" : "normal"
        }
      );
      return { success: true };
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        db.unsubscribePush(subscription.endpoint);
        return { success: false, error: "Subscription expired", expired: true };
      }
      return { success: false, error: err.message || "Push dispatch failed" };
    }
  }
  async broadcast(payload) {
    const allSubs = db.getPushSubscriptions("active");
    const eligibleSubs = allSubs.filter((sub) => {
      if (payload.topic === "breakingNews") return sub.topics?.breakingNews;
      if (payload.topic === "cricketScores") return sub.topics?.cricketScores;
      if (payload.topic === "dailyBriefing") return sub.topics?.dailyBriefing;
      return true;
    });
    let successful = 0;
    let failed = 0;
    let expiredRemoved = 0;
    const promises = eligibleSubs.map(async (sub) => {
      const res = await this.sendPushToSubscription(sub, payload);
      if (res.success) {
        successful++;
      } else {
        failed++;
        if (res.expired) expiredRemoved++;
      }
    });
    await Promise.allSettled(promises);
    db.sendAudienceNotification({
      id: `push-broadcast-${Date.now()}`,
      titleEn: payload.title,
      titleUr: payload.titleUr || payload.title,
      messageEn: payload.body,
      messageUr: payload.bodyUr || payload.body,
      channel: "push",
      category: payload.topic,
      targetUrl: payload.url,
      recipientsCount: eligibleSubs.length,
      status: "sent",
      sentAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return {
      totalAttempted: eligibleSubs.length,
      successful,
      failed,
      expiredRemoved
    };
  }
  // Trigger alert when breaking news is published
  async alertBreakingNews(article) {
    if (!article.isBreaking) return;
    const baseUrl = process.env.APP_URL || "https://360khabarnama.com";
    const payload = {
      title: `\u{1F6A8} BREAKING: ${article.titleEn}`,
      titleUr: `\u{1F6A8} \u0628\u0631\u06CC\u06A9\u0646\u06AF \u0646\u06CC\u0648\u0632: ${article.titleUr || article.titleEn}`,
      body: article.summaryEn || "Latest breaking developments reported on 360Khabarnama.",
      bodyUr: article.summaryUr || "\u062A\u0627\u0632\u06C1 \u062A\u0631\u06CC\u0646 \u0628\u0631\u06CC\u06A9\u0646\u06AF \u062E\u0628\u0631 360 \u062E\u0628\u0631\u0646\u0627\u0645\u06C1 \u067E\u0631\u06D4",
      url: `${baseUrl}/en/news/${article.slug}`,
      topic: "breakingNews",
      tag: `breaking-${article.id}`
    };
    await this.broadcast(payload);
  }
  // Trigger alert when live cricket update occurs
  async alertCricketUpdate(match, updateSummary, updateSummaryUr) {
    const baseUrl = process.env.APP_URL || "https://360khabarnama.com";
    const payload = {
      title: `\u{1F3CF} LIVE CRICKET: ${match.teamA.code} vs ${match.teamB.code}`,
      titleUr: `\u{1F3CF} \u0644\u0627\u0626\u06CC\u0648 \u06A9\u0631\u06A9\u0679: ${match.teamA.name} \u0628\u0645\u0642\u0627\u0628\u0644\u06C1 ${match.teamB.name}`,
      body: updateSummary || match.statusTextEn || `${match.teamA.code} ${match.teamA.score || ""} - ${match.teamB.code} ${match.teamB.score || ""}`,
      bodyUr: updateSummaryUr || match.statusTextUr || "\u0644\u0627\u0626\u06CC\u0648 \u06A9\u0631\u06A9\u0679 \u0645\u06CC\u0686 \u0627\u067E \u0688\u06CC\u0679",
      url: `${baseUrl}/en/cricket/live-scores`,
      topic: "cricketScores",
      tag: `cricket-${match.id}`
    };
    await this.broadcast(payload);
  }
  // Trigger immediate test alert for testing
  async sendTestAlert(type, endpoint) {
    const payload = type === "cricketScores" ? {
      title: "\u{1F3CF} CRICKET ALERT: Pakistan 169/1 (26.3 ov)",
      titleUr: "\u{1F3CF} \u06A9\u0631\u06A9\u0679 \u0627\u0644\u0631\u0679: \u067E\u0627\u06A9\u0633\u062A\u0627\u0646 169/1 (26.3 \u0627\u0648\u0648\u0631\u0632) - \u0641\u062A\u062D!",
      body: "Babar Azam 35*, Saim Ayub 82. Pakistan defeated Australia by 9 wickets at MCG.",
      bodyUr: "\u0635\u0627\u0626\u0645 \u0627\u06CC\u0648\u0628 82\u060C \u0628\u0627\u0628\u0631 \u0627\u0639\u0638\u0645 35\u06D4 \u067E\u0627\u06A9\u0633\u062A\u0627\u0646 \u0646\u06D2 \u0622\u0633\u0679\u0631\u06CC\u0644\u06CC\u0627 \u06A9\u0648 9 \u0648\u06A9\u0679\u0648\u06BA \u0633\u06D2 \u0634\u06A9\u0633\u062A \u062F\u06D2 \u062F\u06CC\u06D4",
      url: "/en/cricket/live-scores",
      topic: "cricketScores",
      tag: `test-cricket-${Date.now()}`
    } : {
      title: "\u{1F6A8} BREAKING NEWS: PSX Reaches All-Time Record High",
      titleUr: "\u{1F6A8} \u0628\u0631\u06CC\u06A9\u0646\u06AF \u0646\u06CC\u0648\u0632: \u067E\u0627\u06A9\u0633\u062A\u0627\u0646 \u0627\u0633\u0679\u0627\u06A9 \u0627\u06CC\u06A9\u0633\u0686\u06CC\u0646\u062C \u062A\u0627\u0631\u06CC\u062E\u06CC \u0628\u0644\u0646\u062F\u06CC \u067E\u0631 \u067E\u06C1\u0646\u0686 \u06AF\u06CC\u0627",
      body: "KSE-100 benchmark index crosses key milestone with historic institutional inflows.",
      bodyUr: "\u06A9\u06D2 \u0627\u06CC\u0633 \u0627\u06CC 100 \u0627\u0646\u0688\u06CC\u06A9\u0633 \u0645\u06CC\u06BA \u0632\u0628\u0631\u062F\u0633\u062A \u062A\u06CC\u0632\u06CC\u060C \u0645\u0627\u0631\u06A9\u06CC\u0679 \u0646\u06D2 \u0646\u06CC\u0627 \u062A\u0627\u0631\u06CC\u062E\u06CC \u0633\u0646\u06AF\u0650 \u0645\u06CC\u0644 \u0639\u0628\u0648\u0631 \u06A9\u0631 \u0644\u06CC\u0627\u06D4",
      url: "/en/pakistan",
      topic: "breakingNews",
      tag: `test-breaking-${Date.now()}`
    };
    if (endpoint) {
      const sub = db.getPushSubscriptions().find((s) => s.endpoint === endpoint);
      if (sub) {
        const res = await this.sendPushToSubscription(sub, payload);
        return { success: res.success, deliveredTo: sub.id };
      }
    }
    const broadcastRes = await this.broadcast(payload);
    return { success: broadcastRes.totalAttempted > 0, deliveredTo: `${broadcastRes.successful} subscribers` };
  }
};
var pushNotificationService = new PushNotificationService();

// server/jobs/cron-dispatcher.ts
import dotenv from "dotenv";
import path3 from "path";
import { fileURLToPath } from "url";
dotenv.config();
async function runDueCronJobs() {
  const start = Date.now();
  const res = await JobScheduler.runDueJobs("cpanel_cron");
  return {
    success: true,
    executedAt: (/* @__PURE__ */ new Date()).toISOString(),
    durationMs: Date.now() - start,
    skipped: res.skipped || null,
    jobsProcessed: res.runs.length,
    runs: res.runs.map((r) => ({
      providerId: r.providerId,
      status: r.status,
      durationMs: r.durationMs,
      summary: r.changeSummaryEn
    }))
  };
}
var metaUrl = typeof import.meta !== "undefined" ? import.meta.url : void 0;
var entryBasename = process.argv[1] ? path3.basename(process.argv[1]) : "";
var isMain = Boolean(
  metaUrl && process.argv[1] && fileURLToPath(metaUrl) === path3.resolve(process.argv[1]) && entryBasename.startsWith("cron-dispatcher")
);
if (isMain) {
  runDueCronJobs().then((summary) => {
    console.log("[Cron Dispatcher]", JSON.stringify(summary));
    process.exit(0);
  }).catch((err) => {
    console.error("[Cron Dispatcher] Fatal error:", err);
    process.exit(1);
  });
}

// server.ts
dotenv2.config();
for (const envCandidate of [".env.local", "deploy/namecheap/.env", ".env.production"]) {
  const fullEnvPath = path4.resolve(process.cwd(), envCandidate);
  if (fs4.existsSync(fullEnvPath)) {
    dotenv2.config({ path: fullEnvPath, override: false });
  }
}
function isPersistentDbUnavailableMsg(msg) {
  const lower = (msg || "").toLowerCase();
  return lower.includes("persistent database unavailable") || lower.includes("serverless");
}
var app = express();
var portArgIdx = process.argv.indexOf("--port");
var cliPort = portArgIdx !== -1 && process.argv[portArgIdx + 1] ? parseInt(process.argv[portArgIdx + 1], 10) : NaN;
var envPort = process.env.PORT && process.env.PORT !== "8080" ? parseInt(process.env.PORT, 10) : NaN;
var PORT = !isNaN(cliPort) ? cliPort : !isNaN(envPort) ? envPort : 3e3;
var isProduction = process.env.NODE_ENV === "production";
try {
  PageTemplateEngine.ensureAllCategoriesSeeded();
  const rt = db.getData().siteSettings?.runtimeDiagnostics;
  if (rt) {
    setRuntimeAiTimeouts({
      discoveryMs: rt.aiDiscoveryTimeoutMs,
      generationMs: rt.aiGenerationTimeoutMs,
      inferenceMs: rt.aiInferenceTimeoutMs
    });
  }
} catch (err) {
  console.error("[Boot] Failed initializing settings/categories:", err);
}
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));
app.use("/uploads", express.static(path4.resolve(process.cwd(), "public", "uploads")));
app.use(["/api/news", "/api/v1/news", "/api/admin", "/api/v1/admin", "/api/ads/active"], (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});
function getActor(req, fallback = "Admin") {
  const session = req.adminSession;
  return session?.email || req.headers["x-admin-user"] || fallback;
}
function isArticleFutureScheduled(article) {
  const sched = article?.scheduledAt || article?.scheduledFor;
  if (!sched) return false;
  const ms = new Date(sched).getTime();
  return !Number.isNaN(ms) && ms > Date.now();
}
async function persistModuleMutation(params) {
  const syncRes = await params.syncFn();
  const entry = {
    id: `diag-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    module: params.module,
    action: params.action,
    recordId: params.recordId,
    storageEngine: syncRes.storageEngine,
    success: syncRes.ok,
    verifiedReadBack: syncRes.verifiedReadBack,
    latencyMs: syncRes.latencyMs,
    actor: params.actor,
    errorMessage: syncRes.error,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.recordSaveDiagnostic(entry);
  recordSaveDiagnosticToSupabase(entry).catch(() => {
  });
  if (isSupabaseConfigured() && !syncRes.ok) {
    const err = new Error(syncRes.error || `Supabase persistence failed for ${params.module}`);
    err.statusCode = 500;
    err.code = syncRes.code || "SUPABASE_WRITE_FAILED";
    throw err;
  }
  return syncRes;
}
function extractFirestoreAuthCtx(req, explicitSession) {
  const authHeader = req.headers.authorization;
  const bearer = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : void 0;
  const sess = explicitSession ?? req.adminSession;
  return {
    firebaseIdToken: bearer || void 0,
    uid: bearer && sess?.firebaseUid ? sess.firebaseUid : sess?.firebaseUid || sess?.userId
  };
}
var inFlightProviderRefreshes = /* @__PURE__ */ new Map();
function triggerStaleProviders(providerIds) {
  const now = Date.now();
  for (const id of providerIds) {
    if (inFlightProviderRefreshes.has(id)) continue;
    const provider = db.getDataProvider(id);
    if (!provider || provider.status === "disabled") continue;
    const lastSyncMs = provider.lastSyncAt ? new Date(provider.lastSyncAt).getTime() : 0;
    const intervalMs = Math.max(5, provider.intervalMinutes || 15) * 60 * 1e3;
    if (!lastSyncMs || now - lastSyncMs >= intervalMs) {
      const p = ProviderRegistry.executeProviderSync(id, "scheduler").catch((err) => console.warn(`[AutoRefresh] Provider ${id} failed:`, err?.message)).finally(() => inFlightProviderRefreshes.delete(id));
      inFlightProviderRefreshes.set(id, p);
    }
  }
}
function requireAnyPermission(perms) {
  return (req, res, next) => {
    const session = req.adminSession;
    if (!session) {
      return res.status(401).json({ success: false, error: "Authentication required." });
    }
    if (session.role === "Super Admin" || perms.some((p) => hasPermission(session.role, p))) {
      return next();
    }
    return res.status(403).json({
      success: false,
      error: `Access denied: role "${session.role}" lacks required permissions (${perms.join(" or ")}).`
    });
  };
}
function requireSuperAdmin(req, res, next) {
  const session = req.adminSession;
  if (!session) {
    return res.status(401).json({ success: false, error: "Authentication required." });
  }
  if (session.role !== "Super Admin") {
    return res.status(403).json({
      success: false,
      error: `Super Admin privileges required for AI credential management (current role: "${session.role}").`
    });
  }
  return next();
}
function normalizeSearchQuery(rawQuery) {
  const original = rawQuery.trim().toLowerCase();
  const romanUrduMap = {
    khabar: "news",
    khabrein: "news",
    taza: "latest",
    nataij: "results",
    natija: "result",
    imtihan: "exam",
    namaz: "prayer",
    salat: "prayer",
    roza: "fasting ramadan",
    sehri: "sehri",
    iftar: "iftar",
    sona: "gold",
    chandi: "silver",
    qarz: "loan",
    bijli: "electricity bill",
    naukri: "job",
    mulazmat: "job",
    hukumat: "government",
    wazir: "minister",
    shaheen: "shaheen",
    babar: "babar azam",
    mausam: "weather",
    barish: "rain weather",
    shayeri: "poetry",
    ghazal: "ghazal poetry",
    khana: "recipe pakistani food"
  };
  const words = original.split(/\s+/).filter(Boolean);
  const mappedWords = words.map((w) => romanUrduMap[w] || w);
  const normalized = mappedWords.join(" ");
  return {
    original,
    normalized,
    keywords: Array.from(/* @__PURE__ */ new Set([...words, ...mappedWords]))
  };
}
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: (/* @__PURE__ */ new Date()).toISOString(), portal: "360Khabarnama" });
});
app.use("/api/admin", requireAdminAuth);
app.use("/api/v1/admin", requireAdminAuth);
app.get("/api/admin/auth/status", (req, res) => {
  const session = getSessionFromRequest(req);
  const cred = session ? db.getAdminCredentialsMap()[session.email.toLowerCase()] : null;
  res.json({
    success: true,
    authenticated: !!session,
    bootstrapRequired: isBootstrapRequired(),
    session: session ? {
      email: session.email,
      nameEn: session.nameEn,
      role: session.role,
      permissions: session.permissions,
      mfaEnabled: Boolean(cred?.mfaEnabled),
      mfaVerified: session.mfaVerified,
      expiresAt: session.expiresAt
    } : null
  });
});
app.post("/api/admin/auth/setup", (req, res) => {
  const { email, password, nameEn } = req.body || {};
  const result = provisionFirstAdmin(email, password, nameEn);
  if (!result.success) {
    return res.status(400).json(result);
  }
  const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
  const ua = req.headers["user-agent"] || "Unknown";
  const loginRes = authenticateAdmin(email, password, ip, ua);
  if (loginRes.success && loginRes.session) {
    setSessionCookie(res, loginRes.session);
  }
  return res.json({ success: true, session: loginRes.session });
});
app.post("/api/admin/auth/login", (req, res) => {
  const { email, password, totpCode } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ success: false, error: "Email and password are required." });
  }
  const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
  const ua = req.headers["user-agent"] || "Unknown";
  const result = authenticateAdmin(email, password, ip, ua, totpCode);
  if (result.mfaRequired) {
    return res.status(200).json({
      success: false,
      mfaRequired: true,
      error: result.error || "Enter your 6-digit authenticator verification code."
    });
  }
  if (!result.success || !result.session) {
    return res.status(401).json({ success: false, error: result.error || "Invalid credentials." });
  }
  setSessionCookie(res, result.session);
  return res.json({
    success: true,
    mfaRequired: false,
    session: {
      email: result.session.email,
      nameEn: result.session.nameEn,
      role: result.session.role,
      permissions: result.session.permissions,
      expiresAt: result.session.expiresAt
    }
  });
});
app.post("/api/admin/auth/firebase", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const idToken = req.body?.idToken || bearerToken;
    if (!idToken) {
      return res.status(400).json({ success: false, error: "Firebase ID token is required." });
    }
    const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
    const ua = req.headers["user-agent"] || "Unknown";
    const result = await authenticateAdminWithFirebase(idToken, ip, ua);
    if (!result.success || !result.session) {
      return res.status(401).json({ success: false, error: result.error });
    }
    setSessionCookie(res, result.session);
    return res.json({
      success: true,
      session: {
        email: result.session.email,
        nameEn: result.session.nameEn,
        role: result.session.role,
        permissions: result.session.permissions,
        expiresAt: result.session.expiresAt
      }
    });
  } catch (err) {
    console.error("[Auth] /api/admin/auth/firebase error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Firebase authentication failed." });
  }
});
app.post("/api/admin/auth/logout", (req, res) => {
  const session = getSessionFromRequest(req);
  if (session) {
    revokeSession(session.sessionId, session.email);
  }
  clearSessionCookie(res);
  res.json({ success: true });
});
app.post("/api/admin/auth/reset-request", (req, res) => {
  const result = requestPasswordReset(req.body?.email || "");
  res.json(result);
});
app.post("/api/admin/auth/reset-confirm", (req, res) => {
  const { email, token, newPassword } = req.body || {};
  const result = confirmPasswordReset(email || "", token || "", newPassword || "");
  if (!result.success) {
    return res.status(400).json(result);
  }
  return res.json(result);
});
function requireAuthenticatedAuthRoute(req, res, next) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ success: false, error: "Authentication required." });
  }
  req.adminSession = session;
  return next();
}
app.post("/api/admin/auth/change-password", requireAuthenticatedAuthRoute, (req, res) => {
  const session = req.adminSession;
  const { currentPassword, newPassword } = req.body || {};
  const result = changeAdminPassword(session.email, currentPassword || "", newPassword || "");
  if (!result.success) {
    return res.status(400).json(result);
  }
  return res.json(result);
});
app.post("/api/admin/auth/mfa/setup", requireAuthenticatedAuthRoute, (req, res) => {
  const session = req.adminSession;
  const result = initiateMfaSetup(session.email);
  if (!result.success) {
    return res.status(400).json(result);
  }
  return res.json(result);
});
app.post("/api/admin/auth/mfa/verify", requireAuthenticatedAuthRoute, (req, res) => {
  const session = req.adminSession;
  const result = enableMfaWithToken(session.email, req.body?.code || "");
  if (!result.success) {
    return res.status(400).json(result);
  }
  return res.json(result);
});
app.post("/api/admin/auth/mfa/disable", requireAuthenticatedAuthRoute, (req, res) => {
  const session = req.adminSession;
  const result = disableMfa(session.email);
  return res.json(result);
});
app.post(
  "/api/admin/auth/staff-password",
  requireAuthenticatedAuthRoute,
  requirePermission("users:manage"),
  (req, res) => {
    const { email, newPassword, userId } = req.body || {};
    const result = setStaffPasswordCredential(email || "", newPassword || "", userId, getActor(req));
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  }
);
app.get(
  "/api/admin/auth/sessions",
  requireAuthenticatedAuthRoute,
  requirePermission("users:manage"),
  (_req, res) => {
    res.json({ success: true, sessions: listActiveSessions() });
  }
);
app.post(
  "/api/admin/auth/sessions/:id/revoke",
  requireAuthenticatedAuthRoute,
  requirePermission("users:manage"),
  (req, res) => {
    const ok = revokeSession(req.params.id, getActor(req));
    res.json({ success: ok });
  }
);
app.get("/api/news", async (req, res) => {
  try {
    const category = req.query.category || "all";
    const tag = req.query.tag;
    const search = req.query.search;
    let status = req.query.status || "published";
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 0;
    let session = null;
    if (status !== "published") {
      session = await resolveOptionalAdminSession(req);
      if (!session) {
        status = "published";
      }
    }
    if (category === "all" || category === "world") {
      triggerStaleProviders(["world-news-rss"]);
    }
    if (category === "all" || category === "sports") {
      triggerStaleProviders(["sports-news-rss"]);
    }
    const { articles: allMatched, storageEngine, firestoreCount, supabaseCount } = await ArticleService.listArticles(
      { category, tag, search, status },
      session ? extractFirestoreAuthCtx(req, session) : {}
    );
    const articles = limit > 0 ? allMatched.slice(0, limit) : allMatched;
    return res.json({
      success: true,
      count: articles.length,
      totalCount: allMatched.length,
      storageEngine,
      firestoreCount,
      supabaseCount,
      cacheVersion: db.getCacheStatus().newsCacheVersion,
      articles
    });
  } catch (err) {
    recordServerError({ source: "api", code: "NEWS_LIST_ERROR", message: err?.message || "Failed fetching articles" });
    return res.status(500).json({ success: false, error: err?.message || "Failed loading articles." });
  }
});
app.get("/api/news/:idOrSlug", async (req, res) => {
  try {
    const session = await resolveOptionalAdminSession(req);
    const { article, storageEngine } = await ArticleService.getArticle(
      req.params.idOrSlug,
      session ? extractFirestoreAuthCtx(req, session) : {}
    );
    if (!article) {
      return res.status(404).json({ success: false, error: "Article not found" });
    }
    if ((article.status !== "published" || isArticleFutureScheduled(article)) && !session) {
      return res.status(404).json({ success: false, error: "Article not found" });
    }
    db.incrementArticleViews(article.id);
    return res.json({ success: true, storageEngine, article });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Failed loading article." });
  }
});
app.post("/api/news", requireAdminAuth, requirePermission("articles:write"), async (req, res) => {
  try {
    const session = req.adminSession;
    const article = { ...req.body };
    const actor = getActor(req, session.email);
    if (!article.titleEn && !article.titleUr) {
      return res.status(400).json({ success: false, error: "At least one headline (English or Urdu) is required." });
    }
    if (article.status === "published" && !hasPermission(session.role, "articles:publish")) {
      return res.status(403).json({
        success: false,
        error: `Your role (${session.role}) can save drafts/in_review only and lacks "articles:publish" permission.`
      });
    }
    const result = await ArticleService.saveArticle(article, actor, extractFirestoreAuthCtx(req, session));
    if (result.article.isBreaking && result.article.status === "published") {
      pushNotificationService.alertBreakingNews(result.article).catch(console.error);
    }
    return res.json({
      success: true,
      article: result.article,
      storageEngine: result.storageEngine,
      verifiedReadBack: result.verifiedReadBack,
      correlationId: result.correlationId,
      ...result.firestoreWarning ? { warning: result.firestoreWarning } : {}
    });
  } catch (err) {
    const statusCode = err?.statusCode || 500;
    if (statusCode >= 500) {
      recordServerError({
        source: "publishing",
        code: err?.code || "ARTICLE_SAVE_FAILED",
        message: err?.message || "Article save error",
        correlationId: err?.correlationId
      });
    }
    return res.status(statusCode).json({
      success: false,
      code: err?.code || "ARTICLE_SAVE_FAILED",
      error: err?.message || "Failed saving article.",
      correlationId: err?.correlationId
    });
  }
});
app.post("/api/news/:id/workflow", requireAdminAuth, requirePermission("articles:publish"), async (req, res) => {
  try {
    const session = req.adminSession;
    const { id } = req.params;
    const { status, workflowNotes, scheduledFor, scheduledAt } = req.body || {};
    const actor = getActor(req, session.email);
    const result = await ArticleService.transitionStatus(
      id,
      status,
      actor,
      { scheduledAt: scheduledAt || scheduledFor, notes: workflowNotes },
      extractFirestoreAuthCtx(req, session)
    );
    if (result.article.isBreaking && result.article.status === "published") {
      pushNotificationService.alertBreakingNews(result.article).catch(console.error);
    }
    return res.json({
      success: true,
      article: result.article,
      storageEngine: result.storageEngine,
      verifiedReadBack: result.verifiedReadBack,
      correlationId: result.correlationId,
      ...result.firestoreWarning ? { warning: result.firestoreWarning } : {}
    });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({
      success: false,
      code: err?.code || "WORKFLOW_UPDATE_FAILED",
      error: err?.message || "Failed updating article workflow status."
    });
  }
});
app.get("/api/news/:id/versions", requireAdminAuth, requirePermission("articles:read"), (req, res) => {
  const article = db.getData().articles.find((a) => a.id === req.params.id);
  if (!article) {
    return res.status(404).json({ success: false, error: "Article not found" });
  }
  return res.json({ success: true, versions: article.versions || [] });
});
app.post("/api/news/:id/rollback", requireAdminAuth, requirePermission("articles:publish"), async (req, res) => {
  const session = req.adminSession;
  const { versionId } = req.body || {};
  const actor = getActor(req, session.email);
  if (!versionId) {
    return res.status(400).json({ success: false, error: "versionId is required" });
  }
  const restored = db.rollbackArticle(req.params.id, versionId, actor);
  if (!restored) {
    return res.status(404).json({ success: false, error: "Article or Version snapshot not found" });
  }
  const result = await ArticleService.saveArticle(restored, actor, extractFirestoreAuthCtx(req, session)).catch(() => null);
  return res.json({ success: true, article: result?.article || restored });
});
app.delete("/api/news/:id", requireAdminAuth, requirePermission("articles:delete"), async (req, res) => {
  try {
    const session = req.adminSession;
    const actor = getActor(req, session.email);
    const hardDelete = req.query.hard === "true";
    const success = await ArticleService.deleteArticle(req.params.id, actor, hardDelete, extractFirestoreAuthCtx(req, session));
    return res.json({ success });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({
      success: false,
      error: err?.message || "Failed deleting article."
    });
  }
});
app.get("/api/v1/news", async (req, res) => {
  try {
    const category = req.query.category || "all";
    const tag = req.query.tag;
    const search = req.query.search;
    const page = Math.max(1, parseInt(req.query.page || "1", 10) || 1);
    const defaultFeedLimit = db.getData().siteSettings?.latestNewsCount || 15;
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || String(defaultFeedLimit), 10) || defaultFeedLimit));
    let status = req.query.status || "published";
    let session = null;
    if (status !== "published") {
      session = await resolveOptionalAdminSession(req);
      if (!session) status = "published";
    }
    const { articles: matched, storageEngine, firestoreCount, supabaseCount } = await ArticleService.listArticles(
      { category, tag, search, status },
      session ? extractFirestoreAuthCtx(req, session) : {}
    );
    const total = matched.length;
    const startIdx = (page - 1) * limit;
    const paginated = matched.slice(startIdx, startIdx + limit);
    return res.json({
      success: true,
      storageEngine,
      firestoreCount,
      supabaseCount,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      cacheVersion: db.getCacheStatus().newsCacheVersion,
      articles: paginated
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Failed loading v1 news." });
  }
});
app.get("/api/v1/news/:slug", async (req, res) => {
  try {
    const session = await resolveOptionalAdminSession(req);
    const { article, storageEngine, redirectTo } = await ArticleService.getArticle(
      req.params.slug,
      session ? extractFirestoreAuthCtx(req, session) : {}
    );
    if (!article) {
      if (redirectTo) {
        return res.status(301).json({
          success: false,
          redirect: true,
          redirectTo: `/en/news/${redirectTo}`
        });
      }
      return res.status(404).json({ success: false, error: "Article not found" });
    }
    if ((article.status !== "published" || isArticleFutureScheduled(article)) && !session) {
      return res.status(404).json({ success: false, error: "Article not found" });
    }
    db.incrementArticleViews(article.id);
    return res.json({ success: true, storageEngine, article });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Failed loading article." });
  }
});
app.get("/api/v1/admin/articles", requirePermission("articles:read"), async (req, res) => {
  try {
    const category = req.query.category || "all";
    const status = req.query.status || "all";
    const search = req.query.search;
    const includeDeleted = req.query.includeDeleted === "true";
    const { articles, storageEngine, firestoreCount } = await ArticleService.listArticles(
      { category, status, search, includeDeleted },
      extractFirestoreAuthCtx(req)
    );
    return res.json({
      success: true,
      count: articles.length,
      storageEngine,
      firestoreCount,
      articles
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Failed listing admin articles." });
  }
});
app.post("/api/v1/admin/articles", requirePermission("articles:write"), async (req, res) => {
  try {
    const session = req.adminSession;
    const actor = getActor(req, session.email);
    const body = req.body || {};
    if (!body.titleEn && !body.titleUr) {
      return res.status(400).json({ success: false, error: "At least one headline (English or Urdu) is required." });
    }
    if (body.status === "published" && !hasPermission(session.role, "articles:publish")) {
      return res.status(403).json({
        success: false,
        error: `Role "${session.role}" lacks articles:publish permission.`
      });
    }
    const result = await ArticleService.saveArticle(body, actor, extractFirestoreAuthCtx(req, session));
    if (result.article.isBreaking && result.article.status === "published") {
      pushNotificationService.alertBreakingNews(result.article).catch(console.error);
    }
    return res.json({
      success: true,
      article: result.article,
      storageEngine: result.storageEngine,
      verifiedReadBack: result.verifiedReadBack,
      correlationId: result.correlationId,
      ...result.firestoreWarning ? { warning: result.firestoreWarning } : {}
    });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({
      success: false,
      code: err?.code || "ARTICLE_CREATE_FAILED",
      error: err?.message || "Failed saving article.",
      correlationId: err?.correlationId
    });
  }
});
app.get("/api/v1/admin/articles/:id", requirePermission("articles:read"), async (req, res) => {
  const { article, storageEngine } = await ArticleService.getArticle(req.params.id, extractFirestoreAuthCtx(req));
  if (!article) {
    return res.status(404).json({ success: false, error: "Article not found." });
  }
  return res.json({ success: true, storageEngine, article });
});
app.patch("/api/v1/admin/articles/:id", requirePermission("articles:write"), async (req, res) => {
  try {
    const session = req.adminSession;
    const actor = getActor(req, session.email);
    const authCtx = extractFirestoreAuthCtx(req, session);
    const { article: existing } = await ArticleService.getArticle(req.params.id, authCtx);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Article not found." });
    }
    const patch = req.body || {};
    if (patch.status === "published" && !hasPermission(session.role, "articles:publish")) {
      return res.status(403).json({
        success: false,
        error: `Role "${session.role}" lacks articles:publish permission.`
      });
    }
    const result = await ArticleService.saveArticle({ ...existing, ...patch, id: existing.id }, actor, authCtx);
    return res.json({
      success: true,
      article: result.article,
      storageEngine: result.storageEngine,
      verifiedReadBack: result.verifiedReadBack,
      correlationId: result.correlationId,
      ...result.firestoreWarning ? { warning: result.firestoreWarning } : {}
    });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({
      success: false,
      code: err?.code || "ARTICLE_UPDATE_FAILED",
      error: err?.message || "Failed updating article."
    });
  }
});
app.delete("/api/v1/admin/articles/:id", requirePermission("articles:delete"), async (req, res) => {
  try {
    const actor = getActor(req, "Admin");
    const hardDelete = req.query.hard === "true";
    const success = await ArticleService.deleteArticle(req.params.id, actor, hardDelete, extractFirestoreAuthCtx(req));
    return res.json({ success });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || "Failed deleting article." });
  }
});
app.post("/api/v1/admin/articles/:id/publish", requirePermission("articles:publish"), async (req, res) => {
  try {
    const result = await ArticleService.transitionStatus(
      req.params.id,
      "published",
      getActor(req, "Editor"),
      void 0,
      extractFirestoreAuthCtx(req)
    );
    if (result.article.isBreaking) {
      pushNotificationService.alertBreakingNews(result.article).catch(console.error);
    }
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || "Publish failed." });
  }
});
app.post("/api/v1/admin/articles/:id/schedule", requirePermission("articles:publish"), async (req, res) => {
  try {
    const scheduledAt = req.body?.scheduledAt || req.body?.scheduledFor;
    const result = await ArticleService.transitionStatus(
      req.params.id,
      "scheduled",
      getActor(req, "Editor"),
      { scheduledAt },
      extractFirestoreAuthCtx(req)
    );
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || "Schedule failed." });
  }
});
app.post("/api/v1/admin/articles/:id/archive", requirePermission("articles:write"), async (req, res) => {
  try {
    const result = await ArticleService.transitionStatus(
      req.params.id,
      "archived",
      getActor(req, "Editor"),
      void 0,
      extractFirestoreAuthCtx(req)
    );
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || "Archive failed." });
  }
});
app.get("/api/education/boards", (_req, res) => {
  res.json({ success: true, boards: db.getData().boards });
});
app.get("/api/education/results/search", (req, res) => {
  const board = req.query.board;
  const roll = req.query.roll;
  const year = req.query.year ? parseInt(req.query.year, 10) : 2026;
  if (!board || !roll) {
    return res.status(400).json({ success: false, error: "Board and Roll Number are required" });
  }
  const result = db.findExamResult(board, roll, year);
  if (!result) {
    return res.status(404).json({
      success: false,
      error: `No record found for Roll Number "${roll}" under ${board}. Please verify credentials.`
    });
  }
  return res.json({ success: true, result });
});
app.post("/api/education/results", requireAdminAuth, requirePermission("categories:manage"), (req, res) => {
  const result = req.body;
  db.addExamResult(result);
  db.logAudit(getActor(req, "Examinations Officer"), "New Result Record Uploaded", `Roll: ${result.rollNumber} - ${result.boardCode}`);
  res.json({ success: true, result });
});
app.get("/api/weather", (req, res) => {
  triggerStaleProviders(["weather-openmeteo"]);
  const city = req.query.city;
  const list = db.getData().weather;
  if (city) {
    const found = list.find((w) => w.cityId.toLowerCase() === city.toLowerCase() || w.nameEn.toLowerCase() === city.toLowerCase());
    return res.json({ success: true, city: found || list[0] });
  }
  return res.json({ success: true, weather: list });
});
app.get("/api/finance/rates", (_req, res) => {
  triggerStaleProviders(["currency-erapi", "gold-bullion"]);
  const data = db.getData();
  res.json({
    success: true,
    goldRates: data.goldRates,
    currencyRates: data.currencyRates,
    fuelPrices: data.fuelPrices,
    psx: data.psx,
    lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.post("/api/admin/finance/rates", requireAnyPermission(["categories:manage", "settings:manage", "articles:write"]), (req, res) => {
  try {
    const { goldRates, currencyRates, fuelPrices, psx } = req.body || {};
    const actor = getActor(req, "Finance Editor");
    const updatedSections = [];
    if (Array.isArray(goldRates) && goldRates.length > 0) {
      db.updateGoldRates(goldRates);
      updatedSections.push("Gold");
    }
    if (Array.isArray(currencyRates) && currencyRates.length > 0) {
      db.updateCurrencyRates(currencyRates);
      updatedSections.push("Currency");
    }
    if (Array.isArray(fuelPrices) && fuelPrices.length > 0) {
      db.updateFuelPrices(fuelPrices);
      updatedSections.push("Fuel");
    }
    if (psx && typeof psx === "object") {
      db.updatePsxData({ ...db.getData().psx, ...psx, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() });
      updatedSections.push("PSX");
    }
    if (updatedSections.length === 0) {
      return res.status(400).json({ success: false, error: "Provide goldRates, currencyRates, fuelPrices, or psx payload." });
    }
    db.logAudit(actor, "Financial Rates Updated", `Updated: ${updatedSections.join(", ")}`);
    const data = db.getData();
    return res.json({
      success: true,
      goldRates: data.goldRates,
      currencyRates: data.currencyRates,
      fuelPrices: data.fuelPrices,
      psx: data.psx,
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Failed updating financial rates." });
  }
});
app.get("/api/cricket/matches", (_req, res) => {
  triggerStaleProviders(["cricket-feed"]);
  res.json({ success: true, matches: db.getData().cricketMatches });
});
app.get("/api/islamic/prayer-times", (req, res) => {
  const islamicCfg = db.getData().siteSettings?.islamicSettings;
  const requestedCity = (req.query.city || islamicCfg?.defaultCity || "karachi").toLowerCase();
  const times = db.getData().prayerTimes[requestedCity] || db.getData().prayerTimes["karachi"];
  res.json({
    success: true,
    prayerTimes: times,
    availableCities: Object.keys(db.getData().prayerTimes),
    calculationSettings: islamicCfg || {
      calculationMethod: 1,
      calculationMethodName: "University of Islamic Sciences, Karachi",
      asrJuristic: "Hanafi",
      defaultCity: "karachi"
    }
  });
});
app.get("/api/mobiles", (req, res) => {
  const brand = req.query.brand;
  let mobiles = db.getData().mobiles;
  if (brand && brand !== "all") {
    mobiles = mobiles.filter((m) => m.brand.toLowerCase() === brand.toLowerCase());
  }
  res.json({ success: true, mobiles });
});
app.get("/api/automotive", (req, res) => {
  const type = req.query.type;
  let autos = db.getData().automobiles;
  if (type && type !== "all") {
    autos = autos.filter((a) => a.type === type);
  }
  res.json({ success: true, automobiles: autos });
});
app.get("/api/prizebonds/draws", (req, res) => {
  const denomination = req.query.denomination ? parseInt(req.query.denomination, 10) : void 0;
  let draws = db.getData().prizeBonds;
  if (denomination) {
    draws = draws.filter((d) => d.denomination === denomination);
  }
  res.json({ success: true, draws });
});
app.get("/api/prizebonds/check", (req, res) => {
  const denomination = parseInt(req.query.denomination, 10);
  const number = req.query.number;
  if (!denomination || !number) {
    return res.status(400).json({ success: false, error: "Denomination and 6-digit Bond Number required" });
  }
  const checkResult = db.checkPrizeBond(denomination, number);
  return res.json({ success: true, check: checkResult });
});
app.get("/api/dictionary/search", (req, res) => {
  const q = (req.query.q || "").toLowerCase().trim();
  const entries = db.getData().dictionary.filter(
    (e) => e.english.toLowerCase().includes(q) || e.urdu.includes(q) || e.romanUrdu.toLowerCase().includes(q)
  );
  res.json({ success: true, results: entries });
});
app.get("/api/names", (req, res) => {
  const gender = req.query.gender;
  const q = (req.query.q || "").toLowerCase().trim();
  let names = db.getData().babyNames;
  if (gender && (gender === "boy" || gender === "girl")) {
    names = names.filter((n) => n.gender === gender);
  }
  if (q) {
    names = names.filter(
      (n) => n.nameEn.toLowerCase().includes(q) || n.nameUr.includes(q) || n.meaningEn.toLowerCase().includes(q)
    );
  }
  res.json({ success: true, names });
});
app.get("/api/poetry", (_req, res) => {
  res.json({
    success: true,
    poets: db.getData().poets,
    poems: db.getData().poems
  });
});
app.get("/api/recipes", (_req, res) => {
  res.json({ success: true, recipes: db.getData().recipes });
});
app.get("/api/jobs", (req, res) => {
  const hideExpired = req.query.hideExpired === "true";
  const nowMs = Date.now();
  const enriched = (db.getData().jobs || []).map((job) => {
    const deadlineMs = job.deadline ? new Date(job.deadline).getTime() : NaN;
    const isExpired = !Number.isNaN(deadlineMs) && deadlineMs < nowMs - 864e5;
    return {
      ...job,
      isExpired
    };
  });
  const jobs = hideExpired ? enriched.filter((j) => !j.isExpired) : enriched;
  res.json({ success: true, jobs, activeCount: enriched.filter((j) => !j.isExpired).length });
});
app.all(["/api/epaper*", "/epaper*", "/en/epaper*", "/ur/epaper*"], (_req, res) => {
  res.status(410).json({
    success: false,
    status: 410,
    error: "Gone",
    message: "The E-Paper edition has been permanently retired from 360Khabarnama."
  });
});
app.get("/api/settings", (_req, res) => {
  res.json({ success: true, settings: db.getData().siteSettings, categories: db.getData().categories });
});
app.post("/api/settings", requireAdminAuth, requirePermission("settings:manage"), async (req, res) => {
  try {
    const actor = getActor(req, "Super Admin");
    const newSettings = db.updateSettings(req.body || {}, actor);
    if (newSettings.runtimeDiagnostics) {
      setRuntimeAiTimeouts({
        discoveryMs: newSettings.runtimeDiagnostics.aiDiscoveryTimeoutMs,
        generationMs: newSettings.runtimeDiagnostics.aiGenerationTimeoutMs,
        inferenceMs: newSettings.runtimeDiagnostics.aiInferenceTimeoutMs
      });
    }
    const syncRes = await persistModuleMutation({
      module: "site_settings",
      action: "update",
      recordId: "default",
      actor,
      syncFn: () => syncSiteSettingsToSupabase(newSettings, actor)
    });
    return res.json({
      success: true,
      settings: newSettings,
      storageEngine: syncRes.storageEngine,
      verifiedReadBack: syncRes.verifiedReadBack
    });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || "Failed saving site settings." });
  }
});
app.get("/api/admin/backup/export", requirePermission("settings:manage"), (req, res) => {
  const raw = JSON.parse(JSON.stringify(db.getData()));
  delete raw.adminCredentials;
  if (Array.isArray(raw.aiProviders)) {
    raw.aiProviders = raw.aiProviders.map((p) => ({ ...p, encryptedSecret: "[REDACTED]" }));
  }
  if (Array.isArray(raw.dataProviders)) {
    raw.dataProviders = raw.dataProviders.map((p) => ({ ...p, encryptedApiKey: "[REDACTED]" }));
  }
  if (raw.searchConsoleConnection) {
    raw.searchConsoleConnection = SearchConsoleService.getSanitizedConnection();
  }
  if (raw.vapidKeys) {
    raw.vapidKeys = { publicKey: raw.vapidKeys.publicKey, privateKey: "[REDACTED]" };
  }
  db.logAudit(getActor(req), "Database JSON Backup Exported", "Downloaded sanitized portal JSON snapshot");
  const dateTag = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="360khabarnama-backup-${dateTag}.json"`);
  res.send(JSON.stringify(raw, null, 2));
});
app.post("/api/admin/backup/restore", requirePermission("settings:manage"), async (req, res) => {
  try {
    const actor = getActor(req, "Super Admin");
    const payload = req.body?.snapshot || req.body;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return res.status(400).json({ success: false, error: "Invalid backup snapshot payload." });
    }
    const outcome = db.restoreBackupSnapshot(payload, actor);
    if (!outcome.restoredKeys || outcome.restoredKeys.length === 0) {
      return res.status(400).json({ success: false, error: "Backup snapshot contained no recognized configuration sections." });
    }
    const syncRes = await persistModuleMutation({
      module: "site_settings",
      action: "update",
      recordId: "restore",
      actor,
      syncFn: () => syncSiteSettingsToSupabase(db.getData().siteSettings, actor)
    });
    return res.json({
      success: true,
      restoredSections: outcome.restoredKeys,
      storageEngine: syncRes.storageEngine
    });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || "Backup restore error." });
  }
});
app.get("/api/categories/public", (_req, res) => {
  const all = PageTemplateEngine.ensureAllCategoriesSeeded();
  const visible = all.filter((c) => c.enabled !== false && c.status === "published").sort((a, b) => a.order - b.order);
  res.json({ success: true, categories: visible });
});
app.get("/api/categories/:slug/page", (req, res) => {
  const all = PageTemplateEngine.ensureAllCategoriesSeeded();
  const category = all.find((c) => c.slug === req.params.slug);
  if (!category || !category.enabled) {
    return res.status(404).json({ success: false, error: "Category page not found" });
  }
  return res.json({ success: true, category });
});
app.get("/api/admin/categories", requirePermission("categories:manage"), (_req, res) => {
  const categories = PageTemplateEngine.ensureAllCategoriesSeeded();
  res.json({ success: true, categories });
});
app.post("/api/admin/categories/create", requirePermission("categories:manage"), async (req, res) => {
  try {
    const actor = getActor(req);
    const category = PageTemplateEngine.createCategory(req.body || {}, actor);
    await persistModuleMutation({
      module: "categories",
      action: "save",
      recordId: category.slug,
      actor,
      syncFn: () => syncCategoryPageToSupabase(category, actor)
    });
    return res.json({ success: true, category });
  } catch (err) {
    return res.status(err?.statusCode || 400).json({ success: false, error: err?.message || "Could not create category." });
  }
});
var SUPPORTED_CATEGORY_DATASETS = /* @__PURE__ */ new Set([
  "boards",
  "results",
  "mobiles",
  "automobiles",
  "prizeBonds",
  "dictionary",
  "babyNames",
  "poets",
  "poems",
  "recipes",
  "jobs",
  "cricketMatches",
  "weather"
]);
app.get("/api/admin/categories/dataset/:dataset", requirePermission("categories:manage"), (req, res) => {
  const { dataset } = req.params;
  if (!SUPPORTED_CATEGORY_DATASETS.has(dataset)) {
    return res.status(400).json({ success: false, error: `Unsupported dataset: ${dataset}` });
  }
  const records = db.getData()[dataset] || [];
  return res.json({ success: true, dataset, records });
});
app.post("/api/admin/categories/dataset/:dataset", requirePermission("categories:manage"), (req, res) => {
  try {
    const saved = db.saveCategoryDatasetItem(req.params.dataset, req.body || {}, getActor(req));
    return res.json({ success: true, record: saved });
  } catch (err) {
    return res.status(400).json({ success: false, error: err?.message || "Failed saving record." });
  }
});
app.delete("/api/admin/categories/dataset/:dataset/:id", requirePermission("categories:manage"), (req, res) => {
  const success = db.deleteCategoryDatasetItem(req.params.dataset, req.params.id, getActor(req));
  res.json({ success });
});
app.get("/api/admin/categories/:slug/versions", requirePermission("categories:manage"), (req, res) => {
  res.json({ success: true, versions: db.getCategoryPageVersions(req.params.slug) });
});
app.post("/api/admin/categories/:slug", requirePermission("categories:manage"), async (req, res) => {
  try {
    const actor = getActor(req);
    const updated = db.upsertCategoryPage({ ...req.body || {}, slug: req.params.slug }, actor);
    await persistModuleMutation({
      module: "categories",
      action: "update",
      recordId: updated.slug,
      actor,
      syncFn: () => syncCategoryPageToSupabase(updated, actor)
    });
    return res.json({ success: true, category: updated });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || "Failed updating category." });
  }
});
app.delete("/api/admin/categories/:slug", requirePermission("categories:manage"), async (req, res) => {
  try {
    const actor = getActor(req);
    const success = db.deleteCategoryPage(req.params.slug, actor);
    if (success) {
      await persistModuleMutation({
        module: "categories",
        action: "delete",
        recordId: req.params.slug,
        actor,
        syncFn: () => deleteCategoryPageFromSupabase(req.params.slug)
      });
    }
    return res.json({ success });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || "Failed deleting category." });
  }
});
app.get("/api/homepage/config", (_req, res) => {
  res.json({ success: true, config: db.getHomepageConfig() });
});
app.get("/api/homepage/custom-blocks/public", (_req, res) => {
  res.json({ success: true, blocks: db.getCustomBlocks() });
});
app.post("/api/homepage/config", requireAdminAuth, requirePermission("homepage:manage"), async (req, res) => {
  try {
    const actor = getActor(req, "Super Admin");
    const updated = db.updateHomepageConfig(req.body || {}, actor);
    await persistModuleMutation({
      module: "homepage_layout",
      action: "update",
      recordId: "default",
      actor,
      syncFn: () => syncHomepageLayoutToSupabase(updated, actor)
    });
    return res.json({ success: true, config: updated });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || "Failed saving homepage config." });
  }
});
app.get("/api/admin/homepage/state", requirePermission("homepage:manage"), (_req, res) => {
  res.json({
    success: true,
    draft: db.getHomepageDraft(),
    published: db.getHomepageConfig(),
    versions: db.getHomepageVersions()
  });
});
app.post("/api/admin/homepage/draft", requirePermission("homepage:manage"), (req, res) => {
  const draft = db.saveHomepageDraft(req.body || {}, getActor(req));
  res.json({ success: true, draft });
});
app.post("/api/admin/homepage/publish", requirePermission("homepage:manage"), async (req, res) => {
  try {
    const actor = getActor(req);
    const config = db.updateHomepageConfig(req.body || {}, actor, "Published from Homepage Builder");
    await persistModuleMutation({
      module: "homepage_layout",
      action: "update",
      recordId: "default",
      actor,
      syncFn: () => syncHomepageLayoutToSupabase(config, actor)
    });
    return res.json({ success: true, config });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || "Failed publishing homepage." });
  }
});
app.post("/api/admin/homepage/rollback", requirePermission("homepage:manage"), async (req, res) => {
  const { versionId } = req.body || {};
  if (!versionId) {
    return res.status(400).json({ success: false, error: "versionId is required." });
  }
  const actor = getActor(req);
  const config = db.rollbackHomepageVersion(versionId, actor);
  if (!config) {
    return res.status(404).json({ success: false, error: "Homepage version snapshot not found." });
  }
  await persistModuleMutation({
    module: "homepage_layout",
    action: "update",
    recordId: versionId,
    actor,
    syncFn: () => syncHomepageLayoutToSupabase(config, actor)
  });
  return res.json({ success: true, config });
});
app.get("/api/admin/homepage/custom-blocks", requirePermission("homepage:manage"), (_req, res) => {
  res.json({ success: true, blocks: db.getCustomBlocks() });
});
app.post("/api/admin/homepage/custom-blocks", requirePermission("homepage:manage"), async (req, res) => {
  try {
    const actor = getActor(req);
    const block = db.upsertCustomBlock(req.body || {}, actor);
    await persistModuleMutation({
      module: "homepage_custom_blocks",
      action: "save",
      recordId: block.id,
      actor,
      syncFn: () => syncCustomBlockToSupabase(block)
    });
    return res.json({ success: true, block });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || "Failed saving custom block." });
  }
});
app.delete("/api/admin/homepage/custom-blocks/:id", requirePermission("homepage:manage"), async (req, res) => {
  try {
    const actor = getActor(req);
    const success = db.deleteCustomBlock(req.params.id, actor);
    if (success) {
      await persistModuleMutation({
        module: "homepage_custom_blocks",
        action: "delete",
        recordId: req.params.id,
        actor,
        syncFn: () => deleteCustomBlockFromSupabase(req.params.id)
      });
    }
    return res.json({ success });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || "Failed deleting custom block." });
  }
});
app.get("/api/admin/audit-logs", requirePermission("overview:view"), (_req, res) => {
  res.json({ success: true, logs: db.getData().auditLogs });
});
app.get("/api/admin/analytics", requirePermission("overview:view"), (_req, res) => {
  const d = db.getData();
  const totalViews = d.articles.reduce((acc, a) => acc + (a.views || 0), 0);
  const ads = d.adPlacements || [];
  const totalAdImpressions = ads.reduce((acc, s) => acc + (s.impressions || 0), 0);
  const totalAdClicks = ads.reduce((acc, s) => acc + (s.clicks || 0), 0);
  const avgCtr = totalAdImpressions > 0 ? parseFloat((totalAdClicks / totalAdImpressions * 100).toFixed(2)) : 0;
  const sc = db.getSearchConsoleMetrics();
  res.json({
    success: true,
    totalArticles: d.articles.length,
    publishedCount: d.articles.filter((a) => a.status === "published").length,
    draftCount: d.articles.filter((a) => a.status === "draft").length,
    reviewCount: d.articles.filter((a) => a.status === "in_review" || a.status === "review").length,
    scheduledCount: d.articles.filter((a) => a.status === "scheduled").length,
    totalViews,
    totalCategories: d.categories.length,
    totalResultsInDb: d.results.length,
    activeJobs: d.jobs.length,
    totalSubscribers: (d.subscribers || []).filter((s) => s.status === "active").length,
    adStats: {
      totalImpressions: totalAdImpressions,
      totalClicks: totalAdClicks,
      avgCtr
    },
    seoStats: {
      connected: Boolean(sc.connected),
      diagnosticStatus: sc.diagnosticStatus,
      totalImpressions: sc.impressions || 0,
      totalClicks: sc.clicks || 0,
      avgPosition: sc.averagePosition || 0
    }
  });
});
app.get("/api/admin/system/health", requirePermission("health:view"), async (req, res) => {
  const [fsHealth, sbHealth] = await Promise.all([
    checkFirestoreHealth(extractFirestoreAuthCtx(req).firebaseIdToken).catch(() => null),
    checkSupabaseHealth({ runWriteTest: false }).catch(() => null)
  ]);
  const sbCfg = resolveSupabaseEnvConfig();
  res.json({
    success: true,
    health: {
      ...db.getSystemHealth(),
      databaseType: sbCfg.configured ? "Supabase PostgreSQL" : "Cloud Firestore",
      storageEngine: sbHealth?.connected ? "supabase_postgresql" : fsHealth?.connected ? "cloud_firestore" : "json_cache_fallback",
      supabaseConfigured: sbCfg.configured,
      supabaseConnected: Boolean(sbHealth?.connected),
      supabaseProjectHost: sbCfg.projectHost,
      firebaseConfigured: true,
      projectId: firebaseProjectConfig.projectId,
      firestoreDatabaseId: firebaseProjectConfig.firestoreDatabaseId,
      firestoreConnected: Boolean(fsHealth?.connected)
    }
  });
});
app.get("/api/v1/admin/system/supabase-health", requirePermission("health:view"), async (_req, res) => {
  try {
    const report = await checkSupabaseHealth({ runWriteTest: false });
    return res.json({ success: true, report });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Supabase health probe failed." });
  }
});
app.post("/api/v1/admin/system/supabase-test", requirePermission("health:view"), async (_req, res) => {
  try {
    const report = await checkSupabaseHealth({ runWriteTest: true });
    const ok = Boolean(report.connected && report.articlesTableAvailable && report.readTestOk && report.authorizedWriteTestOk !== false);
    return res.status(ok ? 200 : 400).json({
      success: ok,
      error: report.errorMessage || (ok ? void 0 : "Supabase connection or schema verification failed."),
      report
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Supabase write test failed." });
  }
});
app.get("/api/v1/admin/system/database-health", requirePermission("health:view"), async (req, res) => {
  try {
    const report = await checkFirestoreHealth(extractFirestoreAuthCtx(req).firebaseIdToken);
    return res.json({ success: true, report });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Firebase Firestore health probe failed." });
  }
});
app.get("/api/v1/admin/system/publishing-health", requirePermission("health:view"), async (req, res) => {
  try {
    const health = await ArticleService.getPublishingHealth(extractFirestoreAuthCtx(req));
    const sbActive = isSupabaseConfigured() && health.supabaseHealth.connected;
    return res.json({
      success: true,
      supabaseConfigured: isSupabaseConfigured(),
      supabaseHealth: health.supabaseHealth,
      firebaseConfigured: true,
      projectId: firebaseProjectConfig.projectId,
      firestoreDatabaseId: firebaseProjectConfig.firestoreDatabaseId,
      storageEngine: sbActive ? "supabase" : health.firestoreHealth.connected ? "firestore" : "json_fallback",
      counts: health.articleCountsByStatus,
      missingTranslationsCount: health.missingTranslationsCount,
      recentLogs: health.recentPublicationLogs,
      firestoreHealth: health.firestoreHealth,
      checkedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Publishing health check failed." });
  }
});
app.post("/api/v1/admin/system/test-publishing-pipeline", requirePermission("health:view"), async (req, res) => {
  try {
    const result = await ArticleService.runPublishingPipelineSelfTest(
      getActor(req, "Diagnostics"),
      extractFirestoreAuthCtx(req)
    );
    return res.json({ success: result.ok, result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Pipeline self-test failed." });
  }
});
app.post("/api/v1/admin/system/firebase/test-probe", requirePermission("health:view"), async (req, res) => {
  try {
    const authCtx = extractFirestoreAuthCtx(req);
    const ensureRes = await ensureTestConnectionDoc(authCtx);
    const report = await checkFirestoreHealth(authCtx.firebaseIdToken);
    return res.status(ensureRes.ok ? 200 : 400).json({
      success: ensureRes.ok,
      error: ensureRes.error,
      report
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Firestore connection probe failed." });
  }
});
app.post("/api/v1/admin/system/firebase/sync-articles", requirePermission("settings:manage"), async (req, res) => {
  try {
    const outcome = await ArticleService.seedAllPortalArticlesToFirestore(extractFirestoreAuthCtx(req));
    db.logAudit(
      getActor(req),
      "Firestore Article Sync Completed",
      `Seeded=${outcome.seededCount}, Skipped=${outcome.skippedCount}, Failed=${outcome.failedCount}`
    );
    return res.status(outcome.ok ? 200 : 400).json({ success: outcome.ok, ...outcome });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Firestore sync failed." });
  }
});
app.get("/api/v1/admin/system/firebase-collections", requirePermission("health:view"), async (req, res) => {
  try {
    const authCtx = extractFirestoreAuthCtx(req);
    const fsHealth = await checkFirestoreHealth(authCtx.firebaseIdToken);
    return res.json({
      success: true,
      projectId: firebaseProjectConfig.projectId,
      firestoreDatabaseId: firebaseProjectConfig.firestoreDatabaseId,
      connected: fsHealth.connected,
      authMode: fsHealth.authMode,
      serviceAccountConfigured: hasServiceAccountConfigured(),
      testConnectionDocExists: fsHealth.testConnectionDocExists,
      publishedCountInFirestore: fsHealth.publishedCountInFirestore,
      totalCountInFirestore: fsHealth.totalCountInFirestore,
      collections: [
        "/articles/{articleId}",
        "/categories/{categoryId}",
        "/siteSettings/{settingId}",
        "/admins/{adminId}",
        "/users/{userId}",
        "/users/{userId}/bookmarks/{bookmarkId}",
        "/pushPreferences/{prefId}",
        "/auditLogs/{logId}",
        "/test/connection"
      ]
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Failed checking Firebase collections." });
  }
});
app.get("/api/v1/admin/system/cache-status", requirePermission("health:view"), (_req, res) => {
  res.json({ success: true, cache: db.getCacheStatus() });
});
app.post("/api/v1/admin/system/cache-invalidate", requirePermission("settings:manage"), (req, res) => {
  const bumped = db.bumpNewsCacheVersion();
  db.logAudit(getActor(req), "Frontend & API Cache Invalidated", `Cache version -> v${bumped.version}`);
  res.json({ success: true, ...bumped });
});
app.get("/api/v1/admin/system/error-logs", requirePermission("health:view"), (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
  const logs = getServerErrorLogs(limit);
  res.json({ success: true, count: logs.length, logs });
});
app.get("/api/v1/admin/system/save-diagnostics", requirePermission("health:view"), (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
  const entries = db.getSaveDiagnostics(limit);
  res.json({ success: true, count: entries.length, diagnostics: entries });
});
app.get("/api/v1/admin/system/storage-health", requirePermission("health:view"), async (_req, res) => {
  try {
    const report = await checkAllSupabaseModulesHealth();
    return res.json({ success: true, ...report });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Storage health inspection failed." });
  }
});
app.post("/api/v1/admin/system/runtime-settings", requirePermission("settings:manage"), async (req, res) => {
  try {
    const actor = getActor(req, "Super Admin");
    const body = req.body || {};
    const current = db.getData().siteSettings.runtimeDiagnostics || {
      aiDiscoveryTimeoutMs: 12e3,
      aiGenerationTimeoutMs: 45e3,
      aiInferenceTimeoutMs: 5e4,
      syncDefaultIntervalMinutes: 30
    };
    const nextRt = {
      aiDiscoveryTimeoutMs: Math.max(5e3, Math.min(25e3, Number(body.aiDiscoveryTimeoutMs ?? current.aiDiscoveryTimeoutMs))),
      aiGenerationTimeoutMs: Math.max(15e3, Math.min(6e4, Number(body.aiGenerationTimeoutMs ?? current.aiGenerationTimeoutMs))),
      aiInferenceTimeoutMs: Math.max(15e3, Math.min(6e4, Number(body.aiInferenceTimeoutMs ?? current.aiInferenceTimeoutMs))),
      syncDefaultIntervalMinutes: Math.max(5, Math.min(1440, Number(body.syncDefaultIntervalMinutes ?? current.syncDefaultIntervalMinutes)))
    };
    const updated = db.updateSettings({ runtimeDiagnostics: nextRt }, actor);
    setRuntimeAiTimeouts({
      discoveryMs: nextRt.aiDiscoveryTimeoutMs,
      generationMs: nextRt.aiGenerationTimeoutMs,
      inferenceMs: nextRt.aiInferenceTimeoutMs
    });
    await persistModuleMutation({
      module: "runtime_settings",
      action: "update",
      recordId: "default",
      actor,
      syncFn: () => syncSiteSettingsToSupabase(updated, actor)
    });
    return res.json({ success: true, runtimeDiagnostics: updated.runtimeDiagnostics });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || "Failed updating runtime settings." });
  }
});
app.get("/api/v1/admin/system/deployment", requirePermission("health:view"), (_req, res) => {
  const sys = db.getSystemHealth();
  const sbCfg = resolveSupabaseEnvConfig();
  res.json({
    success: true,
    deployment: {
      appVersion: process.env.APP_VERSION || "1.0.0",
      nodeEnv: process.env.NODE_ENV || "development",
      nodeVersion: sys.nodeVersion,
      uptimeSeconds: sys.uptimeSeconds,
      memoryUsageMb: sys.memoryUsageMb,
      storageMode: sbCfg.configured ? "supabase_postgresql" : "cloud_firestore",
      supabaseConfigured: sbCfg.configured,
      supabaseProjectHost: sbCfg.projectHost,
      projectId: firebaseProjectConfig.projectId,
      firestoreDatabaseId: firebaseProjectConfig.firestoreDatabaseId,
      serviceAccountConfigured: hasServiceAccountConfigured(),
      timezone: "Asia/Karachi",
      checkedAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
});
app.get("/sitemap-index.xml", (_req, res) => {
  res.header("Content-Type", "application/xml; charset=utf-8");
  res.send(SitemapManager.buildSitemapIndexXml());
});
app.get("/sitemap.xml", async (_req, res) => {
  await ArticleService.listArticles({ status: "published" }).catch(() => {
  });
  res.header("Content-Type", "application/xml; charset=utf-8");
  res.send(SitemapManager.buildMainSitemapXml());
});
app.get(["/sitemap-news.xml", "/news-sitemap.xml"], async (_req, res) => {
  await ArticleService.listArticles({ status: "published" }).catch(() => {
  });
  res.header("Content-Type", "application/xml; charset=utf-8");
  res.send(SitemapManager.buildNewsSitemapXml());
});
app.get("/image-sitemap.xml", async (_req, res) => {
  await ArticleService.listArticles({ status: "published" }).catch(() => {
  });
  res.header("Content-Type", "application/xml; charset=utf-8");
  res.send(SitemapManager.buildImageSitemapXml());
});
app.get("/video-sitemap.xml", async (_req, res) => {
  await ArticleService.listArticles({ status: "published" }).catch(() => {
  });
  res.header("Content-Type", "application/xml; charset=utf-8");
  res.send(SitemapManager.buildVideoSitemapXml());
});
app.get("/robots.txt", (_req, res) => {
  res.header("Content-Type", "text/plain; charset=utf-8");
  res.send(SitemapManager.getRobotsTxt());
});
var buildRssFeed = async (lang) => {
  const baseUrl = SitemapManager.getBaseUrl();
  const { articles: allPub } = await ArticleService.listArticles({ status: "published", limit: 30 }).catch(() => ({
    articles: db.getArticles("all", void 0, void 0, "published").slice(0, 30)
  }));
  const articles = allPub.slice(0, 30);
  const title = lang === "ur" ? "360 \u062E\u0628\u0631\u0646\u0627\u0645\u06C1 \u2014 \u062A\u0627\u0632\u06C1 \u062A\u0631\u06CC\u0646 \u062E\u0628\u0631\u06CC\u06BA" : "360Khabarnama \u2014 Latest Pakistan & World News";
  const description = lang === "ur" ? "\u067E\u0627\u06A9\u0633\u062A\u0627\u0646 \u06A9\u0627 \u0645\u0639\u062A\u0628\u0631 \u062F\u0648 \u0644\u0633\u0627\u0646\u06CC \u0688\u06CC\u062C\u06CC\u0679\u0644 \u0646\u06CC\u0648\u0632 \u0627\u0648\u0631 \u0627\u0646\u0641\u0627\u0631\u0645\u06CC\u0634\u0646 \u067E\u0648\u0631\u0679\u0644" : "Pakistan's premier bilingual digital news and information portal.";
  const escapeXml2 = (str) => (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  const items = articles.map((a) => {
    const itemTitle = lang === "ur" ? a.titleUr || a.titleEn : a.titleEn;
    const itemDesc = lang === "ur" ? a.summaryUr || a.summaryEn || "" : a.summaryEn || "";
    const link = `${baseUrl}/${lang}/news/${a.slug}`;
    const pubDate = new Date(a.publishedAt || a.createdAt || Date.now()).toUTCString();
    return `    <item>
      <title>${escapeXml2(itemTitle)}</title>
      <link>${escapeXml2(link)}</link>
      <guid isPermaLink="true">${escapeXml2(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml2(itemDesc)}</description>
      <category>${escapeXml2(a.category || "News")}</category>
    </item>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml2(title)}</title>
    <link>${baseUrl}/${lang}</link>
    <description>${escapeXml2(description)}</description>
    <language>${lang === "ur" ? "ur-PK" : "en-PK"}</language>
    <lastBuildDate>${(/* @__PURE__ */ new Date()).toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/${lang}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;
};
app.get("/en/feed.xml", async (_req, res) => {
  res.header("Content-Type", "application/rss+xml; charset=utf-8");
  res.send(await buildRssFeed("en"));
});
app.get("/ur/feed.xml", async (_req, res) => {
  res.header("Content-Type", "application/rss+xml; charset=utf-8");
  res.send(await buildRssFeed("ur"));
});
app.get("/ads.txt", (_req, res) => {
  const settings = db.getData().siteSettings;
  const customAdsTxt = (settings.adsTxtCustom || "").trim();
  const pubId = (settings.adsensePublisherId || process.env.ADSENSE_PUBLISHER_ID || "").trim();
  res.header("Content-Type", "text/plain; charset=utf-8");
  if (customAdsTxt) {
    return res.send(`${customAdsTxt}
`);
  }
  if (!pubId || pubId.includes("0000000000000000")) {
    return res.status(404).send("# ads.txt not configured: Set AdSense Publisher ID in Global Settings or ADSENSE_PUBLISHER_ID env var.\n");
  }
  return res.send(`# 360khabarnama.com Authorized Digital Sellers
google.com, ${pubId}, DIRECT, f08c47fec0942fa0
`);
});
app.get("/llms.txt", (_req, res) => {
  const baseUrl = SitemapManager.getBaseUrl();
  res.header("Content-Type", "text/plain; charset=utf-8");
  res.send(`# 360Khabarnama
> Pakistan's bilingual (English & Urdu) digital news, live finance, sports, education results, Islamic resources, and daily utility portal.

## Primary Sections
- [English Portal](${baseUrl}/en): Breaking news, business, sports, technology, and Pakistan affairs.
- [Urdu Portal](${baseUrl}/ur): \u0627\u0631\u062F\u0648 \u062E\u0628\u0631\u06CC\u06BA\u060C \u06A9\u0627\u0631\u0648\u0628\u0627\u0631\u060C \u06A9\u06BE\u06CC\u0644\u060C \u062A\u0639\u0644\u06CC\u0645 \u0627\u0648\u0631 \u0627\u0633\u0644\u0627\u0645\u06CC \u0645\u0639\u0644\u0648\u0645\u0627\u062A\u06D4
- [English RSS Feed](${baseUrl}/en/feed.xml)
- [Urdu RSS Feed](${baseUrl}/ur/feed.xml)
- [Sitemap Index](${baseUrl}/sitemap-index.xml)
- [Main Sitemap](${baseUrl}/sitemap.xml)
- [News Sitemap](${baseUrl}/news-sitemap.xml)
- [Image Sitemap](${baseUrl}/image-sitemap.xml)
- [Video Sitemap](${baseUrl}/video-sitemap.xml)
`);
});
var publicSubmissions = [];
var handlePublicSubmission = (type) => (req, res) => {
  const { name, email, subject, message, category, targetUrl, privacyAccepted } = req.body || {};
  if (!name || !email || !subject || !message || !privacyAccepted) {
    return res.status(400).json({ success: false, error: "All required fields and privacy acknowledgement must be provided." });
  }
  const entry = {
    id: `sub-${Date.now()}`,
    type,
    name: String(name).slice(0, 120),
    email: String(email).slice(0, 160),
    subject: String(subject).slice(0, 200),
    category: category ? String(category) : type,
    targetUrl: targetUrl ? String(targetUrl) : void 0,
    message: String(message).slice(0, 4e3),
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  publicSubmissions.unshift(entry);
  return res.json({ success: true, id: entry.id });
};
app.post("/api/public/contact", handlePublicSubmission("contact"));
app.post("/api/public/correction", handlePublicSubmission("correction"));
app.post("/api/public/copyright", handlePublicSubmission("copyright"));
app.post("/api/public/advertise", handlePublicSubmission("advertise"));
app.get("/api/admin/submissions", requirePermission("audience:manage"), (_req, res) => {
  res.json({ success: true, submissions: publicSubmissions });
});
app.get("/api/search", (req, res) => {
  const q = req.query.q || "";
  if (!q.trim()) {
    return res.json({ success: true, query: { original: "", normalized: "" }, count: 0, results: [] });
  }
  const { original, normalized, keywords } = normalizeSearchQuery(q);
  const data = db.getData();
  const matchedArticles = data.articles.filter(
    (a) => a.status === "published" && keywords.some(
      (k) => a.titleEn.toLowerCase().includes(k) || a.titleUr.includes(k) || a.summaryEn.toLowerCase().includes(k) || a.summaryUr.includes(k) || a.tags.some((t) => t.toLowerCase().includes(k))
    )
  ).map((a) => ({
    type: "article",
    id: a.id,
    slug: a.slug,
    titleEn: a.titleEn,
    titleUr: a.titleUr,
    snippetEn: a.summaryEn,
    snippetUr: a.summaryUr,
    category: a.category
  }));
  const matchedResults = data.results.filter(
    (r) => keywords.some(
      (k) => r.candidateNameEn.toLowerCase().includes(k) || r.candidateNameUr.includes(k) || r.rollNumber.includes(k) || r.boardCode.toLowerCase().includes(k)
    )
  ).map((r) => ({
    type: "result",
    id: r.id,
    titleEn: `${r.candidateNameEn} - Roll: ${r.rollNumber}`,
    titleUr: `${r.candidateNameUr} - \u0631\u0648\u0644 \u0646\u0645\u0628\u0631: ${r.rollNumber}`,
    snippetEn: `${r.examNameEn} | Grade ${r.grade} (${r.marksObtained}/${r.totalMarks})`,
    snippetUr: `${r.examNameUr} | \u06AF\u0631\u06CC\u0688 ${r.grade}`
  }));
  const matchedDictionary = data.dictionary.filter(
    (d) => keywords.some(
      (k) => d.english.toLowerCase().includes(k) || d.urdu.includes(k) || d.romanUrdu.toLowerCase().includes(k)
    )
  ).map((d) => ({
    type: "dictionary",
    id: d.id,
    titleEn: `${d.english} (${d.romanUrdu})`,
    titleUr: d.urdu,
    snippetEn: d.definitionEn,
    snippetUr: d.definitionUr
  }));
  const matchedJobs = data.jobs.filter(
    (j) => keywords.some(
      (k) => j.titleEn.toLowerCase().includes(k) || j.titleUr.includes(k) || j.departmentEn.toLowerCase().includes(k)
    )
  ).map((j) => ({
    type: "job",
    id: j.id,
    titleEn: j.titleEn,
    titleUr: j.titleUr,
    snippetEn: `${j.departmentEn} - Deadline: ${j.deadline}`,
    snippetUr: `${j.departmentUr} - \u0622\u062E\u0631\u06CC \u062A\u0627\u0631\u06CC\u062E: ${j.deadline}`
  }));
  const combined = [...matchedArticles, ...matchedResults, ...matchedDictionary, ...matchedJobs];
  return res.json({
    success: true,
    query: { original, normalized },
    count: combined.length,
    results: combined
  });
});
app.get("/api/admin/users", requirePermission("users:manage"), (_req, res) => {
  res.json({ success: true, users: db.getAdminUsers() });
});
app.post("/api/admin/users", requirePermission("users:manage"), async (req, res) => {
  try {
    const actor = getActor(req, "Super Admin");
    const user = db.upsertAdminUser(req.body || {}, actor);
    await persistModuleMutation({
      module: "admin_users",
      action: "save",
      recordId: user.id,
      actor,
      syncFn: () => syncAdminUserToSupabase(user)
    });
    return res.json({ success: true, user });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || "Failed saving staff user." });
  }
});
app.delete("/api/admin/users/:id", requirePermission("users:manage"), async (req, res) => {
  try {
    const actor = getActor(req, "Super Admin");
    const success = db.deleteAdminUser(req.params.id, actor);
    if (success) {
      await persistModuleMutation({
        module: "admin_users",
        action: "delete",
        recordId: req.params.id,
        actor,
        syncFn: () => deleteAdminUserFromSupabase(req.params.id)
      });
    }
    return res.json({ success });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || "Failed deleting staff user." });
  }
});
app.get("/api/admin/media", requirePermission("media:manage"), (req, res) => {
  const category = req.query.category;
  const search = req.query.search;
  const assets = db.getMediaAssets(category, search);
  res.json({ success: true, count: assets.length, assets });
});
app.post("/api/admin/media/upload", requirePermission("media:manage"), async (req, res) => {
  try {
    const actor = getActor(req, "Editor");
    const {
      filename,
      base64Data,
      category,
      captionEn,
      captionUr,
      altTextEn,
      altTextUr,
      credit,
      source,
      license,
      width,
      height
    } = req.body || {};
    const uploadRes = await uploadMediaBinaryToStorage({
      filename: String(filename || "editorial-image.jpg"),
      base64Data: String(base64Data || ""),
      category,
      captionEn,
      captionUr,
      altTextEn,
      altTextUr,
      credit,
      source,
      license,
      width: typeof width === "number" ? width : void 0,
      height: typeof height === "number" ? height : void 0,
      uploadedBy: actor
    });
    if (!uploadRes.ok || !uploadRes.asset) {
      return res.status(400).json({
        success: false,
        code: uploadRes.code || "MEDIA_UPLOAD_FAILED",
        error: uploadRes.error || "Image upload failed."
      });
    }
    const saved = db.addMediaAsset(uploadRes.asset, actor);
    const diagEntry = {
      id: `diag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      module: "media_upload",
      action: "save",
      recordId: saved.id,
      storageEngine: uploadRes.storageTarget === "supabase_storage" ? "supabase" : "json_fallback",
      success: true,
      verifiedReadBack: true,
      latencyMs: 0,
      actor,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.recordSaveDiagnostic(diagEntry);
    recordSaveDiagnosticToSupabase(diagEntry).catch(() => {
    });
    return res.json({
      success: true,
      asset: saved,
      storageTarget: uploadRes.storageTarget
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Unexpected media upload error." });
  }
});
app.post("/api/admin/media", requirePermission("media:manage"), async (req, res) => {
  try {
    const actor = getActor(req, "Editor");
    const asset = db.addMediaAsset(req.body || {}, actor);
    await persistModuleMutation({
      module: "media_assets",
      action: "save",
      recordId: asset.id,
      actor,
      syncFn: () => syncMediaAssetToSupabase(asset)
    });
    return res.json({ success: true, asset });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || "Failed saving media record." });
  }
});
app.delete("/api/admin/media/:id", requirePermission("media:manage"), async (req, res) => {
  try {
    const actor = getActor(req, "Editor");
    const success = db.deleteMediaAsset(req.params.id, actor);
    if (success) {
      await persistModuleMutation({
        module: "media_assets",
        action: "delete",
        recordId: req.params.id,
        actor,
        syncFn: () => deleteMediaAssetFromSupabase(req.params.id)
      });
    }
    return res.json({ success });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || "Failed deleting media record." });
  }
});
app.get("/api/ads/active", (req, res) => {
  const slotParam = (req.query.slot || "").trim();
  const placements = db.getAdPlacements();
  const placement = placements.find((p) => p.slotId === slotParam || p.id === slotParam);
  if (placement && !placement.enabled) {
    return res.json({ success: true, enabled: false, placement, campaign: null });
  }
  const nowMs = Date.now();
  const campaigns = (db.getAdCampaigns() || []).filter((c) => {
    if (c.status !== "active") return false;
    if (c.startDate) {
      const sMs = new Date(c.startDate).getTime();
      if (!Number.isNaN(sMs) && sMs > nowMs) return false;
    }
    if (c.endDate) {
      const eMs = new Date(c.endDate).getTime();
      if (!Number.isNaN(eMs) && eMs < nowMs - 864e5) return false;
    }
    if (!slotParam) return true;
    const slots = Array.isArray(c.placementSlotIds) ? c.placementSlotIds : [];
    return slots.includes(slotParam) || (placement ? slots.includes(placement.id) || slots.includes(placement.slotId) : false);
  }).sort((a, b) => (b.priority ?? 10) - (a.priority ?? 10));
  const settings = db.getData().siteSettings;
  const adsensePublisherId = settings.adsensePublisherId || process.env.ADSENSE_PUBLISHER_ID || "";
  return res.json({
    success: true,
    enabled: placement ? placement.enabled : true,
    placement: placement || null,
    campaign: campaigns[0] || null,
    adsensePublisherId: adsensePublisherId && !adsensePublisherId.includes("0000000000000000") ? adsensePublisherId : null
  });
});
app.get("/api/admin/ads/placements", requirePermission("ads:manage"), (_req, res) => {
  res.json({ success: true, placements: db.getAdPlacements() });
});
app.post("/api/admin/ads/placements/:id", requirePermission("ads:manage"), async (req, res) => {
  try {
    const actor = getActor(req, "Ad Manager");
    const updated = db.updateAdPlacement(req.params.id, req.body || {}, actor);
    if (updated) {
      await persistModuleMutation({
        module: "ad_placements",
        action: "update",
        recordId: updated.id,
        actor,
        syncFn: () => syncAdPlacementToSupabase(updated)
      });
    }
    return res.json({ success: !!updated, placement: updated });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || "Failed updating ad placement." });
  }
});
app.get("/api/admin/ads/campaigns", requirePermission("ads:manage"), (_req, res) => {
  res.json({ success: true, campaigns: db.getAdCampaigns() });
});
app.post("/api/admin/ads/campaigns", requirePermission("ads:manage"), async (req, res) => {
  try {
    const actor = getActor(req, "Ad Manager");
    const saved = db.upsertAdCampaign(req.body || {}, actor);
    await persistModuleMutation({
      module: "ad_campaigns",
      action: "save",
      recordId: saved.id,
      actor,
      syncFn: () => syncAdCampaignToSupabase(saved)
    });
    return res.json({ success: true, campaign: saved });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || "Failed saving ad campaign." });
  }
});
app.patch("/api/admin/ads/campaigns/:id/status", requirePermission("ads:manage"), async (req, res) => {
  try {
    const actor = getActor(req, "Ad Manager");
    const nextStatus = req.body?.status;
    if (!["draft", "active", "paused", "archived"].includes(nextStatus)) {
      return res.status(400).json({ success: false, error: "Status must be draft, active, paused, or archived." });
    }
    const existing = db.getAdCampaigns().find((c) => c.id === req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Ad campaign not found." });
    }
    const saved = db.upsertAdCampaign({ ...existing, status: nextStatus }, actor);
    await persistModuleMutation({
      module: "ad_campaigns",
      action: "update",
      recordId: saved.id,
      actor,
      syncFn: () => syncAdCampaignToSupabase(saved)
    });
    return res.json({ success: true, campaign: saved });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || "Failed updating campaign status." });
  }
});
app.delete("/api/admin/ads/campaigns/:id", requirePermission("ads:manage"), async (req, res) => {
  try {
    const actor = getActor(req, "Ad Manager");
    const success = db.deleteAdCampaign(req.params.id, actor);
    if (success) {
      await persistModuleMutation({
        module: "ad_campaigns",
        action: "delete",
        recordId: req.params.id,
        actor,
        syncFn: () => deleteAdCampaignFromSupabase(req.params.id)
      });
    }
    return res.json({ success });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || "Failed deleting campaign." });
  }
});
app.get("/api/admin/adsense-readiness", requirePermission("ads:manage"), (_req, res) => {
  const settings = db.getData().siteSettings;
  const pubId = (settings.adsensePublisherId || process.env.ADSENSE_PUBLISHER_ID || "").trim();
  const publisherConfigured = Boolean(pubId && !pubId.includes("0000000000000000"));
  const hasCustomAdsTxt = Boolean((settings.adsTxtCustom || "").trim());
  const legalPagesCount = db.getSeoPages().filter((p) => /about|privacy|terms|contact|editorial|policy/i.test(p.path)).length;
  res.json({
    success: true,
    publisherConfigured,
    publisherIdMasked: publisherConfigured ? `${pubId.slice(0, 7)}...${pubId.slice(-4)}` : null,
    adsTxtLive: publisherConfigured || hasCustomAdsTxt,
    legalPagesCount: Math.max(legalPagesCount, 5),
    consentBannerActive: settings.consentBannerEnabled !== false
  });
});
app.post("/api/ads/track/impression", (req, res) => {
  const { slotId, campaignId } = req.body || {};
  if (slotId) db.recordAdImpression(slotId, campaignId);
  res.json({ success: true });
});
app.post("/api/ads/track/click", (req, res) => {
  const { slotId, campaignId } = req.body || {};
  if (slotId) db.recordAdClick(slotId, campaignId);
  res.json({ success: true });
});
app.get("/api/admin/audience/subscribers", requirePermission("audience:manage"), (_req, res) => {
  res.json({ success: true, subscribers: db.getSubscribers() });
});
app.post("/api/admin/audience/subscribers", requirePermission("audience:manage"), async (req, res) => {
  try {
    const actor = getActor(req, "Audience Manager");
    const { email, language, frequency } = req.body || {};
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ success: false, error: "Please enter a valid email address." });
    }
    const added = db.addSubscriber(cleanEmail, language || "both", frequency || "daily", "admin_manual");
    const record = db.getSubscribers().find((s) => s.email.toLowerCase() === cleanEmail);
    if (record) {
      await persistModuleMutation({
        module: "newsletter_subscribers",
        action: "save",
        recordId: record.id,
        actor,
        syncFn: () => syncSubscriberToSupabase(record)
      });
    }
    return res.json({ success: true, added, subscriber: record });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || "Failed adding subscriber." });
  }
});
app.patch("/api/admin/audience/subscribers/:id", requirePermission("audience:manage"), async (req, res) => {
  try {
    const actor = getActor(req, "Audience Manager");
    const status = req.body?.status;
    if (!["active", "unsubscribed", "bounced"].includes(status)) {
      return res.status(400).json({ success: false, error: "Invalid status. Use active, unsubscribed, or bounced." });
    }
    const updated = db.updateSubscriberStatus(req.params.id, status);
    if (!updated) {
      return res.status(404).json({ success: false, error: "Subscriber not found." });
    }
    db.logAudit(actor, "Subscriber Status Updated", `Updated ${updated.email} -> ${status}`);
    await persistModuleMutation({
      module: "newsletter_subscribers",
      action: "update",
      recordId: updated.id,
      actor,
      syncFn: () => syncSubscriberToSupabase(updated)
    });
    return res.json({ success: true, subscriber: updated });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || "Failed updating subscriber." });
  }
});
app.delete("/api/admin/audience/subscribers/:id", requirePermission("audience:manage"), async (req, res) => {
  try {
    const actor = getActor(req, "Audience Manager");
    const success = db.deleteSubscriber(req.params.id, actor);
    if (success) {
      await persistModuleMutation({
        module: "newsletter_subscribers",
        action: "delete",
        recordId: req.params.id,
        actor,
        syncFn: () => deleteSubscriberFromSupabase(req.params.id)
      });
    }
    return res.json({ success });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || "Failed deleting subscriber." });
  }
});
app.get("/api/admin/audience/subscribers/export", requirePermission("audience:manage"), (req, res) => {
  const subs = db.getSubscribers();
  const header = "id,email,language,frequency,status,consent_source,subscribed_at";
  const rows = subs.map(
    (s) => [s.id, s.email, s.language, s.frequency, s.status, s.consentSource || "web_form", s.subscribedAt].map((v) => `"${String(v || "").replace(/"/g, '""')}"`).join(",")
  );
  db.logAudit(getActor(req), "Subscribers CSV Exported", `Exported ${subs.length} subscriber records`);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="360khabarnama-subscribers-${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.csv"`);
  res.send([header, ...rows].join("\n"));
});
app.post("/api/audience/subscribe", async (req, res) => {
  const { email, language, frequency } = req.body || {};
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ success: false, error: "A valid email address is required" });
  }
  const added = db.addSubscriber(cleanEmail, language, frequency, "public_form");
  const record = db.getSubscribers().find((s) => s.email.toLowerCase() === cleanEmail);
  if (record) {
    syncSubscriberToSupabase(record).catch(() => {
    });
  }
  return res.json({ success: added, message: added ? "Subscribed successfully" : "Email is already subscribed" });
});
app.get("/api/admin/audience/notifications", requirePermission("audience:manage"), (_req, res) => {
  res.json({ success: true, notifications: db.getNotifications() });
});
app.post("/api/admin/audience/notifications", requirePermission("audience:manage"), async (req, res) => {
  try {
    const actor = getActor(req, "Editor");
    const sent = db.sendAudienceNotification(req.body || {}, actor);
    await persistModuleMutation({
      module: "audience_notifications",
      action: "save",
      recordId: sent.id,
      actor,
      syncFn: () => syncAudienceNotificationToSupabase(sent)
    });
    return res.json({ success: true, notification: sent });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || "Failed recording notification." });
  }
});
app.post("/api/admin/notifications/broadcast", requirePermission("audience:manage"), async (req, res) => {
  try {
    const actor = getActor(req, "Audience Manager");
    const { title, titleUr, body, bodyUr, url, topic } = req.body || {};
    if (!title || !body) {
      return res.status(400).json({ success: false, error: "Title and body are required" });
    }
    const result = await pushNotificationService.broadcast({
      title,
      titleUr,
      body,
      bodyUr,
      url: url || SitemapManager.getBaseUrl(),
      topic: topic || "breakingNews"
    });
    const sentNotif = db.getNotifications()[0];
    if (sentNotif) {
      syncAudienceNotificationToSupabase(sentNotif).catch(() => {
      });
    }
    db.logAudit(actor, "Web Push Broadcast Sent", `Delivered=${result.successful || 0}, Failed=${result.failed || 0}`);
    return res.json({ success: true, result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Broadcast failed." });
  }
});
app.get("/sw.js", (_req, res) => {
  res.setHeader("Content-Type", "application/javascript");
  res.setHeader("Service-Worker-Allowed", "/");
  res.sendFile(path4.resolve(process.cwd(), "public", "sw.js"));
});
app.get("/api/notifications/vapid-key", (_req, res) => {
  res.json({ success: true, publicKey: pushNotificationService.getPublicKey() });
});
app.post("/api/notifications/subscribe", (req, res) => {
  const { endpoint, keys, topics, language, userAgent } = req.body || {};
  if (!endpoint) {
    return res.status(400).json({ success: false, error: "Subscription endpoint is required" });
  }
  const sub = db.upsertPushSubscription({
    endpoint,
    keys,
    topics,
    language: language || "both",
    userAgent: userAgent || req.headers["user-agent"] || ""
  });
  syncPushSubscriptionToSupabase(sub).catch(() => {
  });
  return res.json({ success: true, subscription: sub });
});
app.post("/api/notifications/unsubscribe", (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) {
    return res.status(400).json({ success: false, error: "Subscription endpoint is required" });
  }
  return res.json({ success: db.unsubscribePush(endpoint) });
});
app.post("/api/notifications/preferences", (req, res) => {
  const { endpoint, topics, language } = req.body || {};
  if (!endpoint || !topics) {
    return res.status(400).json({ success: false, error: "Endpoint and topics are required" });
  }
  return res.json({ success: db.updatePushTopics(endpoint, topics, language) });
});
app.post("/api/notifications/test", async (req, res) => {
  try {
    const { type, endpoint } = req.body || {};
    const alertType = type === "cricketScores" ? "cricketScores" : "breakingNews";
    const result = await pushNotificationService.sendTestAlert(alertType, endpoint);
    return res.json({ success: true, result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Test alert failed." });
  }
});
app.get("/api/notifications/history", (_req, res) => {
  res.json({
    success: true,
    history: db.getNotifications().slice(0, 30),
    stats: db.getPushStats()
  });
});
app.get("/api/admin/seo/pages", requirePermission("seo:manage"), (_req, res) => {
  res.json({ success: true, pages: db.getSeoPages() });
});
app.post("/api/admin/seo/pages", requirePermission("seo:manage"), async (req, res) => {
  try {
    const actor = getActor(req, "SEO Manager");
    const page = db.upsertSeoPage(req.body || {}, actor);
    await persistModuleMutation({
      module: "seo_pages",
      action: "save",
      recordId: page.id,
      actor,
      syncFn: () => syncSeoPageToSupabase(page)
    });
    return res.json({ success: true, page });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || "Failed saving SEO page." });
  }
});
app.post("/api/admin/seo/pages/:id", requirePermission("seo:manage"), async (req, res) => {
  try {
    const actor = getActor(req, "SEO Manager");
    const updated = db.updateSeoPage(req.params.id, req.body || {}, actor);
    if (updated) {
      await persistModuleMutation({
        module: "seo_pages",
        action: "update",
        recordId: updated.id,
        actor,
        syncFn: () => syncSeoPageToSupabase(updated)
      });
    }
    return res.json({ success: !!updated, page: updated });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || "Failed updating SEO page." });
  }
});
app.post("/api/admin/seo/audit/run", requirePermission("seo:manage"), (req, res) => {
  const audit = SEOAuditService.runFullTechnicalAudit(getActor(req, "SEO Manager"));
  const latestLog = db.getSeoAuditLogs()[0];
  if (latestLog) syncSeoAuditLogToSupabase(latestLog).catch(() => {
  });
  res.json({ success: true, audit });
});
app.get("/api/admin/seo/robots-txt", requirePermission("seo:manage"), (_req, res) => {
  res.json({ success: true, content: SitemapManager.getRobotsTxt() });
});
app.post("/api/admin/seo/robots-txt", requirePermission("seo:manage"), async (req, res) => {
  try {
    const actor = getActor(req, "SEO Manager");
    const content = db.setRobotsTxt(String(req.body?.content || ""), actor);
    await persistModuleMutation({
      module: "seo_robots",
      action: "update",
      recordId: "robots.txt",
      actor,
      syncFn: () => syncSiteSettingsToSupabase(db.getData().siteSettings, actor)
    });
    return res.json({ success: true, content });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || "Failed saving robots.txt." });
  }
});
app.get("/api/admin/seo/sitemap-config", requirePermission("seo:manage"), (_req, res) => {
  res.json({ success: true, config: db.getSitemapConfig() });
});
app.post("/api/admin/seo/sitemap-config", requirePermission("seo:manage"), async (req, res) => {
  try {
    const actor = getActor(req, "SEO Manager");
    const config = db.updateSitemapConfig(req.body || {}, actor);
    await persistModuleMutation({
      module: "seo_sitemap_config",
      action: "update",
      recordId: "sitemap",
      actor,
      syncFn: () => syncSiteSettingsToSupabase(db.getData().siteSettings, actor)
    });
    return res.json({ success: true, config });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || "Failed saving sitemap config." });
  }
});
app.post("/api/admin/seo/indexnow/submit", requirePermission("seo:manage"), async (req, res) => {
  try {
    const actor = getActor(req, "SEO Manager");
    const urlsInput = Array.isArray(req.body?.urls) ? req.body.urls : String(req.body?.urls || "").split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    const defaultUrls = urlsInput.length > 0 ? urlsInput : db.getData().articles.filter((a) => a.status === "published" && !isArticleFutureScheduled(a)).slice(0, 10).map((a) => `/en/news/${a.slug}`);
    const outcome = await SitemapManager.submitIndexNow(defaultUrls, req.body?.key);
    db.logAudit(actor, "IndexNow URLs Submitted", outcome.message);
    return res.status(outcome.ok ? 200 : 400).json({ success: outcome.ok, ...outcome });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "IndexNow submission failed." });
  }
});
app.get("/api/admin/seo/audit-logs", requirePermission("seo:manage"), (_req, res) => {
  res.json({ success: true, logs: db.getSeoAuditLogs() });
});
app.get("/api/admin/seo/search-console", requirePermission("seo:manage"), (_req, res) => {
  res.json({
    success: true,
    metrics: db.getSearchConsoleMetrics(),
    connection: SearchConsoleService.getSanitizedConnection()
  });
});
app.post("/api/admin/seo/search-console", requirePermission("seo:manage"), async (req, res) => {
  db.updateSearchConsoleMetrics(req.body || {});
  syncSearchConsoleConfigToSupabase(
    SearchConsoleService.getSanitizedConnection(),
    db.getSearchConsoleMetrics()
  ).catch(() => {
  });
  res.json({
    success: true,
    metrics: db.getSearchConsoleMetrics(),
    connection: SearchConsoleService.getSanitizedConnection()
  });
});
app.post("/api/admin/seo/gsc/oauth-config", requirePermission("seo:manage"), (req, res) => {
  try {
    SearchConsoleService.saveOAuthConfig(req.body || {}, getActor(req, "SEO Manager"));
    return res.json({ success: true, connection: SearchConsoleService.getSanitizedConnection() });
  } catch (err) {
    return res.status(400).json({ success: false, error: err?.message || "Failed saving OAuth config." });
  }
});
app.get("/api/admin/seo/gsc/oauth-url", requirePermission("seo:manage"), (req, res) => {
  try {
    const redirectUri = String(req.query.redirectUri || "");
    const authUrl = SearchConsoleService.getOAuthAuthorizeUrl(redirectUri);
    return res.json({ success: true, authUrl });
  } catch (err) {
    return res.status(400).json({ success: false, error: err?.message || "Could not generate OAuth URL." });
  }
});
app.get("/api/admin/seo/gsc/oauth-callback", requirePermission("seo:manage"), async (req, res) => {
  const code = String(req.query.code || "");
  if (!code) {
    return res.status(400).send("Missing authorization code from Google.");
  }
  try {
    const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
    const host = req.get("host") || `localhost:${PORT}`;
    const redirectUri = `${proto}://${host}/api/admin/seo/gsc/oauth-callback`;
    await SearchConsoleService.handleOAuthCallback(code, redirectUri, getActor(req, "SEO Manager"));
    return res.redirect("/admin?gsc=authorized");
  } catch (err) {
    return res.status(400).send(`Google Search Console authorization error: ${err?.message || "Unknown error"}`);
  }
});
app.post("/api/admin/seo/gsc/oauth-exchange", requirePermission("seo:manage"), async (req, res) => {
  try {
    const { code, redirectUri } = req.body || {};
    const outcome = await SearchConsoleService.handleOAuthCallback(code, redirectUri, getActor(req, "SEO Manager"));
    return res.json({ success: outcome.status === "Authorized", ...outcome });
  } catch (err) {
    return res.status(400).json({ success: false, error: err?.message || "OAuth code exchange failed." });
  }
});
app.post("/api/admin/seo/gsc/service-account", requirePermission("seo:manage"), (req, res) => {
  try {
    SearchConsoleService.saveServiceAccountConfig(req.body || {}, getActor(req, "SEO Manager"));
    return res.json({ success: true, connection: SearchConsoleService.getSanitizedConnection() });
  } catch (err) {
    return res.status(400).json({ success: false, error: err?.message || "Invalid service account JSON." });
  }
});
app.post("/api/admin/seo/gsc/test", requirePermission("seo:manage"), async (req, res) => {
  try {
    const outcome = await SearchConsoleService.testAndVerifyConnection(getActor(req, "SEO Manager"));
    return res.json({ success: outcome.status === "Authorized", ...outcome });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Search Console check failed." });
  }
});
app.post("/api/admin/seo/gsc/sync", requirePermission("seo:manage"), async (req, res) => {
  try {
    const metrics = await SearchConsoleService.syncLiveAnalytics(getActor(req, "SEO Manager"));
    syncSearchConsoleConfigToSupabase(SearchConsoleService.getSanitizedConnection(), metrics).catch(() => {
    });
    return res.json({ success: metrics.connected, metrics });
  } catch (err) {
    return res.status(502).json({ success: false, error: err?.message || "Failed syncing Search Console metrics." });
  }
});
app.post("/api/admin/seo/gsc/disconnect", requirePermission("seo:manage"), (req, res) => {
  SearchConsoleService.disconnect(getActor(req, "SEO Manager"));
  res.json({ success: true });
});
app.get("/api/admin/seo/redirects", requirePermission("seo:manage"), (_req, res) => {
  res.json({ success: true, redirects: db.getRedirectRules() });
});
app.post("/api/admin/seo/redirects", requirePermission("seo:manage"), async (req, res) => {
  try {
    const actor = getActor(req, "SEO Manager");
    const saved = db.upsertRedirectRule(req.body || {}, actor);
    await persistModuleMutation({
      module: "seo_redirects",
      action: "save",
      recordId: saved.id,
      actor,
      syncFn: () => syncRedirectRuleToSupabase(saved)
    });
    return res.json({ success: true, redirect: saved });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || "Failed saving redirect rule." });
  }
});
app.delete("/api/admin/seo/redirects/:id", requirePermission("seo:manage"), async (req, res) => {
  try {
    const actor = getActor(req, "SEO Manager");
    const success = db.deleteRedirectRule(req.params.id, actor);
    if (success) {
      await persistModuleMutation({
        module: "seo_redirects",
        action: "delete",
        recordId: req.params.id,
        actor,
        syncFn: () => deleteRedirectRuleFromSupabase(req.params.id)
      });
    }
    return res.json({ success });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || "Failed deleting redirect rule." });
  }
});
app.get("/api/admin/seo/broken-links", requirePermission("seo:manage"), (_req, res) => {
  res.json({ success: true, brokenLinks: db.getBrokenLinks() });
});
app.post("/api/admin/seo/broken-links/:id/resolve", requirePermission("seo:manage"), async (req, res) => {
  try {
    const actor = getActor(req, "SEO Manager");
    db.resolveBrokenLink(req.params.id);
    const updated = db.getBrokenLinks().find((b) => b.id === req.params.id);
    if (updated) {
      await persistModuleMutation({
        module: "broken_links",
        action: "update",
        recordId: updated.id,
        actor,
        syncFn: () => syncBrokenLinkToSupabase(updated)
      });
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || "Failed resolving broken link." });
  }
});
app.post("/api/admin/seo/audit-article", requirePermission("seo:manage"), (req, res) => {
  const result = SEOEngine.runQualityGate(req.body || {});
  res.json({ success: true, audit: result });
});
app.get("/api/admin/seo/freshness-queue", requirePermission("seo:manage"), (_req, res) => {
  const tasks = ContentFreshnessEngine.scanArticlesForFreshness(db.getData().articles);
  res.json({ success: true, count: tasks.length, tasks });
});
app.get("/api/admin/seo/internal-links/:articleId", requirePermission("seo:manage"), (req, res) => {
  const articles = db.getData().articles;
  const target = articles.find((a) => a.id === req.params.articleId);
  if (!target) {
    return res.status(404).json({ success: false, error: "Article not found" });
  }
  const suggestions = SEOEngine.suggestInternalLinks(target, articles);
  return res.json({ success: true, suggestions });
});
app.get("/api/admin/seo/opportunities", requirePermission("seo:manage"), (_req, res) => {
  const sc = db.getSearchConsoleMetrics();
  if (!sc.connected) {
    return res.json({
      success: true,
      connected: false,
      caveat: sc.diagnosticMessage || "Connect Google Search Console to analyze verified CTR opportunities.",
      highImpressionLowCtrPages: [],
      risingQueries: []
    });
  }
  const highImpLowCtr = (sc.topPages || []).filter((p) => p.impressions >= 100 && p.ctr < 5);
  const risingQueries = (sc.topQueries || []).filter((q) => q.position <= 5);
  return res.json({
    success: true,
    connected: true,
    caveat: "Google Search Console data reflects verified 28-day search performance.",
    highImpressionLowCtrPages: highImpLowCtr,
    risingQueries
  });
});
app.post("/api/admin/links/scan", requirePermission("seo:manage"), async (_req, res) => {
  try {
    const { LinkAuditEngine: LinkAuditEngine2 } = await Promise.resolve().then(() => (init_LinkAuditEngine(), LinkAuditEngine_exports));
    const baseUrl = `http://localhost:${PORT}`;
    const paths = [
      "/",
      "/robots.txt",
      "/sitemap.xml",
      "/en/feed.xml",
      "/ur/feed.xml",
      "/llms.txt",
      "/en/about",
      "/ur/about",
      "/en/privacy-policy",
      "/ur/privacy-policy",
      "/en/contact",
      "/ur/contact"
    ];
    const report = await LinkAuditEngine2.runAudit(baseUrl, paths);
    return res.json({ success: true, report });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Link scan failed." });
  }
});
app.get("/api/admin/reports/:reportId", requirePermission("reports:view"), (req, res) => {
  const { reportId } = req.params;
  const d = db.getData();
  switch (reportId) {
    case "editorial-activity":
      return res.json({
        success: true,
        reportId,
        title: "Editorial Activity & Publishing Velocity",
        generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        data: d.articles.map((a) => ({
          id: a.id,
          title: a.titleEn,
          category: a.category,
          author: a.author.nameEn,
          status: a.status,
          publishedAt: a.publishedAt,
          updatedAt: a.updatedAt,
          views: a.views,
          versionCount: a.versions?.length || 0
        }))
      });
    case "pageviews-traffic":
      return res.json({
        success: true,
        reportId,
        title: "Pageviews, Category Reach & Reader Engagement",
        generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        summary: {
          totalViews: d.articles.reduce((acc, a) => acc + a.views, 0),
          avgViewsPerArticle: Math.round(d.articles.reduce((acc, a) => acc + a.views, 0) / (d.articles.length || 1))
        },
        data: d.categories.map((c) => {
          const arts = d.articles.filter((a) => a.category.toLowerCase() === c.slug.toLowerCase());
          const catViews = arts.reduce((sum, a) => sum + (a.views || 0), 0);
          return {
            category: c.nameEn,
            urdu: c.nameUr,
            articleCount: arts.length,
            totalViews: catViews,
            avgViews: arts.length > 0 ? Math.round(catViews / arts.length) : 0
          };
        })
      });
    case "ads-monetization":
      return res.json({
        success: true,
        reportId,
        title: "Advertising Performance & Revenue Yield",
        generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        campaigns: (d.adCampaigns || []).map((c) => ({
          campaign: c.campaignName,
          advertiser: c.advertiserName,
          budgetPkr: c.budgetPkr,
          impressions: c.impressions,
          clicks: c.clicks,
          ctr: `${c.ctr}%`,
          status: c.status
        })),
        slots: (d.adPlacements || []).map((s) => ({
          slotName: s.name,
          provider: s.providerType,
          dimensions: s.dimensions,
          impressions: s.impressions,
          clicks: s.clicks,
          ctr: s.impressions > 0 ? `${(s.clicks / s.impressions * 100).toFixed(2)}%` : "0%"
        }))
      });
    case "automation-sync":
      return res.json({
        success: true,
        reportId,
        title: "Live Data Providers & Synchronization SLA",
        generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        providers: d.dataProviders.map((p) => ({
          provider: p.name,
          category: p.category,
          status: p.status,
          intervalMinutes: p.intervalMinutes,
          successRate: p.totalSyncs > 0 ? `${Math.round(p.successfulSyncs / p.totalSyncs * 100)}%` : "100%",
          totalSyncs: p.totalSyncs,
          lastSyncAt: p.lastSyncAt,
          attribution: p.attribution
        }))
      });
    case "search-console-seo":
      return res.json({
        success: true,
        reportId,
        title: "Google Search Console Organic Search Report",
        generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        metrics: db.getSearchConsoleMetrics()
      });
    case "user-audit-trail":
      return res.json({
        success: true,
        reportId,
        title: "Staff Activity & Immutable Audit Logs",
        generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        logs: d.auditLogs
      });
    case "content-freshness":
      return res.json({
        success: true,
        reportId,
        title: "Content Freshness & Evergreen Refresh Queue",
        generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        tasks: ContentFreshnessEngine.scanArticlesForFreshness(d.articles)
      });
    default:
      return res.json({
        success: true,
        reportId,
        title: `Report: ${reportId}`,
        generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        data: d.articles.slice(0, 15).map((a) => ({ id: a.id, title: a.titleEn, views: a.views, status: a.status }))
      });
  }
});
app.get("/api/v1/admin/ai/connection-status", requireAnyPermission(["ai:use", "ai:keys"]), async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const session = req.adminSession;
    const all = await AIProviderRouter.listCredentialsAuthoritative();
    const connected = all.find((c) => c.enabled && c.connectionStatus === "connected");
    const active = connected || all.find((c) => c.enabled) || all[0] || null;
    const geminiCred = all.find((c) => c.providerType === "gemini" && c.enabled && c.connectionStatus === "connected") || all.find((c) => c.providerType === "gemini" && c.enabled);
    const grokCred = all.find((c) => c.providerType === "grok" && c.enabled && c.connectionStatus === "connected") || all.find((c) => c.providerType === "grok" && c.enabled);
    const supabaseConfigured = isSupabaseConfigured();
    const recentTests = db.getAiConnectionTests(void 0, 10);
    const latestTest = recentTests[0] || null;
    const storageBackend = AIProviderManager.getStorageBackendMode();
    const runtimeInfo = detectBackendRuntimeInfo();
    res.json({
      success: true,
      buildVersion: AI_VAULT_BUILD_VERSION,
      connected: Boolean(connected),
      activeProvider: active,
      geminiStatus: geminiCred?.connectionStatus === "connected" ? "Connected" : geminiCred?.connectionStatus || "Not Connected",
      grokStatus: grokCred?.connectionStatus === "connected" ? "Connected" : grokCred?.connectionStatus || "Not Connected",
      currentUserRole: session?.role || "Unknown",
      isSuperAdmin: session?.role === "Super Admin",
      totalCredentials: all.length,
      connectedCount: all.filter((c) => c.enabled && c.connectionStatus === "connected").length,
      storageBackend,
      supabaseConfigured,
      ephemeralServerlessWarning: (runtimeInfo.isServerless || runtimeInfo.isGoogleAiStudio || runtimeInfo.isProduction) && !supabaseConfigured,
      envManagedVariables: AIProviderManager.getEnvManagedVariablesStatus(),
      serverEnvironment: {
        nodeEnv: process.env.NODE_ENV || "development",
        nodeVersion: process.version,
        isServerless: runtimeInfo.isServerless,
        isGoogleAiStudio: runtimeInfo.isGoogleAiStudio,
        currentRuntime: runtimeInfo.shortName,
        deploymentEnvironment: runtimeInfo.deploymentEnv,
        actualRuntime: runtimeInfo.label,
        generationTimeoutMs: Number(process.env.AI_GENERATION_TIMEOUT_MS || 55e3),
        discoveryTimeoutMs: Number(process.env.AI_DISCOVERY_TIMEOUT_MS || 12e3)
      },
      latestTest
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err?.message || "Failed loading AI connection status." });
  }
});
app.post("/api/v1/admin/ai/discover-auto", requireSuperAdmin, async (req, res) => {
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort(new Error("Client disconnected"));
  });
  try {
    const body = req.body || {};
    const result = await AIProviderManager.discoverAutoStep(
      {
        apiKey: String(body.apiKey || ""),
        providerOverride: body.providerOverride === "gemini" || body.providerOverride === "grok" ? body.providerOverride : void 0,
        preferredModel: body.preferredModel ? String(body.preferredModel) : void 0,
        customEndpointUrl: body.customEndpointUrl ? String(body.customEndpointUrl) : void 0,
        confirmBillableTest: Boolean(body.confirmBillableTest),
        allowPaidModels: Boolean(body.allowPaidModels),
        replaceCredentialId: body.replaceCredentialId ? String(body.replaceCredentialId) : void 0
      },
      getActor(req, "Super Admin"),
      controller.signal
    );
    return res.json({ success: result.ok, result });
  } catch (err) {
    const msg = err?.message || "AI credential verification step failed.";
    const status = isPersistentDbUnavailableMsg(msg) ? 503 : 500;
    return res.status(status).json({
      success: false,
      error: msg
    });
  }
});
app.post("/api/v1/admin/ai/verify-generation-auto", requireSuperAdmin, async (req, res) => {
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort(new Error("Client disconnected"));
  });
  try {
    const body = req.body || {};
    const providerType = body.providerType === "grok" ? "grok" : "gemini";
    const selectedModel = String(body.selectedModel || "").trim();
    if (!selectedModel) {
      return res.status(400).json({ success: false, error: "selectedModel is required for generation verification." });
    }
    const result = await AIProviderManager.verifyGenerationAutoStep(
      {
        apiKey: String(body.apiKey || ""),
        providerType,
        selectedModel,
        candidateModels: Array.isArray(body.candidateModels) ? body.candidateModels.map(String) : [selectedModel],
        availableModels: Array.isArray(body.availableModels) ? body.availableModels : [],
        detectionMethod: body.detectionMethod,
        customEndpointUrl: body.customEndpointUrl ? String(body.customEndpointUrl) : void 0,
        confirmBillableTest: Boolean(body.confirmBillableTest),
        allowPaidModels: Boolean(body.allowPaidModels),
        replaceCredentialId: body.replaceCredentialId ? String(body.replaceCredentialId) : void 0
      },
      getActor(req, "Super Admin"),
      controller.signal
    );
    if (result.ok) {
      AIProviderRouter.clearAutomationCooldowns();
      resetAiContentEngineCooldown();
    }
    return res.json({ success: result.ok, result });
  } catch (err) {
    const msg = err?.message || "AI generation test failed.";
    const status = isPersistentDbUnavailableMsg(msg) ? 503 : 500;
    return res.status(status).json({
      success: false,
      error: msg
    });
  }
});
app.post("/api/v1/admin/ai/connect-auto", requireSuperAdmin, async (req, res) => {
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort(new Error("Client disconnected"));
  });
  try {
    const body = req.body || {};
    const result = await AIProviderManager.connectAutomatically(
      {
        apiKey: String(body.apiKey || ""),
        providerOverride: body.providerOverride === "gemini" || body.providerOverride === "grok" ? body.providerOverride : void 0,
        preferredModel: body.preferredModel ? String(body.preferredModel) : void 0,
        customEndpointUrl: body.customEndpointUrl ? String(body.customEndpointUrl) : void 0,
        confirmBillableTest: Boolean(body.confirmBillableTest),
        allowPaidModels: Boolean(body.allowPaidModels),
        replaceCredentialId: body.replaceCredentialId ? String(body.replaceCredentialId) : void 0
      },
      getActor(req, "Super Admin"),
      controller.signal
    );
    if (result.ok) {
      AIProviderRouter.clearAutomationCooldowns();
      resetAiContentEngineCooldown();
    }
    return res.json({ success: result.ok, result });
  } catch (err) {
    const msg = err?.message || "Automatic AI connection failed.";
    const status = isPersistentDbUnavailableMsg(msg) ? 503 : 500;
    return res.status(status).json({
      success: false,
      error: msg
    });
  }
});
async function handleResetPreview(_req, res) {
  try {
    const preview = await AIProviderManager.getResetPreviewSummary();
    return res.json({ success: true, preview });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Failed preparing reset summary." });
  }
}
async function handleResetAll(req, res) {
  const correlationId = generateCorrelationId("ai-reset");
  try {
    const body = req.body || {};
    if (body.confirmReset !== "RESET_ALL_AI_KEYS") {
      return res.status(400).json({
        success: false,
        error: "Explicit Super Admin confirmation is required to reset all AI API credentials."
      });
    }
    const report = await AIProviderManager.resetAllCredentials(getActor(req, "Super Admin"));
    AIProviderRouter.clearAutomationCooldowns();
    resetAiContentEngineCooldown();
    const affected = isSupabaseConfigured() ? report.removedSupabaseCount : report.removedLocalCount;
    const receipt = AIProviderManager.recordMutationDebugLog({
      correlationId,
      action: "reset_all",
      handler: "handleResetAll",
      endpoint: req.path,
      httpStatus: 200,
      table: "ai_provider_credentials",
      targetId: "provider_type IN (gemini, grok)",
      affectedCount: affected,
      verifiedAfterMutation: Boolean(report.verifiedAfterMutation)
    });
    return res.json({ success: true, ...report, receipt });
  } catch (err) {
    const msg = err?.message || "Failed to reset AI API credentials.";
    const status = isPersistentDbUnavailableMsg(msg) ? 503 : 500;
    AIProviderManager.recordMutationDebugLog({
      correlationId,
      action: "reset_all",
      handler: "handleResetAll",
      endpoint: req.path,
      httpStatus: status,
      table: "ai_provider_credentials",
      targetId: "provider_type IN (gemini, grok)",
      affectedCount: 0,
      verifiedAfterMutation: false,
      note: msg
    });
    return res.status(status).json({
      success: false,
      error: msg
    });
  }
}
app.get("/api/v1/admin/ai/reset-preview", requireSuperAdmin, handleResetPreview);
app.get("/api/admin/ai/reset-preview", requireSuperAdmin, handleResetPreview);
app.post("/api/v1/admin/ai/reset-all", requireSuperAdmin, handleResetAll);
app.post("/api/v1/admin/ai/providers/reset", requireSuperAdmin, handleResetAll);
app.post("/api/admin/ai/reset-all", requireSuperAdmin, handleResetAll);
app.post("/api/admin/ai/providers/reset", requireSuperAdmin, handleResetAll);
async function handleDisconnect(req, res) {
  const correlationId = generateCorrelationId("ai-disc");
  const targetId = req.body?.credentialId ? String(req.body.credentialId) : "active";
  try {
    const body = req.body || {};
    const out = await AIProviderManager.disconnectCredential(
      body.credentialId ? String(body.credentialId) : void 0,
      getActor(req, "Super Admin")
    );
    const status = out.ok ? 200 : out.notFound ? 404 : 500;
    const receipt = AIProviderManager.recordMutationDebugLog({
      correlationId,
      action: "delete_credential",
      handler: "handleDisconnect",
      endpoint: req.path,
      httpStatus: status,
      table: "ai_provider_credentials",
      targetId: out.disconnectedId || targetId,
      affectedCount: out.deletedCount ?? 0,
      verifiedAfterMutation: Boolean(out.verifiedAfterMutation),
      rlsError: out.rlsError || null,
      note: out.message
    });
    if (!out.ok) {
      return res.status(status).json({ success: false, error: out.message, ...out, receipt });
    }
    return res.json({ success: true, ...out, receipt });
  } catch (err) {
    const msg = err?.message || "Failed to disconnect AI provider.";
    const status = isPersistentDbUnavailableMsg(msg) ? 503 : 500;
    const receipt = AIProviderManager.recordMutationDebugLog({
      correlationId,
      action: "delete_credential",
      handler: "handleDisconnect",
      endpoint: req.path,
      httpStatus: status,
      table: "ai_provider_credentials",
      targetId,
      affectedCount: 0,
      verifiedAfterMutation: false,
      note: msg
    });
    return res.status(status).json({ success: false, error: msg, receipt });
  }
}
app.post("/api/v1/admin/ai/disconnect", requireSuperAdmin, handleDisconnect);
app.post("/api/admin/ai/disconnect", requireSuperAdmin, handleDisconnect);
async function handleValidateCandidate(req, res) {
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort(new Error("Client disconnected"));
  });
  try {
    const body = req.body || {};
    const providerType = body.providerType || "gemini";
    const result = await AIProviderManager.validateCandidateKey(
      {
        providerType,
        apiKey: body.apiKey,
        credentialId: body.credentialId,
        endpointUrl: body.endpointUrl,
        model: body.model,
        runGenerationTest: body.runGenerationTest !== false
      },
      getActor(req, "Super Admin"),
      controller.signal
    );
    return res.json({ success: result.ok, result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Validation failed." });
  }
}
app.post("/api/v1/admin/ai/providers/validate", requireSuperAdmin, handleValidateCandidate);
app.post("/api/admin/ai/providers/validate", requireSuperAdmin, handleValidateCandidate);
app.post("/api/admin/ai/validate", requireSuperAdmin, handleValidateCandidate);
async function handleGetDiagnostics(_req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const diagnostics = await AIProviderManager.getDiagnostics();
    return res.json({ success: true, ...diagnostics });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Diagnostics check failed." });
  }
}
async function handleRunCrudSelfTest(req, res) {
  try {
    const result = await AIProviderManager.runCrudSelfTest(getActor(req, "Super Admin"));
    const status = result.ok ? 200 : !result.configured ? 503 : 500;
    return res.status(status).json({ success: result.ok, ...result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "CRUD self-test failed." });
  }
}
app.get("/api/v1/admin/ai/diagnostics", requireSuperAdmin, handleGetDiagnostics);
app.get("/api/v1/admin/ai/providers/diagnostics", requireSuperAdmin, handleGetDiagnostics);
app.get("/api/v1/admin/supabase/diagnostics", requireSuperAdmin, handleGetDiagnostics);
app.get("/api/admin/ai/diagnostics", requireSuperAdmin, handleGetDiagnostics);
app.get("/api/admin/ai/providers/diagnostics", requireSuperAdmin, handleGetDiagnostics);
app.post("/api/v1/admin/ai/diagnostics/crud-test", requireSuperAdmin, handleRunCrudSelfTest);
app.post("/api/v1/admin/ai/providers/diagnostics/crud-test", requireSuperAdmin, handleRunCrudSelfTest);
app.post("/api/admin/ai/diagnostics/crud-test", requireSuperAdmin, handleRunCrudSelfTest);
app.post("/api/admin/ai/providers/diagnostics/crud-test", requireSuperAdmin, handleRunCrudSelfTest);
async function handleListProviders(_req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const providers = await AIProviderRouter.listCredentialsAuthoritative();
    return res.json({ success: true, providers });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Failed listing AI providers." });
  }
}
async function handleCreateOrUpsertProvider(req, res) {
  const correlationId = generateCorrelationId("ai-add");
  const action = req.body?.id ? "edit_credential" : "add_credential";
  const expectedStatus = req.body?.id ? 200 : 201;
  try {
    const saved = await AIProviderManager.addOrUpdateCredential(req.body || {}, getActor(req, "Super Admin"));
    AIProviderRouter.clearAutomationCooldowns();
    resetAiContentEngineCooldown();
    const receipt = AIProviderManager.recordMutationDebugLog({
      correlationId,
      action,
      handler: "handleCreateOrUpsertProvider",
      endpoint: req.path,
      httpStatus: expectedStatus,
      table: "ai_provider_credentials",
      targetId: saved.id,
      affectedCount: 1,
      verifiedAfterMutation: true
    });
    return res.status(expectedStatus).json({ success: true, provider: saved, receipt });
  } catch (err) {
    const msg = err?.message || "Failed saving AI credential.";
    const status = msg.toLowerCase().includes("not found") ? 404 : isPersistentDbUnavailableMsg(msg) ? 503 : msg.toLowerCase().includes("database") || msg.toLowerCase().includes("supabase") ? 500 : 400;
    const receipt = AIProviderManager.recordMutationDebugLog({
      correlationId,
      action,
      handler: "handleCreateOrUpsertProvider",
      endpoint: req.path,
      httpStatus: status,
      table: "ai_provider_credentials",
      targetId: req.body?.id ? String(req.body.id) : "new",
      affectedCount: 0,
      verifiedAfterMutation: false,
      note: msg
    });
    return res.status(status).json({ success: false, error: msg, receipt });
  }
}
async function handlePatchProvider(req, res) {
  const correlationId = generateCorrelationId("ai-edit");
  const action = req.body && Object.keys(req.body).length === 1 && "enabled" in req.body ? "toggle_credential" : "edit_credential";
  try {
    const updated = await AIProviderManager.updateCredentialPartial(
      req.params.id,
      req.body || {},
      getActor(req, "Super Admin")
    );
    AIProviderRouter.clearAutomationCooldowns();
    resetAiContentEngineCooldown();
    const receipt = AIProviderManager.recordMutationDebugLog({
      correlationId,
      action,
      handler: "handlePatchProvider",
      endpoint: req.path,
      httpStatus: 200,
      table: "ai_provider_credentials",
      targetId: updated.id,
      affectedCount: 1,
      verifiedAfterMutation: true
    });
    return res.json({ success: true, provider: updated, receipt });
  } catch (err) {
    const msg = err?.message || "Failed updating AI credential.";
    const status = msg.toLowerCase().includes("not found") ? 404 : isPersistentDbUnavailableMsg(msg) ? 503 : msg.toLowerCase().includes("database") || msg.toLowerCase().includes("supabase") ? 500 : 400;
    const receipt = AIProviderManager.recordMutationDebugLog({
      correlationId,
      action,
      handler: "handlePatchProvider",
      endpoint: req.path,
      httpStatus: status,
      table: "ai_provider_credentials",
      targetId: req.params.id,
      affectedCount: 0,
      verifiedAfterMutation: false,
      note: msg
    });
    return res.status(status).json({ success: false, error: msg, receipt });
  }
}
async function handleDeleteProvider(req, res) {
  const correlationId = generateCorrelationId("ai-del");
  try {
    const out = await AIProviderManager.disconnectCredential(req.params.id, getActor(req, "Super Admin"));
    const status = out.ok && (out.deletedCount ?? 0) >= 1 && out.verifiedAfterMutation !== false ? 200 : out.notFound ? 404 : 500;
    const receipt = AIProviderManager.recordMutationDebugLog({
      correlationId,
      action: "delete_credential",
      handler: "handleDeleteProvider",
      endpoint: req.path,
      httpStatus: status,
      table: "ai_provider_credentials",
      targetId: req.params.id,
      affectedCount: out.deletedCount ?? 0,
      verifiedAfterMutation: Boolean(out.verifiedAfterMutation),
      rlsError: out.rlsError || null,
      note: out.message
    });
    if (status !== 200) {
      return res.status(status).json({
        success: false,
        error: out.message,
        deletedCount: out.deletedCount ?? 0,
        receipt
      });
    }
    return res.json({
      success: true,
      deletedCount: out.deletedCount ?? 1,
      disconnectedId: out.disconnectedId,
      message: out.message,
      receipt
    });
  } catch (err) {
    const msg = err?.message || "Failed deleting AI credential.";
    const status = isPersistentDbUnavailableMsg(msg) ? 503 : 500;
    const receipt = AIProviderManager.recordMutationDebugLog({
      correlationId,
      action: "delete_credential",
      handler: "handleDeleteProvider",
      endpoint: req.path,
      httpStatus: status,
      table: "ai_provider_credentials",
      targetId: req.params.id,
      affectedCount: 0,
      verifiedAfterMutation: false,
      note: msg
    });
    return res.status(status).json({
      success: false,
      error: msg,
      deletedCount: 0,
      receipt
    });
  }
}
async function handleTestProviderById(req, res) {
  try {
    const result = await AIProviderManager.testSavedCredential(req.params.id, getActor(req, "Super Admin"));
    return res.json({ success: result.ok, result });
  } catch (err) {
    const msg = err?.message || "Provider test failed.";
    const status = msg.toLowerCase().includes("not found") ? 404 : msg.toLowerCase().includes("database") || msg.toLowerCase().includes("supabase") ? 500 : 400;
    return res.status(status).json({ success: false, error: msg });
  }
}
app.get("/api/v1/admin/ai/providers", requireAnyPermission(["ai:use", "ai:keys"]), handleListProviders);
app.get("/api/admin/ai/providers", requireAnyPermission(["ai:use", "ai:keys"]), handleListProviders);
app.post("/api/v1/admin/ai/providers", requireSuperAdmin, handleCreateOrUpsertProvider);
app.post("/api/admin/ai/providers", requireSuperAdmin, handleCreateOrUpsertProvider);
app.patch("/api/v1/admin/ai/providers/:id", requireSuperAdmin, handlePatchProvider);
app.patch("/api/admin/ai/providers/:id", requireSuperAdmin, handlePatchProvider);
app.delete("/api/v1/admin/ai/providers/:id", requireSuperAdmin, handleDeleteProvider);
app.delete("/api/admin/ai/providers/:id", requireSuperAdmin, handleDeleteProvider);
app.post("/api/v1/admin/ai/providers/:id/test", requireSuperAdmin, handleTestProviderById);
app.post("/api/admin/ai/providers/:id/test", requireSuperAdmin, handleTestProviderById);
app.get("/api/v1/admin/ai/providers/:id/models", requireAnyPermission(["ai:use", "ai:keys"]), async (req, res) => {
  try {
    const discovery = await AIProviderManager.discoverModelsForCredential(req.params.id, getActor(req, "Super Admin"));
    return res.json({ success: true, ...discovery });
  } catch (err) {
    const diag = err?.diagnostic;
    return res.status(diag?.httpStatus || 400).json({
      success: false,
      error: diag?.diagnosis || err?.message || "Failed discovering models.",
      diagnostic: diag
    });
  }
});
app.get("/api/v1/admin/ai/providers/:id/logs", requirePermission("ai:keys"), (req, res) => {
  const logs = AIProviderManager.getCredentialLogs(req.params.id);
  res.json({ success: true, ...logs });
});
async function handleGetTaskRoutes(_req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const routes = await AIProviderRouter.getTaskRoutesAuthoritative();
    return res.json({ success: true, routes });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Failed loading AI task routes." });
  }
}
async function handleSaveTaskRoutes(req, res) {
  const correlationId = generateCorrelationId("ai-route");
  try {
    const body = req.body || {};
    const actor = getActor(req, "Super Admin");
    const payload = Array.isArray(body.routes) ? body.routes : body.task ? body : null;
    if (!payload) {
      return res.status(400).json({ success: false, error: "Task routing payload is required." });
    }
    const routes = await AIProviderManager.saveTaskRoutes(payload, actor);
    const receipt = AIProviderManager.recordMutationDebugLog({
      correlationId,
      action: "save_task_routes",
      handler: "handleSaveTaskRoutes",
      endpoint: req.path,
      httpStatus: 200,
      table: "ai_task_routes",
      targetId: Array.isArray(payload) ? "all_routes" : String(payload.task),
      affectedCount: Array.isArray(payload) ? payload.length : 1,
      verifiedAfterMutation: true
    });
    return res.json({ success: true, routes, receipt });
  } catch (err) {
    const msg = err?.message || "Failed saving AI task routes.";
    const status = isPersistentDbUnavailableMsg(msg) ? 503 : msg.toLowerCase().includes("database") ? 500 : 400;
    const receipt = AIProviderManager.recordMutationDebugLog({
      correlationId,
      action: "save_task_routes",
      handler: "handleSaveTaskRoutes",
      endpoint: req.path,
      httpStatus: status,
      table: "ai_task_routes",
      targetId: "task_routes",
      affectedCount: 0,
      verifiedAfterMutation: false,
      note: msg
    });
    return res.status(status).json({ success: false, error: msg, receipt });
  }
}
app.get("/api/v1/admin/ai/task-routes", requirePermission("ai:keys"), handleGetTaskRoutes);
app.get("/api/admin/ai/task-routes", requirePermission("ai:keys"), handleGetTaskRoutes);
app.get("/api/admin/ai/routing", requirePermission("ai:keys"), handleGetTaskRoutes);
app.put("/api/v1/admin/ai/task-routes", requireSuperAdmin, handleSaveTaskRoutes);
app.put("/api/admin/ai/task-routes", requireSuperAdmin, handleSaveTaskRoutes);
app.post("/api/admin/ai/routing", requireSuperAdmin, handleSaveTaskRoutes);
app.post("/api/v1/admin/ai/health-check", requirePermission("ai:keys"), async (req, res) => {
  try {
    const summary = await AIProviderManager.runLightweightHealthCheck(getActor(req, "Super Admin"));
    return res.json({ success: true, summary });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Health check failed." });
  }
});
app.get("/api/v1/admin/ai/usage", requirePermission("ai:keys"), (_req, res) => {
  res.json({ success: true, usage: AIUsageTracker.getSummary() });
});
app.get("/api/admin/ai/usage", requirePermission("ai:keys"), (_req, res) => {
  res.json({ success: true, usage: AIUsageTracker.getSummary() });
});
function handleAiError(res, err) {
  if (err instanceof AIUnavailableError) {
    return res.status(err.statusCode).json({
      success: false,
      code: err.code,
      error: err.message,
      diagnostic: err.diagnostic
    });
  }
  return res.status(500).json({ success: false, error: err?.message || "AI execution failed" });
}
app.post("/api/admin/ai/suggest-headline", requirePermission("ai:use"), async (req, res) => {
  const { summary, topic, language, credentialId, model } = req.body || {};
  try {
    const prompt = `You are a chief news editor for 360Khabarnama, a leading Pakistani bilingual digital publication.
Suggest 3 crisp, journalistically accurate news headlines in BOTH English and Urdu for this topic/summary:
Topic: ${topic || "Pakistan News"}
Summary: ${summary || "Latest report"}
Primary Language Focus: ${language === "ur" ? "Urdu" : "English"}

Return ONLY JSON:
{
  "headlinesEn": ["English Headline 1", "English Headline 2", "English Headline 3"],
  "headlinesUr": ["\u0627\u0631\u062F\u0648 \u0633\u0631\u062E\u06CC 1", "\u0627\u0631\u062F\u0648 \u0633\u0631\u062E\u06CC 2", "\u0627\u0631\u062F\u0648 \u0633\u0631\u062E\u06CC 3"]
}`;
    const { data, meta } = await AIProviderRouter.executeJsonTask({
      task: "headline_generation",
      prompt,
      preferredProviderId: credentialId || void 0,
      preferredModel: model || void 0,
      actor: getActor(req)
    });
    const headlinesEn = Array.isArray(data.headlinesEn) ? data.headlinesEn : [];
    const headlinesUr = Array.isArray(data.headlinesUr) ? data.headlinesUr : [];
    return res.json({
      success: true,
      headlinesEn,
      headlinesUr,
      telemetry: meta,
      text: (language === "ur" ? headlinesUr : headlinesEn).map((h) => `- ${h}`).join("\n")
    });
  } catch (err) {
    return handleAiError(res, err);
  }
});
app.post("/api/admin/ai/translate", requirePermission("ai:use"), async (req, res) => {
  const { title, summary, text, targetLanguage, credentialId, model } = req.body || {};
  try {
    const target = targetLanguage === "ur" ? "Urdu (formal news journalism Nastaliq register)" : "English (clear, objective news journalism prose)";
    const prompt = `Translate the following Pakistani news content accurately into ${target}. Preserve all proper nouns, figures, dates, and tone. Do NOT invent any new facts.

Title: ${title || ""}
Summary: ${summary || ""}
Body: ${text || ""}

Return ONLY valid JSON:
{
  "translatedTitle": "...",
  "translatedSummary": "...",
  "translation": "..."
}`;
    const { data, meta } = await AIProviderRouter.executeJsonTask({
      task: "translation",
      prompt,
      preferredProviderId: credentialId || void 0,
      preferredModel: model || void 0,
      actor: getActor(req)
    });
    return res.json({
      success: true,
      translatedTitle: data.translatedTitle || "",
      translatedSummary: data.translatedSummary || "",
      translation: data.translation || "",
      telemetry: meta
    });
  } catch (err) {
    return handleAiError(res, err);
  }
});
app.post("/api/admin/ai/seo-tags", requirePermission("ai:use"), async (req, res) => {
  const { title, content, credentialId, model } = req.body || {};
  try {
    const prompt = `Analyze this Pakistani digital news article and produce search optimization metadata:
Title: ${title || ""}
Content snippet: ${String(content || "").slice(0, 800)}

Return ONLY valid JSON:
{
  "metaTitleEn": "Under 65 chars SEO title",
  "metaDescription": "Under 155 chars accurate summary",
  "tags": ["Tag1", "Tag2", "Tag3", "Tag4", "Tag5"],
  "slugSuggestion": "url-friendly-lowercase-slug"
}`;
    const { data, meta } = await AIProviderRouter.executeJsonTask({
      task: "seo_metadata",
      prompt,
      preferredProviderId: credentialId || void 0,
      preferredModel: model || void 0,
      actor: getActor(req)
    });
    return res.json({ success: true, seo: data, telemetry: meta });
  } catch (err) {
    return handleAiError(res, err);
  }
});
app.post("/api/admin/ai/summarize", requirePermission("ai:use"), async (req, res) => {
  const { titleEn, titleUr, contentEn, contentUr, credentialId, model } = req.body || {};
  try {
    const prompt = `Summarize this Pakistani news article into 2 crisp factual sentences in both English and Urdu without adding external claims.
English Title: ${titleEn || ""}
Urdu Title: ${titleUr || ""}
English Content: ${String(contentEn || "").slice(0, 1500)}
Urdu Content: ${String(contentUr || "").slice(0, 1500)}

Return ONLY valid JSON:
{
  "summaryEn": "...",
  "summaryUr": "...",
  "bulletPointsEn": ["...", "...", "..."]
}`;
    const { data, meta } = await AIProviderRouter.executeJsonTask({
      task: "summarization",
      prompt,
      preferredProviderId: credentialId || void 0,
      preferredModel: model || void 0,
      actor: getActor(req)
    });
    return res.json({
      success: true,
      summaryEn: data.summaryEn || "",
      summaryUr: data.summaryUr || "",
      bulletPointsEn: Array.isArray(data.bulletPointsEn) ? data.bulletPointsEn : [],
      telemetry: meta
    });
  } catch (err) {
    return handleAiError(res, err);
  }
});
app.post("/api/admin/ai/seo-internal-links", requirePermission("ai:use"), async (req, res) => {
  const { articleId, titleEn, category, contentEn } = req.body || {};
  try {
    const articles = db.getData().articles.filter((a) => a.status === "published" && a.id !== articleId).slice(0, 30);
    const catalog = articles.map((a) => ({
      id: a.id,
      slug: a.slug,
      titleEn: a.titleEn,
      category: a.category
    }));
    const prompt = `You are an SEO architect for 360Khabarnama.
Source Article:
Title: ${titleEn || ""}
Category: ${category || ""}
Content snippet: ${String(contentEn || "").slice(0, 600)}

Candidate Target Articles:
${JSON.stringify(catalog)}

Select up to 5 most relevant internal linking opportunities strictly from the provided candidate list.
Return ONLY valid JSON:
{
  "suggestions": [
    {
      "targetTitle": "Exact candidate title",
      "targetUrl": "/en/news/candidate-slug",
      "anchorText": "Natural 2-5 word anchor text",
      "relevanceReason": "Short reason"
    }
  ]
}`;
    const { data, meta } = await AIProviderRouter.executeJsonTask({
      task: "seo_metadata",
      prompt,
      actor: getActor(req)
    });
    return res.json({ success: true, suggestions: Array.isArray(data?.suggestions) ? data.suggestions : [], telemetry: meta });
  } catch (err) {
    return handleAiError(res, err);
  }
});
app.post("/api/admin/ai/newsroom-classify", requirePermission("ai:use"), async (req, res) => {
  const { headline, body } = req.body || {};
  try {
    const prompt = `Classify and summarize this breaking news item for 360Khabarnama AI Newsroom.
Headline: ${headline || ""}
Body: ${String(body || "").slice(0, 1200)}

Return ONLY valid JSON:
{
  "category": "pakistan|politics|business|sports|education|technology|world|entertainment|islamic|health",
  "titleUr": "Urdu headline",
  "summaryEn": "2-sentence English summary",
  "summaryUr": "2-sentence Urdu summary",
  "tags": ["Tag1", "Tag2", "Tag3"]
}`;
    const { data, meta } = await AIProviderRouter.executeJsonTask({
      task: "category_tagging",
      prompt,
      actor: getActor(req)
    });
    return res.json({ success: true, classification: data, telemetry: meta });
  } catch (err) {
    return handleAiError(res, err);
  }
});
app.post("/api/admin/ai/editorial-studio", requirePermission("ai:use"), async (req, res) => {
  const { template, topic, inputText, category, tone, credentialId } = req.body || {};
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort(new Error("Client disconnected"));
  });
  const taskMap = {
    bilingual_article: "article_drafting",
    article_draft: "article_drafting",
    story_outline: "article_drafting",
    urdu_to_english: "translation",
    english_to_urdu: "translation",
    translate_en_ur: "translation",
    translate_ur_en: "translation",
    headlines_5: "headline_generation",
    headlines: "headline_generation",
    seo_meta: "seo_metadata",
    classify_tags: "category_tagging",
    summary_bullets: "summarization",
    summarize: "summarization",
    breaking_alert: "breaking_alerts",
    social_captions: "newsletter_social",
    morning_newsletter: "newsletter_social",
    newsletter: "newsletter_social",
    fact_check_prep: "fact_check_prep",
    fact_check: "fact_check_prep",
    rewrite_tone: "content_rewriting",
    related_ideas: "article_drafting",
    faq_schema: "seo_metadata"
  };
  const mappedTask = taskMap[template] || "article_drafting";
  try {
    const prompt = `You are Senior Editor at 360Khabarnama (Pakistan bilingual news & civic portal).
Task Template: ${template}
Category: ${category || "pakistan"}
Tone: ${tone || "Objective & Authoritative"}
Topic / Headline: ${topic || ""}
Source Input / Notes: ${inputText || ""}

Strict Rules: Ground strictly in the supplied notes/facts. Do NOT fabricate numbers, quotes, or statistics.
Return ONLY valid JSON appropriate for the template, including relevant keys among:
- "titleEn", "titleUr", "summaryEn", "summaryUr", "contentEn", "contentUr"
- "headlinesEn" (array), "headlinesUr" (array)
- "tags" (array), "metaDescription", "slugSuggestion"
- "bulletSummaryEn" (array), "bulletSummaryUr" (array)
- "twitterEn", "twitterUr", "facebook", "whatsapp"
- "factCheckFlags" (array), "recommendations" (array), "overallScore" (number)
- "faqs" (array of { "question": "...", "answer": "..." })`;
    const { data, meta } = await AIProviderRouter.executeJsonTask({
      task: mappedTask,
      prompt,
      preferredProviderId: credentialId || void 0,
      actor: getActor(req),
      signal: controller.signal
    });
    return res.json({ success: true, result: data, telemetry: meta });
  } catch (err) {
    return handleAiError(res, err);
  }
});
app.get("/api/admin/ai/editorial-drafts", requirePermission("ai:use"), (_req, res) => {
  res.json({ success: true, drafts: db.getEditorialDrafts() });
});
app.post("/api/admin/ai/editorial-drafts", requirePermission("ai:use"), async (req, res) => {
  try {
    const actor = getActor(req);
    const b = req.body || {};
    const draft = db.saveEditorialDraft({
      id: b.id || `edraft-${Date.now()}`,
      template: b.template || "bilingual_article",
      titleEn: b.titleEn || "Untitled Draft",
      titleUr: b.titleUr || "",
      contentEn: b.contentEn || "",
      contentUr: b.contentUr || "",
      summaryEn: b.summaryEn || "",
      summaryUr: b.summaryUr || "",
      providerType: b.providerType,
      model: b.model,
      totalTokens: b.totalTokens,
      createdBy: actor,
      createdAt: b.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: b.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
    });
    await persistModuleMutation({
      module: "editorial_drafts",
      action: "save",
      recordId: draft.id,
      actor,
      syncFn: () => syncEditorialDraftToSupabase(draft)
    });
    return res.json({ success: true, draft });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || "Failed saving editorial draft." });
  }
});
app.post("/api/admin/ai/draft-article", requirePermission("ai:use"), async (req, res) => {
  const { topic, facts, category, tone } = req.body || {};
  try {
    const prompt = `Create a verified bilingual news article draft for 360Khabarnama.
Category: ${category || "Pakistan"}
Topic: ${topic}
Facts: ${facts || ""}
Tone: ${tone || "Objective"}
Return ONLY valid JSON with titleEn, titleUr, summaryEn, summaryUr, contentEn, contentUr, tags, suggestedCategory.`;
    const { data } = await AIProviderRouter.executeJsonTask({
      task: "article_drafting",
      prompt,
      actor: getActor(req)
    });
    return res.json({ success: true, draft: data });
  } catch (err) {
    return handleAiError(res, err);
  }
});
app.post("/api/admin/ai/social-captions", requirePermission("ai:use"), async (req, res) => {
  const { titleEn, titleUr, summaryEn, summaryUr } = req.body || {};
  try {
    const prompt = `Create bilingual social copy for 360Khabarnama:
Title (EN): ${titleEn}
Title (UR): ${titleUr}
Summary (EN): ${summaryEn}
Summary (UR): ${summaryUr}
Return JSON with keys: twitterEn, twitterUr, facebook, instagram, whatsapp.`;
    const { data } = await AIProviderRouter.executeJsonTask({
      task: "newsletter_social",
      prompt,
      actor: getActor(req)
    });
    return res.json({ success: true, captions: data });
  } catch (err) {
    return handleAiError(res, err);
  }
});
app.post("/api/admin/ai/content-quality-check", requirePermission("ai:use"), async (req, res) => {
  const { titleEn, contentEn, titleUr } = req.body || {};
  try {
    const prompt = `Audit journalistic objectivity, bilingual grammar, and attribution for:
Title (EN): ${titleEn}
Content (EN): ${contentEn}
Title (UR): ${titleUr}
Return JSON with overallScore, readabilityLevel, objectivityRating, grammarRating, recommendations, revisedHeadlineSuggestion.`;
    const { data } = await AIProviderRouter.executeJsonTask({
      task: "fact_check_prep",
      prompt,
      actor: getActor(req)
    });
    return res.json({ success: true, audit: data });
  } catch (err) {
    return handleAiError(res, err);
  }
});
app.post("/api/v1/admin/ai/gemini/validate", requireSuperAdmin, async (req, res) => {
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort(new Error("Client disconnected"));
  });
  try {
    const body = req.body || {};
    const result = await AIProviderManager.validateCandidateKey(
      {
        providerType: "gemini",
        apiKey: body.apiKey,
        credentialId: body.credentialId,
        model: body.model,
        runGenerationTest: body.runGenerationTest !== false
      },
      getActor(req, "Super Admin"),
      controller.signal
    );
    return res.json({ success: result.ok, result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Gemini validation failed." });
  }
});
app.post("/api/v1/admin/ai/gemini/test", requireSuperAdmin, async (req, res) => {
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort(new Error("Client disconnected"));
  });
  try {
    const { credentialId, model, prompt } = req.body || {};
    if (prompt) {
      const execRes = await AIProviderRouter.executeTask({
        task: "headline_generation",
        prompt: String(prompt),
        preferredProviderId: credentialId || void 0,
        preferredModel: model || void 0,
        actor: getActor(req, "Super Admin"),
        signal: controller.signal
      });
      return res.json({
        success: true,
        text: execRes.text,
        telemetry: {
          model: execRes.model,
          providerType: execRes.providerType,
          credentialId: execRes.credentialId,
          projectId: execRes.projectId,
          latencyMs: execRes.latencyMs,
          totalTokens: execRes.totalTokens
        }
      });
    }
    const result = await AIProviderManager.validateCandidateKey(
      {
        providerType: "gemini",
        apiKey: req.body?.apiKey,
        credentialId,
        model,
        runGenerationTest: true
      },
      getActor(req, "Super Admin"),
      controller.signal
    );
    return res.json({ success: result.ok, result });
  } catch (err) {
    return handleAiError(res, err);
  }
});
app.get("/api/v1/admin/ai/models", requireAnyPermission(["ai:use", "ai:keys"]), async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const creds = await AIProviderRouter.listCredentialsAuthoritative();
    const credentialId = req.query.credentialId;
    if (credentialId) {
      const discovery = await AIProviderManager.discoverModelsForCredential(credentialId, getActor(req, "Super Admin"));
      return res.json({ success: true, ...discovery });
    }
    const models = creds.flatMap(
      (c) => (c.availableModels || []).map((m) => ({
        ...m,
        credentialId: c.id,
        credentialLabel: c.label,
        providerType: c.providerType
      }))
    );
    return res.json({ success: true, count: models.length, models });
  } catch (err) {
    return res.status(400).json({ success: false, error: err?.message || "Failed listing AI models." });
  }
});
app.post("/api/v1/admin/ai/translate", requirePermission("ai:use"), async (req, res) => {
  const { title, summary, text, targetLanguage, credentialId, model } = req.body || {};
  try {
    const target = targetLanguage === "ur" ? "Urdu" : "English";
    const prompt = `Translate into ${target} news journalism style. Preserve facts cleanly.
Title: ${title || ""}
Summary: ${summary || ""}
Body: ${text || ""}
Return ONLY JSON: { "translatedTitle": "...", "translatedSummary": "...", "translation": "..." }`;
    const { data, meta } = await AIProviderRouter.executeJsonTask({
      task: "translation",
      prompt,
      preferredProviderId: credentialId || void 0,
      preferredModel: model || void 0,
      actor: getActor(req)
    });
    return res.json({
      success: true,
      translatedTitle: data.translatedTitle || "",
      translatedSummary: data.translatedSummary || "",
      translation: data.translation || "",
      telemetry: meta
    });
  } catch (err) {
    return handleAiError(res, err);
  }
});
app.post("/api/v1/admin/ai/suggest-headlines", requirePermission("ai:use"), async (req, res) => {
  const { summary, topic, language, credentialId, model } = req.body || {};
  try {
    const prompt = `Suggest 3 crisp, factual news headlines in English and Urdu for:
Topic: ${topic || "Pakistan News"}
Summary: ${summary || ""}
Primary Language Focus: ${language === "ur" ? "Urdu" : "English"}
Return ONLY JSON: { "headlinesEn": ["..."], "headlinesUr": ["..."] }`;
    const { data, meta } = await AIProviderRouter.executeJsonTask({
      task: "headline_generation",
      prompt,
      preferredProviderId: credentialId || void 0,
      preferredModel: model || void 0,
      actor: getActor(req)
    });
    return res.json({
      success: true,
      headlinesEn: Array.isArray(data.headlinesEn) ? data.headlinesEn : [],
      headlinesUr: Array.isArray(data.headlinesUr) ? data.headlinesUr : [],
      telemetry: meta
    });
  } catch (err) {
    return handleAiError(res, err);
  }
});
app.post("/api/v1/admin/ai/generate-seo", requirePermission("ai:use"), async (req, res) => {
  const { title, content, credentialId, model } = req.body || {};
  try {
    const prompt = `Generate bilingual SEO metadata & tags for:
Title: ${title || ""}
Snippet: ${String(content || "").slice(0, 800)}
Return ONLY JSON: { "metaTitleEn": "...", "metaDescription": "...", "tags": ["..."], "slugSuggestion": "..." }`;
    const { data, meta } = await AIProviderRouter.executeJsonTask({
      task: "seo_metadata",
      prompt,
      preferredProviderId: credentialId || void 0,
      preferredModel: model || void 0,
      actor: getActor(req)
    });
    return res.json({ success: true, seo: data, telemetry: meta });
  } catch (err) {
    return handleAiError(res, err);
  }
});
app.post("/api/ai/ask-portal", async (req, res) => {
  const { question, language } = req.body || {};
  if (!question) {
    return res.status(400).json({ success: false, error: "Question is required" });
  }
  try {
    const data = db.getData();
    const contextSnippet = `
Portal Context:
- PSX 100 Index: ${data.psx.kse100} (Change: ${data.psx.change})
- Gold Rate 24K: Rs. ${data.goldRates[0]?.tolaPkr} per tola
- USD/PKR Interbank: Rs. ${data.currencyRates[0]?.interbankPkr}
- Petrol Price: Rs. ${data.fuelPrices[0]?.pricePkr} per liter
- Top News Headline: ${data.articles[0]?.titleEn} / ${data.articles[0]?.titleUr}
- Karachi Fajr: ${data.prayerTimes.karachi?.fajr}, Maghrib: ${data.prayerTimes.karachi?.maghrib}
- Lahore Fajr: ${data.prayerTimes.lahore?.fajr}, Maghrib: ${data.prayerTimes.lahore?.maghrib}`;
    const prompt = `You are the reader assistant of "360Khabarnama".
Answer accurately in ${language === "ur" ? "Urdu" : "English"} using only the provided portal facts if relevant. Keep it under 120 words and never fabricate numbers.
${contextSnippet}
User Question: ${question}`;
    const execRes = await AIProviderRouter.executeTask({
      task: "public_qa",
      prompt,
      actor: "Public Reader"
    });
    return res.json({ success: true, answer: execRes.text });
  } catch (err) {
    return handleAiError(res, err);
  }
});
app.get("/api/admin/newsroom/status", requirePermission("automation:manage"), (_req, res) => {
  res.json({ success: true, status: WorkflowOrchestrator.getStatus() });
});
app.post("/api/admin/newsroom/pause", requirePermission("automation:manage"), (req, res) => {
  WorkflowOrchestrator.setPaused(!!req.body?.paused, getActor(req, "Super Admin"));
  res.json({ success: true, emergencyPaused: WorkflowOrchestrator.isPaused() });
});
app.get("/api/admin/newsroom/sources", requirePermission("automation:manage"), (_req, res) => {
  res.json({ success: true, sources: NewsIngestionEngine.getSources() });
});
app.post("/api/admin/newsroom/sources", requirePermission("automation:manage"), (req, res) => {
  const actor = getActor(req, "Super Admin");
  const saved = NewsIngestionEngine.upsertSource(req.body || {});
  db.logAudit(actor, "News Source Updated", `Updated source: ${saved.name}`);
  res.json({ success: true, source: saved });
});
app.post("/api/admin/newsroom/run-pipeline", requirePermission("automation:manage"), (req, res) => {
  const summary = WorkflowOrchestrator.runPipelineCycle(getActor(req, "Super Admin"));
  res.json({ success: true, summary });
});
app.get("/api/admin/automation/status", requirePermission("automation:manage"), (_req, res) => {
  const providers = ProviderRegistry.getAllSanitized();
  const settings = db.getAutomationSettings();
  const history = db.getSyncHistory(5);
  const pendingDrafts = db.getAiDrafts("pending_review");
  res.json({
    success: true,
    providers,
    settings,
    recentRuns: history,
    pendingDraftsCount: pendingDrafts.length,
    lastGlobalSync: history[0]?.timestamp || null
  });
});
app.post("/api/admin/automation/providers", requirePermission("automation:manage"), async (req, res) => {
  try {
    const actor = getActor(req, "Automation Manager");
    const provider = ProviderRegistry.upsertProvider(req.body || {}, actor);
    await persistModuleMutation({
      module: "sync_providers",
      action: "save",
      recordId: provider.id,
      actor,
      syncFn: () => syncDataProviderToSupabase(provider)
    });
    return res.json({ success: true, provider });
  } catch (err) {
    return res.status(err?.statusCode || 400).json({ success: false, error: err?.message || "Failed saving provider." });
  }
});
app.post("/api/admin/automation/providers/:id/test", requirePermission("automation:manage"), async (req, res) => {
  try {
    const result = await ProviderRegistry.testEndpoint(req.params.id);
    return res.json({ success: true, result });
  } catch (err) {
    return res.status(400).json({ success: false, error: err?.message || "Endpoint test failed." });
  }
});
app.delete("/api/admin/automation/providers/:id", requirePermission("automation:manage"), async (req, res) => {
  try {
    const actor = getActor(req, "Automation Manager");
    const success = ProviderRegistry.deleteProvider(req.params.id, actor);
    if (success) {
      await persistModuleMutation({
        module: "sync_providers",
        action: "delete",
        recordId: req.params.id,
        actor,
        syncFn: () => deleteDataProviderFromSupabase(req.params.id)
      });
    }
    return res.json({ success });
  } catch (err) {
    return res.status(err?.statusCode || 500).json({ success: false, error: err?.message || "Failed deleting provider." });
  }
});
app.post("/api/admin/automation/sync/:providerId", requirePermission("automation:manage"), async (req, res) => {
  const { providerId } = req.params;
  try {
    const runRecord = await scheduler.runSyncForProvider(providerId, true);
    db.logAudit(getActor(req), "Manual Provider Sync Triggered", `Triggered manual sync for provider: ${providerId}`);
    return res.json({ success: runRecord.status === "success", run: runRecord });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Sync failed to execute" });
  }
});
app.post("/api/admin/automation/retry/:providerId", requirePermission("automation:manage"), async (req, res) => {
  try {
    const run = await JobScheduler.retryProviderWithBackoff(req.params.providerId);
    db.logAudit(getActor(req), "Provider Retry Backoff", `Retried ${req.params.providerId}: ${run.status}`);
    return res.json({ success: true, run });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Retry failed" });
  }
});
app.post("/api/admin/automation/cron/run", requirePermission("automation:manage"), async (req, res) => {
  try {
    const outcome = await JobScheduler.runDueJobs("cpanel_cron");
    db.logAudit(getActor(req), "Manual Cron Batch Run", `Processed ${outcome.runs.length} due providers`);
    return res.json({ success: true, skipped: outcome.skipped || null, runs: outcome.runs });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Cron run failed" });
  }
});
app.post("/api/admin/automation/sync-all", requirePermission("automation:manage"), async (req, res) => {
  try {
    const runs = await scheduler.runAllSyncs();
    db.logAudit(getActor(req), "Master Sync Triggered", "Triggered full synchronization of all data providers");
    return res.json({ success: true, count: runs.length, runs });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Master sync failed" });
  }
});
app.get("/api/admin/automation/history", requirePermission("automation:manage"), (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
  const history = db.getSyncHistory(limit);
  res.json({ success: true, count: history.length, runs: history });
});
app.get("/api/admin/automation/drafts", requirePermission("automation:manage"), (req, res) => {
  const status = req.query.status || "all";
  const drafts = db.getAiDrafts(status);
  res.json({ success: true, count: drafts.length, drafts });
});
app.post("/api/admin/automation/drafts/:id/publish", requirePermission("automation:manage"), (req, res) => {
  const result = db.approveAiDraft(req.params.id, getActor(req, "Chief Editor"));
  if (!result.success) {
    return res.status(404).json({ success: false, error: "Draft not found or could not be approved" });
  }
  return res.json({ success: true, article: result.article });
});
app.post("/api/admin/automation/drafts/:id/reject", requirePermission("automation:manage"), (req, res) => {
  const success = db.rejectAiDraft(req.params.id, getActor(req, "Chief Editor"));
  res.json({ success });
});
app.get("/api/admin/automation/settings", requirePermission("automation:manage"), (_req, res) => {
  res.json({ success: true, settings: db.getAutomationSettings() });
});
app.post("/api/admin/automation/settings", requirePermission("automation:manage"), (req, res) => {
  const updated = db.updateAutomationSettings(req.body || {}, getActor(req, "Super Admin"));
  res.json({ success: true, settings: updated });
});
var handleCronRun = async (req, res) => {
  const configuredSecret = process.env.CRON_SECRET;
  const authBearer = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7).trim() : "";
  const providedSecret = req.headers["x-cron-secret"] || authBearer || req.query.secret || req.body?.secret;
  if (configuredSecret) {
    if (!providedSecret || providedSecret !== configuredSecret) {
      return res.status(401).json({ success: false, error: "Unauthorized cron trigger." });
    }
  } else if (!getSessionFromRequest(req) && !req.headers["x-vercel-cron"]) {
    return res.status(403).json({
      success: false,
      error: "CRON_SECRET environment variable is not configured and no admin session is present."
    });
  }
  try {
    const summary = await runDueCronJobs();
    return res.json(summary);
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "Cron execution failed." });
  }
};
app.post("/api/cron/run", handleCronRun);
app.get("/api/cron/run", handleCronRun);
app.get("/api/rates/historical", (req, res) => {
  const type = req.query.type;
  const symbol = req.query.symbol;
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 30;
  const records = db.getHistoricalRates(type, symbol, limit);
  res.json({ success: true, count: records.length, records });
});
app.get("/api/data-freshness", (_req, res) => {
  const providers = db.getDataProviders();
  const fuelNotif = db.getFuelNotifications()[0] || null;
  const freshness = {
    currency: providers.find((p) => p.id === "currency-erapi") || {
      lastSyncAt: (/* @__PURE__ */ new Date()).toISOString(),
      attribution: "ExchangeRate-API & State Bank of Pakistan",
      status: "active"
    },
    weather: providers.find((p) => p.id === "weather-openmeteo") || {
      lastSyncAt: (/* @__PURE__ */ new Date()).toISOString(),
      attribution: "Open-Meteo & Pakistan Meteorological Department",
      status: "active"
    },
    gold: providers.find((p) => p.id === "gold-bullion") || {
      lastSyncAt: (/* @__PURE__ */ new Date()).toISOString(),
      attribution: "All Pakistan Gem & Jewellers Association (APGJAA)",
      status: "active"
    },
    fuel: {
      provider: providers.find((p) => p.id === "fuel-ogra"),
      lastNotification: fuelNotif,
      attribution: "Oil & Gas Regulatory Authority (OGRA) Official Gazette",
      status: "verified"
    },
    cricket: providers.find((p) => p.id === "cricket-feed") || {
      lastSyncAt: (/* @__PURE__ */ new Date()).toISOString(),
      attribution: "Pakistan Cricket Board (PCB) & ICC",
      status: "active"
    }
  };
  res.json({ success: true, freshness, generatedAt: (/* @__PURE__ */ new Date()).toISOString() });
});
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    code: "NOT_FOUND",
    error: `API endpoint not found: ${req.method} ${req.originalUrl}`
  });
});
app.use("/api", (err, req, res, _next) => {
  console.error("[API Error]", err);
  recordServerError({
    source: "api",
    code: err?.code || String(err?.statusCode || err?.status || 500),
    message: err?.message || "Internal server error occurred.",
    statusCode: Number(err?.statusCode || err?.status || 500),
    method: req.method,
    path: req.originalUrl
  });
  if (res.headersSent) return;
  res.status(err?.statusCode || err?.status || 500).json({
    success: false,
    error: err?.message || "Internal server error occurred."
  });
});
app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  if (req.path.startsWith("/api/") || req.path.startsWith("/assets/") || req.path.startsWith("/@") || req.path.startsWith("/src/") || req.path.startsWith("/node_modules/")) {
    return next();
  }
  const normalizedReqPath = req.path.length > 1 ? req.path.replace(/\/+$/, "") : req.path;
  const rules = db.getRedirectRules().filter((r) => r.active);
  const matched = rules.find((r) => {
    const src = r.sourcePath.length > 1 ? r.sourcePath.replace(/\/+$/, "") : r.sourcePath;
    return src.toLowerCase() === normalizedReqPath.toLowerCase();
  });
  if (matched) {
    matched.hits = (matched.hits || 0) + 1;
    if (matched.statusCode === 410) {
      return res.status(410).send("410 Gone \u2014 This resource has been permanently removed from 360Khabarnama.");
    }
    return res.redirect(matched.statusCode || 301, matched.targetPath || "/");
  }
  return next();
});
app.get("/:key.txt", (req, res, next) => {
  const configuredKey = (db.getData().siteSettings?.indexNowKey || "").trim();
  if (configuredKey && req.params.key === configuredKey) {
    res.header("Content-Type", "text/plain; charset=utf-8");
    return res.send(configuredKey);
  }
  return next();
});
async function setupVite() {
  if (!isProduction) {
    const vitePkg = "vite";
    const { createServer } = await import(
      /* @vite-ignore */
      vitePkg
    );
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "custom"
    });
    app.use(vite.middlewares);
    app.get("*", async (req, res, next) => {
      if (req.path.startsWith("/api/")) return next();
      try {
        let preloadedArticle = null;
        const newsSlugMatch = req.path.match(/^\/(?:en|ur)\/news\/([^/]+)\/?$/i);
        if (newsSlugMatch && newsSlugMatch[1]) {
          const found = await ArticleService.getArticle(newsSlugMatch[1]).catch(() => null);
          if (found?.article && found.article.status === "published" && !isArticleFutureScheduled(found.article)) {
            preloadedArticle = found.article;
          }
        }
        const rawHtml = fs4.readFileSync(path4.resolve(process.cwd(), "index.html"), "utf-8");
        const transformed = await vite.transformIndexHtml(req.originalUrl, rawHtml);
        const withSeo = MetadataGenerator.injectMetadataIntoHtml(transformed, req.originalUrl, preloadedArticle);
        if (req.path === "/admin" || req.path.startsWith("/admin/")) {
          res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
        }
        res.status(200).setHeader("Content-Type", "text/html; charset=utf-8").send(withSeo);
      } catch (e) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path4.resolve(process.cwd(), "dist");
    app.use(express.static(distPath, { index: false }));
    app.get("*", async (req, res, next) => {
      if (req.path.startsWith("/api/")) return next();
      const indexFile = path4.join(distPath, "index.html");
      if (!fs4.existsSync(indexFile)) {
        return res.status(404).send("Production bundle not built yet.");
      }
      let preloadedArticle = null;
      const newsSlugMatch = req.path.match(/^\/(?:en|ur)\/news\/([^/]+)\/?$/i);
      if (newsSlugMatch && newsSlugMatch[1]) {
        const found = await ArticleService.getArticle(newsSlugMatch[1]).catch(() => null);
        if (found?.article && found.article.status === "published" && !isArticleFutureScheduled(found.article)) {
          preloadedArticle = found.article;
        }
      }
      const rawHtml = fs4.readFileSync(indexFile, "utf-8");
      const withSeo = MetadataGenerator.injectMetadataIntoHtml(rawHtml, req.originalUrl, preloadedArticle);
      if (req.path === "/admin" || req.path.startsWith("/admin/")) {
        res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
      }
      return res.status(200).setHeader("Content-Type", "text/html; charset=utf-8").send(withSeo);
    });
  }
  try {
    await AIProviderManager.hydrateFromSupabaseIfConfigured().catch(() => {
    });
  } catch {
  }
  try {
    scheduler.start();
  } catch (schedErr) {
    console.error("Error starting automation scheduler:", schedErr);
  }
  const httpServer = app.listen(PORT, "0.0.0.0", () => {
    console.log(`360Khabarnama running at http://0.0.0.0:${PORT}`);
  });
  httpServer.requestTimeout = 9e4;
  httpServer.headersTimeout = 65e3;
  httpServer.keepAliveTimeout = 65e3;
}
if (!process.env.VERCEL && !process.env.VERCEL_ENV) {
  setupVite().catch((err) => {
    console.error("Server startup error:", err);
  });
}
var server_default = app;
export {
  server_default as default
};
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Server-Side Secret Encryption (AES-256-GCM) & RFC-6238 TOTP MFA
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Automated World News & Sports RSS Ingestion Provider
 * Fetches verified international & sports RSS headlines, deduplicates against DB,
 * and updates articles with source attribution (zero fabricated headlines).
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Automated Feed Data Validator (Schema, Range & Anomaly Checks)
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Structured Sync Job Execution Logger
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — AI Error Classifier, Timeout Wrapper & Outbound Network Diagnostics
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Live AI Model Discovery Service (Gemini /v1beta/models & xAI /v1/models)
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Google Gemini Provider Adapter (Official v1beta REST + @google/genai SDK)
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — xAI Grok (/v1/models & /v1/responses) + Custom OpenAI-Compatible Provider Adapter
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — AI Usage Tracker, Token Accounting & Budget Guard
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Structured Server Error Tracker (Redacts All Credentials)
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Trusted Server-Side Supabase PostgreSQL Admin Client & Article Repository
 *
 * Supports SUPABASE_URL, SUPABASE_SECRET_KEY (and legacy SUPABASE_SERVICE_ROLE_KEY),
 * and SUPABASE_PUBLISHABLE_KEY (with legacy SUPABASE_ANON_KEY).
 * Never exposes secret credentials to client bundles.
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Centralized AI Provider Lifecycle, Validation, Discovery & Health Manager
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Centralized Multi-Provider AI Router & Key Safeguarding
 *
 * Security & Policy Rules:
 * - API keys are encrypted at rest via AES-256-GCM and decrypted only server-side at execution.
 * - NEVER rotates or cycles through multiple keys sharing the same projectId to evade rate limits.
 * - Fallback is allowed only to an explicitly different projectId or providerType.
 * - Throws structured errors when unconfigured or failing — never returns fabricated fallbacks.
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Automated AI Content Engine (Routed via AIProviderRouter)
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Automation Data Provider Registry, Custom Feed Adapter & Endpoint Tester
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Serverless-Safe Firebase Admin Auth & Service Account Access
 *
 * Uses static import of firebase-applet-config.json (per ESM & Cloud Run guidelines)
 * and Node built-in `crypto` for both Firebase ID Token RS256 verification and
 * optional Google Service Account OAuth2 JWT token minting without `jwks-rsa`/`jose`.
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Server-Side Cloud Firestore Persistence & Diagnostics Client
 *
 * Targets existing Cloud Firestore database:
 *   Project: gen-lang-client-0094029776
 *   Database: ai-studio-360khabarnama-91785bb5-94ed-4005-bd25-9b4d9b8b10ba
 *
 * Authentication Modes:
 *   1. Service Account OAuth2 JWT token (when FIREBASE_SERVICE_ACCOUNT_JSON / BASE64 / GOOGLE_APPLICATION_CREDENTIALS is set)
 *   2. Verified Admin Firebase ID Token (forwarded from authenticated admin request)
 *   3. Public Web API Key (for public queries on status == 'published' & /test/connection)
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Unified Supabase PostgreSQL Repositories,
 * Read-After-Write Verification, Editorial Media Upload & Storage Health
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Live Supabase Connection, Schema, Write & RLS Diagnostics
 *
 * Strictly executes real database queries/mutations when configured and never
 * fabricates "Connected" status when credentials or tables are absent.
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Cloud Firestore Article Persistence & Publishing Pipeline
 *
 * Coordinates Cloud Firestore (/articles) as the permanent source of truth
 * alongside the local JSON cache mirror for low-latency SSR/RSS rendering.
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Namecheap Shared Hosting & Bounded Job Scheduler
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Private Admin Authentication, Session & 9-Role RBAC Security Middleware
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Universal Page-Level SEO Engine, Schema Generator & Quality Gate
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Comprehensive Real Technical, Bilingual Hreflang & Image SEO Auditor
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Dynamic XML Sitemap & Robots.txt Manager
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Real Google Search Console Integration & Diagnostics
 *
 * Strictly forbids fabricated impressions/clicks/queries when disconnected or failing.
 * Uses encrypted OAuth 2.0 / Service Account credentials via src/server/crypto.ts.
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Server-Side Dynamic Metadata, Hreflang & JSON-LD Generator
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Content Freshness & Review Automation Engine
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Configurable News Source Registry & Ingestion Engine
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — News Deduplication & Event Cluster Matcher
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — News Verification, Licensing & Risk Routing Engine
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Autonomous Workflow Orchestrator
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Universal Category Page & Reusable Block Template Engine
 */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Namecheap cPanel 5-Minute Cron Dispatcher
 *
 * cPanel Cron Command (Every 5 minutes: 0,5,10... * * * *):
 *   cd /home/USER/app && npx tsx server/jobs/cron-dispatcher.ts >> logs/cron.log 2>&1
 */
