import { describe, expect, it } from "vitest";
import gardenSampleJson from "../../public/templates/examples/wedding-garden/sample.json";
import gardenTemplateJson from "../../public/templates/examples/wedding-garden/template.tagcontent.json";
import maintenanceSampleJson from "../../public/templates/examples/maintenance-heat-pump/sample.json";
import maintenanceTemplateJson from "../../public/templates/examples/maintenance-heat-pump/template.tagcontent.json";
import type { TagContentDocument, TemplateElement } from "../domain/types";
import {
  documentKindLabel,
  galleryItems,
  groupEntriesByYear,
  isOwnerOnlyInPreview,
  maintenanceEntriesFor,
  parseSample,
  resolveSlotDocuments,
  resolveSlotMedia,
  slotContentIds,
  visibleFor,
} from "./sample";

const gardenTemplate = gardenTemplateJson as unknown as TagContentDocument;
const maintenanceTemplate = maintenanceTemplateJson as unknown as TagContentDocument;

function elementOf(doc: TagContentDocument, elementId: string): TemplateElement {
  const element = doc.elements.find((entry) => entry.elementId === elementId);
  if (!element) throw new Error(`Element fehlt: ${elementId}`);
  return element;
}

const gardenSample = () => parseSample(gardenSampleJson).sample!;

describe("parseSample", () => {
  it("liest die Beispieldaten der Hochzeit", () => {
    const { sample, issues } = parseSample(gardenSampleJson);
    expect(issues).toEqual([]);
    expect(sample?.tag.displayName).toBe("Hochzeit Anna & Ben");
    expect(sample?.media).toHaveLength(5);
    expect(sample?.documents).toHaveLength(2);
    expect(sample?.contributions).toHaveLength(3);
  });

  it("weist fremdes Schema, doppelte IDs und data:-Pfade zurück", () => {
    const wrongSchema = parseSample({ ...gardenSampleJson, schema: "other" });
    expect(wrongSchema.sample).toBeNull();
    expect(wrongSchema.issues.map((entry) => entry.code)).toContain("SAMPLE_SCHEMA_UNKNOWN");

    const duplicate = structuredClone(gardenSampleJson) as { media: Array<Record<string, unknown>> };
    duplicate.media.push({ ...duplicate.media[0] });
    expect(parseSample(duplicate).issues.map((entry) => entry.code)).toContain("SAMPLE_CONTENT_ID_DUPLICATE");

    const unsafe = structuredClone(gardenSampleJson) as { media: Array<Record<string, unknown>> };
    unsafe.media[0].variants = { thumb: "data:image/svg+xml;base64,AA==", large: "https://example.org/x.svg" };
    expect(parseSample(unsafe).issues.map((entry) => entry.code)).toContain("SAMPLE_MEDIA_PATH_INVALID");
  });

  it("meldet unbekannte Beitrags-Medien", () => {
    const broken = structuredClone(gardenSampleJson) as {
      contributions: Array<Record<string, unknown>>;
    };
    broken.contributions[0].mediaId = "m_unknown";
    expect(parseSample(broken).issues.map((entry) => entry.code)).toContain("SAMPLE_CONTRIBUTION_MEDIA_UNKNOWN");
  });
});

describe("Sichtbarkeit", () => {
  it("folgt der Rollenmatrix aus dem Datenmodell", () => {
    expect(visibleFor("public", "scanner")).toBe(true);
    expect(visibleFor("public", "owner")).toBe(true);
    expect(visibleFor("shared", "scanner")).toBe(false);
    expect(visibleFor("shared", "guest")).toBe(true);
    expect(visibleFor("shared", "owner")).toBe(true);
    expect(visibleFor("private", "guest")).toBe(false);
    expect(visibleFor("ownerOnly", "owner")).toBe(true);
    expect(isOwnerOnlyInPreview("ownerOnly")).toBe(true);
    expect(isOwnerOnlyInPreview("shared")).toBe(false);
  });
});


describe("Slot-Auflösung", () => {
  it("liefert Medien und Dokumente in der Reihenfolge der Beispieldaten", () => {
    const sample = gardenSample();
    const gallery = elementOf(gardenTemplate, "cel_gallery");
    const docs = elementOf(gardenTemplate, "cel_docs");
    expect(resolveSlotMedia(gallery, "images", sample).map((item) => item.contentId)).toEqual(["m_g1", "m_g2", "m_g3"]);
    expect(resolveSlotDocuments(docs, "documents", sample).map((item) => item.contentId)).toEqual([
      "d_invitation",
      "d_menu",
    ]);
    expect(slotContentIds(docs, "documents", null)).toEqual([]);
    expect(resolveSlotMedia(gallery, "images", null)).toEqual([]);
  });

  it("ignoriert unbekannte Content-IDs statt zu werfen", () => {
    const sample = gardenSample();
    sample.slotFill.cel_gallery = { images: ["m_g1", "m_missing"] };
    const gallery = elementOf(gardenTemplate, "cel_gallery");
    expect(resolveSlotMedia(gallery, "images", sample).map((item) => item.contentId)).toEqual(["m_g1"]);
  });

  it("filtert Galeriebeiträge nach Rolle", () => {
    const sample = gardenSample();
    const gallery = elementOf(gardenTemplate, "cel_gallery");
    expect(galleryItems(gallery, sample, "scanner").map((item) => item.media.contentId)).toEqual(["m_g1", "m_g2"]);
    expect(galleryItems(gallery, sample, "guest").map((item) => item.media.contentId)).toEqual([
      "m_g1",
      "m_g2",
      "m_g3",
    ]);
    expect(galleryItems(gallery, sample, "owner").map((item) => item.media.contentId)).toEqual([
      "m_g1",
      "m_g2",
      "m_g3",
    ]);
  });

  it("beschriftet Dokumentarten", () => {
    expect(documentKindLabel({ contentId: "d1", title: "Speisekarte", kind: "menu" })).toBe("Speisekarte");
    expect(documentKindLabel({ contentId: "d2", title: "Sonstiges" })).toBe("Dokument");
  });
});

describe("Wartungseinträge", () => {
  it("sortiert absteigend und gruppiert nach Jahr", () => {
    const sample = parseSample(maintenanceSampleJson).sample!;
    const history = elementOf(maintenanceTemplate, "cel_history");
    const entries = maintenanceEntriesFor(history, sample);
    expect(entries.map((entry) => entry.contentId)).toEqual(["e_2026_02", "e_2024_11", "e_2024_05", "e_2023_11"]);
    const groups = groupEntriesByYear(entries);
    expect(groups.map((group) => group.year)).toEqual(["2026", "2024", "2023"]);
    expect(groups[1].entries).toHaveLength(2);
  });

  it("liefert ohne Beispieldaten keine Einträge", () => {
    const history = elementOf(maintenanceTemplate, "cel_history");
    expect(maintenanceEntriesFor(history, null)).toEqual([]);
    expect(groupEntriesByYear([])).toEqual([]);
  });
});
