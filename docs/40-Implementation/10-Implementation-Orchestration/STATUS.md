# Operativer Orchestrierungsstatus: TAG-Plattform

**Orchestrierungsanweisung:** [`README.md`](README.md)  
**Stand:** 2026-10-06  
**Gesamtstatus:** `planned`  
**Aktive Welle:** `W0 – Betriebsfähigkeit, Entscheidungen und Verträge`  
**Nächster zulässiger Arbeitsschritt:** Hosting- und Staging-Ressourcenmatrix für die TAG Control Plane erfassen und die bekannten Blocker gegen reale Umgebungsdaten prüfen.  
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
| `W0-WP-01` | Dogado-Hostingmatrix erheben: PHP, Extensions, Composer, MySQL, Cron/Queue, HTTPS, Secret-Speicher, Deploymentweg | `docs/40-Implementation/10-Implementation-Orchestration/` | `planned` | versionierte Matrix, keine Secretwerte |
| `W0-WP-02` | Staging-Ressourcenmatrix erheben: API-Host, DB, Staging-KV, Pages-Origin, Publisher-Scope und DNS/CORS-Grenzen | Orchestrierungsstatus / Deploymentdokumentation | `planned` | redigierte Ressourcenreferenzen und Zuständigkeiten |
| `W0-WP-03` | Contract Overview und `tag-routing-projection-v1` erstellen | `docs/10-Architecture/35-Contracts/` | `planned` | Review und Contract-Testreferenzen |
| `W0-WP-04` | Bestehenden Edge Router gegen Routing-Projection-Contract prüfen | `apps/edge-router/test/` | `planned` | grüne Contract-/Regressionstests |
| `W0-WP-05` | Lokale Testtopologie festlegen: isoliertes MySQL, Fake-Cloudflare-Adapter, Testsecrets und Befehle | Plane-/Orchestrierungsdokumentation | `planned` | reproduzierbarer lokaler Setup-/Smoke-Test |
| `W0-WP-06` | TAG-Lab-Testtag-Katalog und Datenminimierungsregeln konzipieren | `tools/tag-lab/` | `planned` | versionierter nichtproduktiver Katalogvertrag |

---

## 4. Aktive Blocker und Entscheidungen

| ID | Status | Beschreibung | Auflösungskriterium | Nächste Aktion |
| --- | --- | --- | --- | --- |
| `CP-BLK-001` | `open` | Dogado PHP-/MySQL-/Composer-/Cron-/Secret-Fähigkeiten sind nicht bestätigt. | Hostingmatrix liegt vor. | `W0-WP-01` |
| `CP-BLK-002` | `open` | Verbindliche Admin-Authentisierungs-, MFA-, Recovery- und Session-Policy fehlt. | Security-Policy für W1 dokumentiert und freigegeben. | in W0 als Entscheidung vorbereiten |
| `CP-BLK-003` | `open` | Kompatible Staging-Feistel-/HMAC-Testvektoren für reale Allocator-Tests fehlen. | getrennte Testsecret-Integration und Vektoren verfügbar. | W0 Testsecret-Konzept vorbereiten |
| `CP-BLK-004` | `open` | Druck-, Claim-, QA-, Nachdruck- und Übergabepolicy offen. | versionierte Betriebs-/Produktionspolicy. | vor W5/W6, keine Blockade für W0–W4 |
| `CP-BLK-005` | `partially-resolved` | Staging Edge Worker und KV sind bekannt; zulässiger minimaler Publisher-Token und isolierte Publishing-Grenze müssen dokumentiert werden. | Token-Scope, Namespace und Betriebsweg bestätigt. | `W0-WP-02` |
| `CP-BLK-006` | `open` | Staging-Origin der Public Read API, CORS-Allowlist, Rate Limit und Cache-Widerrufsbudget offen. | API- und Cache-Policy bestätigt. | `W0-WP-02` |
| `CP-BLK-007` | `open` | POI-Nachweis, Retention, Moderations-SLA und Produktlimits offen. | versionierte Policy. | vor W7, keine Blockade für W0–W6 |

---

## 5. Zulässige und gesperrte Aktionen

### Zulässig

- W0-Dokumentation, Contracts, Edge-Contracttests und lokale Testtopologie.
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
- [`README.md`](README.md) wurde erstellt und definiert Architekturgrenzen, Contract-first-Vorgehen, Wellen W0–W7, Story-Gates, Testtag-Regeln, Staging-Automatisierung und Statuspflege.

**Für den Wiederanlauf prüfen:**

1. Git-Arbeitsbaum und Branch gegen diesen Status abgleichen.
2. Diese Datei und [`README.md`](README.md) vollständig lesen.
3. Den Nachweis für `W0-WP-01` beginnen: verfügbare Dogado-Staging-Informationen und lokale Voraussetzungen erfassen.
4. Nach Abschluss eines W0-Arbeitspakets Tabelle, Blocker, Testbefehle/Evidenz und den nächsten zulässigen Schritt aktualisieren.

**Bisher ausgeführte Befehle in diesem Orchestrierungsstrang:** keine Code- oder Infrastrukturänderungen; ausschließlich Dokumentation erstellt.

**Evidenz:** Noch keine W0-Evidenz angelegt.
