# Sessionübergabe: React-PWA, D1-Routing und Access-API-Korrektur

**Datum:** 2026-10-31  
**Status:** `implemented-local`  
**Ersetzt als aktueller TAG-App-Pfad:** `2026-10-31-W3L-ROUTING-PAGES-R2.md` ist für seinen SSR-/öffentlichen-R2-Abschnitt `superseded-local`.

## Architekturkorrektur

- `/tag/*` liefert wieder die React-PWA-Shell über `public/_redirects`; kein Pages-SSR und keine öffentliche direkte R2-Medienroute.
- Der Edge Router prüft weiterhin Tag-ID/Range und fragt dann die minimale D1-Projektion `tag_routing` parametrisiert ab. D1 entscheidet intern/extern, Status, Schutzmodus, Access-Version und Contentrevision, aber enthält keine PINs, Sessions, R2-Keys oder Ownerdaten.
- Ein interner Scan leitet zur React-PWA mit kurzlebigem HMAC-Bootstrap (`mode`, `av`, `rv`, `nonce`, `exp`, `sig`) weiter. Dieser ist nur UI-Hinweis und wird von der App-API erneut validiert.
- Die Application API setzt nach Public- oder PIN-Prüfung eine zufällige `HttpOnly; Secure; SameSite=Strict`-Session. Content liegt privat als revisioniertes R2-JSON und wird ohne gültige Session nicht ausgeliefert.
- PIN-Prüfung verwendet Argon2id mit serverseitigem Pepper, nie D1/R2/Browser. Fünf Fehlversuche pro TAG/Client-Signal sperren für 15 Minuten. Access-Versionwechsel widerrufen Sitzungen zentral.
- Der Media-Signer wird nur per Service Binding angesprochen. Die reale R2-S3-Presigning-Funktion ist bewusst fail-closed, bis W3D serverseitige Signiercredentials bereitstellt.

## Lokale Nachweise

| Bereich | Nachweis |
| --- | --- |
| Router | 73 Tests, einschließlich D1-intern/extern/fail-closed und signiertem Bootstrap |
| TAG-App/API | 11 Tests, einschließlich Public-/PIN-Session, fünf Fehlversuche, 15-Minuten-Sperre, Access-Version-Widerruf, Media-Signer-Grenze und Argon2id-Benchmark |
| Argon2id | lokal 8 MiB/1 Iteration/Parallelität 1: 19,16 ms; kein Staging-Worker-Nachweis |
| TCP | 47 Tests/309 Assertions |
| TCC | 18 Tests |
| Builds | React, Router, App-API-Worker, Media-Signer-Dry-Run, TCC und Production-Router-Dry-Run grün |

## W3D-Blocker

Vor echten Ressourcenmutationen sind mindestens zu bestätigen: D1-Datenbank/Berichte/Query-Plan, private R2-Bucket, App-API-/Media-Signer-Service Binding, `APP_BOOTSTRAP_SECRET_S01`, `APP_PIN_PEPPER_S01`, `APP_MEDIA_SIGNER_KEY_S01`, echte R2-S3-Presigning-Credentials, aktiver Scan-Worker/KV-Namespace, Dogado-/Publisher-Betriebsweg, Rollback und kontrollierter Staging-Testtag. Keine Secretwerte dokumentieren.