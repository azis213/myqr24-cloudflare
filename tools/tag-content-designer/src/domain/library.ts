import { ELEMENT_CATALOG } from "./catalog";
import { error, type ValidationIssue } from "./errors";
import { LIBRARY_SCHEMA, LIBRARY_SCHEMA_VERSION, ITEM_MODES } from "./types";
import type { ElementLibrary, ElementTemplate } from "./types";

export type LibraryChangeAction = "added" | "replaced" | "unchanged" | "ignored-older";

export interface LibraryChange {
  elementTemplateId: string;
  action: LibraryChangeAction;
  fromVersion?: number;
  toVersion: number;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const LIBRARY_ID = /^[a-z][a-z0-9_]{2,63}$/;
const SLOT_ID = /^[a-z][a-z0-9-]{0,31}$/;

export function validateLibrary(input: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isObject(input)) {
    issues.push(error("LIBRARY_NOT_AN_OBJECT", "", "Die Datei enthält kein JSON-Objekt."));
    return issues;
  }
  if (input.schema !== LIBRARY_SCHEMA) {
    issues.push(
      error(
        "LIBRARY_SCHEMA_UNKNOWN",
        "schema",
        `Erwartet wird ${LIBRARY_SCHEMA}.`,
        "Nur *.tagelements.json dieses Tools laden.",
      ),
    );
  }
  if (input.schemaVersion !== LIBRARY_SCHEMA_VERSION) {
    issues.push(
      error("LIBRARY_SCHEMA_VERSION_UNSUPPORTED", "schemaVersion", `Erwartet wird schemaVersion ${LIBRARY_SCHEMA_VERSION}.`),
    );
  }
  if (!Number.isInteger(input.libraryVersion) || (input.libraryVersion as number) < 1) {
    issues.push(error("LIBRARY_VERSION_INVALID", "libraryVersion", "libraryVersion muss eine ganze Zahl ab 1 sein."));
  }
  if (!Array.isArray(input.elements)) {
    issues.push(error("LIBRARY_ELEMENTS_MISSING", "elements", "elements muss ein Array sein."));
    return issues;
  }

  const seen = new Set<string>();
  input.elements.forEach((entry, index) => {
    const path = `elements[${index}]`;
    if (!isObject(entry)) {
      issues.push(error("LIBRARY_ELEMENT_INVALID", path, "Eintrag muss ein Objekt sein."));
      return;
    }
    const id = entry.elementTemplateId;
    if (typeof id !== "string" || !LIBRARY_ID.test(id)) {
      issues.push(
        error(
          "LIBRARY_ELEMENT_ID_INVALID",
          `${path}.elementTemplateId`,
          "elementTemplateId ist ungültig.",
          "Erlaubt: [a-z][a-z0-9_]{2,63}",
        ),
      );
    } else if (seen.has(id)) {
      issues.push(error("LIBRARY_ELEMENT_ID_DUPLICATE", `${path}.elementTemplateId`, `Doppelte ID: ${id}`));
    } else {
      seen.add(id);
    }
    if (!Number.isInteger(entry.elementTemplateVersion) || (entry.elementTemplateVersion as number) < 1) {
      issues.push(
        error("LIBRARY_ELEMENT_VERSION_INVALID", `${path}.elementTemplateVersion`, "Version muss eine ganze Zahl ab 1 sein."),
      );
    }
    const elementType = entry.elementType;
    if (typeof elementType !== "string" || !(elementType in ELEMENT_CATALOG)) {
      issues.push(
        error("LIBRARY_ELEMENT_TYPE_UNKNOWN", `${path}.elementType`, `Unbekannter Elementtyp: ${String(elementType)}`),
      );
    }
    if (typeof entry.label !== "string" || entry.label.trim().length === 0) {
      issues.push(error("LIBRARY_ELEMENT_LABEL_INVALID", `${path}.label`, "label fehlt."));
    }
    if (!isObject(entry.payload)) {
      issues.push(error("LIBRARY_ELEMENT_PAYLOAD_INVALID", `${path}.payload`, "payload muss ein Objekt sein."));
    }
    if (entry.items !== undefined) {
      if (
        !isObject(entry.items) ||
        typeof entry.items.mode !== "string" ||
        !(ITEM_MODES as readonly string[]).includes(entry.items.mode)
      ) {
        issues.push(
          error(
            "LIBRARY_ELEMENT_ITEMS_INVALID",
            `${path}.items`,
            'items.mode muss "none" oder "dynamic" sein.',
          ),
        );
      } else if (typeof elementType === "string" && elementType in ELEMENT_CATALOG) {
        const expected = ELEMENT_CATALOG[elementType as keyof typeof ELEMENT_CATALOG].items.mode;
        if (entry.items.mode !== expected) {
          issues.push(
            error(
              "LIBRARY_ELEMENT_ITEMS_MISMATCH",
              `${path}.items.mode`,
              `Der Elementtyp erwartet mode "${expected}".`,
            ),
          );
        }
      }
    }
    if (entry.slots !== undefined) {
      if (!Array.isArray(entry.slots)) {
        issues.push(error("LIBRARY_ELEMENT_SLOTS_INVALID", `${path}.slots`, "slots muss ein Array sein."));
      } else {
        entry.slots.forEach((slot, slotIndex) => {
          if (!isObject(slot) || typeof slot.slotId !== "string" || !SLOT_ID.test(slot.slotId)) {
            issues.push(error("LIBRARY_SLOT_INVALID", `${path}.slots[${slotIndex}].slotId`, "slotId ist ungültig."));
          }
          if (
            isObject(slot) &&
            Number.isInteger(slot.min) &&
            Number.isInteger(slot.max) &&
            (slot.min as number) > (slot.max as number)
          ) {
            issues.push(
              error("LIBRARY_SLOT_RANGE_INVALID", `${path}.slots[${slotIndex}]`, "min darf nicht größer als max sein."),
            );
          }
        });
      }
    }
  });
  return issues;
}

export function isElementLibrary(value: unknown): value is ElementLibrary {
  return validateLibrary(value).every((entry) => entry.severity !== "error");
}

export function emptyLibrary(): ElementLibrary {
  return { schema: LIBRARY_SCHEMA, schemaVersion: LIBRARY_SCHEMA_VERSION, libraryVersion: 1, elements: [] };
}

/** Merge: neue ID ergänzen, höhere Version ersetzen, gleiche Version unverändert, ältere ignorieren. */
export function mergeLibraries(
  base: ElementLibrary,
  incoming: ElementLibrary,
): { library: ElementLibrary; changes: LibraryChange[] } {
  const elements: ElementTemplate[] = base.elements.map((entry) => structuredClone(entry));
  const changes: LibraryChange[] = [];

  for (const candidate of incoming.elements) {
    const index = elements.findIndex((entry) => entry.elementTemplateId === candidate.elementTemplateId);
    if (index === -1) {
      elements.push(structuredClone(candidate));
      changes.push({
        elementTemplateId: candidate.elementTemplateId,
        action: "added",
        toVersion: candidate.elementTemplateVersion,
      });
      continue;
    }
    const existing = elements[index];
    if (candidate.elementTemplateVersion > existing.elementTemplateVersion) {
      elements[index] = structuredClone(candidate);
      changes.push({
        elementTemplateId: candidate.elementTemplateId,
        action: "replaced",
        fromVersion: existing.elementTemplateVersion,
        toVersion: candidate.elementTemplateVersion,
      });
    } else if (candidate.elementTemplateVersion === existing.elementTemplateVersion) {
      changes.push({
        elementTemplateId: candidate.elementTemplateId,
        action: "unchanged",
        toVersion: candidate.elementTemplateVersion,
      });
    } else {
      changes.push({
        elementTemplateId: candidate.elementTemplateId,
        action: "ignored-older",
        fromVersion: existing.elementTemplateVersion,
        toVersion: candidate.elementTemplateVersion,
      });
    }
  }

  const libraryVersion = Math.max(base.libraryVersion, incoming.libraryVersion);
  return {
    library: { ...base, elements, libraryVersion, updatedAt: new Date().toISOString() },
    changes,
  };
}

export function bumpLibrary(library: ElementLibrary): ElementLibrary {
  return { ...library, libraryVersion: library.libraryVersion + 1, updatedAt: new Date().toISOString() };
}

