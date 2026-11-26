import type { Principal } from "./limits";

/**
 * Sichtbarkeitsprojektion für TAG-Content-Elemente und -Items.
 *
 * `visibility` steht in D1 (`tag_content_elements`,
 * `tag_content_element_items`) und wird hier gegen den effektiven Prinzipal
 * geprüft. `viewAs` verengt immer nur die Sicht des Aufrufers, es erweitert sie
 * nie: Welche Rollen erlaubt sind, entscheidet das Credential (Session-Key oder
 * API-Key).
 */
export type Visibility = "public" | "shared" | "private" | "ownerOnly";

export const IS_VISIBILITY = (value: unknown): value is Visibility =>
  value === "public" || value === "shared" || value === "private" || value === "ownerOnly";

export function isVisibleToPrincipal(visibility: Visibility, principal: Principal): boolean {
  if (visibility === "public") return true;
  if (visibility === "shared") return principal !== "scanner";
  return principal === "owner";
}

/** Session-Scope → Prinzipal (Owner-Sessions folgen mit dem Owner-Gate). */
export function principalFromScope(scope: "public" | "pin" | "login"): Principal {
  return scope === "public" ? "scanner" : "guest";
}

/** Rollen, die dieser Session-Scope anfordern darf (`viewAs`). */
export function allowedPrincipalsForScope(scope: "public" | "pin" | "login"): Principal[] {
  return scope === "public" ? ["scanner"] : ["scanner", "guest"];
}

/** Der API-Key ist vertrauenswürdig und darf jede Sicht anfordern. */
export const API_KEY_PRINCIPALS: Principal[] = ["scanner", "guest", "owner"];

export function isPrincipalAllowed(requested: Principal, allowed: readonly Principal[]): boolean {
  return allowed.includes(requested);
}
