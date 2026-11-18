import { describe, expect, it } from "vitest";
import vaultTemplate from "../../public/templates/vault-standard.tagcontent.json";
import { DocumentError } from "./errors";
import { migrateDocument, type MigrationStep } from "./migrate";

describe("migrateDocument", () => {
  it("lässt Dokumente der aktuellen Version unverändert", () => {
    const result = migrateDocument(vaultTemplate);
    expect(result.migrated).toBe(false);
    expect(result.changes).toHaveLength(0);
    expect(result.from).toBe(1);
    expect(result.to).toBe(1);
  });

  it("lehnt neuere Versionen erklärend ab", () => {
    const doc = { ...structuredClone(vaultTemplate), schemaVersion: 2 };
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
        from: 1,
        to: 2,
        description: "Beispielstufe",
        apply: (document) => ({
          document: { ...document, migratedFlag: true },
          changes: ["migratedFlag ergänzt"],
        }),
      },
    ];
    const result = migrateDocument(vaultTemplate, steps, 2);
    expect(result.migrated).toBe(true);
    expect(result.to).toBe(2);
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
