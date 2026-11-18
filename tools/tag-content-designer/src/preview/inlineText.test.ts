// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { RichTextContent } from "../domain/types";
import { mergeRuns, parseContentDom, plainText, renderContentToDom } from "./inlineText";

const container = () => document.createElement("div");

describe("parseContentDom", () => {
  it("liest Überschrift und Auszeichnungen aus dem DOM", () => {
    const root = container();
    root.innerHTML = '<h2 class="rt-heading">Titel</h2><p>Hallo <strong>Welt</strong> und <em>mehr</em></p>';
    const content = parseContentDom(root);
    expect(content.heading).toBe("Titel");
    expect(content.paragraphs?.[0].runs).toEqual([
      { text: "Hallo " },
      { text: "Welt", marks: [{ type: "bold" }] },
      { text: " und " },
      { text: "mehr", marks: [{ type: "italic" }] },
    ]);
  });

  it("erkennt Unterstrichen und verschachtelte Auszeichnungen", () => {
    const root = container();
    root.innerHTML = "<p><u><strong>fett</strong> und unterstrichen</u></p>";
    const runs = parseContentDom(root).paragraphs?.[0].runs ?? [];
    expect(runs[0]).toEqual({ text: "fett", marks: [{ type: "bold" }, { type: "underline" }] });
    expect(runs[1]).toEqual({ text: " und unterstrichen", marks: [{ type: "underline" }] });
  });

  it("trennt Absätze an Blockelementen und Zeilenumbrüchen", () => {
    const root = container();
    root.innerHTML = "<div>Erster</div><div>Zweiter<br>Dritter</div>";
    const paragraphs = parseContentDom(root).paragraphs ?? [];
    expect(paragraphs.map((entry) => entry.runs.map((run) => run.text).join(""))).toEqual([
      "Erster",
      "Zweiter",
      "Dritter",
    ]);
  });

  it("liefert bei leerem Feld eine leere Absatzliste", () => {
    expect(parseContentDom(container())).toEqual({ paragraphs: [] });
  });
});

describe("renderContentToDom", () => {
  it("erzeugt Runs ohne HTML-String und ist verlustfrei lesbar", () => {
    const content: RichTextContent = {
      heading: "Kopf",
      paragraphs: [
        {
          runs: [
            { text: "Normal " },
            { text: "fett", marks: [{ type: "bold" }] },
            { text: " kursiv", marks: [{ type: "italic" }] },
          ],
        },
      ],
    };
    const root = container();
    renderContentToDom(root, content);
    expect(root.querySelector("h2")?.textContent).toBe("Kopf");
    expect(root.querySelectorAll("strong")).toHaveLength(1);
    expect(parseContentDom(root)).toEqual(content);
  });

  it("maskiert spitze Klammern als Text", () => {
    const root = container();
    renderContentToDom(root, { paragraphs: [{ runs: [{ text: "<script>alert(1)</script>" }] }] });
    expect(root.querySelector("script")).toBeNull();
    expect(root.textContent).toContain("<script>alert(1)</script>");
  });
});

describe("Hilfsfunktionen", () => {
  it("fasst Runs mit gleichen Marks zusammen", () => {
    expect(
      mergeRuns([
        { text: "a" },
        { text: "b" },
        { text: "c", marks: [{ type: "bold" }] },
        { text: "", marks: [{ type: "bold" }] },
      ]),
    ).toEqual([{ text: "ab" }, { text: "c", marks: [{ type: "bold" }] }]);
  });

  it("ignoriert unbekannte Marks", () => {
    const runs = mergeRuns([{ text: "x", marks: [{ type: "blink" as "bold" }] }]);
    expect(runs).toEqual([{ text: "x" }]);
  });

  it("liefert Klartext für Suche und Vorschau", () => {
    expect(plainText({ heading: "A", paragraphs: [{ runs: [{ text: "B" }] }, { runs: [{ text: "C" }] }] })).toBe(
      "A\nB\nC",
    );
  });
});
