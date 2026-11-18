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
    // Golden Files liegen auf schemaVersion 2 und nutzen Absatz-Überschriften.
    expect((vaultTemplate as { schemaVersion: number }).schemaVersion).toBe(2);
    expect(JSON.stringify(vaultTemplate)).toContain('"heading":3');
  });

  it("prüft Überschriftenebenen und den Konflikt mit Listen", () => {
    const doc = clone() as unknown as {
      elements: Array<{
        content?: { heading?: string; paragraphs?: Array<Record<string, unknown> & { runs: Array<Record<string, unknown>> }> };
      }>;
    };
    const paragraph = doc.elements.find((entry) => (entry.content?.paragraphs?.length ?? 0) > 1)!.content!.paragraphs![1];

    paragraph.heading = 6;
    expect(codes(doc)).toContain("PARAGRAPH_HEADING_INVALID");

    paragraph.heading = 2;
    paragraph.list = { kind: "bullet", level: 0 };
    expect(codes(doc)).toContain("PARAGRAPH_HEADING_LIST_CONFLICT");

    delete paragraph.list;
    expect(blockers(doc)).toHaveLength(0);
  });

  it("prüft Tabellen (Spalten, Zeilen, Zellen, Ausrichtung)", () => {
    const doc = clone() as unknown as {
      elements: Array<{ content?: { paragraphs?: unknown[] } }>;
    };
    const element = doc.elements.find((entry) => (entry.content?.paragraphs?.length ?? 0) > 0)!;
    const table = {
      type: "table",
      columns: [{}, { align: "mitte" }],
      rows: [{ header: true, cells: [{ text: "A" }] }],
    };
    element.content!.paragraphs = [table];

    const found = codes(doc);
    expect(found).toContain("TABLE_ALIGN_INVALID");
    expect(found).toContain("TABLE_ROW_LENGTH");

    table.columns = [{}, { align: "end" }];
    table.rows = [{ header: true, cells: [{ text: "A" }, { text: "B" }] }];
    expect(blockers(doc)).toHaveLength(0);

    table.rows = [{ header: true, cells: Array.from({ length: 7 }, () => ({ text: "x" })) }];
    expect(codes(doc)).toContain("TABLE_ROW_LENGTH");

    table.columns = Array.from({ length: 7 }, () => ({}));
    table.rows = [{ header: true, cells: Array.from({ length: 7 }, () => ({ text: "x" })) }];
    expect(codes(doc)).toContain("TABLE_COLUMNS_INVALID");
  });

  it("warnt beim Altfeld heading (schemaVersion 1)", () => {
    const doc = clone() as unknown as { elements: Array<{ content?: { heading?: string; paragraphs?: unknown[] } }> };
    const element = doc.elements.find((entry) => (entry.content?.paragraphs?.length ?? 0) > 0)!;
    element.content!.heading = "Altbestand";
    expect(codes(doc)).toContain("CONTENT_HEADING_DEPRECATED");
    // Hinweis, kein Blocker.
    expect(blockers(doc)).toHaveLength(0);
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

  it("prüft eigene Farben der Palette", () => {
    const doc = clone() as unknown as { palette?: { custom: string[] } };
    doc.palette = { custom: ["#123456", "#ABCDEF"] };
    expect(blockers(doc)).toHaveLength(0);

    doc.palette = { custom: ["rot"] };
    expect(codes(doc)).toContain("PALETTE_INVALID");

    doc.palette = { custom: Array.from({ length: 25 }, () => "#123456") };
    expect(codes(doc)).toContain("PALETTE_LIMIT");

    doc.palette = { custom: ["#123456"] };
    expect(blockers(doc)).toHaveLength(0);
  });

  it("meldet HTML-Text als Warnung statt als Blocker", () => {
    const doc = clone() as unknown as { elements: Array<{ content?: { paragraphs?: Array<{ runs: Array<{ text: string }> }> } }> };
    doc.elements[1].content!.paragraphs![0].runs[0].text = "<script>alert(1)</script>";
    const issues = validateDocument(doc);
    expect(issues.map((entry) => entry.code)).toContain("POLICY_HTML_MARKUP");
    expect(issues.filter((entry) => entry.code === "POLICY_HTML_MARKUP")[0].severity).toBe("warning");
    expect(issues.filter((entry) => entry.blocking)).toHaveLength(0);
  });

  it("akzeptiert vollständig formatierte Runs und Listen", () => {
    const doc = clone() as unknown as {
      elements: Array<{
        content?: {
          paragraphs?: Array<Record<string, unknown> & { runs: Array<Record<string, unknown>> }>;
        };
      }>;
    };
    const paragraphs = doc.elements[1].content!.paragraphs!;
    const paragraph = paragraphs[paragraphs.length - 1];
    paragraph.align = "center";
    paragraph.lineHeight = 1.5;
    paragraph.indent = 2;
    paragraph.list = { kind: "ordered", level: 1 };
    paragraph.runs[0] = {
      text: "Formatiert",
      marks: [{ type: "bold" }, { type: "underline" }],
      color: "#b3261e",
      background: "#fff3cd",
      fontSize: 20,
      fontFamily: "serif",
      link: { href: "https://example.org/hinweis" },
    };
    expect(blockers(doc)).toHaveLength(0);
  });

  it("blockiert ungültige Zeichen- und Absatzattribute", () => {
    const doc = clone() as unknown as {
      elements: Array<{
        content?: { paragraphs?: Array<Record<string, unknown> & { runs: Array<Record<string, unknown>> }> };
      }>;
    };
    const paragraph = doc.elements[1].content!.paragraphs![0];
    paragraph.align = "justify";
    paragraph.lineHeight = 1.4;
    paragraph.indent = 9;
    paragraph.list = { kind: "checklist", level: 9 };
    paragraph.runs[0] = {
      text: "Kaputt",
      color: "rot",
      background: "#fff",
      fontSize: 17,
      fontFamily: "comic",
      link: { href: "http://example.org" },
    };
    const found = codes(doc);
    expect(found).toContain("CONTENT_PARAGRAPH_ALIGN_INVALID");
    expect(found).toContain("CONTENT_PARAGRAPH_LINE_HEIGHT_INVALID");
    expect(found).toContain("CONTENT_PARAGRAPH_INDENT_INVALID");
    expect(found).toContain("CONTENT_LIST_INVALID");
    expect(found).toContain("CONTENT_RUN_COLOR_INVALID");
    expect(found).toContain("CONTENT_RUN_FONT_SIZE_INVALID");
    expect(found).toContain("CONTENT_RUN_FONT_FAMILY_INVALID");
    expect(found).toContain("CONTENT_RUN_LINK_INVALID");
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
