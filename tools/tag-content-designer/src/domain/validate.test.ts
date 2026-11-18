import { describe, expect, it } from "vitest";
import lostFoundTemplate from "../../public/templates/lost-found-standard.tagcontent.json";
import vaultTemplate from "../../public/templates/vault-standard.tagcontent.json";
import { createDocument } from "./catalog";
import { validateDocument } from "./validate";

const clone = () => structuredClone(vaultTemplate) as unknown as Record<string, never>;
const codes = (input: unknown) => validateDocument(input).map((entry) => entry.code);
const blockers = (input: unknown) => validateDocument(input).filter((entry) => entry.blocking);

describe("validateDocument", () => {
  it("akzeptiert die ausgelieferten Golden Files ohne Fehler", () => {
    expect(blockers(vaultTemplate)).toHaveLength(0);
    expect(blockers(lostFoundTemplate)).toHaveLength(0);
  });

  it("akzeptiert ein neu erzeugtes Dokument", () => {
    const created = createDocument({ templateId: "tct_test_vault", tagType: "vault", name: "Test" });
    expect(blockers(created)).toHaveLength(0);
  });

  it("meldet doppelte elementIds", () => {
    const doc = clone() as unknown as { elements: Array<Record<string, unknown>> };
    doc.elements[2].elementId = doc.elements[1].elementId;
    expect(codes(doc)).toContain("ELEMENT_ID_DUPLICATE");
  });

  it("meldet doppelte displayOrder-Werte", () => {
    const doc = clone() as unknown as { elements: Array<Record<string, unknown>> };
    doc.elements[2].displayOrder = doc.elements[1].displayOrder;
    expect(codes(doc)).toContain("ELEMENT_ORDER_DUPLICATE");
  });

  it("meldet min > max in einem Slot", () => {
    const doc = clone() as unknown as { elements: Array<{ slots?: Array<Record<string, unknown>> }> };
    const slot = doc.elements[4].slots?.[0];
    if (slot) slot.min = 40;
    expect(codes(doc)).toContain("SLOT_RANGE_INVALID");
  });

  it("blockiert HTML-Markup im Text", () => {
    const doc = clone() as unknown as { elements: Array<{ content?: { paragraphs?: Array<{ runs: Array<{ text: string }> }> } }> };
    doc.elements[1].content!.paragraphs![0].runs[0].text = "<script>alert(1)</script>";
    expect(codes(doc)).toContain("POLICY_HTML_MARKUP");
  });

  it("blockiert javascript:-Ziele", () => {
    const doc = clone() as unknown as { elements: Array<{ payload: Record<string, unknown> }> };
    doc.elements[3].payload.name = "javascript:alert(1)";
    expect(codes(doc)).toContain("POLICY_SCRIPT_URL");
  });

  it("blockiert ungültige Farben", () => {
    const doc = clone() as unknown as { shell: { theme: { colors: Record<string, unknown> } } };
    doc.shell.theme.colors.background = "rot";
    expect(codes(doc)).toContain("THEME_COLOR_INVALID");
  });

  it("blockiert Elementtypen, die zum TAG-Typ nicht passen", () => {
    const doc = clone() as unknown as { elements: Array<Record<string, unknown>> };
    doc.elements[1].elementType = "maintenance-history";
    expect(codes(doc)).toContain("ELEMENT_TYPE_NOT_ALLOWED");
  });

  it("blockiert unbekannte Schemata", () => {
    const doc = clone() as unknown as Record<string, unknown>;
    doc.schema = "irgendwas";
    expect(codes(doc)).toContain("SCHEMA_UNKNOWN");
  });

  it("meldet unbekannte Binding-Quellen", () => {
    const doc = clone() as unknown as { elements: Array<Record<string, unknown>> };
    doc.elements[1].bindings = { heading: { from: "owner.contactChannel" } };
    expect(codes(doc)).toContain("BINDING_SOURCE_UNKNOWN");
  });

  it("warnt bei Gast-Löschung ohne Eigentumsbindung, blockiert aber nicht", () => {
    const found = validateDocument(vaultTemplate);
    const warning = found.find((entry) => entry.code === "ACTIONS_OWNERSHIP_UNPROVEN");
    expect(warning?.severity).toBe("warning");
    expect(warning?.blocking).toBe(false);
  });
});
