import { encodeTagId } from "../../../apps/edge-router/src/codec";
import {
  type GeneratedTag,
  type QrIdCase,
  type TagLength,
  type TagListExport,
  type TagRangeDefinition,
  MAX_TAGS_PER_RUN,
  now,
  validateBaseUrl,
} from "./domain";

export interface GenerationSecrets {
  feistelSecret: string;
  hmacSecret: string;
}

export interface GenerationProgress {
  completed: number;
  total: number;
}

export interface GenerationOptions {
  onProgress?: (progress: GenerationProgress) => void;
  isCancelled?: () => boolean;
  qrIdCase?: QrIdCase;
}

function qrPayload(baseUrl: string, tagId: string, qrIdCase: QrIdCase): string {
  const payload = `${baseUrl}${tagId}`;
  return qrIdCase === "upper" ? payload.toUpperCase() : payload.toLowerCase();
}

function generateValues(range: TagRangeDefinition): bigint[] {
  const start = BigInt(range.start);
  const end = BigInt(range.end);
  const step = range.tagLength === 8 ? 16n : 1n;
  const values: bigint[] = [];

  for (let value = start; value <= end; value += step) values.push(value);
  return values;
}

export function countSelectedTags(ranges: readonly TagRangeDefinition[]): bigint {
  return ranges.reduce((total, range) => {
    const step = range.tagLength === 8 ? 16n : 1n;
    return total + (BigInt(range.end) - BigInt(range.start)) / step + 1n;
  }, 0n);
}

export async function generateTags(
  ranges: readonly TagRangeDefinition[],
  baseUrlInput: string,
  secrets: GenerationSecrets,
  options: GenerationOptions = {},
): Promise<GeneratedTag[]> {
  const baseUrl = validateBaseUrl(baseUrlInput);
  if (!baseUrl.ok) throw new Error(baseUrl.errors.join(" "));
  if (!secrets.feistelSecret) throw new Error("Das FEISTEL Secret ist erforderlich.");
  if (ranges.some((range) => range.tagLength === 8) && !secrets.hmacSecret) {
    throw new Error("Das HMAC Secret ist für achtstellige TAGs erforderlich.");
  }

  const totalAsBigInt = countSelectedTags(ranges);
  if (totalAsBigInt > BigInt(MAX_TAGS_PER_RUN)) {
    throw new Error(`Es dürfen maximal ${MAX_TAGS_PER_RUN.toLocaleString("de-DE")} TAGs je Lauf generiert werden.`);
  }

  const total = Number(totalAsBigInt);
  const qrIdCase = options.qrIdCase ?? "lower";
  const result: GeneratedTag[] = [];
  let completed = 0;

  for (const range of ranges) {
    const values = generateValues(range);
    for (let ordinal = 0; ordinal < values.length; ordinal += 1) {
      if (options.isCancelled?.()) throw new Error("Die TAG-Generierung wurde abgebrochen.");

      const requestedValue = values[ordinal];
      const encoded = await encodeTagId(requestedValue, range.tagLength as TagLength, {
        FEISTEL_SECRET_S01: secrets.feistelSecret,
        TAG_HMAC_SECRET_S01: secrets.hmacSecret,
      });

      if (!encoded) {
        throw new Error(`Für Bereich „${range.name}“ konnte kein TAG für ${requestedValue.toString()} erzeugt werden.`);
      }

      result.push({
        tagId: encoded.tagId,
        url: qrPayload(baseUrl.value, encoded.tagId, qrIdCase),
        rangeId: range.id,
        rangeName: range.name,
        ordinalInRange: ordinal.toString(),
        requestedValue: requestedValue.toString(),
        decodedValue: encoded.decodedValue.toString(),
        tagLength: range.tagLength,
        labelText: range.labelText,
        qrProfile: { ...range.qrProfile },
      });

      completed += 1;
      if (completed % 25 === 0 || completed === total) {
        options.onProgress?.({ completed, total });
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }
  }

  return result;
}

export function createTagListExport(
  baseUrl: string,
  qrIdCaseOrRanges: QrIdCase | readonly TagRangeDefinition[],
  rangesOrTags: readonly TagRangeDefinition[] | readonly GeneratedTag[],
  tagsArgument?: readonly GeneratedTag[],
): TagListExport {
  const qrIdCase: QrIdCase = typeof qrIdCaseOrRanges === "string" ? qrIdCaseOrRanges : "lower";
  const ranges = (typeof qrIdCaseOrRanges === "string" ? rangesOrTags : qrIdCaseOrRanges) as readonly TagRangeDefinition[];
  const tags = (typeof qrIdCaseOrRanges === "string" ? tagsArgument : rangesOrTags) as readonly GeneratedTag[];

  return {
    schemaVersion: 1,
    kind: "myqr24.tag-generator.tag-list",
    generatedAt: now(),
    source: { baseUrl, qrIdCase, ranges: ranges.map((range) => ({ ...range })) },
    tags: tags.map((tag) => ({ ...tag })),
  };
}

export function createTagListJson(
  baseUrl: string,
  qrIdCaseOrRanges: QrIdCase | readonly TagRangeDefinition[],
  rangesOrTags: readonly TagRangeDefinition[] | readonly GeneratedTag[],
  tagsArgument?: readonly GeneratedTag[],
): string {
  return JSON.stringify(createTagListExport(baseUrl, qrIdCaseOrRanges, rangesOrTags, tagsArgument), null, 2);
}

export function parseTagListJson(input: string): TagListExport {
  const parsed = JSON.parse(input) as TagListExport;
  if (
    parsed.kind !== "myqr24.tag-generator.tag-list" ||
    parsed.schemaVersion !== 1 ||
    !Array.isArray(parsed.tags) ||
    !Array.isArray(parsed.source?.ranges)
  ) {
    throw new Error("Die Datei ist keine gültige TAG-Liste der Version 1.");
  }

  const url = validateBaseUrl(parsed.source.baseUrl);
  if (!url.ok) throw new Error(url.errors.join(" "));

  const qrIdCase: QrIdCase = parsed.source.qrIdCase === "upper" ? "upper" : "lower";
  const seen = new Set<string>();
  for (const tag of parsed.tags) {
    if (!/^[0-9a-z]{6}$|^[0-9a-z]{8}$/.test(tag.tagId) || seen.has(tag.tagId)) {
      throw new Error("Die TAG-Liste enthält ungültige oder doppelte TAG-IDs.");
    }
    if (tag.url !== qrPayload(url.value, tag.tagId, qrIdCase)) {
      throw new Error("Die TAG-Liste enthält eine URL, die nicht zur Basis-URL passt.");
    }
    BigInt(tag.requestedValue);
    BigInt(tag.decodedValue);
    seen.add(tag.tagId);
  }

  return {
    ...parsed,
    source: { ...parsed.source, baseUrl: url.value, qrIdCase },
  };
}
