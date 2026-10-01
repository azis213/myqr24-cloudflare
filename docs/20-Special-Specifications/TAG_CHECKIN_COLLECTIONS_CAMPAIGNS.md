# TAG Check-in, Collections & Campaigns – GEO-verifizierte Besuche, Sammlungen und Challenges

> **Status:** Fachliche Spezifikation / Architekturvorschlag  
> **Zweck:** Ein physisches Tag kann einen nachweisbaren Besuch erfassen. Ein einziger neuer Routing-Feature-Typ `tag-checkin` unterstützt GEO-Prüfung, Offline-Synchronisation und signierte Scan-Ereignisse. Persönliche Collections und Campaigns/Challenges werten diese Ereignisse aus, ohne eigene Routing-Feature-Typen zu benötigen.

## 1. Architekturentscheidung und Abgrenzung

Es werden bewusst **keine** getrennten Routing-Features `collection-tag`, `challenge-tag` oder `summit-tag` eingeführt.

| Ebene | Modell | Aufgabe |
| --- | --- | --- |
| Physischer Besuch | `tag-checkin` | Scan, GEO-Prüfung, Offline-Sync, Server-Signatur und Wiederholungs-Default |
| Tag-Inhalt | `tag-vault` | Gipfel-, Hütten-, Museums- oder Tourismusinformationen, Bilder, Audio und externe Ortslinks |
| Geteilte Beiträge | `tag-guestbook` | optionales Gipfelbuch bzw. moderiertes Event-Gästebuch |
| Persönliche Sammlung | Collection | nutzerbezogene, übersichtliche Projektion qualifizierter Check-ins |
| Zeitlich/fachlich begrenzte Auswertung | Campaign / Challenge | Regeln, Punkte, Credits und Rewards über Check-in-Ereignisse |

Damit kann derselbe Gipfel, dieselbe Hütte oder dasselbe Museumstag zugleich:

- einmalig in einer persönlichen Collection gesammelt werden;
- den letzten qualifizierten Besuch aktualisieren;
- einer saisonalen Challenge angehören;
- in einer Schnitzeljagd mehrfach zählen;
- ein digitales Gipfelbuch anbieten;
- eine öffentlich dargestellte Vault-Seite besitzen.

Collections und Campaigns liegen vollständig in der Cloudflare-Anwendungsdomäne. Der Edge Routing Worker löst nur `tag-checkin` auf und enthält keine Nutzer-, Scan- oder Challenge-Daten.

## 2. Feature-Typ `tag-checkin`

```ts
type CheckInVerificationLevel =
  | "scan-only"
  | "geo-proximity"
  | "online-challenge"
  | "hardware-attested";

type VisitAggregationDefault =
  | "first-ever"
  | "latest-ever"
  | "one-per-window"
  | "all-qualified"
  | "challenge-defined";

type TagCheckInFeature = {
  id: string;
  type: "tag-checkin";
  enabled: true;
  appUrlTemplate: string;
  verification: {
    requiredLevel: CheckInVerificationLevel;
    allowOfflineQueue: boolean;
    maxOfflineAgeSeconds?: number;
    maxFutureClockSkewSeconds?: number;
    requireUserAccount: boolean;
  };
  collectionDefault: {
    aggregation: VisitAggregationDefault;
    windowSeconds?: number;
    maxCreditsPerWindow?: number;
    allowPrecisionUpgradeWithinWindow: boolean;
    showLastVisit: boolean;
  };
  display?: {
    entryActionLabel?: string;
    showCollectionProgress?: boolean;
  };
};
```

Beispiel:

```json
{
  "id": "summit-checkin-standard",
  "type": "tag-checkin",
  "enabled": true,
  "appUrlTemplate": "https://app.myqr24.com/check-in/{tagId}",
  "verification": {
    "requiredLevel": "geo-proximity",
    "allowOfflineQueue": true,
    "maxOfflineAgeSeconds": 86400,
    "maxFutureClockSkewSeconds": 300,
    "requireUserAccount": true
  },
  "collectionDefault": {
    "aggregation": "one-per-window",
    "windowSeconds": 86400,
    "maxCreditsPerWindow": 1,
    "allowPrecisionUpgradeWithinWindow": true,
    "showLastVisit": true
  },
  "display": {
    "entryActionLabel": "Besuch sammeln",
    "showCollectionProgress": true
  }
}
```

Der Feature-Typ enthält keine GEO-Koordinaten, Sessions, Collection-Zuordnungen, Scan-Ereignisse oder Rewards. Diese privaten bzw. veränderlichen Daten liegen in der autoritativen Application-Datenbank.

## 3. Owner-konfigurierter Standort und GeoFence

Jeder Owner kann für ein Check-in-fähiges Tag eine Check-in-Position festlegen:

```ts
type TagGeoFence = {
  id: string;
  tagId: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  maxAccuracyMeters: number;
  version: number;
  active: boolean;
  configuredByOwnerId: string | null;
  configuredAt: string;
};
```

### 3.1 Owner-Oberfläche

```text
Check-in-Standort

[ Aktuellen Standort übernehmen ] [ Koordinaten bearbeiten ]

Breitengrad:  [47.123456]
Längengrad:  [11.654321]

Akzeptanzradius:                    [50] Meter
Maximal akzeptierte GPS-Ungenauigkeit: [35] Meter

[ ] Check-ins ohne Standortprüfung zulassen
[Speichern]
```

### 3.2 Verbindliche Regeln

1. Nur ein Owner bzw. eine berechtigte Organisation darf Position, Radius und Genauigkeitsgrenze ändern.
2. `radiusMeters` wird serverseitig begrenzt, initial beispielsweise auf **10 bis 5.000 Meter**.
3. `maxAccuracyMeters` wird ebenfalls serverseitig begrenzt; ein sinnvoller Default ist 35 Meter.
4. Jede Änderung erzeugt eine neue, fortlaufende `geoFenceVersion` und ein Audit-Ereignis.
5. Die präzisen Koordinaten sind weder Bestandteil von `TAG_CONFIG` noch automatisch öffentlich sichtbar.
6. Ein bereits akzeptierter Check-in speichert die beim Prüfen verwendete GeoFence-Version, Radius, Distanz und GPS-Genauigkeit. Spätere Owner-Änderungen dürfen alte Nachweise nicht umdeuten.
7. Für mobile Tags kann der Owner bewusst `scan-only` verwenden. Ein solcher Scan ist kein geo-verifizierter Besuch.

### 3.3 Serverseitige GEO-Entscheidung

Die PWA darf den Abstand als UX-Hinweis berechnen. Maßgeblich ist ausschließlich die Prüfung im Application API Worker.

```text
distanceMeters + reportedAccuracyMeters <= ownerConfiguredRadiusMeters
AND reportedAccuracyMeters <= ownerConfiguredMaxAccuracyMeters
```

Die Distanz wird serverseitig nach einem dokumentierten Verfahren, z. B. Haversine, aus den erfassten und gespeicherten Koordinaten berechnet.

Beispiel bei 50 m Radius und 12 m Genauigkeit:

```text
Maximal akzeptierte Distanz = 50 m - 12 m = 38 m
```

Bei 60 m gemeldeter Genauigkeit darf ein auf 50 m begrenzter Check-in nicht als geo-verifiziert akzeptiert werden.

## 4. Signierte, unveränderliche Scan-Ereignisse

Ein Check-in wird nicht als überschreibbare Zeile gespeichert, sondern als append-only Ereignis. Nach Serverannahme kann der gespeicherte Inhalt weder über die API noch über Owner-Oberflächen geändert werden.

```ts
type CheckInEventStatus =
  | "pending-sync"
  | "accepted"
  | "pending-review"
  | "rejected"
  | "superseded"
  | "revoked";

type CheckInEvent = {
  id: string;
  tagId: string;
  accountId: string;
  status: CheckInEventStatus;
  scanMethod: "qr" | "nfc" | "manual";
  capturedAtDevice: string;
  receivedAtServer: string | null;
  acceptedAtServer: string | null;
  latitudeE6: number | null;
  longitudeE6: number | null;
  reportedAccuracyCm: number | null;
  distanceCm: number | null;
  geoFenceVersion: number | null;
  geoFenceRadiusCm: number | null;
  verificationLevel: CheckInVerificationLevel;
  supersedesCheckInId: string | null;
  previousEventHash: string | null;
  localSignature: string | null;
  serverPayloadHash: string | null;
  serverSignature: string | null;
  serverSigningKeyId: string | null;
};
```

### 4.1 Kanonischer Server-Signatur-Payload

Der Application Worker ergänzt den verlässlichen Empfangs- und Annahmezeitpunkt, bildet über die kanonische Payload einen Hash und signiert ihn mit einem serverseitigen, nicht auslesbaren Signaturschlüssel.

```text
myqr24/checkin/v1
checkinId={uuid}
tagId={tagId}
accountId={accountId}
deviceKeyId={optional-key-id}
scanMethod={qr|nfc|manual}
capturedAtDevice={ISO-8601}
receivedAtServer={ISO-8601}
acceptedAtServer={ISO-8601}
latitudeE6={integer-or-empty}
longitudeE6={integer-or-empty}
reportedAccuracyCm={integer-or-empty}
distanceCm={integer-or-empty}
geoFenceVersion={integer-or-empty}
geoFenceRadiusCm={integer-or-empty}
verificationLevel={level}
supersedesCheckInId={optional-uuid}
previousEventHash={optional-hash}
```

Der persistierte Check-in enthält mindestens:

- Formatversion der Payload;
- Payload-Hash;
- Server-Signatur;
- Schlüssel-ID;
- Zeitpunkt und Ergebnis der Prüfung;
- optional den Hash des Vorgängereignisses.

Die Server-Signatur schützt die angenommene Historie vor unbemerkter nachträglicher Änderung in Datenbank, Backoffice oder API.

### 4.2 Zeitmodell

| Feld | Quelle | Bedeutung |
| --- | --- | --- |
| `capturedAtDevice` | PWA/Endgerät | Zeitpunkt der Erfassung laut Gerät |
| `receivedAtServer` | Application Worker | Zeitpunkt der Synchronisation |
| `acceptedAtServer` | Application Worker | Zeitpunkt nach vollständiger Policy-Prüfung |

Bei Offline-Check-ins ist die Gerätezeit nur ein Plausibilitätssignal. Die API prüft mindestens:

- maximales Offline-Alter, z. B. 24 Stunden;
- maximal zulässige Zukunftsabweichung, z. B. 5 Minuten;
- gültiges Tag, Konto und GeoFence;
- Duplikate sowie Collection-/Campaign-Regeln.

### 4.3 Offline-Funktionalität und ihre Grenzen

Die PWA kann Scans offline erfassen und in IndexedDB als `pending-sync` ablegen. Bei Netzverbindung erfolgt die Synchronisation zur API.

```text
Scan → Standort nach Nutzerzustimmung → lokale Queue
     → späterer API-Sync → Serverprüfung → signiertes Ergebnis
```

Eine lokale WebCrypto-Signatur mit nicht exportierbarem Browser-Schlüssel kann nachträgliche Änderungen innerhalb des Browserprofils erschweren. Sie beweist jedoch **nicht** den realen Aufenthaltsort, echte Gerätezeit oder die Einzigartigkeit eines QR-/NFC-Scans.

| Prüflevel | Offline möglich | Aussagekraft |
| --- | --- | --- |
| `scan-only` | ja | Scan ist erfasst; QR/NFC kann kopiert sein |
| `geo-proximity` | ja, zunächst lokal vorgemerkt | Standort ist plausibel, kann aber manipuliert werden |
| `online-challenge` | nein | Server bindet den Vorgang an aktuelle Nonce/Session |
| `hardware-attested` | eingeschränkt und plattformabhängig | zusätzlicher Geräte-/Tag-Nachweis, kein absoluter GPS-Beweis |

Gutscheine oder wertvolle Rewards dürfen sich nicht ausschließlich auf offline erfasste GPS-Daten stützen. Dafür sind mindestens Online-Validierung, Kontobindung, Rate Limits und eine Challenge-spezifische Policy erforderlich.

## 5. Präzisere Scan-Ablösung ohne Historienverlust

Ein neuer Scan kann den aktuell wirksamen Scan desselben Nutzers für dasselbe Tag innerhalb eines zulässigen Zeitfensters ablösen, wenn er objektiv präziser ist.

```text
Check-in A: accepted, active
    │
    └─ präziserer, zulässiger neuer Scan
          │
          ▼
Check-in B: accepted, active, supersedes A
Check-in A: superseded, weiterhin unveränderlich/auditierbar
```

Der neue Check-in enthält:

```text
supersedesCheckInId = ID von Check-in A
previousEventHash  = serverPayloadHash von Check-in A
```

Eine Ablösung ist nur zulässig, wenn:

1. Konto und Tag identisch sind;
2. der Vorgänger aktuell der wirksame Check-in des betroffenen Aggregationsfensters ist;
3. `allowPrecisionUpgradeWithinWindow` aktiv ist;
4. der neue Scan dieselbe oder eine höhere Verifikationsstufe besitzt;
5. die neue GPS-Genauigkeit besser ist (`newAccuracyMeters < oldAccuracyMeters`);
6. der neue Scan den aktuellen GeoFence besteht;
7. das Verbesserungsfenster noch aktiv ist;
8. eine bereits ausgegebene Reward-Policy die Korrektur zulässt.

Ein späterer, aber nicht präziserer Scan kann weiterhin als separates signiertes Ereignis gespeichert werden. Ob er Collection- oder Challenge-Fortschritt erzeugt, entscheiden die jeweiligen Aggregationsregeln.

## 6. Collections: persönliche, übersichtliche Projektionen

Eine Collection ist kein Edge-Feature. Sie ist eine persönliche PWA-Ansicht über qualifizierte Check-in-Ereignisse.

```ts
type CollectionKind =
  | "summit-pass"
  | "hut-pass"
  | "museum-pass"
  | "tourism-pass"
  | "custom";

type CollectionItem = {
  collectionId: string;
  accountId: string;
  tagId: string;
  firstQualifiedCheckInId: string;
  currentQualifiedCheckInId: string;
  firstVisitedAt: string;
  lastVisitedAt: string;
  qualifiedVisitCount: number;
  bestAccuracyCm: number | null;
};
```

Ein normaler Nutzer sieht standardmäßig höchstens **einen Collection-Eintrag pro Collection × Tag**:

```text
Falkenstein
Erster Besuch: 12.06.2026
Letzter Besuch: 01.10.2026, 10:05 Uhr
Qualifizierte Besuche: 4
Beste Positionsgenauigkeit: 6 m
```

Die Originalereignisse bleiben im Hintergrund unveränderlich und können in einer optionalen Besuchshistorie angezeigt werden. Mehrere Scan-Karten am selben Tag entstehen nur dann, wenn die Collection- oder Challenge-Policy dies ausdrücklich vorsieht.

### 6.1 Standard-Aggregationsregeln

| Regel | Wirkung | Geeignet für |
| --- | --- | --- |
| `first-ever` | erster gültiger Besuch erzeugt den Eintrag; spätere Scans ändern ihn nicht | Museum, Souvenir-Sammlung |
| `latest-ever` | ein Eintrag; letzter qualifizierter Besuch wird aktualisiert | häufig besuchte Orte |
| `one-per-window` | maximal ein qualifizierter Besuch je Zeitfenster | Gipfel- und Hüttenpass |
| `all-qualified` | jeder qualifizierte Scan wird als Besuch gezählt | Game, Runden, Wegpunkte |
| `challenge-defined` | Standardcollection bleibt ruhig; Campaign bestimmt Anrechnung | wechselnde Kampagnen |

Für Gipfel und Hütten ist `one-per-window` mit 86.400 Sekunden ein sinnvoller Default.

## 7. Campaigns und Challenges

Eine Campaign/Challenge ist eine administrative Entität. Sie ordnet Tags oder Collections zu und bewertet Check-ins unabhängig von der normalen Collection-Projektion.

```ts
type ChallengeCreditPolicy =
  | "once-ever"
  | "once-per-day"
  | "once-per-window"
  | "every-qualified-visit";

type CampaignTagRule = {
  campaignId: string;
  tagId?: string;
  collectionId?: string;
  creditPolicy: ChallengeCreditPolicy;
  windowSeconds?: number;
  maxCreditsPerWindow?: number;
  acceptPreviouslyCollectedTag: boolean;
  startsAt: string;
  endsAt: string;
  requiredVerificationLevel: CheckInVerificationLevel;
  pointsPerCredit?: number;
};

type Campaign = {
  id: string;
  title: string;
  kind: "challenge" | "scavenger-hunt" | "tourism-campaign";
  startsAt: string;
  endsAt: string;
  completionPolicy: "count" | "required-tags" | "points";
  rewardPolicy?: "voucher" | "badge" | "download" | "manual-claim";
};
```

| Campaign-Beispiel | Credit-Policy | Wirkung |
| --- | --- | --- |
| „10 Gipfel im Sommer“ | `once-ever` | derselbe Gipfel zählt einmal |
| „Hüttenpass 2026“ | `once-per-day` | dieselbe Hütte zählt täglich höchstens einmal |
| „Wanderwoche“ | `once-per-window`, 24 h | maximal ein qualifizierter Besuch pro Tag |
| Schnitzeljagd mit Runden | `every-qualified-visit` | mehrere Scans können zählen |
| neue Winterkampagne | `acceptPreviouslyCollectedTag: false` | nur Check-ins im Kampagnenzeitraum zählen |
| rückwirkender Museumspass | `acceptPreviouslyCollectedTag: true` | ältere, valide Check-ins können angerechnet werden |

Für Gutscheine ist `acceptPreviouslyCollectedTag: false` der sichere Standard. Der Check-in muss dann innerhalb des Kampagnenzeitraums erfolgen und die geforderte Prüfqualität besitzen.

Nicht jeder Tag-Owner darf Reward-Policies, Punktwerte oder globale Campaigns frei konfigurieren. Diese Funktionen gehören zu einer berechtigten Organisation-/Campaign-Administratorrolle.

## 8. Datenmodell

```sql
CREATE TABLE tag_geo_fences (
  id TEXT PRIMARY KEY,
  tag_id TEXT NOT NULL,
  latitude_e6 INTEGER NOT NULL,
  longitude_e6 INTEGER NOT NULL,
  radius_cm INTEGER NOT NULL,
  max_accuracy_cm INTEGER NOT NULL,
  version INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  configured_by_owner_id TEXT NULL,
  configured_at TIMESTAMP NOT NULL,
  retired_at TIMESTAMP NULL,
  UNIQUE (tag_id, version)
);

CREATE TABLE tag_checkin_events (
  id TEXT PRIMARY KEY,
  tag_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN (
      'pending-sync', 'accepted', 'pending-review',
      'rejected', 'superseded', 'revoked'
    )
  ),
  scan_method TEXT NOT NULL CHECK (scan_method IN ('qr', 'nfc', 'manual')),
  captured_at_device TIMESTAMP NOT NULL,
  received_at_server TIMESTAMP NULL,
  accepted_at_server TIMESTAMP NULL,
  latitude_e6 INTEGER NULL,
  longitude_e6 INTEGER NULL,
  reported_accuracy_cm INTEGER NULL,
  distance_cm INTEGER NULL,
  geo_fence_version INTEGER NULL,
  geo_fence_radius_cm INTEGER NULL,
  verification_level TEXT NOT NULL,
  supersedes_checkin_id TEXT NULL REFERENCES tag_checkin_events(id),
  previous_event_hash TEXT NULL,
  local_signature TEXT NULL,
  server_payload_version TEXT NULL,
  server_payload_hash TEXT NULL UNIQUE,
  server_signature TEXT NULL,
  server_signing_key_id TEXT NULL,
  created_at TIMESTAMP NOT NULL
);

CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  owner_scope_id TEXT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL
);

CREATE TABLE collection_items (
  collection_id TEXT NOT NULL REFERENCES collections(id),
  account_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  first_qualified_checkin_id TEXT NOT NULL,
  current_qualified_checkin_id TEXT NOT NULL,
  first_visited_at TIMESTAMP NOT NULL,
  last_visited_at TIMESTAMP NOT NULL,
  qualified_visit_count INTEGER NOT NULL DEFAULT 1,
  best_accuracy_cm INTEGER NULL,
  PRIMARY KEY (collection_id, account_id, tag_id)
);

CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP NOT NULL,
  completion_policy TEXT NOT NULL,
  reward_policy TEXT NULL,
  created_at TIMESTAMP NOT NULL
);

CREATE TABLE campaign_tag_rules (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  tag_id TEXT NULL,
  collection_id TEXT NULL,
  credit_policy TEXT NOT NULL,
  window_seconds INTEGER NULL,
  max_credits_per_window INTEGER NULL,
  accept_previously_collected_tag INTEGER NOT NULL DEFAULT 0,
  required_verification_level TEXT NOT NULL,
  points_per_credit INTEGER NULL,
  CHECK (tag_id IS NOT NULL OR collection_id IS NOT NULL)
);

CREATE TABLE challenge_credits (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  account_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  checkin_event_id TEXT NOT NULL REFERENCES tag_checkin_events(id),
  credited_at TIMESTAMP NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  UNIQUE (campaign_id, checkin_event_id)
);
```

Jede Annahme, Ablehnung, Ablösung, GeoFence-Änderung, Credit-Erzeugung, Reward-Ausstellung und manuelle Prüfung erzeugt zusätzlich ein Audit-Ereignis.

## 9. API-Vorschlag

```http
GET  /api/v1/tags/{tagId}/check-in
POST /api/v1/tags/{tagId}/check-ins
GET  /api/v1/tags/{tagId}/check-ins/current

GET  /api/v1/me/collections
GET  /api/v1/me/collections/{collectionId}
GET  /api/v1/me/campaigns
GET  /api/v1/me/campaigns/{campaignId}

GET    /api/v1/tags/{tagId}/owner/check-in-settings
PATCH  /api/v1/tags/{tagId}/owner/check-in-settings
GET    /api/v1/tags/{tagId}/owner/check-ins
```

Beispiel für einen Check-in-Sync:

```http
POST /api/v1/tags/ab12cd34/check-ins
Content-Type: application/json

{
  "clientCheckInId": "0199f567-8aa9-77fd-9e72-1b1352f5a452",
  "scanMethod": "nfc",
  "capturedAtDevice": "2026-10-01T08:05:12.311Z",
  "position": {
    "latitude": 47.123456,
    "longitude": 11.654321,
    "accuracyMeters": 6.2
  },
  "supersedesCheckInId": "0199f560-...",
  "localSignature": "optional-browser-signature"
}
```

Die API antwortet nur nach vollständiger Serverprüfung, beispielsweise mit:

```json
{
  "checkInId": "0199f567-8aa9-77fd-9e72-1b1352f5a452",
  "status": "accepted",
  "verificationLevel": "geo-proximity",
  "collectionUpdate": {
    "itemUpdated": true,
    "qualifiedVisitCount": 4
  },
  "campaignCredits": [
    {
      "campaignId": "alpine-pass-2026",
      "credited": true,
      "points": 1
    }
  ]
}
```

## 10. Google Places und Gipfelbuch

### 10.1 Google Places

Google Places ist kein eigenes Routing-Feature und benötigt keine eigene Maps-Einbettung. Ein Owner kann im `tag-vault` einen validierten Place-Link-Block konfigurieren:

```ts
type GooglePlaceLinkBlock = {
  id: string;
  type: "google-place-link";
  label: string;
  mapsUrl: string;
  placeId?: string;
  searchQuery?: string;
  showPhotosHint: boolean;
  showReviewHint: boolean;
};
```

Die PWA zeigt einen expliziten externen Link, etwa:

```text
[Ort in Google Maps öffnen]
[Bewertung oder Foto bei Google hinterlassen]
```

Die URL wird ausschließlich aus Owner-/Administrationsdaten validiert erzeugt. Ein Request-Parameter darf nie als externes Redirect-Ziel übernommen werden.

### 10.2 Gipfelbuch

Ein Gipfelbuch ist eine Produktkonfiguration, kein weiterer Feature-Typ:

```text
tag-vault       → Gipfel-/Hüttenbeschreibung und Medien
tag-checkin     → Sammeln und GEO-verifizierter Besuch
tag-guestbook   → optionales moderiertes digitales Gipfelbuch
```

Ein Guestbook-Beitrag darf optional einen Verweis „qualifizierter Check-in vorhanden“ erhalten. Präzise Koordinaten, GPS-Genauigkeit und private Check-in-Historie dürfen darin niemals öffentlich erscheinen.

## 11. Sicherheits- und Datenschutzregeln

- Ein Browser-Scan, GPS-Wert oder lokale Uhrzeit allein ist kein fälschungssicherer Aufenthaltsnachweis.
- Die Server-Signatur sichert die nach Annahme gespeicherte Historie; sie macht manipulierte Eingangsdaten nicht automatisch wahr.
- GEO-Koordinaten werden nur nach ausdrücklicher Nutzeraktion erhoben.
- Für normale Collections genügt möglichst eine minimierte Speicherung von Distanz, Genauigkeit, Ergebnis und GeoFence-Version; präzise Rohkoordinaten benötigen einen dokumentierten Zweck, Retention und Zugriffsschutz.
- Check-in-, Session-, Campaign- und Reward-Antworten erhalten `Cache-Control: no-store`.
- Rewards und Einmalgutscheine benötigen eine atomare Ausstellungs- bzw. Verbrauchsentscheidung in D1-Transaktion oder Durable Object.
- Turnstile, Accountbindung und Rate Limits gelten mindestens für reward-relevante Check-ins.
- Der API Worker prüft bei jedem Sync und jeder Reward-Auswertung erneut Tag, Nutzer, GeoFence, Zeitfenster, Eventstatus und Policy.
- Öffentliche Vault- und Guestbook-Antworten enthalten keine privaten Check-in-Daten.

## 12. Akzeptanzkriterien

1. Ein Owner kann pro Tag Position, Radius und maximal zulässige GPS-Ungenauigkeit setzen; jede Änderung erzeugt eine neue GeoFence-Version und Audit-Ereignis.
2. Ein `geo-proximity`-Check-in wird serverseitig nur akzeptiert, wenn Distanz und GPS-Genauigkeit die konfigurierte Regel erfüllen.
3. Jeder angenommene Check-in erhält einen kanonischen Payload-Hash und eine Server-Signatur.
4. Der Originalinhalt eines angenommenen oder abgelehnten Check-ins kann nicht überschrieben werden.
5. Ein präziserer Scan darf den wirksamen Scan nur als referenzierte, auditierbare Ablösung innerhalb des erlaubten Zeitfensters ersetzen.
6. Offline gespeicherte Scans werden als `pending-sync` nach Netzverbindung synchronisiert und anhand von Offline-Alter, Zeitplausibilität und GEO-Policy geprüft.
7. Eine normale Collection zeigt standardmäßig maximal einen Eintrag pro Nutzer, Collection und Tag.
8. Wiederholte Scans am selben Tag erzeugen bei `one-per-window` keinen weiteren Collection-Besuch, können aber als Ereignishistorie erhalten bleiben.
9. Eine Campaign kann dieselben Check-ins mit eigener `creditPolicy`, eigenem Zeitraum und eigener Verifikationsanforderung auswerten.
10. Ein zuvor gesammeltes Tag zählt für eine neue Campaign nur, wenn deren `acceptPreviouslyCollectedTag` dies zulässt.
11. Reward-relevante Credits und Rewards werden atomar und ohne Duplikate erzeugt.
12. Ein Gipfelbuch kann Vault, Check-in und Guestbook kombinieren, ohne präzise Besuchs- oder Standortdaten öffentlich offenzulegen.
