# Beispiel: Lost & Found – Reisekoffer

Tag-Typ `lost-found`, Presentation `standard`, `schemaVersion: 3`.

## Was das Beispiel zeigt

- **Fundhinweis** (`finder-notice`) als Einstieg – Kern des Lost-&-Found-Falls.
- **Fundmeldung** (`finder-form`, `channel: server-mediated`) mit Foto-Slot (max. 3).
- **Funddaten als Tabelle** (2 Spalten, Zebra-Zeilen, Rahmen `#c6d4e1`).
- **Datenschutz-Hinweis** (`callout`, `tone: info`): keine Namen/Adressen öffentlich.
- **Kontaktweg** mit `visibility: shared` – nur mit Zugangscode sichtbar.
- Bewusst **ohne** `documents`: der Elementkatalog erlaubt Dokumentenlisten für
  `lost-found` nicht (siehe `ELEMENT_TYPE_NOT_ALLOWED`).

## Daten

`sample.json`: zwei Fotos für die Fundmeldung, keine Dokumente, keine Wartungseinträge.
Die beiden Beiträge sind `pending` (typisch für eine noch nicht geprüfte Fundmeldung).

## Prüfpunkte

1. 360 px: Tabelle bleibt lesbar, Foto-Slot zeigt zwei Bilder.
2. 1280 px: Fundmeldung (8/12) neben Funddaten (4/12).
3. Rollenwechsel: `contact-channel` (`shared`) verschwindet für Scanner.
4. Kein `documents`-Element – Template bleibt für `lost-found` valide.
