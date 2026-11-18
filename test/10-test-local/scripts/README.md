
## Zentrales Startskript

Ab sofort startest du die vollständige lokale Umgebung mit:

```powershell
npm run local:cloudflare
```

oder direkt:

```powershell
.\test\00-Test-Scripts\start-cloudflare-test-env.ps1
```

Das Skript startet:

- TAG Control Plane und MySQL
- TAG Control Center
- TAG-App im Fixture-Modus
- privaten TAG-Codec
- **TAG Application API** mit lokalem Wrangler, D1 und R2
- **TAG Media Signer** über lokales Service Binding
- **Edge Router** mit lokaler KV- und D1-Projektion
- Seed für D1, R2 und KV
- Smoke-Tests für API-Content und Edge-Router-`302`

### URLs danach

| Dienst              | URL                                     |
| ------------------- | --------------------------------------- |
| TAG-App Fixtures    | `http://localhost:5173/tag/ab12cd`    |
| TAG Application API | `http://localhost:8787/`              |
| Edge Router         | `http://localhost:8786/`              |
| TAG Control Center  | `http://localhost:5174/`              |
| TCP Health          | `http://localhost:8080/api/v1/health` |

### Lokale API-Testdaten

```text
tagId=ab12cd
revision=8
contentId=1850000000000000
variant=cover
element=cel_gallery
```

Der Media Signer bleibt lokal bewusst fail-closed. `POST /api/get-image-url` liefert deshalb `404`; das ist der bestehende R2-Signatur-Gate, kein Seed-Fehler.

---

## Cleanup bei Datenchaos

```powershell
npm run local:cloudflare:reset
```

oder:

```powershell
.\test\00-Test-Scripts\reset-cloudflare-test-data.ps1
```

Das Skript:

- entfernt die Cloudflare-Worker,
- löscht ausschließlich das Volume `myqr24-local-test_cloudflare_state`,
- baut D1/R2/KV mit den initialen Seed-Daten neu auf,
- startet die Worker neu,
- führt die Smoke-Tests erneut aus.

MySQL-, TCP- und TCC-Daten bleiben erhalten. Für einen vollständigen Reset inklusive MySQL:

```powershell
.\test\10-test-local\scripts\reset-local-test.ps1 -Force
```

---

## Welche bisherigen Skripte bleiben relevant?

| Skript                                           | Weiterhin nötig?                                                      |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| `start-cloudflare-test-env.ps1`                | **Ja, neuer zentraler Einstieg für die vollständige Umgebung** |
| `reset-cloudflare-test-data.ps1`               | **Ja, gezielter Cloudflare-Datenreset**                          |
| `start-local-test.ps1`                         | Ja, leichter Start nur für TCP/TCC/TAG-App ohne Cloudflare-API        |
| `reset-local-test.ps1`                         | Ja, vollständiger Reset inklusive MySQL                               |
| `test-local-test.ps1` / `npm run local:test` | Ja, TCP-/MySQL-Testlauf                                                |
| `deploy-tag-app-docker.ps1`                    | Ja, separater PWA-Preview-/Build-Nachweis                              |
| `test-edge-router.ps1`                         | Ja, unabhängige Edge-Router-Unit-Tests                                |
| `start-codec-worker.ps1`                       | Nur noch optional für Host-Debugging; für Docker nicht erforderlich  |
| `cloudflare-test-data.ps1`                     | Ja, gemeinsame Helferlogik für Start/Reset                            |
| `app-api-smoke.mjs`                            | Ja, wird vom Startskript ausgeführt                                   |

Die älteren Skripte wurden bewusst nicht gelöscht, weil sie einzelne Testpfade weiterhin sinnvoll abdecken. `start-codec-worker.ps1` ist der einzige Kandidat, der künftig als „standalone host debug“ gekennzeichnet bleiben sollte.

---

## Wichtige Hinweise

- Der lokale Docker-Seed verwendet ein **minimales D1-Testschema** über die Bindung des laufenden Workers. Die vollständige produktive Migrations-DDL wird separat durch `database-schema.test.mjs` geprüft.
- `workers/app-api.local.ts` und `workers/local-seed.ts` werden nur von der lokalen Wrangler-Konfiguration verwendet. Die Produktionskonfiguration `wrangler.app-api.toml` und der Produktions-Worker bleiben unverändert.
- Die PWA-Preview bleibt separat:

```powershell
.\test\00-Test-Scripts\deploy-tag-app-docker.ps1
```

- Es wurde kein Remote-D1-/R2-/KV-Deployment und keine reale Cloudflare-Mutation ausgeführt.

### Validierung

- vollständiger Docker-Start erfolgreich
- API-Smoke erfolgreich: Public-Session, D1/R2-Content, Item-Mitgliedschaft, fail-closed Media Signer
- Edge-Router-Smoke erfolgreich: `302` mit signiertem Bootstrap
- Reset-Skript erfolgreich getestet
- **73 Router-Tests** und **31 TAG-App-Tests** grün
- `npm run build` erfolgreich
- lokaler Wrangler-Dry-Run der `app-api.local.ts` erfolgreich
- `git diff --check` ohne Befund
