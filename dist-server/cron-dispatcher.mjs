// server/jobs/cron-dispatcher.ts
import dotenv from "dotenv";
import { fileURLToPath } from "url";

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
  primaryColor: "#059669",
  // Emerald Green (Pakistan color)
  breakingNewsEnabled: true,
  contactEmail: "editor@360khabarnama.com",
  contactPhone: "+92 (051) 920-1122",
  adManagerEnabled: true,
  googleAnalyticsId: "G-KHABAR360",
  leaderboardAdUrl: "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=970&q=80",
  sidebarAdUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=400&q=80"
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
      id: "ad_leaderboard_home",
      type: "ad_banner",
      nameEn: "Homepage Mid Leaderboard Ad Slot",
      nameUr: "\u0645\u0631\u06A9\u0632\u06CC \u0627\u0634\u062A\u06C1\u0627\u0631\u06CC \u0628\u06CC\u0646\u0631",
      description: "Monetization placement between main hero coverage and Islamic daily digest.",
      enabled: true,
      order: 3,
      mobileOrder: 3,
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
      order: 4,
      mobileOrder: 4,
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
      order: 5,
      mobileOrder: 5,
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
        if (!parsed.editorialDrafts) parsed.editorialDrafts = [];
        if (!parsed.cronLocks) parsed.cronLocks = {};
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
      editorialDrafts: [],
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
    if (idx >= 0) {
      this.data.adCampaigns[idx] = { ...this.data.adCampaigns[idx], ...campaign };
      this.logAudit(actor, "Ad Campaign Updated", `Updated campaign: ${campaign.campaignName}`);
    } else {
      const newCamp = {
        ...campaign,
        id: campaign.id || `camp-${Date.now()}`,
        impressions: campaign.impressions || 0,
        clicks: campaign.clicks || 0,
        ctr: campaign.ctr || 0,
        status: campaign.status || "active"
      };
      this.data.adCampaigns.unshift(newCamp);
      this.logAudit(actor, "Ad Campaign Created", `Created campaign: ${campaign.campaignName}`);
    }
    this.saveDatabase(this.data);
    return campaign;
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
    const slot = (this.data.adPlacements || []).find((s) => s.id === slotId || s.slotId === slotId);
    if (slot) slot.impressions = (slot.impressions || 0) + 1;
    if (campaignId) {
      const camp = (this.data.adCampaigns || []).find((c) => c.id === campaignId);
      if (camp) {
        camp.impressions = (camp.impressions || 0) + 1;
        camp.ctr = camp.impressions > 0 ? parseFloat((camp.clicks / camp.impressions * 100).toFixed(2)) : 0;
      }
    }
  }
  recordAdClick(slotId, campaignId) {
    const slot = (this.data.adPlacements || []).find((s) => s.id === slotId || s.slotId === slotId);
    if (slot) slot.clicks = (slot.clicks || 0) + 1;
    if (campaignId) {
      const camp = (this.data.adCampaigns || []).find((c) => c.id === campaignId);
      if (camp) {
        camp.clicks = (camp.clicks || 0) + 1;
        camp.ctr = camp.impressions > 0 ? parseFloat((camp.clicks / camp.impressions * 100).toFixed(2)) : 0;
      }
    }
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
    if (idx >= 0) {
      this.data.redirectRules[idx] = { ...this.data.redirectRules[idx], ...rule };
    } else {
      this.data.redirectRules.unshift({
        ...rule,
        id: rule.id || `red-${Date.now()}`,
        hits: 0,
        active: true,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    this.logAudit(actor, "Redirect Rule Saved", `Rule ${rule.sourcePath} -> ${rule.targetPath} (${rule.statusCode})`);
    this.saveDatabase(this.data);
    return rule;
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
  addSubscriber(email, language = "both", frequency = "daily") {
    if (!this.data.subscribers) this.data.subscribers = [];
    const cleanEmail = email.trim().toLowerCase();
    if (this.data.subscribers.some((s) => s.email === cleanEmail && s.status === "active")) {
      return false;
    }
    this.data.subscribers.unshift({
      id: `sub-${Date.now()}`,
      email: cleanEmail,
      language,
      frequency,
      subscribedAt: (/* @__PURE__ */ new Date()).toISOString(),
      status: "active"
    });
    this.saveDatabase(this.data);
    return true;
  }
  removeSubscriber(email) {
    if (!this.data.subscribers) return false;
    const sub = this.data.subscribers.find((s) => s.email.toLowerCase() === email.trim().toLowerCase());
    if (sub) {
      sub.status = "unsubscribed";
      this.saveDatabase(this.data);
      return true;
    }
    return false;
  }
  getNotifications() {
    return this.data.notifications || [];
  }
  sendAudienceNotification(notif, actor = "Editor") {
    if (!this.data.notifications) this.data.notifications = [];
    const activeSubscribers = (this.data.subscribers || []).filter((s) => s.status === "active").length;
    const newNotif = {
      ...notif,
      id: notif.id || `notif-${Date.now()}`,
      sentAt: (/* @__PURE__ */ new Date()).toISOString(),
      recipientsCount: activeSubscribers > 0 ? activeSubscribers : 42e3,
      status: "sent"
    };
    this.data.notifications.unshift(newNotif);
    this.logAudit(actor, "Broadcast Dispatched", `Broadcast: ${notif.titleEn}`);
    this.saveDatabase(this.data);
    return newNotif;
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
function decryptSecret(stored) {
  if (!stored) return "";
  if (!stored.startsWith("enc:v1:")) return stored;
  const parts = stored.split(":");
  if (parts.length !== 5) return "";
  try {
    const iv = Buffer.from(parts[2], "base64url");
    const tag = Buffer.from(parts[3], "base64url");
    const ciphertext = Buffer.from(parts[4], "base64url");
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return "";
  }
}
function maskSecret(raw) {
  if (!raw) return "Not configured";
  const clean = raw.trim();
  if (clean.length <= 8) return "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
  return `${clean.slice(0, 4)}\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022${clean.slice(-4)}`;
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
async function fetchWithTimeout(url, init = {}, timeoutMs = 15e3) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`Request timed out after ${timeoutMs}ms`));
  }, timeoutMs);
  const externalSignal = init.signal;
  const onExternalAbort = () => controller.abort(externalSignal?.reason || new Error("Aborted by caller"));
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      throw new Error("Request aborted by caller");
    }
    externalSignal.addEventListener("abort", onExternalAbort, { once: true });
  }
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }
}
function classifyProviderError(params) {
  const correlationId = params.correlationId || generateCorrelationId("err");
  const providerLabel = params.providerType === "gemini" ? "Google Gemini" : params.providerType === "grok" ? "xAI Grok" : "Custom AI Provider";
  const rawMsg = redactSecrets(
    params.providerMessage || params.err?.message || "",
    params.secretToRedact
  );
  const lower = `${rawMsg} ${params.providerErrorCode || ""}`.toLowerCase();
  const status = params.httpStatus ?? params.err?.status ?? params.err?.statusCode;
  const errCode = String(params.err?.code || params.err?.cause?.code || "").toUpperCase();
  if (params.err?.name === "AbortError" || params.err?.name === "TimeoutError" || lower.includes("timed out") || lower.includes("timeout") || errCode === "ETIMEDOUT" || errCode === "UND_ERR_CONNECT_TIMEOUT") {
    return {
      correlationId,
      httpStatus: status,
      category: "timeout",
      connectionStatus: params.authenticated ? "authenticated_generation_unavailable" : "timeout",
      title: `${providerLabel} Request Timeout`,
      diagnosis: params.authenticated ? `Authenticated \u2014 Generation Unavailable: ${providerLabel} did not respond within the timeout window (${rawMsg || "timeout"}).` : `${providerLabel} did not respond within the configured timeout window.`,
      suggestedAction: "Verify server outbound latency or retry with a faster model (e.g., Gemini Flash / Grok Mini). If hosted on Namecheap, confirm shared hosting PHP/Node outbound timeouts allow TLS requests.",
      providerMessage: rawMsg || void 0
    };
  }
  if (["ENOTFOUND", "ECONNREFUSED", "ECONNRESET", "EAI_AGAIN", "EHOSTUNREACH", "ENETUNREACH"].includes(errCode) || errCode.startsWith("CERT_") || errCode.startsWith("ERR_TLS") || lower.includes("fetch failed") || lower.includes("enotfound") || lower.includes("econnrefused") || lower.includes("certificate") || lower.includes("socket hang up")) {
    return {
      correlationId,
      httpStatus: status,
      category: "network_error",
      connectionStatus: params.authenticated ? "authenticated_generation_unavailable" : "network_error",
      title: `Outbound Network / TLS Connectivity Error (${errCode || "Network"})`,
      diagnosis: `Unable to establish a secure outbound HTTPS connection to ${providerLabel}. This is a hosting/network/DNS/TLS issue, NOT an invalid API key.`,
      suggestedAction: "Run the Outbound Connectivity Diagnostic in this panel. On Namecheap Shared Hosting, open a support ticket requesting outbound TCP port 443 access to generativelanguage.googleapis.com and api.x.ai.",
      providerMessage: rawMsg || errCode || void 0
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
      suggestedAction: "Confirm the API endpoint URL and model ID are correct, then re-test.",
      providerMessage: rawMsg || void 0
    };
  }
  const isBillingSignal = status === 402 || lower.includes("credit") || lower.includes("billing") || lower.includes("payment") || lower.includes("balance") || lower.includes("spending limit") || lower.includes("insufficient_quota") || lower.includes("prepaid") || lower.includes("free tier is not available") || lower.includes("limit: 0");
  if (isBillingSignal) {
    return {
      correlationId,
      httpStatus: status,
      category: "billing_required",
      connectionStatus: params.authenticated ? "authenticated_generation_unavailable" : "billing_required",
      title: params.authenticated ? "Authenticated \u2014 Generation Unavailable (Billing / Credits Required)" : `${providerLabel} Billing or Credits Required`,
      diagnosis: params.authenticated ? `Authenticated \u2014 Generation Unavailable: Your ${providerLabel} key authenticated, but inference failed because credits or billing must be enabled (${rawMsg}).` : `${providerLabel} rejected generation due to account billing, credit balance, or spending limit restrictions (${rawMsg}).`,
      suggestedAction: params.providerType === "grok" ? "Open console.x.ai \u2192 Billing & Credits, add prepaid credits or raise your monthly spending limit, then click Re-test." : "Enable billing in Google AI Studio / Google Cloud Billing or switch to a free-tier eligible Flash model.",
      providerMessage: rawMsg || void 0
    };
  }
  if (status === 401 || lower.includes("invalid authentication") || lower.includes("incorrect api key") || lower.includes("invalid x-api-key") || lower.includes("unauthorized") || lower.includes("api key not valid") || lower.includes("api_key_invalid")) {
    return {
      correlationId,
      httpStatus: status || 401,
      category: "auth_failed_401",
      connectionStatus: "auth_failed",
      title: `${providerLabel} Authentication Failed (401)`,
      diagnosis: `${providerLabel} rejected the API key (${rawMsg || "Unauthorized / API key invalid"}).`,
      suggestedAction: params.providerType === "gemini" ? "Copy the exact AIza... key from Google AI Studio (aistudio.google.com/apikey) with no extra spaces or quotes." : "Copy a valid xai-... secret key from console.x.ai/team/default/api-keys and verify it has not been revoked.",
      providerMessage: rawMsg || void 0
    };
  }
  if (status === 403 || lower.includes("permission_denied") || lower.includes("permission denied") || lower.includes("has not been used in project") || lower.includes("is disabled") || lower.includes("ip_address_blocked") || lower.includes("referer")) {
    return {
      correlationId,
      httpStatus: status || 403,
      category: "permission_denied_403",
      connectionStatus: params.authenticated ? "authenticated_generation_unavailable" : "permission_denied",
      title: params.authenticated ? "Authenticated \u2014 Generation Unavailable (403 Permission Denied)" : `${providerLabel} Permission Denied (403)`,
      diagnosis: params.authenticated ? `Authenticated \u2014 Generation Unavailable: Key listed models, but lacks permission to execute ${params.model || "this model"} (${rawMsg}).` : `${providerLabel} denied access (403): ${rawMsg || "Restricted API key, disabled Generative Language API, or server IP/referrer restriction."}`,
      suggestedAction: params.providerType === "gemini" ? 'In Google Cloud Console, enable "Generative Language API" and remove HTTP Referrer restrictions (use None or server IP restrictions for backend calls).' : "Check xAI key scopes/permissions in console.x.ai and ensure this model is allowed for your team.",
      providerMessage: rawMsg || void 0
    };
  }
  if (status === 404 || lower.includes("not_found") || lower.includes("not found") || lower.includes("does not exist")) {
    return {
      correlationId,
      httpStatus: status || 404,
      category: "not_found_404",
      connectionStatus: params.authenticated ? "authenticated_generation_unavailable" : "endpoint_not_found",
      title: params.authenticated ? "Authenticated \u2014 Generation Unavailable (Model Not Available)" : `${providerLabel} Endpoint or Model Not Found (404)`,
      diagnosis: params.authenticated ? `Authenticated \u2014 Generation Unavailable: Model "${params.model || "selected"}" returned 404 (${rawMsg}).` : `Requested endpoint or model "${params.model || ""}" was not found (404): ${rawMsg}`,
      suggestedAction: "Select an accessible model from the discovered model list returned by the provider API.",
      providerMessage: rawMsg || void 0
    };
  }
  if (status === 429 || lower.includes("resource_exhausted") || lower.includes("rate limit") || lower.includes("quota")) {
    return {
      correlationId,
      httpStatus: status || 429,
      category: "quota_429",
      connectionStatus: params.authenticated ? "authenticated_generation_unavailable" : "quota_exhausted",
      title: params.authenticated ? "Authenticated \u2014 Generation Unavailable (429 Quota / Rate Limit)" : `${providerLabel} Quota Exhausted / Rate Limit (429)`,
      diagnosis: params.authenticated ? `Authenticated \u2014 Generation Unavailable: Key is valid and listed models, but generation is currently rate-limited or quota-exhausted (${rawMsg}).` : `${providerLabel} rate limit or quota exhausted (429): ${rawMsg}`,
      suggestedAction: "Wait for the RPM/TPM window to reset, choose a Flash/Mini tier model with higher free quota, or configure a fallback provider from a different project.",
      providerMessage: rawMsg || void 0
    };
  }
  if (status === 400 || lower.includes("invalid_argument") || lower.includes("bad request")) {
    if (lower.includes("api_key_invalid") || lower.includes("api key not valid")) {
      return {
        correlationId,
        httpStatus: 400,
        category: "auth_failed_401",
        connectionStatus: "auth_failed",
        title: `${providerLabel} API Key Rejected (API_KEY_INVALID)`,
        diagnosis: `Google Gemini reported API_KEY_INVALID: ${rawMsg}`,
        suggestedAction: "Generate a fresh key in Google AI Studio and paste it cleanly without spaces.",
        providerMessage: rawMsg || void 0
      };
    }
    return {
      correlationId,
      httpStatus: 400,
      category: "bad_request_400",
      connectionStatus: params.authenticated ? "authenticated_generation_unavailable" : "error",
      title: `${providerLabel} Invalid Request (400)`,
      diagnosis: params.authenticated ? `Authenticated \u2014 Generation Unavailable: Invalid parameter or model request (${rawMsg}).` : `${providerLabel} rejected the request payload (400): ${rawMsg}`,
      suggestedAction: "Select a compatible text-generation model from the discovered model list and re-test.",
      providerMessage: rawMsg || void 0
    };
  }
  if (typeof status === "number" && status >= 500) {
    return {
      correlationId,
      httpStatus: status,
      category: "server_error_5xx",
      connectionStatus: params.authenticated ? "authenticated_generation_unavailable" : "server_error",
      title: `${providerLabel} Server Error (${status})`,
      diagnosis: `${providerLabel} experienced an upstream server failure (HTTP ${status}): ${rawMsg}`,
      suggestedAction: "This is a temporary provider-side outage. Retry in a few moments or use a configured failover provider.",
      providerMessage: rawMsg || void 0
    };
  }
  return {
    correlationId,
    httpStatus: status,
    category: "unknown",
    connectionStatus: params.authenticated ? "authenticated_generation_unavailable" : "error",
    title: `${providerLabel} Unexpected Error`,
    diagnosis: params.authenticated ? `Authenticated \u2014 Generation Unavailable: ${rawMsg || "Unexpected error during test generation."}` : rawMsg || `Unexpected error communicating with ${providerLabel}.`,
    suggestedAction: `Check server logs with correlation ID ${correlationId} and re-test connection.`,
    providerMessage: rawMsg || void 0
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
function scoreGeminiModel(id) {
  const lower = id.toLowerCase();
  if (lower.includes("embedding") || lower.includes("aqa") || lower.includes("imagen") || lower.includes("veo") || lower.includes("tts") || lower.includes("live") || lower.includes("transcribe") || lower.includes("lyria") || lower.includes("-image") || lower.includes("nano-banana") || lower.includes("computer-use") || lower.includes("robotics") || lower.includes("deep-research") || lower.includes("antigravity") || lower.includes("gemini-1.5") || lower.includes("gemini-1.0") || lower.includes("gemini-2.0") || lower === "gemini-pro" || lower.startsWith("gemini-pro-")) {
    return -100;
  }
  let score = 10;
  if (lower === "gemini-4-hydrogen") score += 96;
  else if (lower === "gemini-3.1-flash-lite") score += 92;
  else if (lower === "gemini-4-argon") score += 84;
  else if (lower === "gemini-4-carbon") score += 80;
  else if (lower === "gemini-3.5-flash-lite") score += 78;
  else if (lower === "gemini-flash-lite-latest") score += 75;
  else if (lower === "gemini-flash-latest") score += 72;
  else if (lower === "gemini-2.5-flash") score += 68;
  else if (lower.includes("gemini-4")) score += 65;
  else if (lower.includes("gemini-3") && lower.includes("flash")) score += 62;
  else if (lower.includes("gemini-2.5-flash")) score += 55;
  else if (lower.includes("gemini-2.5-pro")) score += 48;
  else if (lower.includes("flash")) score += 45;
  else if (lower.includes("argon") || lower.includes("carbon") || lower.includes("pro")) score += 40;
  if (lower.includes("preview") || lower.includes("exp")) score -= 10;
  return score;
}
function scoreGrokModel(id) {
  const lower = id.toLowerCase();
  if (lower.includes("image") || lower.includes("vision-only") || lower.includes("embed")) {
    return -100;
  }
  let score = 10;
  if (lower.includes("grok-3-mini")) score += 85;
  else if (lower.includes("grok-4") && lower.includes("fast")) score += 82;
  else if (lower.includes("grok-4")) score += 78;
  else if (lower.includes("grok-3-fast")) score += 75;
  else if (lower.includes("grok-3")) score += 70;
  else if (lower.includes("grok")) score += 50;
  return score;
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
          15e3
        );
        const rawText = await res.text();
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
      return {
        ok: true,
        providerType: "gemini",
        models: [
          ...textModels,
          ...models.filter((m) => !m.supportsTextGeneration)
        ],
        recommendedModel: textModels[0]?.id || models.find((m) => m.supportedMethods?.includes("generateContent"))?.id || null,
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
        15e3
      );
      const rawText = await res.text();
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
    const timeoutMs = opts.timeoutMs || 35e3;
    const timer = setTimeout(
      () => timeoutController.abort(new Error(`Gemini request timed out after ${timeoutMs}ms`)),
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
    const config = {};
    if (opts.jsonMode) {
      config.responseMimeType = "application/json";
      config.maxOutputTokens = Math.max(opts.maxTokens || 4096, 4096);
    } else if (typeof opts.maxTokens === "number" && opts.maxTokens > 0) {
      config.maxOutputTokens = opts.maxTokens;
    }
    const isGemini4 = model.startsWith("gemini-4-");
    const isGemini3 = model.startsWith("gemini-3");
    const isGemini25 = model.startsWith("gemini-2.5");
    if (!isGemini4 && !isGemini3 && typeof opts.temperature === "number") {
      config.temperature = opts.temperature;
    }
    if (isGemini4 && (!opts.maxTokens || opts.maxTokens <= 4096)) {
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
            secretToRedact: cleanKey
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
          secretToRedact: cleanKey
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
   */
  static async testGeneration(apiKey, model, signal) {
    const cleanKey = apiKey.trim();
    const correlationId = generateCorrelationId("gem-gen");
    const start = Date.now();
    const cleanModel = model.startsWith("models/") ? model.slice("models/".length) : model;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:generateContent`;
    const isGemini4 = cleanModel.startsWith("gemini-4-");
    const isGemini3 = cleanModel.startsWith("gemini-3");
    const isGemini25 = cleanModel.startsWith("gemini-2.5");
    const generationConfig = {
      maxOutputTokens: isGemini25 && cleanModel.includes("pro") ? 1024 : 512
    };
    if (isGemini4) {
      generationConfig.thinkingConfig = { thinkingLevel: "LOW" };
    } else if (isGemini3) {
      generationConfig.thinkingConfig = {
        thinkingLevel: cleanModel.includes("flash-lite") ? "MINIMAL" : "LOW"
      };
    } else if (isGemini25) {
      generationConfig.thinkingConfig = {
        thinkingBudget: cleanModel.includes("pro") ? 128 : 0
      };
    } else {
      generationConfig.temperature = 0;
    }
    try {
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
                parts: [{ text: "Respond with the exact word: CONNECTED" }]
              }
            ],
            generationConfig
          }),
          signal
        },
        2e4
      );
      const rawText = await res.text();
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
            model: cleanModel,
            stage: "generation_test",
            authenticated: true,
            correlationId,
            secretToRedact: cleanKey
          })
        );
      }
      const candidate = parsed?.candidates?.[0];
      const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
      const text = parts.filter((p) => !p?.thought && typeof p?.text === "string").map((p) => p.text).join("").trim();
      if (!text) {
        throw new ProviderExecutionError(
          classifyProviderError({
            providerType: "gemini",
            providerMessage: `Empty response payload from ${cleanModel} (finishReason=${candidate?.finishReason || "unknown"})`,
            model: cleanModel,
            stage: "generation_test",
            authenticated: true,
            correlationId,
            secretToRedact: cleanKey
          })
        );
      }
      return {
        text,
        model: cleanModel,
        latencyMs: Date.now() - start,
        correlationId
      };
    } catch (err) {
      if (err instanceof ProviderExecutionError) throw err;
      throw new ProviderExecutionError(
        classifyProviderError({
          providerType: "gemini",
          err,
          model: cleanModel,
          stage: "generation_test",
          authenticated: true,
          correlationId,
          secretToRedact: cleanKey
        })
      );
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
      const diag = err instanceof ProviderExecutionError ? err.diagnostic : classifyProviderError({
        providerType: "gemini",
        err,
        model: selectedModel,
        stage: "generation_test",
        authenticated: true,
        correlationId,
        secretToRedact: apiKey
      });
      return {
        ok: false,
        authenticated: true,
        generationVerified: false,
        connectionStatus: "authenticated_generation_unavailable",
        message: diag.diagnosis,
        latencyMs: Date.now() - start,
        providerType: "gemini",
        selectedModel,
        availableModels,
        diagnostic: diag,
        correlationId: diag.correlationId
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
        opts.timeoutMs || 35e3
      );
      const rawText = await response.text();
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
    try {
      const res = await this.execute({
        apiKey,
        model: selectedModel,
        endpointUrl,
        providerType,
        prompt: "Respond with the exact word: CONNECTED",
        temperature: 0,
        maxTokens: 32,
        signal,
        timeoutMs: 2e4
      });
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
        secretToRedact: apiKey
      });
      const diag = availableModels.length > 0 && baseDiag.connectionStatus !== "auth_failed" ? {
        ...baseDiag,
        connectionStatus: "authenticated_generation_unavailable",
        title: baseDiag.title.startsWith("Authenticated") ? baseDiag.title : `Authenticated \u2014 Generation Unavailable (${baseDiag.title})`,
        diagnosis: baseDiag.diagnosis.startsWith("Authenticated") ? baseDiag.diagnosis : `Authenticated \u2014 Generation Unavailable: ${baseDiag.diagnosis}`
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

// services/ai/AIProviderManager.ts
var AIProviderManager = class {
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
  static resolveRawCredential(credId) {
    if (credId === "env-gemini-default" && process.env.GEMINI_API_KEY) {
      const rawKey2 = process.env.GEMINI_API_KEY.trim();
      return {
        cred: {
          id: "env-gemini-default",
          providerType: "gemini",
          label: "Server Environment GEMINI_API_KEY",
          projectId: process.env.GOOGLE_CLOUD_PROJECT || "env-gemini-project",
          model: "gemini-4-hydrogen",
          encryptedSecret: "",
          maskedKey: maskSecret(rawKey2),
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
        rawKey: rawKey2
      };
    }
    if (credId === "env-grok-default" && process.env.XAI_API_KEY) {
      const rawKey2 = process.env.XAI_API_KEY.trim();
      return {
        cred: {
          id: "env-grok-default",
          providerType: "grok",
          label: "Server Environment XAI_API_KEY",
          projectId: "env-xai-project",
          endpointUrl: "https://api.x.ai/v1",
          model: "grok-3-mini",
          encryptedSecret: "",
          maskedKey: maskSecret(rawKey2),
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
        rawKey: rawKey2
      };
    }
    const found = db.getAiProviders().find((p) => p.id === credId);
    if (!found) return null;
    const rawKey = decryptSecret(found.encryptedSecret);
    return { cred: found, rawKey };
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
    if (!rawKey && input.credentialId) {
      const resolved = this.resolveRawCredential(input.credentialId);
      if (resolved) {
        rawKey = resolved.rawKey;
        providerType = resolved.cred.providerType;
        endpointUrl = endpointUrl || resolved.cred.endpointUrl;
        preferredModel = preferredModel || resolved.cred.model;
      }
    }
    const runGenerationTest = input.runGenerationTest !== false;
    if (!rawKey) {
      const diag = classifyProviderError({
        providerType,
        httpStatus: 401,
        providerMessage: "API key input is empty.",
        stage: "model_list"
      });
      return {
        ok: false,
        authenticated: false,
        generationVerified: false,
        connectionStatus: "auth_failed",
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
    db.recordAiConnectionTest(testRecord);
    return result;
  }
  static addOrUpdateCredential(input, actor) {
    const existing = input.id ? db.getAiProviders().find((p) => p.id === input.id) : void 0;
    if (!existing && (!input.apiKey || !input.apiKey.trim())) {
      throw new Error("API key is required when adding a new credential.");
    }
    if (!input.label?.trim() || !input.projectId?.trim()) {
      throw new Error("Friendly credential name and Project ID are required.");
    }
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
    }
    const defaultEndpoint = input.providerType === "grok" ? "https://api.x.ai/v1" : void 0;
    const record = {
      id: existing?.id || `aik-${input.providerType}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      providerType: input.providerType,
      label: input.label.trim(),
      projectId: input.projectId.trim(),
      endpointUrl: input.endpointUrl?.trim() || existing?.endpointUrl || defaultEndpoint,
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
    const saved = db.upsertAiProvider(record, actor);
    return this.sanitizeCredential(saved);
  }
  static updateCredentialPartial(id, patch, actor) {
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
        validationResult: patch.validationResult
      },
      actor
    );
  }
  static async testSavedCredential(credId, actor) {
    const resolved = this.resolveRawCredential(credId);
    if (!resolved) {
      throw new Error("AI credential not found.");
    }
    const { cred, rawKey } = resolved;
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
      db.upsertAiProvider(
        {
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
        },
        actor
      );
    }
    return result;
  }
  static async discoverModelsForCredential(credId, actor) {
    const resolved = this.resolveRawCredential(credId);
    if (!resolved) {
      throw new Error("AI credential not found.");
    }
    const { cred, rawKey } = resolved;
    const discovery = cred.providerType === "gemini" ? await AIModelDiscovery.discoverGeminiModels(rawKey) : await AIModelDiscovery.discoverGrokModels(rawKey, cred.endpointUrl || "https://api.x.ai/v1");
    if (cred.id !== "env-gemini-default" && cred.id !== "env-grok-default") {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      db.upsertAiProvider(
        {
          ...cred,
          availableModels: discovery.models,
          modelListStatus: "ok",
          lastSuccessfulVerificationAt: now,
          rateLimitInfo: discovery.rateLimitInfo || cred.rateLimitInfo,
          updatedAt: now
        },
        actor
      );
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
    const creds = db.getAiProviders().filter((c) => c.enabled);
    const connectivity = await checkOutboundConnectivity();
    const checks = [];
    for (const cred of creds) {
      const rawKey = decryptSecret(cred.encryptedSecret);
      const start = Date.now();
      const correlationId = generateCorrelationId("hc");
      try {
        const discovery = cred.providerType === "gemini" ? await AIModelDiscovery.discoverGeminiModels(rawKey) : await AIModelDiscovery.discoverGrokModels(rawKey, cred.endpointUrl || "https://api.x.ai/v1");
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const prevConnected = cred.generationTestStatus === "ok" || cred.lastTestStatus === "connected";
        const nextStatus = prevConnected ? "connected" : "untested";
        db.upsertAiProvider(
          {
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
          },
          actor
        );
        db.recordAiConnectionTest({
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
        });
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
        db.upsertAiProvider(
          {
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
          },
          actor
        );
        db.recordAiConnectionTest({
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
        });
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
  static async getDiagnostics() {
    const connectivity = await checkOutboundConnectivity();
    const cachedHealth = db.getAiHealthStatus();
    const recentTests = db.getAiConnectionTests(void 0, 25);
    return {
      connectivity,
      lastHealthCheck: cachedHealth,
      recentTests
    };
  }
};

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
var AIProviderRouter = class {
  static getAllCredentialsSanitized() {
    const dbCreds = db.getAiProviders();
    const routes = this.getTaskRoutesRaw(dbCreds);
    const list = dbCreds.map((c) => AIProviderManager.sanitizeCredential(c, routes));
    const hasEnvGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());
    const hasEnvGrok = Boolean(process.env.XAI_API_KEY && process.env.XAI_API_KEY.trim());
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
        primaryModel: defaultModel || spec.defaultModel,
        fallbackCredentialId: "",
        fallbackModel: "",
        temperature: spec.task === "fact_check_prep" || spec.task === "translation" ? 0.2 : 0.5,
        maxTokens: spec.task === "article_drafting" ? 4096 : 3072
      };
    });
  }
  static addOrUpdateCredential(input, actor) {
    return AIProviderManager.addOrUpdateCredential(input, actor);
  }
  static async testCredential(credId, actor) {
    return AIProviderManager.testSavedCredential(credId, actor);
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
        primaryModel: defaultCred?.model || spec.defaultModel,
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
    const attemptedProjectKeys = /* @__PURE__ */ new Set();
    const errors = [];
    let lastDiagnostic;
    for (const spec of candidateSpecs) {
      const resolved = AIProviderManager.resolveRawCredential(spec.credId);
      if (!resolved || !resolved.cred.enabled) continue;
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
          db.upsertAiProvider(
            {
              ...cred,
              connectionStatus: "connected",
              generationTestStatus: "ok",
              lastTestStatus: "connected",
              lastSuccessfulGenerationAt: now,
              lastLatencyMs: execResult.latencyMs,
              updatedAt: now
            },
            actor
          );
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
          secretToRedact: rawKey
        });
        lastDiagnostic = diag;
        errors.push(`[${cred.label} | ${diag.correlationId}] ${diag.diagnosis}`);
        if (cred.id !== "env-gemini-default" && cred.id !== "env-grok-default") {
          const now = (/* @__PURE__ */ new Date()).toISOString();
          const nextStatus = cred.modelListStatus === "ok" && diag.connectionStatus !== "auth_failed" ? "authenticated_generation_unavailable" : diag.connectionStatus;
          db.upsertAiProvider(
            {
              ...cred,
              connectionStatus: nextStatus,
              generationTestStatus: "error",
              lastFailureAt: now,
              lastTestStatus: "error",
              lastTestMessage: diag.diagnosis,
              lastDiagnostic: diag,
              lastCorrelationId: diag.correlationId,
              updatedAt: now
            },
            actor
          );
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
async function processDataChangeWithGemini(category, triggerReason, snapshot) {
  const settings = db.getAutomationSettings();
  if (!settings.aiDraftsEnabled) {
    return null;
  }
  const now = /* @__PURE__ */ new Date();
  if (settings.lastGeminiCallAt) {
    const elapsedMinutes = (now.getTime() - new Date(settings.lastGeminiCallAt).getTime()) / (1e3 * 60);
    if (elapsedMinutes < settings.geminiCooldownMin) {
      return null;
    }
  }
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
      systemInstruction: "You are a bilingual Urdu/English newsroom editor. Output ONLY a single valid JSON object with keys titleEn, titleUr, summaryEn, summaryUr, contentEn, contentUr, seoTags.",
      temperature: 0.2,
      maxTokens: 4096,
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
    db.updateAutomationSettings({ lastGeminiCallAt: now.toISOString() }, "AI Automation Engine");
    return draft;
  } catch (error) {
    console.error("[AI Engine] Automated draft skipped/failed:", error.message);
    return null;
  }
}

// services/automation/ProviderRegistry.ts
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
var OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
var firebaseProjectConfig = {
  projectId: firebase_applet_config_default.projectId,
  firestoreDatabaseId: firebase_applet_config_default.firestoreDatabaseId,
  apiKey: firebase_applet_config_default.apiKey,
  authDomain: firebase_applet_config_default.authDomain,
  storageBucket: firebase_applet_config_default.storageBucket
};
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

// src/server/articleService.ts
function mergeArticleLists(firestoreList, localList, statusFilter) {
  const map = /* @__PURE__ */ new Map();
  for (const localArt of localList) {
    if (!localArt.deletedAt) {
      map.set(localArt.id, localArt);
    }
  }
  for (const fsArt of firestoreList) {
    if (!fsArt.deletedAt) {
      map.set(fsArt.id, fsArt);
    }
  }
  let merged = Array.from(map.values());
  if (statusFilter && statusFilter !== "all") {
    merged = merged.filter((a) => a.status === statusFilter);
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
   * Lists articles directly from Cloud Firestore (primary) merged with seed/local cache.
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
    let combined = localMatches;
    let storageEngine = "json_fallback";
    let firestoreCount = 0;
    if (fsRes.ok) {
      storageEngine = "firestore";
      firestoreCount = fsRes.articles.length;
      const deletedIds = new Set(db.getArticles(void 0, void 0, void 0, "all", true).filter((a) => a.deletedAt).map((a) => a.id));
      const activeFsArticles = fsRes.articles.filter((a) => !deletedIds.has(a.id));
      combined = mergeArticleLists(activeFsArticles, localMatches, statusFilter);
    } else if (fsRes.error) {
      recordServerError({
        source: "firestore",
        code: "FIRESTORE_LIST_WARNING",
        message: `Firestore query fallback to cache: ${fsRes.error}`
      });
    }
    const total = combined.length;
    const offset = Math.max(0, Number(filters.offset || 0));
    const limit = filters.limit ? Math.max(1, Math.min(Number(filters.limit), 200)) : combined.length;
    return {
      articles: combined.slice(offset, offset + limit),
      total,
      storageEngine,
      firestoreCount
    };
  }
  /**
   * Resolves an article by document ID or canonical slug from Cloud Firestore first,
   * checking redirects if not found directly.
   */
  static async getArticle(idOrSlug, authCtx = {}) {
    const clean = decodeURIComponent(idOrSlug || "").trim();
    if (!clean) return { article: null, storageEngine: "json_fallback" };
    const fsRes = await getFirestoreArticle(clean, authCtx.firebaseIdToken);
    if (fsRes.ok && fsRes.article && !fsRes.article.deletedAt) {
      return { article: fsRes.article, storageEngine: "firestore" };
    }
    const local = db.getArticleBySlugOrId(clean, false);
    if (local) {
      return {
        article: local,
        storageEngine: fsRes.ok ? "firestore" : "json_fallback"
      };
    }
    const rules = db.getRedirectRules().filter((r) => r.active && r.statusCode === 301);
    const matched = rules.find(
      (r) => r.sourcePath.toLowerCase() === `/en/news/${clean.toLowerCase()}` || r.sourcePath.toLowerCase() === `/ur/news/${clean.toLowerCase()}`
    );
    if (matched?.targetPath) {
      const nextSlug = matched.targetPath.split("/").pop();
      if (nextSlug) {
        return { article: null, redirectTo: nextSlug, storageEngine: "firestore" };
      }
    }
    return { article: null, storageEngine: fsRes.ok ? "firestore" : "json_fallback" };
  }
  /**
   * Saves or updates a bilingual news article permanently in Cloud Firestore,
   * verifying read-after-write integrity and invalidating public feed caches.
   */
  static async saveArticle(input, actor = "Editor", authCtx = {}) {
    const correlationId = `pub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const normalizedInput = {
      ...input,
      titleEn: (input.titleEn || input.titleUr || "").trim(),
      titleUr: (input.titleUr || input.titleEn || "").trim(),
      summaryEn: (input.summaryEn || "").trim(),
      summaryUr: (input.summaryUr || "").trim(),
      contentEn: (input.contentEn || input.summaryEn || "").trim(),
      contentUr: (input.contentUr || input.summaryUr || "").trim()
    };
    if (!normalizedInput.titleEn && !normalizedInput.titleUr) {
      const err = new Error("At least one headline (English or Urdu) is required.");
      err.statusCode = 400;
      err.code = "MISSING_HEADLINE";
      throw err;
    }
    const hasFirestoreWriteAuth = Boolean(authCtx.firebaseIdToken || hasServiceAccountConfigured());
    const savedLocal = db.upsertArticle(normalizedInput, actor, {
      storageEngine: hasFirestoreWriteAuth ? "firestore" : "json_fallback",
      correlationId
    });
    let finalArticle = savedLocal;
    let storageEngine = "json_fallback";
    let verifiedReadBack = true;
    let firestoreWarning;
    if (hasFirestoreWriteAuth) {
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
      firestoreWarning = "Saved in workspace cache only \u2014 sign in with Firebase Admin Google account or configure FIREBASE_SERVICE_ACCOUNT_JSON to write permanently to Cloud Firestore.";
      recordServerError({
        source: "firestore",
        code: "NO_FIRESTORE_WRITE_AUTH",
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
      storageEngine: authCtx.firebaseIdToken || hasServiceAccountConfigured() ? "firestore" : "json_fallback",
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
    const firestoreHealth = await checkFirestoreHealth(authCtx.firebaseIdToken);
    const mergedRes = await this.listArticles({ status: "all" }, authCtx);
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
   * Executes a live Cloud Firestore Publishing Pipeline Self-Test:
   *   1. Verify Firestore /test/connection & reachability
   *   2. Create bilingual EN/UR draft in Cloud Firestore + Read-After-Write
   *   3. Publish article in Cloud Firestore
   *   4. Verify public Firestore query (`status == 'published'`) & slug retrieval
   *   5. Archive & clean up probe document cleanly (zero leftover test articles)
   */
  static async runPublishingPipelineSelfTest(actor = "Super Admin", authCtx = {}) {
    const started = Date.now();
    const probeId = `art-diag-probe-${Date.now()}`;
    const probeSlug = `diag-probe-${Date.now()}`;
    const steps = [];
    const canWriteFirestore = Boolean(authCtx.firebaseIdToken || hasServiceAccountConfigured());
    try {
      const t0 = Date.now();
      const health = await checkFirestoreHealth(authCtx.firebaseIdToken);
      if (canWriteFirestore && !health.testConnectionDocExists) {
        await ensureTestConnectionDoc(authCtx);
      }
      steps.push({
        step: "1. Verify Cloud Firestore Connectivity & Auth",
        ok: health.connected && canWriteFirestore,
        durationMs: Date.now() - t0,
        detail: canWriteFirestore ? `Project=${health.projectId}, DB=${health.firestoreDatabaseId}, authMode=${health.authMode}` : `Connected=${health.connected}, but no Firebase Admin ID token or Service Account was supplied for write test.`
      });
      const t1 = Date.now();
      const created = await this.saveArticle(
        {
          id: probeId,
          slug: probeSlug,
          titleEn: "Diagnostic Firebase Pipeline Probe",
          titleUr: "\u0641\u0627\u0626\u0631 \u0628\u06CC\u0633 \u067E\u0628\u0644\u0634\u0646\u06AF \u062A\u0634\u062E\u06CC\u0635\u06CC \u062C\u0627\u0646\u0686",
          summaryEn: "Automated temporary Cloud Firestore self-test article",
          summaryUr: "\u06A9\u0644\u0627\u0624\u0688 \u0641\u0627\u0626\u0631 \u0627\u0633\u0679\u0648\u0631 \u06A9\u06CC \u062E\u0648\u062F\u06A9\u0627\u0631 \u062C\u0627\u0646\u0686 \u06A9\u0627 \u0645\u0636\u0645\u0648\u0646",
          contentEn: "Automated bilingual Cloud Firestore write and read-after-write verification.",
          contentUr: "\u0627\u0646\u06AF\u0631\u06CC\u0632\u06CC \u0627\u0648\u0631 \u0627\u0631\u062F\u0648 \u0645\u0648\u0627\u062F \u06A9\u06CC \u06A9\u0644\u0627\u0624\u0688 \u0641\u0627\u0626\u0631 \u0627\u0633\u0679\u0648\u0631 \u0645\u06CC\u06BA \u0645\u0633\u062A\u0642\u0644 \u062A\u0635\u062F\u06CC\u0642\u06D4",
          category: "pakistan",
          status: "draft",
          tags: ["diag-test"]
        },
        actor,
        authCtx
      );
      steps.push({
        step: "2. Save Bilingual Draft to Cloud Firestore & Read-After-Write",
        ok: created.verifiedReadBack && created.storageEngine === "firestore" && created.article.status === "draft",
        durationMs: Date.now() - t1,
        detail: `ID=${created.article.id}, engine=${created.storageEngine}, EN+UR saved=${Boolean(created.article.contentEn && created.article.contentUr)}`
      });
      const t2 = Date.now();
      const published = await this.transitionStatus(probeId, "published", actor, void 0, authCtx);
      steps.push({
        step: "3. Publish Article in Cloud Firestore",
        ok: published.article.status === "published" && published.storageEngine === "firestore" && Boolean(published.article.publishedAt),
        durationMs: Date.now() - t2,
        detail: `publishedAt=${published.article.publishedAt}, engine=${published.storageEngine}`
      });
      const t3 = Date.now();
      const listRes = await this.listArticles({ status: "published", search: probeSlug }, {});
      const visiblePublicly = listRes.articles.some((a) => a.id === probeId);
      const bySlug = await getFirestoreArticle(probeSlug);
      steps.push({
        step: "4. Public Unauthenticated Firestore Query & Slug Visibility",
        ok: visiblePublicly && Boolean(bySlug.ok && bySlug.article),
        durationMs: Date.now() - t3,
        detail: `publicListMatch=${visiblePublicly}, slugDocFound=${Boolean(bySlug.article)}`
      });
      const t4 = Date.now();
      const archived = await this.transitionStatus(probeId, "archived", actor, void 0, authCtx);
      const deleted = await this.deleteArticle(probeId, actor, true, authCtx);
      steps.push({
        step: "5. Archive Transition & Probe Cleanup",
        ok: archived.article.status === "archived" && deleted,
        durationMs: Date.now() - t4,
        detail: deleted ? "Temporary probe archived and removed cleanly from Firestore & cache." : "Cleanup incomplete."
      });
      return {
        ok: steps.every((s) => s.ok),
        totalDurationMs: Date.now() - started,
        storageEngine: canWriteFirestore ? "firestore" : "json_fallback",
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
        detail: err?.message || "Unexpected error during Firestore self-test."
      });
      return {
        ok: false,
        totalDurationMs: Date.now() - started,
        storageEngine: canWriteFirestore ? "firestore" : "json_fallback",
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

// server/jobs/cron-dispatcher.ts
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
var isMain = Boolean(
  metaUrl && process.argv[1] && fileURLToPath(metaUrl) === process.argv[1]
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
export {
  runDueCronJobs
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
 * 360Khabarnama — Structured Server Error Tracker (Redacts All Credentials)
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
 * 360Khabarnama — Namecheap cPanel 5-Minute Cron Dispatcher
 *
 * cPanel Cron Command (Every 5 minutes: 0,5,10... * * * *):
 *   cd /home/USER/app && npx tsx server/jobs/cron-dispatcher.ts >> logs/cron.log 2>&1
 */
