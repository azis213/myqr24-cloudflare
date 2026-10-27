# Label-Designer – Fachliche und technische Spezifikation

**Status:** Entwurf  
**Zielsystem:** Browserbasierte lokale Web-Anwendung  
**Primäres Exportformat:** PNG  
**Arbeitsname:** `myQR24 Label-Designer`

---

## 1. Zielsetzung

Der Label-Designer ist ein browserbasiertes Gestaltungswerkzeug zum Erstellen hochwertiger, druck- und webtauglicher Label-Grafiken. Nutzerinnen und Nutzer sollen ohne externe Designsoftware individuelle Label-Layouts erstellen, speichern, wieder öffnen und als PNG-Dateien exportieren können.

Das Werkzeug richtet sich insbesondere an die Erstellung von:

- Lost-&-Found-Labels,
- QR-Code-Labels,
- Produktaufklebern,
- Inventar- und Gerätekennzeichnungen,
- Versand- und Serviceetiketten,
- Event- und Kampagnenlabels,
- Vorlagen für den bestehenden TAG-Generator.

Der Designer muss vollständig im Browser funktionieren. Bildverarbeitung, Entwurf und PNG-Export erfolgen lokal im Browser. Ein Server ist für die Kernfunktion nicht erforderlich.

---

## 2. Geltungsbereich

### 2.1 In Scope

Das Produkt ermöglicht:

1. die freie Definition von Label-Breite, Label-Höhe und Exportauflösung;
2. die Gestaltung eines Hintergrunds mit Farben, Verläufen, Mustern und Texturen;
3. die Gestaltung eines Randes mit frei definierbarer Dicke, Farbe, Verlauf und Textur;
4. die Definition einer Eckenrundung;
5. das Platzieren, Verschieben, Skalieren, Drehen und Ebenen von Gestaltungselementen;
6. das Erstellen und formatieren von Text mit Design-App-/Word-Art-ähnlichen Stilen;
7. das Zeichnen von Linien, Rahmen, Rechtecken, Kreisen und weiteren Grundformen;
8. den Import eigener Bilddateien;
9. das Speichern und Laden von Entwürfen als JSON;
10. den Export des Entwurfs als PNG mit wählbarer Auflösung;
11. die Nutzung vorgefertigter Stile, Texturen und Design-Vorlagen.

### 2.2 Nicht im initialen Scope

Folgende Funktionen sind für spätere Ausbaustufen vorgesehen:

- kollaborative Bearbeitung in Echtzeit;
- Cloud-Speicherung und Benutzerkonten;
- Vektor-Export als SVG/PDF;
- automatisches KI-Bildgenerieren;
- professionelle CMYK-/ICC-Farbverwaltung;
- variable Datenserien bzw. Mail-Merge-Export;
- direkte Druckeranbindung.

Diese Themen sollen bei Architekturentscheidungen berücksichtigt werden, aber Version 1 nicht unnötig komplex machen.

---

## 3. Zentrale Bedienprinzipien

### 3.1 Designfläche

Die Designfläche repräsentiert exakt das spätere Label-Seitenverhältnis. Sie wird in zwei Einheiten dargestellt:

- **physikalische Größe:** Millimeter, etwa `63,5 × 33,9 mm`;
- **Exportgröße:** Pixel, etwa `1828 × 848 px`.

Der Nutzer kann entweder die Größe in Millimetern oder die Pixelgröße definieren. Das System berechnet die jeweils andere Darstellung anhand einer wählbaren Exportauflösung (DPI).

**Empfohlene DPI-Voreinstellungen:**

| Profil | DPI | Geeignet für |
|---|---:|---|
| Bildschirm | 96 | Web-Vorschauen |
| Standarddruck | 150 | einfache Etikettendrucke |
| Druckqualität | 300 | hochwertige PNG-Druckvorlage |
| Hochauflösend | 600 | kleine, detailreiche Etiketten |

### 3.2 Direkte Manipulation

Alle sichtbaren Objekte auf der Designfläche müssen direkt bearbeitbar sein:

- Anklicken zum Auswählen;
- Ziehen zum Verschieben;
- Anfasspunkte zum Skalieren;
- Drehgriff zum Drehen;
- Mehrfachauswahl mit `Shift`;
- Ausrichten über Hilfslinien und Snap-to-Grid;
- exakte Korrektur über Eigenschaftsfelder.

### 3.3 Nicht-destruktive Gestaltung

Änderungen an Farben, Texturen, Schatten, Verläufen, Bildern und Texteffekten dürfen möglichst nicht die Originaldaten verändern. Eigenschaften werden als Konfiguration gespeichert und beim Rendern zusammengesetzt.

---

## 4. Bedienoberfläche

Die Anwendung besteht aus fünf wesentlichen Bereichen.

### 4.1 Kopfzeile

Die Kopfzeile enthält:

- Projektname;
- Neu;
- Öffnen;
- Speichern;
- Rückgängig;
- Wiederholen;
- Zoom-Steuerung;
- Vorschau ein/aus;
- Export als PNG.

### 4.2 Linke Werkzeugleiste

Werkzeuge:

- Auswahlwerkzeug;
- Hand-/Verschieben-Werkzeug;
- Text;
- Linie;
- Rechteck;
- abgerundetes Rechteck;
- Kreis/Ellipse;
- Bild importieren;
- QR-Code-Platzhalter (optional für spätere Integration);
- Hilfslinien;
- Pipette (spätere Ausbaustufe).

### 4.3 Designfläche

Die Designfläche zeigt:

- das Label;
- Rand und Eckenrundung;
- sichtbare Objekte;
- optional ein Raster;
- Sicherheitsbereich;
- Beschnitt-/Schnittbereich;
- Ausrichtungs- und Fanghilfen;
- Auswahlrahmen und Manipulationsgriffe.

### 4.4 Rechte Eigenschaftenleiste

Die rechte Leiste zeigt kontextabhängig:

- Label-Eigenschaften, wenn kein Objekt ausgewählt ist;
- Objekteigenschaften, wenn ein Objekt ausgewählt ist;
- Ebenenliste;
- Stilbibliothek;
- Textur- und Farbverlaufsauswahl.

### 4.5 Untere Statusleiste

Die Statusleiste zeigt:

- aktuelle Labelgröße in mm und px;
- Zoomstufe;
- Mausposition;
- Auswahlposition und -größe;
- aktives Raster;
- Export-DPI.

---

## 5. Label-Grundlayout

### 5.1 Abmessungen

Ein Label besitzt folgende Basiswerte:

| Eigenschaft | Typ | Beschreibung |
|---|---|---|
| `widthMm` | Zahl | Breite in Millimetern |
| `heightMm` | Zahl | Höhe in Millimetern |
| `widthPx` | Zahl | Breite in Exportpixeln |
| `heightPx` | Zahl | Höhe in Exportpixeln |
| `dpi` | Zahl | Umrechnungsbasis zwischen mm und px |
| `cornerRadiusMm` | Zahl | Eckenradius in Millimetern |
| `safeAreaMm` | Zahl | empfohlener Sicherheitsabstand |
| `bleedMm` | Zahl | optionaler Anschnittbereich |

### 5.2 Eckenrundung

Der Eckenradius ist frei wählbar:

```text
Minimum: 0 mm
Maximum: min(Labelbreite, Labelhöhe) / 2
```

Bei einem Label von `63,5 × 33,9 mm` beträgt der maximal zulässige Radius daher `16,95 mm`.

Der Designer muss einen ungültigen Wert automatisch begrenzen und dem Nutzer sichtbar anzeigen.

### 5.3 Hintergrund und Rand

Das Label wird in folgender Reihenfolge gerendert:

1. transparente oder farbige Arbeitsfläche;
2. Label-Hintergrund;
3. Hintergrundtextur bzw. Hintergrundmuster;
4. Rand;
5. Linien und Formen;
6. importierte Bilder;
7. Textobjekte;
8. optional temporäre Editorhilfen (nicht exportiert).

---

## 6. Hintergrundgestaltung

### 6.1 Hintergrundfüllung

Für den Hintergrund muss mindestens eine der folgenden Füllungsarten ausgewählt werden können:

- Volltonfarbe;
- linearer Verlauf;
- radialer Verlauf;
- konischer Verlauf;
- Bildtextur;
- Muster;
- Kombination aus Farbe/Verlauf und Textur-Overlay.

### 6.2 Freie Farben

Farben müssen über mehrere Eingabeformen definierbar sein:

- Farbwähler;
- Hexadezimalwert, z. B. `#0C2942`;
- RGB, z. B. `rgb(12, 41, 66)`;
- HSL, z. B. `hsl(204, 69%, 15%)`;
- Alpha-/Deckkraftwert von `0 %` bis `100 %`;
- zuletzt verwendete Farben;
- gespeicherte Markenfarben bzw. Farbpaletten.

### 6.3 Farbverläufe

Der Editor benötigt einen vollwertigen Farbverlaufseditor ähnlich bekannter Design-Anwendungen.

Ein Verlauf umfasst:

| Eigenschaft | Beschreibung |
|---|---|
| Typ | linear, radial, konisch |
| Winkel | 0° bis 360° bei linearen Verläufen |
| Mittelpunkt | X/Y für radiale und konische Verläufe |
| Farbstopps | mindestens zwei, beliebig erweiterbar |
| Stop-Position | 0 % bis 100 % |
| Stop-Farbe | Farbe inkl. Alpha |
| Deckkraft | je Farbstopp möglich |

Beispiele:

- Dunkelblau → Türkis für ein Techniklabel;
- Gelb → Orange → Rot für Warnlabel;
- Schwarz → Anthrazit → Silber für Metalloptik;
- Beige → Braun für Vintage-/Papieroptik.

### 6.4 Hintergrundtexturen

Texturen werden als nicht-destruktive Overlays über einer Grundfarbe oder einem Verlauf verwendet. Jede Textur besitzt mindestens:

- Sichtbarkeit;
- Deckkraft;
- Blend-Modus;
- Skalierung;
- Rotation;
- X-/Y-Versatz;
- optional Farbtönung.

**Vorgesehene Texturkategorien:**

| Kategorie | Beispiele |
|---|---|
| Metall | gebürstetes Metall, Stahl, Aluminium, Chrom, Kupfer, Riffelblech |
| Elektronik | Leiterbahnen, Platine, Hex-Grid, digitale Raster, Neon-Schaltkreise |
| Holz | Eiche, Nussbaum, Mahagoni, helles Holz, dunkles Holz, Holzmaserung |
| Stein | Granit, Schiefer, Beton, Marmor, Terrazzo |
| Papier | Vintage-Papier, Kraftpapier, Recyclingpapier, Pergament, Karton |
| Leder | braunes Leder, schwarzes Leder, genarbtes Leder, Kunstleder |
| Stoff | Leinen, Filz, Jeans, Canvas, Webstruktur |
| Natur | Wasser, Sand, Gras, Blattstruktur, Wolken |
| Retro | Halftone-Punkte, Pixel, 80er-Grid, geometrische Muster |
| Industriell | Rost, Beton, Warnstreifen, Carbon, Gummi |
| Abstrakt | Rauschen, Glitzer, Farbwolken, Lichtstrahlen, Mesh-Gradient |

**Technische Umsetzungsempfehlung:**

- Texturen liegen als lokal eingebettete PNG-/WebP-Dateien oder prozedurale Canvas-Muster vor.
- Der Nutzer kann zusätzlich eigene PNG/JPEG/WebP-Dateien als Textur importieren.
- Große Bilder werden vor dem Speichern der Konfiguration auf eine definierte Maximalgröße reduziert, um Browser-Speicher und JSON-Export kontrollierbar zu halten.

### 6.5 Blend-Modi

Folgende Blend-Modi sollten unterstützt werden, sofern Canvas-Rendering dies erlaubt:

- Normal;
- Multiplizieren;
- Negativ multiplizieren / Screen;
- Überlagern;
- Weiches Licht;
- Hartes Licht;
- Farbe;
- Sättigung;
- Luminosität.

In einer ersten Version können `Normal`, `Multiplizieren`, `Screen` und `Überlagern` priorisiert werden.

---

## 7. Randgestaltung

### 7.1 Basisparameter

Der Rand ist ein eigenständiges Stilelement mit:

| Eigenschaft | Beschreibung |
|---|---|
| Sichtbar | Rand an/aus |
| Dicke | in mm oder px |
| Ausrichtung | innen, mittig, außen |
| Eckenradius | automatisch vom Label übernehmen oder eigener Wert |
| Füllung | Vollton, Verlauf oder Textur |
| Deckkraft | 0 % bis 100 % |
| Schatten | optional |
| Kontur | optional zusätzliche Innen-/Außenlinie |

### 7.2 Randstile

Neben einer einfachen Kontur sollen folgende Stilpresets vorgesehen werden:

- flache Farbkontur;
- Doppellinie;
- gestrichelt;
- gepunktet;
- Neon;
- Metall;
- gebürsteter Stahl;
- Chrom;
- Kupfer;
- Gold;
- Stein;
- Marmor;
- Holz;
- Ledernaht;
- Carbon;
- Warnstreifen;
- Pixelrahmen;
- Comic-Rahmen;
- Tech-/Leiterbahn-Rahmen;
- Vintage-Rahmen;
- Baustein-/Blockrahmen.

Ein Preset setzt mehrere Eigenschaften auf einmal, bleibt anschließend aber vollständig editierbar.

### 7.3 Metall- und Steinränder

Für hochwertige Randstile genügt nicht nur eine Bildtextur. Der Renderer sollte mehrere Ebenen kombinieren:

**Metall:**

1. metallischer linearer Verlauf;
2. feine gebürstete Textur;
3. helle Kante oben/links;
4. dunkle Kante unten/rechts;
5. optional Glanzstreifen.

**Stein:**

1. Grundfarbe;
2. Marmor-/Steintextur;
3. leichtes Noise;
4. dezente Innenschattierung;
5. optional rauer, unregelmäßiger Rand.

---

## 8. Linien, Rahmen und Formen

### 8.1 Unterstützte Objekttypen

Der Designer unterstützt mindestens:

- Linie;
- Pfeil;
- Rechteck;
- abgerundetes Rechteck;
- Kreis;
- Ellipse;
- Polygon;
- Stern;
- Sprechblase;
- Freihandpfad (spätere Ausbaustufe);
- Trennlinie;
- dekorativer Rahmen.

### 8.2 Gemeinsame Eigenschaften

Alle Formen können besitzen:

- X-/Y-Position;
- Breite und Höhe;
- Rotation;
- Sichtbarkeit;
- Sperrung;
- Ebenenreihenfolge;
- Deckkraft;
- Füllung;
- Kontur;
- Konturdicke;
- Konturverlauf;
- Schatten;
- Glühen;
- abgerundete Ecken, sofern relevant.

### 8.3 Linien

Linien besitzen zusätzlich:

- Start- und Endpunkt;
- Dicke;
- Endkappen: flach, rund, quadratisch;
- Verbindungstypen: gerade, gerundet, abgeschrägt;
- durchgezogen, gestrichelt, gepunktet;
- Pfeilspitzen: keine, Start, Ende, beidseitig;
- Farbverlauf entlang der Linie.

---

## 9. Text- und Word-Art-Designer

### 9.1 Grundanforderungen

Texte sind eigenständige Objekte, die frei positioniert, skaliert, gedreht und über Ebenen angeordnet werden können.

Ein Textobjekt besitzt:

| Eigenschaft | Beschreibung |
|---|---|
| Inhalt | Unicode-Text mit Zeilenumbrüchen |
| X/Y | Position auf dem Label |
| Breite/Höhe | Textbox-Abmessungen |
| Rotation | Drehung in Grad |
| Schriftfamilie | auswählbare Schrift |
| Schriftgröße | frei definierbar |
| Schriftstil | normal, fett, kursiv, fett-kursiv |
| Zeichenabstand | Letter spacing |
| Zeilenhöhe | Line height |
| horizontale Ausrichtung | links, zentriert, rechts, Blocksatz |
| vertikale Ausrichtung | oben, mittig, unten |
| Deckkraft | 0 % bis 100 % |
| Überlauf | Clip, verkleinern, Ellipse, umbrechen |

### 9.2 Schriftbibliothek

Die erste Version soll browserweit verfügbare oder mitgelieferte Webfonts anbieten, zum Beispiel:

- Sans-Serif;
- Serif;
- Monospace;
- Display;
- Condensed;
- Script;
- Retro;
- Comic;
- Pixel;
- Industrial;
- Tech.

Die Schriftbibliothek muss lizenzrechtlich eindeutig verwendbar sein. Für lokale Offline-Nutzung sind eingebettete, frei lizenzierte WOFF2-Fonts zu bevorzugen.

### 9.3 Textfüllungen

Textfüllung kann sein:

- Volltonfarbe;
- linearer Verlauf;
- radialer Verlauf;
- Bild-/Texturfüllung;
- Musterfüllung;
- transparente Füllung mit sichtbarer Kontur.

### 9.4 Texteffekte / Word-Art-Stile

Der Designer soll Textstile anbieten, die aus Kombinationen editierbarer Eigenschaften bestehen.

**Vorgesehene Effekte:**

- Kontur mit frei definierbarer Farbe und Dicke;
- Innenkontur;
- Schlagschatten;
- langer Schatten;
- Glühen / Neon;
- Tiefen- bzw. 3D-Effekt;
- Extrusion;
- Prägung;
- Gravur;
- Metall-Text;
- Chrom-Text;
- Gold-Text;
- Sticker-/Aufkleber-Effekt;
- Pixel-Text;
- Comic-Text;
- Retro-/Halftone-Text;
- Kreidetafel-Text;
- Stempel-Text;
- Schreibmaschinen-Text;
- gebogener Text auf einem Pfad (spätere Ausbaustufe).

### 9.5 Textstil-Presets

Beispiele:

| Preset | Charakteristik |
|---|---|
| Neon Pink | dunkler Hintergrund, pink/türkiser Verlauf, Glow |
| Chrom | silberner Verlauf, dunkle Kontur, Highlight |
| Comic | helle Füllung, dicke schwarze Kontur, Schlagschatten |
| Vintage | braune Farbe, Papiertextur, leichter Stempelversatz |
| Tech | cyanfarbener Verlauf, feine Leuchtkontur |
| Warnung | gelbe Füllung, schwarze Kontur, kompakte Schrift |
| Lederprägung | dunkler Text, Einprägung, dezentes Highlight |
| Pixel | Pixel-Schrift, harte Schatten, Raster-Optik |

Presets dürfen nie zu uneditierbaren Spezialobjekten führen. Sie setzen ausschließlich normale, änderbare Stilwerte.

---

## 10. Bilder und Assets

### 10.1 Bildimport

Nutzer können lokale Dateien importieren:

- PNG;
- JPEG;
- WebP;
- optional SVG als spätere Erweiterung.

Nach Import kann ein Bild:

- verschoben;
- skaliert;
- gedreht;
- zugeschnitten;
- gespiegelt;
- mit Deckkraft versehen;
- mit Rahmen, Schatten und abgerundeten Ecken versehen;
- als Textur verwendet;
- in den Hintergrund integriert

werden.

### 10.2 Bildanpassung

Unterstützte Fit-Modi:

- Ausfüllen (`cover`);
- Einpassen (`contain`);
- Strecken;
- Manuell.

Für den manuellen Modus werden Skalierung und Bildversatz getrennt von Größe und Position des Objektcontainers gespeichert.

### 10.3 Manueller Bildausschnitt und direkte Manipulation

Jedes Bildobjekt ist ein zuschneidender Container: Der Renderer clippt das Quellbild zwingend an dessen rechteckige bzw. abgerundete Objektkontur. Bildinhalt außerhalb dieser Kontur wird weder in der Vorschau noch im PNG-Export dargestellt.

Für ein einzeln ausgewähltes Bildobjekt gilt:

- **Ziehen ohne Modifikatortaste:** verschiebt das gesamte Bildobjekt auf dem Label.
- **`Shift` + Ziehen:** verschiebt ausschließlich den Bildinhalt innerhalb des unveränderten Bildobjekts.
- Die Bildskalierung wird über **Bild-Skalierung %** festgelegt. Eine Änderung aktiviert den manuellen Modus.
- Im manuellen Modus entspricht `100 %` mindestens der Cover-Skalierung. Der sichtbare Objektbereich ist daher vollständig mit Bilddaten gefüllt.
- Der Bildversatz wird in X- und Y-Richtung auf den Bereich begrenzt, in dem das Bild den gesamten Objektcontainer noch ausfüllt. Es dürfen durch Verschieben keine transparenten oder ungefüllten Randflächen sichtbar werden.
- Bei `stretch` und `label-fill` ist kein interner Bildversatz möglich, weil der Inhalt den Container exakt ausfüllt.
- `Shift`-Klick ohne relevante Zeigerbewegung behält die bestehende Mehrfachauswahl-Semantik bei; die interne Bildverschiebung beginnt erst bei einer Drag-Bewegung oberhalb der üblichen Bewegungsschwelle.

Die Eigenschaftenleiste dokumentiert die Geste direkt am Bildobjekt. Skalierung und Versatz bleiben nicht-destruktiv im JSON-Entwurf gespeichert.

---

## 11. Ebenen und Anordnung

### 11.1 Ebenenmodell

Jedes Objekt besitzt eine Ebenenposition. Die Ebenenliste erlaubt:

- Ein-/Ausblenden;
- Sperren/Entsperren;
- Umbenennen;
- Duplizieren;
- Löschen;
- nach vorne/hinten;
- ganz nach vorne/ganz nach hinten;
- Gruppieren und Gruppierung aufheben (Version 2).

### 11.2 Benennung

Neu angelegte Objekte erhalten sprechende Standardnamen:

- `Text 1`;
- `Linie 1`;
- `Rahmen 1`;
- `Bild 1`;
- `QR-Platzhalter 1`.

Der Nutzer kann jeden Namen ändern.

---

## 12. Ausrichtung, Raster und Hilfslinien

### 12.1 Raster

Das Raster ist optional und konfigurierbar:

- Raster ein/aus;
- Rasterabstand in mm;
- Rasterfarbe;
- Rasterdeckkraft;
- Einrasten an Raster;
- adaptiver Rasterabstand je Zoomstufe.

### 12.2 Hilfslinien

- horizontale und vertikale Hilfslinien;
- aus dem Lineal ziehbar;
- frei verschiebbar;
- sperrbar;
- nicht exportiert.

### 12.3 Smart Guides

Beim Verschieben oder Skalieren zeigt der Designer temporäre Ausrichtungslinien für:

- horizontale/vertikale Zentrierung;
- gleiche Abstände;
- gleiche Kanten;
- Mittelpunkte;
- Sicherheitsbereich;
- Labelkante.

---

## 13. Export als PNG

### 13.1 Anforderungen

Der Export erzeugt eine PNG-Datei ohne Editorhilfen, Auswahlrahmen, Raster oder UI-Elemente.

Exportparameter:

| Eigenschaft | Beschreibung |
|---|---|
| Dateiname | frei definierbar |
| Breite/Höhe | Label-Pixelgröße oder manuell |
| DPI | Metadatenwert für Druck-Workflows |
| Transparenter Hintergrund | optional |
| Skalierungsfaktor | 1x, 2x, 3x, 4x |
| Qualitätswarnung | bei sehr kleiner Pixelgröße |
| Vorschau | optional vor Download |

### 13.2 Exportqualität

- Alle Elemente müssen in der Exportauflösung gerendert werden.
- Texte dürfen beim Export nicht unscharf werden.
- Bei hohem Skalierungsfaktor müssen Formen, Gradients und Texturen sauber bleiben.
- PNG-Export muss mit transparentem Hintergrund funktionieren, sofern keine Hintergrundfüllung gesetzt ist.
- Die Eckenrundung muss beim PNG durch einen Alpha-Kanal korrekt ausgeschnitten werden.

### 13.3 Technische Exportempfehlung

Für den Export wird eine Offscreen-Canvas erzeugt:

1. Canvas in finaler Pixelauflösung erstellen;
2. gerenderte Label-Maske mit Radius definieren;
3. Hintergrund, Texturen und Rahmen zeichnen;
4. alle Objekte in Ebenenreihenfolge rendern;
5. `canvas.toBlob("image/png")` verwenden;
6. den Blob per Browser-Download speichern.

Für komplexe Filter oder hochauflösenden Text kann eine Canvas-Rendering-Bibliothek eingesetzt werden. Die Exportpipeline muss dieselbe Rendering-Logik wie die Editorvorschau verwenden, damit Vorschau und Ergebnis übereinstimmen.

---

## 14. Datenmodell

### 14.1 Dokumentstruktur

```ts
interface LabelDesignDocument {
  schemaVersion: 1;
  kind: "myqr24.label-designer.document";
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  canvas: LabelCanvas;
  background: LabelBackground;
  border: LabelBorder;
  objects: LabelObject[];
  guides: Guide[];
  exportSettings: ExportSettings;
}
```

### 14.2 Canvas

```ts
interface LabelCanvas {
  widthMm: number;
  heightMm: number;
  dpi: number;
  widthPx: number;
  heightPx: number;
  cornerRadiusMm: number;
  safeAreaMm: number;
  bleedMm: number;
  showGrid: boolean;
  gridSizeMm: number;
  snapToGrid: boolean;
}
```

### 14.3 Hintergrund

```ts
interface LabelBackground {
  visible: boolean;
  fill: FillStyle;
  texture?: TextureOverlay;
}

type FillStyle =
  | { type: "solid"; color: ColorValue }
  | { type: "linear-gradient"; angleDeg: number; stops: GradientStop[] }
  | { type: "radial-gradient"; centerX: number; centerY: number; stops: GradientStop[] }
  | { type: "conic-gradient"; centerX: number; centerY: number; angleDeg: number; stops: GradientStop[] }
  | { type: "transparent" };

interface GradientStop {
  positionPercent: number;
  color: ColorValue;
}

interface ColorValue {
  hex: string;
  alpha: number;
}

interface TextureOverlay {
  source: "preset" | "uploaded";
  textureId?: string;
  dataUrl?: string;
  opacity: number;
  blendMode: "normal" | "multiply" | "screen" | "overlay";
  scalePercent: number;
  rotationDeg: number;
  offsetXPercent: number;
  offsetYPercent: number;
  tint?: ColorValue;
}
```

### 14.4 Rand

```ts
interface LabelBorder {
  visible: boolean;
  widthMm: number;
  alignment: "inside" | "center" | "outside";
  cornerRadiusMm?: number;
  fill: FillStyle;
  texture?: TextureOverlay;
  preset?: string;
  innerStroke?: BorderStroke;
  outerStroke?: BorderStroke;
  shadow?: ShadowStyle;
}

interface BorderStroke {
  widthMm: number;
  color: ColorValue;
  style: "solid" | "dashed" | "dotted";
}
```

### 14.5 Objekte

```ts
type LabelObject =
  | TextObject
  | ShapeObject
  | LineObject
  | ImageObject;

interface ObjectBase {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotationDeg: number;
  zIndex: number;
}

interface TextObject extends ObjectBase {
  type: "text";
  content: string;
  font: TextStyle;
}

interface ShapeObject extends ObjectBase {
  type: "shape";
  shape: "rectangle" | "rounded-rectangle" | "ellipse" | "polygon" | "star" | "speech-bubble";
  fill: FillStyle;
  stroke?: BorderStroke;
  cornerRadiusMm?: number;
}

interface LineObject extends ObjectBase {
  type: "line";
  startXPercent: number;
  startYPercent: number;
  endXPercent: number;
  endYPercent: number;
  stroke: BorderStroke;
  startArrow: boolean;
  endArrow: boolean;
}

interface ImageObject extends ObjectBase {
  type: "image";
  dataUrl: string;
  sourceWidthPx: number;
  sourceHeightPx: number;
  fitMode: "cover" | "contain" | "stretch" | "manual";
  scalePercent: number;
  offsetXPercent: number;
  offsetYPercent: number;
  cornerRadiusMm: number;
}

interface TextStyle {
  fontFamily: string;
  fontSizePt: number;
  fontStyle: "normal" | "bold" | "italic" | "bold-italic";
  letterSpacingPt: number;
  lineHeight: number;
  horizontalAlign: "left" | "center" | "right" | "justify";
  verticalAlign: "top" | "middle" | "bottom";
  fill: FillStyle;
  outline?: BorderStroke;
  shadow?: ShadowStyle;
  glow?: GlowStyle;
  extrusion?: ExtrusionStyle;
}

interface ShadowStyle {
  color: ColorValue;
  blurMm: number;
  offsetXmm: number;
  offsetYmm: number;
}

interface GlowStyle {
  color: ColorValue;
  blurMm: number;
  intensity: number;
}

interface ExtrusionStyle {
  depthMm: number;
  angleDeg: number;
  color: ColorValue;
}
```

---

## 15. Technische Architektur

### 15.1 Empfohlener Technologie-Stack

Für eine konsistente Integration mit bestehenden Tools wird empfohlen:

- TypeScript;
- Vite;
- browser-native DOM und Canvas;
- React nur falls der bestehende UI-Stack dies nahelegt;
- Canvas-Rendering über eine geeignete Abstraktion;
- lokale Speicherung über `localStorage` oder IndexedDB;
- Unit Tests mit Vitest;
- Browser-/UI-Tests mit Playwright oder Puppeteer.

### 15.2 Rendering-Strategie

Eine zentrale Rendering-Schicht muss sowohl für:

- Editorvorschau,
- Export-Canvas,
- Miniaturansichten,
- optional PDF-Integration

verwendet werden.

Dadurch wird verhindert, dass der exportierte PNG-Inhalt von der sichtbaren Gestaltung abweicht.

**Empfehlung:**

```text
Dokumentmodell
    ↓
Renderer (Canvas-agnostische Renderbefehle)
    ↓
- Editor-Canvas
- Offscreen Export-Canvas
- Thumbnail-Canvas
```

### 15.3 Performance

Die Anwendung soll auch bei großen Texturen reaktionsfähig bleiben.

Mindestmaßnahmen:

- Thumbnails und Vorschaubilder cachen;
- Texturen auf Vorschauauflösung reduzieren;
- finale Originaldaten nur beim Export verwenden;
- `requestAnimationFrame` für Drag-/Resize-Updates nutzen;
- Rendering bei Slider-Bewegung throttlen;
- maximal zulässige Importbildgröße definieren;
- lange History-Schritte komprimieren.

---

## 16. Lokale Speicherung, Import und Export

### 16.1 Lokaler Entwurf

Ein Entwurf kann lokal gespeichert werden. Folgende Daten dürfen gespeichert werden:

- Labelgröße;
- Hintergrund;
- Rand;
- Texturen;
- Objekte;
- Schrift- und Texteffekte;
- Hilfslinien;
- Exportvorgaben.

### 16.2 Datenschutz

- Keine Nutzdaten müssen an einen Server übertragen werden.
- Importbilder werden lokal als Data-URL oder in IndexedDB gespeichert.
- Bei JSON-Export muss erkennbar sein, wenn große eingebettete Bilddaten enthalten sind.
- Eine Löschfunktion für lokale Entwürfe ist erforderlich.

### 16.3 Dateiformate

| Aktion | Format |
|---|---|
| Entwurf speichern | JSON |
| Entwurf laden | JSON |
| Gestaltung exportieren | PNG |
| Bild-/Texturimport | PNG, JPEG, WebP |
| Stilbibliothek | JSON-Preset-Datei, optional |

---

## 17. Fehlerbehandlung und Validierung

Der Designer muss mindestens folgende Eingabefehler verhindern oder klar darstellen:

- Breite/Höhe kleiner oder gleich null;
- Eckenradius größer als halbe kürzere Kante;
- negative Randdicke;
- ungültige Hex-Farben;
- ungültige Bilddatei;
- beschädigte JSON-Datei;
- unzulässige oder zu große Importdatei;
- Exportgröße oberhalb einer sicheren Canvas-Grenze;
- nicht verfügbare Schrift.

Bei Fehlern darf der aktuelle Entwurf nicht verloren gehen.

---

## 18. Qualitäts- und Akzeptanzkriterien

### 18.1 Funktionale Akzeptanz

1. Ein Nutzer kann ein neues Label mit frei definierter Breite, Höhe und Eckenradius anlegen.
2. Ein Nutzer kann Hintergrundfarbe und einen Verlauf mit mindestens drei Farbstopps erzeugen.
3. Ein Nutzer kann eine Metall-, Elektronik-, Holz-, Stein- oder Papiertextur auswählen und deren Deckkraft verändern.
4. Ein Nutzer kann einen Rand mit frei definierter Farbe, Verlauf, Textur und Dicke konfigurieren.
5. Ein Nutzer kann Text frei positionieren, skalieren und drehen.
6. Ein Nutzer kann mindestens Textfarbe, Farbverlauf, Kontur, Schatten und Glow einstellen.
7. Ein Nutzer kann Linien und Formen platzieren und formatieren.
8. Ein Nutzer kann ein lokales Bild importieren und auf dem Label zuschneiden.
9. Ein Nutzer kann den Entwurf als JSON speichern und erneut laden.
10. Ein Nutzer kann den Entwurf als PNG in der definierten Größe exportieren.
11. Das PNG entspricht optisch der Vorschau und enthält keine Editorhilfen.

### 18.2 Qualitätskriterien

- Die Anwendung funktioniert in aktuellen Chromium-basierten Browsern.
- Bedienaktionen wie Verschieben und Skalieren sind flüssig.
- Alle Maße können präzise numerisch eingegeben werden.
- Änderungen werden mit Undo/Redo unterstützt.
- PNGs mit abgerundeten Label-Ecken haben transparente Außenbereiche.
- Keine netzwerkbasierte Abhängigkeit ist für Kernfunktionen notwendig.

---

## 19. Umsetzungsphasen

### Phase 1 – Fundament und PNG-Export

- Vite-/TypeScript-Projekt unter `tools/tag-designer`;
- Dokumentmodell;
- neue Designfläche;
- frei wählbare Labelgröße;
- Grundfarbe, Eckenradius und einfacher Rand;
- Textobjekte;
- Rechtecke und Linien;
- PNG-Export;
- JSON speichern/laden.

### Phase 2 – Professionelle Gestaltung

- Farbverlaufseditor;
- Texturen für Hintergrund und Rand;
- Bildimport;
- Ebenenliste;
- Ausrichtung, Raster, Hilfslinien;
- Schatten, Konturen und Glow;
- Textstil-Presets.

### Phase 3 – Word-Art und Stilbibliothek

- erweiterte Textfüllungen;
- 3D-/Extrusions- und Prägeeffekte;
- kurviger Text;
- umfangreiche Preset-Bibliothek;
- Vorlagenbrowser;
- Nutzer-Presets.

### Phase 4 – Integration und Druck

- Übergabe von Designs an den TAG-Generator;
- QR-Code-Datenbindung;
- Mehrfach-/Serienexport;
- optional SVG-/PDF-Export;
- druckspezifische Qualitätsprüfungen.

---

## 20. Beispielvorlagen für den Start

Die erste integrierte Vorlagenbibliothek soll mindestens enthalten:

1. Neon Lost & Found;
2. Metall Lost & Found;
3. Pixel Lost & Found;
4. Leder Fundstück;
5. Comic Fundstück;
6. Elektronik-/Schaltkreis;
7. Vintage-Reisetag;
8. Baustein Kinderlabel;
9. Warnstreifen Service;
10. Holz Werkstatt;
11. Marmor Premium;
12. Ozean Fundservice.

Die bereits generierten Lost-&-Found-Bilder können als visuelle Referenz und als anfängliche Hintergrund-/Vorlagen-Assets verwendet werden.

---

## 21. Offene Produktentscheidungen

Vor Beginn der Implementierung sind folgende Entscheidungen zu treffen:

1. Soll das Tool als eigenständige Anwendung oder als zusätzlicher Bereich des bestehenden Tag-Generators ausgeliefert werden?
2. Welche frei lizenzierten Schriftarten sollen offline eingebettet werden?
3. Welche Texturen werden als eingebettete Assets geliefert und welche prozedural generiert?
4. Welche maximale Exportauflösung und Importdateigröße ist sinnvoll?
5. Soll PNG nur RGB oder optional mit Druck-DPI-Metadaten erzeugt werden?
6. Wie soll die Übergabe eines gestalteten Hintergrunds an den TAG-Generator aussehen?
7. Werden QR-Code-Platzhalter bereits in Version 1 benötigt?

---

## 22. Ergänzende Anforderungen: Effekte, Bilder und fortgeschrittene Bearbeitung

### 22.1 Erweiterte Texteffekte und regelbares Neon

Die in Abschnitt 9 beschriebenen Texteffekte werden um folgende editierbare Effektparameter erweitert:

- Konturposition: innen, mittig oder außen;
- Schlagschatten mit Farbe, X-/Y-Versatz, Unschärfe, Ausbreitung und Deckkraft;
- langer Schatten mit Richtung, Länge, Farbe und Deckkraft;
- inneres und äußeres Glühen;
- Neon-Kern, Neon-Schein und großflächiger Lichtschein als getrennte Renderstufen;
- Reflexions- bzw. Glanzkante;
- Weichzeichnung.

Der Effekt **Glühen / Neon** muss explizit stärker regelbar sein und mindestens diese Eigenschaften anbieten:

| Eigenschaft | Vorgabe |
|---|---|
| Aktiv | Checkbox; das Abschalten erhält die konfigurierten Werte |
| Farbe | frei wählbar, unabhängig von Füllung und Kontur |
| Intensität | `0–200 %`; steuert Deckkraft und Anzahl/Stärke der Glow-Pässe |
| Unschärfe | `0–100 px` oder äquivalente physikalische Einheit |
| Ausbreitung | `0–100 px` vor Anwendung der Unschärfe |
| Deckkraft | `0–100 %` |
| Blend-Modus | mindestens Normal, Screen und Überlagern |
| Flackern | optional nur als Vorschauanimation; PNG exportiert einen definierten statischen Zustand |

Bei erhöhter Intensität rendert der Renderer einen kompakten, hellen Neon-Kern, einen mittelgroßen farbigen Schein sowie einen großflächig weichgezeichneten Lichtschein. Editorvorschau und PNG-Export verwenden dieselbe Effektkonfiguration.

### 22.2 Eckenradius und Rand

Der Rand übernimmt standardmäßig zwingend die abgerundete Außenkontur des Labels. Eine Änderung des Label-Eckenradius aktualisiert gleichzeitig:

1. die äußere Randkontur;
2. die innere Randkontur entsprechend Randdicke und Randposition;
3. die Clip-Maske von Randtextur, Verlauf, Schatten und Glanz;
4. die transparente Außenfläche des PNG-Exports.

Ein abweichender eigener Randradius ist nur nach explizitem Aktivieren zulässig. Sein gültiger Wertebereich ist abhängig von Labelgröße, Randdicke und Randausrichtung zu begrenzen. Der Standardfall darf an den Ecken keine sichtbaren Versätze oder Artefakte erzeugen.

### 22.3 Bildobjekte und lokaler Dateiimport

Ein Entwurf kann mehrere Bildobjekte enthalten. Jedes importierte Bild ist ein eigenständiges, nicht-destruktives Ebenenobjekt und erhält einen Namen wie `Bild 1`, `Bild 2` oder einen bereinigten Dateinamen.

Der Bildimport muss lokale PNG-, JPEG- und WebP-Dateien akzeptieren. Pro Bild sind mindestens folgende Eigenschaften verfügbar:

- Sichtbarkeit über Checkbox; ausgeblendete Bilder bleiben im Entwurf und JSON erhalten, werden aber nicht exportiert;
- Position, Größe, Drehung, Deckkraft und Ebenenposition;
- Skalierung, Spiegelung, Zuschnitt und abgerundete Ecken;
- Rahmen und Schatten;
- Fit-Modus **Label ausfüllen**: Der Objektcontainer entspricht exakt der aktuellen Labelgröße und folgt späteren Größenänderungen;
- Fit-Modi `cover`, `contain`, `stretch` und `manual`;
- frei positionierbarer manueller Modus mit separater Bildskalierung und Bildversatz.

Beim Wechsel von „Label ausfüllen“ zum manuellen Modus bleiben die zuletzt sichtbare Position und Größe als Ausgangswerte erhalten. Importbilder werden lokal als Data-URL oder in IndexedDB gespeichert. Bei sehr großen eingebetteten Bilddaten warnt die Oberfläche vor einem großen JSON-Export.

### 22.4 Ebenenreihenfolge und Sichtbarkeit

Die Ebenenliste stellt für jedes Objekt einzeln bereit:

- Sichtbarkeit ein-/ausschalten;
- Sperren/Entsperren;
- Umbenennen, Duplizieren und Löschen;
- eine Ebene nach vorne bzw. hinten;
- ganz nach vorne bzw. ganz nach hinten;
- Anzeige der aktuellen Reihenfolge, wobei die oberste Ebene zuletzt gerendert wird.

Die Funktionen müssen sowohl über die Ebenenliste als auch, sofern ein einzelnes Objekt ausgewählt ist, über das Eigenschaftenpanel erreichbar sein. Aktionen auf einer Mehrfachauswahl verändern die relative Reihenfolge der ausgewählten Elemente nicht.

### 22.5 Mehrfachauswahl und gemeinsames Verschieben

Die direkte Manipulation wird verbindlich wie folgt erweitert:

- `Shift` + Klick fügt ein Objekt zur aktuellen Auswahl hinzu oder entfernt es daraus;
- Ziehen auf einer leeren Designfläche erzeugt einen Auswahlrahmen;
- alle vom Auswahlrahmen berührten Objekte werden ausgewählt;
- das Ziehen eines bereits ausgewählten Objekts verschiebt die gesamte Auswahl;
- die relativen Abstände der ausgewählten Objekte bleiben erhalten;
- gesperrte oder ausgeblendete Objekte können weder mit Klick noch Auswahlrahmen verändert werden;
- gemeinsame Eigenschaften wie Sichtbarkeit, Deckkraft und Ebenenaktion können für mehrere Objekte gesetzt werden;
- objektspezifische Eigenschaften wie Textinhalt oder Bild-Fit-Modus bleiben bei Mehrfachauswahl unverändert, sofern nicht für alle Objektarten gültig.

### 22.6 Stil-Pipette und Stilpinsel für Texte

Die Werkzeugleiste enthält eine Stil-Pipette und einen Stilpinsel für Textobjekte:

1. Mit der **Stil-Pipette** klickt der Nutzer ein Quell-Textobjekt an.
2. Das System kopiert ausschließlich dessen Textstil, nicht Inhalt, Position, Abmessungen, Name, Sichtbarkeit oder Ebenenposition.
3. Der **Stilpinsel** ist anschließend aktiv und überträgt den gespeicherten Stil per Klick auf ein Ziel-Textobjekt.
4. Der Stilpinsel bleibt aktiv, bis er abgewählt wird oder der Nutzer `Esc` drückt. Optional wird ein Einmalmodus unterstützt.

Ein kopierbarer Textstil umfasst mindestens Schriftfamilie, Schriftgröße, Schriftschnitt, Ausrichtung, Füllung, Kontur, Schatten, Glow/Neon einschließlich aller Intensitätswerte, Extrusion und sonstige Texteffekte. Bei Klick auf Nicht-Textobjekte zeigt die Anwendung eine verständliche, nicht destruktive Hinweismeldung.

### 22.7 Datenmodell-Ergänzungen

```ts
interface ObjectBase {
  visible: boolean;
  locked: boolean;
  zIndex: number;
}

interface ImageObject extends ObjectBase {
  type: "image";
  dataUrl: string;
  fileName: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  sourceWidthPx: number;
  sourceHeightPx: number;
  fitMode: "label-fill" | "cover" | "contain" | "stretch" | "manual";
  scalePercent: number;
  offsetXPercent: number;
  offsetYPercent: number;
}

interface GlowStyle {
  enabled: boolean;
  color: ColorValue;
  intensityPercent: number;
  blurPx: number;
  spreadPx: number;
  opacityPercent: number;
  blendMode: "normal" | "screen" | "overlay";
  flickerPreview: boolean;
}

interface TextStyleClipboard {
  sourceTextObjectId: string;
  style: TextStyle;
}
```

### 22.8 Ergänzte Akzeptanzkriterien

Zusätzlich zu Abschnitt 18 gelten folgende Kriterien:

1. Eine Änderung des Label-Eckenradius verändert den Rand ohne Eckartefakte und wird im PNG identisch exportiert.
2. Ein Nutzer kann mehrere lokale Bilder importieren, pro Bild die Sichtbarkeit schalten und jedes Bild frei positionieren.
3. Ein Nutzer kann ein Bild über „Label ausfüllen“ an die aktuelle Labelgröße binden und danach wieder manuell positionieren.
4. Ein Nutzer kann jedes Objekt in der Ebenenliste schrittweise oder vollständig nach vorne bzw. hinten bewegen.
5. Ein Nutzer kann mehrere Objekte mit `Shift` und per Auswahlrahmen selektieren und gemeinsam verschieben.
6. Ein Nutzer kann die Neon-Intensität, Unschärfe, Ausbreitung und Deckkraft sichtbar verändern.
7. Ein Nutzer kann per Pipette einen Textstil aufnehmen und mit dem Stilpinsel auf mindestens ein anderes Textobjekt übertragen, ohne dessen Textinhalt zu verändern.
8. Ein Nutzer kann ein einzeln ausgewähltes, vergrößertes Bildobjekt mit `Shift` + Drag innerhalb seines Containers verschieben, ohne die Position des Bildobjekts auf dem Label zu ändern.
9. Beim internen Verschieben eines Bildes bleiben alle Kanten des Bildobjekts vollständig mit Bilddaten gefüllt; Vorschau und PNG-Export schneiden identisch zu.

---

## 23. Ergänzende Anforderungen: Eingabeverhalten, Arbeitsbereich und Auswahl

### 23.1 Commit-Verhalten numerischer Eigenschaftsfelder

Numerische Eingabefelder für Label- und Objekteigenschaften dürfen den Entwurf nicht nach jedem einzelnen Tastendruck vollständig neu rendern. Damit mehrstellige Werte ohne Fokus- oder Cursorsprung eingegeben werden können, gelten folgende Regeln:

- Änderungen über Schieberegler, Checkboxen, Farbwähler und Auswahllisten werden unmittelbar angezeigt.
- Eine Zahleneingabe wird unmittelbar übernommen, wenn der Nutzer `Enter` drückt oder das Feld verlässt.
- Während fortlaufender Tastatureingabe wird die Vorschau erst nach einer Eingabepause von maximal `500 ms` aktualisiert.
- Eine nachlaufende Aktualisierung darf weder Fokus, Cursorposition noch den noch nicht bestätigten Feldinhalt verändern.
- Ungültige oder außerhalb des erlaubten Bereichs liegende Werte werden beim Commit begrenzt; der korrigierte Wert wird anschließend im Feld angezeigt.

Die Kombination aus Enter-/Blur-Commit und kurzer Verzögerung verbindet präzise, explizite Eingabe mit einer erwartbaren Live-Vorschau. Ein ausschließliches Enter-Verhalten ist nicht ausreichend, da Werte bei einem Fokuswechsel zuverlässig übernommen werden müssen.

### 23.2 Getrennte Scrollbereiche

Die rechte Eigenschaftenleiste und die Designfläche sind eigenständige Viewports:

- Überlange Eigenschaften- und Ebeneninhalte erzeugen ausschließlich in der rechten Eigenschaftenleiste einen vertikalen Scrollbalken.
- Der Scrollbalken der Eigenschaftenleiste verändert weder Breite, Position noch Scrollzustand der Designfläche.
- Der Arbeitsbereich zwischen Kopf- und Statusleiste begrenzt beide Viewports auf die verfügbare Fensterhöhe.
- Die Eigenschaftenleiste verwendet eine stabile Scrollbar-Gutter, damit das Erscheinen ihres Scrollbalkens die Breite der Steuerelemente nicht verschiebt.
- Horizontales Scrollen der Eigenschaftenleiste ist zu vermeiden.

### 23.3 Zoom und Scrollverhalten der Designfläche

Die Designfläche ist ein separat scrollbarerer Workspace mit folgenden Regeln:

- Die Zoom-Steuerung bestimmt die sichtbare CSS-Größe der Canvas und begrenzt sie nicht auf die Breite des Viewports.
- Die Zoomsteuerung arbeitet in Schritten von `5 %` und erlaubt eine Zoomspanne von `15 %` bis einschließlich `300 %`.
- Passt das gezoomte Label nicht in den Darstellungsbereich, erscheinen horizontale und/oder vertikale Scrollbalken ausschließlich innerhalb der Designfläche.
- Bei einer kleineren Darstellung bleibt das Label innerhalb der verfügbaren Arbeitsfläche zentriert.
- Bei einer größeren Darstellung ist jeder Bereich des Labels durch Scrollen erreichbar.
- Änderungen am Eigenschaftenpanel, insbesondere das Erscheinen seines Scrollbalkens, dürfen keine sichtbare Verschiebung oder Sprungbewegung des Labels auslösen.

### 23.4 Auswahl, Deselektion und Ziehen

Die einfache Objektauswahl unterscheidet eindeutig zwischen Klick und Drag:

- Ein einfacher Klick auf ein nicht ausgewähltes Objekt selektiert dieses Objekt.
- Ein einfacher Klick auf ein bereits allein ausgewähltes Objekt deselectiert es.
- Eine Pointerbewegung oberhalb einer kleinen Bewegungsgrenze (empfohlen: `4 px` in Canvas-Koordinaten) startet das Verschieben statt einer Deselektion.
- Klick auf ein anderes Objekt wechselt die Auswahl zu diesem Objekt.
- `Shift`-Klick behält die Mehrfachauswahl bei und fügt ein Objekt hinzu bzw. entfernt es daraus.
- Ein Klick auf eine freie Fläche deselectiert die aktuelle Auswahl; Ziehen auf freier Fläche erzeugt weiterhin den Auswahlrahmen.
- Gesperrte oder ausgeblendete Objekte bleiben von direkter Auswahl und Manipulation ausgeschlossen.

### 23.5 Ergänzte Akzeptanzkriterien

8. Ein mehrstelliger Zahlenwert kann vollständig über die Tastatur eingegeben werden, ohne dass das Eingabefeld nach jedem Zeichen neu gerendert wird oder seinen Fokus verliert.
9. Die Änderung eines Zahlenwerts wird spätestens `500 ms` nach der letzten Eingabe sowie bei `Enter` und Fokusverlust sichtbar übernommen.
10. Das Scrollen der Eigenschaftenleiste verändert weder die Position noch den sichtbaren Ausschnitt der Designfläche.
11. Ein gezoomtes, zu großes Label ist innerhalb der Designfläche horizontal und vertikal scrollbar; ein passendes Label bleibt zentriert.
12. Ein einzelnes selektiertes Objekt lässt sich mit einem weiteren einfachen Klick deselectieren, während eine Pointerbewegung oberhalb der definierten Schwelle das Objekt verschiebt.

### 23.6 Physische Druckmaße und Auflösung

Ein Label speichert seine physische Breite und Höhe zusätzlich in Zentimetern. Die Anwendung führt Zentimeter, DPI und Pixelwerte konsistent nach diesen Formeln:

```text
Pixel = round(Zentimeter / 2,54 × DPI)
Zentimeter = Pixel / DPI × 2,54
```

- Breite und Höhe in Zentimetern sowie DPI sind die primären Angaben für einen neuen druckfähigen Entwurf.
- Pixelbreite und -höhe bleiben sichtbar und dürfen für pixelbasierte Vorlagen weiterhin direkt eingegeben werden.
- Bei Änderung einer Zentimeterangabe werden die entsprechenden Pixelwerte aus Zentimetern und aktueller DPI neu berechnet.
- Bei Änderung der DPI bleiben die physischen Zentimetermaße unverändert; die Pixelwerte werden neu berechnet.
- Bei Änderung eines Pixelwerts wird das zugehörige Zentimetermaß aus Pixelwert und aktueller DPI neu berechnet.
- Die Oberfläche zeigt jederzeit gleichzeitig das Druckformat in Zentimetern, die resultierende Pixelauflösung und die DPI-Zahl.
- Bestehende Entwürfe ohne Zentimeterangaben leiten diese beim Laden aus vorhandener Pixelgröße und DPI ab.

### 23.7 Skalierung bei Format- und DPI-Änderungen

Ändern sich die resultierenden Pixelmaße, bleibt der Entwurf relativ zum physischen Label erhalten:

- Objektpositionen, Objektabmessungen, Linienendpunkte, Schriftgrößen, Konturstärken, Objekt- und Label-Eckenradien sowie Bildversätze werden proportional zur Breiten- bzw. Höhenänderung skaliert.
- Bilder im Modus „Label ausfüllen“ folgen exakt der neuen Labelgröße.
- Die Skalierung erfolgt auch bei einer reinen DPI-Änderung, damit ein beispielsweise bei `300 DPI` gestaltetes Label bei `600 DPI` in der gleichen physischen Größe und mit der doppelten Pixelauflösung exportiert wird.
- Die Canvas und der PNG-Export verwenden stets die resultierenden, auf ganze Pixel gerundeten Maße.
- Für optimale Druckergebnisse soll der Druckdialog das PNG ohne zusätzliche Größenanpassung ausgeben; Pixelmaße und DPI bestimmen die erreichbare Druckschärfe.

### 23.8 Ergänzte Akzeptanzkriterien für den Druck

13. Ein Nutzer kann Breite und Höhe eines Labels in Zentimetern sowie die DPI-Zahl eingeben und erhält korrekt berechnete Pixelmaße.
14. Eine Änderung von `300 DPI` auf `600 DPI` verdoppelt die Pixelmaße bei unveränderten Zentimetermaßen und erhält das Layout proportional.
15. Eine Änderung der Pixelbreite oder -höhe aktualisiert das zugehörige Zentimetermaß korrekt.
16. Geladene ältere JSON-Dateien erhalten automatisch aus Pixelmaßen und DPI berechnete Zentimetermaße.

### 23.9 Eingabepräzision und Rundung

Physische und pixelbasierte Eingaben müssen verständlich, stabil und frei von sichtbaren Fließkommaartefakten dargestellt werden. Für die persistierten und gerenderten Werte gelten folgende Regeln:

| Wertart | Einheit | Maximale Präzision |
|---|---|---:|
| physische Labelgröße | Millimeter | 1 Nachkommastelle |
| physische Labelgröße | Zentimeter | 2 Nachkommastellen |
| Canvas- und Objektmaße | Pixel | ganze Zahl |
| Objektpositionen und Linienendpunkte | Pixel | ganze Zahl |
| Eckenradien, Rahmen- und Konturstärken | Pixel | 1 Nachkommastelle |
| Schriftgröße, Drehung, Bildskalierung und Bildversatz | Pixel bzw. Grad | 1 Nachkommastelle |
| Glow-Unschärfe und Glow-Ausbreitung | Pixel | 1 Nachkommastelle |

- Die Anwendung rundet vor dem Rendern und vor dem JSON-Export auf die jeweilige Präzision.
- Die Anzeige verwendet das eingestellte Zahlenformat (`de-DE` oder `en-US`) und darf keine technischen Skalierungsartefakte wie lange Dezimalfolgen zeigen.
- Millimeterwerte entsprechen intern weiterhin den in Abschnitt 23.6 definierten Zentimeter- und DPI-Umrechnungen.
- Ganzzahlige Pixelmaße sind für Canvas und PNG-Export verpflichtend.

### 23.10 Konfigurierbare Label-Formate und Startwerte

Label-Standardformate werden nicht im Anwendungscode gepflegt, sondern über eine öffentliche JSON-Konfiguration geladen. Die Standarddatei lautet:

```text
tools/tag-designer/public/label-formats.json
```

Sie wird beim Start unter `/label-formats.json` geladen und bei einem Vite-Produktions-Build unverändert in das Ausgabeverzeichnis übernommen.

```json
{
  "default": {
    "formatId": "lost-found",
    "dpi": 300,
    "physicalUnit": "mm",
    "numberFormat": "de-DE",
    "cornerRadiusPx": 42
  },
  "formats": [
    {
      "id": "L4778-8",
      "name": "L4778-8",
      "widthMm": 45.7,
      "heightMm": 21.2
    },
    {
      "id": "L4773-8",
      "name": "L4773-8",
      "widthMm": 63.5,
      "heightMm": 33.9
    }
  ]
}
```

Die Konfiguration enthält:

- `default.formatId`: ID des beim Start verwendeten Formats;
- `default.dpi`: Startauflösung im Bereich `72–1200`;
- `default.physicalUnit`: `"mm"` oder `"cm"`;
- `default.numberFormat`: `"de-DE"` oder `"en-US"`;
- `default.cornerRadiusPx`: Startwert des Label-Eckenradius in Pixeln;
- `formats`: Liste editierbarer Formatvorlagen mit eindeutiger `id`, Anzeigename `name`, `widthMm` und `heightMm`.

Das Eigenschaftenpanel stellt die Formate in einer Auswahl **Label-Format** bereit. Die Auswahl eines Formats:

1. übernimmt dessen physische Breite und Höhe;
2. berechnet bei der aktuellen DPI die Pixelmaße neu;
3. skaliert den bestehenden Entwurf gemäß Abschnitt 23.7 proportional.

Bearbeitet ein Nutzer danach physische Maße oder Pixelmaße direkt, wechselt die Auswahl auf **Benutzerdefiniert**.

Ist die Konfiguration nicht erreichbar oder ungültig, startet die Anwendung mit einer eingebauten Standardkonfiguration weiter. Dadurch bleibt der lokale Designer auch bei einer fehlerhaften Bereitstellung der JSON-Datei bedienbar.

### 23.11 Ergänzte Akzeptanzkriterien für Formate, Präzision und Zoom

17. Der Nutzer kann bis auf `300 %` zoomen und jeden Bereich eines übergroßen Labels innerhalb der Designfläche erreichen.
18. Die Oberfläche zeigt Millimeter mit höchstens einer und Zentimeter mit höchstens zwei Nachkommastellen; Pixelmaße und Objektpositionen werden ganzzahlig angezeigt.
19. Die Datei `label-formats.json` kann ohne Anpassung des TypeScript-Codes um weitere Formate ergänzt werden.
20. Das beim Start gewählte Standardformat, DPI, Maßeinheit, Zahlenformat und Eckenradius werden aus der JSON-Konfiguration übernommen.
21. Die Formatauswahl enthält mindestens `L4778-8: 45,7 × 21,2 mm` sowie `L4773-8: 63,5 × 33,9 mm` und übernimmt die jeweiligen Abmessungen.
22. Bei ungültiger oder nicht verfügbarer Formatkonfiguration bleibt der Designer mit einer eingebauten Standardkonfiguration funktionsfähig.

### 23.12 3D-Relief für Texte und Labelrand

Textobjekte und der Labelrand unterstützen einen nicht-destruktiven 3D-Reliefeffekt. Für beide Einsatzbereiche stehen die Modi **Aus**, **Erhaben** und **Vertieft** zur Verfügung.

Ein Relief besitzt die folgenden editierbaren Werte:

| Eigenschaft | Bereich | Bedeutung |
|---|---:|---|
| Modus | Aus, Erhaben, Vertieft | aktiviert den Effekt und bestimmt die Kantenführung |
| Tiefe | `0–100 px` | räumliche Stärke des Reliefs |
| Lichtrichtung | `0–359,9°` | Richtung der hervorgehobenen Kante |
| Weichheit | `0–50 px` | Unschärfe der Licht- und Schattenkante |
| Stärke | `0–100 %` | Deckkraft des Reliefs |
| Lichtfarbe | Farbe | Farbe der hervorgehobenen Kante |
| Schattenfarbe | Farbe | Farbe der Schattenkante |

**Textrelief:**

- Bei **Erhaben** zeichnet der Renderer eine helle Kante in Lichtrichtung und eine dunkle Gegenkante. Der Text wirkt dadurch aufgelegt oder geprägt.
- Bei **Vertieft** wird die Kantenrichtung umgekehrt, sodass der Text in die Hintergrundoberfläche eingelassen wirkt.
- Das Relief wird nach Glow, jedoch vor optionalem Schlagschatten, Textkontur und Textfüllung gerendert. Dadurch bleiben Füllung, Kontur und bestehende Texteffekte sichtbar.
- Stil-Pipette und Stilpinsel übernehmen den vollständigen Reliefstil zusammen mit dem übrigen Textstil.

**Randrelief:**

- Bei **Erhaben** ergänzt der Renderer den bestehenden Rand um Licht- und Schattenkanten, die einen aufgesetzten Rahmen erzeugen.
- Bei **Vertieft** werden die Kanten umgekehrt gerendert und erzeugen den Eindruck einer eingelassenen Rille.
- Das Relief folgt stets dem Label-Eckenradius.
- Die nutzbare Tiefe ist auf weniger als die halbe Randbreite begrenzt, damit der Effekt nicht über die Randfläche hinausläuft.
- Die bestehende Randfüllung wird nach dem Relief gerendert und bleibt als sichtbare Hauptoberfläche erhalten.

Reliefwerte werden mit maximal einer Nachkommastelle gespeichert. Bei einer DPI- oder Formatänderung skalieren Tiefe und Weichheit proportional zum Entwurf. Ältere JSON-Dateien erhalten für Text und Rand den sicheren Standardmodus `Aus`.

### 23.13 Datenmodell-Ergänzung für 3D-Relief

```ts
type ReliefMode = "none" | "raised" | "inset";

interface ReliefStyle {
  mode: ReliefMode;
  depth: number;
  angle: number;
  softness: number;
  strength: number;
  highlightColor: string;
  shadowColor: string;
}

interface TextObject extends ObjectBase {
  relief: ReliefStyle;
}

interface LabelDesignDocument {
  schemaVersion: 5;
  borderRelief: ReliefStyle;
}
```

### 23.14 Ergänzte Akzeptanzkriterien für 3D-Relief

23. Der Nutzer kann für jedes Textobjekt zwischen deaktiviertem, erhabenem und vertieftem Relief wählen und Tiefe, Lichtrichtung, Weichheit, Stärke sowie Licht- und Schattenfarbe festlegen.
24. Ein erhabener Text zeigt bei gleicher Konfiguration eine helle und eine dunkle Kante in entgegengesetzter Richtung; beim vertieften Text ist diese Kantenführung umgekehrt.
25. Der Labelrand kann unabhängig vom Text mit erhabenem oder vertieftem Relief versehen werden und zeigt an abgerundeten Ecken keine sichtbaren Unterbrechungen.
26. Die Reliefdarstellung der Editorvorschau und des PNG-Exports ist identisch.
27. Bei einem Export und erneuten Laden eines Entwurfs bleiben alle Reliefwerte erhalten; ältere Entwürfe ohne Reliefwerte bleiben weiterhin ladbar und verwenden den Modus `Aus`.
28. Bei Format- oder DPI-Änderungen bleiben Tiefe und Weichheit des Reliefs proportional zur Labelgröße erhalten.

### 23.15 Textbearbeitung und Dateiauswahl beim PNG-Export

Die Bearbeitung des Eigenschaftenfelds **Textinhalt** darf das Eigenschaftenpanel während der Tastatureingabe nicht neu erzeugen. Jeder eingegebene Text wird unmittelbar auf der Canvas-Vorschau dargestellt; Fokus, Cursorposition und mehrzeiliger Inhalt des Eingabefelds bleiben dabei erhalten. Ein vollständiges Panel-Update erfolgt erst beim Verlassen bzw. Bestätigen des Felds.

Zusätzlich ist eine direkte Bearbeitung auf der Designfläche verfügbar:

- Doppelklick auf ein Textobjekt öffnet einen über dem Objekt positionierten Texteditor.
- Bei einem einzeln ausgewählten Textobjekt öffnet `Enter` denselben Editor.
- Der Editor übernimmt Schriftfamilie, Schriftgröße, Farbe, Ausrichtung, Rotation sowie die sichtbare Objektgröße.
- Während der Eingabe wird die Vorschau unmittelbar aktualisiert.
- `Strg`/`Cmd` + `Enter` oder ein Fokusverlust übernimmt den Text.
- `Esc` verwirft alle Änderungen dieser Inline-Bearbeitung und stellt den ursprünglichen Text wieder her.
- Editorhilfen sind nur Teil der Bearbeitungsoberfläche und werden niemals mit dem PNG exportiert.

Der PNG-Export bietet zwei gleichwertige Wege mit identischer Canvas-Renderpipeline:

1. **PNG exportieren:** direkter Browserdownload mit aus dem Entwurfsnamen abgeleitetem Dateinamen.
2. **PNG speichern unter:** nutzt in unterstützten Chromium-basierten Browsern die File System Access API und öffnet einen nativen Dialog zur Auswahl von Speicherort und Dateiname.

Wenn die File System Access API nicht verfügbar ist, zeigt die Anwendung einen verständlichen Hinweis und der direkte PNG-Download bleibt vollständig nutzbar. Bricht der Nutzer den Speichern-unter-Dialog ab, bleibt der Entwurf unverändert und es wird keine Fehlerbenachrichtigung angezeigt.

### 23.16 Ergänzte Akzeptanzkriterien für Text und Export

29. Text kann mehrzeilig im Eigenschaftenpanel eingegeben werden, ohne dass das Textfeld nach einem Zeichen seinen Fokus verliert.
30. Doppelklick und `Enter` aktivieren die direkte Textbearbeitung für ein einzelnes Textobjekt.
31. `Esc` verwirft eine aktive direkte Textbearbeitung; `Strg`/`Cmd` + `Enter` übernimmt sie.
32. Beide PNG-Exportwege erzeugen dieselbe Pixelauflösung und enthalten keine Auswahl- oder Texteingabehilfen.
33. In Chromium/Edge kann der Nutzer über „PNG speichern unter“ Namen und Speicherort wählen; in nicht unterstützten Browsern bleibt der Standarddownload verfügbar.

---

## 24. Ergebnis

Mit dieser Spezifikation entsteht ein lokales, leistungsfähiges Browser-Designwerkzeug mit professioneller Gestaltungsfreiheit. Es unterstützt einfache Labels ebenso wie komplexe Lost-&-Found-Designs mit Texturen, metallischen Rändern, Farbverläufen, Word-Art-ähnlichen Textstilen, frei verschiebbaren Objekten und hochauflösendem PNG-Export.
