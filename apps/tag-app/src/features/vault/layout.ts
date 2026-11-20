import type { BlockPlacement, VaultLayout } from "./types";

export type VaultBreakpoint = "mobile" | "tablet" | "desktop";

export function breakpointForWidth(width: number): VaultBreakpoint {
  return width < 640 ? "mobile" : width < 1024 ? "tablet" : "desktop";
}

function rem(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const amount = Number.parseFloat(value);
  return Number.isFinite(amount) ? amount * 16 : fallback;
}

export function effectiveColumns(layout: VaultLayout | undefined, width: number): number {
  if (!layout) return 1;
  const breakpoint = breakpointForWidth(width);
  const maximum = Math.max(1, Math.min(12, layout.columns ?? 12));
  const preferred = Math.max(1, Math.min(maximum, layout.responsive?.preferredColumns?.[breakpoint] ?? maximum));
  const minWidth = rem(layout.responsive?.minColumnWidth?.[breakpoint], 18);
  const autoReflow = layout.responsive && "autoReflow" in layout.responsive ? layout.responsive.autoReflow !== false : true;
  const fit = autoReflow ? Math.max(1, Math.floor(width / minWidth)) : preferred;
  return Math.max(1, Math.min(preferred, fit, maximum));
}

export function effectiveSpan(
  placement: BlockPlacement | undefined,
  columns: number,
  breakpoint: VaultBreakpoint,
  grid = 12,
): number {
  const span = placement?.span?.[breakpoint];
  if (!Number.isFinite(span) || !span || span <= 0) return columns;
  return Math.max(1, Math.min(columns, Math.round((span / grid) * columns)));
}

export function layoutGap(gap: VaultLayout["gap"]): number {
  return gap === "sm" ? 8 : gap === "lg" ? 24 : 16;
}

export function containerMaxWidth(layout: VaultLayout | undefined): string {
  const width = layout?.container?.maxWidth;
  return width === "narrow" ? "48rem" : width === "wide" ? "80rem" : "100%";
}

export function placementOrder(placement: BlockPlacement | undefined, breakpoint: VaultBreakpoint): number | undefined {
  return placement?.order?.[breakpoint];
}