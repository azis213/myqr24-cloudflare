# myQR24 TAG-Content-Designer

Offline arbeitendes Browser-Werkzeug zum Erstellen und Bearbeiten von **TAG-Content-Templates** und **Element-Bibliotheken** für myQR24.

Die vollständige Spezifikation steht in [`doc/SPECIFICATION.md`](doc/SPECIFICATION.md), die fachliche Herleitung im Refinement [`docs/00-Refinement/tag-content-designer/`](../../docs/00-Refinement/tag-content-designer/tag-content-designer-refinement.md).

## Start

```sh
cd tools/tag-content-designer
npm install        # bei bereits installierten Root-Abhängigkeiten nicht nötig
npm run dev

# für testing

npm run dev:content-designer      # http://127.0.0.1:5180
npm run test:content-designer     # 39 Tests
npm run build:content-designer    # tsc --noEmit + vite build
```

Danach im Browser öffnen:

```text
http://127.0.0.1:5180
```

Weitere Befehle:

| Befehl                 | Zweck                                                       |
| ---------------------- | ----------------------------------------------------------- |
| `npm run build`      | `tsc --noEmit` + Produktions-Build nach `dist/`         |
| `npm run preview`    | gebautes Ergebnis lokal ansehen (`http://127.0.0.1:4180`) |
| `npm test`           | Vitest-Suite (183 Tests)                                    |
| `npm run test:watch` | Tests im Watch-Modus                                        |

## Was das Tool kann

- **Templates laden und speichern**: `Load`, `Save` (gleiche Datei), `Save as` (neue Datei), `Download`. Nutzt die File System Access API; Firefox/Safari fallen auf Download + Datei-Dialog zurück.
- **Vorlagen**: „Vault – Standard" und „Lost & Found – Standard" sind eingebaut, dazu „Neu" für alle TAG-Typen.
- **Elemente**: Text, Einzelbild, Dokument, Galerie, Dokumentenliste sowie Hinweis, Titelbereich, Fundhinweis, Kontaktweg, Wartungshistorie (optional).
- **Layout**: 12-Spalten-Grid mit Flusslayout; Spalten und Spans werden zur Laufzeit berechnet, Vorschau in Handy/Tablet/Desktop.
- **Gestaltung**: Theme-Farben, Element-Hintergründe, Text- und Überschriftenfarben, Innenabstände.
- **RTF-Textfelder**: Tiptap/ProseMirror mit eigenem Schema. Beim Fokus erscheint die Leiste über dem Feld: **Absatzstil (Text / Überschrift 1–5)**, Schriftfamilie mit **Ist-Anzeige** („Standard" ohne Zeichen-Mark) und **Schriftgröße als natives Zahlenfeld** (Pfeile bei Fokus/Hover), Fett/Kursiv/Unterstrich, links/zentriert/rechts, Aufzählung und Nummerierung, Ein-/Ausrücken, Zeilenabstand, Zeichenfarbe, Markierung, **Box-Hintergrund** und Links (`https:`/`mailto:`). Symbolknöpfe wie in Word, `Shift+Enter` erzeugt einen Umbruch im selben Absatz.
- **Markierung bleibt erhalten**: Ein Klick in die Leiste verliert die Auswahl nicht (dezente Merk-Dekoration) – weitere Schritte wirken auf dieselbe Spanne; ein Klick in den Text löscht den Merker.
- **Überschriften 1–5**: jede Zeile kann Überschrift sein (mehrere pro Feld, auch mit Fett/Farbe); Absatzstil-Feld, `#`-Kürzel und `Strg+Alt+1…5`; leere Überschrift + `Backspace` wird wieder Absatz.
- **Tabellen**: Knopf fügt eine Tabelle mit 2 Spalten ein; `Tab` springt zur nächsten Zelle, am Tabellenende entsteht eine neue Spalte (bis 6), danach eine neue Zeile (bis 20), `Enter` am Tabellenende hängt ebenfalls eine Zeile an, `Enter` in der Zelle setzt einen Umbruch – max. 6 × 20, Zellen als Text, Kopfzeile und Spaltenausrichtung.
- **Gitter-Toolbox**: Rahmenfarbe/-stil/-stärke für die ganze Tabelle, Zellhintergründe für Zelle/Zeile/Spalte/Auswahl/ganze Tabelle, **Textfarbe und Text-Hintergrund** in Zellen (auf Auswahl, ohne Auswahl ganze Zelle), **Spaltenoperationen** („Spalte links einfügen", „Spalte entfernen" auf der Cursor-Spalte) sowie Formate (`Standard`, `Kopfzeile`, `Zebra`, `Kräftig`, `Rahmenlos`). Neue Tabellen starten mit sichtbarem Rahmen. Im Editor sind Zellen immer mit Hilfslinien sichtbar; die Vorschau zeigt nur gespeicherte Rahmen. Zellfläche (`cell.background`), Schriftfarbe (`run.color`) und Textmarkierung (`run.background`) bleiben im JSON getrennt.
- **Markdown** als Ein-/Ausgabe: `#` bis `#####`, `- `/`1. `, `**fett**`, `*kursiv*`, `[Text](https://…)`, GFM-Tabellen; Paste und „MD"-Panel (Einfügen/Exportieren) – HTML bleibt Text, Markdown wird nie gespeichert.
- **JSON-Panel**: Knopf „JSON" zeigt das Runs-Modell direkt unter dem Feld (lesend, kopierbar); MD- und JSON-Panel sind exklusiv und schließen bei jeder anderen Formatierung oder per „Schließen".
- **Dateigröße** bis 128 kB (Budget für Tabellen mit Rahmen und Hintergründen).
- **Farbmenüs**: Theme-Palette, 24 Standardfarben, **eigene Farben** (hinzufügen/entfernen) und ein RGB-Farbwähler. Eigene Farben werden mit der Konfiguration gespeichert (`palette.custom`).
- **Letzte Konfiguration**: Der zuletzt bearbeitete Stand wird lokal gesichert und beim Start/Reload wieder geladen (Rückfall auf die ausgelieferte Vorlage, wenn er unbrauchbar ist).
- **Textkontrolle als JSON**: Rechts steht das Runs-Modell des Textfelds als bearbeitbares, scrollbares JSON; Änderungen werden mit denselben Regeln geprüft wie die Gesamtvalidierung.
- **Formatierung als Tokens, nie als HTML**: Der Export enthält nur Marks/Attribute aus geschlossenen Skalen. HTML im Text wird wörtlich angezeigt; eingefügte Formatierung wird konvertiert, alles andere verworfen.
- **Validierung**: strukturell, semantisch und Policy (kein gespeichertes HTML, kein `javascript:`, keine Storage-Keys, Größen-/Skalenlimits) mit Feldpfad und Hinweis.
- **Element-Bibliothek**: Default-Bibliothek beim Start, `Load`/`Save`/`Save as` mit automatischer Versionserhöhung.
- **JSON-Ansicht**: kanonisches JSON mit Bytegröße und SHA-256.

## Projektstruktur

```text
src/
  domain/    Typen, Katalog, Validierung, Serialisierung, Migration, Bibliothek, Layout, Bindings, RichText-Modell
  rich/      Editor: Tiptap-Schema, Mapping Modell ⇄ Editor, Toolbar, Paste-Sanitizer, CSS-Konverter
  state/     Editor-Zustand (Undo/Redo), Dateizugriff (FS Access API + Fallback, IndexedDB-Handles)
  preview/   Vorschau-Renderer (RichText mit Listen, Elemente, Grid)
  ui/        App, Inspektor, Panels (Elementliste, Validierung, JSON)
public/
  templates/ ausgelieferte Vorlagen (zugleich Golden Files der Tests)
  elements/  Default-Bibliothek (zugleich Golden File)
doc/         Spezifikation
THIRD-PARTY.md  Lizenzen der Laufzeit-Abhängigkeiten (Tiptap/ProseMirror, MIT)
```

## Sicherheit und Grenzen

- Keine Netzwerkzugriffe außer dem Laden der eigenen Default-Dateien; keine Konten, keine Telemetrie (Tiptap/ProseMirror sind gebündelt, kein CDN).
- **HTML aus Inhalten wird nie gerendert**: Text läuft ausschließlich über React-Textknoten/`textContent`; `innerHTML`, `dangerouslySetInnerHTML` und `getHTML()` sind per `architecture.test.ts` verboten.
- Kein CSS aus Inhalten: Farben (`#rrggbb`), Größen, Abstände und Ausrichtung nur aus geschlossenen Skalen.
- Links nur `https:`/`mailto:` mit `rel="noopener noreferrer nofollow"`; `javascript:`/`data:` werden verworfen und sind ein Validierungsfehler.
- Rechte (`actions`) sind Anträge: das Template kann Rechte einschränken, nie erweitern; durchgesetzt wird später serverseitig.
- Veröffentlichung, Template-Verwaltung und Benutzeranpassung sind **nicht** Teil dieses Tools.
- Bündelgröße: 837 kB JS (278 kB gzip) inkl. Editor und Markdown-Tokenizer; Tiptap-Tabellen-/Drop-/Gapcursor sind nicht enthalten.






