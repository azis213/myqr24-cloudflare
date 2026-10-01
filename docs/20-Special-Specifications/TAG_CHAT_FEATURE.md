# TAG Chat Feature – sichere 1:1-Kommunikation über einen Tag

> **Status:** Fachliche Spezifikation / Architekturvorschlag  
> **Zweck:** Wiederverwendbare, plattformvermittelte 1:1-Kommunikation zwischen Tag-Owner und einem Scanner mit Text, Bild, Voice und bewusst freigegebenem Standort.

## 1. Abgrenzung und Zusammenspiel

TAG Chat ist ein eigenständiger Feature-Typ `tag-chat`. Er wird für dialogische Kommunikation eingesetzt, etwa für Lost & Found, Support oder Rückfragen zu einem Tag.

| Feature | Aufgabe |
| --- | --- |
| `tag-vault` | Owner-Inhalte, Galerie, Dokumente, Audio und Sichtbarkeiten |
| `tag-chat` | private 1:1-Threads Owner ↔ einzelner Scanner |
| `lost-found` | Verluststatus; aktiviert TAG Chat im Verlustfall |
| `tag-guestbook` | viele voneinander unabhängige, zeitlich begrenzte Event-Beiträge; kein Chat |

Chat-Anhänge verwenden dieselbe private R2-Upload- und Validierungspipeline wie TAG Vault, werden jedoch logisch dem jeweiligen Thread zugeordnet. Sie erscheinen niemals automatisch in einer Vault-Galerie oder öffentlichen Asset-Liste.

## 2. Aktivierungs- und Laufzeitmodell

```ts
type ChatActivationMode =
  | "lost-only"
  | "always-open"
  | "owner-controlled";

type ChatStatus = "open" | "closed" | "disabled";
```

| Kombination | Wirkung |
| --- | --- |
| `lost-only` + `open` | Scanner dürfen ausschließlich dann einen Thread starten, wenn der verknüpfte Lost-&-Found-Fall den Status `lost` besitzt. |
| `always-open` + `open` | Jeder Scanner darf einen eigenen Thread beginnen. |
| `owner-controlled` + `open` | Der Owner hat den Chat unabhängig von Lost & Found bewusst geöffnet. |
| beliebiger Modus + `closed` | Neue Threads und neue Scanner-Nachrichten werden abgewiesen. Bestehende Threads folgen der Owner-Richtlinie. |
| beliebiger Modus + `disabled` | Der Chat wird in der Scan-Ansicht nicht angeboten und ist über die öffentliche API nicht nutzbar. |

Die serverseitige Prüfung ist maßgeblich; ein ausgeblendeter CTA reicht nicht aus:

```ts
function mayCreateVisitorThread(
  chat: {
    activationMode: ChatActivationMode;
    status: ChatStatus;
  },
  lostFoundStatus?: "active" | "lost" | "found" | "closed" | "disabled",
): boolean {
  if (chat.status !== "open") return false;

  if (
    chat.activationMode === "always-open" ||
    chat.activationMode === "owner-controlled"
  ) {
    return true;
  }

  return lostFoundStatus === "lost";
}
```

Bei `lost-only` verhindert diese Regel Spaßnachrichten im Normalzustand: Erst nachdem der Owner den Gegenstand aktiv als verloren markiert hat, kann ein Finder schreiben.

## 3. Nutzerflüsse

### 3.1 Scanner bzw. Finder

1. Scanner öffnet die Tag-Scan-Ansicht.
2. Die API liefert eine Chat-Aktion nur, wenn `mayCreateVisitorThread` erfüllt ist.
3. Scanner wählt z. B. **„Fund melden“** oder **„Nachricht senden“**.
4. Das Backend erstellt einen browsergebundenen Thread und setzt einen zufälligen, `HttpOnly`, `Secure`, `SameSite=Strict` Session-Cookie.
5. Scanner kann im eigenen Thread Text, Bild, Voice oder bewusst bestätigten Standort senden.
6. Antworten des Owners werden per Polling oder Server-Sent Events aktualisiert.

Ein Scanner erhält weder Kontaktdaten des Owners noch Zugriff auf andere Threads, Vault-Inhalte oder interne Tag-Daten.

### 3.2 Owner

Der Owner verwaltet Threads nach Owner-Login bzw. gültiger Owner-Session:

```text
Chat: [Geöffnet v]

- Geöffnet: neue Scanner dürfen entsprechend Aktivierungsmodus schreiben
- Geschlossen: neue Scanner-Nachrichten und neue Threads werden blockiert
- Deaktiviert: Chat-CTA wird nicht ausgeliefert

Thread Fundmeldung #42
[Antworten] [Blockieren] [Schließen] [Löschen]
```

Bei einem aktiven Lost-&-Found-Fall kann der Owner den Finder-Chat schließen, ohne den Verlusthinweis selbst zu entfernen. Er kann ihn später wieder öffnen.

## 4. Nachrichtenformate

```ts
type TagChatMessageKind =
  | "text"
  | "image"
  | "voice"
  | "location"
  | "system";

type TagChatMessage = {
  id: string;
  threadId: string;
  sender: "owner" | "visitor" | "system";
  kind: TagChatMessageKind;
  createdAt: string;
  text?: string;
  assetId?: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
    precision: "exact" | "approximate";
    capturedAt: string;
  };
};
```

| Typ | Verwendung | Vorgaben |
| --- | --- | --- |
| `text` | Fundmeldung oder Owner-Antwort | Länge begrenzen, serverseitig escapen, Rate Limits |
| `image` | Foto eines Gegenstands oder Fundorts | private R2-Ablage, Signaturprüfung, Quarantäne |
| `voice` | Sprachnachricht | sichtbarer Player, MIME-/Größen-/Dauerlimit |
| `location` | Fundort oder Treffpunkt | nur nach Klick, Browserfreigabe, Vorschau und Bestätigung |
| `system` | Statuswechsel, Blockierung oder Schließung | nur Backend |

Ein Standort wird niemals automatisch beim Scan erhoben. Der Scanner kann eine exakte oder gerundete Position senden und benötigt einen manuellen Fallback wie einen Ortsnamen.

## 5. Datenmodell

```sql
CREATE TABLE tag_chat_settings (
  tag_id TEXT PRIMARY KEY,
  activation_mode TEXT NOT NULL CHECK (
    activation_mode IN ('lost-only', 'always-open', 'owner-controlled')
  ),
  status TEXT NOT NULL CHECK (status IN ('open', 'closed', 'disabled')),
  allow_text BOOLEAN NOT NULL DEFAULT TRUE,
  allow_images BOOLEAN NOT NULL DEFAULT TRUE,
  allow_voice_messages BOOLEAN NOT NULL DEFAULT TRUE,
  allow_location BOOLEAN NOT NULL DEFAULT TRUE,
  require_turnstile_for_first_message BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

CREATE TABLE tag_chat_threads (
  id TEXT PRIMARY KEY,
  tag_id TEXT NOT NULL,
  visitor_token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('open', 'blocked', 'closed')),
  created_at TIMESTAMP NOT NULL,
  last_message_at TIMESTAMP NOT NULL,
  closed_at TIMESTAMP NULL
);

CREATE TABLE tag_chat_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES tag_chat_threads(id),
  sender_type TEXT NOT NULL CHECK (sender_type IN ('owner', 'visitor', 'system')),
  kind TEXT NOT NULL CHECK (kind IN ('text', 'image', 'voice', 'location', 'system')),
  text_content TEXT NULL,
  location_json TEXT NULL,
  asset_id TEXT NULL,
  created_at TIMESTAMP NOT NULL,
  deleted_at TIMESTAMP NULL
);
```

Regeln:

- Besucher- und Wiederaufnahme-Token sind kryptographisch zufällig; nur deren Hash wird persistiert.
- Ein Thread ist ausschließlich für den Owner und den Browser mit gültiger Besucher-Session sichtbar.
- Bild- und Voice-Assets haben einen Thread-Kontext und erhalten zufällige R2-Keys.
- Gelöschte Nachrichten und Anhänge folgen einem definierten Retention- und Löschprozess.

## 6. API-Vorschlag

```http
GET  /api/v1/tags/{tagId}/chat
POST /api/v1/tags/{tagId}/chat/threads
GET  /api/v1/tags/{tagId}/chat/threads/current
POST /api/v1/tags/{tagId}/chat/threads/current/messages
POST /api/v1/tags/{tagId}/chat/threads/current/uploads
POST /api/v1/tags/{tagId}/chat/threads/current/uploads/{uploadId}/complete

GET   /api/v1/tags/{tagId}/owner/chat/threads
PATCH /api/v1/tags/{tagId}/owner/chat/settings
POST  /api/v1/tags/{tagId}/owner/chat/threads/{threadId}/messages
PATCH /api/v1/tags/{tagId}/owner/chat/threads/{threadId}
```

Alle schreibenden Endpunkte prüfen serverseitig Tag-Konfiguration, Chat-Status, Thread-Status, Nachrichtentyp, Limits und Berechtigung. Bei Cookie-basierter Authentisierung ist CSRF-Schutz erforderlich.

## 7. Routing-Feature

```ts
export interface TagChatFeature {
  id: string;
  type: "tag-chat";
  enabled: true;
  appUrlTemplate: string;
  activationMode: ChatActivationMode;
  chatStatus: ChatStatus;
  display?: {
    entryActionLabel?: string;
    showWhen?: "always" | "lost-only" | "owner-enabled";
  };
  visitorActions: {
    allowText: boolean;
    allowImages: boolean;
    allowVoiceMessages: boolean;
    allowLocation: boolean;
    requireTurnstileForFirstMessage?: boolean;
  };
}
```

KV enthält ausschließlich Konfiguration und keine Nachrichten, Medien, Session- oder Thread-Tokens.

## 8. Sicherheit, Datenschutz und Realtime

- Owner-Kontaktdaten bleiben standardmäßig verborgen; die Kommunikation ist plattformvermittelt.
- Turnstile und Rate Limits gelten mindestens vor der ersten Besucher-Nachricht und vor Uploads.
- Limits werden pro Tag, Thread, Besucher-Token und ergänzend als IP-Signal geprüft.
- Dateiinhalt, MIME-Type, Größe und Dauer werden serverseitig validiert; optionaler Malware-Scan und Quarantäne sind vorgesehen.
- Chat-, Standort- und Medieninhalte erhalten `Cache-Control: no-store`.
- Statuswechsel auf `closed`, `disabled`, `found` oder `closed` im verknüpften Lost-&-Found-Fall blockieren neue Finder-Nachrichten sofort.
- V1 verwendet HTTP mit Polling oder Server-Sent Events. WebSocket-Fan-out über Durable Objects ist eine spätere Erweiterung; D1/PostgreSQL bleibt für Nachrichtenmetadaten und R2 für Anhänge autoritativ.
- Aufbewahrungs- und Löschfristen für Standort, Nachrichten und Medien müssen vor Produktion konfigurierbar sein.

## 9. Akzeptanzkriterien

1. Bei `lost-only` kann ein Scanner erst nach dem serverseitigen Statuswechsel auf `lost` einen Thread beginnen.
2. Bei `always-open` kann ein Scanner sofort einen eigenen Thread beginnen.
3. `closed` und `disabled` blockieren neue Threads und Nachrichten auch bei direkten API-Aufrufen.
4. Owner kann Chat-Status und einzelne Threads blockieren, schließen oder wieder öffnen.
5. Ein Besucher kann ausschließlich seinen eigenen Thread lesen und beschreiben.
6. Text, Bild, Voice und Standort werden nur verarbeitet, wenn sie in der Owner-Konfiguration erlaubt sind.
7. Standortdaten werden nur nach expliziter Nutzeraktion und Bestätigung gespeichert.
8. Bild- und Voice-Anhänge sind nicht öffentlich, nicht in Vault-Galerien sichtbar und nur nach Thread-Berechtigungsprüfung abrufbar.
