import type { ChainedCommands, Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import type { ReactNode, RefObject } from "react";
import { useState } from "react";
import { clampIndent, clampHeadingLevel, FONT_FAMILY_LABELS, FONT_STACKS, isHexColor, LINE_HEIGHT_LABELS, normalizeHref } from "../domain/richtext";
import { FONT_FAMILIES, HEADING_LEVELS, LINE_HEIGHT_SCALE, MAX_INDENT, MAX_TABLE_COLUMNS } from "../domain/types";
import type { ElementStyle, TableBorderStyle, TableBorderWidth } from "../domain/types";
import { ColorMenu } from "./ColorMenu";
import {
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
  IconBulletList,
  IconBucket,
  IconClear,
  IconGrid,
  IconHighlighter,
  IconIndentDecrease,
  IconIndentIncrease,
  IconLink,
  IconOrderedList,
  IconTable,
  IconTextColor,
  IconUnlink,
} from "./icons";
import { resolveSwatchColor, STANDARD_COLORS, themeSwatches, type PaletteContext } from "./palette";
import { SizeField } from "./SizeField";
import { TABLE_FORMATS, applyTableFormat, cellInfos, selectionBounds, targetCells, type CellTarget } from "./tableMenu";
import { findCell, cellPositions, deleteColumnAt, insertColumnAt, lastTableFirstCellPos } from "./tableEditing";
import type { FieldPanel } from "./panelTypes";

/** Fallback-Basisgröße, wenn das Layout (z. B. in Tests) keine berechnete Größe liefert. */
const BASE_FONT_SIZE_FALLBACK = 16;

/** Effektive Schriftgröße des Editors (Basis für die Anzeige „Standard"). */
function effectiveBaseFontSize(editor: Editor): number {
  const dom = editor.view?.dom;
  const raw = dom ? window.getComputedStyle(dom).fontSize : "";
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : BASE_FONT_SIZE_FALLBACK;
}


/** Gemeinsamer Panel-Typ: Markdown und JSON schließen sich gegenseitig aus. */
export type { FieldPanel };

export interface RichToolbarProps {
  editor: Editor;
  style?: ElementStyle;
  onStyleChange: (patch: Partial<ElementStyle>) => void;
  palette: PaletteContext;
  /** Letzte nicht-leere Auswahl: hält Formatieren auch dann wirksam, wenn der Fokus die Auswahl verloren hat. */
  selectionRef: RefObject<{ from: number; to: number } | null>;
  /** Aktuell offenes Panel unter dem Feld. */
  panel: FieldPanel;
  /** Öffnet/schließt ein Panel (gleiches Panel = schließen). */
  onTogglePanel: (panel: Exclude<FieldPanel, "none">) => void;
  /** Jede Formatierungs-Interaktion schließt ein offenes Panel. */
  onInteract: () => void;
  /** Kurzer Hinweis (z. B. Tabellen-Limits) in der Statuszeile des Felds. */
  onNotice?: (message: string) => void;
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

export function RichToolbar({
  editor,
  style,
  onStyleChange,
  palette,
  selectionRef,
  panel,
  onTogglePanel,
  onInteract,
  onNotice,
}: RichToolbarProps) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [tableOpen, setTableOpen] = useState(false);
  const [tableTarget, setTableTarget] = useState<CellTarget>("selection");
  const [tableStyle, setTableStyle] = useState<TableBorderStyle>("solid");
  const [tableWidth, setTableWidth] = useState<TableBorderWidth>(1);
  const [tableColor, setTableColor] = useState(() => resolveSwatchColor("border", palette.themeColors) ?? "#d5d9e0");
  const [cellColor, setCellColor] = useState(() => resolveSwatchColor("surface", palette.themeColors) ?? "#f4f5f7");
  const [tableTextColor, setTableTextColor] = useState(() => resolveSwatchColor("text", palette.themeColors) ?? "#1c1c1c");
  const [tableTextHighlight, setTableTextHighlight] = useState("#ffe066");
  const tableContext = findCell(editor.state);

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
   * - Fokus liegt in der Leiste → die zuletzt markierte Spanne wird wiederhergestellt
   * - Cursor ohne Auswahl → nur Vorformatierung der nächsten Eingabe (Word-Verhalten)
   * Der Merker wird beim Klick in den Text gelöscht (siehe RichTextField), nie „reaktiviert".
   */
  const runOnSelection = (apply: (chain: ChainedCommands) => ChainedCommands) => {
    onInteract();
    const chain = editor.chain();
    if (editor.state.selection.empty && selectionRef.current) {
      chain.setTextSelection(selectionRef.current);
    }
    apply(chain.focus()).run();
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

  /** Tabelle mit zwei Spalten einfügen (Kopfzeile + eine Datenzeile), Cursor in die Kopfzelle. */
  const insertTable = () => {
    onInteract();
    const cell = (header: boolean) => ({ type: "richTableCell", attrs: { header } });
    const table = {
      type: "richTable",
      // Neue Tabellen starten mit sichtbarem Gitterrahmen (aktueller Menüzustand).
      attrs: tableBorder(),
      content: [
        { type: "richTableRow", content: [cell(true), cell(true)] },
        { type: "richTableRow", content: [cell(false), cell(false)] },
      ],
    };

    const chain = editor.chain();
    if (editor.state.selection.empty && selectionRef.current) chain.setTextSelection(selectionRef.current);
    chain.focus();

    // Steht der Cursor in einer Tabelle, hinter dieser einfügen (nie in eine Zelle).
    const context = findCell(editor.state);
    if (context) {
      const node = editor.state.doc.nodeAt(context.tablePos);
      chain.insertContentAt(context.tablePos + (node?.nodeSize ?? 0), table).run();
    } else {
      chain.insertContent(table).run();
    }

    const firstCell = lastTableFirstCellPos(editor.state.doc);
    if (firstCell !== null) editor.commands.setTextSelection(firstCell + 1);
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

  /* ---- Tabelle: Gitter und Hintergründe (Option B: globaler Rahmen) ---- */

  const tableBorder = (): { borderColor: string; borderStyle: TableBorderStyle; borderWidth: TableBorderWidth } => ({
    borderColor: tableColor,
    borderStyle: tableStyle,
    borderWidth: tableWidth,
  });

  const updateTableAttributes = (attrs: Record<string, unknown>) => {
    const context = findCell(editor.state);
    if (!context) return;
    const node = editor.state.doc.nodeAt(context.tablePos);
    if (!node) return;
    const tr = editor.state.tr.setNodeMarkup(context.tablePos, undefined, { ...node.attrs, ...attrs });
    editor.view.dispatch(tr);
  };

  const applyTableBorder = () => {
    onInteract();
    updateTableAttributes(tableBorder());
  };

  const clearTableBorder = () => {
    onInteract();
    updateTableAttributes({ borderColor: null, borderStyle: null, borderWidth: null });
  };

  /** Hintergrund für die Zielzellen setzen oder entfernen. */
  const applyCellBackground = (color: string | null) => {
    onInteract();
    const context = findCell(editor.state);
    if (!context) return;
    const infos = cellInfos(editor.state.doc, context.tablePos);
    const bounds = selectionBounds(editor.state, context.tablePos);
    if (!bounds) return;
    const cells = targetCells(infos, bounds, tableTarget);
    const tr = editor.state.tr;
    for (const cell of cells) {
      const node = editor.state.doc.nodeAt(cell.pos);
      if (!node) continue;
      tr.setNodeMarkup(cell.pos, undefined, { ...node.attrs, background: color });
    }
    editor.view.dispatch(tr);
  };

  /** Voller Textbereich der aktuellen Zelle (für Farb-/Markierungswechsel ohne Auswahl). */
  const cellContentRange = (): { from: number; to: number } | null => {
    const context = findCell(editor.state);
    if (!context) return null;
    const node = editor.state.doc.nodeAt(context.cellPos);
    if (!node) return null;
    return { from: context.cellPos + 1, to: context.cellPos + node.nodeSize - 1 };
  };

  /**
   * Textfarbe/Text-Hintergrund in einer Zelle: wirkt auf die Textauswahl, ohne Auswahl auf
   * den ganzen Zellinhalt. Zellhintergrund bleibt davon unberührt (`cell.background`).
   */
  const applyCellTextStyle = (patch: Record<string, unknown>) => {
    onInteract();
    const { from, to } = editor.state.selection;
    const range = from === to ? cellContentRange() : { from, to };
    if (!range) return;
    const next: Record<string, unknown> = { ...activeRichAttributes(editor), ...patch };
    const hasAny = ["color", "background", "fontSize", "fontFamily"].some(
      (key) => next[key] !== null && next[key] !== undefined,
    );
    const chain = editor.chain().setTextSelection(range).focus();
    (hasAny ? chain.setMark("richStyle", next) : chain.unsetMark("richStyle")).run();
  };

  /** Spalte links der Cursor-Spalte einfügen (alle Zeilen wachsen mit). */
  const insertColumnLeft = () => {
    onInteract();
    const context = findCell(editor.state);
    if (!context) return;
    if (context.columns >= MAX_TABLE_COLUMNS) {
      onNotice?.(`Maximal ${MAX_TABLE_COLUMNS} Spalten je Tabelle.`);
      return;
    }
    const tr = editor.state.tr;
    if (!insertColumnAt(tr, context.tablePos, context.cellIndex, "before")) return;
    const cells = cellPositions(tr.doc, context.tablePos);
    const target = cells[context.rowIndex * (context.columns + 1) + context.cellIndex];
    if (target !== undefined) tr.setSelection(TextSelection.create(tr.doc, target + 1));
    editor.view.dispatch(tr.scrollIntoView());
  };

  /** Cursor-Spalte entfernen; die letzte Spalte bleibt immer stehen. */
  const removeColumn = () => {
    onInteract();
    const context = findCell(editor.state);
    if (!context) return;
    if (context.columns <= 1) {
      onNotice?.("Mindestens eine Spalte bleibt.");
      return;
    }
    const tr = editor.state.tr;
    if (!deleteColumnAt(tr, context.tablePos, context.cellIndex)) return;
    const nextColumns = context.columns - 1;
    const cells = cellPositions(tr.doc, context.tablePos);
    const column = Math.min(context.cellIndex, nextColumns - 1);
    const target = cells[context.rowIndex * nextColumns + column];
    if (target !== undefined) tr.setSelection(TextSelection.create(tr.doc, target + 1));
    editor.view.dispatch(tr.scrollIntoView());
  };

  const runTableFormat = (format: (typeof TABLE_FORMATS)[number]["id"]) => {
    onInteract();
    const context = findCell(editor.state);
    if (!context) return;
    applyTableFormat(
      editor,
      context.tablePos,
      format,
      {
        border: tableColor,
        header: resolveSwatchColor("surface", palette.themeColors) ?? "#f4f5f7",
        stripe: resolveSwatchColor("background", palette.themeColors) ?? "#ffffff",
      },
      { color: tableColor, style: tableStyle, width: tableWidth },
    );
  };

  const swatches = [...themeSwatches(palette.themeColors), ...STANDARD_COLORS.map((value) => ({ label: value, value }))];

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
          title={
            richAttrs.fontFamily
              ? `Schriftfamilie: ${FONT_STACKS[richAttrs.fontFamily as keyof typeof FONT_STACKS] ?? ""}`
              : "Schriftfamilie (Standard aus dem Element)"
          }
          aria-label="Schriftfamilie"
          value={richAttrs.fontFamily ?? ""}
          onChange={(event) => applyRichStyle({ fontFamily: event.target.value === "" ? null : event.target.value })}
        >
          <option value="">Standard</option>
          {FONT_FAMILIES.map((family) => (
            <option key={family} value={family}>
              {FONT_FAMILY_LABELS[family]}
            </option>
          ))}
        </select>
        <SizeField
          value={typeof richAttrs.fontSize === "number" ? richAttrs.fontSize : null}
          inheritedSize={effectiveBaseFontSize(editor)}
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
          onPick={(hex) => {
            onInteract();
            onStyleChange({ background: { type: "solid", color: hex } });
          }}
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
        <ToolButton title="Tabelle mit 2 Spalten einfügen (Tab erweitert)" onClick={insertTable}>
          <IconTable />
        </ToolButton>
        <ToolButton
          title="Tabellen-Gitter und Hintergrund"
          active={tableOpen}
          onClick={() => {
            onInteract();
            setTableOpen((open) => !open);
          }}
        >
          <IconGrid />
        </ToolButton>
        <ToolButton
          title="Link setzen oder ändern (Strg+K)"
          active={editor.isActive("link")}
          onClick={() => {
            onInteract();
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
        <ToolButton
          title="Markdown einfügen oder exportieren (Panel)"
          active={panel === "markdown"}
          onClick={() => onTogglePanel("markdown")}
        >
          <span className="fb-md">MD</span>
        </ToolButton>
        <ToolButton
          title="JSON des Textes anzeigen (Panel)"
          active={panel === "json"}
          onClick={() => onTogglePanel("json")}
        >
          <span className="fb-md">JSON</span>
        </ToolButton>
      </div>

      {tableOpen && tableContext ? (
        <div className="fb-tablebar" role="group" aria-label="Tabelle formatieren">
          <div className="fb-tablebar-row">
            <label>
              <span>Ziel</span>
              <select
                className="fb-field-goal"
                aria-label="Ziel der Tabellenaktion"
                title="„Spalte“ wirkt auf die aktuelle Spalte – ganz ohne mehrzeilige Auswahl."
                value={tableTarget}
                onChange={(event) => setTableTarget(event.target.value as CellTarget)}
              >
                <option value="selection">Auswahl</option>
                <option value="cell">Zelle</option>
                <option value="row">Zeile</option>
                <option value="column">Spalte</option>
                <option value="table">ganze Tabelle</option>
              </select>
            </label>
            <label>
              <span>Rahmen</span>
              <select
                className="fb-field-style"
                aria-label="Rahmenstil"
                value={tableStyle}
                onChange={(event) => setTableStyle(event.target.value as TableBorderStyle)}
              >
                <option value="solid">durchgezogen</option>
                <option value="dashed">gestrichelt</option>
                <option value="dotted">gepunktet</option>
                <option value="double">doppelt</option>
              </select>
            </label>
            <label>
              <span>Stärke</span>
              <select
                className="fb-field-width"
                aria-label="Rahmenstärke"
                value={tableWidth}
                onChange={(event) => setTableWidth(Number(event.target.value) === 2 ? 2 : 1)}
              >
                <option value={1}>1 px</option>
                <option value={2}>2 px</option>
              </select>
            </label>
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={applyTableBorder}>
              Rahmen anwenden
            </button>
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={clearTableBorder}>
              Rahmen aus
            </button>
          </div>

          <div className="fb-tablebar-row fb-tablebar-row--swatches">
            <span className="fb-tablebar-label">Rahmenfarbe</span>
            <span className="fb-swatches">
              {swatches.map((swatch) => (
                <button
                  key={`border-${swatch.label}-${swatch.value}`}
                  type="button"
                  className={`fb-swatch-btn${tableColor.toLowerCase() === swatch.value.toLowerCase() ? " is-active" : ""}`}
                  title={`${swatch.label} (${swatch.value})`}
                  aria-label={`Rahmenfarbe ${swatch.value}`}
                  style={{ background: swatch.value }}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setTableColor(swatch.value)}
                />
              ))}
            </span>
            <input
              type="color"
              aria-label="Rahmenfarbe frei"
              value={tableColor}
              onChange={(event) => setTableColor(event.target.value)}
            />
          </div>

          <div className="fb-tablebar-row fb-tablebar-row--swatches">
            <span className="fb-tablebar-label">Zellhintergrund</span>
            <span className="fb-swatches">
              {swatches.map((swatch) => (
                <button
                  key={`cell-${swatch.label}-${swatch.value}`}
                  type="button"
                  className={`fb-swatch-btn${cellColor.toLowerCase() === swatch.value.toLowerCase() ? " is-active" : ""}`}
                  title={`${swatch.label} (${swatch.value})`}
                  aria-label={`Zellhintergrund ${swatch.value}`}
                  style={{ background: swatch.value }}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setCellColor(swatch.value);
                    applyCellBackground(swatch.value);
                  }}
                />
              ))}
            </span>
            <input
              type="color"
              aria-label="Zellhintergrund frei"
              value={cellColor}
              onChange={(event) => {
                setCellColor(event.target.value);
                applyCellBackground(event.target.value);
              }}
            />
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyCellBackground(null)}
            >
              Hintergrund entfernen
            </button>
          </div>

          <div className="fb-tablebar-row fb-tablebar-row--swatches">
            <span className="fb-tablebar-label">Textfarbe</span>
            <span className="fb-swatches">
              {swatches.map((swatch) => (
                <button
                  key={`text-${swatch.label}-${swatch.value}`}
                  type="button"
                  className={`fb-swatch-btn${tableTextColor.toLowerCase() === swatch.value.toLowerCase() ? " is-active" : ""}`}
                  title={`${swatch.label} (${swatch.value})`}
                  aria-label={`Textfarbe ${swatch.value}`}
                  style={{ background: swatch.value }}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setTableTextColor(swatch.value);
                    applyCellTextStyle({ color: swatch.value });
                  }}
                />
              ))}
            </span>
            <input
              type="color"
              aria-label="Textfarbe frei"
              value={tableTextColor}
              onChange={(event) => {
                setTableTextColor(event.target.value);
                applyCellTextStyle({ color: event.target.value });
              }}
            />
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyCellTextStyle({ color: null })}
            >
              Textfarbe entfernen
            </button>
          </div>

          <div className="fb-tablebar-row fb-tablebar-row--swatches">
            <span className="fb-tablebar-label">Text-Hintergrund</span>
            <span className="fb-swatches">
              {swatches.map((swatch) => (
                <button
                  key={`mark-${swatch.label}-${swatch.value}`}
                  type="button"
                  className={`fb-swatch-btn${tableTextHighlight.toLowerCase() === swatch.value.toLowerCase() ? " is-active" : ""}`}
                  title={`${swatch.label} (${swatch.value})`}
                  aria-label={`Text-Hintergrund ${swatch.value}`}
                  style={{ background: swatch.value }}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setTableTextHighlight(swatch.value);
                    applyCellTextStyle({ background: swatch.value });
                  }}
                />
              ))}
            </span>
            <input
              type="color"
              aria-label="Text-Hintergrund frei"
              value={tableTextHighlight}
              onChange={(event) => {
                setTableTextHighlight(event.target.value);
                applyCellTextStyle({ background: event.target.value });
              }}
            />
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyCellTextStyle({ background: null })}
            >
              Markierung entfernen
            </button>
          </div>

          <div className="fb-tablebar-row">
            <span className="fb-tablebar-label">Spalte</span>
            <button
              type="button"
              title="Fügt links der Cursor-Spalte eine neue Spalte ein"
              onMouseDown={(event) => event.preventDefault()}
              onClick={insertColumnLeft}
            >
              Spalte links einfügen
            </button>
            <button
              type="button"
              title="Entfernt die Cursor-Spalte (die letzte Spalte bleibt stehen)"
              onMouseDown={(event) => event.preventDefault()}
              onClick={removeColumn}
            >
              Spalte entfernen
            </button>
          </div>

          <div className="fb-tablebar-row">
            <span className="fb-tablebar-label">Format</span>
            {TABLE_FORMATS.map((format) => (
              <button
                key={format.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runTableFormat(format.id)}
              >
                {format.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

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



