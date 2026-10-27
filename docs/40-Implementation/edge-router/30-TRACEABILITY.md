# Traceability Matrix

| Story | Akzeptanzschwerpunkt | Testfälle | Testdaten | Zielcode | Status |
| --- | --- | --- | --- | --- | --- |
| US-001 | Zulässige öffentliche URLs und Normalisierung | TC-URL-001 bis TC-URL-004, TC-HOME-001, TC-HOME-003 bis TC-HOME-005 | `edge-routing.json` | `extractTagRequest`, `isScanHost`, `isPlatformHomeHost`, `handleRequest` | verified |
| US-002 | Einheitlich fail-closed, HTTP-Methoden und HEAD | TC-URL-004, TC-HOME-001 bis TC-HOME-005, TC-HTTP-001, TC-HTTP-002, TC-RESPONSE-004 | In-Memory-KV mit Fehlerfällen | `handleRequest`, `platformHomeRedirect`, `platformHomeResponse`, `notFound` | verified |
| US-003 | Kanonische Längenräume und `BigInt` | TC-CRYPTO-001 bis TC-CRYPTO-005 | deterministische Testsecrets und Vektoren | `src/codec/index.ts`: `parseBase36`, `decodeFeistel`, `formatBase36` | verified |
| US-004 | HMAC-freie vollständige lineare Range- und Regel-Keys | TC-ID-001 bis TC-ID-004 | 6-/8-/10-Stellenvektoren, KV-Spy | `src/codec/index.ts`: `decodeTagId` | verified |
| US-005 | Aktive, length-gebundene, nicht überlappende Ranges | TC-RANGE-001 bis TC-RANGE-005 | valide und fehlerhafte Range-Indizes | `isValidRangeIndex`, `findRange` | verified |
| US-006 | Priorität Tag → Range → Gruppe | TC-RULE-001 bis TC-RULE-006 | Tag-, Range- und Gruppen-Zuweisungen | `resolveTag` | verified |
| US-007 | Wiederverwendbare `feature:{featureId}`-Dokumente | TC-FEATURE-001 bis TC-FEATURE-005 | Feature-Fixtures | `resolveFeatures`, `isTagFeature` | verified |
| US-008 | Sichere Redirect-Templates | TC-TEMPLATE-001 bis TC-TEMPLATE-006 | Redirect- und Fehlerfixtures | `renderTemplate`, `toSafeRedirect` | verified |
| US-009 | JSON-Aktionsantwort | TC-RESPONSE-001 bis TC-RESPONSE-004 | JSON-Feature-Fixture | `jsonActionResponse`, `handleRequest` | verified |
| US-010 | Reproduzierbare Evidenz | TC-EVIDENCE-001 bis TC-EVIDENCE-003 | keine produktiven Daten | `package.json`, `test/worker.test.ts`, `test/codec-worker.test.ts`, Dokumentation | verified |
| CP-US-011 | Private Erstellung öffentlicher TAG-IDs ohne Codec-Secrets in der Plane | TC-CODEC-001 bis TC-CODEC-005, TC-CODEC-STAGING-002 bis TC-CODEC-STAGING-004 | nicht geheime lokale Testsecrets, künstliche kanonische Staging-Werte | `src/codec/index.ts`, `src/codec-worker.ts`: `handleCodecRequest`, `handleEncode` | implemented |
| CP-US-013 | Poolgrenzen im linearen `decodedValue`-Raum für 6, 8 und 10 Stellen | TC-CODEC-001 bis TC-CODEC-003, TC-CODEC-005, TC-CODEC-STAGING-002 bis TC-CODEC-STAGING-004 | kanonische 6-/8-/10-stellige Werte | `src/codec-worker.ts`: `handleEncode`, `isCanonicalValue` | implemented |
| CP-BLK-005 | Minimal privilegierter privater Codec-Betriebsweg | TC-CODEC-004, TC-EVIDENCE-003, TC-CODEC-STAGING-001 | keine produktiven Daten; nicht auslesbare Staging-Secrets | `wrangler.codec.toml`, `CodecEnv`, `handleCodecRequest`, Cloudflare Custom Route | implemented |

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
| WP-09 | US-010 | `npm test`, `npm run build`, `npm run build:codec` |
| WP-10 | CP-US-011, CP-US-013, CP-BLK-005 | `test/codec-worker.test.ts`, `npm run build:codec`, TC-CODEC-STAGING-001 bis TC-CODEC-STAGING-004 |

## Pflege

Nach erfolgreicher Umsetzung wird pro Zeile:

1. `Zielcode` auf konkrete exportierte Funktionen bzw. Testabschnitte präzisiert;
2. der Status auf `implemented` gesetzt;
3. erst nach erfolgreichem `npm test`, `npm run build` und gegebenenfalls `npm run build:codec` auf `verified` gesetzt;
4. bei einer bereitgestellten Codec-Staging-Route zusätzlich die zugehörigen `TC-CODEC-STAGING-*`-Fälle ausgeführt;
5. die Ausführung ohne sensitive Daten in [`../evidence/README.md`](../evidence/README.md) aktualisiert.
