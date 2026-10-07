# Testfallkatalog

Lokale Testfälle werden automatisiert in Vitest umgesetzt; ihre Kennungen werden in Testnamen oder Testkommentaren wiederverwendet. Die als **Staging-Live-Test** gekennzeichneten Fälle prüfen den deployten Cloudflare-Worker und benötigen zur autorisierten Ausführung lokal bereitgestellte, nicht protokollierte Secrets. Sie werden ohne Secret-Werte, erzeugte TAG-IDs oder reale Kundendaten als Betriebsnachweis dokumentiert.

## URL und HTTP-Verhalten

| ID | Story | Setup / Eingabe | Erwartetes Ergebnis |
| --- | --- | --- | --- |
| TC-URL-001 | US-001 | `https://p.qr4.uk/t/Ab12Cd` | Tag-ID `ab12cd`, Länge 6 |
| TC-URL-002 | US-001 | `https://p.myqr24.com/t/Ab12Cd34` | Tag-ID `ab12cd34`, Länge 8 |
| TC-URL-003 | US-001/US-002 | Falscher Host, falscher Pfad, Zusatzsegment, falsche Länge oder ungültiges Alphabet | `404` |
| TC-HOME-001 | US-001/US-002 | `GET /` auf jedem erlaubten Scan-Host in seiner Umgebung | `302`, `Location: https://www.myqr24.com/` |
| TC-HOME-002 | US-002 | `HEAD /?source=bot` auf erlaubtem Scan-Host | `302`, leerer Body; Query-Parameter nicht im `Location`-Header |
| TC-HOME-003 | US-001/US-002 | `GET /` auf Apex, fremdem oder umgebungsfremdem Host | `404` |
| TC-HOME-004 | US-001/US-002 | `GET /` auf `www.myqr24.com` im Production-Worker | `200`, statisches HTML, Sicherheitsheader und begrenzte Cache-Policy |
| TC-HOME-005 | US-001/US-002 | `HEAD /`, Staging-Request oder zusätzlicher Pfad auf `www.myqr24.com` | leerer `200`-Body nur für `HEAD /`; sonst `404` |
| TC-HTTP-001 | US-002 | `POST` auf gültige URL | `405`, Header `Allow: GET, HEAD` |
| TC-HTTP-002 | US-002/US-009 | Valider `HEAD`-Request | korrekter Status, leerer Body |

## Kryptografie und kanonische Räume

| ID | Story | Setup / Eingabe | Erwartetes Ergebnis |
| --- | --- | --- | --- |
| TC-CRYPTO-001 | US-003 | 6-stelliger Testvektor | Decodierter Wert liegt in `I(6)` |
| TC-CRYPTO-002 | US-003 | 8-stelliger Testvektor | Decodierter Wert liegt in `I(8)` |
| TC-CRYPTO-003 | US-003 | Werte unterhalb der kanonischen Untergrenze | Kein kanonischer Tag-Wert |
| TC-CRYPTO-004 | US-003 | Base36-Parsing sehr großer Wert | Verlustfreie `BigInt`-Verarbeitung |
| TC-HMAC-001 | US-004 | Gültiger 8-stelliger Vektor | Vollständiger `decodedValue` inklusive Nibble wird geliefert |
| TC-HMAC-002 | US-004 | Gleiche Basis mit manipuliertem Nibble | `null` bzw. Edge-`404` |
| TC-HMAC-003 | US-004 | Ungültiger HMAC-Request mit KV-Spy | `404`, keine KV-Leseoperation |
| TC-HMAC-004 | US-004 | Gültiger 8-stelliger Wert in Range | vollständiger Integer wird als Range-Key verwendet |

## Private Codec-API

| ID | Story | Setup / Eingabe | Erwartetes Ergebnis |
| --- | --- | --- | --- |
| TC-CODEC-001 | CP-US-011 | Authentisierter `POST /api/v1/tag-codec/encode` für kanonischen 6-stelligen Wert, anschließend `decode` | Lowercase-ID sowie identischer vollständiger Wert im Encode-/Decode-Roundtrip |
| TC-CODEC-002 | CP-US-011/CP-US-013 | Authentisierter 8-stelliger Encode mit kanonischer, durch 16 teilbarer Basis, anschließend `decode` | HMAC-geschützte 8-stellige ID; Decode liefert vollständigen Wert inklusive Nibble |
| TC-CODEC-003 | CP-BLK-005 | Unbekannter Pfad, `GET` oder fehlender Bearer-Key | `404`, `405` mit `Allow: POST` bzw. neutrale `401`; keine CORS-Freigabe |
| TC-CODEC-004 | CP-US-011/CP-US-013 | Nicht-JSON, Schemafehler, nichtkanonischer 6-stelliger Wert, nicht ausgerichtete 8-stellige Basis oder ungültige ID | Neutrale `400 {"error":{"code":"invalid_request"}}` ohne Kryptografiedetails |

## Codec-Staging-Live-Tests

| ID | Story | Setup / Eingabe | Erwartetes Ergebnis |
| --- | --- | --- | --- |
| TC-CODEC-STAGING-001 | CP-BLK-005 | Nicht autorisierter `POST` und `GET` auf `https://codec.s.myqr24.com/api/v1/tag-codec/encode` | `POST` liefert neutrale `401`-Antwort mit `Cache-Control: no-store`, `X-Content-Type-Options: nosniff` und ohne CORS-Freigabe; `GET` liefert `405` mit `Allow: POST`. |
| TC-CODEC-STAGING-002 | CP-US-011 | Autorisierter `POST /encode`, anschließend autorisierter `POST /decode` für einen künstlichen kanonischen 6-stelligen Wert | Beide Requests liefern `200 OK`; Länge und decodierter Wert entsprechen dem ursprünglichen Eingabewert. |
| TC-CODEC-STAGING-003 | CP-US-011/CP-US-013 | Autorisierter `POST /encode`, anschließend autorisierter `POST /decode` für eine künstliche kanonische, durch 16 teilbare 8-stellige Basis | Beide Requests liefern `200 OK`; Länge und HMAC-validierter decodierter Wert entsprechen dem ursprünglichen Eingabewert. |

## Range-Index

| ID | Story | Setup / Eingabe | Erwartetes Ergebnis |
| --- | --- | --- | --- |
| TC-RANGE-001 | US-005 | Aktive Range mit passendem Wert und passender Länge | Range wird gefunden |
| TC-RANGE-002 | US-005 | Inaktive passende Range | `404` |
| TC-RANGE-003 | US-005 | Passender Zahlenwert, aber andere Range-Länge | kein Treffer |
| TC-RANGE-004 | US-005 | Überlappende, unsortierte oder syntaktisch ungültige Ranges | kompletter Index fail-closed |
| TC-RANGE-005 | US-005 | Achtstellige Range nicht auf Slotgrenzen ausgerichtet | kompletter Index fail-closed |

## Zuweisungspriorität

| ID | Story | Setup / Eingabe | Erwartetes Ergebnis |
| --- | --- | --- | --- |
| TC-RULE-001 | US-006 | Tag-, Range- und Gruppen-Zuweisung vorhanden | Tag-`featureIds` gewinnen |
| TC-RULE-002 | US-006 | Range- und Gruppen-Zuweisung vorhanden | Range-`featureIds` gewinnen |
| TC-RULE-003 | US-006 | Nur Gruppen-Zuweisung vorhanden | Gruppen-`featureIds` werden genutzt |
| TC-RULE-004 | US-006 | Tag-Zuweisung ohne Range | `404`; direkte Regel wird nicht geladen |
| TC-RULE-005 | US-006 | Höhere Zuweisung leer | Fallback zur nächsten nicht leeren Ebene |
| TC-RULE-006 | US-006 | Zuweisung mit ungültiger Feature-ID | `404` |

## Feature-Dokumente

| ID | Story | Setup / Eingabe | Erwartetes Ergebnis |
| --- | --- | --- | --- |
| TC-FEATURE-001 | US-007 | Valides aktives Redirect-Feature | Feature wird geladen |
| TC-FEATURE-002 | US-007 | Valides aktives JSON-Feature | JSON-Aktionsantwort |
| TC-FEATURE-003 | US-007 | Fehlendes Feature-Dokument | `404` |
| TC-FEATURE-004 | US-007 | `enabled: false` | `404` |
| TC-FEATURE-005 | US-007 | Falsche ID, Typ oder Struktur | `404` |

## Redirect-Templates

| ID | Story | Setup / Eingabe | Erwartetes Ergebnis |
| --- | --- | --- | --- |
| TC-TEMPLATE-001 | US-008 | Festes HTTPS-`url` | Konfigurierter Redirect und Status |
| TC-TEMPLATE-002 | US-008 | Template mit `{tagId}`, `{decodedValue}`, `{length}`, `{groupId}` | Korrekt gerenderte Redirect-URL |
| TC-TEMPLATE-003 | US-008 | `{tagSignature}` | `404`, solange keine Signaturimplementierung existiert |
| TC-TEMPLATE-004 | US-008 | Unbekannter oder ungeschlossener Platzhalter | `404` |
| TC-TEMPLATE-005 | US-008 | `javascript:`, `data:`, relative URL oder HTTP-Status außerhalb der Allowlist | `404` |
| TC-TEMPLATE-006 | US-008 | Sowohl `url` als auch `urlTemplate`, oder keines von beiden | `404` |

## Response-Format

| ID | Story | Setup / Eingabe | Erwartetes Ergebnis |
| --- | --- | --- | --- |
| TC-RESPONSE-001 | US-009 | Aktives JSON-Feature ohne Redirect | JSON mit Tag, Range, Gruppe und Features |
| TC-RESPONSE-002 | US-009 | Erfolgreiche JSON-Antwort | `Cache-Control: no-store` |
| TC-RESPONSE-003 | US-009 | Mehrere Features, erster aktiver Redirect | Redirect gewinnt gegenüber JSON-Ausgabe |
| TC-RESPONSE-004 | US-002/US-009 | Valider `HEAD` auf Feature-Zuweisung | Kein Body |

## Evidenz

| ID | Story | Ausführung | Erwartetes Ergebnis |
| --- | --- | --- | --- |
| TC-EVIDENCE-001 | US-010 | `npm test` | Alle oben genannten automatisierten Tests erfolgreich |
| TC-EVIDENCE-002 | US-010 | `npm run build` | TypeScript-/Scan-Worker-Build erfolgreich |
| TC-EVIDENCE-003 | CP-US-011/CP-BLK-005 | `npm run build:codec` | TypeScript-/Codec-Worker-Build erfolgreich |
