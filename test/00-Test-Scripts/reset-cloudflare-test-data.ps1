[CmdletBinding()]
param(
    [switch]$SkipSmoke
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$startScript = Join-Path $PSScriptRoot 'start-cloudflare-test-env.ps1'
if (-not (Test-Path -LiteralPath $startScript -PathType Leaf)) {
    throw "Missing start script: $startScript"
}

Write-Host 'Resetting the local Cloudflare D1/R2/KV test data to the initial seed.' -ForegroundColor Yellow
& $startScript -ResetData -SkipSmoke:$SkipSmoke
if ($LASTEXITCODE -ne 0) {
    throw "Cloudflare test data reset failed with exit code $LASTEXITCODE."
}
