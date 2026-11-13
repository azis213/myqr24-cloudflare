[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$edgeRouterPath = Join-Path $repositoryRoot 'apps\edge-router'
$codecConfigPath = Join-Path $edgeRouterPath 'wrangler.codec.toml'

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw 'npm wurde nicht gefunden. Bitte Node.js installieren und sicherstellen, dass npm in PATH verfügbar ist.'
}

if (-not (Test-Path -LiteralPath $codecConfigPath -PathType Leaf)) {
    throw "Die Codec-Worker-Konfiguration fehlt: $codecConfigPath"
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
Write-Host 'Worker: myqr24-tag-codec-staging' -ForegroundColor Green
Write-Host "Route: https://$codecHost/api/v1/codec/*" -ForegroundColor Green
Write-Host ''

Push-Location $edgeRouterPath
try {
    & npm.cmd run build:codec
    if ($LASTEXITCODE -ne 0) {
        throw "Der Codec-Worker-Staging-Build ist fehlgeschlagen (Exit-Code $LASTEXITCODE)."
    }

    & npm.cmd run deploy:codec:staging
    if ($LASTEXITCODE -ne 0) {
        throw "Der Codec-Worker konnte nicht nach Staging deployt werden (Exit-Code $LASTEXITCODE)."
    }
}
finally {
    Pop-Location
}
