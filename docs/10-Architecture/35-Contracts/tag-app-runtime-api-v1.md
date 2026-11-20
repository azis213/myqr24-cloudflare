# Vertrag: TAG Application Runtime API v1

**Version:** `v1`
**Status:** `implemented-local` (Worker-Deployment/Secrets sind separate Betriebsgates)
**Owner:** TAG Application API Worker (`apps/tag-app/workers/app-api.ts`)
**Consumer:** TAG-App React-PWA; Media-Signer ausschließlich über Service Binding
**Runtime-Schema:** `myqr24-tag-content-v2`
**Verwandte Contracts:** [Edge-Routing und Bootstrap](tag-edge-d1-routing-v1.md), [Content Publisher](tag-app-content-publish-v1.md)

## 1. Zweck und Endpunkte

Dieser Contract beschreibt Browserzugriffe zum Einlösen eines Scan-Bootstraps, Laden der autorisierten TAG-Ansicht und Anfordern einer URL für ein bereits registriertes und zugewiesenes Medium. Er stellt **keine** Upload- oder CRUD-API für Bilder bereit.

| Methode | Pfad | Zweck | Authentisierung |
| --- | --- | --- | --- |
| `POST` | `/api/v1/tags/{tagId}/access/public` | Public-Bootstrap einlösen und Access-Session setzen | kurzlebige Edge-HMAC-Signatur im Body |
| `POST` | `/api/verify-pin` | PIN-Bootstrap prüfen und Access-Session setzen | Bootstrap-Signatur und PIN im Body |
| `GET` | `/api/v1/tags/{tagId}/content` | aktuelle App-Ansicht sowie sichtbare Elemente und Items laden | `myqr24_tag_access` Cookie |
| `POST` | `/api/get-image-url` | URL für eine sichtbare, vorhandene Medienvariante anfordern | dasselbe Access-Cookie |

`tagId` ist eine kleingeschriebene Base36-ID mit genau 6, 8 oder 10 Zeichen. Alle Runtime-Antworten sind `no-store` und setzen `X-Content-Type-Options: nosniff`. Die PWA ruft die API same-origin mit `credentials: "include"` auf.

## 2. Bootstrap und Access-Session

Der Edge Router leitet nach Scan zur `/tag/{tagId}`-PWA und übergibt `mode`, `av`, `rv`, `nonce`, `exp`, `sig`. Die HMAC-Signatur bindet TAG, Schutzmodus, Access-Version, Contentrevision, Nonce und Ablauf. Sie ist nur ein kurzlebiger Bootstrapnachweis und keine dauerhafte Berechtigung. Die Application API prüft den Bootstrap serverseitig erneut; Ablaufzeitpunkt `exp` darf höchstens 60 Sekunden in der Zukunft liegen.

### 2.1 Public-Bootstrap

```http
POST /api/v1/tags/ab12cd/access/public
Content-Type: application/json
```

```json
{
  "mode": "public",
  "accessVersion": 3,
  "revision": 8,
  "nonce": "<kurzlebige-nonce>",
  "exp": 1790000000,
  "sig": "<edge-hmac>"
}
```

Nur ein aktiver TAG im Schutzmodus `public` mit übereinstimmender Access-Version und Revision wird autorisiert. Erfolg ist `200` mit `{ "status": "authorized", "mode": "public" }` und Cookie:

```http
Set-Cookie: myqr24_tag_access=<opaque-token>; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=2592000
```

### 2.2 PIN-Bootstrap

```http
POST /api/verify-pin
Content-Type: application/json
```

```json
{
  "tagId": "ab12cd",
  "pin": "123456",
  "mode": "pin_required",
  "accessVersion": 3,
  "revision": 8,
  "nonce": "<kurzlebige-nonce>",
  "exp": 1790000000,
  "sig": "<edge-hmac>"
}
```

Erfolg setzt dasselbe Cookie und antwortet mit `{ "status": "authorized", "mode": "pin" }`. PINs werden mit Argon2id und serverseitigem `APP_PIN_PEPPER_S01` geprüft. Fünf Fehlversuche pro TAG/Client-IP führen zu 15 Minuten Sperre. Falscher PIN, Sperre, ungültige Signatur und nicht verfügbarer TAG antworten neutral mit `404`.

Sessions laufen 30 Tage; D1 speichert nur den Tokenhash. Jeder Request prüft Ablauf, TAG-Status und `access_version`. Status- oder Access-Version-Wechsel machen bestehende Sessions unwirksam. Es gibt aktuell keinen Login-, Owner- oder Gast-Session-Endpunkt; PIN-Access ist kein Owner-Login.

## 3. TAG-Ansicht zum Rendern lesen

```http
GET /api/v1/tags/ab12cd/content
Cookie: myqr24_tag_access=<opaque-token>
```

Erfolg (`200 application/json`) liefert eine Runtime-Projektion, nicht das Designer-Template:

```json
{
  "schema": "myqr24-tag-content-v2",
  "tagId": "ab12cd",
  "revision": 8,
  "view": {
    "tag": { "id": "ab12cd", "displayName": "Mein TAG", "presentation": "standard" },
    "vault": {
      "blocks": [
        { "type": "hero", "title": "Mein TAG", "placement": { "span": { "mobile": 12, "desktop": 8 } } },
        { "type": "text", "title": "Willkommen", "paragraphs": ["Ein Beispiel"] },
        { "type": "gallery", "title": "Galerie", "images": [], "slots": [{ "slotId": "images", "accepts": ["image"], "min": 0, "max": 48 }] }
      ]
    },
    "enabledFeatures": ["vault"],
    "theme": { "colorMode": "light", "colors": { "background": "#f7f5f0" } },
    "layout": { "mode": "grid-flow", "columns": 12, "gap": "md" }
  },
  "elements": [
    {
      "id": "cel_gallery",
      "type": "gallery",
      "displayOrder": 30,
      "visibility": "public",
      "payload": { "options": { "name": "Galerie" }, "slots": [{ "slotId": "images", "accepts": ["image"], "min": 0, "max": 48 }] },
      "items": [
        {
          "contentId": "1850000000000000",
          "type": "image",
          "title": "Titelbild",
          "altText": "Beschreibung",
          "filename": "Titelbild.webp",
          "displayOrder": 0,
          "visibility": "public",
          "scope": "tag"
        }
      ]
    }
  ]
}
```

`view` enthält die aus dem Template projizierten Blocks sowie Theme/Layout. `elements[]` ergänzt vollständige Payloads und die relational aus D1 geladenen sichtbaren Elemente/Items. `contentId` ist ein Dezimalstring und im Client als String zu behandeln. Der Server liest ein privates R2-Dokument über einen serverseitig abgeleiteten Key und kombiniert es mit der aktuellen D1-Elementstruktur und Item-Zuordnungen. Der R2-Key wird nie ausgegeben.

Items müssen `ready` und nicht widerrufen sein. In `elements[]` sind `public`-Elemente/Assignments für Public- und PIN-Sessions sichtbar; `shared` ist für PIN-Sessions sichtbar. `private` und `ownerOnly` sind mit den aktuellen Sessiontypen nicht sichtbar. **Wichtige Implementierungsgrenze:** `view.vault.blocks[]` wird im aktuellen Worker aus dem R2-Dokument unverändert übernommen und nicht anhand der Element-Sichtbarkeit gefiltert. Bis eine serverseitige Blockfilterung ergänzt ist, dürfen nicht öffentliche Inhalte nicht in Blocktexten landen; Consumers dürfen `elements[]` allein nicht als Beleg ansehen, dass `view` ebenfalls sicher gefiltert ist. Unbekannte Blocktypen kann die UI fail-soft ignorieren. Es gibt keinen historischen Revisionsleser und kein `If-None-Match` auf dieser Route.

## 4. Medienadresse anfordern

Die JSON-Ansicht enthält keine R2- oder Medien-URLs. Für ein vorhandenes, sichtbares Item verwendet die PWA:

```http
POST /api/get-image-url
Content-Type: application/json
Cookie: myqr24_tag_access=<opaque-token>
```

```json
{
  "tagId": "ab12cd",
  "contentId": "1850000000000000",
  "variant": "cover"
}
```

`contentId` ist ein kanonischer positiver Dezimalstring im Bereich `1..2^52-1`. `variant` muss `[a-z0-9][a-z0-9-]{0,63}` entsprechen. Clientseitige Bucket-, Pfad- und Key-Parameter existieren nicht.

Der Worker prüft Session, aktuelle Contentrevision, Itemstatus und Element-/Assignment-Sichtbarkeit. Danach leitet er den Storage-Key aus D1-Metadaten ab und ruft den Media-Signer per Service Binding mit `objectKey`, `contentType` und `expiresIn: 60` auf. Eine erfolgreiche Signer-Antwort wird als JSON durchgereicht; ihr vorgesehenes Format lautet:

```json
{ "url": "https://<kurzlebige-signatur>", "expiresAt": 1790000060, "contentType": "image/webp" }
```

**Aktuelle Betriebsgrenze:** Der Media-Signer implementiert das Signieren noch nicht und antwortet fail-closed mit `404`. Auch der URL-Endpunkt kann daher aktuell neutral `404` zurückgeben. Ein erfolgreicher Response ist erst verfügbar, wenn R2-Signiercredentials und Signer-Implementierung bereitgestellt sind. URLs sind grundsätzlich kurzlebig und nicht zu persistieren.

### Bilddateien hinzufügen oder verwalten

Es gibt aktuell **keine API-Routen** für Upload, Ersetzen, Löschen, Quarantänefreigabe, Slot-Belegung oder Item-Zuordnung. `slots[]` und `actions.upload`/`download`/`delete` im Template sind Metadaten beziehungsweise Policies; sie implementieren keine Operation. Eine Bilddatei kann erst geliefert werden, nachdem eine separate Upload-/Ingestion-API sie in R2 gespeichert, als Item/Variante in D1 registriert und einem Element zugewiesen hat.

## 5. Fehler, Cache und Methoden

| Situation | Status | Verhalten |
| --- | ---: | --- |
| gültiger Bootstrap / autorisierte Ansicht / erfolgreiche Signer-Antwort | `200` | JSON |
| ungültiger JSON-Body bei Bootstrap oder Medienanfrage | `400` | neutrale Runtime-Antwort |
| TAG nicht verfügbar, falscher PIN, ungültige/fehlende Session, nicht sichtbares oder fehlendes Item, Signer nicht verfügbar | `404` | neutraler Body `Not Found` |
| unerwarteter Fehler | `500` | neutraler Body `Not Found` |
| unbekannte Route oder nicht unterstützte Methode, einschließlich `HEAD` | `404` | neutraler Body `Not Found` |

Antworten tragen `Cache-Control: no-store`; JSON trägt zusätzlich `X-Content-Type-Options: nosniff`. Es gibt keine Idempotency-Key-Semantik für Runtime-POSTs. Ein Bootstrap ist nur innerhalb seiner kurzen Ablaufzeit gültig.

## 6. Deployment und Tests

Bindings des Workers: `APP_DB`, `PRIVATE_CONTENT`, `MEDIA_SIGNER`. Serverseitige Secrets sind `APP_BOOTSTRAP_SECRET_S01`, `APP_PIN_PEPPER_S01`, `APP_MEDIA_SIGNER_KEY_S01`; `APP_CONTENT_PUBLISH_KEY_S01` ist ausschließlich für den Publisher. Keine dieser Variablen darf Browser-/Vite-/Pages-Code erreichen.

`npm run build:app-api` ist ein Wrangler-Dry-Run und deployt keinen Worker. Deployment und Secret-Provisionierung sind separat zu bestätigen.

**Tests:** `apps/tag-app/test/app-api.test.ts`, `apps/tag-app/test/app-api-inline-elements.test.ts`, `apps/tag-app/test/tag-content-read.test.ts`, `apps/tag-app/src/services/tagAccessService.test.ts`.