import type { CSSProperties } from "react";
import { ELEMENT_CATALOG } from "../domain/catalog";
import { BREAKPOINT_LABELS, layoutElements, type LayoutView } from "../domain/layout";
import type { TagContentDocument, ThemeColors } from "../domain/types";
import { ElementView, type ElementEditing } from "./ElementView";

export function resolveColor(value: string | undefined, colors: ThemeColors, fallback: string): string {
  if (!value) return fallback;
  if (value.startsWith("#")) return value;
  const token = (colors as unknown as Record<string, string | undefined>)[value];
  return token ?? fallback;
}

const PADDING: Record<string, string> = { none: "0", sm: "0.5rem", md: "1rem", lg: "1.5rem" };

export function TagContentPreview({
  doc,
  widthPx,
  fit,
  view = "compact",
  selectedId,
  onSelect,
  editing,
}: {
  doc: TagContentDocument;
  widthPx: number;
  /** Breite folgt dem verfügbaren Platz statt einer festen Simulation. */
  fit?: boolean;
  /** `compact` = mehrspaltig (echte Ausgabe), `stacked` = alle Elemente untereinander. */
  view?: LayoutView;
  selectedId: string | null;
  onSelect: (elementId: string) => void;
  editing?: ElementEditing;
}) {
  const { breakpoint, columns, placed } = layoutElements(doc.elements, doc.layout, widthPx, { view });
  const colors = doc.shell.theme.colors;
  const typography = doc.shell.theme.typography ?? {};

  const rootStyle: CSSProperties = {
    background: resolveColor(colors.background, colors, "#ffffff"),
    color: resolveColor(colors.text, colors, "#1c1c1c"),
    fontSize: `${typography.bodySize ?? 16}px`,
    lineHeight: typography.lineHeight ?? 1.55,
    ["--q-surface" as string]: resolveColor(colors.surface, colors, "#ffffff"),
    ["--q-heading" as string]: resolveColor(colors.heading, colors, "#111111"),
    ["--q-muted" as string]: resolveColor(colors.mutedText, colors, "#555555"),
    ["--q-accent" as string]: resolveColor(colors.accent, colors, "#1f513d"),
    ["--q-accent-text" as string]: resolveColor(colors.accentText, colors, "#ffffff"),
    ["--q-border" as string]: resolveColor(colors.border, colors, "#e2ded6"),
  };

  return (
    <div className="tcp" style={rootStyle} data-breakpoint={breakpoint} data-view={view}>
      <header className="tcp-header">
        <span className="tcp-title">{doc.template.name || "Unbenanntes Template"}</span>
        <span className="tcp-meta">
          {fit ? `Fit (${widthPx} px)` : `${widthPx} px`} · {BREAKPOINT_LABELS[breakpoint]} ·{" "}
          {view === "stacked" ? "Untereinander" : "Compact"} · {columns} {columns === 1 ? "Spalte" : "Spalten"}
          {doc.shell.statusBar?.showTagId ? " · TAG-ID" : ""}
        </span>
      </header>

      {view === "stacked" ? (
        <p className="tcp-view-badge">Alle Elemente untereinander – nicht die echte Ausgabe</p>
      ) : null}

      {doc.shell.presentation !== "standard" ? (
        <div className="tcp-presentation">Präsentation: {doc.shell.presentation}</div>
      ) : null}

      <div
        className={`tcp-grid gap-${doc.layout.gap}`}
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {placed.map(({ element, span }) => {
          const style = element.style ?? {};
          const padding = PADDING[style.padding ?? "md"] ?? PADDING.md;
          const background = style.background?.color
            ? resolveColor(style.background.color, colors, "transparent")
            : resolveColor(colors.surface, colors, "#ffffff");
          const isSelected = element.elementId === selectedId;
          const headingColor = resolveColor(
            style.headingColor ?? style.textColor ?? colors.heading,
            colors,
            "#111111",
          );
          return (
            <section
              key={element.elementId}
              className={`tcp-element${isSelected ? " is-selected" : ""}`}
              style={{
                gridColumn: `span ${span}`,
                background,
                padding,
                textAlign: style.align === "center" ? "center" : "start",
                ["--q-heading" as string]: headingColor,
              }}
              onClick={() => onSelect(element.elementId)}
            >
              <div className="el-badge">
                {ELEMENT_CATALOG[element.elementType]?.label ?? element.elementType} · {element.visibility}
                {element.hidden ? " · ausgeblendet" : ""}
              </div>
              <div
                className="el-body"
                style={{
                  color: style.textColor ? resolveColor(style.textColor, colors, "inherit") : undefined,
                }}
              >
                <ElementView element={element} tagName={doc.template.name} editing={editing} />
              </div>
            </section>
          );
        })}
      </div>

      {placed.length === 0 ? <p className="tcp-empty">Noch keine sichtbaren Elemente.</p> : null}
    </div>
  );
}
