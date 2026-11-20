import type { TemplateIssue } from "./validate";

/** Umgebung für Publisher-Endpunkte (Upload und Definition lesen). */
export interface PublisherEnv {
  APP_DB: D1Database;
  PRIVATE_CONTENT: R2Bucket;
  /** Publisher-Secret; fehlt es, antworten die Pfade fail-closed. */
  APP_CONTENT_PUBLISH_KEY_S01?: string;
}

export const NO_STORE = { "cache-control": "no-store", "x-content-type-options": "nosniff" };

export function json(body: Record<string, unknown>, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

export function fail(
  status: number,
  code: string,
  message: string,
  extra?: { issues?: TemplateIssue[]; elements?: Array<{ elementId: string; itemCount: number }> },
): Response {
  return json(
    {
      error: {
        code,
        message,
        ...(extra?.issues && extra.issues.length > 0 ? { issues: extra.issues.slice(0, 20) } : {}),
        ...(extra?.elements && extra.elements.length > 0 ? { elements: extra.elements } : {}),
      },
    },
    status,
  );
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

export function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index++) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

/**
 * Prüft das Publisher-Secret. `null` bedeutet autorisiert; andernfalls wird die
 * fertige Fehlerantwort zurückgegeben (fail-closed, keine Unterscheidung nach außen).
 */
export function publisherDenied(request: Request, env: PublisherEnv): Response | null {
  const secret = env.APP_CONTENT_PUBLISH_KEY_S01;
  if (!secret) return fail(503, "publisher_disabled", "Publish ist auf dieser Umgebung nicht konfiguriert.");
  const token = bearerToken(request);
  if (!token || !timingSafeEqual(token, secret)) return fail(401, "unauthorized", "Nicht autorisiert.");
  return null;
}
