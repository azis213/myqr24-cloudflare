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
  "elements": [ ]
}
```

| Block | Inhalt |
| --- | --- |
| `template` | `templateId`, `templateVersion`, `tagType`, `name`, `description`, `locale`, `status`, `compatibility` |
| `shell` | `presentation`, `features`, `theme` (Farben, Typografie, Layout), `navigation`, `statusBar` |
| `layout` | `mode: grid-flow`, `columns: 12`, `gap`, `container`, `responsive` (`autoReflow`, `minColumnWidth`, `preferredColumns`) |
| `editability` | Whitelist der später im User-Designer änderbaren Pfade + `limits` |
| `elements` | geordnete Elemente mit `elementId`, `elementType`, `displayOrder`, `visibility`, `placement`, `style`, `payload`, `content`, `actions`, `slots` |

### 3.1 Elemente

Pflicht-Katalog v1: `text`, `image`, `document`, `gallery`, `documents`.
Zusätzlich verfügbar: `hero`, `callout`, `external-link`, `divider`, `finder-notice`, `finder-form`, `contact-channel`, `maintenance-history` (optional), `theme-assets` (intern, ausgeblendet).

`elementId` folgt `^cel_[A-Za-z0-9_-]{1,120}$`, `slotId` `^[a-z][a-z0-9-]{0,31}$`.

### 3.2 Slots und Aktionen

- **Slots** beschreiben Medienplätze (`slotId`, `accepts`, `min`, `max`, `required`, `presentation`) – nie konkrete Dateien.
- **Aktionen** (`upload`, `download`, `delete`) sind Anträge: `principals` (`scanner`, `guest`, `owner`), `maxItemsPerPrincipal`, `maxFileSizeMb`, `afterUpload: quarantine`, `guestScope: ownOnly`.
- Ein Template kann Rechte **einschränken**, nie erweitern.

### 3.3 Text

Text ist ein **Runs-Modell**, kein HTML und kein Markdown:

```json
{ "heading": "Titel", "paragraphs": [ { "runs": [ { "text": "Hallo", "marks": [ { "type": "bold" } ] } ] } ] }
```

Erlaubte Marks: `bold`, `italic`, `underline`. Der Renderer baut daraus React-Elemente; `dangerouslySetInnerHTML` ist ausgeschlossen.

**Direktes Editieren:** Textfelder sind in der Vorschau selbst editierbar (`contentEditable`). Beim Fokus erscheint **darüber** eine Formatierungsleiste mit Fett/Kursiv/Unterstrichen sowie einer Vorder- und Hintergrundfarbe. Die Leiste schreibt ausschließlich in das Runs-Modell (Marks) bzw. in `style.textColor` / `style.background.color`; der Weg DOM → Modell ist `parseContentDom`, der Weg Modell → DOM ist `renderContentToDom` (beide ohne HTML-Strings). Farben wirken bewusst **am Element**, nicht als Inline-Span – so bleibt das Modell frei von CSS.

**Modellgrenze:** `fontSize` und `link` sind im Runs-Modell derzeit nicht vorgesehen. Textgröße entsteht über Überschriftenebene und Theme-Typografie, Links über das Element `external-link`.


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

Migrationsstufen liegen in `src/domain/migrate.ts`; aktuell existiert nur `schemaVersion 1`.

---

## 7. Validierung (L1–L3)

| Stufe | Inhalt |
| --- | --- |
| **L1 strukturell** | Pflichtfelder, Typen, Enums, Muster, Längen, Limits |
| **L2 semantisch** | eindeutige `elementId`/`displayOrder`/`slotId`, Typ↔TAG-Typ-Kompatibilität, `min <= max`, bekannte Binding-Quellen, Platzierungsbereiche |
| **L3 Policy** | kein HTML, kein `javascript:`/`data:`/`url(...)`/`on*=`-Muster, keine Storage-Keys, Farben nur `#rrggbb` oder Palettentoken, Gesamtgröße ≤ 48 KiB |

Fehler blockieren `Save`/`Save as`; Warnungen nicht. Jeder Befund hat `code`, `path`, `message` und optional `hint`.

Wichtige Codes (Auszug): `SCHEMA_UNKNOWN`, `SCHEMA_TOO_NEW`, `MIGRATION_STEP_MISSING`, `ELEMENT_ID_DUPLICATE`, `ELEMENT_ORDER_DUPLICATE`, `ELEMENT_TYPE_NOT_ALLOWED`, `SLOT_RANGE_INVALID`, `BINDING_SOURCE_UNKNOWN`, `POLICY_HTML_MARKUP`, `POLICY_SCRIPT_URL`, `THEME_COLOR_INVALID`, `LIMIT_DOCUMENT_BYTES`, `ACTIONS_OWNERSHIP_UNPROVEN` (Warnung).

Bekannte, dokumentierte Abweichung: `guestScope: ownOnly` ist derzeit eine **Warnung**, kein Blocker, weil die tag-api noch keine Eigentumsbindung besitzt (Refinement `D-23`).

---

## 8. Layout, Theme und Darstellung

- **12-Spalten-Grid mit Flusslayout**; effektive Spalten `C = clamp(1, floor(Breite / minColumnWidth), preferredColumns)`, effektiver Span `S = min(span, C)`.
- Berechnung zur Renderzeit (`ResizeObserver`), kein fester Gerätemodus; Rotation ergibt sich aus der Breite.
- **Texte werden nie abgeschnitten**: kein `ellipsis`, keine Höhenklemmung, `overflow-wrap: anywhere`.
- Theme-Tokens: `background`, `surface`, `text`, `mutedText`, `heading`, `accent`, `accentText`, `border`, optional `danger`, `success`; Farben als `#rrggbb` oder Token.
- Element-Overrides: Hintergrund, Text-/Überschriftenfarbe, Innenabstand.
- Vorschau zeigt Platzhalter für Medien (Slot-Hinweise), niemals echte Inhalte.

### 8.1 Direktes Editieren und Formatierleiste

- Text, Hinweis, Titelbereich, Fundhinweis, Fundformular und Kontaktweg sind in der Vorschau direkt editierbar; Galerie- und Dokumenten-Überschriften bleiben bis zur nächsten Iteration lesend.
- Fokus im Textfeld → Formatierleiste **oberhalb** des Feldes: `B`, `I`, `U`, Textfarbe, Hintergrundfarbe, Zurücksetzen.
- Marks wirken auf die **Auswahl** (Browser-Kommando), Farben auf das **Element** (`style.textColor`, `style.background.color`); die rechte Spalte zeigt den Text zur Kontrolle (inkl. Auszeichnungen), bearbeitet wird ausschließlich in der Vorschau – so kann kein zweiter Editor die Inline-Marks überschreiben.
- Eingefügter Text wird auf Klartext reduziert (`onPaste`), fremdes HTML gelangt nie ins Modell.
- Die Leiste klaut dem Feld nicht den Fokus (`mousedown` wird abgefangen), damit die Auswahl erhalten bleibt.
- Das DOM ist nur während der Eingabe die Quelle der Wahrheit; bei Modelländerungen von außen wird neu gerendert, solange das Feld nicht fokussiert ist (kein Caret-Sprung).
- Tipp-Bursts werden im Undo-Stack gebündelt (800 ms), strukturelle Änderungen bleiben einzeln rückgängig.

### 8.2 Reihenfolge

- Sortiert wird in der Vorschau nach `placement.order[breakpoint] ?? displayOrder`. `moveElementInDoc` tauscht daher **beides** – `displayOrder` und `placement.order` für alle Breakpoints –, damit die neue Reihenfolge sofort sichtbar ist.
- Ausgeblendete Elemente (`hidden`, z. B. `theme-assets`) sind von der Sortierung ausgenommen und bleiben verankert.



---

## 9. Oberfläche

| Bereich | Inhalt |
| --- | --- |
| Kopfzeile | TAG-Typ + „Neu", Vorlagenauswahl, Load/Save/Save as/Download, Undo/Redo, Breakpoint-Umschaltung |
| Bibliotheksleiste | Name, `libraryVersion`, Anzahl Bausteine, Load/Save/Save as/Default |
| Links | Elementliste (sortieren, löschen, hinzufügen), JSON-Ansicht mit Größe und Hash; **Breite per Ziehgriff verstellbar** (220–680 px, in `localStorage` gemerkt) |
| Mitte | Live-Vorschau in Handy-/Tablet-/Desktopbreite, klickbare Elemente, **direkt editierbarer Text mit Formatierleiste** |
| Rechts | Inspektor: Template-Rahmen, Farben, Layout, Element-Eigenschaften, Verhalten, Slots; Text nur als **Kontrollansicht** (bearbeitet wird in der Vorschau) |
| Unten | Validierungsliste mit Sprung zum betroffenen Element |

Tastenkürzel: `Strg+O` Load, `Strg+S` Save, `Strg+Shift+S` Save as, `Strg+Z`/`Strg+Shift+Z` Undo/Redo (im Textfeld bleibt das native Text-Undo aktiv).


---

## 10. Tests und Nachweise

`npm test` (Vitest) deckt ab:

| Datei | Inhalt |
| --- | --- |
| `validate.test.ts` | Golden Files fehlerfrei; doppelte IDs/Orders, Slot-Range, HTML, `javascript:`, Farben, Typ-Kompatibilität, unbekanntes Schema, Binding-Quellen, Ownership-Warnung |
| `serialize.test.ts` | kanonische Sortierung, Idempotenz, stabiler Hash, Dateinamen |
| `migrate.test.ts` | gleiche/neuere/fehlende Version, kumulative Stufe, fehlende `schemaVersion` |
| `library.test.ts` | Default-Bibliothek gültig, doppelte IDs, unbekannter Typ, Merge-Regeln, `libraryVersion` |
| `layout.test.ts` | Spalten bei 360/768/1280, Span-Klemmung, Sortierung, ausgeblendete Elemente |
| `bindings.test.ts` | erlaubte Quellen, Auflösung, Fallback, Flatten |
| `store.test.ts` | Reihenfolge sofort in der Vorschau sichtbar, `placement.order` je Breakpoint, Randfälle, Undo-Bündelung von Tipp-Bursts |
| `inlineText.test.ts` | DOM → Runs (Fett/Kursiv/Unterstrichen, verschachtelt), Absätze an `<br>`/Blockelementen, Roundtrip Modell → DOM → Modell, Escaping |
| `InlineTextEditor.test.tsx` | Leiste erscheint erst mit Fokus, Tippen erzeugt Runs, Fokus ohne Änderung bleibt ohne Dispatch, Farbwähler schreibt Element-Override, Zurücksetzen |
| `App.test.tsx` | End-to-End: Aufbau der Arbeitsfläche, Sortieren wirkt sofort in der Vorschau, Formatierleiste beim Klick ins Textfeld, Änderung landet im JSON |

Nachweisstand: **64 Tests grün** (10 Dateien), `tsc --noEmit` fehlerfrei, `vite build` erfolgreich.

---

## 11. Grenzen der ersten Version

- Galerie- und Dokumenten-Überschriften sind noch nicht inline editierbar (nur Elemente mit `content`-Block);
- Textgröße und Inline-Links sind nicht Teil des Runs-Modells (Größe über Überschriften/Theme, Links über `external-link`);
- keine Slot-Anlage/-Löschung in der UI (nur `max` änderbar);
- keine Bearbeitung von `actions` über die UI (im JSON vorhanden und validiert);
- keine Theme-Voreinstellungen/Theme-Bibliothek;
- kein Drag-and-drop-Sortieren (Pfeiltasten; Tastatur-/DnD-Sortierung nach `TCD-US-004` folgt);
- keine PDF-Seitendarstellung, kein Upload, keine Wartungserfassung (Refinement `OP-01`, `OP-02`, `OP-04`);
- keine Template-Verwaltung (`OP-13`);
- `maintenance` als TAG-Typ ist vorbereitet, aber ohne ausgelieferte Vorlage.

---

## 12. Verweise

- Refinement: [`../../../docs/00-Refinement/tag-content-designer/tag-content-designer-refinement.md`](../../../docs/00-Refinement/tag-content-designer/tag-content-designer-refinement.md)
- TAG-Content-Projektion: [`../../../docs/10-Architecture/30-Data-Architecture/40-TAG-APP-DATA-MODEL.md`](../../../docs/10-Architecture/30-Data-Architecture/40-TAG-APP-DATA-MODEL.md)
- Access-Vertrag: [`../../../docs/10-Architecture/35-Contracts/tag-app-access-v1.md`](../../../docs/10-Architecture/35-Contracts/tag-app-access-v1.md)
- TAG-App: [`../../../apps/tag-app/`](../../../apps/tag-app/)
- Label-Designer (Vorbild): [`../../tag-designer/`](../../tag-designer/)

