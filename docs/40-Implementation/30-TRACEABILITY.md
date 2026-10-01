# Traceability Matrix

| Story | Akzeptanzschwerpunkt | Testfälle | Testdaten | Zielcode | Status |
| --- | --- | --- | --- | --- | --- |
| US-001 | Zulässige öffentliche URLs und Normalisierung | TC-URL-001 bis TC-URL-003 | `edge-routing.json` | `extractTagRequest` | verified |
| US-002 | Einheitlich fail-closed, HTTP-Methoden und HEAD | TC-URL-003, TC-HTTP-001, TC-HTTP-002, TC-RESPONSE-004 | In-Memory-KV mit Fehlerfällen | `handleRequest`, `notFound` | verified |
| US-003 | Kanonische Längenräume und `BigInt` | TC-CRYPTO-001 bis TC-CRYPTO-004 | deterministische Testsecrets und Vektoren | `parseBase36`, `decodeFeistel`, `formatBase36` | verified |
| US-004 | HMAC über maskierte Basis; vollständiger Range-Key | TC-HMAC-001 bis TC-HMAC-004 | Achtstellenvektoren, KV-Spy | `calculateHmacNibble`, `decodeTagId` | verified |
| US-005 | Aktive, length-gebundene, nicht überlappende Ranges | TC-RANGE-001 bis TC-RANGE-005 | valide und fehlerhafte Range-Indizes | `isValidRangeIndex`, `findRange` | verified |
| US-006 | Priorität Tag → Range → Gruppe | TC-RULE-001 bis TC-RULE-006 | Tag-, Range- und Gruppen-Zuweisungen | `resolveTag` | verified |
| US-007 | Wiederverwendbare `feature:{featureId}`-Dokumente | TC-FEATURE-001 bis TC-FEATURE-005 | Feature-Fixtures | `resolveFeatures`, `isTagFeature` | verified |
| US-008 | Sichere Redirect-Templates | TC-TEMPLATE-001 bis TC-TEMPLATE-006 | Redirect- und Fehlerfixtures | `renderTemplate`, `toSafeRedirect` | verified |
| US-009 | JSON-Aktionsantwort | TC-RESPONSE-001 bis TC-RESPONSE-004 | JSON-Feature-Fixture | `jsonActionResponse`, `handleRequest` | verified |
| US-010 | Reproduzierbare Evidenz | TC-EVIDENCE-001 bis TC-EVIDENCE-002 | keine produktiven Daten | `package.json`, `test/worker.test.ts`, Dokumentation | verified |

## Zuordnung zu Arbeitspaketen

| Arbeitspaket | Stories | Zieltestdatei |
| --- | --- | --- |
| WP-02 | US-003 | `test/worker.test.ts` |
| WP-03 | US-004 | `test/worker.test.ts` |
| WP-04 | US-005 | `test/worker.test.ts` |
| WP-05 | US-006 | `test/worker.test.ts` |
| WP-06 | US-007 | `test/worker.test.ts` |
| WP-07 | US-008 | `test/worker.test.ts` |
| WP-08 | US-001, US-002, US-009 | `test/worker.test.ts` |
| WP-09 | US-010 | `npm test`, `npm run build` |

## Pflege

Nach erfolgreicher Umsetzung wird pro Zeile:

1. `Zielcode` auf konkrete exportierte Funktionen bzw. Testabschnitte präzisiert;
2. der Status auf `implemented` gesetzt;
3. erst nach erfolgreichem `npm test` und `npm run build` auf `verified` gesetzt;
4. die Ausführung in [`evidence/README.md`](./evidence/README.md) aktualisiert.
