# W0 – Hosting- und Staging-Ressourcenmatrix

**Status:** `in-progress`  
**Arbeitspakete:** `W0-WP-01`, vorbereitender Befund für `W0-WP-02`  
**Stand:** 2026-10-06  
**Datenklassifikation:** Diese Matrix enthält ausschließlich nicht geheime, redigierte Betriebsmetadaten. Sie enthält keine Tokens, Credentials, Secretwerte, personenbezogenen Daten oder vollständigen KV-Inhalte.

## 1. Zweck und Verbindlichkeit

Diese Matrix dokumentiert ausschließlich gegen Repository, lokale Entwicklungsumgebung und vorhandene Evidenz verifizierbare Voraussetzungen für die spätere TAG Control Plane auf Dogado sowie deren Staging-Integration mit Cloudflare.

Sie ist **keine Bestätigung** einer produktionsähnlichen Control-Plane-Architektur. Insbesondere beweisen lokal installierte PHP-, Composer- oder Node-Versionen keine Fähigkeiten des Dogado-Hostings. Nicht bestätigte Angaben bleiben bewusst als offene Entscheidung oder Blocker ausgewiesen. Für die freigegebene lokale TCP-Implementierungsstufe sind diese offenen Angaben jedoch nachgelagerte **Deployment-Blocker**: Die Anwendung wird zunächst gegen die lokale Docker-/Compose-MySQL-Topologie implementiert und getestet; Dogado-Kompatibilität, echter Staging-Publish und `verified` werden erst danach bewertet.

Verbindliche Architekturgrenzen:

- MySQL und serverseitige Control-Plane-Logik sind fachlich autoritativ.
- Cloudflare KV ist nur eine minimale, abgeleitete Routing-Projektion.
- Ein Publisher-Token darf ausschließlich serverseitig und nur für einen isolierten Staging-Namespace verfügbar sein.
- Browser erhalten niemals Zugriff auf MySQL, KV, R2, Publisher-Tokens oder sonstige Cloudflare-Credentials.
- `apps/tag-control-plane` darf im lokalen W1L-Umfang gegen Compose-MySQL angelegt werden; Dogado-Deployment, echte Cloudflare-Tokens und jeder reale KV-Write bleiben bis zum Deployment-Gate gesperrt.

## 2. Nachweisbasis

| Quelle | Verifizierter Befund |
| --- | --- |
| Git-Abgleich, 2026-10-06 | Arbeitsbaum sauber; Branch `main` liegt sechs lokale Commits vor `origin/main`; `HEAD` ist `bde691587cbcdb06fe2e9dccdd99920a8cb8d4ec` (`feat: add local PHP MySQL test topology`). |
| Lokale Toolchain-Prüfung, 2026-10-06 | Node `v24.19.0`, npm `11.17.0`, PHP CLI `8.5.0`, Composer `2.8.12`; kein lokaler `mysql`-CLI-Client im `PATH`. Docker Engine Client/Server `29.8.0` und Docker Compose `v5.5.1` sind verfügbar. |
| `apps/edge-router/wrangler.toml` | Staging-Worker und ein Staging-`TAG_CONFIG`-Binding sind konfiguriert; Production-`TAG_CONFIG` bleibt auskommentiert. Die Namespace-ID wird in dieser Matrix nicht wiederholt. |
| `docs/40-Implementation/evidence/README.md` | Kurze Staging-Scan-Strecke und Cloudflare-Pages-Deploy wurden nachweislich geprüft. Der aktive Worker bzw. dessen aktive Redirect-Konfiguration ist vor KV-Änderungen im Cloudflare-Dashboard zu identifizieren. |
| `docs/90-Session-Change-Summaries/DEPLOYMENT_HANDOVER.md` | Staging- und Production-Secrets/Namespaces müssen getrennt sein; keine Dogado-Hostingversionen oder Secret-/Cron-Mechanismen bestätigt. |
| `docs/10-Architecture/PWA-PHP-Applications/TAG_CONTROL_PLANE_AND_BASIS_VAULT.md` | PHP/MySQL auf Dogado ist Architekturziel; der kontrollierte Publisher und eine öffentliche Read-API benötigen serverseitige Secrets, HTTPS, CORS- und Cache-Policies. |

## 3. Dogado-Hostingmatrix für die Control Plane

| Fähigkeit | Benötigt für | Architekturvorgabe | Nachweisstand | Status | Erforderliche Bestätigung vor W1 |
| --- | --- | --- | --- | --- | --- |
| PHP-Version und unterstützte SAPIs | Plane-API, Admin-Backend, Migrationen | Unterstützte, gepflegte PHP-Version; CLI-/Web-Ausführungsmodell muss bekannt sein | Dogado belegt regulär PHP `8.2`–`8.4`; Extended Support ist optional für `5.2`–`8.1`, Dokumentation reicht bis `5.4`. Die öffentliche PHPInfo unter `https://8punkt4.dogado-webhosting.de/` zeigte am 2026-10-07 PHP `8.4.12` mit `FPM/FastCGI`. Diese Seite ist ein Plattformnachweis, aber keine Bestätigung der künftigen Plane-Staging-VHost-/INI-Konfiguration. | `partially-resolved` | Plane-Staging-VHost, aktivierte SAPI-/INI-Policy und geplanter Runtime-Support bestätigen |
| PHP-Extensions | Passwort-Hashing, JSON, HTTP-Client, DB-Zugriff, Kryptografie | Mindestens sichere Passwort-Hashing-, PDO-MySQL-, JSON-, OpenSSL-/HTTP-Fähigkeiten oder dokumentierte Alternative | Die öffentliche Dogado-PHP-8.4-PHPInfo unter `https://8punkt4.dogado-webhosting.de/` dokumentiert die verfügbare Laufzeit und ihre geladene Modulkonfiguration. Automatisierte Abrufe sind mit HTTP 403 beschränkt; Modulnamen oder Konfigurationswerte werden daher nicht kopiert. Vor Einrichtung der Plane müssen `PDO`/`pdo_mysql`, `openssl`, `json`, sichere Passwort-APIs sowie der gewählte HTTP-Client für den konkreten Plane-Staging-VHost als aktiv bestätigt werden. | `partially-resolved` | Redigierte Bestätigung der für den Plane-VHost aktivierten Pflichtmodule und zulässiger Library-Alternativen |
| Composer | reproduzierbarer Dependency-Install und Security-Updates | Serverseitiger oder CI-basierter, nachvollziehbarer Installationsweg | Composer ist per SSH mit dem jeweiligen PHP-Binary ausführbar; konkrete Composer-Version und verbindlicher Build-/Upload-Prozess sind nicht belegt | `partially-resolved` | Composer-Version sowie verbindlichen Build-/Upload-Prozess bestätigen |
| MySQL-/MariaDB-Version | autoritative Datenbank, Transaktionen, Unique Constraints, Migrations- und Restore-Tests | Transaktionen, Constraints, Indizes, sichere Zeichensätze und Backup/Restore erforderlich | Dogado-Datenbank-Grundangebot ist belegt; Engine und Minor-Version der vorgesehenen Staging-Datenbank sind nicht belegt | `partially-resolved` | Exakte Engine-/Version, Host/Port-Form, TLS, Datenbank-/Benutzertrennung, Backup/Restore und Größen-/Verbindungslimits |
| Datenbankberechtigungen | Migrationen, getrennte Laufzeitrollen | Least privilege; keine Browserzugriffe | Nicht bestätigt | `open` | Migration- und Runtime-Rolle, Rechteumfang, Credential-Rotation |
| Cron/Queue/Worker | Outbox-Publisher, Retries, Ablauf- und Betriebsaufgaben | Zuverlässiger serverseitiger Scheduler; Laufzeit- und Parallelitätsgrenzen müssen bekannt sein | Ab Tarif WEB M bietet oneHome Cron-Jobs für URL, PHP und Befehle einschließlich Fehlerbenachrichtigungen. Konkrete Frequenz-, Laufzeit- und Parallelitätsgrenzen des Zieltarifs sind nicht belegt. | `partially-resolved` | Zieltarif, minimale Cron-Frequenz, Locking-/Retry-Mechanik, Laufzeitlimits und Fehlerbenachrichtigung bestätigen |
| Server-Secret-Speicher | DB-Credentials, Session-/CSRF-Schlüssel, Publisher-Token | Kein Secret in Git, Webroot, Browser, Logs oder Evidenz | Vorschlag: PHP liest eine Git-ignorierte Konfigurationsdatei außerhalb des Document-Roots; Eigentümer und Dateirechte beschränken den Zugriff auf den PHP-/Cron-Laufzeitnutzer. Die Datei enthält ausschließlich Staging-Secrets, wird nicht durch Webserver, Composer, Logs oder Evidenz ausgeliefert und ist über einen getrennten Betriebsweg rotierbar. | `partially-resolved` | Dogado-Document-Root, Laufzeitnutzer, zulässigen geschützten Ablagepfad, Dateirechte, Deployment-Injektion und Notfallwiderruf bestätigen |
| HTTPS, API-Host und Zertifikate | Admin- und Public-Read-API | TLS, getrennte Origins und keine Secretübertragung an Browser | Routingentscheidung für die bestehenden Worker: öffentliche Staging-TAG-Scans ausschließlich über `https://s.myqr24.com/t/{tagId}` und `https://s.myqr24.com/t1/{tagId}`; der private Codec bleibt auf `https://codec.s.myqr24.com/api/v1/*`. Ein separater Plane-Public-Read-API-Host, TLS-Verwaltung und Zertifikatserneuerung sind nicht belegt. | `partially-resolved` | Zuständigkeit und TLS-Verwaltung für `s.myqr24.com`/`codec.s.myqr24.com` sowie späteren Plane-API-Host bestätigen |
| Deploymentweg und Rollback | nachvollziehbare Staging-Releases | Commit-gebunden, reproduzierbar, Rollback-fähig | oneHome bietet One-Click-Installer und eine API unter `https://onehome.dogado.de/api/v1`; deren Bearer-Tokens haben standardmäßig 365 Tage Laufzeit. Der zulässige Einsatz, Token-Speicher, minimale Rechte, CI/SFTP/Git-Deploy-Weg und Rollback sind nicht belegt. Coolify setzt VPS/Root-Server voraus und ist für Shared Hosting nicht vorauszusetzen. | `partially-resolved` | Verbindlichen Deployment-/Rollbackprozess, Token-Lebensdauer bzw. Rotation, Rechte und Audit bestätigen |
| Webserver-/PHP-Sicherheitsgrenzen | Sessions, Uploads, Fehlerbehandlung, Logs | sichere Header, Webroot-Trennung, keine Fehlermeldungslecks | Tariflimits sind abhängig vom konkreten Tarif nicht anpassbar: Speicher `256`–`1024 MB`, maximale Ausführungszeit `300`–`900 Sekunden`, PHP-Memory-Limit `64`–`512 MB`. Document-Root, SAPI, Logs und konkrete Zieltarifwerte sind nicht belegt. | `partially-resolved` | Zieltarifwerte, Document-Root, Umgebungsvariablen, PHP-Fehler-/Access-Logs, Log-Retention und Konfigurationsgrenzen bestätigen |

### Lokale PHP-/MySQL-Testtopologie

Die anwendungsneutrale Compose-Topologie unter [`../../../tools/local-php-mysql/`](../../../tools/local-php-mysql/README.md) ist für `W0-WP-05` festgelegt und erfolgreich lokal verifiziert. Sie enthält eine isolierte lokale MySQL-8.4-Instanz, ein PHP-8.4-CLI-Testimage mit `pdo_mysql` und einen nichtfachlichen PDO-Verifikationstest. MySQL besitzt keinen Host-Port und ist nur im internen Compose-Netz für den PHP-Testcontainer erreichbar.

Der redigierte Selbsttest bestätigte eine PDO-Verbindung, `utf8mb4`, UTC, InnoDB-Commit und Rollback. Die temporäre Verifikationstabelle wurde entfernt; Container und Netzwerk wurden anschließend per nicht-destruktivem `down` entfernt. Das ausschließlich lokale benannte Daten-Volume bleibt dabei erhalten.

Verbindliche lokale Grenzen:

- Die lokale Topologie ersetzt weder Dogado- noch Staging-Nachweise.
- Die Compose-Datei `tools/local-php-mysql/.env.local` enthält ausschließlich synthetische lokale Werte und bleibt unversioniert; Staging- und Production-Secrets sind in dieser lokalen PHP-/MySQL-Topologie unzulässig. Dies betrifft nicht die separat verwaltete Codec-Testsecret-Vorbelegung in `tools/.env.local`.
- Zukünftige MySQL-Integrationstests verwenden die Compose-Datenbank und getrennte Testdaten bzw. einen kontrollierten Schema-Reset.
- Externe Adapter, insbesondere Cloudflare-Publishing, werden lokal gefakt; keine externen Tokens oder APIs dürfen geladen werden.
- Der destruktive Volume-Reset ist ausschließlich lokal zulässig und darf niemals auf Staging oder Produktion übertragen werden.
- Testberichte, Logs und Evidenz werden auf Secrets, Credentials und private Daten geprüft.

Die konkreten Start-, Verifikations-, Stop- und Reset-Befehle sowie die Testpyramide für spätere PHP-Anwendungen stehen in der [README der lokalen Testtopologie](../../../tools/local-php-mysql/README.md).

## 4. Staging-Ressourcenmatrix (vorbereitender Befund)

| Ressource | Bekannter Stand | Status | Einschränkung / nächste Verifikation |
| --- | --- | --- | --- |
| Edge Worker | `myqr24-edge-routing-staging` ist laut Orchestrierungsstatus deployed; die versionierten Staging-Secret-Bindings sind in Cloudflare angelegt | `partially-resolved` | Aktive Worker-Version und Bindung vor Publisher-/KV-Tests im Dashboard abgleichen; Secretwerte bleiben undokumentiert |
| Staging-`TAG_CONFIG` | In `apps/edge-router/wrangler.toml` gebunden | `partially-resolved` | Namespace-ID wird hier redigiert; aktiven Worker und Namespace vor jeder Änderung eindeutig zuordnen |
| Staging-Scan-Domain | Kurze Staging-Scan-Strecke wurde als öffentlich funktionierend nachgewiesen | `partially-resolved` | Konkrete aktive Route nicht verändern; negative und Umstellungsnachweise gehören in W3 |
| Sprechende Staging-Scan-Domain | `s.myqr24.com` ist architektonisch vorgesehen | `open` | DNS-/Dogado-Integration laut Evidenz noch ausstehend bzw. eindeutig zu bestätigen |
| Staging-Pages-PWA | Cloudflare-Pages-Projekt `myqr24-staging-test-pwa` mit Alias ist dokumentiert | `partially-resolved` | Spätere Custom Domain sowie finale App-Route noch nicht freigegeben |
| Interner Staging-TAG-Codec | Separater Worker `myqr24-tag-codec-staging` ist über die private Custom Route `codec.s.myqr24.com/api/v1/*` erreichbar; 6- und 8-stellige autorisierte Roundtrips sind nachgewiesen | `verified` | Codec-Betriebsweg ist belegt; Rate-Limit-/Access-/IP-Grenzen bleiben als Betriebsentscheidung vor einer breiteren Freigabe zu bestätigen |
| Staging-Public-Read-API | Noch nicht als Control-Plane-Service vorhanden. Routingvorgabe: Scan-Einstieg über `s.myqr24.com/t/*` und `s.myqr24.com/t1/*`; Codec ausschließlich unter `codec.s.myqr24.com/api/v1/*` und nie als Browser-Public-Read-API. | `partially-resolved` | Für die spätere Plane-Read-API CORS-Allowlist, Rate Limit, Cache-/Widerrufsbudget und gegebenenfalls einen eigenen Host festlegen (`CP-BLK-006`) |
| Staging-Datenbank | Nicht nachgewiesen | `open` | Erst nach Dogado-Hostingmatrix anlegen bzw. referenzieren |
| Publisher-Token | Lokale TCP-Stufe: ausschließlich Fake-Cloudflare-Adapter mit synthetischen Testdaten; keine realen Tokens, Hosts oder API-Aufrufe. Spätere Staging-Stufe: separater, serverseitig gespeicherter Token mit ausschließlich KV-Schreibrechten für den eindeutig bestätigten Staging-`TAG_CONFIG`-Namespace; keine Account-weiten Rechte, keine Worker-, DNS-, Pages- oder Production-Bindungen. Publish, Retry und Unpublish laufen über die Plane-Outbox mit Korrelations-ID und redigiertem Audit. | `deployment-blocked` | Nach lokal grünem Publisher-/Outbox-Gate Token-Scope, isolierten Namespace, Secret-Speicher und Betriebsweg im Cloudflare-/Dogado-Betrieb bestätigen (`CP-BLK-005`) |
| Lokale und Codec-Staging-Secrets | Die ignorierte Datei `tools/.env.local` enthält `FEISTEL_SECRET_S01`, `TAG_HMAC_SECRET_S01`, `REDIRECT_SIGNING_SECRET_S01`, `TAG_CODEC_API_KEY_S01` und `TEST_TAGS`. Sie ist für lokale Tests die zugelassene Secret-Quelle. Für Staging werden dieselben Vorbelegungen ausschließlich in den Cloudflare Secret Store übernommen; die Datei selbst wird weder deployed noch ausgelesen. | `verified` | Beide TAG-Längen und das Codec-Auth-Gate sind per Live-Roundtrip geprüft. Änderungen an der Vorbelegung verlangen lokale Regressionstests, kontrollierte Secret-Store-Aktualisierung und erneute Staging-Evidenz (`CP-BLK-003`) |
| Production-Ressourcen | Nicht Gegenstand der aktuellen Welle | `not-started` | Nicht konfigurieren, nicht veröffentlichen und keine Production-Secrets laden |

## 5. Festgestellte Dokumentationsabweichungen

| Referenz | Befund | Auswirkung | Behandlung |
| --- | --- | --- | --- |
| `AGENT.md` gegenüber aktueller Orchestrierung, Übergabe und Evidenz | Veraltete bzw. abweichende Scan-Hosts und Pfadmuster sind enthalten | Keine Infrastruktur- oder Codeentscheidung aus diesen Angaben ableiten | Als Dokumentationsbereinigung separat vor einem zukünftigen Edge-bezogenen Arbeitsschritt durchführen; Edge Router bleibt außerhalb des W0-Scopes |
| `apps/edge-router/wrangler.toml` gegenüber `DEPLOYMENT_HANDOVER.md` | Routenkommentare enthalten zusätzliche Root- und `t1`-Muster, während die Übergabe engere Muster nennt | Aktive Routinggrenzen sind nicht allein aus Dokumentation beweisbar | Cloudflare-Dashboard und aktive Worker-Version vor W3 als Nachweis abgleichen; keine Änderungen in W0 |
| Evidenz gegenüber Orchestrierungsstatus | Evidenz fordert vor KV-Änderungen die Identifikation der aktiven Worker-/Redirect-Konfiguration | Blindes Schreiben in den konfigurierten Namespace ist untersagt | Als Voraussetzung in `CP-BLK-005` und W0-WP-02 führen |

## 6. Ergebnis, Blocker und nächster zulässiger Schritt

`W0-WP-01` ist als **Deployment-Backlog noch nicht abgeschlossen**. Dogado belegt regulär PHP `8.2`–`8.4`, Composer per SSH/PHP-Binary, Cron ab WEB M sowie regelmäßige Backups alle drei Stunden mit 7- bzw. 14-tägiger Vorhaltung. Die öffentliche PHPInfo für PHP `8.4.12` unter `https://8punkt4.dogado-webhosting.de/` bestätigt zusätzlich FPM/FastCGI und dokumentiert die angebotene Modulkonfiguration. Der konkrete Plane-Staging-VHost, die tatsächlich aktivierten Pflichtmodule, Datenbank-Details, Sicherheitsgrenzen, Secret-Speicher und der verbindliche Deployment-/Rollbackprozess liegen weiterhin nicht vor. Diese Angaben blockieren Dogado-Deployment, echten Staging-KV-Publish und `verified`, aber nicht die lokale TCP-Implementierung oder lokale MySQL-/Fake-Publisher-Tests.

Folgende Blocker bleiben für das spätere Deployment-Gate offen und sperren nicht die lokale W1L–W3L-Implementierung:

- `CP-BLK-001`: konkrete Dogado-Stagingparameter bestätigen: PHP-/MySQL-Version und Erweiterungen, Datenbankrechte, Zieltarif- und Cron-Grenzen, Secret-Speicher, TLS sowie verbindlicher Deployment-/Rollbackprozess.
- `CP-BLK-005`: Vorschlag bestätigen: aktiven **Scan**-Worker und isolierten `TAG_CONFIG`-Namespace eindeutig zuordnen; einen separaten, minimalen, nur diesen Namespace beschreibenden Publisher-Token in der geschützten PHP-Konfiguration speichern; Publish/Retry/Unpublish ausschließlich über Outbox, Korrelations-ID und redigiertes Audit ausführen. Der getrennte Codec-Betriebsweg ist kein Publisher-Ersatz.
- `CP-BLK-006`: Routingentscheidung ist getroffen: öffentliche Staging-Scans über `s.myqr24.com/t/*` und `s.myqr24.com/t1/*`, privater Codec ausschließlich über `codec.s.myqr24.com/api/v1/*`. Für die spätere Plane-Public-Read-API bleiben CORS, Rate Limit sowie Cache-/Widerrufsbudget zu entscheiden.

Entschiedene Betriebsregel `CP-BLK-003`: Die nicht versionierte Vorbelegung in `tools/.env.local` ist die lokale Testsecret-Quelle und wird mit identischen Namen/Werten in den Cloudflare Secret Store für Staging übernommen. Testvektoren werden daraus nur zur Laufzeit erzeugt, niemals mit Secretwerten versioniert. Die kontrollierte Secret-Rotation und erneute Staging-Evidenz bleiben Betriebsaufgaben.

`W0-WP-05` ist als lokaler Nachweis abgeschlossen. Die externe Dogado-/Staging-Validierung und die übrigen W0-Blocker bleiben davon unberührt.

**Nächste zulässige Aktion:** Zuerst `tag-routing-projection-v1` erstellen und danach die lokale TCP im freigegebenen W1L-Umfang gegen Compose-MySQL implementieren. Persistenz-, Migrations-, Transaktions-, Outbox- und Rollbacktests verwenden ausschließlich synthetische Daten; Cloudflare-Publishing, Dogado und Mail werden über Fake-Adapter getestet. Nach dem lokalen W3L-Gate die exakten Dogado-Stagingdaten und den Staging-Publisher-Betriebsweg ohne Secretwerte ergänzen: PHP-/MySQL-Minor-Versionen und Extensions/SAPIs, Datenbankrechte und TLS, Zieltarif- und Cron-Grenzen, Secret-Speicher, HTTPS/API-Host, Deployment-/Rollbackprozess, aktiven Scan-Worker, isolierten `TAG_CONFIG`-Namespace sowie minimalen Publisher-Token-Scope. Bis zum Deployment-Gate keine reale KV-Mutation durchführen.
