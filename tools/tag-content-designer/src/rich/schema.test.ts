// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import type { Paragraph, RichTextContent } from "../domain/types";
import { contentToDoc, docToContent } from "./mapping";
import { HEADING_INPUT_PATTERN, createRichExtensions } from "./schema";

const openEditors: Editor[] = [];

/** Testhelfer: Blöcke als Absätze (keine Tabellen) für direkten Zugriff auf `runs`/`list`. */
const paragraphsOf = (content: RichTextContent): Paragraph[] => (content.paragraphs ?? []) as Paragraph[];

function createEditor(content?: RichTextContent): Editor {
  const element = document.createElement("div");
  document.body.append(element);
  const editor = new Editor({ element, extensions: createRichExtensions(), content: contentToDoc(content) });
  openEditors.push(editor);
  return editor;
}

afterEach(() => {
  for (const editor of openEditors.splice(0)) editor.destroy();
  document.body.replaceChildren();
});

describe("Markdown-Kürzel im Editor", () => {
  it("erkennt # bis ##### als Überschriftenebene", () => {
    const levels = ["# ", "## ", "### ", "#### ", "##### "].map((prefix) => HEADING_INPUT_PATTERN.exec(prefix)?.[1].length);
    expect(levels).toEqual([1, 2, 3, 4, 5]);
    expect(HEADING_INPUT_PATTERN.test("###### ")).toBe(false);
    expect(HEADING_INPUT_PATTERN.test("#Text ")).toBe(false);
    expect(HEADING_INPUT_PATTERN.test(" # ")).toBe(false);
  });

  it("setzt die Ebene per Tastenkürzel und macht leere Überschriften zu Absätzen", () => {
    const editor = createEditor({ paragraphs: [{ runs: [{ text: "Titel" }] }] });
    editor.commands.focus("start");

    editor.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", { key: "3", ctrlKey: true, altKey: true, bubbles: true }),
    );
    expect(paragraphsOf(docToContent(editor.getJSON()))[0].heading).toBe(3);

    // Inhalt der Überschrift leeren, dann Backspace → wieder Absatz.
    editor.commands.selectAll();
    editor.commands.deleteSelection();
    editor.view.dom.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));
    expect(paragraphsOf(docToContent(editor.getJSON()))[0].heading).toBeUndefined();
  });
});

describe("RTF-Schema", () => {
  it("registriert ausschließlich unsere Nodes und Marks", () => {
    const editor = createEditor();
    expect(Object.keys(editor.schema.marks).sort()).toEqual(["bold", "italic", "link", "richStyle", "underline"]);
    expect(Object.keys(editor.schema.nodes).sort()).toEqual([
      "bulletList",
      "doc",
      "hardBreak",
      "listItem",
      "orderedList",
      "paragraph",
      "richHeading",
      "richTable",
      "richTableCell",
      "richTableRow",
      "text",
    ]);
  });

  it("erlaubt Marks und Ebenen auf der Überschrift", () => {
    const editor = createEditor({
      paragraphs: [{ heading: 2, runs: [{ text: "Titel" }] }, { runs: [{ text: "Text" }] }],
    });
    editor.commands.selectAll();
    editor.commands.toggleBold();
    const heading = (editor.getJSON().content ?? []).find((node) => node.type === "richHeading");
    expect(heading?.attrs?.level).toBe(2);
    expect(heading?.content?.[0].marks ?? []).toHaveLength(1);
    expect(paragraphsOf(docToContent(editor.getJSON()))?.[0]).toMatchObject({
      heading: 2,
      runs: [{ text: "Titel", marks: [{ type: "bold" }] }],
    });
  });

  it("erzeugt Listen und rückt sie ein", () => {
    const editor = createEditor({ paragraphs: [{ runs: [{ text: "A" }] }, { runs: [{ text: "B" }] }] });
    editor.commands.selectAll();
    editor.commands.toggleBulletList();
    expect(paragraphsOf(docToContent(editor.getJSON()))?.[0].list).toEqual({ kind: "bullet", level: 0 });

    editor.commands.focus("end");
    editor.commands.sinkListItem("listItem");
    const paragraphs = paragraphsOf(docToContent(editor.getJSON())) ?? [];
    expect(paragraphs[paragraphs.length - 1].list).toEqual({ kind: "bullet", level: 1 });
  });

  it("schreibt Absatzattribute in das Modell", () => {
    const editor = createEditor({ paragraphs: [{ runs: [{ text: "Absatz" }] }] });
    editor.commands.selectAll();
    editor.commands.updateAttributes("paragraph", { align: "center", lineHeight: 1.5, indent: 2 });
    const paragraph = paragraphsOf(docToContent(editor.getJSON()))?.[0];
    expect(paragraph).toMatchObject({ align: "center", lineHeight: 1.5, indent: 2 });
  });

  it("speichert Zeichen-Attribute über das richStyle-Mark", () => {
    const editor = createEditor({ paragraphs: [{ runs: [{ text: "Farbe" }] }] });
    editor.commands.selectAll();
    editor.commands.setMark("richStyle", {
      color: "#b3261e",
      background: "#fff3cd",
      fontSize: 20,
      fontFamily: "serif",
    });
    const run = paragraphsOf(docToContent(editor.getJSON()))?.[0].runs[0];
    expect(run).toMatchObject({
      color: "#b3261e",
      background: "#fff3cd",
      fontSize: 20,
      fontFamily: "serif",
    });
  });

  it("verwirft javascript:-Links", () => {
    const editor = createEditor({ paragraphs: [{ runs: [{ text: "Klick" }] }] });
    editor.commands.selectAll();
    editor.commands.setLink({ href: "javascript:alert(1)" });
    const runs = paragraphsOf(docToContent(editor.getJSON()))?.[0].runs ?? [];
    expect(runs.every((run) => run.link === undefined)).toBe(true);
  });

  it("übernimmt https-Links", () => {
    const editor = createEditor({ paragraphs: [{ runs: [{ text: "Klick" }] }] });
    editor.commands.selectAll();
    editor.commands.setLink({ href: "https://example.org/hinweis" });
    const runs = paragraphsOf(docToContent(editor.getJSON()))?.[0].runs ?? [];
    expect(runs[0].link).toEqual({ href: "https://example.org/hinweis" });
  });

  it("entfernt Formatierung vollständig", () => {
    const editor = createEditor({
      paragraphs: [{ runs: [{ text: "Text", marks: [{ type: "bold" }], color: "#b3261e" }] }],
    });
    editor.commands.selectAll();
    editor.commands.unsetAllMarks();
    editor.commands.updateAttributes("paragraph", { align: "start", lineHeight: null, indent: 0 });
    expect(docToContent(editor.getJSON())).toEqual({ paragraphs: [{ runs: [{ text: "Text" }] }] });
  });
});

