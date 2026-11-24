# Vertrag: TAG Content Publisher v1

**Version:** `v1`
**Status:** `implemented-local` (Worker-Deployment/Secrets sind separate Betriebsgates)
**Owner:** TAG Application API Worker (`workers/tag-content/{publish,read}.ts`)
**Consumer:** vertrauenswürdiger serverseitiger Publisher beziehungsweise Designer-Export; nicht der TAG-PWA-Browser
**Eingabeschema:** `myqr24-tag-content-template-v1`, `schemaVersion: 3`
**Runtime-Schema:** `myqr24-tag-content-v2`
**Verwandte Contracts:** [TAG Runtime API](tag-app-runtime-api-v1.md), [TAG-App Access](tag-app-access-v1.md)

## 1. Zweck und Umfang

Die Publisher-API veröffentlicht ein validiertes vollständiges Content-Template für einen existierenden aktiven internen TAG. Der Worker projiziert das Template in die TAG-App-Runtime, schreibt ein versioniertes JSON-Dokument nach privatem R2 und aktualisiert Content-Pointer, Elementstruktur und Routing-Revision in D1.

Diese API verwaltet den **aktuellen veröffentlichten TAG-Stand**, nicht die Vorlagenbibliothek im Designer. Sie bietet keine Routen für Template-Katalog, frühere Revisionen, Rollback, Content-Löschung, Routenverwaltung, Bild-Upload oder Item-CRUD. Der Publisher-GET liefert die aktuelle Runtime-Projektion, nicht die ursprüngliche Designer-Datei; der GET-Body kann daher nicht unverändert an den PUT zurückgesendet werden.

## 2. Endpunkte und Authentisierung

| Methode | Pfad | Zweck |
| --- | --- | --- |
| `PUT` | `/api/v1/tags/{tagId}/content` | vollständiges Template validieren und veröffentlichen/ersetzen |
| `GET` | `/api/v1/tags/{tagId}/content/document` | veröffentlichtes Runtime-Dokument für Publisher lesen |

Beide Routen verlangen:

```http
Authorization: Bearer <APP_CONTENT_PUBLISH_KEY_S01>
```

Fehlt `APP_CONTENT_PUBLISH_KEY_S01`, antwortet der Worker fail-closed mit `503 publisher_disabled`. Ein fehlender oder ungültiger Bearer liefert `401 unauthorized`. Das Secret ist ausschließlich als Worker Secret zu konfigurieren. Es darf nicht in Designer-Browser, PWA, Pages, Vite-Variablen oder URLs gelangen. Diese Publisher-Routen verwenden nicht das TAG-Access-Cookie.

## 3. Template veröffentlichen

### 3.1 Request

```http
PUT /api/v1/tags/ab12cd/content
Authorization: Bearer <Publisher-Secret>
Content-Type: application/json
```

```json
{
  "tagId": "ab12cd",
  "tagNumericId": "623187229",
  "tagName": "Mein TAG",
  "expectedRevision": 4,
  "template": {
    "schema": "myqr24-tag-content-template-v1",
    "schemaVersion": 3,
    "template": {
      "templateId": "tct_vault_standard",
      "templateVersion": 1,
      "tagType": "vault",
      "name": "Vault – Standard",
      "description": "Optionale Beschreibung",
      "locale": "de-DE",
      "status": "draft"
    },
    "shell": {
      "presentation": "standard",
      "features": ["vault"],
      "theme": {
        "colorMode": "light",
        "colors": {
          "background": "#f7f5f0",
          "surface": "#ffffff",
          "text": "#1c1c1c",
          "mutedText": "#5a5a5a",
          "heading": "#14231c",
          "accent": "#1f513d",
          "accentText": "#ffffff",
          "border": "#e2ded6"
        }
      }
    },
    "layout": {
      "mode": "grid-flow",
      "columns": 12,
      "gap": "md",
      "responsive": { "autoReflow": true, "preferredColumns": { "mobile": 1, "desktop": 3 } }
    },
    "elements": [
      {
        "elementId": "cel_intro",
        "elementType": "text",
        "displayOrder": 10,
        "visibility": "public",
        "payload": { "headingLevel": "h2" },
        "content": { "paragraphs": [{ "heading": 2, "runs": [{ "text": "Willkommen" }] }] }
      }
    ]
  }
}
```

Pflichtfelder des äußeren Objekts sind `tagId`, `tagNumericId` und `template`. Die Pfad- und Body-`tagId` müssen übereinstimmen; `tagNumericId` ist ein kanonischer positiver Dezimalstring. `tagName` überschreibt optional den projizierten Anzeigenamen; ohne Angabe gilt `template.name`.

`expectedRevision` ist eine optionale positive Ganzzahl als Compare-and-swap gegen die aktuelle Contentrevision. Beim erstmaligen Publish darf das Feld nicht gesetzt werden. Bei konkurrierender Änderung wird der Publish mit `409 revision_conflict` abgelehnt.

### 3.2 Template-Validierung

Das `template`-Objekt muss dem Schema `myqr24-tag-content-template-v1` in Version 3 entsprechen. Der Worker validiert unter anderem:

- `templateId`, positive `templateVersion`, erlaubten `tagType`, Name mit 1–120 Zeichen, optionale Beschreibung bis 500 Zeichen, ausschließlich `de-DE` und Status `draft`, `pending-review`, `published` oder `retired`;
- Präsentation, zum TAG-Typ passende Features und ein Theme mit light/dark-Modus sowie erforderlichen Hex-Farben;
- `layout.mode = grid-flow`, 1–12 Spalten, Gap `sm|md|lg` und responsive Breakpoints `mobile|tablet|desktop`;
- 1–24 Elemente, eindeutige `elementId`/`displayOrder`, erlaubte Elementtypen je TAG-Typ und Sichtbarkeit `public|shared|private|ownerOnly`;
- Payload, RichText, Slots, Aktionen, responsive Placement und Stilfelder anhand des Worker-Schemas;
- sichere Links ausschließlich mit `https://` oder `mailto:`. HTML-Markup, Event-Handler, `javascript:`, `data:`, CSS-`url()` sowie Schlüssel wie `objectKey`, Bucket- oder Presigned-URL-Felder werden abgewiesen.

TAG-Typen: `vault`, `lost-found`, `event`, `exhibit`, `maintenance`. Es gelten maximal 16 Slots pro Element, maximal 64 Items je Slotdeklaration, höchstens 16 RichText-Blöcke je Contentfeld, 2 Tabellen je Contentfeld, 6 Spalten, 20 Zeilen und 200 Zeichen je Tabellenzelle. Der Template-Body ist auf 128 KiB begrenzt; die Request-Hülle auf 132 KiB.

Slots und `actions.upload`/`download`/`delete` sind Konfigurations-/Policy-Metadaten. Sie erzeugen weder Dateien noch D1-Items und implementieren keine Upload-/Download-/Delete-API. `template.status` ist Template-Metadatum, kein separater Approval-Mechanismus: Ein gültiger Publish-Request wird nicht aufgrund von `draft` oder `pending-review` blockiert.

Medien-Items werden unabhängig vom Template über den Runtime-Content-Item-Vertrag verwaltet. Eine `contentId` steht für genau ein Originalbild oder -dokument; jedes weitere Galerie-Bild beziehungsweise Listendokument erhält eine eigene `contentId`. Optionale `small`-/`medium`-Derivate sind Varianten dieses Originals und werden nicht durch den Publish erzeugt oder als eigene Items projiziert.

### 3.3 Publish-Ablauf und Erfolg

Nach Authentisierung, vollständiger Validierung und Prüfung des aktiven internen Routings projiziert der Worker `view` (Blocks, Theme, Layout) plus vollständige inline-`elements[]`-Payloads. Pro Revision entsteht genau ein R2-Dokument unter einem serverseitig abgeleiteten Key der Form:

```text
content/v1/tags/{tagNumericId}/tag-rev{revision}.json
```

Elementstruktur (`elementId`, Typ, Reihenfolge, Sichtbarkeit) liegt in `tag_content_elements`; Payloads liegen ausschließlich inline im einen JSON-Dokument. R2-Key und Storage-Metadaten werden nie in der API-Antwort offengelegt.

Erstveröffentlichung liefert `201 Created`; geänderte Veröffentlichung `200 OK`:

```json
{
  "status": "created",
  "tagId": "ab12cd",
  "tagNumericId": "623187229",
  "revision": 1,
  "contentSha256": "<64 lowercase hex chars>",
  "contentBytes": 6144,
  "elementCount": 1,
  "elementIds": ["cel_intro"],
  "unchanged": false
}
```

Semantisch identischer Inhalt ist idempotent: `200`, `status: "unchanged"`, gleiche Revision und `unchanged: true`; es erfolgen weder R2-Put noch D1-Batch. Geänderte Inhalte erhöhen die Laufzeitrevision um eins.

`revision` im Runtime-Dokument, `tag_content.content_revision` und `tag_routing.content_revision` werden gemeinsam fortgeschrieben. Elemente können hinzugefügt, aktualisiert und umbenannt werden. Elemente mit bestehenden Item-Zuordnungen dürfen nicht entfernt werden (`409 elements_in_use`); nicht belegte Elemente dürfen entfernt werden.

## 4. Veröffentlichten Stand lesen und ändern

### 4.1 Publisher-GET

```http
GET /api/v1/tags/ab12cd/content/document
Authorization: Bearer <Publisher-Secret>
If-None-Match: "<contentSha256>"
```

`200 application/json; charset=utf-8` liefert den gespeicherten Runtime-Dokument-Body byte-identisch, einschließlich `schema`, TAG-IDs, `revision`, `view` und `elements[]` mit Payloads. Header:

```http
ETag: "<contentSha256>"
X-Content-Revision: 5
X-Content-Bytes: 6144
Cache-Control: no-store
X-Content-Type-Options: nosniff
```

Bei exakt passendem `If-None-Match` wird `304` mit ETag und `no-store` zurückgegeben. Ohne veröffentlichten Stand oder ohne zugehöriges R2-Objekt lautet die Antwort `404 content_not_found`.

Der GET liefert **nicht** das ursprüngliche `myqr24-tag-content-template-v1`, sondern das daraus erzeugte Runtime-Dokument. Er ist zur Inspektion und zum Abgleich des aktuellen veröffentlichten Zustands gedacht, nicht als verlustfreier Designer-Template-Export.

### 4.2 Aktualisierung und Verwaltung

Es gibt keinen PATCH-/Merge-Endpunkt. Ein Update ist immer ein vollständiger PUT mit einem vollständigen Template. `expectedRevision` schützt vor Lost Updates. Die GET-Antwort kann nicht unverändert als PUT-Request dienen. Es gibt keine Publisher-API zum Auflisten von TAGs/Templates, Abrufen älterer Revisionen, Rollback, expliziten Delete oder Löschen alter R2-Objekte. R2-Cleanup ist ein separater Betriebsprozess.

Der öffentliche PWA-Leseweg ist `GET /api/v1/tags/{tagId}/content` aus dem [Runtime-Contract](tag-app-runtime-api-v1.md); diese Publisher-GET-Route ist immer Bearer-geschützt.

### 4.3 Publisher-Smoke-Aufrufe

Nach erfolgreichem Worker-Deployment und Konfiguration des Worker-Secrets kann ein Publisher beispielsweise so testen (PowerShell):

```powershell
$env:APP_CONTENT_PUBLISH_KEY_S01 = '<Publisher-Secret aus dem Secret Store>'
$baseUrl = 'https://<bereitgestellter-Application-API-Host>'
$tagId = 'ab12cd'

curl.exe -i -X PUT "$baseUrl/api/v1/tags/$tagId/content" `
  -H "Authorization: Bearer $env:APP_CONTENT_PUBLISH_KEY_S01" `
  -H 'Content-Type: application/json' `
  --data-binary '@payload.json'

curl.exe -i "$baseUrl/api/v1/tags/$tagId/content/document" `
  -H "Authorization: Bearer $env:APP_CONTENT_PUBLISH_KEY_S01"
```

`payload.json` ist das vollständige äußere Publish-Objekt aus §3.1. Der Beispielhost ist absichtlich ein Platzhalter: Ein Dry-Run stellt keinen erreichbaren API-Host bereit. Secrets nicht in Shell-History, Logs oder Dateien schreiben.

## 5. Fehlervertrag

Publisher-Fehler sind JSON mit `Cache-Control: no-store` und `X-Content-Type-Options: nosniff`. Beispiel:

```json
{
  "error": {
    "code": "template_invalid",
    "message": "Das Template entspricht nicht dem Schema.",
    "issues": [
      { "code": "ELEMENT_ID_DUPLICATE", "path": "elements[2].elementId", "message": "…" }
    ]
  }
}
```

Validierungsantworten enthalten höchstens 20 `issues`.

| Status | Fehlercode | Ursache |
| ---: | --- | --- |
| `400` | `invalid_request` | Ungültiges JSON/Objekt, TAG-ID oder `expectedRevision` |
| `401` | `unauthorized` | Bearer fehlt oder ist ungültig |
| `404` | `tag_not_found` | TAG fehlt, ist inaktiv oder nicht intern geroutet |
| `404` | `content_not_found` | Kein veröffentlichter Stand/R2-Dokument für Publisher-GET |
| `413` | `payload_too_large` | Request oder projiziertes Runtime-Dokument überschreitet das Limit |
| `415` | `unsupported_media_type` | Content-Type ist nicht `application/json` |
| `422` | `template_invalid` | Schema-/Policy-Validierung fehlgeschlagen; `error.issues[]` enthält Pfad und Code |
| `409` | `revision_conflict` | `expectedRevision` ist veraltet oder konkurrierender D1-Update-Konflikt |
| `409` | `tag_identity_mismatch` | Numerische und Base36-TAG-Identität stimmen nicht überein |
| `409` | `elements_in_use` | Ein Element mit Zuordnungen soll entfernt werden; ggf. `error.elements[]` |
| `500` | `internal` | R2-/D1-Schreib- oder Konsistenzfehler; interne Details werden nicht ausgegeben |
| `503` | `publisher_disabled` | Publisher-Secret ist in der Umgebung nicht konfiguriert |

Unbekannte Pfade und falsche Methoden gehen über den Worker-404-Handler und verwenden nicht zwingend die JSON-Fehlerhülle.

## 6. Konsistenz, Idempotenz und Betrieb

1. Der Worker authentisiert und validiert vor Storage-Schreibzugriffen.
2. Der TAG muss in `tag_routing` aktiv und `target_type=internal` sein; numerische und Base36-IDs müssen konsistent sein.
3. Unveränderter Inhalt bleibt auf derselben Revision und führt zu keinen Writes.
4. Bei Änderung wird ein revisionsspezifisches R2-JSON geschrieben, danach werden Contentpointer, Elemente und Routingrevision in einem D1-Batch aktualisiert.
5. Scheitert der D1-Batch nach dem R2-Put, kann ein verwaistes R2-Objekt verbleiben; der bisherige D1-Pointer bleibt maßgeblich und Cleanup ist separat erforderlich.
6. Bestehende Item-Zuordnungen schützen das jeweilige Element vor Löschung.

`expectedRevision` ist optionale Compare-and-swap-Kontrolle, kein Idempotency-Key. R2-Revisionen sind keine Audit- oder Rollback-Historie.

Das Staging-D1-Schema ist migriert, aber die Worker-Bereitstellung und Secret-Provisionierung sind separate Schritte. `npm run build:app-api` führt nur einen `wrangler deploy --dry-run` durch. Für Staging müssen `APP_CONTENT_PUBLISH_KEY_S01`, `APP_BOOTSTRAP_SECRET_S01`, `APP_PIN_PEPPER_S01` und `APP_MEDIA_SIGNER_KEY_S01` sicher als Worker-Secrets konfiguriert sein, bevor ein End-to-End-Test möglich ist.

**Tests:** `apps/tag-app/test/tag-content-publish.test.ts`, `apps/tag-app/test/tag-content-read.test.ts`, `apps/tag-app/test/tag-content-projection.test.ts`, `apps/tag-app/test/database-schema.test.mjs`.