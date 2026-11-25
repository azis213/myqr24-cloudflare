#Requires -Version 7.0
#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.0.0' }

BeforeAll {
    $modulePath = Join-Path $PSScriptRoot 'ApiClient.psm1'
    Import-Module $modulePath -Force
}

Describe 'API Client helpers' {
    It 'serialisiert ein Request-Objekt als kompaktes JSON' {
        $json = ConvertTo-ApiJson @{ method = 'POST'; enabled = $true }
        $parsed = ConvertFrom-Json -InputObject $json -AsHashtable
        Assert-ApiEqual $parsed.method 'POST'
        Assert-ApiEqual $parsed.enabled $true
    }

    It 'baut eine REST-URL aus Base-URL und Pfad' {
        $uri = Get-ApiBaseUri 'http://127.0.0.1:8787' '/api/v1/tags/ab12cd/content'
        Assert-ApiEqual $uri.AbsoluteUri 'http://127.0.0.1:8787/api/v1/tags/ab12cd/content'
    }

    It 'formatiert Authorization als Bearer-Header' {
        $headers = Get-ApiAuthorizationHeaders 'local-test-token'
        Assert-ApiEqual $headers.Authorization 'Bearer local-test-token'
    }

    It 'erzeugt einen Bootstrap-Body mit Base64URL-Nonce und Signatur' {
        $body = New-PublicBootstrapRequestBody -TagId 'ab12cd' -AccessVersion 1 -Revision 8 -Secret 'local-bootstrap-secret'
        Assert-ApiEqual $body.mode 'public'
        Assert-ApiEqual $body.accessVersion 1
        Assert-ApiEqual $body.revision 8
        Assert-ApiMatch ([string]$body.nonce) '^[A-Za-z0-9_-]{24}$'
        Assert-ApiMatch ([string]$body.sig) '^[A-Za-z0-9_-]{43}$'
        Assert-ApiGreaterThan ([long]$body.exp) ([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())
    }

    It 'lädt verfügbare lokale Secrets aus apps/tag-app/.dev.vars und apps/edge-router/.dev.vars' {
        $environmentRoot = Join-Path $PSScriptRoot '..\environments'
        $tagApp = Get-ApiTestEnvironment (Join-Path $environmentRoot 'tag-content-local.json')
        $codec = Get-ApiTestEnvironment (Join-Path $environmentRoot 'edge-router-local.json')
        Assert-ApiTrue (-not [string]::IsNullOrWhiteSpace([string]$tagApp.localSeedKey)) 'APP_LOCAL_SEED_KEY wurde nicht geladen.'
        Assert-ApiTrue (-not [string]::IsNullOrWhiteSpace([string]$tagApp.bootstrapSecret)) 'APP_BOOTSTRAP_SECRET_S01 wurde nicht geladen.'
        Assert-ApiTrue (-not [string]::IsNullOrWhiteSpace([string]$tagApp.contentApiKey)) 'TAG_CONTENT_API_KEY_S01 wurde nicht geladen.'
        Assert-ApiTrue (-not [string]::IsNullOrWhiteSpace([string]$codec.token)) 'TAG_CODEC_API_KEY_S01 wurde nicht geladen.'
    }

    It 'definiert ein getrenntes, explizit als staging markiertes Environment' {
        $environmentRoot = Join-Path $PSScriptRoot '..\environments'
        $staging = Get-ApiTestEnvironment (Join-Path $environmentRoot 'tag-content-staging.json')
        Assert-ApiEqual $staging.environment 'staging'
        Assert-ApiTrue (([uri]$staging.baseUrl).IsAbsoluteUri) 'Staging baseUrl muss absolut sein.'
        Assert-ApiTrue ([string]::IsNullOrWhiteSpace([string]$staging.tagId)) 'Staging-TAG-ID muss vor der Nutzung explizit gesetzt werden.'
    }
}
