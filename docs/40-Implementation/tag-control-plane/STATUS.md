# Implementierungsstatus: TAG Control Plane

**Letzte Planung:** 2026-10-06  
**Statusregeln:** [README.md](README.md)  
**Fachliche Stories:** [10-USER-STORIES.md](10-USER-STORIES.md)  
**Wichtig:** Dieser Strang beschreibt ausschließlich das künftige Backend. Es existieren noch keine Control-Plane-Anwendung, Migrationen oder Produktionsdaten.

## Iterationen

| Iteration | Ziel | Wesentliche Ergebnisse | Abhängigkeiten | Status |
| --- | --- | --- | --- | --- |
| `CP-I01` | Plattformfundament | PHP-/MySQL-Grundstruktur, Konfiguration, AuthZ-Grenzen, Audit, Migrationen, Transaktions- und Secret-Modell | Dogado PHP/MySQL/Composer/Cron, Auth-Entscheidung | planned |
| `CP-I02` | Pools, Ranges und TAG-Lebenszyklus | Allocation Pools für Zielgruppen/Partner/Großkunden, Range-Validator, atomarer 6-/8-stelliger Allocator, TAG-Stammdaten, Statusautomat und Sperrung | serverseitige Testsecrets, freigegebene Produkt-/Pooldefaults | planned |
| `CP-I03` | Claiming und kontrollierter JSON-Export | Claim-Gruppen und -Credentials, verschlüsselte Claim-PIN-Persistenz, Owner-Vorabzuweisung, persistente JSON-Exportaufträge für logische TAG-Ranges, unveränderliche Snapshots mit `exportOrderId` sowie externe QA-/Ausschuss-/Nachdruck-/Übergabereferenzen | Exportcontract, Claim- und Qualitätsprozess | planned |
| `CP-I04` | Routing-Projektion und Publishing | Feature-Validator, Projektion, Outbox, idempotenter KV-Publisher, Publish/Unpublish und Rollback | Staging-KV, least-privilege Cloudflare-Token, Edge-Vertrag | planned |
| `CP-I05` | Öffentliche Basisdaten | veröffentlichter Basis-Vault, Public Read API, CORS/Cache/Rate Limits und TAG-App-Contract | Staging-API-Origin und PWA-Integration | planned |
| `CP-I06` | Produkt-, Organisation- und POI-Policies | Produktgrenzen, Organisationen, POI-Review, Nachweise, Moderations- und Retention-Policies | Produkt-/Rechts-/Betriebsentscheidungen | planned |
| `CP-I07` | Erweiterte Vault-Runtime | private Freigaben, Medien, Uploads, R2-Workflows und komplexe Endnutzerfeatures | separate Runtime-API, R2, Datenschutzfreigabe | deferred |

## Arbeitspakete

| ID | Arbeitspaket | Iteration | Status | Erwartete Evidenz |
| --- | --- | --- | --- | --- |
| `CP-WP-01` | Backend-Architektur, Konfigurations- und Secret-Grenzen | CP-I01 | planned | Konfigurations-/Leak-Tests, dokumentierte Umgebungen |
| `CP-WP-02` | MySQL-Kernschema, Migrationen und Transaktionskonzept | CP-I01 | planned | Schema-, Migration- und Restore-Test |
| `CP-WP-03` | Serverseitige AuthZ-Grenzen und Audit-Infrastruktur | CP-I01 | planned | Policy-/Audit-/CSRF-Tests; UI bleibt CC-Verantwortung |
| `CP-WP-04` | Allocation-Pool-, Range- und Gruppendomäne | CP-I02 | planned | Pool-/Range-Invarianten- und Negativtests |
| `CP-WP-05` | TAG-Allocator, Reservierung und Statusautomat | CP-I02 | planned | Parallelitäts-, Retry-, Lifecycle- und Secret-Tests |
| `CP-WP-05A` | Claim- und Owner-Zuordnungsdomäne | CP-I03 | planned | Credential-/Versuchslimit-/Parallelclaim-/Owner-Konflikttests |
| `CP-WP-06` | Scan-URL-, QR-Payload- und JSON-Exportversionsservice | CP-I03 | planned | Kanonisierungs- und vertrauliche JSON-Exporttests |
| `CP-WP-07` | Persistente JSON-Exportaufträge und unveränderliche Snapshots | CP-I03 | planned | Auftrags-ID-/Snapshot-/Prüfsummen-/Berechtigungstests |
| `CP-WP-08` | Externe Qualitätsprüfung, Ausschuss, Nachdruck, Übergabe und Aktivierungsgate | CP-I03 | planned | QA-/Fehldruck-/Nachdruck-/Sperrtests ohne Druckeransteuerung |
| `CP-WP-08A` | Öffentliche Claim-API, Drosselung, Sperre und Support-Reset | CP-I03 | planned | Rate-Limit-/Lockout-/Reset-/Leak-Tests |
| `CP-WP-09` | Feature- und Routing-Projektionsgenerator | CP-I04 | planned | Schema-/Contract-/Leak-Tests |
| `CP-WP-10` | Outbox, Cloudflare-Adapter und idempotenter Publisher | CP-I04 | planned | Retry-/Staging-Publish-/Unpublish-Test |
| `CP-WP-11` | Öffentlicher Basis-Vault und PublicTagView-Mapper | CP-I05 | planned | Veröffentlichungs-/Leak-/Contract-Test |
| `CP-WP-12` | Public Read API und Runtime-Schutz | CP-I05 | planned | CORS-/Cache-/Rate-Limit-/E2E-Test |
| `CP-WP-13` | Produkt-, Organisations- und POI-Policy-Domäne | CP-I06 | planned | Policy-/Review-/Nachweiszugriffstest |
| `CP-WP-14` | Erweiterte Vault- und Medienprozesse | CP-I07 | deferred | separate Freigabe und Sicherheitskonzept |

## Ausgangsstatus

| Bereich | Vorhandener Stand | Bewusste Grenze |
| --- | --- | --- |
| Edge Router | Worker validiert und löst öffentliche TAG-Routingdaten aus KV auf | keine Control-Plane- oder Produktionsdaten im Worker |
| TAG-App | Fixture-basierter öffentlicher PWA-MVP | keine autoritative Public-API-Integration |
| TAG Control Center | Planungsdokumentation für die spätere Admin-UI | keine UI-Implementierung und keine Backend-Autorität |
| TAG Control Plane | neu angelegter Backend-Plan | keine PHP-Anwendung, DB, API, Publisher oder JSON-Exportdaten |
| Cloudflare KV | vorhandene Router-Projektion | keine Fachquelle, keine manuelle Produktionspflege |

## Blocker und offene Entscheidungen

| ID | Bereich | Beschreibung | Auflösungskriterium |
| --- | --- | --- | --- |
| `CP-BLK-001` | CP-I01 | PHP-Version, Framework, Composer, MySQL-Version, Queue/Cron und Secret-Speicher des Dogado-Hostings sind nicht bestätigt. | Staging-Hostingmatrix und Technologieentscheidung liegen vor. |
| `CP-BLK-002` | CP-I01 | Das verbindliche Authentisierungs-/MFA-Modell wird von Control Center und Plane gemeinsam benötigt. | Rollen-, Session-, Recovery- und MFA-Policy ist freigegeben. |
| `CP-BLK-003` | CP-I02 | Feistel-/HMAC-Secrets und serverseitige kompatible Testvektoren fehlen für reale Vergabe. | getrennte Staging-Secret-Integration und Testvektoren sind verfügbar. |
| `CP-BLK-004` | CP-I03 | JSON-Exportcontract, Auftrags- und Wiederdownloadregel, PIN-Verschlüsselung, Berechtigung, Qualitätsprüfprozess, Nachdruckregel, Support-Reset und Lager-/Übergabemodell sind offen. PDF-Layout, Drucksystem und Druckerei bleiben externe Verantwortlichkeiten. | versionierte Export-, Claim- und QA-Policy ist freigegeben. |
| `CP-BLK-005` | CP-I04 | Aktiver Staging-Worker, gebundener KV-Namespace und minimaler Cloudflare-Publisher-Token sind nicht abschließend identifiziert. | Ressourcen, Tokenumfang und Sandbox-Namespace sind dokumentiert. |
| `CP-BLK-006` | CP-I05 | Staging-Origin der Public Read API, CORS-Allowlist und Cache-Widerrufsbudget sind offen. | HTTPS-/CORS-/Cache-/Rate-Limit-Policy ist bestätigt. |
| `CP-BLK-007` | CP-I06 | POI-Nachweis, Retention, Moderations-SLA und kommerzielle Produktlimits sind Produkt-/Compliance-Entscheidungen. | versionierte fachliche Policies sind freigegeben. |

## Aktualisierungsregel

Ein Arbeitspaket wird erst `implemented`, wenn seine serverseitige Implementierung, Tests und Traceability-Verweise vorhanden sind. `verified` setzt zusätzlich erfolgreiche Staging-Evidenz voraus:

- für `CP-I03`: vertraulicher JSON-Snapshot mit `exportOrderId`, unveränderter Wiederdownload, Claim mit Fehlversuchs-/Sperrfall, QA-/Ausschussreferenz und kontrollierte Aktivierung;
- für `CP-I04`: realer Staging-Publish **und** Unpublish mit isoliertem Namespace;
- für `CP-I05`: Scan → Edge Router → TAG-App → Public Read API mit positivem und neutralem Negativfall.
