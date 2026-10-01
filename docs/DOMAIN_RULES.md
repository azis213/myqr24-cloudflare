# Domain-, Tag- und Routing-Regeln

> Diese Datei ist die fachliche Referenz für die öffentliche URL-Auflösung. Änderungen an Domains, Tag-Formaten, kryptographischen Parametern, KV-Datenformaten und Features müssen zuerst hier beschrieben und anschließend durch Tests abgesichert werden.

## Öffentliche Domains

| Domain / Hostname | Zulässiger Pfad | Zweck | Verhalten |
| --- | --- | --- | --- |
| `qx4.uk` | `/{TAG-ID}` | Kurze NFC-/QR-Tag-URL | Tag auflösen |
| `p.myqr24.com` | `/t/{TAG-ID}` | myQR24-Kompatibilitäts-URL | Tag auflösen |

Hosts werden unabhängig von Groß-/Kleinschreibung verglichen. Alle anderen Hosts, Pfade und zusätzliche Pfadsegmente liefern `404 Not Found`.

## Tag-ID-Spezifikation

| Eigenschaft | Regel |
| --- | --- |
| Alphabet | Base36: `0-9`, `a-z`; Eingaben sind case-insensitiv |
| Längen | Genau 6 oder 8 Stellen |
| Normalisierung | Tag-ID wird vor der Verarbeitung zu Kleinbuchstaben normalisiert |
| Numerische Repräsentation | Verlustfreie Umwandlung in `BigInt` |
| Fehlerbehandlung | Ungültige IDs werden nicht näher erläutert und liefern `404` |

### Kanonische, längendisjunkte ID-Räume

Für jede Base36-Länge `L ≥ 1` ist ausschließlich das folgende Intervall zulässig:

```text
I(L) = [36^(L-1), 36^L)
```

Die Untergrenze ist inklusive, die Obergrenze exklusiv. Damit sind alle Längenräume paarweise disjunkt:

```text
I(6) = [36^5, 36^6)
I(7) = [36^6, 36^7)
I(8) = [36^7, 36^8)
```

Eine achtstellige ID beginnt folglich zwingend bei `36^7`, dem ersten Wert, der nicht mehr mit sieben Base36-Stellen darstellbar ist. Führende Nullen und numerische Überschneidungen zwischen ID-Längen sind verboten.

Der Feistel-Decoder muss nach seiner Entschlüsselung per Cycle-Walking so lange erneut angewendet werden, bis der Wert im kanonischen Raum `I(L)` der ursprünglichen Tag-Länge liegt. Wird dieser Zustand innerhalb des definierten Limits nicht erreicht, ist der Tag ungültig und liefert `404`.

### Sechsstellige IDs

1. Die eingehende Base36-ID ist genau sechs Zeichen lang.
2. Sie wird in der getrennten 32-Bit-Feistel-Domäne decodiert.
3. Cycle-Walking erzwingt den kanonischen Wertebereich `I(6) = [36^5, 36^6)`.
4. Der **vollständige decodierte Wert** ist der kanonische Range-Key und wird im Range-Index gesucht.

### Achtstellige IDs

1. Die eingehende Base36-ID ist genau acht Zeichen lang.
2. Sie wird in der getrennten 42-Bit-Feistel-Domäne decodiert.
3. Cycle-Walking erzwingt den kanonischen Wertebereich `I(8) = [36^7, 36^8)`.
4. Der vollständige decodierte 42-Bit-Wert wird ohne Shift wie folgt zerlegt:

   ```text
   base               = decodedValue & ~0x0f
   suppliedHmacNibble = decodedValue & 0x0f
   decodedValue       = base | suppliedHmacNibble
   ```

5. `base` ist der vollständige numerische Wert mit vier für den HMAC reservierten und auf `0` gesetzten Bits. `suppliedHmacNibble` muss den unteren vier Bit von `HMAC-SHA-256(base)` entsprechen.
6. Bei HMAC-Abweichung erfolgt immer `404`.
7. **Der fortlaufende logische Tag-Zähler erhöht sich um eins, sein numerischer 8-stelliger Basisslot jedoch immer um 16.** Die nächste Basis wird direkt aus der letzten vollständigen ID bestimmt:

   ```text
   nextBase = (lastDecodedValue & ~0x0f) + 0x10
   ```

   Für zwei aufeinanderfolgende Slots gilt damit `base(k + 1) = base(k) + 16`.

8. Der HMAC-Nibble ist kein eigener Zähler und verbraucht keinen Wert des fortlaufenden Tag-Raums. Er belegt ausschließlich einen der 16 möglichen Werte innerhalb des Slots `[base, base + 15]`.
9. **Der vollständige decodierte Wert einschließlich des HMAC-Nibbles ist der kanonische Range-Key.** Der HMAC-validierte Wert liegt somit immer im eindeutigen 16er-Slot seiner logischen Tag-Nummer.

Die numerische Differenz zwischen zwei tatsächlich ausgegebenen vollständigen Werten kann wegen verschiedener HMAC-Nibbles von exakt `16` abweichen. Die Struktur des Tag-Raums steigt jedoch zwingend in 16er-Slots: `base(k + 1) - base(k) = 16`. Dadurch ist der HMAC ausschließlich Bestandteil einer ID innerhalb ihres 16er-Schritts und erzeugt keine zusätzlichen fortlaufenden Tag-Nummern.

Der vollständige HMAC-validierte Wert ist jederzeit ein kompletter Integer und wird unverändert als kanonische ID gespeichert und für die Range-Auflösung verwendet. Für die Erzeugung der nächsten gültigen ID darf dieser Wert jedoch **nicht direkt um eins** erhöht werden, weil dadurch ein HMAC-Nibble aus einem vorherigen Slot übernommen würde. Die einzig zulässige Fortschreibung lautet:

```text
nextBase = (lastDecodedValue & ~0x0f) + 0x10
nextDecodedValue = nextBase | HMAC4(nextBase)
```

Damit bleiben sowohl die gespeicherte ID als auch jede neu erzeugte ID vollständige, HMAC-validierte Integer. Maskierungs- oder Shiftfehler können nicht zu einer Überschneidung der logischen 16er-Slots führen.

Diese Trennung ist zwingend: Würde bei achtstelligen IDs nur die maskierte `base` im Range-Index gesucht, wäre der tatsächliche HMAC-validierte konkrete Wert nicht mehr der Lookup-Key. Der vollständige decodierte Wert bleibt dagegen stets in `I(8)` und ist daher global längendisjunkt.

## Kryptographische Festlegungen

| Parameter | Festlegung |
| --- | --- |
| Feistel-Runden | 10 |
| Feistel-Secret | Cloudflare Secret `FEISTEL_SECRET` |
| HMAC-Secret | Cloudflare Secret `TAG_HMAC_SECRET` |
| Redirect-Signing-Secret | Cloudflare Secret `REDIRECT_SIGNING_SECRET`; ausschließlich für kurzlebige signierte Redirect-URLs |
| Feistel-Round-Funktion | SHA-256 über Secret, Varianten-Domain, Rundennummer und rechte Blockhälfte |
| HMAC | HMAC-SHA-256 über `myqr24/tag/v1/8:{base}`, wobei `base = decodedValue & ~0x0f` |
| HMAC-Prüfwert | Niederwertige 4 Bit des ersten HMAC-Bytes |
| Cycle-Walk-Limit | 128 Iterationen |

`FEISTEL_SECRET`, `TAG_HMAC_SECRET` und `REDIRECT_SIGNING_SECRET` dürfen nie als Klartext in Git, `wrangler.toml`, KV oder Client-Code gespeichert werden. Sie werden ausschließlich per `wrangler secret put` gesetzt.

> Der 4-Bit-Prüfwert ist eine vorgegebene, kurze Integritätsprüfung und kein Ersatz für eine längere kryptographische Authentifizierung.

## KV-Range-Mappings

Der KV-Namespace `TAG_CONFIG` enthält einen **sortierten, nicht überlappenden** Index unter dem Key `tag-range-index`.

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

| Feld | Vorgabe |
| --- | --- |
| `id` | Stabile Range-ID: `[A-Za-z0-9][A-Za-z0-9_-]{0,127}`; Schlüsselteil für `range-rule:{id}` |
| `start`, `end` | Nicht negative dezimale Integer als Strings innerhalb von `I(length)` |
| `groupId` | `[A-Za-z0-9][A-Za-z0-9_-]{0,127}` |
| `length` | Aktuell ausschließlich `6` oder `8`; muss zur Tag-Länge und zum kanonischen Range-Raum passen |
| `active` | Boolean; nur `true` erlaubt die weitere Regelauflösung |
| Reihenfolge | Strikt aufsteigend nach `start` |
| Überlappung | Nicht zulässig |
| Lookup-Key | Vollständiger Feistel-decodierter, kanonischer `BigInt`-Wert |
| 8-stelliger Schlüssel | HMAC-validierter Wert `base \| hmacNibble` innerhalb eines 16er-Slots, mit `base % 16 = 0` |
| Range-Grenzen für 8 Stellen | Verpflichtend an 16er-Slotgrenzen: `start % 16 = 0` und `end % 16 = 15` |
| Lookup | Binäre Suche gegen den kanonischen Range-Key |
| Keine passende oder inaktive Range | `404 Not Found` |

Die Ranges sind über **alle Gruppen und ID-Längen global** sortiert und nicht überlappend. Für eine Gruppe dürfen mehrere disjunkte Ranges existieren; auch diese müssen Teil desselben globalen, nicht überlappenden Index sein. Eine Tag-ID kann dadurch höchstens genau einer Gruppe zugeordnet werden.

Der Worker verwirft den vollständigen Index fail-closed, wenn ein Eintrag ungültig, nicht sortiert oder überlappend ist.

## Edge-Auflösung und Regelpriorität

Die Edge-Auflösung folgt zwingend dieser Reihenfolge:

1. Öffentliche URL validieren und die Base36-Tag-ID normalisieren.
2. Tag-ID per Feistel-Netz decodieren und in den kanonischen Längenraum zurückführen.
3. Bei achtstelligen IDs `base = decodedValue & ~0x0f` bilden und den HMAC-Nibble prüfen. Bei Abweichung endet die Auflösung sofort mit `404`.
4. Den vollständigen kanonischen `decodedValue` im globalen Range-Index suchen. Ohne passende **aktive** Range endet die Auflösung mit `404`.
5. Ausschließlich innerhalb der bestätigten Range die erste verfügbare Regel dieser Priorität anwenden:
   1. direkte Tag-Regel,
   2. Range-Regel,
   3. Gruppen-Regel bzw. Gruppen-Features.
6. Die aufgelöste Regel ausführen, z. B. als Redirect oder JSON-Aktionsdokument.

Eine direkte Tag-Regel darf keine Werte außerhalb einer aktiven, gültigen Range aktivieren. Der vollständige Integer einschließlich HMAC-Nibble bei achtstelligen IDs ist dabei immer der Schlüssel für Lookup, Range-Zuordnung und Regelauflösung.

### Direkte Tag-Regeln

Eine direkte Regel wird unter dem KV-Key `tag:{decodedValue}` gespeichert. `{decodedValue}` ist der vollständige dezimale kanonische Integer, bei achtstelligen IDs einschließlich des HMAC-Nibbles.

```json
{
  "featureIds": ["redirect-special-customer"]
}
```

Direkte Tag-Regeln speichern keine kopierten Redirect- oder sonstigen Feature-Definitionen. Sie referenzieren ausschließlich wiederverwendbare Feature-Dokumente.

### Range-Regeln

Eine Range kann eine eigene Feature-Zuweisung für alle enthaltenen Tags besitzen. Sie überschreibt die Gruppen-Zuweisung, aber nicht eine direkte Tag-Zuweisung. Jede Range besitzt deshalb eine verpflichtende stabile `id`; die Zuweisung wird unter `range-rule:{rangeId}` gespeichert:

```json
{
  "featureIds": ["lost-found"]
}
```

## Verwaltungsdatenbank und Tag-Ausgabe

Die spätere Verwaltungsdatenbank ist die autoritative Quelle für ausgegebene Tags. Sie speichert für jeden Tag mindestens beide korrespondierenden Werte:

| Feld | Speicherung | Bedeutung |
| --- | --- | --- |
| `decodedValue` | Dezimaler Integer-String | Vollständiger, Feistel-decodierter und HMAC-validierter kanonischer Range-Key |
| `tagId` | Base36-String | Öffentliche 6- oder 8-stellige NFC-/QR-Tag-ID |
| `length` | Integer | Länge der öffentlichen Base36-Tag-ID |
| `groupId` | String | Zugeordnete Gruppe bzw. Range-Kontext |
| `createdAt` | Zeitstempel | Nachvollziehbarkeit der Tag-Ausgabe |

`decodedValue` enthält bei achtstelligen IDs den HMAC-Nibble bereits in den vier niederwertigen Bits. Der Wert wird weder geteilt noch ohne HMAC gespeichert. Für die nächste Vergabe wird aus dem zuletzt vergebenen vollständigen Wert ausschließlich die maskierte Basis abgeleitet und um `16` erhöht; anschließend wird der neue HMAC berechnet und eingesetzt.

Die Datenbank sollte für mindestens `(length, decodedValue)` und `tagId` eindeutige Constraints besitzen. Damit werden doppelte Ausgaben sowohl auf numerischer als auch auf öffentlicher Base36-Ebene verhindert.

## Gruppen und Features

Eine Range verweist auf `group:{groupId}` im selben KV-Namespace:

```json
{
  "id": "campaign-summer",
  "featureIds": ["redirect-summer-campaign"]
}
```

Gruppen definieren die Standard-Feature-Zuweisung ihrer Ranges. Die konkrete Logik eines Features wird nicht in der Gruppe kopiert.

### Wiederverwendbare Feature-Dokumente

Konkrete Feature-Definitionen liegen separat im KV-Namespace unter:

```text
feature:{featureId}
```

Beispiele:

```json
{
  "id": "redirect-summer-campaign",
  "type": "redirect",
  "enabled": true,
  "urlTemplate": "https://www.myqr24.com/app?tagid={tagId}&id={decodedValue}&sig={tagSignature}",
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

| Feature | Aktuelles Verhalten | Erweiterung |
| --- | --- | --- |
| `redirect` | HTTP-Redirect auf eine konfigurierte `http:`-/`https:`-URL oder ein serverseitiges URL-Template | Ziel-Allowlist, Kampagnenparameter, serverseitige Zielsignatur |
| `image` | Teil der JSON-Antwort für einen PWA-Client | R2-Objektreferenz, Metadaten, signierte URLs |
| `json` | Teil der JSON-Antwort für einen PWA-Client | Validierte Feature-spezifische Konfigurationsschemas |
| `feature-set` | Referenziert mehrere Features für zusammengesetzte Abläufe | TAG Vault mit optionaler PWA-Begleitfunktion |
| `tag-vault` | Verweist auf die TAG-Vault-PWA | Inhalte, Galerie, Dokumente, Audio und Sichtbarkeiten |
| `tag-chat` | Verweist auf die TAG-Chat-PWA | private 1:1-Threads; Tokens, Nachrichten und Medien liegen nicht in KV |
| `lost-found` | Verweist auf die Lost-&-Found-PWA | Verluststatus mit optionalem `lost-only`-TAG-Chat |
| `tag-guestbook` | Verweist auf die TAG-Guestbook-PWA | zeitlich begrenzte, moderierte Event- und Sammelbeiträge |
| `tag-checkin` | Verweist auf die Check-in-PWA | GEO-verifizierte Besuche; Collections und Campaigns werden ausschließlich durch die Anwendungsdomäne ausgewertet |

### PWA-Feature-Grenzen

Der Edge Worker validiert ausschließlich URL, Tag-ID, Range, Regelpriorität und Feature-Dokument. Er verarbeitet keine Owner- oder Besucher-Sessions, Chat-Threads, Lost-&-Found-Status, Gästebuchfenster, Beiträge, private R2-Keys oder Berechtigungsentscheidungen.

Die jeweilige PWA/API erzwingt die fachlichen Regeln serverseitig: Bei `tag-chat` insbesondere Chat-Status und Aktivierungsmodus; bei `lost-found` den Verluststatus; bei `tag-guestbook` Status, Zeitfenster und Moderation; bei `tag-vault` Sichtbarkeit und Freigaben; bei `tag-checkin` GeoFence, GPS-Genauigkeit, Offline-Synchronisation, unveränderliche server-signierte Scan-Ereignisse sowie Collection- und Campaign-Policies. KV enthält ausschließlich nicht geheime Routing-Konfiguration.

`tag-checkin` ist der einzige neue Routing-Feature-Typ für Besuche. Collection, Challenge und Campaign sind keine separaten Edge-Features und enthalten weder Koordinaten noch Scan-Historie im KV. Die vollständige fachliche Spezifikation ist [TAG Check-in, Collections & Campaigns](20-Special-Specifications/TAG_CHECKIN_COLLECTIONS_CAMPAIGNS.md).

POI-/Community-TAGs für Gipfel, Hütten, Museen, touristische Orte und ähnliche öffentliche Standorte sind ebenfalls **keine zusätzlichen Edge-Feature-Typen**. Sie sind eine autorisierte Produktklasse, die `tag-vault` und optional `tag-checkin` sowie `tag-guestbook` kombiniert. Betreiberprüfung, Anbringungszustimmung, Laufzeit, Moderation, Meldeweg, Status und Kontingente werden ausschließlich durch die Application API und Datenbank umgesetzt; sie gehören niemals in `TAG_CONFIG`. Die vollständige Produkt- und Schutzspezifikation steht in [TAG-Typen und POI-/Community-TAGs](20-Special-Specifications/TAG_TYPES_AND_POI_FEATURES.md).

### Feature-Zuweisung

Nach erfolgreicher Range-Bestätigung bestimmt die spezifischste nicht leere Liste die primäre Aktion:

```text
tag:{decodedValue}.featureIds
  vor range-rule:{rangeId}.featureIds
  vor group:{groupId}.featureIds
```

In der ersten Version ersetzt die spezifischere `featureIds`-Liste die Zuweisung der allgemeineren Ebene. Dies gewährleistet für Redirects ein eindeutiges Ziel. Eine spätere Erweiterung darf additive Begleitfeatures erst einführen, wenn primäre Aktionen und ergänzende Features explizit getrennt und z. B. durch `mode: "replace" | "append"` geregelt sind.

### Redirect-Templates

Ein `redirect`-Feature besitzt entweder ein festes `url`-Ziel oder ein `urlTemplate`. Ein Template ist ausschließlich serverseitige Konfiguration und darf nur folgende Platzhalter enthalten:

| Platzhalter | Ersetzungswert |
| --- | --- |
| `{tagId}` | Normalisierte öffentliche Base36-Tag-ID |
| `{decodedValue}` | Vollständiger kanonischer Integer als dezimaler String |
| `{length}` | Länge der Tag-ID |
| `{groupId}` | ID der aufgelösten Gruppe |
| `{tagSignature}` | Für eine künftig definierte serverseitig erzeugte Signatur reserviert; bis zu deren Implementierung nicht verwendbar |

Beispiele:

```json
{
  "type": "redirect",
  "urlTemplate": "https://www.myqr24.com/app?tagid={tagId}&id={decodedValue}&sig={tagSignature}",
  "status": 302
}
```

```json
{
  "type": "redirect",
  "urlTemplate": "https://app.example.org/tag/{tagId}:{decodedValue}",
  "status": 302
}
```

Unbekannte Platzhalter, ungültige Template-Syntax oder ein nach dem Rendern ungültiges Ziel führen fail-closed zu `404`. `{tagSignature}` ist bis zur dokumentierten und getesteten serverseitigen Signaturimplementierung ebenfalls ein fail-closed Fehler. Das Ergebnis muss eine absolute `http:`- oder `https:`-URL sein. Parameter aus der eingehenden Nutzeranfrage dürfen niemals als Template oder als Platzhalterwert in das Redirect-Ziel übernommen werden.

#### Kurzlebig signierte Redirects

Ein Redirect-Feature kann optional eine serverseitige Ablauf-Signatur aktivieren:

```json
{
  "id": "redirect-secure-app",
  "type": "redirect",
  "enabled": true,
  "urlTemplate": "https://target.example/aktion?tag={tagId}&id={decodedValue}",
  "signing": {
    "ttlSeconds": 60
  },
  "status": 302
}
```

`signing.ttlSeconds` muss ein ganzzahliger Wert zwischen `10` und `300` Sekunden sein. Der Worker akzeptiert in einem signierten Ziel keine bereits konfigurierten Query-Parameter `exp` oder `sig`; dies verhindert Mehrdeutigkeit und Überschreiben der Sicherheitsparameter.

Nach dem vollständigen serverseitigen Rendern der Ziel-URL hängt der Worker folgende Parameter an:

| Parameter | Bedeutung |
| --- | --- |
| `exp` | Unix-Zeitstempel in Sekunden; Ende der Gültigkeit |
| `sig` | Base64url-kodierte HMAC-SHA-256-Signatur ohne Padding |

Die HMAC-Nachricht ist UTF-8-kodiert und hat exakt dieses kanonische Format:

```text
myqr24/redirect/v1
feature={featureId}
destination={vollständig gerenderte Ziel-URL ohne exp und sig}
tag={tagId}
id={decodedValue}
length={length}
group={groupId}
exp={exp}
```

Die Zielanwendung muss dieselbe kanonische Nachricht mit `REDIRECT_SIGNING_SECRET` berechnen, `sig` konstantzeitnah vergleichen und `exp` vor Ausführung der Aktion auf eine Zeit in der Zukunft prüfen. Sie darf die Signatur oder Ablaufzeit nie im Browser validieren.

Das Verfahren verhindert Manipulation der gebundenen Parameter und jede Verwendung **nach Ablauf**. Es verhindert keine mehrfache Verwendung derselben gültigen URL innerhalb ihres kurzen Zeitfensters. Eine echte Einmalverwendung benötigt zusätzlich einen kryptographisch zufälligen Token (`jti`) und einen atomaren „nur einmal speichern“-Vorgang beim Empfänger, etwa in dessen Datenbank oder Redis mit `SET NX EX`. Cloudflare KV ist dafür wegen fehlender atomarer Read-then-write-Garantie nicht geeignet.

Wenn die nach der Regelpriorität aufgelösten `featureIds` ein aktives `redirect`-Feature referenzieren, gibt der Worker den Redirect zurück. Ohne auflösbares Redirect-Feature liefert der Worker die aufgelösten Feature-Dokumente als JSON-Aktionsdokument. Somit können PWA-Clients Features flexibel selbst ausführen, ohne die Tag-, Range- oder Gruppenauflösung zu verändern.

## AXX-Spezifikationen

AXX-Formate, Validierung und Mandanten-/Produktzuordnungen sind noch fachlich festzulegen. Sie dürfen erst aktiviert werden, wenn sie mit einem separaten URL- bzw. Feature-Schema dokumentiert und getestet wurden.

## Sicherheitsregeln

- Redirect-Ziele stammen ausschließlich aus geprüfter KV-Konfiguration.
- Der Worker akzeptiert nur `GET` und `HEAD`; andere Methoden liefern `405 Method Not Allowed`.
- Ungültige URL-Strukturen, Feistel-/HMAC-Fehler, fehlende Ranges, fehlende Gruppen und ungültige Konfigurationen liefern einheitlich `404`.
- Alle Tag-Werte und Range-Grenzen werden als `BigInt` verarbeitet.
- Range-Keys sind vollständige kanonische Feistel-Ergebnisse; bei achtstelligen IDs gehören die vier HMAC-Bits zum Range-Key.
- Eine HMAC-Prüfung für achtstellige IDs erfolgt vor jedem Range-, Tag- oder Gruppen-Lookup.
- Direkte Tag-Regeln, Range-Regeln und Gruppen-Regeln werden erst nach erfolgreicher Range-Bestätigung in dieser Priorität aufgelöst: Tag vor Range vor Gruppe.
- Redirect-Templates stammen nur aus geprüfter serverseitiger Konfiguration und dürfen ausschließlich die dokumentierten Platzhalter verwenden.
- Signierte Redirects verwenden `REDIRECT_SIGNING_SECRET`, eine auf 10 bis 300 Sekunden begrenzte TTL und binden Ziel, Feature und vollständigen Tag-Kontext per HMAC-SHA-256.
- Ein HMAC mit Ablaufzeit verhindert keine Wiederholung innerhalb seines Gültigkeitsfensters; echte Einmalverwendung liegt in der Verantwortung eines atomar arbeitenden Ziel-Backends.
- Die kanonischen Räume `[36^(L-1), 36^L)` sind global disjunkt; ein Tag darf daher in höchstens genau einer Range und einer Gruppe liegen.
- Änderungen am kryptographischen Format benötigen eine explizite Migrationsstrategie, weil alte ausgegebene Tags weiterhin decodierbar bleiben müssen.
