# Control Plane Admin API v1

**Version:** `v1`  
**Status:** `implemented-local`  
**Owner:** TAG Control Plane (TCP)  
**Konsument:** TAG Control Center (TCC)  
**Basis-URL:** `/api/v1/auth`  
**Kompatibilität:** Additive Felder und neue Endpunkte innerhalb von `v1` sind zulässig. Änderungen an Endpunktpfaden, Authentisierungssemantik, Fehlerform oder bestehenden Pflichtfeldern erfordern eine neue Contract-Version oder einen dokumentierten Übergang.  
**Geltungsbereich:** Lokaler W1L-Auth-/Session-Schnitt. Fachliche Admin-Commands, RBAC, Recovery, Re-Authentisierung, Passkey/TOTP und produktive Origin-/Cookie-Policy sind nicht Bestandteil dieses Vertrags.

## 1. Zweck und Verantwortlichkeiten

Dieser Vertrag definiert die minimale browserseitige Administrationseintrittsstrecke:

1. CSRF-Token für eine vorhandene oder neu aufgebaute Web-Session lesen;
2. Passwortschritt durchführen;
3. bei aktivierter Policy eine kurzlebige E-Mail-MFA-Challenge bestätigen;
4. den serverseitigen Session-Status lesen;
5. abmelden.

TCP bleibt Autorität für Passwortprüfung, Aktivstatus, Session, CSRF, Rate Limits, MFA-Challenge, Audit und Fehlernormalisierung. TCC zeigt ausschließlich den von TCP bestätigten Zustand an und speichert keine Zugangsdaten, MFA-Codes, Sessions oder Infrastruktur-Credentials persistent im Browser.

Der Bootstrap-Admin ist **kein HTTP-Endpunkt**. Er wird ausschließlich durch den serverseitigen CLI-Command `tcp:bootstrap-platform-admin` aus geschützter Environment-Konfiguration angelegt.

## 2. Datenklassifikation und ausgeschlossene Daten

| Datenklasse | Zulässig im Browservertrag | Ausgeschlossen |
| --- | --- | --- |
| Session-Status | `authenticated`, E-Mail-Adresse und fachliche Rolle des bereits authentisierten Nutzers | Session-ID, Session-Inhalt, interne Nutzer-ID |
| CSRF | kurzlebiger CSRF-Token für denselben Browserkontext | Session-Secret, Cookie-Werte |
| Passwort-/MFA-Eingabe | nur in der HTTPS-Anfrage zum TCP | Klartext in Response, Logs, Audit-Metadaten, URL, Browser-Storage oder TCC-Status |
| MFA-Zustand | ausschließlich `mfa_required` | Klartextcode, Code-Hash, Challenge-ID, Ablaufzeit, Versuchszähler oder Versanddetails |
| Infrastruktur | keine | SMTP-, Cloudflare-, Datenbank-, Bootstrap- und Deployment-Secrets sowie Tokens |

Reguläre Auditdaten enthalten keine Passwörter, MFA-Codes, Token, Cookies oder Sessionwerte. Die TCP-Audit-Redaktion ist verpflichtend.

## 3. Gemeinsame HTTP-Regeln

### 3.1 Transport, Ursprung und Serialisierung

- Requests und Responses verwenden JSON; TCC sendet `Accept: application/json`.
- Die lokale Compose-Topologie nutzt den same-origin-Pfad `/tcp`, den der Vite-Dev-Proxy an TCP weiterleitet. Dadurch bleiben Cookies und CSRF im Browserkontext.
- Die endgültige Staging-Origin-, HTTPS-, `Secure`-, `SameSite`- und CORS-Policy ist offen und wird nicht durch den lokalen Vertrag vorweggenommen.
- Responses enthalten `X-Correlation-Id`. Erfolgsresponses enthalten zusätzlich `correlation_id` im JSON-Body.
- TCP akzeptiert ausschließlich syntaktisch gültige eingehende UUIDs in `X-Correlation-Id`; andernfalls wird eine neue Korrelation erzeugt und zurückgegeben.

### 3.2 CSRF und Session

- Alle Endpunkte liegen in der Laravel-`web`-Middlewaregruppe und verwenden die serverseitige Web-Session.
- Vor jedem schreibenden Request muss TCC `GET /csrf` aufrufen und den zurückgegebenen Wert als `X-CSRF-TOKEN` mitsenden.
- Ohne gültigen CSRF-Kontext wird die Mutation von Laravel verweigert. TCC darf diesen Fehler nicht durch eine lokale Zustandsannahme übergehen.
- Erfolgreicher Passwort- oder MFA-Login regeneriert die Session. Logout invalidiert die Session und regeneriert den CSRF-Token.
- `/session` ist ausschließlich eine Statusabfrage; er erteilt keine Berechtigung für künftige fachliche Commands.

### 3.3 Fehlernormalisierung

Validierungs-, Authentisierungs- und MFA-Fehler werden als Laravel-JSON-Validierungsfehler (`422`) zurückgegeben. TCC darf keine Kontoexistenz, Aktivstatus, Challenge-ID, Ablaufzeit, Versuchszähler oder Versanddetails ableiten oder anzeigen.

Beispiel einer neutralen Fehlerform:

```json
{
  "message": "The given data was invalid.",
  "errors": {
    "email": [
      "Die Anmeldedaten sind ungültig oder das Konto ist nicht aktiv."
    ]
  }
}
```

```json
{
  "message": "The given data was invalid.",
  "errors": {
    "code": [
      "Der Sicherheitscode ist ungültig, abgelaufen oder wurde zu oft eingegeben."
    ]
  }
}
```

Laravel kann zusätzliche Standardfelder liefern; Clients dürfen nur `message` und die feldbezogenen Meldungen als Anzeigehinweis verwenden.

### 3.4 Rate Limits und Caching

| Endpunkt | Limit | Cache / Idempotenz |
| --- | --- | --- |
| `POST /login` | 5 Requests pro Minute je Laravel-Throttle-Key | nicht idempotent; niemals cachen |
| `POST /mfa/verify` | 10 Requests pro Minute je Laravel-Throttle-Key | nicht idempotent; niemals cachen |
| `GET /csrf`, `GET /session`, `POST /logout` | kein zusätzlicher routenspezifischer Limitwert im aktuellen W1L-Umfang | nie als fachliche Query cachen; Logout ist für eine vorhandene Session wiederholbar und endet im abgemeldeten Zustand |

Ein Limitüberschreiten liefert Laravels kontrollierte `429`-Antwort; TCC zeigt nur einen neutralen Wartehinweis.

## 4. Endpunkte

### 4.1 `GET /api/v1/auth/csrf`

Liest oder initialisiert den Sessionkontext und liefert den CSRF-Token.

**Authentisierung:** keine vorausgehende Benutzeranmeldung erforderlich.  
**CSRF:** nicht erforderlich.  
**Request:** kein Body.

**Erfolg `200`:**

```json
{
  "csrf_token": "opaque-csrf-token",
  "correlation_id": "00000000-0000-4000-8000-000000000000"
}
```

`csrf_token` ist undurchsichtig und nur für denselben Browser-Sessionkontext verwendbar.

### 4.2 `GET /api/v1/auth/session`

Liefert den aktuellen serverseitigen Anmeldestatus.

**Authentisierung:** keine vorausgehende Benutzeranmeldung erforderlich.  
**CSRF:** nicht erforderlich.  
**Request:** kein Body.

**Gast, Erfolg `200`:**

```json
{
  "authenticated": false,
  "user": null,
  "correlation_id": "00000000-0000-4000-8000-000000000000"
}
```

**Angemeldet, Erfolg `200`:**

```json
{
  "authenticated": true,
  "user": {
    "email": "admin@example.test",
    "role": "platform-admin"
  },
  "correlation_id": "00000000-0000-4000-8000-000000000000"
}
```

Die Rolle ist im aktuellen W1L-Umfang reine Darstellung des serverseitigen Session-Nutzers. Sie autorisiert keine noch nicht implementierten Fachcommands.

### 4.3 `POST /api/v1/auth/login`

Prüft E-Mail-Adresse, Passwort und Aktivstatus. Bei deaktivierter E-Mail-MFA entsteht direkt eine authentisierte Session; bei aktivierter E-Mail-MFA entsteht ausschließlich ein serverseitig gebundener Pending-Challenge-Zustand.

**Authentisierung:** keine vorausgehende Benutzeranmeldung erforderlich.  
**CSRF:** gültiges `X-CSRF-TOKEN` zwingend.  
**Rate Limit:** 5 Requests/Minute.

**Request:**

```json
{
  "email": "admin@example.test",
  "password": "browser-only-input"
}
```

| Feld | Regel |
| --- | --- |
| `email` | Pflicht; RFC-/DNS-E-Mailformat; maximal 191 Zeichen; serverseitig kleingeschrieben abgeglichen |
| `password` | Pflicht; String; maximal 1024 Zeichen; nur für den Request verwenden |

**Direkter Erfolg bei `TCP_EMAIL_MFA_ENABLED=false`, `200`:**

```json
{
  "status": "authenticated",
  "correlation_id": "00000000-0000-4000-8000-000000000000"
}
```

TCC liest anschließend `/session`, um E-Mail und Rolle aus dem autoritativen Sessionzustand zu erhalten.

**Erfolg bei `TCP_EMAIL_MFA_ENABLED=true`, `200`:**

```json
{
  "status": "mfa_required",
  "correlation_id": "00000000-0000-4000-8000-000000000000"
}
```

TCP erzeugt dann serverseitig genau eine aktuelle Challenge je Nutzer: Der zufällige sechsstellige Code wird nur gehasht persistiert, Vorgängerchallenges werden verbraucht markiert und die Session enthält ausschließlich interne Pending-Referenzen. Die E-Mail enthält den Code, aber weder Response noch TCC-State enthalten Code, Hash, Challenge-ID, Ablaufzeit oder Versuchszähler.

**Ablehnung `422`:** neutrale Fehlermeldung am Feld `email`; keine Unterscheidung zwischen unbekanntem, inaktivem oder passwortfalschem Konto.

### 4.4 `POST /api/v1/auth/mfa/verify`

Bestätigt die aktuelle, an dieselbe Web-Session gebundene E-Mail-MFA-Challenge.

**Authentisierung:** nur ein durch `/login` erzeugter Pending-MFA-Kontext.  
**CSRF:** gültiges `X-CSRF-TOKEN` zwingend.  
**Rate Limit:** 10 Requests/Minute.

**Request:**

```json
{
  "code": "123456"
}
```

| Feld | Regel |
| --- | --- |
| `code` | Pflicht; exakt sechs Dezimalziffern |

TCP verweigert neutral, wenn keine Challenge vorliegt, sie abgelaufen oder verbraucht ist, der Nutzer inaktiv wurde, die maximale Zahl serverseitiger Fehlversuche erreicht ist oder der Code nicht passt. Ein falscher Code erhöht nur serverseitig den Versuchszähler und erzeugt ein redigiertes Auditereignis. Bei Erfolg wird die Challenge innerhalb einer DB-Transaktion verbraucht, die Web-Session authentisiert und regeneriert sowie der MFA-Erfolg auditiert.

**Erfolg `200`:**

```json
{
  "status": "authenticated",
  "user": {
    "email": "admin@example.test",
    "role": "platform-admin"
  },
  "correlation_id": "00000000-0000-4000-8000-000000000000"
}
```

**Ablehnung `422`:** neutrale Fehlermeldung am Feld `code`.

### 4.5 `POST /api/v1/auth/logout`

Meldet die aktuelle Web-Session ab.

**Authentisierung:** Gastaufruf ist zulässig; ein eingeloggter Nutzer wird serverseitig abgemeldet.  
**CSRF:** gültiges `X-CSRF-TOKEN` zwingend.  
**Request:** kein Body.

**Erfolg `200`:**

```json
{
  "status": "logged_out",
  "correlation_id": "00000000-0000-4000-8000-000000000000"
}
```

Bei vorhandenem authentisierten Nutzer wird ein Auditereignis geschrieben. TCC verwirft anschließend ausschließlich seinen flüchtigen UI-Zustand und kann optional einen neuen CSRF-Token abrufen.

## 5. Audit, Autorisierung und Betriebsgrenzen

| Vorgang | Serverseitige Wirkung |
| --- | --- |
| ungültiger Passwortschritt | Audit `authentication.login.rejected` mit gehashtem E-Mail-Objektbezug |
| Passwortlogin ohne MFA | Audit `authentication.login.password_only`; Session-Regeneration |
| MFA-Challenge ausgestellt | Audit `authentication.mfa.challenge_issued` |
| falscher MFA-Code | Audit `authentication.mfa.verification_rejected`; kein Login |
| MFA erfolgreich | Audit `authentication.mfa.verified`; Session-Regeneration |
| Logout eines angemeldeten Nutzers | Audit `authentication.logout`; Session-Invalidierung |

Dieser Vertrag definiert noch keine Rollenmatrix. Jede zukünftige fachliche Mutation benötigt zusätzlich serverseitige AuthZ-Policy, Rollenprüfung, Re-Authentisierungsregel, Audit, Contract-Erweiterung und negative Tests. Ein Browser darf weder Rollen noch Objektbezüge als Berechtigung bestimmen.

Lokale Mailauslieferung kann mit `MAIL_MAILER=log` erfolgen. Staging/Produktion erfordern ausdrücklich aktivierte MFA sowie einen serverseitig konfigurierten Mailtransport. Das SMTP-Passwort bleibt ein Deployment-Secret und wird nicht Bestandteil dieses Contracts.

## 6. Testreferenzen und Nachweisgrenzen

| Bereich | Referenzen |
| --- | --- |
| TCP-Feature-/MySQL-Tests | `apps/tag-control-plane/tests/Feature/AuthenticationFlowTest.php`; `CP-TC-AUTH-001` bis `CP-TC-AUTH-005` |
| TCP-Audit-/Leak-Tests | `apps/tag-control-plane/tests/Unit/AuditSanitizerTest.php`; `apps/tag-control-plane/tests/Feature/AuditServiceMySqlTest.php`; `CP-TC-AUDIT-001` bis `CP-TC-AUDIT-002` |
| TCC-Contract-/UI-Nachweis | `CC-TC-AUTH-001` bis `CC-TC-AUTH-006`; `apps/tag-control-center/src/App.tsx`; `npm run build:tcc` |
| Lokale Integration | `npm run local:test`; same-origin TCC-Proxy und direkter Login-Smoke-Test gegen die Compose-Topologie |
| Offene Staging-Nachweise | Mailtransport, HTTPS-/Cookie-/CORS-Policy, Ziel-MFA, Recovery, Passkey/TOTP, RBAC, Re-Authentisierung und Session-Widerruf |

Der lokale Nachweis begründet den Status `implemented-local`, nicht `verified`. Er enthält keine realen Mail-, Dogado-, Cloudflare- oder Produktionsnachweise.
