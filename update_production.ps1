# update_production.ps1
# Script to safely backup server data to ZIP in C:\Backups\ and update production server to match GitHub main 100%

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $rootDir) { $rootDir = Get-Location }

Write-Host "Updating production server in $rootDir..." -ForegroundColor Green

# 1. Stop PM2 server first to release Windows file locks on database.db
Write-Host "Stopping car-booking service to release file locks..." -ForegroundColor Yellow
try {
    pm2 stop car-booking
} catch {}

# 2. Create timestamped ZIP backup in C:\Backups\ before pulling new code
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$targetBackupDir = "C:\Backups"
if (-not (Test-Path $targetBackupDir)) {
    New-Item -ItemType Directory -Path $targetBackupDir | Out-Null
}

$zipFileName = "backup_server_$timestamp.zip"
$zipFilePath = Join-Path $targetBackupDir $zipFileName

Write-Host "Creating timestamped ZIP backup at $zipFilePath..." -ForegroundColor Yellow

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
        Write-Host "Server ZIP Backup created successfully: $zipFilePath" -ForegroundColor Green
    } catch {
        Write-Host "Warning creating ZIP backup in C:\Backups: $_" -ForegroundColor Red
    }
}

# 3. Save temporary copy of live database.db & bookings.json to preserve live server data 100%
$tempLiveDb = Join-Path $targetBackupDir "live_db_$timestamp.db"
$tempLiveJson = Join-Path $targetBackupDir "live_bookings_$timestamp.json"

if (Test-Path "$rootDir\database.db") {
    Copy-Item "$rootDir\database.db" $tempLiveDb -Force
    Write-Host "Live database.db preserved to $tempLiveDb" -ForegroundColor Cyan
}
if (Test-Path "$rootDir\bookings.json") {
    Copy-Item "$rootDir\bookings.json" $tempLiveJson -Force
    Write-Host "Live bookings.json preserved to $tempLiveJson" -ForegroundColor Cyan
}

# 4. Pull updated codebase from GitHub
Write-Host "Pulling latest codebase from GitHub..." -ForegroundColor Yellow
git config user.email "admin@fishmarket.co.th"
git config user.name "Administrator"
git stash
git pull origin main

# 5. Restore live server database.db & bookings.json so live data is NEVER overwritten
if (Test-Path $tempLiveDb) {
    Copy-Item $tempLiveDb "$rootDir\database.db" -Force
    Write-Host "Restored live database.db successfully!" -ForegroundColor Green
}
if (Test-Path $tempLiveJson) {
    Copy-Item $tempLiveJson "$rootDir\bookings.json" -Force
    Write-Host "Restored live bookings.json successfully!" -ForegroundColor Green
}

# 6. Restart server in PM2
Write-Host "Restarting car-booking server in PM2..." -ForegroundColor Yellow
try {
    pm2 start car-booking
} catch {
    pm2 restart car-booking --update-env
}

Write-Host "Production server updated successfully without overwriting live database! Backup ZIP saved in $zipFilePath" -ForegroundColor Green
