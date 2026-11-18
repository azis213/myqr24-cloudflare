import type { Breakpoint, Presentation, TagContentDocument, TemplateElement } from "../domain/types";
import { PRESENTATIONS, TAG_TYPE_LABELS } from "../domain/catalog";
import { RichText } from "../preview/RichText";
import { updateElementInDoc, updatePlacementInDoc, updateShellInDoc, updateThemeColorsInDoc } from "../state/store";

export interface InspectorProps {
  doc: TagContentDocument;
  selectedId: string | null;
  breakpoint: Breakpoint;
  onChange: (doc: TagContentDocument) => void;
}

const VISIBILITIES = ["public", "shared", "private", "ownerOnly"] as const;

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="color" value={value?.startsWith("#") ? value : "#ffffff"} onChange={(event) => onChange(event.target.value)} />
      <input className="field-text" value={value ?? ""} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ShellInspector({ doc, onChange }: { doc: TagContentDocument; onChange: (doc: TagContentDocument) => void }) {
  const { shell, template } = doc;
  const colors = shell.theme.colors;
  return (
    <div className="inspector">
      <h2>Template</h2>
      <label className="field">
        <span>Name</span>
        <input
          value={template.name}
          onChange={(event) => onChange({ ...doc, template: { ...template, name: event.target.value } })}
        />
      </label>
      <label className="field">
        <span>Beschreibung</span>
        <textarea
          rows={2}
          value={template.description ?? ""}
          onChange={(event) => onChange({ ...doc, template: { ...template, description: event.target.value } })}
        />
      </label>
      <div className="field">
        <span>TAG-Typ</span>
        <strong>{TAG_TYPE_LABELS[template.tagType]}</strong>
      </div>
      <label className="field">
        <span>Präsentation</span>
        <select
          value={shell.presentation}
          onChange={(event) => onChange(updateShellInDoc(doc, { presentation: event.target.value as Presentation }))}
        >
          {PRESENTATIONS.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>
      </label>

      <h2>Farben</h2>
      <ColorInput label="Hintergrund" value={colors.background} onChange={(value) => onChange(updateThemeColorsInDoc(doc, { background: value }))} />
      <ColorInput label="Fläche" value={colors.surface} onChange={(value) => onChange(updateThemeColorsInDoc(doc, { surface: value }))} />
      <ColorInput label="Akzent (Buttons)" value={colors.accent} onChange={(value) => onChange(updateThemeColorsInDoc(doc, { accent: value }))} />
      <ColorInput label="Button-Text" value={colors.accentText} onChange={(value) => onChange(updateThemeColorsInDoc(doc, { accentText: value }))} />
      <ColorInput label="Text" value={colors.text} onChange={(value) => onChange(updateThemeColorsInDoc(doc, { text: value }))} />
      <ColorInput label="Überschriften" value={colors.heading} onChange={(value) => onChange(updateThemeColorsInDoc(doc, { heading: value }))} />

      <h2>Layout</h2>
      <div className="field-row">
        <label className="field">
          <span>Inhalt</span>
          <select
            value={shell.theme.layout?.contentWidth ?? "narrow"}
            onChange={(event) =>
              onChange(
                updateShellInDoc(doc, {
                  theme: { ...shell.theme, layout: { ...shell.theme.layout, contentWidth: event.target.value as "narrow" } },
                }),
              )
            }
          >
            <option value="narrow">schmal</option>
            <option value="wide">breit</option>
            <option value="full">voll</option>
          </select>
        </label>
        <label className="field">
          <span>Dichte</span>
          <select
            value={shell.theme.layout?.density ?? "comfortable"}
            onChange={(event) =>
              onChange(
                updateShellInDoc(doc, {
                  theme: { ...shell.theme, layout: { ...shell.theme.layout, density: event.target.value as "comfortable" } },
                }),
              )
            }
          >
            <option value="compact">kompakt</option>
            <option value="comfortable">komfortabel</option>
          </select>
        </label>
      </div>
      <p className="hint">Spalten und Spans werden zur Laufzeit berechnet (12-Spalten-Grid mit Fluss).</p>
    </div>
  );
}

function ElementInspector({
  doc,
  element,
  breakpoint,
  onChange,
}: {
  doc: TagContentDocument;
  element: TemplateElement;
  breakpoint: Breakpoint;
  onChange: (doc: TagContentDocument) => void;
}) {
  const patch = (values: Partial<TemplateElement>) => onChange(updateElementInDoc(doc, element.elementId, values));
  const span = element.placement?.span?.[breakpoint] ?? 12;
  const order = element.placement?.order?.[breakpoint] ?? element.displayOrder;
  const style = element.style ?? {};

  return (
    <div className="inspector">
      <h2>{element.elementId}</h2>
      <div className="field">
        <span>Typ</span>
        <strong>{element.elementType}</strong>
      </div>

      <label className="field">
        <span>Sichtbarkeit</span>
        <select value={element.visibility} onChange={(event) => patch({ visibility: event.target.value as TemplateElement["visibility"] })}>
          {VISIBILITIES.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>
      </label>

      <h3>Platzierung ({breakpoint})</h3>
      <div className="field-row">
        <label className="field">
          <span>Span (1–12)</span>
          <input
            type="number"
            min={1}
            max={12}
            value={span}
            onChange={(event) => onChange(updatePlacementInDoc(doc, element.elementId, breakpoint, { span: Number(event.target.value) }))}
          />
        </label>
        <label className="field">
          <span>Reihenfolge</span>
          <input
            type="number"
            min={0}
            max={999}
            value={order}
            onChange={(event) => onChange(updatePlacementInDoc(doc, element.elementId, breakpoint, { order: Number(event.target.value) }))}
          />
        </label>
      </div>

      <h3>Element-Farben</h3>
      <ColorInput
        label="Hintergrund"
        value={style.background?.color}
        onChange={(value) =>
          patch({ style: { ...style, background: { type: "solid", color: value } } })
        }
      />
      <ColorInput
        label="Text"
        value={style.textColor}
        onChange={(value) => patch({ style: { ...style, textColor: value } })}
      />
      <ColorInput
        label="Überschrift"
        value={style.headingColor}
        onChange={(value) => patch({ style: { ...style, headingColor: value } })}
      />
      <label className="field">
        <span>Innenabstand</span>
        <select
          value={style.padding ?? "md"}
          onChange={(event) => patch({ style: { ...style, padding: event.target.value as "md" } })}
        >
          <option value="none">keiner</option>
          <option value="sm">klein</option>
          <option value="md">mittel</option>
          <option value="lg">groß</option>
        </select>
      </label>
    </div>
  );
}

function TextSummary({ element }: { element: TemplateElement }) {
  const content = element.content;
  const paragraphs = content?.paragraphs ?? [];
  const hasText = (content?.heading ?? "").length > 0 || paragraphs.length > 0;
  return (
    <div className="inspector">
      <h3>Text (Kontrolle)</h3>
      {hasText ? (
        <div className="text-summary">
          <RichText content={content} />
        </div>
      ) : (
        <p className="hint">Noch kein Text hinterlegt.</p>
      )}
      <p className="hint">
        Bearbeitet wird direkt in der Vorschau: Klick ins Textfeld, Formatierleiste erscheint darüber
        (Fett, Kursiv, Unterstrich, Vorder-/Hintergrundfarbe).
      </p>
    </div>
  );
}


function PayloadEditor({
  doc,
  element,
  onChange,
}: {
  doc: TagContentDocument;
  element: TemplateElement;
  onChange: (doc: TagContentDocument) => void;
}) {
  const setPayload = (values: Record<string, unknown>) =>
    onChange(updateElementInDoc(doc, element.elementId, { payload: { ...element.payload, ...values } }));
  const stringValue = (key: string, fallback: string) => {
    const value = element.payload[key];
    return typeof value === "string" ? value : fallback;
  };
  const picker = (element.payload.picker ?? {}) as Record<string, unknown>;
  const viewer = (element.payload.viewer ?? {}) as Record<string, unknown>;

  return (
    <div className="inspector">
      <h3>Verhalten</h3>
      {element.elementType === "gallery" ? (
        <>
          <label className="field">
            <span>Galeriename</span>
            <input value={stringValue("name", "")} onChange={(event) => setPayload({ name: event.target.value })} />
          </label>
          <div className="field-row">
            <label className="field">
              <span>Picker</span>
              <select
                value={String(picker.axis ?? "horizontal")}
                onChange={(event) => setPayload({ picker: { ...picker, axis: event.target.value } })}
              >
                <option value="horizontal">horizontal</option>
                <option value="vertical">vertikal</option>
              </select>
            </label>
            <label className="field">
              <span>Ansicht</span>
              <select
                value={String(viewer.sizeMode ?? "medium")}
                onChange={(event) => setPayload({ viewer: { ...viewer, sizeMode: event.target.value } })}
              >
                <option value="medium">mittel</option>
                <option value="full">voll</option>
              </select>
            </label>
          </div>
          <label className="field">
            <span>Max. Bilder</span>
            <input
              type="number"
              min={1}
              max={48}
              value={Number(element.payload.maxImages ?? 48)}
              onChange={(event) => setPayload({ maxImages: Number(event.target.value) })}
            />
          </label>
        </>
      ) : null}

      {element.elementType === "document" ? (
        <label className="field">
          <span>Darstellung</span>
          <select value={stringValue("display", "link")} onChange={(event) => setPayload({ display: event.target.value })}>
            <option value="link">Link</option>
            <option value="box-scroll">Box mit Scrollen</option>
            <option value="pages-paged">Seiten mit Blättern</option>
            <option value="pages-stacked">Seiten untereinander</option>
            <option value="pages-side-by-side">Seiten nebeneinander</option>
          </select>
        </label>
      ) : null}

      {element.elementType === "documents" ? (
        <div className="field-row">
          <label className="field">
            <span>Ansicht</span>
            <select value={stringValue("view", "list")} onChange={(event) => setPayload({ view: event.target.value })}>
              <option value="list">Liste</option>
              <option value="icons">Symbole</option>
            </select>
          </label>
          <label className="field">
            <span>Sortierung</span>
            <select value={stringValue("sort", "date-desc")} onChange={(event) => setPayload({ sort: event.target.value })}>
              <option value="date-desc">neueste zuerst</option>
              <option value="date-asc">älteste zuerst</option>
              <option value="name">Name</option>
            </select>
          </label>
        </div>
      ) : null}

      {element.elementType === "image" ? (
        <div className="field-row">
          <label className="field">
            <span>Fit</span>
            <select value={stringValue("fit", "contain")} onChange={(event) => setPayload({ fit: event.target.value })}>
              <option value="contain">contain</option>
              <option value="cover">cover</option>
            </select>
          </label>
          <label className="field">
            <span>Zoom</span>
            <select value={stringValue("zoom", "tap")} onChange={(event) => setPayload({ zoom: event.target.value })}>
              <option value="none">keiner</option>
              <option value="tap">Tap</option>
              <option value="pinch">Pinch</option>
            </select>
          </label>
        </div>
      ) : null}
    </div>
  );
}



function SlotEditor({
  doc,
  element,
  onChange,
}: {
  doc: TagContentDocument;
  element: TemplateElement;
  onChange: (doc: TagContentDocument) => void;
}) {
  if (!element.slots || element.slots.length === 0) return null;
  return (
    <div className="inspector">
      <h3>Slots</h3>
      {element.slots.map((slot) => (
        <div className="field-row" key={slot.slotId}>
          <span className="field-static">
            {slot.slotId} · {slot.accepts.join("/")} · min {slot.min}
          </span>
          <label className="field">
            <span>max</span>
            <input
              type="number"
              min={1}
              max={64}
              value={slot.max}
              onChange={(event) =>
                onChange(
                  updateElementInDoc(doc, element.elementId, {
                    slots: element.slots?.map((entry) =>
                      entry.slotId === slot.slotId ? { ...entry, max: Number(event.target.value) } : entry,
                    ),
                  }),
                )
              }
            />
          </label>
        </div>
      ))}
    </div>
  );
}

export function Inspector({ doc, selectedId, breakpoint, onChange }: InspectorProps) {
  const element = doc.elements.find((entry) => entry.elementId === selectedId);
  if (!element) return <ShellInspector doc={doc} onChange={onChange} />;
  const textual = ["text", "callout", "hero", "finder-notice", "finder-form", "contact-channel"].includes(
    element.elementType,
  );
  return (
    <>
      <ElementInspector doc={doc} element={element} breakpoint={breakpoint} onChange={onChange} />
      {textual ? <TextSummary element={element} /> : null}
      <PayloadEditor doc={doc} element={element} onChange={onChange} />
      <SlotEditor doc={doc} element={element} onChange={onChange} />
    </>
  );
}

export { ShellInspector, ElementInspector, VISIBILITIES, ColorInput };

