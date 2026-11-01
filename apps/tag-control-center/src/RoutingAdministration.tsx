import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { createRoutingApi } from "./routingApi";
import type { RoutingCatalog, RoutingPreview } from "./routingApi";

type Props = { tcpBaseUrl: string; csrfToken: () => Promise<string>; reauthenticated: boolean };
type FeatureType = "redirect" | "image" | "json";

function definitionTemplate(id: string, type: FeatureType): string {
  if (type === "redirect") return JSON.stringify({ id, type, enabled: true, urlTemplate: "https://app-staging.myqr24.com/tag/{tagId}", status: 302 }, null, 2);
  if (type === "image") return JSON.stringify({ id, type, enabled: true, url: "https://app-staging.myqr24.com/media/v1/tags/{tagId}/assets/ast_demo/cover-1280.webp" }, null, 2);
  return JSON.stringify({ id, type, enabled: true, payload: {} }, null, 2);
}

export function RoutingAdministration({ tcpBaseUrl, csrfToken, reauthenticated }: Props) {
  const api = createRoutingApi(tcpBaseUrl, csrfToken);
  const [catalog, setCatalog] = useState<RoutingCatalog | null>(null);
  const [preview, setPreview] = useState<RoutingPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [featureId, setFeatureId] = useState("redirect-demo");
  const [featureType, setFeatureType] = useState<FeatureType>("redirect");
  const [definition, setDefinition] = useState(definitionTemplate("redirect-demo", "redirect"));
  const [scope, setScope] = useState("tag");
  const [targetId, setTargetId] = useState("");
  const [featureIds, setFeatureIds] = useState("redirect-demo");
  const keys = useRef<Record<string, string>>({});
  const keyFor = (name: string) => keys.current[name] ??= crypto.randomUUID();

  async function reload() {
    setCatalog(await api.catalog());
  }
  async function run(action: () => Promise<void>, success?: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      if (success) setMessage(success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Die Routing-Aktion ist fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }
  async function loadCatalog() {
    await run(reload, "TCP-Routingkatalog und Outbox wurden aktualisiert.");
  }
  async function loadPreview() {
    await run(async () => setPreview(await api.preview()), "TCP hat die Projektion und den Diff bestätigt.");
  }
  async function saveFeature(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const parsed: unknown = JSON.parse(definition);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("Die Featuredefinition muss ein JSON-Objekt sein.");
      const intent = `feature:${featureId}`;
      await api.saveFeature(featureId, parsed as Record<string, unknown>, keyFor(intent));
      delete keys.current[intent];
      await reload();
    }, "Feature wurde serverseitig validiert und gespeichert.");
  }
  async function saveAssignment(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const ids = featureIds.split(",").map((id) => id.trim()).filter(Boolean);
      const intent = `assignment:${scope}:${targetId}`;
      await api.saveAssignment(scope, targetId, ids, keyFor(intent));
      delete keys.current[intent];
      await reload();
    }, "Zuweisung wurde serverseitig bestätigt.");
  }
  async function operation(kind: "publish" | "unpublish") {
    await run(async () => {
      const result = kind === "publish" ? await api.publish(keyFor(kind)) : await api.unpublish(keyFor(kind));
      delete keys.current[kind];
      await reload();
      setMessage(`${kind === "publish" ? "Publish" : "Unpublish"}: ${result.status}; Versuche: ${result.attemptCount}.`);
    });
  }
  async function retry(eventId: string) {
    await run(async () => {
      const intent = `retry:${eventId}`;
      const result = await api.retry(eventId, keyFor(intent));
      delete keys.current[intent];
      await reload();
      setMessage(`Retry: ${result.status}; Versuche: ${result.attemptCount}.`);
    });
  }

  const targetOptions = catalog?.targets[{ tag: "tags", pool: "pools", range: "ranges", group: "groups" }[scope] as keyof RoutingCatalog["targets"]] ?? [];

  return (
    <section className="content-section routing-administration" aria-labelledby="routing-admin-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">CP-I04 / CC-I03 · ausschließlich lokaler Staging-Fake</p>
          <h2 id="routing-admin-heading">Routing-Verwaltung (lokal)</h2>
        </div>
        <p>Einzel-TAG → Allocation Pool → Range → Gruppe → Pages-Default. TCP materialisiert Pool- und TAG-Regeln ohne Pooldaten in KV.</p>
      </div>
      <button type="button" className="secondary-action" disabled={busy} onClick={() => void loadCatalog()}>Routing-Katalog laden</button>
      {catalog ? <p className="module-status">Umgebung: {catalog.environment} · Featuretypen: {catalog.supportedFeatureTypes.join(", ")}</p> : null}

      <div className="module-grid">
        <form className="auth-form" onSubmit={saveFeature}>
          <h3>Wiederverwendbares Feature</h3>
          <label>Feature-ID
            <input required value={featureId} onChange={(event) => {
              const id = event.target.value;
              setFeatureId(id);
              setDefinition(definitionTemplate(id, featureType));
              delete keys.current[`feature:${featureId}`];
            }} />
          </label>
          <label>Feature-Typ
            <select value={featureType} onChange={(event) => {
              const type = event.target.value as FeatureType;
              setFeatureType(type);
              setDefinition(definitionTemplate(featureId, type));
            }}>
              <option value="redirect">redirect</option><option value="image">image</option><option value="json">json</option>
            </select>
          </label>
          <label>Featuredefinition (JSON)
            <textarea required rows={10} value={definition} onChange={(event) => setDefinition(event.target.value)} />
          </label>
          <button type="submit" className="primary-action" disabled={busy || !reauthenticated}>Feature speichern</button>
          {!reauthenticated ? <p>Mutationen erfordern die Re-Authentisierung im Bereich „Kritische Aktion freigeben“.</p> : null}
        </form>

        <form className="auth-form" onSubmit={saveAssignment}>
          <h3>Zuweisung auf vier Ebenen</h3>
          <label>Zuweisungsebene
            <select value={scope} onChange={(event) => { setScope(event.target.value); setTargetId(""); }}>
              <option value="tag">Einzel-TAG</option><option value="pool">Allocation Pool</option><option value="range">Range</option><option value="group">Gruppe</option>
            </select>
          </label>
          <label>Ziel-ID
            <input required list="routing-target-options" value={targetId} onChange={(event) => setTargetId(event.target.value)} />
            <datalist id="routing-target-options">{targetOptions.map((id) => <option key={id} value={id} />)}</datalist>
          </label>
          <label>Feature-IDs (kommagetrennt)
            <input value={featureIds} onChange={(event) => setFeatureIds(event.target.value)} placeholder="Leer für Fallback zur nächsten Ebene" />
          </label>
          <button type="submit" className="primary-action" disabled={busy || !reauthenticated}>Zuweisung speichern</button>
        </form>
      </div>

      {catalog ? (
        <div className="module-grid">
          <article className="module-card">
            <h3>TCP-bestätigte Features und Referenzen</h3>
            {catalog.features.length === 0 ? <p>Noch keine Features konfiguriert.</p> : catalog.features.map((feature) => (
              <p key={feature.id}><code>{feature.id}</code> ({feature.type}) · Referenzen: TAG {feature.references.tag}, Pool {feature.references.pool}, Range {feature.references.range}, Gruppe {feature.references.group}{" "}
                <button type="button" className="secondary-action" onClick={() => {
                  setFeatureId(feature.id);
                  setFeatureType(feature.type);
                  const { references: _references, ...document } = feature;
                  setDefinition(JSON.stringify(document, null, 2));
                }}>Bearbeiten</button>
              </p>
            ))}
            <h3>Aktuelle Zuweisungen</h3>
            {catalog.assignments.map((assignment) => <p key={`${assignment.scope}:${assignment.targetId}`}><code>{assignment.scope}:{assignment.targetId}</code> → {assignment.featureIds.join(", ") || "Fallback"}</p>)}
          </article>
          <article className="module-card">
            <h3>Projektionsvorschau und Outbox</h3>
            <p>Nicht publiziert werden Owner-, Vault-, Audit-, POI-Nachweis-, Secret- und private Pooldaten.</p>
            <button type="button" className="secondary-action" disabled={busy} onClick={() => void loadPreview()}>Projektionsdiff laden</button>
            <button type="button" className="primary-action" disabled={busy || !reauthenticated} onClick={() => void operation("publish")}>Fake-Publish ausführen</button>
            <button type="button" className="secondary-action" disabled={busy || !reauthenticated} onClick={() => void operation("unpublish")}>Fake-Unpublish ausführen</button>
            {preview ? <><p>Basisrevision: {preview.baseRevision ?? "keine"} · Änderungen: {preview.diff.length}</p><pre className="diff-view" data-testid="routing-diff">{JSON.stringify(preview.diff, null, 2)}</pre></> : null}
            {catalog.outbox.map((event) => (
              <div key={event.eventId} className="outbox-event">
                <p><code>#{event.projectionRevision} {event.operation}</code>: {event.status}; Versuche {event.attemptCount}{event.errorClass ? `; ${event.errorClass}` : ""}</p>
                {event.status !== "completed" ? <button type="button" className="secondary-action" disabled={busy || !reauthenticated} onClick={() => void retry(event.eventId)}>Retry {event.eventId}</button> : null}
              </div>
            ))}
          </article>
        </div>
      ) : null}
      {message ? <p className="success-message" role="status">{message}</p> : null}
    </section>
  );
}

