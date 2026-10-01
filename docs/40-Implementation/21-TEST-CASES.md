# Testfallkatalog

Jeder Testfall wird automatisiert in Vitest umgesetzt. Die Kennungen werden in Testnamen oder Testkommentaren wiederverwendet.

## URL und HTTP-Verhalten

| ID | Story | Setup / Eingabe | Erwartetes Ergebnis |
| --- | --- | --- | --- |
| TC-URL-001 | US-001 | `https://qx4.uk/Ab12Cd` | Tag-ID `ab12cd`, Länge 6 |
| TC-URL-002 | US-001 | `https://p.myqr24.com/t/Ab12Cd34` | Tag-ID `ab12cd34`, Länge 8 |
| TC-URL-003 | US-001/US-002 | Falscher Host, falscher Pfad, Zusatzsegment, falsche Länge oder ungültiges Alphabet | `404` |
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
| TC-EVIDENCE-002 | US-010 | `npm run build` | TypeScript-/Worker-Build erfolgreich |
