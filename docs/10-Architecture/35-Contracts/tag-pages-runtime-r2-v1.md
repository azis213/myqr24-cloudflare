# TAG Pages, Runtime und R2 v1

**Version:** `v1`  
**Status:** `superseded-local`  
**Owner:** TAG-App / Pages Functions  
**Geltungsbereich:** lokale Implementierung und Fakes für öffentliche HTML- und Medienauflösung; keine Deployment- oder Bucket-Freigabe

> **Ersetzt durch:** [`tag-edge-d1-routing-v1`](tag-edge-d1-routing-v1.md) und [`tag-app-access-v1`](tag-app-access-v1.md). Der lokale SSR-/öffentliche-R2-Medienweg wurde vor einer Bereitstellung zurückgenommen. React Pages bleibt die TAG-Oberfläche; private Content-JSONs und Medienzugriff laufen ausschließlich über die Access-API.

## 1. Historische Topologie und Verantwortung

```text
Scan → Edge Router → 302 Pages /tag/{tagId}
                         ├─ liest veröffentlichtes Runtime-JSON aus privatem R2-Binding
                         └─ rendert öffentliches HTML ohne Storage-Keys

Browser → GET /media/v1/tags/{tagId}/assets/{assetId}/{variant}
        → Pages Media Function → öffentliches R2-Medien-Binding

Pages Function → interne Runtime-API ausschließlich über Service Binding
```

Der Edge Routing Worker erzeugt kein TAG-HTML. Initiale Aufrufe benötigen ausschließlich die kanonische 6-/8-/10-stellige `tagId`. Pages und Browser akzeptieren weder `decodedValue`, Range-/Pooldaten noch freie R2-Pfade.

Öffentliche und private R2-Bereiche bleiben getrennte Buckets/Bindings. Die öffentliche Pages-Funktion besitzt kein privates Medien-Binding. Eine private Runtime-API ist nicht öffentlich geroutet und wird nur über `TAG_RUNTIME_API` als Service Binding angesprochen. Externe signierte Aufrufe bleiben deaktiviert; ihre spätere Prüfung verwendet das vorhandene `exp`/`sig`-HMAC-Verfahren mit neuem zweckgebundenem Payload.

## 2. Veröffentlichtes Runtime-Dokument

Der Objektkey wird serverseitig als `public-runtime/v1/tags/{tagId}/current.json` abgeleitet. Das JSON ist nur über das serverseitige Binding lesbar:

```json
{
  "schema": "tag-pages-runtime-r2-v1",
  "tagId": "ab12cd",
  "revision": 41,
  "mode": "public",
  "title": "Öffentlicher Titel",
  "description": "Optionale Beschreibung",
  "blocks": [
    { "type": "text", "paragraphs": ["Öffentlicher Text"] }
  ],
  "assets": {
    "ast_demo": {
      "variants": {
        "cover-1280.webp": {
          "key": "public-media/v1/assets/ast_demo/revision/cover-1280.webp",
          "contentType": "image/webp"
        }
      }
    }
  }
}
```

`revision` ist eine positive ganze Zahl. Zulässige Blöcke sind `hero`, `text`, `callout`, `gallery` und `external-link`; HTML/JavaScript/iFrames werden nicht interpretiert. Bilder referenzieren `assetId` und `variant`, nicht ihren Storage-Key. Unbekannte Felder werden nicht an HTML oder Browser-JSON weitergereicht. Dokumente mit anderem Schema, falscher TAG-ID, `mode !== public`, ungültigen Assets oder privaten Feldern liefern neutral `404`.

## 3. Öffentliche HTML-Route

`GET` und `HEAD /tag/{tagId}` validieren die ID, lesen genau den abgeleiteten Runtime-Key und rendern ausschließlich escaped Text sowie logische Medien-/Link-URLs. Fehlende, ungültige oder nicht öffentliche Dokumente liefern `404` mit `Cache-Control: no-store`. Erfolgreiche HTML-Antworten verwenden `Cache-Control: public, max-age=0, must-revalidate`, eine restriktive CSP und keine R2-Keys.

Die Pages-Funktion schleift keine Bildbytes durch das HTML-Rendering. Der Browser lädt freigegebene Bilder direkt über die logische Medienroute.

## 4. Öffentliche Medienroute

```text
GET|HEAD /media/v1/tags/{tagId}/assets/{assetId}/{variant}
```

`assetId` und `variant` besitzen enge Identifierformate; nur `.webp` und `.avif` sind zulässig. Die Function prüft das aktuelle öffentliche Runtime-Dokument und die konkret freigegebene Assetvariante. Erst danach wird der darin serverseitig hinterlegte immutable R2-Key aus dem öffentlichen Medien-Binding gelesen. Browserparameter werden niemals als Objektkey verwendet.

Erfolgreiche revisionierte Varianten liefern den deklarierten Bild-Content-Type, `X-Content-Type-Options: nosniff` und `Cache-Control: public, max-age=31536000, immutable`. Eine ersetzte Assetversion erhält eine neue Asset-ID/URL. Bereits immutable gecachte Bytes können nicht revidiert werden; Widerruf verhindert neue Abrufe, nicht die Rückholung bereits verteilter Kopien. Fehler sind neutral `404` und `no-store`.

## 5. Geschützte Medien – nur vorbereiteter Contract

Spätere geschützte Bilder verwenden keine öffentliche R2-Bindung und keine öffentliche Runtime-Projektion:

```text
Browser → Media Worker → interne Runtime-/Grant-Prüfung
       → 302 auf kurzlebige objektbezogene R2-Signatur-URL → direkter R2-Download
```

Der Signaturpayload bindet Zweck, TAG, Asset, Variante, Objektkey und Ablauf. `exp`/`sig` werden erst nach eigener Sicherheits-/Cache-Spezifikation aktiviert. In v1 liefern geschützte Dokumente und Assets neutral `404`; es werden keine signierten Medienlinks erzeugt.

## 6. Lokale Nachweise und Freigabegrenze

Vitest-Fakes decken HTML-Escaping, Schema-/Leak-Prüfung, 6/8/10-IDs, fehlende/private Dokumente, WebP/AVIF, HEAD, ungültige Pfade, Variantenzuordnung, getrennte Bindings und Cache-Header ab. Service-Binding-Fakes beweisen, dass die interne Runtime-API ohne öffentlichen Browserpfad funktioniert.

Reale Buckets, Service-Bindings, Deployment, externe Signaturen, Uploads und private Freigaben bleiben bis zu einem separaten Betriebsgate gesperrt.
