export type ProviderCategory =
  | 'weather'
  | 'currency'
  | 'gold'
  | 'fuel'
  | 'cricket'
  | 'psx'
  | 'islamic'
  | 'news'
  | 'education'
  | 'jobs'
  | 'custom';

export interface DataProvider {
  id: string;
  name: string;
  category: ProviderCategory;
  endpoint: string;
  method?: 'GET' | 'POST';
  httpMethod?: 'GET' | 'POST';
  status: 'active' | 'degraded' | 'error' | 'disabled';
  intervalMinutes: number;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  lastError: string | null;
  lastStatusCode?: number | null;
  isLicensed: boolean;
  licenseType?: 'public_open' | 'commercial_api' | 'govt_official' | 'rss_attributed' | 'internal';
  commercialRights?: boolean;
  attributionRequired?: boolean;
  attribution: string;
  requiresApiKey: boolean;
  hasApiKey: boolean;
  authHeaderName?: string;
  encryptedApiKey?: string;
  maskedApiKey?: string;
  dailyQuotaLimit?: number;
  dailyCallsUsed?: number;
  quotaLimitPerDay?: number;
  quotaUsedToday?: number;
  consecutiveFailures: number;
  totalSyncs: number;
  successfulSyncs: number;
  isBuiltIn?: boolean;
  timeoutMs?: number;
  notes?: string;
}

export interface SyncJobRun {
  id: string;
  providerId: string;
  providerName: string;
  category: ProviderCategory;
  timestamp: string;
  status: 'success' | 'failed' | 'partial' | 'locked';
  httpStatus?: number | null;
  itemsProcessed: number;
  changesDetected: boolean;
  validationPassed?: boolean;
  validationWarnings?: string[];
  changeSummaryEn: string;
  changeSummaryUr: string;
  durationMs: number;
  errorDetails: string | null;
  triggeredBy?: 'scheduler' | 'manual' | 'cpanel_cron' | 'retry';
}

export interface HistoricalRateRecord {
  id: string;
  type: 'currency' | 'gold' | 'fuel' | 'weather' | 'psx';
  symbol: string;
  value: number;
  previousValue: number;
  change: number;
  changePercent: number;
  timestamp: string;
  source: string;
}

export interface FuelPriceNotification {
  id: string;
  notificationNumber: string;
  effectiveDate: string;
  authority: string;
  petrolPkr: number;
  dieselPkr: number;
  kerosenePkr: number;
  lightDieselPkr: number;
  status: 'verified' | 'pending_review' | 'superseded';
  documentReference: string;
  verifiedAt: string;
}

export interface AiContentDraft {
  id: string;
  category: string;
  triggerReason: string;
  titleEn: string;
  titleUr: string;
  summaryEn: string;
  summaryUr: string;
  contentEn: string;
  contentUr: string;
  sourceDataSnapshot: Record<string, any>;
  sourceAttribution?: string;
  status: 'pending_review' | 'approved' | 'rejected' | 'published';
  createdAt: string;
  approvedBy?: string;
  publishedAt?: string;
  seoTags: string[];
}

export interface AutomationSettings {
  autoSyncEnabled: boolean;
  aiDraftsEnabled: boolean;
  autoPublishFactualWidgets: boolean;
  currencySyncIntervalMin: number;
  weatherSyncIntervalMin: number;
  goldSyncIntervalMin: number;
  cricketSyncIntervalMin: number;
  fuelCheckIntervalMin: number;
  geminiCooldownMin: number;
  lastGeminiCallAt: string | null;
  lastCronRunAt?: string | null;
  cronBatchLimit?: number;
  maxBatchJobsPerCron?: number;
  cronSharedSecretSet?: boolean;
}
