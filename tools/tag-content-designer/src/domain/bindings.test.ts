import { describe, expect, it } from "vitest";
import type { TemplateElement } from "./types";
import { flattenBindings, isKnownBindingSource, resolveContent } from "./bindings";

const element = (overrides: Partial<TemplateElement> = {}): TemplateElement => ({
  elementId: "cel_text",
  elementType: "text",
  displayOrder: 10,
  visibility: "public",
  payload: {},
  content: { heading: "Vorlage", paragraphs: [{ runs: [{ text: "Text" }] }] },
  ...overrides,
});

describe("bindings", () => {
  it("kennt nur die drei erlaubten Quellen", () => {
    expect(isKnownBindingSource("tag.displayName")).toBe(true);
    expect(isKnownBindingSource("tag.id")).toBe(true);
    expect(isKnownBindingSource("literal")).toBe(true);
    expect(isKnownBindingSource("owner.contactChannel")).toBe(false);
  });

  it("löst tag.displayName auf", () => {
    const resolved = resolveContent(
      element({ bindings: { heading: { from: "tag.displayName" } } }),
      { tagName: "Reisekoffer" },
    );
    expect(resolved.heading).toBe("Reisekoffer");
  });

  it("fällt ohne Kontext auf den Vorlagentext zurück", () => {
    const resolved = resolveContent(element({ bindings: { heading: { from: "tag.displayName" } } }), {});
    expect(resolved.heading).toBe("Vorlage");
  });

  it("nutzt literal-Werte", () => {
    const resolved = resolveContent(
      element({ bindings: { heading: { from: "literal", value: "Festes Literal" } } }),
      { tagName: "ignoriert" },
    );
    expect(resolved.heading).toBe("Festes Literal");
  });

  it("entfernt Bindings beim Flatten", () => {
    const flattened = flattenBindings({
      elements: [element({ bindings: { heading: { from: "tag.displayName" } } })],
    });
    expect(flattened[0].bindings).toBeUndefined();
    expect(flattened[0].content?.heading).toBe("Vorlage");
  });
});
