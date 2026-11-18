// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RichTextContent } from "../domain/types";
import { InlineTextEditor } from "./InlineTextEditor";

afterEach(cleanup);

const content: RichTextContent = {
  heading: "Titel",
  paragraphs: [{ runs: [{ text: "Hallo " }, { text: "Welt", marks: [{ type: "bold" }] }] }],
};

function setup(onContentChange = vi.fn(), onStyleChange = vi.fn()) {
  const view = render(
    <InlineTextEditor content={content} onContentChange={onContentChange} onStyleChange={onStyleChange} />,
  );
  const surface = view.container.querySelector(".inline-surface") as HTMLElement;
  return { ...view, surface, onContentChange, onStyleChange };
}

describe("InlineTextEditor", () => {
  it("zeigt die Formatierleiste erst mit dem Fokus", () => {
    const { container, surface } = setup();
    expect(container.querySelector(".formatbar")).toBeNull();
    fireEvent.focus(surface);
    expect(container.querySelector(".formatbar")).not.toBeNull();
    expect(container.querySelectorAll(".fb-btn").length).toBeGreaterThanOrEqual(3);
  });

  it("meldet geänderte Runs als Modell", () => {
    const { surface, onContentChange } = setup();
    surface.innerHTML = '<h2 class="rt-heading">Titel</h2><p>Servus <strong>Welt</strong></p>';
    fireEvent.input(surface);
    expect(onContentChange).toHaveBeenCalledTimes(1);
    expect(onContentChange.mock.calls[0][0]).toEqual({
      heading: "Titel",
      paragraphs: [{ runs: [{ text: "Servus " }, { text: "Welt", marks: [{ type: "bold" }] }] }],
    });
  });

  it("meldet keine Änderung, wenn nur fokussiert und wieder verlassen wird", () => {
    const { surface, onContentChange } = setup();
    fireEvent.focus(surface);
    fireEvent.blur(surface);
    expect(onContentChange).not.toHaveBeenCalled();
  });

  it("reicht die Farbwahl als Element-Override weiter", () => {
    const { container, surface, onStyleChange } = setup();
    fireEvent.focus(surface);
    const inputs = container.querySelectorAll<HTMLInputElement>('.formatbar input[type="color"]');
    expect(inputs).toHaveLength(2);
    fireEvent.change(inputs[0], { target: { value: "#aa0000" } });
    expect(onStyleChange).toHaveBeenCalledWith({ textColor: "#aa0000" });
    fireEvent.change(inputs[1], { target: { value: "#00aa00" } });
    expect(onStyleChange).toHaveBeenCalledWith({ background: { type: "solid", color: "#00aa00" } });
  });

  it("setzt Farben über die Leiste zurück", () => {
    const { container, surface, onStyleChange } = setup();
    fireEvent.focus(surface);
    const reset = container.querySelectorAll<HTMLButtonElement>(".formatbar .fb-btn")[3];
    fireEvent.click(reset);
    expect(onStyleChange).toHaveBeenCalledWith({ textColor: undefined, background: undefined });
  });
});
