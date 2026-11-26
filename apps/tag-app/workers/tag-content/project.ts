import type { VDocument, VElement } from "./validate";

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  !!value && typeof value === "object" && !Array.isArray(value);

const asString = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

function optionString(element: VElement, key: string, fallback: string): string {
  const value = element.payload[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function runsText(runs: unknown): string {
  if (!Array.isArray(runs)) return "";
  return runs
    .map((run) => (isObject(run) && typeof run.text === "string" ? run.text : ""))
    .join("");
}

function tableRowText(row: unknown): string {
  if (!isObject(row) || !Array.isArray(row.cells)) return "";
  return row.cells
    .map((cell) => (isObject(cell) ? runsText(cell.runs) : ""))
    .join(" · ");
}

/**
 * RichText → Titel und Klartext-Absätze (Kompatibilitätsfelder der App).
 * Tabellen werden zeilenweise abgeflacht; die Struktur bleibt in `content`.
 */
export function contentTexts(content: JsonObject | undefined): { title?: string; paragraphs: string[] } {
  const result: { title?: string; paragraphs: string[] } = { paragraphs: [] };
  const blocks = content?.paragraphs;
  if (!Array.isArray(blocks)) return result;
  for (const block of blocks) {
    if (!isObject(block)) continue;
    if (block.type === "table") {
      const rows = Array.isArray(block.rows) ? block.rows.map(tableRowText).filter((text) => text.length > 0) : [];
      result.paragraphs.push(...rows);
      continue;
    }
    const text = runsText(block.runs).trim();
    if (text.length === 0) continue;
    if (block.heading !== undefined && result.title === undefined) {
      result.title = text;
      continue;
    }
    result.paragraphs.push(text);
  }
  return result;
}

/** Gemeinsamer Rahmen jedes Blocks: strukturierte Nutzlast zusätzlich zu den Pflichtfeldern. */
function baseBlock(type: string, element: VElement, extra: JsonObject): JsonObject {
  const block: JsonObject = {
    type,
    // Adressierung für die Element-Items-API und die Sichtbarkeitsprojektion.
    elementId: element.elementId,
    visibility: element.visibility,
    items: element.items,
    ...extra,
  };
  if (element.placement) block.placement = element.placement;
  if (element.content) block.content = element.content;
  if (Object.keys(element.payload).length > 0) block.options = element.payload;
  if (element.style) block.style = element.style;
  if (element.slots.length > 0) block.slots = element.slots;
  if (element.actions) block.actions = element.actions;
  if (element.bindings) block.bindings = element.bindings;
  return block;
}

export function buildBlock(
  element: VElement,
  context: { tagName: string; templateName: string },
): JsonObject | null {
  if (element.hidden) return null;
  const { title, paragraphs } = contentTexts(element.content);
  const first = paragraphs[0];

  switch (element.elementType) {
    case "hero":
      return baseBlock("hero", element, {
        title: context.tagName || title || context.templateName,
        ...(first ? { subtitle: first } : {}),
      });
    case "text": {
      const block = baseBlock("text", element, { paragraphs });
      if (title) block.title = title;
      return block;
    }
    case "callout": {
      const tone = optionString(element, "tone", "info");
      return baseBlock("callout", element, {
        tone: tone === "notice" || tone === "safety" ? tone : "info",
        title: title ?? "Hinweis",
        text: paragraphs.join("\n"),
      });
    }
    case "gallery":
      return baseBlock("gallery", element, {
        title: title ?? optionString(element, "name", "Galerie"),
        images: [],
        ...(element.actions ? { actions: element.actions } : {}),
      });
    case "documents":
      return baseBlock("documents", element, {
        title: title ?? "Dokumente",
        documents: [],
        ...(element.actions ? { actions: element.actions } : {}),
      });
    case "external-link": {
      const copy = element.copy ?? {};
      const label = typeof copy.label === "string" && copy.label.length > 0 ? copy.label : "Weitere Informationen";
      const url = typeof copy.url === "string" ? copy.url : "";
      return baseBlock("external-link", element, { label, url });
    }
    case "image":
      return baseBlock("image", element, { ...(title ? { title } : {}), ...(paragraphs.length ? { description: paragraphs.join("\n") } : {}) });
    case "document":
      return baseBlock("document", element, { ...(title ? { title } : {}), ...(paragraphs.length ? { description: paragraphs.join("\n") } : {}) });
    case "divider":
      return baseBlock("divider", element, { ...(title ? { title } : {}) });
    case "finder-notice":
      return baseBlock("notice", element, { urgency: optionString(element, "urgency", "normal"), ...(title ? { title } : {}), ...(paragraphs.length ? { text: paragraphs.join("\n") } : {}) });
    case "finder-form":
      return baseBlock("finder-form", element, { channel: optionString(element, "channel", "server-mediated"), ...(title ? { title } : {}), ...(paragraphs.length ? { description: paragraphs.join("\n") } : {}) });
    case "contact-channel":
      return baseBlock("contact", element, { method: optionString(element, "method", "form"), ...(title ? { title } : {}), ...(paragraphs.length ? { description: paragraphs.join("\n") } : {}) });
    case "maintenance-history":
      return baseBlock("maintenance", element, {
        groupBy: optionString(element, "groupBy", "none"),
        dateFormat: optionString(element, "dateFormat", "de-DE"),
        ...(title ? { title } : {}),
        ...(paragraphs.length ? { description: paragraphs.join("\n") } : {}),
      });
    default:
      return null;
  }
}

export interface ProjectionElement {
  elementId: string;
  elementType: string;
  displayOrder: number;
  visibility: string;
  /** Item-Fähigkeit; nur `dynamic` erzeugt eine D1-Elementzeile. */
  items: { mode: "none" | "dynamic"; slotIds?: string[] };
  payload: JsonObject;
}

export interface Projection {
  view: JsonObject;
  elements: ProjectionElement[];
}

function elementPayload(element: VElement): JsonObject {
  const payload: JsonObject = { options: element.payload, items: element.items };
  if (element.style) payload.style = element.style;
  if (element.content) payload.content = element.content;
  if (element.slots.length > 0) payload.slots = element.slots;
  if (element.actions) payload.actions = element.actions;
  if (element.bindings) payload.bindings = element.bindings;
  if (element.editability) payload.editability = element.editability;
  return payload;
}

/**
 * Baut die Laufzeitprojektion: `view` (App-Sicht) und `elements` (vollständige
 * Element-Nutzlasten). Beide entstehen aus demselben Template und werden in
 * **einem** Dokument gespeichert (`D-14`).
 */
export function buildProjection(input: {
  document: VDocument;
  tagId: string;
  tagName?: string;
}): Projection {
  const { document, tagId } = input;
  const displayName = input.tagName?.trim() || document.template.name;
  const visible = document.elements
    .filter((element) => !element.hidden)
    .slice()
    .sort((left, right) => left.displayOrder - right.displayOrder || left.elementId.localeCompare(right.elementId));

  const blocks: JsonObject[] = [];
  for (const element of visible) {
    const block = buildBlock(element, { tagName: displayName, templateName: document.template.name });
    if (block) blocks.push(block);
  }

  const view: JsonObject = {
    tag: { id: tagId, displayName, presentation: document.shell.presentation },
    vault: { blocks },
    enabledFeatures: document.shell.features,
  };
  if (document.shell.theme) view.theme = document.shell.theme;
  if (Object.keys(document.layout).length > 0) view.layout = document.layout;

  return {
    view,
    elements: visible.map((element) => ({
      elementId: element.elementId,
      elementType: element.elementType,
      displayOrder: element.displayOrder,
      ...(element.placement ? { placement: element.placement } : {}),
      visibility: element.visibility,
      items: element.items,
      payload: elementPayload(element),
    })),
  };
}

