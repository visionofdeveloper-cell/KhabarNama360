export type Language = 'en' | 'ur';

export interface ArticleVersion {
  versionId: string;
  savedAt: string;
  savedBy: string;
  titleEn: string;
  titleUr: string;
  summaryEn: string;
  summaryUr: string;
  contentEn: string;
  contentUr: string;
  changeNote?: string;
}

export interface ArticleSeo {
  metaTitleEn?: string;
  metaTitleUr?: string;
  metaDescriptionEn?: string;
  metaDescriptionUr?: string;
  canonicalUrl?: string;
  focusKeywords?: string[];
  ogImage?: string;
  noIndex?: boolean;
}

export interface Article {
  id: string;
  slug: string;
  titleEn: string;
  titleUr: string;
  summaryEn: string;
  summaryUr: string;
  contentEn: string;
  contentUr: string;
  category: string;
  subcategory?: string;
  tags: string[];
  author: {
    id: string;
    nameEn: string;
    nameUr: string;
    avatar: string;
    role: string;
  };
  publishedAt: string;
  updatedAt: string;
  scheduledAt?: string;
  scheduledFor?: string;
  reviewedBy?: string;
  reviewerId?: string;
  workflowNotes?: string;
  views: number;
  status: 'draft' | 'review' | 'in_review' | 'approved' | 'scheduled' | 'published' | 'archived';
  heroImage: string;
  imageCaptionEn: string;
  imageCaptionUr: string;
  isBreaking: boolean;
  isFeatured: boolean;
  isTrending: boolean;
  homepageSlot?: 'hero' | 'top_stories' | 'editors_pick' | 'trending' | 'category_lead' | 'none';
  videoUrl?: string;
  sourceName?: string;
  sourceUrl?: string;
  readingTimeMin: number;
  seo?: ArticleSeo;
  versions?: ArticleVersion[];
}

export interface Category {
  id: string;
  slug: string;
  nameEn: string;
  nameUr: string;
  descriptionEn: string;
  descriptionUr: string;
  iconName: string;
}

export interface EducationBoard {
  id: string;
  code: string;
  nameEn: string;
  nameUr: string;
  province: string;
  city: string;
  website: string;
}

export interface ExamResult {
  id: string;
  boardCode: string;
  examNameEn: string;
  examNameUr: string;
  year: number;
  rollNumber: string;
  candidateNameEn: string;
  candidateNameUr: string;
  fatherNameEn: string;
  fatherNameUr: string;
  instituteEn: string;
  instituteUr: string;
  marksObtained: number;
  totalMarks: number;
  grade: string;
  status: 'PASS' | 'FAIL';
  subjectMarks: {
    subjectEn: string;
    subjectUr: string;
    marks: number;
    total: number;
  }[];
}

export interface WeatherData {
  cityId: string;
  nameEn: string;
  nameUr: string;
  provinceEn: string;
  provinceUr: string;
  tempC: number;
  conditionEn: string;
  conditionUr: string;
  highC: number;
  lowC: number;
  humidity: number;
  windKmh: number;
  aqi: number;
  aqiStatusEn: string;
  aqiStatusUr: string;
  feelsLikeC: number;
  sunrise: string;
  sunset: string;
  hourly: { time: string; tempC: number; condition: string }[];
  daily: { dayEn: string; dayUr: string; highC: number; lowC: number; conditionEn: string; conditionUr: string }[];
  alert?: { titleEn: string; titleUr: string; severity: 'warning' | 'advisory' };
}

export interface GoldRate {
  karat: string;
  tolaPkr: number;
  tenGramPkr: number;
  changePkr: number;
  isPositive: boolean;
}

export interface CurrencyRate {
  code: string;
  nameEn: string;
  nameUr: string;
  buyingPkr: number;
  sellingPkr: number;
  interbankPkr: number;
  change: number;
  flag: string;
}

export interface FuelPrice {
  typeEn: string;
  typeUr: string;
  pricePkr: number;
  changePkr: number;
  effectiveDate: string;
}

export interface PSXData {
  kse100: number;
  change: number;
  changePercent: number;
  volumeMillion: number;
  gainers: { symbol: string; price: number; change: number }[];
  losers: { symbol: string; price: number; change: number }[];
}

export interface CricketMatch {
  id: string;
  titleEn: string;
  titleUr: string;
  tournament: string;
  status: 'live' | 'upcoming' | 'completed';
  teamA: { name: string; code: string; score?: string; overs?: string; wickets?: number; flag: string };
  teamB: { name: string; code: string; score?: string; overs?: string; wickets?: number; flag: string };
  currentBatters?: string[];
  currentBowler?: string;
  statusTextEn: string;
  statusTextUr: string;
  venueEn: string;
  venueUr: string;
  dateStr: string;
}

export interface PrayerTimeData {
  cityEn: string;
  cityUr: string;
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  sehriEnds: string;
  iftar: string;
  hijriDateEn: string;
  hijriDateUr: string;
}

export interface MobilePhone {
  id: string;
  brand: string;
  model: string;
  pricePkr: number;
  ram: string;
  storage: string;
  display: string;
  camera: string;
  battery: string;
  rating: number;
  image: string;
}

export interface Automobile {
  id: string;
  type: 'car' | 'bike';
  brand: string;
  model: string;
  year: number;
  pricePkr: number;
  engineCc: string;
  transmission: string;
  mileage: string;
  image: string;
}

export interface PrizeBondDraw {
  id: string;
  denomination: number;
  drawNumber: number;
  drawDate: string;
  cityEn: string;
  cityUr: string;
  firstPrizePkr: string;
  secondPrizePkr: string;
  thirdPrizePkr: string;
  firstPrizeBond: string;
  secondPrizeBonds: string[];
  thirdPrizeSample: string[];
}

export interface DictionaryEntry {
  id: string;
  english: string;
  urdu: string;
  romanUrdu: string;
  partOfSpeech: string;
  definitionEn: string;
  definitionUr: string;
  exampleEn: string;
  exampleUr: string;
}

export interface BabyName {
  id: string;
  nameEn: string;
  nameUr: string;
  gender: 'boy' | 'girl';
  meaningEn: string;
  meaningUr: string;
  origin: string;
  luckyNumber: number;
}

export interface Poet {
  id: string;
  nameEn: string;
  nameUr: string;
  era: string;
  cityEn: string;
  cityUr: string;
  bioEn: string;
  bioUr: string;
  image: string;
  poemCount: number;
}

export interface Poem {
  id: string;
  titleEn: string;
  titleUr: string;
  poetId: string;
  poetNameEn: string;
  poetNameUr: string;
  category: 'Ghazal' | 'Nazm' | 'Rubaiyat';
  linesEn: string[];
  linesUr: string[];
}

export interface Recipe {
  id: string;
  titleEn: string;
  titleUr: string;
  categoryEn: string;
  categoryUr: string;
  cookTimeMin: number;
  servings: number;
  difficulty: 'Easy' | 'Medium' | 'Chef Level';
  ingredientsEn: string[];
  ingredientsUr: string[];
  instructionsEn: string[];
  instructionsUr: string[];
  image: string;
}

export interface JobListing {
  id: string;
  titleEn: string;
  titleUr: string;
  departmentEn: string;
  departmentUr: string;
  organizationType: 'Federal Govt' | 'Provincial Govt' | 'Private' | 'Banking' | 'Armed Forces';
  cityEn: string;
  cityUr: string;
  qualification: string;
  vacancies: number;
  deadline: string;
  salaryPkr: string;
}

export type UserRole =
  | 'Super Admin'
  | 'Administrator'
  | 'Managing Editor'
  | 'Editor'
  | 'Reporter'
  | 'SEO Specialist'
  | 'Advertising Manager'
  | 'Content Contributor'
  | 'Viewer';

export interface AdminUser {
  id: string;
  nameEn: string;
  nameUr: string;
  email: string;
  role: UserRole;
  status: 'active' | 'suspended';
  avatar: string;
  bioEn?: string;
  bioUr?: string;
  articlesCount: number;
  lastLogin?: string;
  createdAt: string;
}

export interface MediaAsset {
  id: string;
  filename: string;
  url: string;
  thumbnailUrl?: string;
  sizeBytes: number;
  mimeType: string;
  category: string;
  captionEn: string;
  captionUr: string;
  altTextEn: string;
  altTextUr: string;
  width?: number;
  height?: number;
  uploadedBy: string;
  uploadedAt: string;
  usageCount: number;
}

export interface SeoPageConfig {
  id: string;
  path: string;
  titleEn: string;
  titleUr: string;
  metaDescEn: string;
  metaDescUr: string;
  canonicalUrl: string;
  robotsDirectives: string; // e.g. 'index, follow'
  ogImage: string;
  schemaType: string;
  focusKeyword: string;
  lastAuditedAt: string;
}

export interface SearchConsoleMetrics {
  connected: boolean;
  impressions: number;
  clicks: number;
  ctr: number;
  averagePosition: number;
  topQueries: { query: string; clicks: number; impressions: number; position: number }[];
  topPages: { path: string; clicks: number; impressions: number; ctr: number }[];
  devices: { device: string; percent: number }[];
  countries: { country: string; percent: number }[];
  lastRefreshedAt: string;
}

export interface RedirectRule {
  id: string;
  sourcePath: string;
  targetPath: string;
  statusCode: 301 | 302 | 410;
  hits: number;
  active: boolean;
  createdAt: string;
}

export interface BrokenLinkReport {
  id: string;
  url: string;
  path?: string;
  referrer?: string;
  hits?: number;
  statusCode: number;
  foundOnPage: string;
  discoveredAt: string;
  resolved: boolean;
}

export type AdSlotLocation =
  | 'header_banner'
  | 'home_leaderboard'
  | 'home_inline'
  | 'sidebar'
  | 'article_inline'
  | 'article_footer'
  | 'mobile_sticky'
  | 'category_banner';

export interface AdPlacement {
  id: string;
  slotId: string;
  name: string;
  location: AdSlotLocation;
  providerType: 'adsense' | 'ad_manager' | 'direct' | 'sponsored';
  dimensions: string; // e.g. '728x90', '300x250'
  targetDevices: 'all' | 'desktop' | 'mobile';
  enabled: boolean;
  adCodeSnippet?: string;
  campaignId?: string;
  impressions: number;
  clicks: number;
}

export interface AdCampaign {
  id: string;
  advertiserName: string;
  campaignName: string;
  bannerUrl: string;
  destinationUrl: string;
  budgetPkr: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'paused' | 'completed' | 'draft';
  impressions: number;
  clicks: number;
  ctr: number;
  placementSlotIds: string[];
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  language: 'en' | 'ur' | 'both';
  frequency: 'daily' | 'breaking';
  subscribedAt: string;
  status: 'active' | 'unsubscribed';
}

export interface NotificationTopics {
  breakingNews: boolean;
  cricketScores: boolean;
  dailyBriefing?: boolean;
}

export interface WebPushSubscription {
  id: string;
  endpoint: string;
  keys?: {
    p256dh: string;
    auth: string;
  };
  topics: NotificationTopics;
  language: 'en' | 'ur' | 'both';
  userAgent?: string;
  subscribedAt: string;
  lastActiveAt?: string;
  status: 'active' | 'unsubscribed';
}

export interface PushAlertPayload {
  title: string;
  titleUr?: string;
  body: string;
  bodyUr?: string;
  url: string;
  topic: 'breakingNews' | 'cricketScores' | 'dailyBriefing' | 'general';
  tag?: string;
  badge?: string;
  icon?: string;
  timestamp?: string;
}

export interface AudienceNotification {
  id: string;
  titleEn: string;
  titleUr: string;
  messageEn?: string;
  messageUr?: string;
  bodyEn?: string;
  bodyUr?: string;
  targetLanguage?: 'en' | 'ur' | 'both';
  targetUrl?: string;
  channel?: 'push' | 'whatsapp' | 'email';
  category?: string;
  sentAt?: string;
  recipientsCount?: number;
  status?: 'sent' | 'scheduled' | 'draft';
}

export interface HomepageLayoutConfig {
  sections: {
    id: string;
    nameEn: string;
    nameUr: string;
    enabled: boolean;
    order: number;
  }[];
}

export interface SiteSettings {
  siteNameEn: string;
  siteNameUr: string;
  taglineEn: string;
  taglineUr: string;
  descriptionEn?: string;
  descriptionUr?: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor: string;
  secondaryColor?: string;
  breakingNewsEnabled: boolean;
  contactEmail: string;
  contactPhone: string;
  socialLinks?: {
    facebook?: string;
    twitter?: string;
    youtube?: string;
    instagram?: string;
    whatsappChannel?: string;
  };
  footerTextEn?: string;
  footerTextUr?: string;
  adManagerEnabled: boolean;
  adsensePublisherId?: string;
  googleAnalyticsId: string;
  searchConsoleSiteUrl?: string;
  leaderboardAdUrl: string;
  sidebarAdUrl: string;
  maintenanceMode?: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
  ipAddress?: string;
}

export interface SystemHealthReport {
  status: 'healthy' | 'degraded' | 'warning';
  uptimeSeconds: number;
  databaseSizeBytes: number;
  totalArticles: number;
  activeCronJobs: number;
  memoryUsageMb: number;
  nodeVersion: string;
  environment: string;
}
