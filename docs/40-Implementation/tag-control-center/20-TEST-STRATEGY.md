# Teststrategie: TAG Control Center

**Planungsstand:** 2026-10-06  
**Geltungsbereich:** zukünftige Control-Center-UI sowie ihre administrativen Contracts zur TAG Control Plane.  
**Nicht Gegenstand:** Fachlogik, Persistenz, Publisher, öffentliche Claim- und Read-APIs werden im [Control-Plane-Strang](../tag-control-plane/20-TEST-STRATEGY.md) getestet. Die kryptografische Scan-Auflösung des Edge Routers und das TAG-App-Rendering bleiben in ihren eigenen Implementierungssträngen.

## 1. Qualitätsziele

Die Teststrategie sichert insbesondere:

1. **Autorität:** Die UI ist keine Fachquelle; jede Mutation wird durch einen bestätigten Control-Plane-Contract entschieden.
2. **Sichere Bedienung:** Die UI kann keine doppelte Ausgabe, Owner-Zuordnung, Claim-Prüfung oder Policy-Umgehung durch Requests, Retries oder manipulierte Felder verursachen.
3. **Fail closed:** Ungültige Pools, Ranges, Claim-Strategien, Features, Status oder Projektionen werden klar und ohne interne Details abgewiesen.
4. **Least privilege:** Cloudflare-Schreibzugriff bleibt serverseitig, minimal berechtigt und umgebungsgetrennt.
5. **Datensparsamkeit:** Öffentliche API und KV geben keine privaten, personenbeziehbaren oder geheimen Daten aus.
6. **Nachvollziehbarkeit:** Kritische Veränderungen, Publish- und Unpublish-Vorgänge sind vollständig auditierbar.
7. **Betriebssicherheit:** Temporäre Cloudflare-Fehler führen nicht zu verlorenem oder widersprüchlichem Fachzustand.
8. **Kompatibilität:** Die erzeugte Routing-Projektion erfüllt verbindlich `DOMAIN_RULES.md` und funktioniert mit dem bestehenden Edge Router.

## 2. Testpyramide

| Ebene | Zweck | Beispiele | Ausführung |
| --- | --- | --- | --- |
| Unit | deterministische Fach- und Sicherheitslogik | Statusübergänge, Range-Prüfung, 8-stelliger Slot-Fortschritt, URL-/Feature-Schema | bei jedem Commit |
| Component / Service | Zusammenarbeit innerhalb der Anwendung | AuthZ-Policy, Audit-Service, Projektionsgenerator, Outbox-Planung | bei jedem Commit |
| Integration | Datenbank, Transaktionen, Queue und Cloudflare-API-Adapter | eindeutige Constraints, konkurrierende Vergabe, Publisher-Retry, Unpublish | CI mit isolierten Ressourcen |
| Contract | Grenzen zu Edge Router und TAG-App | KV-Dokumente, `PublicTagView`-Response, Fehler- und Cache-Vertrag | CI und vor Staging |
| UI / End-to-End | kritische Verwaltungsflüsse | Login, Entwurf, Review, Publish-Diff, Sperrung | CI bzw. kontrollierte Staging-Umgebung |
| Security / Abuse | negative und missbräuchliche Fälle | CSRF, Rechteeskalation, Injection, Datenleck, Rate Limit | vor jeder Freigabe |
| Staging / Betrieb | echte Plattformkette | Control Center → KV → Worker → TAG-App → Read-API | je Iteration/Gate |

## 3. Testebenen nach Iteration

### 3.1 CC-I01 – Fundament

- Authentisierungs- und Sessiontests einschließlich Cookie-/CSRF-Eigenschaften.
- Rollenmatrix-Tests für erlaubte und verbotene Aktionen.
- Migrationstests auf leerer und voriger Schema-Version; Test eines Backups/Restores nach dem finalen Betriebsverfahren.
- Audit-Tests: Kritische Mutation erzeugt genau ein nachvollziehbares Ereignis; keine Secrets in Auditdaten.
- Konfigurationstests: fehlende oder produktionsfremde Secrets/Umgebungswerte führen fail-closed zum Start- bzw. Operationsfehler.

### 3.2 CC-I02 – Pools, TAG-Vergabe, Claiming und Lebenszyklus

- UI-/Contract-Tests für kanonische Base36-Räume, 6-/8-stellige Werte, Pool-/Range-Grenzen und kapazitätsbezogene Rückmeldungen.
- Manipulations- und Retrytests: Die UI kann Control-Plane-Idempotenz, Poolbindung oder Owner-Grenzen nicht umgehen.
- Auswahltests für die zulässige Claim-Strategie: Einzelcredential, Bogen-/Chargencredential, Vorabzuweisung oder Self-Print nur entsprechend Pool-/Produktpolicy.
- Sichtbarkeitstests: Credential-Hashes und nach der Freigabe nicht mehr abrufbare Klartextwerte erscheinen nie in UI, Fehlern, Auditansicht oder Browser-Storage.
- Test für den vertraulichen Druck-/Self-Print-Export: erneute Berechtigung, Zweck/Umfang/Ablaufzeit, Audit-Referenz und keine unzulässige Browserpersistenz.
- Statusautomaten- und Contract-Tests für erlaubte und verbotene Übergänge.
- QR-/Drucktest: nur dokumentierte Hosts/Pfade und kanonisch kleingeschriebene TAG-IDs.

### 3.3 CC-I03 – Projektion und Publishing

- Schema- und Referenzintegritätstests für `tag-range-index`, Gruppen, Regeln und Feature-Dokumente.
- Negativtests für Überlappung, unsortierte Ranges, falsche 8-stellige Slotgrenzen, ungültige Identifier, unbekannte Featuretypen und unsichere URLs.
- Transaktionstest: Mutation, Audit und Outbox sind gemeinsam erfolgreich oder gemeinsam zurückgerollt.
- Publisher-Adaptertests gegen einen Fake-/Sandbox-Cloudflare-Client.
- Idempotenz- und Retrieszenarien bei Timeout, 429, 5xx und Prozessabbruch.
- Staging-Sandbox-Test mit ausschließlich dem bestätigten Staging-KV-Namespace; Produktion wird niemals durch automatisierte Tests beschrieben.

### 3.4 CC-I04 – Öffentliche Basis-Read-API

- Contract-Tests gegen den öffentlichen `PublicTagView`-Vertrag der TAG-App.
- Tests für veröffentlichte, nicht veröffentlichte, unbekannte, gesperrte und abgelaufene TAGs.
- Leak-Tests: Responses und KV-Projektionen enthalten keine Owner-, Audit-, Token-, Nachweis-, Produkt- oder privaten Inhaltsdaten.
- CORS-, HTTP-Methoden-, Rate-Limit- und Cache-Control-Tests.
- Browser-/Staging-Test der gesamten Kette: Scan → Edge Router → TAG-App → Read-API.

### 3.5 CC-I05 – Produkte, Organisationen und POI

- Policytests für Tier-/Laufzeit-/Modulgrenzen.
- Organisations- und TAG-spezifische Autorisierungstests.
- Tests auf Pflichtnachweise und Review-Gate vor POI-Aktivierung.
- Tests für Rollen-/Betreiberwechsel einschließlich Session-/Tokenwiderruf.
- Moderations- und Statuswechseltests: `review`, `suspended`, `expired` deaktivieren abhängige Module serverseitig.
- Datenschutztests für Meldungen und Nachweise.

## 4. Sicherheitsstrategie

### 4.1 Pflichtnegative Tests

Jede sicherheitsrelevante Funktion erhält mindestens einen Negativtest für:

- nicht authentisierten Zugriff;
- authentisierten Zugriff mit unzureichender Rolle;
- CSRF bei Cookie-Session;
- manipulierte Objekt-ID bzw. Mandanten-/Organisationsgrenze;
- ungültige Statusübergänge;
- unzulässige Pool-/Range-/Claim-Strategie-/Feature-/URL-Konfiguration;
- Versuch, Credential-Hash, Klartext-Credential, Claim-Fehlversuche oder Ownerdaten über UI, Browser-Storage oder Auditansicht auszulesen;
- direkte Cloudflare-Publish-Anfrage aus einem Browserkontext;
- API-Response mit nicht veröffentlichten Daten;
- fehlende oder abgelaufene Berechtigung;
- Cloudflare-Fehler während Publish und Unpublish.

### 4.2 Daten- und Secret-Prüfung

- Repository-, Build- und Testartefakte werden auf versehentlich eingecheckte Secrets geprüft.
- Testfixtures verwenden ausschließlich synthetische IDs, Hosts und Platzhalterwerte.
- Logs und Auditdaten werden auf Token, Passwörter, PINs, API-Keys und vollständige Genehmigungsnachweise geprüft.
- Staging- und Produktionskonfigurationen müssen in Tests getrennte Namespace-IDs und Tokens nachweisen; echte Werte werden nicht ausgegeben.

### 4.3 Manuelle Sicherheitsprüfungen vor Produktion

Vor produktiver Freigabe sind mindestens erforderlich:

1. Code-/Konfigurationsreview der Authentisierung, Rollen und Publisher-Tokenrechte.
2. Prüfung der TLS-, Session-, CSP- und Security-Header-Konfiguration.
3. Wiederherstellungs- und Incident-Prozess für Admin-Konten, gestohlene Tokens und fehlerhafte Projektionen.
4. Datenschutz-/Retention-Review für Owner-, POI-, Meldungs- und Auditdaten.
5. Kontrolliertes Staging-Publish, Unpublish und Rollback mit Evidence.

## 5. Staging- und Produktionsgates

| Gate | Voraussetzung | Mindestnachweis |
| --- | --- | --- |
| G1 – Fundament | CC-I01-Tests grün | AuthZ-/CSRF-/Audit-Tests und Migrationstest |
| G2 – Pools, Vergabe und Claim-UX | G1 erfüllt | Pool-/Policy-Contract, Vergabe, Claim-/Preassign-Auswahl, vertraulicher Export und UI-Leak-Tests |
| G3 – Publisher | G2 erfüllt, Staging-KV bestätigt | Projektion, Retry, Publish und Unpublish im isolierten Staging |
| G4 – Öffentliche Read-API | G3 erfüllt, TAG-App-Vertrag bestätigt | Contract-, Leak-, CORS- und Cache-Tests |
| G5 – E2E | G4 erfüllt | realer Staging-Scan mit positiver und negativer Evidenz |
| Production | G1–G5 erfüllt, Sicherheits-/Betriebsfreigabe | getrennte Produktionskonfiguration und dokumentierter Change |

Kein Produktions-Publish, keine physische Produktions-TAG-Ausgabe und keine Übernahme von Staging-Secrets erfolgen ohne erfüllte Gates.

## 6. Evidenz

Automatisierte Testergebnisse, Build-Ausgaben, Staging-Scans und kontrollierte Cloudflare-Publish-Nachweise werden gemäß der gemeinsamen Konvention unter [`../evidence/`](../evidence/README.md) abgelegt. Evidenz enthält keine Secrets, Sessiondaten, personenbezogenen Daten oder vollständigen Genehmigungsnachweise.
