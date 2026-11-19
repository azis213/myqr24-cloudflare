import MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";
import { blockText, clampHeadingLevel, isTextAlign, normalizeHref, truncateRuns } from "../domain/richtext";
import {
  MAX_HEADING_LENGTH,
  MAX_LIST_LEVEL,
  MAX_PARAGRAPHS,
  MAX_TABLE_CELL_LENGTH,
  MAX_TABLE_COLUMNS,
  MAX_TABLE_ROWS,
  MAX_TEXT_LENGTH,
} from "../domain/types";
import type {
  ContentBlock,
  ListKind,
  Paragraph,
  RichTextContent,
  TableBlock,
  TableCell,
  TextAlign,
  TextRun,
} from "../domain/types";

/**
 * Markdown als **Ein- und Ausgabeformat** (nie als Speicherformat):
 * `html: false` – rohes HTML wird nie interpretiert, sondern als Text übernommen.
 * Übersetzt werden nur Strukturen, die das Runs-Modell kennt.
 */
const md = new MarkdownIt({ html: false, linkify: false, breaks: false });

export interface MarkdownResult {
  content: RichTextContent;
  warnings: string[];
}

export interface MarkdownExport {
  markdown: string;
  warnings: string[];
}

/**
 * Erkennt, ob eingefügter Klartext nach Markdown aussieht (mindestens ein Struktur-Signal).
 * Reine Fließtexte bleiben normale Einfügungen.
 */
export function looksLikeMarkdown(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  const patterns = [
    /^#{1,6}\s+\S/m, // Überschrift
    /^\s*[-*+]\s+\S/m, // Aufzählung
    /^\s*\d+\.\s+\S/m, // Nummerierung
    /^\s*\|.*\|\s*$/m, // Tabelle
    /\*\*[^*\n]+\*\*/, // fett
    /`[^`\n]+`/, // Code
    /\[[^\]\n]+\]\((https?:\/\/|mailto:)[^\s)]+\)/, // Link
    /^>\s+\S/m, // Zitat
    /^```/m, // Codeblock
  ];
  return patterns.some((pattern) => pattern.test(trimmed));
}

function warnOnce(warnings: string[], message: string): void {
  if (!warnings.includes(message)) warnings.push(message);
}

function pushRun(runs: TextRun[], text: string, marks: string[], href: string | null): void {
  if (text.length === 0) return;
  const run: TextRun = { text };
  if (marks.length > 0) run.marks = marks.map((type) => ({ type })) as TextRun["marks"];
  if (href) run.link = { href };
  runs.push(run);
}

/** Inline-Tokens → Runs (fett/kursiv/Link/weicher Umbruch, sonst Text). */
function runsFromInline(children: Token[], warnings: string[]): TextRun[] {
  const runs: TextRun[] = [];
  let bold = 0;
  let italic = 0;
  let href: string | null = null;

  const marks = (): string[] => {
    const list: string[] = [];
    if (bold > 0) list.push("bold");
    if (italic > 0) list.push("italic");
    return list;
  };

  for (const token of children) {
    switch (token.type) {
      case "text":
      case "text_special":
        pushRun(runs, token.content, marks(), href);
        break;
      case "strong_open":
        bold += 1;
        break;
      case "strong_close":
        bold = Math.max(0, bold - 1);
        break;
      case "em_open":
        italic += 1;
        break;
      case "em_close":
        italic = Math.max(0, italic - 1);
        break;
      case "s_open":
      case "s_close":
        warnOnce(warnings, "Durchgestrichener Text wird ohne Durchstreichung übernommen (nicht im Modell).");
        break;
      case "code_inline":
        pushRun(runs, token.content, marks(), href);
        warnOnce(warnings, "Code-Auszeichnung wird als normaler Text übernommen (nicht im Modell).");
        break;
      case "link_open": {
        const safe = normalizeHref(token.attrGet("href"));
        if (!safe) warnOnce(warnings, "Nicht erlaubte Links (nur https/mailto) wurden als Text übernommen.");
        href = safe;
        break;
      }
      case "link_close":
        href = null;
        break;
      case "softbreak":
      case "hardbreak":
        pushRun(runs, "\n", marks(), href);
        break;
      case "image":
        pushRun(runs, token.content, marks(), href);
        warnOnce(warnings, "Bilder werden nicht in Textfelder übernommen (nur Text/Alt-Text).");
        break;
      case "html_inline":
        pushRun(runs, token.content, marks(), href);
        break;
      default:
        break;
    }
  }
  return runs;
}

function paragraphFromInline(children: Token[] | null | undefined, warnings: string[]): Paragraph {
  const paragraph: Paragraph = { runs: runsFromInline(children ?? [], warnings) };
  const text = paragraph.runs.map((run) => run.text).join("");
  if (text.length > MAX_TEXT_LENGTH) {
    warnOnce(warnings, `Texte wurden auf ${MAX_TEXT_LENGTH} Zeichen je Absatz gekürzt.`);
    let budget = MAX_TEXT_LENGTH;
    paragraph.runs = paragraph.runs
      .map((run) => {
        if (budget <= 0) return null;
        const value = run.text.slice(0, budget);
        budget -= value.length;
        return { ...run, text: value };
      })
      .filter((run): run is TextRun => run !== null);
  }
  return paragraph;
}

function headingFromInline(children: Token[] | null | undefined, level: number, warnings: string[]): Paragraph {
  const paragraph = paragraphFromInline(children, warnings);
  // Markdown kennt h1–h6; wir haben 1–5 – Ebene 6 wird zu 5.
  paragraph.heading = clampHeadingLevel(Math.min(5, Math.max(1, level)));
  const text = paragraph.runs.map((run) => run.text).join("");
  if (text.length > MAX_HEADING_LENGTH) {
    warnOnce(warnings, `Überschriften wurden auf ${MAX_HEADING_LENGTH} Zeichen gekürzt.`);
  }
  if (level > 5) warnOnce(warnings, "Überschriften der Ebene 6 wurden als Ebene 5 übernommen.");
  return paragraph;
}

function listBlocks(
  tokens: Token[],
  start: number,
  depth: number,
  kind: ListKind,
  out: ContentBlock[],
  warnings: string[],
): number {
  let index = start + 1;
  while (index < tokens.length) {
    const token = tokens[index];
    if (token.type === "bullet_list_close" || token.type === "ordered_list_close") return index + 1;
    if (token.type === "list_item_open") {
      index += 1;
      while (index < tokens.length && tokens[index].type !== "list_item_close") {
        const inner = tokens[index];
        if (inner.type === "paragraph_open") {
          const paragraph = paragraphFromInline(tokens[index + 1]?.children, warnings);
          paragraph.list = { kind, level: Math.min(depth, MAX_LIST_LEVEL) };
          out.push(paragraph);
          index += 3;
          continue;
        }
        if (inner.type === "inline") {
          const paragraph = paragraphFromInline(inner.children, warnings);
          paragraph.list = { kind, level: Math.min(depth, MAX_LIST_LEVEL) };
          out.push(paragraph);
          index += 1;
          continue;
        }
        if (inner.type === "bullet_list_open" || inner.type === "ordered_list_open") {
          const childKind: ListKind = inner.type === "ordered_list_open" ? "ordered" : "bullet";
          index = listBlocks(tokens, index, depth + 1, childKind, out, warnings);
          continue;
        }
        index += 1;
      }
      index += 1;
      continue;
    }
    index += 1;
  }
  return index;
}

function alignFromStyle(style: string | null): TextAlign | undefined {
  if (!style) return undefined;
  if (/text-align:\s*center/i.test(style)) return "center";
  if (/text-align:\s*right/i.test(style)) return "end";
  // "links" ist der Standard und wird nicht gespeichert.
  return undefined;
}

function tableBlock(tokens: Token[], start: number, warnings: string[]): { table: TableBlock; next: number } {
  const aligns: Array<TextAlign | undefined> = [];
  const rows: Array<{ header?: boolean; cells: TableCell[] }> = [];
  let current: { header?: boolean; cells: TableCell[] } | null = null;
  let index = start + 1;

  while (index < tokens.length && tokens[index].type !== "table_close") {
    const token = tokens[index];
    if (token.type === "tr_open") {
      current = { cells: [] };
      rows.push(current);
    } else if (token.type === "tr_close") {
      current = null;
    } else if (token.type === "th_open" || token.type === "td_open") {
      const inline = tokens[index + 1];
      // Zellinhalt inkl. **fett**/*kursiv*/Links lesen (GFM-Zellen sind einzeilig).
      const runs =
        inline?.type === "inline"
          ? truncateRuns(paragraphFromInline(inline.children, warnings).runs, MAX_TABLE_CELL_LENGTH)
          : truncateRuns([{ text: (inline?.content ?? "").trim() }], MAX_TABLE_CELL_LENGTH);
      if (token.type === "th_open") {
        if (current) current.header = true;
        aligns[current?.cells.length ?? 0] = alignFromStyle(token.attrGet("style"));
      }
      current?.cells.push({ runs });
    }
    index += 1;
  }

  const columnCount = Math.min(MAX_TABLE_COLUMNS, Math.max(1, ...rows.map((row) => row.cells.length)));
  if (rows.length > MAX_TABLE_ROWS) warnOnce(warnings, `Tabellen wurden auf ${MAX_TABLE_ROWS} Zeilen gekürzt.`);
  if (rows.some((row) => row.cells.length !== columnCount)) {
    warnOnce(warnings, "Tabellenzeilen mit abweichender Spaltenzahl wurden aufgefüllt/gekürzt.");
  }

  const table: TableBlock = {
    type: "table",
    columns: Array.from({ length: columnCount }, (_, columnIndex) => {
      const align = aligns[columnIndex];
      return isTextAlign(align) ? { align } : {};
    }),
    rows: rows.slice(0, MAX_TABLE_ROWS).map((row) => {
      const cells = Array.from({ length: columnCount }, (_, columnIndex) => ({
        runs: row.cells[columnIndex]?.runs ?? [],
      }));
      return row.header ? { header: true, cells } : { cells };
    }),
  };
  if (table.rows.length === 0) table.rows = [{ cells: table.columns.map(() => ({ runs: [] })) }];
  return { table, next: index + 1 };
}

/** Markdown → Runs-Modell. Unbekannte Strukturen werden zu Text oder verworfen (mit Hinweis). */
export function parseMarkdown(source: string): MarkdownResult {
  const warnings: string[] = [];
  const blocks: ContentBlock[] = [];
  const tokens = md.parse(source ?? "", {});

  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];
    if (token.type === "heading_open") {
      const level = Number(token.tag.replace("h", ""));
      blocks.push(headingFromInline(tokens[index + 1]?.children, level, warnings));
      index += 3;
      continue;
    }
    if (token.type === "paragraph_open") {
      blocks.push(paragraphFromInline(tokens[index + 1]?.children, warnings));
      index += 3;
      continue;
    }
    if (token.type === "bullet_list_open" || token.type === "ordered_list_open") {
      const kind: ListKind = token.type === "ordered_list_open" ? "ordered" : "bullet";
      index = listBlocks(tokens, index, 0, kind, blocks, warnings);
      continue;
    }
    if (token.type === "table_open") {
      const result = tableBlock(tokens, index, warnings);
      blocks.push(result.table);
      index = result.next;
      continue;
    }
    if (token.type === "fence" || token.type === "code_block") {
      blocks.push({ runs: [{ text: token.content.replace(/\n$/, "") }] });
      warnOnce(warnings, "Code-Blöcke werden als normaler Text übernommen (nicht im Modell).");
      index += 1;
      continue;
    }
    if (token.type === "hr") {
      warnOnce(warnings, "Trennlinien sind im Textfeld nicht vorgesehen und wurden entfernt.");
      index += 1;
      continue;
    }
    if (token.type === "inline") {
      blocks.push(paragraphFromInline(token.children, warnings));
      index += 1;
      continue;
    }
    if (token.type === "blockquote_open") {
      warnOnce(warnings, "Zitate werden ohne Zitat-Auszeichnung als Absätze übernommen.");
    }
    index += 1;
  }

  if (blocks.length > MAX_PARAGRAPHS) {
    warnOnce(warnings, `Es wurden nur die ersten ${MAX_PARAGRAPHS} Blöcke übernommen.`);
    blocks.length = MAX_PARAGRAPHS;
  }

  const flat = blocks.map((block) => blockText(block)).join("\n");
  if (/javascript:|data:/i.test(flat)) {
    warnOnce(warnings, "Unsichere Links (javascript:/data:) wurden nur als Text übernommen.");
  }

  return { content: { paragraphs: blocks }, warnings };
}

/** Markdown-Sonderzeichen maskieren, damit exportierter Text unverändert zurückkommt. */
function escapeMarkdown(text: string, inTable = false): string {
  let result = text.replace(/([\\`*_[\]])/g, "\\$1");
  if (inTable) result = result.replace(/\|/g, "\\|");
  return result;
}

function runsToMarkdown(runs: TextRun[], warnings: string[], inTable = false): string {
  return runs
    .map((run) => {
      const marks = new Set((run.marks ?? []).map((mark) => mark.type));
      if (run.color || run.background || run.fontSize || run.fontFamily) {
        warnOnce(warnings, "Farben, Markierungen und Schriftgrößen sind nicht Teil von Markdown und fehlen im Export.");
      }
      // Weiche Umbrüche werden als Markdown-Hard-Break (zwei Leerzeichen) geschrieben;
      // in Tabellenzellen bleiben Zeilen einzeilig (GFM kennt dort keine Umbrüche).
      let text = inTable
        ? escapeMarkdown(run.text.replace(/\n/g, " "), true)
        : escapeMarkdown(run.text).split("\n").join("  \n");
      if (marks.has("bold") && marks.has("italic")) text = "***" + text + "***";
      else if (marks.has("bold")) text = "**" + text + "**";
      else if (marks.has("italic")) text = "*" + text + "*";
      return run.link ? "[" + text + "](" + run.link.href + ")" : text;
    })
    .join("");
}

function tableToMarkdown(table: TableBlock, warnings: string[]): string {
  if (table.rows.length === 0) return "";
  const headIndex = Math.max(0, table.rows.findIndex((row) => row.header === true));
  const cellLine = (cells: TableCell[]): string =>
    "| " +
    table.columns
      .map((_, index) => {
        const cell = cells[index];
        // Zellhintergrund ist ein Token; Text-Hintergrund/Farben meldet runsToMarkdown.
        return runsToMarkdown(cell?.runs ?? [], warnings, true);
      })
      .join(" | ") +
    " |";
  const alignLine =
    "| " +
    table.columns
      .map((column) => (column.align === "center" ? ":---:" : column.align === "end" ? "---:" : "---"))
      .join(" | ") +
    " |";

  if (table.border || table.rows.some((row) => row.cells.some((cell) => cell.background))) {
    warnOnce(warnings, "Rahmen- und Zellhintergrundfarben der Tabelle sind nicht Teil von Markdown und fehlen im Export.");
  }
  if (table.rows.some((row) => row.cells.some((cell) => cell.runs.some((run) => run.text.includes("\n"))))) {
    warnOnce(warnings, "Zeilenumbrüche in Zellen werden im Markdown-Export zu Leerzeichen.");
  }

  const lines = [cellLine(table.rows[headIndex].cells), alignLine];
  table.rows.forEach((row, index) => {
    if (index === headIndex) return;
    lines.push(cellLine(row.cells));
  });
  return lines.join("\n");
}

/** Runs-Modell → Markdown (nur Struktur: Überschriften, Listen, Tabellen, fett/kursiv, Links). */
export function toMarkdown(content?: RichTextContent): MarkdownExport {
  const warnings: string[] = [];
  const lines: string[] = [];
  const counters: number[] = [];
  let lastBlockWasList = false;

  if (content?.heading) {
    lines.push("### " + escapeMarkdown(content.heading), "");
  }

  for (const block of content?.paragraphs ?? []) {
    if ((block as TableBlock).type === "table") {
      if (lastBlockWasList) lines.push("");
      lastBlockWasList = false;
      const markdown = tableToMarkdown(block as TableBlock, warnings);
      if (markdown) lines.push(markdown, "");
      continue;
    }
    const paragraph = block as Paragraph;
    const text = runsToMarkdown(paragraph.runs ?? [], warnings);
    if (paragraph.heading !== undefined) {
      if (lastBlockWasList) lines.push("");
      lastBlockWasList = false;
      lines.push("#".repeat(clampHeadingLevel(paragraph.heading)) + " " + text, "");
      continue;
    }
    if (paragraph.list) {
      const level = Math.min(paragraph.list.level, MAX_LIST_LEVEL);
      counters[level] = (counters[level] ?? 0) + 1;
      for (let deeper = level + 1; deeper < counters.length; deeper += 1) counters[deeper] = 0;
      const marker = paragraph.list.kind === "ordered" ? String(counters[level]) + "." : "-";
      lines.push("  ".repeat(level) + marker + " " + text);
      lastBlockWasList = true;
      continue;
    }
    if (lastBlockWasList) lines.push("");
    lastBlockWasList = false;
    counters.length = 0;
    lines.push(text, "");
  }

  return { markdown: lines.join("\n").trim() + "\n", warnings };
}

