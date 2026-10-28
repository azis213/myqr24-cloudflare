[CmdletBinding(SupportsShouldProcess)]
param(
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$testRoot = Split-Path -Parent $PSScriptRoot
$repositoryRoot = (Resolve-Path (Join-Path $testRoot '..\..')).Path
$composeFile = Join-Path $testRoot 'compose.yaml'
$environmentFile = Join-Path $testRoot '.env.local'

if (-not (Test-Path -LiteralPath $environmentFile)) {
    Write-Host 'The local test environment has no .env.local file; no local data exists to reset.'
    exit 0
}

if (-not $Force) {
    $confirmation = Read-Host 'Delete all local TCC/TCP/MySQL test data and volumes? Type RESET to continue'
    if ($confirmation -ne 'RESET') {
        Write-Host 'Reset cancelled.'
        exit 0
    }
}

Push-Location $repositoryRoot
try {
    & docker compose --env-file $environmentFile -f $composeFile down --volumes --remove-orphans
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker Compose could not reset the local test environment.'
    }
}
finally {
    Pop-Location
}
