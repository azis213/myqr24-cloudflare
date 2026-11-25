Set-StrictMode -Version Latest

function ConvertTo-ApiJson {
    [CmdletBinding()]
    param([Parameter(Mandatory)][object]$InputObject)

    return ConvertTo-Json -InputObject $InputObject -Depth 100 -Compress
}

function ConvertFrom-CurlHeaders {
    [CmdletBinding()]
    param([string]$Text)

    $headers = @{}
    foreach ($line in ($Text -split "`r?`n")) {
        if ($line -match '^HTTP/\S+\s+\d+') {
            $headers = @{}
            continue
        }
        $separator = $line.IndexOf(':')
        if ($separator -gt 0) {
            $name = $line.Substring(0, $separator).Trim().ToLowerInvariant()
            $value = $line.Substring($separator + 1).Trim()
            if ($headers.ContainsKey($name)) { $headers[$name] += ", $value" }
            else { $headers[$name] = $value }
        }
    }
    return $headers
}

function Invoke-ApiRequest {
    <#
    .SYNOPSIS
        Führt einen REST-Request über curl.exe oder PowerShell aus.
    .PARAMETER Files
        Multipart-Felder als Hashtable, z. B. @{ original = 'C:\fixtures\image.png' }.
    .PARAMETER BodyFile
        Datei als unveränderter Request-Body (curl: --data-binary @Datei).
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][ValidateSet('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD')][string]$Method,
        [Parameter(Mandatory)][uri]$Uri,
        [hashtable]$Headers = @{},
        [AllowNull()][object]$Body,
        [string]$BodyFile,
        [hashtable]$Files = @{},
        [ValidateSet('Curl', 'PowerShell')][string]$Transport = 'Curl',
        [int]$TimeoutSeconds = 60
    )

    if ($BodyFile -and ($null -ne $Body -or $Files.Count -gt 0)) {
        throw 'BodyFile kann nicht zusammen mit Body oder Files verwendet werden.'
    }
    if ($null -ne $Body -and $Files.Count -gt 0) {
        throw 'JSON-/Text-Body kann nicht zusammen mit Multipart-Files verwendet werden.'
    }
    foreach ($field in $Files.Keys) {
        if (-not (Test-Path -LiteralPath $Files[$field] -PathType Leaf)) {
            throw "Multipart-Datei für '$field' nicht gefunden: $($Files[$field])"
        }
    }

    $requestHeaders = @{}
    foreach ($key in $Headers.Keys) { $requestHeaders[[string]$key] = [string]$Headers[$key] }

    if ($Transport -eq 'PowerShell') {
        $parameters = @{
            Uri                = $Uri
            Method             = $Method
            Headers            = $requestHeaders
            TimeoutSec         = $TimeoutSeconds
            SkipHttpErrorCheck = $true
        }
        if ($Files.Count -gt 0) {
            $form = @{}
            foreach ($field in $Files.Keys) {
                $form[[string]$field] = Get-Item -LiteralPath $Files[$field]
            }
            $parameters.Form = $form
        }
        elseif ($BodyFile) {
            $parameters.InFile = (Resolve-Path -LiteralPath $BodyFile).Path
        }
        elseif ($null -ne $Body) {
            $parameters.Body = if ($Body -is [string]) { $Body } else { ConvertTo-ApiJson $Body }
            if (-not $requestHeaders.ContainsKey('Content-Type')) {
                $requestHeaders['Content-Type'] = 'application/json'
            }
            $parameters.Headers = $requestHeaders
        }

        try {
            $response = Invoke-WebRequest @parameters
            $raw = [string]$response.Content
            $parsed = $null
            if ($raw) {
                try { $parsed = ConvertFrom-Json -InputObject $raw -AsHashtable -ErrorAction Stop }
                catch { $parsed = $null }
            }
            $responseHeaders = @{}
            foreach ($key in $response.Headers.Keys) {
                $responseHeaders[[string]$key.ToLowerInvariant()] = [string]($response.Headers[$key] -join ', ')
            }
            return [pscustomobject]@{
                StatusCode = [int]$response.StatusCode
                Headers    = $responseHeaders
                Body       = $parsed
                RawBody    = $raw
            }
        }
        catch {
            if ($_.Exception.Response) {
                $status = [int]$_.Exception.Response.StatusCode
                $raw = [string]$_.ErrorDetails.Message
                $parsed = $null
                if ($raw) {
                    try { $parsed = ConvertFrom-Json -InputObject $raw -AsHashtable -ErrorAction Stop }
                    catch { $parsed = $null }
                }
                return [pscustomobject]@{ StatusCode = $status; Headers = @{}; Body = $parsed; RawBody = $raw }
            }
            throw
        }
    }

    $curl = Get-Command curl.exe -ErrorAction Stop
    $tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('myqr-api-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
    $bodyPath = Join-Path $tempRoot 'body.json'
    $headersPath = Join-Path $tempRoot 'headers.txt'
    $jsonPath = $null
    try {
        $arguments = [System.Collections.Generic.List[string]]::new()
        foreach ($argument in @('--silent', '--show-error', '--request', $Method, '--max-time', [string]$TimeoutSeconds, '--dump-header', $headersPath, '--output', $bodyPath, '--write-out', '%{http_code}')) {
            $arguments.Add($argument)
        }
        foreach ($key in $requestHeaders.Keys) {
            $arguments.Add('--header')
            $arguments.Add("${key}: $($requestHeaders[$key])")
        }
        if ($Files.Count -gt 0) {
            foreach ($field in $Files.Keys) {
                $file = (Resolve-Path -LiteralPath $Files[$field]).Path
                $mime = if ([IO.Path]::GetExtension($file) -eq '.png') { 'image/png' } else { 'application/octet-stream' }
                $arguments.Add('--form')
                $arguments.Add("${field}=@${file};type=$mime")
            }
        }
        elseif ($BodyFile) {
            $arguments.Add('--data-binary')
            $arguments.Add("@$((Resolve-Path -LiteralPath $BodyFile).Path)")
        }
        elseif ($null -ne $Body) {
            $jsonPath = Join-Path $tempRoot 'request.json'
            $json = if ($Body -is [string]) { $Body } else { ConvertTo-ApiJson $Body }
            [System.IO.File]::WriteAllText($jsonPath, $json, [System.Text.UTF8Encoding]::new($false))
            if (-not ($requestHeaders.Keys | Where-Object { $_ -ieq 'Content-Type' })) {
                $arguments.Add('--header')
                $arguments.Add('Content-Type: application/json')
            }
            $arguments.Add('--data-binary')
            $arguments.Add("@$jsonPath")
        }
        $arguments.Add($Uri.AbsoluteUri)

        $statusText = & $curl.Source @arguments
        if ($LASTEXITCODE -ne 0) { throw "curl.exe fehlgeschlagen (Exit $LASTEXITCODE): $statusText" }
        $raw = if (Test-Path -LiteralPath $bodyPath) { [System.IO.File]::ReadAllText($bodyPath) } else { '' }
        $parsed = $null
        if ($raw) {
            try { $parsed = ConvertFrom-Json -InputObject $raw -AsHashtable -ErrorAction Stop }
            catch { $parsed = $null }
        }
        $headerText = if (Test-Path -LiteralPath $headersPath) { [System.IO.File]::ReadAllText($headersPath) } else { '' }
        return [pscustomobject]@{
            StatusCode = [int]$statusText.Trim()
            Headers    = ConvertFrom-CurlHeaders $headerText
            Body       = $parsed
            RawBody    = $raw
        }
    }
    finally {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Get-ApiAuthorizationHeaders {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Token)
    if ([string]::IsNullOrWhiteSpace($Token)) { throw 'Authorization-Token ist leer.' }
    return @{ Authorization = "Bearer $Token" }
}

function Get-ApiBaseUri {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$BaseUrl, [Parameter(Mandatory)][string]$Path)
    return [uri]::new(([uri]$BaseUrl), $Path)
}

function Get-ApiTestEnvironment {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Environment-Datei fehlt: $Path" }
    $environment = Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json -AsHashtable
    $localPath = Join-Path (Split-Path $Path -Parent) (([IO.Path]::GetFileNameWithoutExtension($Path)) + '.local.json')
    if (Test-Path -LiteralPath $localPath -PathType Leaf) {
        $localOverrides = Get-Content -Raw -LiteralPath $localPath | ConvertFrom-Json -AsHashtable
        foreach ($key in $localOverrides.Keys) { $environment[$key] = $localOverrides[$key] }
    }
    $repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
    $tagAppDevVars = Join-Path $repositoryRoot 'apps\tag-app\.dev.vars'
    $edgeDevVars = Join-Path $repositoryRoot 'apps\edge-router\.dev.vars'
    $devVars = @{}
    foreach ($devVarsPath in @($tagAppDevVars, $edgeDevVars)) {
        if (-not (Test-Path -LiteralPath $devVarsPath -PathType Leaf)) { continue }
        foreach ($line in Get-Content -LiteralPath $devVarsPath) {
            if ($line -match '^\s*(?:#|$)' -or $line -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') { continue }
            $value = $Matches[2].Trim()
            if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            $devVars[$Matches[1]] = $value
        }
    }
    $devVarsMap = @{
        APP_BOOTSTRAP_SECRET_S01 = 'bootstrapSecret'
        APP_LOCAL_SEED_KEY = 'localSeedKey'
        APP_CONTENT_PUBLISH_KEY_S01 = 'publisherKey'
        TAG_CONTENT_API_KEY_S01 = 'contentApiKey'
        TAG_CODEC_API_KEY_S01 = 'token'
        MYQR_TAG_APP_API_BASE_URL = 'baseUrl'
        MYQR_CODEC_BASE_URL = 'baseUrl'
        MYQR_TAG_ID = 'tagId'
        MYQR_TAG_NUMERIC_ID = 'tagNumericId'
        MYQR_TAG_ELEMENT_ID = 'elementId'
        MYQR_TAG_ACCESS_VERSION = 'accessVersion'
        MYQR_TAG_CONTENT_REVISION = 'contentRevision'
    }
    foreach ($devVarName in $devVarsMap.Keys) {
        if ($devVars.ContainsKey($devVarName) -and $devVars[$devVarName]) {
            $environment[$devVarsMap[$devVarName]] = $devVars[$devVarName]
        }
    }
    return $environment
}

function Initialize-ApiTestContext {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$EnvironmentPath,
        [Parameter(Mandatory)][ValidateSet('edge-router-local', 'tag-content-local', 'edge-router-staging', 'tag-content-staging')][string]$Collection
    )
    $path = (Resolve-Path -LiteralPath $EnvironmentPath).Path
    $environment = Get-ApiTestEnvironment $path
    $environment = Set-ApiEnvironmentOverrides -Environment $environment -Collection $Collection
    if ($environment.environment -notin @('local', 'staging')) {
        throw "Nicht unterstütztes API-Test-Environment '$($environment.environment)': $path"
    }
    if (-not $environment.baseUrl) { throw "baseUrl fehlt in $path" }
    $uri = [uri]$environment.baseUrl
    $isLoopback = $uri.Host -eq 'localhost'
    if (-not $isLoopback) {
        $address = $null
        $isLoopback = [System.Net.IPAddress]::TryParse($uri.Host, [ref]$address) -and [System.Net.IPAddress]::IsLoopback($address)
    }
    $allowNonLocal = $env:MYQR_API_ALLOW_NONLOCAL -eq '1'
    if ($environment.environment -eq 'local' -and -not $isLoopback) {
        throw "Sicherheitsabbruch: lokales Environment zeigt nicht auf Loopback: $($uri.Host)"
    }
    if ($environment.environment -eq 'staging' -and -not $allowNonLocal) {
        throw 'Staging-Tests benötigen die explizite Freigabe MYQR_API_ALLOW_NONLOCAL=1 (Runner: -AllowNonLocal).'
    }
    if ($environment.environment -eq 'staging' -and $Collection -like 'tag-content-*') {
        foreach ($property in @('tagId', 'tagNumericId')) {
            if ([string]::IsNullOrWhiteSpace([string]$environment[$property])) {
                throw "Staging-Testdaten unvollständig: '$property' muss vor einem API-Aufruf explizit gesetzt werden."
            }
        }
    }
    return [pscustomobject]@{
        Environment = $environment
        EnvironmentPath = $path
        BaseUri = $uri
        Transport = if ($env:MYQR_API_TEST_TRANSPORT) { $env:MYQR_API_TEST_TRANSPORT } else { 'Curl' }
    }
}

function Assert-ApiEqual {
    [CmdletBinding()]
    param([AllowNull()][object]$Actual, [AllowNull()][object]$Expected, [string]$Message = 'Werte stimmen nicht überein.')
    if ($Actual -cne $Expected) { throw "$Message Erwartet: '$Expected'; erhalten: '$Actual'." }
}

function Assert-ApiMatch {
    [CmdletBinding()]
    param([AllowNull()][string]$Actual, [Parameter(Mandatory)][string]$Pattern, [string]$Message = 'Wert entspricht nicht dem erwarteten Muster.')
    if ($Actual -notmatch $Pattern) { throw "$Message Wert: '$Actual'; Muster: '$Pattern'." }
}

function Assert-ApiTrue {
    [CmdletBinding()]
    param([bool]$Condition, [string]$Message = 'Erwartete Bedingung ist nicht erfüllt.')
    if (-not $Condition) { throw $Message }
}

function Assert-ApiGreaterThan {
    [CmdletBinding()]
    param([long]$Actual, [long]$Expected, [string]$Message = 'Wert liegt nicht über der erwarteten Grenze.')
    if ($Actual -le $Expected) { throw "$Message Erwartet > $Expected; erhalten: $Actual." }
}

function Set-ApiEnvironmentOverrides {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][hashtable]$Environment,
        [Parameter(Mandatory)][ValidateSet('edge-router-local', 'tag-content-local', 'edge-router-staging', 'tag-content-staging')][string]$Collection
    )
    if ($Collection -like 'edge-router-*') {
        if ($env:MYQR_CODEC_BASE_URL) { $Environment.baseUrl = $env:MYQR_CODEC_BASE_URL }
        if ($env:MYQR_CODEC_TOKEN) { $Environment.token = $env:MYQR_CODEC_TOKEN }
    }
    else {
        if ($env:MYQR_TAG_CONTENT_BASE_URL) { $Environment.baseUrl = $env:MYQR_TAG_CONTENT_BASE_URL }
        if ($env:MYQR_LOCAL_SEED_KEY) { $Environment.localSeedKey = $env:MYQR_LOCAL_SEED_KEY }
        if ($env:MYQR_BOOTSTRAP_SECRET) { $Environment.bootstrapSecret = $env:MYQR_BOOTSTRAP_SECRET }
        if ($env:MYQR_PUBLISHER_KEY) { $Environment.publisherKey = $env:MYQR_PUBLISHER_KEY }
        if ($env:MYQR_CONTENT_API_KEY) { $Environment.contentApiKey = $env:MYQR_CONTENT_API_KEY }
        if ($env:MYQR_TAG_ID) { $Environment.tagId = $env:MYQR_TAG_ID }
        if ($env:MYQR_TAG_NUMERIC_ID) { $Environment.tagNumericId = $env:MYQR_TAG_NUMERIC_ID }
        if ($env:MYQR_TAG_ELEMENT_ID) { $Environment.elementId = $env:MYQR_TAG_ELEMENT_ID }
    }
    return $Environment
}

function New-PublicBootstrapRequestBody {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$TagId,
        [Parameter(Mandatory)][int]$AccessVersion,
        [Parameter(Mandatory)][int]$Revision,
        [Parameter(Mandatory)][string]$Secret
    )
    if ([string]::IsNullOrWhiteSpace($Secret)) { throw 'bootstrapSecret ist leer.' }
    $nonceBytes = [byte[]]::new(18)
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($nonceBytes)
    $nonce = [Convert]::ToBase64String($nonceBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
    $expiresAt = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() + 50
    $payload = @(
        'myqr24/pwa-bootstrap/v1'
        "tag=$TagId"
        'mode=public'
        "accessVersion=$AccessVersion"
        "revision=$Revision"
        "nonce=$nonce"
        "exp=$expiresAt"
    ) -join "`n"
    $hmac = [System.Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($Secret))
    try { $signatureBytes = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($payload)) }
    finally { $hmac.Dispose() }
    $signature = [Convert]::ToBase64String($signatureBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
    return @{
        mode = 'public'
        accessVersion = $AccessVersion
        revision = $Revision
        nonce = $nonce
        exp = $expiresAt
        sig = $signature
    }
}

Export-ModuleMember -Function ConvertTo-ApiJson, Invoke-ApiRequest, Get-ApiAuthorizationHeaders, Get-ApiBaseUri, Get-ApiTestEnvironment, Initialize-ApiTestContext, Set-ApiEnvironmentOverrides, New-PublicBootstrapRequestBody, Assert-ApiEqual, Assert-ApiMatch, Assert-ApiTrue, Assert-ApiGreaterThan