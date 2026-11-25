#Requires -Version 7.0
#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.0.0' }

BeforeAll {
    $modulePath = Join-Path $PSScriptRoot '..\..\lib\ApiClient.psm1'
    Import-Module $modulePath -Force
    $configPath = if ($env:MYQR_API_TEST_ENVIRONMENT) { $env:MYQR_API_TEST_ENVIRONMENT } else { Join-Path $PSScriptRoot '..\..\environments\edge-router-local.json' }
    $testEnvironmentName = [IO.Path]::GetFileNameWithoutExtension($configPath)
    $context = Initialize-ApiTestContext -EnvironmentPath $configPath -Collection $testEnvironmentName
    $config = $context.Environment

    function Invoke-CodecApiRequest {
        param([string]$Path, [object]$Body)
        if ([string]::IsNullOrWhiteSpace([string]$config.token)) {
            throw 'Codec-Token fehlt: in environments/edge-router-local.json oder MYQR_CODEC_TOKEN setzen.'
        }
        return Invoke-ApiRequest -Method POST -Uri (Get-ApiBaseUri $context.BaseUri $Path) -Headers (Get-ApiAuthorizationHeaders ([string]$config.token)) -Body $Body -Transport $context.Transport
    }
}

Describe 'Edge Router – Encode' {
    It 'liefert die kodierte TAG-ID für den Postman-Encode-Request' {
        $body = $config.requests.encode
        Write-Host "`nRequest Body:`n$($body | ConvertTo-Json -Depth 20)" -ForegroundColor Cyan
        $response = Invoke-CodecApiRequest '/api/v1/codec/encode' $body
        Write-Host "`nResponse:`n$($response | ConvertTo-Json -Depth 20)" -ForegroundColor DarkGray
        Assert-ApiEqual $response.StatusCode 200 'Encode muss HTTP 200 liefern.'
        Assert-ApiEqual $response.Body.codecVersion 'S01'
        Assert-ApiEqual $response.Body.tag.length 10
        Assert-ApiEqual $response.Body.tag.value $body.value
        Assert-ApiMatch ([string]$response.Body.tag.id) '^[0-9a-z]{10}$'
    }
}

Describe 'Edge Router – Encode Batch' {
    It 'liefert die zehn Postman-Testwerte geordnet und vollständig' {
        $body = $config.requests.encodeBatch
        Write-Host "`nRequest Body:`n$($body | ConvertTo-Json -Depth 20)" -ForegroundColor Cyan
        $response = Invoke-CodecApiRequest '/api/v1/codec/encode-batch' $body
        Write-Host "`nResponse:`n$($response | ConvertTo-Json -Depth 20)" -ForegroundColor DarkGray
        Assert-ApiEqual $response.StatusCode 200 'Encode-Batch muss HTTP 200 liefern.'
        Assert-ApiEqual $response.Body.codecVersion 'S01'
        Assert-ApiEqual $response.Body.tags.Count $body.values.Count
        for ($index = 0; $index -lt $body.values.Count; $index++) {
            Assert-ApiEqual $response.Body.tags[$index].value $body.values[$index]
            Assert-ApiMatch ([string]$response.Body.tags[$index].id) '^[0-9a-z]{10}$'
        }
    }
}

Describe 'Edge Router – Decode' {
    It 'dekodiert die in Postman konfigurierte zehnstellige TAG-ID' {
        $body = $config.requests.decode
        Write-Host "`nRequest Body:`n$($body | ConvertTo-Json -Depth 20)" -ForegroundColor Cyan
        $response = Invoke-CodecApiRequest '/api/v1/codec/decode' $body
        Write-Host "`nResponse:`n$($response | ConvertTo-Json -Depth 20)" -ForegroundColor DarkGray
        Assert-ApiEqual $response.StatusCode 200 'Decode muss HTTP 200 liefern.'
        Assert-ApiEqual $response.Body.codecVersion 'S01'
        Assert-ApiEqual $response.Body.tag.id $body.tagId
        Assert-ApiEqual $response.Body.tag.length 10
        Assert-ApiMatch ([string]$response.Body.tag.value) '^[0-9]{1,16}$'
    }
}
