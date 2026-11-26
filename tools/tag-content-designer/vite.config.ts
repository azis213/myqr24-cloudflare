import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { readFile } from "node:fs/promises";
import { isIP } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";

const toolDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(toolDirectory, "../..");
const MAX_PROXY_BODY_BYTES = 140 * 1024;

type LocalSecrets = Record<string, string>;

export function resolveStagingDesignerConfig(
  processEnvironment: Record<string, string | undefined>,
  tagSecrets: LocalSecrets,
  codecSecrets: LocalSecrets,
) {
  return {
    apiBaseUrl: processEnvironment.MYQR_STAGING_TAG_APP_API_BASE_URL || "https://internal.s.myqr24.com",
    codecBaseUrl: processEnvironment.MYQR_STAGING_CODEC_BASE_URL || "https://internal.s.myqr24.com",
    publishKey: processEnvironment.MYQR_STAGING_PUBLISH_KEY || tagSecrets.APP_CONTENT_PUBLISH_KEY_S01 || "",
    codecToken: processEnvironment.TAG_CODEC_API_KEY_S01 || codecSecrets.TAG_CODEC_API_KEY_S01 || "",
    testAdminKey: processEnvironment.MYQR_STAGING_TAG_TEST_ADMIN_KEY || tagSecrets.TAG_TEST_ADMIN_KEY_S01 || tagSecrets.APP_LOCAL_SEED_KEY || "",
  };
}

function parseDevVars(text: string): LocalSecrets {
  const result: LocalSecrets = {};
  for (const line of text.split(/\r?\n/u)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/u.exec(line);
    if (!match || line.trimStart().startsWith("#")) continue;
    const value = match[2].replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/u, (_whole, doubleQuoted: string, singleQuoted: string) => doubleQuoted ?? singleQuoted);
    result[match[1]] = value;
  }
  return result;
}

async function readLocalSecrets(path: string): Promise<LocalSecrets> {
  try {
    return parseDevVars(await readFile(path, "utf8"));
  } catch {
    return {};
  }
}

function jsonResponse(response: ServerResponse<IncomingMessage>, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("content-length", Buffer.byteLength(payload));
  response.end(payload);
}

export function isLoopbackHost(host: string): boolean {
  const hostname = host.startsWith("[") ? host.slice(1, host.indexOf("]")) : host.split(":")[0];
  const normalized = hostname.toLowerCase();
  return normalized === "localhost" || isIP(normalized) !== 0 && (normalized.startsWith("127.") || normalized === "::1");
}

function publishDevApi() {
  return {
    name: "tag-content-designer-publish-dev-api",
    configureServer(server: import("vite").ViteDevServer) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
        if (pathname !== "/__tag-content/resolve" && pathname !== "/__tag-content/publish" && pathname !== "/__tag-content/admin" && pathname !== "/__tag-content/admin-status") {
          next();
          return;
        }

        const origin = request.headers.origin;
        const host = request.headers.host ?? "";
        let originHost: string | null = null;
        try {
          originHost = origin ? new URL(origin).host : null;
        } catch {
          originHost = "";
        }
        if (!isLoopbackHost(host) || originHost !== null && originHost !== host) {
          jsonResponse(response, 403, { error: "Designer-Publish ist nur vom lokalen Rechner erlaubt." });
          return;
        }
        if (request.method !== "POST") {
          jsonResponse(response, 405, { error: "Nur POST ist erlaubt." });
          return;
        }

        try {
          const chunks: Buffer[] = [];
          let totalBytes = 0;
          for await (const chunk of request) {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            totalBytes += buffer.byteLength;
            if (totalBytes > MAX_PROXY_BODY_BYTES) {
              jsonResponse(response, 413, { error: "Anfrage überschreitet 140 KiB." });
              return;
            }
            chunks.push(buffer);
          }
          const rawBody = Buffer.concat(chunks).toString("utf8");
          const body: unknown = JSON.parse(rawBody);
          if (!body || typeof body !== "object" || Array.isArray(body)) {
            jsonResponse(response, 400, { error: "Anfrage muss ein JSON-Objekt sein." });
            return;
          }
          const input = body as Record<string, unknown>;
          const environment = input.environment;
          const tagId = input.tagId;
          if (environment !== "local" && environment !== "staging") {
            jsonResponse(response, 400, { error: "Environment muss local oder staging sein." });
            return;
          }
          if (pathname !== "/__tag-content/admin-status" && (typeof tagId !== "string" || !/^(?:[0-9a-z]{6}|[0-9a-z]{8}|[0-9a-z]{10})$/u.test(tagId))) {
            jsonResponse(response, 400, { error: "Base36-TAG-ID ist ungültig." });
            return;
          }

          let apiBaseUrl: string;
          let codecBaseUrl: string;
          let publishKey: string;
          let codecToken: string;
          let testAdminKey: string;
          if (environment === "local") {
            const [tagSecrets, codecSecrets] = await Promise.all([
              readLocalSecrets(resolve(repositoryRoot, "apps/tag-app/.dev.vars")),
              readLocalSecrets(resolve(repositoryRoot, "apps/edge-router/.dev.vars")),
            ]);
            apiBaseUrl = "http://127.0.0.1:8787";
            codecBaseUrl = "http://127.0.0.1:8788";
            publishKey = tagSecrets.APP_CONTENT_PUBLISH_KEY_S01 ?? "";
            codecToken = codecSecrets.TAG_CODEC_API_KEY_S01 ?? "";
            testAdminKey = tagSecrets.APP_LOCAL_SEED_KEY ?? "";
          } else {
            const [tagSecrets, codecSecrets] = await Promise.all([
              readLocalSecrets(resolve(repositoryRoot, "apps/tag-app/.dev.vars")),
              readLocalSecrets(resolve(repositoryRoot, "apps/edge-router/.dev.vars")),
            ]);
            // Staging's dedicated admin secret is provisioned from APP_LOCAL_SEED_KEY
            // by deploy-tag-app-api-staging.ps1. Keep the value server-side only.
            ({ apiBaseUrl, codecBaseUrl, publishKey, codecToken, testAdminKey } = resolveStagingDesignerConfig(process.env, tagSecrets, codecSecrets));
          }

          if (pathname === "/__tag-content/admin") {
            if (!apiBaseUrl || !testAdminKey) {
              jsonResponse(response, 503, { error: `Test-TAG-Verwaltung für ${environment} ist nicht serverseitig konfiguriert.` });
              return;
            }
            const apiUrl = new URL(apiBaseUrl);
            if (apiUrl.protocol !== "https:" && !(environment === "local" && apiUrl.hostname === "127.0.0.1")) {
              jsonResponse(response, 400, { error: "Verwaltungs-API muss HTTPS verwenden (lokal ausschließlich 127.0.0.1)." });
              return;
            }
            const operation = input.operation;
            if (operation !== "get" && operation !== "save" && operation !== "delete") {
              jsonResponse(response, 400, { error: "Unbekannte Test-TAG-Operation." });
              return;
            }
            const numericId = input.tagNumericId;
            if (typeof numericId !== "string" || !/^[1-9][0-9]{0,15}$/u.test(numericId)) {
              jsonResponse(response, 400, { error: "Numeric-ID fehlt oder ist ungültig." });
              return;
            }
            if (!codecBaseUrl || !codecToken) {
              jsonResponse(response, 503, { error: "Codec-Credentials sind serverseitig nicht konfiguriert." });
              return;
            }
            const decoded = await fetch(new URL("/api/v1/codec/decode", codecBaseUrl), {
              method: "POST",
              headers: { authorization: `Bearer ${codecToken}`, "content-type": "application/json" },
              body: JSON.stringify({ tagId }),
              redirect: "error",
              signal: AbortSignal.timeout(30_000),
            });
            const decodedBody: unknown = await decoded.json().catch(() => null);
            const decodedId = (decodedBody as { tag?: { value?: unknown } } | null)?.tag?.value;
            if (!decoded.ok || decodedId !== numericId) {
              jsonResponse(response, 400, { error: "Base36- und Numeric-ID stimmen laut Codec nicht überein." });
              return;
            }
            const method = operation === "get" ? "GET" : operation === "save" ? "PUT" : "DELETE";
            const adminUrl = new URL(`/api/test-admin/tags/${tagId}`, apiBaseUrl);
            if (method === "GET") adminUrl.searchParams.set("numericId", numericId);
            const adminResponse = await fetch(adminUrl, {
              method,
              headers: {
                authorization: `Bearer ${testAdminKey}`,
                ...(method === "GET" ? {} : { "content-type": "application/json" }),
              },
              ...(method === "GET" ? {} : { body: JSON.stringify({ ...input, tagNumericId: numericId }) }),
              redirect: "error",
              signal: AbortSignal.timeout(30_000),
            });
            const adminBody: unknown = await adminResponse.json().catch(() => null);
            jsonResponse(response, adminResponse.status, adminBody ?? { error: "Test-TAG-API lieferte keine JSON-Antwort." });
            return;
          }

          if (pathname === "/__tag-content/admin-status") {
            if (!apiBaseUrl || !testAdminKey) {
              jsonResponse(response, 200, { enabled: false, environment });
              return;
            }
            const apiUrl = new URL(apiBaseUrl);
            if (apiUrl.protocol !== "https:" && !(environment === "local" && apiUrl.hostname === "127.0.0.1")) {
              jsonResponse(response, 200, { enabled: false, environment });
              return;
            }
            const statusResponse = await fetch(new URL("/api/test-admin/status", apiBaseUrl), {
              headers: { authorization: `Bearer ${testAdminKey}` },
              redirect: "error",
              signal: AbortSignal.timeout(10_000),
            });
            const statusBody: unknown = await statusResponse.json().catch(() => null);
            if (!statusResponse.ok) {
              jsonResponse(response, 200, {
                enabled: false,
                environment,
                error: statusResponse.status === 404 || statusResponse.status === 401
                  ? "Staging-Worker hat die Admin-Prüfung abgelehnt. Prüfe TAG_TEST_ADMIN_KEY_S01 und starte den Designer-Dev-Server neu."
                  : `Staging-Worker antwortete mit HTTP ${statusResponse.status}; die Admin-API bleibt deaktiviert.`,
              });
              return;
            }
            if (statusBody && typeof statusBody === "object" && !Array.isArray(statusBody)) {
              jsonResponse(response, 200, statusBody);
              return;
            }
            jsonResponse(response, 200, { enabled: false, environment, error: "Staging-Worker lieferte keine gültige Statusantwort." });
            return;
          }

          if (!codecBaseUrl || !codecToken) {
            jsonResponse(response, 503, { error: `Codec-Credentials für ${environment} sind serverseitig nicht konfiguriert.` });
            return;
          }
          if (environment === "staging" && new URL(codecBaseUrl).protocol !== "https:") {
            jsonResponse(response, 400, { error: "Staging-Codec muss über HTTPS erreichbar sein." });
            return;
          }

          if (pathname === "/__tag-content/resolve") {
            if (typeof tagId !== "string" || !/^(?:[0-9a-z]{6}|[0-9a-z]{8}|[0-9a-z]{10})$/u.test(tagId)) {
              jsonResponse(response, 400, { error: "Base36-TAG-ID ist ungültig." });
              return;
            }
            const decoded = await fetch(new URL("/api/v1/codec/decode", codecBaseUrl), {
              method: "POST",
              headers: { authorization: `Bearer ${codecToken}`, "content-type": "application/json" },
              body: JSON.stringify({ tagId }),
              redirect: "error",
              signal: AbortSignal.timeout(30_000),
            });
            const decodedBody: unknown = await decoded.json().catch(() => null);
            if (!decoded.ok) {
              jsonResponse(response, decoded.status, { error: "TAG-ID konnte nicht dekodiert werden.", details: decodedBody });
              return;
            }
            const numericId = (decodedBody as { tag?: { value?: unknown } } | null)?.tag?.value;
            if (typeof numericId !== "string" || !/^[1-9][0-9]{0,15}$/u.test(numericId)) {
              jsonResponse(response, 502, { error: "Codec lieferte keine gültige numerische TAG-ID." });
              return;
            }
            jsonResponse(response, 200, { tagId: tagId.toLowerCase(), tagNumericId: numericId });
            return;
          }

          if (!apiBaseUrl || !publishKey) {
            jsonResponse(response, 503, { error: `Publisher-Credentials für ${environment} sind serverseitig nicht konfiguriert.` });
            return;
          }
          const apiUrl = new URL(apiBaseUrl);
          if (apiUrl.protocol !== "https:" && !(environment === "local" && apiUrl.hostname === "127.0.0.1")) {
            jsonResponse(response, 400, { error: "Publish-API muss HTTPS verwenden (lokal ausschließlich 127.0.0.1)." });
            return;
          }
          const numericId = input.tagNumericId;
          const template = input.template;
          if (typeof numericId !== "string" || !/^[1-9][0-9]{0,15}$/u.test(numericId)) {
            jsonResponse(response, 400, { error: "Numerische TAG-ID fehlt oder ist ungültig." });
            return;
          }
          if (!template || typeof template !== "object" || Array.isArray(template)) {
            jsonResponse(response, 400, { error: "Template muss ein JSON-Objekt sein." });
            return;
          }
          const document = template as Record<string, unknown>;
          if (document.schema !== "myqr24-tag-content-template-v1" || document.schemaVersion !== 3) {
            jsonResponse(response, 400, { error: "Erwartet wird ein TAG-Content-Template der Schema-Version 3." });
            return;
          }
          if (input.confirm !== `PUBLISH ${tagId}`) {
            jsonResponse(response, 400, { error: "Publish-Bestätigung stimmt nicht mit der TAG-ID überein." });
            return;
          }

          const expectedRevision = input.expectedRevision;
          if (expectedRevision !== undefined && (typeof expectedRevision !== "number" || !Number.isSafeInteger(expectedRevision) || expectedRevision < 1)) {
            jsonResponse(response, 400, { error: "Revision muss eine positive Ganzzahl sein." });
            return;
          }
          const tagName = typeof input.tagName === "string" && input.tagName.trim()
            ? input.tagName.trim()
            : (document.template as { name?: string } | undefined)?.name;
          const publishResponse = await fetch(new URL(`/api/v1/tags/${tagId}/content`, apiBaseUrl), {
            method: "PUT",
            headers: { authorization: `Bearer ${publishKey}`, "content-type": "application/json" },
            body: JSON.stringify({ tagId, tagNumericId: numericId, tagName, ...(expectedRevision === undefined ? {} : { expectedRevision }), template }),
            redirect: "error",
            signal: AbortSignal.timeout(20_000),
          });
          const publishBody: unknown = await publishResponse.json().catch(() => null);
          jsonResponse(response, publishResponse.status, publishBody ?? { error: "Publisher lieferte keine JSON-Antwort." });
        } catch (caught) {
          const message = caught instanceof Error ? caught.message : "Unbekannter Proxy-Fehler.";
          jsonResponse(response, 502, { error: message });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), publishDevApi()],
  server: {
    host: "127.0.0.1",
    port: 5180,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 4180,
    strictPort: true,
  },
  build: {
    // Der RTF-Editor (ProseMirror/Tiptap) ist bewusst enthalten; das Tool läuft offline
    // ohne CDN. Tabellen/Drop-/Gapcursor werden nicht gebündelt (siehe SPECIFICATION §12).
    chunkSizeWarningLimit: 800,
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "dev-proxy.test.ts"],
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
  },
});

