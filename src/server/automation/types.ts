export type ProviderCategory = 'weather' | 'currency' | 'gold' | 'fuel' | 'cricket' | 'psx' | 'islamic';

export interface DataProvider {
  id: string;
  name: string;
  category: ProviderCategory;
  endpoint: string;
  status: 'active' | 'degraded' | 'error' | 'disabled';
  intervalMinutes: number;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  lastError: string | null;
  isLicensed: boolean;
  attribution: string;
  requiresApiKey: boolean;
  hasApiKey: boolean;
  consecutiveFailures: number;
  totalSyncs: number;
  successfulSyncs: number;
}

export interface SyncJobRun {
  id: string;
  providerId: string;
  providerName: string;
  category: ProviderCategory;
  timestamp: string;
  status: 'success' | 'failed' | 'partial';
  itemsProcessed: number;
  changesDetected: boolean;
  changeSummaryEn: string;
  changeSummaryUr: string;
  durationMs: number;
  errorDetails: string | null;
}

export interface HistoricalRateRecord {
  id: string;
  type: 'currency' | 'gold' | 'fuel' | 'weather' | 'psx';
  symbol: string; // e.g. 'USD/PKR', 'GOLD_24K_TOLA', 'PETROL', 'PSX_KSE100'
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
  authority: string; // e.g. 'OGRA / Ministry of Energy (Petroleum Division)'
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
}
