# Git auto-backup for OMOF
# Commits all tracked changes and pushes to GitHub.
#
# Usage:
#   powershell -File scripts/git-backup.ps1              # add + commit + push
#   powershell -File scripts/git-backup.ps1 -Debounced     # skip if ran in last 90s
#   powershell -File scripts/git-backup.ps1 -PushOnly      # push only (post-commit hook)

param(
    [switch]$Debounced,
    [switch]$PushOnly,
    [int]$DebounceSeconds = 90
)

$ErrorActionPreference = 'Continue'

function Get-RepoRoot {
    $start = $PSScriptRoot
    if ($start -match '[\\/]scripts$') {
        return (Resolve-Path (Join-Path $start '..')).Path
    }
    return $start
}

function Write-BackupLog {
    param([string]$Message)
    $logPath = Join-Path $repoRoot '.git\backup-push.log'
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
    Add-Content -Path $logPath -Value $line -ErrorAction SilentlyContinue
}

$repoRoot = Get-RepoRoot
Set-Location $repoRoot

$debounceMarker = Join-Path $repoRoot '.git\last-backup-push'

if ($Debounced -and (Test-Path $debounceMarker)) {
    $lastRun = (Get-Item $debounceMarker).LastWriteTime
    $elapsed = ((Get-Date) - $lastRun).TotalSeconds
    if ($elapsed -lt $DebounceSeconds) {
        exit 0
    }
}

if (-not (Test-Path (Join-Path $repoRoot '.git'))) {
    Write-BackupLog 'Skipped — not a git repository.'
    exit 0
}

$remoteUrl = git remote get-url origin 2>$null
if (-not $remoteUrl) {
    Write-BackupLog 'Skipped — no origin remote. Run: powershell -File scripts/setup-github-backup.ps1'
    exit 0
}

if (-not $PushOnly) {
    git add -A 2>$null
    $status = git status --porcelain 2>$null
    if (-not $status) {
        Write-BackupLog 'No changes to commit.'
        exit 0
    }

    $message = "backup: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    git commit -m $message 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-BackupLog "Commit failed (exit $LASTEXITCODE)."
        exit $LASTEXITCODE
    }
    Write-BackupLog "Committed — $message"
}

$branch = git branch --show-current 2>$null
if (-not $branch) { $branch = 'master' }

git push -u origin $branch 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-BackupLog "Push failed (exit $LASTEXITCODE). Check network and GitHub auth."
    exit $LASTEXITCODE
}

Set-Content -Path $debounceMarker -Value (Get-Date).ToString('o') -Force
Write-BackupLog "Pushed to origin/$branch"

exit 0
