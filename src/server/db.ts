import fs from 'fs';
import path from 'path';
import {
  Article,
  Category,
  EducationBoard,
  ExamResult,
  WeatherData,
  GoldRate,
  CurrencyRate,
  FuelPrice,
  PSXData,
  CricketMatch,
  PrayerTimeData,
  MobilePhone,
  Automobile,
  PrizeBondDraw,
  DictionaryEntry,
  BabyName,
  Poet,
  Poem,
  Recipe,
  JobListing,
  SiteSettings,
  AuditLog,
  AdminUser,
  MediaAsset,
  SeoPageConfig,
  SearchConsoleMetrics,
  RedirectRule,
  BrokenLinkReport,
  AdPlacement,
  AdCampaign,
  NewsletterSubscriber,
  AudienceNotification,
  WebPushSubscription,
  HomepageLayoutConfig,
  ArticleVersion,
  SystemHealthReport
} from '../types/index.ts';
import {
  DataProvider,
  SyncJobRun,
  HistoricalRateRecord,
  FuelPriceNotification,
  AiContentDraft,
  AutomationSettings
} from './automation/types.ts';

const SEED_DATA_DIR = path.resolve(process.cwd(), 'data');
const SEED_DB_FILE = path.join(SEED_DATA_DIR, 'portal_database.json');
const DATA_DIR = process.env.VERCEL ? '/tmp/360khabarnama_data' : SEED_DATA_DIR;
const DB_FILE = path.join(DATA_DIR, 'portal_database.json');

interface DatabaseSchema {
  articles: Article[];
  categories: Category[];
  boards: EducationBoard[];
  results: ExamResult[];
  weather: WeatherData[];
  goldRates: GoldRate[];
  currencyRates: CurrencyRate[];
  fuelPrices: FuelPrice[];
  psx: PSXData;
  cricketMatches: CricketMatch[];
  prayerTimes: Record<string, PrayerTimeData>;
  mobiles: MobilePhone[];
  automobiles: Automobile[];
  prizeBonds: PrizeBondDraw[];
  dictionary: DictionaryEntry[];
  babyNames: BabyName[];
  poets: Poet[];
  poems: Poem[];
  recipes: Recipe[];
  jobs: JobListing[];
  epaperPages?: any[];
  siteSettings: SiteSettings;
  auditLogs: AuditLog[];
  dataProviders: DataProvider[];
  syncJobRuns: SyncJobRun[];
  historicalRates: HistoricalRateRecord[];
  fuelPriceNotifications: FuelPriceNotification[];
  aiContentDrafts: AiContentDraft[];
  automationSettings: AutomationSettings;
  adminUsers: AdminUser[];
  mediaAssets: MediaAsset[];
  adPlacements: AdPlacement[];
  adCampaigns: AdCampaign[];
  seoPages: SeoPageConfig[];
  searchConsole: SearchConsoleMetrics;
  redirectRules: RedirectRule[];
  brokenLinks: BrokenLinkReport[];
  subscribers: NewsletterSubscriber[];
  notifications: AudienceNotification[];
  pushSubscriptions?: WebPushSubscription[];
  vapidKeys?: { publicKey: string; privateKey: string };
  homepageConfig: HomepageLayoutConfig;
}

// Initial Seed Data
const defaultCategories: Category[] = [
  { id: '1', slug: 'pakistan', nameEn: 'Pakistan', nameUr: 'پاکستان', descriptionEn: 'National and provincial news across Pakistan', descriptionUr: 'ملک بھر سے اہم قومی و صوبائی خبریں', iconName: 'Flag' },
  { id: '2', slug: 'politics', nameEn: 'Politics', nameUr: 'سیاست', descriptionEn: 'Political updates, parliament, and national affairs', descriptionUr: 'سیاسی صورتحال، پارلیمنٹ اور حکومتی فیصلے', iconName: 'Building' },
  { id: '3', slug: 'business', nameEn: 'Business & Economy', nameUr: 'معیشت و تجارت', descriptionEn: 'Financial markets, inflation, trade and economy', descriptionUr: 'اسٹاک مارکیٹ، روپے کی قدر اور ملکی معیشت', iconName: 'TrendingUp' },
  { id: '4', slug: 'sports', nameEn: 'Sports & Cricket', nameUr: 'کھیل و کرکٹ', descriptionEn: 'Cricket, PSL, hockey, and international sports', descriptionUr: 'کرکٹ، پی ایس ایل، ہاکی اور بین الاقوامی کھیل', iconName: 'Trophy' },
  { id: '5', slug: 'education', nameEn: 'Education', nameUr: 'تعلیم و امتحانات', descriptionEn: 'BISE board results, admissions and universities', descriptionUr: 'تعلیمی بورڈز کے نتائج، امتحانات اور وظائف', iconName: 'GraduationCap' },
  { id: '6', slug: 'technology', nameEn: 'Tech & Mobiles', nameUr: 'ٹیکنالوجی و موبائلز', descriptionEn: 'Smartphone reviews, gadgets and AI developments', descriptionUr: 'جدید اسمارٹ فونز، آئی ٹی اور سائنسی خبریں', iconName: 'Cpu' },
  { id: '7', slug: 'world', nameEn: 'World News', nameUr: 'عالمی خبریں', descriptionEn: 'International affairs and global geopolitical events', descriptionUr: 'بین الاقوامی امور اور عالمی سیاست', iconName: 'Globe' },
  { id: '8', slug: 'entertainment', nameEn: 'Entertainment', nameUr: 'شوبز و تفریح', descriptionEn: 'Dramas, cinema, music and celebrity updates', descriptionUr: 'ڈرامے، فلمیں، موسیقی اور شوبز شخصیات', iconName: 'Film' },
  { id: '9', slug: 'islamic', nameEn: 'Islamic Life', nameUr: 'اسلامی دنیا', descriptionEn: 'Prayer times, Quran, Hadith, Duas & Zakat', descriptionUr: 'اوقاتِ نماز، قرآن، احادیث اور زکوٰۃ گائیڈ', iconName: 'Moon' },
  { id: '10', slug: 'health', nameEn: 'Health & Science', nameUr: 'صحت و طب', descriptionEn: 'Wellness, medical advice and healthcare tips', descriptionUr: 'طبی مشورے، صحت مند طرزِ زندگی اور ادویات', iconName: 'HeartPulse' }
];

const defaultArticles: Article[] = [
  {
    id: 'art-1',
    slug: 'pakistan-economic-reforms-psx-record-high-2026',
    titleEn: 'PSX Crosses Record Milestone as Economic Confidence Strengthens in Pakistan',
    titleUr: 'پاکستان اسٹاک ایکسچینج میں زبردست تیزی، انڈیکس تاریخ کی نئی بلندی پر پہنچ گیا',
    summaryEn: 'The Pakistan Stock Exchange (PSX) KSE-100 index rallied over 850 points on strong institutional buying and macroeconomic stability.',
    summaryUr: 'پاکستان اسٹاک ایکسچینج میں کاروبار کے آغاز پر ہی زبردست تیزی دیکھنے میں آئی اور 100 انڈیکس میں تاریخی اضافہ ریکارڈ کیا گیا۔',
    contentEn: `The Pakistan Stock Exchange (PSX) benchmark KSE-100 index witnessed unprecedented bullish momentum on Thursday, surging past key resistance levels amidst renewed foreign investor inflows and solid progress on macroeconomic structural reforms.\n\nMarket analysts attributed the sharp upward trajectory to declining inflation indicators, improved foreign exchange reserves with the State Bank of Pakistan (SBP), and consistent remittances from overseas Pakistanis. Major blue-chip stocks in the banking, fertilizer, energy, and information technology sectors spearheaded the rally.\n\n"The market's confidence is rooted in fiscal discipline and bilateral agreements that have significantly reduced sovereign risk premiums," stated a leading equity strategist at Karachi Financial Tower.\n\nThe business community has welcomed the developments, highlighting that stable currency valuations and lower lending rates will unlock long-term manufacturing investments across industrial hubs in Karachi, Lahore, and Faisalabad.`,
    contentUr: `پاکستان اسٹاک ایکسچینج (پی ایس ایکس) میں جمعرات کو کاروبار کے دوران زبردست تیزی دیکھی گئی، جہاں کے ایس ای 100 انڈیکس ملکی تاریخ کے اہم ریکارڈ کو عبور کر گیا۔ مارکیٹ میں مقامی اور غیر ملکی سرمایہ کاروں کی بھرپور خریداری نے تیزی کو تقویت دی۔\n\nماہرینِ معاشیات کے مطابق مہنگائی کی شرح میں مسلسل کمی، اسٹیٹ بینک آف پاکستان کے زرِمبادلہ کے ذخائر میں بہتری اور اوورسیز پاکستانیوں کی جانب سے ترسیلاتِ زر میں اضافے نے مارکیٹ کے اعتماد میں اضافہ کیا ہے۔ خاص طور پر بینکنگ، آئل اینڈ گیس، کھاد اور آئی ٹی سیکٹرز کے شیئرز میں نمایاں اضافہ ریکارڈ کیا گیا۔\n\nکاروباری برادری نے روپے کی قدر میں استحکام اور مارک اپ ریٹس میں متوقع کمی کو سراہتے ہوئے کہا کہ اس سے کراچی، لاہور اور فیصل آباد جیسے صنعتی شہروں میں پیداواری سرگرمیاں تیز ہوں گی۔`,
    category: 'business',
    tags: ['PSX', 'Economy', 'Finance', 'SBP', 'Investment'],
    author: {
      id: 'auth-1',
      nameEn: 'Tariq Mahmood',
      nameUr: 'طارق محمود',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      role: 'Chief Financial Correspondent'
    },
    publishedAt: '2026-11-06T08:30:00Z',
    updatedAt: '2026-11-06T09:15:00Z',
    views: 14200,
    status: 'published',
    heroImage: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80',
    imageCaptionEn: 'Trading activity at Pakistan Stock Exchange in Karachi.',
    imageCaptionUr: 'کراچی میں پاکستان اسٹاک ایکسچینج میں تجارتی سرگرمیاں۔',
    isBreaking: true,
    isFeatured: true,
    isTrending: true,
    readingTimeMin: 4
  },
  {
    id: 'art-2',
    slug: 'pakistan-cricket-champions-trophy-preparation-squad',
    titleEn: 'National Cricket Team Gearing Up for ICC Champions Trophy: Fast Bowlers in Form',
    titleUr: 'آئی سی سی چیمپئنز ٹرافی: قومی کرکٹ ٹیم کی تیاریاں عروج پر، فاسٹ بولرز بھرپور فارم میں',
    summaryEn: 'National cricket selectors and head coaches review player fitness and match strategies ahead of the mega tournament in Pakistan.',
    summaryUr: 'پاکستان میں ہونے والے بین الاقوامی ایونٹ کے لیے قومی اسکواڈ کی بھرپور مشقیں جاری، کھلاڑی بہترین کارکردگی دکھانے کے لیے پُرعزم۔',
    contentEn: `The Pakistan national cricket team underwent rigorous fielding drills and high-intensity net sessions at the National Cricket Academy in Lahore today as preparations for the premier ICC championship entered the final stretch.\n\nShaheen Shah Afridi, Naseem Shah, and Haris Rauf demonstrated lethal pace during afternoon training, while Babar Azam and Mohammad Rizwan spent extended hours mastering stroke-play against spin bowling.\n\nHead Coach addressed the media in a post-practice briefing: "Our squad depth is exceptional right now. The boys have adapted brilliantly to the conditions and the home crowd support in Rawalpindi, Lahore, and Karachi will be our biggest strength."\n\nTickets for the opening fixture sold out within hours of the official portal release, reflecting immense passion from cricket enthusiasts across the country.`,
    contentUr: `پاکستان کی قومی کرکٹ ٹیم نے آج لاہور کی نیشنل کرکٹ اکیڈمی میں سخت ٹریننگ سیشن میں حصہ لیا جہاں فیلڈنگ اور بولنگ کی مشقیں کی گئیں۔ میگا ایونٹ کی میزبانی کے پیشِ نظر کھلاڑیوں کی فٹنس پر خصوصی توجہ دی جا رہی ہے۔\n\nشاہین شاہ آفریدی، نسیم شاہ اور حارث رؤف نے تیز رفتار یارکرز اور باؤنسرز کی مشق کی جبکہ بابر اعظم اور محمد رضوان نے نیٹ پر اسپن بولرز کے خلاف طویل وقت گزارا۔\n\nپریس کانفرنس کرتے ہوئے ہیڈ کوچ نے کہا کہ ٹیم کا مورال انتہائی بلند ہے اور ہوم گراؤنڈ پر ملکی شائقین کی بھرپور حمایت کھلاڑیوں کے جذبے کو مزید بڑھائے گی۔ راولپنڈی اور لاہور میں شیڈول میچز کے ٹکٹ پہلے ہی چند گھنٹوں میں فروخت ہو چکے ہیں۔`,
    category: 'sports',
    tags: ['Cricket', 'PCB', 'ChampionsTrophy', 'BabarAzam', 'Sports'],
    author: {
      id: 'auth-2',
      nameEn: 'Zainab Abbas Khan',
      nameUr: 'زینب عباس خان',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80',
      role: 'Senior Sports Editor'
    },
    publishedAt: '2026-11-06T07:15:00Z',
    updatedAt: '2026-11-06T07:45:00Z',
    views: 18950,
    status: 'published',
    heroImage: 'https://images.unsplash.com/photo-1531415074868-036b1c57e329?auto=format&fit=crop&w=1200&q=80',
    imageCaptionEn: 'Pakistan cricket team practice session at Gaddafi Stadium.',
    imageCaptionUr: 'قذافی اسٹیڈیم لاہور میں قومی کرکٹرز کا پریکٹس سیشن۔',
    isBreaking: false,
    isFeatured: true,
    isTrending: true,
    readingTimeMin: 3
  },
  {
    id: 'art-3',
    slug: 'federal-cabinet-approves-nationwide-digital-id-and-green-energy-subsidy',
    titleEn: 'Federal Government Unveils Landmark Solar Energy Subsidy Scheme for Low-Income Households',
    titleUr: 'حکومت کا کم آمدنی والے گھرانوں کے لیے سولر انرجی سبسڈی اسکیم کا بڑا اعلان',
    summaryEn: 'Prime Minister announces solar panel financing at 0% markup and automated electricity meter upgrades across all four provinces.',
    summaryUr: 'وزیراعظم کا مستحق خاندانوں کو بلا سود سولر پینل فراہم کرنے اور بجلی کے بلوں میں ریلیف کے لیے جامع منصوبے کی منظوری۔',
    contentEn: `In a major step to alleviate energy costs for common citizens, the Federal Government today announced a comprehensive solarization program targeting 500,000 households across Punjab, Sindh, Khyber Pakhtunkhwa, and Balochistan.\n\nUnder the newly ratified framework, consumers utilizing up to 300 units per month will be eligible for subsidized rooftop solar installations with installment plans spread over five years at zero markup.\n\nThe Energy Minister emphasized that this clean energy transition would simultaneously reduce national circular debt in the power sector and protect vulnerable consumers from seasonal fuel price adjustments.\n\nRegistration for the scheme opens next Monday through a unified citizen digital portal.`,
    contentUr: `عوام کو بجلی کے بھاری بلوں سے نجات دلانے کے لیے وفاقی حکومت نے ملک بھر کے 5 لاکھ کم آمدنی والے گھرانوں کے لیے سولر سبسڈی پروگرام کی باقاعدہ منظوری دے دی ہے۔\n\nاس منصوبے کے تحت ماہانہ 300 یونٹ تک بجلی استعمال کرنے والے صارفین کو پانچ سال کی آسان بلا سود اقساط پر مکمل سولر سسٹم فراہم کیا جائے گا۔\n\nوفاقی وزیرِ توانائی نے میڈیا کو بریفنگ دیتے ہوئے بتایا کہ اس اقدام سے گردشی قرضے میں کمی آئے گی اور ماحول دوست بجلی کی پیداوار میں اضافہ ہوگا۔ شہری پیر کے روز سے پورٹل کے ذریعے آن لائن درخواستیں جمع کرا سکیں گے۔`,
    category: 'pakistan',
    tags: ['SolarEnergy', 'Electricity', 'GovtSubsidy', 'Relief', 'PakistanNews'],
    author: {
      id: 'auth-3',
      nameEn: 'Shahid Ali Warraich',
      nameUr: 'شاہد علی وڑائچ',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
      role: 'Bureau Chief Islamabad'
    },
    publishedAt: '2026-11-06T06:00:00Z',
    updatedAt: '2026-11-06T06:30:00Z',
    views: 22100,
    status: 'published',
    heroImage: 'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=1200&q=80',
    imageCaptionEn: 'Solar panels installed under renewable energy initiatives in Pakistan.',
    imageCaptionUr: 'پاکستان میں ماحول دوست توانائی کے فروغ کے لیے سولر پینل تنصیب۔',
    isBreaking: false,
    isFeatured: true,
    isTrending: false,
    readingTimeMin: 4
  },
  {
    id: 'art-4',
    slug: 'bise-annual-matric-intermediate-examinations-schedule-announced-2026',
    titleEn: 'Punjab and Federal Boards Release Date Sheet for Annual Matric and Intermediate Exams',
    titleUr: 'پنجاب اور فیڈرل تعلیمی بورڈز نے سالانہ میٹرک اور انٹرمیڈیٹ امتحانات کی ڈیٹ شیٹ جاری کر دی',
    summaryEn: 'Over 2.5 million students across 9 educational boards in Punjab and FBISE Islamabad prepare for commencement of theory exams.',
    summaryUr: 'لاہور، راولپنڈی، فیصل آباد، ملتان اور فیڈرل بورڈ کے تحت دسویں اور بارہویں جماعت کے سالانہ امتحانات کے شیڈول کا اعلان۔',
    contentEn: `The Punjab Boards Committee of Chairmen (PBCC) in coordination with the Federal Board of Intermediate and Secondary Education (FBISE) has officially published the date sheet for the upcoming Secondary School Certificate (Matric) and Higher Secondary School Certificate (Inter) examinations.\n\nExaminations will be administered under strict digital surveillance and biometric student verification to maintain absolute academic integrity. Roll number slips have been dispatched electronically to affiliated schools and uploaded on respective board web servers for direct download.\n\nStudents can utilize our online Education Portal result section to access past papers, model papers, and live result alerts.`,
    contentUr: `پنجاب بھر کے تعلیمی بورڈز اور فیڈرل بورڈ اسلام آباد نے نویں، دسویں اور بارہویں جماعت کے سالانہ امتحانات کی حتمی تاریخوں کا اعلان کر دیا ہے۔ امتحانی شیڈول کے مطابق رول نمبر سلپس آن لائن جاری کر دی گئی ہیں۔\n\nچیئرمین بورڈز کمیٹی کے مطابق امتحانی مراکز میں شفافیت اور نقل کی روک تھام کے لیے سی سی ٹی وی کیمروں اور بائیو میٹرک حاضری کا خصوصی انتظام کیا گیا ہے۔ طلبہ پورٹل پر ماڈل پیپرز اور پرانے پرچہ جات بھی دیکھ سکتے ہیں۔`,
    category: 'education',
    tags: ['BISE', 'FBISE', 'MatricResults', 'InterExams', 'Education'],
    author: {
      id: 'auth-4',
      nameEn: 'Prof. Asim Farooq',
      nameUr: 'پروفیسر عاصم فاروق',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
      role: 'Education Columnist'
    },
    publishedAt: '2026-11-05T14:00:00Z',
    updatedAt: '2026-11-05T14:30:00Z',
    views: 31200,
    status: 'published',
    heroImage: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1200&q=80',
    imageCaptionEn: 'Students preparing for annual board examinations.',
    imageCaptionUr: 'سالانہ بورڈ امتحانات کی تیاری میں مصروف طلبہ و طالبات۔',
    isBreaking: false,
    isFeatured: false,
    isTrending: true,
    readingTimeMin: 3
  },
  {
    id: 'art-5',
    slug: '5g-spectrum-auction-pakistan-telecom-authority-announcement',
    titleEn: '5G Mobile Services Launch Slated for Major Pakistani Metros: PTA Finalizes Framework',
    titleUr: 'پاکستان میں فائیو جی (5G) سروسز کے آغاز کی حتمی تیاریاں، پی ٹی اے نے فریم ورک جاری کر دیا',
    summaryEn: 'High-speed 5G connectivity to roll out across Karachi, Lahore, Islamabad, and Peshawar following high-level spectrum licensing.',
    summaryUr: 'پاکستان ٹیلی کمیونیکیشن اتھارٹی کے مطابق بڑے شہروں میں صارفین کو جلد انتہائی تیز رفتار انٹرنیٹ اور نئی ڈیجیٹل سروسز میسر ہوں گی۔',
    contentEn: `The Pakistan Telecommunication Authority (PTA) has finalized spectrum allocation terms for next-generation 5G cellular technologies, aiming to boost the country's burgeoning digital economy, IT exports, and smart governance initiatives.\n\nIndustry leaders from major telecom networks highlighted that 5G speeds exceeding 1 Gbps will transform e-commerce, cloud gaming, remote healthcare, and agricultural tech implementations in rural corridors.\n\nSpecial consumer smartphone financing plans are also being formulated in partnership with local mobile assembly manufacturers in Faisalabad and Rawalpindi.`,
    contentUr: `پاکستان ٹیلی کمیونیکیشن اتھارٹی (پی ٹی اے) نے ملک میں فائیو جی (5G) انٹرنیٹ سروس کے لیے اسپیکٹرم نیلامی اور لائسنسنگ پالیسی کے بنیادی خدوخال جاری کر دیے ہیں۔ ابتدائی مرحلے میں کراچی، لاہور اور اسلام آباد میں فائیو جی کا آغاز کیا جائے گا۔\n\nآئی ٹی ماہرین کے مطابق اس جدید ٹیکنالوجی سے نہ صرف انٹرنیٹ اسپیڈ میں غیر معمولی اضافہ ہوگا بلکہ ٹیلی میڈیسن، مصنوعی ذہانت اور پاکستان کی آئی ٹی برآمدات میں تیزی آئے گی۔ مقامی سطح پر فائیو جی اسمارٹ فونز کی تیاری بھی شروع کی جا رہی ہے۔`,
    category: 'technology',
    tags: ['5G', 'PTA', 'Smartphones', 'Internet', 'TechPakistan'],
    author: {
      id: 'auth-1',
      nameEn: 'Tariq Mahmood',
      nameUr: 'طارق محمود',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      role: 'Tech & Telecom Reporter'
    },
    publishedAt: '2026-11-05T11:20:00Z',
    updatedAt: '2026-11-05T12:00:00Z',
    views: 15400,
    status: 'published',
    heroImage: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80',
    imageCaptionEn: '5G optical telecommunication towers and technology infrastructure.',
    imageCaptionUr: 'ٹیلی کام انفراسٹرکچر اور جدید نیٹ ورک ٹاورز۔',
    isBreaking: false,
    isFeatured: false,
    isTrending: true,
    readingTimeMin: 3
  }
];

const defaultBoards: EducationBoard[] = [
  { id: 'b1', code: 'BISE_LHR', nameEn: 'BISE Lahore', nameUr: 'بورڈ آف انٹرمیڈیٹ اینڈ سیکنڈری ایجوکیشن لاہور', province: 'Punjab', city: 'Lahore', website: 'https://www.biselahore.com' },
  { id: 'b2', code: 'BISE_RWP', nameEn: 'BISE Rawalpindi', nameUr: 'بورڈ آف انٹرمیڈیٹ اینڈ سیکنڈری ایجوکیشن راولپنڈی', province: 'Punjab', city: 'Rawalpindi', website: 'https://www.biserawalpindi.edu.pk' },
  { id: 'b3', code: 'BISE_FSD', nameEn: 'BISE Faisalabad', nameUr: 'بورڈ آف انٹرمیڈیٹ اینڈ سیکنڈری ایجوکیشن فیصل آباد', province: 'Punjab', city: 'Faisalabad', website: 'https://www.bisefsd.edu.pk' },
  { id: 'b4', code: 'BISE_MUL', nameEn: 'BISE Multan', nameUr: 'بورڈ آف انٹرمیڈیٹ اینڈ سیکنڈری ایجوکیشن ملتان', province: 'Punjab', city: 'Multan', website: 'https://www.bisemultan.edu.pk' },
  { id: 'b5', code: 'BISE_GRW', nameEn: 'BISE Gujranwala', nameUr: 'بورڈ آف انٹرمیڈیٹ اینڈ سیکنڈری ایجوکیشن گوجرانوالہ', province: 'Punjab', city: 'Gujranwala', website: 'https://www.bisegrw.edu.pk' },
  { id: 'b6', code: 'BSEK_KHI', nameEn: 'BSEK Karachi (Matric)', nameUr: 'ثانوی تعلیمی بورڈ کراچی', province: 'Sindh', city: 'Karachi', website: 'https://bsek.edu.pk' },
  { id: 'b7', code: 'BIEK_KHI', nameEn: 'BIEK Karachi (Inter)', nameUr: 'انٹرمیڈیٹ تعلیمی بورڈ کراچی', province: 'Sindh', city: 'Karachi', website: 'https://biek.edu.pk' },
  { id: 'b8', code: 'BISE_PESH', nameEn: 'BISE Peshawar', nameUr: 'بورڈ آف انٹرمیڈیٹ اینڈ سیکنڈری ایجوکیشن پشاور', province: 'KPK', city: 'Peshawar', website: 'https://www.bisep.edu.pk' },
  { id: 'b9', code: 'BISE_QTA', nameEn: 'BISE Quetta', nameUr: 'بورڈ آف انٹرمیڈیٹ اینڈ سیکنڈری ایجوکیشن کوئٹہ', province: 'Balochistan', city: 'Quetta', website: 'https://bbiseqta.edu.pk' },
  { id: 'b10', code: 'FBISE_ISB', nameEn: 'FBISE Islamabad (Federal)', nameUr: 'فیڈرل بورڈ آف انٹرمیڈیٹ اینڈ سیکنڈری ایجوکیشن اسلام آباد', province: 'Federal', city: 'Islamabad', website: 'https://www.fbise.edu.pk' }
];

const defaultResults: ExamResult[] = [
  {
    id: 'res-1',
    boardCode: 'BISE_LHR',
    examNameEn: 'Matric (10th Class) Annual Examination',
    examNameUr: 'میٹرک سالانہ امتحان (دسویں جماعت)',
    year: 2026,
    rollNumber: '102456',
    candidateNameEn: 'Muhammad Hammad Siddiqui',
    candidateNameUr: 'محمد حماد صدیقی',
    fatherNameEn: 'Tariq Siddiqui',
    fatherNameUr: 'طارق صدیقی',
    instituteEn: 'Government Central Model High School, Lower Mall, Lahore',
    instituteUr: 'گورنمنٹ سینٹرل ماڈل ہائی اسکول لوئر مال لاہور',
    marksObtained: 1048,
    totalMarks: 1100,
    grade: 'A+',
    status: 'PASS',
    subjectMarks: [
      { subjectEn: 'English Compulsory', subjectUr: 'انگریزی لازمی', marks: 142, total: 150 },
      { subjectEn: 'Urdu Compulsory', subjectUr: 'اردو لازمی', marks: 145, total: 150 },
      { subjectEn: 'Islamic Studies / Tarjuma', subjectUr: 'اسلامیات و ترجمۃ القرآن', marks: 98, total: 100 },
      { subjectEn: 'Pakistan Studies', subjectUr: 'مطالعہ پاکستان', marks: 95, total: 100 },
      { subjectEn: 'Mathematics (Sci)', subjectUr: 'ریاضی (سائنس)', marks: 150, total: 150 },
      { subjectEn: 'Physics', subjectUr: 'طبیعیات (فزکس)', marks: 140, total: 150 },
      { subjectEn: 'Chemistry', subjectUr: 'کیمسٹری', marks: 138, total: 150 },
      { subjectEn: 'Biology / Computer', subjectUr: 'حیاتیات / کمپیوٹر', marks: 140, total: 150 }
    ]
  },
  {
    id: 'res-2',
    boardCode: 'FBISE_ISB',
    examNameEn: 'Intermediate (HSSC-II Pre-Medical) Annual Examination',
    examNameUr: 'انٹرمیڈیٹ پری میڈیکل سالانہ امتحان (بارہویں جماعت)',
    year: 2026,
    rollNumber: '204589',
    candidateNameEn: 'Ayesha Fatima',
    candidateNameUr: 'عائشہ فاطمہ',
    fatherNameEn: 'Dr. Abdul Rehman',
    fatherNameUr: 'ڈاکٹر عبد الرحمٰن',
    instituteEn: 'Islamabad Model College for Girls, F-7/2, Islamabad',
    instituteUr: 'اسلام آباد ماڈل کالج برائے طالبات ایف سیون ٹو اسلام آباد',
    marksObtained: 1062,
    totalMarks: 1100,
    grade: 'A+',
    status: 'PASS',
    subjectMarks: [
      { subjectEn: 'English Compulsory', subjectUr: 'انگریزی لازمی', marks: 188, total: 200 },
      { subjectEn: 'Urdu Compulsory', subjectUr: 'اردو لازمی', marks: 190, total: 200 },
      { subjectEn: 'Islamic Education', subjectUr: 'اسلامی تعلیمات', marks: 49, total: 50 },
      { subjectEn: 'Pakistan Studies', subjectUr: 'مطالعہ پاکستان', marks: 48, total: 50 },
      { subjectEn: 'Physics', subjectUr: 'فزکس', marks: 195, total: 200 },
      { subjectEn: 'Chemistry', subjectUr: 'کیمسٹری', marks: 194, total: 200 },
      { subjectEn: 'Biology', subjectUr: 'حیاتیات (بائیولوجی)', marks: 198, total: 200 }
    ]
  },
  {
    id: 'res-3',
    boardCode: 'BSEK_KHI',
    examNameEn: 'Matric Science Group Annual Examination',
    examNameUr: 'میٹرک سائنس گروپ سالانہ امتحان',
    year: 2026,
    rollNumber: '301290',
    candidateNameEn: 'Syed Bilal Hassan',
    candidateNameUr: 'سید بلال حسن',
    fatherNameEn: 'Syed Hassan Rizvi',
    fatherNameUr: 'سید حسن رضوی',
    instituteEn: 'Habib Public School, Karachi',
    instituteUr: 'حبیب پبلک اسکول کراچی',
    marksObtained: 980,
    totalMarks: 1100,
    grade: 'A+',
    status: 'PASS',
    subjectMarks: [
      { subjectEn: 'English', subjectUr: 'انگریزی', marks: 135, total: 150 },
      { subjectEn: 'Urdu', subjectUr: 'اردو', marks: 130, total: 150 },
      { subjectEn: 'Islamiyat', subjectUr: 'اسلامیات', marks: 92, total: 100 },
      { subjectEn: 'Pak Studies', subjectUr: 'مطالعہ پاکستان', marks: 88, total: 100 },
      { subjectEn: 'Mathematics', subjectUr: 'ریاضی', marks: 145, total: 150 },
      { subjectEn: 'Physics', subjectUr: 'فزکس', marks: 130, total: 150 },
      { subjectEn: 'Chemistry', subjectUr: 'کیمسٹری', marks: 128, total: 150 },
      { subjectEn: 'Computer Science', subjectUr: 'کمپیوٹر سائنس', marks: 132, total: 150 }
    ]
  }
];

const defaultWeather: WeatherData[] = [
  {
    cityId: 'karachi',
    nameEn: 'Karachi',
    nameUr: 'کراچی',
    provinceEn: 'Sindh',
    provinceUr: 'سندھ',
    tempC: 31,
    conditionEn: 'Sunny & Coastal Breeze',
    conditionUr: 'دھوپ اور سمندری ہوا',
    highC: 33,
    lowC: 22,
    humidity: 62,
    windKmh: 18,
    aqi: 95,
    aqiStatusEn: 'Moderate',
    aqiStatusUr: 'معتدل',
    feelsLikeC: 34,
    sunrise: '06:42 AM',
    sunset: '05:48 PM',
    hourly: [
      { time: '09:00', tempC: 27, condition: 'Sunny' },
      { time: '12:00', tempC: 32, condition: 'Sunny' },
      { time: '15:00', tempC: 33, condition: 'Warm' },
      { time: '18:00', tempC: 29, condition: 'Clear' },
      { time: '21:00', tempC: 25, condition: 'Pleasant' }
    ],
    daily: [
      { dayEn: 'Fri', dayUr: 'جمعہ', highC: 33, lowC: 22, conditionEn: 'Sunny', conditionUr: 'صاف' },
      { dayEn: 'Sat', dayUr: 'ہفتہ', highC: 32, lowC: 21, conditionEn: 'Clear', conditionUr: 'صاف' },
      { dayEn: 'Sun', dayUr: 'اتوار', highC: 31, lowC: 20, conditionEn: 'Breezy', conditionUr: 'ہوادار' },
      { dayEn: 'Mon', dayUr: 'پیر', highC: 32, lowC: 21, conditionEn: 'Sunny', conditionUr: 'دھوپ' },
      { dayEn: 'Tue', dayUr: 'منگل', highC: 33, lowC: 22, conditionEn: 'Sunny', conditionUr: 'دھوپ' }
    ]
  },
  {
    cityId: 'lahore',
    nameEn: 'Lahore',
    nameUr: 'لاہور',
    provinceEn: 'Punjab',
    provinceUr: 'پنجاب',
    tempC: 26,
    conditionEn: 'Pleasant & Mild Haze',
    conditionUr: 'خوشگوار اور ہلکی دھند',
    highC: 28,
    lowC: 15,
    humidity: 54,
    windKmh: 9,
    aqi: 145,
    aqiStatusEn: 'Unhealthy for Sensitive Groups',
    aqiStatusUr: 'حساس افراد کے لیے مضر',
    feelsLikeC: 26,
    sunrise: '06:26 AM',
    sunset: '05:15 PM',
    hourly: [
      { time: '09:00', tempC: 20, condition: 'Hazy' },
      { time: '12:00', tempC: 26, condition: 'Sunny' },
      { time: '15:00', tempC: 28, condition: 'Mild' },
      { time: '18:00', tempC: 22, condition: 'Cool' },
      { time: '21:00', tempC: 18, condition: 'Cool' }
    ],
    daily: [
      { dayEn: 'Fri', dayUr: 'جمعہ', highC: 28, lowC: 15, conditionEn: 'Mild', conditionUr: 'معتدل' },
      { dayEn: 'Sat', dayUr: 'ہفتہ', highC: 27, lowC: 14, conditionEn: 'Pleasant', conditionUr: 'خوشگوار' },
      { dayEn: 'Sun', dayUr: 'اتوار', highC: 27, lowC: 13, conditionEn: 'Clear', conditionUr: 'صاف' },
      { dayEn: 'Mon', dayUr: 'پیر', highC: 26, lowC: 13, conditionEn: 'Hazy', conditionUr: 'ہلکی دھند' },
      { dayEn: 'Tue', dayUr: 'منگل', highC: 25, lowC: 12, conditionEn: 'Cool', conditionUr: 'ٹھنڈا' }
    ]
  },
  {
    cityId: 'islamabad',
    nameEn: 'Islamabad',
    nameUr: 'اسلام آباد',
    provinceEn: 'Federal Capital',
    provinceUr: 'وفاقی دارالحکومت',
    tempC: 23,
    conditionEn: 'Clear & Crisp Margalla Air',
    conditionUr: 'صاف مطلع اور مارگلہ کی ٹھنڈی ہوا',
    highC: 25,
    lowC: 11,
    humidity: 48,
    windKmh: 12,
    aqi: 48,
    aqiStatusEn: 'Good & Fresh',
    aqiStatusUr: 'بہترین اور صاف ستھری',
    feelsLikeC: 23,
    sunrise: '06:33 AM',
    sunset: '05:14 PM',
    hourly: [
      { time: '09:00', tempC: 17, condition: 'Crisp' },
      { time: '12:00', tempC: 23, condition: 'Sunny' },
      { time: '15:00', tempC: 25, condition: 'Sunny' },
      { time: '18:00', tempC: 19, condition: 'Chilly' },
      { time: '21:00', tempC: 14, condition: 'Cold' }
    ],
    daily: [
      { dayEn: 'Fri', dayUr: 'جمعہ', highC: 25, lowC: 11, conditionEn: 'Clear', conditionUr: 'صاف' },
      { dayEn: 'Sat', dayUr: 'ہفتہ', highC: 24, lowC: 10, conditionEn: 'Sunny', conditionUr: 'دھوپ' },
      { dayEn: 'Sun', dayUr: 'اتوار', highC: 23, lowC: 9, conditionEn: 'Cool', conditionUr: 'سرد' },
      { dayEn: 'Mon', dayUr: 'پیر', highC: 22, lowC: 9, conditionEn: 'Partly Cloudy', conditionUr: 'جزوی ابر آلود' },
      { dayEn: 'Tue', dayUr: 'منگل', highC: 21, lowC: 8, conditionEn: 'Cold', conditionUr: 'سرد' }
    ]
  },
  {
    cityId: 'peshawar',
    nameEn: 'Peshawar',
    nameUr: 'پشاور',
    provinceEn: 'Khyber Pakhtunkhwa',
    provinceUr: 'خیبر پختونخوا',
    tempC: 24,
    conditionEn: 'Sunny with Mild Breeze',
    conditionUr: 'دھوپ اور ہلکی خنکی',
    highC: 26,
    lowC: 12,
    humidity: 50,
    windKmh: 10,
    aqi: 110,
    aqiStatusEn: 'Moderate',
    aqiStatusUr: 'معتدل',
    feelsLikeC: 24,
    sunrise: '06:38 AM',
    sunset: '05:19 PM',
    hourly: [
      { time: '09:00', tempC: 18, condition: 'Sunny' },
      { time: '12:00', tempC: 24, condition: 'Warm' },
      { time: '15:00', tempC: 26, condition: 'Sunny' },
      { time: '18:00', tempC: 19, condition: 'Cool' },
      { time: '21:00', tempC: 15, condition: 'Cool' }
    ],
    daily: [
      { dayEn: 'Fri', dayUr: 'جمعہ', highC: 26, lowC: 12, conditionEn: 'Sunny', conditionUr: 'صاف' },
      { dayEn: 'Sat', dayUr: 'ہفتہ', highC: 25, lowC: 11, conditionEn: 'Sunny', conditionUr: 'صاف' },
      { dayEn: 'Sun', dayUr: 'اتوار', highC: 24, lowC: 10, conditionEn: 'Clear', conditionUr: 'دھوپ' },
      { dayEn: 'Mon', dayUr: 'پیر', highC: 23, lowC: 10, conditionEn: 'Cloudy', conditionUr: 'ابر آلود' },
      { dayEn: 'Tue', dayUr: 'منگل', highC: 22, lowC: 9, conditionEn: 'Cool', conditionUr: 'سرد' }
    ]
  },
  {
    cityId: 'quetta',
    nameEn: 'Quetta',
    nameUr: 'کوئٹہ',
    provinceEn: 'Balochistan',
    provinceUr: 'بلوچستان',
    tempC: 17,
    conditionEn: 'Cold & Clear Mountain Sky',
    conditionUr: 'سرد اور شفاف پہاڑی فضا',
    highC: 19,
    lowC: 4,
    humidity: 32,
    windKmh: 16,
    aqi: 38,
    aqiStatusEn: 'Excellent',
    aqiStatusUr: 'بہترین',
    feelsLikeC: 15,
    sunrise: '06:48 AM',
    sunset: '05:40 PM',
    hourly: [
      { time: '09:00', tempC: 11, condition: 'Cold' },
      { time: '12:00', tempC: 17, condition: 'Sunny' },
      { time: '15:00', tempC: 19, condition: 'Crisp' },
      { time: '18:00', tempC: 12, condition: 'Very Cold' },
      { time: '21:00', tempC: 7, condition: 'Freezing' }
    ],
    daily: [
      { dayEn: 'Fri', dayUr: 'جمعہ', highC: 19, lowC: 4, conditionEn: 'Sunny', conditionUr: 'صاف' },
      { dayEn: 'Sat', dayUr: 'ہفتہ', highC: 18, lowC: 3, conditionEn: 'Chilly', conditionUr: 'ٹھنڈا' },
      { dayEn: 'Sun', dayUr: 'اتوار', highC: 17, lowC: 2, conditionEn: 'Cold', conditionUr: 'سخت سرد' },
      { dayEn: 'Mon', dayUr: 'پیر', highC: 16, lowC: 2, conditionEn: 'Windy', conditionUr: 'تیز ہوائیں' },
      { dayEn: 'Tue', dayUr: 'منگل', highC: 15, lowC: 1, conditionEn: 'Cold', conditionUr: 'سخت سرد' }
    ]
  }
];

const defaultGoldRates: GoldRate[] = [
  { karat: '24K (Per Tola)', tolaPkr: 278500, tenGramPkr: 238770, changePkr: 1200, isPositive: true },
  { karat: '22K (Per Tola)', tolaPkr: 255290, tenGramPkr: 218870, changePkr: 1100, isPositive: true },
  { karat: '21K (Per Tola)', tolaPkr: 243680, tenGramPkr: 208920, changePkr: 1050, isPositive: true },
  { karat: '18K (Per Tola)', tolaPkr: 208870, tenGramPkr: 179080, changePkr: 900, isPositive: true }
];

const defaultCurrencyRates: CurrencyRate[] = [
  { code: 'USD', nameEn: 'US Dollar', nameUr: 'امریکی ڈالر', buyingPkr: 278.40, sellingPkr: 280.15, interbankPkr: 278.10, change: -0.25, flag: '🇺🇸' },
  { code: 'GBP', nameEn: 'British Pound', nameUr: 'برطانوی پاؤنڈ', buyingPkr: 358.50, sellingPkr: 362.20, interbankPkr: 357.90, change: 0.60, flag: '🇬🇧' },
  { code: 'EUR', nameEn: 'Euro', nameUr: 'یورو', buyingPkr: 301.20, sellingPkr: 304.80, interbankPkr: 300.90, change: -0.15, flag: '🇪🇺' },
  { code: 'SAR', nameEn: 'Saudi Riyal', nameUr: 'سعودی ریال', buyingPkr: 74.20, sellingPkr: 74.90, interbankPkr: 74.15, change: 0.05, flag: '🇸🇦' },
  { code: 'AED', nameEn: 'UAE Dirham', nameUr: 'اماراتی درہم', buyingPkr: 75.80, sellingPkr: 76.50, interbankPkr: 75.72, change: 0.00, flag: '🇦🇪' },
  { code: 'CAD', nameEn: 'Canadian Dollar', nameUr: 'کینیڈین ڈالر', buyingPkr: 202.40, sellingPkr: 205.10, interbankPkr: 201.80, change: 0.30, flag: '🇨🇦' },
  { code: 'AUD', nameEn: 'Australian Dollar', nameUr: 'آسٹریلین ڈالر', buyingPkr: 184.10, sellingPkr: 187.30, interbankPkr: 183.60, change: 0.45, flag: '🇦🇺' },
  { code: 'KWD', nameEn: 'Kuwaiti Dinar', nameUr: 'کویتی دینار', buyingPkr: 906.50, sellingPkr: 915.20, interbankPkr: 905.80, change: 1.10, flag: '🇰🇼' }
];

const defaultFuelPrices: FuelPrice[] = [
  { typeEn: 'Petrol (Motor Gasoline)', typeUr: 'پیٹرول (سپر)', pricePkr: 265.40, changePkr: -2.04, effectiveDate: '01 Nov 2026' },
  { typeEn: 'High Speed Diesel (HSD)', typeUr: 'ہائی اسپیڈ ڈیزل', pricePkr: 272.80, changePkr: 1.40, effectiveDate: '01 Nov 2026' },
  { typeEn: 'Light Diesel Oil (LDO)', typeUr: 'لائٹ ڈیزل آئل', pricePkr: 160.20, changePkr: -1.80, effectiveDate: '01 Nov 2026' },
  { typeEn: 'Kerosene Oil (Mitti Ka Tel)', typeUr: 'مٹی کا تیل (کیروسین)', pricePkr: 174.90, changePkr: -0.90, effectiveDate: '01 Nov 2026' }
];

const defaultPSX: PSXData = {
  kse100: 93450.75,
  change: 624.18,
  changePercent: 0.67,
  volumeMillion: 489.4,
  gainers: [
    { symbol: 'OGDC', price: 168.45, change: 4.80 },
    { symbol: 'PPL', price: 132.10, change: 3.90 },
    { symbol: 'MCB', price: 245.50, change: 6.20 },
    { symbol: 'SYS', price: 485.00, change: 12.50 }
  ],
  losers: [
    { symbol: 'HUBC', price: 118.20, change: -1.45 },
    { symbol: 'FFC', price: 178.60, change: -0.80 },
    { symbol: 'LUCK', price: 890.00, change: -5.20 }
  ]
};

const defaultCricket: CricketMatch[] = [
  {
    id: 'cric-1',
    titleEn: 'Pakistan vs Australia - 2nd ODI (Melbourne Cricket Ground)',
    titleUr: 'پاکستان بمقابلہ آسٹریلیا - دوسرا ون ڈے (ایم سی جی)',
    tournament: 'Pakistan Tour of Australia 2026',
    status: 'live',
    teamA: { name: 'Australia', code: 'AUS', score: '163', overs: '35.0', wickets: 10, flag: '🇦🇺' },
    teamB: { name: 'Pakistan', code: 'PAK', score: '169/1', overs: '26.3', wickets: 1, flag: '🇵🇰' },
    currentBatters: ['Babar Azam 35* (44)', 'Saim Ayub 82 (71)'],
    currentBowler: 'Mitchell Starc 6-0-38-1',
    statusTextEn: 'Pakistan won by 9 wickets with 141 balls remaining',
    statusTextUr: 'پاکستان نے شاندار کارکردگی دکھا کر 9 وکٹوں سے فتح حاصل کر لی',
    venueEn: 'MCG, Melbourne',
    venueUr: 'میلبورن کرکٹ گراؤنڈ',
    dateStr: 'Live Today'
  },
  {
    id: 'cric-2',
    titleEn: 'Pakistan vs England - Champions Trophy Opening Match',
    titleUr: 'پاکستان بمقابلہ انگلینڈ - چیمپئنز ٹرافی افتتاحی معرکہ',
    tournament: 'ICC Champions Trophy Pakistan',
    status: 'upcoming',
    teamA: { name: 'Pakistan', code: 'PAK', flag: '🇵🇰' },
    teamB: { name: 'England', code: 'ENG', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
    statusTextEn: 'Starts at 02:30 PM PKT at National Stadium Karachi',
    statusTextUr: 'نیشنل اسٹیڈیم کراچی میں دوپہر اڑھائی بجے شروع ہوگا',
    venueEn: 'National Stadium, Karachi',
    venueUr: 'نیشنل اسٹیڈیم کراچی',
    dateStr: '19 Feb 2027'
  }
];

const defaultPrayerTimes: Record<string, PrayerTimeData> = {
  karachi: {
    cityEn: 'Karachi',
    cityUr: 'کراچی',
    fajr: '05:28 AM',
    sunrise: '06:42 AM',
    dhuhr: '12:15 PM',
    asr: '03:32 PM',
    maghrib: '05:48 PM',
    isha: '07:02 PM',
    sehriEnds: '05:23 AM',
    iftar: '05:48 PM',
    hijriDateEn: '21 Shawwal 1447 AH',
    hijriDateUr: '21 شوال 1447ھ'
  },
  lahore: {
    cityEn: 'Lahore',
    cityUr: 'لاہور',
    fajr: '05:07 AM',
    sunrise: '06:26 AM',
    dhuhr: '11:51 AM',
    asr: '03:00 PM',
    maghrib: '05:15 PM',
    isha: '06:34 PM',
    sehriEnds: '05:02 AM',
    iftar: '05:15 PM',
    hijriDateEn: '21 Shawwal 1447 AH',
    hijriDateUr: '21 شوال 1447ھ'
  },
  islamabad: {
    cityEn: 'Islamabad',
    cityUr: 'اسلام آباد',
    fajr: '05:12 AM',
    sunrise: '06:33 AM',
    dhuhr: '11:54 AM',
    asr: '03:00 PM',
    maghrib: '05:14 PM',
    isha: '06:35 PM',
    sehriEnds: '05:07 AM',
    iftar: '05:14 PM',
    hijriDateEn: '21 Shawwal 1447 AH',
    hijriDateUr: '21 شوال 1447ھ'
  },
  peshawar: {
    cityEn: 'Peshawar',
    cityUr: 'پشاور',
    fajr: '05:18 AM',
    sunrise: '06:38 AM',
    dhuhr: '11:59 AM',
    asr: '03:05 PM',
    maghrib: '05:19 PM',
    isha: '06:40 PM',
    sehriEnds: '05:13 AM',
    iftar: '05:19 PM',
    hijriDateEn: '21 Shawwal 1447 AH',
    hijriDateUr: '21 شوال 1447ھ'
  },
  quetta: {
    cityEn: 'Quetta',
    cityUr: 'کوئٹہ',
    fajr: '05:31 AM',
    sunrise: '06:48 AM',
    dhuhr: '12:14 PM',
    asr: '03:25 PM',
    maghrib: '05:40 PM',
    isha: '06:58 PM',
    sehriEnds: '05:26 AM',
    iftar: '05:40 PM',
    hijriDateEn: '21 Shawwal 1447 AH',
    hijriDateUr: '21 شوال 1447ھ'
  }
};

const defaultMobiles: MobilePhone[] = [
  {
    id: 'mob-1',
    brand: 'Samsung',
    model: 'Galaxy S25 Ultra 5G',
    pricePkr: 429999,
    ram: '16 GB',
    storage: '512 GB',
    display: '6.8" Dynamic AMOLED 2X, 120Hz',
    camera: '200 MP + 50 MP + 50 MP Quad',
    battery: '5000 mAh 45W Fast Charging',
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?auto=format&fit=crop&w=400&q=80'
  },
  {
    id: 'mob-2',
    brand: 'Apple',
    model: 'iPhone 16 Pro Max',
    pricePkr: 549999,
    ram: '8 GB',
    storage: '256 GB',
    display: '6.9" Super Retina XDR OLED',
    camera: '48 MP Fusion + 48 MP Ultra Wide',
    battery: '4685 mAh MagSafe Wireless',
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=400&q=80'
  },
  {
    id: 'mob-3',
    brand: 'Xiaomi',
    model: 'Redmi Note 14 Pro+ 5G',
    pricePkr: 98999,
    ram: '12 GB',
    storage: '256 GB',
    display: '6.67" CrystalRes AMOLED 120Hz',
    camera: '200 MP OIS Main Camera',
    battery: '6200 mAh 90W HyperCharge',
    rating: 4.7,
    image: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=400&q=80'
  },
  {
    id: 'mob-4',
    brand: 'Infinix',
    model: 'Zero 40 5G',
    pricePkr: 74999,
    ram: '12 GB',
    storage: '256 GB',
    display: '6.78" 3D Curved AMOLED 144Hz',
    camera: '108 MP OIS + 50 MP 4K Vlog',
    battery: '5000 mAh 45W Wireless',
    rating: 4.5,
    image: 'https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=400&q=80'
  }
];

const defaultAutomobiles: Automobile[] = [
  {
    id: 'auto-1',
    type: 'car',
    brand: 'Honda',
    model: 'Civic RS Turbo',
    year: 2026,
    pricePkr: 9899000,
    engineCc: '1500 cc VTEC Turbo',
    transmission: 'CVT with Paddle Shifters',
    mileage: '14.5 km/l',
    image: 'https://images.unsplash.com/photo-1590362891988-f77804702008?auto=format&fit=crop&w=500&q=80'
  },
  {
    id: 'auto-2',
    type: 'car',
    brand: 'Toyota',
    model: 'Corolla Altis Grande 1.8X',
    year: 2026,
    pricePkr: 7799000,
    engineCc: '1800 cc Dual VVT-i',
    transmission: 'CVTi 7-Speed Sport',
    mileage: '13.8 km/l',
    image: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=500&q=80'
  },
  {
    id: 'auto-3',
    type: 'car',
    brand: 'Suzuki',
    model: 'Alto VXR AGS',
    year: 2026,
    pricePkr: 2935000,
    engineCc: '660 cc R06A',
    transmission: 'Auto Gear Shift (AGS)',
    mileage: '20.5 km/l',
    image: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=500&q=80'
  },
  {
    id: 'auto-4',
    type: 'bike',
    brand: 'Yamaha',
    model: 'YBR 125G DX',
    year: 2026,
    pricePkr: 485000,
    engineCc: '125 cc 4-Stroke SOHC',
    transmission: '5-Speed Constant Mesh',
    mileage: '46 km/l',
    image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=500&q=80'
  }
];

const defaultPrizeBonds: PrizeBondDraw[] = [
  {
    id: 'pb-1500-draw-100',
    denomination: 1500,
    drawNumber: 100,
    drawDate: '2026-11-15',
    cityEn: 'Rawalpindi',
    cityUr: 'راولپنڈی',
    firstPrizePkr: 'Rs. 3,000,000 (1 Prize)',
    secondPrizePkr: 'Rs. 1,000,000 (3 Prizes)',
    thirdPrizePkr: 'Rs. 18,500 (1,696 Prizes)',
    firstPrizeBond: '741295',
    secondPrizeBonds: ['182940', '495810', '920412'],
    thirdPrizeSample: ['001423', '012948', '034918', '054192', '089412', '124950', '219481', '391048', '512948', '749102']
  },
  {
    id: 'pb-750-draw-99',
    denomination: 750,
    drawNumber: 99,
    drawDate: '2026-10-15',
    cityEn: 'Muzaffarabad',
    cityUr: 'مظفرآباد',
    firstPrizePkr: 'Rs. 1,500,000 (1 Prize)',
    secondPrizePkr: 'Rs. 500,000 (3 Prizes)',
    thirdPrizePkr: 'Rs. 9,300 (1,696 Prizes)',
    firstPrizeBond: '481920',
    secondPrizeBonds: ['209481', '592014', '819240'],
    thirdPrizeSample: ['002914', '019482', '045918', '078129', '140924', '309184', '491029', '610294', '819402']
  },
  {
    id: 'pb-200-draw-98',
    denomination: 200,
    drawNumber: 98,
    drawDate: '2026-09-15',
    cityEn: 'Peshawar',
    cityUr: 'پشاور',
    firstPrizePkr: 'Rs. 750,000 (1 Prize)',
    secondPrizePkr: 'Rs. 250,000 (5 Prizes)',
    thirdPrizePkr: 'Rs. 1,250 (2,394 Prizes)',
    firstPrizeBond: '391048',
    secondPrizeBonds: ['104928', '294810', '481920', '601928', '840192'],
    thirdPrizeSample: ['001290', '028491', '058192', '091248', '148291', '259102', '381920', '591028', '791024']
  }
];

const defaultDictionary: DictionaryEntry[] = [
  {
    id: 'dict-1',
    english: 'Resilience',
    urdu: 'ثابت قدمی، لچک، بحالی کی صلاحیت',
    romanUrdu: 'Sabit Qadmi, Lachak',
    partOfSpeech: 'Noun',
    definitionEn: 'The capacity to withstand or to recover quickly from difficulties; toughness.',
    definitionUr: 'مشکل حالات کا سامنا کرنے اور دوبارہ ابھرنے کی غیر معمولی صلاحیت۔',
    exampleEn: 'The economic resilience of Pakistan has inspired international investors.',
    exampleUr: 'پاکستانی قوم کی ثابت قدمی اور حوصلہ ہمیشہ قابلِ رشک رہا ہے۔'
  },
  {
    id: 'dict-2',
    english: 'Aspiration',
    urdu: 'آرزو، تمنا، بلند حوصلہ',
    romanUrdu: 'Aarzu, Tamanna, Buland Hosla',
    partOfSpeech: 'Noun',
    definitionEn: 'A hope or ambition of achieving something worthwhile.',
    definitionUr: 'کسی بلند مقصد یا منزل کو پانے کی دلی خواہش اور جدوجہد۔',
    exampleEn: 'The youth of Pakistan carry noble aspirations for technological leadership.',
    exampleUr: 'پاکستانی نوجوانوں کی آرزو ہے کہ وہ آئی ٹی کی دنیا میں اپنا نام بنائیں۔'
  },
  {
    id: 'dict-3',
    english: 'Sovereignty',
    urdu: 'خود مختاری، حاکمیتِ اعلیٰ',
    romanUrdu: 'Khud Mukhtari, Hakmiyat e Aala',
    partOfSpeech: 'Noun',
    definitionEn: 'Supreme power or authority of a state to govern itself.',
    definitionUr: 'کسی ریاست کا آزادانہ اور خود مختار فیصلہ کرنے کا مکمل اختیار۔',
    exampleEn: 'Preserving national sovereignty is paramount for every sovereign state.',
    exampleUr: 'قومی خود مختاری کا تحفظ ہر شہری کا اوّلین فرض ہے۔'
  }
];

const defaultBabyNames: BabyName[] = [
  { id: 'name-1', nameEn: 'Ayan', nameUr: 'عیان', gender: 'boy', meaningEn: 'Gift of God, clearly visible, perceptive', meaningUr: 'اللہ کا تحفہ، عیاں، روشن بصیرت والا', origin: 'Arabic', luckyNumber: 7 },
  { id: 'name-2', nameEn: 'Zainab', nameUr: 'زینب', gender: 'girl', meaningEn: "Father's beauty, fragrant desert flower", meaningUr: 'باپ کی زینت، خوبصورت خوشبودار پھول', origin: 'Arabic', luckyNumber: 3 },
  { id: 'name-3', nameEn: 'Muhammad', nameUr: 'محمد', gender: 'boy', meaningEn: 'The Praised One, of noble character', meaningUr: 'جس کی بار بار تعریف کی جائے، قابلِ ستائش', origin: 'Arabic', luckyNumber: 9 },
  { id: 'name-4', nameEn: 'Ayla', nameUr: 'آئلہ', gender: 'girl', meaningEn: 'Moonlight, halo of light, radiant princess', meaningUr: 'چاندنی، نور کا ہالہ، خوبصورت روشنی', origin: 'Turkish / Arabic', luckyNumber: 2 },
  { id: 'name-5', nameEn: 'Shahmeer', nameUr: 'شاہ میر', gender: 'boy', meaningEn: 'Leader of kings, noble and handsome', meaningUr: 'بادشاہوں کا سردار، خوبصورت اور باوقار', origin: 'Persian', luckyNumber: 5 },
  { id: 'name-6', nameEn: 'Hoorain', nameUr: 'حورین', gender: 'girl', meaningEn: 'Most beautiful eyes, woman of paradise', meaningUr: 'خوبصورت آنکھوں والی، جنتی حور', origin: 'Quranic / Arabic', luckyNumber: 6 }
];

const defaultPoets: Poet[] = [
  {
    id: 'poet-iqbal',
    nameEn: 'Allama Muhammad Iqbal',
    nameUr: 'علامہ محمد اقبال',
    era: '1877 – 1938',
    cityEn: 'Sialkot / Lahore',
    cityUr: 'سیالکوٹ / لاہور',
    bioEn: 'National poet of Pakistan, philosopher, barrister, and intellectual pioneer of the Muslim renaissance.',
    bioUr: 'شاعرِ مشرق، حکیم الامت، مفکرِ پاکستان جنہوں نے خودی کا درس دیا اور برصغیر کے مسلمانوں کو بیدار کیا۔',
    image: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=400&q=80',
    poemCount: 120
  },
  {
    id: 'poet-ghalib',
    nameEn: 'Mirza Asadullah Khan Ghalib',
    nameUr: 'مرزا اسد اللہ خان غالب',
    era: '1797 – 1869',
    cityEn: 'Agra / Delhi',
    cityUr: 'آگرہ / دہلی',
    bioEn: 'The supreme maestro of classical Urdu and Persian ghazal poetry.',
    bioUr: 'اردو شاعری کے بے تاج بادشاہ جن کے اشعار آج بھی فلسفہ اور زندگی کی باریکیوں کا احاطہ کرتے ہیں۔',
    image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
    poemCount: 95
  },
  {
    id: 'poet-faiz',
    nameEn: 'Faiz Ahmad Faiz',
    nameUr: 'فیض احمد فیض',
    era: '1911 – 1984',
    cityEn: 'Sialkot / Lahore',
    cityUr: 'سیالکوٹ / لاہور',
    bioEn: 'Revolutionary poet, Lenin Peace Prize laureate, and voice of human dignity and liberty.',
    bioUr: 'عظیم انقلابی و رومانوی شاعر، لینن امن انعام یافتہ جن کی شاعری آمریت کے خلاف مزاحمت کا استعارہ ہے۔',
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80',
    poemCount: 78
  }
];

const defaultPoems: Poem[] = [
  {
    id: 'poem-khudi',
    titleEn: 'Khudi Ko Kar Buland Itna',
    titleUr: 'خودی کو کر بلند اتنا',
    poetId: 'poet-iqbal',
    poetNameEn: 'Allama Iqbal',
    poetNameUr: 'علامہ محمد اقبال',
    category: 'Ghazal',
    linesEn: [
      'Elevate your Self to such heights,',
      'That before executing every destiny,',
      'God Himself shall ask the mortal:',
      '"Tell me, what is your desire?"'
    ],
    linesUr: [
      'خودی کو کر بلند اتنا کہ ہر تقدیر سے پہلے',
      'خدا بندے سے خود پوچھے بتا تیری رضا کیا ہے',
      'ستاروں سے آگے جہاں اور بھی ہیں',
      'ابھی عشق کے امتحاں اور بھی ہیں'
    ]
  },
  {
    id: 'poem-ghalib-dil',
    titleEn: 'Dil-e-Nadaan Tujhe Hua Kya Hai',
    titleUr: 'دلِ ناداں تجھے ہوا کیا ہے',
    poetId: 'poet-ghalib',
    poetNameEn: 'Mirza Ghalib',
    poetNameUr: 'مرزا اسد اللہ خان غالب',
    category: 'Ghazal',
    linesEn: [
      'O naive heart, what has befallen you?',
      'What after all is the cure for this pain?',
      'We are desperate, and they indifferent,',
      'O Lord, what kind of affair is this?'
    ],
    linesUr: [
      'دلِ ناداں تجھے ہوا کیا ہے',
      'آخر اس درد کی دوا کیا ہے',
      'ہم ہیں مشتاق اور وہ بیزار',
      'یا الٰہی یہ ماجرا کیا ہے'
    ]
  }
];

const defaultRecipes: Recipe[] = [
  {
    id: 'rec-biryani',
    titleEn: 'Authentic Karachi Special Chicken Biryani',
    titleUr: 'اصلی کراچی چکن دم بریانی',
    categoryEn: 'Rice & Main Course',
    categoryUr: 'چاول و خاص پکوان',
    cookTimeMin: 55,
    servings: 6,
    difficulty: 'Medium',
    ingredientsEn: [
      '1 kg Basmati Rice (aged)',
      '1 kg Chicken pieces',
      '4 Medium sliced Onions (golden fried)',
      '4 Tomatoes chopped with green chillies',
      '1 cup Yoghurt (whisked)',
      '2 tbsp Ginger-Garlic paste',
      'Biryani Whole Spices (Star anise, green cardamom, cloves, cinnamon)',
      'Fresh mint, coriander, and kewra water with saffron'
    ],
    ingredientsUr: [
      '1 کلو باسمتی چاول (پرانے)',
      '1 کلو چکن کے ٹکڑے',
      '4 عدد پیاز (باریک کاٹ کر براؤن کیے ہوئے)',
      '4 عدد ٹماٹر اور ہری مرچیں',
      '1 کپ دہی (پھینٹا ہوا)',
      '2 کھانے کے چمچ ادرک لہسن پیسٹ',
      'ثابت گرم مصالحہ (بادیان، سبز الائچی، لونگ، دارچینی)',
      'پودینہ، ہرا دھنیا، زعفران اور کیوڑہ عرق'
    ],
    instructionsEn: [
      'Boil rice in salted water with whole spices until 75% done (1 kani), then drain.',
      'In a heavy pot, brown sliced onions. Add ginger-garlic paste and chicken; saute for 6 minutes.',
      'Add chopped tomatoes, yoghurt, and biryani spices; cook on medium flame until oil separates and chicken is tender.',
      'Layer half the aromatic rice at the bottom, spread chicken gravy with fried onions and mint leaves, then top with remaining rice.',
      'Drizzle saffron kewra water, seal with lid (Dum), and simmer on low heat for 15 minutes. Serve piping hot with raita and salad.'
    ],
    instructionsUr: [
      'کھلے پانی میں نمک اور ثابت گرم مصالحہ ڈال کر چاول ایک کنی ابال کر چھان لیں۔',
      'دیگچی میں تیل گرم کر کے پیاز سنہری کریں، پھر ادرک لہسن اور چکن ڈال کر 6 منٹ بھونیں۔',
      'ٹماٹر، دہی اور بریانی مصالحہ شامل کر کے ڈھانپ دیں تاکہ گوشت گل جائے اور تیل اوپر آ جائے۔',
      'دیگچی میں آدھے چاولوں کی تہہ لگائیں، اوپر قورمہ، تلا ہوا پیاز اور پودینہ پھیلائیں، پھر باقی چاول ڈال دیں۔',
      'زعفران اور کیوڑہ چھڑک کر دیگچی کو ڈھکن سے سیل کر کے 15 منٹ دم پر رکھیں۔ گرما گرم رائتے کے ساتھ پیش کریں۔'
    ],
    image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'rec-karahi',
    titleEn: 'Lahori Highway Mutton Karahi (Dhaba Style)',
    titleUr: 'لاہوری ہائی وے مٹن کڑاہی (ڈھابہ اسٹائل)',
    categoryEn: 'Meat & Curry',
    categoryUr: 'گوشت اور سالن',
    cookTimeMin: 45,
    servings: 4,
    difficulty: 'Easy',
    ingredientsEn: [
      '800g Fresh Mutton pieces',
      '6 Fresh red Tomatoes cut in halves',
      '2 tbsp Fresh Ginger julienne & chopped Garlic',
      '4 Green chillies slit lengthwise',
      'Crushed black pepper and roasted cumin coriander',
      'Fresh Desi Ghee / Butter for finishing'
    ],
    ingredientsUr: [
      '800 گرام تازہ مٹن کے چھوٹے ٹکڑے',
      '6 عدد سرخ ٹماٹر (درمیان سے کٹے ہوئے)',
      '2 چمچ باریک کٹی ادرک اور لہسن',
      '4 عدد ہری مرچیں',
      'کٹی ہوئی کالی مرچ اور بھنا ہوا زیرہ دھنیا',
      'دیسی گھی یا مکھن'
    ],
    instructionsEn: [
      'Boil mutton with ginger, garlic, salt and 1 cup water until 80% tender.',
      'Transfer to a hot cast-iron wok (karahi), arrange tomatoes cut-side down, cover for 5 mins, and peel tomato skins.',
      'Add green chillies, freshly ground black pepper, and cook on high flame until tomatoes blend into rich thick gravy.',
      'Finish with dollop of desi ghee, julienned ginger, and fresh coriander. Best savored with hot tandoori roghni naan.'
    ],
    instructionsUr: [
      'مٹن کو ادرک لہسن اور نمک ڈال کر ایک کپ پانی میں 80 فیصد گلا لیں۔',
      'لوہے کی کڑاہی میں گوشت ڈالیں، اوپر ٹماٹر آدھے کاٹ کر الٹے رکھیں اور 5 منٹ ڈھانپ کر چھلکا اتار لیں۔',
      'تیز آنچ پر ٹماٹروں کو اچھی طرح بھونیں تاکہ گاڑھا مصالحہ بن جائے، کالی مرچ اور ہری مرچ شامل کریں۔',
      'آخر میں دیسی گھی اور ادرک چھڑک کر تندوری روغنی نان کے ساتھ گرم گرم پیش کریں۔'
    ],
    image: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=80'
  }
];

const defaultJobs: JobListing[] = [
  {
    id: 'job-1',
    titleEn: 'Assistant Director (IT & Cyber Security) - BPS-17',
    titleUr: 'اسسٹنٹ ڈائریکٹر (آئی ٹی اور سائبر سیکیورٹی) - بی پی ایس 17',
    departmentEn: 'Federal Public Service Commission (FPSC)',
    departmentUr: 'فیڈرل پبلک سروس کمیشن (ایف پی ایس سی)',
    organizationType: 'Federal Govt',
    cityEn: 'Islamabad / All Pakistan',
    cityUr: 'اسلام آباد / ملک بھر میں تعیناتی',
    qualification: 'BS / MS Computer Science or Software Engineering',
    vacancies: 24,
    deadline: '2026-11-25',
    salaryPkr: 'BPS-17 (Approx Rs. 145,000 + Allowances)'
  },
  {
    id: 'job-2',
    titleEn: 'Management Trainee Officer (MTO) - Batch 2026',
    titleUr: 'مینجمنٹ ٹرینی آفیسر (ایم ٹی او) - اسٹیٹ بینک پاکستان',
    departmentEn: 'State Bank of Pakistan (SBP Banking Services)',
    departmentUr: 'اسٹیٹ بینک آف پاکستان',
    organizationType: 'Banking',
    cityEn: 'Karachi, Lahore, Rawalpindi',
    cityUr: 'کراچی، لاہور، راولپنڈی',
    qualification: 'Master / 4-Year Bachelor in Business, Economics or Finance',
    vacancies: 60,
    deadline: '2026-11-30',
    salaryPkr: 'Rs. 180,000 / month with medical'
  },
  {
    id: 'job-3',
    titleEn: 'Senior Full Stack Software Engineer (React / Node / Cloud)',
    titleUr: 'سینئر سافٹ ویئر انجینئر - ٹیک پاکستان',
    departmentEn: 'National Technology Incubation Hub',
    departmentUr: 'نیشنل ٹیکنالوجی انکیوبیشن سینٹر',
    organizationType: 'Private',
    cityEn: 'Lahore (Hybrid)',
    cityUr: 'لاہور (ہائبرڈ)',
    qualification: 'BS / MS with 3+ years production experience',
    vacancies: 8,
    deadline: '2026-12-05',
    salaryPkr: 'Rs. 250,000 – 400,000 / month'
  }
];

const defaultAuditLogs: AuditLog[] = [
  {
    id: 'log-seed-1',
    timestamp: new Date().toISOString(),
    user: 'Super Admin',
    action: 'System Bootstrapped',
    details: '360Khabarnama production portal initialized.'
  }
];


const defaultSiteSettings: SiteSettings = {
  siteNameEn: '360Khabarnama',
  siteNameUr: '360 خبرنامہ',
  taglineEn: '360Khabarnama - News, Results, Finance & Everyday Utilities',
  taglineUr: '360 خبرنامہ - پاکستان کا مستند پورٹل: خبریں، نتائج اور سہولیات',
  primaryColor: '#059669', // Emerald Green (Pakistan color)
  breakingNewsEnabled: true,
  contactEmail: 'editor@360khabarnama.com',
  contactPhone: '+92 (051) 920-1122',
  adManagerEnabled: true,
  googleAnalyticsId: 'G-KHABAR360',
  leaderboardAdUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=970&q=80',
  sidebarAdUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=400&q=80'
};

const defaultDataProviders: DataProvider[] = [
  {
    id: 'currency-erapi',
    name: 'ExchangeRate API & SBP Interbank Gateway',
    category: 'currency',
    endpoint: 'https://open.er-api.com/v6/latest/USD',
    status: 'active',
    intervalMinutes: 30,
    lastSyncAt: new Date().toISOString(),
    nextSyncAt: new Date(Date.now() + 30 * 60000).toISOString(),
    lastError: null,
    isLicensed: true,
    attribution: 'ExchangeRate-API & SBP Foreign Exchange Regulations',
    requiresApiKey: false,
    hasApiKey: true,
    consecutiveFailures: 0,
    totalSyncs: 142,
    successfulSyncs: 142,
  },
  {
    id: 'weather-openmeteo',
    name: 'Open-Meteo High-Resolution Meteorological Service',
    category: 'weather',
    endpoint: 'https://api.open-meteo.com/v1/forecast',
    status: 'active',
    intervalMinutes: 60,
    lastSyncAt: new Date().toISOString(),
    nextSyncAt: new Date(Date.now() + 60 * 60000).toISOString(),
    lastError: null,
    isLicensed: true,
    attribution: 'Open-Meteo & Pakistan Meteorological Department (PMD)',
    requiresApiKey: false,
    hasApiKey: true,
    consecutiveFailures: 0,
    totalSyncs: 98,
    successfulSyncs: 98,
  },
  {
    id: 'gold-bullion',
    name: 'APGJAA Sarafa Bullion & XAU Spot Parity',
    category: 'gold',
    endpoint: 'https://api.frankfurter.app/latest',
    status: 'active',
    intervalMinutes: 60,
    lastSyncAt: new Date().toISOString(),
    nextSyncAt: new Date(Date.now() + 60 * 60000).toISOString(),
    lastError: null,
    isLicensed: true,
    attribution: 'All Pakistan Gem & Jewellers Association (APGJAA)',
    requiresApiKey: false,
    hasApiKey: true,
    consecutiveFailures: 0,
    totalSyncs: 64,
    successfulSyncs: 64,
  },
  {
    id: 'fuel-ogra',
    name: 'OGRA Petroleum Notification Gateway',
    category: 'fuel',
    endpoint: 'https://www.ogra.org.pk/petroleum-prices',
    status: 'active',
    intervalMinutes: 360,
    lastSyncAt: new Date().toISOString(),
    nextSyncAt: new Date(Date.now() + 360 * 60000).toISOString(),
    lastError: null,
    isLicensed: true,
    attribution: 'Oil & Gas Regulatory Authority (OGRA) Official Gazette',
    requiresApiKey: false,
    hasApiKey: true,
    consecutiveFailures: 0,
    totalSyncs: 24,
    successfulSyncs: 24,
  },
  {
    id: 'cricket-feed',
    name: 'PCB Official Tournament & ICC Match Feed',
    category: 'cricket',
    endpoint: 'https://www.pcb.com.pk/live-scores',
    status: 'active',
    intervalMinutes: 10,
    lastSyncAt: new Date().toISOString(),
    nextSyncAt: new Date(Date.now() + 10 * 60000).toISOString(),
    lastError: null,
    isLicensed: true,
    attribution: 'Pakistan Cricket Board (PCB) & International Cricket Council',
    requiresApiKey: false,
    hasApiKey: true,
    consecutiveFailures: 0,
    totalSyncs: 180,
    successfulSyncs: 180,
  },
];

const defaultFuelNotifications: FuelPriceNotification[] = [
  {
    id: 'notif-2026-11-01',
    notificationNumber: 'OGRA/POL-2026/Nov-01',
    effectiveDate: '01 Nov 2026',
    authority: 'Ministry of Energy (Petroleum Division) & OGRA',
    petrolPkr: 265.40,
    dieselPkr: 272.80,
    kerosenePkr: 174.90,
    lightDieselPkr: 160.20,
    status: 'verified',
    documentReference: 'F.No.2(1)/2026-Dist-POL (Official Gazette)',
    verifiedAt: new Date().toISOString(),
  },
];

const defaultAutomationSettings: AutomationSettings = {
  autoSyncEnabled: true,
  aiDraftsEnabled: true,
  autoPublishFactualWidgets: true,
  currencySyncIntervalMin: 30,
  weatherSyncIntervalMin: 60,
  goldSyncIntervalMin: 60,
  cricketSyncIntervalMin: 10,
  fuelCheckIntervalMin: 360,
  geminiCooldownMin: 20,
  lastGeminiCallAt: null,
};

const defaultHistoricalRates: HistoricalRateRecord[] = [
  { id: 'hist-gold-1', type: 'gold', symbol: 'GOLD_24K_TOLA', value: 278500, previousValue: 277300, change: 1200, changePercent: 0.43, timestamp: new Date(Date.now() - 86400000).toISOString(), source: 'APGJAA Bullion Market' },
  { id: 'hist-gold-2', type: 'gold', symbol: 'GOLD_24K_TOLA', value: 277300, previousValue: 276500, change: 800, changePercent: 0.29, timestamp: new Date(Date.now() - 172800000).toISOString(), source: 'APGJAA Bullion Market' },
  { id: 'hist-usd-1', type: 'currency', symbol: 'USD/PKR', value: 278.40, previousValue: 278.65, change: -0.25, changePercent: -0.09, timestamp: new Date(Date.now() - 86400000).toISOString(), source: 'ExchangeRate-API' },
  { id: 'hist-usd-2', type: 'currency', symbol: 'USD/PKR', value: 278.65, previousValue: 278.90, change: -0.25, changePercent: -0.09, timestamp: new Date(Date.now() - 172800000).toISOString(), source: 'ExchangeRate-API' },
  { id: 'hist-petrol-1', type: 'fuel', symbol: 'PETROL', value: 265.40, previousValue: 267.44, change: -2.04, changePercent: -0.76, timestamp: new Date(Date.now() - 432000000).toISOString(), source: 'OGRA Notification' },
];

const defaultAdminUsers: AdminUser[] = [
  {
    id: 'usr-1',
    nameEn: 'Tariq Mansoor',
    nameUr: 'طارق منصور',
    email: 'editor@360khabarnama.com',
    role: 'Super Admin',
    status: 'active',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    bioEn: 'Editor-in-Chief overseeing 360Khabarnama national and international coverage.',
    bioUr: 'چیف ایڈیٹر 360 خبرنامہ۔ قومی و بین الاقوامی ادارتی پالیسی کے نگراں۔',
    articlesCount: 48,
    lastLogin: new Date().toISOString(),
    createdAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 'usr-2',
    nameEn: 'Ayesha Khan',
    nameUr: 'عائشہ خان',
    email: 'ayesha@360khabarnama.com',
    role: 'Managing Editor',
    status: 'active',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80',
    bioEn: 'Managing Editor leading economic investigation and investigative journalism.',
    bioUr: 'مینجنگ ایڈیٹر، معاشی اور تحقیقی صحافت کی نگراں۔',
    articlesCount: 32,
    lastLogin: new Date(Date.now() - 3600000).toISOString(),
    createdAt: '2026-02-01T00:00:00Z',
  },
  {
    id: 'usr-3',
    nameEn: 'Zafar Iqbal',
    nameUr: 'ظفر اقبال',
    email: 'zafar@360khabarnama.com',
    role: 'Reporter',
    status: 'active',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    bioEn: 'Senior Parliamentary and Islamabad Bureau Correspondent.',
    bioUr: 'سینئر پارلیمانی نامہ نگار، اسلام آباد بیورو۔',
    articlesCount: 64,
    lastLogin: new Date(Date.now() - 7200000).toISOString(),
    createdAt: '2026-02-10T00:00:00Z',
  },
  {
    id: 'usr-4',
    nameEn: 'Hamza Farooq',
    nameUr: 'حمزہ فاروق',
    email: 'seo@360khabarnama.com',
    role: 'SEO Specialist',
    status: 'active',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    bioEn: 'Search Engine Optimization and Technical Growth Architect.',
    bioUr: 'سرچ انجن آپٹیمائزیشن اور ٹیکنیکل گروتھ اسپیشلسٹ۔',
    articlesCount: 12,
    lastLogin: new Date(Date.now() - 14400000).toISOString(),
    createdAt: '2026-03-01T00:00:00Z',
  },
  {
    id: 'usr-5',
    nameEn: 'Bilal Ahmed',
    nameUr: 'بلال احمد',
    email: 'ads@360khabarnama.com',
    role: 'Advertising Manager',
    status: 'active',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80',
    bioEn: 'Head of Digital Monetization, AdSense & Direct Brand Partnerships.',
    bioUr: 'ڈیجیٹل مونیٹائزیشن، ایڈسینس اور برانڈ پارٹنرشپ مینیجر۔',
    articlesCount: 5,
    lastLogin: new Date(Date.now() - 86400000).toISOString(),
    createdAt: '2026-03-15T00:00:00Z',
  },
];

const defaultMediaAssets: MediaAsset[] = [
  {
    id: 'med-1',
    filename: 'psx_stock_exchange_trading.webp',
    url: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=300&q=80',
    sizeBytes: 142800,
    mimeType: 'image/webp',
    category: 'business',
    captionEn: 'Karachi Stock Exchange Trading Floor Activity',
    captionUr: 'پاکستان اسٹاک ایکسچینج کراچی میں ٹریڈنگ سرگرمیاں',
    altTextEn: 'Pakistan Stock Exchange building trading floor graph',
    altTextUr: 'پاکستان اسٹاک ایکسچینج عمارت اور تجارتی اسکرین',
    width: 1200,
    height: 800,
    uploadedBy: 'Tariq Mansoor',
    uploadedAt: '2026-11-01T10:00:00Z',
    usageCount: 4,
  },
  {
    id: 'med-2',
    filename: 'gold_bars_bullion_reserve.webp',
    url: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=300&q=80',
    sizeBytes: 185400,
    mimeType: 'image/webp',
    category: 'finance',
    captionEn: 'Pure 24K Gold Bullion Bars in Sarafa Market',
    captionUr: 'صرافہ مارکیٹ میں خالص 24 قیراط سونے کے بسکٹ',
    altTextEn: 'Pure Gold 24k bars bullion tola in Pakistan',
    altTextUr: 'پاکستان میں 24 قیراط سونے کے بسکٹ اور تولہ',
    width: 1200,
    height: 800,
    uploadedBy: 'Ayesha Khan',
    uploadedAt: '2026-11-02T14:30:00Z',
    usageCount: 6,
  },
  {
    id: 'med-3',
    filename: 'cricket_champions_trophy_ball.webp',
    url: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=300&q=80',
    sizeBytes: 210200,
    mimeType: 'image/webp',
    category: 'sports',
    captionEn: 'Pakistan National Cricket Team Training Session',
    captionUr: 'پاکستان قومی کرکٹ ٹیم کا پریکٹس سیشن',
    altTextEn: 'Pakistan cricket stadium green grass and leather ball',
    altTextUr: 'قومی کرکٹ اسٹیڈیم اور میچ پریکٹس',
    width: 1200,
    height: 800,
    uploadedBy: 'Zafar Iqbal',
    uploadedAt: '2026-11-03T09:15:00Z',
    usageCount: 8,
  },
  {
    id: 'med-4',
    filename: 'lahore_weather_margalla_hills.webp',
    url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=300&q=80',
    sizeBytes: 198000,
    mimeType: 'image/webp',
    category: 'weather',
    captionEn: 'Margalla Hills Clear Horizon in Islamabad',
    captionUr: 'اسلام آباد میں مارگلہ کی خوبصورت پہاڑیاں اور شفاف مطلع',
    altTextEn: 'Margalla hills green nature in Islamabad Pakistan',
    altTextUr: 'اسلام آباد مارگلہ پہاڑیوں کا خوبصورت قدرتی منظر',
    width: 1200,
    height: 800,
    uploadedBy: 'Tariq Mansoor',
    uploadedAt: '2026-11-04T11:45:00Z',
    usageCount: 3,
  },
];

const defaultAdPlacements: AdPlacement[] = [
  {
    id: 'slot-1',
    slotId: 'header_leaderboard',
    name: 'Top Header Leaderboard (728x90 / Responsive)',
    location: 'header_banner',
    providerType: 'direct',
    dimensions: '728x90',
    targetDevices: 'all',
    enabled: true,
    adCodeSnippet: '',
    campaignId: 'camp-1',
    impressions: 48520,
    clicks: 1420,
  },
  {
    id: 'slot-2',
    slotId: 'home_mid_leaderboard',
    name: 'Homepage Mid-Feed Billboard (970x250)',
    location: 'home_leaderboard',
    providerType: 'direct',
    dimensions: '970x250',
    targetDevices: 'desktop',
    enabled: true,
    campaignId: 'camp-2',
    impressions: 34100,
    clicks: 980,
  },
  {
    id: 'slot-3',
    slotId: 'sidebar_rectangle',
    name: 'Sidebar Sticky Medium Rectangle (300x250)',
    location: 'sidebar',
    providerType: 'adsense',
    dimensions: '300x250',
    targetDevices: 'all',
    enabled: true,
    impressions: 62400,
    clicks: 1890,
  },
  {
    id: 'slot-4',
    slotId: 'article_in_content',
    name: 'Article Body Mid-Paragraph Banner (336x280)',
    location: 'article_inline',
    providerType: 'adsense',
    dimensions: '336x280',
    targetDevices: 'all',
    enabled: true,
    impressions: 89100,
    clicks: 2940,
  },
  {
    id: 'slot-5',
    slotId: 'mobile_sticky_bottom',
    name: 'Mobile Anchor Sticky Banner (320x50)',
    location: 'mobile_sticky',
    providerType: 'direct',
    dimensions: '320x50',
    targetDevices: 'mobile',
    enabled: true,
    impressions: 112000,
    clicks: 4100,
  },
];

const defaultAdCampaigns: AdCampaign[] = [
  {
    id: 'camp-1',
    advertiserName: 'Bank Alfalah Premier Banking',
    campaignName: 'Premier Roshan Digital Account 2026',
    bannerUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=970&q=80',
    destinationUrl: 'https://www.bankalfalah.com',
    budgetPkr: 450000,
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    status: 'active',
    impressions: 48520,
    clicks: 1420,
    ctr: 2.92,
    placementSlotIds: ['slot-1', 'slot-2'],
  },
  {
    id: 'camp-2',
    advertiserName: 'Zong 4G Digital Enterprise',
    campaignName: 'Super Unlimited High-Speed Fiber',
    bannerUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=400&q=80',
    destinationUrl: 'https://www.zong.com.pk',
    budgetPkr: 320000,
    startDate: '2026-11-05',
    endDate: '2026-12-05',
    status: 'active',
    impressions: 34100,
    clicks: 980,
    ctr: 2.87,
    placementSlotIds: ['slot-3'],
  },
];

const defaultSeoPages: SeoPageConfig[] = [
  {
    id: 'seo-home',
    path: '/',
    titleEn: '360Khabarnama – Pakistan News, Gold Rates, Currency & Live Scores',
    titleUr: '360 خبرنامہ – پاکستان کی تازہ ترین خبریں، سونا ریٹس، کرنسی اور لائیو اسکور',
    metaDescEn: '360Khabarnama is Pakistan’s leading bilingual digital portal for breaking news, APGJAA bullion rates, SBP currency exchange, BISE board results, and cricket.',
    metaDescUr: '360 خبرنامہ پاکستان کا مستند ڈیجیٹل پورٹل: بریکنگ نیوز، سونے و چاندی کے نرخ، اوپن مارکیٹ کرنسی، تعلیمی بورڈ نتائج اور کرکٹ لائیو اسکور۔',
    canonicalUrl: 'https://360khabarnama.com/',
    robotsDirectives: 'index, follow, max-image-preview:large',
    ogImage: 'https://360khabarnama.com/assets/aistudio/Modern_Green_and_Gold_News_Logo_2e9a99d4.png',
    schemaType: 'NewsMediaOrganization',
    focusKeyword: 'Pakistan news, gold rate pakistan, usd to pkr',
    lastAuditedAt: new Date().toISOString(),
  },
  {
    id: 'seo-business',
    path: '/business',
    titleEn: 'Today Gold Rates & Currency Exchange in Pakistan – 360Khabarnama',
    titleUr: 'آج سونے کے نرخ اور کرنسی ایکسچینج پاکستان – 360 خبرنامہ',
    metaDescEn: 'Live verified 24K and 22K gold rates per tola in Karachi, Lahore and Islamabad. Check real-time interbank & open market USD/PKR exchange rates.',
    metaDescUr: 'پاکستان بھر میں 24 قیراط اور 22 قیراط سونے کے فی تولہ نرخ اور اسٹیٹ بینک کے تصدیق شدہ کرنسی ریٹس۔',
    canonicalUrl: 'https://360khabarnama.com/business',
    robotsDirectives: 'index, follow',
    ogImage: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=1200&q=80',
    schemaType: 'FinancialProduct',
    focusKeyword: 'gold rate in pakistan today, dollar rate in pakistan',
    lastAuditedAt: new Date().toISOString(),
  },
  {
    id: 'seo-weather',
    path: '/weather',
    titleEn: 'Pakistan Live Weather & Smog (AQI) Air Quality Index – 360Khabarnama',
    titleUr: 'پاکستان کا لائیو موسم اور اسموگ ایئر کوالٹی انڈیکس – 360 خبرنامہ',
    metaDescEn: 'Check real-time meteorological observations, temperatures and smog AQI levels for Karachi, Lahore, Islamabad, Multan and all major Pakistani cities.',
    metaDescUr: 'کراچی، لاہور، اسلام آباد، ملتان اور ملک بھر کے شہروں کا لائیو درجہ حرارت اور اسموگ ایئر کوالٹی انڈیکس۔',
    canonicalUrl: 'https://360khabarnama.com/weather',
    robotsDirectives: 'index, follow',
    ogImage: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
    schemaType: 'WeatherForecast',
    focusKeyword: 'lahore smog aqi, weather in karachi, pakistan weather forecast',
    lastAuditedAt: new Date().toISOString(),
  },
  {
    id: 'seo-cricket',
    path: '/sports',
    titleEn: 'Live Cricket Scores, PSL & Pakistan Match Commentary – 360Khabarnama',
    titleUr: 'لائیو کرکٹ اسکور، پی ایس ایل اور قومی ٹیم کے میچز – 360 خبرنامہ',
    metaDescEn: 'Ball-by-ball updates, live scorecards, Pakistan national cricket fixtures, and ICC Champions Trophy news.',
    metaDescUr: 'پاکستان کرکٹ ٹیم کے تمام میچز، پی ایس ایل اور آئی سی سی ٹورنامنٹس کا لائیو اسکور کارڈ اور اپ ڈیٹس۔',
    canonicalUrl: 'https://360khabarnama.com/sports',
    robotsDirectives: 'index, follow',
    ogImage: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=1200&q=80',
    schemaType: 'SportsEvent',
    focusKeyword: 'live cricket score pakistan, psl schedule, champions trophy',
    lastAuditedAt: new Date().toISOString(),
  },
];

const defaultSearchConsole: SearchConsoleMetrics = {
  connected: true,
  impressions: 1480240,
  clicks: 92410,
  ctr: 6.24,
  averagePosition: 8.4,
  topQueries: [
    { query: 'gold rate in pakistan today', clicks: 28450, impressions: 340200, position: 2.1 },
    { query: 'dollar rate in pakistan today', clicks: 21300, impressions: 295000, position: 3.2 },
    { query: '360Khabarnama news', clicks: 14200, impressions: 89000, position: 1.0 },
    { query: 'lahore smog aqi live', clicks: 9800, impressions: 164000, position: 4.5 },
    { query: 'live cricket score pakistan vs aus', clicks: 8700, impressions: 198000, position: 3.8 },
    { query: 'petrol price in pakistan ogra notification', clicks: 6400, impressions: 142000, position: 2.8 },
    { query: '1500 prize bond draw result', clicks: 5800, impressions: 112000, position: 3.5 },
    { query: 'bise lahore matric result 2026', clicks: 5200, impressions: 98000, position: 4.1 },
  ],
  topPages: [
    { path: '/', clicks: 38400, impressions: 480000, ctr: 8.0 },
    { path: '/business', clicks: 29800, impressions: 420000, ctr: 7.1 },
    { path: '/weather', clicks: 12400, impressions: 210000, ctr: 5.9 },
    { path: '/sports', clicks: 9200, impressions: 190000, ctr: 4.8 },
    { path: '/education', clicks: 6800, impressions: 120000, ctr: 5.6 },
  ],
  devices: [
    { device: 'Mobile', percent: 78.4 },
    { device: 'Desktop', percent: 18.2 },
    { device: 'Tablet', percent: 3.4 },
  ],
  countries: [
    { country: 'Pakistan', percent: 84.2 },
    { country: 'United Arab Emirates', percent: 5.8 },
    { country: 'Saudi Arabia', percent: 4.6 },
    { country: 'United Kingdom', percent: 3.1 },
    { country: 'United States', percent: 1.5 },
    { country: 'Others', percent: 0.8 },
  ],
  lastRefreshedAt: new Date().toISOString(),
};

const defaultRedirectRules: RedirectRule[] = [
  {
    id: 'red-1',
    sourcePath: '/epaper',
    targetPath: '/',
    statusCode: 410,
    hits: 148,
    active: true,
    createdAt: '2026-11-06T00:00:00Z',
  },
  {
    id: 'red-2',
    sourcePath: '/en/epaper',
    targetPath: '/',
    statusCode: 410,
    hits: 89,
    active: true,
    createdAt: '2026-11-06T00:00:00Z',
  },
  {
    id: 'red-3',
    sourcePath: '/ur/epaper',
    targetPath: '/',
    statusCode: 410,
    hits: 112,
    active: true,
    createdAt: '2026-11-06T00:00:00Z',
  },
  {
    id: 'red-4',
    sourcePath: '/rates/gold',
    targetPath: '/business',
    statusCode: 301,
    hits: 642,
    active: true,
    createdAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'red-5',
    sourcePath: '/rates/dollar',
    targetPath: '/business',
    statusCode: 301,
    hits: 580,
    active: true,
    createdAt: '2026-09-01T00:00:00Z',
  },
];

const defaultBrokenLinks: BrokenLinkReport[] = [
  {
    id: 'bl-1',
    url: 'https://360khabarnama.com/archive/2025/old-article-link',
    statusCode: 404,
    foundOnPage: '/archive',
    discoveredAt: '2026-11-05T08:00:00Z',
    resolved: false,
  },
];

const defaultSubscribers: NewsletterSubscriber[] = [
  {
    id: 'sub-1',
    email: 'reader1@gmail.com',
    language: 'both',
    frequency: 'daily',
    subscribedAt: '2026-10-15T08:00:00Z',
    status: 'active',
  },
  {
    id: 'sub-2',
    email: 'karachinews@yahoo.com',
    language: 'ur',
    frequency: 'breaking',
    subscribedAt: '2026-10-20T12:00:00Z',
    status: 'active',
  },
  {
    id: 'sub-3',
    email: 'investor.pk@hotmail.com',
    language: 'en',
    frequency: 'daily',
    subscribedAt: '2026-10-28T16:00:00Z',
    status: 'active',
  },
];

const defaultNotifications: AudienceNotification[] = [
  {
    id: 'notif-1',
    titleEn: 'Breaking: KSE-100 Benchmark Crosses Historical Milestone',
    titleUr: 'بریکنگ نیوز: پاکستان اسٹاک ایکسچینج تاریخ کی بلند ترین سطح پر پہنچ گیا',
    messageEn: 'The benchmark index surged over 600 points today amid heavy institutional participation.',
    messageUr: 'سرمایہ کاروں کے زبردست اعتماد کے باعث مارکیٹ میں تاریخی تیزی، انڈیکس نے نیا ریکارڈ قائم کیا۔',
    channel: 'push',
    category: 'business',
    sentAt: '2026-11-06T14:30:00Z',
    recipientsCount: 42800,
    status: 'sent',
  },
];

const defaultHomepageConfig: HomepageLayoutConfig = {
  sections: [
    { id: 'breaking_ticker', nameEn: 'Breaking News Ticker', nameUr: 'تازہ ترین بریکنگ نیوز بار', enabled: true, order: 1 },
    { id: 'hero_lead', nameEn: 'Lead Story & Featured Slider', nameUr: 'لیڈ اسٹوری اور اہم خبریں', enabled: true, order: 2 },
    { id: 'market_rates', nameEn: 'Live Financial Market Tickers (Gold & USD)', nameUr: 'لائیو مارکیٹ ریٹس پینل', enabled: true, order: 3 },
    { id: 'top_news_grid', nameEn: 'National & World News Grid', nameUr: 'قومی و بین الاقوامی خبریں', enabled: true, order: 4 },
    { id: 'weather_aqi', nameEn: 'Live Weather & Smog Observations', nameUr: 'موسم اور اسموگ ائیر کوالٹی ویجیٹ', enabled: true, order: 5 },
    { id: 'cricket_hub', nameEn: 'Live Cricket Scoreboard & Tournament News', nameUr: 'لائیو کرکٹ اسکور بورڈ', enabled: true, order: 6 },
    { id: 'popular_utilities', nameEn: 'Daily Utilities (Prayer, Currency, Calculators)', nameUr: 'روزمرہ سہولیات و ٹولز', enabled: true, order: 7 },
  ],
};

class DatabaseManager {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.loadDatabase();
  }

  private loadDatabase(): DatabaseSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const sourceFile = fs.existsSync(DB_FILE)
        ? DB_FILE
        : fs.existsSync(SEED_DB_FILE)
        ? SEED_DB_FILE
        : null;
      if (sourceFile) {
        const raw = fs.readFileSync(sourceFile, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!parsed.dataProviders || parsed.dataProviders.length === 0) parsed.dataProviders = defaultDataProviders;
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
        if (!parsed.searchConsole) parsed.searchConsole = defaultSearchConsole;
        if (!parsed.redirectRules || parsed.redirectRules.length === 0) parsed.redirectRules = defaultRedirectRules;
        if (!parsed.brokenLinks) parsed.brokenLinks = defaultBrokenLinks;
        if (!parsed.subscribers || parsed.subscribers.length === 0) parsed.subscribers = defaultSubscribers;
        if (!parsed.notifications || parsed.notifications.length === 0) parsed.notifications = defaultNotifications;
        if (!parsed.pushSubscriptions) parsed.pushSubscriptions = [];
        if (!parsed.homepageConfig) parsed.homepageConfig = defaultHomepageConfig;
        let migrated = false;
        if ('epaperPages' in parsed) {
          delete parsed.epaperPages;
          migrated = true;
        }
        if (!parsed.siteSettings || parsed.siteSettings.siteNameEn === 'Pakistan Digital Portal') {
          parsed.siteSettings = {
            ...defaultSiteSettings,
            ...(parsed.siteSettings || {}),
            siteNameEn: '360Khabarnama',
            siteNameUr: '360 خبرنامہ',
            taglineEn: defaultSiteSettings.taglineEn,
            taglineUr: defaultSiteSettings.taglineUr,
            contactEmail: 'editor@360khabarnama.com',
            googleAnalyticsId:
              parsed.siteSettings?.googleAnalyticsId === 'G-PAKPORTAL2026'
                ? defaultSiteSettings.googleAnalyticsId
                : parsed.siteSettings?.googleAnalyticsId || defaultSiteSettings.googleAnalyticsId,
          };
          migrated = true;
        }
        if (migrated) {
          this.saveDatabase(parsed);
        }
        return parsed;
      }
    } catch (e) {
      console.warn('Could not read existing database, falling back to defaults:', e);
    }

    const initial: DatabaseSchema = {
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
      searchConsole: defaultSearchConsole,
      redirectRules: defaultRedirectRules,
      brokenLinks: defaultBrokenLinks,
      subscribers: defaultSubscribers,
      notifications: defaultNotifications,
      homepageConfig: defaultHomepageConfig,
    };

    this.saveDatabase(initial);
    return initial;
  }

  private saveDatabase(dataToSave: DatabaseSchema) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmpFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(dataToSave, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (e) {
      console.error('Failed to write database to disk:', e);
    }
  }

  public getData(): DatabaseSchema {
    return this.data;
  }

  public logAudit(user: string, action: string, details: string) {
    const entry: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
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
  public getArticles(category?: string, tag?: string, search?: string, status: string = 'published') {
    let list = this.data.articles;
    if (status && status !== 'all') {
      list = list.filter(a => a.status === status);
    }
    if (category && category !== 'all') {
      list = list.filter(a => a.category.toLowerCase() === category.toLowerCase());
    }
    if (tag) {
      list = list.filter(a => a.tags.some(t => t.toLowerCase() === tag.toLowerCase()));
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.titleEn.toLowerCase().includes(q) ||
        a.titleUr.includes(q) ||
        a.summaryEn.toLowerCase().includes(q) ||
        a.summaryUr.includes(q)
      );
    }
    return list;
  }

  public getArticleBySlugOrId(identifier: string) {
    return this.data.articles.find(a => a.slug === identifier || a.id === identifier);
  }

  public incrementArticleViews(id: string) {
    const art = this.data.articles.find(a => a.id === id);
    if (art) {
      art.views += 1;
      this.saveDatabase(this.data);
    }
  }

  public upsertArticle(article: Article, actor: string = 'Editor'): Article {
    const index = this.data.articles.findIndex(a => a.id === article.id);
    if (index >= 0) {
      const existing = this.data.articles[index];
      const versionSnapshot: ArticleVersion = {
        versionId: `ver-${Date.now()}`,
        savedAt: new Date().toISOString(),
        savedBy: actor,
        titleEn: existing.titleEn,
        titleUr: existing.titleUr,
        summaryEn: existing.summaryEn,
        summaryUr: existing.summaryUr,
        contentEn: existing.contentEn,
        contentUr: existing.contentUr,
        changeNote: `Edited by ${actor}`,
      };

      const versions = existing.versions || [];
      versions.unshift(versionSnapshot);
      if (versions.length > 20) versions.pop();

      this.data.articles[index] = {
        ...existing,
        ...article,
        versions,
        updatedAt: new Date().toISOString(),
      };
      this.logAudit(actor, 'Article Updated', `Updated article: ${article.titleEn} (Status: ${article.status})`);
    } else {
      const newArticle: Article = {
        ...article,
        id: article.id || `art-${Date.now()}`,
        views: article.views || 0,
        status: article.status || 'published',
        publishedAt: article.status === 'published' ? (article.publishedAt || new Date().toISOString()) : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        versions: [],
      };
      this.data.articles.unshift(newArticle);
      this.logAudit(actor, 'Article Created', `Created article: ${article.titleEn} (Status: ${newArticle.status})`);
    }
    this.saveDatabase(this.data);
    return article;
  }

  public deleteArticle(id: string, actor: string = 'Admin'): boolean {
    const prevLen = this.data.articles.length;
    this.data.articles = this.data.articles.filter(a => a.id !== id);
    if (this.data.articles.length < prevLen) {
      this.logAudit(actor, 'Article Deleted', `Deleted article ID: ${id}`);
      this.saveDatabase(this.data);
      return true;
    }
    return false;
  }

  public rollbackArticle(articleId: string, versionId: string, actor: string = 'Editor'): Article | null {
    const art = this.data.articles.find(a => a.id === articleId);
    if (!art || !art.versions) return null;
    const version = art.versions.find(v => v.versionId === versionId);
    if (!version) return null;

    art.titleEn = version.titleEn;
    art.titleUr = version.titleUr;
    art.summaryEn = version.summaryEn;
    art.summaryUr = version.summaryUr;
    art.contentEn = version.contentEn;
    art.contentUr = version.contentUr;
    art.updatedAt = new Date().toISOString();

    this.logAudit(actor, 'Article Version Rolled Back', `Restored article "${art.titleEn}" to version ${versionId}`);
    this.saveDatabase(this.data);
    return art;
  }


  // Results
  public findExamResult(boardCode: string, rollNumber: string, year: number) {
    return this.data.results.find(
      r => r.boardCode.toUpperCase() === boardCode.toUpperCase() &&
           r.rollNumber.trim() === rollNumber.trim() &&
           (!year || r.year === year)
    );
  }

  public addExamResult(result: ExamResult) {
    this.data.results.push(result);
    this.saveDatabase(this.data);
  }

  // Site Settings
  public updateSettings(settings: Partial<SiteSettings>, actor: string = 'Admin') {
    this.data.siteSettings = { ...this.data.siteSettings, ...settings };
    this.logAudit(actor, 'Settings Updated', 'Updated site appearance and configuration');
    this.saveDatabase(this.data);
    return this.data.siteSettings;
  }

  // Weather update
  public updateCityWeather(cityId: string, updates: Partial<WeatherData>) {
    const city = this.data.weather.find(w => w.cityId === cityId);
    if (city) {
      Object.assign(city, updates);
      this.saveDatabase(this.data);
    }
  }

  // Prize bond checker
  public checkPrizeBond(denomination: number, bondNumber: string) {
    const draws = this.data.prizeBonds.filter(d => d.denomination === denomination);
    const cleanNumber = bondNumber.trim().padStart(6, '0');
    
    for (const draw of draws) {
      if (draw.firstPrizeBond === cleanNumber) {
        return { won: true, prizeTier: 'First Prize', prizeAmount: draw.firstPrizePkr, draw };
      }
      if (draw.secondPrizeBonds.includes(cleanNumber)) {
        return { won: true, prizeTier: 'Second Prize', prizeAmount: draw.secondPrizePkr, draw };
      }
      if (draw.thirdPrizeSample.includes(cleanNumber)) {
        return { won: true, prizeTier: 'Third Prize', prizeAmount: draw.thirdPrizePkr, draw };
      }
    }
    return { won: false, message: 'No prize match found in recent official draws for this bond number.' };
  }

  // --- Live Data & Automation Methods ---
  public getDataProviders(): DataProvider[] {
    return this.data.dataProviders || [];
  }

  public getDataProvider(id: string): DataProvider | undefined {
    return (this.data.dataProviders || []).find(p => p.id === id);
  }

  public updateDataProvider(id: string, updates: Partial<DataProvider>) {
    const provider = (this.data.dataProviders || []).find(p => p.id === id);
    if (provider) {
      Object.assign(provider, updates);
      this.saveDatabase(this.data);
    }
  }

  public recordSyncRun(run: SyncJobRun) {
    if (!this.data.syncJobRuns) this.data.syncJobRuns = [];
    this.data.syncJobRuns.unshift(run);
    if (this.data.syncJobRuns.length > 150) {
      this.data.syncJobRuns = this.data.syncJobRuns.slice(0, 150);
    }
    this.saveDatabase(this.data);
  }

  public getSyncHistory(limit: number = 50): SyncJobRun[] {
    return (this.data.syncJobRuns || []).slice(0, limit);
  }

  public recordHistoricalRate(record: HistoricalRateRecord) {
    if (!this.data.historicalRates) this.data.historicalRates = [];
    this.data.historicalRates.unshift(record);
    if (this.data.historicalRates.length > 500) {
      this.data.historicalRates = this.data.historicalRates.slice(0, 500);
    }
    this.saveDatabase(this.data);
  }

  public getHistoricalRates(type?: string, symbol?: string, limit: number = 30): HistoricalRateRecord[] {
    let records = this.data.historicalRates || [];
    if (type) {
      records = records.filter(r => r.type.toLowerCase() === type.toLowerCase());
    }
    if (symbol) {
      records = records.filter(r => r.symbol.toLowerCase() === symbol.toLowerCase());
    }
    return records.slice(0, limit);
  }

  public getFuelNotifications(): FuelPriceNotification[] {
    return this.data.fuelPriceNotifications || [];
  }

  public addFuelNotification(notification: FuelPriceNotification) {
    if (!this.data.fuelPriceNotifications) this.data.fuelPriceNotifications = [];
    this.data.fuelPriceNotifications.unshift(notification);
    this.saveDatabase(this.data);
  }

  public getAiDrafts(status?: string): AiContentDraft[] {
    const drafts = this.data.aiContentDrafts || [];
    if (status && status !== 'all') {
      return drafts.filter(d => d.status === status);
    }
    return drafts;
  }

  public saveAiDraft(draft: AiContentDraft) {
    if (!this.data.aiContentDrafts) this.data.aiContentDrafts = [];
    const idx = this.data.aiContentDrafts.findIndex(d => d.id === draft.id);
    if (idx >= 0) {
      this.data.aiContentDrafts[idx] = draft;
    } else {
      this.data.aiContentDrafts.unshift(draft);
    }
    this.saveDatabase(this.data);
  }

  public approveAiDraft(draftId: string, actor: string = 'Editor'): { success: boolean; article?: Article } {
    if (!this.data.aiContentDrafts) return { success: false };
    const draft = this.data.aiContentDrafts.find(d => d.id === draftId);
    if (!draft) return { success: false };

    draft.status = 'published';
    draft.approvedBy = actor;
    draft.publishedAt = new Date().toISOString();

    // Create or publish as official news article
    const newArticle: Article = {
      id: `art-${draft.id}`,
      slug: `${draft.category}-update-${Date.now()}`,
      category: draft.category === 'cricket' ? 'sports' : 'business',
      titleEn: draft.titleEn,
      titleUr: draft.titleUr,
      summaryEn: draft.summaryEn,
      summaryUr: draft.summaryUr,
      contentEn: draft.contentEn,
      contentUr: draft.contentUr,
      author: {
        id: 'live-bureau',
        nameEn: '360Khabarnama Live Bureau (Gemini Source Grounded)',
        nameUr: '360 خبرنامہ لائیو بیورو (مستند ڈیٹا)',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        role: 'Verified Data Desk'
      },
      heroImage: draft.category === 'gold' 
        ? 'https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=800&q=80'
        : draft.category === 'fuel'
        ? 'https://images.unsplash.com/photo-1545459720-aac8509eb02c?auto=format&fit=crop&w=800&q=80'
        : draft.category === 'currency'
        ? 'https://images.unsplash.com/photo-1580519542036-c47de6196ba5?auto=format&fit=crop&w=800&q=80'
        : 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=800&q=80',
      imageCaptionEn: `Verified factual update via ${draft.sourceAttribution || 'official records'}.`,
      imageCaptionUr: 'مستند سرکاری اعداد و شمار اور مارکیٹ ڈیٹا کے مطابق۔',
      status: 'published',
      isBreaking: draft.triggerReason.includes('Substantial') || draft.category === 'fuel',
      isFeatured: true,
      isTrending: true,
      readingTimeMin: 2,
      tags: [draft.category, 'Pakistan', 'Live Update', 'Verified'],
      views: 0,
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.upsertArticle(newArticle, actor);
    this.logAudit(actor, 'AI Draft Approved & Published', `Published article from AI draft: ${draft.titleEn}`);
    this.saveDatabase(this.data);

    return { success: true, article: newArticle };
  }

  public rejectAiDraft(draftId: string, actor: string = 'Editor'): boolean {
    if (!this.data.aiContentDrafts) return false;
    const draft = this.data.aiContentDrafts.find(d => d.id === draftId);
    if (!draft) return false;

    draft.status = 'rejected';
    draft.approvedBy = actor;
    this.logAudit(actor, 'AI Draft Rejected', `Dismissed AI draft: ${draft.titleEn}`);
    this.saveDatabase(this.data);
    return true;
  }

  public getAutomationSettings(): AutomationSettings {
    return this.data.automationSettings || defaultAutomationSettings;
  }

  public updateAutomationSettings(settings: Partial<AutomationSettings>, actor: string = 'Admin'): AutomationSettings {
    this.data.automationSettings = {
      ...(this.data.automationSettings || defaultAutomationSettings),
      ...settings
    };
    this.logAudit(actor, 'Automation Settings Updated', 'Modified live sync intervals or engine flags');
    this.saveDatabase(this.data);
    return this.data.automationSettings;
  }

  public updateCurrencyRates(rates: CurrencyRate[]) {
    this.data.currencyRates = rates;
    this.saveDatabase(this.data);
  }

  public updateGoldRates(rates: GoldRate[]) {
    this.data.goldRates = rates;
    this.saveDatabase(this.data);
  }

  public updateFuelPrices(prices: FuelPrice[]) {
    this.data.fuelPrices = prices;
    this.saveDatabase(this.data);
  }

  public updateWeatherData(weather: WeatherData[]) {
    this.data.weather = weather;
    this.saveDatabase(this.data);
  }

  public updateCricketMatches(matches: CricketMatch[]) {
    this.data.cricketMatches = matches;
    this.saveDatabase(this.data);
  }

  // --- Users & RBAC ---
  public getAdminUsers(): AdminUser[] {
    return this.data.adminUsers || [];
  }

  public upsertAdminUser(user: AdminUser, actor: string = 'Super Admin'): AdminUser {
    if (!this.data.adminUsers) this.data.adminUsers = [];
    const idx = this.data.adminUsers.findIndex(u => u.id === user.id);
    if (idx >= 0) {
      this.data.adminUsers[idx] = { ...this.data.adminUsers[idx], ...user };
      this.logAudit(actor, 'User Updated', `Updated staff account: ${user.nameEn} (${user.role})`);
    } else {
      const newUser: AdminUser = {
        ...user,
        id: user.id || `usr-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      this.data.adminUsers.push(newUser);
      this.logAudit(actor, 'User Created', `Created staff account: ${user.nameEn} (${user.role})`);
    }
    this.saveDatabase(this.data);
    return user;
  }

  public deleteAdminUser(id: string, actor: string = 'Super Admin'): boolean {
    if (!this.data.adminUsers) return false;
    const prevLen = this.data.adminUsers.length;
    this.data.adminUsers = this.data.adminUsers.filter(u => u.id !== id);
    if (this.data.adminUsers.length < prevLen) {
      this.logAudit(actor, 'User Removed', `Deactivated staff account ID: ${id}`);
      this.saveDatabase(this.data);
      return true;
    }
    return false;
  }

  // --- Media Library ---
  public getMediaAssets(category?: string, search?: string): MediaAsset[] {
    let assets = this.data.mediaAssets || [];
    if (category && category !== 'all') {
      assets = assets.filter(a => a.category.toLowerCase() === category.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      assets = assets.filter(a =>
        a.filename.toLowerCase().includes(q) ||
        a.captionEn.toLowerCase().includes(q) ||
        a.captionUr.includes(q) ||
        a.altTextEn.toLowerCase().includes(q)
      );
    }
    return assets;
  }

  public addMediaAsset(asset: MediaAsset, actor: string = 'Editor'): MediaAsset {
    if (!this.data.mediaAssets) this.data.mediaAssets = [];
    const newAsset: MediaAsset = {
      ...asset,
      id: asset.id || `med-${Date.now()}`,
      uploadedAt: new Date().toISOString(),
      usageCount: asset.usageCount || 1,
    };
    this.data.mediaAssets.unshift(newAsset);
    this.logAudit(actor, 'Media Uploaded', `Uploaded media file: ${asset.filename}`);
    this.saveDatabase(this.data);
    return newAsset;
  }

  public deleteMediaAsset(id: string, actor: string = 'Editor'): boolean {
    if (!this.data.mediaAssets) return false;
    const prev = this.data.mediaAssets.length;
    this.data.mediaAssets = this.data.mediaAssets.filter(m => m.id !== id);
    if (this.data.mediaAssets.length < prev) {
      this.logAudit(actor, 'Media Deleted', `Deleted asset ID: ${id}`);
      this.saveDatabase(this.data);
      return true;
    }
    return false;
  }

  // --- Advertising & Monetization ---
  public getAdPlacements(): AdPlacement[] {
    return this.data.adPlacements || [];
  }

  public updateAdPlacement(id: string, updates: Partial<AdPlacement>, actor: string = 'Ad Manager'): AdPlacement | null {
    if (!this.data.adPlacements) return null;
    const slot = this.data.adPlacements.find(s => s.id === id);
    if (slot) {
      Object.assign(slot, updates);
      this.logAudit(actor, 'Ad Placement Updated', `Modified slot: ${slot.name}`);
      this.saveDatabase(this.data);
      return slot;
    }
    return null;
  }

  public getAdCampaigns(): AdCampaign[] {
    return this.data.adCampaigns || [];
  }

  public upsertAdCampaign(campaign: AdCampaign, actor: string = 'Ad Manager'): AdCampaign {
    if (!this.data.adCampaigns) this.data.adCampaigns = [];
    const idx = this.data.adCampaigns.findIndex(c => c.id === campaign.id);
    if (idx >= 0) {
      this.data.adCampaigns[idx] = { ...this.data.adCampaigns[idx], ...campaign };
      this.logAudit(actor, 'Ad Campaign Updated', `Updated campaign: ${campaign.campaignName}`);
    } else {
      const newCamp: AdCampaign = {
        ...campaign,
        id: campaign.id || `camp-${Date.now()}`,
        impressions: campaign.impressions || 0,
        clicks: campaign.clicks || 0,
        ctr: campaign.ctr || 0,
        status: campaign.status || 'active',
      };
      this.data.adCampaigns.unshift(newCamp);
      this.logAudit(actor, 'Ad Campaign Created', `Created campaign: ${campaign.campaignName}`);
    }
    this.saveDatabase(this.data);
    return campaign;
  }

  public deleteAdCampaign(id: string, actor: string = 'Ad Manager'): boolean {
    if (!this.data.adCampaigns) return false;
    const prev = this.data.adCampaigns.length;
    this.data.adCampaigns = this.data.adCampaigns.filter(c => c.id !== id);
    if (this.data.adCampaigns.length < prev) {
      this.logAudit(actor, 'Ad Campaign Deleted', `Removed campaign ID: ${id}`);
      this.saveDatabase(this.data);
      return true;
    }
    return false;
  }

  public recordAdImpression(slotId: string, campaignId?: string) {
    const slot = (this.data.adPlacements || []).find(s => s.id === slotId || s.slotId === slotId);
    if (slot) slot.impressions = (slot.impressions || 0) + 1;
    if (campaignId) {
      const camp = (this.data.adCampaigns || []).find(c => c.id === campaignId);
      if (camp) {
        camp.impressions = (camp.impressions || 0) + 1;
        camp.ctr = camp.impressions > 0 ? parseFloat(((camp.clicks / camp.impressions) * 100).toFixed(2)) : 0;
      }
    }
  }

  public recordAdClick(slotId: string, campaignId?: string) {
    const slot = (this.data.adPlacements || []).find(s => s.id === slotId || s.slotId === slotId);
    if (slot) slot.clicks = (slot.clicks || 0) + 1;
    if (campaignId) {
      const camp = (this.data.adCampaigns || []).find(c => c.id === campaignId);
      if (camp) {
        camp.clicks = (camp.clicks || 0) + 1;
        camp.ctr = camp.impressions > 0 ? parseFloat(((camp.clicks / camp.impressions) * 100).toFixed(2)) : 0;
      }
    }
  }

  // --- SEO & Search Console ---
  public getSeoPages(): SeoPageConfig[] {
    return this.data.seoPages || [];
  }

  public updateSeoPage(id: string, updates: Partial<SeoPageConfig>, actor: string = 'SEO Specialist'): SeoPageConfig | null {
    if (!this.data.seoPages) return null;
    const page = this.data.seoPages.find(p => p.id === id || p.path === id);
    if (page) {
      Object.assign(page, updates, { lastAuditedAt: new Date().toISOString() });
      this.logAudit(actor, 'SEO Page Config Updated', `Updated metadata for route: ${page.path}`);
      this.saveDatabase(this.data);
      return page;
    }
    return null;
  }

  public getSearchConsoleMetrics(): SearchConsoleMetrics {
    return this.data.searchConsole || defaultSearchConsole;
  }

  public updateSearchConsoleMetrics(metrics: Partial<SearchConsoleMetrics>) {
    this.data.searchConsole = {
      ...(this.data.searchConsole || defaultSearchConsole),
      ...metrics,
      lastRefreshedAt: new Date().toISOString(),
    };
    this.saveDatabase(this.data);
  }

  // --- Technical SEO & Redirects ---
  public getRedirectRules(): RedirectRule[] {
    return this.data.redirectRules || [];
  }

  public upsertRedirectRule(rule: RedirectRule, actor: string = 'SEO Specialist'): RedirectRule {
    if (!this.data.redirectRules) this.data.redirectRules = [];
    const idx = this.data.redirectRules.findIndex(r => r.id === rule.id || r.sourcePath === rule.sourcePath);
    if (idx >= 0) {
      this.data.redirectRules[idx] = { ...this.data.redirectRules[idx], ...rule };
    } else {
      this.data.redirectRules.unshift({
        ...rule,
        id: rule.id || `red-${Date.now()}`,
        hits: 0,
        active: true,
        createdAt: new Date().toISOString(),
      });
    }
    this.logAudit(actor, 'Redirect Rule Saved', `Rule ${rule.sourcePath} -> ${rule.targetPath} (${rule.statusCode})`);
    this.saveDatabase(this.data);
    return rule;
  }

  public deleteRedirectRule(id: string, actor: string = 'SEO Specialist'): boolean {
    if (!this.data.redirectRules) return false;
    const prev = this.data.redirectRules.length;
    this.data.redirectRules = this.data.redirectRules.filter(r => r.id !== id);
    if (this.data.redirectRules.length < prev) {
      this.logAudit(actor, 'Redirect Rule Deleted', `Deleted redirect ID: ${id}`);
      this.saveDatabase(this.data);
      return true;
    }
    return false;
  }

  public getBrokenLinks(): BrokenLinkReport[] {
    return this.data.brokenLinks || [];
  }

  public resolveBrokenLink(id: string) {
    if (!this.data.brokenLinks) return;
    const link = this.data.brokenLinks.find(b => b.id === id);
    if (link) {
      link.resolved = true;
      this.saveDatabase(this.data);
    }
  }

  // --- Audience & Subscribers ---
  public getSubscribers(): NewsletterSubscriber[] {
    return this.data.subscribers || [];
  }

  public addSubscriber(email: string, language: 'en' | 'ur' | 'both' = 'both', frequency: 'daily' | 'breaking' = 'daily'): boolean {
    if (!this.data.subscribers) this.data.subscribers = [];
    const cleanEmail = email.trim().toLowerCase();
    if (this.data.subscribers.some(s => s.email === cleanEmail && s.status === 'active')) {
      return false; // already active
    }
    this.data.subscribers.unshift({
      id: `sub-${Date.now()}`,
      email: cleanEmail,
      language,
      frequency,
      subscribedAt: new Date().toISOString(),
      status: 'active',
    });
    this.saveDatabase(this.data);
    return true;
  }

  public removeSubscriber(email: string): boolean {
    if (!this.data.subscribers) return false;
    const sub = this.data.subscribers.find(s => s.email.toLowerCase() === email.trim().toLowerCase());
    if (sub) {
      sub.status = 'unsubscribed';
      this.saveDatabase(this.data);
      return true;
    }
    return false;
  }

  public getNotifications(): AudienceNotification[] {
    return this.data.notifications || [];
  }

  public sendAudienceNotification(notif: AudienceNotification, actor: string = 'Editor'): AudienceNotification {
    if (!this.data.notifications) this.data.notifications = [];
    const activeSubscribers = (this.data.subscribers || []).filter(s => s.status === 'active').length;
    const newNotif: AudienceNotification = {
      ...notif,
      id: notif.id || `notif-${Date.now()}`,
      sentAt: new Date().toISOString(),
      recipientsCount: activeSubscribers > 0 ? activeSubscribers : 42000,
      status: 'sent',
    };
    this.data.notifications.unshift(newNotif);
    this.logAudit(actor, 'Broadcast Dispatched', `Broadcast: ${notif.titleEn}`);
    this.saveDatabase(this.data);
    return newNotif;
  }

  // --- Web Push Subscriptions ---
  public getPushSubscriptions(status?: 'active' | 'unsubscribed'): WebPushSubscription[] {
    const list = this.data.pushSubscriptions || [];
    if (status) {
      return list.filter(s => s.status === status);
    }
    return list;
  }

  public upsertPushSubscription(sub: Partial<WebPushSubscription>): WebPushSubscription {
    if (!this.data.pushSubscriptions) this.data.pushSubscriptions = [];
    const index = this.data.pushSubscriptions.findIndex(s => s.endpoint === sub.endpoint);
    const now = new Date().toISOString();

    if (index !== -1) {
      const existing = this.data.pushSubscriptions[index];
      const updated: WebPushSubscription = {
        ...existing,
        ...sub,
        id: existing.id,
        endpoint: existing.endpoint,
        keys: sub.keys || existing.keys,
        topics: {
          breakingNews: sub.topics?.breakingNews ?? existing.topics.breakingNews,
          cricketScores: sub.topics?.cricketScores ?? existing.topics.cricketScores,
          dailyBriefing: sub.topics?.dailyBriefing ?? existing.topics.dailyBriefing ?? true,
        },
        language: sub.language || existing.language || 'both',
        status: 'active',
        lastActiveAt: now,
      };
      this.data.pushSubscriptions[index] = updated;
      this.saveDatabase(this.data);
      return updated;
    }

    const created: WebPushSubscription = {
      id: `push-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      endpoint: sub.endpoint || '',
      keys: sub.keys,
      topics: {
        breakingNews: sub.topics?.breakingNews ?? true,
        cricketScores: sub.topics?.cricketScores ?? true,
        dailyBriefing: sub.topics?.dailyBriefing ?? true,
      },
      language: sub.language || 'both',
      userAgent: sub.userAgent || '',
      subscribedAt: now,
      lastActiveAt: now,
      status: 'active',
    };
    this.data.pushSubscriptions.unshift(created);
    this.saveDatabase(this.data);
    return created;
  }

  public unsubscribePush(endpoint: string): boolean {
    if (!this.data.pushSubscriptions) return false;
    const sub = this.data.pushSubscriptions.find(s => s.endpoint === endpoint);
    if (sub) {
      sub.status = 'unsubscribed';
      sub.lastActiveAt = new Date().toISOString();
      this.saveDatabase(this.data);
      return true;
    }
    return false;
  }

  public updatePushTopics(
    endpoint: string,
    topics: { breakingNews: boolean; cricketScores: boolean; dailyBriefing?: boolean },
    language?: 'en' | 'ur' | 'both'
  ): boolean {
    if (!this.data.pushSubscriptions) return false;
    const sub = this.data.pushSubscriptions.find(s => s.endpoint === endpoint);
    if (sub) {
      sub.topics = {
        breakingNews: topics.breakingNews,
        cricketScores: topics.cricketScores,
        dailyBriefing: topics.dailyBriefing ?? sub.topics.dailyBriefing ?? true,
      };
      if (language) sub.language = language;
      sub.lastActiveAt = new Date().toISOString();
      this.saveDatabase(this.data);
      return true;
    }
    return false;
  }

  public getVapidKeys(): { publicKey: string; privateKey: string } | null {
    return this.data.vapidKeys || null;
  }

  public setVapidKeys(keys: { publicKey: string; privateKey: string }): void {
    this.data.vapidKeys = keys;
    this.saveDatabase(this.data);
  }

  public getPushStats(): { total: number; active: number; breakingNews: number; cricketScores: number } {
    const list = this.data.pushSubscriptions || [];
    const active = list.filter(s => s.status === 'active');
    return {
      total: list.length,
      active: active.length,
      breakingNews: active.filter(s => s.topics?.breakingNews).length,
      cricketScores: active.filter(s => s.topics?.cricketScores).length,
    };
  }

  // --- Homepage Builder ---
  public getHomepageConfig(): HomepageLayoutConfig {
    return this.data.homepageConfig || defaultHomepageConfig;
  }

  public updateHomepageConfig(config: HomepageLayoutConfig, actor: string = 'Super Admin'): HomepageLayoutConfig {
    this.data.homepageConfig = config;
    this.logAudit(actor, 'Homepage Layout Reordered', 'Updated homepage layout and section ordering');
    this.saveDatabase(this.data);
    return this.data.homepageConfig;
  }

  // --- System Health Diagnostics ---
  public getSystemHealth(): SystemHealthReport {
    let dbSize = 0;
    try {
      if (fs.existsSync(DB_FILE)) {
        dbSize = fs.statSync(DB_FILE).size;
      }
    } catch {}

    const mem = process.memoryUsage();
    return {
      status: 'healthy',
      uptimeSeconds: Math.floor(process.uptime()),
      databaseSizeBytes: dbSize,
      totalArticles: (this.data.articles || []).length,
      activeCronJobs: (this.data.dataProviders || []).filter(p => p.status === 'active').length,
      memoryUsageMb: Math.round(mem.rss / (1024 * 1024)),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'production',
    };
  }
}

export const db = new DatabaseManager();
