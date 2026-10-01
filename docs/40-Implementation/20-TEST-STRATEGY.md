# Teststrategie

## Ziel

Die Tests belegen, dass der Edge-Worker nur valide Tags auflöst, die festgelegte Priorität für Feature-Zuweisungen anwendet und Redirect-Ziele ausschließlich aus kontrollierter KV-Konfiguration erzeugt.

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
- Prüfung des finalen Redirect-Ziels.

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

Das KV-Testdouble protokolliert Keys. Dadurch lässt sich nachweisen, dass ungültige 8-stellige HMACs keinen KV-Lookup auslösen.

### 3. Sicherheits- und Negativtests

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
- relatives, `javascript:`- oder `data:`-Redirect-Ziel.

### 4. Deterministische Testvektoren

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
```

Bei Fehlern wird kein Status auf `verified` gesetzt. Für eine spätere Cloudflare-spezifische End-to-End-Prüfung können Miniflare- oder `wrangler dev`-Tests ergänzt werden; sie ersetzen die deterministischen Vitest-Tests nicht.
