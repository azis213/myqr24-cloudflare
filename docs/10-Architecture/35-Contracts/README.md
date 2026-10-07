# TAG-Plattform-Verträge

**Status:** `W0 in progress`  
**Verbindlichkeit:** Dieser Ordner enthält versionierte Verträge zwischen Plattformkomponenten. Verträge sind vor einer abhängigen Implementierung zu prüfen, mit Testreferenzen zu versehen und kompatibel weiterzuentwickeln.

## Regeln

1. Jeder Vertrag nennt Owner, Version, Datenklassifikation, Authentisierung, Autorisierung, Fehlerform, Caching, Idempotenz und Testreferenzen.
2. Browser erhalten keine serverseitigen Secrets, Cloudflare-Tokens, Datenbankzugänge oder internen API-Schlüssel.
3. Verträge werden ohne reale Tokens, Secrets, personenbezogene Daten oder vollständige Nachweise dokumentiert.
4. Breaking Changes benötigen eine neue Version und einen Migrations-/Kompatibilitätsplan.
5. Ein dokumentierter Vertrag ersetzt keine W0-Gates, keine Hostingbestätigung und keinen Staging-Nachweis.

## Verträge in Lieferreihenfolge

| Vertrag | Owner | Status | Zweck |
| --- | --- | --- | --- |
| [`tag-codec-internal-v1.md`](tag-codec-internal-v1.md) | Cloudflare TAG Codec Worker | `planned` | Interne, authentisierte Erzeugung öffentlicher TAG-IDs aus autoritativ reservierten kanonischen Werten |
| `tag-routing-projection-v1` | TAG Control Plane | `planned` | Minimale Control-Plane-zu-Edge-Router-KV-Projektion |
| `control-plane-admin-api-v1` | TAG Control Plane | `planned` | Authentisierte Admin-Queries und -Commands des Control Centers |
| `public-tag-view-v1` | TAG Control Plane | `planned` | Öffentliche, datensparsame TAG-App-Read-API |
| `public-tag-claim-v1` | TAG Control Plane | `planned` | Neutralisierter öffentlicher Claim-Command |
| `tag-runtime-projection-v1` | TAG Control Plane | `planned` | Öffentliche Runtime-Projektion |
| `owner-session-and-content-v1` | TAG Control Plane | `planned` | TAG-gebundene Owner-Session und Inhaltsverwaltung |
| `collection-api-v1` | TAG Control Plane | `planned` | Accountgebundene Collections |

## Versionierte Secret-Grenzen

Secretnamen enthalten immer eine Versionskennung. Die gegenwärtig festgelegte Staging-Version ist `S01`. Ein neuer Secretwert wird unter einem neuen Namen angelegt; ein bestehender versionsgebundener Name wird nicht mit einem anderen Wert überschrieben. Die konkrete erste Production-Version wird erst vor dem Production-Gate festgelegt.

| Staging-Wert | Zulässige Komponenten | Unzulässige Komponenten |
| --- | --- | --- |
| `FEISTEL_SECRET_S01` | Cloudflare Staging Edge Router, Cloudflare Staging TAG Codec Worker | Control Plane, Control Center, TAG-App, TAG Lab, Browser |
| `TAG_HMAC_SECRET_S01` | Cloudflare Staging Edge Router, Cloudflare Staging TAG Codec Worker | Control Plane, Control Center, TAG-App, TAG Lab, Browser |
| `REDIRECT_SIGNING_SECRET_S01` | Cloudflare Staging Edge Router | Control Plane, Control Center, TAG-App, TAG Lab, Browser |
| `TAG_CODEC_API_KEY_S01` | Cloudflare Staging TAG Codec Worker, serverseitige Staging Control Plane | Control Center, TAG-App, TAG Lab, Browser |
| DB-, Session-, CSRF- und Claim-Secrets | ausschließlich serverseitige TAG Control Plane | Cloudflare Pages, Browser, TAG Lab |

Die tatsächlichen Cloudflare-Werte werden als Cloudflare Worker Secrets verwaltet. Lokale Tools verwenden ausschließlich getrennte, Git-ignorierte Testwerte mit denselben versionierten Variablennamen in `tools/.env.local`. Der lokale TAG Lab liest seine getrennte Staging-Datei `.env.staging.local` und benötigt mindestens `FEISTEL_SECRET_S01`; `TAG_HMAC_SECRET_S01` ist nur für die lokale Erzeugung achtstelliger Tags erforderlich.
