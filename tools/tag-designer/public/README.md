# Label-Formate konfigurieren

Die Datei `label-formats.json` wird beim Start des Label-Designers geladen. Sie kann ohne Änderung am TypeScript-Code angepasst werden.

## Startwerte

```json
"default": {
  "formatId": "L4778-8",
  "dpi": 300,
  "physicalUnit": "mm",
  "numberFormat": "de-DE",
  "cornerRadiusPx": 42
}
```

- `formatId`: ID eines Eintrags aus `formats`.
- `dpi`: Druckauflösung zwischen 72 und 1200.
- `physicalUnit`: `"mm"` oder `"cm"`.
- `numberFormat`: `"de-DE"` oder `"en-US"`.
- `cornerRadiusPx`: Eckenradius in Pixeln.

## Neues Label-Format ergänzen

```json
{
  "id": "L4779-8",
  "name": "L4779-8",
  "widthMm": 99.1,
  "heightMm": 67.7
}
```

Jeder Eintrag benötigt:
- eine eindeutige `id`,
- einen Anzeigenamen `name`,
- `widthMm` und `heightMm` als positive Werte in Millimetern.

Nach einer Änderung die Anwendung im Browser neu laden. Bei einem Produktions-Build wird diese Datei unverändert nach `dist/label-formats.json` kopiert.
