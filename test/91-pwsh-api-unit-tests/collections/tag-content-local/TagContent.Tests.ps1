#Requires -Version 7.0
#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.0.0' }

BeforeAll {
    $modulePath = Join-Path $PSScriptRoot '..\..\lib\ApiClient.psm1'
    Import-Module $modulePath -Force
    $configPath = if ($env:MYQR_API_TEST_ENVIRONMENT) { $env:MYQR_API_TEST_ENVIRONMENT } else { Join-Path $PSScriptRoot '..\..\environments\tag-content-local.json' }
    $testEnvironmentName = [IO.Path]::GetFileNameWithoutExtension($configPath)
    $context = Initialize-ApiTestContext -EnvironmentPath $configPath -Collection $testEnvironmentName
    $config = $context.Environment
    $baseUri = $context.BaseUri
    $transport = $context.Transport
    $tagPath = "/api/v1/tags/$($config.tagId)"
    $uploadPath = [IO.Path]::GetFullPath((Join-Path (Split-Path $configPath -Parent) $config.uploadFile))

    function Invoke-LocalSeed {
        if ($config.environment -eq 'staging') { return $null }
        if ([string]::IsNullOrWhiteSpace([string]$config.localSeedKey)) { throw 'localSeedKey muss im gewählten Environment gesetzt sein.' }
        $response = Invoke-ApiRequest -Method POST -Uri (Get-ApiBaseUri $baseUri '/api/local/seed') -Headers @{ 'x-myqr24-local-seed' = [string]$config.localSeedKey } -Transport $transport
        if ($response.StatusCode -ne 200 -or $response.Body.seeded -ne $true) {
            throw "Local seed fehlgeschlagen: HTTP $($response.StatusCode) $($response.RawBody)"
        }
        return $response
    }

    function Invoke-PublishTemplate {
        if ([string]::IsNullOrWhiteSpace([string]$config.publisherKey)) { throw 'publisherKey muss im gewählten Environment gesetzt sein.' }
        $body = @{
            tagId = [string]$config.tagId
            tagNumericId = [string]$config.tagNumericId
            tagName = 'Postman-Test-TAG'
            template = $config.publishTemplate
        }
        return Invoke-ApiRequest -Method PUT -Uri (Get-ApiBaseUri $baseUri "$tagPath/content") -Headers (Get-ApiAuthorizationHeaders ([string]$config.publisherKey)) -Body $body -Transport $transport
    }

    function New-AuthorizedSession {
        if ([string]::IsNullOrWhiteSpace([string]$config.publisherKey)) { throw 'publisherKey muss gesetzt sein, um die aktuelle Content-Revision abzurufen.' }
        $document = Invoke-ApiRequest -Method GET -Uri (Get-ApiBaseUri $baseUri "$tagPath/content/document") -Headers (Get-ApiAuthorizationHeaders ([string]$config.publisherKey)) -Transport $transport
        if ($document.StatusCode -ne 200 -or $document.Body.tagId -ne $config.tagId) {
            throw "Dokument für Bootstrap nicht lesbar: HTTP $($document.StatusCode) $($document.RawBody)"
        }
        $revision = 0
        if (-not [int]::TryParse([string]$document.Headers['x-content-revision'], [ref]$revision) -or $revision -lt 1) {
            throw 'Dokumentantwort enthält keine gültige X-Content-Revision.'
        }
        $bootstrap = New-PublicBootstrapRequestBody -TagId ([string]$config.tagId) -AccessVersion ([int]$config.accessVersion) -Revision $revision -Secret ([string]$config.bootstrapSecret)
        $response = Invoke-ApiRequest -Method POST -Uri (Get-ApiBaseUri $baseUri "$tagPath/access/public") -Headers @{ 'Content-Type' = 'application/json' } -Body $bootstrap -Transport $transport
        if ($response.StatusCode -ne 200 -or -not $response.Headers['set-cookie']) {
            throw "Public-Bootstrap fehlgeschlagen: HTTP $($response.StatusCode) $($response.RawBody)"
        }
        $cookie = [regex]::Match([string]$response.Headers['set-cookie'], 'myqr24_tag_access=[^;]+').Value
        if (-not $cookie) { throw 'Public-Bootstrap-Antwort enthält kein myqr24_tag_access-Cookie.' }
        return $cookie
    }
}

Describe 'TAG Content – Seed local TAG' {
    It 'setzt den lokalen Test-TAG wie im Postman Local Setup zurück' {
        if ($config.environment -eq 'staging') {
            Set-ItResult -Skipped -Because 'Der Seed-Endpunkt existiert nur in der lokalen app-api.local-Variante.'
            return
        }
        $response = Invoke-LocalSeed
        Assert-ApiEqual $response.StatusCode 200 'Seed muss HTTP 200 liefern.'
        Assert-ApiEqual $response.Body.seeded $true 'Seed muss seeded=true bestätigen.'
    }
}

Describe 'TAG Content – Get current published document' {
    It 'liest das aktuelle veröffentlichte Dokument und prüft TAG-ID und Revision' {
        Invoke-LocalSeed | Out-Null
        $response = Invoke-ApiRequest -Method GET -Uri (Get-ApiBaseUri $baseUri "$tagPath/content/document") -Headers (Get-ApiAuthorizationHeaders ([string]$config.publisherKey)) -Transport $transport
        Assert-ApiEqual $response.StatusCode 200 'Dokument muss HTTP 200 liefern.'
        Assert-ApiEqual $response.Body.tagId $config.tagId 'TAG-ID der Dokumentantwort.'
        Assert-ApiEqual $response.Headers['x-content-revision'] ([string]$config.contentRevision) 'Content-Revision.'
    }
}

Describe 'TAG Content – Publish test template' {
    It 'publiziert das Postman-Testtemplate und erhält eine Revision' {
        Invoke-LocalSeed | Out-Null
        $response = Invoke-PublishTemplate
        Assert-ApiTrue ([int]$response.StatusCode -in @(200, 201)) 'Publish muss HTTP 200 oder 201 liefern.'
        Assert-ApiGreaterThan ([long]$response.Body.revision) 0 'Publish muss eine positive Revision liefern.'
    }
}

Describe 'TAG Content – Get published document after publish' {
    It 'liest nach einem Publish das Dokument mit weiterhin vorhandener Galerie' {
        Invoke-LocalSeed | Out-Null
        $publish = Invoke-PublishTemplate
        Assert-ApiTrue ([int]$publish.StatusCode -in @(200, 201)) 'Publish muss HTTP 200 oder 201 liefern.'
        $response = Invoke-ApiRequest -Method GET -Uri (Get-ApiBaseUri $baseUri "$tagPath/content/document") -Headers (Get-ApiAuthorizationHeaders ([string]$config.publisherKey)) -Transport $transport
        Assert-ApiEqual $response.StatusCode 200 'Dokument nach Publish muss HTTP 200 liefern.'
        $gallery = @($response.Body.elements | Where-Object { $_.elementId -eq 'cel_gallery' })
        Assert-ApiEqual $gallery.Count 1 'Galerieelement muss erhalten bleiben.'
    }
}

Describe 'TAG Content – Create signed public bootstrap' {
    It 'autorisiert Public-Zugang und liefert das Session-Cookie' {
        Invoke-LocalSeed | Out-Null
        $cookie = New-AuthorizedSession
        Assert-ApiMatch $cookie '^myqr24_tag_access=.+$' 'Session-Cookie fehlt.'
    }
}

Describe 'TAG Content – Get runtime content' {
    It 'lädt Runtime-Content mit Session-Cookie und enthält die Galerie' {
        Invoke-LocalSeed | Out-Null
        $cookie = New-AuthorizedSession
        $response = Invoke-ApiRequest -Method GET -Uri (Get-ApiBaseUri $baseUri "$tagPath/content?items=true") -Headers @{ Cookie = $cookie } -Transport $transport
        Assert-ApiEqual $response.StatusCode 200 'Runtime-Content muss HTTP 200 liefern.'
        $gallery = @($response.Body.elements | Where-Object { $_.id -eq 'cel_gallery' })
        Assert-ApiEqual $gallery.Count 1 'Runtime muss die Galerie enthalten.'
    }
}

Describe 'TAG Content – Upload, read and delete image' {
    It 'lädt das Original per Multipart hoch, liest es und löscht Item und Varianten' {
        if ([string]::IsNullOrWhiteSpace([string]$config.contentApiKey)) { throw 'contentApiKey muss im gewählten Environment gesetzt sein.' }
        if (-not (Test-Path -LiteralPath $uploadPath -PathType Leaf)) { throw "Upload-Testbild fehlt: $uploadPath" }
        Invoke-LocalSeed | Out-Null
        $cookie = New-AuthorizedSession
        $headers = Get-ApiAuthorizationHeaders ([string]$config.contentApiKey)
        $upload = Invoke-ApiRequest -Method POST -Uri (Get-ApiBaseUri $baseUri "$tagPath/elements/$($config.elementId)/items") -Headers $headers -Files @{ original = $uploadPath } -Transport $transport
        Assert-ApiEqual $upload.StatusCode 201 'Upload muss HTTP 201 liefern.'
        Assert-ApiMatch ([string]$upload.Body.contentId) '^[1-9][0-9]{0,15}$' 'Content-ID ist ungültig.'
        Assert-ApiTrue ($null -ne $upload.Body.variants) 'Upload-Antwort muss variants enthalten.'
        Assert-ApiEqual $upload.Body.variants.Count 0 'In diesem Test sind keine Varianten aktiviert.'

        $contentId = [string]$upload.Body.contentId
        $media = Invoke-ApiRequest -Method GET -Uri (Get-ApiBaseUri $baseUri "$tagPath/items/$contentId/media") -Headers @{ Cookie = $cookie } -Transport $transport
        Assert-ApiEqual $media.StatusCode 200 'Originalmedium muss HTTP 200 liefern.'
        Assert-ApiMatch $media.Headers['content-type'] '^image/(jpeg|png|gif|webp)' 'MIME-Typ ist kein unterstütztes Bild.'

        $deleted = Invoke-ApiRequest -Method DELETE -Uri (Get-ApiBaseUri $baseUri "$tagPath/items/$contentId") -Headers $headers -Transport $transport
        Assert-ApiEqual $deleted.StatusCode 200 'Löschen muss HTTP 200 liefern.'
        Assert-ApiEqual $deleted.Body.contentId $contentId 'Gelöschte Content-ID stimmt nicht.'
    }
}
