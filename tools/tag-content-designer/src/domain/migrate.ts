import { DocumentError } from "./errors";
import { SCHEMA_VERSION } from "./types";

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
 * Aktuell existiert nur schemaVersion 1; Stufen werden hier ergänzt.
 */
export const MIGRATIONS: MigrationStep[] = [];

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
