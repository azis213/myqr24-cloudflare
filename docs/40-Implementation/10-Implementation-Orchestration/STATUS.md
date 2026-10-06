# Operativer Orchestrierungsstatus: TAG-Plattform

**Orchestrierungsanweisung:** [`README.md`](README.md)  
**Stand:** 2026-10-06  
**Gesamtstatus:** `in-progress`  
**Aktive Welle:** `W0 – Betriebsfähigkeit, Entscheidungen und Verträge`  
**Nächster zulässiger Arbeitsschritt:** Bestätigbare Dogado-Stagingdaten bei der Hosting-/Betriebszuständigkeit einholen und die Ressourcenmatrix ohne Secretwerte ergänzen; der lokale W0-WP-05-Nachweis ist abgeschlossen.  
**Regel:** Keine Anwendung unter `apps/tag-control-plane` oder `apps/tag-control-center` erzeugen, bevor W0-Gate und die dafür erforderlichen Entscheidungen dokumentiert sind.

---

## 1. Verifizierter Ausgangszustand

| Bereich | Stand | Nachweis / Hinweis |
| --- | --- | --- |
| Edge Router | Staging-Worker `myqr24-edge-routing-staging` ist deployt; `https://s.myqr24.com/` antwortet mit `302` auf `https://www.myqr24.com/`. | Staging-Deployment vom 2026-10-06, Worker-Version `9db270fb-567d-4845-b1f0-67e6ecbef3f3` |
| Plattform-Homepage | KV-freier Worker `myqr24-platform-home` ist für `www.myqr24.com/*` bereitgestellt. | Deployment-Version `b3372d68-ac0a-431e-a902-8fba9f2fb201`; öffentliche Seite wurde anschließend als sichtbar bestätigt |
| TAG-App | Bestehende React/Vite-PWA in `apps/tag-app`; öffentliche View-Darstellung ist fixturebasiert. | siehe `docs/40-Implementation/tag-app/STATUS.md` |
| Control Plane | Noch nicht implementiert. | keine App, Migrationen, Datenbank, API, Publisher oder Produktionsdaten vorhanden |
| Control Center | Noch nicht implementiert. | nur Planungs-, Test- und Traceability-Dokumentation vorhanden |
| Contracts | Noch kein Ordner `docs/10-Architecture/35-Contracts` vorhanden. | W0-Arbeit |
| TAG Lab | Bestehendes lokales Tool vorhanden; noch kein orchestrierter Testtag-Katalog. | W0/W3-Arbeit |
| Produktion | Nicht Gegenstand der aktuellen Ausführung. | Staging-first, explizite Produktionsfreigabe erforderlich |

---

## 2. Wellenfortschritt

| Welle | Ziel | Status | Eintrittskriterium | Austrittskriterium |
| --- | --- | --- | --- | --- |
| `W0` | Betriebsfähigkeit, Entscheidungen, Contracts, lokale Testtopologie | `in-progress` | Orchestrierungsanweisung und Startstatus vorhanden | W0-Gate erfüllt |
| `W1` | Plane-Fundament und Admin-Sicherheitsrahmen | `planned` | W0-Gate erfüllt | `CP-G1` und zugehörige CC-Stories grün |
| `W2` | Ranges, Pools, Reservierung, Lifecycle und CC-Verwaltung | `planned` | W1-Gate erfüllt | `CP-G2` und Story-Gate grün |
| `W3` | Routing-Projektion, Publisher, Staging-Scan | `planned` | W2-Gate erfüllt | `CP-G4`, Router-/PWA-Nachweis grün |
| `W4` | PublicTagView, Basis-Vault, TAG-App-API-Ablösung | `planned` | W3-Gate erfüllt | `CP-G5`, `CP-G6`, E2E-Evidenz grün |
| `W5` | Claiming, Besitzanker, Collections, Support | `planned` | W4-Gate erfüllt | Claim-/Lockout-/Leak-/Session-Gate grün |
| `W6` | Herstellung, Druck, QA, Übergabe | `planned` | W5-Gate und freigegebene Prozesspolicy | `CP-G3` und Staging-Probe grün |
| `W7` | Owner-Inhalte, Produkt, Organisation und POI | `planned` | W6-Gate und Policy-Freigaben | Policy-/Review-/Privacy-Gate grün |

---

## 3. W0-Arbeitspakete

| ID | Arbeitspaket | Betroffene Artefakte | Status | Abschlussnachweis |
| --- | --- | --- | --- | --- |
| `W0-WP-01` | Dogado-Hostingmatrix erheben: PHP, Extensions, Composer, MySQL, Cron/Queue, HTTPS, Secret-Speicher, Deploymentweg | [`W0-HOSTING-AND-STAGING-RESOURCE-MATRIX.md`](W0-HOSTING-AND-STAGING-RESOURCE-MATRIX.md) | `in-progress` | Matrix angelegt; reale Dogado-Umgebungsdaten noch ausstehend, keine Secretwerte |
| `W0-WP-02` | Staging-Ressourcenmatrix erheben: API-Host, DB, Staging-KV, Pages-Origin, Publisher-Scope und DNS/CORS-Grenzen | Orchestrierungsstatus / Deploymentdokumentation | `planned` | redigierte Ressourcenreferenzen und Zuständigkeiten |
| `W0-WP-03` | Contract Overview und `tag-routing-projection-v1` erstellen | `docs/10-Architecture/35-Contracts/` | `planned` | Review und Contract-Testreferenzen |
| `W0-WP-04` | Bestehenden Edge Router gegen Routing-Projection-Contract prüfen | `apps/edge-router/test/` | `planned` | grüne Contract-/Regressionstests |
| `W0-WP-05` | Gemeinsame lokale Testtopologie für PHP-/MySQL-Anwendungskomponenten: isoliertes MySQL, Fake-Cloudflare-Adapter, Testsecrets und Befehle | [`tools/local-php-mysql/`](../../../tools/local-php-mysql/README.md), [`README.md`](README.md), Plane-Teststrategie | `completed` | Compose-Konfiguration, privates MySQL-8.4-Netz, PHP-8.4-PDO-Testimage, verbindlicher Anwendungs-Testablauf und erfolgreicher lokaler Verbindungs-/UTF-8-/UTC-/Commit-/Rollback-Selbsttest |
| `W0-WP-06` | TAG-Lab-Testtag-Katalog und Datenminimierungsregeln konzipieren | `tools/tag-lab/` | `planned` | versionierter nichtproduktiver Katalogvertrag |

---

## 4. Aktive Blocker und Entscheidungen

| ID | Status | Beschreibung | Auflösungskriterium | Nächste Aktion |
| --- | --- | --- | --- | --- |
| `CP-BLK-001` | `open` | Dogado PHP-/MySQL-/Composer-/Cron-/Secret-Fähigkeiten sind nicht bestätigt. | Vollständige, gegen die reale Staging-Umgebung bestätigte Hostingmatrix liegt ohne Secretwerte vor. | `W0-WP-01`; Matrix ergänzen |
| `CP-BLK-002` | `open` | Verbindliche Admin-Authentisierungs-, MFA-, Recovery- und Session-Policy fehlt. | Security-Policy für W1 dokumentiert und freigegeben. | in W0 als Entscheidung vorbereiten |
| `CP-BLK-003` | `open` | Kompatible Staging-Feistel-/HMAC-Testvektoren für reale Allocator-Tests fehlen. | getrennte Testsecret-Integration und Vektoren verfügbar. | W0 Testsecret-Konzept vorbereiten |
| `CP-BLK-004` | `open` | Druck-, Claim-, QA-, Nachdruck- und Übergabepolicy offen. | versionierte Betriebs-/Produktionspolicy. | vor W5/W6, keine Blockade für W0–W4 |
| `CP-BLK-005` | `partially-resolved` | Staging Edge Worker und KV sind bekannt; zulässiger minimaler Publisher-Token und isolierte Publishing-Grenze müssen dokumentiert werden. | Token-Scope, Namespace und Betriebsweg bestätigt. | `W0-WP-02` |
| `CP-BLK-006` | `open` | Staging-Origin der Public Read API, CORS-Allowlist, Rate Limit und Cache-Widerrufsbudget offen. | API- und Cache-Policy bestätigt. | `W0-WP-02` |
| `CP-BLK-007` | `open` | POI-Nachweis, Retention, Moderations-SLA und Produktlimits offen. | versionierte Policy. | vor W7, keine Blockade für W0–W6 |

---

## 5. Zulässige und gesperrte Aktionen

### Zulässig

- W0-Dokumentation, Contracts, Edge-Contracttests und die gemeinsame lokale PHP-/MySQL-Docker-Testtopologie für künftige Anwendungskomponenten.
- Analyse vorhandener Deployments und Konfigurationen ohne Secret-Ausgabe.
- Vorbereitung nichtproduktiver TAG-Lab-Testdaten ohne KV-Publish.
- Änderungen an bestehenden Dokumentations- und Testartefakten, wenn der W0-Status fortgeschrieben wird.

### Gesperrt

- Erstellen produktionsähnlicher Control-Plane-/Control-Center-Anwendungen vor W0-Gate.
- Jede Veröffentlichung in Produktions-KV oder auf Produktivhosts.
- Manuelle KV-Fachmanipulation als Ersatz für den späteren Publisher.
- Speicherung realer Credentials, Tokens, Claim-Secrets, Ownerdaten oder Nachweise in Git, Fixtures, Evidenz oder Statusdateien.
- Erweiterung des Edge-Routers ohne separaten Contract-, Story-, Test- und Staging-Nachweis.

---

## 6. Letzter Nachweis und Wiederanlauf

**Letzte erfolgreiche Änderung:**  
- Orchestrierungskorrektur vom 2026-10-06: Ein lokaler CP-I01-Prototyp unter `apps/tag-control-plane` wurde vorzeitig erstellt und mit SQLite erfolgreich geprüft, widersprach aber der verbindlichen Pre-W0-Sperre aus [`README.md`](README.md). Der vollständige Prototyp einschließlich Migrationen, Tests und Tooling wurde daher wieder entfernt; es existiert weiterhin keine Control-Plane-Anwendung, Migration, API oder Datenbank im Repository. Der Lauf darf nicht als `CP-G1`-, `implemented`- oder Staging-Nachweis verwendet werden.
- `W0-WP-05` abgeschlossen: Die anwendungsneutrale lokale Docker-Topologie unter [`tools/local-php-mysql/`](../../../tools/local-php-mysql/README.md) wurde angelegt und mit ausschließlich synthetischer, ignorierter Konfiguration ausgeführt. Docker Engine Client/Server `29.8.0`, Docker Compose `v5.5.1`, MySQL `8.4` sowie PHP `8.4` mit `pdo_mysql` wurden verwendet. Der Selbsttest bestätigte im privaten Compose-Netz eine PDO-Verbindung, `utf8mb4`, UTC, InnoDB-Commit und Rollback; die temporäre Verifikationstabelle wurde entfernt. Container und Netzwerk wurden anschließend per nicht-destruktivem `down` entfernt, das ausschließlich lokale Volume bleibt erhalten. Die Orchestrierungsanleitung verpflichtet alle künftigen PHP-/MySQL-Anwendungskomponenten auf diese Testtopologie: echte MySQL-Integration für Persistenz-, Migrations-, Parallelitäts-, Locking-, Outbox- und Rollback-Nachweise, lokale Fakes für externe Ports und synthetische Testdaten. Dieser Nachweis ersetzt keine Dogado- oder Staging-Verifikation.
- [`W0-HOSTING-AND-STAGING-RESOURCE-MATRIX.md`](W0-HOSTING-AND-STAGING-RESOURCE-MATRIX.md) erstellt: redigierte Matrix für Dogado-Hosting und Staging-Ressourcen, lokale Toolchain-Befund, offene Bestätigungen und Dokumentationsabweichungen.
- Workspace-Abgleich: sauberer Arbeitsbaum auf `main`, `HEAD` `bc1d61f351eccb02749d82389b6d1083af4b4757`; Branch liegt fünf lokale Commits vor `origin/main`.
- Lokal festgestellt: Node `v24.19.0`, npm `11.17.0`, PHP CLI `8.5.0`, Composer `2.8.12`; kein `mysql`-CLI-Client im `PATH`. Docker Engine Client/Server `29.8.0` und Docker Compose `v5.5.1` sind vorhanden. Diese lokalen Werte bestätigen keine Dogado-Fähigkeiten.

**Für den Wiederanlauf prüfen:**

1. Git-Arbeitsbaum und Branch gegen diesen Status abgleichen.
2. Diese Datei, [`README.md`](README.md) und die [W0-Ressourcenmatrix](W0-HOSTING-AND-STAGING-RESOURCE-MATRIX.md) vollständig lesen.
3. Den Nachweis für `W0-WP-01` fortsetzen: bestätigbare Dogado-Stagingdaten zu PHP, Extensions, Composer, MySQL, Cron, Secret-Speicher, HTTPS und Deploymentweg einholen und ohne Secretwerte in die Matrix aufnehmen. Die lokale Testtopologie kann bei Bedarf gemäß [`tools/local-php-mysql/README.md`](../../../tools/local-php-mysql/README.md) erneut geprüft werden.
4. Keine Control-Plane-/Control-Center-App anlegen und keine KV-Mutation durchführen, bis die Matrix die Blockerauflösung belegt.
5. Nach Abschluss eines W0-Arbeitspakets Tabelle, Blocker, Testbefehle/Evidenz und den nächsten zulässigen Schritt aktualisieren.
6. Keine gelöschten lokalen CP-I01-Prototypen wiederherstellen oder neue App-Verzeichnisse anlegen, bevor das W0-Gate vollständig erfüllt oder explizit nachweisbar freigegeben ist.

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

Es wurden ausschließlich versionierte lokale W0-Testinfrastruktur und Dokumentation angelegt. Keine Control-Plane-/Control-Center-Anwendung, keine externe Infrastruktur und kein Deployment wurden erstellt oder verändert.

**Korrekturhinweis zur aktuellen Sitzung:** Zwischenzeitlich angelegte lokale Control-Plane-Dateien wurden nach dem Abgleich gegen die Orchestrierungsanweisung vollständig entfernt. Die erfolgreich ausgeführten SQLite-Prototyp-Tests bleiben absichtlich ohne Evidence-Artefakt, weil die Ausführung vor dem W0-Gate nicht zulässig war.

**Evidenz:** Der versionierte Nachweis besteht aus der [lokalen PHP-/MySQL-Testtopologie](../../../tools/local-php-mysql/README.md), der [W0-Ressourcenmatrix](W0-HOSTING-AND-STAGING-RESOURCE-MATRIX.md), der Control-Plane-[Teststrategie](../tag-control-plane/20-TEST-STRATEGY.md) und diesem Status. Es wurden keine Geheimnisse, Logs mit Credentials oder externe Staging-Evidenzen abgelegt.
