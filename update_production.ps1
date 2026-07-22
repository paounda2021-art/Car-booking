# update_production.ps1
# Script to safely update production server to match 8080 100%

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $rootDir) { $rootDir = Get-Location }

Write-Host "Updating production server to match 8080 100% in $rootDir..." -ForegroundColor Green

# 1. Allow git to update bookings.json
try {
    git update-index --no-assume-unchanged bookings.json
} catch {}

# 2. Remove old sqlite db so it auto-rebuilds cleanly
$dbFile = Join-Path $rootDir "database.db"
if (Test-Path $dbFile) {
    Remove-Item -Path $dbFile -Force -ErrorAction SilentlyContinue
}

# 3. Pull updated code and 29-record database from GitHub
Write-Host "Pulling latest codebase and 29-item database from GitHub..." -ForegroundColor Yellow
git config user.email "admin@fishmarket.co.th"
git config user.name "Administrator"
git fetch origin
git reset --hard origin/main

# 4. Restart server in PM2
Write-Host "Restarting car-booking server in PM2..." -ForegroundColor Yellow
pm2 restart car-booking

Write-Host "Production server updated successfully! 100% matched with 8080." -ForegroundColor Green
