/**
 * Server-side only R2 key derivation.
 *
 * The canonical storage identity is the numeric TAG ID. The Base36 TAG ID is
 * deliberately not part of the key: a codec/secret rotation may change the
 * public representation while the numeric TAG ID remains stable.
 *
 * No client input may be used as an object key. Callers must obtain all
 * segments from validated D1 projections.
 */
export const CONTENT_ROOT = "content/v1";
export const ITEM_FILE_NAME = "item.json";

const NUMERIC_ID = /^[1-9][0-9]{0,15}$/;
const ELEMENT_ID = /^cel_[A-Za-z0-9_-]{1,120}$/;
const CONTENT_FILE = /^[a-z0-9][a-z0-9.-]{0,127}\.json$/;
const VARIANT = /^[a-z0-9][a-z0-9-]{0,63}$/;
const RANGE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const DESCRIPTION_ID = /^[a-z][a-z0-9-]{0,63}$/;
const ITEM_FILE = /^[^/\\\u0000-\u001f\u007f]{1,255}$/u;

function revisionNumber(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError("invalid content revision");
  }
  return value;
}

export function tagContentFileName(revision: number): string {
  return `tag-rev${revisionNumber(revision)}.json`;
}

export function tagElementFileName(revision: number): string {
  return `element-rev${revisionNumber(revision)}.json`;
}

export function descriptionFileName(revision: number): string {
  return `content-rev${revisionNumber(revision)}.json`;
}

function numericSegment(value: number | string): string {
  const text = typeof value === "number" ? String(value) : value;
  if (!NUMERIC_ID.test(text) || !Number.isSafeInteger(Number(text))) {
    throw new RangeError("invalid numeric content segment");
  }
  return text;
}

function contentIdSegment(value: number | string): string {
  const text = typeof value === "number" ? String(value) : value;
  if (!NUMERIC_ID.test(text) || !Number.isSafeInteger(Number(text))) {
    throw new RangeError("invalid content id segment");
  }
  return text;
}

function elementSegment(value: string): string {
  if (!ELEMENT_ID.test(value)) throw new RangeError("invalid content element id");
  return value;
}

function contentFileSegment(value: string): string {
  if (!CONTENT_FILE.test(value) || value.includes("..")) {
    throw new RangeError("invalid content file");
  }
  return value;
}

function itemFileSegment(value: string): string {
  if (!ITEM_FILE.test(value) || value === "." || value === ".." || value.includes("..")) {
    throw new RangeError("invalid item filename");
  }
  return value;
}

function variantSegment(value: string): string {
  if (!VARIANT.test(value)) throw new RangeError("invalid variant");
  return value;
}

function rangeSegment(value: string): string {
  if (!RANGE_ID.test(value)) throw new RangeError("invalid range id");
  return value;
}

function descriptionSegment(value: string): string {
  if (!DESCRIPTION_ID.test(value)) throw new RangeError("invalid content description id");
  return value;
}

export function tagContentFileKey(tagNumericId: number | string, contentFile: string): string {
  return `${CONTENT_ROOT}/tags/${numericSegment(tagNumericId)}/${contentFileSegment(contentFile)}`;
}

export function tagElementFileKey(
  tagNumericId: number | string,
  contentElementId: string,
  contentFile: string,
): string {
  return `${CONTENT_ROOT}/tags/${numericSegment(tagNumericId)}/elements/${elementSegment(contentElementId)}/${contentFileSegment(contentFile)}`;
}

export function tagItemFileKey(
  tagNumericId: number | string,
  contentId: number | string,
  contentFile = "item.json",
): string {
  return `${CONTENT_ROOT}/tags/${numericSegment(tagNumericId)}/items/${contentIdSegment(contentId)}/${contentFileSegment(contentFile)}`;
}

/** Build an item file key only from validated D1 identifiers and filename. */
export function tagItemOriginalKey(
  tagNumericId: number | string,
  contentId: number | string,
  filename: string,
): string {
  return `${CONTENT_ROOT}/tags/${numericSegment(tagNumericId)}/items/${contentIdSegment(contentId)}/${itemFileSegment(filename)}`;
}

export function tagItemVariantKey(
  tagNumericId: number | string,
  contentId: number | string,
  variant: string,
): string {
  return `${CONTENT_ROOT}/tags/${numericSegment(tagNumericId)}/items/${contentIdSegment(contentId)}/variants/${variantSegment(variant)}`;
}

export function globalItemFileKey(
  contentId: number | string,
  contentFile = "item.json",
): string {
  return `${CONTENT_ROOT}/global/items/${contentIdSegment(contentId)}/${contentFileSegment(contentFile)}`;
}

export function globalItemVariantKey(
  contentId: number | string,
  variant: string,
): string {
  return `${CONTENT_ROOT}/global/items/${contentIdSegment(contentId)}/variants/${variantSegment(variant)}`;
}

export function tagRangeDescriptionFileKey(
  rangeId: string,
  contentId: string,
  contentFile: string,
): string {
  return `${CONTENT_ROOT}/tag-ranges/${rangeSegment(rangeId)}/descriptions/${descriptionSegment(contentId)}/${contentFileSegment(contentFile)}`;
}

export function globalDescriptionFileKey(
  contentId: string,
  contentFile: string,
): string {
  return `${CONTENT_ROOT}/global/descriptions/${descriptionSegment(contentId)}/${contentFileSegment(contentFile)}`;
}
