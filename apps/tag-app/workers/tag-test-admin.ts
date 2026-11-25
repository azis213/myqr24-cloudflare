import type { AppApiEnv } from "./app-api";

export type TestTagStatus = "active" | "suspended" | "deactivated" | "expired";
export type TestTagTargetType = "internal" | "external";
export type TestTagProtectionMode = "public" | "pin_required" | "login_required" | "closed";

export interface TestTagRoutingInput {
  tagNumericId: string;
  status: TestTagStatus;
  targetType: TestTagTargetType;
  protectionMode: TestTagProtectionMode;
  externalUrl: string | null;
  accessVersion: number;
  contentRevision: number;
  schemaVersion: number;
}

interface TestTagAdminEnv extends AppApiEnv {
  TAG_TEST_ADMIN_ENVIRONMENT?: string;
  TAG_TEST_ADMIN_KEY_S01?: string;
}

interface RoutingRow {
  tag_id: string;
  status: TestTagStatus;
  target_type: TestTagTargetType;
  external_url: string | null;
  protection_mode: TestTagProtectionMode;
  access_version: number;
  content_revision: number;
  schema_version: number;
  updated_at: string;
}

const TAG_ID = /^(?:[0-9a-z]{6}|[0-9a-z]{8}|[0-9a-z]{10})$/u;
const NUMERIC_ID = /^[1-9][0-9]{0,15}$/u;
const STATUSES = new Set<TestTagStatus>(["active", "suspended", "deactivated", "expired"]);
const TARGET_TYPES = new Set<TestTagTargetType>(["internal", "external"]);
const PROTECTION_MODES = new Set<TestTagProtectionMode>(["public", "pin_required", "login_required", "closed"]);
const MAX_R2_DELETE_BATCH = 100;

function json(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

function authorized(request: Request, env: TestTagAdminEnv, expectedEnvironment: "local" | "staging"): boolean {
  if (env.TAG_TEST_ADMIN_ENVIRONMENT !== expectedEnvironment || !env.TAG_TEST_ADMIN_KEY_S01) return false;
  const match = /^Bearer\s+(.+)$/iu.exec(request.headers.get("authorization") ?? "");
  return !!match && safeEqual(match[1].trim(), env.TAG_TEST_ADMIN_KEY_S01);
}

function parsePositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= 2_147_483_647;
}

function parseInput(value: unknown, tagNumericId: string): TestTagRoutingInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const externalUrl = body.externalUrl;
  if (body.tagNumericId !== tagNumericId
    || !STATUSES.has(body.status as TestTagStatus)
    || !TARGET_TYPES.has(body.targetType as TestTagTargetType)
    || !PROTECTION_MODES.has(body.protectionMode as TestTagProtectionMode)
    || !parsePositiveInteger(body.accessVersion)
    || !parsePositiveInteger(body.contentRevision)
    || !parsePositiveInteger(body.schemaVersion)) return null;

  if (body.targetType === "external") {
    if (typeof externalUrl !== "string" || externalUrl.length > 2048) return null;
    try {
      const parsed = new URL(externalUrl);
      if (parsed.protocol !== "https:" || parsed.username || parsed.password) return null;
    } catch {
      return null;
    }
  } else if (externalUrl !== null && externalUrl !== "") {
    return null;
  }

  return {
    tagNumericId,
    status: body.status as TestTagStatus,
    targetType: body.targetType as TestTagTargetType,
    protectionMode: body.protectionMode as TestTagProtectionMode,
    externalUrl: body.targetType === "external" ? externalUrl as string : null,
    accessVersion: body.accessVersion,
    contentRevision: body.contentRevision,
    schemaVersion: body.schemaVersion,
  };
}

async function readJson(request: Request): Promise<unknown | null> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return null;
  const declaredSize = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredSize) && declaredSize > 16 * 1024) return null;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > 16 * 1024) return null;
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function loadRouting(env: TestTagAdminEnv, tagId: string): Promise<RoutingRow | null> {
  return env.APP_DB.prepare(
    "SELECT tag_id, status, target_type, external_url, protection_mode, access_version, content_revision, schema_version, updated_at FROM tag_routing WHERE tag_id = ?1 LIMIT 1",
  ).bind(tagId).first<RoutingRow>();
}

async function saveRouting(request: Request, env: TestTagAdminEnv, tagId: string): Promise<Response> {
  const body = await readJson(request);
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "JSON-Objekt fehlt oder ist ungültig." }, 400);
  const numericId = (body as Record<string, unknown>).tagNumericId;
  if (typeof numericId !== "string" || !NUMERIC_ID.test(numericId)) return json({ error: "Numeric-ID ist ungültig." }, 400);
  const input = parseInput(body, numericId);
  if (!input) return json({ error: "Routing-Felder sind ungültig; externe Ziele benötigen eine HTTPS-URL." }, 400);

  const existingByNumeric = await env.APP_DB.prepare(
    "SELECT tag_numeric_id, tag_base36_id FROM tag_content WHERE tag_numeric_id = ?1 LIMIT 1",
  ).bind(Number(numericId)).first<{ tag_numeric_id: number; tag_base36_id: string }>();
  const existingByBase36 = await env.APP_DB.prepare(
    "SELECT tag_numeric_id, tag_base36_id FROM tag_content WHERE tag_base36_id = ?1 LIMIT 1",
  ).bind(tagId).first<{ tag_numeric_id: number; tag_base36_id: string }>();
  if (existingByNumeric && (existingByNumeric.tag_numeric_id !== Number(numericId) || existingByNumeric.tag_base36_id !== tagId)
    || existingByBase36 && (existingByBase36.tag_numeric_id !== Number(numericId) || existingByBase36.tag_base36_id !== tagId)) {
    return json({ error: "Base36-ID und Numeric-ID stimmen nicht mit dem vorhandenen TAG-Content überein." }, 409);
  }

  const updatedAt = new Date().toISOString();
  await env.APP_DB.prepare(
    "INSERT INTO tag_routing (tag_id, status, target_type, external_url, protection_mode, access_version, content_revision, schema_version, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9) ON CONFLICT(tag_id) DO UPDATE SET status = excluded.status, target_type = excluded.target_type, external_url = excluded.external_url, protection_mode = excluded.protection_mode, access_version = excluded.access_version, content_revision = excluded.content_revision, schema_version = excluded.schema_version, updated_at = excluded.updated_at",
  ).bind(tagId, input.status, input.targetType, input.externalUrl, input.protectionMode, input.accessVersion, input.contentRevision, input.schemaVersion, updatedAt).run();

  return json({ environment: env.TAG_TEST_ADMIN_ENVIRONMENT, tagId, ...input, status: "saved", routingStatus: input.status, updatedAt });
}

async function deleteTagData(env: TestTagAdminEnv, tagId: string, numericId: string): Promise<Response> {
  const content = await env.APP_DB.prepare(
    "SELECT tag_numeric_id, tag_base36_id FROM tag_content WHERE tag_numeric_id = ?1 OR tag_base36_id = ?2 LIMIT 1",
  ).bind(Number(numericId), tagId).first<{ tag_numeric_id: number; tag_base36_id: string }>();
  if (content && (content.tag_numeric_id !== Number(numericId) || content.tag_base36_id !== tagId)) {
    return json({ error: "Base36-ID und Numeric-ID stimmen nicht mit dem vorhandenen TAG-Content überein." }, 409);
  }

  const now = new Date().toISOString();
  await env.APP_DB.prepare("UPDATE tag_routing SET status = 'deactivated', updated_at = ?1 WHERE tag_id = ?2")
    .bind(now, tagId).run();

  const prefix = `content/v1/tags/${numericId}/`;
  let cursor: string | undefined;
  let deletedObjects = 0;
  try {
    do {
      const page = await env.PRIVATE_CONTENT.list({ prefix, ...(cursor ? { cursor } : {}), limit: 1000 });
      for (let offset = 0; offset < page.objects.length; offset += MAX_R2_DELETE_BATCH) {
        const keys = page.objects.slice(offset, offset + MAX_R2_DELETE_BATCH).map((object) => object.key);
        if (keys.length > 0) {
          await env.PRIVATE_CONTENT.delete(keys);
          deletedObjects += keys.length;
        }
      }
      cursor = page.truncated ? page.cursor : undefined;
      if (page.truncated && !cursor) return json({ error: "R2-Löschung ist unvollständig; den Löschvorgang erneut starten.", deletedObjects }, 503);
    } while (cursor);
  } catch {
    return json({ error: "R2-Löschung ist fehlgeschlagen; der TAG bleibt deaktiviert. Löschvorgang erneut starten.", deletedObjects }, 503);
  }

  try {
    await env.APP_DB.batch([
      env.APP_DB.prepare("DELETE FROM tag_content_element_items WHERE tag_numeric_id = ?1 OR content_id IN (SELECT content_id FROM tag_content_items WHERE owner_tag_numeric_id = ?1 AND owner_tag_base36_id = ?2 AND scope = 'tag')").bind(Number(numericId), tagId),
      env.APP_DB.prepare("DELETE FROM tag_content_items WHERE owner_tag_numeric_id = ?1 AND owner_tag_base36_id = ?2 AND scope = 'tag'").bind(Number(numericId), tagId),
      env.APP_DB.prepare("DELETE FROM tag_content WHERE tag_numeric_id = ?1 AND tag_base36_id = ?2").bind(Number(numericId), tagId),
      env.APP_DB.prepare("DELETE FROM tag_pin_throttles WHERE tag_id = ?1").bind(tagId),
      env.APP_DB.prepare("DELETE FROM tag_routing WHERE tag_id = ?1").bind(tagId),
    ]);
  } catch {
    return json({ error: "R2-Dateien wurden entfernt; D1-Bereinigung kann sicher erneut gestartet werden.", deletedObjects }, 503);
  }

  return json({ status: "deleted", environment: env.TAG_TEST_ADMIN_ENVIRONMENT, tagId, tagNumericId: numericId, deletedObjects });
}

/** Local/staging-only test routing administration. Production remains disabled by its environment gate. */
export async function handleTagTestAdminRequest(
  request: Request,
  env: TestTagAdminEnv,
  expectedEnvironment: "local" | "staging",
): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/api/test-admin/status" && request.method === "GET") {
    return authorized(request, env, expectedEnvironment)
      ? json({ enabled: true, environment: expectedEnvironment })
      : json({ enabled: false, environment: expectedEnvironment }, 404);
  }
  const match = /^\/api\/test-admin\/tags\/([0-9a-z]{6}|[0-9a-z]{8}|[0-9a-z]{10})$/u.exec(url.pathname);
  if (!match) return json({ error: "Not Found" }, 404);
  if (!authorized(request, env, expectedEnvironment)) return json({ error: "Not Found" }, 404);
  const tagId = match[1];
  if (request.method === "GET") {
    const routing = await loadRouting(env, tagId);
    const numericText = url.searchParams.get("numericId");
    let hasData = false;
    if (numericText && NUMERIC_ID.test(numericText)) {
      const content = await env.APP_DB.prepare(
        "SELECT tag_numeric_id, tag_base36_id FROM tag_content WHERE tag_numeric_id = ?1 OR tag_base36_id = ?2 LIMIT 1",
      ).bind(Number(numericText), tagId).first<{ tag_numeric_id: number; tag_base36_id: string }>();
      if (content && (content.tag_numeric_id !== Number(numericText) || content.tag_base36_id !== tagId)) {
        return json({ error: "Base36-ID und Numeric-ID stimmen nicht mit dem vorhandenen TAG-Content überein." }, 409);
      }
      hasData = content !== null;
      if (!hasData) {
        const item = await env.APP_DB.prepare(
          "SELECT content_id FROM tag_content_items WHERE owner_tag_numeric_id = ?1 AND owner_tag_base36_id = ?2 AND scope = 'tag' LIMIT 1",
        ).bind(Number(numericText), tagId).first<{ content_id: number }>();
        hasData = item !== null;
      }
      if (!hasData) {
        try {
          const objects = await env.PRIVATE_CONTENT.list({ prefix: `content/v1/tags/${numericText}/`, limit: 1 });
          hasData = objects.objects.length > 0;
        } catch {
          // API status remains usable; delete will report the underlying R2 failure explicitly.
        }
      }
    }
    return routing
      ? json({ environment: expectedEnvironment, exists: true, hasData: true, ...routing })
      : json({ environment: expectedEnvironment, exists: false, hasData, tagId }, 404);
  }
  if (request.method === "PUT") return saveRouting(request, env, tagId);
  if (request.method === "DELETE") {
    const body = await readJson(request) as Record<string, unknown> | null;
    if (!body || typeof body.tagNumericId !== "string" || !NUMERIC_ID.test(body.tagNumericId)) return json({ error: "Numeric-ID ist ungültig." }, 400);
    const requiredConfirmation = `DELETE ${expectedEnvironment.toUpperCase()} ${tagId}`;
    if (body.confirm !== requiredConfirmation) return json({ error: "Löschbestätigung stimmt nicht mit Umgebung und TAG-ID überein." }, 400);
    return deleteTagData(env, tagId, body.tagNumericId);
  }
  return json({ error: "Method Not Allowed" }, 405);
}