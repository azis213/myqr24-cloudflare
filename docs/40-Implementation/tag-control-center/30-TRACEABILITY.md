# Rückverfolgbarkeit: TAG Control Center

**Letzte Aktualisierung:** 2026-10-29  
**Status:** In Arbeit. Die TCC-Shell implementiert Login, serverseitigen Session-Status, E-Mail-MFA, Logout sowie den lokalen W2L-Slice für sichtbare Pools, explizite Re-Authentisierung, TCP-bestätigte synthetische Reservierung und Range-/Pool-Patch-Formulare. `npm run test:tcc` (11 Tests) und `npm run build:tcc` sind am 2026-10-31 erfolgreich. Die TCP-MySQL-Integration muss nach Wiederherstellung von Docker Desktop Linux erneut laufen. Lifecycle, echter Internal-Codec und produktive Staging-Nachweise bleiben geplant.

## 1. Verweisregeln

| Spalte | Bedeutung |
| --- | --- |
| Story | fachlicher Bedarf aus [10-USER-STORIES.md](10-USER-STORIES.md) |
| Arbeitspaket | Umsetzungsrahmen aus [STATUS.md](STATUS.md) |
| Tests | künftige Nachweise aus [21-TEST-CASES.md](21-TEST-CASES.md) |
| Testdaten | zulässige Datenklasse aus [22-TEST-DATA.md](22-TEST-DATA.md) |
| Geplante Implementierung | Zielmodul bzw. Verantwortungsbereich; derzeit bewusst nicht vorhanden |
| Erforderliche Evidenz | Voraussetzung für `verified` |

Ein Eintrag unter „Geplante Implementierung“ ist ausdrücklich **kein** vorhandener Code. Konkrete Datei- und Modulpfade werden erst bei Beginn der jeweiligen Umsetzung ergänzt.

## 2. Traceability-Matrix

| Story | Arbeitspaket | Tests | Testdaten | Implementierung | Erforderliche Evidenz | Status |
| --- | --- | --- | --- | --- | --- | --- |
| TCC-Shell und lokaler W2L-Verwaltungsslice | CC-WP-01, CC-WP-04, CC-WP-05 | `CC-TC-AUTH-001` bis `CC-TC-AUTH-006`, `CC-TC-RANGE-001`, `CC-TC-POOL-001`, `CC-TC-ALLOC-006` bis `CC-TC-ALLOC-008`; `apps/tag-control-center/src/App.test.tsx` / `npm run test:tcc` erfolgreich am 2026-10-29 (10 Tests); `npm run build:tcc` erfolgreich; `npm run local:test` erfolgreich (17 Tests, 109 Assertions) | keine | `apps/tag-control-center/src/App.tsx`, `main.tsx`, `styles.css`; Testumgebung in `vitest.config.ts` und `src/test/setup.ts`; Login-/MFA-/Session-/Logout-/Readiness-UI sowie platformweite Range-/Pool-Anlage, Re-Auth und Reservierung nach [`control-plane-admin-api-v1`](../../10-Architecture/35-Contracts/control-plane-admin-api-v1.md) und [`control-plane-tag-management-api-v1`](../../10-Architecture/35-Contracts/control-plane-tag-management-api-v1.md). `vite.config.ts` leitet im lokalen Betrieb `/tcp` same-origin an TCP weiter. | TCC-Contract-UI-Suite, Produktionsbuild, TCP-Featuretests und kontrollierter lokaler TCC-Readiness-/Negativlogin-Smoke-Test; keine browserseitigen Secrets; finale HTTPS-/Cookie-/Origin-Policy und Staging bleiben offen | in-progress |
| CC-US-001 sicherer Admin-Zugang | CC-WP-01, CC-WP-02 | `CC-TC-AUTH-001` bis `CC-TC-AUTH-006`; `apps/tag-control-center/src/App.test.tsx`; `apps/tag-control-plane/tests/Feature/AuthenticationFlowTest.php`; `npm run test:tcc`; `npm run local:test`; `npm run build:tcc` | CC-TD-001, CC-TD-010 | TCC: `apps/tag-control-center/src/App.tsx` fordert CSRF-Token an und verwendet ausschließlich die versionierten TCP-Endpunkte für Login, E-Mail-MFA, Session-Status und Logout. TCP: serverseitige Web-Session, Rate Limits, Audit und Bootstrap-Admin; `ApiAuthenticationController` normalisiert syntaktisch ungültige und unbekannte Login-Fehler gleich. Recovery, Passkey/TOTP und produktive Mail-Evidenz fehlen. | automatisierte TCC-Contract-UI-Suite (10 Tests), TCP-MySQL-Auth-/Session-/W2L-Tests (17 Tests/109 Assertions), TCC-Build und lokaler Smoke-Test liegen vor; Security-Review, Staging-Mailtransport, Ziel-MFA-/Recovery-Verfahren sowie finale Cookie-/Origin-Policy offen | implemented |
| CC-US-002 Rollen serverseitig durchsetzen | CC-WP-02 | CC-TC-AUTHZ-001 bis 002 | CC-TD-001, CC-TD-008 | RBAC-/Policy-Modul und serverseitige Request-Guards | Rollenmatrix, negative AuthZ-Tests | planned |
| CC-US-003 Audit | CC-WP-02, CC-WP-03 | CC-TC-AUDIT-001 bis 002 | CC-TD-010 | Audit-Service, append-only Speicherstrategie, Audit-Ansicht | Audit-/Sanitizingtests | planned |
| CC-US-004 Desktop-/Mobile-Verwaltungs-UX | CC-WP-01, CC-WP-05A | CC-TC-UX-001 bis 004 | CC-TD-001, CC-TD-010, CC-TD-011 | responsive desktop-first Verwaltungsoberfläche und mobile Support-Ansichten | Desktop-/Mobile-E2E, Touch-/Tastatur- und Re-Auth-Nachweis | planned |
| CC-US-010 TAG-Entwurf | CC-WP-03, CC-WP-05 | CC-TC-LIFECYCLE-001 bis 002 | CC-TD-003, CC-TD-008 | TAG-Stammdaten, Statusautomat, Verwaltungsformulare | Migration, Status- und Audit-Tests | planned |
| CC-US-011 TAG-ID vergeben | CC-WP-05 | `CC-TC-ALLOC-001` bis `CC-TC-ALLOC-008`; `apps/tag-control-center/src/App.test.tsx`; `apps/tag-control-plane/tests/Feature/TagManagementFlowTest.php`; `npm run test:tcc`; `npm run local:test` | CC-TD-002, CC-TD-003 | TCC: `App.tsx` wählt einen TCP-sichtbaren Pool, fordert Re-Auth und CSRF an, erzeugt pro Browserrequest einen Idempotency-Key und zeigt nur bestätigte Job-/Mengeninformation. TCP: `TagManagementController`, `TagAllocationService`, `TagCodecClient` und lokaler `FakeTagCodecClient` mit `TEST-S01`; keine Feistel-Secrets im Browser oder TCP. | TCC-Contract-UI-Suite (8 Tests), TCP-MySQL-Suite (14 Tests/88 Assertions), Build und späterer Internal-Codec-/Staging-Nachweis; Lifecycle bleibt offen | in-progress |
| CC-US-012 Ranges/Gruppen/Zuweisungen | CC-WP-04 | `CC-TC-RANGE-001` bis `CC-TC-RANGE-004`; `apps/tag-control-center/src/App.test.tsx`; `apps/tag-control-plane/tests/Feature/RangeAndPoolManagementTest.php` | CC-TD-002, CC-TD-004 | TCC zeigt dem `platform-admin` nach frischer Re-Auth eine Range-Anlage; TCP prüft kanonische 6-/8-/10-Domänen, Dezimalform und globale Nichtüberlappung. Update-, Gruppen- und Feature-Verwaltung fehlen | UI-, Schema- und Negativtests; Update-/Gruppen-/Feature-Validatoren bleiben offen | in-progress |
| CC-US-015 Allocation Pools | CC-WP-04 | `CC-TC-POOL-001` bis `CC-TC-POOL-004`; `apps/tag-control-center/src/App.test.tsx`; `apps/tag-control-plane/tests/Feature/RangeAndPoolManagementTest.php` | CC-TD-002, CC-TD-011 | TCC lädt TCP-Ranges und lässt nach Re-Auth ausschließlich die Auswahl aktiver Ranges derselben Länge für die Plattformpool-Anlage zu; TCP bleibt autoritativ für Referenz-, Längen- und Organisationsprüfung. | Pool-Sicht-, Organisationsgrenzen- und Leak-Contracttests; Updates, Organisationspools und Policy-/Feature-Verwaltung bleiben offen | in-progress |
| CC-US-016 Claim-/Vorabzuweisungsstrategie | CC-WP-05A, CC-WP-06 | CC-TC-CLAIM-001 bis 005, CC-TC-PREASSIGN-001 bis 002 | CC-TD-011 | Strategieauswahl, Exportfreigabe- und Support-UX mit Control-Plane-Contract-Adapter | Policy-Auswahl, Exportfreigabe, Support- und Browser-Leak-Tests | planned |
| CC-US-017 manueller Support-Claim | CC-WP-05A | CC-TC-SUPPORT-CLAIM-001 bis 005 | CC-TD-011 | TAG-ID-/Scan-Eingabe, Secret-Formular und datensparsame Support-Result-Ansicht mit gemeinsamem Claim-Contract-Adapter | Contract-, Mobile-E2E-, Re-Auth-, Audit- und Browser-Leak-Tests | planned |
| CC-US-013 Lebenszyklus/Sperrung | CC-WP-05, CC-WP-09 | CC-TC-LIFECYCLE-001 bis 002, CC-TC-UNPUBLISH-001 bis 002 | CC-TD-003, CC-TD-010 | Statusautomat, Unpublish-Planer, Audit | Status- und Staging-Unpublish-Nachweis | planned |
| CC-US-014 Scan-URL-/QR-Daten | CC-WP-06 | CC-TC-PRINT-001 bis 002 | CC-TD-003, CC-TD-011 | Scan-URL-/QR-Vorschau ohne Export-, PDF- oder Druckfunktion | URL-Kanonisierung, Staging-Markierung und UI-Leak-Prüfung | planned |
| Kontrollierter TCC-/TCP-Druckexport (zurückgestellt) | CC-WP-16 | künftig eigenständige Export-, Snapshot-, AuthZ-, Datenminimierungs- und Audit-Tests | ausschließlich synthetische Reservierungs-, Range- und Exportdaten | autorisierter Export-Contract-Adapter; keine PDF-/Label-Aufbereitung, Druckeransteuerung oder physische Ausgabe | Freigabe-, Unveränderlichkeits-, Ablauf-, Prüfsummen- und Datenminimierungsnachweis | deferred |
| CC-US-020 Routing-Features | CC-WP-04, CC-WP-07 | CC-TC-FEATURE-001 bis 003 | CC-TD-004 | Feature-Schemas und Konfigurationsservice | Schema-/Leak-/Negativtests | planned |
| CC-US-021 Projektion prüfen | CC-WP-07, CC-WP-09 | CC-TC-PROJECTION-001 bis 003 | CC-TD-004, CC-TD-010 | Projektionsgenerator, Validator und Diff-Ansicht | Contract- und Diff-Nachweis | planned |
| CC-US-022 nach KV publizieren | CC-WP-08, CC-WP-09 | CC-TC-PUBLISH-001 bis 005 | CC-TD-005, CC-TD-010 | DB-Outbox, Publisher-Worker, Cloudflare-Adapter | Transaktions-, Retry- und isolierter Staging-Publish | planned |
| CC-US-023 Routing entfernen/neutralisieren | CC-WP-08, CC-WP-09 | CC-TC-UNPUBLISH-001 bis 002 | CC-TD-005, CC-TD-010 | Unpublish-Auftrag und Publisher-Adapter | kontrollierter Staging-Unpublish und Audit | planned |
| CC-US-024 öffentliche Runtime/Sichtbarkeit publizieren | CC-WP-07 bis CC-WP-11 | CC-TC-RUNTIME-001 bis 004 | CC-TD-005, CC-TD-006, CC-TD-010 | Runtime-Vorschau, revisionsbasierte Diff-Ansicht und autorisierter Control-Plane-Command-Adapter | Runtime-Diff-, Leak-, AuthZ-, Retry- und neutrale-Staging-Wirkungsnachweise | planned |
| CC-US-030 Basis-Vault entwerfen/veröffentlichen | CC-WP-10 | CC-TC-PUBLIC-001 bis 003 | CC-TD-006 | Vault-Entwurf, Versionierung und Veröffentlichungsservice | Inhalts-, Sanitizing- und Audit-Tests | planned |
| CC-US-031 öffentliche Read-API | CC-WP-11 | CC-TC-API-001 bis 004 | CC-TD-006, CC-TD-007 | Read-API, PublicTagView-Mapper, CORS-/Cache-/Rate-Limit-Policy | Contract-, Leak- und HTTP-Security-Tests | planned |
| CC-US-032 E2E-Staging-Scan | CC-WP-12 | CC-TC-INTEGRATION-001 bis 003 | CC-TD-004 bis CC-TD-007 | Umgebungsintegration, keine neue Fachkomponente | dokumentierter positiver und negativer Scan → App → API | planned |
| CC-US-040 Produktpolicy | CC-WP-13 | CC-TC-PRODUCT-001 bis 002 | CC-TD-008 | Produkt-/Tier-Policy-Service | Policy- und Negativtests | planned |
| CC-US-041 Organisationen/Rollen | CC-WP-13 | CC-TC-ORG-001 bis 002 | CC-TD-001, CC-TD-008 | Organisations-, Mitgliedschafts- und Widerrufsservice | Organisationsgrenzen- und Widerrufstests | planned |
| CC-US-042 POI-Review | CC-WP-14 | CC-TC-POI-001 bis 004 | CC-TD-009 | POI-Onboarding, Nachweiszugriff und Review-Workflow | Pflichtnachweis-, Leak- und Review-E2E-Test | planned |
| CC-US-043 POI-Meldungen | CC-WP-14 | CC-TC-POI-REPORT-001 bis 002 | CC-TD-007, CC-TD-009 | Meldungsaufnahme, Triage und moderierter Sperrworkflow | Rate-Limit-, Audit- und E2E-Nachweis | planned |

## 3. Architektur- und Vertragsbezüge

| Regel / Vertrag | Betroffene Stories | Verifikation |
| --- | --- | --- |
| PHP/MySQL-Control-Plane ist fachlich autoritativ; das Control Center bedient ausschließlich bestätigte Contracts; KV ist ausschließlich abgeleitet | CC-US-003, 004, 010–017, 020–023 | UI-/Contract-Tests im CC- sowie Transaktions-/Outbox-/Projection-Tests im CP-Strang |
| Cloudflare KV enthält keine Personen-, Secret- oder Vaultdaten | CC-US-020–023, 030–032, 041–043 | Schema- und Leak-Tests |
| Edge Router validiert IDs, Ranges und Routing; Control Center verwaltet nur die Quelle | CC-US-011, 012, 020–023, 032 | Contract-Test gegen `DOMAIN_RULES.md`, Staging-Scan |
| TAG-App autorisiert keine öffentlichen Daten; Read-API entscheidet serverseitig | CC-US-024, 030–032 | Runtime-/PublicTagView-, CORS-, Cache- und Negativtests |
| Öffentliche Runtime-Projektion enthält nur revisionierte, veröffentlichte Runtime-Daten; Owner-, Credential-, PIN-, Session-, Audit-, Pool- und Bestelldaten bleiben in der Control Plane | CC-US-024 | CC-TC-RUNTIME-001 bis 004 sowie CP-Runtime-Mapper-/Leak-Tests |
| Der reguläre Claim startet in der TAG-App; ein manueller Control-Center-Support-Claim verwendet denselben serverseitigen Claim-Service und ersetzt keine Fachentscheidung | CC-US-004, 017 | Cross-Channel-Claim-Contract sowie mobile/desktop Support-E2E |
| Claim-Credentials, Hashes, Owner-Zuordnung und Lockout werden nur in der Control Plane verarbeitet; die UI zeigt ausschließlich erlaubte Metadaten | CC-US-004, 014, 016, 017 sowie zurückgestellter Exportumfang | CP-Claim-Tests sowie CC-Contract-, Export-, Mobile- und Browser-Leak-Tests |
| TCC/TCP erzeugen ausschließlich autorisierte, unveränderliche Exportdaten; PDF-/Label-Aufbereitung, Druckeransteuerung und physische Ausgabe erfolgen außerhalb von TCC/TCP | zurückgestellter Exportumfang | Export-Contract-, Datenminimierungs-, Snapshot-/Prüfsummen- und lokale Aufbereitungstests |
| [`control-plane-admin-api-v1`](../../10-Architecture/35-Contracts/control-plane-admin-api-v1.md) und [`control-plane-tag-management-api-v1`](../../10-Architecture/35-Contracts/control-plane-tag-management-api-v1.md): Secrets bleiben serverseitig und umgebungsgetrennt; der Browser erhält weder SMTP- noch Cloudflare-, Datenbank-, Bootstrap-, Codec- oder MFA-Geheimnisse | CC-US-001, 004, 011, 014, 016, 017, 022 | `CC-TC-AUTH-001` bis `CC-TC-AUTH-006`, `CC-TC-ALLOC-006` bis `CC-TC-ALLOC-008`; `apps/tag-control-center/src/App.test.tsx`; TCP-Auth-/Allocation-Flow-Tests; TCC-Produktionsbuild; kontrollierter lokaler Readiness-/Negativlogin-Smoke-Test und spätere Staging-Cookie-/Konfigurations-/Leak-Tests |
| Deployment-/Server-Administration, Break-glass und reguläre Platform-Administration sind getrennt; TCC verwaltet keine Infrastruktur-Secrets | CC-US-001–004 | [ADR-002](../../../10-Architecture/ADR-002-ADMINISTRATION_BOOTSTRAP_AND_SECRET_BOUNDARIES.md), statische Shell-Prüfung, spätere Auth-/AuthZ-/Audit-Tests |
| POI-Nachweise und Betreiberinformationen bleiben privat | CC-US-041–043 | Zugriffskontroll- und Leak-Tests |

## 4. Ergänzungsprozess bei Implementierungsbeginn

Für jede umgesetzte Story wird diese Matrix erweitert um:

1. tatsächliche Repository-Pfade zu Modulen, Migrationen und Konfigurationstemplates;
2. konkrete automatisierte Testdateien und ausgeführte Befehle;
3. verwendete, nicht geheime Fixture-IDs;
4. Link auf redigierte CI-/Staging-Evidenz unter [`../evidence/`](../evidence/README.md);
5. tatsächlichen Status gemäß [README.md](README.md).

Keine Story wird als `implemented` geführt, solange zumindest Testreferenzen und tatsächliche Codepfade fehlen. `verified` setzt zusätzlich die jeweils in [20-TEST-STRATEGY.md](20-TEST-STRATEGY.md) definierten Gates voraus.
