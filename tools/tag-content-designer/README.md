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

### TAG-Content publishen (nur im lokalen Dev-Server)

Der Button **Publish…** steht im `npm run dev`-Modus neben Save/Download. Der Proxy ist Teil des Vite-Entwicklungsservers; er ist nicht im Build oder Preview enthalten. Der Dev-Server bindet ausschließlich `127.0.0.1`.

- **Lokal:** Zugangsdaten kommen serverseitig aus `apps/tag-app/.dev.vars` (`APP_CONTENT_PUBLISH_KEY_S01`, `APP_LOCAL_SEED_KEY`) und `apps/edge-router/.dev.vars` (`TAG_CODEC_API_KEY_S01`). Die lokale TAG-Verwaltung nutzt den Seed-Key, nicht den Publisher-Key. Beide Dateien werden nie an den Browser ausgegeben. Worker: 8787 (TAG-App), 8788 (Codec).
- **Staging:** Vor dem Start des Dev-Servers dessen Prozessumgebung setzen: `MYQR_STAGING_TAG_APP_API_BASE_URL`, `MYQR_STAGING_CODEC_BASE_URL`, `MYQR_STAGING_PUBLISH_KEY`, `MYQR_STAGING_TAG_TEST_ADMIN_KEY` (separater TAG-Testverwaltungs-Key) und `TAG_CODEC_API_KEY_S01` (Codec-Bearer-Key). URLs müssen HTTPS verwenden. Der Staging-Worker braucht zusätzlich das Secret `TAG_TEST_ADMIN_KEY_S01` und `TAG_TEST_ADMIN_ENVIRONMENT=staging`. Das Secret niemals mit dem Publisher-Key gleichsetzen.
- **Test-TAG-Verwaltung:** Im Dialog Routing-TAGs lokal oder in Staging laden, anlegen und ändern. Status, Zieltyp (`internal`/`external`), Schutzmodus, External-HTTPS-URL und Versionswerte sind konfigurierbar; `updated_at` setzt die API. Die Standardwerte sind `active`, `internal`, `public` und Version 1. Vollständiges Löschen entfernt ausschließlich TAG-eigene D1-/R2-Daten; globale R2-Objekte bleiben unberührt. In Staging kann dies jeden TAG betreffen und ist daher ausdrücklich destruktiv. Produktion ist nicht freigeschaltet.
- Der Browser speichert nur Umgebung, Base36-TAG-ID und Template-Auswahl lokal. Die numeric ID wird jeweils über den serverseitig authentifizierten Codec ermittelt und nicht persistent abgelegt.
- Vor dem vollständigen Ersatz zeigt der Dialog Ziel und Template und verlangt die exakte Eingabe `PUBLISH <Base36-TAG-ID>`. Vor dem Klick bleiben Auflösung und Validierung lokal; für Implementierungs-/Build-Tests keinen Publish auslösen.

Weitere Befehle:

| Befehl                 | Zweck                                                       |
| ---------------------- | ----------------------------------------------------------- |
| `npm run build`      | `tsc --noEmit` + Produktions-Build nach `dist/`         |
| `npm run preview`    | gebautes Ergebnis lokal ansehen (`http://127.0.0.1:4180`) |
| `npm test`           | Vitest-Suite (239 Tests)                                    |
| `npm run test:watch` | Tests im Watch-Modus                                        |

## Was das Tool kann

- **Templates laden und speichern**: `Load`, `Save` (gleiche Datei), `Save as` (neue Datei), `Download`. Nutzt die File System Access API; Firefox/Safari fallen auf Download + Datei-Dialog zurück.
- **Vorlagen**: „Vault – Standard" und „Lost & Found – Standard" sind eingebaut, dazu „Neu" für alle TAG-Typen. Unter **Beispiele** liegen vier fertige Templates mit Testdaten: Hochzeit (Gartenfeier, Abendparty), Lost & Found (Reisekoffer) und Wartung (Wärmepumpe) – geladen über das Manifest `public/templates/examples/index.json`.
- **Beispieldaten & Rollen**: Beim Laden eines Beispiels erscheinen in der Kopfzeile der Schalter **Beispieldaten** und die **Rolle** (`Gast`, `Owner`, `Scanner`). Die Vorschau zeigt dann echte Bilder, Dokumente, Galeriebeiträge („wartet auf Freigabe") und Wartungseinträge nach Jahr. `shared`-Inhalte verschwinden für `Scanner`; `private`/`ownerOnly` bleiben nur im Editor mit Hinweis. Die Daten kommen aus `sample.json` und werden **nie** ins Template geschrieben.
- **Elemente**: Text, Einzelbild, Dokument, Galerie, Dokumentenliste sowie Hinweis, Titelbereich, Fundhinweis, Kontaktweg, Wartungshistorie (optional).
- **Layout**: 12-Spalten-Grid mit Flusslayout; Spalten und Spans werden zur Laufzeit berechnet (`span` ist ein Anteil am 12er-Raster, 8/4 ergibt 2/3 + 1/3). Vorschau-Breiten mobil-first: Handy 320/360/390/430, Tablet 768/1024, Web 1280/1440 und **Fit** (nutzt den verfügbaren Platz ohne Scrollbalken). Der Schalter **Compact** wirkt in jeder Breite: an = mehrspaltig (echte Ausgabe), aus = alle Elemente untereinander (Editieransicht, `Strg+Shift+E`). Darunter Layout-Hinweise für zu schmale Spalten, zu kleine Schrift, breite Tabellen und lange Handy-Kacheln.
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
- Bündelgröße: 856 kB JS (283 kB gzip) inkl. Editor und Markdown-Tokenizer; Tiptap-Tabellen-/Drop-/Gapcursor sind nicht enthalten.










