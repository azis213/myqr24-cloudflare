import "./styles.css";

type Tool = "select" | "text" | "rect" | "ellipse" | "line" | "image" | "eyedropper" | "brush";
type FillType = "solid" | "linear" | "radial";
type Texture = "none" | "metal" | "electronics" | "wood" | "stone" | "paper" | "leather" | "carbon" | "grid";
type ObjectType = "text" | "rect" | "ellipse" | "line" | "image";
type FitMode = "label-fill" | "cover" | "contain" | "stretch" | "manual";
type PhysicalUnit = "mm" | "cm";
type NumberFormat = "de-DE" | "en-US";

interface BaseObject {
  id: string;
  type: ObjectType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  visible: boolean;
  locked: boolean;
}

interface GlowStyle {
  enabled: boolean;
  color: string;
  intensity: number;
  blur: number;
  spread: number;
  opacity: number;
  blendMode: "source-over" | "screen" | "overlay";
}

type ReliefMode = "none" | "raised" | "inset";

interface ReliefStyle {
  mode: ReliefMode;
  depth: number;
  angle: number;
  softness: number;
  strength: number;
  highlightColor: string;
  shadowColor: string;
}

const defaultRelief = (): ReliefStyle => ({
  mode: "none",
  depth: 8,
  angle: 315,
  softness: 3,
  strength: .7,
  highlightColor: "#ffffff",
  shadowColor: "#07111e",
});

interface TextObject extends BaseObject {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  align: CanvasTextAlign;
  shadow: boolean;
  glow: GlowStyle;
  relief: ReliefStyle;
}

interface ShapeObject extends BaseObject {
  type: "rect" | "ellipse";
}

interface LineObject extends BaseObject {
  type: "line";
  x2: number;
  y2: number;
}

interface ImageObject extends BaseObject {
  type: "image";
  dataUrl: string;
  fileName: string;
  mimeType: string;
  sourceWidth: number;
  sourceHeight: number;
  fitMode: FitMode;
  imageScale: number;
  imageOffsetX: number;
  imageOffsetY: number;
  cornerRadius: number;
}

type DesignObject = TextObject | ShapeObject | LineObject | ImageObject;

interface LabelFormat {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
}

interface LabelFormatConfig {
  default: {
    formatId: string;
    dpi: number;
    physicalUnit: PhysicalUnit;
    numberFormat: NumberFormat;
    cornerRadiusPx: number;
  };
  formats: LabelFormat[];
}

interface Design {
  schemaVersion: 5;
  kind: "myqr24.label-designer.document";
  name: string;
  width: number;
  height: number;
  widthCm: number;
  heightCm: number;
  physicalUnit: PhysicalUnit;
  numberFormat: NumberFormat;
  dpi: number;
  radius: number;
  backgroundFill: FillType;
  backgroundA: string;
  backgroundB: string;
  gradientAngle: number;
  texture: Texture;
  textureOpacity: number;
  borderVisible: boolean;
  borderWidth: number;
  borderA: string;
  borderB: string;
  borderTexture: Texture;
  borderRelief: ReliefStyle;
  objects: DesignObject[];
}

const app = document.querySelector<HTMLDivElement>("#app")!;
const importInput = document.querySelector<HTMLInputElement>("#import-input")!;
const imageInput = document.querySelector<HTMLInputElement>("#image-input")!;
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d")!;
const imageCache = new Map<string, HTMLImageElement>();
let scale = 0.38;
let activeTool: Tool = "select";
let selectedIds = new Set<string>();
type TextStyleClipboard = Pick<TextObject, "opacity" | "fill" | "stroke" | "strokeWidth" | "fontSize" | "fontFamily" | "fontWeight" | "align" | "shadow" | "glow" | "relief">;
let textStyleClipboard: TextStyleClipboard | undefined;
type ObjectDrag = { mode: "objects"; startX: number; startY: number; origins: Map<string, { x: number; y: number }>; moved: boolean; deselectOnClick: boolean };
type ImageContentDrag = { mode: "image-content"; startX: number; startY: number; imageId: string; offsetX: number; offsetY: number; moved: boolean; deselectOnClick: false };
let drag: ObjectDrag | ImageContentDrag | undefined;
let marquee: { startX: number; startY: number; x: number; y: number } | undefined;
let toastTimer: number | undefined;
let inlineTextEditor: HTMLTextAreaElement | undefined;
let inlineTextEditorId: string | undefined;
let inlineTextOriginal: string | undefined;
const INPUT_PREVIEW_DELAY = 400;
const DRAG_THRESHOLD = 4;
const FALLBACK_LABEL_FORMATS: LabelFormatConfig = {
  default: { formatId: "lost-found", dpi: 300, physicalUnit: "mm", numberFormat: "de-DE", cornerRadiusPx: 42 },
  formats: [{ id: "lost-found", name: "Lost & Found Standard", widthMm: 154.8, heightMm: 71.8 }],
};
let labelFormatConfig = FALLBACK_LABEL_FORMATS;
let selectedLabelFormatId = FALLBACK_LABEL_FORMATS.default.formatId;

const uid = (): string => crypto.randomUUID?.() ?? `object-${Date.now()}-${Math.random()}`;
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const toNumber = (value: string, fallback: number): number => {
  const cleaned = value.trim().replace(/\s/g, "");
  if (!cleaned) return fallback;
  const decimalSeparator = cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".") ? "," : ".";
  const normalized = decimalSeparator === "," ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const centimetersToPixels = (centimeters: number, dpi: number): number => Math.round(centimeters / 2.54 * dpi);
const pixelsToCentimeters = (pixels: number, dpi: number): number => pixels / dpi * 2.54;
const roundTo = (value: number, digits: number): number => {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};
const roundPixels = (pixels: number): number => Math.round(pixels);
const roundTenths = (value: number): number => roundTo(value, 1);
const roundCentimeters = (centimeters: number): number => roundTo(centimeters, 2);
const physicalUnitLabel = (unit: PhysicalUnit): string => unit === "mm" ? "mm" : "cm";
const physicalValue = (centimeters: number): number => design.physicalUnit === "mm" ? centimeters * 10 : centimeters;
const physicalCentimeters = (value: number): number => design.physicalUnit === "mm" ? value / 10 : value;
const displayNumber = (value: number, maximumFractionDigits = 2): string => value.toLocaleString(design.numberFormat, { useGrouping: false, maximumFractionDigits });
const displayCentimeters = (centimeters: number): string => `${displayNumber(physicalValue(centimeters))} ${physicalUnitLabel(design.physicalUnit)}`;
const averageScale = (scaleX: number, scaleY: number): number => Math.sqrt(scaleX * scaleY);
const getObject = (id: string): DesignObject | undefined => design.objects.find((item) => item.id === id);
const selectedObjects = (): DesignObject[] => design.objects.filter((item) => selectedIds.has(item.id));
const selectedOne = (): DesignObject | undefined => selectedIds.size === 1 ? getObject([...selectedIds][0]) : undefined;
const isText = (item: DesignObject | undefined): item is TextObject => item?.type === "text";

let design: Design = {
  schemaVersion: 5,
  kind: "myqr24.label-designer.document",
  name: "Mein Lost-&-Found Label",
  width: 1828,
  height: 848,
  widthCm: roundCentimeters(pixelsToCentimeters(1828, 300)),
  heightCm: roundCentimeters(pixelsToCentimeters(848, 300)),
  physicalUnit: "mm",
  numberFormat: "de-DE",
  dpi: 300,
  radius: 42,
  backgroundFill: "linear",
  backgroundA: "#0c2942",
  backgroundB: "#20b6c7",
  gradientAngle: 25,
  texture: "electronics",
  textureOpacity: .34,
  borderVisible: true,
  borderWidth: 23,
  borderA: "#71f6e0",
  borderB: "#236aa8",
  borderTexture: "metal",
  borderRelief: defaultRelief(),
  objects: [
    textObject("Titel", 640, 180, 970, 155, "VERLOREN?", 112, "#f7fbff", false),
    textObject("Untertitel", 640, 340, 970, 150, "GEFUNDEN!", 108, "#8ffbec", true),
    textObject("Footer", 880, 670, 690, 54, "powered by myqr24.com", 31, "#effcfb", false, "right"),
  ],
};

function textObject(name: string, x: number, y: number, width: number, height: number, text: string, fontSize: number, fill: string, glowEnabled: boolean, align: CanvasTextAlign = "center"): TextObject {
  return {
    id: uid(), type: "text", name, x, y, width, height, rotation: 0, opacity: 1, fill, stroke: "#102136", strokeWidth: fontSize > 50 ? 4 : 0,
    visible: true, locked: false, text, fontSize, fontFamily: fontSize > 50 ? "Arial Black, Impact, sans-serif" : "Arial, sans-serif",
    fontWeight: fontSize > 50 ? "900" : "600", align, shadow: fontSize > 50,
    glow: { enabled: glowEnabled, color: fill, intensity: 100, blur: 22, spread: 3, opacity: 1, blendMode: "screen" },
    relief: defaultRelief(),
  };
}

function html(): void {
  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand"><span class="brand-mark">L</span><div><strong>myQR24 Label-Designer</strong><small>Lokale Gestaltung · PNG-Export</small></div></div>
        <div class="toolbar-actions">
          <button class="button" id="new-design">Neu</button><button class="button" id="save-design">JSON speichern</button><button class="button" id="load-design">JSON laden</button><button class="button" id="import-image">Bild einfügen</button><button class="button primary" id="export-png">PNG exportieren</button><button class="button" id="export-png-save-as">PNG speichern unter</button>
        </div>
        <div class="top-actions"><button class="button icon" id="zoom-out">−</button><button class="button" id="zoom-label">38 %</button><button class="button icon" id="zoom-in">+</button></div>
      </header>
      <div class="workspace">
        <aside class="toolrail">
          ${toolButton("select", "↖", "Auswahl")}${toolButton("text", "T", "Text")}${toolButton("rect", "▭", "Rechteck")}${toolButton("ellipse", "◯", "Ellipse")}${toolButton("line", "╱", "Linie")}${toolButton("image", "▧", "Bild")}${toolButton("eyedropper", "◉", "Pipette")}${toolButton("brush", "♨", "Stilpinsel")}
        </aside>
        <main class="stage-area"><div class="stage-wrap"></div></main>
        <aside class="properties" id="properties"></aside>
      </div>
      <footer class="statusbar"><span id="status-size"></span><span id="status-selection">Keine Auswahl</span></footer>
    </div><div id="toast" class="toast hidden"></div>`;
  app.querySelector<HTMLDivElement>(".stage-wrap")!.append(canvas);
  canvas.id = "design-canvas";
  bindShell();
  update();
}

function toolButton(tool: Tool, icon: string, name: string): string {
  return `<button class="tool-button ${activeTool === tool ? "is-active" : ""}" data-tool="${tool}" title="${name}"><span>${icon}</span>${name}</button>`;
}

function bindShell(): void {
  app.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach((button) => button.addEventListener("click", () => setTool(button.dataset.tool as Tool)));
  app.querySelector("#new-design")?.addEventListener("click", resetDesign);
  app.querySelector("#save-design")?.addEventListener("click", exportJson);
  app.querySelector("#load-design")?.addEventListener("click", () => importInput.click());
  app.querySelector("#import-image")?.addEventListener("click", () => imageInput.click());
  app.querySelector("#export-png")?.addEventListener("click", exportPng);
  app.querySelector("#export-png-save-as")?.addEventListener("click", () => void exportPngSaveAs());
  app.querySelector("#zoom-in")?.addEventListener("click", () => changeZoom(.05));
  app.querySelector("#zoom-out")?.addEventListener("click", () => changeZoom(-.05));
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointerleave", pointerUp);
  canvas.addEventListener("dblclick", pointerDoubleClick);
  importInput.addEventListener("change", importJson);
  imageInput.addEventListener("change", importImages);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (inlineTextEditor) cancelInlineTextEdit();
      else { selectedIds.clear(); marquee = undefined; setTool("select"); update(); }
    }
    const selected = selectedOne();
    if (event.key === "Enter" && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) && isText(selected)) {
      event.preventDefault();
      beginInlineTextEdit(selected);
    }
    if ((event.key === "Delete" || event.key === "Backspace") && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) deleteSelection();
  });
}

function setTool(tool: Tool): void {
  activeTool = tool;
  canvas.style.cursor = tool === "select" ? "default" : tool === "brush" || tool === "eyedropper" ? "copy" : "crosshair";
  app.querySelectorAll("[data-tool]").forEach((button) => button.classList.toggle("is-active", (button as HTMLElement).dataset.tool === tool));
  const messages: Partial<Record<Tool, string>> = {
    image: "Bildwerkzeug aktiv: Eine oder mehrere Bilddateien auswählen.",
    eyedropper: "Stil-Pipette aktiv: Klicke ein Textobjekt an.",
    brush: textStyleClipboard ? "Stilpinsel aktiv: Klicke ein Ziel-Textobjekt an." : "Zuerst mit der Pipette einen Textstil aufnehmen.",
  };
  if (tool === "image") imageInput.click();
  else if (messages[tool]) showToast(messages[tool]!);
}

function changeZoom(delta: number): void {
  scale = clamp(scale + delta, .15, 3);
  app.querySelector("#zoom-label")!.textContent = `${Math.round(scale * 100)} %`;
  update();
}

function renderPreview(): void {
  canvas.width = design.width;
  canvas.height = design.height;
  canvas.style.width = `${Math.round(design.width * scale)}px`;
  canvas.style.height = `${Math.round(design.height * scale)}px`;
  renderCanvas(ctx, design, true);
  app.querySelector("#status-size")!.textContent = `${displayCentimeters(design.widthCm)} × ${displayCentimeters(design.heightCm)} · ${design.width} × ${design.height} px · ${displayNumber(design.dpi, 0)} DPI`;
  app.querySelector("#status-selection")!.textContent = selectedIds.size ? `${selectedIds.size} Objekt${selectedIds.size === 1 ? "" : "e"} ausgewählt` : "Keine Auswahl";
}

function normalizeDesignPrecision(): void {
  design.widthCm = roundCentimeters(design.widthCm);
  design.heightCm = roundCentimeters(design.heightCm);
  design.radius = roundTenths(design.radius);
  design.gradientAngle = roundTenths(design.gradientAngle);
  design.borderWidth = roundTenths(design.borderWidth);
  normalizeRelief(design.borderRelief);
  design.objects.forEach((item) => {
    item.x = roundPixels(item.x);
    item.y = roundPixels(item.y);
    item.width = roundPixels(item.width);
    item.height = roundPixels(item.height);
    item.rotation = roundTenths(item.rotation);
    item.strokeWidth = roundTenths(item.strokeWidth);
    if (item.type === "line") {
      item.x2 = roundPixels(item.x2);
      item.y2 = roundPixels(item.y2);
    }
    if (item.type === "text") {
      item.fontSize = roundTenths(item.fontSize);
      item.glow.blur = roundTenths(item.glow.blur);
      item.glow.spread = roundTenths(item.glow.spread);
      normalizeRelief(item.relief);
    }
    if (item.type === "image") {
      item.cornerRadius = roundTenths(item.cornerRadius);
      item.imageScale = roundTenths(Math.max(1, item.imageScale));
      clampImageOffset(item);
      item.imageOffsetX = roundTenths(item.imageOffsetX);
      item.imageOffsetY = roundTenths(item.imageOffsetY);
    }
  });
}

function normalizeRelief(relief: ReliefStyle): void {
  relief.depth = roundTenths(clamp(relief.depth, 0, 100));
  relief.angle = roundTenths(((relief.angle % 360) + 360) % 360);
  relief.softness = roundTenths(clamp(relief.softness, 0, 50));
  relief.strength = roundTenths(clamp(relief.strength, 0, 1));
}

function update(): void {
  normalizeDesignPrecision();
  const properties = app.querySelector<HTMLDivElement>("#properties")!;
  const scrollTop = properties.scrollTop;
  renderPreview();
  renderProperties();
  properties.scrollTop = scrollTop;
}

function roundedPath(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  const r = clamp(radius, 0, Math.min(width, height) / 2);
  context.beginPath();
  context.moveTo(x + r, y); context.lineTo(x + width - r, y); context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r); context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height); context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r); context.quadraticCurveTo(x, y, x + r, y); context.closePath();
}

function renderCanvas(context: CanvasRenderingContext2D, value: Design, editor: boolean): void {
  context.clearRect(0, 0, value.width, value.height);
  context.save();
  roundedPath(context, 0, 0, value.width, value.height, value.radius);
  context.clip();
  context.fillStyle = fillStyle(context, value.backgroundFill, value.backgroundA, value.backgroundB, value.gradientAngle, value.width, value.height);
  context.fillRect(0, 0, value.width, value.height);
  drawTexture(context, value.texture, value.width, value.height, value.textureOpacity);
  value.objects.filter((item) => item.visible).forEach((item) => drawObject(context, item, editor && selectedIds.has(item.id)));
  context.restore();
  if (value.borderVisible && value.borderWidth > 0) drawBorder(context, value);
  if (editor && marquee) drawMarquee(context, marquee);
}

function fillStyle(context: CanvasRenderingContext2D, type: FillType, a: string, b: string, angle: number, width: number, height: number): string | CanvasGradient {
  if (type === "solid") return a;
  if (type === "radial") {
    const gradient = context.createRadialGradient(width / 2, height / 2, 2, width / 2, height / 2, Math.max(width, height) * .7);
    gradient.addColorStop(0, a); gradient.addColorStop(1, b); return gradient;
  }
  const radians = angle * Math.PI / 180, x = Math.cos(radians) * width, y = Math.sin(radians) * height;
  const gradient = context.createLinearGradient(width / 2 - x / 2, height / 2 - y / 2, width / 2 + x / 2, height / 2 + y / 2);
  gradient.addColorStop(0, a); gradient.addColorStop(1, b); return gradient;
}

function drawTexture(context: CanvasRenderingContext2D, texture: Texture, width: number, height: number, opacity: number): void {
  if (texture === "none" || opacity <= 0) return;
  context.save(); context.globalAlpha = opacity; context.globalCompositeOperation = "overlay";
  const random = seeded(texture);
  if (texture === "metal") for (let y = 0; y < height; y += 5) { const shade = 125 + Math.floor(random() * 110); context.fillStyle = `rgb(${shade},${shade},${shade})`; context.fillRect(0, y, width, 2); }
  else if (texture === "electronics") {
    context.strokeStyle = "#91f6ff"; context.lineWidth = 4;
    for (let i = 0; i < 60; i++) { const x = random() * width, y = random() * height, mx = x + 45 + random() * 180; context.beginPath(); context.moveTo(x, y); context.lineTo(mx, y); context.lineTo(mx, y + 35 + random() * 125); context.stroke(); context.fillStyle = "#e0ffff"; context.beginPath(); context.arc(x, y, 5, 0, Math.PI * 2); context.fill(); }
  } else if (texture === "wood") {
    context.strokeStyle = "#6a351f"; context.lineWidth = 10;
    for (let y = 25; y < height; y += 48) { context.beginPath(); for (let x = 0; x < width; x += 35) context.lineTo(x, y + Math.sin(x / 70 + y) * 13); context.stroke(); }
  } else if (texture === "stone") for (let i = 0; i < 850; i++) { context.fillStyle = random() > .5 ? "#e9eef4" : "#263341"; context.beginPath(); context.arc(random() * width, random() * height, 1 + random() * 5, 0, Math.PI * 2); context.fill(); }
  else if (texture === "paper") for (let i = 0; i < 3400; i++) { context.fillStyle = random() > .5 ? "#fff5d5" : "#593417"; context.fillRect(random() * width, random() * height, 1 + random() * 3, 1 + random() * 3); }
  else if (texture === "leather") { context.fillStyle = "#4e2115"; for (let i = 0; i < 1300; i++) { context.beginPath(); context.arc(random() * width, random() * height, 1 + random() * 5, 0, Math.PI * 2); context.fill(); } }
  else if (texture === "carbon") { const size = 25; for (let y = -size; y < height + size; y += size) for (let x = -size; x < width + size; x += size) { context.fillStyle = ((x / size + y / size) % 2 === 0) ? "#050505" : "#6a7481"; context.fillRect(x, y, size, size); } }
  else if (texture === "grid") { context.strokeStyle = "#d1e5fc"; context.lineWidth = 2; for (let x = 0; x < width; x += 42) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); } for (let y = 0; y < height; y += 42) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); } }
  context.restore();
}

function seeded(seed: string): () => number {
  let state = [...seed].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 2166136261);
  return () => { state += 0x6D2B79F5; let number = state; number = Math.imul(number ^ number >>> 15, number | 1); number ^= number + Math.imul(number ^ number >>> 7, number | 61); return ((number ^ number >>> 14) >>> 0) / 4294967296; };
}

function drawObject(context: CanvasRenderingContext2D, item: DesignObject, showSelection: boolean): void {
  context.save();
  context.globalAlpha = item.opacity;
  context.translate(item.x + item.width / 2, item.y + item.height / 2);
  context.rotate(item.rotation * Math.PI / 180);
  context.translate(-item.width / 2, -item.height / 2);
  if (item.type === "text") drawText(context, item);
  else if (item.type === "image") drawImageObject(context, item);
  else if (item.type === "line") { context.strokeStyle = item.stroke; context.lineWidth = item.strokeWidth; context.lineCap = "round"; context.beginPath(); context.moveTo(0, 0); context.lineTo(item.x2 - item.x, item.y2 - item.y); context.stroke(); }
  else {
    context.fillStyle = item.fill; context.strokeStyle = item.stroke; context.lineWidth = item.strokeWidth; context.beginPath();
    if (item.type === "rect") context.roundRect(0, 0, item.width, item.height, Math.min(25, item.height / 4));
    else context.ellipse(item.width / 2, item.height / 2, item.width / 2, item.height / 2, 0, 0, Math.PI * 2);
    context.fill(); if (item.strokeWidth) context.stroke();
  }
  if (showSelection) { context.setLineDash([11, 8]); context.lineWidth = 3; context.strokeStyle = "#fbbf24"; context.strokeRect(-6, -6, item.width + 12, item.height + 12); context.setLineDash([]); context.fillStyle = "#fbbf24"; context.fillRect(item.width - 8, item.height - 8, 16, 16); }
  context.restore();
}

function reliefOffset(relief: ReliefStyle): { x: number; y: number } {
  const radians = relief.angle * Math.PI / 180;
  return { x: Math.cos(radians) * relief.depth, y: Math.sin(radians) * relief.depth };
}

function drawBorder(context: CanvasRenderingContext2D, value: Design): void {
  const x = value.borderWidth / 2, y = value.borderWidth / 2;
  const width = value.width - value.borderWidth, height = value.height - value.borderWidth;
  const radius = Math.max(0, value.radius - value.borderWidth / 2);
  const relief = value.borderRelief;
  const maxDepth = Math.max(0, value.borderWidth / 2 - 1);
  const depth = Math.min(relief.depth, maxDepth);
  if (relief.mode !== "none" && depth > 0) {
    const offset = reliefOffset({ ...relief, depth });
    const direction = relief.mode === "raised" ? 1 : -1;
    context.save();
    context.lineCap = "round"; context.lineJoin = "round";
    context.globalAlpha = relief.strength;
    context.shadowBlur = relief.softness;
    context.lineWidth = Math.max(1, value.borderWidth - depth);
    context.strokeStyle = relief.shadowColor;
    context.shadowColor = relief.shadowColor;
    context.shadowOffsetX = -offset.x * direction; context.shadowOffsetY = -offset.y * direction;
    roundedPath(context, x, y, width, height, radius); context.stroke();
    context.shadowColor = relief.highlightColor;
    context.shadowOffsetX = offset.x * direction; context.shadowOffsetY = offset.y * direction;
    context.strokeStyle = relief.highlightColor;
    roundedPath(context, x, y, width, height, radius); context.stroke();
    context.restore();
  }
  context.save();
  roundedPath(context, x, y, width, height, radius);
  context.lineWidth = value.borderWidth;
  context.strokeStyle = fillStyle(context, "linear", value.borderA, value.borderB, 125, value.width, value.height);
  context.stroke();
  context.restore();
}

function drawText(context: CanvasRenderingContext2D, item: TextObject): void {
  context.font = `${item.fontWeight} ${item.fontSize}px ${item.fontFamily}`;
  context.textAlign = item.align; context.textBaseline = "middle"; context.lineJoin = "round";
  const x = item.align === "left" ? 0 : item.align === "right" ? item.width : item.width / 2;
  if (item.glow.enabled) {
    const passes = Math.max(1, Math.ceil(item.glow.intensity / 50));
    context.save(); context.globalCompositeOperation = item.glow.blendMode;
    for (let pass = passes; pass > 0; pass--) {
      const factor = pass / passes;
      context.globalAlpha = item.opacity * item.glow.opacity * (.25 + .25 * factor);
      context.shadowColor = item.glow.color; context.shadowBlur = item.glow.blur * (1 + factor) + item.glow.spread; context.shadowOffsetX = 0; context.shadowOffsetY = 0;
      context.fillStyle = item.glow.color; context.fillText(item.text, x, item.height / 2, item.width);
    }
    context.restore();
  }
  if (item.relief.mode !== "none" && item.relief.depth > 0) {
    const offset = reliefOffset(item.relief);
    const direction = item.relief.mode === "raised" ? 1 : -1;
    const reliefStroke = Math.max(1, item.strokeWidth * 2 + Math.min(item.relief.depth, item.fontSize / 5));
    context.save();
    context.globalAlpha = item.opacity * item.relief.strength;
    context.lineWidth = reliefStroke;
    context.shadowBlur = item.relief.softness;
    context.shadowColor = item.relief.shadowColor;
    context.shadowOffsetX = -offset.x * direction; context.shadowOffsetY = -offset.y * direction;
    context.strokeStyle = item.relief.shadowColor;
    context.strokeText(item.text, x, item.height / 2, item.width);
    context.shadowColor = item.relief.highlightColor;
    context.shadowOffsetX = offset.x * direction; context.shadowOffsetY = offset.y * direction;
    context.strokeStyle = item.relief.highlightColor;
    context.strokeText(item.text, x, item.height / 2, item.width);
    context.restore();
  }
  if (item.shadow) { context.shadowColor = "#07111e"; context.shadowBlur = 8; context.shadowOffsetX = 7; context.shadowOffsetY = 8; }
  if (item.strokeWidth && item.stroke !== "transparent") { context.lineWidth = item.strokeWidth * 2; context.strokeStyle = item.stroke; context.strokeText(item.text, x, item.height / 2, item.width); }
  context.fillStyle = item.fill; context.fillText(item.text, x, item.height / 2, item.width);
}

function imageFor(dataUrl: string): HTMLImageElement {
  const cached = imageCache.get(dataUrl);
  if (cached) return cached;
  const image = new Image();
  image.onload = () => update();
  image.src = dataUrl;
  imageCache.set(dataUrl, image);
  return image;
}

function drawImageObject(context: CanvasRenderingContext2D, item: ImageObject): void {
  const image = imageFor(item.dataUrl);
  if (!image.complete || !image.naturalWidth) return;
  context.save();
  roundedPath(context, 0, 0, item.width, item.height, item.cornerRadius);
  context.clip();
  const dimensions = imageDimensions(item, image.naturalWidth, image.naturalHeight);
  context.drawImage(image, dimensions.x, dimensions.y, dimensions.width, dimensions.height);
  context.restore();
  if (item.strokeWidth) { context.strokeStyle = item.stroke; context.lineWidth = item.strokeWidth; roundedPath(context, 0, 0, item.width, item.height, item.cornerRadius); context.stroke(); }
}

function imageDimensions(item: ImageObject, naturalWidth: number, naturalHeight: number): { x: number; y: number; width: number; height: number } {
  if (item.fitMode === "stretch" || item.fitMode === "label-fill") return { x: 0, y: 0, width: item.width, height: item.height };
  const contain = item.fitMode === "contain";
  const base = contain ? Math.min(item.width / naturalWidth, item.height / naturalHeight) : Math.max(item.width / naturalWidth, item.height / naturalHeight);
  // Der manuelle Modus beginnt bei Cover. Damit bleiben beim Verschieben nie leere Flächen zurück.
  const factor = base * (item.fitMode === "manual" ? Math.max(1, item.imageScale) : 1);
  const width = naturalWidth * factor, height = naturalHeight * factor;
  return { x: (item.width - width) / 2 + item.imageOffsetX, y: (item.height - height) / 2 + item.imageOffsetY, width, height };
}

function clampImageOffset(item: ImageObject): void {
  if (item.fitMode === "stretch" || item.fitMode === "label-fill" || !item.sourceWidth || !item.sourceHeight) {
    item.imageOffsetX = 0;
    item.imageOffsetY = 0;
    return;
  }
  const dimensions = imageDimensions(item, item.sourceWidth, item.sourceHeight);
  const maxX = Math.max(0, (dimensions.width - item.width) / 2);
  const maxY = Math.max(0, (dimensions.height - item.height) / 2);
  item.imageOffsetX = clamp(item.imageOffsetX, -maxX, maxX);
  item.imageOffsetY = clamp(item.imageOffsetY, -maxY, maxY);
}

function drawMarquee(context: CanvasRenderingContext2D, value: NonNullable<typeof marquee>): void {
  const x = Math.min(value.startX, value.x), y = Math.min(value.startY, value.y), width = Math.abs(value.x - value.startX), height = Math.abs(value.y - value.startY);
  context.save(); context.fillStyle = "#60a5fa22"; context.strokeStyle = "#93c5fd"; context.lineWidth = 3; context.setLineDash([10, 7]); context.fillRect(x, y, width, height); context.strokeRect(x, y, width, height); context.restore();
}

function renderProperties(): void {
  const panel = app.querySelector<HTMLDivElement>("#properties")!;
  const item = selectedOne();
  const multi = selectedIds.size > 1;
  panel.innerHTML = `
    <section class="panel"><h2>Label</h2><p class="hint">Druckformat: ${displayCentimeters(design.widthCm)} × ${displayCentimeters(design.heightCm)} · ${design.width} × ${design.height} px bei ${displayNumber(design.dpi, 0)} DPI</p><div class="field-grid">
      ${field("Name", "design-name", design.name, "text")}${selectField("Label-Format", "label-format", selectedLabelFormatId, [["custom", "Benutzerdefiniert"], ...labelFormatConfig.formats.map((format) => [format.id, `${format.name}: ${format.widthMm} × ${format.heightMm} mm`] as [string, string])], true)}
      ${selectField("Maßeinheit", "physical-unit", design.physicalUnit, [["mm", "Millimeter (mm)"], ["cm", "Zentimeter (cm)"]])}${selectField("Zahlenformat", "number-format", design.numberFormat, [["de-DE", "Deutsch: 1.234,56"], ["en-US", "International: 1,234.56"]])}${field("DPI", "design-dpi", design.dpi, "number", "72", "1200", "1", 0)}
      ${field(`Breite ${physicalUnitLabel(design.physicalUnit)}`, "design-width-physical", physicalValue(design.widthCm), "number", design.physicalUnit === "mm" ? "1" : ".1", design.physicalUnit === "mm" ? "1000" : "100", design.physicalUnit === "mm" ? ".1" : ".01", design.physicalUnit === "mm" ? 1 : 2)}${field(`Höhe ${physicalUnitLabel(design.physicalUnit)}`, "design-height-physical", physicalValue(design.heightCm), "number", design.physicalUnit === "mm" ? "1" : ".1", design.physicalUnit === "mm" ? "1000" : "100", design.physicalUnit === "mm" ? ".1" : ".01", design.physicalUnit === "mm" ? 1 : 2)}
      ${field("Breite px", "design-width", design.width, "number", "160", "5000", "1", 0)}${field("Höhe px", "design-height", design.height, "number", "100", "5000", "1", 0)}
      ${field("Eckenradius px", "design-radius", design.radius, "number")}${selectField("Hintergrund", "background-fill", design.backgroundFill, [["solid", "Vollton"], ["linear", "Linearer Verlauf"], ["radial", "Radialer Verlauf"]])}
      ${colorField("Farbe A", "background-a", design.backgroundA)}${colorField("Farbe B", "background-b", design.backgroundB)}
      ${field("Verlaufswinkel °", "gradient-angle", design.gradientAngle, "number")}${selectField("Textur", "background-texture", design.texture, textures())}
      ${field("Textur-Deckkraft", "texture-opacity", design.textureOpacity, "range", "0", "1", ".05")}
    </div><div class="gradient-bar" id="gradient-preview"></div><div class="divider"></div><h3>Rand (folgt dem Eckenradius)</h3>
    <label class="checkbox"><input id="border-visible" type="checkbox" ${design.borderVisible ? "checked" : ""}> Rand anzeigen</label>
    <div class="field-grid">${field("Dicke px", "border-width", design.borderWidth, "number")}${selectField("Randtextur", "border-texture", design.borderTexture, textures())}${colorField("Randfarbe A", "border-a", design.borderA)}${colorField("Randfarbe B", "border-b", design.borderB)}</div>
    <div class="divider"></div><h3>3D-Relief Rand</h3>${reliefFields("border-relief", design.borderRelief)}</section>
    ${item ? objectProperties(item) : multi ? multiProperties() : `<section class="panel"><h2>Werkzeuge</h2><p class="hint">Bilder: über „Bild einfügen“ oder das Bildwerkzeug. Shift-Klick und Auswahlrahmen wählen mehrere Objekte. Mit Pipette und Stilpinsel werden Textstile übertragen.</p><div class="divider"></div><h3>Stil-Presets</h3><div class="preset-grid">${presetButtons()}</div></section>`}
    <section class="panel"><h2>Ebenen</h2>${[...design.objects].reverse().map(objectRow).join("") || `<p class="hint">Noch keine Objekte.</p>`}</section>`;
  bindProperties();
}

function objectProperties(item: DesignObject): string {
  const shared = `<div class="field-grid">
    ${field("Name", "object-name", item.name, "text")}${field("Drehung °", "object-rotation", item.rotation, "number")}
    ${field("X px", "object-x", item.x, "number", "", "", "1", 0)}${field("Y px", "object-y", item.y, "number", "", "", "1", 0)}
    ${field("Breite px", "object-width", item.width, "number", "1", "", "1", 0)}${field("Höhe px", "object-height", item.height, "number", "1", "", "1", 0)}
    ${field("Deckkraft", "object-opacity", item.opacity, "range", "0", "1", ".05")}${colorField("Füllfarbe", "object-fill", item.fill)}
    ${colorField("Konturfarbe", "object-stroke", item.stroke)}${field("Kontur px", "object-stroke-width", item.strokeWidth, "number")}
  </div><label class="checkbox"><input id="object-visible" type="checkbox" ${item.visible ? "checked" : ""}> Sichtbar</label><label class="checkbox"><input id="object-locked" type="checkbox" ${item.locked ? "checked" : ""}> Gesperrt</label>`;
  const text = item.type === "text" ? `<p class="hint">Text direkt auf dem Label bearbeiten: Textobjekt doppelklicken oder auswählen und <strong>Enter</strong> drücken. <strong>Esc</strong> verwirft, <strong>Strg/Cmd + Enter</strong> übernimmt.</p><div class="divider"></div><h3>Text & Effekte</h3><div class="field-grid">
    ${textareaField("Textinhalt", "text-content", item.text)}${field("Schriftgröße px", "text-size", item.fontSize, "number")}
    ${selectField("Schrift", "text-font", item.fontFamily, fonts())}${selectField("Ausrichtung", "text-align", item.align, [["left", "Links"], ["center", "Zentriert"], ["right", "Rechts"]])}
    ${colorField("Glow-Farbe", "glow-color", item.glow.color)}${field("Glow-Intensität %", "glow-intensity", item.glow.intensity, "range", "0", "200", "5")}
    ${field("Glow-Unschärfe px", "glow-blur", item.glow.blur, "range", "0", "100", "1")}${field("Glow-Ausbreitung px", "glow-spread", item.glow.spread, "range", "0", "100", "1")}
    ${field("Glow-Deckkraft", "glow-opacity", item.glow.opacity, "range", "0", "1", ".05")}${selectField("Glow-Blend-Modus", "glow-blend", item.glow.blendMode, [["source-over", "Normal"], ["screen", "Screen"], ["overlay", "Überlagern"]])}
  </div><label class="checkbox"><input id="text-shadow" type="checkbox" ${item.shadow ? "checked" : ""}> Schlagschatten</label><label class="checkbox"><input id="text-glow" type="checkbox" ${item.glow.enabled ? "checked" : ""}> Neon / Glow aktiv</label><div class="divider"></div><h3>3D-Relief Text</h3>${reliefFields("text-relief", item.relief)}` : "";
  const image = item.type === "image" ? `<div class="divider"></div><h3>Bild</h3><div class="field-grid">
    ${selectField("Fit-Modus", "image-fit", item.fitMode, [["label-fill", "Label ausfüllen"], ["cover", "Ausfüllen (Cover)"], ["contain", "Einpassen"], ["stretch", "Strecken"], ["manual", "Manuell"]])}
    ${field("Eckenradius px", "image-radius", item.cornerRadius, "number")}
    ${field("Bild-Skalierung %", "image-scale", item.imageScale * 100, "number", "100")}
    ${field("Bildversatz X px", "image-offset-x", item.imageOffsetX, "number")}
    ${field("Bildversatz Y px", "image-offset-y", item.imageOffsetY, "number")}
  </div><p class="hint">Der Bildrand wird am Bildobjekt zugeschnitten. Bild skalieren und anschließend bei ausgewähltem Bild mit <strong>Shift + Drag</strong> den sichtbaren Ausschnitt verschieben. Ohne Shift wird das Bildobjekt bewegt.</p><p class="hint">${escape(item.fileName)} · ${item.sourceWidth} × ${item.sourceHeight}px</p>` : "";
  return `<section class="panel"><h2>${item.type === "text" ? "Textstil" : item.type === "image" ? "Bildobjekt" : "Objektstil"}</h2>${text}${image}<div class="divider"></div>${shared}<div class="divider"></div>${layerButtons()} <button class="button" id="duplicate-object">Duplizieren</button> <button class="button" id="delete-object">Löschen</button></section>`;
}

function multiProperties(): string {
  return `<section class="panel"><h2>${selectedIds.size} Objekte ausgewählt</h2><p class="hint">Gemeinsame Aktionen ändern Positionen nicht relativ zueinander.</p><label class="checkbox"><input id="multi-visible" type="checkbox" ${selectedObjects().every((item) => item.visible) ? "checked" : ""}> Alle sichtbar</label><div class="divider"></div>${layerButtons()} <button class="button" id="delete-object">Auswahl löschen</button></section>`;
}

function layerButtons(): string {
  return `<button class="button" data-layer="back">⇤ Ganz hinten</button> <button class="button" data-layer="down">← Hinten</button> <button class="button" data-layer="up">Vorne →</button> <button class="button" data-layer="front">Ganz vorne ⇥</button>`;
}

function reliefFields(id: string, relief: ReliefStyle): string {
  return `<div class="field-grid">
    ${selectField("Effekt", `${id}-mode`, relief.mode, [["none", "Aus"], ["raised", "Erhaben"], ["inset", "Vertieft"]])}${field("Tiefe px", `${id}-depth`, relief.depth, "number", "0", "100", ".1")}
    ${field("Lichtrichtung °", `${id}-angle`, relief.angle, "number", "0", "359.9", ".1")}${field("Weichheit px", `${id}-softness`, relief.softness, "number", "0", "50", ".1")}
    ${field("Stärke", `${id}-strength`, relief.strength, "range", "0", "1", ".05")}${colorField("Lichtfarbe", `${id}-highlight`, relief.highlightColor)}
    ${colorField("Schattenfarbe", `${id}-shadow`, relief.shadowColor)}
  </div>`;
}

function field(label: string, id: string, value: string | number, type: string, min = "", max = "", step = "", precision = 1): string {
  const numeric = type === "number";
  const displayValue = numeric && typeof value === "number" ? String(roundTo(value, precision)) : String(value);
  return `<label class="field">${label}<input id="${id}" type="${type}" value="${escape(displayValue)}" ${numeric ? `inputmode="decimal" data-number-input="true"` : ""} ${min ? `min="${min}"` : ""} ${max ? `max="${max}"` : ""} ${step ? `step="${step}"` : ""}></label>`;
}
function colorField(label: string, id: string, value: string): string { return `<label class="field">${label}<input id="${id}" type="color" value="${value.startsWith("#") ? value : "#000000"}"></label>`; }
function selectField(label: string, id: string, value: string, values: [string, string][], wide = false): string { return `<label class="field${wide ? " wide" : ""}">${label}<select id="${id}">${values.map(([key, name]) => `<option value="${key}" ${key === value ? "selected" : ""}>${name}</option>`).join("")}</select></label>`; }
function textareaField(label: string, id: string, value: string): string { return `<label class="field wide">${label}<textarea id="${id}">${escape(value)}</textarea></label>`; }
function textures(): [string, string][] { return [["none", "Keine"], ["metal", "Metall"], ["electronics", "Elektronik"], ["wood", "Holz"], ["stone", "Stein"], ["paper", "Papier"], ["leather", "Leder"], ["carbon", "Carbon"], ["grid", "Raster"]]; }
function fonts(): [string, string][] { return [["Arial, sans-serif", "Sans"], ["Georgia, serif", "Serif"], ["Consolas, monospace", "Mono"], ["Arial Black, Impact, sans-serif", "Display"], ["Comic Sans MS, cursive", "Comic"]]; }
function escape(value: string): string {
  return value
    .replaceAll("&", String.fromCharCode(38) + "amp;")
    .replaceAll("<", String.fromCharCode(38) + "lt;")
    .replaceAll(">", String.fromCharCode(38) + "gt;")
    .replaceAll('"', String.fromCharCode(38) + "quot;");
}
function objectRow(item: DesignObject): string {
  const icon = item.type === "text" ? "T" : item.type === "line" ? "╱" : item.type === "ellipse" ? "◯" : item.type === "image" ? "▧" : "▭";
  return `<div class="object-row ${selectedIds.has(item.id) ? "is-selected" : ""}" data-object-id="${item.id}"><span class="object-icon">${icon}</span>${escape(item.name)}<button data-toggle-visible="${item.id}" title="${item.visible ? "Ausblenden" : "Einblenden"}">${item.visible ? "◉" : "○"}</button><button data-delete-layer="${item.id}" title="Löschen">×</button></div>`;
}
function presetButtons(): string { return `<button class="chip" data-preset="neon">Neon</button><button class="chip" data-preset="metal">Metall</button><button class="chip" data-preset="wood">Holz</button><button class="chip" data-preset="stone">Stein</button><button class="chip" data-preset="paper">Vintage</button><button class="chip" data-preset="tech">Tech</button>`; }

function resizeDesign(width: number, height: number): void {
  const nextWidth = clamp(Math.round(width), 160, 5000);
  const nextHeight = clamp(Math.round(height), 100, 5000);
  const scaleX = nextWidth / design.width;
  const scaleY = nextHeight / design.height;
  const uniformScale = averageScale(scaleX, scaleY);

  design.objects.forEach((item) => {
    item.x *= scaleX; item.y *= scaleY; item.width *= scaleX; item.height *= scaleY;
    item.strokeWidth *= uniformScale;
    if (item.type === "line") { item.x2 *= scaleX; item.y2 *= scaleY; }
    if (item.type === "text") { item.fontSize *= uniformScale; item.glow.blur *= uniformScale; item.glow.spread *= uniformScale; item.relief.depth *= uniformScale; item.relief.softness *= uniformScale; }
    if (item.type === "image") { item.cornerRadius *= uniformScale; item.imageOffsetX *= scaleX; item.imageOffsetY *= scaleY; }
  });
  design.radius = clamp(design.radius * uniformScale, 0, Math.min(nextWidth, nextHeight) / 2);
  design.borderWidth *= uniformScale;
  design.borderRelief.depth *= uniformScale;
  design.borderRelief.softness *= uniformScale;
  design.width = nextWidth;
  design.height = nextHeight;
  fitLabelImages();
}

function bindProperties(): void {
  const dispatchNumberInput = (input: HTMLInputElement): void => { input.dispatchEvent(new Event("input", { bubbles: true })); };
  app.querySelectorAll<HTMLInputElement>('input[data-number-input="true"]').forEach((input) => {
    let decimalPending = false;
    input.addEventListener("keydown", (event) => {
      if (event.key === ",") {
        event.preventDefault();
        decimalPending = !input.value.includes(".");
        return;
      }
      if (decimalPending && /^\d$/.test(event.key)) {
        event.preventDefault();
        input.value = `${input.value}.${event.key}`;
        decimalPending = false;
        dispatchNumberInput(input);
        return;
      }
      if (event.key === "Escape" || event.key === "Backspace" || event.key === "Delete") decimalPending = false;
    });
    input.addEventListener("paste", (event) => {
      const pasted = event.clipboardData?.getData("text") ?? "";
      if (!pasted.includes(",")) return;
      event.preventDefault();
      const normalized = pasted.replace(/,/g, ".");
      if (!Number.isFinite(Number(normalized))) return;
      input.value = normalized;
      decimalPending = false;
      dispatchNumberInput(input);
    });
  });
  const set = (id: string, callback: (input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) => void, event = "input") => app.querySelector(`#${id}`)?.addEventListener(event, (eventObject) => { callback(eventObject.target as HTMLInputElement); update(); });
  const setNumber = (id: string, callback: (input: HTMLInputElement) => void): void => {
    const input = app.querySelector<HTMLInputElement>(`#${id}`);
    if (!input) return;
    let timer: number | undefined;
    const clearTimer = (): void => { if (timer) { clearTimeout(timer); timer = undefined; } };
    const commit = (): void => { clearTimer(); callback(input); update(); };
    input.addEventListener("input", () => {
      clearTimer();
      timer = window.setTimeout(() => { callback(input); renderPreview(); timer = undefined; }, INPUT_PREVIEW_DELAY);
    });
    input.addEventListener("change", commit);
    input.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); commit(); input.blur(); } });
  };
  set("design-name", (input) => { design.name = input.value; });
  set("label-format", (input) => {
    const format = labelFormatConfig.formats.find((entry) => entry.id === input.value);
    if (!format) { selectedLabelFormatId = "custom"; return; }
    selectedLabelFormatId = format.id;
    design.widthCm = roundCentimeters(format.widthMm / 10);
    design.heightCm = roundCentimeters(format.heightMm / 10);
    resizeDesign(centimetersToPixels(design.widthCm, design.dpi), centimetersToPixels(design.heightCm, design.dpi));
  }, "change");
  set("physical-unit", (input) => { design.physicalUnit = input.value as PhysicalUnit; }, "change");
  set("number-format", (input) => { design.numberFormat = input.value as NumberFormat; }, "change");
  setNumber("design-dpi", (input) => {
    design.dpi = clamp(toNumber(input.value, design.dpi), 72, 1200);
    resizeDesign(centimetersToPixels(design.widthCm, design.dpi), centimetersToPixels(design.heightCm, design.dpi));
  });
  setNumber("design-width-physical", (input) => {
    selectedLabelFormatId = "custom";
    const minimum = design.physicalUnit === "mm" ? 1 : .1;
    const maximum = design.physicalUnit === "mm" ? 1000 : 100;
    design.widthCm = roundCentimeters(physicalCentimeters(clamp(toNumber(input.value, physicalValue(design.widthCm)), minimum, maximum)));
    resizeDesign(centimetersToPixels(design.widthCm, design.dpi), design.height);
  });
  setNumber("design-height-physical", (input) => {
    selectedLabelFormatId = "custom";
    const minimum = design.physicalUnit === "mm" ? 1 : .1;
    const maximum = design.physicalUnit === "mm" ? 1000 : 100;
    design.heightCm = roundCentimeters(physicalCentimeters(clamp(toNumber(input.value, physicalValue(design.heightCm)), minimum, maximum)));
    resizeDesign(design.width, centimetersToPixels(design.heightCm, design.dpi));
  });
  setNumber("design-width", (input) => {
    selectedLabelFormatId = "custom";
    resizeDesign(toNumber(input.value, design.width), design.height);
    design.widthCm = roundCentimeters(pixelsToCentimeters(design.width, design.dpi));
  });
  setNumber("design-height", (input) => {
    selectedLabelFormatId = "custom";
    resizeDesign(design.width, toNumber(input.value, design.height));
    design.heightCm = roundCentimeters(pixelsToCentimeters(design.height, design.dpi));
  });
  setNumber("design-radius", (input) => { design.radius = clamp(toNumber(input.value, 0), 0, Math.min(design.width, design.height) / 2); });
  set("background-fill", (input) => { design.backgroundFill = input.value as FillType; }, "change");
  set("background-a", (input) => { design.backgroundA = input.value; }); set("background-b", (input) => { design.backgroundB = input.value; });
  setNumber("gradient-angle", (input) => { design.gradientAngle = toNumber(input.value, 0); }); set("background-texture", (input) => { design.texture = input.value as Texture; }, "change"); set("texture-opacity", (input) => { design.textureOpacity = toNumber(input.value, .35); });
  set("border-visible", (input) => { design.borderVisible = (input as HTMLInputElement).checked; }, "change"); setNumber("border-width", (input) => { design.borderWidth = clamp(toNumber(input.value, 0), 0, 200); }); set("border-texture", (input) => { design.borderTexture = input.value as Texture; }, "change"); set("border-a", (input) => { design.borderA = input.value; }); set("border-b", (input) => { design.borderB = input.value; });
  bindReliefInputs("border-relief", design.borderRelief, set, setNumber);

  const item = selectedOne();
  if (item) bindObjectInputs(item, set, setNumber);
  if (selectedIds.size > 1) set("multi-visible", (input) => selectedObjects().forEach((item) => { item.visible = (input as HTMLInputElement).checked; }), "change");
  app.querySelector("#duplicate-object")?.addEventListener("click", duplicateSelection);
  app.querySelector("#delete-object")?.addEventListener("click", deleteSelection);
  app.querySelectorAll<HTMLButtonElement>("[data-layer]").forEach((button) => button.addEventListener("click", () => moveLayer(button.dataset.layer as "back" | "down" | "up" | "front")));
  app.querySelectorAll<HTMLElement>("[data-object-id]").forEach((row) => row.addEventListener("click", (event) => { if ((event.target as HTMLElement).closest("button")) return; selectFromLayer(row.dataset.objectId!, event.shiftKey); }));
  app.querySelectorAll<HTMLButtonElement>("[data-toggle-visible]").forEach((button) => button.addEventListener("click", () => { const object = getObject(button.dataset.toggleVisible!); if (object) { object.visible = !object.visible; update(); } }));
  app.querySelectorAll<HTMLButtonElement>("[data-delete-layer]").forEach((button) => button.addEventListener("click", () => { selectedIds = new Set([button.dataset.deleteLayer!]); deleteSelection(); }));
  app.querySelectorAll<HTMLButtonElement>("[data-preset]").forEach((button) => button.addEventListener("click", () => applyPreset(button.dataset.preset!)));
  const preview = app.querySelector<HTMLElement>("#gradient-preview");
  if (preview) preview.style.background = design.backgroundFill === "solid" ? design.backgroundA : design.backgroundFill === "radial" ? `radial-gradient(circle, ${design.backgroundA}, ${design.backgroundB})` : `linear-gradient(${design.gradientAngle}deg, ${design.backgroundA}, ${design.backgroundB})`;
}

function bindReliefInputs(id: string, relief: ReliefStyle, set: (id: string, callback: (input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) => void, event?: string) => void, setNumber: (id: string, callback: (input: HTMLInputElement) => void) => void): void {
  set(`${id}-mode`, (input) => { relief.mode = input.value as ReliefMode; }, "change");
  setNumber(`${id}-depth`, (input) => { relief.depth = clamp(toNumber(input.value, relief.depth), 0, 100); });
  setNumber(`${id}-angle`, (input) => { relief.angle = toNumber(input.value, relief.angle); });
  setNumber(`${id}-softness`, (input) => { relief.softness = clamp(toNumber(input.value, relief.softness), 0, 50); });
  set(`${id}-strength`, (input) => { relief.strength = clamp(toNumber(input.value, relief.strength), 0, 1); });
  set(`${id}-highlight`, (input) => { relief.highlightColor = input.value; });
  set(`${id}-shadow`, (input) => { relief.shadowColor = input.value; });
}

function bindObjectInputs(item: DesignObject, set: (id: string, callback: (input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) => void, event?: string) => void, setNumber: (id: string, callback: (input: HTMLInputElement) => void) => void): void {
  set("object-name", (input) => { item.name = input.value; }); setNumber("object-x", (input) => { item.x = toNumber(input.value, item.x); }); setNumber("object-y", (input) => { item.y = toNumber(input.value, item.y); }); setNumber("object-width", (input) => { item.width = Math.max(1, toNumber(input.value, item.width)); }); setNumber("object-height", (input) => { item.height = Math.max(1, toNumber(input.value, item.height)); }); setNumber("object-rotation", (input) => { item.rotation = toNumber(input.value, item.rotation); }); set("object-opacity", (input) => { item.opacity = clamp(toNumber(input.value, item.opacity), 0, 1); }); set("object-fill", (input) => { item.fill = input.value; }); set("object-stroke", (input) => { item.stroke = input.value; }); setNumber("object-stroke-width", (input) => { item.strokeWidth = Math.max(0, toNumber(input.value, item.strokeWidth)); }); set("object-visible", (input) => { item.visible = (input as HTMLInputElement).checked; }, "change"); set("object-locked", (input) => { item.locked = (input as HTMLInputElement).checked; }, "change");
  if (item.type === "text") {
    const textContent = app.querySelector<HTMLTextAreaElement>("#text-content");
    if (textContent) {
      textContent.addEventListener("input", () => { item.text = textContent.value; renderPreview(); });
      textContent.addEventListener("change", () => { item.text = textContent.value; update(); });
      textContent.addEventListener("keydown", (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); textContent.blur(); }
      });
    }
    setNumber("text-size", (input) => { item.fontSize = Math.max(6, toNumber(input.value, item.fontSize)); }); set("text-font", (input) => { item.fontFamily = input.value; }, "change"); set("text-align", (input) => { item.align = input.value as CanvasTextAlign; }, "change"); set("text-shadow", (input) => { item.shadow = (input as HTMLInputElement).checked; }, "change"); set("text-glow", (input) => { item.glow.enabled = (input as HTMLInputElement).checked; }, "change"); set("glow-color", (input) => { item.glow.color = input.value; }); set("glow-intensity", (input) => { item.glow.intensity = clamp(toNumber(input.value, 100), 0, 200); }); set("glow-blur", (input) => { item.glow.blur = clamp(toNumber(input.value, 0), 0, 100); }); set("glow-spread", (input) => { item.glow.spread = clamp(toNumber(input.value, 0), 0, 100); }); set("glow-opacity", (input) => { item.glow.opacity = clamp(toNumber(input.value, 1), 0, 1); }); set("glow-blend", (input) => { item.glow.blendMode = input.value as GlowStyle["blendMode"]; }, "change");
    bindReliefInputs("text-relief", item.relief, set, setNumber);
  }
  if (item.type === "image") {
    set("image-fit", (input) => {
      item.fitMode = input.value as FitMode;
      if (item.fitMode === "label-fill") { item.x = 0; item.y = 0; item.width = design.width; item.height = design.height; }
      clampImageOffset(item);
    }, "change");
    setNumber("image-radius", (input) => { item.cornerRadius = Math.max(0, toNumber(input.value, 0)); });
    setNumber("image-scale", (input) => {
      item.fitMode = "manual";
      item.imageScale = Math.max(1, toNumber(input.value, 100) / 100);
      clampImageOffset(item);
    });
    setNumber("image-offset-x", (input) => { item.imageOffsetX = toNumber(input.value, 0); clampImageOffset(item); });
    setNumber("image-offset-y", (input) => { item.imageOffsetY = toNumber(input.value, 0); clampImageOffset(item); });
  }
}

function point(event: PointerEvent): { x: number; y: number } { const rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * design.width / rect.width, y: (event.clientY - rect.top) * design.height / rect.height }; }
function hitTest(x: number, y: number): DesignObject | undefined { return [...design.objects].reverse().find((item) => item.visible && !item.locked && x >= item.x && x <= item.x + item.width && y >= item.y && y <= item.y + item.height); }

function pointerDoubleClick(event: MouseEvent): void {
  if (activeTool !== "select" || inlineTextEditor) return;
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * design.width / rect.width;
  const y = (event.clientY - rect.top) * design.height / rect.height;
  const hit = hitTest(x, y);
  if (isText(hit)) {
    selectedIds = new Set([hit.id]);
    beginInlineTextEdit(hit);
  }
}

function beginInlineTextEdit(item: TextObject): void {
  cancelInlineTextEdit(false);
  const stage = app.querySelector<HTMLDivElement>(".stage-wrap")!;
  const editor = document.createElement("textarea");
  editor.className = "inline-text-editor";
  editor.value = item.text;
  editor.setAttribute("aria-label", `Text für ${item.name} bearbeiten`);
  editor.style.left = `${canvas.offsetLeft + item.x * scale}px`;
  editor.style.top = `${canvas.offsetTop + item.y * scale}px`;
  editor.style.width = `${Math.max(48, item.width * scale)}px`;
  editor.style.height = `${Math.max(32, item.height * scale)}px`;
  editor.style.font = `${item.fontWeight} ${Math.max(12, item.fontSize * scale)}px ${item.fontFamily}`;
  editor.style.color = item.fill;
  editor.style.textAlign = item.align;
  editor.style.transform = `rotate(${item.rotation}deg)`;
  editor.style.transformOrigin = "center";
  stage.append(editor);
  inlineTextEditor = editor;
  inlineTextEditorId = item.id;
  inlineTextOriginal = item.text;
  editor.addEventListener("input", () => { item.text = editor.value; renderPreview(); });
  editor.addEventListener("blur", () => commitInlineTextEdit());
  editor.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { event.preventDefault(); cancelInlineTextEdit(); }
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); editor.blur(); }
  });
  renderPreview();
  editor.focus();
  editor.select();
}

function commitInlineTextEdit(): void {
  if (!inlineTextEditor) return;
  const item = inlineTextEditorId ? getObject(inlineTextEditorId) : undefined;
  if (isText(item)) item.text = inlineTextEditor.value;
  inlineTextEditor.remove();
  inlineTextEditor = undefined;
  inlineTextEditorId = undefined;
  inlineTextOriginal = undefined;
  update();
}

function cancelInlineTextEdit(restore = true): void {
  if (!inlineTextEditor) return;
  const item = inlineTextEditorId ? getObject(inlineTextEditorId) : undefined;
  if (restore && isText(item) && inlineTextOriginal !== undefined) item.text = inlineTextOriginal;
  inlineTextEditor.remove();
  inlineTextEditor = undefined;
  inlineTextEditorId = undefined;
  inlineTextOriginal = undefined;
  update();
}

function pointerDown(event: PointerEvent): void {
  const pointValue = point(event);
  if (activeTool === "image") { imageInput.click(); return; }
  const hit = hitTest(pointValue.x, pointValue.y);
  if (activeTool === "eyedropper") {
    if (isText(hit)) {
      const { id, type, name, text, x, y, width, height, rotation, visible, locked, ...style } = hit;
      textStyleClipboard = structuredClone(style);
      setTool("brush");
      showToast(`Textstil von „${hit.name}“ aufgenommen.`);
    } else showToast("Die Stil-Pipette kann nur Textobjekte aufnehmen.", true);
    return;
  }
  if (activeTool === "brush") {
    if (!textStyleClipboard) { showToast("Zuerst mit der Pipette einen Textstil aufnehmen.", true); return; }
    if (isText(hit)) { Object.assign(hit, structuredClone(textStyleClipboard)); showToast(`Stil auf „${hit.name}“ übertragen.`); update(); } else showToast("Der Stilpinsel kann nur auf Textobjekte angewendet werden.", true);
    return;
  }
  if (activeTool !== "select") { const item = createObject(activeTool, pointValue.x, pointValue.y); design.objects.push(item); selectedIds = new Set([item.id]); setTool("select"); update(); return; }
  if (!hit) { if (!event.shiftKey) selectedIds.clear(); marquee = { startX: pointValue.x, startY: pointValue.y, x: pointValue.x, y: pointValue.y }; canvas.setPointerCapture(event.pointerId); update(); return; }
  if (event.shiftKey && selectedIds.size === 1 && selectedIds.has(hit.id) && hit.type === "image") {
    drag = { mode: "image-content", startX: pointValue.x, startY: pointValue.y, imageId: hit.id, offsetX: hit.imageOffsetX, offsetY: hit.imageOffsetY, moved: false, deselectOnClick: false };
    canvas.setPointerCapture(event.pointerId);
    return;
  }
  if (event.shiftKey) { if (selectedIds.has(hit.id)) selectedIds.delete(hit.id); else selectedIds.add(hit.id); update(); return; }
  const deselectOnClick = selectedIds.size === 1 && selectedIds.has(hit.id);
  if (!selectedIds.has(hit.id)) selectedIds = new Set([hit.id]);
  const origins = new Map(selectedObjects().filter((item) => !item.locked).map((item) => [item.id, { x: item.x, y: item.y }]));
  drag = { mode: "objects", startX: pointValue.x, startY: pointValue.y, origins, moved: false, deselectOnClick }; canvas.setPointerCapture(event.pointerId); update();
}

function pointerMove(event: PointerEvent): void {
  const pointValue = point(event);
  if (marquee) { marquee.x = pointValue.x; marquee.y = pointValue.y; update(); return; }
  if (!drag) return;
  const dx = pointValue.x - drag.startX, dy = pointValue.y - drag.startY;
  if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
  drag.moved = true;
  if (drag.mode === "image-content") {
    const item = getObject(drag.imageId);
    if (item?.type === "image") {
      item.fitMode = "manual";
      item.imageScale = Math.max(1, item.imageScale);
      item.imageOffsetX = drag.offsetX + dx;
      item.imageOffsetY = drag.offsetY + dy;
      clampImageOffset(item);
    }
  } else {
    drag.origins.forEach((origin, id) => { const item = getObject(id); if (item) { item.x = clamp(origin.x + dx, 0, design.width - item.width); item.y = clamp(origin.y + dy, 0, design.height - item.height); } });
  }
  update();
}

function pointerUp(): void {
  if (marquee) {
    const x1 = Math.min(marquee.startX, marquee.x), x2 = Math.max(marquee.startX, marquee.x), y1 = Math.min(marquee.startY, marquee.y), y2 = Math.max(marquee.startY, marquee.y);
    design.objects.filter((item) => item.visible && !item.locked && item.x < x2 && item.x + item.width > x1 && item.y < y2 && item.y + item.height > y1).forEach((item) => selectedIds.add(item.id));
  }
  if (drag?.mode === "image-content" && !drag.moved) selectedIds.delete(drag.imageId);
  else if (drag?.deselectOnClick && !drag.moved) selectedIds.clear();
  drag = undefined; marquee = undefined; update();
}

function createObject(tool: Exclude<Tool, "select" | "image" | "eyedropper" | "brush">, x: number, y: number): DesignObject {
  if (tool === "text") return textObject(`Text ${design.objects.filter((item) => item.type === "text").length + 1}`, x, y, 520, 100, "Neuer Text", 66, "#ffffff", false);
  if (tool === "line") return { id: uid(), type: "line", name: "Linie", x, y, width: 340, height: 30, x2: x + 340, y2: y + 30, rotation: 0, opacity: 1, fill: "transparent", stroke: "#ffffff", strokeWidth: 10, visible: true, locked: false };
  return { id: uid(), type: tool, name: tool === "rect" ? "Rechteck" : "Ellipse", x, y, width: 270, height: 150, rotation: 0, opacity: 1, fill: "#ffffff55", stroke: "#fbbf24", strokeWidth: 7, visible: true, locked: false };
}

function selectFromLayer(id: string, additive: boolean): void { if (!additive) selectedIds.clear(); if (additive && selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id); update(); }
function deleteSelection(): void { if (!selectedIds.size) return; design.objects = design.objects.filter((item) => !selectedIds.has(item.id)); selectedIds.clear(); update(); }
function duplicateSelection(): void { const copies = selectedObjects().map((item) => { const copy = structuredClone(item); copy.id = uid(); copy.name += " Kopie"; copy.x += 24; copy.y += 24; return copy; }); design.objects.push(...copies); selectedIds = new Set(copies.map((item) => item.id)); update(); }
function moveLayer(action: "back" | "down" | "up" | "front"): void {
  const selected = design.objects.filter((item) => selectedIds.has(item.id));
  const other = design.objects.filter((item) => !selectedIds.has(item.id));
  if (!selected.length) return;

  if (action === "front") {
    design.objects = [...other, ...selected];
  } else if (action === "back") {
    design.objects = [...selected, ...other];
  } else if (action === "up") {
    // Jede zusammenhängende Auswahlgruppe überquert genau die direkt darüberliegende Ebene.
    const reordered: DesignObject[] = [];
    for (let index = 0; index < design.objects.length;) {
      const item = design.objects[index];
      if (!selectedIds.has(item.id)) {
        reordered.push(item);
        index++;
        continue;
      }

      const start = index;
      while (index < design.objects.length && selectedIds.has(design.objects[index].id)) index++;
      const selectionBlock = design.objects.slice(start, index);
      const next = design.objects[index];
      if (next && !selectedIds.has(next.id)) {
        reordered.push(next, ...selectionBlock);
        index++;
      } else {
        reordered.push(...selectionBlock);
      }
    }
    design.objects = reordered;
  } else {
    // Analog nach hinten: jede Auswahlgruppe überquert genau die direkt darunterliegende Ebene.
    const reordered: DesignObject[] = [];
    for (let index = 0; index < design.objects.length;) {
      const item = design.objects[index];
      const next = design.objects[index + 1];
      if (!selectedIds.has(item.id) && next && selectedIds.has(next.id)) {
        const start = index + 1;
        index = start;
        while (index < design.objects.length && selectedIds.has(design.objects[index].id)) index++;
        reordered.push(...design.objects.slice(start, index), item);
      } else {
        reordered.push(item);
        index++;
      }
    }
    design.objects = reordered;
  }

  update();
}
function fitLabelImages(): void { design.objects.forEach((item) => { if (item.type === "image" && item.fitMode === "label-fill") { item.x = 0; item.y = 0; item.width = design.width; item.height = design.height; } }); }

async function importImages(): Promise<void> {
  const files = [...(imageInput.files ?? [])]; imageInput.value = "";
  for (const file of files) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { showToast(`„${file.name}“ ist kein unterstütztes Bildformat.`, true); continue; }
    const dataUrl = await readFile(file);
    const dimensions = await imageSize(dataUrl);
    const ratio = Math.min((design.width * .55) / dimensions.width, (design.height * .55) / dimensions.height, 1);
    const width = Math.round(dimensions.width * ratio), height = Math.round(dimensions.height * ratio);
    const item: ImageObject = { id: uid(), type: "image", name: uniqueImageName(file.name), x: Math.round((design.width - width) / 2), y: Math.round((design.height - height) / 2), width, height, rotation: 0, opacity: 1, fill: "transparent", stroke: "transparent", strokeWidth: 0, visible: true, locked: false, dataUrl, fileName: file.name, mimeType: file.type, sourceWidth: dimensions.width, sourceHeight: dimensions.height, fitMode: "manual", imageScale: 1, imageOffsetX: 0, imageOffsetY: 0, cornerRadius: 0 };
    design.objects.push(item); selectedIds = new Set([item.id]);
  }
  if (files.length) { setTool("select"); update(); showToast(`${files.length} Bild${files.length === 1 ? "" : "er"} eingefügt.`); }
}
function uniqueImageName(fileName: string): string { const base = fileName.replace(/\.[^.]+$/, "") || "Bild"; const existing = design.objects.filter((item) => item.type === "image").length; return existing ? `${base} ${existing + 1}` : base; }
function readFile(file: File): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(reader.error); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(file); }); }
function imageSize(dataUrl: string): Promise<{ width: number; height: number }> { return new Promise((resolve, reject) => { const image = new Image(); image.onerror = () => reject(new Error("Bild konnte nicht gelesen werden.")); image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight }); image.src = dataUrl; }); }

function applyPreset(name: string): void {
  const presets: Record<string, Partial<Design>> = {
    neon: { backgroundFill: "linear", backgroundA: "#110720", backgroundB: "#004d64", gradientAngle: 18, texture: "electronics", textureOpacity: .4, borderA: "#ff4cdd", borderB: "#54f5ff", borderTexture: "none" },
    metal: { backgroundFill: "linear", backgroundA: "#222a32", backgroundB: "#98a3a6", gradientAngle: 90, texture: "metal", textureOpacity: .55, borderA: "#f5f5f5", borderB: "#4e5963", borderTexture: "metal" },
    wood: { backgroundFill: "linear", backgroundA: "#4b2316", backgroundB: "#b86e36", gradientAngle: 90, texture: "wood", textureOpacity: .55, borderA: "#e9bd78", borderB: "#522617", borderTexture: "wood" },
    stone: { backgroundFill: "radial", backgroundA: "#576879", backgroundB: "#1d2a39", texture: "stone", textureOpacity: .45, borderA: "#c5ccd1", borderB: "#313c44", borderTexture: "stone" },
    paper: { backgroundFill: "solid", backgroundA: "#d7bf8b", backgroundB: "#d7bf8b", texture: "paper", textureOpacity: .4, borderA: "#704523", borderB: "#a87842", borderTexture: "none" },
    tech: { backgroundFill: "linear", backgroundA: "#071625", backgroundB: "#005675", gradientAngle: 35, texture: "electronics", textureOpacity: .6, borderA: "#73f8ff", borderB: "#037ba6", borderTexture: "metal" },
  };
  Object.assign(design, presets[name]); update(); showToast(`Stil-Preset „${name}“ angewendet.`);
}

function resetDesign(): void {
  if (!confirm("Neuen Entwurf erstellen? Nicht gespeicherte Änderungen gehen verloren.")) return;
  design.objects = []; design.name = "Neues Label"; design.backgroundA = "#18365d"; design.backgroundB = "#45b7c5"; design.texture = "none"; selectedIds.clear(); update();
}
function download(name: string, blob: Blob): void { const url = URL.createObjectURL(blob), anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
function createPngBlob(): Promise<Blob> {
  const output = document.createElement("canvas");
  output.width = design.width;
  output.height = design.height;
  renderCanvas(output.getContext("2d")!, design, false);
  return new Promise((resolve, reject) => output.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG konnte nicht erzeugt werden.")), "image/png"));
}
async function exportPngSaveAs(): Promise<void> {
  const picker = (window as Window & {
    showSaveFilePicker?: (options: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<{ createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }> }>;
  }).showSaveFilePicker;
  if (!picker) {
    showToast("Dieser Browser unterstützt keinen Speichern-unter-Dialog. Nutze „PNG exportieren“ für den Direktdownload.", true);
    return;
  }
  try {
    const handle = await picker({ suggestedName: `${fileName(design.name)}.png`, types: [{ description: "PNG-Bild", accept: { "image/png": [".png"] } }] });
    const writable = await handle.createWritable();
    await writable.write(await createPngBlob());
    await writable.close();
    showToast(`PNG ${design.width} × ${design.height} gespeichert.`);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    showToast(error instanceof Error ? error.message : "PNG konnte nicht gespeichert werden.", true);
  }
}
function exportPng(): void {
  void createPngBlob().then((blob) => {
    download(`${fileName(design.name)}.png`, blob);
    showToast(`PNG ${design.width} × ${design.height} exportiert.`);
  }).catch((error: unknown) => showToast(error instanceof Error ? error.message : "PNG konnte nicht erzeugt werden.", true));
}
function exportJson(): void { download(`${fileName(design.name)}.json`, new Blob([JSON.stringify(design, null, 2)], { type: "application/json" })); showToast("Entwurf als JSON gespeichert."); }
async function importJson(): Promise<void> {
  const file = importInput.files?.[0]; importInput.value = ""; if (!file) return;
  try {
    const parsed = JSON.parse(await file.text()) as Partial<Design>;
    if (parsed.kind !== "myqr24.label-designer.document" || !Array.isArray(parsed.objects)) throw new Error("Keine gültige Label-Designer-Datei.");
    design = migrate(parsed); selectedIds.clear(); imageCache.clear(); update(); showToast("Entwurf geladen.");
  } catch (error) { showToast(error instanceof Error ? error.message : "Datei konnte nicht geladen werden.", true); }
}
function migrate(input: Partial<Design>): Design {
  const draft = input as Design;
  const dpi = clamp(Number.isFinite(draft.dpi) ? draft.dpi : 300, 72, 1200);
  const width = clamp(Number.isFinite(draft.width) ? draft.width : 1828, 160, 5000);
  const height = clamp(Number.isFinite(draft.height) ? draft.height : 848, 100, 5000);
  return {
    ...draft,
    schemaVersion: 5,
    physicalUnit: draft.physicalUnit === "cm" ? "cm" : "mm",
    numberFormat: draft.numberFormat === "en-US" ? "en-US" : "de-DE",
    dpi,
    width,
    height,
    widthCm: roundCentimeters(Number.isFinite(draft.widthCm) ? draft.widthCm : pixelsToCentimeters(width, dpi)),
    heightCm: roundCentimeters(Number.isFinite(draft.heightCm) ? draft.heightCm : pixelsToCentimeters(height, dpi)),
    borderRelief: { ...defaultRelief(), ...(draft.borderRelief ?? {}) },
    objects: draft.objects.map((item) => {
      const base = { ...item, visible: item.visible ?? true, locked: item.locked ?? false };
      if (base.type === "text") {
        const text = base as TextObject & { glow?: boolean | GlowStyle; relief?: Partial<ReliefStyle> };
        return { ...text, glow: typeof text.glow === "object" ? text.glow : { enabled: Boolean(text.glow), color: text.fill, intensity: 100, blur: 22, spread: 3, opacity: 1, blendMode: "screen" }, relief: { ...defaultRelief(), ...(text.relief ?? {}) } };
      }
      return base;
    }),
  } as Design;
}
function fileName(value: string): string { return value.trim().toLowerCase().replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "") || "label-design"; }
function showToast(message: string, error = false): void { const toast = app.querySelector<HTMLDivElement>("#toast")!; toast.textContent = message; toast.style.background = error ? "#fda4af" : "#86efda"; toast.classList.remove("hidden"); if (toastTimer) clearTimeout(toastTimer); toastTimer = window.setTimeout(() => toast.classList.add("hidden"), 3000); }

function isLabelFormatConfig(value: unknown): value is LabelFormatConfig {
  if (!value || typeof value !== "object") return false;
  const config = value as Partial<LabelFormatConfig>;
  return Array.isArray(config.formats) && config.formats.length > 0 && config.formats.every((format) => typeof format.id === "string" && typeof format.name === "string" && Number.isFinite(format.widthMm) && Number.isFinite(format.heightMm) && format.widthMm > 0 && format.heightMm > 0) && Boolean(config.default);
}

async function initialize(): Promise<void> {
  try {
    const response = await fetch("/label-formats.json");
    const config: unknown = await response.json();
    if (!response.ok || !isLabelFormatConfig(config)) throw new Error("Ungültige Label-Format-Konfiguration.");
    labelFormatConfig = config;
    const defaults = config.default;
    const format = config.formats.find((entry) => entry.id === defaults.formatId) ?? config.formats[0];
    selectedLabelFormatId = format.id;
    design.physicalUnit = defaults.physicalUnit === "cm" ? "cm" : "mm";
    design.numberFormat = defaults.numberFormat === "en-US" ? "en-US" : "de-DE";
    design.dpi = clamp(defaults.dpi, 72, 1200);
    design.widthCm = roundCentimeters(format.widthMm / 10);
    design.heightCm = roundCentimeters(format.heightMm / 10);
    design.radius = clamp(defaults.cornerRadiusPx, 0, 2500);
    resizeDesign(centimetersToPixels(design.widthCm, design.dpi), centimetersToPixels(design.heightCm, design.dpi));
  } catch {
    // Die eingebauten Standardwerte ermöglichen den Start auch ohne Konfigurationsdatei.
  }
  html();
}

void initialize();
