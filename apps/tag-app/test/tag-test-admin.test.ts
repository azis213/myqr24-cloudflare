import { describe, expect, it, vi } from "vitest";
import { handleTagTestAdminRequest } from "../workers/tag-test-admin";

function makeEnv(options: { failR2?: boolean } = {}) {
  const sqlCalls: Array<{ sql: string; values: unknown[] }> = [];
  const deletedR2: string[][] = [];
  const batchStatements: Array<{ sql?: string; values?: unknown[] }> = [];
  const env = {
    TAG_TEST_ADMIN_ENVIRONMENT: "staging",
    TAG_TEST_ADMIN_KEY_S01: "test-admin-secret",
    APP_DB: {
      prepare(sql: string) {
        return {
          bind(...values: unknown[]) {
            return {
              sql,
              values,
              async first() {
                sqlCalls.push({ sql, values });
                if (sql.includes("FROM tag_content WHERE tag_numeric_id = ?1 OR tag_base36_id = ?2")) {
                  return { tag_numeric_id: 623187229, tag_base36_id: "ab12cd" };
                }
                return null;
              },
              async run() {
                sqlCalls.push({ sql, values });
                return { meta: { changes: 1 } };
              },
            };
          },
        };
      },
      async batch(statements: Array<{ sql?: string; values?: unknown[] }>) {
        batchStatements.push(...statements);
        return [];
      },
    },
    PRIVATE_CONTENT: {
      async list({ prefix }: { prefix: string }) {
        expect(prefix).toBe("content/v1/tags/623187229/");
        return {
          objects: [{ key: `${prefix}tag-rev1.json` }, { key: `${prefix}items/1/photo.png` }],
          truncated: false,
        };
      },
      async delete(keys: string[]) {
        if (options.failR2) throw new Error("simulated R2 failure");
        deletedR2.push(keys);
      },
    },
  };
  return { env: env as never, sqlCalls, deletedR2, batchStatements };
}

function deleteRequest(confirm: string) {
  return new Request("https://staging.example.test/api/test-admin/tags/ab12cd", {
    method: "DELETE",
    headers: { authorization: "Bearer test-admin-secret", "content-type": "application/json" },
    body: JSON.stringify({ tagNumericId: "623187229", confirm }),
  });
}

describe("test-only TAG routing administration", () => {
  it("removes TAG-owned R2 objects before D1 rows with environment-bound confirmation", async () => {
    const state = makeEnv();
    const response = await handleTagTestAdminRequest(deleteRequest("DELETE STAGING ab12cd"), state.env, "staging");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "deleted", environment: "staging", tagId: "ab12cd", tagNumericId: "623187229", deletedObjects: 2 });
    expect(state.deletedR2).toEqual([[
      "content/v1/tags/623187229/tag-rev1.json",
      "content/v1/tags/623187229/items/1/photo.png",
    ]]);
    expect(state.batchStatements.map((statement) => statement.sql)).toEqual(expect.arrayContaining([
      expect.stringContaining("DELETE FROM tag_content_element_items"),
      expect.stringContaining("DELETE FROM tag_content_items"),
      expect.stringContaining("DELETE FROM tag_content WHERE"),
      expect.stringContaining("DELETE FROM tag_routing"),
    ]));
    expect(state.sqlCalls.some((call) => call.sql.startsWith("UPDATE tag_routing SET status = 'deactivated'"))).toBe(true);
  });

  it("does not remove D1 rows when R2 deletion fails and leaves routing deactivated", async () => {
    const state = makeEnv({ failR2: true });
    const response = await handleTagTestAdminRequest(deleteRequest("DELETE STAGING ab12cd"), state.env, "staging");
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ deletedObjects: 0 });
    expect(state.batchStatements).toHaveLength(0);
    expect(state.sqlCalls.some((call) => call.sql.startsWith("UPDATE tag_routing SET status = 'deactivated'"))).toBe(true);
  });

  it("refuses deletion when the confirmation names a different environment", async () => {
    const state = makeEnv();
    const response = await handleTagTestAdminRequest(deleteRequest("DELETE LOCAL ab12cd"), state.env, "staging");
    expect(response.status).toBe(400);
    expect(state.deletedR2).toHaveLength(0);
    expect(state.batchStatements).toHaveLength(0);
  });
});