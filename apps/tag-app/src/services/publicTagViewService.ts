import { publicTagViews } from "../mocks/publicTagViews";
import type { PublicTagView } from "../features/vault/types";
import { loadAuthorizedView } from "./tagAccessService";

const TAG_ID_PATTERN = /^(?:[0-9a-z]{6}|[0-9a-z]{8}|[0-9a-z]{10})$/i;

export class UnknownPublicTagError extends Error {
  constructor(tagId: string) {
    super(`Kein veröffentlichtes öffentliches TAG mit der ID "${tagId}" gefunden.`);
    this.name = "UnknownPublicTagError";
  }
}

/**
 * Fixture data is intentionally limited to test mode. Normal browser builds
 * receive an already authorized, server-filtered view from the App API.
 */
export async function getPublicTagView(tagId: string): Promise<PublicTagView> {
  const normalizedId = tagId.toLowerCase();

  if (!TAG_ID_PATTERN.test(normalizedId)) {
    throw new UnknownPublicTagError(tagId);
  }

  if (import.meta.env.MODE !== "test" && import.meta.env.VITE_TAG_APP_DATA_SOURCE !== "fixtures") {
    return loadAuthorizedView(normalizedId);
  }

  const view = publicTagViews[normalizedId];

  if (!view) {
    throw new UnknownPublicTagError(normalizedId);
  }

  return view;
}
