import { describe, expect, it } from "vitest";
import { sha256Hex } from "../workers/tag-content/canonical";
import { publishTagContent, type PublishEnv } from "../workers/tag-content/publish";

const SECRET = "publish-secret";
const TAG_ID = "ab12cd";
const NUMERIC = "623187229";

const HEX_COLORS = {
  background: "#ffffff",
  surface: "#fafafa",
  text: "#111111",
  mutedText: "#666666",
  heading: "#111111",
  accent: "#2b6cb0",
  accentText: "#ffffff",
  border: "#dddddd",
};

function template(): Record<string, unknown> {
  return {
    schema: "myqr24-tag-content-template-v1",
    schemaVersion: 4,
    template: {
      templateId: "tct_test_vault",
      templateVersion: 1,
      tagType: "vault",
      name: "Test-TAG",
      locale: "de-DE",
      status: "draft",
    },
    shell: {
      presentation: "standard",
      features: ["vault"],
      theme: { colorMode: "light", colors: { ...HEX_COLORS } },
    },
    layout: {
      mode: "grid-flow",
      columns: 12,
      gap: "md",
      responsive: {
        autoReflow: true,
        minColumnWidth: { desktop: "18rem" },
        preferredColumns: { desktop: 2 },
      },
    },
    elements: [
      {
        elementId: "cel_theme",
        elementType: "theme-assets",
        displayOrder: 0,
        visibility: "public",
        hidden: true,
        items: { mode: "none" },
        payload: { role: "background" },
        slots: [{ slotId: "tag-background", accepts: ["image"], min: 0, max: 1, required: false }],
      },
      {
        elementId: "cel_hero",
        elementType: "hero",
        displayOrder: 10,
        visibility: "public",
        items: { mode: "none" },
        payload: { variant: "cover" },
        bindings: { title: { from: "tag.displayName" } },
        content: { paragraphs: [{ runs: [{ text: "Willkommen" }] }] },
        slots: [{ slotId: "cover", accepts: ["image"], min: 0, max: 1, required: false }],
      },
      {
        elementId: "cel_text",
        elementType: "text",
        displayOrder: 20,
        visibility: "public",
        items: { mode: "none" },
        payload: {},
        content: {
          paragraphs: [
            { heading: 2, runs: [{ text: "Über uns" }] },
            { runs: [{ text: "Ein Text mit " }, { text: "Fett", marks: [{ type: "bold" }] }] },
          ],
        },
      },
      {
        elementId: "cel_gallery",
        elementType: "gallery",
        displayOrder: 30,
        visibility: "public",
        items: { mode: "dynamic", slotIds: ["images"] },
        payload: { name: "Galerie" },
        slots: [{ slotId: "images", accepts: ["image"], min: 0, max: 48, required: false }],
        actions: { upload: { enabled: true, principals: ["guest", "owner"], afterUpload: "quarantine" } },
      },
      {
        elementId: "cel_docs",
        elementType: "documents",
        displayOrder: 40,
        visibility: "shared",
        items: { mode: "dynamic", slotIds: ["documents"] },
        payload: { view: "list" },
        slots: [{ slotId: "documents", accepts: ["document"], min: 0, max: 32, required: false }],
      },
    ],
  };
}

interface State {
  routing: { tag_id: string; status: string; target_type: string; content_revision: number } | null;
  content: {
    tag_numeric_id: number;
    tag_base36_id: string;
    content_revision: number;
    content_sha256: string;
  } | null;
  r2: Map<string, string>;
  batch: Array<{ sql: string; values: unknown[] }>;
  puts: number;
  batchChanges: number;
  batchThrows: boolean;
  /** Bestehende Elementzeilen in D1. */
  elementIds: string[];
  /** Zuordnungen je Element (Item-Zahl). */
  itemCounts: Record<string, number>;
  /** Ergebnis des DELETE-Statements (für den Race-Test). */
  deleteChanges: number;
}

function state(overrides: Partial<State> = {}): State {
  return {
    routing: { tag_id: TAG_ID, status: "active", target_type: "internal", content_revision: 1 },
    content: null,
    r2: new Map(),
    batch: [],
    puts: 0,
    batchChanges: 1,
    batchThrows: false,
    elementIds: [],
    itemCounts: {},
    deleteChanges: 1,
    ...overrides,
  };
}

function env(current: State): PublishEnv {
  const prepare = (sql: string) => ({
    bind(...values: unknown[]) {
      return {
        sql,
        values,
        async first() {
          if (sql.includes("FROM tag_routing")) return current.routing;
          if (sql.includes("FROM tag_content")) return current.content;
          return null;
        },
        async all() {
          if (sql.includes("FROM tag_content_elements")) {
            return { results: current.elementIds.map((elementId) => ({ content_element_id: elementId })) };
          }
          if (sql.includes("FROM tag_content_element_items")) {
            return {
              results: Object.entries(current.itemCounts).map(([elementId, itemCount]) => ({
                content_element_id: elementId,
                item_count: itemCount,
              })),
            };
          }
          return { results: [] };
        },
        async run() {
          return { success: true, meta: { changes: 1 } };
        },
      };
    },
  });

  const database = {
    prepare,
    async batch(statements: Array<{ sql: string; values: unknown[] }>) {
      if (current.batchThrows) throw new Error("d1 down");
      for (const statement of statements) {
        current.batch.push({ sql: statement.sql, values: statement.values });
        if (statement.sql.startsWith("INSERT INTO tag_content ")
          || statement.sql.startsWith("UPDATE tag_content ")) {
          const values = statement.values;
          current.content = {
            tag_numeric_id: values[0] as number,
            tag_base36_id: values[1] as string,
            content_revision: values[2] as number,
            content_sha256: values[5] as string,
          };
        }
        if (statement.sql.startsWith("UPDATE tag_routing ")) {
          const revision = statement.values[0] as number;
          if (current.routing) current.routing = { ...current.routing, content_revision: revision };
        }
      }
      return statements.map((_, index) => ({
        success: true,
        meta: {
          changes: statements[index].sql.startsWith("DELETE FROM tag_content_elements")
            ? current.deleteChanges === 0
              ? 0
              : Math.max(1, statements[index].values.length - 1)
            : index === 0
              ? current.batchChanges
              : 1,
        },
      }));
    },
  };

  const bucket = {
    async put(key: string, value: string) {
      current.puts += 1;
      current.r2.set(key, value);
      return {};
    },
  };

  return {
    APP_DB: database,
    PRIVATE_CONTENT: bucket,
    APP_CONTENT_PUBLISH_KEY_S01: SECRET,
  } as unknown as PublishEnv;
}

function body(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { tagId: TAG_ID, tagNumericId: NUMERIC, template: template(), ...overrides };
}

function request(
  payload: unknown,
  options: { token?: string | null; contentType?: string } = {},
): Request {
  const headers: Record<string, string> = { "content-type": options.contentType ?? "application/json" };
  const token = options.token === undefined ? SECRET : options.token;
  if (token !== null) headers.authorization = `Bearer ${token}`;
  return new Request(`https://app.test/api/v1/tags/${TAG_ID}/content`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
}

async function call(
  current: State,
  payload: unknown,
  options?: { token?: string | null; contentType?: string },
) {
  const response = await publishTagContent(request(payload, options), env(current), TAG_ID);
  const json = (await response.json()) as Record<string, unknown>;
  return { response, json };
}

function withElement(patch: Record<string, unknown>, index = 1): Record<string, unknown> {
  const document = template();
  const elements = document.elements as Array<Record<string, unknown>>;
  elements[index] = { ...elements[index], ...patch };
  return document;
}

describe("PUT /api/v1/tags/{tagId}/content", () => {
  it("legt beim ersten Publish Revision 1 an und schreibt genau ein R2-Objekt", async () => {
    const current = state();
    const { response, json } = await call(current, body());

    expect(response.status).toBe(201);
    expect(json).toMatchObject({ status: "created", revision: 1, unchanged: false });
    expect(current.puts).toBe(1);
    expect([...current.r2.keys()]).toEqual([`content/v1/tags/${NUMERIC}/tag-rev1.json`]);

    const statements = current.batch.map((entry) => entry.sql);
    expect(statements.some((sql) => sql.startsWith("INSERT INTO tag_content "))).toBe(true);
    expect(statements.some((sql) => sql.startsWith("UPDATE tag_routing "))).toBe(true);

    const elementInserts = current.batch.filter((entry) => entry.sql.startsWith("INSERT INTO tag_content_elements "));
    expect(elementInserts.map((entry) => entry.values[1])).toEqual(["cel_gallery", "cel_docs"]);
    expect(elementInserts.map((entry) => entry.values[1])).not.toContain("cel_theme");
    expect(elementInserts.map((entry) => entry.values[1])).not.toContain("cel_text");
    expect(elementInserts.every((entry) => entry.values.length === 5)).toBe(true);
    expect(elementInserts.every((entry) => !/content_(?:file|sha256|bytes|type)/.test(entry.sql))).toBe(true);
    expect(json.itemElementIds).toEqual(["cel_gallery", "cel_docs"]);
  });

  it("erhöht die Revision bei inhaltlichen Änderungen", async () => {
    const current = state();
    await call(current, body());
    const second = await call(current, body({ tagName: "Neuer Name" }));
    expect(second.response.status).toBe(200);
    expect(second.json).toMatchObject({ status: "updated", revision: 2, unchanged: false });
    expect([...current.r2.keys()]).toContain(`content/v1/tags/${NUMERIC}/tag-rev2.json`);
  });

  it("meldet identische Uploads als unchanged ohne Schreibzugriff", async () => {
    const current = state();
    await call(current, body());
    const putsBefore = current.puts;
    const statementsBefore = current.batch.length;

    const { response, json } = await call(current, body());
    expect(response.status).toBe(200);
    expect(json).toMatchObject({ status: "unchanged", unchanged: true, revision: 1 });
    expect(current.puts).toBe(putsBefore);
    expect(current.batch.length).toBe(statementsBefore);
  });

  it("weist fehlende oder falsche Publisher-Credentials ab", async () => {
    const current = state();
    const withoutToken = await call(current, body(), { token: null });
    expect(withoutToken.response.status).toBe(401);
    const wrongToken = await call(current, body(), { token: "falsch" });
    expect(wrongToken.response.status).toBe(401);
    expect(current.puts).toBe(0);
    expect(current.batch).toEqual([]);
  });

  it("liefert 404 für unbekannte oder inaktive TAGs", async () => {
    const missing = await call(state({ routing: null }), body());
    expect(missing.response.status).toBe(404);

    const inactive = await call(
      state({ routing: { tag_id: TAG_ID, status: "suspended", target_type: "internal", content_revision: 1 } }),
      body(),
    );
    expect(inactive.response.status).toBe(404);
  });

  it("verlangt dieselbe tagId in Pfad und Body", async () => {
    const { response } = await call(state(), body({ tagId: "zz99zz" }));
    expect(response.status).toBe(400);
  });

  it("weist nicht-kanonische Big-Int-IDs ab", async () => {
    expect((await call(state(), body({ tagNumericId: "0123" }))).response.status).toBe(400);
    expect((await call(state(), body({ tagNumericId: "abc" }))).response.status).toBe(400);
  });

  it("blockiert abweichende Base36-/Big-Int-Zuordnung", async () => {
    const current = state({
      content: { tag_numeric_id: 999, tag_base36_id: TAG_ID, content_revision: 1, content_sha256: "a".repeat(64) },
    });
    const { response, json } = await call(current, body());
    expect(response.status).toBe(409);
    expect((json.error as { code: string }).code).toBe("tag_identity_mismatch");
    expect(current.puts).toBe(0);
  });

  it("prüft expectedRevision", async () => {
    const current = state();
    const first = await call(current, body({ expectedRevision: 1 }));
    expect(first.response.status).toBe(409);

    await call(current, body());
    const stale = await call(current, body({ expectedRevision: 5 }));
    expect(stale.response.status).toBe(409);
    expect((stale.json.error as { code: string }).code).toBe("revision_conflict");
  });

  it("weist zu große Anfragen ab", async () => {
    const { response } = await call(state(), body({ padding: "x".repeat(140_000) }));
    expect(response.status).toBe(413);
  });

  it("verlangt application/json", async () => {
    const { response } = await call(state(), body(), { contentType: "text/plain" });
    expect(response.status).toBe(415);
  });

  it("meldet doppelte Element-IDs", async () => {
    const document = template();
    const elements = document.elements as Array<Record<string, unknown>>;
    elements.push({ ...elements[1] });
    const { response, json } = await call(state(), body({ template: document }));
    expect(response.status).toBe(422);
    expect(JSON.stringify(json)).toContain("ELEMENT_ID_DUPLICATE");
  });

  it("meldet unbekannte Elementtypen", async () => {
    const { response, json } = await call(state(), body({ template: withElement({ elementType: "schedule" }) }));
    expect(response.status).toBe(422);
    expect(JSON.stringify(json)).toContain("ELEMENT_TYPE_UNKNOWN");
  });

  it("prüft Tabellenlimits", async () => {
    const table = {
      type: "table",
      columns: Array.from({ length: 7 }, () => ({ align: "start" })),
      rows: [{ cells: Array.from({ length: 7 }, () => ({ runs: [{ text: "x" }] })) }],
    };
    const { response, json } = await call(state(), body({ template: withElement({ content: { paragraphs: [table] } }) }));
    expect(response.status).toBe(422);
    expect(JSON.stringify(json)).toContain("TABLE_COLUMNS_INVALID");
  });

  it("blockiert HTML und javascript:-Ziele", async () => {
    const html = withElement({ content: { paragraphs: [{ runs: [{ text: "<script>alert(1)</script>" }] }] } });
    const htmlResult = await call(state(), body({ template: html }));
    expect(htmlResult.response.status).toBe(422);
    expect(JSON.stringify(htmlResult.json)).toContain("POLICY_HTML_MARKUP");

    const script = withElement({
      content: { paragraphs: [{ runs: [{ text: "Link", link: { href: "javascript:alert(1)" } }] }] },
    });
    const scriptResult = await call(state(), body({ template: script }));
    expect(scriptResult.response.status).toBe(422);
    expect(JSON.stringify(scriptResult.json)).toContain("POLICY_SCRIPT_URL");
  });

  it("blockiert Storage-Keys im Template", async () => {
    const document = withElement({
      content: { paragraphs: [{ runs: [{ text: "x" }], objectKey: "content/v1/x" }] },
    });
    const { response, json } = await call(state(), body({ template: document }));
    expect(response.status).toBe(422);
    expect(JSON.stringify(json)).toContain("POLICY_STORAGE_KEY");
  });

  it("legt Galerie und Dokumente mit Typ, Reihenfolge und Sichtbarkeit an", async () => {
    const current = state();
    await call(current, body());
    const rows = current.batch
      .filter((entry) => entry.sql.startsWith("INSERT INTO tag_content_elements "))
      .map((entry) => ({
        id: entry.values[1],
        type: entry.values[2],
        order: entry.values[3],
        visibility: entry.values[4],
      }));
    expect(rows).toEqual([
      { id: "cel_gallery", type: "gallery", order: 30, visibility: "public" },
      { id: "cel_docs", type: "documents", order: 40, visibility: "shared" },
    ]);
  });

  it("schreibt view und elements in ein Dokument", async () => {
    const current = state();
    await call(current, body({ tagName: "Mein TAG" }));
    const raw = [...current.r2.values()][0];
    const document = JSON.parse(raw) as Record<string, any>;

    expect(document.schema).toBe("myqr24-tag-content-v2");
    expect(document.view.tag).toEqual({ id: TAG_ID, displayName: "Mein TAG", presentation: "standard" });
    expect(document.view.vault.blocks.map((block: { type: string }) => block.type)).toEqual([
      "hero",
      "text",
      "gallery",
      "documents",
    ]);
    expect(document.view.vault.blocks[2].images).toEqual([]);
    expect(document.view.vault.blocks[2]).toMatchObject({
      elementId: "cel_gallery",
      visibility: "public",
      items: { mode: "dynamic" },
    });
    expect(document.view.vault.blocks[3].documents).toEqual([]);
    expect(document.elements.map((element: { elementId: string }) => element.elementId)).toEqual([
      "cel_hero",
      "cel_text",
      "cel_gallery",
      "cel_docs",
    ]);
    expect(document.elements[2].payload.slots[0].max).toBe(48);
    expect(document.elements[2].payload.items).toEqual({ mode: "dynamic", slotIds: ["images"] });
    expect(document.elements[0].payload.items).toEqual({ mode: "none" });
    expect(raw).not.toContain("objectKey");
    expect(raw).not.toContain("content/v1/");
  });

  it("berechnet Hash und Bytes über das kanonische Dokument", async () => {
    const current = state();
    const { json } = await call(current, body());
    const raw = [...current.r2.values()][0];
    expect(await sha256Hex(raw)).toBe(json.contentSha256);
    expect(new TextEncoder().encode(raw).length).toBe(json.contentBytes);
    expect(String(json.contentSha256)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("löscht beim Re-Publish nur entfallene Elemente ohne Inhalte", async () => {
    const current = state({
      elementIds: ["cel_gallery", "cel_docs"],
      itemCounts: { cel_gallery: 3 },
    });
    await call(current, body());
    current.batch = [];

    const reduced = template();
    reduced.elements = (reduced.elements as Array<Record<string, unknown>>).filter(
      (element) => element.elementId !== "cel_docs",
    );
    const { response } = await call(current, body({ template: reduced }));
    expect(response.status).toBe(200);

    const deletion = current.batch.find((entry) => entry.sql.startsWith("DELETE FROM tag_content_elements"));
    expect(deletion?.sql).toContain("IN (?2)");
    expect(deletion?.sql).toContain("NOT EXISTS");
    expect(deletion?.values).toEqual([623187229, "cel_docs"]);
  });

  it("verweigert das Entfernen von Elementen mit Inhalten", async () => {
    const current = state({
      elementIds: ["cel_hero", "cel_text", "cel_gallery", "cel_docs"],
      itemCounts: { cel_gallery: 3 },
    });
    await call(current, body());
    const putsBefore = current.puts;
    current.batch = [];

    const reduced = template();
    reduced.elements = (reduced.elements as Array<Record<string, unknown>>).filter(
      (element) => element.elementId !== "cel_gallery",
    );
    const { response, json } = await call(current, body({ template: reduced }));

    expect(response.status).toBe(409);
    const error = json.error as { code: string; elements: Array<{ elementId: string; itemCount: number }> };
    expect(error.code).toBe("elements_in_use");
    expect(error.elements).toEqual([{ elementId: "cel_gallery", itemCount: 3 }]);
    expect(current.puts).toBe(putsBefore);
    expect(current.batch).toEqual([]);
  });

  it("überschreibt ein Element bei geändertem Anzeigenamen ohne Löschen", async () => {
    const current = state({ elementIds: ["cel_gallery", "cel_docs"] });
    await call(current, body());
    current.batch = [];

    const renamed = template();
    const elements = renamed.elements as Array<Record<string, unknown>>;
    elements[3] = { ...elements[3], payload: { view: "list", title: "Unterlagen" } };
    const { response } = await call(current, body({ template: renamed }));

    expect(response.status).toBe(200);
    expect(current.batch.some((entry) => entry.sql.startsWith("DELETE FROM tag_content_elements"))).toBe(false);
    expect(current.batch.filter((entry) => entry.sql.startsWith("INSERT INTO tag_content_elements"))).toHaveLength(2);
  });

  it("fügt neue Elemente hinzu", async () => {
    const current = state({ elementIds: ["cel_gallery", "cel_docs"] });
    await call(current, body());
    current.batch = [];

    const extended = template();
    (extended.elements as Array<Record<string, unknown>>).push({
      elementId: "cel_extra",
      elementType: "image",
      displayOrder: 50,
      visibility: "public",
      items: { mode: "dynamic", slotIds: ["image"] },
      payload: {},
      slots: [{ slotId: "image", accepts: ["image"], min: 0, max: 12, required: false }],
    });
    const { response } = await call(current, body({ template: extended }));

    expect(response.status).toBe(200);
    const upserts = current.batch.filter((entry) => entry.sql.startsWith("INSERT INTO tag_content_elements"));
    expect(upserts.map((entry) => entry.values[1])).toContain("cel_extra");
    expect(current.batch.some((entry) => entry.sql.startsWith("DELETE FROM tag_content_elements"))).toBe(false);
  });

  it("legt für statische Elemente keine Zeile an und räumt Altzeilen auf", async () => {
    const current = state({ elementIds: ["cel_hero", "cel_text", "cel_gallery", "cel_docs"] });
    await call(current, body());
    current.batch = [];
    await call(current, body({ tagName: "Neuer Name" }));

    const inserts = current.batch.filter((entry) => entry.sql.startsWith("INSERT INTO tag_content_elements"));
    expect(inserts.map((entry) => entry.values[1])).toEqual(["cel_gallery", "cel_docs"]);

    const deletion = current.batch.find((entry) => entry.sql.startsWith("DELETE FROM tag_content_elements"));
    expect(deletion?.values).toEqual([623187229, "cel_hero", "cel_text"]);
  });

  it("erkennt einen Löschkonflikt durch zwischenzeitliche Inhalte", async () => {
    const current = state({
      elementIds: ["cel_hero", "cel_text", "cel_gallery", "cel_docs"],
      deleteChanges: 0,
    });
    await call(current, body());

    const reduced = template();
    reduced.elements = (reduced.elements as Array<Record<string, unknown>>).filter(
      (element) => element.elementId !== "cel_docs",
    );
    const { response, json } = await call(current, body({ template: reduced }));

    expect(response.status).toBe(409);
    expect((json.error as { code: string }).code).toBe("elements_in_use");
  });

  it("hält Revision in Dokument, tag_content und tag_routing gleich", async () => {
    const current = state();
    await call(current, body());
    await call(current, body({ tagName: "Zweite Fassung" }));

    const raw = [...current.r2.values()].at(-1)!;
    const document = JSON.parse(raw) as { revision: number };
    expect(document.revision).toBe(2);
    expect(current.content?.content_revision).toBe(2);
    expect(current.routing?.content_revision).toBe(2);
  });

  it("antwortet 500 ohne D1-Schreiben, wenn der Batch scheitert", async () => {
    const current = state({ batchThrows: true });
    const { response, json } = await call(current, body());
    expect(response.status).toBe(500);
    expect((json.error as { code: string }).code).toBe("internal");
    expect(current.batch).toEqual([]);
    expect(current.puts).toBe(1);
  });

  it("gibt weder Storage-Keys noch Secrets in der Antwort preis", async () => {
    const { json } = await call(state(), body());
    const text = JSON.stringify(json);
    expect(text).not.toContain("content/v1/");
    expect(text).not.toContain(SECRET);
  });
});


