/**
 * Operative content item IDs.
 *
 * Format: 32-bit Unix seconds followed by 20 random bits.
 * The resulting value is at most 2^52 - 1 and therefore safe in JavaScript.
 * D1 stores it as INTEGER; JSON boundaries use its canonical decimal string.
 */
export const CONTENT_ID_RANDOM_BITS = 20;
export const CONTENT_ID_RANDOM_MASK = 2 ** CONTENT_ID_RANDOM_BITS - 1;
export const CONTENT_ID_MAX = 2 ** 52 - 1;
export const CONTENT_ID_MAX_UNIX_SECONDS = 2 ** 32 - 1;

export type ContentIdRandomSource = () => number;

function defaultRandomSource(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] & CONTENT_ID_RANDOM_MASK;
}

export function generateContentId(
  nowMs = Date.now(),
  randomSource: ContentIdRandomSource = defaultRandomSource,
): number {
  const seconds = Math.floor(nowMs / 1000);
  if (!Number.isSafeInteger(seconds) || seconds < 0 || seconds > CONTENT_ID_MAX_UNIX_SECONDS) {
    throw new RangeError("content id timestamp out of range");
  }

  const random = randomSource();
  if (!Number.isSafeInteger(random) || random < 0 || random > CONTENT_ID_RANDOM_MASK) {
    throw new RangeError("content id random value out of range");
  }

  const id = seconds * 2 ** CONTENT_ID_RANDOM_BITS + random;
  if (!Number.isSafeInteger(id) || id < 1 || id > CONTENT_ID_MAX) {
    throw new RangeError("content id out of range");
  }
  return id;
}

export function parseContentId(value: string): number | null {
  if (!/^[1-9][0-9]{0,15}$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id >= 1 && id <= CONTENT_ID_MAX ? id : null;
}

export function formatContentId(value: number): string {
  if (!Number.isSafeInteger(value) || value < 1 || value > CONTENT_ID_MAX) {
    throw new RangeError("content id out of range");
  }
  return String(value);
}

export function contentIdTimestampSeconds(value: number): number | null {
  if (!Number.isSafeInteger(value) || value < 1 || value > CONTENT_ID_MAX) return null;
  return Math.floor(value / 2 ** CONTENT_ID_RANDOM_BITS);
}
