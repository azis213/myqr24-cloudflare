# Testfallkatalog

Lokale Testfälle werden automatisiert in Vitest umgesetzt; ihre Kennungen werden in Testnamen oder Testkommentaren wiederverwendet. Die als **Staging-Live-Test** gekennzeichneten Fälle prüfen den deployten Cloudflare-Worker und benötigen zur autorisierten Ausführung lokal bereitgestellte, nicht protokollierte Secrets. Sie werden ohne Secret-Werte, erzeugte TAG-IDs oder reale Kundendaten als Betriebsnachweis dokumentiert.

## URL und HTTP-Verhalten

| ID | Story | Setup / Eingabe | Erwartetes Ergebnis |
| --- | --- | --- | --- |
| TC-URL-001 | US-001 | `https://p.qr4.uk/t/Ab12Cd` | Tag-ID `ab12cd`, Länge 6 |
| TC-URL-002 | US-001 | `https://p.myqr24.com/t/Ab12Cd34` | Tag-ID `ab12cd34`, Länge 8 |
| TC-URL-003 | US-001 | `https://p.qr4.uk/t/Ab12Cd34Ef` | Tag-ID `ab12cd34ef`, Länge 10 |
| TC-URL-004 | US-001/US-002 | Falscher Host, falscher Pfad, Zusatzsegment, falsche Länge oder ungültiges Alphabet | `404` |
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
| TC-CRYPTO-003 | US-003 | 10-stelliger Testvektor | Decodierter Wert liegt in `I(10)` |
| TC-CRYPTO-004 | US-003 | Werte unterhalb der kanonischen Untergrenze | Kein kanonischer Tag-Wert |
| TC-CRYPTO-005 | US-003 | Base36-Parsing sehr großer Wert | Verlustfreie `BigInt`-Verarbeitung |
| TC-ID-001 | US-004 | Gültige 6-, 8- und 10-stellige Feistel-Testvektoren | Jeder vollständige `decodedValue` wird ohne Prüfnibble geliefert |
| TC-ID-002 | US-004 | Vollständiger 8- oder 10-stelliger Wert in passender Range | Vollständiger Integer wird unverändert als Range-Key verwendet |
| TC-ID-003 | US-004 | 8- oder 10-stelliger Wert ohne Slot-Ausrichtung | Bei kanonischem Feistel-Wert erfolgt die normale Auflösung; keine zusätzliche Ablehnung |
| TC-ID-004 | US-004 | Fehlgeschlagener Feistel-/Cycle-Walk-Fall mit KV-Spy | `404`, keine KV-Leseoperation |

## Private Codec-API

| ID | Story | Setup / Eingabe | Erwartetes Ergebnis |
| --- | --- | --- | --- |
| TC-CODEC-001 | CP-US-011 | Authentisierter `POST /api/v1/codec/encode` für kanonischen 6-stelligen Wert, anschließend `decode` | Lowercase-ID, feste `codecVersion` sowie identischer vollständiger Wert im Encode-/Decode-Roundtrip |
| TC-CODEC-002 | CP-US-011 | Authentisierter 8-stelliger Encode für kanonischen Wert, anschließend `decode` | Lowercase-ID, feste `codecVersion` sowie identischer vollständiger Wert im Encode-/Decode-Roundtrip |
| TC-CODEC-003 | CP-US-011 | Authentisierter 10-stelliger Encode für kanonischen Wert, anschließend `decode` | Lowercase-ID, feste `codecVersion` sowie identischer vollständiger Wert im Encode-/Decode-Roundtrip |
| TC-CODEC-004 | CP-BLK-005 | Unbekannter Pfad, `GET` oder fehlender Bearer-Key | `404`, `405` mit `Allow: POST` bzw. neutrale `401`; keine CORS-Freigabe |
| TC-CODEC-005 | CP-US-011 | Nicht-JSON, Schemafehler, nichtkanonischer 6-/8-/10-stelliger Wert oder ungültige ID | Neutrale `400 {"error":{"code":"invalid_request"}}` ohne Kryptografiedetails |
| TC-CODEC-006 | CP-US-011 | Authentisierter `POST /api/v1/codec/encode-batch` mit je 1.000 kanonischen 6-, 8- oder 10-stelligen Werten | genau 1.000 geordnete Ergebnisse; jeder Wert, Länge und jede `codecVersion` stimmen zur Eingabe bzw. Worker-Umgebung |
| TC-CODEC-007 | CP-US-011 | Batch mit 0, mehr als 1.000 oder doppelten Werten sowie einem nichtkanonischen Wert | vollständige neutrale `400`-Ablehnung ohne Teilergebnis |
| TC-CODEC-008 | CP-BLK-005 | Body oberhalb des jeweiligen Single-/Batch-Limits, Browser-Origin oder Browser-Credentials | fail-closed ohne CORS; weder Service-Key noch Codec-Response sind für Browser verwendbar |

## Codec-Staging-Live-Tests

| ID | Story | Setup / Eingabe | Erwartetes Ergebnis |
| --- | --- | --- | --- |
| TC-CODEC-STAGING-001 | CP-BLK-005 | Nicht autorisierter `POST` und `GET` auf `https://internal.s.myqr24.com/api/v1/codec/encode` | `POST` liefert neutrale `401`-Antwort mit `Cache-Control: no-store`, `X-Content-Type-Options: nosniff` und ohne CORS-Freigabe; `GET` liefert `405` mit `Allow: POST`. |
| TC-CODEC-STAGING-002 | CP-US-011 | Autorisierter `POST /encode`, anschließend autorisierter `POST /decode` für einen künstlichen kanonischen 6-stelligen Wert | Beide Requests liefern `200 OK`; Länge und decodierter Wert entsprechen dem ursprünglichen Eingabewert. |
| TC-CODEC-STAGING-003 | CP-US-011 | Autorisierter `POST /encode`, anschließend autorisierter `POST /decode` für einen künstlichen kanonischen 8-stelligen Wert | Beide Requests liefern `200 OK`; Länge und decodierter Wert entsprechen dem ursprünglichen Eingabewert. |
| TC-CODEC-STAGING-004 | CP-US-011 | Autorisierter `POST /encode`, anschließend autorisierter `POST /decode` für einen künstlichen kanonischen 10-stelligen Wert | Beide Requests liefern `200 OK`; Länge, `codecVersion` und decodierter Wert entsprechen dem ursprünglichen Eingabewert. |
| TC-CODEC-STAGING-005 | CP-US-011/CP-BLK-005 | Autorisierter `POST /encode-batch` mit 1.000 künstlichen kanonischen Werten | `200 OK`; geordnete vollständige Antwort mit identischer Länge, Werten und `codecVersion`; keine Cloudflare- oder TCP-Secrets in Nachweis oder Antwort. |
| TC-CODEC-STAGING-006 | CP-BLK-005 | Kontrollierter Routenwechsel vom abzulösenden `codec.s.myqr24.com/api/v1/*` zu `internal.s.myqr24.com/api/v1/codec/*` | nur neue Internal-Route ist aktiviert; WAF-/Rate-Limit-/Access-Grenzen und erneute 6/8/10-Roundtrips sind redigiert nachgewiesen. |

## Range-Index

| ID | Story | Setup / Eingabe | Erwartetes Ergebnis |
| --- | --- | --- | --- |
| TC-RANGE-001 | US-005 | Aktive Range mit passendem Wert und passender Länge | Range wird gefunden |
| TC-RANGE-002 | US-005 | Inaktive passende Range | `404` |
| TC-RANGE-003 | US-005 | Passender Zahlenwert, aber andere Range-Länge | kein Treffer |
| TC-RANGE-004 | US-005 | Überlappende, unsortierte oder syntaktisch ungültige Ranges | kompletter Index fail-closed |
| TC-RANGE-005 | US-005 | Aktive lineare 8- oder 10-stellige Range ohne Slotgrenzen | passender vollständiger Integer wird gefunden |

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
| TC-FEATURE-002 | US-007 | Valides aktives JSON-Feature | Feature wird validiert; ohne Redirect folgt Pages-Default |
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
| TC-RESPONSE-001 | US-009 | Aktives Nicht-Redirect-Feature | `302` auf kanonische Pages-URL mit identischer `tagId`, kein TAG-HTML/JSON |
| TC-RESPONSE-002 | US-009 | Pages-Default mit `GET` | kein Body und kein Cache-Leak |
| TC-RESPONSE-003 | US-009 | Mehrere Features, erster aktiver Redirect | Redirect gewinnt gegenüber Pages-Default |
| TC-RESPONSE-004 | US-002/US-009 | Valider `HEAD` auf Feature-Zuweisung | Pages-Status `302`, kein Body |
| TC-PAGES-001 | US-009 | HTTP, falscher Pfad, Query, mehrfacher/falscher Token im Pages-Template | fail-closed `null`/404; nur kanonisches HTTPS `/tag/{tagId}` wird akzeptiert |

## Evidenz

| ID | Story | Ausführung | Erwartetes Ergebnis |
| --- | --- | --- | --- |
| TC-EVIDENCE-001 | US-010 | `npm test` | Alle oben genannten automatisierten Tests erfolgreich |
| TC-EVIDENCE-002 | US-010 | `npm run build` | TypeScript-/Scan-Worker-Build erfolgreich |
| TC-EVIDENCE-003 | CP-US-011/CP-BLK-005 | `npm run build:codec` | TypeScript-/Codec-Worker-Build erfolgreich |
