[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$testRoot = Split-Path -Parent $PSScriptRoot
$repositoryRoot = (Resolve-Path (Join-Path $testRoot '..\..')).Path
$composeFile = Join-Path $testRoot 'compose.yaml'
$environmentFile = Join-Path $testRoot '.env.local'

if (-not (Test-Path -LiteralPath $environmentFile)) {
    throw "Missing $environmentFile. Start the local environment once with start-local-test.ps1."
}

$environmentValues = @{}
Get-Content -LiteralPath $environmentFile |
    Where-Object { $_ -match '^\s*[A-Z0-9_]+=' } |
    ForEach-Object {
        $name, $value = $_ -split '=', 2
        $environmentValues[$name.Trim()] = $value.Trim()
    }

$testDatabase = $environmentValues['LOCAL_MYSQL_TEST_DATABASE']
$mysqlUser = $environmentValues['LOCAL_MYSQL_USER']
$mysqlRootPassword = $environmentValues['LOCAL_MYSQL_ROOT_PASSWORD']
$codecApiKey = $environmentValues['LOCAL_CODEC_API_KEY']
$codecFeistelSecret = $environmentValues['LOCAL_CODEC_FEISTEL_SECRET']

if ([string]::IsNullOrWhiteSpace($testDatabase) -or
    [string]::IsNullOrWhiteSpace($mysqlUser) -or
    [string]::IsNullOrWhiteSpace($mysqlRootPassword) -or
    [string]::IsNullOrWhiteSpace($codecApiKey) -or
    [string]::IsNullOrWhiteSpace($codecFeistelSecret)) {
    throw 'LOCAL_MYSQL_TEST_DATABASE, LOCAL_MYSQL_USER, LOCAL_MYSQL_ROOT_PASSWORD, LOCAL_CODEC_API_KEY, and LOCAL_CODEC_FEISTEL_SECRET must be configured in .env.local.'
}

if ($testDatabase -notmatch '^[A-Za-z0-9_]+$' -or $mysqlUser -notmatch '^[A-Za-z0-9_]+$') {
    throw 'The local MySQL database and user names may only contain letters, numbers, and underscores.'
}

$sql = 'CREATE DATABASE IF NOT EXISTS `' + $testDatabase + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci; ' +
    'GRANT ALL PRIVILEGES ON `' + $testDatabase + '`.* TO ''' + $mysqlUser + '''@''%''; FLUSH PRIVILEGES;'

Push-Location $repositoryRoot
try {
    & docker compose --env-file $environmentFile -f $composeFile up --detach mysql tag-codec tag-control-plane
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker Compose could not start the local services for testing.'
    }

    & docker compose --env-file $environmentFile -f $composeFile exec -T mysql mysql --protocol=socket -uroot "--password=$mysqlRootPassword" -e $sql
    if ($LASTEXITCODE -ne 0) {
        throw 'The isolated local MySQL test database could not be prepared.'
    }

    & docker compose --env-file $environmentFile -f $composeFile exec -T tag-control-plane sh /workspace/local-test/scripts/run-tag-control-plane-tests.sh
    if ($LASTEXITCODE -ne 0) {
        throw 'TAG Control Plane local MySQL tests failed.'
    }
}
finally {
    Pop-Location
}
