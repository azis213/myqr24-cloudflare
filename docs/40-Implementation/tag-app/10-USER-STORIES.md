# TAG-App User Stories und Akzeptanzkriterien

**Geltungsbereich:** Öffentliche TAG-App, spätere Application API und zugehörige PWA-Feature-Flows.  
**Nicht enthalten:** Scan-Kryptografie, Range-Auflösung und Routing-KV; diese gehören zum [Edge Router](../edge-router/10-USER-STORIES.md).

## Prioritäten und Iterationen

| Priorität | Bedeutung |
| --- | --- |
| P0 | Voraussetzung für sicheren öffentlichen Staging- oder Produktbetrieb |
| P1 | Kernfunktion des jeweiligen TAG-Features |
| P2 | geplanter Ausbau nach dem Kernfluss |

---

## Epic A — Öffentlicher Scan-Einstieg und PWA-Fundament

### APP-US-001 — Öffentliche TAG-Zielroute öffnen

**Priorität:** P0  
**Iteration:** APP-I01  
**Status:** implemented

**Als** NFC-/QR-Tag-Nutzer  
**möchte ich** nach einem Scan eine öffentliche TAG-Zielroute öffnen,  
**damit** ich den für das TAG freigegebenen Inhalt sehen kann.

#### Akzeptanzkriterien

- Die App unterstützt die öffentliche Route `/tag/{tagId}`.
- Die UI verwendet die `tagId` nur als Eingabe für den öffentlichen View-Adapter beziehungsweise später die API.
- Die App entscheidet weder Range, Feature noch Redirect-Ziel.
- Die App enthält keine Router-Secrets, HMAC- oder Feistel-Implementierung.
- Die öffentliche Route ist über den stabilen Staging-Pages-Alias erreichbar.

### APP-US-002 — Direkte TAG-Deep-Links auf Pages öffnen

**Priorität:** P0  
**Iteration:** APP-I01  
**Status:** implemented

**Als** TAG-Nutzer  
**möchte ich** eine öffentliche TAG-URL direkt oder nach einem Browser-Neustart öffnen,  
**damit** ich nicht von einer bereits geladenen Startseite abhängig bin.

#### Akzeptanzkriterien

- Ein direkter GET auf `/tag/{tagId}` liefert die React-App-Shell statt eines Pages-`404`.
- React Router verarbeitet die Zielroute nach dem Laden der Shell.
- Der Fallback ist auf öffentliche TAG-Routen beschränkt oder bewusst dokumentiert erweitert.
- Nicht definierte Client-Routen führen kontrolliert auf die Staging-Startseite zurück.
- Der direkte Aufruf wird auf Cloudflare Pages getestet.

### APP-US-003 — Öffentliche Tag-View-Daten über einen Adapter laden

**Priorität:** P0  
**Iteration:** APP-I01, APP-I03  
**Status:** implemented

**Als** Entwickler  
**möchte ich** die öffentliche TAG-Ansicht über einen klaren Datenadapter laden,  
**damit** lokale Staging-Fixtures später ohne UI-Neuentwurf durch die Application API ersetzt werden können.

#### Akzeptanzkriterien

- Die UI ruft keine Fixture-Daten direkt aus View-Komponenten ab.
- `getPublicTagView(tagId)` bildet die einzige Datenzugriffsgrenze der öffentlichen Vault-Ansicht.
- Der Adapter normalisiert Tag-IDs konsistent.
- Der aktuelle Adapter liefert ausschließlich versionierte, nicht sensible Fixtures.
- Die spätere API-Ablösung verwendet `GET /api/v1/tags/{tagId}/view` und erhält den `PublicTagView`-Vertrag.
- Die API bleibt die Autorität für Existenz, Sichtbarkeit und öffentliche Inhalte.

### APP-US-004 — Nicht verfügbare öffentliche TAGs fail-closed darstellen

**Priorität:** P0  
**Iteration:** APP-I01, APP-I03  
**Status:** implemented

**Als** Sicherheitsverantwortlicher  
**möchte ich** bei ungültigen, unbekannten oder nicht öffentlichen TAGs keine Ersatzinhalte sehen,  
**damit** die UI keine Informationen über nicht freigegebene Inhalte preisgibt.

#### Akzeptanzkriterien

- Der Fixture-Adapter akzeptiert nur 6- oder 8-stellige Base36-IDs.
- Ungültige und unbekannte IDs führen zu einer neutralen Nicht-verfügbar-Ansicht.
- Die UI zeigt keine Details anderer Tags und keine automatisch gewählten Fallback-Fixtures.
- Unerwartete Ladefehler liefern keine internen Fehlerdetails.
- Die spätere API unterscheidet öffentlich nicht detailliert zwischen nicht vorhanden, gesperrt und nicht freigegeben, sofern keine berechtigte Session vorliegt.

### APP-US-005 — Öffentliche PWA-App-Shell installieren und offline starten

**Priorität:** P1  
**Iteration:** APP-I01  
**Status:** implemented

**Als** wiederkehrender TAG-Nutzer  
**möchte ich** die öffentliche App-Shell als PWA installieren und bei Netzausfall starten können,  
**damit** die Grundoberfläche verfügbar bleibt, ohne private Daten offline zu speichern.

#### Akzeptanzkriterien

- Produktionsbuilds liefern Manifest, Icon und Service Worker aus.
- Der Service Worker speichert nur die definierte öffentliche App-Shell.
- Navigationen verwenden bei Netzausfall einen Shell-Fallback.
- `/api/`-Antworten, Sitzungen, private Medien, dynamische Statusdaten und nicht-GET-Requests werden nicht persistent gecacht.
- Alte Shell-Caches werden bei einer Cache-Version bereinigt.
- Die Offline-Shell suggeriert nicht, dass ein nicht geladenes TAG erfolgreich aufgelöst wurde.

### APP-US-006 — Router→PWA-Staging-Übergang prüfen

**Priorität:** P0  
**Iteration:** APP-I02  
**Status:** blocked

**Als** Staging-Prüfer  
**möchte ich** einen gültigen Scan vom Edge Router bis zur TAG-App testen,  
**damit** die vollständige öffentliche Teststrecke verifiziert ist.

#### Akzeptanzkriterien

- Ein gültiger nicht produktiver Staging-Tag unter `/t/{tagId}` oder `/t1/{tagId}` liefert vom aktiven Scan-Host einen `302`.
- Der Staging-Nachweis verwendet die öffentliche achtstellige Fixture `stagv001`; das Redirect-Ziel enthält dieselbe Tag-ID in `/tag/stagv001`.
- Der Browser rendert anschließend die öffentliche TAG-App-Ansicht.
- Falsche Pfade und syntaktisch ungültige IDs bleiben am Router fail-closed.
- Die aktive Worker-/KV-Konfiguration ist vor jeder Redirect-Änderung identifiziert.
- Der Test verwendet keine realen Kundendaten, Secrets oder produktiven Tags.

---

## Epic B — Öffentlicher TAG Vault

### APP-US-010 — Öffentlichen Vault-Inhalt ansehen

**Priorität:** P0  
**Iteration:** APP-I01, APP-I03  
**Status:** implemented

**Als** TAG-Nutzer  
**möchte ich** die freigegebene öffentliche Vault-Ansicht eines TAGs sehen,  
**damit** ich die zugehörige Information nach dem Scan nutzen kann.

#### Akzeptanzkriterien

- Ein veröffentlichter `PublicTagView` zeigt Tag-Kontext, Vault-Inhalt und aktivierte öffentliche Features.
- Die Ansicht besitzt explizite Lade- und Fehlerzustände.
- Die Darstellung nutzt nur öffentliche Daten aus dem View-Vertrag.
- Private Owner-, Empfänger-, Sitzungs- oder Verwaltungsdaten erscheinen nicht.
- Nach APP-I03 liefert die API die Sichtbarkeit serverseitig autorisiert.

### APP-US-011 — Typisierte öffentliche Vault-Blöcke sicher rendern

**Priorität:** P0  
**Iteration:** APP-I01, APP-I03  
**Status:** implemented

**Als** Content-Verantwortlicher  
**möchte ich** freigegebene Vault-Inhalte als klar definierte Blöcke darstellen,  
**damit** Inhalte konsistent und ohne frei ausführbares HTML erscheinen.

#### Akzeptanzkriterien

- Unterstützte Blocktypen sind mindestens `hero`, `text`, `callout`, `gallery` und `external-link`.
- Der Renderer verarbeitet nur den typisierten `VaultBlock`-Vertrag.
- Es wird kein ungeprüftes HTML per `dangerouslySetInnerHTML` ausgegeben.
- Bilder besitzen einen passenden Alt-Text oder sind bewusst dekorativ markiert.
- Neue Blocktypen benötigen Typdefinition, sicheren Renderer, Tests und Traceability.

### APP-US-012 — Öffentliche Galerie und Medien zugänglich anzeigen

**Priorität:** P1  
**Iteration:** APP-I03  
**Status:** planned

**Als** TAG-Nutzer  
**möchte ich** veröffentlichte Bilder und später weitere Medien zugänglich ansehen,  
**damit** ich den öffentlichen Vault-Inhalt vollständig nutzen kann.

#### Akzeptanzkriterien

- Öffentliche Medien besitzen serverseitig geprüfte URLs, MIME-Typen und Sichtbarkeit.
- Bildinhalte haben beschreibende Alt-Texte; Beschriftungen werden optional angezeigt.
- Öffentliche immutable Medien dürfen versioniert über CDN cachen.
- Private oder zeitlich freigegebene Medien werden ausschließlich über autorisierte API-Auslieferung mit `no-store` bereitgestellt.
- Fehlerhafte Medien verhindern weder die TAG-Seite noch die Sichtbarkeitsprüfung.

### APP-US-013 — Freigegebene externe Links sicher öffnen

**Priorität:** P1  
**Iteration:** APP-I01, APP-I03  
**Status:** implemented

**Als** TAG-Nutzer  
**möchte ich** freigegebene externe Inhalte gezielt öffnen,  
**damit** ich weiterführende Informationen aufrufen kann.

#### Akzeptanzkriterien

- Externe Links werden als explizite Vault-Blöcke dargestellt.
- Sie öffnen in einem neuen Kontext mit `rel="noreferrer"`.
- Die spätere API erlaubt nur serverseitig geprüfte, zulässige URL-Protokolle.
- Ein externer Link übernimmt keine nutzergesteuerten Redirect-Ziele.
- Nicht erlaubte oder fehlerhafte URLs werden nicht gerendert.

### APP-US-014 — Öffentliche Sichtbarkeit serverseitig durchsetzen

**Priorität:** P0  
**Iteration:** APP-I03  
**Status:** planned

**Als** Content-Eigentümer  
**möchte ich** festlegen können, welche Inhalte öffentlich sichtbar sind,  
**damit** private oder nicht veröffentlichte Inhalte nicht über die TAG-App erreichbar sind.

#### Akzeptanzkriterien

- Die Application API prüft Tag-Existenz und Sichtbarkeit bei jedem öffentlichen View-Request.
- Der Browser erhält nur bereits autorisierte öffentliche Felder und Medienreferenzen.
- UI-Ausblendungen oder lokale Feature-Flags ersetzen keine API-Prüfung.
- Nicht öffentliche Inhalte sind nicht über erratene API- oder Asset-URLs abrufbar.
- Tests decken veröffentlicht, nicht veröffentlicht, widerrufen und unbekannt ab.

### APP-US-015 — Öffentliche Inhalte cache-sicher widerrufen

**Priorität:** P0  
**Iteration:** APP-I03  
**Status:** planned

**Als** Content-Eigentümer  
**möchte ich** eine Veröffentlichung widerrufen können,  
**damit** entfernte Inhalte nicht unnötig lange über Browser- oder CDN-Caches sichtbar bleiben.

#### Akzeptanzkriterien

- Dynamische öffentliche View-Antworten verwenden eine dokumentierte kurze TTL oder gezielte Invalidierung.
- Widerrufene Inhalte werden von der API nicht mehr ausgeliefert.
- Private oder dynamische Antworten verwenden `Cache-Control: no-store`.
- Öffentliche immutable Medien verwenden versionierte Keys; ein Widerruf erzeugt keinen stillen Reuse desselben Keys.
- Tests prüfen mindestens API-Header und das Verhalten nach Sichtbarkeitswechsel.

---

## Epic C — Öffentlicher TAG-Claim

### APP-US-016 — TAG nach Scan mit Claim-Secret übernehmen

**Priorität:** P0  
**Iteration:** APP-I03  
**Status:** planned

**Als** berechtigte Person mit einem noch claimbaren TAG  
**möchte ich** den TAG nach dem Scan in der TAG-App mit meinem Claim-Secret übernehmen,  
**damit** der normale Claim ohne Verwaltungsoberfläche durchgeführt werden kann.

#### Akzeptanzkriterien

- Die Claim-Aktion wird nur angezeigt, wenn die aktuelle serverseitig gelieferte Capability sie erlaubt.
- Die TAG-App sendet `tagId` und das eingegebene Claim-Secret ausschließlich per HTTPS an den vorgesehenen öffentlichen Claim-Endpunkt der Control Plane.
- Die Control Plane entscheidet allein über Credential-Prüfung, Pool-/Produktpolicy, Lockout, Rate Limit, atomare Owner-Zuordnung und Verbrauch.
- Das Eingabefeld nutzt einen geeigneten geheimen Eingabetyp, wird nach jedem Request geleert und wird weder in Local Storage, Session Storage, URL, Service-Worker-Cache, Telemetrie noch Fehlermeldungen gespeichert.
- Die öffentliche UI zeigt ausschließlich neutrale Erfolgs-, Sperr- oder Nichtverfügbarhinweise und keine Hashes, Fehlversuchszähler, Ownerdaten, Pooldetails oder Credentialregeln.
- Der Claim ist nach erfolgreicher serverseitiger Antwort im aktualisierten Capability-/View-Zustand nachvollziehbar; die App erzeugt keine lokale Besitzannahme.

### APP-US-017 — Claim-Probleme datensparsam behandeln

**Priorität:** P0  
**Iteration:** APP-I03  
**Status:** planned

**Als** TAG-Nutzer  
**möchte ich** bei einem nicht erfolgreichen Claim einen verständlichen, aber datensparsamen Hinweis erhalten,  
**damit** ich den Vorgang sicher wiederholen oder Support nutzen kann, ohne interne Informationen zu erhalten.

#### Akzeptanzkriterien

- Fehlerantworten unterscheiden öffentlich nicht zwischen unbekanntem, bereits geclaimtem, gesperrtem oder nicht claimbarem TAG, sofern die Policy keinen ausdrücklichen sicheren Hinweis erlaubt.
- Die UI schützt vor Mehrfachklicks während eines laufenden Requests und behandelt Netzwerkfehler ohne erneute lokale Credential-Verwendung.
- Eine Support-Option verweist nur auf einen dokumentierten Kontakt- bzw. Supportweg und übermittelt weder Claim-Secret noch private Claim-Details.
- Die PWA speichert keine fehlgeschlagenen Claim-Eingaben und keine öffentlichen Claim-Responses dauerhaft offline.
- Wiederholte Claim-Versuche werden von der UI nicht als erfolgreich dargestellt, bevor die Control Plane dies bestätigt.

## Epic D — Owner- und Inhaltsverwaltung

### APP-US-020 — Als Owner TAG-Inhalte sicher verwalten

**Priorität:** P0  
**Iteration:** APP-I04  
**Status:** planned

**Als** TAG-Owner  
**möchte ich** mich sicher für die Verwaltung meines TAGs authentisieren,  
**damit** nur Berechtigte Inhalte und Einstellungen ändern können.

#### Akzeptanzkriterien

- Owner-Aktionen erfordern entweder eine serverseitig zugeordnete Account-Owner-Session oder eine TAG-gebundene Owner-Passphrase-Freigabe.
- Eine Owner-Passphrase ist vom Claim-Secret und einer Besucher-PIN getrennt; sie wird nur als langsamer, gesalzener Hash gespeichert und niemals im Klartext.
- Erfolgreiche Owner-Passphrase-Prüfung erzeugt ausschließlich eine kurzlebige, TAG-gebundene `HttpOnly`, `Secure`, `SameSite=Strict`-Session.
- Rate Limits, progressive Sperren, neutrale Fehlerantworten und geeigneter CSRF-Schutz gelten für jeden Owner-Flow.
- Die PWA speichert weder Owner-Passphrase noch langlebige Owner-Tokens im Local Storage.
- Eine lokale oder kontogebundene Lese-Collection ist kein Berechtigungsnachweis; jede Änderungsanfrage wird serverseitig erneut gegen die Owner-Zuordnung geprüft.

### APP-US-021 — Öffentliche Vault-Inhalte erstellen und ändern

**Priorität:** P1  
**Iteration:** APP-I04  
**Status:** planned

**Als** TAG-Owner  
**möchte ich** öffentliche Vault-Blöcke anlegen und bearbeiten,  
**damit** die TAG-Ansicht aktuelle Inhalte zeigt.

#### Akzeptanzkriterien

- Änderungen werden über eine autorisierte API validiert und persistiert.
- Jede Blockart wird serverseitig gegen ihr Schema validiert.
- Unzulässiges HTML, Skripte und nicht erlaubte URLs werden abgewiesen oder sicher neutralisiert.
- Erfolgreiche Änderungen erscheinen erst nach expliziter Sichtbarkeitsentscheidung.
- Die Änderung ist nachvollziehbar auditierbar.

### APP-US-022 — Sichtbarkeit von Vault-Inhalten steuern

**Priorität:** P0  
**Iteration:** APP-I04  
**Status:** planned

**Als** TAG-Owner  
**möchte ich** Inhalte als öffentlich, privat oder nicht veröffentlicht markieren,  
**damit** die gewünschte Zielgruppe korrekt geschützt wird.

#### Akzeptanzkriterien

- Sichtbarkeitsstatus sind serverseitig modelliert und autorisiert.
- Der öffentliche View enthält ausschließlich öffentliche Inhalte.
- Private Inhalte werden nur über einen gesonderten, autorisierten Flow geliefert.
- Ein Sichtbarkeitswechsel löst die Regeln aus APP-US-015 aus.
- Änderungen werden mit Zeit, Akteur und Zielobjekt auditiert.

### APP-US-023 — Öffentliche Medien hochladen und veröffentlichen

**Priorität:** P1  
**Iteration:** APP-I04, APP-I06  
**Status:** planned

**Als** TAG-Owner  
**möchte ich** zugelassene Medien hochladen und veröffentlichen,  
**damit** ich Vault-Inhalte mit Bildern, Audio oder Dokumenten ergänzen kann.

#### Akzeptanzkriterien

- Uploads benötigen eine autorisierte, kurzlebige Upload-Berechtigung.
- API und nachgelagerte Verarbeitung prüfen Größe, Dateisignatur und tatsächlichen MIME-Typ.
- Roh-Uploads werden erst nach erfolgreicher Prüfung als verwendbar markiert.
- Öffentliche Assets erhalten versionierte Objekt-Keys; private Objekte werden nicht direkt über öffentliche R2-URLs ausgeliefert.
- Fehlerhafte oder quarantänisierte Uploads erscheinen nicht im öffentlichen View.

### APP-US-024 — Private Inhalte freigeben und widerrufen

**Priorität:** P2  
**Iteration:** APP-I04  
**Status:** planned

**Als** TAG-Owner  
**möchte ich** private Inhalte gezielt und zeitlich begrenzt freigeben oder widerrufen,  
**damit** sensible Informationen nur berechtigte Empfänger erreichen.

#### Akzeptanzkriterien

- Freigaben werden serverseitig an Empfänger, Zeitfenster und gegebenenfalls Einmalnutzung gebunden.
- Private Daten und Streams liefern `Cache-Control: no-store`.
- Widerruf beendet künftige Zugriffe unverzüglich nach API-Prüfung.
- Einmalnutzungen werden atomar durchgesetzt.
- Freigabe, Zugriff und Widerruf erzeugen Audit-Ereignisse.

### APP-US-026 — Gast- und Owner-Zugang serverseitig trennen

**Priorität:** P0  
**Iteration:** APP-I04  
**Status:** planned

**Als** TAG-Owner  
**möchte ich** einen von meinem Owner-Zugang getrennten Gastzugang konfigurieren,  
**damit** Gäste nur begrenzte eigene Beiträge verwalten können und niemals Owner-Rechte erhalten.

#### Akzeptanzkriterien

- Owner- und Gastcode werden als getrennte langsame Hashes gespeichert und serverseitig mit derselben dokumentierten Formatpolicy geprüft.
- Der Client übermittelt den eingegebenen Code ausschließlich an den vorgesehenen HTTPS-Endpunkt, leert das Feld anschließend und speichert keine Codes, Hashes oder langlebigen Rollen-Tokens.
- Erfolgreiche Anmeldung erzeugt eine rollenbezogene, kurzlebige `HttpOnly`, `Secure`, `SameSite=Strict`-Session.
- Eine Gast-Session kann nur eigene, durch ihre serverseitige Session-ID gebundene Beiträge anlegen, bearbeiten oder soft löschen.
- Gast-Requests dürfen weder private Owner-Inhalte lesen noch Sichtbarkeit, Freigaben, Zugangscodes, Sessions, Limits oder fremde Gastbeiträge verändern.
- Formatfehler, falscher Code, abgelaufene Session und falsche Rolle liefern nach außen keine Detailinformation über Vault oder Berechtigung.
- Die bekannte Staging-Konfiguration nutzt getrennte externe Gast-/Owner-Seeds; ihre Klartextwerte sind nicht Bestandteil von Source, Tests, Build-Artefakten oder Evidenz.

### APP-US-025 — Sicherheitsrelevante Änderungen auditieren

**Priorität:** P1  
**Iteration:** APP-I04  
**Status:** planned

**Als** Betreiber  
**möchte ich** sicherheitsrelevante TAG- und Inhaltsänderungen nachvollziehen,  
**damit** ich Missbrauch, Fehler und Widerrufe untersuchen kann.

#### Akzeptanzkriterien

- Owner-Login, Sichtbarkeitswechsel, Freigabe, Widerruf, Upload-Status und Moderation erzeugen strukturierte Audit-Ereignisse.
- Audit-Ereignisse enthalten keine Secrets und keine unnötigen privaten Inhaltskopien.
- Zugriffsrechte auf Audit-Daten sind serverseitig eingeschränkt.
- Tests prüfen die Entstehung zentraler Ereignisse.

---

## Epic E — TAG Chat und Lost & Found

### APP-US-030 — Lost-&-Found-Status erkennen

**Priorität:** P0  
**Iteration:** APP-I05  
**Status:** planned

**Als** Finder  
**möchte ich** erkennen, ob ein TAG als verloren markiert ist,  
**damit** ich den passenden Rückgabeprozess starten kann.

#### Akzeptanzkriterien

- Die API liefert nur den für Finder erlaubten Lost-&-Found-Status.
- Persönliche Owner-Daten werden nicht allein durch den Lost-Status offengelegt.
- Die öffentliche UI zeigt eine klare, nicht irreführende Handlungsoption.
- Nicht verlorene oder deaktivierte Tags aktivieren keinen Lost-&-Found-Flow.

### APP-US-031 — Als Finder eine geschützte Nachricht senden

**Priorität:** P0  
**Iteration:** APP-I05  
**Status:** planned

**Als** Finder  
**möchte ich** dem Owner eine Nachricht senden können,  
**damit** die Rückgabe möglich wird, ohne private Kontaktdaten offenzulegen.

#### Akzeptanzkriterien

- Das Senden erfolgt nur über eine serverseitig autorisierte Chat-/Lost-&-Found-API.
- Der Flow verlangt geeignete Abuse-Schutzmaßnahmen, einschließlich Rate Limit und gegebenenfalls Turnstile.
- Nachrichten werden serverseitig validiert, begrenzt und als nicht öffentlich behandelt.
- Die PWA cacht Nachrichten oder Threads nicht persistent.
- Fehler geben keine Owner- oder Thread-Existenzdetails preis.

### APP-US-032 — Als Owner Finder-Threads bearbeiten

**Priorität:** P1  
**Iteration:** APP-I05  
**Status:** planned

**Als** Owner  
**möchte ich** einen Finder-Thread lesen und beantworten,  
**damit** ich die Rückgabe koordinieren kann.

#### Akzeptanzkriterien

- Ein Thread ist ausschließlich nach gültiger Owner-Session für das zugehörige TAG erreichbar.
- Schreibende Aktionen prüfen CSRF, Autorisierung und Rate Limits serverseitig.
- Threads und Nachrichten liefern `no-store`.
- Owner kann einen Fall sicher schließen oder blockieren.
- Audit protokolliert relevante Zustandswechsel.

### APP-US-033 — Chat serverseitig nach Feature- und Lost-Status sperren

**Priorität:** P0  
**Iteration:** APP-I05  
**Status:** planned

**Als** Sicherheitsverantwortlicher  
**möchte ich** Chat-Funktionen serverseitig anhand ihres Status steuern,  
**damit** sie nicht durch manipulierte UI-Requests aktiv bleiben.

#### Akzeptanzkriterien

- Die API prüft Feature-Aktivierung und erforderlichen Lost-&-Found-Status bei jedem Request.
- Ein deaktivierter, geschlossener oder nicht verlorener Fall blockiert neue Finder-Nachrichten.
- Direkte API-Aufrufe umgehen die Sperre nicht.
- Tests decken aktiv, deaktiviert, verloren, nicht verloren und geschlossen ab.

### APP-US-034 — Nachrichten moderieren, sperren oder löschen

**Priorität:** P2  
**Iteration:** APP-I05  
**Status:** planned

**Als** berechtigter Owner oder Moderator  
**möchte ich unangemessene Nachrichten behandeln können,  
**damit** der Kommunikationskanal sicher bleibt.

#### Akzeptanzkriterien

- Moderationsaktionen erfordern eine autorisierte Rolle.
- Gelöschte oder gesperrte Inhalte sind für unberechtigte Nutzer nicht mehr abrufbar.
- Die Aktion wird auditiert.
- Aufbewahrung und Löschung folgen einer dokumentierten Datenschutzregel.

### APP-US-035 — Chat- und Finder-Daten nicht persistent cachen

**Priorität:** P0  
**Iteration:** APP-I05  
**Status:** planned

**Als** Datenschutzverantwortlicher  
**möchte ich** verhindern, dass Chat- und Finder-Daten im Browser dauerhaft gespeichert werden,  
**damit** private Kommunikation nicht über App-Caches offengelegt wird.

#### Akzeptanzkriterien

- API-Antworten für Threads, Nachrichten und Finder-Status verwenden `Cache-Control: no-store`.
- Der Service Worker behandelt diese Endpunkte nicht mit `Cache Storage`.
- Browser- und Service-Worker-Tests prüfen das Nicht-Caching.
- Keine privaten Nachrichtentexte erscheinen in öffentlichen Fehler-, Telemetrie- oder Evidenzdaten.

---

## Epic F — TAG Guestbook

### APP-US-040 — Ein offenes Guestbook erkennen

**Priorität:** P1  
**Iteration:** APP-I06  
**Status:** planned

**Als** Besucher  
**möchte ich** erkennen, ob für ein TAG ein Guestbook geöffnet ist,  
**damit** ich nur dann einen Beitrag plane, wenn dies erlaubt ist.

#### Akzeptanzkriterien

- Die API liefert für Besucher nur den zulässigen Guestbook-Status und die notwendigen öffentlichen Hinweise.
- Geschlossene oder nicht aktivierte Guestbooks bieten keine Einreichungsaktion.
- Die UI zeigt keinen Owner-internen Moderations- oder Planungsstatus.

### APP-US-041 — Beitrag innerhalb eines erlaubten Zeitfensters einreichen

**Priorität:** P1  
**Iteration:** APP-I06  
**Status:** planned

**Als** Besucher  
**möchte ich** innerhalb eines offenen Zeitfensters einen Beitrag einreichen,  
**damit** ich eine Erinnerung oder einen Kommentar hinterlassen kann.

#### Akzeptanzkriterien

- Zeitfenster, Feature-Status, Eingabegrenzen und Abuse-Schutz werden serverseitig geprüft.
- Der Beitrag ist standardmäßig nicht automatisch öffentlich, sofern keine explizite Policy dies erlaubt.
- Inhalte werden gegen ihr Schema validiert; aktive Inhalte oder unzulässige Uploads werden abgewiesen.
- Die API liefert keine Detailinformationen über nicht erlaubte Einreichungen.
- Der Ablauf besitzt Tests für offen, geschlossen, vor Beginn und nach Ende.

### APP-US-042 — Beiträge moderieren und veröffentlichen

**Priorität:** P1  
**Iteration:** APP-I06  
**Status:** planned

**Als** Owner  
**möchte ich eingereichte Beiträge moderieren und veröffentlichen,  
**damit** nur passende Inhalte sichtbar werden.

#### Akzeptanzkriterien

- Moderation erfordert eine autorisierte Owner- oder Moderator-Session.
- Freigabe, Ablehnung und Löschung sind serverseitig valide Zustandswechsel.
- Nur veröffentlichte Beiträge gehen in öffentliche Views ein.
- Moderationsentscheidungen sind auditierbar.
- Private Rohbeiträge werden nicht öffentlich gecacht.

### APP-US-043 — Nur freigegebene Beiträge öffentlich anzeigen

**Priorität:** P0  
**Iteration:** APP-I06  
**Status:** planned

**Als** Besucher  
**möchte ich nur veröffentlichte Guestbook-Beiträge sehen,  
**damit** private oder abgelehnte Einreichungen geschützt bleiben.

#### Akzeptanzkriterien

- Die öffentliche API liefert ausschließlich veröffentlichte Beiträge.
- Manipulierte Client-Parameter können keine Roh- oder Moderationsdaten anfordern.
- Öffentliche Beiträge entsprechen einem sicheren, typisierten View-Vertrag.
- Tests decken pending, rejected, deleted und published ab.

### APP-US-044 — Guestbook-Zeitfenster serverseitig erzwingen

**Priorität:** P0  
**Iteration:** APP-I06  
**Status:** planned

**Als** Betreiber  
**möchte ich** Guestbook-Zeitfenster serverseitig erzwingen,  
**damit** Clientzeit oder UI-Manipulation keinen Beitrag außerhalb der Policy ermöglichen.

#### Akzeptanzkriterien

- Die API verwendet eine autoritative Serverzeit.
- Einreichungen außerhalb des Fensters werden abgelehnt.
- Wiederholte und parallele Einreichungen unterliegen Rate Limits und konsistenter Statusprüfung.
- Tests verwenden kontrollierte Zeitwerte für die Grenzfälle.

---

## Epic G — TAG Check-ins, Collections und Campaigns

### APP-US-050 — Check-in nach expliziter Standortfreigabe starten

**Priorität:** P1  
**Iteration:** APP-I07  
**Status:** planned

**Als** Besucher  
**möchte ich meinen Standort nur bewusst für einen TAG-Check-in freigeben,  
**damit** keine Standortdaten ohne meine Zustimmung verarbeitet werden.

#### Akzeptanzkriterien

- Die UI fragt Standortdaten erst nach einer expliziten Nutzeraktion an.
- Vor der Freigabe wird Zweck, Umfang und mögliche Offline-Synchronisation erklärt.
- Eine verweigerte Freigabe führt zu keiner stillen Alternativortung.
- Rohstandorte werden weder in öffentlichen Ansichten noch im Cache Storage gespeichert.

### APP-US-051 — GeoFence-Check-in serverseitig validieren

**Priorität:** P0  
**Iteration:** APP-I07  
**Status:** planned

**Als** Betreiber  
**möchte ich** einen Check-in gegen den aktuellen GeoFence serverseitig prüfen,  
**damit** ein Besuch nicht allein durch manipulierte Clientdaten akzeptiert wird.

#### Akzeptanzkriterien

- Die API prüft TAG, GeoFence-Version, Distanz, GPS-Genauigkeit, Zeitplausibilität und Session-Policy serverseitig.
- Ein Client kann keinen akzeptierten Check-in allein lokal erzeugen.
- Akzeptierte Ereignisse enthalten eine überprüfbare Serverentscheidung und bleiben append-only.
- Tests decken innerhalb/außerhalb des Radius, ungenaue Position und ungültige Zeit ab.

### APP-US-052 — Offline erfasste Check-ins sicher synchronisieren

**Priorität:** P1  
**Iteration:** APP-I07  
**Status:** planned

**Als** Besucher  
**möchte ich** einen bei schlechter Verbindung vorbereiteten Check-in später synchronisieren,  
**damit** mein Besuch nachvollziehbar verarbeitet werden kann.

#### Akzeptanzkriterien

- Ausstehende Check-in-Ereignisse werden nur in einer dafür vorgesehenen, begrenzten lokalen Struktur gehalten.
- Die API prüft beim Synchronisieren Alter, Zeitplausibilität, Idempotenz, Session und GeoFence erneut.
- Cache Storage enthält keine Rohstandorte und keine akzeptierten privaten Check-in-Views.
- Der Nutzer erhält eine klare Rückmeldung über ausstehend, akzeptiert, abgelehnt oder abgelaufen.
- Tests decken Offline-Alter, doppelte Übermittlung und spätere Präzisionsverbesserung ab.

### APP-US-053 — Eigene Check-ins als Collection sehen

**Priorität:** P1  
**Iteration:** APP-I07  
**Status:** planned

**Als** angemeldeter Besucher  
**möchte ich** meine akzeptierten Check-ins als persönliche Collection sehen,  
**damit** ich besuchte Orte nachvollziehen kann.

#### Akzeptanzkriterien

- Collections sind nur mit berechtigter Besucher-Session verfügbar.
- Die API liefert ausschließlich die eigene Projektion.
- Aggregation und Zeitfenster werden serverseitig bestimmt.
- Antworten mit personenbezogenem Verlauf verwenden `no-store`.
- Öffentliche TAG-Views enthalten keine persönlichen Collection-Daten.

### APP-US-054 — Campaign-Fortschritt und Credits erhalten

**Priorität:** P1  
**Iteration:** APP-I07  
**Status:** planned

**Als** berechtigter Besucher  
**möchte ich** für gültige Check-ins Campaign-Credits und Fortschritt erhalten,  
**damit** ich an freigegebenen Challenges teilnehmen kann.

#### Akzeptanzkriterien

- Campaign-Eligibility und Fortschritt werden serverseitig bestimmt.
- Credits referenzieren einen akzeptierten Check-in und eine Campaign-Policy.
- Der Client kann weder Credits noch Rewards selbst erzeugen.
- Fortschrittsdaten sind nur für die berechtigte Session sichtbar.
- Tests decken gültige, nicht teilnahmeberechtigte und bereits bewertete Check-ins ab.

### APP-US-055 — Doppelte oder manipulierte Credits verhindern

**Priorität:** P0  
**Iteration:** APP-I07  
**Status:** planned

**Als** Betreiber  
**möchte ich** doppelte oder manipulierte Campaign-Credits verhindern,  
**damit** Rewards fachlich korrekt vergeben werden.

#### Akzeptanzkriterien

- Der Credit-Fluss ist pro Ereignis und Campaign idempotent.
- Parallele Requests erzeugen höchstens einen Credit beziehungsweise Reward.
- Die notwendige Atomizität wird durch Transaktion oder gezielten Durable-Object-Einsatz erzwungen.
- Audit und Tests belegen Deduplizierung, parallele Requests und abgelehnte Manipulationsversuche.

### APP-US-056 — Präzise Standortdaten schützen

**Priorität:** P0  
**Iteration:** APP-I07  
**Status:** planned

**Als** Datenschutzverantwortlicher  
**möchte ich** präzise Standortdaten minimieren und schützen,  
**damit** sie weder öffentlich noch unnötig dauerhaft offenliegen.

#### Akzeptanzkriterien

- Präzise Standortdaten werden nur nach expliziter Aktion und für den dokumentierten Zweck erhoben.
- Öffentliche Vault-, Guestbook-, Collection- und Campaign-Antworten enthalten keine Rohkoordinaten.
- Speicherung, Retention, Zugriff und Löschung präziser Daten sind dokumentiert und serverseitig durchgesetzt.
- Telemetrie, Evidenz und Fehlermeldungen enthalten keine Rohstandorte.
- Tests prüfen mindestens die Abwesenheit von Koordinaten in öffentlichen Antworten.

---

## Epic H — Startseite, lokale und kontogebundene Collections

### APP-US-070 — TAG-App ohne TAG-ID sinnvoll starten

**Priorität:** P0  
**Iteration:** APP-I02A  
**Status:** planned

**Als** myQR24-Nutzer  
**möchte ich** die TAG-App direkt ohne TAG-ID öffnen können,  
**damit** ich scannen, mich anmelden oder bereits gespeicherte TAGs wiederfinden kann.

#### Akzeptanzkriterien

- Die Route `/` zeigt eine neutrale Startseite mit den Aktionen **TAG scannen**, **Anmelden** und **Meine Collection**.
- Der Start löst weder Kamera-, Standort- noch andere Browserberechtigungen aus.
- Ohne Anmeldung ist eine lokale Collection erreichbar; kontogebundene Einträge verlangen eine serverseitig geprüfte Session.
- Die Startseite behauptet nicht, dass ein TAG gescannt, geclaimt oder vom Nutzer besessen wurde.
- Die PWA-Shell kann offline starten, zeigt aber klar an, wenn aktuelle TAG-Inhalte nicht geladen werden können.

### APP-US-071 — TAG bewusst lokal zur Collection hinzufügen

**Priorität:** P1  
**Iteration:** APP-I02A  
**Status:** planned

**Als** Besucher eines Museums, einer Burg oder eines Ereignisses  
**möchte ich** einen geöffneten TAG bewusst lokal zu meiner Collection hinzufügen,  
**damit** ich ihn später ohne erneuten physischen Scan wiederfinden kann.

#### Akzeptanzkriterien

- Das Hinzufügen ist eine explizite Nutzeraktion; ein Scan oder Direktaufruf erzeugt nicht automatisch eine lokale Historie.
- Ein lokaler Eintrag enthält höchstens `tagId`, Hinzufügezeit, optionalen lokalen Namen und einen nicht autoritativen öffentlichen Anzeige-Snapshot.
- Derselbe TAG wird lokal idempotent nur einmal geführt; der Nutzer kann ihn einzeln oder vollständig löschen.
- Beim Öffnen wird stets der aktuelle öffentliche View neu geladen; ein lokaler Snapshot ersetzt weder Sichtbarkeit noch Content.
- Die UI erklärt, dass Browserdatenlöschung, Gerätewechsel oder private Browserprofile die lokale Collection entfernen können.
- Die lokale Collection verleiht keine Owner-, Upload-, Besucher-PIN- oder sonstige Berechtigung und enthält keine Credentials, Sessions oder private Inhalte.

### APP-US-072 — Lokale Collection nach Anmeldung explizit übernehmen

**Priorität:** P1  
**Iteration:** APP-I03  
**Status:** planned

**Als** angemeldeter Nutzer  
**möchte ich** meine lokale Collection bewusst in mein Konto übernehmen,  
**damit** sie nach Gerätewechsel oder Browserdatenlöschung verfügbar bleibt.

#### Akzeptanzkriterien

- Eine Übernahme verlangt eine aktive serverseitige Account-Session und eine ausdrückliche Bestätigung.
- Die API prüft jede übermittelte `tagId` neu, speichert nur zulässige persönliche Referenzen und behandelt identische Einträge idempotent.
- Geschlossene oder nicht verfügbare TAGs dürfen als persönliche Referenz bestehen bleiben, liefern beim Öffnen aber nur ihren aktuellen neutralen Status.
- Private Views, PIN-Freigaben, Sessions, Ownerrechte und lokale Credentials werden nie übertragen.
- Persönliche Collection-Reads und -Writes liefern `Cache-Control: no-store`; der Service Worker persistiert sie nicht.
- Nach bestätigter Übernahme kann die App anbieten, lokale Einträge zu löschen, ohne sie stillschweigend zu entfernen.

### APP-US-073 — Öffentliche und PIN-geschützte TAG-Aufrufe korrekt trennen

**Priorität:** P0  
**Iteration:** APP-I03  
**Status:** planned

**Als** TAG-Owner und Besucher  
**möchte ich** die öffentliche Erreichbarkeit eines TAGs vom PIN-geschützten Contentzugriff getrennt erleben,  
**damit** eine bekannte URL oder ein Collection-Eintrag keine Freigabe umgeht.

#### Akzeptanzkriterien

- `/tag/{tagId}` kann bei `public` direkt freigegebenen Content anzeigen und bleibt damit ohne komplizierten Share-Link teilbar.
- Bei `closed`, unbekannter oder nicht veröffentlichter Runtime-Projektion zeigt die App eine neutrale Nichtverfügbar-Ansicht.
- Bei `pin-required` zeigt die App nur einen neutralen Freigabe-Einstieg; geschützter Content wird erst nach serverseitiger Prüfung geliefert.
- Besucher-PINs werden ausschließlich transient per HTTPS übermittelt und niemals in URL, Browser-Storage, Service-Worker-Cache, Logs oder Telemetrie gespeichert.
- Ein Sichtbarkeitswechsel wird durch die aktuelle serverseitige Runtime-View wirksam; lokale Collections, URL-Kenntnis oder alte Client-Flags umgehen ihn nicht.
- Ein späterer Share-Link ist eine eigene widerrufbare Capability und nicht Teil des MVP.

## Epic I — Gemeinsame PWA, Scan und Berechtigungssteuerung

Die verbindlichen Architektur- und Datenschutzregeln stehen im [Berechtigungs-, Datenschutz- und Capability-Modell](../../10-Architecture/PWA_PERMISSION_AND_CAPABILITY_MODEL.md). Dieser Epic bereitet die gemeinsame Nutzeroberfläche vor; die Application API bleibt für Rollen, Sichtbarkeit, Capabilities und jede geschützte Aktion autoritativ.

### APP-US-060 — Gemeinsame PWA-Navigation bereitstellen

**Priorität:** P1  
**Iteration:** APP-I02A  
**Status:** planned

**Als** myQR24-Nutzer  
**möchte ich** öffentliche TAG-Inhalte, Scan und meine persönlichen Bereiche in einer gemeinsamen App erreichen,  
**damit** ich nicht zwischen separaten Anwendungen wechseln muss.

#### Akzeptanzkriterien

- Die App führt eine verständliche Hauptnavigation für Start, Scannen, persönliche Inhalte und Konto.
- Öffentliche Routen bleiben ohne Anmeldung erreichbar.
- Ein Scan öffnet unmittelbar den temporären TAG-Kontext `/tag/{tagId}`.
- Die Zurück-Navigation führt zum vorherigen Kontext beziehungsweise Scanner zurück, nicht zwangsläufig zu einer Verwaltungsseite.
- Persönliche und Owner-Routen verlangen später serverseitig geprüfte Sessions; die UI simuliert keine Berechtigung.

### APP-US-061 — MyQR24-TAGs im integrierten Scanner direkt öffnen

**Priorität:** P1  
**Iteration:** APP-I02A  
**Status:** planned

**Als** App-Nutzer  
**möchte ich** einen erkannten myQR24-QR-Code innerhalb der App direkt öffnen,  
**damit** ich für bekannte myQR24-Scan-URLs keinen externen Browser-Redirect bestätigen muss.

#### Akzeptanzkriterien

- Die Kamera wird ausschließlich nach dem bewussten Start der Scan-Funktion angefragt.
- Der Scanner erkennt ausschließlich dokumentierte myQR24-URL-Schemata als internen Navigationskandidaten.
- Ein erkannter zulässiger Kandidat führt zu `/tag/{tagId}`; die spätere API entscheidet weiterhin über View und Aktionen.
- Die App implementiert weder Routing-KV-, Feistel-, HMAC- noch Redirect-Signaturprüfung.
- Unbekannte oder externe Inhalte werden nicht stillschweigend intern geöffnet.
- Ohne Kamera-Recht, Scanner-Unterstützung oder bei Verweigerung existiert ein manueller TAG-ID-/URL-Fallback.

### APP-US-062 — Berechtigungen kontextbezogen und ohne Dialogflut anfragen

**Priorität:** P0  
**Iteration:** APP-I02A  
**Status:** planned

**Als** Datenschutz bewusster Nutzer  
**möchte ich** eine Berechtigung nur dann und mit verständlichem Zweck anfragen lassen, wenn ich eine abhängige Funktion bewusst starte,  
**damit** ich öffentliche Inhalte ohne unnötige Unterbrechung nutzen kann.

#### Akzeptanzkriterien

- Beim App-Start, beim bloßen Scan und beim Öffnen einer öffentlichen TAG-Seite wird kein Kamera-, Standort-, Mikrofon- oder Push-Dialog ausgelöst.
- Vor komplexen Systemanfragen bietet die App „Jetzt verwenden“, „Für diese Funktion merken“, „Ohne diese Funktion fortfahren“ und „Einstellungen verwalten“ passend zum Kontext an.
- „Für diese Funktion merken“ speichert nur eine myQR24-Präferenz und behauptet keine garantierte Betriebssystemfreigabe.
- Eine Verweigerung blockiert ausschließlich die abhängige Funktion und führt nicht zu stiller Alternativortung oder wiederholter Nachfrage im selben Ablauf.
- Systemrechte werden als Browser-/Betriebssystemzustand, App-Präferenzen und API-Policies als getrennte Ebenen dargestellt.

### APP-US-063 — Persönliches Berechtigungszentrum bereitstellen

**Priorität:** P1  
**Iteration:** APP-I02A, APP-I03  
**Status:** planned

**Als** Nutzer  
**möchte ich** meine myQR24-Präferenzen und den erkennbaren Systemstatus zentral verwalten,  
**damit** ich die Verwendung meiner Daten nachvollziehen und widerrufen kann.

#### Akzeptanzkriterien

- Die Route `/me/privacy-and-permissions` zeigt mindestens Kamera-, Standort-, Scan- und Kommunikationspräferenzen.
- Die Oberfläche unterscheidet sichtbar Systemstatus, lokale oder kontobezogene Präferenz und serverseitige Einwilligung.
- Nicht angemeldete Nutzer sehen ausschließlich lokale, nicht sensible Präferenzen.
- Der Widerruf einer Standortpräferenz verhindert neue Standorterfassungen; bestehende Serverereignisse unterliegen ihrer dokumentierten Retention.
- Fehlende oder blockierte Systemrechte werden mit einem funktionsbezogenen Fallback erklärt, nicht als App-Fehler dargestellt.
- Ab APP-I03 synchronisiert die API serverseitige Zweck-, Scope-, Entscheidung- und Policy-Version-Daten minimalistisch.

### APP-US-064 — TAG-Aktionen über serverseitige Capabilities darstellen

**Priorität:** P0  
**Iteration:** APP-I03  
**Status:** planned

**Als** angemeldeter oder anonymer TAG-Nutzer  
**möchte ich** nur die für meine aktuelle Session zulässigen Kontextaktionen sehen,  
**damit** ich nach einem Scan schnell passende Optionen wie Sammeln, Claim oder Verwaltung finde.

#### Akzeptanzkriterien

- Der öffentliche API-View kann darstellbare `TagCapabilities` für die aktuelle Session liefern.
- Öffentliche Inhalte erscheinen vor optionalen persönlichen oder Owner-Aktionen.
- Die UI leitet Owner-Status, Claim-Möglichkeit, Campaign-Eligibility oder Feature-Freigabe nicht aus lokaler Historie oder TAG-ID ab.
- Jeder geschützte API-Request prüft Capability-relevante Bedingungen erneut serverseitig.
- Entfernte oder geänderte Capabilities führen zu keiner weiter ausführbaren Client-Aktion.
- Tests decken anonyme, angemeldete, Owner- und veraltete/manipulierte Client-Zustände ab.

### APP-US-065 — Persönliche Scan-Speicherung datensparsam steuern

**Priorität:** P1  
**Iteration:** APP-I03  
**Status:** planned

**Als** Nutzer  
**möchte ich** Scans wahlweise gar nicht, nur lokal oder nach Anmeldung in meinem Konto speichern,  
**damit** ich selbst über die Persistenz meiner Scan-Historie entscheide.

#### Akzeptanzkriterien

- Die Standardkonfiguration erzeugt keine personenbezogene serverseitige Scan-Historie.
- Lokale Historie ist optional, löschbar und von kontoübergreifender Speicherung getrennt.
- Eine Übernahme lokaler Scans in ein Konto verlangt eine ausdrückliche Aktion nach Anmeldung.
- API-Antworten für persönliche Scan-Historien verwenden `Cache-Control: no-store`.
- Produktklassen und serverseitige Capabilities bestimmen, ob Claim-, Collection- oder Campaign-Aktionen angeboten werden.
- Anonyme Demo-TAGs erzeugen keine personenbezogene Serverhistorie.
