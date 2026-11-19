import { useState } from "react";
import { parseMarkdown, toMarkdown } from "./markdown";
import type { RichTextContent } from "../domain/types";

export interface MarkdownDialogProps {
  content?: RichTextContent;
  onApply: (content: RichTextContent) => void;
  onClose: () => void;
}

/**
 * Markdown einfügen oder exportieren. Markdown ist **Ein-/Ausgabeformat**, nicht der Speicher:
 * Beim Übernehmen wird der Feldinhalt ersetzt (Undo möglich), beim Kopieren nur gelesen.
 */
export function MarkdownDialog({ content, onApply, onClose }: MarkdownDialogProps) {
  const exported = toMarkdown(content);
  const [draft, setDraft] = useState(exported.markdown);
  const [warnings, setWarnings] = useState<string[]>(exported.warnings);
  const [status, setStatus] = useState<string | null>(null);

  const apply = () => {
    const result = parseMarkdown(draft);
    setWarnings(result.warnings);
    onApply(result.content);
    onClose();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setStatus("In die Zwischenablage kopiert.");
    } catch {
      setStatus("Kopieren nicht möglich – Text bitte manuell markieren.");
    }
  };

  return (
    <div className="rte-panel" role="dialog" aria-label="Markdown einfügen oder exportieren">
      <h3>Markdown (Struktur, ohne Farben)</h3>
      <p className="hint">
        Überschriften (<code>#</code> bis <code>#####</code>), Listen, Tabellen, <strong>fett</strong>, <em>kursiv</em> und
        Links werden übernommen. Farben, Markierungen und Schriftgrößen sind nicht Teil von Markdown.
        HTML wird nie ausgeführt, sondern als Text behandelt.
      </p>
      <textarea
        className="md-text"
        aria-label="Markdown"
        spellCheck={false}
        rows={12}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      {warnings.length > 0 ? (
        <ul className="md-warnings">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      {status ? <p className="hint">{status}</p> : null}
      <div className="group">
        <button type="button" className="primary" onClick={apply}>
          Übernehmen (ersetzt den Text)
        </button>
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

