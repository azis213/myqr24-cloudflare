# Evidenz

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
| `npm run build` erfolgreich | Der TypeScript-Worker kann mit der aktuellen Konfiguration gebaut werden |

## Dokumentation eines Durchlaufs

Nach einer erfolgreichen Implementierungsrunde werden in `STATUS.md` und `30-TRACEABILITY.md` die relevanten Arbeitspakete und Stories auf `verified` gesetzt.

### Verifizierter lokaler Durchlauf — 2026-09-30

| Befehl | Ergebnis |
| --- | --- |
| `npm test` | Erfolgreich: 1 Testdatei, 38 Tests bestanden |
| `npm run build` | Erfolgreich: `tsc --noEmit` und `wrangler deploy --dry-run --outdir dist` abgeschlossen |
| Wrangler-Dry-Run | Kein Deployment durchgeführt; Bundle: 18.05 KiB (gzip: 4.79 KiB) |

Der Dry-Run meldet aktuell keine Bindings, da die reale Cloudflare-KV-Namespace-ID bewusst nicht als Platzhalter in `wrangler.toml` hinterlegt wird. Vor dem ersten Deployment muss die auskommentierte `TAG_CONFIG`-KV-Bindung mit einer echten Namespace-ID aktiviert und die Secrets `FEISTEL_SECRET`, `TAG_HMAC_SECRET` sowie `REDIRECT_SIGNING_SECRET` gesetzt werden.

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
