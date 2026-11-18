import type { ThemeColors } from "../domain/types";

/**
 * Farbangebot der Formatierleiste: Theme-Palette, Standard-Palette und eigene Farben.
 * Eigene Farben liegen in der Konfiguration (`document.palette.custom`).
 */
export interface PaletteContext {
  themeColors: ThemeColors;
  custom: string[];
  onAddCustom: (hex: string) => void;
  onRemoveCustom: (hex: string) => void;
}

/** Standard-Palette (Office-nah): Graustufen, kräftige und gedeckte Töne. */
export const STANDARD_COLORS: string[] = [
  "#000000",
  "#262626",
  "#595959",
  "#8c8c8c",
  "#bfbfbf",
  "#ffffff",
  "#b3261e",
  "#e8590c",
  "#f2b705",
  "#ffe066",
  "#c0eb75",
  "#7fd6ab",
  "#2f9e79",
  "#0b7285",
  "#1c7ed6",
  "#4c6ef5",
  "#7048e8",
  "#ae3ec9",
  "#d6336c",
  "#f06595",
  "#8d5524",
  "#a1887f",
  "#1f3a5f",
  "#402218",
];

const THEME_ORDER: Array<[keyof ThemeColors, string]> = [
  ["background", "Hintergrund"],
  ["surface", "Fläche"],
  ["text", "Text"],
  ["mutedText", "Gedämpft"],
  ["heading", "Überschrift"],
  ["accent", "Akzent"],
  ["accentText", "Akzent-Text"],
  ["border", "Rahmen"],
  ["danger", "Warnung"],
  ["success", "Erfolg"],
];

export interface Swatch {
  label: string;
  value: string;
}

/** Theme-Farben als Swatches; nicht gesetzte optionale Farben entfallen. */
export function themeSwatches(colors: ThemeColors): Swatch[] {
  return THEME_ORDER.flatMap(([key, label]) => {
    const value = colors[key];
    return typeof value === "string" && value.length > 0 ? [{ label, value }] : [];
  });
}

/** Löst Palettentoken (`surface`, `text`, …) zu einer Farbe auf; `#rrggbb` bleibt unverändert. */
export function resolveSwatchColor(value: string | undefined, colors: ThemeColors): string | null {
  if (!value) return null;
  if (value.startsWith("#")) return value;
  const token = (colors as unknown as Record<string, string | undefined>)[value];
  return token ?? null;
}

export function addCustomColor(custom: string[], hex: string): string[] {
  const normalised = hex.toLowerCase();
  if (custom.includes(normalised)) return custom;
  return [...custom, normalised];
}

export function removeCustomColor(custom: string[], hex: string): string[] {
  const normalised = hex.toLowerCase();
  return custom.filter((entry) => entry !== normalised);
}

/** Fallback-Palette, wenn kein Dokument-Kontext vorliegt (z. B. isolierte Komponententests). */
export const FALLBACK_THEME_COLORS: ThemeColors = {
  background: "#ffffff",
  surface: "#f4f5f7",
  text: "#1c1c1c",
  mutedText: "#5f6672",
  heading: "#14213d",
  accent: "#2f9e79",
  accentText: "#ffffff",
  border: "#d5d9e0",
};
