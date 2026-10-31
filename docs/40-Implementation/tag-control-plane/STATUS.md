# Implementierungsstatus: TAG Control Plane

**Letzte Aktualisierung:** 2026-10-31
**Statusregeln:** [README.md](README.md)  
**Fachliche Stories:** [10-USER-STORIES.md](10-USER-STORIES.md)  

Die TAG Control Plane (TCP) ist das künftige autoritative Laravel-/MySQL-Backend. Sie enthält ein technisches Sicherheitsfundament mit lokalem Bootstrap-Admin, serverseitiger Session-Authentisierung und übergangsweiser E-Mail-MFA. Der aktuelle browserseitige W1L-Schnitt ist als [`control-plane-admin-api-v1`](../../10-Architecture/35-Contracts/control-plane-admin-api-v1.md) `implemented-local`; eine fachliche Admin-API oder öffentliche Runtime-API ist weiterhin nicht freigegeben.

## Iterationen

| Iteration | Ziel | Wesentliche Ergebnisse | Abhängigkeiten | Status |
| --- | --- | --- | --- | --- |
| `CP-I01` | Plattformfundament | Laravel-13-Anwendung, MySQL-/UTC-Defaults, Audit-Basis, requestweite Korrelation, Health-/Readiness-Endpunkte, lokale MySQL-8.4-Tests sowie TCC-Contract-UI-Nachweis für den W1L-Browservertrag | Dogado PHP/MySQL/Composer/Cron, Auth-Entscheidung | implemented |
| `CP-I02` | Pools, Ranges und TAG-Lebenszyklus | W2L-Baseline für AuthZ, Organisationsgrenze, Re-Authentisierung, Pool-Read, Range-/Pool-Anlage und idempotente `PATCH`-Updates mit Audit sowie secret-freie lokale Reservierung mit Allocation-Job; Lifecycle folgt | Produkt-/Pooldefaults, Internal-HTTP-Codec und Staging-Nachweise | in-progress |
| `CP-I03` | Claiming und kontrollierter JSON-Export | Claim-Gruppen und -Credentials, verschlüsselte Claim-PIN-Persistenz, Owner-Vorabzuweisung, persistente JSON-Exportaufträge für logische TAG-Ranges, unveränderliche Snapshots mit `exportOrderId` sowie externe QA-/Ausschuss-/Nachdruck-/Übergabereferenzen | Exportcontract, Claim- und Qualitätsprozess | planned |
| `CP-I04` | Routing-Projektion und Publishing | Feature-Validator, Projektion, Outbox, idempotenter KV-Publisher, Publish/Unpublish und Rollback | Staging-KV, least-privilege Cloudflare-Token, Edge-Vertrag | planned |
| `CP-I05` | Öffentliche Basisdaten | veröffentlichter Basis-Vault, Public Read API, CORS/Cache/Rate Limits und TAG-App-Contract | Staging-API-Origin und PWA-Integration | planned |
| `CP-I06` | Produkt-, Organisation- und POI-Policies | Produktgrenzen, Organisationen, POI-Review, Nachweise, Moderations- und Retention-Policies | Produkt-/Rechts-/Betriebsentscheidungen | planned |
| `CP-I07` | Erweiterte Vault-Runtime | private Freigaben, Medien, Uploads, R2-Workflows und komplexe Endnutzerfeatures | separate Runtime-API, R2, Datenschutzfreigabe | deferred |

## Arbeitspakete

| ID | Arbeitspaket | Iteration | Status | Erwartete Evidenz |
| --- | --- | --- | --- | --- |
| `CP-WP-01` | Backend-Architektur, Konfigurations- und Secret-Grenzen | CP-I01 | in-progress | Laravel-13-Projekt und MySQL-/UTC-Defaults vorhanden; reale Dogado-Hosting- und Secrets-Integration ausstehend |
| `CP-WP-02` | MySQL-Kernschema, Migrationen und Transaktionskonzept | CP-I01 | in-progress | Laravel-Migration für append-only Audit-Ereignisse vorhanden; lokaler MySQL-8.4-Migrations- und Rollback-Test gegen isolierte Testdatenbank erfolgreich; Wiederherstellungsnachweis bleibt ausstehend |
| `CP-WP-03` | Serverseitige AuthZ-Grenzen und Audit-Infrastruktur | CP-I01 | implemented | [`control-plane-admin-api-v1`](../../10-Architecture/35-Contracts/control-plane-admin-api-v1.md) dokumentiert Audit-Redaktion, Korrelation, lokalen Bootstrap-Admin, serverseitige Web-Session, CSRF-geschützte Auth-Endpunkte und kurzlebige E-Mail-MFA-Challenges. `npm run local:test` ist am 2026-10-29 mit 17 Tests/109 Assertions erfolgreich. Die W2L-Re-Authentisierung liegt serverseitig in derselben Sessiongrenze; fachliche Rollenverwaltung außerhalb der W2L-Matrix, Recovery und Passkey/TOTP bleiben offen |
| `CP-WP-04` | Allocation-Pool-, Range- und Gruppendomäne | CP-I02 | in-progress | Organisationen, Organisationsrollen, Range-/Pool-Schema, plattformweite Range-Sicht, serverseitige Range-/Pool-Anlage mit Re-Auth, kanonischer 6/8/10-Domäne, globaler Nichtüberlappung und aktiven gleichlangen Poolranges existieren; `PATCH`, Gruppen-/Feature-Referenzvalidatoren und Organisationspool-Anlage folgen |
| `CP-WP-05` | TAG-Allocator, Reservierung und Statusautomat | CP-I02 | in-progress | Lokaler `FakeTagCodecClient` ohne Feistel-Secret, `TEST-S01`, kanonische 6/8/10-Contract-Vektoren, `codec-pending`-Wertreservierung, kontrollierter Job-Resume, Idempotenz, Job-Persistenz, 1.000er-Grenze und Mapping-/Auditabschluss existieren. `InternalHttpTagCodecClient` ist lokal mit serverseitiger Konfiguration, festem 3-Sekunden-Timeout und neutraler Fehlernormalisierung vorbereitet, bleibt jedoch nicht gebunden; Staging-Nachweise folgen |
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
- Die Migration `2026_10_28_010000_create_users_and_email_mfa_challenges_tables.php` legt lokale Benutzer mit UUID, aktivem Status und Rolle sowie kurzlebige E-Mail-MFA-Challenges an. MFA-Codes werden ausschließlich als Hash gespeichert; Ablaufzeit, Einmalverwendung und Versuchszähler werden serverseitig erzwungen.
- `AuditSanitizer` redigiert sensitive Metadaten rekursiv, insbesondere Credential-, Passwort-, Secret-, Token-, API-Key-, Cookie- und Session-Felder.
- `AuditService` persistiert Audit-Ereignisse ausschließlich mit einer expliziten, validen Korrelations-UUID; er leitet keine Identität aus einer noch nicht entschiedenen Authentisierung ab.
- Die globale Middleware `AssignCorrelationId` übernimmt nur gültige eingehende `X-Correlation-Id`-UUIDs, erzeugt andernfalls eine neue UUID und spiegelt sie im Response-Header.
- `GET /api/v1/health` bestätigt die Prozess-Erreichbarkeit ohne Datenbankzugriff.
- `GET /api/v1/ready` prüft eine Datenbankverbindung und liefert bei fehlender Verbindung kontrolliert `503 not_ready`.
- Die API-Antworten werden als JSON gerendert; beide Betriebsendpunkte enthalten ihre Korrelations-ID auch im Antwortkörper.
- Unter `/api/v1/auth` existieren ausschließlich serverseitige Session-Endpunkte für CSRF-Token, Session-Status, Passwortschritt, E-Mail-MFA-Verifikation und Logout. Der vollständige aktuelle Browservertrag ist versioniert in [`control-plane-admin-api-v1`](../../10-Architecture/35-Contracts/control-plane-admin-api-v1.md). Schreibende Endpunkte liegen in der `web`-Middlewaregruppe, verwenden CSRF und Rate-Limits; der Browser erhält keine Secrets oder MFA-Codes.
- `tcp:bootstrap-platform-admin` ist der einzige Initialpfad für `TCP_BOOTSTRAP_ADMIN_EMAIL` (Default `azis213@gmail.com`). Er erstellt das Konto idempotent; eine Passwortänderung aus `TCP_BOOTSTRAP_ADMIN_INITIAL_PASSWORD` erfordert explizit `--reset-password`. Beide Mutationen werden auditiert.
- `.env.example` enthält nur nicht geheime Dogado-SMTP-Parameter (`web218.dogado.net`, SMTPS/465, Absender `reg01@azis.de`); Benutzername, Passwort und Bootstrap-Passwort bleiben leer und gehören ausschließlich in den Deployment-Secret-Store.
- Lokaler Qualitätsnachweis: `npm run local:test` erfolgreich gegen eine isolierte MySQL-8.4-Testdatenbank (`myqr24_test`) mit **17 Tests und 109 Assertions**. Der Lauf führt `migrate:fresh` ausschließlich gegen die Testdatenbank aus und prüft Auditpersistenz, Auth-Session, neutrale Login-Fehlernormalisierung, gehashte MFA-Challenge, MFA-Fehlversuch, Bootstrap-Reset-Schutz sowie W2L-Re-Auth, Organisationsgrenze, kanonische Range-/Pool-Anlage und Fake-Codec-Reservierung.
- Der zugehörige TCC-Browservertrag ist mit `apps/tag-control-center/src/App.test.tsx` lokal automatisiert: **6 Tests** für Sessionstatus, CSRF-Login, neutrale Ablehnung, MFA-Zwischenzustand/-Erfolg, Logout, Readiness und UI-Zustandsbereinigung. `npm run build:tcc` und der TCC-Dependency-Auditlauf sind ebenfalls grün.

### Bewusste Grenzen

- Keine Selbstregistrierung, Einladungen, fachliche Rollenverwaltung außerhalb der lokalen W2L-Policy, Passwort-Recovery, Passkey/TOTP-MFA, Recovery-Codes oder Session-Widerruf.
- E-Mail-MFA ist eine Übergangslösung; die konkrete produktive Mail-Transport-Erprobung und Staging-Freigabe stehen aus.
- Der lokale W2L-Slice enthält Organisationen, Organisationsrollen, Range-/Pool-Anlage, Allocation-Jobs, `codec-pending`-Wertreservierungen und TAG-Mappings; Range-/Pool-Updates, Lifecycle, Claims, Exporte, Outbox, KV-Publisher und Public-Read-API fehlen weiterhin.
- Der lokale `FakeTagCodecClient` führt keine Cloudflare-, Codec-, R2- oder sonstige externe Netzwerkoperation aus und enthält kein Feistel-Secret.
- Der lokale Docker-Compose-Prüfpfad wurde am 2026-10-28 erfolgreich gegen MySQL 8.4 ausgeführt. Dies ist kein Dogado-, Staging-, Backup-/Restore- oder Produktionsnachweis.

## Ausgangsstatus

| Bereich | Vorhandener Stand | Bewusste Grenze |
| --- | --- | --- |
| Edge Router | Worker validiert und löst öffentliche TAG-Routingdaten aus KV auf | keine Control-Plane- oder Produktionsdaten im Worker |
| TAG-App | Fixture-basierter öffentlicher PWA-MVP | keine autoritative Public-API-Integration |
| TAG Control Center | React-/Vite-Shell mit TCP-Session-Status, Passwort-Login, E-Mail-MFA-Dialog und Logout | keine fachlichen Verwaltungscommands, keine Rollenverwaltung und keine Secret-Konfiguration |
| TAG Control Plane | Laravel-13-/MySQL-Fundament mit UTC, Audit, Bootstrap-Admin, Web-Session, E-Mail-MFA sowie lokalem W2L-Slice für AuthZ, Re-Auth, Organisationsgrenzen und Fake-Codec-Reservierung | keine Range-/Pool-Mutationen oder Lifecycle-Commands, keine echte Internal-Codec-/Staging-Integration, keine produktive Mail-/Hosting-Evidenz und keine erweiterten Auth-Verfahren |
| Cloudflare KV | vorhandene Router-Projektion | keine Fachquelle, keine manuelle Produktionspflege |

## Blocker und offene Entscheidungen

| ID | Bereich | Beschreibung | Auflösungskriterium |
| --- | --- | --- | --- |
| `CP-BLK-001` | CP-I01 | `partially-resolved`: Laravel-/MySQL-Laufzeitbasis ist lokal vorhanden. Reale Dogado-Stagingwerte für VHost, Dateirechte, Composer, Cron, MySQL-TLS, Backups und Secret-Speicher sind weiterhin nicht als Betriebsevidenz bestätigt. | Redigierte Staging-Hostingmatrix, Technologieentscheidung und externer Betriebsnachweis liegen vor. |
| `CP-BLK-002` | CP-I01 | partially-resolved: lokaler Bootstrap-Admin, Session, CSRF und übergangsweise E-Mail-MFA sind implementiert. Passkey/TOTP-Zielverfahren, Recovery, Rollenverwaltung, Re-Authentisierung sowie produktive Mail-/Staging-Evidenz fehlen weiterhin. | Ziel-MFA-/Recovery-/Rollenpolicy ist freigegeben und gegen Staging-Mailtransport nachgewiesen. |
| `CP-BLK-003` | CP-I02 | `partially-resolved`: Feistel-Secrets verbleiben ausschließlich in Cloudflare-Workern. TCP verwendet lokal einen deterministischen, secret-freien Fake mit `TEST-S01`; `codec-pending`-Jobs verhindern Doppelvergaben und die lokale Retry-/Idempotenzgrenze ist getestet. Der lokale HTTP-Adapter bleibt ungebunden, weil der bekannte Workervertrag noch kein Batch-Encoding/`codecVersion` bereitstellt und Staging-Secret-/Route-/WAF-/Access-Nachweise fehlen. | Worker-Batchvertrag mit 6/8/10-Vektoren, serverseitiger Staging-Service-Key, 3-Sekunden-Adapterbindung, Chunk-Resume und redigierte Staging-Evidenz gemäß [`W2L-INTERNAL-CODEC-STAGING-GATE.md`](../10-Implementation-Orchestration/W2L-INTERNAL-CODEC-STAGING-GATE.md) liegen vor. |
| `CP-BLK-009` | CP-I02 | `partially-resolved`: Die serverseitige W2L-Matrix für Plattformadmin, Organisationsadmin und Allocation-Operator sowie das 15-Minuten-Re-Auth-Fenster sind für Pool-Read und Reservierung implementiert und getestet. | Range-/Pool-Mutationen und Lifecycle-Commands verwenden dieselben Guards mit vollständigen Validator-, Neutralitäts- und Re-Auth-Tests. |
| `CP-BLK-004` | CP-I03 | JSON-Exportcontract, Auftrags- und Wiederdownloadregel, PIN-Verschlüsselung, Berechtigung, Qualitätsprüfprozess, Nachdruckregel, Support-Reset und Lager-/Übergabemodell sind offen. | versionierte Export-, Claim- und QA-Policy ist freigegeben. |
| `CP-BLK-005` | CP-I04 | Aktiver Staging-Worker, gebundener KV-Namespace und minimaler Cloudflare-Publisher-Token sind nicht abschließend identifiziert. | Ressourcen, Tokenumfang und Sandbox-Namespace sind dokumentiert. |
| `CP-BLK-006` | CP-I05 | Staging-Origin der Public Read API, CORS-Allowlist und Cache-Widerrufsbudget sind offen. | HTTPS-/CORS-/Cache-/Rate-Limit-Policy ist bestätigt. |
| `CP-BLK-007` | CP-I06 | POI-Nachweis, Retention, Moderations-SLA und kommerzielle Produktlimits sind Produkt-/Compliance-Entscheidungen. | versionierte fachliche Policies sind freigegeben. |
| `CP-BLK-008` | CP-I01 | resolved: Der lokale Docker-Desktop-Linux-Daemon lief am 2026-10-28; `npm run local:test` hat die isolierte MySQL-8.4-Testdatenbank migriert und die Audit-/Rollback-Tests erfolgreich ausgeführt. | Kein weiterer lokaler Docker-Blocker. Dogado- und Wiederherstellungsnachweise verbleiben bei `CP-BLK-001`. |

## Nächster zulässiger Implementierungsschritt

1. Das blockierte [`W2L Internal-Codec-Staging-Gate`](../10-Implementation-Orchestration/W2L-INTERNAL-CODEC-STAGING-GATE.md) mit dem Cloudflare-/Dogado-Betrieb erfüllen; bis dahin bleibt `InternalHttpTagCodecClient` ungebunden und der Fake aktiv. Keine Staging-Anfrage wurde ausgeführt.
4. CP-WP-02 bleibt bis zum Restore-/Dogado-Nachweis `in-progress`; CP-I02 wird ausschließlich mit synthetischen lokalen Daten fortgesetzt.

## Aktualisierungsregel

Ein Arbeitspaket wird erst `implemented`, wenn seine serverseitige Implementierung, Tests und Traceability-Verweise vorhanden sind. `verified` setzt zusätzlich erfolgreiche Staging-Evidenz voraus:

- für `CP-I03`: vertraulicher JSON-Snapshot mit `exportOrderId`, unveränderter Wiederdownload, Claim mit Fehlversuchs-/Sperrfall, QA-/Ausschussreferenz und kontrollierte Aktivierung;
- für `CP-I04`: realer Staging-Publish **und** Unpublish mit isoliertem Namespace;
- für `CP-I05`: Scan → Edge Router → TAG-App → Public Read API mit positivem und neutralem Negativfall.
