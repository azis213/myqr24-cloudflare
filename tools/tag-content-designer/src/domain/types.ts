export const TEMPLATE_SCHEMA = "myqr24-tag-content-template-v1" as const;
export const INSTANCE_SCHEMA = "myqr24-tag-content-instance-v1" as const;
export const LIBRARY_SCHEMA = "myqr24-tag-element-library-v1" as const;
export const SCHEMA_VERSION = 1;
export const MAX_DOCUMENT_BYTES = 48 * 1024;
export const MAX_ELEMENTS = 24;
export const MAX_SLOTS_PER_ELEMENT = 16;
export const MAX_ITEMS_PER_SLOT = 64;
export const MAX_PARAGRAPHS = 8;
export const MAX_TEXT_LENGTH = 2048;
export const MAX_HEADING_LENGTH = 120;

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
export type MarkName = "bold" | "italic" | "underline";

export interface Mark {
  type: MarkName;
}

export interface TextRun {
  text: string;
  marks?: Mark[];
}

export interface Paragraph {
  runs: TextRun[];
}

export interface RichTextContent {
  heading?: string;
  paragraphs?: Paragraph[];
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
}

export interface ElementTemplate {
  elementTemplateId: string;
  elementTemplateVersion: number;
  elementType: ElementType;
  label: string;
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
