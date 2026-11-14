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
  ogTitleEn?: string;
  ogTitleUr?: string;
  ogDescriptionEn?: string;
  ogDescriptionUr?: string;
  noIndex?: boolean;
  schemaType?: string;
  searchIntent?: string;
  internalLinks?: { title: string; url: string; anchorText: string }[];
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
  enabled?: boolean;
  order?: number;
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
  | 'SEO Manager'
  | 'Automation Manager'
  | 'Advertising Manager'
  | 'Content Contributor'
  | 'Read-only Analyst'
  // Legacy aliases kept for backwards compatibility
  | 'Reporter'
  | 'SEO Specialist'
  | 'Viewer';

export type AdminPermission =
  | 'overview:view'
  | 'reports:view'
  | 'articles:read'
  | 'articles:write'
  | 'articles:publish'
  | 'articles:delete'
  | 'categories:manage'
  | 'homepage:manage'
  | 'media:manage'
  | 'seo:manage'
  | 'ads:manage'
  | 'automation:manage'
  | 'ai:use'
  | 'ai:keys'
  | 'audience:manage'
  | 'users:manage'
  | 'settings:manage'
  | 'health:view';

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

// ================= AI PROVIDER & KEY MANAGEMENT =================

export type AIProviderType = 'gemini' | 'grok' | 'custom' | 'custom_data';

export type AITaskType =
  | 'headline_generation'
  | 'translation'
  | 'urdu_to_english'
  | 'english_to_urdu'
  | 'summarization'
  | 'article_summarization'
  | 'article_drafting'
  | 'content_rewriting'
  | 'article_rewriting'
  | 'seo_metadata'
  | 'keyword_tag_extraction'
  | 'category_tagging'
  | 'breaking_alerts'
  | 'public_qa'
  | 'fact_check_prep'
  | 'newsletter_social';

export interface AIProviderCredential {
  id: string;
  providerType: AIProviderType;
  label: string;
  projectId: string; // Explicit GCP/xAI project reference to prevent multi-key bypass on same project
  endpointUrl?: string;
  model: string;
  encryptedSecret: string; // Never sent unmasked to client
  maskedKey: string;
  enabled: boolean;
  priority: number;
  dailyTokenLimit: number;
  dailyTokensUsed: number;
  monthlyBudgetUsd: number;
  monthlySpendUsd: number;
  lastTestedAt?: string | null;
  lastTestStatus?: 'connected' | 'error' | 'untested';
  lastTestMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AITaskRouting {
  task: AITaskType;
  label: string;
  primaryCredentialId: string;
  primaryModel: string;
  fallbackCredentialId?: string;
  fallbackModel?: string;
  temperature: number;
  maxTokens: number;
}

export interface AIUsageLog {
  id: string;
  timestamp: string;
  task: AITaskType | string;
  credentialId: string;
  providerType: AIProviderType;
  projectId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  status: 'success' | 'error';
  errorMessage?: string;
  actor: string;
}

export interface EditorialDraftRecord {
  id: string;
  template: string;
  titleEn: string;
  titleUr: string;
  contentEn: string;
  contentUr: string;
  summaryEn?: string;
  summaryUr?: string;
  metadata?: Record<string, any>;
  providerType?: string;
  model?: string;
  totalTokens?: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ================= MEDIA, SEO & SEARCH CONSOLE =================

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
  pageType?: 'home' | 'category' | 'static' | 'article';
  titleEn: string;
  titleUr: string;
  metaDescEn: string;
  metaDescUr: string;
  canonicalUrl: string;
  robotsDirectives: string; // e.g. 'index, follow'
  ogTitleEn?: string;
  ogTitleUr?: string;
  ogDescEn?: string;
  ogDescUr?: string;
  ogImage: string;
  schemaType: string;
  focusKeyword: string;
  secondaryKeywords?: string[];
  hreflangEn?: string;
  hreflangUr?: string;
  lastAuditedAt: string;
}

export type SearchConsoleStatus =
  | 'Disconnected'
  | 'Authorized'
  | 'Access Denied'
  | 'Token Expired'
  | 'Property Not Found'
  | 'API Error'
  | 'No Data Yet';

export interface SearchConsoleConnection {
  authMode: 'oauth2' | 'service_account' | 'none';
  propertyUrl: string;
  clientId?: string;
  encryptedClientSecret?: string;
  encryptedRefreshToken?: string;
  encryptedAccessToken?: string;
  encryptedServiceAccountJson?: string;
  serviceAccountEmail?: string;
  tokenExpiresAt?: string;
  diagnosticStatus: SearchConsoleStatus;
  diagnosticMessage?: string;
  availableProperties?: string[];
  lastCheckedAt?: string;
  lastSyncedAt?: string;
}

export interface SearchConsoleMetrics {
  connected: boolean;
  diagnosticStatus?: SearchConsoleStatus;
  diagnosticMessage?: string;
  propertyUrl?: string;
  impressions: number;
  clicks: number;
  ctr: number;
  averagePosition: number;
  topQueries: { query: string; clicks: number; impressions: number; ctr?: number; position: number }[];
  topPages: { path: string; clicks: number; impressions: number; ctr: number; position?: number }[];
  devices: { device: string; percent: number; clicks?: number; impressions?: number }[];
  countries: { country: string; percent: number; clicks?: number; impressions?: number }[];
  lastRefreshedAt: string;
}

export interface RedirectRule {
  id: string;
  sourcePath: string;
  targetPath: string;
  statusCode: 301 | 302 | 410;
  hits: number;
  active: boolean;
  notes?: string;
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

export interface SitemapSettings {
  includeImages: boolean;
  includeNewsSitemap: boolean;
  includeCategories: boolean;
  defaultChangefreq: 'hourly' | 'daily' | 'weekly';
  excludedPaths: string[];
  lastGeneratedAt?: string;
}

export interface SeoAuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  status: 'passed' | 'warning' | 'error';
  details: string;
}

// ================= ADVERTISING & AUDIENCE =================

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
  dimensions: string;
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

// ================= HOMEPAGE BUILDER & UNIVERSAL CATEGORY PAGES =================

export type HomepageSectionType =
  | 'live_widgets_bar'
  | 'hero_editorial_grid'
  | 'ad_banner'
  | 'islamic_prayer_digest'
  | 'utilities_grid'
  | 'category_news_grid'
  | 'breaking_ticker'
  | 'newsletter_box'
  | 'custom_block';

export interface HomepageSectionItem {
  id: string;
  type: HomepageSectionType;
  nameEn: string;
  nameUr: string;
  description?: string;
  enabled: boolean;
  order: number;
  mobileOrder?: number;
  width?: 'full' | 'contained' | '2-col' | '3-col';
  template?: 'grid' | 'lead-plus-list' | 'cards' | 'ticker' | 'compact';
  categorySlug?: string;
  articleSource?: 'latest' | 'featured' | 'trending' | 'breaking' | 'category';
  itemLimit?: number;
  displayMode?: 'bilingual' | 'current_lang';
  adSlot?: string;
  customHtmlEn?: string;
  customHtmlUr?: string;
  customBlockId?: string;
}

export interface HomepageLayoutConfig {
  sections: HomepageSectionItem[];
  updatedAt?: string;
  updatedBy?: string;
  version?: number;
}

export interface HomepageVersionSnapshot {
  versionId: string;
  savedAt: string;
  savedBy: string;
  note: string;
  config: HomepageLayoutConfig;
}

export interface CustomReusableBlock {
  id: string;
  name: string;
  titleEn: string;
  titleUr: string;
  bodyEn: string;
  bodyUr: string;
  ctaLabelEn?: string;
  ctaLabelUr?: string;
  ctaUrl?: string;
  theme?: 'emerald' | 'slate' | 'amber' | 'white';
  updatedAt: string;
}

export type CategoryBlockType =
  | 'category_hero'
  | 'featured_story'
  | 'news_grid'
  | 'news_list'
  | 'trending_sidebar'
  | 'live_rates_widget'
  | 'weather_aqi_widget'
  | 'cricket_scoreboard_widget'
  | 'islamic_prayer_times_widget'
  | 'education_board_results_widget'
  | 'mobiles_catalogue'
  | 'vehicles_catalogue'
  | 'prize_bond_draw_lookup'
  | 'dictionary_lookup'
  | 'poetry_collection'
  | 'recipe_collection'
  | 'jobs_listings'
  | 'utility_calculators_grid'
  | 'ad_unit_slot'
  | 'newsletter_signup_box'
  | 'custom_editorial_banner';

export interface CategoryPageBlock {
  id: string;
  type: CategoryBlockType;
  titleEn: string;
  titleUr: string;
  enabled: boolean;
  order: number;
  width: 'full' | 'main' | 'sidebar' | 'half';
  itemLimit?: number;
  adSlotId?: string;
  customTextEn?: string;
  customTextUr?: string;
}

export interface CategoryPageConfig {
  id: string;
  slug: string;
  nameEn: string;
  nameUr: string;
  descriptionEn: string;
  descriptionUr: string;
  heroTitleEn?: string;
  heroTitleUr?: string;
  heroSubtitleEn?: string;
  heroSubtitleUr?: string;
  heroImage?: string;
  iconName: string;
  enabled: boolean;
  showInNav?: boolean;
  showInHeader?: boolean;
  showInFooter: boolean;
  template?: 'standard_news' | 'utility_hybrid' | 'archive';
  order: number;
  seoTitleEn?: string;
  seoTitleUr?: string;
  metaDescEn?: string;
  metaDescUr?: string;
  canonicalUrl?: string;
  robots?: string;
  ogImage?: string;
  seo?: {
    metaTitleEn: string;
    metaTitleUr: string;
    metaDescEn: string;
    metaDescUr: string;
    canonicalUrl: string;
    focusKeyword: string;
    noIndex: boolean;
  };
  blocks: CategoryPageBlock[];
  draftBlocks?: CategoryPageBlock[];
  status: 'published' | 'draft';
  updatedAt?: string;
  updatedBy?: string;
}

export interface CategoryPageVersion {
  versionId: string;
  slug: string;
  savedAt: string;
  savedBy: string;
  note: string;
  snapshot: CategoryPageConfig;
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
  accentColor?: string;
  breakingNewsEnabled: boolean;
  contactEmail: string;
  contactPhone: string;
  headerNavLinks?: { labelEn: string; labelUr: string; route: string; enabled: boolean }[];
  showAskAiButton?: boolean;
  showSearchInHeader?: boolean;
  showLiveWidgetsBar?: boolean;
  socialLinks?: {
    facebook?: string;
    twitter?: string;
    youtube?: string;
    instagram?: string;
    whatsappChannel?: string;
  };
  footerTextEn?: string;
  footerTextUr?: string;
  seoDefaultTitleSuffixEn?: string;
  seoDefaultTitleSuffixUr?: string;
  seoDefaultOgImage?: string;
  defaultRobots?: string;
  adManagerEnabled: boolean;
  adsensePublisherId?: string;
  googleAnalyticsId: string;
  searchConsoleSiteUrl?: string;
  leaderboardAdUrl: string;
  sidebarAdUrl: string;
  defaultLanguage?: 'en' | 'ur';
  autoPublishSyncedWidgets?: boolean;
  sessionTimeoutMinutes?: number;
  mfaEnforcedForAdmins?: boolean;
  maintenanceMode?: boolean;
  maintenanceMessageEn?: string;
  maintenanceMessageUr?: string;
  branding?: {
    logoUrl: string;
    faviconUrl: string;
    primaryColor: string;
    accentColor: string;
  };
  navigation?: {
    showBreakingTicker: boolean;
    showTopRatesBar: boolean;
    stickyHeader: boolean;
    showAskAiButton: boolean;
  };
  footer?: {
    copyrightEn: string;
    copyrightUr: string;
    showNewsletterBox: boolean;
    socialLinks: Record<string, string>;
  };
  seoDefaults?: {
    titlePattern: string;
    defaultMetaDescEn: string;
    defaultMetaDescUr: string;
    robotsDefault: string;
    defaultOgImage: string;
  };
  security?: {
    enforceMfaForSuperAdmin: boolean;
    sessionTtlHours: number;
    maxLoginAttempts: number;
  };
  maintenance?: {
    enabled: boolean;
    messageEn: string;
    messageUr: string;
  };
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
