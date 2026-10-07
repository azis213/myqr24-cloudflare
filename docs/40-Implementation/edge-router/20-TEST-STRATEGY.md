# Teststrategie

## Ziel

Die Tests belegen, dass der Scan-Worker nur valide Tags auflöst, die festgelegte Priorität für Feature-Zuweisungen anwendet und Redirect-Ziele ausschließlich aus kontrollierter KV-Konfiguration erzeugt. Zusätzlich belegen sie den getrennten privaten Codec-Worker für authentisierte Einzeloperationen zur TAG-Erzeugung und -Prüfung.

Primäre maschinelle Evidenz:

```sh
npm test
npm run build
```

## Testebenen

### 1. Unit-Tests

Unit-Tests prüfen reine oder gezielt isolierte Funktionen:

- öffentliche URL-Extraktion und Base36-Parsing;
- kanonische Grenzen `I(6)` und `I(8)`;
- Feistel-/Cycle-Walk-Verhalten;
- HMAC-Nibble über der maskierten Basis;
- globale Range-Index-Validierung und binäre Range-Suche;
- Validierung von Feature-Zuweisungen und Feature-Dokumenten;
- Template-Placeholder-Prüfung und Rendering;
- Prüfung des finalen Redirect-Ziels;
- gemeinsame Feistel-/HMAC-Codec-Funktionen für Scan- und Codec-Worker;
- private Codec-API für 6- und 8-stellige Encode-/Decode-Roundtrips.

### 2. Worker-Integrationstests

Integrationstests rufen `handleRequest` mit einem In-Memory-`KVNamespace` auf und prüfen die gesamte Kette:

```text
Request
→ URL-Extraktion
→ Decodierung
→ HMAC-Prüfung
→ Range-Index
→ Tag-/Range-/Gruppen-Zuweisung
→ Feature-Lookup
→ Redirect oder JSON-Aktionsantwort
```

Der private Codec-Worker wird unabhängig mit direkten `handleCodecRequest`-Aufrufen geprüft. Er besitzt weder KV- noch Redirect-Signing-Bindings und akzeptiert ausschließlich authentisierte `POST`-Anfragen an die festgelegten Codec-Pfade.

Das KV-Testdouble protokolliert Keys. Dadurch lässt sich nachweisen, dass ungültige 8-stellige HMACs keinen KV-Lookup auslösen.

### 3. Cloudflare-Staging-End-to-End-Tests

Die private Staging-Route wird zusätzlich gegen den tatsächlich bereitgestellten Worker geprüft:

```text
https://codec.s.myqr24.com/api/v1/tag-codec
```

Diese Prüfungen sind bewusst keine Vitest-Fälle, weil sie DNS, TLS, die Cloudflare-Route und nicht auslesbare Runtime-Secrets voraussetzen. Sie verwenden einen lokal bereitgestellten Bearer-Key ausschließlich im Arbeitsspeicher; weder Secret-Werte noch erzeugte öffentliche TAG-IDs oder reale Kundendaten dürfen ausgegeben oder versioniert werden.

Nach jedem Deployment oder Secret-Wechsel werden mindestens geprüft:

- nicht autorisierter `POST` auf `encode` mit neutralem `401`, `Cache-Control: no-store` und ohne CORS-Freigabe;
- `GET` auf `encode` mit `405` und `Allow: POST`;
- autorisierter 6-stelliger Encode-/Decode-Roundtrip gegen den ursprünglichen kanonischen Eingabewert;
- autorisierter 8-stelliger HMAC-geschützter Encode-/Decode-Roundtrip gegen den ursprünglichen kanonischen Eingabewert.

Die Ausführung wird ohne sensitive Daten in [`../evidence/README.md`](../evidence/README.md) dokumentiert.

### 4. Sicherheits- und Negativtests

Für jede fail-closed Grenze existiert mindestens ein Negativtest:

- ungültiger Host, Pfad oder Base36-Wert;
- nicht erlaubte HTTP-Methode;
- Feistel-/Cycle-Walk-Fehler;
- ungültiges 8-stelliges HMAC-Nibble;
- ungültiger, überlappender oder längenfalscher Range-Index;
- fehlende/inaktive Range;
- fehlende oder fehlerhafte Zuweisung;
- fehlendes/deaktiviertes/ungültiges Feature;
- unbekannter oder nicht verfügbarer Template-Platzhalter;
- relatives, `javascript:`- oder `data:`-Redirect-Ziel;
- fehlender API-Key, unbekannter Codec-Pfad oder falsche HTTP-Methode;
- ungültiger JSON-Body, nichtkanonischer Wert und nicht ausgerichtete achtstellige Basis;
- browserseitige CORS-Freigabe am privaten Codec-Endpunkt.

### 5. Deterministische Testvektoren

Alle kryptografischen und vollständigen Request-Tests verwenden feste, nicht geheime Test-Secrets. Fixtures speichern:

- kanonische vollständige Integer;
- erzeugte öffentliche Test-Tag-IDs;
- den 8-stelligen HMAC-Slot samt korrektem Nibble;
- erwartete gerenderte Redirect-Ziele.

Testvektoren werden erst nach erfolgreicher Testausführung als stabil betrachtet. Produktive Secrets oder reale Tags sind verboten.

## Fixture-Regeln

Ausführbare Fixtures befinden sich unter:

```text
test/fixtures/
```

- JSON-Werte für Integer werden als dezimale Strings gespeichert.
- `BigInt` entsteht erst im Test oder Worker durch explizites Parsing.
- Jede Fixture besitzt einen sprechenden Dateinamen und wird in `22-TEST-DATA.md` beschrieben.
- Jede Änderung an einem Fixture erfordert die Prüfung der zugehörigen Testfälle und Traceability Matrix.

## Abdeckung und Regression

Jeder Fehlerfund führt zu:

1. einem neuen oder erweiterten Testfall mit stabiler `TC-*`-ID;
2. falls nötig neuen Testdaten;
3. einer Verknüpfung in `30-TRACEABILITY.md`;
4. einer Aktualisierung von `STATUS.md`.

Tests prüfen Verhalten, nicht interne Implementierungsdetails, mit zwei bewussten Ausnahmen:

- Der HMAC-Negativtest prüft, dass **kein** KV-Key gelesen wird.
- Tests für komplette Integer prüfen explizit, dass bei 8-stelligen Tags der HMAC-Nibble Teil des Range-Keys bleibt.

## Ausführungsreihenfolge

```sh
npm test
npm run build
npm run build:codec
```

Bei Fehlern wird kein Status auf `verified` gesetzt. Die dokumentierten Cloudflare-Staging-End-to-End-Tests ergänzen die deterministischen Vitest-Tests, ersetzen sie aber nicht. Miniflare- oder `wrangler dev`-Tests können zusätzlich ergänzt werden.
