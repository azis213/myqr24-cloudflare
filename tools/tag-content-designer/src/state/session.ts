import { migrateDocument } from "../domain/migrate";
import { canonicalize } from "../domain/serialize";
import type { TagContentDocument } from "../domain/types";
import { validateDocument } from "../domain/validate";

/**
 * „Letzte Konfiguration": der zuletzt bearbeitete Stand wird lokal (localStorage) gehalten
 * und beim Start bzw. nach einem Reload wieder geladen. Gespeichert wird kanonisches JSON,
 * damit der Stand lesbar und stabil bleibt. Sind die Daten unbrauchbar, greift das
 * ausgelieferte Default-Template.
 */
export const SESSION_KEY = "myqr24.tcd.session.v1";

export interface RestoredSession {
  doc: TagContentDocument;
  savedAt: string;
}

export function saveSession(doc: TagContentDocument): void {
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify({ savedAt: new Date().toISOString(), json: canonicalize(doc) }));
  } catch {
    /* localStorage kann blockiert oder voll sein – Komfort, kein Muss */
  }
}

export function loadSession(): RestoredSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as { savedAt?: unknown; json?: unknown };
    if (typeof entry.json !== "string") return null;
    const migrated = migrateDocument(JSON.parse(entry.json) as unknown);
    const doc = migrated.document as unknown as TagContentDocument;
    if (validateDocument(doc).some((issue) => issue.blocking)) return null;
    return { doc, savedAt: typeof entry.savedAt === "string" ? entry.savedAt : "" };
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignorieren */
  }
}

/** Kurzanzeige für die Kopfzeile: „zuletzt verwendet · 18.11.2026, 14:03". */
export function describeSession(savedAt: string): string {
  if (!savedAt) return "zuletzt verwendet";
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return "zuletzt verwendet";
  return `zuletzt verwendet · ${date.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}`;
}
