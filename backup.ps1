# PowerShell ZIP Backup Script for Car Booking Application
$ts = Get-Date -Format 'yyyy-MM-dd_HHmm'
$backupDir = 'C:\apps\car-booking_backups'
$tempDir = Join-Path $env:TEMP "car-booking-backup-temp-$ts"

if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}

$zipPath = Join-Path $backupDir "car-booking-backup_$ts.zip"

Write-Host "Starting ZIP Backup of C:\apps\car-booking..." -ForegroundColor Yellow

# Copy files to temp folder first to bypass active file locks (e.g. SQLite database.db)
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
New-Item -ItemType Directory -Path $tempDir | Out-Null

Get-ChildItem -Path 'C:\apps\car-booking' -Exclude 'node_modules','.git' | Copy-Item -Destination $tempDir -Recurse -Force

Compress-Archive -Path "$tempDir\*" -DestinationPath $zipPath -Force
Remove-Item $tempDir -Recurse -Force

Write-Host "ZIP Backup created successfully!" -ForegroundColor Green
Get-Item $zipPath | Select-Object Name, @{N='Size (MB)';E={[math]::Round($_.Length/1MB,2)}}, LastWriteTime | Format-Table -AutoSize
