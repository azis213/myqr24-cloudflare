# TAG-Testdaten

Dieser Ordner enthält versionierte Testdefinitionen, TAG-Content-Templates,
Designer-Vorschau-Daten und die jeweils benötigten Medien. Die Fixtures sind
Testdaten, keine bereits veröffentlichten TAGs.

## Reservierter Bereich für zehnstellige TAGs

Der kanonische zehnstellige Zahlenbereich beginnt bei `36^8 = 2.821.109.907.456`.
Die ersten 1.000 Testplätze verwenden fortlaufend die numerischen IDs
`2.821.109.907.456` bis einschließlich `2.821.109.908.455`.

| Testplätze (1-basiert) | Numerische IDs (inklusive) | Reservierung | Verzeichnisbeispiele |
| ---: | ---: | --- | --- |
| 1–100 | 2.821.109.907.456–2.821.109.907.555 | Lost & Found | `lost-found-luggage` |
| 101–200 | 2.821.109.907.556–2.821.109.907.655 | Vault / Events | `wedding-garden`, `wedding-party` |
| 201–300 | 2.821.109.907.656–2.821.109.907.755 | Maintenance und weitere TAG-Typen | `maintenance-heat-pump` |
| 301–1.000 | 2.821.109.907.756–2.821.109.908.455 | Noch nicht zugewiesen | für künftige Fixtures |

Die Platznummer ist eine lokale Ordnungsnummer, nicht Bestandteil der TAG-ID.
Jede Fixture enthält in `tag-definition.json` ihren Platz und ihre numerische
ID. `tagId` bleibt bis zur Vorgabe/Ermittlung der zugehörigen Base36-Public-ID
`null`. Keine Public-ID aus der numerischen ID ableiten und als bestätigt
eintragen, bevor sie für den Test festgelegt wurde.

## Aufbau je Fixture

- `tag-definition.json` – Testplatz, Reservierungsgruppe, numerische ID und
  derzeit noch offene Base36-Public-ID.
- `template.tagcontent.json` – Template aus dem TAG-Content-Designer. Dies ist
  das `template`-Feld, das beim API-Publish verwendet wird.
- `sample.json` – Vorschau-Daten des Designers. Nicht Teil des Publish-Requests.
- `assets/` – lokale Kopien der im Sample verwendeten SVG-Dateien. Ein echter
  Medien-Upload ist ein separater API-Vorgang.

Der Publish-Endpunkt erwartet zusätzlich `tagId` und `tagNumericId` im
Request-Body. Solange `tagId` noch `null` ist, muss ein Request erst nach
Eintragen und Prüfen der Base36-Public-ID zusammengestellt werden. Für die
zulässigen Base36-Zahlenräume siehe die
[Beispiele-Übersicht](../../../tools/tag-content-designer/public/templates/examples/README.md).

## Angelegte Fixtures

| Fixture | Testplatz | Reservierung | TAG-Typ |
| --- | ---: | --- | --- |
| [`lost-found-luggage`](lost-found-luggage/) | 1 | Lost & Found | `lost-found` |
| [`wedding-garden`](wedding-garden/) | 101 | Vault / Events | `event` |
| [`wedding-party`](wedding-party/) | 102 | Vault / Events | `event` |
| [`maintenance-heat-pump`](maintenance-heat-pump/) | 201 | Maintenance | `maintenance` |