# Edge-Infrastruktur

## Zweck

Dieses Projekt stellt einen Cloudflare Worker für die Edge-Routing-Infrastruktur von myQR24 bereit. Es bildet die Grundlage für die Auflösung und Weiterleitung von NFC- und QR-Tag-Aufrufen.

## Request-Fluss

1. Ein NFC-Tag oder QR-Code verweist auf eine öffentliche URL.
2. Cloudflare nimmt den Request an einem Edge-Standort entgegen.
3. Der Worker liest Hostname, Pfad und Request-Metadaten aus.
4. Die Routing-Regeln ordnen die Anfrage einer Tag-, Kampagnen- oder Zielkonfiguration zu.
5. Der Worker antwortet mit einer Redirect-, Fehler- oder API-Response.

## Geplante Bausteine

- **Edge Router:** Zentrale Entscheidung über die Ziel-URL eines eingehenden Tags.
- **Regelwerk:** Versionierte Domain-, AXX-, URL- und Range-Regeln in `DOMAIN_RULES.md`.
- **Konfigurationsspeicher:** Später beispielsweise Cloudflare KV, D1 oder R2.
- **Observability:** Strukturierte Logs, Metriken und Fehlertracking.
- **Sicherheit:** Eingabevalidierung, Allowlisting von Redirect-Zielen und Schutz vor Open Redirects.

## Aktueller Stand

`src/index.ts` stellt einen typisierten Modul-Worker bereit und antwortet zunächst mit einer JSON-Statusmeldung. Bindings werden über das `Env`-Interface ergänzt, sobald Infrastrukturressourcen definiert sind.
