import { argon2Verify } from "hash-wasm";
import { Hono } from "hono";
import { parseContentId } from "./content-id";
import { globalItemVariantKey, tagContentFileKey, tagItemVariantKey } from "./content-paths";
import { deleteContentItem, readContentItem, uploadContentItem } from "./tag-content/items";
import { publishTagContent } from "./tag-content/publish";
import { getTagContentDocument } from "./tag-content/read";
import { handleTagTestAdminRequest } from "./tag-test-admin";

const TAG_ID = /^(?:[0-9a-z]{6}|[0-9a-z]{8}|[0-9a-z]{10})$/;
const VARIANT = /^[a-z0-9][a-z0-9-]{0,63}$/;
const BOOTSTRAP_TTL_SECONDS = 60;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const MAX_FAILED_PIN_ATTEMPTS = 5;
const PIN_LOCK_SECONDS = 15 * 60;
// Calibrate on the deployed Worker before changing these values. The local
// benchmark is evidence only and must not be treated as target-runtime proof.
export const ARGON2ID_PARAMETERS = Object.freeze({ memorySize: 8192, iterations: 1, parallelism: 1, hashLength: 32 });

export type ProtectionMode = "public" | "pin_required" | "login_required" | "closed";
export type TargetType = "internal" | "external";

export interface AppApiEnv {
  APP_DB: D1Database;
  PRIVATE_CONTENT: R2Bucket;
  APP_BOOTSTRAP_SECRET_S01: string;
  APP_PIN_PEPPER_S01: string;
  APP_MEDIA_SIGNER_KEY_S01: string;
  /** Publisher-Secret für `PUT /api/v1/tags/{tagId}/content`; fehlt es, ist der Pfad deaktiviert. */
  APP_CONTENT_PUBLISH_KEY_S01?: string;
  /** Server-to-server Content-Item upload/delete key; never sent to browser code. */
  TAG_CONTENT_API_KEY_S01?: string;
  /** Dedicated test-only routing admin key; configured only on staging worker. */
  TAG_TEST_ADMIN_KEY_S01?: string;
  /** Exact environment gate; production does not set this binding. */
  TAG_TEST_ADMIN_ENVIRONMENT?: string;
  MEDIA_SIGNER: Fetcher;
}

interface RoutingRecord {
  tag_id: string;
  status: "active" | "suspended" | "deactivated" | "expired";
  target_type: TargetType;
  protection_mode: ProtectionMode;
  access_version: number;
  content_revision: number;
}

interface AccessSession {
  id: string;
  tag_id: string;
  access_version: number;
  scope: "public" | "pin" | "login";
  expires_at: string;
  revoked_at: string | null;
}

interface ContentRow {
  tag_numeric_id: number;
  tag_base36_id: string;
  content_revision: number;
  content_file: string;
  content_sha256: string;
  content_bytes: number;
  content_type: string;
}

interface ContentElementRow {
  content_element_id: string;
  content_element_type: string;
  display_order: number;
  visibility: ElementVisibility;
}

interface ContentDocument {
  schema: "myqr24-tag-content-v2";
  tagNumericId: string;
  tagId: string;
  revision: number;
  view: Record<string, unknown>;
  /** Seit `D-14`: vollständige Element-Nutzlasten im Tag-Dokument. */
  elements: unknown;
}

interface ContentItemRow {
  content_element_id: string;
  content_id: number;
  content_item_type: string;
  title: string | null;
  alt_text: string | null;
  original_filename: string | null;
  display_order: number;
  visibility: ElementVisibility;
  scope: "tag" | "global";
}

type ElementVisibility = "public" | "shared" | "private" | "ownerOnly";

interface LoadedItem {
  contentId: string;
  type: string;
  title: string | null;
  altText: string | null;
  filename: string | null;
  displayOrder: number;
  visibility: ElementVisibility;
  scope: "tag" | "global";
}

interface LoadedElement {
  id: string;
  type: string;
  displayOrder: number;
  visibility: ElementVisibility;
  payload: Record<string, unknown>;
  items: LoadedItem[];
}

interface LoadedContent {
  document: ContentDocument;
  elements: LoadedElement[];
}

interface MediaVisibilityRow {
  content_id: number;
  scope: "tag" | "global";
  owner_tag_numeric_id: number | null;
  content_type: string;
  element_visibility: ElementVisibility;
  assignment_visibility: ElementVisibility;
}

function json(body: Record<string, unknown>, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers },
  });
}

function neutral(status = 404): Response {
  return new Response("Not Found", {
    status,
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}

const app = new Hono<{ Bindings: AppApiEnv }>();

app.use("*", async (c, next) => {
  if (c.req.method === "HEAD") return neutral();

  await next();
  c.res.headers.set("cache-control", "no-store");
  c.res.headers.set("x-content-type-options", "nosniff");
});

app.notFound(() => neutral());
app.onError(() => neutral(500));

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  return base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}

async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index++) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

function isVisibleToScope(visibility: ElementVisibility, scope: AccessSession["scope"]): boolean {
  if (visibility === "public") return true;
  if (visibility === "shared") return scope !== "public";
  return false;
}

const FORBIDDEN_STORAGE_KEYS = new Set(["object_key", "objectKey", "r2_key", "r2Key"]);

function containsStorageKey(value: unknown, depth = 0): boolean {
  if (depth > 8 || !value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((entry) => containsStorageKey(entry, depth + 1));
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_STORAGE_KEYS.has(key)) return true;
    if (containsStorageKey(child, depth + 1)) return true;
  }
  return false;
}

function isContentDocument(value: unknown, row: ContentRow): value is ContentDocument {
  if (!value || typeof value !== "object") return false;
  const document = value as Partial<ContentDocument>;
  return document.schema === "myqr24-tag-content-v2"
    && document.tagId === row.tag_base36_id
    && document.tagNumericId === String(row.tag_numeric_id)
    && document.revision === row.content_revision
    && !!document.view
    && typeof document.view === "object";
}

async function routing(env: AppApiEnv, tagId: string): Promise<RoutingRecord | null> {
  return env.APP_DB.prepare("SELECT tag_id, status, target_type, protection_mode, access_version, content_revision FROM tag_routing WHERE tag_id = ?1 LIMIT 1")
    .bind(tagId).first<RoutingRecord>();
}

async function verifyBootstrap(env: AppApiEnv, tagId: string, mode: ProtectionMode, accessVersion: number, revision: number, nonce: string, expiresAt: number, signature: string): Promise<boolean> {
  if (!Number.isSafeInteger(expiresAt) || expiresAt < Math.floor(Date.now() / 1000) || expiresAt > Math.floor(Date.now() / 1000) + BOOTSTRAP_TTL_SECONDS) return false;
  const payload = ["myqr24/pwa-bootstrap/v1", `tag=${tagId}`, `mode=${mode}`, `accessVersion=${accessVersion}`, `revision=${revision}`, `nonce=${nonce}`, `exp=${expiresAt}`].join("\n");
  return timingSafeEqual(await hmac(env.APP_BOOTSTRAP_SECRET_S01, payload), signature);
}

async function sessionFromRequest(request: Request, env: AppApiEnv, tagId: string): Promise<AccessSession | null> {
  const token = request.headers.get("cookie")?.match(/(?:^|;\s*)myqr24_tag_access=([^;]+)/)?.[1];
  if (!token) return null;
  const tokenHash = await sha256(token);
  const session = await env.APP_DB.prepare("SELECT id, tag_id, access_version, scope, expires_at, revoked_at FROM tag_access_sessions WHERE token_hash = ?1 AND tag_id = ?2 LIMIT 1")
    .bind(tokenHash, tagId).first<AccessSession>();
  if (!session || session.revoked_at !== null || Date.parse(session.expires_at) <= Date.now()) return null;
  const route = await routing(env, tagId);
  if (!route || route.status !== "active" || route.access_version !== session.access_version) return null;
  return session;
}

async function issueSession(env: AppApiEnv, record: RoutingRecord, scope: AccessSession["scope"]): Promise<string> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  await env.APP_DB.prepare("INSERT INTO tag_access_sessions (id, tag_id, token_hash, access_version, scope, expires_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)")
    .bind(crypto.randomUUID(), record.tag_id, await sha256(token), record.access_version, scope, expiresAt, new Date().toISOString()).run();
  return token;
}

async function content(
  env: AppApiEnv,
  record: RoutingRecord,
  scope: AccessSession["scope"],
): Promise<LoadedContent | null> {
  try {
    const row = await env.APP_DB.prepare(
      "SELECT tag_numeric_id, tag_base36_id, content_revision, content_file, content_sha256, content_bytes, content_type FROM tag_content WHERE tag_base36_id = ?1 LIMIT 1",
    ).bind(record.tag_id).first<ContentRow>();
    if (!row
      || row.tag_base36_id !== record.tag_id
      || row.content_revision !== record.content_revision
      || row.content_type !== "application/json"
      || !Number.isSafeInteger(row.tag_numeric_id)
      || row.tag_numeric_id < 1) return null;

    const tagObject = await env.PRIVATE_CONTENT.get(
      tagContentFileKey(row.tag_numeric_id, row.content_file),
    );
    if (!tagObject) return null;
    if (typeof tagObject.size === "number" && tagObject.size !== row.content_bytes) return null;
    const tagValue = await tagObject.json<unknown>();
    if (!isContentDocument(tagValue, row) || containsStorageKey(tagValue)) return null;
    const document = tagValue;

    const inlineElements = new Map<string, { elementType: string; payload: Record<string, unknown> }>();
    if (!Array.isArray(document.elements)) return null;
    for (const entry of document.elements) {
      if (!entry || typeof entry !== "object") continue;
      const candidate = entry as { elementId?: unknown; elementType?: unknown; payload?: unknown };
      if (typeof candidate.elementId !== "string"
        || typeof candidate.elementType !== "string"
        || !candidate.payload
        || typeof candidate.payload !== "object"
        || Array.isArray(candidate.payload)) continue;
      inlineElements.set(candidate.elementId, {
        elementType: candidate.elementType,
        payload: candidate.payload as Record<string, unknown>,
      });
    }

    const elementRows = await env.APP_DB.prepare(
      "SELECT content_element_id, content_element_type, display_order, visibility FROM tag_content_elements WHERE tag_numeric_id = ?1 ORDER BY display_order, content_element_id",
    ).bind(row.tag_numeric_id).all<ContentElementRow>();

    const itemRows = await env.APP_DB.prepare(
      "SELECT assignment.content_element_id, item.content_id, item.content_item_type, item.title, item.alt_text, item.original_filename, assignment.display_order, assignment.visibility, item.scope FROM tag_content_element_items AS assignment JOIN tag_content_items AS item ON item.content_id = assignment.content_id WHERE assignment.tag_numeric_id = ?1 AND item.status = 'ready' AND item.revoked_at IS NULL ORDER BY assignment.content_element_id, assignment.display_order, assignment.content_id",
    ).bind(row.tag_numeric_id).all<ContentItemRow>();

    const itemsByElement = new Map<string, LoadedItem[]>();
    for (const item of itemRows.results ?? []) {
      if (!Number.isSafeInteger(item.content_id) || !isVisibleToScope(item.visibility, scope)) continue;
      const items = itemsByElement.get(item.content_element_id) ?? [];
      items.push({
        contentId: String(item.content_id),
        type: item.content_item_type,
        title: item.title,
        altText: item.alt_text,
        filename: item.original_filename,
        displayOrder: item.display_order,
        visibility: item.visibility,
        scope: item.scope,
      });
      itemsByElement.set(item.content_element_id, items);
    }

    const elements: LoadedElement[] = [];
    for (const element of elementRows.results ?? []) {
      if (!isVisibleToScope(element.visibility, scope)) continue;
      const inline = inlineElements.get(element.content_element_id);
      if (!inline || inline.elementType !== element.content_element_type) return null;
      elements.push({
        id: element.content_element_id,
        type: element.content_element_type,
        displayOrder: element.display_order,
        visibility: element.visibility,
        payload: inline.payload,
        items: itemsByElement.get(element.content_element_id) ?? [],
      });
    }

    return { document, elements };
  } catch {
    return null;
  }
}

function clientKey(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function isLocked(env: AppApiEnv, tagId: string, client: string): Promise<boolean> {
  const row = await env.APP_DB.prepare("SELECT locked_until FROM tag_pin_throttles WHERE tag_id = ?1 AND client_key = ?2 LIMIT 1").bind(tagId, client).first<{ locked_until: string | null }>();
  return row !== null && row.locked_until !== null && Date.parse(row.locked_until) > Date.now();
}

async function failedPin(env: AppApiEnv, tagId: string, client: string): Promise<void> {
  const current = await env.APP_DB.prepare("SELECT failed_attempts FROM tag_pin_throttles WHERE tag_id = ?1 AND client_key = ?2 LIMIT 1").bind(tagId, client).first<{ failed_attempts: number }>();
  const attempts = (current?.failed_attempts ?? 0) + 1;
  const lockedUntil = attempts >= MAX_FAILED_PIN_ATTEMPTS ? new Date(Date.now() + PIN_LOCK_SECONDS * 1000).toISOString() : null;
  await env.APP_DB.prepare("INSERT INTO tag_pin_throttles (tag_id, client_key, failed_attempts, locked_until, updated_at) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(tag_id, client_key) DO UPDATE SET failed_attempts = excluded.failed_attempts, locked_until = excluded.locked_until, updated_at = excluded.updated_at")
    .bind(tagId, client, attempts, lockedUntil, new Date().toISOString()).run();
}

async function clearPinFailures(env: AppApiEnv, tagId: string, client: string): Promise<void> {
  await env.APP_DB.prepare("DELETE FROM tag_pin_throttles WHERE tag_id = ?1 AND client_key = ?2").bind(tagId, client).run();
}

async function requestBody(request: Request): Promise<Record<string, unknown> | null> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return null;
  try {
    const value = await request.json<unknown>();
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch { return null; }
}

app.post("/api/v1/tags/:tagId/access/public", async (c) => {
  const tagId = c.req.param("tagId");
  if (!TAG_ID.test(tagId)) return neutral();

  const body = await requestBody(c.req.raw);
  if (!body || typeof body.mode !== "string" || typeof body.nonce !== "string" || typeof body.exp !== "number" || typeof body.sig !== "string" || typeof body.accessVersion !== "number" || typeof body.revision !== "number") return neutral(400);
  const record = await routing(c.env, tagId);
  if (!record || record.status !== "active" || record.protection_mode !== "public" || record.access_version !== body.accessVersion || record.content_revision !== body.revision || !await verifyBootstrap(c.env, record.tag_id, "public", record.access_version, record.content_revision, body.nonce, body.exp, body.sig)) return neutral();
  const token = await issueSession(c.env, record, "public");
  return json({ status: "authorized", mode: "public" }, 200, { "set-cookie": `myqr24_tag_access=${token}; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=${SESSION_TTL_SECONDS}` });
});

app.post("/api/verify-pin", async (c) => {
  const body = await requestBody(c.req.raw);
  if (!body || typeof body.tagId !== "string" || !TAG_ID.test(body.tagId) || typeof body.pin !== "string" || body.pin.length < 1 || body.pin.length > 20 || typeof body.nonce !== "string" || typeof body.exp !== "number" || typeof body.sig !== "string" || typeof body.accessVersion !== "number" || typeof body.revision !== "number") return neutral(400);
  const record = await routing(c.env, body.tagId);
  const client = clientKey(c.req.raw);
  if (!record || record.status !== "active" || record.protection_mode !== "pin_required" || record.access_version !== body.accessVersion || record.content_revision !== body.revision || !await verifyBootstrap(c.env, record.tag_id, "pin_required", record.access_version, record.content_revision, body.nonce, body.exp, body.sig) || await isLocked(c.env, record.tag_id, client)) return neutral();
  const pinRecord = await c.env.APP_DB.prepare("SELECT pin_hash FROM tag_pin_credentials WHERE tag_id = ?1 LIMIT 1").bind(record.tag_id).first<{ pin_hash: string }>();
  if (!pinRecord || !await argon2Verify({ password: body.pin, secret: c.env.APP_PIN_PEPPER_S01, hash: pinRecord.pin_hash })) {
    await failedPin(c.env, record.tag_id, client);
    return neutral();
  }
  await clearPinFailures(c.env, record.tag_id, client);
  const token = await issueSession(c.env, record, "pin");
  return json({ status: "authorized", mode: "pin" }, 200, { "set-cookie": `myqr24_tag_access=${token}; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=${SESSION_TTL_SECONDS}` });
});

app.put("/api/v1/tags/:tagId/content", async (c) => {
  return publishTagContent(c.req.raw, c.env, c.req.param("tagId"));
});

app.all("/api/test-admin/tags/:tagId", async (c) => {
  if (c.env.TAG_TEST_ADMIN_ENVIRONMENT !== "staging") return neutral();
  return handleTagTestAdminRequest(c.req.raw, c.env, "staging");
});

app.get("/api/test-admin/status", async (c) => {
  if (c.env.TAG_TEST_ADMIN_ENVIRONMENT !== "staging") return neutral();
  return handleTagTestAdminRequest(c.req.raw, c.env, "staging");
});

app.get("/api/v1/tags/:tagId/content/document", async (c) => {
  return getTagContentDocument(c.req.raw, c.env, c.req.param("tagId"));
});

app.post("/api/v1/tags/:tagId/elements/:elementId/items", async (c) => {
  return uploadContentItem(c.req.raw, c.env, c.req.param("tagId"), c.req.param("elementId"));
});

app.delete("/api/v1/tags/:tagId/items/:contentId", async (c) => {
  return deleteContentItem(c.req.raw, c.env, c.req.param("tagId"), c.req.param("contentId"));
});

app.get("/api/v1/tags/:tagId/content", async (c) => {
  const tagId = c.req.param("tagId");
  if (!TAG_ID.test(tagId)) return neutral();

  const session = await sessionFromRequest(c.req.raw, c.env, tagId);
  if (!session) return neutral();
  const record = await routing(c.env, tagId);
  if (!record) return neutral();
  const loaded = await content(c.env, record, session.scope);
  if (!loaded) return neutral();
  return json({
    schema: loaded.document.schema,
    tagId: loaded.document.tagId,
    revision: loaded.document.revision,
    view: loaded.document.view,
    elements: loaded.elements,
  });
});

app.get("/api/v1/tags/:tagId/items/:contentId/media", async (c) => {
  const tagId = c.req.param("tagId");
  if (!TAG_ID.test(tagId)) return neutral();
  const session = await sessionFromRequest(c.req.raw, c.env, tagId);
  if (!session) return neutral();
  return readContentItem(c.req.raw, c.env, tagId, c.req.param("contentId"), session.scope);
});

app.post("/api/get-image-url", async (c) => {
  const body = await requestBody(c.req.raw);
  if (!body || typeof body.tagId !== "string" || !TAG_ID.test(body.tagId) || typeof body.contentId !== "string" || typeof body.variant !== "string" || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(body.variant)) return neutral(400);
  const contentId = parseContentId(body.contentId);
  if (contentId === null) return neutral(400);
  const session = await sessionFromRequest(c.req.raw, c.env, body.tagId);
  if (!session) return neutral();
  const record = await routing(c.env, body.tagId);
  if (!record) return neutral();
  const media = await c.env.APP_DB.prepare(
    "SELECT item.content_id, item.scope, item.owner_tag_numeric_id, variant.content_type, element.visibility AS element_visibility, assignment.visibility AS assignment_visibility FROM tag_content AS tc JOIN tag_content_element_items AS assignment ON assignment.tag_numeric_id = tc.tag_numeric_id JOIN tag_content_elements AS element ON element.tag_numeric_id = assignment.tag_numeric_id AND element.content_element_id = assignment.content_element_id JOIN tag_content_items AS item ON item.content_id = assignment.content_id JOIN tag_content_media_variants AS variant ON variant.content_id = item.content_id WHERE tc.tag_base36_id = ?1 AND tc.content_revision = ?2 AND variant.variant = ?3 AND assignment.content_id = ?4 AND item.status = 'ready' AND item.revoked_at IS NULL LIMIT 1",
  ).bind(body.tagId, record.content_revision, body.variant, contentId).first<MediaVisibilityRow>();
  if (!media || !isVisibleToScope(media.element_visibility, session.scope) || !isVisibleToScope(media.assignment_visibility, session.scope)) return neutral();
  let objectKey: string;
  try {
    objectKey = media.scope === "global"
      ? globalItemVariantKey(media.content_id, body.variant)
      : Number.isSafeInteger(media.owner_tag_numeric_id)
        ? tagItemVariantKey(media.owner_tag_numeric_id as number, media.content_id, body.variant)
        : "";
  } catch {
    return neutral();
  }
  if (!objectKey) return neutral();
  const signedResponse = await c.env.MEDIA_SIGNER.fetch("https://media-signer.internal/sign", {
    method: "POST",
    headers: { "content-type": "application/json", "x-myqr24-service-key": c.env.APP_MEDIA_SIGNER_KEY_S01 },
    body: JSON.stringify({ objectKey, contentType: media.content_type, expiresIn: 60 }),
  });
  if (!signedResponse.ok) return neutral();
  const signed = await signedResponse.json<unknown>();
  return signed && typeof signed === "object" ? json(signed as Record<string, unknown>) : neutral();
});

export async function handleAppApiRequest(request: Request, env: AppApiEnv): Promise<Response> {
  return app.fetch(request, env);
}

export default { fetch: handleAppApiRequest } satisfies ExportedHandler<AppApiEnv>;