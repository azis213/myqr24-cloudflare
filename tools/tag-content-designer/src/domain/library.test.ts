import { describe, expect, it } from "vitest";
import defaultLibrary from "../../public/elements/default.tagelements.json";
import type { ElementLibrary } from "./types";
import { bumpLibrary, mergeLibraries, validateLibrary } from "./library";

const base = () => structuredClone(defaultLibrary) as unknown as ElementLibrary;

describe("library", () => {
  it("akzeptiert die ausgelieferte Default-Bibliothek", () => {
    const errors = validateLibrary(defaultLibrary).filter((entry) => entry.blocking);
    expect(errors).toHaveLength(0);
  });

  it("meldet doppelte IDs innerhalb einer Datei", () => {
    const library = base();
    library.elements[1].elementTemplateId = library.elements[0].elementTemplateId;
    const codes = validateLibrary(library).map((entry) => entry.code);
    expect(codes).toContain("LIBRARY_ELEMENT_ID_DUPLICATE");
  });

  it("meldet unbekannte Elementtypen", () => {
    const library = base() as unknown as { elements: Array<Record<string, unknown>> };
    library.elements[0].elementType = "unbekannt";
    const codes = validateLibrary(library).map((entry) => entry.code);
    expect(codes).toContain("LIBRARY_ELEMENT_TYPE_UNKNOWN");
  });

  it("ergänzt neue Bausteine", () => {
    const incoming = base();
    incoming.elements = [
      {
        elementTemplateId: "tet_gallery_slider",
        elementTemplateVersion: 1,
        elementType: "gallery",
        label: "Galerie – Slider",
        payload: { name: "Slider" },
      },
    ];
    const result = mergeLibraries(base(), incoming);
    expect(result.changes[0].action).toBe("added");
    expect(result.library.elements).toHaveLength(base().elements.length + 1);
  });

  it("ersetzt nur bei höherer Version", () => {
    const incoming = base();
    incoming.elements[0].elementTemplateVersion = base().elements[0].elementTemplateVersion + 1;
    const replaced = mergeLibraries(base(), incoming);
    expect(replaced.changes[0].action).toBe("replaced");

    const same = mergeLibraries(base(), base());
    expect(same.changes[0].action).toBe("unchanged");

    const older = base();
    older.elements[0].elementTemplateVersion = 0 as unknown as number;
    const ignored = mergeLibraries(base(), older);
    expect(ignored.changes[0].action).toBe("ignored-older");
  });

  it("erhöht libraryVersion beim Speichern", () => {
    const bumped = bumpLibrary(base());
    expect(bumped.libraryVersion).toBe(base().libraryVersion + 1);
  });
});
