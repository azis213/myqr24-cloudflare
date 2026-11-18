// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import vaultTemplate from "../../public/templates/vault-standard.tagcontent.json";
import type { TagContentDocument } from "../domain/types";
import { clearSession, SESSION_KEY, loadSession, saveSession } from "./session";

const clone = () => structuredClone(vaultTemplate) as unknown as TagContentDocument;

afterEach(() => {
  clearSession();
});

describe("letzte Konfiguration", () => {
  it("speichert kanonisch und lädt unverändert zurück", () => {
    const doc = clone();
    doc.palette = { custom: ["#123456"] };
    saveSession(doc);

    const raw = window.localStorage.getItem(SESSION_KEY) as string;
    expect(raw).toContain('"json":"');
    const restored = loadSession();
    expect(restored?.doc.palette?.custom).toEqual(["#123456"]);
    expect(restored?.doc.template.templateId).toBe(doc.template.templateId);
    expect(restored?.savedAt).not.toBe("");
  });

  it("liefert null ohne gespeicherte Konfiguration", () => {
    expect(loadSession()).toBeNull();
  });

  it("verwirft unbrauchbare Stände (kein JSON, blockierende Fehler)", () => {
    window.localStorage.setItem(SESSION_KEY, "kein json");
    expect(loadSession()).toBeNull();

    const broken = clone();
    broken.template.templateId = "";
    saveSession(broken);
    expect(loadSession()).toBeNull();
  });

  it("leert den Speicher auf Wunsch", () => {
    saveSession(clone());
    expect(window.localStorage.getItem(SESSION_KEY)).not.toBeNull();
    clearSession();
    expect(window.localStorage.getItem(SESSION_KEY)).toBeNull();
  });
});
