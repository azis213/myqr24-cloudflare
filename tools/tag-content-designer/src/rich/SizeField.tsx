import { useEffect, useRef, useState } from "react";
import { FONT_SIZE_SCALE } from "../domain/types";

export interface SizeFieldProps {
  /** Aktuelle Größe am Cursor/der Auswahl; `null` = keine Größe gesetzt. */
  value: number | null;
  /** Effektive Standardgröße (berechnet), wird angezeigt, solange kein Mark gesetzt ist. */
  inheritedSize?: number;
  /** Größe übernehmen (nur Auswahl bzw. künftige Eingabe); `null` entfernt das Mark. */
  onChange: (size: number | null) => void;
  /** Wenn die Auswahl gemischte Größen hat. */
  mixed?: boolean;
}

const STEPS = [...FONT_SIZE_SCALE];

/** Nächstgelegener Skalenwert (die Skala ist geschlossen – keine freien Pixel). */
export function snapToScale(value: number): number {
  let best = STEPS[0];
  for (const step of STEPS) {
    if (Math.abs(step - value) < Math.abs(best - value)) best = step;
  }
  return best;
}

function stepFrom(current: number | null, direction: 1 | -1): number {
  const base = current ?? 16;
  if (direction === 1) return STEPS.find((step) => step > base) ?? STEPS[STEPS.length - 1];
  const smaller = STEPS.filter((step) => step < base);
  return smaller.length > 0 ? smaller[smaller.length - 1] : STEPS[0];
}

/**
 * Schriftgröße als natives Zahlenfeld: die Pfeile erscheinen beim Fokussieren/Hover,
 * ↑/↓ laufen durch die geschlossene Skala, freie Eingaben werden darauf geschnappt.
 * Angewendet wird ausschließlich auf den markierten Text – ohne Auswahl nur als
 * Vorformatierung der nächsten Eingabe. Ohne Mark zeigt das Feld die effektive
 * Standardgröße (gestrichelter Rahmen), damit die Anzeige dem Absatzstil gleicht.
 */
export function SizeField({ value, inheritedSize = 16, onChange, mixed = false }: SizeFieldProps) {
  const inherited = value === null && !mixed;
  const fallback = Number.isFinite(inheritedSize) && inheritedSize > 0 ? Math.round(inheritedSize) : 16;
  const display = value === null ? fallback : value;
  const [draft, setDraft] = useState(String(display));
  const focused = useRef(false);

  useEffect(() => {
    if (focused.current) return;
    setDraft(String(display));
  }, [display, mixed]);

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      setDraft(String(fallback));
      onChange(null);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      setDraft(String(display));
      return;
    }
    const snapped = snapToScale(parsed);
    setDraft(String(snapped));
    onChange(snapped);
  };

  return (
    <div className={`fb-sizefield${inherited ? " is-inherited" : ""}`}>
      <input
        className="fb-size"
        type="number"
        inputMode="numeric"
        min={STEPS[0]}
        max={STEPS[STEPS.length - 1]}
        step={1}
        title={
          inherited
            ? `Standardgröße ${fallback} px – Pfeile oder Zahl ändern nur den markierten Text`
            : "Schriftgröße (nur markierter Text)"
        }
        aria-label="Schriftgröße"
        placeholder={mixed ? "–" : undefined}
        value={draft}
        onFocus={() => {
          focused.current = true;
        }}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => {
          focused.current = false;
          commit(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit((event.target as HTMLInputElement).value);
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            const next = stepFrom(value ?? fallback, 1);
            setDraft(String(next));
            onChange(next);
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            const next = stepFrom(value ?? fallback, -1);
            setDraft(String(next));
            onChange(next);
          }
        }}
      />
    </div>
  );
}
