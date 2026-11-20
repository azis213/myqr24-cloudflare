import type { CSSProperties } from "react";
import type { PublicDocumentKind, PublicVaultDocument, PublicVaultImage, VaultBlock } from "./types";
import { RichText } from "./RichText";

const documentKindLabels: Record<PublicDocumentKind, string> = {
  menu: "Speisekarte", invitation: "Einladung", "thank-you": "Dankeschön", other: "Dokument",
};
const array = <T,>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];
const text = (value: unknown, fallback = ""): string => typeof value === "string" ? value : fallback;
const safeUrl = (value: unknown): string | undefined => typeof value === "string" && /^https:\/\//i.test(value) ? value : undefined;
const safeMediaUrl = (value: unknown): string | undefined =>
  typeof value === "string" && (/^https:\/\//i.test(value) || (value.startsWith("/") && !value.startsWith("//"))) ? value : undefined;

export function BlockRenderer({ block }: { block: VaultBlock }) {
  const value = block as VaultBlock & Record<string, unknown>;
  const title = text(value.title, "Inhalt");
  switch (value.type) {
    case "hero": {
      const heading = text(value.title, "");
      const imageUrl = safeMediaUrl(value.imageUrl);
      return <section className="vault-hero">
        {imageUrl && <img src={imageUrl} alt="" className="hero-image" />}
        <div className="hero-overlay"><p className="eyebrow">myQR24 TAG</p>
          {heading && <h1>{heading}</h1>}
          {value.content ? <RichText content={value.content as never} fallback={value.subtitle ? <p>{String(value.subtitle)}</p> : null} /> : value.subtitle && <p>{String(value.subtitle)}</p>}
        </div>
      </section>;
    }
    case "text": {
      const fallback = <>{text(value.title) && <h2>{String(value.title)}</h2>}{array<string>(value.paragraphs).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</>;
      return <section className="content-card text-block"><RichText content={value.content as never} fallback={fallback} /></section>;
    }
    case "callout": {
      const tone = value.tone === "notice" || value.tone === "safety" ? value.tone : "info";
      return <aside className={`callout callout-${tone}`}>
        {text(value.title) && <h2>{String(value.title)}</h2>}
        <RichText content={value.content as never} fallback={<p>{text(value.text)}</p>} />
      </aside>;
    }
    case "gallery": {
      const images = array<PublicVaultImage>(value.images);
      const capacity = slotCapacity(value, "image", 6);
      return <section className="content-card gallery-block"><h2>{title}</h2>
        {images.length ? <GalleryImages images={images} /> : <SlotPlaceholder label="Noch keine Bilder" capacity={capacity} accepts="Bilder" />}
      </section>;
    }
    case "documents": {
      const documents = array<PublicVaultDocument>(value.documents);
      return <section className="content-card document-block"><h2>{title}</h2>
        {text(value.description) && <p>{String(value.description)}</p>}
        {documents.length ? <div className="document-list">{documents.map((document) => {
          const href = safeUrl(document.url);
          return href ? <a className="document-card" href={href} key={document.id} rel="noreferrer" target="_blank">
            <span className="document-kind">{documentKindLabels[document.kind] ?? documentKindLabels.other}</span><strong>{document.title}</strong>
            {document.description && <span>{document.description}</span>}<small>{document.availableLabel ?? "Öffnen"}</small>
          </a> : <article className="document-card" key={document.id}><strong>{document.title}</strong><small>Nicht verfügbar</small></article>;
        })}</div> : <SlotPlaceholder label="Noch keine Dokumente" capacity={slotCapacity(value, "document", 3)} accepts="Dokumente" />}
      </section>;
    }
    case "external-link": {
      const href = safeUrl(value.url);
      return <section className="content-card external-link-block"><p className="eyebrow">Externer Inhalt</p><h2>{text(value.label, title)}</h2>
        {text(value.description) && <p>{String(value.description)}</p>}
        {href && <a className="button button-secondary" href={href} target="_blank" rel="noreferrer">Link öffnen <span aria-hidden="true">↗</span></a>}
      </section>;
    }
    case "image":
    case "document":
      return <section className="content-card item-block">{text(value.title) && <h2>{String(value.title)}</h2>}
        <SlotPlaceholder label={value.type === "image" ? "Bild folgt" : "Dokument folgt"} capacity={1} accepts={value.type === "image" ? "Bild" : "Dokument"} />
      </section>;
    case "divider":
      return <hr className="block-divider" aria-label={text(value.title, "Abschnittstrenner")} />;
    case "notice":
      return <aside className="content-card notice-block"><p className="eyebrow">Hinweis</p>{text(value.title) && <h2>{String(value.title)}</h2>}
        <RichText content={value.content as never} fallback={<p>{text(value.text) || text(value.description) || "Weitere Hinweise folgen."}</p>} />
      </aside>;
    case "finder-form":
      return <section className="content-card notice-block"><h2>{text(value.title, "Fund melden")}</h2>
        <p>{text(value.description, "Die sichere Meldung wird über den myQR24-Dienst bereitgestellt.")}</p>
        <span className="slot-status">Meldungsformular wird serverseitig bereitgestellt</span>
      </section>;
    case "contact":
      return <section className="content-card notice-block"><h2>{text(value.title, "Kontakt")}</h2>
        <p>{text(value.description, "Kontaktdaten werden nur nach Berechtigungsprüfung bereitgestellt.")}</p>
      </section>;
    case "maintenance":
      return <section className="content-card maintenance-block"><h2>{text(value.title, "Wartungshistorie")}</h2>
        <p>{text(value.description, "Es sind noch keine öffentlichen Wartungseinträge verfügbar.")}</p>
      </section>;
    default:
      return null;
  }
}

function slotCapacity(block: Record<string, unknown>, accepts: string, fallback: number): number {
  const slots = array<Record<string, unknown>>(block.slots);
  const match = slots.find((slot) => array<string>(slot.accepts).includes(accepts));
  const max = match?.max;
  return typeof max === "number" && Number.isFinite(max) ? Math.max(1, Math.min(12, max)) : fallback;
}

function SlotPlaceholder({ label, capacity, accepts }: { label: string; capacity: number; accepts: string }) {
  const visible = Math.min(capacity, 6);
  return <div className="slot-placeholder" aria-label={`${label}. ${capacity} ${accepts} möglich.`}>
    <p className="empty-state">{label} <small>({accepts}: max. {capacity})</small></p>
    <div className="item-skeletons">{Array.from({ length: visible }, (_, index) => <span className="item-skeleton" key={index} aria-hidden="true">{accepts === "Dokumente" ? "PDF" : "＋"}</span>)}</div>
    <small className="slot-status">Inhalt folgt · {visible} von {capacity} Plätzen angezeigt</small>
  </div>;
}

function GalleryImages({ images }: { images: PublicVaultImage[] }) {
  return <div className="gallery-grid">{images.map((image) => {
    const url = safeMediaUrl(image.url);
    if (!url) return null;
    return <figure key={image.id ?? image.url}>
    <img src={url} alt={image.alt} loading="lazy" />
    {(image.caption || image.downloadable) && <figcaption>{image.caption && <span>{image.caption}</span>}
      {image.downloadable && <a href={url} download target={url.startsWith("https:") ? "_blank" : undefined} rel={url.startsWith("https:") ? "noreferrer" : undefined}>Bild öffnen / herunterladen</a>}
    </figcaption>}
  </figure>;
  })}</div>;
}

export function gridItemStyle(span: number, align?: string, minWidth?: string, order?: number): CSSProperties {
  return { gridColumn: `span ${span}`, ...(minWidth && /^\d{1,3}(?:\.\d)?rem$/.test(minWidth) ? { minWidth } : {}), ...(typeof order === "number" ? { order } : {}), alignSelf: align === "start" ? "start" : align === "center" ? "center" : "stretch" };
}