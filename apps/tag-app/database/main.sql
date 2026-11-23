-- Canonical TAG Application D1 schema source.
-- Update this file first for schema changes, then generate the next numbered
-- migration from the reviewed schema change. The initial migration is copied
-- from this file when starting a clean environment.
PRAGMA foreign_keys = ON;

-- table: global_content
CREATE TABLE global_content (
  content_id TEXT PRIMARY KEY,
  content_revision INTEGER NOT NULL CHECK (content_revision >= 1),
  schema_version INTEGER NOT NULL CHECK (schema_version >= 1),
  content_file TEXT NOT NULL,
  content_sha256 TEXT NOT NULL,
  content_bytes INTEGER NOT NULL CHECK (content_bytes > 0),
  content_type TEXT NOT NULL CHECK (content_type IN ('application/json')),
  published_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- table: tag_access_sessions
CREATE TABLE tag_access_sessions (
  id TEXT PRIMARY KEY,
  tag_id TEXT NOT NULL REFERENCES tag_routing(tag_id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  access_version INTEGER NOT NULL CHECK (access_version >= 1),
  scope TEXT NOT NULL CHECK (scope IN ('public', 'pin', 'login')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NULL
);

-- table: tag_content
CREATE TABLE tag_content (
  tag_numeric_id INTEGER PRIMARY KEY CHECK (tag_numeric_id > 0),
  tag_base36_id TEXT NOT NULL UNIQUE,
  content_revision INTEGER NOT NULL CHECK (content_revision >= 1),
  schema_version INTEGER NOT NULL CHECK (schema_version >= 1),
  content_file TEXT NOT NULL,
  content_sha256 TEXT NOT NULL,
  content_bytes INTEGER NOT NULL CHECK (content_bytes > 0),
  content_type TEXT NOT NULL CHECK (content_type IN ('application/json')),
  published_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- table: tag_content_element_items
CREATE TABLE "tag_content_element_items" (
  tag_numeric_id INTEGER NOT NULL,
  content_element_id TEXT NOT NULL,
  content_id INTEGER NOT NULL
    REFERENCES tag_content_items(content_id) ON DELETE RESTRICT,
  item_scope TEXT NOT NULL CHECK (item_scope IN ('tag', 'global')),
  filename_key TEXT NULL,
  display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  visibility TEXT NOT NULL CHECK (
    visibility IN ('public', 'shared', 'private', 'ownerOnly')
  ),
  PRIMARY KEY (tag_numeric_id, content_element_id, content_id),
  FOREIGN KEY (tag_numeric_id, content_element_id)
    REFERENCES tag_content_elements(tag_numeric_id, content_element_id)
    ON DELETE CASCADE
);

-- table: tag_content_elements
CREATE TABLE "tag_content_elements" (
  tag_numeric_id INTEGER NOT NULL
    REFERENCES tag_content(tag_numeric_id) ON DELETE CASCADE,
  content_element_id TEXT NOT NULL,
  content_element_type TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  visibility TEXT NOT NULL CHECK (
    visibility IN ('public', 'shared', 'private', 'ownerOnly')
  ),
  PRIMARY KEY (tag_numeric_id, content_element_id)
);

-- table: tag_content_items
CREATE TABLE tag_content_items (
  content_id INTEGER PRIMARY KEY CHECK (content_id > 0),
  content_item_type TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('tag', 'global')),
  owner_tag_numeric_id INTEGER NULL,
  owner_tag_base36_id TEXT NULL,
  title TEXT NULL,
  alt_text TEXT NULL,
  original_filename TEXT NULL,
  filename_key TEXT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('pending', 'ready', 'quarantined', 'revoked')
  ),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revoked_at TEXT NULL,
  CHECK (
    (scope = 'tag'
      AND owner_tag_numeric_id IS NOT NULL
      AND owner_tag_base36_id IS NOT NULL)
    OR (scope = 'global'
      AND owner_tag_numeric_id IS NULL
      AND owner_tag_base36_id IS NULL)
  ),
  CHECK (
    (filename_key IS NULL AND original_filename IS NULL)
    OR (filename_key IS NOT NULL AND original_filename IS NOT NULL)
  ),
  CHECK ((status = 'revoked') = (revoked_at IS NOT NULL))
);

-- table: tag_content_media_variants
CREATE TABLE tag_content_media_variants (
  content_id INTEGER NOT NULL
    REFERENCES tag_content_items(content_id) ON DELETE CASCADE,
  variant TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  sha256 TEXT NOT NULL,
  width INTEGER NULL CHECK (width IS NULL OR width > 0),
  height INTEGER NULL CHECK (height IS NULL OR height > 0),
  duration_ms INTEGER NULL CHECK (duration_ms IS NULL OR duration_ms > 0),
  created_at TEXT NOT NULL,
  PRIMARY KEY (content_id, variant)
);

-- table: tag_pin_credentials
CREATE TABLE tag_pin_credentials (
  tag_id TEXT PRIMARY KEY REFERENCES tag_routing(tag_id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  pin_version INTEGER NOT NULL CHECK (pin_version >= 1),
  updated_at TEXT NOT NULL
);

-- table: tag_pin_throttles
CREATE TABLE tag_pin_throttles (
  tag_id TEXT NOT NULL,
  client_key TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until TEXT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tag_id, client_key)
);

-- table: tag_range_content
CREATE TABLE tag_range_content (
  range_id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL,
  content_revision INTEGER NOT NULL CHECK (content_revision >= 1),
  schema_version INTEGER NOT NULL CHECK (schema_version >= 1),
  content_file TEXT NOT NULL,
  content_sha256 TEXT NOT NULL,
  content_bytes INTEGER NOT NULL CHECK (content_bytes > 0),
  content_type TEXT NOT NULL CHECK (content_type IN ('application/json')),
  published_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- table: tag_routing
CREATE TABLE tag_routing (
  tag_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('active', 'suspended', 'deactivated', 'expired')),
  target_type TEXT NOT NULL CHECK (target_type IN ('internal', 'external')),
  external_url TEXT NULL,
  protection_mode TEXT NOT NULL CHECK (protection_mode IN ('public', 'pin_required', 'login_required', 'closed')),
  access_version INTEGER NOT NULL CHECK (access_version >= 1),
  content_revision INTEGER NOT NULL CHECK (content_revision >= 1),
  schema_version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

-- index: tag_access_sessions_lookup_idx
CREATE INDEX tag_access_sessions_lookup_idx
  ON tag_access_sessions (tag_id, token_hash, expires_at);

-- index: tag_content_element_items_content_idx
CREATE INDEX tag_content_element_items_content_idx
  ON tag_content_element_items (tag_numeric_id, content_id);

-- index: tag_content_element_items_order_idx
CREATE INDEX tag_content_element_items_order_idx
  ON tag_content_element_items (tag_numeric_id, content_element_id, display_order, content_id);

-- index: tag_content_elements_order_idx
CREATE INDEX tag_content_elements_order_idx
  ON tag_content_elements (tag_numeric_id, display_order, content_element_id);

-- index: tag_content_items_owner_idx
CREATE INDEX tag_content_items_owner_idx
  ON tag_content_items (owner_tag_numeric_id, status, created_at);

-- index: tag_content_items_status_idx
CREATE INDEX tag_content_items_status_idx
  ON tag_content_items (status, updated_at);

-- index: tag_routing_active_lookup_idx
CREATE INDEX tag_routing_active_lookup_idx
  ON tag_routing (tag_id, status);
