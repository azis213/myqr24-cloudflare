# Rückverfolgbarkeit: TAG-App

**Stories:** [`10-USER-STORIES.md`](10-USER-STORIES.md)  
**Testfälle:** [`21-TEST-CASES.md`](21-TEST-CASES.md)  
**Status:** [`STATUS.md`](STATUS.md)

## APP-I01 — Staging-MVP

| Story | Akzeptanzbereich | Testfälle | Testdaten | Code / Konfiguration | Evidenz / Status |
| --- | --- | --- | --- | --- | --- |
| APP-US-001 | öffentliche Route `/tag/{tagId}`, keine Router-Entscheidung im Client | APP-TC-ROUTE-001 | APP-TD-001 | `apps/tag-app/src/main.tsx`, `apps/tag-app/src/App.tsx` | implemented |
| APP-US-002 | direkter Pages-Deep-Link und kontrollierte unbekannte Route | APP-TC-ROUTE-002, APP-TC-ROUTE-003 | APP-TD-004 | `apps/tag-app/public/_redirects`, `apps/tag-app/src/App.tsx` | implemented; Staging-Aufruf gemäß APP-TD-004 |
| APP-US-003 | Adaptergrenze und ID-Normalisierung | APP-TC-ADAPTER-001 | APP-TD-001 | `apps/tag-app/src/services/publicTagViewService.ts` | automatisierter Adaptertest vorhanden |
| APP-US-004 | ungültige/unbekannte IDs ohne Ersatzdaten | APP-TC-ADAPTER-002, APP-TC-ADAPTER-003 | APP-TD-002, APP-TD-003 | `apps/tag-app/src/services/publicTagViewService.ts`, `apps/tag-app/src/App.tsx` | automatisierter Adaptertest vorhanden |
| APP-US-005 | Produktions-Registrierung, Shell-Cache und Cache-Grenzen | APP-TC-PWA-001, APP-TC-PWA-002, APP-TC-PWA-003 | APP-TD-005 | `apps/tag-app/src/main.tsx`, `apps/tag-app/public/service-worker.js`, `apps/tag-app/public/manifest.webmanifest` | implemented; Browser-PWA-Nachweis noch offen |
| APP-US-010 | öffentliche Vault-Ansicht mit Lade-/Fehlerzustand | APP-TC-ADAPTER-001, APP-TC-VAULT-001 | APP-TD-001 | `apps/tag-app/src/App.tsx`, `apps/tag-app/src/features/vault/types.ts` | implemented; Komponenten-Test noch offen |
| APP-US-011 | typisierte und sichere Blockdarstellung | APP-TC-VAULT-002 | APP-TD-001 | `apps/tag-app/src/features/vault/types.ts`, `apps/tag-app/src/App.tsx` | implemented |
| APP-US-013 | externer Link mit `noreferrer` | APP-TC-VAULT-003 | APP-TD-001 | `apps/tag-app/src/App.tsx` | implemented; Komponenten-Test noch offen |

## APP-I01A — Hochzeits-Vault-Demo

| Story | Akzeptanzbereich | Testfälle | Testdaten | Code / Konfiguration | Evidenz / Status |
| --- | --- | --- | --- | --- | --- |
| APP-US-016 | Hochzeit als öffentliche Vault-Ansicht mit Übersicht, Galerie und Dokumenten darstellen | Adaptertest „wedding fixture“; manueller Pages-Deep-Link | `trauung1`, `fest2026`, `menue202` | `apps/tag-app/src/features/vault/types.ts`, `apps/tag-app/src/mocks/publicTagViews.ts`, `apps/tag-app/src/App.tsx` | automatisierter Adaptertest und Produktionsbuild erfolgreich |
| APP-US-017 | Zugangscode-Dialog sowie Gast-/Owner-Einstieg klar als lokale Staging-Demo kennzeichnen | manueller UI-Test, Build | `trauung1` | `apps/tag-app/src/App.tsx`, `apps/tag-app/src/styles.css` | implemented; keine PIN-Prüfung, keine Persistenz und keine fachliche Autorisierung im Client |
| APP-US-018 | serverseitige Gast-/Owner-Sessions, Upload, eigene Löschung und autorisierte Downloads | APP-TC-ACCESS-001 bis APP-TC-ACCESS-005 (geplant) | getrennte private API-Seeds (geplant) | spätere Application API, D1, R2 und Session-Layer | planned; nicht durch die Demo erfüllt |

## APP-I02 — Router→PWA-Integration

| Story | Akzeptanzbereich | Testfälle | Testdaten | Code / Konfiguration | Evidenz / Status |
| --- | --- | --- | --- | --- | --- |
| APP-US-006 | gültiger Staging-Scan leitet über `/t/stagv001` auf dieselbe TAG-ID in der App weiter; Negativfälle bleiben am Router fail-closed | APP-TC-INTEGRATION-001 bis APP-TC-INTEGRATION-003 | APP-TD-006 | aktiver Edge Worker, zugehöriges `TAG_CONFIG`, `apps/tag-app/` | blocked durch APP-BLK-001 |

Die Router-seitige Validierung selbst wird nicht dupliziert. Ihre Stories und Tests befinden sich im [Edge-Router-Strang](../edge-router/30-TRACEABILITY.md).

## APP-I02A — Gemeinsame PWA, Scan und lokale Berechtigungspräferenzen

| Story | Akzeptanzbereich | Testfälle | Testdaten | Geplante Komponenten | Status |
| --- | --- | --- | --- | --- | --- |
| APP-US-060 | Hauptnavigation, öffentlicher TAG-Kontext und kontextgerechte Zurück-Navigation | APP-TC-PERMISSION-001 | APP-TD-007 | PWA-Router, Hauptnavigation, TAG-Kontext | planned |
| APP-US-061 | bewusster Kamerastart, bekannte myQR24-URL-Kandidaten und manueller Fallback | APP-TC-PERMISSION-002, APP-TC-PERMISSION-003 | APP-TD-007 | Scanner-Adapter, URL-Kandidat-Erkennung, manuelle Eingabe | planned |
| APP-US-062 | keine Startdialoge, Kontextdialog, Verweigerungs- und Präferenzverhalten | APP-TC-PERMISSION-002 bis APP-TC-PERMISSION-004 | APP-TD-007, APP-TD-008 | Permission-Adapter, lokale Präferenzverwaltung, Fallback-UI | planned |
| APP-US-063 (lokaler Anteil) | lokales Berechtigungszentrum, Systemstatus und Widerruf | APP-TC-PERMISSION-004 | APP-TD-008 | `/me/privacy-and-permissions`, lokale Präferenzen | planned |
| APP-US-070 | neutrale Startseite ohne Berechtigungsdialoge | APP-TC-HOME-001 | APP-TD-007 | Startseite, Navigation und Offline-Hinweise | planned |
| APP-US-071 | explizite, idempotente und löschbare lokale Collection ohne Berechtigungswirkung | APP-TC-COLLECTION-001, APP-TC-COLLECTION-002 | APP-TD-007 | lokaler Collection-Store, bewusste Hinzufüge-/Löschaktion | planned |
| APP-US-073 (öffentlicher Einstieg) | strikte Public-/PIN-/Closed-Trennung ohne lokale Freigabe | APP-TC-COLLECTION-002, APP-TC-PIN-001, APP-TC-PIN-002 | APP-TD-010 | Runtime-View-Adapter, neutraler PIN-Einstieg, Cache-Guard | planned |

Die PWA implementiert in dieser Iteration weder eine fachliche Berechtigung noch Server-Consent-Persistenz. Kamera- und Browserverhalten bleibt plattformabhängig; die manuelle Eingabe ist deshalb verpflichtender Fallback.

## APP-I03 — Öffentliche Vault-API

| Stories | Akzeptanzbereich | Testfälle | Testdaten | Geplante Komponenten | Status |
| --- | --- | --- | --- | --- | --- |
| APP-US-003, APP-US-014 | API-Adapter, öffentlicher `PublicTagView`, serverseitige Sichtbarkeit | APP-TC-API-001, APP-TC-API-002 | APP-TD-010 | Application API, D1, `PublicTagView`-Contract | planned |
| APP-US-063 (Serveranteil), APP-US-064, APP-US-065 | minimalistische Einwilligungsdaten, Capability-Vertrag, Scan-Speicherpolicy und erneute API-Prüfung | APP-TC-PERMISSION-005 bis APP-TC-PERMISSION-007 | APP-TD-008, APP-TD-009 | Application API, Session-/Policy-Layer, persönliche Views | planned |
| APP-US-012 | öffentliche Medien, Alt-Texte und getrennte Auslieferung | APP-TC-API-004 | APP-TD-010 | API, public/private R2-Auslieferung | planned |
| APP-US-015 | Cache-Policy und Widerruf | APP-TC-API-003 | APP-TD-010 | API-Header, CDN-/Asset-Strategie | planned |
| APP-US-072 | explizite Übernahme lokaler Einträge mit Account-Session und Nutzerisolation | APP-TC-COLLECTION-003 | APP-TD-010 | Collection-Import-API, Account-Session, `no-store`-Guard | planned |
| APP-US-073 (geschützter Content) | serverseitig geprüfter PIN-Flow und neutraler Sichtbarkeitsvertrag | APP-TC-PIN-001, APP-TC-PIN-002 | APP-TD-010 | Runtime-/PIN-API, transientes PIN-Formular, `no-store`-Guard | planned |

## APP-I03A — Öffentlicher TAG-Claim

| Stories | Akzeptanzbereich | Testfälle | Testdaten | Geplante Komponenten | Status |
| --- | --- | --- | --- | --- | --- |
| APP-US-016 | serverseitig gelieferte Claim-Capability, HTTPS-Claim-Request und keine lokale Besitzannahme | APP-TC-CLAIM-001, APP-TC-CLAIM-002, APP-TC-CLAIM-003 | APP-TD-010 | Claim-Formular, PublicTagView-/Capability-Mapper und öffentlicher Control-Plane-Claim-Contract | planned; fachliche Credential-, Lockout-, Policy- und Owner-Entscheidung liegt ausschließlich bei der Control Plane |
| APP-US-017 | neutrale Fehler, Mehrfachklickschutz, Supportverweis und kein dauerhafter Claim-Cache | APP-TC-CLAIM-003, APP-TC-CLAIM-004 | APP-TD-010 | Claim-Result- und Fehlerzustände, datensparsamer Supportverweis | planned; kein Claim-Secret oder interner Claim-Status im Client |

## APP-I04 — Owner und Inhaltsverwaltung

| Stories | Akzeptanzbereich | Testfälle | Testdaten | Geplante Komponenten | Status |
| --- | --- | --- | --- | --- | --- |
| APP-US-020 | Account-Owner- oder separate TAG-Owner-Passphrase-Session, CSRF, Scope und Rate Limits | APP-TC-OWNER-001, APP-TC-OWNER-002, APP-TC-OWNER-006, APP-TC-OWNER-007 | APP-TD-020 | Auth-/Session-API, Owner-Passphrase-Flow, TAG-gebundene Owner-PWA | planned |
| APP-US-021, APP-US-022 | Blockvalidierung, Persistenz und Sichtbarkeit | APP-TC-OWNER-003 | APP-TD-010, APP-TD-020 | Owner-API, D1, Admin-UI | planned |
| APP-US-023 | Upload-Validierung und Medienstatus | APP-TC-OWNER-004 | APP-TD-020 | R2, Upload-API, Queue-Consumer | planned |
| APP-US-024, APP-US-025 | private Freigabe, atomare Nutzung und Audit | APP-TC-OWNER-005 | APP-TD-020 | API, D1, gegebenenfalls Durable Object | planned |
| APP-US-026 | getrennte Owner-/Gastcodes, sichere Rollensessions und sessiongebundene Gastbeiträge | APP-TC-ACCESS-001 bis APP-TC-ACCESS-005 | APP-TD-011, APP-TD-012 | Auth-/Session-API, D1, Owner-/Gast-PWA; externe Staging-Secrets | planned |

## APP-I05 bis APP-I07 — Weitere TAG-Features

| Iteration | Stories | Testfälle | Testdaten | Geplante Komponenten | Status |
| --- | --- | --- | --- | --- | --- |
| APP-I05 | APP-US-030 bis APP-US-035 | APP-TC-CHAT-001 bis APP-TC-CHAT-003 | APP-TD-030 | Lost-&-Found-, Chat-, Moderations- und Session-API | planned |
| APP-I06 | APP-US-040 bis APP-US-044 | APP-TC-GUESTBOOK-001, APP-TC-GUESTBOOK-002 | APP-TD-040 | Guestbook-API, Moderation, Upload-/Queue-Fluss | planned |
| APP-I07 | APP-US-050 bis APP-US-056 | APP-TC-CHECKIN-001 bis APP-TC-CHECKIN-005 | APP-TD-050 | Check-in-API, GeoFence, Offline-Queue, Collections, Campaigns | planned |

## Pflege- und Verifikationsregel

1. Vor Implementierung wird jede neue Story mit mindestens einem Testfall und einer Testdaten-ID in diese Matrix aufgenommen.
2. Nach Codeänderung werden konkrete Quellpfade ergänzt.
3. Nach erfolgreicher Testausführung werden Nachweise nach [`../evidence/README.md`](../evidence/README.md) referenziert.
4. `verified` darf nur gesetzt werden, wenn die in der Teststrategie geforderten automatisierten, Build- und gegebenenfalls Staging-Nachweise vorliegen.
