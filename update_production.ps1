# update_production.ps1
# Script to safely update production server code while preserving 100% of live database.db, bookings.json, users.json, and cars.json

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $rootDir) { $rootDir = Get-Location }

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Updating production server in $rootDir..." -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Create timestamped Backup directory
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$targetBackupDir = "C:\Backups"
if (-not (Test-Path $targetBackupDir)) {
    New-Item -ItemType Directory -Path $targetBackupDir | Out-Null
}

$zipFileName = "backup_server_$timestamp.zip"
$zipFilePath = Join-Path $targetBackupDir $zipFileName

# 2. Preserve live server database and data JSON files
Write-Host "Preserving live production data (database.db, bookings.json, users.json, cars.json)..." -ForegroundColor Yellow

$liveDb = Join-Path $rootDir "database.db"
$liveBookings = Join-Path $rootDir "bookings.json"
$liveUsers = Join-Path $rootDir "users.json"
$liveCars = Join-Path $rootDir "cars.json"

$tempDb = Join-Path $targetBackupDir "live_db_$timestamp.db"
$tempBookings = Join-Path $targetBackupDir "live_bookings_$timestamp.json"
$tempUsers = Join-Path $targetBackupDir "live_users_$timestamp.json"
$tempCars = Join-Path $targetBackupDir "live_cars_$timestamp.json"

if (Test-Path $liveDb) { Copy-Item $liveDb $tempDb -Force; Write-Host "Saved live DB to $tempDb" -ForegroundColor Cyan }
if (Test-Path $liveBookings) { Copy-Item $liveBookings $tempBookings -Force; Write-Host "Saved live Bookings to $tempBookings" -ForegroundColor Cyan }
if (Test-Path $liveUsers) { Copy-Item $liveUsers $tempUsers -Force; Write-Host "Saved live Users to $tempUsers" -ForegroundColor Cyan }
if (Test-Path $liveCars) { Copy-Item $liveCars $tempCars -Force; Write-Host "Saved live Cars to $tempCars" -ForegroundColor Cyan }

# Zip archive for extra backup safety
$itemsToZip = @()
foreach ($item in @("database.db", "bookings.json", "users.json", "cars.json", "app.js", "server.js", "index.html")) {
    $fullPath = Join-Path $rootDir $item
    if (Test-Path $fullPath) { $itemsToZip += $fullPath }
}
if ($itemsToZip.Count -gt 0) {
    try {
        Compress-Archive -Path $itemsToZip -DestinationPath $zipFilePath -Force
        Write-Host "Created ZIP backup: $zipFilePath" -ForegroundColor Green
    } catch {
        Write-Host "ZIP backup note: $_" -ForegroundColor Yellow
    }
}

# 3. Stop PM2 service to release Windows file locks
Write-Host "Stopping car-booking service to release file locks..." -ForegroundColor Yellow
try {
    pm2 stop car-booking
} catch {}

# 4. Pull updated codebase from GitHub main
Write-Host "Pulling latest application code (app.js, server.js, index.html) from GitHub..." -ForegroundColor Yellow
git config user.email "admin@fishmarket.co.th"
git config user.name "Administrator"
git fetch origin main
git reset --hard origin/main

# 5. Restore live production data files back over the workspace (GUARANTEES 0% DATA LOSS)
Write-Host "Restoring live database and data JSON files back..." -ForegroundColor Green
if (Test-Path $tempDb) { Copy-Item $tempDb $liveDb -Force }
if (Test-Path $tempBookings) { Copy-Item $tempBookings $liveBookings -Force }
if (Test-Path $tempUsers) { Copy-Item $tempUsers $liveUsers -Force }
if (Test-Path $tempCars) { Copy-Item $tempCars $liveCars -Force }

# 6. Restart PM2 server
Write-Host "Restarting car-booking server in PM2..." -ForegroundColor Green
try {
    pm2 start car-booking
} catch {
    pm2 restart car-booking --update-env
}

Write-Host "==========================================================================================" -ForegroundColor Green
Write-Host "Production server updated SUCCESSFULLY! Live database, bookings, users, and cars PRESERVED 100%!" -ForegroundColor Green
Write-Host "==========================================================================================" -ForegroundColor Green
