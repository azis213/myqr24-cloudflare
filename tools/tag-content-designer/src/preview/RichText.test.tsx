// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RichText } from "./RichText";

afterEach(cleanup);

describe("RichText", () => {
  it("rendert Überschrift, Auszeichnungen und Zeichen-Attribute", () => {
    const { container } = render(
      <RichText
        content={{
          heading: "Titel",
          paragraphs: [
            {
              runs: [
                { text: "fett", marks: [{ type: "bold" }] },
                { text: " rot", color: "#b3261e", fontSize: 20, fontFamily: "mono" },
              ],
            },
          ],
        }}
      />,
    );
    expect(container.querySelector("h3")?.textContent).toBe("Titel");
    expect(container.querySelector("h3")?.className).toContain("rt-heading-3");
    const spans = container.querySelectorAll<HTMLElement>(".rt-paragraph span");
    expect(spans[0].textContent).toBe("fett");
    expect(spans[0].style.fontWeight).toBe("700");
    expect(spans[1].style.color).toMatch(/#b3261e|rgb\(179,\s*38,\s*30\)/);
    expect(spans[1].style.fontSize).toBe("20px");
    expect(spans[1].style.fontFamily).toContain("monospace");
  });

  it("rendert Aufzählungen und Nummerierungen verschachtelt", () => {
    const { container } = render(
      <RichText
        content={{
          paragraphs: [
            { runs: [{ text: "Erster" }], list: { kind: "bullet", level: 0 } },
            { runs: [{ text: "Unterpunkt" }], list: { kind: "ordered", level: 1 } },
            { runs: [{ text: "Zweiter" }], list: { kind: "bullet", level: 0 } },
          ],
        }}
      />,
    );
    expect(container.querySelectorAll("ul.rt-list")).toHaveLength(1);
    expect(container.querySelectorAll("ul.rt-list > li")).toHaveLength(2);
    expect(container.querySelectorAll("ul.rt-list ol.rt-list")).toHaveLength(1);
  });

  it("rendert Überschriften mit Ebene, Tabellen mit Kopfzeile und Ausrichtung", () => {
    const { container } = render(
      <RichText
        content={{
          paragraphs: [
            { heading: 1, runs: [{ text: "Titel" }] },
            {
              type: "table",
              columns: [{}, { align: "center" }],
              rows: [
                { header: true, cells: [{ text: "Fach" }, { text: "Standort" }] },
                { cells: [{ text: "Roman" }, { text: "A-12" }] },
              ],
            },
          ],
        }}
      />,
    );
    const heading = container.querySelector("h1.rt-heading-1") as HTMLElement;
    expect(heading.textContent).toBe("Titel");
    expect(heading.getAttribute("data-level")).toBe("1");
    const table = container.querySelector("table.rt-table") as HTMLTableElement;
    expect(table).not.toBeNull();
    expect(table.querySelectorAll("th.rt-cell")).toHaveLength(2);
    expect(table.querySelectorAll("tbody tr")).toHaveLength(2);
    expect((table.querySelectorAll("td.rt-cell")[1] as HTMLElement).style.textAlign).toBe("center");
  });

  it("setzt Ausrichtung, Zeilenabstand und Einrückung", () => {
    const { container } = render(
      <RichText content={{ paragraphs: [{ runs: [{ text: "Text" }], align: "center", lineHeight: 1.5, indent: 2 }] }} />,
    );
    const paragraph = container.querySelector<HTMLElement>(".rt-paragraph") as HTMLElement;
    expect(paragraph.style.textAlign).toBe("center");
    expect(paragraph.style.lineHeight).toBe("1.5");
    expect(paragraph.style.paddingLeft).toBe("2.5rem");
  });

  it("zeigt Links ohne Navigation und mit rel", () => {
    const { container } = render(
      <RichText content={{ paragraphs: [{ runs: [{ text: "Link", link: { href: "https://example.org" } }] }] }} />,
    );
    const anchor = container.querySelector("a") as HTMLAnchorElement;
    expect(anchor.getAttribute("href")).toBe("https://example.org");
    expect(anchor.getAttribute("rel")).toContain("noopener");
    expect(anchor.getAttribute("target")).toBe("_blank");
  });

  it("zeigt HTML-Markup ausschließlich als Text", () => {
    const { container } = render(
      <RichText content={{ paragraphs: [{ runs: [{ text: "<script>alert(1)</script><b>fett</b>" }] }] }} />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });

  it("verwirft unsichere Links beim Rendern", () => {
    const { container } = render(
      <RichText content={{ paragraphs: [{ runs: [{ text: "böse", link: { href: "javascript:alert(1)" } }] }] }} />,
    );
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("böse");
  });
});
