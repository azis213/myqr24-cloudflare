import type { Breakpoint, DocumentLayout, TemplateElement } from "./types";

export const BREAKPOINTS: Breakpoint[] = ["mobile", "tablet", "desktop"];

export const BREAKPOINT_LABELS: Record<Breakpoint, string> = {
  mobile: "Handy",
  tablet: "Tablet",
  desktop: "Desktop",
};

export const PREVIEW_WIDTHS: Record<Breakpoint, number> = {
  mobile: 360,
  tablet: 768,
  desktop: 1280,
};

/**
 * Simulierbare Vorschau-Breiten. Bewusst **mobil-first** sortiert: Ein TAG wird
 * überwiegend mit dem Handy gescannt, Tablet/Web sind Kontrollblicke.
 */
export const PREVIEW_PRESETS: ReadonlyArray<{ group: "Handy" | "Tablet" | "Web"; widthPx: number }> = [
  { group: "Handy", widthPx: 320 },
  { group: "Handy", widthPx: 360 },
  { group: "Handy", widthPx: 390 },
  { group: "Handy", widthPx: 430 },
  { group: "Tablet", widthPx: 768 },
  { group: "Tablet", widthPx: 1024 },
  { group: "Web", widthPx: 1280 },
  { group: "Web", widthPx: 1440 },
];

/** Unterhalb dieser Spaltenbreite wird es unleserlich (12rem). */
export const COLUMN_MIN_PX = 192;

export const GAP_PX: Record<"sm" | "md" | "lg", number> = { sm: 5.6, md: 9.6, lg: 16 };

/**
 * Spaltenmodus der Vorschau:
 * - `compact` – mehrspaltig, so viele Spalten wie laut Raster passen (echte Ausgabe),
 * - `stacked` – alle Elemente untereinander (Editor-Ansicht, ignoriert Spans).
 */
export type LayoutView = "compact" | "stacked";

export function breakpointForWidth(widthPx: number): Breakpoint {
  if (widthPx < 640) return "mobile";
  if (widthPx < 1024) return "tablet";
  return "desktop";
}

export function remToPx(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const match = /^([0-9]+(?:\.[0-9]+)?)rem$/.exec(value);
  if (!match) return fallback;
  return Number.parseFloat(match[1]) * 16;
}

export interface LayoutResult {
  breakpoint: Breakpoint;
  columns: number;
}

/** C = clamp(1, floor(width / minColumnWidth), preferredColumns), begrenzt durch layout.columns. */
export function effectiveColumns(layout: DocumentLayout, widthPx: number): LayoutResult {
  const breakpoint = breakpointForWidth(widthPx);
  const preferred = layout.responsive.preferredColumns?.[breakpoint] ?? 1;
  const minPx = remToPx(layout.responsive.minColumnWidth?.[breakpoint], 0);
  const available = minPx > 0 ? Math.floor(widthPx / minPx) : preferred;
  const columns = Math.max(1, Math.min(preferred, available, layout.columns || 12));
  return { breakpoint, columns };
}

/**
 * Effektiver Span. `placement.span` ist ein **Anteil am Raster** (`layout.columns`,
 * üblich 12): 8 von 12 sind zwei Drittel – bei 3 sichtbaren Spalten also 2, bei 6
 * sichtbaren Spalten 4. Damit bleibt die gepflegte Vorlage bei jeder Spaltenzahl
 * verhältnismäßig, statt auf „volle Breite" geklemmt zu werden.
 */
export function effectiveSpan(
  element: TemplateElement,
  columns: number,
  breakpoint: Breakpoint,
  gridColumns = 12,
): number {
  const grid = gridColumns > 0 ? gridColumns : 12;
  const requested = element.placement?.span?.[breakpoint] ?? grid;
  const share = Math.round((requested / grid) * columns);
  return Math.max(1, Math.min(columns, share));
}

export function effectiveOrder(element: TemplateElement, breakpoint: Breakpoint): number {
  return element.placement?.order?.[breakpoint] ?? element.displayOrder;
}

export interface PlacedElement {
  element: TemplateElement;
  span: number;
  order: number;
}

/** Sichtbare Elemente in Flussreihenfolge; `hidden` (Theme-Assets) wird nicht gerendert. */
export function layoutElements(
  elements: TemplateElement[],
  layout: DocumentLayout,
  widthPx: number,
  options?: { view?: LayoutView },
): { breakpoint: Breakpoint; columns: number; placed: PlacedElement[] } {
  const computed = effectiveColumns(layout, widthPx);
  // „Untereinander" ist eine reine Ansichtssache: eine Spalte, alle Kacheln volle Breite.
  const columns = options?.view === "stacked" ? 1 : computed.columns;
  const placed = elements
    .filter((element) => !element.hidden)
    .map((element) => ({
      element,
      span: effectiveSpan(element, columns, computed.breakpoint, layout.columns || 12),
      order: effectiveOrder(element, computed.breakpoint),
    }))
    .sort((left, right) => left.order - right.order || left.element.elementId.localeCompare(right.element.elementId));
  return { breakpoint: computed.breakpoint, columns, placed };
}
