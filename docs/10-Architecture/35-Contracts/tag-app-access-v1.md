# Vertrag: TAG App Access v1

**Version:** `v1`
**Status:** `implemented-local` (Teil des TAG Application API Workers)
**Owner:** TAG Application API Worker
**Consumer:** [TAG Runtime API](tag-app-runtime-api-v1.md)
**Content-Projektion:** `myqr24-tag-content-v2`

> Die konkreten Browser-Endpunkte, Payloads und Runtime-Antworten sind im [TAG Application Runtime API Contract](tag-app-runtime-api-v1.md) beschrieben. Dieser Contract hält die Access-Sicherheitsregeln fest.

## 1. Sicherheitsmodell

Die React-PWA ist eine UI und erhält niemals PIN-Hashes, Pepper, R2-Keys, S3-Credentials, Medien-Signer-Key oder serverseitige Berechtigungsansprüche. Signierte Edge-Parameter werden bei der Application API erneut geprüft. Access-Sessiontypen bleiben von späteren Owner-, Gast- und Empfängerberechtigungen getrennt; ein Scanner-Token ist kein Owner-/Gastzugriff.

## 2. Bootstrap und Sessions

Public- und PIN-Bootstrap prüfen `mode`, `accessVersion`, `revision`, `nonce`, `exp` und `sig` gegen das aktuelle Routing sowie `APP_BOOTSTRAP_SECRET_S01`. Ein erfolgreicher Bootstrap setzt ein zufälliges 256-Bit-Token als:

```http
Set-Cookie: myqr24_tag_access=<opaque-token>; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=2592000
```

D1 speichert nur Tokenhash, TAG, Scope, Access-Version, Ablauf und Widerrufszeit. Sessions laufen nach 30 Tagen ab. Bei jedem Runtime-Request prüft der Worker Tokenhash, Ablauf, aktiven TAG und übereinstimmende `access_version`; Status-/Access-Version-Änderungen invalidieren damit bestehende Sessions.

PIN-Verifikation nutzt Argon2id plus serverseitigen Pepper `APP_PIN_PEPPER_S01`. Der derzeitige Worker-Startwert ist 8 MiB, 1 Iteration, Parallelität 1, 32 Byte Hashlänge; eine produktive Kalibrierung muss auf dem Zielruntime erfolgen. Fünf Fehlversuche pro TAG/Client-IP führen zu einer 15-minütigen Sperre. Fehlermeldungen bleiben neutral.

Aktuell implementiert sind nur Public- und PIN-Scanner-Sessions. Login-, Owner- und Gast-Session-Endpunkte existieren nicht. `shared` ist für PIN-, nicht für Public-Sessions sichtbar; `private` und `ownerOnly` werden durch die derzeitigen Sessiontypen nicht ausgeliefert.

## 3. Medienzugriff und Grenzen

Die Runtime-Medienroute autorisiert TAG, Session, aktuelle Contentrevision, Itemstatus und Sichtbarkeit der Element-/Item-Zuordnung. Der Browser liefert nur `tagId`, dezimale `contentId` und Variante. Bucket, Pfad und Key werden vollständig serverseitig abgeleitet; der Media-Signer erhält nur den abgeleiteten `objectKey`, `contentType`, `expiresIn` und sein internes Service-Key-Headerfeld.

Der Media-Signer implementiert derzeit noch keine R2-Signatur und antwortet fail-closed. Presigned URLs sind daher nicht als bereits verfügbar vorauszusetzen. Ebenfalls nicht implementiert sind Bild-/Dokument-Upload, Item-CRUD, Galeriezuordnung, Quarantäne-Workflow sowie Owner-/Gastberechtigungen. `slots` und `actions` aus einem Template sind keine Upload-API.

## 4. Datenschutz und Tests

Presigned URLs, Access-Token und private Content-Dokumente werden nicht im Service Worker oder persistierendem Browser-Speicher abgelegt. API-Antworten sind `Cache-Control: no-store`; Runtime-JSON-Antworten setzen `X-Content-Type-Options: nosniff`.

**Tests:** `apps/tag-app/test/app-api.test.ts`, `apps/tag-app/test/app-api-inline-elements.test.ts`, `apps/tag-app/src/services/tagAccessService.test.ts`.