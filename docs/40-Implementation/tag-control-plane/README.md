# Implementierungsplan: myQR24 TAG Control Plane

## Zweck

Dieser Teilbereich plant die künftige **TAG Control Plane** als autoritatives, serverseitiges PHP-/MySQL-Backend auf dem Dogado-Hosting.

Die Control Plane implementiert die fachliche Wahrheit und die sicherheitskritischen Prozesse für Allocation Pools und TAG-Ranges, Vergabe, Claiming, Owner-Vorabzuweisung, persistente JSON-Exportaufträge, Lebenszyklus, Routing-Publishing und öffentliche Basisdaten. Sie stellt dafür interne Verwaltungs-APIs bzw. serverseitige Anwendungsdienste für das [TAG Control Center](../tag-control-center/README.md) sowie eine strikt beschränkte öffentliche Claim-Schnittstelle für die TAG-App bereit. PDF-/Label-Aufbereitung, Druckeransteuerung und physische Herstellung liegen ausdrücklich außerhalb der Control Plane.

Dieses Verzeichnis enthält zunächst ausschließlich Planungs-, Qualitäts- und Rückverfolgbarkeitsartefakte. Es erzeugt weder Anwendungscode noch Datenbankmigrationen, Cloudflare-Konfigurationen oder produktive Daten.

```text
Fach- und Architekturregel
→ Control-Plane-User-Story
→ Akzeptanzkriterium
→ Control-Plane-Testfall
→ sichere Testdaten / Contract-Fixture
→ spätere Domänen-, Persistenz-, API- oder Publisher-Implementierung
→ automatisierter Test, Staging- und Betriebsnachweis
```

## Abgrenzung: Control Plane und Control Center

| Komponente | Verantwortung | Nicht verantwortlich für |
| --- | --- | --- |
| **TAG Control Plane** | PHP-/MySQL-Domänenlogik, DB-Transaktionen, AuthZ-Durchsetzung, Pool-/Range- und TAG-Vergabe, Claim-Prüfung, Owner-Zuordnung, persistente JSON-Exportaufträge und unveränderliche Snapshots, Qualitäts-/Übergabereferenzen, Audit, Outbox, Publisher, öffentliche Read-API | Benutzeroberfläche, browserseitige Sicherheitsentscheidung, öffentliche Edge-Auflösung sowie PDF-/Label-Aufbereitung, Druckeransteuerung und physische Herstellung |
| **TAG Control Center** | administrative UI, Formulare, Listen, Vorschau, Pool-/Chargen-/Claim-Konfiguration und Bedienung der freigegebenen Control-Plane-Funktionen | fachliche Autorität, direkte DB-Zugriffe, Claim-Prüfung, Cloudflare-Tokens, Umgehung von AuthZ oder Workflow-Guards |
| **Cloudflare KV** | minimale, abgeleitete und nicht geheime Routing-Projektion | Stammdaten, Produktionsdaten, Owner-/POI-Daten, Audit, Vault-Inhalte, Secrets |
| **Edge Router** | Scan-URL- und TAG-Kryptografievalidierung sowie Auflösung der KV-Projektion | Range-Verwaltung, Vergabe, Herstellung, Druck, Admin-Workflows |
| **TAG-App / spätere Runtime-API** | öffentliche Darstellung und Laufzeit-Features | Verwaltungsautorität, Produktionsprozesse, KV-Publishing |

Das Control Center kann eine Action anbieten, etwa „JSON-Exportauftrag freigeben“ oder „nach Staging publizieren“. Die Control Plane entscheidet jedoch serverseitig, ob diese Aktion zulässig ist, erzeugt die atomaren Datenänderungen und schreibt Audit- sowie Outbox-Ereignisse.

## Verantwortungsmodell der Control Plane

```text
Control Center (Admin-Browser)
          │ authentisierte Anfrage
          ▼
Control-Plane API / Application Service
          │ AuthZ + Workflow + DB-Transaktion
          ├── MySQL: Stammdaten, Pool-/Claim-/Exportauftragsdaten, Audit, Outbox
          ├── JSON-Export: unveränderlicher, vertraulicher Snapshot mit `exportOrderId`
          ├── Publisher: minimaler Cloudflare-KV-Diff
          ├── Public Read API: ausschließlich veröffentlichte Basisdaten
          └── Public Claim API: PIN-/Passwortprüfung und atomare Owner-Zuordnung
```

## Maßgebliche Architekturregeln

1. **MySQL ist autoritativ.** Jede fachliche Information wird dort verwaltet; Cloudflare KV ist niemals Quelle für fachliche Entscheidungen.
2. **Serverseitige Durchsetzung.** Rollen, Produktpolicies, Statusautomaten, Range-Prüfungen und Freigabegates werden ausschließlich in der Control Plane geprüft.
3. **Atomare TAG-Vergabe.** Öffentliche `tagId` und `(length, decodedValue)` besitzen eindeutige Constraints. Sechs- und achtstellige TAGs werden unter DB-Sperren bzw. gleichwertiger Transaktionssicherheit reserviert.
4. **Allocation Pools vor Vergabe.** Pools reservieren gültige `decodedValue`-Ranges für Zielgruppe, Produkt-/Claim-Policy und optional Organisation. Sie werden im kanonischen Raum verwaltet, nicht anhand sichtbar fortlaufender Feistel-`tagId`-Strings.
5. **Kontrollierter Export vor Aktivierung.** Physische TAGs werden für einen persistenten JSON-Exportauftrag einer konkreten logischen `decodedValue`-Range einmalig zugeordnet. Externe QA-, Übergabe-, Ausschuss- und Nachdruckprozesse referenzieren diesen Auftrag; sie vergeben keine TAGs stillschweigend neu.
6. **Claiming ist serverseitig.** Für jeden nicht organisationsgebunden freigeschalteten claimbaren TAG speichert die Plane eine Claim-Policy, einen individuellen gesalzenen Credential-Prüfhash, einen TAG-bezogen verschlüsselten auszugebenden PIN-Wert, Fehlversuche, Sperrung und Besitzstatus. Auch bei gleichem Bogen-/Chargen-PIN besitzt jeder TAG einen eigenen Claimdatensatz.
7. **Unveränderliche vertrauliche JSON-Snapshots.** Nach Freigabe bleibt die Zuordnung von `exportOrderId`, TAG-ID, Scan-URL, QR-Payload, Version und auszugebender Claim-PIN versioniert und prüfsummenbelegt. Der autorisierte Wiederdownload liefert denselben Snapshot; PIN-Werte werden dafür ausschließlich innerhalb des Exportprozesses entschlüsselt und fehlen bei organisationsgebunden vorab zugewiesenen oder freigeschalteten TAGs.
8. **Outbox vor Publisher.** Fachmutation, Audit und Publish-/Unpublish-Auftrag entstehen innerhalb derselben DB-Transaktion. Der Publisher markiert Erfolg erst nach bestätigter Cloudflare-Antwort.
9. **Keine Secrets außerhalb des Servers.** Feistel-/HMAC-Secrets, Cloudflare-Tokens und Claim-Credential-Hashes bleiben im umgebungsgetrennten Secret Store bzw. der autoritativen DB; sie erscheinen nie in KV, öffentlichen APIs, Logs oder Fixtures.
10. **Minimale Datenveröffentlichung.** KV enthält nur erlaubte Ranges, Gruppen, Regelzuweisungen und Feature-Dokumente. Die öffentliche Read-API liefert nur explizit veröffentlichte Felder.
11. **Staging getrennt von Produktion.** Datenbanken, Token, KV-Namespaces, Hosts, JSON-Exportversionen und Freigabegates sind je Umgebung getrennt.
12. **Auditierbarkeit.** Kritische Fach-, Pool-, Claim-, Exportauftrags-, Download/Wiederausgabe-, Qualitäts- und Publish-Ereignisse sind unveränderbar nachvollziehbar.

## Dokumente

| Dokument | Inhalt |
| --- | --- |
| [STATUS.md](STATUS.md) | Iterationen, Arbeitspakete, Abhängigkeiten, Blocker und Ausgangsstatus |
| [10-USER-STORIES.md](10-USER-STORIES.md) | Backend- und Domänenstories mit Akzeptanzkriterien |
| [20-TEST-STRATEGY.md](20-TEST-STRATEGY.md) | Testpyramide, Sicherheits-, JSON-Export- und Publishing-Gates |
| [21-TEST-CASES.md](21-TEST-CASES.md) | konkrete, zukünftige Control-Plane-Testfälle |
| [22-TEST-DATA.md](22-TEST-DATA.md) | Fixture-Klassen, Testvektoren und Secret-Grenzen |
| [30-TRACEABILITY.md](30-TRACEABILITY.md) | Story → Arbeitspaket → Test → Testdaten → Evidenz |

## ID-System

| Artefakt | Präfix | Beispiel |
| --- | --- | --- |
| User Story | `CP-US-` | `CP-US-010` |
| Arbeitspaket | `CP-WP-` | `CP-WP-03` |
| Testfall | `CP-TC-` | `CP-TC-ALLOC-001` |
| Testdaten | `CP-TD-` | `CP-TD-001` |
| Iteration | `CP-I` | `CP-I01` |
| Blocker | `CP-BLK-` | `CP-BLK-001` |

`CP-*`-IDs sind vom bestehenden Edge-Router-Strang (`US-*`, `TC-*`), der TAG-App (`APP-*`) und dem Control-Center (`CC-*`) getrennt und werden nie wiederverwendet.

## Statusmodell

| Status | Bedeutung |
| --- | --- |
| `planned` | fachlich präzisiert, nicht implementiert |
| `in-progress` | aktive Umsetzung |
| `implemented` | Code und zugehörige Tests existieren; vollständige Verifikation fehlt |
| `verified` | Tests, Sicherheitsprüfung und erforderliche Staging-/Betriebsevidenz erfolgreich |
| `blocked` | externe oder fachliche Abhängigkeit verhindert Umsetzung |
| `deferred` | bewusst späterer Ausbau |

## Maßgebliche Spezifikationen

- [TAG Control Plane und Basis-Vault](../../10-Architecture/PWA-PHP-Applications/TAG_CONTROL_PLANE_AND_BASIS_VAULT.md)
- [Domain-, TAG- und Routing-Regeln](../../DOMAIN_RULES.md)
- [TAG-Typen und POI-/Community-Funktionen](../../20-Special-Specifications/TAG_TYPES_AND_POI_FEATURES.md)
- [TAG Vault Feature](../../20-Special-Specifications/TAG_VAULT_FEATURE.md)
- [TAG-App-Architektur](../../10-Architecture/TAG_APP_ARCHITECTURE.md)
- [Edge-Router-Implementierungsnachweis](../edge-router/README.md)
- [TAG-Control-Center-Implementierungsplan](../tag-control-center/README.md)
