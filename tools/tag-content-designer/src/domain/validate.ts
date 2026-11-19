import { isKnownBindingSource } from "./bindings";
import { ELEMENT_CATALOG, FEATURES, PRESENTATIONS, TAG_TYPES, TAG_TYPE_FEATURES } from "./catalog";
import { error, warning, type ValidationIssue } from "./errors";
import { isFontFamily, isFontSize, isHeadingLevel, isHexColor, isLineHeight, isListKind, isTableBlock, isTableBorderStyle, isTableBorderWidth, isTextAlign, normalizeHref } from "./richtext";
import { canonicalByteLength } from "./serialize";
import {
  INSTANCE_SCHEMA,
  MAX_DOCUMENT_BYTES,
  MAX_CUSTOM_COLORS,
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
  MAX_TEXT_LENGTH,
  SCHEMA_VERSION,
  TEMPLATE_SCHEMA,
} from "./types";
import type { ContentBlock, TagType } from "./types";

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const COLOR_TOKENS = new Set([
  "background",
  "surface",
  "text",
  "muted",
  "mutedText",
  "heading",
  "accent",
  "accentText",
  "border",
  "danger",
  "success",
]);

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const REM_VALUE = /^[0-9]+(?:\.[0-9]+)?rem$/;
const ELEMENT_ID = /^cel_[A-Za-z0-9_-]{1,120}$/;
const SLOT_ID = /^[a-z][a-z0-9-]{0,31}$/;
const TEMPLATE_ID = /^[a-z][a-z0-9_]{2,63}$/;
const VISIBILITIES = ["public", "shared", "private", "ownerOnly"];
const PRINCIPALS = ["scanner", "guest", "owner"];
const ACCEPTS = ["image", "document", "audio"];
const MARKS = ["bold", "italic", "underline"];

const FORBIDDEN_PATTERNS: Array<{ code: string; regex: RegExp; message: string; severity: "error" | "warning" }> = [
  {
    code: "POLICY_HTML_MARKUP",
    regex: /<\s*\/?[a-z!]/i,
    message: "Der Text enthält HTML-ähnliches Markup und wird als reiner Text angezeigt.",
    severity: "warning",
  },
  {
    code: "POLICY_SCRIPT_URL",
    regex: /javascript:/i,
    message: "javascript:-URLs sind unzulässig.",
    severity: "error",
  },
  { code: "POLICY_DATA_URL", regex: /\bdata:/i, message: "data:-URLs sind unzulässig.", severity: "error" },
  { code: "POLICY_CSS_URL", regex: /url\s*\(/i, message: "CSS-url(...) ist unzulässig.", severity: "error" },
  {
    code: "POLICY_EVENT_HANDLER",
    regex: /\son[a-z]+\s*=/i,
    message: "Inline-Event-Handler sind unzulässig.",
    severity: "error",
  },
  {
    code: "POLICY_STORAGE_KEY",
    regex: /(object_key|objectKey|r2_key|r2Key)/,
    message: "Storage-Keys dürfen nicht im Template stehen.",
    severity: "error",
  },
];

export function isColorValue(value: unknown): boolean {
  return (typeof value === "string" && (HEX_COLOR.test(value) || COLOR_TOKENS.has(value))) || false;
}

function scanStrings(value: unknown, path: string, issues: ValidationIssue[], depth = 0): void {
  if (depth > 8) return;
  if (typeof value === "string") {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (!pattern.regex.test(value)) continue;
      const hint =
        pattern.severity === "warning"
          ? "Der Text ist unbedenklich, wird aber wörtlich angezeigt. Für Formatierung die Leiste nutzen."
          : "Bitte auf reinen Text bzw. erlaubte Werte reduzieren.";
      issues.push(
        pattern.severity === "warning"
          ? warning(pattern.code, path, pattern.message, hint)
          : error(pattern.code, path, pattern.message, hint),
      );
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanStrings(entry, `${path}[${index}]`, issues, depth + 1));
    return;
  }
  if (isObject(value)) {
    for (const [key, entry] of Object.entries(value)) {
      scanStrings(entry, path ? `${path}.${key}` : key, issues, depth + 1);
    }
  }
}

export function validateDocument(input: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isObject(input)) {
    issues.push(error("DOCUMENT_NOT_AN_OBJECT", "", "Die Datei enthält kein JSON-Objekt."));
    return issues;
  }
  const doc = input;
  if (doc.schema !== TEMPLATE_SCHEMA && doc.schema !== INSTANCE_SCHEMA) {
    issues.push(
      error(
        "SCHEMA_UNKNOWN",
        "schema",
        "Unbekanntes schema. Erwartet wird ein TAG-Content-Template.",
        "Nur *.tagcontent.json dieses Tools laden.",
      ),
    );
  }
  if (doc.schemaVersion !== SCHEMA_VERSION) {
    issues.push(
      error(
        "SCHEMA_VERSION_UNSUPPORTED",
        "schemaVersion",
        `Erwartet wird schemaVersion ${SCHEMA_VERSION}.`,
        "Ältere Dateien werden beim Laden migriert; neuere benötigen ein Tool-Update.",
      ),
    );
  }

  const tagType = validateTemplate(doc.template, issues);
  const shell = isObject(doc.shell) ? doc.shell : null;
  if (!shell) issues.push(error("SHELL_MISSING", "shell", "Der TAG-Rahmen (shell) fehlt."));
  else validateShell(shell, tagType, issues);

  const layout = isObject(doc.layout) ? doc.layout : null;
  if (!layout) issues.push(error("LAYOUT_MISSING", "layout", "Die Layoutbeschreibung (layout) fehlt."));
  else validateLayout(layout, issues);

  if (!Array.isArray(doc.elements)) {
    issues.push(error("ELEMENTS_MISSING", "elements", "Die Elementliste (elements) fehlt."));
  } else {
    validateElements(doc.elements, tagType, issues);
  }

  if (doc.editability !== undefined) validateEditability(doc.editability, "editability", issues);
  if (doc.palette !== undefined) validatePalette(doc.palette, issues);

  scanStrings(doc, "", issues);

  const bytes = canonicalByteLength(doc);
  if (bytes > MAX_DOCUMENT_BYTES) {
    issues.push(
      error(
        "LIMIT_DOCUMENT_BYTES",
        "",
        `Das Dokument ist ${bytes} Byte groß (Limit ${Math.round(MAX_DOCUMENT_BYTES / 1024)} kB).`,
        "Elemente oder Texte kürzen.",
      ),
    );
  }
  return issues;
}

function validateTemplate(input: unknown, issues: ValidationIssue[]): TagType | undefined {
  if (!isObject(input)) {
    issues.push(error("TEMPLATE_MISSING", "template", "Der Block template fehlt."));
    return undefined;
  }
  const template = input;
  if (typeof template.templateId !== "string" || !TEMPLATE_ID.test(template.templateId)) {
    issues.push(
      error("TEMPLATE_ID_INVALID", "template.templateId", "templateId ist ungültig.", "Erlaubt: [a-z][a-z0-9_]{2,63}"),
    );
  }
  if (!Number.isInteger(template.templateVersion) || (template.templateVersion as number) < 1) {
    issues.push(
      error("TEMPLATE_VERSION_INVALID", "template.templateVersion", "templateVersion muss eine ganze Zahl ab 1 sein."),
    );
  }
  const tagType = template.tagType;
  const knownTagType = typeof tagType === "string" && (TAG_TYPES as string[]).includes(tagType);
  if (!knownTagType) {
    issues.push(error("TAG_TYPE_INVALID", "template.tagType", `tagType muss einer von ${TAG_TYPES.join(", ")} sein.`));
  }
  if (typeof template.name !== "string" || template.name.trim().length === 0 || template.name.length > 120) {
    issues.push(error("TEMPLATE_NAME_INVALID", "template.name", "name muss 1 bis 120 Zeichen haben."));
  }
  if (
    template.description !== undefined &&
    (typeof template.description !== "string" || template.description.length > 512)
  ) {
    issues.push(
      error("TEMPLATE_DESCRIPTION_INVALID", "template.description", "description darf höchstens 512 Zeichen haben."),
    );
  }
  if (template.locale !== undefined && template.locale !== "de-DE") {
    issues.push(error("TEMPLATE_LOCALE_UNSUPPORTED", "template.locale", "v1 unterstützt ausschließlich de-DE."));
  }
  if (
    template.status !== undefined &&
    !["draft", "pending-review", "published", "retired"].includes(String(template.status))
  ) {
    issues.push(error("TEMPLATE_STATUS_INVALID", "template.status", "Unbekannter Status."));
  }
  return knownTagType ? (tagType as TagType) : undefined;
}


function validateShell(shell: Record<string, unknown>, tagType: TagType | undefined, issues: ValidationIssue[]): void {
  if (!(PRESENTATIONS as string[]).includes(String(shell.presentation))) {
    issues.push(
      error(
        "PRESENTATION_INVALID",
        "shell.presentation",
        `presentation muss einer von ${PRESENTATIONS.join(", ")} sein.`,
      ),
    );
  }
  if (!Array.isArray(shell.features)) {
    issues.push(error("FEATURES_INVALID", "shell.features", "features muss ein Array sein."));
  } else {
    for (const feature of shell.features.map(String)) {
      if (!(FEATURES as string[]).includes(feature)) {
        issues.push(error("FEATURE_UNKNOWN", "shell.features", `Unbekanntes Feature: ${feature}`));
      } else if (tagType && !(TAG_TYPE_FEATURES[tagType] as string[]).includes(feature)) {
        issues.push(
          error(
            "FEATURE_NOT_ALLOWED",
            "shell.features",
            `Feature ${feature} ist für den TAG-Typ ${tagType} nicht zulässig.`,
            "Ein Template kann Rechte nicht erweitern.",
          ),
        );
      }
    }
  }

  if (!isObject(shell.theme)) {
    issues.push(error("THEME_MISSING", "shell.theme", "shell.theme fehlt."));
  } else {
    const theme = shell.theme;
    if (theme.colorMode !== "light" && theme.colorMode !== "dark") {
      issues.push(error("THEME_COLOR_MODE_INVALID", "shell.theme.colorMode", "colorMode muss light oder dark sein."));
    }
    if (!isObject(theme.colors)) {
      issues.push(error("THEME_COLORS_MISSING", "shell.theme.colors", "theme.colors fehlt."));
    } else {
      for (const key of ["background", "surface", "text", "heading", "accent", "accentText", "border"]) {
        if (!isColorValue(theme.colors[key])) {
          issues.push(
            error(
              "THEME_COLOR_INVALID",
              `shell.theme.colors.${key}`,
              "Farbe muss #rrggbb oder ein Palettentoken sein.",
              `Erlaubte Tokens: ${[...COLOR_TOKENS].join(", ")}`,
            ),
          );
        }
      }
    }
    if (isObject(theme.layout)) {
      const themeLayout = theme.layout;
      if (themeLayout.contentWidth !== undefined && !["narrow", "wide", "full"].includes(String(themeLayout.contentWidth))) {
        issues.push(error("THEME_CONTENT_WIDTH_INVALID", "shell.theme.layout.contentWidth", "Unbekannte Breite."));
      }
      if (themeLayout.density !== undefined && !["compact", "comfortable"].includes(String(themeLayout.density))) {
        issues.push(error("THEME_DENSITY_INVALID", "shell.theme.layout.density", "Unbekannte Dichte."));
      }
      if (themeLayout.cornerStyle !== undefined && !["none", "soft", "round"].includes(String(themeLayout.cornerStyle))) {
        issues.push(error("THEME_CORNER_INVALID", "shell.theme.layout.cornerStyle", "Unbekannter Eckenstil."));
      }
    }
  }

  if (shell.navigation !== undefined) {
    if (!isObject(shell.navigation)) {
      issues.push(error("NAVIGATION_INVALID", "shell.navigation", "navigation muss ein Objekt sein."));
    } else {
      const navigation = shell.navigation;
      if (navigation.mode !== undefined && !["single", "tabs"].includes(String(navigation.mode))) {
        issues.push(error("NAVIGATION_MODE_INVALID", "shell.navigation.mode", "mode muss single oder tabs sein."));
      }
      if (navigation.items !== undefined && !Array.isArray(navigation.items)) {
        issues.push(error("NAVIGATION_ITEMS_INVALID", "shell.navigation.items", "items muss ein Array sein."));
      }
    }
  }
}


function validateLayout(layout: Record<string, unknown>, issues: ValidationIssue[]): void {
  if (layout.mode !== "grid-flow") {
    issues.push(error("LAYOUT_MODE_INVALID", "layout.mode", "v1 unterstützt ausschließlich grid-flow."));
  }
  if (!Number.isInteger(layout.columns) || (layout.columns as number) < 1 || (layout.columns as number) > 12) {
    issues.push(error("LAYOUT_COLUMNS_INVALID", "layout.columns", "columns muss eine ganze Zahl von 1 bis 12 sein."));
  }
  if (!["sm", "md", "lg"].includes(String(layout.gap))) {
    issues.push(error("LAYOUT_GAP_INVALID", "layout.gap", "gap muss sm, md oder lg sein."));
  }
  const responsive = layout.responsive;
  if (!isObject(responsive)) {
    issues.push(error("LAYOUT_RESPONSIVE_MISSING", "layout.responsive", "layout.responsive fehlt."));
    return;
  }
  if (typeof responsive.autoReflow !== "boolean") {
    issues.push(error("LAYOUT_AUTOREFLOW_INVALID", "layout.responsive.autoReflow", "autoReflow muss boolean sein."));
  }
  if (responsive.preferredColumns !== undefined) {
    if (!isObject(responsive.preferredColumns)) {
      issues.push(
        error("LAYOUT_PREFERRED_INVALID", "layout.responsive.preferredColumns", "preferredColumns muss ein Objekt sein."),
      );
    } else {
      for (const [breakpoint, value] of Object.entries(responsive.preferredColumns)) {
        const validBreakpoint = ["mobile", "tablet", "desktop"].includes(breakpoint);
        if (!validBreakpoint || !Number.isInteger(value) || (value as number) < 1 || (value as number) > 12) {
          issues.push(
            error(
              "LAYOUT_PREFERRED_VALUE_INVALID",
              `layout.responsive.preferredColumns.${breakpoint}`,
              "Erwartet wird eine ganze Zahl von 1 bis 12.",
            ),
          );
        }
      }
    }
  }
  if (responsive.minColumnWidth !== undefined) {
    if (!isObject(responsive.minColumnWidth)) {
      issues.push(
        error("LAYOUT_MIN_WIDTH_INVALID", "layout.responsive.minColumnWidth", "minColumnWidth muss ein Objekt sein."),
      );
    } else {
      for (const [breakpoint, value] of Object.entries(responsive.minColumnWidth)) {
        const validBreakpoint = ["mobile", "tablet", "desktop"].includes(breakpoint);
        if (!validBreakpoint || typeof value !== "string" || !REM_VALUE.test(value)) {
          issues.push(
            error(
              "LAYOUT_MIN_WIDTH_VALUE_INVALID",
              `layout.responsive.minColumnWidth.${breakpoint}`,
              'Erwartet wird ein rem-Wert, z. B. "16rem".',
            ),
          );
        }
      }
    }
  }
}


function validateSlot(slot: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isObject(slot)) {
    issues.push(error("SLOT_INVALID", path, "Slot muss ein Objekt sein."));
    return;
  }
  if (typeof slot.slotId !== "string" || !SLOT_ID.test(slot.slotId)) {
    issues.push(error("SLOT_ID_INVALID", `${path}.slotId`, "slotId ist ungültig.", "Erlaubt: [a-z][a-z0-9-]{0,31}"));
  }
  const accepts = slot.accepts;
  if (!Array.isArray(accepts) || accepts.length === 0) {
    issues.push(error("SLOT_ACCEPTS_INVALID", `${path}.accepts`, "accepts muss mindestens einen Typ enthalten."));
  } else {
    for (const entry of accepts) {
      if (!(ACCEPTS as string[]).includes(String(entry))) {
        issues.push(error("SLOT_ACCEPT_UNKNOWN", `${path}.accepts`, `Unbekannter Typ: ${String(entry)}`));
      }
    }
  }
  const min = slot.min;
  const max = slot.max;
  if (!Number.isInteger(min) || (min as number) < 0 || (min as number) > MAX_ITEMS_PER_SLOT) {
    issues.push(error("SLOT_MIN_INVALID", `${path}.min`, `min muss 0 bis ${MAX_ITEMS_PER_SLOT} sein.`));
  }
  if (!Number.isInteger(max) || (max as number) < 1 || (max as number) > MAX_ITEMS_PER_SLOT) {
    issues.push(error("SLOT_MAX_INVALID", `${path}.max`, `max muss 1 bis ${MAX_ITEMS_PER_SLOT} sein.`));
  }
  if (Number.isInteger(min) && Number.isInteger(max) && (min as number) > (max as number)) {
    issues.push(error("SLOT_RANGE_INVALID", path, "min darf nicht größer als max sein."));
  }
  if (typeof slot.required !== "boolean") {
    issues.push(error("SLOT_REQUIRED_INVALID", `${path}.required`, "required muss boolean sein."));
  } else if (slot.required && Number.isInteger(min) && (min as number) < 1) {
    issues.push(warning("SLOT_REQUIRED_WITHOUT_MIN", path, "Pflicht-Slot mit min 0 ist widersprüchlich.", "min auf 1 setzen."));
  }
}

function validateActions(actions: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isObject(actions)) {
    issues.push(error("ACTIONS_INVALID", path, "actions muss ein Objekt sein."));
    return;
  }
  for (const actionKey of ["upload", "download", "delete"]) {
    const rule = actions[actionKey];
    if (rule === undefined) continue;
    const rulePath = `${path}.${actionKey}`;
    if (!isObject(rule)) {
      issues.push(error("ACTION_RULE_INVALID", rulePath, "Regel muss ein Objekt sein."));
      continue;
    }
    if (typeof rule.enabled !== "boolean") {
      issues.push(error("ACTION_ENABLED_INVALID", `${rulePath}.enabled`, "enabled muss boolean sein."));
    }
    if (rule.principals !== undefined) {
      if (!Array.isArray(rule.principals)) {
        issues.push(error("ACTION_PRINCIPALS_INVALID", `${rulePath}.principals`, "principals muss ein Array sein."));
      } else {
        for (const principal of rule.principals) {
          if (!(PRINCIPALS as string[]).includes(String(principal))) {
            issues.push(
              error("ACTION_PRINCIPAL_UNKNOWN", `${rulePath}.principals`, `Unbekannter Principal: ${String(principal)}`),
            );
          }
        }
      }
    }
    if (actionKey === "delete" && rule.guestScope !== undefined && rule.guestScope !== "ownOnly") {
      issues.push(error("ACTION_GUEST_SCOPE_INVALID", `${rulePath}.guestScope`, "guestScope muss ownOnly sein."));
    }
    if (
      actionKey === "delete" &&
      rule.enabled === true &&
      Array.isArray(rule.principals) &&
      rule.principals.map(String).includes("guest") &&
      rule.guestScope === "ownOnly"
    ) {
      issues.push(
        warning(
          "ACTIONS_OWNERSHIP_UNPROVEN",
          rulePath,
          "Gast-Löschung ist nur mit Eigentumsbindung durchsetzbar; die tag-api hat sie noch nicht.",
          "Regel bleibt beantragt; TCP prüft sie beim Publish. Bis dahin erscheint der Button nicht.",
        ),
      );
    }
  }
}


function validatePalette(input: unknown, issues: ValidationIssue[]): void {
  if (!isObject(input)) {
    issues.push(error("PALETTE_INVALID", "palette", "palette muss ein Objekt sein."));
    return;
  }
  const custom = input.custom;
  if (custom === undefined) return;
  if (!Array.isArray(custom)) {
    issues.push(error("PALETTE_INVALID", "palette.custom", "palette.custom muss ein Array sein."));
    return;
  }
  if (custom.length > MAX_CUSTOM_COLORS) {
    issues.push(
      error(
        "PALETTE_LIMIT",
        "palette.custom",
        `Höchstens ${MAX_CUSTOM_COLORS} eigene Farben.`,
        "Nicht mehr benötigte Farben im Farbmenü entfernen.",
      ),
    );
  }
  custom.forEach((entry, index) => {
    if (!isHexColor(entry)) {
      issues.push(
        error("PALETTE_INVALID", `palette.custom[${index}]`, "Eigene Farben müssen als #rrggbb gespeichert werden."),
      );
    }
  });
}

/** Prüft einen einzelnen `content`-Block (z. B. beim Bearbeiten der JSON-Kontrolle). */
export function validateRichText(content: unknown, path = "content"): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  validateContent(content, path, issues);
  return issues;
}

/**
 * Tabellenblock: Spalten/Zeilen/Zelllängen und Ausrichtung prüfen.
 * Zellen sind reiner Text – damit bleibt der Renderer frei von Formatierungs-Sonderfällen.
 */
/**
 * Prüft Runs (Absatz und Tabellenzelle) und liefert die Zeichenlänge über alle Runs.
 * Die Regeln sind für beide Stellen identisch – Zellen dürfen nur weniger Zeichen.
 */
function validateRuns(runs: unknown[], path: string, issues: ValidationIssue[]): number {
  let length = 0;
  runs.forEach((run, runIndex) => {
    const runPath = `${path}[${runIndex}]`;
    if (!isObject(run) || typeof run.text !== "string") {
      issues.push(error("CONTENT_RUN_INVALID", runPath, "Run braucht einen Text."));
      return;
    }
    length += run.text.length;
    for (const key of ["color", "background"]) {
      if (run[key] !== undefined && !isHexColor(run[key])) {
        issues.push(
          error(
            "CONTENT_RUN_COLOR_INVALID",
            `${runPath}.${key}`,
            "Zeichen- und Markierungsfarbe müssen als #rrggbb angegeben werden.",
          ),
        );
      }
    }
    if (run.fontSize !== undefined && !isFontSize(run.fontSize)) {
      issues.push(
        error(
          "CONTENT_RUN_FONT_SIZE_INVALID",
          `${runPath}.fontSize`,
          "fontSize muss aus der Skala 12, 14, 16, 18, 20, 24, 28, 32 stammen.",
        ),
      );
    }
    if (run.fontFamily !== undefined && !isFontFamily(run.fontFamily)) {
      issues.push(
        error("CONTENT_RUN_FONT_FAMILY_INVALID", `${runPath}.fontFamily`, "fontFamily muss sans, serif oder mono sein."),
      );
    }
    if (run.link !== undefined) {
      const href = isObject(run.link) ? run.link.href : undefined;
      if (normalizeHref(href) === null) {
        issues.push(
          error(
            "CONTENT_RUN_LINK_INVALID",
            `${runPath}.link`,
            "Link muss mit https:// oder mailto: beginnen und frei von Steuerzeichen sein.",
          ),
        );
      }
    }
    if (run.marks !== undefined) {
      if (!Array.isArray(run.marks)) {
        issues.push(error("CONTENT_MARKS_INVALID", `${runPath}.marks`, "marks muss ein Array sein."));
      } else {
        for (const mark of run.marks) {
          const name = isObject(mark) ? String(mark.type) : String(mark);
          if (!MARKS.includes(name)) {
            issues.push(error("CONTENT_MARK_UNKNOWN", `${runPath}.marks`, `Unbekannte Auszeichnung: ${name}`));
          }
        }
      }
    }
  });
  return length;
}

function validateTableBlock(table: Record<string, unknown>, path: string, issues: ValidationIssue[]): void {
  const columns = table.columns;
  const rows = table.rows;
  if (table.border !== undefined) {
    const border = table.border;
    const valid =
      isObject(border) &&
      isHexColor(border.color) &&
      isTableBorderStyle(border.style) &&
      isTableBorderWidth(border.width);
    if (!valid) {
      issues.push(
        error(
          "TABLE_BORDER_INVALID",
          `${path}.border`,
          "Der Tabellenrahmen braucht color (#rrggbb), style (solid/dashed/dotted/double) und width (1 oder 2).",
          "Rahmen über die Gitter-Toolbox setzen oder entfernen.",
        ),
      );
    }
  }
  if (!Array.isArray(columns) || columns.length === 0 || columns.length > MAX_TABLE_COLUMNS) {
    issues.push(
      error("TABLE_COLUMNS_INVALID", `${path}.columns`, `Eine Tabelle braucht 1 bis ${MAX_TABLE_COLUMNS} Spalten.`),
    );
    return;
  }
  columns.forEach((column, index) => {
    const align = isObject(column) ? column.align : undefined;
    if (align !== undefined && !isTextAlign(align)) {
      issues.push(
        error("TABLE_ALIGN_INVALID", `${path}.columns[${index}].align`, "Spaltenausrichtung muss start, center oder end sein."),
      );
    }
  });
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > MAX_TABLE_ROWS) {
    issues.push(error("TABLE_ROWS_INVALID", `${path}.rows`, `Eine Tabelle braucht 1 bis ${MAX_TABLE_ROWS} Zeilen.`));
    return;
  }
  rows.forEach((row, rowIndex) => {
    const rowPath = `${path}.rows[${rowIndex}]`;
    if (!isObject(row) || !Array.isArray(row.cells)) {
      issues.push(error("TABLE_ROW_INVALID", rowPath, "Zeile braucht ein cells-Array."));
      return;
    }
    if (row.cells.length !== columns.length) {
      issues.push(
        error(
          "TABLE_ROW_LENGTH",
          `${rowPath}.cells`,
          `Jede Zeile braucht genau ${columns.length} Zellen.`,
          "Spaltenzahl der Tabelle anpassen oder leere Zellen ergänzen.",
        ),
      );
    }
    row.cells.forEach((cell, cellIndex) => {
      const cellPath = `${rowPath}.cells[${cellIndex}]`;
      if (!isObject(cell) || !Array.isArray(cell.runs)) {
        issues.push(
          error(
            "TABLE_CELL_INVALID",
            cellPath,
            "Zelle braucht ein runs-Array (Text mit optionalen Zeichen-Attributen).",
            "Zellen über die Tabelle bearbeiten; Altbestände werden beim Laden migriert.",
          ),
        );
        return;
      }
      const length = validateRuns(cell.runs, `${cellPath}.runs`, issues);
      if (length > MAX_TABLE_CELL_LENGTH) {
        issues.push(
          error(
            "TABLE_CELL_TOO_LONG",
            `${cellPath}.runs`,
            `Zellen dürfen höchstens ${MAX_TABLE_CELL_LENGTH} Zeichen enthalten.`,
          ),
        );
      }
      if (cell.background !== undefined && !isHexColor(cell.background)) {
        issues.push(
          error(
            "TABLE_CELL_BACKGROUND_INVALID",
            `${cellPath}.background`,
            "Der Zellhintergrund muss als #rrggbb angegeben werden.",
            "Hintergrund über die Gitter-Toolbox setzen oder entfernen.",
          ),
        );
      }
    });
  });
}

function validateContent(content: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isObject(content)) {
    issues.push(error("CONTENT_INVALID", path, "content muss ein Objekt sein."));
    return;
  }
  if (content.heading !== undefined) {
    if (typeof content.heading !== "string" || content.heading.length > MAX_HEADING_LENGTH) {
      issues.push(
        error("CONTENT_HEADING_INVALID", `${path}.heading`, `heading darf höchstens ${MAX_HEADING_LENGTH} Zeichen haben.`),
      );
    } else {
      issues.push(
        warning(
          "CONTENT_HEADING_DEPRECATED",
          `${path}.heading`,
          "Das Feld heading gehört zu schemaVersion 1 und wird beim Laden in einen Absatz mit Überschrift überführt.",
          "Nach dem Laden/Speichern verschwindet der Hinweis.",
        ),
      );
    }
  }
  const paragraphs = content.paragraphs;
  if (paragraphs === undefined) return;
  if (!Array.isArray(paragraphs)) {
    issues.push(error("CONTENT_PARAGRAPHS_INVALID", `${path}.paragraphs`, "paragraphs muss ein Array sein."));
    return;
  }
  if (paragraphs.length > MAX_PARAGRAPHS) {
    issues.push(
      error("CONTENT_PARAGRAPHS_LIMIT", `${path}.paragraphs`, `Höchstens ${MAX_PARAGRAPHS} Absätze pro Element.`),
    );
  }
  const tableCount = (paragraphs as unknown[]).filter((entry) => isTableBlock(entry as ContentBlock | undefined)).length;
  if (tableCount > MAX_TABLES) {
    issues.push(
      error(
        "CONTENT_TABLES_LIMIT",
        `${path}.paragraphs`,
        `Höchstens ${MAX_TABLES} Tabellen pro Textfeld.`,
        "Weitere Tabellen in ein eigenes Element auslagern.",
      ),
    );
  }
  paragraphs.forEach((paragraph, paragraphIndex) => {
    const paragraphPath = `${path}.paragraphs[${paragraphIndex}]`;
    if (isTableBlock(paragraph as ContentBlock | undefined)) {
      validateTableBlock(paragraph as unknown as Record<string, unknown>, paragraphPath, issues);
      return;
    }
    if (!isObject(paragraph) || !Array.isArray(paragraph.runs)) {
      issues.push(error("CONTENT_PARAGRAPH_INVALID", paragraphPath, "Absatz braucht ein runs-Array."));
      return;
    }
    if (paragraph.align !== undefined && !isTextAlign(paragraph.align)) {
      issues.push(error("CONTENT_PARAGRAPH_ALIGN_INVALID", `${paragraphPath}.align`, "align muss start, center oder end sein."));
    }
    if (paragraph.lineHeight !== undefined && !isLineHeight(paragraph.lineHeight)) {
      issues.push(
        error(
          "CONTENT_PARAGRAPH_LINE_HEIGHT_INVALID",
          `${paragraphPath}.lineHeight`,
          "lineHeight muss aus der Skala 1, 1.15, 1.3, 1.5, 1.75, 2 stammen.",
        ),
      );
    }
    if (
      paragraph.indent !== undefined &&
      (!Number.isInteger(paragraph.indent) || (paragraph.indent as number) < 0 || (paragraph.indent as number) > MAX_INDENT)
    ) {
      issues.push(
        error(
          "CONTENT_PARAGRAPH_INDENT_INVALID",
          `${paragraphPath}.indent`,
          `indent muss eine ganze Zahl von 0 bis ${MAX_INDENT} sein.`,
        ),
      );
    }
    if (paragraph.heading !== undefined && !isHeadingLevel(paragraph.heading)) {
      issues.push(
        error(
          "PARAGRAPH_HEADING_INVALID",
          `${paragraphPath}.heading`,
          "heading muss eine Überschriftenebene von 1 bis 5 sein.",
          "Ebenen 6+ sind nicht vorgesehen; stattdessen Ebene 5 oder einen Absatz verwenden.",
        ),
      );
    }
    if (paragraph.heading !== undefined && paragraph.list !== undefined) {
      issues.push(
        error(
          "PARAGRAPH_HEADING_LIST_CONFLICT",
          paragraphPath,
          "Ein Absatz kann nicht gleichzeitig Überschrift und Listeneintrag sein.",
          "Entweder die Überschriftenebene oder die Liste entfernen.",
        ),
      );
    }
    if (paragraph.list !== undefined) {
      const list = paragraph.list;
      const level = isObject(list) ? list.level : undefined;
      if (
        !isObject(list) ||
        !isListKind(list.kind) ||
        !Number.isInteger(level) ||
        (level as number) < 0 ||
        (level as number) > MAX_LIST_LEVEL
      ) {
        issues.push(
          error(
            "CONTENT_LIST_INVALID",
            `${paragraphPath}.list`,
            `list braucht kind (bullet/ordered) und level von 0 bis ${MAX_LIST_LEVEL}.`,
          ),
        );
      }
    }
    const length = validateRuns(paragraph.runs, `${paragraphPath}.runs`, issues);
    if (length > MAX_TEXT_LENGTH) {
      issues.push(
        error("CONTENT_TEXT_LIMIT", paragraphPath, `Absatz überschreitet ${MAX_TEXT_LENGTH} Zeichen.`, "Text kürzen."),
      );
    }
  });
}

function validateEditability(input: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isObject(input)) {
    issues.push(error("EDITABILITY_INVALID", path, "editability muss ein Objekt sein."));
    return;
  }
  if (!Array.isArray(input.allow)) {
    issues.push(error("EDITABILITY_ALLOW_INVALID", `${path}.allow`, "allow muss ein Array von Pfaden sein."));
  } else {
    for (const entry of input.allow) {
      if (typeof entry !== "string" || entry.length === 0) {
        issues.push(error("EDITABILITY_ALLOW_ENTRY_INVALID", `${path}.allow`, "Pfade müssen nicht leere Strings sein."));
      }
    }
  }
  const limits = input.limits;
  if (limits !== undefined && !isObject(limits)) {
    issues.push(error("EDITABILITY_LIMITS_INVALID", `${path}.limits`, "limits muss ein Objekt sein."));
  } else if (isObject(limits)) {
    for (const [key, value] of Object.entries(limits)) {
      if (typeof value !== "boolean" && !Number.isInteger(value)) {
        issues.push(
          error("EDITABILITY_LIMIT_INVALID", `${path}.limits.${key}`, "limits-Werte müssen boolean oder ganze Zahl sein."),
        );
      }
    }
    if (Number.isInteger(limits.minRemainingElements) && (limits.minRemainingElements as number) < 0) {
      issues.push(
        error("EDITABILITY_MIN_INVALID", `${path}.limits.minRemainingElements`, "minRemainingElements darf nicht negativ sein."),
      );
    }
  }
}


function validateElements(elements: unknown[], tagType: TagType | undefined, issues: ValidationIssue[]): void {
  if (elements.length > MAX_ELEMENTS) {
    issues.push(error("LIMIT_ELEMENTS", "elements", `Höchstens ${MAX_ELEMENTS} Elemente pro Template.`));
  }
  const seenIds = new Set<string>();
  const seenOrders = new Set<number>();

  elements.forEach((entry, index) => {
    const path = `elements[${index}]`;
    if (!isObject(entry)) {
      issues.push(error("ELEMENT_INVALID", path, "Element muss ein Objekt sein."));
      return;
    }
    const element = entry;
    const elementId = element.elementId;
    if (typeof elementId !== "string" || !ELEMENT_ID.test(elementId)) {
      issues.push(
        error("ELEMENT_ID_INVALID", `${path}.elementId`, "elementId ist ungültig.", "Erlaubt: cel_[A-Za-z0-9_-]{1,120}"),
      );
    } else if (seenIds.has(elementId)) {
      issues.push(error("ELEMENT_ID_DUPLICATE", `${path}.elementId`, `elementId ${elementId} ist doppelt.`));
    } else {
      seenIds.add(elementId);
    }

    const elementType = element.elementType;
    const catalogEntry =
      typeof elementType === "string" ? ELEMENT_CATALOG[elementType as keyof typeof ELEMENT_CATALOG] : undefined;
    if (!catalogEntry) {
      issues.push(error("ELEMENT_TYPE_UNKNOWN", `${path}.elementType`, `Unbekannter Elementtyp: ${String(elementType)}`));
    } else if (tagType && !catalogEntry.tagTypes.includes(tagType)) {
      issues.push(
        error(
          "ELEMENT_TYPE_NOT_ALLOWED",
          `${path}.elementType`,
          `${catalogEntry.label} ist für den TAG-Typ ${tagType} nicht zulässig.`,
        ),
      );
    }

    const displayOrder = element.displayOrder;
    if (!Number.isInteger(displayOrder) || (displayOrder as number) < 0 || (displayOrder as number) > 999) {
      issues.push(error("ELEMENT_ORDER_INVALID", `${path}.displayOrder`, "displayOrder muss 0 bis 999 sein."));
    } else if (seenOrders.has(displayOrder as number)) {
      issues.push(error("ELEMENT_ORDER_DUPLICATE", `${path}.displayOrder`, `displayOrder ${displayOrder} ist doppelt.`));
    } else {
      seenOrders.add(displayOrder as number);
    }

    if (!VISIBILITIES.includes(String(element.visibility))) {
      issues.push(
        error("ELEMENT_VISIBILITY_INVALID", `${path}.visibility`, `visibility muss einer von ${VISIBILITIES.join(", ")} sein.`),
      );
    }
    if (element.hidden !== undefined && typeof element.hidden !== "boolean") {
      issues.push(error("ELEMENT_HIDDEN_INVALID", `${path}.hidden`, "hidden muss boolean sein."));
    }
    if (element.locked !== undefined && typeof element.locked !== "boolean") {
      issues.push(error("ELEMENT_LOCKED_INVALID", `${path}.locked`, "locked muss boolean sein."));
    }

    validatePlacement(element.placement, `${path}.placement`, issues);
    if (element.style !== undefined) validateStyle(element.style, `${path}.style`, issues);
    if (element.actions !== undefined) validateActions(element.actions, `${path}.actions`, issues);
    if (element.content !== undefined) validateContent(element.content, `${path}.content`, issues);
    if (element.editability !== undefined) validateEditability(element.editability, `${path}.editability`, issues);

    if (element.bindings !== undefined) {
      if (!isObject(element.bindings)) {
        issues.push(error("BINDINGS_INVALID", `${path}.bindings`, "bindings muss ein Objekt sein."));
      } else {
        for (const [field, binding] of Object.entries(element.bindings)) {
          if (!isObject(binding) || typeof binding.from !== "string") {
            issues.push(error("BINDING_INVALID", `${path}.bindings.${field}`, "Binding braucht ein from-Feld."));
          } else if (!isKnownBindingSource(binding.from)) {
            issues.push(
              error(
                "BINDING_SOURCE_UNKNOWN",
                `${path}.bindings.${field}`,
                `Unbekannte Quelle: ${binding.from}`,
                "Erlaubt sind tag.displayName, tag.id und literal.",
              ),
            );
          }
        }
      }
    }

    const slots = element.slots;
    if (slots !== undefined) {
      if (!Array.isArray(slots)) {
        issues.push(error("SLOTS_INVALID", `${path}.slots`, "slots muss ein Array sein."));
      } else {
        if (slots.length > MAX_SLOTS_PER_ELEMENT) {
          issues.push(error("SLOTS_LIMIT", `${path}.slots`, `Höchstens ${MAX_SLOTS_PER_ELEMENT} Slots pro Element.`));
        }
        const slotIds = new Set<string>();
        slots.forEach((slot, slotIndex) => {
          const slotPath = `${path}.slots[${slotIndex}]`;
          validateSlot(slot, slotPath, issues);
          const slotId = isObject(slot) ? slot.slotId : undefined;
          if (typeof slotId === "string") {
            if (slotIds.has(slotId)) {
              issues.push(error("SLOT_ID_DUPLICATE", `${slotPath}.slotId`, `slotId ${slotId} ist doppelt.`));
            }
            slotIds.add(slotId);
          }
        });
      }
    }

    if (element.payload === undefined || !isObject(element.payload)) {
      issues.push(error("PAYLOAD_INVALID", `${path}.payload`, "payload muss ein Objekt sein."));
    }
  });
}


function validatePlacement(input: unknown, path: string, issues: ValidationIssue[]): void {
  if (input === undefined) return;
  if (!isObject(input)) {
    issues.push(error("PLACEMENT_INVALID", path, "placement muss ein Objekt sein."));
    return;
  }
  const span = input.span;
  if (span !== undefined) {
    if (!isObject(span)) {
      issues.push(error("PLACEMENT_SPAN_INVALID", `${path}.span`, "span muss ein Objekt sein."));
    } else {
      for (const [breakpoint, value] of Object.entries(span)) {
        const validBreakpoint = ["mobile", "tablet", "desktop"].includes(breakpoint);
        if (!validBreakpoint || !Number.isInteger(value) || (value as number) < 1 || (value as number) > 12) {
          issues.push(
            error(
              "PLACEMENT_SPAN_VALUE_INVALID",
              `${path}.span.${breakpoint}`,
              "span muss eine ganze Zahl von 1 bis 12 sein.",
            ),
          );
        }
      }
    }
  }
  const order = input.order;
  if (order !== undefined) {
    if (!isObject(order)) {
      issues.push(error("PLACEMENT_ORDER_INVALID", `${path}.order`, "order muss ein Objekt sein."));
    } else {
      for (const [breakpoint, value] of Object.entries(order)) {
        const validBreakpoint = ["mobile", "tablet", "desktop"].includes(breakpoint);
        if (!validBreakpoint || !Number.isInteger(value) || (value as number) < 0 || (value as number) > 999) {
          issues.push(
            error(
              "PLACEMENT_ORDER_VALUE_INVALID",
              `${path}.order.${breakpoint}`,
              "order muss eine ganze Zahl von 0 bis 999 sein.",
            ),
          );
        }
      }
    }
  }
  if (input.align !== undefined && !["start", "stretch", "center"].includes(String(input.align))) {
    issues.push(error("PLACEMENT_ALIGN_INVALID", `${path}.align`, "align muss start, stretch oder center sein."));
  }
}

function validateStyle(input: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isObject(input)) {
    issues.push(error("STYLE_INVALID", path, "style muss ein Objekt sein."));
    return;
  }
  if (input.background !== undefined) {
    if (!isObject(input.background) || !isColorValue(input.background.color)) {
      issues.push(error("STYLE_BACKGROUND_INVALID", `${path}.background`, "Hintergrund braucht eine gültige Farbe."));
    }
  }
  for (const key of ["headingColor", "textColor"]) {
    if (input[key] !== undefined && !isColorValue(input[key])) {
      issues.push(error("STYLE_COLOR_INVALID", `${path}.${key}`, "Farbe muss #rrggbb oder ein Palettentoken sein."));
    }
  }
  if (input.padding !== undefined && !["none", "sm", "md", "lg"].includes(String(input.padding))) {
    issues.push(error("STYLE_PADDING_INVALID", `${path}.padding`, "padding muss none, sm, md oder lg sein."));
  }
}

