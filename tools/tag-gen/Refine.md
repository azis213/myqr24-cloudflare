Ich möchte nun eine TAG-APP im Ordner tools\tag-gen erstellen, die als Tool für die Erstellung und Druck von QR-TAGs dienen soll.

## Range Definition

1. Es soll eine Übersichtliche Desktop App werden
2. In einer ersten Ansicht möchte ich eine oder mehrere Ranges für die zu erstellenden Tags definieren können. Die Ranges mit den ID bereichen werden in einer Tabelle angezeigt.
3. Eine Range wird als von Bis Wert mit BigIntegers definiert. Keine Kommazahlen, sondern nur Integer, die als Text mit 1000er Trennpunkten eingegeben werden.
4. Pro Range möchte ich einen kleinen Text angeben können, der mit auf das TAG gedruckt werden soll.
5. Für alle TAGs möchte ich eine Basis URL angeben können, Z.B. HTTPS://S.MYQR24.COM/T/
6. URL  dürfen nur BASE45 Zeichen verwenden.
7. Alle Ranges sollen in einer Tabelle angezeigt werden und es können beliebige Ranges hinzugefügt werden mit Range -Name, Von, Bis Werte und einen Textt. Die BASIS URL gilt für alle Ranges.
8. Die Ranges können frei gewählt werden.
9. TAG-Generierung. Über einen Button sollen die zusätzlichen Informationen zu einem TAG generiert werden. Dazu wird noch ein FEISTEL Secret definiert und ein HMAC Secret wird auch noch auf der gleichen Ansicht definiert.
10. Für jede TAG-ID aus einem Bereich soll eine TAG-ID erzeugt werden. Die TAG-ID Liste soll beim Erstellen auf einer weiteren Ansicht angezeigt werden

## TAG Gennerierung

1. In einer weiteren Ansicht sollen die aus den Bereichen generierten TAGs angezeigt werden können.
2. Für die FEISTEL und HMAC Berechnungen nutze bitte den gleichen Algorithmus mit gleichem Verhalten für die FEISTEL Codierung wie in der edge router APP im Ordner apps\edge-router.

## Ettiketten Design

1. In einer weiteren Ansicht möchte ich die Ettikettenvorlage und das Einzelettiket definieren können.
2. Für ein einzelnes Ettiket soll die Poistion des QR-Codes als verscheibares Quadrad und in der größe mit Resize veränderbar sein. Auch ein Textfeld möchte ich auf einem Ettiket festlegen können.
3. Die Ettikettengröße soll in Höhe und Breite in mm Angegeben werden können.
4. Die Anordnung der Ettiketten auf einer Seite soll Definierbar sein. Z.B. linker Rand, Abstand der Ettiketten in der Horizontalen, Oberer Rand plus Abstand der Ettiketen in der Vertikalen, Zusätzlich wird die Spalten und Zeilenanzahl der Ettiketten definiert.
5. Eine solche Spezifikation soll unter einem Namen gespeichert werden können und als Vorlage wieder verwendet werden können.
6. Als Baisgröße wird eine DIN A4 Seite vorgesehen
7. Es soll ein Preview der Vorlage möglich sein mit Randanzeige für die Ettiketten.
8. Die QR-TAG position soll per DRAG&Drop feslegbar sein. Auch das Textfeld soll in der Größe veränderbar sein und auch mit Drag&Drop positionierbar sein.
9. Die Position beider Bereiche und Größe wird auch in Editierbaren Feldern mit angezeigt.

## Ettiketten Druck

1. Für den Ettiketten druck soll es eine weitere Ansicht geben. Hier soll eine Vorlage ausgewählt werden können, die vorher definiert wurde.
2. Die Vorlage wird mit allen QR-Codes und Labels aus der Rangedefinition von links nach recht und von oben nach unten für alle Werte pro Seite befüllt. Sind mehrere Seiten notwendig, dann sollen mehrere Seiten angezeigt werden. Es soll auch die Startpoistion für das erste Ettiket festlegbar sein. Z.B. erste Labe ab Zeile 5 und Spalte 3 einfügen. Damit auch ein Druck von bereits zum teil genutzer Ettiketen-Papiere möglich ist.
3. Der Druck soll als Vorschau und PDF anzeigbar sein. Das PDF soll heruntergeladen werden können und als PDF für den Druck dienen. Eine Druck-Funktion muss erst mal nicht definiert werden, wobei ein Druck nein PDF erzeugt.

## Ergänzungen.

1. Werte die TAG-Gen APP noch durch weitere Sinnvolle Ergänzungen und Views auf, falls dies für diesen Zweck geeignet ist.
2. Überlege, wie das Ettiketten Design mit QR-Code Positionierung und Text-Positionierung Optimal umgesetzt werden kann.
3. Alle eingegebenen Daten können in einer Konfig mit Speichern gespeichert werden.
4. Zusätzlich kann die erzeugte TAG-Liste für die jeweiligen Bereiche auch in einer JSON-Datei gespeichert werden oder Exportiert werden.
5. Es soll auch möglich sein eine Konfiguration zu importieren.
6. Genauso soll es auch möglich sein eine Exportierte TAG-Liste zusammenmit den Bereichsinformationen zu Importieren.
7. Für die FEISTEL und HMAC Berechnungen nutze bitte den gleichen Algorithmus mit gleichem Verhalten für die FEISTEL Codierung wie in der edge router APP im Ordner apps\edge-router.

## Zusatz – Offsetbereiche, lesbare TAG-ID und Feinbedienung

1. Ein Bereich kann alternativ zu absoluten kanonischen Werten als **Offsetbereich** definiert werden. `Von-Offset` und `Bis-Offset` werden relativ zur Untergrenze des gewählten Base36-Zahlenraums angegeben.
2. Die Untergrenze lautet bei 6 Stellen `36^5` (größter fünfstelliger Base36-Wert plus eins) und bei 8 Stellen `36^7` (größter siebenstelliger Base36-Wert plus eins). Der tatsächliche Wert wird als `Untergrenze + Offset` berechnet.
3. Bei 8-stelligen TAGs repräsentiert jeder Offset einen 16-ausgerichteten Basiswert. Daher werden die Offsets als Slots geführt und zur Berechnung mit 16 multipliziert: `Untergrenze + Offset × 16`.
4. Bei Auswahl der TAG-Länge zeigt die Oberfläche die Untergrenze, die maximale zulässige Zahl und die Größe des verfügbaren Zahlenraums an. Bei Offseteingabe zeigt sie zusätzlich die berechneten absoluten Von-/Bis-Werte an.
5. Die Etikettenvorlage enthält neben dem bestehenden freien Bereichstext ein zweites, fest definiertes Textfeld für die gut lesbare öffentliche TAG-ID. Dieses Feld ist unabhängig positionier- und skalierbar und wird auf der Druckvorschau mit der jeweiligen öffentlichen TAG-ID befüllt.
6. Für alle Zahlenfelder des Etikettenlayouts, insbesondere X/Y/ Breite/Höhe von QR-Code und beiden Textfeldern sowie Raster- und Seitenmaßen, stehen kleine Minus- und Plus-Schaltflächen bereit. Die Schritte sind fachlich sinnvoll (für Millimeter typischerweise 0,1 mm; für Zeilen und Spalten 1).
7. Der Spezifikationsbaum führt den Testordner `tools/tag-gen/test/` einschließlich Testdaten, Testfällen und Evidenz auf.

## Zusatz – Lokalisierung, Seitenkopf/-fuß, Secrets und QR-Einzelansicht

1. Die zusätzlichen Minus-/Plus-Schaltflächen an Zahlenfeldern werden entfernt. Die nativen Pfeile (`type="number"`) des Browsers sind die einzige Schrittbedienung.
2. Auf der Ansicht „Bereiche & Generierung“ kann zwischen Eingabeformat **DE** und **EN** gewählt werden. Der Umschalter bestimmt die Dezimaltrennzeichen für alle Layout- und Seitenmaße:
   - DE: Komma als Dezimaltrennzeichen (`63,5`), Punkt/Leerzeichen als Tausendertrennung in Ganzzahlfeldern.
   - EN: Punkt als Dezimaltrennzeichen (`63.5`), Komma/Leerzeichen als Tausendertrennung in Ganzzahlfeldern.
   - TAG-Bereichswerte und Offsets bleiben stets ganzzahlig; Nachkommastellen sind dort verboten.
3. Eine Etikettenvorlage kann auf jeder A4-Seite einen optionalen Seitenkopf und eine optionale Seitenfußzeile ausgeben. Beide Texte sind unabhängig vom einzelnen Etikett und werden einmal je Druckseite gerendert.
4. Für Kopf und Fuß sind jeweils Text, linke Position, Breite und Höhe in Millimetern einstellbar. Der Kopf besitzt zusätzlich einen Abstand vom oberen Seitenrand; der Fuß besitzt einen Abstand vom unteren Seitenrand. Die vertikale Position des Fußes wird daraus abgeleitet.
5. Kopf- und Fußbereiche werden auf A4 begrenzt und dürfen den Etikettenrasterbereich nicht überlappen. Alle Werte dürfen als Dezimalzahlen im gewählten Eingabeformat eingegeben werden.
6. Feistel- und HMAC-Secrets werden beim lokalen Start aus `tools/.env.local` mit den Variablen `FEISTEL_SECRET_S01` und `TAG_HMAC_SECRET_S01` vorbelegt. Sie bleiben Passwortfelder, werden nicht persistiert oder exportiert und können mit einem Augensymbol temporär sichtbar gemacht werden. Ein in den Browser eingebetteter lokaler Build ist ausschließlich für vertrauenswürdige lokale Nutzung vorgesehen.
7. In „Generierte TAGs“ kann ein Eintrag der Liste ausgewählt werden. Die QR-Einzelvorschau zeigt immer den gewählten TAG samt URL und Bereichstext.
8. Vor einer Generierung wird ausgewählt, wie die öffentliche TAG-ID in die QR-URL eingesetzt wird:
   - **Base36/Base45 – Großschreibung:** gesamte QR-Nutzlast-URL wird in Großbuchstaben eingesetzt, damit alle Buchstaben der Nutzlast Base45-konform sind.
   - **Binär-Codec – Kleinschreibung:** Basis-URL und öffentliche ID werden klein geschrieben eingesetzt.
     Der gewählte Modus wird mit der Konfiguration und der erzeugten TAG-Liste gespeichert, damit QR-Nutzlasten nachvollziehbar bleiben.

## Zusatz – Dateien, QR-Profile und Bereichsversionen

1. Konfigurationen werden über eine ausgewählte JSON-Datei exportiert und aus einer vom Benutzer ausgewählten JSON-Datei importiert. Der bestehende lokale Browser-Speicher bleibt eine zusätzliche Komfortfunktion, ersetzt aber nicht den Dateidialog.
2. Etikettenvorlagen können unabhängig von der Gesamtkonfiguration als einzelne JSON-Datei exportiert und aus einer Datei importiert werden. Der Vorlagenimport validiert das A4-Raster, Kopf/Fuß und alle Etikettenelemente vor der Übernahme.
3. Eine QR-Konfiguration umfasst mindestens die QR-Code-Version (`auto` oder Version `1..40`), Fehlerkorrektur (`L`, `M`, `Q`, `H`) und die Quiet Zone in Modulen.
4. Die globale QR-Konfiguration ist die Voreinstellung für neue Bereiche. Jede Range speichert ein vollständiges QR-Profil und kann daher abweichende Version, Fehlertoleranz und Quiet Zone besitzen.
5. Die QR-Generierung, Einzelvorschau, Druckvorschau und PDF-Ausgabe verwenden immer das QR-Profil der jeweiligen Range. Erzwungene QR-Versionen werden vor dem Generieren validiert; ist die Nutzlast zu groß, wird ein verständlicher Fehler ausgegeben.
6. Ein Klick auf eine Range in der Tabelle lädt deren Werte in den Bereichseditor. „Bereich hinzufügen“ speichert anschließend bewusst eine neue Range mit neuer ID, neuem Zeitstempel und fortlaufender Versionsbezeichnung; die bestehende Range bleibt unverändert erhalten.
7. Eine Versionsbezeichnung folgt dem Muster `Name – Version N`; die erste Kopie erhält `Version 2`, weitere Kopien erhöhen die größte vorhandene Version desselben Basisnamens.

## Zusatz – Direkte PDF-Vorschau vor dem Download

1. In der Ansicht „Druckvorschau & PDF“ gibt es zusätzlich zur Download-Aktion eine Schaltfläche **„PDF-Vorschau öffnen“**.
2. Die Anwendung erzeugt dafür aus dem aktuellen Druckauftrag dieselbe maßhaltige DIN-A4-PDF wie für den Download, öffnet sie jedoch zunächst als lokale Browser-PDF-Vorschau in einem neuen Tab oder Fenster.
3. Die PDF-Vorschau wird ausschließlich aus einem temporären Browser-`Blob` erzeugt. Es werden weder Daten noch Geheimnisse hochgeladen oder per Netzwerk übertragen.
4. Die Vorschau berücksichtigt immer die aktuell ausgewählte Vorlage, TAG-Liste, Startzeile und Startspalte einschließlich Kopf-/Fußtexten und QR-Profilen.
5. Der Download bleibt eine getrennte, explizite Benutzeraktion. Aus der Browser-PDF-Vorschau kann der Benutzer außerdem die Funktionen des integrierten PDF-Viewers verwenden, beispielsweise Speichern oder Drucken.
6. Falls der Browser das Öffnen eines neuen Tabs oder Fensters blockiert, meldet die Anwendung dies verständlich und bietet weiterhin den regulären PDF-Download an

## Zusatz – Erweiterte Etikettengestaltung

1. Beide Textfelder des Einzeletiketts (freier Bereichstext und lesbare TAG-ID) erhalten unabhängig voneinander Einstellungen für horizontale Ausrichtung (`links`, `zentriert`, `rechts`), vertikale Ausrichtung (`oben`, `mittig`, `unten`) und Sichtbarkeit. Ein ausgeblendetes Textfeld wird weder in der Etiketten- noch in der Druck-/PDF-Vorschau ausgegeben.
2. Jedes Textfeld erhält optional eine Hintergrundfarbe mit frei wählbarem Hex-Farbwert und Transparenz. Die Hintergrundfarbe kann mit einer Checkbox vollständig ausgeschaltet werden.
3. Für die gesamte Etikettenfläche kann eine frei wählbare Hintergrundfarbe festgelegt werden.
4. Eine Vorlage kann ein optionales lokales Hintergrundbild enthalten. Für das Bild sind Sichtbarkeit, X-/Y-Position, Breite, Höhe und Blässe/Deckkraft einstellbar. Das Bild darf hinter QR-Code und Textfeldern liegen.
5. Hintergrundbilder werden ausschließlich aus einer vom Benutzer ausgewählten lokalen Bilddatei übernommen. Die Bilddaten werden als Teil der Vorlage lokal gespeichert bzw. exportiert; es gibt keine Bild-URLs und keine Netzwerkübertragung.
6. Für den QR-Code sind Randbreite und Randfarbe konfigurierbar. Die Randfarbe wird auch in Browser- und PDF-Ausgabe identisch angewendet.
7. Farbeingaben bestehen jeweils aus einem klickbaren nativen Farbfeld und einem editierbaren Hex-Farbwert. Bei ungültigem Hex-Wert wird der zuletzt gültige Wert beibehalten und ein verständlicher Hinweis angezeigt.
8. Der Einzeletikett-Editor besitzt eine Zoom-Funktion von 75 % bis 400 %, damit QR-Code, Textfelder und Hintergrundbild für die Positionierung vergrößert oder verkleinert dargestellt werden können. Zoom verändert niemals die gespeicherten Millimeterwerte oder die PDF-Maße.
9. Die Designvorschau steht im Einzeletikett-Editor oberhalb der Konfigurationsfelder. Bei hohen Zoomstufen bleibt sie in einem eigenen Scrollbereich vollständig erreichbar.
10. Die Konfigurationsblöcke für QR-Code, Hintergrundbild, freies Textfeld und lesbare TAG-ID stehen bei ausreichend breitem Fenster nebeneinander. Bei abnehmender Breite ordnen sie sich responsiv untereinander an.
11. Alle neuen Designwerte werden mit der Etikettenvorlage gespeichert, beim Vorlagenexport mitgegeben und in der Browser-Druckvorschau, PDF-Vorschau sowie heruntergeladenen PDF gleich umgesetzt.

## Zusatz – Technische Modulgrenze Etiketten-Designer

1. Die Ansicht „Etikettenvorlagen“ wird als eigenständiges, flaches Frontend-Modul in `src/label-designer.ts` umgesetzt.
2. Das Feature verantwortet ausschließlich die Vorlagenbearbeitung: A4-Rasterformular, Einzeletikett-Editor, Zoom, Drag-Interaktion, Designfelder sowie Vorlagenimport/-export.
3. `src/main.ts` bleibt der schlanke Application Host. Er besitzt den globalen Anwendungszustand, Navigation, Shell, Speicher-/Datei-Utilities, TAG-Generierung, Druckauftrag und die viewübergreifende Auswahl der aktiven Vorlage.
4. Der Host übergibt dem Feature nur einen expliziten UI-Kontext (Konfiguration, TAG-Vorschauwerte, Shell-Renderer und lokale Datei-/Download-Adapter). Das Feature führt weder globale Navigation noch Persistenz von Geheimnissen ein.
5. Gemeinsame, reine Darstellungslogik für Textfelder wird aus dem Feature exportiert und von der Druckvorschau verwendet, damit Editor und Vorschau die gleichen Schrift-, Ausrichtungs- und Hintergrundwerte interpretieren.
6. Das Domainmodell, seine Validierung und die PDF-Erzeugung bleiben eigenständige, UI-unabhängige Module. Dadurch bleiben Layout- und Exportregeln testbar, ohne die Vorlagenansicht zu rendern.
