import { describe, expect, it } from "vitest";
import vaultTemplate from "../../public/templates/vault-standard.tagcontent.json";
import type { DocumentLayout, TagContentDocument } from "./types";
import { effectiveColumns, effectiveSpan, layoutElements } from "./layout";

const doc = () => structuredClone(vaultTemplate) as unknown as TagContentDocument;
const layout = (): DocumentLayout => doc().layout;

describe("layout", () => {
  it("nutzt auf dem Handy eine Spalte", () => {
    const result = effectiveColumns(layout(), 360);
    expect(result.breakpoint).toBe("mobile");
    expect(result.columns).toBe(1);
  });

  it("begrenzt Tablet auf preferredColumns (2)", () => {
    const result = effectiveColumns(layout(), 768);
    expect(result.breakpoint).toBe("tablet");
    expect(result.columns).toBe(2);
  });

  it("begrenzt Desktop auf preferredColumns (3)", () => {
    const result = effectiveColumns(layout(), 1280);
    expect(result.breakpoint).toBe("desktop");
    expect(result.columns).toBe(3);
  });

  it("klemmt Spans auf die effektive Spaltenzahl", () => {
    const element = doc().elements.find((entry) => entry.elementId === "cel_docs");
    expect(element).toBeDefined();
    expect(effectiveSpan(element!, 3, "desktop")).toBe(3);
    expect(effectiveSpan(element!, 1, "mobile")).toBe(1);
  });

  it("deutet Spans als Anteil am 12er-Raster (8/4 bei drei Spalten)", () => {
    const elements = doc().elements;
    const intro = elements.find((entry) => entry.elementId === "cel_intro")!;
    const notice = elements.find((entry) => entry.elementId === "cel_notice")!;
    expect(effectiveSpan(intro, 3, "desktop")).toBe(2);
    expect(effectiveSpan(notice, 3, "desktop")).toBe(1);
  });

  it("rechnet denselben Anteil auf sechs Spalten um", () => {
    const elements = doc().elements;
    const intro = elements.find((entry) => entry.elementId === "cel_intro")!;
    const notice = elements.find((entry) => entry.elementId === "cel_notice")!;
    const docs = elements.find((entry) => entry.elementId === "cel_docs")!;
    expect(effectiveSpan(intro, 6, "desktop")).toBe(4);
    expect(effectiveSpan(notice, 6, "desktop")).toBe(2);
    expect(effectiveSpan(docs, 6, "desktop")).toBe(6);
  });

  it("lässt auf dem Handy jede Kachel die volle Breite behalten", () => {
    for (const element of doc().elements) {
      expect(effectiveSpan(element, 1, "mobile")).toBe(1);
    }
  });

  it("nutzt bei fehlender Platzierung die volle Breite", () => {
    const element = structuredClone(doc().elements[0]);
    delete element.placement;
    expect(effectiveSpan(element, 4, "desktop")).toBe(4);
  });

  it("blendet theme-assets aus und sortiert nach order", () => {
    const { placed } = layoutElements(doc().elements, layout(), 1280);
    expect(placed.map((entry) => entry.element.elementId)).toEqual([
      "cel_intro",
      "cel_notice",
      "cel_gallery",
      "cel_docs",
    ]);
  });

  it("legt mit view=stacked alle Elemente untereinander", () => {
    const document = doc();
    const compact = layoutElements(document.elements, document.layout, 1280);
    const stacked = layoutElements(document.elements, document.layout, 1280, { view: "stacked" });
    // Breite und Breakpoint bleiben echt, nur die Spaltenzahl wird auf 1 gesetzt.
    expect(stacked.breakpoint).toBe("desktop");
    expect(compact.columns).toBe(3);
    expect(stacked.columns).toBe(1);
    expect(stacked.placed.map((entry) => entry.span)).toEqual([1, 1, 1, 1]);
    // Die Reihenfolge bleibt unabhängig vom Spaltenmodus gleich.
    expect(stacked.placed.map((entry) => entry.element.elementId)).toEqual(
      compact.placed.map((entry) => entry.element.elementId),
    );
  });

  it("lässt view=compact das echte Raster unverändert", () => {
    const document = doc();
    const explicit = layoutElements(document.elements, document.layout, 1280, { view: "compact" });
    const implicit = layoutElements(document.elements, document.layout, 1280);
    expect(explicit.columns).toBe(implicit.columns);
    expect(explicit.placed.map((entry) => entry.span)).toEqual(implicit.placed.map((entry) => entry.span));
  });

  it("respektiert eine geänderte Reihenfolge je Breakpoint", () => {
    const document = doc();
    const gallery = document.elements.find((entry) => entry.elementId === "cel_gallery");
    if (gallery?.placement?.order) gallery.placement.order.desktop = 5;
    const { placed } = layoutElements(document.elements, document.layout, 1280);
    expect(placed[0].element.elementId).toBe("cel_gallery");
  });
});
