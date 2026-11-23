-- Canonical TAG Application D1 schema snapshot.
-- Current snapshot of schema migrations 0001, 0002, 0003 and 0005.
-- This file is the clean initial-install/deployment schema; it deliberately contains no seed data
-- and no destructive development reset. Keep it in sync with the migration test suite.
PRAGMA foreign_keys = ON;

-- table: global_content
CREATE TABLE global_content (
  content_id TEXT PRIMARY KEY CHECK (
    length(content_id) BETWEEN 1 AND 64
    AND substr(content_id, 1, 1) BETWEEN 'a' AND 'z'
    AND content_id NOT GLOB '*[^a-z0-9-]*'
  ),
  content_revision INTEGER NOT NULL CHECK (content_revision >= 1),
  schema_version INTEGER NOT NULL CHECK (schema_version >= 1),
  content_file TEXT NOT NULL CHECK (
    length(content_file) BETWEEN 6 AND 128
    AND content_file = lower(content_file)
    AND content_file NOT GLOB '*[^a-z0-9.-]*'
    AND content_file NOT LIKE '%..%'
    AND substr(content_file, 1, 1) BETWEEN 'a' AND 'z'
    AND content_file LIKE '%.json'
  ),
  content_sha256 TEXT NOT NULL CHECK (
    length(content_sha256) = 64
    AND content_sha256 NOT GLOB '*[^0-9a-f]*'
  ),
  content_bytes INTEGER NOT NULL CHECK (content_bytes > 0),
  content_type TEXT NOT NULL CHECK (content_type = 'application/json'),
  published_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- table: tag_access_sessions
CREATE TABLE tag_access_sessions (
  id TEXT PRIMARY KEY,
  tag_id TEXT NOT NULL REFERENCES tag_routing(tag_id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  access_version INTEGER NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('public', 'pin', 'login')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NULL
);

-- table: tag_content
CREATE TABLE tag_content (
  tag_numeric_id INTEGER PRIMARY KEY CHECK (
    tag_numeric_id > 0 AND tag_numeric_id < 3656158440062976
  ),
  tag_base36_id TEXT NOT NULL UNIQUE CHECK (
    length(tag_base36_id) IN (6, 8, 10)
    AND tag_base36_id = lower(tag_base36_id)
    AND tag_base36_id NOT GLOB '*[^0-9a-z]*'
  ),
  content_revision INTEGER NOT NULL CHECK (content_revision >= 1),
  schema_version INTEGER NOT NULL CHECK (schema_version >= 1),
  content_file TEXT NOT NULL CHECK (
    length(content_file) BETWEEN 6 AND 128
    AND content_file = lower(content_file)
    AND content_file NOT GLOB '*[^a-z0-9.-]*'
    AND content_file NOT LIKE '%..%'
    AND substr(content_file, 1, 1) BETWEEN 'a' AND 'z'
    AND content_file LIKE '%.json'
  ),
  content_sha256 TEXT NOT NULL CHECK (
    length(content_sha256) = 64
    AND content_sha256 NOT GLOB '*[^0-9a-f]*'
  ),
  content_bytes INTEGER NOT NULL CHECK (content_bytes > 0),
  content_type TEXT NOT NULL CHECK (content_type = 'application/json'),
  published_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (length(tag_base36_id) = 6
      AND tag_numeric_id >= 1679616
      AND tag_numeric_id < 2176782336)
    OR (length(tag_base36_id) = 8
      AND tag_numeric_id >= 2176782336
      AND tag_numeric_id < 2821109907456)
    OR (length(tag_base36_id) = 10
      AND tag_numeric_id >= 2821109907456
      AND tag_numeric_id < 3656158440062976)
  )
);

-- table: tag_content_element_items
CREATE TABLE "tag_content_element_items" (
  tag_numeric_id INTEGER NOT NULL,
  content_element_id TEXT NOT NULL,
  content_id INTEGER NOT NULL
    REFERENCES tag_content_items(content_id) ON DELETE RESTRICT,
  item_scope TEXT NOT NULL CHECK (item_scope IN ('tag', 'global')),
  filename_key TEXT NULL CHECK (
    filename_key IS NULL OR (
      length(filename_key) BETWEEN 1 AND 255
      AND filename_key = lower(filename_key)
      AND filename_key NOT GLOB '*[\\/:*?"<>|]*'
      AND filename_key NOT GLOB '*[[:cntrl:]]*'
      AND filename_key NOT LIKE '%..%'
    )
  ),
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
  content_element_id TEXT NOT NULL CHECK (
    length(content_element_id) BETWEEN 5 AND 124
    AND substr(content_element_id, 1, 4) = 'cel_'
    AND substr(content_element_id, 5) NOT GLOB '*[^A-Za-z0-9_-]*'
  ),
  content_element_type TEXT NOT NULL CHECK (
    length(content_element_type) BETWEEN 1 AND 64
    AND substr(content_element_type, 1, 1) BETWEEN 'a' AND 'z'
    AND content_element_type NOT GLOB '*[^a-z0-9-]*'
  ),
  display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  visibility TEXT NOT NULL CHECK (
    visibility IN ('public', 'shared', 'private', 'ownerOnly')
  ),
  PRIMARY KEY (tag_numeric_id, content_element_id)
);

-- table: tag_content_items
CREATE TABLE tag_content_items (
  content_id INTEGER PRIMARY KEY CHECK (
    content_id > 0 AND content_id <= 4503599627370495
  ),
  content_item_type TEXT NOT NULL CHECK (
    length(content_item_type) BETWEEN 1 AND 64
    AND substr(content_item_type, 1, 1) BETWEEN 'a' AND 'z'
    AND content_item_type NOT GLOB '*[^a-z0-9-]*'
  ),
  scope TEXT NOT NULL CHECK (scope IN ('tag', 'global')),
  owner_tag_numeric_id INTEGER NULL,
  owner_tag_base36_id TEXT NULL CHECK (
    owner_tag_base36_id IS NULL OR (
      length(owner_tag_base36_id) IN (6, 8, 10)
      AND owner_tag_base36_id = lower(owner_tag_base36_id)
      AND owner_tag_base36_id NOT GLOB '*[^0-9a-z]*'
    )
  ),
  title TEXT NULL CHECK (title IS NULL OR length(title) BETWEEN 1 AND 300),
  alt_text TEXT NULL CHECK (
    alt_text IS NULL OR length(alt_text) BETWEEN 1 AND 1000
  ),
  original_filename TEXT NULL CHECK (
    original_filename IS NULL OR length(original_filename) BETWEEN 1 AND 255
  ),
  filename_key TEXT NULL CHECK (
    filename_key IS NULL OR (
      length(filename_key) BETWEEN 1 AND 255
      AND filename_key = lower(filename_key)
      AND filename_key NOT GLOB '*[\\/:*?"<>|]*'
      AND filename_key NOT GLOB '*[[:cntrl:]]*'
      AND filename_key NOT LIKE '%..%'
    )
  ),
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
  variant TEXT NOT NULL CHECK (
    length(variant) BETWEEN 1 AND 64
    AND substr(variant, 1, 1) GLOB '[0-9a-z]'
    AND variant NOT GLOB '*[^a-z0-9-]*'
  ),
  content_type TEXT NOT NULL CHECK (
    length(content_type) BETWEEN 3 AND 127
    AND instr(content_type, '/') > 1
    AND content_type NOT GLOB '*[^a-z0-9.+/-]*'
  ),
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  sha256 TEXT NOT NULL CHECK (
    length(sha256) = 64
    AND sha256 NOT GLOB '*[^0-9a-f]*'
  ),
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
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tag_id, client_key)
);

-- table: tag_range_content
CREATE TABLE tag_range_content (
  range_id TEXT PRIMARY KEY CHECK (
    length(range_id) BETWEEN 1 AND 128
    AND substr(range_id, 1, 1) GLOB '[A-Za-z0-9]'
    AND range_id NOT GLOB '*[^A-Za-z0-9_-]*'
  ),
  content_id TEXT NOT NULL CHECK (
    length(content_id) BETWEEN 1 AND 64
    AND substr(content_id, 1, 1) BETWEEN 'a' AND 'z'
    AND content_id NOT GLOB '*[^a-z0-9-]*'
  ),
  content_revision INTEGER NOT NULL CHECK (content_revision >= 1),
  schema_version INTEGER NOT NULL CHECK (schema_version >= 1),
  content_file TEXT NOT NULL CHECK (
    length(content_file) BETWEEN 6 AND 128
    AND content_file = lower(content_file)
    AND content_file NOT GLOB '*[^a-z0-9.-]*'
    AND content_file NOT LIKE '%..%'
    AND substr(content_file, 1, 1) BETWEEN 'a' AND 'z'
    AND content_file LIKE '%.json'
  ),
  content_sha256 TEXT NOT NULL CHECK (
    length(content_sha256) = 64
    AND content_sha256 NOT GLOB '*[^0-9a-f]*'
  ),
  content_bytes INTEGER NOT NULL CHECK (content_bytes > 0),
  content_type TEXT NOT NULL CHECK (content_type = 'application/json'),
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

-- trigger: tag_content_element_items_filename_guard
CREATE TRIGGER tag_content_element_items_filename_guard
BEFORE INSERT ON tag_content_element_items
FOR EACH ROW
WHEN NOT (
  (NEW.filename_key IS NULL AND
    (SELECT filename_key FROM tag_content_items WHERE content_id = NEW.content_id) IS NULL)
  OR NEW.filename_key =
    (SELECT filename_key FROM tag_content_items WHERE content_id = NEW.content_id)
)
BEGIN
  SELECT RAISE(ABORT, 'content item filename key does not match');
END;

-- trigger: tag_content_element_items_scope_guard
CREATE TRIGGER tag_content_element_items_scope_guard
BEFORE INSERT ON tag_content_element_items
FOR EACH ROW
WHEN NEW.item_scope <> (SELECT scope FROM tag_content_items WHERE content_id = NEW.content_id)
OR EXISTS (
  SELECT 1 FROM tag_content_items
  WHERE content_id = NEW.content_id AND scope = 'tag'
    AND owner_tag_numeric_id <> NEW.tag_numeric_id
)
BEGIN
  SELECT RAISE(ABORT, 'content item scope does not match assignment');
END;

-- trigger: tag_content_element_items_status_guard
CREATE TRIGGER tag_content_element_items_status_guard
BEFORE INSERT ON tag_content_element_items
FOR EACH ROW
WHEN (SELECT status FROM tag_content_items WHERE content_id = NEW.content_id) <> 'ready'
BEGIN
  SELECT RAISE(ABORT, 'content item is not ready');
END;

-- trigger: tag_content_element_items_tag_scope_guard
CREATE TRIGGER tag_content_element_items_tag_scope_guard
BEFORE INSERT ON tag_content_element_items
FOR EACH ROW
WHEN NEW.item_scope = 'tag' AND EXISTS (
  SELECT 1 FROM tag_content_element_items
  WHERE tag_numeric_id = NEW.tag_numeric_id AND content_id = NEW.content_id
)
BEGIN
  SELECT RAISE(ABORT, 'tag-scoped content item is already assigned');
END;

-- trigger: tag_content_items_content_id_immutable
CREATE TRIGGER tag_content_items_content_id_immutable
BEFORE UPDATE OF content_id ON tag_content_items
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'content id is immutable');
END;

-- trigger: tag_content_items_filename_immutable
CREATE TRIGGER tag_content_items_filename_immutable
BEFORE UPDATE OF filename_key ON tag_content_items
FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM tag_content_element_items WHERE content_id = OLD.content_id)
BEGIN
  SELECT RAISE(ABORT, 'filename key is immutable while assigned');
END;

-- trigger: tag_content_items_owner_immutable
CREATE TRIGGER tag_content_items_owner_immutable
BEFORE UPDATE OF scope, owner_tag_numeric_id, owner_tag_base36_id
ON tag_content_items
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'content item scope and owner are immutable');
END;
