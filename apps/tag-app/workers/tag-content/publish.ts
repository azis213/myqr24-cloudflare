import { tagContentFileKey, tagContentFileName } from "../content-paths";
import { byteLength, canonicalize, sha256Hex } from "./canonical";
import { fail, json, publisherDenied, type PublisherEnv } from "./http";
import {
  CONTENT_SCHEMA,
  MAX_REQUEST_BYTES,
  MAX_TEMPLATE_BYTES,
  NUMERIC_ID,
  TAG_ID,
  TAG_NUMERIC_MAX,
} from "./limits";
import { buildProjection } from "./project";
import { validateTemplate } from "./validate";

/** Alias für Aufrufer/Tests; die Umgebung ist für Upload und Lesen identisch. */
export type PublishEnv = PublisherEnv;

interface RoutingRow {
  tag_id: string;
  status: string;
  target_type: string;
  content_revision: number;
}

interface ContentRow {
  tag_numeric_id: number;
  tag_base36_id: string;
  content_revision: number;
  content_sha256: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * `PUT /api/v1/tags/{tagId}/content`
 *
 * Vollständiger Ersatz des veröffentlichten Content-Stands eines TAGs:
 * validieren → projektzieren → ein R2-Objekt → ein D1-Batch.
 */
export async function publishTagContent(
  request: Request,
  env: PublishEnv,
  pathTagId: string,
): Promise<Response> {
  const denied = publisherDenied(request, env);
  if (denied) return denied;

  if (!TAG_ID.test(pathTagId)) return fail(400, "invalid_request", "tagId ist ungültig.");
  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.startsWith("application/json")) {
    return fail(415, "unsupported_media_type", "Content-Type muss application/json sein.");
  }
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return fail(413, "payload_too_large", "Anfrage ist zu groß.");
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return fail(400, "invalid_request", "Body konnte nicht gelesen werden.");
  }
  if (byteLength(raw) > MAX_REQUEST_BYTES) return fail(413, "payload_too_large", "Anfrage ist zu groß.");

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail(400, "invalid_request", "Body ist kein gültiges JSON.");
  }
  if (!isObject(body)) return fail(400, "invalid_request", "Body muss ein JSON-Objekt sein.");

  const tagId = body.tagId;
  if (typeof tagId !== "string" || !TAG_ID.test(tagId) || tagId !== pathTagId) {
    return fail(400, "invalid_request", "tagId in Pfad und Body müssen übereinstimmen.");
  }
  const tagNumericId = body.tagNumericId;
  if (typeof tagNumericId !== "string"
    || !NUMERIC_ID.test(tagNumericId)
    || Number(tagNumericId) > TAG_NUMERIC_MAX) {
    return fail(400, "invalid_request", "tagNumericId muss ein kanonischer Dezimalstring sein.");
  }
  const tagName = typeof body.tagName === "string" ? body.tagName : undefined;
  let expectedRevision: number | undefined;
  if (body.expectedRevision !== undefined) {
    if (typeof body.expectedRevision !== "number"
      || !Number.isSafeInteger(body.expectedRevision)
      || body.expectedRevision < 1) {
      return fail(400, "invalid_request", "expectedRevision muss eine positive Ganzzahl sein.");
    }
    expectedRevision = body.expectedRevision;
  }

  const validation = validateTemplate(body.template);
  if (!validation.document) {
    return fail(422, "template_invalid", "Das Template entspricht nicht dem Schema.", { issues: validation.issues });
  }
  const template = validation.document;
  const numeric = Number(tagNumericId);

  const routing = await env.APP_DB.prepare(
    "SELECT tag_id, status, target_type, content_revision FROM tag_routing WHERE tag_id = ?1 LIMIT 1",
  ).bind(tagId).first<RoutingRow>();
  if (!routing || routing.status !== "active" || routing.target_type !== "internal") {
    return fail(404, "tag_not_found", "TAG ist nicht verfügbar.");
  }

  const existing = await env.APP_DB.prepare(
    "SELECT tag_numeric_id, tag_base36_id, content_revision, content_sha256 FROM tag_content WHERE tag_numeric_id = ?1 OR tag_base36_id = ?2 LIMIT 1",
  ).bind(numeric, tagId).first<ContentRow>();

  if (existing && (existing.tag_numeric_id !== numeric || existing.tag_base36_id !== tagId)) {
    return fail(409, "tag_identity_mismatch", "Base36-ID und Big-Int-ID gehören nicht zusammen.");
  }
  if (expectedRevision !== undefined && (!existing || existing.content_revision !== expectedRevision)) {
    return fail(409, "revision_conflict", "Die erwartete Revision stimmt nicht mit dem aktuellen Stand überein.");
  }

  const projection = buildProjection({ document: template, tagId, tagName });
  const base = {
    schema: CONTENT_SCHEMA,
    tagNumericId,
    tagId,
    view: projection.view,
    // Im Dokument steht nur die Nutzlast; `displayOrder`/`visibility` bleiben D1.
    elements: projection.elements.map(({ elementId, elementType, payload }) => ({ elementId, elementType, payload })),
  };
  const elementIds = projection.elements.map((element) => element.elementId);

  /**
   * Idempotenz über den Inhalt **ohne** Revision: Die Revision steht im Dokument,
   * sonst wäre jeder Upload zwangsläufig ein neuer Hash. Der Vergleichsstand
   * nutzt die gespeicherte Revision, damit derselbe Inhalt denselben Hash ergibt.
   */
  const compareRevision = existing ? existing.content_revision : 1;
  const compareCanonical = canonicalize({ ...base, revision: compareRevision });
  const compareSha256 = await sha256Hex(compareCanonical);

  if (existing
    && compareSha256 === existing.content_sha256
    && existing.content_revision === routing.content_revision) {
    return json({
      status: "unchanged",
      tagId,
      tagNumericId,
      revision: compareRevision,
      contentSha256: compareSha256,
      contentBytes: byteLength(compareCanonical),
      elementCount: elementIds.length,
      elementIds,
      unchanged: true,
    });
  }

  const revision = existing ? existing.content_revision + 1 : 1;

  /**
   * Elemente mit Inhalten sind unantastbar: Sie werden nicht gelöscht, das Update
   * wird abgelehnt. Der Check läuft **vor** dem R2-Schreibvorgang, damit kein
   * verwaistes Objekt entsteht.
   */
  let removed: string[] = [];
  if (existing) {
    const existingRows = await env.APP_DB.prepare(
      "SELECT content_element_id FROM tag_content_elements WHERE tag_numeric_id = ?1",
    ).bind(numeric).all<{ content_element_id: string }>();
    const itemRows = await env.APP_DB.prepare(
      "SELECT content_element_id, COUNT(*) AS item_count FROM tag_content_element_items WHERE tag_numeric_id = ?1 GROUP BY content_element_id",
    ).bind(numeric).all<{ content_element_id: string; item_count: number }>();

    const itemCounts = new Map<string, number>();
    for (const row of itemRows.results ?? []) {
      itemCounts.set(row.content_element_id, Number(row.item_count) || 0);
    }
    const nextIds = new Set(elementIds);
    removed = (existingRows.results ?? [])
      .map((row) => row.content_element_id)
      .filter((elementId) => !nextIds.has(elementId));

    const blocked = removed
      .filter((elementId) => (itemCounts.get(elementId) ?? 0) > 0)
      .map((elementId) => ({ elementId, itemCount: itemCounts.get(elementId) ?? 0 }));
    if (blocked.length > 0) {
      return fail(409, "elements_in_use", "Elemente mit Inhalten können nicht entfernt werden.", {
        elements: blocked,
      });
    }
  }

  const canonical = canonicalize({ ...base, revision });
  const contentBytes = byteLength(canonical);
  if (contentBytes > MAX_TEMPLATE_BYTES) {
    return fail(413, "payload_too_large", `Tag-Dokument überschreitet ${MAX_TEMPLATE_BYTES} Bytes.`);
  }
  const contentSha256 = await sha256Hex(canonical);

  const responseBody = (status: string): Record<string, unknown> => ({
    status,
    tagId,
    tagNumericId,
    revision,
    contentSha256,
    contentBytes,
    elementCount: elementIds.length,
    elementIds,
    unchanged: false,
  });

  const contentFile = tagContentFileName(revision);
  const objectKey = tagContentFileKey(numeric, contentFile);
  try {
    await env.PRIVATE_CONTENT.put(objectKey, canonical, {
      httpMetadata: { contentType: "application/json" },
    });
  } catch {
    return fail(500, "internal", "Content konnte nicht gespeichert werden.");
  }

  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];

  if (existing) {
    statements.push(
      env.APP_DB.prepare(
        "UPDATE tag_content SET tag_base36_id = ?2, content_revision = ?3, schema_version = ?4, content_file = ?5, content_sha256 = ?6, content_bytes = ?7, content_type = 'application/json', updated_at = ?8 WHERE tag_numeric_id = ?1",
      ).bind(numeric, tagId, revision, template.schemaVersion, contentFile, contentSha256, contentBytes, now),
    );
  } else {
    statements.push(
      env.APP_DB.prepare(
        "INSERT INTO tag_content (tag_numeric_id, tag_base36_id, content_revision, schema_version, content_file, content_sha256, content_bytes, content_type, published_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'application/json', ?8, ?8)",
      ).bind(numeric, tagId, revision, template.schemaVersion, contentFile, contentSha256, contentBytes, now),
    );
  }

  for (const element of projection.elements) {
    // Datei-Spalten sind Kopien des Tag-Dokuments (D-14, §7.6a) – identisch für alle Elemente.
    statements.push(
      env.APP_DB.prepare(
        "INSERT INTO tag_content_elements (tag_numeric_id, content_element_id, content_element_type, display_order, content_file, content_sha256, content_bytes, content_type, visibility) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'application/json', ?8) ON CONFLICT(tag_numeric_id, content_element_id) DO UPDATE SET content_element_type = excluded.content_element_type, display_order = excluded.display_order, content_file = excluded.content_file, content_sha256 = excluded.content_sha256, content_bytes = excluded.content_bytes, content_type = excluded.content_type, visibility = excluded.visibility",
      ).bind(
        numeric,
        element.elementId,
        element.elementType,
        element.displayOrder,
        contentFile,
        contentSha256,
        contentBytes,
        element.visibility,
      ),
    );
  }

  let deleteIndex = -1;
  if (removed.length > 0) {
    const placeholders = removed.map((_, index) => `?${index + 2}`).join(", ");
    deleteIndex = statements.length;
    statements.push(
      env.APP_DB.prepare(
        `DELETE FROM tag_content_elements
           WHERE tag_numeric_id = ?1
             AND content_element_id IN (${placeholders})
             AND NOT EXISTS (
               SELECT 1 FROM tag_content_element_items AS assignment
                WHERE assignment.tag_numeric_id = tag_content_elements.tag_numeric_id
                  AND assignment.content_element_id = tag_content_elements.content_element_id
             )`,
      ).bind(numeric, ...removed),
    );
  }

  statements.push(
    env.APP_DB.prepare("UPDATE tag_routing SET content_revision = ?1, updated_at = ?2 WHERE tag_id = ?3")
      .bind(revision, now, tagId),
  );

  let results: D1Result[];
  try {
    results = await env.APP_DB.batch(statements);
  } catch {
    // R2-Objekt bleibt als Waise zurück (Cleanup-Gate); D1 ist unverändert.
    return fail(500, "internal", "Content konnte nicht veröffentlicht werden.");
  }
  const changed = results[0]?.meta?.changes ?? 0;
  if (existing && changed === 0) {
    return fail(409, "revision_conflict", "Der Stand wurde zwischenzeitlich geändert.");
  }
  if (deleteIndex >= 0) {
    const deleted = results[deleteIndex]?.meta?.changes ?? 0;
    if (deleted < removed.length) {
      return fail(409, "elements_in_use", "Elemente mit Inhalten können nicht entfernt werden.");
    }
  }

  return json(responseBody(existing ? "updated" : "created"), existing ? 200 : 201);
}
