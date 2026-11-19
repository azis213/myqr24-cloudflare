import {
  DEFAULT_HEADING_LEVEL,
  FONT_FAMILIES,
  FONT_SIZE_SCALE,
  HEADING_LEVELS,
  LINE_HEIGHT_SCALE,
  MAX_INDENT,
  MAX_LIST_LEVEL,
  TABLE_BORDER_STYLES,
  TABLE_BORDER_WIDTHS,
  TEXT_ALIGNS,
} from "./types";
import type {
  ContentBlock,
  FontFamily,
  FontSize,
  HeadingLevel,
  LineHeight,
  ListKind,
  MarkName,
  Paragraph,
  RichTextContent,
  TableBlock,
  TableBorder,
  TableBorderStyle,
  TableBorderWidth,
  TableCell,
  TextAlign,
  TextRun,
} from "./types";

export const FONT_STACKS: Record<FontFamily, string> = {
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace',
};

export const FONT_FAMILY_LABELS: Record<FontFamily, string> = {
  sans: "Standard (serifenlos)",
  serif: "Serifen",
  mono: "Monospace",
};

export const LINE_HEIGHT_LABELS: Record<string, string> = {
  "1": "1,0",
  "1.15": "1,15",
  "1.3": "1,3",
  "1.5": "1,5",
  "1.75": "1,75",
  "2": "2,0",
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const MARK_ORDER: MarkName[] = ["bold", "italic", "underline"];
const SAFE_PROTOCOLS = new Set(["https:", "mailto:"]);

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR.test(value);
}

export function isFontSize(value: unknown): value is FontSize {
  return typeof value === "number" && (FONT_SIZE_SCALE as readonly number[]).includes(value);
}

export function isFontFamily(value: unknown): value is FontFamily {
  return typeof value === "string" && (FONT_FAMILIES as readonly string[]).includes(value);
}

export function isLineHeight(value: unknown): value is LineHeight {
  return typeof value === "number" && (LINE_HEIGHT_SCALE as readonly number[]).includes(value);
}

export function isTextAlign(value: unknown): value is TextAlign {
  return typeof value === "string" && (TEXT_ALIGNS as readonly string[]).includes(value);
}

export function isListKind(value: unknown): value is ListKind {
  return value === "bullet" || value === "ordered";
}

export function clampIndent(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(MAX_INDENT, Math.max(0, Math.round(value)));
}

export function clampListLevel(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(MAX_LIST_LEVEL, Math.max(0, Math.round(value)));
}

export function isHeadingLevel(value: unknown): value is HeadingLevel {
  return typeof value === "number" && (HEADING_LEVELS as readonly number[]).includes(value);
}

export function isTableBorderStyle(value: unknown): value is TableBorderStyle {
  return typeof value === "string" && (TABLE_BORDER_STYLES as readonly string[]).includes(value);
}

export function isTableBorderWidth(value: unknown): value is TableBorderWidth {
  return typeof value === "number" && (TABLE_BORDER_WIDTHS as readonly number[]).includes(value);
}

/** Liest einen Tabellenrahmen aus beliebigen Daten (nur geschlossene Werte, sonst `null`). */
export function normalizeTableBorder(value: unknown): TableBorder | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (!isHexColor(candidate.color)) return null;
  if (!isTableBorderStyle(candidate.style)) return null;
  if (!isTableBorderWidth(candidate.width)) return null;
  return { color: candidate.color, style: candidate.style, width: candidate.width };
}

/** Begrenzt auf 1–5; unbrauchbare Werte fallen auf die Standardebene zurück. */
export function clampHeadingLevel(value: unknown): HeadingLevel {
  if (!isHeadingLevel(value)) return DEFAULT_HEADING_LEVEL;
  return value;
}

/**
 * Link-Allowlist: ausschließlich `https:` und `mailto:`.
 * `javascript:`, `data:`, `vbscript:`, relative Ziele und Steuerzeichen werden verworfen.
 */
export function normalizeHref(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const href = value.trim();
  if (href.length === 0 || href.length > 300) return null;
  if (/[\s<>"'`\\\u0000-\u001f]/.test(href)) return null;
  let parsed: URL;
  try {
    parsed = new URL(href);
  } catch {
    return null;
  }
  if (!SAFE_PROTOCOLS.has(parsed.protocol)) return null;
  return href;
}

export function isSafeHref(value: unknown): boolean {
  return normalizeHref(value) !== null;
}

export function linkAttributes(href: string): { href: string; target: string; rel: string } {
  return { href, target: "_blank", rel: "noopener noreferrer nofollow" };
}

export function markNames(run: TextRun): MarkName[] {
  const present = (run.marks ?? []).map((mark) => mark.type);
  return MARK_ORDER.filter((name) => present.includes(name));
}

/** Vergleichsschlüssel aller Zeichen-Attribute (für das Zusammenfassen von Runs). */
export function runAttributeKey(run: TextRun): string {
  const link = normalizeHref(run.link?.href);
  return JSON.stringify([
    markNames(run),
    isHexColor(run.color) ? run.color.toLowerCase() : null,
    isHexColor(run.background) ? run.background.toLowerCase() : null,
    isFontSize(run.fontSize) ? run.fontSize : null,
    isFontFamily(run.fontFamily) ? run.fontFamily : null,
    link,
  ]);
}

/** Fasst benachbarte Runs mit identischen Attributen zusammen und entfernt leere Runs. */
export function mergeRuns(runs: TextRun[]): TextRun[] {
  const result: TextRun[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    const marks = markNames(run);
    const key = runAttributeKey(run);
    const last = result.at(-1);
    if (last && runAttributeKey(last) === key) {
      last.text += run.text;
      continue;
    }
    const next: TextRun = { text: run.text };
    if (marks.length > 0) next.marks = marks.map((type) => ({ type }));
    if (isHexColor(run.color)) next.color = run.color;
    if (isHexColor(run.background)) next.background = run.background;
    if (isFontSize(run.fontSize)) next.fontSize = run.fontSize;
    if (isFontFamily(run.fontFamily)) next.fontFamily = run.fontFamily;
    const href = normalizeHref(run.link?.href);
    if (href) next.link = { href };
    result.push(next);
  }
  return result;
}

export function paragraphText(paragraph: Paragraph | undefined): string {
  return (paragraph?.runs ?? []).map((run) => run.text).join("");
}

/** Sichtbarer Text einer Zelle (Runs ohne Formatierung). */
export function cellText(cell: TableCell | undefined): string {
  return (cell?.runs ?? []).map((run) => run.text).join("");
}

/** Kürzt Runs auf ein Zeichenbudget (für Importe und Tabellenzellen). */
export function truncateRuns(runs: TextRun[], max: number): TextRun[] {
  let remaining = Math.max(0, max);
  const result: TextRun[] = [];
  for (const run of mergeRuns(runs)) {
    if (remaining <= 0) break;
    const text = run.text.slice(0, remaining);
    remaining -= text.length;
    if (text.length > 0) result.push({ ...run, text });
  }
  return result;
}

export function isTableBlock(block: ContentBlock | undefined): block is TableBlock {
  return !!block && (block as TableBlock).type === "table";
}

/** Text einer Tabelle (Zellen zeilenweise, für Suche/Plaintext/Byte-Zählung). */
export function tableText(table: TableBlock): string {
  return table.rows.map((row) => row.cells.map((cell) => cellText(cell)).join(" | ")).join("\n");
}

export function blockText(block: ContentBlock | undefined): string {
  if (!block) return "";
  return isTableBlock(block) ? tableText(block) : paragraphText(block);
}

export function plainText(content: RichTextContent | undefined): string {
  if (!content) return "";
  const blocks = (content.paragraphs ?? []).map((block) => blockText(block));
  return [content.heading ?? "", ...blocks].filter((entry) => entry.length > 0).join("\n");
}

export interface ListItemNode {
  paragraphs: Paragraph[];
  children: BlockNode[];
}

export type BlockNode =
  | { type: "paragraph"; paragraph: Paragraph }
  | { type: "list"; kind: ListKind; items: ListItemNode[] }
  | { type: "table"; table: TableBlock };

/**
 * Normalisiert Listensprünge: eine Liste beginnt höchstens eine Ebene tiefer als der vorherige
 * Absatz. Damit ist die Gruppierung deterministisch (kein „Sprung" von 0 auf 3).
 */
function normalizeListLevels(blocks: ContentBlock[]): ContentBlock[] {
  let previousLevel = -1;
  return blocks.map((block) => {
    if (isTableBlock(block)) {
      previousLevel = -1;
      return block;
    }
    if (!block.list) {
      previousLevel = -1;
      return block;
    }
    const desired = clampListLevel(block.list.level);
    const level = Math.min(desired, previousLevel + 1);
    previousLevel = level;
    return level === block.list.level ? block : { ...block, list: { ...block.list, level } };
  });
}

function collectList(
  paragraphs: Paragraph[],
  start: number,
  level: number,
  kind: ListKind,
): { node: BlockNode; next: number } {
  const items: ListItemNode[] = [];
  let index = start;
  while (index < paragraphs.length) {
    const paragraph = paragraphs[index];
    if (!paragraph.list || paragraph.list.kind !== kind) break;
    if (clampListLevel(paragraph.list.level) !== level) break;

    const item: ListItemNode = { paragraphs: [paragraph], children: [] };
    index += 1;

    while (index < paragraphs.length) {
      const child = paragraphs[index];
      if (!child.list || clampListLevel(child.list.level) <= level) break;
      const childResult = collectList(paragraphs, index, level + 1, child.list.kind);
      item.children.push(childResult.node);
      index = childResult.next;
    }

    items.push(item);
  }

  return { node: { type: "list", kind, items }, next: index === start ? start + 1 : index };
}

/** Gruppiert flache Blöcke zu Absatz-, Listen- und Tabellenblöcken (eine Wahrheit für Renderer und Mapping). */
export function groupBlocks(blocks: ContentBlock[] = []): BlockNode[] {
  const normalized = normalizeListLevels(blocks);
  const result: BlockNode[] = [];
  let index = 0;
  while (index < normalized.length) {
    const block = normalized[index];
    if (isTableBlock(block)) {
      result.push({ type: "table", table: block });
      index += 1;
      continue;
    }
    // Überschriften stehen immer allein – sie werden nie Teil einer Liste.
    if (!block.list || block.heading !== undefined) {
      result.push({ type: "paragraph", paragraph: block });
      index += 1;
      continue;
    }
    const collected = collectList(normalized as Paragraph[], index, clampListLevel(block.list.level), block.list.kind);
    result.push(collected.node);
    index = collected.next;
  }
  return result;
}



export interface RunPresentation {
  fontWeight?: number;
  fontStyle?: "italic";
  textDecoration?: "underline";
  color?: string;
  backgroundColor?: string;
  fontSize?: string;
  fontFamily?: string;
}

export function runPresentation(run: TextRun): RunPresentation {
  const style: RunPresentation = {};
  const marks = new Set(markNames(run));
  if (marks.has("bold")) style.fontWeight = 700;
  if (marks.has("italic")) style.fontStyle = "italic";
  if (marks.has("underline")) style.textDecoration = "underline";
  if (isHexColor(run.color)) style.color = run.color;
  if (isHexColor(run.background)) style.backgroundColor = run.background;
  if (isFontSize(run.fontSize)) style.fontSize = `${run.fontSize}px`;
  if (isFontFamily(run.fontFamily)) style.fontFamily = FONT_STACKS[run.fontFamily];
  return style;
}

export interface ParagraphPresentation {
  textAlign?: TextAlign;
  lineHeight?: number;
  paddingLeft?: string;
}

export function paragraphPresentation(paragraph: Paragraph): ParagraphPresentation {
  const style: ParagraphPresentation = {};
  if (isTextAlign(paragraph.align)) style.textAlign = paragraph.align;
  if (isLineHeight(paragraph.lineHeight)) style.lineHeight = paragraph.lineHeight;
  const indent = clampIndent(paragraph.indent);
  if (indent > 0) style.paddingLeft = `${indent * 1.25}rem`;
  return style;
}
