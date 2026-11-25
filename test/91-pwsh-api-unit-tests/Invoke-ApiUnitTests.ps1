[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidateSet('edge-router-local', 'tag-content-local', 'edge-router-staging', 'tag-content-staging')][string]$Collection,
    [string]$Environment,
    [string]$TestName,
    [ValidateSet('Curl', 'PowerShell')][string]$Transport = 'Curl',
    [switch]$AllowNonLocal
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$pesterModule = Get-Module -ListAvailable Pester | Where-Object { $_.Version -ge [version]'5.0.0' } | Sort-Object Version -Descending | Select-Object -First 1
if (-not $pesterModule) {
    throw 'Run Test/PowerShell-Test-Explorer benötigt Pester 5 oder neuer. Installiere es mit: Install-Module Pester -MinimumVersion 5.0.0 -Scope CurrentUser -Force'
}
Import-Module $pesterModule.Path -Force

$root = $PSScriptRoot
if (-not $Environment) { $Environment = Join-Path $root "environments\$Collection.json" }
elseif (-not [IO.Path]::IsPathRooted($Environment)) { $Environment = Join-Path $root $Environment }
$environmentPath = (Resolve-Path -LiteralPath $Environment).Path
$modulePath = Join-Path $root 'lib\ApiClient.psm1'
Import-Module $modulePath -Force
$config = Get-ApiTestEnvironment $environmentPath
$testCollection = if ($Collection -like 'edge-router-*') { 'edge-router-local' } else { 'tag-content-local' }
$config = Set-ApiEnvironmentOverrides -Environment $config -Collection $testCollection

if ($testCollection -eq 'tag-content-local' -and $config.environment -eq 'staging') {
    foreach ($property in @('tagId', 'tagNumericId')) {
        if ([string]::IsNullOrWhiteSpace([string]$config[$property])) {
            throw "Staging-Testdaten unvollständig: '$property' in $environmentPath oder über MYQR_TAG_ID/MYQR_TAG_NUMERIC_ID setzen."
        }
    }
}

if ($config.environment -notin @('local', 'staging')) {
    throw "Environment '$($config.name)' hat einen nicht unterstützten Typ: $($config.environment)"
}
if (-not $config.baseUrl) { throw "baseUrl ist in $environmentPath nicht konfiguriert." }
$baseUri = [uri]$config.baseUrl
$isLoopback = $baseUri.Host -eq 'localhost'
if (-not $isLoopback) {
    $parsedAddress = $null
    $isLoopback = [System.Net.IPAddress]::TryParse($baseUri.Host, [ref]$parsedAddress) -and [System.Net.IPAddress]::IsLoopback($parsedAddress)
}
if ($config.environment -eq 'local' -and -not $isLoopback) {
    throw "Abbruch aus Sicherheitsgründen: lokales Environment '$($baseUri.Host)' ist nicht Loopback."
}
if ($config.environment -eq 'staging' -and -not $AllowNonLocal) {
    throw 'Staging ist nicht standardmäßig aktiviert. Für einen expliziten Staging-Lauf -AllowNonLocal angeben.'
}

$requiredSecrets = if ($testCollection -eq 'edge-router-local') {
    @(@{ Property = 'token'; Name = 'TAG_CODEC_API_KEY_S01 aus apps/edge-router/.dev.vars' })
}
else {
    $requirements = @()
    if ($config.environment -eq 'local' -and (-not $TestName -or $TestName -match '^TAG Content – Seed local TAG$|^TAG Content – Get current published document$|^TAG Content – Publish test template$|^TAG Content – Get published document after publish$|^TAG Content – Create signed public bootstrap$|^TAG Content – Get runtime content$|^TAG Content – Upload, read and delete image$')) { $requirements += @{ Property = 'localSeedKey'; Name = 'APP_LOCAL_SEED_KEY aus apps/tag-app/.dev.vars' } }
    if (-not $TestName -or $TestName -match '^TAG Content – Get current published document$|^TAG Content – Publish test template$|^TAG Content – Get published document after publish$') {
        $requirements += @{ Property = 'publisherKey'; Name = 'APP_CONTENT_PUBLISH_KEY_S01 aus apps/tag-app/.dev.vars' }
    }
    if (-not $TestName -or $TestName -match '^TAG Content – Create signed public bootstrap$|^TAG Content – Get runtime content$|^TAG Content – Upload, read and delete image$') {
        $requirements += @{ Property = 'bootstrapSecret'; Name = 'APP_BOOTSTRAP_SECRET_S01 aus apps/tag-app/.dev.vars' }
        $requirements += @{ Property = 'publisherKey'; Name = 'APP_CONTENT_PUBLISH_KEY_S01 aus apps/tag-app/.dev.vars, benötigt zum Lesen der aktuellen Revision' }
    }
    if (-not $TestName -or $TestName -match '^TAG Content – Upload, read and delete image$') {
        $requirements += @{ Property = 'contentApiKey'; Name = 'TAG_CONTENT_API_KEY_S01 aus apps/tag-app/.dev.vars' }
    }
    $requirements
}
$missingSecrets = @($requiredSecrets | Where-Object { [string]::IsNullOrWhiteSpace([string]$config[$_.Property]) })
if ($missingSecrets.Count -gt 0) {
    $names = ($missingSecrets | ForEach-Object { $_.Name }) -join ', '
    throw "Für Collection '$Collection' fehlen Credentials: $names. In $environmentPath oder als Umgebungsvariablen setzen."
}

$previousEnvironmentPath = $env:MYQR_API_TEST_ENVIRONMENT
$previousTransport = $env:MYQR_API_TEST_TRANSPORT
$previousAllowNonLocal = $env:MYQR_API_ALLOW_NONLOCAL
$env:MYQR_API_TEST_ENVIRONMENT = $environmentPath
$env:MYQR_API_TEST_TRANSPORT = $Transport
if ($AllowNonLocal) { $env:MYQR_API_ALLOW_NONLOCAL = '1' }
$suitePath = Join-Path $root "collections\$testCollection"
$pesterScript = Get-Command Invoke-Pester -ErrorAction Stop
if ($pesterScript.Source -ne 'Pester') { throw 'Invoke-Pester konnte nicht geladen werden.' }

$parameters = @{
    Path = $suitePath
}
if ($TestName) { $parameters.FullNameFilter = @("*$TestName*") }

Push-Location $root
try {
    $result = Invoke-Pester @parameters -PassThru
    if ($result.FailedCount -gt 0) { exit 1 }
}
finally {
    Pop-Location
    if ($null -eq $previousEnvironmentPath) { Remove-Item Env:\MYQR_API_TEST_ENVIRONMENT -ErrorAction SilentlyContinue }
    else { $env:MYQR_API_TEST_ENVIRONMENT = $previousEnvironmentPath }
    if ($null -eq $previousTransport) { Remove-Item Env:\MYQR_API_TEST_TRANSPORT -ErrorAction SilentlyContinue }
    else { $env:MYQR_API_TEST_TRANSPORT = $previousTransport }
    if ($null -eq $previousAllowNonLocal) { Remove-Item Env:\MYQR_API_ALLOW_NONLOCAL -ErrorAction SilentlyContinue }
    else { $env:MYQR_API_ALLOW_NONLOCAL = $previousAllowNonLocal }
    Remove-Module ApiClient -ErrorAction SilentlyContinue
}