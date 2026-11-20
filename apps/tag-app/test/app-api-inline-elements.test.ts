import { describe, expect, it } from "vitest";
import { handleAppApiRequest } from "../workers/app-api";

const TAG_ID = "ab12cd";
const NUMERIC = 623187229;

/**
 * Nach `D-14` enthält das Tag-Dokument die Element-Nutzlasten. Die Content-Route
 * darf dafür keine Element-Datei mehr anfragen.
 */
function environment() {
  const document = {
    schema: "myqr24-tag-content-v2",
    tagNumericId: String(NUMERIC),
    tagId: TAG_ID,
    revision: 2,
    view: {
      tag: { id: TAG_ID, displayName: "Test-TAG", presentation: "standard" },
      vault: { blocks: [{ type: "gallery", title: "Galerie", images: [] }] },
      enabledFeatures: ["vault"],
    },
    elements: [
      {
        elementId: "cel_gallery",
        elementType: "gallery",
        payload: {
          options: { name: "Galerie" },
          slots: [{ slotId: "images", accepts: ["image"], min: 0, max: 48, required: false }],
        },
      },
    ],
  };
  const text = JSON.stringify(document);
  const contentBytes = new TextEncoder().encode(text).length;
  const r2Gets: string[] = [];

  const db = {
    prepare(sql: string) {
      return {
        bind() {
          return {
            async first() {
              if (sql.includes("FROM tag_access_sessions")) {
                return {
                  id: "session-1",
                  tag_id: TAG_ID,
                  access_version: 3,
                  scope: "public",
                  expires_at: new Date(Date.now() + 60_000).toISOString(),
                  revoked_at: null,
                };
              }
              if (sql.includes("FROM tag_routing")) {
                return {
                  tag_id: TAG_ID,
                  status: "active",
                  target_type: "internal",
                  protection_mode: "public",
                  access_version: 3,
                  content_revision: 2,
                };
              }
              if (sql.includes("FROM tag_content WHERE tag_base36_id")) {
                return {
                  tag_numeric_id: NUMERIC,
                  tag_base36_id: TAG_ID,
                  content_revision: 2,
                  content_file: "tag-rev2.json",
                  content_sha256: "a".repeat(64),
                  content_bytes: contentBytes,
                  content_type: "application/json",
                };
              }
              return null;
            },
            async all() {
              if (sql.includes("FROM tag_content_elements")) {
                return {
                  results: [
                    {
                      content_element_id: "cel_gallery",
                      content_element_type: "gallery",
                      display_order: 10,
                      visibility: "public",
                    },
                  ],
                };
              }
              if (sql.includes("FROM tag_content_element_items")) return { results: [] };
              return { results: [] };
            },
          };
        },
      };
    },
  };

  const bucket = {
    async get(key: string) {
      r2Gets.push(key);
      if (key === `content/v1/tags/${NUMERIC}/tag-rev2.json`) {
        return { size: contentBytes, json: async () => document };
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
      MEDIA_SIGNER: { fetch: async () => Response.json({}) },
    } as never,
    r2Gets,
  };
}

function contentRequest(): Request {
  return new Request(`https://app.test/api/v1/tags/${TAG_ID}/content`, {
    method: "GET",
    headers: { cookie: "myqr24_tag_access=test-token" },
  });
}

describe("Content-Route mit Element-Nutzlast im Tag-Dokument", () => {
  it("liefert Elemente ohne zusätzliche Element-Datei", async () => {
    const { env, r2Gets } = environment();
    const response = await handleAppApiRequest(contentRequest(), env);
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      revision: number;
      view: { vault: { blocks: Array<{ type: string }> } };
      elements: Array<{ id: string; type: string; payload: { options?: { name?: string } } }>;
    };
    expect(body.revision).toBe(2);
    expect(body.view.vault.blocks).toEqual([{ type: "gallery", title: "Galerie", images: [] }]);
    expect(body.elements).toHaveLength(1);
    expect(body.elements[0]).toMatchObject({ id: "cel_gallery", type: "gallery" });
    expect(body.elements[0].payload.options?.name).toBe("Galerie");
    expect(r2Gets).toEqual([`content/v1/tags/${NUMERIC}/tag-rev2.json`]);
  });

  it("liefert neutral 404, wenn die Elementtyp-Angabe nicht zum D1-Eintrag passt", async () => {
    const { env } = environment();
    const bucket = (env as { PRIVATE_CONTENT: { get: (key: string) => Promise<unknown> } }).PRIVATE_CONTENT;
    const original = bucket.get;
    bucket.get = async (key: string) => {
      const object = (await original(key)) as { size: number; json: () => Promise<unknown> } | null;
      if (!object) return null;
      return {
        size: object.size,
        json: async () => {
          const document = (await object.json()) as Record<string, unknown>;
          (document.elements as Array<Record<string, unknown>>)[0].elementType = "documents";
          return document;
        },
      };
    };

    const response = await handleAppApiRequest(contentRequest(), env);
    expect(response.status).toBe(404);
  });
});
