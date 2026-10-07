# Testevidenz – myQR24 TAG-Generator

**Stand:** 2026-10-07  
**Projekt:** `tools/tag-gen/`  
**Ausführungsumgebung:** Windows 11, Node.js / npm, Vite 7.3.6, Vitest 3.2.7

## Automatisierte Tests

| Zeitpunkt | Befehl | Ergebnis | Nachweis |
| --- | --- | --- | --- |
| 2026-10-07 17:48 CEST | `cd tools\tag-gen && npm test` | Bestanden | 2 Testdateien, 11 Tests bestanden, Dauer 554 ms |

Abgedeckte Themen:

- HTTPS- und Base45-kompatible Basis-URLs inklusive Normalisierung.
- BigInt-Bereiche, 6-/8-stellige kanonische Grenzen, 16er-Ausrichtung und Überlappungen.
- A4-Raster, Elementgrenzen und QR-/Text-Kollisionen.
- Paginierung mit Startposition auf einem vorgedruckten Bogen.
- Direkte Generierung via Edge-Router-Codec für 6- und 8-stellige TAGs.
- Fortschrittsmeldung sowie TAG-Listen-Import/-Export ohne Secrets.
- Erkennung doppelter TAG-IDs und Konfigurationsformat.

## Build und Typprüfung

| Zeitpunkt | Befehl | Ergebnis | Nachweis |
| --- | --- | --- | --- |
| 2026-10-07 17:49 CEST | `cd tools\tag-gen && npm run build` | Bestanden | `tsc --noEmit` ohne Fehler, anschließend Vite-Produktionsbuild in 478 ms |

Erzeugte Artefakte:

- `dist/index.html` – 0,54 kB
- `dist/assets/index-C4w-fhex.css` – 7,42 kB (gzip 2,54 kB)
- `dist/assets/index-DwKbBwQK.js` – 56,39 kB (gzip 20,18 kB)

## Manuelle Browserabnahme

| Zeitpunkt | Ablauf | Ergebnis |
| --- | --- | --- |
| 2026-10-07 17:52–17:53 CEST | Vite-App unter `http://127.0.0.1:5173/` geöffnet; Navigation, Sicherheitsdarstellung und Import-/Exportansicht geprüft | Bestanden: Anwendung rendert, Laufzeitsecrets sind Passwortfelder; Import-/Exportansicht erläutert den Ausschluss von Geheimnissen |
| 2026-10-07 17:52–17:53 CEST | 6-stelligen Bereich `60.466.176` bis `60.466.176` mit temporärem Feistel-Testsecret angelegt und generiert | Bestanden: Bereich wurde als 1 TAG validiert; öffentliche ID `wujbeb`, Ziel-URL `https://s.myqr24.com/t/wujbeb` und QR-SVG wurden dargestellt |
| 2026-10-07 17:53 CEST | Druckvorschau für den erzeugten TAG geöffnet | Bestanden: eine A4-Seite mit Raster, QR-Code und TAG-ID in der ersten Zelle gerendert; Startzeile und Startspalte sind steuerbar, native Browser-Route „Als PDF speichern“ ist verfügbar |

## Testsecrets

Die automatisierten Tests verwenden ausschließlich die fest codierten Teststrings `tag-generator-test-feistel-secret` und `tag-generator-test-hmac-secret`. Diese besitzen keine Produktivbedeutung und werden nicht als JSON-Testdaten exportiert.
