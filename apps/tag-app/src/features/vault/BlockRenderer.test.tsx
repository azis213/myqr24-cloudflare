import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BlockRenderer } from "./BlockRenderer";
import { RichText, themeVariables } from "./RichText";
import type { VaultBlock } from "./types";

const render = (block: VaultBlock) => renderToStaticMarkup(<BlockRenderer block={block} />);

describe("vault block rendering", () => {
  it("renders empty galleries/documents with slot capacity placeholders", () => {
    expect(render({ type: "gallery", title: "Bilder", images: [], slots: [{ accepts: ["image"], max: 48 }] })).toContain("Noch keine Bilder");
    expect(render({ type: "documents", title: "Dokumente", documents: [] })).toContain("Noch keine Dokumente");
  });

  it("renders all current special blocks and ignores unknown types", () => {
    for (const type of ["image", "document", "divider", "notice", "finder-form", "contact", "maintenance"] as const) {
      expect(render({ type })).not.toBe("");
    }
    expect(render({ type: "future-block" } as unknown as VaultBlock)).toBe("");
  });

  it("prefers RichText content and safely renders links and tables", () => {
    const markup = render({
      type: "text",
      title: "Fallback title",
      paragraphs: ["Fallback paragraph"],
      content: { paragraphs: [
        { heading: 2, runs: [{ text: "Structured" }] },
        { runs: [{ text: "Safe", marks: [{ type: "bold" }, { type: "link", href: "javascript:alert(1)" }] }] },
        { type: "table", rows: [{ header: true, cells: [{ runs: [{ text: "Head" }] }] }] },
      ] },
    });
    expect(markup).toContain("Structured");
    expect(markup).toContain("<strong>Safe</strong>");
    expect(markup).toContain("<th");
    expect(markup).not.toContain("javascript:");
    expect(markup).not.toContain("Fallback paragraph");
  });

  it("uses a plaintext fallback and exposes theme CSS variables", () => {
    expect(render({ type: "text", paragraphs: ["Plaintext"] })).toContain("Plaintext");
    const style = themeVariables({ colorMode: "dark", colors: { background: "#000000", accent: "#112233" } });
    expect((style as Record<string, unknown>)["--tag-bg"]).toBe("#000000");
    expect((style as Record<string, unknown>)["--tag-accent"]).toBe("#112233");
  });

  it("keeps untrusted media URLs out of image tags", () => {
    const markup = render({ type: "gallery", title: "Unsafe", images: [{ url: "javascript:alert(1)", alt: "unsafe" }] });
    expect(markup).not.toContain("<img");
    expect(markup).not.toContain("javascript:");
  });
});