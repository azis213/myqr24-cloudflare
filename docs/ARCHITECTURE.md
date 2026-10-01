# myQR24 Edge-Tag-Infrastruktur

## Zweck

Dieser Cloudflare Worker löst NFC- und QR-Tag-Aufrufe am Edge auf. Er extrahiert eine Tag-ID aus einer unterstützten öffentlichen URL, validiert und decodiert sie, ermittelt die zugehörige Tag-Range in Cloudflare KV und führt anschließend die für die Gruppe konfigurierte Aktion aus.

Das Datenmodell ist absichtlich feature-orientiert: Gruppen können heute Redirects und später beliebige Funktionen wie Bildausgabe, JSON-Konfiguration oder PWA-Interaktionen enthalten. Inhalts-, Chat-, Lost-&-Found-, Gästebuch- und Check-in-Daten liegen nie im Routing-KV, sondern ausschließlich in ihren autoritativen Anwendungsspeichern. Collections und Campaigns sind Anwendungsdomänen, keine eigenen Edge-Feature-Typen.

## Unterstützte öffentliche URLs

Die zulässigen Scan-Hosts werden durch `SCAN_ENVIRONMENT` als deployment-spezifische Allowlist festgelegt. Staging- und Production-Worker akzeptieren niemals die Hosts der jeweils anderen Umgebung.

| Umgebung | kurze Domain | sprechende Domain |
| --- | --- | --- |
| Staging | `s.qx4.uk/{TAG-ID}` | `s.myqr24.com/t/{TAG-ID}` |
| Produktion | `qx4.uk/{TAG-ID}` | `p.myqr24.com/t/{TAG-ID}` |

Der Vergleich der Hosts erfolgt case-insensitiv. Andere Hosts, Cross-Environment-Hosts oder abweichende Pfadformen werden mit `404 Not Found` abgelehnt. Eine Tag-ID darf ausschließlich aus 6 oder 8 Base36-Zeichen (`0-9`, `a-z`, unabhängig von Groß-/Kleinschreibung) bestehen.

Die gewählte Scan-Domain ist eine Ausgabe- bzw. Präsentationsentscheidung für den QR-/NFC-Tag. Beide Domains einer Umgebung lösen dieselbe Tag-ID mit demselben Range-, Gruppen- und Featurebestand auf. Sie erzeugen keine separaten Tags oder Feature-Zuweisungen.

## Auflösungspipeline

1. **URL-Parsing:** Der Worker akzeptiert nur die zwei für seine Umgebung dokumentierten Host-/Pfad-Kombinationen und normalisiert die Tag-ID zu Kleinbuchstaben.
2. **Base36-Parsing:** Die ID wird verlustfrei in einen `BigInt` umgewandelt. JavaScript-`number` wird für Tag-Identitäten nicht verwendet.
3. **Feistel-Decodierung und kanonische Längenräume:**
   - sechs Base36-Stellen werden auf einem 32-Bit-Block decodiert;
   - acht Base36-Stellen werden auf dem geforderten 42-Bit-Block decodiert;
   - beide Varianten verwenden getrennte Domänenbezeichner und dadurch getrennte Feistel-Round-Funktionen;
   - ein Cycle-Walk beschränkt die entschlüsselte Ausgabe auf den **kanonischen Zahlenraum der jeweiligen Länge**. Für eine Länge `L` gilt exakt `36^(L-1) ≤ n < 36^L`;
   - dadurch ist die minimale gültige sechsstellige Zahl `36^5`, die minimale gültige achtstellige Zahl `36^7`, und kein numerischer Tag-Wert kann zu mehr als einer Base36-Länge gehören.
4. **Integritätsprüfung und 16er-Slots für achtstellige IDs:** Die vier niederwertigen Bits werden für den HMAC reserviert. Der Worker bildet ohne Shift `base = decodedValue & ~0x0f` und `suppliedHmacNibble = decodedValue & 0x0f`; das HMAC wird über `base` berechnet. Bei einer Abweichung wird der Request unmittelbar mit `404` beendet. Der nächste logische Tag-Slot entsteht durch `(lastDecodedValue & ~0x0f) + 0x10`. Ein um eins erhöhter logischer Zähler belegt daher den nächsten 16er-Slot, nicht den unmittelbar folgenden Integer. Das Prüfnibble ist ausschließlich der kryptographische Bestandteil innerhalb dieses Slots. Der vollständige decodierte Wert einschließlich Prüfnibble bleibt der kanonische Range-Key.
5. **Range- und Regelauflösung:** Erst nach erfolgreicher Feistel- und HMAC-Prüfung wird der vollständige, kanonische Feistel-Wert gegen den globalen Range-Index geprüft. Ohne passende aktive Range endet die Auflösung mit `404`. Innerhalb der bestätigten Range prüft der Worker anschließend eine direkte Tag-Regel, danach eine optionale Range-Regel und schließlich die referenzierte Gruppe mit ihrer Gruppen-Regel bzw. ihren Features.
6. **Feature-Ausführung:** Eine aufgelöste Redirect-Regel erzeugt einen HTTP-Redirect; andere oder mehrere Features werden als JSON-Aktionsdokument ausgeliefert. Redirect-Templates können ausschließlich serverseitig bereitgestellte Platzhalter verwenden.

Fehlerhafte oder nicht existente IDs werden grundsätzlich als `404` behandelt, damit keine Informationen über interne Daten oder kryptographische Prüfungen offengelegt werden.

## Kryptographische Parameter

Die Parameter sind im Code fest definiert und dürfen nicht pro Request oder über untrusted Input geändert werden.

| Parameter                               | Wert                                                                                         |
| --------------------------------------- | -------------------------------------------------------------------------------------------- |
| Feistel-Runden                          | 10                                                                                           |
| Feistel-Block für 6 Zeichen            | 32 Bit, zwei 16-Bit-Hälften                                                                 |
| Feistel-Block für 8 Zeichen            | 42 Bit, zwei 21-Bit-Hälften                                                                 |
| Domain-Restriktion                      | Cycle-Walking auf den kanonischen Intervallraum`[36^(L-1), 36^L)`, maximal 128 Iterationen |
| Feistel-Secret                          | Cloudflare Secret`FEISTEL_SECRET`                                                          |
| HMAC-Secret                             | Cloudflare Secret`TAG_HMAC_SECRET`                                                         |
| HMAC-Algorithmus                        | HMAC-SHA-256                                                                                 |
| HMAC-Eingabe                            | `myqr24/tag/v1/8:{base}`, wobei `base = decodedValue & ~0x0f`                            |
| HMAC-Prüfwert                          | untere 4 Bit des ersten HMAC-Bytes                                                           |
| 8-stellige Slot-Formel                  | `decodedValue = base \| hmacNibble`                                                         |
| Nächste 8-stellige Basis               | `(lastDecodedValue & ~0x0f) + 0x10`                                                        |
| Schrittweite logischer 8-stelliger Tags | `nextBase - base = 16`                                                                     |

Die Feistel-Round-Funktion leitet pro Variante und Runde per SHA-256 aus Secret, Variantendomain, Rundennummer und rechter Hälfte einen Halbblock ab. Die Entschlüsselung verarbeitet die Runden in umgekehrter Reihenfolge.

### Kanonische Base36-Räume

Für jede unterstützte Base36-Länge `L ≥ 1` ist der zulässige decodierte Zahlenraum:

```text
I(L) = [36^(L-1), 36^L)
```

Die Untergrenze ist inklusive, die Obergrenze exklusiv. `I(L)` und `I(M)` sind für `L ≠ M` disjunkt und ihre Vereinigung bildet einen lückenlosen positiven Zahlenraum. Ein Wert wird daher stets mit seiner kürzesten möglichen Base36-Darstellung verarbeitet; führende Nullen und Längenüberschneidungen existieren nicht.

Konkret:

| Länge | Untergrenze inklusive | Obergrenze exklusiv |
| ------ | --------------------- | ------------------- |
| 6      | `36^5`              | `36^6`            |
| 7      | `36^6`              | `36^7`            |
| 8      | `36^7`              | `36^8`            |

Damit beginnt eine achtstellige Tag-ID zwingend bei `36^7`, also exakt am ersten Wert, der sieben Base36-Stellen nicht mehr genügt. Ein nach Feistel-Decodierung außerhalb von `I(L)` liegender Wert wird per Cycle-Walking erneut decodiert, bis er in `I(L)` liegt; andernfalls wird der Tag fail-closed abgelehnt.

> **Implementierungsfolgeregel:** Die Cycle-Walk-Grenzen müssen in `src/index.ts` auf `[36^(L-1), 36^L)` umgesetzt werden. Die vorherige Begrenzung auf `[0, 36^L)` ist für diese Anforderung nicht ausreichend und darf nicht als finales Produktionsformat betrachtet werden.

> Ein 4-Bit-MAC erkennt nur zufällige bzw. nicht gezielt erzeugte fehlerhafte IDs mit begrenzter Wahrscheinlichkeit. Er ist hier als vorgegebene Integritätsprüfung umgesetzt, aber kein Ersatz für ein ausreichend langes Authentifizierungsmerkmal.

## Cloudflare Bindings

### Secrets

Secrets werden nicht in `wrangler.toml` gespeichert und müssen für jede Umgebung getrennt gesetzt werden:

```sh
npx wrangler secret put FEISTEL_SECRET --env staging
npx wrangler secret put TAG_HMAC_SECRET --env staging
npx wrangler secret put REDIRECT_SIGNING_SECRET --env staging

npx wrangler secret put FEISTEL_SECRET --env production
npx wrangler secret put TAG_HMAC_SECRET --env production
npx wrangler secret put REDIRECT_SIGNING_SECRET --env production
```

Staging und Produktion dürfen weder Feistel-, HMAC- noch Redirect-Signing-Secrets teilen.

### KV Namespaces und Worker-Routen

`TAG_CONFIG` ist je Umgebung ein eigener KV-Namespace für Range-Index, Gruppen, Zuweisungen und Features. Die Namespace-IDs werden nach ihrer Anlage in `wrangler.toml` eingetragen:

```toml
[[env.staging.kv_namespaces]]
binding = "TAG_CONFIG"
id = "<staging-kv-namespace-id>"

[[env.production.kv_namespaces]]
binding = "TAG_CONFIG"
id = "<production-kv-namespace-id>"
```

Cloudflare-Routen werden anschließend environment-getrennt konfiguriert:

```text
s.qx4.uk/*             -> myqr24-edge-routing-staging
s.myqr24.com/t/*       -> myqr24-edge-routing-staging
qx4.uk/*               -> myqr24-edge-routing
p.myqr24.com/t/*       -> myqr24-edge-routing
```

Die jeweiligen Worker-Variablen sind `SCAN_ENVIRONMENT = "staging"` und `SCAN_ENVIRONMENT = "production"`. Für lokale Entwicklung wird ein separates Namespace bzw. die Wrangler-KV-Simulation verwendet.

## KV-Datenmodell

### Range-Index

Der Key `tag-range-index` enthält ein JSON-Dokument mit **global nicht überlappenden**, aufsteigend sortierten Ranges. Jede Range besitzt eine stabile `id`, eine kanonische `length` und den Status `active`; nur aktive Ranges werden aufgelöst. Die Invariante gilt über alle Gruppen und alle ID-Längen zugleich. Grenzwerte sind **dezimal codierte Strings**, um Präzisionsverluste zu vermeiden.

```json
{
  "version": 2,
  "ranges": [
    {
      "id": "campaign-summer-6-001",
      "start": "60466176",
      "end": "60467175",
      "groupId": "campaign-summer",
      "length": 6,
      "active": true
    }
  ]
}
```

Der Lookup-Key ist stets der vollständige Feistel-decodierte, kanonische Wert. Für achtstellige IDs gilt:

```text
base              = decodedValue & ~0x0f
hmacNibble        = decodedValue & 0x0f
decodedValue      = base | hmacNibble
```

Der logische Tag-Zähler verwendet somit 16er-Slots. Die nächste Basis ergibt sich ohne Shift direkt als `(lastDecodedValue & ~0x0f) + 0x10`; das HMAC-Nibble ist kein eigener fortlaufender Wert. Die vier HMAC-Bits gehören dennoch zum konkreten, validierten Range-Key und werden nicht vor der Range-Suche entfernt. Dies verhindert Kollisionen mit den Räumen kürzerer ID-Längen.

Ranges für achtstellige Tags sollen ganze Slots abdecken (`start % 16 = 0`, `end % 16 = 15`). Die 15 nicht mit dem korrekten HMAC belegten Werte jedes Slots erreichen diesen Lookup niemals, weil die HMAC-Prüfung davor fail-closed durchgeführt wird.

Da Cloudflare KV keine numerische Range-Abfrage bereitstellt, lädt der Worker diesen kompakten Index und durchsucht ihn binär. Bei sehr großen oder häufig veränderten Indizes muss das Modell später auf geshardete Präfix-Indizes, D1 oder Durable Objects erweitert werden.

### Verwaltungsdatenbank und Tag-Ausgabe

Die spätere Verwaltungsdatenbank ist die autoritative Quelle für bereits ausgegebene Tags. Pro Tag speichert sie mindestens:

| Feld             | Repräsentation          | Zweck                                                             |
| ---------------- | ------------------------ | ----------------------------------------------------------------- |
| `decodedValue` | Dezimaler Integer-String | Vollständiger Feistel-decodierter und HMAC-validierter Range-Key |
| `tagId`        | Base36-String            | Öffentliche 6- oder 8-stellige NFC-/QR-Tag-ID                    |
| `length`       | Integer                  | Länge der öffentlichen Tag-ID                                   |
| `groupId`      | String                   | Zuordnungs- bzw. Ausgabekontext                                   |
| `createdAt`    | Zeitstempel              | Auditierbarkeit                                                   |

Bei achtstelligen IDs wird ausschließlich der vollständige HMAC-validierte Integer gespeichert. Für die nächste Vergabe wird die Basis des zuletzt ausgegebenen Werts bestimmt und um genau einen Slot erhöht:

```text
nextBase = (lastDecodedValue & ~0x0f) + 0x10
nextDecodedValue = nextBase | HMAC4(nextBase)
```

`lastDecodedValue + 1` ist ausdrücklich keine gültige Vergaberegel. Eindeutige Constraints für `(length, decodedValue)` und `tagId` verhindern neben der festen Slot-Formel auch bei parallelen Vergabevorgängen doppelte Ausgaben.

### Zukünftige Verwaltungs- und Allocation-API

Eine spätere Verwaltungs-Komponente ist für Gruppen, Ranges, Features und die Ausgabe bzw. Registrierung von Tags zuständig. Sie ist die autoritative Schreibseite; der Edge-Worker bleibt eine reine, lesende Auflösungsschicht.

Die API verwaltet mehrere Ranges für unterschiedliche Zwecke. Jede Range besitzt mindestens einen Zweck, eine kanonische Base36-Länge, einen Gruppenbezug und einen eigenen atomar fortgeschriebenen Zähler bzw. Cursor.

Typische Vergabeflüsse:

1. Ein Client fordert für einen bestimmten Zweck eine neue ID mit Länge 6, 7 oder 8 an.
2. Das Backend wählt eine aktive, passende Range dieses Zwecks.
3. Es reserviert atomar den nächsten freien Slot innerhalb dieser Range.
4. Es erzeugt daraus den vollständigen kanonischen Integer, berechnet bei achtstelligen IDs den HMAC-Nibble und codiert die öffentliche Base36-Tag-ID.
5. Es speichert Integer und Tag-ID dauerhaft und liefert beide Werte an den Client zurück.

Bereits physisch gedruckte Tags können ebenfalls registriert werden. Dabei muss das Backend die gedruckte Base36-ID vollständig decodieren, HMAC und kanonischen Längenraum prüfen und verifizieren, dass der resultierende vollständige Integer exakt in einer für den Zweck zulässigen Range liegt. Erst danach darf die ID als vergeben gespeichert oder einer Gruppe zugeordnet werden.

Für parallele Vergaben sind Datenbanktransaktionen, Zeilen-/Range-Locks oder ein atomarer Counter nötig. Ein reines „letzten Wert lesen, hochzählen, schreiben“ ohne Nebenläufigkeitsschutz ist nicht ausreichend.

> **Unterstützte Längen:** Der Edge-Worker implementiert aktuell 6 und 8 Base36-Stellen. Die Verwaltungs-API darf 7-stellige IDs erst ausgeben, wenn der Worker um eine separat definierte 7-stellige Feistel-Domäne, Cycle-Walking und Testvektoren erweitert wurde. Der kanonische Raum dafür ist bereits eindeutig: `I(7) = [36^6, 36^7)`.

### Regelauflösung und Überschreibungsreihenfolge

Nach erfolgreicher Validierung ermittelt der Worker **zuerst** die passende aktive Range. Ohne Range endet jeder Request mit `404 Not Found`. Innerhalb dieser bestätigten Range wird anschließend die Regel mit folgender Priorität gesucht:

1. **Direkte Tag-Regel:** `tag:{decodedValue}` — gilt ausschließlich für einen konkreten vollständigen kanonischen Integer und überschreibt alle allgemeineren Regeln.
2. **Range-Regel:** `range-rule:{rangeId}` — enthält die Feature-Zuweisung für alle Tags der konkreten Range und überschreibt Gruppenregeln.
3. **Gruppen-Regel bzw. Gruppen-Features:** `group:{groupId}` — enthält die Standard-Feature-Zuweisung für alle Ranges derselben Gruppe.
4. **Keine auflösbare Regel:** `404 Not Found`.

Eine direkte Tag-Regel darf nur dann ausgeführt werden, wenn der Tag-Wert in einer aktiven, gültigen Range liegt. Das verhindert, dass versehentlich oder böswillig angelegte Einzelregeln Werte außerhalb des verwalteten ID-Raums aktivieren.

### Direkte Tag-Regel

Der KV-Key `tag:{decodedValue}` verwendet den vollständigen dezimalen kanonischen Integer, einschließlich HMAC-Nibble bei achtstelligen Tags:

```json
{
  "featureIds": ["redirect-special-customer"]
}
```

Direkte Tag-Regeln enthalten keine kopierten Redirect-Definitionen. Sie weisen einem einzelnen Tag ausschließlich wiederverwendbare Features zu.

### Gruppe

Der Key `group:{groupId}` enthält ein Gruppendokument:

```json
{
  "id": "campaign-summer",
  "featureIds": ["redirect-summer-campaign"]
}
```

Eine Gruppe ist die Standardzuweisung für ihre Ranges. Sie enthält Feature-Referenzen, nicht die konkrete Feature-Implementierung.

## Feature-Modell

Features sind eigenständige, wiederverwendbare KV-Dokumente. Sie liegen unter dem Key-Schema:

```text
feature:{featureId}
```

Tag-, Range- und Gruppenregeln enthalten ausschließlich geordnete `featureIds`. Damit können dieselben Redirects, TAG-Vault-, TAG-Chat-, Lost-&-Found- oder TAG-Guestbook-Abläufe mehreren Ranges und Gruppen zugeordnet werden, ohne URL- oder Feature-Logik zu kopieren.

```json
{
  "id": "redirect01",
  "type": "redirect",
  "enabled": true,
  "urlTemplate": "https://www.myqr24.com/app?tagid={tagId}&id={decodedValue}",
  "signing": {
    "ttlSeconds": 60
  },
  "status": 302
}
```

```json
{
  "id": "vault-standard",
  "type": "tag-vault",
  "enabled": true,
  "appUrlTemplate": "https://app.myqr24.com/tag/{tagId}",
  "presentation": "public-page"
}
```

```json
{
  "id": "finder-chat",
  "type": "tag-chat",
  "enabled": true,
  "appUrlTemplate": "https://app.myqr24.com/chat/{tagId}",
  "activationMode": "lost-only",
  "chatStatus": "open"
}
```

```json
{
  "id": "lost-found-luggage",
  "type": "lost-found",
  "enabled": true,
  "appUrlTemplate": "https://app.myqr24.com/lost-found/{tagId}",
  "chatFeatureId": "finder-chat"
}
```

```json
{
  "id": "wedding-guestbook",
  "type": "tag-guestbook",
  "enabled": true,
  "appUrlTemplate": "https://app.myqr24.com/guestbook/{tagId}"
}
```

```json
{
  "id": "summit-checkin-standard",
  "type": "tag-checkin",
  "enabled": true,
  "appUrlTemplate": "https://app.myqr24.com/check-in/{tagId}",
  "verification": {
    "requiredLevel": "geo-proximity",
    "allowOfflineQueue": true,
    "requireUserAccount": true
  },
  "collectionDefault": {
    "aggregation": "one-per-window",
    "windowSeconds": 86400,
    "allowPrecisionUpgradeWithinWindow": true
  }
}
```

Unterstützte und künftig vorgesehene Typen:

- **`redirect`**: Gibt eine sichere HTTP-Weiterleitung an eine vollständig konfigurierte URL oder ein konfiguriertes `urlTemplate` zurück. Zulässig sind nur `http:` und `https:`.
- **`image`**: Beschreibt ein Bildobjekt, z. B. mit einer R2-Referenz oder einer öffentlich konfigurierten URL. Der Worker liefert ein JSON-Aktionsdokument aus.
- **`json`**: Liefert eine konfigurierte JSON-Payload bzw. eine Referenz für eine statische PWA.
- **`feature-set`**: Referenziert mehrere Features für zusammengesetzte Abläufe, etwa TAG Vault mit einer optionalen PWA-Begleitfunktion.
- **`tag-vault`**: Verweist auf die TAG-Vault-PWA für Owner-Inhalte, Galerie, Audio, Dokumente und Sichtbarkeiten.
- **`tag-chat`**: Verweist auf die TAG-Chat-PWA für private 1:1-Threads; Nachrichten, Besucher-Sessions und Medien liegen nicht in KV.
- **`lost-found`**: Verweist auf die Lost-&-Found-PWA; der Verluststatus und die `lost-only`-Freigabe des TAG Chat werden serverseitig durch die Fachanwendung geprüft.
- **`tag-guestbook`**: Verweist auf die TAG-Guestbook-PWA für zeitlich begrenzte, moderierte Sammelbeiträge.
- **`tag-checkin`**: Verweist auf die Check-in-PWA für Scan-Erfassung und den Einstieg in GEO-verifizierte Besuche. Owner-Position, Radius, GPS-Werte, Signaturen, Collections, Campaigns und Rewards liegen nicht in KV. Die fachliche Spezifikation steht in `TAG_CHECKIN_COLLECTIONS_CAMPAIGNS.md`.

### PWA-Feature-Grenzen

Der Edge Worker validiert ausschließlich öffentliche Tag-ID, Range und Feature-Dokument. Er darf weder Owner- noch Besucher-Sessions, Chat-Threads, Lost-&-Found-Status, Gästebuchfenster, Beiträge, Check-in-Standorte, Scan-Ereignisse, Collections, Campaign-Credits, private Asset-Keys oder Berechtigungsentscheidungen auswerten.

Die jeweilige PWA/API prüft diese fachlichen Zustände bei jedem öffentlichen oder schreibenden Aufruf serverseitig. Für `tag-checkin` gehören dazu insbesondere Owner-konfigurierter GeoFence, Zeit- und Genauigkeitsregeln, Offline-Synchronisation, append-only Server-Signaturen, Aggregation von Collection-Besuchen und Campaign-Policies. Sie verwendet D1/PostgreSQL für autoritative Metadaten und private R2-Objekte für Bilder, Voice und weitere Anhänge. Realtime kann zunächst Polling oder Server-Sent Events verwenden; Durable Objects sind eine optionale spätere WebSocket-/Fan-out-Erweiterung sowie für atomare Reward- oder per-Tag-Limit-Entscheidungen geeignet.

### Feature-Zuweisung und Priorität

Die Range muss immer zuerst bestätigt werden. Anschließend bestimmt die spezifischste vorhandene Zuweisung die primäre Aktion:

```text
tag:{decodedValue}.featureIds
  vor range-rule:{rangeId}.featureIds
  vor group:{groupId}.featureIds
```

Für die erste Version **ersetzt** eine spezifischere nicht leere `featureIds`-Liste die Liste der allgemeineren Ebene. Das garantiert für Redirects ein eindeutiges Ziel.

Eine spätere Erweiterung kann Begleitfeatures wie Analytics oder PWA-Metadaten von Gruppe, Range und Tag zusammenführen. Dafür müssen primäre Aktionsfeatures und additive Begleitfeatures getrennt modelliert und über ein explizites Feld wie `mode: "replace" | "append"` sowie eine stabile Reihenfolge gesteuert werden.

### Redirect-Templates

Ein `redirect`-Feature besitzt entweder `url` für ein festes Ziel oder `urlTemplate` für ein dynamisch gerendertes Ziel. Templates sind vollständig serverseitige KV-Konfiguration und akzeptieren ausschließlich diese Platzhalter:

| Platzhalter | Quelle |
| --- | --- |
| `{tagId}` | Normalisierte öffentliche Base36-Tag-ID, z. B. `abz4j5ja` |
| `{decodedValue}` | Vollständiger kanonischer Integer als dezimaler String |
| `{length}` | Länge der Tag-ID, z. B. `8` |
| `{groupId}` | ID der aufgelösten Gruppe |
| `{tagSignature}` | Reserviert und in der aktuellen Implementierung fail-closed abgelehnt |

Beispiele:

```json
{
  "id": "redirect-app",
  "type": "redirect",
  "urlTemplate": "https://www.myqr24.com/app?tagid={tagId}&id={decodedValue}&sig={tagSignature}",
  "status": 302
}
```

```json
{
  "id": "redirect-path-app",
  "type": "redirect",
  "urlTemplate": "https://app.example.org/tag/{tagId}:{decodedValue}",
  "status": 302
}
```

Unbekannte Platzhalter, fehlerhafte Template-Syntax oder ein nach dem Rendern ungültiges Nicht-HTTP(S)-Ziel führen fail-closed zu `404`. Request-Parameter des Endnutzers dürfen niemals als Redirect-Template oder als Platzhalterwert verwendet werden.

#### Kurzlebig signierte Redirects

Ein Redirect kann mit `signing.ttlSeconds` (ganzzahlig von `10` bis `300`) aktiviert werden. Der Worker rendert zunächst das vollständige serverseitige Ziel und fügt anschließend `exp` als Unix-Ablaufzeit sowie `sig` als ungepolsterte Base64url-HMAC-SHA-256-Signatur hinzu. Die HMAC bindet Versionskennung, Feature-ID, Ziel-URL ohne `exp`/`sig`, Tag-ID, vollständigen decodierten Wert, Länge, Gruppen-ID und Ablaufzeit. `exp` oder `sig` dürfen nicht bereits in der konfigurierten Ziel-URL stehen.

Das Ziel-Backend muss das gemeinsame Secret `REDIRECT_SIGNING_SECRET` verwenden, den Ablauf prüfen und die exakt kanonische HMAC-Nachricht neu bilden. Die Prüfung darf nie im Browser erfolgen. Dieses Modell verhindert Änderungen und eine Verwendung nach Ablauf, jedoch keine Wiederholung innerhalb der TTL. Echte Einmalverwendung erfordert beim Zielsystem zusätzlich einen zufälligen `jti` und atomaren Verbrauchsspeicher, beispielsweise dessen Datenbank oder Redis mit `SET NX EX`; Cloudflare KV ist dafür nicht ausreichend atomar.

Ohne auflösbares Redirect-Feature liefert der Worker die aufgelösten Features als JSON-Aktionsdokument. Dadurch kann eine PWA die Tag-ID scannen, den Worker aufrufen und anschließend die passende clientseitige Funktion ausführen. Neue Feature-Typen werden durch neue Varianten ergänzt, ohne die Tag-, Range- oder Gruppenauflösung zu verändern.

## Sicherheit

- Tag-IDs und Redirect-Ziele werden strikt validiert.
- Redirect-Ziele stammen ausschließlich aus KV-Konfiguration; externe Nutzereingaben werden nicht als Ziel verwendet.
- Secrets werden ausschließlich über Cloudflare Secrets bereitgestellt.
- `BigInt` wird für alle Tag-Identitäten, Grenzen und Decodierungswerte verwendet.
- Alle kanonischen ID-Räume folgen der Invariante `[36^(L-1), 36^L)` und sind dadurch längendisjunkt.
- Der Range-Index ist global sortiert und nicht überlappend; daher kann ein Tag höchstens einer Gruppe zugeordnet werden.
- Bei achtstelligen IDs wird die maskierte Basis (`decodedValue & ~0x0f`) per HMAC geprüft; der vollständige HMAC-validierte decodierte Wert bleibt der Range-Key.
- Signierte Redirects verwenden `REDIRECT_SIGNING_SECRET` und eine auf 10 bis 300 Sekunden begrenzte TTL; der Empfänger muss HMAC und Ablauf serverseitig prüfen.
- Ablauf und HMAC ersetzen keinen atomaren Einmal-Token-Verbrauch beim Zielsystem.
- Invalidität, HMAC-Fehler, fehlende Range und fehlende Gruppe führen ohne Detailinformationen zu `404`.
