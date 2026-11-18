import { describe, expect, it } from "vitest";
import vaultTemplate from "../../public/templates/vault-standard.tagcontent.json";
import { DocumentError } from "./errors";
import { migrateDocument, type MigrationStep } from "./migrate";

describe("migrateDocument", () => {
  it("lässt Dokumente der aktuellen Version unverändert", () => {
    const result = migrateDocument(vaultTemplate);
    expect(result.migrated).toBe(false);
    expect(result.changes).toHaveLength(0);
    expect(result.from).toBe(2);
    expect(result.to).toBe(2);
  });

  it("überführt schemaVersion 1 (content.heading) in den Absatzfluss", () => {
    const legacy = structuredClone(vaultTemplate) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 1;
    const elements = legacy.elements as Array<Record<string, unknown>>;
    elements[0].content = { heading: "Willkommen", paragraphs: [{ runs: [{ text: "Text" }] }] };

    const result = migrateDocument(legacy);
    expect(result.migrated).toBe(true);
    expect(result.from).toBe(1);
    expect(result.to).toBe(2);
    expect(result.changes.length).toBeGreaterThan(0);

    const content = (result.document.elements as Array<Record<string, unknown>>)[0].content as {
      heading?: string;
      paragraphs: Array<{ heading?: number; runs: Array<{ text: string }> }>;
    };
    expect(content.heading).toBeUndefined();
    expect(content.paragraphs[0].heading).toBe(3);
    expect(content.paragraphs[0].runs[0].text).toBe("Willkommen");
    expect(content.paragraphs[1].runs[0].text).toBe("Text");
  });

  it("lehnt neuere Versionen erklärend ab", () => {
    const doc = { ...structuredClone(vaultTemplate), schemaVersion: 3 };
    expect(() => migrateDocument(doc)).toThrowError(DocumentError);
    try {
      migrateDocument(doc);
    } catch (error) {
      expect((error as DocumentError).code).toBe("SCHEMA_TOO_NEW");
    }
  });

  it("bricht ab, wenn eine Migrationsstufe fehlt", () => {
    const doc = { ...structuredClone(vaultTemplate), schemaVersion: 1 };
    try {
      migrateDocument(doc, [], 3);
      throw new Error("Migration hätte fehlschlagen müssen");
    } catch (error) {
      expect((error as DocumentError).code).toBe("MIGRATION_STEP_MISSING");
    }
  });

  it("führt kumulative Stufen aus und protokolliert Änderungen", () => {
    const steps: MigrationStep[] = [
      {
        from: 2,
        to: 3,
        description: "Beispielstufe",
        apply: (document) => ({
          document: { ...document, migratedFlag: true },
          changes: ["migratedFlag ergänzt"],
        }),
      },
    ];
    const result = migrateDocument(vaultTemplate, steps, 3);
    expect(result.migrated).toBe(true);
    expect(result.to).toBe(3);
    expect(result.changes).toEqual(["migratedFlag ergänzt"]);
    expect((result.document as { migratedFlag?: boolean }).migratedFlag).toBe(true);
  });

  it("lehnt Dokumente ohne schemaVersion ab", () => {
    try {
      migrateDocument({ schema: "myqr24-tag-content-template-v1" });
      throw new Error("Migration hätte fehlschlagen müssen");
    } catch (error) {
      expect((error as DocumentError).code).toBe("SCHEMA_VERSION_MISSING");
    }
  });
});
