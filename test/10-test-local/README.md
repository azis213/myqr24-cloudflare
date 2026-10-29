# Lokale manuelle Testumgebung

Diese Topologie stellt den derzeit implementierten Stand der **TAG Control Plane (TCP)**, des **TAG Control Centers (TCC)** und einer ausschließlich lokalen MySQL-8.4-Datenbank für manuelle Tests bereit.

## Aktueller Umfang

| Komponente | Lokale Adresse | Status |
| --- | --- | --- |
| TAG Control Plane | `http://localhost:8080/` | Laravel-Grundgerüst, Standardseite |
| TCP Health API | `http://localhost:8080/api/v1/health` | implementiert |
| MySQL 8.4 | nur internes Compose-Netz | implementiert |
| TCP-Testdatenbank `myqr24_test` | nur internes Compose-Netz | isolierter Laravel-/MySQL-Testpfad |
| TAG Control Center (TCC) | `http://localhost:5174/` | Vite-Dev-Server mit Login-, E-Mail-MFA-, Session- und Logout-UI |

MySQL wird bewusst **nicht** auf einen Host-Port veröffentlicht. Nur TCP kann sie über den Compose-DNS-Namen `mysql` erreichen.

## Voraussetzungen

- Docker Engine mit Docker Compose Plugin;
- PowerShell 7 oder Windows PowerShell;
- eine lokale Docker-Engine;
- ausschließlich synthetische lokale Zugangsdaten.

Es werden keine Cloudflare-, Dogado-, Staging- oder Produktionssecrets verwendet.

## Umgebung starten

Aus dem Repository-Root:

```powershell
.\test\10-test-local\scripts\start-local-test.ps1
```

Beim ersten Start wird `test/10-test-local/.env.local` aus `.env.example` erzeugt. Die Datei ist global ignoriert und darf nur lokale, synthetische Werte enthalten.

## Lokaler Bootstrap-Admin

TCP erstellt beim Start nach den Migrationen idempotent den konfigurierten Platform-Admin. Für die lokale Testumgebung lautet die E-Mail-Adresse:

```text
azis213@gmail.com
```

Das zugehörige Initialpasswort wird ausschließlich als
`TCP_BOOTSTRAP_ADMIN_INITIAL_PASSWORD` in der ignorierten Datei
`test/10-test-local/.env.local` gespeichert. Es darf weder in Git, noch in
Tests, Logs, Dokumentation oder Chatnachrichten kopiert werden. Ein vorhandenes
Konto wird bei späteren Starts nicht verändert. Ein Passwortreset ist nur durch
den expliziten, lokalen Command `php artisan tcp:bootstrap-platform-admin
--reset-password` möglich.

Die Anmeldung erfolgt über TCC unter `http://localhost:5174/`. Die lokale
Vorgabe `TCP_EMAIL_MFA_ENABLED=false` erlaubt den direkten Passwortlogin für
den Bootstrap-Admin, weil kein externer Mailtransport für lokale Tests benötigt
wird. Der lokale Default-Mailer `log` versendet keine E-Mails.

Für Staging und Produktion muss `TCP_EMAIL_MFA_ENABLED=true` gesetzt werden.
Dann wird Dogado SMTP über `web218.dogado.net:465` mit implizitem TLS
(`MAIL_SCHEME=smtps`) verwendet. Benutzername und Absender sind
`no-reply@myqr24.com`; `MAIL_PASSWORD` bleibt ausschließlich im
Deployment-Secret-Store beziehungsweise in der nicht versionierten Environment.
Ein SMTP-Passwort darf weder durch TCC gesetzt noch in Datenbank, Git,
Dokumentation, Tests oder Logs gespeichert werden.

Um das PHP-Image erneut zu bauen:

```powershell
.\test\10-test-local\scripts\start-local-test.ps1 -Rebuild
```

Der Startvorgang:

1. baut bei Bedarf das lokale PHP-8.4-Image mit Composer und `pdo_mysql`;
2. startet MySQL 8.4 in einem Compose-internen Netzwerk;
3. wartet auf den MySQL-Healthcheck;
4. führt TCP-Migrationen idempotent aus;
5. erstellt oder prüft den lokalen Bootstrap-Platform-Admin idempotent;
6. startet Laravel auf Port `8080`;
7. startet den TCC-Vite-Dev-Server auf Port `5174` und installiert dessen lokale Node-Abhängigkeiten beim ersten Lauf in ein benanntes Docker-Volume;
8. prüft TCP-Health und die TCC-Startseite.

Nach erfolgreichem Start:

```text
TCC:    http://localhost:5174/
TCP:    http://localhost:8080/
Health: http://localhost:8080/api/v1/health
```

Die Host-Ports können in `.env.local` über `LOCAL_TCP_PORT` und `LOCAL_TCC_PORT` geändert werden.

Der TCC-Container proxyed `/tcp/*` intern an `tag-control-plane:8000`. Browseranfragen bleiben dadurch gegen `http://localhost:5174` same-origin; Cookies und CSRF-Verhalten können ohne lokale CORS-Ausnahme manuell geprüft werden. Für den separaten Host-Vite-Betrieb bleibt das Proxyziel standardmäßig `http://localhost:8080`.

## Automatisierte TCP-/MySQL-Tests

Der folgende Befehl verwendet ausschließlich die getrennte synthetische Datenbank
`LOCAL_MYSQL_TEST_DATABASE` (Vorgabe: `myqr24_test`). Er stellt die Datenbank bei
bereits vorhandenem MySQL-Volume sicher, führt `migrate:fresh` **nur** gegen diese
Testdatenbank aus und startet anschließend die Laravel-/MySQL-Tests:

```powershell
npm run local:test
```

Der Lauf prüft derzeit die Audit-Persistenz mit Korrelations-ID, rekursive
Secret-/Credential-Redaktion, Transaktionsrollback bei einer fehlgeschlagenen
Mutation sowie die Health-Endpunkt-Korrelation. Die manuelle Datenbank
`LOCAL_MYSQL_DATABASE` wird dabei nicht zurückgesetzt.

## Umgebung anhalten

```powershell
.\test\10-test-local\scripts\stop-local-test.ps1
```

Der Befehl entfernt Container und Netzwerk, behält aber die benannten lokalen Volumes. Datenbankdaten bleiben damit für den nächsten manuellen Start erhalten.

## Lokale Daten vollständig zurücksetzen

> **Achtung:** Dieser Vorgang löscht alle Datenbank-, TCP-Storage- und TCC-Dependency-Volumes dieser lokalen Testtopologie endgültig.

```powershell
.\test\10-test-local\scripts\reset-local-test.ps1
```

Zur nicht-interaktiven Ausführung, etwa bei einem lokalen Testlauf:

```powershell
.\test\10-test-local\scripts\reset-local-test.ps1 -Force
```

## Logs und Status

```powershell
docker compose --env-file test/10-test-local/.env.local -f test/10-test-local/compose.yaml ps

docker compose --env-file test/10-test-local/.env.local -f test/10-test-local/compose.yaml logs --follow
```

## Abgrenzung zu automatisierten Tests und Staging

Diese Umgebung ist für manuelle Exploration, lokale Smoke-Tests und komplexe Tests mit synthetischen Daten geeignet, darunter:

- TCP-/MySQL-Migrationen, Transaktionen und Sperrverhalten;
- TCP↔TCC-API-Contracts über den lokalen same-origin `/tcp`-Proxy;
- AuthZ-, CSRF-, Audit- und negative Tests;
- Browser-Smoke-Tests gegen lokale Services;
- lokale Worker-/Edge-Adaptertests mit Fakes oder Emulation.

Die bestehende Topologie unter `tools/local-php-mysql/` bleibt separat. Sie ist ein schlanker, reproduzierbarer MySQL-Integrationstest-Runner und soll nicht auf manuelle Persistenz oder HTTP-Bedienung erweitert werden.

Ein Staging ist weiterhin erforderlich für Nachweise mit realen Betriebsabhängigkeiten:

- Cloudflare Worker, KV, Pages, DNS, TLS, CORS, Cache und Rate Limits;
- echte, least-privilege Publish-/Unpublish-Tokens;
- Dogado PHP-/MySQL-/Cron-/Queue-Kompatibilität;
- reale Deployment-, Backup-/Restore- und Observability-Nachweise;
- Staging-End-to-End-Abnahmen.

Lokale Tests validieren Implementierung und Verträge mit Fakes. Staging validiert die Integration mit bestätigten externen Ressourcen.
