import { describe, expect, it } from "vitest";
import { canonicalize } from "../domain/serialize";
import { contentToDoc, docToContent } from "./mapping";
import type { ContentBlock, Paragraph, RichTextContent, TableBlock } from "../domain/types";

const roundtrip = (content: RichTextContent) => docToContent(contentToDoc(content));

/** Testhelfer: Inhalt ist immer ein Absatz (keine Tabelle). */
const asParagraph = (block: ContentBlock | undefined): Paragraph => block as Paragraph;
const asTable = (block: ContentBlock | undefined) => block as TableBlock;

const paragraph = (partial: Partial<Paragraph> & { runs?: Paragraph["runs"] } = {}): Paragraph => ({
  runs: partial.runs ?? [{ text: "Text" }],
  ...partial,
});

describe("contentToDoc", () => {
  it("erzeugt immer ein gültiges Dokument mit mindestens einem Block", () => {
    expect(contentToDoc(undefined)).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
  });

  it("setzt die Überschrift als Block mit Ebene in den Absatzfluss", () => {
    const doc = contentToDoc({ paragraphs: [paragraph({ heading: 1, runs: [{ text: "Titel" }] }), paragraph()] });
    expect(doc.content?.[0]).toEqual({
      type: "richHeading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "Titel" }],
    });
    expect(doc.content?.[1].type).toBe("paragraph");
  });

  it("liest das Altfeld heading (schemaVersion 1) als Überschrift 3", () => {
    const doc = contentToDoc({ heading: "Titel", paragraphs: [paragraph()] });
    expect(doc.content?.[0]).toEqual({
      type: "richHeading",
      attrs: { level: 3 },
      content: [{ type: "text", text: "Titel" }],
    });
    expect(doc.content?.[1].type).toBe("paragraph");
  });

  it("verschachtelt Listen nach level", () => {
    const doc = contentToDoc({
      paragraphs: [
        paragraph({ list: { kind: "bullet", level: 0 } }),
        paragraph({ list: { kind: "bullet", level: 1 } }),
        paragraph({ list: { kind: "ordered", level: 2 } }),
      ],
    });
    const list = doc.content?.[0];
    expect(list?.type).toBe("bulletList");
    const item = list?.content?.[0];
    expect(item?.content?.[1]?.type).toBe("bulletList");
    expect(item?.content?.[1]?.content?.[0]?.content?.[1]?.type).toBe("orderedList");
  });

  it("hängt Zeichen-Attribute als Marks an", () => {
    const doc = contentToDoc({
      paragraphs: [
        paragraph({
          runs: [
            {
              text: "A",
              marks: [{ type: "bold" }, { type: "underline" }],
              color: "#b3261e",
              background: "#fff3cd",
              fontSize: 20,
              fontFamily: "serif",
              link: { href: "https://example.org" },
            },
          ],
        }),
      ],
    });
    const marks = doc.content?.[0].content?.[0].marks ?? [];
    expect(marks.map((mark) => mark.type)).toEqual(["bold", "underline", "richStyle", "link"]);
    expect(marks[2].attrs).toEqual({ color: "#b3261e", background: "#fff3cd", fontSize: 20, fontFamily: "serif" });
  });

describe("docToContent", () => {
  it("liest Marks, Farben, Größen und Links zurück", () => {
    const content: RichTextContent = {
      paragraphs: [
        paragraph({ heading: 2, runs: [{ text: "Titel" }] }),
        {
          runs: [
            { text: "Normal " },
            {
              text: "formatiert",
              marks: [{ type: "bold" }, { type: "italic" }],
              color: "#b3261e",
              background: "#fff3cd",
              fontSize: 24,
              fontFamily: "mono",
              link: { href: "https://example.org/hinweis" },
            },
          ],
        },
      ],
    };
    expect(roundtrip(content)).toEqual(content);
  });

  it("bildet weiche Zeilenumbrüche auf hardBreak ab und zurück", () => {
    const content: RichTextContent = {
      paragraphs: [{ runs: [{ text: "Zeile 1\nZeile 2" }, { text: "\nrot", color: "#b3261e" }] }],
    };
    const doc = contentToDoc(content);
    const inline = doc.content?.[0].content ?? [];
    const breaks = inline.filter((node) => node.type === "hardBreak");
    expect(breaks).toHaveLength(2);
    expect(roundtrip(content)).toEqual(content);
    // Der Umbruch trägt die Zeichen-Attribute des Runs.
    expect(breaks[1]).toMatchObject({ type: "hardBreak", marks: [{ type: "richStyle" }] });
  });

  it("liest Tabellen mit Kopfzeile, Ausrichtung und Zellen", () => {
    const content: RichTextContent = {
      paragraphs: [
        { heading: 2, runs: [{ text: "Bestand" }] },
        {
          type: "table",
          columns: [{}, { align: "end" }],
          rows: [
            { header: true, cells: [{ runs: [{ text: "Fach" }] }, { runs: [{ text: "Standort" }] }] },
            { cells: [{ runs: [{ text: "Roman" }] }, { runs: [{ text: "A-12" }] }] },
          ],
        },
        { runs: [{ text: "Ende" }] },
      ],
    };
    expect(roundtrip(content)).toEqual(content);
  });

  it("begrenzt Tabellen auf Spalten, Zeilen und Zelllänge", () => {
    const content = docToContent({
      type: "doc",
      content: [
        {
          type: "richTable",
          content: Array.from({ length: 3 }, () => ({
            type: "richTableRow",
            content: Array.from({ length: 9 }, () => ({
              type: "richTableCell",
              content: [{ type: "text", text: "x".repeat(300) }],
            })),
          })),
        },
      ],
    });
    const table = asTable(content.paragraphs?.[0]);
    expect(table.columns).toHaveLength(6);
    expect(table.rows[0].cells).toHaveLength(6);
    expect(table.rows[0].cells[0].runs.map((run) => run.text).join("")).toHaveLength(200);
  });

  it("überträgt Tabellenrahmen, Zellhintergrund und weiche Umbrüche", () => {
    const content: RichTextContent = {
      paragraphs: [
        {
          type: "table",
          border: { color: "#1f513d", style: "dashed", width: 2 },
          columns: [{}, { align: "center" }],
          rows: [
            { header: true, cells: [{ runs: [{ text: "A" }], background: "#fff3cd" }, { runs: [{ text: "B" }] }] },
            { cells: [{ runs: [{ text: "Zeile 1\nZeile 2" }] }, { runs: [] }] },
          ],
        },
      ],
    };
    expect(roundtrip(content)).toEqual(content);
  });

  it("überträgt Textfarbe, Text-Hintergrund, Marks und Links in Zellen", () => {
    const content: RichTextContent = {
      paragraphs: [
        {
          type: "table",
          columns: [{}, {}, {}],
          rows: [
            {
              cells: [
                {
                  runs: [
                    { text: "rot", color: "#b3261e" },
                    { text: " markiert", background: "#b3d4fc" },
                    { text: "fett", marks: [{ type: "bold" }] },
                    { text: "Link", link: { href: "https://example.org" } },
                  ],
                  background: "#fff3cd",
                },
                { runs: [] },
                { runs: [{ text: "x" }] },
              ],
            },
          ],
        },
      ],
    };
    const result = roundtrip(content);
    expect(result).toEqual(content);
  });

  it("verwirft unsichere Links und ungültige Farben in Zellen", () => {
    const content = docToContent({
      type: "doc",
      content: [
        {
          type: "richTable",
          content: [
            {
              type: "richTableRow",
              content: [
                {
                  type: "richTableCell",
                  content: [
                    {
                      type: "text",
                      text: "A",
                      marks: [
                        { type: "link", attrs: { href: "javascript:alert(1)" } },
                        { type: "richStyle", attrs: { color: "rot", background: "#b3d4fc" } },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    const table = asTable(content.paragraphs?.[0]);
    expect(table.rows[0].cells[0].runs).toEqual([{ text: "A", background: "#b3d4fc" }]);
  });

  it("verwirft ungültige Rahmenwerte beim Lesen des Editors", () => {
    const content = docToContent({
      type: "doc",
      content: [
        {
          type: "richTable",
          attrs: { borderColor: "rot", borderStyle: "solid", borderWidth: 1 },
          content: [{ type: "richTableRow", content: [{ type: "richTableCell" }] }],
        },
      ],
    });
    const table = asTable(content.paragraphs?.[0]);
    expect(table.border).toBeUndefined();
  });

  it("liest Absatzattribute und Listen zurück", () => {
    const content: RichTextContent = {
      paragraphs: [
        paragraph({ runs: [{ text: "Eins" }], list: { kind: "ordered", level: 0 } }),
        paragraph({ runs: [{ text: "Eins.a" }], list: { kind: "bullet", level: 1 } }),
        paragraph({ runs: [{ text: "Zwei" }], list: { kind: "ordered", level: 0 } }),
        paragraph({ runs: [{ text: "Absatz" }], align: "center", lineHeight: 1.5, indent: 2 }),
      ],
    };
    expect(roundtrip(content)).toEqual(content);
  });

  it("ist idempotent und deterministisch (kanonisch verglichen)", () => {
    const content: RichTextContent = {
      paragraphs: [
        paragraph({ heading: 4, runs: [{ text: "Kopf" }] }),
        {
          runs: [
            { text: "a" },
            { text: "b", marks: [{ type: "bold" }] },
            { text: "c", marks: [{ type: "bold" }] },
          ],
        },
      ],
    };
    const once = docToContent(contentToDoc(content));
    const twice = docToContent(contentToDoc(once));
    expect(canonicalize(twice)).toBe(canonicalize(once));
    // benachbarte identische Runs werden zusammengefasst
    expect(asParagraph(once.paragraphs?.[1]).runs).toEqual([{ text: "a" }, { text: "bc", marks: [{ type: "bold" }] }]);
  });

  it("verwirft unsichere Links und unbekannte Marks", () => {
    const content = docToContent({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "klick",
              marks: [
                { type: "link", attrs: { href: "javascript:alert(1)" } },
                { type: "highlight", attrs: { color: "#ff0000" } },
              ],
            },
          ],
        },
      ],
    });
    expect(asParagraph(content.paragraphs?.[0]).runs).toEqual([{ text: "klick" }]);
  });

  it("behält mehrere Überschriften mit ihrer Ebene", () => {
    const content = docToContent({
      type: "doc",
      content: [
        { type: "richHeading", attrs: { level: 1 }, content: [{ type: "text", text: "Erste" }] },
        { type: "paragraph", content: [{ type: "text", text: "Text" }] },
        { type: "richHeading", attrs: { level: 5 }, content: [{ type: "text", text: "Zweite" }] },
      ],
    });
    expect(content.heading).toBeUndefined();
    expect(content.paragraphs).toEqual([
      { heading: 1, runs: [{ text: "Erste" }] },
      { runs: [{ text: "Text" }] },
      { heading: 5, runs: [{ text: "Zweite" }] },
    ]);
  });

  it("behält Zeichen-Attribute auf Überschriften", () => {
    const content: RichTextContent = {
      paragraphs: [paragraph({ heading: 2, runs: [{ text: "Titel", marks: [{ type: "bold" }], color: "#b3261e" }] })],
    };
    expect(roundtrip(content)).toEqual(content);
  });

  it("klemmt Überschriftenebenen auf 1–5", () => {
    const content = docToContent({
      type: "doc",
      content: [{ type: "richHeading", attrs: { level: 9 }, content: [{ type: "text", text: "Zu tief" }] }],
    });
    expect(asParagraph(content.paragraphs?.[0]).heading).toBe(3);
  });

  it("normalisiert Ebenen über der Grenze", () => {
    const content = docToContent({
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "A" }] },
                {
                  type: "bulletList",
                  content: [
                    {
                      type: "listItem",
                      content: [
                        { type: "paragraph", content: [{ type: "text", text: "B" }] },
                        {
                          type: "orderedList",
                          content: [
                            {
                              type: "listItem",
                              content: [{ type: "paragraph", content: [{ type: "text", text: "C" }] }],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(content.paragraphs).toEqual([
      { runs: [{ text: "A" }], list: { kind: "bullet", level: 0 } },
      { runs: [{ text: "B" }], list: { kind: "bullet", level: 1 } },
      { runs: [{ text: "C" }], list: { kind: "ordered", level: 2 } },
    ]);
  });
});

});
