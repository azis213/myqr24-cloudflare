# Architektur der `tag-app`

**Status:** Implementierter Staging-MVP  
**Stand:** 2026-10-02  
**Geltungsbereich:** `apps/tag-app` – öffentliche myQR24 TAG-Ansicht auf Cloudflare Pages  
**Ergänzt:** [Cloudflare-native PWA-Komponente](CLOUDFLARE_PWA_COMPONENT.md)

---

## 1. Zweck und Einordnung

Die `tag-app` ist die öffentliche, browserseitige Zielanwendung nach einem erfolgreichen NFC- oder QR-Scan. Sie stellt aktuell einen kleinen **öffentlichen Vault-MVP** bereit und dient zugleich als sichtbare Staging-Testoberfläche für die Edge-Weiterleitung.

Der aktuelle MVP ist bewusst keine vollständige Fachanwendung:

- öffentliche Ansichten werden aus lokalen, versionierten Fixtures gerendert;
- keine Owner-Verwaltung, Anmeldung oder Sessions;
- keine Application API;
- keine Cloudflare-Bindungen an KV, D1 oder R2;
- keine privaten Inhalte und keine Kundendaten;
- keine Berechtigungsentscheidung im Browser.

Die ausführliche Zielarchitektur für die spätere PWA, die autoritative Application API sowie D1, R2, Durable Objects und weitere Features steht in [`CLOUDFLARE_PWA_COMPONENT.md`](CLOUDFLARE_PWA_COMPONENT.md). Dieses Dokument beschreibt dagegen den **tatsächlich umgesetzten Stand** und die verbindlichen Grenzen für seine Weiterentwicklung.

---

## 2. Verantwortung im Gesamtsystem

```text
NFC-/QR-Scan
    │
    ▼
https://s.qr4.uk/t/{tagId}
    │
    ▼
Cloudflare Edge Router
- Host, Pfad und TAG-ID validieren
- Feistel-/HMAC-Prüfung
- Range- und Feature-Auflösung aus Routing-KV
- signierter Redirect auf feste Zielroute
    │
    ▼
Cloudflare Pages: tag-app
https://main.myqr24-staging-test-pwa.pages.dev/tag/{tagId}
    │
    ▼
React-PWA
- öffentliche Staging-Ansicht laden und darstellen
- keine fachliche Autorisierung
- keine Secrets und keine privaten Inhalte
```

### 2.1 Verantwortungsgrenze zum Edge Router

Der Edge Router bleibt die autoritative Komponente für die öffentliche Scan-Auflösung. Die `tag-app` darf nicht versuchen:

- Feistel- oder HMAC-Prüfungen zu wiederholen oder eigene Tag-IDs zu erzeugen;
- Redirect-Signaturen (`exp`, `sig`) selbst zu prüfen oder auszustellen;
- auf Routing-KV zuzugreifen;
- aktive Ranges, Feature-Zuweisungen oder Scan-Hosts fachlich zu entscheiden;
- Staging-/Production-Separation im Browser durchzusetzen.

Die App erhält eine URL und rendert ausschließlich einen öffentlichen View. Später muss die Application API die öffentliche Tag-ID unabhängig vom Edge Router erneut gegen die autoritativen Anwendungsdaten prüfen.

### 2.2 Verantwortungsgrenze zur späteren Application API

Der Browser ist nie eine Autoritätsinstanz für Sichtbarkeit oder Berechtigung. Die spätere API übernimmt insbesondere:

- Prüfung, ob ein Tag existiert und für die öffentliche Ansicht freigegeben ist;
- Auswahl ausschließlich autorisierter öffentlicher Inhalte;
- Owner-, Besucher- und Empfänger-Sessions;
- private Inhalte, Uploads, Freigaben, Moderation und Audit;
- Lost & Found, Chat, Guestbook, Check-ins, Collections und Campaigns.

Die `tag-app` ist so geschnitten, dass der lokale Datenadapter später ersetzt werden kann, ohne den View-Vertrag und die Darstellungslogik grundlegend umzubauen.

---

## 3. Laufzeit, Deployment und öffentliche URLs

| Bereich | Aktueller Stand |
| --- | --- |
| Framework | React 19 mit TypeScript |
| Build | Vite |
| Deployment | Cloudflare Pages |
| Staging-Projekt | `myqr24-staging-test-pwa` |
| stabiler Staging-Alias | `https://main.myqr24-staging-test-pwa.pages.dev` |
| öffentliche TAG-Route | `/tag/{tagId}` |
| zukünftige Staging-Custom-Domain | `https://app-staging.myqr24.com/tag/{tagId}` |
| Produktion | separates Pages-Projekt und eigene Custom Domain, noch nicht eingerichtet |

### 3.1 Deployment-Befehl

Der deploybare PWA-Build wird im Workspace über folgenden Befehl erzeugt und hochgeladen:

```sh
npm run deploy:app:staging
```

Er führt innerhalb von `apps/tag-app` aus:

```sh
npm run build
wrangler pages deploy dist --project-name myqr24-staging-test-pwa
```

Die Details zur Scan-Domain, DNS, Worker-Route und der noch kontrolliert ausstehenden Umstellung des KV-Redirect-Ziels stehen in [`CLOUDFLARE_DNS_AND_TLS_CONFIGURATION.md`](CLOUDFLARE_DNS_AND_TLS_CONFIGURATION.md).

### 3.2 Deep-Link-Fallback auf Pages

Die Datei `apps/tag-app/public/_redirects` enthält:

```text
/tag/* /index.html 200
```

Dadurch liefert Cloudflare Pages für direkte Aufrufe wie `/tag/rsq45q` die React-Einstiegsseite aus. Der Client-Router wertet anschließend die konkrete URL aus und rendert die TAG-Ansicht.

Weitere künftige öffentliche App-Routen müssen ausdrücklich in dieser Regel ergänzt oder durch eine bewusst geprüfte allgemeinere SPA-Regel abgedeckt werden.

---

## 4. Öffentliche Routen und Nutzerfluss

| Route | Komponente | Zweck |
| --- | --- | --- |
| `/` | `HomePage` | Staging-Startseite mit veröffentlichten lokalen Testansichten |
| `/tag/:tagId` | `TagPage` | Öffentliche Vault-Ansicht eines TAGs |
| jede andere Route | `Navigate` | Weiterleitung auf `/` |

### 4.1 Erfolgreicher Staging-Flow

```text
1. Scanner öffnet https://s.qr4.uk/t/{tagId}
2. Edge Router validiert den Scan und liefert einen signierten HTTP-Redirect.
3. Browser folgt dem Redirect auf /tag/{tagId} der Pages-App.
4. Pages liefert wegen _redirects die React-Shell aus.
5. React Router rendert TagPage.
6. PublicTagViewService löst den öffentlichen View auf.
7. VaultBlockRenderer stellt ausschließlich die vertragskonformen öffentlichen Blöcke dar.
```

Aktuell verweist die aktive Scan-Konfiguration möglicherweise noch auf die frühere, statische Test-PWA. Die Umstellung auf die React-App darf ausschließlich nach Identifikation des tatsächlich aktiven Workers und dessen KV-Namespace erfolgen. Keine KV-Konfiguration blind überschreiben.

### 4.2 Fehlerfluss

`TagPage` unterscheidet zwischen Ladephase und nicht verfügbarer Ansicht:

1. Beim Routenwechsel wird ein neuer View geladen.
2. Fehlerhafte oder nicht veröffentlichte IDs führen zu `UnknownPublicTagError`.
3. Die UI zeigt keine Ersatzdaten an, sondern die Seite „TAG nicht verfügbar“.
4. Unerwartete Fehler werden mit einer neutralen öffentlichen Fehlermeldung behandelt.

Das ist für den Fixture-MVP ein Fail-closed-Verhalten auf UI-Ebene. Es ersetzt nicht die spätere serverseitige Autorisierung.

---

## 5. Code-Struktur und Verantwortlichkeiten

```text
apps/tag-app/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── styles.css
│   ├── features/
│   │   └── vault/
│   │       └── types.ts
│   ├── services/
│   │   ├── publicTagViewService.ts
│   │   └── publicTagViewService.test.ts
│   └── mocks/
│       └── publicTagViews.ts
├── public/
│   ├── _redirects
│   ├── manifest.webmanifest
│   ├── service-worker.js
│   └── icon.svg
├── vite.config.ts
├── package.json
└── wrangler.toml
```

| Datei/Bereich | Verantwortung |
| --- | --- |
| `src/main.tsx` | React-Bootstrap und Einbindung des Browser-Routers |
| `src/App.tsx` | Öffentliche Routen, Lade-/Fehlerzustände, Header/Footer und Rendering der Vault-Blöcke |
| `src/features/vault/types.ts` | TypeScript-Vertrag für `PublicTagView`, Tag-Metadaten und erlaubte Vault-Blöcke |
| `src/services/publicTagViewService.ts` | Austauschbare Datenzugriffsgrenze für eine öffentliche Tag-Ansicht |
| `src/mocks/publicTagViews.ts` | Lokale, öffentliche Staging-Fixtures – niemals als Produktivdatenquelle verwenden |
| `src/styles.css` | Darstellung der öffentlichen Staging-Oberfläche |
| `public/_redirects` | Cloudflare-Pages-Deep-Link-Fallback |
| `public/manifest.webmanifest` | Installationsmetadaten für die PWA |
| `public/service-worker.js` | Minimaler Offline-/App-Shell-Support |
| `wrangler.toml` | Pages-Projekt, Build-Ausgabe und Betriebsnotizen |

---

## 6. Öffentlicher View-Vertrag und Datenadapter

### 6.1 Öffentlicher Vertrag

Der Typ `PublicTagView` beschreibt exakt die Daten, die die UI darstellen darf:

```text
PublicTagView
├── tag
│   ├── id
│   ├── displayName
│   └── presentation
├── vault.blocks
└── enabledFeatures
```

Unterstützte Blocktypen sind aktuell:

| Blocktyp | Zweck |
| --- | --- |
| `hero` | Titel, optionaler Untertitel und öffentliches Header-Bild |
| `text` | Öffentlicher Textabschnitt |
| `callout` | Hinweis mit definiertem Tonfall |
| `gallery` | Öffentliche Galerie mit Alt-Text und optionaler Beschriftung |
| `external-link` | Expliziter externer Link mit `rel="noreferrer"` |

Der Renderer verarbeitet nur diese diskriminierten, typisierten Blockformen. Es werden keine HTML-Fragmente aus den Fixture-Daten injiziert und keine frei ausführbaren Inhalte akzeptiert.

### 6.2 Aktueller Adapter

`getPublicTagView(tagId)` bildet die klare Grenze zwischen Darstellung und Datenquelle:

1. Normalisiert die ID in Kleinschreibung.
2. Akzeptiert nur kanonische 6- oder 8-stellige Base36-Formen.
3. Liest ausschließlich aus `publicTagViews`.
4. Wirft `UnknownPublicTagError`, wenn die ID ungültig oder nicht veröffentlicht ist.

Der Adapter enthält keine geheimen Werte und keinen Zugriff auf Cloudflare-Ressourcen.

### 6.3 Geplante API-Ablösung

Die zukünftige Implementierung des Adapters ruft auf:

```text
GET /api/v1/tags/{tagId}/view
```

Anforderungen an diese Ablösung:

- Das Response-Schema muss dem fachlich überprüften öffentlichen View-Vertrag entsprechen.
- Die API liefert ausschließlich serverseitig autorisierte öffentliche Inhalte.
- Unbekannte, gesperrte oder nicht öffentliche Tags dürfen keine Detailinformationen preisgeben.
- API-Antworten mit privaten, geteilten oder dynamischen Inhalten erhalten `Cache-Control: no-store`.
- Der Browser darf keine Autorisierungsentscheidung aus lokalen Feature-Flags ableiten.

Erst nach Einführung dieser API dürfen Fixtures schrittweise entfernt werden. Bis dahin sind Fixtures ausdrücklich Test- und Demo-Daten.

---

## 7. Sicherheit und Datenschutz

### 7.1 Was nicht in der PWA liegt

Die öffentliche `tag-app` darf niemals enthalten:

- Worker-Secrets, Feistel- oder HMAC-Schlüssel;
- Redirect-Signing-Secrets;
- Cloudflare-API-Tokens;
- KV-, D1-, R2- oder Durable-Object-Bindings;
- Session-Tokens, Owner-PINs oder PIN-Hashes;
- private Medien-URLs, R2-Keys oder private Vault-Inhalte;
- fachliche Freigaben, Moderationsentscheidungen oder Besitzerinformationen.

`wrangler.toml` besitzt deshalb bewusst keine Daten- oder Secret-Bindings.

### 7.2 Sichtbarkeit und Eingaben

Die App zeigt nur Inhalte, die durch den gegenwärtigen Fixture-Adapter oder später durch die autoritative API als öffentlich geliefert werden. UI-Ausblendungen oder lokale Feature-Flags gelten nicht als Sicherheitsmechanismus.

Die aktuelle App besitzt keine schreibenden Formulare. Bei späteren schreibenden API-Funktionen sind mindestens serverseitige Validierung, Authentisierung, Autorisierung, CSRF-Schutz bei Cookie-Sessions, Rate Limits und eine passende Content-Security-Policy erforderlich.

### 7.3 Externe Inhalte

Bilder und externe Links werden nur aus kontrollierten öffentlichen Datenquellen bezogen. Externe Links öffnen in einem neuen Kontext und verwenden `rel="noreferrer"`.

Die spätere API muss erlaubte Protokolle, öffentliche URLs, Medien-MIME-Typen und Sichtbarkeitsstatus serverseitig validieren.

---

## 8. PWA-, Offline- und Caching-Verhalten

### 8.1 Installierbarkeit

- `manifest.webmanifest` beschreibt Name, Anzeigeart und Icon.
- `main.tsx` registriert den Service Worker.
- `icon.svg` ist das aktuelle App-Icon.

### 8.2 Aktueller Service Worker

Der Service Worker verwendet den Cache `myqr24-tag-app-shell-v1` und legt ausschließlich diese App-Shell-Ressourcen ab:

```text
/
 /manifest.webmanifest
 /icon.svg
```

Bei Aktivierung entfernt er ältere Shell-Caches. Für Navigationen versucht er zuerst das Netzwerk und liefert bei einem Netzwerkfehler `/` als Fallback aus.

### 8.3 Bewusste Cache-Grenzen

Der Service Worker greift nicht ein bei:

- Requests außer `GET`;
- Requests zu anderen Origins;
- `/api/*`-Requests;
- zukünftigen privaten Inhalten, Session-Antworten oder signierten URLs.

Spätere Implementierungen dürfen weder Owner-Dashboard-Antworten, private Medien, Chat-Nachrichten, Freigaben, Standortdaten noch private API-Responses im Cache Storage speichern. Die weitergehenden Regeln stehen in der Zielarchitektur.

---

## 9. Tests und Qualitätsgrenzen

### 9.1 Aktueller automatisierter Nachweis

`src/services/publicTagViewService.test.ts` prüft:

- erfolgreiche Auflösung einer veröffentlichten Fixture;
- Zurückweisung einer syntaktisch ungültigen ID;
- Zurückweisung einer formal gültigen, aber nicht veröffentlichten ID.

Workspace-Kommandos:

```sh
npm test
npm run build
```

Der Workspace testet sowohl den Edge Router als auch die Tag-App. Der Build führt den Worker-Staging-Dry-Run sowie den TypeScript-/Vite-Build der Tag-App aus.

### 9.2 Manuelle Staging-Prüfung

Für die bereitgestellte PWA:

```text
https://main.myqr24-staging-test-pwa.pages.dev/tag/rsq45q
```

Sie muss die öffentliche Staging-Vault-Ansicht zeigen. Der zugehörige End-to-End-Nachweis und aktuelle Status der Scan-Weiterleitung sind in [`../40-Implementation/evidence/README.md`](../40-Implementation/evidence/README.md) dokumentiert.

### 9.3 Spätere Testausbauten

Mit Einführung der Application API sind zusätzlich erforderlich:

- Contract-Tests zwischen API und `PublicTagView`;
- Tests für öffentliche/gesperrte/nicht vorhandene Tags;
- Cache-Control- und Offline-Tests;
- Sicherheits- und Autorisierungstests;
- Browser-Integrationstests für die Scan-Weiterleitung;
- Accessibility-Tests für blockbasierte öffentliche Ansichten.

---

## 10. Entwicklungsregeln

1. Öffentliche Routen müssen in React Router **und** in der Pages-Fallback-Konfiguration berücksichtigt werden.
2. Neue Inhaltstypen werden zuerst als typisierter `VaultBlock`-Vertrag eingeführt, dann sicher gerendert.
3. Kein HTML aus CMS-/API-/Fixture-Daten über `dangerouslySetInnerHTML` ausgeben.
4. Der öffentliche Adapter bleibt der einzige Einstieg der UI in Tag-View-Daten.
5. Fixtures enthalten nur nicht sensible Demonstrations- und Staging-Daten.
6. Neue Features dürfen erst nach einer API-Autoritätsentscheidung private Daten oder schreibende Aktionen erhalten.
7. Service-Worker-Caches für dynamische oder private Antworten nur nach expliziter Sicherheits- und Datenschutzentscheidung erweitern.
8. Staging und Production verwenden getrennte Pages-Projekte, Custom Domains und gegebenenfalls spätere API-Ressourcen.
9. Die temporäre `pages.dev`-Adresse ist kein langfristiges Produktivziel; Ziel ist die dokumentierte Custom Domain.
10. Jede Änderung an der Scan-Weiterleitung erfolgt ausschließlich über den identifizierten aktiven Worker und dessen zugehörige KV-Konfiguration.

---

## 11. Verweise

- [Cloudflare-native PWA-Komponente](CLOUDFLARE_PWA_COMPONENT.md) – Zielarchitektur für PWA und Application API
- [Cloudflare DNS- und TLS-Konfiguration](CLOUDFLARE_DNS_AND_TLS_CONFIGURATION.md) – Domains, Worker-Routen und Staging-Betrieb
- [Tag Control Plane und Basis Vault](PWA-PHP-Applications/TAG_CONTROL_PLANE_AND_BASIS_VAULT.md) – fachliche Produktgrenzen
- [TAG Vault Feature](../20-Special-Specifications/TAG_VAULT_FEATURE.md) – Vault-Fachmodell
- [Implementation Evidence](../40-Implementation/evidence/README.md) – Test- und Deployment-Nachweise
