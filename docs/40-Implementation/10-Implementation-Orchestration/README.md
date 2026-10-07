# Autonome Umsetzungsorchestrierung: TAG Control Plane, Control Center und TAG-App

**Statusführung:** [`STATUS.md`](STATUS.md)  
**Arbeitsauftrag:** Dieses Dokument steuert die autonome, wiederanlauffähige Umsetzung der drei Plattformkomponenten. Es ist vor jedem Umsetzungsschritt zusammen mit `STATUS.md` zu lesen und fortzuschreiben.  
**Geltungsbereich:** `apps/tag-control-plane`, `apps/tag-control-center`, `apps/tag-app`, `tools/tag-lab` sowie Verträge unter `docs/10-Architecture/35-Contracts`.  
**Nicht im Scope:** Neuimplementierung oder fachliche Erweiterung des Edge Routers. `apps/edge-router` bleibt die bestehende, kryptografisch autoritative Scan- und Routing-Komponente. Die Control Plane veröffentlicht ausschließlich deren minimale, zulässige KV-Projektion.

---

## 1. Verbindlicher Architekturrahmen

```text
TAG Control Center (Admin-UI)
        │ ausschließlich authentisierte Commands / Queries
        ▼
TAG Control Plane (PHP + MySQL auf Dogado)
  - fachliche Autorität
  - AuthZ, Audit, Lifecycle, Outbox
  - kontrollierter Cloudflare-Publisher
        │ minimale abgeleitete Routing- und Runtime-Projektionen
        ├──────────────────────────────► Cloudflare KV TAG_CONFIG
        │                                  │
        │                                  ▼
        │                              Edge Router (bestehend)
        │                                  │ 302 auf feste TAG-App-URL
        ▼                                  ▼
Public Read / Command APIs              TAG-App (öffentliche PWA)
```

Nicht verhandelbare Regeln:

1. **MySQL und serverseitige Control-Plane-Domänenlogik sind fachlich autoritativ.**
2. **Cloudflare KV ist keine Fachquelle.** Es enthält nur die minimale, nicht personenbezogene Routing-Projektion für den Edge Router.
3. **Browser besitzen niemals DB-, KV-, R2-, Publisher- oder Cloudflare-Token-Zugriff.**
4. Die TAG-App implementiert **keine** Feistel-, HMAC-, Range-, Feature- oder Redirect-Signaturentscheidung.
5. TAG-ID, HMAC-Secrets und `decodedValue` werden ausschließlich nach [`DOMAIN_RULES.md`](../../DOMAIN_RULES.md) verarbeitet.
6. Public APIs, KV, Logs, Evidenz und reguläre Audit-Metadaten enthalten weder Credentials, Secretwerte, Ownerdaten, Audit-Rohdaten, Nachweise noch private Vault-Inhalte.
7. Eine Produktivveröffentlichung ist außerhalb dieser Orchestrierung gesperrt, bis alle dokumentierten Staging- und Sicherheitsgates erfüllt und ausdrücklich freigegeben sind.

---

## 2. Verbindliche Quellen

Vor Beginn einer Welle sind mindestens zu lesen:

- [`TAG_CONTROL_PLANE_AND_BASIS_VAULT.md`](../../10-Architecture/PWA-PHP-Applications/TAG_CONTROL_PLANE_AND_BASIS_VAULT.md)
- [`DOMAIN_RULES.md`](../../DOMAIN_RULES.md)
- [`TAG_TYPES_AND_POI_FEATURES.md`](../../20-Special-Specifications/TAG_TYPES_AND_POI_FEATURES.md)
- [`TAG_VAULT_FEATURE.md`](../../20-Special-Specifications/TAG_VAULT_FEATURE.md)
- [`TAG_APP_ARCHITECTURE.md`](../../10-Architecture/TAG_APP_ARCHITECTURE.md)
- [`TAG-EDGE-APIS/10-ROUTING-AND-URL-CONTRACT.md`](../../20-Special-Specifications/TAG-EDGE-APIS/10-ROUTING-AND-URL-CONTRACT.md)
- komponentenspezifisch: `README.md`, `10-USER-STORIES.md`, `20-TEST-STRATEGY.md`, `21-TEST-CASES.md`, `22-TEST-DATA.md`, `30-TRACEABILITY.md`, `STATUS.md`
- aktueller Übergabestand: [`DEPLOYMENT_HANDOVER.md`](../../90-Session-Change-Summaries/DEPLOYMENT_HANDOVER.md)

Bei Konflikten gelten Architektur- und Domain-Regeln vor UI-Annahmen; ein Konflikt wird als Blocker dokumentiert und nicht stillschweigend im Code entschieden.

### 2.1 Ausschluss unverbindlicher Refinements

`docs/00-Refinement/` ist kein Teil der verbindlichen Quellen und darf bei Start, Wiederaufnahme oder autonomer Umsetzung nicht automatisch gelesen, als Kontext übernommen oder als Anforderung umgesetzt werden. Der Ordner enthält ausschließlich unverbindliche Ideen; maßgeblich bleiben die Architektur-, Domain-, Contract-, Story-, Test-, Traceability- und Statusdokumente außerhalb dieses Ordners.

Eine Idee aus `docs/00-Refinement/` darf nur nach einem ausdrücklich beauftragten Refinement gelesen oder fortgeschrieben werden. Eine spätere Übernahme in die Umsetzung erfordert in dieser Reihenfolge:

1. explizite Architektur- bzw. Fachentscheidung;
2. Fortschreibung der maßgeblichen Architektur- und Domain-Dokumentation;
3. Erstellung oder Anpassung versionierter Contracts;
4. Fortschreibung von Stories, Akzeptanzkriterien, Teststrategie, Testfällen und Traceability;
5. Bewertung von Sicherheits-, Datenschutz-, Betriebs-, Migrations-, Deployment- und Rollback-Auswirkungen;
6. Eintrag eines zulässigen nächsten Arbeitsschritts in Orchestrierungs- und Komponenten-`STATUS.md`.

Erst danach darf die Idee implementiert, migriert, publiziert oder deployt werden.

---

## 3. Zielstruktur der Anwendungen

Die Apps werden erst in der betreffenden Welle erstellt. Vorher keine leeren Scheingerüste anlegen.

| Anwendung | Zielpfad | Primäre Aufgabe | Laufzeit |
| --- | --- | --- | --- |
| Control Plane | `apps/tag-control-plane` | PHP-/MySQL-Backend, Migrationen, Domänenlogik, APIs, Audit, Outbox, Publisher | zuerst lokale Docker-/Compose-MySQL-Topologie, danach Dogado PHP/MySQL |
| Control Center | `apps/tag-control-center` | administrative, desktop-first Web-App ausschließlich über Plane-APIs | statisches Web-/PWA-Build, Staging auf Cloudflare |
| TAG-App | `apps/tag-app` | öffentliche PWA, Claim-/Owner-Flows und ausschließlich öffentliche View-Rendering-Logik | Cloudflare Pages |
| TAG Lab | `tools/tag-lab` | lokale Test- und User-Test-Fixtures, QR-Payloads, dokumentierte Testläufe | lokaler Node-Dienst |
| Lokales Einzeltag-Drucktool (deferred) | später unter `tools/` | lokale Single-Page-Erzeugung eines PDF mit QR-Code für **eine bereits bestimmte TAG-ID** und ein explizit konfiguriertes Zweckform-Label-Format | lokaler Browser, keine Server- oder Cloudflare-Anbindung |
| Edge Router | `apps/edge-router` | bestehende Validierung und KV-basierte Auflösung | bestehender Cloudflare Worker |

Die erste TCP-Implementierungsstufe verwendet die verifizierte lokale Docker-/Compose-MySQL-Topologie. Für diese lokale Stufe wird angenommen, dass die gewählte PHP-/MySQL-Anwendung grundsätzlich auf Dogado betrieben werden kann; diese Annahme ersetzt weder eine Dogado-Kompatibilitätsprüfung noch ein Staging-Deployment. Die noch offene Hostingmatrix ist ausschließlich ein Gate für Dogado-Deployment, echten Staging-Publish und den Status `verified`, nicht für die lokale TCP-Implementierung.

---

## 4. Kontrakt-first-Regel

### 4.1 Ablage und Form

Vor der ersten Implementierung einer Schnittstelle entsteht unter:

```text
docs/10-Architecture/35-Contracts/
```

- ein `README.md` als Contract Overview;
- je Vertrag eine versionierte Markdown-Spezifikation mit Request, Response, Fehlernormalisierung, AuthZ, Caching, Datenklassifikation, Idempotenz und Testreferenzen;
- bei maschinenlesbaren HTTP-Verträgen eine OpenAPI- oder JSON-Schema-Datei im selben Contract-Verzeichnis oder unmittelbar benachbart zur implementierenden App.

Jeder Contract enthält mindestens:

1. **Owner** und implementierende Komponente;
2. Version und Kompatibilitätsstrategie;
3. zulässige Eingaben und kanonische Formate;
4. Response- und neutrale Fehlerformen;
5. Authentisierungs-, Autorisierungs-, CSRF- und Rate-Limit-Regeln;
6. Cache-Control-, CORS- und Widerrufsverhalten;
7. Datenklassifikation inklusive explizit ausgeschlossener Felder;
8. Idempotenz- und Korrelations-ID-Verhalten;
9. Contract-Testreferenzen.

### 4.2 Mindest-Contracts in Lieferreihenfolge

| Contract | Erstes Ziel | Abhängige Komponenten |
| --- | --- | --- |
| `tag-routing-projection-v1` | Plane → bestehendes `TAG_CONFIG`/Edge-Router-Schema | Control Plane, Edge Router |
| `control-plane-admin-api-v1` | Control Center → Plane: Session, Commands, Queries, Fehler | Control Center, Control Plane |
| `public-tag-view-v1` | TAG-App → Plane: `GET /api/v1/tags/{tagId}/view` | TAG-App, Control Plane |
| `public-tag-claim-v1` | TAG-App/Support → Plane: neutraler Claim-Command | TAG-App, Control Center, Plane |
| `tag-runtime-projection-v1` | Plane → öffentliche Runtime-Projektion/Read-Service | Plane, TAG-App |
| `owner-session-and-content-v1` | TAG-App Owner-Flow → Plane | TAG-App, Plane |
| `collection-api-v1` | TAG-App → Plane: accountgebundene Collections | TAG-App, Plane |

Der bestehende Edge-Router-Vertrag bleibt maßgeblich. Er wird nur angepasst, wenn ein Contract-Test belegt, dass die Plane-Projektion ein bereits spezifiziertes Edge-Schema nicht erfüllen kann. Eine Edge-Änderung benötigt dann eine eigene Story-, Test-, Traceability- und Staging-Freigabe.

---

## 5. Autonomes Arbeitsprotokoll

### 5.1 Start oder Wiederaufnahme

1. `STATUS.md` lesen und den **einzigen nächsten zulässigen Arbeitsschritt** identifizieren.
2. Prüfen, ob der Status zu Git-Branch, Commit, lokalen Änderungen und Deployments passt.
3. Die Quellen aus Abschnitt 2 sowie die Stories und Tests des betroffenen Arbeitspakets lesen.
4. Fehlende Entscheidung, Zugang, Hostingressource oder nicht verifizierbare Annahme als Blocker in `STATUS.md` erfassen.
5. Nur den nächsten ungesperrten Story-Umfang implementieren. Keine späteren Stories vorziehen.
6. Nach jedem sinnvollen Schritt Status, Testlauf, Evidenzpfad, Commit und bekannte Restrisiken ergänzen.
7. Bei Unterbrechung endet die Arbeit mit einem konsistenten `STATUS.md`: aktuelles Paket, letzter Nachweis, nächster Befehl, Blocker.

### 5.2 Story-Gate: strikt und ohne Ausnahme

Eine User Story darf erst verlassen werden, wenn alle folgenden Punkte erfüllt sind:

- Akzeptanzkriterien implementiert;
- zugehörige Unit-, Service-, Integrations-, Contract- und Negativtests grün;
- Sicherheits- und Leak-Tests grün;
- Traceability aktualisiert;
- relevante lokale Testdaten redigiert und deterministisch;
- erforderliche Staging-Evidenz erfolgreich, sofern die Story einen echten Staging-Schritt enthält; für W1L–W3L sind stattdessen Fake-Adapter-, Contract- und lokale Compose-MySQL-Nachweise erforderlich;
- Komponenten-`STATUS.md` und Orchestrierungs-`STATUS.md` aktualisiert.

**Regel:** Alle Stories eines zusammenhängenden Story-Gates müssen erfolgreich getestet sein, bevor eine abhängige Story begonnen wird. Unabhängige Arbeiten innerhalb derselben Welle dürfen nur verschränkt erfolgen, wenn die Contract-Version bereits festgeschrieben und getestet ist.

### 5.3 Lokale PHP-/MySQL-Testumgebung für Anwendungskomponenten

Die gemeinsame, anwendungsneutrale Docker-Topologie unter [`tools/local-php-mysql/`](../../../tools/local-php-mysql/README.md) ist für alle künftigen PHP-/MySQL-Anwendungskomponenten verbindlich. Sie ist als W0-Artefakt verifiziert und enthält:

- MySQL `8.4` in einem privaten Compose-Netz ohne Host-Port;
- PHP `8.4` CLI mit Composer und `pdo_mysql`;
- eine ausschließlich lokale, Git-ignorierte `.env.local` mit synthetischen Werten;
- einen PDO-Selbsttest für Verbindung, `utf8mb4`, UTC, InnoDB-Commit und Rollback;
- einen klar als lokal und destruktiv markierten Volume-Reset.

Vor einem PHP-/MySQL-Integrationslauf wird die Topologie mit den dokumentierten Befehlen gestartet und der Selbsttest ausgeführt:

```powershell
docker compose --env-file tools/local-php-mysql/.env.local -f tools/local-php-mysql/compose.yaml up -d mysql
docker compose --env-file tools/local-php-mysql/.env.local -f tools/local-php-mysql/compose.yaml --profile verify run --rm php /workspace/scripts/verify-mysql.php
```

Nach dem Lauf wird die Umgebung regulär angehalten; dies erhält das lokale Volume:

```powershell
docker compose --env-file tools/local-php-mysql/.env.local -f tools/local-php-mysql/compose.yaml down
```

`down -v` ist ausschließlich für einen bewusst verlangten lokalen Reset zulässig. Er darf nie für Staging oder Produktion dokumentiert oder verwendet werden.

Für spätere App-Integration gelten zusätzlich:

1. Unit-Tests benötigen keine Datenbank, kein Netzwerk und keine Dateisystemabhängigkeit.
2. Persistenz-, Constraint-, Migrations-, Parallelitäts-, Locking-, Outbox- und Rollback-Nachweise laufen gegen Compose-MySQL. SQLite- und In-Memory-Doubles sind dafür unzulässig.
3. Integrationstests nutzen nur synthetische Daten sowie eine getrennte Testdatenbank oder einen kontrollierten Schema-Reset; sie bereinigen ihren Zustand.
4. Externe Ports, insbesondere Cloudflare-Publishing, Dogado und Mail, werden lokal gefakt. Reale externe Tokens, Hosts und APIs sind in lokalen Tests verboten.
5. Die künftige Anwendung wird als lokaler Mount eingebunden; sie wird nicht in das generische W0-Testimage kopiert.
6. Ein lokaler Erfolg kann `implemented` stützen, ersetzt aber niemals Dogado-Kompatibilität, Staging-Evidenz oder den Status `verified`.

### 5.4 Qualitätsbefehle und Evidenz

Jede App muss vor Staging mindestens bieten bzw. dokumentieren:

```text
install / setup
lint
typecheck oder static analysis
unit test
MySQL integration test
contract test
security / negative test
build oder package verification
local smoke test
```

Die konkreten App-Befehle müssen dieselbe lokale Compose-Topologie verwenden oder dokumentiert kompatibel dazu sein. Evidenz wird redigiert unter `docs/40-Implementation/evidence/` abgelegt. Keine Tokens, Cookies, Credentials, personenbezogenen Daten, realen Claim-Secrets, vollständigen Nachweise oder privaten URLs in Evidenz, Screenshots oder Logs speichern.

---

## 6. Verschänkte Umsetzungswellen

Die Reihenfolge basiert auf fachlichen Voraussetzungen; sie ist ausdrücklich nicht rein komponentenweise.

### Welle 0 – Betriebsfähigkeit, Entscheidungen und Verträge

**Ziel:** Reproduzierbarer lokaler Ausgangspunkt ohne implizite Infrastrukturannahmen.

1. Hostingmatrix für Dogado/PHP/MySQL/Composer/Cron/Secrets erstellen.
2. Staging-Ressourcen identifizieren: API-Host, DB, isolierter KV-Namespace, Staging-Pages-Origin, Publisher-Token-Scope.
3. Contract-Overview und `tag-routing-projection-v1` erstellen.
4. Bestehenden Edge Router mittels Contract-Tests gegen die Projektion absichern.
5. Die verifizierte lokale PHP-/MySQL-Docker-Topologie unter [`tools/local-php-mysql/`](../../../tools/local-php-mysql/README.md) für alle künftigen PHP-Anwendungskomponenten verwenden: isoliertes MySQL, PHP mit `pdo_mysql`, synthetische Testsecrets, Fake-Cloudflare-Adapter und reproduzierbarer PDO-Selbsttest.
6. TAG Lab um eine versionierte, ausschließlich nichtproduktive Testtag-Katalogstruktur vorbereiten.

**Gate W0:** Contract-Review, lokale Toolchain und Testtag-Policy dokumentiert. Die Ressourcenmatrix wird als nachgelagerter Deployment-Backlog fortgeführt.  
**Nächste lokale Stufe:** `CP-BLK-001`, `CP-BLK-005` und `CP-BLK-006` sperren weder die Anlage noch die lokale Implementierung und Testausführung der TCP. Sie bleiben zwingende Gates vor Dogado-Deployment, echtem Staging-KV-Publish, einer Staging-Read-API und jedem Status `verified`. Das Testsecret-Konzept `CP-BLK-003` ist entschieden; in lokalen Tests dürfen ausschließlich synthetische, Git-ignorierte Werte und Fake-Adapter verwendet werden.

### Welle 1L – Lokales Control-Plane-Fundament und Admin-Sicherheitsrahmen

**Control Plane:** `CP-US-001`, `CP-US-002` / `CP-I01`.  
**Control Center:** nur die dafür nötigen Teile von `CC-US-001` bis `CC-US-004`: sichere Session- und Rollen-UX gegen reale Plane-Auth-Contracts, keine Fachmutation ohne Backend.  
**Contracts:** `control-plane-admin-api-v1` (Auth-/Session-/Fehlerrahmen).

Ergebnisse:

- `apps/tag-control-plane` mit Konfiguration, Migrationen, DB-Transaktionsgrenze, AuthZ-Hooks, Audit-Service, Health-/Readiness-Checks;
- `apps/tag-control-center` als minimale Admin-App mit Login, Logout, Rollenansicht, CSRF-geschützten Requests und Audit-Viewer-Skelett;
- lokale MySQL-Integrationstests und CSRF/AuthZ/Leak-Negativtests.

**Gate W1L:** `CP-G1`; alle erwähnten CP- und CC-Stories lokal gegen Compose-MySQL getestet.  
**Lokale Freigabe:** `apps/tag-control-plane` darf in dieser Welle angelegt und umgesetzt werden. Reale Dogado-Verbindungen, reale Cloudflare-Tokens, echter Staging-Publish und fachliche TAG-Vergabe außerhalb synthetischer lokaler Testdaten bleiben gesperrt.

### Welle 2L – Lokale Ranges, Pools, Reservierung, Status und Control-Center-Verwaltung

**Control Plane:** `CP-US-010` bis `CP-US-013`, `CP-US-011`, `CP-US-012`.  
**Control Center:** `CC-US-010` bis `CC-US-015`, `CC-US-012`, `CC-US-013`.  
**Contracts:** Admin Commands/Queries für Range, Pool, Feature-Referenzen, Reservierung, Lifecycle.

Ergebnisse:

- Range-/Pool-Domäne und atomare 6-/8-stellige Reservierung;
- vollständige 16er-Slot-Validierung, Unique Constraints, Retry-/Idempotenz-Logik;
- Statusautomat und Audit;
- Control-Center-Ansichten für Entwurf, Pool, Range, Reservierung und Status;
- keine Cloudflare-Veröffentlichung.

**Gate W2L:** `CP-G2`; Parallel-, Retry-, Slot-, Status- und Rollen-Negativtests lokal grün.  
**Testtag-Vorbereitung:** lokale synthetische Reservierungen sind zulässig. Staging-IDs und jede KV-Projektion bleiben bis zur nachgelagerten Deploymentstufe gesperrt.

### Welle 3 – Routing-Projektion, Publisher und realer Staging-Scan

**Control Plane:** `CP-US-030` bis `CP-US-032`.  
**Control Center:** `CC-US-020` bis `CC-US-023`.  
**TAG-App:** `APP-US-006` als Integrationsnachweis, bestehende PWA bleibt fixturebasiert.  
**Contracts:** fertiges `tag-routing-projection-v1`; veröffentlichter `public-tag-view-v1` zunächst als Schema/Fake für die nächste Welle.

Ergebnisse:

- fertiger und getesteter `tag-routing-projection-v1`-Contract einschließlich exaktem KV-Dokumentformat, erlaubten Keys, Datenminimierung, Revision und Unpublish-Semantik;
- Feature-Validierung und minimale Projektion;
- atomare Fachmutation + Audit + Outbox;
- idempotenter Publisher mit Fake-Cloudflare-Testadapter und lokalen Publish-/Retry-/Unpublish-Tests;
- Control-Center-Projektionsdiff, Publish-/Retry-/Unpublish-Status;
- erst nach einem separaten Deployment-Gate: realer Staging-Publish und Unpublish ausschließlich im bestätigten Staging-Namespace;
- `tools/tag-lab` erzeugt QR-Payload und dokumentiert Test-URL für veröffentlichte Staging-Tags.

**Lokales Gate W3L:** Contract-, Fake-Publisher-, Outbox-, Idempotenz-, Retry- und Unpublish-Tests grün.  
**Deployment-Gate vor echtem KV-Write:** (1) aktiver Staging-Scan-Worker und sein `TAG_CONFIG`-Namespace bestätigt, (2) minimaler separater Staging-API-Token mit ausschließlich KV-Schreibrechten für genau diesen Namespace erstellt, (3) Token ausschließlich serverseitig sicher abgelegt, (4) Dogado-Deployment- und Secret-Speicherweg bestätigt, (5) reservierter nichtproduktiver Staging-Testtag samt Cleanup-Regel vorhanden und (6) redigierter Publish-/Redirect-/Unpublish-Nachweis geplant.  
**Gate W3:** `CP-G4`, positiver und negativer Router-Redirect; `APP-US-006` grün.  
**Sperre:** Kein Produktionsnamespace, keine Produktionsroute, keine manuellen KV-Fachänderungen.

### Welle 4 – Öffentlicher PublicTagView, TAG-App-API-Ablösung und Basis-Vault

**Control Plane:** `CP-US-035`, `CP-US-040`, `CP-US-041`.  
**Control Center:** `CC-US-024`, `CC-US-030` bis `CC-US-032`.  
**TAG-App:** `APP-US-003`, `APP-US-004`, `APP-US-010`, `APP-US-011`, `APP-US-013`, `APP-US-014`, `APP-US-015`, `APP-US-073`; vorhandene Implementierung wird von Fixture auf API-Vertrag migriert.  
**Contracts:** `public-tag-view-v1`, `tag-runtime-projection-v1`.

Ergebnisse:

- versionierte und bereinigte Runtime-Projektion;
- öffentliche, read-only PublicTagView-API mit neutralen Nichtverfügbarkeitsantworten;
- CORS- und Cache-Policy, Rate Limit und Leak-Tests;
- Control-Center-Basis-Vault-Entwurf, Diff, Publish und Unpublish;
- TAG-App nutzt die API; Fixtures bleiben nur in explizitem lokalen Testmodus;
- realer Scan: Edge Router → TAG-App → Read API → ausschließlich veröffentlichte Daten.

**Gate W4:** `CP-G5` und `CP-G6`; positive und neutrale Scan-Evidenz.  
**Sperre:** Kein Owner-, Claim- oder privater Content-Flow, bevor View-/Widerrufsverhalten bewiesen ist.

### Welle 5 – Claiming, Besitzanker, Collections und Support

**Control Plane:** `CP-US-025` bis `CP-US-029`, `CP-US-033`, `CP-US-034`.  
**Control Center:** `CC-US-016`, `CC-US-017`; vertrauliche Export-/Produktionsanteile nur nach den freigegebenen Policies.
**TAG-App:** `APP-US-016`, `APP-US-017`, `APP-US-064`, `APP-US-072`, `APP-US-065`.  
**Contracts:** `public-tag-claim-v1`, `collection-api-v1`, Owner-Setup-Contract.

Ergebnisse:

- gemeinsamer atomarer Claim-Service für TAG-App und Support;
- Credential-Hashing, Lockout, Rate Limit, neutralisierte Antworten;
- Besitzanker / Owner-Passphrase / kurzlebige, TAG-gebundene Session;
- serverseitige Collections mit `no-store`;
- TAG-App-Claim und Support-Claim ohne Credential-Persistenz;
- ausschließlich synthetische Claim-Secrets in lokalen und Staging-Tests.

**Gate W5:** Parallelclaim-, Lockout-, Reset-, Claim-Leak-, Session- und Collection-Isolationstests grün; reale Staging-Tests nur mit eigens bereitgestellten Test-TAGs.

### Welle 6 – Kontrollierter Druckexport, QA und Übergabe

**Control Plane:** `CP-US-020` bis `CP-US-024`, `CP-US-027`.  
**Control Center:** eigenständige Exportfunktion nach lauffähigem TCC-/TCP-Fundament: autorisierte Auswahl einer einzelnen bereits reservierten TAG-ID oder eines zulässigen Ranges, kontrollierte Freigabe sowie unveränderlicher Snapshot-/Exportdatensatz. Der Export enthält nur die für die externe Aufbereitung nötigen, kanonischen Daten, insbesondere TAG-ID, Scan-URL, QR-Payload, Vorlagen-/Exportversion, Umfang, Zeitpunkt, Akteur, Prüfsumme und Audit-/Korrelationsreferenz. Er ist bewusst von der TAG-Verwaltung entkoppelt und wird nicht in deren frühe Iterationen vorgezogen.  
**Nicht Bestandteil von TCC/TCP:** PDF- oder Label-Layout, Druckeransteuerung, Druckwarteschlange, druckerspezifische Rückmeldungen, physischer Druck und die technische Druckaufbereitung.  
**TAG-App:** nur notwendige Capability-Darstellung, keine Export- oder Drucklogik.  
**Contracts:** vertraulicher Snapshot-/Druckexportvertrag sowie getrennte QA-/Übergabeverträge.

**Vorläufig zurückgestellt:** Ein getrenntes lokales Tool unter `tools/` verarbeitet ausschließlich einen kontrolliert erzeugten TCC-/TCP-Exportdatensatz und bereitet ihn lokal als PDF mit QR-Code für ein konkret versioniertes Zweckform-Label-Format auf. Es kann anschließend über den lokalen Browser-/Betriebssystemdruckdialog gedruckt werden, besitzt aber keine TAG-Vergabe, keine Range-Auswahl, keine Claim-/Ownerdaten außerhalb des freigegebenen Exports, keine Datenbank, keine TCC-/TCP-API, keine Cloudflare-Credentials und keine Publish-/Aktivierungswirkung. Der TCC-/TCP-Export löst selbst weder Druck noch Publish oder Aktivierung aus.

**Gate W6:** `CP-G3`; Snapshot-Determinismus, Exportdatenminimierung und Credential-Schutz sowie getrennte QA-/Ausschuss-/Nachdruck-/Übergabe-Gates und Staging-Probe belegt.

### Welle 7 – Owner-Inhaltsverwaltung, Produkte, Organisationen und POI

**Control Plane:** `CP-US-050`, `CP-US-051`.  
**Control Center:** `CC-US-040` bis `CC-US-043`.  
**TAG-App:** `APP-US-020` bis `APP-US-022`, `APP-US-025`, `APP-US-026`; Uploads erst nach separater R2-/Retention-Freigabe.  
**Contracts:** `owner-session-and-content-v1`, Policy- und POI-Contracts.

**Gate W7:** Produkt-/Organisations-/POI-Policy, Nachweisabschottung, Review, Audit und Runtime-Neutralisierung erfolgreich getestet.

### Zurückgestellt

Chat, Lost & Found, Guestbook, Check-ins, Campaigns, private Freigaben, Upload-/R2-Workflows, Zahlungen und Fulfillment bleiben entsprechend ihren Stories **deferred**, bis ihre eigenen Sicherheits-, Datenschutz- und Betriebsentscheidungen freigegeben sind. Sie werden nicht implizit in eine frühere Welle aufgenommen.

---

## 7. TAG-Lab-Testdaten und physische User-Tests

`tools/tag-lab` erhält in Welle 0/Welle 3 eine dokumentierte Katalogdatei oder einen gleichwertigen Testdatenadapter. Jede Testdefinition enthält:

```text
Test-ID, Umgebung, Zweck, öffentliche tagId, decodedValue nur falls lokal erforderlich,
Range/Feature-Referenz, erwartete Scan-URL, erwartete Zielroute,
Lifecycle-/Sichtbarkeitszustand, benötigte Publish-Revision, Cleanup-Regel
```

Regeln:

- lokale Tests nutzen ausschließlich kanonische, synthetische lokale Testtags; Staging-TAGs sind erst nach dem W3D-Deployment-Gate zulässig;
- keine realen Kunden-, Owner-, Organisations- oder Credentialdaten;
- reale Claim-Secrets ausschließlich kurzzeitig in freigegebenem Testkanal, nie im Repository;
- `stagv001` bleibt als bestehende Router→PWA-Fixture nur solange der Edge-Testvertrag dies vorsieht;
- neue Testtags werden erst nach der Wellen-Gate-Freigabe in KV publiziert;
- nach Unpublish-Test wird die erwartete neutrale Wirkung dokumentiert;
- jeder User-Test hat einen positiven Scan, einen unbekannten/gesperrten Negativscan und einen Cleanup-/Rollback-Schritt.

---

## 8. Staging- und Deployment-Automatisierung

1. Lokale Tests und Build sind zwingend vor jedem Deployment.
2. Staging deployt ausschließlich aus einem nachvollziehbaren Commit mit aktualisiertem Status und Evidenzreferenz.
3. Plane-Migrationen sind vor Deployment als Up-/Down-/Restore-Test geprüft; destructive Migrationen benötigen explizite Freigabe.
4. Publisher-Testtoken ist auf den isolierten Staging-Namespace minimiert; Production-Token wird in Staging nie geladen.
5. Nach Publish zwingend automatisiert prüfen:
   - erwartete KV-Projektionsform (redigiert);
   - Edge-Redirect;
   - TAG-App-Route;
   - PublicTagView-Response, CORS und Cache-Control;
   - neutrale Wirkung nach Unpublish.
6. Jeder Staging-Fehler erzeugt einen retrybaren Outbox-/Betriebsstatus und eine redigierte Evidenz. Nicht mit manueller KV-Manipulation „reparieren“.
7. Produktion bleibt deaktiviert, bis alle vorherigen Gates sowie getrennte Betriebs- und Sicherheitsfreigaben nachweisbar erfüllt sind.

---

## 9. Statuspflege und Wiederanlauf

`STATUS.md` ist das operative Journal. Es ersetzt die Komponentendateien nicht:

- `docs/40-Implementation/tag-control-plane/STATUS.md`
- `docs/40-Implementation/tag-control-center/STATUS.md`
- `docs/40-Implementation/tag-app/STATUS.md`

Bei jedem Abschluss oder Blocker aktualisieren:

1. Welle, Arbeitspaket und Story-IDs;
2. Status `planned | in-progress | blocked | implemented | verified`;
3. Git-Commit und relevante Pfade;
4. exakt ausgeführte Testbefehle und Ergebnis;
5. Staging-Deployment/-Version/-URL ohne Secrets;
6. Evidenzpfade;
7. neu erkannte Risiken oder Blocker;
8. **nächster zulässiger Befehl bzw. nächste zulässige Aktion**.

Ein Neustart beginnt ausschließlich mit `STATUS.md`, dem Abgleich gegen den Workspace und einer Prüfung, ob der letzte dokumentierte Nachweis noch gültig ist.
