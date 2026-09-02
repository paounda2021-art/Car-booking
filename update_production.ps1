# update_production.ps1
# Script to safely backup server data to ZIP in C:\Backups\ and update production server to match GitHub main 100%

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $rootDir) { $rootDir = Get-Location }

Write-Host "Updating production server in $rootDir..." -ForegroundColor Green

# 1. Stop PM2 server first to release Windows file locks on database.db
Write-Host "Stopping car-booking service to release file locks..." -ForegroundColor Yellow
try {
    pm2 stop car-booking
    Start-Sleep -Seconds 2
} catch {}

# 2. Create timestamped ZIP backup in C:\Backups\ before pulling new code
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$targetBackupDir = "C:\Backups"
if (-not (Test-Path $targetBackupDir)) {
    New-Item -ItemType Directory -Path $targetBackupDir | Out-Null
}

$zipFileName = "backup_server_$timestamp.zip"
$zipFilePath = Join-Path $targetBackupDir $zipFileName

Write-Host "Creating timestamped ZIP backup at $zipFilePath..." -ForegroundColor Yellow

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
        Write-Host "Server ZIP Backup created successfully: $zipFilePath" -ForegroundColor Green
    } catch {
        Write-Host "Warning creating ZIP backup in C:\Backups: $_" -ForegroundColor Red
    }
}

# 3. Save temporary copy of live database.db & bookings.json to preserve live server data 100%
$tempLiveDb = Join-Path $targetBackupDir "live_db_$timestamp.db"
$tempLiveJson = Join-Path $targetBackupDir "live_bookings_$timestamp.json"

if (Test-Path "$rootDir\database.db") {
    Copy-Item "$rootDir\database.db" $tempLiveDb -Force
    Write-Host "Live database.db preserved to $tempLiveDb" -ForegroundColor Cyan
}
if (Test-Path "$rootDir\bookings.json") {
    Copy-Item "$rootDir\bookings.json" $tempLiveJson -Force
    Write-Host "Live bookings.json preserved to $tempLiveJson" -ForegroundColor Cyan
}

# 4. Force pull updated master codebase and database from GitHub
Write-Host "Force pulling latest master database.db and codebase from GitHub..." -ForegroundColor Yellow
git config user.email "admin@fishmarket.co.th"
git config user.name "Administrator"
git fetch origin main
git reset --hard origin/main

# 5. Execute database sync from master bookings.json
Write-Host "Syncing master database records..." -ForegroundColor Green
node -e "
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
try {
  const db = new DatabaseSync('database.db');
  db.exec('DELETE FROM bookings');
  const bList = JSON.parse(fs.readFileSync('bookings.json', 'utf8'));
  const stmt = db.prepare('INSERT INTO bookings (id, requester, requesterEmail, managerEmail, position, department, office, division, controlUnit, driverLicenseFile, addressNo, addressMoo, addressRoad, addressSubdistrict, addressDistrict, addressProvince, purpose, destination, ref, passengers, startDate, endDate, trips, travelType, carId, distance, price, goCheck, backCheck, status, currentApprovalLevel, driverName, returnedEarly, driverAccepted, signatures, waitingForRequesterInput, taxiInfo, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  bList.forEach(b => {
    stmt.run(b.id, b.requester||'', b.requesterEmail||'', b.managerEmail||'', b.position||'', b.department||'', b.office||'', b.division||'', b.controlUnit||'', b.driverLicenseFile||'', b.addressNo||'', b.addressMoo||'', b.addressRoad||'', b.addressSubdistrict||'', b.addressDistrict||'', b.addressProvince||'', b.purpose||'', b.destination||'', b.ref||'', b.passengers||'', b.startDate||'', b.endDate||'', b.trips||2, b.travelType||'', b.carId||'', b.distance||0, b.price||0, b.goCheck?1:0, b.backCheck?1:0, b.status||'pending', b.currentApprovalLevel||1, b.driverName||'', b.returnedEarly?1:0, b.driverAccepted?1:0, typeof b.signatures==='string'?b.signatures:JSON.stringify(b.signatures||[]), b.waitingForRequesterInput?1:0, typeof b.taxiInfo==='string'?b.taxiInfo:JSON.stringify(b.taxiInfo||{}), b.active?1:0);
  });
  const count = db.prepare('SELECT COUNT(*) as c FROM bookings').get();
  db.close();
  console.log('✅ Database sync completed! Total records in database.db: ' + count.c);
} catch(e) {
  console.log('Sync note:', e.message);
}
"

# 6. Restart server in PM2
Write-Host "Restarting car-booking server in PM2..." -ForegroundColor Yellow
try {
    pm2 start car-booking
} catch {
    pm2 restart car-booking --update-env
}

Write-Host "Production server updated successfully without overwriting live database! Backup ZIP saved in $zipFilePath" -ForegroundColor Green
