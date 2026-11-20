export type VaultPresentation =
  | "standard"
  | "gallery"
  | "public-page"
  | "museum-exhibit"
  | "summit-guide"
  | "wedding";

export type PublicDocumentKind = "menu" | "invitation" | "thank-you" | "other";

export interface PublicVaultImage {
  id?: string;
  alt: string;
  caption?: string;
  url: string;
  downloadable?: boolean;
}

export interface PublicVaultDocument {
  id: string;
  title: string;
  kind: PublicDocumentKind;
  description?: string;
  url: string;
  availableLabel?: string;
}

export type RichTextMark = { type: string; [key: string]: unknown };
export interface RichTextRun {
  text?: string;
  type?: string;
  marks?: RichTextMark[];
  [key: string]: unknown;
}
export interface RichTextParagraph {
  type?: string;
  heading?: number;
  runs?: RichTextRun[];
  align?: "start" | "center" | "end";
  indent?: number;
  lineHeight?: number;
  list?: { kind: "ordered" | "unordered"; level: number };
  [key: string]: unknown;
}
export interface RichTextTable {
  type: "table";
  columns?: Array<{ align?: string; width?: string }>;
  rows?: Array<{ header?: boolean; cells?: Array<{ runs?: RichTextRun[]; background?: string }> }>;
  [key: string]: unknown;
}
export interface RichTextContent {
  paragraphs?: Array<RichTextParagraph | RichTextTable>;
  [key: string]: unknown;
}
export interface BlockPlacement {
  span?: Partial<Record<"mobile" | "tablet" | "desktop", number>>;
  order?: Partial<Record<"mobile" | "tablet" | "desktop", number>>;
  minWidth?: string;
  align?: "start" | "stretch" | "center";
  hint?: string;
}
export interface VaultLayout {
  columns?: number;
  gap?: "sm" | "md" | "lg";
  container?: { maxWidth?: "narrow" | "wide" | "full"; padding?: string };
  responsive?: {
    minColumnWidth?: Partial<Record<"mobile" | "tablet" | "desktop", string>>;
    preferredColumns?: Partial<Record<"mobile" | "tablet" | "desktop", number>>;
  };
  [key: string]: unknown;
}
export interface VaultTheme {
  colorMode?: "light" | "dark";
  colors?: Record<string, string>;
  typography?: Record<string, string | number>;
  [key: string]: unknown;
}
interface VaultBlockBase {
  content?: RichTextContent;
  options?: Record<string, unknown>;
  style?: Record<string, unknown>;
  slots?: Array<Record<string, unknown>>;
  actions?: Record<string, unknown>;
  bindings?: Record<string, unknown>;
  placement?: BlockPlacement;
  [key: string]: unknown;
}

export type VaultBlock = VaultBlockBase & (
  | {
      type: "hero";
      title?: string;
      subtitle?: string;
      imageUrl?: string;
    }
  | {
      type: "text";
      title?: string;
      paragraphs: string[];
    }
  | {
      type: "callout";
      tone: "info" | "notice" | "safety";
      title: string;
      text: string;
    }
  | {
      type: "gallery";
      title: string;
      images: PublicVaultImage[];
    }
  | {
      type: "documents";
      title: string;
      description?: string;
      documents: PublicVaultDocument[];
    }
  | {
      type: "external-link";
      label: string;
      url: string;
      description?: string;
    }
  | { type: "image" | "document" | "divider" | "notice" | "finder-form" | "contact" | "maintenance"; title?: string; text?: string; description?: string }
);

export interface PublicTagView {
  tag: {
    id: string;
    displayName: string;
    presentation: VaultPresentation;
  };
  vault: {
    blocks: VaultBlock[];
    layout?: VaultLayout;
  };
  theme?: VaultTheme;
  layout?: VaultLayout;
  enabledFeatures: Array<"vault" | "lost-found" | "guestbook" | "check-in">;
}
