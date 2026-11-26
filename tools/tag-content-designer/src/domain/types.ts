export const TEMPLATE_SCHEMA = "myqr24-tag-content-template-v1" as const;
export const INSTANCE_SCHEMA = "myqr24-tag-content-instance-v1" as const;
export const LIBRARY_SCHEMA = "myqr24-tag-element-library-v1" as const;
/**
 * Version des Bibliotheksformats – unabhängig von der Dokument-Version, weil sich
 * die Element-Bibliothek bei Schema-Wechseln des Dokuments nicht mitändert.
 */
export const LIBRARY_SCHEMA_VERSION = 1;
/** 2: Überschriften liegen als Absatz-Attribut (`paragraph.heading`) im Absatzfluss.
 *  3: Tabellenzellen tragen Runs (Farbe/Markierung/Marks/Links) statt reinem Text.
 *  4: Jedes Element deklariert seine Item-Fähigkeit (`element.items`). */
export const SCHEMA_VERSION = 4;
/** Gesamtbudget der kanonischen Datei: Platz für Text und Tabellen mit Rahmen/Hintergründen. */
export const MAX_DOCUMENT_BYTES = 128 * 1024;
export const MAX_ELEMENTS = 24;
export const MAX_SLOTS_PER_ELEMENT = 16;
export const MAX_ITEMS_PER_SLOT = 64;
export const MAX_PARAGRAPHS = 16;
export const MAX_TEXT_LENGTH = 2048;
export const MAX_HEADING_LENGTH = 120;
/** Tabellen: bewusst klein gehalten (Zellen sind Inline-Text ohne Absätze). */
export const MAX_TABLE_COLUMNS = 6;
export const MAX_TABLE_ROWS = 20;
/** Zeichen je Zelle über alle Runs (inkl. weicher Umbrüche). */
export const MAX_TABLE_CELL_LENGTH = 200;
export const MAX_TABLES = 2;

/** Gitter: ein Rahmen für die ganze Tabelle (keine Einzelkanten – siehe SPEC §3.3). */
export const TABLE_BORDER_STYLES = ["solid", "dashed", "dotted", "double"] as const;
export type TableBorderStyle = (typeof TABLE_BORDER_STYLES)[number];
export const TABLE_BORDER_WIDTHS = [1, 2] as const;
export type TableBorderWidth = (typeof TABLE_BORDER_WIDTHS)[number];

export interface TableBorder {
  /** `#rrggbb` */
  color: string;
  style: TableBorderStyle;
  width: TableBorderWidth;
}
/** Obergrenze für selbst angelegte Farben (Palette der Formatierleiste). */
export const MAX_CUSTOM_COLORS = 24;

export type TagType = "vault" | "lost-found" | "event" | "exhibit" | "maintenance";
export type Visibility = "public" | "shared" | "private" | "ownerOnly";
export type Presentation =
  | "standard"
  | "gallery"
  | "public-page"
  | "museum-exhibit"
  | "summit-guide"
  | "wedding";
export type Feature = "vault" | "lost-found" | "guestbook" | "check-in";
export type ElementType =
  | "text"
  | "image"
  | "document"
  | "gallery"
  | "documents"
  | "hero"
  | "callout"
  | "external-link"
  | "divider"
  | "finder-notice"
  | "finder-form"
  | "contact-channel"
  | "maintenance-history"
  | "theme-assets";
export type Breakpoint = "mobile" | "tablet" | "desktop";
export type Principal = "scanner" | "guest" | "owner";
export type SlotAccept = "image" | "document" | "audio";

/**
 * Item-Fähigkeit eines Elements. `dynamic` bedeutet: Das Element bekommt beim
 * Publish eine Zeile in `tag_content_elements` und kann in der operativen
 * Nutzung eigene `tag_content_element_items` aufnehmen (Galerie, Dokumentenliste,
 * Wartungshistorie, Einzelbild, Einzel-Dokument, Chat). `none` bedeutet: Der
 * Inhalt steht ausschließlich im Tag-Dokument, es entsteht keine Elementzeile.
 */
export const ITEM_MODES = ["none", "dynamic"] as const;
export type ItemMode = (typeof ITEM_MODES)[number];

export interface ElementItems {
  mode: ItemMode;
  /**
   * Slots, die Items aufnehmen. Leer/fehlend ist zulässig, wenn die Items aus
   * einem Subsystem stammen (z. B. Chat) statt aus einem Upload.
   */
  slotIds?: string[];
}

/** Anzeigeform eines item-fähigen Elements: genau ein Item oder alle Items. */
export type DisplayMode = "single" | "all";
export type MarkName = "bold" | "italic" | "underline";

/** Geschlossene Skalen für Zeichen- und Absatzformatierung (kein freies CSS). */
export const FONT_SIZE_SCALE = [12, 14, 16, 18, 20, 24, 28, 32] as const;
export type FontSize = (typeof FONT_SIZE_SCALE)[number];
export const FONT_FAMILIES = ["sans", "serif", "mono"] as const;
export type FontFamily = (typeof FONT_FAMILIES)[number];
export const TEXT_ALIGNS = ["start", "center", "end"] as const;
export type TextAlign = (typeof TEXT_ALIGNS)[number];
export const LINE_HEIGHT_SCALE = [1, 1.15, 1.3, 1.5, 1.75, 2] as const;
export type LineHeight = (typeof LINE_HEIGHT_SCALE)[number];
export const LIST_KINDS = ["bullet", "ordered"] as const;
export type ListKind = (typeof LIST_KINDS)[number];
export const MAX_LIST_LEVEL = 3;
export const MAX_INDENT = 3;
/** Überschriftenebenen; jede Textzeile kann eine Überschrift sein. */
export const HEADING_LEVELS = [1, 2, 3, 4, 5] as const;
export type HeadingLevel = (typeof HEADING_LEVELS)[number];
/** Standardebene für migrierte/neue Überschriften (entspricht der bisherigen Optik). */
export const DEFAULT_HEADING_LEVEL: HeadingLevel = 3;

export interface Mark {
  type: MarkName;
}

export interface RunLink {
  /** Nur `https://…` oder `mailto:…`; wird validiert. */
  href: string;
}

export interface TextRun {
  text: string;
  marks?: Mark[];
  /** Zeichenfarbe, `#rrggbb`. */
  color?: string;
  /** Hintergrundfarbe des markierten Textes, `#rrggbb`. */
  background?: string;
  fontSize?: FontSize;
  fontFamily?: FontFamily;
  link?: RunLink;
}

export interface Paragraph {
  runs: TextRun[];
  align?: TextAlign;
  lineHeight?: LineHeight;
  /** Einrückung ohne Liste, 0–3. */
  indent?: number;
  /** Aufzählung/Nummerierung; `level` 0–3. Nicht zusammen mit `heading`. */
  list?: { kind: ListKind; level: number };
  /** Zeile ist eine Überschrift 1–5. Nicht zusammen mit `list`. */
  heading?: HeadingLevel;
}

/** Tabellenzelle: Inline-Runs wie im Absatz (ohne Absätze/Listen) plus Zellhintergrund. */
export interface TableCell {
  runs: TextRun[];
  /** Hintergrundfarbe der Zelle `#rrggbb` (nicht zu verwechseln mit `TextRun.background`). */
  background?: string;
}

export interface TableBlock {
  type: "table";
  columns: Array<{ align?: TextAlign }>;
  rows: Array<{ header?: boolean; cells: TableCell[] }>;
  /** Gitterrahmen für die ganze Tabelle; fehlt er, bleibt die Tabelle rahmenlos. */
  border?: TableBorder;
}

/** Geordneter Inhalt eines Textfelds: Absätze (inkl. Überschriften) und Tabellen. */
export type ContentBlock = Paragraph | TableBlock;

export interface RichTextContent {
  /**
   * @deprecated Überschriften stehen seit schemaVersion 2 als `paragraph.heading` im Absatzfluss.
   * Das Feld bleibt nur als Eingang für ältere Dateien (Migration) und wird beim Laden überführt.
   */
  heading?: string;
  paragraphs?: ContentBlock[];
}

export interface TemplateSlot {
  slotId: string;
  accepts: SlotAccept[];
  min: number;
  max: number;
  required: boolean;
  presentation?: {
    fit?: "cover" | "contain";
    caption?: "none" | "optional" | "required";
    downloadable?: boolean;
  };
}

export interface ActionRule {
  enabled: boolean;
  principals?: Principal[];
  acceptedTypes?: SlotAccept[];
  maxItemsPerPrincipal?: number;
  maxFileSizeMb?: number;
  afterUpload?: "quarantine" | "ready";
  guestScope?: "ownOnly";
}

export interface ElementActions {
  upload?: ActionRule;
  download?: ActionRule;
  delete?: ActionRule;
}

export interface Editability {
  allow: string[];
  limits?: {
    allowAddElements?: boolean;
    allowRemoveElements?: boolean;
    maxRemovedElements?: number;
    allowReorder?: boolean;
    allowThemeImage?: boolean;
    minRemainingElements?: number;
  };
  fieldRules?: Array<{ path: string; maxLength?: number; maxItems?: number }>;
}

export interface Placement {
  span?: Partial<Record<Breakpoint, number>>;
  order?: Partial<Record<Breakpoint, number>>;
  minWidth?: string;
  align?: "start" | "stretch" | "center";
  hint?: string;
}

export interface ElementStyle {
  background?: { type: "solid"; color: string };
  headingColor?: string;
  textColor?: string;
  padding?: "none" | "sm" | "md" | "lg";
  align?: "start" | "center";
}

export interface TemplateElement {
  elementId: string;
  elementType: ElementType;
  displayOrder: number;
  visibility: Visibility;
  hidden?: boolean;
  locked?: boolean;
  /** Item-Fähigkeit; wird beim Publish ausgewertet (Elementzeile ja/nein). */
  items: ElementItems;
  placement?: Placement;
  style?: ElementStyle;
  payload: Record<string, unknown>;
  copy?: Record<string, unknown>;
  bindings?: Record<string, { from: string; value?: string }>;
  content?: RichTextContent;
  actions?: ElementActions;
  editability?: Editability;
  slots?: TemplateSlot[];
}

export interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  mutedText: string;
  heading: string;
  accent: string;
  accentText: string;
  border: string;
  danger?: string;
  success?: string;
}

export interface Shell {
  presentation: Presentation;
  features: Feature[];
  theme: {
    colorMode: "light" | "dark";
    colors: ThemeColors;
    buttons?: {
      primary?: { background: string; text: string; border?: string; radius?: string };
      secondary?: { background: string; text: string; border?: string; radius?: string };
    };
    typography?: { fontFamily?: "system" | "serif" | "mono"; headingScale?: number; bodySize?: number; lineHeight?: number };
    layout?: { contentWidth?: "narrow" | "wide" | "full"; density?: "compact" | "comfortable"; cornerStyle?: "none" | "soft" | "round" };
  };
  navigation?: { mode: "single" | "tabs"; items: Array<{ id: string; label: string; elementIds: string[] }> };
  statusBar?: { showTagId?: boolean; showPresentation?: boolean };
}

export interface DocumentLayout {
  mode: "grid-flow";
  columns: number;
  gap: "sm" | "md" | "lg";
  container?: { maxWidth?: "narrow" | "wide" | "full"; padding?: "none" | "normal" | "wide" };
  responsive: {
    autoReflow: boolean;
    minColumnWidth?: Partial<Record<Breakpoint, string>>;
    preferredColumns?: Partial<Record<Breakpoint, number>>;
  };
}

export interface TemplateMeta {
  templateId: string;
  templateVersion: number;
  tagType: TagType;
  name: string;
  description?: string;
  locale: string;
  status: "draft" | "pending-review" | "published" | "retired";
  compatibility?: { protectionModes?: string[]; presentations?: Presentation[] };
}

export interface TagContentDocument {
  schema: typeof TEMPLATE_SCHEMA | typeof INSTANCE_SCHEMA;
  schemaVersion: number;
  template: TemplateMeta;
  shell: Shell;
  layout: DocumentLayout;
  elements: TemplateElement[];
  editability?: Editability;
  derivedFrom?: { templateId: string; templateVersion: number };
  /**
   * Eigene Farben der Formatierleiste. Gehört zur Konfiguration, damit sie mit dem
   * Template gespeichert und in der „letzten Konfiguration" wiedergefunden werden.
   */
  palette?: { custom: string[] };
}

export interface ElementTemplate {
  elementTemplateId: string;
  elementTemplateVersion: number;
  elementType: ElementType;
  label: string;
  /** Optional: Item-Fähigkeit bleibt beim Import aus älteren Bibliotheken leer. */
  items?: ElementItems;
  style?: ElementStyle;
  payload: Record<string, unknown>;
  slots?: TemplateSlot[];
  actions?: ElementActions;
  editability?: Editability;
}

export interface ElementLibrary {
  schema: typeof LIBRARY_SCHEMA;
  schemaVersion: number;
  libraryVersion: number;
  updatedAt?: string;
  elements: ElementTemplate[];
}

