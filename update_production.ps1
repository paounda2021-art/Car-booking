# update_production.ps1
# Script to safely backup server data to ZIP and update production server to match GitHub main 100%

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $rootDir) { $rootDir = Get-Location }

Write-Host "Updating production server in $rootDir..." -ForegroundColor Green

# 1. Stop PM2 server first to release Windows file locks on database.db
Write-Host "Stopping car-booking service to release file locks..." -ForegroundColor Yellow
try {
    pm2 stop car-booking
} catch {}

# 2. Create timestamped ZIP backup before pulling new code
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$backupDir = Join-Path $rootDir "backups"
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}

$zipFileName = "backup_server_$timestamp.zip"
$zipFilePath = Join-Path $backupDir $zipFileName

Write-Host "📦 Creating timestamped ZIP backup at $zipFilePath..." -ForegroundColor Yellow

$itemsToZip = @()
foreach ($item in @("database.db", "bookings.json", "users.json", "app.js", "server.js", "index.html")) {
    $fullPath = Join-Path $rootDir $item
    if (Test-Path $fullPath) {
        $itemsToZip += $fullPath
    }
}

if ($itemsToZip.Count -gt 0) {
    try {
        Compress-Archive -Path $itemsToZip -DestinationPath $zipFilePath -Force
        Write-Host "✅ Server ZIP Backup created successfully: $zipFileName" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Warning creating ZIP backup: $_" -ForegroundColor Red
    }
}

# 3. Allow git to update bookings.json
try {
    git update-index --no-assume-unchanged bookings.json
} catch {}

# 4. Remove old sqlite db so it auto-rebuilds cleanly
$dbFile = Join-Path $rootDir "database.db"
if (Test-Path $dbFile) {
    Remove-Item -Path $dbFile -Force -ErrorAction SilentlyContinue
}

# 5. Pull updated code and database from GitHub
Write-Host "Pulling latest codebase and database from GitHub..." -ForegroundColor Yellow
git config user.email "admin@fishmarket.co.th"
git config user.name "Administrator"
git fetch origin
git reset --hard origin/main

# 6. Restart server in PM2
Write-Host "Restarting car-booking server in PM2..." -ForegroundColor Yellow
pm2 start car-booking

Write-Host "🎉 Production server updated successfully! Backup ZIP saved in backups/$zipFileName" -ForegroundColor Green
