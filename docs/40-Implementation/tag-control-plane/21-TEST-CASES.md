# Testfälle: TAG Control Plane

**Planungsstand:** 2026-10-06  
**Status:** Alle Testfälle sind geplant und werden erst mit der jeweiligen serverseitigen Implementierung ausgeführt.

## CP-I01 – Fundament und Audit

| ID | Bezug | Testfall | Erwartetes Ergebnis | Ebene |
| --- | --- | --- | --- | --- |
| `CP-TC-TX-001` | CP-US-001 | Mutation mit Fehler nach Teiloperation | gesamte DB-Transaktion inklusive Audit-/Outbox-Vorbereitung wird zurückgerollt | Integration |
| `CP-TC-AUTHZ-001` | CP-US-001 | Client manipuliert Rollen-, Objekt- oder Organisations-ID | serverseitige Policy verweigert Operation neutral | Security |
| `CP-TC-CONFIG-001` | CP-WP-01 | erforderliches Secret oder Umgebungsmerkmal fehlt | betroffener Prozess bricht fail-closed ab | Integration |
| `CP-TC-SCHEMA-001` | CP-WP-02 | Migration auf leerer Datenbank | Schema, Constraints und Referenzen werden vollständig erzeugt | Integration |
| `CP-TC-SCHEMA-002` | CP-WP-02 | Migration und Wiederherstellung | vorherige Version wird konsistent migriert bzw. wiederhergestellt | Betrieb |
| `CP-TC-AUDIT-001` | CP-US-002 | kritische TAG-/Produktions-/Publish-Mutation | genau ein korreliertes Audit-Ereignis entsteht | Integration |
| `CP-TC-AUDIT-002` | CP-US-002 | Audit-/Log-Sanitizing | Secrets, Zugangsdaten und vollständige Nachweise fehlen | Security |

## CP-I02 – Ranges, Vergabe und Lifecycle

| ID | Bezug | Testfall | Erwartetes Ergebnis | Ebene |
| --- | --- | --- | --- | --- |
| `CP-TC-RANGE-001` | CP-US-010 | gültige kanonische 6-stellige Range | Speicherung ist zulässig | Unit/Integration |
| `CP-TC-RANGE-002` | CP-US-010 | überlappende oder global unsortierte Range | Speicherung und Projektion werden verweigert | Unit/Integration |
| `CP-TC-RANGE-003` | CP-US-010 | 8-stellige Range ohne Start-/End-Slotgrenzen | Validierung verweigert die Range | Unit |
| `CP-TC-RANGE-004` | CP-US-010 | inaktive oder erschöpfte Range für Reservierung | keine neue TAG-ID wird vergeben | Integration |
| `CP-TC-POOL-001` | CP-US-013 | gültigen Pool für private, Partner- oder Enterprise-Ausgabe anlegen | Pool akzeptiert nur gültige kanonische Range(s), Policy und optionalen Organisationskontext | Integration |
| `CP-TC-POOL-002` | CP-US-013 | überlappende Poolrange oder sichtbare `tagId`-Grenze verwenden | Speicherung wird verweigert; Poolgrenzen bleiben `decodedValue`-basiert | Unit/Integration |
| `CP-TC-POOL-003` | CP-US-013 | aus erschöpftem, inaktivem oder fremd gebundenem Pool reservieren | Reservierung wird serverseitig verweigert | Integration |
| `CP-TC-POOL-004` | CP-US-013 | Pool-/Kundensegment-/Ownerdaten in KV oder Public Response einbringen | Leak-Test blockiert Projektion bzw. Response | Security |
| `CP-TC-ALLOC-001` | CP-US-011 | sechsstelligen TAG reservieren | eindeutige `tagId` und vollständiger `decodedValue` werden transaktional gespeichert | Integration |
| `CP-TC-ALLOC-002` | CP-US-011 | achtstelligen TAG reservieren | nächster 16er-Slot und serverseitig berechneter HMAC-Nibble werden korrekt genutzt | Unit/Integration |
| `CP-TC-ALLOC-003` | CP-US-011 | parallele Reservierungen derselben Range | keine doppelte `tagId` oder `(length, decodedValue)` | Integration |
| `CP-TC-ALLOC-004` | CP-US-011 | Wiederholung mit gleicher Idempotenz-/Korrelation-ID | keine zweite fachliche Reservierung | Integration |
| `CP-TC-ALLOC-005` | CP-US-011 | Secret-Leak-Prüfung bei Vergabe | keine Feistel-/HMAC-Secrets in DB-Antworten, Logs oder Fixtures | Security |
| `CP-TC-LIFECYCLE-001` | CP-US-012 | zulässiger Statuswechsel bis `ready-to-publish` | Wechsel wird geprüft und auditiert | Integration |
| `CP-TC-LIFECYCLE-002` | CP-US-012 | Aktivierung eines physischen TAGs ohne QA/Übergabe | Wechsel wird verweigert | Integration |
| `CP-TC-LIFECYCLE-003` | CP-US-012 | Sperrung/Archivierung eines aktiven TAGs | sichere Unpublish-/Neutralisierungsaktion wird geplant | Integration |

## CP-I03 – Herstellung, Claiming, Druck und Qualität

| ID | Bezug | Testfall | Erwartetes Ergebnis | Ebene |
| --- | --- | --- | --- | --- |
| `CP-TC-CLAIM-PREP-001` | CP-US-025 | Credential pro TAG erzeugen | nur individueller gesalzener Hash und Claim-Metadaten werden persistiert; Klartext fehlt nach Freigabe | Integration/Security |
| `CP-TC-CLAIM-PREP-002` | CP-US-025 | einen Bogen-/Chargen-PIN für mehrere TAGs verwenden | jeder TAG besitzt dennoch eigenen Hash, Status und Fehlversuchszähler | Integration |
| `CP-TC-CLAIM-PREP-003` | CP-US-025 | Credential-/Hash-/Claim-Gruppendaten in KV, Public API, Audit oder Log | Leak-Test blockiert bzw. findet keine Daten | Security |
| `CP-TC-CLAIM-001` | CP-US-026 | korrektes Credential für claimbaren TAG | Owner-Zuordnung, Verbrauch, Besitzstatus und Audit entstehen atomar | Integration |
| `CP-TC-CLAIM-002` | CP-US-026 | zwei parallele erfolgreiche Claim-Anfragen | exakt eine Owner-Zuordnung wird erfolgreich; zweiter Versuch bleibt neutral | Integration |
| `CP-TC-CLAIM-003` | CP-US-026 | falsches Credential bis zum Policy-Limit | Fehlversuche, progressive Sperre und neutraler Fehler werden korrekt gesetzt | Integration/Security |
| `CP-TC-CLAIM-004` | CP-US-026 | Client-/IP-basierte Versuchshäufung | Rate Limit bremst Durchprobieren, ohne Credential oder Zustandsdetails zu leaken | Security |
| `CP-TC-CLAIM-005` | CP-US-026 | Claim eines vorab zugewiesenen, gesperrten oder unbekannten TAGs | neutrale Ablehnung ohne Owner-/Statusleak | Security |
| `CP-TC-CLAIM-006` | CP-US-026 | Support-Reset | nur berechtigte Aktion setzt zulässige Claim-Sperre zurück und erzeugt Audit | Integration/Security |
| `CP-TC-SUPPORT-CLAIM-001` | CP-US-028 | TAG-App- und Control-Center-Support-Claim für denselben zulässigen Request | beide Kanäle verwenden denselben Claim-Service, dieselben Policy-/Lockout-/Atomizitätsregeln und minimalen Ergebnisvertrag | Integration/Contract |
| `CP-TC-SUPPORT-CLAIM-002` | CP-US-028 | Support-Claim mit Secret sowie Reset/Ersatz/Widerruf als Folgeaktion | Secret fehlt in Persistenz, Log und Audit; Folgeaktion verlangt Rolle, Begründung und erforderliche Re-Authentisierung und wird auditiert | Integration/Security |
| `CP-TC-PREASSIGN-001` | CP-US-027 | Bestellung mit Owner-/Organisation vorab zuweisen | reservierte Menge erhält atomar private `preassigned`-Zuordnung | Integration |
| `CP-TC-PREASSIGN-002` | CP-US-027 | vertrauliche Self-Print-Liste erzeugen | zeitlich begrenzter auditierter Export ohne Secrets/Tokens; Ownerdaten nur nach Policy | Integration/Security |
| `CP-TC-PREASSIGN-003` | CP-US-027 | Widerruf/Ersatz bei vorab zugeordnetem TAG | keine Doppelzuweisung; Status, Audit und ggf. Sperrwirkung konsistent | Integration |
| `CP-TC-PRODUCTION-001` | CP-US-020 | Produktionslos mit Menge erstellen | konkrete, eindeutige TAG-Positionen werden atomar reserviert | Integration |
| `CP-TC-PRODUCTION-002` | CP-US-020 | Fehler während Loserzeugung | keine unklare Teilmenge reservierter Positionen bleibt zurück | Integration |
| `CP-TC-PRODUCTION-003` | CP-US-020 | TAG gleichzeitig in zweites offenes Los aufnehmen | Zuordnung wird verweigert | Integration |
| `CP-TC-SNAPSHOT-001` | CP-US-021 | freigegebenen Drucksnapshot erzeugen | Snapshot enthält ID, URL, QR-Payload, Vorlage, Freigabe und Prüfsumme | Integration |
| `CP-TC-SNAPSHOT-002` | CP-US-021 | denselben freigegebenen Export erneut abrufen | identischer Inhalt und identische Prüfsumme; keine Neuberechnung | Integration |
| `CP-TC-SNAPSHOT-003` | CP-US-021 | regulären Drucksnapshot auf Leaks prüfen | keine Secrets, Cloudflare-Tokens, Owner- oder Vaultdaten; Claim-Klartext nur im freigegebenen vertraulichen Credential-Export | Security |
| `CP-TC-SNAPSHOT-004` | CP-US-021 | Druckposition nach Freigabe ändern | Änderung wird verweigert oder erzeugt neuen freizugebenden Auftrag | Integration |
| `CP-TC-QA-001` | CP-US-022 | Druck-/QA-Statusfolge positiv | nur zulässige Statuswechsel von `reserved` bis `quality-checked` | Unit/Integration |
| `CP-TC-QA-002` | CP-US-022 | Teilproduktion mit fehlerhaften Positionen | Auftrag wird `partially-completed`; Fehlerpositionen bleiben nachvollziehbar | Integration |
| `CP-TC-QA-003` | CP-US-022 | Ausschuss markieren | TAG bleibt belegt und wird nicht wieder frei | Integration |
| `CP-TC-REPRINT-001` | CP-US-023 | autorisierten Nachdruck derselben ID auslösen | gleicher geprüfter Snapshot oder explizit neue Snapshot-Version, Audit vorhanden | Integration |
| `CP-TC-REPRINT-002` | CP-US-023 | Ersatz mit neuer TAG-ID | alte ID wird nachvollziehbar gesperrt/archiviert, neue ist eindeutig | Integration |
| `CP-TC-REPRINT-003` | CP-US-023 | Verlust/Diebstahl eines aktiv publizierten TAGs | Sperrung plus Outbox für Unpublish/Neutralisierung entsteht | Integration |
| `CP-TC-HANDOVER-001` | CP-US-024 | geprüften TAG an Lager/Partner übergeben | Übergabe wird auditiert, aber nicht öffentlich projiziert | Integration |
| `CP-TC-HANDOVER-002` | CP-US-024 | Aktivierung vor QA-/Übergabegate | Aktivierung und Publish-Auftrag werden verweigert | Integration |
| `CP-TC-CLAIM-007` | CP-US-029 | erfolgreiches Claim-Credential absenden | atomar entsteht nur `claim-pending-setup`; noch keine dauerhafte Owner-Berechtigung | Integration |
| `CP-TC-CLAIM-008` | CP-US-029 | Claim-Setup mit Account-Bindung, Owner-Passphrase, Abbruch und Ablauf | nur zulässiger Besitzanker schließt Claim ab; abgebrochene/abgelaufene Setups erzeugen keine Ownerrechte | Integration/Security |
| `CP-TC-CLAIM-009` | CP-US-029 | Claim-Credential, Owner-Passphrase und Besucher-PIN in Prüf-, Audit- und Leak-Pfaden vergleichen | getrennte Hash-/Limit-/Sperrkontexte; kein Klartext oder Hash in API, KV, Audit oder Log | Security |
| `CP-TC-OWNER-001` | CP-US-033 | Owner-Passphrase außerhalb und innerhalb eines zulässigen Claim-/Account-Owner-Kontexts setzen | nur berechtigter Kontext kann Passphrase setzen, ändern oder deaktivieren | Integration/Authorization |
| `CP-TC-OWNER-002` | CP-US-033 | gültige, falsche und wiederholte Owner-Passphrase prüfen | langsamer Hash, neutrale Fehler, progressive Sperre und Rate Limit werden serverseitig erzwungen | Security |
| `CP-TC-OWNER-003` | CP-US-033 | erfolgreiche Owner-Anmeldung und schreibende Aktion ausführen | kurzlebige, TAG-gebundene `HttpOnly`-/`Secure`-/`SameSite=Strict`-Session; CSRF und Scope werden geprüft | Integration/Security |
| `CP-TC-OWNER-004` | CP-US-033 | Session nach Sperrung, Ablauf, Archivierung oder Widerruf verwenden | Zugriff wird verweigert; keine Umgehung per Account-Zuordnung oder alter Session | Security |
| `CP-TC-COLLECTION-001` | CP-US-034 | gültige lokale TAG-Liste mit aktiver Account-Session importieren | jede ID wird validiert; `(accountId, tagId)` wird idempotent gespeichert | Integration |
| `CP-TC-COLLECTION-002` | CP-US-034 | Collection eines anderen Accounts lesen, ändern oder löschen | Mandantengrenze wird serverseitig neutral durchgesetzt | Security |
| `CP-TC-COLLECTION-003` | CP-US-034 | geschlossenen TAG, Collection-Eintrag und Owner-Endpunkt kombinieren | Referenz darf verbleiben, Public View bleibt neutral, Eintrag verleiht keine Berechtigung; APIs verwenden `no-store` | Integration/Security |

## CP-I04 – Projektion und Publishing

| ID | Bezug | Testfall | Erwartetes Ergebnis | Ebene |
| --- | --- | --- | --- | --- |
| `CP-TC-PROJECTION-001` | CP-US-030 | gültige Konfiguration projizieren | ausschließlich erlaubte KV-Keys und referenzintegre Dokumente entstehen | Contract |
| `CP-TC-PROJECTION-002` | CP-US-030 | private Produktions-/Owner-/Auditdaten einbringen | Projektion wird abgewiesen bzw. diese Felder fehlen garantiert | Security |
| `CP-TC-PROJECTION-003` | CP-US-030 | ungültiges Feature, URL oder fehlende Referenz | keine Outbox wird erzeugt | Integration |
| `CP-TC-PUBLISH-001` | CP-US-031 | Mutation, Audit und Outbox persistieren | alle drei Daten entstehen oder fehlen gemeinsam | Integration |
| `CP-TC-PUBLISH-002` | CP-US-031 | bestätigter Staging-Publish | Version wird erst nach erfolgreicher Cloudflare-Antwort als veröffentlicht markiert | Sandbox/Staging |
| `CP-TC-PUBLISH-003` | CP-US-031 | Timeout, 429 oder 5xx | Auftrag bleibt retrybar; Veröffentlichungsstatus bleibt korrekt | Integration |
| `CP-TC-PUBLISH-004` | CP-US-031 | idempotenter Retry | keine widersprüchliche Projektion und kein doppelter fachlicher Nebeneffekt | Integration |
| `CP-TC-PUBLISH-005` | CP-US-031 | Staging-Konfiguration auf Produktionsziel | Publisher verweigert Umgebungsüberschreitung | Security |
| `CP-TC-UNPUBLISH-001` | CP-US-032 | Unpublish eines gesperrten/zerstörten TAGs | Regel wird entfernt oder zulässige Neutralisierung publiziert | Sandbox/Staging |
| `CP-TC-UNPUBLISH-002` | CP-US-032 | Fehler beim Unpublish | Auftrag und Fehlergrund bleiben auditierbar und erneut ausführbar | Integration |
| `CP-TC-RUNTIME-001` | CP-US-035 | freigegebene Runtime-Konfiguration mit `public`, `pin-required`, `closed` und validiertem `redirect` ableiten | ausschließlich schema-konforme öffentliche Runtime-Projektion mit korrektem Modus entsteht | Contract/Integration |
| `CP-TC-RUNTIME-002` | CP-US-035 | Owner-, Account-, Credential-, PIN-, Session-, Audit-, Pool- oder Objektpfadfelder in Runtime-Input einschleusen | Mapper/Pipeline verweigert oder entfernt private Felder zuverlässig | Security |
| `CP-TC-RUNTIME-003` | CP-US-035 | Key für kanonische TAG-ID und veröffentlichte Revision erzeugen; Clientpfad manipulieren | Key wird ausschließlich aus kanonischer `tagId` und Revision abgeleitet | Unit/Security |
| `CP-TC-RUNTIME-004` | CP-US-035 | Fachmutation, Audit, Routing- und Runtime-Outbox mit Fehler simulieren | alle fachlichen Zustände entstehen konsistent; fehlgeschlagener Publish bleibt retrybar und sichtbar | Integration |
| `CP-TC-RUNTIME-005` | CP-US-035 | Sichtbarkeitswechsel, Sperrung, Ablauf und Archivierung publizieren | Runtime wird neutralisiert/entfernt; Public Read API liefert keine alten Daten außerhalb dokumentierter Cache-Grenzen | Integration/Staging |

## CP-I05 – Öffentliche Basisdaten

| ID | Bezug | Testfall | Erwartetes Ergebnis | Ebene |
| --- | --- | --- | --- | --- |
| `CP-TC-PUBLIC-001` | CP-US-040 | Basis-Vault-Entwurf speichern | kein Entwurfsfeld erscheint in Public API oder KV | Integration |
| `CP-TC-PUBLIC-002` | CP-US-040 | HTML, JavaScript, iFrame oder ungültiger Link | Eingabe wird serverseitig abgewiesen | Security |
| `CP-TC-PUBLIC-003` | CP-US-040 | veröffentlichte Version widerrufen | öffentliche Sichtbarkeit endet gemäß Cache-Policy; Audit entsteht | Integration |
| `CP-TC-API-001` | CP-US-041 | veröffentlichten TAG lesen | Response erfüllt ausschließlich den PublicTagView-Contract | Contract |
| `CP-TC-API-002` | CP-US-041 | unbekannten, Entwurfs-, gesperrten oder abgelaufenen TAG lesen | neutrale Antwort ohne Existenz- oder interne Datenlecks | Security |
| `CP-TC-API-003` | CP-US-041 | CORS, Methoden, Rate Limit und Cache | nur erlaubter GET-/Origin-Zugriff mit geeigneten Headern | Integration |
| `CP-TC-API-004` | CP-US-041 | Response auf private Felder prüfen | keine Produktions-, Audit-, Owner-, Policy-, Nachweis- oder Tokenfelder | Security |
| `CP-TC-E2E-001` | CP-WP-12 | positiver Staging-Scan | Scan → Edge Router → TAG-App → Public Read API liefert veröffentlichte Daten | Staging |
| `CP-TC-E2E-002` | CP-WP-12 | negativer Staging-Scan nach Sperrung | Route/API liefert innerhalb Cache-Policy keine alten öffentlichen Inhalte | Staging |

## CP-I06 – Policies und POI

| ID | Bezug | Testfall | Erwartetes Ergebnis | Ebene |
| --- | --- | --- | --- | --- |
| `CP-TC-POLICY-001` | CP-US-050 | Produktpolicy bei Reservierung/Aktivierung | Laufzeit und Modulgrenzen werden serverseitig erzwungen | Unit/Integration |
| `CP-TC-ORG-001` | CP-US-050 | Organisation überschreitet eigenen Kontext | Zugriff/Mu­tation auf fremde Daten wird verweigert | Security |
| `CP-TC-POI-001` | CP-US-051 | POI ohne Pflichtnachweise aktivieren | Aktivierung und Publish werden verweigert | Integration |
| `CP-TC-POI-002` | CP-US-051 | POI-Nachweis in KV/Public API | Leak-Test scheitert bzw. Projektion wird blockiert | Security |
| `CP-TC-POI-003` | CP-US-051 | POI auf `review`, `suspended`, `expired` setzen | abhängige Runtime-Module werden serverseitig deaktiviert | Integration |
