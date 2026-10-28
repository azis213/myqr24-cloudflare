[CmdletBinding()]
param(
    [ValidateRange(1, 65535)]
    [int]$Port = 5173
)

$ErrorActionPreference = "Stop"

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$tagGeneratorPath = Join-Path $repositoryRoot "tools\tag-gen"
$applicationUrl = "http://127.0.0.1:$Port/"

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm wurde nicht gefunden. Bitte installieren Sie Node.js und stellen Sie sicher, dass npm in PATH verfügbar ist."
}

if (-not (Test-Path (Join-Path $tagGeneratorPath "node_modules"))) {
    throw "Abhängigkeiten für tools\tag-gen fehlen. Führen Sie zunächst 'npm --prefix tools\tag-gen install' im Repository aus."
}

Write-Host ""
Write-Host "myQR24 TAG-Generator wird gestartet ..." -ForegroundColor Cyan
Write-Host "Browser-Link: $applicationUrl" -ForegroundColor Green
Write-Host "Zum Beenden: Strg+C" -ForegroundColor DarkGray
Write-Host ""

Push-Location $tagGeneratorPath
try {
    npm run dev -- --host 127.0.0.1 --port $Port --strictPort
}
finally {
    Pop-Location
}
