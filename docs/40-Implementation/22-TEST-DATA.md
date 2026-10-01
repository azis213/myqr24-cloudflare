# Testdaten und Fixtures

## Schutzumfang

Alle Testdaten sind künstlich und nicht geheim. Die Test-Secrets dürfen ausschließlich in lokalen Tests verwendet werden:

```text
FEISTEL_SECRET=test-feistel-secret
TAG_HMAC_SECRET=test-hmac-secret
```

Sie sind keine Produktionswerte und werden niemals als Cloudflare Secret gesetzt.

## Ablage

Ausführbare Fixture-Dateien liegen unter:

```text
test/fixtures/
```

Vorhandene Fixture-Datei:

```text
test/fixtures/edge-routing.json
```

Die Datei enthält nicht geheime Test-Secrets sowie wiederverwendbare KV-Feature- und Gruppen-Dokumente. Die Tests ergänzen daraus dynamisch erfolgreiche und fehlerhafte Range-, Zuweisungs- und kryptografische Testdaten. Integer werden dabei ausschließlich als dezimale Strings abgelegt oder gezielt als `BigInt` berechnet.

## Kanonische Werte

| Kennung | Bedeutung | Regel |
| --- | --- | --- |
| `canonicalValue6` | Vollständiger Feistel-decodierter 6-stelliger Range-Key | Muss in `I(6) = [36^5, 36^6)` liegen |
| `canonicalBase8` | Maskierte Basis eines 8-stelligen Testslots | Muss in `I(8)` liegen und durch 16 teilbar sein |
| `canonicalValue8` | Vollständiger 8-stelliger Range-Key | `canonicalBase8 \| hmacNibble` |
| `publicTagId` | Öffentliche 6- oder 8-stellige Base36-ID | Wird durch den testbaren Feistel-Encoder aus dem kanonischen Wert erzeugt |
| `wrongHmacValue8` | Wert desselben 8-stelligen Slots mit falschem Nibble | Muss vor KV-Lookups abgelehnt werden |

Die konkreten Werte werden von Tests berechnet, damit Fixtures keine unkontrolliert manuell berechneten kryptografischen Ableitungen enthalten.

## Erfolgreiche KV-Testdaten

Das Standardfixture enthält diese Dokumentarten:

```text
tag-range-index
group:group-default
range-rule:range-default
tag:{decodedValue}
feature:redirect-default
feature:redirect-range
feature:redirect-tag
feature:json-default
```

Beispiel für einen validen Range-Index:

```json
{
  "version": 2,
  "ranges": [
    {
      "id": "range-default",
      "start": "<canonical-value>",
      "end": "<canonical-value>",
      "groupId": "group-default",
      "length": 6,
      "active": true
    }
  ]
}
```

Beispiel für eine Gruppen-Zuweisung:

```json
{
  "id": "group-default",
  "featureIds": ["json-default"]
}
```

Beispiel für eine Range-Zuweisung:

```json
{
  "featureIds": ["redirect-range"]
}
```

Beispiel für eine direkte Tag-Zuweisung:

```json
{
  "featureIds": ["redirect-tag"]
}
```

Beispiel für ein Redirect-Feature:

```json
{
  "id": "redirect-range",
  "type": "redirect",
  "enabled": true,
  "urlTemplate": "https://app.example.test/tag/{tagId}?id={decodedValue}&group={groupId}&length={length}",
  "status": 302
}
```

## Fehlerhafte Konfigurationen

Tests erzeugen oder laden außerdem folgende absichtlich ungültigen Varianten:

| Kennung | Fehlerbild | Erwartung |
| --- | --- | --- |
| `invalid-overlap-index` | Überlappende Ranges | Gesamter Index wird abgelehnt |
| `invalid-eight-slot-index` | 8-stellige Range nicht auf `% 16 = 0/15` ausgerichtet | Gesamter Index wird abgelehnt |
| `inactive-range` | `active: false` | Keine Auflösung |
| `wrong-length-range` | Range-Länge stimmt nicht mit Tag-Länge überein | Kein Treffer |
| `missing-feature` | Referenz ohne `feature:{id}` | `404` |
| `disabled-feature` | `enabled: false` | `404` |
| `invalid-feature` | Fehlender Typ oder unzulässige Redirect-Struktur | `404` |
| `unknown-placeholder` | Beispielsweise `{tenant}` | `404` |
| `signature-placeholder` | `{tagSignature}` vor einer Signaturimplementierung | `404` |
| `unsafe-redirect` | Relative URL, `javascript:` oder `data:` | `404` |

## Verwendungsregel

Jede Fixture-Änderung verlangt:

1. Aktualisierung dieses Dokuments, falls sich ihre Bedeutung verändert;
2. Anpassung mindestens eines `TC-*`-Falls in `21-TEST-CASES.md`;
3. Prüfung der Zuordnung in `30-TRACEABILITY.md`;
4. erfolgreiche Ausführung von `npm test` und `npm run build`.
