import { byteLength, canonicalize } from "./canonical";
import {
  BREAKPOINTS,
  COLOR_TOKENS,
  CSS_URL,
  DATA_URL,
  ELEMENT_ID,
  ELEMENT_ITEMS,
  ELEMENT_TYPE_TAG_TYPES,
  ELEMENT_TYPES,
  EVENT_HANDLER,
  FEATURES,
  FONT_FAMILIES,
  FONT_SIZES,
  HEADING_LEVELS,
  HEX_COLOR,
  HIDDEN_ELEMENT_TYPES,
  HTML_MARKUP,
  ITEM_MODES,
  LINE_HEIGHTS,
  LINK_TARGET,
  LIST_KINDS,
  MAX_ELEMENTS,
  MAX_HEADING_LENGTH,
  MAX_INDENT,
  MAX_ITEMS_PER_SLOT,
  MAX_LIST_LEVEL,
  MAX_PARAGRAPHS,
  MAX_SLOTS_PER_ELEMENT,
  MAX_TABLE_CELL_LENGTH,
  MAX_TABLE_COLUMNS,
  MAX_TABLE_ROWS,
  MAX_TABLES,
  MAX_TEMPLATE_BYTES,
  MAX_TEXT_LENGTH,
  PADDINGS,
  PRINCIPALS,
  PRESENTATIONS,
  REM_VALUE,
  SCHEMA_VERSION,
  SCRIPT_URL,
  SLOT_ACCEPTS,
  SLOT_ID,
  STORAGE_KEY_NAMES,
  TABLE_BORDER_STYLES,
  TABLE_BORDER_WIDTHS,
  TAG_TYPE_FEATURES,
  TAG_TYPES,
  TEMPLATE_ID,
  TEMPLATE_SCHEMA,
  TEMPLATE_STATUS,
  VISIBILITIES,
  type ElementType,
  type ElementItems,
  type Feature,
  type ItemMode,
  type Presentation,
  type TagType,
  type Visibility,
} from "./limits";

export interface TemplateIssue {
  code: string;
  path: string;
  message: string;
}

export interface VSlot {
  slotId: string;
  accepts: string[];
  min: number;
  max: number;
  required: boolean;
  presentation?: Record<string, unknown>;
}

export interface VPlacement {
  span: Record<string, number>;
  order?: Record<string, number>;
  minWidth?: string;
  align?: "start" | "stretch" | "center";
  hint?: string;
}

export interface VElement {
  elementId: string;
  elementType: ElementType;
  displayOrder: number;
  placement?: VPlacement;
  visibility: Visibility;
  hidden: boolean;
  /** Item-Fähigkeit; `dynamic` erzeugt beim Publish eine Elementzeile. */
  items: ElementItems;
  payload: Record<string, unknown>;
  style?: Record<string, unknown>;
  content?: Record<string, unknown>;
  slots: VSlot[];
  actions?: Record<string, unknown>;
  bindings?: Record<string, unknown>;
  copy?: Record<string, unknown>;
  editability?: Record<string, unknown>;
}

export interface VDocument {
  schemaVersion: number;
  template: {
    templateId: string;
    templateVersion: number;
    tagType: TagType;
    name: string;
    description?: string;
    locale: string;
    status: string;
  };
  shell: {
    presentation: Presentation;
    features: Feature[];
    theme?: Record<string, unknown>;
  };
  layout: Record<string, unknown>;
  elements: VElement[];
}

export interface ValidationResult {
  document: VDocument | null;
  issues: TemplateIssue[];
}

export const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === "string";
const isInteger = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value);
const inList = (value: unknown, list: readonly string[]): boolean => typeof value === "string" && list.includes(value);
const isHexOrToken = (value: unknown): boolean =>
  typeof value === "string" && (HEX_COLOR.test(value) || COLOR_TOKENS.has(value));

const MAX_ISSUES = 200;

class Issues {
  readonly items: TemplateIssue[] = [];
  add(code: string, path: string, message: string): void {
    if (this.items.length < MAX_ISSUES) this.items.push({ code, path, message });
  }
  get count(): number {
    return this.items.length;
  }
}

const textLength = (value: unknown): number =>
  Array.isArray(value)
    ? value.reduce((sum, item) => {
        if (!isObject(item)) return sum;
        const text = isString(item.text) ? item.text.length : 0;
        const lineBreak = item.type === "hardBreak" ? 1 : 0;
        return sum + text + lineBreak;
      }, 0)
    : 0;

/** Policy-Scan über alle Strings und Schlüssel; verhindert HTML/CSS/JS-Übernahme. */
function scanPolicy(value: unknown, path: string, issues: Issues, depth = 0): void {
  if (depth > 12) return;
  if (typeof value === "string") {
    if (HTML_MARKUP.test(value)) issues.add("POLICY_HTML_MARKUP", path, "HTML-Markup ist nicht erlaubt.");
    if (SCRIPT_URL.test(value)) issues.add("POLICY_SCRIPT_URL", path, "javascript:-Ziele sind nicht erlaubt.");
    if (DATA_URL.test(value)) issues.add("POLICY_DATA_URL", path, "data:-Ziele sind nicht erlaubt.");
    if (CSS_URL.test(value)) issues.add("POLICY_CSS_URL", path, "CSS-url() ist nicht erlaubt.");
    if (EVENT_HANDLER.test(value)) issues.add("POLICY_EVENT_HANDLER", path, "Event-Handler sind nicht erlaubt.");
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanPolicy(entry, `${path}[${index}]`, issues, depth + 1));
    return;
  }
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (STORAGE_KEY_NAMES.has(key)) {
      issues.add("POLICY_STORAGE_KEY", `${path}.${key}`, "Storage-Keys gehören nicht in ein Template.");
      continue;
    }
    scanPolicy(child, `${path}.${key}`, issues, depth + 1);
  }
}

function validateRuns(runs: unknown, path: string, issues: Issues): number {
  if (!Array.isArray(runs) || runs.length === 0) {
    issues.add("CONTENT_RUN_INVALID", path, "Text braucht mindestens einen Run.");
    return 0;
  }
  let total = 0;
  runs.forEach((run, index) => {
    const runPath = `${path}[${index}]`;
    if (!isObject(run) || !isString(run.text)) {
      issues.add("CONTENT_RUN_INVALID", runPath, "Run braucht ein text-Feld.");
      return;
    }
    total += run.text.length;
    if (run.marks !== undefined) {
      if (!Array.isArray(run.marks)) {
        issues.add("CONTENT_MARKS_INVALID", `${runPath}.marks`, "marks muss ein Array sein.");
      } else {
        for (const mark of run.marks) {
          if (!isObject(mark) || !inList(mark.type, ["bold", "italic", "underline"])) {
            issues.add("CONTENT_MARK_UNKNOWN", `${runPath}.marks`, "Unbekannte Mark.");
          }
        }
      }
    }
    for (const field of ["color", "background"] as const) {
      const value = run[field];
      if (value !== undefined && (typeof value !== "string" || !HEX_COLOR.test(value))) {
        issues.add("STYLE_COLOR_INVALID", `${runPath}.${field}`, "Farbe muss #rrggbb sein.");
      }
    }
    if (run.fontSize !== undefined && !(FONT_SIZES as readonly number[]).includes(run.fontSize as number)) {
      issues.add("CONTENT_RUN_FONT_FAMILY_INVALID", `${runPath}.fontSize`, "Schriftgröße außerhalb der Skala.");
    }
    if (run.fontFamily !== undefined && !inList(run.fontFamily, FONT_FAMILIES)) {
      issues.add("CONTENT_RUN_FONT_FAMILY_INVALID", `${runPath}.fontFamily`, "Unbekannte Schriftfamilie.");
    }
    if (run.link !== undefined) {
      if (!isObject(run.link) || !isString(run.link.href) || !LINK_TARGET.test(run.link.href)) {
        issues.add("BINDING_INVALID", `${runPath}.link`, "Links nur https: oder mailto:.");
      }
    }
  });
  return total;
}

function validateTable(block: Record<string, unknown>, path: string, issues: Issues): void {
  const columns = block.columns;
  if (!Array.isArray(columns) || columns.length < 1 || columns.length > MAX_TABLE_COLUMNS) {
    issues.add("TABLE_COLUMNS_INVALID", `${path}.columns`, `Tabelle braucht 1–${MAX_TABLE_COLUMNS} Spalten.`);
    return;
  }
  columns.forEach((column, index) => {
    if (isObject(column) && column.align !== undefined && !inList(column.align, ["start", "center", "end"])) {
      issues.add("TABLE_ALIGN_INVALID", `${path}.columns[${index}].align`, "Unbekannte Ausrichtung.");
    }
  });
  const rows = block.rows;
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > MAX_TABLE_ROWS) {
    issues.add("TABLE_ROWS_INVALID", `${path}.rows`, `Tabelle braucht 1–${MAX_TABLE_ROWS} Zeilen.`);
    return;
  }
  rows.forEach((row, rowIndex) => {
    const rowPath = `${path}.rows[${rowIndex}]`;
    if (!isObject(row) || !Array.isArray(row.cells) || row.cells.length !== columns.length) {
      issues.add("TABLE_ROW_INVALID", rowPath, "Jede Zeile muss so viele Zellen wie Spalten haben.");
      return;
    }
    row.cells.forEach((cell, cellIndex) => {
      const cellPath = `${rowPath}.cells[${cellIndex}]`;
      if (!isObject(cell)) {
        issues.add("TABLE_ROW_INVALID", cellPath, "Zelle muss ein Objekt sein.");
        return;
      }
      const length = validateRuns(cell.runs, `${cellPath}.runs`, issues);
      if (length > MAX_TABLE_CELL_LENGTH) {
        issues.add("TABLE_CELL_TOO_LONG", cellPath, `Zelle überschreitet ${MAX_TABLE_CELL_LENGTH} Zeichen.`);
      }
      const background = cell.background;
      if (background !== undefined && (typeof background !== "string" || !HEX_COLOR.test(background))) {
        issues.add("STYLE_COLOR_INVALID", `${cellPath}.background`, "Zellhintergrund muss #rrggbb sein.");
      }
    });
  });
  if (block.border !== undefined) {
    const border = block.border;
    if (!isObject(border)
      || typeof border.color !== "string"
      || !HEX_COLOR.test(border.color)
      || !inList(border.style, TABLE_BORDER_STYLES)
      || !(TABLE_BORDER_WIDTHS as readonly number[]).includes(border.width as number)) {
      issues.add("TABLE_ROW_INVALID", `${path}.border`, "Rahmen braucht Farbe, Stil und Stärke.");
    }
  }
}

function validateRichText(content: unknown, path: string, issues: Issues): void {
  if (content === undefined) return;
  if (!isObject(content)) {
    issues.add("CONTENT_INVALID", path, "content muss ein Objekt sein.");
    return;
  }
  if (content.heading !== undefined) {
    issues.add("CONTENT_HEADING_INVALID", `${path}.heading`, "Überschriften stehen im Absatz (schemaVersion 2+).");
  }
  const blocks = content.paragraphs;
  if (blocks === undefined) return;
  if (!Array.isArray(blocks)) {
    issues.add("CONTENT_PARAGRAPHS_INVALID", `${path}.paragraphs`, "paragraphs muss ein Array sein.");
    return;
  }
  if (blocks.length > MAX_PARAGRAPHS) {
    issues.add("CONTENT_PARAGRAPHS_LIMIT", `${path}.paragraphs`, `Maximal ${MAX_PARAGRAPHS} Absätze.`);
  }
  let tables = 0;
  blocks.forEach((block, index) => {
    const blockPath = `${path}.paragraphs[${index}]`;
    if (!isObject(block)) {
      issues.add("CONTENT_PARAGRAPH_INVALID", blockPath, "Block muss ein Objekt sein.");
      return;
    }
    if (block.type === "table") {
      tables += 1;
      if (tables > MAX_TABLES) {
        issues.add("CONTENT_PARAGRAPHS_LIMIT", blockPath, `Maximal ${MAX_TABLES} Tabellen je Textfeld.`);
      }
      validateTable(block, blockPath, issues);
      return;
    }
    const length = validateRuns(block.runs, `${blockPath}.runs`, issues);
    if (block.heading !== undefined) {
      if (!(HEADING_LEVELS as readonly number[]).includes(block.heading as number)) {
        issues.add("CONTENT_HEADING_INVALID", `${blockPath}.heading`, "Überschrift 1–5.");
      }
      if (length > MAX_HEADING_LENGTH) {
        issues.add("CONTENT_TEXT_LIMIT", blockPath, `Überschrift überschreitet ${MAX_HEADING_LENGTH} Zeichen.`);
      }
      if (block.list !== undefined) {
        issues.add("CONTENT_PARAGRAPH_INVALID", `${blockPath}.heading`, "Überschrift und Liste schließen sich aus.");
      }
    } else if (length > MAX_TEXT_LENGTH) {
      issues.add("CONTENT_TEXT_LIMIT", blockPath, `Absatz überschreitet ${MAX_TEXT_LENGTH} Zeichen.`);
    }
    if (block.align !== undefined && !inList(block.align, ["start", "center", "end"])) {
      issues.add("CONTENT_PARAGRAPH_ALIGN_INVALID", `${blockPath}.align`, "Unbekannte Ausrichtung.");
    }
    if (block.lineHeight !== undefined && !(LINE_HEIGHTS as readonly number[]).includes(block.lineHeight as number)) {
      issues.add("CONTENT_PARAGRAPH_INVALID", `${blockPath}.lineHeight`, "Zeilenabstand außerhalb der Skala.");
    }
    if (block.indent !== undefined && (!isInteger(block.indent) || block.indent < 0 || block.indent > MAX_INDENT)) {
      issues.add("CONTENT_PARAGRAPH_INVALID", `${blockPath}.indent`, `Einrückung 0–${MAX_INDENT}.`);
    }
    if (block.list !== undefined) {
      if (!isObject(block.list)
        || !inList(block.list.kind, LIST_KINDS)
        || !isInteger(block.list.level)
        || block.list.level < 0
        || block.list.level > MAX_LIST_LEVEL) {
        issues.add("CONTENT_PARAGRAPH_INVALID", `${blockPath}.list`, `Liste braucht kind und level 0–${MAX_LIST_LEVEL}.`);
      }
    }
  });
}

function validateStyle(style: unknown, path: string, issues: Issues): void {
  if (style === undefined) return;
  if (!isObject(style)) {
    issues.add("STYLE_INVALID", path, "style muss ein Objekt sein.");
    return;
  }
  if (style.background !== undefined) {
    const background = style.background;
    if (!isObject(background)
      || background.type !== "solid"
      || typeof background.color !== "string"
      || !isHexOrToken(background.color)) {
      issues.add("STYLE_BACKGROUND_INVALID", `${path}.background`, "Hintergrund braucht type solid und eine Farbe.");
    }
  }
  for (const field of ["headingColor", "textColor"] as const) {
    if (style[field] !== undefined && !isHexOrToken(style[field])) {
      issues.add("STYLE_COLOR_INVALID", `${path}.${field}`, "Farbe muss #rrggbb oder ein Theme-Token sein.");
    }
  }
  if (style.padding !== undefined && !inList(style.padding, PADDINGS)) {
    issues.add("STYLE_PADDING_INVALID", `${path}.padding`, "Unbekannter Innenabstand.");
  }
  if (style.align !== undefined && !inList(style.align, ["start", "center"])) {
    issues.add("STYLE_INVALID", `${path}.align`, "Unbekannte Ausrichtung.");
  }
}

function validateSlots(slots: unknown, path: string, issues: Issues): VSlot[] {
  if (slots === undefined) return [];
  if (!Array.isArray(slots)) {
    issues.add("SLOTS_INVALID", path, "slots muss ein Array sein.");
    return [];
  }
  if (slots.length > MAX_SLOTS_PER_ELEMENT) {
    issues.add("SLOTS_LIMIT", path, `Maximal ${MAX_SLOTS_PER_ELEMENT} Slots je Element.`);
  }
  const result: VSlot[] = [];
  const seen = new Set<string>();
  slots.forEach((slot, index) => {
    const slotPath = `${path}[${index}]`;
    if (!isObject(slot)) {
      issues.add("SLOT_INVALID", slotPath, "Slot muss ein Objekt sein.");
      return;
    }
    const slotId = slot.slotId;
    if (typeof slotId !== "string" || !SLOT_ID.test(slotId)) {
      issues.add("SLOT_ID_INVALID", `${slotPath}.slotId`, "slotId ist ungültig.");
      return;
    }
    if (seen.has(slotId)) {
      issues.add("SLOT_ID_DUPLICATE", `${slotPath}.slotId`, `slotId ${slotId} ist doppelt.`);
      return;
    }
    seen.add(slotId);

    const accepts = slot.accepts;
    if (!Array.isArray(accepts) || accepts.length === 0 || accepts.some((entry) => !inList(entry, SLOT_ACCEPTS))) {
      issues.add("SLOT_ACCEPTS_INVALID", `${slotPath}.accepts`, "accepts braucht image/document/audio.");
      return;
    }
    const min = slot.min;
    const max = slot.max;
    if (!isInteger(min) || min < 0 || min > MAX_ITEMS_PER_SLOT) {
      issues.add("SLOT_MIN_INVALID", `${slotPath}.min`, `min muss 0–${MAX_ITEMS_PER_SLOT} sein.`);
      return;
    }
    if (!isInteger(max) || max < 1 || max > MAX_ITEMS_PER_SLOT) {
      issues.add("SLOT_MAX_INVALID", `${slotPath}.max`, `max muss 1–${MAX_ITEMS_PER_SLOT} sein.`);
      return;
    }
    if (min > max) {
      issues.add("SLOT_RANGE_INVALID", slotPath, "min darf max nicht überschreiten.");
    }
    if (typeof slot.required !== "boolean") {
      issues.add("SLOT_REQUIRED_INVALID", `${slotPath}.required`, "required muss boolean sein.");
    } else if (slot.required && min < 1) {
      issues.add("SLOT_REQUIRED_WITHOUT_MIN", `${slotPath}.required`, "Pflicht-Slot braucht min ≥ 1.");
    }

    let presentation: Record<string, unknown> | undefined;
    if (slot.presentation !== undefined) {
      if (!isObject(slot.presentation)) {
        issues.add("SLOT_INVALID", `${slotPath}.presentation`, "presentation muss ein Objekt sein.");
      } else {
        const source = slot.presentation;
        if (source.fit !== undefined && !inList(source.fit, ["cover", "contain"])) {
          issues.add("SLOT_INVALID", `${slotPath}.presentation.fit`, "fit nur cover/contain.");
        }
        if (source.caption !== undefined && !inList(source.caption, ["none", "optional", "required"])) {
          issues.add("SLOT_INVALID", `${slotPath}.presentation.caption`, "caption nur none/optional/required.");
        }
        if (source.downloadable !== undefined && typeof source.downloadable !== "boolean") {
          issues.add("SLOT_INVALID", `${slotPath}.presentation.downloadable`, "downloadable muss boolean sein.");
        }
        presentation = source;
      }
    }

    result.push({
      slotId,
      accepts: accepts as string[],
      min,
      max,
      required: slot.required === true,
      ...(presentation ? { presentation } : {}),
    });
  });
  return result;
}

function validateActions(actions: unknown, path: string, issues: Issues): Record<string, unknown> | undefined {
  if (actions === undefined) return undefined;
  if (!isObject(actions)) {
    issues.add("ACTIONS_INVALID", path, "actions muss ein Objekt sein.");
    return undefined;
  }
  for (const key of ["upload", "download", "delete"] as const) {
    const rule = actions[key];
    if (rule === undefined) continue;
    const rulePath = `${path}.${key}`;
    if (!isObject(rule)) {
      issues.add("ACTION_RULE_INVALID", rulePath, "Regel muss ein Objekt sein.");
      continue;
    }
    if (typeof rule.enabled !== "boolean") {
      issues.add("ACTION_ENABLED_INVALID", `${rulePath}.enabled`, "enabled muss boolean sein.");
    }
    if (rule.principals !== undefined) {
      if (!Array.isArray(rule.principals) || rule.principals.length === 0) {
        issues.add("ACTION_PRINCIPALS_INVALID", `${rulePath}.principals`, "principals muss ein nicht leeres Array sein.");
      } else {
        for (const principal of rule.principals) {
          if (!inList(principal, PRINCIPALS)) {
            issues.add("ACTION_PRINCIPAL_UNKNOWN", `${rulePath}.principals`, "Unbekannte Rolle.");
          }
        }
      }
    }
    if (rule.acceptedTypes !== undefined) {
      if (!Array.isArray(rule.acceptedTypes) || rule.acceptedTypes.some((entry) => !inList(entry, SLOT_ACCEPTS))) {
        issues.add("ACTION_RULE_INVALID", `${rulePath}.acceptedTypes`, "acceptedTypes braucht image/document/audio.");
      }
    }
    const maxItems = rule.maxItemsPerPrincipal;
    if (maxItems !== undefined
      && (!isInteger(maxItems) || maxItems < 1 || maxItems > MAX_ITEMS_PER_SLOT)) {
      issues.add("ACTION_RULE_INVALID", `${rulePath}.maxItemsPerPrincipal`, `1–${MAX_ITEMS_PER_SLOT}.`);
    }
    const maxSize = rule.maxFileSizeMb;
    if (maxSize !== undefined && (!isInteger(maxSize) || maxSize < 1 || maxSize > 100)) {
      issues.add("ACTION_RULE_INVALID", `${rulePath}.maxFileSizeMb`, "maxFileSizeMb 1–100.");
    }
    if (rule.afterUpload !== undefined && !inList(rule.afterUpload, ["quarantine", "ready"])) {
      issues.add("ACTION_RULE_INVALID", `${rulePath}.afterUpload`, "afterUpload nur quarantine/ready.");
    }
    if (rule.guestScope !== undefined && rule.guestScope !== "ownOnly") {
      issues.add("ACTION_GUEST_SCOPE_INVALID", `${rulePath}.guestScope`, "guestScope nur ownOnly.");
    }
  }
  return actions;
}

function validateBindings(bindings: unknown, path: string, issues: Issues): Record<string, unknown> | undefined {
  if (bindings === undefined) return undefined;
  if (!isObject(bindings)) {
    issues.add("BINDINGS_INVALID", path, "bindings muss ein Objekt sein.");
    return undefined;
  }
  for (const [key, value] of Object.entries(bindings)) {
    if (!isObject(value) || !isString(value.from) || !/^tag\.[a-zA-Z]+$/.test(value.from)) {
      issues.add("BINDING_INVALID", `${path}.${key}`, "Unbekannte Bindungsquelle.");
    }
  }
  return bindings;
}

/**
 * Prüft `element.items` gegen den Katalog. Fehlt der Block, wird der
 * Katalog-Standard übernommen – so bleiben Templates ohne Angabe gültig, das
 * Ergebnis ist aber deterministisch (Quelle: `ELEMENT_ITEMS`).
 */
function validateItems(
  input: unknown,
  path: string,
  elementType: ElementType,
  slots: VSlot[],
  issues: Issues,
): ElementItems {
  const fallback: ElementItems = structuredClone(ELEMENT_ITEMS[elementType]);
  if (input === undefined) return fallback;
  if (!isObject(input)) {
    issues.add("ELEMENT_ITEMS_INVALID", path, "items muss ein Objekt sein.");
    return fallback;
  }
  const mode = input.mode;
  if (typeof mode !== "string" || !(ITEM_MODES as readonly string[]).includes(mode)) {
    issues.add("ELEMENT_ITEMS_MODE_INVALID", `${path}.mode`, 'mode muss "none" oder "dynamic" sein.');
    return fallback;
  }
  if (mode !== ELEMENT_ITEMS[elementType].mode) {
    issues.add(
      "ELEMENT_ITEMS_MODE_MISMATCH",
      `${path}.mode`,
      `Der Elementtyp erwartet mode "${ELEMENT_ITEMS[elementType].mode}".`,
    );
  }

  const declared = slots.map((slot) => slot.slotId);
  const seen = new Set<string>();
  const slotIds: string[] = [];
  if (input.slotIds !== undefined) {
    if (!Array.isArray(input.slotIds)) {
      issues.add("ELEMENT_ITEMS_SLOT_INVALID", `${path}.slotIds`, "slotIds muss ein Array sein.");
    } else {
      for (const slotId of input.slotIds) {
        if (typeof slotId !== "string" || !declared.includes(slotId)) {
          issues.add("ELEMENT_ITEMS_SLOT_UNKNOWN", `${path}.slotIds`, `Unbekannter Slot: ${String(slotId)}`);
        } else if (seen.has(slotId)) {
          issues.add("ELEMENT_ITEMS_SLOT_DUPLICATE", `${path}.slotIds`, `slotId ${slotId} ist doppelt.`);
        } else {
          seen.add(slotId);
          slotIds.push(slotId);
        }
      }
    }
  } else if (mode === "dynamic") {
    slotIds.push(...(ELEMENT_ITEMS[elementType].slotIds ?? []));
  }

  return {
    mode: mode as ItemMode,
    ...(slotIds.length > 0 ? { slotIds } : {}),
  };
}

function validateElement(
  element: unknown,
  index: number,
  tagType: TagType,
  issues: Issues,
  ids: Set<string>,
  orders: Set<number>,
): VElement | null {
  const path = `elements[${index}]`;
  if (!isObject(element)) {
    issues.add("ELEMENT_INVALID", path, "Element muss ein Objekt sein.");
    return null;
  }
  const elementId = element.elementId;
  if (typeof elementId !== "string" || !ELEMENT_ID.test(elementId)) {
    issues.add("ELEMENT_ID_INVALID", `${path}.elementId`, "Erlaubt: cel_[A-Za-z0-9_-]{1,120}.");
    return null;
  }
  if (ids.has(elementId)) {
    issues.add("ELEMENT_ID_DUPLICATE", `${path}.elementId`, `elementId ${elementId} ist doppelt.`);
    return null;
  }
  ids.add(elementId);

  const elementType = element.elementType;
  if (typeof elementType !== "string" || !(ELEMENT_TYPES as readonly string[]).includes(elementType)) {
    issues.add("ELEMENT_TYPE_UNKNOWN", `${path}.elementType`, `Unbekannter Elementtyp: ${String(elementType)}`);
    return null;
  }
  const type = elementType as ElementType;
  if (!ELEMENT_TYPE_TAG_TYPES[type].includes(tagType)) {
    issues.add("ELEMENT_TYPE_NOT_ALLOWED", `${path}.elementType`, `${type} ist für ${tagType} nicht zulässig.`);
  }

  const displayOrder = element.displayOrder;
  if (!isInteger(displayOrder) || displayOrder < 0) {
    issues.add("ELEMENT_ORDER_INVALID", `${path}.displayOrder`, "displayOrder muss ≥ 0 sein.");
  } else if (orders.has(displayOrder)) {
    issues.add("ELEMENT_ORDER_DUPLICATE", `${path}.displayOrder`, `displayOrder ${displayOrder} ist doppelt.`);
  } else {
    orders.add(displayOrder);
  }

  const visibility = element.visibility;
  if (!inList(visibility, VISIBILITIES)) {
    issues.add("ELEMENT_VISIBILITY_INVALID", `${path}.visibility`, "Unbekannte Sichtbarkeit.");
  }
  if (element.hidden !== undefined && typeof element.hidden !== "boolean") {
    issues.add("ELEMENT_HIDDEN_INVALID", `${path}.hidden`, "hidden muss boolean sein.");
  }
  let placement: VPlacement | undefined;
  if (element.placement !== undefined) {
    const placementValue = element.placement;
    const placementPath = `${path}.placement`;
    const validBreakpoints = BREAKPOINTS as readonly string[];
    const columns = isObject(element.placement) ? element.placement.span : undefined;
    if (!isObject(placementValue) || !isObject(columns)) {
      issues.add("ELEMENT_PLACEMENT_INVALID", placementPath, "placement.span muss Spalten je Breakpoint enthalten.");
    } else {
      const span: Record<string, number> = {};
      for (const [breakpoint, value] of Object.entries(columns)) {
        if (!validBreakpoints.includes(breakpoint) || !isInteger(value) || value < 1 || value > 12) {
          issues.add("ELEMENT_PLACEMENT_SPAN_INVALID", `${placementPath}.span.${breakpoint}`, "Spaltenbreite muss 1–12 betragen.");
        } else span[breakpoint] = value;
      }
      let order: Record<string, number> | undefined;
      if (placementValue.order !== undefined) {
        if (!isObject(placementValue.order)) {
          issues.add("ELEMENT_PLACEMENT_ORDER_INVALID", `${placementPath}.order`, "order muss Ganzzahlen je Breakpoint enthalten.");
        } else {
          order = {};
          for (const [breakpoint, value] of Object.entries(placementValue.order)) {
            if (!validBreakpoints.includes(breakpoint) || !isInteger(value) || value < 0) {
              issues.add("ELEMENT_PLACEMENT_ORDER_INVALID", `${placementPath}.order.${breakpoint}`, "order muss eine nichtnegative Ganzzahl sein.");
            } else order[breakpoint] = value;
          }
        }
      }
      const minWidth = placementValue.minWidth;
      if (minWidth !== undefined && (typeof minWidth !== "string" || !REM_VALUE.test(minWidth))) {
        issues.add("ELEMENT_PLACEMENT_MIN_WIDTH_INVALID", `${placementPath}.minWidth`, "minWidth muss in rem angegeben sein.");
      }
      const align = placementValue.align;
      if (align !== undefined && align !== "start" && align !== "stretch" && align !== "center") {
        issues.add("ELEMENT_PLACEMENT_ALIGN_INVALID", `${placementPath}.align`, "align muss start, stretch oder center sein.");
      }
      const hint = placementValue.hint;
      if (hint !== undefined && (typeof hint !== "string" || hint.length > 200)) {
        issues.add("ELEMENT_PLACEMENT_HINT_INVALID", `${placementPath}.hint`, "hint darf höchstens 200 Zeichen enthalten.");
      }
      placement = {
        span,
        ...(order ? { order } : {}),
        ...(typeof minWidth === "string" && REM_VALUE.test(minWidth) ? { minWidth } : {}),
        ...(align === "start" || align === "stretch" || align === "center" ? { align } : {}),
        ...(typeof hint === "string" && hint.length <= 200 ? { hint } : {}),
      };
    }
  }
  const payload = element.payload;
  if (!isObject(payload)) {
    issues.add("PAYLOAD_INVALID", `${path}.payload`, "payload muss ein Objekt sein.");
  }

  validateStyle(element.style, `${path}.style`, issues);
  validateRichText(element.content, `${path}.content`, issues);
  const slots = validateSlots(element.slots, `${path}.slots`, issues);
  const items = validateItems(element.items, `${path}.items`, type, slots, issues);
  const actions = validateActions(element.actions, `${path}.actions`, issues);
  const bindings = validateBindings(element.bindings, `${path}.bindings`, issues);

  return {
    elementId,
    elementType: type,
    displayOrder: isInteger(displayOrder) && displayOrder >= 0 ? displayOrder : index,
    ...(placement ? { placement } : {}),
    visibility: (inList(visibility, VISIBILITIES) ? visibility : "public") as Visibility,
    hidden: element.hidden === true || HIDDEN_ELEMENT_TYPES.includes(type),
    items,
    payload: isObject(payload) ? payload : {},
    ...(isObject(element.style) ? { style: element.style } : {}),
    ...(isObject(element.content) ? { content: element.content } : {}),
    slots,
    ...(actions ? { actions } : {}),
    ...(bindings ? { bindings } : {}),
    ...(isObject(element.copy) ? { copy: element.copy } : {}),
    ...(isObject(element.editability) ? { editability: element.editability } : {}),
  };
}

/**
 * Prüft ein TAG-Content-Template vollständig (fail-closed). Bei Fehlern wird
 * `document = null` geliefert; der Aufrufer darf dann nichts schreiben.
 */
export function validateTemplate(input: unknown): ValidationResult {
  const issues = new Issues();
  if (!isObject(input)) {
    issues.add("DOCUMENT_NOT_AN_OBJECT", "", "Die Datei enthält kein JSON-Objekt.");
    return { document: null, issues: issues.items };
  }
  if (input.schema !== TEMPLATE_SCHEMA) {
    issues.add("TEMPLATE_SCHEMA_UNKNOWN", "schema", `Erwartet wird ${TEMPLATE_SCHEMA}.`);
  }
  if (input.schemaVersion !== SCHEMA_VERSION) {
    issues.add("TEMPLATE_SCHEMA_VERSION_UNSUPPORTED", "schemaVersion", `Erwartet wird schemaVersion ${SCHEMA_VERSION}.`);
  }

  const meta = input.template;
  if (!isObject(meta)) {
    issues.add("TEMPLATE_MISSING", "template", "template fehlt.");
    return { document: null, issues: issues.items };
  }
  if (typeof meta.templateId !== "string" || !TEMPLATE_ID.test(meta.templateId)) {
    issues.add("TEMPLATE_ID_INVALID", "template.templateId", "Erlaubt: [a-z][a-z0-9_]{2,63}.");
  }
  if (!isInteger(meta.templateVersion) || meta.templateVersion < 1) {
    issues.add("TEMPLATE_VERSION_INVALID", "template.templateVersion", "templateVersion muss ≥ 1 sein.");
  }
  const tagType = meta.tagType;
  if (typeof tagType !== "string" || !(TAG_TYPES as readonly string[]).includes(tagType)) {
    issues.add("TAG_TYPE_INVALID", "template.tagType", `Unbekannter TAG-Typ: ${String(tagType)}`);
  }
  const validTagType: TagType = (TAG_TYPES as readonly string[]).includes(String(tagType))
    ? (tagType as TagType)
    : "vault";
  if (typeof meta.name !== "string" || meta.name.trim().length === 0 || meta.name.length > 120) {
    issues.add("TEMPLATE_NAME_INVALID", "template.name", "name braucht 1–120 Zeichen.");
  }
  if (meta.description !== undefined && (typeof meta.description !== "string" || meta.description.length > 500)) {
    issues.add("TEMPLATE_DESCRIPTION_INVALID", "template.description", "description max. 500 Zeichen.");
  }
  if (meta.locale !== undefined && meta.locale !== "de-DE") {
    issues.add("TEMPLATE_LOCALE_UNSUPPORTED", "template.locale", "v1 unterstützt ausschließlich de-DE.");
  }
  if (!inList(meta.status, TEMPLATE_STATUS)) {
    issues.add("TEMPLATE_STATUS_INVALID", "template.status", "Unbekannter Status.");
  }

  const shell = input.shell;
  let presentation: Presentation = "standard";
  let features: Feature[] = ["vault"];
  if (!isObject(shell)) {
    issues.add("SHELL_MISSING", "shell", "shell fehlt.");
  } else {
    if (!inList(shell.presentation, PRESENTATIONS)) {
      issues.add("FEATURE_UNKNOWN", "shell.presentation", `Unbekannte Präsentation: ${String(shell.presentation)}`);
    } else {
      presentation = shell.presentation as Presentation;
    }
    const rawFeatures = shell.features;
    if (!Array.isArray(rawFeatures)) {
      issues.add("FEATURES_INVALID", "shell.features", "features muss ein Array sein.");
    } else {
      const allowed = TAG_TYPE_FEATURES[validTagType];
      const list: Feature[] = [];
      for (const feature of rawFeatures) {
        if (!inList(feature, FEATURES)) {
          issues.add("FEATURE_UNKNOWN", "shell.features", `Unbekanntes Feature: ${String(feature)}`);
        } else if (!allowed.includes(feature as Feature)) {
          issues.add("FEATURE_NOT_ALLOWED", "shell.features", `Feature ${String(feature)} ist für ${validTagType} nicht zulässig.`);
        } else {
          list.push(feature as Feature);
        }
      }
      features = list;
    }
    const theme = shell.theme;
    if (!isObject(theme)) {
      issues.add("THEME_MISSING", "shell.theme", "theme fehlt.");
    } else {
      if (theme.colorMode !== "light" && theme.colorMode !== "dark") {
        issues.add("THEME_COLOR_MODE_INVALID", "shell.theme.colorMode", "colorMode nur light/dark.");
      }
      const colors = theme.colors;
      if (!isObject(colors)) {
        issues.add("THEME_COLORS_MISSING", "shell.theme.colors", "colors fehlen.");
      } else {
        for (const key of ["background", "surface", "text", "mutedText", "heading", "accent", "accentText", "border"]) {
          if (typeof colors[key] !== "string" || !HEX_COLOR.test(colors[key] as string)) {
            issues.add("STYLE_COLOR_INVALID", `shell.theme.colors.${key}`, "Farbe muss #rrggbb sein.");
          }
        }
        for (const key of ["danger", "success"]) {
          if (colors[key] !== undefined && (typeof colors[key] !== "string" || !HEX_COLOR.test(colors[key] as string))) {
            issues.add("STYLE_COLOR_INVALID", `shell.theme.colors.${key}`, "Farbe muss #rrggbb sein.");
          }
        }
      }
    }
  }

  const layout = input.layout;
  if (!isObject(layout)) {
    issues.add("LAYOUT_MISSING", "layout", "layout fehlt.");
  } else {
    if (layout.mode !== "grid-flow") issues.add("LAYOUT_MODE_INVALID", "layout.mode", "Nur grid-flow.");
    if (!isInteger(layout.columns) || layout.columns < 1 || layout.columns > 12) {
      issues.add("LAYOUT_COLUMNS_INVALID", "layout.columns", "columns 1–12.");
    }
    if (!inList(layout.gap, ["sm", "md", "lg"])) issues.add("LAYOUT_GAP_INVALID", "layout.gap", "gap nur sm/md/lg.");
    const responsive = layout.responsive;
    if (!isObject(responsive)) {
      issues.add("LAYOUT_RESPONSIVE_MISSING", "layout.responsive", "responsive fehlt.");
    } else {
      if (typeof responsive.autoReflow !== "boolean") {
        issues.add("LAYOUT_AUTOREFLOW_INVALID", "layout.responsive.autoReflow", "autoReflow muss boolean sein.");
      }
      const minWidth = responsive.minColumnWidth;
      if (minWidth !== undefined) {
        if (!isObject(minWidth)) {
          issues.add("LAYOUT_MIN_WIDTH_INVALID", "layout.responsive.minColumnWidth", "minColumnWidth muss ein Objekt sein.");
        } else {
          for (const [breakpoint, value] of Object.entries(minWidth)) {
            if (!(BREAKPOINTS as readonly string[]).includes(breakpoint)
              || typeof value !== "string"
              || !REM_VALUE.test(value)) {
              issues.add("LAYOUT_MIN_WIDTH_INVALID", `layout.responsive.minColumnWidth.${breakpoint}`, "Wert in rem erwartet.");
            }
          }
        }
      }
      const preferred = responsive.preferredColumns;
      if (preferred !== undefined) {
        if (!isObject(preferred)) {
          issues.add("LAYOUT_PREFERRED_INVALID", "layout.responsive.preferredColumns", "preferredColumns muss ein Objekt sein.");
        } else {
          for (const [breakpoint, value] of Object.entries(preferred)) {
            if (!(BREAKPOINTS as readonly string[]).includes(breakpoint)
              || !isInteger(value)
              || (value as number) < 1
              || (value as number) > 12) {
              issues.add("LAYOUT_PREFERRED_INVALID", `layout.responsive.preferredColumns.${breakpoint}`, "1–12 erwartet.");
            }
          }
        }
      }
    }
  }

  const elements = input.elements;
  const list: VElement[] = [];
  if (!Array.isArray(elements) || elements.length === 0) {
    issues.add("ELEMENTS_MISSING", "elements", "elements muss ein nicht leeres Array sein.");
  } else {
    if (elements.length > MAX_ELEMENTS) {
      issues.add("LIMIT_ELEMENTS", "elements", `Maximal ${MAX_ELEMENTS} Elemente.`);
    }
    const ids = new Set<string>();
    const orders = new Set<number>();
    elements.forEach((element, index) => {
      const parsed = validateElement(element, index, validTagType, issues, ids, orders);
      if (parsed) list.push(parsed);
    });
  }

  scanPolicy(input, "document", issues);
  if (byteLength(canonicalize(input)) > MAX_TEMPLATE_BYTES) {
    issues.add("TEMPLATE_TOO_LARGE", "", `Template überschreitet ${MAX_TEMPLATE_BYTES} Bytes.`);
  }

  if (issues.count > 0) return { document: null, issues: issues.items };

  return {
    document: {
      schemaVersion: SCHEMA_VERSION,
      template: {
        templateId: meta.templateId as string,
        templateVersion: meta.templateVersion as number,
        tagType: validTagType,
        name: (meta.name as string).trim(),
        ...(typeof meta.description === "string" ? { description: meta.description } : {}),
        locale: typeof meta.locale === "string" ? meta.locale : "de-DE",
        status: meta.status as string,
      },
      shell: {
        presentation,
        features,
        ...(isObject(shell) && isObject(shell.theme) ? { theme: shell.theme } : {}),
      },
      layout: layout as Record<string, unknown>,
      elements: list,
    },
    issues: issues.items,
  };
}







