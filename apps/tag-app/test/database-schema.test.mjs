import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrations = ["0001_tag_access.sql", "0002_tag_content.sql"].map((name) =>
  readFileSync(fileURLToPath(new URL(`../database/${name}`, import.meta.url)), "utf8"),
);

const now = "2026-11-17T12:00:00.000Z";
const tagOne = { numeric: 623187229, base36: "ab12cd" };
const tagTwo = { numeric: 871866449, base36: "ef34gh" };
const galleryId = "cel_wedding_gallery";
const documentsId = "cel_event_documents";
const localImageId = 1850000000000000;
const globalDocumentId = 1850000000000001;
const replacementImageId = 1850000000000002;
const secondLocalImageId = 1850000000000003;
const sha = "a".repeat(64);

function withDatabase(run) {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("PRAGMA foreign_keys = ON");
    for (const migration of migrations) db.exec(migration);
    return run(db);
  } finally {
    db.close();
  }
}

function insertTagContent(db, tag = tagOne, revision = 8) {
  db.prepare(`INSERT INTO tag_content (
    tag_numeric_id, tag_base36_id, content_revision, schema_version,
    content_file, content_sha256, content_bytes, content_type,
    published_at, updated_at
  ) VALUES (?, ?, ?, 1, ?, ?, 128, 'application/json', ?, ?)`)
    .run(tag.numeric, tag.base36, revision, `tag-rev${revision}.json`, sha, now, now);
}

function insertElement(db, tag = tagOne, id = galleryId, type = "gallery", order = 0, visibility = "public") {
  db.prepare(`INSERT INTO tag_content_elements (
    tag_numeric_id, content_element_id, content_element_type, display_order,
    content_file, content_sha256, content_bytes, content_type, visibility
  ) VALUES (?, ?, ?, ?, ?, ?, 64, 'application/json', ?)`)
    .run(tag.numeric, id, type, order, "element-rev8.json", sha, visibility);
}

function insertItem(db, options = {}) {
  const values = {
    contentId: localImageId,
    itemType: "image",
    scope: "tag",
    owner: tagOne,
    title: "Testbild",
    altText: "Nicht personenbezogenes Testbild",
    originalFilename: "Titelbild.JPG",
    filenameKey: "titelbild.jpg",
    status: "ready",
    revokedAt: null,
    ...options,
  };
  db.prepare(`INSERT INTO tag_content_items (
    content_id, content_item_type, scope, owner_tag_numeric_id,
    owner_tag_base36_id, title, alt_text, original_filename, filename_key,
    status, created_at, updated_at, revoked_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      values.contentId,
      values.itemType,
      values.scope,
      values.owner?.numeric ?? null,
      values.owner?.base36 ?? null,
      values.title,
      values.altText,
      values.originalFilename,
      values.filenameKey,
      values.status,
      now,
      now,
      values.revokedAt,
    );
}

function assignItem(db, tag = tagOne, elementId = galleryId, item = {}, order = 0, visibility = "public") {
  const values = { contentId: localImageId, scope: "tag", filenameKey: "titelbild.jpg", ...item };
  db.prepare(`INSERT INTO tag_content_element_items (
    tag_numeric_id, content_element_id, content_id, item_scope,
    filename_key, display_order, visibility
  ) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(tag.numeric, elementId, values.contentId, values.scope, values.filenameKey, order, visibility);
}

describe("TAG Application API operative content schema", () => {
  it("applies both migrations idempotently and exposes no revision table", () => {
    withDatabase((db) => {
      expect(() => migrations.forEach((migration) => db.exec(migration))).not.toThrow();
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND (name = 'tag_content' OR name LIKE 'tag_content_%') ORDER BY name").all();
      expect(tables.map((row) => row.name)).toEqual([
        "tag_content",
        "tag_content_element_items",
        "tag_content_elements",
        "tag_content_items",
        "tag_content_media_variants",
      ]);
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'tag_content_revisions'").get()).toBeUndefined();
      expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    });
  });

  it("uses the numeric TAG id as primary key and the Base36 id only for lookup", () => {
    withDatabase((db) => {
      insertTagContent(db);
      expect(db.prepare("SELECT tag_numeric_id, tag_base36_id FROM tag_content WHERE tag_base36_id = ?").get(tagOne.base36)).toEqual({
        tag_numeric_id: tagOne.numeric,
        tag_base36_id: tagOne.base36,
      });
      expect(() => insertTagContent(db, { numeric: 1, base36: "ab12cd" })).toThrow();
      expect(() => insertTagContent(db, { numeric: 623187229, base36: "abcdefgh" })).toThrow();
      expect(() => insertTagContent(db, { numeric: 2176782336, base36: "ab12cd" })).toThrow();
    });
  });

  it("reconstructs named elements from ordered relational item membership", () => {
    withDatabase((db) => {
      insertTagContent(db);
      insertElement(db, tagOne, galleryId, "gallery", 0);
      insertElement(db, tagOne, documentsId, "document-list", 1);
      insertItem(db);
      insertItem(db, {
        contentId: globalDocumentId,
        itemType: "document",
        scope: "global",
        owner: null,
        title: "Handbuch",
        altText: null,
        originalFilename: "Handbuch.pdf",
        filenameKey: "handbuch.pdf",
      });
      assignItem(db, tagOne, galleryId, { contentId: localImageId }, 0);
      assignItem(db, tagOne, documentsId, {
        contentId: globalDocumentId,
        scope: "global",
        filenameKey: "handbuch.pdf",
      }, 0);

      const rows = db.prepare(`SELECT e.content_element_id, i.content_id, i.scope, i.title
        FROM tag_content AS c
        JOIN tag_content_elements AS e ON e.tag_numeric_id = c.tag_numeric_id
        JOIN tag_content_element_items AS assignment
          ON assignment.tag_numeric_id = e.tag_numeric_id
          AND assignment.content_element_id = e.content_element_id
        JOIN tag_content_items AS i ON i.content_id = assignment.content_id
        WHERE c.tag_base36_id = ?
        ORDER BY e.display_order, assignment.display_order, assignment.content_id`).all(tagOne.base36);
      expect(rows).toEqual([
        { content_element_id: galleryId, content_id: localImageId, scope: "tag", title: "Testbild" },
        { content_element_id: documentsId, content_id: globalDocumentId, scope: "global", title: "Handbuch" },
      ]);
    });
  });

  it("allows global reuse across TAGs and elements but rejects TAG-scoped cross-TAG use", () => {
    withDatabase((db) => {
      insertTagContent(db, tagOne);
      insertTagContent(db, tagTwo);
      insertElement(db, tagOne, galleryId, "gallery", 0);
      insertElement(db, tagOne, documentsId, "document-list", 1);
      insertElement(db, tagTwo, documentsId, "document-list", 0);

      insertItem(db, {
        contentId: globalDocumentId,
        itemType: "document",
        scope: "global",
        owner: null,
        title: "Handbuch",
        originalFilename: "Handbuch.pdf",
        filenameKey: "handbuch.pdf",
      });
      assignItem(db, tagOne, documentsId, {
        contentId: globalDocumentId,
        scope: "global",
        filenameKey: "handbuch.pdf",
      });
      assignItem(db, tagOne, galleryId, {
        contentId: globalDocumentId,
        scope: "global",
        filenameKey: "handbuch.pdf",
      }, 1);
      assignItem(db, tagTwo, documentsId, {
        contentId: globalDocumentId,
        scope: "global",
        filenameKey: "handbuch.pdf",
      });

      insertItem(db);
      expect(() => assignItem(db, tagTwo, documentsId, { contentId: localImageId })).toThrow(/scope does not match/);
      assignItem(db, tagOne, galleryId, { contentId: localImageId });
      expect(() => assignItem(db, tagOne, documentsId, { contentId: localImageId })).toThrow();
    });
  });

  it("enforces per-element filename uniqueness and item readiness", () => {
    withDatabase((db) => {
      insertTagContent(db);
      insertElement(db);
      insertItem(db);
      assignItem(db);

      insertItem(db, {
        contentId: replacementImageId,
        originalFilename: "Titelbild.jpg",
        filenameKey: "titelbild.jpg",
      });
      expect(() => assignItem(db, tagOne, galleryId, { contentId: replacementImageId })).toThrow();
      expect(() => assignItem(db, tagOne, galleryId, {
        contentId: replacementImageId,
        filenameKey: "anderes.jpg",
      })).toThrow(/filename key does not match/);

      insertItem(db, {
        contentId: secondLocalImageId,
        status: "pending",
        originalFilename: "Pending.jpg",
        filenameKey: "pending.jpg",
      });
      expect(() => assignItem(db, tagOne, galleryId, {
        contentId: secondLocalImageId,
        filenameKey: "pending.jpg",
      }, 1)).toThrow(/not ready/);
    });
  });

  it("validates content id, scope, filename pairs and revocation metadata", () => {
    withDatabase((db) => {
      expect(() => insertItem(db, { contentId: 0 })).toThrow();
      expect(() => insertItem(db, { contentId: 4503599627370496 })).toThrow();
      expect(() => insertItem(db, { scope: "tag", owner: null })).toThrow();
      expect(() => insertItem(db, { scope: "global", owner: tagOne })).toThrow();
      expect(() => insertItem(db, { originalFilename: null })).toThrow();
      expect(() => insertItem(db, { revokedAt: now })).toThrow();
      insertItem(db, { contentId: secondLocalImageId, status: "revoked", revokedAt: now });
      expect(db.prepare("SELECT status FROM tag_content_items WHERE content_id = ?").get(secondLocalImageId)).toEqual({
        status: "revoked",
      });
    });
  });

  it("stores media variant metadata by item and rejects invalid variants", () => {
    withDatabase((db) => {
      insertItem(db);
      db.prepare(`INSERT INTO tag_content_media_variants (
        content_id, variant, content_type, byte_size, sha256, width, height, created_at
      ) VALUES (?, 'large', 'image/webp', 2048, ?, 1280, 720, ?)`).run(localImageId, sha, now);
      expect(db.prepare("SELECT content_id, variant, content_type FROM tag_content_media_variants").all()).toEqual([
        { content_id: localImageId, variant: "large", content_type: "image/webp" },
      ]);
      expect(() => db.prepare(`INSERT INTO tag_content_media_variants (
        content_id, variant, content_type, byte_size, sha256, created_at
      ) VALUES (?, 'large', 'image/jpeg', 1, ?, ?)`).run(localImageId, sha, now)).toThrow();
      expect(() => db.prepare(`INSERT INTO tag_content_media_variants (
        content_id, variant, content_type, byte_size, sha256, created_at
      ) VALUES (?, '../escape', 'image/jpeg', 1, ?, ?)`).run(localImageId, sha, now)).toThrow();
    });
  });

  it("keeps only the current element state when a new revision is projected", () => {
    withDatabase((db) => {
      insertTagContent(db, tagOne, 8);
      insertElement(db, tagOne, galleryId, "gallery", 0);
      db.prepare("UPDATE tag_content SET content_revision = 9, content_file = 'tag-rev9.json' WHERE tag_numeric_id = ?").run(tagOne.numeric);
      db.prepare("DELETE FROM tag_content_elements WHERE tag_numeric_id = ?").run(tagOne.numeric);
      insertElement(db, tagOne, documentsId, "document-list", 0);
      expect(db.prepare("SELECT content_element_id FROM tag_content_elements WHERE tag_numeric_id = ?").all(tagOne.numeric)).toEqual([
        { content_element_id: documentsId },
      ]);
      expect(db.prepare("SELECT content_revision, content_file FROM tag_content WHERE tag_numeric_id = ?").get(tagOne.numeric)).toEqual({
        content_revision: 9,
        content_file: "tag-rev9.json",
      });
    });
  });

  it("stores range and global description pointers with strict identifiers", () => {
    withDatabase((db) => {
      db.prepare(`INSERT INTO tag_range_content (
        range_id, content_id, content_revision, schema_version, content_file,
        content_sha256, content_bytes, content_type, published_at, updated_at
      ) VALUES ('campaign-summer-6-001', 'redirect-default', 7, 1,
        'content-rev7.json', ?, 96, 'application/json', ?, ?)`).run(sha, now, now);
      db.prepare(`INSERT INTO global_content (
        content_id, content_revision, schema_version, content_file,
        content_sha256, content_bytes, content_type, published_at, updated_at
      ) VALUES ('redirect-default', 3, 1, 'content-rev3.json', ?, 96,
        'application/json', ?, ?)`).run(sha, now, now);
      expect(db.prepare("SELECT range_id, content_id FROM tag_range_content").all()).toEqual([
        { range_id: "campaign-summer-6-001", content_id: "redirect-default" },
      ]);
      expect(db.prepare("SELECT content_id FROM global_content").all()).toEqual([
        { content_id: "redirect-default" },
      ]);
      expect(() => db.prepare(`INSERT INTO tag_range_content (
        range_id, content_id, content_revision, schema_version, content_file,
        content_sha256, content_bytes, content_type, published_at, updated_at
      ) VALUES ('../range', 'redirect-default', 1, 1, 'content-rev1.json',
        ?, 96, 'application/json', ?, ?)`).run(sha, now, now)).toThrow();
      expect(() => db.prepare(`INSERT INTO global_content (
        content_id, content_revision, schema_version, content_file,
        content_sha256, content_bytes, content_type, published_at, updated_at
      ) VALUES ('Redirect Default', 1, 1, 'content-rev1.json', ?, 96,
        'application/json', ?, ?)`).run(sha, now, now)).toThrow();
    });
  });
});