Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function New-LocalSecret {
    param([Parameter(Mandatory = $true)][string]$Prefix)

    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $rng.GetBytes($bytes)
    }
    finally {
        $rng.Dispose()
    }
    return "$Prefix-$([Convert]::ToHexString($bytes).ToLowerInvariant())"
}

function Read-LocalEnvironment {
    param([Parameter(Mandatory = $true)][string]$EnvironmentFile)

    $values = @{}
    foreach ($line in Get-Content -LiteralPath $EnvironmentFile) {
        if ($line -match '^\s*#' -or $line -notmatch '^\s*([A-Za-z0-9_]+)=(.*)$') {
            continue
        }
        $name = $Matches[1]
        $value = $Matches[2].Trim()
        $values[$name] = $value
    }
    return $values
}

function Set-LocalEnvironmentDefaults {
    param([Parameter(Mandatory = $true)][string]$EnvironmentFile)

    $lines = [System.Collections.Generic.List[string]]::new()
    foreach ($line in Get-Content -LiteralPath $EnvironmentFile) {
        $lines.Add($line)
    }

    $defaults = [ordered]@{
        LOCAL_TCP_PORT                    = '8080'
        LOCAL_TCC_PORT                    = '5174'
        LOCAL_TAG_APP_PORT                = '5173'
        LOCAL_TAG_APP_PWA_PORT            = '4174'
        LOCAL_TAG_APP_BIND_ADDRESS        = '0.0.0.0'
        LOCAL_TAG_APP_API_PORT            = '8787'
        LOCAL_MEDIA_SIGNER_PORT           = '8789'
        LOCAL_EDGE_ROUTER_PORT            = '8786'
        LOCAL_CODEC_PORT                  = '8788'
        LOCAL_APP_BOOTSTRAP_SECRET        = (New-LocalSecret 'local-bootstrap')
        LOCAL_APP_PIN_PEPPER              = (New-LocalSecret 'local-pin-pepper')
        LOCAL_APP_MEDIA_SIGNER_KEY        = (New-LocalSecret 'local-media-signer')
        LOCAL_APP_LOCAL_SEED_KEY          = (New-LocalSecret 'local-seed')
        LOCAL_EDGE_FEISTEL_SECRET         = (New-LocalSecret 'local-edge-feistel')
        LOCAL_EDGE_REDIRECT_SIGNING_SECRET = (New-LocalSecret 'local-edge-redirect')
    }

    foreach ($name in $defaults.Keys) {
        $pattern = '^\s*' + [regex]::Escape($name) + '=(.*)$'
        $found = $false
        for ($index = 0; $index -lt $lines.Count; $index++) {
            if ($lines[$index] -match $pattern) {
                $found = $true
                if ([string]::IsNullOrWhiteSpace($Matches[1])) {
                    $lines[$index] = "$name=$($defaults[$name])"
                }
                break
            }
        }
        if (-not $found) {
            $lines.Add("$name=$($defaults[$name])")
        }
    }

    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllLines($EnvironmentFile, $lines, $encoding)
}

function Set-LocalDevVars {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][hashtable]$Updates
    )

    $lines = [System.Collections.Generic.List[string]]::new()
    if (Test-Path -LiteralPath $Path -PathType Leaf) {
        foreach ($line in Get-Content -LiteralPath $Path) {
            $lines.Add($line)
        }
    }

    foreach ($name in $Updates.Keys) {
        $pattern = '^\s*' + [regex]::Escape($name) + '='
        $found = $false
        for ($index = 0; $index -lt $lines.Count; $index++) {
            if ($lines[$index] -match $pattern) {
                $lines[$index] = "$name=$($Updates[$name])"
                $found = $true
                break
            }
        }
        if (-not $found) {
            $lines.Add("$name=$($Updates[$name])")
        }
    }

    $directory = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $directory -PathType Container)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllLines($Path, $lines, $encoding)
}

function New-CloudflareSeedSql {
    param(
        [Parameter(Mandatory = $true)][string]$SeedRoot,
        [Parameter(Mandatory = $true)][string]$OutputFile,
        [Parameter(Mandatory = $true)][string]$RoutingOutputFile
    )

    $tagFile = Join-Path $SeedRoot 'r2\tag-rev8.json'
    $elementFile = Join-Path $SeedRoot 'r2\element-rev8.json'
    $coverFile = Join-Path $SeedRoot 'r2\cover.svg'

    foreach ($file in @($tagFile, $elementFile, $coverFile)) {
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
            throw "Missing seed file: $file"
        }
    }

    $tagHash = (Get-FileHash -LiteralPath $tagFile -Algorithm SHA256).Hash.ToLowerInvariant()
    $elementHash = (Get-FileHash -LiteralPath $elementFile -Algorithm SHA256).Hash.ToLowerInvariant()
    $coverHash = (Get-FileHash -LiteralPath $coverFile -Algorithm SHA256).Hash.ToLowerInvariant()
    $tagBytes = (Get-Item -LiteralPath $tagFile).Length
    $elementBytes = (Get-Item -LiteralPath $elementFile).Length
    $coverBytes = (Get-Item -LiteralPath $coverFile).Length
    $now = '2026-11-17T00:00:00.000Z'

    $sql = @"
DELETE FROM tag_content_element_items WHERE tag_numeric_id = 623187229;
DELETE FROM tag_content_media_variants WHERE content_id = 1850000000000000;
DELETE FROM tag_content_items WHERE content_id = 1850000000000000;
DELETE FROM tag_content_elements WHERE tag_numeric_id = 623187229;
DELETE FROM tag_content WHERE tag_numeric_id = 623187229;
DELETE FROM tag_routing WHERE tag_id = 'ab12cd';

INSERT INTO tag_routing (
  tag_id, status, target_type, protection_mode, access_version,
  content_revision, schema_version, updated_at
) VALUES (
  'ab12cd', 'active', 'internal', 'public', 1, 8, 1, '$now'
);

INSERT INTO tag_content (
  tag_numeric_id, tag_base36_id, content_revision, schema_version,
  content_file, content_sha256, content_bytes, content_type,
  published_at, updated_at
) VALUES (
  623187229, 'ab12cd', 8, 1, 'tag-rev8.json', '$tagHash',
  $tagBytes, 'application/json', '$now', '$now'
);

INSERT INTO tag_content_elements (
  tag_numeric_id, content_element_id, content_element_type, display_order,
  content_file, content_sha256, content_bytes, content_type, visibility
) VALUES (
  623187229, 'cel_gallery', 'gallery', 0, 'element-rev8.json',
  '$elementHash', $elementBytes, 'application/json', 'public'
);

INSERT INTO tag_content_items (
  content_id, content_item_type, scope, owner_tag_numeric_id,
  owner_tag_base36_id, title, alt_text, original_filename, filename_key,
  status, created_at, updated_at, revoked_at
) VALUES (
  1850000000000000, 'image', 'tag', 623187229, 'ab12cd',
  'Lokales Testbild', 'Lokales Testbild aus der Docker-Testumgebung',
  'testbild.svg', 'testbild.svg', 'ready', '$now', '$now', NULL
);

INSERT INTO tag_content_element_items (
  tag_numeric_id, content_element_id, content_id, item_scope,
  filename_key, display_order, visibility
) VALUES (
  623187229, 'cel_gallery', 1850000000000000, 'tag',
  'testbild.svg', 0, 'public'
);

INSERT INTO tag_content_media_variants (
  content_id, variant, content_type, byte_size, sha256,
  width, height, duration_ms, created_at
) VALUES (
  1850000000000000, 'cover', 'image/svg+xml', $coverBytes, '$coverHash',
  64, 64, NULL, '$now'
);
"@

    $directory = Split-Path -Parent $OutputFile
    if (-not (Test-Path -LiteralPath $directory -PathType Container)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($OutputFile, $sql, $encoding)

    $routingSql = @"
DELETE FROM tag_routing WHERE tag_id = 'ab12cd';
INSERT INTO tag_routing (
  tag_id, status, target_type, protection_mode, access_version,
  content_revision, schema_version, updated_at
) VALUES (
  'ab12cd', 'active', 'internal', 'public', 1, 8, 1, '$now'
);
"@
    $routingDirectory = Split-Path -Parent $RoutingOutputFile
    if (-not (Test-Path -LiteralPath $routingDirectory -PathType Container)) {
        New-Item -ItemType Directory -Path $routingDirectory -Force | Out-Null
    }
    [System.IO.File]::WriteAllText($RoutingOutputFile, $routingSql, $encoding)
}

function Initialize-LocalCloudflareStateVolume {
    param([Parameter(Mandatory = $true)][string]$VolumeName)

    & docker volume create $VolumeName | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker volume $VolumeName could not be created."
    }
    & docker run --rm -v "${VolumeName}:/data" alpine sh -c "mkdir -p /data/tag-app-api/v3 /data/tag-media-signer/v3 /data/edge-router/v3 /data/registry"
    if ($LASTEXITCODE -ne 0) {
        throw "Docker volume $VolumeName could not be initialized."
    }
}

function Remove-LocalCloudflareStateVolume {
    param([Parameter(Mandatory = $true)][string]$VolumeName)

    $existing = & docker volume ls --filter "name=^$([regex]::Escape($VolumeName))$" --format '{{.Name}}'
    if ($existing -ne $VolumeName) {
        return
    }

    & docker volume rm --force $VolumeName 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Cloudflare state volume $VolumeName could not be removed. Stop and remove the Cloudflare services first."
    }
}

function Invoke-LocalCompose {
    param(
        [Parameter(Mandatory = $true)][string]$RepositoryRoot,
        [Parameter(Mandatory = $true)][string]$EnvironmentFile,
        [Parameter(Mandatory = $true)][string]$ComposeFile,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    Push-Location $RepositoryRoot
    try {
        $composeArguments = @(
            'compose',
            '--env-file', $EnvironmentFile,
            '-f', $ComposeFile
        ) + $Arguments
        & docker @composeArguments
        if ($LASTEXITCODE -ne 0) {
            throw "docker compose failed: $($Arguments -join ' ')"
        }
    }
    finally {
        Pop-Location
    }
}

function Wait-LocalTcpPort {
    param(
        [Parameter(Mandatory = $true)][int]$Port,
        [int]$TimeoutSeconds = 180
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        $client = New-Object System.Net.Sockets.TcpClient
        try {
            $client.Connect('127.0.0.1', $Port)
            $client.Close()
            return
        }
        catch {
            $client.Dispose()
        }
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)

    throw "Local port $Port did not become ready within $TimeoutSeconds seconds."
}

function Stop-LocalCloudflareServices {
    param(
        [Parameter(Mandatory = $true)][string]$RepositoryRoot,
        [Parameter(Mandatory = $true)][string]$EnvironmentFile,
        [Parameter(Mandatory = $true)][string]$ComposeFile
    )

    try {
        Invoke-LocalCompose -RepositoryRoot $RepositoryRoot -EnvironmentFile $EnvironmentFile -ComposeFile $ComposeFile `
            -Arguments @('--profile', 'cloudflare', 'rm', '-sf', 'tag-app-api', 'tag-media-signer', 'edge-router')
    }
    catch {
        Write-Warning "Cloudflare test services could not be stopped cleanly: $($_.Exception.Message)"
    }
}

function Invoke-LocalCodecSmoke {
    param(
        [Parameter(Mandatory = $true)][int]$CodecPort,
        [Parameter(Mandatory = $true)][string]$ApiKey
    )

    if ([string]::IsNullOrWhiteSpace($ApiKey)) {
        throw 'LOCAL_CODEC_API_KEY is empty; the Codec API requires Bearer authentication.'
    }

    $headers = @{ Authorization = "Bearer $ApiKey" }
    $body = @{ tagId = 'ab12cd' } | ConvertTo-Json -Compress
    $response = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:$CodecPort/api/v1/codec/decode" `
        -Headers $headers -ContentType 'application/json' -Body $body -TimeoutSec 30

    if ($response.codecVersion -ne 'S01' -or [string]::IsNullOrWhiteSpace($response.tag.id)) {
        throw 'The local Codec API returned an unexpected decode response.'
    }
}

function Invoke-LocalAppApiSeed {
    param(
        [Parameter(Mandatory = $true)][int]$ApiPort,
        [Parameter(Mandatory = $true)][string]$SeedKey
    )

    $headers = @{ 'x-myqr24-local-seed' = $SeedKey }
    $response = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:$ApiPort/api/local/seed" -Headers $headers -TimeoutSec 60
    if (-not $response.ok) {
        throw 'The local Application API seed endpoint did not confirm the seed.'
    }
}

function Install-CloudflareSeed {
    param(
        [Parameter(Mandatory = $true)][string]$RepositoryRoot,
        [Parameter(Mandatory = $true)][string]$EnvironmentFile,
        [Parameter(Mandatory = $true)][string]$ComposeFile,
        [Parameter(Mandatory = $true)][string]$RoutingSqlFile
    )

    Invoke-LocalCompose -RepositoryRoot $RepositoryRoot -EnvironmentFile $EnvironmentFile -ComposeFile $ComposeFile `
        -Arguments @(
            'exec', '-T', 'edge-router',
            'npx', 'wrangler', 'd1', 'execute', '66666666-7777-4888-8999-aaaaaaaaaaaa',
            '--local', '--persist-to', '/data/edge-router',
            '--config', 'wrangler.local.toml',
            '--file', '/workspace/tag-app-database/0001_tag_access.sql'
        )

    Invoke-LocalCompose -RepositoryRoot $RepositoryRoot -EnvironmentFile $EnvironmentFile -ComposeFile $ComposeFile `
        -Arguments @(
            'exec', '-T', 'edge-router',
            'npx', 'wrangler', 'd1', 'execute', '66666666-7777-4888-8999-aaaaaaaaaaaa',
            '--local', '--persist-to', '/data/edge-router',
            '--config', 'wrangler.local.toml',
            '--file', '/seed/generated-routing.sql'
        )

    $kvEntries = @(
        @{ Key = 'tag-range-index'; File = 'tag-range-index.json' },
        @{ Key = 'group:local-group'; File = 'group-local-group.json' },
        @{ Key = 'feature:local-json'; File = 'feature-local-json.json' }
    )
    foreach ($entry in $kvEntries) {
        Invoke-LocalCompose -RepositoryRoot $RepositoryRoot -EnvironmentFile $EnvironmentFile -ComposeFile $ComposeFile `
            -Arguments @(
                'exec', '-T', 'edge-router',
                'npx', 'wrangler', 'kv', 'key', 'put',
                '--local', '--persist-to', '/data/edge-router',
                '--config', 'wrangler.local.toml',
                '--binding', 'TAG_CONFIG',
                $entry.Key,
                '--path', "/seed/kv/$($entry.File)"
            )
    }
}



