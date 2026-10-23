export type TagLength = 6 | 8;
export type InputLocale = "de-DE" | "en-US";
export type QrIdCase = "upper" | "lower";
export type QrErrorCorrectionLevel = "L" | "M" | "Q" | "H";
export type QrVersion = "auto" | number;
export type LabelFontFamily = "helvetica" | "times-roman" | "courier";
export type LabelFontStyle = "normal" | "bold" | "italic" | "bold-italic";

export interface QrProfile {
  version: QrVersion;
  errorCorrectionLevel: QrErrorCorrectionLevel;
  quietZoneModules: number;
}

export function defaultQrProfile(): QrProfile {
  return { version: "auto", errorCorrectionLevel: "M", quietZoneModules: 4 };
}

export interface TagRangeDefinition {
  id: string;
  name: string;
  start: string;
  end: string;
  tagLength: TagLength;
  labelText: string;
  qrProfile: QrProfile;
  createdAt: string;
  updatedAt: string;
}

export type RangeInputMode = "absolute" | "offset";

export interface GeneratedTag {
  tagId: string;
  url: string;
  rangeId: string;
  rangeName: string;
  ordinalInRange: string;
  requestedValue: string;
  decodedValue: string;
  tagLength: TagLength;
  labelText: string;
  qrProfile?: QrProfile;
}

export interface PositionedElement {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

export interface PageTextArea {
  text: string;
  leftMm: number;
  widthMm: number;
  heightMm: number;
}

export interface PageLayout {
  header: PageTextArea & { topOffsetMm: number };
  footer: PageTextArea & { bottomOffsetMm: number };
}

export interface LabelTemplate {
  id: string;
  name: string;
  page: { widthMm: 210; heightMm: 297 };
  grid: {
    columns: number;
    rows: number;
    labelWidthMm: number;
    labelHeightMm: number;
    leftMarginMm: number;
    topMarginMm: number;
    horizontalGapMm: number;
    verticalGapMm: number;
  };
  pageLayout: PageLayout;
  elements: {
    qr: PositionedElement & {
      quietZoneModules: number;
      errorCorrectionLevel: "M" | "Q" | "H";
    };
    text: PositionedElement & {
      fontFamily: LabelFontFamily;
      fontSizePt: number;
      fontStyle: LabelFontStyle;
      fontWeight: "normal" | "bold";
      horizontalAlign: "left" | "center" | "right";
      verticalAlign: "top" | "middle" | "bottom";
      lineHeight: number;
      overflow: "shrink" | "ellipsis" | "clip";
    };
    tagIdText: PositionedElement & {
      fontFamily: LabelFontFamily;
      fontSizePt: number;
      fontStyle: LabelFontStyle;
      fontWeight: "normal" | "bold";
      horizontalAlign: "left" | "center" | "right";
      verticalAlign: "top" | "middle" | "bottom";
      lineHeight: number;
      overflow: "shrink" | "ellipsis" | "clip";
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface PrintSettings {
  templateId: string;
  startRow: number;
  startColumn: number;
  selectedRangeIds?: string[];
}

export interface TagGeneratorConfiguration {
  schemaVersion: 1;
  kind: "myqr24.tag-generator.config";
  name: string;
  updatedAt: string;
  baseUrl: string;
  inputLocale: InputLocale;
  qrIdCase: QrIdCase;
  defaultQrProfile: QrProfile;
  ranges: TagRangeDefinition[];
  labelTemplates: LabelTemplate[];
  selectedTemplateId?: string;
  printSettings?: PrintSettings;
}

export interface LabelTemplateExport {
  schemaVersion: 1;
  kind: "myqr24.tag-generator.label-template";
  exportedAt: string;
  template: LabelTemplate;
}

export interface TagListExport {
  schemaVersion: 1;
  kind: "myqr24.tag-generator.tag-list";
  generatedAt: string;
  source: { baseUrl: string; qrIdCase: QrIdCase; ranges: TagRangeDefinition[] };
  tags: GeneratedTag[];
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

export const MAX_TAGS_PER_RUN = 10_000;

export function now(): string {
  return new Date().toISOString();
}

export function makeId(): string {
  return crypto.randomUUID();
}

export function parseFormattedInteger(input: string): ValidationResult<bigint> {
  const normalized = input.trim().replace(/[.\s]/g, "");

  if (!normalized || !/^\d+$/.test(normalized)) {
    return {
      ok: false,
      errors: ["Bitte eine nichtnegative Ganzzahl ohne Nachkommastellen eingeben."],
    };
  }

  try {
    return { ok: true, value: BigInt(normalized) };
  } catch {
    return { ok: false, errors: ["Die Zahl konnte nicht gelesen werden."] };
  }
}

export function formatInteger(value: bigint | string): string {
  const parsed = typeof value === "bigint" ? value : BigInt(value);
  return new Intl.NumberFormat("de-DE", { useGrouping: true }).format(parsed);
}

export function lowerBound(length: TagLength): bigint {
  return 36n ** BigInt(length - 1);
}

export function upperBound(length: TagLength): bigint {
  return 36n ** BigInt(length);
}

export function maximumOffset(length: TagLength): bigint {
  const availableValues = upperBound(length) - lowerBound(length);
  return length === 8 ? availableValues / 16n - 1n : availableValues - 1n;
}

export function resolveRangeValues(
  length: TagLength,
  inputMode: RangeInputMode,
  startInput: string,
  endInput: string,
): ValidationResult<{ start: string; end: string }> {
  const startResult = parseFormattedInteger(startInput);
  const endResult = parseFormattedInteger(endInput);
  const errors: string[] = [];

  if (!startResult.ok) errors.push(...startResult.errors);
  if (!endResult.ok) errors.push(...endResult.errors);
  if (!startResult.ok || !endResult.ok) return { ok: false, errors };

  if (startResult.value > endResult.value) {
    return { ok: false, errors: ["Der Von-Wert darf nicht größer als der Bis-Wert sein."] };
  }

  if (inputMode === "absolute") {
    return { ok: true, value: { start: startResult.value.toString(), end: endResult.value.toString() } };
  }

  const maxOffset = maximumOffset(length);
  if (endResult.value > maxOffset) {
    return {
      ok: false,
      errors: [`Der Offset darf für ${length}-stellige TAGs höchstens ${formatInteger(maxOffset)} betragen.`],
    };
  }

  const multiplier = length === 8 ? 16n : 1n;
  return {
    ok: true,
    value: {
      start: (lowerBound(length) + startResult.value * multiplier).toString(),
      end: (lowerBound(length) + endResult.value * multiplier).toString(),
    },
  };
}

export function countRange(range: TagRangeDefinition): bigint {
  const start = BigInt(range.start);
  const end = BigInt(range.end);
  return range.tagLength === 8 ? (end - start) / 16n + 1n : end - start + 1n;
}

export function validateBaseUrl(input: string): ValidationResult<string> {
  const candidate = input.trim();

  if (!/^[0-9A-Z $%*+\-./:]+$/i.test(candidate)) {
    return {
      ok: false,
      errors: ["Die Basis-URL enthält Zeichen außerhalb des Base45-kompatiblen Zeichensatzes."],
    };
  }

  try {
    const url = new URL(candidate);

    if (url.protocol !== "https:") {
      return { ok: false, errors: ["Die Basis-URL muss HTTPS verwenden."] };
    }

    if (url.search || url.hash || url.username || url.password) {
      return {
        ok: false,
        errors: ["Die Basis-URL darf keinen Query, Fragment oder Zugangsdaten enthalten."],
      };
    }

    url.pathname = url.pathname.replace(/\/+$/, "") + "/";
    const normalized = url.toString();
    const base45Compatible = /^[0-9A-Z $%*+\-./:]+$/i.test(normalized);

    if (!base45Compatible) {
      return {
        ok: false,
        errors: ["Die Basis-URL enthält Zeichen außerhalb des Base45-kompatiblen Zeichensatzes."],
      };
    }

    return { ok: true, value: normalized };
  } catch {
    return { ok: false, errors: ["Bitte eine vollständige HTTPS-Basis-URL eingeben."] };
  }
}

export function validateQrProfile(profile: QrProfile): ValidationResult<QrProfile> {
  if (
    !profile ||
    (profile.version !== "auto" && (!Number.isInteger(profile.version) || profile.version < 1 || profile.version > 40)) ||
    !["L", "M", "Q", "H"].includes(profile.errorCorrectionLevel) ||
    !Number.isInteger(profile.quietZoneModules) ||
    profile.quietZoneModules < 0 ||
    profile.quietZoneModules > 20
  ) {
    return { ok: false, errors: ["QR-Profil: Version muss „auto“ oder 1–40 sein, Fehlertoleranz L/M/Q/H und Quiet Zone 0–20 Module."] };
  }
  return { ok: true, value: { ...profile } };
}

export function validateRange(
  candidate: Omit<TagRangeDefinition, "createdAt" | "updatedAt" | "qrProfile"> & { qrProfile?: QrProfile },
  existingRanges: readonly TagRangeDefinition[] = [],
  allowOverlapForVersion = false,
): ValidationResult<TagRangeDefinition> {
  const errors: string[] = [];
  const name = candidate.name.trim();
  const startResult = parseFormattedInteger(candidate.start);
  const endResult = parseFormattedInteger(candidate.end);

  if (!name) errors.push("Ein Bereichsname ist erforderlich.");
  if (name.length > 120) errors.push("Der Bereichsname darf höchstens 120 Zeichen enthalten.");
  if (candidate.labelText.length > 500) errors.push("Der Etikettentext darf höchstens 500 Zeichen enthalten.");
  if (candidate.tagLength !== 6 && candidate.tagLength !== 8) errors.push("Ungültige TAG-Länge.");
  const qrProfile = validateQrProfile(candidate.qrProfile ?? defaultQrProfile());
  if (!qrProfile.ok) errors.push(...qrProfile.errors);

  if (!startResult.ok) errors.push(...startResult.errors);
  if (!endResult.ok) errors.push(...endResult.errors);

  if (startResult.ok && endResult.ok) {
    const start = startResult.value;
    const end = endResult.value;
    const length = candidate.tagLength;

    if (start > end) errors.push("Der Von-Wert darf nicht größer als der Bis-Wert sein.");
    if (start < lowerBound(length) || end >= upperBound(length)) {
      errors.push(`Die Grenzen müssen im kanonischen ${length}-stelligen Base36-Wertebereich liegen.`);
    }
    if (length === 8 && (start % 16n !== 0n || end % 16n !== 0n)) {
      errors.push("Achtstellige Bereiche müssen bei Von und Bis 16-ausgerichtet sein.");
    }

    for (const current of existingRanges) {
      if (current.id === candidate.id || current.tagLength !== length) continue;
      const overlaps = start <= BigInt(current.end) && end >= BigInt(current.start);
      if (overlaps && !allowOverlapForVersion) {
        errors.push(`Der Bereich überlappt mit „${current.name}“.`);
        break;
      }
      if (current.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase()) {
        errors.push("Bereichsnamen müssen eindeutig sein.");
        break;
      }
    }
  }

  if (errors.length > 0 || !startResult.ok || !endResult.ok) return { ok: false, errors };

  const timestamp = now();
  return {
    ok: true,
    value: {
      ...candidate,
      name,
      start: startResult.value.toString(),
      end: endResult.value.toString(),
      labelText: candidate.labelText,
      qrProfile: qrProfile.ok ? qrProfile.value : defaultQrProfile(),
      createdAt: existingRanges.find((item) => item.id === candidate.id)?.createdAt ?? timestamp,
      updatedAt: timestamp,
    },
  };
}

export function validateTemplate(template: LabelTemplate): ValidationResult<LabelTemplate> {
  const { grid, elements } = template;
  const errors: string[] = [];
  const usedWidth =
    grid.leftMarginMm +
    grid.columns * grid.labelWidthMm +
    (grid.columns - 1) * grid.horizontalGapMm;
  const usedHeight =
    grid.topMarginMm +
    grid.rows * grid.labelHeightMm +
    (grid.rows - 1) * grid.verticalGapMm;
  const gridBottomMm = usedHeight;
  const { header, footer } = template.pageLayout;
  const footerTopMm = 297 - footer.bottomOffsetMm - footer.heightMm;

  if (!template.name.trim()) errors.push("Ein Vorlagenname ist erforderlich.");
  if (!Number.isInteger(grid.columns) || grid.columns < 1) errors.push("Mindestens eine Spalte ist erforderlich.");
  if (!Number.isInteger(grid.rows) || grid.rows < 1) errors.push("Mindestens eine Zeile ist erforderlich.");
  if ([grid.labelWidthMm, grid.labelHeightMm, grid.leftMarginMm, grid.topMarginMm, grid.horizontalGapMm, grid.verticalGapMm].some((value) => !Number.isFinite(value) || value < 0)) {
    errors.push("Rastermaße müssen nichtnegative Zahlen sein.");
  }
  if (usedWidth > 210 + 0.001 || usedHeight > 297 + 0.001) {
    errors.push("Das Etikettenraster passt nicht auf DIN A4.");
  }

  const validatePageText = (
    area: PageTextArea,
    topMm: number,
    label: string,
  ) => {
    if (
      !area.text.trim() &&
      area.leftMm === 0 &&
      area.widthMm === 0 &&
      area.heightMm === 0
    ) return;
    if ([area.leftMm, area.widthMm, area.heightMm, topMm].some((value) => !Number.isFinite(value) || value < 0)) {
      errors.push(`${label}: Position und Größe müssen nichtnegative Zahlen sein.`);
      return;
    }
    if (area.leftMm + area.widthMm > 210 + 0.001 || topMm + area.heightMm > 297 + 0.001) {
      errors.push(`${label} liegt außerhalb der DIN-A4-Seite.`);
    }
    if (area.heightMm > 0 && area.widthMm > 0 && topMm < gridBottomMm && topMm + area.heightMm > grid.topMarginMm) {
      errors.push(`${label} darf das Etikettenraster nicht überlappen.`);
    }
  };

  validatePageText(header, header.topOffsetMm, "Seitenkopf");
  validatePageText(footer, footerTopMm, "Seitenfuß");

  const validateElement = (element: PositionedElement, label: string) => {
    if ([element.xMm, element.yMm, element.widthMm, element.heightMm].some((value) => !Number.isFinite(value) || value < 0)) {
      errors.push(`${label}: Position und Größe müssen nichtnegative Zahlen sein.`);
      return;
    }
    if (element.xMm + element.widthMm > grid.labelWidthMm + 0.001 || element.yMm + element.heightMm > grid.labelHeightMm + 0.001) {
      errors.push(`${label} liegt außerhalb des Etiketts.`);
    }
  };

  validateElement(elements.qr, "QR-Code");
  validateElement(elements.text, "Freies Textfeld");
  validateElement(elements.tagIdText, "TAG-ID-Feld");

  if (Math.abs(elements.qr.widthMm - elements.qr.heightMm) > 0.001) errors.push("Der QR-Code muss quadratisch sein.");
  if (elements.qr.widthMm < 10) errors.push("Der QR-Code muss mindestens 10 mm groß sein.");

  const overlaps = (first: PositionedElement, second: PositionedElement): boolean =>
    first.xMm < second.xMm + second.widthMm &&
    first.xMm + first.widthMm > second.xMm &&
    first.yMm < second.yMm + second.heightMm &&
    first.yMm + first.heightMm > second.yMm;

  if (overlaps(elements.qr, elements.text)) errors.push("QR-Code und freies Textfeld dürfen sich nicht überlappen.");
  if (overlaps(elements.qr, elements.tagIdText)) errors.push("QR-Code und TAG-ID-Feld dürfen sich nicht überlappen.");
  if (overlaps(elements.text, elements.tagIdText)) errors.push("Freies Textfeld und TAG-ID-Feld dürfen sich nicht überlappen.");

  return errors.length ? { ok: false, errors } : { ok: true, value: template };
}

export function defaultTemplate(): LabelTemplate {
  const timestamp = now();
  return {
    id: makeId(),
    name: "A4 – 3 × 8 (Beispiel)",
    page: { widthMm: 210, heightMm: 297 },
    pageLayout: {
      header: { text: "", leftMm: 7, widthMm: 196, heightMm: 6, topOffsetMm: 3 },
      footer: { text: "", leftMm: 7, widthMm: 196, heightMm: 6, bottomOffsetMm: 3 },
    },
    grid: {
      columns: 3,
      rows: 8,
      labelWidthMm: 63.5,
      labelHeightMm: 33.9,
      leftMarginMm: 7,
      topMarginMm: 12,
      horizontalGapMm: 2.5,
      verticalGapMm: 0,
    },
    elements: {
    qr: { xMm: 2, yMm: 2, widthMm: 22, heightMm: 22, quietZoneModules: 4, errorCorrectionLevel: "M" },
      text: {
        xMm: 26,
        yMm: 3,
        widthMm: 34,
        heightMm: 16,
        fontFamily: "helvetica",
        fontSizePt: 9,
        fontStyle: "normal",
        fontWeight: "normal",
        horizontalAlign: "left",
        verticalAlign: "middle",
        lineHeight: 1.15,
        overflow: "shrink",
      },
      tagIdText: {
        xMm: 26,
        yMm: 20,
        widthMm: 34,
        heightMm: 8,
        fontFamily: "helvetica",
        fontSizePt: 11,
        fontStyle: "bold",
        fontWeight: "bold",
        horizontalAlign: "left",
        verticalAlign: "middle",
        lineHeight: 1.15,
        overflow: "shrink",
      },
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export interface PageCell {
  page: number;
  row: number;
  column: number;
  tag?: GeneratedTag;
}

export function paginateTags(
  tags: readonly GeneratedTag[],
  template: LabelTemplate,
  startRow: number,
  startColumn: number,
): PageCell[][] {
  const { rows, columns } = template.grid;
  if (!Number.isInteger(startRow) || !Number.isInteger(startColumn) || startRow < 1 || startColumn < 1 || startRow > rows || startColumn > columns) {
    throw new Error("Ungültige Startposition.");
  }

  const pages: PageCell[][] = [];
  let index = 0;
  let pageNumber = 1;

  while (index < tags.length || pages.length === 0) {
    const page: PageCell[] = [];
    const firstOffset = pageNumber === 1 ? (startRow - 1) * columns + (startColumn - 1) : 0;

    for (let slot = 0; slot < rows * columns; slot += 1) {
      const row = Math.floor(slot / columns) + 1;
      const column = (slot % columns) + 1;
      const tag = slot < firstOffset || index >= tags.length ? undefined : tags[index++];
      page.push({ page: pageNumber, row, column, tag });
    }

    pages.push(page);
    pageNumber += 1;
  }

  return pages;
}

export function safeConfiguration(config: TagGeneratorConfiguration): TagGeneratorConfiguration {
  return {
    ...config,
    ranges: config.ranges.map((range) => ({ ...range })),
    labelTemplates: config.labelTemplates.map((template) => structuredClone(template)),
  };
}

export function createConfigExport(config: TagGeneratorConfiguration): string {
  return JSON.stringify(safeConfiguration(config), null, 2);
}

export function createLabelTemplateExport(template: LabelTemplate): string {
  return JSON.stringify({
    schemaVersion: 1,
    kind: "myqr24.tag-generator.label-template",
    exportedAt: now(),
    template: structuredClone(template),
  } satisfies LabelTemplateExport, null, 2);
}

export function parseLabelTemplateExport(input: string): ValidationResult<LabelTemplate> {
  try {
    const raw = JSON.parse(input) as Partial<LabelTemplateExport>;
    if (raw.kind !== "myqr24.tag-generator.label-template" || raw.schemaVersion !== 1 || !raw.template) {
      return { ok: false, errors: ["Die Datei ist keine gültige Etikettenvorlage der Version 1."] };
    }
    const migrated = migrateTemplate(raw.template as LabelTemplate);
    const result = validateTemplate(migrated);
    return result.ok ? { ok: true, value: { ...result.value, id: makeId(), createdAt: now(), updatedAt: now() } } : result;
  } catch {
    return { ok: false, errors: ["Die Vorlagendatei ist kein gültiges JSON."] };
  }
}

function migrateTemplate(template: LabelTemplate): LabelTemplate {
  const defaults = defaultTemplate();
  const tagIdText = template.elements.tagIdText ?? {
    ...defaults.elements.tagIdText,
    xMm: template.elements.text.xMm,
    yMm: Math.min(
      template.grid.labelHeightMm - defaults.elements.tagIdText.heightMm,
      template.elements.text.yMm + Math.max(0, template.elements.text.heightMm - defaults.elements.tagIdText.heightMm),
    ),
    widthMm: template.elements.text.widthMm,
  };

  const migrateTextElement = <T extends LabelTemplate["elements"]["text"] | LabelTemplate["elements"]["tagIdText"]>(element: T): T => ({
    ...element,
    fontFamily: element.fontFamily === "times-roman" || element.fontFamily === "courier" ? element.fontFamily : "helvetica",
    fontStyle:
      element.fontStyle === "bold" || element.fontStyle === "italic" || element.fontStyle === "bold-italic"
        ? element.fontStyle
        : element.fontWeight === "bold" ? "bold" : "normal",
  });

  return {
    ...template,
    pageLayout: template.pageLayout ?? defaults.pageLayout,
    elements: {
      ...template.elements,
      text: migrateTextElement(template.elements.text),
      tagIdText: migrateTextElement(tagIdText),
    },
  };
}

export function parseConfigExport(input: string): ValidationResult<TagGeneratorConfiguration> {
  try {
    const raw = JSON.parse(input) as Partial<TagGeneratorConfiguration>;
    if (raw.kind !== "myqr24.tag-generator.config" || raw.schemaVersion !== 1 || !Array.isArray(raw.ranges) || !Array.isArray(raw.labelTemplates) || typeof raw.name !== "string" || typeof raw.baseUrl !== "string") {
      return { ok: false, errors: ["Die Datei ist keine gültige TAG-Generator-Konfiguration der Version 1."] };
    }
    const baseUrl = validateBaseUrl(raw.baseUrl);
    if (!baseUrl.ok) return baseUrl;
    const fallbackProfile = raw.defaultQrProfile && typeof raw.defaultQrProfile === "object"
      ? raw.defaultQrProfile as QrProfile
      : defaultQrProfile();
    const defaultQr = validateQrProfile(fallbackProfile);
    if (!defaultQr.ok) return defaultQr;
    const ranges: TagRangeDefinition[] = [];
    for (const item of raw.ranges) {
      const migratedRange = { ...(item as Omit<TagRangeDefinition, "createdAt" | "updatedAt">), qrProfile: (item as TagRangeDefinition).qrProfile ?? defaultQr.value };
      const result = validateRange(migratedRange, ranges);
      if (!result.ok) return result;
      ranges.push(result.value);
    }
    const templates: LabelTemplate[] = [];
    for (const item of raw.labelTemplates) {
      const result = validateTemplate(migrateTemplate(item as LabelTemplate));
      if (!result.ok) return result;
      templates.push(result.value);
    }
    return {
      ok: true,
      value: {
        schemaVersion: 1,
        kind: "myqr24.tag-generator.config",
        name: raw.name,
        updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : now(),
        baseUrl: baseUrl.value,
        inputLocale: raw.inputLocale === "en-US" ? "en-US" : "de-DE",
        qrIdCase: raw.qrIdCase === "upper" ? "upper" : "lower",
        defaultQrProfile: defaultQr.value,
        ranges,
        labelTemplates: templates,
        selectedTemplateId: typeof raw.selectedTemplateId === "string" ? raw.selectedTemplateId : undefined,
        printSettings: raw.printSettings,
      },
    };
  } catch {
    return { ok: false, errors: ["Die Konfigurationsdatei ist kein gültiges JSON."] };
  }
}
