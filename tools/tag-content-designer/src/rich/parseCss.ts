import { FONT_SIZE_SCALE, LINE_HEIGHT_SCALE } from "../domain/types";
import { isFontFamily } from "../domain/richtext";
import type { FontFamily, FontSize, LineHeight, TextAlign } from "../domain/types";

/**
 * Konverter für eingefügtes HTML (Paste). Es werden ausschließlich Werte übernommen,
 * die in unseren geschlossenen Skalen liegen – alles andere wird verworfen.
 */

function rgbToHex(value: string): string | null {
  const match = value.match(/^rgba?\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})/i);
  if (!match) return null;
  const [r, g, b] = match.slice(1, 4).map((entry) => Math.min(255, Number(entry)));
  const hex = `#${[r, g, b].map((part) => part.toString(16).padStart(2, "0")).join("")}`;
  return hex.toLowerCase();
}

export function parseCssColor(value: string | null | undefined): string | null {
  if (!value) return null;
  const color = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    const expanded = `#${color
      .slice(1)
      .split("")
      .map((part: string) => part + part)
      .join("")}`;
    return expanded.toLowerCase();
  }
  return rgbToHex(color);
}

export function parseCssFontSize(value: string | null | undefined): FontSize | null {
  if (!value) return null;
  const match = value.trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*(px|pt|rem|em)?$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = (match[2] ?? "px").toLowerCase();
  const pixels = unit === "pt" ? (amount * 4) / 3 : unit === "rem" || unit === "em" ? amount * 16 : amount;
  let best: FontSize | null = null;
  for (const candidate of FONT_SIZE_SCALE) {
    if (best === null || Math.abs(candidate - pixels) < Math.abs(best - pixels)) best = candidate;
  }
  return best !== null && Math.abs(best - pixels) <= 1.5 ? best : null;
}

export function parseCssFontFamily(value: string | null | undefined): FontFamily | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (/(mono|consolas|menlo|monaco|courier)/.test(lower)) return "mono";
  if (/(sans-serif|system-ui|-apple-system|segoe|roboto|helvetica|arial)/.test(lower)) return "sans";
  if (/(georgia|times|garamond|cambria|serif)/.test(lower)) return "serif";
  if (isFontFamily(lower)) return lower;
  return null;
}

export function parseCssTextAlign(element: HTMLElement): TextAlign | null {
  const raw = (element.style.textAlign || element.getAttribute("align") || "").toLowerCase();
  if (raw === "center") return "center";
  if (raw === "right" || raw === "end") return "end";
  if (raw === "left" || raw === "start") return "start";
  return null;
}

export function parseCssLineHeight(element: HTMLElement): LineHeight | null {
  const raw = (element.style.lineHeight ?? "").trim();
  if (!raw || raw.endsWith("px") || raw.endsWith("%")) return null;
  const amount = Number(raw);
  if (!Number.isFinite(amount)) return null;
  let best: LineHeight | null = null;
  for (const candidate of LINE_HEIGHT_SCALE) {
    if (best === null || Math.abs(candidate - amount) < Math.abs(best - amount)) best = candidate;
  }
  return best !== null && Math.abs(best - amount) <= 0.08 ? best : null;
}
