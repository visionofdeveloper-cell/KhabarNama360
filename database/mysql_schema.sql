-- 360Khabarnama — Namecheap Shared Hosting MySQL 8 / MariaDB Reference Schema
-- Safe to import via cPanel phpMyAdmin for relational SQL deployment alongside Node.js adapter.

CREATE TABLE IF NOT EXISTS admin_users (
  id VARCHAR(64) PRIMARY KEY,
  name_en VARCHAR(160) NOT NULL,
  name_ur VARCHAR(160) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  role VARCHAR(64) NOT NULL,
  status ENUM('active', 'suspended') DEFAULT 'active',
  password_hash VARCHAR(255) NULL,
  mfa_enabled TINYINT(1) DEFAULT 0,
  mfa_secret_enc TEXT NULL,
  failed_attempts INT DEFAULT 0,
  locked_until BIGINT NULL,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_sessions (
  session_id VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  email VARCHAR(190) NOT NULL,
  role VARCHAR(64) NOT NULL,
  mfa_verified TINYINT(1) DEFAULT 1,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at BIGINT NOT NULL,
  revoked TINYINT(1) DEFAULT 0,
  INDEX idx_admin_sessions_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_providers (
  id VARCHAR(64) PRIMARY KEY,
  slug VARCHAR(32) NOT NULL UNIQUE,
  display_name VARCHAR(120) NOT NULL,
  base_url VARCHAR(255) NOT NULL,
  auth_scheme ENUM('x-goog-api-key', 'bearer', 'custom_header') NOT NULL,
  supports_model_discovery TINYINT(1) NOT NULL DEFAULT 1,
  supports_responses_api TINYINT(1) NOT NULL DEFAULT 0,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_provider_credentials (
  id VARCHAR(64) PRIMARY KEY,
  provider_id VARCHAR(64) NULL,
  provider_type ENUM('gemini', 'grok', 'custom', 'custom_data') NOT NULL,
  label VARCHAR(120) NOT NULL,
  project_id VARCHAR(160) NOT NULL,
  endpoint_url VARCHAR(255) NULL,
  model VARCHAR(120) NOT NULL,
  encrypted_secret TEXT NOT NULL,
  masked_key VARCHAR(64) NOT NULL,
  enabled TINYINT(1) DEFAULT 1,
  priority INT DEFAULT 10,
  daily_token_limit BIGINT DEFAULT 500000,
  daily_tokens_used BIGINT DEFAULT 0,
  monthly_budget_usd DECIMAL(10,4) DEFAULT 50.0000,
  monthly_spend_usd DECIMAL(10,4) DEFAULT 0.0000,
  connection_status VARCHAR(64) DEFAULT 'untested',
  model_list_status VARCHAR(24) DEFAULT 'untested',
  generation_test_status VARCHAR(24) DEFAULT 'untested',
  last_tested_at DATETIME NULL,
  last_successful_verification_at DATETIME NULL,
  last_successful_generation_at DATETIME NULL,
  last_failure_at DATETIME NULL,
  last_test_status VARCHAR(32) DEFAULT 'untested',
  last_test_message TEXT NULL,
  last_diagnostic_json JSON NULL,
  last_latency_ms INT NULL,
  last_correlation_id VARCHAR(64) NULL,
  rate_limit_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_provider_models (
  id VARCHAR(190) PRIMARY KEY,
  credential_id VARCHAR(64) NOT NULL,
  provider_type VARCHAR(32) NOT NULL,
  model_id VARCHAR(160) NOT NULL,
  display_name VARCHAR(190) NULL,
  supported_methods_json JSON NULL,
  supports_text_generation TINYINT(1) NOT NULL DEFAULT 1,
  input_token_limit INT NULL,
  output_token_limit INT NULL,
  discovered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_connection_tests (
  id VARCHAR(64) PRIMARY KEY,
  credential_id VARCHAR(64) NULL,
  provider_type VARCHAR(32) NOT NULL,
  model_tested VARCHAR(160) NULL,
  stage ENUM('model_list', 'generation_test', 'health_check') NOT NULL,
  ok TINYINT(1) NOT NULL DEFAULT 0,
  connection_status VARCHAR(64) NOT NULL,
  model_list_ok TINYINT(1) NOT NULL DEFAULT 0,
  generation_ok TINYINT(1) NOT NULL DEFAULT 0,
  models_discovered_count INT NOT NULL DEFAULT 0,
  latency_ms INT NOT NULL DEFAULT 0,
  sample_output TEXT NULL,
  diagnostic_json JSON NULL,
  correlation_id VARCHAR(64) NULL,
  actor VARCHAR(160) NOT NULL,
  tested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id VARCHAR(64) PRIMARY KEY,
  timestamp DATETIME NOT NULL,
  task VARCHAR(64) NOT NULL,
  credential_id VARCHAR(64) NOT NULL,
  provider_type VARCHAR(32) NOT NULL,
  project_id VARCHAR(160) NOT NULL,
  model VARCHAR(120) NOT NULL,
  prompt_tokens INT DEFAULT 0,
  completion_tokens INT DEFAULT 0,
  total_tokens INT DEFAULT 0,
  estimated_cost_usd DECIMAL(10,6) DEFAULT 0,
  latency_ms INT DEFAULT 0,
  status ENUM('success', 'error') NOT NULL,
  error_message TEXT NULL,
  correlation_id VARCHAR(64) NULL,
  actor VARCHAR(160) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_task_routes (
  task VARCHAR(64) PRIMARY KEY,
  label VARCHAR(160) NOT NULL,
  primary_credential_id VARCHAR(64) NULL,
  primary_model VARCHAR(160) NOT NULL,
  fallback_credential_id VARCHAR(64) NULL,
  fallback_model VARCHAR(160) NULL,
  temperature DECIMAL(3,2) NOT NULL DEFAULT 0.40,
  max_tokens INT NOT NULL DEFAULT 3072,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS articles (
  id VARCHAR(64) PRIMARY KEY,
  slug VARCHAR(220) NOT NULL UNIQUE,
  category VARCHAR(64) NOT NULL,
  title_en TEXT NOT NULL,
  title_ur TEXT NOT NULL,
  summary_en TEXT NULL,
  summary_ur TEXT NULL,
  content_en LONGTEXT NOT NULL,
  content_ur LONGTEXT NOT NULL,
  tags_json JSON NULL,
  seo_json JSON NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  views INT DEFAULT 0,
  is_breaking TINYINT(1) DEFAULT 0,
  is_featured TINYINT(1) DEFAULT 0,
  is_trending TINYINT(1) DEFAULT 0,
  published_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_articles_cat_status (category, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS category_pages (
  id VARCHAR(64) PRIMARY KEY,
  slug VARCHAR(80) NOT NULL UNIQUE,
  name_en VARCHAR(140) NOT NULL,
  name_ur VARCHAR(140) NOT NULL,
  hero_title_en TEXT NULL,
  hero_title_ur TEXT NULL,
  hero_subtitle_en TEXT NULL,
  hero_subtitle_ur TEXT NULL,
  seo_json JSON NOT NULL,
  blocks_json JSON NOT NULL,
  status ENUM('published', 'draft') DEFAULT 'published',
  enabled TINYINT(1) DEFAULT 1,
  sort_order INT DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS seo_pages (
  id VARCHAR(64) PRIMARY KEY,
  route_path VARCHAR(220) NOT NULL UNIQUE,
  title_en VARCHAR(255) NOT NULL,
  title_ur VARCHAR(255) NOT NULL,
  meta_desc_en TEXT NULL,
  meta_desc_ur TEXT NULL,
  canonical_url VARCHAR(255) NOT NULL,
  robots_directives VARCHAR(120) DEFAULT 'index, follow',
  schema_type VARCHAR(80) DEFAULT 'WebPage',
  focus_keyword VARCHAR(160) NULL,
  last_audited_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS seo_redirects (
  id VARCHAR(64) PRIMARY KEY,
  source_path VARCHAR(220) NOT NULL UNIQUE,
  target_path VARCHAR(255) NOT NULL,
  status_code INT NOT NULL DEFAULT 301,
  hits INT DEFAULT 0,
  active TINYINT(1) DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sync_providers (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(140) NOT NULL,
  category VARCHAR(48) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  interval_minutes INT DEFAULT 30,
  is_licensed TINYINT(1) DEFAULT 0,
  license_type VARCHAR(48) NULL,
  attribution VARCHAR(255) NULL,
  encrypted_api_key TEXT NULL,
  last_sync_at DATETIME NULL,
  consecutive_failures INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cron_locks (
  lock_key VARCHAR(96) PRIMARY KEY,
  locked_by VARCHAR(96) NOT NULL,
  locked_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  timestamp DATETIME NOT NULL,
  actor VARCHAR(160) NOT NULL,
  action VARCHAR(160) NOT NULL,
  details TEXT NOT NULL,
  ip_address VARCHAR(64) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
