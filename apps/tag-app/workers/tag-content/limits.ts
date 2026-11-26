/**
 * Grenzen und Kataloge für den TAG-Content-Publish.
 *
 * Quelle der Wahrheit ist der TAG-Content-Designer
 * (`tools/tag-content-designer/src/domain/{types,catalog}.ts`). Die Werte sind
 * hier bewusst kopiert: Der Designer ist ein eigenständiges Tool ohne
 * Workspace-Paket, und der Worker soll keine React-/DOM-Abhängigkeiten ziehen.
 * Änderungen dort müssen hier nachgezogen werden.
 */

export const TEMPLATE_SCHEMA = "myqr24-tag-content-template-v1";
export const CONTENT_SCHEMA = "myqr24-tag-content-v2";
/** 4: Jedes Element deklariert seine Item-Fähigkeit (`items.mode`). */
export const SCHEMA_VERSION = 4;

export const MAX_TEMPLATE_BYTES = 128 * 1024;
export const MAX_REQUEST_BYTES = 132 * 1024;
export const MAX_ELEMENTS = 24;
export const MAX_SLOTS_PER_ELEMENT = 16;
export const MAX_ITEMS_PER_SLOT = 64;
export const MAX_PARAGRAPHS = 16;
export const MAX_TEXT_LENGTH = 2048;
export const MAX_HEADING_LENGTH = 120;
export const MAX_TABLES = 2;
export const MAX_TABLE_COLUMNS = 6;
export const MAX_TABLE_ROWS = 20;
export const MAX_TABLE_CELL_LENGTH = 200;
export const MAX_LIST_LEVEL = 3;
export const MAX_INDENT = 3;
export const MAX_CUSTOM_COLORS = 24;

export const TAG_TYPES = ["vault", "lost-found", "event", "exhibit", "maintenance"] as const;
export type TagType = (typeof TAG_TYPES)[number];

export const PRESENTATIONS = [
  "standard",
  "gallery",
  "public-page",
  "museum-exhibit",
  "summit-guide",
  "wedding",
] as const;
export type Presentation = (typeof PRESENTATIONS)[number];

export const FEATURES = ["vault", "lost-found", "guestbook", "check-in"] as const;
export type Feature = (typeof FEATURES)[number];

export const TAG_TYPE_FEATURES: Record<TagType, Feature[]> = {
  vault: ["vault"],
  "lost-found": ["vault", "lost-found"],
  event: ["vault"],
  exhibit: ["vault"],
  maintenance: ["vault"],
};

export const VISIBILITIES = ["public", "shared", "private", "ownerOnly"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const ELEMENT_TYPES = [
  "text",
  "image",
  "document",
  "gallery",
  "documents",
  "hero",
  "callout",
  "external-link",
  "divider",
  "finder-notice",
  "finder-form",
  "contact-channel",
  "maintenance-history",
  "theme-assets",
] as const;
export type ElementType = (typeof ELEMENT_TYPES)[number];

/** Element-Typen je TAG-Typ (aus dem Designer-Katalog). */
export const ELEMENT_TYPE_TAG_TYPES: Record<ElementType, readonly TagType[]> = {
  text: TAG_TYPES,
  image: TAG_TYPES,
  document: TAG_TYPES,
  gallery: ["vault", "lost-found", "event", "exhibit"],
  documents: ["vault", "event", "exhibit", "maintenance"],
  hero: TAG_TYPES,
  callout: TAG_TYPES,
  "external-link": ["vault", "event", "exhibit", "maintenance"],
  divider: TAG_TYPES,
  "finder-notice": ["lost-found"],
  "finder-form": ["lost-found"],
  "contact-channel": ["vault", "lost-found"],
  "maintenance-history": ["maintenance"],
  "theme-assets": TAG_TYPES,
};

/** Elemente, die nie als eigener Block/Elementzeile erscheinen. */
export const HIDDEN_ELEMENT_TYPES: readonly ElementType[] = ["theme-assets"];

export const ITEM_MODES = ["none", "dynamic"] as const;
export type ItemMode = (typeof ITEM_MODES)[number];

export interface ElementItems {
  mode: ItemMode;
  /** Slots, die Items aufnehmen; leer zulässig für Subsystem-Items (Chat). */
  slotIds?: string[];
}

/**
 * Item-Fähigkeit je Elementtyp (Kopie des Designer-Katalogs). Nur `dynamic`
 * erzeugt beim Publish eine Zeile in `tag_content_elements` und kann Items
 * aufnehmen. Einzelbild und Einzel-Dokument sind ebenfalls `dynamic`: Sie halten
 * mehrere Kandidaten, angezeigt wird genau eines.
 */
export const ELEMENT_ITEMS: Record<ElementType, ElementItems> = {
  text: { mode: "none" },
  image: { mode: "dynamic", slotIds: ["image"] },
  document: { mode: "dynamic", slotIds: ["document"] },
  gallery: { mode: "dynamic", slotIds: ["images"] },
  documents: { mode: "dynamic", slotIds: ["documents"] },
  hero: { mode: "none" },
  callout: { mode: "none" },
  "external-link": { mode: "none" },
  divider: { mode: "none" },
  "finder-notice": { mode: "none" },
  "finder-form": { mode: "dynamic", slotIds: ["photos"] },
  "contact-channel": { mode: "none" },
  "maintenance-history": { mode: "dynamic", slotIds: ["entries"] },
  "theme-assets": { mode: "none" },
};

/** Anzeigeform: `single` zeigt genau ein Item (das neueste sichtbare). */
export const ELEMENT_DISPLAY_MODE: Record<ElementType, "single" | "all"> = {
  text: "all",
  image: "single",
  document: "single",
  gallery: "all",
  documents: "all",
  hero: "all",
  callout: "all",
  "external-link": "all",
  divider: "all",
  "finder-notice": "all",
  "finder-form": "all",
  "contact-channel": "all",
  "maintenance-history": "all",
  "theme-assets": "all",
};

/** Sichtprinzipale; `viewAs` darf nur verengen, nie erweitern. */
export const SLOT_ACCEPTS = ["image", "document", "audio"] as const;
export const PRINCIPALS = ["scanner", "guest", "owner"] as const;
/** Sichtprinzipale; `viewAs` darf nur verengen, nie erweitern. */
export type Principal = (typeof PRINCIPALS)[number];
export const MARK_NAMES = ["bold", "italic", "underline"] as const;
export const TEXT_ALIGNS = ["start", "center", "end"] as const;
export const FONT_FAMILIES = ["sans", "serif", "mono"] as const;
export const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32] as const;
export const LINE_HEIGHTS = [1, 1.15, 1.3, 1.5, 1.75, 2] as const;
export const HEADING_LEVELS = [1, 2, 3, 4, 5] as const;
export const LIST_KINDS = ["bullet", "ordered"] as const;
export const TABLE_BORDER_STYLES = ["solid", "dashed", "dotted", "double"] as const;
export const TABLE_BORDER_WIDTHS = [1, 2] as const;
export const PADDINGS = ["none", "sm", "md", "lg"] as const;
export const BREAKPOINTS = ["mobile", "tablet", "desktop"] as const;

export const HEX_COLOR = /^#[0-9a-f]{6}$/;
/** Theme-Tokens, die im Style erlaubt sind. */
export const COLOR_TOKENS = new Set([
  "background",
  "surface",
  "text",
  "mutedText",
  "heading",
  "accent",
  "accentText",
  "border",
  "danger",
  "success",
]);

export const ELEMENT_ID = /^cel_[A-Za-z0-9_-]{1,120}$/;
export const SLOT_ID = /^[a-z][a-z0-9-]{0,31}$/;
export const TEMPLATE_ID = /^[a-z][a-z0-9_]{2,63}$/;
export const TAG_ID = /^(?:[0-9a-z]{6}|[0-9a-z]{8}|[0-9a-z]{10})$/;
export const NUMERIC_ID = /^[1-9][0-9]{0,15}$/;
export const TAG_NUMERIC_MAX = 3656158440062975;
export const REM_VALUE = /^[0-9]{1,3}(?:\.[0-9])?rem$/;
export const LINK_TARGET = /^(https:\/\/|mailto:)/;
export const HTML_MARKUP = /<[a-z!/]/i;
export const EVENT_HANDLER = /\son[a-z]+\s*=/i;
export const CSS_URL = /url\s*\(/i;
export const DATA_URL = /data:[a-z]/i;
export const SCRIPT_URL = /javascript:/i;

export const STORAGE_KEY_NAMES = new Set([
  "object_key",
  "objectKey",
  "r2_key",
  "r2Key",
  "bucket",
  "bucket_name",
  "bucketName",
  "presigned_url",
  "presignedUrl",
]);

export const TEMPLATE_STATUS = ["draft", "pending-review", "published", "retired"] as const;
export const LOCALES = ["de-DE"] as const;
