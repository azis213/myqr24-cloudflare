[CmdletBinding()]
param(
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$edgeRouterPath = Join-Path $repositoryRoot 'apps\edge-router'
$codecConfigPath = Join-Path $edgeRouterPath 'wrangler.codec.toml'
$expectedWorkerName = 'myqr24-tag-codec-staging'
$expectedCustomDomain = 'internal.s.myqr24.com'
$expectedCodecRoute = 'internal.s.myqr24.com/api/v1/codec/*'

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw 'npm wurde nicht gefunden. Bitte Node.js installieren und sicherstellen, dass npm in PATH verfügbar ist.'
}

if (-not (Test-Path -LiteralPath $codecConfigPath -PathType Leaf)) {
    throw "Die Codec-Worker-Konfiguration fehlt: $codecConfigPath"
}

$codecConfig = Get-Content -LiteralPath $codecConfigPath -Raw
if ($codecConfig -notmatch '(?m)^\[env\.staging\]\s*$' -or
    $codecConfig -notmatch '(?m)^name\s*=\s*"myqr24-tag-codec-staging"\s*$' -or
    $codecConfig -notmatch '(?m)pattern\s*=\s*"internal\.s\.myqr24\.com"\s*,\s*custom_domain\s*=\s*true\s*,\s*enabled\s*=\s*true\s*,\s*previews_enabled\s*=\s*true' -or
    $codecConfig -notmatch '(?m)pattern\s*=\s*"internal\.s\.myqr24\.com/api/v1/codec/\*"\s*,\s*zone_name\s*=\s*"myqr24\.com"' -or
    $codecConfig -notmatch '(?ms)\[env\.staging\.observability\.logs\]\s*enabled\s*=\s*true' -or
    $codecConfig -notmatch '(?ms)\[env\.staging\.observability\.issues\]\s*enabled\s*=\s*true') {
    throw 'Die Codec-Wrangler-Konfiguration entspricht nicht den verifizierten Remote-Routen und Observability-Einstellungen.'
}

$npxExecutable = Get-Command npx.cmd -CommandType Application -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty Source
if (-not $npxExecutable) {
    throw 'Die echte npx.cmd-Anwendung wurde nicht gefunden.'
}

$codecHost = 'internal.s.myqr24.com'
try {
    $hostRecords = Resolve-DnsName -Name $codecHost -Type A -ErrorAction Stop |
        Where-Object Type -eq 'A'
}
catch {
    throw "Der proxied DNS-Record für $codecHost fehlt oder ist nicht auflösbar. Lege ihn in der Cloudflare-Zone an, bevor du deployest."
}

if (-not $hostRecords) {
    throw "Für $codecHost wurde kein A-Record gefunden. Lege einen proxied DNS-Record in Cloudflare an, bevor du deployest."
}

Write-Host ''
Write-Host 'Staging-Codec-Worker wird gebaut und nach Cloudflare deployt ...' -ForegroundColor Cyan
Write-Host "Worker: $expectedWorkerName" -ForegroundColor Green
Write-Host "Custom Domain: https://$codecHost (enabled; previews enabled)" -ForegroundColor Green
Write-Host "Codec route: https://$codecHost/api/v1/codec/*" -ForegroundColor Green
Write-Host ''

Push-Location $edgeRouterPath
try {
    & $npxExecutable wrangler deploy --dry-run --config wrangler.codec.toml --env staging --strict
    if ($LASTEXITCODE -ne 0) {
        throw "Der Codec-Worker-Staging-Build ist fehlgeschlagen (Exit-Code $LASTEXITCODE)."
    }

    if ($DryRun) {
        Write-Host 'Dry-Run abgeschlossen; es wurde nichts deployt.' -ForegroundColor Cyan
        return
    }

    & $npxExecutable wrangler deploy --config wrangler.codec.toml --env staging --strict
    if ($LASTEXITCODE -ne 0) {
        throw "Der Codec-Worker konnte nicht nach Staging deployt werden (Exit-Code $LASTEXITCODE)."
    }
}
finally {
    Pop-Location
}
