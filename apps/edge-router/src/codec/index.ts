/**
 * Shared TAG codec kernel.
 *
 * This module is deliberately independent from KV, HTTP routing and Worker
 * bindings. Both the public scan worker and the private codec worker bundle
 * this exact source code but receive only their respective least-privilege
 * secrets.
 */
export type TagLength = 6 | 8 | 10;

export interface PublicTagId {
  id: string;
  length: TagLength;
}

interface FeistelParameters {
  blockBits: number;
  halfBits: number;
  domain: "myqr24/tag/6" | "myqr24/tag/8" | "myqr24/tag/10";
  roundInputBytes: number;
}

const FEISTEL_ROUNDS = 10;
const MAX_CYCLE_WALK_ITERATIONS = 128;
const encoder = new TextEncoder();

const FEISTEL_PARAMETERS: Record<TagLength, FeistelParameters> = {
  6: {
    blockBits: 32,
    halfBits: 16,
    domain: "myqr24/tag/6",
    roundInputBytes: 3,
  },
  8: {
    blockBits: 42,
    halfBits: 21,
    domain: "myqr24/tag/8",
    roundInputBytes: 3,
  },
  10: {
    blockBits: 52,
    halfBits: 26,
    domain: "myqr24/tag/10",
    roundInputBytes: 4,
  },
};

export function isTagLength(value: unknown): value is TagLength {
  return value === 6 || value === 8 || value === 10;
}

export function base36UpperBound(length: TagLength): bigint {
  return 36n ** BigInt(length);
}

export function base36LowerBound(length: TagLength): bigint {
  return 36n ** BigInt(length - 2);
}

export function isCanonicalValue(value: bigint, length: TagLength): boolean {
  return value >= base36LowerBound(length) && value < base36UpperBound(length);
}

/**
 * Parses a Base36 string without converting through JavaScript number.
 */
export function parseBase36(value: string): bigint | null {
  if (!/^[0-9a-z]+$/i.test(value)) {
    return null;
  }

  let result = 0n;

  for (const character of value.toLowerCase()) {
    const code = character.charCodeAt(0);
    const digit =
      code >= 48 && code <= 57
        ? BigInt(code - 48)
        : code >= 97 && code <= 122
          ? BigInt(code - 87)
          : -1n;

    if (digit < 0n || digit >= 36n) {
      return null;
    }

    result = result * 36n + digit;
  }

  return result;
}

export function formatBase36(value: bigint, length: TagLength): string | null {
  if (!isCanonicalValue(value, length)) {
    return null;
  }

  const encoded = value.toString(36);

  return encoded.padStart(length, "0");
}

function toFixedWidthBytes(value: bigint, byteLength: number): Uint8Array {
  const bytes = new Uint8Array(byteLength);
  let remaining = value;

  for (let index = byteLength - 1; index >= 0; index -= 1) {
    bytes[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }

  return bytes;
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return new Uint8Array(data).buffer;
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", toArrayBuffer(data)),
  );
}

async function feistelRound(
  secret: string,
  parameters: FeistelParameters,
  round: number,
  rightHalf: bigint,
): Promise<bigint> {
  const prefix = encoder.encode(`${secret}|${parameters.domain}|${round}|`);
  const material = new Uint8Array(prefix.length + parameters.roundInputBytes);
  material.set(prefix);
  material.set(
    toFixedWidthBytes(rightHalf, parameters.roundInputBytes),
    prefix.length,
  );

  const digest = await sha256(material);
  const mask = (1n << BigInt(parameters.halfBits)) - 1n;
  let roundValue = 0n;

  for (let index = 0; index < parameters.roundInputBytes; index += 1) {
    roundValue = (roundValue << 8n) | BigInt(digest[index]);
  }

  return roundValue & mask;
}

async function decodeFeistelBlock(
  encryptedValue: bigint,
  parameters: FeistelParameters,
  secret: string,
): Promise<bigint> {
  const halfMask = (1n << BigInt(parameters.halfBits)) - 1n;
  let left = encryptedValue >> BigInt(parameters.halfBits);
  let right = encryptedValue & halfMask;

  for (let round = FEISTEL_ROUNDS - 1; round >= 0; round -= 1) {
    const previousRight = left;
    const previousLeft =
      (right ^ (await feistelRound(secret, parameters, round, left))) & halfMask;

    left = previousLeft;
    right = previousRight;
  }

  return (left << BigInt(parameters.halfBits)) | right;
}

async function encodeFeistelBlock(
  decodedValue: bigint,
  parameters: FeistelParameters,
  secret: string,
): Promise<bigint> {
  const halfMask = (1n << BigInt(parameters.halfBits)) - 1n;
  let left = decodedValue >> BigInt(parameters.halfBits);
  let right = decodedValue & halfMask;

  for (let round = 0; round < FEISTEL_ROUNDS; round += 1) {
    const nextLeft = right;
    const nextRight =
      (left ^ (await feistelRound(secret, parameters, round, right))) & halfMask;

    left = nextLeft;
    right = nextRight;
  }

  return (left << BigInt(parameters.halfBits)) | right;
}

export async function decodeFeistel(
  encryptedValue: bigint,
  length: TagLength,
  secret: string,
): Promise<bigint | null> {
  const parameters = FEISTEL_PARAMETERS[length];
  const blockLimit = 1n << BigInt(parameters.blockBits);

  if (
    encryptedValue < 0n ||
    encryptedValue >= base36UpperBound(length) ||
    encryptedValue >= blockLimit ||
    !secret
  ) {
    return null;
  }

  let value = encryptedValue;

  for (let attempt = 0; attempt < MAX_CYCLE_WALK_ITERATIONS; attempt += 1) {
    value = await decodeFeistelBlock(value, parameters, secret);

    if (isCanonicalValue(value, length)) {
      return value;
    }
  }

  return null;
}

export async function encodeFeistel(
  decodedValue: bigint,
  length: TagLength,
  secret: string,
): Promise<bigint | null> {
  const parameters = FEISTEL_PARAMETERS[length];

  if (!isCanonicalValue(decodedValue, length) || !secret) {
    return null;
  }

  let value = decodedValue;

  for (let attempt = 0; attempt < MAX_CYCLE_WALK_ITERATIONS; attempt += 1) {
    value = await encodeFeistelBlock(value, parameters, secret);

    if (isCanonicalValue(value, length)) {
      return value;
    }
  }

  return null;
}

/**
 * Decodes a public tag ID into its complete canonical integer value.
 */
export async function decodeTagId(
  tag: PublicTagId,
  secrets: Pick<{ FEISTEL_SECRET_S01: string }, "FEISTEL_SECRET_S01">,
): Promise<bigint | null> {
  const encryptedValue = parseBase36(tag.id);

  if (encryptedValue === null) {
    return null;
  }

  return decodeFeistel(
    encryptedValue,
    tag.length,
    secrets.FEISTEL_SECRET_S01,
  );
}

/**
 * Converts an authoritative complete canonical value into a public tag ID.
 */
export async function encodeTagId(
  decodedValue: bigint,
  length: TagLength,
  secrets: Pick<{ FEISTEL_SECRET_S01: string }, "FEISTEL_SECRET_S01">,
): Promise<{ tagId: string; decodedValue: bigint } | null> {
  const encryptedValue = await encodeFeistel(
    decodedValue,
    length,
    secrets.FEISTEL_SECRET_S01,
  );
  const tagId =
    encryptedValue === null ? null : formatBase36(encryptedValue, length);

  return tagId ? { tagId, decodedValue } : null;
}
