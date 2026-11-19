import { isTableBlock, plainText } from "./richtext";
import type { TagContentDocument } from "./types";
import { COLUMN_MIN_PX, effectiveColumns, GAP_PX } from "./layout";

/** Unverbindlicher Layout-Hinweis; ersetzt keine Validierung und blockiert nichts. */
export interface LayoutHint {
  id: string;
  severity: "info" | "warning";
  message: string;
  /** Optionaler Bezug, damit die Oberfläche das Element auswählen kann. */
  elementId?: string;
}

const MAX_HINTS = 4;

/**
 * Warnt vor Layouts, die auf dem **Handy** (dem eigentlichen Scan-Gerät) unleserlich
 * werden. Geprüft wird die tatsächlich angezeigte Breite, nicht der Breakpoint-Name.
 */
export function layoutHints(doc: TagContentDocument, widthPx: number): LayoutHint[] {
  const { breakpoint, columns } = effectiveColumns(doc.layout, widthPx);
  const hints: LayoutHint[] = [];
  const gap = GAP_PX[doc.layout.gap] ?? GAP_PX.md;

  const available = widthPx - gap * (columns - 1);
  const columnWidth = available / columns;
  if (columns > 1 && columnWidth < COLUMN_MIN_PX) {
    hints.push({
      id: "COLUMN_TOO_NARROW",
      severity: "warning",
      message: `${columns} Spalten sind hier nur ${Math.round(columnWidth)} px breit (empfohlen ab ${COLUMN_MIN_PX} px).`,
    });
  }

  if (breakpoint === "mobile") {
    const bodySize = doc.shell.theme.typography?.bodySize;
    if (typeof bodySize === "number" && bodySize > 0 && bodySize < 14) {
      hints.push({
        id: "TEXT_TOO_SMALL",
        severity: "warning",
        message: `Basisschrift ${bodySize} px ist auf dem Handy zu klein (empfohlen ab 14 px).`,
      });
    }

    for (const element of doc.elements) {
      if (element.hidden) continue;
      const blocks = element.content?.paragraphs ?? [];
      const table = blocks.find((block) => isTableBlock(block));
      if (table && isTableBlock(table) && table.columns.length > 3) {
        hints.push({
          id: "TABLE_TOO_WIDE",
          severity: "warning",
          message: `Tabelle mit ${table.columns.length} Spalten wird auf ${widthPx} px unleserlich (max. 3 empfohlen).`,
          elementId: element.elementId,
        });
      }
      const text = plainText(element.content);
      if (text.length > 600) {
        hints.push({
          id: "LONG_TEXT",
          severity: "info",
          message: `${text.length} Zeichen in einer Handy-Kachel – Kurzfassung mit „mehr" erwägen.`,
          elementId: element.elementId,
        });
      }
    }
  }

  return hints.slice(0, MAX_HINTS);
}
