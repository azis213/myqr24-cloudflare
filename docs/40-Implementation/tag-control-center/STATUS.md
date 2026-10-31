# Implementierungsstatus: TAG Control Center

**Letzte Aktualisierung:** 2026-10-31
**Statusregeln:** [README.md](README.md)  
**Fachliche Stories:** [10-USER-STORIES.md](10-USER-STORIES.md)  
**Wichtig:** Eine separate React-/Vite-TCC-Shell existiert unter `apps/tag-control-center/`. Sie implementiert den lokalen Admin- und W2L-Slice: serverseitig abgesicherten Login, E-Mail-MFA, Sessionstatus, Logout, sichtbare Allocation Pools, private TAG-Listen je sichtbarem Pool, explizite Re-Authentisierung, lokale synthetische Reservierung und lokale Lifecycle-Übergänge. Sie enthält weder Secrets noch fachliche Browserautorität.

## Iterationen

| Iteration | Ziel | Wesentliche Ergebnisse | Abhängigkeiten | Status |
| --- | --- | --- | --- | --- |
| `CC-I01` | Fundament und Sicherheitsbasis | ADR-002, separates React-/Vite-Projektgrundgerüst, TCP-Readiness-Check, versionierter W1L-Contract für serverseitigen Passwort-/Session-/E-Mail-MFA-/Logout-Flow und Bootstrap-Admin; lokale TCC-Contract-UI-Suite (6 Tests), TCP-MySQL-Suite (11 Tests/65 Assertions), TCC-Build und Dependency-Audit ohne bekannte Vulnerabilities; Rollen, Recovery und Ziel-MFA verbleiben offen | Dogado-Laufzeit, Staging-Mailtransport, Rollen-/Recovery-/Ziel-MFA-Entscheidung | implemented |
| `CC-I02` | Pools, TAG-Stammdaten und sichere Vergabe | Plattformweite Range-/Pool-Anlage und Range-/Pool-Bearbeitung nach TCP-Re-Auth, sichtbare Pools, private TAG-Liste je sichtbarem Pool, TCP-bestätigte lokale Fake-Codec-Reservierung mit Jobnachweis und lokale Lifecycle-Übergänge; Claim-/Vorabzuweisung und QR-/Druckvorbereitung folgen | Gruppen-/Feature-Validatoren, Produkt-/Pool-/Claim-Defaults, Internal-HTTP-Codec und Staging-Nachweise | in-progress |
| `CC-I03` | Routing-Projektion und Publishing | Feature-Schemas, Projektion, Outbox, idempotenter Publisher, Publish-Diff, Retry, Unpublish | Cloudflare-Token, Staging-KV-Namespace, Edge-Router-Vertrag | planned |
| `CC-I04` | Öffentlicher Basis-Vault | veröffentlichte Basisinhalte, öffentliche Read-API, CORS/Cache/Rate-Limits, TAG-App-Adaptervertrag | API-Origin, TAG-App-Integration, Staging-Deployment | planned |
| `CC-I05` | Produktklassen, Organisationen und POI | Produktpolicies, Organisationsrollen, POI-Onboarding, Nachweise, Review, Meldungen und Moderationsdefaults | verbindliche Produkt-, Retention- und POI-Entscheidungen | planned |
| `CC-I06` | Erweiterte Vault- und Betriebsfunktionen | Owner-/Empfängerfreigaben, Medienpipeline, Reporting, Retention und operative Workflows | R2/API-Architektur, Datenschutz- und Sicherheitsfreigaben | deferred |
| `CC-I07` | Kontrollierter JSON-Druckexport | Nach lauffähigem TCC-/TCP-Fundament: Exportauftrag für eine logische TAG-Range, Download eines unveränderlichen JSON-Snapshots mit Auftrags-ID, erneuter Download/Ausgabe, Audit sowie fachliche QA-/Ausschuss-/Nachdruck-/Übergabeworkflows | CP-I03, versionierte Export-/Claim-/QA-Policy, autoritative Reservierungs- und Statusdaten | deferred |

## Arbeitspakete

| ID | Arbeitspaket | Iteration | Status | Abhängigkeit / erwartete Evidenz |
| --- | --- | --- | --- | --- |
| `CC-WP-01` | Architekturvertrag, Projektgrenzen und Konfigurationsmodell | CC-I01 | implemented | [ADR-002](../../../10-Architecture/ADR-002-ADMINISTRATION_BOOTSTRAP_AND_SECRET_BOUNDARIES.md), eigenständige TCC-Shell unter `apps/tag-control-center/`, keine browserseitige Secret- oder Deployment-Konfiguration |
| `CC-WP-02` | Admin-Authentisierung, Rollen, Sessions, CSRF und Audit-Grundlage | CC-I01 | implemented | [`control-plane-admin-api-v1`](../../10-Architecture/35-Contracts/control-plane-admin-api-v1.md) beschreibt TCP-Web-Session, CSRF, Rate-Limits, Audit, Bootstrap-Admin und E-Mail-MFA mit TCC-Login/Logout. `npm run test:tcc` (10 Tests), `npm run build:tcc` und TCP `npm run local:test` (17 Tests/106 Assertions) sind am 2026-10-29 erfolgreich; die W2L-Re-Auth wird serverseitig erzwungen. Recovery, Passkey/TOTP und Staging-Mail-/Cookie-Evidenz bleiben offen |
| `CC-WP-03` | Autoritatives MySQL-Kernschema und Migrationsstrategie | CC-I01 | planned | CC-TC-SCHEMA-*, Restore-/Migrationsevidenz |
| `CC-WP-04` | Allocation-Pool-, Range-, Gruppen- und Feature-Verwaltung | CC-I02 | in-progress | TCC lädt TCP-bestätigte sichtbare Pools; `platform-admin` kann nach frischer TCP-Re-Authentisierung kanonische 6-/8-/10-stellige Ranges und Plattformpools aus aktiven gleichlangen TCP-Ranges anlegen. `PATCH`, Organisationspools, Gruppen- und Feature-Verwaltung folgen |
| `CC-WP-05` | Control-Plane-gestützte TAG-Vergabe und Lebenszyklusverwaltung | CC-I02 | in-progress | TCC verlangt Poolauswahl, frische TCP-Re-Authentisierung, CSRF und browserseitigen Idempotency-Key. Es zeigt ausschließlich TCP-bestätigte Reservierungen; TCP kann lokal Fake oder den serverseitigen Loopback-Private-Codec verwenden. TCC erhält niemals Codec-Konfiguration oder Key. Lifecycle- und Update-Commands folgen lokal. |
| `CC-WP-05A` | Claim-Strategie, Vorabzuweisung und Claim-Support-UX | CC-I02 | planned | CC-TC-CLAIM-*, CC-TC-PREASSIGN-*; keine Credential-/Hash-Fachlogik in der UI |
| `CC-WP-06` | QR-Code- und Scan-URL-Vorbereitung für reservierte TAGs | CC-I02 | planned | kanonische URL-/QR-Daten ohne Druckfreigabe, Produktion, Range-Export oder Aktivierungswirkung |
| `CC-WP-16` | Kontrollierter TCC-JSON-Druckexport für logische TAG-Ranges | CC-I07 | deferred | Berechtigungsprüfung, Anlegen eines persistenten Exportauftrags für eine `decodedValue`-Range, Download und erneuter Download eines unveränderlichen JSON-Snapshots mit Auftrags-ID, Datenminimierung, Ablauf und Audit. Der JSON-Snapshot enthält je TAG ID, kanonische Scan-URL, QR-Payload und – nur sofern der TAG nicht organisationsgebunden freigeschaltet ist – die zugehörige Claim-PIN. Keine PDF-/Label-Aufbereitung, Druckeransteuerung oder physische Ausgabe. |
| `LOCAL-PRINT-TOOL` | Lokales PDF-/Label-Aufbereitungstool als spätere Single-Page-Anwendung unter `tools/` | außerhalb TCC-Iterationen | deferred | verarbeitet ausschließlich einen freigegebenen JSON-Exportauftrag lokal zu versionierten Zweckform-PDF-Labels mit QR-Code und übernimmt dessen `exportOrderId` als PDF-Header; die Ausgabe erfolgt ausschließlich über den lokalen Browser-/Betriebssystemdruckdialog. Keine API, DB, Reservierung, Range-Auswahl oder Aktivierungswirkung. |
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
| Dokumentation | Control-Plane-Architektur, Fachregeln und ADR-002 für Administration, Bootstrap, MFA und Secret-Grenzen sind vorhanden | kein produktiver Admin- oder Secret-Konfigurationspfad |
| Edge Router | Cloudflare-Worker-Code und Testbasis existieren | keine Verwaltungslogik oder Fachdaten im Worker/KV |
| TAG-App | öffentlicher Fixture-MVP auf Cloudflare Pages existiert | keine autoritative API, keine Owner- oder Vault-Verwaltung |
| Control Center | separate React-/Vite-Shell auf Port `5174`, Sicherheits-/Rollenübersicht, lokaler TCP-Readiness-Check, Login/MFA/Logout sowie TCP-bestätigte Range-/Pool-Anlage, Poolansicht, Re-Auth und lokale Reservierung über same-origin `/tcp`; Vitest-Contract-UI-Suite für Session, CSRF, Login, MFA, Logout, Readiness, Ranges, Pools und Reservierung | keine Range-/Pool-Updates, Organisationspool- oder Lifecycle-/Publish-Mutationen, keine Rollenverwaltung oder Recovery; produktive Origin-/CORS-/Cookie-Policy, Ziel-MFA und echte Internal-Codec-Integration bleiben offen |
| Cloudflare-Publishing | als Zielprozess dokumentiert | keine Browser-Tokens, keine manuelle KV-Fachpflege |
| Produktion | keine Control-Center-Produktivfreigabe | Staging-Abnahme ist zwingend vorgeschaltet |

## Blocker und offene Entscheidungen

| ID | Betroffener Bereich | Beschreibung | Auflösungskriterium |
| --- | --- | --- | --- |
| `CC-BLK-001` | CC-I01 | PHP-Version, Framework, Composer-Verfügbarkeit, MySQL-Version sowie Cron-/Queue-Möglichkeiten des Dogado-Hostings sind noch nicht verbindlich bestätigt. | Hosting-Matrix und gewählter technischer Stack sind dokumentiert und für Staging verfügbar. |
| `CC-BLK-002` | CC-I01 | partially-resolved: Bootstrap-Admin, serverseitige Session, CSRF, Audit und übergangsweise E-Mail-MFA sind lokal implementiert und getestet. Passkey/TOTP, Recovery, Rollenverwaltung, Re-Authentisierung, produktiver Mail-Transport sowie Origin-/Cookie-Policy bleiben offen. | Ziel-Auth-/MFA-/Recovery-/Rollencontract, Mail-Provider und serverseitige Sicherheitsimplementierung sind gegen Staging getestet und freigegeben. |
| `CC-BLK-003` | CC-I02 | `partially-resolved`: TCC nutzt ausschließlich die TCP-Response. TCP verwendet lokal entweder den secret-freien Fake oder, ausschließlich serverseitig, den Loopback-Private-Codec mit synthetischen ignorierten Secrets. TCC besitzt weder Feistel-Secret, Service-Key noch Netzwerkzugriff auf den Codec. | Lokaler TCP→Loopback-Codec-6/8/10-Nachweis einschließlich Timeout-/Resume-Fällen; externe Staging-Evidenz bleibt separat. |
| `CC-BLK-008` | CC-I02 | `partially-resolved`: W2L-Policy, Organisationsgrenze und 15-Minuten-Re-Auth sind serverseitig für Range-/Pool-Anlage, Pool-Read und Reservierung umgesetzt; TCC-Contracttests decken die Plattformadmin-Range-/Pool-Anlage ab. | Update- und Lifecycle-Commands verwenden dieselben Guards mit vollständigen Validator- und TCC-Contracttests. |
| `CC-BLK-004` | CC-I03 | Der aktive Staging-Worker und sein tatsächlich gebundener `TAG_CONFIG`-Namespace müssen vor jeder echten KV-Änderung identifiziert werden. | Cloudflare-Ressourcenzuordnung, Least-Privilege-Token und Testnamespace sind dokumentiert. |
| `CC-BLK-005` | CC-I04 | Die endgültige Origin der öffentlichen PHP-Read-API und die CORS-Allowlist für die TAG-App sind noch offen. | Staging-Origin, HTTPS/TLS, CORS-Policy, Rate-Limit- und Cache-Policy sind freigegeben. |
| `CC-BLK-006` | CC-I05 | Laufzeiten, Quoten, Verlängerungsregeln, POI-Nachweisform, Retention und Moderations-SLAs sind noch Produktentscheidungen. | Versionierte Produktpolicy und rechtlich/operativ bestätigte POI- und Löschregeln liegen vor. |
| `CC-BLK-007` | CC-I07 / `LOCAL-PRINT-TOOL` | JSON-Exportschema, Freigabe, logische Range-Auswahl, persistente Exportaufträge, Wiederausgabe, PIN-Verschlüsselung, QA, Nachdruck und Übergabe sind noch nicht als Produktionsprozess freigegeben. PDF-/Label-Vorlagenversion und lokale Aufbereitungsregeln sind getrennt festzulegen. Das lokale Tool verarbeitet ausschließlich einen freigegebenen JSON-Export ohne Autoritäts- oder Aktivierungswirkung. | Versionierte Export-/QA-/Übergabepolicy, TCC-/TCP-JSON-Exportcontract einschließlich PIN-Schutz- und Wiederausgaberegeln; für das lokale Tool zusätzlich ein konkret versioniertes Zweckform-Format und lokale Sicherheits-/Datenminimierungsprüfung. |

## Nächster zulässiger Implementierungsschritt

1. Die TCC-Contracttests nach dem lokalen TCP→Loopback-Codec-Nachweis auf serverbestätigte reale Codec-Versionen, Resume- und Neutralitätsfehler erweitern. TCC erhält weder Konfiguration noch Key und ruft den Codec nie direkt auf; eine externe Staging-Entscheidung erfolgt erst nach Abschluss der lokalen Welle.

## Aktualisierungsregel

Nach jeder Iteration werden:

1. Arbeitspakete und Stories mindestens auf `implemented` gesetzt, wenn Code **und** zugehörige Tests existieren;
2. [30-TRACEABILITY.md](30-TRACEABILITY.md) um Code-, Testdaten- und Evidenzreferenzen ergänzt;
3. `verified` erst nach erfolgreichen automatisierten Tests, Sicherheitsprüfungen und erforderlicher Staging-Evidenz vergeben;
4. fehlende externe Voraussetzungen als `blocked` sichtbar gehalten;
5. Änderungen am öffentlichen Routing-Vertrag zusätzlich mit Edge-Router- und TAG-App-Strang abgestimmt.

Für `CC-I03` setzt `verified` einen realen, dokumentierten Staging-Publish und Unpublish voraus. Für `CC-I04` zusätzlich den End-to-End-Nachweis Scan → Edge Router → TAG-App → öffentliche Read-API.
