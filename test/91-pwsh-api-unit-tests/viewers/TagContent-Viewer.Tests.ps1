#Requires -Version 7.0
#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.0.0' }

BeforeAll {
    $ErrorActionPreference = 'Stop'

    $environmentPath = Join-Path $PSScriptRoot '..\environments\tag-content-local.json'
    $environment = Get-Content -Raw -LiteralPath $environmentPath | ConvertFrom-Json
    if ($environment.environment -ne 'local') {
        throw 'Der TAG-Content-Viewer darf ausschließlich mit tag-content-local.json verwendet werden.'
    }

    $composeFile = Join-Path $PSScriptRoot '..\..\10-test-local\compose.yaml'
    if (-not (Test-Path -LiteralPath $composeFile -PathType Leaf)) {
        throw "Lokale Docker-Compose-Datei fehlt: $composeFile"
    }

    $containerIds = @(& docker ps --filter 'label=com.docker.compose.project=myqr24-local-test' --filter 'label=com.docker.compose.service=tag-app-api' --format '{{.ID}}' 2>&1)
    if ($LASTEXITCODE -ne 0) {
        throw "Docker konnte nicht abgefragt werden: $($containerIds -join [Environment]::NewLine)"
    }
    $containerIds = @($containerIds | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ })
    if ($containerIds.Count -ne 1) {
        throw "Erwartete genau einen laufenden lokalen TAG-App-API-Container, gefunden: $($containerIds.Count). Starte den lokalen Compose-Service 'tag-app-api'."
    }
    $script:containerId = $containerIds[0]

    $script:d1Tables = @(
        'global_content',
        'tag_access_sessions',
        'tag_content',
        'tag_content_element_items',
        'tag_content_elements',
        'tag_content_items',
        'tag_content_media_variants',
        'tag_pin_credentials',
        'tag_pin_throttles',
        'tag_range_content',
        'tag_routing'
    )

    function Invoke-ViewerNodeScript {
        param([Parameter(Mandatory)][string]$Script)

        $output = @(& docker exec -e 'NODE_NO_WARNINGS=1' $script:containerId node -e $Script 2>&1)
        if ($LASTEXITCODE -ne 0) {
            throw "Lokaler Viewer-Lesezugriff schlug fehl: $($output -join [Environment]::NewLine)"
        }
        return ($output -join [Environment]::NewLine).Trim()
    }

    function Get-LocalD1TableRows {
        param([Parameter(Mandatory)][string]$Table)

        if ($Table -notin $script:d1Tables) {
            throw "Nicht erlaubte D1-Tabelle: $Table"
        }

        $tableJson = ConvertTo-Json -InputObject $Table -Compress
        $nodeScript = @"
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const table = $tableJson;
const root = '/data/tag-app-api/v3/d1/miniflare-D1DatabaseObject';
if (!fs.existsSync(root)) throw new Error('Lokale D1-Persistenz nicht gefunden: ' + root);
const files = fs.readdirSync(root).filter(file => file.endsWith('.sqlite') && file !== 'metadata.sqlite');
for (const file of files) {
  const db = new DatabaseSync(path.join(root, file), { readOnly: true });
  try {
    const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
    if (!exists) continue;
    const escaped = '"' + table.replaceAll('"', '""') + '"';
    const rows = db.prepare('SELECT * FROM ' + escaped).all();
    console.log(JSON.stringify({ table, rows }));
    process.exit(0);
  } finally {
    db.close();
  }
}
throw new Error('D1-Tabelle wurde in der lokalen Datenbank nicht gefunden: ' + table);
"@
        $json = Invoke-ViewerNodeScript -Script $nodeScript
        return @($json | ConvertFrom-Json -Depth 100)
    }

    function Get-LocalR2Objects {
        $nodeScript = @'
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const root = '/data/tag-app-api/v3/r2/miniflare-R2BucketObject';
if (!fs.existsSync(root)) throw new Error('Lokale R2-Metadaten nicht gefunden: ' + root);
for (const file of fs.readdirSync(root).filter(file => file.endsWith('.sqlite') && file !== 'metadata.sqlite')) {
  const db = new DatabaseSync(path.join(root, file), { readOnly: true });
  try {
    const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '_mf_objects'").get();
    if (!exists) continue;
    const rows = db.prepare('SELECT key, size, uploaded, http_metadata, custom_metadata FROM _mf_objects ORDER BY key').all();
    const objects = rows.map(row => ({
      key: row.key,
      size: row.size,
      uploaded: new Date(row.uploaded).toISOString(),
      httpMetadata: JSON.parse(row.http_metadata || '{}'),
      customMetadata: JSON.parse(row.custom_metadata || '{}')
    }));
    for (const object of objects) console.log(JSON.stringify(object));
    process.exit(0);
  } finally {
    db.close();
  }
}
throw new Error('Lokale R2-Objektliste wurde nicht gefunden.');
'@
        $output = Invoke-ViewerNodeScript -Script $nodeScript
        if ([string]::IsNullOrWhiteSpace($output)) { return @() }
        return @($output -split '\r?\n' | ForEach-Object { $_ | ConvertFrom-Json -Depth 100 })
    }

    function Get-LocalR2ObjectContent {
        param([Parameter(Mandatory)][string]$Key)

        $keyJson = ConvertTo-Json -InputObject $Key -Compress
        $nodeScript = @"
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const key = $keyJson;
const root = '/data/tag-app-api/v3/r2/miniflare-R2BucketObject';
const bucketRoot = '/data/tag-app-api/v3/r2/myqr24-private-content-local';
for (const file of fs.readdirSync(root).filter(file => file.endsWith('.sqlite') && file !== 'metadata.sqlite')) {
  const db = new DatabaseSync(path.join(root, file), { readOnly: true });
  try {
    const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '_mf_objects'").get();
    if (!exists) continue;
    const row = db.prepare('SELECT key, blob_id, size, http_metadata FROM _mf_objects WHERE key = ?').get(key);
    if (!row) continue;
    if (!/^[a-f0-9]+$/i.test(row.blob_id || '')) throw new Error('Ungültige lokale Blob-ID.');
    const source = path.join(bucketRoot, 'blobs', row.blob_id);
    const outputDir = '/workspace/tag-app/.wrangler/viewer-exports';
    fs.mkdirSync(outputDir, { recursive: true });
    const safeName = path.basename(key).replace(/[^A-Za-z0-9._-]/g, '_') || 'r2-object.bin';
    const outputPath = path.join(outputDir, Date.now() + '-' + safeName);
    fs.copyFileSync(source, outputPath);
    const metadata = JSON.parse(row.http_metadata || '{}');
    const contentType = metadata.contentType || 'application/octet-stream';
    const text = /^(application\/(?:json|[^;]+\+json)|text\/)/i.test(contentType)
      ? fs.readFileSync(outputPath, 'utf8')
      : null;
    console.log(JSON.stringify({ key: row.key, size: row.size, contentType, outputPath, text }));
    process.exit(0);
  } finally {
    db.close();
  }
}
throw new Error('R2-Objekt wurde im lokalen Bucket nicht gefunden: ' + key);
"@
        $json = Invoke-ViewerNodeScript -Script $nodeScript
        return $json | ConvertFrom-Json -Depth 100
    }
}

Describe 'TAG Content local viewer – D1' {
    It 'zeigt D1-Tabelle global_content vollständig' {
        $result = Get-LocalD1TableRows -Table 'global_content'
        Write-Host "`nD1-Tabelle: $($result.table) (Zeilen: $($result.rows.Count))" -ForegroundColor Cyan
        Write-Host ($result.rows | ConvertTo-Json -Depth 100)
    }

    It 'zeigt D1-Tabelle tag_access_sessions vollständig' {
        $result = Get-LocalD1TableRows -Table 'tag_access_sessions'
        Write-Host "`nD1-Tabelle: $($result.table) (Zeilen: $($result.rows.Count))" -ForegroundColor Cyan
        Write-Host ($result.rows | ConvertTo-Json -Depth 100)
    }

    It 'zeigt D1-Tabelle tag_content vollständig' {
        $result = Get-LocalD1TableRows -Table 'tag_content'
        Write-Host "`nD1-Tabelle: $($result.table) (Zeilen: $($result.rows.Count))" -ForegroundColor Cyan
        Write-Host ($result.rows | ConvertTo-Json -Depth 100)
    }

    It 'zeigt D1-Tabelle tag_content_element_items vollständig' {
        $result = Get-LocalD1TableRows -Table 'tag_content_element_items'
        Write-Host "`nD1-Tabelle: $($result.table) (Zeilen: $($result.rows.Count))" -ForegroundColor Cyan
        Write-Host ($result.rows | ConvertTo-Json -Depth 100)
    }

    It 'zeigt D1-Tabelle tag_content_elements vollständig' {
        $result = Get-LocalD1TableRows -Table 'tag_content_elements'
        Write-Host "`nD1-Tabelle: $($result.table) (Zeilen: $($result.rows.Count))" -ForegroundColor Cyan
        Write-Host ($result.rows | ConvertTo-Json -Depth 100)
    }

    It 'zeigt D1-Tabelle tag_content_items vollständig' {
        $result = Get-LocalD1TableRows -Table 'tag_content_items'
        Write-Host "`nD1-Tabelle: $($result.table) (Zeilen: $($result.rows.Count))" -ForegroundColor Cyan
        Write-Host ($result.rows | ConvertTo-Json -Depth 100)
    }

    It 'zeigt D1-Tabelle tag_content_media_variants vollständig' {
        $result = Get-LocalD1TableRows -Table 'tag_content_media_variants'
        Write-Host "`nD1-Tabelle: $($result.table) (Zeilen: $($result.rows.Count))" -ForegroundColor Cyan
        Write-Host ($result.rows | ConvertTo-Json -Depth 100)
    }

    It 'zeigt D1-Tabelle tag_pin_credentials vollständig' {
        $result = Get-LocalD1TableRows -Table 'tag_pin_credentials'
        Write-Host "`nD1-Tabelle: $($result.table) (Zeilen: $($result.rows.Count))" -ForegroundColor Cyan
        Write-Host ($result.rows | ConvertTo-Json -Depth 100)
    }

    It 'zeigt D1-Tabelle tag_pin_throttles vollständig' {
        $result = Get-LocalD1TableRows -Table 'tag_pin_throttles'
        Write-Host "`nD1-Tabelle: $($result.table) (Zeilen: $($result.rows.Count))" -ForegroundColor Cyan
        Write-Host ($result.rows | ConvertTo-Json -Depth 100)
    }

    It 'zeigt D1-Tabelle tag_range_content vollständig' {
        $result = Get-LocalD1TableRows -Table 'tag_range_content'
        Write-Host "`nD1-Tabelle: $($result.table) (Zeilen: $($result.rows.Count))" -ForegroundColor Cyan
        Write-Host ($result.rows | ConvertTo-Json -Depth 100)
    }

    It 'zeigt D1-Tabelle tag_routing vollständig' {
        $result = Get-LocalD1TableRows -Table 'tag_routing'
        Write-Host "`nD1-Tabelle: $($result.table) (Zeilen: $($result.rows.Count))" -ForegroundColor Cyan
        Write-Host ($result.rows | ConvertTo-Json -Depth 100)
    }
}

Describe 'TAG Content local viewer – R2' {
    It 'listet alle lokalen R2-Dateien mit Metadaten' {
        $objects = @(Get-LocalR2Objects)
        Write-Host "`nLokale R2-Dateien (Anzahl: $($objects.Count))" -ForegroundColor Cyan
        Write-Host ($objects | ConvertTo-Json -Depth 100)
    }

    It 'zeigt ein ausgewähltes R2-Objekt an und exportiert den Inhalt' {
        $key = [string]$env:MYQR_TAG_CONTENT_VIEWER_R2_KEY
        if ([string]::IsNullOrWhiteSpace($key)) {
            Set-ItResult -Skipped -Because 'MYQR_TAG_CONTENT_VIEWER_R2_KEY ist nicht gesetzt; es wird nur lesend angezeigt.'
            return
        }

        $object = Get-LocalR2ObjectContent -Key $key
        Write-Host "`nR2-Objekt: $($object.key) ($($object.contentType), $($object.size) Bytes)" -ForegroundColor Cyan
        if ($null -ne $object.text) {
            Write-Host "`nInhalt:`n$($object.text)"
        }
        Write-Host "Lokale Exportdatei: $($object.outputPath)" -ForegroundColor Green
    }
}