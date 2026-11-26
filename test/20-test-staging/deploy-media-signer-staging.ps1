[CmdletBinding()]
param(
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$tagAppPath = Join-Path $repositoryRoot 'apps\tag-app'
$workerConfigPath = Join-Path $tagAppPath 'wrangler.media-signer.toml'
$devVarsPath = Join-Path $tagAppPath '.dev.vars'
$secretHelperPath = Join-Path $PSScriptRoot 'Import-TagAppStagingSecrets.ps1'
$expectedWorkerName = 'myqr24-media-signer-staging'

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
    throw "Die Media-Signer-Worker-Konfiguration fehlt: $workerConfigPath"
}

$workerConfig = Get-Content -LiteralPath $workerConfigPath -Raw
if ($workerConfig -notmatch '(?m)^\[env\.staging\]\s*$' -or
    $workerConfig -notmatch '(?m)^name\s*=\s*"myqr24-media-signer-staging"\s*$') {
    throw 'Die Wrangler-Konfiguration entspricht nicht dem erwarteten Media-Signer-Staging-Worker.'
}
if ($workerConfig -match '(?m)^\s*routes\s*=') {
    throw 'Der Media-Signer darf keine öffentliche Route erhalten; Zugriff erfolgt ausschließlich über das Service Binding.'
}

Write-Host ''
Write-Host 'Media-Signer-Staging-Worker wird geprüft und deployt ...' -ForegroundColor Cyan
Write-Host "Worker: $expectedWorkerName" -ForegroundColor Green
Write-Host 'Konfiguration: apps/tag-app/wrangler.media-signer.toml · Environment: staging' -ForegroundColor Green
Write-Host 'APP_MEDIA_SIGNER_KEY_S01 wird aus apps/tag-app/.dev.vars importiert; der Wert wird nicht ausgegeben.' -ForegroundColor Yellow
Write-Host 'R2-Signing-Zugangsdaten sind in dieser Worker-Konfiguration nicht vorhanden; echte R2-Signierung bleibt deaktiviert.' -ForegroundColor Yellow
Write-Host ''

Push-Location $tagAppPath
try {
    & $npxExecutable wrangler whoami
    if ($LASTEXITCODE -ne 0) {
        throw "Wrangler-Anmeldung konnte nicht geprüft werden (Exit-Code $LASTEXITCODE)."
    }

    & $npxExecutable wrangler deploy --dry-run --config wrangler.media-signer.toml --env staging --strict
    if ($LASTEXITCODE -ne 0) {
        throw "Der Media-Signer-Staging-Dry-Run ist fehlgeschlagen (Exit-Code $LASTEXITCODE)."
    }

    if ($DryRun) {
        Write-Host 'Dry-Run abgeschlossen; es wurde nichts deployt.' -ForegroundColor Cyan
        return
    }

    Import-TagAppStagingSecrets -DevVarsPath $devVarsPath -ConfigPath 'wrangler.media-signer.toml' -SecretMap @{
        APP_MEDIA_SIGNER_KEY_S01 = 'APP_MEDIA_SIGNER_KEY_S01'
    }

    Write-Host 'Deploye ausschließlich den Staging-Media-Signer ...' -ForegroundColor Cyan
    & $npxExecutable wrangler deploy --config wrangler.media-signer.toml --env staging --strict
    if ($LASTEXITCODE -ne 0) {
        throw "Der Media-Signer konnte nicht nach Staging deployt werden (Exit-Code $LASTEXITCODE)."
    }

    Write-Host ''
    Write-Host 'Media-Signer-Staging-Worker erfolgreich deployt.' -ForegroundColor Green
    Write-Host 'Der Media-Signer-Code ist derzeit ein fail-closed Stub; das Secret aktiviert noch keine R2-Signierung.' -ForegroundColor Yellow
}
finally {
    Pop-Location
}