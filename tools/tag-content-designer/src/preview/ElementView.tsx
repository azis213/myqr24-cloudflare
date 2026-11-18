import { ELEMENT_CATALOG } from "../domain/catalog";
import { resolveContent } from "../domain/bindings";
import type { ElementStyle, RichTextContent, TemplateElement, TemplateSlot } from "../domain/types";
import { InlineTextEditor } from "./InlineTextEditor";
import { RichText } from "./RichText";

const INLINE_TEXT_TYPES = ["text", "callout", "hero", "finder-notice", "finder-form", "contact-channel"];

export interface ElementEditing {
  onContentChange: (element: TemplateElement, content: RichTextContent) => void;
  onStyleChange: (element: TemplateElement, patch: Partial<ElementStyle>) => void;
}


function slotHint(slot: TemplateSlot): string {
  const kind = slot.accepts.join("/");
  const range = slot.min === slot.max ? `${slot.min}` : `${slot.min}–${slot.max}`;
  return `Slot ${slot.slotId}: ${range}× ${kind}${slot.required ? " (Pflicht)" : ""}`;
}

function Placeholder({ slots, label }: { slots?: TemplateSlot[]; label: string }) {
  if (!slots || slots.length === 0) return null;
  return (
    <div className="ph">
      <span className="ph-label">{label}</span>
      {slots.map((slot) => (
        <span className="ph-slot" key={slot.slotId}>
          {slotHint(slot)}
        </span>
      ))}
    </div>
  );
}

function payloadString(element: TemplateElement, key: string, fallback = ""): string {
  const value = element.payload[key];
  return typeof value === "string" ? value : fallback;
}

export function ElementView({
  element,
  tagName,
  editing,
}: {
  element: TemplateElement;
  tagName?: string;
  editing?: ElementEditing;
}) {
  const content = resolveContent(element, { tagName });
  const slot = (id: string) => element.slots?.find((entry) => entry.slotId === id);
  const canEditInline = editing !== undefined && INLINE_TEXT_TYPES.includes(element.elementType);

  const textBlock = () =>
    canEditInline && editing ? (
      <InlineTextEditor
        content={content}
        style={element.style}
        placeholder="Text eingeben …"
        onContentChange={(next) => editing.onContentChange(element, next)}
        onStyleChange={(patch) => editing.onStyleChange(element, patch)}
      />
    ) : (
      <RichText content={content} />
    );

  switch (element.elementType) {
    case "theme-assets":
      return null;
    case "text":
      return textBlock();
    case "callout": {
      const tone = payloadString(element, "tone", "info");
      return <div className={`callout callout-${tone}`}>{textBlock()}</div>;
    }
    case "hero":
      return (
        <div className="hero">
          {textBlock()}
          <Placeholder slots={element.slots?.filter((entry) => entry.slotId === "cover")} label="Titelbild" />
        </div>
      );
    case "image": {
      const fit = payloadString(element, "fit", "contain");
      const zoom = payloadString(element, "zoom", "tap");
      return (
        <div>
          <div className="media-box" style={{ aspectRatio: "16 / 9" }}>
            <span className="media-icon">🖼</span>
            <span className="media-note">
              Einzelbild · {fit} · Zoom: {zoom}
            </span>
          </div>
          <Placeholder slots={element.slots?.filter((entry) => entry.slotId === "image")} label="Bild" />
        </div>
      );
    }
    case "document": {
      const display = payloadString(element, "display", "link");
      return (
        <div>
          <div className={`doc-card doc-${display}`}>
            <span className="doc-icon">📄</span>
            <div>
              <strong>Dokument</strong>
              <div className="muted">Darstellung: {display}</div>
            </div>
          </div>
          <Placeholder slots={element.slots?.filter((entry) => entry.slotId === "document")} label="PDF" />
        </div>
      );
    }
    case "gallery": {
      const picker = element.payload.picker;
      const axis =
        picker && typeof picker === "object" && "axis" in picker ? String((picker as { axis: unknown }).axis) : "horizontal";
      const images = slot("images");
      const count = images?.max ?? 0;
      const thumbs = Math.min(count, 8);
      return (
        <div>
          <RichText content={content} />
          <div className="gallery-name">{payloadString(element, "name", "Galerie")}</div>
          <div className={`picker picker-${axis}`}>
            {Array.from({ length: Math.max(thumbs, 3) }).map((_, index) => (
              <span className="thumb" key={index}>
                {index + 1}
              </span>
            ))}
          </div>
          <Placeholder slots={images ? [images] : undefined} label="Bilder" />
        </div>
      );
    }
    case "documents": {
      const view = payloadString(element, "view", "list");
      return (
        <div>
          <RichText content={content} />
          <div className={`doc-list doc-list-${view}`}>
            {Array.from({ length: 3 }).map((_, index) => (
              <div className="doc-row" key={index}>
                <span className="doc-icon">📄</span>
                <span>Dokument {index + 1}</span>
                <span className="muted">{view === "icons" ? "Symbol" : "Liste"}</span>
              </div>
            ))}
          </div>
          <Placeholder slots={element.slots?.filter((entry) => entry.slotId === "documents")} label="Dokumente" />
        </div>
      );
    }
    case "external-link":
      return (
        <div className="link-row">
          <span className="button-like">Weitere Informationen ↗</span>
        </div>
      );
    case "divider":
      return <hr className="divider" />;
    case "finder-notice":
    case "finder-form":
    case "contact-channel":
    case "maintenance-history": {
      const label = ELEMENT_CATALOG[element.elementType].label;
      return (
        <div>
          {textBlock()}
          <div className="stub">
            <strong>{label}</strong>
            <span className="muted">Benötigt API-Funktion; im Designer nur als Struktur prüfbar.</span>
          </div>
          <Placeholder slots={element.slots} label={label} />
        </div>
      );
    }
    default:
      return (
        <div className="stub">
          <strong>{String(element.elementType)}</strong>
        </div>
      );
  }
}
