[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$testRoot = Join-Path $repositoryRoot 'test\10-test-local'
$composeFile = Join-Path $testRoot 'compose.yaml'
$environmentFile = Join-Path $testRoot '.env.local'

if (-not (Test-Path -LiteralPath $environmentFile)) {
    throw "Local Docker environment is not configured. Run test\10-test-local\scripts\start-local-test.ps1 once to create and review .env.local."
}

$tagAppPort = 4174
$tagAppPortConfiguration = Get-Content -LiteralPath $environmentFile |
    Where-Object { $_ -match '^\s*LOCAL_TAG_APP_PWA_PORT=' } |
    Select-Object -First 1

if ($tagAppPortConfiguration -match '^\s*LOCAL_TAG_APP_PWA_PORT=(\d+)\s*$') {
    $tagAppPort = [int]$Matches[1]
}

$previousDataSource = $env:VITE_TAG_APP_DATA_SOURCE
Push-Location $repositoryRoot
try {
    $env:VITE_TAG_APP_DATA_SOURCE = 'fixtures'
    & npm.cmd run build:app
    if ($LASTEXITCODE -ne 0) {
        throw "TAG-App production build failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
    if ($null -eq $previousDataSource) {
        Remove-Item Env:\VITE_TAG_APP_DATA_SOURCE -ErrorAction SilentlyContinue
    }
    else {
        $env:VITE_TAG_APP_DATA_SOURCE = $previousDataSource
    }
}

Push-Location $repositoryRoot
try {
    & docker compose --env-file $environmentFile -f $composeFile --profile pwa up --detach --force-recreate tag-app-pwa
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose could not start the TAG-App PWA preview."
    }
}
finally {
    Pop-Location
}

$baseUrl = "http://localhost:$tagAppPort"
$smokePaths = @(
    '/',
    '/tag/stagv001',
    '/manifest.webmanifest',
    '/service-worker.js',
    '/qr-icon-192.png',
    '/qr-icon-512.png'
)
$deadline = (Get-Date).AddMinutes(3)
$ready = $false

do {
    try {
        foreach ($path in $smokePaths) {
            $response = Invoke-WebRequest -Uri "$baseUrl$path" -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -ne 200) {
                throw "PWA endpoint $path returned HTTP $($response.StatusCode)."
            }
        }
        $ready = $true
    }
    catch {
        Start-Sleep -Seconds 2
    }
} while (-not $ready -and (Get-Date) -lt $deadline)

if (-not $ready) {
    throw "TAG-App PWA did not become ready within three minutes. Inspect Docker logs with: docker compose --env-file `"$environmentFile`" -f `"$composeFile`" logs --follow tag-app-pwa"
}

$manifestResponse = Invoke-WebRequest -Uri "$baseUrl/manifest.webmanifest" -UseBasicParsing
$manifestJson = [System.Text.Encoding]::UTF8.GetString([byte[]]$manifestResponse.Content)
$manifest = $manifestJson | ConvertFrom-Json
$requiredIconSizes = @('192x192', '512x512')
foreach ($size in $requiredIconSizes) {
    if ($manifest.icons.sizes -notcontains $size) {
        throw "PWA manifest is missing the required $size icon."
    }
}

Write-Host "TAG-App PWA is ready in the Docker test environment." -ForegroundColor Green
Write-Host "Preview: $baseUrl/"
Write-Host "Test TAG: $baseUrl/tag/stagv001"
Write-Warning 'This preview uses HTTP. Installing the PWA on a phone requires HTTPS; use an HTTPS deployment or tunnel for installation testing.'
