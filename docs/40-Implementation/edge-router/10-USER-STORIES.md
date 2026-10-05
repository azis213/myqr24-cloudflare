# User Stories und Akzeptanzkriterien

## US-001 — Öffentliche Tag-URL auflösen

**Als** NFC-/QR-Tag-Nutzer  
**möchte ich** eine gültige öffentliche Tag-URL aufrufen können,  
**damit** der Worker die zugehörige Aktion am Edge ausführt.

### Akzeptanzkriterien

- `https://qx4.uk/{TAG-ID}` akzeptiert genau ein Base36-Pfadsegment mit 6 oder 8 Zeichen.
- `https://p.myqr24.com/t/{TAG-ID}` akzeptiert genau die dokumentierte Kompatibilitätsform.
- Groß- und Kleinschreibung der Tag-ID führt zum selben normalisierten Wert.
- Andere Hosts, Pfade, zusätzliche Segmente und andere ID-Längen führen zu `404`.

## US-002 — Fail-closed Fehlerbehandlung

**Als** Sicherheitsverantwortlicher  
**möchte ich** technische Validierungsfehler einheitlich behandeln,  
**damit** keine Informationen über Tagbestand, Konfiguration oder kryptografische Details offengelegt werden.

### Akzeptanzkriterien

- Ungültige URL, Base36-Parsing-Fehler, Feistel-/Cycle-Walk-Fehler, HMAC-Fehler, fehlende Range, fehlende Zuweisung, fehlendes Feature und fehlerhafte Feature-Konfiguration liefern `404`.
- Nur `GET` und `HEAD` sind zulässig; alle anderen Methoden liefern `405` mit `Allow: GET, HEAD`.
- Ein `HEAD`-Request gibt keinen Response-Body zurück.

## US-003 — Kanonische ID-Räume und vollständige Integer

**Als** Plattform  
**möchte ich** alle Tag-IDs als vollständige kanonische `BigInt`-Werte verarbeiten,  
**damit** unterschiedliche Base36-Längen keine numerischen Überschneidungen verursachen.

### Akzeptanzkriterien

- Die Feistel-Decodierung cycle-walkt in den exakten Raum `I(L) = [36^(L-1), 36^L)`.
- Sechsstellige Tags verwenden ausschließlich `I(6)`.
- Achtstellige Tags verwenden ausschließlich `I(8)`.
- Range-Lookups arbeiten mit dem vollständigen Feistel-decodierten kanonischen Integer.
- JavaScript-`number` wird nicht für IDs oder Range-Grenzen verwendet.

## US-004 — HMAC-Integrität für achtstellige Tags

**Als** Sicherheitsverantwortlicher  
**möchte ich** die Integrität jedes achtstelligen Tags vor einem Konfigurations-Lookup prüfen,  
**damit** nur der korrekte Wert eines 16er-Slots aufgelöst werden kann.

### Akzeptanzkriterien

- Für eine 8-stellige ID wird `base = decodedValue & ~0x0fn` gebildet.
- Das gelieferte HMAC-Nibble ist `decodedValue & 0x0fn`.
- Das erwartete Nibble ist der niederwertige Halbbyte-Wert von `HMAC-SHA-256("myqr24/tag/v1/8:{base}")`.
- Ungültige Nibbles führen zu `404`, bevor `TAG_CONFIG.get` aufgerufen wird.
- Ein gültiger 8-stelliger Tag verwendet den vollständigen `decodedValue` einschließlich HMAC-Nibble als Range-Key.

## US-005 — Aktive und valide Range ermitteln

**Als** Betreiber  
**möchte ich** nur Tags innerhalb einer aktiven, validen und nicht überlappenden Range auflösen,  
**damit** der verwaltete ID-Raum eindeutig und kontrollierbar bleibt.

### Akzeptanzkriterien

- Jede Range enthält `id`, `start`, `end`, `groupId`, `length` und `active`.
- Der globale Index ist strikt aufsteigend und nicht überlappend.
- Ein Tag kann nur eine Range seiner eigenen Base36-Länge treffen.
- Nur `active: true` ermöglicht die nachfolgende Regelauflösung.
- Fehlerhafte Indizes, inaktive Ranges und fehlende Treffer liefern `404`.

## US-006 — Feature-Zuweisung nach Priorität

**Als** Administrator  
**möchte ich** Features einem einzelnen Tag, einer Range oder einer Gruppe zuweisen,  
**damit** allgemeine Regeln gezielt überschrieben werden können.

### Akzeptanzkriterien

- Die technische Auflösung bestätigt zuerst die aktive Range.
- Danach gewinnt die erste nicht leere Zuweisung in der Priorität:
  `tag:{decodedValue}` → `range-rule:{rangeId}` → `group:{groupId}`.
- Jede Zuweisung enthält ausschließlich `featureIds`.
- Eine direkte Tag-Zuweisung außerhalb einer aktiven Range wird niemals ausgeführt.
- Für die erste Version ersetzt eine spezifischere Zuweisung die allgemeinere vollständig.

## US-007 — Wiederverwendbare Feature-Dokumente

**Als** Administrator  
**möchte ich** Redirects und andere Aktionen als wiederverwendbare KV-Features definieren,  
**damit** dieselbe Logik mehreren Tags, Ranges und Gruppen ohne Duplizierung zugeordnet werden kann.

### Akzeptanzkriterien

- Ein Feature liegt unter `feature:{featureId}`.
- Ein Feature besitzt mindestens `id`, `type` und `enabled`.
- Nur Features mit `enabled: true` werden verwendet.
- Jede referenzierte Feature-ID wird fail-closed geladen und validiert.
- Nicht-Redirect-Features werden als JSON-Aktionsdokument zurückgegeben.

## US-008 — Sichere Redirect-Templates

**Als** Administrator  
**möchte ich** serverseitig kontrollierte Redirect-Ziele mit Platzhaltern definieren,  
**damit** die Zielanwendung Tag-Kontext erhält, ohne offene Redirects zu erlauben.

### Akzeptanzkriterien

- Ein Redirect-Feature besitzt genau eines von `url` oder `urlTemplate`.
- Zulässige Platzhalter sind `{tagId}`, `{decodedValue}`, `{length}`, `{groupId}` und `{tagSignature}`.
- `{tagSignature}` ist in dieser Ausbaustufe nicht verfügbar; seine Verwendung führt daher fail-closed zu `404`.
- Unbekannte oder syntaktisch fehlerhafte Platzhalter führen zu `404`.
- Das gerenderte Ziel muss eine absolute `http:`- oder `https:`-URL sein.
- Die Statuscodes sind auf `301`, `302`, `303`, `307` und `308` beschränkt.
- Werte aus Query-Parametern oder anderen Nutzereingaben werden niemals als Template oder Redirect-Wert übernommen.

## US-009 — JSON-Aktionsdokument liefern

**Als** PWA-Client  
**möchte ich** aufgelöste nicht redirectende Features als JSON erhalten,  
**damit** ich die zugehörige Aktion clientseitig darstellen oder ausführen kann.

### Akzeptanzkriterien

- Existiert kein auflösbares aktives Redirect-Feature, liefert `GET` ein JSON-Aktionsdokument.
- Das Dokument enthält normalisierte `tag.id`, vollständiges `tag.value`, `range.id`, `group.id` und die aufgelösten Features.
- Die Antwort enthält `Cache-Control: no-store`.
- `HEAD` liefert für eine valide Auflösung denselben Status ohne Response-Body.

## US-010 — Reproduzierbare Evidenz

**Als** Betreiber und Prüfer  
**möchte ich** Anforderungen, Tests, Daten und Ausführungsergebnisse verknüpfen,  
**damit** der Implementierungsstand überprüfbar bleibt.

### Akzeptanzkriterien

- Jede Story verweist über die Traceability Matrix auf Testfälle und Code.
- Testdaten sind nicht geheim, versioniert und als ausführbare Fixtures verfügbar.
- `npm test` und `npm run build` bilden die primäre reproduzierbare Evidenz.
- `STATUS.md` dokumentiert den Status aller Arbeitspakete und Stories.
