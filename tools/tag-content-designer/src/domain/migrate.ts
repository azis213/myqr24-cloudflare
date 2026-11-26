import { defaultItemsFor } from "./catalog";
import { DocumentError } from "./errors";
import { ITEM_MODES, SCHEMA_VERSION } from "./types";

export interface MigrationStep {
  from: number;
  to: number;
  description: string;
  apply: (document: Record<string, unknown>) => { document: Record<string, unknown>; changes: string[] };
}

export interface MigrationResult {
  document: Record<string, unknown>;
  changes: string[];
  from: number;
  to: number;
  migrated: boolean;
}

/**
 * Kumulative Migrationskette. Jede Stufe ist eine pure Funktion
 * (kein Netzwerk, keine Zeit, kein Zufall) und wird der Reihe nach ausgeführt.
 */
export const MIGRATIONS: MigrationStep[] = [
  {
    from: 1,
    to: 2,
    description: "Überschrift in den Absatzfluss überführen (paragraph.heading)",
    apply: (document) => {
      const changes: string[] = [];
      const elements = document.elements;
      if (!Array.isArray(elements)) return { document, changes };

      const migrated = elements.map((entry, index) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;
        const element = entry as Record<string, unknown>;
        const content = element.content;
        if (!content || typeof content !== "object" || Array.isArray(content)) return entry;
        const rich = content as Record<string, unknown>;
        if (typeof rich.heading !== "string") return entry;

        const text = rich.heading.trim();
        const paragraphs = Array.isArray(rich.paragraphs) ? [...rich.paragraphs] : [];
        delete rich.heading;
        if (text.length > 0) {
          paragraphs.unshift({ heading: 3, runs: [{ text }] });
        }
        rich.paragraphs = paragraphs;
        changes.push(
          `elements[${index}].content.heading → Überschrift 3 im Absatzfluss${text.length === 0 ? " (leer, entfernt)" : ""}`,
        );
        return { ...element, content: rich };
      });

      return { document: { ...document, elements: migrated }, changes };
    },
  },
  {
    from: 2,
    to: 3,
    description: "Tabellenzellen von reinem Text auf Runs umstellen (Farbe/Markierung/Marks)",
    apply: (document) => {
      const changes: string[] = [];
      const elements = document.elements;
      if (!Array.isArray(elements)) return { document, changes };

      /** Wandelt `cell.text` in `cell.runs`; andere Zellen bleiben unverändert. */
      const migrateCell = (cell: unknown): unknown => {
        if (!cell || typeof cell !== "object" || Array.isArray(cell)) return cell;
        const entry = cell as Record<string, unknown>;
        if (Array.isArray(entry.runs) || typeof entry.text !== "string") return cell;
        const { text, ...rest } = entry;
        return { ...rest, runs: text.length > 0 ? [{ text }] : [] };
      };

      const migrated = elements.map((entry, elementIndex) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;
        const element = entry as Record<string, unknown>;
        const content = element.content;
        if (!content || typeof content !== "object" || Array.isArray(content)) return entry;
        const paragraphs = (content as Record<string, unknown>).paragraphs;
        if (!Array.isArray(paragraphs)) return entry;

        let touched = false;
        const nextParagraphs = paragraphs.map((block, blockIndex) => {
          if (!block || typeof block !== "object" || Array.isArray(block)) return block;
          const table = block as Record<string, unknown>;
          if (table.type !== "table" || !Array.isArray(table.rows)) return block;

          const rows = table.rows.map((row, rowIndex) => {
            if (!row || typeof row !== "object" || Array.isArray(row)) return row;
            const cells = (row as Record<string, unknown>).cells;
            if (!Array.isArray(cells)) return row;
            const nextCells = cells.map((cell, cellIndex) => {
              const next = migrateCell(cell);
              if (next !== cell) {
                touched = true;
                changes.push(
                  `elements[${elementIndex}].content.paragraphs[${blockIndex}].rows[${rowIndex}].cells[${cellIndex}].text → runs`,
                );
              }
              return next;
            });
            return { ...(row as Record<string, unknown>), cells: nextCells };
          });

          return { ...table, rows };
        });

        if (!touched) return entry;
        return { ...element, content: { ...(content as Record<string, unknown>), paragraphs: nextParagraphs } };
      });

      return { document: { ...document, elements: migrated }, changes };
    },
  },
  {
    from: 3,
    to: 4,
    description: "Item-Fähigkeit je Element ergänzen (element.items)",
    apply: (document) => {
      const changes: string[] = [];
      const elements = document.elements;
      if (!Array.isArray(elements)) return { document, changes };

      const migrated = elements.map((entry, index) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;
        const element = entry as Record<string, unknown>;
        const elementType = typeof element.elementType === "string" ? element.elementType : "";
        const defaults = defaultItemsFor(elementType as never);
        const current = element.items;
        const validMode =
          !!current &&
          typeof current === "object" &&
          !Array.isArray(current) &&
          ITEM_MODES.includes((current as Record<string, unknown>).mode as never);
        if (validMode) return entry;
        changes.push(`elements[${index}].items → ${defaults.mode}${defaults.slotIds ? ` (${defaults.slotIds.join(", ")})` : ""}`);
        return { ...element, items: defaults };
      });

      return { document: { ...document, elements: migrated }, changes };
    },
  },
];

export function migrateDocument(
  input: unknown,
  steps: MigrationStep[] = MIGRATIONS,
  target: number = SCHEMA_VERSION,
): MigrationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new DocumentError("DOCUMENT_NOT_AN_OBJECT", "Die Datei enthält kein JSON-Objekt.");
  }
  const document = structuredClone(input) as Record<string, unknown>;
  const rawVersion = document.schemaVersion;
  if (typeof rawVersion !== "number" || !Number.isInteger(rawVersion) || rawVersion < 1) {
    throw new DocumentError(
      "SCHEMA_VERSION_MISSING",
      "Die Datei enthält keine gültige schemaVersion.",
      "schemaVersion",
      "Erwartet wird eine ganze Zahl ab 1.",
    );
  }
  const from = rawVersion;
  if (from > target) {
    throw new DocumentError(
      "SCHEMA_TOO_NEW",
      `Die Datei wurde mit einer neueren Tool-Version erstellt (schemaVersion ${from}).`,
      "schemaVersion",
      "Bitte das Tool aktualisieren; ein Teilimport findet nicht statt.",
    );
  }

  let current = document;
  const changes: string[] = [];
  let version = from;
  while (version < target) {
    const step = steps.find((entry) => entry.from === version);
    if (!step) {
      throw new DocumentError(
        "MIGRATION_STEP_MISSING",
        `Für schemaVersion ${version} existiert keine Migrationsstufe nach ${version + 1}.`,
        "schemaVersion",
        "Die Datei kann in dieser Tool-Version nicht geladen werden; betroffene Felder prüfen oder das Element entfernen.",
      );
    }
    const result = step.apply(current);
    current = result.document;
    changes.push(...result.changes);
    version = step.to;
  }

  current.schemaVersion = target;
  return { document: current, changes, from, to: target, migrated: from !== target };
}
