# Zieldatei definieren
$OutputFile = "context-summary.md"

# 1. Daten sicher einsammeln
$CurrentDate = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$Branch = (git branch --show-current) 
if (-not $Branch) { $Branch = "HEAD (detached or no branch)" }

$StatusRaw = git status -s
$Status = if ($StatusRaw) { $StatusRaw -join "`n" } else { "Working tree clean" }

$CommitsRaw = git log -n 5 --oneline --no-merges
$Commits = if ($CommitsRaw) { $CommitsRaw -join "`n" } else { "No commits found" }

$DiffNamesRaw = git diff --name-only
$DiffNames = if ($DiffNamesRaw) { $DiffNamesRaw -join "`n" } else { "No uncommitted file changes" }

$DiffStatRaw = git diff --stat
$DiffStat = if ($DiffStatRaw) { $DiffStatRaw -join "`n" } else { "No diff stats available" }

# Hilfsvar für Backticks, damit der Parser sie nicht interpretiert
$Tick3 = '```'
$Tick3Diff = '```diff'

# 2. Inhalts-Array aufbauen
$MarkdownLines = @(
    "# Active Project Context Summary",
    "*Generated: $CurrentDate*",
    "",
    "---",
    "",
    "## 1. Git Status & Current Branch",
    "**Current Branch:** $Branch",
    "",
    "### Uncommitted / Modified Files:",
    $Tick3,
    $Status,
    $Tick3,
    "",
    "---",
    "",
    "## 2. Recent Commits (History Baseline)",
    $Tick3,
    $Commits,
    $Tick3,
    "",
    "---",
    "",
    "## 3. Modified Files List (Diff Target)",
    $Tick3,
    $DiffNames,
    $Tick3,
    "",
    "---",
    "",
    "## 4. Key Changed Files Details (Summary)",
    $Tick3Diff,
    $DiffStat,
    $Tick3
)

# 3. Datei schreiben (UTF-8)
$MarkdownLines | Out-File -FilePath $OutputFile -Encoding utf8

# 4. Erfolgsmeldung
Write-Output "[OK] Context Summary erfolgreich geschrieben in: $OutputFile" -ForegroundColor Green