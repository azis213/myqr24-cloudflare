[CmdletBinding()]
param(
    [switch]$Rebuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$testRoot = Split-Path -Parent $PSScriptRoot
$repositoryRoot = (Resolve-Path (Join-Path $testRoot '..\..')).Path
$composeFile = Join-Path $testRoot 'compose.yaml'
$environmentFile = Join-Path $testRoot '.env.local'
$environmentTemplate = Join-Path $testRoot '.env.example'

if (-not (Test-Path -LiteralPath $environmentFile)) {
    Copy-Item -LiteralPath $environmentTemplate -Destination $environmentFile
    Write-Warning "Created $environmentFile. Review the synthetic local values before sharing this environment."
}

$requiredCodecSettings = @('LOCAL_CODEC_API_KEY', 'LOCAL_CODEC_FEISTEL_SECRET')
$missingCodecSettings = @($requiredCodecSettings | Where-Object {
    -not (Select-String -LiteralPath $environmentFile -Pattern "^$_=" -Quiet)
})

if ($missingCodecSettings.Count -gt 0) {
    throw "Missing local codec settings ($($missingCodecSettings -join ', ')) in $environmentFile. Add synthetic random values before starting the local environment."
}

$localConfiguration = Get-Content -LiteralPath $environmentFile

$tcpPort = 8080
$tccPort = 5174

$tcpPortConfiguration = $localConfiguration |
    Where-Object { $_ -match '^\s*LOCAL_TCP_PORT=' } |
    Select-Object -First 1

if ($tcpPortConfiguration -match '^\s*LOCAL_TCP_PORT=(\d+)\s*$') {
    $tcpPort = [int]$Matches[1]
}

$tccPortConfiguration = $localConfiguration |
    Where-Object { $_ -match '^\s*LOCAL_TCC_PORT=' } |
    Select-Object -First 1

if ($tccPortConfiguration -match '^\s*LOCAL_TCC_PORT=(\d+)\s*$') {
    $tccPort = [int]$Matches[1]
}

$composeArguments = @(
    'compose',
    '--env-file', $environmentFile,
    '-f', $composeFile,
    'up',
    '--detach'
)

if ($Rebuild) {
    $composeArguments += '--build'
}

Push-Location $repositoryRoot
try {
    & docker @composeArguments
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose could not start the local test environment."
    }

    $healthUrl = "http://localhost:$tcpPort/api/v1/health"
    $tccUrl = "http://localhost:$tccPort/"
    $deadline = (Get-Date).AddMinutes(3)
    $tcpReady = $false
    $tccReady = $false

    do {
        if (-not $tcpReady) {
            try {
                $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 5
                $tcpReady = $response.StatusCode -eq 200
            }
            catch {
                # TCP is still starting.
            }
        }

        if (-not $tccReady) {
            try {
                $response = Invoke-WebRequest -Uri $tccUrl -UseBasicParsing -TimeoutSec 5
                $tccReady = $response.StatusCode -eq 200
            }
            catch {
                # Vite is still installing dependencies or starting.
            }
        }

        if ($tcpReady -and $tccReady) {
            Write-Host "Local test environment is ready." -ForegroundColor Green
            Write-Host "TCC:    $tccUrl"
            Write-Host "TCP:    http://localhost:$tcpPort/"
            Write-Host "Health: $healthUrl"
            exit 0
        }

        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)

    throw "The local test environment did not become fully ready within three minutes. Inspect logs with: docker compose --env-file `"$environmentFile`" -f `"$composeFile`" logs --follow"
}
finally {
    Pop-Location
}
