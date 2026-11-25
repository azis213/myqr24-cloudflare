# TAG-Content-Beispiele

Diese Übersicht dokumentiert die Beispiel-Templates und Vorschau-Daten unter
`public/templates/examples`. Die Dateien dienen als Arbeits- und Lernbeispiele
für den TAG-Content-Designer; `sample.json` ist **kein** API-Publish-Payload.

## Erlaubte Zahlenbereiche für Base36-TAG-IDs

Für eine TAG-Länge `n` ist der kanonische Zahlenbereich
`36^(n-2) <= Wert < 36^n`. Die untere Grenze ist inklusive, die obere Grenze
exklusive. Damit ergeben sich folgende erlaubte Werte:

| TAG-Länge | Untergrenze (inklusive) | Obergrenze (exklusive) | Größter erlaubter Wert |
| ---: | ---: | ---: | ---: |
| 6 Stellen | 1.679.616 | 2.176.782.336 | 2.176.782.335 |
| 8 Stellen | 2.176.782.336 | 2.821.109.907.456 | 2.821.109.907.455 |
| 10 Stellen | 2.821.109.907.456 | 3.656.158.440.062.976 | 3.656.158.440.062.975 |

Die Grenzen entsprechen `base36LowerBound()` und `base36UpperBound()` im
TAG-Codec (`apps/edge-router/src/codec/index.ts`). Die IDs sind Zahlen; ihre
Base36-Schreibweise wird auf die jeweilige TAG-Länge mit führenden Nullen
aufgefüllt.

## Vorhandene Beispiele

| Beispiel | TAG-Typ | Presentation | Schwerpunkt |
| --- | --- | --- | --- |
| [`wedding-garden`](wedding-garden/README.md) | `event` | `wedding` | Gartenfeier, Ablauf, Speisekarte, Gästefotos und Dokumente |
| [`wedding-party`](wedding-party/README.md) | `event` | `wedding` | Abendparty, Getränkekarte, Partyfotos und Ablaufplan |
| [`lost-found-luggage`](lost-found-luggage/README.md) | `lost-found` | `standard` | Fundhinweis, Fundmeldung, Fotos und Kontaktweg |
| [`maintenance-heat-pump`](maintenance-heat-pump/README.md) | `maintenance` | `standard` | Wartungshistorie, Typenschild, Sicherheit und Protokolle |

Das Manifest [`index.json`](index.json) ist die Quelle für die Beispielauswahl
im Designer. Jedes Beispielverzeichnis enthält:

- `template.tagcontent.json` – TAG-Content-Template (Schema-Version 3),
- `sample.json` – ausschließlich Vorschau-Inhalte für den Designer,
- `README.md` – Hinweise zum Beispiel, zu den verwendeten Elementen und zu
  Prüfpunkten.

Gemeinsam verwendete SVG-Bilder liegen in [`assets/`](assets/). Die
Vorschau-Daten werden nicht in das Template geschrieben und ersetzen weder
API-Payloads noch separat erforderliche Medien-Uploads.

## Geordnete TAG-Testdaten

Die reservierten zehnstelligen TAG-Testplätze und zugehörige Fixtures werden
unter [`../../../../../test/80-Test-Data-Definition/Tags/`](../../../../../test/80-Test-Data-Definition/Tags/README.md)
verwaltet. Dort sind TAG-IDs zunächst über ihre numerische ID zugeordnet;
die Base36-Public-ID bleibt offen, bis sie für den Test vorgegeben wurde.