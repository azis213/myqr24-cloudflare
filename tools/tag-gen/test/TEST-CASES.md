# Testfälle – myQR24 TAG-Generator

**Stand:** 2026-10-07
**Testort:** `tools/tag-gen/test/`
**Automatisierung:** Vitest (`domain.test.ts`, `tag-generation.test.ts`)

| ID        | Anforderung              | Vorbedingung / Testdaten                                                       | Aktion                                          | Erwartetes Ergebnis                                       | Automatisiert      |
| --------- | ------------------------ | ------------------------------------------------------------------------------ | ----------------------------------------------- | --------------------------------------------------------- | ------------------ |
| TG-TC-001 | HTTPS-Basis-URL          | `https://s.myqr24.com/t`                                                     | URL validieren                                  | Normalisierung auf`https://s.myqr24.com/t/`             | Ja                 |
| TG-TC-002 | URL-Sicherheit           | HTTP-URL, Query-URL, URL mit Nicht-Base45-Zeichen                              | URL validieren                                  | Jede unsichere bzw. inkompatible Eingabe wird abgewiesen  | Ja                 |
| TG-TC-003 | 6-stelliger Bereich      | Werte`60.466.176` bis `60 466 179`                                         | Bereich anlegen                                 | Gruppierungszeichen werden entfernt, Anzahl ist 4         | Ja                 |
| TG-TC-004 | Bereichsschutz           | Bereits angelegter 6-stelliger Bereich                                         | Überlappenden Bereich anlegen                  | Überlappung wird verhindert                              | Ja                 |
| TG-TC-005 | 8-stellige Bereichsregel | Nicht durch 16 teilbare Grenzen                                                | 8-stelligen Bereich anlegen                     | Bereich wird wegen fehlender 16-Ausrichtung abgewiesen    | Ja                 |
| TG-TC-006 | Etikettenvorlage         | Standardvorlage                                                                | Vorlage validieren                              | Druckbare A4-Vorlage ist gültig                          | Ja                 |
| TG-TC-007 | Layout-Kollision         | Textfeld auf QR-Code verschoben                                                | Vorlage validieren                              | Überlappung wird gemeldet                                | Ja                 |
| TG-TC-008 | Druckstartposition       | Raster 3 × 2, fünf TAGs, Start Zeile 2/Spalte 2                              | TAGs paginieren                                 | Seite 1 lässt vier Felder frei, zwei Seiten entstehen    | Ja                 |
| TG-TC-009 | Generierung 6/8          | Testdaten mit 3 sechs- und 3 achtstelligen Werten; ausschließlich Testsecrets | TAGs erzeugen                                   | Sechs eindeutige IDs mit korrekter Länge und Ziel-URL    | Ja                 |
| TG-TC-010 | Fortschritt              | Drei Werte                                                                     | Generierung ausführen                          | Fortschrittsabschluss`3/3` wird gemeldet                | Ja                 |
| TG-TC-011 | TAG-Listenexport         | Generierte Testliste                                                           | Liste exportieren                               | JSON enthält keine Feistel- oder HMAC-Testsecrets        | Ja                 |
| TG-TC-012 | TAG-Listenimport         | Exportierte Testliste                                                          | Liste importieren                               | TAGs und normalisierte Basis-URL bleiben erhalten         | Ja                 |
| TG-TC-013 | TAG-Listenintegrität    | Liste mit doppelter TAG-ID                                                     | Liste importieren                               | Import wird abgewiesen                                    | Ja                 |
| TG-TC-014 | Konfigurationsimport     | `test-data/sample-configuration.json`                                        | Konfiguration importieren                       | Bereiche und Vorlage werden ohne Geheimnisse eingelesen   | Teilweise (Parser) |
| TG-TC-015 | Browser-Workflow         | Lokaler Vite-Server                                                            | Bereiche eingeben, generieren, Vorschau öffnen | Navigierbare UI, sichtbare Validierung, QR-SVG-Vorschau   | Manuell            |
| TG-TC-016 | PDF-Ausgabe              | Generierte TAG-Liste, gültige Vorlage                                         | „Druckansicht / PDF öffnen“                  | Browserdruckdialog bietet „Als PDF speichern“ mit A4 an | Manuell            |

## Testdaten

- `test-data/sample-configuration.json`: importierbare, valide Konfiguration ohne Secrets.
- Tests verwenden ausschließlich die String-Konstanten `tag-generator-test-…`; sie sind keine Produktionssecrets.
- Bereiche sind absichtlich klein, um Testläufe schnell und deterministisch zu halten.

## Ausführung

```cmd
cd tools\tag-gen
npm test
npm run build
```

Manuelle UI-Prüfung:

```cmd
cd tools\tag-gen
npm run dev
```

Danach `http://127.0.0.1:5173` im Browser öffnen.
