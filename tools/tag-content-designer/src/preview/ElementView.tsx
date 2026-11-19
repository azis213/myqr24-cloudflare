import { ELEMENT_CATALOG } from "../domain/catalog";
import { resolveContent } from "../domain/bindings";
import type { ElementStyle, Principal, RichTextContent, TemplateElement, TemplateSlot, Visibility } from "../domain/types";
import type { PaletteContext } from "../rich/palette";
import { RichTextField } from "../rich/RichTextField";
import { RichText } from "./RichText";
import {
  documentKindLabel,
  galleryItems,
  groupEntriesByYear,
  isOwnerOnlyInPreview,
  maintenanceEntriesFor,
  resolveSlotDocuments,
  resolveSlotMedia,
  visibleFor,
  type SampleMedia,
  type TagSample,
} from "./sample";

const INLINE_TEXT_TYPES = ["text", "callout", "hero", "finder-notice", "finder-form", "contact-channel"];

const PRINCIPAL_LABELS: Record<Principal, string> = { scanner: "Scanner", guest: "Gast", owner: "Owner" };

const VISIBILITY_LABELS: Record<Visibility, string> = {
  public: "öffentlich",
  shared: "geteilt (PIN/Login)",
  private: "privat",
  ownerOnly: "nur Owner",
};

export interface ElementEditing {
  onContentChange: (element: TemplateElement, content: RichTextContent) => void;
  onStyleChange: (element: TemplateElement, patch: Partial<ElementStyle>) => void;
  /** Farbangebot der Formatierleiste (Theme, Standard, eigene Farben). */
  palette: PaletteContext;
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

function SampleFigure({ media, className = "tcp-media" }: { media: SampleMedia; className?: string }) {
  return (
    <figure className={className}>
      <img src={media.variants.thumb} alt={media.alt} loading="lazy" />
      {media.caption ? <figcaption>{media.caption}</figcaption> : null}
    </figure>
  );
}

/** Deterministische Datumsanzeige (`JJJJ-MM-TT` → `TT.MM.JJJJ`), unabhängig von der Locale der Laufzeit. */
function formatIsoDate(iso: string): string {
  return iso.split("-").reverse().join(".");
}

/** Hinweis statt Inhalt: Die Rolle sieht dieses Element in der TAG-App nicht. */
function VisibilityNote({ visibility, principal }: { visibility: Visibility; principal: Principal }) {
  const ownerOnly = isOwnerOnlyInPreview(visibility);
  return (
    <p className="tcp-visibility-note" role="note">
      {ownerOnly
        ? `Nur im Editor sichtbar: „${VISIBILITY_LABELS[visibility]}“ wird von der TAG-App-Contentroute nicht ausgeliefert.`
        : `Für ${PRINCIPAL_LABELS[principal]} nicht sichtbar: Sichtbarkeit „${VISIBILITY_LABELS[visibility]}“.`}
    </p>
  );
}

export function ElementView({
  element,
  tagName,
  editing,
  sample,
  principal = "guest",
}: {
  element: TemplateElement;
  tagName?: string;
  editing?: ElementEditing;
  /** Beispieldaten der Vorschau (Medien, Dokumente, Beiträge, Wartungseinträge). */
  sample?: TagSample | null;
  /** Simulierte Rolle; filtert `shared`/`private` und Galeriebeiträge. */
  principal?: Principal;
}) {
  const content = resolveContent(element, { tagName });
  const canEditInline = editing !== undefined && INLINE_TEXT_TYPES.includes(element.elementType);
  /** Ohne Beispieldaten bleibt die Vorschau neutral (reine Struktur). */
  const isVisible = !sample || visibleFor(element.visibility, principal);

  const textBlock = () =>
    canEditInline && editing ? (
      <RichTextField
        content={content}
        style={element.style}
        placeholder="Text eingeben …"
        palette={editing.palette}
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
    case "hero": {
      const cover = resolveSlotMedia(element, "cover", sample)[0];
      return (
        <div className="hero">
          {cover ? <SampleFigure media={cover} className="tcp-media tcp-cover" /> : null}
          {textBlock()}
          {cover ? null : <Placeholder slots={element.slots?.filter((entry) => entry.slotId === "cover")} label="Titelbild" />}
        </div>
      );
    }
    case "image": {
      const fit = payloadString(element, "fit", "contain");
      const zoom = payloadString(element, "zoom", "tap");
      const media = resolveSlotMedia(element, "image", sample)[0];
      if (media) {
        return (
          <div>
            {textBlock()}
            <SampleFigure media={media} />
            <p className="tcp-media-line">
              {fit} · Zoom: {zoom}
            </p>
          </div>
        );
      }
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
      const documents = resolveSlotDocuments(element, "document", sample);
      if (documents[0]) {
        return (
          <div className={`doc-card doc-${display}`}>
            <span className="doc-icon">📄</span>
            <div>
              <strong>{documents[0].title}</strong>
              <div className="muted">{documentKindLabel(documents[0])}</div>
            </div>
          </div>
        );
      }
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
      const images = element.slots?.find((entry) => entry.slotId === "images");
      const items = galleryItems(element, sample, principal);
      const pending = items.filter((item) => item.contribution?.state === "pending").length;
      const upload = element.actions?.upload;
      const canUpload = !!upload?.enabled && (upload.principals ?? []).includes(principal);
      if (!isVisible) {
        return (
          <div>
            <RichText content={content} />
            <VisibilityNote visibility={element.visibility} principal={principal} />
          </div>
        );
      }
      if (items.length > 0) {
        return (
          <div>
            <RichText content={content} />
            <div className="tcp-gallery-head">
              <span className="gallery-name">{payloadString(element, "name", "Galerie")}</span>
              <span className="tcp-gallery-count">
                {items.length} {items.length === 1 ? "Bild" : "Bilder"}
                {pending > 0 ? ` · ${pending} wartet auf Freigabe` : ""}
              </span>
            </div>
            <div className="tcp-gallery-grid">
              {items.map((item) => (
                <figure
                  key={item.media.contentId}
                  className={`tcp-gallery-item${item.contribution?.state === "pending" ? " is-pending" : ""}`}
                >
                  <img src={item.media.variants.thumb} alt={item.media.alt} loading="lazy" />
                  <figcaption>
                    {item.media.caption ?? item.media.alt}
                    {item.contribution?.ownerName ? <span className="tcp-credit">{item.contribution.ownerName}</span> : null}
                  </figcaption>
                </figure>
              ))}
            </div>
            {canUpload ? (
              <p className="tcp-note">
                Beitrag möglich: {upload?.maxItemsPerPrincipal ?? 1} Bilder je Person, nach Freigabe sichtbar.
              </p>
            ) : null}
          </div>
        );
      }
      const thumbs = Math.min(images?.max ?? 0, 8);
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
      if (!isVisible) {
        return (
          <div>
            <RichText content={content} />
            <VisibilityNote visibility={element.visibility} principal={principal} />
          </div>
        );
      }
      const documents = resolveSlotDocuments(element, "documents", sample);
      if (documents.length > 0) {
        return (
          <div>
            <RichText content={content} />
            <ul className={`doc-list doc-list-${view}`}>
              {documents.map((document) => (
                <li className="doc-row" key={document.contentId}>
                  <span className="doc-icon">📄</span>
                  <span>{document.title}</span>
                  <span className="muted">{documentKindLabel(document)}</span>
                  <span className="doc-available">{document.availableLabel ?? "Öffnen"}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      }
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
    case "external-link": {
      const label = typeof element.copy?.label === "string" && element.copy.label.length > 0
        ? element.copy.label
        : "Weitere Informationen";
      return (
        <div className="link-row">
          <span className="button-like">{label} ↗</span>
        </div>
      );
    }
    case "divider":
      return <hr className="divider" />;
    case "maintenance-history": {
      if (!isVisible) {
        return (
          <div>
            <RichText content={content} />
            <VisibilityNote visibility={element.visibility} principal={principal} />
          </div>
        );
      }
      const entries = maintenanceEntriesFor(element, sample);
      if (entries.length === 0) {
        return (
          <div>
            {textBlock()}
            <div className="stub">
              <strong>Wartungshistorie</strong>
              <span className="muted">Einträge erscheinen hier, sobald Wartungen erfasst sind.</span>
            </div>
            <Placeholder slots={element.slots} label="Wartungseinträge" />
          </div>
        );
      }
      const groups =
        payloadString(element, "groupBy", "none") === "year" ? groupEntriesByYear(entries) : [{ year: "", entries }];
      return (
        <div>
          {textBlock()}
          <div className="tcp-maint">
            {groups.map((group) => (
              <section className="tcp-maint-group" key={group.year || "all"}>
                {group.year ? <h4 className="tcp-maint-year">{group.year}</h4> : null}
                <ul className="tcp-maint-list">
                  {group.entries.map((entry) => (
                    <li className={`tcp-maint-entry status-${entry.status ?? "done"}`} key={entry.contentId}>
                      <time dateTime={entry.date}>{formatIsoDate(entry.date)}</time>
                      <span className="tcp-maint-title">{entry.title}</span>
                      {entry.technician ? <span className="tcp-credit">{entry.technician}</span> : null}
                      {entry.summary ? <p>{entry.summary}</p> : null}
                      {entry.documentIds && entry.documentIds.length > 0 ? (
                        <span className="tcp-maint-docs">
                          {entry.documentIds.length} {entry.documentIds.length === 1 ? "Dokument" : "Dokumente"}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      );
    }
    case "finder-notice":
    case "finder-form":
    case "contact-channel": {
      const label = ELEMENT_CATALOG[element.elementType].label;
      if (!isVisible) {
        return (
          <div>
            {textBlock()}
            <VisibilityNote visibility={element.visibility} principal={principal} />
          </div>
        );
      }
      const photos = (element.slots ?? []).flatMap((entry) => resolveSlotMedia(element, entry.slotId, sample));
      return (
        <div>
          {textBlock()}
          <div className="stub">
            <strong>{label}</strong>
            <span className="muted">Benötigt API-Funktion; im Designer nur als Struktur prüfbar.</span>
          </div>
          {photos.length > 0 ? (
            <div className="tcp-gallery-grid">
              {photos.map((media) => (
                <figure className="tcp-gallery-item" key={media.contentId}>
                  <img src={media.variants.thumb} alt={media.alt} loading="lazy" />
                  <figcaption>{media.caption ?? media.alt}</figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <Placeholder slots={element.slots} label={label} />
          )}
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
