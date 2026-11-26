import { generateContentId, parseContentId } from "../content-id";
import {
  tagContentFileKey,
  tagItemFileKey,
  tagItemOriginalKey,
  tagItemVariantKey,
} from "../content-paths";
import { ELEMENT_DISPLAY_MODE, type ElementType, type Principal } from "./limits";
import { isVisibleToPrincipal, type Visibility } from "./principal";

const TAG_ID = /^(?:[0-9a-z]{6}|[0-9a-z]{8}|[0-9a-z]{10})$/;
const ELEMENT_ID = /^cel_[A-Za-z0-9_-]{1,120}$/;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_UPLOAD_BYTES + 1024 * 1024;
const MAX_VARIANTS_PER_ITEM = 16;
const NO_STORE = { "cache-control": "no-store", "x-content-type-options": "nosniff" };
const MIME_BY_EXTENSION: Record<string, { itemType: "image" | "document"; contentType: string }> = {
  jpg: { itemType: "image", contentType: "image/jpeg" },
  jpeg: { itemType: "image", contentType: "image/jpeg" },
  png: { itemType: "image", contentType: "image/png" },
  gif: { itemType: "image", contentType: "image/gif" },
  webp: { itemType: "image", contentType: "image/webp" },
  pdf: { itemType: "document", contentType: "application/pdf" },
  txt: { itemType: "document", contentType: "text/plain" },
};

export interface ContentItemsEnv {
  APP_DB: D1Database;
  PRIVATE_CONTENT: R2Bucket;
  TAG_CONTENT_API_KEY_S01?: string;
}

interface TagRow {
  tag_numeric_id: number;
  status: "active" | "suspended" | "deactivated" | "expired";
  target_type: "internal" | "external";
}

interface ElementRow {
  content_element_type: string;
  visibility: "public" | "shared" | "private" | "ownerOnly";
  max_display_order: number;
  item_count: number;
}

interface ItemRow {
  content_id: number;
  owner_tag_numeric_id: number;
  content_item_type: "image" | "document";
  original_filename: string;
  status: string;
}

function response(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

function failure(status: number, code: string, message: string): Response {
  return response({ error: { code, message } }, status);
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

function apiKeyDenied(request: Request, env: ContentItemsEnv): Response | null {
  if (!env.TAG_CONTENT_API_KEY_S01) return failure(503, "content_api_disabled", "Content-Item-API ist nicht konfiguriert.");
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  if (!match || !timingSafeEqual(match[1].trim(), env.TAG_CONTENT_API_KEY_S01)) {
    return failure(401, "unauthorized", "Nicht autorisiert.");
  }
  return null;
}

function validFilename(value: string | null): { filename: string; filenameKey: string; extension: string } | null {
  if (!value) return null;
  let filename: string;
  try {
    filename = decodeURIComponent(value).trim();
  } catch {
    return null;
  }
  if (!filename || filename.length > 255 || filename === "." || filename === ".."
    || filename.includes("..") || /[\\/:*?"<>|\u0000-\u001f\u007f]/u.test(filename) || /%2f|%5c/i.test(filename)
    || filename.endsWith(".") || filename.endsWith(" ")) return null;
  const extension = filename.includes(".") ? filename.slice(filename.lastIndexOf(".") + 1).toLowerCase() : "";
  if (!extension || !MIME_BY_EXTENSION[extension]) return null;
  return { filename, filenameKey: filename.normalize("NFKC").toLowerCase(), extension };
}

function matchesSignature(bytes: Uint8Array, contentType: string): boolean {
  if (contentType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === "image/png") return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value);
  if (contentType === "image/gif") return new TextDecoder().decode(bytes.subarray(0, 6)).match(/^GIF8[79]a$/) !== null;
  if (contentType === "image/webp") return bytes.length >= 12
    && new TextDecoder().decode(bytes.subarray(0, 4)) === "RIFF"
    && new TextDecoder().decode(bytes.subarray(8, 12)) === "WEBP";
  if (contentType === "application/pdf") return new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-";
  if (contentType === "text/plain") {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return !bytes.some((byte) => byte === 0);
    } catch {
      return false;
    }
  }
  return false;
}

async function readLimitedBody(request: Request): Promise<Uint8Array | null> {
  return readBodyUpTo(request, MAX_UPLOAD_BYTES);
}

async function readBodyUpTo(request: Request, limit: number): Promise<Uint8Array | null> {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

interface UploadFile {
  field: string;
  filename: string;
  contentType: string;
  bytes: Uint8Array;
  file: ReturnType<typeof validFilename>;
}

function isUploadFile(value: FormDataEntryValue): value is File {
  return typeof value !== "string" && typeof value.name === "string" && typeof value.arrayBuffer === "function";
}

async function uploadFiles(request: Request): Promise<UploadFile[] | Response> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    const filename = validFilename(request.headers.get("x-file-name"));
    if (!filename) return failure(400, "invalid_file_name", "Dateiname oder Dateiendung ist nicht erlaubt.");
    const mediaType = MIME_BY_EXTENSION[filename.extension];
    const rawContentType = contentType.split(";", 1)[0].trim().toLowerCase();
    if (mediaType.contentType !== rawContentType) return failure(415, "unsupported_media_type", "Content-Type und Dateiendung stimmen nicht überein.");
    const declaredBytes = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(declaredBytes) && declaredBytes > MAX_UPLOAD_BYTES) return failure(413, "payload_too_large", "Datei überschreitet 25 MiB.");
    let bytes: Uint8Array | null;
    try {
      bytes = await readLimitedBody(request);
    } catch {
      return failure(400, "invalid_request", "Datei konnte nicht gelesen werden.");
    }
    if (bytes === null) return failure(413, "payload_too_large", "Datei überschreitet 25 MiB.");
    return [{ field: "original", filename: filename.filename, contentType: mediaType.contentType, bytes, file: filename }];
  }

  const declaredBytes = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredBytes) && declaredBytes > MAX_MULTIPART_BYTES) {
    return failure(413, "payload_too_large", "Multipart-Anfrage überschreitet das Größenlimit.");
  }
  let body: Uint8Array | null;
  try {
    body = await readBodyUpTo(request, MAX_MULTIPART_BYTES);
  } catch {
    return failure(400, "invalid_request", "Multipart-Dateien konnten nicht gelesen werden.");
  }
  if (body === null) return failure(413, "payload_too_large", "Multipart-Anfrage überschreitet das Größenlimit.");

  let form: FormData;
  try {
    const replayBody = new ArrayBuffer(body.byteLength);
    new Uint8Array(replayBody).set(body);
    const replay = new Request("https://tag-content-upload.invalid/", {
      method: "POST",
      headers: { "content-type": contentType },
      body: replayBody,
    });
    form = await replay.formData();
  } catch {
    return failure(400, "invalid_multipart", "Multipart-Formulardaten sind ungültig.");
  }

  const files: UploadFile[] = [];
  let originalSeen = false;
  let totalFileBytes = 0;
  for (const [field, value] of form.entries()) {
    if (field !== "original" && !/^[a-z0-9][a-z0-9-]{0,63}$/.test(field)) {
      return failure(400, "invalid_variant", "Variantenschlüssel ist ungültig.");
    }
    if (field === "original") {
      if (originalSeen) return failure(400, "duplicate_original", "Es darf genau eine Originaldatei geben.");
      originalSeen = true;
    } else if (files.some((file) => file.field === field)) {
      return failure(400, "duplicate_variant", "Jeder Variantenschlüssel darf nur einmal vorkommen.");
    }
    if (!isUploadFile(value)) return failure(400, "invalid_multipart", "Jedes Formularfeld muss eine Datei enthalten.");

    const filename = validFilename(value.name);
    if (!filename) return failure(400, "invalid_file_name", "Dateiname oder Dateiendung ist nicht erlaubt.");
    const detected = MIME_BY_EXTENSION[filename.extension];
    const partContentType = value.type.split(";", 1)[0].trim().toLowerCase();
    if (detected.itemType !== "image" || detected.contentType !== partContentType) {
      return failure(415, "unsupported_media_type", "Multipart-Originale und Varianten müssen gültige Bilddateien sein.");
    }
    if (field !== "original" && files.length >= MAX_VARIANTS_PER_ITEM + 1) {
      return failure(400, "too_many_variants", `Pro Item sind höchstens ${MAX_VARIANTS_PER_ITEM} Varianten erlaubt.`);
    }
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await value.arrayBuffer());
    } catch {
      return failure(400, "invalid_multipart", "Datei konnte nicht gelesen werden.");
    }
    totalFileBytes += bytes.byteLength;
    if (bytes.byteLength === 0) return failure(400, "empty_file", "Leere Dateien sind nicht erlaubt.");
    if (bytes.byteLength > MAX_UPLOAD_BYTES || totalFileBytes > MAX_UPLOAD_BYTES) {
      return failure(413, "payload_too_large", "Die gesamte Upload-Größe darf 25 MiB nicht überschreiten.");
    }
    if (!matchesSignature(bytes, detected.contentType)) return failure(415, "invalid_file_content", "Dateiinhalt passt nicht zum Bildformat.");
    files.push({ field, filename: filename.filename, contentType: detected.contentType, bytes, file: filename });
  }
  if (!originalSeen) return failure(400, "original_required", "Multipart-Upload benötigt eine Datei im Feld original.");
  if (files.length > MAX_VARIANTS_PER_ITEM + 1) return failure(400, "too_many_variants", `Pro Item sind höchstens ${MAX_VARIANTS_PER_ITEM} Varianten erlaubt.`);
  return files;
}

const IMAGE_ELEMENT_TYPES = new Set(["image", "gallery", "maintenance-history", "finder-form"]);
const DOCUMENT_ELEMENT_TYPES = new Set(["document", "documents", "maintenance-history"]);

/**
 * Welche Elementtypen nehmen welchen Medientyp auf? Einzelbild und Galerie
 * teilen sich denselben Upload-Pfad; Einzel-Dokument und Dokumentenliste ebenso.
 */
function allowedElement(itemType: "image" | "document", elementType: string): boolean {
  return itemType === "image"
    ? IMAGE_ELEMENT_TYPES.has(elementType)
    : DOCUMENT_ELEMENT_TYPES.has(elementType);
}

interface ElementDefinition {
  elementType: ElementType;
  itemsMode: "none" | "dynamic";
  slotIds: string[];
  maxItems: number;
}

/**
 * Liest die Element-Definition aus dem veröffentlichten Tag-Dokument. Sie
 * entscheidet, ob ein Element Items aufnehmen darf, wie viele Kandidaten erlaubt
 * sind und ob genau ein Item angezeigt wird.
 */
async function loadElementDefinition(
  env: ContentItemsEnv,
  tagId: string,
  tagNumericId: number,
  elementId: string,
): Promise<ElementDefinition | null> {
  const row = await env.APP_DB.prepare(
    "SELECT content_file FROM tag_content WHERE tag_base36_id = ?1 AND tag_numeric_id = ?2 LIMIT 1",
  ).bind(tagId, tagNumericId).first<{ content_file: string }>();
  if (!row) return null;

  let document: unknown;
  try {
    const object = await env.PRIVATE_CONTENT.get(tagContentFileKey(tagNumericId, row.content_file));
    if (!object) return null;
    document = await object.json();
  } catch {
    return null;
  }
  if (!document || typeof document !== "object") return null;

  const elements = (document as { elements?: unknown }).elements;
  if (!Array.isArray(elements)) return null;
  const entry = elements.find(
    (candidate) => !!candidate && typeof candidate === "object" && (candidate as { elementId?: unknown }).elementId === elementId,
  ) as { elementType?: unknown; payload?: unknown } | undefined;
  if (!entry || typeof entry.elementType !== "string" || !(entry.elementType in ELEMENT_DISPLAY_MODE)) return null;

  const payload = entry.payload && typeof entry.payload === "object" && !Array.isArray(entry.payload)
    ? entry.payload as Record<string, unknown>
    : {};
  const items = payload.items && typeof payload.items === "object" && !Array.isArray(payload.items)
    ? payload.items as Record<string, unknown>
    : {};
  const slotIds = Array.isArray(items.slotIds)
    ? items.slotIds.filter((slotId): slotId is string => typeof slotId === "string")
    : [];
  const slots = Array.isArray(payload.slots)
    ? payload.slots.filter((slot): slot is Record<string, unknown> => !!slot && typeof slot === "object" && !Array.isArray(slot))
    : [];
  const relevant = slotIds.length > 0 ? slots.filter((slot) => slotIds.includes(String(slot.slotId))) : slots;
  const maxItems = relevant.reduce((max, slot) => {
    const value = slot.max;
    return typeof value === "number" && Number.isSafeInteger(value) && value > max ? value : max;
  }, 0);

  return {
    elementType: entry.elementType as ElementType,
    itemsMode: items.mode === "dynamic" ? "dynamic" : "none",
    slotIds,
    maxItems,
  };
}

async function tagForUpload(env: ContentItemsEnv, tagId: string): Promise<TagRow | null> {
  return env.APP_DB.prepare(
    "SELECT tc.tag_numeric_id, routing.status, routing.target_type FROM tag_content AS tc JOIN tag_routing AS routing ON routing.tag_id = tc.tag_base36_id WHERE tc.tag_base36_id = ?1 LIMIT 1",
  ).bind(tagId).first<TagRow>();
}

/** `POST /api/v1/tags/{tagId}/elements/{elementId}/items` (API-key protected). */
export async function uploadContentItem(
  request: Request,
  env: ContentItemsEnv,
  tagId: string,
  elementId: string,
): Promise<Response> {
  const denied = apiKeyDenied(request, env);
  if (denied) return denied;
  if (!TAG_ID.test(tagId) || !ELEMENT_ID.test(elementId)) return failure(400, "invalid_request", "TAG- oder Element-ID ist ungültig.");

  const parsedFiles = await uploadFiles(request);
  if (parsedFiles instanceof Response) return parsedFiles;
  const original = parsedFiles.find((file) => file.field === "original")!;
  for (const file of parsedFiles) {
    if (file.bytes.byteLength === 0) return failure(400, "empty_file", "Leere Dateien sind nicht erlaubt.");
    if (file.bytes.byteLength > MAX_UPLOAD_BYTES || !matchesSignature(file.bytes, file.contentType)) {
      return failure(415, "invalid_file_content", "Dateiinhalt passt nicht zum erlaubten Bildformat.");
    }
  }
  const mediaType = MIME_BY_EXTENSION[original.file!.extension];
  const variants = parsedFiles.filter((file) => file.field !== "original");

  const tag = await tagForUpload(env, tagId);
  if (!tag || tag.status !== "active" || tag.target_type !== "internal" || !Number.isSafeInteger(tag.tag_numeric_id)) {
    return failure(404, "tag_not_found", "TAG ist nicht verfügbar.");
  }
  const route = await env.APP_DB.prepare("SELECT status, target_type FROM tag_routing WHERE tag_id = ?1 LIMIT 1")
    .bind(tagId).first<{ status: string; target_type: string }>();
  if (!route || route.status !== "active" || route.target_type !== "internal") {
    return failure(404, "tag_not_found", "TAG ist nicht verfügbar.");
  }

  const element = await env.APP_DB.prepare(
    "SELECT element.content_element_type, element.visibility, COALESCE(MAX(assignment.display_order), -1) AS max_display_order, COUNT(assignment.content_id) AS item_count FROM tag_content_elements AS element LEFT JOIN tag_content_element_items AS assignment ON assignment.tag_numeric_id = element.tag_numeric_id AND assignment.content_element_id = element.content_element_id WHERE element.tag_numeric_id = ?1 AND element.content_element_id = ?2 GROUP BY element.tag_numeric_id, element.content_element_id, element.content_element_type, element.visibility LIMIT 1",
  ).bind(tag.tag_numeric_id, elementId).first<ElementRow>();
  if (!element || !allowedElement(mediaType.itemType, element.content_element_type)) {
    return failure(404, "element_not_found", "Element ist nicht verfügbar oder akzeptiert diesen Medientyp nicht.");
  }
  const elementVisibility = await env.APP_DB.prepare(
    "SELECT visibility FROM tag_content_elements WHERE tag_numeric_id = ?1 AND content_element_id = ?2 LIMIT 1",
  ).bind(tag.tag_numeric_id, elementId).first<{ visibility: ElementRow["visibility"] }>();
  if (!elementVisibility) return failure(404, "element_not_found", "Element ist nicht verfügbar.");

  const definition = await loadElementDefinition(env, tagId, tag.tag_numeric_id, elementId);
  if (!definition || definition.itemsMode !== "dynamic") {
    return failure(404, "element_not_found", "Element nimmt keine Items auf.");
  }
  const itemCount = Number(element.item_count) || 0;
  if (definition.maxItems > 0 && itemCount >= definition.maxItems) {
    return failure(409, "slot_full", `Element nimmt höchstens ${definition.maxItems} Items auf.`);
  }
  const displayMode = ELEMENT_DISPLAY_MODE[definition.elementType] ?? "all";
  /**
   * Einzelanzeige: Das neue Item wird sichtbar (Element-Sichtbarkeit), die
   * bisherigen Kandidaten werden im selben Batch auf `ownerOnly` gesetzt. So
   * wirkt ein Upload wie „ersetzen", ohne Daten zu löschen; der Owner kann die
   * Sichtbarkeit später umschalten.
   */
  const assignmentVisibility = elementVisibility.visibility;

  const now = new Date().toISOString();
  let contentId = 0;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateContentId();
    const inserted = await env.APP_DB.prepare(
      "INSERT INTO tag_content_items (content_id, content_item_type, scope, owner_tag_numeric_id, owner_tag_base36_id, title, alt_text, original_filename, filename_key, status, created_at, updated_at, revoked_at) VALUES (?1, ?2, 'tag', ?3, ?4, NULL, NULL, ?5, ?6, 'pending', ?7, ?7, NULL) ON CONFLICT(content_id) DO NOTHING",
    ).bind(candidate, mediaType.itemType, tag.tag_numeric_id, tagId, original.filename, original.file!.filenameKey, now).run();
    if ((inserted.meta?.changes ?? 0) === 1) {
      contentId = candidate;
      break;
    }
  }
  if (!contentId) return failure(503, "content_id_unavailable", "Content-ID konnte nicht reserviert werden.");

  const objectKeys: string[] = [];
  try {
    objectKeys.push(tagItemOriginalKey(tag.tag_numeric_id, contentId, original.filename));
    for (const variant of variants) objectKeys.push(tagItemVariantKey(tag.tag_numeric_id, contentId, variant.field));
  } catch {
    await env.APP_DB.prepare("DELETE FROM tag_content_items WHERE content_id = ?1").bind(contentId).run();
    return failure(400, "invalid_variant", "Dateiname oder Variantenschlüssel ist nicht als Storage-Segment zulässig.");
  }

  try {
    for (const file of parsedFiles) {
      const key = file.field === "original"
        ? tagItemOriginalKey(tag.tag_numeric_id, contentId, file.filename)
        : tagItemVariantKey(tag.tag_numeric_id, contentId, file.field);
      const shaInput = Uint8Array.from(file.bytes).buffer;
      const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", shaInput)), (byte) => byte.toString(16).padStart(2, "0")).join("");
      await env.PRIVATE_CONTENT.put(key, file.bytes, {
        httpMetadata: { contentType: file.contentType, contentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(file.filename)}` },
        customMetadata: { contentId: String(contentId), tagId, elementId, variant: file.field === "original" ? "original" : file.field, itemType: mediaType.itemType, contentBytes: String(file.bytes.byteLength), sha256 },
      });
    }
    const statements = [
      env.APP_DB.prepare("UPDATE tag_content_items SET status = 'ready', updated_at = ?1 WHERE content_id = ?2 AND status = 'pending'").bind(new Date().toISOString(), contentId),
      env.APP_DB.prepare("INSERT INTO tag_content_element_items (tag_numeric_id, content_element_id, content_id, item_scope, filename_key, display_order, visibility) VALUES (?1, ?2, ?3, 'tag', ?4, ?5, ?6)")
        .bind(tag.tag_numeric_id, elementId, contentId, original.file!.filenameKey, Math.max(0, element.max_display_order + 1), assignmentVisibility),
    ];
    if (displayMode === "single" && itemCount > 0) {
      statements.push(
        env.APP_DB.prepare("UPDATE tag_content_element_items SET visibility = 'ownerOnly' WHERE tag_numeric_id = ?1 AND content_element_id = ?2 AND content_id <> ?3")
          .bind(tag.tag_numeric_id, elementId, contentId),
      );
    }
    for (const variant of variants) {
      const shaInput = Uint8Array.from(variant.bytes).buffer;
      const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", shaInput)), (byte) => byte.toString(16).padStart(2, "0")).join("");
      statements.push(env.APP_DB.prepare("INSERT INTO tag_content_media_variants (content_id, variant, content_type, byte_size, sha256, width, height, duration_ms, created_at) VALUES (?1, ?2, ?3, ?4, ?5, NULL, NULL, NULL, ?6)")
        .bind(contentId, variant.field, variant.contentType, variant.bytes.byteLength, sha256, new Date().toISOString()));
    }
    await env.APP_DB.batch(statements);
  } catch {
    let objectsDeleted = true;
    try {
      await Promise.all(objectKeys.map((objectKey) => env.PRIVATE_CONTENT.delete(objectKey)));
    } catch { objectsDeleted = false; /* Keep pending item so operational cleanup can retry object deletion. */ }
    if (objectsDeleted) {
      try {
        await env.APP_DB.prepare("DELETE FROM tag_content_media_variants WHERE content_id = ?1").bind(contentId).run();
        await env.APP_DB.prepare("DELETE FROM tag_content_items WHERE content_id = ?1 AND status = 'pending'").bind(contentId).run();
      } catch { /* Keep the pending row for cleanup/retry if D1 is unavailable. */ }
    }
    return failure(500, "upload_failed", "Datei konnte nicht veröffentlicht werden.");
  }

  return response({
    status: "created",
    tagId,
    elementId,
    contentId: String(contentId),
    type: mediaType.itemType,
    filename: original.filename,
    contentType: original.contentType,
    contentBytes: original.bytes.byteLength,
    visibility: assignmentVisibility,
    variants: variants.map((variant) => ({ variant: variant.field, filename: variant.filename, contentType: variant.contentType, contentBytes: variant.bytes.byteLength })),
  }, 201);
}

/** `GET /api/v1/tags/{tagId}/items/{contentId}/media` (TAG-session protected). */
export async function readContentItem(
  request: Request,
  env: ContentItemsEnv,
  tagId: string,
  contentIdText: string,
  sessionScope: "public" | "pin" | "login",
): Promise<Response> {
  const contentId = parseContentId(contentIdText);
  if (!TAG_ID.test(tagId) || contentId === null) return new Response("Not Found", { status: 404, headers: NO_STORE });
  const row = await env.APP_DB.prepare(
    "SELECT item.content_id, item.owner_tag_numeric_id, item.content_item_type, item.original_filename, item.status, element.visibility AS element_visibility, assignment.visibility AS assignment_visibility, element.content_element_id, item.scope FROM tag_content AS tc JOIN tag_content_element_items AS assignment ON assignment.tag_numeric_id = tc.tag_numeric_id AND assignment.content_id = ?2 JOIN tag_content_elements AS element ON element.tag_numeric_id = assignment.tag_numeric_id AND element.content_element_id = assignment.content_element_id JOIN tag_content_items AS item ON item.content_id = assignment.content_id AND item.owner_tag_numeric_id = tc.tag_numeric_id WHERE tc.tag_base36_id = ?1 AND item.status = 'ready' AND item.revoked_at IS NULL AND item.scope = 'tag' LIMIT 1",
  ).bind(tagId, contentId).first<ItemRow & { element_visibility: ElementRow["visibility"]; assignment_visibility: ElementRow["visibility"] }>();
  if (!row || !Number.isSafeInteger(row.owner_tag_numeric_id) || !isVisible(row.element_visibility, sessionScope) || !isVisible(row.assignment_visibility, sessionScope)) {
    return new Response("Not Found", { status: 404, headers: NO_STORE });
  }
  let key: string;
  try {
    key = tagItemOriginalKey(row.owner_tag_numeric_id, row.content_id, row.original_filename);
  } catch {
    return new Response("Not Found", { status: 404, headers: NO_STORE });
  }
  const object = await env.PRIVATE_CONTENT.get(key);
  if (!object) return new Response("Not Found", { status: 404, headers: NO_STORE });
  const headers = new Headers({
    ...NO_STORE,
    "content-type": safeContentType(object.httpMetadata?.contentType),
    "content-disposition": contentDisposition(row.content_item_type, row.original_filename),
    "content-length": String(object.size),
    "accept-ranges": "none",
    "x-content-type-options": "nosniff",
  });
  if (object.httpEtag) headers.set("etag", object.httpEtag);
  return new Response(object.body, { status: 200, headers });
}

function isVisible(visibility: ElementRow["visibility"], scope: "public" | "pin" | "login"): boolean {
  if (visibility === "public") return true;
  if (visibility === "shared") return scope !== "public";
  return false;
}

function safeContentType(value: string | undefined): string {
  if (!value || !/^(?:image\/(?:jpeg|png|gif|webp)|application\/pdf|text\/plain)$/.test(value)) {
    return "application/octet-stream";
  }
  return value;
}

function contentDisposition(itemType: "image" | "document", filename: string): string {
  const safeAscii = filename.replace(/[^\x20-\x7e]|[\\";]/g, "_");
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${itemType === "image" ? "inline" : "attachment"}; filename="${safeAscii}"; filename*=UTF-8''${encoded}`;
}

/** `DELETE /api/v1/tags/{tagId}/items/{contentId}` (API-key protected; images only). */
export async function deleteContentItem(
  request: Request,
  env: ContentItemsEnv,
  tagId: string,
  contentIdText: string,
): Promise<Response> {
  const denied = apiKeyDenied(request, env);
  if (denied) return denied;
  const contentId = parseContentId(contentIdText);
  if (!TAG_ID.test(tagId) || contentId === null) return failure(400, "invalid_request", "TAG- oder Content-ID ist ungültig.");
  const item = await env.APP_DB.prepare(
    "SELECT content_id, owner_tag_numeric_id, original_filename, status FROM tag_content_items WHERE content_id = ?1 AND scope = 'tag' AND content_item_type = 'image' AND owner_tag_base36_id = ?2 LIMIT 1",
  ).bind(contentId, tagId).first<{ content_id: number; owner_tag_numeric_id: number; original_filename: string; status: string }>();
  if (!item) {
    const retry = await env.APP_DB.prepare(
      "SELECT content_id FROM tag_content_items WHERE content_id = ?1 AND scope = 'tag' AND content_item_type = 'image' AND owner_tag_base36_id = ?2 LIMIT 1",
    ).bind(contentId, tagId).first<{ content_id: number }>();
    return retry
      ? failure(500, "delete_pending", "D1-Bereinigung kann sicher wiederholt werden.")
      : failure(404, "item_not_found", "Content-Item ist nicht verfügbar.");
  }
  if (!Number.isSafeInteger(item.owner_tag_numeric_id)) return failure(500, "internal", "Content-Item ist inkonsistent.");
  let key: string;
  try {
    key = tagItemOriginalKey(item.owner_tag_numeric_id, item.content_id, item.original_filename);
  } catch {
    return failure(500, "internal", "Content-Item ist inkonsistent.");
  }

  if (item.status !== "revoked") {
    const revoked = await env.APP_DB.prepare("UPDATE tag_content_items SET status = 'revoked', revoked_at = ?1, updated_at = ?1 WHERE content_id = ?2 AND scope = 'tag' AND status <> 'revoked'").bind(new Date().toISOString(), contentId).run();
    if (revoked.meta?.changes === 0) return failure(500, "delete_pending", "Item-Status konnte nicht sicher gesperrt werden; DELETE wiederholen.");
  }
  const variants = await env.APP_DB.prepare("SELECT variant FROM tag_content_media_variants WHERE content_id = ?1").bind(contentId).all<{ variant: string }>();
  const objectKeys = [key];
  try {
    objectKeys.push(tagItemFileKey(item.owner_tag_numeric_id, item.content_id));
    for (const variant of variants.results ?? []) objectKeys.push(tagItemVariantKey(item.owner_tag_numeric_id, item.content_id, variant.variant));
  } catch {
    return failure(500, "internal", "Content-Item ist inkonsistent.");
  }
  try {
    await Promise.all(objectKeys.map((objectKey) => env.PRIVATE_CONTENT.delete(objectKey)));
  } catch {
    return failure(500, "delete_pending", "Item ist gesperrt; Datei-Löschung kann sicher wiederholt werden.");
  }
  try {
    await env.APP_DB.batch([
      env.APP_DB.prepare("DELETE FROM tag_content_media_variants WHERE content_id = ?1").bind(contentId),
      env.APP_DB.prepare("DELETE FROM tag_content_element_items WHERE content_id = ?1 AND tag_numeric_id = ?2").bind(contentId, item.owner_tag_numeric_id),
      env.APP_DB.prepare("DELETE FROM tag_content_items WHERE content_id = ?1 AND owner_tag_numeric_id = ?2 AND status = 'revoked'").bind(contentId, item.owner_tag_numeric_id),
    ]);
  } catch {
    return failure(500, "delete_pending", "Datei ist gelöscht; D1-Bereinigung kann sicher wiederholt werden.");
  }
  return response({ status: "deleted", tagId, contentId: String(contentId) });
}
/** Anzeige-Link auf die Originaldatei eines Items (gleiche Origin wie die PWA). */
export function mediaUrlFor(tagId: string, contentId: number | string): string {
  return `/api/v1/tags/${encodeURIComponent(tagId)}/items/${encodeURIComponent(String(contentId))}/media`;
}

export interface ContentItemLink {
  contentId: string;
  type: "image" | "document";
  title: string | null;
  altText: string | null;
  filename: string | null;
  displayOrder: number;
  createdAt: string;
  visibility: Visibility;
  mediaUrl: string;
}

interface ItemListRow {
  content_element_id: string;
  content_id: number;
  content_item_type: "image" | "document";
  title: string | null;
  alt_text: string | null;
  original_filename: string | null;
  display_order: number;
  visibility: Visibility;
  created_at: string;
}

/**
 * Lädt alle sichtbaren Items eines TAGs in **einer** Query und gruppiert sie je
 * Element. Die Sichtbarkeit (`public`/`shared`/`private`/`ownerOnly`) wird gegen
 * den effektiven Prinzipal geprüft.
 */
export async function loadItemsByElement(
  env: ContentItemsEnv,
  tagId: string,
  tagNumericId: number,
  principal: Principal,
): Promise<Map<string, ContentItemLink[]>> {
  const rows = await env.APP_DB.prepare(
    "SELECT assignment.content_element_id, item.content_id, item.content_item_type, item.title, item.alt_text, item.original_filename, assignment.display_order, assignment.visibility, item.created_at FROM tag_content_element_items AS assignment JOIN tag_content_items AS item ON item.content_id = assignment.content_id WHERE assignment.tag_numeric_id = ?1 AND item.status = 'ready' AND item.revoked_at IS NULL ORDER BY assignment.content_element_id, assignment.display_order, item.created_at, item.content_id",
  ).bind(tagNumericId).all<ItemListRow>();

  const byElement = new Map<string, ContentItemLink[]>();
  for (const row of rows.results ?? []) {
    if (!Number.isSafeInteger(row.content_id)) continue;
    if (!isVisibleToPrincipal(row.visibility, principal)) continue;
    const list = byElement.get(row.content_element_id) ?? [];
    list.push({
      contentId: String(row.content_id),
      type: row.content_item_type,
      title: row.title,
      altText: row.alt_text,
      filename: row.original_filename,
      displayOrder: row.display_order,
      createdAt: row.created_at,
      visibility: row.visibility,
      mediaUrl: mediaUrlFor(tagId, row.content_id),
    });
    byElement.set(row.content_element_id, list);
  }
  return byElement;
}

export interface ElementItemsResult {
  elementId: string;
  elementType: ElementType;
  /** `single`: Die PWA zeigt genau ein Item (das neueste sichtbare). */
  displayMode: "single" | "all";
  items: ContentItemLink[];
}

/**
 * Lädt die Items eines einzelnen Elements (Refresh-Pfad). Liefert `null`, wenn
 * das Element nicht existiert, nicht sichtbar ist oder keine Items aufnimmt –
 * der Aufrufer antwortet neutral mit `404`.
 */
export async function readElementItems(
  env: ContentItemsEnv,
  tagId: string,
  elementId: string,
  principal: Principal,
): Promise<ElementItemsResult | null> {
  const content = await env.APP_DB.prepare(
    "SELECT tag_numeric_id FROM tag_content WHERE tag_base36_id = ?1 LIMIT 1",
  ).bind(tagId).first<{ tag_numeric_id: number }>();
  if (!content || !Number.isSafeInteger(content.tag_numeric_id)) return null;

  const element = await env.APP_DB.prepare(
    "SELECT content_element_type, visibility FROM tag_content_elements WHERE tag_numeric_id = ?1 AND content_element_id = ?2 LIMIT 1",
  ).bind(content.tag_numeric_id, elementId).first<{ content_element_type: string; visibility: Visibility }>();
  if (!element || !(element.content_element_type in ELEMENT_DISPLAY_MODE)) return null;
  if (!isVisibleToPrincipal(element.visibility, principal)) return null;

  const byElement = await loadItemsByElement(env, tagId, content.tag_numeric_id, principal);
  const elementType = element.content_element_type as ElementType;
  return {
    elementId,
    elementType,
    displayMode: ELEMENT_DISPLAY_MODE[elementType] ?? "all",
    items: byElement.get(elementId) ?? [],
  };
}
