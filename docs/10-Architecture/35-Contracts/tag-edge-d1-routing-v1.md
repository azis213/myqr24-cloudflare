# Vertrag: TAG Edge D1 Routing v1

**Version:** `v1`  
**Status:** `implemented-local`  
**Owner:** TAG Control Plane als Publisher; Edge Router als Consumer  
**Quelle:** TCP/MySQL bleibt fachlich autoritativ; D1 ist eine minimale abgeleitete Edge-/App-Projektion

## 1. Zweck

Nach der bestehenden Host-, Pfad-, Feistel- und Range-Prüfung fragt der Edge Router genau einen indexierten D1-Datensatz ab. Er liest kein Content-JSON aus R2. Die D1-Projektion entscheidet nur zwischen externem Ziel und internem React-PWA-Einstieg.

```sql
tag_routing(
  tag_id PRIMARY KEY,
  status,
  target_type,
  external_url,
  protection_mode,
  access_version,
  content_revision,
  schema_version,
  updated_at
)
```

Der Lookup lautet parameterisiert:

```sql
SELECT tag_id, status, target_type, external_url, protection_mode,
       access_version, content_revision
FROM tag_routing WHERE tag_id = ?1 LIMIT 1
```

Es sind keine Scans, Offsets, Owner-, PIN-, Session-, Pool-, POI- oder R2-Key-Daten zulässig.

## 2. Edge-Entscheidung

| Voraussetzung | Wirkung |
| --- | --- |
| fehlender, inaktiver oder inkonsistenter D1-Datensatz | neutral `404` |
| `target_type=external` | validierter serverseitiger externer Redirect |
| `target_type=internal`, `protection_mode=public` | 302 zur React-PWA mit signiertem Public-Bootstrap |
| `target_type=internal`, `protection_mode=pin_required` | 302 zur React-PWA mit signiertem PIN-Bootstrap |
| `login_required` oder `closed` | React kann nur nach separatem Login-Contract bzw. neutraler Wirkung starten; v1 aktiviert keinen Login-Bypass |

Interne Redirects verwenden ausschließlich das umgebungsseitige HTTPS-Template `/tag/{tagId}`. Der Query-String enthält nur `mode`, `av`, `rv`, `nonce`, `exp`, `sig`. Die Signatur bindet Zweck, Tag, Modus, Access-Version, Content-Revision, Nonce und Ablauf. Sie ist ein Bootstrapnachweis und niemals eine Berechtigung.

## 3. Publikation und Widerruf

TCP publiziert Contentrevision und D1-Routing nur über Outbox. Für eine neue Contentrevision wird zuerst das immutable private R2-JSON geschrieben, dann der D1-Datensatz aktualisiert. Bei Sperrung, Deaktivierung oder PIN-Änderung ändert TCP Status bzw. `access_version`; bestehende Access-Sessions werden dadurch beim nächsten Request ungültig.

Echte D1-Bindings und Writes sind bis W3D gesperrt. Die lokale Implementierung prüft D1-Fakes und Edge-Bootstrap-Parameter.