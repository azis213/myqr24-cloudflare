// @vitest-environment jsdom
import type { Editor } from "@tiptap/core";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ElementStyle, Paragraph, RichTextContent } from "../domain/types";
import { docToContent } from "./mapping";
import { FALLBACK_THEME_COLORS, type PaletteContext } from "./palette";
import { RichTextField } from "./RichTextField";

afterEach(cleanup);

/** Testhelfer: erster Block als Absatz (keine Tabelle) mit Zugriff auf die Runs. */
const firstParagraph = (content: RichTextContent) => (content.paragraphs?.[0] as Paragraph | undefined) ?? { runs: [] };
const paragraphsOf = (content: RichTextContent): Paragraph[] => (content.paragraphs ?? []) as Paragraph[];

function setup(content?: RichTextContent, style?: ElementStyle) {
  let editor: Editor | undefined;
  const onContentChange = vi.fn();
  const onStyleChange = vi.fn();
  const onAddCustom = vi.fn();
  const onRemoveCustom = vi.fn();
  const palette: PaletteContext = {
    themeColors: FALLBACK_THEME_COLORS,
    custom: ["#123456"],
    onAddCustom,
    onRemoveCustom,
  };
  const view = render(
    <RichTextField
      content={content}
      style={style}
      palette={palette}
      onContentChange={onContentChange}
      onStyleChange={onStyleChange}
      onEditorReady={(instance) => {
        editor = instance;
      }}
    />,
  );
  const surface = view.container.querySelector(".rte-surface") as HTMLElement;
  return {
    ...view,
    surface,
    onContentChange,
    onStyleChange,
    onAddCustom,
    onRemoveCustom,
    instance: () => {
      if (!editor) throw new Error("Editor wurde nicht initialisiert.");
      return editor;
    },
  };
}

/** Öffnet ein Farbmenü der Leiste und liefert den Dialog. */
function openColorMenu(container: HTMLElement, label: string): HTMLElement {
  fireEvent.click(container.querySelector(`.fb-colorbtn[aria-label="${label}"]`) as HTMLButtonElement);
  return container.querySelector(`.fb-menu[aria-label="${label}"]`) as HTMLElement;
}

const boldButton = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>(".rte-toolbar .fb-btn")).find(
    (button) => button.textContent === "B",
  ) as HTMLButtonElement;

const buttonByTitle = (container: HTMLElement, title: string) =>
  container.querySelector<HTMLButtonElement>(`.rte-toolbar .fb-btn[title="${title}"]`) as HTMLButtonElement;

describe("RichTextField", () => {
  it("zeigt Überschrift, Auszeichnungen und Links aus dem Modell", () => {
    const { container } = setup({
      heading: "Willkommen",
      paragraphs: [
        {
          runs: [
            { text: "Normal " },
            { text: "wichtig", marks: [{ type: "bold" }], fontSize: 20, color: "#b3261e" },
            { text: " Link", link: { href: "https://example.org" } },
          ],
        },
      ],
    });
    expect(container.querySelector(".rte-surface h3")?.textContent).toBe("Willkommen");
    expect(container.querySelector(".rte-surface strong")?.textContent).toBe("wichtig");
    const styled = container.querySelector(".rte-surface span[style]") as HTMLElement;
    expect(styled.style.fontSize).toBe("20px");
    expect(container.querySelector(".rte-surface a")?.getAttribute("href")).toBe("https://example.org");
  });

  it("zeigt die Leiste erst mit dem Fokus", () => {
    const { container, surface } = setup({ paragraphs: [{ runs: [{ text: "Text" }] }] });
    const holder = container.querySelector(".rte-toolbar-holder") as HTMLElement;
    expect(holder.hasAttribute("hidden")).toBe(true);
    fireEvent.focus(surface);
    expect(holder.hasAttribute("hidden")).toBe(false);
  });

  it("schaltet Fett, Kursiv und Unterstrich auf die Auswahl", () => {
    const { container, surface, instance } = setup({ paragraphs: [{ runs: [{ text: "Text" }] }] });
    fireEvent.focus(surface);
    instance().commands.selectAll();
    fireEvent.click(boldButton(container));
    expect(instance().isActive("bold")).toBe(true);
    fireEvent.click(buttonByTitle(container, "Kursiv (Strg+I)"));
    fireEvent.click(buttonByTitle(container, "Unterstrichen (Strg+U)"));
    expect(instance().isActive("italic")).toBe(true);
    expect(instance().isActive("underline")).toBe(true);
  });

  it("richtet den Absatz aus und setzt den Zeilenabstand", () => {
    const { container, surface, instance } = setup({ paragraphs: [{ runs: [{ text: "Text" }] }] });
    fireEvent.focus(surface);
    instance().commands.selectAll();
    fireEvent.click(buttonByTitle(container, "Zentriert"));
    expect(instance().getAttributes("paragraph").align).toBe("center");
    fireEvent.click(buttonByTitle(container, "Rechtsbündig"));
    expect(instance().getAttributes("paragraph").align).toBe("end");

    const lineHeight = container.querySelectorAll<HTMLSelectElement>(".rte-toolbar select")[2];
    fireEvent.change(lineHeight, { target: { value: "1.5" } });
    expect(instance().getAttributes("paragraph").lineHeight).toBe(1.5);
  });

  it("erzeugt Aufzählungen und rückt sie ein", () => {
    const { container, surface, instance } = setup({
      paragraphs: [{ runs: [{ text: "A" }] }, { runs: [{ text: "B" }] }],
    });
    fireEvent.focus(surface);
    instance().commands.selectAll();
    fireEvent.click(buttonByTitle(container, "Aufzählung (Strg+Shift+8)"));
    expect(instance().isActive("bulletList")).toBe(true);
    fireEvent.click(buttonByTitle(container, "Einrücken"));
    expect(JSON.stringify(instance().getJSON())).toContain("bulletList");
  });

  it("setzt Schriftgröße und Schriftfamilie auf den markierten Text", () => {
    const { container, surface, instance } = setup({ paragraphs: [{ runs: [{ text: "Text" }] }] });
    fireEvent.focus(surface);
    instance().commands.selectAll();

    const styleAttrs = () => {
      const marks = instance().getJSON().content?.[0].content?.[0].marks ?? [];
      return (marks.find((mark) => mark.type === "richStyle")?.attrs ?? {}) as Record<string, unknown>;
    };

    const size = container.querySelector('input[aria-label="Schriftgröße"]') as HTMLInputElement;
    fireEvent.change(size, { target: { value: "20" } });
    fireEvent.blur(size);
    expect(styleAttrs().fontSize).toBe(20);

    fireEvent.change(container.querySelectorAll<HTMLSelectElement>(".rte-toolbar select")[1], {
      target: { value: "serif" },
    });
    expect(styleAttrs().fontFamily).toBe("serif");
    expect(firstParagraph(docToContent(instance().getJSON())).runs[0]).toMatchObject({
      fontSize: 20,
      fontFamily: "serif",
    });
  });

  it("steppt die Schriftgröße über die geschlossene Skala", () => {
    const { container, surface, instance } = setup({ paragraphs: [{ runs: [{ text: "Text" }] }] });
    fireEvent.focus(surface);
    instance().commands.selectAll();

    const size = container.querySelector('input[aria-label="Schriftgröße"]') as HTMLInputElement;
    // Ohne Mark zeigt das Feld die Basisgröße des Editors.
    expect(size.value).toBe("16");
    fireEvent.keyDown(size, { key: "ArrowUp" });
    expect(size.value).toBe("18");
    fireEvent.keyDown(size, { key: "ArrowDown" });
    expect(size.value).toBe("16");

    // Freie Werte werden auf den nächsten Skalenwert geschnappt.
    fireEvent.change(size, { target: { value: "21" } });
    fireEvent.blur(size);
    expect(size.value).toBe("20");
    expect(firstParagraph(docToContent(instance().getJSON())).runs[0].fontSize).toBe(20);
  });

  it("ändert ohne Auswahl keinen bestehenden Text", () => {
    const { container, surface, instance } = setup({ paragraphs: [{ runs: [{ text: "Erster" }] }, { runs: [{ text: "Zweiter" }] }] });
    fireEvent.focus(surface);
    // Nur den zweiten Absatz markieren, dann per Klick in den Text den Merker löschen.
    instance().commands.setTextSelection({ from: 10, to: 16 });
    fireEvent.mouseDown(surface);
    instance().commands.setTextSelection({ from: 2, to: 2 });
    expect(instance().state.selection.empty).toBe(true);

    const size = container.querySelector('input[aria-label="Schriftgröße"]') as HTMLInputElement;
    fireEvent.change(size, { target: { value: "24" } });
    fireEvent.blur(size);

    const runs = paragraphsOf(docToContent(instance().getJSON())) ?? [];
    expect(runs[1].runs[0].fontSize).toBeUndefined();
    // Vorformatierung für die nächste Eingabe ist gesetzt, ohne Text zu ändern.
    expect(instance().state.storedMarks?.some((mark) => mark.type.name === "richStyle")).toBe(true);
  });

  it("formatiert die zuletzt markierte Spanne auch nach dem Fokuswechsel", () => {
    const { container, surface, instance } = setup({
      paragraphs: [{ runs: [{ text: "Erster " }, { text: "zweiter" }] }],
    });
    fireEvent.focus(surface);
    instance().commands.setTextSelection({ from: 10, to: 16 });
    expect(instance().state.selection.empty).toBe(false);

    // Klick in ein Auswahlfeld nimmt dem Editor den Fokus.
    fireEvent.blur(surface);
    fireEvent.change(container.querySelectorAll<HTMLSelectElement>(".rte-toolbar select")[1], {
      target: { value: "serif" },
    });

    const runs = firstParagraph(docToContent(instance().getJSON())).runs;
    expect(runs.length).toBeGreaterThan(1);
    expect(runs.at(-1)?.fontFamily).toBe("serif");
  });

  it("macht Textzeilen zu Überschriften 1–5 und zurück", () => {
    const { container, surface, instance } = setup({
      paragraphs: [{ runs: [{ text: "Titel" }] }, { runs: [{ text: "Text" }] }],
    });
    fireEvent.focus(surface);
    instance().commands.setTextSelection({ from: 1, to: 1 });

    const blockStyle = container.querySelector('select[aria-label="Absatzstil"]') as HTMLSelectElement;
    fireEvent.change(blockStyle, { target: { value: "1" } });
    expect(instance().isActive("richHeading")).toBe(true);
    expect(paragraphsOf(docToContent(instance().getJSON()))?.[0]).toMatchObject({ heading: 1 });

    fireEvent.change(blockStyle, { target: { value: "5" } });
    expect(paragraphsOf(docToContent(instance().getJSON()))?.[0]).toMatchObject({ heading: 5 });

    fireEvent.change(blockStyle, { target: { value: "text" } });
    const first = paragraphsOf(docToContent(instance().getJSON()))?.[0];
    expect(first?.heading).toBeUndefined();
    expect(first?.runs[0].text).toBe("Titel");
  });

  it("setzt Zeichenfarbe und Markierung über das Farbmenü", () => {
    const { container, surface, instance } = setup({ paragraphs: [{ runs: [{ text: "Text" }] }] });
    fireEvent.focus(surface);
    instance().commands.selectAll();

    const styleAttrs = () => {
      const marks = instance().getJSON().content?.[0].content?.[0].marks ?? [];
      return (marks.find((mark) => mark.type === "richStyle")?.attrs ?? {}) as Record<string, unknown>;
    };

    const colorMenu = openColorMenu(container, "Zeichenfarbe");
    fireEvent.click(within(colorMenu).getByLabelText("Zeichenfarbe: #b3261e"));
    expect(styleAttrs().color).toBe("#b3261e");

    const highlightMenu = openColorMenu(container, "Text-Markierung");
    fireEvent.click(within(highlightMenu).getByLabelText("Text-Markierung: #ffe066"));
    expect(styleAttrs().background).toBe("#ffe066");
  });

  it("bietet Theme-, Standard- und eigene Farben samt RGB-Feld", () => {
    const { container, surface, onAddCustom, onRemoveCustom } = setup({
      paragraphs: [{ runs: [{ text: "Text" }] }],
    });
    fireEvent.focus(surface);
    const menu = openColorMenu(container, "Zeichenfarbe");

    expect(within(menu).getByText("Theme")).toBeTruthy();
    expect(within(menu).getByText("Standard")).toBeTruthy();
    expect(within(menu).getByText("Eigene Farben")).toBeTruthy();
    expect(within(menu).getByLabelText("Zeichenfarbe: Text")).toBeTruthy();
    expect(within(menu).getByLabelText("Zeichenfarbe: #123456")).toBeTruthy();

    fireEvent.click(within(menu).getByLabelText("Eigene Farbe #123456 entfernen"));
    expect(onRemoveCustom).toHaveBeenCalledWith("#123456");

    fireEvent.change(within(menu).getByLabelText("Zeichenfarbe: Hex-Wert"), { target: { value: "#aabbcc" } });
    fireEvent.click(within(menu).getByLabelText("Zeichenfarbe: als eigene Farbe speichern"));
    expect(onAddCustom).toHaveBeenCalledWith("#aabbcc");
  });

  it("ändert den Box-Hintergrund über das Farbmenü", () => {
    const { container, surface, onStyleChange } = setup({ paragraphs: [{ runs: [{ text: "Text" }] }] });
    fireEvent.focus(surface);
    const menu = openColorMenu(container, "Box-Hintergrund");
    fireEvent.click(within(menu).getByLabelText("Box-Hintergrund: Fläche"));
    expect(onStyleChange).toHaveBeenCalledWith({ background: { type: "solid", color: "#f4f5f7" } });
  });

  it("wandelt eingefügten Markdown-Text in Tokens", () => {
    const { surface, instance } = setup({ paragraphs: [{ runs: [{ text: "Start" }] }] });
    fireEvent.focus(surface);
    instance().commands.focus("end");

    const clipboardData = {
      getData: (type: string) => (type === "text/plain" ? "# Titel\n\n- Punkt" : ""),
    };
    instance().view.dom.dispatchEvent(
      Object.assign(new Event("paste", { bubbles: true, cancelable: true }), { clipboardData }),
    );

    const blocks = (docToContent(instance().getJSON()).paragraphs ?? []) as Paragraph[];
    expect(blocks.some((block) => block.heading === 1)).toBe(true);
    expect(blocks.some((block) => block.list?.kind === "bullet")).toBe(true);
  });

  it("öffnet den Markdown-Dialog und ersetzt den Inhalt", () => {
    const { container, surface, onContentChange } = setup({ paragraphs: [{ runs: [{ text: "Alt" }] }] });
    fireEvent.focus(surface);
    fireEvent.click(buttonByTitle(container, "Markdown einfügen oder exportieren (Panel)"));

    const dialog = container.querySelector('[role="dialog"][aria-label="Markdown einfügen oder exportieren"]') as HTMLElement;
    expect(dialog).not.toBeNull();
    const textarea = dialog.querySelector('textarea[aria-label="Markdown"]') as HTMLTextAreaElement;
    expect(textarea.value).toContain("Alt");

    fireEvent.change(textarea, { target: { value: "# Titel\n\n**fett**\n\n| A | B |\n| --- | --- |\n| 1 | 2 |" } });
    fireEvent.click(within(dialog).getByText("Übernehmen (ersetzt den Text)"));

    expect(onContentChange).toHaveBeenCalledTimes(1);
    const content = onContentChange.mock.calls[0][0] as RichTextContent;
    expect(content.paragraphs?.[0]).toMatchObject({ heading: 1 });
    expect((content.paragraphs?.[1] as Paragraph).runs[0]).toMatchObject({ text: "fett", marks: [{ type: "bold" }] });
    expect((content.paragraphs?.[2] as { type?: string }).type).toBe("table");
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("zeigt Schrift und Größe als Ist-Werte (Standard statt leer)", () => {
    const { container, surface, instance } = setup({ paragraphs: [{ runs: [{ text: "Text" }] }] });
    fireEvent.focus(surface);
    instance().commands.setTextSelection({ from: 2, to: 2 });

    const family = container.querySelector('select[aria-label="Schriftfamilie"]') as HTMLSelectElement;
    const size = container.querySelector('input[aria-label="Schriftgröße"]') as HTMLInputElement;
    expect(family.value).toBe("");
    expect(family.selectedOptions[0].textContent).toBe("Standard");
    expect(size.value).toBe("16");
    expect(size.closest(".fb-sizefield")?.className).toContain("is-inherited");

    // Formatierter Text zeigt seine Werte, das Feld ist nicht mehr „geerbt".
    instance().commands.selectAll();
    fireEvent.change(family, { target: { value: "serif" } });
    fireEvent.change(size, { target: { value: "24" } });
    fireEvent.blur(size);
    instance().commands.setTextSelection({ from: 2, to: 2 });
    expect(family.value).toBe("serif");
    expect(size.value).toBe("24");
    expect(size.closest(".fb-sizefield")?.className).not.toContain("is-inherited");
  });

  it("öffnet JSON im Panel, schließt bei erneutem Klick und bei Formatierung", () => {
    const { container, surface, instance } = setup({ paragraphs: [{ heading: 2, runs: [{ text: "Titel" }] }] });
    fireEvent.focus(surface);
    const jsonButton = buttonByTitle(container, "JSON des Textes anzeigen (Panel)");

    fireEvent.click(jsonButton);
    const panel = container.querySelector('[role="region"][aria-label="Text als JSON"]') as HTMLElement;
    expect(panel).not.toBeNull();
    const textarea = panel.querySelector('textarea[aria-label="Text-JSON"]') as HTMLTextAreaElement;
    expect(textarea.readOnly).toBe(true);
    expect(textarea.value).toContain('"heading": 2');

    // Erneuter Klick schließt das Panel.
    fireEvent.click(jsonButton);
    expect(container.querySelector('[role="region"][aria-label="Text als JSON"]')).toBeNull();

    // Panel offen + Formatierung → Panel schließt.
    fireEvent.click(jsonButton);
    expect(container.querySelector('[role="region"][aria-label="Text als JSON"]')).not.toBeNull();
    fireEvent.click(buttonByTitle(container, "Fett (Strg+B)"));
    expect(container.querySelector('[role="region"][aria-label="Text als JSON"]')).toBeNull();
    // Ohne Auswahl wird nur die nächste Eingabe vorformatiert.
    expect(instance().state.storedMarks?.some((mark) => mark.type.name === "bold")).toBe(true);
  });

  it("wechselt zwischen Markdown- und JSON-Panel, jeweils mit Schließen", () => {
    const { container, surface } = setup({ paragraphs: [{ runs: [{ text: "Text" }] }] });
    fireEvent.focus(surface);

    fireEvent.click(buttonByTitle(container, "Markdown einfügen oder exportieren (Panel)"));
    expect(container.querySelector('[role="dialog"][aria-label="Markdown einfügen oder exportieren"]')).not.toBeNull();

    fireEvent.click(buttonByTitle(container, "JSON des Textes anzeigen (Panel)"));
    expect(container.querySelector('[role="dialog"][aria-label="Markdown einfügen oder exportieren"]')).toBeNull();
    const json = container.querySelector('[role="region"][aria-label="Text als JSON"]') as HTMLElement;
    expect(json).not.toBeNull();

    fireEvent.click(within(json).getByText("Schließen"));
    expect(container.querySelector('[role="region"][aria-label="Text als JSON"]')).toBeNull();
  });

  it("fügt eine Tabelle mit zwei Spalten ein und erweitert sie per Tab", () => {
    const { container, surface, instance } = setup({ paragraphs: [{ runs: [{ text: "Start" }] }] });
    fireEvent.focus(surface);
    fireEvent.click(buttonByTitle(container, "Tabelle mit 2 Spalten einfügen (Tab erweitert)"));

    const json = () => JSON.stringify(instance().getJSON());
    expect(json()).toContain('"richTable"');
    let table = (docToContent(instance().getJSON()).paragraphs ?? []).find(
      (block) => (block as { type?: string }).type === "table",
    ) as { columns: unknown[]; rows: Array<{ header?: boolean; cells: unknown[] }> } | undefined;
    expect(table?.columns).toHaveLength(2);
    expect(table?.rows).toHaveLength(2);
    expect(table?.rows[0].header).toBe(true);

    // Tab innerhalb der Tabelle: erst nächste Zelle, am Ende neue Spalte.
    const tab = () => instance().view.dom.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    tab();
    tab();
    tab();
    tab();
    const tableOf = () =>
      (docToContent(instance().getJSON()).paragraphs ?? []).find(
        (block) => (block as { type?: string }).type === "table",
      ) as { columns: unknown[]; rows: Array<{ cells: unknown[] }> } | undefined;

    table = tableOf();
    expect(table?.columns).toHaveLength(3);
    expect(table?.rows.every((row) => row.cells.length === 3)).toBe(true);

    // Bei 6 Spalten entsteht am Tabellenende eine neue Zeile (Word-Verhalten).
    const sequence: Array<{ columns: number; rows: number }> = [];
    for (let index = 0; index < 5; index += 1) {
      tab();
      sequence.push({ columns: tableOf()?.columns.length ?? 0, rows: tableOf()?.rows.length ?? 0 });
    }
    expect(sequence).toEqual([
      { columns: 4, rows: 2 },
      { columns: 5, rows: 2 },
      { columns: 6, rows: 2 },
      { columns: 6, rows: 3 },
      { columns: 6, rows: 3 },
    ]);

    // Zweite Tabelle: der Cursor landet in der neuen (letzten) Tabelle.
    fireEvent.click(buttonByTitle(container, "Tabelle mit 2 Spalten einfügen (Tab erweitert)"));
    for (let index = 0; index < 4; index += 1) tab();
    const tables = (docToContent(instance().getJSON()).paragraphs ?? []).filter(
      (block) => (block as { type?: string }).type === "table",
    ) as Array<{ columns: unknown[]; rows: unknown[] }>;
    expect(tables).toHaveLength(2);
    expect(tables[0].columns).toHaveLength(6);
    expect(tables[1].columns).toHaveLength(3);
  });

  it("fügt am Tabellenende per Enter eine Zeile hinzu und erlaubt Umbrüche in Zellen", () => {
    const { container, surface, instance } = setup({ paragraphs: [{ runs: [{ text: "Start" }] }] });
    fireEvent.focus(surface);
    fireEvent.click(buttonByTitle(container, "Tabelle mit 2 Spalten einfügen (Tab erweitert)"));

    const tableOf = () =>
      (docToContent(instance().getJSON()).paragraphs ?? []).find(
        (block) => (block as { type?: string }).type === "table",
      ) as { rows: Array<{ cells: Array<{ runs: Array<{ text: string }> }> }> } | undefined;
    const tab = () => instance().view.dom.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    const enter = () =>
      instance().view.dom.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(tableOf()?.rows).toHaveLength(2);

    // In die letzte Zelle der Tabelle und Enter: neue Zeile.
    tab();
    tab();
    tab();
    enter();
    expect(tableOf()?.rows).toHaveLength(3);

    // In einer Zelle mitten in der Tabelle: weicher Umbruch statt neuer Zeile.
    instance().commands.setTextSelection({ from: 2, to: 2 });
    instance().commands.insertContent("A");
    enter();
    const firstCell = tableOf()?.rows[0].cells[0];
    expect(firstCell?.runs.map((run) => run.text).join("")).toBe("A\n");
    expect(tableOf()?.rows).toHaveLength(3);
  });

  it("formatiert Gitter und Zellhintergründe über die Tabellen-Toolbox", () => {
    const { container, surface, instance } = setup({ paragraphs: [{ runs: [{ text: "Start" }] }] });
    fireEvent.focus(surface);
    fireEvent.click(buttonByTitle(container, "Tabelle mit 2 Spalten einfügen (Tab erweitert)"));
    fireEvent.click(buttonByTitle(container, "Tabellen-Gitter und Hintergrund"));

    const bar = container.querySelector('[role="group"][aria-label="Tabelle formatieren"]') as HTMLElement;
    expect(bar).not.toBeNull();

    const tableOf = () =>
      (docToContent(instance().getJSON()).paragraphs ?? []).find(
        (block) => (block as { type?: string }).type === "table",
      ) as
        | {
            border?: { color: string; style: string; width: number };
            rows: Array<{ cells: Array<{ text: string; background?: string }> }>;
          }
        | undefined;

    // Rahmen: Farbe, Stil, Stärke.
    fireEvent.change(within(bar).getByLabelText("Rahmenfarbe frei"), { target: { value: "#1f513d" } });
    fireEvent.change(within(bar).getByLabelText("Rahmenstil"), { target: { value: "dashed" } });
    fireEvent.change(within(bar).getByLabelText("Rahmenstärke"), { target: { value: "2" } });
    fireEvent.click(within(bar).getByText("Rahmen anwenden"));
    expect(tableOf()?.border).toEqual({ color: "#1f513d", style: "dashed", width: 2 });
    expect(container.querySelector("table.rt-table")?.getAttribute("data-bordered")).toBe("true");

    // Hintergrund für die ganze Zeile.
    fireEvent.change(within(bar).getByLabelText("Ziel der Tabellenaktion"), { target: { value: "row" } });
    fireEvent.change(within(bar).getByLabelText("Zellhintergrund frei"), { target: { value: "#fff3cd" } });
    const rowBackgrounds = tableOf()?.rows[0].cells.map((cell) => cell.background);
    expect(rowBackgrounds).toEqual(["#fff3cd", "#fff3cd"]);

    // Formate: Zebra entfernt den Rahmen, Rahmenlos räumt Hintergründe ab.
    fireEvent.click(within(bar).getByText("Zebra"));
    expect(tableOf()?.border).toBeUndefined();
    fireEvent.click(within(bar).getByText("Rahmenlos"));
    expect(tableOf()?.rows.every((row) => row.cells.every((cell) => cell.background === undefined))).toBe(true);
  });

  it("startet neue Tabellen mit sichtbarem Rahmen", () => {
    const { container, surface, instance } = setup({ paragraphs: [{ runs: [{ text: "Start" }] }] });
    fireEvent.focus(surface);
    fireEvent.click(buttonByTitle(container, "Tabelle mit 2 Spalten einfügen (Tab erweitert)"));

    const table = (docToContent(instance().getJSON()).paragraphs ?? []).find(
      (block) => (block as { type?: string }).type === "table",
    ) as unknown as { border?: { color: string; style: string; width: number } } | undefined;
    expect(table?.border).toEqual({ color: "#d5d9e0", style: "solid", width: 1 });
    expect(container.querySelector("table.rt-table")?.getAttribute("data-bordered")).toBe("true");
  });

  it("fügt Spalten links ein und entfernt die Cursor-Spalte", () => {
    const { container, surface, instance } = setup({ paragraphs: [{ runs: [{ text: "Start" }] }] });
    fireEvent.focus(surface);
    fireEvent.click(buttonByTitle(container, "Tabelle mit 2 Spalten einfügen (Tab erweitert)"));
    instance().commands.insertContent("A");
    fireEvent.click(buttonByTitle(container, "Tabellen-Gitter und Hintergrund"));

    const bar = container.querySelector('[role="group"][aria-label="Tabelle formatieren"]') as HTMLElement;
    const tableOf = () =>
      (docToContent(instance().getJSON()).paragraphs ?? []).find(
        (block) => (block as { type?: string }).type === "table",
      ) as unknown as
        | {
            columns: unknown[];
            rows: Array<{ header?: boolean; cells: Array<{ runs: Array<{ text: string }> }> }>;
          }
        | undefined;
    const texts = () => tableOf()?.rows.map((row) => row.cells.map((cell) => cell.runs.map((run) => run.text).join("")));

    expect(texts()).toEqual([
      ["A", ""],
      ["", ""],
    ]);

    // Links der Cursor-Spalte einfügen: alle Zeilen wachsen mit, „A" rutscht nach rechts.
    fireEvent.click(within(bar).getByText("Spalte links einfügen"));
    expect(tableOf()?.columns).toHaveLength(3);
    expect(texts()).toEqual([
      ["", "A", ""],
      ["", "", ""],
    ]);

    // Cursor steht in der neuen Spalte: entfernen stellt den Zustand wieder her.
    fireEvent.click(within(bar).getByText("Spalte entfernen"));
    expect(tableOf()?.columns).toHaveLength(2);
    expect(texts()).toEqual([
      ["A", ""],
      ["", ""],
    ]);

    // Auf eine Spalte reduzieren, dann bleibt sie stehen (Hinweis statt Verlust).
    fireEvent.click(within(bar).getByText("Spalte entfernen"));
    expect(tableOf()?.columns).toHaveLength(1);
    fireEvent.click(within(bar).getByText("Spalte entfernen"));
    expect(tableOf()?.columns).toHaveLength(1);
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Mindestens eine Spalte bleibt.");
  });

  it("färbt mit Ziel Spalte nur die Cursor-Spalte", () => {
    const { container, surface, instance } = setup({ paragraphs: [{ runs: [{ text: "Start" }] }] });
    fireEvent.focus(surface);
    fireEvent.click(buttonByTitle(container, "Tabelle mit 2 Spalten einfügen (Tab erweitert)"));
    fireEvent.click(buttonByTitle(container, "Tabellen-Gitter und Hintergrund"));

    const bar = container.querySelector('[role="group"][aria-label="Tabelle formatieren"]') as HTMLElement;
    fireEvent.change(within(bar).getByLabelText("Ziel der Tabellenaktion"), { target: { value: "column" } });
    fireEvent.change(within(bar).getByLabelText("Zellhintergrund frei"), { target: { value: "#fff3cd" } });

    const table = (docToContent(instance().getJSON()).paragraphs ?? []).find(
      (block) => (block as { type?: string }).type === "table",
    ) as unknown as {
      rows: Array<{ cells: Array<{ background?: string }> }>;
    };
    // Nur die Cursor-Spalte (0) ist gefärbt, die Nachbarspalte bleibt unberührt.
    expect(table.rows.map((row) => row.cells.map((cell) => cell.background))).toEqual([
      ["#fff3cd", undefined],
      ["#fff3cd", undefined],
    ]);
  });

  it("färbt Text in Zellen, ohne den Zellhintergrund zu ändern", () => {
    const { container, surface, instance } = setup({ paragraphs: [{ runs: [{ text: "Start" }] }] });
    fireEvent.focus(surface);
    fireEvent.click(buttonByTitle(container, "Tabelle mit 2 Spalten einfügen (Tab erweitert)"));
    instance().commands.insertContent("Hallo");
    fireEvent.click(buttonByTitle(container, "Tabellen-Gitter und Hintergrund"));

    const bar = container.querySelector('[role="group"][aria-label="Tabelle formatieren"]') as HTMLElement;
    fireEvent.change(within(bar).getByLabelText("Zellhintergrund frei"), { target: { value: "#fff3cd" } });
    fireEvent.change(within(bar).getByLabelText("Textfarbe frei"), { target: { value: "#b3261e" } });
    fireEvent.change(within(bar).getByLabelText("Text-Hintergrund frei"), { target: { value: "#b3d4fc" } });

    const table = (docToContent(instance().getJSON()).paragraphs ?? []).find(
      (block) => (block as { type?: string }).type === "table",
    ) as unknown as { rows: Array<{ cells: Array<{ runs: Array<{ text: string; color?: string; background?: string }>; background?: string }> }> };
    const cell = table.rows[0].cells[0];
    // Drei getrennte Ebenen: Zellfläche, Schriftfarbe, Textmarkierung.
    expect(cell.background).toBe("#fff3cd");
    expect(cell.runs).toEqual([{ text: "Hallo", color: "#b3261e", background: "#b3d4fc" }]);

    // Markierung entfernen lässt Zellhintergrund und Schriftfarbe unberührt.
    fireEvent.click(within(bar).getByText("Markierung entfernen"));
    const afterClear = (
      docToContent(instance().getJSON()).paragraphs ?? []
    ).find((block) => (block as { type?: string }).type === "table") as unknown as {
      rows: Array<{ cells: Array<{ runs: Array<{ text: string; color?: string; background?: string }>; background?: string }> }>;
    };
    expect(afterClear.rows[0].cells[0].background).toBe("#fff3cd");
    expect(afterClear.rows[0].cells[0].runs).toEqual([{ text: "Hallo", color: "#b3261e" }]);
  });

  it("hält die Markierung sichtbar, während die Leiste bedient wird", () => {
    const { container, surface, instance } = setup({ paragraphs: [{ runs: [{ text: "Erster " }, { text: "zweiter" }] }] });
    fireEvent.focus(surface);
    instance().commands.setTextSelection({ from: 10, to: 16 });

    // Fokus wechselt in ein Auswahlfeld → Markierung bleibt als Dekoration stehen.
    fireEvent.blur(surface);
    expect(container.querySelector(".rte-remembered")).not.toBeNull();

    fireEvent.change(container.querySelector('select[aria-label="Schriftfamilie"]') as HTMLSelectElement, {
      target: { value: "serif" },
    });
    const runs = firstParagraph(docToContent(instance().getJSON())).runs;
    expect(runs.at(-1)?.fontFamily).toBe("serif");

    // Klick in den Text löscht den Merker.
    fireEvent.mouseDown(surface);
    expect(container.querySelector(".rte-remembered")).toBeNull();
  });

  it("erlaubt einen weichen Zeilenumbruch im selben Absatz", () => {
    const { surface, instance } = setup({ paragraphs: [{ runs: [{ text: "Zeile 1" }] }] });
    fireEvent.focus(surface);
    instance().commands.focus("end");
    instance().commands.setHardBreak();
    const content = docToContent(instance().getJSON());
    expect(content.paragraphs).toHaveLength(1);
    expect(content.paragraphs?.[0]).toMatchObject({ runs: [{ text: "Zeile 1\n" }] });
  });

  it("lehnt javascript:-Links ab und übernimmt https-Links", () => {
    const { container, surface, instance } = setup({ paragraphs: [{ runs: [{ text: "Klick" }] }] });
    fireEvent.focus(surface);
    instance().commands.selectAll();
    fireEvent.click(buttonByTitle(container, "Link setzen oder ändern (Strg+K)"));

    const input = container.querySelector<HTMLInputElement>('input[aria-label="Link-Ziel"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: "javascript:alert(1)" } });
    fireEvent.click(buttonByTitle(container, "Link übernehmen"));
    expect(container.querySelector(".fb-error")?.textContent).toContain("https://");
    expect(instance().isActive("link")).toBe(false);

    fireEvent.change(input, { target: { value: "https://example.org/hinweis" } });
    fireEvent.click(buttonByTitle(container, "Link übernehmen"));
    expect(instance().getAttributes("link").href).toBe("https://example.org/hinweis");
  });

  it("meldet Änderungen beim Verlassen des Feldes an das Modell", () => {
    const { container, surface, instance, onContentChange } = setup({
      paragraphs: [{ runs: [{ text: "Text" }] }],
    });
    fireEvent.focus(surface);
    instance().commands.selectAll();
    fireEvent.click(boldButton(container));
    fireEvent.blur(surface);
    expect(onContentChange).toHaveBeenCalledTimes(1);
    expect(onContentChange.mock.calls[0][0]).toEqual({
      paragraphs: [{ runs: [{ text: "Text", marks: [{ type: "bold" }] }] }],
    });
  });

  it("entfernt Formatierungen vollständig", () => {
    const { container, surface, instance } = setup({
      paragraphs: [{ runs: [{ text: "Text", marks: [{ type: "bold" }], color: "#b3261e" }], align: "center" }],
    });
    fireEvent.focus(surface);
    instance().commands.selectAll();
    fireEvent.click(buttonByTitle(container, "Zeichen- und Absatzformatierung entfernen"));
    expect(instance().isActive("bold")).toBe(false);
    expect(instance().getAttributes("paragraph").align).toBe("start");
    expect(instance().getAttributes("richStyle").color ?? null).toBeNull();
  });
});






