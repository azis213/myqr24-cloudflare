# Refinement-Idee: Bucket-basierte Routing-Projektion für den Edge Router

**Status:** unverbindliche Refinement-Idee  
**Geltung:** ausschließlich Diskussion und spätere Bewertung  
**Keine Umsetzungsfreigabe:** Dieses Dokument ändert weder Edge-Router-Code noch Cloudflare-KV-Schema, Contracts, Tests, Stories, Deployment oder Publish-Verhalten.

> Die verbindliche Abgrenzung und der kontrollierte Übernahmeprozess stehen in [`README.md`](README.md). Dieses Dokument darf außerhalb eines ausdrücklich beauftragten Refinements nicht als Input für neue Umsetzungs- oder Wiederaufnahmesessions verwendet werden.

---

## 1. Ausgangslage

Der bestehende Edge Router verwendet für die Range-Auflösung einen globalen, aufsteigend sortierten und nicht überlappenden KV-Index:

```text
tag-range-index
```

Der Worker lädt diesen Index, validiert ihn fail-closed und führt für den dekodierten logischen TAG-Wert eine binäre Range-Suche aus.

Die bestehende und weiterhin maßgebliche Umsetzung unterstützt:

```text
6- und 8-stellige Base36-TAG-IDs
→ Decode und Integritätsprüfung
→ globaler `tag-range-index`
→ vollständige Validierung und binäre Range-Suche
→ Gruppen-, Range-Regel-, optionale TAG-Override- und Feature-Auflösung
```

Diese Refinement-Idee untersucht lediglich, ob eine künftige Control Plane sehr große Range-Bestände in mehrere, deterministisch adressierbare KV-Dokumente segmentieren könnte.

---

## 2. Problemhypothese

Ein einzelner globaler Range-Index kann mit steigender Anzahl von Ranges größer, langsamer zu laden und aufwendiger zu veröffentlichen werden.

Eine mögliche Alternative wäre eine **Bucket-Projektion**:

1. Der Control Plane Publisher ordnet jede fachlich gültige Range einem oder mehreren numerischen Buckets zu.
2. Der Edge Router berechnet aus `decodedValue` deterministisch den zugehörigen Bucket.
3. Er lädt nur das Bucket-Dokument aus Cloudflare KV.
4. Er validiert dieses Dokument vollständig und sucht anschließend binär in den enthaltenen Ranges.

Ziele einer späteren Bewertung wären:

- kleinerer KV-Read pro Scan;
- geringere JSON-Größe pro Lookup;
- begrenzter Publish-Umfang bei Änderungen einzelner Segmente;
- weiterhin fail-closedes, deterministisches und datensparsames Edge-Verhalten.

Dies ist keine Festlegung, dass die Hypothese zutrifft. Insbesondere KV-Latenzen, Cache-Eigenschaften, Publish-Konsistenz, Betriebskomplexität und tatsächliche Range-Anzahlen müssten erst gemessen und gegen den globalen Index abgewogen werden.

---

## 3. Denkmodell: global ausgerichtete numerische Buckets

### 3.1 Parameter

Ein mögliches Modell hätte mindestens diese unveränderlichen, pro Projektion versionierten Parameter:

```text
bucketSize   = 2.000.000 logische IDs
bucketOrigin = 3.521.614.606.208
```

`bucketOrigin` ist eine festgelegte globale Untergrenze der Bucket-Ausrichtung. Sie ist **nicht** automatisch `0` und darf nicht aus einem gelesenen Bucket-Dokument abgeleitet werden.

Für einen logischen Wert `logicalId` wäre der Bucket-Start:

```text
bucketStart =
  bucketOrigin
  + floor((logicalId - bucketOrigin) / bucketSize) × bucketSize
```

Der Bucket endet bei:

```text
bucketEnd = bucketStart + bucketSize - 1
```

### 3.2 Beispiel

Mit den obigen Parametern lautet der erste dargestellte Bucket:

```text
Start: 3.521.614.606.208
Ende:  3.521.616.606.207
```

Der nachfolgende Bucket beginnt bei:

```text
3.521.616.606.208
```

Der Wert `3.521.612.606.208` wäre dagegen der Start des vorherigen Buckets, sofern der gewählte Ursprung und die Bucket-Größe gelten.

### 3.3 Bedeutungsgrenze

Der Wert `3.521.614.606.208` beschreibt in diesem Refinement keinen neuen aktuell erlaubten TAG-Zahlenraum. Er ist nur ein gewünschter, globaler Ausrichtungswert für ein mögliches künftiges Bucket-Schema.

Er liegt außerhalb des derzeitigen, vom Edge Router unterstützten und dokumentierten ID-Raums. Ein produktiver Einsatz wäre daher zusätzlich abhängig von einer ausdrücklich beschlossenen Änderung des TAG-Codecs, der erlaubten TAG-Längen, der kanonischen Zahlenräume und aller zugehörigen Sicherheits- und Regressionstests.

---

## 4. Möglicher KV-Key

Ein möglicher, bewusst noch nicht beschlossener Key könnte lauten:

```text
range-bucket:edge-v1:{tagLength}:{bucketStart}
```

Beispiel:

```text
range-bucket:edge-v1:7:3521614606208
```

Dabei wären mindestens folgende Punkte vor einer Übernahme verbindlich zu entscheiden:

- ob `tagLength` Teil des Keys sein muss oder aus dem Wert eindeutig hervorgeht;
- wie die Projektion versioniert wird;
- ob Reader-/Schema-Versionen im Key oder nur im Dokument liegen;
- welche Werte für `bucketOrigin` und `bucketSize` pro TAG-Länge gelten;
- wie Unpublish, Leerräume, Cache-Invalidierung und Rollback funktionieren;
- ob die zusätzliche Key-Anzahl und einzelne KV-Reads tatsächlich gegenüber dem globalen Index vorteilhaft sind.

Eine Reader-/Worker-Version im Key ist keine beschlossene Anforderung. Sie wird hier nur als mögliche Kompatibilitätsfrage festgehalten.

---

## 5. Mögliche Bucket-Dokumentstruktur

Ein Bucket-Dokument könnte seine eigenen Grenzen und die effektive belegte Spanne explizit enthalten:

```json
{
  "schemaVersion": 1,
  "projectionRevision": 42,

  "tagLength": 7,

  "bucketOrigin": "3521614606208",
  "bucketSize": "2000000",
  "bucketStart": "3521614606208",
  "bucketEnd": "3521616606207",

  "smallestRangeStart": "3521614606208",
  "largestRangeEnd": "3521615123456",

  "ranges": [
    {
      "rangeId": "range-example-a",
      "start": "3521614606208",
      "end": "3521614723456",
      "groupId": "group-example-a",
      "active": true
    },
    {
      "rangeId": "range-example-b",
      "start": "3521615000000",
      "end": "3521615123456",
      "groupId": "group-example-b",
      "active": true
    }
  ]
}
```

Das Beispiel enthält ausschließlich synthetische Daten. Es ist weder ein freigegebenes Contract-Schema noch eine zulässige aktuelle KV-Payload.

Alle Zahlen bleiben dezimale Strings. Ein künftiger TypeScript-Worker müsste sie ausschließlich mit `bigint` verarbeiten; JavaScript-`number` wäre wegen möglicher Präzisionsverluste nicht zulässig.

---

## 6. Bedeutung der Metadaten

### 6.1 Feste Bucket-Grenzen

Die Angaben

```text
bucketOrigin
bucketSize
bucketStart
bucketEnd
```

erlauben es, falsch adressierte, verschobene oder beschädigte Dokumente vor einer Range-Suche fail-closed abzulehnen.

Insbesondere müsste gelten:

```text
bucketEnd = bucketStart + bucketSize - 1
```

und der aus `logicalId` berechnete Bucket-Start müsste exakt `bucketStart` entsprechen.

### 6.2 Tatsächlich belegte Obergrenze

`largestRangeEnd` ist das größte Ende einer tatsächlich enthaltenen Range, nicht das technische Ende des Buckets.

Damit wäre ein früher Negativentscheid möglich:

```text
logicalId > largestRangeEnd
→ keine enthaltene Range kann passen
→ neutraler 404-Entscheid ohne binäre Range-Suche
```

Analog könnte `smallestRangeStart` einen frühen Reject auf der unteren Seite erlauben:

```text
logicalId < smallestRangeStart
→ neutraler 404-Entscheid
```

Diese Metadaten ersetzen keine vollständige Suche innerhalb der belegten Spanne, weil zwischen mehreren Ranges weiterhin Lücken bestehen können.

---

## 7. Denkbare Reader-Validierung

Falls die Idee jemals als Contract übernommen würde, müsste der Reader mindestens in dieser Reihenfolge prüfen:

1. unterstützte `schemaVersion`;
2. passende `tagLength`;
3. gültige dezimale `bigint`-Darstellung aller numerischen Werte;
4. Übereinstimmung von `bucketOrigin` und `bucketSize` mit der kontrollierten Reader-Konfiguration;
5. exakte Berechnung und Übereinstimmung von `bucketStart` für `logicalId`;
6. Gleichung `bucketEnd = bucketStart + bucketSize - 1`;
7. `logicalId` liegt innerhalb von `[bucketStart, bucketEnd]`;
8. `smallestRangeStart` und `largestRangeEnd` stimmen mit den enthaltenen Ranges überein;
9. `logicalId` liegt nicht außerhalb der tatsächlich belegten Spanne;
10. Ranges sind aufsteigend sortiert, nicht überlappend und vollständig innerhalb des Buckets;
11. erst anschließend binäre Suche und die bestehende Gruppen-/Feature-Auflösung.

Jeder Fehler, ein fehlender Key, eine unlesbare Payload oder eine Inkonsistenz würde zu einer neutralen, fail-closeden Nichtauflösung führen.

---

## 8. Denkbare Publisher-Validierung

Vor einem künftigen Publish müsste die Control Plane für jedes Bucket-Dokument mindestens erzwingen:

```text
bucketSize > 0
bucketEnd = bucketStart + bucketSize - 1
jede Range liegt vollständig in [bucketStart, bucketEnd]
ranges sind nach start aufsteigend sortiert
ranges überlappen nicht
smallestRangeStart = start der ersten Range
largestRangeEnd = end der letzten Range
```

Zusätzliche, noch offene Fragen:

- Werden Ranges, die eine Bucket-Grenze überschreiten, beim Publish in mehrere Projektionseinträge zerlegt?
- Wie bleibt die fachliche Identität einer Range bei einer solchen Zerlegung nachvollziehbar?
- Wie wird ein atomar wirkender Multi-Bucket-Publish mit Cloudflare-KV-Eventual-Consistency modelliert?
- Welche Reihenfolge gilt für Publish, Unpublish, Revision und Rollback?
- Wie lassen sich partielle Veröffentlichungen erkennen, neutralisieren und reparieren?
- Welche Obergrenzen gelten für Dokumentgröße, Bucket-Anzahl, Read-Last und Publish-Zeit?
- Welche Messdaten zeigen einen Vorteil gegenüber dem bestehenden globalen Index?

Leere Bucket-Dokumente müssten voraussichtlich nicht publiziert werden. Ein fehlender Key könnte dann wie heute fail-closed zu einer neutralen Nichtauflösung führen. Diese Semantik ist jedoch Teil einer späteren Contract-Entscheidung.

---

## 9. Nicht Teil dieser Refinement-Idee

Dieses Dokument entscheidet nicht über:

- Einführung 7-stelliger Base36-TAG-IDs;
- Änderung der Feistel- oder HMAC-Konstruktion;
- Änderung kanonischer ID-Räume;
- Reader- oder Worker-Versionierung;
- D1, Durable Objects oder andere Datenbanken im Scan-Hot-Path;
- tatsächliche KV-Key-Namen oder JSON-Schemas;
- Deployment, Migration oder Rückmigration;
- Änderungen an bestehenden TAGs, Ranges oder Cloudflare-Ressourcen.

Diese Themen haben eigene fachliche, kryptografische, betriebliche und datenschutzbezogene Auswirkungen und wären vor einer Umsetzung separat zu entscheiden.

---

## 10. Voraussetzungen für eine verbindliche Übernahme

Diese Idee darf erst umgesetzt werden, wenn sie außerhalb von `docs/00-Refinement/` vollständig und explizit übernommen wurde. Dazu gehören mindestens:

1. belastbare Größen-, Last-, Latenz- und Kostenmessungen gegenüber `tag-range-index`;
2. fachliche Entscheidung zu TAG-Längen, logischem Zahlenraum und globaler Bucket-Ausrichtung;
3. Sicherheitsreview für Decode, `bigint`-Grenzen, Dokumentvalidierung und fail-closed-Verhalten;
4. versionierter `tag-routing-projection-v1`-Contract oder eine bewusst neue Contract-Version;
5. Migrations-, Publish-, Unpublish-, Rollback- und Konsistenzkonzept;
6. aktualisierte User Stories, Akzeptanzkriterien, Teststrategie, Testfälle und Traceability;
7. vollständige Unit-, Contract-, Integrations-, Negativ-, Last- und Staging-Tests;
8. dokumentierte Staging-Freigabe vor jeder produktiven Verwendung.

Bis dahin bleibt ausschließlich die bestehende globale `tag-range-index`-Auflösung verbindlich.
