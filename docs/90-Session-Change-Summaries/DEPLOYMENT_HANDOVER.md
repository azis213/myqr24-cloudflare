# Deployment-Handover: myQR24 Edge Tag Router

**Stand:** 2026-10-01  
**Zweck:** Übergabedokument für eine neue Session zur initialen Cloudflare-Bereitstellung des myQR24 Edge Tag Routers.

---

## 1. Ausgangslage und Ziel der nächsten Session

Der TypeScript-Cloudflare-Worker ist implementiert, getestet und lokal per Wrangler-Dry-Run gebündelt. Die nächste Session soll die **reale initiale Staging-Bereitstellung** in Cloudflare durchführen und danach – erst nach erfolgreicher Verifikation – die Produktionsumgebung vorbereiten bzw. bereitstellen.

Der Worker löst NFC-/QR-Tag-URLs am Edge auf:

1. öffentliche Tag-URL wird strikt geparst;
2. Tag-ID wird Base36-/Feistel-decodiert und bei 8 Zeichen HMAC-validiert;
3. aktive Range, Gruppe und Feature-Zuweisung werden aus Cloudflare KV aufgelöst;
4. der Worker liefert einen sicheren Redirect oder ein JSON-Aktionsdokument.

Der Worker ist absichtlich nur die **lesende Edge-Auflösungsschicht**. Er enthält keine Fachzustände für Vault, Chat, Lost & Found, Guestbook, Check-ins, Collections oder Campaigns.

---

## 2. Verbindliches Domain- und Umgebungsmodell

### Scan-Domains

| Umgebung | kurze Scan-URL | sprechende Scan-URL | Worker |
| --- | --- | --- | --- |
| Staging | `https://s.qr4.uk/t/{tagId}` | `https://s.myqr24.com/t/{tagId}` | `myqr24-edge-routing-staging` |
| Produktion | `https://p.qr4.uk/t/{tagId}` | `https://p.myqr24.com/t/{tagId}` | `myqr24-edge-routing` |

**Wichtig:**

- `qx4u.uk` war ein Irrtum und darf **nicht** eingerichtet, akzeptiert oder weitergeleitet werden.
- `p.myqr24.net`, `t.qx4.uk` und `t.myqr24.com` sind verworfene Namen und dürfen ebenfalls nicht eingerichtet werden.
- Die Domainwahl ist nur eine Ausgabe-/Präsentationsentscheidung für QR-/NFC-Tags.
- Die kurze und die sprechende Domain derselben Umgebung lösen dieselbe Tag-ID, Range, Gruppe und Feature-Zuweisung auf.
- Staging und Production sind vollständig getrennt: separate Worker, KV-Namespaces und Secrets.

### Cloudflare Worker Routes

Diese Routen müssen nach erfolgreichem Worker-Deployment in Cloudflare eingerichtet werden:

```text
s.qr4.uk/t/*             -> myqr24-edge-routing-staging
s.myqr24.com/t/*       -> myqr24-edge-routing-staging

p.qr4.uk/t/*               -> myqr24-edge-routing
p.myqr24.com/t/*       -> myqr24-edge-routing
```

Die zugehörigen DNS-Einträge müssen sich in den Cloudflare-Zonen befinden und proxied sein.

---

## 3. Implementierter Sicherheitsmechanismus

Die Datei `src/index.ts` enthält die explizite, umgebungsbezogene Host-Allowlist:

```ts
staging:
  s.qr4.uk/t/{tagId}
  s.myqr24.com/t/{tagId}

production:
  p.qr4.uk/t/{tagId}
  p.myqr24.com/t/{tagId}
```

Die Worker-Bindung `SCAN_ENVIRONMENT` bestimmt, welche dieser Hostpaare akzeptiert werden:

```ts
export type ScanEnvironment = "staging" | "production";
```

Die Host-Prüfung ist **fail-closed**:

- unbekannter Host -> `404`;
- falscher Pfad -> `404`;
- Host der anderen Umgebung -> `404`;
- ungültige Tag-ID -> `404`;
- ungültige HMAC-Prüfung, fehlende Range, fehlende Gruppe oder fehlendes Feature -> `404`.

Der Staging-Worker darf daher niemals produktive Scan-Domains auflösen und umgekehrt.

---

## 4. Relevante Repository-Dateien

| Datei | Bedeutung für Deployment |
| --- | --- |
| `wrangler.toml` | Umgebungsnamen, `SCAN_ENVIRONMENT`, Anleitung für Secrets, KV-Bindings und Routen |
| `src/index.ts` | Worker-Code, öffentliche URL-Allowlist, Decodierung und KV-Auflösung |
| `test/worker.test.ts` | automatisierte Testabdeckung einschließlich Staging-/Production-Hosts |
| `test/fixtures/edge-routing.json` | Testdaten und ausschließlich lokale Test-Secrets |
| `package.json` | Skripte für Entwicklung, Tests, Build und Deployment |
| `docs/ARCHITECTURE.md` | verbindliche Architektur-, Sicherheits-, KV- und Deploymentregeln |
| `docs/DOMAIN_RULES.md` | Geschäftsregeln, URL- und Feature-Datenmodell |
| `docs/40-Implementation/STATUS.md` | Umsetzungsstatus |
| `docs/40-Implementation/20-TEST-STRATEGY.md` | Teststrategie |
| `docs/40-Implementation/21-TEST-CASES.md` | nachverfolgbare Testfälle |
| `docs/40-Implementation/22-TEST-DATA.md` | Regeln für Testdaten |
| `docs/40-Implementation/30-TRACEABILITY.md` | Traceability zwischen Anforderungen, Tests und Implementierung |
| `docs/10-Architecture/CLOUDFLARE_PWA_COMPONENT.md` | Abgrenzung von Edge Router, PWA, API, D1/R2 und späteren Features |

---

## 5. Aktueller `wrangler.toml`-Status

Die Konfiguration enthält bereits zwei Umgebungen:

```toml
[env.staging]
name = "myqr24-edge-routing-staging"

[env.staging.vars]
SCAN_ENVIRONMENT = "staging"

[env.production]
name = "myqr24-edge-routing"

[env.production.vars]
SCAN_ENVIRONMENT = "production"
```

Die KV-Bindings sind absichtlich noch auskommentiert, weil die Namespace-IDs Cloudflare-kontospezifisch sind:

```toml
# [[env.staging.kv_namespaces]]
# binding = "TAG_CONFIG"
# id = "<staging-kv-namespace-id>"

# [[env.production.kv_namespaces]]
# binding = "TAG_CONFIG"
# id = "<production-kv-namespace-id>"
```

### Verpflichtender nächster Code-/Konfigurationsschritt

Nach der Erstellung beider KV-Namespaces müssen die echten IDs in `wrangler.toml` eingetragen und die Kommentarzeichen entfernt werden:

```toml
[[env.staging.kv_namespaces]]
binding = "TAG_CONFIG"
id = "<ECHTE_STAGING_KV_ID>"

[[env.production.kv_namespaces]]
binding = "TAG_CONFIG"
id = "<ECHTE_PRODUCTION_KV_ID>"
```

**Kein** Staging- und Production-Worker darf denselben `TAG_CONFIG`-Namespace verwenden.

---

## 6. Empfohlene Initial-Bereitstellung: Staging zuerst

### 6.1 Voraussetzungen prüfen

Im Repository:

```sh
npm ci
npm test
npx tsc --noEmit
```

Cloudflare-Authentifizierung prüfen bzw. durchführen:

```sh
npx wrangler whoami
npx wrangler login
```

`wrangler login` öffnet eine Browser-Authentifizierung und ist nur erforderlich, wenn noch keine gültige Cloudflare-Anmeldung für das passende Konto vorliegt.

### 6.2 Staging-KV-Namespace erstellen

```sh
npx wrangler kv namespace create TAG_CONFIG --env staging
```

Die zurückgegebene Namespace-ID in `wrangler.toml` bei `env.staging.kv_namespaces` eintragen.

Optional bzw. empfohlen: Production Namespace bereits getrennt anlegen, aber noch nicht produktiv verwenden:

```sh
npx wrangler kv namespace create TAG_CONFIG --env production
```

Die zurückgegebene ID bei `env.production.kv_namespaces` eintragen.

### 6.3 Getrennte Staging-Secrets setzen

Secrets dürfen nicht in Git, `wrangler.toml`, Test-JSON oder Dokumentation gespeichert werden.

```sh
npx wrangler secret put FEISTEL_SECRET_S01 --env staging
npx wrangler secret put TAG_HMAC_SECRET_S01 --env staging
npx wrangler secret put REDIRECT_SIGNING_SECRET_S01 --env staging
```

Für die erste Staging-Range müssen starke, voneinander unabhängige Werte verwendet werden.

**Wichtige Regeln:**

- Keine Test-Secrets aus `test/fixtures/edge-routing.json` verwenden.
- Keine Staging-Secrets später in Produktion wiederverwenden.
- Secret-Werte nur über den interaktiven Wrangler-Dialog bzw. einen zugelassenen Secret-Management-Prozess eingeben.
- Secrets vor der Erzeugung physischer Testtags stabil halten, da sie die gültigen Tag-IDs beeinflussen.

### 6.4 Staging Worker deployen

```sh
npm run deploy -- --env staging
```

Erwarteter Worker-Name:

```text
myqr24-edge-routing-staging
```

### 6.5 Staging-DNS und Routen einrichten

In den Cloudflare-Zonen `qr4.uk` und `myqr24.com`:

1. DNS-Eintrag für `s.qr4.uk` erstellen und proxied schalten.
2. DNS-Eintrag für `s.myqr24.com` erstellen und proxied schalten.
3. Die Routen erstellen:

   ```text
   s.qr4.uk/t/*
   s.myqr24.com/t/*
   ```

4. Beide auf `myqr24-edge-routing-staging` binden.

Die Routen sollten bewusst eng bleiben. Der Worker weist dennoch unzulässige Pfade selbst mit `404` ab.

---

## 7. Initiale Staging-Konfiguration in KV

Ein erfolgreicher Worker-Deploy allein genügt nicht: Ohne `tag-range-index` antwortet der Worker bei Scan-Anfragen korrekt fail-closed mit `404`.

Für die erste echte Teststrecke werden mindestens diese KV-Dokumente benötigt:

```text
tag-range-index
group:{groupId}
range-rule:{rangeId}   # optional, falls Gruppenfeatures überschrieben werden sollen
feature:{featureId}
```

Optional:

```text
tag:{decodedValue}     # direkte Regel für eine einzelne gültige Tag-ID
```

### Minimale Reihenfolge

1. echte Staging-Testtag-ID bzw. Testrange mit den Staging-Secrets generieren;
2. `tag-range-index` mit einer aktiven, nicht überlappenden Range schreiben;
3. passende Gruppe schreiben;
4. mindestens ein Feature schreiben;
5. entweder Gruppenfeature oder Range-Regel referenzieren;
6. Scan über beide Staging-Domainformen prüfen.

### Wichtige Datenmodellregeln

- Der Range-Index-Key lautet exakt `tag-range-index`.
- Ranges sind global aufsteigend sortiert und dürfen sich nicht überschneiden.
- `start` und `end` werden als **dezimal codierte Strings** gespeichert.
- Aktive Ranges benötigen `active: true`.
- Der Worker unterstützt aktuell Tag-ID-Längen **6 und 8**.
- Bei 8-stelligen IDs müssen Ranges vollständige 16er-Slots abdecken:
  - `start % 16 === 0`
  - `end % 16 === 15`
- Reihenfolge der Feature-Auflösung:

  ```text
  tag:{decodedValue}
    vor range-rule:{rangeId}
    vor group:{groupId}
  ```

- Feature-IDs müssen gültige Identifier sein und auf existierende aktivierte Feature-Dokumente zeigen.

Vollständige Datenmodellbeispiele: `docs/ARCHITECTURE.md` und `docs/DOMAIN_RULES.md`.

---

## 8. Staging-Abnahmekriterien

Die Staging-Abnahme ist erst erfüllt, wenn mindestens folgende Nachweise vorliegen:

### Deployment und Routing

```text
- Worker myqr24-edge-routing-staging ist deployed.
- SCAN_ENVIRONMENT ist staging.
- Staging-KV ist als TAG_CONFIG gebunden.
- s.qr4.uk/t/* zeigt auf den Staging Worker.
- s.myqr24.com/t/* zeigt auf den Staging Worker.
```

### Funktionale Scan-Prüfungen

Mit einer gültigen, im Staging-KV konfigurierten Testtag-ID:

```text
GET https://s.qr4.uk/t/{tagId}
GET https://s.myqr24.com/t/{tagId}
```

Beide müssen dieselbe konfigurierte Aktion liefern (Redirect oder JSON).

Negativtests:

```text
GET https://s.qr4.uk/{tagId}            -> 404
GET https://s.myqr24.com/{tagId}        -> 404
GET https://p.qr4.uk/t/{tagId}              -> nicht durch Staging auflösen
GET https://p.myqr24.com/t/{tagId}      -> nicht durch Staging auflösen
GET https://s.qr4.uk/invalid!           -> 404
POST https://s.qr4.uk/t/{tagId}           -> 405
```

Bei 8-stelligen IDs zusätzlich mindestens eine manipulierter HMAC-Prüffall:

```text
GET https://s.qr4.uk/t/{manipulatedTagId} -> 404
```

### Nachweisablage

Deployment- und Scan-Nachweise sollten für spätere Sessions in diesem Ordner abgelegt werden:

```text
docs/40-Implementation/evidence/
```

Die Konventionen dafür stehen in `docs/40-Implementation/evidence/README.md`.

---

## 9. Production-Promotion

Produktivdeployment erfolgt erst nach bestandener Staging-Abnahme.

### Production-Secrets

Separat und neu setzen. Die konkreten ersten versionierten Production-Bindungsnamen werden erst vor dem Production-Gate festgelegt; Staging-`_S01`-Werte und -Namen dürfen dafür nicht wiederverwendet werden.

### Production-Deploy

```sh
npm run deploy -- --env production
```

Danach erst die Production-Routen einrichten bzw. aktivieren:

```text
p.qr4.uk/t/*
p.myqr24.com/t/*
```

Produktive NFC-/QR-Tags dürfen ausschließlich auf diese Production-URLs programmiert werden.

### Wichtige Konsequenz

Staging- und Production-Secrets unterscheiden sich absichtlich. Dadurch sind Staging-Tag-IDs nicht automatisch in Production gültig und umgekehrt. Physische Staging-Tags werden nach dem Produktionslaunch **nicht umgeschaltet**; für Produktion werden neue, produktive Tag-IDs ausgegeben und programmiert.

Ein Software-Release wird durch Deployment des geprüften Git-Stands in die Production-Umgebung promotet. Eine einzelne Tag-Zuweisung oder ein Featurewechsel wird dagegen ausschließlich über KV bzw. später über eine autoritative Verwaltungs-API geändert.

---

## 10. Entwickler- und Qualitätsstatus

### Installierte Werkzeuge

Aus `package.json`:

```text
TypeScript
Wrangler
@cloudflare/workers-types
Vitest
```

### Relevante Skripte

```sh
npm run dev
npm test
npm run build
npm run deploy -- --env staging
npm run deploy -- --env production
```

### Erfolgreich verifizierter Stand

Am 2026-10-01 erfolgreich ausgeführt:

```text
npm test
  -> 1 Testdatei, 41/41 Tests bestanden

npx tsc --noEmit
  -> keine TypeScript-Fehler

npx wrangler deploy --dry-run --outdir dist --env staging
  -> Bundle erfolgreich; SCAN_ENVIRONMENT = "staging"

npx wrangler deploy --dry-run --outdir dist --env production
  -> Bundle erfolgreich; SCAN_ENVIRONMENT = "production"
```

Die Dry-Runs enthielten erwartungsgemäß noch keine `TAG_CONFIG`-KV-Bindung, weil die Konto-spezifischen Namespace-IDs bewusst noch nicht in `wrangler.toml` eingetragen wurden.

---

## 11. Sicherheits- und Betriebsregeln

1. Niemals Secrets in Git, Dokumentation, Issues, Chat-Protokollen oder Testfixtures speichern.
2. Staging und Production erhalten zwingend getrennte:
   - Worker,
   - KV-Namespaces,
   - Feistel-Secrets,
   - HMAC-Secrets,
   - Redirect-Signing-Secrets.
3. Nur die vier dokumentierten Scan-Domains verwenden.
4. Keine Host-Wildcards in der Worker-Logik ergänzen.
5. Vor dem Erzeugen physischer Tags die passende Umgebung, die korrekten Secrets und den KV-Rangebestand prüfen.
6. Änderungen an versionierten Feistel- oder HMAC-Secrets können die Gültigkeit bzw. Auflösbarkeit existierender Tags beeinflussen und dürfen nicht ungeplant erfolgen.
7. Der Range-Index ist sicherheitsrelevant: keine überlappenden, unsortierten oder unvalidierten Ranges schreiben.
8. Cloudflare KV ist kein Ersatz für eine transaktionale Vergabe-/Verwaltungsdatenbank. Eine spätere Allocation-API benötigt atomare Vergabe und persistente Eindeutigkeitsconstraints.
9. Der 4-Bit-HMAC-Nibble ist eine vorgegebene Integritätsprüfung, aber kein vollständiger Ersatz für ein längeres Authentifizierungsmerkmal.
10. Redirect-Ziele müssen ausschließlich aus vertrauenswürdiger serverseitiger Feature-Konfiguration stammen.

---

## 12. Empfohlener Ablauf für die neue Session

1. Dieses Dokument und `docs/ARCHITECTURE.md` lesen.
2. Repository-Status prüfen und Abhängigkeiten installieren.
3. Cloudflare-Login/Konto prüfen.
4. KV-Namespace `TAG_CONFIG` für Staging erstellen.
5. Staging-KV-ID in `wrangler.toml` eintragen.
6. Drei unabhängige Staging-Secrets setzen.
7. Staging-Worker deployen.
8. DNS und zwei Staging-Worker-Routen einrichten.
9. Einen kleinen, realen Staging-Testbestand in KV anlegen.
10. Beide Staging-Scan-URLs sowie Negativfälle prüfen.
11. Nachweise unter `docs/40-Implementation/evidence/` ablegen.
12. Erst danach Production-KV, Production-Secrets, Production-Deploy und Production-Routen durchführen.

---

## 13. Offene Punkte für die Deployment-Session

- [ ] Cloudflare-Konto und Zugriffsrechte prüfen.
- [ ] Zonen-/DNS-Verwaltung für `qr4.uk` und `myqr24.com` bestätigen.
- [ ] Staging-KV erstellen und ID in `wrangler.toml` eintragen.
- [ ] Production-KV erstellen und ID in `wrangler.toml` eintragen.
- [ ] Staging-Secrets setzen.
- [ ] Production-Secrets getrennt setzen.
- [ ] Staging-Worker deployen.
- [ ] Staging-DNS-Records und Worker-Routen konfigurieren.
- [ ] Reale Staging-Test-Range und Feature-Dokumente in KV anlegen.
- [ ] Staging-Scan- und Negativtests durchführen und dokumentieren.
- [ ] Entscheidung über Production-Promotion treffen.

---

## 14. Weiterführende Referenzen

- Gesamtarchitektur und KV-Formate: `docs/ARCHITECTURE.md`
- Geschäftslogik und Domain-/Range-Regeln: `docs/DOMAIN_RULES.md`
- Cloudflare-/PWA-Komponentengrenzen: `docs/10-Architecture/CLOUDFLARE_PWA_COMPONENT.md`
- Implementierungsstatus: `docs/40-Implementation/STATUS.md`
- User Stories: `docs/40-Implementation/10-USER-STORIES.md`
- Teststrategie: `docs/40-Implementation/20-TEST-STRATEGY.md`
- Testfälle: `docs/40-Implementation/21-TEST-CASES.md`
- Testdatenspezifikation: `docs/40-Implementation/22-TEST-DATA.md`
- Nachweis-/Evidence-Konventionen: `docs/40-Implementation/evidence/README.md`
- Traceability: `docs/40-Implementation/30-TRACEABILITY.md`
