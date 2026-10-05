import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useParams } from "react-router-dom";
import type {
  PublicDocumentKind,
  PublicTagView,
  PublicVaultImage,
  VaultBlock,
} from "./features/vault/types";
import { publicTagViews } from "./mocks/publicTagViews";
import {
  getPublicTagView,
  UnknownPublicTagError,
} from "./services/publicTagViewService";

const featureLabels: Record<PublicTagView["enabledFeatures"][number], string> = {
  vault: "Vault",
  "lost-found": "Fund melden",
  guestbook: "Gästebuch",
  "check-in": "Check-in",
};

const documentKindLabels: Record<PublicDocumentKind, string> = {
  menu: "Speisekarte",
  invitation: "Einladung",
  "thank-you": "Dankeschön",
  other: "Dokument",
};

type DemoRole = "guest" | "owner";

interface LocalContribution {
  id: string;
  name: string;
  url: string;
}

function AppHeader() {
  return (
    <header className="app-header">
      <Link className="brand" to="/" aria-label="myQR24 Startseite">
        <span className="brand-mark" aria-hidden="true">
          QR
        </span>
        <span>myQR24</span>
      </Link>
      <span className="environment-label">Staging · Public TAG App</span>
    </header>
  );
}

function HomePage() {
  return (
    <main className="home-page">
      <section className="intro-panel">
        <p className="eyebrow">Staging-Test-PWA</p>
        <h1>Öffentliche TAG-Ansicht testen</h1>
        <p>
          Diese Anwendung simuliert die Zielansicht nach einem Scan. Sie
          verwendet ausschließlich freigegebene lokale Fixture-Daten und keine
          privaten Owner- oder Verwaltungsdaten.
        </p>
      </section>

      <section className="sample-section" aria-labelledby="test-tags-heading">
        <div>
          <p className="eyebrow">Testdaten</p>
          <h2 id="test-tags-heading">Verfügbare Test-TAGs</h2>
        </div>
        <div className="tag-list">
          {Object.values(publicTagViews).map((view) => (
            <Link className="tag-card" key={view.tag.id} to={`/tag/${view.tag.id}`}>
              <span className="tag-card-id">{view.tag.id.toUpperCase()}</span>
              <strong>{view.tag.displayName}</strong>
              <span>{presentationLabel(view.tag.presentation)}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="routing-note">
        <h2>Router-Test</h2>
        <p>
          Der Edge Router leitet einen gültigen Scan auf diese Anwendung weiter.
          Für die lokale Ansicht kann die Zielroute direkt geöffnet werden, zum
          Beispiel <code>/tag/trauung1</code>.
        </p>
      </section>
    </main>
  );
}

function TagPage() {
  const { tagId = "" } = useParams();
  const [view, setView] = useState<PublicTagView>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(undefined);
    setView(undefined);

    getPublicTagView(tagId)
      .then((result) => current && setView(result))
      .catch((reason: unknown) => {
        if (!current) return;
        setError(
          reason instanceof UnknownPublicTagError
            ? reason.message
            : "Die öffentliche TAG-Ansicht konnte nicht geladen werden.",
        );
      })
      .finally(() => current && setLoading(false));

    return () => {
      current = false;
    };
  }, [tagId]);

  if (loading) {
    return <main className="status-page">Öffentliche TAG-Ansicht wird geladen …</main>;
  }

  if (error || !view) {
    return (
      <main className="status-page">
        <p className="eyebrow">TAG nicht verfügbar</p>
        <h1>Diese öffentliche Ansicht wurde nicht gefunden.</h1>
        <p>{error}</p>
        <Link className="button button-primary" to="/">
          Zu den Test-TAGs
        </Link>
      </main>
    );
  }

  return <VaultPage view={view} />;
}

function VaultPage({ view }: { view: PublicTagView }) {
  const [activeTab, setActiveTab] = useState<"overview" | "gallery" | "documents">(
    "overview",
  );
  const [role, setRole] = useState<DemoRole>();
  const [showAccess, setShowAccess] = useState(false);
  const [ownerIntent, setOwnerIntent] = useState(false);
  const [contributions, setContributions] = useState<LocalContribution[]>([]);

  const galleryBlocks = useMemo(
    () => view.vault.blocks.filter((block) => block.type === "gallery"),
    [view],
  );
  const documentBlocks = useMemo(
    () => view.vault.blocks.filter((block) => block.type === "documents"),
    [view],
  );
  const overviewBlocks = useMemo(
    () =>
      view.vault.blocks.filter(
        (block) => block.type !== "gallery" && block.type !== "documents",
      ),
    [view],
  );
  const guestDemo = view.vault.guestContributionDemo;

  function addContribution(file: File) {
    if (!guestDemo || contributions.length >= guestDemo.maxImages) return;
    setContributions((current) => [
      ...current,
      { id: crypto.randomUUID(), name: file.name, url: URL.createObjectURL(file) },
    ]);
  }

  function removeContribution(id: string) {
    setContributions((current) => {
      const contribution = current.find((item) => item.id === id);
      if (contribution) URL.revokeObjectURL(contribution.url);
      return current.filter((item) => item.id !== id);
    });
  }

  return (
    <main className="tag-page">
      <section className="tag-context" aria-label="TAG Kontext">
        <span>TAG</span>
        <strong>{view.tag.id.toUpperCase()}</strong>
        <span className="presentation-badge">
          {presentationLabel(view.tag.presentation)}
        </span>
      </section>

      <nav className="vault-tabs" aria-label="Vault-Bereiche">
        <button
          className={activeTab === "overview" ? "is-active" : ""}
          onClick={() => setActiveTab("overview")}
          type="button"
        >
          Übersicht
        </button>
        {galleryBlocks.length > 0 && (
          <button
            className={activeTab === "gallery" ? "is-active" : ""}
            onClick={() => setActiveTab("gallery")}
            type="button"
          >
            Galerie
          </button>
        )}
        {documentBlocks.length > 0 && (
          <button
            className={activeTab === "documents" ? "is-active" : ""}
            onClick={() => setActiveTab("documents")}
            type="button"
          >
            Dokumente
          </button>
        )}
      </nav>

      <article className="vault-content">
        {activeTab === "overview" &&
          overviewBlocks.map((block, index) => (
            <VaultBlockRenderer block={block} key={`${block.type}-${index}`} />
          ))}

        {activeTab === "gallery" && (
          <>
            {galleryBlocks.map((block, index) => (
              <VaultBlockRenderer block={block} key={`${block.type}-${index}`} />
            ))}
            {guestDemo && (
              <GuestContributionPanel
                demo={guestDemo}
                role={role}
                contributions={contributions}
                onAccess={() => {
                  setOwnerIntent(false);
                  setShowAccess(true);
                }}
                onUpload={addContribution}
                onRemove={removeContribution}
              />
            )}
          </>
        )}

        {activeTab === "documents" &&
          documentBlocks.map((block, index) => (
            <VaultBlockRenderer block={block} key={`${block.type}-${index}`} />
          ))}
      </article>

      {guestDemo && activeTab === "overview" && (
        <section className="guest-teaser content-card">
          <p className="eyebrow">Gemeinsame Erinnerungen</p>
          <h2>{guestDemo.label}</h2>
          <p>{guestDemo.description}</p>
          {guestDemo.enabled ? (
            <button
              className="button button-primary"
              type="button"
              onClick={() => {
                setActiveTab("gallery");
                setOwnerIntent(false);
                setShowAccess(true);
              }}
            >
              Zugang eingeben
            </button>
          ) : (
            <p className="muted-copy">Für dieses TAG sind Gastbeiträge deaktiviert.</p>
          )}
        </section>
      )}

      <section className="feature-bar" aria-label="Aktivierte Funktionen">
        <p>Für dieses TAG aktiv</p>
        <div>
          {view.enabledFeatures.map((feature) => (
            <span key={feature}>{featureLabels[feature]}</span>
          ))}
        </div>
      </section>

      <p className="public-notice">
        Öffentliche Ansicht · Private Inhalte und Kontaktdaten werden nicht angezeigt.
        {guestDemo?.enabled && (
          <>
            {" "}
            Diese Staging-Interaktion ist nicht persistent und ersetzt keine
            serverseitige Berechtigungsprüfung.
          </>
        )}
      </p>

      {guestDemo?.enabled && (
        <button
          className="owner-entry"
          type="button"
          onClick={() => {
            setOwnerIntent(true);
            setShowAccess(true);
          }}
        >
          Hochzeit verwalten
        </button>
      )}

      {showAccess && (
        <AccessDialog
          ownerIntent={ownerIntent}
          onClose={() => setShowAccess(false)}
          onGranted={(grantedRole) => {
            setRole(grantedRole);
            setShowAccess(false);
          }}
        />
      )}
    </main>
  );
}

function AccessDialog({
  ownerIntent,
  onClose,
  onGranted,
}: {
  ownerIntent: boolean;
  onClose: () => void;
  onGranted: (role: DemoRole) => void;
}) {
  const [code, setCode] = useState("");
  const [hint, setHint] = useState<string>();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!code.trim()) {
      setHint("Bitte gib einen Zugangscode ein.");
      return;
    }
    onGranted(ownerIntent ? "owner" : "guest");
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        aria-labelledby="access-dialog-title"
        aria-modal="true"
        className="access-dialog"
        role="dialog"
      >
        <button className="dialog-close" type="button" onClick={onClose} aria-label="Schließen">
          ×
        </button>
        <p className="eyebrow">Staging-Demo</p>
        <h2 id="access-dialog-title">
          {ownerIntent ? "Verwaltung öffnen" : "Erinnerungen teilen"}
        </h2>
        <p>
          Gib deinen Zugangscode ein. In dieser UI-Demo wird kein Code geprüft oder
          gespeichert; die spätere API entscheidet serverseitig über Gast- oder
          Owner-Rechte.
        </p>
        <form onSubmit={submit}>
          <label htmlFor="access-code">Zugangscode</label>
          <input
            autoComplete="one-time-code"
            id="access-code"
            inputMode="numeric"
            onChange={(event) => setCode(event.target.value)}
            placeholder="Code eingeben"
            type="password"
            value={code}
          />
          {hint && <p className="form-error">{hint}</p>}
          <button className="button button-primary" type="submit">
            Demo freischalten
          </button>
        </form>
      </section>
    </div>
  );
}

function GuestContributionPanel({
  demo,
  role,
  contributions,
  onAccess,
  onUpload,
  onRemove,
}: {
  demo: NonNullable<PublicTagView["vault"]["guestContributionDemo"]>;
  role?: DemoRole;
  contributions: LocalContribution[];
  onAccess: () => void;
  onUpload: (file: File) => void;
  onRemove: (id: string) => void;
}) {
  if (!demo.enabled) return null;

  return (
    <section className="content-card guest-contribution-panel">
      <p className="eyebrow">Staging-Demo</p>
      <h2>{demo.label}</h2>
      <p>{demo.description}</p>

      {!role ? (
        <button className="button button-primary" type="button" onClick={onAccess}>
          Zugang eingeben
        </button>
      ) : (
        <>
          <p className="access-success">
            Demo-Zugang aktiv als {role === "owner" ? "Owner" : "Gast"}.
          </p>
          <label className="upload-control">
            <span>Bild auswählen (maximal {demo.maxImages})</span>
            <input
              accept="image/*"
              disabled={contributions.length >= demo.maxImages}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onUpload(file);
                event.currentTarget.value = "";
              }}
              type="file"
            />
          </label>
          {contributions.length > 0 && (
            <div className="my-contributions">
              <h3>Meine Demo-Beiträge</h3>
              <div className="gallery-grid">
                {contributions.map((contribution) => (
                  <figure key={contribution.id}>
                    <img alt={`Lokale Vorschau ${contribution.name}`} src={contribution.url} />
                    <figcaption>
                      <span>{contribution.name}</span>
                      <button type="button" onClick={() => onRemove(contribution.id)}>
                        Eigenes Bild entfernen
                      </button>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}
          <p className="muted-copy">{demo.ownershipRule}</p>
        </>
      )}
    </section>
  );
}

function VaultBlockRenderer({ block }: { block: VaultBlock }) {
  switch (block.type) {
    case "hero":
      return (
        <section className="vault-hero">
          {block.imageUrl && <img src={block.imageUrl} alt="" className="hero-image" />}
          <div className="hero-overlay">
            <p className="eyebrow">myQR24 TAG</p>
            <h1>{block.title}</h1>
            {block.subtitle && <p>{block.subtitle}</p>}
          </div>
        </section>
      );

    case "text":
      return (
        <section className="content-card text-block">
          {block.title && <h2>{block.title}</h2>}
          {block.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
      );

    case "callout":
      return (
        <aside className={`callout callout-${block.tone}`}>
          <h2>{block.title}</h2>
          <p>{block.text}</p>
        </aside>
      );

    case "gallery":
      return <GalleryBlock images={block.images} title={block.title} />;

    case "documents":
      return (
        <section className="content-card document-block">
          <h2>{block.title}</h2>
          {block.description && <p>{block.description}</p>}
          <div className="document-list">
            {block.documents.map((document) => (
              <a
                className="document-card"
                href={document.url}
                key={document.id}
                rel="noreferrer"
                target="_blank"
              >
                <span className="document-kind">{documentKindLabels[document.kind]}</span>
                <strong>{document.title}</strong>
                {document.description && <span>{document.description}</span>}
                <small>{document.availableLabel ?? "Öffnen"}</small>
              </a>
            ))}
          </div>
        </section>
      );

    case "external-link":
      return (
        <section className="content-card external-link-block">
          <p className="eyebrow">Externer Inhalt</p>
          <h2>{block.label}</h2>
          {block.description && <p>{block.description}</p>}
          <a className="button button-secondary" href={block.url} target="_blank" rel="noreferrer">
            Link öffnen <span aria-hidden="true">↗</span>
          </a>
        </section>
      );
  }
}

function GalleryBlock({ images, title }: { images: PublicVaultImage[]; title: string }) {
  return (
    <section className="content-card gallery-block">
      <h2>{title}</h2>
      <div className="gallery-grid">
        {images.map((image) => (
          <figure key={image.id ?? image.url}>
            <img src={image.url} alt={image.alt} loading="lazy" />
            {(image.caption || image.downloadable) && (
              <figcaption>
                {image.caption && <span>{image.caption}</span>}
                {image.downloadable && (
                  <a href={image.url} download target="_blank" rel="noreferrer">
                    Bild öffnen / herunterladen
                  </a>
                )}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </section>
  );
}

function presentationLabel(presentation: PublicTagView["tag"]["presentation"]) {
  const labels: Record<PublicTagView["tag"]["presentation"], string> = {
    standard: "Standard",
    gallery: "Galerie",
    "public-page": "Öffentliche Seite",
    "museum-exhibit": "Ausstellungsobjekt",
    "summit-guide": "POI & Gipfel",
    wedding: "Hochzeit",
  };

  return labels[presentation];
}

export function App() {
  return (
    <div className="app-shell">
      <AppHeader />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/tag/:tagId" element={<TagPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <footer className="app-footer">
        <span>myQR24 Staging</span>
        <span>Öffentliche Testansicht</span>
      </footer>
    </div>
  );
}
