[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$testRoot = Split-Path -Parent $PSScriptRoot
$repositoryRoot = (Resolve-Path (Join-Path $testRoot '..\..')).Path
$composeFile = Join-Path $testRoot 'compose.yaml'
$environmentFile = Join-Path $testRoot '.env.local'

if (-not (Test-Path -LiteralPath $environmentFile)) {
    Write-Host 'The local test environment has no .env.local file; nothing to stop.'
    exit 0
}

Push-Location $repositoryRoot
try {
    & docker compose --env-file $environmentFile -f $composeFile down
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker Compose could not stop the local test environment.'
    }
}
finally {
    Pop-Location
}
