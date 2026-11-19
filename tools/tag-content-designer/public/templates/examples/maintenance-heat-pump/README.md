# Beispiel: Wartung – Wärmepumpe

Tag-Typ `maintenance`, Presentation `standard`, `schemaVersion: 3`.

## Was das Beispiel zeigt

- **Wartungshistorie** (`maintenance-history`, `groupBy: year`, `showTotals: true`) mit
  Slot `entries` (Dokument **und** Bild, max. 64), Upload nur für Owner.
- **Typenschild** als Einzelbild (8/4 neben der Historie).
- **Wartungstabelle** (4 Spalten: Datum \| Arbeit \| Techniker \| Status) mit farbigen
  Statuswerten (`run.color`) und Zebra-Zeilen.
- **Sicherheitshinweis** (`callout`, `tone: safety`).
- **Prüfprotokolle** als Dokumentenliste (`shared`, Upload nur Owner, `afterUpload: ready`).

## Daten

`sample.json`: zwei Bilder, zwei Protokoll-Dokumente, vier Wartungseinträge
(drei `done`, einer `open` mit „geplant") in zwei Jahren.

## Prüfpunkte

1. Historie gruppiert nach Jahr, Einträge innerhalb des Jahres absteigend.
2. Wartungstabelle: Status farbig, vierte Spalte rechtsbündig.
3. Dokumente nur für Gast/Owner sichtbar (`shared`), Upload-Knopf nur Owner.
4. Einträge ohne Dokument bleiben gültig (kein leerer Link).
