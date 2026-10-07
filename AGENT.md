# myQR24 Edge Tag Router – Agent Guidelines

## Zweck des Projekts

Dieses Repository enthält den **myQR24 Edge Tag Router** als Cloudflare Worker in TypeScript. Er löst öffentliche NFC-/QR-Tag-URLs auf, validiert und decodiert die Tag-ID, ermittelt Range, Gruppe und Features aus Cloudflare KV und gibt einen Redirect oder ein JSON-Aktionsdokument zurück.

Der Worker ist ausschließlich eine **lesende Edge-Auflösungsschicht**. Fachlogik und personenbezogene Daten gehören nicht in diesen Worker oder den Routing-KV.

## Maßgebliche Dokumentation

Vor wesentlichen Änderungen diese Dokumente lesen:

- `docs/ARCHITECTURE.md` – verbindliche Gesamtarchitektur, Sicherheitsmodell, KV-Datenmodell und Deployment-Regeln
- `docs/DOMAIN_RULES.md` – Geschäftsregeln, URL-Formate, Range- und Feature-Modell
- `docs/10-Architecture/CLOUDFLARE_PWA_COMPONENT.md` – Abgrenzung von Edge Router, PWA, API, D1/R2 und späteren Komponenten
- `docs/40-Implementation/STATUS.md` – aktueller Implementierungsstatus
- `docs/40-Implementation/20-TEST-STRATEGY.md` und `21-TEST-CASES.md` – Teststrategie und Testfälle
- `docs/90-Session-Change-Summaries/DEPLOYMENT_HANDOVER.md` – Ausgangspunkt für die initiale Cloudflare-Bereitstellung

## Refinement-Ideen sind keine Umsetzungsquelle

`docs/00-Refinement/**` ist ein ausdrücklich unverbindlicher Ideenspeicher. Dokumente dort dürfen bei regulären Implementierungs-, Test-, Deployment- und Wiederaufnahmesessions weder automatisch gelesen noch als Anforderung interpretiert werden.

Der Ordner darf nur bei einem ausdrücklich erteilten Refinement-Auftrag gelesen oder fortgeschrieben werden. Eine darin beschriebene Idee darf erst umgesetzt werden, nachdem sie über die verbindliche Architektur, Domain-Regeln, versionierte Contracts, Stories, Tests, Traceability und Status-Gates übernommen wurde. Maßgeblich bleibt bis dahin die aktuelle Architektur- und Vertragsdokumentation außerhalb von `docs/00-Refinement/`.

## Verbindliches Domainmodell

| Umgebung | kurze Scan-URL | sprechende Scan-URL |
| --- | --- | --- |
| Staging | `https://s.qx4.uk/{tagId}` | `https://s.myqr24.com/t/{tagId}` |
| Produktion | `https://qx4.uk/{tagId}` | `https://p.myqr24.com/t/{tagId}` |

Nicht verwenden oder reaktivieren:

```text
qx4u.uk
p.myqr24.net
t.qx4.uk
t.myqr24.com
```

### Host-Sicherheitsregel

Die URL-Allowlist ist in `src/index.ts` explizit und umgebungsbezogen implementiert:

- Staging akzeptiert ausschließlich `s.qx4.uk` und `s.myqr24.com`.
- Production akzeptiert ausschließlich `qx4.uk` und `p.myqr24.com`.
- Unbekannte Hosts, falsche Pfade und Cross-Environment-Hosts werden fail-closed mit `404` abgelehnt.
- Keine Host-Wildcards in der Worker-Logik ergänzen.

## Umgebungen und Cloudflare-Ressourcen

Staging und Production müssen vollständig getrennt sein:

- eigene Worker;
- eigene `TAG_CONFIG`-KV-Namespaces;
- Staging: eigene versionierte `FEISTEL_SECRET_S01`-, `TAG_HMAC_SECRET_S01`- und `REDIRECT_SIGNING_SECRET_S01`-Secrets;
- Production: eigene versionierte Secret-Bindings, deren erste Kennung erst vor dem Production-Gate festgelegt wird.

Die Zuordnung erfolgt über `SCAN_ENVIRONMENT` in `wrangler.toml`:

```text
staging     -> myqr24-edge-routing-staging
production  -> myqr24-edge-routing
```

Secrets niemals in Git, `wrangler.toml`, Dokumentation, Testfixtures, Tickets oder Chat-Protokollen speichern.

## Tag- und KV-Regeln

- Unterstützte Tag-ID-Längen: **6** und **8** Base36-Zeichen.
- Alle Tag-Werte, Grenzen und Dekodierungen verwenden `BigInt`; nie JavaScript-`number`.
- Der kanonische Zahlenraum lautet: `I(L) = [36^(L-1), 36^L)`.
- Achtstellige IDs verwenden einen HMAC-Nibble in den unteren 4 Bit.
- 8-stellige Ranges müssen vollständige 16er-Slots abdecken:
  - `start % 16 === 0`
  - `end % 16 === 15`
- Der globale `tag-range-index` muss aufsteigend sortiert und nicht überlappend sein.
- Feature-Priorität:

  ```text
  tag:{decodedValue}
    vor range-rule:{rangeId}
    vor group:{groupId}
  ```

- Ohne gültige aktive Range darf ein Tag niemals aufgelöst werden.
- Jede fehlerhafte oder unvollständige Konfiguration muss fail-closed zu `404` führen.

## Architekturgrenzen

Nicht in den Edge Worker bzw. Routing-KV aufnehmen:

- Owner- und Besucher-Sessions;
- Chat-Nachrichten oder Realtime-Zustand;
- Lost-&-Found-Status;
- Gästebuchinhalte;
- Check-in-, Standort-, Collection-, Campaign- oder Reward-Daten;
- private R2-Objektpfade;
- Berechtigungsentscheidungen oder Verwaltungslogik.

Diese gehören in spätere PWA-/API-Komponenten mit autoritativen Speichern (z. B. D1/PostgreSQL, private R2-Buckets, gegebenenfalls Durable Objects).

## Entwicklungsregeln

1. Änderungen an öffentlichen URL-Formaten, Feistel-Parametern, HMAC-Verhalten, Ranges oder Secrets sind sicherheitsrelevant und benötigen Architektur-, Test- und Dokumentationsupdates.
2. Bestehende Tests vor und nach Änderungen ausführen.
3. Neue Regeln oder sicherheitsrelevante Verhaltensweisen durch Vitest-Tests abdecken.
4. Bei Architektur- oder Statusänderungen die passenden Dokumente unter `docs/` aktualisieren.
5. Neue Session-Übergaben im Ordner `docs/90-Session-Change-Summaries/` ablegen.
6. Deployment-Nachweise gehören nach `docs/40-Implementation/evidence/`.
7. Keine produktiven Tags programmieren, bevor Production-Worker, Production-KV, Production-Secrets und Production-Routen verifiziert wurden.

## Qualitätsbefehle

Vor Abschluss relevanter Änderungen ausführen:

```sh
npm test
npx tsc --noEmit
npx wrangler deploy --dry-run --outdir dist --env staging
npx wrangler deploy --dry-run --outdir dist --env production
git diff --check
```

Für reale Deployments zuerst Staging:

```sh
npm run deploy -- --env staging
```

Production erst nach dokumentierter Staging-Abnahme:

```sh
npm run deploy -- --env production
```

## Weiterer Deployment-Stand

Die Initialbereitstellung ist noch offen. Der konkrete Ablauf, die Cloudflare-Routen, die KV-Initialdaten und die Abnahmekriterien stehen in:

```text
docs/90-Session-Change-Summaries/DEPLOYMENT_HANDOVER.md
```
