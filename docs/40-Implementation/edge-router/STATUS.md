# Implementierungsstatus

> Letzte fachliche Bewertung: 2026-10-27  
> Statuswerte und Übergangsregeln: [`../README.md`](../README.md)

## Arbeitspakete

| ID | Arbeitspaket | Status | Erwartete Evidenz |
| --- | --- | --- | --- |
| WP-01 | Implementierungsnachweis und Rückverfolgbarkeit | verified | Dokumente in `docs/40-Implementation/` sowie lokaler 6/8/10-Durchlauf vom 2026-10-27 |
| WP-02 | Kanonische Feistel-/Cycle-Walk-Domänen für 6, 8 und 10 Stellen | verified | TC-CRYPTO-001 bis TC-CRYPTO-005; lokale Router-Regression vom 2026-10-27 |
| WP-03 | Lineare vollständige Range-Keys ohne HMAC- oder Slot-Regel | verified | TC-ID-001 bis TC-ID-004; lokale Codec- und Worker-Regression für 6, 8 und 10 Stellen |
| WP-04 | Validierter aktiver Range-Index | verified | TC-RANGE-001 bis TC-RANGE-005 |
| WP-05 | Feature-Zuweisung Tag → Range → Gruppe | verified | TC-RULE-001 bis TC-RULE-006 |
| WP-06 | Zentrale KV-Feature-Dokumente | verified | TC-FEATURE-001 bis TC-FEATURE-005 |
| WP-07 | Sichere Redirect-Templates | verified | TC-TEMPLATE-001 bis TC-TEMPLATE-006 |
| WP-08 | JSON-Aktionsantwort und HTTP-Verhalten | verified | TC-RESPONSE-001 bis TC-RESPONSE-004 |
| WP-09 | Fixtures, automatisierte Tests, Build und Evidenz | verified | `npm test`, `npm run build`, `npm run build:codec` |
| WP-10 | Gemeinsamer Codec-Kern und privater Codec-Worker | implemented | lokale Codec-Tests und `npm run build:codec` grün; bisheriger Einzel-Codec-Slice auf `codec.s.myqr24.com` implementiert |
| WP-11 | Internal-Codec-API, Batch-Encoding und symmetrische Umgebungsrouten | planned | `internal.s.myqr24.com` / `internal.p.myqr24.com`, `/api/v1/codec/*`, `codecVersion`, Batch-Limit 1.000, TC-CODEC-006 bis 008 und TC-CODEC-STAGING-005 bis 006 |

## Verifizierter Implementierungsstand

| Bereich | Implementierter Stand |
| --- | --- |
| Gruppenmodell | `group:{groupId}` referenziert Feature-Dokumente über `featureIds` |
| Direkte Tags | `tag:{decodedValue}` ist nach erfolgreicher Range-Bestätigung verfügbar |
| Range-Regeln | `range-rule:{rangeId}` wird nach direkter Tag-Zuweisung und vor Gruppen-Features ausgewertet |
| Range-Metadaten | Jede Range enthält stabile `id`, `active` und kanonische `length` |
| Feature-Dokumente | Wiederverwendbare KV-Dokumente unter `feature:{featureId}` |
| Cycle-Walk | Erzwingt vollständig `36^(L-1) ≤ value < 36^L` |
| ID- und Range-Keys | Vollständige kanonische Werte für 6, 8 und 10 Stellen; keine HMAC-Prüfung, Slot-Ausrichtung oder Bitmaskierung |
| Redirects | Ausschließlich `url` xor `urlTemplate`; Server-Placeholder-Allowlist und HTTP(S)-Prüfung |
| Testdaten | Versionierte nicht geheime JSON-Fixture unter `test/fixtures/` plus dynamisch berechnete Testwerte |
| Gemeinsamer Codec | `src/codec/index.ts` wird vom öffentlichen Scan-Worker und dem separaten privaten Codec-Worker importiert |
| Codec-Worker | bestehender Slice: `POST /api/v1/tag-codec/encode` und `/decode`; Bearer-Authentisierung, keine KV-/Redirect-Secret-Bindung, keine CORS-Header. Nächste Welle: `/api/v1/codec/encode`, `/encode-batch`, `/decode` mit `codecVersion` |
| Codec-Deployment | Separate `wrangler.codec.toml`; keine KV-/Redirect-Bindungen; aktive abzulösende Custom Route `codec.s.myqr24.com/api/v1/*`. Geplant sind symmetrisch `internal.s.myqr24.com/api/v1/codec/*` und `internal.p.myqr24.com/api/v1/codec/*` |
| Codec-Secrets | Staging: `FEISTEL_SECRET_S01` und `TAG_CODEC_API_KEY_S01`; Produktion: separate `FEISTEL_SECRET_P01` und `TAG_CODEC_API_KEY_P01`. Je Umgebung gilt ein Feistel-Secret pro Codec-Version für 6, 8 und 10 Stellen; keine Werte im Repository |
| Codec-Staging-Live-Tests | Vorherige 6-/8-Stellen-Evidenz gehört zum abgelösten HMAC-Vertrag; vor WP-11-Deployment sind Internal-Host-Migration, 6/8/10-Roundtrips, `codecVersion`, 1.000er-Batch sowie WAF-/Rate-Limit-/Access-Grenzen nachzuweisen |
| Ausführungsnachweis | Lokale Regressionen und Builds für den 6/8/10-Vertrag sind am 2026-10-27 in `../evidence/README.md` nachgewiesen |

## Story-Status

| Story | Kurzbezeichnung | Status |
| --- | --- | --- |
| US-001 | Öffentliche Tag-URL auflösen | verified |
| US-002 | Fehlermeldungen fail-closed behandeln | verified |
| US-003 | Kanonische ID-Räume und vollständige Integer | verified |
| US-004 | Lineare kanonische ID-Auflösung für 6, 8 und 10 Stellen | verified |
| US-005 | Aktive Range und globale Range-Invarianten | verified |
| US-006 | Feature-Zuweisung mit Priorität | verified |
| US-007 | Wiederverwendbare Feature-Dokumente | verified |
| US-008 | Sichere Redirect-Templates | verified |
| US-009 | JSON-Aktionsdokumente | verified |
| US-010 | Reproduzierbare Test- und Build-Evidenz | verified |
| CP-US-011 | Private TAG-ID-Erstellung ohne Codec-Secrets in der Control Plane | implemented |
| CP-US-013 | Poolgrenzen im kanonischen `decodedValue`-Raum | implemented |
| CP-BLK-005 | Private Codec-Route und minimale Secret-Bindungen | implemented |

## Aktualisierungsregel

Nach Abschluss eines Arbeitspakets wird:

1. der Status mindestens auf `implemented` gesetzt;
2. die Traceability Matrix um Code- und Testreferenzen ergänzt;
3. nach erfolgreichem Test und Build auf `verified` gesetzt;
4. die konkrete Ausführung in [`../evidence/README.md`](../evidence/README.md) referenziert.

`verified` setzt immer voraus, dass alle zugehörigen Testfälle grün sind und keine bekannte Abweichung zu `DOMAIN_RULES.md` oder `ARCHITECTURE.md` besteht.
