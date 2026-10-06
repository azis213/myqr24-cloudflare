# TAG Edge APIs und URL-Verträge

**Status:** Zielarchitektur / teilweise verbindlicher Vertrag  
**Stand:** 2026-10-06  
**Geltungsbereich:** Öffentliche TAG-Scan-, Runtime-, Medien- und zugriffsbezogene HTTP-Schnittstellen zwischen QR-/NFC-Trägern, Cloudflare Edge, TAG-App und TAG Control Plane.

## Zweck

Dieser Dokumentationsbereich definiert die stabilen URL- und HTTP-Verträge der öffentlichen TAG-Data-Plane. Er trennt bewusst:

- Scan-Einstieg und kryptografische TAG-Auflösung;
- sichtbare Browser- und PWA-Routen;
- maschinenlesbare Runtime-APIs;
- kontrollierte Medienauslieferung;
- geschützte Owner-, Account- und Zugriffsoperationen.

Die Verträge verhindern, dass QR-/NFC-URLs, App-Deep-Links, R2-Objektpfade und interne Verwaltungs-APIs miteinander vermischt werden.

## Architekturprinzip

```text
QR / NFC
  → Scan-Route auf s.myqr24.com bzw. p.myqr24.com
  → Edge Router validiert TAG-ID und Routing-Projektion
  → Redirect auf die TAG-App
  → TAG-App lädt Runtime-Daten und Medien über das Edge Gateway
  → Gateway leitet intern auf erlaubte R2-Objekte bzw. Runtime-Services auf
```

Der Browser sieht ausschließlich stabile fachliche URLs. Interne Cloudflare-KV-Keys, R2-Bucket-Namen, R2-Objektpfade, Datenbank-IDs, Secrets und Authorisierungsentscheidungen sind kein öffentlicher Vertrag.

## Dokumente

1. **[Routing- und URL-Vertrag](10-ROUTING-AND-URL-CONTRACT.md)**  
   Hosts, Routenfamilien, Zuständigkeiten, Methoden, Versionierung, Caching und Fehlerverhalten.
2. Zukünftige Verträge werden bei konkreter Implementierung ergänzt:
   - Runtime-View-Schema und Content-Block-Vertrag;
   - Medienauslieferung, Assetvarianten und Retention;
   - PIN-, Grant-, Owner- und Account-Sessions;
   - konkrete API-Fehlercodes, Rate Limits und CORS-Regeln.

## Verbindlichkeitsstufen

| Stufe | Bedeutung |
| --- | --- |
| **verbindlich** | Bestehender bzw. bewusst festgelegter, stabil zu haltender Vertrag; Änderungen benötigen Migration, Tests und dokumentierte Freigabe. |
| **reserviert** | Pfadfamilie und Verantwortlichkeit sind festgelegt, konkrete Endpunkte oder Payloads noch nicht implementiert. |
| **konzeptionell** | Zielrichtung; erst vor Implementierung als verbindlicher API-Vertrag detaillieren. |

Die bestehenden Scan-Routen `/t/{tagId}` und `/t1/{tagId}` sowie ihre kryptografischen Regeln bleiben in [`../../DOMAIN_RULES.md`](../../DOMAIN_RULES.md) maßgeblich. Diese Spezifikation ergänzt sie um die komplette URL-Topologie.

## Abgrenzung

Nicht Bestandteil dieser Dokumente sind:

- Verwaltungsdatenbank-Schemas und interne TCP-Services;
- Cloudflare-KV-Dokumentformate außer ihrer Auswirkung auf Scan-Routing;
- TCC-Administrationsoberflächen;
- konkrete R2-Bucket-Namen oder Object-Key-Strukturen;
- frei generierbare Redirect-Ziele;
- browserseitige Autorisierungs- oder Ownership-Entscheidungen.

## Verwandte Dokumente

- [Domain-, TAG- und Routing-Regeln](../../DOMAIN_RULES.md)
- [Cloudflare DNS- und TLS-Konfiguration](../../10-Architecture/CLOUDFLARE_DNS_AND_TLS_CONFIGURATION.md)
- [TAG-App-Architektur](../../10-Architecture/TAG_APP_ARCHITECTURE.md)
- [TAG Control Plane und Basis Vault](../../10-Architecture/PWA-PHP-Applications/TAG_CONTROL_PLANE_AND_BASIS_VAULT.md)
- [Datenarchitektur je Plattformkomponente](../../10-Architecture/30-Data-Architecture/20-COMPONENT-DATA-ARCHITECTURE.md)
- [Komponenten- und App-Überblick](../../10-Architecture/31-App-Architecture/10-COMPONENTS-AND-APPLICATIONS.md)
