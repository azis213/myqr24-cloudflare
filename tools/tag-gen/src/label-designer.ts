import {
  createLabelTemplateExport,
  makeId,
  now,
  parseLabelTemplateExport,
  type GeneratedTag,
  type LabelImageElement,
  type LabelTemplate,
  type PositionedElement,
  type RichTextDocument,
  type RichTextRun,
  type TagGeneratorConfiguration,
  validateTemplate,
} from "./domain";
import { richTextToRtf, rtfToRichText } from "./rich-text-rtf";

export interface LabelDesignerContext {
  app: HTMLDivElement;
  getConfiguration: () => TagGeneratorConfiguration;
  getGeneratedTags: () => GeneratedTag[];
  selectedTemplate: () => LabelTemplate;
  renderShell: (content: string) => void;
  escapeHtml: (value: string) => string;
  download: (name: string, content: string | Blob) => void;
  readFile: (input: HTMLInputElement) => Promise<string | undefined>;
  getNotice: () => string;
  setNotice: (value: string) => void;
}

let context: LabelDesignerContext;
let app: HTMLDivElement;
let configuration: TagGeneratorConfiguration;
let generatedTags: GeneratedTag[];
let notice = "";
let selectedTemplate: () => LabelTemplate;
let escapeHtml: (value: string) => string;
let download: (name: string, content: string | Blob) => void;
let readFile: (input: HTMLInputElement) => Promise<string | undefined>;
let editorZoom = 100;
let richTextMode: "wysiwyg" | "rtf" = "wysiwyg";
let rtfSource = "";
let dragState:
  | {
      element: "qr" | "image" | "text" | "tagIdText";
      startX: number;
      startY: number;
      originX: number;
      originY: number;
    }
  | undefined;

export function renderLabelDesigner(nextContext: LabelDesignerContext): void {
  context = nextContext;
  app = context.app;
  configuration = context.getConfiguration();
  generatedTags = context.getGeneratedTags();
  notice = context.getNotice();
  selectedTemplate = context.selectedTemplate;
  escapeHtml = context.escapeHtml;
  download = context.download;
  readFile = context.readFile;
  renderTemplates();
}

function renderTemplateShell(content: string): void {
  context.setNotice(notice);
  context.renderShell(content);
}

function numberControl(id: string, value: number, options: { min: number; step: number; position?: string }): string {
  const dataPosition = options.position ? ` data-position="${options.position}"` : "";
  return `<input id="${id}"${dataPosition} type="number" min="${options.min}" step="${options.step}" value="${value}">`;
}

function parseLayoutNumber(input: string): number {
  return Number(input);
}

function imageStyle(image: LabelImageElement, scale: number): string {
  const size = image.fitMode === "cover" ? "cover" : image.fitMode === "contain" ? "contain" : image.fitMode === "stretch" ? "100% 100%" : `${image.scale}% auto`;
  return `left:${image.xMm * scale}px;top:${image.yMm * scale}px;width:${image.widthMm * scale}px;height:${image.heightMm * scale}px;opacity:${image.opacity};background-image:url('${image.dataUrl}');background-size:${size};background-position:${image.offsetXPercent}% ${image.offsetYPercent}%;background-repeat:no-repeat;overflow:hidden;`;
}
function renderTemplates(): void {
  const template = selectedTemplate();
  const layoutState = validateTemplate(template);
  const grid = template.grid;
  const labelScale = 5 * (editorZoom / 100);
  const labelStyle = `width:${grid.labelWidthMm * labelScale}px;height:${grid.labelHeightMm * labelScale}px;background-color:${template.backgroundColor};`;
  const backgroundImageStyle = template.backgroundImage?.visible
    ? `left:${template.backgroundImage.xMm * labelScale}px;top:${template.backgroundImage.yMm * labelScale}px;width:${template.backgroundImage.widthMm * labelScale}px;height:${template.backgroundImage.heightMm * labelScale}px;opacity:${template.backgroundImage.opacity};background-image:url('${template.backgroundImage.dataUrl}');`
    : "";
  const imageElementStyle = template.elements.image?.visible ? imageStyle(template.elements.image, labelScale) : "";
  renderTemplateShell(`
    <section class="grid template-layout">
      <article class="card"><div class="card-heading"><div><p class="eyebrow">VORLAGENEIGENSCHAFTEN</p><h2>DIN A4 Raster</h2></div><span class="status ${layoutState.ok ? "success" : "error"}">${layoutState.ok ? "druckbar" : "prüfen"}</span></div>
      <div class="compact-form">
        <label>Name<input id="template-name" value="${escapeHtml(template.name)}"></label>
        <label>Spalten${numberControl("grid-columns", grid.columns, { min: 1, step: 1 })}</label><label>Zeilen${numberControl("grid-rows", grid.rows, { min: 1, step: 1 })}</label>
        <label>Etikettbreite mm${numberControl("label-width", grid.labelWidthMm, { min: 1, step: 0.1 })}</label><label>Etiketthöhe mm${numberControl("label-height", grid.labelHeightMm, { min: 1, step: 0.1 })}</label>
        <label>Etiketten-Hintergrund${colorControl("template-background-color", template.backgroundColor)}</label>
        <label>Linker Rand mm${numberControl("left-margin", grid.leftMarginMm, { min: 0, step: 0.1 })}</label><label>Oberer Rand mm${numberControl("top-margin", grid.topMarginMm, { min: 0, step: 0.1 })}</label>
        <label>Horizontaler Abstand mm${numberControl("h-gap", grid.horizontalGapMm, { min: 0, step: 0.1 })}</label><label>Vertikaler Abstand mm${numberControl("v-gap", grid.verticalGapMm, { min: 0, step: 0.1 })}</label>
      </div>
      <h3>Seitenkopf (einmal je A4-Seite)</h3>
      <div class="compact-form">
        <label>Text<input id="header-text" value="${escapeHtml(template.pageLayout.header.text)}"></label>
        <label>Abstand oben mm${numberControl("header-top", template.pageLayout.header.topOffsetMm, { min: 0, step: 0.1 })}</label>
        <label>Links mm${numberControl("header-left", template.pageLayout.header.leftMm, { min: 0, step: 0.1 })}</label>
        <label>Breite mm${numberControl("header-width", template.pageLayout.header.widthMm, { min: 0, step: 0.1 })}</label>
        <label>Höhe mm${numberControl("header-height", template.pageLayout.header.heightMm, { min: 0, step: 0.1 })}</label>
      </div>
      <h3>Seitenfuß (einmal je A4-Seite)</h3>
      <div class="compact-form">
        <label>Text<input id="footer-text" value="${escapeHtml(template.pageLayout.footer.text)}"></label>
        <label>Abstand unten mm${numberControl("footer-bottom", template.pageLayout.footer.bottomOffsetMm, { min: 0, step: 0.1 })}</label>
        <label>Links mm${numberControl("footer-left", template.pageLayout.footer.leftMm, { min: 0, step: 0.1 })}</label>
        <label>Breite mm${numberControl("footer-width", template.pageLayout.footer.widthMm, { min: 0, step: 0.1 })}</label>
        <label>Höhe mm${numberControl("footer-height", template.pageLayout.footer.heightMm, { min: 0, step: 0.1 })}</label>
      </div>
      ${!layoutState.ok ? `<div class="form-errors">${layoutState.errors.map((message) => `<div>${escapeHtml(message)}</div>`).join("")}</div>` : ""}
      <div class="toolbar"><button class="primary" id="save-template">Vorlage übernehmen</button><button class="secondary" id="duplicate-template">Duplizieren</button><button class="secondary" id="export-template">Vorlage als Datei speichern</button><label class="file-button">Vorlage aus Datei laden<input id="import-template" type="file" accept="application/json"></label></div></article>
      <article class="card"><div class="card-heading"><div><p class="eyebrow">A4-VORSCHAU</p><h2>${grid.columns} × ${grid.rows} Etiketten</h2></div></div><div class="a4-mini" style="--columns:${grid.columns};--rows:${grid.rows};--left:${grid.leftMarginMm / 2.1}%;--top:${grid.topMarginMm / 2.97}%;--width:${grid.labelWidthMm / 2.1}%;--height:${grid.labelHeightMm / 2.97}%;--gapx:${grid.horizontalGapMm / 2.1}%;--gapy:${grid.verticalGapMm / 2.97}%;"></div></article>
    </section>
    <section class="card"><div class="card-heading"><div><p class="eyebrow">EINZELETIKETT</p><h2>QR-Code und Text positionieren</h2></div><span class="hint">Ziehen Sie die Bereiche im Etikett. Präzise Werte stehen rechts.</span></div>
      <div class="label-editor">
        <div class="editor-zoom"><label>Zoom<select id="editor-zoom">${[75, 100, 125, 150, 175, 200, 250, 300, 350, 400].map((value) => `<option value="${value}" ${editorZoom === value ? "selected" : ""}>${value} %</option>`).join("")}</select></label><span class="hint">Zoom ändert nur die Editoransicht.</span></div>
        <div class="label-stage-viewport">
          <div class="label-stage" id="label-stage" style="${labelStyle}">
            ${backgroundImageStyle ? `<div class="editor-background-image" style="${backgroundImageStyle}"></div>` : ""}
            ${imageElementStyle ? `<div class="editable-element image-element" data-element="image" style="${imageElementStyle}"></div>` : ""}
            <div class="editable-element qr-element" data-element="qr" style="left:${template.elements.qr.xMm * labelScale}px;top:${template.elements.qr.yMm * labelScale}px;width:${template.elements.qr.widthMm * labelScale}px;height:${template.elements.qr.heightMm * labelScale}px;border-width:${template.elements.qr.borderWidthMm * labelScale}px;border-color:${template.elements.qr.borderColor};">QR</div>
            ${template.elements.text.visible ? `<div class="editable-element text-element rich-text-preview" data-element="text" style="${editorTextStyle(template.elements.text, labelScale)}">${renderRichText(template.elements.text.content, escapeHtml)}</div>` : ""}
            ${template.elements.tagIdText.visible ? `<div class="editable-element tag-id-element" data-element="tagIdText" style="${editorTextStyle(template.elements.tagIdText, labelScale)}">${escapeHtml(generatedTags[0]?.tagId || "TAG-ID")}</div>` : ""}
          </div>
        </div>
        <div class="element-fields">
          <section class="element-config"><h3>QR-Code</h3>${elementFields("qr", template.elements.qr)}${qrAppearanceFields(template)}</section>
          <section class="element-config"><h3>Hintergrundbild</h3>${backgroundImageFields(template)}</section>
          <section class="element-config"><h3>Bildfeld</h3>${imageElementFields(template)}</section>
          <section class="element-config"><h3>Freies Textfeld</h3>${elementFields("text", template.elements.text)}${richTextEditor(template.elements.text.content)}${textAppearanceFields("text", template.elements.text)}</section>
          <section class="element-config"><h3>Lesbare TAG-ID</h3>${elementFields("tagIdText", template.elements.tagIdText)}${textAppearanceFields("tagIdText", template.elements.tagIdText)}</section>
        </div>
        <p class="hint editor-hint">Größe und Position werden in Millimetern gespeichert. QR-Code bleibt quadratisch.</p>
      </div>
    </section>
  `);

  const numeric = (id: string): number => parseLayoutNumber(app.querySelector<HTMLInputElement>(`#${id}`)?.value ?? "0");
  app.querySelector("#save-template")?.addEventListener("click", () => {
    template.name = app.querySelector<HTMLInputElement>("#template-name")?.value ?? template.name;
    Object.assign(template.grid, {
      columns: numeric("grid-columns"), rows: numeric("grid-rows"), labelWidthMm: numeric("label-width"), labelHeightMm: numeric("label-height"),
      leftMarginMm: numeric("left-margin"), topMarginMm: numeric("top-margin"), horizontalGapMm: numeric("h-gap"), verticalGapMm: numeric("v-gap"),
    });
    Object.assign(template.pageLayout.header, {
      text: app.querySelector<HTMLInputElement>("#header-text")?.value ?? "",
      topOffsetMm: numeric("header-top"),
      leftMm: numeric("header-left"),
      widthMm: numeric("header-width"),
      heightMm: numeric("header-height"),
    });
    Object.assign(template.pageLayout.footer, {
      text: app.querySelector<HTMLInputElement>("#footer-text")?.value ?? "",
      bottomOffsetMm: numeric("footer-bottom"),
      leftMm: numeric("footer-left"),
      widthMm: numeric("footer-width"),
      heightMm: numeric("footer-height"),
    });
    template.updatedAt = now();
    const result = validateTemplate(template);
    notice = result.ok ? "Etikettenvorlage aktualisiert." : result.errors.join(" ");
    renderTemplates();
  });
  app.querySelector("#duplicate-template")?.addEventListener("click", () => {
    const copy = structuredClone(template);
    copy.id = makeId(); copy.name = `${copy.name} – Kopie`; copy.createdAt = now(); copy.updatedAt = now();
    configuration.labelTemplates.push(copy); configuration.selectedTemplateId = copy.id; notice = "Vorlage dupliziert."; renderTemplates();
  });
  app.querySelector("#export-template")?.addEventListener("click", () => {
    download(`myqr24-label-template-${template.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "template"}.json`, createLabelTemplateExport(template));
    notice = "Etikettenvorlage als JSON-Datei exportiert.";
  });
  app.querySelector<HTMLInputElement>("#import-template")?.addEventListener("change", async (event) => {
    const text = await readFile(event.target as HTMLInputElement);
    if (!text) return;
    const parsed = parseLabelTemplateExport(text);
    if (!parsed.ok) { notice = parsed.errors.join(" "); renderTemplates(); return; }
    configuration.labelTemplates.push(parsed.value);
    configuration.selectedTemplateId = parsed.value.id;
    notice = `Etikettenvorlage „${parsed.value.name}“ importiert.`;
    renderTemplates();
  });
  app.querySelector("#editor-zoom")?.addEventListener("change", (event) => {
    editorZoom = Number((event.target as HTMLSelectElement).value);
    renderTemplates();
  });
  bindColorControls(template);
  bindBackgroundImageFields(template);
  bindImageElementFields(template);
  bindElementFields(template);
  bindTextAppearanceFields(template);
  bindRichTextEditor(template);
  bindDrag(template, labelScale);
}

function colorControl(id: string, color: string, target = id): string {
  return `<span class="color-control"><input aria-label="Farbe auswählen" type="color" value="${color}" data-color-picker="${target}"><input id="${id}" value="${color}" maxlength="7" spellcheck="false" data-color-value="${target}"></span>`;
}

export function editorTextStyle(
  element: LabelTemplate["elements"]["text"] | LabelTemplate["elements"]["tagIdText"],
  scale: number,
): string {
  const cssFamily = element.fontFamily === "times-roman" ? "Times New Roman, serif" : element.fontFamily === "courier" ? "Courier New, monospace" : "Helvetica, Arial, sans-serif";
  const fontStyle = element.fontStyle.includes("italic") ? "italic" : "normal";
  const fontWeight = element.fontStyle.includes("bold") ? "700" : "400";
  const horizontal = element.horizontalAlign;
  const vertical = element.verticalAlign === "top" ? "flex-start" : element.verticalAlign === "bottom" ? "flex-end" : "center";
  const background = element.background.enabled ? `background-color:${element.background.color};background-opacity:${element.background.opacity};background-color:${hexWithAlpha(element.background.color, element.background.opacity)};` : "";
  return `left:${element.xMm * scale}px;top:${element.yMm * scale}px;width:${element.widthMm * scale}px;height:${element.heightMm * scale}px;font-family:${cssFamily};font-size:${element.fontSizePt * 1.333}px;font-style:${fontStyle};font-weight:${fontWeight};text-align:${horizontal};justify-content:${vertical};${background}`;
}

function hexWithAlpha(hex: string, opacity: number): string {
  const alpha = Math.round(Math.max(0, Math.min(1, opacity)) * 255).toString(16).padStart(2, "0");
  return `${hex}${alpha}`;
}

export function renderRichText(document: RichTextDocument, escape: (value: string) => string): string {
  return document.paragraphs.map((paragraph) => {
    const runs = paragraph.runs.map((run) => {
      const styles = [
        run.color ? `color:${run.color}` : "",
        run.backgroundColor ? `background-color:${run.backgroundColor}` : "",
        run.underline ? "text-decoration:underline" : "",
        run.fontFamily ? `font-family:${cssFontFamily(run.fontFamily)}` : "",
        run.fontSizePt ? `font-size:${run.fontSizePt}pt` : "",
      ].filter(Boolean).join(";");
      let value = escape(run.text).replaceAll("\n", "<br>");
      if (run.bold) value = `<strong>${value}</strong>`;
      if (run.italic) value = `<em>${value}</em>`;
      return `<span${styles ? ` style="${styles}"` : ""}>${value}</span>`;
    }).join("");
    return `<div class="rich-text-paragraph">${runs || "<br>"}</div>`;
  }).join("");
}

function cssFontFamily(font: "helvetica" | "times-roman" | "courier"): string {
  return font === "times-roman" ? "Times New Roman, serif" : font === "courier" ? "Courier New, monospace" : "Helvetica, Arial, sans-serif";
}

function richTextEditor(document: RichTextDocument): string {
  if (!rtfSource) rtfSource = richTextToRtf(document, { fontFamily: "helvetica", fontSizePt: 9 });
  return `<div class="rich-text-editor">
    <div class="rich-text-heading"><p class="field-label">Formatierter Vorlagentext</p><div class="rich-text-mode" role="group" aria-label="Bearbeitungsmodus"><button class="${richTextMode === "wysiwyg" ? "primary" : "secondary"}" type="button" data-rich-mode="wysiwyg">WYSIWYG</button><button class="${richTextMode === "rtf" ? "primary" : "secondary"}" type="button" data-rich-mode="rtf">RTF</button></div></div>
    <div class="rich-text-toolbar ${richTextMode === "rtf" ? "is-hidden" : ""}" role="toolbar" aria-label="Textformatierung">
      <button class="secondary" type="button" data-rich-command="bold" title="Fett"><strong>F</strong></button>
      <button class="secondary" type="button" data-rich-command="italic" title="Kursiv"><em>K</em></button>
      <button class="secondary" type="button" data-rich-command="underline" title="Unterstreichen"><u>U</u></button>
      <label>Schriftart<select data-rich-font-family><option value="helvetica">Helvetica</option><option value="times-roman">Times Roman</option><option value="courier">Courier</option></select></label>
      <label>Größe<select data-rich-font-size>${[6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72].map((size) => `<option value="${size}">${size} pt</option>`).join("")}</select></label>
      <label class="rich-color">Schriftfarbe<input type="color" value="#172033" data-rich-color="foreColor"></label>
      <label class="rich-color">Markierung<input type="color" value="#fff3a3" data-rich-color="hiliteColor"></label>
      <button class="secondary" type="button" data-rich-command="removeFormat">Format löschen</button>
    </div>
    <div id="rich-text-editor" class="rich-text-input ${richTextMode === "rtf" ? "is-hidden" : ""}" contenteditable="true" role="textbox" aria-multiline="true" spellcheck="true">${renderRichText(document, escapeHtml)}</div>
    <textarea id="rich-text-rtf" class="rich-text-rtf ${richTextMode === "wysiwyg" ? "is-hidden" : ""}" spellcheck="false" aria-label="RTF-Quelltext">${escapeHtml(rtfSource)}</textarea>
    <p class="hint">${richTextMode === "rtf" ? "Unterstützt werden Absätze, Zeilenumbrüche, Schriftfamilie, Größe, Fett, Kursiv, Unterstreichen, Schrift- und Markerfarben." : "Enter erstellt einen Absatz, Umschalt+Enter einen Zeilenumbruch. Markierten Text direkt über die Toolbar formatieren."}</p>
  </div>`;
}

function normalizeColor(value: string | null): `#${string}` | undefined {
  if (!value) return undefined;
  const compact = value.trim().toLowerCase();
  if (/^#[\da-f]{6}$/.test(compact)) return compact as `#${string}`;
  const match = compact.match(/^rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)$/);
  if (!match) return undefined;
  return `#${match.slice(1).map((entry) => Number(entry).toString(16).padStart(2, "0")).join("")}` as `#${string}`;
}

function richTextFromElement(editor: HTMLElement): RichTextDocument {
  const paragraphs = Array.from(editor.childNodes).map((node) => {
    const runs: RichTextRun[] = [];
    const visit = (current: Node, format: Omit<RichTextRun, "text"> = {}): void => {
      if (current.nodeType === Node.TEXT_NODE) {
        if (current.textContent) runs.push({ text: current.textContent, ...format });
        return;
      }
      if (!(current instanceof HTMLElement)) return;
      if (current.tagName === "BR") {
        runs.push({ text: "\n", ...format });
        return;
      }
      const style = getComputedStyle(current);
      const next = {
        ...format,
        ...(current.tagName === "STRONG" || current.tagName === "B" || Number(style.fontWeight) >= 600 ? { bold: true } : {}),
        ...(current.tagName === "EM" || current.tagName === "I" || style.fontStyle === "italic" ? { italic: true } : {}),
        ...(current.tagName === "U" || style.textDecorationLine.includes("underline") ? { underline: true } : {}),
        ...(normalizeColor(style.color) ? { color: normalizeColor(style.color) } : {}),
        ...(normalizeColor(style.backgroundColor) ? { backgroundColor: normalizeColor(style.backgroundColor) } : {}),
        ...(style.fontFamily.includes("Times") ? { fontFamily: "times-roman" as const } : style.fontFamily.includes("Courier") ? { fontFamily: "courier" as const } : { fontFamily: "helvetica" as const }),
        ...(Number.isFinite(Number.parseFloat(style.fontSize)) ? { fontSizePt: Math.max(4, Math.min(72, Math.round((Number.parseFloat(style.fontSize) * 72 / 96) * 2) / 2)) } : {}),
      };
      current.childNodes.forEach((child) => visit(child, next));
    };
    visit(node);
    return { runs };
  });
  return { version: 1, paragraphs: paragraphs.length ? paragraphs : [{ runs: [] }] };
}

function bindRichTextEditor(template: LabelTemplate): void {
  const editor = app.querySelector<HTMLElement>("#rich-text-editor");
  const rtf = app.querySelector<HTMLTextAreaElement>("#rich-text-rtf");
  const defaults = () => ({ fontFamily: template.elements.text.fontFamily, fontSizePt: template.elements.text.fontSizePt });

  const sync = (): void => {
    if (!editor) return;
    template.elements.text.content = richTextFromElement(editor);
    rtfSource = richTextToRtf(template.elements.text.content, defaults());
    template.updatedAt = now();
    const preview = app.querySelector<HTMLElement>(".rich-text-preview");
    if (preview) preview.innerHTML = renderRichText(template.elements.text.content, escapeHtml);
  };

  editor?.addEventListener("input", sync);
  app.querySelectorAll<HTMLButtonElement>("[data-rich-mode]").forEach((button) => button.addEventListener("click", () => {
    const nextMode = button.dataset.richMode as "wysiwyg" | "rtf";
    if (nextMode === "rtf") {
      sync();
      richTextMode = "rtf";
      renderTemplates();
      return;
    }
    const parsed = rtfToRichText(rtf?.value ?? rtfSource, defaults());
    if (!parsed.ok) {
      notice = parsed.errors.join(" ");
      richTextMode = "rtf";
      renderTemplates();
      return;
    }
    template.elements.text.content = parsed.value;
    rtfSource = richTextToRtf(parsed.value, defaults());
    template.updatedAt = now();
    richTextMode = "wysiwyg";
    renderTemplates();
  }));
  app.querySelectorAll<HTMLButtonElement>("[data-rich-command]").forEach((button) => {
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => {
      editor?.focus();
      document.execCommand(button.dataset.richCommand!, false);
      sync();
    });
  });
  app.querySelectorAll<HTMLInputElement>("[data-rich-color]").forEach((input) => {
    input.addEventListener("mousedown", (event) => event.stopPropagation());
    input.addEventListener("input", () => {
      editor?.focus();
      document.execCommand(input.dataset.richColor!, false, input.value);
      sync();
    });
  });
  app.querySelector<HTMLSelectElement>("[data-rich-font-family]")?.addEventListener("change", (event) => {
    editor?.focus();
    document.execCommand("fontName", false, cssFontFamily((event.target as HTMLSelectElement).value as "helvetica" | "times-roman" | "courier"));
    sync();
  });
  app.querySelector<HTMLSelectElement>("[data-rich-font-size]")?.addEventListener("change", (event) => {
    editor?.focus();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand("fontSize", false, "7");
    editor?.querySelectorAll<HTMLElement>("font[size='7'], span[style*='xxx-large']").forEach((node) => { node.style.fontSize = `${(event.target as HTMLSelectElement).value}pt`; });
    sync();
  });
  rtf?.addEventListener("input", () => { rtfSource = rtf.value; });
}

function elementFields(kind: "qr" | "image" | "text" | "tagIdText", element: { xMm: number; yMm: number; widthMm: number; heightMm: number }): string {
  return `<div class="compact-form element-form">
    <label>X mm${numberControl(`position-${kind}-x`, element.xMm, { min: 0, step: 0.1, position: `${kind}:xMm` })}</label>
    <label>Y mm${numberControl(`position-${kind}-y`, element.yMm, { min: 0, step: 0.1, position: `${kind}:yMm` })}</label>
    <label>Breite mm${numberControl(`position-${kind}-width`, element.widthMm, { min: 1, step: 0.1, position: `${kind}:widthMm` })}</label>
    <label>Höhe mm${numberControl(`position-${kind}-height`, element.heightMm, { min: 1, step: 0.1, position: `${kind}:heightMm` })}</label>
  </div>`;
}

function qrAppearanceFields(template: LabelTemplate): string {
  const qr = template.elements.qr;
  return `<div class="compact-form element-form"><label>Randbreite mm${numberControl("qr-border-width", qr.borderWidthMm, { min: 0, step: 0.1 })}</label><label>Randfarbe${colorControl("qr-border-color", qr.borderColor)}</label></div>`;
}

function backgroundImageFields(template: LabelTemplate): string {
  const image = template.backgroundImage;
  return `<div class="compact-form element-form">
    <label class="checkbox-label"><input id="background-image-visible" type="checkbox" ${image?.visible ? "checked" : ""} ${image ? "" : "disabled"}> Bild anzeigen</label>
    <label>Lokales PNG/JPEG<input id="background-image-file" type="file" accept="image/png,image/jpeg"></label>
    ${image ? `<label>X mm${numberControl("background-image-x", image.xMm, { min: 0, step: 0.1 })}</label><label>Y mm${numberControl("background-image-y", image.yMm, { min: 0, step: 0.1 })}</label><label>Breite mm${numberControl("background-image-width", image.widthMm, { min: 0.1, step: 0.1 })}</label><label>Höhe mm${numberControl("background-image-height", image.heightMm, { min: 0.1, step: 0.1 })}</label><label>Blässe %<input id="background-image-opacity" type="number" min="0" max="100" step="1" value="${Math.round(image.opacity * 100)}"></label>` : `<p class="hint">Noch kein lokales Bild ausgewählt.</p>`}
  </div>`;
}

function imageElementFields(template: LabelTemplate): string {
  const image = template.elements.image;
  return `<div class="compact-form element-form">
    <label class="checkbox-label"><input id="image-visible" type="checkbox" ${image?.visible ? "checked" : ""} ${image ? "" : "disabled"}> Bildfeld anzeigen</label>
    <label>Lokales PNG/JPEG<input id="image-file" type="file" accept="image/png,image/jpeg"></label>
    ${image ? `${elementFields("image", image)}
    <label>Darstellung<select id="image-fit-mode"><option value="cover" ${image.fitMode === "cover" ? "selected" : ""}>Ausfüllen, proportional</option><option value="contain" ${image.fitMode === "contain" ? "selected" : ""}>Einpassen, proportional</option><option value="stretch" ${image.fitMode === "stretch" ? "selected" : ""}>Exakt einpassen</option><option value="manual" ${image.fitMode === "manual" ? "selected" : ""}>Manuell</option></select></label>
    <label>Zoom %<input id="image-scale" type="number" min="10" max="400" step="1" value="${image.scale}"></label>
    <label>Horizontal %<input id="image-offset-x" type="number" min="0" max="100" step="1" value="${image.offsetXPercent}"></label>
    <label>Vertikal %<input id="image-offset-y" type="number" min="0" max="100" step="1" value="${image.offsetYPercent}"></label>` : `<p class="hint">Noch kein lokales Bild ausgewählt.</p>`}
  </div>`;
}

function textAppearanceFields(
  kind: "text" | "tagIdText",
  element: LabelTemplate["elements"]["text"] | LabelTemplate["elements"]["tagIdText"],
): string {
  return `<div class="compact-form element-form">
    <label class="checkbox-label"><input type="checkbox" data-text-toggle="${kind}:visible" ${element.visible ? "checked" : ""}> Textfeld anzeigen</label>
    <label>Horizontal<select data-text-appearance="${kind}:horizontalAlign"><option value="left" ${element.horizontalAlign === "left" ? "selected" : ""}>Links</option><option value="center" ${element.horizontalAlign === "center" ? "selected" : ""}>Zentriert</option><option value="right" ${element.horizontalAlign === "right" ? "selected" : ""}>Rechts</option></select></label>
    <label>Vertikal<select data-text-appearance="${kind}:verticalAlign"><option value="top" ${element.verticalAlign === "top" ? "selected" : ""}>Oben</option><option value="middle" ${element.verticalAlign === "middle" ? "selected" : ""}>Mittig</option><option value="bottom" ${element.verticalAlign === "bottom" ? "selected" : ""}>Unten</option></select></label>
    <label class="checkbox-label"><input type="checkbox" data-text-toggle="${kind}:background" ${element.background.enabled ? "checked" : ""}> Texthintergrund</label>
    <label>Hintergrundfarbe${colorControl(`text-${kind}-background-color`, element.background.color)}</label>
    <label>Transparenz %<input type="number" min="0" max="100" step="1" value="${Math.round(element.background.opacity * 100)}" data-text-opacity="${kind}"></label>
    ${kind === "tagIdText" ? `<label>Schriftart<select data-text-appearance="${kind}:fontFamily"><option value="helvetica" ${element.fontFamily === "helvetica" ? "selected" : ""}>Helvetica</option><option value="times-roman" ${element.fontFamily === "times-roman" ? "selected" : ""}>Times Roman</option><option value="courier" ${element.fontFamily === "courier" ? "selected" : ""}>Courier</option></select></label>
    <label>Schriftgröße pt${numberControl(`text-${kind}-font-size`, element.fontSizePt, { min: 4, step: 0.5, position: `${kind}:fontSizePt` })}</label>
    <label>Schrifttyp<select data-text-appearance="${kind}:fontStyle"><option value="normal" ${element.fontStyle === "normal" ? "selected" : ""}>Normal</option><option value="bold" ${element.fontStyle === "bold" ? "selected" : ""}>Fett</option><option value="italic" ${element.fontStyle === "italic" ? "selected" : ""}>Kursiv</option><option value="bold-italic" ${element.fontStyle === "bold-italic" ? "selected" : ""}>Fett kursiv</option></select></label>` : ""}
  </div>`;
}

function bindElementFields(template: LabelTemplate): void {
  app.querySelectorAll<HTMLInputElement>("[data-position]").forEach((input) => input.addEventListener("change", () => {
    const [kind, property] = input.dataset.position!.split(":") as [
      "qr" | "image" | "text" | "tagIdText",
      keyof PositionedElement,
    ];
    const element: PositionedElement | undefined =
      kind === "qr" ? template.elements.qr : kind === "image" ? template.elements.image : kind === "text" ? template.elements.text : template.elements.tagIdText;
    if (!element) return;
    element[property] = parseLayoutNumber(input.value);
    if (kind === "qr" && (property === "widthMm" || property === "heightMm")) {
      template.elements.qr.widthMm = parseLayoutNumber(input.value);
      template.elements.qr.heightMm = parseLayoutNumber(input.value);
    }
    template.updatedAt = now();
    renderTemplates();
  }));
}

function bindColorControls(template: LabelTemplate): void {
  const apply = (target: string, value: string): void => {
    if (!/^#[\da-f]{6}$/i.test(value)) { notice = "Bitte einen gültigen Hex-Farbwert wie #1a2b3c eingeben."; renderTemplates(); return; }
    const color = value.toLowerCase() as `#${string}`;
    if (target === "template-background-color") template.backgroundColor = color;
    else if (target === "qr-border-color") template.elements.qr.borderColor = color;
    else {
      const match = target.match(/^text-(text|tagIdText)-background-color$/);
      if (match) template.elements[match[1] as "text" | "tagIdText"].background.color = color;
    }
    template.updatedAt = now();
    renderTemplates();
  };
  app.querySelectorAll<HTMLInputElement>("[data-color-picker]").forEach((input) => input.addEventListener("input", () => apply(input.dataset.colorPicker!, input.value)));
  app.querySelectorAll<HTMLInputElement>("[data-color-value]").forEach((input) => input.addEventListener("change", () => apply(input.dataset.colorValue!, input.value)));
  app.querySelector("#qr-border-width")?.addEventListener("change", (event) => { template.elements.qr.borderWidthMm = parseLayoutNumber((event.target as HTMLInputElement).value); template.updatedAt = now(); renderTemplates(); });
}

function bindBackgroundImageFields(template: LabelTemplate): void {
  app.querySelector("#background-image-visible")?.addEventListener("change", (event) => { if (template.backgroundImage) template.backgroundImage.visible = (event.target as HTMLInputElement).checked; template.updatedAt = now(); renderTemplates(); });
  app.querySelector("#background-image-file")?.addEventListener("change", async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) { notice = "Bitte ausschließlich PNG- oder JPEG-Bilder auswählen."; renderTemplates(); return; }
    const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Die Bilddatei konnte nicht gelesen werden.")); reader.readAsDataURL(file); });
    template.backgroundImage = { visible: true, dataUrl, opacity: 0.35, xMm: 0, yMm: 0, widthMm: template.grid.labelWidthMm, heightMm: template.grid.labelHeightMm };
    template.updatedAt = now(); notice = `Hintergrundbild „${file.name}“ übernommen.`; renderTemplates();
  });
  ["xMm", "yMm", "widthMm", "heightMm"].forEach((property) => app.querySelector(`#background-image-${property === "xMm" ? "x" : property === "yMm" ? "y" : property === "widthMm" ? "width" : "height"}`)?.addEventListener("change", (event) => { if (template.backgroundImage) (template.backgroundImage as unknown as Record<string, number>)[property] = parseLayoutNumber((event.target as HTMLInputElement).value); template.updatedAt = now(); renderTemplates(); }));
  app.querySelector("#background-image-opacity")?.addEventListener("change", (event) => { if (template.backgroundImage) template.backgroundImage.opacity = parseLayoutNumber((event.target as HTMLInputElement).value) / 100; template.updatedAt = now(); renderTemplates(); });
}

function imageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("Die Bilddatei konnte nicht gelesen werden."));
    image.src = dataUrl;
  });
}

function bindImageElementFields(template: LabelTemplate): void {
  app.querySelector<HTMLInputElement>("#image-visible")?.addEventListener("change", (event) => {
    if (template.elements.image) template.elements.image.visible = (event.target as HTMLInputElement).checked;
    template.updatedAt = now();
    renderTemplates();
  });
  app.querySelector<HTMLInputElement>("#image-file")?.addEventListener("change", async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) { notice = "Bitte ausschließlich PNG- oder JPEG-Bilder auswählen."; renderTemplates(); return; }
    const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Die Bilddatei konnte nicht gelesen werden.")); reader.readAsDataURL(file); });
    const dimensions = await imageDimensions(dataUrl);
    template.elements.image = { visible: true, dataUrl, opacity: 1, sourceWidthPx: dimensions.width, sourceHeightPx: dimensions.height, fitMode: "cover", scale: 100, offsetXPercent: 50, offsetYPercent: 50, xMm: 2, yMm: 2, widthMm: Math.max(1, template.grid.labelWidthMm - 4), heightMm: Math.max(1, template.grid.labelHeightMm - 4) };
    template.updatedAt = now(); notice = `Bildfeld „${file.name}“ übernommen.`; renderTemplates();
  });
  app.querySelector<HTMLSelectElement>("#image-fit-mode")?.addEventListener("change", (event) => { if (template.elements.image) template.elements.image.fitMode = (event.target as HTMLSelectElement).value as LabelImageElement["fitMode"]; template.updatedAt = now(); renderTemplates(); });
  [["#image-scale", "scale"], ["#image-offset-x", "offsetXPercent"], ["#image-offset-y", "offsetYPercent"]].forEach(([selector, property]) => app.querySelector<HTMLInputElement>(selector)?.addEventListener("change", (event) => { if (template.elements.image) (template.elements.image as unknown as Record<string, number>)[property] = parseLayoutNumber((event.target as HTMLInputElement).value); template.updatedAt = now(); renderTemplates(); }));
}

function bindTextAppearanceFields(template: LabelTemplate): void {
  app.querySelectorAll<HTMLSelectElement>("[data-text-appearance]").forEach((input) => input.addEventListener("change", () => {
    const [kind, property] = input.dataset.textAppearance!.split(":") as [
      "text" | "tagIdText",
      "fontFamily" | "fontStyle" | "horizontalAlign" | "verticalAlign",
    ];
    const element = template.elements[kind];
    if (property === "fontFamily") element.fontFamily = input.value as typeof element.fontFamily;
    else if (property === "fontStyle") { element.fontStyle = input.value as typeof element.fontStyle; element.fontWeight = element.fontStyle.includes("bold") ? "bold" : "normal"; }
    else if (property === "horizontalAlign") element.horizontalAlign = input.value as typeof element.horizontalAlign;
    else element.verticalAlign = input.value as typeof element.verticalAlign;
    template.updatedAt = now();
    renderTemplates();
  }));
  app.querySelectorAll<HTMLInputElement>("[data-text-toggle]").forEach((input) => input.addEventListener("change", () => {
    const [kind, property] = input.dataset.textToggle!.split(":") as ["text" | "tagIdText", "visible" | "background"];
    if (property === "visible") template.elements[kind].visible = input.checked;
    else template.elements[kind].background.enabled = input.checked;
    template.updatedAt = now(); renderTemplates();
  }));
  app.querySelectorAll<HTMLInputElement>("[data-text-opacity]").forEach((input) => input.addEventListener("change", () => {
    template.elements[input.dataset.textOpacity as "text" | "tagIdText"].background.opacity = parseLayoutNumber(input.value) / 100;
    template.updatedAt = now(); renderTemplates();
  }));
}

function bindDrag(template: LabelTemplate, scale: number): void {
  const stage = app.querySelector<HTMLElement>("#label-stage");
  if (!stage) return;

  app.querySelectorAll<HTMLElement>("[data-element]").forEach((element) => element.addEventListener("pointerdown", (event) => {
    const kind = element.dataset.element as "qr" | "image" | "text" | "tagIdText";
    const target = kind === "image" ? template.elements.image : template.elements[kind];
    if (!target) return;
    dragState = { element: kind, startX: event.clientX, startY: event.clientY, originX: target.xMm, originY: target.yMm };
    element.setPointerCapture(event.pointerId);
  }));
  stage.addEventListener("pointermove", (event) => {
    if (!dragState) return;
    const target = dragState.element === "image" ? template.elements.image : template.elements[dragState.element];
    if (!target) return;
    const maxX = template.grid.labelWidthMm - target.widthMm;
    const maxY = template.grid.labelHeightMm - target.heightMm;
    target.xMm = Math.max(0, Math.min(maxX, Math.round((dragState.originX + (event.clientX - dragState.startX) / scale) * 10) / 10));
    target.yMm = Math.max(0, Math.min(maxY, Math.round((dragState.originY + (event.clientY - dragState.startY) / scale) * 10) / 10));
    renderTemplates();
  });
  stage.addEventListener("pointerup", () => { dragState = undefined; });
}
