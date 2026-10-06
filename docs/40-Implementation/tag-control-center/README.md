# Implementierungsplan: myQR24 TAG Control Center

## Zweck

Dieser Teilbereich plant die künftige administrative **TAG Control Center App** als Benutzeroberfläche für die getrennte [TAG Control Plane](../tag-control-plane/README.md). Beide Komponenten werden künftig auf dem Dogado-Hosting betrieben, besitzen jedoch unterschiedliche Verantwortlichkeiten.

Er enthält zunächst ausschließlich Planungs-, Qualitäts- und Rückverfolgbarkeitsartefakte. Es werden durch diesen Strang keine PHP-Anwendung, Datenbankmigration, API, Cloudflare-Konfiguration oder produktiven Daten angelegt.

```text
Architektur- und Fachspezifikation
→ Control-Center-User-Story
→ Akzeptanzkriterium
→ Control-Center-Testfall
→ nicht geheime Testdaten / Contract-Fixture
→ spätere PHP-/MySQL-/Publisher-Implementierung
→ automatisierter Test, Staging- und Betriebsnachweis
```

Die fachlich autoritative Quelle ist die PHP-/MySQL-Control-Plane. Das Control Center visualisiert und bedient ausschließlich deren freigegebene Verwaltungsfunktionen. Cloudflare KV `TAG_CONFIG` bleibt eine minimale, abgeleitete und nicht geheime Routing-Projektion für den bestehenden [Edge Router](../edge-router/README.md). Die öffentliche [TAG-App](../tag-app/README.md) bleibt eine getrennte Cloudflare-Pages-/PWA-Komponente.

## Verantwortungsgrenzen

| Komponente | Verantwortlich für | Nicht verantwortlich für |
| --- | --- | --- |
| TAG Control Center | administrative Formulare, Listen, Pool-/Chargen-/Claim- und Druckvorschau, Bedienung freigegebener Control-Plane-Aktionen sowie deren Statusanzeige | fachliche Autorität, direkte DB-Zugriffe, Claim-Prüfung, Cloudflare-Tokens, Publisher-Ausführung |
| TAG Control Plane | autoritative Fach-, Audit-, Outbox-, Claim-, Produktions- und Veröffentlichungsdaten; atomare ID-Vergabe, AuthZ, Status- und Claim-Guards | administrative Benutzeroberfläche, öffentliche Edge-Auflösung |
| MySQL | Persistenz der autoritativen Control-Plane-Daten | öffentliche Routing-Auflösung |
| Control-Plane-Publisher | minimale KV-Projektion erzeugen, validieren, idempotent nach Cloudflare publizieren oder entfernen | direkte Browser-Zugriffe auf Cloudflare |
| Edge Router | Scan-URL, Tag-Kryptografie, Range- und Feature-Auflösung aus KV | Owner, POI-Nachweise, Inhalte, Sitzungen, Quoten oder Moderation |
| TAG-App / spätere Application API | öffentliche Ansichten, öffentliche Read-API und spätere Laufzeit-Features | TAG-Ausgabe, Cloudflare-KV-Verwaltung und Verwaltungsautorität |

Insbesondere dürfen weder personenbezogene Daten, Genehmigungsnachweise, Owner-/Besucher-Sessions, PIN-Hashes, Vault-Inhalte, R2-Keys noch Cloudflare-Secrets in `TAG_CONFIG` oder in einen Browser gelangen.

## Maßgebliche Spezifikationen

- [TAG Control Plane und Basis-Vault](../../10-Architecture/PWA-PHP-Applications/TAG_CONTROL_PLANE_AND_BASIS_VAULT.md)
- [Domain-, Tag- und Routing-Regeln](../../DOMAIN_RULES.md)
- [TAG-Typen und POI-/Community-TAGs](../../20-Special-Specifications/TAG_TYPES_AND_POI_FEATURES.md)
- [TAG Vault Feature](../../20-Special-Specifications/TAG_VAULT_FEATURE.md)
- [TAG-App-Architektur](../../10-Architecture/TAG_APP_ARCHITECTURE.md)
- [Cloudflare DNS- und TLS-Konfiguration](../../10-Architecture/CLOUDFLARE_DNS_AND_TLS_CONFIGURATION.md)
- [Deployment-Handover des Edge Routers](../../90-Session-Change-Summaries/DEPLOYMENT_HANDOVER.md)

## Dokumente

| Dokument | Inhalt |
| --- | --- |
| [STATUS.md](STATUS.md) | Iterationen, Arbeitspakete, Abhängigkeiten, offene Entscheidungen und Fortschritt |
| [10-USER-STORIES.md](10-USER-STORIES.md) | priorisierte Stories und Akzeptanzkriterien |
| [20-TEST-STRATEGY.md](20-TEST-STRATEGY.md) | Teststufen, Sicherheits-, Publishing- und Staging-Strategie |
| [21-TEST-CASES.md](21-TEST-CASES.md) | eindeutige, vorab definierte Testfälle |
| [22-TEST-DATA.md](22-TEST-DATA.md) | Testdatenklassen, sichere Fixtures und Secret-Regeln |
| [30-TRACEABILITY.md](30-TRACEABILITY.md) | Zuordnung von Story, Test, Implementierung und Evidenz |

## ID-System

| Artefakt | Präfix | Beispiel |
| --- | --- | --- |
| User Story | `CC-US-` | `CC-US-010` |
| Arbeitspaket | `CC-WP-` | `CC-WP-03` |
| Testfall | `CC-TC-` | `CC-TC-PUBLISH-001` |
| Testdaten | `CC-TD-` | `CC-TD-001` |
| Iteration | `CC-I` | `CC-I01` |
| Blocker | `CC-BLK-` | `CC-BLK-001` |

Die bestehenden `US-*`-/`TC-*`-IDs des Edge Routers sowie `APP-*`-IDs der TAG-App bleiben stabil und werden nicht wiederverwendet.

## Statusmodell

| Status | Bedeutung |
| --- | --- |
| `planned` | fachlich präzisiert, aber nicht begonnen |
| `in-progress` | Umsetzung läuft aktiv |
| `implemented` | Code und zugehörige Tests existieren, vollständige Verifikation fehlt |
| `verified` | Tests, Sicherheitsprüfung und erforderliche Staging-Evidenz sind erfolgreich |
| `blocked` | externe oder fachliche Abhängigkeit verhindert die Umsetzung |
| `deferred` | bewusst in einen späteren Ausbau verschoben |

Eine Story wird erst `verified`, wenn die verknüpften Tests erfolgreich sind und die benötigte Staging- bzw. Betriebs-Evidenz vorliegt. Eine sichtbare Verwaltungsoberfläche allein ist kein Nachweis.

## Verbindliche Regeln

1. Die PHP-/MySQL-Datenbank ist die autoritative Quelle; KV wird nie manuell als Fachquelle gepflegt.
2. Jede fachliche Änderung, die eine Routing-Projektion erfordert, schreibt in der Control Plane innerhalb derselben DB-Transaktion einen Outbox-Auftrag und ein Audit-Ereignis.
3. Nur ein serverseitiger Publisher darf mit einem minimal berechtigten Cloudflare-Token nach KV schreiben; Browser erhalten niemals diesen Token.
4. Staging und Produktion verwenden getrennte Datenbanken bzw. Konfigurationen, Cloudflare-Tokens, KV-Namespaces und Secrets.
5. Die Vergabe von sechs- und achtstelligen TAGs erfolgt atomar und nutzt eindeutige Constraints für `tagId` sowie `(length, decodedValue)`.
6. Range-Änderungen werden vor Veröffentlichung auf kanonische Räume, globale Sortierung, Nichtüberlappung und bei acht Stellen auf vollständige 16er-Slots validiert.
7. Routing-Projektionen enthalten nur die in `DOMAIN_RULES.md` erlaubten Ranges, Gruppen, Regelzuweisungen und Feature-Dokumente.
8. Öffentliche Read-APIs liefern ausschließlich explizit veröffentlichte Daten und behandeln unbekannte, gesperrte oder nicht veröffentlichte TAGs neutral.
9. Jede neue Story erhält vor dem Status `implemented` Testfälle und Traceability-Verweise.
10. Claim-PINs/-Passwörter, Claim-Versuche, Owner-Zuordnungen, Poolregeln und vertrauliche Druckexports werden nur durch die Control Plane verarbeitet; die UI erhält weder Klartext-Credentials nach der einmaligen Druckfreigabe noch Hashes oder Entsperrberechtigungen ohne serverseitigen Guard.
11. Dieses Verzeichnis ist ein Umsetzungsplan; eine Anwendungsimplementierung beginnt erst nach bestätigter Architektur- und Produktentscheidung.
