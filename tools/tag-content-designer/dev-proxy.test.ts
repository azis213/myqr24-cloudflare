import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it, vi } from "vitest";
import { isLoopbackHost } from "./vite.config";

function createRequest(url: string, body: unknown, headers: Record<string, string> = {}) {
  const request = new EventEmitter() as EventEmitter & IncomingMessage;
  Object.assign(request, {
    url,
    method: "POST",
    headers: { host: "127.0.0.1:5180", ...headers },
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from(JSON.stringify(body));
    },
  });
  return request;
}

function createResponse() {
  const response = {
    statusCode: 200,
    headers: {} as Record<string, string | number>,
    body: "",
    setHeader(name: string, value: string | number) {
      this.headers[name.toLowerCase()] = value;
    },
    end(value = "") {
      this.body = value;
    },
  };
  return response as unknown as ServerResponse<IncomingMessage> & typeof response;
}

async function getMiddleware() {
  vi.resetModules();
  const { default: config } = await import("./vite.config");
  const plugin = (config.plugins ?? []).find((entry) => entry && typeof entry === "object" && entry.name === "tag-content-designer-publish-dev-api");
  if (!plugin || typeof plugin === "string" || Array.isArray(plugin) || !("configureServer" in plugin) || typeof plugin.configureServer !== "function") {
    throw new Error("Publish dev plugin fehlt.");
  }
  let middleware: (request: IncomingMessage, response: ServerResponse, next: (error?: unknown) => void) => void;
  plugin.configureServer({
    middlewares: {
      use(handler: typeof middleware) {
        middleware = handler;
      },
    },
  } as never);
  return middleware!;
}

describe("TAG-Content Dev-Proxy", () => {
  it("akzeptiert nur Loopback-Hosts", () => {
    expect(isLoopbackHost("127.0.0.1:5180")).toBe(true);
    expect(isLoopbackHost("localhost:5180")).toBe(true);
    expect(isLoopbackHost("[::1]:5180")).toBe(true);
    expect(isLoopbackHost("0.0.0.0:5180")).toBe(false);
    expect(isLoopbackHost("192.168.1.5:5180")).toBe(false);
  });

  it("lehnt unbekannte Route und fremde Origin ab, bevor ein Backend aufgerufen wird", async () => {
    const middleware = await getMiddleware();
    const next = vi.fn();
    const unknownResponse = createResponse();
    await middleware(createRequest("/__tag-content/unknown", {}, { origin: "http://127.0.0.1:5180" }), unknownResponse, next);
    expect(next).toHaveBeenCalledOnce();

    const response = createResponse();
    await middleware(createRequest("/__tag-content/resolve", { environment: "local", tagId: "ab12cd" }, { origin: "http://evil.example" }), response, next);
    expect(response.statusCode).toBe(403);
    expect(response.body).toContain("nur vom lokalen Rechner");
  });

  it("validiert Request-Methode, Environment und TAG-ID ohne Backend-Aufruf", async () => {
    const middleware = await getMiddleware();
    const next = vi.fn();
    const methodRequest = createRequest("/__tag-content/resolve", {});
    methodRequest.method = "GET";
    const methodResponse = createResponse();
    await middleware(methodRequest, methodResponse, next);
    expect(methodResponse.statusCode).toBe(405);

    const response = createResponse();
    await middleware(createRequest("/__tag-content/resolve", { environment: "production", tagId: "ab12cd" }), response, next);
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain("Environment muss local oder staging sein");

    const badTag = createResponse();
    await middleware(createRequest("/__tag-content/resolve", { environment: "local", tagId: "bad" }), badTag, next);
    expect(badTag.statusCode).toBe(400);
    expect(badTag.body).toContain("Base36-TAG-ID ist ungültig");
  });

  it("gibt keinen Secret-Wert zurück, wenn Credentials fehlen", async () => {
    const middleware = await getMiddleware();
    const response = createResponse();
    await middleware(createRequest("/__tag-content/resolve", { environment: "staging", tagId: "ab12cd" }), response, vi.fn());
    expect(response.statusCode).toBe(503);
    expect(response.body).toContain("Codec-Credentials");
    expect(response.body).not.toMatch(/Bearer|APP_CONTENT_PUBLISH_KEY|TAG_CODEC_API_KEY/);
  });

  it("authentifiziert den Codec-Lookup mit TAG_CODEC_API_KEY_S01 und nutzt das längere Timeout", async () => {
    const previousCodecUrl = process.env.MYQR_STAGING_CODEC_BASE_URL;
    const previousCodecKey = process.env.TAG_CODEC_API_KEY_S01;
    process.env.MYQR_STAGING_CODEC_BASE_URL = "https://codec.example.test";
    process.env.TAG_CODEC_API_KEY_S01 = "test-codec-bearer-key";
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ tag: { id: "ab12cd", value: "623187229" }, codecVersion: "S01" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      const middleware = await getMiddleware();
      const response = createResponse();
      await middleware(createRequest("/__tag-content/resolve", { environment: "staging", tagId: "ab12cd" }), response, vi.fn());

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ tagId: "ab12cd", tagNumericId: "623187229" });
      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, options] = fetchMock.mock.calls[0];
      expect(String(url)).toBe("https://codec.example.test/api/v1/codec/decode");
      expect(new Headers(options?.headers).get("authorization")).toBe("Bearer test-codec-bearer-key");
      expect(options?.signal).toBeInstanceOf(AbortSignal);
    } finally {
      vi.unstubAllGlobals();
      if (previousCodecUrl === undefined) delete process.env.MYQR_STAGING_CODEC_BASE_URL;
      else process.env.MYQR_STAGING_CODEC_BASE_URL = previousCodecUrl;
      if (previousCodecKey === undefined) delete process.env.TAG_CODEC_API_KEY_S01;
      else process.env.TAG_CODEC_API_KEY_S01 = previousCodecKey;
    }
  });

  it("leitet Test-TAG-Verwaltung mit getrenntem Admin-Key weiter und gleicht Numeric-ID über Codec ab", async () => {
    const oldValues = {
      api: process.env.MYQR_STAGING_TAG_APP_API_BASE_URL,
      codec: process.env.MYQR_STAGING_CODEC_BASE_URL,
      codecKey: process.env.TAG_CODEC_API_KEY_S01,
      publishKey: process.env.MYQR_STAGING_PUBLISH_KEY,
      adminKey: process.env.MYQR_STAGING_TAG_TEST_ADMIN_KEY,
    };
    Object.assign(process.env, {
      MYQR_STAGING_TAG_APP_API_BASE_URL: "https://tag-api.example.test",
      MYQR_STAGING_CODEC_BASE_URL: "https://codec.example.test",
      TAG_CODEC_API_KEY_S01: "codec-test-key",
      MYQR_STAGING_PUBLISH_KEY: "publisher-test-key",
      MYQR_STAGING_TAG_TEST_ADMIN_KEY: "test-admin-key",
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/api/v1/codec/decode")) {
        return Response.json({ tag: { id: "ab12cd", value: "623187229" }, codecVersion: "S01" });
      }
      return Response.json({ status: "saved", tagId: "ab12cd" });
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const middleware = await getMiddleware();
      const response = createResponse();
      await middleware(createRequest("/__tag-content/admin", {
        operation: "save", environment: "staging", tagId: "ab12cd", tagNumericId: "623187229",
        status: "active", targetType: "internal", protectionMode: "public", externalUrl: null,
        accessVersion: 1, contentRevision: 1, schemaVersion: 1,
      }), response, vi.fn());
      expect(response.statusCode).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const [adminUrl, adminOptions] = fetchMock.mock.calls[1];
      expect(String(adminUrl)).toBe("https://tag-api.example.test/api/test-admin/tags/ab12cd");
      expect(new Headers(adminOptions?.headers).get("authorization")).toBe("Bearer test-admin-key");
      expect(new Headers(adminOptions?.headers).get("authorization")).not.toContain("publisher-test-key");
      expect(adminOptions?.method).toBe("PUT");
    } finally {
      vi.unstubAllGlobals();
      for (const [key, value] of Object.entries({
        MYQR_STAGING_TAG_APP_API_BASE_URL: oldValues.api,
        MYQR_STAGING_CODEC_BASE_URL: oldValues.codec,
        TAG_CODEC_API_KEY_S01: oldValues.codecKey,
        MYQR_STAGING_PUBLISH_KEY: oldValues.publishKey,
        MYQR_STAGING_TAG_TEST_ADMIN_KEY: oldValues.adminKey,
      })) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it("antwortet auf den Admin-Status ohne TAG-ID und ohne Browser-Secret", async () => {
    const previous = {
      api: process.env.MYQR_STAGING_TAG_APP_API_BASE_URL,
      admin: process.env.MYQR_STAGING_TAG_TEST_ADMIN_KEY,
    };
    process.env.MYQR_STAGING_TAG_APP_API_BASE_URL = "https://tag-api.example.test";
    process.env.MYQR_STAGING_TAG_TEST_ADMIN_KEY = "test-admin-key";
    const fetchMock = vi.fn(async () => Response.json({ enabled: true, environment: "staging" }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const middleware = await getMiddleware();
      const response = createResponse();
      await middleware(createRequest("/__tag-content/admin-status", { environment: "staging" }), response, vi.fn());
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ enabled: true, environment: "staging" });
      expect(fetchMock).toHaveBeenCalledOnce();
      const [, init] = fetchMock.mock.calls[0];
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer test-admin-key");
      expect(response.body).not.toContain("test-admin-key");
    } finally {
      vi.unstubAllGlobals();
      if (previous.api === undefined) delete process.env.MYQR_STAGING_TAG_APP_API_BASE_URL;
      else process.env.MYQR_STAGING_TAG_APP_API_BASE_URL = previous.api;
      if (previous.admin === undefined) delete process.env.MYQR_STAGING_TAG_TEST_ADMIN_KEY;
      else process.env.MYQR_STAGING_TAG_TEST_ADMIN_KEY = previous.admin;
    }
  });

  it("weist zu große Requests zurück, bevor JSON/Backend verarbeitet werden", async () => {
    const middleware = await getMiddleware();
    const request = new EventEmitter() as EventEmitter & IncomingMessage;
    Object.assign(request, {
      url: "/__tag-content/resolve",
      method: "POST",
      headers: { host: "127.0.0.1:5180" },
      [Symbol.asyncIterator]: async function* () {
        yield Buffer.alloc(141 * 1024, 0x20);
      },
    });
    const response = createResponse();
    await middleware(request, response, vi.fn());
    expect(response.statusCode).toBe(413);
  });
});