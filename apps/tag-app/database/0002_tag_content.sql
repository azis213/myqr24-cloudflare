-- TAG Application API D1: operative TAG content projection.
--
-- Design rules:
-- * Exactly one current content state per TAG. Editorial revisions remain
--   authoritative in TCP/TCC and are not part of any primary key here.
-- * TAG identity uses the numeric canonical ID as primary key. The Base36 ID
--   is a searchable projection only.
-- * JSON descriptions live in R2. D1 stores only pointers, hashes, sizes and
--   relational item metadata/membership.
-- * R2 keys are derived server-side; no blob key is stored in D1.
-- * Content item IDs are 32-bit Unix seconds plus 20 random bits (<= 2^52-1).

CREATE TABLE IF NOT EXISTS tag_content (
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

CREATE TABLE IF NOT EXISTS tag_content_elements (
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
  visibility TEXT NOT NULL CHECK (
    visibility IN ('public', 'shared', 'private', 'ownerOnly')
  ),
  PRIMARY KEY (tag_numeric_id, content_element_id)
);

CREATE INDEX IF NOT EXISTS tag_content_elements_order_idx
  ON tag_content_elements (tag_numeric_id, display_order, content_element_id);

CREATE TABLE IF NOT EXISTS tag_content_items (
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

CREATE INDEX IF NOT EXISTS tag_content_items_owner_idx
  ON tag_content_items (owner_tag_numeric_id, status, created_at);

CREATE INDEX IF NOT EXISTS tag_content_items_status_idx
  ON tag_content_items (status, updated_at);

CREATE TABLE IF NOT EXISTS tag_content_element_items (
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
  UNIQUE (tag_numeric_id, content_element_id, filename_key),
  FOREIGN KEY (tag_numeric_id, content_element_id)
    REFERENCES tag_content_elements(tag_numeric_id, content_element_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS tag_content_element_items_order_idx
  ON tag_content_element_items (
    tag_numeric_id, content_element_id, display_order, content_id
  );

CREATE INDEX IF NOT EXISTS tag_content_element_items_content_idx
  ON tag_content_element_items (tag_numeric_id, content_id);

-- TAG-scoped items may appear only once per TAG. Global items may be reused
-- in multiple elements of the same TAG.
CREATE UNIQUE INDEX IF NOT EXISTS tag_content_element_items_tag_scope_uidx
  ON tag_content_element_items (tag_numeric_id, content_id)
  WHERE item_scope = 'tag';

CREATE TRIGGER IF NOT EXISTS tag_content_element_items_scope_guard
BEFORE INSERT ON tag_content_element_items
FOR EACH ROW
WHEN NEW.item_scope <> (
  SELECT scope FROM tag_content_items WHERE content_id = NEW.content_id
)
OR EXISTS (
  SELECT 1 FROM tag_content_items
  WHERE content_id = NEW.content_id
    AND scope = 'tag'
    AND owner_tag_numeric_id <> NEW.tag_numeric_id
)
BEGIN
  SELECT RAISE(ABORT, 'content item scope does not match assignment');
END;

CREATE TRIGGER IF NOT EXISTS tag_content_element_items_status_guard
BEFORE INSERT ON tag_content_element_items
FOR EACH ROW
WHEN (
  SELECT status FROM tag_content_items WHERE content_id = NEW.content_id
) <> 'ready'
BEGIN
  SELECT RAISE(ABORT, 'content item is not ready');
END;

CREATE TRIGGER IF NOT EXISTS tag_content_element_items_filename_guard
BEFORE INSERT ON tag_content_element_items
FOR EACH ROW
WHEN NOT (
  (NEW.filename_key IS NULL
    AND (
      SELECT filename_key FROM tag_content_items
      WHERE content_id = NEW.content_id
    ) IS NULL)
  OR NEW.filename_key = (
    SELECT filename_key FROM tag_content_items
    WHERE content_id = NEW.content_id
  )
)
BEGIN
  SELECT RAISE(ABORT, 'content item filename key does not match');
END;

CREATE TRIGGER IF NOT EXISTS tag_content_items_content_id_immutable
BEFORE UPDATE OF content_id ON tag_content_items
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'content id is immutable');
END;

CREATE TRIGGER IF NOT EXISTS tag_content_items_owner_immutable
BEFORE UPDATE OF scope, owner_tag_numeric_id, owner_tag_base36_id
ON tag_content_items
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'content item scope and owner are immutable');
END;

CREATE TRIGGER IF NOT EXISTS tag_content_items_filename_immutable
BEFORE UPDATE OF filename_key ON tag_content_items
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM tag_content_element_items WHERE content_id = OLD.content_id
)
BEGIN
  SELECT RAISE(ABORT, 'filename key is immutable while assigned');
END;

CREATE TABLE IF NOT EXISTS tag_content_media_variants (
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

CREATE TABLE IF NOT EXISTS tag_range_content (
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

CREATE TABLE IF NOT EXISTS global_content (
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
