// @vitest-environment jsdom
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import defaultLibrary from "../../public/elements/default.tagelements.json";
import vaultTemplate from "../../public/templates/vault-standard.tagcontent.json";
import type { ElementLibrary, TagContentDocument } from "../domain/types";
import { App } from "./App";

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

const template = () => structuredClone(vaultTemplate) as unknown as TagContentDocument;
const library = () => structuredClone(defaultLibrary) as unknown as ElementLibrary;

function setup() {
  const view = render(<App initialDoc={template()} initialLibrary={library()} bundledTemplates={[]} />);
  const outline = view.container.querySelector(".outline") as HTMLElement;
  const badges = () =>
    Array.from(view.container.querySelectorAll(".tcp-element .el-badge")).map(
      (entry) => entry.textContent?.split(" · ")[0] ?? "",
    );
  return { ...view, outline, badges };
}

describe("App", () => {
  it("zeigt Vorschau, Elementliste, Inspektor und Trennlinie", () => {
    const { container, badges } = setup();
    expect(container.querySelector(".tcp")).not.toBeNull();
    expect(container.querySelector('[role="separator"]')).not.toBeNull();
    expect(container.querySelector(".inspector")).not.toBeNull();
    expect(badges()).toEqual(["Text", "Hinweis", "Galerie", "Dokumentenliste"]);
  });

  it("zeigt eine Reihenfolgeänderung sofort in der Vorschau", () => {
    const { outline, badges } = setup();
    const galleryRow = within(outline).getByText(/^Galerie/).closest("li") as HTMLElement;
    fireEvent.click(within(galleryRow).getByTitle("nach oben"));
    expect(badges()).toEqual(["Text", "Galerie", "Hinweis", "Dokumentenliste"]);
  });

  it("zeigt Spans als Rasteranteil in der Vorschau", () => {
    const { container } = setup();
    // Vault-Vorlage: 8/4/8/12 im 12er-Raster ergeben bei drei Spalten 2/1/2/3.
    const styles = Array.from(container.querySelectorAll(".tcp-element")).map(
      (element) => element.getAttribute("style") ?? "",
    );
    expect(styles.map((style) => /grid-column:\s*span (\d+)/.exec(style)?.[1])).toEqual(["2", "1", "2", "3"]);
  });

  it("bietet mobiles Vorschau-Raster und zeigt Breite, Gerät und Spalten", () => {
    const { container } = setup();
    const group = container.querySelector('[role="group"][aria-label="Vorschau-Breite"]') as HTMLElement;
    expect(group).not.toBeNull();
    const labels = Array.from(group.querySelectorAll("button")).map((button) => button.textContent);
    expect(labels).toEqual(["320", "360", "390", "430", "768", "1024", "1280", "1440", "Fit", "Compact"]);
    // jsdom misst keine Breite: „Fit" fällt auf die Standardbreite zurück.
    expect(container.querySelector(".tcp-meta")?.textContent).toContain("Fit (1280 px) · Desktop");

    fireEvent.click(within(group).getByText("360"));
    expect(container.querySelector(".tcp-meta")?.textContent).toContain("360 px · Handy · Compact · 1 Spalte");
    // Der Inspektor folgt der angezeigten Breite.
    expect(container.querySelector(".inspector")?.textContent).toContain("Platzierung (mobile)");

    fireEvent.click(within(group).getByText("Fit"));
    expect(container.querySelector(".tcp-meta")?.textContent).toContain("Fit (1280 px)");
  });

  it("zeigt Layout-Hinweise unter der Vorschau, wenn Spalten zu schmal sind", () => {
    const { container } = setup();
    const group = container.querySelector('[role="group"][aria-label="Vorschau-Breite"]') as HTMLElement;
    fireEvent.click(within(group).getByText("1024"));
    // 1024 px ergeben drei Spalten à ~330 px – kein Hinweis nötig.
    expect(container.querySelector(".preview-hints")).toBeNull();
  });

  it("schaltet Compact ab und legt alle Elemente untereinander", () => {
    const { container } = setup();
    const group = container.querySelector('[role="group"][aria-label="Vorschau-Breite"]') as HTMLElement;
    const toggle = within(group).getByRole("button", { name: "Compact" });
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector(".tcp-meta")?.textContent).toContain("Compact · 3 Spalten");

    fireEvent.click(toggle);
    expect(container.querySelector(".tcp-meta")?.textContent).toContain("Untereinander · 1 Spalte");
    expect(container.querySelector(".tcp")?.getAttribute("data-view")).toBe("stacked");
    expect(container.querySelector(".tcp-view-badge")?.textContent).toContain("nicht die echte Ausgabe");
    const spans = Array.from(container.querySelectorAll(".tcp-element")).map(
      (element) => /grid-column:\s*span (\d+)/.exec(element.getAttribute("style") ?? "")?.[1],
    );
    expect(spans).toEqual(["1", "1", "1", "1"]);
    expect(window.localStorage.getItem("myqr24.tcd.previewColumns")).toBe("stacked");

    fireEvent.click(within(group).getByRole("button", { name: "Compact" }));
    expect(container.querySelector(".tcp-meta")?.textContent).toContain("Compact · 3 Spalten");
    expect(container.querySelector(".tcp-view-badge")).toBeNull();
    expect(window.localStorage.getItem("myqr24.tcd.previewColumns")).toBe("compact");

    // Tastenkürzel Strg+Shift+E schaltet denselben Zustand.
    fireEvent.keyDown(window, { key: "e", ctrlKey: true, shiftKey: true });
    expect(container.querySelector(".tcp-meta")?.textContent).toContain("Untereinander · 1 Spalte");
  });

  it("lässt den Compact-Schalter auf dem Handy ohne Wirkung", () => {
    const { container } = setup();
    const group = container.querySelector('[role="group"][aria-label="Vorschau-Breite"]') as HTMLElement;
    fireEvent.click(within(group).getByText("360"));
    const toggle = within(group).getByRole("button", { name: "Compact" });
    fireEvent.click(toggle);
    // Auf 360 px ist auch „Compact" einspaltig – der Badge erklärt die Ansicht trotzdem.
    expect(container.querySelector(".tcp-meta")?.textContent).toContain("Untereinander · 1 Spalte");
    fireEvent.click(toggle);
    expect(container.querySelector(".tcp-meta")?.textContent).toContain("Compact · 1 Spalte");
  });

  it("öffnet die Formatierleiste beim Fokus und bietet alle Funktionen", () => {
    const { container } = setup();
    const surface = container.querySelector(".rte-surface") as HTMLElement;
    const holder = container.querySelector(".rte-toolbar-holder") as HTMLElement;
    expect(surface).not.toBeNull();
    expect(holder.hasAttribute("hidden")).toBe(true);

    fireEvent.focus(surface);
    expect(holder.hasAttribute("hidden")).toBe(false);

    const labels = Array.from(container.querySelectorAll(".rte-toolbar .fb-btn")).map((button) =>
      button.getAttribute("aria-label"),
    );
    expect(labels).toEqual(
      expect.arrayContaining([
        "Fett (Strg+B)",
        "Kursiv (Strg+I)",
        "Unterstrichen (Strg+U)",
        "Aufzählung (Strg+Shift+8)",
        "Nummerierte Liste (Strg+Shift+7)",
        "Zeichenfarbe",
        "Text-Markierung",
        "Box-Hintergrund",
      ]),
    );
    const toolbar = container.querySelector(".rte-toolbar") as HTMLElement;
    expect(toolbar.querySelectorAll("select")).toHaveLength(3);

    const json = container.querySelector(".json") as HTMLTextAreaElement;
    expect(json.value).toContain("Willkommen");
  });
});
