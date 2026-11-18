import { describe, expect, it } from "vitest";
import {
  groupBlocks,
  isSafeHref,
  mergeRuns,
  normalizeHref,
  paragraphPresentation,
  runPresentation,
} from "./richtext";
import type { Paragraph, TextRun } from "./types";

const paragraph = (partial: Partial<Paragraph> & { runs?: TextRun[] } = {}): Paragraph => ({
  runs: partial.runs ?? [{ text: "Text" }],
  ...partial,
});

describe("normalizeHref", () => {
  it("erlaubt https und mailto", () => {
    expect(normalizeHref("https://example.org/hinweis")).toBe("https://example.org/hinweis");
    expect(normalizeHref(" mailto:team@example.org ")).toBe("mailto:team@example.org");
    expect(isSafeHref("https://example.org")).toBe(true);
  });

  it("verwirft gefährliche und relative Ziele", () => {
    expect(normalizeHref("javascript:alert(1)")).toBeNull();
    expect(normalizeHref("JavaScript:alert(1)")).toBeNull();
    expect(normalizeHref("data:text/html,<b>x</b>")).toBeNull();
    expect(normalizeHref("vbscript:msgbox(1)")).toBeNull();
    expect(normalizeHref("/relativ")).toBeNull();
    expect(normalizeHref("https://example.org/a b")).toBeNull();
    expect(normalizeHref('https://example.org/"><script>')).toBeNull();
    expect(normalizeHref("")).toBeNull();
    expect(normalizeHref(42)).toBeNull();
  });
});

describe("mergeRuns", () => {
  it("fasst Runs mit identischen Zeichen-Attributen zusammen", () => {
    expect(
      mergeRuns([
        { text: "a" },
        { text: "b" },
        { text: "c", marks: [{ type: "bold" }] },
        { text: "", marks: [{ type: "bold" }] },
        { text: "d", color: "#AA0000" },
        { text: "e", color: "#aa0000" },
      ]),
    ).toEqual([
      { text: "ab" },
      { text: "c", marks: [{ type: "bold" }] },
      { text: "de", color: "#AA0000" },
    ]);
  });

  it("trennt Runs bei unterschiedlichen Attributen", () => {
    const merged = mergeRuns([
      { text: "x", fontSize: 20 },
      { text: "y", fontSize: 24 },
      { text: "z", fontFamily: "mono" },
      { text: "w", background: "#fff3cd" },
      { text: "v", link: { href: "https://example.org" } },
    ]);
    expect(merged).toHaveLength(5);
  });

  it("verwirft ungültige Attribute und unsichere Links", () => {
    const merged = mergeRuns([
      { text: "a", color: "rot", fontSize: 17 as 20, fontFamily: "comic" as "sans", link: { href: "javascript:alert(1)" } },
    ]);
    expect(merged).toEqual([{ text: "a" }]);
  });

  it("normalisiert die Mark-Reihenfolge", () => {
    expect(mergeRuns([{ text: "a", marks: [{ type: "underline" }, { type: "bold" }] }])).toEqual([
      { text: "a", marks: [{ type: "bold" }, { type: "underline" }] },
    ]);
  });
});

describe("groupBlocks", () => {
  it("hält Überschriften aus Listen heraus", () => {
    const blocks = groupBlocks([
      paragraph({ runs: [{ text: "Titel" }], heading: 1 }),
      paragraph({ runs: [{ text: "Punkt" }], list: { kind: "bullet", level: 0 } }),
      paragraph({ runs: [{ text: "Tief" }], list: { kind: "bullet", level: 1 } }),
      paragraph({ runs: [{ text: "Zwischentitel" }], heading: 4 }),
      paragraph({ runs: [{ text: "Punkt 2" }], list: { kind: "bullet", level: 0 } }),
    ]);
    expect(blocks.map((block) => block.type)).toEqual(["paragraph", "list", "paragraph", "list"]);
  });

  it("bildet Absätze und Listen in Dokumentreihenfolge", () => {
    const blocks = groupBlocks([
      paragraph({ runs: [{ text: "Einleitung" }] }),
      paragraph({ list: { kind: "bullet", level: 0 } }),
      paragraph({ list: { kind: "bullet", level: 0 } }),
      paragraph({ list: { kind: "ordered", level: 0 } }),
    ]);
    expect(blocks.map((block) => block.type)).toEqual(["paragraph", "list", "list"]);
    expect(blocks[1].type === "list" && blocks[1].items).toHaveLength(2);
  });

  it("verschachtelt tiefere Ebenen unter das vorige Element", () => {
    const blocks = groupBlocks([
      paragraph({ list: { kind: "bullet", level: 0 } }),
      paragraph({ list: { kind: "bullet", level: 1 } }),
      paragraph({ list: { kind: "ordered", level: 2 } }),
      paragraph({ list: { kind: "bullet", level: 0 } }),
    ]);
    expect(blocks).toHaveLength(1);
    const list = blocks[0];
    if (list.type !== "list") throw new Error("Liste erwartet");
    expect(list.items).toHaveLength(2);
    expect(list.items[0].children).toHaveLength(1);
    expect(list.items[0].children[0].type).toBe("list");
  });

  it("normalisiert Sprünge über mehrere Ebenen", () => {
    const blocks = groupBlocks([paragraph({ list: { kind: "bullet", level: 3 } })]);
    const list = blocks[0];
    if (list.type !== "list") throw new Error("Liste erwartet");
    expect(list.kind).toBe("bullet");
    expect(list.items).toHaveLength(1);
  });

  it("liefert für leere Eingabe keine Blöcke", () => {
    expect(groupBlocks()).toEqual([]);
  });
});

describe("Präsentation", () => {
  it("übersetzt Runs in CSS-nahe Werte", () => {
    expect(
      runPresentation({
        text: "x",
        marks: [{ type: "bold" }, { type: "italic" }, { type: "underline" }],
        color: "#b3261e",
        background: "#fff3cd",
        fontSize: 20,
        fontFamily: "serif",
      }),
    ).toEqual({
      fontWeight: 700,
      fontStyle: "italic",
      textDecoration: "underline",
      color: "#b3261e",
      backgroundColor: "#fff3cd",
      fontSize: "20px",
      fontFamily: 'Georgia, "Times New Roman", serif',
    });
  });

  it("übersetzt Absatzattribute und Einrückung", () => {
    expect(paragraphPresentation({ runs: [], align: "center", lineHeight: 1.5, indent: 2 })).toEqual({
      textAlign: "center",
      lineHeight: 1.5,
      paddingLeft: "2.5rem",
    });
    expect(paragraphPresentation({ runs: [] })).toEqual({});
  });
});
