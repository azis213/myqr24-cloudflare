# TAG-Generator – Umsetzungsspezifikation

**Status:** Implementiert – MVP, Teststand 2026-10-07  
**Geltungsbereich:** Lokale Browseranwendung in `tools/tag-gen/`  
**Anforderungsquelle:** `tools/tag-gen/Refine.md`  
**Verbindliche Codec-Referenz:** `apps/edge-router/src/codec/index.ts`

## 1. Ziel und Abgrenzung

Der TAG-Generator ist eine lokale Desktop-Browseranwendung zum Definieren von TAG-Bereichen, Generieren kompatibler QR-TAG-IDs, Gestalten von Etikettenvorlagen sowie Erzeugen mehrseitiger PDF-Druckvorlagen.

Die Anwendung arbeitet vollständig im Browser und benötigt in Version 1 weder Backend noch Cloudflare-Zugang. Daten werden eingegeben, lokal gespeichert oder explizit importiert/exportiert.

### Nicht-Ziele für Version 1

- Benutzerverwaltung oder Cloud-Synchronisierung
- Direkter Betrieb des Systemdruckdialogs
- Verwaltung von Edge-Router-KV-Ranges, Redirects oder Features
- Speicherung oder Export von Feistel-/HMAC-Geheimnissen
- Netzwerkzugriffe oder API-Requests

Der Download einer druckfähigen PDF-Datei ist die Schnittstelle zum anschließenden Druck.

---

## 2. Technische Architektur

### 2.1 Projektstruktur

Die Anwendung wird als eigenständiges Vite-/TypeScript-Projekt angelegt:

```text
tools/tag-gen/
├── Refine.md
├── SPECIFICATION.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── public/
│   └── icon.svg
└── src/
    ├── main.ts
    ├── app.ts
    ├── styles.css
    ├── codec/
    │   └── index.ts
    ├── domain/
    │   ├── models.ts
    │   ├── range-validation.ts
    │   ├── tag-generation.ts
    │   └── label-layout.ts
    ├── services/
    │   ├── browser-storage.ts
    │   ├── config-transfer.ts
    │   ├── tag-list-transfer.ts
    │   ├── qr-renderer.ts
    │   └── pdf-export.ts
    ├── views/
    │   ├── ranges-view.ts
    │   ├── generated-tags-view.ts
    │   ├── template-editor-view.ts
    │   ├── print-preview-view.ts
    │   └── data-transfer-view.ts
    └── components/
        ├── number-input.ts
        ├── label-canvas.ts
        ├── page-preview.ts
        └── notifications.ts
```

### 2.2 Technologien

| Bereich | Festlegung |
| --- | --- |
| Sprache | TypeScript, `strict: true` |
| Laufzeit | Browser, vollständig clientseitig |
| Build | Vite |
| Präzisionszahlen | `bigint`, nie JavaScript `number` für TAG-Werte |
| QR-Code | Vorhandenes Paket `qrcode` |
| PDF | Clientseitige Erzeugung, vorzugsweise `jspdf` |
| Kryptografie | Browser Web Crypto API über den Edge-Router-Codec |
| Persistenz | `localStorage` nur für nicht-sensitive Arbeitsdaten |
| Tests | Vitest |

Für PDF-Erzeugung darf `jspdf` als Abhängigkeit ergänzt werden. Eine funktional gleichwertige clientseitige Alternative ist zulässig, wenn sie Millimeter-Koordinaten, A4-Seiten und hochauflösende QR-Codes zuverlässig unterstützt.

---

## 3. Sicherheits- und Geheimnisregeln

`FEISTEL Secret` und `HMAC Secret` sind sensible Laufzeiteingaben.

Verbindliche Regeln:

- Beide Felder sind Passwortfelder mit expliziter Sichtbarkeitsumschaltung.
- Geheimnisse bleiben ausschließlich im Arbeitsspeicher.
- Geheimnisse werden nicht in `localStorage`, `sessionStorage`, IndexedDB, URLs, Logs oder Fehlermeldungen geschrieben.
- Geheimnisse sind weder Bestandteil eines Konfigurationsexports noch eines TAG-Listen-Exports.
- Importierte Geheimnisfelder werden ignoriert; die UI warnt darüber.
- Nach Seitenreload oder Browser-Neustart müssen Geheimnisse erneut eingegeben werden.
- Die Anwendung führt keine Netzwerkrequests aus.
- Testdaten verwenden ausschließlich klar markierte Testgeheimnisse.

---

## 4. Verbindliche TAG-Codec-Kompatibilität

### 4.1 Referenz

`apps/edge-router/src/codec/index.ts` ist die maßgebliche Implementierung. Der Codec wird bevorzugt direkt als gemeinsamer Source importiert; alternativ wird er unverändert nach `tools/tag-gen/src/codec/index.ts` kopiert.

Eine eigenständige algorithmische Neuimplementierung von Feistel, HMAC oder Cycle Walking ist nicht zulässig. Bei einer Kopie muss ein Kompatibilitätstest gegen die Referenz existieren.

### 4.2 Fachliche Regeln

- Unterstützte öffentliche TAG-Längen: **6** und **8** Base36-Zeichen.
- Öffentliche IDs sind klein geschrieben: `0-9`, `a-z`.
- Kanonischer Wertebereich für Länge `L`:

  ```text
  [36^(L - 1), 36^L)
  ```

- Alle Grenzen und Berechnungen verwenden `bigint`.
- Bei Länge 6 wird der kanonische Eingabewert direkt kodiert.
- Bei Länge 8 ist der Eingabewert eine 16-ausgerichtete Basis:

  ```text
  value % 16n === 0n
  ```

- Bei Länge 8 berechnet `calculateHmacNibble()` die unteren vier Bits, bevor der Feistel-Encoder aufgerufen wird.
- Feistel-Runden, Domains, Blockgrößen und Cycle-Walk-Verhalten entsprechen exakt der Referenz.
- Bei unvollständigen Geheimnissen, ungültigen Werten oder Codec-Fehlern wird der Generierungslauf kontrolliert abgebrochen.

### 4.3 Bedeutung eines 8-stelligen Bereichs

Ein 8-stelliger Bereich enthält **Basiswerte**, nicht alle 16 Werte eines Slots. Pro ausgerichtetem Basiswert wird genau ein öffentlicher TAG erzeugt.

Für Start und Ende gilt:

```text
start % 16n === 0n
end % 16n === 0n
```

Der beim Kodieren entstehende dekodierte Wert kann wegen des HMAC-Nibbles zwischen `base` und `base + 15` liegen. Dadurch ist das Ergebnis vollständig mit `encodeTagId()` des Edge Routers kompatibel.

---

## 5. Datenmodell

### 5.1 Arbeitskonfiguration

```ts
interface TagGeneratorConfiguration {
  schemaVersion: 1;
  kind: "myqr24.tag-generator.config";
  name: string;
  updatedAt: string;
  baseUrl: string;
  ranges: TagRangeDefinition[];
  labelTemplates: LabelTemplate[];
  selectedTemplateId?: string;
  printSettings?: PrintSettings;
}
```

### 5.2 Bereich und QR-Profil

```ts
type TagLength = 6 | 8;
type QrErrorCorrectionLevel = "L" | "M" | "Q" | "H";
type QrVersion = "auto" | 1 | 2 | /* … */ | 40;

interface QrProfile {
  version: QrVersion;
  errorCorrectionLevel: QrErrorCorrectionLevel;
  quietZoneModules: number;
}

interface TagRangeDefinition {
  id: string;
  name: string;
  start: string; // präziser Dezimalstring
  end: string;   // präziser Dezimalstring
  tagLength: TagLength;
  labelText: string;
  qrProfile: QrProfile;
  createdAt: string;
  updatedAt: string;
}
```

Die Konfiguration enthält zusätzlich ein `defaultQrProfile`. Es wird als Voreinstellung beim Anlegen oder Fortführen einer Range kopiert. Jede gespeicherte Range besitzt danach ein eigenes vollständiges Profil.

### 5.3 Generierter TAG und Listenexport

```ts
interface GeneratedTag {
  tagId: string;
  url: string;
  rangeId: string;
  rangeName: string;
  ordinalInRange: string;
  requestedValue: string;
  decodedValue: string;
  tagLength: TagLength;
  labelText: string;
}

interface TagListExport {
  schemaVersion: 1;
  kind: "myqr24.tag-generator.tag-list";
  generatedAt: string;
  source: {
    baseUrl: string;
    ranges: TagRangeDefinition[];
  };
  tags: GeneratedTag[];
}
```

Große Zahlen werden in JSON ausschließlich als Strings abgelegt. Exporte enthalten niemals Geheimnisse.

### 5.4 Etikettenvorlage

```ts
interface PositionedElement {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

interface LabelTemplate {
  id: string;
  name: string;
  page: { widthMm: 210; heightMm: 297 };
  grid: {
    columns: number;
    rows: number;
    labelWidthMm: number;
    labelHeightMm: number;
    leftMarginMm: number;
    topMarginMm: number;
    horizontalGapMm: number;
    verticalGapMm: number;
  };
  elements: {
    qr: PositionedElement & {
      quietZoneModules: number;
      errorCorrectionLevel: "M" | "Q" | "H";
    };
    text: PositionedElement & {
      fontSizePt: number;
      fontWeight: "normal" | "bold";
      horizontalAlign: "left" | "center" | "right";
      verticalAlign: "top" | "middle" | "bottom";
      lineHeight: number;
      overflow: "shrink" | "ellipsis" | "clip";
    };
  };
  createdAt: string;
  updatedAt: string;
}

interface PrintSettings {
  templateId: string;
  startRow: number;
  startColumn: number;
  selectedRangeIds?: string[];
}
```

Alle Positionen und Größen werden relativ zu einem Einzeletikett in Millimetern gespeichert.

---

## 6. Validierung

### 6.1 Basis-URL

Die globale Basis-URL wird vor jede öffentliche TAG-ID gesetzt.

- Es ist ausschließlich eine absolute HTTPS-URL zulässig.
- Leerzeichen am Anfang/Ende werden entfernt.
- Hostnamen werden normalisiert; ein abschließender Slash wird erzwungen.
- Query-String und Fragment sind unzulässig.
- Die QR-Nutzlast lautet exakt:

  ```text
  baseUrl + tagId
  ```

- Im Modus `qrIdCase: "upper"` wird die vollständige QR-Nutzlast (`baseUrl + tagId`) in Großschreibung kodiert. Im Modus `"lower"` wird die vollständige Nutzlast in Kleinschreibung kodiert.
- Die Eingabe wird auf Base45-Kompatibilität geprüft. Das zulässige Zeichenset ist:

  ```text
  0-9 A-Z Leerzeichen $ % * + - . / :
  ```

  Die Prüfung erfolgt case-insensitiv nach einer Großschreibungsnormalisierung.
- Beispielwerte sind:

  ```text
  https://s.qx4.uk/
  https://s.myqr24.com/t/
  https://qx4.uk/
  https://p.myqr24.com/t/
  ```

### 6.2 Ganzzahlfelder

`Von` und `Bis` sind reine Integerfelder.

- Akzeptiert: Dezimalziffern, Leerzeichen und `.` als Tausendertrennzeichen.
- Nicht zulässig: Vorzeichen, Komma, Nachkommastellen, Exponentialnotation.
- Persistiert wird nur die unformatierte Dezimaldarstellung.
- Nach erfolgreicher Validierung zeigt die UI deutsche Tausendertrennzeichen, z. B. `2.176.782.336`.
- Ein technisches, kopierbares Feld zeigt zusätzlich die unformatierte Zahl.

### 6.3 Bereichsregeln

- Name erforderlich, maximal 120 Zeichen, innerhalb einer Konfiguration eindeutig.
- `start` und `end` sind nichtnegative gültige `bigint`.
- `start <= end`.
- TAG-Länge wird explizit ausgewählt (`6` oder `8`).
- Beide Grenzen müssen kanonisch für die gewählte Länge sein.
- Bei Länge 8 müssen Start und Ende durch 16 teilbar sein.
- `labelText` ist optional, maximal 500 Zeichen, Zeilenumbrüche erlaubt.
- Überlappende Bereiche gleicher TAG-Länge sind nicht zulässig.
- Das Fortführen einer bestehenden Range aus der Tabelle erzeugt bewusst eine weitere Range statt einer Änderung. Der Name erhält eine fortlaufende Endung ` – Version N`; ID und Zeitstempel sind neu.
- Die QR-Version muss `auto` oder eine ganze Zahl von 1 bis 40 sein; Quiet Zone ist eine nichtnegative ganze Modulzahl. QR-Bibliotheksfehler bei einer zu kleinen erzwungenen Version brechen den Lauf mit einem verständlichen Fehler ab.
- Stückzahl:
  
  ```text
  // Länge 6
  end - start + 1
  
  // Länge 8
  ((end - start) / 16) + 1
  ```

- Initiale harte Obergrenze eines Generierungslaufs: **10.000 TAGs**. Größere Bereiche dürfen gespeichert, aber nicht einzeln erzeugt werden, bis sie aufgeteilt wurden oder ein späterer Batch-Modus existiert.

---

## 7. Benutzeroberfläche und Views

Die Anwendung richtet sich an Desktopnutzung ab 1.024 CSS-Pixel Breite. Sie besitzt eine Seitennavigation und klare Status-/Fehlermeldungen ohne Browser-`alert()`.

| View | Funktion |
| --- | --- |
| Bereiche & Generierung | Basis-URL, Bereiche, Geheimnisse und Generierungsstart |
| Generierte TAGs | Ergebnisliste, Suche, QR-Einzelvorschau, TAG-Export |
| Etikettenvorlagen | A4-Raster, Einzeletikett-Editor, Vorlage speichern |
| Druckvorschau & PDF | Startposition, Seitenvorschau, PDF-Vorschau in neuem Tab/Fenster und PDF-Download |
| Import & Export | Konfigurationen und TAG-Listen ein-/auslesen |
| Hilfe & Datenschutz | Bereichsregeln, Codec, Geheimnis- und Exporthinweise |

Global sind erforderlich: nicht gespeicherte Änderungen, Speichern, valide Tastaturbedienung, sichtbarer Fokus, Bestätigung vor Löschaktionen und zugängliche Formularbeschriftungen.

---

## 8. Bereiche & Generierung

### 8.1 Bereichstabelle

Spalten:

| Name | Länge | Von | Bis | Anzahl | Etikettentext | Status | Aktionen |
| --- | --- | --- | --- | --- | --- | --- | --- |

Aktionen: Bearbeiten, Duplizieren, Löschen. „Bereich hinzufügen“ öffnet einen Editor. Nur valide Änderungen werden übernommen.

### 8.2 Generierungsbereich

Unterhalb der Tabelle:

- `FEISTEL Secret` als Passwortfeld
- `HMAC Secret` als Passwortfeld; bei reinen 6-stelligen Läufen optional
- Zusammenfassung der ausgewählten Bereiche und Gesamtanzahl
- Hinweis zur Laufzeitverarbeitung der Geheimnisse
- Schaltfläche `TAGs generieren`

Vor Generierung wird validiert: mindestens ein gültiger Bereich, gültige Basis-URL, Feistel Secret gesetzt, bei Länge 8 auch HMAC Secret gesetzt, und Gesamtlimit eingehalten.

Die Berechnung läuft in Batches mit Fortschrittsanzeige und Abbruchmöglichkeit, damit die Oberfläche reaktionsfähig bleibt. Ergebnisse werden atomar erst nach vollständigem Erfolg übernommen.

---

## 9. Generierte TAGs

Die Ansicht zeigt die zuletzt erzeugte oder importierte Liste.

| Bereich | Nr. | TAG-ID | Ziel-URL | Eingabewert | Dekodierter Wert | Etikettentext |
| --- | --- | --- | --- | --- | --- | --- |

Funktionen:

- Suche über Bereich, TAG-ID, URL und Text
- Filter nach Bereich und TAG-Länge
- BigInt-sichere Sortierung
- Pagination oder Virtualisierung
- Kopieren von TAG-ID und URL
- QR-Einzelvorschau
- JSON-Export der TAG-Liste
- Anzeige von Menge und Erzeugungszeitpunkt

Die QR-Nutzlast ist immer die vollständige URL. QR-Codes werden als SVG oder hochauflösendes PNG erzeugt, standardmäßig mit Fehlerkorrektur `M`, schwarzem Code auf weißem Hintergrund und mindestens vier Modulen Quiet Zone.

---

## 10. Etikettenvorlagen und Layout-Editor

### 10.1 Raster und A4-Validierung

Seite: DIN A4 Hochformat, `210 mm × 297 mm`.

```text
usedWidth =
  leftMargin + columns * labelWidth + (columns - 1) * horizontalGap

usedHeight =
  topMargin + rows * labelHeight + (rows - 1) * verticalGap
```

Es muss gelten:

```text
usedWidth <= 210
usedHeight <= 297
```

Rechter und unterer Rest-Rand werden berechnet und angezeigt. Negative Flächen verhindern das Speichern.

### 10.2 Standardvorlage

Nicht automatisch gespeicherter Startwert:

```text
Name: A4 – 3 × 8 (Beispiel)
Spalten: 3
Zeilen: 8
Etikett: 63,5 × 33,9 mm
Linker Rand: 7,0 mm
Oberer Rand: 12,0 mm
Horizontaler Abstand: 2,5 mm
Vertikaler Abstand: 0,0 mm
```

### 10.3 Editor

Der Editor besteht aus:

1. Eigenschaftenleiste für Vorlage und Raster.
2. Einzeletikett-Canvas mit Millimeter-Raster.
3. Elementinspektor mit exakten X/Y/Breite/Höhe-Feldern.
4. A4-Gesamtvorschau mit Rändern, Raster und Etikettenkonturen.

QR-Code und Textfeld sind direkt auf dem Einzeletikett per Drag & Drop bewegbar sowie per Resize-Handles skalierbar.

Regeln:

- QR-Code ist immer quadratisch.
- Textfeld darf rechteckig sein.
- Werte werden auf 0,1 mm gerundet.
- Einrasten auf 0,5 mm ist standardmäßig aktiv und abschaltbar.
- Elemente bleiben vollständig innerhalb des Etiketts.
- Zahlenfelder und Canvas werden direkt gegenseitig synchronisiert.
- Tastatur: Pfeiltasten verschieben, Umschalt+Pfeil für größere Schritte.
- QR-Code: Minimum 10 mm, Empfehlung 15 mm.
- QR- und Textbereich dürfen sich nicht überschneiden.
- Textüberlauf: verkleinern, Ellipse oder Abschneiden.
- Warnung bei Textkürzung oder kritischer Schriftgröße.

---

## 11. Druckvorschau und PDF

### 11.1 Eingaben

- gespeicherte Vorlage auswählen,
- TAG-Liste auswählen,
- optional nach Bereich filtern,
- Startzeile `1..rows`,
- Startspalte `1..columns`.

Vor der PDF-Erzeugung werden alle Vorlagen-, QR- und Textregeln erneut validiert.

### 11.2 Befüllreihenfolge

1. links nach rechts innerhalb einer Zeile,
2. oben nach unten über die Zeilen,
3. anschließend Seite für Seite.

Die Zellen vor der Startposition bleiben nur auf Seite 1 leer. Jede Folgeseite beginnt in Spalte 1 / Zeile 1.

Anzahl der verfügbaren Etiketten auf Seite 1:

```text
capacityFirstPage =
  columns * rows - ((startRow - 1) * columns + (startColumn - 1))
```

Alle weiteren Seiten besitzen:

```text
capacityNextPages = columns * rows
```

### 11.3 Vorschau und Export

- Alle nötigen A4-Seiten werden in der Browseransicht dargestellt.
- Jede Zelle enthält QR-Code und Bereichstext gemäß Vorlage.
- Nicht belegte Zellen bleiben sichtbar leer.
- Die PDF verwendet exakt dieselben mm-Koordinaten wie der Vorlageneditor.
- Neben dem Download steht die explizite Aktion **„PDF-Vorschau öffnen“** zur Verfügung.
- Diese Aktion erzeugt die PDF mit identischen Eingabedaten und derselben Erzeugungsfunktion wie der Download (Vorlage, TAG-Liste, Startposition, QR-Profile sowie Kopf-/Fußbereiche).
- Die erzeugte PDF wird als temporärer `Blob` und zugehörige Object-URL in einem neuen Browser-Tab oder Fenster geöffnet. Es erfolgen dabei keine Netzwerkzugriffe, Uploads oder Persistierungen.
- Die Object-URL bleibt bis zum vollständigen Öffnen durch den neuen Tab gültig und wird danach freigegeben. Die Anwendung verwaltet keinen dauerhaften PDF-Zwischenspeicher.
- Kann der Browser den neuen Tab bzw. das Fenster wegen eines Popup-Blockers nicht öffnen, zeigt die Anwendung eine verständliche Statusmeldung. Die reguläre Download-Aktion bleibt verfügbar.
- Die PDF-Vorschau löst keinen Download aus. Speichern oder Drucken innerhalb des Browser-PDF-Viewers bleibt eine bewusste Benutzeraktion.
- Downloadname:

  ```text
  myqr24-tags-YYYY-MM-DD-HHMM.pdf
  ```

- Eine eigene Druckdialogfunktion wird nicht implementiert; der Download und die vom Browser bereitgestellte PDF-Vorschau sind die Druckartefakte.

---

## 12. Speichern, Import und Export

### 12.1 Lokales Speichern

Nicht-sensitive Arbeitskonfigurationen können unter einem Namen in `localStorage` gespeichert werden. Gespeichert werden Basis-URL, Bereiche, Etikettenvorlagen und Druckeinstellungen, jedoch niemals Geheimnisse und standardmäßig keine großen TAG-Listen.

### 12.2 Konfigurationsexport und -import per Dateiauswahl

Dateiformat: UTF-8 JSON, MIME-Type `application/json`. Export und Import verwenden sichtbare Dateiauswahldialoge bzw. den normalen Browser-Download; `localStorage` bleibt nur eine zusätzliche lokale Komfortfunktion.

```text
myqr24-tag-generator-config-<name>-YYYY-MM-DD.json
```

Der Export enthält `TagGeneratorConfiguration`. Beim Import erfolgen:

- JSON-Parsing,
- Prüfung von `kind` und `schemaVersion`,
- strenge Feld- und Typvalidierung,
- `bigint`-Prüfung aller Dezimalstrings,
- Bereichs-, URL- und Layoutprüfung,
- Ignorieren und Warnen bei Geheimnisfeldern,
- Konfliktstrategie: bestehende Elemente ersetzen, zusammenführen oder als neue Kopie importieren.

### 12.3 Einzelne Etikettenvorlagen exportieren und importieren

Vorlagen haben ein separates, portables JSON-Format:

```ts
interface LabelTemplateExport {
  schemaVersion: 1;
  kind: "myqr24.tag-generator.label-template";
  exportedAt: string;
  template: LabelTemplate;
}
```

Der Vorlageneditor bietet getrennte Aktionen „Vorlage als Datei speichern“ und „Vorlage aus Datei laden“. Beim Import wird die Datei geparst, auf `kind` und `schemaVersion` geprüft und mit `validateTemplate()` validiert. Eine valide importierte Vorlage erhält zur konfliktfreien Übernahme eine neue lokale ID und wird als ausgewählte Vorlage ergänzt.

### 12.4 TAG-Listenexport und -import

Dateiname:

```text
myqr24-tag-list-YYYY-MM-DD-HHMM.json
```

Der Export folgt `TagListExport`. Beim Import validiert die App:

- Schema und Version,
- Bereichsinformationen,
- eindeutige TAG-IDs,
- TAG-ID-Format und passende Länge,
- URL entsprechend Basis-URL plus TAG-ID,
- präzise Dezimalfelder.

Optionaler Modus „lokal mit erneut eingegebenen Secrets verifizieren“ dekodiert die importierten IDs mit dem Referenzcodec und prüft, ob Werte und ID übereinstimmen. Ohne Geheimnisse ist der Import weiterhin möglich, jedoch als „nicht kryptografisch verifiziert“ gekennzeichnet.

---

## 13. Fehlerbehandlung und Erweiterungen

- Fehler werden feldbezogen, verständlich und ohne Geheimnisdetails angezeigt.
- Große Mengen sind begrenzt; der Nutzer erhält konkrete Hinweise zum Teilen von Bereichen.
- Ein Hilfe-View dokumentiert 6-/8-stellige Regeln, 16er-Ausrichtung, lokale Geheimnisverarbeitung sowie Import-/Exportformate.
- Sinnvolle Zusatzfunktion: „Konfigurations-Diagnose“, die ungültige Bereiche, überlaufende Layouts, zu kleine QR-Codes und Textüberläufe vor Generierung/Druck zusammenfasst.
- Sinnvolle Zusatzfunktion: Duplizieren von Bereichen und Vorlagen, um Varianten schnell anzulegen.

---

## 14. Akzeptanzkriterien und Tests

### 14.1 Codec und Generierung

1. Ein kanonischer 6-stelliger Wert erzeugt exakt dieselbe TAG-ID wie `encodeTagId()` des Edge Routers.
2. Ein 16-ausgerichteter 8-stelliger Basiswert erzeugt exakt dieselbe TAG-ID und denselben dekodierten Wert wie der Edge Router.
3. Nicht-kanonische Werte werden abgewiesen.
4. Nicht ausgerichtete 8-stellige Grenzen und Werte werden abgewiesen.
5. Ein fehlendes Feistel Secret verhindert jede Generierung.
6. Ein fehlendes HMAC Secret verhindert nur Läufe mit 8-stelligen Bereichen.
7. Überlappende Bereiche gleicher Länge können nicht gespeichert werden.
8. Alle Berechnungen bleiben auch oberhalb von `Number.MAX_SAFE_INTEGER` exakt.

### 14.2 Dateien, QR-Profile und Bereichsversionen

1. Konfigurations-Export und -Import werden jeweils über eine benutzergewählte JSON-Datei ausgeführt.
2. Eine einzelne Vorlage lässt sich unabhängig von der Konfiguration exportieren, aus einer Datei importieren und wird vor Übernahme streng validiert.
3. Bei `qrIdCase: "upper"` enthält jede erzeugte URL ausschließlich Großbuchstaben für alphabetische URL-/TAG-Bestandteile.
4. Die TAG-Generierung, QR-Einzelvorschau, Druckvorschau und PDF-Ausgabe verwenden das an der jeweiligen Range gespeicherte QR-Profil.
5. Eine Range kann aus der Tabelle in den Editor übernommen werden; Speichern erzeugt eine neue Range mit fortlaufender Versionsbezeichnung, ohne den Ausgangsbereich zu verändern.
6. Fehlende QR-Profile in älteren Konfigurationsdateien werden deterministisch auf das gültige Standardprofil migriert.

### 14.3 Daten und Sicherheit

1. Geheimnisse erscheinen weder in localStorage noch in JSON-Exporten.
2. Konfigurationen mit geheimnisähnlichen Feldern werden importiert, aber diese Felder werden ignoriert und gemeldet.
3. Konfigurations- und TAG-Listenimporte erkennen falsche Schemaversionen und ungültige Dezimalwerte.
4. Große Zahlen überleben Export und Reimport unverändert.

### 14.4 Layout und PDF

1. Ein ungültiges A4-Raster kann nicht gespeichert oder exportiert werden.
2. QR-Code und Textfeld lassen sich mit Maus und Tastatur verschieben.
3. Positionsfelder und Canvas bleiben synchron.
4. Der QR-Code bleibt bei jeder Größenänderung quadratisch.
5. Die Befüllung erfolgt links-rechts und oben-unten.
6. Startzeile/-spalte lässt vorherige Zellen der ersten Seite frei.
7. Folgeseiten beginnen wieder an der ersten Zelle.
8. PDF-Seiten entsprechen dem A4-Raster und enthalten dieselben Daten wie die Vorschau.
9. „PDF-Vorschau öffnen“ öffnet die aus dem aktuellen Druckauftrag erzeugte PDF in einem neuen Tab oder Fenster, ohne einen Download auszulösen.
10. Die Vorschau-PDF und die heruntergeladene PDF verwenden dieselben Eingabedaten und sind bezüglich Seitenanzahl, A4-Format, Positionen und gerenderten TAGs inhaltsgleich.
11. Wird das Öffnen durch einen Popup-Blocker verhindert, erscheint eine verständliche Meldung; der PDF-Download bleibt nutzbar.

### 14.5 Qualitätsprüfung vor Abschluss der Implementierung

```sh
npm test
npx tsc --noEmit
npm run build --prefix tools/tag-gen
git diff --check
```

Zusätzlich erfolgt eine manuelle Browserprüfung: Bereich anlegen, 6- und 8-stellige TAGs erzeugen, Liste exportieren/importieren, Vorlage bearbeiten, Startposition setzen und mehrseitige PDF herunterladen.

---

## 15. Implementierungsstand, Testartefakte und Evidenz

### 15.1 Realisierter MVP-Umfang

Die konkrete Implementierung liegt bewusst kompakt in `src/domain.ts`, `src/tag-generation.ts`, `src/main.ts` und `src/styles.css`.

| Bereich | Umgesetzt |
| --- | --- |
| Lokale Anwendung | Vite-/TypeScript-Single-Page-Anwendung ohne Netzwerkzugriffe |
| Datenhaltung | Eingabe im Browser, `localStorage` für nicht-sensitive Arbeitsdaten, JSON-Import/-Export |
| Geheimnisse | Passwortfelder, ausschließlich Speicherzustand, Ausschluss aus allen Exporten |
| Bereichsregeln | BigInt-Parsing, kanonische 6-/8-stellige Werte, 16er-Ausrichtung, Überlappungsschutz, Laufgrenze |
| Codec | Direkter Import von `apps/edge-router/src/codec/index.ts`; keine Codec-Kopie |
| TAG-Ausgabe | Generierung, Fortschritt, QR-SVG-Vorschau, sichere TAG-Listen-Importe/-Exporte |
| Vorlage und Druck | A4-Raster- und Kollisionsvalidierung, Startposition, mehrseitige Browser-Druckansicht; PDF wird über „Als PDF speichern“ im Browser erzeugt |
| Tests | Vitest-Domänen- und Codec-Integrationstests |

Noch nicht Teil dieses MVP sind Suche/Filter/Virtualisierung, Drag-/Resize-Handles, Vorlagen-Duplikation, ein programmgesteuerter PDF-Download über `jspdf`, Generierungsabbruch und kryptografische Revalidierung bereits importierter TAG-Listen.

### 15.2 Testablage

| Artefakt | Zweck |
| --- | --- |
| `test/domain.test.ts` | URL-, Bereichs-, Layout-, Paginierungs- und Konfigurationsregeln |
| `test/tag-generation.test.ts` | Referenzcodec, Fortschritt sowie TAG-Listen-Export/-Import |
| `test/test-data/sample-configuration.json` | Kleine valide Importkonfiguration ohne Geheimnisse |
| `test/TEST-CASES.md` | Nachvollziehbare automatisierte und manuelle Testfälle |
| `test/EVIDENCE.md` | Ergebnisse der Test- und Buildläufe |

Die 8-stelligen Testwerte beginnen korrekt bei `36^7 = 78.364.164.096`; sie sind als Basiswerte durch 16 teilbar.

### 15.3 Ausführungsbefehle

```cmd
cd tools\tag-gen
npm test
npm run build
npm run dev
```

## 16. Ergänzung: Offsetbereiche, TAG-ID-Feld und Zahlen-Stepper

### 16.1 Bereichseingabe als absoluter Wert oder Offset

Ein Bereich besitzt zusätzlich die Eingabeart `absolute` oder `offset`. Die Speicherung bleibt kanonisch und kompatibel: `start` und `end` sind stets die absoluten Dezimalwerte, die der Edge-Router-Codec benötigt.

Für die gewählte TAG-Länge `L` gilt:

```text
untergrenze = 36^(L - 1)
obergrenze  = 36^L - 1
zahlenraum  = 36^L - 36^(L - 1)
```

| TAG-Länge | Untergrenze | Obergrenze | verfügbare Werte / Slots |
| --- | --- | --- | --- |
| 6 | `36^5` | `36^6 - 1` | `36^6 - 36^5` Werte |
| 8 | `36^7` | `36^8 - 1` | `(36^8 - 36^7) / 16` 16-ausgerichtete Basiswert-Slots |

Bei der Eingabeart `offset` gilt:

```text
// 6-stellig
absoluterWert = untergrenze + offset

// 8-stellig
absoluterBasiswert = untergrenze + offset * 16
```

Die UI zeigt nach Längenauswahl Untergrenze, Obergrenze und Zahlenraum an. Während der Offseteingabe zeigt sie zusätzlich die daraus resultierenden absoluten Werte. Offsetgrenzen dürfen den jeweiligen Zahlenraum nicht überschreiten.

### 16.2 Lesbares TAG-ID-Druckfeld

Das Vorlagenmodell enthält zusätzlich zu `elements.text` ein separates, verpflichtendes `elements.tagIdText`. Es besitzt dieselben Positions-, Größen- und Textoptionen wie das freie Textfeld. Es wird in Druckvorschau und Browser-PDF immer mit `GeneratedTag.tagId` gefüllt. Die Validierung prüft für QR-Code, freien Text und TAG-ID-Feld Grenzen sowie paarweise Überschneidungen.

### 16.3 Stepper für Zahlenfelder

Alle Zahlenfelder des Vorlageneditors werden durch zugängliche Minus-/Plus-Schaltflächen ergänzt:

- Millimeterwerte: Schrittweite `0,1 mm`.
- Ganzzahlige Rasterwerte (Zeilen, Spalten): Schrittweite `1`.
- Die Minus-Schaltfläche kann Werte nicht unter ihre fachliche Untergrenze senken.
- Jede Änderung löst dieselbe Layoutvalidierung und Vorschauberechnung aus wie eine direkte Feldeingabe.

### 16.4 Vollständige aktuelle Projektstruktur

```text
tools/tag-gen/
├── Refine.md
├── SPECIFICATION.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── public/
│   └── icon.svg
├── src/
│   ├── domain.ts
│   ├── tag-generation.ts
│   ├── pdf-generation.ts
│   ├── label-designer.ts
│   ├── main.ts
│   └── styles.css
└── test/
    ├── domain.test.ts
    ├── tag-generation.test.ts
    ├── TEST-CASES.md
    ├── EVIDENCE.md
    └── test-data/
        └── sample-configuration.json
```

## 17. Ergänzung: Lokalisierung, Seitenkopf/-fuß, QR-ID-Modus und lokale Secret-Vorbelegung

### 17.1 Eingabeformat

`TagGeneratorConfiguration` enthält zusätzlich `inputLocale: "de-DE" | "en-US"`.

- Die Einstellung wird auf „Bereiche & Generierung“ gewählt, lokal gespeichert und exportiert.
- Sie beeinflusst ausschließlich die Darstellung und Eingabe von Dezimalmaßen (Layout- und Seitenmaße).
- DE akzeptiert Komma als Dezimaltrennzeichen; EN akzeptiert Punkt.
- TAG-Werte und Offsets bleiben unabhängig davon reine BigInt-Ganzzahlen ohne Nachkommastellen.
- Alle Maßwerte werden intern als JavaScript-`number` in Millimetern und mit Punktnotation gespeichert.

Browsernative Zahlenfelder (`input type="number"`) ersetzen zusätzliche Minus-/Plus-Buttons. Browserpfeile und direkte Eingabe verwenden die Schrittweite des Felds.

### 17.2 Seitenkopf und Seitenfuß

`LabelTemplate` enthält zusätzlich:

```ts
interface PageTextArea {
  text: string;
  leftMm: number;
  widthMm: number;
  heightMm: number;
}

interface PageLayout {
  header: PageTextArea & { topOffsetMm: number };
  footer: PageTextArea & { bottomOffsetMm: number };
}
```

- Kopf und Fuß werden einmal auf jeder A4-Seite ausgegeben, nicht einmal je Etikett.
- Die Kopfposition ist `topOffsetMm`.
- Die Fußposition ist `297 - bottomOffsetMm - heightMm`.
- Text, linker Abstand, Breite, Höhe und jeweiliger Abstand zur relevanten Seitenkante sind editierbar.
- Bereiche müssen auf DIN A4 liegen und dürfen den durch das Etikettenraster belegten Seitenbereich nicht schneiden.
- Beim Import früherer Vorlagen werden leere, gültige Standardbereiche ergänzt.

### 17.3 QR-ID-Zeichenmodus

Die Konfiguration enthält `qrIdCase: "upper" | "lower"`; die TAG-Listenquelle speichert denselben Modus.

- `tagId` selbst bleibt die kanonische, vom Edge-Codec zurückgelieferte öffentliche ID.
- Für die QR-Nutzlast wird bei `upper` ausschließlich `tagId.toUpperCase()` verwendet.
- Für `lower` wird `tagId.toLowerCase()` verwendet.
- Die Ziel-URL, QR-Vorschau, TAG-Export und Druck verwenden durchgängig diese erzeugte Nutzlast-URL.
- Der Modus „upper“ entspricht Base36-/Base45-Darstellung; „lower“ ist für binäre Codec-Verarbeitung vorgesehen.

### 17.4 Lokale Secret-Vorbelegung

Beim lokalen Vite-Start lädt `vite.config.ts` die Werte aus dem übergeordneten `tools/.env.local`:

```text
FEISTEL_SECRET_S01
TAG_HMAC_SECRET_S01
```

Sie werden nur als anfänglicher Browser-Speicherzustand verwendet. Die UI bleibt ein Passwortfeld und bietet eine zugängliche Augen-Schaltfläche für temporäres Ein-/Ausblenden.

**Sicherheitsgrenze:** Werte, die Vite mit `define` in ein Browserbundle einbettet, sind kein Schutz gegen Personen mit Zugriff auf dieses Bundle. Daher ist diese Vorbelegung ausschließlich für die vertrauenswürdige lokale Entwicklungs-/Arbeitsumgebung zulässig. Die Werte werden weiterhin nie in `localStorage`, Exporten, URLs oder Anwendungslogs abgelegt.

### 17.5 Auswahl der QR-Einzelvorschau

Die TAG-Ergebnisliste markiert einen gewählten Eintrag. Ein Klick auf eine Tabellenzeile setzt diesen Eintrag als QR-Einzelvorschau; ID, URL und Bereichstext werden unmittelbar aktualisiert.

## 18. Ergänzung: Datei-Workflows, QR-Profile und Bereichsversionen

- Die Anwendung bietet für Konfigurationen sichtbare Aktionen zum Herunterladen und zum Auswählen einer JSON-Datei.
- Vorlagen werden unabhängig über `LabelTemplateExport` transferiert und niemals versehentlich mit Secrets verbunden.
- QR-Parameter werden einer Range zugerechnet, damit ein Druckauftrag mit mehreren Ranges für jede Nutzlast die korrekten Kodierungsparameter beibehält.
- Die „Bereich fortführen“-Bedienung ist append-only: Historische Ranges und deren QR-Profile bleiben nachvollziehbar erhalten.

## 19. Ergänzung: Direkte PDF-Vorschau

Die Druckansicht erzeugt bei der Aktion „PDF-Vorschau öffnen“ das PDF ausschließlich im Browser mit der bestehenden clientseitigen PDF-Erzeugung. Die resultierenden Bytes werden in einen `Blob` mit dem MIME-Type `application/pdf` überführt und über eine Object-URL in einem neuen Tab oder Fenster geöffnet.

- Die neue Ansicht wird unmittelbar im Klick-Handler geöffnet, damit gängige Browser sie nicht als unerwünschtes Popup behandeln.
- Während die PDF asynchron erzeugt wird, zeigt das geöffnete Fenster einen neutralen Ladehinweis.
- Nach erfolgreicher Erzeugung navigiert die Anwendung das Vorschaufenster zur Object-URL der PDF.
- Falls das Fenster nicht erzeugt werden kann, wird die PDF-Erzeugung nicht fortgesetzt und die Anwendung erläutert den blockierten Vorgang in der Statusmeldung.
- Für die Vorschau werden keine zusätzlichen Datenmodelle, Exportformate oder Geheimnisfelder eingeführt.
- Der Download erzeugt weiterhin eine Datei mit dem festgelegten Downloadnamen und bleibt technisch sowie in der Bedienung eine getrennte Aktion.

## 20. Implementierungsreihenfolge

1. Vite-/TypeScript-Grundprojekt unter `tools/tag-gen/` erstellen.
2. Referenzcodec anbinden und mit Kompatibilitätstests absichern.
3. Domainmodelle, BigInt-Parser, URL- und Bereichsvalidierung implementieren.
4. View „Bereiche & Generierung“ mit sicherer Laufzeit-Secretbehandlung umsetzen.
5. TAG-Liste, QR-Vorschau und JSON-Export implementieren.
6. Lokale Konfiguration sowie Import-/Export mit Schemavalidierung ergänzen.
7. Vorlagenmodell, A4-Rastervalidierung und Drag-/Resize-Etiketteneditor umsetzen.
8. Mehrseitige Druckvorschau und PDF-Export implementieren.
9. Automatisierte Tests, Fehlerfälle und manuelle Abnahme ausführen.

Diese Spezifikation ist die Grundlage für die nachfolgende Implementierung; Änderungen an Codec, Geheimnisbehandlung oder Exportformaten müssen vor Umsetzung hier nachvollziehbar aktualisiert werden.

## 21. Ergänzung: Erweiterte Etikettengestaltung

### 21.1 Vorlagenmodell und Kompatibilität

Jede Etikettenvorlage enthält zusätzlich folgende Designwerte:

```ts
type HexColor = `#${string}`;

interface TextAppearance {
  visible: boolean;
  fontFamily: "helvetica" | "times-roman" | "courier";
  fontSizePt: number;
  fontStyle: "normal" | "bold" | "italic" | "bold-italic";
  horizontalAlign: "left" | "center" | "right";
  verticalAlign: "top" | "middle" | "bottom";
  background: { enabled: boolean; color: HexColor; opacity: number };
}

interface BackgroundImage extends PositionedElement {
  visible: boolean;
  dataUrl: string;
  opacity: number; // 0 = vollständig blass, 1 = deckend
}
```

- `elements.text` und `elements.tagIdText` erweitern ihre bisherigen Textoptionen um `visible` und `background`.
- `elements.qr` erweitert seine bisherigen Optionen um `borderWidthMm` und `borderColor`.
- `LabelTemplate` erweitert sich um `backgroundColor: HexColor` und `backgroundImage?: BackgroundImage`.
- Hintergrundbilddaten sind ausschließlich eingebettete lokale `data:`-URLs für PNG oder JPEG. Externe Bild-URLs sind unzulässig.
- Fehlende Werte früherer Vorlagen werden beim Laden deterministisch migriert: sichtbare Texte, deaktivierte Text-Hintergründe, weißer Etikettenhintergrund, kein Hintergrundbild sowie kein QR-Rand.

### 21.2 Editor und Bedienung

Der Elementinspektor bietet für beide Textfelder jeweils:

- Checkbox für Sichtbarkeit,
- horizontale und vertikale Ausrichtung,
- Checkbox für den Texthintergrund,
- nativen Farbwähler plus editierbares Hex-Feld,
- Transparenz als Prozentwert von `0` bis `100`.

Der Vorlagenbereich bietet zusätzlich:

- Farbwähler und Hex-Feld für die Etiketten-Hintergrundfarbe,
- lokale PNG-/JPEG-Dateiauswahl für ein Hintergrundbild,
- Checkbox für dessen Sichtbarkeit, Positions- und Größenfelder sowie Blässe in Prozent,
- Eingaben für Randbreite und Randfarbe des QR-Codes,
- Zoomauswahl von `75 %` bis `400 %` für den Einzeletikett-Canvas. Der Zoom beeinflusst ausschließlich die Editordarstellung, niemals gespeicherte Millimeterwerte oder PDF-Ausgabe.
- Die Einzeletikett-Designvorschau wird oberhalb der Konfigurationsbereiche angezeigt. Bei hohen Zoomstufen bleibt sie innerhalb eines eigenen Scrollbereichs vollständig bedienbar.
- Die Konfigurationsbereiche für QR-Code, Hintergrundbild, freien Text und lesbare TAG-ID verwenden ein responsives Grid: Bei ausreichend breiter Ansicht stehen sie nebeneinander, bei reduzierter Breite ordnen sie sich untereinander an.

### 21.3 Renderreihenfolge und PDF-Gleichheit

Je Etikett wird in folgender Reihenfolge gerendert:

1. Etiketten-Hintergrundfarbe,
2. sichtbares Hintergrundbild mit konfigurierter Deckkraft,
3. sichtbare Textfeld-Hintergründe mit eigener Deckkraft,
4. QR-Code mit optionalem Rand,
5. sichtbarer freier Text und sichtbare TAG-ID.

Browser-Druckvorschau, PDF-Vorschau und PDF-Download müssen dieselben gespeicherten Optionen verwenden. PNG- und JPEG-Hintergrundbilder werden clientseitig in das PDF eingebettet. Nicht unterstützte Bildtypen werden vor Übernahme abgewiesen.

### 21.4 Akzeptanzkriterien

1. Ausgeblendete Textfelder und Hintergrundbilder erscheinen weder im Editor-Preview noch in der Druck- oder PDF-Ausgabe.
2. Für alle konfigurierbaren Farben sind ein klickbares Farbfeld und ein editierbares Hex-Feld vorhanden; gültige Änderungen bleiben synchron.
3. Hintergrundfarbe, Bildblässe und Textfeldtransparenz werden in Browser- und PDF-Vorschau sichtbar gleich umgesetzt.
4. Das Hintergrundbild bleibt innerhalb seiner konfigurierten Millimeter-Box und liegt hinter QR-Code und Text.
5. QR-Randbreite und -farbe werden in Browser- und PDF-Ausgabe gleich angewendet.
6. Änderungen am Editorzoom verändern weder die gespeicherten Koordinaten noch die erzeugte PDF.
7. Vorhandene Vorlagen ohne Designwerte lassen sich weiterhin laden, bearbeiten, exportieren und als PDF erzeugen.

## 22. Ergänzung: Modulgrenze Etiketten-Designer

Die Vorlagenansicht ist als flaches Modul in `src/label-designer.ts` abgegrenzt.

| Modul | Verantwortung |
| --- | --- |
| `src/main.ts` | Application Host: globaler Konfigurations- und TAG-Zustand, Navigation, Shell, Persistenz-/Datei-Adapter, TAG-Generierung und Druckauftrag |
| `src/label-designer.ts` | A4-Raster, Vorlageneigenschaften, Einzeletikett-Editor, Zoom, Drag-Interaktion, Designfelder sowie Vorlagenimport/-export |
| `src/domain.ts` | Vorlagenmodell, Migration, Validierung und portable Import-/Exportformate ohne UI-Abhängigkeit |
| `src/pdf-generation.ts` | Maßhaltige PDF-Ausgabe auf Grundlage einer validierten Vorlage und TAG-Liste |

Der Host übergibt dem Etiketten-Designer einen expliziten `LabelDesignerContext`. Dieser enthält nur die für die Ansicht notwendigen Datenzugriffe sowie Shell-, Download- und Datei-Adapter. Das Feature führt keine globale Navigation und speichert keine Geheimnisse.

`editorTextStyle()` ist eine exportierte, reine Darstellungsfunktion des Features. Die Browser-Druckvorschau verwendet diese Funktion ebenfalls, damit Textschrift, Stil, Ausrichtung und Transparenz im Editor und in der Vorschau konsistent interpretiert werden.
