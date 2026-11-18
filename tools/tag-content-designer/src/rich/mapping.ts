import type { JSONContent } from "@tiptap/core";
import {
  clampHeadingLevel,
  clampIndent,
  clampListLevel,
  groupBlocks,
  isFontFamily,
  isFontSize,
  isHexColor,
  isLineHeight,
  isTextAlign,
  markNames,
  mergeRuns,
  normalizeHref,
  type BlockNode,
  type ListItemNode,
} from "../domain/richtext";
import { DEFAULT_HEADING_LEVEL, MAX_TABLE_CELL_LENGTH, MAX_TABLE_COLUMNS, MAX_TABLE_ROWS } from "../domain/types";
import type { ContentBlock, ListKind, MarkName, Paragraph, RichTextContent, TableBlock, TextRun } from "../domain/types";

type MarkJSON = { type: string; attrs?: Record<string, unknown> };

function paragraphAttrs(paragraph: Paragraph): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};
  if (isTextAlign(paragraph.align) && paragraph.align !== "start") attrs.align = paragraph.align;
  if (isLineHeight(paragraph.lineHeight)) attrs.lineHeight = paragraph.lineHeight;
  const indent = clampIndent(paragraph.indent);
  if (indent > 0) attrs.indent = indent;
  return attrs;
}

function runToNodes(run: TextRun): JSONContent[] {
  if (!run.text) return [];
  const baseMarks: MarkJSON[] = markNames(run).map((type) => ({ type }));
  const style: Record<string, unknown> = {};
  if (isHexColor(run.color)) style.color = run.color;
  if (isHexColor(run.background)) style.background = run.background;
  if (isFontSize(run.fontSize)) style.fontSize = run.fontSize;
  if (isFontFamily(run.fontFamily)) style.fontFamily = run.fontFamily;
  if (Object.keys(style).length > 0) baseMarks.push({ type: "richStyle", attrs: style });
  const href = normalizeHref(run.link?.href);
  if (href) baseMarks.push({ type: "link", attrs: { href } });

  const cloneMarks = (): MarkJSON[] | undefined =>
    baseMarks.length === 0
      ? undefined
      : baseMarks.map((mark) => (mark.attrs ? { type: mark.type, attrs: { ...mark.attrs } } : { type: mark.type }));

  // Ein weicher Zeilenumbruch (\n) wird zu einem hardBreak-Knoten im selben Absatz.
  const nodes: JSONContent[] = [];
  run.text.split("\n").forEach((segment, index) => {
    if (index > 0) {
      const hardBreak: JSONContent = { type: "hardBreak" };
      const marks = cloneMarks();
      if (marks) hardBreak.marks = marks;
      nodes.push(hardBreak);
    }
    if (segment.length > 0) {
      const node: JSONContent = { type: "text", text: segment };
      const marks = cloneMarks();
      if (marks) node.marks = marks;
      nodes.push(node);
    }
  });
  return nodes;
}

function paragraphNode(paragraph: Paragraph): JSONContent {
  const heading = paragraph.heading;
  const content = mergeRuns(paragraph.runs ?? [])
    .flatMap(runToNodes)
    .filter((node): node is JSONContent => node !== null);
  if (heading !== undefined) {
    // Überschrift 1–5: eigener Knoten mit Ebene, Marks bleiben erhalten.
    const node: JSONContent = { type: "richHeading", attrs: { ...paragraphAttrs(paragraph), level: clampHeadingLevel(heading) } };
    if (content.length > 0) node.content = content;
    return node;
  }
  const node: JSONContent = { type: "paragraph", attrs: paragraphAttrs(paragraph) };
  if (content.length > 0) node.content = content;
  return node;
}

function listItemNode(item: ListItemNode): JSONContent {
  const content: JSONContent[] = item.paragraphs.map(paragraphNode);
  for (const child of item.children) content.push(blockToNode(child));
  return { type: "listItem", content: content.length > 0 ? content : [{ type: "paragraph" }] };
}

function listNode(kind: ListKind, items: ListItemNode[]): JSONContent {
  return { type: kind === "ordered" ? "orderedList" : "bulletList", content: items.map(listItemNode) };
}

/** Tabelle: Zellen als reiner Text, Ausrichtung je Spalte, Kopfzeile über `header`. */
function tableNode(table: TableBlock): JSONContent {
  const columnCount = Math.min(MAX_TABLE_COLUMNS, Math.max(1, table.columns.length));
  const rows: JSONContent[] = table.rows.slice(0, MAX_TABLE_ROWS).map((row) => ({
    type: "richTableRow",
    content: Array.from({ length: columnCount }, (_, index) => {
      const text = (row.cells[index]?.text ?? "").slice(0, MAX_TABLE_CELL_LENGTH);
      const align = table.columns[index]?.align;
      const attrs: Record<string, unknown> = { header: row.header === true };
      if (isTextAlign(align) && align !== "start") attrs.align = align;
      const node: JSONContent = { type: "richTableCell", attrs };
      if (text.length > 0) node.content = [{ type: "text", text }];
      return node;
    }),
  }));
  return { type: "richTable", content: rows.length > 0 ? rows : [{ type: "richTableRow", content: [] }] };
}

function tableFromNode(node: JSONContent): TableBlock {
  const rows = (node.content ?? []).filter((row) => row.type === "richTableRow");
  const columnCount = Math.min(
    MAX_TABLE_COLUMNS,
    Math.max(1, ...rows.map((row) => (row.content ?? []).length)),
  );
  const columns = Array.from({ length: columnCount }, (_, index) => {
    const align = rows[0]?.content?.[index]?.attrs?.align;
    return isTextAlign(align) && align !== "start" ? { align } : {};
  });
  const table: TableBlock = {
    type: "table",
    columns,
    rows: rows.slice(0, MAX_TABLE_ROWS).map((row) => {
      const cells = Array.from({ length: columnCount }, (_, index) => {
        const cell = (row.content ?? [])[index];
        const text = (cell?.content ?? [])
          .map((child) => (typeof child.text === "string" ? child.text : ""))
          .join("")
          .slice(0, MAX_TABLE_CELL_LENGTH);
        return { text };
      });
      const header = (row.content ?? []).length > 0 && (row.content ?? []).every((cell) => cell.attrs?.header === true);
      return header ? { header: true, cells } : { cells };
    }),
  };
  return table;
}

function blockToNode(block: BlockNode): JSONContent {
  if (block.type === "table") return tableNode(block.table);
  return block.type === "paragraph" ? paragraphNode(block.paragraph) : listNode(block.kind, block.items);
}

/** Unser Runs-Modell → ProseMirror-Dokument (einziger Weg in den Editor). */

function runsFromInline(nodes: JSONContent[] | undefined): TextRun[] {
  const runFromNode = (node: JSONContent, text: string): TextRun => {
    const run: TextRun = { text };
    const marks: MarkName[] = [];
    for (const mark of node.marks ?? []) {
      if (mark.type === "bold" || mark.type === "italic" || mark.type === "underline") {
        marks.push(mark.type);
        continue;
      }
      if (mark.type === "richStyle") {
        const attrs = mark.attrs ?? {};
        if (isHexColor(attrs.color)) run.color = attrs.color;
        if (isHexColor(attrs.background)) run.background = attrs.background;
        if (isFontSize(attrs.fontSize)) run.fontSize = attrs.fontSize;
        if (isFontFamily(attrs.fontFamily)) run.fontFamily = attrs.fontFamily;
        continue;
      }
      if (mark.type === "link") {
        const href = normalizeHref(mark.attrs?.href);
        if (href) run.link = { href };
      }
    }
    if (marks.length > 0) run.marks = marks.map((type) => ({ type }));
    return run;
  };

  const runs: TextRun[] = [];
  for (const node of nodes ?? []) {
    if (node.type === "hardBreak") {
      // Weicher Zeilenumbruch: bleibt im selben Absatz und wird als "\n" gespeichert.
      runs.push(runFromNode(node, "\n"));
      continue;
    }
    if (node.type !== "text" || typeof node.text !== "string" || node.text.length === 0) continue;
    runs.push(runFromNode(node, node.text));
  }
  return mergeRuns(runs);
}

function paragraphFromNode(node: JSONContent): Paragraph {
  const paragraph: Paragraph = { runs: runsFromInline(node.content) };
  const attrs = node.attrs ?? {};
  if (isTextAlign(attrs.align) && attrs.align !== "start") paragraph.align = attrs.align;
  if (isLineHeight(attrs.lineHeight)) paragraph.lineHeight = attrs.lineHeight;
  const indent = clampIndent(attrs.indent);
  if (indent > 0) paragraph.indent = indent;
  return paragraph;
}

function flattenList(node: JSONContent, level: number, out: Paragraph[]): void {
  const kind: ListKind = node.type === "orderedList" ? "ordered" : "bullet";
  const depth = clampListLevel(level);
  for (const item of node.content ?? []) {
    for (const child of item.content ?? []) {
      if (child.type === "paragraph") {
        out.push({ ...paragraphFromNode(child), list: { kind, level: depth } });
      } else if (child.type === "bulletList" || child.type === "orderedList") {
        flattenList(child, depth + 1, out);
      }
    }
  }
}

/**
 * ProseMirror-Dokument → Runs-Modell (einziger Weg aus dem Editor).
 * Überschriften bleiben Absätze mit `heading` (Ebene 1–5) an ihrer Position.
 * Unbekannte Nodes/Marks und ungültige Werte werden verworfen, nie gespeichert.
 */
export function docToContent(doc: JSONContent | null | undefined): RichTextContent {
  const blocks: ContentBlock[] = [];

  for (const node of doc?.content ?? []) {
    if (node.type === "richHeading") {
      // Überschrift bleibt Block im Absatzfluss (Ebene 1–5), Marks bleiben erhalten.
      const paragraph = paragraphFromNode(node);
      paragraph.heading = clampHeadingLevel(node.attrs?.level);
      blocks.push(paragraph);
      continue;
    }
    if (node.type === "paragraph") {
      blocks.push(paragraphFromNode(node));
      continue;
    }
    if (node.type === "richTable") {
      blocks.push(tableFromNode(node));
      continue;
    }
    if (node.type === "bulletList" || node.type === "orderedList") {
      const paragraphs: Paragraph[] = [];
      flattenList(node, 0, paragraphs);
      blocks.push(...paragraphs);
    }
  }

  return { paragraphs: blocks };
}

export function contentToDoc(content?: RichTextContent): JSONContent {
  const blocks: JSONContent[] = [];
  // Ältere Inhalte (schemaVersion 1) tragen noch `heading` – wird als Überschrift 3 gelesen.
  const legacyHeading = content?.heading?.trim();
  if (legacyHeading && legacyHeading.length > 0) {
    blocks.push({
      type: "richHeading",
      attrs: { level: DEFAULT_HEADING_LEVEL },
      content: [{ type: "text", text: legacyHeading }],
    });
  }
  for (const block of groupBlocks(content?.paragraphs ?? [])) blocks.push(blockToNode(block));
  if (blocks.length === 0) blocks.push({ type: "paragraph" });
  return { type: "doc", content: blocks };
}
