#Requires -Version 7.0
#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.0.0' }

BeforeAll {
    Set-StrictMode -Version Latest
    $ErrorActionPreference = 'Stop'

    # Manuell auszuführender, zustandsverändernder Publish-Test.
    # Standardmäßig wird das lokale Environment-Template verwendet.
    # Für ein anderes Ziel/Template diese Werte vor dem Start anpassen.
    $script:PublishEnvironmentName = 'tag-content-local' # tag-content-local oder tag-content-staging
    $script:TagIdOverride = ''                           # leer = Wert aus Environment/.dev.vars
    $script:TagNumericIdOverride = ''                    # leer = Wert aus Environment/.dev.vars
    $script:TemplatePath = ''                            # leer = beim Test nachfragen; Enter nimmt Environment-Template
    $script:TagNameOverride = ''                         # optional; leer = template.name
    $script:ExpectedRevision = $null                     # optional positive Revision als Compare-and-swap

    $repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
    $modulePath = Join-Path $PSScriptRoot '..\lib\ApiClient.psm1'
    Import-Module $modulePath -Force

    if ($script:PublishEnvironmentName -notin @('tag-content-local', 'tag-content-staging')) {
        throw "Nicht unterstütztes Publish-Environment '$($script:PublishEnvironmentName)'. Erlaubt: tag-content-local oder tag-content-staging."
    }

    $environmentPath = Join-Path $PSScriptRoot "..\environments\$($script:PublishEnvironmentName).json"
    $environment = Get-ApiTestEnvironment $environmentPath
    $environment = Set-ApiEnvironmentOverrides -Environment $environment -Collection $script:PublishEnvironmentName

    if (-not [string]::IsNullOrWhiteSpace($script:TagIdOverride)) { $environment.tagId = $script:TagIdOverride.Trim() }
    if (-not [string]::IsNullOrWhiteSpace($script:TagNumericIdOverride)) { $environment.tagNumericId = $script:TagNumericIdOverride.Trim() }

    if ($environment.environment -notin @('local', 'staging')) {
        throw "Nicht unterstützter Environment-Typ '$($environment.environment)'."
    }
    if (-not $environment.baseUrl) { throw 'baseUrl fehlt im gewählten Environment.' }

    $baseUri = [uri]$environment.baseUrl
    $isLoopback = $baseUri.Host -eq 'localhost'
    if (-not $isLoopback) {
        $address = $null
        $isLoopback = [System.Net.IPAddress]::TryParse($baseUri.Host, [ref]$address) -and [System.Net.IPAddress]::IsLoopback($address)
    }
    if ($environment.environment -eq 'local' -and -not $isLoopback) {
        throw "Sicherheitsabbruch: lokales Publish-Environment zeigt nicht auf Loopback ($($baseUri.Host))."
    }
    if ($environment.environment -eq 'staging' -and $env:MYQR_API_ALLOW_NONLOCAL -ne '1') {
        throw 'Staging-Publish ist gesperrt. Erst nach bewusster Freigabe MYQR_API_ALLOW_NONLOCAL=1 setzen.'
    }

    if ([string]$environment.tagId -notmatch '^(?:[0-9a-z]{6}|[0-9a-z]{8}|[0-9a-z]{10})$') {
        throw 'tagId fehlt oder ist ungültig. Setze $TagIdOverride oder MYQR_TAG_ID.'
    }
    if ([string]$environment.tagNumericId -notmatch '^[1-9][0-9]{0,15}$') {
        throw 'tagNumericId fehlt oder ist ungültig. Setze $TagNumericIdOverride oder MYQR_TAG_NUMERIC_ID.'
    }
    if ([string]::IsNullOrWhiteSpace([string]$environment.publisherKey)) {
        throw 'Publisher-Key fehlt. APP_CONTENT_PUBLISH_KEY_S01 in apps/tag-app/.dev.vars setzen.'
    }

    $script:publishEnvironment = $environment
    $script:publishEnvironmentPath = (Resolve-Path -LiteralPath $environmentPath).Path
    $script:publishBaseUri = $baseUri
    $script:publishTransport = if ($env:MYQR_API_TEST_TRANSPORT) { $env:MYQR_API_TEST_TRANSPORT } else { 'Curl' }
    $script:publishRepositoryRoot = $repositoryRoot

    if ($null -ne $script:ExpectedRevision -and ([int]$script:ExpectedRevision -lt 1)) {
        throw 'ExpectedRevision muss, falls gesetzt, eine positive Ganzzahl sein.'
    }
}

Describe 'TAG Content – manuell veröffentlichen' {
    It 'veröffentlicht das ausgewählte vollständige Template für den angegebenen TAG' {
        $selectedTemplatePath = [string]$script:TemplatePath
        if ([string]::IsNullOrWhiteSpace($selectedTemplatePath)) {
            $selectedTemplatePath = Read-Host 'Template-Dateipfad eingeben oder Enter für das Template aus dem Environment-JSON'
        }

        if ([string]::IsNullOrWhiteSpace($selectedTemplatePath)) {
            $template = $script:publishEnvironment.publishTemplate
            $templateSource = "Environment: $($script:publishEnvironmentPath)"
        }
        else {
            $candidatePath = $selectedTemplatePath.Trim().Trim('"')
            if (-not [IO.Path]::IsPathRooted($candidatePath)) {
                $candidatePath = Join-Path $script:publishRepositoryRoot $candidatePath
            }
            if (-not (Test-Path -LiteralPath $candidatePath -PathType Leaf)) {
                throw "Template-Datei nicht gefunden: $candidatePath"
            }
            $resolvedTemplatePath = (Resolve-Path -LiteralPath $candidatePath).Path
            $templateBytes = [IO.File]::ReadAllBytes($resolvedTemplatePath)
            if ($templateBytes.Length -gt 131072) { throw 'Template-Datei überschreitet das API-Limit von 128 KiB.' }
            $templateJson = [Text.Encoding]::UTF8.GetString($templateBytes)
            $template = ConvertFrom-Json -InputObject $templateJson -AsHashtable -Depth 100 -ErrorAction Stop
            $templateSource = $resolvedTemplatePath
        }

        if (-not $template -or $template -isnot [System.Collections.IDictionary]) {
            throw 'Template muss ein vollständiges JSON-Objekt sein.'
        }
        if ($template.schema -ne 'myqr24-tag-content-template-v1' -or $template.schemaVersion -ne 3) {
            throw 'Template muss schema "myqr24-tag-content-template-v1" und schemaVersion 3 verwenden.'
        }
        if (-not $template.template -or [string]::IsNullOrWhiteSpace([string]$template.template.name)) {
            throw 'template.name fehlt im ausgewählten Template.'
        }

        $tagId = [string]$script:publishEnvironment.tagId
        $tagNumericId = [string]$script:publishEnvironment.tagNumericId
        $tagName = if ([string]::IsNullOrWhiteSpace($script:TagNameOverride)) { [string]$template.template.name } else { $script:TagNameOverride.Trim() }
        $requestBody = @{
            tagId = $tagId
            tagNumericId = $tagNumericId
            tagName = $tagName
            template = $template
        }
        if ($null -ne $script:ExpectedRevision) { $requestBody.expectedRevision = [int]$script:ExpectedRevision }

        Write-Host ''
        Write-Host 'Publish-Ziel (vollständiger PUT; veröffentlichter Content wird ersetzt):' -ForegroundColor Yellow
        Write-Host "Environment : $($script:publishEnvironment.name) ($($script:publishEnvironment.environment))"
        Write-Host "API         : $($script:publishBaseUri.AbsoluteUri)"
        Write-Host "TAG-ID      : $tagId"
        Write-Host "Numerische ID: $tagNumericId"
        Write-Host "TAG-Name    : $tagName"
        Write-Host "Template    : $($template.template.templateId) – $($template.template.name)"
        Write-Host "Quelle      : $templateSource"
        if ($null -ne $script:ExpectedRevision) { Write-Host "Erwartete Revision: $($script:ExpectedRevision)" }
        if ($script:publishEnvironment.environment -eq 'staging') {
            Write-Host 'ACHTUNG: Das ist ein schreibender Staging-Aufruf.' -ForegroundColor Red
        }

        $confirmation = Read-Host "Zum Veröffentlichen exakt 'PUBLISH $tagId' eingeben; alles andere bricht ab"
        if ($confirmation -cne "PUBLISH $tagId") {
            Write-Host 'Publish abgebrochen; es wurde kein API-Aufruf ausgeführt.' -ForegroundColor Yellow
            Set-ItResult -Skipped -Because 'Publish wurde nicht exakt bestätigt.'
            return
        }

        $uri = Get-ApiBaseUri $script:publishBaseUri "/api/v1/tags/$tagId/content"
        $response = Invoke-ApiRequest -Method PUT -Uri $uri `
            -Headers (Get-ApiAuthorizationHeaders ([string]$script:publishEnvironment.publisherKey)) `
            -Body $requestBody -Transport $script:publishTransport

        Write-Host "`nPublish-Antwort (HTTP $($response.StatusCode)):`n$($response | ConvertTo-Json -Depth 100)" -ForegroundColor Cyan
        Assert-ApiTrue ([int]$response.StatusCode -in @(200, 201)) "Publish fehlgeschlagen: HTTP $($response.StatusCode) $($response.RawBody)"
        Assert-ApiEqual $response.Body.tagId $tagId 'Antwort-TAG-ID stimmt nicht mit dem Ziel überein.'
        Assert-ApiEqual ([string]$response.Body.tagNumericId) $tagNumericId 'Antwort-Numeric-ID stimmt nicht mit dem Ziel überein.'
        Assert-ApiGreaterThan ([long]$response.Body.revision) 0 'Publish-Antwort enthält keine gültige Revision.'
    }
}