# update_production.ps1
# Script to safely update production server to match 8080 100%

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $rootDir) { $rootDir = Get-Location }

Write-Host "Updating production server to match 8080 100% in $rootDir..." -ForegroundColor Green

# 1. Stop PM2 server first so database.db file lock is released
Write-Host "Stopping PM2 car-booking server to release database file lock..." -ForegroundColor Yellow
try {
    pm2 stop car-booking
} catch {}

# 2. Allow git to update bookings.json
try {
    git update-index --no-assume-unchanged bookings.json
} catch {}

# 3. Pull updated code and database from GitHub
Write-Host "Pulling latest codebase and database from GitHub..." -ForegroundColor Yellow
git config user.email "admin@fishmarket.co.th"
git config user.name "Administrator"
git fetch origin
git reset --hard origin/main

# 4. Restart server in PM2
Write-Host "Restarting car-booking server in PM2..." -ForegroundColor Yellow
pm2 start car-booking

Write-Host "Production server updated successfully! 100% matched with 8080." -ForegroundColor Green
