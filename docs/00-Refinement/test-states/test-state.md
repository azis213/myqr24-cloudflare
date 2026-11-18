
## 1. Welche Testdaten sind vorhanden?

### TAG-App-UI-Fixtures

Quelle: `apps/tag-app/src/mocks/publicTagViews.ts`

| TAG-ID       | Zweck                                                          |
| ------------ | -------------------------------------------------------------- |
| `stagv001` | öffentlicher Staging-Vault, Deep-Link- und Router-Test        |
| `rsq45q`   | allgemeiner Staging-Testtag                                    |
| `koffer24` | Reisekoffer-/Lost-&-Found-Darstellung                          |
| `album042` | öffentliche Galerie                                           |
| `trauung1` | Hochzeits-Vault mit Galerie, Dokumenten und Gastupload-UX-Demo |
| `fest2026` | Hochzeit ohne Gastuploads, nur freigegebene Galerie            |
| `menue202` | Dokumentvariante mit Speisekarte und Einladung                 |
| `gipfel99` | Summit-/POI-Darstellung mit Guestbook-/Check-in-Hinweisen      |

Alle Bilder sind `placehold.co`-Platzhalter. Es gibt keine echten Kunden-, Owner-, Standort- oder Zugangsdaten. Die Fixtures werden nur im expliziten Fixture-Modus verwendet.

### API-/D1-Testdaten

- `apps/tag-app/test/app-api.test.ts`
  - TAG `ab12cd`
  - numerische TAG-ID `623187229`
  - Content-Revision `8`
  - Element `cel_gallery`
  - Item `1850000000000000`
  - Variante `cover`
  - synthetische HMAC-/PIN-/Service-Secrets
- `apps/tag-app/test/database-schema.test.mjs`
  - TAGs `ab12cd` und `ef34gh`
  - numerische IDs `623187229` und `871866449`
  - TAG-lokale und globale Items
  - `pending`-, `ready`- und `revoked`-Zustände
  - Varianten, Range- und Global-Beschreibungen
- `content-id.test.ts` und `content-paths.test.ts`
  - 52-Bit-Content-IDs, Grenzwerte und R2-Pfadableitung

### Docker-Testdaten

- `.env.local` enthält ausschließlich synthetische lokale Zugangsdaten.
- MySQL-Datenbanken:
  - `myqr24_local` für manuelle Tests
  - `myqr24_test` für den isolierten Laravel-/MySQL-Testlauf
- TCP legt beim Start Migrationen und den lokalen Bootstrap-Admin an.
- Das Passwort steht nur in `test/10-test-local/.env.local`, nicht im Repository.
- **Es gibt aktuell keine R2-Testobjekte und keinen D1-Seed für die neue Contentprojektion im Docker-Stack.**

---

## 2. Aktuelle Docker-Testumgebung starten

Voraussetzungen:

- Docker Desktop läuft.
- PowerShell 7 oder Windows PowerShell.
- `.env.local` enthält lokale synthetische Werte.

Aus dem Repository-Root:

```powershell
.\test\10-test-local\scripts\start-local-test.ps1
```

Beim ersten Start wird `.env.local` aus `.env.example` erzeugt. Vor dem Start sollten die lokalen Passwörter und Secrets darin ersetzt werden.

Danach erreichbar:

| Dienst               | URL                                     |
| -------------------- | --------------------------------------- |
| TAG Control Plane    | `http://localhost:8080/`              |
| TCP Health           | `http://localhost:8080/api/v1/health` |
| TAG Control Center   | `http://localhost:5174/`              |
| TAG-App mit Fixtures | `http://localhost:5173/`              |

Die Fixture-TAGs lassen sich direkt öffnen:

```text
http://localhost:5173/tag/stagv001
http://localhost:5173/tag/rsq45q
http://localhost:5173/tag/koffer24
http://localhost:5173/tag/album042
http://localhost:5173/tag/trauung1
http://localhost:5173/tag/fest2026
http://localhost:5173/tag/menue202
http://localhost:5173/tag/gipfel99
```

Die TAG-App läuft dabei mit:

```text
VITE_TAG_APP_DATA_SOURCE=fixtures
```

Das bedeutet: **Die Oberfläche zeigt Fixtures und ruft die neue Application API nicht auf.**

---

## 3. PWA-Preview im Docker-Container

```powershell
.\test\00-Test-Scripts\deploy-tag-app-docker.ps1
```

Das Skript:

- baut die TAG-App mit Fixtures,
- startet den Compose-Service `tag-app-pwa`,
- prüft Startseite, `/tag/stagv001`, Manifest, Service Worker und Icons.

Aufruf:

```text
http://localhost:4174/tag/stagv001
```

Die Preview nutzt HTTP. Eine echte PWA-Installation auf einem Mobilgerät benötigt HTTPS.

---

## 4. Automatisierte Tests

### TAG-App, D1-Schema und Application API

```powershell
npm run test:app
```

Aktuell: **31 TAG-App-Tests**, darunter:

- 7 Application-API-Tests
- 9 D1-Schema-Tests
- 4 Content-ID-Tests
- 3 Content-Path-Tests
- weitere Adapter-/Session-/Benchmark-Tests

Diese Tests laufen **auf dem Host**, nicht im Docker-Stack. Sie verwenden:

- In-Memory-SQLite für `0001`/`0002`,
- D1-/R2-/Signer-Fakes für die Application API,
- keine realen Cloudflare-Ressourcen.

### TCP-/MySQL-Tests in Docker

```powershell
npm run local:test
```

Dieser Lauf:

- startet MySQL, Codec und TCP,
- verwendet ausschließlich `myqr24_test`,
- führt `migrate:fresh` nur gegen die Testdatenbank aus,
- prüft Audit-, Redaktions-, Rollback- und Health-Verhalten.

Die manuelle Datenbank `myqr24_local` wird dabei nicht zurückgesetzt.

### Gesamter Repository-Test

```powershell
npm test
npm run build
```

---

## 5. D1-Schema lokal ohne Docker prüfen

Die neue Contentmigration lässt sich lokal mit Wrangler D1 ausführen:

```powershell
$persist = Join-Path $env:TEMP "myqr24-tag-app-d1-local"

npx wrangler d1 execute myqr24-tag-app-staging `
  --local `
  --persist-to $persist `
  --config apps/tag-app/wrangler.app-api.toml `
  --env staging `
  --file apps/tag-app/database/0001_tag_access.sql

npx wrangler d1 execute myqr24-tag-app-staging `
  --local `
  --persist-to $persist `
  --config apps/tag-app/wrangler.app-api.toml `
  --env staging `
  --file apps/tag-app/database/0002_tag_content.sql
```

Prüfen:

```powershell
npx wrangler d1 execute myqr24-tag-app-staging `
  --local `
  --persist-to $persist `
  --config apps/tag-app/wrangler.app-api.toml `
  --env staging `
  --command "PRAGMA foreign_key_check; SELECT name FROM sqlite_master WHERE type = 'table' AND (name = 'tag_content' OR name LIKE 'tag_content_%') ORDER BY name;"
```

Erwartet werden sieben Content-/Range-/Global-Tabellen:

```text
tag_content
tag_content_element_items
tag_content_elements
tag_content_items
tag_content_media_variants
tag_range_content
global_content
```

Das ist aber **nur die Schema-/D1-Prüfung**, kein vollständiger API-End-to-End-Test.

---

## 6. Wichtige aktuelle Grenze

Der Docker-Stack startet **noch keinen TAG Application API Worker mit D1/R2**. Es gibt derzeit:

- keinen Compose-Service `tag-app-api`,
- keinen lokalen D1-Seed für `tag_content`,
- keine R2-Testdateien unter `content/v1/...`,
- keine lokale Media-Signer-Integration,
- keinen automatisch erzeugten signierten Bootstrap für einen echten API-Aufruf.

Deshalb gilt aktuell:

| Test                          | Wo?                                        |
| ----------------------------- | ------------------------------------------ |
| TAG-App-Fixtures / Deep Links | Docker, Port `5173`                      |
| PWA-Preview                   | Docker, Port `4174`                      |
| TCP/MySQL/TCC                 | Docker                                     |
| D1-Schema, IDs, Pfade         | Host, `npm run test:app`                 |
| Application API mit Fakes     | Host, `npm run test:app`                 |
| Echte API + D1 + R2           | **noch nicht lokal containerisiert** |

Wenn du die neue Contentprojektion wirklich als Docker-End-to-End-Test fahren willst, fehlt ein `tag-app-api`-Compose-Service mit:

- `wrangler dev --local`,
- persistentem lokalen D1-Verzeichnis,
- lokalem R2-Bucket,
- Seed-SQL für `tag_routing` und `tag_content`,
- Seed-JSONs unter `content/v1/tags/...`,
- lokalen `.dev.vars`,
- einem kleinen Bootstrap-Signatur-/Smoke-Test.

Das wäre der nächste sinnvolle Ausbauschritt. Der aktuelle Docker-Stack ist bewusst noch ein **Fixture-/TCP-/TCC-Stack**, kein vollständiger Cloudflare-Runtime-Stack.
