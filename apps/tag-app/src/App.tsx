import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useParams } from "react-router-dom";
import type {
  PublicTagView,
  VaultBlock,
} from "./features/vault/types";
import { BlockRenderer, gridItemStyle } from "./features/vault/BlockRenderer";
import { breakpointForWidth, containerMaxWidth, effectiveColumns, effectiveSpan, layoutGap, placementOrder } from "./features/vault/layout";
import { themeVariables } from "./features/vault/RichText";
import { publicTagViews } from "./mocks/publicTagViews";
import {
  getPublicTagView,
  UnknownPublicTagError,
} from "./services/publicTagViewService";
import {
  authorizePublic,
  bootstrapFromLocation,
  clearBootstrapParameters,
  verifyPin,
} from "./services/tagAccessService";

const featureLabels: Record<PublicTagView["enabledFeatures"][number], string> = {
  vault: "Vault",
  "lost-found": "Fund melden",
  guestbook: "Gästebuch",
  "check-in": "Check-in",
};
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
  const [pinRequired, setPinRequired] = useState(false);
  const [pin, setPin] = useState("");
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [bootstrap, setBootstrap] = useState(() => bootstrapFromLocation(tagId));

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(undefined);
    setView(undefined);
    setPinRequired(false);
    setPin("");
    const currentBootstrap = bootstrapFromLocation(tagId);
    setBootstrap(currentBootstrap);

    if (import.meta.env.MODE !== "test" && import.meta.env.VITE_TAG_APP_DATA_SOURCE !== "fixtures") {
      if (!currentBootstrap || currentBootstrap.mode === "closed" || currentBootstrap.mode === "login_required") {
        setError("Diese TAG-Ansicht ist derzeit nicht verfügbar.");
        setLoading(false);
        return () => { current = false; };
      }
      if (currentBootstrap.mode === "pin_required") {
        setPinRequired(true);
        setLoading(false);
        return () => { current = false; };
      }
      authorizePublic(tagId.toLowerCase(), currentBootstrap)
        .then(() => {
          clearBootstrapParameters();
          return getPublicTagView(tagId);
        })
        .then((result) => current && setView(result))
        .catch(() => current && setError("Diese TAG-Ansicht ist derzeit nicht verfügbar."))
        .finally(() => current && setLoading(false));
      return () => { current = false; };
    }

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
    if (pinRequired && bootstrap) {
      return (
        <main className="status-page">
          <p className="eyebrow">Geschütztes TAG</p>
          <h1>Zugangscode erforderlich</h1>
          <p>Erst nach serverseitiger Prüfung wird der Inhalt dieses TAGs geladen.</p>
          <form onSubmit={async (event) => {
            event.preventDefault();
            if (!pin.trim()) return;
            setPinSubmitting(true);
            try {
              await verifyPin(tagId.toLowerCase(), pin, bootstrap);
              setPin("");
              clearBootstrapParameters();
              setView(await getPublicTagView(tagId));
              setPinRequired(false);
            } catch {
              setError("Der Zugangscode ist ungültig, gesperrt oder das TAG nicht verfügbar.");
            } finally { setPinSubmitting(false); }
          }}>
            <label htmlFor="tag-pin">Zugangscode</label>
            <input id="tag-pin" type="password" autoComplete="one-time-code" value={pin} onChange={(event) => setPin(event.target.value)} />
            <button className="button button-primary" disabled={pinSubmitting} type="submit">{pinSubmitting ? "Prüfung läuft …" : "Freischalten"}</button>
          </form>
        </main>
      );
    }
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
  const [containerWidth, setContainerWidth] = useState(typeof window === "undefined" ? 1280 : window.innerWidth);

  useEffect(() => {
    const target = document.querySelector<HTMLElement>(".vault-content");
    if (!target) return;
    if (typeof ResizeObserver === "undefined") {
      const update = () => setContainerWidth(window.innerWidth);
      window.addEventListener("resize", update);
      update();
      return () => window.removeEventListener("resize", update);
    }
    const observer = new ResizeObserver((entries) => setContainerWidth(entries[0]?.contentRect.width ?? window.innerWidth));
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

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
  const layout = view.layout ?? view.vault.layout;
  const breakpoint = breakpointForWidth(containerWidth);
  const columns = Math.max(1, Math.min(12, layout?.columns ?? 12));
  const visibleColumns = effectiveColumns(layout, containerWidth);
  const orderedBlocks = (blocks: VaultBlock[]) => blocks.map((block, index) => ({ block, index }));

  return (
    <main className="tag-page" data-theme={view.theme?.colorMode === "dark" ? "dark" : "light"} style={{ ...themeVariables(view.theme), maxWidth: containerMaxWidth(layout), marginInline: "auto" }}>
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

      <article className="vault-content" style={{ gridTemplateColumns: `repeat(${visibleColumns}, minmax(0, 1fr))`, gap: `${layoutGap(layout?.gap)}px` }}>
        {activeTab === "overview" &&
          orderedBlocks(overviewBlocks).map(({ block, index }) => (
            <div className="vault-grid-item" key={`${block.type}-${index}`} style={gridItemStyle(effectiveSpan(block.placement, visibleColumns, breakpoint, columns), block.placement?.align, block.placement?.minWidth, placementOrder(block.placement, breakpoint) ?? index)}>
              <BlockRenderer block={block} />
            </div>
          ))}

        {activeTab === "gallery" && (
          <>
            {orderedBlocks(galleryBlocks).map(({ block, index }) => (
              <div className="vault-grid-item" key={`${block.type}-${index}`} style={gridItemStyle(effectiveSpan(block.placement, visibleColumns, breakpoint, columns), block.placement?.align, block.placement?.minWidth, placementOrder(block.placement, breakpoint) ?? index)}>
                <BlockRenderer block={block} />
              </div>
            ))}
          </>
        )}

        {activeTab === "documents" &&
          orderedBlocks(documentBlocks).map(({ block, index }) => (
            <div className="vault-grid-item" key={`${block.type}-${index}`} style={gridItemStyle(effectiveSpan(block.placement, visibleColumns, breakpoint, columns), block.placement?.align, block.placement?.minWidth, placementOrder(block.placement, breakpoint) ?? index)}>
              <BlockRenderer block={block} />
            </div>
          ))}
      </article>

      <section className="feature-bar" aria-label="Aktivierte Funktionen">
        <p>Für dieses TAG aktiv</p>
        <div>
          {view.enabledFeatures.map((feature) => (
            <span key={feature}>{featureLabels[feature]}</span>
          ))}
        </div>
      </section>

      <p className="public-notice">Öffentliche Ansicht · Private Inhalte und Kontaktdaten werden nicht angezeigt.</p>
    </main>
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
