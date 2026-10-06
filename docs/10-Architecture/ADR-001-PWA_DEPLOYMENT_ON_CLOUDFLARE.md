# ADR-001: Deployment der myQR24-PWA auf Cloudflare

**Status:** Accepted  
**Datum:** 2026-10-01  
**Entscheidung:** Die myQR24-PWA wird einschließlich ihrer späteren Application API primär auf Cloudflare betrieben. Für die erste Staging-Verifikation wird eine kleine statische Test-PWA auf Cloudflare Pages bereitgestellt.

---

## 1. Kontext

Der bestehende **myQR24 Edge Tag Router** wird als separater Cloudflare Worker betrieben. Er validiert öffentliche NFC-/QR-Tag-URLs, decodiert und prüft die Tag-ID, löst die Feature-Zuweisung aus Cloudflare KV auf und liefert entweder ein JSON-Aktionsdokument oder einen sicheren Redirect.

Die erste reale Staging-Instanz soll zunächst die Ende-zu-Ende-Weiterleitung echter Testtags nachweisen. Die vollständige myQR24-PWA mit TAG Vault, TAG Chat, Lost & Found, Guestbook und Check-ins existiert noch nicht. Daher wird zunächst ein einfaches, erreichbares und vertrauenswürdiges Redirect-Ziel benötigt.

Als mögliche Hosting-Varianten wurden betrachtet:

1. Cloudflare Pages beziehungsweise Workers Assets;
2. der bereits vorhandene PHP-Webserver bei Dogado;
3. eine mögliche Hetzner-Serverinstanz.

Die Entscheidung betrifft das Hosting der PWA. Der Edge Router bleibt unabhängig und wird nicht zu einer Fachanwendung erweitert.

---

## 2. Entscheidung

### 2.1 Zielarchitektur

Die myQR24-PWA wird auf Cloudflare betrieben:

- **PWA-Frontend:** Cloudflare Pages oder Workers mit Static Assets;
- **Application API:** separater Cloudflare Worker;
- **relationale Fachdaten:** Cloudflare D1;
- **öffentliche und private Binärdaten:** Cloudflare R2;
- **gezielte Atomizität, Limits und Realtime:** bei Bedarf Cloudflare Durable Objects;
- **asynchrone Verarbeitung:** bei Bedarf Cloudflare Queues und Worker Consumer.

PWA und Application API liegen in der ersten Produktversion unter demselben Origin:

```text
https://app.myqr24.com/tag/{tagId}
https://app.myqr24.com/api/v1/...
```

Dadurch werden Cross-Origin-Komplexität, CORS-Regeln und Cookie-Sicherheitsrisiken für die erste Version minimiert.

### 2.2 Staging-Test-PWA

Für die initiale Staging-Abnahme wird vor der vollständigen Fach-PWA eine statische Test-PWA auf **Cloudflare Pages** bereitgestellt.

Empfohlene Staging-Topologie:

```text
NFC-/QR-Testtag
  │
  ▼
https://s.qr4.uk/t/{tagId}
https://s.myqr24.com/t/{tagId}
  │
  ▼
myqr24-edge-routing-staging
  │
  ▼
302-Redirect
  │
  ▼
https://app-staging.myqr24.com/tag/{tagId}
  │
  ▼
Cloudflare Pages: myQR24-Test-PWA
```

Die Staging-PWA ist von der späteren Produktions-PWA getrennt:

```text
Staging:     app-staging.myqr24.com
Produktion:  app.myqr24.com
```

Sie dient ausschließlich dazu, einen erfolgreichen Redirect sichtbar und reproduzierbar nachzuweisen. Sie stellt keine Fachfunktionen bereit und ist keine Vorabimplementierung sensibler PWA- oder API-Logik.

---

## 3. Begründung

### 3.1 Technische Konsistenz

Der Edge Router wird bereits auf Cloudflare ausgeführt. Das PWA-Deployment auf Cloudflare ergänzt diese Architektur ohne zusätzliche Hosting-Grenze:

```text
Scan-Domain → Edge Router → PWA → Application API → D1/R2/DO
```

Ein PHP-Webserver bei Dogado oder eine Hetzner-Instanz würde zwar als Redirect-Ziel funktionieren, aber eine zweite, technisch getrennte Plattform einführen. Dadurch steigen für eine einfache Teststrecke die Komplexität für Deployment, DNS, TLS, Monitoring, Security Headers, Caching und spätere API-Integration.

### 3.2 Geringer Betriebsaufwand für statische PWA

Eine statische PWA benötigt keinen PHP-Interpreter, keine Serverprozesse und keine klassische Serveradministration. Cloudflare Pages stellt dafür unmittelbar bereit:

- HTTPS und Zertifikatsverwaltung;
- CDN-Auslieferung;
- versionierte und cachebare statische Assets;
- Git- oder Wrangler-basierte Deployments;
- Custom Domains;
- Preview-Deployments;
- keine Pflege von Betriebssystem, Webserver oder PHP-Laufzeit.

Diese Eigenschaften passen besonders gut zur ersten Test-PWA, deren Inhalt aus statischem HTML, CSS, JavaScript, Manifest, Icons und einem minimalen Service Worker besteht.

### 3.3 Sichere spätere Erweiterbarkeit

Die vollständige Anwendung benötigt später eine sichere API-Grenze für Autorisierung, Sessions, Uploads, Sichtbarkeiten, Freigaben, Audit-Daten und fachliche Zustandsübergänge. Die vorgesehene Cloudflare-Architektur erlaubt eine klare Trennung:

| Schicht | Cloudflare-Komponente | Verantwortung |
| --- | --- | --- |
| Edge Resolver | Worker | öffentliche URL-, Tag-ID-, Range- und Feature-Auflösung |
| PWA | Pages oder Workers Assets | UI, Offline-App-Shell und Nutzerinteraktion |
| Application API | Worker | Authentisierung, Autorisierung und Fachlogik |
| Fachdaten | D1 | relationale Metadaten, Sitzungen, Freigaben und Audit |
| Binärdaten | R2 | öffentliche und private Medien |
| atomare Spezialfälle | Durable Objects | Einmalfreigaben, harte Limits, Realtime, Serialisierung |
| Hintergrundverarbeitung | Queues / Consumer | Medienprüfung, Varianten, Benachrichtigungen |

Der Router bleibt hierbei absichtlich klein und zustandslos. Er verarbeitet keine Owner-Sessions, Inhalte, Uploads, privaten Daten oder Fachzustände.

### 3.4 Same-Origin als Sicherheits- und Vereinfachungsvorteil

Die empfohlene erste Produktversion verwendet dieselbe Origin für PWA und API:

```text
https://app.myqr24.com/tag/{tagId}
https://app.myqr24.com/api/v1/...
```

Vorteile:

- keine CORS-Konfiguration für Browser-API-Anfragen;
- `HttpOnly`, `Secure` und `SameSite=Strict` Cookies können konsistent eingesetzt werden;
- CSP- und Service-Worker-Strategie bleiben zentral steuerbar;
- geringere Gefahr fehlerhafter Cross-Origin-Cookie- oder CSRF-Konfiguration;
- klare Trennung zwischen Scan-Resolver und Fachanwendung.

---

## 4. Bewertete Alternativen

### 4.1 Alternative A: Cloudflare Pages / Workers Assets

**Bewertung:** gewählt.

| Kriterium | Bewertung |
| --- | --- |
| Eignung für statische Test-PWA | sehr hoch |
| Zusatzinfrastruktur | keine klassische Serverinstanz |
| TLS, CDN und Custom Domain | integriert |
| Betriebsaufwand | gering |
| Integration mit Edge Router und späterer API | sehr hoch |
| Deployment-Modell | Git- oder Wrangler-basiert |
| Kostenmodell | nutzungs- und planabhängig; für eine kleine statische Test-PWA typischerweise sehr günstig bzw. innerhalb verfügbarer Einstiegskontingente |
| spätere Skalierung | direkt auf API, D1, R2, Queues und Durable Objects erweiterbar |

Cloudflare Pages ist für die Staging-Test-PWA die bevorzugte konkrete Ausprägung. Für die spätere Produkt-PWA kann Pages weiterhin verwendet werden; alternativ sind Workers Assets möglich, falls Auslieferung und serverseitige Request-Logik enger gekoppelt werden sollen.

### 4.2 Alternative B: Vorhandenes PHP-Hosting bei Dogado

**Bewertung:** nicht gewählt.

Das vorhandene Dogado-PHP-Hosting kann die Test-PWA grundsätzlich ausliefern. Da das Paket bereits besteht, können die unmittelbaren Mehrkosten gering oder null sein. Für die Anforderungen der Test-PWA ergibt sich jedoch kein funktionaler Vorteil aus PHP.

Nachteile gegenüber Cloudflare:

- zusätzliche Hosting- und Betriebsgrenze neben dem bereits verwendeten Cloudflare Edge Router;
- separates Deployment-, TLS-, Header-, Cache- und Monitoring-Modell;
- kein direkter Übergang zur geplanten Cloudflare API-, D1-, R2- und Worker-Architektur;
- spätere Same-Origin-Architektur müsste entweder aufgegeben oder die PWA erneut migriert werden;
- PHP ist für die rein statische PWA nicht erforderlich.

Dogado bleibt eine mögliche Option für Systeme, die bewusst unabhängig von Cloudflare betrieben werden müssen oder für bestehende PHP-Funktionen mit klar abgegrenzter Verantwortung. Es ist nicht das Zielhosting für die myQR24-PWA.

### 4.3 Alternative C: Hetzner-Instanz

**Bewertung:** nicht gewählt.

Eine Hetzner-Instanz bietet hohe Flexibilität und kann bei dauerhaftem, gut planbarem Compute-Bedarf oder speziellen Workloads wirtschaftlich sinnvoll sein. Für eine kleine statische Staging-PWA wäre sie jedoch unverhältnismäßig.

Nachteile für den aktuellen Zweck:

- monatliche Fixkosten;
- Betriebssystem-, Webserver-, TLS-, Patch- und Monitoring-Verantwortung;
- keine notwendige Serverlogik für die Test-PWA;
- zusätzliche Plattformgrenze zur Cloudflare-basierten Edge- und späteren Anwendungsarchitektur.

Eine Hetzner-Instanz bleibt eine mögliche spätere Ergänzung für spezialisierte Hintergrundverarbeitung, besondere Laufzeitabhängigkeiten oder eine externe Datenbankstrategie. Sie ist keine Voraussetzung für PWA oder Staging-Redirect-Tests.

---

## 5. Kostenbetrachtung

Die Entscheidung ist nicht ausschließlich kostengetrieben. Sie berücksichtigt Gesamtbetriebskosten, Architekturkomplexität und zukünftige Migrationskosten.

| Gesichtspunkt | Cloudflare Pages / Workers | Bestehendes Dogado-PHP-Hosting | Hetzner-Instanz |
| --- | --- | --- | --- |
| Direkte Kosten für statische Test-PWA | in der Regel sehr niedrig | gegebenenfalls keine Mehrkosten | monatliche Fixkosten |
| Serveradministration | entfällt weitgehend | Hosting- und PHP-spezifisch | vollständig selbst zu verantworten |
| CDN und TLS | integriert | tarif- und konfigurationsabhängig | selbst zu ergänzen oder zu konfigurieren |
| Betriebsmodell | einheitlich mit Edge Router | getrennte Plattform | getrennte Plattform |
| Migrationsaufwand zur Zielarchitektur | gering | höher | höher |
| Eignung für umfangreiche, dauerhafte Compute-Last | nutzungsabhängig prüfen | begrenzt durch Hosting-Tarif | gut planbar, aber mit Betriebsaufwand |

### 5.1 Kostenregel für spätere Produktentscheidungen

Vor einem Produktivstart müssen die dann gültigen Preise, Kontingente und Limits der konkret verwendeten Cloudflare-Pläne überprüft werden. Dies betrifft insbesondere:

- Workers Requests und CPU-Zeit;
- Pages Build- und Auslieferungslimits;
- D1-Lese-/Schreibvolumen und Speicher;
- R2-Speicher, Operationen und Egress;
- Durable Objects;
- Queues.

Bei später sehr hoher, konstanter oder rechenintensiver Last wird eine erneute Wirtschaftlichkeitsanalyse durchgeführt. Die API-Grenze bleibt so gestaltet, dass D1 bei Bedarf durch PostgreSQL über Hyperdrive oder einen externen Datenbankdienst ergänzt bzw. ersetzt werden kann.

---

## 6. Anforderungen an die Staging-Test-PWA

Die Test-PWA benötigt nur die folgenden Komponenten:

```text
index.html
app.js
styles.css
manifest.webmanifest
service-worker.js
icons/
_redirects oder äquivalente SPA-Fallback-Konfiguration
```

Sie muss:

1. die Route `/tag/{tagId}` clientseitig darstellen;
2. die Tag-ID aus dem Pfad anzeigen;
3. die Staging-Umgebung eindeutig kennzeichnen;
4. Zeitpunkt und aufgerufene URL zu Diagnosezwecken anzeigen;
5. optional die Parameter `exp` und das Vorhandensein von `sig` anzeigen;
6. installierbar sein;
7. ausschließlich App-Shell und versionierte statische Assets cachen.

Sie darf nicht:

- Redirect-Signaturen als Berechtigung interpretieren;
- Redirect-Signaturen ohne serverseitiges Secret als gültig bewerten;
- private Daten, Sitzungen oder Fachzustände speichern;
- API- oder Berechtigungslogik vorwegnehmen;
- Staging- und Produktionsdaten vermischen.

Für den Testredirect wird ein temporärer, nicht permanenter Status verwendet:

```json
{
  "id": "test-pwa-redirect",
  "type": "redirect",
  "enabled": true,
  "urlTemplate": "https://app-staging.myqr24.com/tag/{tagId}",
  "signing": {
    "ttlSeconds": 60
  },
  "status": 302
}
```

`302` verhindert, dass Browser einen veränderlichen Testredirect dauerhaft cachen. Der Router ergänzt bei aktivierter Signierung die Query-Parameter `exp` und `sig`.

---

## 7. Konsequenzen

### Positive Konsequenzen

- Einheitliche Cloudflare-Betriebsumgebung für Edge Router, PWA und spätere API;
- schneller, risikoarmer Nachweis der Tag-Weiterleitung;
- kein unnötiger PHP- oder Serverbetrieb für eine statische Testanwendung;
- klare Staging-/Production-Trennung;
- einfache Erweiterung zur vollständigen Cloudflare-nativen PWA;
- reduzierte Cross-Origin- und Cookie-Komplexität durch dieselbe Origin für PWA und API;
- weniger spätere Migrationen.

### Negative Konsequenzen und Risiken

- Abhängigkeit von Cloudflare für PWA-Auslieferung und spätere Anwendungsdienste;
- nutzungsabhängige Kosten müssen bei Wachstum aktiv überwacht werden;
- Team benötigt Kenntnisse in Workers-, D1-, R2- und Cloudflare-Sicherheitsmodellen;
- das Staging-Setup benötigt Cloudflare-Zugriffsrechte für Pages, Workers, KV und DNS;
- die Test-PWA darf nicht irrtümlich als vollständige Anwendung betrachtet oder in Produktion promotet werden.

### Gegenmaßnahmen

- Ressourcen und Secrets pro Umgebung strikt trennen;
- Kosten- und Usage-Monitoring vor Produktivstart konfigurieren;
- Application API hinter einer klaren fachlichen Schnittstelle halten;
- Infrastructure- und Deployment-Konfiguration dokumentieren und versionieren;
- Staging-Test-PWA als eigenständiges, klar begrenztes Projekt behandeln;
- erst nach dokumentierter Staging-Abnahme eine Production-Promotion prüfen.

---

## 8. Nicht im Umfang dieser Entscheidung

Diese ADR entscheidet nicht:

- über die fachliche Implementierung von TAG Vault, Chat, Lost & Found, Guestbook oder Check-ins;
- über Authentisierungsanbieter oder die konkrete Owner-Account-Implementierung;
- über die endgültige Datenbankstrategie bei sehr hohem Skalierungsbedarf;
- über die Production-Promotion des Edge Routers;
- über die konkrete Preisstufe von Cloudflare, Dogado oder Hetzner;
- über eine Abschaltung bestehender Dogado- oder Hetzner-Infrastruktur.

---

## 9. Verwandte Dokumente

- [Cloudflare-native PWA-Komponente](CLOUDFLARE_PWA_COMPONENT.md)
- [Deployment-Handover: myQR24 Edge Tag Router](../90-Session-Change-Summaries/DEPLOYMENT_HANDOVER.md)
- [Gesamtarchitektur](../ARCHITECTURE.md)
- [Domain-Regeln](../DOMAIN_RULES.md)
