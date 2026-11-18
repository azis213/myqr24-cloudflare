import { SCHEMA_VERSION, TEMPLATE_SCHEMA } from "./types";
import type {
  ElementType,
  Feature,
  Presentation,
  TagContentDocument,
  TagType,
  TemplateElement,
  TemplateSlot,
} from "./types";

export const TAG_TYPES: TagType[] = ["vault", "lost-found", "event", "exhibit", "maintenance"];

export const PRESENTATIONS: Presentation[] = [
  "standard",
  "gallery",
  "public-page",
  "museum-exhibit",
  "summit-guide",
  "wedding",
];

export const FEATURES: Feature[] = ["vault", "lost-found", "guestbook", "check-in"];

export const TAG_TYPE_FEATURES: Record<TagType, Feature[]> = {
  vault: ["vault"],
  "lost-found": ["vault", "lost-found"],
  event: ["vault"],
  exhibit: ["vault"],
  maintenance: ["vault"],
};

export const TAG_TYPE_LABELS: Record<TagType, string> = {
  vault: "Vault",
  "lost-found": "Lost & Found",
  event: "Event",
  exhibit: "Ausstellung",
  maintenance: "Wartung",
};

export interface CatalogEntry {
  type: ElementType;
  label: string;
  requiredV1: boolean;
  tagTypes: TagType[];
  payload: Record<string, unknown>;
  copy?: Record<string, unknown>;
  slots?: TemplateSlot[];
  hidden?: boolean;
}

const imageSlot = (slotId = "images", max = 48, min = 0): TemplateSlot => ({
  slotId,
  accepts: ["image"],
  min,
  max,
  required: min > 0,
  presentation: { fit: "cover", caption: "optional" },
});

const documentSlot = (slotId = "documents", max = 32, min = 0): TemplateSlot => ({
  slotId,
  accepts: ["document"],
  min,
  max,
  required: min > 0,
});

export const ELEMENT_CATALOG: Record<ElementType, CatalogEntry> = {
  text: {
    type: "text",
    label: "Text",
    requiredV1: true,
    tagTypes: TAG_TYPES,
    payload: { headingLevel: "h2", align: "start", maxParagraphs: 8 },
  },
  image: {
    type: "image",
    label: "Einzelbild",
    requiredV1: true,
    tagTypes: TAG_TYPES,
    payload: { fit: "contain", zoom: "tap", maxHeight: "auto" },
    slots: [{ ...imageSlot("image", 1, 1), presentation: { fit: "contain", caption: "optional" } }],
  },
  document: {
    type: "document",
    label: "Dokument",
    requiredV1: true,
    tagTypes: TAG_TYPES,
    payload: { display: "link", boxHeight: "md", showMeta: true },
    slots: [documentSlot("document", 1, 1)],
  },
  gallery: {
    type: "gallery",
    label: "Galerie",
    requiredV1: true,
    tagTypes: ["vault", "lost-found", "event", "exhibit"],
    payload: {
      name: "Galerie",
      picker: { axis: "horizontal", thumbSize: "md", showCounter: true },
      viewer: { sizeMode: "medium", swipe: true, loop: false, showCaptions: true },
      lightbox: true,
      maxImages: 48,
    },
    slots: [imageSlot()],
  },
  documents: {
    type: "documents",
    label: "Dokumentenliste",
    requiredV1: true,
    tagTypes: ["vault", "event", "exhibit", "maintenance"],
    payload: { view: "list", showMeta: true, sort: "date-desc", maxItems: 32 },
    slots: [documentSlot()],
  },
  hero: {
    type: "hero",
    label: "Titelbereich",
    requiredV1: false,
    tagTypes: TAG_TYPES,
    payload: { variant: "cover" },
    slots: [imageSlot("cover", 1)],
  },
  callout: {
    type: "callout",
    label: "Hinweis",
    requiredV1: false,
    tagTypes: TAG_TYPES,
    payload: { tone: "info" },
    copy: { heading: "Hinweis", paragraphs: ["Bitte beachten Sie die folgenden Informationen."] },
  },
  "external-link": {
    type: "external-link",
    label: "Externer Link",
    requiredV1: false,
    tagTypes: ["vault", "event", "exhibit", "maintenance"],
    payload: { display: "button" },
    copy: { label: "Weitere Informationen", url: "" },
  },
  divider: {
    type: "divider",
    label: "Trenner",
    requiredV1: false,
    tagTypes: TAG_TYPES,
    payload: { style: "line" },
  },
  "finder-notice": {
    type: "finder-notice",
    label: "Fundhinweis",
    requiredV1: false,
    tagTypes: ["lost-found"],
    payload: { urgency: "normal" },
    copy: {
      heading: "Sie haben diesen Gegenstand gefunden?",
      paragraphs: ["Bitte nutzen Sie die Funktion „Fund melden“, damit der Eigentümer informiert wird."],
    },
  },
  "finder-form": {
    type: "finder-form",
    label: "Fund melden",
    requiredV1: false,
    tagTypes: ["lost-found"],
    payload: { channel: "server-mediated" },
    copy: {
      heading: "Fund melden",
      paragraphs: ["Ihre Angaben werden ausschließlich zur Kontaktaufnahme verwendet."],
    },
    slots: [imageSlot("photos", 3)],
  },
  "contact-channel": {
    type: "contact-channel",
    label: "Kontaktweg",
    requiredV1: false,
    tagTypes: ["vault", "lost-found"],
    payload: { method: "form" },
  },
  "maintenance-history": {
    type: "maintenance-history",
    label: "Wartungshistorie",
    requiredV1: false,
    tagTypes: ["maintenance"],
    payload: { groupBy: "year", showTotals: false, dateFormat: "de-DE" },
    slots: [{ slotId: "entries", accepts: ["document", "image"], min: 0, max: 64, required: false }],
  },
  "theme-assets": {
    type: "theme-assets",
    label: "Theme-Assets",
    requiredV1: false,
    tagTypes: TAG_TYPES,
    payload: { role: "background" },
    hidden: true,
    slots: [{ slotId: "tag-background", accepts: ["image"], min: 0, max: 1, required: false }],
  },
};

export function allowedTypesFor(tagType: TagType): CatalogEntry[] {
  return Object.values(ELEMENT_CATALOG).filter(
    (entry) => !entry.hidden && entry.tagTypes.includes(tagType),
  );
}

export function newElementId(type: ElementType): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `cel_${type.replace(/[^a-z0-9]/g, "")}_${suffix}`;
}

export function copyToContent(copy: Record<string, unknown>) {
  const heading = typeof copy.heading === "string" ? copy.heading : undefined;
  const paragraphs = Array.isArray(copy.paragraphs)
    ? copy.paragraphs
        .filter((entry): entry is string => typeof entry === "string")
        .map((text) => ({ runs: [{ text }] }))
    : undefined;
  return { heading, paragraphs };
}

export function createElement(
  type: ElementType,
  displayOrder: number,
  elementId = newElementId(type),
): TemplateElement {
  const entry = ELEMENT_CATALOG[type];
  if (!entry) throw new Error(`Unbekannter Elementtyp: ${type}`);
  const element: TemplateElement = {
    elementId,
    elementType: type,
    displayOrder,
    visibility: "public",
    payload: structuredClone(entry.payload),
    placement: {
      span: { mobile: 12, tablet: 12, desktop: 12 },
      order: { mobile: displayOrder, tablet: displayOrder, desktop: displayOrder },
    },
  };
  if (entry.slots) element.slots = structuredClone(entry.slots);
  if (entry.copy) {
    element.copy = structuredClone(entry.copy);
    element.content = copyToContent(element.copy);
  }
  if (entry.hidden) element.hidden = true;
  return element;
}

export const DEFAULT_THEME = {
  colorMode: "light" as const,
  colors: {
    background: "#f7f5f0",
    surface: "#ffffff",
    text: "#1c1c1c",
    mutedText: "#5a5a5a",
    heading: "#14231c",
    accent: "#1f513d",
    accentText: "#ffffff",
    border: "#e2ded6",
    danger: "#b3261e",
    success: "#1b6b3a",
  },
  buttons: {
    primary: { background: "accent", text: "accentText", border: "none", radius: "pill" },
    secondary: { background: "surface", text: "text", border: "thin", radius: "soft" },
  },
  typography: { fontFamily: "system" as const, headingScale: 1, bodySize: 16, lineHeight: 1.55 },
  layout: {
    contentWidth: "narrow" as const,
    density: "comfortable" as const,
    cornerStyle: "soft" as const,
  },
};

export function createDocument(options: {
  templateId: string;
  tagType: TagType;
  name: string;
  presentation?: Presentation;
  templateVersion?: number;
}): TagContentDocument {
  const { templateId, tagType, name } = options;
  const presentation = options.presentation ?? "standard";
  return {
    schema: TEMPLATE_SCHEMA,
    schemaVersion: SCHEMA_VERSION,
    template: {
      templateId,
      templateVersion: options.templateVersion ?? 1,
      tagType,
      name,
      description: "",
      locale: "de-DE",
      status: "draft",
      compatibility: { protectionModes: ["public", "pin_required"], presentations: [presentation] },
    },
    shell: {
      presentation,
      features: [...TAG_TYPE_FEATURES[tagType]],
      theme: structuredClone(DEFAULT_THEME),
      navigation: { mode: "single", items: [] },
      statusBar: { showTagId: true, showPresentation: false },
    },
    layout: {
      mode: "grid-flow",
      columns: 12,
      gap: "md",
      container: { maxWidth: "wide", padding: "normal" },
      responsive: {
        autoReflow: true,
        minColumnWidth: { tablet: "16rem", desktop: "18rem" },
        preferredColumns: { mobile: 1, tablet: 2, desktop: 3 },
      },
    },
    elements: [createElement("theme-assets", 0, "cel_theme"), createElement("text", 10, "cel_intro")],
  };
}

