import { describe, expect, it } from "vitest";
import exampleIndexJson from "../../public/templates/examples/index.json";
import gardenJson from "../../public/templates/examples/wedding-garden/template.tagcontent.json";
import gardenSampleJson from "../../public/templates/examples/wedding-garden/sample.json";
import partyJson from "../../public/templates/examples/wedding-party/template.tagcontent.json";
import partySampleJson from "../../public/templates/examples/wedding-party/sample.json";
import lostFoundJson from "../../public/templates/examples/lost-found-luggage/template.tagcontent.json";
import lostFoundSampleJson from "../../public/templates/examples/lost-found-luggage/sample.json";
import maintenanceJson from "../../public/templates/examples/maintenance-heat-pump/template.tagcontent.json";
import maintenanceSampleJson from "../../public/templates/examples/maintenance-heat-pump/sample.json";
import { exampleTemplateRefs, parseExampleIndex } from "./examples";
import { layoutElements } from "./layout";
import { canonicalByteLength } from "./serialize";
import {
  MAX_DOCUMENT_BYTES,
  MAX_ELEMENTS,
  MAX_TABLE_CELL_LENGTH,
  MAX_TABLE_COLUMNS,
  MAX_TABLE_ROWS,
} from "./types";
import type { TableBlock, TagContentDocument, TemplateElement } from "./types";
import { isTableBlock } from "./richtext";
import { validateDocument } from "./validate";

interface SampleLike {
  media: Array<{ contentId: string }>;
  documents: Array<{ contentId: string }>;
  entries?: Array<{ contentId: string }>;
  slotFill: Record<string, Record<string, string[]>>;
}

const CASES: Array<{
  name: string;
  doc: TagContentDocument;
  sample: SampleLike;
  desktopColumns: number;
}> = [
  {
    name: "wedding-garden",
    doc: gardenJson as unknown as TagContentDocument,
    sample: gardenSampleJson as unknown as SampleLike,
    desktopColumns: 3,
  },
  {
    name: "wedding-party",
    doc: partyJson as unknown as TagContentDocument,
    sample: partySampleJson as unknown as SampleLike,
    desktopColumns: 2,
  },
  {
    name: "lost-found-luggage",
    doc: lostFoundJson as unknown as TagContentDocument,
    sample: lostFoundSampleJson as unknown as SampleLike,
    desktopColumns: 3,
  },
  {
    name: "maintenance-heat-pump",
    doc: maintenanceJson as unknown as TagContentDocument,
    sample: maintenanceSampleJson as unknown as SampleLike,
    desktopColumns: 3,
  },
];

/** Alle Tabellen-Blöcke eines Templates, unabhängig vom Element. */
function tablesOf(doc: TagContentDocument): TableBlock[] {
  const tables: TableBlock[] = [];
  for (const element of doc.elements) {
    for (const block of element.content?.paragraphs ?? []) {
      if (isTableBlock(block)) tables.push(block);
    }
  }
  return tables;
}

function elementsById(doc: TagContentDocument): Map<string, TemplateElement> {
  return new Map(doc.elements.map((element) => [element.elementId, element]));
}

describe("Beispiel-Manifest", () => {
  it("ist gültig und listet die vier Beispiele in fester Reihenfolge", () => {
    const { index, issues } = parseExampleIndex(exampleIndexJson);
    expect(issues).toEqual([]);
    expect(index?.examples.map((entry) => entry.id)).toEqual([
      "wedding-garden",
      "wedding-party",
      "lost-found-luggage",
      "maintenance-heat-pump",
    ]);
  });

  it("liefert Vorlagen-Einträge mit Gruppe und Beispielpfad", () => {
    const { index } = parseExampleIndex(exampleIndexJson);
    const refs = exampleTemplateRefs(index!);
    expect(refs).toHaveLength(4);
    expect(refs[0]).toMatchObject({
      id: "wedding-garden",
      group: "Beispiele",
      path: "/templates/examples/wedding-garden/template.tagcontent.json",
      samplePath: "/templates/examples/wedding-garden/sample.json",
    });
  });

  it("weist fremde Pfade und doppelte IDs zurück", () => {
    const broken = {
      schema: "myqr24-tag-content-examples-v1",
      schemaVersion: 1,
      examples: [
        { id: "a1", label: "A", templatePath: "/evil/x.json", tagType: "event", presentation: "wedding" },
        {
          id: "a1",
          label: "B",
          templatePath: "/templates/examples/a1/template.tagcontent.json",
          tagType: "event",
          presentation: "wedding",
        },
      ],
    };
    const { index, issues } = parseExampleIndex(broken);
    expect(index).toBeNull();
    const codes = issues.map((entry) => entry.code);
    expect(codes).toContain("EXAMPLES_TEMPLATE_PATH_INVALID");
    expect(codes).toContain("EXAMPLES_ID_DUPLICATE");
  });
});

describe("Beispiel-Templates", () => {
  it.each(CASES)("$name ist ein valides Template ohne Fehler", ({ doc }) => {
    const errors = validateDocument(doc).filter((issue) => issue.severity === "error");
    expect(errors).toEqual([]);
  });

  it.each(CASES)("$name bleibt innerhalb der Grenzen", ({ doc }) => {
    expect(doc.schema).toBe("myqr24-tag-content-template-v1");
    expect(doc.schemaVersion).toBe(4);
    expect(doc.elements.length).toBeLessThanOrEqual(MAX_ELEMENTS);
    expect(canonicalByteLength(doc)).toBeLessThanOrEqual(MAX_DOCUMENT_BYTES);
  });

  it.each(CASES)("$name deklariert die Item-Fähigkeit je Element", ({ doc }) => {
    for (const element of doc.elements) {
      expect(element.items?.mode).toBeDefined();
      if (element.elementType === "gallery") expect(element.items).toMatchObject({ mode: "dynamic" });
      if (element.elementType === "image") expect(element.items).toMatchObject({ mode: "dynamic" });
      if (element.elementType === "text") expect(element.items).toMatchObject({ mode: "none" });
    }
  });

  it.each(CASES)("$name hat eindeutige Element-IDs und gültige Spans", ({ doc }) => {
    const ids = doc.elements.map((element) => element.elementId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const element of doc.elements) {
      for (const span of Object.values(element.placement?.span ?? {})) {
        expect(Number.isInteger(span)).toBe(true);
        expect(span).toBeGreaterThanOrEqual(1);
        expect(span).toBeLessThanOrEqual(doc.layout.columns);
      }
    }
  });

  it.each(CASES)("$name hält die Tabellenlimits ein", ({ doc }) => {
    const tables = tablesOf(doc);
    expect(tables.length).toBeGreaterThan(0);
    for (const table of tables) {
      expect(table.columns.length).toBeGreaterThanOrEqual(1);
      expect(table.columns.length).toBeLessThanOrEqual(MAX_TABLE_COLUMNS);
      expect(table.rows.length).toBeLessThanOrEqual(MAX_TABLE_ROWS);
      for (const row of table.rows) {
        expect(row.cells).toHaveLength(table.columns.length);
        for (const cell of row.cells) {
          expect(cell.runs.length).toBeGreaterThan(0);
          const length = cell.runs.reduce((sum, run) => sum + run.text.length, 0);
          expect(length).toBeLessThanOrEqual(MAX_TABLE_CELL_LENGTH);
        }
      }
    }
  });

  it.each(CASES)("$name ergibt die erwarteten Spalten je Breite", ({ doc, desktopColumns }) => {
    expect(layoutElements(doc.elements, doc.layout, 360).columns).toBe(1);
    expect(layoutElements(doc.elements, doc.layout, 1280).columns).toBe(desktopColumns);
    for (const entry of layoutElements(doc.elements, doc.layout, 1280).placed) {
      expect(entry.span).toBeGreaterThanOrEqual(1);
      expect(entry.span).toBeLessThanOrEqual(desktopColumns);
    }
  });

  it.each(CASES)("$name verweist in slotFill nur auf vorhandene Elemente, Slots und Inhalte", ({ doc, sample }) => {
    const elements = elementsById(doc);
    const known = new Set([
      ...sample.media.map((entry) => entry.contentId),
      ...sample.documents.map((entry) => entry.contentId),
      ...(sample.entries ?? []).map((entry) => entry.contentId),
    ]);
    for (const [elementId, slots] of Object.entries(sample.slotFill)) {
      const element = elements.get(elementId);
      expect(element, `Unbekanntes Element in slotFill: ${elementId}`).toBeDefined();
      for (const [slotId, contentIds] of Object.entries(slots)) {
        const slot = element?.slots?.find((entry) => entry.slotId === slotId);
        expect(slot, `Unbekannter Slot ${elementId}.${slotId}`).toBeDefined();
        expect(contentIds.length).toBeLessThanOrEqual(slot?.max ?? 0);
        for (const contentId of contentIds) {
          expect(known.has(contentId), `Unbekannte Content-ID ${contentId}`).toBe(true);
        }
      }
    }
  });
});
