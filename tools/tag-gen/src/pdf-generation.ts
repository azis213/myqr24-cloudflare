import QRCode from "qrcode";
import {
  type GeneratedTag,
  type LabelTemplate,
  type PageCell,
  type PositionedElement,
  defaultQrProfile,
  paginateTags,
  validateTemplate,
} from "./domain";
import {
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts,
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

  const regularFont = await document.embedFont(StandardFonts.Helvetica);
  const boldFont = await document.embedFont(StandardFonts.HelveticaBold);
  const total = tags.length;
  let completed = 0;

  for (const cells of pages) {
    const page = document.addPage([mm(A4_WIDTH_MM), mm(A4_HEIGHT_MM)]);
    drawPageText(page, template.pageLayout.header, template.pageLayout.header.topOffsetMm, regularFont);
    drawPageText(
      page,
      template.pageLayout.footer,
      A4_HEIGHT_MM - template.pageLayout.footer.bottomOffsetMm - template.pageLayout.footer.heightMm,
      regularFont,
    );

    for (const cell of cells) {
      if (!cell.tag) continue;
      await drawLabel(document, page, cell, template, regularFont, boldFont);
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

async function drawLabel(
  document: PDFDocument,
  page: PDFPage,
  cell: PageCell,
  template: LabelTemplate,
  regularFont: PDFFont,
  boldFont: PDFFont,
): Promise<void> {
  const tag = cell.tag!;
  const origin = labelOrigin(cell, template);
  const qr = template.elements.qr;
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

  drawElementText(page, tag.labelText, origin, template.elements.text, regularFont, boldFont);
  drawElementText(page, tag.tagId, origin, template.elements.tagIdText, regularFont, boldFont);
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

function drawElementText(
  page: PDFPage,
  content: string,
  origin: { xMm: number; yMm: number },
  element: LabelTemplate["elements"]["text"] | LabelTemplate["elements"]["tagIdText"],
  regularFont: PDFFont,
  boldFont: PDFFont,
): void {
  if (!content || element.widthMm <= 0 || element.heightMm <= 0) return;
  drawTextInBox(page, content, {
    xMm: origin.xMm + element.xMm,
    topMm: origin.yMm + element.yMm,
    widthMm: element.widthMm,
    heightMm: element.heightMm,
    font: element.fontWeight === "bold" ? boldFont : regularFont,
    fontSizePt: element.fontSizePt,
    fontWeight: element.fontWeight,
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
