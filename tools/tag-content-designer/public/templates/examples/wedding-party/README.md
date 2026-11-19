# Beispiel: Hochzeit – Abendparty

Tag-Typ `event`, Presentation `wedding`, `schemaVersion: 3`, **dunkles Theme** (`colorMode: dark`).

## Was das Beispiel zeigt

- **Hero mit Cover-Slot** (Bindung `title → tag.displayName`).
- **Hinweis** (`callout`, `tone: notice`) im 6/6-Raster neben der Getränkekarte.
- **Getränkekarte als Tabelle** (3 Spalten, rechtsbündige Preise, Rahmen `#4a3b5e`).
- **Galerie** ohne Upload (`upload.enabled: false`), nur Download.
- **Dokumente** (`shared`) neben einem **externen Link** (Playlist, 8/4).
- `divider` als Abschluss.

## Daten

`sample.json`: drei Partyfotos, ein Ablaufplan-Dokument, keine Galeriebeiträge.
Der externe Link nutzt `copy.label`/`copy.url` (`https://example.org/playlist`).

## Prüfpunkte

1. Dark-Theme: Text bleibt lesbar, Tabellenkopf hebt sich ab.
2. 1280 px: 2 Spalten – Hinweis + Karte nebeneinander, Dokumente + Link nebeneinander.
3. Scanner-Rolle: Dokumente (`shared`) nicht sichtbar, Galerie und Link schon.
4. `download` nur bei Galerie-Dokumenten, kein Upload-Knopf.
