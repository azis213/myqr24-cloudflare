import { tagContentFileKey } from "../content-paths";
import { byteLength } from "./canonical";
import { fail, NO_STORE, publisherDenied, type PublisherEnv } from "./http";
import { TAG_ID } from "./limits";

interface ContentRow {
  tag_numeric_id: number;
  tag_base36_id: string;
  content_revision: number;
  content_file: string;
  content_sha256: string;
  content_bytes: number;
}

/**
 * `GET /api/v1/tags/{tagId}/content/document`
 *
 * Gibt das veröffentlichte Tag-Dokument **byte-identisch** zurück (inkl.
 * `elements[]`), damit ein `GET → PUT`-Roundtrip stabil bleibt. Nur für den
 * Publisher: Das Dokument enthält vollständige Nutzlasten, Theme und Layout.
 */
export async function getTagContentDocument(
  request: Request,
  env: PublisherEnv,
  pathTagId: string,
): Promise<Response> {
  const denied = publisherDenied(request, env);
  if (denied) return denied;
  if (!TAG_ID.test(pathTagId)) return fail(400, "invalid_request", "tagId ist ungültig.");

  const row = await env.APP_DB.prepare(
    "SELECT tag_numeric_id, tag_base36_id, content_revision, content_file, content_sha256, content_bytes FROM tag_content WHERE tag_base36_id = ?1 LIMIT 1",
  ).bind(pathTagId).first<ContentRow>();

  if (!row
    || row.tag_base36_id !== pathTagId
    || !Number.isSafeInteger(row.tag_numeric_id)
    || row.tag_numeric_id < 1) {
    return fail(404, "content_not_found", "Für diesen TAG ist kein Content veröffentlicht.");
  }

  let text: string | null = null;
  try {
    const object = await env.PRIVATE_CONTENT.get(tagContentFileKey(row.tag_numeric_id, row.content_file));
    if (object) text = await object.text();
  } catch {
    return fail(500, "internal", "Content konnte nicht gelesen werden.");
  }
  if (text === null) return fail(404, "content_not_found", "Für diesen TAG ist kein Content veröffentlicht.");
  if (byteLength(text) !== row.content_bytes) {
    return fail(500, "internal", "Content ist inkonsistent.");
  }

  const etag = `"${row.content_sha256}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ...NO_STORE, etag } });
  }

  return new Response(text, {
    status: 200,
    headers: {
      ...NO_STORE,
      "content-type": "application/json; charset=utf-8",
      etag,
      "x-content-revision": String(row.content_revision),
      "x-content-bytes": String(row.content_bytes),
    },
  });
}
