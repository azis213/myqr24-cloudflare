# Cloudflare DNS- und TLS-Konfiguration für myQR24

**Status:** Verbindliche Betriebsanleitung für Staging und Production  
**Stand:** 2026-10-01  
**Geltungsbereich:** DNS, Cloudflare Worker Routes, Cloudflare Pages Custom Domains und HTTPS für die myQR24 Scan- und PWA-Domains.

---

## 1. Zielbild und Domainmodell

Der myQR24 Edge Tag Router wird auf Cloudflare Workers betrieben. Die Scan-Domains müssen deshalb über Cloudflare erreichbar und **proxied** sein. Die Test-PWA liegt auf Cloudflare Pages.

| Umgebung | Zweck | Vollständige URL bzw. Host | Cloudflare-Komponente |
| --- | --- | --- | --- |
| Staging | kurze Scan-URL | `https://s.qx4.uk/{tagId}` | `myqr24-edge-routing-staging` |
| Staging | sprechende Scan-URL | `https://s.myqr24.com/t/{tagId}` | `myqr24-edge-routing-staging` |
| Staging | Test-PWA | `https://app-staging.myqr24.com/tag/{tagId}` | Pages `myqr24-staging-test-pwa` |
| Production | kurze Scan-URL | `https://qx4.uk/{tagId}` | `myqr24-edge-routing` |
| Production | sprechende Scan-URL | `https://p.myqr24.com/t/{tagId}` | `myqr24-edge-routing` |
| Production | spätere PWA | `https://app.myqr24.com/tag/{tagId}` | spätere Production-PWA |

Nicht verwenden:

```text
qx4u.uk
p.myqr24.net
t.qx4.uk
t.myqr24.com
```

---

## 2. Wichtig: Keine Cloudflare-IP als eigener A-Record

Cloudflare veröffentlicht keine feste IP-Adresse, auf die Anwendungen für Workers oder Pages per eigener A-Record-Konfiguration zeigen sollen.

Für die myQR24-Domains gilt stattdessen:

- **Worker Route:** Ein DNS-Record für den Host muss in einer Cloudflare-Zone vorhanden und mit orangefarbener Wolke (**Proxied**) aktiviert sein. Die Origin-IP wird bei einer Worker-Route nicht verwendet, weil der Worker die Anfrage am Cloudflare Edge beantwortet.
- **Cloudflare Pages:** Ein Custom Domain wird im Pages-Dashboard hinzugefügt. Cloudflare nennt anschließend die konkret benötigte DNS-Validierung bzw. CNAME-Zuordnung. Keinen A-Record auf eine angenommene Cloudflare-IP setzen.
- **Externer DNS-Provider, zum Beispiel Dogado:** Ein einfacher A- oder CNAME-Record bei Dogado reicht für eine Cloudflare Worker Route in der Regel nicht aus. Für den Scan-Host muss die betreffende Zone bzw. Subzone von Cloudflare verwaltet werden.

Die im Folgenden verwendete Dokumentationsadresse `192.0.2.1` stammt aus dem reservierten TEST-NET-1-Bereich gemäß RFC 5737. Sie ist bei einer orange-proxied Worker-Route nur ein Platzhalter-Origin und darf nicht für graue, direkt auflösende Records verwendet werden.

---

## 3. Aktueller Staging-Stand

Bereits bereitgestellte Cloudflare-Ressourcen:

| Ressource | Wert |
| --- | --- |
| Staging Worker | `myqr24-edge-routing-staging` |
| Worker-URL | `https://myqr24-edge-routing-staging.azis213.workers.dev` |
| Staging KV-Namespace | `staging-TAG_CONFIG` |
| Pages-Projekt | `myqr24-staging-test-pwa` |
| Temporäre Pages-URL | `https://myqr24-staging-test-pwa.pages.dev` |
| Testtag | `rsq45q` |
| Temporäres Redirect-Ziel | `https://myqr24-staging-test-pwa.pages.dev/tag/{tagId}` |

Der temporäre `pages.dev`-Host ist erreichbar. Sobald `app-staging.myqr24.com` als Pages Custom Domain fertig eingerichtet ist, wird das KV-Feature auf die verbindliche Staging-PWA-Adresse umgestellt.

---

## 4. `qx4.uk`: Staging-Scan-Domain in der bestehenden Cloudflare-Zone

`qx4.uk` wird bereits auf Cloudflare gehostet. Die Konfiguration erfolgt vollständig im Cloudflare Dashboard.

### 4.1 DNS-Record anlegen

Pfad:

```text
Cloudflare Dashboard
→ Websites
→ qx4.uk
→ DNS
→ Records
→ Add record
```

Record:

| Feld | Wert |
| --- | --- |
| Type | `A` |
| Name | `s` |
| IPv4 address | `192.0.2.1` |
| Proxy status | **Proxied** (orange Wolke) |
| TTL | Auto |

Dadurch entsteht:

```text
s.qx4.uk → Cloudflare Edge → Worker Route
```

> Die Platzhalter-IP ist bei aktivierter Worker Route nicht das tatsächliche Ziel der Scan-Anfrage. Die orange Wolke ist zwingend.

### 4.2 Worker Route anlegen

Pfad:

```text
Cloudflare Dashboard
→ Workers & Pages
→ myqr24-edge-routing-staging
→ Settings
→ Domains & Routes
→ Add route
```

Route:

```text
s.qx4.uk/*
```

Worker:

```text
myqr24-edge-routing-staging
```

### 4.3 Erwarteter Staging-Test

Nach DNS- und Zertifikatspropagation:

```text
GET https://s.qx4.uk/rsq45q
```

Erwartung:

```text
302 Found
Location: https://myqr24-staging-test-pwa.pages.dev/tag/rsq45q?exp=...&sig=...
```

Nach Umstellung auf die Custom Domain:

```text
302 Found
Location: https://app-staging.myqr24.com/tag/rsq45q?exp=...&sig=...
```

---

## 5. `myqr24.com`: Ausgangslage bei Dogado

Die Domain `myqr24.com` wird aktuell bei Dogado gehostet bzw. ihre autoritativen Nameserver liegen dort. Der vorhandene Host `s.myqr24.com` zeigt derzeit auf einen nginx-Webserver und darf nicht einfach auf eine vermeintliche Cloudflare-IP geändert werden.

Die gewünschte Scan-Route

```text
s.myqr24.com/t/*
→ myqr24-edge-routing-staging
```

kann nur eingerichtet werden, wenn Cloudflare diese Domain oder eine delegierte Subzone verwaltet.

Es gibt zwei gültige Betriebsmodelle.

---

## 6. Empfohlenes Modell: `myqr24.com` vollständig zu Cloudflare DNS umziehen

Dieses Modell ist langfristig am einfachsten und wird für die Production-Architektur empfohlen.

### 6.1 Ablauf

1. Die Zone `myqr24.com` im Cloudflare Dashboard hinzufügen.
2. Cloudflare zeigt zwei autoritative Nameserver an.
3. Diese Nameserver im Dogado-Domain-Portal für `myqr24.com` hinterlegen.
4. Alle bestehenden DNS-Records von Dogado vorher inventarisieren und in Cloudflare nachbauen:
   - `A`, `AAAA`, `CNAME`;
   - `MX`, `TXT`, SPF, DKIM, DMARC;
   - Verifikationsrecords externer Dienste;
   - gegebenenfalls Autodiscover- und Mail-Records.
5. Erst nach vollständiger Übernahme den Nameserverwechsel ausführen.
6. Warten, bis Cloudflare die Zone als **Active** markiert.

> Ein Nameserverwechsel betrifft DNS, nicht zwingend den bestehenden Webserver bei Dogado. Bestehende Websites können weiterhin bei Dogado liegen, wenn ihre A- oder CNAME-Records in Cloudflare auf die bisherigen Dogado-Ziele zeigen.

### 6.2 DNS-Records nach dem Umzug

| Zweck | Type | Name | Ziel | Proxy |
| --- | --- | --- | --- | --- |
| Staging Scan | A | `s` | `192.0.2.1` | **Proxied** |
| Production Scan | A | `p` | `192.0.2.1` | **Proxied** |
| Staging PWA | nach Pages-Vorgabe | `app-staging` | von Cloudflare Pages vorgegeben | nach Pages-Vorgabe |
| Production PWA | nach Pages-Vorgabe | `app` | von Cloudflare Pages vorgegeben | nach Pages-Vorgabe |

Anschließend werden die Worker Routes angelegt:

```text
s.myqr24.com/t/* → myqr24-edge-routing-staging
p.myqr24.com/t/* → myqr24-edge-routing
```

---

## 7. Alternative ohne vollständigen Umzug: NS-Delegation einzelner Subdomains

Wenn `myqr24.com` vorerst bei Dogado-DNS bleiben soll, können die benötigten Hosts als eigene Cloudflare-Subzonen delegiert werden.

Dieses Modell vermeidet einen sofortigen vollständigen Nameserverwechsel, benötigt aber sorgfältige Konfiguration beim Parent-DNS-Provider Dogado.

### 7.1 Staging Scan-Subzone `s.myqr24.com`

1. Im Cloudflare Dashboard eine Zone mit exakt diesem Namen hinzufügen:

   ```text
   s.myqr24.com
   ```

2. Cloudflare zeigt dafür zwei autoritative Nameserver an, beispielsweise:

   ```text
   ada.ns.cloudflare.com
   tom.ns.cloudflare.com
   ```

   Die tatsächlich angezeigten Namen sind konto- und zonenspezifisch; ausschließlich diese Werte verwenden.

3. Im Dogado-DNS für die Parent-Zone `myqr24.com` zwei **NS-Records** anlegen:

   | Type | Host/Name | Ziel |
   | --- | --- | --- |
   | NS | `s` | erster von Cloudflare genannter Nameserver |
   | NS | `s` | zweiter von Cloudflare genannter Nameserver |

4. Einen möglicherweise bestehenden `A`, `AAAA` oder `CNAME`-Record für `s` bei Dogado entfernen. Ein delegierter Name darf nicht gleichzeitig auf einen Dogado-Origin zeigen.

5. Warten, bis die Cloudflare-Zone `s.myqr24.com` als **Active** angezeigt wird.

6. Innerhalb der neuen Cloudflare-Zone `s.myqr24.com` einen proxied DNS-Record für den Zonenapex anlegen:

   | Feld | Wert |
   | --- | --- |
   | Type | `A` |
   | Name | `@` |
   | IPv4 address | `192.0.2.1` |
   | Proxy status | **Proxied** |
   | TTL | Auto |

7. Die Worker Route im Staging Worker anlegen:

   ```text
   s.myqr24.com/t/*
   → myqr24-edge-routing-staging
   ```

### 7.2 Staging-PWA-Host `app-staging.myqr24.com`

Für die statische Pages-Test-PWA wird keine Worker Route benötigt. Der bevorzugte Weg ist:

1. Cloudflare Dashboard öffnen:

   ```text
   Workers & Pages
   → myqr24-staging-test-pwa
   → Custom domains
   → Set up a custom domain
   ```

2. Folgende Domain eintragen:

   ```text
   app-staging.myqr24.com
   ```

3. Cloudflare zeigt abhängig vom aktuellen Zonenmodell die notwendige DNS-Validierung bzw. den CNAME-Record an.
4. Wenn Dogado weiterhin autoritativ für `myqr24.com` ist, exakt den von Pages angegebenen Record bei Dogado anlegen.
5. Keine nicht dokumentierte A-Record-IP eintragen.
6. Warten, bis Pages den Status **Active** und das Zertifikat als bereit anzeigt.

Wenn Pages für den extern verwalteten Host keine direkte Custom-Domain-Konfiguration zulässt, wird analog zu Abschnitt 7.1 eine eigene Cloudflare-Zone `app-staging.myqr24.com` mit NS-Delegation von Dogado eingerichtet. Danach wird die Pages Custom Domain erneut im Pages-Projekt hinzugefügt.

### 7.3 Spätere Production-Subzonen

Ohne vollständigen Zonenwechsel wären mindestens diese weiteren Delegationen erforderlich:

```text
p.myqr24.com
app.myqr24.com
```

Das ist möglich, aber betrieblich aufwendiger als die vollständige Übernahme von `myqr24.com` in Cloudflare-DNS. Für Production wird deshalb der vollständige Umzug der Zone empfohlen.

---

## 8. HTTPS und SSL/TLS

### 8.1 Muss ich eigene Zertifikate erstellen?

**Nein**, für die beschriebenen Cloudflare Workers- und Pages-Hosts müssen normalerweise keine eigenen Zertifikate erstellt, gekauft oder auf Dogado installiert werden.

Voraussetzungen:

1. Der Host ist korrekt in einer aktiven Cloudflare-Zone bzw. als erfolgreich validierte Pages Custom Domain eingerichtet.
2. Der DNS-Record zeigt auf die Cloudflare-Konfiguration beziehungsweise wurde von Pages vorgegeben.
3. Für Worker Scan-Domains ist der Record orange-proxied.
4. Die Universal-SSL-Ausstellung und DNS-Propagation sind abgeschlossen.

Cloudflare stellt dann automatisch ein Edge-Zertifikat bereit.

### 8.2 Wartezeit und Prüfung

Nach einer neuen Domain-, Delegations- oder DNS-Konfiguration kann die Zertifikatsausstellung einige Minuten bis zu 24 Stunden dauern.

Während dieser Zeit sind mögliche Fehler:

```text
ERR_SSL_VERSION_OR_CIPHER_MISMATCH
ERR_SSL_PROTOCOL_ERROR
SEC_E_WRONG_PRINCIPAL
```

Diese Fehler dürfen nicht durch Deaktivieren von HTTPS oder durch ein selbstsigniertes Zertifikat umgangen werden.

Prüfung nach Propagation:

```powershell
curl.exe -I https://s.qx4.uk/rsq45q
curl.exe -I https://s.myqr24.com/t/rsq45q
curl.exe -I https://app-staging.myqr24.com/tag/rsq45q
```

### 8.3 Cloudflare SSL/TLS-Modus

Für Worker-Routen antwortet Cloudflare selbst am Edge; ein Dogado-Origin wird bei erfolgreicher Worker-Routenabdeckung nicht benötigt.

Falls später weitere proxied Dogado-Webhosts über Cloudflare ausgeliefert werden, ist im Cloudflare Dashboard unter **SSL/TLS → Overview** in der Regel mindestens **Full** und bei einem gültigen Origin-Zertifikat **Full (strict)** zu verwenden. Der unsichere Modus `Flexible` ist nicht für die myQR24-Zielarchitektur vorgesehen.

---

## 9. Reihenfolge für die aktuelle Staging-Abnahme

### Variante A: Nur `s.qx4.uk` sofort aktivieren

Diese Variante ist ausreichend, um die Worker- und Tag-Weiterleitung unmittelbar zu testen.

1. In der vorhandenen Cloudflare-Zone `qx4.uk` den proxied A-Record `s → 192.0.2.1` anlegen.
2. Worker Route `s.qx4.uk/* → myqr24-edge-routing-staging` anlegen.
3. Auf TLS-Propagierung warten.
4. Test ausführen:

   ```text
   https://s.qx4.uk/rsq45q
   ```

5. Der erwartete `302` führt zunächst auf:

   ```text
   https://myqr24-staging-test-pwa.pages.dev/tag/rsq45q
   ```

### Variante B: Vollständige Staging-Topologie

Zusätzlich zu Variante A:

1. `app-staging.myqr24.com` im Pages-Projekt als Custom Domain aktivieren.
2. `s.myqr24.com` durch vollständigen DNS-Umzug oder NS-Delegation an Cloudflare anbinden.
3. Worker Route anlegen:

   ```text
   s.myqr24.com/t/* → myqr24-edge-routing-staging
   ```

4. Das Staging-Feature in KV auf folgende Ziel-URL umstellen:

   ```text
   https://app-staging.myqr24.com/tag/{tagId}
   ```

5. Beide Scan-URL-Formen testen:

   ```text
   https://s.qx4.uk/rsq45q
   https://s.myqr24.com/t/rsq45q
   ```

Beide müssen zu derselben PWA-Route mit derselben Tag-ID führen.

---

## 10. Worker-Routen je Umgebung

| Umgebung | Route | Worker |
| --- | --- | --- |
| Staging | `s.qx4.uk/*` | `myqr24-edge-routing-staging` |
| Staging | `s.myqr24.com/t/*` | `myqr24-edge-routing-staging` |
| Production | `qx4.uk/*` | `myqr24-edge-routing` |
| Production | `p.myqr24.com/t/*` | `myqr24-edge-routing` |

Die Routen müssen bewusst eng bleiben. Der Worker prüft zusätzlich intern Host und Pfad fail-closed.

---

## 11. Abnahmetests

### Positivtests

```text
GET https://s.qx4.uk/rsq45q
GET https://s.myqr24.com/t/rsq45q
```

Erwartung nach vollständiger Topologie:

```text
HTTP 302
Location: https://app-staging.myqr24.com/tag/rsq45q?exp=...&sig=...
```

### Negativtests

```text
GET  https://s.qx4.uk/t/rsq45q          → 404
GET  https://s.myqr24.com/rsq45q        → 404
GET  https://s.qx4.uk/invalid!          → 404
POST https://s.qx4.uk/rsq45q            → 405
```

Production-Hosts dürfen durch den Staging-Worker nicht aufgelöst werden:

```text
GET https://qx4.uk/rsq45q               → nicht durch Staging auflösen
GET https://p.myqr24.com/t/rsq45q       → nicht durch Staging auflösen
```

---

## 12. Sicherheits- und Betriebsregeln

1. Keine Cloudflare-Origin-IP erraten oder als A-Record übernehmen.
2. Keine Scan-Domain auf graue Wolke (DNS only) setzen, wenn sie per Worker Route bedient wird.
3. Keine Host-Wildcards in die Worker-Logik einführen.
4. Keine Secrets in DNS-Records, Pages-Dateien, Dokumentation oder Git speichern.
5. Bei NS-Delegation den vorherigen Dogado-Record für genau diesen Namen entfernen, um widersprüchliche Antworten zu verhindern.
6. Bestehende Mail- und Webrecords bei einem vollständigen DNS-Umzug vorab vollständig inventarisieren.
7. Production erst nach dokumentierter Staging-Abnahme konfigurieren.
8. Die temporäre `pages.dev`-URL ist nur für die erste Teststrecke zulässig; vor einer breiteren Staging-Nutzung soll auf `app-staging.myqr24.com` umgestellt werden.
