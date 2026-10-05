# Implementierungsstatus: TAG-App

**Letzte Bewertung:** 2026-10-02  
**Statusregeln:** [`README.md`](README.md)  
**Fachliche Stories:** [`10-USER-STORIES.md`](10-USER-STORIES.md)

## Arbeitspakete

| ID | Arbeitspaket | Iteration | Status | Abhängigkeit / erwartete Evidenz |
| --- | --- | --- | --- | --- |
| APP-WP-01 | TAG-App-Implementierungsnachweis und Rückverfolgbarkeit | APP-I01 | implemented | Dokumente in `docs/40-Implementation/tag-app/` |
| APP-WP-02 | Öffentliche Routen, Pages-Deep-Link und Staging-PWA | APP-I01 | implemented | APP-TC-ROUTE-001 bis APP-TC-ROUTE-003, Pages-Aufruf |
| APP-WP-03 | Öffentlicher Fixture-Adapter und fail-closed Fehlerzustand | APP-I01 | implemented | APP-TC-ADAPTER-001 bis APP-TC-ADAPTER-003 |
| APP-WP-04 | Typisierte öffentliche Vault-Darstellung | APP-I01 | implemented | APP-TC-VAULT-001 bis APP-TC-VAULT-003 |
| APP-WP-05 | Öffentliche PWA-App-Shell und Cache-Grenzen | APP-I01 | implemented | APP-TC-PWA-001 bis APP-TC-PWA-003 |
| APP-WP-05A | Hochzeits-Vault-Demo: Tabs, Galerie, Dokumente und Zugangscode-UX | APP-I01A | implemented | `trauung1`, `fest2026`, `menue202`, Adaptertests und App-Build |
| APP-WP-06 | Kontrollierte Router→PWA-Staging-Integration | APP-I02 | blocked | aktiver Worker und tatsächlich gebundener KV-Namespace |
| APP-WP-06A | Gemeinsame PWA-Navigation, integrierter Scan und lokale Berechtigungspräferenzen | APP-I02A | planned | APP-TC-PERMISSION-001 bis APP-TC-PERMISSION-004, keine fachliche Autorisierung im Client |
| APP-WP-07 | Öffentliche Application API, D1/R2 und Sichtbarkeiten | APP-I03 | planned | APP-TC-API-*, APP-TC-PERMISSION-005 bis APP-TC-PERMISSION-007, getrennte Staging-Ressourcen |
| APP-WP-08 | Owner-Authentisierung, Vault-Verwaltung und Audit | APP-I04 | planned | APP-TC-OWNER-*, API und Session-Modell |
| APP-WP-09 | Lost & Found, TAG Chat und Moderation | APP-I05 | planned | APP-TC-CHAT-*, Besucher-/Owner-Sessions |
| APP-WP-10 | TAG Guestbook und Medienpipeline | APP-I06 | planned | APP-TC-GUESTBOOK-*, Upload-/Queue-Fluss |
| APP-WP-11 | Check-ins, Collections, Campaigns und Datenschutz | APP-I07 | planned | APP-TC-CHECKIN-*, GeoFence- und Credit-Policy |

## Aktueller Staging-MVP

| Bereich | Implementierter Stand | Bewusste Grenze |
| --- | --- | --- |
| Öffentliche Route | React Router stellt `/tag/:tagId` dar | keine Router- oder Berechtigungsentscheidung im Client |
| Pages-Deep-Link | `_redirects` liefert `/tag/*` als App-Shell aus | weitere öffentliche Routen müssen bewusst ergänzt werden |
| Datenzugriff | `getPublicTagView` normalisiert und löst lokale Fixture-Daten | keine Application API, D1 oder R2 |
| Fehlerdarstellung | ungültige oder unbekannte IDs liefern eine neutrale Nicht-verfügbar-Ansicht | nicht gleichbedeutend mit serverseitiger Sichtbarkeitsprüfung |
| Vault | typisierte öffentliche Blöcke: Hero, Text, Callout, Galerie, Dokumente und externer Link; Hochzeits-Fixtures mit Tabs und Einzelbild-Öffnung | nur nicht sensible Staging-Daten; keine private Sichtbarkeitsentscheidung im Client |
| Hochzeits-Demo | `trauung1` mit Galerie, Speisekarte, Einladung, angekündigtem Dankeschön und lokaler Zugangscode-/Upload-UX; `fest2026` ohne Gastuploads; `menue202` als Dokumentvariante | Zugangscode wird nicht geprüft, Uploads leben nur im Browser, Download- und Löschrechte sind nicht serverseitig autorisiert |
| PWA | Manifest, Icon, Produktions-Service-Worker und minimaler Shell-Cache | keine Offline-Tag-Daten oder privaten Cache-Inhalte |
| Staging-Pages | `main.myqr24-staging-test-pwa.pages.dev` ist deployt | aktive Scan-Route zeigt noch auf frühere Test-PWA |
| API / Owner / weitere Features | nicht vorhanden | als `planned` geführt |

## Story-Status

| Story | Kurzbezeichnung | Iteration | Status |
| --- | --- | --- | --- |
| APP-US-001 | Öffentliche TAG-Zielroute öffnen | APP-I01 | implemented |
| APP-US-002 | Direkte TAG-Deep-Links auf Pages öffnen | APP-I01 | implemented |
| APP-US-003 | Öffentliche Tag-View-Daten über Adapter laden | APP-I01 | implemented |
| APP-US-004 | Nicht verfügbare öffentliche TAGs fail-closed darstellen | APP-I01 | implemented |
| APP-US-005 | Öffentliche PWA-App-Shell installieren und offline starten | APP-I01 | implemented |
| APP-US-006 | Router→PWA-Staging-Übergang prüfen | APP-I02 | blocked |
| APP-US-010 | Öffentlichen Vault-Inhalt ansehen | APP-I01 | implemented |
| APP-US-011 | Typisierte öffentliche Vault-Blöcke sicher rendern | APP-I01 | implemented |
| APP-US-012 | Öffentliche Galerie und Medien zugänglich anzeigen | APP-I03 | planned |
| APP-US-013 | Freigegebene externe Links sicher öffnen | APP-I01 | implemented |
| APP-US-014 | Öffentliche Sichtbarkeit serverseitig durchsetzen | APP-I03 | planned |
| APP-US-015 | Öffentliche Inhalte cache-sicher widerrufen | APP-I03 | planned |
| APP-US-016 | Hochzeits-Vault als öffentliche Galerie und Dokumentansicht darstellen | APP-I01A | implemented |
| APP-US-017 | Zugangscode- und Upload-UX als explizit nicht persistente Staging-Demo darstellen | APP-I01A | implemented |
| APP-US-018 | Gast- und Owner-Sessions für Upload, eigene Löschung und autorisierte Downloads durchsetzen | APP-I03 | planned |
| APP-US-020 bis APP-US-025 | Owner- und Inhaltsverwaltung | APP-I04 | planned |
| APP-US-030 bis APP-US-035 | TAG Chat und Lost & Found | APP-I05 | planned |
| APP-US-040 bis APP-US-044 | TAG Guestbook | APP-I06 | planned |
| APP-US-050 bis APP-US-056 | Check-ins, Collections und Campaigns | APP-I07 | planned |
| APP-US-060 bis APP-US-063 | gemeinsame Navigation, integrierter Scan und Berechtigungszentrum | APP-I02A | planned |
| APP-US-064 bis APP-US-065 | serverseitige Capabilities und datensparsame Scan-Speicherung | APP-I03 | planned |

## Blocker

| ID | Betroffener Bereich | Beschreibung | Auflösungskriterium |
| --- | --- | --- | --- |
| APP-BLK-001 | APP-US-006 / APP-WP-06 | Der in lokaler Staging-Konfiguration gebundene KV-Namespace ist leer, während die aktive Scan-Route einen Redirect der früheren Teststrecke ausliefert. | Aktiven Cloudflare Worker und dessen tatsächlich gebundenen Namespace im Dashboard identifizieren; Redirect anschließend kontrolliert auf den neuen Pages-Alias umstellen. |
| APP-BLK-002 | APP-I03 bis APP-I07 | Es existiert noch keine autoritative Application API mit getrennten Staging-Datenressourcen. Die Hochzeits-PIN- und Upload-Oberfläche ist deshalb ausschließlich eine lokale UX-Demo. | API-Architektur, Staging-D1/R2, Authentisierung und Schema-Verträge implementieren; Gastbeiträge an serverseitige Session-IDs binden sowie Downloads und Löschungen pro Request autorisieren. |
| APP-BLK-003 | APP-US-061 | Kamera- und QR-Scan-API-Verfügbarkeit ist Browser- und Geräteabhängig; eine PWA kann externe NFC-/QR-Links nicht plattformübergreifend garantiert direkt übernehmen. | Scanner mit manueller Eingabe als Fallback implementieren; App Links/Universal Links nur bei späterer nativer Hülle bewerten. |

## Aktualisierungsregel

Nach jeder Iteration:

1. werden Stories und Arbeitspakete mindestens auf `implemented` gesetzt, wenn Code und Testfälle vorhanden sind;
2. ergänzt `30-TRACEABILITY.md` Code-, Testdaten- und Evidenzreferenzen;
3. wird auf `verified` erhöht, wenn die zugehörigen automatisierten Tests, der App-Build und gegebenenfalls die Staging-Abnahme erfolgreich sind;
4. bleiben externe Abhängigkeiten als `blocked` sichtbar, statt sie durch lokale Fixtures zu verdecken.

`verified` für API-, Owner- oder private Feature-Stories setzt zusätzlich serverseitige Autorisierungs- und Cache-Tests voraus.
