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
    Copy-Item -Path (Join-Path $rootDir "app.js"), (Join-Path $rootDir "index.html"), (Join-Path $rootDir "style.css"), (Join-Path $rootDir "server.js") -Destination $deployDir -Force
    Write-Host "Copied updated files to deploy folder."
}

# 3. Restart server (Target ONLY the car-booking process)
Write-Host "Restarting car-booking server..."
$processes = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'"
$killed = $false
foreach ($p in $processes) {
    $cmdLine = $p.CommandLine
    if ($cmdLine -and ($cmdLine -like "*car-booking*" -or $cmdLine -like "*$rootDir*")) {
        Write-Host "Stopping car-booking process with ID $($p.ProcessId)..."
        Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
        $killed = $true
    }
}
if (-not $killed) {
    Write-Host "No active car-booking node processes found running."
}

cd $rootDir
Start-Process node -ArgumentList "server.js" -WindowStyle Hidden

Write-Host "Server successfully updated in $rootDir!"
