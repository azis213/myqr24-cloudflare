# Datenarchitektur myQR24

**Status:** Zielarchitektur / fachliche und technische Planungsgrundlage  
**Stand:** 2026-10-06  
**Geltungsbereich:** Edge Router, öffentliche TAG-App, TAG Control Plane (TCP) und TAG Control Center (TCC)

## Zweck

Diese Dokumentationsreihe beschreibt die myQR24-Datenarchitektur in zwei aufeinander aufbauenden Sichten:

1. **Fachlich-logisch:** Welche Domänenobjekte existieren, wie sie zusammenhängen und welche Komponente für sie fachlich verantwortlich ist.
2. **Physisch-technisch:** In welchen Speichertechnologien und Datenstrukturen die Objekte je Plattformkomponente abgelegt, repliziert, projiziert oder nur temporär gehalten werden.

Die Reihe unterscheidet strikt zwischen der autoritativen Verwaltungsquelle und öffentlich auslieferbaren, minimierten Projektionen:

```text
TAG Control Plane (PHP + MySQL)
  = autoritative fachliche Datenquelle
  = Verwaltung, Policies, Berechtigungen, Inhalte, Audit

Cloudflare Edge / TAG-App Runtime
  = abgeleitete öffentliche Data Plane
  = Scan-Auflösung, veröffentlichte Runtime, Medienauslieferung

TAG Control Center
  = administrative Bedienoberfläche
  = keine eigenständige fachliche Datenquelle
```

## Dokumente

| Dokument | Inhalt |
| --- | --- |
| [10-DOMAIN-DATA-MODEL.md](10-DOMAIN-DATA-MODEL.md) | Fachliches Gesamtmodell: Aggregate, Datenobjekte, Schlüssel, Lebenszyklen, Beziehungen, Datenklassifikation und Ownership |
| [20-COMPONENT-DATA-ARCHITECTURE.md](20-COMPONENT-DATA-ARCHITECTURE.md) | Logische Datensicht je Komponente: Edge Router, TAG-App, TCP und TCC einschließlich Ein- und Ausgaben |
| [30-PHYSICAL-DATA-ARCHITECTURE.md](30-PHYSICAL-DATA-ARCHITECTURE.md) | Physische Abbildung: MySQL-Relationen, Cloudflare KV, R2, Runtime-JSON, Browser-Speicher, Sessions, Outbox und Publikationspfade |

## Verbindliche Leitprinzipien

1. **Single Source of Truth:** TCP auf PHP/MySQL ist für sämtliche fachlichen Verwaltungsdaten autoritativ.
2. **Projection, not replication:** Cloudflare KV, R2-Runtime-JSON und Caches enthalten ausschließlich abgeleitete, veröffentlichte und minimal notwendige Daten.
3. **Kein Secret in der Data Plane:** Keine Credentials, Passwort-/PIN-Hashes, Session-Tokens, Audit-Rohdaten, Owner-/Organisationsdaten, Nachweise oder privaten Vault-Inhalte in KV, öffentlichen JSON-Projektionen oder Client-Bundles.
4. **Serverautoritative Berechtigung:** Eine TAG-ID, ein lokaler Collection-Eintrag oder ein Client-Status begründen niemals Eigentum, Sichtbarkeit oder Schreibrechte.
5. **Immutable publication:** Öffentliche Runtime-Revisionen und Medienversionen sind adressierbar und werden nur über einen kontrollierten, auditierbaren TCP-Publish-Prozess aktiviert.
6. **Fail closed:** Fehlt eine valide aktive Routing- oder Runtime-Projektion, liefert die öffentliche Strecke keine Details über Entwurf, Owner, Claim oder Sperrgrund.
7. **Datenminimierung:** Jede Schnittstelle liefert nur die Felder, die für ihren Zweck benötigt werden; personenbezogene Daten bleiben in der Control Plane.

## Begriffe und Abkürzungen

| Begriff | Bedeutung |
| --- | --- |
| **TAG** | physisches oder selbstgedrucktes QR-/NFC-Objekt mit öffentlicher `tagId` und internem kanonischem `decodedValue` |
| **TCP** | TAG Control Plane: PHP-/MySQL-Anwendung als fachlich autoritative Quelle |
| **TCC** | TAG Control Center: administrative Oberfläche auf Basis der TCP-Contracts |
| **Runtime-Projektion** | publizierte, bereinigte öffentliche Darstellung eines Tags für die TAG-App |
| **Routing-Projektion** | minimale KV-Konfiguration für Edge-Scanvalidierung und Feature-Auflösung |
| **Vault** | Inhaltsaggregate eines TAGs mit Items, Blöcken, Sichtbarkeit und Medienreferenzen |
| **Owner** | fachlich berechtigter Verwalter eines TAGs; über Konto-/Organisation oder TAG-Owner-Passphrase-Session |
| **Public Data Plane** | Cloudflare-gestützte öffentliche Auslieferung ohne vertrauliche Verwaltungsdaten |

## Verbindliche Quellen

- [TAG Control Plane und Basis-Vault](../PWA-PHP-Applications/TAG_CONTROL_PLANE_AND_BASIS_VAULT.md)
- [Domain-, TAG- und Routing-Regeln](../../DOMAIN_RULES.md)
- [TAG-App-Architektur](../TAG_APP_ARCHITECTURE.md)
- [TAG Vault Feature](../../20-Special-Specifications/TAG_VAULT_FEATURE.md)
- [TAG-Typen und POI-/Community-TAGs](../../20-Special-Specifications/TAG_TYPES_AND_POI_FEATURES.md)
- [TAG Check-in, Collections & Campaigns](../../20-Special-Specifications/TAG_CHECKIN_COLLECTIONS_CAMPAIGNS.md)
- [Cloudflare DNS und TLS](../CLOUDFLARE_DNS_AND_TLS_CONFIGURATION.md)

Bei Widersprüchen sind Sicherheits-, ID- und Routingregeln aus `DOMAIN_RULES.md` sowie die Control-Plane-Grenze aus `TAG_CONTROL_PLANE_AND_BASIS_VAULT.md` vorrangig. Dieses Verzeichnis konkretisiert sie datenarchitektonisch, ersetzt sie jedoch nicht.
