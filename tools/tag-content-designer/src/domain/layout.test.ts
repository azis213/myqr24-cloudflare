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

  it("blendet theme-assets aus und sortiert nach order", () => {
    const { placed } = layoutElements(doc().elements, layout(), 1280);
    expect(placed.map((entry) => entry.element.elementId)).toEqual([
      "cel_intro",
      "cel_notice",
      "cel_gallery",
      "cel_docs",
    ]);
  });

  it("respektiert eine geänderte Reihenfolge je Breakpoint", () => {
    const document = doc();
    const gallery = document.elements.find((entry) => entry.elementId === "cel_gallery");
    if (gallery?.placement?.order) gallery.placement.order.desktop = 5;
    const { placed } = layoutElements(document.elements, document.layout, 1280);
    expect(placed[0].element.elementId).toBe("cel_gallery");
  });
});
