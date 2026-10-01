# Cloudflare vs. PHP-Webhosting vs. vServer für myQR24

**Status:** Architektur- und Betriebsentscheidungshilfe  
**Datum:** 2026-10-01  
**Zweck:** Gegenüberstellung von Cloudflare, bestehendem PHP-Webhosting bei Dogado und einem vServer für die globale myQR24 QR-/NFC-Tag-Plattform. Das Dokument bewertet Funktionen, Kostenlogik, E-Mail-Anforderungen und eine schrittweise Hybridstrategie für den Probebetrieb.

---

## 1. Ausgangslage

myQR24 benötigt langfristig mehrere unterschiedlich geartete Plattformfunktionen:

1. **globale Tag-Auflösung**
   - NFC-/QR-Scan;
   - Validierung der öffentlichen Tag-ID;
   - sichere Weiterleitung auf eine Anwendung;
   - hohe Verfügbarkeit, geringe Latenz und Schutz vor Missbrauch.

2. **PWA und Fachanwendung**
   - öffentliche Tag-Ansicht;
   - TAG Vault, Lost & Found, Chat, Guestbook und Check-ins;
   - Owner-Dashboard;
   - Sessions, Berechtigungen, Uploads und private Inhalte.

3. **kaufmännische und administrative Funktionen**
   - Registrierung;
   - Account-Einrichtung;
   - Bestellung von Tags;
   - Vertriebs- und Partnerprozesse;
   - Rechnungs- und ggf. ERP-/Shop-Integration;
   - Support und Administration.

4. **E-Mail**
   - bestehende persönliche und geschäftliche Postfächer;
   - Registrierungs-, Bestätigungs- und Passwort-/Account-E-Mails;
   - Vertriebs-, Bestell-, Support- und Systembenachrichtigungen.

Aktuell besteht bereits ein Dogado-PHP-Webhosting mit unter anderem:

- vier Domains;
- PHP-Webserver;
- bis zu 150 MySQL-Datenbanken bzw. Datenbankinstanzen;
- beliebig vielen E-Mail-Konten;
- rund 300 GB Speicher;
- ungefähr **18 EUR pro Monat**.

Die bestehenden E-Mail-Postfächer sollen zunächst **nicht migriert** werden. Die wirtschaftlich sinnvolle Frage ist daher nicht „Cloudflare oder Dogado vollständig ersetzen?“, sondern:

> Welche Aufgaben gehören in der Probebetriebsphase zu Cloudflare, welche verbleiben bei Dogado, und ab welchem Wachstum lohnt sich eine weitergehende Verlagerung?

---

## 2. Kurzentscheidung

Für myQR24 wird zunächst eine **Hybridarchitektur** empfohlen:

| Bereich | Empfohlene Plattform im Probebetrieb |
| --- | --- |
| öffentliche Scan-Domains und Tag-Auflösung | Cloudflare Workers |
| Staging-Test-PWA und spätere PWA-Auslieferung | Cloudflare Pages oder Workers Assets |
| zukünftige globale Application API | Cloudflare Workers |
| öffentliche/private Medien | später Cloudflare R2 |
| bestehende E-Mail-Postfächer | Dogado beibehalten |
| kaufmännische Website, Landing Pages, Bestellung oder Shop | zunächst Dogado-PHP, falls dies die schnellste vorhandene Lösung ist |
| transaktionaler E-Mail-Versand | zunächst vorhandener bzw. separater SMTP-/Transactional-E-Mail-Dienst; nicht Cloudflare Pages/Workers allein |
| klassische MySQL-basierte Backoffice-/Shop-Funktionen | zunächst Dogado-MySQL |
| besondere, dauerhafte Compute- oder Spezialworkloads | bei Bedarf vServer oder Managed Service prüfen |

Diese Entscheidung vermeidet zwei ungünstige Extreme:

- **kein vollständiger Umzug zu Cloudflare**, bevor die Produkt- und Umsatzentwicklung dies rechtfertigt;
- **kein Verzicht auf Cloudflare** für die globale, sicherheitskritische Scan- und PWA-Strecke, obwohl dieser Bereich besonders gut zu Workers, CDN und Edge-Auslieferung passt.

---

## 3. Direkte Antworten auf die aktuellen Architekturfragen

### 3.1 Dogado für E-Mail, SMTP und POP3/IMAP weiterverwenden

**Ja.** Dogado kann im Probebetrieb weiterhin der E-Mail-Provider für bestehende geschäftliche und persönliche Postfächer sein, sofern der gebuchte Tarif die benötigten Protokolle und Versandlimits bereitstellt.

```text
E-Mail-Client
  ├─ IMAP oder POP3: Abruf des Postfachs
  └─ SMTP: Versand über Dogado

myQR24 Application API
  └─ SMTP oder E-Mail-Provider-API: Versand transaktionaler Systemmails
```

Empfehlung:

1. Bestehende Dogado-Postfächer und deren IMAP-/POP3-Zugang unverändert betreiben.
2. Dogado-SMTP kann in der Startphase für geringe Mengen transaktionaler E-Mails verwendet werden, wenn der Tarif dies zulässt.
3. Vor produktiven Registrierungs-, Passwort-Reset- und Bestellmails prüfen:
   - SMTP-Versandlimit pro Stunde/Tag;
   - zulässige Absenderadressen;
   - Authentisierung und TLS;
   - SPF-, DKIM- und DMARC-Konfiguration;
   - Bounce-/Fehlerbehandlung;
   - Logging und Datenschutz.
4. Bei wachsendem Versandvolumen wird ein dedizierter Transaktions-E-Mail-Anbieter hinter einem austauschbaren E-Mail-Adapter ergänzt. Die bestehenden Dogado-Postfächer müssen dafür nicht migriert werden.

Cloudflare kann die DNS-Zonen verwalten, ohne die Mailprovider-Rolle von Dogado zu verändern. Die bestehenden MX-, SPF-, DKIM- und DMARC-Einträge müssen bei einem DNS-Umzug nach Cloudflare vollständig übernommen und getestet werden. DNS-Einträge für Maildienste sind nicht proxied.

### 3.2 Nutzer- und TAG-Stammdaten: MySQL/PHP ist eine tragfähige Startoption

**Ja.** Eine klassische PHP-/MySQL-Anwendung kann für Nutzer-, Account-, Bestell- und TAG-Stammdaten im Probebetrieb sinnvoll sein. Das vorhandene Dogado-Paket stellt hierfür bereits bezahlte, bekannte Infrastruktur bereit.

Geeignete MySQL-Daten für eine kaufmännische bzw. administrative Kernanwendung:

- Nutzerkonten und Owner-Profile;
- Registrierungen und E-Mail-Verifikationsstatus;
- Bestellungen, Lieferadressen, Rechnungsreferenzen und Vertriebszuordnungen;
- physische TAG-Chargen, Zuordnung und Aktivierungsstatus;
- Tag-Lebenszyklus, solange dieser keine Edge-Entscheidung ist;
- Produkt-, Preis- und Shopdaten;
- Support- und Verwaltungsdaten;
- E-Mail-Versandaufträge und Zustellereignisse;
- Audit-Ereignisse für Backoffice-Aktionen.

Die technische Trennung bleibt entscheidend:

```text
Dogado PHP / MySQL
  - Kunden-, Bestell- und kaufmännische Stammdaten
  - TAG-Vergabe und Aktivierungsworkflow
  - Corporate Website / Shop / Backoffice
                 │
                 │ signierte, versionierte Server-zu-Server-API
                 ▼
Cloudflare Application API
  - öffentliche und private TAG-Fachfunktionen
  - Vault, Chat, Guestbook, Check-ins
  - Session- und Berechtigungsentscheidung
  - Inhalte, Freigaben und fachlicher Audit
                 │
                 ▼
Cloudflare Edge Router
  - ausschließlich öffentliche Tag-Auflösung
  - keine Datenbankverbindung zu Dogado
```

Der Edge Router darf weiterhin nicht direkt auf Dogado-MySQL zugreifen. Er verwendet sein eigenes, read-optimiertes `TAG_CONFIG`-KV. Ein kontrollierter Provisionierungsprozess überträgt nur die für das Routing benötigte, nicht geheime Konfiguration in KV, beispielsweise Range, Gruppe und festes Feature-Redirect-Ziel.

**Entscheidungsoption für die erste Produktversion:**  
D1 ist für die Tag-Fachanwendung vorgesehen, aber nicht zwingend ab dem ersten produktiven Nutzer erforderlich. Eine anfängliche MySQL-System-of-Record-Variante ist vertretbar, wenn folgende Regeln eingehalten werden:

- Die PWA spricht niemals direkt mit MySQL, sondern nur mit einer Application API.
- Die Application API kapselt Datenzugriffe in einer Repository-/Service-Schicht.
- Shop-/Kunden-/Bestelldaten und öffentliche TAG-Inhalte erhalten eindeutige System-of-Record-Grenzen.
- Synchronisationen zwischen Dogado und Cloudflare sind idempotent, signiert, versioniert und auditierbar.
- Eine spätere Migration einzelner Fachbereiche nach D1 oder PostgreSQL bleibt ohne Änderung der PWA-API möglich.
- Passwörter und sensible Tokens werden nicht mit einfachen MySQL- oder PHP-Standardhashes behandelt, sondern mit geeigneten, langsamen Passwort-Hash-Verfahren und sicherer Secret-Verwaltung.

### 3.3 D1, R2 und contentreiche TAGs im Probebetrieb

D1 und R2 können für den Probebetrieb wirtschaftlich sinnvoll sein, ihre Kosten hängen jedoch nicht von der Zahl ausgegebener TAGs ab, sondern von realer Nutzung:

- **D1:** Datenbankgröße sowie Lese- und Schreiboperationen;
- **R2:** gespeicherte GB, Objektoperationen sowie gegebenenfalls Auslieferungs- und Integrationszugriffe;
- **Workers:** API-Requests und CPU-Zeit;
- **R2-Medien:** Anzahl, Größe, Abrufe und erzeugte Varianten;
- **Queues, Durable Objects und Logdaten:** jeweils nach tatsächlicher Nutzung.

Für eine sehr kleine Testgruppe oder contentarme Vault-Tags sind die verfügbaren Einstiegs- bzw. Freikontingente vieler Cloudflare-Dienste häufig ausreichend oder die Zusatzkosten gering. Konkrete Kontingente, Limits und Preise dürfen jedoch nicht fest eingeplant werden, ohne den zum Aktivierungszeitpunkt gültigen Cloudflare-Plan zu prüfen.

Die vorhandenen rund 250 GB freien Dogado-Speicher können anfangs wirtschaftlich attraktiv sein. Sie sind für einen kleinen, kontrollierten Medienpilot geeignet, **wenn** Zugriffsschutz, Backups, Upload-Limits und Datenschutz sauber umgesetzt werden. Für eine globale, contentreiche TAG-Plattform ist ein ausschließliches PHP-Dateisystem jedoch langfristig meist weniger geeignet als ein Objektstore mit CDN-Integration.

Empfohlene Stufen:

| Phase | Metadaten | Medien | Begründung |
| --- | --- | --- | --- |
| Staging und Redirect-Test | KV für Routing | keine oder Test-PWA-Assets | geringste Kosten und Komplexität |
| kleiner Content-Pilot | Dogado MySQL oder D1 | Dogado-Dateispeicher **oder** R2, bewusst gewählt | reale Nutzung messen |
| öffentlicher Vault-Betrieb | Application API mit klarer Datenzugriffsschicht | R2 für öffentliche, versionierte Medien | globale Auslieferung und klare Objektverwaltung |
| private/umfangreiche Inhalte | D1/MySQL/ggf. PostgreSQL hinter API | privates R2 über Application API | Berechtigungen, Skalierung und sichere Auslieferung |

Für neue öffentliche Vault-Medien ist R2 mittel- bis langfristig die bevorzugte Zielarchitektur. Der Dogado-Speicher kann ein begrenzter Übergangs- oder Backoffice-Speicher sein, sollte aber nicht unkontrolliert zum öffentlichen globalen Medienbackend wachsen.

### 3.4 Owner-eigener Storage, beispielsweise Google Drive

Ein Owner kann grundsätzlich eigenen Speicher wie Google Drive verwenden. Dies sollte jedoch als **optionale externe Speicherintegration**, nicht als ungeprüfter direkter Browser-Link umgesetzt werden.

Nicht zulässig als Produktarchitektur sind:

- beliebige öffentliche Google-Drive-Links als automatische Vault-Inhalte;
- im Browser gespeicherte Google-OAuth-Tokens;
- dauerhaft öffentliche Freigabelinks für eigentlich private Inhalte;
- das Vertrauen auf die Unerratbarkeit einer URL als Zugriffsschutz.

Sichere Ausbaustufen:

| Stufe | Umsetzung | Geeignet für |
| --- | --- | --- |
| 1. Link-Referenz | Owner hinterlegt einen klar gekennzeichneten externen Link | öffentliche, nicht schützenswerte Inhalte |
| 2. Import | Owner autorisiert einmalig den Import ausgewählter Dateien; die Plattform kopiert sie nach R2 | kontrollierte öffentliche oder private Vault-Inhalte |
| 3. Verbundener Storage | Owner verbindet Google Drive per OAuth; Application API liest nur freigegebene Dateien serverseitig | spätere Premiumfunktion mit hohen Sicherheitsanforderungen |

Für Stufe 3 benötigt myQR24 mindestens:

- OAuth-Consent-Flow mit minimalen Scopes;
- verschlüsselte, serverseitig verwaltete und rotierbare Refresh-Tokens;
- Token-Entzug und Owner-seitige Trennung der Verbindung;
- Prüfung von Dateityp, Größe und Berechtigung;
- Caching- und Widerrufskonzept;
- Datenschutzinformation und Auftrags-/Drittlandbewertung;
- Fehlerbehandlung, wenn eine Datei in Google Drive gelöscht oder die Freigabe geändert wird.

**Empfehlung:** Zunächst Stufe 1 für ausdrücklich öffentliche Links oder Stufe 2 als kontrollierten Import nach R2 vorsehen. Eine dauerhafte Google-Drive-Verbindung wird erst eingeführt, wenn ein klarer Kundennutzen besteht und die OAuth-, Datenschutz- und Supportkosten gerechtfertigt sind.

---

## 4. Vergleich auf einen Blick

| Kriterium | Cloudflare | Dogado PHP-Webhosting | vServer / VPS |
| --- | --- | --- | --- |
| Primäres Modell | Edge-/Serverless-Plattform und CDN | klassisches Shared Hosting | selbst verwalteter virtueller Server |
| Globale Scan-Latenz | sehr gut durch Edge-Ausführung | abhängig vom einzelnen Hosting-Standort | abhängig vom Serverstandort |
| QR-/NFC-Tag-Routing | sehr gut mit Workers | möglich mit PHP, aber zentraler Server | möglich, aber eigener Betrieb |
| Statische PWA | sehr gut mit Pages/Assets | gut, aber ohne native globale Edge-Architektur | gut, aber selbst zu betreiben |
| API-Logik | sehr gut für requestorientierte APIs | gut für klassische PHP-APIs | sehr flexibel |
| PHP-Anwendung | nicht nativ | sehr gut | sehr gut nach eigener Einrichtung |
| MySQL | nicht als nativer Cloudflare-Kerndienst | vorhanden | selbst/managed betreiben |
| E-Mail-Postfächer | kein Ersatz für klassisches Mailhosting | bereits vorhanden | selbst zu betreiben oder extern einkaufen |
| Transaktionaler E-Mail-Versand | nur mit bewusst gewähltem Versanddienst/Integration | oft per SMTP möglich | selbst oder über Versanddienst |
| Objekt-/Medienspeicher | R2, gut skalierbar | Dateispeicher, tarifabhängig | Dateisystem/Object Storage selbst wählen |
| Realtime / atomare Spezialfälle | Durable Objects | nur mit eigener Architektur | selbst implementieren/betreiben |
| Hintergrundjobs | Queues/Consumer | Cron/PHP, hostingabhängig | volle Kontrolle |
| TLS/CDN/DDoS-Schutz | weitgehend integriert | tarif- und konfigurationsabhängig | selbst ergänzen |
| WAF / Rate Limits / Bot-Schutz | gut integrierbar | meist begrenzt oder zusätzlich | selbst einrichten oder zukaufen |
| Serveradministration | gering | gering bis mittel | hoch |
| Kostenmodell | nutzungs- und planabhängig | fixer Bestandstarif | fixer Serverpreis plus Betriebsaufwand |
| Vendor Lock-in | Cloudflare-spezifische Bindings möglich | PHP/MySQL relativ portabel | geringere Plattformbindung, höhere Eigenverantwortung |
| Geeignet für myQR24-Prototyp | ja, für Scan/PWA/API | ja, für Shop/E-Mail/klassische Backoffice-Funktionen | meist noch nicht nötig |

---

## 5. Cloudflare: Nutzen und Grenzen für myQR24

### 5.1 Besonders gut passende Funktionen

### Globale Tag-Auflösung

Cloudflare Workers sind für den bestehenden Edge Tag Router besonders geeignet:

```text
https://s.qx4.uk/{tagId}
https://s.myqr24.com/t/{tagId}
        │
        ▼
Cloudflare Worker
        │
        ▼
validierter Redirect oder JSON-Aktionsdokument
```

Vorteile:

- Verarbeitung nahe am Scan-Nutzer;
- schnelle, global verteilte Auslieferung;
- DDoS-Abschirmung und CDN-Netzwerk;
- sichere Bindung von Secrets;
- klare, kontrollierte Worker-Routen;
- keine Pflege eines klassischen Servers für die Scan-Auflösung.

Der Router bleibt ein klar abgegrenzter Resolver. Er ist nicht für Shop, E-Mail, Kundenverwaltung oder Fachzustände gedacht.

### PWA-Auslieferung

Cloudflare Pages oder Workers Assets eignen sich für:

- Staging-Test-PWA;
- spätere PWA-App-Shell;
- öffentliche, versionierte JavaScript-, CSS- und Icon-Dateien;
- schnelle globale Auslieferung;
- Preview-Deployments und kontrollierte Releases.

### Application API

Ein separater Application API Worker kann später behandeln:

- öffentliche Tag-Views;
- Owner- und Besucher-Sessions;
- Berechtigungen;
- Vault-/Chat-/Guestbook-/Check-in-Logik;
- private Medienauslieferung;
- Webhooks zu Bestell-, Account- oder E-Mail-Systemen.

### Daten und Medien

| Cloudflare-Dienst | Sinnvolle Funktion bei myQR24 |
| --- | --- |
| Workers KV | Tag-Range-, Gruppen- und Feature-Auflösung im Edge Router |
| D1 | relationale Anwendungsdaten, Metadaten, Sessions, Audit |
| R2 | Bilder, Audio, PDFs, Uploads und Exporte |
| Durable Objects | atomare Einmalaktionen, Limits, Rewards, Realtime |
| Queues | Medienprüfung, Varianten, Benachrichtigungen, Hintergrundaufgaben |
| Turnstile | Schutz von Chat, Guestbook, Formularen und riskanten Aktionen |
| WAF / Rate Limiting | Schutz von PWA, API und Login-/Upload-Routen |
| Access | Schutz interner Staging-, Support- und Admin-Oberflächen |

Eine detaillierte Dienstübersicht befindet sich in
[Cloudflare-Plattformbausteine für myQR24](CLOUDFLARE_PLATFORM_CAPABILITIES.md).

### 5.2 Was Cloudflare nicht unmittelbar ersetzt

Cloudflare ist keine vollständige Standard-Webhosting-Suite. Insbesondere ersetzt Cloudflare nicht automatisch:

- klassische IMAP-/POP3-Postfächer;
- vollwertige Mailbox-Verwaltung für Mitarbeiter;
- beliebig viele MySQL-Instanzen wie beim vorhandenen Webhosting;
- ein komplettes Shop-, ERP-, CRM- oder Buchhaltungssystem;
- einen universellen Linux-Server für beliebige lang laufende Prozesse;
- fertige SMTP-Transaktionszustellung einschließlich Reputation, Bounce-Management und Vorlagenverwaltung.

Cloudflare Email Routing kann eingehende E-Mails weiterleiten. Es ersetzt jedoch nicht ohne zusätzliche Komponenten einen vollständigen geschäftlichen E-Mail-Provider oder einen professionellen Versanddienst für Registrierungs- und Bestellmails.

---

## 6. Dogado PHP-Webhosting: Nutzen und Grenzen für myQR24

### 6.1 Stärken des vorhandenen Pakets

Das bestehende Dogado-Paket hat bereits bezahlte und für den Probebetrieb wertvolle Fähigkeiten:

| Vorhandene Fähigkeit | Möglicher Nutzen für myQR24 |
| --- | --- |
| PHP | klassische Webformulare, Admin-Seiten, einfache Bestellstrecken |
| MySQL | Shop-/Backoffice-Daten, Leads, Vertriebsdaten, CMS-Daten |
| E-Mail-Postfächer | Geschäfts-, Support- und Vertriebsadressen bleiben unverändert nutzbar |
| SMTP-Zugang, soweit im Tarif vorhanden | einfache System-E-Mails in der Startphase |
| 300 GB Speicher | Dokumente, Backups oder nicht hochskalierende Webinhalte |
| bestehende Domains | Landing Pages, Vertrieb, Support und Unternehmensauftritt |
| fixer Monatspreis | gut kalkulierbarer Bestandsteil |

Für ungefähr 18 EUR monatlich liefert das Paket bereits einen wirtschaftlich sinnvollen Grundbetrieb für klassische Geschäftsprozesse. Es gibt keinen technischen oder wirtschaftlichen Grund, diese Funktionen im Probebetrieb vorschnell aufzugeben.

### 6.2 Geeignete Aufgaben bei Dogado

Dogado kann zunächst sinnvoll bleiben für:

- Corporate Website;
- SEO-/Landing-Pages;
- Vertriebsseiten;
- Kontaktformulare;
- einfache Tag-Bestellstrecke;
- Anbindung eines PHP-basierten Shops oder bestehenden CMS;
- MySQL-gestützte kaufmännische Daten;
- Support- und Vertriebs-E-Mail-Postfächer;
- manuelle oder halbautomatische interne Verwaltungsprozesse.

Die Tag-Bestellung kann beispielsweise zunächst in einer klassischen, vorhandenen PHP-/MySQL-Umgebung erfolgen. Nach erfolgreicher Bestellung wird über eine klar definierte, signierte oder authentisierte Server-zu-Server-Schnittstelle ein Auftrag an die spätere myQR24-Application API übergeben.

```text
Dogado Shop / Bestellformular
  │
  │ geprüfter Server-zu-Server-Auftrag
  ▼
myQR24 Application API
  │
  ├─ Tag-/Owner-Daten
  ├─ Tag-Zuweisung
  └─ Audit-Ereignis
```

Die öffentliche Scan-Auflösung bleibt davon getrennt beim Cloudflare Edge Router.

### 6.3 Grenzen des Shared PHP-Hostings

Für die globale Kernplattform sind folgende Grenzen zu beachten:

- Ausführung erfolgt typischerweise an einem oder wenigen Hosting-Standorten;
- keine Edge-Ausführung für Scan-Requests;
- Skalierung, Rate Limiting, WAF und DDoS-Schutz sind tarif- und providerabhängig;
- Hintergrundprozesse, Realtime und Upload-Pipelines sind häufig eingeschränkt;
- Shared-Hosting-Limits können bei vielen gleichzeitigen Tag-Scans oder API-Aufrufen relevant werden;
- direkte Kopplung zwischen Shopdaten und Tag-Resolver würde die sicherheitskritische Architektur verschlechtern.

Daher wird Dogado nicht als Zielplattform für den globalen Tag Router verwendet. Es bleibt ein sinnvoller Baustein für E-Mail und klassische kaufmännische Webfunktionen.

---

## 7. vServer: Nutzen und Grenzen für myQR24

### 7.1 Wann ein vServer sinnvoll sein kann

Ein vServer ist sinnvoll, wenn eine Funktion langfristig eine frei steuerbare Linux-Umgebung benötigt, zum Beispiel:

- spezialisierte Hintergrundverarbeitung;
- langfristige Worker-Prozesse;
- komplexe Bild-, Audio- oder Videokonvertierung;
- spezielle Drittsoftware mit eigener Laufzeit;
- selbst verwaltetes PostgreSQL;
- Volltextsuche oder Analyse-Stack;
- ein etabliertes Shop-/ERP-System, das Shared Hosting übersteigt;
- besondere Netzwerk- oder Compliance-Anforderungen.

### 7.2 Nachteile in der aktuellen Phase

Für die Staging-Test-PWA und den Edge Router ist ein vServer nicht erforderlich. Er verursacht zusätzlich:

- laufende Fixkosten;
- Betriebssystem-, Webserver- und Sicherheitsupdates;
- TLS-, Backup-, Monitoring- und Incident-Verantwortung;
- DDoS- und Skalierungsplanung;
- erhöhte Komplexität bei Ausfall und Wiederherstellung.

Ein vServer sollte deshalb erst eingeführt werden, wenn ein konkreter Workload nicht sinnvoll mit Cloudflare, Dogado oder einem Managed Service abgedeckt werden kann.

---

## 8. E-Mail: klare Trennung von Postfächern und Transaktionsversand

E-Mail hat zwei technisch unterschiedliche Aufgaben. Diese dürfen nicht vermischt werden.

| E-Mail-Art | Beispiele | Empfohlene Startlösung |
| --- | --- | --- |
| persönliche/geschäftliche Postfächer | `info@`, `support@`, `vertrieb@`, individuelle Mitarbeiterpostfächer | Dogado unverändert beibehalten |
| transaktionale Systemmails | Registrierung, Bestätigung, Passwort-Reset, Bestellung, Rechnungshinweis, Tag-Aktivierung | dedizierter SMTP-/Transactional-E-Mail-Dienst oder zunächst vorhandener SMTP-Zugang |
| eingehende Automationsmails | Antworten auf Support, spezielle Alias-Adressen, automatisierte Verarbeitung | später gezielt Email Routing/Email Workers oder Webhook-Integration prüfen |
| Marketing-/Newsletter-Mails | Kampagnen, Vertriebsnewsletter | spezialisierter Consent- und Zustellbarkeitsdienst |

### 8.1 Empfehlung für die Startphase

1. **Dogado-Mailkonten bleiben unverändert aktiv.**
2. DNS-MX-Records bleiben auf den bisherigen Maildienst ausgerichtet.
3. Cloudflare kann für die DNS-Zone verwendet werden, ohne die Mailpostfächer zu migrieren. MX-, SPF-, DKIM- und DMARC-Einträge müssen dabei vollständig und korrekt übernommen werden.
4. Für System-E-Mails wird ein Versandweg bewusst definiert:
   - zunächst Dogado-SMTP, wenn Versandvolumen, Zustellbarkeit, Limits und Sicherheitsanforderungen ausreichen;
   - bei wachsender Plattform ein dedizierter Transaktionsanbieter mit API/SMTP, Bounce-Handling, Webhooks und Reputationsmanagement.
5. Newsletter und Marketing werden von transaktionalen Mails getrennt behandelt.

### 8.2 Warum ein dedizierter Versanddienst später sinnvoll sein kann

Registrierungs-, Bestell- und Account-E-Mails sind geschäftskritisch. Mit wachsendem Volumen benötigt myQR24 typischerweise:

- kontrollierte Absenderdomain und DKIM;
- SPF und DMARC;
- Zustellstatistiken;
- Bounce- und Complaint-Verarbeitung;
- Retry-Logik;
- Vorlagen und Versionsverwaltung;
- Event-Webhooks;
- Rate Limits und Schutz vor Missbrauch;
- klare Trennung von Marketing- und Transaktionsreputation.

Diese Funktionen liegen nicht automatisch im Umfang einer PWA- oder Worker-Plattform. Die Application API sollte daher eine E-Mail-Schnittstelle verwenden, die einen Anbieterwechsel ermöglicht.

```text
myQR24 Application API
  │
  ▼
E-Mail-Port / Adapter
  ├─ Dogado SMTP in der frühen Phase
  └─ späterer Transactional-E-Mail-Anbieter
```

Die Fachlogik ruft ausschließlich den eigenen E-Mail-Port auf; sie wird nicht an eine konkrete Provider-API gekoppelt.

---

## 9. Kostenlogik im Probebetrieb

### 9.1 Umsatzmodell, Kostenziel und Zielgröße

Als vorläufiges **Umsatzziel** gilt:

```text
1 bis 5 EUR Jahresumsatz je 100 ausgegebene TAGs
= 0,01 bis 0,05 EUR durchschnittlicher Jahresumsatz je ausgegebenem TAG
= 10.000 bis 50.000 EUR Jahresumsatz bei 1 Mio. ausgegebenen TAGs
```

Dies ist ein gemittelter Plattformwert über kostenfreie, selbstgedruckte und zahlende TAGs. Er bedeutet ausdrücklich nicht, dass jedes einzelne TAG jährlich 1–5 EUR einbringen muss.

Ein plausibles Beispiel für ein physisches Koffer-TAG:

```text
Kaufpreis: 5 EUR einmalig
Gültigkeit: bis zu 5 Jahre
rechnerischer Durchschnitt: bis zu 1 EUR Jahresumsatz je verkauftem TAG
```

Bereits eine begrenzte Quote aktiver, zahlender TAGs kann damit den Zielkorridor stützen. Die genaue Wirtschaftlichkeit muss jedoch aus realen Konversions-, Verlängerungs-, Scan-, Support- und Mediennutzungsdaten abgeleitet werden.

Die Plattformkosten werden getrennt vom Umsatzmodell gesteuert:

| Kostenebene | Enthaltene Leistungen | Ziel |
| --- | --- | --- |
| Basis je ausgegebenem TAG | Scan-Auflösung, Router-Konfiguration, minimale PWA-Auslieferung | sehr niedrig und stark skalierbar |
| Nutzung je aktivem TAG | API-Aufrufe, Views, kleinere Metadatenzugriffe | anhand realer Aktivität kalkulieren |
| content- und featureabhängig | GB-Speicher, Medienabrufe, Uploads, Realtime, E-Mail, KI, Video | verursachergerecht begrenzen oder bepreisen |

Ein TAG darf technisch nicht automatisch zu unbegrenztem Speicher oder unbegrenzter Auslieferung berechtigen. Produktregeln sollten deshalb je Tarif bzw. TAG-Produkt definieren:

- maximaler Speicher je Owner oder TAG;
- zulässige Dateitypen und maximale Dateigröße;
- Anzahl öffentlicher Medien;
- Abruf- bzw. Bandbreitenlimits für teure Inhalte;
- Retention und Löschregeln;
- kostenpflichtige Erweiterungen für großen Speicher, Video oder externe Storage-Integrationen.

### 9.2 Free-Tags, selbstgedruckte TAGs und Missbrauchsgrenzen

Kostenfreie TAGs sind als Akquisitions- und Testkanal sinnvoll, dürfen aber keine unbegrenzte Umgehung kostenpflichtiger Leistungen ermöglichen. Für die erste Produktversion wird folgendes Produktmodell empfohlen:

| TAG-Typ | Ziel | Gültigkeit | Funktionsumfang | Vorgeschlagene Grenze |
| --- | --- | --- | --- | --- |
| Free-/Test-TAG | Kennenlernen der Plattform | begrenzt, z. B. 30 Tage | minimierte öffentliche Tag-Ansicht, kein oder sehr kleiner Medienspeicher | maximal 3 aktive Test-TAGs je verifiziertem Konto |
| selbstgedrucktes TAG | eigene QR-/NFC-Nutzung testen | begrenzt, z. B. 30 Tage | wie Free-/Test-TAG; keine teuren oder privaten Funktionen | Verlängerung oder Upgrade erforderlich |
| physisches Koffer-TAG | langfristiger Privatnutzen | bis zu 5 Jahre nach Produktregel | Lost & Found und definierte Vault-Funktionen | Kaufpreis, z. B. 5 EUR einmalig |
| Premium-/Content-TAG | umfangreiche oder kommerzielle Nutzung | tarifabhängig | höherer Speicher, Medien, private Freigaben und Zusatzfunktionen | nutzungs- oder jahresbasiertes Entgelt |

Ein reines Limit „maximal drei TAGs je Account“ ist allein nicht ausreichend, weil ein Nutzer weitere Accounts erstellen kann. Die Plattform soll deshalb keine harte, fehleranfällige Einzelmaßnahme verwenden, sondern mehrere abgestufte Signale kombinieren:

1. **E-Mail-Verifikation** vor Aktivierung eines Free-TAGs.
2. **Turnstile und Rate Limits** bei Registrierung, Erstellung und Reaktivierung von Test-TAGs.
3. **Cooldowns**: Ein neues Test-TAG erst nach einer begrenzten Wartezeit; abgelaufene Test-TAGs nicht unbegrenzt sofort erneut erzeugen.
4. **Missbrauchs- und Risikoregeln**: ungewöhnlich viele Registrierungen, Erstellungen oder Scans werden serverseitig gedrosselt oder zur zusätzlichen Prüfung markiert.
5. **Kostenintensive Funktionen ausschließen**: Free-TAGs erhalten keine großen Uploads, privaten Freigaben, Realtime-Funktionen oder unbegrenzten Medienabrufe.
6. **Upgrade statt Neuanlage**: Ein abgelaufenes Test-TAG soll für den Owner sichtbar auf ein kostenpflichtiges physisches oder digitales Produkt hochgestuft werden können.
7. **Manuelle Ausnahmebehandlung** für legitime Sonderfälle, damit Familien, Schulen oder Organisationen nicht pauschal aufgrund gemeinsamer IP-Adressen gesperrt werden.

IP-Adressen, Browsermerkmale oder Geräteinformationen dürfen dabei nicht als alleinige Identitätsentscheidung dienen. Ihre Verwendung für Missbrauchsschutz benötigt ein datensparsames Konzept, kurze Aufbewahrungszeiten, transparente Datenschutzhinweise und eine Möglichkeit zur menschlichen Überprüfung.

### 9.3 Wirtschaftliche Leitplanken für contentreiche TAGs

Das Umsatzziel von 1–5 EUR je 100 ausgegebenen TAGs und Jahr kann nicht dauerhaft große, unbegrenzte Content-Nutzung subventionieren. Deshalb werden die Angebote fachlich getrennt:

- **Free-/Test-TAGs:** minimale Inhalte, kurze Laufzeit und praktisch keine speicher- oder bandbreitenintensiven Leistungen.
- **physische Standard-TAGs:** klar begrenzter Funktionsumfang und Speicher; der einmalige Kaufpreis deckt überwiegend Routing, Basisansicht und eine begrenzte Nutzungsdauer.
- **contentreiche Vault-TAGs:** harte Speicher-, Dateigrößen- und Abrufgrenzen; bei höherem Bedarf Upgrade oder Zusatzpaket.
- **Video, viele private Downloads und externe Storage-Verbindungen:** erst als kostenpflichtige Zusatzfunktion nach belastbarer Kostenkalkulation.

Auf diese Weise bleibt die globale Tag-Auflösung sehr günstig, während speicher- und trafficintensive Angebote nur dort Kosten auslösen, wo ein passender Erlös oder ein klar begrenztes Kontingent vorhanden ist.

### 9.4 Bestehende Fixkosten

Das vorhandene Dogado-Paket kostet ungefähr:

```text
ca. 18 EUR pro Monat
```

Dieser Betrag fällt voraussichtlich auch dann an, wenn Cloudflare für Edge Router und Test-PWA hinzukommt, da E-Mail-Postfächer und klassische Webhosting-Funktionen zunächst erhalten bleiben.

Die Frage ist deshalb:

> Welche zusätzlichen Cloudflare-Kosten entstehen über den bestehenden Fixbetrag hinaus, und welchen Sicherheits-, Skalierungs- und Betriebsnutzen liefern sie?

### 9.5 Erwartete Cloudflare-Kostenblöcke

Die genauen Preise, Kontingente und Limits ändern sich. Vor jeder produktiven Aktivierung sind deshalb die aktuell gültigen Cloudflare-Preise und der konkrete Account-Plan zu prüfen.

| Baustein | Im frühen Probebetrieb | Bei Wachstum |
| --- | --- | --- |
| DNS / CDN / TLS | häufig geringer Zusatzaufwand | abhängig von Zonen-/Sicherheitsanforderungen |
| Workers Edge Router | requests- und planabhängig | wächst mit Scan-Requests |
| Pages Test-PWA | häufig sehr geringer Aufwand | abhängig von Builds, Auslieferung und Plan |
| KV | geringer bei wenigen Routingkonfigurationen | abhängig von Reads/Writes und Nutzungsmuster |
| WAF / Rate Limiting | plan- und regelabhängig | mit öffentlich erreichbaren APIs wichtiger |
| D1 | zunächst nicht nötig für reinen Routertest | abhängig von Reads, Writes und Speicher |
| R2 | zunächst nicht nötig für Test-PWA | abhängig von Speicher, Operationen und Medienzugriffen |
| Durable Objects / Queues | zunächst nicht nötig | abhängig von Nutzungs- und Verarbeitungsvolumen |
| E-Mail-Versanddienst | optional | abhängig von gesendeten Mails und Zusatzfunktionen |

### Wichtiger Kostenmaßstab: Tags sind nicht Requests

Eine Zahl wie „1 Mio. TAGs“ ist allein keine ausreichende Kostenkennzahl. Relevant sind mindestens:

- wie viele der Tags tatsächlich aktiv sind;
- wie häufig ein Tag pro Monat gescannt wird;
- wie viele Scan-Requests zu PWA-/API-Requests führen;
- wie viele Medien gespeichert und ausgeliefert werden;
- wie viele Chat-, Guestbook- oder Check-in-Schreibvorgänge entstehen;
- wie viele Systemmails versendet werden;
- welche Sicherheits- und Logging-Features aktiviert sind.

Beispielhafte Lastformel:

```text
Scan-Requests pro Monat
= aktive Tags
  × durchschnittliche Scans je aktivem Tag und Monat
```

Bei 1 Mio. ausgegebenen Tags können die Kosten sehr unterschiedlich sein:

| Szenario | Aktive Tags | Scans pro aktivem Tag / Monat | Scan-Requests / Monat |
| --- | ---:| ---:| ---:|
| niedrige Nutzung | 100.000 | 0,5 | 50.000 |
| mittlere Nutzung | 300.000 | 2 | 600.000 |
| hohe Nutzung | 1.000.000 | 5 | 5.000.000 |
| sehr hohe Nutzung | 1.000.000 | 20 | 20.000.000 |

Die Kostenplanung muss auf Basis solcher Nutzungsannahmen erfolgen, nicht nur auf Basis der Anzahl produzierter Tags.

### 9.6 Wirtschaftliche Empfehlung

#### Phase 1: Probebetrieb

Ziel: technische und geschäftliche Hypothesen validieren, ohne unnötige Fixkosten.

- Dogado für E-Mail, Domains, klassische Website und ggf. Bestellstrecke behalten.
- Cloudflare nur für den Staging Edge Router und die kleine Test-PWA einsetzen.
- zunächst keine D1-, R2-, Queue- oder Durable-Object-Nutzung ohne konkrete Fachfunktion.
- Budgetalarme und Nutzungsübersichten ab dem ersten Cloudflare-Deployment einrichten.
- monatlich Scan- und PWA-Nutzung sowie tatsächliche Zusatzkosten dokumentieren;
- Konversion von Free-/Test-TAG zu gekauftem oder kostenpflichtigem TAG messen;
- Speichernutzung und Medienabrufe je Tarifklasse auswerten.

#### Phase 2: Erste zahlende oder wiederkehrende Nutzung

Ziel: den Kern der Tag-Plattform zuverlässig und sicher betreiben.

- Cloudflare Pages/Workers für PWA und Application API ausbauen.
- D1 für autoritative Anwendungsdaten einführen.
- R2 erst mit realen Medienfunktionen aktivieren.
- Turnstile und Rate Limiting vor schreibenden Besucherfunktionen einführen.
- transaktionalen E-Mail-Versand mit einem klaren Adapter und Zustellbarkeitsmonitoring aufsetzen.
- Dogado-Mailkonten weiter betreiben, solange kein Migrationsnutzen besteht.

#### Phase 3: Skalierung Richtung 1 Mio. Tags

Ziel: Kosten, Verfügbarkeit und Fachprozesse anhand realer Nutzung optimieren.

- Prognose auf Basis aktiver Tags und tatsächlicher Requests erstellen.
- Cloudflare-Nutzung nach Dienst getrennt analysieren:
  - Worker Requests/CPU;
  - KV Reads/Writes;
  - D1 Reads/Writes;
  - R2 Speicher/Operationen;
  - Egress und Medienauslieferung;
  - Queues und Durable Objects;
  - WAF/Rate-Limit-Plan.
- Backoffice, Shop, E-Mail und Datenbankstrategie unabhängig bewerten.
- vServer oder Managed PostgreSQL nur für konkret nachgewiesene technische Anforderungen prüfen.
- Cloudflare-Verträge bzw. höherwertige Pläne erst anhand belastbarer Volumen und Umsatzmargen bewerten.

---

## 10. Empfohlenes Hybrid-Zielbild

### 10.1 Probebetrieb

```text
                         Cloudflare
┌──────────────────────────────────────────────────────────────┐
│ qx4.uk / myqr24.com DNS-Zonen                                │
│                                                              │
│ Scan-Domains                                                 │
│   s.qx4.uk/{tagId}                                           │
│   s.myqr24.com/t/{tagId}                                     │
│          │                                                   │
│          ▼                                                   │
│ Edge Tag Router Worker                                       │
│          │                                                   │
│          ▼                                                   │
│ app-staging.myqr24.com                                       │
│ Cloudflare Pages: statische Test-PWA                         │
└──────────────────────────────────────────────────────────────┘
                   │
                   │ klare, spätere API-/Webhook-Grenze
                   ▼
                         Dogado
┌──────────────────────────────────────────────────────────────┐
│ bestehende Mailpostfächer                                    │
│ info@, support@, vertrieb@, ...                              │
│                                                              │
│ Corporate Website / Landing Pages / PHP                      │
│ optional: erste Bestell- oder Vertriebsstrecke               │
│ MySQL für klassische kaufmännische oder CMS-Daten            │
└──────────────────────────────────────────────────────────────┘
```

### 10.2 Mit erster Fachanwendung

```text
NFC-/QR-Scan
  │
  ▼
Cloudflare Edge Router
  │
  ▼
Cloudflare PWA
  │
  ▼
Cloudflare Application API
  ├─ D1: Tag-/Owner-/Feature-/Audit-Daten
  ├─ R2: Medien
  ├─ Queues: asynchrone Verarbeitung
  ├─ Turnstile / WAF / Rate Limits
  └─ E-Mail-Adapter ───────────────► SMTP-/Transactional-E-Mail-Dienst

Dogado bleibt parallel:
  ├─ persönliche und geschäftliche Mailpostfächer
  ├─ Corporate Website / Vertrieb
  ├─ optionaler Shop oder Bestellprozess
  └─ klassische MySQL-Backoffice-Funktionen
```

### 10.3 Integrationsregeln

1. Der Cloudflare Edge Router greift niemals direkt auf Dogado-MySQL oder Dogado-PHP zu.
2. Die PWA kommuniziert für Tag-Fachfunktionen nur mit der autoritativen Application API.
3. Dogado-Shop oder Backoffice integrieren über authentisierte, versionierte Server-zu-Server-APIs oder Webhooks.
4. Gemeinsame Daten erhalten einen klaren System-of-Record:
   - Tag-Fachzustände: Application API/Datenbank;
   - Bestell- und Rechnungsdaten: zunächst Shop-/Backoffice-System;
   - Mailpostfächer: Dogado;
   - E-Mail-Versandereignisse: E-Mail-Service plus Application-Audit.
5. API-Schlüssel, Webhook-Secrets und personenbezogene Daten werden nicht in Browsercode oder Cloudflare KV abgelegt.
6. Jede Integration erhält Idempotenz, Auditierbarkeit, Retry-Strategie und Fehlerbehandlung.

---

## 11. Entscheidungsmatrix nach Funktion

| Funktion | Empfohlene Startplattform | Begründung | Spätere Neubewertung |
| --- | --- | --- | --- |
| Tag-Scan und Redirect | Cloudflare Workers | global, schnell, sicher, bestehende Architektur | nur bei besonderen regulatorischen Anforderungen |
| Test-PWA | Cloudflare Pages | statisch, geringe Betriebsaufwände, gleiche Plattform | kann zur Produkt-PWA wachsen |
| Produkt-PWA | Cloudflare Pages/Workers Assets | CDN, Versionierung, Same-Origin zur API | bei besonderem SSR-/Framework-Bedarf |
| Application API | Cloudflare Workers | Edge-nah, API-fokussiert, gut integrierbar | bei lang laufenden/spezialisierten Prozessen ergänzen |
| Tag-Routing-Konfiguration | Cloudflare KV | read-optimiert, global, bestehendes Konzept | nie als transaktionale Quelle nutzen |
| Tag-/Owner-/Session-Daten | Dogado-MySQL oder Cloudflare D1 hinter einer Application API | vorhandenes MySQL ist als Startoption möglich; API erhält eine stabile Datenzugriffsgrenze | bei Last/Anforderungen D1, PostgreSQL/Hyperdrive oder Managed DB prüfen |
| Bilder, Audio, PDFs | Cloudflare R2 | skalierbarer Objektstore, CDN-Integration | Video separat bewerten |
| Mailpostfächer | Dogado | bereits vorhanden, keine Migrationsnotwendigkeit | bei organisatorischem Bedarf |
| Registrierungsmails | SMTP-/Transactional-Dienst über Adapter | Zustellbarkeit und Events kontrollierbar | Dogado SMTP nur solange ausreichend |
| Corporate Website | Dogado oder Cloudflare Pages | bestehende Lösung kann bleiben | nach Marketing-/CMS-Bedarf |
| Tag-Shop/Bestellung | Dogado-PHP/MySQL als schneller Start | vorhandene Ressourcen, klassische Weblogik | bei Wachstum dedizierten Shop/Service prüfen |
| Background-Jobs | Queues/Consumer, später ggf. vServer | entkoppelt, skalierbar | bei Spezialsoftware |
| Realtime/atomare Freigaben | Durable Objects gezielt | atomare Entscheidungen | nur bei nachgewiesenem Bedarf |
| Admin-/Support-Tools | Cloudflare Access plus API oder Dogado intern | Schutz interner Zugriffe | nach Team-/Compliance-Anforderungen |

---

## 12. Prüfpunkte vor weiteren Investitionen

Vor einer Ausweitung der Cloudflare-Nutzung werden diese Kennzahlen mindestens monatlich bewertet:

### Technische Kennzahlen

- aktive Tags;
- Scan-Requests pro Tag und Monat;
- erfolgreiche Redirects, 404- und 405-Quote;
- PWA-Ladezeit und API-Latenz;
- Worker-Fehlerquote;
- KV-, D1- und R2-Nutzung;
- Medienvolumen und Objektoperationen;
- Queue-Rückstau;
- Turnstile-/WAF-/Rate-Limit-Events;
- E-Mail-Zustell-, Bounce- und Complaint-Rate.

### Wirtschaftliche Kennzahlen

- Cloudflare-Gesamtkosten nach Dienst;
- zusätzliche E-Mail-Versandkosten;
- weiterhin bestehende Dogado-Fixkosten;
- Kosten je aktivem Tag;
- Kosten je Scan;
- Kosten je erfolgreicher Registrierung;
- Kosten je Bestellung;
- Conversion vom Free-/Test-TAG zum zahlenden TAG;
- Umsatz und Deckungsbeitrag pro aktivem Tag;
- erwartete Kostenentwicklung für konservative, realistische und hohe Nutzung.

### Betriebs- und Sicherheitskennzahlen

- Anzahl sicherheitsrelevanter Ereignisse;
- Wiederherstellungszeit bei Fehlern;
- Testabdeckung und Staging-Abnahme;
- Anzahl manueller Backoffice-Prozesse;
- Datenschutz- und Löschanforderungen;
- Abhängigkeit von einzelnen Dienstleistern.

---

## 13. Fazit

Das bestehende Dogado-Paket für ungefähr 18 EUR monatlich ist im Probebetrieb ein wertvoller und bereits bezahlter Baustein. Es sollte insbesondere für bestehende E-Mail-Postfächer sowie gegebenenfalls für klassische PHP-/MySQL-basierte Vertriebs-, Landing- und Bestellfunktionen vorerst erhalten bleiben.

Cloudflare ergänzt dieses Paket dort, wo es einen klaren technischen Vorteil bietet:

- globale, robuste und sichere QR-/NFC-Tag-Auflösung;
- schnelle PWA-Auslieferung;
- schrittweise skalierbare API, Medien- und Sicherheitsdienste;
- geringerer Betriebsaufwand für die globale Kernplattform.

Die empfohlene Strategie lautet daher:

> **Dogado für E-Mail und klassische Geschäftsfunktionen beibehalten; Cloudflare fokussiert für Edge Router, PWA und die globale Tag-Anwendungsplattform einführen; erst mit realem Wachstum und belastbaren Nutzungsdaten über weitergehende Migrationen oder vServer-Komponenten entscheiden.**

Die Schwelle von etwa 1 Mio. ausgegebenen Tags ist ein sinnvoller strategischer Meilenstein, aber keine allein ausreichende Kostenkennzahl. Entscheidend sind aktive Tags, tatsächliche Scans, Medienvolumen, API-Schreiblast und E-Mail-Volumen. Bis diese Daten vorliegen, minimiert die Hybridarchitektur Fixkosten und erlaubt zugleich eine professionelle, global skalierbare Tag-Kernplattform.

---

## 14. Verwandte Dokumente

- [ADR-001: Deployment der myQR24-PWA auf Cloudflare](ADR-001-PWA_DEPLOYMENT_ON_CLOUDFLARE.md)
- [Cloudflare-Plattformbausteine für myQR24](CLOUDFLARE_PLATFORM_CAPABILITIES.md)
- [Cloudflare-native PWA-Komponente](CLOUDFLARE_PWA_COMPONENT.md)
- [TAG-Control-Plane als PHP-Anwendung und Basis-Vault auf Cloudflare](PWA-PHP-Applications/TAG_CONTROL_PLANE_AND_BASIS_VAULT.md)
- [Deployment-Handover: myQR24 Edge Tag Router](../90-Session-Change-Summaries/DEPLOYMENT_HANDOVER.md)
- [Gesamtarchitektur](../ARCHITECTURE.md)
