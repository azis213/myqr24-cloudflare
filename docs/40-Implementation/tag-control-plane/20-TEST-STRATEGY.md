# Teststrategie: TAG Control Plane

**Planungsstand:** 2026-10-06  
**Geltungsbereich:** zukünftige PHP-/MySQL-Domänenlogik, Persistenz, interne Control-Plane-Schnittstellen, Druckexport, Publisher und öffentliche Basis-Read-API.  
**Nicht Gegenstand:** Die Admin-UI wird im TAG-Control-Center-Strang, Edge-Kryptografie im Edge-Router-Strang und PWA-Rendering im TAG-App-Strang getestet.

## 1. Qualitätsziele

1. **Autorität:** Fachentscheidungen stammen aus MySQL und serverseitiger Domänenlogik, nie aus Browser oder KV.
2. **Eindeutigkeit:** Keine doppelte TAG-ID, Claim-Zuordnung, Druckposition oder widersprüchliche Aktivierung bei Parallelität und Retry.
3. **Claim-Sicherheit:** Credentials sind je TAG sicher gehasht; Fehlversuche, Sperren und Drosselung verhindern massenhaftes Durchprobieren.
4. **Produktionsintegrität:** Druckdaten sind nach Freigabe reproduzierbar, prüfsummenbelegt und – abgesehen vom ausdrücklich erforderlichen Credential im vertraulichen Export – frei von Secrets.
5. **Fail closed:** Ungültige Pools/Ranges, Statuswechsel, Claims, Produktgates oder Projektionen werden nicht ausgeführt.
6. **Datenminimierung:** KV, Public Read API, Logs und reguläre Auditmetadaten enthalten keine privaten, produktionsbezogenen oder geheimen Daten.
7. **Betriebssicherheit:** Outbox, Claim- und Publisher-Prozesse verkraften Abbruch, Timeout, Rate Limit und Wiederholung.
8. **Nachvollziehbarkeit:** Audit verbindet Pool, TAG, Claim, Produktionslos, Druckposition, QA, Übergabe und Publish-Ergebnis.
9. **Umgebungstrennung:** Tests können nicht versehentlich Produktion, Produktions-KV oder Produktionssecrets verwenden.

## 2. Testpyramide

| Ebene | Zweck | Beispiele | Ausführung |
| --- | --- | --- | --- |
| Unit | deterministische Fachlogik | Range-Invarianten, Statusautomaten, Slotberechnung, Snapshot-Prüfsumme | bei jedem Commit |
| Service | Domänenservices und Policies | Allocator, Produktionslos, QA-Gate, Projektionsgenerator | bei jedem Commit |
| Integration | MySQL, Transaktionen, Locks, Outbox und Adapter | Parallelreservierung, Migrationslauf, Retry, Publish-Markierung | CI mit isolierter DB |
| Contract | Grenzen zu Edge Router, Control Center und TAG-App | KV-Schema, interne Commands, `PublicTagView` | CI vor Staging |
| Security | negative Zugriffs-, Leak- und Missbrauchsfälle | Rechteeskalation, Injection, Secret-Leak, CORS/CSRF | je Freigabe |
| Staging / Betrieb | reale Systemkette | Drucksnapshot, Staging-KV, Scan → PWA → Read API | je Iterationsgate |

### 2.1 Verbindliche lokale PHP-/MySQL-Ausführung

Die gemeinsame [lokale PHP-/MySQL-Testtopologie](../../../tools/local-php-mysql/README.md) ist für künftige PHP-Anwendungen verbindlich. Sie stellt MySQL 8.4 über ein internes Docker-Compose-Netz und PHP 8.4 CLI mit `pdo_mysql` bereit. Sie ist W0-Testinfrastruktur, keine Control-Plane-Implementierung.

- Unit-Tests haben keine Datenbank-, Netzwerk- oder Dateisystemabhängigkeit.
- Persistenz-, Constraint-, Migrations-, Parallelitäts-, Locking-, Outbox- und Rollback-Nachweise laufen gegen die lokale Compose-MySQL-Instanz. SQLite und In-Memory-Doubles sind dafür nicht ausreichend.
- Jeder Integrationstest nutzt ausschließlich synthetische Daten, eine klar getrennte Testdatenbank oder einen kontrollierten Schema-Reset und bereinigt seinen Zustand.
- Contract-, Publisher- und Fehlerpfadtests nutzen lokale Fixtures und Fake-Adapter; sie laden niemals Cloudflare-, Dogado-, Staging- oder Production-Secrets.
- Der lokale PDO-Selbsttest prüft vor einer Iteration mindestens Verbindung, `utf8mb4`, UTC, Commit und Rollback.
- Ein lokaler grüner Lauf belegt weder Dogado-Kompatibilität noch Staging- oder Produktionsreife; `verified` verlangt weiterhin die jeweiligen externen Nachweise.

## 3. Teststrategie je Iteration

### 3.1 CP-I01 – Fundament

- Migration auf leerer und vorheriger Datenbankversion; anschließender konsistenter Restore.
- Transaktionsrollback bei Fehler in einem Teil einer Fachmutation.
- Serverseitige Policy- und Objektgrenzen; Control Center kann Berechtigungen nicht durch manipulierte Request-Daten ausweiten.
- Audit-Sanitizing: Audit und Logs enthalten weder Tokens noch Klartext-Credentials.
- Fehlende Konfiguration oder Secret führt fail-closed zum Operationsfehler.

### 3.2 CP-I02 – Pools, Ranges, Vergabe und Lebenszyklus

- Randwerte der kanonischen 6-/8-stelligen Räume.
- Nichtüberlappung, Sortierung und vollständige 16er-Slots für achtstellige Ranges.
- Poolbindung, Kundensegment-/Organisationsgrenzen, Kapazitätswarnungen und Erschöpfung.
- Gleichzeitige Reservierungen in mehreren DB-Verbindungen.
- Idempotente Wiederholung nach Client- oder Prozessabbruch.
- Gültige und ungültige Statusübergänge, insbesondere Aktivierung ohne Produktionsfreigabe.

### 3.3 CP-I03 – Herstellung, Claiming und Druck

- Atomare Erstellung eines Produktionsloses samt konkreter reservierter Druckpositionen.
- Claim-Credentials mit individuellem Hash pro TAG bei Einzel- und Bogen-/Chargen-PIN.
- Öffentlicher Claim: atomare Credential-Prüfung, Owner-Zuordnung, Verbrauch und Parallelclaim-Schutz.
- Höchstversuche, progressive Sperre, Client-/IP-Drosselung und auditierter Support-Reset.
- Vorabzugewiesene Bestellungen und Self-Print-Serien ohne Einzelclaim.
- Snapshot-Determinismus: gleicher freigegebener Auftrag liefert denselben Export und dieselbe Prüfsumme.
- Exportprüfung auf kanonische URLs und Abwesenheit von Secrets, Owner- und Vaultdaten; Klartext-Credentials sind nur im vertraulichen freigegebenen Druck-/Self-Print-Export zulässig.
- Statussequenz von Druckauftrag und Position sowie Teilproduktion.
- QA-Proben, Ausschuss, Nachdruck, Ersatz-ID, Verlust-/Diebstahlsperre und Übergabegate.
- Kein ausgemusterter oder zerstörter TAG wird erneut frei vergeben.

### 3.4 CP-I04 – Projektion und Publisher

- Schema- und Referenzintegrität für `tag-range-index`, Gruppen, Regeln und Features.
- Negativtests für private Felder, fehlende Referenzen, unsichere URLs und ungültige Featuretypen.
- Atomarität von Fachmutation, Audit und Outbox.
- Fake-Cloudflare-Adapter für Timeout, 429, 5xx und Prozessabbruch.
- Idempotenter Retry; Veröffentlichung wird nur nach bestätigter API-Antwort markiert.
- Echter Test nur gegen isolierten bestätigten Staging-Namespace.

### 3.5 CP-I05 – Public Read API

- Contract-Tests für ausschließlich veröffentlichte `PublicTagView`-Felder.
- Neutrale Antworten für unbekannte, nicht veröffentlichte, gesperrte und abgelaufene TAGs.
- CORS-, Methoden-, Rate-Limit- und Cache-Control-Tests.
- Leak-Tests für Produktions-, Audit-, Owner-, Policy-, Nachweis- und Tokenfelder.
- Staging-End-to-End-Test über Edge Router, TAG-App und Read API.

### 3.6 CP-I06 – Produkt, Organisation und POI

- Produkt-/Laufzeit-/Modulpolicy bei Reservierung, Freigabe und Aktivierung.
- Organisations- und Betreibergrenzen.
- Pflichtnachweise und Review-Gate vor POI-Publish.
- Prüfungen, dass private POI-Nachweise niemals in KV oder Public API gelangen.
- `review`, `suspended` und `expired` deaktivieren abhängige Runtime-Module serverseitig.

## 4. Pflichtnegative Tests

Jede sicherheitsrelevante Funktion erhält mindestens einen Test für:

- unauthentisierten oder unzureichend berechtigten Aufruf;
- manipulierte Objekt-, Organisations- oder Status-ID;
- parallelen bzw. wiederholten Ausführungsversuch;
- fehlerhafte DB-Transaktion oder Prozessabbruch;
- ungültigen Pool, Range, Claim-Status, Featurekonfiguration, URL oder Druckvorlage;
- Claim mit falschem Credential, erschöpften Fehlversuchen, Lockout, Parallelität oder fremder Owner-Referenz;
- Freigabe/Aktivierung ohne QA oder Übergabe;
- Secret-/personenbezogenes Feld im regulären Export, KV-Dokument, API-Response, Audit oder Log;
- Cloudflare-Fehler bei Publish und Unpublish;
- Nutzung einer Staging-Konfiguration gegen Produktion.

## 5. Freigabegates

| Gate | Voraussetzung | Mindestnachweis |
| --- | --- | --- |
| CP-G1 – Fundament | CP-I01-Tests erfolgreich | Migration, Rollback, AuthZ-/Audit-/Secret-Prüfung |
| CP-G2 – Vergabe | CP-G1 erfüllt | Parallelitäts-, Slot-, Retry- und Lifecycle-Tests |
| CP-G3 – Claim und Druck | CP-G2 erfüllt | atomare Losbildung, Credential-Hashing, Parallelclaim, Lockout, Snapshot, QA, Ausschuss und Nachdruck |
| CP-G4 – Publishing | CP-G3 erfüllt, Staging-KV bestätigt | Projektion, Retry, Publish und Unpublish im isolierten Namespace |
| CP-G5 – Public API | CP-G4 erfüllt | Contract-, Leak-, CORS-, Cache- und Rate-Limit-Tests |
| CP-G6 – E2E | CP-G5 erfüllt | positiver und neutraler realer Staging-Scan |
| Produktion | CP-G1 bis CP-G6 erfüllt | getrennte Produktionskonfiguration, Betriebs- und Sicherheitsfreigabe |

Es darf weder eine Produktionsdruckfreigabe noch ein Produktions-Publish erfolgen, solange die vorausgehenden Gates nicht erfüllt sind.

## 6. Evidenz

Automatisierte Testergebnisse, redigierte Exportprüfungen, Staging-Publish-/Unpublish-Protokolle und Scan-Nachweise werden nach der gemeinsamen Konvention unter [`../evidence/`](../evidence/README.md) abgelegt. Sie enthalten weder Secrets, Sessiondaten, Klardaten von Personen noch vollständige Prüfungsnachweise.
