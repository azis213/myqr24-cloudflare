[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$edgeRouterPath = Join-Path $repositoryRoot 'apps\edge-router'
$devVarsPath = Join-Path $edgeRouterPath '.dev.vars'

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw 'npm wurde nicht gefunden. Bitte Node.js installieren und sicherstellen, dass npm in PATH verfügbar ist.'
}

if (-not (Test-Path -LiteralPath $devVarsPath -PathType Leaf)) {
    throw "Lokale Codec-Secrets fehlen: $devVarsPath. Lege die Datei mit synthetischen Testwerten für FEISTEL_SECRET_S01 und TAG_CODEC_API_KEY_S01 an."
}

$devVars = Get-Content -LiteralPath $devVarsPath
foreach ($setting in @('FEISTEL_SECRET_S01', 'TAG_CODEC_API_KEY_S01')) {
    $hasSetting = $devVars |
        Where-Object { $_ -match "^\s*$([regex]::Escape($setting))\s*=\s*\S" } |
        Select-Object -First 1

    if (-not $hasSetting) {
        throw "$setting fehlt oder ist leer in $devVarsPath. Verwende ausschließlich synthetische lokale Testwerte."
    }
}

Write-Host ''
Write-Host 'Lokaler TAG Codec-Worker wird gestartet ...' -ForegroundColor Cyan
Write-Host 'Adresse: http://127.0.0.1:8788' -ForegroundColor Green
Write-Host 'Zum Beenden: Strg+C' -ForegroundColor DarkGray
Write-Host ''

Push-Location $edgeRouterPath
try {
    & npm.cmd run dev:codec
    if ($LASTEXITCODE -ne 0) {
        throw "Der lokale Codec-Worker konnte nicht gestartet werden (Exit-Code $LASTEXITCODE)."
    }
}
finally {
    Pop-Location
}
