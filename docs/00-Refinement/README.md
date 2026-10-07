# Refinement – unverbindlicher Ideenspeicher

Dieser Ordner dient ausschließlich der Sammlung, Diskussion und schrittweisen Ausarbeitung von **noch nicht entschiedenen** Architektur-, Produkt-, Betriebs- und Implementierungsideen.

Er ist ausdrücklich **keine** verbindliche Projekt-, Architektur-, Contract-, Test- oder Umsetzungsdokumentation.

---

## 1. Verbindliche Abgrenzung

Dokumente unter `docs/00-Refinement/` dürfen nicht:

- als Anforderung für Codeänderungen interpretiert werden;
- Architektur- oder Domain-Regeln überschreiben;
- bestehende Contracts, User Stories, Testfälle, Traceability oder Status-Gates verändern;
- bei autonomen Umsetzungsaufträgen oder neuen Umsetzungssessions automatisch gelesen werden;
- als Grundlage für Deployment-, Migration-, Sicherheits- oder Publish-Entscheidungen dienen.

Neue Sessions und Umsetzungsarbeiten beginnen mit den verbindlichen Quellen, insbesondere:

```text
docs/40-Implementation/10-Implementation-Orchestration/STATUS.md
docs/40-Implementation/10-Implementation-Orchestration/README.md
docs/ARCHITECTURE.md
docs/DOMAIN_RULES.md
docs/10-Architecture/
docs/10-Architecture/35-Contracts/
komponentenspezifische Stories, Tests, Traceability und Statusdateien
```

`docs/00-Refinement/` wird nur gelesen, wenn der Arbeitsauftrag ausdrücklich eine Refinement-Arbeit für diesen Ordner verlangt.

---

## 2. Kontrollierte Übernahme eines Refinements

Eine Idee aus diesem Ordner wird erst dann Teil der verbindlichen Umsetzung, wenn alle folgenden Schritte bewusst abgeschlossen wurden:

1. Das Refinement wird explizit bewertet und entschieden.
2. Die Entscheidung wird in die maßgebliche Architektur- und/oder Domain-Dokumentation übernommen.
3. Betroffene Contracts werden versioniert erstellt oder angepasst.
4. Stories, Akzeptanzkriterien, Teststrategie, Testfälle und Traceability werden fortgeschrieben.
5. Auswirkungen auf Sicherheit, Datenschutz, Betrieb, Migration, Deployment und Rollback werden bewertet.
6. Der Orchestrierungs- und Komponentenstatus benennt einen zulässigen nächsten Umsetzungsschritt.
7. Erst danach darf Code implementiert, migriert, publiziert oder deployt werden.

Ein Refinement-Dokument bleibt bis zu diesem Prozess unverbindlich, auch wenn es technisch detailliert beschrieben ist.

---

## 3. Aktueller Ausgangspunkt für spätere Edge-Routing-Refinements

Die aktuelle, verbindliche Edge-Router-Umsetzung wird durch Refinement-Ideen nicht verändert:

```text
6- und 8-stellige Base36-TAG-IDs
→ Decode und Integritätsprüfung im bestehenden Edge Router
→ global sortierter KV-Key `tag-range-index`
→ vollständige Validierung und binäre Range-Suche
→ `group:{groupId}`
→ optionale `range-rule:{rangeId}` und `tag:{decodedValue}`
→ `feature:{featureId}`
```

Insbesondere sind aktuell **nicht beschlossen** und daher nicht umzusetzen:

- Bucket-basierte Range-Indizes in Cloudflare KV;
- neue Reader-/Worker-Versionen als Bestandteil von KV-Keys;
- 7-stellige Base36-TAG-IDs;
- größere oder alternative logische ID-Räume;
- D1-basierte Range-Auflösung im Scan-Hot-Path;
- Änderungen am bestehenden Edge-Router-Contract allein aufgrund einer Refinement-Idee.

Solche Themen können hier weiter konkretisiert werden. Ihre spätere Umsetzung benötigt jedoch den vollständigen Übernahmeprozess aus Abschnitt 2.
