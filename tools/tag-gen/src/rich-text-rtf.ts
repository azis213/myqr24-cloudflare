import type { HexColor, LabelFontFamily, RichTextDocument, RichTextRun } from "./domain";

const FONT_FAMILIES: readonly LabelFontFamily[] = ["helvetica", "times-roman", "courier"];
const FONT_NAMES: Record<LabelFontFamily, string> = {
  helvetica: "Helvetica",
  "times-roman": "Times New Roman",
  courier: "Courier New",
};

export interface RichTextRtfDefaults {
  fontFamily: LabelFontFamily;
  fontSizePt: number;
}

export type RtfParseResult =
  | { ok: true; value: RichTextDocument }
  | { ok: false; errors: string[] };

interface Format {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: HexColor;
  backgroundColor?: HexColor;
  fontFamily?: LabelFontFamily;
  fontSizePt?: number;
}

function sameFormat(first: Format, second: Format): boolean {
  return first.bold === second.bold
    && first.italic === second.italic
    && first.underline === second.underline
    && first.color === second.color
    && first.backgroundColor === second.backgroundColor
    && first.fontFamily === second.fontFamily
    && first.fontSizePt === second.fontSizePt;
}

function appendRun(runs: RichTextRun[], text: string, format: Format): void {
  if (!text) return;
  const previous = runs.at(-1);
  if (previous && sameFormat(previous, format)) {
    previous.text += text;
  } else {
    runs.push({ text, ...format });
  }
}

function colorTable(document: RichTextDocument): HexColor[] {
  const colors: HexColor[] = [];
  for (const paragraph of document.paragraphs) {
    for (const run of paragraph.runs) {
      for (const color of [run.color, run.backgroundColor]) {
        if (color && !colors.includes(color)) colors.push(color);
      }
    }
  }
  return colors;
}

function escapeRtf(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("{", "\\{")
    .replaceAll("}", "\\}")
    .replace(/[^\x20-\x7e]/g, (character) => `\\u${character.codePointAt(0)! > 32767 ? character.codePointAt(0)! - 65536 : character.codePointAt(0)}?`);
}

function colorIndex(colors: readonly HexColor[], value: HexColor | undefined): number {
  return value ? colors.indexOf(value) + 1 : 0;
}

function colorDeclaration(color: HexColor): string {
  const value = Number.parseInt(color.slice(1), 16);
  return `\\red${(value >> 16) & 255}\\green${(value >> 8) & 255}\\blue${value & 255};`;
}

export function richTextToRtf(document: RichTextDocument, defaults: RichTextRtfDefaults): string {
  const colors = colorTable(document);
  const fontTable = FONT_FAMILIES.map((font, index) => `{\\f${index} ${FONT_NAMES[font]};}`).join("");
  const colorsRtf = colors.map(colorDeclaration).join("");
  const paragraphs = document.paragraphs.map((paragraph, paragraphIndex) => {
    const content = paragraph.runs.map((run) => {
      const font = run.fontFamily ?? defaults.fontFamily;
      const fontIndex = FONT_FAMILIES.indexOf(font);
      const size = Math.round((run.fontSizePt ?? defaults.fontSizePt) * 2);
      const before = [
        `\\f${fontIndex}`,
        `\\fs${size}`,
        run.bold ? "\\b" : "\\b0",
        run.italic ? "\\i" : "\\i0",
        run.underline ? "\\ul" : "\\ulnone",
        `\\cf${colorIndex(colors, run.color)}`,
        `\\highlight${colorIndex(colors, run.backgroundColor)}`,
      ].join("");
      return run.text.split("\n").map((line, index) => `${before} ${escapeRtf(line)}${index < run.text.split("\n").length - 1 ? "\\line " : ""}`).join("");
    }).join("");
    return `${content}${paragraphIndex < document.paragraphs.length - 1 ? "\\par" : ""}`;
  }).join("");

  return `{\\rtf1\\ansi\\deff0{\\fonttbl${fontTable}}{\\colortbl;${colorsRtf}}${paragraphs}}`;
}

function parseColorTable(source: string): HexColor[] {
  const match = source.match(/\{\\colortbl;([\s\S]*?)\}/);
  if (!match) return [];
  return match[1].split(";").filter(Boolean).flatMap((entry) => {
    const red = entry.match(/\\red(\d+)/)?.[1];
    const green = entry.match(/\\green(\d+)/)?.[1];
    const blue = entry.match(/\\blue(\d+)/)?.[1];
    if (!red || !green || !blue) return [];
    return [`#${[red, green, blue].map((component) => Number(component).toString(16).padStart(2, "0")).join("")}` as HexColor];
  });
}

function removeHeaderGroups(source: string): string {
  let output = source;
  for (const marker of ["fonttbl", "colortbl"]) {
    const start = output.indexOf(`{\\${marker}`);
    if (start < 0) continue;
    let depth = 0;
    for (let index = start; index < output.length; index += 1) {
      if (output[index] === "{") depth += 1;
      if (output[index] === "}") depth -= 1;
      if (depth === 0) {
        output = output.slice(0, start) + output.slice(index + 1);
        break;
      }
    }
  }
  return output;
}

function validRtfInput(input: string): string | undefined {
  if (input.length > 25_000) return "Der RTF-Text darf höchstens 25.000 Zeichen enthalten.";
  if (!input.trim().startsWith("{\\rtf")) return "Der Quelltext muss mit einem RTF-Header wie {\\rtf1 beginnen.";
  if (/\b(?:object|objdata|field|pict|htmltag|stylesheet)\b/i.test(input)) {
    return "Der RTF-Text enthält nicht unterstützte oder unsichere Inhalte.";
  }
  return undefined;
}

export function rtfToRichText(input: string, defaults: RichTextRtfDefaults): RtfParseResult {
  const inputError = validRtfInput(input);
  if (inputError) return { ok: false, errors: [inputError] };

  const colors = parseColorTable(input);
  const source = removeHeaderGroups(input);
  const paragraphs: { runs: RichTextRun[] }[] = [{ runs: [] }];
  let format: Format = { fontFamily: defaults.fontFamily, fontSizePt: defaults.fontSizePt };
  const stack: Format[] = [];
  let index = 0;
  const addText = (text: string): void => appendRun(paragraphs.at(-1)!.runs, text, format);
  const addParagraph = (): void => { paragraphs.push({ runs: [] }); };

  while (index < source.length) {
    const character = source[index];
    if (character === "{") {
      stack.push({ ...format });
      index += 1;
      continue;
    }
    if (character === "}") {
      format = stack.pop() ?? format;
      index += 1;
      continue;
    }
    if (character !== "\\") {
      addText(character);
      index += 1;
      continue;
    }

    const next = source[index + 1];
    if (next === "\\" || next === "{" || next === "}") {
      addText(next);
      index += 2;
      continue;
    }
    if (next === "'") {
      const hex = source.slice(index + 2, index + 4);
      if (!/^[\da-f]{2}$/i.test(hex)) return { ok: false, errors: ["Ungültige hexadezimale RTF-Zeichenkodierung."] };
      addText(String.fromCharCode(Number.parseInt(hex, 16)));
      index += 4;
      continue;
    }

    const control = source.slice(index + 1).match(/^([a-zA-Z]+)(-?\d+)? ?/);
    if (!control) {
      index += 2;
      continue;
    }
    const [, word, parameter] = control;
    const value = parameter === undefined ? undefined : Number(parameter);
    index += 1 + control[0].length;

    if (word === "par") { addParagraph(); continue; }
    if (word === "line") { addText("\n"); continue; }
    if (word === "tab") { addText("\t"); continue; }
    if (word === "b") { if (value === 0) delete format.bold; else format.bold = true; continue; }
    if (word === "i") { if (value === 0) delete format.italic; else format.italic = true; continue; }
    if (word === "ul") { if (value === 0) delete format.underline; else format.underline = true; continue; }
    if (word === "ulnone") { delete format.underline; continue; }
    if (word === "f" && value !== undefined && FONT_FAMILIES[value]) { format.fontFamily = FONT_FAMILIES[value]; continue; }
    if (word === "fs" && value !== undefined && value >= 8 && value <= 144) { format.fontSizePt = value / 2; continue; }
    if (word === "cf") { if (value && colors[value - 1]) format.color = colors[value - 1]; else delete format.color; continue; }
    if (word === "highlight") { if (value && colors[value - 1]) format.backgroundColor = colors[value - 1]; else delete format.backgroundColor; continue; }
    if (word === "u" && value !== undefined) {
      addText(String.fromCodePoint(value < 0 ? value + 65536 : value));
      if (source[index] === "?") index += 1;
    }
  }

  const document: RichTextDocument = { version: 1, paragraphs };
  const textLength = paragraphs.reduce((sum, paragraph) => sum + paragraph.runs.reduce((runSum, run) => runSum + run.text.length, 0), 0);
  if (paragraphs.length > 40 || paragraphs.some((paragraph) => paragraph.runs.length > 100) || textLength > 5_000) {
    return { ok: false, errors: ["Der RTF-Text überschreitet die zulässigen Grenzen der Etikettenvorlage."] };
  }
  return { ok: true, value: document };
}
