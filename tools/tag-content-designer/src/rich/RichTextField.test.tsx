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
    fireEvent.click(container.querySelector('button[aria-label="Schriftgröße erhöhen"]') as HTMLButtonElement);
    expect(size.value).toBe("18");
    fireEvent.click(container.querySelector('button[aria-label="Schriftgröße verringern"]') as HTMLButtonElement);
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
    // Nur den zweiten Absatz komplett markieren, dann Auswahl aufheben (Cursor in Absatz 1).
    instance().commands.setTextSelection({ from: 10, to: 16 });
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
    fireEvent.click(buttonByTitle(container, "Markdown einfügen oder exportieren"));

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


