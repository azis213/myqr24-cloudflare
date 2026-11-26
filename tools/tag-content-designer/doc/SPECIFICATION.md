# TAG-Content-Designer – Spezifikation (v0.1)

**Status:** erste Umsetzung des Refinements (`docs/00-Refinement/tag-content-designer/`)
**Stand:** 2026-11-18
**Tool:** `tools/tag-content-designer`
**Geltung:** offline arbeitendes Browser-Werkzeug für TAG-Content-Templates und Element-Bibliotheken

---

## 1. Zweck und Abgrenzung

Der TAG-Content-Designer erstellt und bearbeitet **TAG-Content-Templates**: eine JSON-Beschreibung, aus der später pro TAG eine eigene Version in R2/D1 veröffentlicht wird.

Das Tool ist bewusst:

- **offline** – kein Login, kein Server, keine Cloud-Ablage, keine Credentials;
- **eine Datei-Werkbank** – `Load`, `Save`, `Save as` auf lokalen Dateien;
- **kein Publisher** – Veröffentlichung erfolgt später über TCC/TCP;
- **kein Berechtigungssystem** – das Template *beantragt* Rechte, die tag-api entscheidet.

Nicht enthalten: Template-Verwaltung, Benutzerkonten, Medien-Upload, PDF-Rendering, Wartungsdaten-Erfassung.

---

## 2. Begriffe und Artefakte

| Artefakt | Schema | Datei | Rolle |
| --- | --- | --- | --- |
| TAG-Content-Template | `myqr24-tag-content-template-v1` | `*.tagcontent.json` | vollständige Ansicht für einen TAG-Typ |
| TAG-Instanz | `myqr24-tag-content-instance-v1` | `*.tagcontent.json` | benutzerspezifische, geflattete Kopie für ein TAG |
| Element-Bibliothek | `myqr24-tag-element-library-v1` | `*.tagelements.json` | **eine** Datei mit allen Complex-Item-Bausteinen |
| Element-Template | – | Teil der Bibliothek | wiederverwendbarer Baustein (Gallery, Dokumente, Wartung) |

Regeln:

- Ein Template enthält **keine** Medien, keine `contentId`, keine Storage-Keys, keine Objekt-URLs.
- Mehrfach verwendete Bausteine werden beim Export **geflattet**; es gibt keine Laufzeitreferenz auf ein Element-Template.
- Jedes TAG erhält später eine eigene Projektion (eigene R2-Dateien und D1-Zeilen), auch bei unveränderter Standardvorlage.

---

## 3. Aufbau eines Templates

```json
{
  "schema": "myqr24-tag-content-template-v1",
  "schemaVersion": 1,
  "template": { },
  "shell": { },
  "layout": { },
  "editability": { },
  "palette": { "custom": ["#123456"] },
  "elements": [ ]
}
```

| Block | Inhalt |
| --- | --- |
| `template` | `templateId`, `templateVersion`, `tagType`, `name`, `description`, `locale`, `status`, `compatibility` |
| `shell` | `presentation`, `features`, `theme` (Farben, Typografie, Layout), `navigation`, `statusBar` |
| `layout` | `mode: grid-flow`, `columns: 12`, `gap`, `container`, `responsive` (`autoReflow`, `minColumnWidth`, `preferredColumns`) |
| `editability` | Whitelist der später im User-Designer änderbaren Pfade + `limits` |
| `palette` | eigene Farben der Formatierleiste (`custom`, max. 24 × `#rrggbb`) – Teil der Konfiguration |
| `elements` | geordnete Elemente mit `elementId`, `elementType`, `items`, `displayOrder`, `visibility`, `placement`, `style`, `payload`, `content`, `actions`, `slots` |

### 3.1 Elemente

Pflicht-Katalog v1: `text`, `image`, `document`, `gallery`, `documents`.
Zusätzlich verfügbar: `hero`, `callout`, `external-link`, `divider`, `finder-notice`, `finder-form`, `contact-channel`, `maintenance-history` (optional), `theme-assets` (intern, ausgeblendet).

`elementId` folgt `^cel_[A-Za-z0-9_-]{1,120}$`, `slotId` `^[a-z][a-z0-9-]{0,31}$`.

**Item-Fähigkeit (`items`)** – Pflichtfeld jedes Elements seit `schemaVersion 4`:

```json
{ "items": { "mode": "dynamic", "slotIds": ["images"] } }
```

| `items.mode` | Bedeutung beim Publish |
| --- | --- |
| `dynamic` | Element erhält eine Zeile in `tag_content_elements` und kann `tag_content_element_items` aufnehmen (Galerie, Dokumentenliste, Wartungshistorie, Fund-Formular, Einzelbild, Einzel-Dokument, später Chat). |
| `none` | Kein Item, keine Elementzeile: Der Inhalt steht ausschließlich im Tag-Dokument (Text, Hinweis, Trenner, externer Link, Kontaktweg, Hero, Theme-Assets). |

Der Wert ist eine **Katalog-Eigenschaft** und wird je Elementtyp fest vorgegeben (`text`/`callout`/… = `none`; `gallery`/`documents`/`maintenance-history`/`finder-form`/`image`/`document` = `dynamic`). `slotIds` bindet die Slots, die Items aufnehmen; leer ist zulässig, wenn die Items aus einem Subsystem stammen (Chat).

**Anzeigeform** (abgeleitet, kein eigenes Feld): `image` und `document` zeigen genau **ein** Item – das neueste sichtbare. Der Owner lädt mehrere Kandidaten hoch und steuert über die Sichtbarkeit (`public`/`ownerOnly`), welches Bild beziehungsweise Dokument erscheint. `gallery`, `documents`, `maintenance-history` und `finder-form` zeigen alle sichtbaren Items.

### 3.2 Slots und Aktionen

- **Slots** beschreiben Medienplätze (`slotId`, `accepts`, `min`, `max`, `required`, `presentation`) – nie konkrete Dateien. Bei `items.mode: "dynamic"` sind sie die Aufnahmeplätze der Items; `items.slotIds` verweist auf sie.
- **Einzelbild/Einzel-Dokument** erlauben mehrere Kandidaten (`max: 12`), angezeigt wird genau eines.
- **Aktionen** (`upload`, `download`, `delete`) sind Anträge: `principals` (`scanner`, `guest`, `owner`), `maxItemsPerPrincipal`, `maxFileSizeMb`, `afterUpload: quarantine`, `guestScope: ownOnly`.
- Ein Template kann Rechte **einschränken**, nie erweitern.

### 3.3 Text (Runs-Modell)

Text ist ein **Runs-Modell**, kein HTML und kein Markdown. Zeichen- und Absatzformatierung werden als geschlossene Tokens gespeichert. Jede Zeile kann Überschrift sein (Ebene 1–5); Tabellen sind eigene Blöcke:

```json
{
  "paragraphs": [
    { "heading": 2, "runs": [{ "text": "Bestand" }] },
    {
      "runs": [
        { "text": "Bitte beachten: " },
        { "text": "wichtig", "marks": [{ "type": "bold" }], "color": "#b3261e", "background": "#fff3cd",
          "fontSize": 18, "fontFamily": "serif", "link": { "href": "https://example.org" } }
      ],
      "align": "center",
      "lineHeight": 1.5,
      "indent": 1,
      "list": { "kind": "bullet", "level": 0 }
    },
    {
      "type": "table",
      "columns": [{}, { "align": "end" }],
      "rows": [
        { "header": true, "cells": [{ "text": "Fach" }, { "text": "Standort" }] },
        { "cells": [{ "text": "Roman" }, { "text": "A-12" }] }
      ]
    }
  ]
}
```

| Feld | Werte | Bedeutung |
| --- | --- | --- |
| `run.marks[].type` | `bold`, `italic`, `underline` | Zeichenauszeichnung |
| `run.color` | `#rrggbb` | Zeichenfarbe |
| `run.background` | `#rrggbb` | Markierung (Hintergrund des markierten Textes) |
| `run.fontSize` | `12, 14, 16, 18, 20, 24, 28, 32` | Schriftgröße in px |
| `run.fontFamily` | `sans`, `serif`, `mono` | gemappte Font-Stacks, keine freien Namen |
| `run.link.href` | `https://…` oder `mailto:…` | Allowlist, `rel="noopener noreferrer nofollow"` |
| `paragraph.heading` | `1…5` | Zeile ist Überschrift (nicht zusammen mit `list`) |
| `paragraph.align` | `start`, `center`, `end` | Ausrichtung |
| `paragraph.lineHeight` | `1, 1.15, 1.3, 1.5, 1.75, 2` | Zeilenabstand |
| `paragraph.indent` | `0…3` | Einrückung ohne Liste |
| `paragraph.list` | `kind: bullet\|ordered`, `level: 0…3` | Aufzählung/Nummerierung |
| `block.type = "table"` | `columns[]`, `rows[]`, `border?` | Tabelle; Zellen tragen **Runs** (Inline wie Absätze) und optionalen Zellhintergrund; ein **globaler** Gitterrahmen |
| `cell.runs` | `TextRun[]` | Zellinhalt: Text, `\n`, Marks, `color`, `background` (Textmarkierung), Link – keine Absätze/Listen |
| `cell.background` | `#rrggbb` | **Zellfläche** (nicht zu verwechseln mit `run.background` = Textmarkierung) |
| `table.border` | `{ color, style, width }` | Gitterrahmen: `solid`/`dashed`/`dotted`/`double`, `1`/`2 px` – gilt für alle Zellkanten |

Regeln:

- **Kein HTML im Artefakt.** Der Export enthält ausschließlich Tokens; `style`-/`class`-Strings gibt es nicht.
- **HTML ist Text.** Tippt jemand `<b>Hallo</b>`, erscheint das wörtlich und wird nie interpretiert (kein `innerHTML`, kein `dangerouslySetInnerHTML`; per Architektur-Test erzwungen).
- **Paste ist ein Konverter:** Eingefügtes HTML wird auf die Tokens abgebildet (nur erlaubte Werte); Unbekanntes wird verworfen. Aktive Bestandteile (`<script>`, `on*`, `javascript:`) werden vorher entfernt. Eingefügtes **Markdown** wird über `markdown-it` (`html: false`) gelesen und ebenfalls auf Tokens abgebildet.
- **`javascript:` ist verboten** – als Link-Ziel ein Fehler, als Text ein Fehler (Defense in Depth).
- Farben nur `#rrggbb`; Schriftgrößen nur aus der Skala; Ausrichtung/Zeilenabstand nur aus den Enums.
- **Weicher Zeilenumbruch** (`Shift+Enter`) bleibt im selben Absatz und wird als `"\n"` im Run-Text gespeichert (kein zusätzlicher Block, keine neue Zeile mit Absatzabstand).
- Absätze/Blöcke je Element: höchstens 16 (Listeneinträge und Tabellen zählen mit), Text je Absatz höchstens 2048 Zeichen.
- **Tabellen:** max. 6 Spalten, 20 Zeilen, 200 Zeichen je Zelle, 2 Tabellen je Textfeld; Ausrichtung je Spalte; Kopfzeile markiert. Zellen tragen **Inline-Runs wie Absätze** (Text mit `\n`, fett/kursiv/unterstrichen, Textfarbe, Text-Hintergrund, Links) – aber keine Absätze, Listen oder Bilder. Drei Farbebenen bleiben getrennt: `cell.background` (Fläche), `run.color` (Schrift), `run.background` (Markierung). Der Gitterrahmen gilt **global** für die Tabelle (bewusste Entscheidung `D-47`: Einzelkanten je Zelle sind in CSS mit `border-collapse` nicht konfliktfrei darstellbar).
- **Eigene Farben** der Formatierleiste liegen in `palette.custom` (max. 24, `#rrggbb`) und werden mit der Konfiguration gespeichert.
- **Dateigröße:** höchstens **128 kB** (kanonisch, `LIMIT_DOCUMENT_BYTES`). Das Budget reicht für zwei volle Tabellen (6 × 20) mit Rahmen und Zellhintergründen plus Text (`D-50`).
- **`heading` auf Inhaltsebene** (`content.heading`) gehört zu schemaVersion 1; die Migration überführt es in einen Absatz mit `heading: 3` (siehe §6).


---

## 4. Dateiarbeit: Load / Save / Save as

| Aktion | Verhalten | Kürzel |
| --- | --- | --- |
| **Load** | Datei öffnen, Version prüfen, migrieren, validieren, laden | `Strg+O` |
| **Save** | in **dieselbe** Datei schreiben (vorhandenes Handle) | `Strg+S` |
| **Save as** | neuen Speichern-Dialog öffnen, neue Datei anlegen | `Strg+Shift+S` |
| **Download** | zusätzlicher Notausgang: Datei immer als Download | – |

Technik: **File System Access API** (`showOpenFilePicker`, `showSaveFilePicker`). Das Handle wird im Speicher und in `IndexedDB` gehalten; nach einem Neustart ist eine erneute Berechtigungsabfrage nötig.

**Fallback:** Firefox/Safari unterstützen die API nicht. Dort wird `Save` zum Download und `Load` zum Datei-Dialog; die Oberfläche weist ausdrücklich darauf hin.

Weitere Regeln:

- `Save` ist deaktiviert, solange L1–L3 Fehler melden.
- Ungespeicherte Änderungen lösen einen `beforeunload`-Hinweis aus.
- Ohne Handle verhält sich `Save` wie `Save as`.
- Kanonische Ausgabe: sortierte Schlüssel, 2 Leerzeichen, LF, abschließender Umbruch; der SHA-256 wird angezeigt, aber nicht gespeichert.

---

## 5. Vorlagen und Default-Bibliothek (Golden Files)

Beim Start lädt das Tool Dateien aus `public/`:

| Datei | Zweck |
| --- | --- |
| `public/templates/vault-standard.tagcontent.json` | Startdokument und Vorlage „Vault – Standard" |
| `public/templates/lost-found-standard.tagcontent.json` | Vorlage „Lost & Found – Standard" |
| `public/elements/default.tagelements.json` | Default-Bibliothek mit Gallery-, Documents- und Wartungs-Baustein |

Diese Dateien sind **zugleich** die Golden Files der Tests. Änderungen daran sind bewusste Versionserhöhungen (`templateVersion`/`libraryVersion`), keine Testanpassungen.

### Beispiele (`public/templates/examples`)

Zusätzlich liegen vier **Beispiel-Templates** mit Testdaten bei. Sie sind vollständige, valide v3-Templates und dienen als Testkörper für die spätere TAG-App-Anbindung:

| Beispiel | TAG-Typ / Presentation | Inhalt |
| --- | --- | --- |
| `wedding-garden` | `event` / `wedding` | Hero mit Cover, Willkommen, Einzelbild, **Ablauf** und **Speisekarte** als Tabellen, Gästegalerie mit Upload, Dokumente (`shared`), Kontakttext |
| `wedding-party` | `event` / `wedding` | Dunkles Theme, Dresscode-Hinweis, **Getränkekarte** als Tabelle, Partyfotos (nur Download), Ablaufplan, externer Link (Playlist) |
| `lost-found-luggage` | `lost-found` / `standard` | Fundhinweis, Fundmeldung mit Foto-Slot, **Funddaten** als Tabelle, Datenschutz-Hinweis, Kontaktweg (`shared`) |
| `maintenance-heat-pump` | `maintenance` / `standard` | Wartungshistorie mit Dokumenten, **Wartungstabelle**, Typenschild, Sicherheitshinweis, Prüfprotokolle (`shared`) |

Struktur je Beispiel:

```text
public/templates/examples/<id>/
├── template.tagcontent.json   vollständiges Template (schemaVersion 3)
├── sample.json                Beispieldaten (Medien, Dokumente, Einträge, Beiträge, slotFill)
└── README.md                  Zweck, Datenlage, Prüfpunkte
```

`public/templates/examples/index.json` ist das **Manifest** (`myqr24-tag-content-examples-v1`). Es wird beim Start geladen; fehlt oder bricht es, bleibt das Tool mit den beiden Standardvorlagen benutzbar. Die Pfade im Manifest sind auf `/templates/examples/<id>/…` begrenzt (`parseExampleIndex`), damit ein Manifest keine beliebigen Dateien lädt.

**Beispieldaten sind Editor-Kontext, kein Artefakt** (`D-60`): Sie werden nie in `.tagcontent.json` geschrieben (keine Bildpfade, keine Storage-Keys im Template) und beim Laden einer anderen Vorlage oder von einer Datei verworfen. Medienpfade in `sample.json` sind auf `/…` oder `https://…` beschränkt (`data:` wird abgewiesen); die Vorschau rendert sie als `<img>` mit `alt` aus den Daten.

**Terminplan und Speisekarte** sind bewusst **Tabellen in Textfeldern** (max. 2 Tabellen je Feld, 6×20): Das hält die Beispiele bei `schemaVersion 3`. Ein eigenes `schedule`/`menu`-Element wäre ein Schema-Bump und braucht zuerst einen Blocktyp im Content-Vertrag.

Die Assets unter `examples/assets/*.svg` sind selbst erzeugte Platzhalter (offline, keine externen Dienste, keine neuen Dependencies).

Bibliotheksarbeit:

- `Load` merged eine Bibliotheksdatei (neue ID ergänzen, höhere Version ersetzen, gleiche Version melden, ältere ignorieren).
- `Save` schreibt in dieselbe Datei und erhöht `libraryVersion` um 1.
- `Save as` erzeugt eine neue Datei; `Default` lädt die mitgelieferte Bibliothek erneut, ohne Dateien zu überschreiben.

---

## 6. Versionen und Migration

Drei getrennte Achsen:

| Achse | Bedeutung |
| --- | --- |
| `toolVersion` | Version des Werkzeugs (nur informativ) |
| `schemaVersion` | Format der Datei, steuert die Migrationskette |
| `templateVersion` | fachliche Version der Vorlage |

Ladepipeline: lesen → `schema` prüfen → `schemaVersion` vergleichen → Migration (kumulativ, pur) → Defaults → Validierung → laden.

| Fall | Verhalten |
| --- | --- |
| gleiche Version | unverändert laden |
| ältere Version, Stufe vorhanden | migrieren, Änderungen protokollieren |
| ältere Version, Stufe fehlt | harter Fehler `MIGRATION_STEP_MISSING` |
| neuere Version | harter Fehler `SCHEMA_TOO_NEW` („Tool aktualisieren") |
| unbekanntes `schema` | harter Fehler `SCHEMA_UNKNOWN` |
| unbekannte Felder | Warnung, Feld wird verworfen (`x-`-Präfixe bleiben) |

Bei blockierenden Fehlern öffnet das Tool die Datei im **Reparaturmodus** (lesend), damit das störende Element gelöscht werden kann. Es gibt keinen stillen „Best effort"-Import.

Migrationsstufen liegen in `src/domain/migrate.ts`:

| Stufe | Inhalt |
| --- | --- |
| `1 → 2` | `content.heading` (eine Überschrift am Feldanfang) wird zum ersten Absatz mit `heading: 3`; Feld wird entfernt. Danach sind Überschriften Absatz-Attribute und damit beliebig positionierbar (H1–H5). |
| `2 → 3` | Tabellenzellen werden von `cell.text` auf `cell.runs` umgestellt (`{ text }` → `runs: [{ text }]`, leerer Text → `runs: []`). Damit sind Textfarbe/Text-Hintergrund/Marks/Links in Zellen möglich; `cell.background` bleibt unverändert. |
| `3 → 4` | Jedes Element erhält `items` mit dem Katalog-Standard (`dynamic` für Galerie/Dokumentenliste/Wartungshistorie/Fund-Formular/Einzelbild/Einzel-Dokument, sonst `none`). Rein additiv, keine Inhalte werden verändert. |

---

## 7. Validierung (L1–L3)

| Stufe | Inhalt |
| --- | --- |
| **L1 strukturell** | Pflichtfelder, Typen, Enums, Muster, Längen, Limits |
| **L2 semantisch** | eindeutige `elementId`/`displayOrder`/`slotId`, Typ↔TAG-Typ-Kompatibilität, `min <= max`, bekannte Binding-Quellen, Platzierungsbereiche |
| **L3 Policy** | kein gespeichertes HTML (Markup im Text ist nur eine Warnung, weil es als Text erscheint), kein `javascript:`/`data:`/`url(...)`/`on*=`-Muster, keine Storage-Keys, Farben nur `#rrggbb` oder Palettentoken, Schriftgrößen/Abstände nur aus den Skalen, Links nur `https:`/`mailto:`, Gesamtgröße ≤ 48 KiB |

Fehler blockieren `Save`/`Save as`; Warnungen nicht. Jeder Befund hat `code`, `path`, `message` und optional `hint`.

Wichtige Codes (Auszug): `SCHEMA_UNKNOWN`, `SCHEMA_TOO_NEW`, `MIGRATION_STEP_MISSING`, `ELEMENT_ID_DUPLICATE`, `ELEMENT_ORDER_DUPLICATE`, `ELEMENT_TYPE_NOT_ALLOWED`, `ELEMENT_ITEMS_MISSING`, `ELEMENT_ITEMS_INVALID`, `ELEMENT_ITEMS_MODE_INVALID`, `ELEMENT_ITEMS_NOT_SUPPORTED`, `ELEMENT_ITEMS_MODE_MISMATCH`, `ELEMENT_ITEMS_SLOT_UNKNOWN`, `ELEMENT_ITEMS_SLOT_DUPLICATE`, `ELEMENT_ITEMS_SLOT_UNBOUND` (Warnung), `SLOT_RANGE_INVALID`, `BINDING_SOURCE_UNKNOWN`, `POLICY_HTML_MARKUP` (Warnung), `POLICY_SCRIPT_URL`, `THEME_COLOR_INVALID`, `CONTENT_RUN_COLOR_INVALID`, `CONTENT_RUN_FONT_SIZE_INVALID`, `CONTENT_RUN_FONT_FAMILY_INVALID`, `CONTENT_RUN_LINK_INVALID`, `CONTENT_PARAGRAPH_ALIGN_INVALID`, `CONTENT_PARAGRAPH_LINE_HEIGHT_INVALID`, `CONTENT_PARAGRAPH_INDENT_INVALID`, `CONTENT_LIST_INVALID`, `LIMIT_DOCUMENT_BYTES`, `ACTIONS_OWNERSHIP_UNPROVEN` (Warnung).

Bekannte, dokumentierte Abweichung: `guestScope: ownOnly` ist derzeit eine **Warnung**, kein Blocker, weil die tag-api noch keine Eigentumsbindung besitzt (Refinement `D-23`).

---

## 8. Layout, Theme und Darstellung

- **12-Spalten-Grid mit Flusslayout**; effektive Spalten `C = clamp(1, floor(Breite / minColumnWidth), preferredColumns)`. `placement.span` ist ein **Anteil am Raster** (12): effektiver Span `S = max(1, round(span / 12 * C))`. Beispiel: 8 und 4 ergeben bei drei Spalten 2 + 1, bei sechs Spalten 4 + 2 – die Vorlage bleibt also bei jeder Spaltenzahl verhältnismäßig.
- **Vorschau = Breite × Spaltenmodus.** Die Breite (`Handy 320/360/390/430`, `Tablet 768/1024`, `Web 1280/1440`, `Fit`) und der Schalter **Compact** sind unabhängig voneinander:
  - `Compact` an (Default): mehrspaltig, so viele Spalten wie `minColumnWidth`/`preferredColumns` zulassen – das ist die echte Ausgabe.
  - `Compact` aus („Untereinander"): alle Elemente in einer Spalte, volle Breite; Spans werden bewusst ignoriert und die Vorschau trägt den Hinweis „Alle Elemente untereinander – nicht die echte Ausgabe". Das ist reine Editor-Ansicht, wird nie im Dokument gespeichert (Kürzel `Strg+Shift+E`, Zustand in `localStorage`).
  - Die Kopfzeile nennt immer `Breite · Gerät · Modus · Spalten`; die Layout-Hinweise beziehen sich weiterhin auf die **mehrspaltige** Ausgabe.
- **Vorschau-Breiten (mobil-first)**: `Fit` misst den verfügbaren Platz im Vorschaubereich (`ResizeObserver`) und zeigt die Vorschau ohne Scrollbalken. Die gewählte Breite wird in `localStorage` gemerkt; der Inspektor folgt dem **angezeigten** Breakpoint.
- **Beispieldaten und Rollen** (`D-61`): Wird ein Beispiel geladen, erscheinen in der Kopfzeile der Schalter **Beispieldaten** und die **Rolle** (`Gast`, `Owner`, `Scanner`). Damit füllt die Vorschau Slots mit echten Bildern, Dokumenten und Galeriebeiträgen und zeigt Wartungseinträge samt Jahresgruppen. Der Zustand liegt nur im Browser (`myqr24.tcd.sampleData`, `myqr24.tcd.sampleRole`); das Template bleibt unverändert.
  - Sichtbarkeit folgt `40-TAG-APP-DATA-MODEL` §4: `public` für alle, `shared` nur für Gast/Owner, `private`/`ownerOnly` erscheinen **nur im Editor** mit dem Hinweis, dass die Content-Route sie nicht ausliefert.
  - Das Element bleibt in der Vorschau **bedienbar** (Inspector/Formatierung); die Rolle wirkt auf den **Inhalt** (Dokumentliste, Galerie, Hinweis), nicht auf die Auswahl.
  - Galeriebeiträge: freigegebene Bilder für alle, eigene `pending` zusätzlich für den Gast, alle `pending` für den Owner – jeweils mit Vermerk „wartet auf Freigabe".
  - **Keine Mutationen**: Upload, Löschen und Freigeben werden in der Vorschau nicht simuliert (das ist Aufgabe der TAG-App-Simulation).
- **Layout-Hinweise** unter der Vorschau (max. 4, unverbindlich, nie blockierend): zu schmale Spalten (< 12 rem), zu kleine Basisschrift (< 14 px auf dem Handy), Tabellen mit mehr als 3 Spalten auf dem Handy, sehr lange Handy-Kacheln.
- Berechnung zur Renderzeit (`ResizeObserver`), kein fester Gerätemodus; Rotation ergibt sich aus der Breite.
- **Texte werden nie abgeschnitten**: kein `ellipsis`, keine Höhenklemmung, `overflow-wrap: anywhere`.
- Theme-Tokens: `background`, `surface`, `text`, `mutedText`, `heading`, `accent`, `accentText`, `border`, optional `danger`, `success`; Farben als `#rrggbb` oder Token.
- Element-Overrides: Hintergrund, Text-/Überschriftenfarbe, Innenabstand.
- Vorschau zeigt Platzhalter für Medien (Slot-Hinweise), niemals echte Inhalte.

### 8.1 Direktes Editieren und RTF-Leiste

- Text, Hinweis, Titelbereich, Fundhinweis, Fundformular und Kontaktweg sind in der Vorschau direkt editierbar; Galerie- und Dokumenten-Überschriften bleiben lesend.
- Fokus im Textfeld → Leiste **oberhalb** des Feldes, in Gruppen:

| Gruppe | Funktionen |
| --- | --- |
| Absatzstil | **Text** oder **Überschrift 1–5** (`#`-Kürzel, `Strg+Alt+1…5`, `Strg+Alt+0` = Text) |
| Schrift | Familie (`Standard`/`serif`/`sans`/`mono`) und **Größe als natives Zahlenfeld** (Pfeile erscheinen beim Fokussieren/Hover) – wirken nur auf den markierten Text |
| Zeichen | **B**, *I*, U̲ (`Strg+B/I/U`) als Symbolknöpfe |
| Farben | **A** mit Farbbalken (Zeichenfarbe), **Marker** (Text-Markierung), **Farbeimer** (Box-Hintergrund) – jeweils mit Farbmenü |
| Absatz | linksbündig, zentriert, rechtsbündig, Zeilenabstand (6 Stufen) |
| Listen | Aufzählung (`Strg+Shift+8`), Nummerierung (`Strg+Shift+7`), einrücken, ausrücken (Symbolknöpfe) |
| Tabelle | **Tabelle mit 2 Spalten** einfügen (Kopfzeile + Datenzeile); `Tab` springt zur nächsten Zelle, am Tabellenende entsteht eine neue Spalte (bis 6), danach eine neue Zeile (bis 20), `Shift+Tab` rückwärts |
| Link | setzen/ändern (`Strg+K`, Inline-Feld mit Validierung), entfernen |
| Reset | Zeichen- und Absatzformatierung entfernen |
| MD / JSON | öffnen ein **Panel unter dem Feld** (Markdown ein-/ausgeben bzw. JSON anzeigen); erneuter Klick auf denselben Knopf, jede andere Formatierung oder „Schließen" blendet es wieder aus |

**Anzeige folgt der Auswahl:** Das Absatzstil-Feld zeigt `Text`/`Überschrift n`, die Listenknöpfe sind aktiv, und Schrift/Größe zeigen immer den **Ist-Wert** am Cursor bzw. in der Markierung. Ohne gesetztes Zeichen-Mark steht im Schriftfeld `Standard` und im Größenfeld die effektive Standardgröße (gestrichelter Rahmen); erst eine Änderung setzt das Mark.

**Auswahlregel (Schriftgröße & Co.):** Formatiert wird ausschließlich der **markierte Text**. Die Markierung bleibt beim Bedienen der Leiste sichtbar (dezente grüne Merk-Dekoration) und wird bei der nächsten Aktion weiter verwendet – auch wenn ein Auswahlfeld den Fokus nimmt. Steht der Cursor ohne Auswahl, wird nur die nächste Eingabe vorformatiert (Word-Verhalten); ein **Klick in den Text** löscht den Merker, damit keine alte Spanne „wiederauflebt".

**Farbmenü** (Word-nah, je Farbknopf):

| Abschnitt | Inhalt |
| --- | --- |
| Theme | Farben des TAG-Rahmens (`background`, `surface`, `text`, `mutedText`, `heading`, `accent`, `accentText`, `border`, `danger`, `success`) |
| Standard | 24 feste Farben (Graustufen + kräftige/gedeckte Töne) |
| Eigene Farben | selbst gespeicherte Farben; **＋ Eigene** fügt die aktuelle Farbe hinzu, **×** entfernt sie wieder |
| RGB | freier Farbwähler + Hex-Feld (wie zuvor), „✓" übernimmt, „＋ Eigene" speichert zusätzlich |

- Eigene Farben landen in `palette.custom` im Dokument und werden mit `Save`/`Save as` in der Konfigurationsdatei gespeichert.
- Die zuletzt bearbeitete Konfiguration wird zusätzlich lokal als **„letzte Konfiguration"** gehalten und beim Start/Reload geladen (siehe §8.4).
- Die Leiste bleibt beim Bedienen offen (Fokus wird am gesamten Editor-Block erkannt), damit der Farbwähler die Auswahl nicht zerstört.
- Schriftgröße/-familie und Farben wirken auch dann auf den markierten Text, wenn der Klick ins Auswahlfeld dem Editor den Fokus genommen hat (die letzte markierte Spanne wird wiederhergestellt).
- Rechts bleibt der Text als **bearbeitbare JSON-Kontrolle** (§9); bearbeitet wird sonst ausschließlich in der Vorschau.
- Tipp-Bursts werden im Undo-Stack gebündelt (350 ms Commit + `coalesce`), strukturelle Änderungen bleiben einzeln rückgängig.
- Im Feld gilt die Undo-Historie des Editors; außerhalb (`Strg+Z`) die Dokument-Historie des Tools.

### 8.2 Reihenfolge

- Sortiert wird in der Vorschau nach `placement.order[breakpoint] ?? displayOrder`. `moveElementInDoc` tauscht daher **beides** – `displayOrder` und `placement.order` für alle Breakpoints –, damit die neue Reihenfolge sofort sichtbar ist.
- Ausgeblendete Elemente (`hidden`, z. B. `theme-assets`) sind von der Sortierung ausgenommen und bleiben verankert.

### 8.3 Listen, Einrückung und Absätze

- Listen werden **flach** gespeichert (`paragraph.list.kind` + `level`) und beim Rendern zu verschachtelten `<ul>/<ol>` gruppiert (`groupBlocks`). Ein Sprung von Ebene 0 auf 3 wird auf 1 normalisiert; die Gruppierung ist deterministisch.
- Ein Absatz gehört zu höchstens einer Liste; ein Wechsel der Listenart oder ein Absatz ohne `list` beendet die Liste.
- Einrückung ohne Liste läuft über `paragraph.indent` (0–3) und wird als `padding-left` gerendert; in Listen übernehmen `sinkListItem`/`liftListItem` die Ein-/Ausrückung.
- Ausrichtung, Zeilenabstand und Einrückung sind Absatzattribute – sie wirken auf alle Absätze der Auswahl.
- **Shift+Enter** erzeugt einen weichen Umbruch im **selben** Absatz (`hardBreak` im Editor, `"\n"` im Modell); die Vorschau rendert ihn mit `white-space: pre-wrap`.

### 8.4 Letzte Konfiguration (Session)

- Bei jeder Änderung wird das Dokument entprellt (800 ms) lokal als **kanonisches JSON** unter `myqr24.tcd.session.v1` abgelegt.
- Beim Start bzw. nach einem Reload wird dieser Stand geladen, migriert und geprüft; **blockierende** Befunde oder unlesbare Daten fallen auf die ausgelieferte Vorlage zurück.
- Die Statuszeile weist darauf hin („Letzte Konfiguration geladen (zuletzt verwendet · Datum, Zeit)").
- Der lokale Stand ersetzt **nicht** das Speichern in der Konfigurationsdatei: `Save`/`Save as` schreiben weiterhin `.tagcontent.json` (inkl. `palette.custom`).
- Panels merken sich ihre Breiten getrennt (`myqr24.tcd.leftWidth`, `myqr24.tcd.rightWidth`).

### 8.5 Markdown: Kürzel, Paste, Ein-/Ausgabe

Markdown ist **Eingabe- und Ausgabeformat**, nie Speicherformat (`D-40`). Das Modell bleibt JSON; Markdown erzeugt und liest Tokens.

| Kürzel / Eingabe | Ergebnis |
| --- | --- |
| `# ` … `##### ` am Zeilenanfang | Überschrift 1–5 (`###### ` bleibt Text) |
| `- ` / `* `, `1. ` | Aufzählung / Nummerierung (auch verschachtelt) |
| `**fett**`, `*kursiv*` / `_kursiv_` | Marks `bold`, `italic` |
| `[Text](https://…)` | Link (nur `https`/`mailto`; andere Protokolle bleiben Text) |
| Tabellen (`\| A \| B \|` + Ausrichtungszeile `\|:--\|--:\|`) | Tabellenblock mit Kopfzeile und Spaltenausrichtung |
| Einfügen von Markdown-Text | automatisch, wenn der eingefügte Klartext nach Markdown aussieht (`#`, `- `, `1. `, `**`, Tabelle …) – über `markdown-it` (`html: false`) in Tokens übersetzt |
| **MD**-Knopf | Dialog „Markdown einfügen oder exportieren" (Vorschau, Warnhinweise, Kopieren) |

- HTML im Markdown wird **nie interpretiert**, sondern als Text übernommen (`html: false`).
- Nicht abbildbare Auszeichnungen (Code, Durchstreichen, Bilder, Trennlinien, Zitate) werden zu Text bzw. verworfen – der Dialog nennt die Punkte.
- Der Export enthält nur Struktur; Farben, Markierungen und Schriftgrößen sind nicht Teil von Markdown (Hinweis im Dialog).
- „Übernehmen" **ersetzt** den Feldinhalt (per Undo rückgängig zu machen); es gibt keinen dauerhaften Markdown-Modus.

### 8.6 JSON-Panel (Anzeige)

- Der Knopf **JSON** zeigt das Runs-Modell des Felds in einem Panel unter dem Feld (`readOnly`, scrollbar, mit „Kopieren" und „Schließen").
- Das Panel ist **lesend**: schreibende Kontrolle bleibt die Textkontrolle in der rechten Spalte und die Formatierleiste. Damit gibt es nur eine Schreibstelle pro Feld.
- Markdown- und JSON-Panel sind **exklusiv**: ein Knopf öffnet, derselbe Knopf oder jede andere Formatierung schließt; „Schließen" bleibt in beiden Panels.
- Die Anzeige folgt dem Modell live (jede Änderung im Feld aktualisiert das JSON).

### 8.7 Tabellen: Gitter, Hintergrund und Hilfslinien

- **Editor-Hilfslinien:** Zellen tragen im Editor immer ein dezentes gestricheltes Gitter (plus Mindesthöhe und Hervorhebung der aktiven Zelle). Das ist reine Editor-Hilfe, kein Token und kein Export.
- **Vorschau = Druckansicht:** Dort erscheinen nur **gespeicherte** Rahmen; eine Tabelle ohne Rahmen bleibt linienlos.
- **Gitter-Toolbox** (Knopf „Tabellen-Gitter und Hintergrund", erscheint in der Leiste bei Cursor in einer Tabelle):
  - **Rahmen:** Farbe (Theme/Standard/eigene + RGB), Stil (`solid`/`dashed`/`dotted`/`double`), Stärke (1/2 px), „Rahmen anwenden"/„Rahmen aus" – gilt für die **ganze** Tabelle. Neue Tabellen starten mit dem aktuell eingestellten Rahmen (Default: Theme-Rahmenfarbe, durchgezogen, 1 px) und sind damit sofort sichtbar gerahmt.
  - **Zellhintergrund:** Ziel `Auswahl`/`Zelle`/`Zeile`/`Spalte`/`ganze Tabelle`, Farbe aus der Palette (oder frei), „Hintergrund entfernen". Das Ziel `Spalte` wirkt auf die **Cursor-Spalte** – ganz ohne mehrzeilige Auswahl.
  - **Textfarbe und Text-Hintergrund:** wirken auf die **Textauswahl** in der Zelle; ohne Auswahl auf den **ganzen Zellinhalt** (Schriftfarbe `run.color`, Markierung `run.background`). Sie ändern den Zellhintergrund nie.
  - **Spalten:** „Spalte links einfügen" und „Spalte entfernen" arbeiten auf der **Cursor-Spalte** (alle Zeilen wachsen mit; Kopfzeilen bleiben Kopfzeilen). Die letzte Spalte bleibt immer stehen (Hinweis), maximal 6 Spalten.
  - **Formate:** `Standard` (1 px + Kopf-Hintergrund), `Kopfzeile` (Rahmen aus + Kopf-Hintergrund), `Zebra` (Rahmen aus, alternierende Zeilen), `Kräftig` (2 px + Kopf-Hintergrund), `Rahmenlos` (alles zurücksetzen).
- **Aufbau der Leiste:** drei Felder in der ersten Zeile (`Ziel`, `Rahmen`, `Stärke`, Labels brechen nie um), darunter je eine Zeile pro Farbe; die Labels `Rahmenfarbe`, `Zellhintergrund`, `Textfarbe`, `Text-Hintergrund` stehen **oben bündig** zur Swatch-Tabelle (10 Farben je Reihe).
- **Ziele ohne CellSelection:** Die Zielzellen werden aus der Textauswahl abgeleitet (Cursor = eine Zelle, Auswahl = berührte Zellen); zusätzlich schränkt das Ziel-Feld auf Zeile/Spalte/Tabelle ein. Fett/kursiv/unterstrichen und Links funktionieren in Zellen über die normale Leiste.
- **Tastatur:** `Tab` → nächste Zelle, am Tabellenende neue Spalte (bis 6), danach neue Zeile (bis 20); `Shift+Tab` rückwärts; `Enter` am Tabellenende → neue Zeile, `Enter` in der Zelle → weicher Umbruch (`\n`). Bei erreichten Limits erscheint ein kurzer Hinweis (`role="status"`).
- **Markdown:** Rahmen- und Zellhintergrundfarben sind nicht Teil von Markdown (Export warnt); Textfarben/Markierungen ebenso; **fett/kursiv/Links in Zellen** werden exportiert (Pipes maskiert), Zellumbrüche zu Leerzeichen.



---

## 9. Oberfläche

| Bereich | Inhalt |
| --- | --- |
| Kopfzeile | TAG-Typ + „Neu", Vorlagenauswahl, Load/Save/Save as/Download, Undo/Redo, Vorschau-Breiten (Handy/Tablet/Web + Fit) und der Schalter **Compact** (mehrspaltig ↔ untereinander) |
| Bibliotheksleiste | Name, `libraryVersion`, Anzahl Bausteine, Load/Save/Save as/Default |
| Links | Elementliste (sortieren, löschen, hinzufügen), JSON-Ansicht mit Größe und Hash; **Breite per Ziehgriff verstellbar** (220–680 px, in `localStorage` gemerkt) |
| Mitte | Live-Vorschau in der gewählten Breite (Handy/Tablet/Web oder `Fit`) und im gewählten Spaltenmodus (`Compact`/`Untereinander`), Kopfzeile mit Breite · Gerät · Modus · Spalten, klickbare Elemente, **RTF-Textfelder mit Leiste** (Zeichen, Absatz, Listen, Schrift, Farben, Link); darunter die Layout-Hinweise |
| Rechts | Inspektor: Template-Rahmen, Farben, Layout, Element-Eigenschaften, Verhalten, Slots; **Breite per Ziehgriff verstellbar** (280–760 px, in `localStorage` gemerkt); Textkontrolle als **bearbeitbares JSON** (scrollbar, prüft beim Verlassen/„Übernehmen") |
| Unten | Validierungsliste mit Sprung zum betroffenen Element |

Tastenkürzel: `Strg+O` Load, `Strg+S` Save, `Strg+Shift+S` Save as, `Strg+Z`/`Strg+Shift+Z` Undo/Redo (im Textfeld bleibt das native Text-Undo aktiv), `Shift+Enter` weicher Umbruch, `Strg+B/I/U`, `Strg+K` Link.


---

## 10. Tests und Nachweise

`npm test` (Vitest) deckt ab:

| Datei | Inhalt |
| --- | --- |
| `validate.test.ts` | Golden Files fehlerfrei; doppelte IDs/Orders, Slot-Range, HTML, `javascript:`, Farben, Typ-Kompatibilität, unbekanntes Schema, Binding-Quellen, Ownership-Warnung |
| `serialize.test.ts` | kanonische Sortierung, Idempotenz, stabiler Hash, Dateinamen |
| `migrate.test.ts` | gleiche/neuere/fehlende Version, kumulative Stufe, fehlende `schemaVersion`, Zell-Migration `text` → `runs` |
| `library.test.ts` | Default-Bibliothek gültig, doppelte IDs, unbekannter Typ, Merge-Regeln, `libraryVersion` |
| `layout.test.ts` | Spalten bei 360/768/1280, Span als Rasteranteil (8/4 → 2/1 bei drei, 4/2 bei sechs Spalten), Spaltenmodus (`view: stacked` → eine Spalte, alle Spans 1, Reihenfolge unverändert), fehlende Platzierung, Sortierung, ausgeblendete Elemente |
| `layoutChecks.test.ts` | Layout-Hinweise: zu schmale Spalten, zu kleine Basisschrift, breite Tabellen auf dem Handy (mit Elementbezug), Obergrenze von vier Hinweisen, keine Fehlalarme auf breiten Ansichten |
| `bindings.test.ts` | erlaubte Quellen, Auflösung, Fallback, Flatten |
| `store.test.ts` | Reihenfolge sofort in der Vorschau sichtbar, `placement.order` je Breakpoint, Randfälle, Undo-Bündelung von Tipp-Bursts |
| `richtext.test.ts` | Link-Allowlist, Zusammenfassen von Runs mit allen Attributen, `groupBlocks` (Verschachtelung, Ebenen-Normalisierung), Präsentations-Mapping |
| `parseCss.test.ts` | Paste-Konvertierung: Hex/rgb → `#rrggbb`, px/pt/rem → Größenskala, Font-Stacks → Tokens, Ausrichtung, Zeilenabstand |
| `mapping.test.ts` | Modell → Editor-Dokument → Modell (Roundtrip), Marks/Attribute, Listen mit Ebenen, **weiche Zeilenumbrüche**, unsichere Links verworfen, kanonische Idempotenz, Tabellen mit Rahmen/Zellhintergrund sowie Textfarbe/Markierung/Marks/Links **in Zellen** |
| `schema.test.ts` | Schema enthält nur unsere Nodes/Marks (inkl. `hardBreak`), Überschrift ohne Marks, Listen + Einrücken, Absatz-Attribute, `richStyle`, `javascript:`-Links verworfen |
| `RichTextField.test.tsx` | Modell-Anzeige, Leiste erst bei Fokus, B/I/U, Ausrichtung, Zeilenabstand, Listen, Schriftgröße/-familie auf der Auswahl (auch nach Fokuswechsel und sichtbar als Merk-Dekoration), Ist-Anzeige von Schrift/Größe (`Standard` + Basisgröße), Tabellen-Einfügen mit sichtbarem Standardrahmen sowie Tab/Shift-Tab (neue Spalte, danach neue Zeile) und Enter (neue Zeile/Umbruch), Gitter-Toolbox (Rahmen, Zellhintergrund je Ziel inkl. Cursor-Spalte, Formate), Spaltenoperationen (links einfügen, Cursor-Spalte entfernen, Hinweis bei einer Spalte), Textfarbe/Text-Hintergrund **in Zellen** getrennt vom Zellhintergrund, MD-/JSON-Panels inkl. Umschalten/Schließen, Farbmenü (Theme/Standard/Eigene/RGB, hinzufügen/entfernen), Box-Hintergrund, Link-Validierung, weicher Umbruch, Commit bei Blur, Formatierung entfernen |
| `RichText.test.tsx` | Vorschau-Renderer: Listen/Ausrichtung/Einrückung, Link ohne Navigation, HTML-Markup nur als Text, unsichere Links verworfen, Tabellen (Gitterrahmen über CSS-Variablen, Zellfläche vs. Text-Hintergrund vs. Schriftfarbe, Links in Zellen, linienlose Tabellen) |
| `markdown.test.ts` | Export/Import: Überschriften, Listen, Links, Tabellen (Marks/Links in Zellen, Pipe-Maskierung, Warnungen für Farben/Umbrüche), HTML als Text |
| `paste.test.ts` | Sanitizer entfernt Script/Style/iframe/`on*`/`javascript:` und lässt normale Formatierung stehen |
| `architecture.test.ts` | Quellscan: kein `innerHTML`/`dangerouslySetInnerHTML`/`getHTML()`/`eval`; Mapping enthält keine HTML-Pfade |
| `session.test.ts` | „Letzte Konfiguration": kanonisch speichern, unverändert laden, unbrauchbare Stände verwerfen, Speicher leeren |
| `markdown.test.ts` | Markdown → Modell (Überschriften 1–5/6, Marks, Links inkl. Ablehnung, Listen, Tabellen mit Ausrichtung, HTML nur als Text) und Modell → Markdown (Struktur, Maskierung, Warnungen, Stabiler Roundtrip) |
| `Inspector.test.tsx` | Textkontrolle als JSON: Anzeige des Runs-Modells, Übernahme gültiger Änderungen, Abweisung von kaputtem JSON und Regelverstößen |
| `examples.test.ts` | Beispiel-Manifest (gültig, feste Reihenfolge, fremde Pfade/doppelte IDs abgewiesen), alle vier Templates fehlerfrei validiert, ≤ 24 Elemente/≤ 128 kB, eindeutige IDs und Spans 1–12, Tabellenlimits (≤ 6 Spalten, ≤ 20 Zeilen, Zellen mit Runs, ≤ 200 Zeichen), Spaltenzahl je Breite (360 → 1, 1280 → 2/3), `slotFill` nur mit vorhandenen Elementen, Slots und Content-IDs |
| `sample.test.ts` | Beispieldaten lesen, fremdes Schema/doppelte IDs/`data:`-Pfade/unbekannte Beitrags-Medien abgewiesen; Rollenmatrix (`public`/`shared`/`private`/`ownerOnly` × `scanner`/`guest`/`owner`); Slot-Auflösung in Datenreihenfolge, unbekannte IDs werden ignoriert; Galeriebeiträge je Rolle; Wartungseinträge sortiert und nach Jahr gruppiert; Dokumentarten |
| `App.test.tsx` | End-to-End: Aufbau der Arbeitsfläche, Sortieren wirkt sofort in der Vorschau, Leiste mit allen Gruppen (inkl. Farbmenüs, Absatzstil, Größenfeld) beim Fokus, Vorschau-Breiten 320–1440 + `Fit` mit Statuszeile („Breite · Gerät · Modus · Spalten"), mitwanderndem Inspektor-Breakpoint, dem **Compact**-Schalter (untereinander, Badge, Spans 1, Persistenz in `localStorage`) sowie dem **Beispiel-Laden** (Bilder, Dokumente, Galeriezähler, „Beispiel (Gast)") inklusive Beispieldaten-Schalter und Rollenwechsel auf `Scanner` (`shared`-Inhalte ausgeblendet, Bilder bleiben) |

Nachweisstand: **239 Tests grün** (22 Dateien), `tsc --noEmit` fehlerfrei, `vite build` erfolgreich (856 kB JS / 20 kB CSS; gzip 283 kB / 4,9 kB).

---

## 11. Grenzen der ersten Version

- Die **Überschrift** ist jetzt frei formatierbar (auch Fett/Farbe/Größe); die Auszeichnung folgt der Absatzebene 1–5.
- **Tabellen-Gitter:** nur ein globaler Rahmen (Farbe/Stil/Stärke) und Zellhintergründe; **keine Einzelkanten je Zelle**, keine Spaltenbreiten, kein Zeilen-/Spalten-Merge, keine Absätze/Listen/Bilder in Zellen, keine Mehrspalten-Layouts in Zellen, keine Fußnoten, keine Bilder im Fließtext; Listen bis Ebene 3, Einrückung bis 3 Stufen.
- **Tabellenauswahl:** Es gibt keine freie Zell-/Spaltenmarkierung per Drag (kein CellSelection-Modell). Spalten werden über die **Cursor-Spalte** bearbeitet (Ziel `Spalte`, „Spalte links einfügen", „Spalte entfernen"); eine mehrzeilige Textauswahl bleibt rechteckig. Zeilenoperationen (einfügen/löschen/verschieben) sind nicht Teil der ersten Version.
- Eingefügte Formatierung wird auf die geschlossenen Tokens abgebildet – exotische Werte (z. B. `40 px`, `Comic Sans`) werden verworfen, nicht gerundet.
- Links nur `https:`/`mailto:`; keine relativen Ziele, keine Anchor-Links.
- **Markdown ist kein Speicherformat**: Export/Austausch nur strukturell (ohne Farben/Größen), Import ersetzt den Feldinhalt; kein dauerhafter Markdown-Modus, keine Markdown-Dateien als Quelle.
- Im Editor gilt die Editor-Historie, außerhalb die Dokument-Historie (kein gemeinsamer Undo-Stapel).
- Eigene Farben: max. 24; sie sind Teil der Konfigurationsdatei, hängen aber nicht am Theme.
- „Letzte Konfiguration" liegt im `localStorage` des Browsers (kein Schreiben in `public/`); für Weitergabe/Versionierung dient `Save`. Wird der Browser-Speicher geleert, startet das Tool mit der ausgelieferten Vorlage.
- Die JSON-Textkontrolle prüft dieselben Regeln wie die Gesamtvalidierung; sie ersetzt nicht das Editieren in der Vorschau (dort gilt die Formatierleiste).
- **Bezüge auf andere Elemente** (Galerie/Dokumente als Chip im Text) sind noch nicht umgesetzt: v1 deckt Texte, Überschriften, Listen, Links und Tabellen ab. Der Weg ist in der Refinement-Datei als `D-43` vorbereitet (typisierte Referenz, v1 nur Slots).
- Keine Slot-Anlage/-Löschung in der UI (nur `max` änderbar);
- keine Bearbeitung von `actions` über die UI (im JSON vorhanden und validiert);
- keine Theme-Voreinstellungen/Theme-Bibliothek;
- kein Drag-and-drop-Sortieren (Pfeiltasten; Tastatur-/DnD-Sortierung nach `TCD-US-004` folgt);
- **Beispieldaten sind Anzeige, keine Verwaltung:** In der Vorschau werden Upload, Löschen und Freigeben **nicht** simuliert; Galeriebeiträge und Wartungseinträge kommen fertig aus `sample.json`. Die Bedienung dieser Aktionen bleibt der TAG-App-Simulation vorbehalten.
- **Kein Compiler/keine zweite Wahrheit:** Die Vorschau rendert weiterhin elementbasiert (nötig für Inspector und Formatierung). Die spätere Content-Projektion (`PublicTagView`, `myqr24-tag-content-v2`) entsteht in einem eigenen, framework-freien Modul; die Beispiele sind dafür der Testkörper (`D-62`, offen).
- **`maintenance` als TAG-Typ** ist jetzt mit Beispiel (`maintenance-heat-pump`) belegt, aber weiterhin ohne ausgelieferte Wartungserfassung.
- Keine PDF-Seitendarstellung, kein Upload, keine Wartungserfassung (Refinement `OP-01`, `OP-02`, `OP-04`);
- keine Template-Verwaltung (`OP-13`);
- `maintenance` als TAG-Typ ist vorbereitet, aber ohne ausgelieferte Vorlage.

---

## 12. Editor-Technologie (Tiptap/ProseMirror)

| Punkt | Festlegung |
| --- | --- |
| Bibliothek | `@tiptap/react`, `@tiptap/core`, `@tiptap/pm` und 8 Extension-Pakete, **exakt 3.34.0** |
| Lizenz | MIT (Tiptap + ProseMirror), siehe [`../THIRD-PARTY.md`](../THIRD-PARTY.md) |
| Schema | `doc > (richHeading \| paragraph \| bulletList \| orderedList \| richTable)+`; `richHeading.level` 1–5; `richTable > richTableRow+ > richTableCell+` (Zellen `text*`); Marks `bold`, `italic`, `underline`, `link`, `richStyle` (Farbe/Markierung/Größe/Familie); `hardBreak` für weiche Umbrüche |
| Markdown | `markdown-it` 14 (`html: false`) als Tokenizer für Paste/Dialog; eigene Serialisierung für den Export (`src/rich/markdown.ts`) |
| Brücke | `src/rich/mapping.ts`: `contentToDoc` (Modell → Editor) und `docToContent` (Editor → Modell) – der **einzige** Weg; kein direkter DOM-Zugriff |
| Invariante | `docToContent(contentToDoc(x))` ist kanonisch gleich `x` (Roundtrip-Test, unsichere/ungültige Werte werden gedroppt) |
| Speicherung | Editor-JSON wird **nie** gespeichert; `getHTML()` ist per Architektur-Test verboten |
| Paste | `transformPastedHTML` (Sanitizer) + Schema-Parser; Ergebnis sind Tokens |
| Bündel | Tabellen-, Drop- und Gapcursor von Tiptap sind **nicht** im Build (Tabellen sind eigene, schlanke Nodes); Gesamtgröße 815 kB JS (272 kB gzip), offline ohne CDN |

---

## 13. Verweise

- Refinement: [`../../../docs/00-Refinement/tag-content-designer/tag-content-designer-refinement.md`](../../../docs/00-Refinement/tag-content-designer/tag-content-designer-refinement.md)
- TAG-Content-Projektion: [`../../../docs/10-Architecture/30-Data-Architecture/40-TAG-APP-DATA-MODEL.md`](../../../docs/10-Architecture/30-Data-Architecture/40-TAG-APP-DATA-MODEL.md)
- Access-Vertrag: [`../../../docs/10-Architecture/35-Contracts/tag-app-access-v1.md`](../../../docs/10-Architecture/35-Contracts/tag-app-access-v1.md)
- TAG-App: [`../../../apps/tag-app/`](../../../apps/tag-app/)
- Label-Designer (Vorbild): [`../../tag-designer/`](../../tag-designer/)








