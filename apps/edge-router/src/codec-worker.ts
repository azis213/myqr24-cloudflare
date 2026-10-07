/**
 * Private myQR24 TAG codec Worker.
 *
 * This Worker intentionally has no KV binding and no redirect-signing secret.
 * It exposes the shared Feistel/HMAC codec only to the server-side control
 * plane through an authenticated API.
 */
import {
  decodeTagId,
  encodeTagId,
  isCanonicalValue,
  isTagLength,
  type TagLength,
} from "./codec";

export interface CodecEnv {
  FEISTEL_SECRET_S01: string;
  TAG_HMAC_SECRET_S01: string;
  TAG_CODEC_API_KEY_S01: string;
}

interface EncodeRequest {
  length: TagLength;
  value: string;
}

interface DecodeRequest {
  tagId: string;
}

const API_PREFIX = "/api/v1/tag-codec/";
const MAX_BODY_BYTES = 1_024;
const JSON_CONTENT_TYPE = "application/json";

function apiResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return Response.json(body, {
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
    status,
  });
}

function apiError(status: number, code: string): Response {
  return apiResponse({ error: { code } }, status);
}

function unauthorized(): Response {
  return apiError(401, "unauthorized");
}

function invalidRequest(): Response {
  return apiError(400, "invalid_request");
}

function methodNotAllowed(): Response {
  return new Response("Method Not Allowed", {
    headers: {
      allow: "POST",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
    status: 405,
  });
}

function constantTimeEquals(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    difference |=
      (leftBytes[index % Math.max(leftBytes.length, 1)] ?? 0) ^
      (rightBytes[index % Math.max(rightBytes.length, 1)] ?? 0);
  }

  return difference === 0;
}

function hasValidAuthorization(request: Request, env: CodecEnv): boolean {
  const authorization = request.headers.get("authorization");

  return (
    authorization !== null &&
    authorization.startsWith("Bearer ") &&
    env.TAG_CODEC_API_KEY_S01.length > 0 &&
    constantTimeEquals(authorization.slice(7), env.TAG_CODEC_API_KEY_S01)
  );
}

function parseDecimal(value: unknown): bigint | null {
  return typeof value === "string" && /^(?:0|[1-9]\d*)$/.test(value)
    ? BigInt(value)
    : null;
}

function isEncodeRequest(value: unknown): value is EncodeRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<EncodeRequest>;

  return isTagLength(candidate.length) && parseDecimal(candidate.value) !== null;
}

function isDecodeRequest(value: unknown): value is DecodeRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<DecodeRequest>;

  return (
    typeof candidate.tagId === "string" &&
    /^(?:[0-9a-z]{6}|[0-9a-z]{8})$/i.test(candidate.tagId)
  );
}

async function readJsonBody(request: Request): Promise<unknown | null> {
  const contentLength = request.headers.get("content-length");

  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith(JSON_CONTENT_TYPE) ||
    (contentLength !== null &&
      (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_BODY_BYTES))
  ) {
    return null;
  }

  const body = await request.text();

  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
    return null;
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}

async function handleEncode(
  request: Request,
  env: CodecEnv,
): Promise<Response> {
  const body = await readJsonBody(request);

  if (!isEncodeRequest(body)) {
    return invalidRequest();
  }

  const value = parseDecimal(body.value)!;

  if (
    !isCanonicalValue(value, body.length) ||
    (body.length === 8 && value % 16n !== 0n)
  ) {
    return invalidRequest();
  }

  const encoded = await encodeTagId(value, body.length, env);

  return encoded
    ? apiResponse({
        tag: {
          id: encoded.tagId,
          length: body.length,
          value: encoded.decodedValue.toString(),
        },
      })
    : apiError(500, "codec_unavailable");
}

async function handleDecode(
  request: Request,
  env: CodecEnv,
): Promise<Response> {
  const body = await readJsonBody(request);

  if (!isDecodeRequest(body)) {
    return invalidRequest();
  }

  const tagId = body.tagId.toLowerCase();
  const decodedValue = await decodeTagId(
    { id: tagId, length: tagId.length as TagLength },
    env,
  );

  return decodedValue === null
    ? invalidRequest()
    : apiResponse({
        tag: {
          id: tagId,
          length: tagId.length,
          value: decodedValue.toString(),
        },
      });
}

export const handleCodecRequest: ExportedHandlerFetchHandler<CodecEnv> = async (
  request,
  env,
): Promise<Response> => {
  const pathname = new URL(request.url).pathname;

  if (pathname !== `${API_PREFIX}encode` && pathname !== `${API_PREFIX}decode`) {
    return apiError(404, "not_found");
  }

  if (request.method !== "POST") {
    return methodNotAllowed();
  }

  if (!hasValidAuthorization(request, env)) {
    return unauthorized();
  }

  return pathname === `${API_PREFIX}encode`
    ? handleEncode(request, env)
    : handleDecode(request, env);
};

const worker: ExportedHandler<CodecEnv> = {
  fetch: handleCodecRequest,
};

export default worker;
