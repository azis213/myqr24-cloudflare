# Implementierungsnachweis: myQR24 Cloudflare-Plattform

## Zweck

Dieser Ordner dokumentiert die Umsetzung der myQR24-Cloudflare-Komponenten als nachvollziehbare Kette von fachlicher Anforderung bis zur reproduzierbaren technischen Evidenz.

```text
Fachliche Regel und Architektur
→ User Story
→ Akzeptanzkriterium
→ Testfall
→ Testdaten / Fixture
→ Code und Infrastruktur
→ automatisierter Test, Build und Staging-Evidenz
```

Die fachlichen Quellen bleiben:

- [`../DOMAIN_RULES.md`](../DOMAIN_RULES.md)
- [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
- [`../10-Architecture/TAG_APP_ARCHITECTURE.md`](../10-Architecture/TAG_APP_ARCHITECTURE.md)
- [`../10-Architecture/CLOUDFLARE_PWA_COMPONENT.md`](../10-Architecture/CLOUDFLARE_PWA_COMPONENT.md)

Bei Widersprüchen haben Domain-Regeln und fachliche Spezifikationen Vorrang. Produktverhalten wird zuerst in den fachlichen Quellen beschrieben und danach in Stories, Tests, Code und Evidenz nachgezogen.

## Getrennte Umsetzungsstränge

| Strang | Verantwortung | Status und Artefakte |
| --- | --- | --- |
| [Edge Router](edge-router/) | Scan-URL, Tag-Kryptografie, Range-/Feature-Auflösung, KV und sichere Redirects | historische, verifizierte Worker-Implementierung |
| [TAG-App](tag-app/) | öffentliche Ansicht, PWA-Shell, öffentliche Vault-UI sowie geplante Application-API-Features | Staging-MVP implementiert; weitere Feature-Iterationen geplant |
| Integration | kontrollierter Übergang vom aktiven Edge Router zur TAG-App | aktuell blockiert, bis aktiver Worker und gebundener KV-Namespace identifiziert sind |

Die Trennung ist verbindlich:

- Der **Edge Router** ist kein Content-, Session- oder Feature-Backend.
- Die **TAG-App** entscheidet weder Tag-Kryptografie noch Routing oder Berechtigungen.
- Die spätere **Application API** ist Autorität für Sichtbarkeit, Sitzungen, Schreiben, Medien und Audit.
- Ein Browser-UI-Zustand oder Fixture ersetzt nie eine serverseitige Sicherheitsentscheidung.

## Artefaktstruktur

```text
40-Implementation/
├── README.md
├── edge-router/
│   ├── README.md
│   ├── STATUS.md
│   ├── 10-USER-STORIES.md
│   ├── 20-TEST-STRATEGY.md
│   ├── 21-TEST-CASES.md
│   ├── 22-TEST-DATA.md
│   └── 30-TRACEABILITY.md
├── tag-app/
│   ├── README.md
│   ├── STATUS.md
│   ├── 10-USER-STORIES.md
│   ├── 20-TEST-STRATEGY.md
│   ├── 21-TEST-CASES.md
│   ├── 22-TEST-DATA.md
│   └── 30-TRACEABILITY.md
└── evidence/
    └── README.md
```

## ID-System und Historie

| Bereich | Stories | Tests | Testdaten | Arbeitspakete |
| --- | --- | --- | --- | --- |
| bestehender Edge Router | historische `US-*` | historische `TC-*` | bestehende Router-Fixtures | historische `WP-*` |
| TAG-App | `APP-US-*` | `APP-TC-*` | `APP-TD-*` | `APP-WP-*` |
| spätere, explizite Integration | Verweis auf APP-/Router-Story | `APP-TC-INTEGRATION-*` oder künftig `INT-TC-*` | `APP-TD-006` oder künftig `INT-TD-*` | `APP-WP-06` oder künftig `INT-WP-*` |

Die bereits verifizierten Router-IDs werden nicht nachträglich umbenannt. Neue Router-Arbeit kann bei Bedarf ein eigenes Präfix erhalten; bestehende Nachweise bleiben unverändert referenzierbar.

## Gemeinsames Statusmodell

| Status | Bedeutung |
| --- | --- |
| `planned` | fachlich präzisiert, aber noch nicht begonnen |
| `in-progress` | aktive Umsetzung |
| `implemented` | Code und Testfälle vorhanden, vollständige Verifikation fehlt |
| `verified` | alle erforderlichen Tests, Build und Staging-Nachweise erfolgreich |
| `blocked` | externe oder fachliche Abhängigkeit verhindert Umsetzung |
| `deferred` | bewusst auf spätere Ausbaustufe verschoben |

Ein Status gilt nur im jeweiligen Strang. Ein verifizierter Router-Redirect verifiziert beispielsweise weder eine TAG-App-Feature-Story noch deren API-Autorisierung.

## Gemeinsamer Integrationsnachweis

Der Staging-Flow wird nur nach klarer Identifikation der aktiven Cloudflare-Ressourcen geändert und geprüft:

```text
Scan-Host
→ Edge Router: Validierung und Redirect
→ Cloudflare Pages: /tag/{tagId}
→ TAG-App: öffentlicher View-Adapter
→ später: Application API
```

Der aktuelle Integrationsblocker und die Testschritte sind im [TAG-App-Status](tag-app/STATUS.md) sowie in der [TAG-App-Teststrategie](tag-app/20-TEST-STRATEGY.md) erfasst.

## Evidenz und Datenschutz

Die allgemeinen Regeln für reproduzierbare Nachweise stehen in [`evidence/README.md`](evidence/README.md). Alle Stränge beachten:

- keine Produktions-Secrets, Tokens, Cookies oder Kundendaten;
- keine realen Produktions-Tags in versionierten Fixtures;
- keine privaten Medien, Chat-Inhalte oder Rohstandorte in Evidenz;
- Tests und Nachweise müssen der jeweiligen Story-ID und Traceability-Matrix zuordenbar sein.
