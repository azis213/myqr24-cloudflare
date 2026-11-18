// @vitest-environment jsdom
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import defaultLibrary from "../../public/elements/default.tagelements.json";
import vaultTemplate from "../../public/templates/vault-standard.tagcontent.json";
import type { ElementLibrary, TagContentDocument } from "../domain/types";
import { App } from "./App";

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
