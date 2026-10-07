import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { defaultTemplate, type GeneratedTag } from "../src/domain";
import { createTagPdf } from "../src/pdf-generation";

const POINTS_PER_MM = 72 / 25.4;

const tags: GeneratedTag[] = [
  {
    tagId: "abc123",
    url: "https://s.myqr24.com/t/abc123",
    rangeId: "range-1",
    rangeName: "PDF-Test",
    ordinalInRange: "0",
    requestedValue: "60466176",
    decodedValue: "60466176",
    tagLength: 6,
    labelText: "Maßhaltiger A4-Test",
  },
];

describe("maßhaltige A4-PDF-Erzeugung", () => {
  it("erzeugt eine echte PDF-Seite mit exakt 210 × 297 mm", async () => {
    const template = defaultTemplate();
    const blob = await createTagPdf(tags, template, 1, 1);
    const document = await PDFDocument.load(await blob.arrayBuffer());
    const [page] = document.getPages();

    expect(blob.type).toBe("application/pdf");
    expect(document.getPageCount()).toBe(1);
    expect(page.getWidth()).toBeCloseTo(210 * POINTS_PER_MM, 6);
    expect(page.getHeight()).toBeCloseTo(297 * POINTS_PER_MM, 6);
  });

  it("berücksichtigt die Startposition, ohne eine zusätzliche Seite zu erzeugen", async () => {
    const template = defaultTemplate();
    const blob = await createTagPdf(tags, template, 2, 2);
    const document = await PDFDocument.load(await blob.arrayBuffer());

    expect(document.getPageCount()).toBe(1);
  });
});
