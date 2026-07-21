# deploy_server.ps1
# Get the directory where the script is located
$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $rootDir) { $rootDir = Get-Location }

Write-Host "Syncing database and codebase in $rootDir..."

# 1. Sync local database to Cloudflare Pages (push local data safely)
$bookingsFile = Join-Path $rootDir "bookings.json"
if (Test-Path $bookingsFile) {
    try {
        $jsonContent = Get-Content -Path $bookingsFile -Raw -Encoding utf8
        Invoke-RestMethod -Uri "https://car-booking-5l7.pages.dev/api/save-bookings" -Method Post -Body $jsonContent -ContentType "application/json" -ErrorAction Stop | Out-Null
        Write-Host "Local bookings database successfully synced to Cloudflare Pages."
    } catch {
        Write-Warning "Could not push local bookings to Cloudflare: $_"
    }
}

# 2. Copy to deploy directory if it exists
$deployDir = "D:\deploy_latest"
$carsFile = Join-Path $rootDir "cars.json"
if (Test-Path $deployDir) {
    if (Test-Path $bookingsFile) {
        Copy-Item -Path $bookingsFile -Destination (Join-Path $deployDir "bookings.json") -Force
    }
    if (Test-Path $carsFile) {
        Copy-Item -Path $carsFile -Destination (Join-Path $deployDir "cars.json") -Force
    }
    Copy-Item -Path (Join-Path $rootDir "app.js"), (Join-Path $rootDir "index.html"), (Join-Path $rootDir "style.css"), (Join-Path $rootDir "server.js"), (Join-Path $rootDir "line_config.json"), (Join-Path $rootDir "users.json") -Destination $deployDir -Force
    Write-Host "Copied updated files to deploy folder."
}

# 3. Restart server using PM2
Write-Host "Restarting car-booking server in PM2..."
pm2 restart car-booking

Write-Host "Server successfully updated in $rootDir!"
