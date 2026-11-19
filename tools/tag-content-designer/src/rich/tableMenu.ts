import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { TableBorder } from "../domain/types";

/** Ziel für Hintergrund-Aktionen (Excel-nah, ohne CellSelection). */
export type CellTarget = "cell" | "row" | "column" | "selection" | "table";

export interface CellInfo {
  /** Position des Zellknotens im Dokument. */
  pos: number;
  row: number;
  column: number;
  header: boolean;
  background?: string;
  text: string;
}

/** Alle Zellen einer Tabelle (zeilenweise) mit Position und Attributen. */
export function cellInfos(doc: PMNode, tablePos: number): CellInfo[] {
  const table = doc.nodeAt(tablePos);
  if (!table) return [];
  const infos: CellInfo[] = [];
  // forEach liefert (node, offset, index) – Offset für Positionen, Index für Zeile/Spalte.
  table.forEach((row, rowOffset, rowIndex) => {
    row.forEach((cell, cellOffset, cellIndex) => {
      infos.push({
        pos: tablePos + 1 + rowOffset + 1 + cellOffset,
        row: rowIndex,
        column: cellIndex,
        header: cell.attrs.header === true,
        background: typeof cell.attrs.background === "string" ? cell.attrs.background : undefined,
        text: cell.textContent,
      });
    });
  });
  return infos;
}

export interface CellBounds {
  fromRow: number;
  toRow: number;
  fromColumn: number;
  toColumn: number;
}

/** Zellenbereich der aktuellen Textauswahl (Cursor = eine Zelle). */
export function selectionBounds(state: { selection: { from: number; to: number }; doc: PMNode }, tablePos: number): CellBounds | null {
  const infos = cellInfos(state.doc, tablePos);
  if (infos.length === 0) return null;
  const touched = infos.filter((info) => {
    const end = info.pos + (state.doc.nodeAt(info.pos)?.nodeSize ?? 0);
    return state.selection.from < end && state.selection.to > info.pos;
  });
  if (touched.length === 0) {
    const first = infos[0];
    return { fromRow: first.row, toRow: first.row, fromColumn: first.column, toColumn: first.column };
  }
  return {
    fromRow: Math.min(...touched.map((cell) => cell.row)),
    toRow: Math.max(...touched.map((cell) => cell.row)),
    fromColumn: Math.min(...touched.map((cell) => cell.column)),
    toColumn: Math.max(...touched.map((cell) => cell.column)),
  };
}

/** Zielzellen für eine Aktion bestimmen. */
export function targetCells(infos: CellInfo[], bounds: CellBounds, target: CellTarget): CellInfo[] {
  switch (target) {
    case "table":
      return infos;
    case "row":
      return infos.filter((cell) => cell.row >= bounds.fromRow && cell.row <= bounds.toRow);
    case "column":
      return infos.filter((cell) => cell.column >= bounds.fromColumn && cell.column <= bounds.toColumn);
    case "selection":
      return infos.filter(
        (cell) =>
          cell.row >= bounds.fromRow &&
          cell.row <= bounds.toRow &&
          cell.column >= bounds.fromColumn &&
          cell.column <= bounds.toColumn,
      );
    case "cell":
    default:
      return infos.filter((cell) => cell.row === bounds.fromRow && cell.column === bounds.fromColumn);
  }
}

export interface TableFormat {
  id: "standard" | "header" | "zebra" | "strong" | "plain";
  label: string;
}

export const TABLE_FORMATS: TableFormat[] = [
  { id: "standard", label: "Standard" },
  { id: "header", label: "Kopfzeile" },
  { id: "zebra", label: "Zebra" },
  { id: "strong", label: "Kräftig" },
  { id: "plain", label: "Rahmenlos" },
];

export interface TableFormatColors {
  border: string;
  header: string;
  stripe: string;
}

/** Setzt Rahmen/Hintergründe für alle Zellen einer Tabelle (ein `tr`, ein Undo-Schritt). */
export function applyTableFormat(
  editor: Editor,
  tablePos: number,
  format: TableFormat["id"],
  colors: TableFormatColors,
  fallbackBorder: TableBorder,
): void {
  const table = editor.state.doc.nodeAt(tablePos);
  if (!table) return;
  const infos = cellInfos(editor.state.doc, tablePos);
  const tr = editor.state.tr;

  const borderFor = (): TableBorder | null => {
    if (format === "standard") return { ...fallbackBorder, color: fallbackBorder.color, width: 1 };
    if (format === "strong") return { ...fallbackBorder, color: fallbackBorder.color, width: 2 };
    return null;
  };

  const backgroundFor = (cell: CellInfo): string | undefined => {
    if (format === "plain") return undefined;
    if (format === "standard" || format === "header" || format === "strong") {
      return cell.header ? colors.header : undefined;
    }
    if (format === "zebra") return cell.row % 2 === 1 ? colors.stripe : undefined;
    return cell.background;
  };

  const border = borderFor();
  tr.setNodeMarkup(tablePos, undefined, {
    ...table.attrs,
    borderColor: border?.color ?? null,
    borderStyle: border?.style ?? null,
    borderWidth: border?.width ?? null,
  });

  for (const cell of infos) {
    const node = editor.state.doc.nodeAt(cell.pos);
    if (!node) continue;
    const background = backgroundFor(cell);
    tr.setNodeMarkup(cell.pos, undefined, { ...node.attrs, background: background ?? null });
  }

  editor.view.dispatch(tr);
}
