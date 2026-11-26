function Import-TagAppStagingSecrets {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$DevVarsPath,

        [Parameter(Mandatory)]
        [System.Collections.IDictionary]$SecretMap,

        [Parameter(Mandatory)]
        [string]$ConfigPath
    )

    if (-not (Test-Path -LiteralPath $DevVarsPath -PathType Leaf)) {
        throw "Die lokale TAG-App-Secret-Datei fehlt: $DevVarsPath"
    }

    $npxExecutable = Get-Command npx.cmd -CommandType Application -ErrorAction SilentlyContinue |
        Select-Object -First 1 -ExpandProperty Source
    if (-not $npxExecutable) {
        throw 'Die echte npx.cmd-Anwendung wurde nicht gefunden; Secret-Import abgebrochen.'
    }

    $localValues = @{}
    foreach ($line in Get-Content -LiteralPath $DevVarsPath) {
        if ($line -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
            continue
        }

        $name = $Matches[1]
        $value = $Matches[2]
        if ($value.Length -ge 2 -and
            (($value.StartsWith('"') -and $value.EndsWith('"')) -or
             ($value.StartsWith("'") -and $value.EndsWith("'")))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        $localValues[$name] = $value
    }

    $secrets = @{}
    foreach ($targetName in $SecretMap.Keys) {
        $sourceName = [string]$SecretMap[$targetName]
        if (-not $localValues.ContainsKey($sourceName) -or [string]::IsNullOrWhiteSpace($localValues[$sourceName])) {
            throw "Das benötigte Secret '$sourceName' fehlt oder ist leer in $DevVarsPath. Es wurde nichts hochgeladen."
        }
        $secrets[[string]$targetName] = [string]$localValues[$sourceName]
    }

    $tempPath = Join-Path ([IO.Path]::GetTempPath()) ('.myqr24-staging-secrets-' + [guid]::NewGuid().ToString('N') + '.json')
    try {
        # Die Datei ist zufällig benannt, nur für den aktuellen Windows-Benutzer
        # lesbar und wird in jedem Pfad sofort wieder entfernt. Secret-Werte
        # erscheinen weder in Argumenten noch in der Konsole.
        [IO.File]::WriteAllText($tempPath, '{}', [Text.UTF8Encoding]::new($false))
        $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name
        $acl = Get-Acl -LiteralPath $tempPath
        $acl.SetAccessRuleProtection($true, $false)
        $rule = [Security.AccessControl.FileSystemAccessRule]::new(
            $currentUser,
            [Security.AccessControl.FileSystemRights]::FullControl,
            [Security.AccessControl.AccessControlType]::Allow
        )
        $acl.SetAccessRule($rule)
        Set-Acl -LiteralPath $tempPath -AclObject $acl
        [IO.File]::WriteAllText($tempPath, ($secrets | ConvertTo-Json -Compress), [Text.UTF8Encoding]::new($false))

        $null = & $npxExecutable wrangler secret bulk $tempPath --config $ConfigPath --env staging 2>&1
        $exitCode = $LASTEXITCODE
        if ($exitCode -ne 0) {
            # Wrangler-Ausgaben nicht weiterreichen, damit Secret-Werte nie versehentlich
            # in einer Terminal-/CI-Ausgabe erscheinen.
            throw 'Wrangler konnte die Staging-Secrets nicht sicher aktualisieren. Wrangler-Fehlerausgabe wurde aus Sicherheitsgründen unterdrückt.'
        }
    }
    finally {
        Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
    }

    Write-Host ("{0} Staging-Secret(s) aktualisiert (Werte verborgen)." -f $secrets.Count) -ForegroundColor Green
}