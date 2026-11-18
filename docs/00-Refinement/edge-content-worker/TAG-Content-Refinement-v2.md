# Prompt: Refinement der TAG-Content- und Access-API

## 1. Rolle und Auftrag

Arbeite als Senior Softwarearchitekt für Cloudflare Workers, verteilte Content-Architekturen und API-Sicherheit. Führe ein entscheidungsorientiertes Refinement der bestehenden myQR24-Architektur durch und erstelle daraus eine umsetzbare, prüfbare Implementierungsplanung für die TAG-Content- und Access-API.

Ziel ist eine API, mit der die TAG-App freigegebene Inhalte eines TAGs sicher lesen kann. Ein TAG kann beispielsweise Texte, eine Bildergalerie, eine Dokumentenliste oder eine Reparaturhistorie mit Medienverweisen enthalten. Die Inhalte benötigen ein versioniertes, typisiertes und erweiterbares Format. Der Zugriff erfolgt über serverseitig geprüfte, TAG- und Scope-gebundene Sessions und berücksichtigt Lifecycle, Sichtbarkeit, Widerruf und Contentrevision.

Behandle den ursprünglichen Entwurf und den Prototyp als zu prüfende Ideen, nicht als verbindliche Anforderungen. Setze über die ausdrücklich getroffenen Festlegungen in Abschnitt 4.1 hinaus weder eine neue D1-Fachdatenbank noch einen neuen Worker, JWTs, Uploads oder ein bestimmtes Ordnerlayout voraus. Triff erst nach der Ist-Analyse weitere begründete Entscheidungen.

Dieser Auftrag umfasst ausschließlich Analyse und Dokumentation. Implementiere keinen Produktivcode, ändere keine Cloudflare-Ressourcen und führe weder Migrationen noch Deployments aus.

## 2. Verbindliche Leitplanken

Beachte die folgenden Architekturgrenzen. Wenn du eine Abweichung für notwendig hältst, kennzeichne sie als Architekturänderung, begründe sie und beschreibe den erforderlichen ADR-, Contract- und Migrationsprozess, anstatt die bestehende Architektur stillschweigend umzudeuten.

- Die TAG Control Plane (TCP) mit MySQL ist die fachlich autoritative Quelle für TAGs, Ownership, Policies, Inhalte, Berechtigungen, Audit und Publikationsaufträge.
- Cloudflare KV, D1 und R2 enthalten nur die jeweils vertraglich festgelegten, abgeleiteten beziehungsweise temporären Daten. D1 ist nicht automatisch eine zweite autoritative TAG-Registry.
- Der Edge Router validiert und routet Scans. Er bleibt frei von Vault-Inhalten, Owner-/Besucher-Sessions, Medienverwaltung und fachlichen Berechtigungsentscheidungen.
- Ein Scan, eine gültige TAG-ID oder ein signierter PWA-Bootstrap ist keine ausreichende Berechtigung für geschützte Inhalte. Authentisierung, Sessionausstellung und Autorisierung sind getrennt zu beschreiben.
- Jeder Content- und Medienzugriff prüft serverseitig TAG, Status, Session, Scope, Access-Version und zulässige Contentrevision. Verhindere insbesondere TAG-übergreifende Sessions und IDOR über Content-, Asset- oder Varianten-IDs.
- Scanner-, PIN-, Login-, Owner-, Gast- und Empfängerberechtigungen sind nicht gleichzusetzen. Eine Besucher-PIN ist weder ein Claim-Secret noch eine Owner-Passphrase.
- Browser erhalten keine Secrets, PIN-Hashes, internen Berechtigungsdaten, beliebig wählbaren R2-Keys oder Cloudflare-Credentials. Private Objektpfade werden ausschließlich serverseitig abgeleitet.
- Verwende die vorhandenen fail-closed-Regeln, neutralen Fehlerbilder und Cache-Grenzen. Private beziehungsweise personalisierte Antworten werden nicht öffentlich oder persistent gecacht.
- Staging und Production bleiben hinsichtlich Worker, D1, R2, Service Bindings, Secrets, Routen und Testdaten vollständig getrennt.
- Das Read-MVP darf nicht stillschweigend zu einer vollständigen Owner-, Upload-, Chat-, Lost-&-Found- oder Verwaltungs-API erweitert werden. Spätere Erweiterungen sind sauber abzugrenzen.

## 3. Quellenlage und Ist-Analyse

Lies zuerst `AGENT.md` und folge den darin enthaltenen Projektregeln. Arbeite anschließend quellenkritisch in dieser Reihenfolge:

1. **Verbindliche Basis:** `docs/ARCHITECTURE.md`, `docs/DOMAIN_RULES.md` sowie die Dokumente unter `docs/10-Architecture/`.
2. **Versionierte Contracts:** `docs/10-Architecture/35-Contracts/README.md` und die referenzierten Verträge.
3. **Aktueller Implementierungsstand:** vorhandener Code, Tests, Konfiguration, User Stories, Traceability und Status unter `apps/` und `docs/40-Implementation/`.
4. **Unverbindliche Ideen:** `docs/00-Refinement/edge-content-worker/TAG-Content-Refinement.md`, `architektur_refinement_kommerzielle_qr_event_plattform_auf_cloudflare.md` und der Prototyp unter `myqr24-api-stg/myqr24-api-stg/`.

Prüfe mindestens die folgenden konkreten Quellen und verfolge zusätzlich ihre fachlich relevanten Referenzen:

- `docs/10-Architecture/31-App-Architecture/10-COMPONENTS-AND-APPLICATIONS.md`
- `docs/10-Architecture/10-Functional-Architecture/10-TAG-PLATFORM-PROCESS-ARCHITECTURE.md`
- `docs/10-Architecture/30-Data-Architecture/10-DOMAIN-DATA-MODEL.md`
- `docs/10-Architecture/30-Data-Architecture/20-COMPONENT-DATA-ARCHITECTURE.md`
- `docs/10-Architecture/30-Data-Architecture/30-PHYSICAL-DATA-ARCHITECTURE.md`
- `docs/10-Architecture/TAG_APP_ARCHITECTURE.md` und `PWA_PERMISSION_AND_CAPABILITY_MODEL.md`
- `docs/10-Architecture/35-Contracts/tag-edge-d1-routing-v1.md`
- `docs/10-Architecture/35-Contracts/tag-app-access-v1.md`
- `docs/10-Architecture/35-Contracts/tag-routing-projection-v1.md`
- `docs/10-Architecture/35-Contracts/tag-pages-runtime-r2-v1.md` einschließlich seines tatsächlichen Status und seiner Ersetzungshinweise
- `docs/40-Implementation/tag-app/10-USER-STORIES.md`, `20-TEST-STRATEGY.md`, `21-TEST-CASES.md`, `30-TRACEABILITY.md` und `STATUS.md`
- `docs/40-Implementation/edge-router/` als Beispiel für Story-, Test- und Nachweisstruktur
- `docs/40-Implementation/10-Implementation-Orchestration/` einschließlich Ressourcen- und Deployment-Gates
- `apps/tag-app/workers/app-api.ts`, `workers/media-signer.ts`, `database/0001_tag_access.sql`, `test/app-api.test.ts`
- `apps/tag-app/src/services/tagAccessService.ts`, `publicTagViewService.ts` und die zugehörigen Tests und Typen
- `apps/tag-app/wrangler.app-api.toml`, `wrangler.media-signer.toml` und relevante Edge-Router-Konfiguration
- Prototyp: `README.md`, `src/index.ts`, `migrations/0001_init.sql`, `wrangler.jsonc` und `package.json`

Prüfe vor ihrer Verwendung, ob referenzierte Dateien tatsächlich existieren. Erfinde keine fehlenden Status- oder Vertragsdokumente.

Erstelle zu Beginn des Ergebnisdokuments eine kompakte Quellen- und Befundübersicht. Trenne dabei eindeutig:

- **bestätigt:** durch verbindliche Dokumentation oder vorhandenen Code belegt;
- **geplant:** dokumentiert, aber noch nicht vollständig umgesetzt oder extern verifiziert;
- **Annahme:** für den Vorschlag getroffen und noch zu bestätigen;
- **offen:** ohne belastbare Entscheidung;
- **Widerspruch:** Quellen oder Ist-Code widersprechen einander.

Gleichrangige Widersprüche, abweichende Domainnamen, Statusangaben oder Contract-Versionen dürfen nicht stillschweigend aufgelöst werden. Dokumentiere Fundstelle, Auswirkung und empfohlene Klärung. Ein Contract-Index ersetzt nicht die Prüfung des Status im jeweiligen Contract. Historische oder als `superseded` markierte Ansätze dürfen nicht unkommentiert als Zielarchitektur übernommen werden.

Bewerte den Prototyp in einer Tabelle mit den Spalten `Aspekt`, `Befund`, `Empfehlung` (`behalten`, `anpassen` oder `verwerfen`), `Begründung` und `Zielreferenz`. Prüfe dabei mindestens API-Routen, Authentisierung, D1-Modell, BigInt-/SQLite-Abbildung, R2-Keys, Bildvarianten, Fehlerverhalten, Sharding, Multi-Region, Uploads und Deploymentannahmen.

## 4. Zu treffende Architektur- und Fachentscheidungen

Arbeite die folgenden Punkte vollständig heraus. Nenne je Entscheidung Alternativen, Bewertungskriterien, Empfehlung, Begründung, Auswirkungen und offene Abhängigkeiten.

### 4.1 Festgelegte Komponenten- und Frameworkgrenze

Die Zielkomponente ist verbindlich der bereits vorhandene TAG Application API Worker unter `apps/tag-app/workers/app-api.ts` mit `apps/tag-app/wrangler.app-api.toml`. Es wird weder ein Content-Worker im Edge Router noch ein neues Top-Level-Verzeichnis `apps/tag-api/` eingeführt. Eine spätere organisatorische Verschiebung ist nicht Bestandteil dieses Refinements.

Die HTTP-Schicht wird verbindlich mit **Hono** umgesetzt. Hono ersetzt ausschließlich das manuelle Routing und ergänzt geeignete HTTP-Middleware. Die bestehenden URL-Verträge, Session-/PIN-Mechanismen, D1-/R2-Zugriffe, Sicherheitsgrenzen und das Service Binding zum separaten Media Signer bleiben erhalten. Der Media Signer muss nicht ebenfalls auf Hono umgestellt werden.

Arbeite für das weitere Refinement die interne Hono-Struktur heraus: typisierte Bindings und Routen, Request-Validierung, zentrale Security-Header, neutrale `notFound`-/`onError`-Behandlung, Session-/Scope-Middleware nur mit nachgewiesener Neutralität sowie ein kompatibler Cloudflare-Export. Vermeide pauschale CORS- oder JWT-Middleware und Framework-Defaults, die Trailing Slashes, `HEAD`, Fehlerresponses oder Cache-Verhalten unbeabsichtigt ändern. Beschreibe außerdem, wie die bisherigen Tests und der Export `handleAppApiRequest` als stabile Regressionsgrenze erhalten bleiben.

### 4.2 Datenhoheit und Datenmodell

Definiere eine Verantwortungsmatrix für TCP/MySQL, D1, R2, KV, Session Store und Browser. Kläre insbesondere:

- welche TAG-, Routing-, Access- und Contentfelder wo autoritativ beziehungsweise projiziert werden;
- ob und wie `tagId`, `decodedValue`, Lifecycle, Feature-/Produktkontext, `access_version` und `content_revision` abgebildet werden, ohne parallele Wahrheiten zu erzeugen;
- wie verlustfreie ID-Werte in TypeScript, SQL, JSON und D1 behandelt werden;
- wie immutable Contentrevisionen, Pointer, Publish, Retry, Rollback, Unpublish und Widerruf konsistent bleiben;
- warum D1-Sharding oder Multi-Region für das MVP erforderlich oder bewusst ausgeschlossen ist. Produktlimits nur mit aktueller, datierter Quelle verwenden.

### 4.3 Content- und Medienmodell

Bilde die Inhalte auf die vorhandenen Vault-, Content-Block-, Media-Asset- und Runtime-Revision-Konzepte ab. Prüfe mindestens Text, Galerie, Dokumentenliste und Reparaturhistorie mit Medienlinks. Unterscheide TAG-Beschreibung/Darstellung, maschinenlesbares Schema und eigentlichen Runtime-Content.

Spezifiziere ein versioniertes JSON-/TypeScript-Modell mit Schema-/Contract-Version, TAG- und Revisionsbindung, typisierten Blöcken, stabilen öffentlichen Content-IDs, Assetreferenzen, Sortierung, Sichtbarkeit und Validierungsregeln. Definiere Umgang mit unbekannten Blöcken/Feldern, Größen- und Mengenlimits, Paginierung bei großen Listen sowie Vorwärts-/Rückwärtskompatibilität. Beliebiges HTML, JavaScript und frei wählbare Storage-Pfade sind ausgeschlossen.

Beschreibe zusätzlich die Medienauflösung über anonyme IDs und erlaubte Varianten, die Trennung privater und gegebenenfalls öffentlicher Assets, kurzlebige signierte URLs oder Streams sowie MIME-/Größenprüfung. Upload, Bildtransformation, Malware-Scan und Moderation gehören nur dann zum MVP, wenn du eine konkrete bestehende Abhängigkeit nachweist.

### 4.4 Zugriff, Sessions und Lifecycle

Baue auf dem vorhandenen Public-/PIN-Bootstrap und dem Cookie-/Session-Contract auf oder begründe einen versionierten Breaking Change. Erstelle eine Zugriffsmatrix für mindestens `public`, `pin_required`, `login_required`, `closed`, gesperrte, deaktivierte und abgelaufene TAGs. Beschreibe für jeden zulässigen Fall Bootstrap, Authentisierung, Session-Scope, Contentzugriff, Medienzugriff, Ablauf und Widerruf.

Behandle mindestens:

- sichere Zufallstokens, ausschließlich serverseitig gespeicherte Tokenhashes sowie geeignete Cookie-Attribute;
- Bindung an TAG, Scope und Access-Version, Ablauf, Logout, Widerruf und Sessionrotation;
- PIN-Prüfung mit vorhandenem Hash-/Pepper-Konzept, Throttling und neutralen Antworten;
- Schutz vor Bootstrap-/Nonce-Replay und die Trennung zwischen Bootstrapnachweis und Session;
- Same-Origin-/CORS-Modell sowie CSRF-Schutz für alle eventuell vorgesehenen Mutationen;
- den fehlenden oder vorhandenen Login-Contract als explizite Abhängigkeit, ohne einen Login-Bypass zu erfinden;
- Owner-, Gast- und Empfängerzugriffe als getrennte spätere Contracts, sofern sie nicht zum Read-MVP gehören.

### 4.5 API-Vertrag und End-to-End-Abläufe

Nimm die vorhandenen Endpunkte und DTOs als Ausgangspunkt. Dokumentiere je Endpunkt Version, Owner, Consumer, Methode, Pfad, Request, Response, Datenklassifikation, Authentisierung, Autorisierung, Statuscodes, Fehlerform, Cache-Verhalten, Idempotenz, Rate Limits und Testreferenzen. Kennzeichne Abweichungen vom Ist-Vertrag und liefere einen Kompatibilitäts- und Migrationsplan.

Stelle die wesentlichen Abläufe als Mermaid-Sequenzdiagramme dar:

1. öffentlicher Scan bis zur Contentanzeige;
2. PIN-geschützter Scan einschließlich Fehlversuchen und Sessionwiderruf;
3. Login-geschützter Zugriff mit klar markierter externer Abhängigkeit;
4. Content- und Medienabruf einschließlich Revisions- und Scope-Prüfung;
5. TCP-Publish von R2-Revision und D1-Pointer einschließlich Retry und teilweisem Fehler;
6. Sperrung, Ablauf, Unpublish und PIN-/Policy-Änderung;
7. ungültige TAG-ID, fremde Session, unbekannte Content-ID und inkonsistente Projektion.

### 4.6 Sicherheit, Betrieb und Wirtschaftlichkeit

Erstelle eine kompakte Bedrohungs- und Kontrollmatrix für ID Enumeration, IDOR, Sessiondiebstahl/-fixation, Replay, PIN-Bruteforce, XSS, unsichere externe Links, Open Redirect/SSRF, schädliche Dateien, MIME Sniffing, Datenlecks über Logs/Cache/Fehler sowie Ressourcen- und Kostenerschöpfung.

Definiere außerdem nichtfunktionale Anforderungen und Messpunkte für Latenz, Payloadgrößen, D1-/R2-Zugriffe, Verfügbarkeit, Rate Limits, Logging, Metriken, Tracing, Alarmierung, Datensparsamkeit, Retention, Backup/Wiederherstellung und Kosten. Secrets und personenbezogene Inhalte dürfen nicht in Telemetrie oder Testartefakten erscheinen.

Beschreibe Local, Test, Staging und Production mit Ressourcen-/Secret-Matrix und Gates. Übernimm die vorhandenen Deployment-Sperren und bezeichne lokale Fakes nicht als Staging- oder Produktionsnachweis.

## 5. MVP, Roadmap und User Stories

Grenze den Umfang ausdrücklich in `MVP`, `spätere Iteration` und `nicht Teil dieser API` ab. Das MVP soll den kleinsten sicheren, vertikal nutzbaren Read-Pfad liefern und vorhandene Contracts nicht unnötig ersetzen. Berücksichtige Abhängigkeiten zu TCP Publisher, TAG-App, Media Signer, IAM und Control-Plane-Contracts.

Erstelle priorisierte User Stories mit eindeutigen IDs im Schema `API-US-###`. Vermeide Kollisionen und fachliche Duplikate mit `APP-US-*`; verweise stattdessen auf bestehende Stories. Jede Story enthält:

- Titel, Priorität, Iteration und Status;
- fachliche Rolle, Ziel und Nutzen im Format **Als / möchte ich / damit**;
- Vorbedingungen, Abhängigkeiten und betroffene Contracts/Komponenten;
- objektiv testbare Akzeptanzkriterien einschließlich positiver, negativer und sicherheitsrelevanter Fälle;
- mindestens einen referenzierten Testfall und eine Testdaten-ID.

Decke mindestens Content lesen, öffentliche und PIN-Sessions, Medienauflösung, Schema-/Revisionsvalidierung, Lifecycle, Widerruf, neutrale Fehler, Cache-/Datenschutzregeln, Publish-Konsistenz, Observability und reproduzierbare Tests ab. Login und spätere Schreib-/Upload-Flows erhalten eigene Stories mit Abhängigkeiten und dürfen nicht als bereits verfügbar dargestellt werden.

Plane kleine, unabhängig abnehmbare Iterationen mit Ein-/Ausgängen und Gates. Beschreibe pro Iteration Ziel, Stories, Vorbedingungen, erwartete Code-/Contract-Änderungen, Tests, Migrations-/Rollbackbedarf und explizites Done-Kriterium. Keine reine Liste von technischen Aufgaben ohne fachlichen Nutzen.

## 6. Zu erstellende Dokumente

Lege die Ergebnisse unter `docs/40-Implementation/tag-api/` an. Prüfe vorhandene Dateien vor dem Schreiben und überschreibe keine unbekannten Benutzeränderungen. Verwende Deutsch; etablierte technische Begriffe, IDs, Contracts und Codebezeichner bleiben unverändert.

Erstelle beziehungsweise vervollständige folgende Dokumente:

| Datei | Erforderlicher Inhalt |
| --- | --- |
| `README.md` | Executive Summary, Scope/Nicht-Ziele, Quellen- und Befundübersicht, Widerspruchsregister, Prototypbewertung, festgelegte Komponenten-/Hono-Struktur, verbleibende Entscheidungsmatrizen, Verantwortlichkeiten, Daten- und Zugriffsmodell, Endpunktübersicht, Ablaufdiagramme, Sicherheit/Betrieb, MVP/Roadmap, Migrationsweg, offene Entscheidungen |
| `10-USER-STORIES.md` | priorisierte Epics und `API-US-###` mit vollständigen, testbaren Akzeptanzkriterien, Abhängigkeiten und Status |
| `20-TEST-STRATEGY.md` | Testpyramide, Contract-/Security-/Integrationstests, Testumgebungen, Fixtures, Grenzen lokaler Fakes, Staging-Gates und geforderte Evidenz |
| `21-TEST-CASES.md` | eindeutige `API-TC-###` mit Vorbedingung, Aktion, erwartetem Ergebnis, Story- und Testdatenbezug |
| `22-TEST-DATA.md` | synthetische `API-TD-###`, gültige/ungültige Contentrevisionen, Rollen/Sessions/Lifecycle, Medienfälle und Regel gegen reale Secrets oder personenbezogene Daten |
| `30-TRACEABILITY.md` | durchgehende Zuordnung Anforderung/Story → Akzeptanzkriterium → Contract → Testfall → Testdaten → geplante Komponente → Evidenz/Status |
| `STATUS.md` | ehrlicher Ausgangszustand `refined` beziehungsweise `planned`, Blocker, Gates und nächste Schritte; keine nicht ausgeführten Tests oder Implementierungen als erledigt ausweisen |

Das `README.md` ist die zentrale Architektur- und Implementierungsentscheidung. Es muss ohne die Refinement-Ideen verstanden werden können und mindestens folgende Fragen eindeutig beantworten:

1. Wie ist die festgelegte TAG Application API mit Hono intern aufgebaut und welche Grenzen bleiben gegenüber Edge Router, Media Signer und TCP bestehen?
2. Was bleibt im Edge Router, was liegt in TAG-App, Application API und TCP?
3. Welche Daten sind autoritativ, abgeleitet oder temporär?
4. Wie sehen Content- und Mediencontracts einschließlich Versionierung aus?
5. Wie funktionieren Public, PIN und Login ohne Scope-Vermischung?
6. Wie bleiben Publish, Lesen, Widerruf und Caching konsistent?
7. Welcher kleinste MVP ist umsetzbar und welche externen Gates blockieren ihn?
8. Welche Bestandteile des Prototyps werden konkret übernommen oder verworfen?
9. Welche bestehenden Architektur- und Contractdokumente müssen nach einer Entscheidung angepasst werden?

Nimm notwendige Änderungen an verbindlichen Architektur- oder Contractdokumenten als eigene, referenzierte Folgeaufgaben in die Roadmap auf. Ändere diese Dokumente im Rahmen dieses Refinements nicht stillschweigend. Formuliere keine unbelegten Aussagen wie `implemented`, `verified`, `production-ready` oder `DSGVO-konform`.

## 7. Test- und Nachweisplanung

Plane mindestens Unit-, Schema-/Contract-, Worker-Integrations-, End-to-End- und kontrollierte Staging-Tests. Teste positiv und negativ insbesondere:

- alle unterstützten TAG-ID-Längen sowie ungültige IDs und Pfade;
- Public-/PIN-Bootstrap, Signatur, Nonce, Ablauf, Sessionrotation und Cookie-Grenzen;
- falsche PIN, Throttle, PIN-Änderung, Logout, Ablauf und Widerruf;
- fremde TAG-/Scope-Sessions und Cross-TAG-Zugriffe auf Content oder Medien;
- aktive, geschlossene, gesperrte, deaktivierte, abgelaufene und inkonsistente Zustände;
- falsche Schema-/Contract-Version, fremde TAG-/Revisionsbindung, unbekannte Blöcke und Leaks interner Felder;
- fehlende oder falsche Content-ID, Assetvariante, Contentrevision und R2-Projektion;
- Publish-Reihenfolge, Retry, veralteter Pointer, Unpublish und Wiederherstellung;
- Cache-Control, Service-Worker-/Browser-Speicher und Fehlerantworten ohne Informationslecks;
- Größen-, Mengen-, Raten- und Zeitlimits sowie Beobachtbarkeit ohne sensitive Payloads.

Definiere für jeden Test, ob er lokal mit Fakes, mit Miniflare/Workers-Runtime oder ausschließlich in Staging belastbar ist. Ein Dry Run oder erfolgreicher Build ist kein Security-, Laufzeit- oder Staging-Nachweis. Status `verified` ist nur mit tatsächlich vorhandener Evidenz zulässig.

## 8. Umgang mit Unsicherheit und Rückfragen

Stelle nur dann eine Rückfrage, wenn eine fehlende Produktentscheidung jede belastbare Planung blockiert. Arbeite bei nicht blockierenden Unklarheiten mit explizit gekennzeichneten Annahmen weiter. Führe am Ende eine priorisierte Entscheidungsliste mit `ID`, `Frage`, `Auswirkung`, `Empfehlung`, `Entscheiderrolle` und `spätestem Entscheidungspunkt`.

Triff keine Produkt-, Datenschutz-, Kosten- oder Cloudflare-Limitaussagen aus dem Bauch. Wenn eine aktuelle externe Information erforderlich ist, recherchiere sie mit seriöser Primärquelle, nenne URL und Abrufdatum oder markiere den Punkt als offen.

## 9. Arbeitsweise und Abschlussqualität

Gehe in dieser Reihenfolge vor:

1. relevante Quellen und vorhandenen Code lesen;
2. kurzen Arbeitsplan mit Scope, Entscheidungen und Zieldateien darstellen;
3. Befunde und Widersprüche festhalten, dann Architektur entscheiden;
4. Dokumente erstellen und Querverweise sowie Traceability vervollständigen;
5. das Ergebnis gegen die folgenden Kriterien selbst prüfen und erkannte Lücken schließen.

Das Refinement ist erst abgeschlossen, wenn:

- die zentrale Komponentenentscheidung eindeutig und nachvollziehbar begründet ist;
- MVP und Nicht-Ziele ohne Interpretationsspielraum abgegrenzt sind;
- Datenhoheit, Contentrevisionen, Session-Scopes, Lifecycle, Medien- und Cachegrenzen konsistent beschrieben sind;
- bestehende Contracts und Ist-Implementierung berücksichtigt und Breaking Changes versioniert sind;
- jede MVP-Story messbare Akzeptanzkriterien sowie mindestens einen Testfall und Testdatenbezug besitzt;
- die Traceability keine unbegründeten Lücken enthält und Blocker sichtbar sind;
- Annahmen, offene Entscheidungen und Widersprüche nicht als Tatsachen formuliert sind;
- alle relativen Datei- und Dokumentverweise geprüft wurden;
- keine Platzhalter, doppelten Story-IDs, widersprüchlichen Statusangaben, echten Secrets oder personenbezogenen Testdaten enthalten sind;
- `git diff --check` ohne Befund für die erstellten Dokumente ausgeführt wurde und der abschließende Diff nur den vorgesehenen Dokumentationsumfang enthält.

Führe keine Code-, Test- oder Deploymentbefehle als vermeintlichen Implementierungsnachweis aus, solange ausschließlich Dokumente geplant beziehungsweise erstellt werden. Dokumentationsprüfung und tatsächlich ausgeführte Checks sind im Abschlussbericht getrennt auszuweisen.

Schließe mit einer kurzen Zusammenfassung ab: erstellte Dateien, zentrale Architekturentscheidung, MVP-Umfang, wichtigste Blocker/offene Entscheidungen und tatsächlich durchgeführte Validierungen.
