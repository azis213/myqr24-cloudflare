import { useEffect, useRef, useState } from "react";
import { FONT_SIZE_SCALE } from "../domain/types";
import { IconChevronDown } from "./icons";

export interface SizeFieldProps {
  /** Aktuelle Größe am Cursor/der Auswahl; `null` = keine Größe gesetzt. */
  value: number | null;
  /** Größe übernehmen (nur Auswahl bzw. künftige Eingabe). */
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
 * Schriftgröße als Zahlenfeld mit Pfeilen (Word-nah): tippen, hoch/runter steppen.
 * Angewendet wird ausschließlich auf den markierten Text – ohne Auswahl nur als
 * Vorformatierung der nächsten Eingabe.
 */
export function SizeField({ value, onChange, mixed = false }: SizeFieldProps) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (focused.current) return;
    setDraft(value === null ? "" : String(value));
  }, [value, mixed]);

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      setDraft("");
      onChange(null);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      setDraft(value === null ? "" : String(value));
      return;
    }
    const snapped = snapToScale(parsed);
    setDraft(String(snapped));
    onChange(snapped);
  };

  const bump = (direction: 1 | -1) => {
    const next = stepFrom(value, direction);
    setDraft(String(next));
    onChange(next);
  };

  return (
    <div className="fb-sizefield">
      <input
        className="fb-size"
        type="number"
        inputMode="numeric"
        min={STEPS[0]}
        max={STEPS[STEPS.length - 1]}
        step={1}
        title="Schriftgröße (nur markierter Text)"
        aria-label="Schriftgröße"
        placeholder={mixed ? "–" : "Größe"}
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
            bump(1);
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            bump(-1);
          }
        }}
      />
      <span className="fb-size-steps">
        <button
          type="button"
          className="fb-step"
          title="Schriftgröße erhöhen"
          aria-label="Schriftgröße erhöhen"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => bump(1)}
        >
          <IconChevronDown />
        </button>
        <button
          type="button"
          className="fb-step fb-step-down"
          title="Schriftgröße verringern"
          aria-label="Schriftgröße verringern"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => bump(-1)}
        >
          <IconChevronDown />
        </button>
      </span>
    </div>
  );
}
