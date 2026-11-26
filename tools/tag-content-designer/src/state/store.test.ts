import { describe, expect, it } from "vitest";
import vaultTemplate from "../../public/templates/vault-standard.tagcontent.json";
import { layoutElements } from "../domain/layout";
import { emptyLibrary } from "../domain/library";
import type { TagContentDocument } from "../domain/types";
import {
  addElementToDoc,
  createInitialState,
  editorReducer,
  moveElementInDoc,
  removeElementFromDoc,
} from "./store";

const createDoc = () => structuredClone(vaultTemplate) as unknown as TagContentDocument;
const previewOrder = (document: TagContentDocument, width = 1280) =>
  layoutElements(document.elements, document.layout, width).placed.map((entry) => entry.element.elementId);

describe("moveElementInDoc", () => {
  it("zeigt die neue Reihenfolge sofort in der Vorschau", () => {
    const document = createDoc();
    expect(previewOrder(document)).toEqual(["cel_intro", "cel_notice", "cel_gallery", "cel_docs"]);

    const moved = moveElementInDoc(document, "cel_gallery", -1);
    expect(previewOrder(moved)).toEqual(["cel_intro", "cel_gallery", "cel_notice", "cel_docs"]);
  });

  it("schreibt die Platzierung für alle Breakpoints mit", () => {
    const moved = moveElementInDoc(createDoc(), "cel_gallery", -1);
    const gallery = moved.elements.find((entry) => entry.elementId === "cel_gallery");
    const notice = moved.elements.find((entry) => entry.elementId === "cel_notice");
    expect(gallery?.displayOrder).toBe(20);
    expect(notice?.displayOrder).toBe(30);
    expect(gallery?.placement?.order).toEqual({ mobile: 20, tablet: 20, desktop: 20 });
    expect(notice?.placement?.order).toEqual({ mobile: 30, tablet: 30, desktop: 30 });
    expect(previewOrder(moved, 360)).toEqual(["cel_intro", "cel_gallery", "cel_notice", "cel_docs"]);
  });

  it("ändert nichts am Rand der Liste", () => {
    const document = createDoc();
    expect(moveElementInDoc(document, "cel_intro", -1)).toBe(document);
    expect(moveElementInDoc(document, "cel_docs", 1)).toBe(document);
  });

  it("verträgt Elemente ohne Platzierung", () => {
    const document = createDoc();
    const intro = document.elements.find((entry) => entry.elementId === "cel_intro");
    if (intro) delete intro.placement;
    const moved = moveElementInDoc(document, "cel_intro", 1);
    expect(previewOrder(moved)[1]).toBe("cel_intro");
  });
});

describe("Elementliste bearbeiten", () => {
  it("entfernt Elemente", () => {
    const document = removeElementFromDoc(createDoc(), "cel_docs");
    expect(document.elements.some((entry) => entry.elementId === "cel_docs")).toBe(false);
  });

  it("hängt neue Elemente mit freier displayOrder an", () => {
    const result = addElementToDoc(createDoc(), "callout");
    const added = result.doc.elements.find((entry) => entry.elementId === result.elementId);
    expect(added).toBeDefined();
    expect(added?.displayOrder).toBe(50);
  });

  it("übernimmt die Item-Fähigkeit aus dem Katalog", () => {
    const image = addElementToDoc(createDoc(), "image");
    const addedImage = image.doc.elements.find((entry) => entry.elementId === image.elementId);
    expect(addedImage?.items).toEqual({ mode: "dynamic", slotIds: ["image"] });
    expect(addedImage?.actions?.upload?.principals).toEqual(["owner"]);

    const divider = addElementToDoc(createDoc(), "divider");
    const addedDivider = divider.doc.elements.find((entry) => entry.elementId === divider.elementId);
    expect(addedDivider?.items).toEqual({ mode: "none" });
    expect(addedDivider?.slots).toBeUndefined();
  });
});

describe("editorReducer", () => {
  const baseDoc = createDoc();
  const initialState = () => createInitialState(baseDoc, emptyLibrary());
  const rename = (document: TagContentDocument, name: string): TagContentDocument => ({
    ...document,
    template: { ...document.template, name },
  });

  it("bündelt Tipp-Bursts zu einem Undo-Schritt", () => {
    const first = editorReducer(initialState(), {
      type: "replace",
      doc: rename(baseDoc, "A"),
      coalesce: true,
      at: 1000,
    });
    const second = editorReducer(first, {
      type: "replace",
      doc: rename(baseDoc, "AB"),
      coalesce: true,
      at: 1300,
    });
    expect(second.past).toHaveLength(1);

    const third = editorReducer(second, {
      type: "replace",
      doc: rename(baseDoc, "ABC"),
      coalesce: true,
      at: 4000,
    });
    expect(third.past).toHaveLength(2);
    expect(editorReducer(third, { type: "undo" }).doc.template.name).toBe("AB");
  });

  it("macht strukturelle Änderungen einzeln rückgängig", () => {
    const moved = editorReducer(initialState(), {
      type: "replace",
      doc: moveElementInDoc(baseDoc, "cel_gallery", -1),
    });
    expect(moved.past).toHaveLength(1);
    const undone = editorReducer(moved, { type: "undo" });
    expect(previewOrder(undone.doc)).toEqual(["cel_intro", "cel_notice", "cel_gallery", "cel_docs"]);
    expect(editorReducer(undone, { type: "redo" }).doc.elements).toHaveLength(5);
  });
});
