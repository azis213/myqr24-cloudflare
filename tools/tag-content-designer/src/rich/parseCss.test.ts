// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseCssColor, parseCssFontFamily, parseCssFontSize, parseCssLineHeight, parseCssTextAlign } from "./parseCss";

const element = (style: string, align?: string) => {
  const node = document.createElement("p");
  node.setAttribute("style", style);
  if (align) node.setAttribute("align", align);
  return node;
};

describe("parseCssColor", () => {
  it("akzeptiert Hex- und rgb-Werte", () => {
    expect(parseCssColor("#B3261E")).toBe("#b3261e");
    expect(parseCssColor("#fff")).toBe("#ffffff");
    expect(parseCssColor("rgb(179, 38, 30)")).toBe("#b3261e");
    expect(parseCssColor("rgba(179, 38, 30, 0.5)")).toBe("#b3261e");
  });

  it("verwirft Namen und Unsinn", () => {
    expect(parseCssColor("red")).toBeNull();
    expect(parseCssColor("")).toBeNull();
    expect(parseCssColor(undefined)).toBeNull();
  });
});

describe("parseCssFontSize", () => {
  it("bildet auf die Skala ab", () => {
    expect(parseCssFontSize("18px")).toBe(18);
    expect(parseCssFontSize("13.5pt")).toBe(18);
    expect(parseCssFontSize("1.25rem")).toBe(20);
    expect(parseCssFontSize("19px")).toBe(18);
  });

  it("verwirft Werte außerhalb der Skala", () => {
    expect(parseCssFontSize("40px")).toBeNull();
    expect(parseCssFontSize("2px")).toBeNull();
    expect(parseCssFontSize("groß")).toBeNull();
  });
});

describe("parseCssFontFamily", () => {
  it("erkennt die drei Familien", () => {
    expect(parseCssFontFamily("Georgia, serif")).toBe("serif");
    expect(parseCssFontFamily('Menlo, Consolas, "Courier New", monospace')).toBe("mono");
    expect(parseCssFontFamily('"Segoe UI", Roboto, sans-serif')).toBe("sans");
    expect(parseCssFontFamily("serif")).toBe("serif");
  });

  it("verwirft unbekannte Familien", () => {
    expect(parseCssFontFamily("Comic Sans MS")).toBeNull();
    expect(parseCssFontFamily("")).toBeNull();
  });
});

describe("parseCssTextAlign und parseCssLineHeight", () => {
  it("liest Ausrichtung aus style und align", () => {
    expect(parseCssTextAlign(element("text-align: center"))).toBe("center");
    expect(parseCssTextAlign(element("text-align: right"))).toBe("end");
    expect(parseCssTextAlign(element("", "center"))).toBe("center");
    expect(parseCssTextAlign(element("text-align: justify"))).toBeNull();
  });

  it("liest nur passende Zeilenabstände", () => {
    expect(parseCssLineHeight(element("line-height: 1.5"))).toBe(1.5);
    expect(parseCssLineHeight(element("line-height: 1.48"))).toBe(1.5);
    expect(parseCssLineHeight(element("line-height: 24px"))).toBeNull();
    expect(parseCssLineHeight(element("line-height: 1.4"))).toBeNull();
  });
});
