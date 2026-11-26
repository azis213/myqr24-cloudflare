// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import vaultTemplate from "../../public/templates/vault-standard.tagcontent.json";
import type { TagContentDocument } from "../domain/types";
import { Inspector } from "./Inspector";

afterEach(cleanup);

const clone = () => structuredClone(vaultTemplate) as unknown as TagContentDocument;
const textElement = (doc: TagContentDocument) => doc.elements.find((element) => element.elementType === "text")!;

describe("Inspector – Textkontrolle als JSON", () => {
  it("zeigt das Runs-Modell des gewählten Textfelds", () => {
    const doc = clone();
    const element = textElement(doc);
    const { container } = render(<Inspector doc={doc} selectedId={element.elementId} breakpoint="desktop" onChange={() => {}} />);
    const editor = container.querySelector('textarea[aria-label="Text-JSON"]') as HTMLTextAreaElement;
    expect(editor).not.toBeNull();
    expect(JSON.parse(editor.value)).toEqual(element.content ?? { paragraphs: [] });
    expect(container.querySelector(".json-text")).not.toBeNull();
  });

  it("übernimmt gültige Änderungen in das Dokument", () => {
    const doc = clone();
    const element = textElement(doc);
    const onChange = vi.fn();
    const { container } = render(<Inspector doc={doc} selectedId={element.elementId} breakpoint="desktop" onChange={onChange} />);
    const editor = container.querySelector('textarea[aria-label="Text-JSON"]') as HTMLTextAreaElement;

    const next = { heading: "Neu", paragraphs: [{ runs: [{ text: "Hallo", marks: [{ type: "bold" }] }] }] };
    fireEvent.change(editor, { target: { value: JSON.stringify(next) } });
    fireEvent.blur(editor);

    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0] as TagContentDocument;
    expect(updated.elements.find((entry) => entry.elementId === element.elementId)?.content).toEqual(next);
  });

  it("lehnt ungültiges JSON und Regelverstöße ab", () => {
    const doc = clone();
    const element = textElement(doc);
    const onChange = vi.fn();
    const { container } = render(<Inspector doc={doc} selectedId={element.elementId} breakpoint="desktop" onChange={onChange} />);
    const editor = container.querySelector('textarea[aria-label="Text-JSON"]') as HTMLTextAreaElement;

    fireEvent.change(editor, { target: { value: "{kaputt" } });
    fireEvent.blur(editor);
    expect(container.querySelector(".error-hint")?.textContent).toContain("JSON");

    // Unsichere Werte werden von den Regeln abgelehnt.
    fireEvent.change(editor, {
      target: { value: JSON.stringify({ paragraphs: [{ runs: [{ text: "x", color: "rot" }] }] }) },
    });
    fireEvent.blur(editor);
    expect(onChange).not.toHaveBeenCalled();
    expect(container.querySelector(".error-hint")?.textContent).toContain("color");
  });
});
describe("Inspector – Item-Fähigkeit", () => {
  it("zeigt Modus und Anzeigeform eines dynamischen Elements", () => {
    const doc = clone();
    const gallery = doc.elements.find((element) => element.elementType === "gallery")!;
    const { container } = render(<Inspector doc={doc} selectedId={gallery.elementId} breakpoint="desktop" onChange={() => {}} />);
    expect(container.textContent).toContain("dynamisch – eigene Items");
    expect(container.textContent).toContain("Alle sichtbaren Items werden angezeigt");
    expect(container.textContent).toContain("Slots: images");
  });

  it("kennzeichnet statische Elemente ohne Elementzeile", () => {
    const doc = clone();
    const text = textElement(doc);
    const { container } = render(<Inspector doc={doc} selectedId={text.elementId} breakpoint="desktop" onChange={() => {}} />);
    expect(container.textContent).toContain("statisch – keine Items");
    expect(container.textContent).toContain("keine Elementzeile und kein Item");
  });
});

