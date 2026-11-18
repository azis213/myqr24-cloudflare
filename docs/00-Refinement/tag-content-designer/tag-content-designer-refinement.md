# Refinement: TAG-Content-Designer – Templates für TAG-Content

**Status:** unverbindliches Refinement
**Revision:** 7
**Stand:** 2026-11-18
**Geltungsbereich:** `tools/tag-content-designer` (Master), späterer TAG-Content-User-Designer, TAG-App-Rendering, tag-api-Contentprojektion, TCP-/TCC-Integration
**Verbindlichkeit:** gemäß [`../README.md`](../README.md) ausdrücklich **keine** Anforderung, kein Contract und keine Umsetzungsgrundlage

**Historie:** Revision 1 hieß „TAG-View-Designer". Revision 2 erweitert den Auftrag um Element-Templates, Layout-Grid, RichText, Interaktionsrechte je Element, Hintergrundbilder, einen zweiten (User-)Designer sowie um die Trennung Master-Template → TAG-Instanz. Die Umbenennung in **TAG-Content-Designer** trägt dem Rechnung, dass nicht nur eine „View", sondern der gesamte TAG-Content gestaltet wird.

**Revision 5 (RTF):** Das Textfeld wird ein echtes RTF-Feld auf Basis von **Tiptap 3 / ProseMirror mit eigenem Schema** (`D-34`). Neu sind Zeichenfarbe, Markierung, Schriftgröße/-familie je Auswahl, Ausrichtung, Zeilenabstand, Aufzählungen/Nummerierungen mit Einrückung (`D-35`) sowie Inline-Links. HTML bleibt aus dem Artefakt verbannt: Markup im Text erscheint als Text, eingefügte Formatierung wird konvertiert, `javascript:` bleibt verboten (`D-36`).

**Revision 7 (Überschriften & Markdown):** Überschriften werden Absatz-Attribut (`paragraph.heading`, Ebene 1–5, `D-39`) – jede Zeile kann Überschrift sein, das bisherige Feld `content.heading` wird per Migration überführt (`D-41`, `schemaVersion 2`). Dazu ein Absatzstil-Feld, das Größen-Zahlenfeld mit Pfeilen (wirkt nur auf die Auswahl), Markdown als **Ein-/Ausgabeformat** (`D-40`: Kürzel, Paste, Dialog/Export; kein Speicherformat) und Tabellen als eigener Block (`D-42`).

### Was Revision 2 gegenüber Revision 1 ändert

| Bereich | Änderung |
| --- | --- |
| Template-Ebenen | Element-Templates als Design-Time-Bausteine, Master-Template, TAG-Instanz; **Flatten beim Export** |
| Layout | 12-Spalten-Grid kombiniert mit Flusslayout je Spalte und Gerät, Umbruch automatisch zur Renderzeit |
| Text | RichText als validiertes Runs-Modell, kein HTML, nie abgeschnitten |
| Elemente | verbindlicher Basiskatalog (`text`, `image`, `document`, `gallery`, `documents`) plus optionaler Katalog |
| Interaktion | Upload/Download/Löschen als Buttons mit **konfigurierbaren Rechten je Element**, serverseitig durchgesetzt |
| Gestaltung | Theme-Tokens plus Element-Overrides, Button- und Überschriftenfarben, Hintergrundbild je TAG/Element |
| Prozess | zwei Editoren (Master/User), iterative Weiterentwicklung mit der TAG-App, API als erweiterbare Grundlage |
| Identität | **keine** Geräte-UUID; TAG-Session plus ausdrücklich geregelte Cookie-/DSGVO-Grenzen |

### Was Revision 3 gegenüber Revision 2 ändert

| Bereich | Änderung |
| --- | --- |
| OP-01 | PDF-Seitendarstellung vollständig ausdetailliert (Renderer, Seitenzahl, Modi, Grenzen, A11y, Tests) |
| OP-02 | Löschen eigener Gast-Uploads vollständig ausdetailliert (Bindung, Nachweis, Recovery, API, UI, Audit) |
| Tool | Vorhandene Templates **laden** statt nur exportieren; Upload/Download-Benennung; Versions- und Migrationsstrategie (7.13) |
| Elemente | Complex Items als **eine** Bibliotheksdatei importier-/exportierbar (7.14, `myqr24-tag-element-library-v1`) |
| Später | Template-Verwaltung als eigener Punkt `OP-13` abgegrenzt |

### Was Revision 4 gegenüber Revision 3 ändert

| Bereich | Änderung |
| --- | --- |
| Dateiarbeit | Web-Tool mit **File System Access API**: `Load`, `Save` (gleiche Datei), `Save as` (neue Datei) statt Upload/Download; Fallback für Firefox/Safari dokumentiert |
| Complex Items | Default-Bibliothek wird **beim Start** geladen; `Save` erhöht `libraryVersion`, `Save as` erzeugt eine neue Datei, `Load` holt auch ältere Versionen zurück |
| Golden Files | sind **exakt** die Dateien, die das Tool als Default/Tests verwendet (gleiche Bytes, gleiche Struktur) |
| OP-03 / OP-04 | Gast-Identität und Wartungshistorie vollständig ausformuliert, aber für die erste Implementierung **optional** |

### Umsetzungsstand v0.1

Die erste Version ist unter [`../../../tools/tag-content-designer/`](../../../tools/tag-content-designer/) umgesetzt; die aus dem Refinement abgeleitete Tool-Spezifikation liegt in [`../../../tools/tag-content-designer/doc/SPECIFICATION.md`](../../../tools/tag-content-designer/doc/SPECIFICATION.md). Nachweis: 158 Vitest-Tests grün, `tsc --noEmit` fehlerfrei, `vite build` erfolgreich. Enthalten sind unter anderem: verstellbare linke **und** rechte Spalte, Überschriften 1–5 mit Absatzstil-Feld und `#`-Kürzel, Markdown als Ein-/Ausgabe (Kürzel, Paste, Dialog/Export), Tabellen mit Kopfzeile und Ausrichtung, RTF-Textfelder (Tiptap/ProseMirror mit eigenem Schema) inklusive Zeichenformatierung, Farbmenüs mit Theme-/Standard-/eigenen Farben und RGB-Wähler, Schriftgröße/-familie je Auswahl, weiche Zeilenumbrüche, Ausrichtung, Zeilenabstand, Aufzählungen, Einrückung und Links, HTML ausschließlich als Text, bearbeitbare JSON-Textkontrolle, „letzte Konfiguration" beim Start sowie sofort sichtbare Reihenfolgeänderungen. Bewusst noch offen: Inline-Editieren von Galerie-/Dokumenten-Überschriften, Drag-and-drop-Sortierung, Slot-Anlage, `actions`-Editor, Element-Bezüge im Text (`D-43`), PDF-Seiten, Upload/Delete, Template-Verwaltung.

---

## 1. Auftrag und Fragestellung

Ziel dieses Refinements ist ein entscheidungsorientierter Vorschlag für:

1. ein **JSON-Format**, das ein TAG-Content-Template vollständig beschreibt;
2. die Klärung, ob die Beschreibung des **gesamten TAGs** und die Beschreibung der **Content-Elemente** getrennt werden sollen oder in **einem** Dokument liegen;
3. ein **browserbasiertes Werkzeug** unter `tools/tag-content-designer`, analog zum vorhandenen `tools/tag-designer`, das ein solches Template visuell erstellt, prüft und als JSON exportiert;
4. die spätere Ablage des exportierten Templates in der **TAG Control Plane (TCP)** über das **TAG Control Center (TCC)** und die daraus abgeleitete Contentprojektion der **tag-api**;
5. den Anschluss an die bestehende **TAG-App** (`apps/tag-app`) sowie an die vorhandene Contentprojektion `myqr24-tag-content-v2` / `myqr24-tag-element-v1`;
6. **wiederverwendbare TAG-Element-Templates** (Gallery, Dokumentenliste, Wartungshistorie), die in ein TAG-Template eingezogen und beim Export geflattet werden;
7. ein **Layout- und Gestaltungsmodell**, mit dem ein Benutzer Texte, Farben, Buttons, Überschriften, Elementhintergründe und Hintergrundbilder anpasst, ohne die Struktur zu zerstören;
8. ein **Interaktionsmodell** für Upload, Download und Löschen mit pro Element konfigurierbaren Rechten, das serverseitig durchgesetzt wird;
9. einen zweiten, späteren **TAG-Content-User-Designer**, in dem ein Benutzer eine Master-Vorlage lädt, nur die erlaubten Dinge ändert und sein TAG-JSON speichert;
10. ein **Deployment je TAG** (eigene R2-Dateien und D1-Zeilen auch bei Standardvorlagen) als Grundlage für ein flexibles, responsives Rendering in der TAG-App.

Nicht Bestandteil dieses Refinements sind eine Umsetzung, Migrationen, Contracts oder Deployment-Entscheidungen.

### 1.1 Ausgangsthese des Auftrags

> „Ziel wäre es, jedes Content-Element in einem großen JSON-Element mitzudefinieren. Am Ende soll die komplette Beschreibung als Template in der TCP abgelegt sein. Ziel wäre, dass das TAG-Design in der TCP keine komplexe DB-Struktur benötigt.“

Diese These wird in Abschnitt 3 geprüft, bewertet und mit einer Empfehlung versehen. Sie ist technisch tragfähig, benötigt aber eine präzise Trennung zwischen **Autorenformat** (ein Dokument) und **Laufzeitprojektion** (aufgeteilte Dateien), damit die bereits implementierten Sicherheits- und Sichtbarkeitsregeln der tag-api nicht verletzt werden.

---

## 2. Ist-Analyse

### 2.1 Vorhandene Artefakte

| Artefakt | Pfad | Rolle im Vorhaben |
| --- | --- | --- |
| Label-Designer | [`../../../tools/tag-designer/`](../../../tools/tag-designer/) | Technisches und UX-Vorbild; erzeugt Druckvorlagen, **keine** TAG-Content-Ansichten |
| Label-Designer-Spezifikation | [`../../../tools/tag-designer/doc/SPECIFICATION.md`](../../../tools/tag-designer/doc/SPECIFICATION.md) | Dokumentstruktur `schemaVersion`/`kind`, JSON-Import/-Export, Bedienprinzipien |
| TAG-App | [`../../../apps/tag-app/`](../../../apps/tag-app/) | Öffentliches Rendering der TAG-Ansicht |
| TAG-App-View-Vertrag | [`../../../apps/tag-app/src/features/vault/types.ts`](../../../apps/tag-app/src/features/vault/types.ts) | `PublicTagView`, `VaultBlock`, `VaultPresentation` |
| TAG-App-Renderer | [`../../../apps/tag-app/src/App.tsx`](../../../apps/tag-app/src/App.tsx) | `VaultBlockRenderer` rendert ausschließlich `view.vault.blocks` |
| tag-api (Application API Worker) | [`../../../apps/tag-app/workers/app-api.ts`](../../../apps/tag-app/workers/app-api.ts) | `GET /api/v1/tags/{tagId}/content`, Session-/Sichtbarkeitsprüfung |
| tag-api-Contentprojektion | [`../../../apps/tag-app/database/0002_tag_content.sql`](../../../apps/tag-app/database/0002_tag_content.sql) | Elemente, Items, Varianten, Range-/Global-Content ohne Revisionstabellen |
| R2-Pfadableitung | [`../../../apps/tag-app/workers/content-paths.ts`](../../../apps/tag-app/workers/content-paths.ts) | serverseitige Key-Ableitung, keine Clientpfade |
| Access-Vertrag | [`../../10-Architecture/35-Contracts/tag-app-access-v1.md`](../../10-Architecture/35-Contracts/tag-app-access-v1.md) | Endpunkte, Session-, PIN- und Cache-Grenzen |
| Datenmodell TAG-App | [`../../10-Architecture/30-Data-Architecture/40-TAG-APP-DATA-MODEL.md`](../../10-Architecture/30-Data-Architecture/40-TAG-APP-DATA-MODEL.md) | operative D1-Projektion, Datenhoheit |
| TAG-App-Architektur | [`../../10-Architecture/TAG_APP_ARCHITECTURE.md`](../../10-Architecture/TAG_APP_ARCHITECTURE.md) | Verantwortungsgrenzen, Entwicklungsregeln |
| TAG-App-Implementierung | [`../../40-Implementation/tag-app/README.md`](../../40-Implementation/tag-app/README.md) | Story-/Test-/Statusstrang `APP-*` |
| Vault-Fachmodell | [`../../20-Special-Specifications/TAG_VAULT_FEATURE.md`](../../20-Special-Specifications/TAG_VAULT_FEATURE.md) | Sichtbarkeiten, PIN, Owner-, Gast- und Empfängergrenzen |
| TCP-Verwaltungsvertrag | [`../../10-Architecture/35-Contracts/control-plane-tag-management-api-v1.md`](../../10-Architecture/35-Contracts/control-plane-tag-management-api-v1.md) | Autorisierung, Lifecycle, Idempotenz, Audit |
| TCC-/CP-Stories | [`../../40-Implementation/tag-control-center/10-USER-STORIES.md`](../../40-Implementation/tag-control-center/10-USER-STORIES.md) | `CC-US-024`, `CC-US-030` |

### 2.2 Technische Fakten, auf denen der Vorschlag aufsetzt

1. Die tag-api liefert bereits **zwei getrennte Ebenen**:
   - `tag-rev{n}.json` mit `schema: "myqr24-tag-content-v2"`, `tagNumericId`, `tagId`, `revision` und `view` (freies, aber typisiert interpretiertes Objekt = `PublicTagView`);
   - `element-rev{n}.json` je Element mit `schema: "myqr24-tag-element-v1"`, `elementId`, `elementType`, `payload`;
   - zusätzlich relationale Item-Metadaten aus D1 (`content_id`, Typ, Titel, Alt-Text, `display_order`, `visibility`, `items[].scope`).
2. `isContentDocument` in `app-api.ts` prüft **nur** `schema`, `tagId`, `tagNumericId`, `revision` und die Existenz von `view`. Zusätzliche Felder im TAG-JSON sind damit **additiv** möglich, ohne den Vertrag zu brechen.
3. `isElementDocument` akzeptiert ein freies, nicht-arrayförmiges `payload`-Objekt. Element-Payloads sind also erweiterbar, solange keine Storage-Keys enthalten sind (`containsStorageKey` verbietet `object_key`, `objectKey`, `r2_key`, `r2Key`).
4. Sichtbarkeit wird **pro Element und pro Item** serverseitig gefiltert (`isVisibleToScope`: `public` für alle, `shared` ab PIN-/Login-Scope). Das TAG-JSON `view` wird **nicht** gefiltert, weil es genau eine Datei pro TAG und Revision gibt.
5. Die TAG-App rendert derzeit `view.vault.blocks` und ignoriert `elements` vollständig. Der Content-Response enthält `elements` inklusive `payload` und `items` aber bereits.
6. Die D1-Projektion speichert **keine** Template- oder Revisionsstruktur; Redaktion, Versionierung und Historie liegen laut Datenmodell in TCP.
7. Der Label-Designer arbeitet mit `schemaVersion`/`kind`, statischem JSON-Import/-Export, Canvas-Vorschau und verlangt ausdrücklich, dass Vorschau und Export dieselbe Rendering-Logik verwenden.
8. Die TAG-App rendert als **Flusslayout**: `main.tag-page` → `section.tag-context` → `nav.vault-tabs` → `article.vault-content` → Blöcke; `styles.css` kennt nur zwei Breakpoints (`42rem`, `28rem`). Es gibt weder Grid-Platzierung noch Zoom, Paging oder Lightbox-Logik.
9. `tag_content_items` besitzt **keine** strukturierten Metadaten (nur `title`, `alt_text`, `original_filename`, `status`). Für eine Wartungshistorie (Datum, Umfang, Laufleistung, Nachweise) fehlt damit der Träger.
10. In R2 existiert bereits ein Item-Dokument `items/{contentId}/item.json` mit `schema: "myqr24-content-item-v1"` (`test/10-test-local/seed/r2/item.json`), das von `app-api.ts` **nicht gelesen** wird – ein vorbereiteter, aber ungenutzter Erweiterungspunkt.
11. `content_item_type` ist **kein** Enum, sondern `[a-z][a-z0-9-]{0,63}`; neue Item-Typen wie `maintenance-entry` benötigen keine D1-Migration.
12. Die tag-api kennt **keine** Upload-, Delete- oder Variantenauswahl-Endpunkte für Gastbeiträge; `POST /api/get-image-url` ist der einzige Medienendpunkt und erzeugt ausschließlich signierte Download-URLs.
13. Die TAG-Session ist ein `HttpOnly`-Cookie mit `Path=/api` und 30 Tagen Laufzeit, gebunden an `tag_id`, `access_version` und einen Scope (`public`/`pin`/`login`). Eine Wiedererkennung über TAG-Grenzen hinweg existiert nicht – bewusst.

### 2.3 Erkannte Lücken und Widersprüche

| ID | Befund | Auswirkung |
| --- | --- | --- |
| G-01 | Eine TAG-Content-Beschreibung l\u00e4sst sich heute nur **von Hand** als JSON schreiben: `view` in `tag-rev*.json`, Elemente getrennt in `element-rev*.json`, Mitgliedschaft zusätzlich in D1 | hoher Fehleraufwand, keine wiederverwendbaren Vorlagen, keine Vorschau vor dem Publish |
| G-02 | Es gibt **keine** Template-Ebene: jedes TAG-JSON ist individuell; gleiche TAG-Typen (Vault, Lost & Found) werden mehrfach nachgebaut | Redundanz, Drift zwischen TAGs, keine Produktpflege |
| G-03 | `view.vault.blocks` und `elements[]` können **dieselben** Inhalte doppelt beschreiben | Doppelpflege, Divergenzrisiko, unklare Autorität |
| G-04 | `view` ist nicht sichtbarkeitsgefiltert, Elemente sind es | Ein Template, das `shared`-/`private`-Inhalte in `view.blocks` ablegt, würde sie **leaken** – die Trennung ist sicherheitsrelevant, nicht kosmetisch |
| G-05 | Designer-Strang (`tools/*`) und View-Strang (`apps/tag-app`) haben keine gemeinsame Typ-/Contract-Quelle | Vorschau und Produktion können auseinanderlaufen |
| G-06 | TCP hat weder Template-Tabelle noch Upload-Contract | das Template kann heute nirgends autoritativ abgelegt werden |
| G-07 | Reusable Element-Bausteine fehlen: eine Gallery wird je TAG neu erfunden, obwohl Gestaltung und Verhalten identisch sind | Divergenz, hoher Pflegeaufwand, keine einheitliche Qualität |
| G-08 | Der Renderer kennt kein Grid, keine Spans, keinen Zoom, kein Paging und keine Lightbox | „Position bestimmen", „Bild vergrößern", „Dokument blättern" sind heute nicht darstellbar |
| G-09 | Text kann nur als Absatzliste ohne Auszeichnung abgebildet werden (`paragraphs: string[]`) | keine Fett-/Kursiv-/Farbauszeichnung, keine Button-Labels mit Formatierung |
| G-10 | Medien werden ohne Variantenvertrag adressiert (nur `cover` belegt) | Thumbnails, mittlere und volle Ansicht sind nicht standardisiert, Zoom nicht effizient |
| G-11 | Es gibt kein Rechte-Modell pro Element (Upload/Download/Löschen) | „Gast darf nur eigene Bilder löschen" ist weder deklarierbar noch durchsetzbar |
| G-12 | Wartungs-/Reparaturdaten haben keinen Träger (Items ohne Metadaten, `item.json` ungenutzt) | Wartungs-TAGs sind nicht abbildbar |
| G-13 | Es gibt keinen Master-→Instanz-Workflow: eine Vorlage kann nicht als benutzerspezifische Kopie weitergegeben werden | jeder TAG müsste von Hand neu gebaut werden, Vorlagen wären nicht wiederverwendbar |

---

## 3. Kernfrage: ein Dokument oder getrennte TAG-/Element-Beschreibungen?

### 3.1 Optionen

| Option | Beschreibung | Vorteile | Nachteile |
| --- | --- | --- | --- |
| **A – Ein Dokument** | Ein JSON enthält Shell (TAG-Beschreibung) **und** alle Elemente eingebettet | atomar editierbar, ein Import/Export, ein Hash, eine Version, einfache TCP-Ablage, Reihenfolge und Querbezüge lokal prüfbar | Laufzeit muss daraus mehrere Dateien ableiten; große Dokumente bei vielen Elementen |
| **B – Zwei Dokumente** | `tag-content.json` (Shell) + `elements/*.json` je Element, verknüpft über IDs | deckungsgleich mit der R2-Projektion; einzelne Elemente unabhängig versionierbar | Import/Export mehrerer Dateien (ZIP), Konsistenz nur über IDs, Reihenfolge doppelt gepflegt, höherer Validierungsaufwand, schlechtere Bedienbarkeit im Browser |
| **C – Zwei Dokumente, aber ein Export** | Autorenformat getrennt, Export bündelt | wie B, aber ein Dateiartefakt | zusätzliche Transformationsstufe ohne echten Gewinn; Modell doppelt |

### 3.2 Empfehlung

**Option A für das Autorenformat, Option B für die Laufzeit – als abgeleitete Projektion.**

```text
Autorenformat (ein Dokument, ein Hash, eine Version)
        │
        │  TCP-Validierung + Publish-Transformation (serverseitig)
        ▼
Laufzeitprojektion (mehrere Dateien + relationale Metadaten)
        │
        ▼
tag-api / TAG-App
```

Begründung:

1. **Fachlich** ist eine TAG-Content-Ansicht ein zusammenh\u00e4ngendes Produkt: Shell, Theme, Elemente, Reihenfolge, Slots und Copy gehören zusammen und werden gemeinsam veröffentlicht. Die Trennung in der Laufzeit ist eine **Sichtbarkeits- und Caching-Optimierung**, kein fachlicher Schnitt.
2. **Sicherheit**: Die Aufteilung in Elementdateien existiert, damit die tag-api Elemente **pro Sitzung filtern** kann. Diese Eigenschaft bleibt erhalten, weil die Aufteilung weiterhin beim Publish entsteht – der Designer selbst veröffentlicht nichts.
3. **TCP ohne komplexe DB**: Das Template ist genau ein Dokument mit wenigen Metadatenzeilen (Abschnitt 9.2). Die relationale Zerlegung in Elemente/Items/Dateien bleibt eine Aufgabe des Publishens, nicht der Template-Verwaltung.
4. **Bedienbarkeit**: Ein Browser-Tool kann ein Dokument atomar speichern, versionieren, vergleichen und wieder öffnen. Mehrdatei-Exporte erzeugen dagegen schnell inkonsistente Zwischenstände.
5. **Determinismus**: Ein Dokument = ein kanonischer Hash = eindeutige Idempotenz beim Upload.

### 3.3 Ausdrückliche Konsequenzen

- Der Designer exportiert **nie** direkt `tag-rev*.json` oder `element-rev*.json`.
- Der Export ist ein **Autorenformat** (`myqr24-tag-content-template-v1`), das erst TCP in die Laufzeitform überführt.
- Die Laufzeitform bleibt ein Contract der tag-api und wird in diesem Refinement nicht verändert.

### 3.4 Drei Ebenen: Element-Template, Master-Template, TAG-Instanz

Die Anforderung „Elemente wiederverwendbar designen" und „ein großes JSON pro TAG ausgeben" widersprechen sich nur scheinbar. Sie werden über **drei Artefakte** getrennt:

| Ebene | Schema | Zweck | Wird deployt? | Versionierung |
| --- | --- | --- | --- | --- |
| **Element-Template** | `myqr24-tag-element-template-v1` | wiederverwendbarer Baustein (Gallery, Dokumentenliste, Wartungshistorie) mit Gestaltung, Verhalten und Slot-Definition | **nein** – nur Entwurfszeit | eigene `elementTemplateVersion` |
| **Master-Template** | `myqr24-tag-content-template-v1` | vollständige TAG-Ansicht für einen TAG-Typ; zieht Element-Templates mit Overrides ein | über TCP als Vorlage, nicht öffentlich | `templateVersion`, `schemaVersion` |
| **TAG-Instanz** | `myqr24-tag-content-instance-v1` | benutzerspezifische, geflattete Kopie für genau ein TAG | **ja** – R2 + D1 je TAG | `content_revision` |
| **Element-Bibliothek** | `myqr24-tag-element-library-v1` | **eine** Datei mit allen Complex-Item-Templates (Gallery, Documents, Wartung …) als Arbeitsvorrat des Designers | **nein** – nur Entwurfszeit, nicht pro TAG | `libraryVersion`, `schemaVersion` |

**Flatten-Regel:** Beim Export (Master) und beim Speichern (Instanz) werden alle eingezogenen Element-Templates mit ihren Overrides **vollständig hineinkopiert**. Danach existiert kein Verweis mehr auf ein Element-Template.

Konsequenzen:

1. **Kein Resolver** in tag-api, TAG-App oder Deployment: Das gespeicherte Dokument ist selbsttragend.
2. **Element-Templates bleiben trotzdem pflegbar**: Ändert der Betreiber den Gallery-Baustein, wirkt das nur auf neu erzeugte Master-Templates/Instanzen, nie rückwirkend auf veröffentlichte TAGs.
3. **Jedes TAG erhält eine eigene Version** in R2/D1 – auch wenn ein unveränderter Standard verwendet wurde. Das ist gewollt: Reproduzierbarkeit, Widerruf, unabhängige Weiterentwicklung.
4. **Der User-Designer arbeitet auf der Master-Ebene**, speichert aber eine Instanz. Er sieht nie Element-Template-Interna, sondern nur die daraus entstandene, geflattete Struktur.
5. **Übernahme von Verbesserungen** ist ein bewusster Migrationsschritt pro TAG, kein automatischer Pull.

---

## 4. Zielbild und Datenfluss

```text
┌──────────────────────────────┐
│ Browser: tools/tag-content-     │   offline, keine Secrets, keine API-Calls
│ designer                     │
│  - Vorlage wählen            │
│  - Elemente/Slots konfig.    │
│  - Live-Vorschau             │
│  - L1–L3-Validierung         │
└──────────────┬───────────────┘
               │ Export: *.tagcontent.json (ein Dokument)
               ▼
┌──────────────────────────────┐
│ TCC (Authentisierung, Reauth)│   Upload, Anzeige, Diff, Validierungsfeedback
└──────────────┬───────────────┘
               │ authentisierter Command (Idempotency-Key)
               ▼
┌──────────────────────────────┐
│ TCP (MySQL, autoritativ)     │   Template-Dokument + minimale Metadaten,
│                              │   serverseitige Neuvalidierung, Audit, Version
└──────────────┬───────────────┘
               │ Publish: Template → TAG-Projektion (revision n+1)
               ▼
┌──────────────────────────────┐
│ R2 (privat) + D1 (Projektion)│   tag-rev{n}.json, element-rev{n}.json, Item-Metadaten
└──────────────┬───────────────┘
               │ GET /api/v1/tags/{tagId}/content (Session- und Sichtbarkeitsprüfung)
               ▼
┌──────────────────────────────┐
│ apps/tag-app (React-PWA)     │   rendert öffentliche, serverseitig gefilterte Inhalte
└──────────────────────────────┘
```

### 4.1 Rollen und Grenzen

| Rolle | Entscheidet | Entscheidet ausdrücklich **nicht** |
| --- | --- | --- |
| tag-content-designer (Browser) | Struktur, Elemente, Slots, Copy, Theme des Templates | Berechtigungen, Sichtbarkeitsobergrenzen, Publish, Existenz eines TAGs |
| TCC-Benutzer | Auswahl, Upload, Prüfung, Freigabeantrag | serverseitige Validität, Autorisierung, Audit |
| TCP | Validierung, Versionierung, Autorisierung, Audit, Publishing, Lifecycle | Darstellung im Browser, Rendering |
| tag-api | Existenz, Status, Session, Scope, Sichtbarkeit, Revision, Medienfreigabe | Template-Design, Farben, Layout |
| TAG-App | Rendering der gelieferten Struktur | Freigabe, Filterung, Ableitung von Rechten aus dem Template |

### 4.2 Grundsatz: Template ist keine Berechtigung

Ein Template beschreibt **Darstellung und Struktur**, niemals Rechte. Es darf Sichtbarkeiten **vorschlagen** (`visibility` je Element), aber niemals eine Sichtbarkeit oder einen Schutzmodus **erzwingen**. TCP prüft beim Publish, dass jede vorgeschlagene Sichtbarkeit innerhalb der TAG-Policy liegt (Abschnitt 6.2 und 8).

---

## 5. Autorenformate: Element-Template, Master-Template, Instanz

### 5.1 Konventionen

- `schema: "myqr24-tag-content-template-v1"` plus `schemaVersion: 1` (analog zu `myqr24-tag-content-v2` und den `kind`/`schemaVersion`-Konventionen des Label-Designers).
- Ausschließlich **camelCase**, keine Kommentare, keine Zahlen als Strings, keine `null`-Werte für „nicht gesetzt“ (Feld weglassen).
- Farben als `#rrggbb`, Opazitäten `0..1`, Längen ohne Einheit in CSS-Pixeln der Shell (keine mm/DPI – das ist Label-Design).
- Kein gespeichertes HTML, kein CSS-String, kein JavaScript, kein `data:`-/`javascript:`-Link. HTML im Text erscheint als Text; Paste wird in Tokens konvertiert.
- Keine Storage-Keys, keine Tokens, keine PINs, keine internen IDs aus D1/R2.
- Ein Template enthält **keine** `content_id`s und **keine** Medien-URLs; es deklariert nur **Slots**.
- Ausgabe ist deterministisch: feste Schlüsselreihenfolge, 2 Leerzeichen Einrückung, LF, abschließender Zeilenumbruch.

### 5.2 Top-Level-Struktur

```json
{
  "schema": "myqr24-tag-content-template-v1",
  "schemaVersion": 1,
  "template": { },
  "shell": { },
  "elements": [ ]
}
```

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `schema` | ja | konstanter Bezeichner des Formats |
| `schemaVersion` | ja | Formatversion, aktuell `1` |
| `template` | ja | Identität, Typ, Version, Status, Sprache |
| `shell` | ja | TAG-Rahmen: Präsentation, Theme, Navigation, Feature-Hinweise |
| `elements` | ja | geordnete Liste der Content-Elemente inklusive Slots, Copy und Bindings |

### 5.3 `template`

```json
"template": {
  "templateId": "tvt_vault_standard",
  "templateVersion": 3,
  "tagType": "vault",
  "name": "Vault – Standard",
  "description": "Öffentliche Standardansicht mit Titel, Hinweis, Text und Galerie.",
  "locale": "de-DE",
  "status": "draft",
  "compatibility": {
    "protectionModes": ["public", "pin_required"],
    "presentations": ["standard"]
  }
}
```

| Feld | Regel |
| --- | --- |
| `templateId` | `^[a-z][a-z0-9_]{2,63}$`, stabil über Versionen hinweg |
| `templateVersion` | ganzzahlig `>= 1`; bei fachlicher Änderung erhöhen |
| `tagType` | geschlossene Liste: `vault`, `lost-found`, `event`, `exhibit` (Erweiterung nur per Entscheidung D-04) |
| `name` | `1..120` Zeichen, Anzeigename im TCC |
| `description` | `0..512` Zeichen, keine personenbezogenen Daten |
| `locale` | BCP-47-Tag, v1 nur `de-DE` |
| `status` | `draft`, `pending-review`, `published`, `retired` – im Tool nur `draft` zulässig |
| `compatibility.protectionModes` | Hinweis, welche Schutzmodi die Vorlage sinnvoll unterstützt; **keine** Autorisierung |
| `compatibility.presentations` | welche Shell-Präsentationen zulässig sind (Abschnitt 5.4) |

`templateVersion` ist eine **Autorenangabe**. Die tatsächlich veröffentlichte Version vergibt TCP (Abschnitt 9.2); Abweichungen werden beim Upload gemeldet, nicht still korrigiert.

### 5.4 `shell`

```json
"shell": {
  "presentation": "standard",
  "features": ["vault"],
  "theme": {
    "colorMode": "light",
    "colors": {
      "background": "#f7f5f0",
      "surface": "#ffffff",
      "text": "#1c1c1c",
      "mutedText": "#5a5a5a",
      "accent": "#1f513d",
      "accentText": "#ffffff",
      "border": "#e2ded6"
    },
    "typography": {
      "fontFamily": "system",
      "headingScale": 1.0,
      "bodySize": 16
    },
    "layout": {
      "contentWidth": "narrow",
      "density": "comfortable",
      "cornerStyle": "soft"
    }
  },
  "navigation": {
    "mode": "tabs",
    "items": [
      { "id": "home", "label": "Übersicht", "elementIds": ["cel_hero", "cel_notice"] },
      { "id": "info", "label": "Informationen", "elementIds": ["cel_text"] },
      { "id": "media", "label": "Bilder", "elementIds": ["cel_gallery"] }
    ]
  },
  "statusBar": { "showTagId": true, "showPresentation": false }
}
```

Regeln:

- `presentation` nutzt die **bestehenden** Werte aus `PublicTagView.tag.presentation` (`standard`, `gallery`, `public-page`, `museum-exhibit`, `summit-guide`, `wedding`). Keine neuen Werte ohne TAG-App-Änderung.
- `features` ist eine **Teilmenge** der fachlich freigegebenen Features (`vault`, `lost-found`, `guestbook`, `check-in`). TCP veröffentlicht nur Features, die für das TAG tatsächlich zugewiesen sind; die TAG-App leitet daraus keine Rechte ab.
- `theme` enthält ausschließlich Design-Tokens: keine CSS-Selektoren, keine URLs, keine `url(...)`-Werte, keine externen Font-URLs. `fontFamily` ist ein geschlossenes Enum (`system`, `serif`, `mono`); weitere Schriften nur mit mitgelieferten Dateien.
- `navigation.items[].elementIds` muss auf existierende `elements[].elementId` verweisen. Jedes Element darf höchstens einer Navigationsgruppe zugeordnet sein. `mode: "single"` ist der Fall ohne Tabs.
- `layout.contentWidth` (`narrow`, `wide`, `full`), `density` (`compact`, `comfortable`) und `cornerStyle` (`none`, `soft`, `round`) sind geschlossene Enums, damit die TAG-App sie ohne CSS-Injection auf Klassen abbilden kann.
- `statusBar.showTagId` zeigt die öffentliche TAG-ID dezent an; sie ist kein Geheimnis und darf angezeigt werden.

### 5.5 `elements[]`

Ein Element ist die **vollständige** Beschreibung eines sichtbaren Bausteins: Typ, Position, Struktur, statische Texte, Feldbindungen und Slots.

```json
{
  "elementId": "cel_gallery",
  "elementType": "gallery",
  "displayOrder": 30,
  "visibility": "public",
  "placement": { "span": { "mobile": 12, "tablet": 12, "desktop": 8 }, "order": 30 },
  "style": { "background": { "type": "solid", "color": "surface" }, "padding": "normal" },
  "payload": {
    "name": "Eindrücke",
    "picker": { "axis": "horizontal", "thumbSize": "md" },
    "viewer": { "sizeMode": "medium", "swipe": true },
    "lightbox": true,
    "maxImages": 48
  },
  "copy": { "title": "Eindrücke", "description": "Ausgewählte Bilder zu diesem TAG." },
  "bindings": { "title": { "from": "tag.displayName" } },
  "slots": [
    {
      "slotId": "images",
      "accepts": ["image"],
      "min": 1,
      "max": 48,
      "required": false,
      "presentation": { "fit": "cover", "caption": "optional" }
    }
  ]
}
```

| Feld | Pflicht | Regel |
| --- | --- | --- |
| `elementId` | ja | `^cel_[A-Za-z0-9_-]{1,120}$` – identisch zur D1-Prüfung in `0002_tag_content.sql` |
| `elementType` | ja | `^[a-z][a-z0-9-]{0,63}$`, Katalog aus Abschnitt 5.8 |
| `displayOrder` | ja | `0..999`, aufsteigend, eindeutig; das Tool sortiert beim Export deterministisch |
| `visibility` | ja | `public`, `shared`, `private`, `ownerOnly` – **Vorschlag**, keine Erzwingung (Abschnitt 6.2) |
| `style` | nein | visuelle Overrides: Hintergrund, Text-/Überschriftenfarbe, Rahmen, Abstand, Ausrichtung |
| `payload` | ja | typabhängige Struktur, **nur** Layout/Verhalten, keine Inhalte, keine URLs außer geprüften Linkfeldern |
| `copy` | nein | Vorlagentexte im Master-/Element-Template; beim Flatten bzw. in der Instanz zu `content` aufgelöst |
| `content` | nein | aufgelöste RichText-Inhalte (Runs) in Instanz und Element-Payload |
| `bindings` | nein | Feld → Datenquelle aus geschlossenem Katalog (Abschnitt 5.7) |
| `slots` | nein | Medien-/Dokumentplätze; ohne Slots ist das Element rein textlich |

Konfliktauflösung: Enthält ein Feld sowohl `copy` als auch `bindings`, gewinnt die Binding; `copy` dient dann als Fallback und muss als solcher im Tool markiert sein.

### 5.6 `slots[]`

Slots entkoppeln **Design** von **Inhalt**: Das Template sagt, *wo* und *wie* Medien erscheinen; TCP bindet beim Publish die tatsächlich veröffentlichten Items.

| Feld | Pflicht | Regel |
| --- | --- | --- |
| `slotId` | ja | `^[a-z][a-z0-9-]{0,31}$`, innerhalb des Elements eindeutig |
| `accepts` | ja | nicht leere Teilmenge aus `image`, `document`, `audio` |
| `min` | ja | `0..64`, `min <= max` |
| `max` | ja | `1..64` |
| `required` | ja | `true` verlangt mindestens `min` gebundene Items beim Publish |
| `presentation` | nein | rein darstellende Optionen, z. B. `fit` (`cover`, `contain`), `caption` (`none`, `optional`, `required`), `downloadable` (bool) |

Regeln:

- Ein Slot beschreibt **keine** konkreten Dateien, keine `contentId`, keine URL, keinen Dateinamen.
- `accepts` wird beim Publish gegen `tag_content_items.content_item_type` geprüft; ein Slot mit `accepts: ["image"]` darf keine PDF-Items erhalten.
- `required: true` ist ein **Publish-Blocker**, kein Autoren-Blocker: Das Tool darf ein Template mit leeren Pflicht-Slots exportieren, muss es aber als Warnung ausweisen.
- Die Zuordnung „Item → Slot" erfolgt beim Publish in `tag_content_element_items`; die Slot-ID wird dort als Gruppierungs-/Reihenfolgehinweis mitgeführt (Abschnitt 6.1, Entscheidung D-06).

### 5.7 `copy` und `bindings`

Statische Texte gehören in `copy`. Alles, was je TAG variiert, wird **nicht** als Template-String mit Platzhaltern erzeugt, sondern über eine geschlossene Binding-Liste referenziert:

```json
"copy": { "title": "Informationen", "paragraphs": ["Bitte beachten Sie die Hinweise."] },
"bindings": {
  "title": { "from": "tag.displayName" },
  "subtitle": { "from": "literal", "value": "Öffentliche Informationen zu diesem TAG" }
}
```

| Binding-Quelle | Bedeutung | v1 |
| --- | --- | --- |
| `tag.displayName` | Anzeigename des TAGs aus TCP | ja |
| `tag.id` | öffentliche Base36-ID | ja |
| `literal` | expliziter Text im Bindingwert | ja |
| `owner.contactChannel` | Kontaktweg über serverseitige Vermittlung | nein (API/Session nötig) |
| `lostFound.finderInstructions` | geführter Fund-Flow | nein (eigene Story) |

Begründung: Mustache-/`{{…}}`-Platzhalter in Strings sind ein Injection- und Escaping-Risiko, schwer validierbar und im UI kaum typsicher. Strukturierte Bindings sind prüfbar, im Designer als Auswahl darstellbar und beim Publish deterministisch auflösbar. **Eine unbekannte Quelle ist ein Fehler, kein Leerstring.**

Begriffe: `copy` und `bindings` sind **Autorenwerkzeuge** des Masters bzw. Element-Templates. Beim Flatten (Export) werden sie zu `content` aufgelöst – dieses `content` ist der RichText (Runs), den Instanz, Element-Payload und Renderer lesen. In der Instanz gibt es deshalb kein `bindings` mehr.

### 5.8 Elementkatalog

`elementType` wird zu `tag_content_elements.content_element_type` und zu `elementType` im Element-JSON. Die Werte müssen zur bestehenden TAG-App passen; neue Typen erfordern einen Renderer in `apps/tag-app`.

| `elementType` | Pflicht v1 | Zweck | `payload`-Kernfelder | Slots |
| --- | --- | --- | --- | --- |
| `text` | **ja** | formatierter Fließtext mit Überschrift, Absätzen, Auszeichnungen | `headingLevel`, `align`, `maxParagraphs` | – |
| `image` | **ja** | **Einzelbild** in einer Box, ohne Galerie, mit Zoom | `fit` (`contain`, `cover`), `zoom` (`none`, `tap`, `pinch`), `maxHeight` (`auto`, `screen`, `half`) | `image` (`image`, genau 1, max 1) |
| `document` | **ja** | **ein** Dokument, wahlweise als Link, Scroll-Box oder Seitenansicht | `display` (siehe 5.8.1), `boxHeight`, `pageMode`, `showMeta` | `document` (`document`, genau 1, max 1) |
| `gallery` | **ja** | **komplexe** Bildergalerie mit Picker, Viewer, Lightbox | `name`, `picker.*`, `viewer.*`, `lightbox`, `captions`, `maxImages` (siehe 5.8.2) | `images` (`image`, 1..48) |
| `documents` | **ja** | **komplexe** Dokumentenliste oder Icon-Ansicht | `view` (`list`, `icons`), `showMeta`, `sort`, `maxItems` | `documents` (`document`, 0..32) |
| `hero` | nein | Titelbildbereich (bestehend) | `variant` (`cover`, `plain`) | `cover` (`image`, max 1) |
| `callout` | nein | Hinweis-/Sicherheitsbox (bestehend) | `tone` (`info`, `notice`, `safety`) | – |
| `external-link` | nein | geprüfter externer Link (bestehend) | `display` (`button`, `inline`) | – |
| `divider` | nein | rein visuelle Trennung | `style` (`line`, `space`) | – |
| `finder-notice` | nein | Fundhinweis für Finder | `urgency` (`normal`, `high`) | – |
| `finder-form` | nein | „Fund melden" (geplant, API/Session nötig) | `channel` (`server-mediated`) | `photos` (`image`, 0..3) |
| `contact-channel` | nein | vermittelter Kontakt (geplant) | `method` (`form`, `callback`) | – |
| `maintenance-history` | nein | Wartungs-/Reparaturhistorie (optional, siehe 5.19) | `groupBy`, `showTotals`, `dateFormat` | `entries` (`document`, `image`, 0..64) |
| `audio-guide` | nein | Audiospur (später) | `autoplay: false`, `chapters` | `audio` (`audio`, 0..16) |

`image` ist neu: Es ersetzt die bisherige Gleichsetzung von „Bild" und „Galerie" und deckt den Fall „ein Bild, groß, zoombar" ab, ohne Galerie-Overhead.

### 5.8.1 Darstellungsmodi des `document`-Elements

| `display` | Verhalten | Voraussetzung |
| --- | --- | --- |
| `link` | Karte/Zeile mit Titel, Typ, Größe und Download-Button | keine |
| `box-scroll` | Dokument in einer Box fester Höhe mit vertikalem Scrollen | clientseitiges Seitenrendering (pdf.js) |
| `pages-paged` | genau eine Seite, Blättern vor/zurück, Seitenzahl | Seitenrendering + Seitenzahl |
| `pages-stacked` | alle Seiten untereinander, vertikales Scrollen | Seitenrendering |
| `pages-side-by-side` | Seiten nebeneinander, horizontales Scrollen oder Wischen | Seitenrendering |

Regeln: `display` ist im Template fest vorgegeben, kann aber im User-Designer innerhalb der erlaubten Modi geändert werden (`editable.payload.display`). `boxHeight` ist ein Token (`sm`, `md`, `lg`, `screen`), keine Pixelzahl. Bei `link` erscheint kein eingebetteter Inhalt – das ist der sichere Rückfallmodus, wenn kein Seitenrenderer verfügbar ist.

### 5.8.2 Verhalten der `gallery`

- **Picker** (Vorschaubilder): `axis` (`horizontal`, `vertical`), `thumbSize` (`sm`, `md`), `showCounter`.
- **Viewer**: `sizeMode` (`medium`, `full`) – im User-Designer und zur Laufzeit umschaltbar; `swipe` (Wischen), `loop`, `showCaptions`.
- **Lightbox**: Klick auf ein Bild lädt die volle Variante, Zoom per Tap/Pinch, Schließen per Escape/Swipe-down.
- **Umschaltung `medium`/`full`** ist eine **Laufzeitpräferenz** des Betrachters und wird lokal gespeichert (nicht im TAG-JSON, nicht serverseitig).
- **Reihenfolge** der Bilder entspricht `display_order`; Titel/Caption kommen aus dem Item (`title`/`alt_text`).

### 5.8.3 Zoom des `image`-Elements

`zoom: none` (statisch), `tap` (Klick/Tap öffnet volle Ansicht), `pinch` (Geste, nur wenn die volle Variante geladen ist). In allen Fällen gilt: zuerst `mid`, bei Zoom/Öffnen `full`; `thumb` nur für Listen und Picker. Zoom ist **kein** Grund, Texte oder Container abzuschneiden – der Zoombereich ist ein Overlay.

Nicht aufgenommen und ausdrücklich **nicht** Teil dieses Refinements: `chat`, `guestbook`, `check-in`, `campaign`, `collection`. Diese Features haben eigene Sessions, Moderation, Retention und Datenmodelle (siehe TAG-Vault-Fachmodell und TAG-App-Stories `APP-US-060` ff.) und dürfen nicht als „Template-Element" verdeckt eingeführt werden.

### 5.9 Grenzwerte (Vorschlag)

| Limit | Wert | Begründung |
| --- | ---: | --- |
| Elemente je Template | 24 | deckt Vault-, Event- und Lost-&-Found-Sichten ab, hält die Vorschau bedienbar |
| Slots je Element | 16 | ein Slot mit `max: 48` genügt für Galerien |
| gebundene Items je TAG | 256 | bleibt weit unter jeder D1-/R2-Grenze und begrenzt Publish-Laufzeit |
| Länge `copy`-Textfeld | 2 048 Zeichen | schützt vor „Textwüsten" in Vorlagen |
| Absätze je `text`-Element | 8 | konsistent zum bestehenden Renderer |
| Gesamtgröße Template (unkomprimiert) | 48 KiB | ein Dokument bleibt ein kleines, prüfbares Artefakt |
| `displayOrder` | 0..999 | sortierbar, kollisionsarm |
| Verschachtelungstiefe | 5 | verhindert pathologische Strukturen |

Alle Werte sind Vorschläge und in Abschnitt 13 als Entscheidungen markiert (`D-05`). Sie müssen vor der Contract-Fassung bestätigt werden, weil sie später nur als Breaking Change änderbar sind.

### 5.10 Beispiel: Vault-Template (verkürzt, aber valide Struktur)

```json
{
  "schema": "myqr24-tag-content-template-v1",
  "schemaVersion": 1,
  "template": {
    "templateId": "tvt_vault_standard",
    "templateVersion": 1,
    "tagType": "vault",
    "name": "Vault – Standard",
    "description": "Öffentliche Standardansicht: Titel, Hinweis, Text und Galerie.",
    "locale": "de-DE",
    "status": "draft",
    "compatibility": { "protectionModes": ["public", "pin_required"], "presentations": ["standard"] }
  },
  "shell": {
    "presentation": "standard",
    "features": ["vault"],
    "theme": {
      "colorMode": "light",
      "colors": {
        "background": "#f7f5f0",
        "surface": "#ffffff",
        "text": "#1c1c1c",
        "mutedText": "#5a5a5a",
        "accent": "#1f513d",
        "accentText": "#ffffff",
        "border": "#e2ded6"
      },
      "typography": { "fontFamily": "system", "headingScale": 1.0, "bodySize": 16 },
      "layout": { "contentWidth": "narrow", "density": "comfortable", "cornerStyle": "soft" }
    },
    "navigation": { "mode": "single", "items": [] },
    "statusBar": { "showTagId": true, "showPresentation": false }
  },
  "elements": [
    {
      "elementId": "cel_hero",
      "elementType": "hero",
      "displayOrder": 10,
      "visibility": "public",
      "payload": { "variant": "cover" },
      "bindings": { "title": { "from": "tag.displayName" } },
      "copy": { "subtitle": "Öffentliche Informationen zu diesem TAG" },
      "slots": [
        { "slotId": "cover", "accepts": ["image"], "min": 0, "max": 1, "required": false, "presentation": { "fit": "cover", "caption": "none" } }
      ]
    },
    {
      "elementId": "cel_notice",
      "elementType": "callout",
      "displayOrder": 20,
      "visibility": "public",
      "payload": { "tone": "info" },
      "copy": {
        "title": "Hinweis",
        "text": "Private Inhalte werden in dieser öffentlichen Ansicht nicht angezeigt."
      }
    },
    {
      "elementId": "cel_text",
      "elementType": "text",
      "displayOrder": 30,
      "visibility": "public",
      "payload": { "tone": "default", "maxParagraphs": 8 },
      "copy": {
        "title": "Informationen",
        "paragraphs": ["Dieses TAG gehört zu einer myQR24-Installation.", "Weitere Inhalte folgen nach der Veröffentlichung."]
      }
    },
    {
      "elementId": "cel_gallery",
      "elementType": "gallery",
      "displayOrder": 40,
      "visibility": "public",
      "payload": {
        "name": "Eindrücke",
        "picker": { "axis": "horizontal", "thumbSize": "md" },
        "viewer": { "sizeMode": "medium", "swipe": true },
        "lightbox": true,
        "maxImages": 48
      },
      "copy": { "heading": "Eindrücke" },
      "slots": [
        { "slotId": "images", "accepts": ["image"], "min": 1, "max": 48, "required": false, "presentation": { "fit": "cover", "caption": "optional" } }
      ]
    }
  ]
}
```

Beobachtung: Das Dokument enthält **keine** Bild-URL, keine `contentId`, keine Sichtbarkeitsentscheidung über den Vorschlag hinaus. Es ist damit in TCP ablegbar, ohne dass TCP Medien, Items oder D1-Zeilen kennen muss.

### 5.11 Beispiel: Lost-&-Found-Template (Auszug)

Ein zweiter TAG-Typ zeigt, warum Templates eigene Strukturen brauchen – nicht nur andere Farben:

```json
{
  "template": {
    "templateId": "tvt_lost_found_standard",
    "templateVersion": 1,
    "tagType": "lost-found",
    "name": "Lost & Found – Standard",
    "description": "Fundhinweis, Kontaktweg und optionale Fundfotos.",
    "locale": "de-DE",
    "status": "draft",
    "compatibility": { "protectionModes": ["public"], "presentations": ["standard"] }
  },
  "shell": {
    "presentation": "standard",
    "features": ["vault", "lost-found"],
    "theme": {
      "colorMode": "light",
      "colors": {
        "background": "#fff7e6",
        "surface": "#ffffff",
        "text": "#211c10",
        "mutedText": "#6b6046",
        "accent": "#b45309",
        "accentText": "#ffffff",
        "border": "#f0e2c4"
      },
      "typography": { "fontFamily": "system", "headingScale": 1.1, "bodySize": 17 },
      "layout": { "contentWidth": "narrow", "density": "comfortable", "cornerStyle": "round" }
    },
    "navigation": { "mode": "single", "items": [] },
    "statusBar": { "showTagId": true, "showPresentation": false }
  },
  "elements": [
    {
      "elementId": "cel_finder_notice",
      "elementType": "finder-notice",
      "displayOrder": 10,
      "visibility": "public",
      "payload": { "urgency": "high" },
      "copy": {
        "title": "Sie haben diesen Gegenstand gefunden?",
        "text": "Vielen Dank. Bitte nutzen Sie die unten stehende Funktion, damit der Eigentümer informiert werden kann."
      }
    },
    {
      "elementId": "cel_owner_text",
      "elementType": "text",
      "displayOrder": 20,
      "visibility": "public",
      "payload": { "tone": "default", "maxParagraphs": 4 },
      "copy": { "title": "Zum Gegenstand", "paragraphs": ["Dieses TAG kennzeichnet einen persönlichen Gegenstand."] }
    },
    {
      "elementId": "cel_finder_form",
      "elementType": "finder-form",
      "displayOrder": 30,
      "visibility": "public",
      "payload": { "channel": "server-mediated" },
      "copy": { "title": "Fund melden", "text": "Ihre Angaben werden ausschließlich zur Kontaktaufnahme verwendet." },
      "slots": [
        { "slotId": "photos", "accepts": ["image"], "min": 0, "max": 3, "required": false, "presentation": { "fit": "contain", "caption": "none", "downloadable": false } }
      ]
    }
  ]
}
```

Wichtige Grenze: `finder-form` und `contact-channel` sind **strukturell** beschreibbar, aber ohne tag-api-Endpunkte, Sessionbindung, Spam-Schutz und Retention nicht nutzbar. Sie bleiben im Template nur zulässig, wenn TCP das Feature `lost-found` für das TAG freigegeben hat; andernfalls blockiert der Publish (Abschnitt 6.2).

### 5.12 Validierungsstufen

| Stufe | Inhalt | Wo |
| --- | --- | --- |
| **L1 strukturell** | JSON-Schema: Pflichtfelder, Typen, Enums, Muster, Längen, `additionalProperties: false` | Designer, TCP |
| **L2 semantisch** | eindeutige `elementId`/`slotId`, `displayOrder` eindeutig und lückenlos sortierbar, Navigation referenziert existierende Elemente, `required`-Slots konsistent (`min >= 1`), `tagType`↔`elementType`-Kompatibilität, `compatibility.presentations` enthält `shell.presentation` | Designer, TCP |
| **L3 Policy** | keine HTML-/Script-Muster, keine `javascript:`/`data:`-Links, nur `https`-Links, keine Storage-Key-Felder, keine Secrets/PII-Muster, Größenlimits | Designer, TCP |
| **L4 Vorschau** | Rendering ohne Items: leere Slots als Platzhalter, Pflicht-Slots als Warnung, keine Laufzeitfehler | Designer |
| **L5 Instanz** | Publish gegen konkrete TAG-Policy: Schutzmodus zulässig, Features freigegeben, Sichtbarkeitsobergrenze eingehalten, Slots mit Items belegbar | TCP beim Publish |

Export im Designer nur bei fehlerfreiem L1–L3. L4 erzeugt Warnungen, keine Blocker. L5 existiert ausschließlich serverseitig.

### 5.13 Verbotene Inhalte

Unabhängig vom Schema sind im Template unzulässig:

- HTML-Tags, `<script>`, `<style>`, `on*`-Attribute, iFrames, SVG-Markup;
- CSS-Selektoren, `url(...)`, `expression(...)`, externe Stylesheets, externe Fonts;
- `javascript:`, `data:`, `file:`, `blob:`-URLs; `http:` nur, wenn eine spätere Allowlist es ausdrücklich erlaubt;
- Storage-Keys (`object_key`, `objectKey`, `r2_key`, `r2Key`), Bucket-Namen, Presigned URLs;
- PINs, Tokens, Session-IDs, Hashes, Pepper, Cloudflare-Credentials;
- personenbezogene Daten (Namen, Adressen, Telefonnummern, E-Mail-Adressen) als Vorlageninhalt;
- `content_id`s, Dateinamen oder Medien-URLs als Slot-Inhalt.

### 5.14 Layout-Modell: 12-Spalten-Grid mit Flusslayout

Das Layout verbindet ein **12-Spalten-Grid** mit **Flusslayout je Spalte und Gerät**. Die Entscheidung, wie viele Spalten tatsächlich entstehen, trifft der **Renderer** anhand der verfügbaren Breite – nicht der Designer.

```json
"layout": {
  "mode": "grid-flow",
  "columns": 12,
  "gap": "md",
  "container": { "maxWidth": "wide", "padding": "normal" },
  "responsive": {
    "autoReflow": true,
    "minColumnWidth": { "tablet": "16rem", "desktop": "18rem" },
    "preferredColumns": { "mobile": 1, "tablet": 2, "desktop": 3 }
  }
}
```

Je Element:

```json
"placement": {
  "span": { "mobile": 12, "tablet": 6, "desktop": 4 },
  "order": { "mobile": 20, "tablet": 20, "desktop": 20 },
  "minWidth": "18rem",
  "align": "stretch",
  "hint": "Nebeneinander nur ab Tablet sinnvoll"
}
```

**Render-Algorithmus (verbindlich, testbar):**

1. Effektive Spalten `C = clamp(1, floor(verfügbareBreite / minColumnWidth), preferredColumns)`.
2. Effektiver Span `S = clamp(1, placement.span, C)`; Elemente ohne `placement` sind `S = C`.
3. Die Grid-Zeile wird nach `order` gefüllt; passt ein Element nicht mehr, beginnt eine neue Zeile (Fluss).
4. Rotation/Größenänderung löst eine Neuberechnung aus (`ResizeObserver`), keine eigene „Orientation"-Variante.
5. Ohne JavaScript (Fallback) gilt `grid-template-columns: repeat(auto-fit, minmax(min-col, 1fr))` – gleiche Spalten, ohne individuelle Spans.
6. `hint` ist ein reiner Autorenhinweis für die Vorschau und wird **nicht** gerendert.

**Text-Regeln (verbindlich):** kein `overflow: hidden`, keine `max-height`-Klemmung, kein `text-overflow: ellipsis` für Inhalte; stattdessen `overflow-wrap: anywhere`, `hyphens: auto`, `white-space: normal`. Ein Textelement ist standardmäßig `span: 12`. Der Designer warnt, wenn ein Text bei der kleinsten Breite rechnerisch unter die Mindestlesbarkeit fällt – er verbietet es nicht, weil die Entscheidung beim Renderer liegt.

### 5.15 RichText-Modell (RTF)

Statische Texte und Überschriften dürfen formatiert werden, aber **nie als HTML**. Formatierung wird als validiertes Runs-Modell gespeichert; Absätze tragen Absatz-Attribute.

```json
"content": {
  "heading": "Informationen",
  "paragraphs": [
    {
      "runs": [
        { "text": "Bitte beachten Sie " },
        { "text": "diesen Hinweis", "marks": [{ "type": "bold" }], "color": "#b3261e",
          "background": "#fff3cd", "fontSize": 18, "fontFamily": "serif",
          "link": { "href": "https://example.org" } },
        { "text": " sowie die Öffnungszeiten." }
      ],
      "align": "center",
      "lineHeight": 1.5,
      "indent": 0,
      "list": { "kind": "bullet", "level": 1 }
    }
  ]
}
```

| Attribut | Werte | Grenze |
| --- | --- | --- |
| `marks[].type` | `bold`, `italic`, `underline` | geschlossene Liste |
| `color`, `background` | `#rrggbb` | keine Tokens, keine CSS-Funktionen |
| `fontSize` | `12, 14, 16, 18, 20, 24, 28, 32` | keine freien Pixelwerte |
| `fontFamily` | `sans`, `serif`, `mono` | Zuordnung zu Font-Stacks im Renderer |
| `link.href` | `https:` / `mailto:` | Allowlist, `rel="noopener noreferrer nofollow"` |
| `align` | `start`, `center`, `end` | Absatz |
| `lineHeight` | `1, 1.15, 1.3, 1.5, 1.75, 2` | Absatz |
| `indent` | `0…3` | Absatz ohne Liste |
| `list.kind`, `list.level` | `bullet`/`ordered`, `0…3` | **flaches** Listenmodell |
| `run.text` mit `"\n"` | weicher Umbruch | bleibt im selben Absatz (`hardBreak`) |

**Weiche Zeilenumbrüche:** `Shift+Enter` erzeugt einen Umbruch innerhalb des Absatzes. Gespeichert wird `"\n"` im Run-Text (kein neuer Block, kein Absatzabstand), im Editor ein `hardBreak` mit den Zeichen-Attributen des Runs. Vorteil: Absatz-Attribute (Ausrichtung, Zeilenabstand, Liste) gelten weiter für den ganzen Block; Nachteil: Zeilenumbrüche sind nicht einzeln adressierbar.

**Listen sind flach.** Jeder Absatz trägt höchstens eine Liste mit `kind` und `level`; der Renderer gruppiert benachbarte Absätze deterministisch zu verschachtelten `<ul>/<ol>` (`groupBlocks`). Ein Sprung von Ebene 0 auf 3 wird auf 1 normalisiert. Vorteil: v1-kompatible, additive Erweiterung ohne Schema-Bump, DB-freundlich für die spätere Projektion. Nachteil: echte Listensemantik (z. B. `start`-Attribut, gemischte Typen in einem `<li>`) wird nicht 1:1 abgebildet.

**HTML-Politik (verbindlich):**

1. **Kein HTML im Artefakt** – auch nicht „nur normales" Formatierungs-HTML. Export → Import → Export muss byte-identisch bleiben; Browser normalisieren HTML nicht deterministisch.
2. **HTML als Text** – `<b>Hallo</b>` wird wörtlich angezeigt, nie interpretiert (`textContent`, kein `innerHTML`).
3. **HTML als Eingabe** – Paste wird konvertiert: erlaubte Werte werden zu Tokens, alles andere (Tabellen, Bilder, Klassen, `style`-Strings, `<script>`) verworfen. Aktive Bestandteile entfernt der Sanitizer vorher.
4. **`javascript:` bleibt verboten** – als Link-Ziel und als Text ein Fehler (`POLICY_SCRIPT_URL`).
5. `POLICY_HTML_MARKUP` ist deshalb nur noch eine **Warnung** (Hinweis „wird als Text angezeigt").

Alternativ wäre ein Markdown-Subset möglich; es wurde verworfen, weil es einen Parser plus Sanitizer benötigt und die erlaubten Mittel weniger präzise begrenzt.

**Editor-Technologie (`D-34`):** Tiptap 3 / ProseMirror mit eigenem Schema (`doc > richHeading | paragraph | bulletList | orderedList`), Marks `bold`, `italic`, `underline`, `link`, `richStyle` (Farbe/Markierung/Größe/Familie) und Absatz-Attributen. Die Brücke zum Modell sind ausschließlich zwei pure Funktionen (`contentToDoc`, `docToContent`); Editor-JSON wird nie gespeichert, `getHTML()` ist per Architektur-Test verboten.

**Farbpalette (`D-37`):** Jedes Farbmenü (Zeichenfarbe, Markierung, Box-Hintergrund) bietet Theme-Farben, eine feste Standard-Palette, **eigene Farben** und einen RGB-Wähler. Eigene Farben sind Teil der Konfiguration:

```json
"palette": { "custom": ["#123456", "#aabbcc"] }
```

- max. 24 Einträge, ausschließlich `#rrggbb`, Duplikate werden zusammengefasst; Validierungscodes `PALETTE_INVALID`, `PALETTE_LIMIT`.
- Sie reisen mit `Save`/`Save as` in der `.tagcontent.json` (additiv, kein Schema-Bump) und sind **kein** Theme-Bestandteil – das Theme bleibt die Design-Quelle, die Palette nur Bedienkomfort.
- Bewusst nicht im Modell: benannte Farben, Farbverläufe im Text, Farben je Element als Freitext.

**Letzte Konfiguration (`D-38`):** Der zuletzt bearbeitete Stand wird entprellt (800 ms) als kanonisches JSON im `localStorage` (`myqr24.tcd.session.v1`) gesichert und beim Start/Reload wieder geladen – inklusive `palette.custom`. Unlesbare oder blockierende Stände fallen auf die ausgelieferte Vorlage zurück. Ein Schreiben in `public/` ist im Browser nicht möglich; für Weitergabe und Versionierung bleibt `Save` der Weg. Panel-Breiten werden getrennt gemerkt (`myqr24.tcd.leftWidth`, `myqr24.tcd.rightWidth`).

**Überschriften und Markdown (`D-39`–`D-42`):** Überschriften sind Absatz-Attribute (`heading: 1…5`) und damit beliebig positionierbar; `content.heading` aus schemaVersion 1 wird migriert. Die Leiste hat dafür ein **Absatzstil-Feld**, `#`-Kürzel und `Strg+Alt+1…5`; eine leere Überschrift wird per `Backspace` wieder Absatz (behebt den Fehler „gelöschte Überschrift lässt sich nicht neu anlegen"). Markdown ist **Ein-/Ausgabeformat**: Tipp-Kürzel, Paste über `markdown-it` (`html: false`) und ein Dialog, der den Export zeigt und beim Übernehmen den Feldinhalt ersetzt. Tabellen sind ein eigener Block mit Text-Zellen (max. 6 × 20), Kopfzeile und Spaltenausrichtung; erzeugt werden sie über Markdown (`` | a | b | `` plus Ausrichtungszeile).

**Textkontrolle:** Rechts steht das Runs-Modell des Textfelds als bearbeitbares JSON (scrollbar). Es wird beim Verlassen bzw. mit „Übernehmen" geparst und mit denselben Regeln wie die Gesamtvalidierung geprüft; nur fehlerfreie Inhalte werden übernommen. Damit lassen sich Fälle abbilden, die die Leiste (noch) nicht anbietet – ohne HTML und ohne Umgehung der Whitelists.

### 5.16 Gestaltungsmodell: Theme, Buttons, Hintergründe

Drei Ebenen, streng von allgemein nach speziell:

1. **`shell.theme`** – globale Tokens (Farben, Typografie, Abstände, Radius, Button-Stil).
2. **`element.style`** – Overrides je Element (Hintergrund, Textfarbe, Überschriftenfarbe, Rahmen, Innenabstand, Ausrichtung).
3. **`element.content`** – RTF-Tokens je Run (Marks, Farben `#rrggbb`, Größenskala, Schriftfamilie, Link) und Absatz-Attribute (Ausrichtung, Zeilenabstand, Einrückung, Liste).

```json
"theme": {
  "colorMode": "light",
  "colors": {
    "background": "#f7f5f0",
    "surface": "#ffffff",
    "text": "#1c1c1c",
    "mutedText": "#5a5a5a",
    "heading": "#14231c",
    "accent": "#1f513d",
    "accentText": "#ffffff",
    "border": "#e2ded6",
    "danger": "#b3261e",
    "success": "#1b6b3a"
  },
  "buttons": {
    "primary": { "background": "accent", "text": "accentText", "border": "none", "radius": "pill" },
    "secondary": { "background": "surface", "text": "text", "border": "thin", "radius": "soft" }
  },
  "typography": { "fontFamily": "system", "headingScale": 1.0, "bodySize": 16, "lineHeight": 1.55 },
  "layout": { "contentWidth": "narrow", "density": "comfortable", "cornerStyle": "soft" }
}
```

```json
"style": {
  "background": { "type": "solid", "color": "surface" },
  "headingColor": "heading",
  "textColor": "text",
  "border": { "style": "thin", "color": "border", "radius": "soft" },
  "padding": "md",
  "align": "start",
  "image": { "ref": "cel_theme:tag-background", "fit": "cover", "opacity": 0.18 }
}
```

Regeln:

- Farbwerte sind entweder **Palettentoken** oder `#rrggbb`; Verläufe nur als `{ "type": "linear", "from": "token|#hex", "to": "token|#hex", "angle": 0..360 }`.
- `buttons.*` dürfen nur Token/Hex und geschlossene Enums enthalten (kein CSS).
- **Hintergrundbilder** sind keine Template-Dateien: Das Template deklariert einen Slot bzw. eine Referenz (`cel_theme:tag-background`), das Bild selbst ist ein Content-Item (siehe 6.7).
- Kontrast wird geprüft (Text/Background, Button/Text). Unterschreitung → Warnung im Designer, **kein** Publish-Blocker, weil Markenfarbe Vorrang haben kann; die Warnung wird im TCC beim Upload angezeigt.
- Der User-Designer darf nur die als `editable` markierten Tokens/Overrides ändern (5.18).

### 5.17 Interaktionen und Rechte je Element

Upload, Download und Löschen sind **Buttons mit Policy**, keine versteckten Gesten. Die Policy wird je Element deklariert und serverseitig durchgesetzt.

```json
"actions": {
  "upload": {
    "enabled": true,
    "principals": ["guest", "owner"],
    "acceptedTypes": ["image"],
    "maxItemsPerPrincipal": 3,
    "maxFileSizeMb": 10,
    "afterUpload": "quarantine"
  },
  "download": { "enabled": true, "principals": ["scanner", "guest", "owner"] },
  "delete":   { "enabled": true, "principals": ["owner", "guest"], "guestScope": "ownOnly" }
}
```

| Principal | Bedeutung |
| --- | --- |
| `scanner` | anonyme öffentliche Session (Scope `public`) |
| `guest` | Gast-Session mit Scope `shared`, gebunden an eine Sitzung |
| `owner` | Owner-Session (heute nicht implementiert, `APP-US-*`/`APP-WP-08`) |
| `admin` | Plattformbetrieb (nur TCC/TCP, nie TAG-App) |

**Dreistufige Autorität:**

1. Das Template **beantragt** die Policy und liefert die UI-Konfiguration (Texte, Icons, Position der Buttons).
2. TCP prüft beim Publish die Obergrenze (Produkt-/TAG-Policy): Ein Template darf Rechte **nie** erweitern, nur einschränken.
3. Die tag-api entscheidet **pro Request** (Session, Scope, Eigentum, Item-Status) und liefert die effektiven Capabilities; die TAG-App rendert Buttons nur, wenn die API sie bestätigt.

**Eigentumsprüfung:** „Gast darf nur eigene Bilder löschen" setzt eine Bindung `Item → Session` voraus. Ohne diese Bindung ist die Regel nicht prüfbar und der Button darf nicht erscheinen. Details und die noch offene Identitätsfrage stehen in 8.5 und in den optionalen Punkten (Abschnitt 19).

**Missbrauchsgrenzen:** Uploads landen zunächst in `pending`/`quarantined` (`status` ist in D1 bereits vorgesehen), werden nie ungeprüft öffentlich, haben Größen-/Mengenlimits pro Session und TAG und sind auditierbar. Downloads und Löschungen sind ebenso zu protokollieren.

### 5.18 Editierbarkeit für den User-Designer

Damit der User-Designer **datengetrieben** arbeiten kann und nicht pro Vorlage programmiert wird, deklariert das Master-Template, was ein Benutzer ändern darf. Grundsatz: **Whitelist, deny by default.**

```json
"editability": {
  "allow": [
    "content.text",
    "style.background.color",
    "style.headingColor",
    "theme.colors.accent",
    "theme.buttons.primary.background",
    "placement.order",
    "placement.span",
    "payload.display",
    "payload.picker.axis",
    "slots.images.max"
  ],
  "limits": {
    "allowAddElements": false,
    "allowRemoveElements": true,
    "maxRemovedElements": 2,
    "allowReorder": true,
    "allowThemeImage": true,
    "minRemainingElements": 1
  },
  "fieldRules": [
    { "path": "content.heading", "maxLength": 120 },
    { "path": "content.paragraphs", "maxItems": 8, "maxLength": 2048 }
  ]
}
```

| Regel | Bedeutung |
| --- | --- |
| `allow` | Pfade, die der Benutzer ändern darf; alles andere ist gesperrt |
| `limits` | strukturelle Grenzen (Elemente hinzufügen/entfernen/umsortieren) |
| `fieldRules` | Längen- und Mengenbegrenzungen je Feld |
| `elements[].editability` | elementbezogene Ergänzung/Überschreibung der globalen Regeln |
| `locked: true` | Element ist sichtbar, aber vollständig unveränderlich |

Verboten bleiben immer: `elementType`, Slot-Identitäten, `actions`-Obergrenzen, `visibility`, Feature-Listen, `schemaVersion`. Diese Felder sind nie editierbar, unabhängig von der Konfiguration.

### 5.19 Optionaler Katalog (später, ausdrücklich nicht v1)

Diese Elemente und Funktionen sind vorgemerkt. Sie werden **nicht** in v1 umgesetzt, aber das Format hält Platz dafür frei, damit später keine Breaking Changes nötig sind.

| Vorschlag | Zweck | Datenbedarf |
| --- | --- | --- |
| `maintenance-history` | Wartungs-/Reparaturhistorie mit Datum, Umfang, Nachweisen | Item-Metadaten (Datum, Typ, Laufleistung), `item.json` oder `item_attributes` |
| `timeline` | allgemeine Chronik (Stationen, Ereignisse) | wie Wartung, ohne Fachfelder |
| `faq` / `accordion` | aufklappbare Fragen und Antworten | rein textlich |
| `link-collection` | geprüfte Linkliste (Speisekarte, Website, Social) | `https`-Allowlist |
| `contact-card` | Kontakt über serverseitige Vermittlung | Session-/Vermittlungsendpunkt |
| `instruction-steps` | numerierte Sicherheits-/Bedienhinweise | rein textlich |
| `price-table` / `menu` | Preis-/Speisekarte mit Positionen | strukturierte Zeilen im Payload |
| `video` | einzelnes Video mit Untertitel | Medienvariante `video`, Autoplay verboten |
| `audio-guide` | Kapitel und Player | Medienvariante `audio` |
| `map-location` | Kartenausschnitt/POI | Geo-Daten, Datenschutzentscheidung |

Zusätzlich als **optionale Layout-Funktionen**: benannte `sections` (Gruppierung mit eigener Überschrift und eigenem Hintergrund), `sticky`-Navigation und ein `toc`-Element. Sie sind bewusst zurückgestellt, weil sie die Reflow-Logik verkomplizieren und zuerst mit echten TAGs erprobt werden sollen.

### 5.20 Vollständiges Instanz-Beispiel (Revision 2)

So sieht die gespeicherte JSON-Beschreibung eines TAGs aus, wenn ein Benutzer eine Vault-Vorlage individualisiert hat. Geflattet, ohne Referenzen auf Element-Templates, ohne Medien-URLs:

```json
{
  "schema": "myqr24-tag-content-instance-v1",
  "schemaVersion": 1,
  "derivedFrom": { "templateId": "tct_vault_standard", "templateVersion": 3 },
  "tagType": "vault",
  "locale": "de-DE",
  "theme": {
    "colorMode": "light",
    "colors": {
      "background": "#f7f5f0",
      "surface": "#ffffff",
      "text": "#1c1c1c",
      "mutedText": "#5a5a5a",
      "heading": "#14231c",
      "accent": "#1f513d",
      "accentText": "#ffffff",
      "border": "#e2ded6"
    },
    "buttons": {
      "primary": { "background": "accent", "text": "accentText", "border": "none", "radius": "pill" },
      "secondary": { "background": "surface", "text": "text", "border": "thin", "radius": "soft" }
    },
    "typography": { "fontFamily": "system", "headingScale": 1, "bodySize": 16, "lineHeight": 1.55 },
    "layout": { "contentWidth": "narrow", "density": "comfortable", "cornerStyle": "soft" }
  },
  "layout": {
    "mode": "grid-flow",
    "columns": 12,
    "gap": "md",
    "container": { "maxWidth": "wide", "padding": "normal" },
    "responsive": {
      "autoReflow": true,
      "minColumnWidth": { "tablet": "16rem", "desktop": "18rem" },
      "preferredColumns": { "mobile": 1, "tablet": 2, "desktop": 3 }
    }
  },
  "navigation": { "mode": "single", "items": [] },
  "elements": [
    {
      "elementId": "cel_theme",
      "elementType": "theme-assets",
      "hidden": true,
      "visibility": "public",
      "payload": { "role": "background" },
      "slots": [ { "slotId": "tag-background", "accepts": ["image"], "min": 0, "max": 1, "required": false } ]
    },
    {
      "elementId": "cel_intro",
      "elementType": "text",
      "displayOrder": 10,
      "visibility": "public",
      "placement": { "span": { "mobile": 12, "tablet": 12, "desktop": 8 }, "order": 10 },
      "style": { "background": { "type": "solid", "color": "surface" }, "headingColor": "heading", "textColor": "text" },
      "payload": { "headingLevel": "h1", "align": "start" },
      "content": {
        "heading": "Reisekoffer",
        "paragraphs": [
          { "runs": [ { "text": "Dieses TAG gehört zu einem " }, { "text": "privaten Reisekoffer", "marks": ["bold"] }, { "text": "." } ] }
        ]
      }
    },
    {
      "elementId": "cel_cover",
      "elementType": "image",
      "displayOrder": 20,
      "visibility": "public",
      "placement": { "span": { "mobile": 12, "tablet": 6, "desktop": 4 }, "order": 20 },
      "payload": { "fit": "cover", "zoom": "tap", "maxHeight": "screen" },
      "actions": { "download": { "enabled": true, "principals": ["owner"] }, "delete": { "enabled": true, "principals": ["owner"] } },
      "slots": [ { "slotId": "image", "accepts": ["image"], "min": 1, "max": 1, "required": true } ]
    },
    {
      "elementId": "cel_gallery",
      "elementType": "gallery",
      "displayOrder": 30,
      "visibility": "public",
      "placement": { "span": { "mobile": 12, "tablet": 12, "desktop": 8 }, "order": 30 },
      "payload": {
        "name": "Eindrücke",
        "picker": { "axis": "horizontal", "thumbSize": "md", "showCounter": true },
        "viewer": { "sizeMode": "medium", "swipe": true, "loop": false, "showCaptions": true },
        "lightbox": true,
        "maxImages": 48
      },
      "actions": {
        "upload": { "enabled": true, "principals": ["guest", "owner"], "acceptedTypes": ["image"], "maxItemsPerPrincipal": 3, "maxFileSizeMb": 10, "afterUpload": "quarantine" },
        "download": { "enabled": true, "principals": ["scanner", "guest", "owner"] },
        "delete": { "enabled": true, "principals": ["owner", "guest"], "guestScope": "ownOnly" }
      },
      "editability": { "allow": ["content.heading", "style.background.color", "payload.picker.axis", "placement.span"] },
      "slots": [ { "slotId": "images", "accepts": ["image"], "min": 0, "max": 48, "required": false } ]
    },
    {
      "elementId": "cel_docs",
      "elementType": "documents",
      "displayOrder": 40,
      "visibility": "shared",
      "placement": { "span": { "mobile": 12, "tablet": 12, "desktop": 12 }, "order": 40 },
      "payload": { "view": "list", "showMeta": true, "sort": "date-desc", "maxItems": 32 },
      "actions": { "upload": { "enabled": false }, "download": { "enabled": true, "principals": ["guest", "owner"] } },
      "slots": [ { "slotId": "documents", "accepts": ["document"], "min": 0, "max": 32, "required": false } ]
    }
  ]
}
```

Hinweise zum Beispiel: `cel_theme` ist unsichtbar und liefert nur das Hintergrundbild; `cel_docs` ist `shared` und erscheint deshalb **nicht** in `view.vault.blocks`; alle Buttons sind beantragt, nicht garantiert – die API bestätigt sie zur Laufzeit. Das Dokument bleibt unter dem Größenlimit aus 5.9.

---

## 6. Abbildung auf die tag-api-Projektion

### 6.1 Mapping Template → Laufzeit

| Template-Feld | Publish-Ziel | Anmerkung |
| --- | --- | --- |
| `template.templateId`, `template.templateVersion` | TAG-JSON `template: { "templateId", "templateVersion" }` (additives Feld) und TCP-Metadaten | erlaubt Reproduktion „TAG X wurde aus Vorlage Y in Version Z erzeugt"; `isContentDocument` ignoriert zusätzliche Felder |
| `shell.presentation` | `view.tag.presentation` | muss in `PublicTagView.tag.presentation` enthalten sein |
| `shell.features` | `view.enabledFeatures` | Schnittmenge mit den für das TAG freigegebenen Features |
| `shell.theme`, `shell.navigation`, `shell.statusBar` | `view.shell` (neues additives Objekt) | die TAG-App liest es erst nach Phase 2 (Abschnitt 6.5) |
| `element.elementId` | `tag_content_elements.content_element_id` | `cel_*`-Muster ist in D1 bereits erzwungen |
| `element.elementType` | `tag_content_elements.content_element_type` und `element-rev{n}.json`.`elementType` | |
| `element.displayOrder` | `tag_content_elements.display_order` | |
| `element.visibility` (Vorschlag) | `tag_content_elements.visibility` (effektiv) | Effektivwert = restriktiverer Wert aus Vorschlag und TAG-Policy (Abschnitt 6.2) |
| `element.style`, `element.payload`, aufgelöste `copy`/`bindings`, `element.slots` | `element-rev{n}.json`.`payload` | `payload` wird zu einem selbsttragenden Objekt: `{ …typspezifische Felder, style, content, slots }` |
| `element.slots[]` | Slot-Beschreibung im Element-Payload **und** Gruppenhinweis in `tag_content_element_items` | Slot = Anforderung, Mitgliedschaft = tatsächliche Belegung |
| gebundene Items | `tag_content_items`, `tag_content_element_items`, `tag_content_media_variants`, R2-Items | bestehender Weg, unverändert |
| `elements` mit `visibility: "public"` | zusätzlich abgeleitete `view.vault.blocks` (Phase 1) | siehe Abschnitt 6.2 und 6.5 |

Element-Payload nach dem Publish (Beispiel `gallery`):

```json
{
  "schema": "myqr24-tag-element-v1",
  "elementId": "cel_gallery",
  "elementType": "gallery",
  "payload": {
    "name": "Eindrücke",
    "picker": { "axis": "horizontal", "thumbSize": "md" },
    "viewer": { "sizeMode": "medium", "swipe": true },
    "lightbox": true,
    "maxImages": 48,
    "style": { "background": { "type": "solid", "color": "surface" }, "padding": "normal" },
    "content": { "heading": "Eindrücke" },
    "slots": [
      { "slotId": "images", "accepts": ["image"], "min": 1, "max": 48, "required": false, "presentation": { "fit": "cover", "caption": "optional" } }
    ]
  }
}
```

Damit ist das Element ohne Kenntnis des Templates renderbar; `presigned`-freie Items liefert die API separat über `items[]`. `payload` bleibt ein freies Objekt und ist mit `isElementDocument` kompatibel.

### 6.2 `view`-Ableitung und die Sichtbarkeitsregel

**Sicherheitsregel (verbindlich zu übernehmen):**

> In `view` (also in `tag-rev{n}.json`) dürfen ausschließlich Inhalte projiziert werden, die für **jede** Session sichtbar sind. Nicht-öffentliche Elemente erscheinen ausschließlich in `elements[]`, weil nur dort serverseitig gefiltert wird.

Konkret für Phase 1:

| Element-`visibility` | in `view.vault.blocks` | in `elements[]` (Content-Response) |
| --- | --- | --- |
| `public` | ja | ja, für alle Scopes |
| `shared` | **nein** | nur Scope `pin`/`login` |
| `private` | **nein** | derzeit für keinen Scanner-Scope |
| `ownerOnly` | **nein** | derzeit für keinen Scanner-Scope |

Effektive Sichtbarkeit beim Publish:

```text
effektiv = restriktiverWert( templateElement.visibility , tagPolicyCeiling(protection_mode) )

tagPolicyCeiling:
  public          -> public
  pin_required    -> shared
  login_required  -> shared
  closed          -> kein Publish (öffentliche Ansicht ist gesperrt)
```

Zusätzlich gilt:

- **Obergrenze:** Die effektive Sichtbarkeit eines Elements darf die Obergrenze des Schutzmodus nicht überschreiten. Ein Element mit `visibility: "private"` in einem `public`- oder `pin_required`-TAG ist ein Publish-Fehler, weil die tag-api derzeit keinen Owner-/Gast-Scope ausstellt (Entscheidung `D-07`).
- **Erreichbarkeit:** Ein Element mit `visibility: "shared"` in einem `public`-TAG wäre für keine Session erreichbar. Auch das ist ein Publish-Fehler mit klarer Meldung – ausdrücklich **keine** stillschweigende Herabstufung auf `public`, weil das eine Rechteausweitung wäre.
- **Keine Rechteausweitung:** Ein Template darf weder Sichtbarkeit noch Schutzmodus erhöhen. Jede Abweichung zwischen Vorschlag und Policy wird gemeldet, nicht automatisch aufgelöst.
- **Features:** `shell.features` wird gegen die Feature-Freigabe des TAGs geschnitten; ein Template kann kein Feature „einschalten". `finder-form`/`contact-channel` ohne freigegebenes `lost-found`-Feature sind ein Publish-Fehler, keine stille Entfernung.

### 6.3 Kanonischer Hash und Revision

1. Das Template wird **kanonisch serialisiert**: Schlüssel alphabetisch sortiert, keine überflüssigen Leerzeichen, UTF-8 ohne BOM, LF.
2. TCP berechnet `content_sha256` über genau diese Bytes und vergleicht mit dem vom TCC übermittelten Hash (nur informativ, nie autoritativ).
3. Beim Publish entsteht **eine neue** Content-Revision `n+1`. Sie wird **atomar** gesetzt:
   - Elementdateien zuerst schreiben (R2), dann TAG-Datei, dann D1-`tag_content`-Pointer und `tag_routing.content_revision` im selben Batch;
   - `tag_content.content_sha256`/`content_bytes` müssen zur geschriebenen Datei passen, sonst bricht die API fail-closed ab (bereits implementiertes Verhalten).
4. Es gibt **keine** Template-Revisionstabelle in D1. Revisionen bleiben in TCP.

### 6.4 Drei Versionen, klar getrennt

| Version | Bedeutung | Wer ändert sie |
| --- | --- | --- |
| `schemaVersion` | Format des Autorendokuments | Plattform, nur mit Migration |
| `template.templateVersion` | fachliche Version der Vorlage | Autor, beim Upload bestätigt |
| `content_revision` (Runtime) | pro TAG veröffentlichter Stand | TCP-Publish, monoton |

Kompatibilitätsmatrix (Vorschlag):

| Autorenformat | tag-api-Projektion | Ergebnis |
| --- | --- | --- |
| `v1` | `myqr24-tag-content-v2` + `myqr24-tag-element-v1` | gültig (dieses Refinement) |
| `v1` | `myqr24-tag-content-v1` | abgelehnt, `schemaVersion` passt nicht |
| `v2` | `v2` | erst nach Contract-Erweiterung und Migrationspfad |

Ein Template mit unbekannter `schemaVersion` wird **nicht** interpretiert, sondern neutral abgelehnt – kein „Best effort"-Lesen.

### 6.5 Entscheidung `D-03`: woraus rendert die TAG-App?

| Variante | Vorgehen | Vorteil | Nachteil |
| --- | --- | --- | --- |
| **P1 – Ableitung** | TCP erzeugt `view.vault.blocks` aus den `public`-Elementen; TAG-App bleibt unverändert | sofort nutzbar, kein TAG-App-Release, kein Contract-Bruch | Inhalte stehen doppelt (view + element), `shared`/`private` bleiben unsichtbar, Shell-Theming noch nicht wirksam |
| **P2 – Elementrendering** | TAG-App rendert `elements[]` + `items[]`, `view` trägt nur Shell, Tags, Features | eine Autorität, echte Sichtbarkeitsfilterung, Theme und Navigation wirksam | TAG-App-Refactor, neuer Content-Contract (`v3`/`view v2`), Migrationsfenster, neue Tests |

**Empfehlung:** P1 als erster, klar befristeter Schritt (Tool sofort produktiv, keine Sicherheitsregression), P2 als eigener Contract-/Story-Strang mit eigenem Gate. P1 ist ausdrücklich **kein** Zielzustand: sobald `shared`-Inhalte erscheinen sollen, ist P2 Voraussetzung.

In P1 gilt zusätzlich: `view.vault.blocks` wird **generiert**, nie von Hand gepflegt. Ein manuell editiertes `view` wäre eine zweite Autorität und ist zu unterbinden.

### 6.6 Deployment je TAG (Snapshot)

Jede TAG-Instanz wird als **eigener Snapshot** veröffentlicht – auch wenn sie einer unveränderten Standardvorlage entspricht. Gemeinsame Dateien zwischen TAGs gibt es nicht.

| Schritt | Ergebnis | Regel |
| --- | --- | --- |
| 1 | Instanz-JSON (geflattet) validieren | L1–L3 plus L5 (Policy, Features, Pflicht-Slots) |
| 2 | Elementdateien schreiben | `content-paths.ts` leitet alle Keys aus `tagNumericId` + Dateiname ab |
| 3 | TAG-Datei schreiben | `tag-rev{n}.json` mit `template`, `theme`, `layout`, `navigation`, `elements` |
| 4 | D1-Batch | `tag_content`, `tag_content_elements`, `tag_content_element_items` |
| 5 | Routing-Pointer | `tag_routing.content_revision = n`, im selben Batch |
| 6 | Audit/Outbox | Publish gilt erst nach Commit |

Warum kein Sharing: Ein gemeinsames Vorlagen-JSON würde bei jeder Vorlagenänderung alle TAGs gleichzeitig verändern, wäre nicht widerrufbar und würde die Revision pro TAG entwerten. Der Snapshot kostet wenige Kilobyte und erlaubt Reprojektion, Rollback und unabhängige Weiterentwicklung.

Aufräumen: Alte Revisionen bleiben lesbar, bis ein separater Cleanup-Lauf sie entfernt; ein Rollback zeigt auf die vorherige Revision, ohne Dateien neu zu schreiben.

### 6.7 Theme-Assets und Hintergrundbilder

Hintergrundbilder sind **Inhalte**, keine Designdateien. Damit das Template weiterhin frei von Medien bleibt, gilt:

1. Das Master-Template deklariert ein **verstecktes Theme-Element** `cel_theme` vom Typ `theme-assets` (nicht sichtbar, `visibility: public`) mit dem Slot `tag-background` (`image`, max 1).
2. Im User-Designer wählt der Benutzer ein Bild aus seinen Inhalten; beim Speichern wird es als Item an `cel_theme/tag-background` gebunden.
3. Die Projektion erzeugt dafür die üblichen Dateien/Zeilen – es braucht **keine** neue Tabelle und keinen Sonderweg in der API.
4. Das sichtbare Theme referenziert nur `"image": { "ref": "cel_theme:tag-background" }`; die URL entsteht zur Laufzeit über `POST /api/get-image-url`.

Regeln: Theme-Bilder sind **immer öffentlich** (sonst wären sie über `view`/Theme leakbar), brauchen eine Kontrast-/Lesbarkeitsprüfung (Overlay, Opazität) und dürfen keine fremden Rechte verletzen. Ein späterer dedizierter Endpunkt ist möglich, aber nicht nötig.

### 6.8 Medienvarianten

Verbindlicher Variantenvertrag (baut auf `tag_content_media_variants` und `POST /api/get-image-url` auf):

| Variante | Richtwert | Verwendung |
| --- | --- | --- |
| `thumb` | ~320 px | Picker, Icon-Listen, kleine Vorschauen |
| `mid` | ~1280 px | Standardansicht, Karussell, Erstladebild |
| `full` | Original bzw. ~2560 px | Lightbox, Zoom, Download |
| `cover` | bestehend | Rückwärtskompatibilität, wird auf `mid` abgebildet |

Regeln: Der Browser fordert immer die kleinste ausreichende Variante an, lädt `full` erst bei Zoom/Download, und signierte URLs werden nicht persistiert. Fehlt eine Variante, antwortet die API neutral (kein Fallback auf einen fremden Key).

---

## 7. Tool-Konzept: `tools/tag-content-designer`

### 7.1 Abgrenzung zum Label-Designer

| Aspekt | `tools/tag-designer` | `tools/tag-content-designer` |
| --- | --- | --- |
| Zielobjekt | physisches Etikett | TAG-Content-Template |
| Geometrie | mm/px/DPI, frei positionierbare Objekte | responsive Shell, geordnete Elemente, keine freie Positionierung |
| Export | PNG | JSON (`myqr24-tag-content-template-v1`) |
| Inhalte | Bilder, Texte, Formen als Grafik | Elemente mit Slots, Copy, Bindings; **keine** Mediendateien |
| Veröffentlichung | kein Bezug zu TCP | Upload über TCC → TCP → tag-api |
| Gemeinsamkeiten | Browser-only, Import/Export, Live-Vorschau, Autosave, deterministische Ausgabe | dito |

Wichtig: Elemente werden **nicht** frei auf einer Fläche platziert. Eine TAG-Ansicht ist ein responsives Fließlayout; freie Positionierung wäre auf Mobilgeräten nicht beherrschbar und würde die TAG-App zu einem Canvas-Renderer zwingen.

### 7.2 Technikentscheidung (`D-08`)

| Variante | Bewertung |
| --- | --- |
| **Vanilla TypeScript + Vite** (wie `tag-designer`) | konsistent zum bestehenden Tool, keine Framework-Abhängigkeit, aber der Vorschau-Renderer müsste die React-Komponenten der TAG-App nachbauen → hohes Divergenzrisiko bei genau der Funktion, die das Tool ausmacht |
| **React + TypeScript + Vite** (wie `apps/tag-app`) | Vorschau kann die **echten** Render-Komponenten der TAG-App nutzen; `package.json`-Konventionen (`tsc --noEmit && vite build`) sind identisch; neue Abhängigkeit im Tool, aber im Repo bereits etabliert |
| **Shared Package** (`packages/tag-content-renderer`) | maximale Parität über Tool und App; erfordert Änderung der Root-Workspaces (`apps/*` → zusätzlich `packages/*`) und einen TAG-App-Refactor |

**Empfehlung:** React für das Tool, mittelfristig Shared Package. Begründung: Der Mehrwert eines *View*-Designers ist die Übereinstimmung mit der echten Ansicht. Ein nachgebauter Vanilla-Renderer wäre dauerhaft eine zweite Wahrheit (Befund G-05).

### 7.3 Vorgeschlagene Verzeichnisstruktur

```text
tools/tag-content-designer/
  index.html
  package.json                    # @myqr24/tag-content-designer, scripts dev/build/preview
  tsconfig.json
  vite.config.ts
  public/
    templates/
      vault-standard.tagcontent.json
      lost-found-standard.tagcontent.json
    elements/
      default.tagelements.json     # Default-Bibliothek, wird beim Start geladen
    element-catalog.json          # Katalog für UI, ohne Codeänderung erweiterbar
  doc/
    SPECIFICATION.md              # aus diesem Refinement abgeleitete Spezifikation
  src/
    main.tsx
    App.tsx
    styles.css
    state/
      templateStore.ts            # Undo/Redo, Autosave, Dirty-State
      libraryStore.ts             # Bibliothek, libraryVersion, Merge
      fileAccess.ts               # File System Access API + Fallback, Handle-Merken
      migrate.ts                  # schemaVersion-Migration beim Laden
    domain/
      types.ts                    # TagContentTemplate, TemplateElement, Slot, Binding
      catalog.ts                  # Elementtypen, Felder, Defaults, tagType-Matrix
      validate.ts                 # L1–L3
      serialize.ts                # kanonische Serialisierung, Hash
      migrate.ts                  # Migrationskette (pure Funktionen)
      library.ts                  # Element-Bibliothek laden/mergen/exportieren
      errors.ts                   # Fehlercodes, Pfade, Hinweise
      bindings.ts                 # Binding-Auflösung (Vorschau)
    ui/
      TopBar.tsx                  # Neu, Öffnen, Speichern, Export, Undo/Redo, Zoom
      TemplateLibrary.tsx         # Vorlagenwahl (Vault, Lost & Found, leer)
      OutlinePanel.tsx            # Elementliste, Reihenfolge, Navigation
      ElementInspector.tsx        # Eigenschaften des gewählten Elements
      ShellInspector.tsx          # Präsentation, Theme, Features
      PreviewCanvas.tsx           # Vorschau über TagContentPreview
      ValidationPanel.tsx         # Fehler/Warnungen, Sprung zum Feld
      JsonPanel.tsx               # read-only JSON + Diff
    preview/
      TagContentPreview.tsx          # Shell + Elemente + Slot-Platzhalter
      placeholders.ts             # Musterbilder/-dokumente, keine echten Medien
    test/
      validate.test.ts
      serialize.test.ts
      bindings.test.ts
      preview.test.tsx
      fixtures/*.json
```

### 7.4 Bedienoberfläche

| Bereich | Inhalt |
| --- | --- |
| **Kopfzeile** | Projektname, Vorlage wählen, Neu, **Load**, **Save** (gleiche Datei), **Save as** (neue Datei), Rückgängig/Wiederholen, Geräteumschaltung (mobil/tablet/desktop), Statusanzeige „gültig / n Fehler" |
| **Bibliotheksleiste** | Element-Bibliothek: Anzeige `libraryVersion`, **Load**, **Save**, **Save as**, Zurücksetzen auf Default |
| **Linke Spalte** | Vorlagenbibliothek und Elementbibliothek (nur Typen, die der gewählte `tagType` erlaubt), plus Gliederung der vorhandenen Elemente; **Breite per Ziehgriff verstellbar** (ca. 220–680 px), damit lange Elementnamen und JSON lesbar bleiben |
| **Mitte** | Live-Vorschau als TAG-Ansicht mit Gerätebreite, Platzhaltermedien, klickbaren Elementen und optionalem Raster; **Texte sind hier direkt editierbar** (Formatierleiste erscheint beim Fokus) |
| **Rechte Spalte** | Kontextinspektor: Shell (Präsentation, Theme, Features, Navigation) oder Element (Typ, Reihenfolge, Sichtbarkeit, `payload`, `copy`, `bindings`, Slots). **Texte sind hier nur Kontrollansicht** – bearbeitet und formatiert wird in der Vorschau, damit kein zweiter Editor die Inline-Marks überschreibt |
| **Unten** | Validierungsleiste mit Fehler-/Warnzähler, JSON-Ansicht und Hash |
| **Statusleiste** | Dateiname (bzw. „nicht gespeichert"), `templateId@version`, Schema-Version, Elementanzahl, geschätzte Größe, Autosave-Zeitpunkt |

Bewusste Bedienregeln:

1. Kein „Speichern in der Cloud", kein Login, kein Netzwerkzugriff im Tool.
2. Elemente lassen sich per Drag-and-drop sortieren; die `displayOrder` wird beim Export neu und lückenlos vergeben (10, 20, 30 …).
3. Nicht erlaubte Elementtypen werden im Katalog **ausgeblendet**, nicht deaktiviert angezeigt, um Fehlbedienung zu vermeiden.
4. Warnungen sind sichtbar, blockieren aber den Export nicht; Fehler blockieren ihn.
5. Jede Änderung ist rückgängig zu machen (Undo-Stack mindestens 50 Schritte).
6. **Direktes Editieren (RTF):** Textfelder sind in der Vorschau selbst editierbar; beim Fokus erscheint **oberhalb** die Leiste: Fett/Kursiv/Unterstrich, Ausrichtung, Aufzählung/Nummerierung, Ein-/Ausrücken, Schriftgröße/-familie, Zeilenabstand, Zeichenfarbe, Markierung, Box-Hintergrund, Link und „Formatierung entfernen". Zeichenfarbe/Markierung/Größe/Familie wirken auf die Auswahl, Absatzfunktionen auf die Absätze der Auswahl; der Box-Hintergrund bleibt Element-Override. Die rechte Spalte bleibt als Kontrollansicht.
7. **HTML ist Text:** Markup im Text wird wörtlich angezeigt und nie interpretiert; eingefügte Formatierung wird in Tokens konvertiert, alles andere verworfen. `javascript:` bleibt verboten.
8. **Sofortsichtbarkeit:** Jede Strukturänderung – insbesondere die Reihenfolge – ist ohne Neuladen in der Vorschau sichtbar; Vorschau ist immer die Mitte der Arbeitsfläche und wird nicht von Panels verdrängt.
9. **Kein Caret-Sprung:** Während der Eingabe ist das DOM die Quelle der Wahrheit; das Modell wird nachgezogen, ohne den Cursor zu versetzen. Tipp-Bursts werden zu einem Undo-Schritt gebündelt.

### 7.5 Vorschau und Renderer-Parität (`D-09`)

- Die Vorschau nutzt **dieselben** Elementtypen und Feldnamen wie die TAG-App; sie erfindet keine eigenen Zwischenmodelle.
- Platzhaltermedien sind klar erkennbar (gestrichelter Rahmen, „Beispielbild"), damit niemand Vorschauinhalte für veröffentlichte Inhalte hält.
- Pflicht-Slots ohne Inhalt werden als Warnung mit Icon dargestellt.
- **Paritätstest:** Ein Fixture-Template wird im Tool und (nach P2) in der TAG-App gerendert; verglichen werden Elementreihenfolge, Typen, sichtbare Texte und Slot-Anzahl – nicht Pixel. Damit bleibt der Test stabil, ohne visuelle Freiheit zu blockieren.
- Solange P1 gilt, ist die Vorschau **näher an P2** als die Produktion. Das muss im Tool sichtbar kommuniziert werden („Vorschau zeigt Zielbild; veröffentlichte Ansicht folgt in Phase P1 ohne Theme").

### 7.6 Dateien laden und speichern (Load / Save / Save as)

Das Tool ist eine Web-Anwendung und arbeitet direkt auf Dateien des Benutzers – ohne Server. Dafür wird die **File System Access API** verwendet (`showOpenFilePicker`, `showSaveFilePicker`), mit einem dokumentierten Fallback für Browser ohne diese API.

| Aktion | Verhalten | Tastenkürzel |
| --- | --- | --- |
| **Load** („Datei laden") | Datei öffnen, Version prüfen, migrieren (7.13), validieren, in den Editor laden; das Dateihandle wird zum aktuellen Dokument | `Strg+O` |
| **Save** | schreibt **in dieselbe Datei** (bestehendes Handle) ohne Nachfrage nach dem Pfad; nur bei fehlerfreiem L1–L3 | `Strg+S` |
| **Save as** | öffnet den Speichern-Dialog, schreibt in eine **neue** Datei und macht sie zum aktuellen Dokument | `Strg+Shift+S` |
| **Element-Bibliothek: Load** | lädt eine `*.tagelements.json` und merged sie (7.14) | – |
| **Element-Bibliothek: Save / Save as** | schreibt die aktuelle Bibliothek in dieselbe bzw. eine neue Datei; `Save` erhöht `libraryVersion` | – |

Details:

1. **Handle-Merken:** Das Dateihandle wird nach dem ersten `Load`/`Save as` im Speicher gehalten und zusätzlich in `IndexedDB` abgelegt, damit ein erneutes Öffnen der Seite „zuletzt verwendet" anbieten kann. Nach einem Neustart ist eine erneute **Berechtigungsabfrage** nötig (`queryPermission`/`requestPermission`); ohne Berechtigung wird nichts geschrieben.
2. **Kein stilles Überschreiben:** `Save` schreibt nur, wenn die Datei zuvor geladen oder gespeichert wurde. Gibt es kein Handle, verhält sich `Save` wie `Save as`.
3. **Ungespeicherte Änderungen:** Ein Dirty-Flag steuert `beforeunload` und einen Dialog vor `Load`/`Save as`/Schließen („Speichern / Verwerfen / Abbrechen").
4. **Validierungsgate:** `Save`/`Save as` sind deaktiviert, solange L1–L3 Fehler melden. Warnungen blockieren nicht.
5. **Dateiname beim ersten Speichern:** `<templateId>-v<templateVersion>.tagcontent.json`; später bleibt der gewählte Name unverändert, auch wenn sich die Version erhöht.
6. **Fallback:** Ohne File System Access API (Firefox, Safari) wird `Save` zu einem **Download** und `Load` zu einem Datei-Auswahldialog; die UI kennzeichnet das ehrlich („Ihr Browser speichert als neue Datei"). Es gibt dann kein „gleiche Datei"-Verhalten.
7. **Kein Netzwerk:** Weder Speichern noch Laden überträgt Daten. Es gibt keine Cloud-Ablage, kein Konto und keine Server-Validierung im Tool.

**Format und Kanonisierung**

| Aspekt | Regel |
| --- | --- |
| Dateiendung | `*.tagcontent.json` (Template), `*.tagelements.json` (Bibliothek) |
| Kanonisierung | feste Schlüsselreihenfolge, 2 Leerzeichen, LF, abschließender Umbruch – unabhängig davon, ob gespeichert oder heruntergeladen wird |
| Hash | SHA-256 der kanonischen Bytes wird in der Statusleiste **angezeigt**, aber **nicht** im Dokument gespeichert (sonst Selbstreferenz) |
| Zeitstempel | `createdAt`/`updatedAt` sind optionale Metadaten und werden getrennt von der Struktur angezeigt |
| Rückmeldung nach Load | „Geladen: Version 2 → auf 3 aktualisiert, 2 Felder mit Default-Wert ergänzt, 1 Feld verworfen" |

Ein **Template-Verwaltung** (Liste, Suche, Versionen, Teilen) ist ausdrücklich **nicht** Teil des Offline-Tools. Sie kommt später in TCC/User-App und arbeitet auf denselben Dateien (Abschnitt 19, `OP-13`).

### 7.7 Persistenz im Browser

| Speicher | Inhalt | Zweck |
| --- | --- | --- |
| `localStorage` | Entwurf (`myqr24.tag-content-designer.draft.v1`) und UI-Präferenzen (Breakpoint, Theme-Vorschau) | Autosave ohne Dateizugriff |
| `IndexedDB` | **nur** Dateihandles + Dateiname + letzter Speicherzeitpunkt (Template und Bibliothek) | „zuletzt verwendet" nach Neustart anbieten; Berechtigung wird erneut abgefragt |
| Dateisystem | eigentliche `.tagcontent.json` / `.tagelements.json` | einzige dauerhafte Quelle der Wahrheit |

Regeln:

- Die Dateihandles sind **kein Ersatz** für die Datei; ohne Berechtigung wird nichts gelesen oder geschrieben.
- Keine Medien, keine Base64-Daten, keine Sessioninhalte im Browser-Speicher.
- Beim Start: Default-Bibliothek laden, dann Wiederherstellungsangebot für den Entwurf und ggf. „zuletzt verwendete Datei erneut öffnen?".
- „Verwerfen" löscht den Entwurf, ohne die Datei zu berühren.
- Ein neuer Browser/Rechner kennt keine Handles – dort beginnt man mit `Load`.

### 7.8 Bedienbarkeit und Barrierefreiheit

- Vollständige Tastaturbedienung für Elementliste (Sortieren per Tastatur), Inspektor und Validierungsliste.
- Sichtbarer Fokus, ausreichende Kontraste (WCAG AA), keine Farbe als einziges Signal für Fehler.
- Vorschau mit `aria`-Struktur (Rollen `main`, `navigation`, `region`), damit Screenreader die Struktur erfassen.
- Keine Animation, die sich nicht abschalten lässt (`prefers-reduced-motion`).

### 7.9 Tests des Tools

| Testart | Inhalt |
| --- | --- |
| Unit | `validate.test.ts`: L1–L3 inklusive Grenzwerten, verbotenen Mustern, Enum-Verletzungen |
| Unit | `serialize.test.ts`: kanonische Reihenfolge, Idempotenz (Export → Import → Export ist byte-identisch), Hash-Stabilität |
| Unit | `bindings.test.ts`: erlaubte Quellen, unbekannte Quelle = Fehler, `literal`-Auflösung |
| Komponente | `preview.test.tsx`: Elementreihenfolge, Platzhalter, Pflicht-Slot-Warnung |
| Golden Files | `vault-standard.tagcontent.json` und `lost-found-standard.tagcontent.json` sind gültig und stabil |
| Negativ-Fixtures | `element-missing-order.json`, `slot-min-gt-max.json`, `html-injection.json`, `unknown-binding.json`, `too-many-elements.json` |
| Build | `tsc --noEmit` und `vite build` müssen fehlerfrei sein |
| Migration | `migrate.test.ts`: je Stufe ein Fixture, kumulative Kette, Determinismus, Golden File |
| Laden | `load.test.ts`: schema/Version prüfen, Defaults, unbekannte Felder, `x-`-Erhalt, Reparaturmodus |
| Bibliothek | `library.test.ts`: Merge-Regeln, doppelte IDs, unbekannter `elementType`, Roundtrip |

### 7.10 Element-Template-Editor

Der Master-Designer enthält zusätzlich einen Editor für **Element-Templates** (Gallery, Dokumentenliste, Wartungshistorie, Textbausteine):

| Funktion | Umsetzung |
| --- | --- |
| Bibliothek | Liste aller Element-Templates mit Version, TAG-Typ-Eignung und Vorschaubild |
| Anlegen/Ableiten | neues Element-Template oder Kopie eines bestehenden (neue ID, Version 1) |
| Bearbeiten | Gestaltung (`style`), Verhalten (`payload`, z. B. Picker-Achse, `display`-Modi), Slots, Standard-`actions`, Standard-`editability` |
| Einfügen in ein TAG-Template | „Element hinzufügen → aus Bibliothek", dabei Overrides setzen (`copy`, Farben, `display`) |
| Flatten | beim Export werden die Overrides eingerechnet und das Element-Template **nicht** referenziert |
| Versionierung | Änderung an einem Element-Template erhöht dessen Version; bestehende Master-Templates behalten die eingefrorene Kopie |
| Vorschau | Element-Template isoliert in allen drei Breakpoints prüfbar, inklusive leerer Slots |

Damit ist „eine Gallery einmal designen und vielfach verwenden" erfüllt, ohne dass die Laufzeit eine Referenz auflösen muss.

### 7.11 Grid- und Vorschau-Editor

- **Drei Breakpoints** (Handy/Tablet/Desktop) gleichzeitig oder umschaltbar; Rotation wird über die Breite simuliert.
- **Span/Order** werden je Breakpoint gesetzt; das Tool zeigt die **effektive** Spaltenzahl und den geklemmten Span an (gleiche Formel wie der Renderer).
- **Textsicherheit**: Das Tool rendert mit denselben Umbruchregeln wie die App und warnt, wenn ein Text bei der kleinsten Breite zu schmal würde – es kürzt nie.
- **Kontrastprüfung** für Text/Background und Buttons, mit sichtbarem Wert und Warnung.
- **Button-Platzierung**: Upload/Download/Löschen werden dort angezeigt, wo sie später erscheinen (Elementkopf, Bild-Ecke, Listenzeile, Lightbox) – als Vorschau, nicht als frei verschiebbare Elemente.
- **Theme-Vorschau** mit echten Tokens; ein „Graustufen"-Modus zeigt, ob die Struktur auch ohne Farbe trägt.
- **Kein Freistellen per Pixel**: Positionen entstehen ausschließlich aus Grid-Platzierung und Reihenfolge.

### 7.12 TAG-Content-User-Designer (später, in der User-App)

Der zweite Editor ist **kein** freies Designwerkzeug, sondern ein geführter Anpassungsdialog:

| Aspekt | Regel |
| --- | --- |
| Einstieg | Benutzer wählt eine Master-Vorlage (Vault, Lost&Found, Wartung) aus der Bibliothek |
| Laden | Tool erhält das geflattete Master-Dokument plus `editability` |
| Änderbar | nur Pfade aus `editability.allow` (Texte, Farben, Button-Farben, Überschriften, Elementhintergründe, Theme-Bild, Reihenfolge/Spans, `display`-Modi, Slot-Limits) |
| Entfernen | erlaubt, solange `limits.minRemainingElements` und `maxRemovedElements` eingehalten werden |
| Nicht änderbar | `elementType`, neue Elemente (v1), `actions`-Obergrenzen, `visibility`, Features, Slots-Identitäten |
| Medien | Auswahl aus vorhandenen TAG-Inhalten; Uploads laufen über die API, nicht über den Designer |
| Speichern | erzeugt eine **Instanz** (`myqr24-tag-content-instance-v1`) mit `derivedFrom: { templateId, templateVersion }` und neuem `content_sha256` |
| Vorschau | dieselben drei Breakpoints und dieselben Prüfungen wie im Master-Designer |
| Grenzen | Der Editor kann keine Vorlage „freischalten" oder Rechte erweitern; er ändert ausschließlich Darstellung |

Formatbibliothek, Validierung und Vorschau-Komponenten werden zwischen Master- und User-Designer **geteilt** (Entscheidung `D-09`), damit beide nicht auseinanderlaufen. Der User-Designer wird zusammen mit der User-App umgesetzt, nicht in `tools/`.

### 7.13 Vorhandene Templates laden, Versionen und Migration

Ein offline arbeitendes Tool muss **weiterverarbeitbare** Dateien erzeugen: Ein einmal heruntergeladenes Template muss auch nach einem Tool-Update wieder ladbar sein. Dafür werden **drei Versionsachsen** getrennt geführt:

| Achse | Wo | Bedeutung |
| --- | --- | --- |
| `toolVersion` | `package.json` und UI-Statuszeile | Version des Werkzeugs (SemVer). Rein informativ, **nie** Teil des Dokuments |
| `schemaVersion` | im Dokument (`1`, `2`, …) | Format der Datei; bestimmt die Migrationskette |
| `templateVersion` | `template.templateVersion` | fachliche Version der Vorlage; vom Autor gepflegt |

**Ladepipeline bei „Load from file":**

```text
1. Datei lesen (max. 1 MiB, UTF-8, JSON.parse mit Fehlerfang)
2. schema erkennen (schema + schemaVersion); unbekanntes schema → Abbruch mit Erklärung
3. schemaVersion vergleichen
   - gleich            → direkt validieren
   - älter, migrierbar → Migrationskette ausführen (rein, ohne Seiteneffekte)
   - neuer             → Abbruch: "Datei wurde mit einer neueren Tool-Version erstellt"
4. Defaults anwenden (7.13.2)
5. L1–L3 validieren
6. In den Editor laden; Ladeprotokoll als Banner anzeigen
```

**7.13.1 Kompatibilitätsregeln**

| Fall | Verhalten |
| --- | --- |
| `schemaVersion` gleich | laden, keine Änderung am Dokument |
| `schemaVersion` älter, Migration vorhanden | migrieren, Ladeprotokoll zeigen, Dokument als „geändert" markieren |
| `schemaVersion` älter, Migration fehlt | **harter Fehler** mit Angabe der fehlenden Stufe und der betroffenen Felder |
| `schemaVersion` neuer als das Tool | **harter Fehler** („bitte Tool aktualisieren"), kein Teilimport |
| `schema` unbekannt (z. B. Instanz statt Template) | **harter Fehler** mit Hinweis, welche Art erwartet wird |
| Datei > 1 MiB oder > 24 Elemente | **harter Fehler** mit Größenangabe |
| Unbekannte Felder | Warnung, Feld wird **verworfen**; Felder mit Präfix `x-` werden bewahrt (Erweiterungsraum) |

**7.13.2 Default-Werte statt Lücken**

Neue Felder werden so behandelt, dass alte Dateien weiter funktionieren:

1. **Neues optionales Feld** → dokumentierter Default wird eingesetzt (z. B. `placement.order = 10`, `actions.download.principals = ["scanner","guest","owner"]`, `layout.responsive.preferredColumns.mobile = 1`). Das Ladeprotokoll nennt jedes ergänzte Feld.
2. **Neues Pflichtfeld ohne sinnvollen Default** → Feld bleibt **leer** und wird als „unerledigt" markiert; der Editor springt in den Inspektor, das Speichern bleibt gesperrt, bis es gefüllt ist.
3. **Neuer Enum-Wert**, der alte Werte ersetzt → Migration bildet alte auf neue ab (Abbildungstabelle in der Migrationsstufe), nie stiller Fallback auf den ersten Enum-Wert.
4. **Entferntes Feld** → Migration entfernt es bewusst und protokolliert es; keine Warnung ohne Erklärung.

**7.13.3 Fehlermodell**

Jeder Ladefehler ist maschinenlesbar und für Menschen erklärt:

```json
{
  "code": "MIGRATION_STEP_MISSING",
  "severity": "error",
  "path": "elements[4].slots[0]",
  "message": "Slot 'photos' hat kein Gegenstück in Version 3.",
  "hint": "Element 'cel_photos' löschen oder Slot auf 'images' umbenennen.",
  "blocking": true
}
```

- `code`: stabil (für Tests und spätere Automatik), `path`: JSON-Pfad, `hint`: konkrete Handlung.
- **Reparaturmodus**: Bei blockierenden Fehlern darf das Tool die Datei trotzdem **lesend** öffnen, damit der Benutzer das betroffene Element löschen oder das Feld korrigieren kann. Ohne diese Möglichkeit wäre eine alte Datei unrettbar.
- Es gibt **keinen** „Best effort"-Import, der Fehler verschweigt. Entweder migriert und validiert oder klar abgelehnt.

**7.13.4 Migrationskette**

- Jede Stufe ist eine **pure Funktion** `migrateVNtoVN1(document): { document, changes[] }`, ohne Netzwerk, ohne Zeit, ohne Zufall.
- Jede Stufe hat Fixtures (alt → neu) und einen Roundtrip-Test (TCD-TC-041 ff.).
- Stufen sind **kumulativ** und werden immer von der Dateiversion bis zur aktuellen Version ausgeführt.
- Eine Stufe wird nie gelöscht, solange ein veröffentlichtes TAG sie noch referenziert.
- Die Kette liegt versioniert im Tool (`src/state/migrate.ts`) und als Tabelle in der Tool-Spezifikation.

**7.13.5 Grundsätze**

1. **Kein stiller Datenverlust**: Was verworfen oder ersetzt wird, steht im Ladeprotokoll.
2. **Kein Teilimport**: Entweder das Dokument ist nach der Migration gültig, oder es wird abgelehnt (Reparaturmodus nur lesend).
3. **Determinismus**: Migration und Defaults ändern das Dokument nur an dokumentierten Stellen.
4. **Vorwärtskompatibilität**: `schemaVersion` wird nur erhöht, wenn sich das Format **breaking** ändert; rein additive Felder bleiben in derselben Version.

### 7.14 Element-Bibliothek als eine Datei

Complex Items (Gallery, Dokumentenliste, Wartungshistorie …) werden zunächst **in einer einzigen Datei** definiert und im Designer als Bibliothek geladen. Das hält den Einstieg einfach und vermeidet einen Referenzdschungel.

| Aspekt | Regel |
| --- | --- |
| Schema | `myqr24-tag-element-library-v1`, `schemaVersion: 1` |
| Dateiendung | `*.tagelements.json` |
| Inhalt | `elements[]` mit je `elementTemplateId`, `elementTemplateVersion`, `elementType`, `label`, `style`, `payload`, `slots`, `actions`, `editability` |
| Start | Beim Öffnen des Tools wird automatisch die mitgelieferte Default-Bibliothek geladen (`public/elements/default.tagelements.json`) |
| Save | schreibt die Bibliothek in die **aktuell geöffnete** Datei und erhöht `libraryVersion` um 1 |
| Save as | schreibt in eine **neue** Datei (z. B. `element-library-v4.tagelements.json`) und macht sie zur aktuellen |
| Load | lädt eine beliebige (auch ältere) Bibliotheksdatei und merged sie; ältere Versionen bleiben so wieder nutzbar |
| Merge | gleiche ID + höhere Version → ersetzen; gleiche Version → unverändert lassen und melden; neue ID → hinzufügen |
| Wirkung | nur im Designer; **nie** Laufzeitreferenz in einer TAG-Instanz |
| Validierung | L1–L3 je Element, zusätzlich eindeutige IDs und Typ-zu-Slot-Konsistenz |

```json
{
  "schema": "myqr24-tag-element-library-v1",
  "schemaVersion": 1,
  "libraryVersion": 3,
  "updatedAt": "2026-11-18T00:00:00.000Z",
  "elements": [
    {
      "elementTemplateId": "tet_gallery_grid",
      "elementTemplateVersion": 2,
      "elementType": "gallery",
      "label": "Galerie – Raster mit Picker",
      "style": { "background": { "type": "solid", "color": "surface" }, "padding": "md" },
      "payload": {
        "picker": { "axis": "horizontal", "thumbSize": "md", "showCounter": true },
        "viewer": { "sizeMode": "medium", "swipe": true, "showCaptions": true },
        "lightbox": true,
        "maxImages": 48
      },
      "slots": [ { "slotId": "images", "accepts": ["image"], "min": 0, "max": 48, "required": false, "presentation": { "fit": "cover", "caption": "optional" } } ],
      "actions": {
        "upload": { "enabled": true, "principals": ["guest", "owner"], "acceptedTypes": ["image"], "maxItemsPerPrincipal": 3, "maxFileSizeMb": 10, "afterUpload": "quarantine" },
        "download": { "enabled": true, "principals": ["scanner", "guest", "owner"] },
        "delete": { "enabled": true, "principals": ["owner", "guest"], "guestScope": "ownOnly" }
      },
      "editability": { "allow": ["content.heading", "payload.picker.axis", "slots.images.max"] }
    },
    {
      "elementTemplateId": "tet_documents_list",
      "elementTemplateVersion": 1,
      "elementType": "documents",
      "label": "Dokumente – Liste mit Metadaten",
      "style": { "padding": "md" },
      "payload": { "view": "list", "showMeta": true, "sort": "date-desc", "maxItems": 32 },
      "slots": [ { "slotId": "documents", "accepts": ["document"], "min": 0, "max": 32, "required": false } ]
    }
  ]
}
```

Ein späterer Ausbau (Einzel-Export eines Bausteins, Bibliotheksverwaltung im TCC) ist möglich, ohne dieses Format zu brechen: Die Bibliotheksdatei bleibt das Bündel, Einzeldateien sind eine Teilmenge davon.

---

## 8. Sicherheit, Datenschutz und Betriebsgrenzen

### 8.1 Bedrohungen und Gegenmaßnahmen

| Bedrohung | Gegenmaßnahme |
| --- | --- |
| Stored XSS über Template-Inhalte | kein HTML im Artefakt, kein `innerHTML`/`dangerouslySetInnerHTML` (Architektur-Test), Token-/Enum-Whitelists, serverseitige L3-Prüfung |
| CSS-Injection / Datenabfluss über `url()` | keine CSS-Strings, keine URLs im Theme, geschlossene Enums, Abbildung auf interne Klassen |
| Offene Weiterleitung über `external-link` | nur `https:`, Host-Allowlist optional, Anzeige der Ziel-Domain, `rel="noopener noreferrer"` |
| Rechteausweitung durch Template | Sichtbarkeits- und Feature-Obergrenzen aus TCP-Policy, „Template erhöht nie" (Abschnitt 6.2) |
| SSRF/Storage-Zugriff | keine Storage-Keys, keine Bucket-Namen, keine Presigned URLs im Template; Medienpfade ausschließlich serverseitig |
| DoS durch große Dokumente | Größenlimits (Abschnitt 5.9), Validierung vor dem Parsen großer Strukturen, harte Request-Limits in TCP |
| Template-Verwechslung / Supply-Chain | `templateId` + `templateVersion` + `content_sha256`, Audit, unveränderliche veröffentlichte Versionen |
| Unbemerkte stille Änderung | Diff-Ansicht im TCC, neue Version statt Überschreiben, Audit-Ereignis pro Upload |
| Verlust der Reproduzierbarkeit | TAG speichert `templateId`/`templateVersion`; veröffentlichte Versionen werden nie überschrieben, nur `retired` |

### 8.2 Grenzen des Tools

- Das Tool ist **offline** und besitzt **keine** Credentials, keine Session, keinen API-Zugriff, keine Cloudflare-Bindings.
- Es kann nichts veröffentlichen; es erzeugt ausschließlich eine Datei, die ein Mensch im TCC hochlädt.
- Es ist kein Autorisierungsbestandteil: Ein manipulationssicheres Tool ist kein Sicherheitsmerkmal – die Autorität liegt bei TCP und tag-api.

### 8.3 Datenschutz

- Templates enthalten **keine** personenbezogenen Daten. Beispieltexte sind generisch; Personenbezug entsteht erst durch TAG-Inhalte und bleibt dort autorisiert.
- Keine Telemetrie, keine externen Requests, keine Schriftarten von Drittanbietern im Tool.
- Autosave liegt ausschließlich lokal im Browser und ist löschbar.
- Auditdaten zu Uploads enthalten Objekt-IDs und Korrelation, aber keine vollständigen Dokumentinhalte.

### 8.4 Cache- und Auslieferungsgrenzen

- Templates werden **nie** öffentlich ausgeliefert. Sie liegen in TCP; eine veröffentlichte View wird als Content-Revision projiziert.
- Die tag-api bleibt bei `Cache-Control: no-store` für Content-Antworten; ein Template ändert daran nichts.
- Der Service Worker der TAG-App darf keine Template-Dokumente oder Drafts cachen.

### 8.5 Sitzungs-Cookies, Wiedererkennung und DSGVO

**Ausgangslage:** Die tag-api setzt nach erfolgreichem Bootstrap ein Cookie `myqr24_tag_access` mit `HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=2592000` (30 Tage). Es enthält ein Zufallstoken, in D1 liegt nur dessen Hash; der Scope ist `public`, `pin` oder `login`, gebunden an `tag_id` und `access_version` (`tag-app-access-v1`).

**Frage:** Darf ein Cookie zur Wiedererkennung trotz DSGVO verwendet werden?

**Einordnung (keine Rechtsberatung – Freigabe durch Datenschutzbeauftragte/Recht erforderlich):**

In Deutschland/EU sind **zwei Regelwerke** parallel zu prüfen:

1. **TDDDG § 25** (bis 05/2024 TTDSG): Speichern von Informationen im Endgerät (Cookies, `localStorage` usw.) ist grundsätzlich **einwilligungspflichtig**, außer es ist „unbedingt erforderlich", um einen vom Nutzer ausdrücklich gewünschten digitalen Dienst zu erbringen.
2. **DSGVO**: Eine zufällige Kennung ist personenbezogen. Erforderlich sind Rechtsgrundlage (Art. 6), Zweckbindung, Datenminimierung, Transparenz, Löschkonzept und – bei Einwilligung – deren leichte Widerrufbarkeit.

Daraus folgt für myQR24:

| Zweck | Rechtsgrundlage | Einwilligung nötig? | Empfohlene Lebensdauer |
| --- | --- | --- | --- |
| Zugriffssession auf einen **öffentlichen** TAG (Inhalt laden) | TDDDG § 25 Abs. 2; DSGVO Art. 6 Abs. 1 lit. f | nein (unbedingt erforderlich für den angeforderten Dienst) | Browser-Sitzung oder max. 24 h |
| Zugriffssession auf einen **PIN-geschützten** TAG | TDDDG § 25 Abs. 2; DSGVO Art. 6 Abs. 1 lit. b | nein | max. 24 h |
| **„Auf diesem Gerät angemeldet bleiben"** (Komfort, z. B. 30 Tage) | TDDDG § 25 Abs. 1; DSGVO Art. 6 Abs. 1 lit. a | **ja**, aktives Opt-in | max. 6 Monate, jederzeit widerruflich |
| Gast-Session für eigene Uploads | TDDDG § 25 Abs. 2; DSGVO Art. 6 Abs. 1 lit. b | nein, wenn der Upload der angeforderte Dienst ist | Sitzung bzw. max. 12 h |
| Wiedererkennung über TAGs hinweg, Analyse, Werbung | – | ja, aber **nicht vorgesehen** | – |

**Konkrete Empfehlungen:**

1. Die vorhandene Session-Cookie-Logik ist als **unbedingt erforderlich** vertretbar, solange sie ausschließlich der Zugriffssteuerung dient – kein Profiling, keine TAG-übergreifende Verkettung, keine Drittanbieter, kein Fingerprinting.
2. Die **30-Tage-Laufzeit** ist der kritische Punkt: Sie ist ein persistentes Cookie und damit eher Komfort als Erforderlichkeit. Vorschlag: Standard auf Sitzung/24 h senken, 30 Tage nur nach ausdrücklichem Opt-in („angemeldet bleiben") – mit eigenem Cookie-Namen und dokumentiertem Zweck.
3. **Keine Geräte-UUID** (entschieden). Eine Wiedererkennung darf nur über die serverseitige Session und – falls eingeführt – über eine ausdrücklich eingewilligte Komfort-Kennung erfolgen.
4. Datenschutzhinweis muss Cookie-Name, Zweck, Speicherdauer, Rechtsgrundlage und Widerruf nennen; der Widerruf („Sitzung beenden") muss die Session in D1 widerrufen **und** das Cookie löschen.
5. Verarbeitungsverzeichnis (Art. 30 DSGVO) um „TAG-Zugriffssession" und ggf. „Gast-Session" ergänzen.
6. Ein Consent-Banner ist für **ausschließlich** unbedingt erforderliche Cookies nicht erforderlich; sobald Komfort-/Analyse-Cookies hinzukommen, wird ein echtes Opt-in mit gleichwertiger Ablehnung nötig.

**Fazit:** Ja, ein Cookie ist zulässig – aber nur zweckgebunden als Sitzung für den angeforderten Dienst, mit kurzer Laufzeit, ohne TAG-übergreifende Wiedererkennung. Eine „Wiedererkennung um der Wiedererkennung willen" wäre einwilligungspflichtig und wird hier bewusst nicht umgesetzt.

---

## 9. TCP-/TCC-Integration (Abriss, späterer eigener Gate)

### 9.1 Upload-Flow

```text
1. TCC: Datei wählen (Drag & Drop, *.tagcontent.json, max. 48 KiB)
2. TCC: clientseitige Vorprüfung (gleiche L1–L3-Regeln, nur Komfort)
3. TCC: Anzeige von Name, tagType, Version, Elementanzahl, Diff zur Vorversion
4. TCC: Upload → POST /api/v1/admin/TAG-Content-Templates (Idempotency-Key)
5. TCP: Authentisierung, Rolle, Organisationsgrenze, Re-Authentisierung bei Freigabe
6. TCP: vollständige Neuvalidierung (nie dem Client vertrauen)
7. TCP: Speichern als neue Version mit Status draft/pending-review, Audit-Ereignis
8. Freigabe: separater Command, setzt published, unveränderlich
9. TAG-Zuordnung: TAG erhält templateRef = templateId@templateVersion
10. Publish: Projektion nach R2/D1, content_revision n+1
```

Fehlerfälle: ungültiges JSON → `422` mit maschinenlesbaren Feldern; unbekannte `schemaVersion` → `422`; doppelte `templateId`+`templateVersion` mit abweichendem Hash → `409`; fehlende Rolle → neutral `403`.

### 9.2 Minimale Datenhaltung in TCP

Bewusst **eine** Tabelle statt eines Modells:

```sql
CREATE TABLE tag_view_templates (
  id                 BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  template_id        VARCHAR(64)  NOT NULL,
  template_version   INT UNSIGNED NOT NULL,
  tag_type           VARCHAR(32)  NOT NULL,
  status             VARCHAR(20)  NOT NULL,   -- draft | pending-review | published | retired
  schema_version     INT UNSIGNED NOT NULL,
  document_json      LONGTEXT     NOT NULL,   -- kanonisches Autorendokument
  document_sha256    CHAR(64)     NOT NULL,
  document_bytes     INT UNSIGNED NOT NULL,
  created_by         VARCHAR(64)  NOT NULL,
  created_at         TIMESTAMP    NOT NULL,
  published_at       TIMESTAMP    NULL,
  published_by       VARCHAR(64)  NULL,
  UNIQUE KEY uq_template_version (template_id, template_version)
);
```

Regeln:

- Veröffentlichte Zeilen sind **unveränderlich**; Änderungen erzeugen eine neue `template_version`.
- `document_json` ist die einzige fachliche Wahrheit; abgeleitete Strukturen (Elementzeilen, Slots) werden **nicht** relational gespiegelt. Das erfüllt die Anforderung „keine komplexe DB-Struktur".
- `document_sha256` dient Idempotenz und Integrität, nicht der Autorisierung.
- Zusätzlich: `tag_view_template_assignments` ist **nicht** nötig, solange die Zuordnung am TAG selbst gespeichert wird (`tag.template_id`, `tag.template_version`) – eine Spaltenerweiterung der bestehenden TAG-Tabelle genügt (Entscheidung `D-10`).
- Alternative für große Dokumente: Ablage in einem privaten Objektstore mit Pointer. Für 48 KiB ist MySQL einfacher und transaktional; erst bei erheblich größeren Dokumenten neu bewerten.

### 9.3 API-Skizze (Vorschlag, nicht verbindlich)

```http
POST   /api/v1/admin/TAG-Content-Templates                # Upload als neue Version
GET    /api/v1/admin/TAG-Content-Templates                # Liste mit Filter tagType/status
GET    /api/v1/admin/TAG-Content-Templates/{templateId}   # Versionen + Metadaten
POST   /api/v1/admin/TAG-Content-Templates/{templateId}/{version}/publish
POST   /api/v1/admin/TAG-Content-Templates/{templateId}/{version}/retire
POST   /api/v1/admin/tags/{tagId}/content-template        # Vorlage einem TAG zuweisen
```

- Alle Mutationen mit `Idempotency-Key`, Audit-Ereignis und Rollenprüfung gemäß [`control-plane-tag-management-api-v1`](../../10-Architecture/35-Contracts/control-plane-tag-management-api-v1.md) (Plattformrolle bzw. zugewiesene Organisationsrolle, Re-Authentisierung bei Freigabe).
- Antworten enthalten **nicht** das vollständige Dokument in Listen, nur Metadaten; Dokument nur im Detail oder als Download.
- `POST …/publish` prüft zusätzlich die Verträglichkeit mit dem Ziel-`schemaVersion` der tag-api-Projektion.
- Ein Template-Delete existiert nicht; nur `retire`.

### 9.4 TAG-Instanziierung und spätere Owner-Anpassung

1. **Zuordnung**: Ein TAG referenziert `templateId@templateVersion` (Copy-on-Write findet **nicht** statt).
2. **Erstveröffentlichung**: Publish projiziert das Template unverändert; Slots müssen mit vorhandenen Items belegbar sein.
3. **Owner-Anpassung (später)**: Der Owner erhält keine Schreibrechte am Template, sondern eine **TAG-Overlay**-Struktur (z. B. `copy`-Überschreibungen und Slot-Belegung). Das Overlay wird beim Publish mit dem Template zusammengeführt.
4. **Rückkanal**: Ändert der Plattformbetreiber eine Vorlage, wird **keine** TAG-Veröffentlichung automatisch nachgezogen. Ein TAG bleibt auf seiner Version, bis es bewusst migriert wird. Damit sind öffentliche Ansichten reproduzierbar.
5. **Overlay-Grenzen**: Ein Overlay darf keine Struktur (Elementtypen, Slots, Navigation) hinzufügen, sondern nur Texte, Theme-Werte und Item-Belegungen ändern – sonst wird die Vorlage wertlos und die Sicherheitsprüfung müsste das Overlay erneut vollständig validieren.

Diese Overlay-Idee ist ausdrücklich **später** (vom Auftrag so vorgegeben) und in Abschnitt 13 als offene Entscheidung geführt (`D-12`).

### 9.5 Publish-Projektion im Detail

| Schritt | Aktion | Fehlerverhalten |
| --- | --- | --- |
| 1 | Template laden (published, `schemaVersion` passend) | Abbruch, kein Teilpublish |
| 2 | Bindings auflösen (`tag.displayName` etc.) | unbekannte Quelle → Abbruch |
| 3 | Effektive Sichtbarkeit und Features berechnen | Überschreitung → Abbruch |
| 4 | Element-Payloads bauen (`content`, `style`, Slots) | L2/L3-Verstoß → Abbruch |
| 5 | Items den Slots zuordnen, Pflicht-Slots prüfen | fehlende Pflichtbelegung → Abbruch |
| 6 | `view` bauen: `tag`, `enabledFeatures`, `shell`, abgeleitete `public`-Blöcke | – |
| 7 | R2 schreiben: Elemente, dann TAG-Datei | Fehler → alte Revision bleibt gültig |
| 8 | D1-Batch: `tag_content`, `tag_content_elements`, Mitgliedschaften, dann `tag_routing.content_revision` | atomar, sonst Rollback |
| 9 | Audit + Outbox-Ereignis | Publish gilt erst nach Commit |

Wichtig: Schritt 7/8 dürfen die bisherige Revision **nie** zerstören, bevor die neue vollständig vorliegt. Bereits ausgegebene, kurzlebige Medien-URLs sind davon unberührt – ein Widerruf verhindert neue Signaturen, nicht bereits verteilte Bytes.

---

## 10. Vorschlag: User Stories für den Tool-Strang

Präfix `TCD-` (Tag Content Designer), damit keine Kollision mit `APP-`, `CP-`, `CC-`, `US-` entsteht. Diese IDs sind **Vorschläge** und werden erst mit der Übernahme verbindlich.

### TCD-US-001 — Template offline erstellen und wieder öffnen
**Priorität:** P0 · **Als** Plattform-Editor · **möchte ich** ein TAG-Content-Template im Browser erstellen, speichern und wieder öffnen, **damit** ich ohne Server und ohne Login arbeiten kann.
**Akzeptanzkriterien**
- Das Tool startet ohne Netzwerkzugriff und ohne Anmeldung.
- Ein Entwurf wird lokal gespeichert und beim nächsten Start zur Wiederherstellung angeboten.
- Import/Export verwendet `myqr24-tag-content-template-v1` und ist byte-stabil.

### TCD-US-002 — Mit einer Vorlage starten
**Priorität:** P0 · **Als** Editor · **möchte ich** aus einer Bibliothek (Vault, Lost & Found, leer) starten, **damit** ich typische Strukturen nicht neu erfinden muss.
**Akzeptanzkriterien**
- Mindestens die Vorlagen `vault-standard` und `lost-found-standard` sind enthalten.
- Die gewählte Vorlage setzt `tagType`, `shell.presentation` und die erlaubte Elementliste.
- Eine Vorlage lässt sich als Kopie mit neuer `templateId` speichern.

### TCD-US-003 — Elemente hinzufügen und konfigurieren
**Priorität:** P0 · **Als** Editor · **möchte ich** Elemente aus einem Katalog hinzufügen und ihre Felder bearbeiten, **damit** die Ansicht vollständig beschrieben ist.
**Akzeptanzkriterien**
- Der Katalog bietet nur Typen, die zum `tagType` passen.
- Pflichtfelder werden erzwungen; Enums sind Auswahllisten, keine Freitextfelder.
- Nicht unterstützte Kombinationen (z. B. `finder-form` in `vault`) sind nicht auswählbar.

### TCD-US-004 — Reihenfolge und Navigation festlegen
**Priorität:** P1 · **Als** Editor · **möchte ich** Elemente sortieren und optional Tabs gruppieren, **damit** die Ansicht auf Mobilgeräten sinnvoll gegliedert ist.
**Akzeptanzkriterien**
- Sortieren per Drag-and-drop und per Tastatur möglich.
- `displayOrder` wird beim Export deterministisch neu vergeben.
- Die neue Reihenfolge ist **sofort** in der Vorschau sichtbar: Da die Vorschau nach `placement.order[breakpoint] ?? displayOrder` sortiert, wird die Platzierung beim Sortieren für alle Breakpoints mitgeschrieben.
- Interne, ausgeblendete Elemente (`hidden`, z. B. `theme-assets`) sind von der Sortierung ausgenommen und bleiben verankert.
- Jedes Element gehört höchstens einer Navigationsgruppe an; ungültige Zuordnungen sind Fehler.

### TCD-US-005 — Slots für Medien und Dokumente definieren
**Priorität:** P0 · **Als** Editor · **möchte ich** je Element Slots mit Typ, Mindest-/Höchstzahl und Darstellung definieren, **damit** Inhalte später ohne Designänderung gebunden werden können.
**Akzeptanzkriterien**
- Slots lassen sich hinzufügen, ändern und entfernen; `slotId` ist je Element eindeutig.
- `accepts` ist eine Mehrfachauswahl aus `image`, `document`, `audio`.
- `min <= max` und `max` innerhalb der Grenzwerte werden erzwungen.
- Ein Slot enthält niemals Dateinamen, URLs oder `contentId`s.

### TCD-US-006 — Texte und Bindings pflegen
**Priorität:** P0 · **Als** Editor · **möchte ich** statische Texte und Feldbindungen getrennt pflegen, **damit** Vorlagen wiederverwendbar sind und keine Platzhalterlogik in Strings entsteht.
**Akzeptanzkriterien**
- Jedes Textfeld kann wahlweise `copy` (Literal) oder ein Binding mit Quelle aus dem Katalog nutzen.
- Unbekannte Quellen sind Fehler, nicht Leerstrings.
- Bei gleichzeitiger Angabe gewinnt das Binding; das UI kennzeichnet den Fallback.
- Texte mit HTML-Markup sind erlaubt, werden aber wörtlich angezeigt (Warnung `POLICY_HTML_MARKUP`); für Formatierung ist die Leiste zuständig.

### TCD-US-007 — Shell, Theme und Features einstellen
**Priorität:** P1 · **Als** Editor · **möchte ich** Präsentation, Farben, Typografie und Layout-Dichte einstellen, **damit** ein TAG-Typ ein konsistentes Erscheinungsbild erhält.
**Akzeptanzkriterien**
- `presentation` ist auf die von der TAG-App unterstützten Werte beschränkt.
- Farben sind Hex-Werte, alle übrigen Theme-Felder sind Enums oder Zahlen in definierten Bereichen.
- `features` ist nur als Teilmenge der für den `tagType` zulässigen Features wählbar.
- Kontrastverhältnisse werden geprüft und bei Unterschreitung als Warnung angezeigt.

### TCD-US-008 — Ansicht in Mobil- und Desktopbreite prüfen
**Priorität:** P0 · **Als** Editor · **möchte ich** eine Live-Vorschau in beiden Breiten sehen, **damit** ich Layoutfehler vor dem Export erkenne.
**Akzeptanzkriterien**
- Die Vorschau aktualisiert sich ohne manuellen Neustart.
- Platzhaltermedien sind eindeutig als Beispiel gekennzeichnet.
- Die Vorschau verwendet dieselben Elementtypen und Feldnamen wie die TAG-App.
- Ein Hinweis erklärt den Unterschied zwischen Vorschau und veröffentlichter Phase.

### TCD-US-009 — Fehler vor dem Export finden
**Priorität:** P0 · **Als** Editor · **möchte ich** strukturierte Fehler- und Warnmeldungen mit Feldbezug, **damit** ich kein ungültiges Template abgebe.
**Akzeptanzkriterien**
- Jede Meldung enthält Pfad, Schweregrad und verständlichen Text.
- Ein Klick auf eine Meldung öffnet das betroffene Element und Feld.
- Fehler blockieren den Export, Warnungen nicht.
- Die Prüfungen entsprechen L1–L3 und sind durch Tests abgedeckt.

### TCD-US-010 — Deterministisch exportieren und importieren
**Priorität:** P0 · **Als** Editor · **möchte ich** ein stabiles JSON erzeugen und wieder einlesen, **damit** Änderungen nachvollziehbar und diffbar sind.
**Akzeptanzkriterien**
- Export → Import → Export ist byte-identisch.
- Der Dateiname folgt `<templateId>-v<version>.tagcontent.json`.
- Der Hash wird angezeigt, aber nicht im Dokument gespeichert.
- Unbekannte `schemaVersion` wird mit klarer Meldung abgelehnt.

### TCD-US-011 — Element-Templates verwalten und einziehen
**Priorität:** P0 · **Als** Plattform-Editor · **möchte ich** Gallery-, Dokument- und Wartungsbausteine als versionierte Element-Templates pflegen, **damit** gleiche Elemente über viele TAGs hinweg konsistent bleiben.
**Akzeptanzkriterien**
- Element-Templates sind anlegbar, kopierbar, versionierbar und in der Bibliothek sichtbar.
- Beim Einfügen in ein TAG-Template werden Overrides gesetzt, nicht die Bibliothek verändert.
- Der Export enthält keine Referenz auf ein Element-Template (geflattet).
- Eine Änderung an einem Element-Template verändert bestehende Master-Templates nicht.

### TCD-US-012 — Elemente je Breakpoint platzieren
**Priorität:** P0 · **Als** Editor · **möchte ich** Span und Reihenfolge je Handy/Tablet/Desktop setzen, **damit** die Ansicht auf jedem Gerät sinnvoll umbricht.
**Akzeptanzkriterien**
- Das Tool zeigt die effektive Spaltenzahl und den geklemmten Span (gleiche Formel wie der Renderer).
- Umbrechen geschieht automatisch; es gibt keine absolute Positionierung.
- Rotation wird über die Breite simuliert.
- Ungültige Werte (Span 0, Order negativ) sind Fehler.

### TCD-US-013 — Zeichen formatieren (RTF)
**Priorität:** P0 · **Als** Editor · **möchte ich** Text direkt in der Vorschau markieren und zeichenweise formatieren, **damit** Hinweise und Hervorhebungen lesbar gegliedert sind.
**Akzeptanzkriterien**
- Textfelder sind in der Vorschau direkt editierbar; ein Klick ins Feld setzt den Cursor dorthin.
- Bei Fokus erscheint **oberhalb** des Feldes die Leiste; sie nimmt dem Feld den Fokus nicht weg.
- Fett/Kursiv/Unterstrich wirken auf die Auswahl und werden als Marks gespeichert.
- **Zeichenfarbe** und **Markierung** (Hintergrund des markierten Textes) wirken auf die Auswahl und werden als Run-Attribute `color`/`background` (`#rrggbb`) gespeichert.
- **Schriftgröße** (Skala 12–32 px) und **Schriftfamilie** (`sans`/`serif`/`mono`) wirken auf die Auswahl.
- Der **Box-Hintergrund** des Textfelds wird über dieselbe Leiste als Element-Override (`style.background`) gesetzt.
- Die Farbmenüs bieten Theme-, Standard- und eigene Farben sowie einen RGB-Wähler; Symbolknöpfe folgen der Office-Anmutung (A mit Farbbalken, Marker, Farbeimer, Listen-, Ausrichtungs- und Einrücksymbole).
- **Shift+Enter** erzeugt einen weichen Umbruch im selben Absatz.
- „Formatierung entfernen" löscht Marks und Absatz-Attribute der Auswahl.
- HTML-Eingabe wird nie gespeichert: Text bleibt Text, Paste wird in Tokens konvertiert.
- Beim Verlassen des Feldes wird das Modell aktualisiert; Tipp-Bursts bilden einen Undo-Schritt.
- Text wird nie abgeschnitten; das zeigt die Vorschau bei allen drei Breiten.

### TCD-US-016 — Absätze, Listen und Einrückung
**Priorität:** P0 · **Als** Editor · **möchte ich** Absätze ausrichten, Aufzählungen/Nummerierungen setzen und einrücken, **damit** Inhalte strukturiert sind.
**Akzeptanzkriterien**
- Ausrichtung (`start`/`center`/`end`) und Zeilenabstand (6 Stufen) wirken auf alle Absätze der Auswahl.
- Aufzählung und Nummerierung sind umschaltbar; ein Wechsel der Listenart startet eine neue Liste.
- Ein-/Ausrücken verschachtelt Listeneinträge (`level` 0–3); außerhalb von Listen erhöht es `paragraph.indent` (0–3).
- Die Liste wird flach gespeichert (`list.kind` + `level`) und beim Rendern deterministisch zu verschachtelten `<ul>/<ol>` gruppiert.
- Sprünge über mehrere Ebenen werden auf „eine Ebene tiefer" normalisiert.
- Ein Absatz gehört zu höchstens einer Liste; ungültige Werte sind Validierungsfehler.

### TCD-US-017 — Link einfügen
**Priorität:** P1 · **Als** Editor · **möchte ich** markierten Text verlinken, **damit** Leser zu weiteren Informationen gelangen.
**Akzeptanzkriterien**
- Die Leiste bietet „Link setzen/ändern" mit Inline-Feld und „Link entfernen".
- Gültig sind ausschließlich `https://…` und `mailto:…`; alles andere wird mit Meldung abgelehnt.
- Gespeichert wird nur `{ "href": … }`; gerendert wird mit `rel="noopener noreferrer nofollow"` und `target="_blank"`.
- Im Designer navigiert ein Klick nicht (Editor `openOnClick: false`, Vorschau fängt den Klick ab).
- `javascript:`- und `data:`-Ziele sind ein Validierungsfehler.

### TCD-US-019 — Überschriften 1–5 im Text
**Priorität:** P0 · **Als** Editor · **möchte ich** jede Zeile als Überschrift 1–5 auszeichnen, **damit** ich Texte wie in Word gliedern kann.
**Akzeptanzkriterien**
- Absatzstil-Feld in der Leiste: `Text`, `Überschrift 1 … 5`; wirkt auf alle Blöcke der Auswahl.
- Kürzel `# ` bis `##### ` am Zeilenanfang sowie `Strg+Alt+1…5`; `Strg+Alt+0` macht wieder Text.
- Mehrere Überschriften pro Textfeld, an beliebiger Position, mit Fett/Farbe/Größe.
- Leere Überschrift + `Backspace` → normaler Absatz (kein „Gefängnis").
- Alte Dateien mit `content.heading` werden beim Laden zu `heading: 3` migriert (`schemaVersion 2`).
- `heading` + `list` im selben Absatz ist ein Fehler; Ebenen außerhalb 1–5 ebenfalls.

### TCD-US-020 — Markdown als Ein-/Ausgabe und Tabellen
**Priorität:** P1 · **Als** Editor · **möchte ich** Markdown einfügen und ausgeben sowie Tabellen per Markdown anlegen.
**Akzeptanzkriterien**
- Tipp-Kürzel: Überschriften, Listen, `**fett**`, `*kursiv*`, `[Text](https://…)` (Allowlist).
- Eingefügter Markdown-Text wird in Tokens übersetzt; HTML bleibt Text (`html: false`).
- `MD`-Dialog: Vorschau des Exports, Warnhinweise (Farben/Code/Bilder …), „Übernehmen (ersetzt den Text)" und „Kopieren".
- Tabellen: `| a | b |` + Ausrichtungszeile → Tabellenblock (Kopfzeile, Ausrichtung), max. 6 × 20, Zellen als Text.
- Markdown ist **kein** Speicherformat; das Artefakt bleibt JSON.

### TCD-US-018 — Farbpalette und Arbeitsstand
**Priorität:** P1 · **Als** Editor · **möchte ich** eigene Farben anlegen und beim nächsten Start weiterarbeiten, **damit** ich nicht jedes Mal dieselben Werte suchen muss.
**Akzeptanzkriterien**
- Jedes Farbmenü zeigt Theme-Farben, eine Standard-Palette, eigene Farben und einen RGB-Wähler.
- „＋ Eigene" speichert die aktuelle Farbe im Dokument (`palette.custom`, `#rrggbb`, max. 24); „×" entfernt sie wieder.
- Eigene Farben sind in der gespeicherten `.tagcontent.json` enthalten und nach `Load` wieder verfügbar.
- Der zuletzt bearbeitete Stand wird lokal gehalten und beim Start/Reload geladen; unbrauchbare Stände fallen auf die ausgelieferte Vorlage zurück.
- Der Hinweis in der Statuszeile nennt den geladenen Stand („zuletzt verwendet · Datum, Zeit").
- Die rechte Textkontrolle zeigt das Runs-Modell als JSON, ist scrollbar und bearbeitbar; nur regelkonforme Inhalte werden übernommen.
- Linke und rechte Spalte sind per Ziehgriff verstellbar; die Breiten bleiben erhalten.

### TCD-US-014 — Farben, Buttons und Überschriften gestalten
**Priorität:** P1 · **Als** Editor · **möchte ich** Theme-Farben, Button-Stile, Überschriftenfarbe und Elementhintergründe setzen, **damit** ein TAG zur Marke passt.
**Akzeptanzkriterien**
- Theme, Element-Override und RichText-Mark sind klar getrennte Ebenen.
- Kontrast wird berechnet und als Warnung angezeigt.
- Es sind keine CSS-Strings, URLs oder freien Styles speicherbar.
- Buttons nutzen ausschließlich Token/Hex und geschlossene Enums.

### TCD-US-015 — Hintergrundbild wählen
**Priorität:** P2 · **Als** Editor · **möchte ich** ein Hintergrundbild für das TAG oder ein Element referenzieren, **damit** die Ansicht atmosphärisch wirkt.
**Akzeptanzkriterien**
- Das Bild wird über `cel_theme:tag-background` referenziert, nie als URL im Template.
- Theme-Bilder sind öffentlich; die Prüfung verhindert nicht-öffentliche Referenzen.
- Opazität/Overlay sind begrenzt, damit Text lesbar bleibt.
- Ohne Bild bleibt die Ansicht vollständig funktionsfähig.

### TCD-US-016 — Rechte je Element festlegen
**Priorität:** P0 · **Als** Editor · **möchte ich** für Gallery und Dokumentliste getrennt festlegen, wer hochladen, herunterladen und löschen darf, **damit** Gastbeiträge kontrolliert bleiben.
**Akzeptanzkriterien**
- Principals sind geschlossen (`scanner`, `guest`, `owner`); `delete.guestScope: ownOnly` ist darstellbar.
- Das Template kann Rechte nur einschränken, nie über die TAG-Policy hinaus erweitern.
- Die Vorschau zeigt Buttons nur, wenn die Capability später bestätigt würde.
- Bei fehlender Eigentumsbindung ist `ownOnly` als „nicht durchsetzbar" markiert und blockiert den Export.

### TCD-US-017 — Darstellung von Dokumenten und Galerien wählen
**Priorität:** P1 · **Als** Editor · **möchte ich** Dokumentmodi (Link, Scroll-Box, Seiten) und Galerie-Verhalten (Picker-Achse, Viewer-Größe, Lightbox) festlegen, **damit** Inhalte passend präsentiert werden.
**Akzeptanzkriterien**
- Alle Modi aus 5.8.1/5.8.2 sind als Enum wählbar, ohne Freitext.
- `link` ist immer als Rückfall verfügbar.
- Die Vorschau zeigt Platzhalter in korrekter Struktur (Seitenzahl, Thumbnail-Leiste).
- Nicht unterstützte Kombinationen (z. B. `pages-*` ohne Seitenrenderer) sind als Warnung markiert.

### TCD-US-018 — Editierbarkeit für den User-Designer definieren
**Priorität:** P0 · **Als** Plattform-Editor · **möchte ich** festlegen, welche Felder ein Benutzer später ändern darf, **damit** Individualisierung ohne Strukturbruch möglich ist.
**Akzeptanzkriterien**
- `editability.allow` ist eine Whitelist; nicht genannte Pfade sind gesperrt.
- `limits` steuern Hinzufügen/Entfernen/Umsortieren mit Mindestrestanzahl.
- Verbotene Felder (`elementType`, `visibility`, `actions`-Obergrenzen) sind nicht freigebbar.
- Der User-Designer kann ausschließlich auf Basis dieser Angaben arbeiten (kein Sonderfallcode).

### TCD-US-019 — Vorhandenes Template laden und weiterbearbeiten
**Priorität:** P0 · **Als** Editor · **möchte ich** ein zuvor gespeichertes Template wieder laden, **damit** ich es nach Tagen oder nach einem Tool-Update weiterbearbeiten kann.
**Akzeptanzkriterien**
- „Load from file" akzeptiert die aktuelle `schemaVersion` und alle migrierbaren älteren Versionen.
- Nach dem Laden zeigt ein Banner Dateiversion, Zielversion, ergänzte Defaults und verworfene Felder.
- Das geladene Dokument ist sofort bearbeitbar und kann erneut heruntergeladen werden.
- Eine Datei mit unbekanntem `schema` (z. B. Instanz) wird mit klarer Erklärung abgelehnt.

### TCD-US-020 — Alte Formatversion automatisch migrieren
**Priorität:** P0 · **Als** Editor · **möchte ich**, dass ältere Dateien mit Default-Werten ergänzt werden, **damit** neue Optionen nicht dazu zwingen, alles neu zu bauen.
**Akzeptanzkriterien**
- Neue optionale Felder erhalten dokumentierte Defaults; jeder Default erscheint im Ladeprotokoll.
- Neue Pflichtfelder ohne Default bleiben leer, sind als „unerledigt" markiert und blockieren das Speichern, bis sie gefüllt sind.
- Ersetzte Enums werden über eine Abbildungstabelle migriert, nie stillschweigend auf den ersten Wert gesetzt.
- Migration ist deterministisch und ohne Seiteneffekte (pure Funktion).

### TCD-US-021 — Nicht konvertierbare Datei verständlich ablehnen
**Priorität:** P0 · **Als** Editor · **möchte ich** bei einer inkompatiblen Datei genau erfahren, was stört, **damit** ich sie reparieren kann.
**Akzeptanzkriterien**
- Jeder Fehler nennt `code`, JSON-Pfad, Klartext und konkreten Handlungshinweis.
- Es gibt keinen „Best effort"-Import, der Fehler verschweigt.
- Ein **Reparaturmodus** öffnet die Datei lesend, damit das störende Element gelöscht oder korrigiert werden kann.
- Nach der Reparatur ist ein regulärer Download wieder möglich.

### TCD-US-022 — Element-Bibliothek laden und speichern
**Priorität:** P1 · **Als** Editor · **möchte ich** alle Complex Items in einer Datei sichern und wieder laden, **damit** ich meine Bausteine zwischen Rechnern und Tool-Versionen mitnehmen kann.
**Akzeptanzkriterien**
- „Save"/"Save as" schreibt alle Complex Items in **eine** Datei (`*.tagelements.json`); „Save" erhöht `libraryVersion`.
- „Element-Bibliothek: Load" merged nach Regel aus 7.14 (neue ID ergänzen, höhere Version ersetzen, gleiche Version melden).
- Doppelte IDs innerhalb der Datei sind ein Fehler.
- Die Bibliothek erzeugt keine Laufzeitreferenz in TAG-Instanzen.

### TCD-US-023 — Mit Save und Save as arbeiten
**Priorität:** P0 · **Als** Editor · **möchte ich** mit `Save` in dieselbe Datei und mit `Save as` in eine neue Datei schreiben, **damit** ich ohne Dateidialog weiterarbeiten und trotzdem Varianten anlegen kann.
**Akzeptanzkriterien**
- Nach `Load` oder `Save as` schreibt `Save` ohne Pfadabfrage in dieselbe Datei.
- Ohne vorhandenes Handle verhält sich `Save` wie `Save as`.
- `Save as` erzeugt eine neue Datei und macht sie zur aktuellen; der alte Stand bleibt unverändert.
- Bei ungespeicherten Änderungen erscheint vor `Load`/`Save as`/Schließen ein Dialog.
- Ohne File System Access API wird `Save` als Download ausgeführt und die UI weist darauf hin.

### TCD-US-024 — Element-Bibliothek beim Start laden und versioniert speichern
**Priorität:** P0 · **Als** Editor · **möchte ich** beim Start eine Default-Bibliothek vorfinden und meine Änderungen versioniert speichern, **damit** ich Complex Items sofort nutzen und ältere Stände zurückholen kann.
**Akzeptanzkriterien**
- Beim Öffnen des Tools ist `default.tagelements.json` geladen und im Bibliotheksbereich sichtbar.
- `Save` erhöht `libraryVersion` um 1; `Save as` erzeugt eine neue Datei mit dem aktuellen Stand.
- `Load` akzeptiert auch ältere Bibliotheksdateien und merged sie nach 7.14.
- „Zurücksetzen auf Default" lädt die mitgelieferte Bibliothek erneut, ohne die Datei zu überschreiben.
- Eine Bibliothek mit unbekanntem `schemaVersion` wird mit klarer Meldung abgelehnt.

---

## 11. Vorschlag: Testfälle des Tool-Strangs

| ID | Prüfung | Erwartung |
| --- | --- | --- |
| TCD-TC-001 | Export eines vollständigen Vault-Templates | gültig, alle Pflichtfelder, keine verbotenen Muster |
| TCD-TC-002 | Re-Import und erneuter Export | byte-identisch |
| TCD-TC-003 | Zwei Elemente mit gleicher `elementId` | L2-Fehler mit Pfad |
| TCD-TC-004 | Zwei Elemente mit gleicher `displayOrder` | L2-Fehler |
| TCD-TC-005 | `navigation.item.elementIds` verweist auf unbekanntes Element | L2-Fehler |
| TCD-TC-006 | `slot.min > slot.max` | L1-Fehler |
| TCD-TC-007 | `slot.max` über Grenzwert | L1-Fehler |
| TCD-TC-008 | `elementType` für `tagType` nicht erlaubt | L2-Fehler |
| TCD-TC-009 | `copy` enthält `<script>` oder `onclick` | L3-Fehler |
| TCD-TC-010 | `external-link` mit `javascript:`- oder `data:`-Ziel | L3-Fehler |
| TCD-TC-011 | `external-link` mit `http:`-Ziel | L3-Fehler |
| TCD-TC-012 | Theme enthält `url(...)` oder CSS-Selektor | L3-Fehler |
| TCD-TC-013 | Binding auf unbekannte Quelle | L2-Fehler |
| TCD-TC-014 | 25 Elemente | L1-Fehler (Limit 24) |
| TCD-TC-015 | Dokument über 48 KiB | L1-Fehler |
| TCD-TC-016 | Unbekannte `schemaVersion` beim Import | Ablehnung ohne Teilimport |
| TCD-TC-017 | Vorschau mit leerem Pflicht-Slot | Warnung, kein Fehler |
| TCD-TC-018 | Tastatursortierung in der Gliederung | Reihenfolge ändert sich, Fokus bleibt erhalten |
| TCD-TC-019 | Golden File `vault-standard` | unverändert stabil, Hash konstant |
| TCD-TC-020 | Golden File `lost-found-standard` | unverändert stabil, Hash konstant |

**Revision 2 – zusätzliche Fälle (Layout, Text, Rechte, Deployment):**

| ID | Prüfung | Erwartung |
| --- | --- | --- |
| TCD-TC-021 | Breite 320 px | 1 Spalte, alle Elemente volle Breite |
| TCD-TC-022 | Breite 768 px, `preferredColumns.tablet = 2` | 2 Spalten, Span-Klemmung greift |
| TCD-TC-023 | Breite 1280 px, drei Elemente mit `span: 4` | 3 Elemente in einer Zeile |
| TCD-TC-024 | `span: 12` bei 3 effektiven Spalten | auf 3 geklemmt, kein Überlauf |
| TCD-TC-025 | Zwei Elemente mit gleichem `order` | stabile Sortierung nach `elementId`, kein Zufall |
| TCD-TC-026 | Text in schmalem Container | kein `ellipsis`, kein `overflow: hidden`, umbricht vollständig |
| TCD-TC-027 | RichText mit `bold`, `italic`, `color`-Token | korrekte Marks, kein HTML im Ergebnis |
| TCD-TC-028 | RichText mit `<script>` oder `onclick` | L3-Fehler, Export gesperrt |
| TCD-TC-029 | RichText-Farbe außerhalb Palette/Hex | L3-Fehler |
| TCD-TC-030 | RichText-Größe als Pixelwert | L1-Fehler |
| TCD-TC-031 | `image`-Slot mit zwei Items | Publish-Fehler (max 1) |
| TCD-TC-032 | `document.display = pages-paged` ohne Seitenrenderer | Warnung im Designer, Publish-Fehler |
| TCD-TC-033 | `gallery.picker.axis = vertical` | Picker vertikal, Thumbnails in `thumb` |
| TCD-TC-034 | Umschalten `viewer.sizeMode` zur Laufzeit | nur lokale Präferenz, kein API-Aufruf |
| TCD-TC-035 | `actions.delete.guestScope = ownOnly` ohne Eigentumsbindung | Export blockiert mit Begründung |
| TCD-TC-036 | `actions.upload.principals = ["owner"]` | kein Upload-Button für Scanner/Gast |
| TCD-TC-037 | Theme-Bild verweist auf nicht-öffentliches Item | Validierungsfehler |
| TCD-TC-038 | Flatten zweier Element-Templates | Ergebnis identisch zu manuell gebautem Dokument (Idempotenz) |
| TCD-TC-039 | Feld nicht in `editability.allow` | User-Designer sperrt es, kein Schreibpfad |
| TCD-TC-040 | Unbekannte `schemaVersion` der Instanz | Ablehnung ohne Teil-Darstellung |

**Revision 3 – Laden, Migration und Bibliothek:**

| ID | Prüfung | Erwartung |
| --- | --- | --- |
| TCD-TC-041 | Datei mit aktueller `schemaVersion` laden | unverändert geladen, keine Defaults ergänzt |
| TCD-TC-042 | Datei mit älterer Version, Migration vorhanden | migriert, Defaults protokolliert, Dokument als geändert markiert |
| TCD-TC-043 | Ältere Version ohne Migrationsstufe | harter Fehler mit `code`, `path` und `hint`, kein Teilimport |
| TCD-TC-044 | Datei mit neuerer `schemaVersion` | Abbruch „bitte Tool aktualisieren" |
| TCD-TC-045 | Unbekanntes Feld `foo` bzw. `x-vendor` | `foo` verworfen mit Warnung, `x-vendor` bewahrt |
| TCD-TC-046 | Save → Load → Save (gleiche Datei, aktuelle Version) | byte-identisch |
| TCD-TC-047 | Reparaturmodus: störendes Element löschen | Datei danach ladbar, Download wieder möglich |
| TCD-TC-048 | Neues Pflichtfeld ohne Default | Feld leer, Export gesperrt, Editor springt in den Inspektor |
| TCD-TC-049 | Bibliothek mit gleicher ID und höherer Version | Eintrag ersetzt, Änderung gemeldet |
| TCD-TC-050 | Bibliothek mit doppelter ID in einer Datei | Fehler, kein Merge |
| TCD-TC-051 | Bibliothek mit unbekanntem `elementType` | Fehler je Eintrag, restliche Einträge bleiben unverändert |
| TCD-TC-052 | Bibliothek mit `schemaVersion` neuer als Tool | Abbruch mit Hinweis auf Tool-Update |

**Revision 4 – Dateizugriff (Save / Save as / Load):**

| ID | Prüfung | Erwartung |
| --- | --- | --- |
| TCD-TC-053 | `Save` ohne vorhandenes Handle | verhält sich wie `Save as`, Dialog erscheint |
| TCD-TC-054 | `Save` nach `Load` | schreibt ohne Pfadabfrage in dieselbe Datei (Handle-Mock) |
| TCD-TC-055 | `Save as` | neue Datei entsteht, ursprüngliche Datei bleibt byte-identisch |
| TCD-TC-056 | Dirty + `Load` | Dialog „Speichern/Verwerfen/Abbrechen"; Abbrechen lädt nichts |
| TCD-TC-057 | Berechtigung entzogen | `Save` schlägt mit Hinweis fehl, Entwurf bleibt erhalten |
| TCD-TC-058 | Browser ohne File System Access API | `Save` erzeugt Download, UI zeigt Hinweis |
| TCD-TC-059 | Bibliothek `Save` | `libraryVersion` +1, Datei enthält neuen Stand |
| TCD-TC-060 | Bibliothek `Save as` | neue Datei, Default-Datei unverändert |
| TCD-TC-061 | Bibliothek `Load` ältere Version | Merge nach 7.14, Meldung über ersetzte/neue Einträge |
| TCD-TC-062 | „Zurücksetzen auf Default" | Default geladen, Datei auf Platte unverändert |

Diese Testfälle sind Vorschläge. Sie werden erst mit der Übernahme in einen eigenen Testfallbestand (`docs/40-Implementation/...`) verbindlich und müssen dort Traceability erhalten.

---

## 12. Vorschlag: Testdaten

| ID | Inhalt | Zweck |
| --- | --- | --- |
| TCD-TD-001 | `vault-standard.tagcontent.json` | Golden File, gültig, 4 Elemente |
| TCD-TD-002 | `lost-found-standard.tagcontent.json` | Golden File, gültig, 3 Elemente inkl. `finder-form` |
| TCD-TD-003 | `welcome-invalid-html.tagcontent.json` | L3-Negativfall |
| TCD-TD-004 | `duplicate-ids.tagcontent.json` | L2-Negativfall |
| TCD-TD-005 | `slot-limit.tagcontent.json` | L1-Negativfall |
| TCD-TD-006 | `unknown-binding.tagcontent.json` | L2-Negativfall |
| TCD-TD-007 | `legacy-schema-v0.tagcontent.json` | Import-Ablehnung |

**Revision 2 – zusätzliche Testdaten:**

| ID | Inhalt | Zweck |
| --- | --- | --- |
| TCD-TD-008 | `element-template-gallery-v1.json` | wiederverwendbares Gallery-Element-Template |
| TCD-TD-009 | `master-vault-with-gallery.json` | Master mit eingezogenem Element-Template (vor Flatten) |
| TCD-TD-010 | `instance-vault-flattened.json` | geflattete Instanz inklusive `placement` und `actions` |
| TCD-TD-011 | `grid-invalid-spans.json` | L1-Negativfall (Span 0, Order negativ) |
| TCD-TD-012 | `actions-guest-own-without-ownership.json` | Export-Blocker wegen fehlender Eigentumsbindung |
| TCD-TD-013 | `maintenance-master-optional.json` | optionales Wartungs-Template, ausdrücklich nicht v1 |

**Revision 3 – zusätzliche Testdaten:**

| ID | Inhalt | Zweck |
| --- | --- | --- |
| TCD-TD-014 | `template-v1-legacy.tagcontent.json` | alte Formatversion für die Migrationskette |
| TCD-TD-015 | `template-v2-migrated.tagcontent.json` | erwartetes Ergebnis nach Migration (Golden File) |
| TCD-TD-016 | `element-library-v1.tagelements.json` | Bibliothek mit Gallery- und Documents-Baustein |
| TCD-TD-017 | `element-library-duplicate-id.tagelements.json` | Merge-/Validierungs-Negativfall |
| TCD-TD-018 | `template-unknown-field.tagcontent.json` | `foo`-Feld (verwerfen) und `x-vendor`-Feld (bewahren) |

### Golden Files = Default-Dateien

Die Golden Files sind **exakt** die Dateien, die das Tool beim Start bzw. als Vorlage ausliefert. Es gibt keine zweite Kopie für Tests – dieselben Bytes dienen als Default, als Demo und als Fixture.

| Datei | Rolle im Tool | Rolle im Test |
| --- | --- | --- |
| `public/elements/default.tagelements.json` | Default-Bibliothek beim Start | Fixture für `library.test.ts`, Merge-Referenz |
| `public/templates/vault-standard.tagcontent.json` | Vorlagenauswahl „Vault" | Golden File, gültig, 4 Elemente |
| `public/templates/lost-found-standard.tagcontent.json` | Vorlagenauswahl „Lost & Found" | Golden File, gültig, 3 Elemente |
| `test/fixtures/template-v1-legacy.tagcontent.json` | nicht ausgeliefert | Migrations-Eingang |
| `test/fixtures/template-v2-migrated.tagcontent.json` | nicht ausgeliefert | Migrations-Golden-File |

Regel: Ändert sich ein Golden File fachlich, ist das eine bewusste Versionierung (`templateVersion`/`libraryVersion` erhöhen) – nicht ein Testfix.

Alle Testdaten sind synthetisch, enthalten keine personenbezogenen Daten, keine echten URLs und keine Medien.

---

## 13. Offene Entscheidungen

| ID | Frage | Auswirkung | Empfehlung | Entscheiderrolle | spätester Zeitpunkt |
| --- | --- | --- | --- | --- | --- |
| `D-01` | Ein Autorendokument oder getrennte TAG-/Elementdateien? | Format, Tool-Architektur, TCP-Ablage, Publish | ein Dokument (Option A) | Softwarearchitektur | vor Contract `tag-content-template-v1` |
| `D-02` | Ist ein Template eine Vorlage mit Verweis oder eine Kopie je TAG? | Reproduzierbarkeit, Vorlagenpflege, Owner-Rechte | Master dient als Vorlage, die TAG-Instanz ist eine **geflattete Kopie** je TAG (siehe 3.4) | Produkt + Architektur | **entschieden (Rev. 2)** |
| `D-03` | Rendert die TAG-App künftig `elements[]` statt `view.vault.blocks`? | Contract-Version, TAG-App-Refactor, Sichtbarkeitsfilterung | P1 jetzt, P2 als eigener Strang mit Gate | Softwarearchitektur + Produkt | vor ersten `shared`-Inhalten |
| `D-04` | Welche `tagType`-Werte sind zulässig? | Katalog, Vorlagenbibliothek, TCC-Filter | `vault`, `lost-found`, `event`, `exhibit` | Produkt | vor Tool-MVP |
| `D-05` | Grenzwerte aus Abschnitt 5.9 | Validierung, Bedienbarkeit, spätere Änderbarkeit | Werte übernehmen, im Contract festschreiben | Softwarearchitektur | vor Tool-MVP |
| `D-06` | Wie wird die Slot-Zugehörigkeit in `tag_content_element_items` abgebildet? | D1-Schema, Publish, Medienzuordnung | neue Spalte `slot_id` (nullable) + Sortierkonvention | Softwarearchitektur + Datenmodell | vor erstem Publish aus Template |
| `D-07` | Sichtbarkeitskonflikt: blockieren oder herabstufen? | Autorenerlebnis, Sicherheit, Audit | blockieren mit klarer Meldung | Sicherheit + Produkt | vor TCC-Upload |
| `D-08` | React oder Vanilla TS für das Tool? | Wartbarkeit, Vorschau-Parität, Abhängigkeiten | React (Wiederverwendung der Renderer) | Frontend-Architektur | vor Tool-Start |
| `D-09` | Gemeinsame Contract-/Renderer-Quelle (`packages/*`) oder Duplikat? | Root-Workspaces, Build, Divergenzrisiko | mittelfristig Shared Package, kurzfristig gemeinsame Typen | Softwarearchitektur | vor P2 |
| `D-10` | Template-Dokument in MySQL oder Objektstore? | Transaktionalität, Größenlimits, Backup | MySQL (`LONGTEXT`) bei 48 KiB; Zuordnung am TAG | Plattformbetrieb | vor TCP-Migration |
| `D-11` | Wer darf Templates veröffentlichen? | Missbrauchsrisiko, Governance | Plattformrolle, Re-Authentisierung Pflicht | Sicherheit + Betrieb | vor TCC-Freigabe |
| `D-12` | Wie weit darf eine spätere Owner-Anpassung gehen? | Sicherheit, Vorlagenwert, Publish-Komplexität | Overlay nur für Texte, Theme-Werte und Slot-Belegung | Produkt | vor Owner-Feature |
| `D-13` | Mehrsprachige Templates in v1? | Struktur (`locale`), Validierung | nein, `de-DE` fest, Format bleibt erweiterbar | Produkt | vor erster Übersetzung |
| `D-14` | Darf das Tool später direkt ins TCC hochladen? | Authentisierung, CSRF, Tool-Umfang | nein in v1; Upload bleibt manuell | Sicherheit | vor Tool-v2 |
| `D-15` | Wo wird das Grid-Reflow berechnet? | Renderer-Komplexität, Testbarkeit, Fallback | JS-Resolver als pure Funktion plus CSS-Grid-Fallback | Softwarearchitektur | **entschieden (Rev. 2)** |
| `D-16` | RichText als Runs oder Markdown-Subset? | Sicherheit, Parser-/Sanitizer-Bedarf | Runs-Modell (kein HTML, kein Markdown-Parser) | Sicherheit | **entschieden (Rev. 2)** |
| `D-17` | PDF-Seitendarstellung (pdf.js vs. Server-Page-Varianten) | Bundle, Speicher, Ladezeit, A11y | v1 nur `link`, `box-scroll` via pdf.js; Server-Pages als Option | Softwarearchitektur | vor `pages-*`-Freigabe |
| `D-18` | Träger für Wartungs-Metadaten (`item.json` vs. `item_attributes`) | D1-Schema, Publish, Sortierung | `item.json` lesen und validieren, keine neuen Spalten in v1 | Architektur + Datenmodell | vor Wartungs-TAG |
| `D-19` | Content-Contract v3 (Top-Level `theme`/`layout`/`navigation`, Capabilities) | TAG-App-Rendercode, Kompatibilität | additiv, v2 parallel lesbar, eigener Contract | Architektur | vor P2/Renderer |
| `D-20` | Master und Instanz in einer TCP-Tabelle oder getrennt? | Migration, Queries, Audit | eine Tabelle mit `kind` (`master`/`instance`) | Plattformbetrieb | vor TCP-Migration |
| `D-21` | Variantenvertrag | Zoom/Swipe/Thumbnails, Speicher | `thumb`/`mid`/`full`, `cover` als Alias | Architektur | **entschieden (Rev. 2)** |
| `D-22` | Upload-/Delete-API für Gastbeiträge | Kernfunktion „Gast lädt Bild hoch" | eigene Endpunkte mit Quarantäne, Limits, Audit | Sicherheit + Architektur | vor Upload-Feature |
| `D-23` | Eigentumsbindung für „Gast löscht nur eigene Bilder" | Rechtskonformität, UX, Support | Item→Session-Bindung in D1, keine Geräte-UUID | Sicherheit + Datenschutz | vor Delete-Feature |
| `D-24` | Capability-Vertrag im Content-Response | Buttons nur bei bestätigtem Recht | `actions`/`capabilities` im v3-Response | Architektur | mit `D-19` |
| `D-25` | Galerie-Umschaltung `medium`/`full` | Betrachterkomfort | rein lokale Präferenz, nicht im TAG-JSON | Produkt | **entschieden (Rev. 2)** |
| `D-26` | Umfang des Pflicht-Elementkatalogs v1 | Tool-Umfang, Renderer | `text`, `image`, `document`, `gallery`, `documents` | Produkt | **entschieden (Rev. 2)** |
| `D-27` | Priorisierung des optionalen Katalogs | Roadmap | Wartung und Timeline zuerst, Medien (Video/Audio) später | Produkt | nach v1-Feldtest |
| `D-28` | Wie werden Tool-, Schema- und Vorlagenversion behandelt? | Ladebarkeit alter Dateien, Migrationsaufwand | kumulative, pure Migrationskette + Defaults + harte Fehler (7.13) | Architektur | **entschieden (Rev. 3)** |
| `D-29` | Complex Items als eine Datei oder je Datei? | Bibliothekspflege, Tool-Umfang | **eine** Bibliotheksdatei (`myqr24-tag-element-library-v1`) | Architektur | **entschieden (Rev. 3)** |
| `D-30` | Wann kommt eine Template-Verwaltung? | TCC-/User-App-Umfang, Mehrbenutzerbetrieb | später, auf denselben Dateien (`OP-13`) | Produkt | nach Offline-Feldtest |
| `D-31` | Wie heißen die Dateiaktionen in der UI? | Verständlichkeit, Verwechslung mit Server-Upload | **Load / Save / Save as** (Web-Tool mit File System Access API) | Produkt | **entschieden (Rev. 4)** |
| `D-32` | Wie wird im Browser auf Dateien zugegriffen? | Bedienkomfort, Browserabdeckung | File System Access API mit Download-/Datei-Dialog-Fallback, Handle in IndexedDB | Frontend-Architektur | **entschieden (Rev. 4)** |
| `D-33` | Wie wird die Element-Bibliothek versioniert? | Rückholbarkeit, Merge | `Save` erhöht `libraryVersion` automatisch, `Save as` erzeugt neue Datei, `Load` akzeptiert ältere Stände | Produkt + Architektur | **entschieden (Rev. 4)** |
| `D-34` | Womit wird das RTF-Textfeld umgesetzt? | Bedienkomfort, Sicherheit, Bundle | Tiptap 3 / ProseMirror mit **eigenem Schema**, Brücke nur über `contentToDoc`/`docToContent`, kein HTML im Artefakt | Architektur + Sicherheit | **entschieden (Rev. 5)** |
| `D-35` | Wie werden Listen gespeichert? | Schema-Bump, Renderer, Projektion | **flaches** Modell (`list.kind` + `level`, `indent`), Gruppierung beim Rendern | Architektur | **entschieden (Rev. 5)** |
| `D-36` | Wie streng wird HTML behandelt? | Sicherheit vs. Bedienbarkeit | HTML **als Text** (nie interpretiert) mit Warnung; `javascript:`/`data:` bleiben Fehler; Paste wird konvertiert | Sicherheit | **entschieden (Rev. 6)** |
| `D-37` | Wohin gehören eigene Farben der Formatierleiste? | Portabilität, Schema | `document.palette.custom` (max. 24 × `#rrggbb`), additiv ohne Schema-Bump, mit `Save` gespeichert | Produkt + Architektur | **entschieden (Rev. 6)** |
| `D-38` | Wie wird die „letzte Konfiguration" gehalten? | Browser-Grenzen, Nachvollziehbarkeit | kanonisches JSON im `localStorage`, Prüfung + Migration beim Start, Rückfall auf die ausgelieferte Vorlage | Architektur | **entschieden (Rev. 6)** |
| `D-39` | Überschriften: Feld am Elementanfang oder Absatz-Attribut? | Mehrere Überschriften, Position, Bug „gelöschte Überschrift kommt nicht zurück" | `paragraph.heading` 1–5 im Absatzfluss; jede Zeile kann Überschrift sein, Marks erlaubt, `heading`+`list` verboten | Produkt + Architektur | **entschieden (Rev. 7)** |
| `D-40` | Markdown als Speicher- oder Ein-/Ausgabeformat? | Farben/Größen nicht in Markdown, Sicherheit, ein Vertrag | **nur Ein-/Ausgabe**: Tipp-Kürzel, Paste (`markdown-it`, `html: false`), Dialog mit Export; Speicher bleibt JSON | Architektur | **entschieden (Rev. 7)** |
| `D-41` | Wie wird `content.heading` überführt? | Altdaten, Determinismus | `schemaVersion 2` + Migrationsstufe `1 → 2`: erster Absatz mit `heading: 3`; Goldens migriert | Architektur | **entschieden (Rev. 7)** |
| `D-42` | Tabellen: welches Modell? | Aufwand, Sicherheit, Markdown-Paste | eigener Block `{type:"table"}` mit Text-Zellen, max. 6 × 20, Ausrichtung je Spalte; keine Marks in Zellen | Produkt | **entschieden (Rev. 7)** |
| `D-43` | Galerie-/Dokumentenbezüge im Text | Contract (TCC/TCP), Zyklen | typisierter Include-Block, v1 nur `slotId`; `elementId` erst mit Renderer-Entscheidung | Architektur | **offen** |

**Entscheidungsstand:** In Revision 2 sind `D-01`, `D-02`, `D-04`, `D-07`, `D-08`, `D-15`, `D-16`, `D-21`, `D-25`, `D-26` entschieden sowie „keine Geräte-UUID" festgehalten. Revision 3 ergänzt `D-28`, `D-29` und `D-31`; Revision 4 ergänzt `D-32` und `D-33`; Revision 5 ergänzt `D-34`, `D-35` und `D-36` (RTF-Editor, flaches Listenmodell, HTML-Politik); Revision 6 ergänzt `D-37` und `D-38` (eigene Farben in der Konfiguration, letzte Konfiguration lokal); Revision 7 ergänzt `D-39` bis `D-42` (Überschriften im Absatzfluss, Markdown als Ein-/Ausgabe, Schema 2, Tabellenmodell). Offen bleiben `D-43` (Element-Bezüge im Text) sowie insbesondere `D-03` (Renderer-Eingang), `D-17` (PDF-Seiten), `D-18` (Wartungsdaten), `D-19`/`D-24` (Contract v3 mit Capabilities), `D-22`/`D-23` (Upload/Delete und Eigentum) und `D-30` (Template-Verwaltung). Diese offenen Punkte sind in Abschnitt 19 als Detailierungspunkte geführt.

---

## 14. Risiken

| ID | Risiko | Wirkung | Gegenmaßnahme |
| --- | --- | --- | --- |
| R-01 | Doppelte Autorität durch `view.vault.blocks` **und** `elements[]` | widersprüchliche Ansichten, Sicherheitslücken bei `shared` | P1 nur generiert, P2 verbindlich planen |
| R-02 | Vorlagen werden zu starr und erzwingen schlechtes Mobile-Layout | Nutzerakzeptanz | responsives Fließlayout statt freier Positionierung, Mobile-Vorschau als Pflicht |
| R-03 | Vorschau weicht von Produktion ab | Vertrauensverlust | gemeinsame Typen/Renderer, Paritätstests, sichtbarer Phasen-Hinweis |
| R-04 | TCP wird doch zum Content-System | Vermischung von Autorität und Projektion | Templates sind Dokumente; Items/Medien bleiben in der bestehenden Projektion |
| R-05 | Schema wächst zu früh (Chat, Check-in, Kampagnen) | Komplexität, Sicherheitsrisiko | Elementkatalog klein halten, Nicht-Ziele (Abschnitt 17) |
| R-06 | Owner erwartet eigene Layouts | Supportaufwand | klare Kommunikation: Vorlage + begrenztes Overlay |
| R-07 | Unbemerkte Vorlagenänderung wirkt auf viele TAGs | Betriebsrisiko | Version-Pinning pro TAG, keine Auto-Migration |
| R-08 | Größen-/Mengenlimits zu knapp | Nacharbeit, Breaking Change | Limits in `D-05` mit Reserve wählen |
| R-09 | JS-Grid-Resolver verursacht Layoutsprünge oder ruckelt auf schwachen Geräten | wahrgenommene Qualität | CSS-Fallback, `ResizeObserver` entprellt, keine Layout-Änderung nach dem ersten Paint sichtbar |
| R-10 | pdf.js vergrößert das Bundle und kostet Rechenzeit auf alten Geräten | Ladezeit, Abbruchquote | Lazy-Load nur bei `box-scroll`/`pages-*`, `link` als Standard |
| R-11 | Upload-Missbrauch (Spam, Rechteverletzung, illegale Inhalte) | rechtliches und operatives Risiko | Quarantäne, Limits, Moderation, Meldefunktion, Audit |
| R-12 | Master- und User-Designer laufen auseinander | inkonsistente Ergebnisse | gemeinsame Formatbibliothek und Renderer, Paritätstests (`D-09`) |
| R-13 | Template verspricht Buttons, die die API nicht autorisieren kann | Vertrauensverlust, tote UI | Capabilities aus der API, Export-Blocker bei nicht durchsetzbaren Regeln |
| R-14 | Sehr lange Texte sprengen das Grid | unruhige Ansicht | kein Kürzen, dafür wachsende Container und Layout-Warnung im Designer |
| R-15 | Migration alter Dateien verliert stillschweigend Inhalte | Datenverlust, Vertrauensverlust | Ladeprotokoll, keine stille Änderung, Golden Files je Stufe |
| R-16 | Tool-Update macht bestehende Downloads unbrauchbar | Arbeitsverlust | Migrationskette + Reparaturmodus + harte, erklärte Fehler (7.13) |
| R-17 | Bibliotheksdatei wird zum Schatten-Template | unklare Autorität | Bibliothek nur Entwurfszeit, Instanz enthält keine Referenzen |
| R-18 | File System Access API fehlt (Firefox/Safari) oder Berechtigung wird entzogen | Benutzer kann nicht „in dieselbe Datei" speichern | dokumentierter Fallback, ehrlicher UI-Hinweis, kein Datenverlust bei Abbruch |
| R-19 | versehentliches Überschreiben durch `Save` | Arbeitsverlust | Dirty-Dialog, klare Trennung zu `Save as`, optional Sicherungskopie vor dem ersten Schreiben |

---

## 15. Vorgeschlagene Phasen

| Phase | Inhalt | Ergebnis | Voraussetzung |
| --- | --- | --- | --- |
| **M0 – Entscheidung** | offene Entscheidungen (`D-05`, `D-17`–`D-30`) klären, Format als Contract-Entwurf formulieren | belastbare Grundlage | dieses Refinement (Rev. 4) |
| **M1 – Format & Validierung** | Typen, Katalog, `validate.ts`, `serialize.ts`, `migrate.ts`, JSON-Schema, Golden Files, Bibliotheksdatei | prüfbares Format inklusive Laden/Migration, ohne UI | M0 |
| **M2 – Tool-MVP** | Vorlagenauswahl, Gliederung, Inspektor, Vorschau, **Load/Save/Save as**, Bibliothek mit Default beim Start | nutzbares Browser-Tool | M1 |
| **M3 – Beispielvorlagen** | `vault-standard`, `lost-found-standard` poliert, A11y-Durchgang | produktionsnahe Vorlagen | M2 |
| **M4 – TCC-Upload** | TCC-Dialog, Diff, clientseitige Vorprüfung, TCP-Endpunkt, Audit | Upload möglich | Contract `control-plane-tag-content-template-v1` |
| **M5 – Publish-Projektion** | Template → `tag_content`/Elemente/R2, Sichtbarkeits- und Feature-Checks | TAG aus Vorlage veröffentlichbar | `D-03`, `D-06`, `D-07` |
| **M6 – P2-Renderer** | TAG-App rendert `elements[]`, `view` trägt nur Shell | Zielarchitektur erreicht | neuer Content-Contract |
| **M7 – User-Designer** | geführter Anpassungsdialog in der User-App auf Basis von `editability`, Speichern als Instanz | Benutzer individualisiert TAGs | M5, `D-19`, `D-24` |
| **M8 – Upload/Delete** | Gastbeiträge mit Quarantäne, Eigentumsbindung, Capabilities und Audit | echte Interaktion statt toter Buttons | `D-22`, `D-23`, Betriebsgate |
| **M9 – Template-Verwaltung** | Liste, Suche, Versionen, Teilen im TCC/User-App auf denselben Dateien | mehrere Vorlagen und Benutzer | `OP-13`, `D-30` |

M4–M9 sind ausdrücklich **nicht** Teil dieses Auftrags und benötigen eigene Stories, Tests, Traceability und Status-Gates in den jeweiligen Komponentensträngen.

---

## 16. Übernahme in verbindliche Dokumente

Wenn dieses Refinement angenommen wird, sind mindestens folgende Schritte nötig (gemäß [`../README.md`](../README.md) Abschnitt 2):

| Schritt | Ziel |
| --- | --- |
| 1 | Contract `docs/10-Architecture/35-Contracts/tag-content-template-v1.md` anlegen (Format, Versionen, Fehlerfälle) |
| 2 | Contract für den TCP-Upload (`control-plane-tag-content-template-v1`) oder Erweiterung des bestehenden Verwaltungsvertrags |
| 3 | Fachliche Spezifikation unter `docs/20-Special-Specifications/` (TAG-Content-Templates, TAG-Typen) |
| 4 | Implementierungsstrang `docs/40-Implementation/tag-content-designer/` mit `README.md`, `10-USER-STORIES.md`, `20-TEST-STRATEGY.md`, `21-TEST-CASES.md`, `22-TEST-DATA.md`, `30-TRACEABILITY.md`, `STATUS.md` |
| 5 | `tools/tag-content-designer/doc/SPECIFICATION.md` aus dem Contract ableiten |
| 6 | TAG-App-Stories ergänzen, falls P2 beschlossen wird (neuer Content-Contract) |
| 7 | Sicherheits-, Datenschutz-, Betriebs- und Rollback-Bewertung dokumentieren |
| 8 | Orchestrierungsstatus aktualisieren und einen zulässigen nächsten Umsetzungsschritt benennen |

Erst danach darf Code entstehen.

---

## 17. Nicht-Ziele dieses Refinements

- keine Änderung an `myqr24-tag-content-v2`, `myqr24-tag-element-v1` oder `tag-app-access-v1`;
- keine neue D1-Migration, kein TCP-Migrationsskript, kein TCC-Feature;
- kein Chat-, Guestbook-, Check-in-, Campaign- oder Collection-Design;
- keine freie Layout-/Canvas-Positionierung von View-Elementen;
- kein Direkt-Upload aus dem Browser-Tool;
- keine Mehrsprachigkeits-, Theming- oder Owner-Overlay-Implementierung;
- keine Aussage über Deployment, Kosten oder Cloudflare-Limits;
- keine Sicherheits-, Datenschutz- oder Produktfreigabe;
- **keine** absolute Positionierung oder Canvas-Freiheit – Positionen entstehen ausschließlich aus Grid und Reihenfolge;
- **keine** Geräte-UUID und keine TAG-übergreifende Wiedererkennung;
- kein User-Designer in diesem Schritt (er wird mit der User-App umgesetzt);
- keine Upload-/Delete-Endpunkte in diesem Schritt;
- keine `pages-*`-Dokumentdarstellung in v1 (pdf.js-Entscheidung `D-17` bleibt offen);
- keine Laufzeitreferenz auf Element-Templates (es wird immer geflattet);
- keine automatische Übernahme neuer Vorlagenversionen in bestehende TAGs;
- **keine** Template-Verwaltung im Offline-Tool (nur Datei-Werkbank; `OP-13`);
- **kein** Server-Upload aus dem Tool – „Load / Save / Save as" arbeitet ausschließlich auf lokalen Dateien.

---

## 18. Zusammenfassung

1. **Ein Dokument ist richtig** – aber nur als Autorenformat. Die Aufteilung in TAG- und Elementdateien bleibt eine **serverseitig abgeleitete Laufzeitprojektion** und ist sicherheitsrelevant, weil nur Elemente pro Session gefiltert werden.
2. **Drei Ebenen statt einer**: Element-Templates (Entwurfszeit) → Master-Template (Vorlage) → TAG-Instanz (geflattet, deployt). Der Export enthält keine Referenzen, nur fertige Struktur.
3. **`myqr24-tag-content-template-v1`** beschreibt Shell (Präsentation, Theme, Navigation, Features), Layout (12-Spalten-Grid mit Fluss), RichText-Runs, Interaktionsrechte je Element und eine geordnete Liste vollständiger Elemente mit `payload`, `copy`, `bindings` und `slots`.
4. **Layout entscheidet der Renderer**: Spaltenzahl und Span werden zur Laufzeit aus Breite und `preferredColumns` berechnet; Texte werden nie abgeschnitten.
5. **TCP braucht keine komplexe DB**: eine Tabelle mit Dokument, Hash, Version, `kind` und Status genügt; die relationale Zerlegung passiert beim Publish.
6. **Das Master-Tool** `tools/tag-content-designer` ist ein offline arbeitender React-/Vite-Browser-Editor mit Element-Template-Bibliothek, Grid-Editor, RichText-Formatierer, Theme-/Button-Editor, Rechte-Editor, Drei-Breakpoint-Vorschau, L1–L3-Validierung und deterministischem JSON-Export.
7. **Rechte sind keine Gestaltung**: Das Template beantragt, TCP begrenzt, die tag-api entscheidet pro Request; Buttons erscheinen nur bei bestätigter Capability.
8. **Jedes TAG erhält einen eigenen Snapshot** in R2/D1 – auch bei unveränderter Standardvorlage.
9. **Keine Geräte-UUID**: Wiedererkennung ausschließlich über die TAG-Session; Cookies bleiben auf das unbedingt Erforderliche beschränkt (8.5).
10. **Offen und bewusst zurückgestellt**: Renderer-Eingang `D-03`, PDF-Seiten `D-17`, Wartungsdaten `D-18`, Contract v3 mit Capabilities `D-19`/`D-24`, Upload/Delete und Eigentum `D-22`/`D-23`. Sie sind in Abschnitt 19 als Detailierungspunkte gesammelt.
11. **Das Tool ist eine Datei-Werkbank**: „Load / Save / Save as", mit kumulativer Migrationskette, Default-Werten und harten, erklärten Fehlern; ein Reparaturmodus rettet alte Dateien.
12. **Complex Items liegen in einer Bibliotheksdatei** (`myqr24-tag-element-library-v1`), die beim Start als Default geladen wird, per `Save`/`Save as` versioniert und nur im Designer wirkt – nie als Laufzeitreferenz. Golden Files sind zugleich die ausgelieferten Default-Dateien.
13. **OP-01 und OP-02 sind ausdetailliert** (PDF-Seiten, Löschen eigener Uploads), bleiben aber optional und brauchen je eine eigene Story mit Tests, bevor sie umgesetzt werden.

Dieses Dokument bleibt unverbindlich, bis es über die Schritte in Abschnitt 16 übernommen wurde.

---

## 19. Optionale Punkte für die nächste Detailierungsrunde

Diese Punkte sind bewusst **nicht** entschieden. Sie ändern die Grundarchitektur nicht, brauchen aber je eine eigene Entscheidung, einen Contract-Bezug und mindestens eine Story mit Testfällen. Reihenfolge = Vorschlag, nicht Beschluss. **OP-01 und OP-02 sind in Revision 3 ausdetailliert**, bleiben aber weiterhin optional (nicht v1).

| ID | Thema | Kernfrage | Betroffene Artefakte |
| --- | --- | --- | --- |
| `OP-01` | PDF-Seitendarstellung | Wie werden Seiten gerendert, gezählt und geblättert? | `document`-Element, pdf.js, Varianten, A11y |
| `OP-02` | Löschen eigener Gast-Uploads | Wie erkennt das System „mein Bild" verlässlich? | `actions.delete.guestScope`, Sessionbindung, D1 |
| `OP-03` | Gast-Identität und Wiedererkennung (ausdetailliert, optional) | Welche Identität ist zulässig und wie lange? | Cookies, DSGVO/TDDDG, Sessionmodell |
| `OP-04` | Wartungshistorie (ausdetailliert, optional) | Welche Felder, Sortierung und Nachweise? | `maintenance-history`, `item.json`, D1 |
| `OP-05` | Content-Contract v3 | Wie kommen Theme/Layout/Capabilities in die API? | `tag-app-access-v1` → v3 |
| `OP-06` | Upload-Pipeline | Quarantäne, Prüfung, Varianten, Limits, Moderation | R2, Media Signer, Queue |
| `OP-07` | Editierbarkeits-Grammatik | Wie fein darf individualisiert werden? | `editability`, User-Designer |
| `OP-08` | Vorlagen-Updates | Wie kommt eine neue Master-Version in bestehende TAGs? | TCP, Instanz-Migration |
| `OP-09` | Optionaler Katalog | Welche Elemente zuerst? | 5.19, Roadmap |
| `OP-10` | Mehrsprachigkeit | Ein Dokument je Sprache oder Sprachfelder? | `locale`, RichText |
| `OP-11` | Barrierefreiheit | Tastatur, Screenreader, Fokusführung in Lightbox/Paging | TAG-App, Designer |
| `OP-12` | Theme-Assets | Urheberrecht, Kontrast, Varianten, Austauschbarkeit | `cel_theme`, R2 |
| `OP-13` | Template-Verwaltung | Wo und wie werden viele Vorlagen verwaltet (Liste, Suche, Versionen, Teilen)? | TCC/User-App, TCP, `myqr24-tag-content-template-v1` |

### 19.1 OP-01 – PDF-Seitendarstellung im Detail

**Ziel:** Ein `document`-Element soll ein PDF nicht nur verlinken, sondern seitenweise lesbar machen – auf Handy, Tablet und Desktop, ohne Serverumweg für die Anzeige und ohne dass Rechte oder Datenschutz aufgeweicht werden.

**Nicht-Ziel:** PDF-Bearbeitung, Formulare, Kommentare, Annotationen, Textextraktion für Suche, Druck-Workflows oder das Entsperren geschützter Dokumente.

**Varianten und Bewertung**

| Variante | Wie | Vorteile | Nachteile |
| --- | --- | --- | --- |
| **A – pdf.js im Client** | PDF wird über die autorisierte URL geladen und im Browser gerendert | kein zusätzlicher Speicher, immer aktuelle Datei, alle Modi möglich, Seitenzahl direkt verfügbar | Bundle-Größe, CPU/RAM auf alten Geräten, Canvas-Speicher muss aktiv freigegeben werden |
| **B – Server-Page-Varianten** | Beim Upload/Publish werden `page-1…n` als Bildvarianten erzeugt | schlanker Client, schnelle erste Seite, funktioniert auch ohne JS-Renderer | zusätzlicher Speicher, Pipeline, Seitenzahl muss vorab bekannt sein, Text nicht selektierbar |
| **C – nur `link`** | Dokument wird verlinkt/zum Download angeboten | trivial, robust, immer verfügbar | kein Blättern, kein „im TAG lesen" |
| **D – natives Embed/iFrame** | Browser-PDF-Viewer einbetten | kein Code | Fremdinhalt, CSP-/Sicherheitsproblem, nicht steuerbar – **ausgeschlossen** |

**Empfehlung (Vorschlag für `D-17`):** **A** für v1, **C** als dauerhafter Rückfall. **B** erst einführen, wenn Messungen zeigen, dass pdf.js auf Zielgeräten zu langsam ist oder wenn Seiten auch ohne JavaScript sichtbar sein müssen. Ein Mischbetrieb ist möglich: `link` bleibt immer wählbar, `box-scroll`/`pages-*` sind optional pro Element.

**Seitenzahlermittlung**

1. Bevorzugt: pdf.js liest `numPages` beim Öffnen.
2. Ergänzend beim Upload: Seitenzahl als Metadatum in der Variante (`page_count`), damit die UI vor dem Rendern „Seite 1 von 12" anzeigen kann.
3. Nie geschätzt: keine Ableitung aus Dateigröße.

**Darstellungsmodi (verbindlich, sobald OP-01 umgesetzt wird)**

| `display` | Verhalten | Voraussetzung | Rückfall |
| --- | --- | --- | --- |
| `box-scroll` | Dokument in Box fester Höhe, vertikal scrollend, alle Seiten virtuell | pdf.js | `link` |
| `pages-paged` | genau eine Seite, Blättern vor/zurück, Seitenzähler | pdf.js + `numPages` | `box-scroll` → `link` |
| `pages-stacked` | alle Seiten untereinander | pdf.js | `box-scroll` → `link` |
| `pages-side-by-side` | Seiten horizontal, Wischen/Scrollen | pdf.js | `pages-paged` → `link` |
**Lade- und Speichermodell**

1. pdf.js wird **nur** geladen, wenn ein `document`-Element einen der Seitenmodi nutzt (`import()` lazy, kein Bundle im Startpfad).
2. Die Datei wird ausschließlich über die signierte URL der API geladen (kein direkter R2-Pfad, kein Blob im Cache).
3. Es werden nur sichtbare plus eine Seite vor/zurück gerendert (Fenster von drei Seiten); beim Verlassen des Elements werden Canvas und Worker freigegeben.
4. Rendering-Auflösung wird auf `min(devicePixelRatio, 2)` begrenzt, um Speicher auf schwachen Geräten zu schonen.
5. Jeder Ladevorgang ist abbrechbar (`AbortController`); ein Wechsel des Elements bricht laufende Renderings ab.

**Grenzen (Vorschlag)**

| Limit | Wert | Grund |
| --- | ---: | --- |
| Seiten je Dokument | 200 | darüber ist Blättern unbrauchbar, Download genügt |
| Dateigröße | 25 MiB | Ladezeit auf Mobilfunk |
| gleichzeitig gerenderte Seiten | 3 | Speicher |
| Zeitlimit erste Seite | 10 s, danach Rückfall auf `link` | verhindert hängende Ansicht |

**Fehlerfälle**

| Fall | Verhalten |
| --- | --- |
| Datei defekt/kein PDF | neutrale Meldung im Element, `link`-Rückfall, kein technischer Stacktrace |
| Passwortgeschützt/verschlüsselt | neutral ablehnen, niemals im Browser entsperren |
| Signierte URL abgelaufen | einmalige Neuanforderung über die API, danach Meldung |
| Netzwerkfehler/Offline | Hinweis + Retry, kein Endlos-Spinner |
| Browser ohne Canvas/Worker | `link`-Rückfall |

**Datenschutz und Signierung:** Seiten sind Medien. Sie werden wie Fotos über `POST /api/get-image-url` signiert, kurzlebig ausgeliefert und **nicht** im Service Worker oder `localStorage` zwischengespeichert. Variante **B** würde zusätzliche Seitenbilder erzeugen, die derselben Sichtbarkeits- und Widerrufslogik unterliegen müssen.

**Barrierefreiheit:** `role="document"`, Fokusführung beim Blättern, `aria-live` für „Seite 3 von 12", Tastatur (`←`/`→`, `PageUp`/`PageDown`, `Home`/`End`), Zoom per Tastatur, `prefers-reduced-motion`. Ein Text-Layer ist optional und nur lesend.

**Akzeptanzkriterien (Entwurf für eine spätere Story)**

- Ein PDF öffnet sich im gewählten Modus; die erste Seite ist in unter 3 s sichtbar (Zielgerät, LTE).
- Blättern funktioniert per Tastatur, Wischgeste und Buttons; der Seitenzähler stimmt.
- Ein defektes oder geschütztes PDF führt zu einer neutralen Meldung mit `link`-Rückfall.
- Nach dem Verlassen des Elements sinkt der Speicher wieder (Canvas freigegeben).
- Ohne JavaScript bleibt der Download-Link nutzbar.

**Offene Punkte zu OP-01:** Kosten/Nutzen der Server-Page-Varianten (B), Umgang mit sehr großen/scannenden PDFs, Druckfunktion, Textsuche, Seitenzahl als Pflichtmetadatum beim Upload.

### 19.2 OP-02 – Eigene Gast-Uploads löschen

**Ziel:** Ein Gast, der ein Bild hochgeladen hat, soll es wieder entfernen können – ohne Konto, ohne Geräte-Fingerprint und ohne dass der Browser über die Berechtigung entscheidet. Der Owner darf alles löschen.

**Nicht-Ziel:** Wiederherstellung gelöschter Uploads durch den Gast, Bearbeiten von Bildern, Übertragen von Eigentum zwischen Gästen, geräteübergreifende Wiedererkennung.

**Datenmodell – Varianten**

| Variante | Umsetzung | Vorteil | Nachteil |
| --- | --- | --- | --- |
| **A – Spalte am Item** | `tag_content_items.owner_guest_session_id_hash TEXT NULL` | minimal, eine Zeile, schnelle Prüfung | nur ein Besitzer pro Item, Migration an bestehender Tabelle |
| **B – Membership-Tabelle** | `tag_content_item_owners(content_id, session_id_hash, role, created_at)` | mehrere Beteiligte, Historie | zusätzliche Tabelle und Joins |

**Empfehlung (`D-23`):** **A** für v1 (ein Uploader pro Item reicht fachlich), **B** nur, wenn später Mehrfach-Uploads in gemeinsame Alben oder Übertragungen nötig werden.

```sql
ALTER TABLE tag_content_items
  ADD COLUMN owner_guest_session_id_hash TEXT NULL
  CHECK (owner_guest_session_id_hash IS NULL OR length(owner_guest_session_id_hash) = 43);

CREATE INDEX IF NOT EXISTS tag_content_items_owner_session_idx
  ON tag_content_items (owner_guest_session_id_hash, status);
```

Regeln: Der Hash wird aus dem Sessiontoken gebildet (dasselbe Verfahren wie `tag_access_sessions.token_hash`), **nie** aus IP, User-Agent oder Gerätekennung. Owner-Uploads haben `NULL` und werden über die Owner-Session geprüft. Bestehende Zeilen bleiben `NULL` und sind damit für Gäste nicht löschbar.

**Nachweis (serverseitig)**

1. Die Anfrage trägt ausschließlich die `contentId`; die Session kommt aus dem `HttpOnly`-Cookie.
2. Der Server bildet den Hash des aktuellen Sessiontokens und vergleicht ihn **timing-safe** mit `owner_guest_session_id_hash`.
3. Zusätzlich geprüft: TAG-Zugehörigkeit (Item gehört zu diesem TAG), `status`, `access_version`, Scope (`guest`/`shared`), Element-Sichtbarkeit.
4. Ein Client-Parameter (z. B. `ownerId`, `sessionId` im Body) wird **ignoriert**; er könnte sonst beliebig gefälscht werden.
**Rechte- und Zustandsmatrix**

| Item-Status | Gast (eigenes Item) | Gast (fremdes Item) | Owner | Admin |
| --- | --- | --- | --- | --- |
| `pending` | löschen erlaubt | nein | löschen erlaubt | löschen erlaubt |
| `quarantined` | nein (in Prüfung) | nein | löschen erlaubt | löschen erlaubt |
| `ready` (veröffentlicht) | löschen erlaubt, solange nicht moderiert/hervorgehoben | nein | löschen erlaubt | löschen erlaubt |
| `revoked` | nein (bereits gelöscht) | nein | nein | nein |

Ein Template kann diese Rechte nur **einschränken** (z. B. `delete.principals: ["owner"]`), nie erweitern. Ist `guestScope: ownOnly` gesetzt, die Eigentumsbindung aber nicht vorhanden, ist der Export bereits gesperrt (TCD-TC-035).

**Löscharten**

1. **Soft Delete** (Standard): `status = 'revoked'`, `revoked_at` setzen; Item verschwindet sofort aus `elements[]`/`items[]`, Dateien bleiben für die Retention-Frist.
2. **Hard Delete** (nach Frist oder durch Admin): Zeilen entfernen, Medienvarianten und R2-Objekte löschen, Referenzen in `tag_content_element_items` kaskadierend.
3. **Thumbnail-/Varianten-Cleanup** läuft asynchron; ein Löschvorgang gilt als erfolgreich, sobald D1 und die Sichtbarkeit stimmen, nicht erst nach dem R2-Cleanup.
4. Bereits ausgegebene signierte URLs können nicht zurückgeholt werden; nach dem Löschen werden **keine neuen** Signaturen ausgestellt.

**Recovery und Eskalation**

- Bei Sessionverlust (neues Gerät, Storage geleert, Inkognito beendet) ist Self-Service-Löschen **nicht** mehr möglich. Es gibt keinen Fingerprint-Fallback und keine Wiederherstellung über die TAG-ID.
- Auswege: (a) Owner löscht im TCC; (b) Gast stellt einen **Löschantrag** (Element-Referenz + Zeitfenster), der im TCC als Aufgabe erscheint; (c) `pending`-Uploads laufen automatisch ab.
- Der Löschantrag enthält **keine** freie Identitätsbehauptung, sondern nur Item- und TAG-Bezug; die Entscheidung trifft der Owner.

**API-Skizze (Vorschlag, `D-22`)**

```http
DELETE /api/v1/tags/{tagId}/items/{contentId}
Cookie: myqr24_tag_access=…
Idempotency-Key: …

204 No Content          # gelöscht (auch wenn bereits revoked)
403 / neutral 404       # nicht berechtigt / nicht vorhanden (kein Unterschied nach außen)
409 Conflict            # Status erlaubt kein Löschen (z. B. quarantined)

POST /api/v1/tags/{tagId}/items/{contentId}/delete-request
202 Accepted            # Löschantrag für Owner/Moderation
```

**UI**

- Löschen-Button ausschließlich am **eigenen** Item, in Lightbox und Listenzeile identisch beschriftet.
- Bestätigungsdialog mit Bildvorschau und dem Hinweis, dass die Löschung nicht rückgängig gemacht werden kann.
- Nach dem Löschen bleibt die Galerie-Position erhalten (kein Sprung an den Anfang), das nächste Bild wird fokussiert.
- Fehlerfälle: „Nicht mehr vorhanden" (neutral), „Keine Berechtigung" (neutral), „Wird geprüft" (bei `quarantined`).

**Audit, Retention und Datenschutz**

- Jeder Löschvorgang erzeugt ein Audit-Ereignis: Akteur-Art (`guest`/`owner`/`admin`), TAG, `contentId`, Zeitpunkt, Ergebnis. Keine IP, kein Token, kein Dateiname im Audit.
- Retention: Soft Delete mindestens 30 Tage, danach Hard Delete durch Cleanup; konkrete Frist ist eine Betriebsentscheidung.
- Ein Löschentscheid des Owners wird nicht gegenüber dem Gast begründet (neutrale Antwort), um keine Informationen über andere Uploads zu leaken.

**Akzeptanzkriterien (Entwurf für eine spätere Story)**

- Ein Gast kann sein eigenes Bild löschen und sieht es unmittelbar nicht mehr; die API bestätigt mit `204`.
- Der gleiche Aufruf auf ein fremdes Item liefert neutral `404` und ändert nichts.
- Ein `quarantined`-Item kann der Gast nicht löschen; der Button ist nicht sichtbar.
- Nach Sessionverlust ist kein Self-Service-Löschen möglich; ein Löschantrag kann gestellt werden.
- Ein Owner kann jedes Item seines TAGs löschen; fremde TAGs bleiben unberührt.

**Offene Punkte zu OP-02:** exakte Retention-Frist, Papierkorb-Konzept für den Owner, Benachrichtigung des Gastes bei Moderationslöschung, Verhalten bei mehreren Uploadern pro Album (Variante B).

### 19.3 OP-03 – Gast-Identität, Wiedererkennung und Cookies

**Status: für die erste Implementierung optional.** Die bestehende TAG-Session genügt für den Lese-Betrieb; Gast-Sessions werden erst mit Uploads gebraucht.

**Ziel:** Eine belastbare, zweckgebundene Identität für genau den Vorgang, den der Nutzer ausgelöst hat – ohne Geräte-UUID, ohne Fingerprint und ohne TAG-übergreifende Wiedererkennung.

**Identitätsmodell (drei getrennte Dinge)**

| Ebene | Was | Lebensdauer | Bindung |
| --- | --- | --- | --- |
| **Session** | serverseitig ausgestelltes Zufallstoken, nur Hash in D1 | TTL je Typ (s. u.) | `tag_id`, `access_version`, Scope |
| **Item-Eigentum** | `owner_guest_session_id_hash` am Item (19.2) | bis Löschung | Session-Hash des Uploaders |
| **Datei-Handle** | Browser-Handle für Load/Save (7.6) | bis Berechtigung entzogen | nur lokal, nie serverseitig |

**Session-Typen**

| Typ | Scope | Ausgestellt durch | TTL (Vorschlag) | Darf |
| --- | --- | --- | --- | --- |
| Lesesession öffentlich | `public` | `POST /access/public` nach signiertem Bootstrap | 24 h | öffentliche Inhalte lesen |
| Lesesession PIN | `pin` | `POST /verify-pin` (Argon2id + Pepper) | 24 h | zusätzlich `shared` lesen |
| Gast-Session | `guest` | späterer Endpunkt, z. B. `POST /access/guest` | 12 h | Upload eigener Items, eigene löschen |

**Cookie-Parameter (verbindlich, sobald umgesetzt)**

| Parameter | Wert | Begründung |
| --- | --- | --- |
| Name | `myqr24_tag_access` (Lese-/PIN), `myqr24_guest_access` (Gast) | getrennte Zwecke, getrennte Widerrufbarkeit |
| `HttpOnly` | ja | kein JavaScript-Zugriff |
| `Secure` | ja | nur HTTPS |
| `SameSite` | `Strict` | kein Cross-Site-Senden; `Path=/api` begrenzt zusätzlich |
| `Path` | `/api` | Cookies gehen nicht an statische Assets |
| `Max-Age` | 24 h (Lesen/PIN), 12 h (Gast), 30 Tage **nur** per Opt-in | kurze Laufzeit = weniger Risiko, 8.5 |
| Rotation | neues Token bei jeder Re-Authentisierung; altes wird widerrufen | verhindert Session-Fixation |

**Lebenszyklus**

1. **Ausstellung** nur nach serverseitig geprüftem Bootstrap (HMAC + `revision` + `access_version`) bzw. erfolgreicher PIN-Prüfung.
2. **Ablauf** ist absolut (`expires_at`), nicht nur idle-basiert; zusätzlich wird `last_seen_at` geführt.
3. **Widerruf** geschieht zentral über `access_version`: Jede Erhöhung (PIN-Änderung, Sperrung, Deaktivierung) entwertet alle Sessions des TAGs, ohne sie einzeln zu löschen.
4. **Logout** setzt `revoked_at`, löscht das Cookie und ist idempotent.
5. **Speicherhygiene:** alte, abgelaufene Sessionzeilen werden nach einer Frist aufgeräumt; der Token-Hash bleibt bis dahin für Auditzwecke, aber ohne Personenbezug.

**Sicherheitsregeln**

| Risiko | Gegenmaßnahme |
| --- | --- |
| Session-Fixation | Token wird ausschließlich serverseitig erzeugt, nie aus Client-Daten abgeleitet; Rotation bei Re-Auth |
| Token-Diebstahl | `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/api`, kurze TTL |
| CSRF | `SameSite=Strict` plus `content-type: application/json`-Prüfung; keine zustandsändernden GETs |
| Enumeration | neutrale `404`-Antworten, gleiche Antwortzeit, kein Unterschied zwischen „TAG existiert nicht" und „keine Session" |
| Missbrauch | Rate Limits pro TAG und Client-Signal; PIN-Throttle mit 15 Minuten Sperre nach 5 Fehlversuchen (bestehend) |
| Logging | keine Tokens, keine PINs, keine IP im Sessionlog; Korrelation über interne IDs |

**Datenschutz:** Ein Zufallstoken ist personenbezogen, sobald es einem Vorgang zugeordnet werden kann. Deshalb: Zweckbindung (nur Zugriff/Upload), kurze TTL, keine TAG-übergreifende Verkettung, Löschung bei Logout, Transparenz im Datenschutzhinweis. Rechtliche Einordnung in **8.5**; Freigabe durch DSB/Recht.

**Akzeptanzkriterien (Entwurf)**

- Ein Cookie wird nur nach erfolgreicher Prüfung ausgestellt und trägt `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/api`.
- Erhöhung der `access_version` macht bestehende Sessions sofort ungültig.
- Logout widerruft die Session und entfernt das Cookie.
- Eine Gast-Session kann ausschließlich Items desselben TAGs anlegen und eigene löschen.
- Es existiert keine geräteübergreifende Wiedererkennung und keine Kennung außerhalb der Session.

**Offene Punkte zu OP-03:** exakte TTL-Werte, Opt-in-Mechanik („angemeldet bleiben"), Aufbewahrungsfrist für abgelaufene Sessions, Verhalten bei mehreren parallelen Geräten, Benachrichtigung bei PIN-Änderung.

### 19.4 OP-04 – Wartungshistorie

**Status: für die erste Implementierung optional.** Der TAG-Typ `maintenance` und das Element `maintenance-history` sind vorgemerkt, aber nicht v1.

**Ziel:** Ein Wartungs-TAG zeigt die Historie eines Objekts (Fahrzeug, Maschine, Anlage) als chronologische Liste mit Nachweisen – ohne dafür ein zweites Datenmodell in der TAG-App zu erfinden.

**Datenmodell – Varianten**

| Variante | Umsetzung | Vorteil | Nachteil |
| --- | --- | --- | --- |
| **A – `item.json`** | bestehender R2-Pfad `items/{contentId}/item.json` wird erweitert und von der API **gelesen** | keine D1-Migration, strukturierte Felder pro Eintrag, Nutzen für alle Item-Typen | zusätzliche R2-Reads beim Content-Aufruf, Sortierung nur über `display_order` |
| **B – `tag_content_item_attributes`** | schmale Tabelle `(content_id, key, value)` | sortier-/filterbar in D1, kein R2-Read | neues Schema, Migration, mehr Schreiblogik |

**Empfehlung (`D-18`):** **A** für v1 des Wartungs-Typs; **B** erst, wenn serverseitig nach Datum gefiltert werden muss.

```json
{
  "schema": "myqr24-content-item-v1",
  "contentId": "1850000000000000",
  "type": "maintenance-entry",
  "title": "Jahresservice",
  "alt": "Servicebericht 2026",
  "maintenance": {
    "date": "2026-03-14",
    "kind": "service",
    "odometerKm": 48210,
    "operatingHours": null,
    "summary": "Ölwechsel, Bremsen geprüft, Filter ersetzt.",
    "performedBy": "authorized-partner",
    "costVisible": false
  }
}
```

Regeln: `date` ist ISO-`YYYY-MM-DD`, `kind` ein geschlossenes Enum (`service`, `repair`, `inspection`), Zahlen sind ganzzahlig und nicht negativ, `summary` max. 500 Zeichen. Unbekannte Felder werden **nicht** an den Client weitergereicht.

**Sortierung und Gruppierung**

- `display_order` wird beim Publish aus `date` abgeleitet (Standard: neueste zuerst), damit die bestehende Sortierlogik der API genügt.
- Gruppierung optional nach Jahr (`groupBy: "year"`) oder Typ (`groupBy: "kind"`); die Gruppierung ist reine Darstellung.
- Einträge ohne Datum sind unzulässig (Pflichtfeld), damit die Sortierung stabil bleibt.

**Sichtbarkeit**

- Öffentliche Historie zeigt nur Einträge mit `visibility: public`.
- Service-Nachweise (Rechnungen, Prüfberichte) dürfen `shared` sein; sie erscheinen nur mit PIN-Session.
- `private`/`ownerOnly` bleiben für Scanner unsichtbar (bestehende Logik, 6.2).

**Anzeige (Renderer)**

- Kompakte Liste mit Datum, Typ-Badge, Kurztext und Nachweis-Icon; Tippen öffnet den Eintrag.
- Kopfzeile mit Zusammenfassung: Anzahl Einträge, letzter Service, optional Gesamtkosten (nur wenn `costVisible`).
- Nachweise werden über die normalen Medien-Endpunkte geladen (Signierung wie Fotos), Vorschau `thumb`, Öffnen `full`.
- Lange Historien: Paginierung oder „mehr laden" ab 20 Einträgen.

**Publish-Regeln**

- `maintenance-entry` ist nur zulässig, wenn der TAG-Typ `maintenance` hat und das Feature freigegeben ist.
- Jeder Eintrag braucht mindestens Titel oder Zusammenfassung; ein Eintrag ohne Nachweis ist erlaubt.
- Ein Eintrag mit `kind: inspection` darf ein Ablaufdatum (`validUntil`) tragen; abgelaufene Prüfungen werden dezent markiert, nie ausgeblendet.

**Grenzen**

| Limit | Wert |
| --- | ---: |
| Einträge je TAG | 256 |
| Nachweise je Eintrag | 8 |
| Länge `summary` | 500 Zeichen |

**Datenschutz:** keine Techniker-, Kunden- oder Halternamen ohne Einwilligung; `performedBy` ist ein Rollen-/Partnerkürzel, keine Person. Kosten sind optional und standardmäßig nicht öffentlich. Kennzeichen/Seriennummern nur, wenn der Owner sie bewusst veröffentlicht.

**Akzeptanzkriterien (Entwurf)**

- Ein Wartungs-TAG zeigt die Einträge absteigend nach Datum.
- Ein Eintrag öffnet Nachweise über signierte URLs; ohne Session erscheinen keine `shared`-Nachweise.
- Ein Eintrag ohne Datum wird beim Publish abgelehnt.
- Abgelaufene Prüfungen sind markiert, aber sichtbar.
- Ein TAG ohne `maintenance`-Feature kann das Element nicht veröffentlichen.

**Offene Punkte zu OP-04:** Erfassungs-UI (Owner-App), Import aus Werkstattberichten, Kosten-/Steuer-Export, Mehrsprachigkeit der Typen, Verhalten bei Objektverkauf (Historie übertragen oder trennen).

### 19.5 OP-05 – Content-Contract v3

- Top-Level: `template`, `theme`, `layout`, `navigation`, `capabilities`, `elements`.
- Element-Payload: `{ content, style, slots }` (siehe 6.1).
- v2 bleibt parallel lesbar (Feature-Flag im Client), Migration eigener Contract-Schritt.
- Neue Pflicht: serverseitige Payload-Validierung je `elementType` vor dem Ausliefern.

### 19.6 OP-06 – Upload-Pipeline

- Direkt-Upload zu R2 (presigned) oder durch den Worker; Quarantäne vor jeder Veröffentlichung.
- Prüfungen: MIME/Typ, Größe, Dimensionen, optional Virenscan; Varianten (`thumb`/`mid`/`full`) erzeugen.
- Moderation: Freigabe durch Owner/Admin, Ablehnung mit neutraler Meldung; Audit und Retention.

### 19.7 OP-07 – Editierbarkeits-Grammatik

- Pfad-Syntax für `allow` (z. B. `elements[*].content.heading`), Wildcards, `locked`.
- Konfliktregeln: Was passiert, wenn eine neue Master-Version ein Feld entfernt, das die Instanz bereits angepasst hat?

### 19.8 OP-08 – Vorlagen-Updates

- Diff zwischen Master-Versionen, Vorschau, bewusste Migration pro TAG, niemals automatisch.
- Rückfall: Instanz bleibt auf alter Version lauffähig, auch wenn die Vorlage `retired` ist.

### 19.9 OP-09 – Optionaler Katalog

- Priorisierung nach Pilot-TAGs: Wartung/Timeline zuerst, Medien (Video/Audio) danach, Karten/POI zuletzt.

### 19.10 OP-10 – Mehrsprachigkeit

- Ein Dokument je `locale` oder Sprachfelder im selben Dokument; Fallback-Kette und Pflegeaufwand bewerten.

### 19.11 OP-11 – Barrierefreiheit

- Fokusführung in Lightbox und Seitenansicht, `Escape`, `aria-live` beim Seitenwechsel, Tastatur im Thumbnail-Picker, `prefers-reduced-motion`.

### 19.12 OP-12 – Theme-Assets

- Urheberrecht fremder Bilder, Variantenwahl, Austauschbarkeit, Kontrastsicherung, dekorative Bilder ohne Alt-Text.

### 19.13 OP-13 – Template-Verwaltung (später)

Heute ist das Tool bewusst eine **Datei-Werkbank**: laden, bearbeiten, speichern. Sobald mehrere Personen und mehrere Vorlagen beteiligt sind, braucht es eine Verwaltung – aber nicht im Offline-Tool.

| Frage | Vorschlag |
| --- | --- |
| Wo? | TCC (intern) und später User-App (eigene Vorlagen), nicht in `tools/` |
| Datenmodell | dieselbe Datei als Dokument (`document_json`, `kind` = `master` oder `instance`, `document_sha256`) wie in 9.2 |
| Funktionen | Liste, Suche nach `templateId`/`tagType`/Status, Versionshistorie, Vorschau, Teilen/Freigeben, `retire` |
| Upload/Download | identische Datei wie im Offline-Tool, damit ein Roundtrip verlustfrei bleibt |
| Rechte | Freigabe durch Plattformrolle mit Re-Authentisierung (`D-11`) |
| Offline | bleibt erstklassig: die Verwaltung ist Komfort, keine Voraussetzung |

Damit ist sichergestellt, dass die im Offline-Tool erzeugten Dateien und die später verwalteten Vorlagen **dasselbe Format** haben und keine zweite Wahrheit entsteht.

**Nächster sinnvoller Detailierungsschritt:** `OP-01` (PDF-Seiten) und `OP-02` (Löschen eigener Uploads) zuerst, weil beide direkt die Elemente `document` und `gallery` betreffen und ohne sie zwei der fünf Pflicht-Elemente nur eingeschränkt nutzbar sind.






