import type { AppApiEnv } from "./app-api";

const now = "2026-11-17T00:00:00.000Z";
const tagNumericId = 623187229;
const tagBase36Id = "ab12cd";
const contentId = 1850000000000000;
const tagFile = "tag-rev8.json";

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
  elements: [
    {
      elementId: "cel_gallery",
      elementType: "gallery",
      displayOrder: 20,
      visibility: "public",
      payload: {
        options: { name: "Lokale Galerie", layout: "grid" },
        slots: [{ slotId: "images", accepts: ["image"], min: 0, max: 48 }],
      },
    },
  ],
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
  const tagBytes = byteLength(tagDocument);
  const coverBytes = byteLength(coverDocument);
  const [tagHash, coverHash] = await Promise.all([
    sha256Hex(tagDocument),
    sha256Hex(coverDocument),
  ]);

  await env.PRIVATE_CONTENT.put(`content/v1/tags/${tagNumericId}/${tagFile}`, tagDocument, {
    httpMetadata: { contentType: "application/json" },
  });
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
    visibility
  ) VALUES (?1, 'cel_gallery', 'gallery', 20, 'public')`)
    .bind(tagNumericId).run();

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
