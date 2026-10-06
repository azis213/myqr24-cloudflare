# TAG-Control-Plane als PHP-Anwendung und Basis-Vault auf Cloudflare

> **Status:** Architekturvorschlag / für spätere Umsetzung vorgemerkt  
> **Zweck:** Aufteilung zwischen einer komplexen Verwaltungsanwendung für TAG-Erstellung auf PHP/MySQL und der öffentlichen Scan- und Vault-Laufzeit auf Cloudflare.

---

## 1. Architekturentscheidung

Die Definition, Konfiguration und Verwaltung eines TAGs wird zunächst als klassische **PHP-Control-Plane** auf dem vorhandenen Dogado-Webhosting mit MySQL umgesetzt.

Die öffentliche Nutzung eines fertigen TAGs bleibt auf **Cloudflare**:

- Cloudflare Worker validiert und löst Scan-URLs auf;
- Cloudflare KV hält ausschließlich die minimale, nicht geheime Routing-Projektion;
- eine Staging- bzw. spätere Produktiv-PWA stellt die öffentliche TAG-Ansicht bereit;
- Cloudflare R2 übernimmt später die skalierbare, kontrollierte Medienablage.

```text
                 Verwaltungs-/Control-Plane
              Dogado PHP + MySQL + Admin-GUI
                              │
                              │ kontrolliertes serverseitiges Publishing
                              ▼
                  Cloudflare KV: TAG_CONFIG
                              │
                              ▼
QR-/NFC-Scan → Cloudflare Edge Worker → PWA / Vault Runtime
                                                │
                                                ▼
                                   später: API, Datenbank, R2
```

Diese Aufteilung vermeidet, dass eine komplexe Backoffice-Oberfläche zu früh vollständig als Cloudflare-Anwendung umgesetzt werden muss. Gleichzeitig bleibt die öffentlich erreichbare Scan-Strecke nah am Edge, global auslieferbar und unabhängig von der Verwaltungsoberfläche.

---

## 2. Verantwortungsgrenzen

| Bereich | Primäre Plattform | Verantwortung |
| --- | --- | --- |
| TAG-Erzeugung und Reservierung | PHP / MySQL | gültige ID erzeugen, reservieren und eindeutig speichern |
| Produkt- und Laufzeitlogik | PHP / MySQL | Tarif, Produktklasse, Ablauf, Aktivierung, Sperrung und Verlängerung |
| Owner-, Organisations- und Admin-Verwaltung | PHP / MySQL | Konten, Rollen, Betreiber, Freigaben und Audit |
| Feature-Konfiguration | PHP / MySQL | Feature auswählen, konfigurieren, validieren und freigeben |
| QR-Code-/Druckvorbereitung | PHP | öffentliche Scan-URL erzeugen und QR-Code bereitstellen |
| Routing-Projektion | PHP → Cloudflare KV | minimale öffentliche Feature-, Gruppen- und Range-Konfiguration veröffentlichen |
| Scan-URL-Auflösung | Cloudflare Worker | Host, Pfad, Tag-ID, Feistel/HMAC, Range, Regelpriorität und Feature-Dokument validieren |
| Öffentliche Staging-Ansicht | Cloudflare Pages / PWA | nach erfolgreicher Auflösung eine sichtbare, vertrauenswürdige Zielseite darstellen |
| Öffentliche Vault-Ansicht | später Cloudflare PWA/API | nur veröffentlichte öffentliche Inhalte ausliefern |
| Medienablage | später Cloudflare R2 | Bilder, Audio und Dokumente kontrolliert speichern und ausliefern |

Die PHP-Anwendung ist die fachlich autoritative Verwaltungsquelle. Cloudflare KV ist eine abgeleitete, für die öffentliche Scan-Auflösung benötigte Projektion.

---

## 3. Warum die TAG-Verwaltung zunächst PHP/MySQL verwendet

Die Definition eines TAGs ist eine klassische Backoffice-Anwendung mit komplexen Formularen, Statuswechseln und fachlichen Prüfungen. Sie umfasst voraussichtlich:

- Auswahl einer Produktklasse:
  - anonymes Demo-TAG;
  - Selbstprint-TAG;
  - physisches Standard-TAG;
  - Premium-/Content-TAG;
  - POI-/Community-TAG;
  - Partner-/Serien-TAG;
- Vergabe oder Reservierung einer gültigen TAG-ID;
- Zuordnung zu Range und Gruppe;
- Auswahl sowie Parametrisierung von Features;
- Owner-, Organisations- und Betreiberzuordnung;
- Laufzeit, Verlängerung, Sperrung und Reaktivierung;
- Prüfung einer POI-Anbringungszustimmung;
- Erzeugung von QR-Code und Druckdaten;
- Entwurf, Vorschau, Freigabe und Veröffentlichung;
- Audit-Trail und spätere Bestell-/Zahlungsanbindung.

PHP mit MySQL ist dafür als erster Umsetzungsschritt geeignet, weil ein vorhandenes Dogado-Hosting genutzt werden kann und relationale Verwaltungsdaten, Formulare, Workflows, Listen und Rollenmodelle dort wirtschaftlich implementierbar sind.

Diese Entscheidung bedeutet nicht, dass die öffentliche Vault-Laufzeit dauerhaft beim PHP-Hosting bleiben muss. Sie trennt bewusst:

```text
PHP / MySQL      = Control Plane: konfigurieren, prüfen, verwalten, freigeben
Cloudflare       = Data Plane: scannen, auflösen, ausliefern
```

---

## 4. Zielprozess: TAG erzeugen und veröffentlichen

Ein TAG soll nicht durch einzelne KV-Manipulationen entstehen. Die Verwaltungsanwendung führt einen nachvollziehbaren Workflow aus.

```text
1. Entwurf anlegen
2. Produktklasse und Owner/Organisation festlegen
3. TAG-ID erzeugen und dauerhaft reservieren
4. Range und Gruppe zuordnen
5. Routing-Feature auswählen und konfigurieren
6. Konfiguration serverseitig validieren
7. TAG aktivieren
8. Routing-Projektion nach Cloudflare KV publizieren
9. QR-Code / Druckdaten erzeugen
10. echten Staging-Scan prüfen
```

### 4.1 Vorgeschlagene Statuswerte

```ts
type ManagedTagStatus =
  | "draft"
  | "pending-review"
  | "ready-to-publish"
  | "active"
  | "suspended"
  | "expired"
  | "archived";
```

| Status | Bedeutung | Cloudflare-Routing |
| --- | --- | --- |
| `draft` | noch unvollständig oder nicht geprüft | nicht veröffentlichen |
| `pending-review` | fachliche bzw. POI-Prüfung läuft | nicht veröffentlichen |
| `ready-to-publish` | vollständig und zur Aktivierung freigegeben | noch nicht öffentlich |
| `active` | veröffentlicht und nutzbar | aktive Routing-Projektion |
| `suspended` | gesperrt oder in Prüfung | Routing entfernen oder neutrale Sperrseite |
| `expired` | Laufzeit abgelaufen | neutrale Ablauf-/Verlängerungsseite oder kein Routing |
| `archived` | endgültig beendet | alle öffentlichen Projektionen entfernen |

### 4.2 Unveränderliche und veränderliche Daten

| Datenart | Beispiele | Speicherort |
| --- | --- | --- |
| Autoritative TAG-Stammdaten | `tagId`, `decodedValue`, Länge, Ausgabezeitpunkt | PHP-MySQL-Datenbank |
| Verwaltungsdaten | Owner, Organisation, Tarif, Laufzeit, Audit, POI-Nachweise | PHP-MySQL-Datenbank |
| Nicht geheime Routing-Projektion | Range, Gruppe, Feature-ID, feste App-URL | Cloudflare KV `TAG_CONFIG` |
| Sensible Daten | Passworthashes, Tokens, Genehmigungsnachweise, private Inhalte | nur autorisierte Datenbank / Secret Store |
| Öffentliche Vault-Inhalte | Titel, Beschreibung, veröffentlichte Bildreferenzen | zunächst PHP-Read-API, später Cloudflare Vault API |
| Mediendateien | Bilder, Audio, Dokumente | später R2; niemals direkt im Routing-KV |

Die fachlich autoritative PHP-Datenbank speichert bei achtstelligen TAGs den vollständigen, HMAC-validierten `decodedValue`. Die bestehenden Regeln aus `DOMAIN_RULES.md` für ID-Räume, HMAC, Range-Grenzen und Eindeutigkeit gelten unverändert.

---

## 5. Kontrolliertes Publishing nach Cloudflare

### 5.1 Grundsatz

Nur ein serverseitiger Publishing-Service darf Routing-Daten zu Cloudflare übertragen. Browser, mobile PWA-Clients und Endnutzer erhalten niemals Berechtigungen, Cloudflare KV oder R2 direkt allgemein zu beschreiben.

```text
Admin-Browser
   │ authentisierte Verwaltungsanfrage
   ▼
PHP-Admin-Anwendung
   │ validiert Daten und Status
   ▼
PHP-Publishing-Service
   │ eingeschränkter Cloudflare-API-Token
   ▼
Cloudflare KV: TAG_CONFIG
```

### 5.2 Minimaler Cloudflare API Token

Der Token muss nach dem Prinzip geringster Rechte angelegt werden:

- nur das notwendige Cloudflare-Konto bzw. die notwendigen Zonen;
- Schreibzugriff ausschließlich auf den vorgesehenen KV-Namespace `TAG_CONFIG`;
- kein Zugriff auf Cloudflare-Account-Administratoren, Billing oder andere Projekte;
- getrennte Tokens für Staging und Produktion;
- kein Token im Browser, Git-Repository oder QR-Code;
- verschlüsselte Speicherung als Server-Secret bei Dogado;
- regelmäßige Rotation und Widerruf bei Verdacht.

### 5.3 Publishing-Regeln

Vor jeder Veröffentlichung prüft die PHP-Anwendung mindestens:

1. Der TAG hat einen zulässigen Status, üblicherweise `active`.
2. Die TAG-ID und der `decodedValue` sind konsistent und eindeutig.
3. Die TAG-ID liegt in einer aktiven und gültigen Range.
4. Gruppe und Feature-ID erfüllen die bekannten ID-Formate.
5. Das Feature-Dokument ist schema-valid.
6. Redirect- oder PWA-Ziele sind feste vertrauenswürdige `https:`-URLs bzw. erlaubte Templates.
7. Das KV-Dokument enthält keine personenbezogenen Daten, Secrets oder Vault-Inhalte.
8. Für ein POI-TAG liegen die erforderlichen Betreiber- und Anbringungsprüfungen vor.
9. Jede Veröffentlichung wird mit Zeitpunkt, Akteur, Version und Ergebnis auditiert.

Fehlgeschlagene Veröffentlichungen müssen sichtbar bleiben und wiederholbar sein. Die PHP-Anwendung darf ihren Datenbankstatus erst dann als „Cloudflare veröffentlicht“ markieren, wenn der Cloudflare-Aufruf erfolgreich bestätigt wurde.

---

## 6. Staging-Basis-Vault

Für den ersten End-to-End-Test wird ausdrücklich **nicht** die vollständige Vault-Spezifikation umgesetzt. Zunächst genügt ein kleiner öffentlicher Basis-Vault.

### 6.1 Ziel

Die vollständige technische Kette soll mit einem realen Testtag nachweisbar sein:

```text
physischer QR-/NFC-Scan
→ Staging-Hostname
→ Cloudflare Edge Worker
→ Validierung und Routing
→ Staging-PWA
→ öffentliche Inhalte des konkreten TAGs
```

### 6.2 Minimaler Funktionsumfang

Die erste Basis-Vault-Version zeigt für eine `tagId` nur veröffentlichte öffentliche Daten:

- öffentlicher Titel;
- kurze Beschreibung;
- ein optionales Titelbild;
- ein optionaler, klar gekennzeichneter externer Link;
- Scan- bzw. Fehlerstatus bei unbekanntem oder nicht veröffentlichtem Tag.

Noch nicht Bestandteil der Basis-Vault-Version:

- Owner-Login und Owner-PIN;
- private, geteilte oder zeitlich freigegebene Inhalte;
- Endnutzer-Uploads;
- signierte R2-Downloads;
- Galerievarianten, Audio und Dokumente;
- Chat, Lost & Found, Gästebuch oder Check-ins;
- Passkeys, Mehrbenutzerverwaltung und POI-Moderation;
- R2-Malware-Scan, Bildtransformation und komplexe Retention.

### 6.3 Beispiel einer Basisansicht

```text
[Mein Test-TAG]

Dies ist die erste öffentliche Vault-Testseite.
Sie bestätigt, dass das physische TAG,
der Cloudflare Worker und die Staging-PWA zusammenarbeiten.

[Bild, optional]

[Externe Information öffnen]
```

---

## 7. Datenquelle für die erste Basis-Vault-Version

### 7.1 Stufe A: schnelle Integration mit PHP-Read-API

Für den Staging-Test kann die Cloudflare-PWA öffentliche Inhalte zunächst aus einer kleinen, lesenden PHP-API beziehen:

```text
Cloudflare Staging-PWA
       │ HTTPS GET /api/public/tags/{tagId}
       ▼
Dogado PHP Read-API
       ▼
MySQL: veröffentlichte Basis-Vault-Daten
```

Die PHP-API liefert ausschließlich bereits veröffentlichte öffentliche Felder, beispielsweise:

```json
{
  "tagId": "ab12cd",
  "status": "published",
  "title": "Mein Test-TAG",
  "description": "Dies ist die erste öffentliche Vault-Testseite.",
  "imageUrl": "https://...",
  "externalLink": {
    "label": "Weitere Informationen",
    "url": "https://www.example.org/"
  }
}
```

Sicherheitsanforderungen für diese Stufe:

- kein Owner-, Produkt-, Audit- oder POI-Nachweisfeld in der öffentlichen Antwort;
- ausschließlich `GET`;
- Eingabe- und Rate-Limit-Validierung;
- HTTPS, CORS nur für die festgelegte Staging-PWA-Origin;
- öffentliche Antworten dürfen nur kurz gecacht werden;
- Fehlerantworten dürfen nicht offenlegen, ob ein nicht veröffentlichter Entwurf existiert.

### 7.2 Stufe B: vollständige Cloudflare-Vault-Runtime

Nach dem erfolgreichen Staging-Nachweis wird die öffentliche Content-Auslieferung schrittweise zu Cloudflare verlagert:

```text
PHP-Admin
  ├─ verwaltet und veröffentlicht Content
  ├─ publiziert öffentliche Metadaten
  └─ initiiert kontrollierte Medienablage
              │
              ▼
Cloudflare Vault API / Datenbank / R2
              │
              ▼
Cloudflare Vault-PWA
```

Die PHP-Anwendung bleibt die Verwaltungsoberfläche. Die spätere Cloudflare-Vault-API übernimmt öffentliche und private Inhaltsauslieferung, Zugriffsschutz, kurzlebige Asset-URLs und Upload-Workflows gemäß `TAG_VAULT_FEATURE.md`.

---

## 8. Feature-Konfiguration eines Basis-Vault-TAGs

Ein minimales Routing-Feature kann wie folgt aussehen:

```json
{
  "id": "vault-staging-basic",
  "type": "tag-vault",
  "enabled": true,
  "appUrlTemplate": "https://staging-app.myqr24.com/tag/{tagId}",
  "presentation": "public-page",
  "accessMode": "public-only",
  "display": {
    "publicActionMode": "hidden",
    "showPublicContent": true
  }
}
```

Der Worker kennt nur dieses Feature-Dokument und leitet auf die feste, validierte PWA-URL weiter. Die Inhalte werden nicht im Feature-Dokument und nicht in `TAG_CONFIG` gespeichert.

---

## 9. Empfohlene Umsetzungsreihenfolge

### Phase 1: PHP-Control-Plane für ein einzelnes Staging-TAG

1. Verwaltungsdatenbank für TAG-Stammdaten anlegen.
2. Einen administrativen, authentisierten Bereich bereitstellen.
3. Eine gültige Test-ID bzw. Test-Range verwenden.
4. Ein `redirect`- oder `tag-vault`-Feature konfigurieren.
5. Eine serverseitige Publish-Funktion für Staging-KV implementieren.
6. QR-Code für die Staging-Scan-URL erzeugen.
7. Ende-zu-Ende-Weiterleitung mit realem QR-/NFC-Test prüfen.

### Phase 2: Staging-PWA als sichtbares Ziel

1. Kleine PWA als Cloudflare Pages-Projekt bereitstellen.
2. Route `/tag/{tagId}` darstellen.
3. `tagId` sichtbar machen und einen erfolgreichen Scan kenntlich darstellen.
4. Fehler- und unbekannte TAG-Zustände neutral behandeln.

### Phase 3: Öffentlicher Basis-Vault

1. Titel, Beschreibung, Bildreferenz und externen Link in PHP/MySQL verwalten.
2. Nur veröffentlichte Inhalte über eine Read-API ausgeben.
3. Staging-PWA lädt und rendert die Daten.
4. CORS, Fehlerbehandlung, Rate Limits und Veröffentlichungsstatus testen.

### Phase 4: Cloudflare-native Vault-Auslieferung

1. Öffentliche Metadaten und Medienablage nach Cloudflare verlagern.
2. R2 für kontrollierte Bilder, Audio und Dokumente integrieren.
3. Vault-API und Authentisierung aufbauen.
4. Owner-, Sichtbarkeits- und Freigabefunktionen aus `TAG_VAULT_FEATURE.md` schrittweise umsetzen.

### Phase 5: Erweiterte Produktfunktionen

- Selbstprint-, physische und POI-Produktklassen;
- Organisationen und Betreiberrollen;
- Check-ins, Collections und Campaigns;
- moderiertes Gästebuch;
- private Vault-Freigaben;
- Chat und Lost & Found;
- Bestell-, Payment- und Fulfillment-Anbindung.

---

## 10. Akzeptanzkriterien für die erste Ausbaustufe

1. Ein Administrator kann ein Staging-TAG in der PHP-Anwendung als Entwurf anlegen.
2. Das System speichert `tagId`, vollständigen `decodedValue`, Länge, Range, Gruppe, Status und Feature-Zuweisung eindeutig.
3. Ein Administrator kann ein Basis-Vault-Feature auswählen und eine erlaubte Staging-PWA-URL konfigurieren.
4. Eine serverseitige Publish-Aktion überträgt ausschließlich die für den Worker nötige, nicht geheime Konfiguration nach Staging-KV.
5. Der Browser besitzt keine Cloudflare-API-Zugangsdaten.
6. Ein Scan des QR-Codes erreicht den Staging-Worker und leitet zur Staging-PWA weiter.
7. Die Staging-PWA erhält die richtige `tagId` und stellt einen erfolgreichen Testscan sichtbar dar.
8. Für den Basis-Vault zeigt die PWA ausschließlich veröffentlichte öffentliche Daten.
9. Nicht veröffentlichte TAG-Entwürfe, Owner-Daten, Tokens, Audit-Informationen und interne Inhalte erscheinen nie in öffentlichen API- oder KV-Antworten.
10. Jede Aktivierung, Veröffentlichung, Aktualisierung und Sperrung wird in der Verwaltungsdatenbank auditiert.

---

## 11. Öffentliche TAG-Runtime-Projektion und Owner-gesteuerte Sichtbarkeit

### 11.1 Öffentlicher Read-Pfad

Die öffentliche TAG-App ist auch ohne Scan direkt aufrufbar. Sie bietet eine neutrale Startseite mit Scan, Anmeldung und persönlicher Collection; eine öffentliche TAG-Route bleibt über `/tag/{tagId}` aufrufbar. Ein Scan durch den Edge Router führt weiterhin zu derselben Route.

```text
Browser oder Scan
  → TAG-App `/tag/{tagId}`
  → Edge Public-View-API / Runtime-Worker
  → veröffentlichte, öffentliche TAG-Runtime-Projektion
  → typisiertes Rendering von Content, Galerie oder erlaubtem Redirect
```

Die App implementiert keine Feistel-, HMAC-, Range- oder Routing-Entscheidung. Der Edge Router validiert Scan-URLs; die öffentliche View-API entscheidet anhand der veröffentlichten Projektion nur über die zulässige öffentliche Darstellung.

Eine fehlende, geschlossene, gesperrte oder nicht veröffentlichte Projektion erzeugt öffentlich eine neutrale Nichtverfügbar-Ansicht. Sie offenbart weder Owner-, Claim- noch Entwurfsdetails.

### 11.2 Deterministische öffentliche Projektion

Die Control Plane publiziert neben der minimalen Routing-Projektion eine getrennte, versionierte Public-Runtime-Projektion. Der öffentliche Key wird ausschließlich aus der kanonischen Base36-`tagId`, nicht aus Owner-, Organisations- oder internen DB-IDs abgeleitet:

```text
public-tag-config/v1/{tagId[0:2]}/{tagId}/{revision}.json
public-media/v1/{tagId[0:2]}/{tagId}/{revision}/...
```

Ein kleiner Pointer/Manifest-Eintrag kann auf die aktuelle veröffentlichte Revision zeigen. KV eignet sich für kleine Pointer oder kleine Views; R2 eignet sich für versionierte JSON- und Medienobjekte. Ein Worker liefert einen stabilen API-Vertrag und leitet den Key ausschließlich serverseitig ab. Es gibt keinen frei parametrisierbaren Objektpfad und keine `ownerId` im öffentlichen Key.

Die öffentliche Runtime-Projektion enthält ausschließlich veröffentlichte, typisierte Daten: Sichtbarkeitsmodus, erlaubte Content-Blöcke, Galerie-Metadaten und serverseitig validierte Feature-/Redirect-Informationen. Sie enthält niemals Owner-ID, Account, Claim- oder Owner-PIN-Hash, Credential, Session, Lockout, Audit, Pool, Bestellung, interne Pfade oder private Entwürfe.

### 11.3 Owner-Konfiguration, Sichtbarkeit und Zugriff

Der Owner bestimmt das gewünschte TAG-Verhalten über eine autorisierte TAG-App-Owner-Oberfläche. Die Control Plane prüft jedoch immer Produktpolicy, Lifecycle, Schema, Rollen und Freigaben und publiziert erst danach eine bereinigte öffentliche Revision.

```text
Owner-TAG-App
  → autorisierter Control-Plane-Command
  → MySQL-Transaktion, Policy, Audit und Outbox
  → kontrollierter Cloudflare-Publisher
  → neue öffentliche Runtime-Projektion
```

Mindestens folgende öffentliche Zugriffsmodi sind vorgesehen:

| Modus | Direkter Aufruf `/tag/{tagId}` |
| --- | --- |
| `public` | veröffentlichter Content ist sichtbar und die URL darf geteilt werden |
| `pin-required` | nur neutraler Einstieg; geschützter Content erst nach serverseitiger PIN-Freigabe |
| `closed` | neutrale Nichtverfügbarkeit ohne Detailinformation |
| `redirect` | nur serverseitig validiertes, veröffentlichtes Redirect-Ziel wird ausgeführt |

Eine Collection, lokale Browserdaten oder die Kenntnis einer TAG-ID begründen niemals Owner-, Upload- oder PIN-Rechte.

### 11.4 Collections und Besitzanker

Die TAG-App darf nach bewusster Aktion eine lokale Collection als Verweis auf eine `tagId` führen. Diese ist löschbar, geräte-/browsergebunden und kein Besitznachweis. Nach Anmeldung kann der Nutzer sie ausdrücklich und idempotent in eine kontogebundene Collection übernehmen; persönliche Collection-Antworten verwenden `Cache-Control: no-store`.

Nach einem erfolgreichen Claim muss die Control Plane einen dauerhaften Besitzanker erzwingen:

1. Account-/Organisationsbindung, oder
2. eine separate, TAG-gebundene Owner-Passphrase.

Die Claim-Session ist nur ein kurzlebiger Setup-Zustand. Owner-Passphrase, gedrucktes Claim-Secret und Besucher-PIN sind getrennte Faktoren mit getrennten Hashes, Rate Limits, Sperrungen und Audit-Ereignissen. Owner-Verwaltung erfordert entweder eine serverseitig zugeordnete Account-Session oder eine kurzlebige, `HttpOnly`, `Secure`, `SameSite=Strict` TAG-Owner-Session nach erfolgreicher Owner-Passphrase-Prüfung. Offline sind unverbindliche Entwürfe möglich, aber kein endgültiger Claim, keine Besitzanker-Einrichtung und kein Publish.

## 12. Verwandte Dokumente

- [ADR-001: PWA Deployment on Cloudflare](../ADR-001-PWA_DEPLOYMENT_ON_CLOUDFLARE.md)
- [Cloudflare PWA Component](../CLOUDFLARE_PWA_COMPONENT.md)
- [Cloudflare vs. PHP-Webhosting vs. vServer](../CLOUDFLARE_VS_PHP_HOSTING_VS_VSERVER.md)
- [Domain-, Tag- und Routing-Regeln](../../DOMAIN_RULES.md)
- [TAG Vault Feature](../../20-Special-Specifications/TAG_VAULT_FEATURE.md)
- [TAG-Typen und POI-/Community-TAGs](../../20-Special-Specifications/TAG_TYPES_AND_POI_FEATURES.md)
