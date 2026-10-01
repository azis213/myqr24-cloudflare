# TAG Guestbook Feature – zeitlich begrenzte Event- und Sammelbeiträge

> **Status:** Fachliche Spezifikation / Architekturvorschlag  
> **Zweck:** Viele Scanner können innerhalb eines kontrollierten Zeitfensters unabhängig voneinander Texte, Bilder und Voice-Nachrichten für ein Gästebuch, eine Hochzeit oder ein Event einreichen.

## 1. Abgrenzung und Zusammenspiel

TAG Guestbook ist ein eigenständiger Feature-Typ `tag-guestbook`. Es ist ein Sammel- und Moderationsfeature, kein Gruppenchat.

| Feature | Aufgabe |
| --- | --- |
| `tag-vault` | dauerhafte Owner-Inhalte, kuratierte Galerie und kontrollierte Freigaben |
| `tag-chat` | private 1:1-Unterhaltungen Owner ↔ einzelner Scanner |
| `lost-found` | Verlustfall mit Finder-Chat |
| `tag-guestbook` | viele voneinander unabhängige Event-Beiträge oder moderierte Gipfelbuch-Einträge |
| `tag-checkin` | GEO-verifizierte Besuche, persönliche Collection und Campaign-Credits |

Gästebuch-Bilder und Voice-Nachrichten verwenden die private TAG-Vault-Asset-Pipeline, bleiben aber bis zur bewussten Moderation logisch dem jeweiligen Beitrag zugeordnet. Sie sind nicht automatisch in einer öffentlichen Vault-Galerie sichtbar.

Ein digitales Gipfelbuch ist kein zusätzlicher Routing-Feature-Typ. Es kombiniert `tag-vault` mit dem Präsentationsprofil `summit-guide`, optional `tag-checkin` für persönliche Besuche und dieses `tag-guestbook` für öffentliche bzw. moderierte Einträge. Die vollständigen Check-in-, GEO-, Collection- und Campaign-Regeln stehen in [TAG Check-in, Collections & Campaigns](TAG_CHECKIN_COLLECTIONS_CAMPAIGNS.md).

## 2. Zustands- und Zeitfenstermodell

```ts
type GuestbookStatus =
  | "scheduled"
  | "open"
  | "read-only"
  | "closed"
  | "disabled";

type GuestbookContributionStatus =
  | "pending"
  | "published"
  | "rejected"
  | "removed";
```

| Status | Öffentliche Ansicht | Neue Beiträge |
| --- | --- | --- |
| `scheduled` | Event-Ankündigung möglich | nein |
| `open` | Beitragsformular und optional veröffentlichte Beiträge | ja, innerhalb des Beitragsfensters |
| `read-only` | nur veröffentlichte Beiträge | nein |
| `closed` | Abschlussseite und optional Zugriffsanfrage | nein |
| `disabled` | Feature nicht sichtbar | nein |

```ts
function maySubmitContribution(
  guestbook: {
    status: GuestbookStatus;
    startsAt?: Date;
    endsAt?: Date;
  },
  now: Date,
): boolean {
  return (
    guestbook.status === "open" &&
    (!guestbook.startsAt || guestbook.startsAt <= now) &&
    (!guestbook.endsAt || now < guestbook.endsAt)
  );
}
```

Die Prüfung erfolgt beim API-Endpunkt. Ein nur im Browser ausgeblendetes Formular schützt nicht vor direkten Requests.

Der Owner kann ein Beitragsfenster sofort öffnen, zeitlich planen, verlängern, schließen und für einen weiteren Zeitraum erneut öffnen.

## 3. Besucher- und Owner-Erlebnis

### 3.1 Event- bzw. Hochzeitsscan

Während einer Feier erscheint beispielsweise:

```text
Willkommen zur Hochzeit von Anna & Max

[Glückwunsch schreiben]
[Foto hinzufügen]
[Sprachnachricht aufnehmen]

Beiträge möglich bis Sonntag, 14:00 Uhr.
```

Besucher erstellen unabhängige Beiträge; sie treten nicht automatisch in einen Chat ein und erhalten keinen Zugriff auf Beiträge anderer Teilnehmer.

### 3.2 Moderation

Sicherer Standard ist manuelle Moderation:

```ts
type GuestbookModerationMode =
  | "manual"
  | "auto-publish"
  | "owner-only";
```

| Modus | Verhalten |
| --- | --- |
| `manual` | Neue Beiträge sind `pending`; Owner veröffentlicht, lehnt ab oder entfernt sie. |
| `auto-publish` | Beiträge werden nach serverseitiger Validierung sichtbar; nur bewusst aktivieren. |
| `owner-only` | Beiträge werden gesammelt, aber erst durch spätere Owner-Entscheidung sichtbar. |

Der Owner kann veröffentlichte Beiträge in eine kuratierte TAG-Vault-Galerie oder einen Event-Block übernehmen. Das Kopieren bzw. Referenzieren verlangt eine bewusste Owner-Aktion; ein Rohupload wird nie implizit `public`.

### 3.3 Gipfelbuch-Modus

Für Gipfel, Hütten und touristische Orte kann der Owner das Guestbook als `summit-logbook` konfigurieren. Anders als ein zeitlich einmaliges Hochzeitsevent ist es üblicherweise langfristig geöffnet; ein Owner kann es dennoch saisonal schließen, auf `read-only` setzen oder moderieren.

```text
Falkenstein-Gipfelbuch

[Eintrag hinterlassen]
[Foto zum Gipfelbuch hinzufügen]

Optional: [Besuch für meine Sammlung erfassen]
```

Die Funktionen bleiben absichtlich getrennt:

- Ein Guestbook-Beitrag ist kein Check-in-Nachweis.
- Ein erfolgreicher `tag-checkin` ist keine Voraussetzung für einen Beitrag, sofern der Owner dies nicht ausdrücklich als Produktregel aktiviert.
- Die PWA darf einen Beitrag mit `qualifiedCheckInPresent: true` kennzeichnen, wenn im selben Browserkonto ein qualifizierter Check-in vorliegt.
- Präzise Position, GPS-Genauigkeit, Check-in-ID, Signatur und private Besuchshistorie werden niemals im Guestbook veröffentlicht.
- Ein Check-in darf für Collections und Campaigns zählen, auch wenn kein Guestbook-Beitrag erstellt wird.

Für Missbrauchsschutz können Owner optional Turnstile, eine Kontoanforderung oder „qualifizierter Check-in erforderlich“ aktivieren. Letztere Einstellung eignet sich nur für bewusst kontrollierte Gipfel-/Tourismusanwendungen und darf nicht zur Offenlegung privater Standortdaten führen.

### 3.4 Nach dem Event

Nach `closed` zeigt die Scan-Ansicht keine Upload-Funktion mehr. Ein Besucher kann, falls aktiviert, **„Zugriff auf Erinnerungen anfragen“** wählen. Das bestehende empfängergebundene Anfragemodell aus TAG Vault wird mit einem eingeschränkten Scope eingesetzt:

```ts
type GuestbookAccessScope =
  | "own-contributions"
  | "published-guestbook"
  | "event-gallery";
```

Der Owner entscheidet anschließend pro Anfrage über Umfang und Laufzeit. Rohuploads, abgelehnte und entfernte Beiträge werden niemals durch eine solche Freigabe sichtbar.

## 4. Beitragsformate

```ts
type GuestbookContributionContent = {
  text?: string;
  imageAssetIds?: string[];
  voiceAssetIds?: string[];
  location?: {
    label?: string;
    latitude?: number;
    longitude?: number;
    accuracyMeters?: number;
    precision?: "exact" | "approximate";
  };
};
```

| Typ | Nutzen | Standard |
| --- | --- | --- |
| Text | Glückwunsch, Nachricht, Erinnerung | erlaubt |
| Bild | Eventfoto, Foto einer Widmung | erlaubt |
| Voice | gesprochener Glückwunsch | erlaubt |
| Standort | Treffpunkt, Ort einer Erinnerung | deaktiviert; nur bei bewusster Aktivierung |

Standortübermittlung ist optional, benötigt explizite Nutzeraktion, Browserfreigabe, Vorschau und Bestätigung. Für Hochzeiten und private Events sollte sie standardmäßig deaktiviert bleiben.

## 5. Datenmodell

```sql
CREATE TABLE tag_guestbooks (
  tag_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (
    status IN ('scheduled', 'open', 'read-only', 'closed', 'disabled')
  ),
  title TEXT NULL,
  public_description TEXT NULL,
  starts_at TIMESTAMP NULL,
  ends_at TIMESTAMP NULL,
  allow_text BOOLEAN NOT NULL DEFAULT TRUE,
  allow_images BOOLEAN NOT NULL DEFAULT TRUE,
  allow_voice_messages BOOLEAN NOT NULL DEFAULT TRUE,
  allow_location BOOLEAN NOT NULL DEFAULT FALSE,
  require_qualified_checkin BOOLEAN NOT NULL DEFAULT FALSE,
  moderation_mode TEXT NOT NULL DEFAULT 'manual' CHECK (
    moderation_mode IN ('manual', 'auto-publish', 'owner-only')
  ),
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

CREATE TABLE tag_guestbook_contributions (
  id TEXT PRIMARY KEY,
  tag_id TEXT NOT NULL REFERENCES tag_guestbooks(tag_id),
  visitor_token_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('pending', 'published', 'rejected', 'removed')
  ),
  text_content TEXT NULL,
  location_json TEXT NULL,
  created_at TIMESTAMP NOT NULL,
  moderated_at TIMESTAMP NULL,
  moderated_by_owner_id TEXT NULL,
  deleted_at TIMESTAMP NULL
);

CREATE TABLE tag_guestbook_contribution_assets (
  contribution_id TEXT NOT NULL REFERENCES tag_guestbook_contributions(id),
  asset_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'voice')),
  display_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (contribution_id, asset_id)
);
```

Regeln:

- Der Browser erhält für seinen Beitrag einen kryptographisch zufälligen Token; die Datenbank speichert nur den Hash.
- Ein Besucher kann ausschließlich seinen eigenen Beitrag abrufen, ändern oder zurückziehen, solange der Owner dies erlaubt.
- Die Autorität für Veröffentlichung, Ablehnung und Entfernung liegt immer beim Owner.
- Beitrags- und Assetdaten werden gemäß konfigurierter Retention gelöscht oder anonymisiert.

## 6. API-Vorschlag

```http
GET  /api/v1/tags/{tagId}/guestbook/view
POST /api/v1/tags/{tagId}/guestbook/contributions
GET  /api/v1/tags/{tagId}/guestbook/contributions/current
PATCH /api/v1/tags/{tagId}/guestbook/contributions/current
POST /api/v1/tags/{tagId}/guestbook/contributions/current/uploads
POST /api/v1/tags/{tagId}/guestbook/contributions/current/uploads/{uploadId}/complete

GET   /api/v1/tags/{tagId}/owner/guestbook
PATCH /api/v1/tags/{tagId}/owner/guestbook
GET   /api/v1/tags/{tagId}/owner/guestbook/contributions
PATCH /api/v1/tags/{tagId}/owner/guestbook/contributions/{contributionId}
```

Schreibende Besucher-Endpunkte prüfen serverseitig Status, Zeitfenster, erlaubte Inhaltstypen, Turnstile, Rate Limits und Besucher-Session. Owner-Endpunkte benötigen eine Owner-Session und CSRF-Schutz bei Cookie-basierter Authentisierung.

## 7. Routing-Feature

```ts
export interface TagGuestbookFeature {
  id: string;
  type: "tag-guestbook";
  enabled: true;
  appUrlTemplate: string;
  contributionDefaults: {
    allowText: boolean;
    allowImages: boolean;
    allowVoiceMessages: boolean;
    allowLocation: boolean;
    moderationMode: "manual" | "auto-publish" | "owner-only";
  };
  display?: {
    presentation?: "guestbook" | "event-gallery" | "summit-logbook";
    submitLabel?: string;
    showPublishedContributions?: boolean;
  };
}
```

Beispiel für ein Hochzeitstag:

```json
{
  "id": "wedding-guestbook",
  "type": "tag-guestbook",
  "enabled": true,
  "appUrlTemplate": "https://app.myqr24.com/guestbook/{tagId}",
  "contributionDefaults": {
    "allowText": true,
    "allowImages": true,
    "allowVoiceMessages": true,
    "allowLocation": false,
    "moderationMode": "manual"
  },
  "display": {
    "presentation": "event-gallery",
    "submitLabel": "Glückwunsch oder Foto hinterlassen",
    "showPublishedContributions": true
  }
}
```

KV enthält nur die Featurekonfiguration, niemals Beitragsinhalte, Asset-Keys, Besucher- oder Owner-Tokens.

## 8. Sicherheit, Datenschutz und Caching

- Turnstile und Rate Limits schützen erste Beiträge und Uploads.
- Bilder und Voice-Nachrichten werden privat in R2 gespeichert und erst nach Berechtigungs- und Moderationsprüfung ausgeliefert.
- Dateisignatur, MIME-Type, Größe und Audio-Dauer werden serverseitig validiert; Quarantäne und optional Malware-Scan sind vorgesehen.
- Öffentliche Listen zeigen ausschließlich `published`-Beiträge und nur, wenn `showPublishedContributions` aktiviert ist.
- Rohbeiträge, Besucher-Tokens und Moderationsinformationen erhalten `Cache-Control: no-store`.
- Owner kann den Schreibzugang jederzeit schließen oder deaktivieren; laufende Uploads müssen beim Abschluss nochmals gegen den aktuellen Status geprüft werden.
- Vor Produktivsetzung sind Retention, Löschung, Umgang mit Minderjährigen und Moderationspflichten verbindlich festzulegen.
- Eine optionale Check-in-Pflicht wird serverseitig gegen einen qualifizierten, dem Besucher-/Konto-Kontext zugeordneten Check-in geprüft; die öffentliche Antwort enthält niemals Rohkoordinaten, Genauigkeit, Signatur oder Check-in-Historie.

## 9. Akzeptanzkriterien

1. Besucher können nur innerhalb eines serverseitig geöffneten Beitragsfensters Beiträge einreichen.
2. Nach `read-only`, `closed` oder `disabled` werden neue Beiträge auch über direkte API-Aufrufe abgewiesen.
3. Standardmäßig sind Beiträge erst nach Owner-Moderation veröffentlicht.
4. Besucher sehen und bearbeiten ausschließlich ihren eigenen browsergebundenen Beitrag.
5. Bilder und Voice-Nachrichten werden privat gespeichert und niemals automatisch öffentlich.
6. Owner kann ein Fenster öffnen, schließen, verlängern und Beiträge veröffentlichen, ablehnen oder entfernen.
7. Nach Eventende können Besucher nur über eine genehmigte, empfängergebundene Freigabe auf kuratierte Erinnerungen zugreifen.
8. Der `summit-logbook`-Modus kann langfristig offen sein und bleibt unabhängig von persönlichen Check-ins.
9. Bei aktivierter Check-in-Pflicht akzeptiert die API nur einen serverseitig qualifizierten Check-in; öffentliche Beiträge offenbaren keine Standort-, Genauigkeits- oder Check-in-Daten.
