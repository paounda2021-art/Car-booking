# deploy_server.ps1
# Get the directory where the script is located
$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $rootDir) { $rootDir = Get-Location }

Write-Host "Syncing bookings database in $rootDir..."

# 1. Download database from Cloudflare Pages
$bookingsFile = Join-Path $rootDir "bookings.json"
Invoke-RestMethod -Uri "https://car-booking-5l7.pages.dev/api/get-bookings" | ConvertTo-Json -Depth 10 | Out-File -FilePath $bookingsFile -Encoding utf8

# 2. Copy to deploy directory if it exists
$deployDir = "D:\deploy_latest"
if (Test-Path $deployDir) {
    Copy-Item -Path $bookingsFile -Destination (Join-Path $deployDir "bookings.json") -Force
    Copy-Item -Path (Join-Path $rootDir "app.js"), (Join-Path $rootDir "index.html"), (Join-Path $rootDir "style.css"), (Join-Path $rootDir "server.js") -Destination $deployDir -Force
}

# 3. Restart server
Write-Host "Restarting server..."
Stop-Process -Name node -Force -ErrorAction SilentlyContinue
cd $rootDir
Start-Process node -ArgumentList "server.js" -WindowStyle Hidden

Write-Host "Server successfully updated in $rootDir!"
