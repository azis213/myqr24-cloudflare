import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const schema = readFileSync(fileURLToPath(new URL("../database/main.sql", import.meta.url)), "utf8");
const initialMigration = readFileSync(fileURLToPath(new URL("../database/migrations/0001_initial_schema.sql", import.meta.url)), "utf8");

function openDatabase(sql = initialMigration) {
  const db = new DatabaseSync(":memory:");
  db.exec(sql);
  return db;
}

describe("TAG Application D1 initial schema", () => {
  it("keeps the generated initial migration in sync with main.sql", () => {
    expect(initialMigration).toBe(schema);
  });

  it("creates all expected tables with foreign keys enabled and no triggers", () => {
    const db = openDatabase(schema);
    try {
      expect(db.prepare("PRAGMA foreign_keys").get().foreign_keys).toBe(1);
      expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger'").all()).toEqual([]);
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((row) => row.name)).toEqual([
        "global_content", "tag_access_sessions", "tag_content", "tag_content_element_items",
        "tag_content_elements", "tag_content_items", "tag_content_media_variants",
        "tag_pin_credentials", "tag_pin_throttles", "tag_range_content", "tag_routing",
      ]);
    } finally {
      db.close();
    }
  });

  it("keeps simple keys, enum lists, value bounds and state invariants", () => {
    const db = openDatabase(schema);
    try {
      expect(() => db.exec(`INSERT INTO tag_content (
        tag_numeric_id, tag_base36_id, content_revision, schema_version,
        content_file, content_sha256, content_bytes, content_type, published_at, updated_at
      ) VALUES (1, 'arbitrary-id', 1, 1, '../name', 'not-a-hash', 1,
        'application/json', 'now', 'now')`)).not.toThrow();

      expect(() => db.exec(`INSERT INTO tag_content_items (
        content_id, content_item_type, scope, status, created_at, updated_at
      ) VALUES (0, 'image', 'global', 'ready', 'now', 'now')`)).toThrow();
      expect(() => db.exec(`INSERT INTO tag_content_items (
        content_id, content_item_type, scope, status, created_at, updated_at
      ) VALUES (1, 'image', 'invalid', 'ready', 'now', 'now')`)).toThrow();
      expect(() => db.exec(`INSERT INTO tag_content_items (
        content_id, content_item_type, scope, status, created_at, updated_at, revoked_at
      ) VALUES (1, 'image', 'global', 'revoked', 'now', 'now', NULL)`)).toThrow();

      db.exec(`INSERT INTO tag_content_items (
        content_id, content_item_type, scope, status, created_at, updated_at, revoked_at
      ) VALUES (1, 'image', 'global', 'revoked', 'now', 'now', 'now')`);
      expect(db.prepare("SELECT status, revoked_at FROM tag_content_items WHERE content_id = 1").get()).toEqual({
        status: "revoked",
        revoked_at: "now",
      });
    } finally {
      db.close();
    }
  });

  it("enforces unique keys and declared foreign keys", () => {
    const db = openDatabase(schema);
    try {
      db.exec(`INSERT INTO tag_routing (
        tag_id, status, target_type, protection_mode, access_version,
        content_revision, updated_at
      ) VALUES ('tag-a', 'active', 'internal', 'public', 1, 1, 'now')`);
      db.exec(`INSERT INTO tag_pin_credentials (tag_id, pin_hash, pin_version, updated_at)
        VALUES ('tag-a', 'hash', 1, 'now')`);
      expect(() => db.exec(`INSERT INTO tag_pin_credentials (tag_id, pin_hash, pin_version, updated_at)
        VALUES ('tag-a', 'another-hash', 1, 'now')`)).toThrow();
      expect(() => db.exec(`INSERT INTO tag_pin_credentials (tag_id, pin_hash, pin_version, updated_at)
        VALUES ('missing-tag', 'hash', 1, 'now')`)).toThrow();
      expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally {
      db.close();
    }
  });
});