[CmdletBinding()]
param(
    [switch]$ResetData,
    [switch]$SkipSmoke
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$testRoot = Join-Path $repositoryRoot 'test\10-test-local'
$composeFile = Join-Path $testRoot 'compose.yaml'
$environmentFile = Join-Path $testRoot '.env.local'
$environmentTemplate = Join-Path $testRoot '.env.example'
$stateVolumeName = 'myqr24-local-test_cloudflare_state'
$seedRoot = Join-Path $testRoot 'seed'
$seedSqlFile = Join-Path $seedRoot 'generated.sql'
$routingSeedSqlFile = Join-Path $seedRoot 'generated-routing.sql'
$helper = Join-Path $testRoot 'scripts\cloudflare-test-data.ps1'
$startTcpScript = Join-Path $testRoot 'scripts\start-local-test.ps1'
$smokeScript = Join-Path $testRoot 'scripts\app-api-smoke.mjs'

. $helper

if (-not (Test-Path -LiteralPath $environmentFile -PathType Leaf)) {
    Copy-Item -LiteralPath $environmentTemplate -Destination $environmentFile
    Write-Warning "Created $environmentFile. Review the synthetic local values before sharing this environment."
}

Set-LocalEnvironmentDefaults -EnvironmentFile $environmentFile
$values = Read-LocalEnvironment -EnvironmentFile $environmentFile

Set-LocalDevVars -Path (Join-Path $repositoryRoot 'apps\tag-app\.dev.vars') -Updates @{
    APP_BOOTSTRAP_SECRET_S01 = $values['LOCAL_APP_BOOTSTRAP_SECRET']
    APP_PIN_PEPPER_S01       = $values['LOCAL_APP_PIN_PEPPER']
    APP_MEDIA_SIGNER_KEY_S01 = $values['LOCAL_APP_MEDIA_SIGNER_KEY']
    APP_LOCAL_SEED_KEY       = $values['LOCAL_APP_LOCAL_SEED_KEY']
}
Set-LocalDevVars -Path (Join-Path $repositoryRoot 'apps\edge-router\.dev.vars') -Updates @{
    FEISTEL_SECRET_S01          = $values['LOCAL_EDGE_FEISTEL_SECRET']
    REDIRECT_SIGNING_SECRET_S01 = $values['LOCAL_EDGE_REDIRECT_SIGNING_SECRET']
    APP_BOOTSTRAP_SECRET_S01    = $values['LOCAL_APP_BOOTSTRAP_SECRET']
}

if ($ResetData) {
    Stop-LocalCloudflareServices -RepositoryRoot $repositoryRoot -EnvironmentFile $environmentFile -ComposeFile $composeFile
    Remove-LocalCloudflareStateVolume -VolumeName $stateVolumeName
    Write-Host 'Cloudflare local D1/R2/KV state reset.' -ForegroundColor Yellow
}

Initialize-LocalCloudflareStateVolume -VolumeName $stateVolumeName
New-CloudflareSeedSql -SeedRoot $seedRoot -OutputFile $seedSqlFile -RoutingOutputFile $routingSeedSqlFile

& $startTcpScript
if ($LASTEXITCODE -ne 0) {
    throw 'The existing local test stack could not be started.'
}

Invoke-LocalCompose -RepositoryRoot $repositoryRoot -EnvironmentFile $environmentFile -ComposeFile $composeFile `
    -Arguments @('--profile', 'cloudflare', 'up', '--detach')

$apiPort = [int]$values['LOCAL_TAG_APP_API_PORT']
$edgePort = [int]$values['LOCAL_EDGE_ROUTER_PORT']
$codecPort = [int]$values['LOCAL_CODEC_PORT']
Wait-LocalTcpPort -Port $apiPort -TimeoutSeconds 240
Wait-LocalTcpPort -Port $edgePort -TimeoutSeconds 240
Wait-LocalTcpPort -Port $codecPort -TimeoutSeconds 240

Invoke-LocalAppApiSeed -ApiPort $apiPort -SeedKey $values['LOCAL_APP_LOCAL_SEED_KEY']
Install-CloudflareSeed -RepositoryRoot $repositoryRoot -EnvironmentFile $environmentFile -ComposeFile $composeFile -RoutingSqlFile $routingSeedSqlFile

Invoke-LocalCompose -RepositoryRoot $repositoryRoot -EnvironmentFile $environmentFile -ComposeFile $composeFile `
    -Arguments @('restart', 'edge-router')
Wait-LocalTcpPort -Port $edgePort -TimeoutSeconds 120
Wait-LocalTcpPort -Port $codecPort -TimeoutSeconds 120
Start-Sleep -Seconds 3

if (-not $SkipSmoke) {
    $previousSecret = $env:APP_BOOTSTRAP_SECRET_S01
    $previousBaseUrl = $env:APP_API_BASE_URL
    try {
        $env:APP_BOOTSTRAP_SECRET_S01 = $values['LOCAL_APP_BOOTSTRAP_SECRET']
        $env:APP_API_BASE_URL = "http://127.0.0.1:$apiPort"

        $apiSmokeDeadline = (Get-Date).AddSeconds(60)
        $apiSmokeExit = 1
        do {
            & node $smokeScript
            $apiSmokeExit = $LASTEXITCODE
            if ($apiSmokeExit -eq 0) {
                break
            }
            Start-Sleep -Seconds 2
        } while ((Get-Date) -lt $apiSmokeDeadline)

        if ($apiSmokeExit -ne 0) {
            throw "Application API smoke test failed with exit code $apiSmokeExit."
        }
    }
    finally {
        if ($null -eq $previousSecret) { Remove-Item Env:\APP_BOOTSTRAP_SECRET_S01 -ErrorAction SilentlyContinue }
        else { $env:APP_BOOTSTRAP_SECRET_S01 = $previousSecret }
        if ($null -eq $previousBaseUrl) { Remove-Item Env:\APP_API_BASE_URL -ErrorAction SilentlyContinue }
        else { $env:APP_API_BASE_URL = $previousBaseUrl }
    }

    $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
    if ($curl) {
        $edgeResult = $null
        $edgeDeadline = (Get-Date).AddSeconds(45)
        do {
            $edgeResult = & $curl.Source -s -o NUL -w "%{http_code}|%{redirect_url}" -H "Host: s.qr4.uk" "http://127.0.0.1:$edgePort/t/ab12cd"
            if ($LASTEXITCODE -eq 0 -and $edgeResult -match '^302\|https://app\.localhost/tag/ab12cd') {
                break
            }
            Start-Sleep -Seconds 2
        } while ((Get-Date) -lt $edgeDeadline)

        if ($edgeResult -notmatch '^302\|https://app\.localhost/tag/ab12cd') {
            throw "Edge Router smoke test failed: $edgeResult"
        }
        Write-Host "Edge Router smoke OK: $edgeResult" -ForegroundColor Green
    }
    else {
        Write-Warning 'curl.exe is not available; the Edge Router HTTP smoke test was skipped.'
    }

    Invoke-LocalCodecSmoke -CodecPort $codecPort -ApiKey $values['LOCAL_CODEC_API_KEY']
    Write-Host "Codec API smoke OK: authenticated decode on http://127.0.0.1:$codecPort" -ForegroundColor Green
}

Write-Host ''
Write-Host 'Cloudflare Docker test environment is ready.' -ForegroundColor Green
Write-Host "TAG-App (fixtures):   http://localhost:$($values['LOCAL_TAG_APP_PORT'])/tag/ab12cd"
Write-Host "TAG Application API:  http://localhost:$apiPort/"
Write-Host "Edge Router:          http://localhost:$edgePort/"
Write-Host "Codec API (loopback): http://127.0.0.1:$codecPort/"
Write-Host "TAG Control Center:   http://localhost:$($values['LOCAL_TCC_PORT'])/"
Write-Host "TCP Health:           http://localhost:$($values['LOCAL_TCP_PORT'])/api/v1/health"
Write-Host ''
Write-Host 'API test data: tag=ab12cd, revision=8, contentId=1850000000000000, variant=cover'
Write-Host 'Media signing remains fail-closed until the real R2 signing credentials gate is opened.'
