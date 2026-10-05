# Implementierungsstatus

> Letzte fachliche Bewertung: 2026-09-30  
> Statuswerte und Übergangsregeln: [`../README.md`](../README.md)

## Arbeitspakete

| ID | Arbeitspaket | Status | Erwartete Evidenz |
| --- | --- | --- | --- |
| WP-01 | Implementierungsnachweis und Rückverfolgbarkeit | implemented | Dokumente in `docs/40-Implementation/` |
| WP-02 | Kanonische Feistel-/Cycle-Walk-Domänen | verified | TC-CRYPTO-001 bis TC-CRYPTO-004 |
| WP-03 | Vollständiger 8-stelliger HMAC-Range-Key | verified | TC-HMAC-001 bis TC-HMAC-004 |
| WP-04 | Validierter aktiver Range-Index | verified | TC-RANGE-001 bis TC-RANGE-005 |
| WP-05 | Feature-Zuweisung Tag → Range → Gruppe | verified | TC-RULE-001 bis TC-RULE-006 |
| WP-06 | Zentrale KV-Feature-Dokumente | verified | TC-FEATURE-001 bis TC-FEATURE-005 |
| WP-07 | Sichere Redirect-Templates | verified | TC-TEMPLATE-001 bis TC-TEMPLATE-006 |
| WP-08 | JSON-Aktionsantwort und HTTP-Verhalten | verified | TC-RESPONSE-001 bis TC-RESPONSE-004 |
| WP-09 | Fixtures, automatisierte Tests, Build und Evidenz | verified | `npm test`, `npm run build` |

## Verifizierter Implementierungsstand

| Bereich | Implementierter Stand |
| --- | --- |
| Gruppenmodell | `group:{groupId}` referenziert Feature-Dokumente über `featureIds` |
| Direkte Tags | `tag:{decodedValue}` ist nach erfolgreicher Range-Bestätigung verfügbar |
| Range-Regeln | `range-rule:{rangeId}` wird nach direkter Tag-Zuweisung und vor Gruppen-Features ausgewertet |
| Range-Metadaten | Jede Range enthält stabile `id`, `active` und kanonische `length` |
| Feature-Dokumente | Wiederverwendbare KV-Dokumente unter `feature:{featureId}` |
| Cycle-Walk | Erzwingt vollständig `36^(L-1) ≤ value < 36^L` |
| 8-stellige HMAC-Eingabe | Verwendet `base = decodedValue & ~0x0f`; der vollständige validierte Integer bleibt Range-Key |
| Redirects | Ausschließlich `url` xor `urlTemplate`; Server-Placeholder-Allowlist und HTTP(S)-Prüfung |
| Testdaten | Versionierte nicht geheime JSON-Fixture unter `test/fixtures/` plus dynamisch berechnete Testwerte |
| Ausführungsnachweis | `npm test`: 35/35 erfolgreich; `npm run build`: TypeScript-Prüfung und Wrangler-Dry-Run erfolgreich |

## Story-Status

| Story | Kurzbezeichnung | Status |
| --- | --- | --- |
| US-001 | Öffentliche Tag-URL auflösen | verified |
| US-002 | Fehlermeldungen fail-closed behandeln | verified |
| US-003 | Kanonische ID-Räume und vollständige Integer | verified |
| US-004 | 8-stellige HMAC-Integritätsprüfung | verified |
| US-005 | Aktive Range und globale Range-Invarianten | verified |
| US-006 | Feature-Zuweisung mit Priorität | verified |
| US-007 | Wiederverwendbare Feature-Dokumente | verified |
| US-008 | Sichere Redirect-Templates | verified |
| US-009 | JSON-Aktionsdokumente | verified |
| US-010 | Reproduzierbare Test- und Build-Evidenz | verified |

## Aktualisierungsregel

Nach Abschluss eines Arbeitspakets wird:

1. der Status mindestens auf `implemented` gesetzt;
2. die Traceability Matrix um Code- und Testreferenzen ergänzt;
3. nach erfolgreichem Test und Build auf `verified` gesetzt;
4. die konkrete Ausführung in [`../evidence/README.md`](../evidence/README.md) referenziert.

`verified` setzt immer voraus, dass alle zugehörigen Testfälle grün sind und keine bekannte Abweichung zu `DOMAIN_RULES.md` oder `ARCHITECTURE.md` besteht.
