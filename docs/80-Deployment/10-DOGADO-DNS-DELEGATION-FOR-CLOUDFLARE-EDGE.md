# Dogado DNS: Cloudflare Edge für myQR24-Subdomains

**Status:** Betriebscheckliste für die erste Edge-Anbindung  
**Stand:** 2026-10-06  
**Geltungsbereich:** DNS-Anpassungen bei Dogado für `s.myqr24.com` und `p.myqr24.com`, während `myqr24.com` weiterhin bei Dogado verwaltet wird, sowie die ergänzende Cloudflare-Konfiguration der QR4-Testhosts.

## 1. Zielbild

Die Hauptdomain `myqr24.com` bleibt bei Dogado. Nur die öffentlichen Edge-Gateway-Subdomains werden an Cloudflare delegiert:

```text
Dogado DNS für myqr24.com
├── bestehende Website-, E-Mail- und sonstige DNS-Records bleiben bei Dogado
├── s.myqr24.com  → delegierte Cloudflare-Subzone → Staging Edge Gateway
└── p.myqr24.com  → delegierte Cloudflare-Subzone → Production Edge Gateway
```

Die primären Scan-URLs der ersten Ausgabe sind:

```text
Staging:     https://s.myqr24.com/t/{tagId}
Production:  https://p.myqr24.com/t/{tagId}
```

Zusätzlich dürfen diese gleichwertigen Testhosts verwendet werden:

```text
Staging-Test:     https://s.qr4.uk/t/{tagId}
Production-Test:  https://p.qr4.uk/t/{tagId}
```

`qr4.uk` ohne Subdomain bleibt bis zu einer separaten Produktentscheidung deaktiviert und wird nicht als kurze Scan-URL ausgegeben.

## 2. Wichtige Regel: Kein A-Record auf eine Cloudflare-Worker-IP

Ein Cloudflare Worker besitzt keine feste Ziel-IP, die bei Dogado als A-Record eingetragen werden kann.

**Nicht tun:**

```text
s.myqr24.com → eine im Internet gefundene Cloudflare-IP
p.myqr24.com → eine im Internet gefundene Cloudflare-IP
```

Ein einfacher A- oder CNAME-Record bei Dogado allein aktiviert keine Cloudflare Worker Route.

Stattdessen werden `s.myqr24.com` und `p.myqr24.com` mittels **NS-Delegation** an je eine Cloudflare-Subzone übergeben. Erst in diesen Subzonen werden proxied Records und Worker-Routen konfiguriert.

## 3. Vorbereitung

Vor Änderungen in Dogado:

1. Sicherstellen, dass für die exakt betroffenen Namen `s` und `p` keine fachlich benötigten Dienste betrieben werden.
2. Bestehende Dogado-DNS-Records für `s.myqr24.com` und `p.myqr24.com` dokumentieren.
3. Für beide Umgebungen getrennte Worker, KV-/R2-Bindings und Secrets bereithalten.
4. In Cloudflare noch keine beispielhaften Nameserver übernehmen; jeder Zone werden kontospezifische Nameserver zugewiesen.
5. Änderungen zunächst nur für Staging (`s.myqr24.com`) durchführen und abnehmen. Production (`p.myqr24.com`) folgt erst danach.

## 4. Staging: `s.myqr24.com` an Cloudflare delegieren

### 4.1 Cloudflare-Zone erstellen

1. In Cloudflare eine neue Zone mit exakt diesem Namen anlegen:

   ```text
   s.myqr24.com
   ```

2. Cloudflare zeigt zwei autoritative Nameserver an, beispielsweise:

   ```text
   xxxxx.ns.cloudflare.com
   yyyyy.ns.cloudflare.com
   ```

   Die angezeigten Werte sind Beispiele. Ausschließlich die für diese Zone tatsächlich angezeigten Nameserver übernehmen.

### 4.2 Dogado-DNS ändern

Im Dogado-DNS der Parent-Zone `myqr24.com`:

1. Vorhandene A-, AAAA- oder CNAME-Records mit dem Namen `s` entfernen.
2. Zwei NS-Records anlegen:

| Typ | Name bei Dogado | Ziel |
| --- | --- | --- |
| `NS` | `s` | erster Nameserver, den Cloudflare für `s.myqr24.com` anzeigt |
| `NS` | `s` | zweiter Nameserver, den Cloudflare für `s.myqr24.com` anzeigt |

Dadurch wird die DNS-Verantwortung für `s.myqr24.com` an Cloudflare delegiert. `myqr24.com` und alle anderen Dogado-Einträge bleiben unverändert.

### 4.3 Cloudflare-Subzone konfigurieren

Nach der Delegation in der Cloudflare-Zone `s.myqr24.com`:

| Feld | Wert |
| --- | --- |
| Typ | `A` |
| Name | `@` |
| IPv4-Adresse | `192.0.2.1` |
| Proxy-Status | **Proxied** / orange Wolke |
| TTL | Auto |

`192.0.2.1` ist der reservierte Dokumentationsbereich TEST-NET-1. Die IP ist kein echter Origin. Bei einer aktiven Worker Route beantwortet Cloudflare den Request am Edge.

Danach im Cloudflare Worker-Dashboard die Scan-Routen setzen:

```text
s.myqr24.com/t/*  → myqr24-edge-routing-staging
s.myqr24.com/t1/* → myqr24-edge-routing-staging
```

`/t1/*` ist die im Routing-Vertrag reservierte zweite Scan-Familie. Sie wird zunächst mit derselben Decoderkonfiguration betrieben, damit physische Träger dieser zulässigen Familie den Edge ebenfalls erreichen.

## 5. Production: `p.myqr24.com` an Cloudflare delegieren

Production erst nach erfolgreicher Staging-Abnahme einrichten.

### 5.1 Cloudflare-Zone und Dogado-Delegation

1. In Cloudflare die Zone `p.myqr24.com` erstellen.
2. Die zwei von Cloudflare angezeigten Nameserver notieren.
3. Im Dogado-DNS für `myqr24.com` vorhandene A-, AAAA- oder CNAME-Records mit dem Namen `p` entfernen.
4. Zwei NS-Records setzen:

| Typ | Name bei Dogado | Ziel |
| --- | --- | --- |
| `NS` | `p` | erster Nameserver, den Cloudflare für `p.myqr24.com` anzeigt |
| `NS` | `p` | zweiter Nameserver, den Cloudflare für `p.myqr24.com` anzeigt |

### 5.2 Cloudflare-Subzone und Worker konfigurieren

In der Cloudflare-Zone `p.myqr24.com`:

| Feld | Wert |
| --- | --- |
| Typ | `A` |
| Name | `@` |
| IPv4-Adresse | `192.0.2.1` |
| Proxy-Status | **Proxied** / orange Wolke |
| TTL | Auto |

Worker-Routen:

```text
p.myqr24.com/t/*  → myqr24-edge-routing
p.myqr24.com/t1/* → myqr24-edge-routing
```

## 6. Spätere Edge-Routen

Für den ersten Scan-Betrieb sind die Scan-Familien `/t/*` und `/t1/*` erforderlich. Wenn Runtime API und Media Gateway umgesetzt werden, werden je Umgebung weitere Routen ergänzt:

```text
s.myqr24.com/api/*    → myqr24-edge-routing-staging
s.myqr24.com/media/*  → myqr24-edge-routing-staging

p.myqr24.com/api/*    → myqr24-edge-routing
p.myqr24.com/media/*  → myqr24-edge-routing
```

Die Worker-Implementierung verarbeitet nur explizit erlaubte Pfade. Unbekannte Pfade bleiben `404`.

## 7. QR4-Testhosts in Cloudflare konfigurieren

Die Zone `qr4.uk` wird bereits direkt in Cloudflare verwaltet. Dafür sind keine Änderungen bei Dogado erforderlich.

In der Cloudflare-Zone `qr4.uk`:

1. Zwei orange-proxied A-Records anlegen:

| Typ | Name | IPv4-Adresse | Proxy-Status |
| --- | --- | --- | --- |
| `A` | `s` | `192.0.2.1` | **Proxied** |
| `A` | `p` | `192.0.2.1` | **Proxied** |

2. Die folgenden Worker-Routen einrichten:

```text
s.qr4.uk/t/*   → myqr24-edge-routing-staging
s.qr4.uk/t1/*  → myqr24-edge-routing-staging

p.qr4.uk/t/*   → myqr24-edge-routing
p.qr4.uk/t1/*  → myqr24-edge-routing
```

3. Sobald Runtime API und Media Gateway implementiert sind, dieselben Umgebungszuordnungen ergänzen:

```text
s.qr4.uk/api/*    → myqr24-edge-routing-staging
s.qr4.uk/media/*  → myqr24-edge-routing-staging

p.qr4.uk/api/*    → myqr24-edge-routing
p.qr4.uk/media/*  → myqr24-edge-routing
```

Der Apex `qr4.uk` erhält weder einen proxied Platzhalter-Record noch eine Worker-Route. Daher ist `https://qr4.uk/t/{tagId}` bis zu einer ausdrücklichen späteren Entscheidung nicht erreichbar und kein gültiger TAG-Vertrag.

## 8. Pages-Hosts sind getrennt zu behandeln

Die TAG-App ist nicht Teil der Scan-Worker-Subzonen:

```text
app-staging.myqr24.com  = Staging TAG-App auf Cloudflare Pages
app.myqr24.com          = Production TAG-App auf Cloudflare Pages
```

Diese Hosts werden im jeweiligen Pages-Projekt als Custom Domain eingerichtet. Der bei Dogado erforderliche DNS-Record wird von Cloudflare Pages vorgegeben und ist abhängig von der Pages-Konfiguration.

Nicht `app-staging` oder `app` auf einen Worker-Platzhalter konfigurieren. Falls Pages eine externe DNS-Validierung nicht unterstützt, wird auch für den jeweiligen App-Host eine eigene Cloudflare-Subzone mit NS-Delegation verwendet.

## 9. Prüfung und Abnahme

Nach DNS- und TLS-Propagation — dies kann Minuten bis zu 24 Stunden dauern — prüfen:

```powershell
nslookup -type=ns s.myqr24.com
nslookup s.myqr24.com

curl.exe -I https://s.myqr24.com/t/rsq45q
curl.exe -I https://s.qr4.uk/t/rsq45q
```

Erwartung für einen gültigen, publizierten Staging-TAG:

```text
HTTP/2 302
Location: https://app-staging.myqr24.com/tag/rsq45q?exp=...&sig=...
```

Negativtests:

```powershell
curl.exe -I https://s.myqr24.com/rsq45q
curl.exe -X POST -I https://s.myqr24.com/t/rsq45q
```

Erwartung:

```text
GET /rsq45q       → 404
POST /t/{tagId}   → 405
```

Erst nach erfolgreicher Staging-Abnahme werden die Schritte für `p.myqr24.com` und den gleichwertigen Production-Testhost `p.qr4.uk` wiederholt.

## 10. QR4-Apex nicht aktivieren

Bis zu einer separaten Entscheidung über sehr kurze physische URLs sind diese Konfigurationen verboten:

```text
qr4.uk/t/*
qr4.uk/t1/*
qr4.uk/api/*
qr4.uk/media/*
```

Der mögliche spätere Einsatz des Apex ist eine Produkt-, Domain- und Druckentscheidung. Die heute erlaubten Testhosts `s.qr4.uk` und `p.qr4.uk` treffen diese Entscheidung nicht vorweg.

## 11. Referenzen

- [Cloudflare DNS- und TLS-Konfiguration](../10-Architecture/CLOUDFLARE_DNS_AND_TLS_CONFIGURATION.md)
- [TAG Edge: Routing- und URL-Vertrag](../20-Special-Specifications/TAG-EDGE-APIS/10-ROUTING-AND-URL-CONTRACT.md)
- [Domain-, TAG- und Routing-Regeln](../DOMAIN_RULES.md)
