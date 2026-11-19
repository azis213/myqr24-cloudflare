import type { Principal, TemplateElement, Visibility } from "../domain/types";

export const SAMPLE_SCHEMA = "myqr24-tag-content-sample-v1";
export const SAMPLE_SCHEMA_VERSION = 1;

export interface SampleMedia {
  contentId: string;
  alt: string;
  caption?: string;
  variants: { thumb: string; large: string };
}

export interface SampleDocument {
  contentId: string;
  title: string;
  kind?: DocumentKind;
  description?: string;
  variant?: string;
  availableLabel?: string;
}

export type DocumentKind = "menu" | "invitation" | "thank-you" | "other";

export interface SampleEntry {
  contentId: string;
  date: string;
  title: string;
  summary?: string;
  technician?: string;
  status?: "done" | "open";
  documentIds?: string[];
}

export interface SampleContribution {
  contentId: string;
  principal: "guest" | "owner";
  mediaId: string;
  state: "ready" | "pending";
  ownerName?: string;
  /** Markiert den Beitrag der aktuell simulierten Person (Gast sieht eigene `pending`). */
  isOwn?: boolean;
}

/** Beispieldaten zu einem Template – reiner Editor-Kontext, nie Teil des Artefakts. */
export interface TagSample {
  schema: string;
  schemaVersion: number;
  tag: { id: string; displayName: string };
  media: SampleMedia[];
  documents: SampleDocument[];
  entries: SampleEntry[];
  contributions: SampleContribution[];
  slotFill: Record<string, Record<string, string[]>>;
}

export interface SampleIssue {
  code: string;
  path: string;
  message: string;
}

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  menu: "Speisekarte",
  invitation: "Einladung",
  "thank-you": "Dankeschön",
  other: "Dokument",
};

const SAFE_MEDIA_PATH = /^(\/(?!\/)[\w./-]+|https:\/\/[^\s"'<>]+)$/;
const CONTENT_ID = /^[a-z][a-z0-9_]{1,63}$/;

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const isSafePath = (value: unknown): value is string =>
  typeof value === "string" && SAFE_MEDIA_PATH.test(value);

/**
 * Prüft eine `sample.json`. Fehler blockieren die Vorschau nicht: Was nicht
 * validiert ist, wird nicht angezeigt – der Editor bleibt nutzbar.
 */
export function parseSample(input: unknown): { sample: TagSample | null; issues: SampleIssue[] } {
  const issues: SampleIssue[] = [];
  const fail = (code: string, path: string, message: string) => issues.push({ code, path, message });

  if (!isObject(input)) {
    fail("SAMPLE_NOT_AN_OBJECT", "", "Die Beispieldaten enthalten kein JSON-Objekt.");
    return { sample: null, issues };
  }
  if (input.schema !== SAMPLE_SCHEMA) fail("SAMPLE_SCHEMA_UNKNOWN", "schema", `Erwartet wird ${SAMPLE_SCHEMA}.`);
  if (input.schemaVersion !== SAMPLE_SCHEMA_VERSION) {
    fail("SAMPLE_SCHEMA_VERSION_UNSUPPORTED", "schemaVersion", `Erwartet wird schemaVersion ${SAMPLE_SCHEMA_VERSION}.`);
  }

  const tag = isObject(input.tag) ? input.tag : {};
  if (typeof tag.id !== "string" || typeof tag.displayName !== "string") {
    fail("SAMPLE_TAG_INVALID", "tag", "tag.id und tag.displayName müssen Strings sein.");
  }

  const media: SampleMedia[] = [];
  const seenIds = new Set<string>();
  const claimId = (value: unknown, path: string): value is string => {
    if (typeof value !== "string" || !CONTENT_ID.test(value)) {
      fail("SAMPLE_CONTENT_ID_INVALID", path, "contentId ist ungültig.", );
      return false;
    }
    if (seenIds.has(value)) {
      fail("SAMPLE_CONTENT_ID_DUPLICATE", path, `Doppelte contentId: ${value}`);
      return false;
    }
    seenIds.add(value);
    return true;
  };

  if (!Array.isArray(input.media)) {
    fail("SAMPLE_MEDIA_INVALID", "media", "media muss ein Array sein.");
  } else {
    input.media.forEach((entry, index) => {
      const path = `media[${index}]`;
      if (!isObject(entry)) {
        fail("SAMPLE_MEDIA_ENTRY_INVALID", path, "Eintrag muss ein Objekt sein.");
        return;
      }
      if (!claimId(entry.contentId, `${path}.contentId`)) return;
      if (typeof entry.alt !== "string" || entry.alt.trim().length === 0) {
        fail("SAMPLE_MEDIA_ALT_MISSING", `${path}.alt`, "alt fehlt (wird als Alternativtext angezeigt).");
        return;
      }
      const variants = isObject(entry.variants) ? entry.variants : {};
      const thumb = variants.thumb;
      const large = variants.large ?? thumb;
      if (!isSafePath(thumb)) {
        fail("SAMPLE_MEDIA_PATH_INVALID", `${path}.variants.thumb`, "Nur /pfad oder https:// erlaubt (kein data:).");
        return;
      }
      if (!isSafePath(large)) {
        fail("SAMPLE_MEDIA_PATH_INVALID", `${path}.variants.large`, "Nur /pfad oder https:// erlaubt (kein data:).");
        return;
      }
      media.push({
        contentId: entry.contentId as string,
        alt: entry.alt,
        ...(typeof entry.caption === "string" && entry.caption.length > 0 ? { caption: entry.caption } : {}),
        variants: { thumb, large },
      });
    });
  }

  const documents: SampleDocument[] = [];
  if (input.documents !== undefined && !Array.isArray(input.documents)) {
    fail("SAMPLE_DOCUMENTS_INVALID", "documents", "documents muss ein Array sein.");
  } else {
    (input.documents ?? []).forEach((entry, index) => {
      const path = `documents[${index}]`;
      if (!isObject(entry)) {
        fail("SAMPLE_DOCUMENT_ENTRY_INVALID", path, "Eintrag muss ein Objekt sein.");
        return;
      }
      if (!claimId(entry.contentId, `${path}.contentId`)) return;
      if (typeof entry.title !== "string" || entry.title.trim().length === 0) {
        fail("SAMPLE_DOCUMENT_TITLE_MISSING", `${path}.title`, "title fehlt.");
        return;
      }
      const kind = entry.kind;
      if (kind !== undefined && (typeof kind !== "string" || !(kind in DOCUMENT_KIND_LABELS))) {
        fail("SAMPLE_DOCUMENT_KIND_INVALID", `${path}.kind`, `Unbekannte Art: ${String(kind)}`);
        return;
      }
      if (entry.variant !== undefined && !isSafePath(entry.variant)) {
        fail("SAMPLE_DOCUMENT_PATH_INVALID", `${path}.variant`, "Nur /pfad oder https:// erlaubt (kein data:).");
        return;
      }
      documents.push({
        contentId: entry.contentId as string,
        title: entry.title,
        ...(typeof kind === "string" ? { kind: kind as DocumentKind } : {}),
        ...(typeof entry.description === "string" && entry.description.length > 0
          ? { description: entry.description }
          : {}),
        ...(typeof entry.variant === "string" ? { variant: entry.variant } : {}),
        ...(typeof entry.availableLabel === "string" ? { availableLabel: entry.availableLabel } : {}),
      });
    });
  }

  const entries: SampleEntry[] = [];
  if (input.entries !== undefined && !Array.isArray(input.entries)) {
    fail("SAMPLE_ENTRIES_INVALID", "entries", "entries muss ein Array sein.");
  } else {
    (input.entries ?? []).forEach((entry, index) => {
      const path = `entries[${index}]`;
      if (!isObject(entry)) {
        fail("SAMPLE_ENTRY_INVALID", path, "Eintrag muss ein Objekt sein.");
        return;
      }
      if (!claimId(entry.contentId, `${path}.contentId`)) return;
      if (typeof entry.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
        fail("SAMPLE_ENTRY_DATE_INVALID", `${path}.date`, "date muss JJJJ-MM-TT sein.");
        return;
      }
      if (typeof entry.title !== "string" || entry.title.trim().length === 0) {
        fail("SAMPLE_ENTRY_TITLE_MISSING", `${path}.title`, "title fehlt.");
        return;
      }
      const documentIds = Array.isArray(entry.documentIds)
        ? entry.documentIds.filter((value): value is string => typeof value === "string")
        : undefined;
      entries.push({
        contentId: entry.contentId as string,
        date: entry.date,
        title: entry.title,
        ...(typeof entry.summary === "string" && entry.summary.length > 0 ? { summary: entry.summary } : {}),
        ...(typeof entry.technician === "string" && entry.technician.length > 0
          ? { technician: entry.technician }
          : {}),
        ...(entry.status === "done" || entry.status === "open" ? { status: entry.status } : {}),
        ...(documentIds && documentIds.length > 0 ? { documentIds } : {}),
      });
    });
  }


  const contributions: SampleContribution[] = [];
  if (input.contributions !== undefined && !Array.isArray(input.contributions)) {
    fail("SAMPLE_CONTRIBUTIONS_INVALID", "contributions", "contributions muss ein Array sein.");
  } else {
    (input.contributions ?? []).forEach((entry, index) => {
      const path = `contributions[${index}]`;
      if (!isObject(entry)) {
        fail("SAMPLE_CONTRIBUTION_INVALID", path, "Eintrag muss ein Objekt sein.");
        return;
      }
      if (!claimId(entry.contentId, `${path}.contentId`)) return;
      if (typeof entry.mediaId !== "string" || !media.some((item) => item.contentId === entry.mediaId)) {
        fail("SAMPLE_CONTRIBUTION_MEDIA_UNKNOWN", `${path}.mediaId`, `Unbekanntes Medium: ${String(entry.mediaId)}`);
        return;
      }
      contributions.push({
        contentId: entry.contentId as string,
        principal: entry.principal === "owner" ? "owner" : "guest",
        mediaId: entry.mediaId,
        state: entry.state === "pending" ? "pending" : "ready",
        ...(typeof entry.ownerName === "string" ? { ownerName: entry.ownerName } : {}),
        ...(entry.isOwn === true ? { isOwn: true } : {}),
      });
    });
  }

  const slotFill: Record<string, Record<string, string[]>> = {};
  if (input.slotFill !== undefined && !isObject(input.slotFill)) {
    fail("SAMPLE_SLOT_FILL_INVALID", "slotFill", "slotFill muss ein Objekt sein.");
  } else {
    for (const [elementId, slots] of Object.entries(isObject(input.slotFill) ? input.slotFill : {})) {
      if (!isObject(slots)) {
        fail("SAMPLE_SLOT_FILL_INVALID", `slotFill.${elementId}`, "Slots müssen ein Objekt sein.");
        continue;
      }
      const filled: Record<string, string[]> = {};
      for (const [slotId, ids] of Object.entries(slots)) {
        if (!Array.isArray(ids)) {
          fail("SAMPLE_SLOT_FILL_INVALID", `slotFill.${elementId}.${slotId}`, "Werte müssen Arrays sein.");
          continue;
        }
        filled[slotId] = ids.filter((value): value is string => typeof value === "string");
      }
      slotFill[elementId] = filled;
    }
  }

  if (issues.length > 0) return { sample: null, issues };
  return {
    sample: {
      schema: SAMPLE_SCHEMA,
      schemaVersion: SAMPLE_SCHEMA_VERSION,
      tag: { id: tag.id as string, displayName: tag.displayName as string },
      media,
      documents,
      entries,
      contributions,
      slotFill,
    },
    issues,
  };
}

/**
 * Sichtbarkeit gemäß `40-TAG-APP-DATA-MODEL` §4: `shared` benötigt eine
 * PIN-/Login-Session, `private`/`ownerOnly` liefert die Content-Route nicht aus.
 */
export function visibleFor(visibility: Visibility, principal: Principal): boolean {
  switch (visibility) {
    case "public":
      return true;
    case "shared":
      return principal === "guest" || principal === "owner";
    case "private":
    case "ownerOnly":
      return principal === "owner";
    default:
      return false;
  }
}

/** `private`/`ownerOnly` erscheinen in der Vorschau, aber mit Hinweis auf die Content-Route. */
export function isOwnerOnlyInPreview(visibility: Visibility): boolean {
  return visibility === "private" || visibility === "ownerOnly";
}

/** Content-IDs, die ein Element in einem Slot hält. */
export function slotContentIds(element: TemplateElement, slotId: string, sample: TagSample | null | undefined): string[] {
  if (!sample) return [];
  const ids = sample.slotFill[element.elementId]?.[slotId];
  return Array.isArray(ids) ? ids : [];
}

/** Medien eines Slots in der Reihenfolge der Beispieldaten; unbekannte IDs fallen weg. */
export function resolveSlotMedia(
  element: TemplateElement,
  slotId: string,
  sample: TagSample | null | undefined,
): SampleMedia[] {
  const ids = slotContentIds(element, slotId, sample);
  if (!sample) return [];
  return ids
    .map((contentId) => sample.media.find((item) => item.contentId === contentId))
    .filter((item): item is SampleMedia => item !== undefined);
}

/** Dokumente eines Slots; `variant` bleibt der Beispielpfad, nicht Teil des Templates. */
export function resolveSlotDocuments(
  element: TemplateElement,
  slotId: string,
  sample: TagSample | null | undefined,
): SampleDocument[] {
  const ids = slotContentIds(element, slotId, sample);
  if (!sample) return [];
  return ids
    .map((contentId) => sample.documents.find((item) => item.contentId === contentId))
    .filter((item): item is SampleDocument => item !== undefined);
}

export interface GalleryItem {
  media: SampleMedia;
  contribution?: SampleContribution;
}

/**
 * Galerie-Inhalte der Rolle: freigegebene Bilder für alle, eigene `pending`-Beiträge
 * zusätzlich für den Gast, alle `pending` für den Owner.
 */
export function galleryItems(
  element: TemplateElement,
  sample: TagSample | null | undefined,
  principal: Principal,
): GalleryItem[] {
  const media = resolveSlotMedia(element, "images", sample);
  if (!sample) return media.map((item) => ({ media: item }));
  return media.map((item) => {
    const contribution = sample.contributions.find((entry) => entry.mediaId === item.contentId);
    return contribution ? { media: item, contribution } : { media: item };
  }).filter((item) => {
    const state = item.contribution?.state;
    if (!state || state === "ready") return true;
    if (principal === "owner") return true;
    if (principal === "guest" && item.contribution?.isOwn) return true;
    return false;
  });
}

/** Wartungseinträge: Slot-Zuordnung, sonst alle Einträge; neueste zuerst. */
export function maintenanceEntriesFor(
  element: TemplateElement,
  sample: TagSample | null | undefined,
): SampleEntry[] {
  if (!sample) return [];
  const ids = slotContentIds(element, "entries", sample);
  const pool = ids.length > 0
    ? ids.map((contentId) => sample.entries.find((entry) => entry.contentId === contentId))
    : sample.entries;
  return pool
    .filter((entry): entry is SampleEntry => entry !== undefined)
    .slice()
    .sort((left, right) => right.date.localeCompare(left.date));
}

/** Gruppierung nach Jahr für `payload.groupBy === "year"`. */
export function groupEntriesByYear(entries: SampleEntry[]): Array<{ year: string; entries: SampleEntry[] }> {
  const groups: Array<{ year: string; entries: SampleEntry[] }> = [];
  for (const entry of entries) {
    const year = entry.date.slice(0, 4);
    const group = groups.find((item) => item.year === year);
    if (group) group.entries.push(entry);
    else groups.push({ year, entries: [entry] });
  }
  return groups;
}

export function documentKindLabel(document: SampleDocument): string {
  return DOCUMENT_KIND_LABELS[document.kind ?? "other"];
}

