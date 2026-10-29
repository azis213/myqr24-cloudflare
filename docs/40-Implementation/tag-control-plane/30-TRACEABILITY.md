# Rückverfolgbarkeit: TAG Control Plane

**Letzte Aktualisierung:** 2026-10-29  
**Status:** CP-I01 besitzt lokal implementierte und gegen eine isolierte MySQL-8.4-Compose-Topologie getestete Audit-, Bootstrap-Admin-, Session- und E-Mail-MFA-Grundlagen. Der browserseitige W1L-Schnitt ist als [`control-plane-admin-api-v1`](../../10-Architecture/35-Contracts/control-plane-admin-api-v1.md) versioniert und durch TCC-Contract-UI-Tests ergänzt. W2L ist als [`control-plane-tag-management-api-v1`](../../10-Architecture/35-Contracts/control-plane-tag-management-api-v1.md) dokumentiert, bleibt jedoch bis zur serverseitigen AuthZ-Matrix und für Reservierungen zusätzlich bis zum Codec-Adapter-/Testvektor-Gate blockiert.

## 1. Verweisregeln

| Spalte | Bedeutung |
| --- | --- |
| Story | fachlicher Backend-Bedarf aus [10-USER-STORIES.md](10-USER-STORIES.md) |
| Arbeitspaket | geplanter Implementierungsrahmen aus [STATUS.md](STATUS.md) |
| Tests | künftige Nachweise aus [21-TEST-CASES.md](21-TEST-CASES.md) |
| Testdaten | zulässige Fixture-Klassen aus [22-TEST-DATA.md](22-TEST-DATA.md) |
| Implementierung | serverseitiger Verantwortungsbereich bzw. tatsächliche Codepfade |
| Evidenz | lokaler bzw. externer Nachweis; `verified` setzt weiterhin die Iterationsgates voraus |

Das TAG Control Center referenziert diese Backendschnittstellen später, implementiert aber weder die Fachautorität noch den Publisher selbst.

## 2. Traceability-Matrix

| Story | Arbeitspaket | Tests | Testdaten | Geplante Implementierung | Erforderliche Evidenz | Status |
| --- | --- | --- | --- | --- | --- | --- |
| CP-US-001 autoritative Mutation | CP-WP-01 bis CP-WP-03 | CP-TC-TX-001, CP-TC-AUTHZ-001, CP-TC-CONFIG-001, CP-TC-AUTH-001 bis 005 | CP-TD-008, CP-TD-010 | CP-I01-Grundlage: Laravel-13 unter `apps/tag-control-plane/`, MySQL-/UTC-Defaults, Korrelation in `app/Http/Middleware/AssignCorrelationId.php`; `app/Services/AuthenticationService.php`, `app/Http/Controllers/ApiAuthenticationController.php` und `routes/api.php` setzen den versionierten [`control-plane-admin-api-v1`](../../10-Architecture/35-Contracts/control-plane-admin-api-v1.md) mit CSRF-geschützten Web-Sessions und E-Mail-MFA durch. `app/Console/Commands/BootstrapPlatformAdmin.php` erstellt nur den konfigurierten Start-Admin; Passwortreset nur mit explizitem Flag. Fachliche AuthZ-Guards bleiben offen. | Lokaler MySQL-8.4-Lauf `npm run local:test` am 2026-10-28 mit `tests/Feature/AuthenticationFlowTest.php`; TCC-Contract-/Build-Nachweis in `CC-TC-AUTH-001` bis `CC-TC-AUTH-006`; Dogado-/Staging- und Ziel-AuthZ-Nachweis offen | in-progress |
| CP-US-002 Audit | CP-WP-02, CP-WP-03 | CP-TC-AUDIT-001 bis 002 | CP-TD-010 | `database/migrations/2026_10_28_000000_create_audit_events_table.php`, `app/Models/AuditEvent.php`, `app/Services/AuditService.php` und `app/Support/AuditSanitizer.php`; Persistenz nur mit valider UUID-Korrelation und rekursiver Secret-Redaktion | `tests/Unit/AuditSanitizerTest.php`, `tests/Feature/AuditServiceMySqlTest.php`, lokaler MySQL-8.4-Lauf `npm run local:test` am 2026-10-28 | implemented |
| CP-US-010 Range-Validierung | CP-WP-04 | CP-TC-RANGE-001 bis 004 | CP-TD-001 | [`control-plane-tag-management-api-v1`](../../10-Architecture/35-Contracts/control-plane-tag-management-api-v1.md): Range-Validator, Gruppen-/Referenzprüfung | `W2L-BLK-AUTHZ` lösen, dann Invarianten- und Negativtests | blocked |
| CP-US-013 Allocation Pools | CP-WP-04 | CP-TC-POOL-001 bis 004 | CP-TD-001, CP-TD-012 | Vertragsgemäßer Pool-Service mit kanonischer Poolrange-/Kapazitäts-/Policy-Prüfung | `W2L-BLK-AUTHZ` lösen, dann Poolgrenzen-, Erschöpfungs- und Leak-Tests | blocked |
| CP-US-011 atomare Reservierung | CP-WP-02, CP-WP-05 | CP-TC-ALLOC-001 bis 005 | CP-TD-001, CP-TD-002 | DB-gestützter Allocator, Lock-/Idempotenzservice, serverseitiger Codec-Adapter | `W2L-BLK-AUTHZ` und `W2L-BLK-CODEC` lösen, dann Parallelitäts-, Retry- und Leak-Tests | blocked |
| CP-US-012 TAG-Lebenszyklus | CP-WP-05 | CP-TC-LIFECYCLE-001 bis 003 | CP-TD-003 | Statusautomat und späterer Unpublish-Planer | `W2L-BLK-AUTHZ` lösen; Outbox-/Neutralisierung bleibt W3L | blocked |
| CP-US-025 Claim-Credentials | CP-WP-05A, CP-WP-06 | CP-TC-CLAIM-PREP-001 bis 003 | CP-TD-011 | Credential-Service mit individuellem Prüfhash, TAG-bezogen verschlüsseltem PIN-Wert, Claim-Gruppe und autorisiertem JSON-Export-Guard | Hash-, Verschlüsselungs-, Bogen-PIN-, organisationsbezogene Ausnahme- und Leak-Tests | planned |
| CP-US-026 öffentlicher Claim | CP-WP-05A, CP-WP-08A | CP-TC-CLAIM-001 bis 006 | CP-TD-011 | Public Claim API und atomarer kanalneutraler Claim-Service mit Lockout-/Rate-Limit-Guards | Parallelclaim-, Lockout-, Drosselungs-, neutraler Fehler- und TAG-App-Contract-Test | planned |
| CP-US-028 manueller Support-Claim | CP-WP-05A, CP-WP-08A | CP-TC-SUPPORT-CLAIM-001 bis 002 | CP-TD-011 | Support-Claim-Command über denselben Claim-Service, Re-Auth-/Audit-Guard | Cross-Channel-Contract, Secret-Sanitizing, Rollen-, Re-Auth- und Audit-Tests | planned |
| CP-US-027 Preassign/Self-Print | CP-WP-05, CP-WP-05A, CP-WP-06 | CP-TC-PREASSIGN-001 bis 003 | CP-TD-002, CP-TD-012 | Owner-Zuordnungsservice und vertraulicher Self-Print-Export | Zuordnungs-, Widerrufs- und Exporttests | planned |
| CP-US-020 JSON-Exportauftrag | CP-WP-05, CP-WP-07 | CP-TC-PRODUCTION-001 bis 003 | CP-TD-002, CP-TD-004 | persistenter Exportauftragsservice für logische `decodedValue`-Ranges, atomare TAG-Zuordnung und Audit | Atomizitäts-, Eindeutigkeits-, Range- und Nachdruckreferenztests | planned |
| CP-US-021 JSON-Export-Snapshot | CP-WP-06, CP-WP-07 | CP-TC-SNAPSHOT-001 bis 004 | CP-TD-004, CP-TD-010, CP-TD-011 | Scan-URL-/QR-Payload-Generator, unveränderlicher JSON-Snapshot-/Downloadservice mit `exportOrderId` und kontrollierter PIN-Entschlüsselung | Determinismus-, Auftrags-ID-, Prüfsummen-, PIN-Ausnahme- und Leak-Tests | planned |
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
| [`control-plane-admin-api-v1`](../../10-Architecture/35-Contracts/control-plane-admin-api-v1.md) | serverseitige Session, CSRF, Passwortprüfung, kurzlebige gehashte E-Mail-MFA-Challenge, Rate Limits und Audit; Bootstrap nur als CLI-Command | TAG Control Center | `tests/Feature/AuthenticationFlowTest.php`; `CP-TC-AUTH-001` bis `CP-TC-AUTH-005`; `CC-TC-AUTH-001` bis `CC-TC-AUTH-006`; TCC-Produktionsbuild |
| [`control-plane-tag-management-api-v1`](../../10-Architecture/35-Contracts/control-plane-tag-management-api-v1.md) | spätere serverseitige Range-, Pool-, Reservierungs- und Lifecycle-Validierung, AuthZ, Idempotenz, Audit und Fehlervertrag | TAG Control Center | CP-TC-RANGE-001 bis 004, CP-TC-POOL-001 bis 004, CP-TC-ALLOC-001 bis 005, CP-TC-LIFECYCLE-001 bis 003; bis `W2L-BLK-AUTHZ`/`W2L-BLK-CODEC` blocked |
| KV-Projektion | minimaler, validierter, nicht geheimer Publish-Diff | Edge Router | CP-TC-PROJECTION-001 bis 003, CP-TC-PUBLISH-002 |
| JSON-Druckexport | kanonische TAG-Daten je logischer Range, unveränderlicher JSON-Snapshot mit `exportOrderId`; Claim-PIN nur für nicht organisationsgebunden freigeschaltete claimbare TAGs | TAG Control Center / externe Druckaufbereitung / Druckerei | CP-TC-PRODUCTION-001 bis 003, CP-TC-SNAPSHOT-001 bis 004 |
| PublicTagView | nur freigegebene öffentliche Daten, neutrale Fehler | TAG-App | CP-TC-API-001 bis 004, CP-TC-E2E-001 bis 002 |
| Public Runtime-Projektion | öffentliche, revisionierte und aus `tagId` abgeleitete View-/Medienkonfiguration; keine privaten Daten | Cloudflare Runtime / TAG-App | CP-TC-RUNTIME-001 bis 005, APP-TC-PIN-001 bis 002 |
| Owner-Besitzanker | Account-/Organisationsbindung oder separate TAG-Owner-Passphrase; kein Besitz aus Collection oder Clientzustand | TAG-App / Control Center | CP-TC-CLAIM-007 bis 009, CP-TC-OWNER-001 bis 004, APP-TC-OWNER-006 bis 007 |
| Persönliche Collections | accountisolierte TAG-Referenzen, kein Ownerrecht, keine privaten View-Kopien | TAG-App | CP-TC-COLLECTION-001 bis 003, APP-TC-COLLECTION-001 bis 003 |
| Sperrung/Unpublish | idempotente Entfernung/Neutralisierung nach Status- oder Sicherheitsfall | Cloudflare KV / Edge Router | CP-TC-UNPUBLISH-001 bis 002, CP-TC-REPRINT-003 |
| Produktionsübergabe | private, auditierte Übergabedaten; keine öffentliche Projektion | Fulfillment / Control Center | CP-TC-HANDOVER-001 bis 002 |
| öffentlicher TAG-App-Claim | neutraler minimaler Ergebnisvertrag, serverseitige Credential-Prüfung und atomare Owner-Zuordnung | TAG-App / künftige Owner-Authentisierung | CP-TC-CLAIM-001 bis 005 |
| manueller Support-Claim | gemeinsamer Claim-Service ohne Secret-Persistenz; zusätzliche Support-AuthZ, Re-Authentisierung und Audit für Folgeaktionen | TAG Control Center | CP-TC-SUPPORT-CLAIM-001 bis 002 |
| vertraulicher JSON-Druckexport | nur autorisierter Download eines persistenten Exportauftrags; verschlüsselte Claim-PINs werden ausschließlich im Snapshot-Prozess entschlüsselt und fehlen bei organisationsgebunden freigeschalteten TAGs; nie KV, Public API, Audit oder Log | TAG Control Center / externe Druckaufbereitung / Druckerei | CP-TC-CLAIM-PREP-001 bis 003, CP-TC-SNAPSHOT-001 bis 004 |

## 4. CP-I01-Testlauf und lokale Evidenz

Der reproduzierbare Befehl `npm run local:test` startet die lokale Compose-Topologie, stellt ausschließlich die synthetische Datenbank `myqr24_test` bereit, führt `migrate:fresh` nur gegen diese Datenbank aus und startet dann PHPUnit.

Der erfolgreiche Lauf vom 2026-10-29 lieferte:

- PHP 8.4.27 und MySQL 8.4 im isolierten Compose-Netz;
- Migration der Tabellen `audit_events`, `users` und `email_mfa_challenges`;
- **11 Tests, 65 Assertions** ohne PHPUnit-Probleme;
- Auditpersistenz mit Korrelations-ID, rekursive Redaktion, Rollback und Health-Endpunkt-Korrelation;
- Passwort-Login mit und ohne aktivierte E-Mail-MFA, neutrale Fehlernormalisierung für ungültige/ unbekannte Login-Eingaben, gehashte Challenge, Fehlversuchszähler sowie den idempotenten Bootstrap-Admin mit explizitem Passwortreset;
- die zugehörige TCC-Contract-UI-Suite `apps/tag-control-center/src/App.test.tsx` erfolgreich mit **6 Tests** sowie TCC-Build und Dependency-Audit ohne bekannte Vulnerabilities.

Dieser Nachweis ist lokal und enthält keine Staging-/Dogado-Secrets. Er bestätigt nicht den produktiven Dogado-SMTP-Transport, Passkey/TOTP, Recovery, fachliche Rollen-/Re-Auth-Guards oder eine Staging-/Produktionsfreigabe.

## 5. Ergänzungsprozess bei Implementierungsbeginn

Für jede tatsächlich umgesetzte Story wird ergänzt:

1. konkrete PHP-Modul-, Migrations-, API- und Workerpfade;
2. ausgeführte automatisierte Testdateien und Befehle;
3. verwendete, nicht geheime `CP-TD-*`-Fixtures;
4. redigierte Evidence unter [`../evidence/`](../evidence/README.md);
5. Implementierungs- und Verifikationsstatus.

`implemented` setzt Code und verknüpfte Tests voraus. `verified` setzt darüber hinaus die Gates aus [20-TEST-STRATEGY.md](20-TEST-STRATEGY.md) voraus. Eine Control-Center-Oberfläche ohne serverseitig nachgewiesene Control-Plane-Guards erfüllt keine Backend-Story.
