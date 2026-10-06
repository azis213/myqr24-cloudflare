# Cloudflare-native PWA-Komponente für myQR24

> **Status:** Architekturkonzept  
> **Zweck:** Auslagerung der fachlichen Tag-Anwendung als eigenständige, vollständig auf Cloudflare betriebene PWA- und API-Komponente.  
> **Geltungsbereich:** TAG Vault, TAG Chat, Lost & Found, TAG Guestbook sowie GEO-verifizierte TAG Check-ins mit Collections und Campaigns. Der bestehende Edge-Routing-Worker bleibt davon getrennt.
>
> **Implementierungsstand:** Dieses Dokument beschreibt die Zielarchitektur. Die tatsächlich deployte öffentliche Staging-MVP-App einschließlich Code-Struktur, Fixture-Adapter, Pages-Routing und Betriebsgrenzen ist ergänzend in [TAG_APP_ARCHITECTURE.md](TAG_APP_ARCHITECTURE.md) dokumentiert. Die verbindlichen Regeln für gemeinsame PWA-Navigation, Systemberechtigungen, lokale Präferenzen, serverseitige Capabilities und Fallbacks stehen im [Berechtigungs-, Datenschutz- und Capability-Modell](PWA_PERMISSION_AND_CAPABILITY_MODEL.md).

## 1. Architekturentscheidung

Die PWA-Features werden nicht im bestehenden Edge-Routing-Worker implementiert. Stattdessen entsteht eine eigenständige Cloudflare-Anwendung mit drei klaren Verantwortungsbereichen:

1. **Edge Routing Worker**  
   Validiert die öffentliche Tag-ID, führt Feistel-/HMAC- und Range-Prüfung durch, löst die Feature-Zuweisung aus `TAG_CONFIG` auf und leitet auf eine feste vertrauenswürdige Anwendung weiter.

2. **myQR24 PWA**  
   Stellt öffentliche Scan-Ansichten, Owner-Dashboard und Besucheroberflächen bereit.

3. **Application API Worker**  
   Erzwingt sämtliche fachlichen und sicherheitsrelevanten Regeln: Sichtbarkeiten, Owner-Sessions, Freigaben, Chat- und Eventstatus, Moderation, Uploads, Downloadberechtigungen sowie GeoFence-, Check-in-, Collection- und Campaign-Policies.

Die PWA und API laufen vollständig auf Cloudflare. „PWA/API“ bezeichnet somit eine logische Schicht, keine externe Hosting- oder Backend-Abhängigkeit.

## 2. Zieltopologie

```text
NFC-/QR-Scan
    │
    ▼
https://p.qr4.uk/t/{tagId}
https://p.myqr24.com/t/{tagId}
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ Edge Routing Worker (bestehendes Projekt)                │
│ - URL-, Feistel-, HMAC- und Range-Validierung            │
│ - KV TAG_CONFIG: Range, Regel, Gruppe, Feature           │
│ - sicherer Redirect auf feste PWA-Route                  │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│ Cloudflare Pages / Workers Assets                        │
│ app.myqr24.com                                           │
│ - öffentliche Scan-PWA                                  │
│ - Owner-Dashboard                                       │
│ - Offline-Shell / statische JS-, CSS- und Icon-Assets    │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTPS /api/...
                      ▼
┌─────────────────────────────────────────────────────────┐
│ myQR24 Application API Worker                            │
│ api.myqr24.com oder app.myqr24.com/api                   │
│ - Vault, Chat, Lost & Found, Guestbook, Check-ins        │
│ - Authentisierung, Autorisierung, Upload- und Sync-Flow  │
│ - serverseitige Status-, Sichtbarkeits- und GEO-Prüfungen│
└───────┬──────────────────┬───────────────────┬──────────┘
        │                  │                   │
        ▼                  ▼                   ▼
┌───────────────┐  ┌────────────────┐  ┌────────────────────┐
│ Cloudflare D1 │  │ R2             │  │ Durable Objects    │
│ Metadaten,    │  │ Public Assets  │  │ atomare Einmal-    │
│ Sessions,     │  │ Private Assets │  │ freigaben, Limits, │
│ Freigaben,    │  │ Uploads        │  │ optional Realtime  │
│ Audit         │  └────────────────┘  └────────────────────┘
└───────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│ Queues / Worker Consumers (optional ab Ausbauphase)      │
│ Bildvarianten, Malware-Scan, Transcoding, Notifications  │
└─────────────────────────────────────────────────────────┘
```

## 3. Komponenten und Domains

| Komponente | Empfohlene Domain | Cloudflare-Baustein | Aufgabe |
| --- | --- | --- | --- |
| Edge Resolver | `p.qr4.uk`, `p.myqr24.com` | Worker | sichere öffentliche Tag-Auflösung |
| PWA | `app.myqr24.com` | Pages oder Worker mit Assets | Scan-Ansicht und Owner-Oberfläche |
| API | `app.myqr24.com/api` oder `api.myqr24.com` | Worker | fachliche APIs und Autorisierung |
| Öffentliche Assets | `media.myqr24.com` | R2 Custom Domain | nur versionierte, explizit öffentliche Dateien |
| Private Asset-Auslieferung | API-Route | Worker + privates R2 | autorisierte Downloads/Streams |

### 3.1 Empfehlung für die erste Version

Die PWA und API liegen unter demselben Origin:

```text
https://app.myqr24.com/tag/{tagId}
https://app.myqr24.com/lost-found/{tagId}
https://app.myqr24.com/guestbook/{tagId}
https://app.myqr24.com/check-in/{tagId}
https://app.myqr24.com/collections
https://app.myqr24.com/campaigns
https://app.myqr24.com/owner/tags/{tagId}

https://app.myqr24.com/api/v1/...
```

Vorteile:

- keine CORS-Konfiguration für Browser-API-Aufrufe;
- sichere `HttpOnly`, `Secure`, `SameSite=Strict` Cookies;
- einfache CSP- und Service-Worker-Strategie;
- klare Trennung vom öffentlichen Edge Resolver.

Eine getrennte API-Domain ist später möglich, benötigt aber bewusstes CORS-, Cookie- und CSRF-Design.

## 4. Verantwortungsgrenzen

### 4.1 Edge Routing Worker

Der bestehende Worker bleibt absichtlich klein und zustandslos.

Er darf:

- öffentliche URL, Host, Pfad und Tag-ID validieren;
- Feistel-Decodierung, HMAC-Prüfung und Range-Lookup durchführen;
- Gruppen-, Range- und Tag-Regeln in KV auflösen;
- ein Feature-Aktionsdokument liefern oder auf eine feste PWA-URL redirecten.

Er darf nicht:

- Owner-, Besucher- oder Empfänger-Sessions verwalten;
- private Inhalte oder R2-Keys kennen;
- PINs oder PIN-Hashes verarbeiten;
- Chat-Nachrichten, Lost-&-Found-Status, Guestbook-Fenster oder Check-in-Policies prüfen;
- GeoFence-Koordinaten, GPS-Messwerte, Scan-Ereignisse, Collections oder Campaign-Credits kennen;
- Freigaben oder Einmalzugriffe entscheiden;
- User-generierte Inhalte entgegennehmen.

### 4.2 PWA

Die PWA ist eine UI-Schicht. Sie darf Benutzeraktionen darstellen und API-Aufrufe auslösen, ist aber nicht die Autoritätsinstanz für Berechtigungen.

| Oberfläche | Beispielroute | Hauptaufgabe |
| --- | --- | --- |
| Öffentliche Tag-Ansicht | `/tag/{tagId}` | sichtbare Vault-Inhalte und zulässige Kontextaktionen |
| Lost & Found | `/lost-found/{tagId}` | Verlusthinweis und Finder-Chat-Einstieg |
| Guestbook | `/guestbook/{tagId}` | Event-Beiträge, Gipfelbuch und veröffentlichte Erinnerungen |
| Check-in | `/check-in/{tagId}` | Standortfreigabe, lokale Offline-Queue und synchronisierter Besuch |
| Meine Collections | `/collections` | persönliche, zusammengefasste Besuchssammlungen |
| Meine Campaigns | `/campaigns` | Challenge-Fortschritt, Credits und Rewards |
| Owner-Dashboard | `/owner/tags/{tagId}` | Inhalte, Feature-Status, Uploads, Moderation, Freigaben und Check-in-Standort |
| Owner-Anfragen | `/owner/access-requests` | Zugriffsanfragen und Empfängerfreigaben |

Die PWA darf im Browser keine privaten Daten, Session-Tokens oder geschützten Assets dauerhaft cachen.

### 4.3 Application API Worker

Der Application Worker ist die fachliche Autorität. Er muss bei jedem relevanten Request serverseitig prüfen:

- existiert und gehört das Tag zur erwarteten Owner-/Feature-Konfiguration;
- ist die Owner-, Empfänger- oder Besucher-Session gültig;
- ist ein Vault-Inhalt für die aktuelle Berechtigung sichtbar;
- ist der Chat entsprechend `activationMode` und `chatStatus` offen;
- besitzt Lost & Found den erforderlichen Status `lost`;
- liegt beim Guestbook ein gültiges, offenes Beitragsfenster vor;
- sind Nachrichtentyp, Upload, Umfang, Rate Limit und Moderationsstatus zulässig;
- besteht ein Check-in gegen den aktuellen Owner-GeoFence, Radius und die geforderte GPS-Genauigkeit;
- ist ein Offline-Scan hinsichtlich Alter, Gerätezeit, Konto, Tag und Verifikationslevel plausibel;
- darf ein Ereignis einen vorhandenen Check-in präziser ablösen;
- darf das Ereignis nach Collection- und Campaign-Policy einen Credit bzw. Reward erzeugen.

## 5. Routing vom Edge Worker zur PWA

Das Routing-KV enthält ausschließlich nicht geheime, validierbare Feature-Konfiguration. Beispiel für einen Vault-Redirect:

```json
{
  "id": "vault-standard",
  "type": "tag-vault",
  "enabled": true,
  "appUrlTemplate": "https://app.myqr24.com/tag/{tagId}",
  "presentation": "public-page"
}
```

Die PWA ruft danach ihre API auf:

```text
GET https://app.myqr24.com/api/v1/tags/{tagId}/view
```

Die API darf sich nicht darauf verlassen, dass der Aufruf zwingend über den Edge Resolver erfolgte. Die öffentliche Tag-ID wird erneut validiert und der Tag gegen die autoritative Anwendungsdatenbank geprüft.

### 5.1 Feature-URL-Matrix

| Feature-Typ | PWA-Route | Öffentliche API-Route |
| --- | --- | --- |
| `tag-vault` | `/tag/{tagId}` | `GET /api/v1/tags/{tagId}/view` |
| `tag-chat` | `/chat/{tagId}` oder eingebettet | `GET/POST /api/v1/tags/{tagId}/chat/...` |
| `lost-found` | `/lost-found/{tagId}` | `GET /api/v1/tags/{tagId}/lost-found/view` |
| `tag-guestbook` | `/guestbook/{tagId}` | `GET /api/v1/tags/{tagId}/guestbook/view` |
| `tag-checkin` | `/check-in/{tagId}` | `GET /api/v1/tags/{tagId}/check-in`, `POST /api/v1/tags/{tagId}/check-ins` |

Die PWA kann mehrere Funktionen auf einer einheitlichen Tag-Seite zusammensetzen. Die Routing-Feature-URL bestimmt nur einen sicheren Einstiegspunkt, nicht die vollständige Berechtigungsentscheidung.

## 6. Datenhaltung auf Cloudflare

### 6.1 D1: autoritative Metadaten

D1 ist in der ersten Produktversion die autoritative Datenbank für relationale, fachliche Daten:

- Tag-Metadaten und Owner-Zuordnung;
- Vault-Konfiguration, Inhalte, Sichtbarkeit und Freigaben;
- Owner-, Besucher- und Empfänger-Session-Hashes;
- Chat-Einstellungen, Threads und Nachrichtenmetadaten;
- Lost-&-Found-Fälle;
- Guestbooks, Beitragsfenster, Beiträge und Moderation;
- GeoFence-Versionen, append-only Check-in-Ereignisse und Server-Signaturen;
- Collection-Projektionen, Campaign-Regeln, Credits und Reward-Status;
- Audit-Ereignisse;
- Upload-Vorgänge und Asset-Metadaten.

Sensible Token werden nie im Klartext gespeichert. Persistiert wird nur ein geeigneter kryptographischer Hash.

> Für starke relationale Konsistenz über mehrere Regionen, komplexe Volltextsuche oder sehr hohes Schreibvolumen kann später eine externe PostgreSQL-Datenbank über Hyperdrive ergänzt werden. Die API-Grenze bleibt dabei unverändert.

### 6.2 R2: Binärdaten

R2 speichert Bilder, Audio, PDFs und weitere zugelassene Dateiobjekte. Es werden zwei Sicherheitsklassen strikt getrennt.

| Klasse | Speicher-/Auslieferungsmodell | Cache |
| --- | --- | --- |
| Public immutable | dedizierter öffentlicher Prefix/Bucket und versionierter Object Key; Auslieferung über R2 Custom Domain | `public, max-age=31536000, immutable` |
| Private / zeitlich freigegeben | privater Bucket oder strikt privater Prefix; ausschließlich über Application Worker nach Berechtigungsprüfung | `no-store` |

Ein öffentlicher Asset-Key darf nur für einen explizit veröffentlichten, unveränderlichen Inhalt vergeben werden. Ein Objekt wird nicht durch eine URL allein „privat“; die Zugriffskontrolle erfolgt über die Auslieferungsarchitektur.

Beispielhafte Keys:

```text
public/tags/ab12cd34/hero.7a1d50d3.webp
public/tags/ab12cd34/audio-guide.4f8e0c12.mp3

private/vault/{tagId}/{randomAssetId}/original.pdf
private/chat/{threadId}/{randomAssetId}/photo.jpg
private/guestbook/{contributionId}/{randomAssetId}/voice.m4a
```

Originaldateinamen sind keine Object Keys und werden vor jeder HTML-Ausgabe escaped.

### 6.3 Durable Objects: gezielte Atomizität und Realtime

Durable Objects werden nicht für die gesamte Fachlogik benötigt. Sie sind sinnvoll, wenn eine globale, atomare Entscheidung erforderlich ist:

- Verbrauch einer Einmalansicht oder eines Einmaldownloads;
- harte, tagbezogene Rate Limits;
- Serialisierung konkurrierender Freigabe-, Check-in-, Campaign-Credit- oder Thread-Aktionen;
- atomare Reward-Ausstellung bzw. -Einlösung;
- später: WebSocket-/Realtime-Fan-out pro Chat-Thread oder Event.

Eine D1-Transaktion kann für viele atomare Datenbankoperationen genügen. Durable Objects sollten gezielt eingesetzt werden, wenn die fachliche Anforderung echte per-Schlüssel-Serialisierung oder langlebige Verbindungen verlangt.

### 6.4 Queues und asynchrone Verarbeitung

Uploadabschluss darf nicht voraussetzen, dass aufwendige Verarbeitung innerhalb eines Nutzerrequests fertig ist.

```text
Browser → Upload-Vorgang → R2
        → API bestätigt Upload
        → Queue
        → Consumer validiert / scannt / erzeugt Varianten
        → D1: Asset von uploading zu active oder quarantined
```

Mögliche Consumer-Aufgaben:

- Dateisignatur und tatsächlichen MIME-Type prüfen;
- optionale Malware-Scan-Integration;
- Bildthumbnail und responsive Varianten erzeugen;
- Audiodauer und Metadaten bestimmen;
- Audio-Transkript verarbeiten;
- Benachrichtigung über neue Finder-/Guestbook-Beiträge senden;
- nachträgliche Risikoanalyse oder Review-Queue für auffällige Check-ins auslösen.

## 7. API- und Authentisierungskonzept

### 7.1 Session-Typen

| Session | Zweck | Speicherung im Browser | Persistenz serverseitig |
| --- | --- | --- | --- |
| Owner-Session | Dashboard, Upload, Moderation, Freigaben | `HttpOnly`, `Secure`, `SameSite=Strict` Cookie | gehashter Token in D1 |
| Besucher-Session | eigener Chat-Thread oder eigener Guestbook-Beitrag | `HttpOnly`, `Secure`, `SameSite=Strict` Cookie | gehashter Token in D1 |
| Empfängerfreigabe | genehmigter Zugriff auf geschützte Inhalte | `HttpOnly`, `Secure`, `SameSite=Strict` Cookie | gehashter Token in D1 |
| Upload-Vorgang | einmalige, kurzlebige Uploadberechtigung | nicht als dauerhafte Session | gehashter Upload-Token in D1 |

Bei Cross-Origin-Architektur müssen Cookie-Domain, `SameSite`, CORS und CSRF explizit neu bewertet werden. Für V1 ist Same-Origin empfohlen.

### 7.2 Owner-Authentisierung

Die Tag-PIN kann als lokale Schutzstufe dienen. Für Produktion und insbesondere Remote-Freigaben ist zusätzlich ein Owner-Konto mit Passkey oder äquivalenter starker Authentisierung vorgesehen.

| Aktion | Mindestschutz |
| --- | --- |
| öffentliche Vault-Ansicht | keine Anmeldung |
| lokale Tag-Verwaltung | Owner-PIN + Rate Limits |
| sensible Owner-Aktion | gültige Owner-Session |
| Remote-Zugriffsfreigabe | Owner-Konto / Passkey |
| private Remote-Freigabe | Owner-Konto; optional zusätzliche PIN-Bestätigung |

PINs werden ausschließlich mit Argon2id oder einer vergleichbar langsamen Passwort-Hash-Funktion gespeichert. Die Cloudflare Worker Runtime selbst benötigt dafür eine kompatible Implementierung oder eine isolierte Authentisierungskomponente; eine schnelle SHA-256-/HMAC-Hashung ist nicht zulässig.

### 7.3 Schutzmechanismen

- Cloudflare Turnstile vor erster öffentlicher Nachricht, Event-Beitrag und riskanten Uploads;
- Rate Limits pro Tag, Session-Token und ergänzend IP-Signal;
- CSRF-Schutz für alle Cookie-basierten schreibenden Requests;
- CSP für PWA, keine frei ausführbaren Vault-Inhalte;
- serverseitige Validierung von Eingabelänge, MIME-Type, Dateisignatur und Objektgröße;
- `Cache-Control: no-store` für Sessions, private Antworten, Threads, Nachrichten und geschützte Downloads;
- Audit-Events für sicherheitsrelevante Änderungen und Freigaben.

## 8. Caching- und Offline-Strategie

### 8.1 Öffentliche Inhalte

Öffentliche, versionierte Medien können aggressiv am CDN cachen. Die PWA kann eine kurze API-Cache-Zeit verwenden, wenn eine Veröffentlichung nicht sofort widerrufbar sein muss.

| Antwort | Empfohlene Cache-Regel |
| --- | --- |
| PWA Shell, JS, CSS, Icons | versioniert: langfristig `immutable` |
| öffentliche R2-Medien | versioniert: langfristig `immutable` |
| öffentliche Vault-View ohne dynamische Freigabe | kurze TTL, z. B. 30–60 Sekunden, oder gezielte Invalidierung |
| Lost-&-Found- und Guestbook-Status | `no-store` oder sehr kurze TTL wegen Statuswechsel |
| Owner-Dashboard | `no-store` |
| private/temporär freigegebene Inhalte | `no-store` |
| Check-in-, Collection-, Campaign- und Reward-Antworten | `no-store` |

### 8.2 Service Worker

Der Service Worker darf cachen:

- PWA App Shell;
- öffentliche, immutable JavaScript-/CSS-/Icon-Dateien;
- ausschließlich ausdrücklich öffentliche, versionierte Medien.

Er darf nicht cachen:

- Owner-Dashboard-Antworten;
- Vault-API-Antworten mit `shared` oder `private` Inhalten;
- Chat-Nachrichten;
- Guestbook-Rohbeiträge;
- ausstehende oder synchronisierte Check-in-Ereignisse im Cache Storage;
- Standortdaten;
- Session- oder Freigabeantworten;
- private Asset-Streams und signierte Download-URLs.

## 9. Empfohlene Repository- und Deployment-Aufteilung

Der aktuelle Edge Routing Worker bleibt als eigenes Projekt bzw. eigenes Worker-Deployment bestehen. Die Fachanwendung wird separat versioniert und deployt.

```text
myqr24-edge-routing/               # bestehendes Repository
  src/index.ts                     # Tag-Resolver
  wrangler.toml

myqr24-app/                        # neues eigenständiges PWA-/API-Projekt
  apps/
    web/                           # Cloudflare Pages oder Workers Assets PWA
    api/                           # Application Worker
    consumers/                     # Queue-Consumer, optional
  packages/
    domain/                        # gemeinsame Feature- und API-Typen
    validation/                    # Zod-/Schema-Validierung
    ui/                            # optionale UI-Komponenten
  migrations/                      # D1-Schema-Migrationen
  infrastructure/
    wrangler.api.toml
    wrangler.consumer.toml
```

Eine Monorepo-Variante ist sinnvoll, damit PWA und API denselben Typvertrag nutzen. Der Edge Routing Worker bleibt wegen seines besonders hohen Stabilitäts- und Sicherheitsanspruchs isoliert.

### 9.1 Cloudflare-Ressourcen je Umgebung

| Ressource | Produktion | Staging | Lokal |
| --- | --- | --- | --- |
| Pages-Projekt | `myqr24-app` | Preview-Deployment | Pages Dev |
| API Worker | `myqr24-app-api` | `myqr24-app-api-staging` | Wrangler Dev |
| D1 | eigene Production DB | eigene Staging DB | lokale D1 |
| R2 | getrennte Buckets | getrennte Buckets | Miniflare / Remote Dev |
| KV Routing | bestehendes `TAG_CONFIG` | separates Test-KV | lokale Fixture |
| Queues | Production Queue | Staging Queue | lokale Simulation |
| Secrets | Worker Secrets | getrennte Secrets | `.dev.vars`, niemals committen |

Staging darf niemals auf Production-D1, Production-R2 oder Production-Owner-Sessions zugreifen.

## 10. Umsetzungsphasen

### Phase 0: Fundamente

1. Neues `myqr24-app`-Projekt mit Pages-PWA und Application Worker anlegen.
2. Shared Types und schema-basierte API-Validierung einführen.
3. D1-Migrationen für Tag-Metadaten, Assets, Owner-Sessions und Audit vorbereiten.
4. Private und öffentliche R2-Buckets bzw. klar getrennte Zugriffswege anlegen.
5. Edge-Feature-Redirects auf `app.myqr24.com` konfigurieren.

### Phase 1: Öffentlicher TAG Vault

1. Öffentliche Tag-View-API und PWA-Route implementieren.
2. Owner-Session und PIN-Rate-Limit implementieren.
3. Öffentliche Texte, Galerie und Audioinhalte in D1/R2 abbilden.
4. Öffentliche versionierte Assets über CDN bereitstellen.
5. Owner-Dashboard für Inhalte und Sichtbarkeit bereitstellen.

### Phase 2: Private Vault-Inhalte und Freigaben

1. Private R2-Auslieferung ausschließlich via API Worker.
2. Zeitlich begrenzte `shared`-/`private`-Freigaben.
3. Empfängergebundene Zugriffsanfragen und Widerruf.
4. Atomic-Use-Mechanismus für Einmalansichten, bei Bedarf mit Durable Object.
5. Sicherheits-, Audit- und Cache-Tests.

### Phase 3: TAG Chat und Lost & Found

1. Browsergebundene Chat-Threads und Textnachrichten.
2. `lost-only`-Durchsetzung über Lost-&-Found-Status.
3. Bild-, Voice- und bewusst bestätigte Standortnachrichten.
4. Polling oder SSE; später optional Durable-Object-WebSockets.
5. Thread-Retention, Blockierung und Löschung.

### Phase 4: TAG Guestbook und asynchrone Medienpipeline

1. Zeitfenster und Moderation implementieren.
2. Private Einreichungen und kuratierte Veröffentlichung.
3. Queues für Bildvarianten, Medienprüfung und Benachrichtigungen.
4. Empfängergebundene Erinnerungsgalerie-Freigaben.
5. Datenschutz-, Retention- und Exportfunktionen.

### Phase 5: TAG Check-in, Collections und Campaigns

1. Owner-GeoFence mit versionierter Position, Radius und maximaler GPS-Ungenauigkeit implementieren.
2. Check-in-PWA mit expliziter Standortfreigabe und IndexedDB-Queue für `pending-sync`-Ereignisse implementieren.
3. API-Synchronisation mit Offline-Alter, Zeitplausibilität, serverseitiger Distanzberechnung und Verifikationslevel implementieren.
4. Kanonische Payload-Hashes, Server-Signaturen und referenzierte Präzisionsablösungen als append-only Ereigniskette implementieren.
5. Persönliche Collection-Projektionen mit Standardaggregation `one-per-window` implementieren.
6. Campaign-Regeln, deduplizierte Credits und atomare Reward-Entscheidungen implementieren.
7. GEO-, Offline-, Doppelbuchungs-, Privacy- und Reward-Tests durchführen.

## 11. Verbindliche Architekturregeln

1. Der Edge Routing Worker bleibt ein Resolver und besitzt keine fachlichen Sitzungen oder Content-Daten.
2. Routing-KV enthält keine PIN-Hashes, Session-Tokens, Chat-Nachrichten, Beiträge, Freigaben oder R2-Keys.
3. Jede Berechtigungsentscheidung erfolgt serverseitig im Application Worker.
4. Öffentliche und private R2-Auslieferung werden physisch oder durch strikt getrennte Zugriffswege getrennt.
5. Private Daten werden weder per CDN noch durch Service Worker persistent gecacht.
6. Jede Zustandsänderung wird beim schreibenden API-Request erneut geprüft; UI-Ausblendungen gelten nie als Schutz.
7. D1 ist in V1 die autoritative Metadatenquelle; KV bleibt für Edge Routing reserviert.
8. Durable Objects werden gezielt für Atomizität, per-Tag-Koordination oder Realtime eingesetzt, nicht als pauschaler Datenbankersatz.
9. Jede Umgebung besitzt getrennte Cloudflare-Ressourcen und Secrets.
10. Die API ist so zu kapseln, dass D1 später ohne Änderung der PWA-Verträge durch PostgreSQL/Hyperdrive ergänzt oder ersetzt werden kann.
11. `tag-checkin` ist der einzige zusätzliche Routing-Feature-Typ für Besuche; Collections, Challenges und Campaigns sind Anwendungsdomänen und keine Edge-Features.
12. Nur der Application API Worker entscheidet über GEO-Gültigkeit, Offline-Annahme, Server-Signatur, Check-in-Ablösung und Campaign-Credits.
13. Check-in-Originalereignisse bleiben append-only; eine Präzisionsverbesserung referenziert ihren Vorgänger statt ihn zu überschreiben.
14. Die PWA darf Offline-Ereignisse in IndexedDB bis zur Synchronisation vorhalten, aber weder Rohstandorte noch akzeptierte Check-ins im Cache Storage oder als dauerhafte private App-Ansicht cachen.
15. Präzise Standortdaten werden nur nach expliziter Nutzeraktion erhoben, nach Zweckbindung minimiert gespeichert und nie in öffentlichen Vault-, Guestbook- oder Campaign-Antworten offengelegt.
