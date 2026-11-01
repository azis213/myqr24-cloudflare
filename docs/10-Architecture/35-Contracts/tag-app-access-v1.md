# Vertrag: TAG App Access v1

**Version:** `v1`  
**Status:** `implemented-local`  
**Owner:** TAG Application API Worker  
**Consumer:** React-PWA; Media-Signer nur per Service Binding

## 1. Sicherheitsmodell

Die React-PWA ist eine UI. Sie erhält niemals PIN-Hashes, Pepper, R2-Keys, S3-Credentials, Medien-Signer-Key oder fachliche Berechtigungsansprüche. Signierte Edge-Parameter sind nicht vertrauenswürdig und werden bei der API erneut geprüft.

Sessiontypen bleiben getrennt: Scanner-Access (`public`/`pin`), Owner-Session, Gast-Session und Empfängergrant. Ein Scanner-Token ersetzt keine Owner- oder Gastberechtigung.

## 2. Endpunkte

```text
POST /api/v1/tags/{tagId}/access/public
POST /api/verify-pin
GET  /api/v1/tags/{tagId}/content
POST /api/get-image-url
```

Public- und PIN-Bootstrap prüfen `mode`, `accessVersion`, `revision`, `nonce`, `exp`, `sig` gegen D1 und das serverseitige `APP_BOOTSTRAP_SECRET_S01`. Erfolgreiche Antworten setzen einen zufälligen 256-Bit-Token ausschließlich als `HttpOnly; Secure; SameSite=Strict; Path=/api` Cookie. D1 speichert nur den Tokenhash, Scope, Access-Version, Ablauf und Widerruf.

`GET content` liefert ausschließlich die im serverseitig abgeleiteten Scope zulässige View aus:

```text
content/v1/tags/{tagId}/{contentRevision}.json
```

Das JSON enthält typisierte Blöcke und anonyme `contentId`s, aber keine R2-Keys, Medien-URLs, PINs, Hashes, Tokens, Owner-, Pool- oder POI-Nachweisdaten.

## 3. PIN und Throttle

PINs verwenden Argon2id mit serverseitigem Pepper (`APP_PIN_PEPPER_S01`). Pepper steht ausschließlich im Secret Store, nie in D1 oder R2. Der lokale Startwert lautet 8 MiB, 1 Iteration, Parallelität 1, 32-Byte-Hash; die finale Worker-Kalibrierung erfolgt erst nach Staging-Benchmark.

Fünf Fehlversuche pro `(tagId, clientSignal)` setzen eine serverseitige Sperre von 15 Minuten. Fehlermeldungen bleiben neutral. Bei Erfolg wird der Throttle gelöscht. PIN-Änderung, Sperrung und Deaktivierung erhöhen/ändern `access_version` bzw. Status und widerrufen damit Sessions zentral.

## 4. Medien

`POST /api/get-image-url` akzeptiert nur `tagId`, anonyme `contentId` und erlaubte Variante. Die API prüft Session, Status, Access-Version, Contentrevision und Scope, bevor sie den Media-Signer per Service Binding anspricht. Der Media-Signer erhält den zusätzlichen serverseitigen Schlüssel `APP_MEDIA_SIGNER_KEY_S01` und soll später eine 60-sekündige, objektgebundene R2-Presigned-URL erzeugen. Die lokale Implementierung bleibt fail-closed, bis S3-kompatible R2-Signiercredentials im W3D-Gate bereitstehen.

Presigned URLs, Sessiontoken und Content-JSON werden nicht im Service Worker oder persistentem Browser-Speicher abgelegt. Alle API-Antworten nutzen `Cache-Control: no-store`.