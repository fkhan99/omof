# One-time setup: connect OMOF to GitHub and enable auto-backup hooks.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/setup-github-backup.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/setup-github-backup.ps1 -RepoUrl https://github.com/you/omof.git

param(
    [string]$RepoUrl = ''
)

$ErrorActionPreference = 'Continue'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $repoRoot

function Invoke-Git {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
    $output = & git @Args 2>&1
    return @{
        Output = $output
        ExitCode = $LASTEXITCODE
    }
}

Write-Host "OMOF GitHub backup setup" -ForegroundColor Cyan
Write-Host "Repository: $repoRoot`n"

if (-not (Test-Path (Join-Path $repoRoot '.git'))) {
    Invoke-Git @('init') | Out-Null
    Write-Host "Initialized git repository."
}

# Install post-commit hook (auto-push after manual commits)
$hooksDir = Join-Path $repoRoot '.git\hooks'
$postCommitPath = Join-Path $hooksDir 'post-commit'
$postCommitContent = @"
#!/bin/sh
# Auto-push after every commit (OMOF backup)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$repoRoot/scripts/git-backup.ps1" -PushOnly
"@
Set-Content -Path $postCommitPath -Value $postCommitContent -NoNewline
Write-Host "Installed post-commit hook."

if (-not $RepoUrl) {
    Write-Host ""
    Write-Host "Create a new GitHub repo (empty, no README) at:" -ForegroundColor Yellow
    Write-Host "  https://github.com/new`n"
    $RepoUrl = Read-Host "Paste your repo URL (e.g. https://github.com/you/omof.git)"
}

if (-not $RepoUrl) {
    Write-Host "No URL provided. Re-run with -RepoUrl when ready." -ForegroundColor Yellow
    exit 1
}

$remoteCheck = Invoke-Git @('remote', 'get-url', 'origin')
if ($remoteCheck.ExitCode -eq 0 -and $remoteCheck.Output) {
    $existingRemote = "$remoteCheck.Output".Trim()
    if ($existingRemote -ne $RepoUrl) {
        Invoke-Git @('remote', 'set-url', 'origin', $RepoUrl) | Out-Null
        Write-Host "Updated origin remote."
    } else {
        Write-Host "Origin remote already set."
    }
} else {
    $addRemote = Invoke-Git @('remote', 'add', 'origin', $RepoUrl)
    if ($addRemote.ExitCode -eq 0) {
        Write-Host "Added origin remote."
    } else {
        $retryCheck = Invoke-Git @('remote', 'get-url', 'origin')
        if ($retryCheck.ExitCode -eq 0) {
            Invoke-Git @('remote', 'set-url', 'origin', $RepoUrl) | Out-Null
            Write-Host "Origin remote already existed - URL confirmed."
        } else {
            Write-Host "Failed to add origin remote." -ForegroundColor Red
            if ($addRemote.Output) { Write-Host $addRemote.Output }
            exit 1
        }
    }
}

# Initial commit if needed
$headCheck = Invoke-Git @('rev-parse', 'HEAD')
if ($headCheck.ExitCode -ne 0) {
    Invoke-Git @('add', '-A') | Out-Null
    $commit = Invoke-Git @('commit', '-m', 'Initial commit: OMOF project')
    if ($commit.ExitCode -eq 0) {
        Write-Host "Created initial commit."
    } else {
        Write-Host "Nothing to commit yet, or commit failed." -ForegroundColor Yellow
        if ($commit.Output) { Write-Host $commit.Output }
    }
}

Write-Host ""
Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
Invoke-Git @('branch', '-M', 'main') | Out-Null
$push = Invoke-Git @('push', '-u', 'origin', 'main')
if ($push.ExitCode -ne 0) {
    $push = Invoke-Git @('push', '-u', 'origin', 'master')
}

if ($push.ExitCode -eq 0) {
    Write-Host "`nSuccess! GitHub backup is connected." -ForegroundColor Green
} else {
    Write-Host "`nPush failed. Common fixes:" -ForegroundColor Red
    Write-Host "  1. Log in to GitHub: gh auth login"
    Write-Host "  2. Or use a Personal Access Token when git asks for a password"
    Write-Host "  3. Make sure the repo exists and you have write access"
    if ($push.Output) {
        Write-Host $push.Output
    }
    exit 1
}

Write-Host ""
Write-Host "Auto-backup is enabled via:" -ForegroundColor Cyan
Write-Host "  - Cursor hooks (.cursor/hooks.json) after agent edits"
Write-Host "  - Git post-commit hook after manual commits"
Write-Host "  - Optional: scripts/watch-backup.ps1 for all file saves"
Write-Host ""
Write-Host "Manual backup anytime: npm run backup:push"
