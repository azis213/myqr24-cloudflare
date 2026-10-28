# Implementierungsstatus: TAG Control Plane

**Letzte Aktualisierung:** 2026-10-28  
**Statusregeln:** [README.md](README.md)  
**Fachliche Stories:** [10-USER-STORIES.md](10-USER-STORIES.md)  

Die TAG Control Plane (TCP) ist das künftige autoritative Laravel-/MySQL-Backend. Sie enthält derzeit ausschließlich ein policy-neutrales technisches Fundament; sie ist weder als Admin-API noch als öffentliche Runtime-API freigegeben.

## Iterationen

| Iteration | Ziel | Wesentliche Ergebnisse | Abhängigkeiten | Status |
| --- | --- | --- | --- | --- |
| `CP-I01` | Plattformfundament | Laravel-13-Anwendung, MySQL-/UTC-Defaults, Audit-Basis, requestweite Korrelation, Health-/Readiness-Endpunkte, lokale Tests | Dogado PHP/MySQL/Composer/Cron, Auth-Entscheidung, lokaler MySQL-Compose-Nachweis | in-progress |
| `CP-I02` | Pools, Ranges und TAG-Lebenszyklus | Allocation Pools für Zielgruppen/Partner/Großkunden, Range-Validator, atomarer linearer 6-/8-/10-stelliger Allocator, TAG-Stammdaten, Statusautomat und Sperrung | serverseitige Testsecrets, freigegebene Produkt-/Pooldefaults | planned |
| `CP-I03` | Claiming und kontrollierter JSON-Export | Claim-Gruppen und -Credentials, verschlüsselte Claim-PIN-Persistenz, Owner-Vorabzuweisung, persistente JSON-Exportaufträge für logische TAG-Ranges, unveränderliche Snapshots mit `exportOrderId` sowie externe QA-/Ausschuss-/Nachdruck-/Übergabereferenzen | Exportcontract, Claim- und Qualitätsprozess | planned |
| `CP-I04` | Routing-Projektion und Publishing | Feature-Validator, Projektion, Outbox, idempotenter KV-Publisher, Publish/Unpublish und Rollback | Staging-KV, least-privilege Cloudflare-Token, Edge-Vertrag | planned |
| `CP-I05` | Öffentliche Basisdaten | veröffentlichter Basis-Vault, Public Read API, CORS/Cache/Rate Limits und TAG-App-Contract | Staging-API-Origin und PWA-Integration | planned |
| `CP-I06` | Produkt-, Organisation- und POI-Policies | Produktgrenzen, Organisationen, POI-Review, Nachweise, Moderations- und Retention-Policies | Produkt-/Rechts-/Betriebsentscheidungen | planned |
| `CP-I07` | Erweiterte Vault-Runtime | private Freigaben, Medien, Uploads, R2-Workflows und komplexe Endnutzerfeatures | separate Runtime-API, R2, Datenschutzfreigabe | deferred |

## Arbeitspakete

| ID | Arbeitspaket | Iteration | Status | Erwartete Evidenz |
| --- | --- | --- | --- | --- |
| `CP-WP-01` | Backend-Architektur, Konfigurations- und Secret-Grenzen | CP-I01 | in-progress | Laravel-13-Projekt und MySQL-/UTC-Defaults vorhanden; reale Dogado-Hosting- und Secrets-Integration ausstehend |
| `CP-WP-02` | MySQL-Kernschema, Migrationen und Transaktionskonzept | CP-I01 | in-progress | Laravel-Migration für append-only Audit-Ereignisse vorhanden; MySQL-8.4-Compose-Ausführung und Wiederherstellungsnachweis ausstehend |
| `CP-WP-03` | Serverseitige AuthZ-Grenzen und Audit-Infrastruktur | CP-I01 | in-progress | rekursive Audit-Redaktion, Audit-Modell/-Service sowie Korrelation implementiert; konkrete Admin-AuthZ, Sessions, CSRF und MFA bleiben gesperrt |
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

## CP-I01-Implementierungsstand – 2026-10-28

`apps/tag-control-plane/` enthält jetzt ein Laravel-13-Projekt mit PHP 8.3+ und Composer-Lockfile. Die bisherigen experimentellen Raw-PHP-Komponenten wurden nicht als produktiver Laufzeitpfad übernommen: Laravel ersetzt eigene PDO-Factory, Transaktionsmanager und SQL-Migration-Runner.

### Implementiert

- MySQL ist der Laravel-Default (`DB_CONNECTION=mysql`); SQLite ist kein TCP-Default und keine Testdatenbank.
- `config/app.php` verwendet fest UTC; die lokale Beispielkonfiguration setzt zusätzlich `APP_TIMEZONE=UTC`.
- `.env.example` dokumentiert ausschließlich MySQL sowie file-/sync-basierte Session-, Cache- und Queue-Defaults. Dadurch wird keine Datenbank-Session-, Queue- oder Cache-Topologie vorweggenommen.
- Die Laravel-Migration `2026_10_28_000000_create_audit_events_table.php` bildet die vorhandene Auditstruktur mit UUID-Korrelation, JSON-Metadaten, Mikrosekundenzeit und Objekt-/Actor-/Korrelationsindizes ab.
- `AuditSanitizer` redigiert sensitive Metadaten rekursiv, insbesondere Credential-, Passwort-, Secret-, Token-, API-Key-, Cookie- und Session-Felder.
- `AuditService` persistiert Audit-Ereignisse ausschließlich mit einer expliziten, validen Korrelations-UUID; er leitet keine Identität aus einer noch nicht entschiedenen Authentisierung ab.
- Die globale Middleware `AssignCorrelationId` übernimmt nur gültige eingehende `X-Correlation-Id`-UUIDs, erzeugt andernfalls eine neue UUID und spiegelt sie im Response-Header.
- `GET /api/v1/health` bestätigt die Prozess-Erreichbarkeit ohne Datenbankzugriff.
- `GET /api/v1/ready` prüft eine Datenbankverbindung und liefert bei fehlender Verbindung kontrolliert `503 not_ready`.
- Die API-Antworten werden als JSON gerendert; beide Betriebsendpunkte enthalten ihre Korrelations-ID auch im Antwortkörper.
- Lokaler Qualitätsnachweis: `php artisan test --compact` erfolgreich mit **3 Tests und 11 Assertions**.

### Bewusste Grenzen

- Keine Benutzer-, Rollen-, Session-, Recovery-, MFA-, CSRF- oder Admin-Endpunkte.
- Keine Authentisierungsbibliothek und keine Laravel-User-/Password-Reset-Migration.
- Keine fachlichen Tabellen außer `audit_events`.
- Keine Allocation-Pools, Ranges, TAGs, Claims, Exporte, Outbox, KV-Publisher oder Public-Read-API.
- Keine Cloudflare-, Codec-, R2- oder sonstige externe Netzwerkoperation.
- Der Docker-Compose-Prüfpfad für die Laravel-Migration ist implementiert, konnte am 2026-10-28 jedoch nicht ausgeführt werden, weil der lokale Docker-Desktop-Linux-Daemon nicht lief.

## Ausgangsstatus

| Bereich | Vorhandener Stand | Bewusste Grenze |
| --- | --- | --- |
| Edge Router | Worker validiert und löst öffentliche TAG-Routingdaten aus KV auf | keine Control-Plane- oder Produktionsdaten im Worker |
| TAG-App | Fixture-basierter öffentlicher PWA-MVP | keine autoritative Public-API-Integration |
| TAG Control Center | Planungsdokumentation für die spätere Admin-UI | keine UI-Implementierung und keine Backend-Autorität |
| TAG Control Plane | Laravel-13-/MySQL-Fundament mit UTC, Audit-Redaktion, Korrelations-ID sowie Health-/Readiness-Endpunkten | keine Admin-API und keine konkrete AuthZ-/MFA-Implementierung; keine fachliche TCP-Domäne |
| Cloudflare KV | vorhandene Router-Projektion | keine Fachquelle, keine manuelle Produktionspflege |

## Blocker und offene Entscheidungen

| ID | Bereich | Beschreibung | Auflösungskriterium |
| --- | --- | --- | --- |
| `CP-BLK-001` | CP-I01 | `partially-resolved`: Laravel-/MySQL-Laufzeitbasis ist lokal vorhanden. Reale Dogado-Stagingwerte für VHost, Dateirechte, Composer, Cron, MySQL-TLS, Backups und Secret-Speicher sind weiterhin nicht als Betriebsevidenz bestätigt. | Redigierte Staging-Hostingmatrix, Technologieentscheidung und externer Betriebsnachweis liegen vor. |
| `CP-BLK-002` | CP-I01 | Das verbindliche Authentisierungs-/MFA-Modell wird von Control Center und Plane gemeinsam benötigt. | Rollen-, Session-, Recovery- und MFA-Policy ist freigegeben. |
| `CP-BLK-003` | CP-I02 | Feistel-Secrets und serverseitige kompatible Testvektoren fehlen für reale Vergabe. | getrennte Staging-Secret-Integration und Testvektoren für den linearen 6/8/10-Vertrag sind verfügbar. |
| `CP-BLK-004` | CP-I03 | JSON-Exportcontract, Auftrags- und Wiederdownloadregel, PIN-Verschlüsselung, Berechtigung, Qualitätsprüfprozess, Nachdruckregel, Support-Reset und Lager-/Übergabemodell sind offen. | versionierte Export-, Claim- und QA-Policy ist freigegeben. |
| `CP-BLK-005` | CP-I04 | Aktiver Staging-Worker, gebundener KV-Namespace und minimaler Cloudflare-Publisher-Token sind nicht abschließend identifiziert. | Ressourcen, Tokenumfang und Sandbox-Namespace sind dokumentiert. |
| `CP-BLK-006` | CP-I05 | Staging-Origin der Public Read API, CORS-Allowlist und Cache-Widerrufsbudget sind offen. | HTTPS-/CORS-/Cache-/Rate-Limit-Policy ist bestätigt. |
| `CP-BLK-007` | CP-I06 | POI-Nachweis, Retention, Moderations-SLA und kommerzielle Produktlimits sind Produkt-/Compliance-Entscheidungen. | versionierte fachliche Policies sind freigegeben. |
| `CP-BLK-008` | CP-I01 | Der lokale Docker-Desktop-Linux-Daemon war am 2026-10-28 nicht gestartet; deshalb konnte der vorbereitete MySQL-8.4-Migrations-/Rollback-Nachweis nicht ausgeführt werden. | Docker Desktop starten und `--profile verify-tcp run --rm tag-control-plane-verify` erfolgreich ausführen. |

## Nächster zulässiger Implementierungsschritt

1. Lokalen Docker-Daemon starten und den vorbereiteten Laravel-MySQL-Check gegen die isolierte MySQL-8.4-Compose-Instanz ausführen.
2. Den Migration-/Rollback-/UTC-Nachweis als Evidenz festhalten.
3. Erst danach CP-WP-02 abschließen und CP-I02 contract-first beginnen.
4. Admin-API und TAG Control Center bleiben bis zur Entscheidung `CP-BLK-002` serverseitig geschlossen.

## Aktualisierungsregel

Ein Arbeitspaket wird erst `implemented`, wenn seine serverseitige Implementierung, Tests und Traceability-Verweise vorhanden sind. `verified` setzt zusätzlich erfolgreiche Staging-Evidenz voraus:

- für `CP-I03`: vertraulicher JSON-Snapshot mit `exportOrderId`, unveränderter Wiederdownload, Claim mit Fehlversuchs-/Sperrfall, QA-/Ausschussreferenz und kontrollierte Aktivierung;
- für `CP-I04`: realer Staging-Publish **und** Unpublish mit isoliertem Namespace;
- für `CP-I05`: Scan → Edge Router → TAG-App → Public Read API mit positivem und neutralem Negativfall.
