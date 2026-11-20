/**
 * Kanonische Serialisierung, Bytes und Hash.
 *
 * Identisch zum Designer (`tools/tag-content-designer/src/domain/serialize.ts`):
 * sortierte Schlüssel, zwei Leerzeichen, LF, abschließender Umbruch. Nur so
 * ergibt derselbe Inhalt denselben Hash und damit eine stabile Idempotenz.
 */

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      const entry = source[key];
      if (entry === undefined) continue;
      result[key] = sortValue(entry);
    }
    return result;
  }
  return value;
}

export function canonicalize(value: unknown): string {
  return `${JSON.stringify(sortValue(value), null, 2)}\n`;
}

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
