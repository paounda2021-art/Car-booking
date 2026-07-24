# update_production.ps1
# Script to safely update production server to match latest codebase without wiping live user data

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $rootDir) { $rootDir = Get-Location }

Write-Host "Updating production server in $rootDir..." -ForegroundColor Green

# 1. Stop PM2 server first so database.db file lock is released
Write-Host "Stopping PM2 car-booking server to release database file lock..." -ForegroundColor Yellow
try {
    pm2 stop car-booking
} catch {}

# 2. Allow git to update files
try {
    git update-index --no-assume-unchanged bookings.json
} catch {}

# 3. Preserve local database and user data if exists
$tempBackup = Join-Path $rootDir "temp_db_backup"
if (Test-Path $tempBackup) { Remove-Item $tempBackup -Recurse -Force }
New-Item -ItemType Directory -Path $tempBackup | Out-Null

$dataFiles = @("database.db", "bookings.json", "users.json", "cars.json")
foreach ($file in $dataFiles) {
    $filePath = Join-Path $rootDir $file
    if (Test-Path $filePath) {
        Copy-Item -Path $filePath -Destination $tempBackup -Force
    }
}

# 4. Pull updated code from GitHub
Write-Host "Pulling latest codebase from GitHub..." -ForegroundColor Yellow
git config user.email "admin@fishmarket.co.th"
git config user.name "Administrator"
git fetch origin
git reset --hard origin/main

# 5. Restore local database and user data so real bookings on server are preserved 100%
Write-Host "Restoring live database and user data..." -ForegroundColor Yellow
foreach ($file in $dataFiles) {
    $backupFilePath = Join-Path $tempBackup $file
    if (Test-Path $backupFilePath) {
        Copy-Item -Path $backupFilePath -Destination $rootDir -Force
    }
}
if (Test-Path $tempBackup) { Remove-Item $tempBackup -Recurse -Force }

# 6. Restart server in PM2
Write-Host "Restarting car-booking server in PM2..." -ForegroundColor Yellow
pm2 start car-booking

# 7. Force sync database to ensure consistency
try {
    Invoke-RestMethod -Uri "http://localhost:8080/api/force-resync" -TimeoutSec 5
} catch {}

Write-Host "Production server updated successfully!" -ForegroundColor Green
