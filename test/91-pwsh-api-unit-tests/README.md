# PowerShell API-Tests mit Pester

Diese Tests bilden die beiden Collections aus `test/90-postman` als einzeln
startbare Pester-Tests nach. Für „Run Test“/„Debug Test“ oberhalb einzelner
`It`-Fälle werden Pester 5 oder neuer und die Microsoft-PowerShell-Erweiterung
für VS Code benötigt. Die Testdateien heißen `*.Tests.ps1` und laden ihre
lokale Environment selbst. PowerShell 7 wird verwendet. REST-Aufrufe laufen
standardmäßig über das echte `curl.exe`;
alternativ steht `Invoke-WebRequest` als Transport zur Verfügung.

## Voraussetzungen und Environment

- PowerShell 7 (`pwsh`), Pester 5+ (`Install-Module Pester -MinimumVersion 5.0.0 -Scope CurrentUser -Force`)
  und `curl.exe`.
- Die Microsoft-Erweiterung **PowerShell** muss in VS Code installiert sein.
  Die API-Tests deklarieren Pester 5 per `#Requires`; mit der im Repository
  ursprünglich gefundenen Pester-Version 3.4 wird Pester 6 automatisch
  verwendet, sobald es im CurrentUser-Scope installiert ist. `.vscode/settings.json`
  wählt PowerShell 7 als Erweiterungs-Host, da dort Pester 6 installiert ist.
  Nach Änderung der Host-Version in VS Code `PowerShell: Restart Session`
  ausführen (oder VS Code neu laden).
- Der gemeinsame Loader liest `apps/tag-app/.dev.vars` und
  `apps/edge-router/.dev.vars` ein. Für die Tag-App werden automatisch
  `APP_LOCAL_SEED_KEY`, `APP_BOOTSTRAP_SECRET_S01`,
  `APP_CONTENT_PUBLISH_KEY_S01` und `TAG_CONTENT_API_KEY_S01` verwendet; der
  Codec-Bearer-Token kommt aus `TAG_CODEC_API_KEY_S01` in
  `apps/edge-router/.dev.vars`. Weitere lokale Parameter können dort als
  `MYQR_TAG_APP_API_BASE_URL`, `MYQR_CODEC_BASE_URL`, `MYQR_TAG_ID`,
  `MYQR_TAG_NUMERIC_ID`, `MYQR_TAG_ELEMENT_ID`, `MYQR_TAG_ACCESS_VERSION` und
  `MYQR_TAG_CONTENT_REVISION` gesetzt werden. Sie überschreiben die Defaults.
  Die API-URL und TAG-Parameter kommen ansonsten aus dem jeweiligen
  Environment-JSON.
- `apps/tag-app/.dev.vars.example` listet `APP_CONTENT_PUBLISH_KEY_S01`, aber
  falls diese Variable in der echten `.dev.vars` fehlt, kann der Publisher-Test
  nicht authentifizieren. Ergänze den Secret dort selbst; der Loader zeigt
  Secret-Werte nie an.
- Lokale Tests sind auf Loopback beschränkt. TAG-Content-Local führt
  `/api/local/seed` aus und setzt lokale Testdaten neu.
- Staging-Environments liegen in `environments/*-staging.json`. TAG-Content-
  Staging nutzt den Staging-Worker-Endpunkt und überspringt den lokalen Seed;
  setze dafür vorab eine gültige Staging-`tagId` und `tagNumericId`. Publisher-
  und Upload-Tests verändern echte Staging-Daten. Remote-Läufe sind deshalb
  nur explizit über `-AllowNonLocal` oder die entsprechend bezeichneten
  VS-Code-Launch-Konfigurationen aktiviert. Codec-Staging nutzt
  `https://internal.s.myqr24.com`.

Die Staging-Tag-App-URL `myqr24-tag-app-api-staging.azis213.workers.dev` ist
aus dem Wrangler-Worker-Namen und dem im Repository dokumentierten Cloudflare-
Account-Host abgeleitet; sie ist nicht als eigener Custom-Domain-Endpunkt in
der Wrangler-Konfiguration eingetragen. Bei abweichender Workers-URL setze
`MYQR_TAG_APP_API_BASE_URL` in `.dev.vars` oder passe das Staging-JSON an.
Werte in `.dev.vars.example` sind ausdrücklich synthetische Local-Defaults.
Sie sind nicht automatisch gültige Staging-Credentials; nur echte, für
Staging autorisierte Schlüssel verwenden.

Die Environment-Dateien sind JSON und werden nicht aus Postman synchronisiert.
Secrets werden aus den lokal ignorierten `.dev.vars` geladen; sie gehören nicht
in die versionierten Environment-JSON-Dateien. Optionale `*.local.json`-Dateien
können nicht geheime Environment-Werte überschreiben.

## Aufruf

Im Repository-Root:

```powershell
pwsh -NoProfile -File test/91-pwsh-api-unit-tests/Invoke-ApiUnitTests.ps1 -Collection edge-router-local
pwsh -NoProfile -File test/91-pwsh-api-unit-tests/Invoke-ApiUnitTests.ps1 -Collection tag-content-local
```

Staging nur bewusst und explizit starten:

```powershell
pwsh -NoProfile -File test/91-pwsh-api-unit-tests/Invoke-ApiUnitTests.ps1 -Collection edge-router-staging -AllowNonLocal
pwsh -NoProfile -File test/91-pwsh-api-unit-tests/Invoke-ApiUnitTests.ps1 -Collection tag-content-staging -AllowNonLocal
```

Für einen direkten VS-Code-**Run Test** in Staging zuerst im PowerShell-
Extension-Terminal die Umgebung auswählen und Remote-Aufrufe freigeben:

```powershell
$env:MYQR_API_TEST_ENVIRONMENT = (Resolve-Path 'test/91-pwsh-api-unit-tests/environments/tag-content-staging.json').Path
$env:MYQR_API_ALLOW_NONLOCAL = '1'
```

Für Edge Router entsprechend `edge-router-staging.json` verwenden. Danach
einzelne `It`-Tests über **Run Tests**/ **Debug Tests** ausführen.

In VS Code erscheint **Run Tests** über den `Describe`- und `It`-Blöcken.
Für genau einen Fall den Link direkt über dem gewünschten `It`-Block anklicken;
zum Debuggen entsprechend **Debug Tests**. Die Tests laden
`environments/*.json` selbst, deshalb ist der Sammel-Runner dafür nicht nötig.
Wenn die Links fehlen: Pester 5+ installieren, PowerShell-Terminal neu starten
und `powershell.pester.codeLens` in `.vscode/settings.json` aktiviert lassen.
Der PowerShell-Test-CodeLens startet intern einen temporären Debug-Launch. Der
Eintrag **PowerShell: Launch Pester Tests** kann deshalb kurz im Debug-Bereich
erscheinen; das ist kein Grund, `launch.json` manuell zu öffnen oder zu ändern.

Für die ganze Collection gibt es in **Run and Debug** weiterhin `Pester: Edge Router local` und `Pester: TAG Content local` (F5).

### Lokaler TAG-Content-Viewer (manuell)

`viewers/TagContent-Viewer.Tests.ps1` liegt absichtlich außerhalb der normalen
Collections und wird nicht automatisch mit den API-Tests ausgeführt. Die
lesenden Viewer-Tests zeigen alle Spalten und Werte der lokalen D1-Tabellen
sowie alle lokalen R2-Objektschlüssel und Metadaten. Docker Compose mit dem
`tag-app-api`-Service muss laufen. Die R2-Daten werden lokal und read-only aus
Miniflare-Metadaten gelesen; Text/JSON wird in der Testkonsole angezeigt.
Ein ausgewähltes R2-Objekt wird zusätzlich unter
`apps/tag-app/.wrangler/viewer-exports` exportiert (Binärdateien lassen sich
nicht sinnvoll in der Konsole darstellen).

Im Repository-Root:

```powershell
# Alle lokalen D1-Tabellen und die R2-Dateiliste anzeigen
pwsh -NoProfile -Command "Invoke-Pester -Path 'test/91-pwsh-api-unit-tests/viewers/TagContent-Viewer.Tests.ps1' -Output Detailed"

# Ein bestimmtes R2-Objekt ausgeben/exportieren (Schlüssel vorher aus der Liste kopieren)
$env:MYQR_TAG_CONTENT_VIEWER_R2_KEY = 'content/v1/tags/<tagNumericId>/items/<contentId>/<filename>'
pwsh -NoProfile -Command "Invoke-Pester -Path 'test/91-pwsh-api-unit-tests/viewers/TagContent-Viewer.Tests.ps1' -FullNameFilter '*ausgewähltes R2-Objekt*' -Output Detailed"
Remove-Item Env:\MYQR_TAG_CONTENT_VIEWER_R2_KEY
```

Der Viewer verwendet ausschließlich den lokalen Docker-Container und lokale
Miniflare-Persistenz; er ruft keine Remote-D1- oder R2-Ressourcen auf und ändert
keine Daten.

### TAG-Content manuell veröffentlichen

`active/TagContent-Publish.Tests.ps1` ist ein separater, schreibender Manuallauf
und liegt außerhalb der normalen Collections. Im Kopf der Datei können
Environment (`tag-content-local` oder `tag-content-staging`), optionale
TAG-ID-/Numeric-ID-Overrides, ein Template-Pfad, ein TAG-Name und optional eine
erwartete Revision gesetzt werden. Ohne Template-Pfad fragt der Test beim Start
nach einem Pfad; Enter verwendet `publishTemplate` aus dem Environment-JSON.
Relative Template-Pfade beziehen sich auf das Repository-Root. Die Datei muss
ein vollständiges `myqr24-tag-content-template-v1`-JSON mit
`schemaVersion: 3` enthalten.

Der Test zeigt vor dem Aufruf Ziel und Template an und sendet den vollständigen
PUT nur, wenn exakt `PUBLISH <tagId>` bestätigt wird. Der Publisher-Key wird
aus `apps/tag-app/.dev.vars` gelesen und nie ausgegeben. Der PUT ersetzt den
veröffentlichten Stand vollständig; im lokalen Environment wird außerdem der
TAG-Zustand geändert. Staging verlangt zusätzlich die bewusste Freigabe
`$env:MYQR_API_ALLOW_NONLOCAL = '1'` und gültige TAG-IDs.

Im Repository-Root manuell starten:

```powershell
pwsh -NoProfile -Command "Import-Module Pester -MinimumVersion 5.0.0; Invoke-Pester -Path 'test/91-pwsh-api-unit-tests/active/TagContent-Publish.Tests.ps1' -Output Detailed"
```

Vor dem Lauf `active/TagContent-Publish.Tests.ps1` öffnen und die Variablen im
Dateikopf prüfen. Die Vorlage lässt sich bei der Nachfrage als absoluter oder
relativer Dateipfad angeben; bei Enter wird das Environment-Standardtemplate
verwendet. Bei Abbruch oder einer anderen Bestätigung wird kein Request gesendet.

Optional lässt sich ein `Describe`-Block über den Runner auswählen:

```powershell
pwsh -NoProfile -File test/91-pwsh-api-unit-tests/Invoke-ApiUnitTests.ps1 -Collection edge-router-local -TestName 'Edge Router – Encode'
pwsh -NoProfile -File test/91-pwsh-api-unit-tests/Invoke-ApiUnitTests.ps1 -Collection tag-content-local -TestName 'TAG Content – Publish test template'
```

PowerShell-Transport statt `curl.exe`:

```powershell
pwsh -NoProfile -File test/91-pwsh-api-unit-tests/Invoke-ApiUnitTests.ps1 -Collection tag-content-local -Transport PowerShell
```

`-AllowNonLocal` hebt die Loopback-Sperre explizit auf und sollte nur für
bewusst freigegebene Testumgebungen benutzt werden. Publisher-/Seed-Tests
verändern den TAG-Zustand.

## REST-Client direkt verwenden

```powershell
Import-Module ./test/91-pwsh-api-unit-tests/lib/ApiClient.psm1 -Force
$response = Invoke-ApiRequest -Method POST `
  -Uri 'http://127.0.0.1:8787/api/v1/example' `
  -Headers @{ Authorization = 'Bearer local-token' } `
  -Body @{ example = $true } `
  -Transport Curl

# Multipart-Datei (curl.exe erzeugt den passenden Boundary-Header selbst)
$upload = Invoke-ApiRequest -Method POST `
  -Uri 'http://127.0.0.1:8787/api/v1/upload' `
  -Headers @{ Authorization = 'Bearer local-token' } `
  -Files @{ original = './image.png' }
```

Die einheitliche Antwort enthält `StatusCode`, `Headers`, geparstes JSON in
`Body` (falls vorhanden) und unveränderten Text in `RawBody`.
