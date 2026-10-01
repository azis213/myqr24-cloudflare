# Implementierungsnachweis: myQR24 Edge Tag Router

## Zweck

Dieser Ordner dokumentiert die Umsetzung des Cloudflare Workers als nachvollziehbare Kette von fachlichen Anforderungen bis zur reproduzierbaren technischen Evidenz.

```text
Domain-Regeln und Architektur
→ User Story
→ Akzeptanzkriterium
→ Testfall
→ Testdaten / Fixture
→ Worker-Code
→ automatischer Test- und Build-Nachweis
```

Die fachlichen Quellen bleiben:

- [`../DOMAIN_RULES.md`](../DOMAIN_RULES.md)
- [`../ARCHITECTURE.md`](../ARCHITECTURE.md)

Bei Widersprüchen haben diese beiden Dokumente Vorrang. Änderungen am Produktverhalten werden zuerst dort und anschließend in diesem Implementierungsnachweis, Tests und Code nachvollzogen.

## Dokumente

| Dokument | Inhalt |
| --- | --- |
| [`STATUS.md`](./STATUS.md) | Fortschritt je Arbeitspaket, Story und Evidenz |
| [`10-USER-STORIES.md`](./10-USER-STORIES.md) | Fachliche User Stories und testbare Akzeptanzkriterien |
| [`20-TEST-STRATEGY.md`](./20-TEST-STRATEGY.md) | Testebenen, Sicherheitsstrategie und Ausführung |
| [`21-TEST-CASES.md`](./21-TEST-CASES.md) | Eindeutig identifizierte Testfälle |
| [`22-TEST-DATA.md`](./22-TEST-DATA.md) | Versionierte Testdaten und Fixture-Konventionen |
| [`30-TRACEABILITY.md`](./30-TRACEABILITY.md) | Zuordnung von Anforderungen, Tests, Code und Evidenz |
| [`evidence/README.md`](./evidence/README.md) | Reproduzierbare Evidenz und Regeln für Nachweise |

## Statusmodell

| Status | Bedeutung |
| --- | --- |
| `planned` | Dokumentiert, aber noch nicht begonnen |
| `in-progress` | Aktive technische Umsetzung |
| `implemented` | Code und Testfälle sind vorhanden, aber noch nicht vollständig verifiziert |
| `verified` | Zugehörige automatisierte Tests und Build sind erfolgreich |
| `blocked` | Umsetzung durch externe oder fachliche Abhängigkeit blockiert |
| `deferred` | Bewusst in eine spätere Ausbaustufe verschoben |

Ein Eintrag darf nur dann `verified` sein, wenn die verknüpften automatisierten Testfälle erfolgreich sind und `npm run build` erfolgreich abgeschlossen wurde.

## Umsetzungskonventionen

- Der Worker verarbeitet IDs und Range-Grenzen nur als `BigInt`.
- Der Edge-Worker ist ausschließlich lesend; die spätere Verwaltungs-API bleibt die autoritative Schreibseite.
- Alle KV-Dokumente werden zur Laufzeit fail-closed validiert.
- Keine produktiven Secrets, Kundendaten oder realen Produktions-Tags werden in Tests, Fixtures oder Evidenzdateien gespeichert.
- Testdaten befinden sich als ausführbare JSON-Fixtures unter `test/fixtures/`; dieses Verzeichnis ist die technische Quelle, während `22-TEST-DATA.md` deren Bedeutung beschreibt.
- User Story-, Testfall- und Fixture-IDs sind stabil und werden nicht für andere Zwecke wiederverwendet.

## Zielumfang der aktuellen Ausbaustufe

1. kanonische 6- und 8-stellige Base36-Tag-Auflösung;
2. 8-stellige HMAC-Prüfung vor jedem KV-Lookup;
3. aktive, globale und nicht überlappende Range-Auflösung;
4. Feature-Zuweisungen mit Priorität **Tag → Range → Gruppe**;
5. zentrale, wiederverwendbare Feature-Dokumente unter `feature:{featureId}`;
6. sichere Redirect-Features mit festen URLs oder Template-Platzhaltern;
7. JSON-Aktionsantworten für nicht redirectende Features;
8. Unit- und In-Memory-KV-Integrationstests als reproduzierbare Evidenz.

Die Unterstützung siebenstelliger Tags, die Verwaltungs-/Allocation-API, echte Zielsignaturen (`{tagSignature}`) und additive Begleitfeatures sind ausdrücklich nicht Teil dieser ersten Worker-Implementierung.
