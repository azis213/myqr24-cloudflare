import type { ChainedCommands, Editor } from "@tiptap/core";
import type { ReactNode, RefObject } from "react";
import { useState } from "react";
import { clampIndent, clampHeadingLevel, FONT_FAMILY_LABELS, isHexColor, LINE_HEIGHT_LABELS, normalizeHref } from "../domain/richtext";
import { FONT_FAMILIES, HEADING_LEVELS, LINE_HEIGHT_SCALE, MAX_INDENT } from "../domain/types";
import type { ElementStyle } from "../domain/types";
import { ColorMenu } from "./ColorMenu";
import {
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
  IconBulletList,
  IconBucket,
  IconClear,
  IconHighlighter,
  IconIndentDecrease,
  IconIndentIncrease,
  IconLink,
  IconOrderedList,
  IconTextColor,
  IconUnlink,
} from "./icons";
import { resolveSwatchColor, type PaletteContext } from "./palette";
import { SizeField } from "./SizeField";

export interface RichToolbarProps {
  editor: Editor;
  style?: ElementStyle;
  onStyleChange: (patch: Partial<ElementStyle>) => void;
  palette: PaletteContext;
  /** Letzte nicht-leere Auswahl: hält Formatieren auch dann wirksam, wenn der Fokus die Auswahl verloren hat. */
  selectionRef: RefObject<{ from: number; to: number } | null>;
  /** Öffnet den Markdown-Dialog (Einfügen/Exportieren). */
  onMarkdown: () => void;
}

function ToolButton({
  active,
  title,
  onClick,
  className,
  children,
}: {
  active?: boolean;
  title: string;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`fb-btn${className ? ` ${className}` : ""}${active ? " is-active" : ""}`}
      title={title}
      aria-label={title}
      aria-pressed={active === undefined ? undefined : active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}


/**
 * Aktuelle Zeichen-Attribute. Bei einem Cursor ohne Auswahl zählen auch die
 * „gespeicherten" Marks (Vorformatierung der nächsten Eingabe).
 */
function activeRichAttributes(editor: Editor): {
  color?: string | null;
  background?: string | null;
  fontSize?: number | null;
  fontFamily?: string | null;
} {
  const attrs = { ...(editor.getAttributes("richStyle") as Record<string, unknown>) };
  const isEmpty = ["color", "background", "fontSize", "fontFamily"].every(
    (key) => attrs[key] === null || attrs[key] === undefined,
  );
  if (isEmpty) {
    const { state } = editor;
    const marks = state.storedMarks ?? state.selection.$from.marks();
    const style = marks.find((mark) => mark.type.name === "richStyle");
    if (style) Object.assign(attrs, style.attrs);
  }
  return attrs as { color?: string | null; background?: string | null; fontSize?: number | null; fontFamily?: string | null };
}

export function RichToolbar({ editor, style, onStyleChange, palette, selectionRef, onMarkdown }: RichToolbarProps) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  const richAttrs = activeRichAttributes(editor);
  const paragraphAttrs = editor.getAttributes("paragraph") as {
    align?: string | null;
    lineHeight?: number | null;
    indent?: number | null;
  };

  const headingLevel = editor.isActive("richHeading") ? clampHeadingLevel(editor.getAttributes("richHeading").level) : null;
  const indentValue = clampIndent(paragraphAttrs.indent);
  const inList = editor.isActive("listItem");
  const textColor = isHexColor(richAttrs.color) ? richAttrs.color : "#1c1c1c";
  const highlightColor = isHexColor(richAttrs.background) ? richAttrs.background : "#ffe066";
  const boxColor = resolveSwatchColor(style?.background?.color, palette.themeColors) ?? "#ffffff";

  /**
   * Führt einen Befehl auf der Auswahl aus. Wirkt immer nur auf markierten Text:
   * - Auswahl vorhanden → darauf anwenden
   * - Cursor ohne Auswahl → nur Vorformatierung der nächsten Eingabe (Word-Verhalten)
   * - Fokus liegt in der Leiste (Auswahlfeld/Farbmenü) → zuletzt markierte Spanne wiederherstellen
   * Eine alte Auswahl wird nie „reaktiviert", solange der Editor den Fokus hat.
   */
  const runOnSelection = (apply: (chain: ChainedCommands) => ChainedCommands) => {
    const chain = editor.chain().focus();
    const lostFocus = !editor.isFocused;
    if (lostFocus && editor.state.selection.empty && selectionRef.current) {
      chain.setTextSelection(selectionRef.current);
    }
    apply(chain).run();
  };

  const applyRichStyle = (patch: Record<string, unknown>) => {
    const next: Record<string, unknown> = { ...activeRichAttributes(editor), ...patch };
    const hasAny = ["color", "background", "fontSize", "fontFamily"].some(
      (key) => next[key] !== null && next[key] !== undefined,
    );
    runOnSelection((chain) => (hasAny ? chain.setMark("richStyle", next) : chain.unsetMark("richStyle")));
  };

  const applyParagraph = (patch: Record<string, unknown>) =>
    runOnSelection((chain) => chain.updateAttributes("paragraph", patch));

  /** Absatzstil: Text oder Überschrift 1–5 (wirkt auf alle Blöcke der Auswahl). */
  const applyBlockStyle = (value: string) => {
    const attrs = {
      align: paragraphAttrs.align ?? "start",
      lineHeight: paragraphAttrs.lineHeight ?? null,
      indent: indentValue,
    };
    if (value === "text") {
      runOnSelection((chain) => chain.setNode("paragraph", attrs));
      return;
    }
    const level = clampHeadingLevel(Number(value));
    runOnSelection((chain) => chain.setNode("richHeading", { ...attrs, level }));
  };

  const changeIndent = (delta: number) => {
    if (inList) {
      runOnSelection((chain) => (delta > 0 ? chain.sinkListItem("listItem") : chain.liftListItem("listItem")));
      return;
    }
    applyParagraph({ indent: Math.min(MAX_INDENT, Math.max(0, indentValue + delta)) });
  };

  const applyLink = () => {
    const href = normalizeHref(linkValue);
    if (!href) {
      setLinkError("Nur https://… oder mailto:… ist erlaubt.");
      return;
    }
    runOnSelection((chain) => chain.extendMarkRange("link").setLink({ href }));
    setLinkOpen(false);
    setLinkValue("");
    setLinkError(null);
  };

  return (
    <div className="rte-toolbar" role="toolbar" aria-label="Text formatieren">
      <div className="fb-group">
        <select
          className="fb-select fb-select-block"
          title="Absatzstil – Überschrift 1 bis 5"
          aria-label="Absatzstil"
          value={headingLevel === null ? "text" : String(headingLevel)}
          onChange={(event) => applyBlockStyle(event.target.value)}
        >
          <option value="text">Text</option>
          {HEADING_LEVELS.map((level) => (
            <option key={level} value={level}>
              Überschrift {level}
            </option>
          ))}
        </select>
        <select
          className="fb-select fb-select-font"
          title="Schriftfamilie"
          aria-label="Schriftfamilie"
          value={richAttrs.fontFamily ?? ""}
          onChange={(event) => applyRichStyle({ fontFamily: event.target.value === "" ? null : event.target.value })}
        >
          <option value="">Schrift</option>
          {FONT_FAMILIES.map((family) => (
            <option key={family} value={family}>
              {FONT_FAMILY_LABELS[family]}
            </option>
          ))}
        </select>
        <SizeField
          value={typeof richAttrs.fontSize === "number" ? richAttrs.fontSize : null}
          onChange={(size) => applyRichStyle({ fontSize: size })}
        />
      </div>

      <div className="fb-group">
        <ToolButton
          title="Fett (Strg+B)"
          className="fb-bold"
          active={editor.isActive("bold")}
          onClick={() => runOnSelection((chain) => chain.toggleBold())}
        >
          B
        </ToolButton>
        <ToolButton
          title="Kursiv (Strg+I)"
          className="fb-italic"
          active={editor.isActive("italic")}
          onClick={() => runOnSelection((chain) => chain.toggleItalic())}
        >
          I
        </ToolButton>
        <ToolButton
          title="Unterstrichen (Strg+U)"
          className="fb-underline"
          active={editor.isActive("underline")}
          onClick={() => runOnSelection((chain) => chain.toggleUnderline())}
        >
          U
        </ToolButton>
      </div>

      <div className="fb-group">
        <ColorMenu
          label="Zeichenfarbe"
          value={richAttrs.color ?? null}
          palette={palette}
          onPick={(hex) => applyRichStyle({ color: hex })}
        >
          <span className="fb-trigger">
            <IconTextColor />
            <span className="fb-bar" style={{ background: textColor }} />
          </span>
        </ColorMenu>
        <ColorMenu
          label="Text-Markierung"
          value={richAttrs.background ?? null}
          palette={palette}
          onPick={(hex) => applyRichStyle({ background: hex })}
        >
          <span className="fb-trigger">
            <IconHighlighter />
            <span className="fb-bar" style={{ background: highlightColor }} />
          </span>
        </ColorMenu>
        <ColorMenu
          label="Box-Hintergrund"
          value={boxColor}
          palette={palette}
          onPick={(hex) => onStyleChange({ background: { type: "solid", color: hex } })}
        >
          <span className="fb-trigger">
            <IconBucket />
            <span className="fb-bar" style={{ background: boxColor }} />
          </span>
        </ColorMenu>
      </div>


      <div className="fb-group">
        <ToolButton
          title="Linksbündig"
          active={!editor.isActive({ textAlign: "center" }) && !editor.isActive({ textAlign: "end" })}
          onClick={() => applyParagraph({ align: "start" })}
        >
          <IconAlignLeft />
        </ToolButton>
        <ToolButton
          title="Zentriert"
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => applyParagraph({ align: "center" })}
        >
          <IconAlignCenter />
        </ToolButton>
        <ToolButton
          title="Rechtsbündig"
          active={editor.isActive({ textAlign: "end" })}
          onClick={() => applyParagraph({ align: "end" })}
        >
          <IconAlignRight />
        </ToolButton>
      </div>

      <div className="fb-group">
        <select
          className="fb-select fb-select-spacing"
          title="Zeilenabstand"
          aria-label="Zeilenabstand"
          value={paragraphAttrs.lineHeight ?? ""}
          onChange={(event) =>
            applyParagraph({ lineHeight: event.target.value === "" ? null : Number(event.target.value) })
          }
        >
          <option value="">Abstand</option>
          {LINE_HEIGHT_SCALE.map((value) => (
            <option key={value} value={value}>
              {LINE_HEIGHT_LABELS[String(value)]}
            </option>
          ))}
        </select>
      </div>

      <div className="fb-group">
        <ToolButton
          title="Aufzählung (Strg+Shift+8)"
          active={editor.isActive("bulletList")}
          onClick={() => runOnSelection((chain) => chain.toggleBulletList())}
        >
          <IconBulletList />
        </ToolButton>
        <ToolButton
          title="Nummerierte Liste (Strg+Shift+7)"
          active={editor.isActive("orderedList")}
          onClick={() => runOnSelection((chain) => chain.toggleOrderedList())}
        >
          <IconOrderedList />
        </ToolButton>
        <ToolButton title="Einrücken" onClick={() => changeIndent(1)}>
          <IconIndentIncrease />
        </ToolButton>
        <ToolButton title="Ausrücken" onClick={() => changeIndent(-1)}>
          <IconIndentDecrease />
        </ToolButton>
      </div>

      <div className="fb-group">
        <ToolButton
          title="Link setzen oder ändern (Strg+K)"
          active={editor.isActive("link")}
          onClick={() => {
            setLinkOpen((open) => !open);
            const current = editor.getAttributes("link") as { href?: string };
            setLinkValue(current.href ?? "");
            setLinkError(null);
          }}
        >
          <IconLink />
        </ToolButton>
        <ToolButton
          title="Link entfernen"
          onClick={() => runOnSelection((chain) => chain.extendMarkRange("link").unsetLink())}
        >
          <IconUnlink />
        </ToolButton>
        <ToolButton
          title="Zeichen- und Absatzformatierung entfernen"
          onClick={() =>
            runOnSelection((chain) =>
              chain.unsetAllMarks().updateAttributes("paragraph", { align: "start", lineHeight: null, indent: 0 }),
            )
          }
        >
          <IconClear />
        </ToolButton>
        <ToolButton title="Markdown einfügen oder exportieren" onClick={onMarkdown}>
          <span className="fb-md">MD</span>
        </ToolButton>
      </div>


      {linkOpen ? (
        <div className="fb-linkbar">
          <input
            type="url"
            className="fb-link"
            aria-label="Link-Ziel"
            placeholder="https://example.org oder mailto:…"
            value={linkValue}
            onChange={(event) => {
              setLinkValue(event.target.value);
              setLinkError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyLink();
              }
              if (event.key === "Escape") setLinkOpen(false);
            }}
          />
          <ToolButton title="Link übernehmen" onClick={applyLink}>
            ✓
          </ToolButton>
          {linkError ? <span className="fb-error">{linkError}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

