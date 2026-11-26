import { describe, expect, it } from "vitest";
import { isTableBlock } from "./richtext";
import type { Paragraph, TemplateElement } from "./types";
import { flattenBindings, isKnownBindingSource, resolveContent } from "./bindings";

const element = (overrides: Partial<TemplateElement> = {}): TemplateElement => ({
  elementId: "cel_text",
  elementType: "text",
  displayOrder: 10,
  visibility: "public",
  items: { mode: "none" },
  payload: {},
  content: { paragraphs: [{ heading: 3, runs: [{ text: "Vorlage" }] }, { runs: [{ text: "Text" }] }] },
  ...overrides,
});

/** Text der ersten Überschrift im Absatzfluss (oder undefined). */
const headingText = (content: ReturnType<typeof resolveContent>): string | undefined =>
  (content.paragraphs ?? [])
    .filter((block): block is Paragraph => !isTableBlock(block))
    .find((block) => block.heading !== undefined)
    ?.runs.map((run) => run.text)
    .join("");

describe("bindings", () => {
  it("kennt nur die drei erlaubten Quellen", () => {
    expect(isKnownBindingSource("tag.displayName")).toBe(true);
    expect(isKnownBindingSource("tag.id")).toBe(true);
    expect(isKnownBindingSource("literal")).toBe(true);
    expect(isKnownBindingSource("owner.contactChannel")).toBe(false);
  });

  it("löst tag.displayName in die erste Überschrift auf", () => {
    const resolved = resolveContent(
      element({ bindings: { heading: { from: "tag.displayName" } } }),
      { tagName: "Reisekoffer" },
    );
    expect(headingText(resolved)).toBe("Reisekoffer");
    // Bindings legen keine Legacy-`heading`-Zeile an.
    expect(resolved.heading).toBeUndefined();
  });

  it("fällt ohne Kontext auf den Vorlagentext zurück", () => {
    const resolved = resolveContent(element({ bindings: { heading: { from: "tag.displayName" } } }), {});
    expect(headingText(resolved)).toBe("Vorlage");
  });

  it("nutzt literal-Werte", () => {
    const resolved = resolveContent(
      element({ bindings: { heading: { from: "literal", value: "Festes Literal" } } }),
      { tagName: "ignoriert" },
    );
    expect(headingText(resolved)).toBe("Festes Literal");
  });

  it("entfernt Bindings beim Flatten", () => {
    const flattened = flattenBindings({
      elements: [element({ bindings: { heading: { from: "tag.displayName" } } })],
    });
    expect(flattened[0].bindings).toBeUndefined();
    expect(headingText(flattened[0].content ?? {})).toBe("Vorlage");
  });
});
