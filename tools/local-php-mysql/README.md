# Lokale PHP-/MySQL-Testtopologie

**Status:** W0-Testartefakt, keine Control-Plane-Anwendung  
**Geltungsbereich:** reproduzierbare lokale MySQL-Integrationstests für zukünftige PHP-Anwendungen, insbesondere die TAG Control Plane  
**Nicht zulässig:** Staging-/Produktionszugänge, echte Cloudflare- oder Dogado-Secrets, externe Publisher-Aufrufe, Produktionsdaten oder eine vorgezogene Anwendung unter `apps/tag-control-plane`.

## Zweck

Diese Docker-Compose-Topologie liefert eine lokale, isolierte MySQL-8.4-Umgebung und einen generischen PHP-8.4-CLI-Container mit Composer und `pdo_mysql`.

Sie ist ein W0-Artefakt zur Prüfung der lokalen Toolchain. Sie implementiert weder eine PHP-Anwendung noch Migrationen, APIs, Geschäftslogik oder Cloudflare-Integration.

```text
zukünftige PHP-Anwendung oder Test-Runner
                 │
                 │ internes Compose-Netz
                 ▼
        MySQL 8.4 (lokales Docker-Volume)
```

MySQL besitzt bewusst keinen Host-Port. PHP-Container erreichen die Datenbank nur über den Compose-DNS-Namen `mysql` und das interne Docker-Netz.

## Voraussetzungen

- Docker Engine und Docker Compose Plugin;
- eine lokale, synthetische Konfigurationsdatei `.env.local`;
- keine laufende Anwendung und keine externen Secrets erforderlich.

Für die verifizierte lokale Toolchain gelten Docker Engine `29.8.0` und Docker Compose `5.5.1`. Andere kompatible Docker-Versionen können verwendet werden, müssen aber vor einem Iterationsnachweis dokumentiert werden.

## Lokale Konfiguration

Erstelle aus dem Beispiel eine ausschließlich lokale Datei:

```powershell
Copy-Item tools\local-php-mysql\.env.example tools\local-php-mysql\.env.local
```

`tools/local-php-mysql/.env.local` bleibt durch die Repository-Ignore-Regeln unversioniert. Alle vier Werte müssen synthetische lokale Werte sein und dürfen weder Staging- noch Produktionswerte wiederverwenden.

## Befehle

Die folgenden PowerShell-Befehle werden aus dem Repository-Root ausgeführt.

### 1. MySQL starten

```powershell
docker compose --env-file tools/local-php-mysql/.env.local -f tools/local-php-mysql/compose.yaml up -d mysql
```

Status und Healthcheck prüfen:

```powershell
docker compose --env-file tools/local-php-mysql/.env.local -f tools/local-php-mysql/compose.yaml ps
```

### 2. Lokale Datenbanktopologie prüfen

Der Verifikationstest baut bei Bedarf das PHP-Image, erstellt ausschließlich die temporäre Tabelle `w0_local_mysql_verification`, prüft Verbindung, `utf8mb4`, UTC, Commit und Rollback und entfernt die Tabelle am Ende wieder:

```powershell
docker compose --env-file tools/local-php-mysql/.env.local -f tools/local-php-mysql/compose.yaml --profile verify run --rm php /workspace/scripts/verify-mysql.php
```

### 3. Umgebung anhalten

```powershell
docker compose --env-file tools/local-php-mysql/.env.local -f tools/local-php-mysql/compose.yaml down
```

Dies entfernt Container und Netzwerk, behält aber die rein lokale benannte Datenbank-Volume bei.

### 4. Destruktiver lokaler Reset

> **Achtung:** Der folgende Befehl entfernt ausschließlich die Volume dieser lokalen Compose-Topologie. Trotzdem löscht er alle darin enthaltenen lokalen Daten endgültig.

```powershell
docker compose --env-file tools/local-php-mysql/.env.local -f tools/local-php-mysql/compose.yaml down -v
```

Der Reset darf niemals als Staging- oder Production-Betriebsprozedur verwendet werden.

## Verbindliche Testkonvention für spätere PHP-Anwendungen

| Testebene | Datenbank / Abhängigkeiten | Ausführungsregel |
| --- | --- | --- |
| Unit | keine Datenbank, keine Netzwerk- oder Dateisystemabhängigkeit | pro Commit lokal und in CI |
| Service | In-Memory-Fakes nur für nicht-persistente Ports | pro Commit; keine Behauptung über MySQL-Locking |
| MySQL-Integration | ausschließlich diese Compose-MySQL-Instanz; separate Testdatenbank bzw. frischer Schema-Reset | Migrationen vor dem Lauf; Tests dürfen nur synthetische Daten verwenden |
| Contract | lokale Contract-Fixtures und Fake-Adapter | Edge-, Control-Center- und TAG-App-Verträge ohne Staging-Zugriff prüfen |
| Security / Negativ | lokale MySQL-Instanz, Fake-Cloudflare-Adapter, synthetische Secrets | AuthZ-, CSRF-, Injection-, Leak-, Retry- und Rollback-Fälle zwingend abdecken |
| Local Smoke | lokale PHP-Laufzeit und diese MySQL-Instanz | Health/Readiness plus eine synthetische, bereinigte Transaktion |
| Staging / Betrieb | ausschließlich bestätigte externe Ressourcen | separat; lokale grüne Tests ersetzen keinen Staging- oder Dogado-Nachweis |

### Anforderungen an die spätere App-Integration

1. Die Anwendung erhält nur per lokaler, ignorierter Konfiguration Zugangsdaten; `.env.example` enthält ausschließlich Platzhalter.
2. Integrationstests müssen eine eindeutig als Testdatenbank markierte Datenbank verwenden. Sie dürfen weder den lokalen manuellen Entwicklungsbestand noch externe Datenbanken zurücksetzen.
3. Jede Migration wird auf leerer Datenbank, auf Vorversion und zusammen mit einem dokumentierten Restore-Szenario getestet.
4. Parallelitäts- und Sperrtests verwenden mehrere unabhängige PDO-Verbindungen gegen MySQL, nicht SQLite oder In-Memory-Doubles.
5. Cloudflare-, Dogado- und weitere externe Ports werden in Unit-, Service-, Integrations- und Contract-Tests gefakt. Reale Tokens sind dort unzulässig.
6. Logs, Testreports und Evidenz dürfen keine Passwörter, DSNs mit Credentials, Sessionwerte, Tokens, Claim-Credentials, Ownerdaten oder private Inhalte enthalten.
7. Ein erfolgreiches lokales Ergebnis kann einen `implemented`-Nachweis stützen, aber niemals `verified`, ein Dogado-Kompatibilitätsurteil oder Staging-Evidenz ersetzen.

## Spätere App-Befehle

Nach W0-Freigabe wird die künftige PHP-Anwendung ihre Befehle dokumentieren. Sie müssen mindestens folgende Kategorien abdecken:

```text
setup / dependency install
lint
static analysis
unit test
MySQL integration test
contract test
security / negative test
build or package verification
local smoke test
```

Die konkrete App wird als lokaler Read-only- oder Read-Write-Mount eingebunden, nicht in dieses generische W0-Testimage kopiert. So bleibt die Infrastruktur unabhängig von der späteren Anwendung und die Sperre vor einer vorzeitigen Control-Plane-Implementierung gewahrt.

## Externe Grenzen

Diese Testtopologie bestätigt nicht:

- die Dogado-PHP-, MySQL-, Composer-, Cron- oder Secret-Speicher-Fähigkeiten;
- DB-Backup, Restore, TLS und Berechtigungsmodell der Staging-Umgebung;
- Staging-DNS, API-Origin, CORS-, Rate-Limit- oder Cache-/Widerrufs-Policy;
- einen Cloudflare-Publisher-Token, Namespace oder echten Publish-/Unpublish-Lauf.

Diese Punkte verbleiben in W0 als getrennte Blocker und benötigen redigierte externe Nachweise.
