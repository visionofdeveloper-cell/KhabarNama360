-- 360Khabarnama — Migration 002: Relational Article Persistence, Translations, Publication Logs & Diagnostics
-- Non-destructive & safe for existing Namecheap cPanel MySQL 8 / MariaDB production databases.
-- NEVER drops or truncates tables. Uses UTF8MB4 for full Urdu & English support.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(64) PRIMARY KEY,
  name VARCHAR(190) NOT NULL,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(64) PRIMARY KEY,
  slug VARCHAR(80) NOT NULL UNIQUE,
  name_en VARCHAR(140) NOT NULL,
  name_ur VARCHAR(140) NOT NULL,
  description_en TEXT NULL,
  description_ur TEXT NULL,
  icon_name VARCHAR(64) NULL,
  enabled TINYINT(1) DEFAULT 1,
  sort_order INT DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS authors (
  id VARCHAR(64) PRIMARY KEY,
  name_en VARCHAR(160) NOT NULL,
  name_ur VARCHAR(160) NOT NULL,
  role VARCHAR(64) NOT NULL DEFAULT 'Editor',
  avatar TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS media (
  id VARCHAR(64) PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  mime_type VARCHAR(96) NOT NULL DEFAULT 'image/jpeg',
  category VARCHAR(64) DEFAULT 'general',
  caption_en TEXT NULL,
  caption_ur TEXT NULL,
  alt_text_en TEXT NULL,
  alt_text_ur TEXT NULL,
  uploaded_by VARCHAR(160) NULL,
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS article_translations (
  id VARCHAR(128) PRIMARY KEY,
  article_id VARCHAR(64) NOT NULL,
  language_code ENUM('en', 'ur') NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NULL,
  content LONGTEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_article_lang (article_id, language_code),
  INDEX idx_art_trans_article (article_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS article_categories (
  article_id VARCHAR(64) NOT NULL,
  category_slug VARCHAR(80) NOT NULL,
  is_primary TINYINT(1) DEFAULT 1,
  PRIMARY KEY (article_id, category_slug),
  INDEX idx_art_cat_slug (category_slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS article_tags (
  article_id VARCHAR(64) NOT NULL,
  tag_name VARCHAR(96) NOT NULL,
  PRIMARY KEY (article_id, tag_name),
  INDEX idx_art_tag_name (tag_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS seo_metadata (
  article_id VARCHAR(64) PRIMARY KEY,
  meta_title_en VARCHAR(255) NULL,
  meta_title_ur VARCHAR(255) NULL,
  meta_description_en TEXT NULL,
  meta_description_ur TEXT NULL,
  canonical_url VARCHAR(255) NULL,
  focus_keywords_json JSON NULL,
  og_image TEXT NULL,
  no_index TINYINT(1) DEFAULT 0,
  schema_type VARCHAR(80) DEFAULT 'NewsArticle',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS article_versions (
  version_id VARCHAR(64) PRIMARY KEY,
  article_id VARCHAR(64) NOT NULL,
  version_number INT NOT NULL DEFAULT 1,
  saved_by VARCHAR(160) NOT NULL,
  title_en TEXT NOT NULL,
  title_ur TEXT NOT NULL,
  summary_en TEXT NULL,
  summary_ur TEXT NULL,
  content_en LONGTEXT NULL,
  content_ur LONGTEXT NULL,
  change_note TEXT NULL,
  saved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_art_ver_article (article_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS publication_logs (
  id VARCHAR(64) PRIMARY KEY,
  article_id VARCHAR(64) NOT NULL,
  action VARCHAR(48) NOT NULL,
  previous_status VARCHAR(32) NULL,
  next_status VARCHAR(32) NOT NULL,
  actor VARCHAR(160) NOT NULL,
  correlation_id VARCHAR(64) NULL,
  storage_engine VARCHAR(32) NOT NULL DEFAULT 'mysql',
  message TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pub_logs_article (article_id),
  INDEX idx_pub_logs_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
