# deploy_server.ps1
# Get the directory where the script is located
$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $rootDir) { $rootDir = Get-Location }

Write-Host "Syncing database and codebase in $rootDir..."

# 1. Download database from Cloudflare Pages (with robust error handling)
$bookingsFile = Join-Path $rootDir "bookings.json"
try {
    $data = Invoke-RestMethod -Uri "https://car-booking-5l7.pages.dev/api/get-bookings" -ErrorAction Stop
    $data | ConvertTo-Json -Depth 10 | Out-File -FilePath $bookingsFile -Encoding utf8
    Write-Host "Database successfully synced from Cloudflare."
} catch {
    Write-Warning "Cannot resolve or connect to Cloudflare: $_"
    Write-Warning "Safe Mode: Keeping the existing bookings.json database file intact."
}

# 2. Copy to deploy directory if it exists
$deployDir = "D:\deploy_latest"
if (Test-Path $deployDir) {
    if (Test-Path $bookingsFile) {
        Copy-Item -Path $bookingsFile -Destination (Join-Path $deployDir "bookings.json") -Force
    }
    Copy-Item -Path (Join-Path $rootDir "app.js"), (Join-Path $rootDir "index.html"), (Join-Path $rootDir "style.css"), (Join-Path $rootDir "server.js"), (Join-Path $rootDir "line_config.json") -Destination $deployDir -Force
    Write-Host "Copied updated files to deploy folder."
}

# 3. Restart server using PM2
Write-Host "Restarting car-booking server in PM2..."
pm2 restart car-booking

Write-Host "Server successfully updated in $rootDir!"
