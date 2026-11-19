import { PRESENTATIONS, TAG_TYPES } from "./catalog";
import { error, type ValidationIssue } from "./errors";
import type { Presentation, TagType } from "./types";

export const EXAMPLES_SCHEMA = "myqr24-tag-content-examples-v1";
export const EXAMPLES_SCHEMA_VERSION = 1;

/** Ein Beispiel-Template mit dem optionalen Pfad zu seinen Testdaten. */
export interface ExampleEntry {
  id: string;
  label: string;
  group: string;
  templatePath: string;
  samplePath?: string;
  tagType: TagType;
  presentation: Presentation;
  description?: string;
}

export interface ExampleIndex {
  schema: typeof EXAMPLES_SCHEMA;
  schemaVersion: number;
  examples: ExampleEntry[];
}

export interface ExampleIndexResult {
  index: ExampleIndex | null;
  issues: ValidationIssue[];
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const EXAMPLE_ID = /^[a-z][a-z0-9-]{1,63}$/;
const TEMPLATE_PATH = /^\/templates\/examples\/[a-z0-9-]+\/template\.tagcontent\.json$/;
const SAMPLE_PATH = /^\/templates\/examples\/[a-z0-9-]+\/sample\.json$/;

/**
 * Prüft das Beispiel-Manifest (`public/templates/examples/index.json`).
 * Pfade sind bewusst auf den Beispiel-Ordner begrenzt: Ein Manifest darf keine
 * beliebigen Dateien aus dem Tool laden.
 */
export function parseExampleIndex(input: unknown): ExampleIndexResult {
  const issues: ValidationIssue[] = [];
  if (!isObject(input)) {
    issues.push(error("EXAMPLES_NOT_AN_OBJECT", "", "Das Manifest enthält kein JSON-Objekt."));
    return { index: null, issues };
  }
  if (input.schema !== EXAMPLES_SCHEMA) {
    issues.push(error("EXAMPLES_SCHEMA_UNKNOWN", "schema", `Erwartet wird ${EXAMPLES_SCHEMA}.`));
  }
  if (input.schemaVersion !== EXAMPLES_SCHEMA_VERSION) {
    issues.push(
      error("EXAMPLES_SCHEMA_VERSION_UNSUPPORTED", "schemaVersion", `Erwartet wird schemaVersion ${EXAMPLES_SCHEMA_VERSION}.`),
    );
  }
  if (!Array.isArray(input.examples) || input.examples.length === 0) {
    issues.push(error("EXAMPLES_MISSING", "examples", "examples muss ein nicht leeres Array sein."));
    return { index: null, issues };
  }

  const seen = new Set<string>();
  const examples: ExampleEntry[] = [];
  input.examples.forEach((entry, index) => {
    const path = `examples[${index}]`;
    let failed = false;
    const fail = (issue: ValidationIssue) => {
      issues.push(issue);
      failed = true;
    };
    if (!isObject(entry)) {
      fail(error("EXAMPLES_ENTRY_INVALID", path, "Eintrag muss ein Objekt sein."));
      return;
    }
    const id = entry.id;
    if (typeof id !== "string" || !EXAMPLE_ID.test(id)) {
      fail(error("EXAMPLES_ID_INVALID", `${path}.id`, "id ist ungültig.", "Erlaubt: [a-z][a-z0-9-]{1,63}"));
      return;
    }
    if (seen.has(id)) {
      fail(error("EXAMPLES_ID_DUPLICATE", `${path}.id`, `Doppelte Beispiel-ID: ${id}`));
      return;
    }
    seen.add(id);

    const templatePath = entry.templatePath;
    if (typeof templatePath !== "string" || !TEMPLATE_PATH.test(templatePath)) {
      fail(
        error(
          "EXAMPLES_TEMPLATE_PATH_INVALID",
          `${path}.templatePath`,
          "templatePath muss /templates/examples/<id>/template.tagcontent.json sein.",
        ),
      );
    }
    const samplePath = entry.samplePath;
    if (samplePath !== undefined && (typeof samplePath !== "string" || !SAMPLE_PATH.test(samplePath))) {
      fail(
        error("EXAMPLES_SAMPLE_PATH_INVALID", `${path}.samplePath`, "samplePath muss /templates/examples/<id>/sample.json sein."),
      );
    }
    const label = typeof entry.label === "string" ? entry.label.trim() : "";
    if (label.length === 0) {
      fail(error("EXAMPLES_LABEL_MISSING", `${path}.label`, "label fehlt."));
    }
    const tagType = entry.tagType;
    if (typeof tagType !== "string" || !(TAG_TYPES as readonly string[]).includes(tagType)) {
      fail(error("EXAMPLES_TAG_TYPE_INVALID", `${path}.tagType`, `Unbekannter TAG-Typ: ${String(tagType)}`));
    }
    const presentation = entry.presentation;
    if (typeof presentation !== "string" || !(PRESENTATIONS as readonly string[]).includes(presentation)) {
      fail(
        error("EXAMPLES_PRESENTATION_INVALID", `${path}.presentation`, `Unbekannte Präsentation: ${String(presentation)}`),
      );
    }
    if (failed) return;

    examples.push({
      id,
      label,
      group: typeof entry.group === "string" && entry.group.trim().length > 0 ? entry.group.trim() : "Beispiele",
      templatePath: templatePath as string,
      ...(typeof samplePath === "string" ? { samplePath } : {}),
      tagType: tagType as TagType,
      presentation: presentation as Presentation,
      ...(typeof entry.description === "string" && entry.description.trim().length > 0
        ? { description: entry.description.trim() }
        : {}),
    });
  });

  const blocking = issues.some((issue) => issue.severity === "error");
  if (blocking) return { index: null, issues };
  return { index: { schema: EXAMPLES_SCHEMA, schemaVersion: EXAMPLES_SCHEMA_VERSION, examples }, issues };
}

/** Einträge für die Vorlagenauswahl in der Kopfzeile. */
export function exampleTemplateRefs(index: ExampleIndex): Array<{
  id: string;
  label: string;
  path: string;
  group?: string;
  description?: string;
  samplePath?: string;
}> {
  return index.examples.map((entry) => ({
    id: entry.id,
    label: entry.label,
    path: entry.templatePath,
    group: entry.group,
    description: entry.description,
    samplePath: entry.samplePath,
  }));
}
