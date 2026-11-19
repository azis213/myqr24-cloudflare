# Beispiel: Hochzeit – Gartenfeier

Tag-Typ `event`, Presentation `wedding`, `schemaVersion: 3`.

## Was das Beispiel zeigt

- **Hero mit Cover-Slot** und Bindung `title → tag.displayName`.
- **Willkommen** mit Überschrift (H2), Fett/Kursiv und Element-Hintergrund.
- **Einzelbild** neben dem Text (8/4 im 12er-Raster).
- **Ablauf** und **Speisekarte** als Tabellen im Textfeld (je eine Tabelle, Kopfzeile,
  Rahmen bzw. Zebra-Hintergründe) – ohne eigenes Element-Typ.
- **Galerie** mit Gäste-Uploads (`upload: guest, owner`, `afterUpload: quarantine`)
  und Löschen nur für eigene Beiträge (`guestScope: ownOnly`).
- **Dokumente** mit `visibility: shared` – nur für Gast/Owner, nicht für Scanner.
- Ein **Textblock** mit den Ansprechpartnern (kein `contact-channel`: für `event`
  ist dieses Element laut Katalog nicht zulässig) und ein `divider` als Abschluss.

## Daten

`sample.json` (nicht Teil des Templates) liefert die Testmedien und -dokumente:
fünf Bilder aus `../assets/`, zwei Dokumente, drei Galeriebeiträge (davon einer
`pending`). `slotFill` verbindet Element-ID und Slot-ID mit Content-IDs.

## Prüfpunkte

1. Vorschau 360 px: eine Spalte, Tabellen scrollen nicht seitlich.
2. Vorschau 1280 px: 3 Spalten – Text/Bild als 2+1, Galerie/Dokumente als 2+1.
3. Rollenwechsel: `shared`-Dokumente verschwinden für **Scanner**, bleiben für Gast/Owner.
4. Beispieldaten aus → Platzhalter wie ohne Beispiel.
