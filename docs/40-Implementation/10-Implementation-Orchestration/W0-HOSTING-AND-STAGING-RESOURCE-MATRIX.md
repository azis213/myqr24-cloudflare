# W0 – Hosting- und Staging-Ressourcenmatrix

**Status:** `in-progress`  
**Arbeitspakete:** `W0-WP-01`, vorbereitender Befund für `W0-WP-02`  
**Stand:** 2026-10-06  
**Datenklassifikation:** Diese Matrix enthält ausschließlich nicht geheime, redigierte Betriebsmetadaten. Sie enthält keine Tokens, Credentials, Secretwerte, personenbezogenen Daten oder vollständigen KV-Inhalte.

## 1. Zweck und Verbindlichkeit

Diese Matrix dokumentiert ausschließlich gegen Repository, lokale Entwicklungsumgebung und vorhandene Evidenz verifizierbare Voraussetzungen für die spätere TAG Control Plane auf Dogado sowie deren Staging-Integration mit Cloudflare.

Sie ist **keine Bestätigung** einer produktionsähnlichen Control-Plane-Architektur. Insbesondere beweisen lokal installierte PHP-, Composer- oder Node-Versionen keine Fähigkeiten des Dogado-Hostings. Nicht bestätigte Angaben bleiben bewusst als offene Entscheidung oder Blocker ausgewiesen.

Verbindliche Architekturgrenzen:

- MySQL und serverseitige Control-Plane-Logik sind fachlich autoritativ.
- Cloudflare KV ist nur eine minimale, abgeleitete Routing-Projektion.
- Ein Publisher-Token darf ausschließlich serverseitig und nur für einen isolierten Staging-Namespace verfügbar sein.
- Browser erhalten niemals Zugriff auf MySQL, KV, R2, Publisher-Tokens oder sonstige Cloudflare-Credentials.
- Vor W0-Gate werden keine Anwendungen unter `apps/tag-control-plane` oder `apps/tag-control-center` angelegt.

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
| PHP-Version und unterstützte SAPIs | Plane-API, Admin-Backend, Migrationen | Unterstützte, gepflegte PHP-Version; CLI-/Web-Ausführungsmodell muss bekannt sein | Nur lokale PHP CLI `8.5.0` bekannt; keine Dogado-Angabe | `open` | PHP-Version, aktivierte SAPIs, INI-/Extension-Policy und geplanter Runtime-Support |
| PHP-Extensions | Passwort-Hashing, JSON, HTTP-Client, DB-Zugriff, Kryptografie | Mindestens sichere Passwort-Hashing-, PDO-MySQL-, JSON-, OpenSSL-/HTTP-Fähigkeiten oder dokumentierte Alternative | Keine Dogado-Extension-Liste | `open` | Vollständige, redigierte Extension-Liste und zulässige Library-Alternativen |
| Composer | reproduzierbarer Dependency-Install und Security-Updates | Serverseitiger oder CI-basierter, nachvollziehbarer Installationsweg | Composer lokal `2.8.12`; Dogado unbekannt | `open` | Verfügbare Composer-Version oder verbindlicher Build-/Upload-Prozess |
| MySQL-/MariaDB-Version | autoritative Datenbank, Transaktionen, Unique Constraints, Migrations- und Restore-Tests | Transaktionen, Constraints, Indizes, sichere Zeichensätze und Backup/Restore erforderlich | Kein Dogado-DB-Nachweis; kein lokaler MySQL-Client | `open` | Engine/Version, Host/Port-Form, TLS, Datenbank-/Benutzertrennung, Backup/Restore und Größen-/Verbindungslimits |
| Datenbankberechtigungen | Migrationen, getrennte Laufzeitrollen | Least privilege; keine Browserzugriffe | Nicht bestätigt | `open` | Migration- und Runtime-Rolle, Rechteumfang, Credential-Rotation |
| Cron/Queue/Worker | Outbox-Publisher, Retries, Ablauf- und Betriebsaufgaben | Zuverlässiger serverseitiger Scheduler; Laufzeit- und Parallelitätsgrenzen müssen bekannt sein | Nicht bestätigt | `open` | Cron-Verfügbarkeit, minimale Frequenz, Locking-/Retry-Mechanik, Laufzeitlimits und Fehlerbenachrichtigung |
| Server-Secret-Speicher | DB-Credentials, Session-/CSRF-Schlüssel, Publisher-Token | Kein Secret in Git, Webroot, Browser, Logs oder Evidenz | Nicht bestätigt | `open` | Zulässiger Secret-Speicher, Zugriffsmodell, Rotation, Deployment-Injektion und Notfallwiderruf |
| HTTPS, API-Host und Zertifikate | Admin- und Public-Read-API | TLS, getrennte Origins und keine Secretübertragung an Browser | Nicht bestätigt | `open` | Staging-API-Hostname, TLS-Verwaltung, DNS-Zuständigkeit, Zertifikatserneuerung |
| Deploymentweg und Rollback | nachvollziehbare Staging-Releases | Commit-gebunden, reproduzierbar, Rollback-fähig | Nicht bestätigt | `open` | CI/SFTP/Git-Deploy/anderer Weg, Artefaktgrenzen, Rechte, Rollback und Audit |
| Webserver-/PHP-Sicherheitsgrenzen | Sessions, Uploads, Fehlerbehandlung, Logs | sichere Header, Webroot-Trennung, keine Fehlermeldungslecks | Nicht bestätigt | `open` | Document-Root, Umgebungsvariablen, PHP-Fehler-/Access-Logs, Log-Retention und Konfigurationsgrenzen |

### Lokale PHP-/MySQL-Testtopologie

Die anwendungsneutrale Compose-Topologie unter [`../../../tools/local-php-mysql/`](../../../tools/local-php-mysql/README.md) ist für `W0-WP-05` festgelegt und erfolgreich lokal verifiziert. Sie enthält eine isolierte lokale MySQL-8.4-Instanz, ein PHP-8.4-CLI-Testimage mit `pdo_mysql` und einen nichtfachlichen PDO-Verifikationstest. MySQL besitzt keinen Host-Port und ist nur im internen Compose-Netz für den PHP-Testcontainer erreichbar.

Der redigierte Selbsttest bestätigte eine PDO-Verbindung, `utf8mb4`, UTC, InnoDB-Commit und Rollback. Die temporäre Verifikationstabelle wurde entfernt; Container und Netzwerk wurden anschließend per nicht-destruktivem `down` entfernt. Das ausschließlich lokale benannte Daten-Volume bleibt dabei erhalten.

Verbindliche lokale Grenzen:

- Die lokale Topologie ersetzt weder Dogado- noch Staging-Nachweise.
- `.env.local` enthält ausschließlich synthetische lokale Werte und bleibt unversioniert; Staging- und Production-Secrets sind unzulässig.
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
| Interner Staging-TAG-Codec | Noch nicht implementiert; der verbindliche Entwurf ist [`tag-codec-internal-v1`](../../../10-Architecture/35-Contracts/tag-codec-internal-v1.md) | `open` | Nicht öffentliche Worker-Route, `FEISTEL_SECRET_S01`, `TAG_HMAC_SECRET_S01`, rotierbarer `TAG_CODEC_API_KEY_S01`, Rate Limit und kompatible Testvektoren vor Staging bestätigen |
| Staging-Public-Read-API | Nicht vorhanden | `open` | API-Host, CORS-Allowlist, Rate Limit, Cache- und Widerrufsbudget festlegen (`CP-BLK-006`) |
| Staging-Datenbank | Nicht nachgewiesen | `open` | Erst nach Dogado-Hostingmatrix anlegen bzw. referenzieren |
| Publisher-Token | Kein Tokenwert oder Scope dokumentiert; das ist korrekt | `open` | Minimaler, nur Staging-`TAG_CONFIG` erlaubender Scope, Secret-Speicher und Betriebsweg bestätigen (`CP-BLK-005`) |
| Staging-Worker-Secrets | `FEISTEL_SECRET_S01`, `TAG_HMAC_SECRET_S01` und `REDIRECT_SIGNING_SECRET_S01` sind laut Betriebsrückmeldung in Cloudflare angelegt; keine Werte im Repository dokumentiert | `partially-resolved` | Aktive Worker-Version mit den erwarteten Bindungsnamen vor einem echten Scan-Nachweis verifizieren; kompatible Testvektoren bleiben offen (`CP-BLK-003`) |
| Production-Ressourcen | Nicht Gegenstand der aktuellen Welle | `not-started` | Nicht konfigurieren, nicht veröffentlichen und keine Production-Secrets laden |

## 5. Festgestellte Dokumentationsabweichungen

| Referenz | Befund | Auswirkung | Behandlung |
| --- | --- | --- | --- |
| `AGENT.md` gegenüber aktueller Orchestrierung, Übergabe und Evidenz | Veraltete bzw. abweichende Scan-Hosts und Pfadmuster sind enthalten | Keine Infrastruktur- oder Codeentscheidung aus diesen Angaben ableiten | Als Dokumentationsbereinigung separat vor einem zukünftigen Edge-bezogenen Arbeitsschritt durchführen; Edge Router bleibt außerhalb des W0-Scopes |
| `apps/edge-router/wrangler.toml` gegenüber `DEPLOYMENT_HANDOVER.md` | Routenkommentare enthalten zusätzliche Root- und `t1`-Muster, während die Übergabe engere Muster nennt | Aktive Routinggrenzen sind nicht allein aus Dokumentation beweisbar | Cloudflare-Dashboard und aktive Worker-Version vor W3 als Nachweis abgleichen; keine Änderungen in W0 |
| Evidenz gegenüber Orchestrierungsstatus | Evidenz fordert vor KV-Änderungen die Identifikation der aktiven Worker-/Redirect-Konfiguration | Blindes Schreiben in den konfigurierten Namespace ist untersagt | Als Voraussetzung in `CP-BLK-005` und W0-WP-02 führen |

## 6. Ergebnis, Blocker und nächster zulässiger Schritt

`W0-WP-01` ist **fachlich noch nicht abgeschlossen**, weil keine realen Dogado-Umgebungsdaten vorliegen. Es ist jedoch dokumentiert, welche Informationen fehlen, welche lokalen Voraussetzungen bestehen und welche Staging-Ressourcen nachweisbar sind.

Folgende Blocker bleiben für das W0-Gate offen:

- `CP-BLK-001`: Dogado PHP-/MySQL-/Composer-/Cron-/Secret-Fähigkeiten bestätigen.
- `CP-BLK-003`: kompatible Staging-Testvektoren für Edge Router und internen TAG-Codec festlegen; `FEISTEL_SECRET_S01` und `TAG_HMAC_SECRET_S01` sind als Cloudflare Worker Secrets angelegt und verbleiben ausschließlich dort.
- `CP-BLK-005`: aktiven Edge Worker, isolierten Namespace, minimalen Publisher-Scope sowie die nicht öffentliche Codec-Route, `TAG_CODEC_API_KEY_S01`-Speicherung, Rate Limit und Betriebsweg verbindlich bestätigen.
- `CP-BLK-006`: Staging-Public-Read-API-Origin, CORS, Rate Limit und Cache-/Widerrufsbudget entscheiden.

`W0-WP-05` ist als lokaler Nachweis abgeschlossen. Die externe Dogado-/Staging-Validierung und die übrigen W0-Blocker bleiben davon unberührt.

**Nächste zulässige Aktion:** Die bestätigbaren Dogado-Stagingdaten bei der Hosting-/Betriebszuständigkeit einholen und die Hosting- sowie Staging-Ressourcenmatrix ohne Secretwerte ergänzen. Die lokale Compose-Topologie wird nur bei Bedarf gemäß ihrer README erneut geprüft. Bis zum W0-Gate keine Control-Plane- oder Control-Center-Anwendung anlegen und keine KV-Mutation durchführen.
