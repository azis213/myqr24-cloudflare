import { useEffect, useRef, useState } from "react";
import { canonicalize } from "../domain/serialize";
import type { ElementStyle, RichTextContent } from "../domain/types";
import { parseContentDom, renderContentToDom } from "./inlineText";

export interface InlineTextEditorProps {
  content?: RichTextContent;
  style?: ElementStyle;
  placeholder?: string;
  onContentChange: (content: RichTextContent) => void;
  onStyleChange: (patch: Partial<ElementStyle>) => void;
}

const MARK_COMMANDS = [
  { command: "bold", label: "B", title: "Fett (Strg+B)", className: "fb-bold" },
  { command: "italic", label: "I", title: "Kursiv (Strg+I)", className: "fb-italic" },
  { command: "underline", label: "U", title: "Unterstrichen (Strg+U)", className: "fb-underline" },
] as const;

export function InlineTextEditor({
  content,
  style,
  placeholder = "Text eingeben …",
  onContentChange,
  onStyleChange,
}: InlineTextEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (root.contains(document.activeElement)) return;
    renderContentToDom(root, content);
  }, [content]);

  const commit = () => {
    const root = rootRef.current;
    if (!root) return;
    const next = parseContentDom(root);
    // Reines Hineinklicken ohne Änderung darf das Dokument nicht "dirty" machen.
    if (canonicalize(next) === canonicalize(content ?? { paragraphs: [] })) return;
    onContentChange(next);
  };

  const applyMark = (command: "bold" | "italic" | "underline") => {
    const root = rootRef.current;
    if (!root) return;
    root.focus();
    document.execCommand(command);
    commit();
  };

  const textColor = style?.textColor && style.textColor.startsWith("#") ? style.textColor : "#1c1c1c";
  const backgroundColor =
    style?.background?.color && style.background.color.startsWith("#") ? style.background.color : "#ffffff";

  return (
    <div
      className="inline-editor"
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        // Fokus innerhalb der Leiste (z. B. Farbwähler) darf die Leiste nicht schließen.
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        commit();
        setFocused(false);
      }}
    >
      {focused ? (
        <div className="formatbar" role="toolbar" aria-label="Text formatieren">
          {MARK_COMMANDS.map((entry) => (
            <button
              key={entry.command}
              type="button"
              className={`fb-btn ${entry.className}`}
              title={entry.title}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyMark(entry.command)}
            >
              {entry.label}
            </button>
          ))}
          <span className="fb-sep" aria-hidden="true" />
          <label className="fb-color" title="Textfarbe für dieses Element">
            <span className="fb-glyph">A</span>
            <input
              type="color"
              value={textColor}
              onChange={(event) => onStyleChange({ textColor: event.target.value })}
            />
          </label>
          <label className="fb-color" title="Hintergrundfarbe dieses Elements">
            <span className="fb-glyph fb-swatch" style={{ background: backgroundColor }} />
            <input
              type="color"
              value={backgroundColor}
              onChange={(event) => onStyleChange({ background: { type: "solid", color: event.target.value } })}
            />
          </label>
          <button
            type="button"
            className="fb-btn"
            title="Text- und Hintergrundfarbe zurücksetzen"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onStyleChange({ textColor: undefined, background: undefined })}
          >
            ↺
          </button>
        </div>
      ) : null}

      <div
        ref={rootRef}
        className="inline-surface"
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={commit}
        onPaste={(event) => {
          // Nur Klartext übernehmen – nie fremdes HTML ins Modell tragen.
          event.preventDefault();
          const text = event.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
        }}
      />
    </div>
  );
}
