# Cloudflare-Plattformbausteine für myQR24

**Status:** Architekturleitfaden  
**Datum:** 2026-10-01  
**Zweck:** Übersicht der für myQR24 relevanten Cloudflare-Dienste, ihres konkreten Nutzens für eine globale QR-/NFC-Tag-Plattform sowie ihrer empfohlenen Einsatzreihenfolge.

---

## 1. Ausgangspunkt und Architekturprinzipien

myQR24 besteht aus zwei fachlich strikt getrennten Ebenen:

```text
NFC-/QR-Scan
  │
  ▼
Edge Tag Router
  - öffentliche URL-, Host-, Tag-ID- und Range-Prüfung
  - KV-basierte Feature-Auflösung
  - sicherer Redirect oder JSON-Aktionsdokument
  │
  ▼
PWA und Application API
  - Tag Vault, Chat, Lost & Found, Guestbook, Check-ins
  - Authentisierung, Autorisierung und Fachzustände
  - Inhalte, Uploads, Freigaben, Audit und Moderation
```

Die Plattform soll global gut erreichbar, sicher, kosteneffizient und schrittweise ausbaubar sein. Cloudflare ist dafür insbesondere geeignet, weil Edge-Auslieferung, Frontend, API, Daten- und Sicherheitsdienste in einer Plattform kombinierbar sind.

### 1.1 Verbindliche Architekturregeln

1. Der **Edge Router** bleibt klein, fail-closed und ausschließlich für Tag-Auflösung zuständig.
2. Die **Application API** ist die alleinige fachliche Autorität für Berechtigungen und Zustandsänderungen.
3. **KV** wird für das Edge Routing verwendet, nicht als transaktionale Anwendungsdatenbank.
4. **D1** oder später eine hinter der API abstrahierte Datenbank ist für autoritative Fachdaten zuständig.
5. **Private Daten** dürfen weder per CDN noch durch den Service Worker persistent gecacht werden.
6. Staging und Production verwenden stets getrennte Ressourcen, Secrets, Datenbanken, Buckets und Zugriffsrechte.
7. Jeder zusätzliche Cloudflare-Dienst wird nur eingeführt, wenn er einen konkreten fachlichen, Sicherheits- oder Betriebsnutzen liefert.

---

## 2. Zieltopologie

Die folgende Architektur ist die angestrebte Zielstruktur. Nicht alle Komponenten werden zu Beginn benötigt.

```text
                         ┌───────────────────────────────┐
                         │ Cloudflare DNS / CDN / WAF     │
                         └──────────────┬────────────────┘
                                        │
NFC-/QR-Scan ──► Scan-Domains ──► Edge Tag Router (Worker)
                                      │
                                      │ sicherer Redirect
                                      ▼
                         ┌───────────────────────────────┐
                         │ PWA                            │
                         │ Pages oder Workers Assets      │
                         │ app.myqr24.com                 │
                         └──────────────┬────────────────┘
                                        │ /api/v1/...
                                        ▼
                         ┌───────────────────────────────┐
                         │ Application API Worker         │
                         │ Auth, Fachlogik, Policy        │
                         └───┬─────────┬─────────┬───────┘
                             │         │         │
                             ▼         ▼         ▼
                            D1        R2        Durable Objects
                        Fachdaten   Medien       Atomizität /
                                                  Realtime
                             │
                             ▼
                         Queues / Consumer
                    Medienverarbeitung, Benachrichtigungen

Zusätzlich:
- Turnstile: Bot- und Missbrauchsschutz
- WAF / Rate Limiting: Schutz öffentlicher Endpunkte
- Analytics / Logpush: Betrieb, Fehleranalyse, Abuse-Erkennung
- Access: Schutz interner Staging-, Admin- und Support-Oberflächen
```

---

## 3. Priorisierung

| Priorität | Baustein | Nutzen für myQR24 | Empfohlener Zeitpunkt |
| --- | --- | --- | --- |
| Jetzt | Workers | Edge Router; später Application API | bereits eingesetzt / sofort |
| Jetzt | Workers KV | Range-, Gruppen- und Feature-Auflösung | bereits vorgesehen |
| Jetzt | DNS, TLS, CDN | sichere globale Scan- und PWA-Domains | Staging |
| Jetzt | Pages | statische Staging-Test-PWA | Staging |
| Früh | WAF / Rate Limiting | Schutz öffentlicher Scan- und API-Endpunkte | vor öffentlichem Produktivbetrieb |
| Früh | Turnstile | Schutz gegen Spam bei Chat, Guestbook und Formularen | vor schreibenden Besucherfunktionen |
| Früh | D1 | autoritative Tag- und Anwendungsmetadaten | erste produktive Fachfunktion |
| Früh | R2 | öffentliche und private Bilder, Audio, Dokumente | mit Vault-/Upload-Funktion |
| Später, gezielt | Durable Objects | atomare Einmalaktionen, Limits, Realtime | bei konkretem Konsistenz- oder Realtime-Bedarf |
| Später | Queues | Medienpipeline, Benachrichtigungen, Entkopplung | mit Uploads und asynchronen Prozessen |
| Später | Logpush / SIEM | vertiefte Betriebsauswertung und Incident Response | mit wachsendem Betrieb |
| Optional | Access | Schutz interner Oberflächen | sobald Admin-/Support-UIs existieren |
| Optional | Hyperdrive | Zugriff auf externe PostgreSQL-Datenbank | bei späterer DB-Strategie |
| Optional | Workers AI / AI Gateway | Moderation, Klassifikation, KI-Integration | nur nach Datenschutz- und Kostenprüfung |
| Optional | Stream | Video-Upload und -Auslieferung | nur wenn Video ein Kernfeature wird |
| Optional | Email Routing / Email Workers | transaktionale E-Mail-Workflows | bei Owner-/Support-Kommunikation |

---

## 4. Kernbausteine

## 4.1 Cloudflare Workers

### Aufgabe

Workers führen serverseitigen JavaScript-/TypeScript-Code nahe am Nutzer aus. Für myQR24 sind sie die Basis für:

- den vorhandenen **Edge Tag Router**;
- die spätere **Application API**;
- autorisierte private Medienauslieferung;
- Webhooks und Integrationen;
- Sicherheitsheader, Redirects und gezielte Request-Validierung.

### Nutzen für myQR24

| Anwendungsfall | Worker-Aufgabe |
| --- | --- |
| QR-/NFC-Scan | Host, URL, Tag-ID, HMAC, Range und Feature prüfen |
| öffentlicher Vault | Tag-ID erneut validieren; öffentliche Inhalte kontrolliert ausliefern |
| Owner-Dashboard | Session prüfen; Inhalte, Sichtbarkeiten und Uploads verwalten |
| Lost & Found | Status und Chat-Berechtigungen erzwingen |
| Check-in | Standort-, Zeit-, GeoFence- und Policy-Validierung |
| private Dateien | Berechtigung vor jedem Download/Stream prüfen |
| Webhooks | externe Ereignisse signaturgeprüft entgegennehmen |

### Wichtige Grenzen

- Workers sind kein Ersatz für ein vollständiges ORM, eine relationale Datenbank oder einen klassischen Background-Job-Server.
- CPU-intensive oder lang laufende Prozesse gehören nicht in Nutzerrequests.
- Secrets gehören ausschließlich in Worker Secrets, niemals in Quellcode, KV, Testfixtures oder PWA-Bundles.
- Der Edge Router erhält keine Fachlogik, Sessions, Uploads oder private Inhalte.

### Empfehlung

- **Beibehalten:** separater Worker für Edge Routing.
- **Später ergänzen:** separater Application API Worker.
- **Nicht vermischen:** Router und Application API bleiben unterschiedliche Deployments mit unterschiedlichen Berechtigungen und Datenbindungen.

---

## 4.2 Cloudflare Workers KV

### Aufgabe

KV ist ein global replizierter Key-Value-Speicher, der für häufig gelesene, selten geänderte Konfiguration geeignet ist.

### Bereits vorgesehener Einsatz

Der Edge Router verwendet ein eigenes `TAG_CONFIG`-Namespace je Umgebung:

```text
tag-range-index
group:{groupId}
range-rule:{rangeId}
tag:{decodedValue}
feature:{featureId}
```

Darin liegen unter anderem:

- aktive Tag-Ranges;
- Gruppen;
- Feature-Zuweisungen;
- vertrauenswürdige Redirect-Ziele;
- nicht geheime Präsentations- und Routing-Konfiguration.

### Geeignete weitere Nutzung

- globale, selten geänderte Feature-Schalter;
- bekannte Sperrlisten oder Wartungsflags mit klarer Auswirkungsgrenze;
- vorberechnete, nicht autoritative öffentliche Konfiguration;
- Versionierungsmarker für Cache-Invalidierung.

### Nicht geeignet

KV darf nicht als Quelle für Daten verwendet werden, die starke Konsistenz oder sofortige globale Sichtbarkeit benötigen:

- atomare Tag-Vergabe;
- Owner- oder Besucher-Sessions;
- PIN-Hashes;
- Chat-Nachrichten;
- Freigaben und Einmalzugriffe;
- Check-in-Ereignisse;
- Campaign-Credits oder Rewards;
- private R2-Keys;
- jede Entscheidung, bei der konkurrierende Schreibvorgänge fachlich kritisch sind.

### Empfehlung

KV auf das Edge Routing und klar nicht-autoritative Konfiguration begrenzen. Jede Umgebung verwendet zwingend ein eigenes Namespace.

---

## 4.3 Cloudflare Pages und Workers Assets

### Aufgabe

Pages und Workers Assets liefern statische PWA-Dateien weltweit aus:

- HTML;
- JavaScript und CSS;
- `manifest.webmanifest`;
- Icons;
- Service Worker;
- öffentliche, versionierte App-Shell-Assets.

### Einsatz für myQR24

| Phase | Empfehlung |
| --- | --- |
| Staging-Redirect-Test | kleine statische Test-PWA auf Cloudflare Pages |
| erste Produkt-PWA | Pages ist weiterhin geeignet |
| eng gekoppelte App-/Request-Logik | Workers Assets als Alternative oder Ergänzung prüfen |

### Warum Pages für die Test-PWA?

- kein PHP und kein eigener Webserver erforderlich;
- HTTPS, CDN und Custom Domain sind integriert;
- einfaches Git-basiertes Deployment;
- klare Trennung vom sicherheitskritischen Edge-Router-Repository;
- passende Grundlage für `app-staging.myqr24.com`.

### Caching-Regeln

| Inhalt | Cache-Regel |
| --- | --- |
| versionierte JS-, CSS- und Icon-Assets | langfristig, `immutable` |
| PWA-App-Shell | kontrolliert versioniert |
| öffentliche, versionierte Medien | langfristig, `immutable` |
| Owner-Dashboard | `no-store` |
| private API-Antworten | `no-store` |
| Chat, Guestbook-Rohdaten, Sessions | `no-store` |
| Standort- und Check-in-Daten | `no-store` |

---

## 4.4 Cloudflare D1

### Aufgabe

D1 ist eine relationale Datenbank auf Basis von SQLite. Für myQR24 ist sie in der ersten Produktversion die autoritative Quelle für relationale Fach- und Metadaten.

### Geeignete Daten

- Tag-Metadaten und Owner-Zuordnung;
- Vault-Konfiguration und Sichtbarkeiten;
- Owner-, Besucher- und Empfänger-Session-Hashes;
- Chat-Threads und Nachrichtenmetadaten;
- Lost-&-Found-Fälle;
- Guestbooks, Beitragsfenster und Moderationszustände;
- Upload-Vorgänge und Asset-Metadaten;
- GeoFence-Versionen und Check-in-Ereignisse;
- Collections, Campaign-Regeln, Credits und Rewards;
- Audit-Ereignisse.

### Sicherheitsregeln

- Session- und Freigabetokens nur als geeignete kryptografische Hashes speichern.
- PINs nur mit einer geeigneten langsamen Passwort-Hash-Funktion behandeln; schnelle Hashes oder HMAC sind dafür nicht ausreichend.
- Tabellenzugriffe erfolgen ausschließlich über die Application API, nie direkt aus der PWA.
- Staging und Production erhalten unterschiedliche D1-Datenbanken.
- D1-Migrationen müssen versioniert, testbar und reversibel geplant sein.

### Wann ein anderer Datenbankdienst sinnvoll wird

Eine spätere Ergänzung mit PostgreSQL über Hyperdrive oder einem anderen Datenbankdienst kann sinnvoll sein bei:

- sehr hoher konstanter Schreiblast;
- starken Multi-Region-Transaktionsanforderungen;
- umfangreicher Volltextsuche;
- komplexem Reporting oder Data Warehousing;
- organisatorischen Anforderungen an bestehende Datenbankplattformen.

Die PWA darf daher ausschließlich gegen stabile API-Verträge arbeiten, nicht gegen D1-spezifische Details.

---

## 4.5 Cloudflare R2

### Aufgabe

R2 speichert Binärdaten wie Bilder, Audio, PDFs und andere freigegebene Dateien.

### Geeignete myQR24-Anwendungsfälle

- öffentliche Bilder und Audioinhalte eines Tag Vaults;
- private Vault-Dokumente;
- Chat-Anhänge;
- Bilder, Audio und Anhänge aus Guestbooks;
- Upload-Originale und erzeugte Varianten;
- exportierte Nutzerdaten oder Audit-Dateien mit kontrollierter Lebensdauer.

### Zwingende Trennung

| Datenklasse | Speicher-/Auslieferungsweg | Cache |
| --- | --- | --- |
| öffentlich und unveränderlich | dedizierter öffentlicher Prefix oder Bucket; Custom Domain möglich | langfristig und `immutable` |
| privat oder zeitlich freigegeben | ausschließlich Application API Worker nach Berechtigungsprüfung | `no-store` |
| Upload in Prüfung | privater Quarantäne-Bereich | nicht öffentlich |

### Beispielhafte Schlüssel

```text
public/tags/{tagId}/hero.{contentHash}.webp
public/tags/{tagId}/audio-guide.{contentHash}.mp3

private/vault/{tagId}/{assetId}/original.pdf
private/chat/{threadId}/{assetId}/photo.webp
private/guestbook/{contributionId}/{assetId}/voice.m4a
quarantine/uploads/{uploadId}/original
```

### Wichtige Regeln

- Ein schwer erratbarer R2-Key macht einen Inhalt nicht automatisch privat.
- Private Inhalte werden niemals direkt über eine öffentliche R2-Domain ausgeliefert.
- Originaldateinamen sind Metadaten und keine vertrauenswürdigen Object Keys.
- MIME-Type, Dateisignatur, Größe und Berechtigung werden serverseitig geprüft.
- Öffentliche Inhalte müssen explizit veröffentlicht und idealerweise versioniert sein.

---

## 5. Sicherheits- und Schutzdienste

## 5.1 Cloudflare WAF

### Nutzen

Die Web Application Firewall schützt öffentlich erreichbare HTTP-Endpunkte gegen bekannte Angriffsmuster und unerwünschten Traffic.

### Sinnvolle myQR24-Einsatzbereiche

- PWA- und API-Domain;
- Owner-Login und sensible Dashboard-Endpunkte;
- Upload- und Formularrouten;
- öffentliche Chat- und Guestbook-API-Endpunkte;
- spätere Verwaltungs- oder Support-Oberflächen.

### Wichtig

WAF ersetzt keine serverseitige Eingabevalidierung, Authentisierung oder Autorisierung. Die Application API muss jede fachliche Berechtigung selbst prüfen.

### Empfehlung

Vor öffentlichem Produktivbetrieb mindestens verwaltete Basisregeln sowie gezielte Regeln für besonders sensible Routen konfigurieren. Regeln zunächst im Log-/Monitoring-Modus beobachten, bevor sie produktiv blockieren.

---

## 5.2 Rate Limiting

### Nutzen

Rate Limiting begrenzt wiederholte Requests und reduziert Missbrauch, Brute Force, Spam sowie unnötige Kosten.

### Empfohlene Limits

| Endpunktklasse | Beispielsignal | Zweck |
| --- | --- | --- |
| Owner-Login / PIN-Eingabe | IP, Tag, Konto, Session | Brute-Force-Schutz |
| Chat-Nachrichten | Besucher-Session, Tag, IP-Signal | Spam-Schutz |
| Guestbook-Beiträge | Session, Tag, IP-Signal | Spam und Flooding begrenzen |
| Upload-Erstellung | Owner-Session, Tag | Kosten- und Missbrauchsschutz |
| Check-in-Synchronisation | Konto, Tag, Gerät-/Session-Signal | Manipulations- und Replay-Schutz |
| öffentliche API | IP-Signal, Pfad | Basisschutz vor Scraping und Abuse |

### Abgrenzung

Edge-Rate-Limits können Angriffe dämpfen, sind aber nicht die alleinige fachliche Begrenzung. Harte fachliche Limits, beispielsweise eine einmalige Freigabe oder eine exakt begrenzte Reward-Ausgabe, erfordern serverseitige und gegebenenfalls atomare Durchsetzung.

---

## 5.3 Cloudflare Turnstile

### Aufgabe

Turnstile reduziert automatisierten Missbrauch ohne klassische CAPTCHA-Nutzererfahrung.

### Besonders sinnvoll für

- erste öffentliche Chat-Nachricht;
- erste Guestbook-Einreichung;
- riskante oder kostenintensive Uploads;
- Formular für Lost-&-Found-Kontaktaufnahme;
- Account-Registrierung oder Recovery-Flows;
- auffällige Check-in- oder Reward-Aktionen als risikobasierte Zusatzprüfung.

### Architekturregel

Das Turnstile-Token wird ausschließlich serverseitig durch die Application API geprüft. Eine erfolgreiche Browseranzeige allein ist kein Sicherheitsnachweis.

### Empfehlung

Nicht bei jedem Scan einsetzen. Ein reiner öffentlicher Tag-Redirect muss schnell und reibungslos bleiben. Turnstile wird gezielt vor schreibenden oder missbrauchsanfälligen Aktionen eingesetzt.

---

## 5.4 Cloudflare Access und Zero Trust

### Aufgabe

Cloudflare Access schützt interne Webanwendungen durch Identitätsprüfung, ohne eine Anwendung öffentlich zugänglich machen zu müssen.

### Sinnvolle myQR24-Anwendungsfälle

- interne Staging- und Debug-Oberflächen;
- Betriebs- und Support-Tools;
- technische Dokumentation mit nicht öffentlichem Inhalt;
- temporäre Admin-Tools vor einer vollständigen Owner-/Admin-Authentisierung;
- geschützte Vorschauumgebungen.

### Nicht geeignet als Ersatz für

- Owner-Berechtigungen innerhalb der Produktanwendung;
- Besucher- oder Empfängerfreigaben;
- fachliche Rechteprüfung in der Application API.

### Empfehlung

Für interne Werkzeuge früh nutzen, sobald mehr als eine Person Zugriff benötigt. Die Produktanwendung implementiert ihre fachliche Authentisierung dagegen selbst.

---

## 5.5 Secrets Store und Zugriffsrechte

### Aufgabe

Secrets werden pro Worker und pro Umgebung sicher hinterlegt, ohne in Git oder Bundles zu gelangen.

### Erforderliche Regeln

- getrennte Secrets für Staging und Production;
- keine Wiederverwendung von Feistel-, HMAC- oder Redirect-Signing-Secrets;
- Minimalrechte für Cloudflare-API-Tokens;
- getrennte Deployment-Tokens je Projekt und Umgebung;
- regelmäßige Überprüfung von Teamzugängen;
- dokumentierter Rotation-Prozess für Secrets.

### Besonderheit für Tag-Secrets

Änderungen an `FEISTEL_SECRET` oder `TAG_HMAC_SECRET` können bestehende Tag-IDs ungültig machen. Diese Secrets dürfen nicht routinemäßig oder ungeplant rotiert werden. Ihre Rotation benötigt einen expliziten Migrations- und Tag-Lebenszyklusplan.

---

## 6. Konsistenz, Realtime und asynchrone Verarbeitung

## 6.1 Durable Objects

### Aufgabe

Durable Objects ermöglichen gezielte Serialisierung und zustandsbehaftete Koordination pro Schlüssel.

### Sinnvolle myQR24-Anwendungsfälle

| Anwendungsfall | Warum Durable Object? |
| --- | --- |
| Einmalansicht / Einmaldownload | atomarer Verbrauch eines begrenzten Zugriffs |
| harte Rate Limits pro Tag | konsistente Zählung trotz paralleler Requests |
| Reward-Ausgabe | verhindert doppelte Belohnungen bei Gleichzeitigkeit |
| Check-in-Credits | serialisiert konkurrierende Credit-Entscheidungen |
| Chat-Realtime | WebSocket-/Realtime-Fan-out je Thread |
| Freigabe-Workflow | ordnet parallele Zustandsänderungen pro Tag oder Freigabe |

### Nicht pauschal verwenden

Durable Objects sind kein Ersatz für die gesamte Datenhaltung. D1 reicht für viele relationale Daten und Datenbanktransaktionen aus. Durable Objects werden nur dort eingesetzt, wo echte Per-Key-Serialisierung, langlebige Verbindung oder eine atomare Entscheidung erforderlich ist.

---

## 6.2 Cloudflare Queues und Consumer

### Aufgabe

Queues entkoppeln asynchrone, aufwendigere Verarbeitung vom Nutzerrequest.

### Sinnvolle myQR24-Anwendungsfälle

- Prüfung von Uploads;
- Bestimmung des tatsächlichen MIME-Types;
- Bildvarianten und Thumbnails;
- Audio-Metadaten und Dauer;
- optionale Malware-Scan-Integration;
- Spam- oder Risikoanalyse;
- Versand von Benachrichtigungen;
- nachgelagerte Audit- oder Analyseereignisse;
- Generierung von Datenexporten.

### Beispielablauf für Uploads

```text
Browser
  → API erstellt zeitlich begrenzten Upload-Vorgang
  → Upload nach privatem R2-/Quarantäne-Bereich
  → API bestätigt Annahme
  → Queue
  → Consumer prüft und verarbeitet
  → D1 markiert Asset als active oder quarantined
  → erst danach ist Veröffentlichung möglich
```

### Empfehlung

Nicht für die reine Test-PWA erforderlich. Mit den ersten Upload-Funktionen einführen, damit Nutzerrequests schnell bleiben und fehlerhafte Medien nicht direkt sichtbar werden.

---

## 7. Beobachtbarkeit, Analyse und Betrieb

## 7.1 Cloudflare Analytics

### Nutzen

Cloudflare liefert grundlegende Traffic- und Sicherheitsdaten für Domains, Workers und weitere Dienste.

### Sinnvolle Fragen für myQR24

- Welche Scan-Domains und Regionen werden genutzt?
- Wie viele Requests führen zu 404, 405 oder erfolgreichen Redirects?
- Gibt es ungewöhnliche Zugriffsmuster auf einzelne Tag-Routen?
- Welche API-Routen produzieren Fehler oder hohe Latenzen?
- Steigen abgewiesene WAF- oder Rate-Limit-Events auffällig an?

### Datenschutzregel

Analytics darf nicht zu einem unnötigen Tracking einzelner Scan-Nutzer führen. Metriken und Logs werden auf Betriebs-, Sicherheits- und Qualitätszwecke beschränkt. Präzise Standort- oder Identitätsdaten gehören nicht in allgemeine Request-Logs.

---

## 7.2 Workers Logs und Logpush

### Aufgabe

Worker Logs helfen bei Fehlersuche. Logpush exportiert Logs in ein externes Ziel zur längerfristigen Auswertung.

### Empfehlung

| Reifestufe | Maßnahme |
| --- | --- |
| Staging | strukturierte, datensparsame Fehler- und Ereignislogs |
| früher Produktivbetrieb | Fehlerquoten, Latenzen und Sicherheitsereignisse überwachen |
| wachsender Betrieb | Logpush an ein geeignetes, zugriffsgeschütztes Analyse-/SIEM-Ziel prüfen |

### Logging-Regeln

Nicht loggen:

- Secrets;
- vollständige Session-Tokens;
- PINs oder PIN-Hashes;
- private Inhaltsdaten;
- ungekürzte personenbezogene Freitexte;
- präzise Standortdaten, sofern nicht zwingend für einen dokumentierten Sicherheitsfall erforderlich.

Stattdessen verwenden:

- Request- und Korrelations-IDs;
- pseudonymisierte oder gehashte interne IDs, wenn erforderlich;
- Status, Fehlerklasse und minimale technische Metadaten;
- klar definierte Aufbewahrungszeiten.

---

## 7.3 Health Checks und Synthetic Monitoring

### Sinnvolle Prüfungen

- Staging- und Production-Scan-Domain verfügbar;
- valide Testtag-ID liefert erwarteten Redirect;
- falscher Host und falscher Pfad liefern 404;
- PWA-App-Shell ist erreichbar;
- kritische API-Endpunkte sind erreichbar;
- TLS-Zertifikate und Domainbindungen sind aktiv.

### Empfehlung

Nach Staging-Abnahme einfache, automatisierte synthetische Checks einführen. Sie verwenden ausschließlich dedizierte Testtags und keine echten Owner- oder Besucherdaten.

---

## 8. Optionale Erweiterungen

## 8.1 Hyperdrive

### Zweck

Hyperdrive kann den Zugriff von Workers auf externe Datenbanken, insbesondere PostgreSQL, optimieren und verwalten.

### Sinnvoll wenn

- D1 für spätere Last- oder Konsistenzanforderungen nicht ausreichend ist;
- eine externe PostgreSQL-Datenbank strategisch gewünscht wird;
- bestehende relationale Systeme integriert werden müssen.

### Nicht erforderlich für

- Staging-Redirect-Test;
- erste statische PWA;
- reine KV-basierte Tag-Auflösung.

---

## 8.2 Cloudflare Stream

### Zweck

Stream vereinfacht Video-Upload, Encoding und Auslieferung.

### Sinnvoll wenn

- Video ein zentrales Vault-, Guestbook- oder Erinnerungsfeature wird;
- mehrere Videoformate, Transcoding und Streaming benötigt werden;
- eigene Videoverarbeitung über R2 und Queue zu aufwendig würde.

### Nicht vorschnell einführen

Für Bilder, Audio und PDFs reichen R2 plus eine gezielte Medienpipeline zunächst aus. Stream wird erst bei echtem Video-Produktbedarf bewertet.

---

## 8.3 Workers AI und AI Gateway

### Potenzielle Anwendungsfälle

- Moderationsunterstützung für öffentliche Texte oder Bilder;
- Klassifikation von Support- oder Lost-&-Found-Anfragen;
- Zusammenfassung längerer Guestbook-Inhalte für Owner;
- Schutz vor offensichtlichem Spam oder toxischen Inhalten;
- kontrollierte Nutzung externer KI-Modelle über AI Gateway.

### Voraussetzungen und Risiken

- Datenschutz-, Einwilligungs- und Aufbewahrungskonzept;
- keine vollautomatisierte, nicht überprüfbare Entscheidung über sensible Nutzerrechte;
- klare Kennzeichnung, wenn Inhalte KI-unterstützt verarbeitet werden;
- Kostenlimits und Abuse-Schutz;
- menschlicher Review-Prozess für Moderations- und Sperrentscheidungen.

### Empfehlung

Nicht Bestandteil der ersten Version. Erst nach stabiler Kernplattform und einer dokumentierten Datenschutz-/Moderationsentscheidung prüfen.

---

## 8.4 Email Routing und Email Workers

### Mögliche Anwendungsfälle

- Owner-Benachrichtigungen über neue Guestbook- oder Chat-Ereignisse;
- Bestätigungen für Freigaben;
- Lost-&-Found-Benachrichtigungen;
- Support-Postfach-Workflows.

### Empfehlung

Transaktionale E-Mails über einen dafür geeigneten Anbieter oder Dienst abstrahieren. Cloudflare kann Routing- oder Verarbeitungsbausteine ergänzen, sollte aber nicht ohne Zustellbarkeits-, Datenschutz- und Bounce-Konzept als alleinige E-Mail-Strategie gewählt werden.

---

## 8.5 Images

### Mögliche Anwendungsfälle

- automatische responsive Bildvarianten;
- sichere, vordefinierte Größen für öffentliche Vault-Galerien;
- Optimierung von Bildauslieferung.

### Empfehlung

Bei wachsender Bildnutzung evaluieren. Bis dahin können Bildvarianten auch kontrolliert über eine Queue-basierte Verarbeitung erzeugt und in R2 abgelegt werden. Private Originale dürfen nicht durch frei manipulierbare öffentliche Transformations-URLs zugänglich werden.

---

## 9. Staging- und Production-Trennung

Jeder produktionsrelevante Cloudflare-Baustein erhält getrennte Ressourcen.

| Ressource | Staging | Production |
| --- | --- | --- |
| Edge Router | `myqr24-edge-routing-staging` | `myqr24-edge-routing` |
| Scan-Domains | `s.qx4.uk`, `s.myqr24.com` | `qx4.uk`, `p.myqr24.com` |
| PWA | `app-staging.myqr24.com` | `app.myqr24.com` |
| KV | eigenes `TAG_CONFIG` | eigenes `TAG_CONFIG` |
| Secrets | eigene Werte | neue, unabhängige Werte |
| D1 | eigene Datenbank | eigene Datenbank |
| R2 | eigene Buckets oder strikt getrennte Zugriffswege | eigene Buckets oder strikt getrennte Zugriffswege |
| Durable Objects | eigene Namespaces/Bindings | eigene Namespaces/Bindings |
| Queues | eigene Queue | eigene Queue |
| Access-Policies | Staging-spezifisch | Production-spezifisch |
| Monitoring-Testtags | dedizierte Testtags | dedizierte Testtags ohne Owner-Daten |

Staging darf niemals auf Production-Datenbanken, Production-Buckets, Production-Secrets oder Production-Owner-Sessions zugreifen.

---

## 10. Empfohlene Umsetzungsreihenfolge

### Phase A: Edge-Routing-Staging

1. Cloudflare-Konto, DNS-Zonen und Zugriffsrechte prüfen.
2. getrennten Staging-KV-Namespace anlegen.
3. Staging-Secrets setzen.
4. Edge Router auf `s.qx4.uk` und `s.myqr24.com` deployen.
5. eine valide Test-Range und ein Redirect-Feature konfigurieren.
6. Positiv- und Negativtests dokumentieren.

### Phase B: Statische Test-PWA

1. separates Test-PWA-Projekt erstellen.
2. auf Cloudflare Pages bereitstellen.
3. `app-staging.myqr24.com` anbinden.
4. Redirect vom Staging-Worker auf die Test-PWA konfigurieren.
5. PWA-Installierbarkeit und beide Scan-Domainformen prüfen.

### Phase C: Erstes Produktfundament

1. separates PWA-/API-Projekt etablieren.
2. Application API Worker mit klaren API-Verträgen erstellen.
3. getrennte Staging-D1-Datenbank und Migrationen anlegen.
4. R2 für öffentliche und private Medien getrennt einrichten.
5. Basisschutz durch Rate Limiting, WAF und Turnstile integrieren.
6. Logging, Monitoring und datensparsame Audit-Regeln festlegen.

### Phase D: Öffentlicher TAG Vault

1. öffentliche Tag-View-API implementieren.
2. PWA-Route `/tag/{tagId}` implementieren.
3. öffentliche Inhalte und versionierte Medien ausliefern.
4. Owner-Authentisierung und Dashboard schrittweise ergänzen.
5. private Inhalte erst mit serverseitiger Berechtigungsprüfung ausliefern.

### Phase E: Erweiterte Fachfunktionen

1. Upload-Pipeline mit R2, Queues und Consumer.
2. Chat und Lost & Found mit Turnstile und Limits.
3. Guestbook mit Moderation und asynchroner Medienprüfung.
4. Check-ins mit datensparsamer GEO-Validierung.
5. Durable Objects nur für nachweislich atomare oder Realtime-Anforderungen einsetzen.

---

## 11. Entscheidungsleitlinie je neuem Cloudflare-Dienst

Vor Einführung eines weiteren Dienstes werden diese Fragen beantwortet:

1. Welches konkrete fachliche oder betriebliche Problem löst der Dienst?
2. Kann das Problem mit dem bestehenden Stack einfacher und sicherer gelöst werden?
3. Welche Daten verarbeitet der Dienst, und sind sie öffentlich, privat oder besonders schützenswert?
4. Welche Konsistenz-, Latenz- und Skalierungsanforderung besteht?
5. Welche Staging-/Production-Ressourcen, Secrets und Berechtigungen sind erforderlich?
6. Welche laufenden Kosten, Limits und Monitoring-Metriken entstehen?
7. Welche Ausfall- oder Lock-in-Auswirkungen bestehen?
8. Wie wird der Dienst getestet, beobachtet und bei Fehlern zurückgebaut?

Ein Dienst wird nur eingeführt, wenn die Antworten dokumentiert sind und sein Nutzen die zusätzliche Komplexität überwiegt.

---

## 12. Zusammenfassung

Cloudflare bietet für myQR24 eine konsistente globale Plattform:

- **Workers** für sicheren Edge Router und Application API;
- **KV** für häufig gelesene Routing-Konfiguration;
- **Pages** für die Test-PWA und spätere statische PWA-Auslieferung;
- **D1** für relationale Fachdaten;
- **R2** für Medien;
- **WAF, Rate Limiting und Turnstile** für gestaffelten Missbrauchsschutz;
- **Durable Objects** für gezielte Atomizität und Realtime;
- **Queues** für sichere asynchrone Medien- und Benachrichtigungsverarbeitung;
- **Analytics, Logs und Monitoring** für einen nachvollziehbaren Betrieb.

Für die nächste Stufe sind Cloudflare Pages, Workers, KV, DNS sowie ein klar begrenzter Staging-Redirect die wesentlichen Bausteine. D1, R2 und die Sicherheitsdienste werden mit den ersten echten Fachfunktionen eingeführt. Komplexere Dienste wie Durable Objects, Queues, Hyperdrive, Stream oder KI-Komponenten werden bewusst erst bei nachweislichem Bedarf ergänzt.

---

## 13. Verwandte Dokumente

- [ADR-001: Deployment der myQR24-PWA auf Cloudflare](ADR-001-PWA_DEPLOYMENT_ON_CLOUDFLARE.md)
- [Cloudflare-native PWA-Komponente](CLOUDFLARE_PWA_COMPONENT.md)
- [Deployment-Handover: myQR24 Edge Tag Router](../90-Session-Change-Summaries/DEPLOYMENT_HANDOVER.md)
- [Gesamtarchitektur](../ARCHITECTURE.md)
- [Domain-Regeln](../DOMAIN_RULES.md)
