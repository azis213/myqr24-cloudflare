import { argon2Verify } from "hash-wasm";

const TAG_ID = /^(?:[0-9a-z]{6}|[0-9a-z]{8}|[0-9a-z]{10})$/;
const CONTENT_ID = /^cnt_[A-Za-z0-9_-]{1,120}$/;
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

interface ContentDocument {
  schema: "myqr24-tag-content-v1";
  tagId: string;
  revision: number;
  blocks: unknown[];
  assets: Record<string, { variants: Record<string, { contentType: string }> }>;
  view: unknown;
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

function contentKey(tagId: string, revision: number): string {
  return `content/v1/tags/${tagId}/${revision}.json`;
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

async function content(env: AppApiEnv, record: RoutingRecord): Promise<ContentDocument | null> {
  const object = await env.PRIVATE_CONTENT.get(contentKey(record.tag_id, record.content_revision));
  if (!object) return null;
  const value = await object.json<unknown>();
  if (!value || typeof value !== "object") return null;
  const document = value as Partial<ContentDocument>;
  if (document.schema !== "myqr24-tag-content-v1" || document.tagId !== record.tag_id || document.revision !== record.content_revision || !Array.isArray(document.blocks) || !document.assets || typeof document.assets !== "object" || !document.view || typeof document.view !== "object") return null;
  return document as ContentDocument;
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

export async function handleAppApiRequest(request: Request, env: AppApiEnv): Promise<Response> {
  const url = new URL(request.url);
  const publicMatch = url.pathname.match(/^\/api\/v1\/tags\/([0-9a-z]+)\/access\/public$/);
  const pinMatch = url.pathname.match(/^\/api\/verify-pin$/);
  const contentMatch = url.pathname.match(/^\/api\/v1\/tags\/([0-9a-z]+)\/content$/);
  const mediaMatch = url.pathname.match(/^\/api\/get-image-url$/);

  if (request.method === "POST" && publicMatch && TAG_ID.test(publicMatch[1])) {
    const body = await requestBody(request);
    if (!body || typeof body.mode !== "string" || typeof body.nonce !== "string" || typeof body.exp !== "number" || typeof body.sig !== "string" || typeof body.accessVersion !== "number" || typeof body.revision !== "number") return neutral(400);
    const record = await routing(env, publicMatch[1]);
    if (!record || record.status !== "active" || record.protection_mode !== "public" || record.access_version !== body.accessVersion || record.content_revision !== body.revision || !await verifyBootstrap(env, record.tag_id, "public", record.access_version, record.content_revision, body.nonce, body.exp, body.sig)) return neutral();
    const token = await issueSession(env, record, "public");
    return json({ status: "authorized", mode: "public" }, 200, { "set-cookie": `myqr24_tag_access=${token}; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=${SESSION_TTL_SECONDS}` });
  }

  if (request.method === "POST" && pinMatch) {
    const body = await requestBody(request);
    if (!body || typeof body.tagId !== "string" || !TAG_ID.test(body.tagId) || typeof body.pin !== "string" || body.pin.length < 1 || body.pin.length > 20 || typeof body.nonce !== "string" || typeof body.exp !== "number" || typeof body.sig !== "string" || typeof body.accessVersion !== "number" || typeof body.revision !== "number") return neutral(400);
    const record = await routing(env, body.tagId);
    const client = clientKey(request);
    if (!record || record.status !== "active" || record.protection_mode !== "pin_required" || record.access_version !== body.accessVersion || record.content_revision !== body.revision || !await verifyBootstrap(env, record.tag_id, "pin_required", record.access_version, record.content_revision, body.nonce, body.exp, body.sig) || await isLocked(env, record.tag_id, client)) return neutral();
    const pinRecord = await env.APP_DB.prepare("SELECT pin_hash FROM tag_pin_credentials WHERE tag_id = ?1 LIMIT 1").bind(record.tag_id).first<{ pin_hash: string }>();
    if (!pinRecord || !await argon2Verify({ password: body.pin, secret: env.APP_PIN_PEPPER_S01, hash: pinRecord.pin_hash })) {
      await failedPin(env, record.tag_id, client);
      return neutral();
    }
    await clearPinFailures(env, record.tag_id, client);
    const token = await issueSession(env, record, "pin");
    return json({ status: "authorized", mode: "pin" }, 200, { "set-cookie": `myqr24_tag_access=${token}; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=${SESSION_TTL_SECONDS}` });
  }

  if (request.method === "GET" && contentMatch && TAG_ID.test(contentMatch[1])) {
    const session = await sessionFromRequest(request, env, contentMatch[1]);
    if (!session) return neutral();
    const record = await routing(env, contentMatch[1]);
    if (!record) return neutral();
    const document = await content(env, record);
    if (!document) return neutral();
    return json({ schema: document.schema, tagId: document.tagId, revision: document.revision, view: document.view });
  }

  if (request.method === "POST" && mediaMatch) {
    const body = await requestBody(request);
    if (!body || typeof body.tagId !== "string" || !TAG_ID.test(body.tagId) || typeof body.contentId !== "string" || !CONTENT_ID.test(body.contentId) || typeof body.variant !== "string" || !VARIANT.test(body.variant)) return neutral(400);
    const session = await sessionFromRequest(request, env, body.tagId);
    const record = await routing(env, body.tagId);
    if (!session || !record) return neutral();
    const document = await content(env, record);
    const asset = document?.assets[body.contentId]?.variants[body.variant];
    if (!asset) return neutral();
    const response = await env.MEDIA_SIGNER.fetch("https://media-signer.internal/sign", { method: "POST", headers: { "content-type": "application/json", "x-myqr24-service-key": env.APP_MEDIA_SIGNER_KEY_S01 }, body: JSON.stringify({ tagId: record.tag_id, contentId: body.contentId, variant: body.variant, revision: record.content_revision, contentType: asset.contentType }) });
    if (!response.ok) return neutral();
    const signed = await response.json<unknown>();
    return signed && typeof signed === "object" ? json(signed as Record<string, unknown>) : neutral();
  }

  return neutral();
}

export default { fetch: handleAppApiRequest } satisfies ExportedHandler<AppApiEnv>;