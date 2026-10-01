# Lost & Found Feature – Verlustfälle mit Finder-Chat

> **Status:** Fachliche Spezifikation / Architekturvorschlag  
> **Zweck:** Ein Tag kann als verloren markiert werden und zeigt dann eine datensparsame Finder-Ansicht. Finder kommunizieren ausschließlich über TAG Chat mit dem Owner.

## 1. Einordnung

Lost & Found ist ein fachliches Feature vom Typ `lost-found`; es implementiert keinen eigenen Nachrichtenstack.

| Baustein | Verantwortung |
| --- | --- |
| `tag-vault` | optionale Owner-Inhalte wie Hotelhinweis, Bild oder öffentliche Beschreibung |
| `tag-chat` | private 1:1-Threads mit Text, Bild, Voice und bewusst gesendetem Standort |
| `lost-found` | Verluststatus, öffentliche Verlustmeldung und Aktivierung des Finder-Chats |

Ein Lost-&-Found-Tag besitzt typischerweise einen TAG Chat mit `activationMode: "lost-only"`. Der Chat darf neue Finder-Threads nur erstellen, solange der Fall serverseitig den Status `lost` und der Chat den Status `open` besitzt.

## 2. Zustandsmodell

```ts
type LostFoundStatus =
  | "active"
  | "lost"
  | "found"
  | "closed"
  | "disabled";
```

```text
active ──als verloren markieren──> lost ──als gefunden markieren──> found
  │                                  │                                │
  └──────────deaktivieren─────────> disabled                           ├─abschließen──> closed
                                     └──────────abschließen──────────> closed
```

| Status | Öffentliche Scan-Ansicht | Neue Finder-Threads |
| --- | --- | --- |
| `active` | neutrale Owner-konfigurierte Seite | nein, bei `lost-only` |
| `lost` | deutlicher Verlusthinweis und CTA „Fund melden“ | ja, wenn TAG Chat `open` ist |
| `found` | optionaler Hinweis „Gegenstand wurde gefunden“ | nein |
| `closed` | optionaler neutraler Abschluss | nein |
| `disabled` | Lost & Found nicht sichtbar | nein |

Der Owner kann bei weiterhin `lost` bleibendem Fall den TAG Chat separat schließen und später wieder öffnen. Der Verlusthinweis bleibt dadurch sichtbar, ohne neue Nachrichten entgegenzunehmen.

## 3. Finder-Erlebnis

### 3.1 Verlustansicht

Beim Scan eines als verloren markierten Tags erscheint beispielsweise:

```text
⚠️ Dieser Gegenstand wird vermisst.

Schwarzer Hartschalenkoffer. Bitte nicht weiter transportieren.
Ich organisiere die Abholung über das Hotel.

[Fund melden]
```

Der Owner kann eine öffentliche Verlustnachricht, ein freigegebenes Titelbild und neutrale Hinweise hinterlegen. Private Adresse, Reisedaten, Owner-Kontaktdaten und private TAG-Vault-Inhalte werden nicht automatisch gezeigt.

### 3.2 Fund melden

Nach Auswahl von **„Fund melden“** wird ein privater TAG-Chat-Thread angelegt. Der Finder kann – soweit vom Owner erlaubt – senden:

- Text;
- Foto des Gegenstands oder Fundorts;
- Voice-Nachricht;
- bewusst bestätigten Standort bzw. manuellen Ortsnamen.

Die Plattform vermittelt die Unterhaltung; Finder und Owner sehen standardmäßig keine direkten Kontaktinformationen des jeweils anderen.

## 4. Owner-Fluss

```text
Koffer-Tag
Status: [Aktiv v]

[Als verloren markieren]

Verlustmeldung:
[ Schwarzer Hartschalenkoffer ... ]

Finder-Chat: [Geöffnet v]
[Finder-Threads anzeigen]
```

Während des Verlustfalls kann der Owner:

- öffentliche Verlustnachricht und Titelbild ändern;
- Chat für neue Finder schließen oder wieder öffnen;
- einzelne Finder-Threads beantworten, blockieren, schließen oder löschen;
- den Fall als `found` markieren;
- den Fall abschließen oder deaktivieren.

Bei Statuswechsel von `lost` auf `found`, `closed` oder `disabled` müssen neue Finder-Threads und neue Finder-Nachrichten serverseitig unverzüglich abgewiesen werden.

## 5. Datenmodell

```sql
CREATE TABLE tag_lost_found_cases (
  tag_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (
    status IN ('active', 'lost', 'found', 'closed', 'disabled')
  ),
  public_message TEXT NULL,
  public_cover_asset_id TEXT NULL,
  lost_at TIMESTAMP NULL,
  found_at TIMESTAMP NULL,
  closed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
```

Regeln:

- Pro Tag existiert maximal ein aktueller Lost-&-Found-Fall.
- `public_cover_asset_id` muss auf ein explizit für Lost & Found freigegebenes, gültiges Asset verweisen.
- Fall-, Chat- und Owner-Auditereignisse werden nachvollziehbar protokolliert.
- Ein Statuswechsel erzeugt eine Systemnachricht in offenen Threads, sofern diese gemäß Retention noch bestehen.

## 6. API-Vorschlag

```http
GET   /api/v1/tags/{tagId}/lost-found
GET   /api/v1/tags/{tagId}/lost-found/view

PATCH /api/v1/tags/{tagId}/owner/lost-found
POST  /api/v1/tags/{tagId}/owner/lost-found/mark-lost
POST  /api/v1/tags/{tagId}/owner/lost-found/mark-found
POST  /api/v1/tags/{tagId}/owner/lost-found/close
```

Owner-Endpunkte benötigen eine Owner-Session bzw. starke Kontoauthentisierung und CSRF-Schutz bei Cookie-basierter Authentisierung. Die öffentliche View liefert nur den aktuellen Status, ausdrücklich erlaubte öffentliche Daten und die Chat-CTA, wenn der Chat serverseitig aktiviert werden darf.

## 7. Routing-Feature

```ts
export interface LostFoundFeature {
  id: string;
  type: "lost-found";
  enabled: true;
  appUrlTemplate: string;
  chatFeatureId: string;
  display?: {
    showNeutralPageWhenActive?: boolean;
    allowPublicCoverImage?: boolean;
  };
}
```

Beispiel:

```json
{
  "id": "lost-found-luggage",
  "type": "lost-found",
  "enabled": true,
  "appUrlTemplate": "https://app.myqr24.com/lost-found/{tagId}",
  "chatFeatureId": "finder-chat",
  "display": {
    "showNeutralPageWhenActive": true,
    "allowPublicCoverImage": true
  }
}
```

## 8. Sicherheits-, Datenschutz- und Caching-Regeln

- Lost-&-Found-Status und Chat-Berechtigung werden bei jedem schreibenden API-Aufruf serverseitig geprüft.
- Öffentliche Verlustansichten erhalten `Cache-Control: no-store` oder eine sehr kurze, aktiv invalidierbare TTL.
- Finder-Nachrichten, Standorte und Anhänge sind private Kommunikationsdaten und niemals öffentlich cachebar.
- Uploads verwenden zufällige R2-Keys, Signatur-/MIME-Validierung, Größenlimits, Quarantäne und optional Malware-Scan.
- Turnstile und Rate Limits des TAG Chat gelten insbesondere vor dem ersten Finder-Thread, Nachrichten und Uploads.
- Retention für Chat, Standort und Anhänge ist vor Produktion festzulegen; der Owner muss Fälle und Inhalte gemäß Löschkonzept entfernen können.

## 9. Akzeptanzkriterien

1. Im Status `active` kann ein Scanner bei `lost-only` keine Finder-Nachricht erzeugen.
2. Nach Wechsel auf `lost` erscheint die konfigurierte Verlustansicht und berechtigt zum Start eines Finder-Threads, sofern der Chat geöffnet ist.
3. Der Owner kann den Finder-Chat während eines Verlustfalls schließen und wieder öffnen, ohne den Fallstatus zu ändern.
4. Nach `found`, `closed` oder `disabled` werden neue Finder-Threads und Finder-Nachrichten serverseitig blockiert.
5. Finder können Text, Bild, Voice und Standort nur entsprechend der TAG-Chat-Policy senden.
6. Owner- und Finder-Kontaktdaten werden nicht automatisch offengelegt.
