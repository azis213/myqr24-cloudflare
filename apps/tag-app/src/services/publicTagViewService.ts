import { publicTagViews } from "../mocks/publicTagViews";
import type { PublicTagView } from "../features/vault/types";

const TAG_ID_PATTERN = /^(?:[0-9a-z]{6}|[0-9a-z]{8})$/i;

export class UnknownPublicTagError extends Error {
  constructor(tagId: string) {
    super(`Kein veröffentlichtes öffentliches TAG mit der ID "${tagId}" gefunden.`);
    this.name = "UnknownPublicTagError";
  }
}

/**
 * Temporary local adapter for the public Vault MVP.
 *
 * The future implementation calls GET /api/v1/tags/{tagId}/view and must
 * return only server-authorized public content with the same shape.
 */
export async function getPublicTagView(tagId: string): Promise<PublicTagView> {
  const normalizedId = tagId.toLowerCase();

  if (!TAG_ID_PATTERN.test(normalizedId)) {
    throw new UnknownPublicTagError(tagId);
  }

  const view = publicTagViews[normalizedId];

  if (!view) {
    throw new UnknownPublicTagError(normalizedId);
  }

  return view;
}
