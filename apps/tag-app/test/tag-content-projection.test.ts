import { describe, expect, it } from "vitest";
import { canonicalize } from "../workers/tag-content/canonical";
import { buildProjection } from "../workers/tag-content/project";
import { validateTemplate } from "../workers/tag-content/validate";

const COLORS = {
  background: "#ffffff",
  surface: "#fafafa",
  text: "#111111",
  mutedText: "#666666",
  heading: "#111111",
  accent: "#2b6cb0",
  accentText: "#ffffff",
  border: "#dddddd",
};

/** Katalog-Defaults der Item-Fähigkeit (Spiegel des Designer-Katalogs). */
const ITEM_DEFAULTS: Record<string, Record<string, unknown>> = {
  image: { mode: "dynamic", slotIds: ["image"] },
  document: { mode: "dynamic", slotIds: ["document"] },
  gallery: { mode: "dynamic", slotIds: ["images"] },
  documents: { mode: "dynamic", slotIds: ["documents"] },
  "maintenance-history": { mode: "dynamic", slotIds: ["entries"] },
  "finder-form": { mode: "dynamic", slotIds: ["photos"] },
};

/** Zugehörige Slots; Tests dürfen sie über `overrides.slots` ersetzen. */
const SLOT_DEFAULTS: Record<string, Array<Record<string, unknown>>> = {
  image: [{ slotId: "image", accepts: ["image"], min: 0, max: 12, required: false }],
  document: [{ slotId: "document", accepts: ["document"], min: 0, max: 12, required: false }],
  gallery: [{ slotId: "images", accepts: ["image"], min: 0, max: 48, required: false }],
  documents: [{ slotId: "documents", accepts: ["document"], min: 0, max: 32, required: false }],
  "maintenance-history": [{ slotId: "entries", accepts: ["document", "image"], min: 0, max: 64, required: false }],
  "finder-form": [{ slotId: "photos", accepts: ["image"], min: 0, max: 3, required: false }],
};

function element(
  overrides: Record<string, unknown> & { elementId: string; elementType: string },
): Record<string, unknown> {
  const defaults = SLOT_DEFAULTS[overrides.elementType];
  return {
    displayOrder: 10,
    visibility: "public",
    items: ITEM_DEFAULTS[overrides.elementType] ?? { mode: "none" },
    ...(defaults ? { slots: defaults } : {}),
    payload: {},
    ...overrides,
  };
}

function template(
  elements: Array<Record<string, unknown>>,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schema: "myqr24-tag-content-template-v1",
    schemaVersion: 4,
    template: {
      templateId: "tct_projection_test",
      templateVersion: 1,
      tagType: "vault",
      name: "Vorlagenname",
      locale: "de-DE",
      status: "draft",
    },
    shell: {
      presentation: "standard",
      features: ["vault"],
      theme: { colorMode: "light", colors: { ...COLORS } },
    },
    layout: {
      mode: "grid-flow",
      columns: 12,
      gap: "md",
      responsive: { autoReflow: true },
    },
    elements,
    ...overrides,
  };
}

function parsed(document: Record<string, unknown>) {
  const result = validateTemplate(document);
  expect(result.issues).toEqual([]);
  expect(result.document).not.toBeNull();
  return result.document!;
}

function blocksOf(projection: { view: Record<string, unknown> }): Array<Record<string, unknown>> {
  const vault = projection.view.vault as { blocks: Array<Record<string, unknown>> };
  return vault.blocks;
}

describe("validateTemplate", () => {
  it("akzeptiert ein vollständiges Template", () => {
    const document = parsed(
      template([
        element({
          elementId: "cel_text",
          elementType: "text",
          displayOrder: 10,
          content: { paragraphs: [{ runs: [{ text: "Hallo" }] }] },
        }),
      ]),
    );
    expect(document.template.name).toBe("Vorlagenname");
    expect(document.elements).toHaveLength(1);
  });

  it("weist fehlendes Schema, unbekannte Typen und falsche TAG-Kombinationen ab", () => {
    expect(validateTemplate({}).issues.map((issue) => issue.code)).toContain("TEMPLATE_SCHEMA_UNKNOWN");

    const unknownType = validateTemplate(template([element({ elementId: "cel_x", elementType: "schedule" })]));
    expect(unknownType.document).toBeNull();
    expect(unknownType.issues.map((issue) => issue.code)).toContain("ELEMENT_TYPE_UNKNOWN");

    const maintenanceGallery = validateTemplate(
      template([element({ elementId: "cel_gallery", elementType: "gallery" })], {
        template: {
          templateId: "tct_maint",
          templateVersion: 1,
          tagType: "maintenance",
          name: "Wartung",
          locale: "de-DE",
          status: "draft",
        },
      }),
    );
    expect(maintenanceGallery.issues.map((issue) => issue.code)).toContain("ELEMENT_TYPE_NOT_ALLOWED");
  });

  it("validiert Placement-Spalten und gibt Platzierungsmetadaten an die Projektion weiter", () => {
    const invalid = validateTemplate(template([element({
      elementId: "cel_bad", elementType: "text", placement: { span: { desktop: 13 } },
    })]));
    expect(invalid.issues.map((issue) => issue.code)).toContain("ELEMENT_PLACEMENT_SPAN_INVALID");
    const valid = parsed(template([element({
      elementId: "cel_good", elementType: "text", placement: { span: { mobile: 12, desktop: 8 }, order: { desktop: 3 } },
    })]));
    const block = blocksOf(buildProjection({ document: valid, tagId: "ab12cd" }))[0];
    expect(block.placement).toEqual({ span: { mobile: 12, desktop: 8 }, order: { desktop: 3 } });
  });

  it("erzwingt Grenzen und Policy", () => {
    const tooMany = Array.from({ length: 25 }, (_, index) =>
      element({ elementId: `cel_${index}`, elementType: "text", displayOrder: index + 1 }),
    );
    expect(validateTemplate(template(tooMany)).issues.map((issue) => issue.code)).toContain("LIMIT_ELEMENTS");

    const policy = validateTemplate(
      template([
        element({
          elementId: "cel_text",
          elementType: "text",
          content: { paragraphs: [{ runs: [{ text: "<b>fett</b>" }] }] },
        }),
      ]),
    );
    expect(policy.issues.map((issue) => issue.code)).toContain("POLICY_HTML_MARKUP");
  });
});

describe("buildProjection", () => {
  it("bildet alle Blöcke ab und lässt Theme-Assets weg", () => {
    const document = parsed(
      template([
        element({ elementId: "cel_theme", elementType: "theme-assets", displayOrder: 0, hidden: true }),
        element({
          elementId: "cel_hero",
          elementType: "hero",
          displayOrder: 10,
          bindings: { title: { from: "tag.displayName" } },
          content: { paragraphs: [{ runs: [{ text: "Untertitel" }] }] },
        }),
        element({
          elementId: "cel_text",
          elementType: "text",
          displayOrder: 20,
          content: {
            paragraphs: [
              { heading: 2, runs: [{ text: "Über uns" }] },
              { runs: [{ text: "Ein Text mit " }, { text: "Fett", marks: [{ type: "bold" }] }] },
              {
                type: "table",
                columns: [{ align: "start" }, { align: "start" }],
                rows: [{ cells: [{ runs: [{ text: "A" }] }, { runs: [{ text: "B" }] }] }],
              },
            ],
          },
        }),
        element({
          elementId: "cel_gallery",
          elementType: "gallery",
          displayOrder: 30,
          placement: { span: { mobile: 12, tablet: 6, desktop: 4 }, order: { mobile: 10, tablet: 10, desktop: 10 }, minWidth: "18rem", align: "stretch", hint: "Galerie" },
          payload: { name: "Gästefotos" },
          slots: [{ slotId: "images", accepts: ["image"], min: 0, max: 48, required: false }],
        }),
        element({
          elementId: "cel_docs",
          elementType: "documents",
          displayOrder: 40,
          visibility: "shared",
          slots: [{ slotId: "documents", accepts: ["document"], min: 0, max: 32, required: false }],
        }),
      ]),
    );

    const projection = buildProjection({ document, tagId: "ab12cd", tagName: "Mein TAG" });
    const blocks = blocksOf(projection);

    expect(blocks.map((block) => block.type)).toEqual(["hero", "text", "gallery", "documents"]);
    expect(blocks[0]).toMatchObject({ type: "hero", title: "Mein TAG", subtitle: "Untertitel" });
    expect(blocks[1]).toMatchObject({ type: "text", title: "Über uns", paragraphs: ["Ein Text mit Fett", "A · B"] });
    expect((blocks[1].content as { paragraphs: unknown[] }).paragraphs).toHaveLength(3);
    expect(blocks[2]).toMatchObject({ type: "gallery", title: "Gästefotos", images: [] });
    expect(blocks[2]).toMatchObject({ elementId: "cel_gallery", visibility: "public", items: { mode: "dynamic" } });
    expect(blocks[2].placement).toMatchObject({ span: { desktop: 4 }, minWidth: "18rem" });
    expect(blocks[3]).toMatchObject({ type: "documents", documents: [] });
    expect(blocks[3]).toMatchObject({ elementId: "cel_docs", visibility: "shared" });
    expect(projection.elements.map((entry) => entry.elementId)).toEqual([
      "cel_hero",
      "cel_text",
      "cel_gallery",
      "cel_docs",
    ]);
  });

  it("bildet die übrigen Elementtypen als eigene Blocktypen ab", () => {
    const document = parsed(
      template([
        element({ elementId: "cel_img", elementType: "image", displayOrder: 10, payload: { fit: "contain" } }),
        element({ elementId: "cel_doc", elementType: "document", displayOrder: 20 }),
        element({ elementId: "cel_div", elementType: "divider", displayOrder: 30, payload: { style: "line" } }),
        element({ elementId: "cel_callout", elementType: "callout", displayOrder: 40, payload: { tone: "safety" } }),
        element({
          elementId: "cel_link",
          elementType: "external-link",
          displayOrder: 50,
          payload: { display: "button" },
          copy: { label: "Playlist", url: "https://example.org/x" },
        }),
      ]),
    );

    const blocks = blocksOf(buildProjection({ document, tagId: "ab12cd" }));
    expect(blocks.map((block) => block.type)).toEqual([
      "image",
      "document",
      "divider",
      "callout",
      "external-link",
    ]);
    expect(blocks[3]).toMatchObject({ tone: "safety", title: "Hinweis" });
    expect(blocks[4]).toMatchObject({ label: "Playlist", url: "https://example.org/x" });
    expect((blocks[0].options as { fit: string }).fit).toBe("contain");
  });

  it("ist deterministisch und revisionsabhängig", () => {
    const document = parsed(
      template([
        element({
          elementId: "cel_text",
          elementType: "text",
          content: { paragraphs: [{ runs: [{ text: "Hallo" }] }] },
        }),
      ]),
    );
    const first = buildProjection({ document, tagId: "ab12cd" });
    const second = buildProjection({ document, tagId: "ab12cd" });
    const one = canonicalize({ revision: 1, ...first });
    const again = canonicalize({ revision: 1, ...second });
    const nextRevision = canonicalize({ revision: 2, ...first });
    expect(one).toBe(again);
    expect(nextRevision).not.toBe(one);
  });

  it("übernimmt Theme und Layout in den View", () => {
    const document = parsed(template([element({ elementId: "cel_text", elementType: "text" })]));
    const view = buildProjection({ document, tagId: "ab12cd" }).view;
    expect(view.theme).toBeDefined();
    expect((view.tag as { displayName: string }).displayName).toBe("Vorlagenname");
    expect(view.enabledFeatures).toEqual(["vault"]);
  });
});

