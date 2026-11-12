[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

Push-Location $repositoryRoot
try {
    & npm.cmd run test:router -- --inspect-brk --no-file-parallelism --test-timeout=0
    if ($LASTEXITCODE -ne 0) {
        throw "Edge Router tests failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}
