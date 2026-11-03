# Generate a project-wide source and documentation map.
$ErrorActionPreference = "Stop"

$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$OutputFile = Join-Path $RepositoryRoot "workspace-map.md"
$CurrentDate = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

$CodeExtensions = @(".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts", ".ps1", ".ts", ".tsx")
$ExcludedDirectories = @(
    ".git",
    ".graphify",
    ".tag-lab",
    ".wrangler",
    "coverage",
    "dist",
    "node_modules"
)

$Files = [System.Collections.Generic.List[System.IO.FileInfo]]::new()
$DirectoriesToScan = [System.Collections.Generic.Stack[string]]::new()
$DirectoriesToScan.Push($RepositoryRoot)

while ($DirectoriesToScan.Count -gt 0) {
    $Directory = $DirectoriesToScan.Pop()

    foreach ($Entry in Get-ChildItem -LiteralPath $Directory -Force -ErrorAction Stop) {
        if ($Entry.PSIsContainer) {
            if ($Entry.Name -notin $ExcludedDirectories) {
                $DirectoriesToScan.Push($Entry.FullName)
            }
            continue
        }

        $Extension = $Entry.Extension.ToLowerInvariant()
        if (
            $Extension -in $CodeExtensions -or
            $Extension -eq ".md"
        ) {
            if ($Entry.FullName -ne $OutputFile) {
                $Files.Add($Entry)
            }
        }
    }
}

$MapContent = [System.Collections.Generic.List[string]]::new()
$MapContent.Add("# Automated Project Map & Code Index")
$MapContent.Add("*Generated: $CurrentDate*")
$MapContent.Add("")
$MapContent.Add("---")
$MapContent.Add("")

foreach ($File in ($Files | Sort-Object FullName)) {
    $RelativePath = $File.FullName.Substring($RepositoryRoot.Length).TrimStart([char[]]@("\", "/"))
    $RelativePath = $RelativePath.Replace("\", "/")
    $MapContent.Add("## File: ``$RelativePath``")

    $Content = Get-Content -LiteralPath $File.FullName -Raw -Encoding utf8 -ErrorAction Stop

    if ($File.Extension.ToLowerInvariant() -in $CodeExtensions) {
        $SymbolMatches = [System.Text.RegularExpressions.Regex]::Matches(
            $Content,
            '(export\s+(async\s+)?(function|const|class)\s+([a-zA-Z0-9_]+))|(function\s+([a-zA-Z0-9_]+))'
        )

        if ($SymbolMatches.Count -gt 0) {
            $MapContent.Add("**Exported symbols / functions:**")

            foreach ($SymbolMatch in $SymbolMatches) {
                $SymbolName = if ($SymbolMatch.Groups[4].Value) {
                    $SymbolMatch.Groups[4].Value
                }
                else {
                    $SymbolMatch.Groups[6].Value
                }

                if ($SymbolName) {
                    $MapContent.Add("- ``$SymbolName``")
                }
            }
        }
        else {
            $MapContent.Add("*No explicit function exports detected.*")
        }
    }
    elseif ($File.Extension -eq ".md") {
        $Headings = [System.Text.RegularExpressions.Regex]::Matches(
            $Content,
            '^(#{1,3})\s+(.+)$',
            [System.Text.RegularExpressions.RegexOptions]::Multiline
        )

        if ($Headings.Count -gt 0) {
            $MapContent.Add("**Documentation structure:**")

            foreach ($Heading in $Headings) {
                $MapContent.Add("- $($Heading.Value)")
            }
        }
    }

    $MapContent.Add("")
    $MapContent.Add("---")
    $MapContent.Add("")
}

Set-Content -LiteralPath $OutputFile -Value $MapContent -Encoding utf8 -ErrorAction Stop
Write-Host "[OK] Project map generated successfully: $OutputFile" -ForegroundColor Green
