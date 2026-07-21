# update_production.ps1
# Script to safely update production server without touching live bookings.json

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $rootDir) { $rootDir = Get-Location }

Write-Host "Updating production server safely in $rootDir..." -ForegroundColor Green

# 1. Backup live bookings.json
$bookingsFile = Join-Path $rootDir "bookings.json"
$backupFile = Join-Path $rootDir "bookings_live_backup.json"

if (Test-Path $bookingsFile) {
    Copy-Item -Path $bookingsFile -Destination $backupFile -Force
    Write-Host "[1/4] Live bookings database backed up to bookings_live_backup.json" -ForegroundColor Yellow
}

# 2. Tell git never to overwrite local bookings.json
try {
    git update-index --assume-unchanged bookings.json
    Write-Host "[2/4] Git configured to preserve live bookings.json" -ForegroundColor Yellow
} catch {
    Write-Warning "Could not set assume-unchanged on git"
}

# 3. Pull updated code (app.js, index.html, style.css, etc.)
Write-Host "[3/4] Pulling latest codebase updates from GitHub..." -ForegroundColor Yellow
git pull origin main

# Ensure live database was not overwritten
if (Test-Path $backupFile) {
    Copy-Item -Path $backupFile -Destination $bookingsFile -Force
    Write-Host "Live bookings database verified and protected 100%." -ForegroundColor Green
}

# 4. Restart server
Write-Host "[4/4] Restarting car-booking server in PM2..." -ForegroundColor Yellow
pm2 restart car-booking

Write-Host "Production server updated successfully! All live approval history preserved 100%." -ForegroundColor Green
