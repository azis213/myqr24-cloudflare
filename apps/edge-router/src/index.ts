/**
 * myQR24 Edge Tag Router
 *
 * Runtime secrets:
 * - FEISTEL_SECRET: key material for the fixed 10-round Feistel permutation
 * - TAG_HMAC_SECRET: key material for the 4-bit integrity check of 8-character tags
 * - REDIRECT_SIGNING_SECRET: key material for short-lived signed redirect URLs
 *
 * Runtime bindings:
 * - TAG_CONFIG: Cloudflare KV namespace containing ranges, assignments and features
 * - SCAN_ENVIRONMENT: deployment-specific host allowlist selector
 */
export type ScanEnvironment = "staging" | "production";

export interface Env {
  TAG_CONFIG: KVNamespace;
  SCAN_ENVIRONMENT: ScanEnvironment;
  FEISTEL_SECRET: string;
  TAG_HMAC_SECRET: string;
  REDIRECT_SIGNING_SECRET: string;
}

export type TagLength = 6 | 8;
export type RedirectStatus = 301 | 302 | 303 | 307 | 308;

export interface TagRange {
  id: string;
  start: string;
  end: string;
  groupId: string;
  length: TagLength;
  active: boolean;
}

export interface TagRangeIndex {
  version: number;
  ranges: TagRange[];
}

export interface FeatureAssignment {
  featureIds: string[];
}

export interface TagGroup extends FeatureAssignment {
  id: string;
}

export interface RedirectSigning {
  ttlSeconds: number;
}

export interface RedirectFeature {
  id: string;
  type: "redirect";
  enabled: true;
  url?: string;
  urlTemplate?: string;
  signing?: RedirectSigning;
  status?: RedirectStatus;
}

export interface ImageFeature {
  id: string;
  type: "image";
  enabled: true;
  key?: string;
  url?: string;
  [key: string]: unknown;
}

export interface JsonFeature {
  id: string;
  type: "json";
  enabled: true;
  payload?: unknown;
  [key: string]: unknown;
}

export type TagFeature = RedirectFeature | ImageFeature | JsonFeature;

export interface ResolvedTag {
  id: string;
  length: TagLength;
  value: bigint;
  range: TagRange;
  group: TagGroup;
  features: TagFeature[];
}

const RANGE_INDEX_KEY = "tag-range-index";
const PLATFORM_HOME_URL = "https://www.myqr24.com/";
const PLATFORM_HOME_HOST = "www.myqr24.com";
const PLATFORM_HOME_HTML = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="myQR24 verbindet physische QR- und NFC-TAGs mit sicheren digitalen Informationen.">
    <title>myQR24 – intelligente TAGs</title>
    <style>
      :root { color-scheme: light; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #17212b; background: #f5f7fa; }
      * { box-sizing: border-box; }
      body { margin: 0; line-height: 1.6; }
      main { width: min(100% - 2rem, 52rem); margin: 0 auto; padding: 5rem 0 4rem; }
      .brand { color: #087a69; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
      h1 { max-width: 14ch; margin: .4rem 0 1rem; font-size: clamp(2.25rem, 7vw, 4.5rem); line-height: 1.05; }
      .lead { max-width: 43rem; color: #435160; font-size: clamp(1.1rem, 2vw, 1.3rem); }
      .cards { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); margin: 2.5rem 0; }
      article { padding: 1.35rem; border: 1px solid #dce3ea; border-radius: 1rem; background: #fff; box-shadow: 0 4px 18px rgb(23 33 43 / 6%); }
      h2 { margin-top: 0; font-size: 1.1rem; }
      footer { color: #617080; font-size: .9rem; }
      a { color: #087a69; }
    </style>
  </head>
  <body>
    <main>
      <div class="brand">myQR24</div>
      <h1>Physische TAGs. Digitale Möglichkeiten.</h1>
      <p class="lead">myQR24 verbindet QR- und NFC-TAGs mit aktuellen, sicher verwalteten digitalen Informationen – für Menschen, Gegenstände, Orte und Erlebnisse.</p>
      <section class="cards" aria-label="Basisinformationen">
        <article><h2>Einfach scannen</h2><p>Ein Scan führt zuverlässig zur aktuellen, für den jeweiligen TAG freigegebenen Information.</p></article>
        <article><h2>Sicher verwaltet</h2><p>Persönliche Inhalte und Verwaltungsdaten bleiben in der fachlich autoritativen Control Plane; am Edge werden nur minimale Routingdaten verarbeitet.</p></article>
        <article><h2>Vielseitig einsetzbar</h2><p>TAGs unterstützen unter anderem digitale Profile, TAG Vaults, Lost & Found, Check-ins und ortsbezogene Informationen.</p></article>
      </section>
      <footer>Weitere Informationen zu myQR24 folgen in Kürze.</footer>
    </main>
  </body>
</html>`;
const FEISTEL_ROUNDS = 10;
const MAX_CYCLE_WALK_ITERATIONS = 128;
const TAG_ID_PATTERN = /^(?:[0-9a-z]{6}|[0-9a-z]{8})$/i;
const ROUTE_SEGMENTS = new Set(["t", "t1"]);
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const REDIRECT_STATUSES = new Set<RedirectStatus>([301, 302, 303, 307, 308]);
const MIN_REDIRECT_TTL_SECONDS = 10;
const MAX_REDIRECT_TTL_SECONDS = 300;
const TEMPLATE_TOKENS = new Set([
  "tagId",
  "decodedValue",
  "length",
  "groupId",
  "tagSignature",
]);
const encoder = new TextEncoder();

interface TagRequest {
  id: string;
  length: TagLength;
}

const SCAN_HOSTS: Record<
  ScanEnvironment,
  {
    short: string;
    descriptive: string;
  }
> = {
  staging: {
    short: "s.qr4.uk",
    descriptive: "s.myqr24.com",
  },
  production: {
    short: "p.qr4.uk",
    descriptive: "p.myqr24.com",
  },
};

function isScanHost(hostname: string, environment: ScanEnvironment): boolean {
  const hosts = SCAN_HOSTS[environment];

  return hostname === hosts.short || hostname === hosts.descriptive;
}

function isPlatformHomeHost(
  hostname: string,
  environment: ScanEnvironment,
): boolean {
  return environment === "production" && hostname === PLATFORM_HOME_HOST;
}

interface FeistelParameters {
  blockBits: number;
  halfBits: number;
  domain: "myqr24/tag/6" | "myqr24/tag/8";
}

interface TemplateContext {
  tagId: string;
  decodedValue: string;
  length: string;
  groupId: string;
}

const FEISTEL_PARAMETERS: Record<TagLength, FeistelParameters> = {
  6: {
    blockBits: 32,
    halfBits: 16,
    domain: "myqr24/tag/6",
  },
  8: {
    blockBits: 42,
    halfBits: 21,
    domain: "myqr24/tag/8",
  },
};

function base36UpperBound(length: TagLength): bigint {
  return 36n ** BigInt(length);
}

function base36LowerBound(length: TagLength): bigint {
  return 36n ** BigInt(length - 1);
}

function isCanonicalValue(value: bigint, length: TagLength): boolean {
  return value >= base36LowerBound(length) && value < base36UpperBound(length);
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && IDENTIFIER_PATTERN.test(value);
}

function isTagLength(value: unknown): value is TagLength {
  return value === 6 || value === 8;
}

/**
 * Extracts a tag ID only from the case-insensitive, route-based URL shapes
 * permitted for the deployment. Direct tag paths are deliberately rejected.
 * A staging Worker must never resolve production scan hosts and vice versa.
 */
export function extractTagRequest(
  url: URL,
  environment: ScanEnvironment = "production",
): TagRequest | null {
  const hostname = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);

  if (!isScanHost(hostname, environment) || segments.length !== 2) {
    return null;
  }

  const routeSegment = segments[0].toLowerCase();
  const tagId = segments[1];

  if (!ROUTE_SEGMENTS.has(routeSegment) || !TAG_ID_PATTERN.test(tagId)) {
    return null;
  }

  return {
    id: tagId.toLowerCase(),
    length: tagId.length as TagLength,
  };
}

/**
 * Parses a Base36 string without converting through JavaScript number.
 */
export function parseBase36(value: string): bigint | null {
  if (!/^[0-9a-z]+$/i.test(value)) {
    return null;
  }

  let result = 0n;

  for (const character of value.toLowerCase()) {
    const code = character.charCodeAt(0);
    const digit =
      code >= 48 && code <= 57
        ? BigInt(code - 48)
        : code >= 97 && code <= 122
          ? BigInt(code - 87)
          : -1n;

    if (digit < 0n || digit >= 36n) {
      return null;
    }

    result = result * 36n + digit;
  }

  return result;
}

export function formatBase36(value: bigint, length: TagLength): string | null {
  if (!isCanonicalValue(value, length)) {
    return null;
  }

  const encoded = value.toString(36);

  return encoded.length === length ? encoded : null;
}

function toFixedWidthBytes(value: bigint, byteLength: number): Uint8Array {
  const bytes = new Uint8Array(byteLength);
  let remaining = value;

  for (let index = byteLength - 1; index >= 0; index -= 1) {
    bytes[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }

  return bytes;
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return new Uint8Array(data).buffer;
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", toArrayBuffer(data)),
  );
}

async function feistelRound(
  secret: string,
  parameters: FeistelParameters,
  round: number,
  rightHalf: bigint,
): Promise<bigint> {
  const prefix = encoder.encode(`${secret}|${parameters.domain}|${round}|`);
  const material = new Uint8Array(prefix.length + 3);
  material.set(prefix);
  material.set(toFixedWidthBytes(rightHalf, 3), prefix.length);

  const digest = await sha256(material);
  const mask = (1n << BigInt(parameters.halfBits)) - 1n;
  const firstThreeBytes =
    (BigInt(digest[0]) << 16n) |
    (BigInt(digest[1]) << 8n) |
    BigInt(digest[2]);

  return firstThreeBytes & mask;
}

async function decodeFeistelBlock(
  encryptedValue: bigint,
  parameters: FeistelParameters,
  secret: string,
): Promise<bigint> {
  const halfMask = (1n << BigInt(parameters.halfBits)) - 1n;
  let left = encryptedValue >> BigInt(parameters.halfBits);
  let right = encryptedValue & halfMask;

  for (let round = FEISTEL_ROUNDS - 1; round >= 0; round -= 1) {
    const previousRight = left;
    const previousLeft =
      (right ^ (await feistelRound(secret, parameters, round, left))) & halfMask;

    left = previousLeft;
    right = previousRight;
  }

  return (left << BigInt(parameters.halfBits)) | right;
}

async function encodeFeistelBlock(
  decodedValue: bigint,
  parameters: FeistelParameters,
  secret: string,
): Promise<bigint> {
  const halfMask = (1n << BigInt(parameters.halfBits)) - 1n;
  let left = decodedValue >> BigInt(parameters.halfBits);
  let right = decodedValue & halfMask;

  for (let round = 0; round < FEISTEL_ROUNDS; round += 1) {
    const nextLeft = right;
    const nextRight =
      (left ^ (await feistelRound(secret, parameters, round, right))) & halfMask;

    left = nextLeft;
    right = nextRight;
  }

  return (left << BigInt(parameters.halfBits)) | right;
}

/**
 * Reverses the fixed Feistel permutation and cycle-walks it into the exact
 * canonical Base36 domain I(L) = [36^(L-1), 36^L).
 */
export async function decodeFeistel(
  encryptedValue: bigint,
  length: TagLength,
  secret: string,
): Promise<bigint | null> {
  const parameters = FEISTEL_PARAMETERS[length];
  const blockLimit = 1n << BigInt(parameters.blockBits);

  if (
    encryptedValue < 0n ||
    encryptedValue >= base36UpperBound(length) ||
    encryptedValue >= blockLimit ||
    !secret
  ) {
    return null;
  }

  let value = encryptedValue;

  for (let attempt = 0; attempt < MAX_CYCLE_WALK_ITERATIONS; attempt += 1) {
    value = await decodeFeistelBlock(value, parameters, secret);

    if (isCanonicalValue(value, length)) {
      return value;
    }
  }

  return null;
}

/**
 * Test-supporting inverse operation. It is deterministic and uses the same
 * cycle-walk domain as decodeFeistel; production routing never calls it.
 */
export async function encodeFeistel(
  decodedValue: bigint,
  length: TagLength,
  secret: string,
): Promise<bigint | null> {
  const parameters = FEISTEL_PARAMETERS[length];

  if (!isCanonicalValue(decodedValue, length) || !secret) {
    return null;
  }

  let value = decodedValue;

  for (let attempt = 0; attempt < MAX_CYCLE_WALK_ITERATIONS; attempt += 1) {
    value = await encodeFeistelBlock(value, parameters, secret);

    if (isCanonicalValue(value, length)) {
      return value;
    }
  }

  return null;
}

export async function calculateHmacNibble(
  base: bigint,
  secret: string,
): Promise<number | null> {
  if (!secret || base < 0n || base >= 1n << 42n || base % 16n !== 0n) {
    return null;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(encoder.encode(secret)),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const message = encoder.encode(`myqr24/tag/v1/8:${base.toString()}`);
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, toArrayBuffer(message)),
  );

  return signature[0] & 0x0f;
}

/**
 * Decodes a public tag ID to its complete canonical range-lookup number.
 * For eight-character tags this includes the validated HMAC nibble.
 */
export async function decodeTagId(
  tag: TagRequest,
  env: Pick<Env, "FEISTEL_SECRET" | "TAG_HMAC_SECRET">,
): Promise<bigint | null> {
  const encryptedValue = parseBase36(tag.id);

  if (encryptedValue === null) {
    return null;
  }

  const decodedValue = await decodeFeistel(
    encryptedValue,
    tag.length,
    env.FEISTEL_SECRET,
  );

  if (decodedValue === null) {
    return null;
  }

  if (tag.length === 6) {
    return decodedValue;
  }

  const base = decodedValue & ~0x0fn;
  const suppliedNibble = Number(decodedValue & 0x0fn);
  const expectedNibble = await calculateHmacNibble(base, env.TAG_HMAC_SECRET);

  return expectedNibble !== null && suppliedNibble === expectedNibble
    ? decodedValue
    : null;
}

function parseRangeBoundary(value: unknown): bigint | null {
  return typeof value === "string" && /^\d+$/.test(value) ? BigInt(value) : null;
}

function isValidRange(range: unknown, previousEnd: bigint): range is TagRange {
  if (!range || typeof range !== "object") {
    return false;
  }

  const candidate = range as Partial<TagRange>;
  const start = parseRangeBoundary(candidate.start);
  const end = parseRangeBoundary(candidate.end);

  if (
    !isIdentifier(candidate.id) ||
    start === null ||
    end === null ||
    start > end ||
    start <= previousEnd ||
    !isIdentifier(candidate.groupId) ||
    !isTagLength(candidate.length) ||
    typeof candidate.active !== "boolean"
  ) {
    return false;
  }

  if (
    !isCanonicalValue(start, candidate.length) ||
    !isCanonicalValue(end, candidate.length)
  ) {
    return false;
  }

  return candidate.length !== 8 || (start % 16n === 0n && end % 16n === 15n);
}

/**
 * Validates the complete globally sorted index before a binary lookup.
 */
export function isValidRangeIndex(ranges: TagRange[]): boolean {
  let previousEnd = -1n;
  const ids = new Set<string>();

  for (const range of ranges) {
    if (!isValidRange(range, previousEnd) || ids.has(range.id)) {
      return false;
    }

    previousEnd = BigInt(range.end);
    ids.add(range.id);
  }

  return true;
}

/**
 * Finds an active range in a validated index. Length matching is explicit,
 * even though canonical spaces are disjoint, to fail closed on bad data.
 */
export function findRange(
  ranges: TagRange[],
  tagValue: bigint,
  length: TagLength,
): TagRange | null {
  if (!isValidRangeIndex(ranges)) {
    return null;
  }

  let lower = 0;
  let upper = ranges.length - 1;

  while (lower <= upper) {
    const index = lower + Math.floor((upper - lower) / 2);
    const range = ranges[index];
    const start = BigInt(range.start);
    const end = BigInt(range.end);

    if (tagValue < start) {
      upper = index - 1;
    } else if (tagValue > end) {
      lower = index + 1;
    } else {
      return range.length === length && range.active ? range : null;
    }
  }

  return null;
}

function isTagRangeIndex(value: unknown): value is TagRangeIndex {
  if (!value || typeof value !== "object") {
    return false;
  }

  const index = value as Partial<TagRangeIndex>;
  return typeof index.version === "number" && Array.isArray(index.ranges);
}

function isFeatureAssignment(value: unknown): value is FeatureAssignment {
  if (!value || typeof value !== "object") {
    return false;
  }

  const assignment = value as Partial<FeatureAssignment>;

  return (
    Array.isArray(assignment.featureIds) &&
    assignment.featureIds.every((featureId) => isIdentifier(featureId))
  );
}

function isTagGroup(value: unknown): value is TagGroup {
  if (!isFeatureAssignment(value)) {
    return false;
  }

  const group = value as Partial<TagGroup>;
  return isIdentifier(group.id);
}

function isRedirectStatus(value: unknown): value is RedirectStatus {
  return typeof value === "number" && REDIRECT_STATUSES.has(value as RedirectStatus);
}

function isRedirectSigning(value: unknown): value is RedirectSigning {
  if (!value || typeof value !== "object") {
    return false;
  }

  const signing = value as Partial<RedirectSigning>;

  return (
    typeof signing.ttlSeconds === "number" &&
    Number.isInteger(signing.ttlSeconds) &&
    signing.ttlSeconds >= MIN_REDIRECT_TTL_SECONDS &&
    signing.ttlSeconds <= MAX_REDIRECT_TTL_SECONDS
  );
}

function isTagFeature(value: unknown): value is TagFeature {
  if (!value || typeof value !== "object") {
    return false;
  }

  const feature = value as Partial<TagFeature>;

  if (!isIdentifier(feature.id) || feature.enabled !== true) {
    return false;
  }

  if (feature.type === "redirect") {
    const hasUrl = typeof feature.url === "string";
    const hasTemplate = typeof feature.urlTemplate === "string";

    return (
      hasUrl !== hasTemplate &&
      (feature.signing === undefined || isRedirectSigning(feature.signing)) &&
      (feature.status === undefined || isRedirectStatus(feature.status))
    );
  }

  return feature.type === "image" || feature.type === "json";
}

async function getAssignment(
  config: KVNamespace,
  key: string,
): Promise<FeatureAssignment | null | "invalid"> {
  const value = await config.get<unknown>(key, "json");

  if (value === null) {
    return null;
  }

  return isFeatureAssignment(value) ? value : "invalid";
}

async function resolveFeatures(
  featureIds: string[],
  config: KVNamespace,
): Promise<TagFeature[] | null> {
  const features: TagFeature[] = [];

  for (const featureId of featureIds) {
    const feature = await config.get<unknown>(`feature:${featureId}`, "json");

    if (!isTagFeature(feature) || feature.id !== featureId) {
      return null;
    }

    features.push(feature);
  }

  return features;
}

/**
 * Resolves a complete tag only after the caller has completed decoding and
 * HMAC validation. A valid active range is mandatory before reading direct
 * tag assignments or features.
 */
export async function resolveTag(
  tagValue: bigint,
  tagLength: TagLength,
  config: KVNamespace,
): Promise<Omit<ResolvedTag, "id"> | null> {
  const rangeIndex = await config.get<unknown>(RANGE_INDEX_KEY, "json");

  if (!isTagRangeIndex(rangeIndex)) {
    return null;
  }

  const range = findRange(rangeIndex.ranges, tagValue, tagLength);

  if (!range) {
    return null;
  }

  const groupValue = await config.get<unknown>(`group:${range.groupId}`, "json");

  if (!isTagGroup(groupValue) || groupValue.id !== range.groupId) {
    return null;
  }

  const tagAssignment = await getAssignment(config, `tag:${tagValue.toString()}`);

  if (tagAssignment === "invalid") {
    return null;
  }

  const rangeAssignment = await getAssignment(
    config,
    `range-rule:${range.id}`,
  );

  if (rangeAssignment === "invalid") {
    return null;
  }

  const featureIds =
    tagAssignment && tagAssignment.featureIds.length > 0
      ? tagAssignment.featureIds
      : rangeAssignment && rangeAssignment.featureIds.length > 0
        ? rangeAssignment.featureIds
        : groupValue.featureIds;

  if (featureIds.length === 0) {
    return null;
  }

  const features = await resolveFeatures(featureIds, config);

  return features
    ? {
        length: tagLength,
        value: tagValue,
        range,
        group: groupValue,
        features,
      }
    : null;
}

function renderTemplate(
  template: string,
  context: TemplateContext,
): string | null {
  let invalid = false;

  const rendered = template.replace(/\{([^{}]*)\}/g, (whole, token: string) => {
    if (!TEMPLATE_TOKENS.has(token) || token === "tagSignature") {
      invalid = true;
      return whole;
    }

    const value = context[token as keyof TemplateContext];
    return encodeURIComponent(value);
  });

  if (invalid || rendered.includes("{") || rendered.includes("}")) {
    return null;
  }

  return rendered;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export function createRedirectSignaturePayload(
  featureId: string,
  destination: URL,
  context: TemplateContext,
  expiresAt: number,
): string {
  return [
    "myqr24/redirect/v1",
    `feature=${featureId}`,
    `destination=${destination.toString()}`,
    `tag=${context.tagId}`,
    `id=${context.decodedValue}`,
    `length=${context.length}`,
    `group=${context.groupId}`,
    `exp=${expiresAt}`,
  ].join("\n");
}

export async function calculateRedirectSignature(
  featureId: string,
  destination: URL,
  context: TemplateContext,
  expiresAt: number,
  secret: string,
): Promise<string | null> {
  if (!secret || !Number.isSafeInteger(expiresAt) || expiresAt <= 0) {
    return null;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(encoder.encode(secret)),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const payload = createRedirectSignaturePayload(
    featureId,
    destination,
    context,
    expiresAt,
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, toArrayBuffer(encoder.encode(payload))),
  );

  return toBase64Url(signature);
}

export async function toSafeRedirect(
  feature: RedirectFeature,
  context: TemplateContext,
  redirectSigningSecret: string,
  now = Date.now(),
): Promise<Response | null> {
  const hasUrl = typeof feature.url === "string";
  const hasTemplate = typeof feature.urlTemplate === "string";

  if (hasUrl === hasTemplate) {
    return null;
  }

  const destinationValue = hasUrl
    ? feature.url
    : renderTemplate(feature.urlTemplate!, context);

  if (!destinationValue) {
    return null;
  }

  let destination: URL;

  try {
    destination = new URL(destinationValue);
  } catch {
    return null;
  }

  if (destination.protocol !== "https:" && destination.protocol !== "http:") {
    return null;
  }

  if (feature.signing) {
    if (
      destination.searchParams.has("exp") ||
      destination.searchParams.has("sig")
    ) {
      return null;
    }

    const expiresAt = Math.floor(now / 1000) + feature.signing.ttlSeconds;
    const signature = await calculateRedirectSignature(
      feature.id,
      destination,
      context,
      expiresAt,
      redirectSigningSecret,
    );

    if (!signature) {
      return null;
    }

    destination.searchParams.set("exp", expiresAt.toString());
    destination.searchParams.set("sig", signature);
  }

  const status = feature.status ?? 302;

  return isRedirectStatus(status)
    ? Response.redirect(destination.toString(), status)
    : null;
}

function findRedirectFeature(features: TagFeature[]): RedirectFeature | null {
  return features.find(
    (feature): feature is RedirectFeature => feature.type === "redirect",
  ) ?? null;
}

function platformHomeRedirect(): Response {
  return Response.redirect(PLATFORM_HOME_URL, 302);
}

function platformHomeResponse(method: string): Response {
  return new Response(method === "HEAD" ? null : PLATFORM_HOME_HTML, {
    headers: {
      "cache-control": "public, max-age=300, s-maxage=3600",
      "content-security-policy":
        "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "content-type": "text/html; charset=utf-8",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
    },
    status: 200,
  });
}

function notFound(): Response {
  return new Response("Not Found", { status: 404 });
}

function jsonActionResponse(resolvedTag: ResolvedTag): Response {
  return Response.json(
    {
      tag: {
        id: resolvedTag.id,
        value: resolvedTag.value.toString(),
        length: resolvedTag.length,
      },
      range: {
        id: resolvedTag.range.id,
        groupId: resolvedTag.range.groupId,
      },
      group: {
        id: resolvedTag.group.id,
      },
      features: resolvedTag.features,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}

export const handleRequest: ExportedHandlerFetchHandler<Env> = async (
  request,
  env,
): Promise<Response> => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", {
      headers: { allow: "GET, HEAD" },
      status: 405,
    });
  }

  const url = new URL(request.url);
  const hostname = url.hostname.toLowerCase();

  if (
    url.pathname === "/" &&
    isPlatformHomeHost(hostname, env.SCAN_ENVIRONMENT)
  ) {
    return platformHomeResponse(request.method);
  }

  if (url.pathname === "/" && isScanHost(hostname, env.SCAN_ENVIRONMENT)) {
    return platformHomeRedirect();
  }

  const tagRequest = extractTagRequest(
    url,
    env.SCAN_ENVIRONMENT,
  );

  if (!tagRequest) {
    return notFound();
  }

  const tagValue = await decodeTagId(tagRequest, env);

  if (tagValue === null) {
    return notFound();
  }

  const resolved = await resolveTag(tagValue, tagRequest.length, env.TAG_CONFIG);

  if (!resolved) {
    return notFound();
  }

  const redirect = findRedirectFeature(resolved.features);

  if (redirect) {
    const response = await toSafeRedirect(
      redirect,
      {
        tagId: tagRequest.id,
        decodedValue: tagValue.toString(),
        length: tagRequest.length.toString(),
        groupId: resolved.group.id,
      },
      env.REDIRECT_SIGNING_SECRET,
    );

    return response ?? notFound();
  }

  if (request.method === "HEAD") {
    return new Response(null, { status: 200 });
  }

  return jsonActionResponse({
    ...resolved,
    id: tagRequest.id,
  });
};

const worker: ExportedHandler<Env> = {
  fetch: handleRequest,
};

export default worker;
