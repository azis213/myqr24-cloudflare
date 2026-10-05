# Teststrategie: TAG-App

## 1. Ziel

Diese Strategie liefert für die TAG-App eine reproduzierbare Testkette von Story und Akzeptanzkriterium bis zu Testdaten, Code und Evidenz. Sie gilt für den bestehenden Cloudflare-Pages-Staging-MVP sowie für die späteren API-gestützten TAG-Features.

Der Router wird separat im [Edge-Router-Teststrang](../edge-router/20-TEST-STRATEGY.md) geprüft. Gemeinsame Scan-zu-PWA-Prüfungen werden als Integrationstests ausgewiesen, ohne fachliche Router-Tests zu duplizieren.

## 2. Testebenen

| Ebene | Ziel | Aktueller Stand | Beispiel |
| --- | --- | --- | --- |
| A: Unit | reine Funktionen und Adapter prüfen | vorhanden | ID-Normalisierung, unbekannte Fixture |
| B: Komponenten | Rendering und UI-Zustände prüfen | auszubauen | Lade-, Fehler- und Vault-Blockzustand |
| C: Build | TypeScript, Vite und statische App-Artefakte prüfen | vorhanden | `npm run build` |
| D: Pages-/Browser | öffentliche Routen und PWA im Browser prüfen | teilweise manuell | direkter `/tag/{tagId}`-Aufruf |
| E: Integration | Router-Redirect bis App prüfen | blockiert | Scan-Host → `/tag/{tagId}` |
| F: API-Contract | Schema und Sichtbarkeit des öffentlichen Views prüfen | geplant | `GET /api/v1/tags/{tagId}/view` |
| G: Security/Privacy | Autorisierung, Cache, Eingaben, Sessions und Datenminimierung prüfen | MVP-Grundlagen vorhanden, API geplant | `no-store`, keine privaten Cache-Einträge |
| H: Feature-E2E | vollständige Feature-Flows prüfen | geplant | Finder-Nachricht, Guestbook, Check-in |

## 3. Pflichtnachweise je Status

| Status | Mindestnachweis |
| --- | --- |
| `implemented` | Code, Testfälle, Testdaten und Traceability sind dokumentiert |
| `verified` für reine UI-/Adapter-Story | zugehörige automatisierte Tests und `npm run build` erfolgreich |
| `verified` für Pages-Route/PWA | automatisierte Tests, Build und dokumentierter Browser-/Staging-Aufruf |
| `verified` für Router→PWA | getrennte Router- und App-Tests plus dokumentierte echte Staging-Weiterleitung |
| `verified` für API-/private Feature | Contract-, Autorisierungs-, Cache- und End-to-End-Tests mit getrennten Staging-Ressourcen |

## 4. Aktuelle lokale Ausführung

Im Repository-Root:

```sh
npm test
npm run build
```

Der Workspace führt Router- und TAG-App-Tests getrennt aus. Für gezielte App-Prüfungen werden die im Root-Package definierten `test:app`- und `build:app`-Befehle verwendet, sobald sie vorhanden sind; bis dahin können die gleichwertigen Befehle im Verzeichnis `apps/tag-app` ausgeführt werden.

Aktuell deckt `apps/tag-app/src/services/publicTagViewService.test.ts` den öffentlichen Adapter ab. Die Testfälle sind in [`21-TEST-CASES.md`](21-TEST-CASES.md) referenziert.

## 5. Aktueller Staging-MVP

### 5.1 Adapter und öffentliche Views

Zu prüfen sind mindestens:

- gültige Fixture-ID wird normalisiert und liefert den vorgesehenen `PublicTagView`;
- syntaktisch ungültige ID wird abgewiesen;
- formal gültige, aber unbekannte ID wird abgewiesen;
- die Fehleransicht zeigt keine Fixture- oder interne Detaildaten;
- Vault-Blocktypen werden ohne HTML-Injektion dargestellt.

### 5.2 Pages und Routing

Zu prüfen sind mindestens:

- direkter Pages-Aufruf `/tag/{tagId}` lädt die App-Shell und die passende Ansicht;
- `_redirects` deckt die öffentliche TAG-Route ab;
- nicht definierte Client-Routen werden kontrolliert behandelt;
- Staging-Alias, Manifest und Icon sind erreichbar.

### 5.3 PWA und Caching

Zu prüfen sind mindestens:

- Service Worker registriert sich nur im Produktionsbuild;
- der Shell-Cache enthält nur dokumentierte öffentliche Ressourcen;
- `/api/` und nicht-GET-Requests werden nicht vom Service Worker beantwortet oder gespeichert;
- Navigation fällt offline nur auf die App-Shell zurück;
- private Inhalte werden weder als Testdaten noch im Cache erwartet.

## 6. Integrationsstrategie: Edge Router → TAG-App

Der Integrationstest ist erst ausführbar, wenn APP-BLK-001 gelöst ist.

1. Den aktiven Staging-Worker und seinen gebundenen KV-Namespace im Cloudflare-Dashboard identifizieren.
2. Das getestete Redirect-Feature kontrolliert auf den dokumentierten Pages-Alias setzen.
3. Einen nicht produktiven Testtag über den aktiven Scan-Host aufrufen.
4. HTTP-Redirect (`302`), Pfad `/tag/{tagId}` und identische Tag-ID prüfen.
5. Im Browser das Rendering der TAG-App prüfen.
6. Falscher Pfad und ungültige ID bleiben Router-Negativtests und müssen `404` liefern.
7. Nur nicht geheime, nicht produktive Testdaten in Evidenz dokumentieren.

## 7. API-Contract- und Sicherheitstests ab APP-I03

Vor einer API-gestützten Story sind folgende Tests verbindlich:

- Schema-Contract `PublicTagView` inklusive unbekannter oder zusätzlicher Felder;
- veröffentlicht, nicht veröffentlicht, widerrufen, unbekannt;
- kein Zugriff auf private Assets über öffentliche URLs;
- `Cache-Control` passend für öffentliche, private und dynamische Antworten;
- keine Berechtigung aus UI-Flags, Pfaden oder manipulierten Client-Parametern;
- serverseitige Authentisierung, Autorisierung, CSRF- und Rate-Limit-Tests für schreibende Flows;
- keine Tokens, Sessions, Chat-Daten, Rohstandorte oder private Medien im Cache Storage.

## 8. Feature-spezifische Testschwerpunkte

| Epic | Kernprüfungen |
| --- | --- |
| Vault | View-Sichtbarkeit, Blockschema, Medien- und Cache-Regeln, Widerruf |
| Owner | Session-Cookies, PIN-/Passkey-Schutz, CSRF, Audit und Rollen |
| Lost & Found / Chat | Status-Gates, Thread-Autorisierung, Rate Limit, `no-store`, Moderation |
| Guestbook | Serverzeit, Einreichungsfenster, Moderation und veröffentlichte Sicht |
| Check-in | Einwilligung, GeoFence, Genauigkeit, Offline-Alter, Idempotenz und Datenschutz |
| Collections / Campaigns | Nutzerisolation, serverseitige Aggregation, Credit-Deduplizierung und Atomizität |
| Gemeinsame PWA / Permissions | keine Startdialoge, Kontextanfrage, Browser-Fallback, Widerruf und lokale Präferenzgrenzen |
| Capabilities | anonymer/angemeldeter/Owner-Kontext, veraltete UI, erneute serverseitige Prüfung und `no-store` für persönliche Daten |

## 9. Berechtigungs- und Capability-Testregeln

Die verbindlichen fachlichen Vorgaben stehen im [Berechtigungs-, Datenschutz- und Capability-Modell](../../10-Architecture/PWA_PERMISSION_AND_CAPABILITY_MODEL.md).

- Browser- und Betriebssystemberechtigungen werden über testbare Adapter beziehungsweise Browser-Automatisierung simuliert; Tests behaupten keine plattformübergreifend identische Systemdialog-UI.
- App-Start, öffentliche TAG-Route und reines Rendern eines Views dürfen keine Anfrage an Kamera, Standort, Mikrofon oder Push auslösen.
- Erst ein bewusster Funktionsstart darf die zugehörige Browser-API ansprechen; abgelehnte Berechtigungen lösen einen dokumentierten Fallback aus.
- Tests unterscheiden Systemberechtigung, lokale App-Präferenz und serverseitige Einwilligung/Policy.
- Ein widerrufener App-Präferenzwert verhindert neue Erfassungsvorgänge, ohne bestehende Serverereignisse im Client umzudeuten.
- Scanner-Tests prüfen ausschließlich die Navigation für dokumentierte myQR24-URL-Kandidaten; sie prüfen keine Edge-Kryptografie oder Redirect-Signatur.
- Capability-Tests manipulieren Buttons, lokale Zustände und veraltete Antworten und erwarten weiterhin eine serverseitige Ablehnung geschützter Requests.
- Persönliche Scans, Check-ins, Sessions, Einwilligungen und Capability-Antworten werden weder vom Service Worker persistiert noch in Evidenz mit personenbezogenen Beispielen dokumentiert.

## 10. Testdaten- und Evidenzregeln

- Nur `APP-TD-*`-Testdaten gemäß [`22-TEST-DATA.md`](22-TEST-DATA.md) verwenden.
- Keine realen Kundendaten, Produktions-Tags, Secrets, Cookies, Tokens oder Rohstandorte committen.
- API- und Medienfixtures müssen Sichtbarkeitsklassen eindeutig markieren.
- Nachweise in [`../evidence/README.md`](../evidence/README.md) dokumentieren; sie enthalten keine flüchtigen Geheimwerte oder vollständige Dumps.
- Ein Fehlerfall wird vor der Fehlerbehebung durch einen reproduzierbaren Test abgesichert.
