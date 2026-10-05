# Testfälle: TAG-App

**Teststrategie:** [`20-TEST-STRATEGY.md`](20-TEST-STRATEGY.md)  
**Stories:** [`10-USER-STORIES.md`](10-USER-STORIES.md)  
**Testdaten:** [`22-TEST-DATA.md`](22-TEST-DATA.md)

## Aktuelle APP-I01-Testfälle

| ID | Story | Ebene | Testfall | Erwartetes Ergebnis | Status |
| --- | --- | --- | --- | --- | --- |
| APP-TC-ADAPTER-001 | APP-US-003, APP-US-010 | Unit | veröffentlichte Fixture-ID laden | kanonischer `PublicTagView` wird geliefert | implemented |
| APP-TC-ADAPTER-002 | APP-US-004 | Unit | syntaktisch ungültige ID laden | `UnknownPublicTagError`, keine Ersatzansicht | implemented |
| APP-TC-ADAPTER-003 | APP-US-004 | Unit | unbekannte, formal gültige ID laden | `UnknownPublicTagError`, keine Detaildaten | implemented |
| APP-TC-ROUTE-001 | APP-US-001 | Build/Browser | Route `/tag/stagv001` aufrufen | `TagPage` verarbeitet den achtstelligen Routenparameter | implemented |
| APP-TC-ROUTE-002 | APP-US-002 | Pages/Browser | direkten Staging-Aufruf `/tag/stagv001` durchführen | Pages liefert App-Shell, anschließend öffentliche Ansicht | implemented |
| APP-TC-ROUTE-003 | APP-US-002 | Component | unbekannte Client-Route aufrufen | kontrollierte Weiterleitung auf `/` | implemented |
| APP-TC-VAULT-001 | APP-US-010 | Component | veröffentlichte View rendern | Tag-Kontext, Blöcke und öffentliche Feature-Hinweise sind sichtbar | planned |
| APP-TC-VAULT-002 | APP-US-011 | Static/Component | Renderer und Quellcode gegen ungeprüftes HTML prüfen | kein `dangerouslySetInnerHTML`; nur typisierte Blockzweige | implemented |
| APP-TC-VAULT-003 | APP-US-013 | Component | externen Link rendern | neuer Kontext mit `rel="noreferrer"` | planned |
| APP-TC-PWA-001 | APP-US-005 | Static/Build | Produktions-Bootstrap prüfen | Service Worker wird nur bei `import.meta.env.PROD` registriert | implemented |
| APP-TC-PWA-002 | APP-US-005 | Static | Service-Worker-Requestregeln prüfen | nur same-origin `GET`, keine `/api/`-Cachebehandlung | implemented |
| APP-TC-PWA-003 | APP-US-005 | Browser | Manifest, Icon und Service Worker auf Staging prüfen | installierbare öffentliche Shell; keine dynamischen Tag-Daten im Cache | planned |

`implemented` bedeutet hier: Testfall und/oder überprüfbarer Nachweis sind vorhanden. Für den Status `verified` der zugehörigen Story sind die gemäß Teststrategie geforderten automatisierten und Staging-Nachweise erforderlich.

## Router→PWA-Integration

| ID | Story | Ebene | Testfall | Erwartetes Ergebnis | Status |
| --- | --- | --- | --- | --- | --- |
| APP-TC-INTEGRATION-001 | APP-US-006 | Staging E2E | HMAC-validen, gesäten Staging-Scan unter `/t/{tagId}` ausführen | `302` auf `/tag/stagv001`; TAG-App rendert die öffentliche Fixture | blocked |
| APP-TC-INTEGRATION-002 | APP-US-006 | Staging E2E | route-lose, ungültige und nicht erlaubte Routenpfade am Scan-Host aufrufen | Router liefert `404`; keine App-Ansicht | blocked |
| APP-TC-INTEGRATION-003 | APP-US-006 | Configuration | aktiven Worker und KV-Namespace vor Redirect-Wechsel abgleichen | Änderung betrifft ausschließlich identifizierte Staging-Ressource | blocked |

## Geplante Permission- und Capability-Testfälle: APP-I02A und APP-I03

| ID | Stories | Ebene | Testfall | Erwartetes Ergebnis | Status |
| --- | --- | --- | --- | --- | --- |
| APP-TC-PERMISSION-001 | APP-US-060 | Component/Browser | Hauptnavigation und TAG-Kontext aus Scan aufrufen | öffentliche TAG-Route bleibt ohne Session erreichbar; Zurück-Navigation erhält Scan-/Vorher-Kontext | planned |
| APP-TC-PERMISSION-002 | APP-US-061, APP-US-062 | Unit/Component | App-Start und öffentliche TAG-Route mit Spy auf Kamera-, Standort-, Mikrofon- und Push-APIs rendern | keine Berechtigungs-API wird ohne bewusste Nutzeraktion aufgerufen | planned |
| APP-TC-PERMISSION-003 | APP-US-061, APP-US-062 | Browser/Component | Scan bewusst starten und Kamera ablehnen oder Scanner nicht unterstützen | Kamera wird erst nach Start angefragt; manueller TAG-ID-/URL-Fallback bleibt nutzbar; keine erneute Anfrage im selben Ablauf | planned |
| APP-TC-PERMISSION-004 | APP-US-062, APP-US-063 | Component | Standortpräferenz aktivieren, widerrufen und blockierten Systemstatus anzeigen | Ebenen werden getrennt dargestellt; Widerruf verhindert neue Erfassung und zeigt funktionsbezogenen Fallback | planned |
| APP-TC-PERMISSION-005 | APP-US-064 | Contract/Component | anonyme, angemeldete und Owner-Capability-Responses rendern | nur API-gelieferte Kontextaktionen erscheinen; öffentliche Inhalte bleiben vorrangig sichtbar | planned |
| APP-TC-PERMISSION-006 | APP-US-064 | Security/API | geschützte Aktion mit manipuliertem Button, lokaler Capability oder abgelaufener Response senden | API lehnt Request trotz Client-Zustand erneut autoritativ ab | planned |
| APP-TC-PERMISSION-007 | APP-US-063 bis APP-US-065 | Cache/Privacy | Präferenz-, Einwilligungs-, Scan- und Capability-Antworten sowie Service Worker prüfen | persönliche Antworten verwenden `no-store`; Service Worker persistiert keine privaten Daten | planned |

## Geplante API-/Vault-Testfälle: APP-I03 und APP-I04

| ID | Stories | Ebene | Testfall | Erwartetes Ergebnis | Status |
| --- | --- | --- | --- | --- | --- |
| APP-TC-API-001 | APP-US-003, APP-US-014 | Contract | öffentlichen View einer veröffentlichten TAG-ID laden | Response erfüllt `PublicTagView`; nur öffentliche Felder | planned |
| APP-TC-API-002 | APP-US-004, APP-US-014 | Security | unbekanntes, nicht veröffentlichtes und widerrufenes TAG laden | neutrale öffentliche Nichtverfügbarkeit; keine Details | planned |
| APP-TC-API-003 | APP-US-015 | Header/Integration | View vor und nach Widerruf abrufen | dokumentierte Cache-Header; widerrufener View nicht mehr abrufbar | planned |
| APP-TC-API-004 | APP-US-012, APP-US-014 | Security | private Medienreferenz über öffentliche URL aufrufen | Zugriff verweigert; kein öffentlicher Asset-Leak | planned |
| APP-TC-OWNER-001 | APP-US-020 | Security | Owner-Aktion ohne/mit ungültiger Session ausführen | serverseitig abgewiesen; keine Bearbeitung | planned |
| APP-TC-OWNER-002 | APP-US-020 | Security | schreibenden Cookie-Request ohne CSRF-Nachweis ausführen | Request wird abgewiesen | planned |
| APP-TC-OWNER-003 | APP-US-021, APP-US-022 | API/E2E | validen und ungültigen Vault-Block speichern | nur schema-konformer Block wird gespeichert und sichtbar geschaltet | planned |
| APP-TC-OWNER-004 | APP-US-023 | Integration | Datei mit falscher Signatur/MIME hochladen | Upload wird quarantänisiert oder abgelehnt | planned |
| APP-TC-OWNER-005 | APP-US-024, APP-US-025 | Security | private Freigabe widerrufen oder Einmalzugriff parallel aufrufen | Zugriff endet; atomare Einmalnutzung und Audit sind nachweisbar | planned |
| APP-TC-ACCESS-001 | APP-US-026 | API/Security | Owner- und Gastcode mit gültigem, falschem und formatwidrigem Wert absenden | nur valide serverseitige Prüfung erzeugt die passende rollenbezogene Session; Fehler bleiben neutral | planned |
| APP-TC-ACCESS-002 | APP-US-026 | Security/Header | erfolgreiche Owner- und Gastanmeldung prüfen | Cookie ist `HttpOnly`, `Secure`, `SameSite=Strict`, kurzlebig und enthält keinen Rollen- oder Code-Klartext | planned |
| APP-TC-ACCESS-003 | APP-US-026 | Authorization | Gast versucht Owner-Endpunkte, private Inhalte, Sichtbarkeits-/Freigabe-/Sessionverwaltung und fremden Gastbeitrag | alle nicht erlaubten Aktionen werden serverseitig abgewiesen; keine Detaildaten | planned |
| APP-TC-ACCESS-004 | APP-US-026 | Authorization/E2E | zwei Gast-Sessions erstellen; jede legt einen Beitrag an und versucht den Beitrag der anderen zu ändern oder zu löschen | nur die erzeugende gültige Gast-Session darf ihren eigenen Beitrag bearbeiten oder soft löschen | planned |
| APP-TC-ACCESS-005 | APP-US-026 | Security/Privacy | öffentliche View, PWA-Bundle, Logs und Evidenz des Staging-Flows prüfen | keine Zugangscodes, Hashes, Tokens, privaten Metadaten oder Session-Rohwerte enthalten | planned |

## Geplante TAG-Feature-Testfälle: APP-I05 bis APP-I07

| ID | Stories | Ebene | Testfall | Erwartetes Ergebnis | Status |
| --- | --- | --- | --- | --- | --- |
| APP-TC-CHAT-001 | APP-US-030, APP-US-033 | API/Security | Finder-Nachricht für verlorenes, nicht verlorenes und geschlossenes TAG absenden | nur offener, verlorener und aktivierter Fall akzeptiert | planned |
| APP-TC-CHAT-002 | APP-US-031, APP-US-035 | Security/Cache | Thread-/Nachrichtenresponse prüfen | Session- und Rate-Limit-Prüfung; `no-store`; kein SW-Cache | planned |
| APP-TC-CHAT-003 | APP-US-032, APP-US-034 | E2E | Owner-Thread moderieren bzw. schließen | nur berechtigte Owner-Aktion; Audit; nicht mehr sichtbarer Inhalt | planned |
| APP-TC-GUESTBOOK-001 | APP-US-040, APP-US-041, APP-US-044 | API/Time | Einreichung vor, während und nach Zeitfenster | nur innerhalb des autoritativen Serverfensters möglich | planned |
| APP-TC-GUESTBOOK-002 | APP-US-042, APP-US-043 | E2E/Security | pending, rejected, deleted und published Beitrag anzeigen | öffentlicher View enthält ausschließlich published | planned |
| APP-TC-CHECKIN-001 | APP-US-050, APP-US-056 | Browser/Privacy | Standortfreigabe verweigern bzw. erteilen | keine stille Ortung; keine Rohkoordinaten in öffentlichen Responses | planned |
| APP-TC-CHECKIN-002 | APP-US-051 | API | GeoFence-Grenzfälle übermitteln | serverseitige Entscheidung für innerhalb, außerhalb, ungenau, zeitlich ungültig | planned |
| APP-TC-CHECKIN-003 | APP-US-052 | Sync | Offline-Ereignis doppelt, zu alt oder später synchronisieren | idempotent; nachvollziehbarer Status; erneute Serverprüfung | planned |
| APP-TC-CHECKIN-004 | APP-US-053 | Authorization | Collection einer anderen Besucher-Session abrufen | Zugriff verweigert; eigene Projektion `no-store` | planned |
| APP-TC-CHECKIN-005 | APP-US-054, APP-US-055 | Concurrency | gleichen gültigen Check-in parallel für Campaign bewerten | höchstens ein Credit/Reward; Audit und Deduplizierung vorhanden | planned |

## Ausführungszuordnung

| Bereich | Primärer Nachweis |
| --- | --- |
| aktueller Adapter | `apps/tag-app/src/services/publicTagViewService.test.ts` |
| App-Build | `npm run build` beziehungsweise gezielter TAG-App-Build |
| Router→PWA | Staging-Nachweis nach Lösung von APP-BLK-001 |
| spätere API-Features | API-, Contract-, Security- und E2E-Tests je Iteration |
