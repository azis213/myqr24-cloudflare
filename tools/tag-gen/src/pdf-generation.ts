import QRCode from "qrcode";
import {
  type GeneratedTag,
  type LabelFontFamily,
  type LabelFontStyle,
  type LabelImageElement,
  type LabelTemplate,
  type PageCell,
  type PositionedElement,
  type RichTextDocument,
  defaultQrProfile,
  paginateTags,
  validateTemplate,
} from "./domain";
import {
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts,
  clip,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
} from "pdf-lib";

const MM_TO_PT = 72 / 25.4;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

export interface PdfGenerationProgress {
  completed: number;
  total: number;
}

export interface PdfGenerationOptions {
  onProgress?: (progress: PdfGenerationProgress) => void;
}

/**
 * Creates a physical A4 PDF. Every placement value in the label template is
 * converted from millimetres to PDF points once and is independent of browser
 * zoom, printer margins, or the native print dialog.
 */
export async function createTagPdf(
  tags: readonly GeneratedTag[],
  template: LabelTemplate,
  startRow: number,
  startColumn: number,
  options: PdfGenerationOptions = {},
): Promise<Blob> {
  const validation = validateTemplate(template);
  if (!validation.ok) throw new Error(validation.errors.join(" "));

  const pages = paginateTags(tags, template, startRow, startColumn);
  const document = await PDFDocument.create();
  document.setTitle(`myQR24 TAGs – ${template.name}`);
  document.setSubject("Maßhaltiger DIN-A4-Etikettendruck");
  document.setProducer("myQR24 TAG-Generator");

  const textFonts = await embedTextFonts(document);
  const total = tags.length;
  let completed = 0;

  for (const cells of pages) {
    const page = document.addPage([mm(A4_WIDTH_MM), mm(A4_HEIGHT_MM)]);
    drawPageText(page, template.pageLayout.header, template.pageLayout.header.topOffsetMm, textFonts.helvetica.normal);
    drawPageText(
      page,
      template.pageLayout.footer,
      A4_HEIGHT_MM - template.pageLayout.footer.bottomOffsetMm - template.pageLayout.footer.heightMm,
      textFonts.helvetica.normal,
    );

    for (const cell of cells) {
      if (!cell.tag) continue;
      await drawLabel(document, page, cell, template, textFonts);
      completed += 1;
      options.onProgress?.({ completed, total });
    }
  }

  const bytes = await document.save();
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer], { type: "application/pdf" });
}

function mm(value: number): number {
  return value * MM_TO_PT;
}

function pdfY(topMm: number, heightMm = 0): number {
  return mm(A4_HEIGHT_MM - topMm - heightMm);
}

function labelOrigin(cell: PageCell, template: LabelTemplate): { xMm: number; yMm: number } {
  const { grid } = template;
  return {
    xMm: grid.leftMarginMm + (cell.column - 1) * (grid.labelWidthMm + grid.horizontalGapMm),
    yMm: grid.topMarginMm + (cell.row - 1) * (grid.labelHeightMm + grid.verticalGapMm),
  };
}

type EmbeddedTextFonts = Record<LabelFontFamily, Record<LabelFontStyle, PDFFont>>;

async function embedTextFonts(document: PDFDocument): Promise<EmbeddedTextFonts> {
  return {
    helvetica: {
      normal: await document.embedFont(StandardFonts.Helvetica),
      bold: await document.embedFont(StandardFonts.HelveticaBold),
      italic: await document.embedFont(StandardFonts.HelveticaOblique),
      "bold-italic": await document.embedFont(StandardFonts.HelveticaBoldOblique),
    },
    "times-roman": {
      normal: await document.embedFont(StandardFonts.TimesRoman),
      bold: await document.embedFont(StandardFonts.TimesRomanBold),
      italic: await document.embedFont(StandardFonts.TimesRomanItalic),
      "bold-italic": await document.embedFont(StandardFonts.TimesRomanBoldItalic),
    },
    courier: {
      normal: await document.embedFont(StandardFonts.Courier),
      bold: await document.embedFont(StandardFonts.CourierBold),
      italic: await document.embedFont(StandardFonts.CourierOblique),
      "bold-italic": await document.embedFont(StandardFonts.CourierBoldOblique),
    },
  };
}

async function drawLabel(
  document: PDFDocument,
  page: PDFPage,
  cell: PageCell,
  template: LabelTemplate,
  textFonts: EmbeddedTextFonts,
): Promise<void> {
  const tag = cell.tag!;
  const origin = labelOrigin(cell, template);
  const qr = template.elements.qr;
  const labelX = mm(origin.xMm);
  const labelY = pdfY(origin.yMm, template.grid.labelHeightMm);
  const labelWidth = mm(template.grid.labelWidthMm);
  const labelHeight = mm(template.grid.labelHeightMm);

  page.drawRectangle({
    x: labelX,
    y: labelY,
    width: labelWidth,
    height: labelHeight,
    color: hexToRgb(template.backgroundColor),
  });

  if (template.backgroundImage?.visible) {
    const background = template.backgroundImage;
    const image = background.dataUrl.startsWith("data:image/png")
      ? await document.embedPng(background.dataUrl)
      : await document.embedJpg(background.dataUrl);
    page.drawImage(image, {
      x: mm(origin.xMm + background.xMm),
      y: pdfY(origin.yMm + background.yMm, background.heightMm),
      width: mm(background.widthMm),
      height: mm(background.heightMm),
      opacity: background.opacity,
    });
  }

  if (template.elements.image?.visible) {
    await drawLabelImage(document, page, origin, template.elements.image);
  }

  drawElementBackground(page, origin, template.elements.text);
  drawElementBackground(page, origin, template.elements.tagIdText);

  if (qr.borderWidthMm > 0) {
    const border = qr.borderWidthMm;
    page.drawRectangle({
      x: mm(origin.xMm + qr.xMm - border),
      y: pdfY(origin.yMm + qr.yMm - border, qr.heightMm + border * 2),
      width: mm(qr.widthMm + border * 2),
      height: mm(qr.heightMm + border * 2),
      color: hexToRgb(qr.borderColor),
    });
  }

  const qrProfile = tag.qrProfile ?? defaultQrProfile();
  const qrPng = await QRCode.toDataURL(tag.url, {
    ...(qrProfile.version === "auto" ? {} : { version: qrProfile.version }),
    errorCorrectionLevel: qrProfile.errorCorrectionLevel,
    margin: qrProfile.quietZoneModules,
    color: { dark: "#101828", light: "#ffffff" },
    width: 512,
  });
  const image = await document.embedPng(qrPng);
  page.drawImage(image, {
    x: mm(origin.xMm + qr.xMm),
    y: pdfY(origin.yMm + qr.yMm, qr.heightMm),
    width: mm(qr.widthMm),
    height: mm(qr.heightMm),
  });

  drawRichTextElement(page, template.elements.text.content, origin, template.elements.text, textFonts);
  drawElementText(page, tag.tagId, origin, template.elements.tagIdText, textFonts);
}

async function drawLabelImage(
  document: PDFDocument,
  page: PDFPage,
  origin: { xMm: number; yMm: number },
  element: LabelImageElement,
): Promise<void> {
  const image = element.dataUrl.startsWith("data:image/png")
    ? await document.embedPng(element.dataUrl)
    : await document.embedJpg(element.dataUrl);
  const boxWidth = mm(element.widthMm);
  const boxHeight = mm(element.heightMm);
  const sourceRatio = element.sourceWidthPx / element.sourceHeightPx;
  const boxRatio = boxWidth / boxHeight;
  let width = boxWidth;
  let height = boxHeight;

  if (element.fitMode !== "stretch") {
    const useWidth = element.fitMode === "contain" ? sourceRatio > boxRatio : sourceRatio < boxRatio;
    width = useWidth ? boxWidth : boxHeight * sourceRatio;
    height = useWidth ? boxWidth / sourceRatio : boxHeight;
    if (element.fitMode === "manual") {
      width *= element.scale / 100;
      height *= element.scale / 100;
    }
  }

  const x = mm(origin.xMm + element.xMm) + (boxWidth - width) * (element.offsetXPercent / 100);
  const y = pdfY(origin.yMm + element.yMm, element.heightMm) + (boxHeight - height) * (1 - element.offsetYPercent / 100);
  page.pushOperators(
    pushGraphicsState(),
    rectangle(mm(origin.xMm + element.xMm), pdfY(origin.yMm + element.yMm, element.heightMm), boxWidth, boxHeight),
    clip(),
    endPath(),
  );
  page.drawImage(image, { x, y, width, height, opacity: element.opacity });
  page.pushOperators(popGraphicsState());
}

function hexToRgb(color: string): ReturnType<typeof rgb> {
  const value = Number.parseInt(color.slice(1), 16);
  return rgb(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
}

function drawElementBackground(
  page: PDFPage,
  origin: { xMm: number; yMm: number },
  element: LabelTemplate["elements"]["text"] | LabelTemplate["elements"]["tagIdText"],
): void {
  if (!element.visible || !element.background.enabled) return;
  page.drawRectangle({
    x: mm(origin.xMm + element.xMm),
    y: pdfY(origin.yMm + element.yMm, element.heightMm),
    width: mm(element.widthMm),
    height: mm(element.heightMm),
    color: hexToRgb(element.background.color),
    opacity: element.background.opacity,
  });
}

function drawPageText(
  page: PDFPage,
  area: { text: string; leftMm: number; widthMm: number; heightMm: number },
  topMm: number,
  font: PDFFont,
): void {
  if (!area.text.trim() || area.widthMm <= 0 || area.heightMm <= 0) return;

  drawTextInBox(page, area.text, {
    xMm: area.leftMm,
    topMm,
    widthMm: area.widthMm,
    heightMm: area.heightMm,
    font,
    fontSizePt: 9,
    fontWeight: "normal",
    horizontalAlign: "left",
    verticalAlign: "middle",
    lineHeight: 1.2,
    overflow: "clip",
  });
}

interface RichTextLine {
  runs: RichTextDocument["paragraphs"][number]["runs"];
  height: number;
}

function richTextLines(content: RichTextDocument, element: LabelTemplate["elements"]["text"]): RichTextLine[] {
  const lines: RichTextLine[] = [];
  const paragraphs = content.paragraphs.length ? content.paragraphs : [{ runs: [] }];
  for (const paragraph of paragraphs) {
    let current: RichTextDocument["paragraphs"][number]["runs"] = [];
    const finish = (): void => {
      const height = Math.max(
        element.fontSizePt,
        ...current.map((run) => run.fontSizePt ?? element.fontSizePt),
      ) * element.lineHeight;
      lines.push({ runs: current, height });
      current = [];
    };
    if (!paragraph.runs.length) {
      finish();
      continue;
    }
    for (const run of paragraph.runs) {
      const pieces = run.text.replaceAll("\r\n", "\n").split("\n");
      pieces.forEach((piece, index) => {
        if (piece) current.push({ ...run, text: piece });
        if (index < pieces.length - 1) finish();
      });
    }
    finish();
  }
  return lines;
}

function drawRichTextElement(
  page: PDFPage,
  content: RichTextDocument,
  origin: { xMm: number; yMm: number },
  element: LabelTemplate["elements"]["text"],
  textFonts: EmbeddedTextFonts,
): void {
  if (!element.visible || element.widthMm <= 0 || element.heightMm <= 0) return;
  const heightPt = mm(element.heightMm);
  const lines = richTextLines(content, element);
  const visibleLines: RichTextLine[] = [];
  let usedHeight = 0;
  for (const line of lines) {
    if (usedHeight + line.height > heightPt + 0.001) break;
    visibleLines.push(line);
    usedHeight += line.height;
  }
  const topOffset = element.verticalAlign === "middle" ? (heightPt - usedHeight) / 2 : element.verticalAlign === "bottom" ? heightPt - usedHeight : 0;
  const xStart = mm(origin.xMm + element.xMm);
  const widthPt = mm(element.widthMm);
  let cursorFromTop = topOffset;

  for (const line of visibleLines) {
    const metrics = line.runs.map((run) => {
      const family = run.fontFamily ?? element.fontFamily;
      const size = run.fontSizePt ?? element.fontSizePt;
      const style = run.bold && run.italic ? "bold-italic" : run.bold ? "bold" : run.italic ? "italic" : element.fontStyle;
      const font = textFonts[family][style];
      return { run, font, size, width: font.widthOfTextAtSize(run.text, size) };
    });
    const lineWidth = metrics.reduce((total, metric) => total + metric.width, 0);
    let x = xStart + (element.horizontalAlign === "center" ? (widthPt - lineWidth) / 2 : element.horizontalAlign === "right" ? widthPt - lineWidth : 0);
    const maximumSize = Math.max(element.fontSizePt, ...metrics.map((metric) => metric.size));
    const baseline = pdfY(origin.yMm + element.yMm, element.heightMm) + heightPt - cursorFromTop - line.height + (line.height - maximumSize) / 2;

    for (const { run, font, size, width } of metrics) {
      if (run.backgroundColor && run.text) {
        page.drawRectangle({ x, y: baseline - 1, width, height: size + 2, color: hexToRgb(run.backgroundColor) });
      }
      if (run.text) page.drawText(run.text, { x, y: baseline, size, font, color: hexToRgb(run.color ?? "#121f33") });
      if (run.underline && run.text) {
        page.drawLine({ start: { x, y: baseline - 1 }, end: { x: x + width, y: baseline - 1 }, thickness: Math.max(0.4, size / 16), color: hexToRgb(run.color ?? "#121f33") });
      }
      x += width;
    }
    cursorFromTop += line.height;
  }
}

function drawElementText(
  page: PDFPage,
  content: string,
  origin: { xMm: number; yMm: number },
  element: LabelTemplate["elements"]["text"] | LabelTemplate["elements"]["tagIdText"],
  textFonts: EmbeddedTextFonts,
): void {
  if (!element.visible || !content || element.widthMm <= 0 || element.heightMm <= 0) return;
  drawTextInBox(page, content, {
    xMm: origin.xMm + element.xMm,
    topMm: origin.yMm + element.yMm,
    widthMm: element.widthMm,
    heightMm: element.heightMm,
    font: textFonts[element.fontFamily][element.fontStyle],
    fontSizePt: element.fontSizePt,
    fontWeight: element.fontStyle.includes("bold") ? "bold" : "normal",
    horizontalAlign: element.horizontalAlign,
    verticalAlign: element.verticalAlign,
    lineHeight: element.lineHeight,
    overflow: element.overflow,
  });
}

interface TextBox extends Pick<PositionedElement, "widthMm" | "heightMm"> {
  xMm: number;
  topMm: number;
  font: PDFFont;
  fontSizePt: number;
  fontWeight: "normal" | "bold";
  horizontalAlign: "left" | "center" | "right";
  verticalAlign: "top" | "middle" | "bottom";
  lineHeight: number;
  overflow: "shrink" | "ellipsis" | "clip";
}

function drawTextInBox(page: PDFPage, content: string, box: TextBox): void {
  const widthPt = mm(box.widthMm);
  const heightPt = mm(box.heightMm);
  let fontSize = box.fontSizePt;
  let lines = wrapText(content, box.font, fontSize, widthPt);
  let lineHeight = fontSize * box.lineHeight;

  if (box.overflow === "shrink") {
    while (lines.length * lineHeight > heightPt && fontSize > 4) {
      fontSize = Math.max(4, fontSize - 0.25);
      lineHeight = fontSize * box.lineHeight;
      lines = wrapText(content, box.font, fontSize, widthPt);
    }
  }

  const maxLines = Math.max(1, Math.floor(heightPt / lineHeight));
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    if (box.overflow === "ellipsis") {
      const last = lines.length - 1;
      lines[last] = fitWithEllipsis(lines[last], box.font, fontSize, widthPt);
    }
  }

  const contentHeight = Math.min(heightPt, lines.length * lineHeight);
  let topOffset = 0;
  if (box.verticalAlign === "middle") topOffset = (heightPt - contentHeight) / 2;
  if (box.verticalAlign === "bottom") topOffset = heightPt - contentHeight;

  lines.forEach((line, index) => {
    const lineWidth = box.font.widthOfTextAtSize(line, fontSize);
    let x = mm(box.xMm);
    if (box.horizontalAlign === "center") x += (widthPt - lineWidth) / 2;
    if (box.horizontalAlign === "right") x += widthPt - lineWidth;

    const baseline = pdfY(box.topMm, box.heightMm) + heightPt - topOffset - (index + 1) * lineHeight + (lineHeight - fontSize) / 2;
    page.drawText(line, { x, y: baseline, size: fontSize, font: box.font, color: rgb(0.07, 0.12, 0.2) });
  });
}

function wrapText(content: string, font: PDFFont, size: number, widthPt: number): string[] {
  const lines: string[] = [];
  for (const paragraph of content.replaceAll("\r\n", "\n").split("\n")) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }

    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= widthPt) {
        line = candidate;
      } else if (!line) {
        lines.push(splitLongWord(word, font, size, widthPt));
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function splitLongWord(word: string, font: PDFFont, size: number, widthPt: number): string {
  let result = "";
  for (const character of word) {
    if (font.widthOfTextAtSize(result + character, size) > widthPt) break;
    result += character;
  }
  return result || word.slice(0, 1);
}

function fitWithEllipsis(value: string, font: PDFFont, size: number, widthPt: number): string {
  const suffix = "…";
  let result = value;
  while (result && font.widthOfTextAtSize(result + suffix, size) > widthPt) result = result.slice(0, -1);
  return `${result}${suffix}`;
}
