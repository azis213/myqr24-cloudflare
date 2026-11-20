import { describe, expect, it } from "vitest";
import type { PublisherEnv } from "../workers/tag-content/http";
import { getTagContentDocument } from "../workers/tag-content/read";

const TAG_ID = "ab12cd";
const NUMERIC = 623187229;
const SECRET = "publish-secret";
const SHA = "b".repeat(64);

function document(revision = 2): Record<string, unknown> {
  return {
    schema: "myqr24-tag-content-v2",
    tagNumericId: String(NUMERIC),
    tagId: TAG_ID,
    revision,
    view: {
      tag: { id: TAG_ID, displayName: "Test", presentation: "standard" },
      vault: { blocks: [] },
      enabledFeatures: ["vault"],
    },
    elements: [{ elementId: "cel_text", elementType: "text", payload: { options: {} } }],
  };
}

function environment(options: { exists?: boolean; text?: string; bytes?: number } = {}) {
  const text = options.text ?? JSON.stringify(document());
  const row = options.exists === false
    ? null
    : {
        tag_numeric_id: NUMERIC,
        tag_base36_id: TAG_ID,
        content_revision: 2,
        content_file: "tag-rev2.json",
        content_sha256: SHA,
        content_bytes: options.bytes ?? new TextEncoder().encode(text).length,
      };
  const keys: string[] = [];
  const db = {
    prepare(sql: string) {
      return {
        bind() {
          return {
            async first() {
              return sql.includes("FROM tag_content") ? row : null;
            },
          };
        },
      };
    },
  };
  const bucket = {
    async get(key: string) {
      keys.push(key);
      if (!row) return null;
      return { text: async () => text };
    },
  };
  const env = {
    APP_DB: db,
    PRIVATE_CONTENT: bucket,
    APP_CONTENT_PUBLISH_KEY_S01: SECRET,
  } as unknown as PublisherEnv;
  return { env, keys, text };
}

function request(headers: Record<string, string> = {}): Request {
  return new Request(`https://app.test/api/v1/tags/${TAG_ID}/content/document`, {
    headers: { authorization: `Bearer ${SECRET}`, ...headers },
  });
}

describe("GET /api/v1/tags/{tagId}/content/document", () => {
  it("liefert das gespeicherte Dokument byte-identisch mit Revision und ETag", async () => {
    const { env, keys, text } = environment();
    const response = await getTagContentDocument(request(), env, TAG_ID);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("etag")).toBe(`"${SHA}"`);
    expect(response.headers.get("x-content-revision")).toBe("2");
    expect(response.headers.get("x-content-bytes")).toBe(String(new TextEncoder().encode(text).length));
    expect(response.headers.get("cache-control")).toBe("no-store");

    const body = await response.text();
    expect(body).toBe(text);
    expect((JSON.parse(body) as { revision: number }).revision).toBe(2);
    expect(keys).toEqual([`content/v1/tags/${NUMERIC}/tag-rev2.json`]);
  });

  it("antwortet 304 bei passendem If-None-Match", async () => {
    const { env } = environment();
    const response = await getTagContentDocument(request({ "if-none-match": `"${SHA}"` }), env, TAG_ID);
    expect(response.status).toBe(304);
    expect(response.headers.get("etag")).toBe(`"${SHA}"`);
  });

  it("verlangt das Publisher-Secret", async () => {
    const { env } = environment();
    const response = await getTagContentDocument(
      new Request(`https://app.test/api/v1/tags/${TAG_ID}/content/document`),
      env,
      TAG_ID,
    );
    expect(response.status).toBe(401);
  });

  it("liefert 404, wenn kein Stand oder kein Objekt existiert", async () => {
    const missing = await getTagContentDocument(request(), environment({ exists: false }).env, TAG_ID);
    expect(missing.status).toBe(404);
    expect(((await missing.json()) as { error: { code: string } }).error.code).toBe("content_not_found");

    const broken = environment();
    (broken.env as unknown as { PRIVATE_CONTENT: { get: () => Promise<null> } }).PRIVATE_CONTENT.get = async () => null;
    const noObject = await getTagContentDocument(request(), broken.env, TAG_ID);
    expect(noObject.status).toBe(404);
  });

  it("weist ungültige TAG-IDs ab", async () => {
    const { env } = environment();
    const response = await getTagContentDocument(request(), env, "zz");
    expect(response.status).toBe(400);
  });

  it("meldet inkonsistente Bytes als Fehler", async () => {
    const { env } = environment({ bytes: 1 });
    const response = await getTagContentDocument(request(), env, TAG_ID);
    expect(response.status).toBe(500);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("internal");
  });
});
