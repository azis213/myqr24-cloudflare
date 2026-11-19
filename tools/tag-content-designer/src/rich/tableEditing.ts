import { Extension } from "@tiptap/core";
import { TextSelection, type Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import type { EditorState } from "@tiptap/pm/state";
import type { Node as PMNode, Schema } from "@tiptap/pm/model";
import { MAX_TABLE_COLUMNS, MAX_TABLE_ROWS } from "../domain/types";

export interface TableLimitOptions {
  /** Wird gerufen, wenn Spalten- und Zeilenlimit erreicht sind (kurzer Hinweis in der UI). */
  onLimit?: (message: string) => void;
}

export interface CellContext {
  tablePos: number;
  /** Position der Zelle im Dokument (Anfang des Zellknotens). */
  cellPos: number;
  rowIndex: number;
  cellIndex: number;
  rows: number;
  columns: number;
}

/** Liefert die Zelle am Cursor (oder `null`, wenn der Cursor außerhalb einer Tabelle steht). */
export function findCell(state: EditorState): CellContext | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth >= 2; depth -= 1) {
    if ($from.node(depth).type.name !== "richTableCell") continue;
    const row = $from.node(depth - 1);
    const table = $from.node(depth - 2);
    return {
      tablePos: $from.before(depth - 2),
      cellPos: $from.before(depth),
      rowIndex: $from.index(depth - 2),
      cellIndex: $from.index(depth - 1),
      rows: table.childCount,
      columns: row.childCount,
    };
  }
  return null;
}

/** Alle Zellpositionen einer Tabelle in Dokumentreihenfolge (zeilenweise). */
export function cellPositions(doc: PMNode, tablePos: number): number[] {
  const table = doc.nodeAt(tablePos);
  if (!table) return [];
  const positions: number[] = [];
  table.forEach((row, rowOffset) => {
    const rowPos = tablePos + 1 + rowOffset;
    row.forEach((_cell, cellOffset) => {
      positions.push(rowPos + 1 + cellOffset);
    });
  });
  return positions;
}

/**
 * Erste Zelle der **letzten** Tabelle im Dokument – dorthin springt der Cursor nach dem
 * Einfügen (Tiptap setzt die Auswahl hinter den eingefügten Block).
 */
export function lastTableFirstCellPos(doc: PMNode): number | null {
  let found: number | null = null;
  doc.descendants((node, pos) => {
    if (node.type.name !== "richTable") return true;
    const cells = cellPositions(doc, pos);
    if (cells.length > 0) found = cells[0];
    return false;
  });
  return found;
}

function emptyCell(schema: Schema, header: boolean): PMNode {
  return schema.nodes.richTableCell.createAndFill({ header }) ?? schema.nodes.richTableCell.create({ header });
}

/**
 * Hängt rechts eine Spalte an (alle Zeilen wachsen mit). Kopfzeilen bleiben Kopfzeilen.
 * Die Zielzelle wird anschließend aus dem neuen Dokument bestimmt (`cellPositions`).
 */
export function appendColumn(tr: Transaction, context: CellContext): void {
  const schema = tr.doc.type.schema;
  const table = tr.doc.nodeAt(context.tablePos);
  if (!table) return;

  const inserts: Array<{ pos: number; header: boolean }> = [];
  table.forEach((row, rowOffset) => {
    const rowPos = context.tablePos + 1 + rowOffset;
    inserts.push({ pos: rowPos + row.nodeSize - 1, header: row.firstChild?.attrs.header === true });
  });

  // Von hinten nach vorn einfügen, damit die Positionen davor gültig bleiben.
  inserts.sort((a, b) => b.pos - a.pos);
  for (const insert of inserts) tr.insert(insert.pos, emptyCell(schema, insert.header));
}

/**
 * Absolute Position der Zelle `columnIndex` in einer Zeile (Anfang des Zellknotens).
 * `rowPos` ist die Position **vor** der Zeile.
 */
function cellPosInRow(row: PMNode, rowPos: number, columnIndex: number): number {
  let pos = rowPos + 1;
  for (let index = 0; index < columnIndex; index += 1) pos += row.child(index).nodeSize;
  return pos;
}

/**
 * Fügt links/rechts der Spalte `columnIndex` in **jeder** Zeile eine leere Zelle ein.
 * Kopfzeilen bleiben Kopfzeilen; die Positionen werden von hinten nach vorn gesetzt.
 */
export function insertColumnAt(
  tr: Transaction,
  tablePos: number,
  columnIndex: number,
  side: "before" | "after" = "before",
): boolean {
  const schema = tr.doc.type.schema;
  const table = tr.doc.nodeAt(tablePos);
  if (!table) return false;

  const inserts: Array<{ pos: number; header: boolean }> = [];
  table.forEach((row, rowOffset) => {
    if (columnIndex < 0 || columnIndex >= row.childCount) return;
    const cell = row.child(columnIndex);
    const start = cellPosInRow(row, tablePos + 1 + rowOffset, columnIndex);
    inserts.push({ pos: side === "before" ? start : start + cell.nodeSize, header: cell.attrs.header === true });
  });
  if (inserts.length === 0) return false;

  inserts.sort((a, b) => b.pos - a.pos);
  for (const insert of inserts) tr.insert(insert.pos, emptyCell(schema, insert.header));
  return true;
}

/** Entfernt die Spalte `columnIndex` in allen Zeilen (Positionen von hinten nach vorn). */
export function deleteColumnAt(tr: Transaction, tablePos: number, columnIndex: number): boolean {
  const table = tr.doc.nodeAt(tablePos);
  if (!table || table.childCount === 0) return false;
  if (columnIndex < 0 || columnIndex >= table.child(0).childCount) return false;

  const removals: Array<{ from: number; to: number }> = [];
  table.forEach((row, rowOffset) => {
    if (columnIndex >= row.childCount) return;
    const start = cellPosInRow(row, tablePos + 1 + rowOffset, columnIndex);
    removals.push({ from: start, to: start + row.child(columnIndex).nodeSize });
  });
  if (removals.length === 0) return false;

  removals.sort((a, b) => b.from - a.from);
  for (const removal of removals) tr.delete(removal.from, removal.to);
  return true;
}

/** Hängt eine Zeile an und liefert die Cursor-Position in deren erster Zelle. */
export function appendRow(tr: Transaction, context: CellContext): void {
  const schema = tr.doc.type.schema;
  const table = tr.doc.nodeAt(context.tablePos);
  if (!table) return;

  const cells = Array.from({ length: context.columns }, () => emptyCell(schema, false));
  const row = schema.nodes.richTableRow.create(null, cells);
  tr.insert(context.tablePos + table.nodeSize - 1, row);
}

/**
 * Enter in Tabellen: am Tabellenende entsteht eine neue Zeile, sonst ein weicher Umbruch
 * in der Zelle (Zellen kennen keine Absätze). Wird über `editorProps.handleKeyDown`
 * aufgerufen, damit es **vor** der Basis-Keymap greift.
 */
export function handleTableEnter(
  view: EditorView,
  event: KeyboardEvent,
  onLimit?: (message: string) => void,
): boolean {
  if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return false;
  const { state } = view;
  const context = findCell(state);
  if (!context || !state.selection.empty) return false;

  const { $from } = state.selection;
  const isLastCell = context.rowIndex === context.rows - 1 && context.cellIndex === context.columns - 1;
  const atEnd = $from.parentOffset >= $from.parent.content.size;

  if (isLastCell && atEnd) {
    if (context.rows >= MAX_TABLE_ROWS) {
      onLimit?.(`Maximal ${MAX_TABLE_ROWS} Zeilen je Tabelle.`);
      return true;
    }
    const tr = state.tr;
    appendRow(tr, context);
    const next = cellPositions(tr.doc, context.tablePos);
    const newCell = next[next.length - context.columns];
    if (newCell !== undefined) tr.setSelection(TextSelection.create(tr.doc, newCell + 1));
    view.dispatch(tr.scrollIntoView());
    return true;
  }

  const hardBreak = state.schema.nodes.hardBreak;
  if (!hardBreak) return false;
  view.dispatch(state.tr.replaceSelectionWith(hardBreak.create()).scrollIntoView());
  return true;
}

/**
 * Tabellen-Navigation wie in Word: Tab springt zur nächsten Zelle, am Tabellenende
 * entsteht eine neue Spalte (bis 6), danach eine neue Zeile (bis 20). Shift+Tab geht zurück.
 */
export const TableEditing = Extension.create<TableLimitOptions>({
  name: "tableEditing",

  addOptions() {
    return { onLimit: undefined };
  },

  addKeyboardShortcuts() {
    const notifyLimit = () => {
      this.options.onLimit?.(`Maximal ${MAX_TABLE_COLUMNS} Spalten und ${MAX_TABLE_ROWS} Zeilen je Tabelle.`);
    };

    const move = (direction: 1 | -1) => () => {
      const { state } = this.editor;
      const context = findCell(state);
      if (!context) return false;

      const cells = cellPositions(state.doc, context.tablePos);
      // Index deterministisch aus Zeile/Spalte (unabhängig von Positionsvergleichen).
      const index = context.rowIndex * context.columns + context.cellIndex;
      const target = cells[index + direction];
      if (target !== undefined) {
        this.editor.commands.setTextSelection(target + 1);
        return true;
      }
      if (direction === -1) return true; // Anfang der Tabelle: nichts tun, Fokus bleibt.

      if (context.columns < MAX_TABLE_COLUMNS) {
        const tr = state.tr;
        appendColumn(tr, context);
        const next = cellPositions(state.apply(tr).doc, context.tablePos);
        const perRow = context.columns + 1;
        const newCell = next[context.rowIndex * perRow + perRow - 1];
        this.editor.view.dispatch(tr);
        if (newCell !== undefined) this.editor.commands.setTextSelection(newCell + 1);
        return true;
      }
      if (context.rows < MAX_TABLE_ROWS) {
        const tr = state.tr;
        appendRow(tr, context);
        const next = cellPositions(state.apply(tr).doc, context.tablePos);
        const newCell = next[next.length - context.columns];
        this.editor.view.dispatch(tr);
        if (newCell !== undefined) this.editor.commands.setTextSelection(newCell + 1);
        return true;
      }
      notifyLimit();
      return true;
    };

    return {
      Tab: move(1),
      "Shift-Tab": move(-1),
    };
  },
});





