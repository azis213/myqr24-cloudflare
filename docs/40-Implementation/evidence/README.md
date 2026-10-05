# Evidenz

## Zuordnung der Nachweise

| Bereich | Nachweisstrang | Aktueller Stand |
| --- | --- | --- |
| Edge Router | [`../edge-router/`](../edge-router/) | Worker-Tests, Build und erster öffentlicher Staging-Scan verifiziert |
| TAG-App | [`../tag-app/`](../tag-app/) | Pages-Deploy und öffentlicher Vault-Staging-MVP vorhanden; zusätzliche Browser-/PWA-Nachweise offen |
| Router→TAG-App | [`../tag-app/20-TEST-STRATEGY.md`](../tag-app/20-TEST-STRATEGY.md#6-integrationsstrategie-edge-router--tag-app) | blockiert, bis aktiver Worker und gebundener KV-Namespace eindeutig identifiziert sind |

Ein Nachweis gilt nur für den in der Tabelle angegebenen Strang. Insbesondere bestätigt der bisherige Scan-Redirect nicht die Sichtbarkeits-, Session- oder Feature-Autorisierung der späteren Application API.

## Primäre Evidenz

Die verbindliche technische Evidenz wird lokal oder in CI durch folgende Befehle erzeugt:

```sh
npm test
npm run build
```

Die Befehle müssen im Projekt-Root ausgeführt werden.

| Nachweis | Bedeutung |
| --- | --- |
| `npm test` erfolgreich | Alle automatisierten Unit- und Worker-Integrationstests sind erfolgreich |
| `npm run build` erfolgreich | Der TypeScript-Worker und die Pages-PWA können mit der aktuellen Konfiguration gebaut werden |

## Dokumentation eines Durchlaufs

Nach einer erfolgreichen Implementierungsrunde werden im zugehörigen Strang die relevanten Arbeitspakete und Stories auf `verified` gesetzt:

- Edge Router: [`../edge-router/STATUS.md`](../edge-router/STATUS.md) und [`../edge-router/30-TRACEABILITY.md`](../edge-router/30-TRACEABILITY.md);
- TAG-App: [`../tag-app/STATUS.md`](../tag-app/STATUS.md) und [`../tag-app/30-TRACEABILITY.md`](../tag-app/30-TRACEABILITY.md).

Für den Status `verified` gelten zusätzlich die Regeln der jeweiligen Teststrategie.

### Verifizierter lokaler Durchlauf — 2026-09-30

| Befehl | Ergebnis |
| --- | --- |
| `npm test` | Erfolgreich: 1 Testdatei, 38 Tests bestanden |
| `npm run build` | Erfolgreich: `tsc --noEmit` und `wrangler deploy --dry-run --outdir dist` abgeschlossen |
| Wrangler-Dry-Run | Kein Deployment durchgeführt; Bundle: 18.05 KiB (gzip: 4.79 KiB) |

Der Dry-Run meldet aktuell keine Bindings, da die reale Cloudflare-KV-Namespace-ID bewusst nicht als Platzhalter in `wrangler.toml` hinterlegt wird. Vor dem ersten Deployment muss die auskommentierte `TAG_CONFIG`-KV-Bindung mit einer echten Namespace-ID aktiviert und die Secrets `FEISTEL_SECRET`, `TAG_HMAC_SECRET` sowie `REDIRECT_SIGNING_SECRET` gesetzt werden.

### Verifizierter öffentlicher Staging-Durchlauf — 2026-10-01

Die Staging-Worker-Route auf der kurzen, Cloudflare-proxied Scan-Domain wurde mit einem nicht produktiven, nicht in diesem Repository dokumentierten Testtag geprüft. Das Redirect-Ziel war die eigenständige Cloudflare-Pages-Test-PWA.

| Prüfung | Erwartung | Ergebnis |
| --- | --- | --- |
| Zulässige kurze Scan-URL | `302 Found` mit kurzlebiger Signatur im Redirect-Ziel | bestanden |
| Browser-End-to-End | Worker-Redirect wird verfolgt; PWA zeigt den erfolgreichen Staging-Nachweis | bestanden |
| Unzulässige Pfadform | `404 Not Found` | bestanden |
| Syntaktisch ungültige Tag-ID | `404 Not Found` | bestanden |
| `POST` auf zulässige Scan-URL | `405 Method Not Allowed`, `Allow: GET, HEAD` | bestanden |

Die Prüfung bestätigt die erste öffentliche Staging-Teststrecke über Cloudflare DNS, Cloudflare Workers, Staging-KV und Cloudflare Pages. Die zusätzliche sprechende Scan-Domain sowie die eigene PWA-Custom-Domain bleiben bis zur Dogado-/`myqr24.com`-DNS-Integration ausstehend.

### Verifizierter Staging-PWA-Deploy — 2026-10-02

Die neue öffentliche React-/Vite-PWA wurde in das bestehende Cloudflare-Pages-Projekt `myqr24-staging-test-pwa` deployt. Sie besitzt eine öffentliche Vault-MVP-Ansicht, Pages-SPA-Fallback für `/tag/*` und enthält keine Cloudflare-Secrets, Worker-, KV-, D1- oder R2-Bindings.

| Prüfung | Ergebnis |
| --- | --- |
| `npm test` | Erfolgreich: Router 41/41, Tag-App 3/3 Tests bestanden |
| `npm run build` | Erfolgreich: Staging-Worker-Dry-Run mit `TAG_CONFIG`-Binding und PWA-Produktionsbuild |
| Pages-Deploy | Erfolgreich in `myqr24-staging-test-pwa` |
| Stabile Deployment-Alias-URL | `https://main.myqr24-staging-test-pwa.pages.dev` |
| Direkter Aufruf `/tag/rsq45q` über Pages-Alias | Öffentliche Staging-Vault-Ansicht gerendert |
| Aktive kurze Scan-URL | `302 Found` mit kurzlebiger Signatur auf die weiterhin bestehende frühere Test-PWA |
| Aktiver falscher Pfad | `404 Not Found` |
| Aktive syntaktisch ungültige Tag-ID | `404 Not Found` |

Wichtiger Betriebsbefund: Die lokale Konfiguration bindet den Staging-Namespace `e05d3c9ead4b40b389e0e63db098e87a`; eine reine Schlüsselauflistung dieses Namespace ergab am 2026-10-02 keine Einträge. Die öffentlich aktive Scan-Route liefert gleichzeitig weiterhin einen validen Redirect der vorhandenen Alt-Teststrecke. Der aktive Worker beziehungsweise dessen produktive Redirect-Konfiguration ist daher vor einer KV-Änderung im Cloudflare-Dashboard zu identifizieren. Es darf keine KV-Konfiguration blind überschrieben werden.

Ziel für die kontrollierte Umstellung nach dieser Identifikation:

```text
https://main.myqr24-staging-test-pwa.pages.dev/tag/{tagId}
```

Später ist diese temporäre Pages-Alias-URL durch die Custom Domain `https://app-staging.myqr24.com/tag/{tagId}` zu ersetzen.

Ein Commit, Pull Request oder CI-Lauf kann zusätzlich verlinkt werden. Es ist nicht nötig und nicht erwünscht, laufend flüchtige Terminalausgaben in das Repository zu kopieren.

## Verbotene Inhalte

Evidenzdateien dürfen nicht enthalten:

- produktive Cloudflare-Secrets;
- reale Tag-IDs oder Kundendaten;
- vollständige Produktions-KV-Dumps;
- private Redirect-Ziele;
- Token, Cookies oder Zugangsdaten.

## Fehlernachweis

Scheitert ein Test oder Build:

1. bleibt der Status `planned`, `in-progress` oder `implemented`;
2. wird die Ursache über einen ergänzenden Testfall abgesichert, sofern ein Produktfehler vorliegt;
3. darf die Traceability Matrix nicht als `verified` markiert werden.
