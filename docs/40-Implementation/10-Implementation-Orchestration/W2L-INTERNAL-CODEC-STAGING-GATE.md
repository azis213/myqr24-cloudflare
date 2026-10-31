# W2L – Freigabegate: Internal TAG Codec für die Control Plane

**Stand:** 2026-10-31  
**Status:** `blocked` – externe Betriebsfreigaben und Worker-Contract-Übereinstimmung fehlen  
**Geltungsbereich:** ausschließlich die spätere serverseitige Staging-Bindung von TCP an `codec.s.myqr24.com`; keine KV-, Scan-Worker-, TCC- oder Produktionsänderung.

## 1. Ausgangspunkt

`apps/tag-control-plane/app/Services/InternalHttpTagCodecClient.php` ist lokal implementiert und getestet, bleibt aber absichtlich **nicht** über `AppServiceProvider` als `TagCodecClient` gebunden. Die lokale Bindung bleibt `FakeTagCodecClient`.

Der Adapter erwartet den versionierten Batch-Contract:

```text
POST /api/v1/codec/encode-batch
Authorization: Bearer <server-side-secret>
{ "length": 6|8|10, "values": ["canonical-decimal", "…"] }
```

Er verlangt einen festen 3-Sekunden-Gesamt-Timeout und normalisiert Transport-, `429`-, `5xx`- und Schemafehler neutral. Er hat keinen synchronen HTTP-Retry.

## 2. Aktueller Blocker

Der Vertrag [`tag-codec-internal-v1`](../../../10-Architecture/35-Contracts/tag-codec-internal-v1.md) dokumentiert für den aktuell bereitgestellten Codec-Worker noch Einzelencode/-decode und schließt Batch-Encoding sowie `codecVersion` im Response explizit aus. Die spätere TCP-Adaptererwartung kann daher nicht gegen die bekannte Staging-Route aktiviert werden.

Zusätzlich fehlen redigierte Betriebsnachweise für:

1. den endgültigen serverseitigen TCP-Staging-Host und dessen geschützten Secret-Speicher;
2. die getrennte Staging-Kopie des Codec-Service-Keys, ohne seinen Wert zu dokumentieren;
3. die freigegebene Private-Route `codec.s.myqr24.com/api/v1/*`;
4. route-spezifische WAF-/Rate-Limit-Regeln und die Entscheidung zu Cloudflare Access bzw. IP-Allowlisting;
5. einen kontrollierten, redigierten Staging-Smoketest.

Bis zur vollständigen Freigabe bleibt `CP-BLK-003` `partially-resolved` und TCP darf keine reale Codec-Verbindung aufbauen.

## 3. Eintrittskriterien für eine Aktivierung

Alle folgenden Nachweise müssen vor einer Binding-Änderung vorliegen:

- [ ] Codec-Worker implementiert und testet `POST /api/v1/codec/encode-batch` mit maximal 1.000 eindeutigen kanonischen 6-/8-/10-Werten sowie fester `codecVersion` im Response.
- [ ] Worker liefert für Schema-, Auth-, Größen- und Duplikatfehler neutrale Fehler gemäß `tag-codec-internal-v1`; keine CORS-Freigabe.
- [ ] Gemeinsame, nicht geheime Staging-Testvektoren für TCP-Adapter und Codec-Worker sind dokumentiert; Feistel-Secrets bleiben ausschließlich im Worker-Secret-Store.
- [ ] TCP-Staging besitzt einen geschützten, nicht versionierten Secret-Pfad für `TCP_TAG_CODEC_BASE_URL` und `TCP_TAG_CODEC_API_KEY`; TCC, TAG-App und Browser erhalten keinen Zugriff.
- [ ] Die API-Key-Kopie ist von Feistel- und Publisher-Secrets getrennt; Staging und Production verwenden getrennte Keyversionen.
- [ ] Die private Route, WAF-/Rate-Limit-Grenze und Access-/IP-Entscheidung sind durch den Cloudflare-Betrieb bestätigt und redigiert dokumentiert.
- [ ] Dogado-Staging-HTTPS-/Deployment-/Rollbackweg ist nach `W0-WP-01` bestätigt.

## 4. Zulässiger kontrollierter Staging-Smoketest

Erst nach allen Eintrittskriterien:

1. TCP in einer dedizierten Staging-Konfiguration auf `InternalHttpTagCodecClient` umstellen; lokale und Production-Konfiguration bleiben beim Fake bzw. unangetastet.
2. Einen synthetischen, kanonischen Einzelwert je Länge 6, 8 und 10 über den TCP-Adapter batchweise encodieren.
3. Response auf Länge, Reihenfolge, Wert, kanonische lowercase-`tagId` und `codecVersion` prüfen.
4. Einen absichtlich ungültigen bzw. nicht autorisierten Request ausschließlich über den kontrollierten Betriebsweg prüfen; Antwort muss neutral bleiben.
5. Nachweis ohne Header, API-Key, vollständige Wertlisten oder Feistel-/Worker-Secret in `docs/40-Implementation/evidence/` ablegen.
6. Bei Fehlern TCP wieder auf den Fake zurückstellen oder Staging-Deployment zurückrollen; keine Reservierung, kein Publish und keine KV-Mutation ausführen.

## 5. Austrittskriterium

Dieses Gate ist erst `implemented`, wenn der Worker-Batchvertrag, die serverseitige Staging-Konfiguration und Adaptertests vorliegen. `verified` erfordert zusätzlich den redigierten erfolgreichen Staging-Smoketest und die dokumentierten Route-/WAF-/Access-Grenzen.