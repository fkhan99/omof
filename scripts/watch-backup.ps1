# Optional background watcher — backs up every 60s when files changed.
# Run in a separate terminal and leave it open:
#   npm run backup:watch
#
# Press Ctrl+C to stop.

$ErrorActionPreference = 'Continue'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$backupScript = Join-Path $repoRoot 'scripts\git-backup.ps1'
$intervalSeconds = 60

Write-Host "OMOF backup watcher — checking every ${intervalSeconds}s" -ForegroundColor Cyan
Write-Host "Repository: $repoRoot"
Write-Host "Press Ctrl+C to stop.`n"

Set-Location $repoRoot

while ($true) {
    $changes = git status --porcelain 2>$null
    if ($changes) {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Changes found — backing up..."
        & $backupScript -Debounced
    }
    Start-Sleep -Seconds $intervalSeconds
}
