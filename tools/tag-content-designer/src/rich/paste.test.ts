import { describe, expect, it } from "vitest";
import { sanitizePastedHtml } from "./paste";

describe("sanitizePastedHtml", () => {
  it("entfernt aktive Elemente samt Inhalt", () => {
    const clean = sanitizePastedHtml('<p>Hallo</p><script>alert(1)</script><style>p{color:red}</style>');
    expect(clean).not.toContain("script");
    expect(clean).not.toContain("alert");
    expect(clean).not.toContain("color:red");
    expect(clean).toContain("Hallo");
  });

  it("entfernt Event-Handler-Attribute", () => {
    const clean = sanitizePastedHtml('<p onclick="alert(1)" onmouseover=alert(2)>Text</p>');
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("onmouseover");
    expect(clean).toContain("Text");
  });

  it("entfernt gefährliche Link- und Quell-Ziele", () => {
    const clean = sanitizePastedHtml('<a href="javascript:alert(1)">Klick</a><img src="data:image/png;base64,AAA">');
    expect(clean.toLowerCase()).not.toContain("javascript:");
    expect(clean.toLowerCase()).not.toContain("data:");
    expect(clean).toContain("Klick");
  });

  it("entfernt iframes, inputs und svg", () => {
    const clean = sanitizePastedHtml('<iframe src="https://x"></iframe><input value="a"><svg><circle/></svg>Text');
    expect(clean).not.toContain("iframe");
    expect(clean).not.toContain("<input");
    expect(clean).not.toContain("svg");
    expect(clean).toContain("Text");
  });

  it("lässt normale Formatierung stehen (Konverter übernimmt das Schema)", () => {
    const html = '<p style="text-align:center">Text <strong>fett</strong> <span style="color:#b3261e">rot</span></p>';
    expect(sanitizePastedHtml(html)).toBe(html);
  });

  it("liefert für leere Eingabe einen leeren String", () => {
    expect(sanitizePastedHtml("")).toBe("");
  });
});
