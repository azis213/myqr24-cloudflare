# Vertrag: TAG Routing Projection v1

**Version:** `v1`  
**Status:** `implemented-contract`; lokale Erzeugungs- und Fake-Publisher-Implementierung folgen in W3L  
**Owner:** TAG Control Plane (TCP)  
**Producer:** serverseitiger TCP-Projektionsservice  
**Consumer:** bestehender Cloudflare Edge Router (`apps/edge-router`)  
**Transport:** serverseitiger, idempotenter Outbox-Publisher → exakt ein bestätigter `TAG_CONFIG`-KV-Namespace je Umgebung  
**Normative Referenzen:** [Domain Rules](../../DOMAIN_RULES.md), [Edge Routing and URL Contract](../../20-Special-Specifications/TAG-EDGE-APIS/10-ROUTING-AND-URL-CONTRACT.md), [Edge Router implementation](../../../apps/edge-router/src/index.ts)

> Cloudflare KV ist eine vollständig ableitbare, nicht autoritative Read-Projektion. Die TCP bleibt fachliche Quelle für Ranges, Gruppen, TAG-Lebenszyklus, Features, Audit und Veröffentlichungsentscheidungen.

## 1. Zweck und Kompatibilität

Der Vertrag definiert ausschließlich die minimalen KV-Dokumente, die der bestehende Edge Router zum Auflösen einer erfolgreichen Scan-Anfrage benötigt. Er fügt dem Edge Router keine neue Fähigkeit hinzu und ändert weder Feistel-/Cycle-Walk-Codec noch Scan-URL-Familien.

`v1` ist nur kompatibel, wenn jede Projektion die in diesem Dokument genannten Schlüssel und JSON-Formen verwendet. Änderungen an Feldnamen, Datentypen, Schlüsselpräfixen oder Validierungsregeln sind breaking und benötigen eine neue Contract-Major-Version mit parallelem Migrations- und Edge-Testplan.

Die TCP darf Werte nur nach erfolgreicher fachlicher Mutation, Auditierung und Projektionsvalidierung über eine Outbox veröffentlichen. Direkte, manuelle KV-Fachänderungen sind verboten.

## 2. Sicherheits- und Datenklassifikation

| Kategorie | In der Routing-Projektion zulässig | Ausgeschlossen |
| --- | --- | --- |
| Routing | Range-ID, Gruppen-ID, kanonische `decodedValue`-Grenzen, TAG-Länge, Aktivitätsflag, erlaubte Feature-Referenzen | Poolname, Kapazität, Reservierungs- und Herstellungsstatus |
| Features | strikt validierte, veröffentlichbare Redirect-/Image-/JSON-Featurefelder | Owner-, Account-, Claim-, PIN-, Session-, Audit- und Produktdaten |
| Betrieb | Vertragsschema, Projektionsrevision, technische Outbox-/Publish-Korrelation außerhalb des KV-Payloads | Cloudflare-Token, Codec-API-Key, Feistel-/Redirect-Signing-Secrets, interne Fehlerdetails |
| Öffentliche Daten | nur die Edge-Featurekonfiguration, die für die Scan-Auflösung nötig ist | Vault-Inhalte, Nachweise, private Medienpfade, DB-Schlüssel, personenbezogene Daten |

Der Browser erhält niemals Schreibzugriff auf den Namespace, Publisher-Token oder TCP-Secrets. Der TCP-Codec-Client besitzt ausschließlich den umgebungsspezifischen `TAG_CODEC_API_KEY_S01`, niemals `FEISTEL_SECRET_S01`.

## 3. Schlüsselraum

Die gesamte Projektion besteht ausschließlich aus diesen Schlüsselklassen:

| Schlüssel | Form | Zweck | Erforderlich |
| --- | --- | --- | --- |
| `tag-range-index` | Einzelnes JSON-Dokument | global sortierter Range-Index | ja |
| `group:{groupId}` | JSON-Dokument | Feature-Default einer Range-Gruppe | für jede Index-Range |
| `range-rule:{rangeId}` | JSON-Dokument | optionale Range-spezifische Feature-Zuweisung | nein |
| `tag:{decodedValue}` | JSON-Dokument | optionale konkrete TAG-Feature-Zuweisung | nein |
| `feature:{featureId}` | JSON-Dokument | referenzierte, aktivierte Featuredefinition | für jede wirksame Referenz |

Andere Schlüssel dürfen durch diesen Vertrag nicht geschrieben werden. `decodedValue` wird immer als dezimale kanonische Integerzeichenfolge serialisiert, niemals als Float, Base36-ID oder JavaScript-Number.

## 4. JSON-Schema der Dokumente

### 4.1 `tag-range-index`

```json
{
  "version": 1,
  "ranges": [
    {
      "id": "rng_stg_0001",
      "start": "78364164096",
      "end": "78364164195",
      "groupId": "grp_stg_default",
      "length": 8,
      "active": true
    }
  ]
}
```

| Feld | Regel |
| --- | --- |
| `version` | positive JSON-Number; beschreibt das Dokumentformat, nicht den Fachstand |
| `ranges` | Array in streng global aufsteigender Reihenfolge nach `start` |
| `ranges[].id` | Identifier: `[A-Za-z0-9][A-Za-z0-9_-]{0,127}`; global eindeutig |
| `start`, `end` | dezimale Ganzzahlstrings, inklusiv, `start <= end` |
| `groupId` | gültiger Identifier; verweist auf `group:{groupId}` |
| `length` | exakt `6`, `8` oder `10` |
| `active` | Boolean; nur `true` darf aufgelöst werden |

Alle Ranges sind auch längenübergreifend nicht überlappend und streng aufsteigend. Anfang und Ende liegen im kanonischen Raum `I(length) = [36^(length-2), 36^length)` für eine gerade Länge `length ∈ {6, 8, 10}`. Öffentliche TAG-IDs haben exakt die konfigurierte Länge und dürfen führende Nullen enthalten. Slotgrenzen, HMAC-Nibbles, Bitmasken und verdeckte Zwischenräume sind unzulässig.

Der Edge Router validiert das vollständige Dokument vor dem binären Lookup. Ungültige oder unsortierte Indexdaten neutralisieren die gesamte Routing-Auflösung (`404`).

### 4.2 Gruppen-, Range- und TAG-Zuweisungen

```json
{
  "id": "grp_stg_default",
  "featureIds": ["feat_app_default"]
}
```

```json
{
  "featureIds": ["feat_tag_override"]
}
```

- `group:{groupId}` enthält zwingend dieselbe `id` wie sein Schlüssel-Suffix und ein `featureIds`-Array.
- `range-rule:{rangeId}` und `tag:{decodedValue}` enthalten ausschließlich `featureIds`.
- Alle `featureIds` sind eindeutige Identifier.
- Leere direkte Zuweisungen haben keine Override-Wirkung: Der Router fällt in dieser Reihenfolge zurück: `tag` → `range-rule` → `group`.
- Ist nach diesem Fallback keine Feature-ID wirksam, ist der Scan neutral nicht verfügbar.

### 4.3 Features

Alle Features benötigen:

```json
{
  "id": "feat_app_default",
  "type": "redirect",
  "enabled": true,
  "urlTemplate": "https://app-staging.myqr24.com/tag/{tagId}"
}
```

| Typ | Zusätzliche Regeln |
| --- | --- |
| `redirect` | genau eines von `url` oder `urlTemplate`; optionale `status`-Werte nur `301`, `302`, `303`, `307`, `308`; optionale `signing.ttlSeconds` ganzzahlig `10..300` |
| `image` | `key` und/oder `url` nur gemäß späterem, separatem Medienvertrag; dieser Contract definiert keine Freigabe privater Object-Keys |
| `json` | `payload` nur als datensparsame, öffentlich zulässige Edge-Aktionsdaten; kein Ersatz für die spätere PublicTagView-API |

Templates dürfen ausschließlich `{tagId}`, `{decodedValue}`, `{length}` und `{groupId}` enthalten. Der reservierte Token `{tagSignature}` ist in einem v1-Template ungültig; der Edge Router kann Signaturen ausschließlich mit seinem internen Secret ergänzen. Nicht bekannte oder ungeschlossene Tokens führen neutral zu `404`.

Der TCP-Projektionsvalidator muss die strikteren Routerregeln vor Outbox-Erzeugung erneut anwenden. Ein Feature mit `enabled: false`, ungültigem Identifier, nicht erlaubtem URL-Schema oder fehlerhafter Referenz darf nicht publiziert werden.

## 5. Auflösungssemantik und Fehlerwirkung

1. Der Edge Router decodiert die öffentliche `tagId` mit seinem geheimen Feistel-Contract.
2. Er sucht den kanonischen `decodedValue` im validierten, aktiven Range-Index.
3. Er lädt `group:{groupId}`.
4. Er bestimmt Feature-IDs mit Präzedenz `tag:{decodedValue}` → `range-rule:{rangeId}` → Gruppe.
5. Er lädt jede referenzierte `feature:{featureId}`-Definition und führt nur ein vollständig gültiges Set aus.
6. Ein Redirect-Feature erzeugt eine serverseitig geprüfte HTTP-Weiterleitung; ohne Redirect-Feature kann der Router ausschließlich sein bestehendes JSON-Aktionsdokument liefern.

Fehler in einem Dokument, fehlende Referenzen, inaktive Ranges, unbekannte/ungültige IDs und nicht zulässige Features dürfen keine internen Gründe offenlegen. Für Scan-Routen ist die Wirkung neutral `404`; für nicht erlaubte Methoden gilt unverändert `405`.

## 6. Publikations- und Widerrufsprotokoll

Die lokale W3L-Implementierung muss atomar folgende TCP-Daten erzeugen:

1. fachliche Mutation;
2. redigiertes Audit-Ereignis;
3. Outbox-Ereignis mit Projektionsrevision, Diff-Summary und Korrelations-ID.

Der Publisher schreibt ausschließlich in den explizit konfigurierten Umgebungsnamespace. Er ist idempotent je `(environment, projectionRevision, operation)` und markiert ein Ereignis erst nach bestätigter Providerantwort erfolgreich.

Unpublish entfernt oder neutralisiert zuerst direkte `tag:{decodedValue}`-/`range-rule:{rangeId}`-Zuweisungen und aktualisiert anschließend den Index bzw. die wirksamen Referenzen in einer Reihenfolge, die niemals eine ungewollte Route aktivieren darf. Da Cloudflare KV keine Multi-Key-Transaktion bietet, muss der Publisher revisionierte, retrybare Einzelschritte und einen sicheren neutralen Zwischenzustand verwenden. Die genaue Providersequenz wird in W3L durch Fake-Publisher- und Unpublish-Contracttests festgelegt; ein echter Write bleibt bis zum W3D-Deployment-Gate verboten.

## 7. Authentisierung, Autorisierung, CORS und Caching

| Schnittstelle | Regel |
| --- | --- |
| TCP → Publisher | ausschließlich serverseitig; least-privilege Namespace-Token; kein Browserzugriff |
| TCP interne Projektion | nur autorisierte fachliche Services; Admin-AuthZ wird im separaten `control-plane-admin-api-v1` geregelt |
| Edge KV-Lesezugriff | Worker-Binding, keine Browser-API |
| CORS | nicht anwendbar: KV-Dokumente werden nicht direkt über HTTP ausgeliefert |
| Caching | KV-Cache-Verhalten ist kein Fachvertrag; sichere Widerrufs-/Neutralisierungswirkung ist vor W3D nachzuweisen |
| Idempotenz | TCP-Outbox und Publisher idempotent; ohne bestätigte Providerantwort kein Erfolgsstatus |
| Korrelation | jede Mutation/Outbox-Verarbeitung trägt eine opaque Korrelations-ID; niemals Secret- oder Ownerdaten |

## 8. Tests und Traceability

| Nachweis | Referenz |
| --- | --- |
| Edge Index-, Range-, Group-, Assignment- und Featurevalidierung | `apps/edge-router/test/worker.test.ts` |
| Edge Routing-Strategie | `docs/40-Implementation/edge-router/20-TEST-STRATEGY.md` |
| Contract-Fälle und Testdaten | `docs/40-Implementation/edge-router/21-TEST-CASES.md`, `22-TEST-DATA.md` |
| TCP-Projektions-, Outbox- und Publisher-Tests | `CP-US-030` bis `CP-US-032`, W3L; noch nicht implementiert |
| TCP-Range-/Allocator-Vorbedingungen | `CP-US-010` bis `CP-US-013`, W2L; noch nicht implementiert |

## 9. Versionierung und offene Grenzen

- `v1` implementiert keinen PublicTagView-, Claim-, Owner-, Medien- oder Accountvertrag.
- `v1` ist kein Freigabemechanismus für Cloudflare KV und keine Freigabe für echte Staging- oder Production-Änderungen.
- Die konkrete Umgebungszuordnung aus TCP-Publisher zu aktivem Worker/Namespace bleibt bis W3D ein Deployment-Gate.
- Ein `tag-range-index.version`-Wert ist ein Dokumentformatwert. Eine monotone fachliche Projektionsrevision verbleibt autoritativ in TCP und der Outbox.
- Neue Featuretypen werden erst nach Contract-, Router-, Sicherheits- und Kompatibilitätsprüfung eingeführt.
