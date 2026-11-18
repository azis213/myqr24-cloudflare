import { describe, expect, it } from "vitest";
import type { Paragraph, RichTextContent, TableBlock } from "../domain/types";
import { parseMarkdown, looksLikeMarkdown, toMarkdown } from "./markdown";

const asParagraph = (block: unknown): Paragraph => block as Paragraph;
const asTable = (block: unknown): TableBlock => block as TableBlock;

describe("looksLikeMarkdown", () => {
  it("erkennt Struktur-Signale", () => {
    expect(looksLikeMarkdown("# Titel")).toBe(true);
    expect(looksLikeMarkdown("Text\n\n- Punkt")).toBe(true);
    expect(looksLikeMarkdown("1. Erster")).toBe(true);
    expect(looksLikeMarkdown("**fett**")).toBe(true);
    expect(looksLikeMarkdown("[Link](https://example.org)")).toBe(true);
    expect(looksLikeMarkdown("| A | B |\n| --- | --- |")).toBe(true);
  });

  it("lässt normalen Fließtext unangetastet", () => {
    expect(looksLikeMarkdown("Bitte beachten: der Raum ist offen.")).toBe(false);
    expect(looksLikeMarkdown("2 * 3 = 6")).toBe(false);
    expect(looksLikeMarkdown("")).toBe(false);
  });
});

describe("parseMarkdown", () => {
  it("erkennt Überschriften 1–5 und begrenzt Ebene 6", () => {
    const { content } = parseMarkdown("# Eins\n\n##### Fünf\n\n###### Sechs");
    expect(content.paragraphs?.map((block) => asParagraph(block).heading)).toEqual([1, 5, 5]);
    expect(asParagraph(content.paragraphs?.[0]).runs[0].text).toBe("Eins");
  });

  it("übernimmt fett, kursiv, Links und weiche Umbrüche", () => {
    const { content } = parseMarkdown("**fett** *kursiv* [Link](https://example.org)\nZeile 2");
    const runs = asParagraph(content.paragraphs?.[0]).runs;
    const byText = (text: string) => runs.find((run) => run.text === text)!;
    expect(runs.map((run) => run.text).join("")).toBe("fett kursiv Link\nZeile 2");
    expect(byText("fett").marks).toEqual([{ type: "bold" }]);
    expect(byText("kursiv").marks).toEqual([{ type: "italic" }]);
    expect(byText("Link").link).toEqual({ href: "https://example.org" });
  });

  it("verwirft unsichere Links, behält den Text", () => {
    const { content, warnings } = parseMarkdown("[klick](javascript:alert(1))");
    const runs = asParagraph(content.paragraphs?.[0]).runs;
    // markdown-it lehnt das Protokoll ab und liefert den Rohtext – nie ein Link-Mark.
    expect(runs.some((run) => run.link)).toBe(false);
    expect(runs.map((run) => run.text).join("")).toContain("javascript");
    expect(warnings.join(" ")).toContain("Unsichere Links");
  });

  it("baut Listen mit Ebenen", () => {
    const { content } = parseMarkdown("- Eins\n  - Eins.a\n- Zwei\n\n1. Erster\n2. Zweiter");
    const paragraphs = (content.paragraphs ?? []).map(asParagraph);
    expect(paragraphs[0].list).toEqual({ kind: "bullet", level: 0 });
    expect(paragraphs[1].list).toEqual({ kind: "bullet", level: 1 });
    expect(paragraphs[2].list).toEqual({ kind: "bullet", level: 0 });
    expect(paragraphs[3].list).toEqual({ kind: "ordered", level: 0 });
    expect(paragraphs[4].runs[0].text).toBe("Zweiter");
  });

  it("legt Tabellen mit Kopfzeile und Ausrichtung an", () => {
    const { content } = parseMarkdown("| Fach | Standort |\n|:--|--:|\n| Roman | A-12 |");
    const table = asTable(content.paragraphs?.[0]);
    expect(table.type).toBe("table");
    expect(table.columns).toEqual([{}, { align: "end" }]);
    expect(table.rows[0]).toEqual({ header: true, cells: [{ text: "Fach" }, { text: "Standort" }] });
    expect(table.rows[1]).toEqual({ cells: [{ text: "Roman" }, { text: "A-12" }] });
  });

  it("nimmt HTML als Text und entfernt Code-Auszeichnung", () => {
    const { content, warnings } = parseMarkdown("<b>fett</b> und `code`");
    const text = asParagraph(content.paragraphs?.[0]).runs.map((run) => run.text).join("");
    expect(text).toContain("<b>fett</b>");
    expect(text).toContain("code");
    expect(warnings.join(" ")).toContain("Code");
  });
});

describe("toMarkdown", () => {
  const sample: RichTextContent = {
    paragraphs: [
      { heading: 2, runs: [{ text: "Titel" }] },
      { runs: [{ text: "Normal " }, { text: "fett", marks: [{ type: "bold" }] }] },
      { runs: [{ text: "Eins" }], list: { kind: "ordered", level: 0 } },
      { runs: [{ text: "Zwei" }], list: { kind: "ordered", level: 0 } },
      { runs: [{ text: "Link", link: { href: "https://example.org" } }] },
      {
        type: "table",
        columns: [{}, { align: "center" }],
        rows: [
          { header: true, cells: [{ text: "A" }, { text: "B" }] },
          { cells: [{ text: "1" }, { text: "2" }] },
        ],
      },
    ],
  };

  it("schreibt Struktur als Markdown", () => {
    const { markdown } = toMarkdown(sample);
    expect(markdown).toContain("## Titel");
    expect(markdown).toContain("Normal **fett**");
    expect(markdown).toContain("1. Eins");
    expect(markdown).toContain("2. Zwei");
    expect(markdown).toContain("[Link](https://example.org)");
    expect(markdown).toContain("| A | B |");
    expect(markdown).toContain("| --- | :---: |");
  });

  it("weist auf nicht darstellbare Zeichenformate hin", () => {
    const { warnings } = toMarkdown({ paragraphs: [{ runs: [{ text: "rot", color: "#b3261e" }] }] });
    expect(warnings.join(" ")).toContain("Farben");
  });

  it("ist über den Umweg Markdown stabil", () => {
    const { markdown } = toMarkdown(sample);
    const { content } = parseMarkdown(markdown);
    expect((content.paragraphs ?? []).map(asParagraph)[0].heading).toBe(2);
    expect(asTable(content.paragraphs?.[5]).rows).toHaveLength(2);
  });

  it("maskiert Markdown-Sonderzeichen", () => {
    const { markdown } = toMarkdown({ paragraphs: [{ runs: [{ text: "a*b_c" }] }] });
    expect(markdown).toContain("a\\*b\\_c");
  });
});
