# myQR24 TAG-Content-Designer

Offline arbeitendes Browser-Werkzeug zum Erstellen und Bearbeiten von **TAG-Content-Templates** und **Element-Bibliotheken** für myQR24.

Die vollständige Spezifikation steht in [`doc/SPECIFICATION.md`](doc/SPECIFICATION.md), die fachliche Herleitung im Refinement [`docs/00-Refinement/tag-content-designer/`](../../docs/00-Refinement/tag-content-designer/tag-content-designer-refinement.md).

## Start

```sh
cd tools/tag-content-designer
npm install        # bei bereits installierten Root-Abhängigkeiten nicht nötig
npm run dev
```

Danach im Browser öffnen:

```text
http://127.0.0.1:5180
```

Weitere Befehle:

| Befehl | Zweck |
| --- | --- |
| `npm run build` | `tsc --noEmit` + Produktions-Build nach `dist/` |
| `npm run preview` | gebautes Ergebnis lokal ansehen (`http://127.0.0.1:4180`) |
| `npm test` | Vitest-Suite (64 Tests) |
| `npm run test:watch` | Tests im Watch-Modus |

## Was das Tool kann

- **Templates laden und speichern**: `Load`, `Save` (gleiche Datei), `Save as` (neue Datei), `Download`. Nutzt die File System Access API; Firefox/Safari fallen auf Download + Datei-Dialog zurück.
- **Direktes Editieren**: Texte werden in der Vorschau selbst bearbeitet; beim Fokus erscheint darüber eine Formatierleiste mit **Fett, Kursiv, Unterstrich** und **Vorder-/Hintergrundfarbe**.
- **Arbeitsfläche**: linke Leiste per Ziehgriff zwischen 220 und 680 px breit, die Breite wird gemerkt; die Mitte bleibt die Vorschau.
- **Reihenfolge**: Sortieren wirkt sofort in der Vorschau (Platzierung wird für alle Breakpoints mitgeführt).
- **Vorlagen**: „Vault – Standard" und „Lost & Found – Standard" sind eingebaut, dazu „Neu" für alle TAG-Typen.
- **Elemente**: Text, Einzelbild, Dokument, Galerie, Dokumentenliste sowie Hinweis, Titelbereich, Fundhinweis, Kontaktweg, Wartungshistorie (optional).
- **Layout**: 12-Spalten-Grid mit Flusslayout; Spalten und Spans werden zur Laufzeit berechnet, Vorschau in Handy/Tablet/Desktop.
- **Gestaltung**: Theme-Farben, Element-Hintergründe, Text- und Überschriftenfarben, Innenabstände.
- **Validierung**: strukturell, semantisch und Policy (kein HTML, kein `javascript:`, keine Storage-Keys, Größenlimits) mit Feldpfad und Hinweis.
- **Element-Bibliothek**: Default-Bibliothek beim Start, `Load`/`Save`/`Save as` mit automatischer Versionserhöhung.
- **JSON-Ansicht**: kanonisches JSON mit Bytegröße und SHA-256.

## Projektstruktur

```text
src/
  domain/    Typen, Katalog, Validierung, Serialisierung, Migration, Bibliothek, Layout, Bindings
  state/     Editor-Zustand (Undo/Redo), Dateizugriff (FS Access API + Fallback, IndexedDB-Handles)
  preview/   Vorschau-Renderer (RichText, Elemente, Grid)
  ui/        App, Inspektor, Panels (Elementliste, Validierung, JSON)
public/
  templates/ ausgelieferte Vorlagen (zugleich Golden Files der Tests)
  elements/  Default-Bibliothek (zugleich Golden File)
doc/         Spezifikation
```

## Sicherheit und Grenzen

- Keine Netzwerkzugriffe außer dem Laden der eigenen Default-Dateien; keine Konten, keine Telemetrie.
- Kein HTML, kein CSS aus Inhalten, keine Storage-Keys, keine URLs auf Objekte.
- Rechte (`actions`) sind Anträge: das Template kann Rechte einschränken, nie erweitern; durchgesetzt wird später serverseitig.
- Veröffentlichung, Template-Verwaltung und Benutzeranpassung sind **nicht** Teil dieses Tools.
