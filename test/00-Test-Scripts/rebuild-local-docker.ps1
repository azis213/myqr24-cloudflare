[CmdletBinding()]
param(
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$testRoot = Join-Path $repositoryRoot 'test\10-test-local'
$composeFile = Join-Path $testRoot 'compose.yaml'
$environmentFile = Join-Path $testRoot '.env.local'
$startScript = Join-Path $PSScriptRoot 'start-cloudflare-test-env.ps1'
$pwaScript = Join-Path $PSScriptRoot 'deploy-tag-app-docker.ps1'

if (-not (Test-Path -LiteralPath $environmentFile -PathType Leaf)) {
    throw "Local Docker environment is not configured. Run test\10-test-local\scripts\start-local-test.ps1 once to create and review .env.local."
}

foreach ($path in @($composeFile, $startScript, $pwaScript)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Required local Docker file is missing: $path"
    }
}

$dockerExecutable = Get-Command docker.exe -CommandType Application -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty Source
if (-not $dockerExecutable) {
    throw 'docker.exe was not found. Install Docker Desktop and ensure Docker is available in PATH.'
}

$composeArguments = @(
    'compose',
    '--env-file', $environmentFile,
    '-f', $composeFile,
    '--profile', 'cloudflare',
    '--profile', 'pwa'
)

Push-Location $repositoryRoot
try {
    & $dockerExecutable @composeArguments config --quiet
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker Compose configuration validation failed.'
    }

    if ($DryRun) {
        Write-Host 'Dry run complete. No containers or images were changed.' -ForegroundColor Cyan
        Write-Host "Would rebuild all buildable services without cache and recreate every service in the cloudflare and pwa profiles."
        Write-Host "Would then run: $startScript"
        Write-Host "Would then run: $pwaScript"
        return
    }

    Write-Host 'Building all buildable local Docker services without cache...' -ForegroundColor Cyan
    & $dockerExecutable @composeArguments build --no-cache
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker Compose could not rebuild all local services.'
    }

    Write-Host 'Recreating all local Compose services (named data volumes are preserved)...' -ForegroundColor Cyan
    & $dockerExecutable @composeArguments up --detach --force-recreate
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker Compose could not recreate all local services.'
    }

    Write-Host 'Applying local seed data and running Cloudflare worker smoke tests...' -ForegroundColor Cyan
    & $startScript
    if ($LASTEXITCODE -ne 0) {
        throw 'The local Cloudflare test environment setup or smoke tests failed.'
    }

    Write-Host 'Building and checking the local TAG-App PWA preview...' -ForegroundColor Cyan
    & $pwaScript
    if ($LASTEXITCODE -ne 0) {
        throw 'The local TAG-App PWA build or smoke tests failed.'
    }
}
finally {
    Pop-Location
}

Write-Host 'All local Docker services were rebuilt, recreated, and verified.' -ForegroundColor Green
Write-Warning 'This script only updates the local Docker test environment; it does not deploy to Cloudflare.'