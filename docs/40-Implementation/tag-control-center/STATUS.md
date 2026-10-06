# Implementierungsstatus: TAG Control Center

**Letzte Planung:** 2026-10-06  
**Statusregeln:** [README.md](README.md)  
**Fachliche Stories:** [10-USER-STORIES.md](10-USER-STORIES.md)  
**Wichtig:** Dieser Strang dokumentiert nur den geplanten Umfang. Es existiert noch keine TAG-Control-Center-Anwendung.

## Iterationen

| Iteration | Ziel | Wesentliche Ergebnisse | Abhängigkeiten | Status |
| --- | --- | --- | --- | --- |
| `CC-I01` | Fundament und Sicherheitsbasis | Technologieentscheidung, Projektgrundgerüst, MySQL-Migrationen, Admin-Authentisierung, Rollen, Audit und Konfigurationsgrenzen | Dogado-Laufzeit, PHP-/MySQL-Versionen, Auth-/MFA-Entscheidung | planned |
| `CC-I02` | Pools, TAG-Stammdaten und sichere Vergabe | Allocation-Pool-Verwaltung, Ranges, Gruppen, Control-Plane-gestützte 6-/8-stellige Vergabe, TAG-Lebenszyklus, Claim-/Vorabzuweisungs- und QR-/Druckvorbereitung | freigegebene Staging-Secret-Integration, Produkt-/Pool-/Claim-Defaults | planned |
| `CC-I03` | Routing-Projektion und Publishing | Feature-Schemas, Projektion, Outbox, idempotenter Publisher, Publish-Diff, Retry, Unpublish | Cloudflare-Token, Staging-KV-Namespace, Edge-Router-Vertrag | planned |
| `CC-I04` | Öffentlicher Basis-Vault | veröffentlichte Basisinhalte, öffentliche Read-API, CORS/Cache/Rate-Limits, TAG-App-Adaptervertrag | API-Origin, TAG-App-Integration, Staging-Deployment | planned |
| `CC-I05` | Produktklassen, Organisationen und POI | Produktpolicies, Organisationsrollen, POI-Onboarding, Nachweise, Review, Meldungen und Moderationsdefaults | verbindliche Produkt-, Retention- und POI-Entscheidungen | planned |
| `CC-I06` | Erweiterte Vault- und Betriebsfunktionen | Owner-/Empfängerfreigaben, Medienpipeline, Reporting, Retention und operative Workflows | R2/API-Architektur, Datenschutz- und Sicherheitsfreigaben | deferred |

## Arbeitspakete

| ID | Arbeitspaket | Iteration | Status | Abhängigkeit / erwartete Evidenz |
| --- | --- | --- | --- | --- |
| `CC-WP-01` | Architekturvertrag, Projektgrenzen und Konfigurationsmodell | CC-I01 | planned | bestätigte PHP-/Framework- und Hostingentscheidung |
| `CC-WP-02` | Admin-Authentisierung, Rollen, Sessions, CSRF und Audit-Grundlage | CC-I01 | planned | CC-TC-AUTH-*, CC-TC-AUDIT-*, Sicherheitsreview |
| `CC-WP-03` | Autoritatives MySQL-Kernschema und Migrationsstrategie | CC-I01 | planned | CC-TC-SCHEMA-*, Restore-/Migrationsevidenz |
| `CC-WP-04` | Allocation-Pool-, Range-, Gruppen- und Feature-Verwaltung | CC-I02 | planned | CC-TC-POOL-*, CC-TC-RANGE-*, CC-TC-FEATURE-* |
| `CC-WP-05` | Control-Plane-gestützte TAG-Vergabe und Lebenszyklusverwaltung | CC-I02 | planned | CC-TC-ALLOC-*, CC-TC-LIFECYCLE-* |
| `CC-WP-05A` | Claim-Strategie, Vorabzuweisung und Claim-Support-UX | CC-I02 | planned | CC-TC-CLAIM-*, CC-TC-PREASSIGN-*; keine Credential-/Hash-Fachlogik in der UI |
| `CC-WP-06` | QR-Code-, Druck- und vertrauliche Exportvorbereitung | CC-I02 | planned | CC-TC-PRINT-*; keine produktive TAG-Ausgabe ohne Staging-Abnahme |
| `CC-WP-07` | Routing-Projektionsgenerator und Schema-Validierung | CC-I03 | planned | CC-TC-PROJECTION-*; Vergleich mit `DOMAIN_RULES.md` |
| `CC-WP-08` | Outbox, idempotenter Cloudflare-KV-Publisher und Retry | CC-I03 | planned | CC-TC-PUBLISH-*, isolierter Staging-KV-Namespace |
| `CC-WP-09` | Publish-/Unpublish-UX, Diff und Audit | CC-I03 | planned | CC-TC-PUBLISH-*, CC-TC-AUDIT-* |
| `CC-WP-10` | Öffentliche Basis-Vault-Verwaltung und Veröffentlichungsstatus | CC-I04 | planned | CC-TC-PUBLIC-*, öffentliche Datenvertragsprüfung |
| `CC-WP-11` | Read-API, CORS, Cache und Rate-Limits | CC-I04 | planned | CC-TC-API-*, Contract- und Security-Tests |
| `CC-WP-12` | TAG-App-Integration und End-to-End-Staging-Nachweis | CC-I04 | planned | CC-TC-INTEGRATION-*, Router-/PWA-Evidenz |
| `CC-WP-13` | Produktpolicies, Owner und Organisationen | CC-I05 | planned | CC-TC-PRODUCT-*, CC-TC-ORG-* |
| `CC-WP-14` | POI-Onboarding, Prüfungen, Meldungen und Moderation | CC-I05 | planned | CC-TC-POI-*, manueller Review-Nachweis |
| `CC-WP-15` | Erweiterte Vault-Funktionen, Retention und Betriebsreporting | CC-I06 | deferred | separate Freigabe für R2, private Sessions und Datenschutzkonzept |

## Ausgangsstatus

| Bereich | Aktueller Stand | Bewusste Grenze |
| --- | --- | --- |
| Dokumentation | Control-Plane-Architektur und Fachregeln sind vorhanden; dieser Implementierungsplan ergänzt den Nachweisstrang | kein umgesetztes PHP-Projekt |
| Edge Router | Cloudflare-Worker-Code und Testbasis existieren | keine Verwaltungslogik oder Fachdaten im Worker/KV |
| TAG-App | öffentlicher Fixture-MVP auf Cloudflare Pages existiert | keine autoritative API, keine Owner- oder Vault-Verwaltung |
| Control Center | keine Anwendung, keine Migrationen, keine DB oder API im Repository | erst nach Plan- und Produktfreigabe implementieren |
| Cloudflare-Publishing | als Zielprozess dokumentiert | keine Browser-Tokens, keine manuelle KV-Fachpflege |
| Produktion | keine Control-Center-Produktivfreigabe | Staging-Abnahme ist zwingend vorgeschaltet |

## Blocker und offene Entscheidungen

| ID | Betroffener Bereich | Beschreibung | Auflösungskriterium |
| --- | --- | --- | --- |
| `CC-BLK-001` | CC-I01 | PHP-Version, Framework, Composer-Verfügbarkeit, MySQL-Version sowie Cron-/Queue-Möglichkeiten des Dogado-Hostings sind noch nicht verbindlich bestätigt. | Hosting-Matrix und gewählter technischer Stack sind dokumentiert und für Staging verfügbar. |
| `CC-BLK-002` | CC-I01 | Admin-Authentisierung, verpflichtende MFA und möglicher Passkey-/Mail-Provider sind noch nicht festgelegt. | Sicherheitsentscheidung einschließlich Recovery-, Session- und MFA-Policy ist freigegeben. |
| `CC-BLK-003` | CC-I02 | Für reale TAG-Ausgabe müssen sichere serverseitige Feistel-/HMAC- und Claim-Credential-Integration, Produkt-/Pool-/Claim-Policies sowie Staging-Secrets verfügbar sein; diese dürfen nie in Fixtures liegen. | Staging-Secret-Prozess und versionierte Pool-/Claim-Policies sind freigegeben, Secrets sind serverseitig hinterlegt und die Ausgabelogik gegen Testvektoren geprüft. |
| `CC-BLK-004` | CC-I03 | Der aktive Staging-Worker und sein tatsächlich gebundener `TAG_CONFIG`-Namespace müssen vor jeder echten KV-Änderung identifiziert werden. | Cloudflare-Ressourcenzuordnung, Least-Privilege-Token und Testnamespace sind dokumentiert. |
| `CC-BLK-005` | CC-I04 | Die endgültige Origin der öffentlichen PHP-Read-API und die CORS-Allowlist für die TAG-App sind noch offen. | Staging-Origin, HTTPS/TLS, CORS-Policy, Rate-Limit- und Cache-Policy sind freigegeben. |
| `CC-BLK-006` | CC-I05 | Laufzeiten, Quoten, Verlängerungsregeln, POI-Nachweisform, Retention und Moderations-SLAs sind noch Produktentscheidungen. | Versionierte Produktpolicy und rechtlich/operativ bestätigte POI- und Löschregeln liegen vor. |

## Aktualisierungsregel

Nach jeder Iteration werden:

1. Arbeitspakete und Stories mindestens auf `implemented` gesetzt, wenn Code **und** zugehörige Tests existieren;
2. [30-TRACEABILITY.md](30-TRACEABILITY.md) um Code-, Testdaten- und Evidenzreferenzen ergänzt;
3. `verified` erst nach erfolgreichen automatisierten Tests, Sicherheitsprüfungen und erforderlicher Staging-Evidenz vergeben;
4. fehlende externe Voraussetzungen als `blocked` sichtbar gehalten;
5. Änderungen am öffentlichen Routing-Vertrag zusätzlich mit Edge-Router- und TAG-App-Strang abgestimmt.

Für `CC-I03` setzt `verified` einen realen, dokumentierten Staging-Publish und Unpublish voraus. Für `CC-I04` zusätzlich den End-to-End-Nachweis Scan → Edge Router → TAG-App → öffentliche Read-API.
