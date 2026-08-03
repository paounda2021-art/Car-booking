# backup_only.ps1
# Script to create a timestamped ZIP backup of server database and files in C:\Backups\

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $rootDir) { $rootDir = Get-Location }

Write-Host "📦 Creating server backup in C:\Backups\..." -ForegroundColor Green

# 1. Stop PM2 server first to release Windows file locks on database.db
Write-Host "Stopping car-booking service temporarily to release file locks..." -ForegroundColor Yellow
try {
    pm2 stop car-booking
} catch {}

# 2. Create timestamped ZIP backup in C:\Backups\
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$targetBackupDir = "C:\Backups"
if (-not (Test-Path $targetBackupDir)) {
    New-Item -ItemType Directory -Path $targetBackupDir | Out-Null
}

$zipFileName = "backup_server_$timestamp.zip"
$zipFilePath = Join-Path $targetBackupDir $zipFileName

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
        Write-Host "✅ Server ZIP Backup created successfully: $zipFilePath" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Error creating ZIP backup in C:\Backups: $_" -ForegroundColor Red
    }
}

# 3. Restart server in PM2
Write-Host "Restarting car-booking server in PM2..." -ForegroundColor Yellow
try {
    pm2 start car-booking
} catch {}

Write-Host "🎉 Backup complete! File saved in $zipFilePath" -ForegroundColor Green
