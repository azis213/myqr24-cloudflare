# Control Plane TAG Management API v1

**Version:** `v1`  
**Status:** `in-progress-local-slice`  
**Owner:** TAG Control Plane (TCP)  
**Konsument:** TAG Control Center (TCC)  
**Abhängiger Basisvertrag:** [`control-plane-admin-api-v1`](control-plane-admin-api-v1.md)  
**Geltungsbereich:** W2L-Range-, Pool-, Reservierungs- und Lifecycle-Verwaltung mit ausschließlich synthetischen lokalen Daten. Keine öffentliche API, keine KV-Projektion, kein Cloudflare-Publish, keine Claim-/Owner-/Exportfunktion.

## 1. Zweck und fachliche Autorität

Dieser Vertrag definiert die spätere authentisierte TCC-zu-TCP-Verwaltung für:

1. kanonische Range-Konfiguration;
2. Allocation Pools;
3. atomare Reservierung einer TAG-ID aus einem aktiven Pool;
4. TAG-Lifecycle-Übergänge und Sperrungen;
5. zugehörige private Verwaltungsqueries.

TCP ist alleinige Autorität für Validierung, Berechtigungen, Organisationsgrenzen, DB-Transaktionen, Idempotenz, Audit, Lifecycle und die spätere Kommunikation mit dem privaten Codec. TCC stellt ausschließlich serverbestätigte Daten dar und entscheidet weder über Range-Zulässigkeit noch Poolzugriff, Statuswechsel oder die Vergabe einer `tagId`.

Der Vertrag erweitert nicht die öffentliche Routing- oder Runtime-Datenebene. Cloudflare KV erhält erst in W3L die minimale abgeleitete Projektion nach `tag-routing-projection-v1`.

## 2. Explizite Blocker vor Implementierungsbeginn

### 2.1 `W2L-BLK-AUTHZ` – serverseitige Rollen-/Policy-Matrix

Die W2L-Baseline ist verbindlich entschieden und für Pool-Read sowie Reservierung lokal implementiert. Rollen aus TCC oder Session sind lediglich Hinweise; TCP lädt Benutzer, Organisationsrollen und Objektgrenzen serverseitig.

| Commandklasse | erforderliche Rolle/Policy | Organisationsgrenze | Re-Authentisierung |
| --- | --- | --- | --- |
| Range anlegen/ändern/deaktivieren | `platform-admin` | plattformweit | immer |
| Pool der Plattform verwalten | `platform-admin` | plattformweit | immer |
| eigenen Organisationspool verwalten | `platform-admin` oder `organization-admin` | nur explizite `organization_user_roles`-Bindung | immer |
| Reservierung | `platform-admin`, `organization-admin` oder `allocation-operator` | Plattformrolle oder explizit zugewiesener aktiver Organisationspool | immer |
| `draft → pending-review` | Plattformrolle, Organisationsadmin oder zugewiesener Operator | nur eigener/zugewiesener Pool | nein |
| `pending-review → ready-to-publish`, Sperrung, Ablauf, Archivierung | Plattformrolle oder Organisationsadmin | nur eigener Pool | immer |
| `active` | in W2L gesperrt | – | – |
| Listen/Detailqueries | Plattformrolle oder zugewiesene Organisationsrolle | ausschließlich sichtbare Pools, keine Fremdobjektlecks | nein |

Re-Authentisierung ist eine serverseitige, an dieselbe Web-Session gebundene Passwortprüfung mit einem konfigurierten 15-Minuten-Fenster (`TCP_TAG_MANAGEMENT_REAUTH_TTL_SECONDS`, Default `900`). Fehlende, abgelaufene oder fremde Re-Authentisierung wird neutral als `403` behandelt und auditiert. Eine UI-Ausblendung oder die sichtbare Sessionrolle ersetzt diese Prüfung nie.

Der bisher implementierte Slice umfasst `GET /pools`, `POST /pools/{poolId}/reservations` sowie `POST /api/v1/auth/tag-management/reauthenticate`. Range-/Pool-Mutationen und Lifecycle-HTTP-Commands bleiben bis zu ihren Validatoren und Tests fail-closed.

### 2.2 `W2L-BLK-CODEC` – öffentliche TAG-ID bei Reservierung

Eine vollständige Reservierung benötigt den authentisierten Encode-Aufruf gemäß [`tag-codec-internal-v1`](tag-codec-internal-v1.md). TCP besitzt kein Feistel-Secret.

Der lokale W2L-Slice verwendet ausschließlich den injizierten `TagCodecClient` mit `FakeTagCodecClient`. Der Fake enthält kein Feistel-Secret, führt keine Netzwerkaufrufe aus und liefert deterministische lowercase-Test-IDs mit `codecVersion: TEST-S01`. Er erlaubt nur 6, 8 und 10 Stellen sowie maximal 1.000 eindeutige Werte.

Die lokale Retry-Grenze ist:

1. TCP persistiert erst einen idempotenten Allocation-Job und `codec-pending`-Wertreservierungen mit Unique-Constraint auf `(length, decodedValue)`.
2. Der zustandslose Fake-/spätere Internal-Codec darf für denselben Job wiederholt werden.
3. Erfolgreicher Codec-Response, TAG-Mapping, Jobabschluss, Idempotenzantwort und Audit entstehen atomar.
4. Ein Codec-Fehler hinterlässt keinen fertigen Browser-Erfolg und kein publizierbares Mapping, aber die jobgebundene `codec-pending`-Reservierung bleibt gegen Doppelvergabe erhalten.
5. Derselbe Akteur, Command und Idempotency-Key mit abweichendem kanonischen Request liefert `409`; mit identischem Request dieselbe fachliche Antwort.

Für den späteren `InternalHttpTagCodecClient` bleiben 3 Sekunden Gesamt-Timeout, kein synchroner automatischer HTTP-Retry, neutrale `503`-Fehler für Timeout/429/5xx/ungültige Antworten und ein ausschließlich fachlicher Retry über denselben Job verbindlich. Echte Internal-HTTP-Anbindung und kompatible 6-/8-/10-Feistel-Vektoren bleiben vor Staging offen.

Range-, Pool- und Lifecycle-Domäne können nach Auflösung der jeweiligen AuthZ-/Validator-Gates schrittweise implementiert werden. Die lokale synthetische Reservierung ist implementiert; echte Internal-HTTP-Codec- und Staging-Reservierungen bleiben bis zu den beschriebenen Nachweisen gesperrt.

## 3. Kanonische Datenformate und ausgeschlossene Daten

### 3.1 Werte und Identifier

| Feld | Format / Regel |
| --- | --- |
| `length` | ausschließlich JSON-Integer `6`, `8` oder `10` |
| `decodedValue`, `startValue`, `endValue` | kanonischer nicht negativer Dezimalstring ohne Vorzeichen und ohne führende Nullen außer `"0"` |
| kanonischer Raum | `I(L) = [36^(L-1), 36^L)`; `startValue` inklusiv, `endValue` inklusiv |
| `rangeId`, `groupId`, `poolId` | `[A-Za-z0-9][A-Za-z0-9_-]{0,127}` |
| `tagId` | lowercase Base36, exakt 6/8/10 Stellen; ausschließlich Codec-Response, nie Browserinput zur Reservierung |
| `codecVersion` | nicht leere Codec-/Secret-Version aus der authentisierten Internal-Codec-Antwort, etwa `S01` oder `P01`; wird zusammen mit jeder reservierten TAG-Zeile persistiert |
| `idempotencyKey` | UUID; wird serverseitig an Akteur, Commandtyp und kanonischen Requesthash gebunden |
| Status | `draft`, `pending-review`, `ready-to-publish`, `active`, `suspended`, `expired`, `archived` |

`decodedValue` ist immer der vollständige lineare Integer im kanonischen Raum. Sichtbare Feistel-`tagId`-Strings sind niemals Range- oder Poolgrenzen.

### 3.2 Datenklassifikation

| Zulässig im TCC-Contract | Strikt ausgeschlossen |
| --- | --- |
| IDs, Länge, kanonische Grenzen, technischer Status, nicht personenbezogene Kapazitätszahlen, Audit-/Korrelationsreferenz | Feistel-/Codec-/Cloudflare-Secrets, Bearer-Keys, Claim-Credentials, Hashes, PINs, Owner-/Kundendaten, Bestelldaten, Audit-Rohmetadaten, Session- oder Cookieinhalte |
| ggf. zulässiger Organisationsbezug als opaque Referenz nach späterer Policy | fremde Organisationsdetails, Name/Segment/Personendaten in öffentlichen oder Routing-Responses |

Poolname, Kundensegment, Owner- und Bestellreferenzen bleiben private Control-Plane-Daten und fehlen in öffentlichen APIs, KV und späteren Routing-Projektionen.

## 4. Gemeinsame HTTP-Regeln

- Basis: `/api/v1/admin/tag-management`.
- Alle Commands benötigen die serverseitige Web-Session, einen gültigen CSRF-Token nach `control-plane-admin-api-v1`, `Accept: application/json` und `X-Correlation-Id`.
- Jeder schreibende Command verlangt zusätzlich `Idempotency-Key`.
- Responses enthalten `correlation_id`; erfolgreiche Mutationen enthalten eine redigierte `audit_reference`.
- Alle Mutationen laufen in einer TCP-DB-Transaktion. Fachzustand, Audit und spätere Outbox-Vorbereitung entstehen gemeinsam oder gar nicht.
- Eine Policy-Ablehnung, ein unbekanntes privates Objekt oder eine fremde Organisationsgrenze liefert einen neutralen Fehler ohne Existenz-/Kapazitäts-/Ownerleck.
- Antworten sind `Cache-Control: no-store`. Es gibt keinen Browser-KV-, DB-, Codec- oder Publisherzugriff.

### 4.1 Einheitliche Fehlerform

```json
{
  "message": "The given data was invalid.",
  "errors": {
    "request": [
      "Die angeforderte Verwaltungsaktion ist nicht zulässig."
    ]
  },
  "correlation_id": "00000000-0000-4000-8000-000000000000"
}
```

| HTTP | Bedeutung |
| --- | --- |
| `401` | keine gültige Session |
| `403` | serverseitige Policy verweigert die Operation neutral |
| `409` | Idempotency-Key mit abweichendem kanonischem Request oder fachlicher Konflikt |
| `422` | Format-, Invarianten-, Status- oder Referenzfehler ohne interne Details |
| `503` | erforderlicher interner Adapter, insbesondere Codec, nicht verfügbar; keine Mutation persistiert |

## 5. Geplante Contract-Operationen

Die folgenden Pfade sind Contract-Ziele, keine bereits vorhandenen Endpunkte. Sie bleiben bis zur Auflösung der Blocker deaktiviert.

### 5.1 Ranges

```http
GET  /api/v1/admin/tag-management/ranges
POST /api/v1/admin/tag-management/ranges
PATCH /api/v1/admin/tag-management/ranges/{rangeId}
```

Beispiel für eine Range-Mutation:

```json
{
  "rangeId": "demo-range-6-001",
  "groupId": "demo-group",
  "length": 6,
  "startValue": "60466176",
  "endValue": "60467175",
  "active": true
}
```

TCP prüft vor Persistenz:

1. Identifier- und Dezimalformate;
2. beide Grenzen im kanonischen Raum der Länge;
3. `startValue <= endValue`;
4. globale Nichtüberlappung und globale Sortierbarkeit über alle Ranges;
5. vorhandene, zulässige Gruppen-/Feature-Referenzen nach deren späterem Contract;
6. dass eine Deaktivierung keine unzulässige aktive/öffentliche Wirkung erzeugt.

Erfolgsantworten enthalten ausschließlich die kanonische Range, technische Kapazität und `audit_reference`.

### 5.2 Allocation Pools

```http
GET  /api/v1/admin/tag-management/pools
POST /api/v1/admin/tag-management/pools
PATCH /api/v1/admin/tag-management/pools/{poolId}
```

Beispiel:

```json
{
  "poolId": "partner-demo-6",
  "displayName": "Partner Demo 6",
  "channel": "partner",
  "length": 6,
  "rangeIds": ["demo-range-6-001"],
  "active": true,
  "capacityWarningThreshold": 100,
  "policyRef": "policy-ref-pending-contract"
}
```

`displayName`, `channel` und `policyRef` sind interne Verwaltungsdaten. TCP prüft, dass alle Ranges existieren, dieselbe Länge verwenden, aktivierbar sind und keine fremde Organisationsbindung umgehen. Poolkapazität wird serverseitig aus kanonischen Rangegrenzen und reservierten Werten abgeleitet; TCC darf sie nicht lokal berechnen oder erzwingen.

### 5.3 Reservierung

```http
POST /api/v1/admin/tag-management/pools/{poolId}/reservations
```

Beispiel:

```json
{
  "quantity": 1,
  "reason": "synthetic-local-contract-test"
}
```

Der Idempotenzschlüssel wird ausschließlich als Header `Idempotency-Key: 00000000-0000-4000-8000-000000000000` übertragen.

Der lokale synthetische Command ist implementiert. Er gilt ausschließlich unter `FakeTagCodecClient` und ohne Staging-/Produktionswirkung:

1. TCP autorisiert Pool, Status und Organisationskontext;
2. TCP reserviert den nächsten freien linearen `decodedValue` einer aktiven Range als jobgebundenes `codec-pending`;
3. TCP ruft ausschließlich serverseitig den injizierten Codec-Adapter auf;
4. TCP persistiert nach erfolgreichem Response atomar `tagId`, `length`, `decodedValue`, `codecVersion`, Range-/Poolkontext, Status und Audit;
5. der gleiche Idempotency-Key liefert dieselbe fachliche Antwort und löst keine zweite fachliche Vergabe aus;
6. ein Codec-/DB-/Auditfehler hinterlässt keinen Browser-Erfolg und kein fertiges Mapping; die jobgebundene Wertreservierung bleibt gegen Doppelvergabe bestehen.

### 5.4 Batch-Reservierung und Codec-Chunking (nächste Welle)

Eine fachliche Range- oder Chargenreservierung ist ausschließlich ein TCP-Command. Der Browser übergibt keinen `decodedValue`-Bereich direkt an den Codec.

Nach erfolgreicher AuthZ-/Policy-Prüfung gilt für einen späteren TCP-Allocation-Job:

1. TCP reserviert unter Datenbanksperre die konkreten freien linearen `decodedValue`-Werte.
2. TCP teilt die bereits reservierten Werte deterministisch in Codec-Chunks von maximal 1.000 Werten auf.
3. TCP ruft ausschließlich serverseitig `POST https://internal.[s|p].myqr24.com/api/v1/codec/encode-batch` auf; ein Service-Key oder eine Codec-Antwort gelangt nie an TCC, TAG-App oder Druck-SPA.
4. TCP prüft für jeden Response-Eintrag Reihenfolge, `value`, `length`, kanonische `tagId` und `codecVersion`.
5. TCP persistiert je TAG mindestens `length`, `decodedValue`, `tagId`, `codecVersion`, Range-/Poolkontext und Fachstatus; TAG-Eigenschaften und JSON-Template-Konfiguration bleiben ausschließlich TCP-Daten.
6. Ein Chunk ist erst nach atomarer Mapping- und Auditpersistenz abgeschlossen. Fehler bleiben im Job sichtbar und können unter derselben fachlichen Idempotenz wiederaufgenommen werden.
7. Der Codec reserviert, speichert, auditiert, veröffentlicht oder iteriert keine Range.

Ein Batch-Codec-Aufruf ist deterministisch und zustandslos. Seine Wiederholung ist kryptografisch zulässig, ersetzt aber keine TCP-Idempotenz oder DB-Constraints.

### 5.5 Lifecycle

```http
POST /api/v1/admin/tag-management/tags/{tagId}/transitions
```

Beispiel:

```json
{
  "targetStatus": "pending-review",
  "reason": "initial-review"
}
```

Der Idempotenzschlüssel wird ausschließlich als Header `Idempotency-Key: 00000000-0000-4000-8000-000000000000` übertragen.

Zulässige lokale Basistransitionen sind vorläufig:

```text
draft -> pending-review -> ready-to-publish
```

`active` benötigt zusätzlich die späteren QA-, Übergabe-, Produkt- und Publish-Gates und wird in W2L serverseitig verweigert. `suspended`, `expired` und `archived` benötigen spätestens ab einer vorhandenen öffentlichen Wirkung eine Outbox zur Neutralisierung; diese Outbox ist W3L-Arbeit und darf in W2L nicht durch einen Browser ersetzt werden.

## 6. Idempotenz, Audit und Datenminimierung

- Ein `Idempotency-Key` darf nur einmal für denselben authentisierten Akteur, Commandtyp und semantisch identischen kanonischen Request verwendet werden.
- Der gleiche Key plus gleicher Request liefert dieselbe fachliche Antwort ohne neue Mutation oder neues Audit-Ereignis.
- Derselbe Key plus abweichender Request liefert neutral `409`.
- Jeder erfolgreiche oder sicherheitsrelevante abgelehnte Command erzeugt ein redigiertes Audit-Ereignis mit Korrelation, Akteur, Objektart, Objekt-ID und Aktion.
- Auditmetadaten enthalten weder Secrets, Zugangsdaten, Idempotency-Key-Rohwerte, Owner-/Kundenreferenzen noch vollständige Requestbodies.

## 7. Testreferenzen und Voraussetzungen

| Bereich | Referenzen |
| --- | --- |
| W1L-Basis | `control-plane-admin-api-v1`; `apps/tag-control-plane/tests/Feature/AuthenticationFlowTest.php`; `apps/tag-control-center/src/App.test.tsx` |
| Ranges | `CP-TC-RANGE-001` bis `CP-TC-RANGE-004`; `CC-TC-RANGE-001` bis `CC-TC-RANGE-004` |
| Pools | `CP-TC-POOL-001` bis `CP-TC-POOL-004`; `CC-TC-POOL-001` bis `CC-TC-POOL-004` |
| Reservierung | `CP-TC-ALLOC-001` bis `CP-TC-ALLOC-008`; lokale Fake-Codec-Reservierung in `apps/tag-control-plane/tests/Feature/TagManagementFlowTest.php`; TCC-Fachoberfläche und Internal-/Staging-Codec folgen |
| Lifecycle | `CP-TC-LIFECYCLE-001` bis `CP-TC-LIFECYCLE-003`; `CC-TC-LIFECYCLE-001` bis `CC-TC-LIFECYCLE-002` |
| Pflichtnachweise | MySQL-Integration, Parallelitäts-/Retry-/Negativtests, Audit-/Leak-Tests, TCC-Contract-Tests, Build und lokale Compose-Smoke-Tests |
| Nicht in W2L | Cloudflare-Publish, echte Staging-TAGs, öffentliche APIs, Claiming, Druckexport, Feistel-Secrets oder Browserzugriff auf Codec |

## 8. Umsetzungsgate

Dieser Vertrag ist während CP-I02 `in-progress`. Die W2L-Baseline für AuthZ und den lokalen Fake-Codec ist entschieden und lokal umgesetzt; verbleibende Teilcommands bleiben gezielt gesperrt.

- Ohne Range-/Pool-Validatoren: keine Range- oder Pool-Mutationsendpunkte und keine TCC-Fachformulare dafür.
- Ohne echten Internal-HTTP-Codec: keine Staging-/Produktionsreservierung; TCP darf weiterhin kein Feistel-Secret besitzen.
- Ohne Produkt-/Pooldefaults: keine reale Ausgabepolicy und keine Staging-/Produktionswirkung.

Lokale Nachweise begründen nach einer späteren Implementierung höchstens `implemented`; `verified` benötigt weiterhin die dokumentierten Staging-Gates.
