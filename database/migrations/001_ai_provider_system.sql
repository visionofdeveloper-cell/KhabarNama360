-- 360Khabarnama — Migration 001: Multi-Provider AI Credential, Discovery, Diagnostics & Routing System
-- Compatible with MySQL 8.0+ / MariaDB 10.4+ (Namecheap Shared Hosting cPanel phpMyAdmin)

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

INSERT IGNORE INTO ai_providers (id, slug, display_name, base_url, auth_scheme, supports_model_discovery, supports_responses_api)
VALUES
  ('prov-gemini', 'gemini', 'Google Gemini API', 'https://generativelanguage.googleapis.com', 'x-goog-api-key', 1, 0),
  ('prov-grok', 'grok', 'xAI Grok API', 'https://api.x.ai/v1', 'bearer', 1, 1),
  ('prov-custom', 'custom', 'Custom OpenAI-Compatible API', '', 'bearer', 1, 0);

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
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  priority INT NOT NULL DEFAULT 10,
  daily_token_limit BIGINT NOT NULL DEFAULT 500000,
  daily_tokens_used BIGINT NOT NULL DEFAULT 0,
  monthly_budget_usd DECIMAL(10,4) NOT NULL DEFAULT 50.0000,
  monthly_spend_usd DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
  connection_status VARCHAR(64) NOT NULL DEFAULT 'untested',
  model_list_status VARCHAR(24) NOT NULL DEFAULT 'untested',
  generation_test_status VARCHAR(24) NOT NULL DEFAULT 'untested',
  last_tested_at DATETIME NULL,
  last_successful_verification_at DATETIME NULL,
  last_successful_generation_at DATETIME NULL,
  last_failure_at DATETIME NULL,
  last_test_status VARCHAR(32) NOT NULL DEFAULT 'untested',
  last_test_message TEXT NULL,
  last_diagnostic_json JSON NULL,
  last_latency_ms INT NULL,
  last_correlation_id VARCHAR(64) NULL,
  rate_limit_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ai_cred_provider_priority (provider_type, enabled, priority),
  INDEX idx_ai_cred_project (provider_type, project_id)
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
  discovered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ai_models_cred (credential_id),
  UNIQUE KEY uq_cred_model (credential_id, model_id)
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
  tested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ai_tests_cred_time (credential_id, tested_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id VARCHAR(64) PRIMARY KEY,
  timestamp DATETIME NOT NULL,
  task VARCHAR(64) NOT NULL,
  credential_id VARCHAR(64) NOT NULL,
  provider_type VARCHAR(32) NOT NULL,
  project_id VARCHAR(160) NOT NULL,
  model VARCHAR(120) NOT NULL,
  prompt_tokens INT NOT NULL DEFAULT 0,
  completion_tokens INT NOT NULL DEFAULT 0,
  total_tokens INT NOT NULL DEFAULT 0,
  estimated_cost_usd DECIMAL(10,6) NOT NULL DEFAULT 0,
  latency_ms INT NOT NULL DEFAULT 0,
  status ENUM('success', 'error') NOT NULL,
  error_message TEXT NULL,
  correlation_id VARCHAR(64) NULL,
  actor VARCHAR(160) NOT NULL,
  INDEX idx_ai_usage_time (timestamp),
  INDEX idx_ai_usage_cred (credential_id, timestamp)
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
