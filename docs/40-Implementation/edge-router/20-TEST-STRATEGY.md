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
- kanonische Grenzen `I(6)`, `I(8)` und `I(10)`;
- Feistel-/Cycle-Walk-Verhalten für alle unterstützten Längen;
- globale Range-Index-Validierung und binäre Range-Suche;
- Validierung von Feature-Zuweisungen und Feature-Dokumenten;
- Template-Placeholder-Prüfung und Rendering;
- Prüfung des finalen Redirect-Ziels;
- gemeinsame Feistel-Codec-Funktionen für Scan- und Codec-Worker;
- private Codec-API für 6-, 8- und 10-stellige Encode-/Decode-Roundtrips;
- nächste Codec-Welle: `codecVersion`, 1.000er-Batch-Encode, Body-Limits, Reihenfolgetreue und browserfreie Internal-API.

### 2. Worker-Integrationstests

Integrationstests rufen `handleRequest` mit einem In-Memory-`KVNamespace` auf und prüfen die gesamte Kette:

```text
Request
→ URL-Extraktion
→ Decodierung
→ Range-Index
→ Tag-/Range-/Gruppen-Zuweisung
→ Feature-Lookup
→ Redirect oder JSON-Aktionsantwort
```

Der private Codec-Worker wird unabhängig mit direkten `handleCodecRequest`-Aufrufen geprüft. Er besitzt weder KV- noch Redirect-Signing-Bindings und akzeptiert ausschließlich authentisierte `POST`-Anfragen an die festgelegten Codec-Pfade.

### 3. Cloudflare-Staging-End-to-End-Tests

Der bestehende Staging-Slice ist über die abzulösende Route erreichbar:

```text
https://codec.s.myqr24.com/api/v1/tag-codec
```

Die nächste kontrollierte Deployment-Welle migriert auf die symmetrische Internal-Grenze:

```text
https://internal.s.myqr24.com/api/v1/codec
https://internal.p.myqr24.com/api/v1/codec
```

Bis zum erfolgreichen Routenwechsel bleibt die alte Route historische Betriebsreferenz; neue Batch- oder Browser-Annahmen dürfen daraus nicht abgeleitet werden.

Diese Prüfungen sind bewusst keine Vitest-Fälle, weil sie DNS, TLS, die Cloudflare-Route und nicht auslesbare Runtime-Secrets voraussetzen. Sie verwenden einen lokal bereitgestellten Bearer-Key ausschließlich im Arbeitsspeicher; weder Secret-Werte noch erzeugte öffentliche TAG-IDs oder reale Kundendaten dürfen ausgegeben oder versioniert werden.

Nach jedem Deployment oder Secret-Wechsel werden mindestens geprüft:

- nicht autorisierter `POST` auf `encode` mit neutralem `401`, `Cache-Control: no-store` und ohne CORS-Freigabe;
- `GET` auf `encode` mit `405` und `Allow: POST`;
- autorisierter 6-stelliger Encode-/Decode-Roundtrip gegen den ursprünglichen kanonischen Eingabewert;
- autorisierter 8-stelliger Encode-/Decode-Roundtrip gegen den ursprünglichen kanonischen Eingabewert;
- autorisierter 10-stelliger Encode-/Decode-Roundtrip gegen den ursprünglichen kanonischen Eingabewert.

Vor Abschluss der nächsten Codec-Welle werden zusätzlich geprüft:

- die neue Staging-Internal-Route `internal.s.myqr24.com/api/v1/codec/*` mit denselben Auth-/Methoden-/No-CORS-Grenzen;
- ein authentisierter `encode-batch`-Roundtrip mit genau 1.000 künstlichen Werten, geordneter Response und fester `codecVersion`;
- neutraler Fehler für 0, mehr als 1.000, doppelte oder nichtkanonische Batch-Werte sowie für übergroße Bodies;
- dass kein Browser-Origin, keine Browser-Session und keine SPA Zugriff auf den Internal-Codec oder einen dauerhaften Codec-Service-Key erhält;
- die deaktivierte alte Route erst nach erfolgreichem neuen Internal-Route-, WAF-/Rate-Limit-/Access- und 6/8/10-Staging-Nachweis.

Die Ausführung wird ohne sensitive Daten in [`../evidence/README.md`](../evidence/README.md) dokumentiert.

### 4. Sicherheits- und Negativtests

Für jede fail-closed Grenze existiert mindestens ein Negativtest:

- ungültiger Host, Pfad oder Base36-Wert;
- nicht erlaubte HTTP-Methode;
- Feistel-/Cycle-Walk-Fehler;
- ungültiger, überlappender oder längenfalscher Range-Index;
- fehlende/inaktive Range;
- fehlende oder fehlerhafte Zuweisung;
- fehlendes/deaktiviertes/ungültiges Feature;
- unbekannter oder nicht verfügbarer Template-Platzhalter;
- relatives, `javascript:`- oder `data:`-Redirect-Ziel;
- fehlender API-Key, unbekannter Codec-Pfad oder falsche HTTP-Methode;
- ungültiger JSON-Body, nichtkanonischer Wert oder nicht unterstützte ID-Länge;
- browserseitige CORS-Freigabe, Browser-Session oder Browser-Service-Key am privaten Codec-Endpunkt;
- Batch mit 0, mehr als 1.000, doppelten oder nichtkanonischen Werten sowie Batch-Body oberhalb des Limits.

### 5. Deterministische Testvektoren

Alle kryptografischen und vollständigen Request-Tests verwenden feste, nicht geheime Test-Secrets. Fixtures speichern:

- kanonische vollständige Integer;
- erzeugte öffentliche Test-Tag-IDs;
- vollständige lineare kanonische Werte für 6, 8 und 10 Stellen;
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

Tests prüfen Verhalten, nicht interne Implementierungsdetails. Sie vergleichen jedoch für alle drei Längen explizit den vollständigen linearen kanonischen Integer vor und nach dem Codec-Roundtrip.

## Ausführungsreihenfolge

```sh
npm test
npm run build
npm run build:codec
```

Bei Fehlern wird kein Status auf `verified` gesetzt. Die dokumentierten Cloudflare-Staging-End-to-End-Tests ergänzen die deterministischen Vitest-Tests, ersetzen sie aber nicht. Miniflare- oder `wrangler dev`-Tests können zusätzlich ergänzt werden.
