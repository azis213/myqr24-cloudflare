# Control Plane Routing Administration API v1

**Version:** `v1`  
**Status:** `implemented-local`  
**Owner:** TAG Control Plane (TCP)  
**Konsument:** TAG Control Center (TCC)  
**Basisverträge:** [`control-plane-admin-api-v1`](control-plane-admin-api-v1.md), [`tag-routing-projection-v1`](tag-routing-projection-v1.md)

## 1. Geltungsbereich und Autorität

Der private Vertrag verwaltet ausschließlich synthetische lokale Routingdaten der Umgebung `staging`. Er erlaubt weder einen realen Cloudflare-Zugriff noch eine Production-Auswahl. TCP validiert Katalog, Featuredefinitionen, vier Zuweisungsebenen, Projektion, Outbox und Fake-Publishing serverseitig. TCC besitzt keine DB-, KV-, R2-, Codec- oder Publisherberechtigung.

Unterstützte Featuretypen sind ausschließlich `redirect`, `image` und `json`. Zuweisungen folgen `tag → pool → range → group`; ohne Redirect verwendet der Edge Router das serverseitige Pages-Default-Template. Pool- und TAG-Regeln werden als `tag:{decodedValue}` materialisiert. Pool-IDs und private Pooldaten werden niemals projiziert.

## 2. HTTP-, Sicherheits- und Idempotenzregeln

Basispräfix: `/api/v1/admin/routing`.

- Authentisierung: TCP-Web-Session; Mutationen zusätzlich CSRF und frische TAG-Management-Re-Authentisierung.
- Autorisierung im lokalen v1: `platform-admin`; serverseitige Prüfung bei jedem Request.
- Responses: `Cache-Control: no-store`, gemeinsame `correlation_id`, keine Secrets oder Providerantworten.
- Mutationen verlangen einen UUID-`Idempotency-Key`. Wiederverwendung mit anderem Request ergibt `409`.
- Format-, Referenz-, Schema- oder Invariantenfehler ergeben `422`; Policyfehler `403`; fehlende Session `401`.
- Feature-/Zuweisungsmutationen und ihr Audit sind atomar. Erst Publish/Unpublish erzeugt validierte Projektionsrevision und Outbox gemeinsam mit Audit in einer DB-Transaktion.
- Der konfigurierte Fake-Publisher akzeptiert ausschließlich `staging`; Production wird fail-closed verweigert.

## 3. Katalog und Verwaltung

```http
GET /catalog
PUT /features/{featureId}
PUT /assignments/{scope}/{targetId}
```

`GET /catalog` liefert Featuredefinitionen, Zuweisungen, zulässige Ziel-IDs je Ebene, Umgebung und Outbox-Zusammenfassungen. Es enthält keine Cloudflare-Konfiguration.

Feature-Mutation:

```json
{
  "definition": {
    "id": "redirect-demo",
    "type": "redirect",
    "enabled": true,
    "urlTemplate": "https://app.example.invalid/tag/{tagId}",
    "status": 302
  }
}
```

`featureId` ist unveränderlich und muss mit `definition.id` übereinstimmen. TCP prüft typspezifische Felder, erlaubte URL-/Templateformen, Redirectstatus und Signaturgrenzen sowie Datenklassifikation. `image` akzeptiert ausschließlich öffentliche logische Medien-URLs; private Storage-Keys sind verboten. `json` akzeptiert nur ein begrenztes, datenklassifiziertes `payload`.

Zuweisungsmutation:

```json
{ "featureIds": ["redirect-demo"] }
```

`scope` ist `tag`, `pool`, `range` oder `group`. `targetId` ist die serverseitig auflösbare fachliche ID. Leere Listen entfernen die spezifischere Zuweisung und aktivieren damit die nächste Ebene; ungültige Referenzen werden abgewiesen.

## 4. Diff, Publish und Unpublish

```http
GET  /projection/preview
POST /projection/publish
POST /projection/unpublish
GET  /outbox
POST /outbox/{eventId}/retry
```

Die Vorschau enthält geplante Dokumente sowie einen lesbaren `added`/`changed`/`removed`-Diff gegen die letzte erfolgreich abgeschlossene Revision. Eine fehlerhafte Projektion erzeugt weder Revision noch Outbox.

Publish/Unpublish besitzen keinen Environment-Parameter. TCP verwendet ausschließlich seine serverseitige `staging`-Konfiguration. Die Antwort enthält `projectionRevision`, `eventId`, `operation`, `status`, `attemptCount`, optionale neutrale `errorClass` und `correlation_id`. `200` kennzeichnet einen abgeschlossenen lokalen Fake-Lauf, `202` einen offenen/retrybaren Auftrag.

Retry verwendet denselben Outbox-Datensatz und keine neue fachliche Mutation. Erfolg wird erst nach bestätigter Fake-Providerantwort persistiert. Timeout, `429` und `5xx` werden als `timeout`, `rate_limit` bzw. `provider_error` ohne interne Details gespeichert.

Unpublish neutralisiert zuerst den Index, entfernt danach direkte TAG-/Range-Regeln und zuletzt nicht mehr benötigte Feature-/Gruppen-Dokumente. Autoritative Verwaltungsdaten bleiben erhalten; die letzte erfolgreiche Projektion ist anschließend leer.

## 5. Tests und Grenzen

Verbindlich sind TCP-Tests für AuthZ/Re-Auth, typspezifische Schemas, Pool-/TAG-Priorität, fehlende Referenzen, Daten-Leaks, atomare Outbox, Diff, Retry-Idempotenz, Umgebungsschutz und sichere Unpublish-Reihenfolge. TCC-Tests prüfen ausschließlich TCP-bestätigte Daten und CSRF-/Idempotenz-Commands.

Echte Cloudflare-Tokens, KV-/R2-Writes, Deployment, Production und Browser-Publisherzugriff sind ausgeschlossen. Öffentliche Runtime-/Medienpublishing-Verträge stehen in [`tag-pages-runtime-r2-v1`](tag-pages-runtime-r2-v1.md).
