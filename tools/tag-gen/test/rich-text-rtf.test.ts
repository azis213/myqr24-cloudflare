import { describe, expect, it } from "vitest";
import type { RichTextDocument } from "../src/domain";
import { richTextToRtf, rtfToRichText } from "../src/rich-text-rtf";

const defaults = { fontFamily: "helvetica" as const, fontSizePt: 9 };

describe("RTF rich-text codec", () => {
  it("roundtrips paragraphs, manual line breaks and run-specific formatting", () => {
    const document: RichTextDocument = {
      version: 1,
      paragraphs: [
        {
          runs: [
            {
              text: "Erste ",
              bold: true,
              color: "#aa1122",
              fontFamily: "times-roman",
              fontSizePt: 14,
            },
            {
              text: "Zeile\nmit Marker",
              italic: true,
              underline: true,
              backgroundColor: "#ffee33",
              fontFamily: "courier",
              fontSizePt: 11,
            },
          ],
        },
        { runs: [{ text: "Neuer Absatz", fontFamily: "helvetica", fontSizePt: 7 }] },
      ],
    };

    const rtf = richTextToRtf(document, defaults);
    const result = rtfToRichText(rtf, defaults);

    expect(result).toEqual({ ok: true, value: document });
    expect(rtf).toContain("\\line");
    expect(rtf).toContain("\\par");
    expect(rtf).toContain("\\highlight");
  });

  it("rejects missing RTF headers and unsafe RTF payloads", () => {
    expect(rtfToRichText("kein RTF", defaults)).toEqual({
      ok: false,
      errors: ["Der Quelltext muss mit einem RTF-Header wie {\\rtf1 beginnen."],
    });
    expect(rtfToRichText("{\\rtf1{\\object\\objdata bad}}", defaults)).toEqual({
      ok: false,
      errors: ["Der RTF-Text enthält nicht unterstützte oder unsichere Inhalte."],
    });
  });

  it("uses defaults for unformatted RTF text", () => {
    const result = rtfToRichText("{\\rtf1 Einfacher Text}", defaults);

    expect(result).toEqual({
      ok: true,
      value: {
        version: 1,
        paragraphs: [{
          runs: [{ text: "Einfacher Text", fontFamily: "helvetica", fontSizePt: 9 }],
        }],
      },
    });
  });
});
