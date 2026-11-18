import { useEffect, useRef, useState, type ReactNode } from "react";
import { isHexColor } from "../domain/richtext";
import { IconChevronDown } from "./icons";
import { STANDARD_COLORS, themeSwatches, type PaletteContext } from "./palette";

export interface ColorMenuProps {
  /** Name für Titel/aria, z. B. „Zeichenfarbe". */
  label: string;
  value?: string | null;
  palette: PaletteContext;
  onPick: (hex: string) => void;
  children: ReactNode;
}

/**
 * Word-nahes Farbmenü: Theme-Palette, Standard-Palette, eigene Farben (hinzufügen/entfernen)
 * und ein RGB-Farbwähler. Die Auswahl im Editor bleibt erhalten (mousedown wird abgefangen),
 * außer bei den Eingabefeldern selbst.
 */
export function ColorMenu({ label, value, palette, onPick, children }: ColorMenuProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(isHexColor(value) ? value : "#000000");
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isHexColor(value)) setDraft(value);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const pick = (hex: string) => {
    onPick(hex);
    setOpen(false);
  };

  return (
    <div className="fb-colormenu" ref={rootRef}>
      <button
        type="button"
        className="fb-btn fb-colorbtn"
        title={label}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((current) => !current)}
      >
        {children}
        <IconChevronDown />
      </button>


      {open ? (
        <div
          className="fb-menu"
          role="dialog"
          aria-label={label}
          onMouseDown={(event) => {
            if ((event.target as HTMLElement).tagName !== "INPUT") event.preventDefault();
          }}
        >
          <div className="fb-menu-section">
            <span className="fb-menu-title">Theme</span>
            <div className="fb-swatches">
              {themeSwatches(palette.themeColors).map((swatch) => (
                <button
                  key={swatch.label}
                  type="button"
                  className="fb-swatch-btn"
                  style={{ background: swatch.value }}
                  title={`${swatch.label} · ${swatch.value}`}
                  aria-label={`${label}: ${swatch.label}`}
                  onClick={() => pick(swatch.value)}
                />
              ))}
            </div>
          </div>

          <div className="fb-menu-section">
            <span className="fb-menu-title">Standard</span>
            <div className="fb-swatches">
              {STANDARD_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="fb-swatch-btn"
                  style={{ background: color }}
                  title={color}
                  aria-label={`${label}: ${color}`}
                  onClick={() => pick(color)}
                />
              ))}
            </div>
          </div>

          <div className="fb-menu-section">
            <span className="fb-menu-title">Eigene Farben</span>
            {palette.custom.length === 0 ? (
              <p className="fb-menu-hint">Noch keine eigenen Farben – unten über „＋ Eigene" hinzufügen.</p>
            ) : (
              <div className="fb-swatches">
                {palette.custom.map((color) => (
                  <span className="fb-custom" key={color}>
                    <button
                      type="button"
                      className="fb-swatch-btn"
                      style={{ background: color }}
                      title={`Eigene Farbe ${color}`}
                      aria-label={`${label}: ${color}`}
                      onClick={() => pick(color)}
                    />
                    <button
                      type="button"
                      className="fb-custom-remove"
                      title={`Eigene Farbe ${color} entfernen`}
                      aria-label={`Eigene Farbe ${color} entfernen`}
                      onClick={() => palette.onRemoveCustom(color)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="fb-menu-section fb-menu-rgb">
            <span className="fb-menu-title">RGB</span>
            <input
              type="color"
              aria-label={`${label}: Farbwähler`}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                onPick(event.target.value);
              }}
            />
            <input
              className="fb-hex"
              aria-label={`${label}: Hex-Wert`}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button
              type="button"
              className="fb-btn"
              title="Farbe übernehmen"
              aria-label={`${label}: übernehmen`}
              onClick={() => {
                if (isHexColor(draft)) pick(draft.toLowerCase());
              }}
            >
              ✓
            </button>
            <button
              type="button"
              className="fb-btn"
              title="Als eigene Farbe speichern"
              aria-label={`${label}: als eigene Farbe speichern`}
              onClick={() => {
                if (!isHexColor(draft)) return;
                palette.onAddCustom(draft.toLowerCase());
                pick(draft.toLowerCase());
              }}
            >
              ＋ Eigene
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
