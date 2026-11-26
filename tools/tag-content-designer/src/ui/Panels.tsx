import { useEffect, useState } from "react";
import { allowedTypesFor, ELEMENT_CATALOG, displayModeFor } from "../domain/catalog";
import type { ValidationIssue } from "../domain/errors";
import { canonicalize, sha256Hex } from "../domain/serialize";
import type { ElementType, TagContentDocument, TemplateElement } from "../domain/types";

/** Kurzlabel für die Elementliste: statisch, Einzelanzeige oder Liste. */
function itemsBadge(element: TemplateElement): string {
  if (element.items?.mode !== "dynamic") return "statisch";
  return displayModeFor(element.elementType) === "single" ? "Einzel" : "Liste";
}

export function Outline({
  doc,
  selectedId,
  onSelect,
  onAdd,
  onRemove,
  onMove,
}: {
  doc: TagContentDocument;
  selectedId: string | null;
  onSelect: (elementId: string) => void;
  onAdd: (type: ElementType) => void;
  onRemove: (elementId: string) => void;
  onMove: (elementId: string, delta: number) => void;
}) {
  const [newType, setNewType] = useState<ElementType>("text");
  const ordered = [...doc.elements].sort(
    (left, right) => left.displayOrder - right.displayOrder || left.elementId.localeCompare(right.elementId),
  );
  const allowed = allowedTypesFor(doc.template.tagType);

  return (
    <div className="panel">
      <h2>Elemente</h2>
      <ul className="outline">
        {ordered.map((element) => (
          <li
            key={element.elementId}
            className={element.elementId === selectedId ? "outline-item is-selected" : "outline-item"}
          >
            <button type="button" className="outline-main" onClick={() => onSelect(element.elementId)}>
              <span className="outline-order">{element.displayOrder}</span>
              <span className="outline-label">
                {ELEMENT_CATALOG[element.elementType]?.label ?? element.elementType}
                {element.hidden ? " (ausgeblendet)" : ""}
              </span>
              <span className="outline-vis">
                {element.visibility} · {itemsBadge(element)}
              </span>
            </button>
            <span className="outline-tools">
              <button type="button" className="mini" onClick={() => onMove(element.elementId, -1)} title="nach oben">
                ↑
              </button>
              <button type="button" className="mini" onClick={() => onMove(element.elementId, 1)} title="nach unten">
                ↓
              </button>
              <button type="button" className="mini" onClick={() => onRemove(element.elementId)} title="löschen">
                ✕
              </button>
            </span>
          </li>
        ))}
      </ul>

      <div className="add-row">
        <select value={newType} onChange={(event) => setNewType(event.target.value as ElementType)}>
          {allowed.map((entry) => (
            <option key={entry.type} value={entry.type}>
              {entry.label}
            </option>
          ))}
        </select>
        <button type="button" className="primary" onClick={() => onAdd(newType)}>
          Hinzufügen
        </button>
      </div>
    </div>
  );
}

export function ValidationPanel({
  doc,
  issues,
  onSelect,
}: {
  doc: TagContentDocument;
  issues: ValidationIssue[];
  onSelect: (elementId: string) => void;
}) {
  const errors = issues.filter((entry) => entry.severity === "error");
  const warnings = issues.filter((entry) => entry.severity === "warning");

  const selectFromPath = (path: string) => {
    const match = /^elements\[(\d+)\]/.exec(path);
    if (!match) return;
    const element = doc.elements[Number(match[1])];
    if (element) onSelect(element.elementId);
  };

  return (
    <div className="panel">
      <h2>
        Validierung{" "}
        <span className="count">
          {errors.length} Fehler · {warnings.length} Warnungen
        </span>
      </h2>
      {issues.length === 0 ? <p className="ok">Keine Befunde – das Dokument ist speicherbar.</p> : null}
      <ul className="issues">
        {issues.map((entry, index) => (
          <li key={`${entry.code}-${entry.path}-${index}`} className={entry.severity}>
            <button type="button" className="issue" onClick={() => selectFromPath(entry.path)}>
              <span className="issue-code">{entry.code}</span>
              <span className="issue-path">{entry.path || "–"}</span>
              <span className="issue-message">{entry.message}</span>
              {entry.hint ? <span className="issue-hint">{entry.hint}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}


export function JsonPanel({ doc }: { doc: TagContentDocument }) {
  const [hash, setHash] = useState<string>("");
  const json = canonicalize(doc);
  useEffect(() => {
    let active = true;
    void sha256Hex(json)
      .then((value) => {
        if (active) setHash(value);
      })
      .catch(() => {
        if (active) setHash("");
      });
    return () => {
      active = false;
    };
  }, [json]);

  return (
    <div className="panel">
      <h2>
        JSON <span className="count">{new TextEncoder().encode(json).length} Byte</span>
      </h2>
      <p className="hash">SHA-256: {hash ? `${hash.slice(0, 32)}…` : "–"}</p>
      <textarea className="json" readOnly value={json} rows={18} spellCheck={false} />
      <button type="button" className="secondary" onClick={() => void navigator.clipboard?.writeText(json)}>
        JSON kopieren
      </button>
    </div>
  );
}
