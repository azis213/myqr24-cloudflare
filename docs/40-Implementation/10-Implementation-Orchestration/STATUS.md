# Operativer Orchestrierungsstatus: TAG-Plattform

**Orchestrierungsanweisung:** [`README.md`](README.md)  
**Stand:** 2026-10-31
**Gesamtstatus:** `in-progress`  
**Aktive Welle:** `W2L – lokaler Verwaltungs-Slice in progress`
**Nächster zulässiger Arbeitsschritt:** Das separate Staging-Gate für den vorbereiteten, bislang nicht gebundenen `InternalHttpTagCodecClient` planen: getrennte serverseitige Secrets, freigegebene Internal-Route/WAF-/Access-Grenze, redigierter kontrollierter Smoketest und kein Browserzugriff. Lokal besitzt der Adapter festen 3-Sekunden-Timeout sowie neutrale Transport-/429-/5xx-/Schemafehler; der `FakeTagCodecClient` besitzt kanonische 6-/8-/10-Contract-Vektoren und einen nachgewiesenen `codec-pending → codec_failed → resume → draft`-Pfad. Dogado-Deployment, echte Internal-Codec-Anbindung, Staging-Read-API und echter KV-Publish bleiben gesperrt.
**Regel:** `apps/tag-control-plane` und `apps/tag-control-center` sind im lokalen W1L-Umfang vorhanden. Persistenz-, Migrations-, Transaktions-, Outbox- und Rollbacktests laufen gegen die vorhandene isolierte Compose-MySQL-Topologie; Cloudflare, Dogado und Mail bleiben lokale Fakes. Reale Dogado-Verbindungen, echte Cloudflare-Tokens und manuelle oder automatisierte KV-Fachänderungen bleiben vor dem Deployment-Gate verboten. `docs/00-Refinement/` ist bei regulären Wiederanläufen und Umsetzungsarbeiten ausdrücklich ausgeschlossen; Ideen daraus werden erst nach einer dokumentierten Architektur-, Contract-, Story-, Test-, Traceability- und Statusübernahme verbindlich.

---

## 1. Verifizierter Ausgangszustand

| Bereich | Stand | Nachweis / Hinweis |
| --- | --- | --- |
| Edge Router | Staging-Scan-Worker `myqr24-edge-routing-staging` ist deployt; `https://s.myqr24.com/` antwortet mit `302` auf `https://www.myqr24.com/`. Der getrennte private Codec-Worker ist über `codec.s.myqr24.com/api/v1/*` live verifiziert. | Scan-Worker-Version `9db270fb-567d-4845-b1f0-67e6ecbef3f3`; Codec-Evidenz in `../evidence/README.md` |
| Plattform-Homepage | KV-freier Worker `myqr24-platform-home` ist für `www.myqr24.com/*` bereitgestellt. | Deployment-Version `b3372d68-ac0a-431e-a902-8fba9f2fb201`; öffentliche Seite wurde anschließend als sichtbar bestätigt |
| TAG-App | Bestehende React/Vite-PWA in `apps/tag-app`; öffentliche View-Darstellung ist fixturebasiert. | siehe `docs/40-Implementation/tag-app/STATUS.md` |
| Control Plane | Laravel-13-/MySQL-Fundament unter `apps/tag-control-plane` mit Audit, Korrelation, Bootstrap-Admin, Web-Session und Übergangs-E-Mail-MFA. | keine fachliche Domäne, keine Public-Read-API, kein Publisher und keine Produktionsdaten |
| Control Center | React-/Vite-Shell unter `apps/tag-control-center` mit Readiness, Login, E-Mail-MFA, Sessionstatus und Logout über same-origin `/tcp`. | keine Verwaltungscommands, Rollenverwaltung oder Secret-Konfiguration |
| Contracts | `tag-codec-internal-v1`, `tag-routing-projection-v1` und der lokale W1L-Browservertrag [`control-plane-admin-api-v1`](../../../10-Architecture/35-Contracts/control-plane-admin-api-v1.md) sind vorhanden. | Fach-, Public- und Owner-Contracts folgen in späteren Wellen |
| TAG Lab | Bestehendes lokales Tool vorhanden; noch kein orchestrierter Testtag-Katalog. | W0/W3-Arbeit |
| Produktion | Nicht Gegenstand der aktuellen Ausführung. | Staging-first, explizite Produktionsfreigabe erforderlich |

---

## 2. Wellenfortschritt

| Welle | Ziel | Status | Eintrittskriterium | Austrittskriterium |
| --- | --- | --- | --- | --- |
| `W0` | Lokaler Ausgangspunkt, Entscheidungen, Contracts und Testtopologie | `in-progress` | Orchestrierungsanweisung und Startstatus vorhanden | Lokale Contracts, Toolchain und Testtag-Policy dokumentiert; Deployment-Backlog separat geführt |
| `W1L` | Lokales Plane-Fundament und Admin-Sicherheitsrahmen | `implemented` | lokale Compose-MySQL-Topologie verifiziert | TCP-MySQL-Suite (11 Tests/65 Assertions), TCC-Contract-UI-Suite (6 Tests), TCC-Build und TCC-Dependency-Audit ohne Vulnerabilities am 2026-10-29 grün |
| `W2L` | Lokale Ranges, Pools, Reservierung, Lifecycle und CC-Verwaltung | `in-progress` | W1L-Gate erfüllt; lokale AuthZ-/Re-Auth-/Fake-Codec-Reservierung implementiert | Range-/Pool-Mutationen, Lifecycle, CP-G2 und lokale Story-Tests grün |
| `W3L` | Lokale Routing-Projektion und Publisher mit Fake-Adapter | `planned` | W2L-Gate erfüllt | Contract-, Outbox-, Retry- und Unpublish-Tests grün |
| `W3D` | Dogado-Deployment, echter Staging-Publish und Scan | `blocked` | W3L-Gate sowie Deployment-Blocker aufgelöst | `CP-G4`, Router-/PWA-Nachweis grün |
| `W4` | PublicTagView, Basis-Vault, TAG-App-API-Ablösung | `planned` | W3-Gate erfüllt | `CP-G5`, `CP-G6`, E2E-Evidenz grün |
| `W5` | Claiming, Besitzanker, Collections, Support | `planned` | W4-Gate erfüllt | Claim-/Lockout-/Leak-/Session-Gate grün |
| `W6` | Kontrollierter Druckexport, QA, Übergabe | `deferred` | lauffähiges TCC-/TCP-Fundament, W5-Gate und freigegebene Prozesspolicy | `CP-G3` und Staging-Probe grün; TCC/TCP erzeugen nur autorisierte Einzel-ID-/Range-Exporte, keine PDF-/Label-Aufbereitung oder physische Ausgabe |
| `W7` | Owner-Inhalte, Produkt, Organisation und POI | `planned` | W5-Gate und Policy-Freigaben; unabhängig vom zurückgestellten Druckumfang W6 | Policy-/Review-/Privacy-Gate grün |

---

## 3. W0-Arbeitspakete

| ID | Arbeitspaket | Betroffene Artefakte | Status | Abschlussnachweis |
| --- | --- | --- | --- | --- |
| `W0-WP-01` | Dogado-Hostingmatrix als nachgelagerten Deployment-Backlog führen: PHP, Extensions, Composer, MySQL, Cron/Queue, HTTPS, Secret-Speicher, Deploymentweg | [`W0-HOSTING-AND-STAGING-RESOURCE-MATRIX.md`](W0-HOSTING-AND-STAGING-RESOURCE-MATRIX.md) | `in-progress` | PHP `8.2`–`8.4`, Composer per SSH/PHP-Binary, Cron ab WEB M, Tariflimits und 3-Stunden-Backups mit 7-/14-tägiger Vorhaltung belegt; aktive Staging-Versionen, Sicherheits-, Rechte- und Deploymentparameter noch ausstehend. Dies blockiert ausschließlich Dogado-/Staging-Deployment und `verified`, nicht die lokale TCP-Implementierung. |
| `W0-WP-02` | Staging-Ressourcenmatrix erheben: API-Host, DB, Staging-KV, Pages-Origin, Publisher-Scope und DNS/CORS-Grenzen | [`W0-HOSTING-AND-STAGING-RESOURCE-MATRIX.md`](W0-HOSTING-AND-STAGING-RESOURCE-MATRIX.md) | `in-progress` | Lokale/Staging-Secret-Vorbelegung, Scan- und Codec-Routing sowie Codec-Live-Roundtrips festgelegt; Publisher-Scope, aktive Scan-Worker-/KV-Zuordnung, Plane-Read-API-CORS-/Cache-Policy und DNS-/TLS-Betriebszuständigkeit noch zu bestätigen |
| `W0-WP-03` | Contract Overview sowie initiale Routing- und W1L-Admin-Contracts | `docs/10-Architecture/35-Contracts/` | `completed` | Contract-Overview, `tag-codec-internal-v1`, `tag-routing-projection-v1` und [`control-plane-admin-api-v1`](../../../10-Architecture/35-Contracts/control-plane-admin-api-v1.md) mit Traceability- und Testreferenzen vorhanden; spätere Fach-/Public-Contracts bleiben separat geplant |
| `W0-WP-04` | Bestehenden Edge Router gegen Routing-Projection-Contract prüfen | `apps/edge-router/test/` | `planned` | grüne Contract-/Regressionstests |
| `W0-WP-05` | Gemeinsame lokale Testtopologie für PHP-/MySQL-Anwendungskomponenten: isoliertes MySQL, Fake-Cloudflare-Adapter, Testsecrets und Befehle | [`tools/local-php-mysql/`](../../../tools/local-php-mysql/README.md), [`README.md`](README.md), Plane-Teststrategie | `completed` | Compose-Konfiguration, privates MySQL-8.4-Netz, PHP-8.4-PDO-Testimage, verbindlicher Anwendungs-Testablauf und erfolgreicher lokaler Verbindungs-/UTF-8-/UTC-/Commit-/Rollback-Selbsttest |
| `W0-WP-06` | TAG-Lab-Testtag-Katalog und Datenminimierungsregeln konzipieren | `tools/tag-lab/` | `planned` | versionierter nichtproduktiver Katalogvertrag |
| `W0-WP-07` | Refinement-Bereich von verbindlicher Architektur und autonomer Umsetzung trennen | [`docs/00-Refinement/README.md`](../../../00-Refinement/README.md), [`AGENT.md`](../../../AGENT.md), [`README.md`](README.md) | `completed` | Refinement-README, globale Agentenregel und Orchestrierung schließen `docs/00-Refinement/` bei regulären Sessions aus und definieren den kontrollierten Übernahmeprozess. |

---

## 4. Aktive Blocker und Entscheidungen

| ID | Status | Beschreibung | Auflösungskriterium | Nächste Aktion |
| --- | --- | --- | --- | --- |
| `CP-BLK-001` | `deployment-blocked` | Dogado belegt PHP `8.2`–`8.4`, Composer per SSH/PHP-Binary, Cron ab WEB M, tarifabhängige nicht anpassbare Limits sowie regelmäßige Backups. Die öffentliche PHPInfo unter `https://8punkt4.dogado-webhosting.de/` zeigte am 2026-10-07 PHP `8.4.12` mit `FPM/FastCGI` und dokumentiert die verfügbare Modulkonfiguration. Der künftige Plane-Staging-VHost, seine tatsächlich aktivierten Pflichtmodule, Datenbankrechte, Secrets, TLS und der verbindliche Deployment-/Rollbackprozess fehlen weiterhin. | Vollständige, gegen die reale Staging-Umgebung bestätigte Hostingmatrix liegt ohne Secretwerte vor. Blockiert Dogado-Deployment und `verified`, nicht lokale TCP-Tests. | `W0-WP-01`; Matrix ergänzen, nachdem die lokale TCP-Stufe erfolgreich ist |
| `CP-BLK-002` | `partially-resolved` | Der lokale W1L-Session-/CSRF-/Passwortlogin-/E-Mail-MFA-/Logout-Schnitt ist als `control-plane-admin-api-v1` implementiert und dokumentiert. TCP-MySQL-Integration, TCC-Contract-UI-Suite, Build und Dependency-Audit sind lokal grün. Ziel-MFA (Passkey/TOTP), Recovery, Rollenpolicy, Re-Authentisierung, Session-Widerruf, produktiver Mailtransport und Staging-Cookie-/Origin-Policy fehlen. | Ziel-Sicherheitscontract ist freigegeben und gegen Staging-Mailtransport sowie kontrollierte Browsernachweise geprüft. | Zielpolicy vor privilegierten Fachcommands entscheiden |
| `CP-BLK-003` | `resolved` | Die ignorierte Vorbelegung `tools/.env.local` enthält die lokalen Testsecrets und wird mit identischen Namen/Werten ausschließlich in den Cloudflare Secret Store für Staging übernommen. Vektoren werden daraus zur Laufzeit erzeugt und niemals mit Secretwerten versioniert. | Lokale Regression, kontrollierte Secret-Store-Aktualisierung und erneute Staging-Evidenz bei jeder Secret-Änderung. | Betriebsprozess bei der ersten Rotation anwenden und redigiert nachweisen |
| `W2L-BLK-AUTHZ` | `partially-resolved` | Versionierte Plattform-/Organisations-/Operator-Matrix, Organisationsgrenzen und 15-Minuten-Re-Auth sind in TCP für Pool-Read und Reservierung implementiert; TCC nutzt ausschließlich die serverseitig bestätigten Ergebnisse. | Range-/Pool-Mutationen und Lifecycle-Commands verwenden dieselben Guards mit vollständigen Validator-, Neutralitäts- und Re-Auth-Tests. | Range-/Pool-Validatoren und Lifecycle fortsetzen |
| `W2L-BLK-CODEC` | `partially-resolved` | TCP besitzt kein Feistel-Secret. Der lokale `FakeTagCodecClient` liefert `TEST-S01`; `codec-pending`-Jobs, Idempotenz, atomarer Mapping-/Auditabschluss und TCC-Contracttests sind lokal nachgewiesen. | Echter Internal-HTTP-Adapter mit 6-/8-/10-Feistel-Vektoren, Timeout-/Resume-Nachweisen und redigierter Staging-Evidenz vorhanden. | Fake-Vektoren/Resume erweitern; echten Adapter erst mit geschützter Konfiguration anbinden |
| `CP-BLK-004` | `open` | Export-, Claim-, QA-, Nachdruck- und Übergabepolicy offen. Der Export ist bewusst von der frühen TAG-Verwaltung entkoppelt: TCC/TCP erzeugen erst nach einem lauffähigen Fundament autorisierte Einzel-ID- oder Range-Exportdaten mit Freigabe, Snapshot und Audit. PDF-/Label-Aufbereitung, Druckeransteuerung und physische Ausgabe sind nicht Teil von TCC/TCP. Ein späteres lokales Single-Page-Tool verarbeitet ausschließlich freigegebene Exportdaten lokal zu einem Zweckform-PDF; es besitzt keine Vergabe-, Range-Auswahl-, API-, DB-, Credential-, Publish- oder Aktivierungswirkung. | Versionierte Export-/QA-/Übergabepolicy, TCC-/TCP-Exportcontract und für das lokale Tool konkret versioniertes Zweckform-Format. | vor Umsetzung des lokalen Tools bzw. vor W6, keine Blockade für W0–W5 |
| `CP-BLK-005` | `deployment-blocked` | Vorschlag festgelegt: separater, serverseitig in der geschützten PHP-Konfiguration gespeicherter Staging-Token mit KV-Schreibrechten ausschließlich für den eindeutig bestätigten Staging-`TAG_CONFIG`-Namespace; Publish/Retry/Unpublish nur über Outbox, Korrelations-ID und redigiertes Audit. Aktiver Scan-Worker, Namespace, Scope und Dogado-Ablage sind noch nicht betrieblich bestätigt. | Publisher-Token-Scope, Namespace, geschützter PHP-Ablagepfad und Betriebsweg bestätigt. Blockiert echten KV-Publish, nicht Fake-Publisher-/Outbox-Implementierung und lokale Tests. | Nach W3L; Cloudflare-/Dogado-Konfiguration gegen Vorschlag prüfen |
| `CP-BLK-006` | `partially-resolved` | Routingentscheidung festgelegt: öffentliche Scans über `s.myqr24.com/t/*` und `s.myqr24.com/t1/*`; privater Codec ausschließlich über `codec.s.myqr24.com/api/v1/*`. Das ersetzt keine browserseitige Plane-Public-Read-API; deren CORS, Rate Limit und Cache-/Widerrufsbudget sind noch offen. | Plane-Read-API-Origin bzw. eigener Host sowie API- und Cache-Policy bestätigt. | `W0-WP-02`; Policy vor W4 spezifizieren |
| `CP-BLK-007` | `open` | POI-Nachweis, Retention, Moderations-SLA und Produktlimits offen. | versionierte Policy. | vor W7, keine Blockade für W0–W6 |

---

## 5. Zulässige und gesperrte Aktionen

### Zulässig

- W0-Dokumentation, Contracts, Edge-Contracttests und die gemeinsame lokale PHP-/MySQL-Docker-Testtopologie für künftige Anwendungskomponenten.
- Anlage und lokale Umsetzung von `apps/tag-control-plane` im W1L-Story-Umfang mit Compose-MySQL, synthetischen Daten und Fake-Adaptern für Cloudflare, Dogado und Mail.
- Analyse vorhandener Deployments und Konfigurationen ohne Secret-Ausgabe.
- Vorbereitung nichtproduktiver TAG-Lab-Testdaten ohne KV-Publish.
- Änderungen an bestehenden Dokumentations- und Testartefakten, wenn der W0-Status fortgeschrieben wird.

### Gesperrt

- Umsetzung, Tests, Deployment- oder Architekturentscheidungen allein auf Grundlage von `docs/00-Refinement/`; dieser Ordner ist nur bei ausdrücklich beauftragter Refinement-Arbeit zulässig und bleibt bis zur dokumentierten Übernahme unverbindlich.
- Dogado-Deployment oder Status `verified`, bevor die dafür ausgewiesenen Deployment-Blocker aufgelöst sind.
- Jede Veröffentlichung in Produktions-KV oder auf Produktivhosts.
- Manuelle KV-Fachmanipulation als Ersatz für den späteren Publisher.
- Speicherung realer Credentials, Tokens, Claim-Secrets, Ownerdaten oder Nachweise in Git, Fixtures, Evidenz oder Statusdateien.
- Erweiterung des Edge-Routers ohne separaten Contract-, Story-, Test- und Staging-Nachweis.

---

## 6. Letzter Nachweis und Wiederanlauf

**Letzte erfolgreiche Änderung:**  
- W1L-Gate und W2L-Contract-Abgleich vom 2026-10-29: TCC-Contract-UI-Suite (`npm run test:tcc`) lief mit **6 Tests**, TCC-Build erfolgreich, TCP-MySQL-Suite (`npm run local:test`) mit **11 Tests, 65 Assertions**, und `npm audit --workspace=@myqr24/tag-control-center --omit=optional` meldete **0 Vulnerabilities**. Die neutralisierte TCP-Login-Fehlerform ist zusätzlich serverseitig getestet. Der neue [`control-plane-tag-management-api-v1`](../../../10-Architecture/35-Contracts/control-plane-tag-management-api-v1.md) dokumentiert W2L fail-closed; W2L ist bis `W2L-BLK-AUTHZ` und für Reservierungen zusätzlich bis `W2L-BLK-CODEC` blockiert. Es erfolgten keine externen Infrastruktur-, Cloudflare- oder Deploymentänderungen.
- W1L-Contract- und Nachweisfortschreibung vom 2026-10-28: [`control-plane-admin-api-v1`](../../../10-Architecture/35-Contracts/control-plane-admin-api-v1.md) dokumentiert den lokalen browserseitigen TCP-/TCC-Schnitt für CSRF, Sessionstatus, Passwortlogin, Übergangs-E-Mail-MFA und Logout. TCP `npm run local:test` lief erfolgreich gegen die isolierte MySQL-8.4-Compose-Topologie (**10 Tests, 60 Assertions**); `npm run build:tcc`, Compose-Konfigurationsprüfung und `git diff --check` waren ebenfalls erfolgreich. TCP-/TCC-Status, Testfälle und Traceability verweisen auf denselben Contract. Die noch offenen TCC-Browser-/Contract-Nachweise `CC-TC-AUTH-001` bis `CC-TC-AUTH-006` bleiben der nächste zulässige W1L-Schritt; dies ist kein Dogado-, Mail-, Staging- oder Produktionsnachweis.
- Refinement-Abgrenzung vom 2026-10-07: [`docs/00-Refinement/README.md`](../../../00-Refinement/README.md) wurde als unverbindlicher Ideenspeicher angelegt. [`AGENT.md`](../../../AGENT.md) und die Orchestrierungsanweisung schließen diesen Ordner für reguläre neue Sessions, Wiederanläufe und autonome Umsetzung ausdrücklich aus. Bucket-basierte KV-Indizes, zusätzliche TAG-Längen, alternative logische ID-Räume und D1-Lookups bleiben Refinement-Themen und ändern weder den aktuellen Edge-Router noch den nächsten zulässigen Schritt. Maßgeblich bleibt der bestehende 6-/8-stellige Edge-Router-Vertrag mit `tag-range-index`, Gruppen-, Range-Regel-, optionalen TAG-Overrides und Features.
- Historische Orchestrierungskorrektur vom 2026-10-06: Ein damaliger lokaler CP-I01-Prototyp unter `apps/tag-control-plane` wurde vorzeitig mit SQLite geprüft und anschließend vollständig entfernt, weil er der damaligen Pre-W0-Sperre aus [`README.md`](README.md) widersprach. Dieser entfernte SQLite-Lauf bleibt ausdrücklich kein `CP-G1`-, `implemented`- oder Staging-Nachweis. Er ist von der später freigegebenen, aktuellen Laravel-/MySQL-W1L-Implementierung zu unterscheiden.
- `W0-WP-05` abgeschlossen: Die anwendungsneutrale lokale Docker-Topologie unter [`tools/local-php-mysql/`](../../../tools/local-php-mysql/README.md) wurde angelegt und mit ausschließlich synthetischer, ignorierter Konfiguration ausgeführt. Docker Engine Client/Server `29.8.0`, Docker Compose `v5.5.1`, MySQL `8.4` sowie PHP `8.4` mit `pdo_mysql` wurden verwendet. Der Selbsttest bestätigte im privaten Compose-Netz eine PDO-Verbindung, `utf8mb4`, UTC, InnoDB-Commit und Rollback; die temporäre Verifikationstabelle wurde entfernt. Container und Netzwerk wurden anschließend per nicht-destruktivem `down` entfernt, das ausschließlich lokale Volume bleibt erhalten. Die Orchestrierungsanleitung verpflichtet alle künftigen PHP-/MySQL-Anwendungskomponenten auf diese Testtopologie: echte MySQL-Integration für Persistenz-, Migrations-, Parallelitäts-, Locking-, Outbox- und Rollback-Nachweise, lokale Fakes für externe Ports und synthetische Testdaten. Dieser Nachweis ersetzt keine Dogado- oder Staging-Verifikation.
- [`W0-HOSTING-AND-STAGING-RESOURCE-MATRIX.md`](W0-HOSTING-AND-STAGING-RESOURCE-MATRIX.md) erstellt und fortgeschrieben: redigierte Matrix für Dogado-Hosting und Staging-Ressourcen, lokale Toolchain-Befund, offene Bestätigungen und Dokumentationsabweichungen. Die öffentliche Dogado-PHPInfo unter `https://8punkt4.dogado-webhosting.de/` wurde am 2026-10-07 als Plattformnachweis geprüft und bestätigt PHP `8.4.12` mit `FPM/FastCGI`; eine automatisierte Auswertung der Modulüberschriften wird mit HTTP 403 eingeschränkt. Die konkrete Plane-VHost-/INI-Konfiguration und Pflichtmodule bleiben daher offen. Der separate Codec-Worker einschließlich nicht auslesbarer Staging-Secrets, Custom Route und autorisierter 6-/8-stelliger Roundtrips ist nun als verifiziert erfasst; dies ersetzt keine Publisher- oder Public-API-Freigabe.
- Historischer Workspace-Abgleich zum Zeitpunkt des W0-WP-05-Nachweises: sauberer Arbeitsbaum auf `main`, `HEAD` `bc1d61f351eccb02749d82389b6d1083af4b4757`; Branch lag fünf lokale Commits vor `origin/main`. Der tatsächliche Arbeitsbaum muss bei jedem Wiederanlauf erneut geprüft werden.
- Lokal festgestellt: Node `v24.19.0`, npm `11.17.0`, PHP CLI `8.5.0`, Composer `2.8.12`; kein `mysql`-CLI-Client im `PATH`. Docker Engine Client/Server `29.8.0` und Docker Compose `v5.5.1` sind vorhanden. Diese lokalen Werte bestätigen keine Dogado-Fähigkeiten.

**Für den Wiederanlauf prüfen:**

1. Git-Arbeitsbaum und Branch gegen diesen Status abgleichen.
2. Diese Datei, [`README.md`](README.md) und die [W0-Ressourcenmatrix](W0-HOSTING-AND-STAGING-RESOURCE-MATRIX.md) vollständig lesen. `docs/00-Refinement/` bleibt dabei ausgeschlossen, sofern kein separater Refinement-Auftrag vorliegt.
3. Den vorhandenen W1L-Stand gegen die Status-, Contract-, Test- und Traceability-Verweise abgleichen. Vor jeder W2L-Codeänderung `W2L-BLK-AUTHZ` im `control-plane-tag-management-api-v1` entscheiden; für Reservierung zusätzlich `W2L-BLK-CODEC` lösen. Die lokale Compose-Topologie ist für jede MySQL-Integration zu verwenden; Cloudflare, Dogado und Mail werden als Fakes betrieben. Lokale Erfolge werden als `implemented`, nicht als `verified`, dokumentiert.
4. Nach dem lokalen W3L-Gate den Nachweis für `W0-WP-01` und `W0-WP-02` fortsetzen: aktiv genutzte Dogado-Stagingwerte zu PHP-/MySQL-Minor-Versionen, Extensions/SAPIs, Datenbankrechten/TLS, Zieltarif- und Cron-Grenzen, geschütztem PHP-Secret-Pfad, HTTPS sowie Deployment-/Rollbackweg einholen. Zusätzlich den aktiven Scan-Worker, seinen isolierten `TAG_CONFIG`-Namespace und den minimalen Publisher-Token-Scope gegen den dokumentierten Vorschlag bestätigen. Die lokale Vorbelegung `tools/.env.local` bleibt die nicht versionierte Quelle der lokalen Testsecrets; reale Werte werden nie dokumentiert.
5. Keine reale KV-Mutation durchführen, bis das W3D-Deployment-Gate erfüllt ist. Ein etwaiges lokales PDF-/Label-Aufbereitungstool bleibt bis zu seiner gesonderten Freigabe unter `tools/`, verarbeitet ausschließlich freigegebene Exportdaten, ist nicht Teil von TCC/TCP und darf keine externe Anbindung oder fachliche Wirkung erhalten.
6. Nach Abschluss eines W0- oder lokalen W1L/W2L/W3L-Arbeitspakets Tabelle, Blocker, Testbefehle/Evidenz und den nächsten zulässigen Schritt aktualisieren.

**Bisher ausgeführte Befehle in diesem Orchestrierungsstrang:**

```text
git status --short --branch
git log -1 --format="HEAD=%H%nDATE=%cI%nSUBJECT=%s"
node --version
npm --version
php --version
composer --version
mysql --version
docker version --format "{{.Client.Version}}|{{.Server.Version}}"
docker compose version
docker compose --env-file tools/local-php-mysql/.env.local -f tools/local-php-mysql/compose.yaml config --quiet
docker compose --env-file tools/local-php-mysql/.env.local -f tools/local-php-mysql/compose.yaml up -d mysql
docker compose --env-file tools/local-php-mysql/.env.local -f tools/local-php-mysql/compose.yaml --profile verify run --rm php /workspace/scripts/verify-mysql.php
docker compose --env-file tools/local-php-mysql/.env.local -f tools/local-php-mysql/compose.yaml down
```

Der obenstehende Befehlsauszug dokumentiert die frühere W0-Testtopologie. Zusätzlich wurden im aktuellen W1L-Schritt die versionierte lokale Control-Plane und das Control Center angelegt beziehungsweise fortgeschrieben; es erfolgten keine externen Infrastruktur- oder Deploymentänderungen.

**Korrekturhinweis zur aktuellen Sitzung:** Der frühere, vorzeitig angelegte SQLite-Prototyp wurde wegen der damaligen Pre-W0-Sperre vollständig entfernt und bleibt kein Nachweis für `CP-G1` oder `implemented`. Die aktuelle, zulässige W1L-Implementierung ist davon getrennt: Laravel-/MySQL-TCP und React-/Vite-TCC laufen ausschließlich lokal gegen Compose-MySQL und Fake-Adapter; der aktuelle Nachweis ist im vorstehenden W1L-Eintrag dokumentiert.

**Evidenz:** Der versionierte Nachweis besteht aus der [lokalen PHP-/MySQL-Testtopologie](../../../tools/local-php-mysql/README.md), der [W0-Ressourcenmatrix](W0-HOSTING-AND-STAGING-RESOURCE-MATRIX.md), der Control-Plane-[Teststrategie](../tag-control-plane/20-TEST-STRATEGY.md), dem [Codec-Staging-Nachweis](../evidence/README.md) und diesem Status. Es wurden keine Geheimnisse oder Logs mit Credentials abgelegt.
