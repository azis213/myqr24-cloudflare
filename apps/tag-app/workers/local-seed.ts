import type { AppApiEnv } from "./app-api";

const LOCAL_SCHEMA = [
  "CREATE TABLE IF NOT EXISTS tag_routing (tag_id TEXT PRIMARY KEY, status TEXT NOT NULL, target_type TEXT NOT NULL, external_url TEXT, protection_mode TEXT NOT NULL, access_version INTEGER NOT NULL, content_revision INTEGER NOT NULL, schema_version INTEGER NOT NULL, updated_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS tag_pin_credentials (tag_id TEXT PRIMARY KEY, pin_hash TEXT NOT NULL, pin_version INTEGER NOT NULL, updated_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS tag_pin_throttles (tag_id TEXT NOT NULL, client_key TEXT NOT NULL, failed_attempts INTEGER NOT NULL DEFAULT 0, locked_until TEXT, updated_at TEXT NOT NULL, PRIMARY KEY (tag_id, client_key))",
  "CREATE TABLE IF NOT EXISTS tag_access_sessions (id TEXT PRIMARY KEY, tag_id TEXT NOT NULL, token_hash TEXT NOT NULL, access_version INTEGER NOT NULL, scope TEXT NOT NULL, expires_at TEXT NOT NULL, revoked_at TEXT, created_at TEXT NOT NULL, last_seen_at TEXT)",
  "CREATE TABLE IF NOT EXISTS tag_content (tag_numeric_id INTEGER PRIMARY KEY, tag_base36_id TEXT NOT NULL, content_revision INTEGER NOT NULL, schema_version INTEGER NOT NULL, content_file TEXT NOT NULL, content_sha256 TEXT NOT NULL, content_bytes INTEGER NOT NULL, content_type TEXT NOT NULL, published_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS tag_content_elements (tag_numeric_id INTEGER NOT NULL, content_element_id TEXT NOT NULL, content_element_type TEXT NOT NULL, display_order INTEGER NOT NULL, content_file TEXT NOT NULL, content_sha256 TEXT NOT NULL, content_bytes INTEGER NOT NULL, content_type TEXT NOT NULL, visibility TEXT NOT NULL, PRIMARY KEY (tag_numeric_id, content_element_id))",
  "CREATE TABLE IF NOT EXISTS tag_content_items (content_id INTEGER PRIMARY KEY, content_item_type TEXT NOT NULL, scope TEXT NOT NULL, owner_tag_numeric_id INTEGER, owner_tag_base36_id TEXT, title TEXT, alt_text TEXT, original_filename TEXT, filename_key TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, revoked_at TEXT)",
  "CREATE TABLE IF NOT EXISTS tag_content_element_items (tag_numeric_id INTEGER NOT NULL, content_element_id TEXT NOT NULL, content_id INTEGER NOT NULL, item_scope TEXT NOT NULL, filename_key TEXT, display_order INTEGER NOT NULL, visibility TEXT NOT NULL, PRIMARY KEY (tag_numeric_id, content_element_id, content_id))",
  "CREATE TABLE IF NOT EXISTS tag_content_media_variants (content_id INTEGER NOT NULL, variant TEXT NOT NULL, content_type TEXT NOT NULL, byte_size INTEGER NOT NULL, sha256 TEXT NOT NULL, width INTEGER, height INTEGER, duration_ms INTEGER, created_at TEXT NOT NULL, PRIMARY KEY (content_id, variant))",
  "CREATE TABLE IF NOT EXISTS tag_range_content (range_id TEXT PRIMARY KEY, content_id TEXT NOT NULL, content_revision INTEGER NOT NULL, schema_version INTEGER NOT NULL, content_file TEXT NOT NULL, content_sha256 TEXT NOT NULL, content_bytes INTEGER NOT NULL, content_type TEXT NOT NULL, published_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS global_content (content_id TEXT PRIMARY KEY, content_revision INTEGER NOT NULL, schema_version INTEGER NOT NULL, content_file TEXT NOT NULL, content_sha256 TEXT NOT NULL, content_bytes INTEGER NOT NULL, content_type TEXT NOT NULL, published_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
];

const now = "2026-11-17T00:00:00.000Z";
const tagNumericId = 623187229;
const tagBase36Id = "ab12cd";
const contentId = 1850000000000000;
const tagFile = "tag-rev8.json";
const elementFile = "element-rev8.json";

const tagDocument = JSON.stringify({
  schema: "myqr24-tag-content-v2",
  tagNumericId: String(tagNumericId),
  tagId: tagBase36Id,
  revision: 8,
  view: {
    tag: { id: tagBase36Id, displayName: "Lokaler Docker-Testtag", presentation: "standard" },
    vault: {
      blocks: [
        {
          type: "text",
          title: "Lokale Testdaten",
          paragraphs: ["Diese Ansicht kommt aus der lokalen D1-/R2-Projektion der TAG Application API."],
        },
      ],
    },
    enabledFeatures: ["vault"],
  },
});

const elementDocument = JSON.stringify({
  schema: "myqr24-tag-element-v1",
  elementId: "cel_gallery",
  elementType: "gallery",
  payload: { title: "Lokale Galerie", layout: "grid" },
});

const itemDocument = JSON.stringify({
  schema: "myqr24-content-item-v1",
  contentId: String(contentId),
  type: "image",
  title: "Lokales Testbild",
  alt: "Lokales Testbild aus der Docker-Testumgebung",
});

const coverDocument = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#1f513d"/>
  <text x="32" y="37" font-family="sans-serif" font-size="12" fill="#ffffff" text-anchor="middle">TEST</text>
</svg>
`;

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export async function seedLocalContent(env: AppApiEnv): Promise<void> {
  for (const statement of LOCAL_SCHEMA) {
    await env.APP_DB.exec(statement);
  }

  const tagBytes = byteLength(tagDocument);
  const elementBytes = byteLength(elementDocument);
  const coverBytes = byteLength(coverDocument);
  const [tagHash, elementHash, coverHash] = await Promise.all([
    sha256Hex(tagDocument),
    sha256Hex(elementDocument),
    sha256Hex(coverDocument),
  ]);

  await env.PRIVATE_CONTENT.put(`content/v1/tags/${tagNumericId}/${tagFile}`, tagDocument, {
    httpMetadata: { contentType: "application/json" },
  });
  await env.PRIVATE_CONTENT.put(
    `content/v1/tags/${tagNumericId}/elements/cel_gallery/${elementFile}`,
    elementDocument,
    { httpMetadata: { contentType: "application/json" } },
  );
  await env.PRIVATE_CONTENT.put(
    `content/v1/tags/${tagNumericId}/items/${contentId}/item.json`,
    itemDocument,
    { httpMetadata: { contentType: "application/json" } },
  );
  await env.PRIVATE_CONTENT.put(
    `content/v1/tags/${tagNumericId}/items/${contentId}/variants/cover`,
    coverDocument,
    { httpMetadata: { contentType: "image/svg+xml" } },
  );

  await env.APP_DB.prepare("DELETE FROM tag_content_element_items WHERE tag_numeric_id = ?1").bind(tagNumericId).run();
  await env.APP_DB.prepare("DELETE FROM tag_content_media_variants WHERE content_id = ?1").bind(contentId).run();
  await env.APP_DB.prepare("DELETE FROM tag_content_items WHERE content_id = ?1").bind(contentId).run();
  await env.APP_DB.prepare("DELETE FROM tag_content_elements WHERE tag_numeric_id = ?1").bind(tagNumericId).run();
  await env.APP_DB.prepare("DELETE FROM tag_content WHERE tag_numeric_id = ?1").bind(tagNumericId).run();
  await env.APP_DB.prepare("DELETE FROM tag_routing WHERE tag_id = ?1").bind(tagBase36Id).run();

  await env.APP_DB.prepare(`INSERT INTO tag_routing (
    tag_id, status, target_type, protection_mode, access_version,
    content_revision, schema_version, updated_at
  ) VALUES (?1, 'active', 'internal', 'public', 1, 8, 1, ?2)`).bind(tagBase36Id, now).run();

  await env.APP_DB.prepare(`INSERT INTO tag_content (
    tag_numeric_id, tag_base36_id, content_revision, schema_version,
    content_file, content_sha256, content_bytes, content_type,
    published_at, updated_at
  ) VALUES (?1, ?2, 8, 1, ?3, ?4, ?5, 'application/json', ?6, ?6)`)
    .bind(tagNumericId, tagBase36Id, tagFile, tagHash, tagBytes, now).run();

  await env.APP_DB.prepare(`INSERT INTO tag_content_elements (
    tag_numeric_id, content_element_id, content_element_type, display_order,
    content_file, content_sha256, content_bytes, content_type, visibility
  ) VALUES (?1, 'cel_gallery', 'gallery', 0, ?2, ?3, ?4, 'application/json', 'public')`)
    .bind(tagNumericId, elementFile, elementHash, elementBytes).run();

  await env.APP_DB.prepare(`INSERT INTO tag_content_items (
    content_id, content_item_type, scope, owner_tag_numeric_id,
    owner_tag_base36_id, title, alt_text, original_filename, filename_key,
    status, created_at, updated_at, revoked_at
  ) VALUES (?1, 'image', 'tag', ?2, ?3, 'Lokales Testbild',
    'Lokales Testbild aus der Docker-Testumgebung', 'testbild.svg', 'testbild.svg',
    'ready', ?4, ?4, NULL)`)
    .bind(contentId, tagNumericId, tagBase36Id, now).run();

  await env.APP_DB.prepare(`INSERT INTO tag_content_element_items (
    tag_numeric_id, content_element_id, content_id, item_scope,
    filename_key, display_order, visibility
  ) VALUES (?1, 'cel_gallery', ?2, 'tag', 'testbild.svg', 0, 'public')`)
    .bind(tagNumericId, contentId).run();

  await env.APP_DB.prepare(`INSERT INTO tag_content_media_variants (
    content_id, variant, content_type, byte_size, sha256,
    width, height, duration_ms, created_at
  ) VALUES (?1, 'cover', 'image/svg+xml', ?2, ?3, 64, 64, NULL, ?4)`)
    .bind(contentId, coverBytes, coverHash, now).run();
}
