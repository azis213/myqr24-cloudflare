import { argon2id } from "hash-wasm";
import { describe, expect, it } from "vitest";
import { handleAppApiRequest } from "../workers/app-api";

const secret = "bootstrap-test-secret";
const pepper = "server-only-pepper";
const routing = { tag_id: "ab12cd", status: "active", target_type: "internal", protection_mode: "pin_required", access_version: 3, content_revision: 8 };

function b64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))));
}
async function bootstrap(mode = "pin_required") {
  const nonce = "test-bootstrap-nonce";
  const exp = Math.floor(Date.now() / 1000) + 30;
  const payload = ["myqr24/pwa-bootstrap/v1", "tag=ab12cd", `mode=${mode}`, "accessVersion=3", "revision=8", `nonce=${nonce}`, `exp=${exp}`].join("\n");
  return { mode, accessVersion: 3, revision: 8, nonce, exp, sig: await hmac(payload) };
}

function fakeEnvironment(protectionMode: "public" | "pin_required" = "pin_required") {
  const sessions: Array<Record<string, unknown>> = [];
  const throttles = new Map<string, { failed_attempts: number; locked_until: string | null }>();
  const r2Keys: string[] = [];
  const signerBodies: Array<Record<string, unknown>> = [];
  let accessVersion = 3;
  let signerRequests = 0;
  const r2Objects = new Map<string, { bytes: Uint8Array; contentType: string }>();
  const deletedR2Keys: string[] = [];
  const uploadedFilenames = new Map<number, string>();
  const pinHashPromise = argon2id({ password: "123456", secret: pepper, salt: "local-test-salt", iterations: 1, parallelism: 1, memorySize: 8192, hashLength: 32, outputType: "encoded" });
  const tagDocument = {
    schema: "myqr24-tag-content-v2",
    tagNumericId: "623187229",
    tagId: "ab12cd",
    revision: 8,
    view: { tag: { id: "ab12cd", displayName: "Test", presentation: "standard" }, vault: { blocks: [] }, enabledFeatures: ["vault"] },
    elements: [{ elementId: "cel_gallery", elementType: "gallery", payload: { title: "Testgalerie" } }],
  };
  const env = {
    APP_BOOTSTRAP_SECRET_S01: secret,
    APP_PIN_PEPPER_S01: pepper,
    APP_MEDIA_SIGNER_KEY_S01: "service-key",
    TAG_CONTENT_API_KEY_S01: "content-api-test-key",
    PRIVATE_CONTENT: {
      get: async (key: string) => {
        r2Keys.push(key);
        if (key === "content/v1/tags/623187229/tag-rev8.json") return { json: async () => tagDocument };
        const stored = r2Objects.get(key);
        if (!stored) return null;
        return {
          size: stored.bytes.byteLength,
          body: new ReadableStream({ start(controller) { controller.enqueue(stored.bytes); controller.close(); } }),
          httpMetadata: { contentType: stored.contentType },
          httpEtag: '"test-etag"',
        };
      },
      put: async (key: string, value: ArrayBuffer | ArrayBufferView | string, options?: { httpMetadata?: { contentType?: string } }) => {
        const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        r2Objects.set(key, { bytes: new Uint8Array(bytes), contentType: options?.httpMetadata?.contentType ?? "application/octet-stream" });
      },
      delete: async (key: string) => { deletedR2Keys.push(key); r2Objects.delete(key); },
    },
    MEDIA_SIGNER: {
      fetch: async (_url: string, init: RequestInit) => {
        signerRequests++;
        signerBodies.push(typeof init.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : {});
        return Response.json({ url: "https://r2.example.test/signed", expiresAt: 60, contentType: "image/webp" });
      },
    },
    APP_DB: {
      prepare(sql: string) {
        return {
          bind(...values: unknown[]) {
            return {
              async first() {
                if (sql.includes("FROM tag_routing")) return { ...routing, protection_mode: protectionMode, access_version: accessVersion };
                if (sql.includes("FROM tag_content AS tc") && sql.includes("JOIN tag_routing")) return { tag_numeric_id: 623187229, status: "active", target_type: "internal" };
                if (sql.includes("FROM tag_content_elements AS element") && sql.includes("MAX(assignment.display_order)")) return { content_element_type: "gallery", visibility: "public", max_display_order: -1 };
                if (sql.includes("FROM tag_content_elements WHERE")) return { visibility: "public" };
                if (sql.includes("FROM tag_routing WHERE tag_id")) return { status: "active", target_type: "internal" };
                if (sql.includes("FROM tag_content WHERE tag_base36_id")) return { tag_numeric_id: 623187229, tag_base36_id: "ab12cd", content_revision: 8, content_file: "tag-rev8.json", content_sha256: "a".repeat(64), content_bytes: 1, content_type: "application/json" };
                if (sql.includes("FROM tag_content AS tc") && sql.includes("JOIN tag_content_element_items") && sql.includes("assignment.content_id")) return { content_id: Number(values[1]), owner_tag_numeric_id: 623187229, content_item_type: "image", original_filename: "same.png", status: "ready", element_visibility: "public", assignment_visibility: "public", content_element_id: "cel_gallery", scope: "tag" };
                if (sql.includes("FROM tag_content_items WHERE content_id")) return { content_id: Number(values[0]), owner_tag_numeric_id: 623187229, original_filename: uploadedFilenames.get(Number(values[0])) ?? "test.jpg", status: "ready" };
                if (sql.includes("FROM tag_content AS tc") && sql.includes("assignment.content_id")) return { content_id: Number(values[1]), owner_tag_numeric_id: 623187229, content_item_type: "image", original_filename: "test.jpg", status: "ready", element_visibility: "public", assignment_visibility: "public", content_element_id: "cel_gallery", scope: "tag" };
                if (sql.includes("FROM tag_content_elements AS element") && sql.includes("MAX(assignment.display_order)")) return { content_element_type: "gallery", visibility: "public", max_display_order: -1 };
                if (sql.includes("FROM tag_pin_credentials")) return { pin_hash: await pinHashPromise };
                if (sql.includes("FROM tag_pin_throttles")) return throttles.get(`${values[0]}:${values[1]}`) ?? null;
                if (sql.includes("FROM tag_access_sessions")) {
                  const found = sessions.find((session) => session.token_hash === values[0] && session.tag_id === values[1]);
                  return found ?? null;
                }
                return null;
              },
              async all() {
                if (sql.includes("FROM tag_content_element_items AS assignment")) {
                  return { results: [{ content_element_id: "cel_gallery", content_id: 1850000000000000, content_item_type: "image", title: "Testbild", alt_text: "Testbeschreibung", original_filename: "Titelbild.jpg", display_order: 0, visibility: "public", scope: "tag" }] };
                }
                if (sql.includes("FROM tag_content_elements")) {
                  return { results: [{ content_element_id: "cel_gallery", content_element_type: "gallery", display_order: 0, visibility: "public" }] };
                }
                return { results: [] };
              },
              async run() {
                if (sql.startsWith("INSERT INTO tag_content_items")) {
                  uploadedFilenames.set(Number(values[0]), String(values[4]));
                  return { success: true, meta: { changes: 1 } };
                }
                if (sql.startsWith("INSERT INTO tag_access_sessions")) sessions.push({ id: values[0], tag_id: values[1], token_hash: values[2], access_version: values[3], scope: values[4], expires_at: values[5], revoked_at: null });
                if (sql.startsWith("UPDATE tag_content_items SET status = 'ready'")) return { success: true, meta: { changes: 1 } };
                if (sql.startsWith("DELETE FROM tag_content_items")) return { success: true, meta: { changes: 1 } };
                if (sql.startsWith("DELETE FROM tag_pin_throttles")) throttles.delete(`${values[0]}:${values[1]}`);
                if (sql.startsWith("INSERT INTO tag_pin_throttles")) {
                  const key = `${values[0]}:${values[1]}`;
                  throttles.set(key, { failed_attempts: Number(values[2]), locked_until: values[3] as string | null });
                }
                return { success: true };
              },
            };
          },
        };
      },
    },
  } as unknown as Parameters<typeof handleAppApiRequest>[1];
  const db = env.APP_DB as unknown as { batch: (statements: unknown[]) => Promise<unknown> };
  db.batch = async () => [];
  return { env, sessions, throttles, r2Keys, r2Objects, deletedR2Keys, signerBodies, setAccessVersion: (value: number) => { accessVersion = value; }, signerRequests: () => signerRequests };
}

describe("tag access API", () => {
  it("issues an HttpOnly public access session only for a valid public bootstrap", async () => {
    const state = fakeEnvironment();
    const data = await bootstrap("public");
    const response = await handleAppApiRequest(new Request("https://app.test/api/v1/tags/ab12cd/access/public", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) }), state.env);
    expect(response.status).toBe(404); // Routing record is pin_required, so public bootstrap cannot disclose content.
    expect(state.sessions).toHaveLength(0);
  });

  it("does not load content before a successful PIN session and locks after five failures", async () => {
    const state = fakeEnvironment();
    const data = await bootstrap();
    const content = await handleAppApiRequest(new Request("https://app.test/api/v1/tags/ab12cd/content"), state.env);
    expect(content.status).toBe(404);
    for (let index = 0; index < 5; index++) {
      const response = await handleAppApiRequest(new Request("https://app.test/api/verify-pin", { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.1" }, body: JSON.stringify({ tagId: "ab12cd", pin: "wrong", ...data }) }), state.env);
      expect(response.status).toBe(404);
    }
    const throttle = state.throttles.get("ab12cd:203.0.113.1");
    expect(throttle?.failed_attempts).toBe(5);
    expect(Date.parse(throttle?.locked_until ?? "")).toBeGreaterThan(Date.now() + 14 * 60 * 1000);
  });

  it("issues a PIN session, loads authorized JSON and revokes it through access-version change", async () => {
    const state = fakeEnvironment();
    const data = await bootstrap();
    const authorized = await handleAppApiRequest(new Request("https://app.test/api/verify-pin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tagId: "ab12cd", pin: "123456", ...data }) }), state.env);
    expect(authorized.status).toBe(200);
    const cookie = authorized.headers.get("set-cookie");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    const content = await handleAppApiRequest(new Request("https://app.test/api/v1/tags/ab12cd/content", { headers: { cookie: cookie ?? "" } }), state.env);
    expect(content.status).toBe(200);
    const contentBody = await content.json<Record<string, unknown>>();
    expect(contentBody).toMatchObject({
      schema: "myqr24-tag-content-v2",
      tagId: "ab12cd",
      revision: 8,
      elements: [{ id: "cel_gallery", type: "gallery", payload: { title: "Testgalerie" }, items: [{ contentId: "1850000000000000", type: "image", title: "Testbild", altText: "Testbeschreibung", filename: "Titelbild.jpg", scope: "tag" }] }],
    });
    expect(JSON.stringify(contentBody)).not.toContain("object_key");
    expect(state.r2Keys).toEqual(["content/v1/tags/623187229/tag-rev8.json"]);
    state.setAccessVersion(4);
    const revoked = await handleAppApiRequest(new Request("https://app.test/api/v1/tags/ab12cd/content", { headers: { cookie: cookie ?? "" } }), state.env);
    expect(revoked.status).toBe(404);
  });

  it("uploads same-name images as distinct items, streams originals only with a session, and deletes by contentId", async () => {
    const state = fakeEnvironment();
    const upload = async () => handleAppApiRequest(new Request("https://app.test/api/v1/tags/ab12cd/elements/cel_gallery/items", {
      method: "POST",
      headers: {
        authorization: "Bearer content-api-test-key",
        "x-file-name": "same.png",
        "content-type": "image/png",
      },
      body: Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 1]),
    }), state.env);
    const first = await upload();
    const second = await upload();
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const firstBody = await first.json<{ contentId: string }>();
    const secondBody = await second.json<{ contentId: string }>();
    expect(firstBody.contentId).not.toBe(secondBody.contentId);
    expect(state.r2Objects.size).toBe(2);
    expect([...state.r2Objects.keys()]).toEqual([
      `content/v1/tags/623187229/items/${firstBody.contentId}/same.png`,
      `content/v1/tags/623187229/items/${secondBody.contentId}/same.png`,
    ]);

    const bootstrapData = await bootstrap();
    const authorized = await handleAppApiRequest(new Request("https://app.test/api/verify-pin", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tagId: "ab12cd", pin: "123456", ...bootstrapData }),
    }), state.env);
    const cookie = authorized.headers.get("set-cookie") ?? "";
    const media = await handleAppApiRequest(new Request(`https://app.test/api/v1/tags/ab12cd/items/${firstBody.contentId}/media`, { headers: { cookie } }), state.env);
    expect(media.status).toBe(200);
    expect(media.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await media.arrayBuffer())).toEqual(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 1]));

    const legacyMedia = await handleAppApiRequest(new Request("https://app.test/api/get-image-url", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ tagId: "ab12cd", contentId: "1850000000000000", variant: "cover" }),
    }), state.env);
    expect(legacyMedia.status).toBe(200);
    expect(state.signerRequests()).toBe(1);

    const deleted = await handleAppApiRequest(new Request(`https://app.test/api/v1/tags/ab12cd/items/${firstBody.contentId}`, {
      method: "DELETE", headers: { authorization: "Bearer content-api-test-key" },
    }), state.env);
    expect(deleted.status).toBe(200);
    expect(state.deletedR2Keys).toContain(`content/v1/tags/623187229/items/${firstBody.contentId}/same.png`);
    const deletedObject = await handleAppApiRequest(new Request(`https://app.test/api/v1/tags/ab12cd/items/${firstBody.contentId}/media`, { headers: { cookie } }), state.env);
    expect(deletedObject.status).toBe(404);
  });

  it("issues a public access session through the versioned Hono route", async () => {
    const state = fakeEnvironment("public");
    const data = await bootstrap("public");
    const authorized = await handleAppApiRequest(new Request("https://app.test/api/v1/tags/ab12cd/access/public", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) }), state.env);
    expect(authorized.status).toBe(200);
    const cookie = authorized.headers.get("set-cookie");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/api");
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0]?.scope).toBe("public");

    const content = await handleAppApiRequest(new Request("https://app.test/api/v1/tags/ab12cd/content", { headers: { cookie: cookie ?? "" } }), state.env);
    expect(content.status).toBe(200);
    expect(content.headers.get("cache-control")).toBe("no-store");
    expect(content.headers.get("x-content-type-options")).toBe("nosniff");

    const head = await handleAppApiRequest(new Request("https://app.test/api/v1/tags/ab12cd/content", { method: "HEAD", headers: { cookie: cookie ?? "" } }), state.env);
    expect(head.status).toBe(404);
  });

  it("keeps unknown paths, trailing slashes and unsupported methods fail-closed", async () => {
    const state = fakeEnvironment();
    const requests = [
      new Request("https://app.test/api/unknown"),
      new Request("https://app.test/api/v1/tags/not-a-tag/content"),
      new Request("https://app.test/api/v1/tags/%E0%A4%A/content"),
      new Request("https://app.test/api/verify-pin", { method: "OPTIONS" }),
      new Request("https://app.test/api/verify-pin/", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }),
      new Request("https://app.test/api/verify-pin"),
      new Request("https://app.test/api/v1/tags/ab12cd/content", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }),
      new Request("https://app.test/api/v1/tags/ab12cd/content", { method: "HEAD" }),
    ];

    for (const request of requests) {
      const response = await handleAppApiRequest(request, state.env);
      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    }
    expect(state.sessions).toHaveLength(0);
  });

  it("rejects malformed JSON, wrong content types and non-object bodies without side effects", async () => {
    const state = fakeEnvironment();
    const requests = [
      { request: new Request("https://app.test/api/verify-pin", { method: "POST", headers: { "content-type": "application/json" }, body: "{" }), status: 400 },
      { request: new Request("https://app.test/api/v1/tags/ab12cd/access/public", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" }), status: 400 },
      { request: new Request("https://app.test/api/get-image-url", { method: "POST", headers: { "content-type": "application/json" }, body: "[]" }), status: 400 },
      { request: new Request("https://app.test/api/get-image-url", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tagId: "ab12cd", contentId: "cnt_photo", variant: "cover" }) }), status: 400 },
      { request: new Request("https://app.test/api/get-image-url", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tagId: "ab12cd", contentId: "0185000000000000", variant: "cover" }) }), status: 400 },
      { request: new Request("https://app.test/api/get-image-url", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tagId: "ab12cd", contentId: "1850000000000000", variant: "cover" }) }), status: 404 },
    ];

    for (const { request, status } of requests) {
      const response = await handleAppApiRequest(request, state.env);
      expect(response.status, `${request.method} ${new URL(request.url).pathname}`).toBe(status);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    }
    expect(state.sessions).toHaveLength(0);
    expect(state.throttles.size).toBe(0);
    expect(state.signerRequests()).toBe(0);
  });

  it("normalizes unexpected errors without disclosing internal details", async () => {
    const state = fakeEnvironment();
    state.env.APP_DB = {
      prepare() {
        throw new Error("private database details");
      },
    } as unknown as typeof state.env.APP_DB;

    const response = await handleAppApiRequest(new Request("https://app.test/api/v1/tags/ab12cd/content", { headers: { cookie: "myqr24_tag_access=invalid" } }), state.env);
    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.text()).toBe("Not Found");
  });
});