# Implementierungsnachweis: myQR24 Edge Router

## Zweck

Dieser Teilbereich dokumentiert den Cloudflare Edge Router als getrennte, sicherheitskritische Komponente für die öffentliche TAG-Auflösung.

```text
Domain-Regeln und Architektur
→ historische User Story `US-*`
→ Akzeptanzkriterium
→ historischer Testfall `TC-*`
→ Router-Fixture
→ Worker-Code
→ Test-, Build- und Staging-Evidenz
```

Der aktuelle Worker-Code befindet sich unter [`../../../apps/edge-router/`](../../../apps/edge-router/). Der gemeinsame Index und die Regeln für Status, Evidenz und Strangtrennung stehen in [`../README.md`](../README.md).

## Verantwortung

Der Edge Router:

- validiert öffentliche Scan-Hosts, Pfade und kanonische TAG-IDs;
- prüft Feistel-/HMAC-Integrität und Range-Invarianten;
- löst Routing-Konfiguration und Feature-Zuweisungen aus `TAG_CONFIG` auf;
- liefert einen fail-closed Redirect oder ein Aktionsdokument.

Er verwaltet ausdrücklich keine:

- öffentlichen oder privaten Vault-Inhalte;
- Owner-, Besucher- oder Empfänger-Sessions;
- Medien, Uploads, Chats, Guestbooks oder Check-ins;
- fachlichen Sichtbarkeits- oder Berechtigungsentscheidungen.

Diese Verantwortlichkeiten gehören zur [TAG-App und ihrer späteren Application API](../tag-app/README.md).

## Dokumente

| Dokument | Inhalt |
| --- | --- |
| [`STATUS.md`](STATUS.md) | verifizierter Worker-Status und historische Arbeitspakete |
| [`10-USER-STORIES.md`](10-USER-STORIES.md) | bestehende Router-Stories `US-001` bis `US-010` |
| [`20-TEST-STRATEGY.md`](20-TEST-STRATEGY.md) | Worker-Testebenen und Sicherheitsstrategie |
| [`21-TEST-CASES.md`](21-TEST-CASES.md) | historische Router-Testfälle `TC-*` |
| [`22-TEST-DATA.md`](22-TEST-DATA.md) | Router-Fixtures und Testdatenkonventionen |
| [`30-TRACEABILITY.md`](30-TRACEABILITY.md) | Story-, Test-, Code- und Evidenzzuordnung |

## Historische IDs und Status

Die vorhandenen IDs `US-*`, `TC-*` und `WP-*` bleiben unverändert, da sie Teil der bereits verifizierten Router-Nachweiskette sind. Sie dürfen nicht für TAG-App-Stories verwendet oder stillschweigend umbenannt werden.

Den aktuellen verifizierten Stand dokumentiert [`STATUS.md`](STATUS.md). Der Nachweis von `npm test`, `npm run build` und des bisherigen öffentlichen Staging-Scans befindet sich in [`../evidence/README.md`](../evidence/README.md).

## Router→TAG-App-Grenze

Der Router kann nach erfolgreicher Auflösung auf eine feste, vertrauenswürdige TAG-App-Route wie `/tag/{tagId}` umleiten. Ein solcher Redirect bestätigt jedoch nicht:

- dass die App öffentliche Inhalte serverseitig autorisiert;
- dass eine Owner- oder Besucher-Session gültig ist;
- dass private Inhalte geschützt sind;
- dass spätere Feature-Flows wie Chat, Guestbook oder Check-in zulässig sind.

Der kontrollierte Staging-Übergang wird im [TAG-App-Integrationsnachweis](../tag-app/20-TEST-STRATEGY.md#6-integrationsstrategie-edge-router--tag-app) geführt.
