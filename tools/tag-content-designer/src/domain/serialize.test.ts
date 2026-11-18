import { describe, expect, it } from "vitest";
import { canonicalize, documentFileName, libraryFileName, sha256Hex } from "./serialize";
import vaultTemplate from "../../public/templates/vault-standard.tagcontent.json";

describe("serialize", () => {
  it("sortiert Schlüssel kanonisch und endet mit einem Zeilenumbruch", () => {
    const text = canonicalize({ b: 1, a: 2 });
    expect(text).toBe('{\n  "a": 2,\n  "b": 1\n}\n');
  });

  it("ist idempotent (Export → Import → Export)", () => {
    const once = canonicalize(vaultTemplate);
    const twice = canonicalize(JSON.parse(once));
    expect(twice).toBe(once);
  });

  it("erzeugt einen stabilen SHA-256-Hash", async () => {
    const text = canonicalize(vaultTemplate);
    const first = await sha256Hex(text);
    const second = await sha256Hex(text);
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it("ändert den Hash bei inhaltlicher Änderung", async () => {
    const base = structuredClone(vaultTemplate) as unknown as { template: { name: string } };
    const changed = structuredClone(base);
    changed.template.name = `${base.template.name} (Variante)`;
    expect(await sha256Hex(canonicalize(base))).not.toBe(await sha256Hex(canonicalize(changed)));
  });

  it("bildet Dateinamen wie spezifiziert", () => {
    expect(documentFileName("tct_vault_standard", 3)).toBe("tct_vault_standard-v3.tagcontent.json");
    expect(libraryFileName(4)).toBe("element-library-v4.tagelements.json");
  });
});
