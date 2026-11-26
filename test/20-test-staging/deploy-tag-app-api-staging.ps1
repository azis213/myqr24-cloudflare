[CmdletBinding()]
param(
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$tagAppPath = Join-Path $repositoryRoot 'apps\tag-app'
$workerConfigPath = Join-Path $tagAppPath 'wrangler.app-api.toml'
$devVarsPath = Join-Path $tagAppPath '.dev.vars'
$secretHelperPath = Join-Path $PSScriptRoot 'Import-TagAppStagingSecrets.ps1'
$expectedWorkerName = 'myqr24-tag-app-api-staging'
$stagingHost = 'internal.s.myqr24.com'

if (-not (Test-Path -LiteralPath $secretHelperPath -PathType Leaf)) {
    throw "Der sichere Staging-Secret-Import-Helper fehlt: $secretHelperPath"
}
. $secretHelperPath

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw 'npm wurde nicht gefunden. Bitte Node.js installieren und sicherstellen, dass npm in PATH verfügbar ist.'
}
$npxExecutable = Get-Command npx.cmd -CommandType Application -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty Source
if (-not $npxExecutable) {
    throw 'Die echte npx.cmd-Anwendung wurde nicht gefunden.'
}

if (-not (Test-Path -LiteralPath $workerConfigPath -PathType Leaf)) {
    throw "Die TAG-App-API-Worker-Konfiguration fehlt: $workerConfigPath"
}

$workerConfig = Get-Content -LiteralPath $workerConfigPath -Raw
if ($workerConfig -notmatch '(?m)^\[env\.staging\]\s*$' -or
    $workerConfig -notmatch '(?m)^routes\s*=\s*\[\{\s*pattern\s*=\s*"internal\.s\.myqr24\.com/api/\*"\s*,\s*zone_name\s*=\s*"myqr24\.com"\s*\}\]\s*$' -or
    $workerConfig -notmatch '(?m)^name\s*=\s*"myqr24-tag-app-api-staging"\s*$' -or
    $workerConfig -notmatch '(?m)^TAG_TEST_ADMIN_ENVIRONMENT\s*=\s*"staging"\s*$') {
    throw 'Die Wrangler-Konfiguration entspricht nicht dem erwarteten TAG-App-Staging-Worker und Environment-Gate.'
}

try {
    $hostRecords = Resolve-DnsName -Name $stagingHost -Type A -ErrorAction Stop |
        Where-Object Type -eq 'A'
}
catch {
    throw "Der proxied DNS-Record für $stagingHost fehlt oder ist nicht auflösbar. Lege ihn in der Cloudflare-Zone an, bevor du deployest."
}
if (-not $hostRecords) {
    throw "Für $stagingHost wurde kein A-Record gefunden. Lege ihn in der Cloudflare-Zone an, bevor du deployest."
}

Write-Host ''
Write-Host 'TAG-App-API-Staging-Worker wird geprüft und deployt ...' -ForegroundColor Cyan
Write-Host "Worker: $expectedWorkerName" -ForegroundColor Green
Write-Host 'Konfiguration: apps/tag-app/wrangler.app-api.toml · Environment: staging' -ForegroundColor Green
Write-Host "Route: https://$stagingHost/api/* (Codec behält seine spezifischere Route)" -ForegroundColor Green
Write-Host 'Passende Worker-Secrets werden aus apps/tag-app/.dev.vars importiert; Werte werden nicht ausgegeben.' -ForegroundColor Yellow
Write-Host 'APP_LOCAL_SEED_KEY wird dem Staging-Namen TAG_TEST_ADMIN_KEY_S01 zugeordnet; Codec-Key bleibt ausgeschlossen.' -ForegroundColor Yellow
Write-Host 'Es wird kein Pages-Projekt und keine D1-Migration geändert.' -ForegroundColor Yellow
Write-Host ''

Push-Location $tagAppPath
try {
    & $npxExecutable wrangler whoami
    if ($LASTEXITCODE -ne 0) {
        throw "Wrangler-Anmeldung konnte nicht geprüft werden (Exit-Code $LASTEXITCODE)."
    }

    & $npxExecutable wrangler deploy --dry-run --config wrangler.app-api.toml --env staging --strict
    if ($LASTEXITCODE -ne 0) {
        throw "Der TAG-App-API-Staging-Dry-Run ist fehlgeschlagen (Exit-Code $LASTEXITCODE)."
    }

    if ($DryRun) {
        Write-Host 'Dry-Run abgeschlossen; es wurde nichts deployt.' -ForegroundColor Cyan
        return
    }

    Import-TagAppStagingSecrets -DevVarsPath $devVarsPath -ConfigPath 'wrangler.app-api.toml' -SecretMap @{
        APP_BOOTSTRAP_SECRET_S01     = 'APP_BOOTSTRAP_SECRET_S01'
        APP_PIN_PEPPER_S01           = 'APP_PIN_PEPPER_S01'
        APP_MEDIA_SIGNER_KEY_S01     = 'APP_MEDIA_SIGNER_KEY_S01'
        APP_CONTENT_PUBLISH_KEY_S01  = 'APP_CONTENT_PUBLISH_KEY_S01'
        TAG_CONTENT_API_KEY_S01      = 'TAG_CONTENT_API_KEY_S01'
        TAG_TEST_ADMIN_KEY_S01       = 'APP_LOCAL_SEED_KEY'
    }

    Write-Host 'Deploye ausschließlich den Staging-API-Worker ...' -ForegroundColor Cyan
    & $npxExecutable wrangler deploy --config wrangler.app-api.toml --env staging --strict
    if ($LASTEXITCODE -ne 0) {
        throw "Der TAG-App-API-Worker konnte nicht nach Staging deployt werden (Exit-Code $LASTEXITCODE)."
    }

    Write-Host ''
    Write-Host 'Staging-Worker erfolgreich deployt.' -ForegroundColor Green
    Write-Host 'Die Staging-Secrets wurden aus der freigegebenen Allowlist importiert; lokale Seed- und Codec-Bindings wurden nicht übertragen.' -ForegroundColor Yellow
}
finally {
    Pop-Location
}