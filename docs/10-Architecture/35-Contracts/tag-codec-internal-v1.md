# `tag-codec-internal-v1`

**Status:** `implemented-staging-slice`  
**Version:** `v1`  
**Owner:** Cloudflare TAG Codec Worker  
**Implementierende Komponenten:** Cloudflare TAG Codec Worker (`apps/edge-router/src/codec-worker.ts`); spätere serverseitige TAG Control Plane  
**Stand:** 2026-10-29  
**Nächste spezifizierte Welle:** serverseitige TCP-Staging-Bindung nach separatem Betriebsfreigabegate; kein Browserzugriff.

## 1. Zweck und fachliche Grenze

Dieser interne Vertrag stellt der serverseitigen TAG Control Plane eine kleine, authentisierte API für Feistel-Codec-Operationen bereit. Er erzeugt öffentliche kanonische TAG-IDs aus bereits autoritativ reservierten Werten und prüft bereits ausgegebene TAG-IDs.

Die Feistel-Implementierung liegt in `apps/edge-router/src/codec/index.ts`. Sowohl der öffentliche Scan-Worker als auch der private Codec-Worker importieren diesen Kern. Damit verwenden beide Worker denselben Algorithmus und dasselbe Staging-Secret, ohne dass der Scan-Pfad den Codec-Worker über das Netzwerk aufruft.

Die TAG Control Plane bleibt fachlich autoritativ für:

- Range- und Pool-Validierung;
- atomare Reservierung im kanonischen `decodedValue`-Raum;
- Idempotenz, Lifecycle, Audit und Produktionsfreigaben;
- Speicherung der zurückgelieferten öffentlichen `tagId`;
- spätere minimale Routing-Projektion.

Der Codec-Worker ist keine fachliche Autorität und reserviert, veröffentlicht, auditiert oder mutiert keine Fachdaten.

## 2. Implementierter Staging-Slice und Ausschlüsse

Der lokal getestete Worker-Slice umfasst einzelne Encode-/Decode-Operationen sowie Batch-Encoding. Er bietet ausdrücklich nicht:

- keinen öffentlichen, Browser-, TAG-App-, Control-Center- oder TAG-Lab-Endpunkt;
- keine Range-Reservierung, Datenbankmutation oder KV-Projektion;
- keine KV-Bindung und kein `REDIRECT_SIGNING_SECRET_S01`;
- keine CORS-Freigabe;
- keine Ausgabe von Feistel-, Redirect- oder Publisher-Secrets;
- keine Worker-seitige Idempotenzspeicherung oder fachliche Batch-Reservierung;
- kein im Worker implementiertes Rate Limit, IP-Allowlisting oder Cloudflare Access.

Diese aufgeschobenen Betriebs- und Batch-Funktionen bleiben Teil von `CP-BLK-005` und sind vor einer produktiven oder breiter erreichbaren Route verbindlich zu ergänzen. Die Cloudflare-Routenbindung, WAF-/Rate-Limit-Regeln und optionale Access-/IP-Regeln sind daher absichtlich nicht in `wrangler.codec.toml` hinterlegt.

Öffentliche Scans werden weiterhin direkt im Edge Router dekodiert. Der Edge Router nutzt nur den gemeinsamen Codec-Kern und keine Netzwerkweiterleitung zum Codec-Worker.

## 3. Secret- und Deploymentgrenzen

| Secret | Speicherort | Verwendung |
| --- | --- | --- |
| `FEISTEL_SECRET_S01` | Cloudflare Staging Worker Secret: Scan-Worker und Internal-Codec-Worker | feste 10-Runden-Feistel-Codierung bzw. -Decodierung für 6, 8 und 10 Stellen |
| `TAG_CODEC_API_KEY_S01` | Cloudflare Staging Internal-Codec-Worker Secret und serverseitiger Staging-TCP-Secret-Speicher | Authentisierung TCP → Internal-Codec-Worker |
| `FEISTEL_SECRET_P01` | Cloudflare Production Worker Secret: Scan-Worker und Internal-Codec-Worker | Produktionsäquivalent; separater Wert zu `S01` |
| `TAG_CODEC_API_KEY_P01` | Cloudflare Production Internal-Codec-Worker Secret und serverseitiger Production-TCP-Secret-Speicher | Produktionsäquivalent; separater Wert zu `S01` |
| `REDIRECT_SIGNING_SECRET_S01` / `P01` | jeweiliges Cloudflare Scan-Worker Secret | nicht an den Codec-Worker gebunden |

Ein Feistel-Secret gilt pro Codec-Version und Umgebung, nicht pro TAG-Länge. Die Längen verwenden getrennte kanonische Domänen; drei Secretwerte pro Umgebung sind daher weder erforderlich noch vorgesehen. Alle kryptografischen Werte enthalten mindestens 32 zufällige Bytes; die bevorzugte portable Repräsentation ist 64 Zeichen lowercase Hex. `TAG_CODEC_API_KEY_*` ist davon unabhängig und rotierbar. Sein konkreter Wert darf nie in Git, Browsern, Cloudflare Pages, Logs, Auditmetadaten, Evidenz, URL-Parametern oder Fehlerantworten erscheinen.

Der Codec-Worker wird über `apps/edge-router/wrangler.codec.toml` bereitgestellt. Die Konfiguration enthält absichtlich weder `TAG_CONFIG` noch Redirect-Signing-Bindungen. Staging-Secrets werden ausschließlich per `wrangler secret put ... --config wrangler.codec.toml --env staging` gesetzt.

## 4. Transport und Authentisierung

### 4.1 Implementierte Endpunkte

```http
POST /api/v1/codec/encode
POST /api/v1/codec/encode-batch
POST /api/v1/codec/decode
```

Der Internal-Host ist die allgemeine private technische Grenze und kein Browser-API-Host:

| Umgebung | Internal-Host | Öffentlicher Scan-Host |
| --- | --- | --- |
| Staging | `https://internal.s.myqr24.com` | `https://s.myqr24.com` |
| Produktion | `https://internal.p.myqr24.com` | `https://p.myqr24.com` |

Die bisher aktive Staging-Route `codec.s.myqr24.com/api/v1/*` ist ein abzulösender Slice. Ihr Umzug auf `internal.s.myqr24.com/api/v1/codec/*` erfolgt erst in der nächsten kontrollierten Edge-Deployment-Welle. Der öffentliche Scan-Worker decodiert unverändert lokal und ruft den Internal-Worker nie über das Netzwerk auf.

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
6. Request-Bodies müssen JSON sein. Einzel-Requests dürfen höchstens 1.024 Bytes; `encode-batch`-Requests höchstens 256 KiB umfassen.
7. Ausschließlich die serverseitige TCP hält den Codec-Service-Key. TCC, TAG-App, lokale Druck-SPA und jeder sonstige Browser dürfen den Internal-Codec weder direkt aufrufen noch einen dauerhaften Service-Key erhalten.

## 5. Request- und Response-Schema

### 5.1 Encode

```http
POST /api/v1/codec/encode
```

```json
{
  "length": 6,
  "value": "1234567"
}
```

| Feld | Typ | Regeln |
| --- | --- | --- |
| `length` | Integer | Ausschließlich `6`, `8` oder `10`. |
| `value` | Dezimalstring | Keine Vorzeichen, keine führenden Nullen außer `0`; kanonisch im Base36-Raum der Länge. |

Zusätzliche Regeln:

1. Für jede Länge ist `value` der vollständige lineare kanonische Decoded-Integer.
2. Der Codec verändert den Wert nicht; er kodiert ihn ausschließlich als öffentliche Base36-ID.
3. Die Control Plane validiert vor dem Request weiterhin Range, Poolgrenzen und atomare Reservierung.

Erfolgsantwort:

```json
{
  "codecVersion": "S01",
  "tag": {
    "id": "ab12cd",
    "length": 6,
    "value": "1234567"
  }
}
```

`tag.id` ist lowercase Base36 und exakt `length` Zeichen lang. `tag.value` entspricht für jede Länge unverändert dem vollständigen kanonischen Eingabewert.

### 5.2 Batch-Encode

```http
POST /api/v1/tag-codec/encode-batch
```

```json
{
  "length": 8,
  "values": ["78364164096", "78364164097"]
}
```

| Feld | Typ | Regeln |
| --- | --- | --- |
| `length` | Integer | Ausschließlich `6`, `8` oder `10`. |
| `values` | Array von Dezimalstrings | Mindestens ein und höchstens 1.000 eindeutige, kanonische Werte derselben Länge. |

Der Worker speichert, reserviert oder iteriert keine Range. TCP sendet nur bereits fachlich geprüfte konkrete Werte. Bei einem ungültigen Wert schlägt der gesamte Request neutral fehl; es gibt keine Teilergebnisse. Die Ergebnisreihenfolge entspricht der Eingabereihenfolge.

```json
{
  "codecVersion": "S01",
  "tags": [
    { "id": "7f9k2mxa", "length": 8, "value": "78364164096" },
    { "id": "example1", "length": 8, "value": "78364164097" }
  ]
}
```

Der Codec ist deterministisch und zustandslos. Transport-Wiederholungen sind kryptografisch unkritisch; fachliche Idempotenz, Chunk-Fortschritt und Persistenz bleiben ausschließlich Aufgabe der TCP.

### 5.3 Decode

```http
POST /api/v1/codec/decode
```

```json
{
  "tagId": "7f9k2mxa"
}
```

| Feld | Typ | Regeln |
| --- | --- | --- |
| `tagId` | String | Lowercase oder uppercase Base36, exakt 6, 8 oder 10 Zeichen; der Worker normalisiert nach lowercase. |

Erfolgsantwort:

```json
{
  "codecVersion": "S01",
  "tag": {
    "id": "7f9k2mxa",
    "length": 8,
    "value": "2383793819"
  }
}
```

Der zurückgegebene Wert ist für jede Länge der vollständige lineare kanonische Range-Key.

## 6. Fehlernormalisierung

| HTTP | Fehlercode | Wann |
| --- | --- | --- |
| `400` | `invalid_request` | ungültiges JSON, falscher Content-Type, Schema, nicht unterstützte Länge, nichtkanonischer Wert oder ungültige TAG-ID |
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

Die Antwort enthält keine Geheimnisse, Key-IDs, Feistel-Zwischenwerte oder interne Validierungsdetails.

## 7. Rotation, Logging und Betriebsgrenzen

Der API-Key wird getrennt vom Feistel-Secret rotiert:

1. neuen Key im Cloudflare-Secret und im serverseitigen Dogado-Secret-Speicher hinterlegen;
2. Control Plane auf den neuen Key umstellen und einen authentisierten Staging-Smoketest ausführen;
3. alten Key widerrufen;
4. keine Keywerte in Audit, Logs oder Evidenz speichern.

Worker-Logs dürfen weder `Authorization` noch Request-Bodies, `value`-Listen, TAG-IDs oder Secretwerte enthalten. Vor einer extern erreichbaren Staging-Route müssen route-spezifische WAF-/Rate-Limit-Regeln sowie optional Cloudflare Access/IP-Allowlisting bestätigt werden.

## 8. Sicherheits- und Contract-Tests

| Test-ID | Nachweis |
| --- | --- |
| `TC-CODEC-001` | Ein kanonischer sechsstelliger Wert wird mit dem gemeinsamen Codec-Kern encodiert und wieder decodiert. |
| `TC-CODEC-002` | Kanonische acht- und zehnstellige Werte erzeugen öffentliche IDs und werden jeweils vollständig wieder decodiert. |
| `TC-CODEC-003` | Unbekannter Pfad, falsche Methode und fehlende Credentials werden fail-closed behandelt; es existiert keine CORS-Freigabe. |
| `TC-CODEC-004` | Ungültiges JSON-Schema, nichtkanonische Werte und ungültige IDs liefern neutrale `400`-Antworten. |
| `TC-CODEC-005` | Batch mit 1.000 kanonischen Werten für jede unterstützte Länge liefert gleich viele, geordnete Roundtrip-kompatible Ergebnisse. |
| `TC-CODEC-006` | Batch mit mehr als 1.000 Werten, Duplikat, ungültigem Wert oder Überschreitung des Body-Limits scheitert vollständig neutral ohne Teilergebnis. |
| `TC-CODEC-007` | Jede Encode-/Decode-Antwort enthält die für Umgebung und Worker feste `codecVersion`; Browser-Origin und Browser-Credentials erhalten keinen Internal-Codec-Zugriff. |
| `TC-CRYPTO-001` bis `TC-CRYPTO-006` | Scan- und Codec-Worker verwenden dieselben Feistel-Primitive, Parameter und kompatible Testsecrets für 6, 8 und 10 Stellen. |

Nicht implementierte Nachweise für Batch-Idempotenz, Rate Limits, Access/IP-Restriktionen, Key-Rotation und deployed Staging-Smoke-Tests bleiben vor einer produktiven Freigabe offen.

## 9. Traceability

| Story / Blocker | Vertragsbezug |
| --- | --- |
| `CP-US-011` | Öffentliche `tagId` aus reservierten canonical values erzeugen, ohne Feistel-Secrets in der Plane |
| `CP-US-013` | Poolgrenzen verbleiben im `decodedValue`-Raum |
| `CP-US-020` / `CP-US-021` | deterministische TAG-ID für Druck-/Snapshotdaten |
| `CP-BLK-003` | getrennte Cloudflare-Staging-Testsecrets und kompatible Testvektoren |
| `CP-BLK-003` / `W2L-BLK-CODEC` | TCP verwendet einen serverseitigen Fake-/Contract-Adapter und kompatible 6-/8-/10-stellige Vektoren; keine Feistel-Secrets in TCP |
| `CP-BLK-005` | vor Internal-Host-Umzug: verbindlicher Betriebsweg, Route/WAF-/Rate-Limit- sowie Netzwerk-/Access-Grenzen |
