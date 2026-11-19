import { describe, expect, it } from "vitest";
import vaultTemplate from "../../public/templates/vault-standard.tagcontent.json";
import type { TagContentDocument } from "./types";
import { layoutHints } from "./layoutChecks";

const doc = () => structuredClone(vaultTemplate) as unknown as TagContentDocument;

describe("layoutHints", () => {
  it("warnt vor zu schmalen Spalten", () => {
    const document = doc();
    document.layout.responsive.preferredColumns = { ...document.layout.responsive.preferredColumns, desktop: 12 };
    document.layout.responsive.minColumnWidth = { ...document.layout.responsive.minColumnWidth, desktop: "2rem" };
    const hints = layoutHints(document, 1280);
    const narrow = hints.find((hint) => hint.id === "COLUMN_TOO_NARROW");
    expect(narrow).toBeDefined();
    expect(narrow?.message).toContain("12 Spalten");
  });

  it("warnt auf dem Handy nicht vor Spaltenbreite (eine Spalte ist immer breit genug)", () => {
    const hints = layoutHints(doc(), 320);
    expect(hints.some((hint) => hint.id === "COLUMN_TOO_NARROW")).toBe(false);
  });

  it("warnt auf breiten Ansichten nicht vor Spaltenbreite", () => {
    const hints = layoutHints(doc(), 1440);
    expect(hints.some((hint) => hint.id === "COLUMN_TOO_NARROW")).toBe(false);
    expect(hints.some((hint) => hint.id === "TEXT_TOO_SMALL")).toBe(false);
  });

  it("meckert über zu kleine Basisschrift auf dem Handy", () => {
    const document = doc();
    document.shell.theme.typography = { ...document.shell.theme.typography, bodySize: 12 };
    const hints = layoutHints(document, 360);
    expect(hints.map((hint) => hint.id)).toContain("TEXT_TOO_SMALL");
  });

  it("erkennt breite Tabellen auf dem Handy und nennt das Element", () => {
    const document = doc();
    const intro = document.elements.find((element) => element.elementId === "cel_intro");
    expect(intro).toBeDefined();
    intro!.content = {
      paragraphs: [
        {
          type: "table",
          columns: [
            { align: "start" },
            { align: "start" },
            { align: "start" },
            { align: "start" },
          ],
          rows: [
            {
              header: true,
              cells: [
                { runs: [{ text: "A" }] },
                { runs: [{ text: "B" }] },
                { runs: [{ text: "C" }] },
                { runs: [{ text: "D" }] },
              ],
            },
          ],
        },
      ],
    };
    const hints = layoutHints(document, 360);
    const table = hints.find((hint) => hint.id === "TABLE_TOO_WIDE");
    expect(table?.elementId).toBe("cel_intro");
    expect(table?.message).toContain("4 Spalten");
  });

  it("begrenzt die Zahl der Hinweise", () => {
    const document = doc();
    document.shell.theme.typography = { ...document.shell.theme.typography, bodySize: 10 };
    for (const element of document.elements) {
      const paragraph = (element.content?.paragraphs ?? [])[0];
      if (paragraph && !("type" in paragraph)) paragraph.runs = [{ text: "x".repeat(700) }];
    }
    expect(layoutHints(document, 360).length).toBeLessThanOrEqual(4);
  });
});
