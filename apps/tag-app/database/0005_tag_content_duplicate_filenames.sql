-- Items are uniquely identified by content_id. Filenames are display metadata,
-- not unique identities; same-name uploads must coexist in one element.
-- The former assignment table's UNIQUE(tag_numeric_id, content_element_id,
-- filename_key) blocked duplicate display names. Rebuild the assignment table
-- without that constraint, preserving its composite element FK.
CREATE TABLE tag_content_element_items_v4 (
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

INSERT INTO tag_content_element_items_v4
  (tag_numeric_id, content_element_id, content_id, item_scope, filename_key, display_order, visibility)
SELECT tag_numeric_id, content_element_id, content_id, item_scope, filename_key, display_order, visibility
FROM tag_content_element_items;

DROP TRIGGER IF EXISTS tag_content_items_filename_immutable;
DROP TRIGGER IF EXISTS tag_content_element_items_scope_guard;
DROP TRIGGER IF EXISTS tag_content_element_items_status_guard;
DROP TRIGGER IF EXISTS tag_content_element_items_filename_guard;
DROP INDEX IF EXISTS tag_content_element_items_order_idx;
DROP INDEX IF EXISTS tag_content_element_items_content_idx;
DROP TABLE tag_content_element_items;
ALTER TABLE tag_content_element_items_v4 RENAME TO tag_content_element_items;
CREATE INDEX tag_content_element_items_order_idx
  ON tag_content_element_items (tag_numeric_id, content_element_id, display_order, content_id);
CREATE INDEX tag_content_element_items_content_idx
  ON tag_content_element_items (tag_numeric_id, content_id);

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

CREATE TRIGGER tag_content_element_items_status_guard
BEFORE INSERT ON tag_content_element_items
FOR EACH ROW
WHEN (SELECT status FROM tag_content_items WHERE content_id = NEW.content_id) <> 'ready'
BEGIN
  SELECT RAISE(ABORT, 'content item is not ready');
END;

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

CREATE TRIGGER tag_content_items_filename_immutable
BEFORE UPDATE OF filename_key ON tag_content_items
FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM tag_content_element_items WHERE content_id = OLD.content_id)
BEGIN
  SELECT RAISE(ABORT, 'filename key is immutable while assigned');
END;