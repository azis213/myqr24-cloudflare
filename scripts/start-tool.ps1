[CmdletBinding()]
param(
    [string]$Tool,

    [ValidateRange(1, 65535)]
    [int]$Port
)

$ErrorActionPreference = "Stop"

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

# Neue lokale Anwendungen werden ausschließlich hier ergänzt.
$tools = @(
    [PSCustomObject]@{
        Id          = "tag-designer"
        Name        = "TAG-Designer"
        Description = "Etikettenformate gestalten und verwalten"
        RelativePath = "tools\tag-designer"
        DefaultPort = 5173
    },
    [PSCustomObject]@{
        Id          = "tag-gen"
        Name        = "TAG-Generator"
        Description = "TAG-Bereiche generieren, etikettieren und exportieren"
        RelativePath = "tools\tag-gen"
        DefaultPort = 5174
    }
)

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm wurde nicht gefunden. Bitte installieren Sie Node.js und stellen Sie sicher, dass npm in PATH verfügbar ist."
}

if (-not $Tool) {
    Write-Host ""
    Write-Host "myQR24 – Lokales Werkzeug starten" -ForegroundColor Cyan
    Write-Host ""

    for ($index = 0; $index -lt $tools.Count; $index++) {
        $entry = $tools[$index]
        Write-Host ("  {0}) {1} – {2}" -f ($index + 1), $entry.Name, $entry.Description)
    }

    Write-Host "  0) Abbrechen" -ForegroundColor DarkGray
    Write-Host ""

    do {
        $selection = Read-Host "Bitte Werkzeug auswählen"
        $selectionIsValid = $selection -match "^\d+$" -and [int]$selection -ge 0 -and [int]$selection -le $tools.Count

        if (-not $selectionIsValid) {
            Write-Host "Bitte eine Zahl zwischen 0 und $($tools.Count) eingeben." -ForegroundColor Yellow
        }
    } while (-not $selectionIsValid)

    if ([int]$selection -eq 0) {
        Write-Host "Start abgebrochen." -ForegroundColor DarkGray
        return
    }

    $selectedTool = $tools[[int]$selection - 1]
}
else {
    $selectedTool = $tools | Where-Object Id -eq $Tool

    if ($null -eq $selectedTool) {
        throw "Für '$Tool' ist kein Werkzeug registriert."
    }
}

$toolPath = Join-Path $repositoryRoot $selectedTool.RelativePath
$packageJsonPath = Join-Path $toolPath "package.json"
$nodeModulesPath = Join-Path $toolPath "node_modules"
$applicationPort = if ($PSBoundParameters.ContainsKey("Port")) { $Port } else { $selectedTool.DefaultPort }
$applicationUrl = "http://127.0.0.1:$applicationPort/"

if (-not (Test-Path $packageJsonPath -PathType Leaf)) {
    throw "Die Werkzeugdefinition '$($selectedTool.Id)' verweist auf kein npm-Projekt: $toolPath"
}

if (-not (Test-Path $nodeModulesPath -PathType Container)) {
    throw "Abhängigkeiten für $($selectedTool.RelativePath) fehlen. Führen Sie zunächst 'npm --prefix $($selectedTool.RelativePath) install' im Repository aus."
}

Write-Host ""
Write-Host "$($selectedTool.Name) wird gestartet ..." -ForegroundColor Cyan
Write-Host "Browser-Link: $applicationUrl" -ForegroundColor Green
Write-Host "Zum Beenden: Strg+C" -ForegroundColor DarkGray
Write-Host ""

Push-Location $toolPath
try {
    npm run dev -- --host 127.0.0.1 --port $applicationPort --strictPort
}
finally {
    Pop-Location
}
