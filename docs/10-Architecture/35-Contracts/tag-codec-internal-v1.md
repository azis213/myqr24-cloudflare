# `tag-codec-internal-v1`

**Status:** `implemented-staging-slice`  
**Version:** `v1`  
**Owner:** Cloudflare TAG Codec Worker  
**Implementierende Komponenten:** Cloudflare TAG Codec Worker (`apps/edge-router/src/codec-worker.ts`); spätere serverseitige TAG Control Plane  
**Stand:** 2026-10-06

## 1. Zweck und fachliche Grenze

Dieser interne Vertrag stellt der serverseitigen TAG Control Plane eine kleine, authentisierte API für die Feistel-/HMAC-Codec-Operationen bereit. Er erzeugt öffentliche kanonische TAG-IDs aus bereits autoritativ reservierten Werten und prüft bereits ausgegebene TAG-IDs.

Die Feistel- und HMAC-Implementierung liegen gemeinsam in `apps/edge-router/src/codec/index.ts`. Sowohl der öffentliche Scan-Worker als auch der private Codec-Worker importieren diesen Kern. Damit verwenden beide Worker dieselben Algorithmen und Staging-Secrets, ohne dass der Scan-Pfad den Codec-Worker über das Netzwerk aufruft.

Die TAG Control Plane bleibt fachlich autoritativ für:

- Range-, Pool- und Slot-Validierung;
- atomare Reservierung im kanonischen `decodedValue`-Raum;
- Idempotenz, Lifecycle, Audit und Produktionsfreigaben;
- Speicherung der zurückgelieferten öffentlichen `tagId`;
- spätere minimale Routing-Projektion.

Der Codec-Worker ist keine fachliche Autorität und reserviert, veröffentlicht, auditiert oder mutiert keine Fachdaten.

## 2. Implementierter Staging-Slice und Ausschlüsse

Der implementierte Slice umfasst einzelne Encode- und Decode-Operationen. Er bietet ausdrücklich nicht:

- keinen öffentlichen, Browser-, TAG-App-, Control-Center- oder TAG-Lab-Endpunkt;
- keine Range-Reservierung, Datenbankmutation oder KV-Projektion;
- keine KV-Bindung und kein `REDIRECT_SIGNING_SECRET_S01`;
- keine CORS-Freigabe;
- keine Ausgabe von Feistel-, HMAC-, Redirect- oder Publisher-Secrets;
- kein Batch-Encoding, keine `Idempotency-Key`-Verarbeitung und keine Worker-seitige Idempotenzspeicherung;
- kein im Worker implementiertes Rate Limit, IP-Allowlisting oder Cloudflare Access.

Diese aufgeschobenen Betriebs- und Batch-Funktionen bleiben Teil von `CP-BLK-005` und sind vor einer produktiven oder breiter erreichbaren Route verbindlich zu ergänzen. Die Cloudflare-Routenbindung, WAF-/Rate-Limit-Regeln und optionale Access-/IP-Regeln sind daher absichtlich nicht in `wrangler.codec.toml` hinterlegt.

Öffentliche Scans werden weiterhin direkt im Edge Router dekodiert. Der Edge Router nutzt nur den gemeinsamen Codec-Kern und keine Netzwerkweiterleitung zum Codec-Worker.

## 3. Secret- und Deploymentgrenzen

| Secret | Speicherort | Verwendung |
| --- | --- | --- |
| `FEISTEL_SECRET_S01` | Cloudflare Staging Worker Secret: Scan-Worker und Codec-Worker | feste 10-Runden-Feistel-Codierung bzw. -Decodierung |
| `TAG_HMAC_SECRET_S01` | Cloudflare Staging Worker Secret: Scan-Worker und Codec-Worker | 4-Bit-Integritätsnibble für achtstellige TAGs |
| `TAG_CODEC_API_KEY_S01` | Cloudflare Staging Codec-Worker Secret und serverseitiger Dogado-Secret-Speicher der Staging Control Plane | Authentisierung Control Plane → Codec-Worker |
| `REDIRECT_SIGNING_SECRET_S01` | Cloudflare Staging Scan-Worker Secret | nicht an den Codec-Worker gebunden |

Alle kryptografischen Werte enthalten mindestens 32 zufällige Bytes; die bevorzugte portable Repräsentation ist 64 Zeichen lowercase Hex. `TAG_CODEC_API_KEY_S01` ist davon unabhängig und rotierbar. Sein konkreter Wert darf nie in Git, Browsern, Cloudflare Pages, Logs, Auditmetadaten, Evidenz, URL-Parametern oder Fehlerantworten erscheinen.

Der Codec-Worker wird über `apps/edge-router/wrangler.codec.toml` bereitgestellt. Die Konfiguration enthält absichtlich weder `TAG_CONFIG` noch Redirect-Signing-Bindungen. Staging-Secrets werden ausschließlich per `wrangler secret put ... --config wrangler.codec.toml --env staging` gesetzt.

## 4. Transport und Authentisierung

### 4.1 Implementierte Endpunkte

```http
POST /api/v1/tag-codec/encode
POST /api/v1/tag-codec/decode
```

Die Route wird erst nach der W0-Freigabe an einen ausschließlich dafür vorgesehenen, nicht über Scan- oder Pages-Domains erreichbaren Host gebunden. Der vorgesehene Staging-Name ist `codec.s.myqr24.com`; eine Produktionsroute wird vor dem Production-Gate separat festgelegt.

### 4.2 Pflicht-Request-Header

```http
Authorization: Bearer <TAG_CODEC_API_KEY_S01>
Content-Type: application/json
```

Regeln:

1. Nur `POST` ist zulässig.
2. Der Worker vergleicht den übermittelten Bearer-Key zeitkonstant mit `TAG_CODEC_API_KEY_S01`.
3. Fehlende oder ungültige Authentisierung erhält die neutrale Antwort `401 {"error":{"code":"unauthorized"}}`.
4. Der Key darf nur aus der serverseitigen Control Plane gesendet werden, niemals aus Browsercode.
5. Der Worker sendet `Cache-Control: no-store`, `X-Content-Type-Options: nosniff` und keine CORS-Header.
6. Request-Bodies müssen JSON sein und dürfen höchstens 1.024 Bytes umfassen.

## 5. Request- und Response-Schema

### 5.1 Encode

```http
POST /api/v1/tag-codec/encode
```

```json
{
  "length": 6,
  "value": "1234567"
}
```

| Feld | Typ | Regeln |
| --- | --- | --- |
| `length` | Integer | Ausschließlich `6` oder `8`. |
| `value` | Dezimalstring | Keine Vorzeichen, keine führenden Nullen außer `0`; kanonisch im Base36-Raum der Länge. |

Zusätzliche Regeln:

1. Für Länge `6` ist `value` der vollständige kanonische Decoded-Integer.
2. Für Länge `8` ist `value` eine durch 16 teilbare kanonische Basis. Der Codec ergänzt das HMAC-Nibble und gibt den vollständigen Wert zurück.
3. Die Control Plane validiert vor dem Request weiterhin Range, Pool, Slotgrenzen und atomare Reservierung.

Erfolgsantwort:

```json
{
  "tag": {
    "id": "ab12cd",
    "length": 6,
    "value": "1234567"
  }
}
```

`tag.id` ist lowercase Base36 und exakt `length` Zeichen lang. Bei Länge `8` enthält `tag.value` den vollständigen HMAC-validierten Integer.

### 5.2 Decode

```http
POST /api/v1/tag-codec/decode
```

```json
{
  "tagId": "7f9k2mxa"
}
```

| Feld | Typ | Regeln |
| --- | --- | --- |
| `tagId` | String | Lowercase oder uppercase Base36, exakt 6 oder 8 Zeichen; der Worker normalisiert nach lowercase. |

Erfolgsantwort:

```json
{
  "tag": {
    "id": "7f9k2mxa",
    "length": 8,
    "value": "2383793819"
  }
}
```

Bei achtstelligen IDs wird die HMAC-Prüfung vor der Erfolgsantwort ausgeführt.

## 6. Fehlernormalisierung

| HTTP | Fehlercode | Wann |
| --- | --- | --- |
| `400` | `invalid_request` | ungültiges JSON, falscher Content-Type, Schema, Länge, nichtkanonischer Wert, nicht ausgerichtete Achtstellen-Basis oder ungültige TAG-ID einschließlich HMAC-Fehler |
| `401` | `unauthorized` | fehlender oder ungültiger API-Key |
| `404` | `not_found` | anderer Codec-Pfad |
| `405` | Plain text `Method Not Allowed` | andere HTTP-Methode; Header `Allow: POST` |
| `500` | `codec_unavailable` | interner Codec-Fehler ohne Secret- oder Algorithmusdetails |

JSON-Fehlerantworten sind normiert:

```json
{
  "error": {
    "code": "invalid_request"
  }
}
```

Die Antwort enthält keine Geheimnisse, Key-IDs, Feistel-/HMAC-Zwischenwerte oder interne Validierungsdetails.

## 7. Rotation, Logging und Betriebsgrenzen

Der API-Key wird getrennt von Feistel-/HMAC-Secrets rotiert:

1. neuen Key im Cloudflare-Secret und im serverseitigen Dogado-Secret-Speicher hinterlegen;
2. Control Plane auf den neuen Key umstellen und einen authentisierten Staging-Smoketest ausführen;
3. alten Key widerrufen;
4. keine Keywerte in Audit, Logs oder Evidenz speichern.

Worker-Logs dürfen weder `Authorization` noch Request-Bodies, `value`-Listen, TAG-IDs oder Secretwerte enthalten. Vor einer extern erreichbaren Staging-Route müssen route-spezifische WAF-/Rate-Limit-Regeln sowie optional Cloudflare Access/IP-Allowlisting bestätigt werden.

## 8. Sicherheits- und Contract-Tests

| Test-ID | Nachweis |
| --- | --- |
| `TC-CODEC-001` | Ein kanonischer sechsstelliger Wert wird mit dem gemeinsamen Codec-Kern encodiert und wieder decodiert. |
| `TC-CODEC-002` | Eine ausgerichtete achtstellige Basis erzeugt eine HMAC-geschützte ID und wird vollständig wieder decodiert. |
| `TC-CODEC-003` | Unbekannter Pfad, falsche Methode und fehlende Credentials werden fail-closed behandelt; es existiert keine CORS-Freigabe. |
| `TC-CODEC-004` | Ungültiges JSON-Schema, nichtkanonische Werte, nicht ausgerichtete Achtstellen-Basen und ungültige IDs liefern neutrale `400`-Antworten. |
| `TC-CRYPTO-001` bis `TC-HMAC-004` | Der Scan-Worker verwendet dieselben Feistel-/HMAC-Primitive und kompatible Testsecrets. |

Nicht implementierte Nachweise für Batch-Idempotenz, Rate Limits, Access/IP-Restriktionen, Key-Rotation und deployed Staging-Smoke-Tests bleiben vor einer produktiven Freigabe offen.

## 9. Traceability

| Story / Blocker | Vertragsbezug |
| --- | --- |
| `CP-US-011` | Öffentliche `tagId` aus reservierten canonical values erzeugen, ohne Feistel-/HMAC-Secrets in der Plane |
| `CP-US-013` | Poolgrenzen verbleiben im `decodedValue`-Raum |
| `CP-US-020` / `CP-US-021` | deterministische TAG-ID für Druck-/Snapshotdaten |
| `CP-BLK-003` | getrennte Cloudflare-Staging-Testsecrets und kompatible Testvektoren |
| `CP-BLK-005` | vor extern erreichbarer Route: verbindlicher Betriebsweg, Rate Limit sowie Netzwerk-/Access-Grenzen |
