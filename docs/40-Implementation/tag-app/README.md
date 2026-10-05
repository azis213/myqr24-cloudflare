# Implementierungsnachweis: myQR24 TAG-App

## Zweck

Dieser Teilbereich plant, implementiert und prüft die öffentliche TAG-App als eigenständige Cloudflare-Pages-/PWA-Anwendung. Er trennt die fachliche TAG-App bewusst vom Edge Router.

```text
Feature-Spezifikation und Architektur
→ APP-User Story
→ Akzeptanzkriterium
→ APP-Testfall
→ APP-Testdaten / Fixture
→ TAG-App- oder API-Code
→ automatisierter Test, Build und Staging-Evidenz
```

Die aktuelle App befindet sich unter [`../../../apps/tag-app/`](../../../apps/tag-app/). Ihre konkrete Staging-MVP-Architektur beschreibt [`../../10-Architecture/TAG_APP_ARCHITECTURE.md`](../../10-Architecture/TAG_APP_ARCHITECTURE.md). Die übergreifende Zielarchitektur einschließlich der späteren Application API steht in [`../../10-Architecture/CLOUDFLARE_PWA_COMPONENT.md`](../../10-Architecture/CLOUDFLARE_PWA_COMPONENT.md).

## Abgrenzung zum Edge Router

| Komponente | Verantwortlich für | Nicht verantwortlich für |
| --- | --- | --- |
| Edge Router | Scan-URL, Host-/Pfadvalidierung, Tag-Kryptografie, Range- und Routing-Auflösung, sicherer Redirect | Inhalte, Sitzungen, Eigentümer, private Daten, Fachlogik |
| TAG-App | öffentliche Ansicht, PWA-Shell, UI, spätere API-Aufrufe und nutzerseitige Feature-Flows | Feistel/HMAC, Routing-KV, Redirect-Signaturen und Berechtigungsautorität |
| spätere Application API | öffentliche Sichtbarkeit, Sitzungen, Autorisierung, Schreibvorgänge, Medien und Audit | Edge-Routing-Entscheidungen |

Der Router-Nachweis befindet sich in [`../edge-router/`](../edge-router/). Eine fachliche Änderung darf nicht durch einen UI-Zustand oder durch lokale Fixture-Daten als Sicherheitsentscheidung ersetzt werden.

## Dokumente

| Dokument | Inhalt |
| --- | --- |
| [`STATUS.md`](STATUS.md) | Arbeitspakete, Stories, Iterationen, Abhängigkeiten und Fortschritt |
| [`10-USER-STORIES.md`](10-USER-STORIES.md) | TAG-App-Epics, priorisierte User Stories und Akzeptanzkriterien |
| [`20-TEST-STRATEGY.md`](20-TEST-STRATEGY.md) | Teststufen, Sicherheits-, PWA- und Staging-Strategie |
| [`21-TEST-CASES.md`](21-TEST-CASES.md) | Eindeutige aktuelle und geplante Testfälle |
| [`22-TEST-DATA.md`](22-TEST-DATA.md) | Nicht geheime Fixtures, Contract-Daten und Testdatenregeln |
| [`30-TRACEABILITY.md`](30-TRACEABILITY.md) | Zuordnung Story → Test → Code → Evidenz |

## ID-System

| Artefakt | Präfix | Beispiel |
| --- | --- | --- |
| User Story | `APP-US-` | `APP-US-010` |
| Arbeitspaket | `APP-WP-` | `APP-WP-03` |
| Testfall | `APP-TC-` | `APP-TC-VAULT-001` |
| Testdaten | `APP-TD-` | `APP-TD-001` |
| Iteration | `APP-I` | `APP-I03` |

Die bestehenden Router-IDs `US-*`, `TC-*` und `WP-*` bleiben historische, stabile IDs im eigenen Router-Strang. IDs werden nie in eine andere Domäne verschoben oder wiederverwendet.

## Statusmodell

| Status | Bedeutung |
| --- | --- |
| `planned` | Story oder Arbeitspaket ist fachlich präzisiert, aber nicht begonnen |
| `in-progress` | Umsetzung läuft aktiv |
| `implemented` | Code und mindestens zugehörige Testfälle existieren, vollständige Verifikation fehlt noch |
| `verified` | Akzeptanztests, Build und erforderliche Staging-Evidenz sind erfolgreich |
| `blocked` | externe oder fachliche Abhängigkeit verhindert Umsetzung |
| `deferred` | bewusst in einen späteren Ausbau verschoben |

Eine Story ist erst `verified`, wenn alle verknüpften Tests erfolgreich sind und der jeweils notwendige Build- beziehungsweise Staging-Nachweis vorliegt. Ein vorhandenes UI allein genügt nicht.

## Iterationen

| Iteration | Ziel | Wesentliche Abhängigkeiten |
| --- | --- | --- |
| `APP-I01` | Staging-MVP: öffentliche Route, Fixture-Adapter, Vault-Rendering, PWA-Shell | Cloudflare Pages |
| `APP-I02` | Router→PWA-Staging-Integration und kontrollierte Redirect-Umstellung | aktiver Worker und zugehöriger KV-Namespace identifiziert |
| `APP-I03` | Öffentliche Vault-API, D1/R2 und serverseitige Sichtbarkeit | Application API, getrennte Staging-Ressourcen |
| `APP-I04` | Owner-Login, Inhalts- und Sichtbarkeitsverwaltung | API-Authentisierung und Audit |
| `APP-I05` | Lost & Found und TAG Chat | Besucher-/Owner-Sessions, Rate Limits, Moderation |
| `APP-I06` | TAG Guestbook und Medienpipeline | Upload-/Queue- und Moderationsfluss |
| `APP-I07` | Check-ins, Collections und Campaigns | GeoFence-Policy, Offline-Sync, atomare Credits |

## Verbindliche Regeln

1. Öffentliche und private Daten werden durch die spätere Application API autorisiert, niemals allein im Client.
2. Die TAG-App enthält keine Router-Secrets, Cloudflare-API-Tokens oder Datenbankbindungen.
3. Fixtures enthalten nur nicht sensible, frei verwendbare Staging-Daten.
4. `/api/`-, Sitzungs-, private Medien- und dynamische Statusantworten dürfen nicht durch den Service Worker persistent gecacht werden.
5. Öffentliche Routen müssen in React Router und dem Cloudflare-Pages-Fallback berücksichtigt werden.
6. Jede neue Story erhält vor dem Status `implemented` Testfälle und Traceability-Verweise.
7. Änderungen an der Scan-Weiterleitung gehören in den Integrationsnachweis; sie dürfen nie durch unkontrollierte KV-Änderungen erfolgen.
