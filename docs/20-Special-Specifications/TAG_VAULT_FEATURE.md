# TAG Vault Feature – Medien, Dokumente, Notizen und zeitlich begrenzter Zugriff

> **Status:** Fachliche Spezifikation / Architekturvorschlag  
> **Zweck:** Erweiterung eines myQR24-Tags um öffentliche, geteilte und private Inhalte mit PIN-geschützter Verwaltung sowie zeitlich begrenzten Freigaben nach einem Scan.

## 1. Zielbild

Ein physisches NFC-/QR-Tag kann zusätzlich zur bestehenden Edge-Routing-Funktion einen digitalen, inhaltlichen Bereich besitzen: den **TAG Vault**.

Der Besitzer eines Tags kann dort verwalten:

- Bilder und Bildsammlungen;
- einzelne Bilder oder PDF-Dokumente, beispielsweise Rechnungen;
- weitere Dokumente, etwa PDF, TXT oder zukünftig Office-Dateien;
- Sprachnachrichten und Audioguides;
- strukturierte oder freie Notizen;
- öffentliche Inhaltsseiten aus Bild, Galerie, Text, Audio und Dokumenten;
- Sichtbarkeit und Zugriffszeiträume der einzelnen Inhalte.

Ein Scanner erhält abhängig von Inhaltssichtbarkeit und aktueller Freigabe eine passende Ansicht:

| Sichtbarkeit | Ohne PIN / ohne Freigabe | Mit Eigentümer-PIN | Während aktiver Freigabe |
| --- | --- | --- | --- |
| `public` | sichtbar | sichtbar | sichtbar |
| `shared` | verborgen | sichtbar | sichtbar |
| `private` | verborgen | sichtbar | optional sichtbar, wenn explizit freigegeben |
| `ownerOnly` | verborgen | sichtbar | verborgen |

Die Scan-Ansicht zeigt daher niemals automatisch alle Inhalte. Sie zeigt stets nur die Inhalte, die in der aktuellen Berechtigungssituation sichtbar sind.

## 2. Begriffe und Rollen

| Begriff | Bedeutung |
| --- | --- |
| **Tag** | Physisches NFC-/QR-Tag mit öffentlicher `tagId` und internem `decodedValue`. |
| **Tag Vault** | Inhaltsbereich eines einzelnen Tags. |
| **Besitzer** | Person bzw. Konto, das den Tag administriert. |
| **Scanner** | Person, die den QR-Code oder NFC-Tag scannt und die öffentliche Scan-Ansicht öffnet. |
| **Owner-PIN** | Geheimnis des Besitzers zum Freischalten der vollständigen Tag-Verwaltung. |
| **Gast-PIN** | Optionales, vom Owner getrennt konfiguriertes Geheimnis für eingeschränkte Gastbeiträge. Sie gewährt niemals Owner-Rechte oder Sichtbarkeit privater Inhalte. |
| **Gast-Session** | Kurzlebige, serverseitig ausgestellte Session für einen erfolgreichen Gast-PIN-Login; sie bindet vom Gast angelegte Inhalte an genau diese Sitzung. |
| **Freigabe** | Zeitlich begrenzte Berechtigung, mit der ein Scanner zusätzlich als `shared` oder `private` markierte Inhalte sehen darf. |
| **Asset** | Dateiinhalt wie Bild, PDF oder anderes zulässiges Dokument. |
| **Notiz** | Textinhalt mit eigener Sichtbarkeit. |
| **Vault API** | Authentisierte Anwendungskomponente für Verwaltung, Uploads, PIN-Prüfung und Freigaben. |
| **Edge Worker** | Bestehender öffentlicher Resolver; er löst Tag und Route auf, besitzt aber keine Vault-Dateien und keine PIN-Hashes. |

## 3. Grundsatzentscheidungen

1. **Öffentliches Tag-Routing bleibt schlank.**  
   Der Cloudflare Worker validiert und löst die Tag-ID wie bisher auf. Private Metadaten, PIN-Hashes, Uploads und Freigabezustände werden nicht im öffentlich lesbaren Routing-KV gespeichert.

2. **Inhalte und Berechtigungen werden serverseitig geprüft.**  
   Ein Browser entscheidet niemals selbst, ob ein Inhalt privat oder sichtbar ist. Die Vault API bestimmt, welche Metadaten, Notizen oder Download-URLs ausgeliefert werden.

3. **Dateien sind standardmäßig privat.**  
   Assets liegen in einem privaten Object Store (beispielsweise Cloudflare R2). Die Anwendung liefert zeitlich begrenzte, autorisierte Download-URLs oder streamt Dateien nach serverseitiger Prüfung.

4. **PIN ersetzt kein Benutzerkonto für hochsensible Nutzung.**  
   Eine PIN ist als praktische Schutzstufe pro Tag geeignet. Für Wiederherstellung, mehrere Besitzer, rechtssichere Rechnungsarchive oder besonders vertrauliche Daten sollte zusätzlich eine echte Konto-Authentisierung (Passkey, Passwort, SSO) vorgesehen werden.

5. **Temporäre Sichtbarkeit ist explizit.**  
   `shared` und `private` werden erst sichtbar, wenn der Besitzer nach erfolgreicher PIN-Prüfung eine Freigabe aktiviert. Die Freigabe hat eine klare, kurze Ablaufzeit und kann jederzeit widerrufen werden.

## 4. Sichtbarkeitsmodell

Jeder Inhalt erhält eine Sichtbarkeitsklasse.

```ts
type Visibility = "public" | "shared" | "private" | "ownerOnly";
```

### 4.1 Bedeutungen

| Stufe | Scanner ohne Freigabe | Scanner mit aktiver Freigabe | Besitzer nach PIN | Geeignete Inhalte |
| --- | --- | --- | --- | --- |
| `public` | sichtbar | sichtbar | sichtbar | Kontaktinfos, Produktdaten, Bedienhinweise, öffentliches Bild |
| `shared` | nicht sichtbar | sichtbar | sichtbar | Kurzzeitig teilbare Fotos, Liefer-/Übergabeinformationen |
| `private` | nicht sichtbar | nur bei expliziter `private`-Freigabe sichtbar | sichtbar | Rechnung, sensible Notiz, private Bilder |
| `ownerOnly` | nicht sichtbar | nicht sichtbar | sichtbar | Entwürfe, interne Verwaltungsnotizen, PIN-Hinweise niemals als Inhalt |

### 4.2 Freigabemodi

Beim Freischalten wählt der Besitzer nicht nur eine Dauer, sondern auch den Umfang:

```ts
type GrantScope = "shared" | "private";
```

| Auswahl im Verwaltungsformular | Sichtbar für Scanner |
| --- | --- |
| **Nur geteilte Inhalte** | `public` + `shared` |
| **Private Inhalte mitfreigeben** | `public` + `shared` + `private` |
| **Keine Freigabe / Sperren** | nur `public` |

`ownerOnly` ist niemals Teil einer Scanner-Freigabe.

### 4.3 Empfohlene Standardwerte

- Neue Uploads: `private`
- Neue Notizen: `private`
- Inhalte für alle Scanner: bewusst auf `public` setzen
- Inhalte für zeitweilige Übergaben: `shared`
- Steuerungs- und interne Verwaltungsdaten: `ownerOnly`

Damit entsteht kein versehentlich öffentliches Dokument durch einen Standardwert.

## 5. Nutzererlebnis

### 5.1 Öffentliche Scan-Ansicht

Ein Scan auf `https://qx4.uk/t/{TAG-ID}` führt durch den Edge Worker. Das Routenpfadsegment und die TAG-ID werden case-insensitiv verarbeitet; erzeugte Links verwenden kanonisch Kleinschreibung. Route-lose TAG-URLs sind nicht zulässig. Ist dem Tag ein Vault-Feature zugewiesen, leitet das Routing beispielsweise auf folgende feste PWA-Ansicht:

```text
https://app.myqr24.com/tag/{tagId}
```

Die PWA ruft anschließend die öffentliche Vault-Ansicht ab:

```http
GET /api/tags/{tagId}/view
```

Die API liefert nur aktuell sichtbare Daten:

```json
{
  "tag": {
    "id": "abc123",
    "displayName": "Werkzeugkoffer 12"
  },
  "access": {
    "level": "public",
    "grantExpiresAt": null
  },
  "items": [
    {
      "id": "note-safety",
      "kind": "note",
      "title": "Sicherheitshinweis",
      "visibility": "public",
      "text": "Bitte trocken lagern."
    },
    {
      "id": "image-cover",
      "kind": "asset",
      "title": "Produktfoto",
      "mediaType": "image/jpeg",
      "visibility": "public",
      "downloadUrl": "https://..."
    }
  ],
  "actions": [
    {
      "id": "more-tag-actions",
      "label": "Mehr mit diesem Tag",
      "href": "/tag/abc123/actions"
    }
  ]
}
```

Die Oberfläche zeigt abhängig von den gelieferten Daten beispielsweise:

- Titel und öffentliche Beschreibung;
- öffentliche Bilder;
- öffentliche Notizen;
- Download-Schaltflächen für öffentlich freigegebene Dokumente;
- bei Bedarf genau einen Footer-Button **„Mehr mit diesem Tag“**;
- bei aktiver Freigabe einen klaren Hinweis, etwa:  
  **„Freigabe aktiv bis 14:35 Uhr“**.

Die öffentliche Scan-Ansicht ist grundsätzlich eine Konsumansicht. Verwaltungs-, PIN- und Freigabeaktionen stehen nicht zwischen Bildern, Texten oder Audioplayern. Der optionale einzelne Footer-Button bündelt nur Aktionen, die im aktuellen Kontext zulässig sind:

| Kontext | Footer-Aktion bzw. Menüinhalt |
| --- | --- |
| Öffentlicher Besucher mit zusätzlichen geschützten Inhalten | `Zugriff auf weitere Inhalte anfragen` |
| Öffentlicher Besucher ohne weitere freigebbare Inhalte | keine Aktion oder optionale allgemeine Tag-Information |
| Owner ohne aktive Owner-Session | `Tag verwalten` |
| Entsperrter Owner | `Inhalte bearbeiten`, `Inhalte freigeben`, `Offene Anfragen` |
| Empfänger mit aktiver Freigabe | Freigabe-Status und optional `Zugriff auf diesem Gerät beenden` |

Für reine Public-Tags kann die Footer-Aktion vollständig ausgeblendet werden. Das Ausblenden betrifft ausschließlich die öffentliche Darstellung; die Owner-Verwaltung bleibt über das geschützte Owner-Dashboard oder eine geschützte Verwaltungs-URL erreichbar.

Nicht sichtbare Inhalte dürfen nicht als Namen, Anzahl, Vorschau oder Platzhalter geleakt werden.

### 5.2 Besitzerfluss: PIN öffnen und verwalten

1. Besitzer scannt das Tag oder öffnet die Tag-URL.
2. Besitzer wählt **„Tag verwalten“**.
3. Die Anwendung zeigt ein PIN-Formular.
4. Nach erfolgreicher PIN-Prüfung wird eine kurzlebige Owner-Session erzeugt.
5. Das Verwaltungs-Dashboard zeigt:
   - Inhalt hinzufügen;
   - Bild hochladen;
   - Dokument / Rechnung hochladen;
   - Notiz hinzufügen;
   - Sichtbarkeit ändern;
   - Inhalt löschen oder archivieren;
   - Freigabe starten bzw. stoppen;
   - Ablaufzeit der laufenden Freigabe.

Empfohlene Ansicht:

```text
[TAG: Werkzeugkoffer 12]                        [Sperren]

Inhalte
[+ Bild] [+ Dokument] [+ Notiz]

- Produktfoto.jpg        Bild       Public      [Bearbeiten]
- Rechnung-2026-04.pdf   Dokument   Private     [Bearbeiten]
- Übergabehinweis        Notiz      Shared      [Bearbeiten]

Temporäre Freigabe
[ Nur geteilte Inhalte v ] [ 10 Minuten v ] [Freigabe starten]
Aktuell: Keine aktive Freigabe
```

### 5.3 Temporäre Freigabe

Nach PIN-Prüfung kann der Besitzer eine Freigabe starten:

1. Sichtbarkeitsumfang auswählen:
   - **Nur geteilte Inhalte**
   - **Geteilte und private Inhalte**
2. Dauer auswählen:
   - 5 Minuten
   - 10 Minuten
   - 15 Minuten
   - optional 30 Minuten als oberes Standardlimit
3. **„Freigabe starten“** drücken.
4. Die API speichert den serverseitigen Ablaufzeitpunkt.
5. Ab diesem Zeitpunkt erhalten neue Scanner-Aufrufe die zusätzlichen Inhalte.
6. Der Besitzer kann die Freigabe jederzeit mit **„Jetzt sperren“** widerrufen.

Eine Freigabe gilt grundsätzlich für neue Abrufe bis zum Ablauf. Bereits geladene Inhalte oder bereits ausgegebene Datei-URLs können technisch nicht zuverlässig „aus dem Browser zurückgeholt“ werden. Deshalb sind kurze Laufzeiten und ebenfalls kurzlebige Asset-URLs erforderlich.

## 6. Formular- und Inhaltsmodell

### 6.1 Inhaltstypen

```ts
type VaultItemKind = "asset" | "note";
type AssetCategory = "image" | "audio" | "document" | "invoice";
```

| Typ | Beispiele | Wichtige Eingaben |
| --- | --- | --- |
| `asset:image` | JPG, PNG, WebP | Datei, Titel, Beschreibung, Sichtbarkeit, Sortierung |
| `asset:audio` | Sprachnachricht, Audioguide | Audiodatei, Titel, optionales Transkript, Sichtbarkeit |
| `asset:document` | PDF, TXT, zukünftig DOCX | Datei, Titel, Dokumenttyp, Sichtbarkeit |
| `asset:invoice` | PDF-Rechnung, Rechnungsfoto | Datei, Titel, Rechnungsnummer optional, Rechnungsdatum optional, Sichtbarkeit |
| `note` | Freitext, Übergabehinweis | Titel, Text, Sichtbarkeit |

Die Kategorie `invoice` ist fachlich ein Dokument mit optionalen Rechnungsmetadaten. Sie benötigt keinen eigenständigen öffentlichen Speicherpfad.

### 6.2 Upload-Formular

Das Formular **„Datei hinzufügen“** enthält:

| Feld | Typ | Pflicht | Validierung |
| --- | --- | --- | --- |
| Kategorie | Auswahl | ja | Bild, Audio, Dokument, Rechnung |
| Datei | Dateiauswahl | ja | erlaubter MIME-Type, Größenlimit, Server-Prüfung |
| Titel | Text | ja | 1–160 Zeichen |
| Beschreibung | Textarea | nein | begrenzte Länge, HTML nicht direkt rendern |
| Sichtbarkeit | Auswahl | ja | `public`, `shared`, `private`; `ownerOnly` nur bewusst in erweiterten Einstellungen |
| Rechnungsnummer | Text | nur Rechnung optional | serverseitig normalisieren |
| Rechnungsdatum | Datum | nur Rechnung optional | valides Datum |
| Sortierung | Zahl / UI | nein | positive, serverseitig begrenzte Zahl |

#### Erlaubte Dateitypen – initiale Empfehlung

| Kategorie | Erlaubte Medienarten |
| --- | --- |
| Bild | `image/jpeg`, `image/png`, `image/webp` |
| Audio | `audio/mpeg`, `audio/mp4`; optional später `audio/ogg`, `audio/webm` |
| Dokument | `application/pdf`, `text/plain` |
| Rechnung | bevorzugt `application/pdf`, optional Bildtypen |

Office-Dateien, ZIP-Dateien, HTML und ausführbare Inhalte sollten in der ersten Version nicht akzeptiert werden. Besonders SVG ist wegen möglicher Script-Inhalte nur mit sorgfältiger Sanitierung zuzulassen und deshalb initial auszuschließen.

#### Größen- und Mengenlimits – Vorschlag

| Grenze | Vorschlag |
| --- | --- |
| Bildgröße | maximal 10 MiB pro Datei |
| Audiodatei | maximal 25 MiB pro Datei; maximale Dauer produktseitig festlegen |
| PDF-/Dokumentgröße | maximal 25 MiB pro Datei |
| Maximale Dateien pro Tag | 100, konfigurierbar |
| Notizlänge | maximal 10.000 Zeichen |
| Titel | maximal 160 Zeichen |
| Freigabe | maximal 30 Minuten je Aktivierung |

Die tatsächlichen Grenzwerte sind abhängig von Produkt, Kostenmodell und R2-/Egress-Strategie final festzulegen.

### 6.3 Notizformular

Das Formular **„Notiz hinzufügen“** enthält:

```text
Titel:          [____________________________]
Notiz:          [____________________________]
                [____________________________]
Sichtbarkeit:   [Privat v]
                [Speichern]
```

Notizen werden als Klartext oder über einen streng sanitisierten Rich-Text-Editor verarbeitet. Rohes HTML darf nicht ungeprüft gespeichert und ausgeliefert werden, um XSS zu verhindern.

### 6.4 Präsentationsprofile und sichere Inhaltsblöcke

Der TAG Vault bleibt das einheitliche Content- und Berechtigungsmodell. Statt separater Routing-Features für Galerie-, Informations- oder Museums-Tags verwendet ein Vault ein Präsentationsprofil:

```ts
type VaultPresentation =
  | "standard"
  | "gallery"
  | "public-page"
  | "museum-exhibit"
  | "summit-guide";

type PublicActionMode =
  | "hidden"
  | "footer-menu"
  | "owner-only"
  | "access-request";
```

| Profil | Geeignet für | Scan-Darstellung |
| --- | --- | --- |
| `standard` | private und gemischte Tags | Sichtbare Inhalte in einer allgemeinen Inhaltsübersicht |
| `gallery` | Fotos, Produkte, Immobilien, Erinnerungen | Hauptbild und Bildergalerie stehen im Vordergrund |
| `public-page` | Informations-, Veranstaltungs- und Produktseiten | Strukturierte Seite aus Bild, Text, Audio und Anhängen |
| `museum-exhibit` | Objektbeschreibungen und Audioguides | Öffentliche Ausstellungsseite mit Galerie, Beschreibung und Audioguide |
| `summit-guide` | Gipfel, Hütten und touristische Orte | Öffentliche Ortsseite mit Beschreibung, Sicherheitsinfos, Galerie, Audioguide und optionalen Check-in-/Gipfelbuch-Einstiegen |

Ein reines Public-Tag ist kein eigener Datentyp: Es ist ein Vault mit ausschließlich `public` publizierten Inhalten, einem öffentlichen Präsentationsprofil und `publicActionMode: "hidden"`.

Das Profil `summit-guide` steuert ausschließlich die öffentliche Darstellung. GEO-verifizierte Besuche, Collection-Einträge, Campaign-Credits und deren Berechtigungen gehören zum separaten Feature `tag-checkin`; die verbindliche Regelung steht in [TAG Check-in, Collections & Campaigns](TAG_CHECKIN_COLLECTIONS_CAMPAIGNS.md).

Für öffentliche Gipfel-, Hütten-, Museums-, Tourismus- und Community-TAGs gelten zusätzlich die Produkt-, Betreiber-, Anbringungs-, Laufzeit-, Moderations- und Meldeanforderungen aus [TAG-Typen und POI-/Community-TAGs](TAG_TYPES_AND_POI_FEATURES.md). Ein `summit-guide`-Profil allein macht ein TAG nicht zu einem autorisierten POI-TAG.

Inhalte werden nicht als frei ausführbares HTML gespeichert, sondern als serverseitig validierte Inhaltsblöcke. JavaScript, Inline-Eventhandler, frei eingebettete iFrames und externe Skripte sind in Vault-Inhalten nicht zulässig.

```ts
type PublicContentBlock =
  | HeroBlock
  | RichTextBlock
  | GalleryBlock
  | AudioBlock
  | DocumentBlock
  | CalloutBlock
  | LinkBlock
  | GooglePlaceLinkBlock;

type GalleryBlock = {
  id: string;
  type: "gallery";
  title?: string;
  visibility: Visibility;
  coverAssetId: string;
  assetIds: string[];
  layout: "carousel" | "grid" | "masonry";
  showCaptions: boolean;
};

type AudioBlock = {
  id: string;
  type: "audio";
  title: string;
  assetId: string;
  transcript?: string;
  visibility: Visibility;
  showPlayer: boolean;
};

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

Eine Galerie hat immer ein ausdrücklich festgelegtes `coverAssetId` als Hauptbild sowie eine kontrollierte Reihenfolge von `assetIds`. Die Anwendung erzeugt und liefert für Bilder passende Thumbnail-, mobile und Galerievarianten. Originaldateien werden nur bei Bedarf und nach Berechtigungsprüfung bereitgestellt.

Ein Audio-Block nutzt einen sichtbaren Player mit einer Nutzeraktion wie **„Audioguide abspielen“**. Audio mit Ton darf nicht als verpflichtendes Autoplay angenommen werden, da Browser dies typischerweise blockieren. Ein optionales Transkript verbessert Barrierefreiheit, Suchbarkeit und Nutzung ohne Ton.

Ein `RichTextBlock` speichert strukturierten bzw. strikt sanitisierten Text. Er darf keine unsicheren HTML- oder JavaScript-Inhalte ausführen. Wenn später frei gestaltete Seiten nötig werden, ist dies als getrennte, CSP-gesicherte Erweiterung zu behandeln und nicht als unbeschränkter Vault-Text.

Ein `GooglePlaceLinkBlock` ist ein bewusster externer Link und keine Kartenintegration. `mapsUrl` wird ausschließlich aus validierter Owner-/Administrationskonfiguration erzeugt; Request-Parameter oder frei übergebene Redirect-URLs sind nicht zulässig. Die PWA kann etwa **„Ort in Google Maps öffnen“** sowie Hinweise zu Google-Bewertungen und Fotos darstellen, ohne eine Google-Maps-Einbettung oder einen Maps-API-Key zu benötigen.

## 7. Fachliches Datenmodell

Die Datenbank ist die autoritative Quelle für Eigentümerschaft, PIN-Hashes, Inhalte, Freigaben und Audit-Ereignisse. Cloudflare KV bleibt für die schnelle öffentliche Tag-/Feature-Auflösung reserviert.

Die folgenden Tabellen sind relational formuliert, lassen sich aber sinngemäß in D1, PostgreSQL oder einer anderen Datenbank abbilden.

### 7.1 Tags und Vault-Einstellungen

```sql
CREATE TABLE tag_vaults (
  tag_id TEXT PRIMARY KEY,
  owner_account_id TEXT NULL,
  display_name TEXT NULL,
  public_description TEXT NULL,
  presentation TEXT NOT NULL DEFAULT 'standard',
  public_action_mode TEXT NOT NULL DEFAULT 'footer-menu',
  content_blocks_json TEXT NULL,
  owner_pin_hash TEXT NOT NULL,
  guest_pin_hash TEXT NULL,
  pin_version INTEGER NOT NULL DEFAULT 1,
  failed_pin_attempts INTEGER NOT NULL DEFAULT 0,
  pin_locked_until TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
```

Wichtige Regeln:

- `owner_pin_hash` und der optionale `guest_pin_hash` sind getrennte, langsame Passwort-Hashes, beispielsweise **Argon2id**; ein Rollenwechsel durch Wiederverwendung desselben Hashes ist unzulässig.
- Zugangscodes werden niemals im Klartext gespeichert, geloggt oder an den Client zurückgegeben.
- Ein zufälliger Salt gehört in den Passwort-Hash-Output.
- Nach mehreren Fehlversuchen wird der Zugriff zeitweise gesperrt.
- Der Besitz eines physischen Tags ist kein ausreichender Berechtigungsnachweis für private Inhalte.
- `content_blocks_json` enthält ausschließlich serverseitig validierte Blockdaten und referenziert Assets über IDs; es enthält kein ausführbares HTML oder JavaScript.
- `presentation` und `public_action_mode` steuern nur die Darstellung. Sie ersetzen niemals die serverseitige Sichtbarkeits- und Berechtigungsprüfung.

### 7.2 Vault-Inhalte

```sql
CREATE TABLE tag_vault_items (
  id TEXT PRIMARY KEY,
  tag_id TEXT NOT NULL REFERENCES tag_vaults(tag_id),
  kind TEXT NOT NULL CHECK (kind IN ('asset', 'note')),
  category TEXT NULL CHECK (category IN ('image', 'audio', 'document', 'invoice')),
  title TEXT NOT NULL,
  description TEXT NULL,
  visibility TEXT NOT NULL CHECK (
    visibility IN ('public', 'shared', 'private', 'ownerOnly')
  ),
  note_text TEXT NULL,
  object_key TEXT NULL,
  original_filename TEXT NULL,
  media_type TEXT NULL,
  byte_size BIGINT NULL,
  sha256 TEXT NULL,
  invoice_number TEXT NULL,
  invoice_date DATE NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('uploading', 'active', 'quarantined', 'deleted')
  ),
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  deleted_at TIMESTAMP NULL
);
```

Regeln:

- Bei `kind = 'note'` ist `note_text` gesetzt und `object_key` leer.
- Bei `kind = 'asset'` ist `object_key` gesetzt und `note_text` leer.
- `status = 'uploading'` oder `quarantined` wird niemals in Scanner-Ansichten geliefert.
- Soft Delete mit `deleted_at` ermöglicht Audit und Wiederherstellung nach definierter Aufbewahrungsfrist.
- `sha256` dient der Integritäts- und Duplikaterkennung, nicht als Zugriffsberechtigung.

### 7.3 Temporäre Freigaben

```sql
CREATE TABLE tag_access_grants (
  id TEXT PRIMARY KEY,
  tag_id TEXT NOT NULL REFERENCES tag_vaults(tag_id),
  scope TEXT NOT NULL CHECK (scope IN ('shared', 'private')),
  starts_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  created_by_account_id TEXT NULL,
  created_at TIMESTAMP NOT NULL
);
```

Nur eine aktive Freigabe pro Tag sollte gleichzeitig zulässig sein. Falls mehrere Freigaben technisch möglich werden, bestimmt die wirksamste höchste Stufe:

```text
private > shared > public
```

Eine Freigabe ist aktiv, wenn:

```text
starts_at <= now
AND expires_at > now
AND revoked_at IS NULL
```

### 7.4 Owner-, Gast-Sessions und Audit

```sql
CREATE TABLE tag_owner_sessions (
  id TEXT PRIMARY KEY,
  tag_id TEXT NOT NULL REFERENCES tag_vaults(tag_id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL,
  last_seen_at TIMESTAMP NULL
);

CREATE TABLE tag_guest_sessions (
  id TEXT PRIMARY KEY,
  tag_id TEXT NOT NULL REFERENCES tag_vaults(tag_id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL,
  last_seen_at TIMESTAMP NULL
);

CREATE TABLE tag_vault_audit_events (
  id TEXT PRIMARY KEY,
  tag_id TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT NULL,
  event_type TEXT NOT NULL,
  item_id TEXT NULL,
  metadata_json TEXT NULL,
  created_at TIMESTAMP NOT NULL
);
```

Zu auditierende Ereignisse:

- erfolgreiche und fehlgeschlagene PIN-Prüfung;
- PIN-Sperrung und Entsperrung;
- Upload begonnen, abgeschlossen, abgelehnt oder quarantänisiert;
- Inhalt erstellt, verändert, gelöscht oder Sichtbarkeit geändert;
- Freigabe gestartet, geändert, abgelaufen oder widerrufen;
- Zugriff auf privaten Asset-Download, mindestens pseudonymisiert und datenschutzkonform.

## 8. Zielarchitektur

```text
Scanner / Besitzer-Browser
        │
        ▼
qx4.uk/t/{tagId} oder p.myqr24.com/t/{tagId}
        │
        ▼
Cloudflare Edge Worker
  - URL-/Tag-Validierung
  - Feistel-/HMAC-Prüfung
  - Range- und Feature-Auflösung aus TAG_CONFIG
  - Redirect zur festen Vault-PWA
        │
        ▼
Vault PWA / API
  - öffentliche Anzeige
  - PIN-Entsperrung
  - Owner-Session
  - Inhalts- und Freigabeprüfung
  - Upload-Orchestrierung
        │                 │
        ▼                 ▼
D1/PostgreSQL          Privates R2-Bucket
  - Metadaten           - Bilder
  - PIN-Hashes          - PDFs
  - Freigaben           - Dokumente
  - Sessions/Audit
```

### 8.1 Verantwortungsgrenzen

| Komponente | Verantwortlich für | Nicht verantwortlich für |
| --- | --- | --- |
| Edge Worker | öffentliche Tag-Auflösung, Routing, sichere Redirects | PIN-Prüfung, Dateiupload, private Daten |
| KV `TAG_CONFIG` | Ranges, Gruppen, Feature-Zuweisungen | private Inhalte, PIN-Hashes, Freigaben |
| Vault API | Autorisierung, PIN-Login, Freigaben, Metadaten | langfristige Objektablage |
| R2 | private Binärdateien | fachliche Berechtigungsentscheidung |
| Datenbank | autoritative Metadaten, Sessions, Freigaben, Audit | öffentliches Edge-Range-Routing |

## 9. Feature-Dokument für das bestehende Routing

Das bestehende Feature-Modell kann durch den neuen Feature-Typ `tag-vault` erweitert werden. Das Routing verweist nur auf eine feste, vertrauenswürdige Anwendung; es speichert keine privaten Inhalte.

Vorschlag für ein KV-Feature-Dokument:

```json
{
  "id": "vault-standard",
  "type": "tag-vault",
  "enabled": true,
  "appUrlTemplate": "https://app.myqr24.com/tag/{tagId}",
  "presentation": "public-page",
  "accessMode": "public-only",
  "display": {
    "publicActionMode": "hidden",
    "showPublicContent": true
  }
}
```

Empfohlene TypeScript-Form:

```ts
export interface VaultFeature {
  id: string;
  type: "tag-vault";
  enabled: true;
  appUrlTemplate: string;
  presentation?:
    | "standard"
    | "gallery"
    | "public-page"
    | "museum-exhibit"
    | "summit-guide";
  accessMode?: "mixed" | "public-only" | "private-first";
  display?: {
    publicActionMode?: "hidden" | "footer-menu" | "owner-only" | "access-request";
    showPublicContent?: boolean;
  };
}
```

Der Worker kann einen `tag-vault`-Feature-Typ entweder:

1. mit einem sicheren Redirect auf `appUrlTemplate` ausführen, oder
2. als JSON-Aktionsdokument an eine bereits vorhandene PWA liefern.

Für die erste Produktversion ist ein Redirect auf die feste Vault-PWA am einfachsten. Die PWA kennt die öffentliche Tag-ID, ruft die Vault API auf und rendert Profil, sichtbare Blöcke sowie gegebenenfalls genau eine Footer-Aktion.

`accessMode: "public-only"` bedeutet, dass die Scan-Ansicht ausschließlich öffentliche Inhalte rendert und keine Owner-/Anfrageaktion anbietet. Der Owner kann das Tag trotzdem über das geschützte Owner-Dashboard verwalten. Ein Museumstag oder eine reine öffentliche Informationsseite ist somit eine `tag-vault`-Konfiguration und kein separates Edge-Feature.

## 10. API-Vorschlag

Die API sollte keine Berechtigungsentscheidung ausschließlich anhand einer `tagId` treffen. Jede schreibende oder private Operation braucht eine Owner-Session oder später eine Kontoauthentisierung.

### 10.1 Öffentliche Ansicht

```http
GET /api/v1/tags/{tagId}/view
```

Antwort: nur `public` sowie Inhalte aktiver Freigaben. Es werden keine privaten Metadaten über nicht sichtbare Inhalte zurückgegeben.

```http
GET /api/v1/tags/{tagId}/items/{itemId}/download
```

Die API prüft die aktuelle Sichtbarkeit bei jedem Abruf und gibt dann entweder:

- einen sehr kurzlebigen signierten R2-Link aus, oder
- streamt die Datei selbst.

### 10.2 Zugangscode-Entsperrung und Gastrolle

Die API behandelt Owner- und Gastzugang als getrennte Rollen. Eine Eingabe wird genau einmal per HTTPS an die API übertragen; der Browser erzeugt weder einen statischen Client-Hash noch erhält er Salt, Hash, Secret oder Rollenansprüche als frei speicherbares Token.

```ts
type AccessCodeFormat = "numeric" | "alphanumeric";

type AccessCodeUiPolicy = {
  format: AccessCodeFormat;
  maxLength: 20;
};
```

| Format | UI-Vorgabe | Serverseitige Validierung |
| --- | --- | --- |
| `numeric` | verdecktes Feld mit `inputmode="numeric"` und `pattern="[0-9]*"` | ausschließlich ASCII-Ziffern `0–9`, maximal 20 Zeichen |
| `alphanumeric` | verdecktes Textfeld | `A-Z`, `a-z`, `0-9`, optional `-` und `_`; maximal 20 Zeichen |

Die API prüft die Formatvorgabe unabhängig von der UI erneut. Nach erfolgreicher Argon2id-Prüfung stellt sie eine rollenbezogene `HttpOnly`, `Secure`, `SameSite=Strict`-Session aus. PIN-Felder werden im Browser nach dem Request geleert.

Eine Gast-Session darf ausschließlich innerhalb derselben gültigen Session eigene Gastinhalte anlegen, bearbeiten und soft löschen. Sie darf niemals:

- Owner-Inhalte, private Vault-Inhalte oder Owner-Metadaten lesen;
- Sichtbarkeiten auf `public`, `private` oder `ownerOnly` setzen;
- Freigaben, PINs, Sessions oder Limits verwalten;
- fremde Gastinhalte bearbeiten oder löschen;
- Upload-Limits umgehen.

Die spätere API speichert bei einem Gastinhalt eine interne `created_by_guest_session_id`; die Autorisierung vergleicht sie mit der serverseitigen Session-ID, nicht mit einem Cookie-Rohwert oder der PIN.

### 10.3 Owner-PIN-Entsperrung

```http
POST /api/v1/tags/{tagId}/owner-sessions
Content-Type: application/json

{
  "pin": "123456"
}
```

Erfolgsantwort:

- `HttpOnly`, `Secure`, `SameSite=Strict` Session-Cookie für browserbasierte Verwaltung;
- kurze Session-Laufzeit, beispielsweise 15 Minuten Inaktivität / maximal 60 Minuten absolut;
- keine PIN und kein Hash in Response, URL oder Browser-Speicher.

Alternativ kann die PWA einen kurzlebigen Bearer-Token verwenden, jedoch ist ein `HttpOnly`-Cookie für denselben vertrauenswürdigen Origin meist sicherer.

### 10.4 Inhalte verwalten

```http
GET    /api/v1/tags/{tagId}/owner/items
POST   /api/v1/tags/{tagId}/owner/items
PATCH  /api/v1/tags/{tagId}/owner/items/{itemId}
DELETE /api/v1/tags/{tagId}/owner/items/{itemId}
```

Alle Endpunkte benötigen eine gültige Owner-Session und CSRF-Schutz, wenn Cookie-basierte Authentisierung verwendet wird.

### 10.5 Direkt-Upload mit serverseitiger Freigabe

Empfohlener Ablauf:

1. Besitzer öffnet Upload-Formular mit gültiger Owner-Session.
2. Browser sendet Metadaten an:
   ```http
   POST /api/v1/tags/{tagId}/owner/uploads
   ```
3. API prüft Berechtigung, Kategorie, Größe, Dateityp und Rate Limits.
4. API erstellt einen kurzlebigen, auf genau einen Object Key begrenzten Upload-Vorgang.
5. Browser lädt direkt nach R2 hoch.
6. Browser bestätigt Abschluss:
   ```http
   POST /api/v1/tags/{tagId}/owner/uploads/{uploadId}/complete
   ```
7. API prüft Objektgröße, Content Type und optional Malware-Scan-Ergebnis.
8. Erst dann wird der `tag_vault_items`-Eintrag auf `active` gesetzt.

Der Browser darf keinen frei wählbaren R2-Key verwenden. Der Key wird ausschließlich serverseitig vergeben.

### 10.6 Freigabe verwalten

```http
POST /api/v1/tags/{tagId}/owner/grants
Content-Type: application/json

{
  "scope": "shared",
  "ttlSeconds": 600
}
```

```http
DELETE /api/v1/tags/{tagId}/owner/grants/current
```

Serverseitige Regeln:

- `ttlSeconds` nur aus einer Allowlist, z. B. `300`, `600`, `900`, `1800`;
- Freigabe maximal 30 Minuten;
- `private`-Freigabe erfordert eine bewusste Bestätigung im UI;
- jede Erstellung, Verlängerung und jeder Widerruf wird auditiert;
- die Antwort enthält nur Ablaufzeit und Scope, nie geheime Freigabetoken.

## 11. Empfängergebundene Zugriffsanfragen und Einmalfreigaben

Die zeitbasierte globale Freigabe aus Abschnitt 5.3 ist für kurze Vor-Ort-Situationen geeignet. Für private Inhalte und Remote-Entscheidungen wird zusätzlich eine **empfängergebundene Zugriffsanfrage** angeboten. Sie gibt niemals automatisch allen Scannern Zugriff, sondern ausschließlich dem Browser bzw. später optional dem Konto des anfragenden Partners.

### 11.1 Zwei getrennte Lebenszyklen

Eine Zugriffsanfrage und die später daraus erteilte Berechtigung sind unterschiedliche Objekte:

| Objekt | Zweck | Gültigkeit |
| --- | --- | --- |
| Anfrage | Wartet auf Entscheidung des Owners | vom Owner konfiguriert: bis manuell gelöscht, feste Dauer oder automatisches Bereinigungsfenster |
| Vergleichscode | Menschlicher Abgleich zwischen Partner und Owner | kurzlebig, z. B. 5 bis 15 Minuten; erneuerbar |
| Empfängerfreigabe | Tatsächliche Berechtigung des genehmigten Empfängers | einmalig, zeitlich begrenzt oder dauerhaft bis Widerruf |

Dadurch kann eine Anfrage auch noch später genehmigt werden, ohne dass ein vor Tagen genannter Vergleichscode als dauerhafter Sicherheitsnachweis missverstanden wird.

### 11.2 Partnerfluss: Scan und Anfrage

1. Der Partner scannt das Tag und sieht ausschließlich `public`-Inhalte.
2. Er wählt **„Zugriff anfragen“**.
3. Die Vault API erstellt eine Anfrage, die an einen zufälligen Token in genau diesem Browser gebunden ist.
4. Der Partner erhält einen menschlich lesbaren Vergleichscode, beispielsweise `KIEFER-42-BLAU`.
5. Er teilt diesen Code dem Owner persönlich, telefonisch oder über einen anderen vertrauenswürdigen Kanal mit.
6. Die öffentliche Ansicht zeigt den neutralen Status **„Anfrage wartet auf Freigabe“**.
7. Nach Genehmigung aktualisiert die Ansicht automatisch per Polling, Server-Sent Events oder WebSocket und verwendet die empfängergebundene Sitzung.

Der Vergleichscode dient nur dazu, dass der Owner die richtige offene Anfrage erkennt. Das tatsächliche Recht ist immer ein kryptographisch zufälliger Empfänger-Session-Token und niemals der angezeigte Code.

### 11.3 Ownerfluss: Remote oder direkt nach Tag-Scan

Der Owner kann dieselbe offene Anfrage auf zwei Wegen bearbeiten:

1. **Remote:** Nach Anmeldung im myQR24-Owner-Dashboard, beispielsweise unter `/owner/requests`. Für Remote-Entscheidungen ist ein Owner-Konto mit Passkey oder gleichwertiger starker Authentisierung erforderlich.
2. **Direkt am Tag:** Der Owner scannt das Tag, entsperrt die Verwaltungsansicht mit der Tag-PIN und sieht dort die offenen Anfragen desselben Tags.

Beide Oberflächen arbeiten auf denselben Anfragedaten und bieten dieselben Aktionen:

```text
Offene Anfrage
Tag: Werkzeugkoffer 12
Code: KIEFER-42-BLAU
Erstellt: 30.09.2026, 20:25 Uhr
Anfragegültigkeit: Bis manuell entfernt

[Shared freigeben] [Private Inhalte freigeben]
[Ablehnen] [Ohne Freigabe löschen]
```

Bei einer besonders sensiblen `private`-Freigabe kann das Produkt zusätzlich zur Remote-Kontoauthentisierung eine erneute Tag-PIN-Abfrage verlangen.

### 11.4 Owner-konfigurierbare Anfragegültigkeit

Der Owner bestimmt in den Vault-Einstellungen, wie lange neue Anfragen offen bleiben dürfen:

```text
Anfragen gelten:
(o) Bis Owner sie löscht oder bearbeitet
( ) 24 Stunden
( ) 7 Tage
( ) Benutzerdefinierte Dauer
```

Eine offene Anfrage endet ausschließlich durch:

- Genehmigung;
- Ablehnung;
- Löschen ohne Freigabe durch den Owner;
- Rücknahme durch den Partner;
- konfigurierten Ablauf;
- automatische Bereinigung nach einer konfigurierten maximalen Aufbewahrungsdauer.

Auch bei „bis manuell entfernt“ ist eine automatische Bereinigung, etwa nach 30, 90 oder 180 Tagen, erforderlich. Sie schützt Datenschutz, Datenqualität und die Übersicht im Owner-Dashboard.

Ist der Vergleichscode abgelaufen, bleibt die Anfrage gemäß ihrer Anfragegültigkeit bestehen. Der Partner kann für dieselbe Browser-gebundene Anfrage einen neuen Vergleichscode anfordern. Der Owner darf eine Anfrage ohne aktuellen Vergleichscode genehmigen, wenn sie im Dashboard eindeutig zuordenbar ist; für besonders sensible Inhalte soll die Oberfläche jedoch einen frischen Code verlangen.

### 11.5 Freigabeoptionen

Bei Genehmigung wählt der Owner Umfang und Laufzeit:

```text
Inhalte:
(o) Shared
( ) Private Inhalte einschließen

Zugriff gilt:
( ) Einmalige Ansicht oder ein einzelner Download
( ) 5 Minuten
( ) 10 Minuten
( ) 1 Stunde
( ) 24 Stunden
( ) 7 Tage
(o) Dauerhaft, bis ich den Zugriff widerrufe
```

| Freigabeart | Wirkung |
| --- | --- |
| Einmalig | Die atomar gezählte Aktion, beispielsweise eine Ansicht oder ein Download, darf genau einmal erfolgen. |
| Zeitlich begrenzt | Der Empfängerbrowser darf Inhalte bis `expiresAt` abrufen. |
| Dauerhaft bis Widerruf | Der konkrete Empfängerbrowser bleibt berechtigt, bis der Owner die Freigabe widerruft oder der Empfänger die Browserdaten löscht. |

Eine dauerhafte Freigabe ist **keine globale Öffnung des Tags**. Sie ist an die konkrete Empfänger-Sitzung gebunden und gewährt anderen Scannern keinen Zugriff.

In einer späteren Ausbaustufe kann der Owner eine Freigabe an ein Empfänger-Konto oder einen Passkey statt an einen Browser binden. Das ermöglicht geräteübergreifenden Dauerzugriff, benötigt aber eine explizite Empfängeridentität und ein Widerrufsmodell pro Konto und Gerät.

### 11.6 Löschen, Ablehnen, Widerrufen und erneute Anfrage

| Aktion | Ergebnis für den Partner |
| --- | --- |
| Ablehnen | `Anfrage wurde nicht freigegeben.` |
| Ohne Freigabe löschen | `Keine Freigabe vorhanden.`; es wird kein Ablehnungsgrund offengelegt |
| Genehmigen | Zugriff entsprechend Scope, Laufzeit und Nutzungsgrenze |
| Freigabe widerrufen | Neue Abrufe zeigen sofort wieder ausschließlich öffentliche Inhalte |
| Partner zieht Anfrage zurück | Anfrage wird geschlossen; eine neue Anfrage ist innerhalb der Limits möglich |

Der Partner darf nach Ablehnung oder Löschung erneut anfragen, sofern die Rate Limits dies erlauben. Wiederholte Anfragen dürfen keine Umgehung eines Owner-Widerrufs oder einer Sperre ermöglichen.

### 11.7 Zustandsmodell

```text
open ──genehmigen──> approved ──widerrufen──> revoked
  │                      │
  ├──ablehnen────────> rejected
  ├──ohne Freigabe löschen──> deleted
  ├──Partner zieht zurück──> withdrawn
  └──konfigurierter Ablauf──> expired
```

Eine `approved`-Anfrage verweist auf eine getrennte Empfängerfreigabe. Die Freigabe kann selbst ablaufen, nach einer Einmalnutzung verbraucht sein oder dauerhaft bis zum Widerruf bestehen.

### 11.8 Datenmodell für Anfragen und Empfängerfreigaben

```sql
CREATE TABLE tag_access_requests (
  id TEXT PRIMARY KEY,
  tag_id TEXT NOT NULL REFERENCES tag_vaults(tag_id),
  browser_token_hash TEXT NOT NULL,
  comparison_code_hash TEXT NOT NULL,
  comparison_code_expires_at TIMESTAMP NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('open', 'approved', 'rejected', 'deleted', 'withdrawn', 'expired')
  ),
  request_expires_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL,
  resolved_at TIMESTAMP NULL,
  resolved_by_owner_id TEXT NULL
);

CREATE TABLE tag_recipient_grants (
  id TEXT PRIMARY KEY,
  tag_id TEXT NOT NULL REFERENCES tag_vaults(tag_id),
  request_id TEXT NOT NULL REFERENCES tag_access_requests(id),
  recipient_token_hash TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL CHECK (scope IN ('shared', 'private')),
  max_uses INTEGER NULL,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMP NULL,
  revoked_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL
);
```

Regeln:

- Browser- und Empfängertoken werden kryptographisch zufällig erzeugt; die Datenbank speichert nur deren Hash.
- `comparison_code_hash` wird gespeichert, nicht der lesbare Vergleichscode.
- Eine `NULL`-Ablaufzeit in `tag_recipient_grants.expires_at` bedeutet „dauerhaft bis Widerruf“.
- Einmalfreigaben nutzen `max_uses = 1`; die Prüfung und Erhöhung von `used_count` muss in einer atomaren Datenbankoperation erfolgen.
- Eine abgelaufene, abgelehnte, gelöschte oder zurückgezogene Anfrage kann nie nachträglich genehmigt werden.
- Der Partner kann nur Anfragen und Freigaben sehen, deren Browser- oder Empfängertoken sein Browser besitzt.

### 11.9 API-Vorschlag für Anfragen

```http
POST /api/v1/tags/{tagId}/access-requests
POST /api/v1/tags/{tagId}/access-requests/current/comparison-code
GET  /api/v1/tags/{tagId}/access-requests/current
DELETE /api/v1/tags/{tagId}/access-requests/current

GET  /api/v1/owner/access-requests
POST /api/v1/owner/access-requests/{requestId}/approve
POST /api/v1/owner/access-requests/{requestId}/reject
DELETE /api/v1/owner/access-requests/{requestId}

DELETE /api/v1/owner/recipient-grants/{grantId}
```

Beispiel einer Owner-Genehmigung:

```http
POST /api/v1/owner/access-requests/req_123/approve
Content-Type: application/json

{
  "scope": "private",
  "duration": "permanent",
  "maxUses": null
}
```

Der Genehmigungsendpunkt prüft Owner-Session, Besitzzuordnung, Anfragestatus und die zulässigen Scope-/Laufzeitwerte vollständig serverseitig. Er darf keine Freigabe erzeugen, wenn die Anfrage nicht mehr `open` ist.

### 11.10 Limits und Missbrauchsschutz

Anfragen dürfen pro Tag konfigurierbare Limits besitzen. Sinnvolle Standardwerte sind:

| Limit | Vorschlag |
| --- | --- |
| Neue Anfragen pro Browser und Tag | maximal 3 innerhalb von 24 Stunden |
| Neue Anfragen pro Tag | maximal 10 innerhalb von 24 Stunden |
| Gleichzeitig offene Anfragen pro Browser und Tag | maximal 1 |
| Vergleichscode erneuern | maximal 3-mal innerhalb von 15 Minuten |
| Sperrzeit nach Überschreitung | 24 Stunden |
| Anfragen komplett deaktivieren | jederzeit durch Owner möglich |

Zusätzlich werden Browser-Token, IP-basierte Limits und optional Turnstile/Bot-Schutz kombiniert. IP-Adressen sind nur ein ergänzendes Missbrauchssignal und niemals die Berechtigungsidentität. Jede Erstellung, Erneuerung des Vergleichscodes, Entscheidung, Nutzung und jeder Widerruf wird auditierbar protokolliert.

## 12. Sicherheitsanforderungen

### 12.1 PIN- und Gastzugangssicherheit

- PINs mit **Argon2id** hashieren; bei fehlender Unterstützung mindestens bcrypt mit geeignetem Cost-Factor verwenden.
- Keine schnelle SHA-256- oder HMAC-Hashung für PINs verwenden.
- Pro Tag und zusätzlich pro IP / Gerätefingerprint Rate Limits einführen.
- Beispiel: nach 5 Fehlversuchen für mindestens 15 Minuten sperren.
- Fehlerantworten bewusst generisch formulieren:  
  `PIN ungültig oder Zugang momentan gesperrt`.
- Produktionszugangscodes haben maximal 20 Zeichen; numerische und alphanumerische Formate werden serverseitig strikt getrennt validiert.
- Kurze, leicht merkbare Werte sind ausschließlich für explizit nicht produktive Staging-Seeds zulässig und gehören nie in öffentliche Fixtures, Client-Bundles oder API-Responses.
- PIN-Änderung nur in einer bereits authentisierten Owner-Session oder mit zusätzlicher Konto-Verifikation erlauben.
- Ohne Wiederherstellungsmodell kann eine verlorene PIN den Zugriff dauerhaft blockieren. Deshalb ist ein Besitzerkonto oder ein sicher verwahrter Recovery-Code für Produktion empfehlenswert.

### 12.2 Datei- und Inhaltsicherheit

- MIME-Type anhand des tatsächlichen Dateiinhalts validieren, nicht nur anhand von Dateiendung oder Browser-Header.
- Dateigröße serverseitig kontrollieren.
- Objekt-Keys zufällig erzeugen; keine originalen Dateinamen als alleinigen Speicherpfad verwenden.
- Uploads zunächst als `uploading` speichern, erst nach Validierung als `active`.
- Optional Malware-/Antivirus-Scan und Quarantäneprozess einplanen.
- Dateien mit `Content-Disposition: attachment` ausliefern, insbesondere PDFs und unbekannte Dokumente.
- Strenge Content-Security-Policy für PWA und Dateivorschau einsetzen.
- Originaldateiname beim Anzeigen HTML-escapen.
- Keine Asset-Liste oder Dateigröße nicht sichtbarer Inhalte preisgeben.
- Signierte Asset-Download-URLs müssen kürzer oder gleich lang wie die Restlaufzeit einer Freigabe sein.

### 12.3 Freigabesicherheit

- Freigabestatus wird ausschließlich serverseitig ausgewertet.
- Beim Ablauf ist die Freigabe sofort unwirksam.
- Widerruf beendet zukünftige API-Antworten und neue Signaturen unverzüglich.
- Öffentliche View-Antworten dürfen maximal sehr kurz gecacht werden oder erhalten `Cache-Control: no-store`, damit abgelaufene Freigaben nicht durch Caches sichtbar bleiben.
- Private Inhalte dürfen nicht in CDN-Cache, Service-Worker-Cache oder Browser-Persistenz landen.
- Wenn Freigaben nur für eine konkrete Person gelten sollen, reicht ein globaler Zeit-Schalter nicht aus. Dann wird die empfängergebundene Anfrage und Empfängerfreigabe aus Abschnitt 11 verwendet; ein Empfänger-Login oder Passkey ist erst für geräteübergreifenden Dauerzugriff erforderlich.

### 12.4 Datenschutz und rechtliche Anforderungen

Rechnungen, Bilder und Notizen können personenbezogene oder besonders schützenswerte Daten enthalten. Vor Produktivsetzung sind insbesondere festzulegen:

- Datenschutzinformation und Rechtsgrundlage;
- Aufbewahrungs- und Löschkonzept;
- Exportfunktion und Löschrecht;
- Zugriff auf Audit-Logs;
- Verantwortlichkeit bei verlorenem Tag;
- Region und Auftragsverarbeitung für Object Storage und Datenbank;
- Umgang mit Minderjährigen und sensiblen Bildinhalten.

## 13. Caching

Die Sichtbarkeit kann sich im Minutentakt ändern. Daher gelten:

| Antwort | Cache-Vorgabe |
| --- | --- |
| Öffentliche Vault-Ansicht ohne aktive Freigabe | kurze TTL möglich, z. B. 30–60 Sekunden; bevorzugt `private` oder gezielte Cache-Invalidierung |
| View bei aktiver `shared`-/`private`-Freigabe | `Cache-Control: no-store` |
| Owner-Dashboard | `Cache-Control: no-store` |
| Signierte Asset-URLs | nicht öffentlich cachebar; Ablauf an Freigabe koppeln |
| Öffentliche, unveränderliche Vorschaubilder | nur bei ausdrücklich `public`er Sichtbarkeit und versioniertem Object Key cachebar |

## 14. Abgrenzung: temporäre Freigabe und echte Einmalansicht

Eine zeitlich begrenzte Freigabe wie „10 Minuten private Inhalte anzeigen“ bedeutet:

- jeder Scanner mit der Tag-URL kann die erlaubten Inhalte innerhalb dieser Zeit sehen;
- die Berechtigung gilt nicht nur für den Besitzer-Browser;
- ein bereits sichtbarer Scanner kann Screenshots, Downloads oder gespeicherte Dateien behalten.

Wenn Inhalte **genau einmal** oder **nur für eine bestimmte Person** sichtbar sein sollen, wird das in Abschnitt 11 definierte empfängergebundene Anfragemodell verwendet:

1. Partner scannt das Tag und erzeugt eine Browser-gebundene Zugriffsanfrage.
2. Owner genehmigt genau diese Anfrage lokal nach PIN-Entsperrung oder remote nach starker Kontoauthentisierung.
3. Das Backend erstellt eine getrennte Empfängerfreigabe mit `max_uses = 1` für eine Einmalansicht bzw. einen einzelnen Download oder mit einer gewählten Laufzeit.
4. Die Datenbank prüft und erhöht `used_count` in derselben atomaren Operation; weitere Nutzungen werden abgelehnt.
5. Bei dauerhafter Freigabe bleibt die Berechtigung ausschließlich für diesen Empfängerbrowser bis zum Owner-Widerruf bestehen.

Cloudflare KV ist für atomaren Einmalverbrauch nicht geeignet. Dafür kommen eine Transaktion in einer Datenbank, Redis `SET NX EX` oder ein Durable Object in Betracht.

## 15. Empfohlene Umsetzungsphasen

### Phase 1 – Öffentliche Inhalte und Owner-PIN

- `vault`-Feature im Routing ergänzen;
- Vault-PWA und API bereitstellen;
- `public`-Notizen und öffentliche Bilder;
- PIN-Hash, Rate Limiting, Owner-Session;
- private R2-Ablage;
- Upload von JPG, PNG, WebP, MP3/M4A und PDF;
- öffentliche Präsentationsprofile, sichere Content-Blöcke, Hauptbild und Galerie;
- ein einzelner kontextabhängiger Footer-Button statt Verwaltungsaktionen zwischen öffentlichen Inhalten;
- Audit für Verwaltungsvorgänge.

### Phase 2 – Sichtbarkeiten und temporäre Freigaben

- `shared`, `private`, `ownerOnly`;
- Freigabedauer 5 / 10 / 15 / 30 Minuten;
- serverseitige Freigabeprüfung;
- kurzlebige Asset-Download-URLs;
- unmittelbarer Widerruf;
- umfassende Tests für Ablauf, Sichtbarkeit und Caching.

### Phase 3 – Empfängergebundene und Remote-Freigaben

- browsergebundene Zugriffsanfragen mit Vergleichscode;
- Owner-Dashboard für ortsunabhängige Genehmigung;
- konfigurierbare Anfragegültigkeit, Bereinigungsfristen und Rate Limits;
- Einmalansichten bzw. einzelne atomar gezählte Downloads;
- dauerhafte, widerrufbare Empfängerfreigaben;
- Benutzerkonten, Passkeys und Wiederherstellungsprozess.

### Phase 4 – Produktreife

- Empfänger-Konten bzw. Passkeys für geräteübergreifende Berechtigungen;
- Malware-Scan und Quarantäne;
- Rechnungsmetadaten und Export;
- feinere Freigaben pro Inhalt;
- einmalige Einladungslinks;
- Multi-Owner-/Organisationenmodell;
- Datenschutz-, Lösch- und Retention-Automatisierung.

## 16. Akzeptanzkriterien für die erste funktionsfähige Version

1. Ein Besitzer kann nach PIN-Prüfung ein Bild, ein PDF und eine Notiz für ein Tag anlegen.
2. Jeder Inhalt kann als `public`, `shared` oder `private` markiert werden.
3. Ein normaler Scan zeigt ausschließlich `public`-Inhalte.
4. Der Besitzer kann `shared`-Inhalte für 5 oder 10 Minuten freigeben.
5. Während einer `shared`-Freigabe zeigt ein Scan zusätzlich `shared`-Inhalte.
6. `private`-Inhalte sind nur nach expliziter `private`-Freigabe sichtbar.
7. Nach Ablauf oder Widerruf verschwinden zusätzliche Inhalte bei neuen Abrufen sofort.
8. PIN, PIN-Hash, Owner-Session-Token, interne R2-Keys und nicht sichtbare Metadaten erscheinen nie in einer öffentlichen Antwort.
9. Ein Datei-Download wird bei jedem Abruf serverseitig gegen Sichtbarkeit und Freigabestatus geprüft.
10. Fehlversuche, Uploads, Änderungen und Freigaben werden auditierbar protokolliert.
11. Öffentliche Routing-Daten in `TAG_CONFIG` enthalten keine privaten Inhalte, PIN-Hashes oder Freigabezustände.
12. Ein Partner kann eine Browser-gebundene Zugriffsanfrage erzeugen und erhält einen erneuerbaren Vergleichscode.
13. Der Owner kann dieselbe offene Anfrage remote im Owner-Dashboard oder lokal nach Tag-Scan und PIN prüfen, genehmigen, ablehnen oder ohne Freigabe löschen.
14. Der Owner kann die Anfragegültigkeit, Scope sowie Einmal-, Zeit- oder Dauerfreigabe konfigurieren und jede Empfängerfreigabe später widerrufen.
15. Eine Empfängerfreigabe gibt niemals anderen Scannern Zugriff; sie gilt ausschließlich für den genehmigten Browser bzw. später ein explizit autorisiertes Empfänger-Konto.
16. Limits verhindern wiederholte Anfragen und Vergleichscode-Erneuerungen über die konfigurierte Rate hinaus.
17. Ein Owner kann eine Galerie mit explizitem Hauptbild, Reihenfolge und sichtbarkeitsgeprüften Bildvarianten erstellen.
18. Ein Owner kann eine Audioaufnahme mit sichtbarem Player und optionalem Transkript anlegen; Ton startet nicht ungefragt automatisch.
19. Reine Public-Tags können Galerie-, Informations- oder Museumsprofile verwenden und die Footer-Aktion ausblenden.
20. Die Scan-Ansicht zeigt Verwaltungs-, PIN- und Freigabeaktionen nur gebündelt über höchstens eine kontextabhängige Footer-Aktion.

## 17. Offene Produktentscheidungen

Vor Implementierung sind diese Entscheidungen zu bestätigen:

1. Soll ein Tag zwingend zu einem myQR24-Benutzerkonto gehören oder zunächst ausschließlich über PIN verwaltet werden?
2. Welche maximalen Dateigrößen, Gesamtquoti und zulässigen MIME-Types gelten?
3. Soll eine Freigabe für **alle Scanner** gelten oder sollen zusätzlich personengebundene Einladungen möglich sein?
4. Ist ein `private`-Freigabemodus produktseitig erwünscht oder sollen private Inhalte immer nur für den Besitzer sichtbar sein?
5. Welche Aufbewahrungszeit und Löschregeln gelten für Rechnungen und gelöschte Inhalte?
6. Soll eine Rechnung nur eine Datei sein oder strukturierte Felder wie Betrag, Lieferant, Währung und Steuer enthalten?
7. Wird Malware-Scanning vor dem ersten produktiven Datei-Upload verpflichtend?
8. Welche Wiederherstellung existiert bei verlorener PIN oder verlorenem Besitzgerät?
9. Welche Anfragegültigkeit, Bereinigungsfrist und Anfrage-/Code-Limits sollen pro Tag standardmäßig gelten?
10. Soll für eine Remote-Freigabe von `private` immer zusätzlich zur Owner-Kontoauthentisierung die Tag-PIN abgefragt werden?
11. Soll eine dauerhafte Freigabe zunächst nur Browser-gebunden sein oder bereits in der ersten Version Empfänger-Konten bzw. Passkeys unterstützen?
