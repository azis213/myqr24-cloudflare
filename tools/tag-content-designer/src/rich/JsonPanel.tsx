import { useState } from "react";
import type { RichTextContent } from "../domain/types";

export interface JsonPanelProps {
  content?: RichTextContent;
  onClose: () => void;
}

/**
 * JSON-Anzeige des Textfelds (Runs-Modell) – lesend, damit die Formatierleiste die
 * einzige Schreibstelle bleibt; Bearbeiten erfolgt in der Textkontrolle rechts.
 */
export function JsonPanel({ content, onClose }: JsonPanelProps) {
  const serialised = JSON.stringify(content ?? { paragraphs: [] }, null, 2);
  const [status, setStatus] = useState<string | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(serialised);
      setStatus("In die Zwischenablage kopiert.");
    } catch {
      setStatus("Kopieren nicht möglich – Text bitte manuell markieren.");
    }
  };

  return (
    <div className="rte-panel" role="region" aria-label="Text als JSON">
      <h3>Text als JSON</h3>
      <p className="hint">
        Runs-Modell des Feldes (Überschriften als <code>heading</code>, Tabellen als <code>type: "table"</code>).
        Bearbeiten in der Textkontrolle rechts; hier nur Anzeige und Kopie.
      </p>
      <textarea
        className="md-text"
        aria-label="Text-JSON"
        spellCheck={false}
        readOnly
        rows={12}
        value={serialised}
      />
      {status ? <p className="hint">{status}</p> : null}
      <div className="group">
        <button type="button" onClick={() => void copy()}>
          Kopieren
        </button>
        <button type="button" onClick={onClose}>
          Schließen
        </button>
      </div>
    </div>
  );
}
