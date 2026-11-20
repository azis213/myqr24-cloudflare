-- Element metadata is relational structure only. The complete element payload
-- is embedded in the current TAG document in R2.
-- Rebuild both sides of the composite FK together. Temporary names keep the
-- old tables live until both copies are complete; foreign_keys stays enabled.

CREATE TABLE tag_content_elements_v3 (
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

CREATE TABLE tag_content_element_items_v3 (
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
    REFERENCES tag_content_elements_v3(tag_numeric_id, content_element_id)
    ON DELETE CASCADE
);

INSERT INTO tag_content_elements_v3 (
  tag_numeric_id, content_element_id, content_element_type, display_order, visibility
)
SELECT tag_numeric_id, content_element_id, content_element_type, display_order, visibility
FROM tag_content_elements;

INSERT INTO tag_content_element_items_v3 (
  tag_numeric_id, content_element_id, content_id, item_scope,
  filename_key, display_order, visibility
)
SELECT tag_numeric_id, content_element_id, content_id, item_scope,
       filename_key, display_order, visibility
FROM tag_content_element_items;

-- This trigger references the table being rebuilt, so replace it around the
-- table swap (the other triggers remain attached to tag_content_items).
DROP TRIGGER tag_content_items_filename_immutable;
DROP INDEX tag_content_element_items_tag_scope_uidx;
DROP TABLE tag_content_element_items;
DROP TABLE tag_content_elements;

ALTER TABLE tag_content_elements_v3 RENAME TO tag_content_elements;
ALTER TABLE tag_content_element_items_v3 RENAME TO tag_content_element_items;

CREATE INDEX tag_content_elements_order_idx
  ON tag_content_elements (tag_numeric_id, display_order, content_element_id);

CREATE INDEX tag_content_element_items_order_idx
  ON tag_content_element_items (
    tag_numeric_id, content_element_id, display_order, content_id
  );

CREATE INDEX tag_content_element_items_content_idx
  ON tag_content_element_items (tag_numeric_id, content_id);

CREATE UNIQUE INDEX tag_content_element_items_tag_scope_uidx
  ON tag_content_element_items (tag_numeric_id, content_id)
  WHERE item_scope = 'tag';

CREATE TRIGGER tag_content_element_items_scope_guard
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

CREATE TRIGGER tag_content_element_items_status_guard
BEFORE INSERT ON tag_content_element_items
FOR EACH ROW
WHEN (
  SELECT status FROM tag_content_items WHERE content_id = NEW.content_id
) <> 'ready'
BEGIN
  SELECT RAISE(ABORT, 'content item is not ready');
END;

CREATE TRIGGER tag_content_element_items_filename_guard
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

CREATE TRIGGER tag_content_items_filename_immutable
BEFORE UPDATE OF filename_key ON tag_content_items
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM tag_content_element_items WHERE content_id = OLD.content_id
)
BEGIN
  SELECT RAISE(ABORT, 'filename key is immutable while assigned');
END;