# `tag-codec-internal-v1`

**Status:** `planned`  
**Version:** `v1`  
**Owner:** Cloudflare TAG Codec Worker  
**Implementierende Komponenten:** künftiger Cloudflare TAG Codec Worker; künftige serverseitige TAG Control Plane  
**Nicht implementiert vor:** dokumentierter W0-Gate-Freigabe, bestätigtem Staging-Worker-/Route-/Token-Betriebsweg und kompatiblen Staging-Testvektoren.

## 1. Zweck und fachliche Grenze

Dieser interne Vertrag erzeugt öffentliche, kanonische TAG-IDs aus bereits durch die TAG Control Plane autoritativ reservierten kanonischen `decodedValue`-Werten.

Er verhindert, dass die TAG Control Plane `FEISTEL_SECRET_S01` oder `TAG_HMAC_SECRET_S01` speichern, laden oder verarbeiten muss. Diese Schlüssel sowie die Feistel- und HMAC-Implementierung liegen ausschließlich in Cloudflare.

Die TAG Control Plane bleibt fachlich autoritativ für:

- Range-, Pool- und Slot-Validierung;
- atomare Reservierung im kanonischen `decodedValue`-Raum;
- Idempotenz, Lifecycle, Audit und Produktionsfreigaben;
- Speicherung der zurückgelieferten öffentlichen `tagId`;
- spätere minimale Routing-Projektion.

Der Codec Worker ist keine fachliche Autorität und reserviert, veröffentlicht, auditiert oder mutiert keine Fachdaten.

## 2. Nicht-Ziele und Ausschlüsse

Der Vertrag bietet ausdrücklich nicht:

- keinen öffentlichen Endpunkt;
- keine Browser-, TAG-App-, Control-Center- oder TAG-Lab-Nutzung;
- keinen frei aufrufbaren Decode-Endpunkt;
- keine Range-Reservierung oder Datenbankmutation;
- keine KV-Projektion oder Cloudflare-KV-Schreiboperation;
- keine Ausgabe von Feistel-, HMAC-, Redirect- oder Publisher-Secrets;
- keine CORS-Freigabe;
- keine Verarbeitung von Owner-, Claim-, Audit-, Druck- oder Organisationsdaten.

Öffentliche Scans werden weiterhin direkt im Edge Router dekodiert. Der Edge Router verwendet dafür denselben Cloudflare-seitigen Feistel-/HMAC-Schlüsselbestand, aber keine Netzwerkweiterleitung zum Codec Worker.

## 3. Secret- und Deploymentgrenzen

| Secret | Speicherort | Verwendung |
| --- | --- | --- |
| `FEISTEL_SECRET_S01` | Cloudflare Staging Worker Secret: Edge Router und Codec Worker | feste 10-Runden-Feistel-Codierung bzw. -Decodierung |
| `TAG_HMAC_SECRET_S01` | Cloudflare Staging Worker Secret: Edge Router und Codec Worker | 4-Bit-Integritätsnibble für achtstellige TAGs |
| `TAG_CODEC_API_KEY_S01` | Cloudflare Staging Worker Secret und serverseitiger Dogado-Secret-Speicher der Staging Control Plane | Authentisierung Plane → Codec Worker |
| `REDIRECT_SIGNING_SECRET_S01` | Cloudflare Staging Worker Secret: Edge Router | nicht Teil dieses Vertrags |

Alle kryptografischen Werte enthalten mindestens 32 zufällige Bytes; die bevorzugte portable Repräsentation ist 64 Zeichen lowercase Hex.

Die Kennung `S01` bezeichnet die aktuell festgelegte Staging-Secretversion. Eine später erforderliche neue Version erhält neue Bindungsnamen; die konkrete erste Production-Version ist vor dem Production-Gate separat festzulegen. `TAG_CODEC_API_KEY_S01` ist unabhängig von allen anderen Secrets und rotierbar. Der tatsächliche Wert darf nie in Git, Browsern, Cloudflare Pages, Logs, Auditmetadaten, Evidenz, URL-Parametern oder Fehlerantworten erscheinen.

## 4. Transport und Authentisierung

### 4.1 Endpoint

```http
POST /internal/v1/tag-codec/encode
```

Die endgültige Staging-/Produktionsroute wird erst nach W0 durch den bestätigten Cloudflare-Betriebsweg festgelegt. Sie darf nicht über Scan-Domains, öffentliche Pages-Domains oder Public-API-CORS erreichbar sein.

### 4.2 Pflicht-Request-Header

```http
Authorization: Bearer <TAG_CODEC_API_KEY_S01>
Content-Type: application/json
Idempotency-Key: <UUID>
```

Regeln:

1. Nur `POST` ist zulässig.
2. Der Worker vergleicht den übermittelten API-Key zeitkonstant mit `TAG_CODEC_API_KEY_S01`.
3. Fehlende, ungültige oder abgelaufene Authentisierung erhält eine neutrale `401`-Antwort ohne Detail.
4. Der Key darf nur aus der serverseitigen Control Plane gesendet werden, niemals aus Browsercode.
5. Der Worker sendet `Cache-Control: no-store` und keine CORS-Header.
6. Der endgültige Rate-Limit-, Netzwerk- und optional IP-Allowlist-Mechanismus ist Teil von `CP-BLK-005` und vor Staging verbindlich zu bestätigen.

### 4.3 Rotation

Der API-Key wird getrennt von Feistel-/HMAC-Secrets rotiert:

1. neuen Key serverseitig in Cloudflare und im Dogado-Secret-Speicher hinterlegen;
2. optionaler kurzer, dokumentierter Übergang mit aktivem und nächstem Key;
3. Control Plane umstellen und einen authentisierten Staging-Smoketest ausführen;
4. alten Key widerrufen;
5. keine Keywerte in Audit, Logs oder Evidenz speichern.

Ein Wechsel von `FEISTEL_SECRET_S01` oder `TAG_HMAC_SECRET_S01` auf eine spätere Version ist nicht Bestandteil von v1, da er die Kompatibilität bestehender TAG-IDs beeinflusst.

## 5. Request- und Response-Schema

### 5.1 Request

```json
{
  "algorithmVersion": "v1",
  "requests": [
    {
      "requestId": "50ecec64-2c03-4e9c-80d7-351969419baa",
      "length": 6,
      "decodedValue": "1234567"
    },
    {
      "requestId": "6c35ceca-e185-40b2-89f9-b6c4c4a716cb",
      "length": 8,
      "decodedValue": "2383793808"
    }
  ]
}
```

| Feld | Typ | Regeln |
| --- | --- | --- |
| `algorithmVersion` | String | Muss exakt `v1` sein. |
| `requests` | Array | 1 bis maximal 100 Einträge; exakte Staging-Grenze vor Implementierung testen und dokumentieren. |
| `requests[].requestId` | UUID | Im Request eindeutig; dient der Zuordnung, nicht als Fach- oder Secret-ID. |
| `requests[].length` | Integer | Ausschließlich `6` oder `8`. |
| `requests[].decodedValue` | Dezimalstring | Keine Vorzeichen, keine führenden Nullen außer Wert `0`; muss zum kanonischen Base36-Raum der Länge passen. |

Zusätzliche Regeln:

1. Die Control Plane validiert vor dem Request selbst erneut Range, Nichtüberlappung, Slotgrenzen und atomare Reservierung.
2. Sechsstellige Werte liegen in `I(6) = [36^5, 36^6)`.
3. Achtstellige Eingaben sind die 16er-ausgerichteten Basen. Der Codec berechnet das vollständige `decodedValue` mit HMAC-Nibble selbst und gibt diesen Wert zurück.
4. Das vollständige Achtstellen-`decodedValue` wird durch die Control Plane gespeichert.
5. Das Request-Body-Limit, die maximale Batchgröße und das Rate Limit werden fail-closed umgesetzt.
6. Derselbe `Idempotency-Key` mit abweichendem Request-Body wird abgelehnt.

### 5.2 Erfolgsantwort

```json
{
  "algorithmVersion": "v1",
  "results": [
    {
      "requestId": "50ecec64-2c03-4e9c-80d7-351969419baa",
      "length": 6,
      "decodedValue": "1234567",
      "tagId": "ab12cd"
    },
    {
      "requestId": "6c35ceca-e185-40b2-89f9-b6c4c4a716cb",
      "length": 8,
      "decodedValue": "2383793819",
      "tagId": "7f9k2mxa"
    }
  ]
}
```

| Feld | Bedeutung |
| --- | --- |
| `requestId` | unverändert aus der Anfrage |
| `length` | kanonische TAG-Länge |
| `decodedValue` | für Länge 6 die Eingabe; für Länge 8 der durch den Worker ergänzte vollständige HMAC-validierte Wert |
| `tagId` | lowercase Base36, exakt der angegebenen Länge, Ergebnis der Feistel-Codierung |

Erfolgsantworten tragen:

```http
Cache-Control: no-store
Content-Type: application/json; charset=utf-8
```

## 6. Fehlernormalisierung

| HTTP | Fehlercode | Wann |
| --- | --- | --- |
| `400` | `invalid_request` | ungültiges JSON, Schema, Länge, kanonischer Wert, UUID oder Batchgröße |
| `401` | `unauthorized` | fehlender oder ungültiger API-Key |
| `405` | `method_not_allowed` | andere HTTP-Methode |
| `409` | `idempotency_conflict` | gleicher Idempotency-Key mit anderem Request-Body |
| `413` | `payload_too_large` | Body- oder Batchlimit überschritten |
| `429` | `rate_limited` | Rate-Limit überschritten |
| `500` | `codec_unavailable` | interner Fehler ohne Secret- oder Algorithmusdetails |

Normierte Fehlerantwort:

```json
{
  "error": {
    "code": "invalid_request",
    "correlationId": "server-generated-correlation-id"
  }
}
```

Die Antwort enthält keine Geheimnisse, keine Key-ID, keine internen Validierungsdetails und keine Feistel-/HMAC-Zwischenwerte.

## 7. Idempotenz, Korrelation und Logging

- Die Control Plane setzt pro fachlicher Reservierung oder Batch einen kryptografisch zufälligen `Idempotency-Key`.
- Der Codec Worker speichert nur die für das begrenzte Idempotenzfenster notwendige Request-Fingerprint-/Response-Zuordnung. Die Storage- und TTL-Entscheidung wird vor Staging konkretisiert.
- Die Control Plane führt eine Korrelations-ID in Audit und Outbox, aber keine Secretwerte oder vollständigen Auth-Header.
- Worker-Logs enthalten maximal Zeit, Request-Methode, Route, Status, Batchanzahl, anonymisierte Korrelationskennung und Fehlerklasse.
- `Authorization`, Request-Bodies, `decodedValue`-Listen und `tagId`-Listen werden nicht als reguläre Worker-Logs ausgegeben.

## 8. Sicherheits- und Contract-Tests vor Staging

| Test-ID | Nachweis |
| --- | --- |
| `CODEC-CT-001` | Gleiche Cloudflare-Testsecrets liefern für festgelegte 6-/8-stellige Vektoren dieselben Ergebnisse wie der Edge Router. |
| `CODEC-CT-002` | Nichtkanonische Werte, falsche Längen und nicht ausgerichtete Achtstellen-Basen werden neutral abgelehnt. |
| `CODEC-CT-003` | Fehlender/falscher `TAG_CODEC_API_KEY_S01` liefert neutral `401`, ohne Decode-/Secretdetail. |
| `CODEC-CT-004` | Ein Browser-Origin erhält keine CORS-Freigabe und kann den Endpunkt nicht nutzen. |
| `CODEC-CT-005` | Idempotente Wiederholung liefert dieselbe Antwort; gleicher Key mit anderem Body liefert `409`. |
| `CODEC-CT-006` | Body-, Batch- und Rate-Limits sind fail-closed. |
| `CODEC-CT-007` | Logs, Evidenz und Fehlerantworten enthalten keinen API-Key, keine Feistel-/HMAC-Secrets und keine vollständigen Listen. |
| `CODEC-CT-008` | API-Key-Rotation mit begrenztem Übergangsfenster und anschließender Widerruf sind nachweisbar. |

## 9. Traceability

| Story / Blocker | Vertragsbezug |
| --- | --- |
| `CP-US-011` | Öffentliche `tagId` aus reservierten canonical values erzeugen, ohne Feistel-/HMAC-Secrets in der Plane |
| `CP-US-013` | Poolgrenzen verbleiben im `decodedValue`-Raum |
| `CP-US-020` / `CP-US-021` | deterministische TAG-ID für Druck-/Snapshotdaten |
| `CP-BLK-003` | getrennte Cloudflare-Staging-Testsecrets und kompatible Testvektoren erforderlich |
| `CP-BLK-005` | interne Worker-Route, Minimal-Secret-Scope, Rate Limit und Betriebsweg erforderlich |
