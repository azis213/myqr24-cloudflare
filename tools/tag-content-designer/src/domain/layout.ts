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

export function effectiveSpan(element: TemplateElement, columns: number, breakpoint: Breakpoint): number {
  const requested = element.placement?.span?.[breakpoint] ?? 12;
  return Math.max(1, Math.min(requested, columns));
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
): { breakpoint: Breakpoint; columns: number; placed: PlacedElement[] } {
  const { breakpoint, columns } = effectiveColumns(layout, widthPx);
  const placed = elements
    .filter((element) => !element.hidden)
    .map((element) => ({ element, span: effectiveSpan(element, columns, breakpoint), order: effectiveOrder(element, breakpoint) }))
    .sort((left, right) => left.order - right.order || left.element.elementId.localeCompare(right.element.elementId));
  return { breakpoint, columns, placed };
}
