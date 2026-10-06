# User Stories: TAG Control Center

**Planungsstand:** 2026-10-06  
**Status:** Alle Stories in diesem Dokument sind `planned`, sofern nicht ausdrücklich anders angegeben.  
**Grundsatz:** Die TAG Control Plane ist die autoritative Verwaltungsquelle. Das Control Center ist deren administrative Benutzeroberfläche; Cloudflare KV erhält ausschließlich die minimale Routing-Projektion.

## CC-I01 – Fundament und Sicherheitsbasis

### CC-US-001 – Administrativen Zugang sicher herstellen

**Als** berechtigte Verwaltungsnutzerin bzw. berechtigter Verwaltungsnutzer  
**möchte ich** mich sicher anmelden und meine Sitzung kontrolliert beenden,  
**damit** Verwaltungsdaten nicht durch unautorisierte Personen geändert werden können.

**Akzeptanzkriterien**

1. Anmelde-, Logout-, Ablauf-, Widerrufs- und Recovery-Verhalten sind vor Implementierung dokumentiert.
2. Sessions verwenden serverseitige, zufällig erzeugte und nur gehasht gespeicherte Tokens oder einen gleichwertig sicheren Framework-Mechanismus.
3. Cookie-basierte Sessions sind `HttpOnly`, `Secure` und `SameSite=Strict`; alle zustandsändernden Requests besitzen CSRF-Schutz.
4. Plattformadministratoren benötigen die vorab beschlossene starke Authentisierung bzw. MFA.
5. Fehlermeldungen offenbaren weder Kontenexistenz noch Authentisierungsdetails.
6. Login-, Logout-, Sperr- und Rechteereignisse sind auditierbar.
7. Zugangsdaten, Tokens und Secrets werden niemals geloggt oder an Browser-Storage ausgegeben.

### CC-US-002 – Rollen serverseitig durchsetzen

**Als** Plattformadministrator  
**möchte ich** Rollen und Berechtigungen verwalten,  
**damit** nur zuständige Personen sensible Aktionen wie Aktivierung, Publishing, Sperrung oder POI-Freigabe ausführen können.

**Akzeptanzkriterien**

1. Mindestens `platform-admin`, `tag-manager`, `content-editor`, `reviewer`, `organization-admin`, `poi-operator`, `poi-editor`, `poi-moderator` und `support-agent` sind als serverseitig durchgesetzte Rollen modelliert.
2. Jede Schreiboperation prüft Authentisierung und Autorisierung auf dem Server.
3. UI-Ausblendung ersetzt keine serverseitige Prüfung.
4. Rechteänderungen, Entzug und Fehlversuche werden auditiert.
5. Unterstützungszugriffe folgen dem Prinzip minimaler Rechte und sind nachvollziehbar.
6. Alte Rollen, Sessions und Tokens können bei Betreiberwechsel oder Sicherheitsfall widerrufen werden.

### CC-US-003 – Autoritative Daten nachvollziehbar ändern

**Als** berechtigte Verwaltungsnutzerin bzw. berechtigter Verwaltungsnutzer  
**möchte ich** fachlich relevante Änderungen mit Herkunft und Wirkung nachvollziehen,  
**damit** Betrieb, Support und Compliance Änderungen prüfen können.

**Akzeptanzkriterien**

1. Für TAG-, Range-, Feature-, Status-, Rollen-, POI- und Publishing-Änderungen entsteht ein Audit-Ereignis.
2. Ein Ereignis enthält mindestens Zeitpunkt, Akteur bzw. Systemprozess, Objektart, Objekt-ID, Aktion und Korrelations-ID.
3. Sensible Klartexte, Zugangsdaten, Tokens und komplette Nachweise werden nicht ungeschützt in Audit-Metadaten gespeichert.
4. Audit-Ereignisse sind nachträglich nicht über die normale Verwaltungsoberfläche veränderbar.
5. Ein berechtigter Audit-Viewer kann Ereignisse gefiltert anzeigen, ohne private Inhalte unnötig offenzulegen.

### CC-US-004 – Verwaltungsoberfläche desktop-first und mobil supportfähig bedienen

**Als** Verwaltungs- oder Supportperson  
**möchte ich** die umfangreiche TAG-Verwaltung im Office effizient bedienen und auf einem Mobilgerät sichere Kern-Supportaufgaben erledigen können,  
**damit** reguläre Administration produktiv bleibt und Probleme vor Ort zeitnah behandelt werden können.

**Akzeptanzkriterien**

1. Die Informationsarchitektur ist desktop-first: Tabellen, Filter, Batch-Aktionen, Pool-/Chargenverwaltung, Druckfreigaben, Projektion und Publishing sind für breite Office-Ansichten, Tastaturbedienung und parallele Informationen optimiert.
2. Mobile Ansichten sind responsiv und ermöglichen mindestens Anmeldung, TAG-ID-Eingabe oder -Scan, datensparsame Statusprüfung, begleiteten Support-Claim sowie die Anzeige einer Audit-/Korrelationsreferenz.
3. Komplexe oder risikoreiche Massen- und Konfigurationsaufgaben dürfen mobil bewusst eingeschränkt, schreibgeschützt oder auf eine Desktop-Ansicht verwiesen werden.
4. Sensible mobile Aktionen verlangen dieselben serverseitigen Rollenprüfungen wie Desktop-Aktionen und bei Policy-pflichtigen Folgeaktionen eine erneute starke Authentisierung.
5. Bedienung verwendet ausreichend große Touch-Ziele, verständliche Statushinweise, sichere Lade-/Fehlerzustände und keine ausschließlich hover- oder mausabhängigen Funktionen.
6. Die Oberfläche hält TAG-ID, Claim-Secret, Owner- und Statusinformationen nicht über den unmittelbar erforderlichen Ablauf hinaus im Clientzustand oder Browser-Storage vor.

## CC-I02 – TAG-Stammdaten und sichere Vergabe

### CC-US-010 – TAG als Entwurf anlegen

**Als** TAG-Manager  
**möchte ich** einen TAG als Entwurf mit Produktklasse, Owner-/Organisationskontext und Status anlegen,  
**damit** seine Konfiguration vor der Veröffentlichung fachlich geprüft werden kann.

**Akzeptanzkriterien**

1. Ein Entwurf erhält einen stabilen internen Primärschlüssel und den Status `draft`.
2. Produktklasse, Owner bzw. Organisation, Laufzeitdaten und erforderliche Konfigurationsfelder werden serverseitig validiert.
3. Ein Entwurf wird nie allein durch das Speichern öffentlich auflösbar.
4. Statuswechsel folgen ausschließlich der erlaubten Zustandsfolge und benötigen die erforderliche Rolle.
5. Änderungen erzeugen Audit-Ereignisse.

### CC-US-011 – Eindeutige sechs- und achtstellige TAGs vergeben

**Als** TAG-Manager  
**möchte ich** eine gültige, eindeutige TAG-ID aus einer zugelassenen Range reservieren,  
**damit** QR-/NFC-TAGs dauerhaft und kryptografisch kompatibel ausgestellt werden können.

**Akzeptanzkriterien**

1. Die UI stößt ausschließlich einen autorisierten Control-Plane-Befehl an; die atomare Vergabe läuft serverseitig in einer Datenbanktransaktion.
2. Es bestehen eindeutige Constraints auf öffentlicher `tagId` sowie auf `(length, decodedValue)`.
3. Für sechsstellige IDs wird ausschließlich der kanonische Raum `I(6)` verwendet.
4. Für achtstellige IDs wird der nächste Basisslot mit `(lastDecodedValue & ~0x0f) + 0x10` bestimmt; der HMAC-Nibble wird danach serverseitig berechnet.
5. Der vollständige HMAC-validierte `decodedValue` wird unverändert gespeichert und dient als Range-Key.
6. Die Vergabe kann weder durch Parallelaufrufe noch durch Wiederholung eines fehlgeschlagenen Requests eine doppelte ID erzeugen.
7. Feistel- und HMAC-Secrets erscheinen nie in Antwortdaten, Logs, Testfixtures oder Datenbanktabellen.

### CC-US-012 – Ranges, Gruppen und Feature-Zuweisungen verwalten

**Als** berechtigte Routing-Verwalterin bzw. berechtigter Routing-Verwalter  
**möchte ich** Ranges, Gruppen und Feature-Zuweisungen prüfen und verwalten,  
**damit** die spätere Edge-Auflösung exakt dem dokumentierten Routing-Vertrag entspricht.

**Akzeptanzkriterien**

1. Ranges sind global nach Startwert sortiert, nicht überlappend und einer gültigen Länge zugeordnet.
2. Start und Ende liegen im kanonischen Raum der jeweiligen Länge.
3. Achtstellige Ranges beginnen auf einer 16er-Slotgrenze und enden auf einem vollständigen Slot (`start % 16 = 0`, `end % 16 = 15`).
4. Range-ID, Gruppen-ID und Feature-ID erfüllen die dokumentierten Identifier-Regeln.
5. Direkte TAG-, Range- und Gruppen-Zuweisungen werden in der Priorität TAG vor Range vor Gruppe dargestellt.
6. Ungültige oder unvollständige Konfiguration kann nicht publiziert werden.

### CC-US-015 – Allocation Pools für Zielgruppen administrieren

**Als** TAG-Admin  
**möchte ich** Allocation Pools für private Nutzer, Partner, Großkunden und weitere Funktionsbereiche anlegen und überwachen,  
**damit** Kapazität, Ausgabemodell und zulässige Produkt-/Claim-Policies kontrolliert getrennt werden.

**Akzeptanzkriterien**

1. Die UI erfasst mindestens Poolname, Zielgruppe/Ausgabekanal, Länge, kanonische Range(s), Status, Kapazitätswarnschwelle, Produkt-/Claim-Policy und optionalen Organisationskontext.
2. Die UI stellt klar dar, dass Pools über `decodedValue`-Ranges definiert werden und gedruckte Feistel-`tagId`-Strings nicht sichtbar fortlaufend sein müssen.
3. Ungültige, überlappende, erschöpfte oder fremd organisationsgebundene Pools werden durch die Control Plane abgewiesen und verständlich, ohne interne Details, dargestellt.
4. Poolname, Kundensegment, Bestellung, Owner-Referenzen und Claim-Details werden weder als KV-Projektion noch in öffentlicher TAG-Ansicht angezeigt.
5. Anlage, Änderung, Sperrung und Reaktivierung von Pools zeigen Audit- und Wirkungsinformationen aus der Control Plane an.

### CC-US-016 – Claim- und Vorabzuweisungsstrategie für eine Ausgabe wählen

**Als** TAG-Manager  
**möchte ich** für ein Produktionslos oder eine Bestellung eine zulässige Claim- oder Vorabzuweisungsstrategie auswählen,  
**damit** offene Chargen, Bogen-/Chargen-PINs, vorgeclaimte Bestellungen und Selbstdruckserien kontrolliert vorbereitet werden.

**Akzeptanzkriterien**

1. Die UI bietet nur von der Pool-/Produktpolicy erlaubte Modelle an: Einzelcredential, gemeinsames Credential je Bogen/Charge, Vorabzuweisung oder Selbstdruck.
2. Bei Vorabzuweisung wird der gewünschte Owner- bzw. Organisationskontext an die Control Plane übergeben; diese entscheidet über Zulässigkeit und atomare Zuordnung.
3. Für offene Chargen zeigt die UI Credential-Typ, Verteilungsmodell, Fehlversuchs-/Sperrpolicy und Druckstatus, niemals Credential-Hash oder später nicht mehr abrufbaren Klartext.
4. Ein vertraulicher Druck-/Self-Print-Export erfordert eine erneute berechtigte Freigabe und zeigt Zweck, Umfang, Ablaufzeit und Audit-Referenz.
5. Claim-Sperre, Support-Reset, Widerruf oder Ersatz können nur über ausdrücklich berechtigte, serverseitig bestätigte Aktionen bedient werden.
6. Jede Aktion zeigt Ergebnis und Korrelations-/Auditreferenz der Control Plane, ohne Credentials, Ownerdetails oder Secrets unnötig offenzulegen.

### CC-US-017 – Manuellen Support-Claim für einen TAG begleiten

**Als** berechtigte Supportperson  
**möchte ich** für einen konkreten TAG dessen ID eingeben oder scannen, das Claim-Secret unmittelbar bestätigen und bei einem Problem den zulässigen Folgeschritt auslösen,  
**damit** ein fehlgeschlagener Claim schnell bearbeitet wird, ohne den normalen TAG-App-Claim oder dessen Sicherheitsregeln zu umgehen.

**Akzeptanzkriterien**

1. Die Aktion ist ein Supportwerkzeug; der reguläre Claim erfolgt nach Scan primär in der öffentlichen TAG-App.
2. Die UI übergibt TAG-ID und Claim-Secret nur für den unmittelbaren Request an den gemeinsamen Control-Plane-Claim-Service und enthält keine eigene Claim-, Lockout- oder Owner-Entscheidungslogik.
3. Das Claim-Secret ist ein geheimes Eingabefeld, wird nach Anfrage, Abbruch und Ansichtwechsel aus dem UI-Zustand entfernt und erscheint nie in URL, Browser-Storage, Verlauf, Telemetrie, UI-Log, Auditansicht oder Fehlermeldung.
4. Die Antwort zeigt ausschließlich die für die Supportrolle erlaubte, datensparsame Status- und Ergebnisinformation; Hashes, Fehlversuchszähler, Pooldetails und fremde Ownerdaten bleiben verborgen.
5. Reset, Ersatz, Widerruf oder vergleichbare Folgeaktionen verlangen die erforderliche Rolle, einen begründeten und gegebenenfalls re-authentisierten serverseitigen Command sowie eine Audit-/Korrelationsreferenz.
6. Mobil ist der Ablauf auf TAG-ID-Scan/-Eingabe, Claim-Secret-Bestätigung, Ergebnis und zulässige Sofortmaßnahmen reduziert; Desktop kann zusätzlich Kontext und Supporthistorie im erlaubten Umfang darstellen.

### CC-US-013 – Status, Laufzeit und Sperrung verwalten

**Als** TAG-Manager bzw. Plattformadministrator  
**möchte ich** einen TAG aktivieren, sperren, als abgelaufen markieren oder archivieren,  
**damit** seine öffentliche Routingwirkung dem fachlichen Lebenszyklus folgt.

**Akzeptanzkriterien**

1. Unterstützt werden mindestens `draft`, `pending-review`, `ready-to-publish`, `active`, `suspended`, `expired` und `archived`.
2. Nur ein vollständig validierter TAG kann nach erfolgreicher Veröffentlichung `active` werden.
3. `suspended`, `expired` und `archived` lösen eine definierte, sichere Unpublish- oder Neutral-Seiten-Projektion aus.
4. Jede Statusänderung verlangt einen fachlichen Grund, soweit sie sicherheits- oder betriebsrelevant ist.
5. Status, Projektion und Audit bleiben nachvollziehbar konsistent.

### CC-US-014 – QR- und Druckdaten kontrolliert erzeugen

**Als** TAG-Manager  
**möchte ich** aus einer bereits reservierten TAG-ID kanonische Scan-URLs und QR-/Druckdaten erzeugen,  
**damit** nur zulässige Tags in die physische Ausgabe gelangen.

**Akzeptanzkriterien**

1. URLs verwenden ausschließlich die dokumentierten Host- und Pfadformen der gewählten Umgebung.
2. TAG-ID und URL sind kanonisch kleingeschrieben.
3. Reguläre QR-/Druckdaten enthalten weder Secrets noch Cloudflare- oder Verwaltungszugangsdaten; ein Claim-Credential erscheint ausschließlich im separat freigegebenen, vertraulichen Druck-/Self-Print-Export.
4. Staging- und Produktionsausgabe sind eindeutig gekennzeichnet und getrennt.
5. Produktive Druckfreigabe ist erst nach den definierten Staging- und Veröffentlichungsprüfungen möglich.

## CC-I03 – Routing-Projektion und Publishing

### CC-US-020 – Wiederverwendbare Routing-Features konfigurieren

**Als** TAG-Manager  
**möchte ich** serverseitig validierte, wiederverwendbare Feature-Dokumente konfigurieren,  
**damit** TAGs und Ranges sicher auf feste öffentliche Aktionen oder PWA-Routen verweisen.

**Akzeptanzkriterien**

1. Feature-Typen entsprechen ausschließlich dem dokumentierten Routing-Vertrag, etwa `redirect`, `tag-vault`, `tag-chat`, `lost-found`, `tag-guestbook` und `tag-checkin`.
2. Jedes Feature wird gegen ein typspezifisches serverseitiges Schema validiert.
3. URL-Ziele sind absolute erlaubte `https:`- bzw. bei dokumentierten Redirects `http:`-/`https:`-URLs; unbekannte Templates oder Platzhalter werden abgewiesen.
4. Feature-Dokumente enthalten keine personenbezogenen Daten, Geheimnisse, Vault-Inhalte, POI-Nachweise oder Berechtigungszustände.
5. Änderungen an einem wiederverwendeten Feature zeigen betroffene TAGs/Ranges und benötigen eine bewusste Publish-Entscheidung.

### CC-US-021 – Routing-Projektion vor Veröffentlichung prüfen

**Als** TAG-Manager  
**möchte ich** die aus autoritativen Daten abgeleitete KV-Projektion samt Diff prüfen,  
**damit** nur minimale, valide und erwartete Routing-Daten nach Cloudflare gelangen.

**Akzeptanzkriterien**

1. Der Generator erzeugt ausschließlich `tag-range-index`, Gruppen-, Range-Regel-, direkte TAG-Regel- und Feature-Dokumente gemäß `DOMAIN_RULES.md`.
2. Die erzeugte Projektion wird erneut gegen Schemas, Range-Invarianten und Referenzintegrität validiert.
3. Die UI zeigt einen lesbaren Diff zwischen letzter erfolgreicher und geplanter Projektion.
4. Die UI weist ausdrücklich aus, welche Daten nicht publiziert werden, insbesondere Owner-, Vault-, Audit- und POI-Nachweisdaten.
5. Eine fehlerhafte Projektion kann weder in die Outbox noch nach Cloudflare gelangen.

### CC-US-022 – Änderungen zuverlässig nach Staging-KV publizieren

**Als** TAG-Manager  
**möchte ich** eine geprüfte Änderung kontrolliert nach Staging-KV publizieren,  
**damit** ein realer Scan die gewünschte Routingwirkung erhält, ohne Cloudflare-Zugänge im Browser offenzulegen.

**Akzeptanzkriterien**

1. Die fachliche Änderung, das Audit-Ereignis und der Outbox-Auftrag entstehen in einer gemeinsamen DB-Transaktion.
2. Nur der serverseitige Publisher besitzt einen auf den Staging-Namespace beschränkten Cloudflare-Token.
3. Publish-Aufträge sind idempotent und können nach transienten Fehlern ohne doppelte oder widersprüchliche Wirkung wiederholt werden.
4. Erst nach bestätigtem Cloudflare-Erfolg wird die Projektion als veröffentlicht markiert.
5. Fehler zeigen Zeitpunkt, Fehlerklasse und Retry-Status, aber niemals Token oder Secret.
6. Browser, QR-Code und öffentliche TAG-App enthalten keine Cloudflare-Schreibberechtigung.

### CC-US-024 – Öffentliche TAG-Runtime und Sichtbarkeit kontrolliert publizieren

**Als** berechtigte TAG-Managerin bzw. berechtigter TAG-Manager  
**möchte ich** die aus Owner- und Inhaltsfreigaben abgeleitete öffentliche Runtime-Projektion prüfen und kontrolliert veröffentlichen,  
**damit** direkte TAG-URLs, Scan-Ziele, öffentliche Inhalte und PIN-Einstiege konsistent und ohne private Daten funktionieren.

**Akzeptanzkriterien**

1. Die Oberfläche zeigt nur die freigegebenen Runtime-Attribute: kanonische TAG-ID, Revision, Modus (`public`, `pin-required`, `closed`, gegebenenfalls `redirect`), veröffentlichte Block-/Galerie-Zusammenfassung, Lifecycle und Publish-Status.
2. Vor Veröffentlichung zeigt sie einen verständlichen Diff gegen die letzte veröffentlichte Revision sowie betroffene Routing- und Runtime-Änderungen.
3. Owner-ID, Account, Claim-Secret, Owner-Passphrase, Besucher-PIN, Hashes, Sessions, Audit-Rohdaten, Pool- und Bestelldaten werden nie als Runtime-Vorschau oder Publish-Payload ausgegeben.
4. Der Command wird ausschließlich serverseitig autorisiert, validiert und über die Control-Plane-Outbox an den Publisher übergeben; der Browser erhält keine KV-, R2- oder Worker-Schreibberechtigung.
5. `closed`, Sperrung, Ablauf und Archivierung führen über dieselbe kontrollierte Publish-/Unpublish-Kette zu einer neutralen öffentlichen Wirkung.
6. Jede Freigabe, Zurückziehung und fehlgeschlagene oder wiederholte Auslieferung zeigt Korrelations-/Auditreferenz und aktuellen Retry-Status.

### CC-US-023 – Routing sicher entfernen oder neutralisieren

**Als** Plattformadministrator bzw. TAG-Manager  
**möchte ich** Routing für gesperrte, abgelaufene oder archivierte TAGs kontrolliert entfernen bzw. neutralisieren,  
**damit** sie keine alten oder unzulässigen öffentlichen Ziele weiter ausliefern.

**Akzeptanzkriterien**

1. Der Prozess entfernt nicht mehr benötigte direkte Regeln oder veröffentlicht nur eine explizit zugelassene neutrale Routingwirkung.
2. Unpublish ist gleichfalls über Outbox und idempotenten Publisher nachvollziehbar.
3. Nach erfolgreichem Unpublish wird die autoritative Veröffentlichungsmarkierung aktualisiert.
4. Fehlgeschlagene Entfernungen bleiben sichtbar und priorisiert wiederholbar.
5. Die Aktion und ihr Grund werden auditiert.

## CC-I04 – Öffentlicher Basis-Vault und Read-API

### CC-US-030 – Basis-Vault-Inhalte als Entwurf verwalten

**Als** berechtigte Content-Editorin bzw. berechtigter Content-Editor  
**möchte ich** Titel, Beschreibung, optionale Bildreferenz und externen Link eines TAGs bearbeiten,  
**damit** ein Basis-Vault vor Veröffentlichung fachlich vorbereitet werden kann.

**Akzeptanzkriterien**

1. Die Basis-Vault-Felder besitzen einen separaten Veröffentlichungsstatus bzw. eine veröffentlichte Version.
2. Freier HTML-, JavaScript- und iFrame-Inhalt wird nicht angenommen.
3. Externe Links und Bildreferenzen werden serverseitig auf erlaubte Protokolle, Format und Länge validiert.
4. Nicht veröffentlichte Inhalte erscheinen weder in öffentlichen API-Antworten noch in KV.
5. Inhaltsänderungen und Veröffentlichungen werden auditiert.

### CC-US-031 – Nur öffentliche Daten per Read-API ausliefern

**Als** Scanner  
**möchte ich** eine öffentliche TAG-Ansicht mit ausschließlich freigegebenen Basisdaten erhalten,  
**damit** ich nach dem Scan vertrauenswürdig Inhalte ansehen kann, ohne interne Daten einzusehen.

**Akzeptanzkriterien**

1. `GET /api/v1/tags/{tagId}/view` liefert nur explizit veröffentlichte Felder des vereinbarten öffentlichen Vertrags.
2. Nicht vorhandene, nicht veröffentlichte, gesperrte und abgelaufene TAGs liefern eine neutrale Antwort ohne Entwurfs- oder Owner-Informationen.
3. Die API ist read-only, validiert die TAG-ID und besitzt Rate Limits.
4. CORS beschränkt sich auf festgelegte TAG-App-Origins der jeweiligen Umgebung.
5. Cache-Header entsprechen Sichtbarkeit und Widerruf; dynamische oder später private Antworten erhalten `no-store`.
6. Responses enthalten keine Auditdaten, Produktdaten, Tokens, Owner-IDs, POI-Nachweise oder interne Objektpfade.

### CC-US-032 – End-to-End-Staging-Scan nachweisen

**Als** Projektteam  
**möchte ich** einen physischen oder realitätsnahen Staging-Scan vom Edge Router bis zur öffentlichen Basis-Vault nachweisen,  
**damit** die Grenze zwischen Control Plane und öffentlicher Data Plane überprüft ist.

**Akzeptanzkriterien**

1. Ein aktiver Staging-TAG hat eine bestätigte minimale KV-Projektion.
2. Der Scan passiert den Staging-Edge-Router und erreicht die feste TAG-App-Route.
3. Die TAG-App lädt die zugehörige öffentliche Read-API-Antwort und zeigt nur veröffentlichte Daten.
4. Sperren oder Zurückziehen der Veröffentlichung verändern öffentliche Antworten innerhalb der dokumentierten Cache-Grenzen.
5. Positive und negative Ergebnisse werden im gemeinsamen Evidence-Bereich dokumentiert.

## CC-I05 – Produkte, Organisationen und POI

### CC-US-040 – Produktklasse und Laufzeit durch Policy steuern

**Als** Plattformadministrator  
**möchte ich** Produktklassen, Laufzeiten, Limits und zulässige Module zentral versionieren,  
**damit** Tarif- und Schutzregeln nicht im Edge Router oder im Client verstreut sind.

**Akzeptanzkriterien**

1. Mindestens die dokumentierten Produktklassen sind modellierbar: anonymes Demo-, Selbstprint-, physisches Standard-, Premium-/Content-, POI-/Community- und Partner-/Serien-TAG.
2. Policies werden serverseitig bei Aktivierung, Verlängerung und Featurefreigabe geprüft.
3. Änderungen an Policies sind versioniert und auditiert.
4. Der Edge Router erhält keine Tarif-, Quoten- oder Kontostatusdaten.
5. Noch offene kommerzielle Regeln werden als konfigurierbare Defaults, nicht als fest verdrahtete Annahmen umgesetzt.

### CC-US-041 – Organisationen und Betreiberrollen verwalten

**Als** Organization-Admin  
**möchte ich** berechtigte Personen für meine Organisation und zugehörige TAGs verwalten,  
**damit** Serien- und POI-TAGs verantwortbar betrieben werden können.

**Akzeptanzkriterien**

1. Mitgliedschaften und Rollen sind an Organisation und optional TAG-Kontext gebunden.
2. `organization-admin`, `poi-operator`, `poi-editor` und `poi-moderator` besitzen die dokumentierten minimalen Rechte.
3. Betreiberwechsel verlangt eine nachvollziehbare autorisierte Bestätigung.
4. Beim Rollenentzug werden relevante Sessions, Tokens und externe Verbindungen widerrufen oder zur Prüfung markiert.
5. Personen- und Kontaktdaten bleiben privat und gelangen nie in Routing-KV oder öffentliche Read-Responses.

### CC-US-042 – POI-TAG vor Aktivierung prüfen

**Als** Reviewer bzw. Plattformadministrator  
**möchte ich** Betreiber, Standort, Anbringungszustimmung und POI-Konfiguration prüfen,  
**damit** öffentliche Orte nur mit verantwortlicher Zuständigkeit aktiv geschaltet werden.

**Akzeptanzkriterien**

1. Ein POI-TAG ist vor erfolgreicher Prüfung `pending-verification` und nicht öffentlich aktiv.
2. Betreiberkontakt, bestätigter Standort, Zustimmungsnachweis, Meldeweg und akzeptierte Regeln sind als Pflichtnachweise modelliert.
3. Nachweise sind zugriffsgeschützt, nicht öffentlich und nicht Teil der KV-Projektion.
4. Die Freigabe verlangt die berechtigte Review-Rolle; Aktion, Ergebnis und Begründung werden auditiert.
5. `review`, `suspended` und `expired` deaktivieren Check-in- und Guestbook-Funktionen serverseitig.
6. POI-Gästebücher erhalten in der ersten Version ausschließlich manuelle Moderation.

### CC-US-043 – Öffentliche POI-Meldungen bearbeiten

**Als** POI-Operator oder Plattformadministrator  
**möchte ich** gemeldete Probleme nachvollziehbar bearbeiten,  
**damit** falsche, gefährliche oder unzulässige Inhalte zeitnah geprüft werden können.

**Akzeptanzkriterien**

1. Meldungen besitzen Kategorie, Status, Zeitpunkte und datensparsame Kontaktoption.
2. Öffentliche Meldungen sind gegen automatisierten Missbrauch geschützt und werden rate-limitiert.
3. Eine Meldung erzeugt nicht automatisch eine Sperrung; schwere Risiken können einen kontrollierten Review- oder Sperrprozess auslösen.
4. Bearbeitung, Entscheidung und resultierende Status-/Publish-Änderungen werden auditiert.
5. Meldungs- und Moderatorendaten bleiben privat.

## Zurückgestellte Erweiterungen

| Storybereich | Status | Grund |
| --- | --- | --- |
| Private Uploads, Empfängerfreigaben und Einmalfreigaben | deferred | benötigt separate Vault-API-, R2-, Sicherheits-, Retention- und Datenschutzfreigabe |
| Lost & Found, Chat, Guestbook, Check-ins und Campaigns | deferred | eigene spezifizierte Fachdomänen und Laufzeit-APIs erforderlich |
| Payment, Fulfillment und externe Storage-OAuth-Anbindungen | deferred | Produkt-, Compliance- und Integrationsentscheidung erforderlich |
