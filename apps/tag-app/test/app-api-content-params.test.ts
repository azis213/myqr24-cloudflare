import { describe, expect, it } from "vitest";
import { handleAppApiRequest } from "../workers/app-api";

const TAG_ID = "ab12cd";
const NUMERIC = 623187229;
const API_KEY = "content-api-test-key";
const SESSION_TOKEN = "test-token";

/**
 * Fake-Umgebung für die Content-Parametermatrix: ein TAG mit
 * - Gallery (public, zwei Items: ein sichtbares, ein ownerOnly),
 * - Einzelbild (public, zwei Kandidaten),
 * - Dokumentenliste (shared),
 * - privatem Text (ownerOnly).
 */
function environment(options: { scope?: "public" | "pin" } = {}) {
  const scope = options.scope ?? "public";
  const document = {
    schema: "myqr24-tag-content-v2",
    tagNumericId: String(NUMERIC),
    tagId: TAG_ID,
    revision: 2,
    view: {
      tag: { id: TAG_ID, displayName: "Test-TAG", presentation: "standard" },
      vault: {
        blocks: [
          { type: "gallery", elementId: "cel_gallery", visibility: "public", items: { mode: "dynamic" }, title: "Galerie", images: [] },
          { type: "text", elementId: "cel_shared", visibility: "shared", items: { mode: "none" }, title: "Geteilt" },
          { type: "text", elementId: "cel_private", visibility: "ownerOnly", items: { mode: "none" }, title: "Privat" },
        ],
      },
      enabledFeatures: ["vault"],
    },
    elements: [
      {
        elementId: "cel_gallery",
        elementType: "gallery",
        payload: {
          items: { mode: "dynamic", slotIds: ["images"] },
          slots: [{ slotId: "images", accepts: ["image"], min: 0, max: 48, required: false }],
        },
      },
      {
        elementId: "cel_image",
        elementType: "image",
        payload: {
          items: { mode: "dynamic", slotIds: ["image"] },
          slots: [{ slotId: "image", accepts: ["image"], min: 0, max: 12, required: false }],
        },
      },
      {
        elementId: "cel_docs",
        elementType: "documents",
        payload: {
          items: { mode: "dynamic", slotIds: ["documents"] },
          slots: [{ slotId: "documents", accepts: ["document"], min: 0, max: 32, required: false }],
        },
      },
      { elementId: "cel_private", elementType: "text", payload: { items: { mode: "none" } } },
    ],
  };

  const elementRows = [
    { content_element_id: "cel_gallery", content_element_type: "gallery", display_order: 10, visibility: "public" },
    { content_element_id: "cel_image", content_element_type: "image", display_order: 20, visibility: "public" },
    { content_element_id: "cel_docs", content_element_type: "documents", display_order: 30, visibility: "shared" },
    { content_element_id: "cel_private", content_element_type: "text", display_order: 40, visibility: "ownerOnly" },
  ];

  const itemRows = [
    { elementId: "cel_gallery", contentId: 1850000000000001, type: "image", visibility: "public", displayOrder: 0, createdAt: "2026-11-20T10:00:00.000Z" },
    { elementId: "cel_gallery", contentId: 1850000000000002, type: "image", visibility: "ownerOnly", displayOrder: 1, createdAt: "2026-11-21T10:00:00.000Z" },
    { elementId: "cel_image", contentId: 1850000000000003, type: "image", visibility: "ownerOnly", displayOrder: 0, createdAt: "2026-11-19T10:00:00.000Z" },
    { elementId: "cel_image", contentId: 1850000000000004, type: "image", visibility: "public", displayOrder: 1, createdAt: "2026-11-22T10:00:00.000Z" },
    { elementId: "cel_docs", contentId: 1850000000000005, type: "document", visibility: "shared", displayOrder: 0, createdAt: "2026-11-18T10:00:00.000Z" },
    { elementId: "cel_private", contentId: 1850000000000006, type: "image", visibility: "ownerOnly", displayOrder: 0, createdAt: "2026-11-17T10:00:00.000Z" },
  ];

  const contentRow = {
    tag_numeric_id: NUMERIC,
    tag_base36_id: TAG_ID,
    content_revision: 2,
    content_file: "tag-rev2.json",
    content_sha256: "a".repeat(64),
    content_bytes: 1,
    content_type: "application/json",
  };


  const db = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async first() {
              if (sql.includes("FROM tag_access_sessions")) {
                return {
                  id: "session-1",
                  tag_id: TAG_ID,
                  access_version: 3,
                  scope,
                  expires_at: new Date(Date.now() + 60_000).toISOString(),
                  revoked_at: null,
                };
              }
              if (sql.includes("FROM tag_routing")) {
                return {
                  tag_id: TAG_ID,
                  status: "active",
                  target_type: "internal",
                  protection_mode: scope === "public" ? "public" : "pin_required",
                  access_version: 3,
                  content_revision: 2,
                };
              }
              if (sql.includes("FROM tag_content_elements")) {
                return elementRows.find((row) => row.content_element_id === values[1]) ?? null;
              }
              if (sql.includes("FROM tag_content")) return contentRow;
              return null;
            },
            async all() {
              if (sql.includes("FROM tag_content_element_items AS assignment")) {
                return {
                  results: itemRows.map((row) => ({
                    content_element_id: row.elementId,
                    content_id: row.contentId,
                    content_item_type: row.type,
                    title: null,
                    alt_text: row.elementId,
                    original_filename: `${row.contentId}.webp`,
                    display_order: row.displayOrder,
                    visibility: row.visibility,
                    created_at: row.createdAt,
                  })),
                };
              }
              if (sql.includes("FROM tag_content_elements")) return { results: elementRows };
              return { results: [] };
            },
          };
        },
      };
    },
  };

  const bucket = {
    async get(key: string) {
      if (key === `content/v1/tags/${NUMERIC}/tag-rev2.json`) {
        return { json: async () => document };
      }
      return null;
    },
  };

  return {
    env: {
      APP_DB: db,
      PRIVATE_CONTENT: bucket,
      APP_BOOTSTRAP_SECRET_S01: "bootstrap",
      APP_PIN_PEPPER_S01: "pepper",
      APP_MEDIA_SIGNER_KEY_S01: "signer",
      TAG_CONTENT_API_KEY_S01: API_KEY,
      MEDIA_SIGNER: { fetch: async () => Response.json({}) },
    } as never,
  };
}

function request(path: string, options: { session?: boolean; apiKey?: boolean } = {}): Request {
  const session = options.session ?? true;
  return new Request(`https://app.test${path}`, {
    headers: {
      ...(session ? { cookie: `myqr24_tag_access=${SESSION_TOKEN}` } : {}),
      ...(options.apiKey ? { authorization: `Bearer ${API_KEY}` } : {}),
    },
  });
}

describe("GET /api/v1/tags/{tagId}/content – Parametermatrix", () => {
  it("liefert ohne Parameter nur die sichtbarkeitsgefilterte View", async () => {
    const { env } = environment();
    const response = await handleAppApiRequest(request(`/api/v1/tags/${TAG_ID}/content`), env);
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.elements).toBeUndefined();
    const blocks = (body.view as { vault: { blocks: Array<{ elementId: string }> } }).vault.blocks;
    expect(blocks.map((block) => block.elementId)).toEqual(["cel_gallery"]);
    expect(response.headers.get("etag")).toBeTruthy();
  });

  it("gibt mit elements=true nur sichtbare Elemente ohne Items zurück", async () => {
    const { env } = environment();
    const response = await handleAppApiRequest(request(`/api/v1/tags/${TAG_ID}/content?elements=true`), env);
    const body = (await response.json()) as { elements: Array<{ id: string; items?: unknown; displayMode: string }> };
    expect(body.elements.map((element) => element.id)).toEqual(["cel_gallery", "cel_image"]);
    expect(body.elements.every((element) => element.items === undefined)).toBe(true);
    expect(body.elements[1].displayMode).toBe("single");
  });

  it("impliziert bei items=true die Elemente und liefert nur sichtbare Items", async () => {
    const { env } = environment();
    const response = await handleAppApiRequest(request(`/api/v1/tags/${TAG_ID}/content?items=true`), env);
    const body = (await response.json()) as {
      elements: Array<{ id: string; items: Array<{ contentId: string; visibility: string; mediaUrl: string }> }>;
    };
    expect(body.elements.map((element) => element.id)).toEqual(["cel_gallery", "cel_image"]);
    expect(body.elements[0].items.map((item) => item.contentId)).toEqual(["1850000000000001"]);
    expect(body.elements[1].items.map((item) => item.contentId)).toEqual(["1850000000000004"]);
    expect(body.elements[0].items[0].mediaUrl).toBe(`/api/v1/tags/${TAG_ID}/items/1850000000000001/media`);
  });

  it("weist ungültige oder widersprüchliche Parameter ab", async () => {
    const { env } = environment();
    expect((await handleAppApiRequest(request(`/api/v1/tags/${TAG_ID}/content?elements=yes`), env)).status).toBe(400);
    expect((await handleAppApiRequest(request(`/api/v1/tags/${TAG_ID}/content?elements=false&items=true`), env)).status).toBe(400);
    expect((await handleAppApiRequest(request(`/api/v1/tags/${TAG_ID}/content?viewAs=admin`), env)).status).toBe(400);
  });

  it("liefert 304 bei unverändertem ETag", async () => {
    const { env } = environment();
    const first = await handleAppApiRequest(request(`/api/v1/tags/${TAG_ID}/content?items=true`), env);
    const etag = first.headers.get("etag") ?? "";
    const second = await handleAppApiRequest(
      new Request(`https://app.test/api/v1/tags/${TAG_ID}/content?items=true`, {
        headers: { cookie: `myqr24_tag_access=${SESSION_TOKEN}`, "if-none-match": etag },
      }),
      env,
    );
    expect(second.status).toBe(304);
  });
});


describe("GET /api/v1/tags/{tagId}/content – viewAs", () => {
  it("erlaubt viewAs nur, wenn das Credential die Sicht deckt", async () => {
    const { env } = environment();
    const forbidden = await handleAppApiRequest(
      request(`/api/v1/tags/${TAG_ID}/content?elements=true&viewAs=owner`),
      env,
    );
    expect(forbidden.status).toBe(403);
    expect(((await forbidden.json()) as { error: { code: string } }).error.code).toBe("view_as_not_allowed");
  });

  it("verengt eine PIN-Session auf guest und zeigt shared-Elemente", async () => {
    const { env } = environment({ scope: "pin" });
    const response = await handleAppApiRequest(
      request(`/api/v1/tags/${TAG_ID}/content?elements=true&viewAs=guest`),
      env,
    );
    const body = (await response.json()) as { elements: Array<{ id: string }> };
    expect(body.elements.map((element) => element.id)).toEqual(["cel_gallery", "cel_image", "cel_docs"]);

    const asScanner = await handleAppApiRequest(
      request(`/api/v1/tags/${TAG_ID}/content?elements=true&viewAs=scanner`),
      env,
    );
    const scannerBody = (await asScanner.json()) as { elements: Array<{ id: string }> };
    expect(scannerBody.elements.map((element) => element.id)).toEqual(["cel_gallery", "cel_image"]);
  });

  it("gibt dem API-Key mit viewAs=owner auch ownerOnly-Inhalte", async () => {
    const { env } = environment();
    const response = await handleAppApiRequest(
      request(`/api/v1/tags/${TAG_ID}/content?items=true&viewAs=owner`, { apiKey: true, session: false }),
      env,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      view: { vault: { blocks: Array<{ elementId: string }> } };
      elements: Array<{ id: string; items: Array<{ contentId: string }> }>;
    };
    expect(body.view.vault.blocks.map((block) => block.elementId)).toEqual([
      "cel_gallery",
      "cel_shared",
      "cel_private",
    ]);
    expect(body.elements.map((element) => element.id)).toEqual([
      "cel_gallery",
      "cel_image",
      "cel_docs",
      "cel_private",
    ]);
    const gallery = body.elements.find((element) => element.id === "cel_gallery");
    expect(gallery?.items.map((item) => item.contentId)).toEqual([
      "1850000000000001",
      "1850000000000002",
    ]);
  });
});

describe("GET /api/v1/tags/{tagId}/elements/{elementId}/items", () => {
  it("liefert die sichtbaren Items eines Elements mit ETag", async () => {
    const { env } = environment();
    const response = await handleAppApiRequest(
      request(`/api/v1/tags/${TAG_ID}/elements/cel_image/items`),
      env,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      elementId: string;
      displayMode: string;
      itemsEtag: string;
      items: Array<{ contentId: string }>;
    };
    expect(body.elementId).toBe("cel_image");
    expect(body.displayMode).toBe("single");
    expect(body.items.map((item) => item.contentId)).toEqual(["1850000000000004"]);
    expect(body.itemsEtag).toBe(response.headers.get("etag"));

    const cached = await handleAppApiRequest(
      new Request(`https://app.test/api/v1/tags/${TAG_ID}/elements/cel_image/items`, {
        headers: { cookie: `myqr24_tag_access=${SESSION_TOKEN}`, "if-none-match": body.itemsEtag },
      }),
      env,
    );
    expect(cached.status).toBe(304);
  });

  it("liefert 404 für unsichtbare oder unbekannte Elemente", async () => {
    const { env } = environment();
    expect(
      (await handleAppApiRequest(request(`/api/v1/tags/${TAG_ID}/elements/cel_private/items`), env)).status,
    ).toBe(404);
    expect(
      (await handleAppApiRequest(request(`/api/v1/tags/${TAG_ID}/elements/cel_unknown/items`), env)).status,
    ).toBe(404);
  });

  it("liefert dem Owner auch ownerOnly-Items", async () => {
    const { env } = environment();
    const response = await handleAppApiRequest(
      request(`/api/v1/tags/${TAG_ID}/elements/cel_gallery/items?viewAs=owner`, { apiKey: true, session: false }),
      env,
    );
    const body = (await response.json()) as { items: Array<{ contentId: string; visibility: string }> };
    expect(body.items.map((item) => item.contentId)).toEqual(["1850000000000001", "1850000000000002"]);
    expect(body.items[1].visibility).toBe("ownerOnly");
  });
});

