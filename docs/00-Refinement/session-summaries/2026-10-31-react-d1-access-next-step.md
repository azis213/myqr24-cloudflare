# Kontextzusammenfassung: React-PWA, D1-Routing und Access-API

> **Status:** Refinement-/Kontextnotiz, **nicht verbindliche Umsetzungsquelle**.  
> Vor einer Folgesession gelten ausschließlich die Architektur, Contracts, Tests, Traceability und Status-Gates außerhalb von `docs/00-Refinement/`.

## 1. Zweck dieser Zusammenfassung

Diese Notiz komprimiert den aktuellen lokalen Arbeitsstand für eine spätere Session. Sie hilft, den Kontext zu verkleinern, ersetzt aber keine verbindlichen Dokumente.

Der aktuelle operative Einstieg bleibt:

```text
docs/40-Implementation/10-Implementation-Orchestration/STATUS.md
```

Die aktuelle verbindliche technische Übergabe ist:

```text
docs/90-Session-Change-Summaries/2026-10-31-REACT-D1-ACCESS-CORRECTION.md
```

## 2. Korrigierte Zielarchitektur

Die React-/Vite-PWA ist wieder die öffentliche TAG-Oberfläche:

```text
QR/NFC-Scan
  → Edge Router: Host/Pfad/Feistel/Range
  → minimale D1-Routingprojektion
  → externer Redirect ODER signierter React-Bootstrap
  → /tag/{tagId} über Cloudflare Pages React-App-Shell
  → Application API: Bootstrap-/Session-/Sichtbarkeitsprüfung
  → privates revisioniertes R2-Content-JSON
  → serverseitiger Media-Signer → später kurzlebige R2-Presigned URL
```

Die kurzzeitig implementierte Richtung **Pages-SSR plus öffentliche direkte R2-Medienroute** wurde vor jedem Deployment zurückgenommen:

- `/tag/* /index.html 200` ist wiederhergestellt;
- keine Pages-Function rendert TAG-HTML;
- keine öffentliche direkte R2-Medienroute;
- `tag-pages-runtime-r2-v1` ist als `superseded-local` markiert.

## 3. Wichtige Architekturentscheidungen

### D1-Routing

- TCP/MySQL bleibt fachlich autoritativ.
- D1 ist nur die minimale abgeleitete Routing-/Access-Projektion.
- `tag_routing` enthält nur `tag_id`, Status, Zieltyp, Schutzmodus, `access_version`, `content_revision` und ggf. externe Ziel-URL.
- Keine PINs, Hashes, Sessions, Owner-/Pool-/POI-Daten oder R2-Keys in D1-Routing.
- Edge nutzt einen parameterisierten Primary-Key-Lookup und liest kein Content-JSON aus R2.

### Edge → React

Interne Tags werden mit folgenden kurzlebig HMAC-signierten Parametern gestartet:

```text
mode, av, rv, nonce, exp, sig
```

Sie sind nur ein UI-Bootstrap, **keine Berechtigung**. Die Access-API prüft sie erneut gegen D1 und `APP_BOOTSTRAP_SECRET_S01`.

### Access, PIN und Medien

- React erhält nur `HttpOnly; Secure; SameSite=Strict`-Sessions, nie rohe Access-Tokens in URL oder Storage.
- Content-JSON liegt privat unter `content/v1/tags/{tagId}/{revision}.json`.
- JSON enthält View-Daten und anonyme Content-IDs, aber keine Object Keys, PINs oder Medien-URLs.
- `APP_PIN_PEPPER_S01` liegt ausschließlich im serverseitigen Secret Store, nie in D1/R2/Browser.
- Argon2id-Startwerte: 8 MiB, 1 Iteration, Parallelität 1, 32-Byte-Hash.
- Lokale Messung: **19,16 ms**; kein Nachweis für Workers-Staging. Vor Betrieb erneut kalibrieren.
- Nach fünf PIN-Fehlversuchen pro `(tagId, clientSignal)`: Sperre für 15 Minuten.
- `access_version`-Änderung widerruft bestehende Access-Sessions zentral.
- Der Media-Signer wird nur per Service Binding angesprochen. Die echte R2-S3-Presigning-Implementierung ist absichtlich fail-closed, bis W3D-Credentials freigegeben sind.

## 4. Relevante Dateien

| Bereich | Wichtige Pfade |
| --- | --- |
| Edge | `apps/edge-router/src/index.ts`, `apps/edge-router/test/worker.test.ts`, `apps/edge-router/wrangler.toml` |
| React | `apps/tag-app/src/App.tsx`, `apps/tag-app/src/services/publicTagViewService.ts`, `apps/tag-app/src/services/tagAccessService.ts`, `apps/tag-app/public/_redirects` |
| App API | `apps/tag-app/workers/app-api.ts`, `apps/tag-app/database/0001_tag_access.sql`, `apps/tag-app/wrangler.app-api.toml` |
| Media-Signer | `apps/tag-app/workers/media-signer.ts`, `apps/tag-app/wrangler.media-signer.toml` |
| Verträge | `docs/10-Architecture/35-Contracts/tag-edge-d1-routing-v1.md`, `tag-app-access-v1.md` |
| Betrieblicher Status | `docs/40-Implementation/10-Implementation-Orchestration/STATUS.md` |

## 5. Lokale Nachweise

| Bereich | Ergebnis |
| --- | --- |
| Edge Router | 73 Tests grün |
| React/App-API | 11 Tests grün |
| TCP/MySQL | 47 Tests, 309 Assertions grün |
| TCC | 18 Tests grün |
| Builds | React, Router, App-API-Worker, Media-Signer-Dry-Run, TCC und Production-Router-Dry-Run grün |

Es wurden keine echten Cloudflare-Tokens, D1-/KV-/R2-Mutationen oder Deployments ausgeführt.

## 6. Nächster zulässiger Schritt

Nur W3D-Gate-Vorbereitung, keine reale Mutation:

1. Aktiven Scan-Worker, `TAG_CONFIG`-Namespace und künftige D1-Zuordnung betrieblich bestätigen.
2. Private R2-Bucket-, App-API-Worker- und Media-Signer-Service-Binding-Topologie festlegen.
3. Serverseitige Secret-Speicherorte und Versionen bestätigen:
   - `APP_BOOTSTRAP_SECRET_S01`
   - `APP_PIN_PEPPER_S01`
   - `APP_MEDIA_SIGNER_KEY_S01`
   - echte R2-S3-Presigning-Credentials
4. D1-Query-Plan und realistische Lasttests für den `tag_id`-Primary-Key-Lookup durchführen; keine unbewiesene "1 Mrd. TAGs"-Aussage treffen.
5. Argon2id auf der Ziel-Workers-Laufzeit benchmarken und Parameter dokumentiert anpassen.
6. Rollback-/Cleanup-Prozess und einen nichtproduktiven Staging-Testtag definieren.
7. Erst nach ausdrücklicher W3D-Freigabe kontrollierte reale Staging-Mutationen vornehmen.

## 7. Nicht vorziehen

- echte Presigned URLs oder S3-Signiercredentials;
- öffentliche R2-Buckets oder freie Object-Pfade;
- Browser-API-Keys, Sessiontokens oder Pepper;
- Login-required-Bypass ohne separaten Account-/Owner-Contract;
- Owner-, Gast- oder Empfängerrechte über Scanner-Access-Token;
- POI-/Produkt-/Check-in-/Guestbook-Fachlogik im Edge Router oder D1-Routingindex.