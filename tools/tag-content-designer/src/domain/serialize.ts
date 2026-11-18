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

/** Kanonische Serialisierung: sortierte Schlüssel, 2 Leerzeichen, LF, abschließender Umbruch. */
export function canonicalize(value: unknown): string {
  return `${JSON.stringify(sortValue(value), null, 2)}\n`;
}

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function canonicalByteLength(value: unknown): number {
  return byteLength(canonicalize(value));
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function documentFileName(templateId: string, templateVersion: number): string {
  return `${templateId}-v${templateVersion}.tagcontent.json`;
}

export function libraryFileName(libraryVersion: number): string {
  return `element-library-v${libraryVersion}.tagelements.json`;
}
