# User Stories: TAG Control Plane

**Planungsstand:** 2026-10-06  
**Status:** Alle Stories sind `planned`.  
**Abgrenzung:** Diese Stories beschreiben serverseitige Fachlogik, Persistenz, APIs und Prozesse. Das TAG Control Center realisiert die zugehörige administrative Bedienoberfläche.

## CP-I01 – Plattformfundament

### CP-US-001 – Autoritative Fachmutation ausführen

**Als** Control-Center-Client bzw. automatisierter Betriebsprozess  
**möchte ich** fachliche Mutationen nur über serverseitige Control-Plane-Services ausführen,  
**damit** Datenintegrität, Berechtigungen und Workflows nicht durch UI oder direkte Datenbankzugriffe umgangen werden.

**Akzeptanzkriterien**

1. Schreiboperationen laufen in einer definierten DB-Transaktion.
2. Serverseitige Authentisierung, Autorisierung und Objekt-/Organisationsgrenzen werden vor der Mutation geprüft.
3. Der Browser besitzt keinen Datenbank-, Publisher- oder Secret-Zugriff.
4. Fehler führen zu keiner teilweisen Fachmutation.
5. Kritische Änderungen erhalten eine Korrelations-ID.

### CP-US-002 – Kritische Prozesse auditieren

**Als** Betreiber  
**möchte ich** fachliche, Produktions-, Qualitäts- und Veröffentlichungsentscheidungen nachvollziehen,  
**damit** TAGs von der Reservierung bis zum öffentlichen Betrieb rückverfolgbar bleiben.

**Akzeptanzkriterien**

1. Audit-Ereignisse entstehen für TAG-, Range-, Druck-, QA-, Status-, Publish- und Rollenentscheidungen.
2. Das Ereignis enthält Akteur/Systemprozess, Zeit, Objekt, Aktion, Korrelation und redigierte Metadaten.
3. Auditdaten enthalten keine Secrets, Klartext-Credentials oder vollständige Nachweise.
4. Normale Fachservices können Audit-Ereignisse nicht nachträglich verändern.

## CP-I02 – Range- und TAG-Lebenszyklus

### CP-US-010 – Zulässige Ranges serverseitig validieren

**Als** Control-Plane-Service  
**möchte ich** Range-Konfigurationen vor Speicherung und Projektion validieren,  
**damit** nur kanonische, globale nicht überlappende Räume an den Edge Router gelangen.

**Akzeptanzkriterien**

1. Länge, kanonischer Raum, Reihenfolge und Nichtüberlappung werden geprüft.
2. Achtstellige Ranges erfüllen vollständige 16er-Slotgrenzen.
3. Inaktive oder erschöpfte Ranges vergeben keine neuen TAGs.
4. Fehlende Gruppen-/Feature-Referenzen verhindern Veröffentlichung.

### CP-US-013 – Allocation Pools für Zielgruppen steuern

**Als** TAG-Administrator bzw. automatisierter Control-Plane-Service  
**möchte ich** Allocation Pools aus gültigen Ranges für private Nutzer, Partner, Großkunden und weitere Funktionsbereiche definieren,  
**damit** TAG-Kapazitäten, Ausgabemodelle und Produkt-/Claim-Policies kontrolliert getrennt bleiben.

**Akzeptanzkriterien**

1. Ein Pool besitzt mindestens Name, Zielgruppe/Ausgabekanal, Länge, eine oder mehrere gültige Ranges, Status, Kapazitätskennzahlen und Produkt-/Claim-Policy.
2. Pool-Ranges werden im kanonischen `decodedValue`-Raum verwaltet; öffentliche Feistel-`tagId`-Strings sind keine Poolgrenzen.
3. Pool-Ranges sind global nicht überlappend und erfüllen bei acht Stellen vollständige 16er-Slotgrenzen.
4. Ein Pool kann optional an eine Organisation oder einen Partner gebunden werden.
5. Nur aktive Pools dürfen TAGs reservieren; Warnschwellen und Erschöpfung sind autoritativ berechenbar.
6. Poolname, Kundensegment, Bestellung und Owner-Zuordnung gehören nie in KV oder öffentliche Antworten.

### CP-US-011 – TAG atomar reservieren

**Als** Control-Plane-Service  
**möchte ich** konkrete sechs- oder achtstellige TAGs atomar reservieren,  
**damit** parallele Herstellung, Selbstprint und Verwaltungsanfragen niemals doppelte TAGs erzeugen.

**Akzeptanzkriterien**

1. `tagId` sowie `(length, decodedValue)` sind eindeutig constrained.
2. Sechsstellige Werte stammen ausschließlich aus `I(6)`.
3. Achtstellige Werte nutzen den nächsten vollständigen 16er-Basisslot; der interne Cloudflare-Codec ergänzt danach das HMAC-Nibble.
4. Der vollständige validierte `decodedValue` sowie die vom Codec zurückgelieferte öffentliche `tagId` werden gespeichert.
5. Retry/Idempotenz erzeugt keine ungewollte zweite Reservierung oder zweite Codec-Wirkung.
6. Die Control Plane besitzt niemals `FEISTEL_SECRET` oder `TAG_HMAC_SECRET`; sie ruft ausschließlich den authentisierten Encode-Vertrag [`tag-codec-internal-v1`](../../10-Architecture/35-Contracts/tag-codec-internal-v1.md) auf.

### CP-US-012 – TAG-Lebenszyklus serverseitig steuern

**Als** Control-Plane-Service  
**möchte ich** gültige TAG-Statusübergänge erzwingen,  
**damit** Entwürfe, gefertigte Tags, aktive Tags, Sperrungen und Archivierung konsistent bleiben.

**Akzeptanzkriterien**

1. Mindestens `draft`, `pending-review`, `ready-to-publish`, `active`, `suspended`, `expired`, `archived` werden unterstützt.
2. Ein physischer TAG kann erst nach den definierten Herstellungs-/QA-Gates aktiv werden.
3. `suspended`, `expired` und `archived` planen eine sichere Unpublish-/Neutralisierungswirkung.
4. Ungültige Statussprünge werden serverseitig verweigert und relevante Wechsel auditiert.

## CP-I03 – Herstellung, Claiming und Druck

### CP-US-025 – Claim-Credentials je TAG sicher vorbereiten

**Als** Control-Plane-Service  
**möchte ich** für eine offene Charge pro TAG eine Claim-Policy und ein einzeln prüfbares Credential vorbereiten,  
**damit** ein gedruckter PIN bzw. ein Passwort pro TAG, Bogen oder Charge sicher zum späteren Owner-Claim verwendet werden kann.

**Akzeptanzkriterien**

1. Credential-Typen mindestens `pin` und `password` sowie die Verteilungsmodelle `per-tag` und `shared-batch` sind policygesteuert abbildbar.
2. Auch bei einem gemeinsamen Bogen-/Chargenwert erhält jeder TAG einen eigenen gesalzenen Credential-Hash, Claim-Status, Fehlversuchszähler und Lockout-Zeitpunkt.
3. Klartext-Credentials sind nach kontrollierter Druckfreigabe nicht wieder aus der Control Plane abrufbar.
4. Credential-Hashes, Fehlversuche, Claim-Gruppen, Ownerdaten und interne Druckreferenzen gelangen nie in KV, Public Read API, Auditmetadaten oder Logs.
5. Credential-Anlage, Druckfreigabe, Sperrung und Reset werden auditiert.

### CP-US-026 – Claim atomar über den freigegebenen Einstieg ausführen

**Als** berechtigte künftige Owner-Person  
**möchte ich** nach Scan eines ausgegebenen TAGs mit PIN oder Passwort claimen,  
**damit** der TAG einmalig und sicher meinem Konto bzw. meiner Organisation zugeordnet wird.

**Akzeptanzkriterien**

1. Der öffentliche TAG-App-Claim ist der primäre Einstieg; die Schnittstelle akzeptiert nur kanonische, tatsächlich `claimable` TAGs und eine authentisierte, zulässige Owner-Zuordnung.
2. TAG-App und berechtigter Support verwenden denselben serverseitigen Claim-Service; die Client-Oberfläche entscheidet weder Credential-Prüfung, Policy, Owner-Zuordnung noch Claim-Status.
3. Credential-Prüfung, Versuchszählung, Lockout, Owner-Zuordnung, Besitzstatus und Audit erfolgen atomar.
4. Erfolgreiches Claiming verbraucht das Credential dauerhaft; Parallelclaims können keinen zweiten Owner erzeugen.
5. Pro TAG gelten policygesteuert maximal 10 bis 20 Fehlversuche, progressive zeitliche Sperren sowie zusätzliche serverseitige Client-/IP-Drosselung.
6. Unbekannte, vorab zugewiesene, gesperrte oder bereits geclaimte TAGs liefern neutralisierte Antworten ohne interne Zustandslecks.
7. Der Claim-Input wird nicht persistiert, geloggt oder in Auditmetadaten übernommen; die Antwort enthält nur den jeweils zulässigen minimalen Ergebnisvertrag.

### CP-US-028 – Manuellen Support-Claim kontrolliert durchführen

**Als** berechtigte Supportperson  
**möchte ich** einen Claim im Control Center anhand einer TAG-ID und des vom Kunden eingegebenen Claim-Secrets begleiten,  
**damit** bei einem fehlgeschlagenen Claim schnell geholfen werden kann, ohne die Sicherheitsgrenzen des normalen TAG-App-Flows zu umgehen.

**Akzeptanzkriterien**

1. Der Support-Claim ruft ausschließlich den gemeinsamen Claim-Service auf und unterliegt derselben Credential-, Lockout-, Rate-Limit-, Policy- und Atomizitätsprüfung wie die TAG-App.
2. TAG-ID und Claim-Secret werden ausschließlich für den unmittelbaren Request entgegengenommen; das Secret wird nicht gespeichert, geloggt, auditiert, exportiert oder an Browserpersistenz übergeben.
3. Die Supportansicht liefert nur eine datensparsame, rollenabhängige Statusantwort und zeigt keine Credential-Hashes, Fehlversuchszähler, Pooldetails oder fremde Ownerdaten.
4. Sensible Folgeaktionen wie Lockout-Reset, Ersatz oder Widerruf verlangen eine explizite Berechtigung, erneute starke Authentisierung nach der beschlossenen Policy, Begründung und ein Audit-Ereignis.
5. Ein manueller Support-Claim kann weder eine Vorabzuweisung überschreiben noch einen bereits geclaimten TAG einer zweiten Owner-Zuordnung zuführen.
6. Audit referenziert Kanal, Akteur, TAG und Korrelations-ID, aber nie das Claim-Secret oder unnötige personenbezogene Daten.

### CP-US-027 – Bestellung vorab zuweisen und Self-Print ausgeben

**Als** Control-Plane-Service  
**möchte ich** TAGs für eine Bestellung oder Selbstdruck-Serie vor Herstellung an eine Owner-ID bzw. Organisation binden,  
**damit** große Kundenmengen ohne Einzelclaim kontrolliert produziert, ausgeliefert oder selbst gedruckt werden können.

**Akzeptanzkriterien**

1. Vorabzuweisung erfolgt atomar für die konkret reservierte Menge eines zulässigen Pools.
2. Jeder TAG speichert die autoritative Owner-/Organisationsbindung und Besitzstatus `preassigned`; die Daten bleiben privat.
3. Eine Self-Print-ID-/Druckliste ist ein zeitlich begrenzter, auditierter und vertraulicher Export ohne Feistel-/HMAC-Secrets oder Cloudflare-Tokens.
4. Pool-, Produkt-, QA-, Übergabe- und Aktivierungspolicy werden vor Ausgabe durchgesetzt.
5. Widerruf, Ersatz oder Besitzerwechsel hinterlassen keine unklare Doppelzuweisung und werden auditiert.

### CP-US-020 – Produktionslos mit reservierten Druckpositionen erzeugen

**Als** Produktionsprozess  
**möchte ich** ein Produktionslos mit eindeutig reservierten TAG-Druckpositionen erzeugen,  
**damit** Herstellung und physische Einheiten eindeutig der autoritativen Datenbasis folgen.

**Akzeptanzkriterien**

1. Ein Produktionslos enthält Produktklasse, Umgebung, Pool-/Range-Kontext, Druckvorlage, Claim-/Vorabzuweisungsmodell und konkrete Druckpositionen.
2. Jede Position referenziert genau einen reservierten TAG.
3. Die Reservierung erfolgt atomar; Teilfehler hinterlassen keine unklare Menge.
4. Ein TAG kann nicht gleichzeitig in mehreren offenen Druckpositionen liegen.
5. Staging- und Produktionslose sind fachlich und technisch getrennt.

### CP-US-021 – Unveränderlichen Druck-Snapshot erstellen

**Als** Control-Plane-Service  
**möchte ich** einen freigegebenen Druckauftrag als versionierten, prüfsummenbelegten Snapshot exportieren,  
**damit** Druckdaten reproduzierbar bleiben und nach Freigabe nicht unbemerkt manipuliert werden können.

**Akzeptanzkriterien**

1. Snapshot enthält Druckauftrags-/Los-ID, Position, TAG-ID, kanonische Scan-URL, QR-Payload, Vorlagenversion und bei offenen Chargen das auszugebende Claim-Credential.
2. Snapshot und Export erhalten eine Prüfsumme sowie Freigabezeitpunkt und Akteur.
3. Ein erneuter Download liefert denselben freigegebenen Snapshot, keine Neuberechnung.
4. Export enthält keine Secrets, Cloudflare-Tokens, Ownerdaten oder privaten Vault-Inhalte; Claim-Credentials sind ausschließlich im als vertraulich klassifizierten Druck-/Selbstdruckexport zulässig.
5. Änderungen nach Freigabe erzeugen einen neuen, autorisiert freizugebenden Auftrag statt stiller Manipulation.

### CP-US-022 – Druck-, QA- und Ausschussstatus führen

**Als** Qualitätsprozess  
**möchte ich** Druckergebnis und Scan-/Lesbarkeitsprüfung pro Position erfassen,  
**damit** nur geprüfte physische TAGs aktiviert oder übergeben werden.

**Akzeptanzkriterien**

1. Druckauftrag und Position besitzen getrennte Status.
2. Mindestens `approved`, `exported`, `in-production`, `quality-check`, `completed`, `partially-completed`, `cancelled` sind für Aufträge abbildbar.
3. Positionen unterstützen mindestens `reserved`, `printed`, `quality-checked`, `rejected`, `destroyed`, `reprint-required`.
4. Fehlergrund, QA-Ergebnis und Akteur werden auditiert.
5. Ausschuss-TAGs werden nicht stillschweigend in den freien Pool zurückgeführt.

### CP-US-023 – Nachdruck, Verlust und Diebstahl sicher behandeln

**Als** Betriebsprozess  
**möchte ich** fehlerhafte, verlorene oder kompromittierte physische TAGs kontrolliert nachdrucken oder sperren,  
**damit** keine unklaren oder weiterhin öffentlichen TAGs verbleiben.

**Akzeptanzkriterien**

1. Nachdruck derselben TAG-ID verlangt eine explizite berechtigte Entscheidung und Audit.
2. Ersatz mit neuer TAG-ID sperrt bzw. archiviert die alte ID nachvollziehbar.
3. Verlust-/Diebstahlstatus löst kontrollierte Sperrung und Unpublish/Neutralisierung aus.
4. Wiederholungen und konkurrierende Fehlerentscheidungen bleiben idempotent.
5. Aktivierung bleibt bis zum QA-/Übergabegate verweigert.

### CP-US-024 – Geprüfte TAGs übergeben und aktivieren

**Als** Fulfillment-Prozess  
**möchte ich** qualitätsgeprüfte TAGs an Lager, Auftrag, Partner oder Organisation übergeben und erst dann zur Aktivierung freigeben,  
**damit** öffentliche Routingwirkung erst für nachvollziehbar verfügbare physische TAGs entsteht.

**Akzeptanzkriterien**

1. Übergabe enthält Empfängerklasse/-referenz, Zeitpunkt und Übergabestatus ohne unnötige öffentliche Daten.
2. Nur `quality-checked`-Positionen können in die Aktivierungsfreigabe wechseln.
3. Aktivierung prüft Produktpolicy, Laufzeit und ggf. weitere Review-Gates.
4. Jede Übergabe und Aktivierung erzeugt Audit- und ggf. Publishing-Outbox-Ereignisse.

### CP-US-029 – Claim mit dauerhaftem Besitzanker abschließen

**Als** Control-Plane-Service  
**möchte ich** einen erfolgreichen Erstclaim erst nach Einrichtung eines dauerhaften Besitzankers abschließen,  
**damit** ein TAG nach Verlust von Browser- oder PWA-Daten nicht unverwaltbar wird.

**Akzeptanzkriterien**

1. Der erfolgreiche Credential-Claim erzeugt zunächst nur den kurzlebigen Zustand `claim-pending-setup`.
2. Der Claim-Abschluss verlangt mindestens eine serverseitige Account-/Organisationszuordnung oder eine TAG-gebundene Owner-Passphrase.
3. Die Setup-Session ist kurzlebig und darf nur Account-Bindung, Owner-Passphrase-Einrichtung und zulässige Initialkonfiguration ausführen.
4. Owner-Passphrase, Claim-Credential und Besucher-PIN besitzen getrennte Zwecke, Hashes, Rate Limits, Sperrungen und Audit-Ereignisse.
5. Ohne fertigen Besitzanker entsteht keine dauerhafte Owner-Berechtigung aus Client-, Session- oder Collection-Daten.
6. Claim, Besitzanker, Abbruch und Ablauf werden ohne Klartext-Credentials auditiert.

### CP-US-033 – Owner-Passphrase und TAG-Owner-Session sicher verwalten

**Als** accountloser oder angemeldeter TAG-Owner  
**möchte ich** mich mit einer separaten Owner-Passphrase für genau mein TAG autorisieren,  
**damit** ich dessen Verhalten auch ohne Account-Bindung kontrolliert verwalten kann.

**Akzeptanzkriterien**

1. Eine Owner-Passphrase ist nur nach zulässigem Claim- oder Account-Owner-Kontext setzbar, änderbar oder deaktivierbar.
2. Sie wird ausschließlich als langsamer, gesalzener Passwort-Hash gespeichert; Klartext, Hash und Eingabe erscheinen nie in Public APIs, KV, Auditmetadaten oder Logs.
3. Prüfung, Fehlversuche, Rate Limit, progressive Sperre und Erfolg erfolgen serverseitig und TAG-gebunden.
4. Erfolg erzeugt eine kurzlebige `HttpOnly`, `Secure`, `SameSite=Strict` Owner-Session mit begrenztem TAG-Scope.
5. Jede schreibende Owner-Aktion prüft Session, TAG-Scope, CSRF und aktuelle Lifecycle-/Produktpolicy erneut.
6. Account-Zuordnung und Owner-Passphrase erlauben keine stillschweigende Umgehung eines Widerrufs oder einer Plattform-Sperre.

### CP-US-034 – Persönliche TAG-Collections serverseitig führen

**Als** angemeldeter Nutzer  
**möchte ich** persönliche TAG-Referenzen in meinem Konto speichern und lokale Collections ausdrücklich übernehmen,  
**damit** wiedergefundene Museums-, Veranstaltungs- oder Alltagstags bei Gerätewechsel erhalten bleiben.

**Akzeptanzkriterien**

1. Eine Collection-Zeile enthält mindestens Account-Referenz, TAG-Referenz und Hinzufügezeit; sie enthält weder Owner-Rechte noch private View-Kopien.
2. Der Import lokaler TAG-IDs validiert jede TAG-ID serverseitig und ist pro `(accountId, tagId)` idempotent.
3. Geschlossene oder nicht verfügbare TAGs dürfen als persönliche Referenz bleiben, liefern aber beim Öffnen nur den aktuellen neutralen Public-Status.
4. Collection-APIs isolieren Accounts strikt, verwenden `Cache-Control: no-store` und werden nicht in öffentliche Runtime-Projektionen übernommen.
5. Ein Collection-Eintrag, lokale Browserdaten oder URL-Kenntnis begründet niemals Owner-, Upload- oder PIN-Freigaberechte.
6. Import, Löschen und relevante Fehlerzustände werden datensparsam auditiert.

## CP-I04 – Routing-Projektion und Publishing

### CP-US-030 – Minimale Routing-Projektion generieren

**Als** Control-Plane-Service  
**möchte ich** aus autoritativen Daten eine valide minimale KV-Projektion ableiten,  
**damit** der Edge Router nur die für seine Auflösung benötigten Informationen erhält.

**Akzeptanzkriterien**

1. Es entstehen ausschließlich erlaubte Index-, Gruppen-, Range-/TAG-Regel- und Feature-Dokumente.
2. Features werden typspezifisch validiert; URLs/Templates folgen `DOMAIN_RULES.md`.
3. Personen-, Produktions-, Audit-, Vault- und Secretdaten werden vor Projektion ausgeschlossen.
4. Referenzintegrität und Range-Invarianten werden vor Outbox-Erzeugung erneut geprüft.
5. Eine Version bzw. ein Diff zur letzten erfolgreichen Projektion ist abrufbar.

### CP-US-031 – KV-Publishing zuverlässig ausführen

**Als** Publisher-Prozess  
**möchte ich** geprüfte Projektionen idempotent nach dem passenden Cloudflare-KV-Namespace publizieren,  
**damit** fachliche Daten und öffentliche Routingwirkung konsistent nachgeführt werden.

**Akzeptanzkriterien**

1. Fachmutation, Audit und Outbox-Auftrag entstehen gemeinsam in einer DB-Transaktion.
2. Nur der serverseitige Publisher verwendet einen minimal berechtigten Umgebungs-Token.
3. Publish wird erst nach bestätigter Cloudflare-Antwort als erfolgreich markiert.
4. Timeouts, 429 und 5xx führen zu nachvollziehbarem Retry ohne doppelten Nebeneffekt.
5. Staging kann nie versehentlich Produktion beschreiben.

### CP-US-032 – Routing kontrolliert zurückziehen

**Als** Control-Plane-Service  
**möchte ich** gesperrte, abgelaufene, zerstörte oder archivierte TAGs sicher unpublizieren bzw. neutralisieren,  
**damit** keine alte öffentliche Route weiterwirkt.

**Akzeptanzkriterien**

1. Unpublish folgt demselben Outbox-/Publisher-Prozess.
2. Nach bestätigtem Erfolg wird die autoritative Veröffentlichungsmarkierung aktualisiert.
3. Fehler bleiben sichtbar und erneut ausführbar.
4. Grund, Diff und Ergebnis werden auditiert.

### CP-US-035 – Öffentliche TAG-Runtime-Projektion ableiten und publizieren

**Als** Control-Plane-Service  
**möchte ich** aus einer freigegebenen Owner-Konfiguration eine bereinigte, versionierte öffentliche Runtime-Projektion ableiten,  
**damit** die TAG-App öffentliche Inhalte und Verhalten ohne private Daten oder unnötige Control-Plane-Lookups ausliefern kann.

**Akzeptanzkriterien**

1. Die Projektion enthält ausschließlich schema-validierte öffentliche Runtime-Daten wie `mode`, `visibility`, typisierte Content-Blöcke, veröffentlichte Galerie-Metadaten und validierte Feature-/Redirect-Daten.
2. Unterstützte Mindest-Sichtbarkeit lautet `public`, `pin-required` und `closed`; `redirect` wird nur mit serverseitig validierter Ziel-URL publiziert.
3. Owner-, Account-, Claim-, PIN-Hash-, Session-, Audit-, Pool-, Bestell-, Entwurfs- und interne Objektpfaddaten werden ausgeschlossen.
4. Öffentliche Keys werden ausschließlich aus kanonischer `tagId` und veröffentlichter Revision abgeleitet; Clientparameter bestimmen niemals Object-Store-Pfade.
5. Fachmutation, Audit, Runtime-Outbox und Routing-Outbox entstehen konsistent; ein fehlgeschlagener Publish bleibt sichtbar und retrybar.
6. Sperrung, Ablauf, Archivierung oder Sichtbarkeitswechsel neutralisieren bzw. entfernen die Runtime-Projektion kontrolliert.

## CP-I05 – Öffentliche Basisdaten

### CP-US-040 – Öffentliche Basis-Vault-Version verwalten

**Als** Control-Plane-Service  
**möchte ich** eine getrennte veröffentlichte Version von Basis-Vault-Inhalten führen,  
**damit** Entwürfe niemals über öffentliche Schnittstellen sichtbar werden.

**Akzeptanzkriterien**

1. Öffentliche Version enthält nur erlaubte Titel-, Beschreibungs-, Bildreferenz- und Linkfelder.
2. HTML, JavaScript und iFrames sind nicht als freie Inhalte zulässig.
3. Entwürfe, Audit-, Owner- und Produktdaten gehören nicht zur öffentlichen Version.
4. Veröffentlichung/Widerruf sind auditierbar.

### CP-US-041 – Öffentliche Read-API datensparsam ausliefern

**Als** öffentliche TAG-App  
**möchte ich** ausschließlich veröffentlichte Basisdaten über eine stabile Read-API laden,  
**damit** Scans keine internen Informationen offenlegen.

**Akzeptanzkriterien**

1. `GET /api/v1/tags/{tagId}/view` prüft kanonische TAG-ID und liefert den vereinbarten PublicTagView-Vertrag aus der aktuellen öffentlichen Runtime-Projektion.
2. `public` liefert ausschließlich veröffentlichte Daten; `pin-required` liefert nur einen neutralen Freigabe-Einstieg; unbekannte, geschlossene, nicht veröffentlichte, gesperrte und abgelaufene TAGs antworten neutral.
3. Die API ist read-only, CORS-beschränkt, rate-limitiert und mit Sichtbarkeits-/Widerrufskonformem Caching versehen; geschützte oder persönliche Antworten verwenden `no-store`.
4. Responses enthalten nie Produktions-, Audit-, Owner-, Nachweis-, Token-, PIN-, Session- oder interne Pfaddaten.

## CP-I06 – Product, Organisation und POI

### CP-US-050 – Produkt- und Organisationspolicies durchsetzen

**Als** Control-Plane-Service  
**möchte ich** Produktklassen, Laufzeiten, Modulgrenzen sowie Organisationskontexte serverseitig prüfen,  
**damit** Produkt- und Zugriffsregeln nicht im Control Center oder Edge Router verteilt sind.

**Akzeptanzkriterien**

1. Policies werden bei Reservierung, Freigabe, Aktivierung und Verlängerung geprüft.
2. Owner-/Organisation-/Betreiberdaten bleiben privat.
3. Rollen-/Betreiberwechsel widerrufen bzw. markieren abhängige Berechtigungen nachvollziehbar.
4. Der Edge Router erhält keine Tarif-, Quoten- oder Kontostatusdaten.

### CP-US-051 – POI-Review und Schutzgates durchsetzen

**Als** Control-Plane-Service  
**möchte ich** POI-spezifische Nachweise und Prüfungen vor Aktivierung erzwingen,  
**damit** öffentliche Standorte nur mit verantwortlicher Betreiberzuordnung aktiv werden.

**Akzeptanzkriterien**

1. Fehlende Betreiber-, Standort-, Zustimmung- oder Meldeinformationen verhindern Aktivierung und Publishing.
2. Nachweise sind zugriffsgeschützt und niemals Teil der KV-/Public-API-Projektion.
3. `review`, `suspended` und `expired` deaktivieren abhängige Runtime-Module serverseitig.
4. Entscheidungen und Gründe werden auditiert.
