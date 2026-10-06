# Rückverfolgbarkeit: TAG Control Plane

**Planungsstand:** 2026-10-06  
**Status:** Planung. Derzeit existieren keine Control-Plane-Codepfade, Migrationen, Testdateien oder Evidenzen.

## 1. Verweisregeln

| Spalte | Bedeutung |
| --- | --- |
| Story | fachlicher Backend-Bedarf aus [10-USER-STORIES.md](10-USER-STORIES.md) |
| Arbeitspaket | geplanter Implementierungsrahmen aus [STATUS.md](STATUS.md) |
| Tests | künftige Nachweise aus [21-TEST-CASES.md](21-TEST-CASES.md) |
| Testdaten | zulässige Fixture-Klassen aus [22-TEST-DATA.md](22-TEST-DATA.md) |
| Geplante Implementierung | serverseitiger Verantwortungsbereich, ausdrücklich noch kein Code |
| Evidenz | Voraussetzung für `verified` |

Das TAG Control Center referenziert diese Backendschnittstellen später, implementiert aber weder die Fachautorität noch den Publisher selbst.

## 2. Traceability-Matrix

| Story | Arbeitspaket | Tests | Testdaten | Geplante Implementierung | Erforderliche Evidenz | Status |
| --- | --- | --- | --- | --- | --- | --- |
| CP-US-001 autoritative Mutation | CP-WP-01 bis CP-WP-03 | CP-TC-TX-001, CP-TC-AUTHZ-001, CP-TC-CONFIG-001 | CP-TD-008, CP-TD-010 | Request-/Application-Service, AuthZ-Guard, Transaktionsrahmen | Rollback-, AuthZ- und Konfigurationsnachweis | planned |
| CP-US-002 Audit | CP-WP-02, CP-WP-03 | CP-TC-AUDIT-001 bis 002 | CP-TD-010 | Audit-Service und append-only Speicherstrategie | Audit-/Sanitizingtests | planned |
| CP-US-010 Range-Validierung | CP-WP-04 | CP-TC-RANGE-001 bis 004 | CP-TD-001 | Range-Validator, Gruppen-/Referenzprüfung | Invarianten- und Negativtests | planned |
| CP-US-013 Allocation Pools | CP-WP-04 | CP-TC-POOL-001 bis 004 | CP-TD-001, CP-TD-012 | Pool-Service, kanonische Poolrange-/Kapazitäts-/Policy-Prüfung | Poolgrenzen-, Erschöpfungs- und Leak-Tests | planned |
| CP-US-011 atomare Reservierung | CP-WP-02, CP-WP-05 | CP-TC-ALLOC-001 bis 005 | CP-TD-001, CP-TD-002 | DB-gestützter Allocator, Lock-/Idempotenzservice, Secret-Provider | Parallelitäts-, Retry- und Leak-Tests | planned |
| CP-US-012 TAG-Lebenszyklus | CP-WP-05 | CP-TC-LIFECYCLE-001 bis 003 | CP-TD-003 | Statusautomat und Unpublish-Planer | Status-/Sperr-/Outbox-Nachweis | planned |
| CP-US-025 Claim-Credentials | CP-WP-05A, CP-WP-06 | CP-TC-CLAIM-PREP-001 bis 003 | CP-TD-011 | Credential-Service, individueller Hash, Claim-Gruppe und vertraulicher Export-Guard | Hash-, Bogen-PIN- und Leak-Tests | planned |
| CP-US-026 öffentlicher Claim | CP-WP-05A, CP-WP-08A | CP-TC-CLAIM-001 bis 006 | CP-TD-011 | Public Claim API und atomarer kanalneutraler Claim-Service mit Lockout-/Rate-Limit-Guards | Parallelclaim-, Lockout-, Drosselungs-, neutraler Fehler- und TAG-App-Contract-Test | planned |
| CP-US-028 manueller Support-Claim | CP-WP-05A, CP-WP-08A | CP-TC-SUPPORT-CLAIM-001 bis 002 | CP-TD-011 | Support-Claim-Command über denselben Claim-Service, Re-Auth-/Audit-Guard | Cross-Channel-Contract, Secret-Sanitizing, Rollen-, Re-Auth- und Audit-Tests | planned |
| CP-US-027 Preassign/Self-Print | CP-WP-05, CP-WP-05A, CP-WP-06 | CP-TC-PREASSIGN-001 bis 003 | CP-TD-002, CP-TD-012 | Owner-Zuordnungsservice und vertraulicher Self-Print-Export | Zuordnungs-, Widerrufs- und Exporttests | planned |
| CP-US-020 Produktionslos | CP-WP-05, CP-WP-07 | CP-TC-PRODUCTION-001 bis 003 | CP-TD-002, CP-TD-004 | Produktionslos-/Druckauftragsservice | atomare Los- und Zuordnungstests | planned |
| CP-US-021 Drucksnapshot | CP-WP-06, CP-WP-07 | CP-TC-SNAPSHOT-001 bis 004 | CP-TD-004, CP-TD-010 | Scan-URL-/QR-Payload-Generator, Snapshot-/Exportservice | Determinismus-, Prüfsummen- und Leak-Tests | planned |
| CP-US-022 Druck/QA/Ausschuss | CP-WP-08 | CP-TC-QA-001 bis 003 | CP-TD-003, CP-TD-004 | QA-Statusautomat und Ausschussprozess | QA-, Teilproduktions- und Ausschussnachweis | planned |
| CP-US-023 Nachdruck/Verlust/Diebstahl | CP-WP-08, CP-WP-10 | CP-TC-REPRINT-001 bis 003 | CP-TD-003, CP-TD-004, CP-TD-006 | Nachdruck-/Ersatz-/Sperrservice, Unpublish-Planer | Nachdruck-, Ersatz- und Sperrtests | planned |
| CP-US-024 Übergabe/Aktivierung | CP-WP-08, CP-WP-05 | CP-TC-HANDOVER-001 bis 002 | CP-TD-004, CP-TD-008 | Übergabe- und Aktivierungsgate | kontrollierte Übergabe-/Aktivierungsprüfung | planned |
| CP-US-029 Besitzanker nach Claim | CP-WP-05A, CP-WP-08A | CP-TC-CLAIM-007 bis 009 | CP-TD-011 | Claim-Setup-Status, Account-/Organisationsbindung, Owner-Passphrase-Guard | Setup-Ablauf-, Abbruch-, Faktortrennung- und Audit-Tests | planned |
| CP-US-033 Owner-Passphrase/Session | CP-WP-08A | CP-TC-OWNER-001 bis 004 | CP-TD-011 | TAG-gebundener Passwort- und Session-Service, CSRF-/Rate-Limit-Guard | Hash-, Scope-, Cookie-, Sperr- und Widerrufstests | planned |
| CP-US-034 Account-Collections | CP-WP-08A | CP-TC-COLLECTION-001 bis 003 | CP-TD-007, CP-TD-011 | Account-/TAG-Collection-Service und Import-API | Nutzerisolations-, Idempotenz-, Cache- und Berechtigungstests | planned |
| CP-US-030 Routing-Projektion | CP-WP-09 | CP-TC-PROJECTION-001 bis 003 | CP-TD-001, CP-TD-005 | Feature-Schemas, Projektionsgenerator, Validator | Edge-Contract- und Leak-Tests | planned |
| CP-US-031 KV-Publish | CP-WP-10 | CP-TC-PUBLISH-001 bis 005 | CP-TD-006, CP-TD-010 | Outbox, Publisher-Worker und Cloudflare-Adapter | Retry-, Environment-Guard- und Staging-Publish | planned |
| CP-US-032 Unpublish | CP-WP-10 | CP-TC-UNPUBLISH-001 bis 002 | CP-TD-006, CP-TD-010 | Unpublish-Auftrag und Publisher-Adapter | Staging-Unpublish und Audit | planned |
| CP-US-035 Public Runtime-Projektion | CP-WP-09 bis CP-WP-12 | CP-TC-RUNTIME-001 bis 005 | CP-TD-007 | Runtime-Mapper, versionsbasierter Objekt-Key, Runtime-Outbox und Publisher-Adapter | Schema-, Key-, Sichtbarkeits-, Diff-, Leak- und Widerrufstests | planned |
| CP-US-040 öffentliche Vault-Version | CP-WP-11 | CP-TC-PUBLIC-001 bis 003 | CP-TD-007 | veröffentlichte Content-Version und Mapper | Veröffentlichungs-, Widerrufs- und Leak-Tests | planned |
| CP-US-041 Public Read API | CP-WP-12 | CP-TC-API-001 bis 004, CP-TC-E2E-001 bis 002 | CP-TD-007 | Read-API, PublicTagView-Mapper, CORS-/Cache-/Rate-Limit-Policy | Contract-, Security- und E2E-Staging-Nachweis | planned |
| CP-US-050 Produkt/Organisation | CP-WP-13 | CP-TC-POLICY-001, CP-TC-ORG-001 | CP-TD-008 | Produkt-/Policy- und Organisationsservice | Policy- und Mandantengrenzentests | planned |
| CP-US-051 POI-Gates | CP-WP-13 | CP-TC-POI-001 bis 003 | CP-TD-009 | POI-Review-/Nachweiszugriffs- und Schutzservice | Pflichtgate-, Leak- und Deaktivierungstests | planned |

## 3. Systemübergreifende Verträge

| Vertrag | Control-Plane-Verantwortung | Gegenstelle | Verifikation |
| --- | --- | --- | --- |
| Admin-Befehle | serverseitige Validierung, AuthZ, Workflow, Fehlervertrag | TAG Control Center | CP-TC-AUTHZ-001, fachliche Service-Tests; UI-Tests im CC-Strang |
| KV-Projektion | minimaler, validierter, nicht geheimer Publish-Diff | Edge Router | CP-TC-PROJECTION-001 bis 003, CP-TC-PUBLISH-002 |
| Scan-URL/QR-Payload | kanonische Produktionsdaten ohne Secrets | Drucksystem / physischer TAG | CP-TC-SNAPSHOT-001 bis 003 |
| PublicTagView | nur freigegebene öffentliche Daten, neutrale Fehler | TAG-App | CP-TC-API-001 bis 004, CP-TC-E2E-001 bis 002 |
| Public Runtime-Projektion | öffentliche, revisionierte und aus `tagId` abgeleitete View-/Medienkonfiguration; keine privaten Daten | Cloudflare Runtime / TAG-App | CP-TC-RUNTIME-001 bis 005, APP-TC-PIN-001 bis 002 |
| Owner-Besitzanker | Account-/Organisationsbindung oder separate TAG-Owner-Passphrase; kein Besitz aus Collection oder Clientzustand | TAG-App / Control Center | CP-TC-CLAIM-007 bis 009, CP-TC-OWNER-001 bis 004, APP-TC-OWNER-006 bis 007 |
| Persönliche Collections | accountisolierte TAG-Referenzen, kein Ownerrecht, keine privaten View-Kopien | TAG-App | CP-TC-COLLECTION-001 bis 003, APP-TC-COLLECTION-001 bis 003 |
| Sperrung/Unpublish | idempotente Entfernung/Neutralisierung nach Status- oder Sicherheitsfall | Cloudflare KV / Edge Router | CP-TC-UNPUBLISH-001 bis 002, CP-TC-REPRINT-003 |
| Produktionsübergabe | private, auditierte Übergabedaten; keine öffentliche Projektion | Fulfillment / Control Center | CP-TC-HANDOVER-001 bis 002 |
| öffentlicher TAG-App-Claim | neutraler minimaler Ergebnisvertrag, serverseitige Credential-Prüfung und atomare Owner-Zuordnung | TAG-App / künftige Owner-Authentisierung | CP-TC-CLAIM-001 bis 005 |
| manueller Support-Claim | gemeinsamer Claim-Service ohne Secret-Persistenz; zusätzliche Support-AuthZ, Re-Authentisierung und Audit für Folgeaktionen | TAG Control Center | CP-TC-SUPPORT-CLAIM-001 bis 002 |
| vertraulicher Druck-/Self-Print-Export | einmalig bzw. zeitlich begrenzt verfügbarer Credential-/ID-Export; nie KV oder Public API | Control Center / Fulfillment | CP-TC-CLAIM-PREP-001 bis 003, CP-TC-PREASSIGN-002 |

## 4. Ergänzungsprozess bei Implementierungsbeginn

Für jede tatsächlich umgesetzte Story wird ergänzt:

1. konkrete PHP-Modul-, Migrations-, API- und Workerpfade;
2. ausgeführte automatisierte Testdateien und Befehle;
3. verwendete, nicht geheime `CP-TD-*`-Fixtures;
4. redigierte Evidence unter [`../evidence/`](../evidence/README.md);
5. Implementierungs- und Verifikationsstatus.

`implemented` setzt Code und verknüpfte Tests voraus. `verified` setzt darüber hinaus die Gates aus [20-TEST-STRATEGY.md](20-TEST-STRATEGY.md) voraus. Eine Control-Center-Oberfläche ohne serverseitig nachgewiesene Control-Plane-Guards erfüllt keine Backend-Story.
