# Testdaten und Fixtures: TAG-App

## 1. Zweck

Dieses Dokument beschreibt die zulässigen Testdaten für die TAG-App. Es ergänzt die technische Fixture-Quelle unter [`../../../apps/tag-app/src/mocks/publicTagViews.ts`](../../../apps/tag-app/src/mocks/publicTagViews.ts).

Testdaten bleiben nicht geheim, minimal und wiederholbar. Sie repräsentieren keine realen Kunden, Owner, Finder, Besucher oder Standorte.

## 2. Testdaten-IDs

| ID | Zweck | Aktueller Speicherort | Status |
| --- | --- | --- | --- |
| APP-TD-001 | veröffentlichte öffentliche Vault-Ansicht | `apps/tag-app/src/mocks/publicTagViews.ts` | vorhanden |
| APP-TD-002 | syntaktisch ungültige öffentliche TAG-ID | Testargument im Adaptertest | vorhanden |
| APP-TD-003 | formal gültige, aber unbekannte TAG-ID | Testargument im Adaptertest | vorhanden |
| APP-TD-004 | öffentliche Route und Pages-Deep-Link | Staging-Pages-URL mit APP-TD-001 | vorhanden |
| APP-TD-005 | Service-Worker-App-Shell | `apps/tag-app/public/` | vorhanden |
| APP-TD-006 | Router→PWA-Redirect-Testtag `stagv001` | öffentliche PWA-Fixture plus künftiger Staging-Integrationsnachweis | vorbereitet |
| APP-TD-011 | Staging-Vault-Zugangsseed für Gast und Owner | ausschließlich extern gesetzte, nicht versionierte API-/Secret-Konfiguration | vorbereitet |
| APP-TD-012 | Gast-Session und an die Session gebundene eigene Beiträge | künftige serverseitige API-Autorisierungsfixture | geplant |
| APP-TD-007 | Scanner-URL, manuelle Eingabe und simulierte Berechtigungszustände | künftige APP-I02A-Component-/Browser-Fixture | geplant |
| APP-TD-008 | lokale myQR24-Präferenzen und Berechtigungszentrum-Zustände | künftige APP-I02A-Component-Fixture | geplant |
| APP-TD-009 | anonyme, angemeldete und Owner-`TagCapabilities` | künftige APP-I03-Contract-Fixture | geplant |
| APP-TD-010 | veröffentlichter/nicht veröffentlichter/widerrufener API-View | künftige API-Contract-Fixture | geplant |
| APP-TD-020 | Owner- und Session-Fälle ohne echte Credentials | künftige API-Testfixture | geplant |
| APP-TD-030 | Lost-&-Found- und Chat-Statusfälle | künftige API-Testfixture | geplant |
| APP-TD-040 | Guestbook-Zeitfenster und Moderationszustände | künftige API-Testfixture | geplant |
| APP-TD-050 | GeoFence-, Offline- und Campaign-Credit-Fälle | künftige API-Testfixture | geplant |

## 3. Aktuelle Fixtures

### APP-TD-001 — veröffentlichte öffentliche Vault-Ansicht

Die aktuelle Fixture verwendet eine nicht produktive, kanonische Base36-Tag-ID. Sie darf ausschließlich enthalten:

- öffentliche TAG-Bezeichnung und Präsentation;
- typisierte Vault-Blöcke;
- kontrollierte öffentliche Bild-URLs;
- kontrollierte externe HTTP(S)-Links;
- öffentliche Feature-Hinweise.

Sie darf nicht enthalten:

- Owner- oder Empfängerdaten;
- Sitzungen, Tokens, PINs, Hashes oder Secrets;
- R2-Keys, private Asset-URLs oder signierte URLs;
- Produktions-Tag-IDs oder reale Kundendaten;
- Rohstandorte, Chat-Nachrichten oder Moderationsdaten.

### APP-TD-002 und APP-TD-003 — Fehlerfälle

Ungültige und unbekannte IDs werden direkt als Testargumente im Unit-Test verwendet. Es sind keine Fixtures für nicht öffentliche Inhalte erforderlich; Fehlerfälle dürfen keine versteckten Referenzdaten enthalten.

### APP-TD-004 — Pages-Deep-Link

Der manuelle Staging-Aufruf nutzt ausschließlich die öffentliche, nicht sensible Fixture-ID:

```text
https://main.myqr24-staging-test-pwa.pages.dev/tag/stagv001
```

Die URL ist kein Nachweis einer produktiven Scan-Weiterleitung. Der vollständige Router→PWA-Test wird erst nach Lösung von APP-BLK-001 als APP-TD-006 ergänzt.

### APP-TD-005 — PWA-App-Shell

Die Shell-Testdaten umfassen nur:

```text
/
 /manifest.webmanifest
 /icon.svg
```

Diese Ressourcen entsprechen dem aktuellen Service-Worker-Cache. API-Daten, Tag-Views, persönliche Daten und private Medien sind keine Shell-Testdaten.

### APP-TD-006 — Router→PWA-Redirect-Testtag

`stagv001` ist eine nicht produktive, achtstellige öffentliche Base36-ID. Die PWA-Fixture enthält ausschließlich eine öffentliche Vault-Ansicht ohne personenbezogene Inhalte, Sitzungsdaten, PINs, Hashes oder private Asset-Referenzen.

Nach dem Edge-Router-Seed wird sie ausschließlich für den vollständigen Staging-Nachweis vom Scan-Host über `/t/stagv001` zur TAG-App verwendet. Die öffentliche Pages-Ansicht kann bereits unabhängig vom Router unter APP-TD-004 geprüft werden.

### APP-TD-011 — privater Staging-Vault-Zugangsseed

Die bekannte Staging-Konfiguration stellt getrennte Zugangscodes für Gast- und Owner-Rolle bereit. Die Klartextwerte werden **nicht** in dieser Datei, in Git, in Fixtures, im PWA-Bundle, in Browser-Speicher oder in Evidenz-Screenshots dokumentiert.

Der spätere API-Testseed enthält ausschließlich außerhalb des Repositories:

- Argon2id-Hashes für Owner- und Gastcode;
- Formatpolicy `numeric` und maximales Eingabelimit `20`;
- eine nicht produktive Vault zum öffentlichen TAG `stagv001`;
- Ablauf-, Sperr- und Rate-Limit-Konfiguration für reproduzierbare Tests.

### APP-TD-012 — Gast-Session und eigene Beiträge

Die künftige serverseitige Fixture erzeugt zwei unterschiedliche, fiktive Gast-Sessions am selben TAG. Sie belegt, dass ein Gast nur die durch seine eigene gültige Session angelegten Beiträge ändern oder soft löschen kann. Sie enthält keine echten Sessions, Token-Rohwerte, Codes oder privaten Owner-Inhalte.

### APP-TD-007 — Scanner und Systemberechtigungszustände

Die Fixture verwendet ausschließlich fiktive, bekannte myQR24-URLs und simulierbare Browserergebnisse:

- zulässige myQR24-Scan-URL mit nicht produktiver TAG-ID;
- externe oder unbekannte URL, die nicht intern navigiert wird;
- Kamera-Zustände `granted`, `denied`, `prompt` und `unsupported`;
- keine Browserdialog-Screenshots, Gerätekennungen oder realen Kameradaten.

### APP-TD-008 — lokale Präferenzen und Berechtigungszentrum

Die Fixture deckt ausschließlich lokale, nicht personenbezogene Konfigurationen ab:

```text
scanHistory: disabled | local-only
cameraScanner: enabled | disabled
locationForCheckIn: enabled | revoked
offlineCheckInQueue: disabled
```

Sie enthält keine Rohstandorte, Kontositzungen, persistenten Identifikatoren oder Systemberechtigungszusagen.

### APP-TD-009 — Capability-Contract

Die künftige Contract-Fixture beschreibt mindestens die drei nicht realen Kontexte `anonymous`, `member` und `owner`. Sie enthält nur darstellbare Booleans und eine erlaubte Check-in-Anforderung, beispielsweise `geo-proximity`.

Sie enthält nicht:

- Zugriffstokens, Session-Cookies oder Rollenansprüche;
- private Owner-Daten, Campaign-Fortschritt oder Check-in-Historien;
- eine clientseitige Berechtigungserteilung.

## 4. Künftige API-Contract-Fixtures

Vor APP-I03 entstehen versionierte API-Fixtures mit klarer Sichtbarkeitsklasse:

| Klasse | Erlaubt in öffentlicher Contract-Fixture | Cache-Erwartung |
| --- | --- | --- |
| `public` | freigegebene View-Felder, versionierte öffentliche Medien | kurze dokumentierte TTL oder immutable Medien |
| `unpublished` | nur Testkennzeichnung, nicht als öffentliche API-Response | keine öffentliche Auslieferung |
| `private` | ausschließlich in serverseitigen Autorisierungstests; keine echten Inhalte | `no-store` |
| `revoked` | minimale Referenz für Negativtest | keine öffentliche Auslieferung |

Fixtures müssen gegen den `PublicTagView`-Vertrag validiert werden. Nicht erwartete Felder, vor allem private Metadaten, sind als Contract-Fehler zu behandeln.

## 5. Künftige Feature-Testdaten

### 5.1 Berechtigungen, Präferenzen und Capabilities

- simulierte Browser-API-Ergebnisse statt realer Betriebssystemdialoge;
- fiktive, lokale Präferenzwerte für Aktivierung, Ablehnung und Widerruf;
- Capability-Responses für anonymen Nutzer, angemeldeten Nutzer und Owner;
- keine Gerätekennungen, biometrischen Merkmale, Rohstandorte oder realen Sessions.

### 5.2 Owner und Medien

- generierte Test-Owner-Sessions und abgelaufene/ungültige Varianten;
- fiktive, nicht wiederverwendbare Test-Zugangscodes nur für isolierte serverseitige Tests; bekannte Staging-Codes bleiben außerhalb des Repositories;
- getrennte Gast- und Owner-Hashes sowie abgelaufene, widerrufene und falsche Rollen-Sessions;
- zwei Gast-Sessions zum Nachweis, dass Beiträge nur in der erzeugenden Session geändert oder gelöscht werden dürfen;
- harmlose Testdateien mit passendem und absichtlich falschem MIME-/Dateisignaturpaar;
- keine echten Zugangsdaten, Cookies oder Medien privater Personen.

### 5.3 Lost & Found, Chat und Guestbook

- fiktive Zustände `lost`, `not-lost`, `closed`, `feature-disabled`;
- kurze, nicht personenbezogene Nachrichtentexte;
- Guestbook-Zeitpunkte vor, innerhalb und nach dem Fenster mit kontrollierter Serverzeit;
- Moderationszustände `pending`, `published`, `rejected`, `deleted`.

### 5.4 Check-ins, Collections und Campaigns

- synthetische, grob gerundete Koordinaten ausschließlich für serverseitige GeoFence-Tests;
- kontrollierte Genauigkeiten, Zeitpunkte, Offline-Alter und duplizierte Ereignis-IDs;
- fiktive Besucher- und Campaign-IDs;
- keine realen Bewegungsprofile, Adressen oder personenbezogenen Standortdaten.

## 6. Pflegekonventionen

1. Jede neue Fixture erhält eine `APP-TD-*`-ID und einen Verweis aus Testfall und Traceability.
2. Secrets, Tokens und echte Sessions gehören niemals in Repository, Screenshots oder Evidenz.
3. Testdaten werden klein gehalten; für Tests notwendige Werte werden deterministisch erzeugt.
4. Sichtbarkeits- und Cache-Klassen werden bei API-Fixtures ausdrücklich dokumentiert.
5. Ein Testfehler wird mit minimalen, anonymisierten Daten reproduziert.
6. Bekannte Staging-Zugangscodes werden ausschließlich über einen sicheren Secret-Kanal an berechtigte Tester verteilt und nie in öffentlichen oder versionierten Artefakten wiederholt.
