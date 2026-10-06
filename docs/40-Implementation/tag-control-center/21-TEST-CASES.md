# Testfälle: TAG Control Center

**Planungsstand:** 2026-10-06  
**Status:** Alle Testfälle sind geplant. Sie werden erst mit der jeweiligen Implementierung automatisiert oder als kontrollierter Staging-Test ausgeführt.

## CC-I01 – Fundament, Authentisierung und Audit

| ID | Bezug | Testfall | Erwartetes Ergebnis | Ebene |
| --- | --- | --- | --- | --- |
| `CC-TC-AUTH-001` | CC-US-001 | Berechtigte Anmeldung und Logout | Sitzung entsteht und wird beim Logout serverseitig widerrufen bzw. ungültig | Integration |
| `CC-TC-AUTH-002` | CC-US-001 | Nicht vorhandenes Konto, falsches Secret und gesperrter Zugang | Neutrale Fehlerantwort ohne Kontoexistenz- oder Detailleck | Security |
| `CC-TC-AUTH-003` | CC-US-001 | Cookie-/CSRF-Eigenschaften | Session-Cookie ist sicher konfiguriert; fehlendes/ungültiges CSRF verhindert Mutation | Integration |
| `CC-TC-AUTH-004` | CC-US-001 | MFA-/starke Authentisierung für Plattformadministrator | privilegierte Aktion wird ohne beschlossene starke Authentisierung verweigert | E2E |
| `CC-TC-AUTHZ-001` | CC-US-002 | `content-editor` versucht Publishing | Anfrage wird serverseitig verweigert und auditiert | Integration |
| `CC-TC-AUTHZ-002` | CC-US-002 | Mandanten-/Organisationsgrenze manipulieren | Zugriff auf fremdes Objekt wird neutral verweigert | Security |
| `CC-TC-AUDIT-001` | CC-US-003 | TAG-Statusänderung | genau ein Audit-Ereignis mit Akteur, Objekt, Aktion und Korrelation entsteht | Integration |
| `CC-TC-AUDIT-002` | CC-US-003 | Authentisierungs- und Publish-Fehler protokollieren | Audit enthält keine Passwörter, Tokens oder Secrets | Security |
| `CC-TC-UX-001` | CC-US-004 | Desktop-Ansicht für Pool-/Chargenlisten, Filter und Batch-Aktionen | breite Ansicht, Tastaturabläufe und parallele Kontextinformationen sind ohne mobile Behelfslösung nutzbar | UI/E2E |
| `CC-TC-UX-002` | CC-US-004 | Mobile Ansicht für TAG-ID-Scan/-Eingabe und Statusprüfung | responsiver Ablauf mit ausreichend großen Touch-Zielen und ohne ausschließlich hover- oder mausabhängige Aktion | UI/E2E |
| `CC-TC-UX-003` | CC-US-004 | Komplexe Massen-, Konfigurations- oder Publish-Aktion auf Mobilgerät | Aktion ist gemäß Policy eingeschränkt, schreibgeschützt oder sicher auf Desktop verwiesen; API bleibt geschützt | UI/Security |
| `CC-TC-UX-004` | CC-US-004 | Sensible mobile Folgeaktion | fehlende Rolle oder erforderliche Re-Authentisierung verweigert den Command serverseitig | E2E/Security |
| `CC-TC-SCHEMA-001` | CC-WP-03 | Leere Datenbank migrieren | Schema, Constraints und Referenzen werden vollständig erstellt | Integration |
| `CC-TC-SCHEMA-002` | CC-WP-03 | Migration/Restore der vorherigen Version | Migration bzw. Wiederherstellung ist nachvollziehbar und konsistent | Betrieb |

## CC-I02 – Ranges, TAG-Vergabe und Lebenszyklus

| ID | Bezug | Testfall | Erwartetes Ergebnis | Ebene |
| --- | --- | --- | --- | --- |
| `CC-TC-RANGE-001` | CC-US-012 | Gültige 6-stellige Range anlegen | kanonische, aktive und nicht überlappende Range wird akzeptiert | Unit/Integration |
| `CC-TC-RANGE-002` | CC-US-012 | Überlappende oder unsortierte Range anlegen | Validierung verweigert Speicherung bzw. Publish | Unit/Integration |
| `CC-TC-RANGE-003` | CC-US-012 | 8-stellige Range ohne vollständige Slotgrenzen | Range wird abgewiesen | Unit |
| `CC-TC-RANGE-004` | CC-US-012 | Range-/Gruppen-/Feature-Identifier ungültig | Eingabe wird serverseitig abgewiesen | Unit |
| `CC-TC-POOL-001` | CC-US-015 | gültigen Pool für private, Partner- oder Enterprise-Ausgabe anlegen | UI übergibt kanonische Pooldaten; bestätigter Control-Plane-Status und Kapazität werden angezeigt | UI/Contract |
| `CC-TC-POOL-002` | CC-US-015 | überlappende, erschöpfte oder fremd gebundene Poolkonfiguration | UI zeigt neutrale Control-Plane-Ablehnung; keine lokale Umgehung ist möglich | UI/Contract |
| `CC-TC-POOL-003` | CC-US-015 | Poolgrenzen als sichtbare Feistel-`tagId` interpretieren | UI erklärt/validiert `decodedValue`-Modell und sendet keine unzulässige Darstellung | UI |
| `CC-TC-POOL-004` | CC-US-015 | Pool-/Kundensegment-/Ownerdaten in Routing- oder öffentliche Vorschau aufnehmen | Ansicht schließt private Felder aus; Contract/Leak-Test schlägt bei Durchreichung fehl | UI/Security |
| `CC-TC-ALLOC-001` | CC-US-011 | 6-stellige TAG-ID vergeben | `tagId`, `decodedValue`, Länge und Range-Kontext sind eindeutig reserviert | Integration |
| `CC-TC-ALLOC-002` | CC-US-011 | 8-stellige TAG-ID vergeben | nächster 16er-Basisslot und korrekter HMAC-Nibble werden verwendet; voller Wert wird gespeichert | Unit/Integration |
| `CC-TC-ALLOC-003` | CC-US-011 | Parallele Vergaben derselben Range | keine Duplikate bei `tagId` oder `(length, decodedValue)` | Integration |
| `CC-TC-ALLOC-004` | CC-US-011 | Wiederholung nach Request-/Jobfehler | keine unerwartete zweite Reservierung und keine Slotüberschneidung | Integration |
| `CC-TC-ALLOC-005` | CC-US-011 | Secret-Leak-Prüfung | Feistel-/HMAC-Secrets fehlen in DB-Ausgaben, Logs, Fixtures und Responses | Security |
| `CC-TC-LIFECYCLE-001` | CC-US-010 / CC-US-013 | Erlaubter Ablauf `draft → pending-review → ready-to-publish` | Statuswechsel ist mit korrekter Rolle möglich und auditiert | Integration |
| `CC-TC-LIFECYCLE-002` | CC-US-013 | Ungültiger Statussprung, etwa `draft → active` | Statuswechsel wird verweigert | Unit |
| `CC-TC-PRINT-001` | CC-US-014 | Staging-QR-Daten erzeugen | kanonische Staging-URL ohne Secrets, klar als Staging markiert | Unit |
| `CC-TC-PRINT-002` | CC-US-014 | Produktionsdruck vor Gate-Freigabe | Erzeugung/Freigabe wird verweigert | Integration |
| `CC-TC-CLAIM-001` | CC-US-016 | erlaubte Claim-Strategie für Pool/Produkt wählen | UI bietet nur serverseitig erlaubte Einzel-, Bogen-/Chargencredential-, Preassign- oder Self-Print-Modelle | UI/Contract |
| `CC-TC-CLAIM-002` | CC-US-016 | manipulierte oder nicht erlaubte Claim-Strategie senden | Control Plane lehnt ab; UI zeigt neutralen Fehler ohne Policy- oder Credentialdetails | Security |
| `CC-TC-CLAIM-003` | CC-US-016 | offene Charge in der UI anzeigen | Credential-Typ, Verteilungsmodell und Sperrpolicy sichtbar; keine Hashes oder Klartextwerte nach Freigabe | UI/Security |
| `CC-TC-CLAIM-004` | CC-US-016 | vertraulichen Druck-/Self-Print-Export anfordern | erneute Berechtigung, Zweck, Umfang, Ablaufzeit und Auditreferenz sind erforderlich und sichtbar | E2E/Security |
| `CC-TC-CLAIM-005` | CC-US-016 | Claim-Sperre zurücksetzen oder Ersatz/Widerruf auslösen | nur berechtigte UI-Aktion ruft bestätigten Control-Plane-Workflow auf; Ergebnis/Audit wird angezeigt | UI/Contract |
| `CC-TC-PREASSIGN-001` | CC-US-016 | Bestellung mit Owner-/Organisation vorab zuweisen | UI übergibt gewünschten Kontext, zeigt nur bestätigte Zuordnung und keine privaten Daten fremder Kontexte | UI/Contract |
| `CC-TC-PREASSIGN-002` | CC-US-016 | Browser-Storage, UI-Fehler oder Auditansicht auf Credentials prüfen | keine PINs, Passwörter, Hashes oder Fehlversuchszähler werden offengelegt | Security |
| `CC-TC-SUPPORT-CLAIM-001` | CC-US-017 | TAG-ID eingeben oder scannen und Claim-Secret bestätigen | UI nutzt den gemeinsamen Control-Plane-Claim-Contract; lokaler Erfolg entsteht erst nach bestätigter Serverantwort | UI/Contract |
| `CC-TC-SUPPORT-CLAIM-002` | CC-US-017 | Secret nach Request, Abbruch oder Ansichtswechsel prüfen | Eingabe ist aus DOM-/UI-Zustand entfernt und fehlt in URL, Verlauf, Storage, Telemetrie, UI-Log und Auditansicht | UI/Security |
| `CC-TC-SUPPORT-CLAIM-003` | CC-US-017 | unbekannten, gesperrten, vorab zugewiesenen oder bereits geclaimten TAG begleiten | Antwort bleibt datensparsam und neutral; keine Hash-, Versuchszähler-, Pool- oder fremden Ownerdaten | UI/Security |
| `CC-TC-SUPPORT-CLAIM-004` | CC-US-017 | Lockout-Reset, Ersatz oder Widerruf als Folgeaktion ausführen | Rolle, Begründung und erforderliche Re-Authentisierung werden serverseitig geprüft; Audit-/Korrelationsreferenz wird angezeigt | E2E/Security |
| `CC-TC-SUPPORT-CLAIM-005` | CC-US-017 | mobilen Support-Claim durchführen | Mobilansicht enthält nur TAG-ID, Secret-Bestätigung, Ergebnis und zulässige Sofortmaßnahmen; Desktopkontext ist nicht vorausgesetzt | UI/E2E |

## CC-I03 – Routing-Projektion und Publishing

| ID | Bezug | Testfall | Erwartetes Ergebnis | Ebene |
| --- | --- | --- | --- | --- |
| `CC-TC-FEATURE-001` | CC-US-020 | Gültiges `tag-vault`-Feature konfigurieren | typspezifisch validiertes, minimales Feature-Dokument wird akzeptiert | Unit |
| `CC-TC-FEATURE-002` | CC-US-020 | Unbekannter Featuretyp, ungültiger Platzhalter oder unsicheres Ziel | Speicherung/Publish wird fail-closed verweigert | Unit |
| `CC-TC-FEATURE-003` | CC-US-020 | Private/POI-/Vault-Daten im Feature | Schema bzw. Datenklassifikation verweigert die Projektion | Security |
| `CC-TC-PROJECTION-001` | CC-US-021 | Vollständige gültige Routingdaten projizieren | ausschließlich erlaubte KV-Keys und referenzintegre Dokumente entstehen | Contract |
| `CC-TC-PROJECTION-002` | CC-US-021 | Projektions-Diff erzeugen | Änderung zeigt vorher/nachher ohne Geheimnisse oder private Felder | UI/Integration |
| `CC-TC-PROJECTION-003` | CC-US-021 | Fehlende Gruppe oder fehlendes Feature | Projektion und Outbox-Auftrag werden nicht erzeugt | Integration |
| `CC-TC-PUBLISH-001` | CC-US-022 | Mutation, Audit und Outbox erfolgreich speichern | alle drei Daten entstehen atomar | Integration |
| `CC-TC-PUBLISH-002` | CC-US-022 | Cloudflare-Publish erfolgreich | Publisher schreibt nur bestätigte Staging-Projektion und markiert Version erst danach als veröffentlicht | Sandbox/Staging |
| `CC-TC-PUBLISH-003` | CC-US-022 | Timeout/429/5xx beim Publish | Auftrag bleibt nachvollziehbar retrybar; kein falscher Veröffentlichungsstatus | Integration |
| `CC-TC-PUBLISH-004` | CC-US-022 | Idempotenter Retry eines erfolgreichen Auftrags | keine widersprüchliche Projektion und kein doppelter fachlicher Nebeneffekt | Integration |
| `CC-TC-PUBLISH-005` | CC-US-022 | Browserkontext versucht Cloudflare-Schreibzugriff | kein Token/Endpoint ist verfügbar; Versuch wird verweigert | Security |
| `CC-TC-UNPUBLISH-001` | CC-US-023 | Sperrung/Archivierung eines publizierten TAGs | direkte Regel wird entfernt oder definierte neutrale Projektion publiziert | Sandbox/Staging |
| `CC-TC-UNPUBLISH-002` | CC-US-023 | Unpublish-Fehler | fehlgeschlagener Auftrag bleibt sichtbar, auditierbar und erneut ausführbar | Integration |
| `CC-TC-RUNTIME-001` | CC-US-024 | Runtime-Vorschau für `public`, `pin-required`, `closed` und `redirect` öffnen | Ansicht zeigt nur zulässige Runtime-Attribute, Revision und Status; private Daten fehlen | UI/Contract |
| `CC-TC-RUNTIME-002` | CC-US-024 | Runtime-Diff gegen letzte veröffentlichte Revision prüfen | vorher/nachher sowie betroffene Routing-/Runtime-Wirkung sind verständlich; Secrets und private Felder fehlen | UI/Integration |
| `CC-TC-RUNTIME-003` | CC-US-024 | Publish-Command mit manipuliertem Runtime-Payload bzw. Browser-Schreibversuch senden | Server validiert/autorisert und erzeugt Outbox; Browser besitzt keinen KV-, R2- oder Worker-Schreibzugriff | Security/Contract |
| `CC-TC-RUNTIME-004` | CC-US-024 | `closed`, Sperrung, Ablauf und Archivierung veröffentlichen bzw. Retry eines Fehlers ausführen | neutrale öffentliche Wirkung; Audit-/Korrelationsreferenz und Retry-Status bleiben sichtbar | E2E/Integration |

## CC-I04 – Öffentlicher Basis-Vault und Read-API

| ID | Bezug | Testfall | Erwartetes Ergebnis | Ebene |
| --- | --- | --- | --- | --- |
| `CC-TC-PUBLIC-001` | CC-US-030 | Basis-Vault als Entwurf speichern | Inhalt bleibt privat und erscheint nicht in KV/API | Integration |
| `CC-TC-PUBLIC-002` | CC-US-030 | HTML/JavaScript/iFrame oder ungültiger externer Link | Eingabe wird serverseitig abgewiesen bzw. sanitär behandelt | Security |
| `CC-TC-PUBLIC-003` | CC-US-030 | Basis-Vault veröffentlichen | veröffentlichte Version und Audit entstehen; nur erlaubte öffentliche Felder sind abrufbar | Integration |
| `CC-TC-API-001` | CC-US-031 | Veröffentlichten TAG abrufen | Antwort erfüllt den vereinbarten `PublicTagView`-Contract | Contract |
| `CC-TC-API-002` | CC-US-031 | Entwurf, unbekannten, gesperrten oder abgelaufenen TAG abrufen | neutrale Antwort ohne Existenz-, Owner- oder Entwurfsleck | Security |
| `CC-TC-API-003` | CC-US-031 | Response auf Datenleck prüfen | keine Produkt-, Audit-, Owner-, Token-, Nachweis- oder Objektpfaddaten | Security |
| `CC-TC-API-004` | CC-US-031 | CORS, Methode, Rate Limit und Cache | nur erlaubte Origin/GET; Limits und Cache-Header entsprechen Policy | Integration |
| `CC-TC-INTEGRATION-001` | CC-US-032 | Positiver Staging-Scan | Edge Router leitet zur TAG-App; diese lädt und rendert öffentliche Read-API-Daten | Staging |
| `CC-TC-INTEGRATION-002` | CC-US-032 | Veröffentlichung zurückziehen bzw. TAG sperren | öffentliche Route/API liefert innerhalb Cache-Policy keine alten Inhalte mehr | Staging |
| `CC-TC-INTEGRATION-003` | CC-US-032 | Negativer Scan/API-Fall | unbekannte oder ungültige IDs geben keine internen Informationen preis | Staging |

## CC-I05 – Produkte, Organisationen und POI

| ID | Bezug | Testfall | Erwartetes Ergebnis | Ebene |
| --- | --- | --- | --- | --- |
| `CC-TC-PRODUCT-001` | CC-US-040 | Produktpolicy bei Aktivierung prüfen | Laufzeit, Limits und erlaubte Module werden serverseitig durchgesetzt | Unit/Integration |
| `CC-TC-PRODUCT-002` | CC-US-040 | Nicht zulässiges Modul im Free-/POI-Tier | Aktivierung bzw. Änderung wird verweigert | Integration |
| `CC-TC-ORG-001` | CC-US-041 | Organisation und kontextbezogene Rolle zuweisen | Rolle erlaubt nur die dokumentierten Aktionen | Integration |
| `CC-TC-ORG-002` | CC-US-041 | Betreiberwechsel | alte Rollen/Sessions/Tokens werden widerrufen oder zur Prüfung markiert; Audit entsteht | Integration |
| `CC-TC-POI-001` | CC-US-042 | POI ohne Pflichtnachweise aktivieren | Aktivierung/Publish wird verweigert | Integration |
| `CC-TC-POI-002` | CC-US-042 | POI nach erfolgreichem Review aktivieren | autorisierte Review-Freigabe, Audit und definierte öffentliche Projektion entstehen | E2E |
| `CC-TC-POI-003` | CC-US-042 | POI in `review`, `suspended` oder `expired` setzen | abhängige Check-in-/Guestbook-Module werden serverseitig deaktiviert | Integration |
| `CC-TC-POI-004` | CC-US-042 | Nachweis-/Kontaktleck in KV oder öffentlicher API | Leak-Test schlägt fehl bzw. Veröffentlichung wird blockiert | Security |
| `CC-TC-POI-REPORT-001` | CC-US-043 | Öffentliche POI-Meldung erfassen | Rate-limitiert, datensparsam gespeichert und auditierbar triagierbar | Integration |
| `CC-TC-POI-REPORT-002` | CC-US-043 | Schwere Meldung bearbeiten | kontrollierter Review-/Sperrprozess mit Audit, ohne automatische unprüfbare Sperre | E2E |
