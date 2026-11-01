# Sessionübergabe: W3L Routing, TCP/TCC, Pages und R2

**Datum:** 2026-10-31  
**Status:** `superseded-local`  
**Ausgangs-HEAD:** `136e74038786fe87fdda220fa4023c0f905059b7`; Umsetzung liegt als uncommitteter Arbeitsstand vor  
**Geltungsbereich:** TCP, TCC, Edge Router, TAG-App/Pages/Runtime; ausschließlich lokale Implementierung und Fakes

## 1. Verbindliche Entscheidung

`W3L-BLK-001` ist aufgelöst. Routing-v1 bleibt bei `redirect`, `image` und `json`; andere Featuretypen benötigen eine neue Router-/Contract-Version. Die Hierarchie lautet:

```text
Einzel-TAG → Allocation Pool → Range → Gruppe → Pages-Default
```

TCP materialisiert Pool- und Einzel-TAG-Zuweisungen als `tag:{decodedValue}`; Einzel-TAG überschreibt Pool. Keine Pool-IDs, Poolnamen, Policies oder Herstellungsdaten gelangen in KV. Ohne Redirect verwendet der Edge Router `PAGES_URL_TEMPLATE` mit ausschließlich `{tagId}` und erzeugt weder TAG-HTML noch JSON-Fallback.

## 2. Implementierung

- Neue Verträge `control-plane-routing-admin-api-v1` und `tag-pages-runtime-r2-v1`; Routing-, URL-, Domain- und Traceability-Dokumente abgestimmt.
- TCP: typspezifische Featurevalidierung, vier Zuweisungsebenen, Range-/Referenzprüfung, Poolmaterialisierung, Admin-Controller mit Session/CSRF/Re-Auth/Idempotenz, revisionierte Outbox, kanonischer Diff, Processing-Claims und Fake-Publisher. Publish/Unpublish neutralisiert zuerst den Index und ist erst nach Providerbestätigung `completed`.
- TCC: `RoutingAdministration.tsx` und `routingApi.ts` für Katalog, Featureeditor, Referenzen, vier Ebenen, Diff sowie Publish/Retry/Unpublish. Keine Cloudflare-, Publisher- oder R2-Konfiguration im Browser.
- Edge: fail-closed HTTPS-Pages-Default für 6/8/10; umgebungsbezogene Templates in `wrangler.toml`.
- Die damalige SSR-/öffentliche-R2-Pages-Richtung wurde vor Deployment zurückgenommen. Sie wird durch die React-/D1-/Access-Architektur in den aktuellen Verträgen ersetzt.

## 3. Ausgeführte Nachweise

| Befehl | Ergebnis |
| --- | --- |
| `npm run local:test` | 47 TCP-Tests, 309 Assertions; MySQL-Migrationen/Rollback-Basis grün |
| `npm test` | 71 Router- und 16 TAG-App-/Pages-/R2-Tests grün |
| `npm run test:tcc` | 18 Tests grün |
| `npm run build` | Router-Staging-Dry-Run, TAG-App-Build und Runtime-Dry-Run erfolgreich |
| `npm run build:tcc` | TypeScript- und Vite-Produktionsbuild erfolgreich |
| `npm run build:production --workspace=@myqr24/edge-router` | Production-Router-Dry-Run erfolgreich; kein Deployment |
| PHP-Syntax über `app`, `tests`, `database/migrations` | 61 Dateien ohne Syntaxfehler |
| `git diff --check` | nach Statusaktualisierung erneut auszuführen |

Tests decken insbesondere Poolpriorität und Pool-Leaks, vier Ebenen, AuthZ/Re-Auth, v1-Ablehnung, atomare Outbox, JSON-kanonischen Diff, Retry, doppelte Processing-Claims, Production-Sperre, Unpublish-Reihenfolge, Pages-Template-Validierung, HTML-/Storage-Leaks, private Dokumente, WebP/AVIF, freie Pfade und interne Runtime-Responses ab.

## 4. Grenzen und nächster zulässiger Schritt

Es wurden **keine** echten Cloudflare-Tokens verwendet und **keine** KV-/R2-/Deployment-Mutationen ausgeführt. Lokale Fakes sind keine Staging- oder Production-Evidenz; `verified` bleibt offen. Die bisherigen externen Dogado-, Codec- und Worker-/Namespace-Blocker bleiben bestehen.

Nächster Schritt ausschließlich W3D-Gate-Vorbereitung: aktive Ressourcenzuordnung, Least-Privilege-Publisher-Token, Dogado, getrennte Pages-/R2-/Service-Binding-Ressourcen, Rollback und kontrollierten Staging-Testplan bestätigen. Vor ausdrücklicher W3D-Freigabe keine reale Mutation oder produktive TAG-Programmierung.
