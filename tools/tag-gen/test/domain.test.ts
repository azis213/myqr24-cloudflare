import { describe, expect, it } from "vitest";
import {
  countRange,
  defaultTemplate,
  paginateTags,
  parseConfigExport,
  maximumOffset,
  resolveRangeValues,
  validateBaseUrl,
  validateRange,
  validateTemplate,
  type GeneratedTag,
} from "../src/domain";

const timestamp = "2026-10-07T15:00:00.000Z";

describe("TAG-Generator-Domäne", () => {
  it("normalisiert eine gültige HTTPS-Basis-URL mit abschließendem Slash", () => {
    expect(validateBaseUrl("https://s.myqr24.com/t")).toEqual({
      ok: true,
      value: "https://s.myqr24.com/t/",
    });
  });

  it("weist unsichere oder nicht kanonische Basis-URLs zurück", () => {
    expect(validateBaseUrl("http://s.myqr24.com/t/").ok).toBe(false);
    expect(validateBaseUrl("https://s.myqr24.com/t/?campaign=1").ok).toBe(false);
    expect(validateBaseUrl("https://s.myqr24.com/t/ä").ok).toBe(false);
  });

  it("akzeptiert einen kanonischen sechsstelligen Bereich", () => {
    const result = validateRange({
      id: "six",
      name: "Testbereich",
      start: "60.466.176",
      end: "60 466 179",
      tagLength: 6,
      labelText: "Sechs",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.start).toBe("60466176");
      expect(result.value.end).toBe("60466179");
      expect(countRange(result.value)).toBe(4n);
    }
  });

  it("löst sechsstellige Offsets relativ zur Base36-Untergrenze auf", () => {
    const result = resolveRangeValues(6, "offset", "0", "23");
    expect(result).toEqual({
      ok: true,
      value: { start: "60466176", end: "60466199" },
    });
  });

  it("löst achtstellige Offsets als 16-ausgerichtete Basiswert-Slots auf", () => {
    const result = resolveRangeValues(8, "offset", "0", "2");
    expect(result).toEqual({
      ok: true,
      value: { start: "78364164096", end: "78364164128" },
    });
    expect(resolveRangeValues(8, "offset", "0", (maximumOffset(8) + 1n).toString()).ok).toBe(false);
  });

  it("weist Überlappungen und nicht ausgerichtete achtstellige Bereiche zurück", () => {
    const current = validateRange({
      id: "current",
      name: "Bestehend",
      start: "60466176",
      end: "60466179",
      tagLength: 6,
      labelText: "",
    });
    expect(current.ok).toBe(true);
    if (!current.ok) return;

    const overlap = validateRange({
      id: "overlap",
      name: "Neu",
      start: "60466179",
      end: "60466182",
      tagLength: 6,
      labelText: "",
    }, [current.value]);
    expect(overlap.ok).toBe(false);

    const unaligned = validateRange({
      id: "eight",
      name: "Acht",
      start: "2176782337",
      end: "2176782368",
      tagLength: 8,
      labelText: "",
    });
    expect(unaligned.ok).toBe(false);
  });

  it("verteilt TAGs ab der gewählten Startposition über Druckseiten", () => {
    const template = defaultTemplate();
    template.grid.columns = 3;
    template.grid.rows = 2;
    const tags: GeneratedTag[] = Array.from({ length: 5 }, (_, index) => ({
      tagId: `abc${index.toString().padStart(3, "0")}`,
      url: `https://s.myqr24.com/t/abc${index.toString().padStart(3, "0")}`,
      rangeId: "range",
      rangeName: "Range",
      ordinalInRange: String(index),
      requestedValue: String(index),
      decodedValue: String(index),
      tagLength: 6,
      labelText: "Test",
    }));

    const pages = paginateTags(tags, template, 2, 2);
    expect(pages).toHaveLength(2);
    expect(pages[0].filter((cell) => cell.tag)).toHaveLength(2);
    expect(pages[0][4].tag?.tagId).toBe("abc000");
    expect(pages[1].filter((cell) => cell.tag)).toHaveLength(3);
  });

  it("validiert druckbare Vorlagen und erkennt Überlappungen", () => {
    const valid = defaultTemplate();
    expect(validateTemplate(valid)).toEqual({ ok: true, value: valid });

    const overlapping = structuredClone(valid);
    overlapping.elements.tagIdText.xMm = 10;
    overlapping.elements.tagIdText.yMm = 10;
    expect(validateTemplate(overlapping).ok).toBe(false);
  });

  it("liest eine vollständige Konfiguration ohne Geheimnisse ein", () => {
    const configuration = {
      schemaVersion: 1,
      kind: "myqr24.tag-generator.config",
      name: "Fixture",
      updatedAt: timestamp,
      baseUrl: "https://s.myqr24.com/t/",
      ranges: [{
        id: "range",
        name: "Range",
        start: "60466176",
        end: "60466176",
        tagLength: 6,
        labelText: "",
      }],
      labelTemplates: [defaultTemplate()],
    };
    const result = parseConfigExport(JSON.stringify(configuration));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.ranges).toHaveLength(1);
  });
});
